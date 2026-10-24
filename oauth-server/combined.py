from app import app
from fastapi import Query
import threading, time
import requests

_MB_LOCK = threading.Lock()
_MB_LAST = 0.0
_MB_UA = 'KaraokeWorld/0.28.2 (https://clem21-collab.github.io/karaokeworld/)'


def _mb_get(url, params):
    global _MB_LAST
    with _MB_LOCK:
        delay = 1.05 - (time.monotonic() - _MB_LAST)
        if delay > 0:
            time.sleep(delay)
        response = requests.get(url, params=params, headers={'User-Agent': _MB_UA, 'Accept': 'application/json'}, timeout=12)
        _MB_LAST = time.monotonic()
    response.raise_for_status()
    return response.json()


def _escape_query(value):
    return str(value or '').replace('\\', '\\\\').replace('"', '\\"').strip()


@app.get('/covers/search')
def cover_search(title: str = Query(min_length=1, max_length=200), artist: str = Query(default='', max_length=200)):
    title_q = _escape_query(title)
    artist_q = _escape_query(artist)
    query = f'recording:"{title_q}"'
    if artist_q:
        query += f' AND artist:"{artist_q}"'
    try:
        data = _mb_get('https://musicbrainz.org/ws/2/recording/', {'query': query, 'fmt': 'json', 'limit': 8})
    except requests.RequestException:
        return {'url': '', 'source': 'musicbrainz-unavailable'}

    recordings = data.get('recordings') or []
    release_ids = []
    for recording in recordings:
        for release in recording.get('releases') or []:
            rid = release.get('id')
            if rid and rid not in release_ids:
                release_ids.append(rid)
        if len(release_ids) >= 12:
            break

    for rid in release_ids[:12]:
        art = f'https://coverartarchive.org/release/{rid}/front-500'
        try:
            r = requests.head(art, allow_redirects=False, timeout=8, headers={'User-Agent': _MB_UA})
            if r.status_code in (200, 301, 302, 303, 307, 308):
                return {'url': art, 'source': 'coverartarchive', 'releaseId': rid}
        except requests.RequestException:
            continue
    return {'url': '', 'source': 'musicbrainz'}
