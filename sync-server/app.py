from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from tempfile import NamedTemporaryFile
from pathlib import Path
from urllib.parse import urlencode
from cryptography.fernet import Fernet
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_auth_requests
import base64, difflib, hashlib, html, json, os, re, sqlite3, time
import requests

FRONTEND_ORIGIN = os.getenv('KW_FRONTEND_ORIGIN', 'https://clem21-collab.github.io').rstrip('/')
FIREBASE_PROJECT_ID = os.getenv('KW_FIREBASE_PROJECT_ID', 'karaokeworld-d503f')
GOOGLE_CLIENT_ID = os.getenv('KW_GOOGLE_CLIENT_ID', '').strip()
GOOGLE_CLIENT_SECRET = os.getenv('KW_GOOGLE_CLIENT_SECRET', '').strip()
GOOGLE_REDIRECT_URI = os.getenv('KW_GOOGLE_REDIRECT_URI', '').strip()
TOKEN_SECRET = os.getenv('KW_TOKEN_ENCRYPTION_KEY', '').strip()
STATE_SECRET = os.getenv('KW_STATE_SECRET', TOKEN_SECRET).strip()
TOKEN_DB_PATH = os.getenv('KW_TOKEN_DB_PATH', './karaokeworld_oauth.sqlite3')
DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

app = FastAPI(title='KaraokeWorld Sync Engine', version='0.2')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=['*'],
    allow_headers=['*'],
)


def norm(s):
    return re.sub(r'[^a-z0-9à-ÿ ]+', ' ', s.lower()).strip()


def similarity(a, b):
    return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()


def oauth_ready():
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI and TOKEN_SECRET and STATE_SECRET)


def _fernet():
    if not TOKEN_SECRET:
        raise HTTPException(503, 'Le chiffrement OAuth du serveur n’est pas configuré.')
    key = base64.urlsafe_b64encode(hashlib.sha256(TOKEN_SECRET.encode('utf-8')).digest())
    return Fernet(key)


def _state_serializer():
    if not STATE_SECRET:
        raise HTTPException(503, 'La signature OAuth du serveur n’est pas configurée.')
    return URLSafeTimedSerializer(STATE_SECRET, salt='karaokeworld-google-drive-oauth-v1')


def _db():
    parent = Path(TOKEN_DB_PATH).expanduser().resolve().parent
    parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(TOKEN_DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS google_drive_tokens (
            uid TEXT PRIMARY KEY,
            refresh_token BLOB NOT NULL,
            updated_at INTEGER NOT NULL
        )
    ''')
    conn.commit()
    return conn


def _store_refresh_token(uid, token):
    encrypted = _fernet().encrypt(token.encode('utf-8'))
    with _db() as conn:
        conn.execute(
            'INSERT INTO google_drive_tokens(uid, refresh_token, updated_at) VALUES(?,?,?) '
            'ON CONFLICT(uid) DO UPDATE SET refresh_token=excluded.refresh_token, updated_at=excluded.updated_at',
            (uid, encrypted, int(time.time())),
        )
        conn.commit()


def _load_refresh_token(uid):
    with _db() as conn:
        row = conn.execute('SELECT refresh_token FROM google_drive_tokens WHERE uid=?', (uid,)).fetchone()
    if not row:
        return None
    try:
        return _fernet().decrypt(row[0]).decode('utf-8')
    except Exception:
        raise HTTPException(500, 'Le refresh token Drive stocké est illisible.')


def _delete_refresh_token(uid):
    with _db() as conn:
        conn.execute('DELETE FROM google_drive_tokens WHERE uid=?', (uid,))
        conn.commit()


def _firebase_user(authorization):
    if not authorization or not authorization.lower().startswith('bearer '):
        raise HTTPException(401, 'Authentification Firebase requise.')
    token = authorization.split(' ', 1)[1].strip()
    if not token:
        raise HTTPException(401, 'Jeton Firebase absent.')
    try:
        info = google_id_token.verify_firebase_token(
            token,
            google_auth_requests.Request(),
            audience=FIREBASE_PROJECT_ID,
        )
    except Exception as exc:
        raise HTTPException(401, f'Jeton Firebase invalide: {type(exc).__name__}')
    expected_issuer = f'https://securetoken.google.com/{FIREBASE_PROJECT_ID}'
    if info.get('iss') != expected_issuer or not info.get('sub'):
        raise HTTPException(401, 'Jeton Firebase refusé.')
    return info


def _google_token_request(data):
    try:
        response = requests.post('https://oauth2.googleapis.com/token', data=data, timeout=20)
    except requests.RequestException as exc:
        raise HTTPException(502, f'Google OAuth indisponible: {type(exc).__name__}')
    try:
        payload = response.json()
    except Exception:
        payload = {}
    if not response.ok:
        reason = payload.get('error_description') or payload.get('error') or f'HTTP {response.status_code}'
        raise HTTPException(401 if response.status_code in (400, 401) else 502, f'Google OAuth: {reason}')
    return payload


def align_lines(lines, segments):
    # Monotonic dynamic-programming alignment: supplied lyric lines -> recognized sung segments.
    n, m = len(lines), len(segments)
    dp = [[(-10**9, None) for _ in range(m + 1)] for _ in range(n + 1)]
    dp[0][0] = (0, None)
    for i in range(n + 1):
        for j in range(m + 1):
            cur = dp[i][j][0]
            if cur < -10**8:
                continue
            if j < m and cur - 0.15 > dp[i][j + 1][0]:
                dp[i][j + 1] = (cur - 0.15, (i, j, 'skipseg'))
            if i < n and cur - 0.35 > dp[i + 1][j][0]:
                dp[i + 1][j] = (cur - 0.35, (i, j, 'skipline'))
            if i < n and j < m:
                sc = cur + similarity(lines[i], segments[j]['text']) * 2
                if sc > dp[i + 1][j + 1][0]:
                    dp[i + 1][j + 1] = (sc, (i, j, 'match'))
    j = max(range(m + 1), key=lambda x: dp[n][x][0])
    i = n
    pairs = []
    while i or j:
        prev = dp[i][j][1]
        if not prev:
            break
        pi, pj, act = prev
        if act == 'match':
            pairs.append((pi, pj))
        i, j = pi, pj
    byline = {i: j for i, j in reversed(pairs)}
    out = []
    for i, line in enumerate(lines):
        if i in byline:
            s = segments[byline[i]]
            conf = similarity(line, s['text'])
            out.append({'line': i, 'text': line, 'start': round(float(s['start']), 3), 'end': round(float(s['end']), 3), 'confidence': round(conf, 3), 'recognized': s['text']})
        else:
            out.append({'line': i, 'text': line, 'start': None, 'end': None, 'confidence': 0, 'recognized': ''})
    return out


@app.get('/health')
def health():
    return {'ok': True, 'engine': 'karaokeworld-sync', 'oauthDriveReady': oauth_ready()}


@app.get('/google/oauth/status')
def google_oauth_status(authorization: str | None = Header(default=None)):
    user = _firebase_user(authorization)
    return {'configured': oauth_ready(), 'connected': bool(_load_refresh_token(user['sub'])) if oauth_ready() else False}


@app.post('/google/oauth/start')
def google_oauth_start(authorization: str | None = Header(default=None)):
    if not oauth_ready():
        raise HTTPException(503, 'OAuth Drive serveur non configuré.')
    user = _firebase_user(authorization)
    state = _state_serializer().dumps({'uid': user['sub'], 'email': user.get('email', '')})
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'response_type': 'code',
        'scope': DRIVE_SCOPE,
        'access_type': 'offline',
        'include_granted_scopes': 'true',
        'prompt': 'consent',
        'state': state,
    }
    if user.get('email'):
        params['login_hint'] = user['email']
    return {'authorizationUrl': 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode(params)}


@app.get('/google/oauth/callback', response_class=HTMLResponse)
def google_oauth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
):
    if not oauth_ready():
        raise HTTPException(503, 'OAuth Drive serveur non configuré.')
    if error:
        message = f'Autorisation Google refusée: {error}'
        ok = False
    elif not code or not state:
        message = 'Réponse OAuth Google incomplète.'
        ok = False
    else:
        try:
            state_data = _state_serializer().loads(state, max_age=600)
        except SignatureExpired:
            state_data = None
            message = 'La demande OAuth a expiré. Recommence depuis KaraokeWorld.'
            ok = False
        except BadSignature:
            state_data = None
            message = 'État OAuth invalide.'
            ok = False
        if state_data:
            try:
                payload = _google_token_request({
                    'code': code,
                    'client_id': GOOGLE_CLIENT_ID,
                    'client_secret': GOOGLE_CLIENT_SECRET,
                    'redirect_uri': GOOGLE_REDIRECT_URI,
                    'grant_type': 'authorization_code',
                })
                refresh_token = payload.get('refresh_token')
                if refresh_token:
                    _store_refresh_token(state_data['uid'], refresh_token)
                elif not _load_refresh_token(state_data['uid']):
                    raise HTTPException(400, 'Google n’a pas renvoyé de refresh token. Révoque puis réautorise KaraokeWorld.')
                message = 'Google Drive est maintenant relié à KaraokeWorld. Tu peux fermer cette fenêtre.'
                ok = True
            except HTTPException as exc:
                message = str(exc.detail)
                ok = False
    event = {'type': 'kw-drive-oauth-complete', 'ok': ok, 'message': message}
    safe_event = json.dumps(event).replace('</', '<\\/')
    safe_origin = json.dumps(FRONTEND_ORIGIN)
    safe_message = html.escape(message)
    return HTMLResponse(f'''<!doctype html><html lang="fr"><meta charset="utf-8"><title>KaraokeWorld · Google Drive</title>
<body style="font-family:system-ui;background:#071422;color:#eef6ff;padding:32px"><h2>{'✅' if ok else '⚠️'} KaraokeWorld</h2><p>{safe_message}</p>
<script>try{{if(window.opener)window.opener.postMessage({safe_event},{safe_origin});}}catch(e){{}}setTimeout(()=>{{if(window.opener)window.close()}},900);</script></body></html>''')


@app.post('/google/oauth/token')
def google_oauth_token(authorization: str | None = Header(default=None)):
    if not oauth_ready():
        raise HTTPException(503, 'OAuth Drive serveur non configuré.')
    user = _firebase_user(authorization)
    refresh_token = _load_refresh_token(user['sub'])
    if not refresh_token:
        raise HTTPException(404, 'Google Drive automatique n’est pas encore activé pour ce compte.')
    try:
        payload = _google_token_request({
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token',
        })
    except HTTPException as exc:
        if exc.status_code == 401 and 'invalid_grant' in str(exc.detail):
            _delete_refresh_token(user['sub'])
        raise
    return {
        'access_token': payload.get('access_token'),
        'expires_in': int(payload.get('expires_in') or 3600),
        'scope': payload.get('scope', DRIVE_SCOPE),
        'token_type': payload.get('token_type', 'Bearer'),
    }


@app.delete('/google/oauth/disconnect')
def google_oauth_disconnect(authorization: str | None = Header(default=None)):
    user = _firebase_user(authorization)
    _delete_refresh_token(user['sub'])
    return {'ok': True}


@app.post('/align')
async def align(audio: UploadFile = File(...), lyrics: str = Form(...), language: str = Form('fr')):
    lines = [x.strip() for x in lyrics.splitlines() if x.strip()]
    if not lines:
        raise HTTPException(400, 'Paroles vides')
    suffix = Path(audio.filename or 'audio.mp3').suffix or '.mp3'
    with NamedTemporaryFile(delete=False, suffix=suffix) as f:
        f.write(await audio.read())
        path = f.name
    try:
        import whisperx
        device = os.getenv('KW_DEVICE', 'cuda')
        compute = 'float16' if device == 'cuda' else 'int8'
        model = whisperx.load_model(os.getenv('KW_MODEL', 'large-v3'), device, compute_type=compute, language=language)
        data = whisperx.load_audio(path)
        result = model.transcribe(data, batch_size=int(os.getenv('KW_BATCH', '8')), language=language)
        segments = [{'start': s['start'], 'end': s['end'], 'text': s['text']} for s in result.get('segments', []) if s.get('text', '').strip()]
        aligned = align_lines(lines, segments)
        return {'lines': aligned, 'segments': segments, 'warning': 'Le chant reste plus difficile que la parole. Vérifie les lignes à faible confiance dans Sync Studio.'}
    except Exception as e:
        raise HTTPException(500, f'Analyse impossible: {type(e).__name__}: {e}')
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
