(function(G){
'use strict';
const W=G.WeftCore;
const q=W.q,cd=W.colsDsl;

W.defineOp=function(def){
  if(!def.id||!def.apply||!def.describe||!def.toDsl||!def.fromDsl||!def.dslPattern)throw new Error('Op '+def.id+' is incomplete');
  def.fields=def.fields||[];
  def.keywords=def.keywords||[];
  def.examples=def.examples||[];
  if(def.portable==null)def.portable=true;
  W.OPS[def.id]=def;
  if(W.OP_ORDER.indexOf(def.id)===-1)W.OP_ORDER.push(def.id)
};

W.keepSame=function(t,data,cols){return{cols:cols||t.cols,data,n:t.n,rowIds:t.rowIds}};
W.needCols=function(t,names){
  const miss=W.missingCols(t,names);
  if(miss.length)throw new Error(W.notFound(t,miss[0]))
};
W.needCol=function(t,name){
  const i=t.cols.indexOf(name);
  if(i===-1)throw new Error(W.notFound(t,name));
  return i
};
W.rewriteCells=function(t,cols,fn){
  const data=t.data.slice();
  let changed=0;const touched=new Map();
  for(const ci of cols){
    const src=t.data[ci];let out=null,set=null;
    for(let r=0;r<t.n;r++){
      const x=src[r];const v=x==null?'':(typeof x==='string'?x:String(x));
      const w=fn(v,r,ci);
      if(w!==v&&w!=null){if(!out)out=src.slice();out[r]=w;changed++;if(!set)set=new Set();set.add(r)}
    }
    if(out){data[ci]=out;touched.set(t.cols[ci],set)}
  }
  return{table:W.keepSame(t,data),stats:{changed},touched}
};
W.addColumnAt=function(t,name,values,afterIdx){
  const cols=t.cols.slice(),data=t.data.slice();
  let nm=name,k=2;while(cols.indexOf(nm)!==-1){nm=name+'_'+k;k++}
  const at=afterIdx==null?cols.length:afterIdx+1;
  cols.splice(at,0,nm);data.splice(at,0,values);
  return{table:{cols,data,n:t.n,rowIds:t.rowIds},name:nm,index:at}
};
W.allTouched=function(t,names){const m=new Map();for(const nm of names)m.set(nm,true);return m};

W.COND_OPS=[
  ['contains','contains','text'],['notContains','does not contain','text'],['equals','is','text'],['notEquals','is not','text'],
  ['startsWith','starts with','text'],['endsWith','ends with','text'],['matches','matches pattern','text'],
  ['isEmpty','is empty','none'],['isNotEmpty','is not empty','none'],
  ['gt','is greater than','cmp'],['gte','is at least','cmp'],['lt','is less than','cmp'],['lte','is at most','cmp'],['between','is between','range'],
  ['in','is one of','list'],['wholeWord','contains the word','text'],['eq','is equal to','cmp'],['ne','is not equal to','cmp']
];
W.COND_LABEL={};W.COND_OPS.forEach(o=>{W.COND_LABEL[o[0]]=o[1]});
W.COND_KIND={};W.COND_OPS.forEach(o=>{W.COND_KIND[o[0]]=o[2]});
W.COND_KIND.formula='formula';

W.describeCond=function(c){
  if(c.col==='@formula')return'formula '+W.trunc(String(c.expr||''),70);
  const col=c.col==='*'?'any column':c.col==='@row'?'row text':'"'+c.col+'"';
  const k=W.COND_KIND[c.op];
  let s=col+' '+(W.COND_LABEL[c.op]||c.op);
  if(k==='text'||k==='cmp')s+=' '+(c.op==='matches'?'/'+c.value+'/':'"'+W.trunc(c.value,30)+'"');
  else if(k==='range')s+=' "'+c.value+'" and "'+c.value2+'"';
  else if(k==='list')s+=' ('+(c.values||[]).map(v=>'"'+W.trunc(v,16)+'"').join(', ')+')';
  if(c.fixedOn)s+=' (fixed on '+c.fixedOn+')';
  return s
};
W.condToDsl=function(c){
  const col=c.col==='*'?'any column':c.col==='@row'?'row text':q(c.col);
  const v=W.valDsl;
  let s;
  switch(c.op){
    case'contains':s=col+' contains '+v(c.value);break;
    case'notContains':s=col+' does not contain '+v(c.value);break;
    case'equals':s=col+' is '+v(c.value);break;
    case'notEquals':s=col+' is not '+v(c.value);break;
    case'startsWith':s=col+' starts with '+v(c.value);break;
    case'endsWith':s=col+' ends with '+v(c.value);break;
    case'formula':return'formula '+String(c.expr||'').trim();
    case'matches':return col+' matches '+W.reDsl(c.value,c.caseSensitive);
    case'isEmpty':return col+' is empty';
    case'isNotEmpty':return col+' is not empty';
    case'gt':return col+' > '+v(c.value);
    case'gte':return col+' >= '+v(c.value);
    case'lt':return col+' < '+v(c.value);
    case'lte':return col+' <= '+v(c.value);
    case'between':return col+' between '+v(c.value)+' and '+v(c.value2);
    case'eq':return col+' is equal to '+v(c.value);
    case'ne':return col+' is not equal to '+v(c.value);
    case'wholeWord':s=col+' has word '+v(c.value);break;
    case'in':s=col+' in ('+(c.values||[]).map(v).join(', ')+')';break;
    default:throw new Error('Unknown condition '+c.op)
  }
  return s+(c.caseSensitive?' matchcase':'')
};
W.parseCond=function(cur){
  const fx=cur.peek();
  if(fx&&fx.t==='formula'){cur.i++;return{col:'@formula',op:'formula',expr:fx.v,caseSensitive:false}}
  let col;
  if(cur.isWord('any')&&cur.isWord('column',1)){cur.i+=2;col='*'}
  else if(cur.isWord('*')){cur.i++;col='*'}
  else if(cur.isWord('row')&&cur.isWord('text',1)){cur.i+=2;col='@row'}
  else col=cur.str();
  const c={col,op:null,caseSensitive:false};
  const x=cur.peek();
  if(!x)throw new Error('The condition on '+(col==='*'?'any column':'"'+col+'"')+' is incomplete.');
  const w=x.t==='word'?x.v.toLowerCase():'';
  if(w==='contains'){cur.i++;c.op='contains';c.value=cur.val()}
  else if(w==='does'){cur.word('does','not','contain');c.op='notContains';c.value=cur.val()}
  else if(w==='has'){cur.word('has','word');c.op='wholeWord';c.value=cur.val()}
  else if(w==='starts'){cur.word('starts','with');c.op='startsWith';c.value=cur.val()}
  else if(w==='ends'){cur.word('ends','with');c.op='endsWith';c.value=cur.val()}
  else if(w==='matches'||w==='regex'){cur.i++;const r=cur.re();c.op='matches';c.value=r.src;c.caseSensitive=r.flags.indexOf('i')===-1;return c}
  else if(w==='is'){
    cur.i++;
    if(cur.optWord('empty')){c.op='isEmpty';return c}
    if(cur.isWord('equal')){cur.i++;cur.word('to');c.op='eq';c.value=cur.val();return c}
    if(cur.isWord('not')){cur.i++;if(cur.optWord('empty')){c.op='isNotEmpty';return c}if(cur.isWord('equal')){cur.i++;cur.word('to');c.op='ne';c.value=cur.val();return c}c.op='notEquals';c.value=cur.val()}
    else if(cur.isWord('one')&&cur.isWord('of',1)){cur.i+=2;c.op='in';c.values=parseList(cur)}
    else{c.op='equals';c.value=cur.val()}
  }
  else if(w==='='||w==='=='){cur.i++;c.op='equals';c.value=cur.val()}
  else if(w==='!='||w==='<>'){cur.i++;c.op='notEquals';c.value=cur.val()}
  else if(w==='>'){cur.i++;c.op='gt';c.value=cur.val();return c}
  else if(w==='>='){cur.i++;c.op='gte';c.value=cur.val();return c}
  else if(w==='<'){cur.i++;c.op='lt';c.value=cur.val();return c}
  else if(w==='<='){cur.i++;c.op='lte';c.value=cur.val();return c}
  else if(w==='before'){cur.i++;c.op='lt';c.value=cur.val();return c}
  else if(w==='after'){cur.i++;c.op='gt';c.value=cur.val();return c}
  else if(w==='between'){cur.i++;c.op='between';c.value=cur.val();if(!cur.optWord('and'))cur.word('to');c.value2=cur.val();cur.optWord('matchcase');return c}
  else if(w==='in'){cur.i++;c.op='in';c.values=parseList(cur)}
  else throw new Error('Unknown comparison'+cur.near()+'. Use contains, is, starts with, >, between, in (…) or matches /…/.');
  if(cur.optWord('matchcase'))c.caseSensitive=true;
  return c
};
function parseList(cur){
  if(cur.optP('(')){const out=[cur.val()];while(cur.optP(','))out.push(cur.val());cur.p(')');return out}
  const out=[cur.val()];while(cur.optP(','))out.push(cur.val());return out
}
function parseUnit(cur,depth){
  if(depth>32)throw new Error('These conditions are nested too deeply.');
  if(cur.isWord('not')){cur.i++;return{op:'not',child:parseUnit(cur,depth+1)}}
  if(cur.optP('(')){const n=parseChain(cur,depth+1);cur.p(')');return n}
  return W.parseCond(cur)
}
function parseChain(cur,depth){
  const kids=[parseUnit(cur,depth)];let op=null;
  while(!cur.done()&&!cur.isP(')')){
    const j=cur.oneOf(['and','or']);
    if(op&&op!==j)throw new Error('Use either "and" or "or" at one level. Put parentheses around one part to mix them.');
    op=j;
    kids.push(parseUnit(cur,depth))
  }
  return kids.length===1?kids[0]:{op,children:kids}
}
W.parseConds=function(cur){
  const node=W.normTree(parseChain(cur,0));
  return W.treeToParts(node)
};

const WORD_CH='[\\p{L}\\p{N}_]';
function wholeWordTest(val,cs){
  const src='(?<!'+WORD_CH+')'+val.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?!'+WORD_CH+')';
  const re=new RegExp(src,'u');
  return cs?(s=>re.test(s)):(s=>re.test(W.Q.norm(s)))
}
function cmpPlan(t,ci,c,ctx){
  let type=ci===-1?'number':W.inferType(t.data[ci],t.n,ctx);
  const ord={order:ctx.dateOrder,yearPivot:ctx.yearPivot};
  const pa=W.parseNumber(c.value),da=W.parseDate(c.value,ord);
  if(type!=='date'&&!pa&&da)type='date';
  if(type==='text')type=pa?'number':(da?'date':'number');
  let locale='us';
  if(type==='number'&&ci!==-1){const sm=[];const col=t.data[ci];for(let r=0;r<t.n&&sm.length<250;r++)if(col[r]&&String(col[r]).trim())sm.push(col[r]);locale=W.detectNumberLocale(sm)}
  const key=type==='date'?(s=>W.dateKey(W.parseDate(s,ord))):(s=>{const p=W.parseNumber(s,{locale});return p?p.value:NaN});
  const keyV=type==='date'?(s=>W.dateKey(W.parseDate(s,ord))):(s=>{const p=W.parseNumber(s,{locale})||W.parseNumber(s);return p?p.value:NaN});
  const a=keyV(c.value),b=c.op==='between'?keyV(c.value2):NaN;
  if(Number.isNaN(a)||(c.op==='between'&&Number.isNaN(b)))return{error:new Error('"'+(Number.isNaN(a)?c.value:c.value2)+'" is not a '+(type==='date'?'date':'number')+', so it cannot be compared.')};
  const lo=Math.min(a,isNaN(b)?a:b),hi=Math.max(a,isNaN(b)?a:b),op=c.op;
  return{test:s=>{const k=key(s);if(Number.isNaN(k))return op==='ne';return op==='gt'?k>a:op==='gte'?k>=a:op==='lt'?k<a:op==='lte'?k<=a:op==='eq'?k===a:op==='ne'?k!==a:(k>=lo&&k<=hi)}}
}
const CMP_OPS=new Set(['gt','gte','lt','lte','between','eq','ne']);
W.compileLeaf=function(t,c,ctx){
  ctx=ctx||{};
  if(c.col==='@formula'){
    const comp=W.F.forTable(t,c.expr,ctx);
    if(comp.errors.length)throw new Error(comp.errors[0].message);
    if(comp.missing.length)throw new Error(W.notFound(t,comp.missing[0]));
    const D=t.data,f=comp.test;
    return{mode:'fn',test:r=>f(D,r),neg:false}
  }
  const ci=c.col==='*'||c.col==='@row'?-1:W.needCol(t,c.col);
  const cs=!!c.caseSensitive;
  const norm=cs?(s=>s):W.Q.norm;
  const val=norm(String(c.value==null?'':c.value));
  const valT=val.trim();
  let test,neg=false;
  if(CMP_OPS.has(c.op)){
    const eqOp=c.op==='eq'||c.op==='ne';
    const textFallback=()=>W.compileLeaf(t,Object.assign({},c,{op:c.op==='eq'?'equals':'notEquals'}),ctx);
    if(c.col==='*'){
      const plan=Object.assign({},c,{op:c.op==='ne'?'eq':c.op});
      const tests=[];let firstErr=null;
      for(let k=0;k<t.cols.length;k++){const pl=cmpPlan(t,k,plan,ctx);if(pl.test)tests.push({k,f:pl.test});else if(!firstErr)firstErr=pl.error}
      if(!tests.length){if(eqOp)return textFallback();if(firstErr)throw firstErr}
      return{mode:'anyCmp',tests,neg:c.op==='ne'}
    }
    const pl=cmpPlan(t,ci,c,ctx);
    if(pl.error){if(eqOp)return textFallback();throw pl.error}
    return{mode:ci===-1?'row':'col',ci,test:pl.test,neg:false}
  }
  switch(c.op){
    case'contains':test=s=>norm(s).indexOf(val)!==-1;break;
    case'notContains':test=s=>norm(s).indexOf(val)!==-1;neg=true;break;
    case'wholeWord':test=wholeWordTest(cs?String(c.value==null?'':c.value):val,cs);break;
    case'equals':test=s=>{if(s.length<valT.length)return false;return norm(s.trim())===valT};break;
    case'notEquals':test=s=>{if(s.length<valT.length)return false;return norm(s.trim())===valT};neg=true;break;
    case'startsWith':test=s=>norm(s.trim()).indexOf(val)===0;break;
    case'endsWith':test=s=>{const x=norm(s.trim());return x.length>=val.length&&x.slice(x.length-val.length)===val};break;
    case'matches':{const re=W.compileRegex(String(c.value||''),cs?'':'i');test=s=>re.test(s);break}
    case'isEmpty':test=s=>s.trim()==='';break;
    case'isNotEmpty':test=s=>s.trim()!=='';break;
    case'in':{const set=new Set((c.values||[]).map(v=>norm(String(v).trim())));test=s=>set.has(norm(s.trim()));break}
    default:throw new Error('Unknown condition "'+c.op+'".')
  }
  if(ci!==-1)return{mode:'col',ci,test,neg};
  if(c.col==='@row')return{mode:'row',test,neg};
  return{mode:c.op==='isEmpty'?'allEmpty':'any',test,neg}
};
W.leafMatcher=function(t,L){
  const nc=t.cols.length,data=t.data;
  if(L.mode==='fn')return L.test;
  if(L.mode==='col'){const col=data[L.ci],f=L.test;return L.neg?(r=>!f(col[r]==null?'':String(col[r]))):(r=>f(col[r]==null?'':String(col[r])))}
  if(L.mode==='row'){const f=L.test,neg=L.neg;return r=>{const a=[];for(let k=0;k<nc;k++){const v=data[k][r];const x=v==null?'':String(v).trim();if(x)a.push(x)}const h=f(a.join(' '));return neg?!h:h}}
  if(L.mode==='allEmpty')return r=>{for(let k=0;k<nc;k++){const v=data[k][r];if(v!=null&&String(v).trim()!=='')return false}return true};
  if(L.mode==='anyCmp'){const tests=L.tests,nt=tests.length,neg=L.neg;return r=>{let any=false;for(let j=0;j<nt;j++){const v=data[tests[j].k][r];if(tests[j].f(v==null?'':String(v))){any=true;break}}return neg?!any:any}}
  const f=L.test,neg=L.neg;
  return r=>{let any=false;for(let k=0;k<nc;k++){const v=data[k][r];if(f(v==null?'':String(v))){any=true;break}}return neg?!any:any}
};
W.compileConds=function(t,conds,ctx){
  return conds.map(c=>W.leafMatcher(t,W.compileLeaf(t,c,ctx)))
};
W.rowTester=function(t,cfg,ctx){
  if(cfg.tree)return W.treeTester(t,cfg.tree,ctx);
  const ms=W.compileConds(t,cfg.conditions||[],ctx);
  if(!ms.length)return()=>true;
  if((cfg.match||'all')==='all')return r=>{for(const m of ms)if(!m(r))return false;return true};
  return r=>{for(const m of ms)if(m(r))return true;return false}
};

W.defineOp({
  id:'filterRows',label:'Keep or remove rows where…',category:'remove',
  keywords:['filter','where','delete','remove','keep','drop','condition','rows','match'],
  fields:[{key:'filter',type:'conditions',label:'Conditions'}],
  defaults:(s,x)=>({mode:(x&&x.mode)||'remove',match:'all',conditions:[{col:(x&&x.col)||s.cols[0]||'*',op:(x&&x.op)||'isEmpty',value:'',caseSensitive:false}]}),
  validate(cfg,s){
    const leaves=W.cfgLeaves(cfg);
    if(!leaves.length)return'Add at least one condition.';
    for(const c of leaves){
      if(c.col==='@formula'){
        const expr=String(c.expr||'');
        if(!expr.trim())return'Enter a formula, for example [Amount] > [Budget].';
        if(/[\r\n]/.test(expr))return'A formula must stay on one line.';
        const ck=W.F.check(expr,W.F.colNames(s));
        if(ck.errors.length)return ck.errors[0].message;
        if(ck.missing.length)return'Column "'+ck.missing[0]+'" not found.';
        continue
      }
      const k=W.COND_KIND[c.op];
      if(!k)return'Pick a comparison for every condition.';
      if((k==='text'||k==='cmp')&&(c.value==null||c.value===''))return'Enter a value for "'+(c.col==='*'?'any column':c.col)+' '+W.COND_LABEL[c.op]+'".';
      if(k==='range'&&(!c.value||!c.value2))return'Enter both ends of the range.';
      if(k==='list'&&(!c.values||!c.values.length))return'Enter at least one value in the list.';
      if(c.op==='matches'&&W.isUnsafeRegexSource(c.value))return'That pattern is too long or could freeze the page. Simplify it.'
    }
    return null
  },
  describe(cfg){
    const verb=cfg.mode==='keep'?'Keep':'Remove';
    if(cfg.tree)return verb+' rows where '+W.describeTree(cfg.tree);
    return verb+' rows where '+(cfg.conditions||[]).map(W.describeCond).join(cfg.match==='any'?' or ':' and ')
  },
  apply(t,cfg,ctx){
    const test=W.rowTester(t,cfg,ctx);
    const keep=[],want=cfg.mode==='keep';
    for(let r=0;r<t.n;r++)if(test(r)===want)keep.push(r);
    if(keep.length===t.n)return{table:t,stats:{removed:0}};
    return{table:W.pickRows(t,keep),stats:{removed:t.n-keep.length}}
  },
  toDsl:cfg=>(cfg.mode==='keep'?'keep':'remove')+' rows where '+(cfg.tree?W.treeToDsl(cfg.tree):cfg.conditions.map(W.condToDsl).join(cfg.match==='any'?' or ':' and ')),
  dslPattern:/^((keep|remove) rows where\b|filter\b)/i,
  fromDsl(line){
    const cur=W.cursor(line);
    if(cur.isWord('filter')){
      cur.i++;
      if(cur.isWord('contains')){cur.i++;const v=cur.val();cur.end();return{mode:'keep',match:'all',conditions:[{col:'*',op:'contains',value:v,caseSensitive:false}]}}
      const m=cur.oneOf(['keep','drop','remove']);cur.word('where');
      return Object.assign({mode:m==='keep'?'keep':'remove'},W.parseConds(cur))
    }
    const mode=cur.oneOf(['keep','remove']);cur.word('rows','where');
    return Object.assign({mode},W.parseConds(cur))
  },
  examples:[
    {cfg:{mode:'remove',match:'all',conditions:[{col:'status',op:'isEmpty',caseSensitive:false}]},input:{cols:['id','status'],rows:[['1','paid'],['2',''],['3','  ']]},expect:{cols:['id','status'],rows:[['1','paid']]}},
    {cfg:{mode:'keep',match:'all',conditions:[{col:'amount',op:'gt',value:'100',caseSensitive:false},{col:'region',op:'in',values:['EMEA','APAC'],caseSensitive:false}]},input:{cols:['amount','region'],rows:[['$1,200','emea'],['50','APAC'],['300','US']]},expect:{cols:['amount','region'],rows:[['$1,200','emea']]}},
    {cfg:{mode:'remove',match:'all',conditions:[{col:'*',op:'contains',value:'test',caseSensitive:false}]},input:{cols:['a','b'],rows:[['x','Test row'],['y','z']]},expect:{cols:['a','b'],rows:[['y','z']]}},
    {cfg:{mode:'keep',match:'all',conditions:[{col:'d',op:'between',value:'2025-01-01',value2:'2025-03-31',caseSensitive:false}]},input:{cols:['d'],rows:[['2025-02-10'],['2025-05-01'],['Jan 3, 2025']]},expect:{cols:['d'],rows:[['2025-02-10'],['Jan 3, 2025']]}},
    {cfg:{mode:'remove',match:'all',conditions:[{col:'notes',op:'matches',value:'^ref \\d+$',caseSensitive:false}]},input:{cols:['notes'],rows:[['REF 12'],['ref x']]},expect:{cols:['notes'],rows:[['ref x']]}},
    {cfg:{mode:'remove',match:'all',conditions:[{col:'@row',op:'matches',value:'^page \\d+$',caseSensitive:false}]},input:{cols:['a','b'],rows:[['Page','2'],['x','y']]},expect:{cols:['a','b'],rows:[['x','y']]}},
    {cfg:{mode:'keep',tree:{op:'and',children:[{op:'or',children:[{col:'status',op:'equals',value:'paid',caseSensitive:false},{col:'status',op:'equals',value:'pending',caseSensitive:false}]},{op:'not',child:{col:'amount',op:'lt',value:'100',caseSensitive:false}}]}},input:{cols:['status','amount'],rows:[['Paid','500'],['pending','20'],['late','900'],['PENDING','100']]},expect:{cols:['status','amount'],rows:[['Paid','500'],['PENDING','100']]}},
    {cfg:{mode:'remove',match:'all',conditions:[{col:'notes',op:'wholeWord',value:'test',caseSensitive:false}]},input:{cols:['notes'],rows:[['a Test run'],['testing'],['contest'],['test']]},expect:{cols:['notes'],rows:[['testing'],['contest']]}},
    {cfg:{mode:'keep',match:'all',conditions:[{col:'n',op:'eq',value:'5',caseSensitive:false}]},input:{cols:['n'],rows:[['5.0'],['5'],['6'],['five']]},expect:{cols:['n'],rows:[['5.0'],['5']]}},
    {cfg:{mode:'remove',tree:{op:'not',child:{col:'*',op:'contains',value:'x',caseSensitive:false}}},input:{cols:['a','b'],rows:[['x','1'],['2','3']]},expect:{cols:['a','b'],rows:[['x','1']]}}
  ]
});

function idsCfgDescribe(verb,cfg){
  const n=(cfg.rowIds||[]).length;
  if(cfg.mode==='allExcept')return verb+' all rows except '+W.plural(n,'selected row');
  return verb+' '+W.plural(n,'selected row')+(cfg.note?' ('+cfg.note+')':'')
}
function applyIds(t,cfg,removing){
  const set=new Set(cfg.rowIds||[]);
  const inverse=cfg.mode==='allExcept';
  const keep=[];
  for(let r=0;r<t.n;r++){
    const hit=set.has(t.rowIds[r]);
    const selected=inverse?!hit:hit;
    if(removing?!selected:selected)keep.push(r)
  }
  const missing=inverse?0:(()=>{let k=0;const have=new Set(t.rowIds);for(const id of set)if(!have.has(id))k++;return k})();
  const out={table:keep.length===t.n?t:W.pickRows(t,keep),stats:{removed:t.n-keep.length}};
  if(missing)out.warning=W.plural(missing,'row')+' this step refers to no longer exist here, so they were skipped.';
  return out
}
W.defineOp({
  id:'removeRowIds',label:'Delete selected rows',category:'manual',portable:false,
  keywords:['delete','remove','rows','selected','manual'],
  defaults:()=>({rowIds:[],mode:'ids'}),
  validate:cfg=>(cfg.rowIds&&cfg.rowIds.length)||cfg.mode==='allExcept'?null:'Select one or more rows first.',
  describe:cfg=>idsCfgDescribe('Delete',cfg),
  apply:(t,cfg)=>applyIds(t,cfg,true),
  toDsl:cfg=>'@remove-rows '+JSON.stringify(cfg.mode==='allExcept'?{mode:'allExcept',rowIds:cfg.rowIds}:{rowIds:cfg.rowIds}),
  dslPattern:/^(@remove-rows\b|drop rows\s+\d)/i,
  fromDsl(line){
    if(/^drop rows/i.test(line)){return{rowIds:line.replace(/^drop rows\s*/i,'').split(',').map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n)),mode:'ids'}}
    const o=W.jsonDirective(line,'@remove-rows');
    if(!Array.isArray(o.rowIds))throw new Error('@remove-rows needs a "rowIds" list.');
    return{rowIds:o.rowIds.map(Number),mode:o.mode==='allExcept'?'allExcept':'ids'}
  },
  examples:[
    {cfg:{rowIds:[1],mode:'ids'},input:{cols:['a'],rows:[['x'],['y'],['z']]},expect:{cols:['a'],rows:[['x'],['z']]}},
    {cfg:{rowIds:[0],mode:'allExcept'},input:{cols:['a'],rows:[['x'],['y']]},expect:{cols:['a'],rows:[['x']]}},
    {cfg:{rowIds:[5],mode:'ids'},input:{cols:['a'],rows:[]},expect:{cols:['a'],rows:[]}}
  ]
});
W.defineOp({
  id:'keepRowIds',label:'Keep only selected rows',category:'manual',portable:false,
  keywords:['keep','only','rows','selected','manual'],
  defaults:()=>({rowIds:[],mode:'ids'}),
  validate:cfg=>(cfg.rowIds&&cfg.rowIds.length)||cfg.mode==='allExcept'?null:'Select one or more rows first.',
  describe:cfg=>idsCfgDescribe('Keep only',cfg),
  apply:(t,cfg)=>applyIds(t,cfg,false),
  toDsl:cfg=>'@keep-rows '+JSON.stringify(cfg.mode==='allExcept'?{mode:'allExcept',rowIds:cfg.rowIds}:{rowIds:cfg.rowIds}),
  dslPattern:/^(@keep-rows\b|keep rows\s+\d)/i,
  fromDsl(line){
    if(/^keep rows/i.test(line)){return{rowIds:line.replace(/^keep rows\s*/i,'').split(',').map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n)),mode:'ids'}}
    const o=W.jsonDirective(line,'@keep-rows');
    if(!Array.isArray(o.rowIds))throw new Error('@keep-rows needs a "rowIds" list.');
    return{rowIds:o.rowIds.map(Number),mode:o.mode==='allExcept'?'allExcept':'ids'}
  },
  examples:[
    {cfg:{rowIds:[0,2],mode:'ids'},input:{cols:['a'],rows:[['x'],['y'],['z']]},expect:{cols:['a'],rows:[['x'],['z']]}},
    {cfg:{rowIds:[1],mode:'allExcept'},input:{cols:['a'],rows:[['x'],['y']]},expect:{cols:['a'],rows:[['x']]}}
  ]
});

W.defineOp({
  id:'cellOverride',label:'Edit cells',category:'manual',portable:false,
  keywords:['edit','cell','override','manual','clear'],
  defaults:s=>({column:s.cols[0],overrides:[]}),
  describe:cfg=>{
    const n=cfg.overrides.length;
    if(n&&cfg.overrides.every(o=>o.value===''))return'Clear '+W.plural(n,'cell')+' in "'+cfg.column+'"';
    return'Edit '+W.plural(n,'cell')+' in "'+cfg.column+'"'
  },
  apply(t,cfg){
    const ci=W.needCol(t,cfg.column);
    const pos=new Map();for(let r=0;r<t.n;r++)pos.set(t.rowIds[r],r);
    const data=W.cow(t,[ci]);let changed=0,missing=0;const set=new Set();
    for(const o of cfg.overrides){const r=pos.get(o.rowId);if(r===undefined){missing++;continue}if(data[ci][r]!==o.value){data[ci][r]=o.value;changed++;set.add(r)}}
    const out={table:W.keepSame(t,data),stats:{changed},touched:new Map([[cfg.column,set]])};
    if(missing)out.warning=W.plural(missing,'edited cell')+' belong to rows removed earlier, so they were skipped.';
    return out
  },
  toDsl:cfg=>'@override '+JSON.stringify({column:cfg.column,overrides:cfg.overrides}),
  dslPattern:/^@override\b/i,
  fromDsl(line){const o=W.jsonDirective(line,'@override');if(typeof o.column!=='string'||!Array.isArray(o.overrides))throw new Error('@override needs "column" and "overrides".');return{column:o.column,overrides:o.overrides.map(x=>({rowId:Number(x.rowId),value:String(x.value==null?'':x.value)}))}},
  examples:[
    {cfg:{column:'a',overrides:[{rowId:1,value:'Z'}]},input:{cols:['a'],rows:[['x'],['y']]},expect:{cols:['a'],rows:[['x'],['Z']]}},
    {cfg:{column:'a',overrides:[{rowId:0,value:''}]},input:{cols:['a','b'],rows:[['é','1']]},expect:{cols:['a','b'],rows:[['','1']]}}
  ]
});

W.defineOp({
  id:'infer',label:'Change by example',category:'rewrite',
  keywords:['example','infer','halo','pattern'],
  defaults:s=>({column:s.cols[0],candidate:{type:'trim',params:{}}}),
  describe:cfg=>W.describeCandidate(cfg.candidate)+' in "'+cfg.column+'"',
  apply(t,cfg){
    const ci=W.needCol(t,cfg.column);
    return W.rewriteCells(t,[ci],v=>{if(v==='')return v;let o;try{o=W.applyCandidate(cfg.candidate,v)}catch(e){o=null}return o==null?v:o})
  },
  toDsl:cfg=>'@infer '+JSON.stringify({column:cfg.column,candidate:cfg.candidate}),
  dslPattern:/^@infer\b/i,
  fromDsl(line){const o=W.jsonDirective(line,'@infer');if(typeof o.column!=='string'||!o.candidate)throw new Error('@infer needs "column" and "candidate".');return{column:o.column,candidate:o.candidate}},
  examples:[
    {cfg:{column:'a',candidate:{type:'case',params:{mode:'upper'}}},input:{cols:['a'],rows:[['ab'],['']]},expect:{cols:['a'],rows:[['AB'],['']]}},
    {cfg:{column:'a',candidate:{type:'removePrefix',params:{prefix:'ID-'}}},input:{cols:['a'],rows:[['ID-7'],['8']]},expect:{cols:['a'],rows:[['7'],['8']]}}
  ]
});
})(typeof self!=='undefined'?self:globalThis);
