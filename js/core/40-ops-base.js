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
  const at=afterIdx==null||afterIdx<0?cols.length:afterIdx+1;
  cols.splice(at,0,nm);data.splice(at,0,values);
  return{table:{cols,data,n:t.n,rowIds:t.rowIds},name:nm,index:at}
};
W.allTouched=function(t,names){const m=new Map();for(const nm of names)m.set(nm,true);return m};

W.COND_OPS=[
  ['contains','contains','text'],['notContains','does not contain','text'],['equals','is','text'],['notEquals','is not','text'],
  ['startsWith','starts with','text'],['endsWith','ends with','text'],['matches','matches pattern','text'],
  ['isEmpty','is empty','none'],['isNotEmpty','is not empty','none'],
  ['gt','is greater than','cmp'],['gte','is at least','cmp'],['lt','is less than','cmp'],['lte','is at most','cmp'],['between','is between','range'],
  ['in','is one of','list']
];
W.COND_LABEL={};W.COND_OPS.forEach(o=>{W.COND_LABEL[o[0]]=o[1]});
W.COND_KIND={};W.COND_OPS.forEach(o=>{W.COND_KIND[o[0]]=o[2]});

W.describeCond=function(c){
  const col=c.col==='*'?'any column':'"'+c.col+'"';
  const k=W.COND_KIND[c.op];
  let s=col+' '+(W.COND_LABEL[c.op]||c.op);
  if(k==='text'||k==='cmp')s+=' '+(c.op==='matches'?'/'+c.value+'/':'"'+W.trunc(c.value,30)+'"');
  else if(k==='range')s+=' "'+c.value+'" and "'+c.value2+'"';
  else if(k==='list')s+=' ('+(c.values||[]).map(v=>'"'+W.trunc(v,16)+'"').join(', ')+')';
  return s
};
W.condToDsl=function(c){
  const col=c.col==='*'?'any column':q(c.col);
  const v=W.valDsl;
  let s;
  switch(c.op){
    case'contains':s=col+' contains '+v(c.value);break;
    case'notContains':s=col+' does not contain '+v(c.value);break;
    case'equals':s=col+' is '+v(c.value);break;
    case'notEquals':s=col+' is not '+v(c.value);break;
    case'startsWith':s=col+' starts with '+v(c.value);break;
    case'endsWith':s=col+' ends with '+v(c.value);break;
    case'matches':return col+' matches '+W.reDsl(c.value,c.caseSensitive);
    case'isEmpty':return col+' is empty';
    case'isNotEmpty':return col+' is not empty';
    case'gt':return col+' > '+v(c.value);
    case'gte':return col+' >= '+v(c.value);
    case'lt':return col+' < '+v(c.value);
    case'lte':return col+' <= '+v(c.value);
    case'between':return col+' between '+v(c.value)+' and '+v(c.value2);
    case'in':s=col+' in ('+(c.values||[]).map(v).join(', ')+')';break;
    default:throw new Error('Unknown condition '+c.op)
  }
  return s+(c.caseSensitive?' matchcase':'')
};
W.parseCond=function(cur){
  let col;
  if(cur.isWord('any')&&cur.isWord('column',1)){cur.i+=2;col='*'}
  else if(cur.isWord('*')){cur.i++;col='*'}
  else col=cur.str();
  const c={col,op:null,caseSensitive:false};
  const x=cur.peek();
  if(!x)throw new Error('The condition on '+(col==='*'?'any column':'"'+col+'"')+' is incomplete.');
  const w=x.t==='word'?x.v.toLowerCase():'';
  if(w==='contains'){cur.i++;c.op='contains';c.value=cur.val()}
  else if(w==='does'){cur.word('does','not','contain');c.op='notContains';c.value=cur.val()}
  else if(w==='starts'){cur.word('starts','with');c.op='startsWith';c.value=cur.val()}
  else if(w==='ends'){cur.word('ends','with');c.op='endsWith';c.value=cur.val()}
  else if(w==='matches'||w==='regex'){cur.i++;const r=cur.re();c.op='matches';c.value=r.src;c.caseSensitive=r.flags.indexOf('i')===-1;return c}
  else if(w==='is'){
    cur.i++;
    if(cur.optWord('empty')){c.op='isEmpty';return c}
    if(cur.isWord('not')){cur.i++;if(cur.optWord('empty')){c.op='isNotEmpty';return c}c.op='notEquals';c.value=cur.val()}
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
W.parseConds=function(cur){
  const conds=[W.parseCond(cur)];let match=null;
  while(!cur.done()){
    const j=cur.oneOf(['and','or']);
    const m=j==='and'?'all':'any';
    if(match&&match!==m)throw new Error('Use either "and" or "or" within one step. Add a second step for mixed logic.');
    match=m;
    conds.push(W.parseCond(cur))
  }
  return{conditions:conds,match:match||'all'}
};

W.compileConds=function(t,conds,ctx){
  ctx=ctx||{};
  const matchers=conds.map(c=>{
    const ci=c.col==='*'?-1:W.needCol(t,c.col);
    const cs=!!c.caseSensitive;
    const norm=cs?(s=>s):(s=>s.toLowerCase());
    const val=norm(String(c.value==null?'':c.value));
    const valT=val.trim();
    let test;
    switch(c.op){
      case'contains':test=s=>norm(s).indexOf(val)!==-1;break;
      case'notContains':test=s=>norm(s).indexOf(val)!==-1;break;
      case'equals':test=s=>{if(s.length<valT.length)return false;return norm(s.trim())===valT};break;
      case'notEquals':test=s=>{if(s.length<valT.length)return false;return norm(s.trim())===valT};break;
      case'startsWith':test=s=>norm(s.trim()).indexOf(val)===0;break;
      case'endsWith':test=s=>{const x=norm(s.trim());return x.length>=val.length&&x.slice(x.length-val.length)===val};break;
      case'matches':{const re=W.compileRegex(String(c.value||''),cs?'':'i');test=s=>re.test(s);break}
      case'isEmpty':test=s=>s.trim()==='';break;
      case'isNotEmpty':test=s=>s.trim()!=='';break;
      case'in':{const set=new Set((c.values||[]).map(v=>norm(String(v).trim())));test=s=>set.has(norm(s.trim()));break}
      case'gt':case'gte':case'lt':case'lte':case'between':{
        let type=ci===-1?'number':W.inferType(t.data[ci],t.n,ctx);
        const pa=W.parseNumber(c.value),da=W.parseDate(c.value,{order:ctx.dateOrder,yearPivot:ctx.yearPivot});
        if(type!=='date'&&!pa&&da)type='date';
        if(type==='text')type=pa?'number':(da?'date':'number');
        let locale='us';
        if(type==='number'&&ci!==-1){const sm=[];const col=t.data[ci];for(let r=0;r<t.n&&sm.length<250;r++)if(col[r]&&String(col[r]).trim())sm.push(col[r]);locale=W.detectNumberLocale(sm)}
        const key=type==='date'?(s=>W.dateKey(W.parseDate(s,{order:ctx.dateOrder,yearPivot:ctx.yearPivot}))):(s=>{const p=W.parseNumber(s,{locale});return p?p.value:NaN});
        const keyV=type==='date'?(s=>W.dateKey(W.parseDate(s,{order:ctx.dateOrder,yearPivot:ctx.yearPivot}))):(s=>{const p=W.parseNumber(s,{locale})||W.parseNumber(s);return p?p.value:NaN});
        const a=keyV(c.value),b=c.op==='between'?keyV(c.value2):NaN;
        if(Number.isNaN(a)||(c.op==='between'&&Number.isNaN(b)))throw new Error('"'+(Number.isNaN(a)?c.value:c.value2)+'" is not a '+(type==='date'?'date':'number')+', so it cannot be compared.');
        const lo=Math.min(a,isNaN(b)?a:b),hi=Math.max(a,isNaN(b)?a:b);
        test=s=>{const k=key(s);if(Number.isNaN(k))return false;return c.op==='gt'?k>a:c.op==='gte'?k>=a:c.op==='lt'?k<a:c.op==='lte'?k<=a:(k>=lo&&k<=hi)};
        break
      }
      default:throw new Error('Unknown condition "'+c.op+'".')
    }
    const neg=c.op==='notContains'||c.op==='notEquals';
    if(ci!==-1){const col=t.data[ci];return r=>{const h=test(col[r]==null?'':String(col[r]));return neg?!h:h}}
    const nc=t.cols.length;
    if(c.op==='isEmpty')return r=>{for(let k=0;k<nc;k++){const v=t.data[k][r];if(v!=null&&String(v).trim()!=='')return false}return true};
    return r=>{let any=false;for(let k=0;k<nc;k++){const v=t.data[k][r];if(test(v==null?'':String(v))){any=true;break}}return neg?!any:any}
  });
  return matchers
};
W.rowTester=function(t,cfg,ctx){
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
  validate(cfg){
    if(!cfg.conditions||!cfg.conditions.length)return'Add at least one condition.';
    for(const c of cfg.conditions){
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
    return verb+' rows where '+(cfg.conditions||[]).map(W.describeCond).join(cfg.match==='any'?' or ':' and ')
  },
  apply(t,cfg,ctx){
    const test=W.rowTester(t,cfg,ctx);
    const keep=[],want=cfg.mode==='keep';
    for(let r=0;r<t.n;r++)if(test(r)===want)keep.push(r);
    if(keep.length===t.n)return{table:t,stats:{removed:0}};
    return{table:W.pickRows(t,keep),stats:{removed:t.n-keep.length}}
  },
  toDsl:cfg=>(cfg.mode==='keep'?'keep':'remove')+' rows where '+cfg.conditions.map(W.condToDsl).join(cfg.match==='any'?' or ':' and '),
  dslPattern:/^((keep|remove) rows where\b|filter\b)/i,
  fromDsl(line){
    const cur=W.cursor(line);
    if(cur.isWord('filter')){
      cur.i++;
      if(cur.isWord('contains')){cur.i++;const v=cur.val();cur.end();return{mode:'keep',match:'all',conditions:[{col:'*',op:'contains',value:v,caseSensitive:false}]}}
      const m=cur.oneOf(['keep','drop','remove']);cur.word('where');
      const r=W.parseConds(cur);
      return{mode:m==='keep'?'keep':'remove',match:r.match,conditions:r.conditions}
    }
    const mode=cur.oneOf(['keep','remove']);cur.word('rows','where');
    const r=W.parseConds(cur);
    return{mode,match:r.match,conditions:r.conditions}
  },
  examples:[
    {cfg:{mode:'remove',match:'all',conditions:[{col:'status',op:'isEmpty',caseSensitive:false}]},input:{cols:['id','status'],rows:[['1','paid'],['2',''],['3','  ']]},expect:{cols:['id','status'],rows:[['1','paid']]}},
    {cfg:{mode:'keep',match:'all',conditions:[{col:'amount',op:'gt',value:'100',caseSensitive:false},{col:'region',op:'in',values:['EMEA','APAC'],caseSensitive:false}]},input:{cols:['amount','region'],rows:[['$1,200','emea'],['50','APAC'],['300','US']]},expect:{cols:['amount','region'],rows:[['$1,200','emea']]}},
    {cfg:{mode:'remove',match:'all',conditions:[{col:'*',op:'contains',value:'test',caseSensitive:false}]},input:{cols:['a','b'],rows:[['x','Test row'],['y','z']]},expect:{cols:['a','b'],rows:[['y','z']]}},
    {cfg:{mode:'keep',match:'all',conditions:[{col:'d',op:'between',value:'2025-01-01',value2:'2025-03-31',caseSensitive:false}]},input:{cols:['d'],rows:[['2025-02-10'],['2025-05-01'],['Jan 3, 2025']]},expect:{cols:['d'],rows:[['2025-02-10'],['Jan 3, 2025']]}},
    {cfg:{mode:'remove',match:'all',conditions:[{col:'notes',op:'matches',value:'^ref \\d+$',caseSensitive:false}]},input:{cols:['notes'],rows:[['REF 12'],['ref x']]},expect:{cols:['notes'],rows:[['ref x']]}}
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
