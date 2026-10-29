from app import app
from fastapi import Query, HTTPException
import os, threading, time, unicodedata, re
import requests

_MB_LOCK = threading.Lock()
_MB_LAST = 0.0
_MB_UA = 'KaraokeWorld/0.29.0 (https://clem21-collab.github.io/karaokeworld/)'
_COVER_CACHE = {}
_COVER_CACHE_TTL = 7 * 24 * 60 * 60
_YOUTUBE_KEY = (os.getenv('KW_YOUTUBE_API_KEY') or os.getenv('YOUTUBE_API_KEY') or '').strip()
_YOUTUBE_CACHE = {}
_YOUTUBE_CACHE_TTL = 6 * 60 * 60


def _norm(value):
    text = unicodedata.normalize('NFKD', str(value or ''))
    text = ''.join(ch for ch in text if not unicodedata.combining(ch)).lower()
    return re.sub(r'[^a-z0-9]+', ' ', text).strip()


def _similarity(a, b):
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.84
    aa, bb = set(a.split()), set(b.split())
    return len(aa & bb) / max(len(aa), len(bb), 1)


def _deezer_cover(title, artist):
    try:
        r = requests.get(
            'https://api.deezer.com/search',
            params={'q': f'{artist} {title}'.strip(), 'limit': 25},
            headers={'User-Agent': _MB_UA, 'Accept': 'application/json'},
            timeout=12,
        )
        r.raise_for_status()
        payload = r.json()
    except (requests.RequestException, ValueError):
        return ''
    if isinstance(payload, dict) and payload.get('error'):
        return ''
    best, best_score = None, 0.0
    for item in (payload.get('data') or []):
        item_artist = ((item.get('artist') or {}).get('name') or '')
        item_title = item.get('title_short') or item.get('title') or ''
        score = _similarity(item_title, title) * 0.72
        score += (_similarity(item_artist, artist) if artist else 0.7) * 0.28
        if _norm(item_title) == _norm(title):
            score += 0.16
        if artist and _norm(item_artist) == _norm(artist):
            score += 0.10
        if score > best_score:
            best, best_score = item, score
    if not best or best_score < 0.54:
        return ''
    album = best.get('album') or {}
    return album.get('cover_xl') or album.get('cover_big') or album.get('cover_medium') or album.get('cover') or ''


def _mb_get(url, params=None):
    global _MB_LAST
    with _MB_LOCK:
        delay = 1.05 - (time.monotonic() - _MB_LAST)
        if delay > 0:
            time.sleep(delay)
        response = requests.get(
            url,
            params=params or {},
            headers={'User-Agent': _MB_UA, 'Accept': 'application/json'},
            timeout=12,
        )
        _MB_LAST = time.monotonic()
    response.raise_for_status()
    return response.json()


def _escape_query(value):
    return str(value or '').replace('\\', '\\\\').replace('"', '\\"').strip()


def _musicbrainz_cover(title, artist):
    title_q = _escape_query(title)
    artist_q = _escape_query(artist)
    query = f'recording:"{title_q}"'
    if artist_q:
        query += f' AND artist:"{artist_q}"'
    try:
        data = _mb_get('https://musicbrainz.org/ws/2/recording/', {'query': query, 'fmt': 'json', 'limit': 10})
    except requests.RequestException:
        return ''

    release_ids = []
    for recording in data.get('recordings') or []:
        for release in recording.get('releases') or []:
            rid = release.get('id')
            if rid and rid not in release_ids:
                release_ids.append(rid)
        if len(release_ids) >= 10:
            break

    for rid in release_ids[:10]:
        try:
            r = requests.get(
                f'https://coverartarchive.org/release/{rid}',
                headers={'User-Agent': _MB_UA, 'Accept': 'application/json'},
                timeout=10,
            )
            if r.status_code == 404:
                continue
            r.raise_for_status()
            art = r.json()
        except (requests.RequestException, ValueError):
            continue
        images = art.get('images') or []
        front = next((img for img in images if img.get('front')), None) or (images[0] if images else None)
        if not front:
            continue
        thumbs = front.get('thumbnails') or {}
        return thumbs.get('1200') or thumbs.get('large') or thumbs.get('500') or front.get('image') or ''
    return ''


@app.get('/covers/search')
def cover_search(title: str = Query(min_length=1, max_length=200), artist: str = Query(default='', max_length=200)):
    cache_key = (_norm(title), _norm(artist))
    now = time.time()
    cached = _COVER_CACHE.get(cache_key)
    if cached and now - cached[0] < _COVER_CACHE_TTL:
        return {'url': cached[1], 'source': cached[2], 'cached': True}

    url = _deezer_cover(title, artist)
    source = 'deezer' if url else ''
    if not url:
        url = _musicbrainz_cover(title, artist)
        source = 'coverartarchive' if url else 'none'

    _COVER_CACHE[cache_key] = (now, url, source)
    if len(_COVER_CACHE) > 2500:
        oldest = sorted(_COVER_CACHE.items(), key=lambda x: x[1][0])[:500]
        for key, _ in oldest:
            _COVER_CACHE.pop(key, None)
    return {'url': url, 'source': source}


def _youtube_request(path, params):
    if not _YOUTUBE_KEY:
        raise HTTPException(503, 'La recherche YouTube publique n’est pas encore configurée sur le serveur.')
    payload = dict(params)
    payload['key'] = _YOUTUBE_KEY
    try:
        response = requests.get(
            f'https://www.googleapis.com/youtube/v3/{path}',
            params=payload,
            headers={'User-Agent': _MB_UA, 'Accept': 'application/json'},
            timeout=15,
        )
        data = response.json()
    except requests.RequestException as exc:
        raise HTTPException(502, f'YouTube indisponible: {type(exc).__name__}')
    except ValueError:
        raise HTTPException(502, 'Réponse YouTube invalide.')
    if not response.ok:
        detail = ((data.get('error') or {}).get('message') if isinstance(data, dict) else None) or f'HTTP {response.status_code}'
        raise HTTPException(429 if response.status_code == 403 and 'quota' in detail.lower() else 502, f'YouTube: {detail}')
    return data


def _public_youtube_search(query, mode):
    search_text = f'{query} karaoké instrumental' if mode == 'karaoke' else f'{query} officiel audio'
    data = _youtube_request('search', {
        'part': 'snippet',
        'type': 'video',
        'maxResults': '12',
        'q': search_text,
        'videoCategoryId': '10',
        'videoEmbeddable': 'true',
        'videoSyndicated': 'true',
        'relevanceLanguage': 'fr',
        'regionCode': 'FR',
        'safeSearch': 'moderate',
    })
    raw = [x for x in (data.get('items') or []) if ((x.get('id') or {}).get('videoId'))]
    ids = [x['id']['videoId'] for x in raw]
    if not ids:
        return []
    details = _youtube_request('videos', {
        'part': 'status,contentDetails',
        'id': ','.join(ids),
    })
    by_id = {x.get('id'): x for x in (details.get('items') or [])}
    out = []
    for item in raw:
        video_id = item['id']['videoId']
        detail = by_id.get(video_id) or {}
        status = detail.get('status') or {}
        restriction = (detail.get('contentDetails') or {}).get('regionRestriction') or {}
        if status.get('embeddable') is False:
            continue
        if 'FR' in (restriction.get('blocked') or []):
            continue
        sn = item.get('snippet') or {}
        thumbs = sn.get('thumbnails') or {}
        out.append({
            'id': video_id,
            'title': sn.get('title') or 'Vidéo YouTube',
            'channel': sn.get('channelTitle') or '',
            'thumbnail': (thumbs.get('medium') or thumbs.get('high') or thumbs.get('default') or {}).get('url') or '',
            'publishedAt': sn.get('publishedAt') or '',
        })
    return out


@app.get('/youtube/status')
def youtube_status():
    return {'configured': bool(_YOUTUBE_KEY), 'publicSearch': True}


@app.get('/youtube/search')
def youtube_search(
    q: str = Query(min_length=1, max_length=180),
    mode: str = Query(default='original', pattern='^(original|karaoke)$'),
):
    query = ' '.join(str(q or '').split()).strip()
    cache_key = (_norm(query), mode)
    now = time.time()
    cached = _YOUTUBE_CACHE.get(cache_key)
    if cached and now - cached[0] < _YOUTUBE_CACHE_TTL:
        return {'items': cached[1], 'mode': mode, 'cached': True}
    items = _public_youtube_search(query, mode)
    _YOUTUBE_CACHE[cache_key] = (now, items)
    if len(_YOUTUBE_CACHE) > 1200:
        oldest = sorted(_YOUTUBE_CACHE.items(), key=lambda x: x[1][0])[:250]
        for key, _ in oldest:
            _YOUTUBE_CACHE.pop(key, None)
    return {'items': items, 'mode': mode, 'cached': False}
