(function(G){
'use strict';
const W=G.WeftCore;
const CC=[
  {name:'whitespace',re:/\s+/g},{name:'digits',re:/\d+/g},{name:'non-digits',re:/\D+/g},
  {name:'currency-seps',re:/[$€£,]+/g},{name:'punctuation',re:/[.,;:!?]+/g},{name:'parens',re:/[()]+/g},
  {name:'non-alphanumeric',re:/[^a-zA-Z0-9]+/g},{name:'non-alphanumeric-space',re:/[^a-zA-Z0-9\s]+/g}
];
const KC=[{name:'digits',re:/[^0-9]+/g},{name:'letters',re:/[^a-zA-Z]+/g},{name:'alphanumeric',re:/[^a-zA-Z0-9]+/g}];
const EP=[
  {name:'email',re:/[\w.+-]+@[\w-]+\.[\w.-]+/},{name:'phone',re:/\+?1?[\s.-]?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/},
  {name:'url',re:/https?:\/\/[^\s]+/},{name:'digits-run',re:/\d+/},{name:'decimal-number',re:/-?\d[\d,]*\.?\d*/},
  {name:'first-word',re:/^\S+/},{name:'last-word',re:/\S+$/},{name:'parenthesized',re:/\(([^)]*)\)/},{name:'quoted',re:/"([^"]*)"/}
];
const DL=[' ',',','-','/','|','\t',';','_','@'];
const P={
  trim:v=>v.replace(/\s+/g,' ').trim(),
  case:(v,m)=>m==='upper'?v.toUpperCase():m==='title'?W.titleCase(v):v.toLowerCase(),
  replaceLiteral:(v,f,r)=>f===''?v:v.split(f).join(r),
  stripClass:(v,n)=>{const c=CC.find(c=>c.name===n);return c?v.replace(c.re,''):null},
  keepClass:(v,n)=>{const c=KC.find(c=>c.name===n);return c?v.replace(c.re,''):null},
  extractPattern:(v,n)=>{const p=EP.find(p=>p.name===n);if(!p)return null;const m=v.match(p.re);return m?(m.length>1?m[1]:m[0]):null},
  splitTake:(v,d,i)=>{const parts=v.split(d).map(s=>s.trim());const k=i<0?parts.length+i:i;return parts.length>1&&parts[k]!==undefined?parts[k]:null},
  dateReformat:(v,f)=>{const d=W.parseDate(v);return d?W.fmtDateAs(d,f):null},
  numberReformat:(v,variant)=>{
    let s=v.trim(),neg=false;
    if(variant==='parens-negative'&&/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1)}
    s=s.replace(/[$€£,\s]/g,'');let pct=false;if(s.endsWith('%')){pct=true;s=s.slice(0,-1)}
    let n=Number(s);if(!isFinite(n)||s==='')return null;if(neg)n=-Math.abs(n);if(pct&&variant==='percent-to-decimal')n=n/100;
    return String(n)
  },
  addPrefix:(v,p)=>p+v,removePrefix:(v,p)=>v.startsWith(p)?v.slice(p.length):null,
  addSuffix:(v,s)=>v+s,removeSuffix:(v,s)=>v.endsWith(s)?v.slice(0,-s.length):null,
  pad:(v,w,ch,side)=>side==='start'?v.padStart(w,ch):v.padEnd(w,ch)
};
function literal(ex,fn){
  const b=ex[0].before,a=ex[0].after;
  if(fn==='addPrefix')return a.length>b.length&&a.endsWith(b)?{prefix:a.slice(0,a.length-b.length)}:null;
  if(fn==='removePrefix')return b.length>a.length&&b.endsWith(a)?{prefix:b.slice(0,b.length-a.length)}:null;
  if(fn==='addSuffix')return a.length>b.length&&a.startsWith(b)?{suffix:a.slice(b.length)}:null;
  if(fn==='removeSuffix')return b.length>a.length&&b.startsWith(a)?{suffix:b.slice(a.length)}:null;
  if(fn==='pad'){
    if(a.length>b.length){
      if(a.endsWith(b)){const p=a.slice(0,a.length-b.length);if(p&&[...p].every(c=>c===p[0]))return{width:a.length,ch:p[0],side:'start'}}
      if(a.startsWith(b)){const p=a.slice(b.length);if(p&&[...p].every(c=>c===p[0]))return{width:a.length,ch:p[0],side:'end'}}
    }
    return null
  }
  if(fn==='replaceLiteral'){
    let x=0;while(x<b.length&&x<a.length&&b[x]===a[x])x++;
    let y=0;while(y<b.length-x&&y<a.length-x&&b[b.length-1-y]===a[a.length-1-y])y++;
    const f=b.slice(x,b.length-y),r=a.slice(x,a.length-y);return f===''?null:{find:f,replace:r}
  }
  return null
}
W.applyCandidate=function ap(c,v){
  const p=c.params||{};
  switch(c.type){
    case'trim':return P.trim(v);case'case':return P.case(v,p.mode);
    case'stripClass':return P.stripClass(v,p.className);case'keepClass':return P.keepClass(v,p.className);
    case'extractPattern':return P.extractPattern(v,p.patternName);case'splitTake':return P.splitTake(v,p.delim,p.index);
    case'dateReformatInfer':return P.dateReformat(v,p.fmt);case'numberReformatInfer':return P.numberReformat(v,p.variant);
    case'addPrefix':return P.addPrefix(v,p.prefix);case'removePrefix':return P.removePrefix(v,p.prefix);
    case'addSuffix':return P.addSuffix(v,p.suffix);case'removeSuffix':return P.removeSuffix(v,p.suffix);
    case'pad':return P.pad(v,p.width,p.ch,p.side);case'replaceLiteral':return P.replaceLiteral(v,p.find,p.replace);
    case'mapValue':{const h=(p.map||[]).find(x=>x[0]===v);return h?h[1]:v}
    case'compose':{let x=v;for(const s of p.steps){x=ap(s,x);if(x==null)return null}return x}
  }
  return null
};
function d1(ex){
  const out=[];
  const all=fn=>ex.every(e=>{try{return fn(e.before)===e.after}catch(err){return false}});
  if(all(P.trim))out.push({type:'trim',params:{},depth:1});
  for(const mode of['lower','upper','title'])if(all(b=>P.case(b,mode)))out.push({type:'case',params:{mode},depth:1});
  for(const c of CC)if(all(b=>P.stripClass(b,c.name)))out.push({type:'stripClass',params:{className:c.name},depth:1});
  for(const c of KC)if(all(b=>P.keepClass(b,c.name)))out.push({type:'keepClass',params:{className:c.name},depth:1});
  for(const p of EP)if(all(b=>P.extractPattern(b,p.name)))out.push({type:'extractPattern',params:{patternName:p.name},depth:1});
  for(const d of DL)for(const i of[0,1,2,-1,-2])if(all(b=>P.splitTake(b,d,i)))out.push({type:'splitTake',params:{delim:d,index:i},depth:1});
  for(const f of['iso','us','eu','long','compact'])if(all(b=>P.dateReformat(b,f)))out.push({type:'dateReformatInfer',params:{fmt:f},depth:1});
  for(const v of['plain','parens-negative','percent-to-decimal'])if(all(b=>P.numberReformat(b,v)))out.push({type:'numberReformatInfer',params:{variant:v},depth:1});
  for(const fn of['addPrefix','removePrefix','addSuffix','removeSuffix','pad']){
    const params=literal(ex,fn);if(!params)continue;
    const c={type:fn,params,depth:1};
    if(all(b=>W.applyCandidate(c,b)))out.push(c)
  }
  const rl=literal(ex,'replaceLiteral');
  if(rl&&all(b=>P.replaceLiteral(b,rl.find,rl.replace)))out.push({type:'replaceLiteral',params:rl,depth:1});
  out.push({type:'mapValue',params:{map:ex.map(e=>[e.before,e.after])},depth:99});
  return out
}
const PREP=[{type:'trim',params:{}},{type:'case',params:{mode:'lower'}},{type:'case',params:{mode:'upper'}}];
function d2(ex){
  const out=[];
  for(const pr of PREP){
    const m=ex.map(e=>({before:W.applyCandidate(pr,e.before),after:e.after}));
    if(m.some(e=>e.before==null)||m.every(e=>e.before===e.after))continue;
    for(const c of d1(m).filter(c=>c.depth===1))out.push({type:'compose',params:{steps:[pr,{type:c.type,params:c.params}]},depth:2})
  }
  return out
}
const TIER={trim:0,case:0,dateReformatInfer:1,numberReformatInfer:1,pad:1,removePrefix:2,removeSuffix:2,addPrefix:3,addSuffix:3,extractPattern:4,keepClass:5,stripClass:5,splitTake:6,replaceLiteral:7,mapValue:8};
const tier=c=>c.type==='compose'?Math.max.apply(null,c.params.steps.map(tier)):(TIER[c.type]!=null?TIER[c.type]:6);
W.describeCandidate=function dc(c){
  const p=c.params||{};
  switch(c.type){
    case'trim':return'Trim whitespace';case'case':return'Change case to '+p.mode;
    case'stripClass':return'Remove '+p.className.replace(/-/g,' ');case'keepClass':return'Keep only '+p.className;
    case'extractPattern':return'Keep only the '+p.patternName.replace(/-/g,' ');
    case'splitTake':return'Take part '+(p.index<0?'from the end ':'')+(Math.abs(p.index)+(p.index<0?0:1))+' when split on "'+(p.delim===' '?'space':p.delim)+'"';
    case'dateReformatInfer':return'Reformat dates as '+p.fmt.toUpperCase();case'numberReformatInfer':return'Clean number formatting';
    case'addPrefix':return'Add "'+p.prefix+'" at the start';case'removePrefix':return'Remove "'+p.prefix+'" at the start';
    case'addSuffix':return'Add "'+p.suffix+'" at the end';case'removeSuffix':return'Remove "'+p.suffix+'" at the end';
    case'pad':return'Pad to '+p.width+' characters with "'+p.ch+'"';
    case'replaceLiteral':return'Replace "'+W.trunc(p.find,20)+'" with "'+W.trunc(p.replace,20)+'"';
    case'mapValue':return'Change this exact value only';
    case'compose':return p.steps.map(dc).join(', then ')
  }
  return'Change'
};
W.synthesize=function(examples,sample){
  const cands=d1(examples).concat(examples.length<=2?d2(examples):[]);
  const col=sample&&sample.length?sample:examples.map(e=>e.before);
  const scored=cands.map(c=>{
    let changed=0,broken=0,unchanged=0;
    for(const v of col){
      if(v==null||v==='')continue;
      let o;try{o=W.applyCandidate(c,v)}catch(e){broken++;continue}
      if(o==null)continue;
      if(o===''&&v!==''){broken++;continue}
      if(o===v)unchanged++;else changed++
    }
    return{c,complexity:c.depth===99?100:c.depth,changed,broken,unchanged,tier:tier(c),label:W.describeCandidate(c)}
  });
  scored.sort((x,y)=>x.complexity-y.complexity||x.broken-y.broken||x.tier-y.tier||y.changed-x.changed);
  const seen=new Set();
  return scored.filter(s=>{const k=s.label;if(seen.has(k))return false;seen.add(k);return true})
};
})(typeof self!=='undefined'?self:globalThis);
