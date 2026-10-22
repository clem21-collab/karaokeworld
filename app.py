from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from tempfile import NamedTemporaryFile
from pathlib import Path
import difflib, re, os

app = FastAPI(title="KaraokeWorld Sync Engine", version="0.1")
app.add_middleware(CORSMiddleware, allow_origins=["https://clem21-collab.github.io"], allow_methods=["*"], allow_headers=["*"])

def norm(s):
    return re.sub(r"[^a-z0-9à-ÿ ]+", " ", s.lower()).strip()

def similarity(a,b):
    return difflib.SequenceMatcher(None,norm(a),norm(b)).ratio()

def align_lines(lines, segments):
    # Monotonic dynamic-programming alignment: supplied lyric lines -> recognized sung segments.
    n,m=len(lines),len(segments)
    dp=[[(-10**9,None) for _ in range(m+1)] for _ in range(n+1)]
    dp[0][0]=(0,None)
    for i in range(n+1):
        for j in range(m+1):
            cur=dp[i][j][0]
            if cur < -10**8: continue
            if j<m and cur-0.15>dp[i][j+1][0]: dp[i][j+1]=(cur-0.15,(i,j,'skipseg'))
            if i<n and cur-0.35>dp[i+1][j][0]: dp[i+1][j]=(cur-0.35,(i,j,'skipline'))
            if i<n and j<m:
                sc=cur+similarity(lines[i],segments[j]['text'])*2
                if sc>dp[i+1][j+1][0]: dp[i+1][j+1]=(sc,(i,j,'match'))
    j=max(range(m+1),key=lambda x:dp[n][x][0]); i=n; pairs=[]
    while i or j:
        prev=dp[i][j][1]
        if not prev: break
        pi,pj,act=prev
        if act=='match': pairs.append((pi,pj))
        i,j=pi,pj
    byline={i:j for i,j in reversed(pairs)}
    out=[]
    for i,line in enumerate(lines):
        if i in byline:
            s=segments[byline[i]]; conf=similarity(line,s['text'])
            out.append({'line':i,'text':line,'start':round(float(s['start']),3),'end':round(float(s['end']),3),'confidence':round(conf,3),'recognized':s['text']})
        else: out.append({'line':i,'text':line,'start':None,'end':None,'confidence':0,'recognized':''})
    return out

@app.get('/health')
def health(): return {'ok':True,'engine':'karaokeworld-sync'}

@app.post('/align')
async def align(audio: UploadFile=File(...), lyrics: str=Form(...), language: str=Form('fr')):
    lines=[x.strip() for x in lyrics.splitlines() if x.strip()]
    if not lines: raise HTTPException(400,'Paroles vides')
    suffix=Path(audio.filename or 'audio.mp3').suffix or '.mp3'
    with NamedTemporaryFile(delete=False,suffix=suffix) as f:
        f.write(await audio.read()); path=f.name
    try:
        import whisperx
        device=os.getenv('KW_DEVICE','cuda')
        compute='float16' if device=='cuda' else 'int8'
        model=whisperx.load_model(os.getenv('KW_MODEL','large-v3'),device,compute_type=compute,language=language)
        data=whisperx.load_audio(path)
        result=model.transcribe(data,batch_size=int(os.getenv('KW_BATCH','8')),language=language)
        segments=[{'start':s['start'],'end':s['end'],'text':s['text']} for s in result.get('segments',[]) if s.get('text','').strip()]
        aligned=align_lines(lines,segments)
        return {'lines':aligned,'segments':segments,'warning':'Le chant reste plus difficile que la parole. Vérifie les lignes à faible confiance dans Sync Studio.'}
    except Exception as e:
        raise HTTPException(500,f'Analyse impossible: {type(e).__name__}: {e}')
    finally:
        try: os.unlink(path)
        except OSError: pass
