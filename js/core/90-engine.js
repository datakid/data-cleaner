(function(G){
'use strict';
const W=G.WeftCore;
const CTX={dateOrder:'mdy',yearPivot:69};
const REFS={};
function newSession(){return{src:null,base:null,steps:[],states:[],meta:[],refs:REFS,ctx:CTX,views:new Map(),nextRowId:0,staged:null,dirty:false}}
const T={map:new Map(),active:'t1',viewSeq:0};
let E=newSession();
T.map.set('t1',E);
W.E=E;W.T=T;
function settle(x){x.dirty=false;if(x.base)recompute(0)}
function useSession(id){const x=T.map.get(id);if(!x)throw new Error('That table is no longer open.');E=x;W.E=x;T.active=id;if(x.dirty)settle(x)}
function withSession(x,fn){const prev=E,pid=T.active;E=x;W.E=x;try{if(x.dirty)settle(x);return fn()}finally{E=prev;W.E=prev;T.active=pid}}
const s=v=>v==null?'':String(v);

function fillOf(t){
  if(!t._fill){
    t._fill=t.data.map(col=>{if(!t.n)return 1;let k=0;for(let r=0;r<t.n;r++){const v=col[r];if(v!=null&&v!==''&&(typeof v!=='string'||v.charCodeAt(0)>32||v.trim()!==''))k++}return k/t.n})
  }
  return t._fill
}
function schemaOf(t){const types=W.typesOf(t,E.ctx),fill=fillOf(t);return{n:t.n,cols:t.cols.map((c,i)=>({name:c,type:types[i],fill:fill[i]}))}}
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

function forcedReading(hint,text){
  const R=W.READERS[hint.kind];
  const r={kind:hint.kind,params:Object.assign({},hint.params),confidence:1,strength:'Strong match',explain:'Read as exported by Weft.',label:(R.labelFor?R.labelFor(hint.params):R.label),preview:{cols:[],rows:[],total:0}};
  try{const t=W.applyReading(text.split('\n',201).join('\n'),r,{htmlTables:null});r.preview={cols:t.cols.slice(),rows:W.tableRows(t).slice(0,50),total:t.n}}catch(e){}
  return r
}
function loadSource(p){
  const text=W.normalizeInput(p.text||'');
  const htmlTables=p.htmlTables&&p.htmlTables.length?extractHtmlWarnings(p.htmlTables):null;
  const det=W.detectReadings(text,{htmlTables});
  if(!det.readings.length)throw new Error('Weft could not read this input.');
  let chosen=0,hintMismatch=null;
  if(p.hint&&p.hint.kind){
    let i=det.readings.findIndex(r=>r.kind===p.hint.kind);
    if(i===-1&&p.hint.force&&W.READERS[p.hint.kind]){det.readings.push(forcedReading(p.hint,text));i=det.readings.length-1}
    if(i!==-1&&det.readings[i].confidence>=0.5){
      chosen=i;
      const merged=Object.assign({},det.readings[i].params,p.hint.params||{});
      if(p.hint.kind==='delimited'||p.hint.kind==='html-table'||p.hint.kind==='fixed-width'&&p.hint.params&&p.hint.params.cuts){
        det.readings[i].params=merged;
        const RR=W.READERS[p.hint.kind];if(RR&&RR.labelFor)det.readings[i].label=RR.labelFor(merged)
      }
    }else hintMismatch={expected:(W.READERS[p.hint.kind]||{}).label||p.hint.kind,detected:det.readings[0].label,hint:p.hint}
  }
  E.src={text,htmlTables,fileName:p.fileName||'',readings:det.readings,scan:det.scan,sampleLines:det.sampleLines,lineCount:det.lineCount,size:text.length};
  return{chosen,hintMismatch}
}
function useReading(reading){
  const t=W.applyReading(E.src.text,reading,{htmlTables:E.src.htmlTables});
  E.src.reading={kind:reading.kind,label:reading.label||(W.READERS[reading.kind]||{}).label,params:Object.assign({},reading.params)};
  delete E.src.reading.params.junk;
  E.base=t;E.nextRowId=t.n;E.states=[];E.meta=[];E.views.clear();
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

const SEARCH_KEEP=[];
function searchIndex(t){
  if(!t._search){
    const n=t.n,w=t.cols.length,idx=new Array(n);
    for(let r=0;r<n;r++){let x='';for(let c=0;c<w;c++){const v=t.data[c][r];if(v!=null&&v!=='')x+=W.Q.norm(v)+'\u0001'}idx[r]=x}
    t._search=idx;
    SEARCH_KEEP.push(t);
    while(SEARCH_KEEP.length>2){const old=SEARCH_KEEP.shift();if(old!==t)delete old._search}
  }
  return t._search
}
const INDEX_BUDGET=60e6;
function buildSearchIndex(t){
  const n=t.n,w=t.cols.length;let bytes=0;
  for(let c=0;c<w&&bytes<=INDEX_BUDGET;c++){const col=t.data[c];for(let r=0;r<n;r++){const v=col[r];if(v)bytes+=v.length+1}}
  if(bytes>INDEX_BUDGET){t._noIndex=true;return}
  searchIndex(t)
}
const NATURAL=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
const FIND_CAP=100000;
function findMatcher(v,query){
  const t=v.t;
  const parsed=W.Q.parse(query,t.cols);
  const tree=parsed.tree;
  if(!tree)return null;
  const nc=t.cols.length;
  const byCol=[];for(let c=0;c<nc;c++)byCol.push([]);
  const walk=(nd,neg)=>{
    if(!nd)return;
    if(W.isTreeGroup(nd)){if(nd.op==='not')walk(nd.child,!neg);else nd.children.forEach(c=>walk(c,neg));return}
    if(neg)return;
    let L;try{L=W.compileLeaf(t,nd,E.ctx)}catch(e){return}
    if(L.neg||L.mode==='allEmpty'||L.mode==='row'||L.mode==='fn')return;
    if(L.mode==='col')byCol[L.ci].push(L.test);
    else if(L.mode==='anyCmp')for(const x of L.tests)byCol[x.k].push(x.f);
    else for(let c=0;c<nc;c++)byCol[c].push(L.test)
  };
  walk(W.resolveRelative(tree,t,E.ctx),false);
  if(!byCol.some(a=>a.length))return null;
  const data=t.data;
  return(r,c)=>{const fs=byCol[c];if(!fs.length)return false;const x=data[c][r];const sv=x==null?'':String(x);for(let i=0;i<fs.length;i++)if(fs[i](sv))return true;return false}
}
function findCodes(v,query){
  if(v._find&&v._find.sig===query)return v._find;
  const t=v.t,nc=t.cols.length,n=v.pos.length;
  const m=findMatcher(v,query);
  const codes=[];let capped=false;
  if(m){
    outer:for(let i=0;i<n;i++){const r=v.pos[i];for(let c=0;c<nc;c++)if(m(r,c)){if(codes.length>=FIND_CAP){capped=true;break outer}codes.push(i*nc+c)}}
  }
  v._find={sig:query,codes,capped};
  return v._find
}
function computeFilter(t,p,exclude){
  let pos=null;
  const parsed=W.Q.parse(p.search,t.cols);
  const qerrors=parsed.errors.slice();
  const pure=W.Q.pureFreeTerms(parsed.tree);
  const qtree=parsed.tree;
  if(pure&&pure.length){
    const terms=pure.map(v=>W.Q.norm(v));
    pos=[];
    const w=t.cols.length,cols=t.data,norm=W.Q.norm,nt=terms.length;
    if(!t._search&&!t._noIndex){t._searches=(t._searches||0)+1;if(t._searches>=2)buildSearchIndex(t)}
    if(t._search){const idx=t._search;for(let r=0;r<t.n;r++){const x=idx[r];let ok=true;for(let k=0;k<nt;k++)if(x.indexOf(terms[k])===-1){ok=false;break}if(ok)pos.push(r)}}
    else if(terms.every(tm=>!NON_ASCII_TERM.test(tm))){
      const res=terms.map(foldRegex);
      for(let r=0;r<t.n;r++){
        let all=true;
        for(let k=0;k<nt;k++){
          const re=res[k];let hit=false;
          for(let c=0;c<w;c++){const v=cols[c][r];if(v&&re.test(v)){hit=true;break}}
          if(!hit){all=false;break}
        }
        if(all)pos.push(r)
      }
    }else{
      const cells=new Array(w);
      for(let r=0;r<t.n;r++){
        for(let c=0;c<w;c++){const v=cols[c][r];cells[c]=v?norm(v):''}
        let all=true;
        for(let k=0;k<nt&&all;k++){
          const tm=terms[k];let hit=false;
          for(let c=0;c<w;c++)if(cells[c]&&cells[c].indexOf(tm)!==-1){hit=true;break}
          if(!hit)all=false
        }
        if(all)pos.push(r)
      }
    }
  }else if(qtree){
    const test=W.treeTester(t,qtree,E.ctx,(leaf,e)=>qerrors.push({start:0,end:0,level:'error',message:e.message,col:leaf.col}));
    const out=[];for(let r=0;r<t.n;r++)if(test(r))out.push(r);
    pos=out
  }
  if(p.filter&&p.filter.conditions&&p.filter.conditions.length){
    const valid=p.filter.conditions.filter(c=>c.col==='*'||c.col==='@row'||t.cols.indexOf(c.col)!==-1);
    if(valid.length){
      const test=W.rowTester(t,{match:p.filter.match||'all',conditions:valid.map(c=>Object.assign({caseSensitive:false},c))},E.ctx);
      const base=pos||W.identity(t.n);pos=base.filter(r=>test(r))
    }
  }
  const filterErrors=[];
  const cf=W.colFiltersTree(p.colFilters,exclude);
  if(cf){
    const tree=W.pruneTree(W.resolveRelative(cf,t,E.ctx),l=>W.leafColumnOk(t,l));
    if(tree){
      const test=W.treeTester(t,tree,E.ctx,(leaf,e)=>filterErrors.push({col:leaf.col,message:e.message}));
      const base=pos||W.identity(t.n);pos=base.filter(r=>test(r))
    }
  }
  if(p.rowIds&&p.rowIds.length){
    const pm=W.posMap(t);const set=new Set();for(const id of p.rowIds){const x=pm.get(id);if(x!==undefined)set.add(x)}
    const base=pos||W.identity(t.n);pos=base.filter(r=>set.has(r))
  }
  return{pos,parsed,qerrors,filterErrors,qtree}
}
const NON_ASCII_TERM=/[^\u0000-\u007f]/;
const FOLD_CLASS={i:'[i\\u0130]',s:'[s\\u017f]',k:'[k\\u212a]'};
function foldRegex(term){
  let src='';
  for(const ch of term)src+=FOLD_CLASS[ch]||ch.replace(/[.*+?^${}()|[\]\\\/-]/g,'\\$&');
  return new RegExp(src,'i')
}
function filterPositions(t,p,exclude){
  if(p.rowIds&&p.rowIds.length)return computeFilter(t,p,exclude);
  const c=E.ctx;
  const sig=JSON.stringify([p.search==null?'':p.search,p.filter||null,p.colFilters||null,exclude==null?null:exclude,c.dateOrder||null,c.yearPivot||null,c.today||null]);
  const cache=t._fp||(t._fp=new Map());
  if(cache.has(sig)){const hit=cache.get(sig);cache.delete(sig);cache.set(sig,hit);return hit}
  const out=computeFilter(t,p,exclude);
  cache.set(sig,out);
  while(cache.size>4)cache.delete(cache.keys().next().value);
  return out
}
function makeView(p){
  const si=p.stateIdx==null||p.stateIdx<0?E.states.length-1:Math.min(p.stateIdx,E.states.length-1);
  const t=E.states[si];
  const f=filterPositions(t,p);
  let pos=f.pos;
  const parsed=f.parsed,qerrors=f.qerrors,filterErrors=f.filterErrors,qtree=f.qtree;
  if(!pos)pos=W.identity(t.n);
  if(p.sort&&p.sort.length){
    const types=W.typesOf(t,E.ctx);
    const sets=p.sort.filter(k=>t.cols.indexOf(k.col)!==-1).map(k=>{const ci=t.cols.indexOf(k.col);const type=k.type&&k.type!=='auto'?k.type:types[ci];return{keys:W.sortKeysFor(t.data[ci],type,E.ctx),type,dir:k.dir==='desc'?-1:1}});
    if(sets.length)pos=W.sortPositions(pos,sets)
  }
  const key='v'+(++T.viewSeq);
  E.views.set(key,{si,pos,t,qtree});
  if(E.views.size>8){const first=E.views.keys().next().value;E.views.delete(first)}
  return{viewKey:key,key,n:pos.length,stateIdx:si,total:t.n,schema:schemaOf(t),query:{tokens:parsed.tokens,errors:qerrors,matchedCols:parsed.matchedCols,highlights:W.Q.highlights(qtree)},filterErrors}
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
    push(JSON.stringify({cols,rows,types:ci.map(c=>types[c]),locales:loc,header}))
  }else throw new Error('Unknown format "'+fmt+'".');
  chunks.push(buf);
  const text=chunks.join('');
  return{text,rows:pos.length,cols:cols.length,bytes:text.length}
}

const H={
  ping:()=>({version:W.version}),
  setCtx(p){
    Object.assign(CTX,p||{});
    T.map.forEach(x=>{x.states.forEach(t=>{t._types=null});x.views.clear();if(x.base){if(x===E)recompute(0);else x.dirty=true}});
    return E.base?pipelineResult():{}
  },
  tableNew(p){if(T.map.has(p.id))throw new Error('A table with that id is already open.');const x=newSession();T.map.set(p.id,x);useSession(p.id);return{id:p.id}},
  tableUse(p){useSession(p.id);return{id:p.id}},
  tableClose(p){
    const was=T.active===p.id;
    T.map.delete(p.id);
    if(was){
      if(T.map.size)useSession(T.map.keys().next().value);
      else{const id='t'+Date.now().toString(36);T.map.set(id,newSession());useSession(id)}
    }
    return{active:T.active}
  },
  tableReset(p){
    T.map.clear();Object.keys(REFS).forEach(k=>{delete REFS[k]});
    const x=newSession();T.map.set(p.id,x);useSession(p.id);
    return{id:p.id}
  },
  tableList(){
    return{active:T.active,tables:Array.from(T.map).map(([id,x])=>{const last=x.states.length?x.states[x.states.length-1]:null;return{id,rows:last?last.n:0,cols:last?last.cols.length:0,steps:x.steps.length}})}
  },
  exportTable(p){
    const x=T.map.get(p.id);if(!x)throw new Error('That table is no longer open.');
    return withSession(x,()=>{need();return buildExport({scope:'final',format:p.format,options:p.options,columns:p.columns})})
  },
  findTables(p){return W.findTables(p.text||'',{htmlTables:p.htmlTables||null})},
  sample(p){const r=W.makeSample(p.kind);return r},
  stageStress(p){const s=W.makeStress(p.n||200000);E.staged=s;return{bytes:s.text.length,fileName:s.fileName}},
  loadStaged(){if(!E.staged)throw new Error('Nothing is staged.');const s=E.staged;E.staged=null;return H.load({text:s.text,fileName:s.fileName})},
  loadSample(p){const r=W.makeSample(p.kind);return H.load({text:r.text,fileName:r.fileName,hint:p.hint})},
  removedIds(p){need();const i=p.stateIdx;if(i<1||i>=E.states.length)return{rowIds:[]};const a=E.states[i-1],b=E.states[i];const pm=W.posMap(b);const out=[];for(let r=0;r<a.n;r++)if(!pm.has(a.rowIds[r]))out.push(a.rowIds[r]);return{rowIds:out}},
  schema(p){const t=stateAt(p.stateIdx);return schemaOf(t)},
  load(p){
    const keep={src:E.src,base:E.base,steps:E.steps,states:E.states,meta:E.meta,views:E.views,nextRowId:E.nextRowId};
    E.steps=[];E.states=[];E.meta=[];E.views=new Map();
    try{
      const L=loadSource(p);
      const r=E.src.readings[L.chosen];
      const warns=useReading(r);
      return loadResult({chosenIndex:L.chosen,hintMismatch:L.hintMismatch})
    }catch(e){Object.assign(E,keep);throw e}
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
    const removed=[];if(d.category!=='reshape')for(let r=0;r<t.n&&removed.length<5;r++)if(!pm.has(t.rowIds[r]))removed.push(W.tableRows({cols:t.cols,data:t.data.map(c=>[c[r]]),n:1})[0]);
    let keptIdx=[];
    if(res.touched&&res.touched.size){const set=new Set();res.touched.forEach(v=>{if(v===true){for(let r=0;r<Math.min(o.n,5);r++)set.add(r)}else v.forEach(x=>set.add(x))});keptIdx=Array.from(set).sort((a,b)=>a-b).slice(0,6)}
    else keptIdx=W.identity(Math.min(o.n,5));
    const after=keptIdx.map(r=>o.cols.map((_,c)=>s(o.data[c][r]).slice(0,200)));
    const before=keptIdx.map(r=>{const bp=W.posMap(t).get(o.rowIds[r]);return bp===undefined?null:t.cols.map((_,c)=>s(t.data[c][bp]).slice(0,200))});
    return{stats:res.stats||{},chips:W.statsChips(res.stats,t.n,o.n),warning:res.warning||null,n0:t.n,n1:o.n,cols0:t.cols,cols1:o.cols,removedSample:removed,after,before,touchedCols:res.touched?Array.from(res.touched.keys()):[],describe:d.describe(p.step.cfg)}
  },
  profile(p){const t=stateAt(p.stateIdx);return W.profile(t,p.col,E.ctx)},
  histogram(p){const t=stateAt(p.stateIdx);return W.histogram(t,p.col,E.ctx,p.bins)},
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
    let rd=det.readings[0];
    if(p.hint&&p.hint.kind){let hi=det.readings.findIndex(r=>r.kind===p.hint.kind);if(hi===-1&&p.hint.force&&W.READERS[p.hint.kind]){det.readings.push(forcedReading(p.hint,text));hi=det.readings.length-1}if(hi!==-1&&det.readings[hi].confidence>=0.5){rd=det.readings[hi];rd.params=Object.assign({},rd.params,p.hint.params||{})}}
    const t=W.applyReading(text,rd,{htmlTables:p.htmlTables});
    let name=p.name||'reference';let k=2;const base=name;while(E.refs[name]&&!p.replace){name=base+' ('+k+')';k++}
    E.refs[name]=t;
    T.map.forEach(x=>{if(!x.base)return;const i=x.steps.findIndex(s=>(s.opId==='join'||s.opId==='diff')&&s.cfg&&s.cfg.refName===name);if(i!==-1)withSession(x,()=>recompute(i))});
    return{name,cols:t.cols,n:t.n,reading:rd.label}
  },
  refList:()=>({refs:Object.keys(E.refs).map(k=>({name:k,cols:E.refs[k].cols,n:E.refs[k].n}))}),
  refRemove(p){delete E.refs[p.name];T.map.forEach(x=>{if(!x.base)return;const i=x.steps.findIndex(s=>(s.opId==='join'||s.opId==='diff')&&s.cfg&&s.cfg.refName===p.name);if(i!==-1)withSession(x,()=>recompute(i))});return{}},
  contract(p){const t=stateAt(p.stateIdx);return{contract:W.shapeContract(t)}},
  drift(p){const t=stateAt(p.stateIdx);return{drift:W.diffContracts(p.contract,W.shapeContract(t))}},
  parseRecipe(p){return W.textToSteps(p.text)},
  recipeText(p){return{text:W.stepsToText(p.steps||E.steps,p.source===undefined?(E.src&&E.src.reading?{kind:E.src.reading.kind,params:E.src.reading.params}:null):p.source)}},
  distinctValues(p){
    const t=stateAt(p.stateIdx);const ci=t.cols.indexOf(p.col);
    if(ci===-1)return{values:[],blanks:0,total:0,truncated:false,rows:0};
    const limit=Math.max(1,p.limit||1000);
    const search=p.search!=null?p.search:(p.query||'');
    const others={};if(p.colFilters)for(const k of Object.keys(p.colFilters))if(k!==p.col)others[k]=p.colFilters[k];
    const sig=JSON.stringify([p.col,search,others,p.filter||null,p.rowIds?W.hashString(p.rowIds.join(',')):null,E.ctx.dateOrder,E.ctx.today||null,limit]);
    const cache=t._dv||(t._dv=new Map());
    if(cache.has(sig)){const hit=cache.get(sig);cache.delete(sig);cache.set(sig,hit);return hit}
    const f=filterPositions(t,Object.assign({},p,{search,colFilters:others}),p.col);
    const col=t.data[ci],counts=new Map();let blanks=0;
    const total_=f.pos?f.pos.length:t.n;
    for(let i=0;i<total_;i++){const r=f.pos?f.pos[i]:i;const k=W.valueKey(col[r]);if(k==='')blanks++;else counts.set(k,(counts.get(k)||0)+1)}
    const arr=Array.from(counts,e=>({v:e[0],n:e[1]}));
    arr.sort((a,b)=>b.n-a.n||NATURAL.compare(a.v,b.v)||(a.v<b.v?-1:a.v>b.v?1:0));
    const out={values:arr.slice(0,limit),blanks,total:arr.length,truncated:arr.length>limit,rows:total_};
    cache.set(sig,out);
    while(cache.size>12)cache.delete(cache.keys().next().value);
    return out
  },
  filterTree(p){
    const t=stateAt(p.stateIdx);
    const parsed=W.Q.parse(p.search==null?'':p.search,t.cols);
    const kids=[];
    if(parsed.tree)kids.push(parsed.tree);
    const cf=W.colFiltersTree(p.colFilters);
    if(cf){const r=W.pruneTree(W.resolveRelative(cf,t,E.ctx),l=>W.leafColumnOk(t,l));if(r)kids.push(r)}
    return{tree:W.normTree({op:'and',children:kids}),errors:parsed.errors,today:W.todayISO(E.ctx)}
  },
  replacePreview(p){
    const v=p.viewKey&&p.selection?getView(p.viewKey):null;
    const t=v?v.t:stateAt(p.stateIdx);
    const cfg=W.clone(p.cfg||{});
    const empty=m=>({error:m||null,cells:0,columns:0,samples:[],overrides:[]});
    const bad=W.OPS.replace.validate(cfg,{cols:t.cols});
    if(bad)return empty(bad);
    let r;
    try{r=W.OPS.replace.apply(t,cfg,engineCtx())}catch(e){return empty(e.message)}
    const out=r.table;
    let rowSet=null,colSet=null;
    if(v){
      const sel=p.selection;
      if(sel.kind==='rows')rowSet=new Set(selectedPositions(v,sel));
      else if(sel.kind==='cols')colSet=new Set((sel.cols||[]).map(c=>t.cols.indexOf(c)).filter(i=>i!==-1));
      else if(sel.kind==='cells'&&sel.rect){
        rowSet=new Set();
        for(let i=Math.max(0,sel.rect.r0);i<=Math.min(v.pos.length-1,sel.rect.r1);i++)rowSet.add(v.pos[i]);
        colSet=new Set();
        for(let c=sel.rect.c0;c<=sel.rect.c1;c++)if(c>=0&&c<t.cols.length)colSet.add(c)
      }else return empty(null)
    }
    const cis=W.resolveCols(t,cfg.columns).filter(ci=>(!colSet||colSet.has(ci))&&t.data[ci]!==out.data[ci]);
    const rows=rowSet?Array.from(rowSet).sort((x,y)=>x-y):null;
    const total=rows?rows.length:t.n;
    let cells=0;const hit=new Set(),samples=[],overrides=[];
    for(let i=0;i<total;i++){
      const row=rows?rows[i]:i;
      for(const ci of cis){
        const x=t.data[ci][row],y=out.data[ci][row];
        const bx=x==null?'':String(x),by=y==null?'':String(y);
        if(bx===by)continue;
        cells++;hit.add(ci);
        if(samples.length<5)samples.push({col:t.cols[ci],before:bx,after:by});
        if(p.overrides&&overrides.length<200000)overrides.push({col:t.cols[ci],rowId:t.rowIds[row],value:by})
      }
    }
    return{error:null,cells,columns:hit.size,samples,overrides:p.overrides?overrides:[],capped:!!p.overrides&&cells>overrides.length}
  },
  findCount(p){
    const v=getView(p.viewKey);const c=findCodes(v,p.query);
    return{total:c.codes.length,capped:c.capped}
  },
  findCells(p){
    const v=getView(p.viewKey);const t=v.t;
    const m=findMatcher(v,p.query);
    if(!m)return{pos:-1,col:-1,index:0,total:0,capped:false};
    const nc=t.cols.length,n=v.pos.length;
    const dir=p.dir<0?-1:1;
    let pos=p.from&&p.from.pos!=null?p.from.pos:(dir>0?0:n-1);
    let col=p.from&&p.from.col!=null?p.from.col:(dir>0?-1:nc);
    let wrapped=false;
    let found=null;
    for(let step=0;step<=n&&!found;step++){
      if(pos<0||pos>=n){if(step>=n)break;pos=dir>0?0:n-1;col=dir>0?-1:nc;wrapped=true}
      const r=v.pos[pos];
      if(dir>0){for(let c=col+1;c<nc;c++)if(m(r,c)){found={pos,col:c};break}}
      else{for(let c=col-1;c>=0;c--)if(m(r,c)){found={pos,col:c};break}}
      if(!found){pos+=dir;col=dir>0?-1:nc}
    }
    if(!found)return{pos:-1,col:-1,index:0,total:0,capped:false};
    const cached=v._find&&v._find.sig===p.query?v._find:null;
    let index=null,total=null,capped=false;
    if(cached){
      total=cached.codes.length;capped=cached.capped;
      const code=found.pos*nc+found.col;
      let lo=0,hi=cached.codes.length;
      while(lo<hi){const mid=(lo+hi)>>1;if(cached.codes[mid]<code)lo=mid+1;else hi=mid}
      if(cached.codes[lo]===code)index=lo+1
    }
    return{pos:found.pos,col:found.col,rowId:t.rowIds[v.pos[found.pos]],index,total,capped,wrapped}
  },
  columnValues(p){
    const t=stateAt(p.stateIdx);const ci=t.cols.indexOf(p.col);if(ci===-1)return{rowIds:[]};
    const out=[];const v=W.valueKey(p.value);for(let r=0;r<t.n;r++)if(W.valueKey(t.data[ci][r])===v)out.push(t.rowIds[r]);return{rowIds:out}
  },
  stats(){return{states:E.states.length,rows:E.base?E.base.n:0}},
  pipelineInfo(){need();return pipelineResult()}
};
function stats(cells,count){
  let n=0,sum=0,mn=Infinity,mx=-Infinity;
  const loc=W.detectNumberLocale(cells.slice(0,300));
  for(const c of cells){const p=W.parseNumber(c,{locale:loc});if(p){n++;sum+=p.value;if(p.value<mn)mn=p.value;if(p.value>mx)mx=p.value}}
  return{count,numericCount:n,sum:n?sum:null,avg:n?sum/n:null,min:n?mn:null,max:n?mx:null}
}
const GLOBAL_TYPES=new Set(['ping','setCtx','tableNew','tableUse','tableClose','tableReset','tableList','exportTable','findTables','sample','parseRecipe']);
W.Engine={handle(type,payload){
  const f=H[type];if(!f)throw new Error('Unknown request type "'+type+'".');
  const p=payload||{};
  if(p.tableId&&!GLOBAL_TYPES.has(type)){
    const x=T.map.get(p.tableId);
    if(!x)throw Object.assign(new Error('That table is no longer open.'),{code:'tab-closed'});
    return withSession(x,()=>f(p))
  }
  return f(p)
},H,GLOBAL_TYPES};
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
