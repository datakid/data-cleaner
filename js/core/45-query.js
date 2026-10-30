(function(G){
'use strict';
const W=G.WeftCore;
const NEEDS_FOLD=/[\u0130\u03a3\u03c2\u017f]/;
const DOTTED_I=/İ/g;
const LATE_FOLD=/[ςſ]/g;
const lateFold=c=>c==='ς'?'σ':'s';
const Q={
  norm(v){
    const x=typeof v==='string'?v:v==null?'':String(v);
    if(!NEEDS_FOLD.test(x))return x.toLowerCase();
    return x.replace(DOTTED_I,'i').toLowerCase().replace(LATE_FOLD,lateFold)
  },
  terms(text){
    return Q.norm(String(text==null?'':text).trim()).split(/\s+/).filter(Boolean)
  }
};
W.Q=Q;

const isGroup=n=>!!n&&n.col===undefined&&(n.op==='and'||n.op==='or'||n.op==='not');
W.isTreeGroup=isGroup;
W.normTree=function(node){
  if(!node)return null;
  if(!isGroup(node))return node;
  if(node.op==='not'){const c=W.normTree(node.child);return c?{op:'not',child:c}:null}
  const kids=[];
  for(const c of node.children||[]){
    const x=W.normTree(c);
    if(!x)continue;
    if(isGroup(x)&&x.op===node.op)for(const y of x.children)kids.push(y);else kids.push(x)
  }
  if(!kids.length)return null;
  return kids.length===1?kids[0]:{op:node.op,children:kids}
};
W.treeToParts=function(node){
  if(!node)return{match:'all',conditions:[]};
  if(!isGroup(node))return{match:'all',conditions:[node]};
  if((node.op==='and'||node.op==='or')&&node.children.every(c=>!isGroup(c)))return{match:node.op==='or'?'any':'all',conditions:node.children};
  return{tree:node}
};
W.cfgFromTree=function(mode,tree){return Object.assign({mode},W.treeToParts(W.normTree(tree)))};
W.condsToTree=function(cfg){
  if(cfg.tree)return cfg.tree;
  return W.normTree({op:cfg.match==='any'?'or':'and',children:(cfg.conditions||[]).slice()})
};
W.treeLeaves=function(node,out){
  out=out||[];
  if(!node)return out;
  if(!isGroup(node))out.push(node);
  else if(node.op==='not')W.treeLeaves(node.child,out);
  else for(const c of node.children)W.treeLeaves(c,out);
  return out
};
W.mapLeaves=function(node,fn){
  if(!node)return null;
  if(!isGroup(node))return fn(node);
  if(node.op==='not'){const c=W.mapLeaves(node.child,fn);return c?{op:'not',child:c}:null}
  const kids=node.children.map(c=>W.mapLeaves(c,fn)).filter(Boolean);
  return kids.length?{op:node.op,children:kids}:null
};
W.pruneTree=function(node,keep){return W.normTree(W.mapLeaves(node,l=>keep(l)?l:null))};
W.treeDepth=function(node){
  if(!isGroup(node))return 1;
  if(node.op==='not')return 1+W.treeDepth(node.child);
  let d=0;for(const c of node.children)d=Math.max(d,W.treeDepth(c));return d+1
};
W.treeTester=function(t,node,ctx,onError){
  ctx=ctx||{};
  const build=n=>{
    if(!isGroup(n)){
      if(!onError)return W.leafMatcher(t,W.compileLeaf(t,n,ctx));
      try{return W.leafMatcher(t,W.compileLeaf(t,n,ctx))}
      catch(e){onError(n,e);return null}
    }
    if(n.op==='not'){const f=build(n.child);return f?(r=>!f(r)):null}
    const ms=n.children.map(build).filter(Boolean);
    if(!ms.length)return null;
    if(ms.length===1)return ms[0];
    const k=ms.length;
    if(n.op==='and')return r=>{for(let i=0;i<k;i++)if(!ms[i](r))return false;return true};
    return r=>{for(let i=0;i<k;i++)if(ms[i](r))return true;return false}
  };
  return build(node)||(()=>true)
};
const wrapChild=(c,f)=>isGroup(c)&&c.op!=='not'?'('+f(c)+')':f(c);
W.treeToDsl=function(node){
  if(!isGroup(node))return W.condToDsl(node);
  if(node.op==='not')return'not '+wrapChild(node.child,W.treeToDsl);
  return node.children.map(c=>wrapChild(c,W.treeToDsl)).join(node.op==='or'?' or ':' and ')
};
W.describeTree=function(node){
  if(!isGroup(node))return W.describeCond(node);
  if(node.op==='not')return'not '+wrapChild(node.child,W.describeTree);
  return node.children.map(c=>wrapChild(c,W.describeTree)).join(node.op==='or'?' or ':' and ')
};
W.cfgTree=function(cfg){return cfg.tree?cfg.tree:W.condsToTree(cfg)};
W.cfgLeaves=function(cfg){return cfg.tree?W.treeLeaves(cfg.tree):(cfg.conditions||[])};
const colKey=s=>String(s).toLowerCase().replace(/[\s_\-.]+/g,'');
Q.resolveCol=function(name,cols){
  if(!cols||!cols.length)return null;
  const exact=cols.indexOf(name);
  if(exact!==-1)return{col:cols[exact],ambiguous:false};
  const lower=String(name).toLowerCase();
  const ci=cols.filter(c=>String(c).toLowerCase()===lower);
  if(ci.length)return{col:ci[0],ambiguous:ci.length>1};
  const k=colKey(name);
  if(!k)return null;
  const nm=cols.filter(c=>colKey(c)===k);
  if(!nm.length)return null;
  return{col:nm[0],ambiguous:nm.length>1}
};
const isWs=c=>c===' '||c==='\t'||c==='\n'||c==='\r'||c==='\u00a0';
const FLAG_OK=/^[imsu]*$/;
const MAX_DEPTH=64;
const free=v=>({col:'*',op:'contains',value:v,caseSensitive:false});
Q.parse=function(text,cols){
  const src=String(text==null?'':text);
  const n=src.length;
  const tokens=[],errors=[],matched=new Set();
  let i=0;
  const err=(start,end,message,level)=>errors.push({start,end,message,level:level||'error'});
  const tok=(kind,start,end,extra)=>tokens.push(Object.assign({kind,start,end,text:src.slice(start,end)},extra||{}));
  const skip=()=>{while(i<n&&isWs(src[i]))i++};
  const kwAt=()=>{
    for(const k of['OR','AND','NOT']){
      if(src.startsWith(k,i)){const c=src[i+k.length];if(c===undefined||isWs(c)||c==='(')return k}
    }
    return null
  };
  const operandFollows=j=>{while(j<n&&isWs(src[j]))j++;return j<n&&src[j]!==')'};
  const runEnd=(from,depth)=>{let j=from;while(j<n&&!isWs(src[j])&&!(depth>0&&src[j]===')'))j++;return j};
  const readQuoted=at=>{
    const k=src.indexOf('"',at+1);
    if(k===-1)return null;
    return{text:src.slice(at+1,k),end:k+1}
  };
  const restAsWords=(from,depth)=>{
    const kids=[];let j=from;
    while(j<n){
      while(j<n&&isWs(src[j]))j++;
      if(j>=n)break;
      const e=runEnd(j,depth);
      if(e===j){j++;continue}
      kids.push(free(src.slice(j,e)));tok('term',j,e);j=e
    }
    return kids.length?{op:'and',children:kids}:null
  };
  const readRegex=(at,depth)=>{
    let j=at+1,body='',inCls=false;
    while(j<n){
      const d=src[j];
      if(d==='\\'&&j+1<n){if(src[j+1]==='/'&&!inCls)body+='/';else body+=d+src[j+1];j+=2;continue}
      if(d==='[')inCls=true;
      else if(d===']')inCls=false;
      else if(d==='/'&&!inCls)break;
      body+=d;j++
    }
    if(j>=n||!body)return null;
    let e=j+1,flags='';
    while(e<n&&/[a-z]/.test(src[e])){flags+=src[e];e++}
    if(!FLAG_OK.test(flags))return null;
    if(e<n&&!isWs(src[e])&&!(depth>0&&src[e]===')'))return null;
    return{src:body,flags,end:e}
  };
  const regexLeaf=(col,rx,start)=>{
    if(W.isUnsafeRegexSource(rx.src)){err(start,rx.end,'That pattern is too long or could freeze the page, so it was skipped.');return null}
    try{new RegExp(rx.src,rx.flags.replace(/[^imsu]/g,''))}catch(e){err(start,rx.end,'That pattern is not valid, so it was skipped.');return null}
    return{col,op:'matches',value:rx.src,caseSensitive:rx.flags.indexOf('i')===-1}
  };
  const OPS=[['>=','gte'],['<=','lte'],['<>','ne'],['!=','ne'],['>','gt'],['<','lt'],['=','eq']];
  const readValue=(at,depth)=>{
    if(at<n&&src[at]==='"'){
      const q=readQuoted(at);
      if(q)return{text:q.text,quoted:true,end:q.end};
      err(at,n,'This quote is not closed.');
      return{text:src.slice(at+1),quoted:true,end:n}
    }
    const e=runEnd(at,depth);
    return{text:src.slice(at,e),quoted:false,end:e}
  };
  const readList=(at)=>{
    let j=at+1;const items=[];let cur='',any=false,closed=false;
    const flush=()=>{if(any||cur!==''){items.push(cur.trim())}cur='';any=false};
    while(j<n){
      const c=src[j];
      if(c==='"'){const q=readQuoted(j);if(q){cur+=q.text;any=true;j=q.end;continue}}
      if(c==='|'){flush();j++;continue}
      if(c===')'){closed=true;j++;break}
      cur+=c;j++
    }
    if(!closed)err(at,n,'This list is missing its closing bracket.');
    flush();
    return{items:items.filter(x=>x!==''),end:j}
  };
  const tryField=depth=>{
    const s0=i;let j=i,name;
    const c=src[i];
    if(c==='"'){const q=readQuoted(i);if(!q)return null;name=q.text;j=q.end}
    else if(c==='['){const k=src.indexOf(']',i+1);if(k===-1)return null;name=src.slice(i+1,k);j=k+1}
    else{while(j<n&&!/[\s:<>=!()"\[\]]/.test(src[j]))j++;if(j===i)return null;name=src.slice(i,j)}
    let op=null,after=j;
    if(src[j]===':'){op=':';after=j+1}
    else{for(const o of OPS)if(src.startsWith(o[0],j)){op=o[1];after=j+o[0].length;break}}
    if(!op)return null;
    const rc=Q.resolveCol(name,cols);
    if(!rc){
      if(c==='"'||c==='['){const e=runEnd(j,depth);i=e;tok('term',s0,e);return{node:free(src.slice(s0,e))}}
      return null
    }
    const col=rc.col;
    matched.add(col);
    if(rc.ambiguous)err(s0,j,'"'+name+'" matches more than one column. Using "'+col+'".','warn');
    let node=null,end=after;
    const fieldTok=(e,extra)=>tok('field',s0,e,Object.assign({col,colEnd:j},extra||{}));
    if(op===':'){
      if(after>=n||isWs(src[after])||(depth>0&&src[after]===')')){i=after;fieldTok(after,{incomplete:true});return{incomplete:true}}
      const ch=src[after];
      if(ch==='='||(ch==='!'&&src[after+1]==='=')){
        const neg=ch==='!';const vs=after+(neg?2:1);
        const v=readValue(vs,depth);end=v.end;
        if(v.text===''&&!v.quoted){i=end;fieldTok(end,{incomplete:true});return{incomplete:true}}
        node=v.text===''?{col,op:neg?'isNotEmpty':'isEmpty',caseSensitive:false}:{col,op:neg?'notEquals':'equals',value:v.text,caseSensitive:false}
      }else if(ch==='/'){
        const rx=readRegex(after,depth);
        if(rx){end=rx.end;node=regexLeaf(col,rx,s0)}
        else{const v=readValue(after,depth);end=v.end;node={col,op:'contains',value:v.text,caseSensitive:false}}
      }else if(ch==='('){
        const l=readList(after);end=l.end;
        if(l.items.length)node={col,op:'in',values:l.items,caseSensitive:false};
        else{i=end;fieldTok(end,{incomplete:true});return{incomplete:true}}
      }else{
        const v=readValue(after,depth);end=v.end;
        const dd=v.quoted?-1:v.text.indexOf('..');
        if(dd>0&&dd<v.text.length-2){node={col,op:'between',value:v.text.slice(0,dd),value2:v.text.slice(dd+2),caseSensitive:false}}
        else node={col,op:'contains',value:v.text,caseSensitive:false}
      }
    }else{
      const v=readValue(after,depth);end=v.end;
      if(v.text===''&&!v.quoted){i=end;fieldTok(end,{incomplete:true});return{incomplete:true}}
      node={col,op,value:v.text,caseSensitive:false}
    }
    i=end;
    fieldTok(end,node?{op:node.op}:{});
    return{node}
  };
  const parseAtom=depth=>{
    const c=src[i];
    if(c==='('){
      if(depth>=MAX_DEPTH){err(i,n,'These brackets are nested too deeply, so the rest is searched as plain words.');const r=restAsWords(i,depth);i=n;return r}
      const s0=i;i++;tok('paren',s0,s0+1);
      const node=parseOr(depth+1);
      skip();
      if(i<n&&src[i]===')'){tok('paren',i,i+1);i++}
      else err(s0,n,'This bracket is not closed.');
      return node
    }
    const f=tryField(depth);
    if(f){return f.node||null}
    if(c==='"'){
      const q=readQuoted(i);
      if(q){const s0=i;i=q.end;tok('phrase',s0,i);return q.text===''?null:free(q.text)}
      const s0=i;err(s0,n,'This quote is not closed, so the rest is searched as plain words.');
      const r=restAsWords(s0+1,depth);i=n;return r
    }
    if(c==='/'){
      const rx=readRegex(i,depth);
      if(rx){const s0=i;i=rx.end;tok('regex',s0,i);return regexLeaf('*',rx,s0)}
    }
    const e=Math.max(i+1,runEnd(i,depth));
    const s0=i;i=e;tok('term',s0,e);
    return free(src.slice(s0,e))
  };
  const parseUnary=depth=>{
    skip();
    if(i>=n)return null;
    if(src[i]==='-'&&i+1<n&&!isWs(src[i+1])&&src[i+1]!==')'){
      const s0=i;i++;tok('op',s0,i);
      const u=parseUnary(depth);
      return u?{op:'not',child:u}:null
    }
    if(kwAt()==='NOT'&&operandFollows(i+3)){
      const s0=i;i+=3;tok('op',s0,i);
      const u=parseUnary(depth);
      return u?{op:'not',child:u}:null
    }
    return parseAtom(depth)
  };
  const parseAnd=depth=>{
    const kids=[];
    for(;;){
      skip();
      if(i>=n)break;
      if(src[i]===')'&&depth>0)break;
      const k=kwAt();
      if(k==='OR'&&operandFollows(i+2)&&kids.length)break;
      if(k==='AND'&&operandFollows(i+3)&&kids.length){const s0=i;i+=3;tok('op',s0,i);continue}
      const before=i;
      const u=parseUnary(depth);
      if(u)kids.push(u);
      if(i===before)i++
    }
    return kids.length?{op:'and',children:kids}:null
  };
  const parseOr=depth=>{
    const kids=[];
    const first=parseAnd(depth);if(first)kids.push(first);
    for(;;){
      skip();
      if(kwAt()==='OR'&&operandFollows(i+2)&&kids.length){
        const s0=i;i+=2;tok('op',s0,i);
        const nx=parseAnd(depth);if(nx)kids.push(nx);continue
      }
      break
    }
    return kids.length?{op:'or',children:kids}:null
  };
  const lead=src.search(/\S/);
  if(lead!==-1&&src[lead]==='='){
    const body=src.slice(lead);
    const ck=W.F.compile(body,cols||null);
    tok('formula',lead,n);
    let bad=false;
    for(const e of ck.errors){err(lead+e.pos,lead+e.end,e.message);bad=true}
    for(const m of ck.missing){err(lead,n,'Column "'+m+'" was not found.');bad=true}
    if(/[\r\n]/.test(body)){err(lead,n,'A formula must stay on one line.');bad=true}
    const expr=src.slice(lead+1).trim();
    const leaf=bad?null:{col:'@formula',op:'formula',expr,caseSensitive:false};
    return{tree:leaf,tokens,errors,matchedCols:[],freeTerms:[]}
  }
  let tree=null;
  try{
    tree=W.normTree(parseOr(0));
    while(i<n){
      skip();if(i>=n)break;
      const rest=W.normTree(parseOr(0));
      if(rest)tree=W.normTree({op:'and',children:[tree,rest].filter(Boolean)});
      if(i<n&&src[i]===')'){tok('term',i,i+1);tree=W.normTree({op:'and',children:[tree,free(')')].filter(Boolean)});i++}
    }
  }catch(e){
    err(0,n,'This search could not be read, so it is searched as plain words.');
    const kids=src.split(/\s+/).filter(Boolean).map(free);
    tree=W.normTree({op:'and',children:kids})
  }
  return{tree,tokens,errors,matchedCols:Array.from(matched),freeTerms:Q.freeTerms(tree)}
};
Q.freeTerms=function(tree){
  const out=[];
  const walk=(nd,neg)=>{
    if(!nd)return;
    if(!isGroup(nd)){if(!neg&&nd.col==='*'&&nd.op==='contains')out.push(nd.value);return}
    if(nd.op==='not')walk(nd.child,!neg);else nd.children.forEach(c=>walk(c,neg))
  };
  walk(tree,false);
  return out
};
Q.pureFreeTerms=function(tree){
  if(!tree)return[];
  const leaves=!isGroup(tree)?[tree]:(tree.op==='and'&&tree.children.every(c=>!isGroup(c)))?tree.children:null;
  if(!leaves)return null;
  if(!leaves.every(l=>l.col==='*'&&l.op==='contains'&&!l.caseSensitive))return null;
  return leaves.map(l=>l.value)
};
Q.highlights=function(tree){
  const all=new Set(),byCol={};
  const walk=(nd,neg)=>{
    if(!nd)return;
    if(!isGroup(nd)){
      if(neg)return;
      const op=nd.op;
      if(op!=='contains'&&op!=='wholeWord'&&op!=='equals'&&op!=='startsWith'&&op!=='endsWith')return;
      const v=Q.norm(String(nd.value==null?'':nd.value).trim());
      if(!v)return;
      if(nd.col==='*'||nd.col==='@row')all.add(v);else(byCol[nd.col]||(byCol[nd.col]=new Set())).add(v);
      return
    }
    if(nd.op==='not')walk(nd.child,!neg);else nd.children.forEach(c=>walk(c,neg))
  };
  walk(tree,false);
  const sort=a=>Array.from(a).sort((x,y)=>y.length-x.length);
  const cols={};for(const k in byCol)cols[k]=sort(byCol[k]);
  return{all:sort(all),cols}
};
const p2=x=>String(x).padStart(2,'0');
const iso=(y,m,d)=>y+'-'+p2(m)+'-'+p2(d);
W.todayISO=function(ctx){
  if(ctx&&typeof ctx.today==='string'&&/^\d{4}-\d\d-\d\d$/.test(ctx.today))return ctx.today;
  const d=new Date();
  return iso(d.getFullYear(),d.getMonth()+1,d.getDate())
};
const shiftDays=(isoDate,k)=>{
  const [y,m,d]=isoDate.split('-').map(Number);
  const t=new Date(Date.UTC(y,m-1,d+k));
  return iso(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate())
};
const monthSpan=(y,m)=>iso(y,m,1)+'|'+iso(y,m,new Date(Date.UTC(y,m,0)).getUTCDate());
W.REL_DATE=[['thisMonth','this month'],['lastMonth','last month'],['thisYear','this year'],['lastDays','the last N days']];
W.REL_NUM=[['top','top N'],['bottom','bottom N'],['above','above average'],['below','below average']];
W.colFiltersTree=function(map,exclude){
  if(!map)return null;
  const kids=[];
  for(const k of Object.keys(map))if(k!==exclude&&map[k])kids.push(map[k]);
  return W.normTree({op:'and',children:kids})
};
W.hasRelative=function(node){return W.treeLeaves(node).some(l=>l.op==='relDate'||l.op==='relNum')};
function numbersOf(t,ci){
  const col=t.data[ci],sm=[];
  for(let r=0;r<t.n&&sm.length<300;r++){const v=String(col[r]==null?'':col[r]).trim();if(v)sm.push(v)}
  const locale=W.detectNumberLocale(sm);
  const out=[];
  for(let r=0;r<t.n;r++){const v=String(col[r]==null?'':col[r]).trim();if(!v)continue;const p=W.parseNumber(v,{locale});if(p)out.push(p.value)}
  return out
}
function resolveLeaf(t,l,ctx){
  if(l.op==='relDate'){
    const today=W.todayISO(ctx);const [y,m]=today.split('-').map(Number);
    let a,b;
    if(l.rel==='thisMonth')[a,b]=monthSpan(y,m).split('|');
    else if(l.rel==='lastMonth')[a,b]=(m===1?monthSpan(y-1,12):monthSpan(y,m-1)).split('|');
    else if(l.rel==='thisYear'){a=iso(y,1,1);b=iso(y,12,31)}
    else{const n=Math.max(1,Math.floor(Number(l.n)||1));a=shiftDays(today,-n);b=today}
    return{col:l.col,op:'between',value:a,value2:b,caseSensitive:false,fixedOn:today}
  }
  if(l.op==='relNum'){
    const ci=t.cols.indexOf(l.col);
    if(ci===-1)return l;
    const nums=numbersOf(t,ci),today=W.todayISO(ctx);
    if(!nums.length)return{col:l.col,op:'in',values:[],caseSensitive:false,fixedOn:today};
    if(l.rel==='above'||l.rel==='below'){
      const avg=nums.reduce((x,y)=>x+y,0)/nums.length;
      return{col:l.col,op:l.rel==='above'?'gt':'lt',value:W.canonicalNumber(avg),caseSensitive:false,fixedOn:today}
    }
    const n=Math.max(1,Math.floor(Number(l.n)||1));
    const sorted=nums.slice().sort((x,y)=>l.rel==='top'?y-x:x-y);
    const th=sorted[Math.min(n,sorted.length)-1];
    return{col:l.col,op:l.rel==='top'?'gte':'lte',value:W.canonicalNumber(th),caseSensitive:false,fixedOn:today}
  }
  return l
}
W.resolveRelative=function(node,t,ctx){
  if(!node)return null;
  if(!W.hasRelative(node))return node;
  return W.mapLeaves(node,l=>resolveLeaf(t,l,ctx||{}))
};
W.leafColumnOk=function(t,l){
  if(l.col==='@formula'){const c=W.F.compile(l.expr,t.cols);return!c.errors.length&&!c.missing.length}
  return l.col==='*'||l.col==='@row'||t.cols.indexOf(l.col)!==-1
};
})(typeof self!=='undefined'?self:globalThis);
