(function(G){
'use strict';
const W=G.WeftCore;
const q=W.q,cd=W.colsDsl;
const colsText=c=>(!c||!c.length||c[0]==='*')?'all columns':c.map(x=>'"'+x+'"').join(', ');

W.defineOp({
  id:'dropEmptyRows',label:'Remove empty rows',category:'remove',
  keywords:['empty','blank','rows','remove','drop','delete'],
  fields:[{key:'columns',type:'columns',label:'Empty across',allowAll:true}],
  defaults:()=>({columns:['*']}),
  describe:cfg=>'Remove rows that are empty in '+colsText(cfg.columns),
  apply(t,cfg){
    W.needCols(t,cfg.columns);
    const idx=W.resolveCols(t,cfg.columns);const keep=[];
    for(let r=0;r<t.n;r++){let empty=true;for(const c of idx){const v=t.data[c][r];if(v!=null&&String(v).trim()!==''){empty=false;break}}if(!empty)keep.push(r)}
    return keep.length===t.n?{table:t,stats:{removed:0}}:{table:W.pickRows(t,keep),stats:{removed:t.n-keep.length}}
  },
  toDsl:cfg=>'remove empty rows'+(cfg.columns&&cfg.columns[0]!=='*'?' in '+cd(cfg.columns):''),
  dslPattern:/^(remove|drop) empty rows\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.oneOf(['remove','drop']);cur.word('empty','rows');let columns=['*'];if(cur.optWord('in'))columns=cur.cols();cur.end();return{columns}},
  examples:[
    {cfg:{columns:['*']},input:{cols:['a','b'],rows:[['',' '],['x',''],['','']]},expect:{cols:['a','b'],rows:[['x','']]}},
    {cfg:{columns:['b']},input:{cols:['a','b'],rows:[['x',''],['y','1']]},expect:{cols:['a','b'],rows:[['y','1']]}}
  ]
});

W.defineOp({
  id:'dedupe',label:'Remove duplicate rows',category:'remove',
  keywords:['duplicate','duplicates','dedupe','unique','distinct','repeated','same'],
  fields:[{key:'on',type:'columns',label:'Compare on',allowAll:true},{key:'ignoreCase',type:'checkbox',label:'Ignore case and extra spaces'},{key:'keep',type:'select',label:'Keep',options:[['first','the first copy'],['last','the last copy']]}],
  defaults:(s,x)=>({on:x&&x.cols&&x.cols.length?x.cols:['*'],ignoreCase:false,keep:'first'}),
  describe:cfg=>'Remove duplicate rows'+(cfg.on&&cfg.on[0]!=='*'?' by '+colsText(cfg.on):'')+(cfg.ignoreCase?', ignoring case':'')+(cfg.keep==='last'?', keeping the last copy':''),
  apply(t,cfg){
    W.needCols(t,cfg.on);
    const idx=W.resolveCols(t,cfg.on);const seen=new Set();const keepSet=[];
    const norm=cfg.ignoreCase?(v=>String(v==null?'':v).trim().replace(/\s+/g,' ').toLowerCase()):(v=>String(v==null?'':v));
    const order=cfg.keep==='last'?W.identity(t.n).reverse():W.identity(t.n);
    for(const r of order){const k=idx.map(c=>norm(t.data[c][r])).join('\u0001');if(!seen.has(k)){seen.add(k);keepSet.push(r)}}
    if(cfg.keep==='last')keepSet.sort((a,b)=>a-b);
    return keepSet.length===t.n?{table:t,stats:{removed:0}}:{table:W.pickRows(t,keepSet),stats:{removed:t.n-keepSet.length}}
  },
  toDsl:cfg=>'remove duplicates'+(cfg.on&&cfg.on[0]!=='*'?' by '+cd(cfg.on):'')+(cfg.ignoreCase?' ignore case':'')+(cfg.keep==='last'?' keep last':''),
  dslPattern:/^(remove duplicates|dedupe)\b/i,
  fromDsl(line){
    const cur=W.cursor(line);
    const cfg={on:['*'],ignoreCase:false,keep:'first'};
    if(cur.optWord('dedupe')){if(cur.optWord('on'))cfg.on=cur.cols()}
    else{cur.word('remove','duplicates');if(cur.optWord('by'))cfg.on=cur.cols()}
    while(!cur.done()){if(cur.optWord('ignore')){cur.word('case');cfg.ignoreCase=true}else{cur.word('keep');cfg.keep=cur.oneOf(['first','last'])}}
    return cfg
  },
  examples:[
    {cfg:{on:['*'],ignoreCase:false,keep:'first'},input:{cols:['a','b'],rows:[['1','x'],['1','x'],['1','y']]},expect:{cols:['a','b'],rows:[['1','x'],['1','y']]}},
    {cfg:{on:['email'],ignoreCase:true,keep:'last'},input:{cols:['email','n'],rows:[['A@x.com','1'],['a@x.com ','2']]},expect:{cols:['email','n'],rows:[['a@x.com ','2']]}}
  ]
});

W.defineOp({
  id:'skipRows',label:'Remove top or bottom rows',category:'remove',
  keywords:['skip','top','bottom','first','last','rows','title','footer','header'],
  fields:[{key:'top',type:'number',label:'Rows to remove from the top'},{key:'bottom',type:'number',label:'Rows to remove from the bottom'}],
  defaults:()=>({top:1,bottom:0}),
  validate:cfg=>(cfg.top|0)<0||(cfg.bottom|0)<0?'Use zero or a positive number.':((cfg.top|0)+(cfg.bottom|0)===0?'Remove at least one row.':null),
  describe:cfg=>{const p=[];if(cfg.top)p.push('the first '+W.plural(cfg.top,'row'));if(cfg.bottom)p.push('the last '+W.plural(cfg.bottom,'row'));return'Remove '+(p.join(' and ')||'no rows')},
  apply(t,cfg){
    const top=Math.max(0,cfg.top|0),bot=Math.max(0,cfg.bottom|0);
    const end=Math.max(top,t.n-bot);const keep=[];for(let r=top;r<end;r++)keep.push(r);
    return{table:W.pickRows(t,keep),stats:{removed:t.n-keep.length}}
  },
  toDsl:cfg=>'skip rows top '+(cfg.top|0)+' bottom '+(cfg.bottom|0),
  dslPattern:/^skip rows\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.word('skip','rows');const cfg={top:0,bottom:0};while(!cur.done()){const w=cur.oneOf(['top','bottom']);cfg[w]=cur.num()}return cfg},
  examples:[
    {cfg:{top:1,bottom:1},input:{cols:['a'],rows:[['t'],['1'],['2'],['total']]},expect:{cols:['a'],rows:[['1'],['2']]}},
    {cfg:{top:5,bottom:0},input:{cols:['a'],rows:[['1']]},expect:{cols:['a'],rows:[]}}
  ]
});

W.defineOp({
  id:'promoteHeader',label:'Use a row as the header',category:'reshape',
  keywords:['header','promote','row','names','first row','column names','title'],
  fields:[{key:'rowIndex',type:'number',label:'Row number to use (1 = first row)',oneBased:true}],
  defaults:(s,x)=>({rowIndex:x&&x.rowIndex!=null?x.rowIndex:0}),
  validate:cfg=>(cfg.rowIndex|0)<0?'Pick a row.':null,
  describe:cfg=>'Use row '+W.fmtInt((cfg.rowIndex|0)+1)+' as the header'+((cfg.rowIndex|0)>0?' and remove the '+W.plural(cfg.rowIndex|0,'row')+' above it':''),
  apply(t,cfg){
    const ri=cfg.rowIndex|0;
    if(ri>=t.n)throw new Error('There is no row '+W.fmtInt(ri+1)+'. The table has '+W.plural(t.n,'row')+'.');
    const names=W.dedupeColNames(t.cols.map((_,c)=>{const v=String(t.data[c][ri]==null?'':t.data[c][ri]).trim();return v||'column_'+(c+1)}));
    const keep=[];for(let r=ri+1;r<t.n;r++)keep.push(r);
    const nt=W.pickRows(t,keep);nt.cols=names;
    return{table:nt,stats:{removed:ri+1}}
  },
  toDsl:cfg=>'use row '+((cfg.rowIndex|0)+1)+' as header',
  dslPattern:/^use row\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.word('use','row');const n=cur.num();cur.word('as','header');cur.end();if(n<1)throw new Error('Row numbers start at 1.');return{rowIndex:n-1}},
  examples:[
    {cfg:{rowIndex:1},input:{cols:['column_1','column_2'],rows:[['Report',''],['id','name'],['1','Ada']]},expect:{cols:['id','name'],rows:[['1','Ada']]}},
    {cfg:{rowIndex:0},input:{cols:['c1','c2'],rows:[['x',''],['1','2']]},expect:{cols:['x','column_2'],rows:[['1','2']]}}
  ]
});

W.defineOp({
  id:'removeRepeatedHeaders',label:'Remove repeated header rows',category:'remove',
  keywords:['header','repeated','repeat','page','rows','remove'],
  defaults:()=>({}),
  describe:()=>'Remove rows that repeat the header',
  apply(t){
    const key=t.cols.map(c=>String(c).trim().toLowerCase()).join('\u0001');const keep=[];
    for(let r=0;r<t.n;r++){let s='';for(let c=0;c<t.cols.length;c++){if(c)s+='\u0001';s+=String(t.data[c][r]==null?'':t.data[c][r]).trim().toLowerCase()}if(s!==key)keep.push(r)}
    return keep.length===t.n?{table:t,stats:{removed:0}}:{table:W.pickRows(t,keep),stats:{removed:t.n-keep.length}}
  },
  toDsl:()=>'remove repeated headers',
  dslPattern:/^remove repeated headers?\b/i,
  fromDsl(line){if(!/^remove repeated headers?\s*$/i.test(line))throw new Error('Write this step as: remove repeated headers');return{}},
  examples:[
    {cfg:{},input:{cols:['id','Name'],rows:[['1','a'],['ID','name '],['2','b']]},expect:{cols:['id','Name'],rows:[['1','a'],['2','b']]}},
    {cfg:{},input:{cols:['id'],rows:[]},expect:{cols:['id'],rows:[]}}
  ]
});

function sortTypeOf(t,ci,type,ctx){return!type||type==='auto'?W.inferType(t.data[ci],t.n,ctx):type}
W.defineOp({
  id:'sortRows',label:'Sort rows',category:'reshape',
  keywords:['sort','order','ascending','descending','arrange','rank'],
  fields:[{key:'keys',type:'sortkeys',label:'Sort by'}],
  defaults:(s,x)=>({keys:[{col:(x&&x.col)||s.cols[0],dir:(x&&x.dir)||'asc',type:'auto'}]}),
  validate:cfg=>cfg.keys&&cfg.keys.length?null:'Pick a column to sort by.',
  describe:cfg=>'Sort by '+cfg.keys.map(k=>'"'+k.col+'" '+(k.dir==='desc'?'descending':'ascending')).join(', then '),
  apply(t,cfg,ctx){
    const sets=cfg.keys.map(k=>{const ci=W.needCol(t,k.col);const type=sortTypeOf(t,ci,k.type,ctx);return{keys:W.sortKeysFor(t.data[ci],type,ctx),type,dir:k.dir==='desc'?-1:1}});
    const order=W.sortPositions(W.identity(t.n),sets);
    let moved=0;for(let i=0;i<order.length;i++)if(order[i]!==i)moved++;
    return{table:W.pickRows(t,order),stats:{moved}}
  },
  toDsl:cfg=>'sort by '+cfg.keys.map(k=>q(k.col)+' '+(k.dir==='desc'?'desc':'asc')+(k.type&&k.type!=='auto'?' as '+k.type:'')).join(', '),
  dslPattern:/^sort by\b/i,
  fromDsl(line){
    const cur=W.cursor(line);cur.word('sort','by');const keys=[];
    do{const col=cur.str();let dir='asc',type='auto';if(cur.isWord('asc')||cur.isWord('desc')||cur.isWord('ascending')||cur.isWord('descending'))dir=cur.anyWord().toLowerCase().slice(0,3)==='des'?'desc':'asc';if(cur.optWord('as'))type=cur.oneOf(['text','number','date','auto']);keys.push({col,dir,type})}while(cur.optP(','));
    cur.end();return{keys}
  },
  examples:[
    {cfg:{keys:[{col:'amount',dir:'desc',type:'auto'}]},input:{cols:['amount'],rows:[['$5'],[''],['1,200'],['(3)']]},expect:{cols:['amount'],rows:[['1,200'],['$5'],['(3)'],['']]}},
    {cfg:{keys:[{col:'g',dir:'asc',type:'text'},{col:'n',dir:'desc',type:'number'}]},input:{cols:['g','n'],rows:[['b','1'],['a','1'],['a','2']]},expect:{cols:['g','n'],rows:[['a','2'],['a','1'],['b','1']]}}
  ]
});

W.defineOp({
  id:'splitToRows',label:'Split cell values into rows',category:'reshape',
  keywords:['split','rows','explode','unnest','tags','list','multiple values'],
  fields:[{key:'column',type:'column',label:'Column'},{key:'delimiter',type:'text',label:'Split on',placeholder:'e.g. ; or ,'},{key:'trim',type:'checkbox',label:'Trim each piece'}],
  defaults:(s,x)=>({column:(x&&x.col)||s.cols[0],delimiter:';',trim:true}),
  validate:cfg=>cfg.delimiter?null:'Enter the character that separates the values.',
  describe:cfg=>'Split "'+cfg.column+'" on "'+cfg.delimiter+'" into separate rows',
  apply(t,cfg,ctx){
    const ci=W.needCol(t,cfg.column);
    const outs=t.cols.map(()=>[]);const ids=[];let added=0;
    let next=ctx&&ctx.nextRowId!=null?ctx.nextRowId:(Math.max(-1,...t.rowIds.slice(0,1))+1);
    for(let r=0;r<t.n;r++){
      const v=String(t.data[ci][r]==null?'':t.data[ci][r]);
      let parts=v.split(cfg.delimiter);if(cfg.trim!==false)parts=parts.map(s=>s.trim());
      const nonEmpty=parts.filter(p=>p!=='');
      if(nonEmpty.length>1)parts=nonEmpty;
      parts.forEach((p,k)=>{for(let c=0;c<t.cols.length;c++)outs[c].push(c===ci?p:t.data[c][r]);if(k===0)ids.push(t.rowIds[r]);else{ids.push(next++);added++}})
    }
    if(ctx)ctx.nextRowId=next;
    return{table:{cols:t.cols,data:outs,n:ids.length,rowIds:ids},stats:{added}}
  },
  toDsl:cfg=>'split '+q(cfg.column)+' on '+q(cfg.delimiter)+' into rows'+(cfg.trim===false?' keep spaces':''),
  dslPattern:/^split "(?:[^"\\]|\\.)*" on "(?:[^"\\]|\\.)*" into rows\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.word('split');const column=cur.str();cur.word('on');const delimiter=cur.str();cur.word('into','rows');let trim=true;if(cur.optWord('keep')){cur.word('spaces');trim=false}cur.end();return{column,delimiter,trim}},
  examples:[
    {cfg:{column:'tags',delimiter:';',trim:true},input:{cols:['id','tags'],rows:[['1','a; b'],['2','']]},expect:{cols:['id','tags'],rows:[['1','a'],['1','b'],['2','']]}},
    {cfg:{column:'tags',delimiter:',',trim:true},input:{cols:['tags'],rows:[['ü,ö,']]},expect:{cols:['tags'],rows:[['ü'],['ö']]}}
  ]
});
})(typeof self!=='undefined'?self:globalThis);
