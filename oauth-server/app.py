from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from urllib.parse import urlencode
from cryptography.fernet import Fernet
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import base64, hashlib, html, json, os, time
import requests
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials, firestore

FRONTEND_ORIGIN = os.getenv('KW_FRONTEND_ORIGIN', 'https://clem21-collab.github.io').rstrip('/')
FIREBASE_PROJECT_ID = os.getenv('KW_FIREBASE_PROJECT_ID', 'karaokeworld-d503f').strip()
GOOGLE_CLIENT_ID = os.getenv('KW_GOOGLE_CLIENT_ID', '').strip()
GOOGLE_CLIENT_SECRET = os.getenv('KW_GOOGLE_CLIENT_SECRET', '').strip()
TOKEN_SECRET = os.getenv('KW_TOKEN_ENCRYPTION_KEY', '').strip()
STATE_SECRET = os.getenv('KW_STATE_SECRET', TOKEN_SECRET).strip()
FIREBASE_SERVICE_ACCOUNT_JSON = os.getenv('KW_FIREBASE_SERVICE_ACCOUNT_JSON', '').strip()
TOKEN_COLLECTION = os.getenv('KW_OAUTH_COLLECTION', '_server_google_drive_oauth').strip()
DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'


def redirect_uri():
    explicit = os.getenv('KW_GOOGLE_REDIRECT_URI', '').strip()
    if explicit:
        return explicit
    render_url = os.getenv('RENDER_EXTERNAL_URL', '').strip().rstrip('/')
    if render_url:
        return render_url + '/google/oauth/callback'
    host = os.getenv('RENDER_EXTERNAL_HOSTNAME', '').strip()
    if host:
        return 'https://' + host + '/google/oauth/callback'
    return ''


GOOGLE_REDIRECT_URI = redirect_uri()

app = FastAPI(title='KaraokeWorld Drive OAuth', version='0.28.1')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=['GET', 'POST', 'DELETE', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type'],
)


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


def _init_firebase():
    if firebase_admin._apps:
        return
    if FIREBASE_SERVICE_ACCOUNT_JSON:
        try:
            info = json.loads(FIREBASE_SERVICE_ACCOUNT_JSON)
        except json.JSONDecodeError:
            raise HTTPException(503, 'KW_FIREBASE_SERVICE_ACCOUNT_JSON n’est pas un JSON valide.')
        cred = credentials.Certificate(info)
        firebase_admin.initialize_app(cred, {'projectId': FIREBASE_PROJECT_ID})
    else:
        try:
            firebase_admin.initialize_app(options={'projectId': FIREBASE_PROJECT_ID})
        except Exception as exc:
            raise HTTPException(503, f'Firebase Admin non configuré: {type(exc).__name__}')


def _firestore():
    _init_firebase()
    try:
        return firestore.client()
    except Exception as exc:
        raise HTTPException(503, f'Firestore serveur indisponible: {type(exc).__name__}')


def _token_doc(uid):
    return _firestore().collection(TOKEN_COLLECTION).document(uid)


def _store_refresh_token(uid, token):
    encrypted = _fernet().encrypt(token.encode('utf-8')).decode('utf-8')
    _token_doc(uid).set({'refreshToken': encrypted, 'updatedAt': int(time.time())}, merge=True)


def _load_refresh_token(uid):
    snap = _token_doc(uid).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    encrypted = data.get('refreshToken')
    if not encrypted:
        return None
    try:
        return _fernet().decrypt(encrypted.encode('utf-8')).decode('utf-8')
    except Exception:
        raise HTTPException(500, 'Le refresh token Drive stocké est illisible.')


def _delete_refresh_token(uid):
    _token_doc(uid).delete()


def _firebase_user(authorization):
    if not authorization or not authorization.lower().startswith('bearer '):
        raise HTTPException(401, 'Authentification Firebase requise.')
    token = authorization.split(' ', 1)[1].strip()
    if not token:
        raise HTTPException(401, 'Jeton Firebase absent.')
    _init_firebase()
    try:
        info = firebase_auth.verify_id_token(token, check_revoked=False)
    except Exception as exc:
        raise HTTPException(401, f'Jeton Firebase invalide: {type(exc).__name__}')
    uid = info.get('uid') or info.get('sub')
    if not uid:
        raise HTTPException(401, 'Jeton Firebase sans UID.')
    return {**info, 'uid': uid}


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


@app.get('/health')
def health():
    return {
        'ok': True,
        'service': 'karaokeworld-drive-oauth',
        'version': '0.28.1',
        'oauthConfigured': oauth_ready(),
        'redirectUri': GOOGLE_REDIRECT_URI,
    }


@app.get('/google/oauth/status')
def google_oauth_status(authorization: str | None = Header(default=None)):
    user = _firebase_user(authorization)
    connected = False
    if oauth_ready():
        connected = bool(_load_refresh_token(user['uid']))
    return {'configured': oauth_ready(), 'connected': connected, 'redirectUri': GOOGLE_REDIRECT_URI}


@app.post('/google/oauth/start')
def google_oauth_start(authorization: str | None = Header(default=None)):
    if not oauth_ready():
        raise HTTPException(503, 'OAuth Drive serveur non configuré.')
    user = _firebase_user(authorization)
    state = _state_serializer().dumps({'uid': user['uid'], 'email': user.get('email', '')})
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
    ok = False
    message = ''
    if error:
        message = f'Autorisation Google refusée: {error}'
    elif not code or not state:
        message = 'Réponse OAuth Google incomplète.'
    else:
        try:
            state_data = _state_serializer().loads(state, max_age=600)
        except SignatureExpired:
            state_data = None
            message = 'La demande OAuth a expiré. Recommence depuis KaraokeWorld.'
        except BadSignature:
            state_data = None
            message = 'État OAuth invalide.'
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
    refresh_token = _load_refresh_token(user['uid'])
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
            _delete_refresh_token(user['uid'])
        raise
    access_token = payload.get('access_token')
    if not access_token:
        raise HTTPException(502, 'Google n’a pas renvoyé d’access token.')
    return {
        'access_token': access_token,
        'expires_in': int(payload.get('expires_in') or 3600),
        'scope': payload.get('scope', DRIVE_SCOPE),
        'token_type': payload.get('token_type', 'Bearer'),
    }


@app.delete('/google/oauth/disconnect')
def google_oauth_disconnect(authorization: str | None = Header(default=None)):
    user = _firebase_user(authorization)
    _delete_refresh_token(user['uid'])
    return {'ok': True}
