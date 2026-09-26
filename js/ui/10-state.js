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
let stepSeq=0;
const newStepId=()=>'s'+Date.now().toString(36)+(++stepSeq);
const cleanSteps=steps=>steps.map(s=>({id:s.id||newStepId(),opId:s.opId,cfg:W.clone(s.cfg||{}),muted:!!s.muted}));
const curCols=()=>S.view.schema.cols.map(c=>c.name);
const curTypes=()=>S.view.schema.cols.map(c=>c.type);
const colType=name=>{const c=S.view.schema.cols.find(x=>x.name===name);return c?c.type:'text'};
const atEnd=()=>S.viewIdx>=S.steps.length;
const finalN=()=>S.states.length?S.states[S.states.length-1].n:0;

async function applyLoad(r,opts){
  opts=opts||{};
  S.loaded=true;S.file=r.fileName||opts.fileName||'';S.reading=r.reading;S.readings=r.readings;S.baseSchema=r.baseSchema;
  S.warnings=r.warnings||[];S.scan=r.scan;S.hasHtml=r.hasHtml;S.lineCount=r.lineCount;S.size=r.size;
  S.chosenIndex=r.chosenIndex;
  S.meta=r.stepsMeta;S.states=r.states;
  if(!opts.keepSteps){S.steps=[];S.undo=[];S.redo=[];S.sort=[];S.search='';S.vfilter=null;Sel.clear(true);$('#searchInput').value=''}
  S.viewIdx=S.steps.length;
  App.showWorkspace();
  await refreshView();
  ReadingBar.render();Rail.render();Scrub.render();Inspector.refresh(true);Status.render();
  Coach.maybeShow();
  Session.saveData()
}

async function setPipeline(steps,from,opts){
  opts=opts||{};
  const prev={steps:cleanSteps(S.steps),viewIdx:S.viewIdx};
  const next=cleanSteps(steps);
  let r;
  try{r=await Busy.run(opts.label||'Updating steps',()=>Engine.call('setPipeline',{steps:next,fromIndex:Math.max(0,from|0)}))}
  catch(e){Toast.err('Something went wrong: '+e.message);return false}
  S.steps=next;S.meta=r.stepsMeta;S.states=r.states;
  S.viewIdx=Math.max(0,Math.min(opts.viewIdx==null?next.length:opts.viewIdx,next.length));
  if(!opts.noUndo){S.undo.push(prev);if(S.undo.length>100)S.undo.shift();S.redo=[]}
  await refreshView();
  Rail.render();Scrub.render();Inspector.refresh();Status.render();ReadingBar.render();
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
  opts=opts||{};
  if(!S.loaded){Toast.err('Load some data first.');return}
  const steps=cleanSteps(S.steps);
  let idx=S.viewIdx;
  if(opId==='reorderColumns'&&idx===steps.length&&idx>0&&steps[idx-1].opId==='reorderColumns'&&!steps[idx-1].muted){
    steps[idx-1].cfg=cfg;
    const ok=await setPipeline(steps,idx-1,{viewIdx:idx,label:'Moving column'});
    if(ok)Toast.show(opts.msg||'Moved column',{undo:doUndo});
    return ok
  }
  if(opId==='cellOverride'&&idx===steps.length&&idx>0&&steps[idx-1].opId==='cellOverride'&&steps[idx-1].cfg.column===cfg.column&&!steps[idx-1].muted){
    const prev=steps[idx-1].cfg.overrides.filter(o=>!cfg.overrides.some(n=>n.rowId===o.rowId));
    steps[idx-1].cfg={column:cfg.column,overrides:prev.concat(cfg.overrides)};
    const ok=await setPipeline(steps,idx-1,{viewIdx:idx,label:'Editing cells'});
    if(ok)Toast.show(opts.msg||'Edited '+plural(cfg.overrides.length,'cell'),{undo:doUndo});
    return ok
  }
  steps.splice(idx,0,{id:newStepId(),opId,cfg:W.clone(cfg),muted:false});
  const ok=await setPipeline(steps,idx,{viewIdx:idx+1,label:opts.label||W.OPS[opId].label});
  if(!ok)return false;
  const t=stepToast(idx,opts);
  if(t.err)Toast.err(t.msg,{undo:doUndo});else if(!opts.silent)Toast.show(t.msg,{undo:doUndo});
  announce(t.msg);
  $('#statusRows')&&$('#statusRows').classList.add('blink');setTimeout(()=>{const e=$('#statusRows');e&&e.classList.remove('blink')},200);
  return true
}
async function replaceStep(i,cfg){
  const steps=cleanSteps(S.steps);steps[i].cfg=W.clone(cfg);
  const ok=await setPipeline(steps,i,{viewIdx:Math.max(S.viewIdx,i+1)});
  if(ok){const m=S.meta[i];if(m&&m.error)Toast.err('Step '+(i+1)+' could not run: '+m.error,{undo:doUndo});else Toast.show('Updated step '+(i+1),{undo:doUndo})}
}
async function doUndo(){
  if(!S.undo.length){Toast.show('Nothing to undo');return}
  const snap=S.undo.pop();S.redo.push({steps:cleanSteps(S.steps),viewIdx:S.viewIdx});
  await setPipeline(snap.steps,0,{viewIdx:snap.viewIdx,noUndo:true,label:'Undoing'});
  Toast.show('Undone. '+plural(S.steps.length,'step')+' in the recipe.')
}
async function doRedo(){
  if(!S.redo.length){Toast.show('Nothing to redo');return}
  const snap=S.redo.pop();S.undo.push({steps:cleanSteps(S.steps),viewIdx:S.viewIdx});
  await setPipeline(snap.steps,0,{viewIdx:snap.viewIdx,noUndo:true,label:'Redoing'});
  Toast.show('Redone.')
}

let viewReq=0;
async function refreshView(keepScroll){
  if(!S.loaded)return;
  const vf=S.vfilter||{};
  let r;
  try{r=await Engine.call('setView',{stateIdx:S.viewIdx,sort:S.sort,search:S.search,filter:vf.filter||null,rowIds:vf.rowIds||null,rowIdsState:vf.stateIdx},'view')}
  catch(e){if(e.stale)return;Toast.err('Could not show this step: '+e.message);return}
  S.view=r;
  const names=new Set(curCols());
  Sel.pruneCols(names);
  S.sort=S.sort.filter(k=>names.has(k.col));
  Grid.reset(keepScroll);
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
  saveData:debounce(function(){if(Prefs.get('rememberData',false)&&S.sourceText)DataStore.put({text:S.sourceText.text,html:S.sourceText.html,fileName:S.file,steps:cleanSteps(S.steps),reading:S.reading,savedAt:Date.now()})},800)
};

const DataStore={
  db(){return new Promise((res,rej)=>{if(!window.indexedDB)return rej(new Error('Storage unavailable'));const r=indexedDB.open('weft-data',1);r.onupgradeneeded=()=>r.result.createObjectStore('sessions');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  async put(v){try{const size=(v.text||'').length+JSON.stringify(v.html||'').length;if(size>50e6){Toast.show('This data is larger than 50 MB, so it was not stored in the browser.');return}const d=await this.db();d.transaction('sessions','readwrite').objectStore('sessions').put(v,'last')}catch(e){}},
  async get(){try{const d=await this.db();return await new Promise(res=>{const r=d.transaction('sessions').objectStore('sessions').get('last');r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null)})}catch(e){return null}},
  async clear(){try{const d=await this.db();d.transaction('sessions','readwrite').objectStore('sessions').delete('last')}catch(e){}}
};
