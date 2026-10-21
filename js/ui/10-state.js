'use strict';
const S={
  loaded:false,file:'',reading:null,readings:[],baseSchema:null,warnings:[],scan:null,hasHtml:false,lineCount:0,size:0,
  steps:[],meta:[],states:[],viewIdx:0,
  view:{key:null,n:0,total:0,stateIdx:0,schema:{n:0,cols:[]}},
  search:'',vfilter:null,sort:[],
  undo:[],redo:[],refs:[],
  showWs:!!Prefs.get('showWs',false),dateOrder:Prefs.get('dateOrder','mdy'),
  recent:lsGet('weft.recentCommands',[]),lastCmds:[],
  pendingRecipe:null,sessionDirty:false,sourceText:null
};
const TAB_FIELDS=['file','reading','readings','baseSchema','warnings','scan','hasHtml','lineCount','size','chosenIndex','steps','meta','states','viewIdx','view','search','vfilter','sort','undo','redo','sourceText','htmlTables','htmlCount','contract'];
function defaultTabState(){
  return{loaded:false,file:'',reading:null,readings:[],baseSchema:null,warnings:[],scan:null,hasHtml:false,lineCount:0,size:0,chosenIndex:0,
    steps:[],meta:[],states:[],viewIdx:0,view:{key:null,n:0,total:0,stateIdx:0,schema:{n:0,cols:[]}},
    search:'',vfilter:null,sort:[],undo:[],redo:[],sourceText:null,htmlTables:null,htmlCount:0,contract:null,
    pendingRecipe:null,refs:[],refsRaw:[]}
}
let stepSeq=0;
const newStepId=()=>'s'+Date.now().toString(36)+(++stepSeq);
const cleanSteps=steps=>steps.map(s=>({id:s.id||newStepId(),opId:s.opId,cfg:W.clone(s.cfg||{}),muted:!!s.muted}));
const curCols=()=>S.view.schema.cols.map(c=>c.name);
const curTypes=()=>S.view.schema.cols.map(c=>c.type);
const colType=name=>{const c=S.view.schema.cols.find(x=>x.name===name);return c?c.type:'text'};
const atEnd=()=>S.viewIdx>=S.steps.length;
const finalN=()=>S.states.length?S.states[S.states.length-1].n:0;

function loadState(r,opts){
  opts=opts||{};
  const o={loaded:true,file:r.fileName||opts.fileName||'',reading:r.reading,readings:r.readings,baseSchema:r.baseSchema,warnings:r.warnings||[],scan:r.scan,hasHtml:r.hasHtml,lineCount:r.lineCount,size:r.size,chosenIndex:r.chosenIndex,meta:r.stepsMeta,states:r.states};
  if(!opts.keepSteps){o.steps=[];o.undo=[];o.redo=[];o.sort=[];o.search='';o.vfilter=null}
  o.viewIdx=(opts.keepSteps?S.steps:o.steps).length;
  return o
}

async function applyLoad(r,opts){
  opts=opts||{};
  Object.assign(S,loadState(r,opts));
  if(!opts.keepSteps){Sel.clear(true);$('#searchInput').value=''}
  const wasHidden=$('#workspace').classList.contains('hidden');
  App.showWorkspace();
  if(wasHidden)await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
  await refreshView();
  await yieldUI();
  ReadingBar.render();Rail.render();Scrub.render();
  await yieldUI();
  Inspector.refresh(true);Status.render();
  Coach.maybeShow();
  Session.saveData()
}

async function withFreshView(fn){try{return await fn()}catch(e){if(e&&/out of date/.test(e.message)){await refreshView(true);return await fn()}throw e}}
let pipeTail=Promise.resolve();
function runExclusive(fn){const p=pipeTail.then(fn,fn);pipeTail=p.catch(()=>{});return p}
function setPipeline(steps,from,opts){if(Tabs.switching){Toast.show('Wait for the table to finish switching.');return Promise.resolve(false)}return runExclusive(()=>setPipelineNow(steps,from,opts))}
async function setPipelineNow(steps,from,opts){
  opts=opts||{};
  const prev={steps:cleanSteps(S.steps),viewIdx:S.viewIdx};
  const next=cleanSteps(steps);
  let r;
  try{r=await Busy.run(opts.label||'Updating steps',()=>Engine.call('setPipeline',{steps:next,fromIndex:Math.max(0,from|0)}))}
  catch(e){if(!isQuiet(e))Toast.err('Something went wrong: '+e.message);return false}
  S.steps=next;S.meta=r.stepsMeta;S.states=r.states;
  S.viewIdx=Math.max(0,Math.min(opts.viewIdx==null?next.length:opts.viewIdx,next.length));
  if(!opts.noUndo){S.undo.push(prev);if(S.undo.length>100)S.undo.shift();S.redo=[]}
  await refreshView();
  await yieldUI();
  Rail.render();Scrub.render();
  await yieldUI();
  Status.render();Inspector.refresh();
  Session.save();
  return true
}

function stepToast(i,opts){
  const m=S.meta[i]||{};const st=S.steps[i];
  if(m.error)return{msg:'This step could not run: '+m.error,err:true};
  let msg;
  if(opts&&opts.msg)msg=typeof opts.msg==='function'?opts.msg(m):opts.msg;
  else{
    const chips=(m.chips||[]).filter(c=>c.kind!=='none').map(c=>c.text);
    msg=(m.describe||W.describeStep(st))+(chips.length?' · '+chips.join(', '):' · No rows or cells changed')
  }
  if(i<S.steps.length-1)msg+=' · Added as step '+(i+1)+' of '+S.steps.length+'. Later steps were re-run.';
  return{msg,err:false}
}

async function addStep(opId,cfg,opts){
  if(Tabs.switching){Toast.show('Wait for the table to finish switching.');return false}
  return runExclusive(async()=>{
    opts=opts||{};
    if(!S.loaded){Toast.err('Load some data first.');return}
    const steps=cleanSteps(S.steps);
    let idx=S.viewIdx;
    if(opId==='reorderColumns'&&idx===steps.length&&idx>0&&steps[idx-1].opId==='reorderColumns'&&!steps[idx-1].muted){
      steps[idx-1].cfg=cfg;
      const ok=await setPipelineNow(steps,idx-1,{viewIdx:idx,label:'Moving column'});
      if(ok)Toast.show(opts.msg||'Moved column',{undo:doUndo});
      return ok
    }
    if(opId==='cellOverride'&&idx===steps.length&&idx>0&&steps[idx-1].opId==='cellOverride'&&steps[idx-1].cfg.column===cfg.column&&!steps[idx-1].muted){
      const prev=steps[idx-1].cfg.overrides.filter(o=>!cfg.overrides.some(n=>n.rowId===o.rowId));
      steps[idx-1].cfg={column:cfg.column,overrides:prev.concat(cfg.overrides)};
      const ok=await setPipelineNow(steps,idx-1,{viewIdx:idx,label:'Editing cells'});
      if(ok)Toast.show(opts.msg||'Edited '+plural(cfg.overrides.length,'cell'),{undo:doUndo});
      return ok
    }
    steps.splice(idx,0,{id:newStepId(),opId,cfg:W.clone(cfg),muted:false});
    const ok=await setPipelineNow(steps,idx,{viewIdx:idx+1,label:opts.label||W.OPS[opId].label});
    if(!ok)return false;
    const t=stepToast(idx,opts);
    if(t.err)Toast.err(t.msg,{undo:doUndo});else if(!opts.silent)Toast.show(t.msg,{undo:doUndo});
    announce(t.msg);
    $('#statusRows')&&$('#statusRows').classList.add('blink');setTimeout(()=>{const e=$('#statusRows');e&&e.classList.remove('blink')},200);
    return true
  })
}
async function replaceStep(i,cfg){
  if(Tabs.switching){Toast.show('Wait for the table to finish switching.');return false}
  return runExclusive(async()=>{
    const steps=cleanSteps(S.steps);steps[i].cfg=W.clone(cfg);
    const ok=await setPipelineNow(steps,i,{viewIdx:Math.max(S.viewIdx,i+1)});
    if(ok){const m=S.meta[i];if(m&&m.error)Toast.err('Step '+(i+1)+' could not run: '+m.error,{undo:doUndo});else Toast.show('Updated step '+(i+1),{undo:doUndo})}
  })
}
async function doUndo(){
  if(Tabs.switching){Toast.show('Wait for the table to finish switching.');return false}
  return runExclusive(async()=>{
    if(!S.undo.length){Toast.show('Nothing to undo');return false}
    const snap=S.undo[S.undo.length-1];const cur={steps:cleanSteps(S.steps),viewIdx:S.viewIdx};
    const ok=await setPipelineNow(snap.steps,0,{viewIdx:snap.viewIdx,noUndo:true,label:'Undoing'});
    if(!ok)return false;
    S.undo.pop();S.redo.push(cur);
    Toast.show('Undone. '+plural(S.steps.length,'step')+' in the recipe.');
    return true
  })
}
async function doRedo(){
  if(Tabs.switching){Toast.show('Wait for the table to finish switching.');return false}
  return runExclusive(async()=>{
    if(!S.redo.length){Toast.show('Nothing to redo');return false}
    const snap=S.redo[S.redo.length-1];const cur={steps:cleanSteps(S.steps),viewIdx:S.viewIdx};
    const ok=await setPipelineNow(snap.steps,0,{viewIdx:snap.viewIdx,noUndo:true,label:'Redoing'});
    if(!ok)return false;
    S.redo.pop();S.undo.push(cur);
    Toast.show('Redone.');
    return true
  })
}

let viewReq=0;
async function refreshView(keepScroll){
  if(!S.loaded)return;
  const vf=S.vfilter||{};
  let r;
  try{r=await Engine.call('setView',{stateIdx:S.viewIdx,sort:S.sort,search:S.search,filter:vf.filter||null,rowIds:vf.rowIds||null,rowIdsState:vf.stateIdx},'view')}
  catch(e){if(isQuiet(e))return;Toast.err('Could not show this step: '+e.message);return}
  S.view=r;
  const names=new Set(curCols());
  Sel.pruneCols(names);
  S.sort=S.sort.filter(k=>names.has(k.col));
  Grid.reset(keepScroll);
  await yieldUI();
  Status.render();
  $('#btnSearchStep').classList.toggle('hidden',!S.search.trim());
  VFilter.render()
}
async function setViewIdx(i){
  i=Math.max(0,Math.min(i,S.steps.length));
  if(i===S.viewIdx)return;
  S.viewIdx=i;
  if(S.vfilter&&S.vfilter.stateIdx!=null&&S.vfilter.stateIdx!==i)S.vfilter=null;
  await refreshView(true);
  await yieldUI();
  Rail.render();Scrub.render();Inspector.refresh();Status.render()
}

const VFilter={
  set(label,spec){S.vfilter=Object.assign({label},spec);refreshView()},
  clear(){if(!S.vfilter)return;S.vfilter=null;refreshView()},
  render(){
    const el=$('#vfilter');
    if(!S.vfilter){el.classList.add('hidden');return}
    el.classList.remove('hidden');
    clear(el).append(icon('filter',14),h('span',{text:'Showing '+plural(S.view.n,'row')+': '+S.vfilter.label}),
      S.vfilter.filter?h('button',{class:'btn btn-xs btn-secondary',type:'button',onclick:()=>openFilterBuilder({mode:'remove',match:S.vfilter.filter.match||'all',conditions:W.clone(S.vfilter.filter.conditions).map(c=>Object.assign({caseSensitive:false,value:''},c))})},'Make this a step'):null,
      h('button',{class:'btn btn-xs btn-ghost',type:'button',onclick:()=>VFilter.clear()},'Show all rows'))
  }
};

const Session={
  save(){
    if(!S.loaded)return;
    const ok=lsSet('weft.session.v1',{steps:cleanSteps(S.steps),source:S.reading?{kind:S.reading.kind,params:S.reading.params}:null,fileName:S.file,savedAt:Date.now()});
    S.sessionDirty=!ok;
    this.saveData()
  },
  get(){const s=lsGet('weft.session.v1',null);return s&&s.steps&&s.steps.length?s:null},
  discard(){try{localStorage.removeItem('weft.session.v1')}catch(e){}},
  saveData:debounce(function(){
    if(!Prefs.get('rememberData',false))return;
    if(typeof Tabs!=='undefined'&&Tabs.list.length>1){
      Tabs.stash(true);
      const keep=Tabs.list.filter(t=>t.payload&&!t.payload.__stress);
      if(keep.length)DataStore.put({v:2,refs:S.refsRaw||[],active:Tabs.active,activeIdx:Math.max(0,keep.findIndex(t=>t.id===Tabs.active)),savedAt:Date.now(),tabs:keep.map(t=>({name:t.name,origin:t.origin,payload:t.payload,steps:cleanSteps(t.id===Tabs.active?S.steps:(t.ui&&t.ui.steps)||[]),reading:t.id===Tabs.active?S.reading:t.ui&&t.ui.reading}))});
      return
    }
    if(S.sourceText)DataStore.put({refs:S.refsRaw||[],text:S.sourceText.text,html:S.sourceText.html,fileName:S.file,steps:cleanSteps(S.steps),reading:S.reading,savedAt:Date.now()})
  },800)
};

const DataStore={
  db(){return this._db||(this._db=new Promise((res,rej)=>{if(!window.indexedDB){this._db=null;return rej(new Error('Storage unavailable'))}const r=indexedDB.open('weft-data',1);r.onupgradeneeded=()=>r.result.createObjectStore('sessions');r.onsuccess=()=>res(r.result);r.onerror=()=>{this._db=null;rej(r.error)}}))},
  async put(v){try{const size=(v.refs||[]).reduce((a,r)=>a+((r&&r.text)||'').length,0)+(v.v===2?v.tabs.reduce((a,t)=>a+((t.payload&&t.payload.text)||'').length+JSON.stringify((t.payload&&t.payload.htmlTables)||'').length,0):(v.text||'').length+JSON.stringify(v.html||'').length);if(size>50e6){Toast.show('This data is larger than 50 MB, so it was not stored in the browser.');return}const d=await this.db();await new Promise((res,rej)=>{const tx=d.transaction('sessions','readwrite');tx.objectStore('sessions').put(v,'last');tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)})}catch(e){if(!this._warned){this._warned=true;Toast.err('Could not remember your data in this browser: '+((e&&e.message)||'unknown error'))}}},
  async get(){try{const d=await this.db();return await new Promise(res=>{const r=d.transaction('sessions').objectStore('sessions').get('last');r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null)})}catch(e){return null}},
  async clear(){try{const d=await this.db();await new Promise((res,rej)=>{const tx=d.transaction('sessions','readwrite');tx.objectStore('sessions').delete('last');tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)})}catch(e){}}
};
