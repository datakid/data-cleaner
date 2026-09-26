(function(G){
'use strict';
const W=G.WeftCore;
const q=W.q,cd=W.colsDsl;

W.defineOp({
  id:'rename',label:'Rename column',category:'rewrite',
  keywords:['rename','column','header','name','title'],
  fields:[{key:'from',type:'column',label:'Column'},{key:'to',type:'text',label:'New name'}],
  defaults:(s,x)=>{const c=(x&&x.col)||s.cols[0];return{from:c,to:c}},
  validate:(cfg,s)=>!String(cfg.to||'').trim()?'Enter a new name.':(s&&cfg.to!==cfg.from&&s.cols.indexOf(cfg.to)!==-1?'A column called "'+cfg.to+'" already exists.':null),
  describe:cfg=>'Rename "'+cfg.from+'" to "'+cfg.to+'"',
  apply(t,cfg){
    const ci=W.needCol(t,cfg.from);
    const to=String(cfg.to).trim();
    if(to!==cfg.from&&t.cols.indexOf(to)!==-1)throw new Error('A column called "'+to+'" already exists.');
    const cols=t.cols.slice();cols[ci]=to;
    return{table:{cols,data:t.data,n:t.n,rowIds:t.rowIds},stats:{}}
  },
  toDsl:cfg=>'rename '+q(cfg.from)+' -> '+q(cfg.to),
  dslPattern:/^rename\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.word('rename');const from=cur.str();if(!cur.optWord('->'))cur.word('to');const to=cur.str();cur.end();return{from,to}},
  examples:[
    {cfg:{from:'e-mail',to:'email'},input:{cols:['e-mail'],rows:[['a@b.c']]},expect:{cols:['email'],rows:[['a@b.c']]}},
    {cfg:{from:'名前',to:'name'},input:{cols:['id','名前'],rows:[]},expect:{cols:['id','name'],rows:[]}}
  ]
});

W.defineOp({
  id:'dropColumn',label:'Delete columns',category:'remove',
  keywords:['delete','remove','drop','columns','hide'],
  fields:[{key:'columns',type:'columns',label:'Columns to delete',allowAll:false}],
  defaults:(s,x)=>({columns:x&&x.cols&&x.cols.length?x.cols:[s.cols[s.cols.length-1]]}),
  validate:cfg=>cfg.columns&&cfg.columns.length?null:'Pick at least one column.',
  describe:cfg=>'Delete '+(cfg.columns.length===1?'column "'+cfg.columns[0]+'"':W.plural(cfg.columns.length,'column')+': '+cfg.columns.map(c=>'"'+c+'"').join(', ')),
  apply(t,cfg){
    W.needCols(t,cfg.columns);
    const drop=new Set(cfg.columns);const cols=[],data=[];
    t.cols.forEach((c,i)=>{if(!drop.has(c)){cols.push(c);data.push(t.data[i])}});
    return{table:{cols,data,n:t.n,rowIds:t.rowIds},stats:{removedCols:t.cols.length-cols.length}}
  },
  toDsl:cfg=>'delete columns '+cfg.columns.map(q).join(', '),
  dslPattern:/^(delete|drop|remove) columns?\s+"/i,
  fromDsl(line){const cur=W.cursor(line);cur.oneOf(['delete','drop','remove']);cur.oneOf(['column','columns']);const columns=cur.strList();cur.end();return{columns}},
  examples:[
    {cfg:{columns:['notes']},input:{cols:['id','notes'],rows:[['1','x']]},expect:{cols:['id'],rows:[['1']]}},
    {cfg:{columns:['a','b']},input:{cols:['a','b'],rows:[['1','2']]},expect:{cols:[],rows:[[]]}}
  ]
});

W.defineOp({
  id:'selectColumns',label:'Keep only some columns',category:'remove',
  keywords:['keep','only','select','columns','choose'],
  fields:[{key:'columns',type:'columns',label:'Columns to keep',allowAll:false}],
  defaults:(s,x)=>({columns:x&&x.cols&&x.cols.length?x.cols:s.cols.slice(0,2)}),
  validate:cfg=>cfg.columns&&cfg.columns.length?null:'Pick at least one column.',
  describe:cfg=>'Keep only '+(cfg.columns.length===1?'column "'+cfg.columns[0]+'"':cfg.columns.map(c=>'"'+c+'"').join(', ')),
  apply(t,cfg){
    W.needCols(t,cfg.columns);
    const idx=cfg.columns.map(c=>t.cols.indexOf(c));
    return{table:{cols:idx.map(i=>t.cols[i]),data:idx.map(i=>t.data[i]),n:t.n,rowIds:t.rowIds},stats:{removedCols:t.cols.length-idx.length}}
  },
  toDsl:cfg=>'keep columns '+cfg.columns.map(q).join(', '),
  dslPattern:/^keep columns?\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.word('keep');cur.oneOf(['column','columns']);const columns=cur.strList();cur.end();return{columns}},
  examples:[
    {cfg:{columns:['b','a']},input:{cols:['a','b','c'],rows:[['1','2','3']]},expect:{cols:['b','a'],rows:[['2','1']]}},
    {cfg:{columns:['a']},input:{cols:['a'],rows:[]},expect:{cols:['a'],rows:[]}}
  ]
});

W.defineOp({
  id:'duplicateColumn',label:'Duplicate column',category:'add',
  keywords:['duplicate','copy','clone','column','backup'],
  fields:[{key:'column',type:'column',label:'Column'},{key:'as',type:'text',label:'New column name'}],
  defaults:(s,x)=>{const c=(x&&x.col)||s.cols[0];return{column:c,as:c+'_copy'}},
  validate:(cfg,s)=>!String(cfg.as||'').trim()?'Enter a name for the copy.':null,
  describe:cfg=>'Duplicate "'+cfg.column+'" as "'+cfg.as+'"',
  apply(t,cfg){
    const ci=W.needCol(t,cfg.column);
    const r=W.addColumnAt(t,String(cfg.as||cfg.column+'_copy').trim(),t.data[ci],ci);
    return{table:r.table,stats:{addedCols:1},touched:new Map([[r.name,true]])}
  },
  toDsl:cfg=>'duplicate column '+q(cfg.column)+' as '+q(cfg.as),
  dslPattern:/^duplicate column\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.word('duplicate','column');const column=cur.str();let as=column+' copy';if(cur.optWord('as'))as=cur.str();cur.end();return{column,as}},
  examples:[
    {cfg:{column:'email',as:'email_raw'},input:{cols:['email','n'],rows:[['a','1']]},expect:{cols:['email','email_raw','n'],rows:[['a','a','1']]}},
    {cfg:{column:'a',as:'a'},input:{cols:['a'],rows:[['x']]},expect:{cols:['a','a_2'],rows:[['x','x']]}}
  ]
});

W.defineOp({
  id:'reorderColumns',label:'Reorder columns',category:'reshape',
  keywords:['move','reorder','order','arrange','columns','left','right'],
  fields:[{key:'order',type:'columns',label:'New order (others follow)',allowAll:false}],
  defaults:s=>({order:s.cols.slice()}),
  validate:cfg=>cfg.order&&cfg.order.length?null:'Pick the column order.',
  describe:cfg=>'Reorder columns: '+W.trunc(cfg.order.map(c=>'"'+c+'"').join(', '),80),
  apply(t,cfg){
    const want=cfg.order.filter(c=>t.cols.indexOf(c)!==-1);
    const rest=t.cols.filter(c=>want.indexOf(c)===-1);
    const fin=want.concat(rest).map(c=>t.cols.indexOf(c));
    const out={table:{cols:fin.map(i=>t.cols[i]),data:fin.map(i=>t.data[i]),n:t.n,rowIds:t.rowIds},stats:{}};
    const miss=cfg.order.filter(c=>t.cols.indexOf(c)===-1);
    if(miss.length)out.warning='Skipped '+W.plural(miss.length,'column')+' that no longer exist: '+miss.map(c=>'"'+c+'"').join(', ')+'.';
    return out
  },
  toDsl:cfg=>'order columns '+cfg.order.map(q).join(', '),
  dslPattern:/^(order|reorder) columns\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.oneOf(['order','reorder']);cur.word('columns');const order=cur.strList();cur.end();return{order}},
  examples:[
    {cfg:{order:['c','a']},input:{cols:['a','b','c'],rows:[['1','2','3']]},expect:{cols:['c','a','b'],rows:[['3','1','2']]}},
    {cfg:{order:['zzz','b']},input:{cols:['a','b'],rows:[]},expect:{cols:['b','a'],rows:[]}}
  ]
});

W.defineOp({
  id:'dropEmptyCols',label:'Remove empty columns',category:'remove',
  keywords:['empty','blank','columns','remove','drop','delete','unused'],
  defaults:()=>({}),
  describe:()=>'Remove columns that are completely empty',
  apply(t){
    const cols=[],data=[];
    t.cols.forEach((c,i)=>{const col=t.data[i];let empty=true;for(let r=0;r<t.n;r++){const v=col[r];if(v!=null&&String(v).trim()!==''){empty=false;break}}if(!empty||t.n===0){cols.push(c);data.push(col)}});
    return{table:{cols,data,n:t.n,rowIds:t.rowIds},stats:{removedCols:t.cols.length-cols.length}}
  },
  toDsl:()=>'remove empty columns',
  dslPattern:/^(remove|drop) empty columns\b/i,
  fromDsl(){return{}},
  examples:[
    {cfg:{},input:{cols:['a','b'],rows:[['1',''],['2',' ']]},expect:{cols:['a'],rows:[['1'],['2']]}},
    {cfg:{},input:{cols:['a'],rows:[]},expect:{cols:['a'],rows:[]}}
  ]
});

function outNames(t,into,base,k){
  const names=[];
  for(let i=0;i<k;i++){const nm=into&&into[i]&&String(into[i]).trim()?String(into[i]).trim():base+'_'+(i+1);names.push(nm)}
  return names
}
function insertColumns(t,afterIdx,names,cols,keepOriginal,srcIdx){
  let tcols=t.cols.slice(),tdata=t.data.slice();
  if(!keepOriginal&&srcIdx!=null&&srcIdx>=0){tcols.splice(srcIdx,1);tdata.splice(srcIdx,1);if(afterIdx>=srcIdx)afterIdx--}
  const used=new Set(tcols);
  const fin=names.map(n=>{let nm=n,k=2;while(used.has(nm)){nm=n+'_'+k;k++}used.add(nm);return nm});
  tcols.splice(afterIdx+1,0,...fin);tdata.splice(afterIdx+1,0,...cols);
  return{cols:tcols,data:tdata,names:fin}
}
W.insertColumns=insertColumns;

W.defineOp({
  id:'split',label:'Split column',category:'add',
  keywords:['split','separate','divide','delimiter','comma','space','columns','first name','last name'],
  fields:[{key:'column',type:'column',label:'Column'},{key:'delimiter',type:'text',label:'Split on',placeholder:'e.g. a space, comma or -'},{key:'into',type:'textlist',label:'New column names (comma-separated, blank for automatic)'},{key:'limit',type:'number',label:'Maximum pieces (0 = no limit)'},{key:'keepOriginal',type:'checkbox',label:'Keep the original column'}],
  defaults:(s,x)=>{const c=(x&&x.col)||s.cols[0];return{column:c,delimiter:' ',into:[],limit:0,keepOriginal:true}},
  validate:cfg=>cfg.delimiter===''?'Enter the text to split on.':null,
  describe:cfg=>'Split "'+cfg.column+'" on "'+(cfg.delimiter===' '?'space':cfg.delimiter)+'"'+(cfg.into&&cfg.into.length?' into '+cfg.into.map(c=>'"'+c+'"').join(', '):''),
  apply(t,cfg){
    const ci=W.needCol(t,cfg.column);
    const d=cfg.delimiter;const lim=cfg.limit|0;
    const parts=new Array(t.n);let k=0,splitCount=0;
    for(let r=0;r<t.n;r++){
      const v=String(t.data[ci][r]==null?'':t.data[ci][r]);
      let p=d===' '?v.trim().split(/\s+/):v.split(d);
      if(v.trim()==='')p=[];
      if(lim>0&&p.length>lim){p=p.slice(0,lim-1).concat([p.slice(lim-1).join(d===' '?' ':d)])}
      p=p.map(s=>s.trim());
      if(p.length>1)splitCount++;
      parts[r]=p;if(p.length>k)k=p.length
    }
    if(cfg.into&&cfg.into.length>k)k=cfg.into.length;
    k=Math.max(k,2);
    const names=outNames(t,cfg.into,cfg.column,k);
    const cols=names.map((_,i)=>{const a=new Array(t.n);for(let r=0;r<t.n;r++)a[r]=parts[r][i]==null?'':parts[r][i];return a});
    const ins=insertColumns(t,ci,names,cols,cfg.keepOriginal!==false,ci);
    return{table:{cols:ins.cols,data:ins.data,n:t.n,rowIds:t.rowIds},stats:{addedCols:names.length,changed:splitCount},touched:W.allTouched(t,ins.names)}
  },
  toDsl:cfg=>'split '+q(cfg.column)+' on '+q(cfg.delimiter)+(cfg.into&&cfg.into.length?' into '+cfg.into.map(q).join(', '):'')+((cfg.limit|0)>0?' max '+(cfg.limit|0):'')+(cfg.keepOriginal===false?' drop original':''),
  dslPattern:/^split "(?:[^"\\]|\\.)*" on (?!"(?:[^"\\]|\\.)*" into rows)/i,
  fromDsl(line){
    const cur=W.cursor(line);cur.word('split');const column=cur.str();cur.word('on');const delimiter=cur.str();
    const cfg={column,delimiter,into:[],limit:0,keepOriginal:true};
    while(!cur.done()){
      if(cur.optWord('into'))cfg.into=cur.strList();
      else if(cur.optWord('max'))cfg.limit=cur.num();
      else{cur.word('drop','original');cfg.keepOriginal=false}
    }
    return cfg
  },
  examples:[
    {cfg:{column:'name',delimiter:' ',into:['first','last'],limit:2,keepOriginal:false},input:{cols:['name','x'],rows:[['Ada King Lovelace','1'],['Grace','2']]},expect:{cols:['first','last','x'],rows:[['Ada','King Lovelace','1'],['Grace','','2']]}},
    {cfg:{column:'p',delimiter:'-',into:[],limit:0,keepOriginal:true},input:{cols:['p'],rows:[['a-b-c'],['']]},expect:{cols:['p','p_1','p_2','p_3'],rows:[['a-b-c','a','b','c'],['','','','']]}}
  ]
});

W.defineOp({
  id:'merge',label:'Merge columns',category:'add',
  keywords:['merge','combine','concatenate','join','columns','full name','concat'],
  fields:[{key:'columns',type:'columns',label:'Columns to merge (in order)',allowAll:false},{key:'joiner',type:'text',label:'Put between values',placeholder:'e.g. a space'},{key:'into',type:'text',label:'New column name'},{key:'skipBlank',type:'checkbox',label:'Skip empty values'},{key:'keepOriginal',type:'checkbox',label:'Keep the original columns'}],
  defaults:(s,x)=>{const cols=x&&x.cols&&x.cols.length>=2?x.cols:s.cols.slice(0,2);return{columns:cols,joiner:' ',into:cols.join('_'),skipBlank:true,keepOriginal:true}},
  validate:cfg=>!cfg.columns||cfg.columns.length<2?'Pick at least two columns.':(!String(cfg.into||'').trim()?'Name the new column.':null),
  describe:cfg=>'Merge '+cfg.columns.map(c=>'"'+c+'"').join(' + ')+' into "'+cfg.into+'"',
  apply(t,cfg){
    W.needCols(t,cfg.columns);
    const idx=cfg.columns.map(c=>t.cols.indexOf(c));const j=cfg.joiner==null?' ':String(cfg.joiner);
    const out=new Array(t.n);
    for(let r=0;r<t.n;r++){let vals=idx.map(i=>String(t.data[i][r]==null?'':t.data[i][r]));if(cfg.skipBlank!==false)vals=vals.filter(v=>v.trim()!=='');out[r]=vals.join(j)}
    let base=t;
    if(cfg.keepOriginal===false){const drop=new Set(idx);base={cols:t.cols.filter((c,i)=>!drop.has(i)),data:t.data.filter((c,i)=>!drop.has(i)),n:t.n,rowIds:t.rowIds}}
    const at=cfg.keepOriginal===false?Math.min(...idx)-1:Math.max(...idx);
    const r=W.addColumnAt(base,String(cfg.into).trim(),out,at);
    return{table:r.table,stats:{addedCols:1,changed:t.n},touched:new Map([[r.name,true]])}
  },
  toDsl:cfg=>'merge '+cfg.columns.map(q).join(', ')+' into '+q(cfg.into)+' joined by '+q(cfg.joiner==null?' ':cfg.joiner)+(cfg.skipBlank===false?' keep blanks':'')+(cfg.keepOriginal===false?' drop originals':''),
  dslPattern:/^merge\b/i,
  fromDsl(line){
    const cur=W.cursor(line);cur.word('merge');const columns=cur.strList();cur.word('into');const into=cur.str();
    const cfg={columns,into,joiner:' ',skipBlank:true,keepOriginal:true};
    while(!cur.done()){
      if(cur.optWord('joined')){cur.word('by');cfg.joiner=cur.str()}
      else if(cur.optWord('keep')){cur.word('blanks');cfg.skipBlank=false}
      else{cur.word('drop','originals');cfg.keepOriginal=false}
    }
    return cfg
  },
  examples:[
    {cfg:{columns:['first','last'],joiner:' ',into:'name',skipBlank:true,keepOriginal:false},input:{cols:['id','first','last'],rows:[['1','Ada','Lovelace'],['2','Grace','']]},expect:{cols:['id','name'],rows:[['1','Ada Lovelace'],['2','Grace']]}},
    {cfg:{columns:['a','b'],joiner:'-',into:'ab',skipBlank:false,keepOriginal:true},input:{cols:['a','b'],rows:[['x','']]},expect:{cols:['a','b','ab'],rows:[['x','','x-']]}}
  ]
});

W.EXTRACT_PRESETS={
  email:'[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+',
  phone:'\\+?\\d[\\d\\s().-]{6,}\\d',
  url:'(?:https?:\\/\\/|www\\.)[^\\s<>"]+',
  number:'-?\\$?\\d[\\d,]*(?:\\.\\d+)?%?',
  date:'\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}|[A-Za-z]{3,9}\\.? \\d{1,2},? \\d{4}',
  zip:'\\b\\d{5}(?:-\\d{4})?\\b',
  hashtag:'#[\\w-]+',
  ip:'\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b'
};
W.defineOp({
  id:'extract',label:'Extract into new column',category:'add',
  keywords:['extract','pull','regex','pattern','email','phone','url','number','find','capture'],
  fields:[{key:'column',type:'column',label:'From column'},{key:'preset',type:'select',label:'What to extract',options:[['email','Email address'],['phone','Phone number'],['url','Web address'],['number','Number'],['date','Date'],['zip','US ZIP code'],['hashtag','Hashtag'],['ip','IP address'],['','Custom pattern…']]},{key:'pattern',type:'text',label:'Custom pattern (regular expression)',placeholder:'used when "Custom pattern" is picked',showIf:{preset:''}},{key:'into',type:'text',label:'New column name'},{key:'all',type:'checkbox',label:'Extract every match (joined with "; ")'}],
  defaults:(s,x)=>{const c=(x&&x.col)||s.cols[0];return{column:c,preset:'email',pattern:'',into:c+'_email',all:false}},
  validate:cfg=>!cfg.preset&&!cfg.pattern?'Pick what to extract or write a pattern.':(!cfg.preset&&W.isUnsafeRegexSource(cfg.pattern)?'That pattern is too long or could freeze the page. Simplify it.':(!String(cfg.into||'').trim()?'Name the new column.':null)),
  describe:cfg=>'Extract '+(cfg.preset?({email:'email addresses',phone:'phone numbers',url:'web addresses',number:'numbers',date:'dates',zip:'ZIP codes',hashtag:'hashtags',ip:'IP addresses'}[cfg.preset]||cfg.preset):'/'+W.trunc(cfg.pattern,24)+'/')+' from "'+cfg.column+'" into "'+cfg.into+'"',
  apply(t,cfg){
    const ci=W.needCol(t,cfg.column);
    const src=cfg.preset?W.EXTRACT_PRESETS[cfg.preset]:cfg.pattern;
    if(!src)throw new Error('Unknown pattern "'+cfg.preset+'".');
    const re=cfg.preset?new RegExp(src,cfg.all?'gi':'i'):W.compileRegex(src,cfg.all?'g':'');
    const out=new Array(t.n);let found=0;
    for(let r=0;r<t.n;r++){
      const v=String(t.data[ci][r]==null?'':t.data[ci][r]);
      let val='';
      if(cfg.all){re.lastIndex=0;const ms=[];let m,g=0;while((m=re.exec(v))&&g<200){ms.push(m[1]!=null?m[1]:m[0]);if(m[0]==='')re.lastIndex++;g++}val=ms.join('; ')}
      else{const m=re.exec(v);if(m)val=m[1]!=null?m[1]:m[0]}
      if(val)found++;
      out[r]=cfg.preset==='phone'||cfg.preset==='email'?val.trim():val
    }
    const r=W.addColumnAt(t,String(cfg.into).trim(),out,ci);
    const res={table:r.table,stats:{addedCols:1,changed:found},touched:new Map([[r.name,true]])};
    if(!found&&t.n)res.warning='Nothing matched in "'+cfg.column+'".';
    return res
  },
  toDsl:cfg=>'extract '+(cfg.preset||W.reDsl(cfg.pattern,true))+' from '+q(cfg.column)+' into '+q(cfg.into)+(cfg.all?' all':''),
  dslPattern:/^extract\b/i,
  fromDsl(line){
    const cur=W.cursor(line);cur.word('extract');const cfg={column:'',preset:'',pattern:'',into:'',all:false};
    const x=cur.peek();
    if(x&&x.t==='re'){cfg.pattern=cur.re().src}else{const w=cur.anyWord().toLowerCase();if(!W.EXTRACT_PRESETS[w])throw new Error('Unknown pattern "'+w+'". Use email, phone, url, number, date, zip, hashtag, ip or /pattern/.');cfg.preset=w}
    cur.word('from');cfg.column=cur.str();cur.word('into');cfg.into=cur.str();
    if(cur.optWord('all'))cfg.all=true;cur.end();return cfg
  },
  examples:[
    {cfg:{column:'c',preset:'email',pattern:'',into:'email',all:false},input:{cols:['c'],rows:[['Reach me: ada@example.com.'],['none']]},expect:{cols:['c','email'],rows:[['Reach me: ada@example.com.','ada@example.com'],['none','']]}},
    {cfg:{column:'c',preset:'',pattern:'#(\\d+)',into:'n',all:true},input:{cols:['c'],rows:[['#1 and #22']]},expect:{cols:['c','n'],rows:[['#1 and #22','1; 22']]}}
  ]
});

const SKINDS=['fixed-width','whitespace-runs','key-value','logfmt','pattern','json','delimited'];
function structDescribe(cfg){
  const k=cfg.kind;
  if(k==='json')return'Parse JSON in "'+cfg.column+'" into columns';
  if(k==='fixed-width')return'Split "'+cfg.column+'" at fixed positions'+(cfg.params&&cfg.params.cuts?' '+cfg.params.cuts.filter(c=>c>0).join(', '):'');
  if(k==='whitespace-runs')return'Split "'+cfg.column+'" on runs of spaces';
  if(k==='key-value')return'Split "'+cfg.column+'" into key'+((cfg.params&&cfg.params.sep)||':')+' value columns';
  if(k==='logfmt')return'Split key=value pairs in "'+cfg.column+'"';
  if(k==='pattern')return'Split "'+cfg.column+'" by pattern /'+W.trunc(cfg.params&&cfg.params.pattern||'',30)+'/';
  if(k==='delimited')return'Split "'+cfg.column+'" on "'+((cfg.params&&cfg.params.delimiter)||',')+'"';
  return'Split "'+cfg.column+'"'
}
W.defineOp({
  id:'structureColumn',label:'Split column by structure',category:'structure',
  keywords:['split','structure','fixed width','whitespace','key value','logfmt','pattern','json','parse','columns'],
  fields:[{key:'column',type:'column',label:'Column'},{key:'kind',type:'select',label:'How the text is organised',options:[['whitespace-runs','Separated by runs of spaces'],['fixed-width','Fixed-width positions'],['key-value','key: value pairs'],['logfmt','key=value pairs'],['json','JSON'],['pattern','Pattern with named groups'],['delimited','Separated by a character']]},{key:'params.cuts',type:'numlist',label:'Cut positions (characters, comma-separated; blank = detect)',showIf:{kind:'fixed-width'}},{key:'params.sep',type:'select',label:'Separator',options:[[':',':'],['=','=']],showIf:{kind:'key-value'}},{key:'params.pattern',type:'text',label:'Pattern, e.g. (?<date>\\S+) (?<level>\\w+) (?<msg>.*)',showIf:{kind:'pattern'}},{key:'params.delimiter',type:'text',label:'Separator character',showIf:{kind:'delimited'}},{key:'into',type:'textlist',label:'Column names (comma-separated, blank for automatic)'},{key:'keepOriginal',type:'checkbox',label:'Keep the original column'}],
  defaults:(s,x)=>({column:(x&&x.col)||s.cols[0],kind:(x&&x.kind)||'whitespace-runs',params:(x&&x.params)||{},into:[],keepOriginal:false}),
  validate:cfg=>SKINDS.indexOf(cfg.kind)===-1?'Pick how the text is organised.':(cfg.kind==='pattern'&&W.isUnsafeRegexSource(cfg.params&&cfg.params.pattern)?'Enter a safe pattern with groups, like (?<date>\\S+) (?<rest>.*)':(cfg.kind==='delimited'&&!(cfg.params&&cfg.params.delimiter)?'Enter the separator character.':null)),
  describe:structDescribe,
  apply(t,cfg){
    const ci=W.needCol(t,cfg.column);
    const vals=new Array(t.n);for(let r=0;r<t.n;r++)vals[r]=t.data[ci][r]==null?'':String(t.data[ci][r]);
    const res=W.structureValues(vals,cfg.kind,cfg.params||{});
    let k=res.cols?res.cols.length:0;
    if(!res.cols)for(const r of res.rows)if(r.length>k)k=r.length;
    if(k===0)return{table:t,stats:{addedCols:0},warning:'Nothing in "'+cfg.column+'" could be split this way.'};
    const auto=res.cols||W.identity(k,1).map(i=>cfg.column+'_'+i);
    const names=(cfg.into&&cfg.into.length&&cfg.into!=='auto')?auto.map((a,i)=>cfg.into[i]&&String(cfg.into[i]).trim()?String(cfg.into[i]).trim():a):auto;
    const cols=names.map((_,i)=>{const a=new Array(t.n);for(let r=0;r<t.n;r++){const row=res.rows[r];a[r]=row&&row[i]!=null?row[i]:''}return a});
    const ins=insertColumns(t,ci,names,cols,!!cfg.keepOriginal,ci);
    let filled=0;for(const r of res.rows)if(r&&r.some(v=>v!==''))filled++;
    const out={table:{cols:ins.cols,data:ins.data,n:t.n,rowIds:t.rowIds},stats:{addedCols:names.length,changed:filled},touched:W.allTouched(t,ins.names)};
    if(filled<t.n*0.5&&t.n)out.warning='Only '+W.fmtInt(filled)+' of '+W.plural(t.n,'row')+' could be split this way.';
    return out
  },
  toDsl(cfg){
    const tail=(cfg.into&&cfg.into.length&&cfg.into!=='auto'?' into '+cfg.into.map(q).join(', '):'')+(cfg.keepOriginal?' keep original':'');
    const p=cfg.params||{};
    if(cfg.kind==='json')return'parse json in '+q(cfg.column)+tail;
    if(cfg.kind==='fixed-width')return'split '+q(cfg.column)+' by fixed-width'+(p.cuts&&p.cuts.length?' at '+p.cuts.join(','):'')+tail;
    if(cfg.kind==='pattern')return'split '+q(cfg.column)+' by pattern '+W.reDsl(p.pattern||'',!!p.caseSensitive)+tail;
    if(cfg.kind==='key-value')return'split '+q(cfg.column)+' by key-value'+(p.sep==='='?' sep "="':'')+tail;
    if(cfg.kind==='delimited')return'split '+q(cfg.column)+' by character '+q(p.delimiter||',')+tail;
    return'split '+q(cfg.column)+' by '+cfg.kind+tail
  },
  dslPattern:/^(parse json in\b|split "(?:[^"\\]|\\.)*" by\b)/i,
  fromDsl(line){
    const cur=W.cursor(line);const cfg={column:'',kind:'',params:{},into:[],keepOriginal:false};
    if(cur.isWord('parse')){cur.word('parse','json','in');cfg.column=cur.str();cfg.kind='json'}
    else{
      cur.word('split');cfg.column=cur.str();cur.word('by');
      const x=cur.anyWord().toLowerCase();
      if(x==='fixed-width'){cfg.kind='fixed-width';if(cur.optWord('at')){const w=cur.anyWord();cfg.params.cuts=w.split(',').map(Number).filter(n=>!isNaN(n))}}
      else if(x==='pattern'){cfg.kind='pattern';const r=cur.re();cfg.params.pattern=r.src;if(r.flags.indexOf('i')===-1)cfg.params.caseSensitive=true}
      else if(x==='key-value'){cfg.kind='key-value';if(cur.optWord('sep'))cfg.params.sep=cur.str()}
      else if(x==='character'){cfg.kind='delimited';cfg.params.delimiter=cur.str()}
      else if(x==='whitespace-runs'||x==='logfmt')cfg.kind=x;
      else throw new Error('Unknown split "'+x+'". Use fixed-width, whitespace-runs, key-value, logfmt, character or pattern.')
    }
    while(!cur.done()){if(cur.optWord('into'))cfg.into=cur.strList();else{cur.word('keep','original');cfg.keepOriginal=true}}
    return cfg
  },
  examples:[
    {cfg:{column:'line',kind:'whitespace-runs',params:{},into:['name','status'],keepOriginal:false},input:{cols:['id','line'],rows:[['1','web-1   running'],['2','db    stopped']]},expect:{cols:['id','name','status'],rows:[['1','web-1','running'],['2','db','stopped']]}},
    {cfg:{column:'p',kind:'json',params:{},into:[],keepOriginal:false},input:{cols:['p'],rows:[['{"a":1,"b":{"c":"x"}}'],['oops']]},expect:{cols:['a','b.c','_unparsed'],rows:[['1','x',''],['','','oops']]}},
    {cfg:{column:'l',kind:'logfmt',params:{},into:[],keepOriginal:false},input:{cols:['l'],rows:[['level=info msg="hi there" id=7']]},expect:{cols:['level','msg','id'],rows:[['info','hi there','7']]}},
    {cfg:{column:'l',kind:'pattern',params:{pattern:'(?<d>\\d{4}-\\d\\d-\\d\\d) (?<rest>.*)'},into:[],keepOriginal:false},input:{cols:['l'],rows:[['2025-01-02 boot ok'],['x']]},expect:{cols:['d','rest'],rows:[['2025-01-02','boot ok'],['','']]}}
  ]
});
})(typeof self!=='undefined'?self:globalThis);
