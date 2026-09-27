(function(G){
'use strict';
const W=G.WeftCore;

W.CATEGORY_LABEL={rewrite:'Rewrite',remove:'Remove',add:'Add',reshape:'Reshape',structure:'Structure',manual:'Manual'};
W.categoryOf=function(step){
  const d=W.OPS[step.opId];
  if(!d)return'manual';
  if(step.opId==='join')return step.cfg&&(step.cfg.type==='anti'||step.cfg.type==='semi')?'remove':'add';
  return d.category||'rewrite'
};
W.describeStep=function(step){
  const d=W.OPS[step.opId];
  if(!d)return'Unknown step "'+step.opId+'"';
  try{return d.describe(step.cfg||{})}catch(e){return d.label}
};
W.statsChips=function(stats,n0,n1){
  const out=[];if(!stats)return out;
  if(stats.removed)out.push({kind:'remove',text:'−'+W.plural(stats.removed,'row')});
  if(stats.added)out.push({kind:'add',text:'+'+W.plural(stats.added,'row')});
  if(stats.addedCols)out.push({kind:'add',text:'+'+W.plural(stats.addedCols,'column')});
  if(stats.removedCols)out.push({kind:'remove',text:'−'+W.plural(stats.removedCols,'column')});
  if(stats.changed)out.push({kind:'rewrite',text:W.fmtInt(stats.changed)+' changed'});
  if(stats.moved)out.push({kind:'reshape',text:W.fmtInt(stats.moved)+' moved'});
  if(stats.failed)out.push({kind:'warn',text:W.fmtInt(stats.failed)+' not converted'});
  if(!out.length)out.push({kind:'none',text:'No change'});
  return out
};

W.runPipeline=function(base,steps,ctx,fromIdx,prevStates,prevMeta){
  ctx=ctx||{};
  fromIdx=Math.max(0,Math.min(fromIdx||0,steps.length));
  fromIdx=prevStates&&prevStates.length?Math.min(fromIdx,prevStates.length-1):0;
  if(prevMeta)fromIdx=Math.min(fromIdx,prevMeta.length);
  const states=prevStates&&prevStates.length>fromIdx?prevStates.slice(0,fromIdx+1):[base];
  const meta=prevMeta?prevMeta.slice(0,fromIdx):[];
  if(!states.length||fromIdx===0){states.length=0;states.push(base);meta.length=0;fromIdx=0}
  let maxId=base.n;
  if(ctx.nextRowId==null)for(const s of states)for(let i=0;i<s.rowIds.length;i++)if(s.rowIds[i]>=maxId)maxId=s.rowIds[i]+1;
  const rctx=Object.assign({},ctx,{nextRowId:Math.max(ctx.nextRowId||0,maxId)});
  for(let i=fromIdx;i<steps.length;i++){
    const st=steps[i],input=states[i];
    const d=W.OPS[st.opId];
    if(st.muted){states.push(input);meta.push({stats:null,warning:null,error:null,muted:true,touched:null});continue}
    if(!d){states.push(input);meta.push({stats:null,warning:null,error:'This step type ("'+st.opId+'") is not available.',touched:null});continue}
    let res;
    const t0=Date.now();
    try{res=d.apply(input,st.cfg||{},rctx)}
    catch(e){states.push(input);meta.push({stats:null,warning:null,error:e.message||String(e),touched:null,ms:Date.now()-t0});continue}
    const t=res.table||input;
    if(!t.rowIds||t.rowIds.length!==t.n)t.rowIds=W.identity(t.n,rctx.nextRowId),rctx.nextRowId+=t.n;
    t.cols=W.dedupeColNames(t.cols);
    const touched={};
    if(res.touched){
      res.touched.forEach((v,col)=>{
        if(v===true)touched[col]=true;
        else{const ids=new Set();v.forEach(p=>ids.add(t.rowIds[p]));touched[col]=ids}
      })
    }
    states.push(t);
    meta.push({stats:res.stats||{},warning:res.warning||null,error:null,touched,ms:Date.now()-t0})
  }
  return{states,meta,nextRowId:rctx.nextRowId}
};

W.stepToLine=function(step){
  const d=W.OPS[step.opId];
  const pre=step.muted?'#! ':'';
  if(!d)return pre+'# unknown step '+step.opId;
  return pre+d.toDsl(step.cfg||{})
};
W.stepsToText=function(steps,source){
  const lines=['# weft recipe v2'];
  if(source)lines.push('@source '+JSON.stringify(source));
  for(const s of steps)lines.push(W.stepToLine(s));
  return lines.join('\n')
};
W.parseStepLine=function(line){
  const cands=W.OP_ORDER.filter(id=>W.OPS[id].dslPattern.test(line));
  if(!cands.length)throw new Error('Weft does not recognise this step. Check the spelling, or open the step list in Commands to see the options.');
  let firstErr=null;
  for(const id of cands){
    try{const cfg=W.OPS[id].fromDsl(line);return{opId:id,cfg}}
    catch(e){if(!firstErr)firstErr=e}
  }
  throw firstErr
};
W.textToSteps=function(text){
  const lines=String(text||'').replace(/\r\n?/g,'\n').split('\n');
  const steps=[],errors=[];let source=null,version=1;
  lines.forEach((raw,i)=>{
    let line=raw.trim();
    if(!line)return;
    if(/^#\s*(weft|sift) recipe v(\d+)/i.test(line)){version=+line.match(/v(\d+)/i)[1];return}
    let muted=false;
    if(line.startsWith('#!')){muted=true;line=line.slice(2).trim()}
    else if(line.startsWith('#'))return;
    if(/^@source\b/i.test(line)){try{source=W.jsonDirective(line,'@source')}catch(e){errors.push({line:i+1,message:e.message})}return}
    try{const p=W.parseStepLine(line);steps.push({opId:p.opId,cfg:p.cfg,muted})}
    catch(e){errors.push({line:i+1,message:e.message,text:line})}
  });
  return{steps,errors,source,version}
};
W.stepColumns=function(step){
  const cfg=step.cfg||{};const out=new Set();
  const add=v=>{if(Array.isArray(v))v.forEach(x=>{if(x&&x!=='*')out.add(x)});else if(typeof v==='string'&&v&&v!=='*')out.add(v)};
  ['column','columns','from','on','idColumns','valueColumns','keyColumn','valueColumn','groupBy','onLeft','keyColumns'].forEach(k=>add(cfg[k]));
  if(cfg.conditions)cfg.conditions.forEach(c=>add(c.col));
  if(cfg.keys)cfg.keys.forEach(k=>add(k.col));
  return Array.from(out)
};
W.remapStep=function(step,dict){
  const s=W.clone(step);const cfg=s.cfg||{};
  const m=v=>typeof v==='string'&&dict[v]?dict[v]:v;
  ['column','from','keyColumn','valueColumn'].forEach(k=>{if(cfg[k])cfg[k]=m(cfg[k])});
  ['columns','on','idColumns','valueColumns','groupBy','onLeft','keyColumns','compareColumns','order'].forEach(k=>{if(Array.isArray(cfg[k]))cfg[k]=cfg[k].map(m)});
  if(cfg.conditions)cfg.conditions.forEach(c=>{c.col=m(c.col)});
  if(cfg.keys)cfg.keys.forEach(k=>{k.col=m(k.col)});
  if(Array.isArray(cfg.metrics))cfg.metrics=cfg.metrics.map(x=>{const p=W.parseMetric(x);return p&&p.column&&dict[p.column]?dict[p.column]+':'+p.fn:x});
  return s
};

W.shapeContract=function(t){
  return{n:t.n,cols:t.cols.map((name,ci)=>{
    const col=t.data[ci];let empty=0;const freq=new Map();let mn=Infinity,mx=-Infinity,nn=0;
    const sm=[];for(let r=0;r<t.n&&sm.length<200;r++){const v=String(col[r]==null?'':col[r]).trim();if(v)sm.push(v)}
    const loc=W.detectNumberLocale(sm);
    for(let r=0;r<t.n;r++){const v=String(col[r]==null?'':col[r]).trim();if(!v){empty++;continue}if(freq.size<=21)freq.set(v,(freq.get(v)||0)+1);const p=W.parseNumber(v,{locale:loc});if(p){nn++;if(p.value<mn)mn=p.value;if(p.value>mx)mx=p.value}}
    const ne=t.n-empty,num=ne>0&&nn/ne>0.9,low=freq.size<=20;
    return{name,nullRate:t.n?empty/t.n:0,lowCardinality:low,values:low?Array.from(freq.keys()).sort():null,numeric:num,numMin:num?mn:null,numMax:num?mx:null}
  })}
};
W.diffContracts=function(a,b){
  const out=[];const bn=new Map(b.cols.map(c=>[c.name,c]));const an=new Set(a.cols.map(c=>c.name));
  for(const oc of a.cols){
    const nc=bn.get(oc.name);
    if(!nc){out.push({kind:'missing',col:oc.name,text:'Column "'+oc.name+'" is missing.'});continue}
    if(oc.lowCardinality&&nc.lowCardinality){
      const add=nc.values.filter(v=>oc.values.indexOf(v)===-1);
      if(add.length)out.push({kind:'newValue',col:oc.name,text:'"'+oc.name+'" has new values: '+add.slice(0,5).map(v=>'"'+v+'"').join(', ')+'.'})
    }
    const r1=Math.round(oc.nullRate*1000)/10,r2=Math.round(nc.nullRate*1000)/10;
    if(Math.abs(r2-r1)>=5)out.push({kind:'nullRate',col:oc.name,text:'"'+oc.name+'" is '+r2+'% empty (was '+r1+'%).'});
    if(oc.numeric&&!nc.numeric)out.push({kind:'type',col:oc.name,text:'"'+oc.name+'" no longer looks like numbers.'});
    if(oc.numeric&&nc.numeric){if(nc.numMin<oc.numMin)out.push({kind:'range',col:oc.name,text:'"'+oc.name+'" now goes down to '+W.fmtNum(nc.numMin)+' (was '+W.fmtNum(oc.numMin)+').'});if(nc.numMax>oc.numMax)out.push({kind:'range',col:oc.name,text:'"'+oc.name+'" now goes up to '+W.fmtNum(nc.numMax)+' (was '+W.fmtNum(oc.numMax)+').'})}
  }
  for(const nc of b.cols)if(!an.has(nc.name))out.push({kind:'added',col:nc.name,text:'Column "'+nc.name+'" is new.'});
  return out
};
W.matchColumns=function(want,have){
  const norm=s=>String(s).toLowerCase().replace(/[\s_\-.]+/g,'');
  const hn=have.map(norm);const dict={};
  for(const w of want){if(have.indexOf(w)!==-1)continue;const i=hn.indexOf(norm(w));if(i!==-1)dict[w]=have[i]}
  return dict
};
})(typeof self!=='undefined'?self:globalThis);
