const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
class Element {
  constructor(){this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.listeners={};this.value='';this.src='';this.currentTime=0;this.paused=true;this.children=[];this.classList={s:new Set(),add(...x){x.forEach(y=>this.s.add(y));},remove(...x){x.forEach(y=>this.s.delete(y));},contains(x){return this.s.has(x);},toggle(x,on){if(on??!this.s.has(x))this.s.add(x);else this.s.delete(x);}};}
  addEventListener(ev,fn){(this.listeners[ev]??=[]).push(fn);}
  setAttribute(k,v){this[k]=v;}
  getAttribute(k){return this[k];}
  removeAttribute(k){this[k]='';}
  appendChild(x){this.children.push(x);return x;}
  querySelectorAll(){return [];}
  querySelector(){return null;}
  load(){}
  play(){this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
  remove(){}
}
function runtime(seed={}) {
  const store=new Map(Object.entries(seed));const elements=new Map();const docEvents={};const winEvents={};const timers=[];const media=[];
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const ctx={console,URL,Blob,ArrayBuffer,DataView,Date,Math,Number,Set,Map,JSON,Promise,encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    navigator:{},MutationObserver:class{observe(){} disconnect(){}},speechSynthesis:{cancel(){ctx.cancelCount++;},speak(u){ctx.spoken.push(u);},resume(){},speaking:false,pending:false},
    SpeechSynthesisUtterance:function(text){this.text=text;},cancelCount:0,spoken:[],
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},setInterval(){},clearInterval(){},
    document:{readyState:'loading',visibilityState:'visible',body:new Element(),getElementById:get,querySelector(){return null;},querySelectorAll(){return [];},addEventListener(ev,fn){(docEvents[ev]??=[]).push(fn);},createElement(tag){const el=new Element();if(tag==='audio'){media.push(el);el.play=function(){this.paused=false;if(this.src.includes('translate_tts')){const u=new URL(this.src);ctx.spoken.push({text:u.searchParams.get('q'),lang:u.searchParams.get('tl')});}return Promise.resolve();};}return el;}},
    addEventListener(ev,fn){(winEvents[ev]??=[]).push(fn);},alert(){},confirm(){return true;},
    fetch:async()=>({ok:true,text:async()=>ctx.txt}),txt:'',FileReader:class{readAsText(file){this.onload({target:{result:file.text}});}}
  };
  ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),ctx);
  // Rendering has no bearing on audio/persistence tests; retain real loadSentence and navigation.
  vm.runInContext(`for (const name of ['setupBoard','setPlayAudioHandlers','renderSpeechPanel','renderPatternPanel','renderPrediction','renderMission','renderBrCoach','updateFavoriteButton','updateAutoReadButton','updateWalkModeButton','renderStatusLine','markCardShown','renderSrsStats','applyNewOnlyToggleUI']) window[name]=()=>{}; getPtTranslationForCard=async card=>card.pt||'';`,ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'walk-engine.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'data-loader.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'add-phrases.js'),'utf8'),ctx);
  return {ctx,store,get,timers,media,run:s=>vm.runInContext(s,ctx),events:docEvents};
}
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
  const r=runtime();const {ctx,store,get}=r;
  r.run(`sentences=[{en:'Uno',pt:'One'},{en:'Dos',pt:'Two'},{en:'Tres',pt:'Three'},{en:'Cuatro',pt:'Four'},{en:'Cinco',pt:'Five'}];window._sentences=sentences;loadSentence(sentences[2]);`);
  ctx.WalkEngine.setPref('repeatEn',5);ctx.WalkEngine.setPref('repeatPt',5);
  ctx.WalkEngine.openPocket();assert.equal(get('pocketPosition').textContent,'Frase 3 de 5');
  r.run(`autoReadMode=true;WalkEngine.start();`);
  // Real guidedReading, buildQueue, say and playOn use controlled media ended events.
  const sequence=ctx.WalkEngine.guidedReading();await flush();
  for(let i=0;i<11;i++){
    const playing=r.media.find(el=>el.onended && !el.paused);
    assert.ok(playing,'each queued utterance is active');
    playing.onended();await flush();
  }
  assert.deepEqual(ctx.spoken.map(x=>x.lang),[...Array(5).fill('es'),...Array(5).fill('en'),'es']);
  // Finish silence, allowing the real advance path to run hidden.
  ctx.document.visibilityState='hidden';
  r.media.find(el=>el.onended && !el.paused).onended();await flush();
  assert.equal(store.get('currentKey_v1'),'Cuatro');assert.equal(store.get('resumePos_v1'),'4');
  assert.equal(r.run('currentCardIndex'),3);assert.equal(r.run('seqPointer'),3);
  assert.equal(get('pocketPosition').textContent,'Frase 4 de 5');
  await sequence;
  ctx.WalkEngine.step(1);await flush();assert.equal(store.get('currentKey_v1'),'Cinco');assert.equal(r.run('currentCardIndex'),4);
  ctx.WalkEngine.step(1);await flush();assert.equal(store.get('currentKey_v1'),'Uno');assert.equal(r.run('currentCardIndex'),0);
  ctx.WalkEngine.step(-1);await flush();assert.equal(store.get('currentKey_v1'),'Cinco');assert.equal(r.run('currentCardIndex'),4);
  const token=r.run('autoReadToken');const seq=ctx.WalkEngine.state.seqToken;const cancels=ctx.cancelCount;const timerCount=r.timers.length;
  ctx.document.visibilityState='visible';for(const fn of r.events.visibilitychange)await fn();await flush();
  assert.equal(r.run('autoReadToken'),token);assert.equal(ctx.WalkEngine.state.seqToken,seq);assert.equal(ctx.cancelCount,cancels);assert.equal(r.timers.length,timerCount);
  ctx.WalkEngine.pause();assert.equal(ctx.WalkEngine.state.paused,true);ctx.WalkEngine.resume();await flush();assert.equal(ctx.WalkEngine.state.paused,false);assert.equal(r.run('currentCard.en'),'Cinco');
  ctx.WalkEngine.pause();
  ctx.txt='Uno | One\nDos | Two\nTres | Three\nCuatro | Four\nCinco | Five\nSeis | Six';
  await ctx.DataLoader.loadLocal();assert.equal(r.run('currentCard.en'),'Cinco');
  ctx.DataLoader.loadFile({text:ctx.txt});assert.equal(r.run('currentCard.en'),'Cinco');
  // New runtime restores the same key and values; text edits fall back to number.
  assert.equal(ctx.AddPhrases.add([{en:'Siete',pt:'Seven'}]).adicionadas,1);
  assert.equal(r.run('currentCard.en'),'Cinco');
  const reload=runtime(Object.fromEntries(store));
  reload.run(`sentences=JSON.parse(localStorage.getItem('sentences_v2'));loadSentence(resolveResumeCard());`);
  assert.equal(reload.run('currentCard.en'),'Cinco');assert.equal(reload.ctx.WalkEngine.prefs.repeatEn,5);assert.equal(reload.ctx.WalkEngine.prefs.repeatPt,5);
  reload.run(`sentences[4]={en:'Cinco editado',pt:'Edited five'};loadSentence(resolveResumeCard());`);
  assert.equal(reload.run('currentCard.en'),'Cinco editado');
  // Favorites must use their original database number, including hidden navigation.
  r.run(`favoriteMode=true;favorites=['Dos','Cinco'];loadSentence(sentences[1],{preservePlayback:true});`);
  ctx.document.visibilityState='hidden';ctx.WalkEngine.step(1);await flush();assert.equal(get('pocketPosition').textContent,'Frase 5 de 7');
  // Translation off yields no English utterance and exactly one Spanish when 1x selected.
  ctx.WalkEngine.pause();ctx.WalkEngine.setPref('includePt',false);ctx.WalkEngine.setPref('repeatEn',1);ctx.spoken=[];
  ctx.WalkEngine.resume();await flush();
  assert.equal(ctx.spoken.length,1);assert.equal(ctx.spoken[0].lang,'es');
  ctx.WalkEngine.pause();
  ctx.WalkEngine.setPref('repeatEn',99);ctx.WalkEngine.setPref('repeatPt',-2);
  assert.equal(ctx.WalkEngine.prefs.repeatEn,5);assert.equal(ctx.WalkEngine.prefs.repeatPt,1);
  const invalid=runtime({'walkEngine_v2':JSON.stringify({repeatEn:99,repeatPt:'invalid'})});
  assert.equal(invalid.ctx.WalkEngine.prefs.repeatEn,5);assert.equal(invalid.ctx.WalkEngine.prefs.repeatPt,1);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const id of ['walkRepeatSelect','walkRepeatPtSelect']){
    const select=html.match(new RegExp(`<select id="${id}">([\\s\\S]*?)</select>`))[1];
    assert.deepEqual([...select.matchAll(/value="(\d+)"/g)].map(x=>x[1]),['1','2','3','4','5']);
  }
  console.log('PASS: actual audio queue 5 ES + 5 EN + 1 extra ES; 1x without translation; hidden automatic advance and next/previous/wrap persistence; foreground sync without audio restart; reload and TXT/local refresh resume; positional fallback; absolute pocket counter in favorites; 1–5 selectors and saved/invalid preferences. DOM and media simulated; no real device audio tested.');
})().catch(e=>{console.error(e);process.exit(1);});
