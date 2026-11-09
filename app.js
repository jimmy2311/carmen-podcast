
(() => {
  'use strict';
  const data=window.EPISODES || [];
  const recorded=data.filter(e=>e.stable);
  const $=s=>document.querySelector(s);
  const audio=$('#audio');
  let season=3,selected=null,queue=[],autoAdvance=false;
  const status=s=>{$('#status').textContent=s;};
  const label=e=>`Season ${e.season}, Episode ${e.episode}: ${e.title}`;
  function markSelected(){document.querySelectorAll('.episode').forEach(x=>x.classList.toggle('active',selected&&x.dataset.episode===`${selected.season}-${selected.episode}`));}
  function setAudio(e,play=true){
    if(!e || !e.stable){status('That recording has not been saved.');return;}
    const same=selected===e;
    selected=e;
    if(!same){audio.pause();audio.src=e.audio;audio.load();}
    $('#now').textContent=label(e);markSelected();
    try{localStorage.setItem('carmenSavedEpisode',`${e.season}-${e.episode}`);}catch(_){}
    if('mediaSession' in navigator){try{navigator.mediaSession.metadata=new MediaMetadata({title:e.title,album:`Season ${e.season}`,artist:'Carmen & The House That Never Sleeps'});}catch(_){}}
    if(play){const p=audio.play();if(p&&p.catch){p.catch(()=>status('Tap the triangle in the audio bar. On iPhone, open the real website in Safari.'));}}
    status('Locally saved MP3 loaded. No expiring Runway link.');
  }
  function next(){if(!selected)return;let i=queue.indexOf(selected);if(autoAdvance && i>=0 && i+1<queue.length){setAudio(queue[i+1]);return;}let group=recorded.filter(x=>x.season===selected.season),j=group.indexOf(selected);if(j>=0&&j+1<group.length){setAudio(group[j+1]);return;}status('End of season.');}
  function previous(){if(!selected)return;if(audio.currentTime>5){audio.currentTime=0;return;}let group=recorded.filter(x=>x.season===selected.season),j=group.indexOf(selected);if(j>0)setAudio(group[j-1]);}
  function showSeason(n){season=n;document.querySelectorAll('.season').forEach(x=>x.hidden=Number(x.dataset.season)!==n);document.querySelectorAll('.tabs button').forEach(x=>{let yes=Number(x.dataset.season)===n;x.classList.toggle('selected',yes);x.setAttribute('aria-pressed',String(yes));}); $('#search').value='';applySearch();}
  function applySearch(){let query=$('#search').value.trim().toLowerCase();document.querySelectorAll(`.season[data-season="${season}"] .episode`).forEach(x=>x.hidden=!x.dataset.search.includes(query));}
  for(const b of document.querySelectorAll('.tabs button')) b.addEventListener('click',()=>showSeason(Number(b.dataset.season)));
  for(const b of document.querySelectorAll('.play-episode')) b.addEventListener('click',()=>{autoAdvance=false;let e=data.find(x=>x.season===Number(b.dataset.season)&&x.episode===Number(b.dataset.episode));setAudio(e);});
  $('#playAll').addEventListener('click',()=>{autoAdvance=true;queue=recorded.filter(x=>x.season>=2);setAudio(queue[0]);});
  $('#playSeason').addEventListener('click',()=>{queue=recorded.filter(x=>x.season===season);if(!queue.length){status('No permanent audio for this season yet.');return;}autoAdvance=true;setAudio(queue[0]);});
  $('#next').addEventListener('click',next);$('#prev').addEventListener('click',previous);
  $('#search').addEventListener('input',applySearch);
  audio.addEventListener('ended',next);
  audio.addEventListener('play',()=>{status('Playing.');});
  audio.addEventListener('error',()=>{status('Audio failed to load. Tap Open audio in the episode list for the direct MP3.');});
  audio.addEventListener('timeupdate',()=>{if(selected){try{localStorage.setItem('carmenSavedPosition',JSON.stringify({id:`${selected.season}-${selected.episode}`,seconds:audio.currentTime}));}catch(_){}}});
  if('mediaSession' in navigator){try{navigator.mediaSession.setActionHandler('nexttrack',next);navigator.mediaSession.setActionHandler('previoustrack',previous);}catch(_){}}
  if(navigator.serviceWorker && location.protocol==='https:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
  showSeason(3);
  let saved='';try{saved=localStorage.getItem('carmenSavedEpisode')||'';}catch(_){}
  let e=recorded.find(x=>`${x.season}-${x.episode}`===saved)||recorded.find(x=>x.season===3)||recorded[0];
  setAudio(e,false);
})();