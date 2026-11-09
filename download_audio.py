#!/usr/bin/env python3
"""Archive the user's previously produced Runway podcast recordings for permanent static hosting."""
import concurrent.futures
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import time
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parent
OUT=ROOT/'audio'
OUT.mkdir(exist_ok=True)
SOURCES=json.loads((ROOT/'audio_sources.json').read_text(encoding='utf-8'))
def download(url,path):
    last=None
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; Carmen-Podcast-Archive/1.0)'})
            with urllib.request.urlopen(req,timeout=85) as resp:
                ctype=resp.headers.get('Content-Type','').lower()
                data=resp.read()
            if len(data)<1200 or 'text/html' in ctype or 'application/json' in ctype or 'xml' in ctype:
                raise ValueError('Not a playable audio file: type='+ctype+' size='+str(len(data)))
            if not (data[:3]==b'ID3' or (data[0]==0xff and data[1]&0xe0==0xe0)):
                raise ValueError('Invalid MP3 signature: '+repr(data[:10]))
            path.write_bytes(data)
            return
        except Exception as exc:
            last=exc
            if attempt<2:time.sleep(1+attempt*2)
    raise RuntimeError(str(last))
def concat_mp3(items,dest,tempdir):
    if len(items)==1:
        shutil.copyfile(items[0],dest)
        return
    playlist=tempdir/'playlist.txt'
    playlist.write_text(''.join("file '"+str(p).replace("'","'\\''")+"'\n" for p in items))
    args=['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i',str(playlist),'-ac','2','-ar','44100','-c:a','libmp3lame','-q:a','3',str(dest)]
    subprocess.run(args,check=True,timeout=300)
def save(e):
    season=int(e['season']); episode=int(e['episode'])
    target=OUT/('Carmen_S%d_E%02d.mp3'%(season,episode))
    if target.is_file() and target.stat().st_size>15000:
        return {'season':season,'episode':episode,'success':True,'size':target.stat().st_size,'method':'existing'}
    options=[]
    studio=e.get('studioParts') or []
    if len(studio)>1: options.append(('studio_cast',studio))
    narrated=e.get('audio') or []
    if narrated:options.append(('bernard_narration',narrated))
    if not options:return {'season':season,'episode':episode,'success':False,'error':'No source link'}
    errors=[]
    for method,urls in options:
        try:
            with tempfile.TemporaryDirectory(prefix='carmen_') as d:
                work=pathlib.Path(d);parts=[]
                for i,url in enumerate(urls):
                    part=work/('part_%03d.mp3'%i)
                    download(url,part);parts.append(part)
                concat_mp3(parts,target,work)
            if target.stat().st_size<10000: raise ValueError('Too small')
            print('OK S%dE%02d %s %d bytes'%(season,episode,method,target.stat().st_size),flush=True)
            return {'season':season,'episode':episode,'success':True,'size':target.stat().st_size,'method':method}
        except Exception as exc:
            target.unlink(missing_ok=True)
            errors.append(method+': '+str(exc))
    print('FAILED S%dE%02d %s'%(season,episode,'; '.join(errors)),flush=True)
    return {'season':season,'episode':episode,'success':False,'error':'; '.join(errors)}
def main():
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        futures=[pool.submit(save,e) for e in SOURCES]
        for f in concurrent.futures.as_completed(futures):
            try:results.append(f.result())
            except Exception as exc:print('Unexpected error:',exc,flush=True)
    results.sort(key=lambda x:(x['season'],x['episode']))
    (ROOT/'audio-status.json').write_text(json.dumps({'attempted':len(SOURCES),'succeeded':sum(x['success'] for x in results),'results':results},indent=2)+'\n')
    print('Downloaded %d of %d episodes'%(sum(x['success'] for x in results),len(SOURCES)),flush=True)
if __name__=='__main__': main()
