(function(G){
'use strict';
const W=G.WeftCore;
const E={
  src:null,base:null,steps:[],states:[],meta:[],refs:{},ctx:{dateOrder:'mdy',yearPivot:69},views:new Map(),viewSeq:0,nextRowId:0
};
W.E=E;
const s=v=>v==null?'':String(v);

function schemaOf(t){return{n:t.n,cols:t.cols.map((c,i)=>({name:c,type:W.typesOf(t,E.ctx)[i]}))}}
function need(){if(!E.base)throw new Error('Load some data first.')}
function stateAt(i){need();if(i==null||i<0||i>=E.states.length)i=E.states.length-1;return E.states[i]}
function engineCtx(){return{dateOrder:E.ctx.dateOrder,yearPivot:E.ctx.yearPivot,refs:E.refs,nextRowId:E.nextRowId}}

function recompute(from){
  const r=W.runPipeline(E.base,E.steps,engineCtx(),from||0,E.states,E.meta);
  E.states=r.states;E.meta=r.meta;E.nextRowId=r.nextRowId
}
function pipelineResult(){
  return{
    stepsMeta:E.steps.map((st,i)=>{
      const m=E.meta[i]||{};const inN=E.states[i]?E.states[i].n:0,outN=E.states[i+1]?E.states[i+1].n:0;
      return{describe:W.describeStep(st),category:W.categoryOf(st),label:W.OPS[st.opId]?W.OPS[st.opId].label:st.opId,portable:W.OPS[st.opId]?W.OPS[st.opId].portable:false,stats:m.stats,chips:m.error?[]:W.statsChips(m.stats,inN,outN),warning:m.warning,error:m.error,muted:!!st.muted,ms:m.ms||0,dsl:W.stepToLine(st)}
    }),
    states:E.states.map(t=>({n:t.n,cols:t.cols.length})),
    finalSchema:schemaOf(E.states[E.states.length-1])
  }
}
function extractHtmlWarnings(ht){return(ht||[]).map(t=>({rows:t.rows,thHeader:!!t.thHeader,warnings:t.warnings||[]}))}

function loadSource(p){
  const text=W.normalizeInput(p.text||'');
  const htmlTables=p.htmlTables&&p.htmlTables.length?extractHtmlWarnings(p.htmlTables):null;
  const det=W.detectReadings(text,{htmlTables});
  if(!det.readings.length)throw new Error('Weft could not read this input.');
  let chosen=0,hintMismatch=null;
  if(p.hint&&p.hint.kind){
    const i=det.readings.findIndex(r=>r.kind===p.hint.kind);
    if(i!==-1&&det.readings[i].confidence>=0.5){
      chosen=i;
      const merged=Object.assign({},det.readings[i].params,p.hint.params||{});
      if(p.hint.kind==='delimited'||p.hint.kind==='html-table'||p.hint.kind==='fixed-width'&&p.hint.params&&p.hint.params.cuts)det.readings[i].params=merged
    }else hintMismatch={expected:(W.READERS[p.hint.kind]||{}).label||p.hint.kind,detected:det.readings[0].label,hint:p.hint}
  }
  E.src={text,htmlTables,fileName:p.fileName||'',readings:det.readings,scan:det.scan,sampleLines:det.sampleLines,lineCount:det.lineCount,size:text.length};
  return{chosen,hintMismatch}
}
function useReading(reading){
  const t=W.applyReading(E.src.text,reading,{htmlTables:E.src.htmlTables});
  E.src.reading={kind:reading.kind,label:reading.label||(W.READERS[reading.kind]||{}).label,params:Object.assign({},reading.params)};
  delete E.src.reading.params.junk;
  E.base=t;E.nextRowId=t.n;E.states=[];E.meta=[];
  recompute(0);
  return t.warnings||[]
}
function readingOut(r){return{kind:r.kind,label:r.label,confidence:r.confidence,strength:r.strength,params:r.params,explain:r.explain,preview:r.preview}}

function loadResult(extra){
  const b=E.base;
  return Object.assign({
    fileName:E.src.fileName,
    readings:E.src.readings.map(readingOut),
    reading:E.src.reading,
    baseSchema:schemaOf(b),
    warnings:(b.warnings||[]),
    scan:E.src.scan,
    sampleLines:E.src.sampleLines,
    lineCount:E.src.lineCount,
    size:E.src.size,
    hasHtml:!!E.src.htmlTables
  },pipelineResult(),extra||{})
}

function searchIndex(t){
  if(!t._search){
    const n=t.n,w=t.cols.length,idx=new Array(n);
    for(let r=0;r<n;r++){let x='';for(let c=0;c<w;c++){const v=t.data[c][r];if(v!=null&&v!=='')x+=String(v).toLowerCase()+'\u0001'}idx[r]=x}
    t._search=idx
  }
  return t._search
}
function makeView(p){
  const si=p.stateIdx==null||p.stateIdx<0?E.states.length-1:Math.min(p.stateIdx,E.states.length-1);
  const t=E.states[si];
  let pos=null;
  const q=s(p.search).trim().toLowerCase();
  if(q){
    const terms=q.split(/\s+/).filter(Boolean);pos=[];
    const w=t.cols.length,cols=t.data;
    if(t._search){const idx=t._search;for(let r=0;r<t.n;r++){const x=idx[r];let ok=true;for(const tm of terms)if(x.indexOf(tm)===-1){ok=false;break}if(ok)pos.push(r)}}
    else{
      const res=terms.map(tm=>new RegExp(tm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
      const nt=res.length;
      for(let r=0;r<t.n;r++){
        let all=true;
        for(let k=0;k<nt;k++){
          const re=res[k];let hit=false;
          for(let c=0;c<w;c++){const v=cols[c][r];if(v&&re.test(v)){hit=true;break}}
          if(!hit){all=false;break}
        }
        if(all)pos.push(r)
      }
    }
  }
  if(p.filter&&p.filter.conditions&&p.filter.conditions.length){
    const valid=p.filter.conditions.filter(c=>c.col==='*'||t.cols.indexOf(c.col)!==-1);
    if(valid.length){
      const test=W.rowTester(t,{match:p.filter.match||'all',conditions:valid.map(c=>Object.assign({caseSensitive:false},c))},E.ctx);
      const base=pos||W.identity(t.n);pos=base.filter(r=>test(r))
    }
  }
  if(p.rowIds&&p.rowIds.length){
    const pm=W.posMap(t);const set=new Set();for(const id of p.rowIds){const x=pm.get(id);if(x!==undefined)set.add(x)}
    const base=pos||W.identity(t.n);pos=base.filter(r=>set.has(r))
  }
  if(!pos)pos=W.identity(t.n);
  if(p.sort&&p.sort.length){
    const types=W.typesOf(t,E.ctx);
    const sets=p.sort.filter(k=>t.cols.indexOf(k.col)!==-1).map(k=>{const ci=t.cols.indexOf(k.col);const type=k.type&&k.type!=='auto'?k.type:types[ci];return{keys:W.sortKeysFor(t.data[ci],type,E.ctx),type,dir:k.dir==='desc'?-1:1}});
    if(sets.length)pos=W.sortPositions(pos,sets)
  }
  const key='v'+(++E.viewSeq);
  E.views.set(key,{si,pos,t});
  if(E.views.size>8){const first=E.views.keys().next().value;E.views.delete(first)}
  return{viewKey:key,key,n:pos.length,stateIdx:si,total:t.n,schema:schemaOf(t)}
}
function getView(k){const v=E.views.get(k);if(!v)throw new Error('The view is out of date. Refresh.');return v}
function selectedPositions(v,sel){
  const t=v.t;
  if(!sel||!sel.rows)return[];
  if(sel.rows.all){const ex=new Set(sel.rows.except||[]);return v.pos.filter(r=>!ex.has(t.rowIds[r]))}
  const ids=new Set(sel.rows.ids||[]);return v.pos.filter(r=>ids.has(t.rowIds[r]))
}
function exportRows(p){
  let t,pos;
  if(p.scope==='view'||p.scope==='selected'){const v=getView(p.viewKey);t=v.t;pos=p.scope==='selected'?selectedPositions(v,p.selection):v.pos}
  else{t=E.states[E.states.length-1];pos=W.identity(t.n)}
  let ci=t.cols.map((_,i)=>i);
  if(p.columns&&p.columns.length)ci=p.columns.map(c=>t.cols.indexOf(c)).filter(i=>i!==-1);
  return{t,pos,ci}
}
function buildExport(p){
  const{t,pos,ci}=exportRows(p);const o=p.options||{};
  const cols=ci.map(i=>t.cols[i]);
  const fmt=p.format||'csv';
  const eol=o.excel?'\r\n':'\n';
  const header=o.header!==false;
  const chunks=[];let buf='';
  const push=x=>{buf+=x;if(buf.length>1000000){chunks.push(buf);buf=''}};
  const row=r=>ci.map(c=>s(t.data[c][r]));
  if(fmt==='csv'||fmt==='tsv'){
    const d=fmt==='csv'?',':'\t';
    if(o.excel)push('\uFEFF');
    if(header)push(W.toDelimited(cols,[],d,{formulaGuard:o.formulaGuard})+eol);
    for(let i=0;i<pos.length;i++)push(W.toDelimited(null,[row(pos[i])],d,{formulaGuard:o.formulaGuard})+eol)
  }else if(fmt==='json'){
    push('[');for(let i=0;i<pos.length;i++){const r=row(pos[i]);const obj={};cols.forEach((c,k)=>{obj[c]=r[k]});push((i?',\n':'\n')+'  '+JSON.stringify(obj))}push('\n]\n')
  }else if(fmt==='jsoncols'){
    const obj={};cols.forEach((c,k)=>{obj[c]=pos.map(r=>s(t.data[ci[k]][r]))});push(JSON.stringify(obj,null,1))
  }else if(fmt==='ndjson'){
    for(let i=0;i<pos.length;i++){const r=row(pos[i]);const obj={};cols.forEach((c,k)=>{obj[c]=r[k]});push(JSON.stringify(obj)+'\n')}
  }else if(fmt==='md'){
    const e=v=>s(v).replace(/\|/g,'\\|').replace(/\n/g,' ');
    push('| '+cols.map(e).join(' | ')+' |\n|'+cols.map(()=>' --- ').join('|')+'|\n');
    for(let i=0;i<pos.length;i++)push('| '+row(pos[i]).map(e).join(' | ')+' |\n')
  }else if(fmt==='lines'){
    if(header&&cols.length>1)push(cols.join(' ')+eol);
    for(let i=0;i<pos.length;i++)push(row(pos[i]).join(cols.length>1?' ':'')+eol)
  }else if(fmt==='xlsx'){
    const types=W.typesOf(t,E.ctx);
    const loc=ci.map(c=>{const sm=[];for(let r=0;r<t.n&&sm.length<300;r++){const v=t.data[c][r];if(v)sm.push(v)}return W.detectNumberLocale(sm)});
    const rows=new Array(pos.length);for(let i=0;i<pos.length;i++)rows[i]=row(pos[i]);
    push(JSON.stringify({cols,rows,types:ci.map(c=>types[c]),locales:loc}))
  }else throw new Error('Unknown format "'+fmt+'".');
  chunks.push(buf);
  const text=chunks.join('');
  return{text,rows:pos.length,cols:cols.length,bytes:text.length}
}

const H={
  ping:()=>({version:W.version}),
  setCtx(p){Object.assign(E.ctx,p||{});E.states.forEach(t=>{t._types=null});if(E.base){recompute(0);return pipelineResult()}return{}},
  sample(p){const r=W.makeSample(p.kind);return r},
  stageStress(p){const s=W.makeStress(p.n||200000);E.staged=s;return{bytes:s.text.length,fileName:s.fileName}},
  loadStaged(){if(!E.staged)throw new Error('Nothing is staged.');const s=E.staged;E.staged=null;return H.load({text:s.text,fileName:s.fileName})},
  loadSample(p){const r=W.makeSample(p.kind);return H.load({text:r.text,fileName:r.fileName,hint:p.hint})},
  removedIds(p){need();const i=p.stateIdx;if(i<1||i>=E.states.length)return{rowIds:[]};const a=E.states[i-1],b=E.states[i];const pm=W.posMap(b);const out=[];for(let r=0;r<a.n;r++)if(!pm.has(a.rowIds[r]))out.push(a.rowIds[r]);return{rowIds:out}},
  schema(p){const t=stateAt(p.stateIdx);return schemaOf(t)},
  load(p){
    E.steps=[];E.states=[];E.meta=[];E.views.clear();
    const L=loadSource(p);
    const r=E.src.readings[L.chosen];
    const warns=useReading(r);
    return loadResult({chosenIndex:L.chosen,hintMismatch:L.hintMismatch})
  },
  chooseReading(p){
    if(!E.src)throw new Error('Load some data first.');
    let r;
    if(p.reading){r={kind:p.reading.kind,params:Object.assign({},p.reading.params||{}),label:(W.READERS[p.reading.kind]||{}).label}}
    else r=E.src.readings[p.index];
    if(!r)throw new Error('That reading is not available.');
    if(W.READERS[r.kind]&&W.READERS[r.kind].labelFor)r.label=W.READERS[r.kind].labelFor(r.params);
    useReading(r);
    return loadResult({chosenIndex:p.index!=null?p.index:-1})
  },
  previewReading(p){
    if(!E.src)throw new Error('Load some data first.');
    const r={kind:p.reading.kind,params:Object.assign({},p.reading.params||{})};
    const text=r.kind==='html-table'||r.kind==='json'?E.src.text:E.src.text.split('\n').slice(0,4000).join('\n');
    const t=W.applyReading(text,r,{htmlTables:E.src.htmlTables});
    return{cols:t.cols,rows:W.tableRows(t,50),n:t.n,warnings:t.warnings}
  },
  rawLines(p){if(!E.src)return{lines:[]};const n=p&&p.count||40;return{lines:E.src.text.split('\n').slice(p&&p.start||0,(p&&p.start||0)+n)}},
  setPipeline(p){
    need();
    const next=W.clone(p.steps||[]);
    const key=s=>s.opId+'|'+(s.muted?1:0)+'|'+JSON.stringify(s.cfg||{});
    let k=0;
    while(k<next.length&&k<E.steps.length&&k<E.meta.length&&k+1<E.states.length&&key(next[k])===key(E.steps[k]))k++;
    const from=p.force?Math.max(0,p.fromIndex|0):k;
    E.steps=next;recompute(from);
    return pipelineResult()
  },
  setView:p=>{need();return makeView(p)},
  getRows(p){
    const v=getView(p.viewKey);const t=v.t;const w=t.cols.length;
    const start=Math.max(0,p.start|0),end=Math.min(v.pos.length,start+Math.min(512,p.count|0||256));
    const rows=[],rowIds=[],ch=[];
    const touched=v.si>0&&E.meta[v.si-1]&&!E.meta[v.si-1].muted?E.meta[v.si-1].touched:null;
    const tcols=touched?t.cols.map((c,i)=>touched[c]?i:-1).filter(i=>i!==-1):[];
    for(let i=start;i<end;i++){
      const r=v.pos[i];const row=new Array(w);
      for(let c=0;c<w;c++){let x=s(t.data[c][r]);if(x.length>1000)x=x.slice(0,1000)+'…';row[c]=x}
      rows.push(row);const id=t.rowIds[r];rowIds.push(id);
      if(tcols.length){const cc=[];for(const c of tcols){const tv=touched[t.cols[c]];if(tv===true||tv.has(id))cc.push(c)}ch.push(cc)}
    }
    return{start,rows,rowIds,changed:tcols.length?ch:null}
  },
  getCell(p){const t=stateAt(p.stateIdx);const r=W.posMap(t).get(p.rowId);const ci=t.cols.indexOf(p.col);if(r===undefined||ci===-1)return{value:null};return{value:s(t.data[ci][r])}},
  rowIdsForRange(p){const v=getView(p.viewKey);const a=Math.max(0,Math.min(p.a,p.b)),b=Math.min(v.pos.length-1,Math.max(p.a,p.b));const out=[];for(let i=a;i<=b;i++)out.push(v.t.rowIds[v.pos[i]]);return{rowIds:out}},
  rowIdsForView(p){const v=getView(p.viewKey);return{rowIds:v.pos.map(r=>v.t.rowIds[r])}},
  positionOfRow(p){const v=getView(p.viewKey);const pm=W.posMap(v.t);const r=pm.get(p.rowId);return{pos:r===undefined?-1:v.pos.indexOf(r)}},
  preview(p){
    need();
    const si=p.stateIdx==null?E.states.length-1:p.stateIdx;const t=E.states[si];
    const d=W.OPS[p.step.opId];if(!d)throw new Error('Unknown step.');
    const err=d.validate?d.validate(p.step.cfg,schemaOf(t)):null;
    if(err)return{error:err};
    let res;try{res=d.apply(t,p.step.cfg,engineCtx())}catch(e){return{error:e.message}}
    const o=res.table;const pm=W.posMap(o);
    const removed=[];for(let r=0;r<t.n&&removed.length<5;r++)if(!pm.has(t.rowIds[r]))removed.push(W.tableRows({cols:t.cols,data:t.data.map(c=>[c[r]]),n:1})[0]);
    let keptIdx=[];
    if(res.touched&&res.touched.size){const set=new Set();res.touched.forEach(v=>{if(v===true){for(let r=0;r<Math.min(o.n,5);r++)set.add(r)}else v.forEach(x=>set.add(x))});keptIdx=Array.from(set).sort((a,b)=>a-b).slice(0,6)}
    else keptIdx=W.identity(Math.min(o.n,5));
    const after=keptIdx.map(r=>o.cols.map((_,c)=>s(o.data[c][r]).slice(0,200)));
    const before=keptIdx.map(r=>{const bp=W.posMap(t).get(o.rowIds[r]);return bp===undefined?null:t.cols.map((_,c)=>s(t.data[c][bp]).slice(0,200))});
    return{stats:res.stats||{},chips:W.statsChips(res.stats,t.n,o.n),warning:res.warning||null,n0:t.n,n1:o.n,cols0:t.cols,cols1:o.cols,removedSample:removed,after,before,touchedCols:res.touched?Array.from(res.touched.keys()):[],describe:d.describe(p.step.cfg)}
  },
  profile(p){const t=stateAt(p.stateIdx);return W.profile(t,p.col,E.ctx)},
  issues(p){const t=stateAt(p.stateIdx);return{issues:W.issues(t,E.ctx)}},
  lineage(p){need();return{items:W.lineage(E.states,E.steps,p.rowId,p.col,p.uptoIdx==null?E.states.length-1:p.uptoIdx)}},
  likeThese(p){const t=stateAt(p.stateIdx);return{candidates:W.likeThese(t,p.rowIds||[],E.ctx)}},
  selectionStats(p){
    const v=getView(p.viewKey);const t=v.t;const sel=p.selection||{};
    let cells=[];
    const types=W.typesOf(t,E.ctx);
    if(sel.kind==='cols'&&sel.cols&&sel.cols.length){
      const cis=sel.cols.map(c=>t.cols.indexOf(c)).filter(i=>i!==-1&&types[i]==='number');
      for(const ci of cis)for(const r of v.pos)cells.push(t.data[ci][r]);
      return stats(cells,v.pos.length*sel.cols.length)
    }
    if(sel.kind==='cells'&&sel.rect){
      const a=Math.max(0,sel.rect.r0),b=Math.min(v.pos.length-1,sel.rect.r1);
      const cis=[];for(let c=sel.rect.c0;c<=sel.rect.c1;c++)if(c>=0&&c<t.cols.length)cis.push(c);
      for(let i=a;i<=b;i++)for(const c of cis)cells.push(t.data[c][v.pos[i]]);
      return stats(cells,cells.length)
    }
    if(sel.kind==='rows'){const ps=selectedPositions(v,sel);return{count:ps.length,numericCount:0}}
    return{count:0,numericCount:0}
  },
  export:p=>{need();return buildExport(p)},
  synthesize(p){
    const t=stateAt(p.stateIdx);const ci=t.cols.indexOf(p.col);if(ci===-1)return{candidates:[]};
    const col=t.data[ci];const sample=[];for(let r=0;r<t.n&&sample.length<2000;r++)sample.push(s(col[r]));
    const ex=(p.examples||[]).concat([{before:p.before,after:p.after}]);
    const ranked=W.synthesize(ex,sample).slice(0,6);
    let total=0;
    const out=ranked.map(x=>{let changed=0;for(let r=0;r<t.n;r++){const v=s(col[r]);if(!v)continue;let o;try{o=W.applyCandidate(x.c,v)}catch(e){o=null}if(o!=null&&o!==v)changed++}return{candidate:x.c,label:x.label,changed,broken:x.broken}});
    return{candidates:out}
  },
  refLoad(p){
    const text=W.normalizeInput(p.text||'');
    const det=W.detectReadings(text,{htmlTables:p.htmlTables});
    const t=W.applyReading(text,det.readings[0],{htmlTables:p.htmlTables});
    let name=p.name||'reference';let k=2;const base=name;while(E.refs[name]&&!p.replace){name=base+' ('+k+')';k++}
    E.refs[name]=t;
    if(E.base){const i=E.steps.findIndex(s=>(s.opId==='join'||s.opId==='diff')&&s.cfg&&s.cfg.refName===name);if(i!==-1)recompute(i)}
    return{name,cols:t.cols,n:t.n,reading:det.readings[0].label}
  },
  refList:()=>({refs:Object.keys(E.refs).map(k=>({name:k,cols:E.refs[k].cols,n:E.refs[k].n}))}),
  refRemove(p){delete E.refs[p.name];return{}},
  contract(p){const t=stateAt(p.stateIdx);return{contract:W.shapeContract(t)}},
  drift(p){const t=stateAt(p.stateIdx);return{drift:W.diffContracts(p.contract,W.shapeContract(t))}},
  parseRecipe(p){return W.textToSteps(p.text)},
  recipeText(p){return{text:W.stepsToText(p.steps||E.steps,p.source===undefined?(E.src&&E.src.reading?{kind:E.src.reading.kind,params:E.src.reading.params}:null):p.source)}},
  columnValues(p){
    const t=stateAt(p.stateIdx);const ci=t.cols.indexOf(p.col);if(ci===-1)return{rowIds:[]};
    const out=[];const v=s(p.value).trim();for(let r=0;r<t.n;r++)if(s(t.data[ci][r]).trim()===v)out.push(t.rowIds[r]);return{rowIds:out}
  },
  stats(){return{states:E.states.length,rows:E.base?E.base.n:0}}
};
function stats(cells,count){
  let n=0,sum=0,mn=Infinity,mx=-Infinity;
  const loc=W.detectNumberLocale(cells.slice(0,300));
  for(const c of cells){const p=W.parseNumber(c,{locale:loc});if(p){n++;sum+=p.value;if(p.value<mn)mn=p.value;if(p.value>mx)mx=p.value}}
  return{count,numericCount:n,sum:n?sum:null,avg:n?sum/n:null,min:n?mn:null,max:n?mx:null}
}
W.Engine={handle(type,payload){const f=H[type];if(!f)throw new Error('Unknown request type "'+type+'".');return f(payload||{})},H};
W.hostWorker=function(scope){
  scope.onmessage=function(e){
    const m=e.data||{};
    let res;
    try{res={id:m.id,ok:true,result:W.Engine.handle(m.type,m.payload)}}
    catch(err){res={id:m.id,ok:false,error:{message:(err&&err.message)||String(err),code:(err&&err.code)||'error'}}}
    try{scope.postMessage(res)}catch(err){scope.postMessage({id:m.id,ok:false,error:{message:'Could not send the result: '+err.message}})}
  }
};
})(typeof self!=='undefined'?self:globalThis);
