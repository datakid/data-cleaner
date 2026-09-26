(function(G){
'use strict';
const W=G.WeftCore;
const q=W.q,cd=W.colsDsl;

W.defineOp({
  id:'wideToLong',label:'Wide to long',category:'reshape',
  keywords:['wide','long','unpivot','melt','reshape','stack','columns to rows'],
  fields:[{key:'idColumns',type:'columns',label:'Columns to keep as they are',allowAll:false},{key:'valueColumns',type:'columns',label:'Columns to turn into rows',allowAll:true},{key:'keyName',type:'text',label:'Name for the new label column'},{key:'valueName',type:'text',label:'Name for the new value column'},{key:'skipBlank',type:'checkbox',label:'Skip empty values'}],
  defaults:(s,x)=>({idColumns:x&&x.cols&&x.cols.length?x.cols:[s.cols[0]],valueColumns:['*'],keyName:'key',valueName:'value',skipBlank:false}),
  validate:cfg=>!cfg.idColumns||!cfg.idColumns.length?'Pick at least one column to keep.':null,
  describe:cfg=>'Turn '+(cfg.valueColumns[0]==='*'?'the other columns':cfg.valueColumns.map(c=>'"'+c+'"').join(', '))+' into rows ("'+cfg.keyName+'", "'+cfg.valueName+'")',
  apply(t,cfg,ctx){
    W.needCols(t,cfg.idColumns);W.needCols(t,cfg.valueColumns);
    const idIdx=cfg.idColumns.map(c=>t.cols.indexOf(c));
    const valIdx=cfg.valueColumns[0]==='*'?t.cols.map((_,i)=>i).filter(i=>idIdx.indexOf(i)===-1):cfg.valueColumns.map(c=>t.cols.indexOf(c));
    if(!valIdx.length)throw new Error('There are no columns left to turn into rows.');
    const names=W.dedupeColNames(cfg.idColumns.concat([cfg.keyName||'key',cfg.valueName||'value']));
    const data=names.map(()=>[]);const ids=[];
    let next=ctx&&ctx.nextRowId!=null?ctx.nextRowId:t.n;
    for(let r=0;r<t.n;r++)for(const vi of valIdx){
      const v=t.data[vi][r];
      if(cfg.skipBlank&&(v==null||String(v).trim()===''))continue;
      idIdx.forEach((ci,k)=>data[k].push(t.data[ci][r]));
      data[idIdx.length].push(t.cols[vi]);data[idIdx.length+1].push(v==null?'':v);ids.push(next++)
    }
    if(ctx)ctx.nextRowId=next;
    return{table:{cols:names,data,n:ids.length,rowIds:ids},stats:{added:ids.length-t.n}}
  },
  toDsl:cfg=>'wide to long keep '+cfg.idColumns.map(q).join(', ')+' unpivot '+cd(cfg.valueColumns)+' into '+q(cfg.keyName)+', '+q(cfg.valueName)+(cfg.skipBlank?' skip blanks':''),
  dslPattern:/^(wide to long|melt)\b/i,
  fromDsl(line){
    const cur=W.cursor(line);
    if(cur.optWord('melt')){}else cur.word('wide','to','long');
    cur.word('keep');const idColumns=cur.strList();cur.word('unpivot');const valueColumns=cur.cols();cur.word('into');const keyName=cur.str();cur.p(',');const valueName=cur.str();
    let skipBlank=false;if(cur.optWord('skip')){cur.word('blanks');skipBlank=true}cur.end();
    return{idColumns,valueColumns,keyName,valueName,skipBlank}
  },
  examples:[
    {cfg:{idColumns:['id'],valueColumns:['*'],keyName:'month',valueName:'sales',skipBlank:false},input:{cols:['id','jan','feb'],rows:[['a','1','2']]},expect:{cols:['id','month','sales'],rows:[['a','jan','1'],['a','feb','2']]}},
    {cfg:{idColumns:['id'],valueColumns:['q1','q2'],keyName:'k',valueName:'v',skipBlank:true},input:{cols:['id','q1','q2'],rows:[['a','','5']]},expect:{cols:['id','k','v'],rows:[['a','q2','5']]}}
  ]
});

function reduceVals(vals,policy){
  if(vals.length===1)return vals[0];
  if(policy==='last')return vals[vals.length-1];
  if(policy==='count')return String(vals.length);
  if(policy==='concat')return vals.filter(v=>v!=null&&v!=='').join(', ');
  if(policy==='sum'||policy==='min'||policy==='max'||policy==='average'){
    const loc=W.detectNumberLocale(vals);
    const nums=vals.map(v=>{const p=W.parseNumber(v,{locale:loc});return p?p.value:null}).filter(n=>n!=null);
    if(!nums.length)return'';
    if(policy==='sum')return W.canonicalNumber(nums.reduce((a,b)=>a+b,0));
    if(policy==='min')return W.canonicalNumber(Math.min.apply(null,nums));
    if(policy==='max')return W.canonicalNumber(Math.max.apply(null,nums));
    return W.canonicalNumber(nums.reduce((a,b)=>a+b,0)/nums.length)
  }
  return vals[0]
}
W.defineOp({
  id:'longToWide',label:'Long to wide',category:'reshape',
  keywords:['long','wide','pivot','reshape','spread','rows to columns','crosstab'],
  fields:[{key:'idColumns',type:'columns',label:'Group rows by',allowAll:true},{key:'keyColumn',type:'column',label:'Column whose values become new columns'},{key:'valueColumn',type:'column',label:'Column that fills the new columns'},{key:'duplicatePolicy',type:'select',label:'When a cell gets more than one value',options:[['error','Stop and tell me'],['first','Use the first'],['last','Use the last'],['sum','Add them up'],['count','Count them'],['average','Average them'],['min','Smallest'],['max','Largest'],['concat','List them all']]}],
  defaults:s=>({idColumns:[s.cols[0]],keyColumn:s.cols[1]||s.cols[0],valueColumn:s.cols[s.cols.length-1],duplicatePolicy:'error'}),
  describe:cfg=>'Turn values of "'+cfg.keyColumn+'" into columns filled from "'+cfg.valueColumn+'"'+(cfg.duplicatePolicy&&cfg.duplicatePolicy!=='error'?' ('+cfg.duplicatePolicy+' duplicates)':''),
  apply(t,cfg){
    const ki=W.needCol(t,cfg.keyColumn),vi=W.needCol(t,cfg.valueColumn);W.needCols(t,cfg.idColumns);
    const idIdx=W.resolveCols(t,cfg.idColumns).filter(i=>i!==ki&&i!==vi);
    const groups=new Map(),keys=[],seenK=new Set();let blank=0;
    for(let r=0;r<t.n;r++){
      const gk=JSON.stringify(idIdx.map(c=>t.data[c][r]));
      if(!groups.has(gk))groups.set(gk,{ids:idIdx.map(c=>t.data[c][r]),vals:{}});
      let k=String(t.data[ki][r]==null?'':t.data[ki][r]);if(k===''){blank++;k='(blank)'}
      const b=groups.get(gk).vals;(b[k]||(b[k]=[])).push(t.data[vi][r]);
      if(!seenK.has(k)){seenK.add(k);keys.push(k)}
    }
    let dup=0;const ex=[];
    groups.forEach(g=>{for(const k in g.vals)if(g.vals[k].length>1){dup++;if(ex.length<3)ex.push(k)}});
    const policy=cfg.duplicatePolicy||'error';
    if(dup&&policy==='error')throw new Error(W.plural(dup,'cell')+' would get more than one value (for example "'+ex.join('", "')+'"). Choose how to combine them.');
    if(keys.length>2000)throw new Error('This would create '+W.fmtInt(keys.length)+' columns. Pick a column with fewer distinct values.');
    const names=W.dedupeColNames(idIdx.map(i=>t.cols[i]).concat(keys));
    const data=names.map(()=>[]);
    for(const g of groups.values()){g.ids.forEach((v,k)=>data[k].push(v));keys.forEach((kv,k)=>data[idIdx.length+k].push(g.vals[kv]?reduceVals(g.vals[kv],policy):''))}
    const res={table:{cols:names,data,n:groups.size,rowIds:W.identity(groups.size,(t.nextIdBase||0))},stats:{removed:t.n-groups.size,addedCols:keys.length}};
    const notes=[];if(dup)notes.push(W.plural(dup,'cell')+' had several values, combined with "'+policy+'".');if(blank)notes.push(W.plural(blank,'row')+' had an empty key and went under "(blank)".');
    if(notes.length)res.warning=notes.join(' ');
    return res
  },
  toDsl:cfg=>'long to wide '+q(cfg.keyColumn)+' from '+q(cfg.valueColumn)+' group by '+cd(cfg.idColumns)+(cfg.duplicatePolicy&&cfg.duplicatePolicy!=='error'?' combine '+cfg.duplicatePolicy:''),
  dslPattern:/^(long to wide|pivot)\b/i,
  fromDsl(line){
    const cur=W.cursor(line);if(cur.optWord('pivot')){}else cur.word('long','to','wide');
    const keyColumn=cur.str();cur.word('from');const valueColumn=cur.str();cur.word('group','by');const idColumns=cur.cols();
    let duplicatePolicy='error';if(cur.optWord('combine'))duplicatePolicy=cur.oneOf(['first','last','sum','count','average','min','max','concat']);cur.end();
    return{idColumns,keyColumn,valueColumn,duplicatePolicy}
  },
  examples:[
    {cfg:{idColumns:['id'],keyColumn:'k',valueColumn:'v',duplicatePolicy:'error'},input:{cols:['id','k','v'],rows:[['a','x','1'],['a','y','2'],['b','x','3']]},expect:{cols:['id','x','y'],rows:[['a','1','2'],['b','3','']]}},
    {cfg:{idColumns:['id'],keyColumn:'k',valueColumn:'v',duplicatePolicy:'sum'},input:{cols:['id','k','v'],rows:[['a','x','1'],['a','x','2']]},expect:{cols:['id','x'],rows:[['a','3']]}}
  ]
});

const AGG_FNS=['count','sum','average','min','max','first','last','concat','distinct'];
W.parseMetric=function(s){
  s=String(s||'').trim();
  if(s==='count'||s==='*:count')return{column:null,fn:'count'};
  const i=s.lastIndexOf(':');if(i<=0)return null;
  const column=s.slice(0,i).trim();let fn=s.slice(i+1).trim().toLowerCase();if(fn==='avg'||fn==='mean')fn='average';
  if(!column||AGG_FNS.indexOf(fn)===-1)return null;
  return{column,fn}
};
W.defineOp({
  id:'aggregate',label:'Group and summarize',category:'reshape',
  keywords:['group','summarize','aggregate','sum','count','total','average','rollup','pivot table','subtotal'],
  fields:[{key:'groupBy',type:'columns',label:'Group by',allowAll:false},{key:'metrics',type:'metrics',label:'Calculate'}],
  defaults:(s,x)=>{const g=x&&x.cols&&x.cols.length?[x.cols[0]]:[s.cols[0]];const num=s.cols.find((c,i)=>s.types&&s.types[i]==='number'&&g.indexOf(c)===-1);return{groupBy:g,metrics:['count'].concat(num?[num+':sum']:[])}},
  validate:cfg=>!cfg.groupBy||!cfg.groupBy.length?'Pick at least one column to group by.':(!cfg.metrics||!cfg.metrics.length?'Add at least one calculation.':(cfg.metrics.some(m=>!W.parseMetric(m))?'Write calculations like amount:sum or count.':null)),
  describe:cfg=>'Group by '+cfg.groupBy.map(c=>'"'+c+'"').join(', ')+' and calculate '+cfg.metrics.join(', '),
  apply(t,cfg){
    W.needCols(t,cfg.groupBy);
    const gi=cfg.groupBy.map(c=>t.cols.indexOf(c));
    const ms=cfg.metrics.map(W.parseMetric);
    if(ms.some(m=>!m))throw new Error('Write calculations like amount:sum or count.');
    const mi=ms.map(m=>m.column?W.needCol(t,m.column):-1);
    const order=[],groups=new Map();
    for(let r=0;r<t.n;r++){const k=JSON.stringify(gi.map(c=>String(t.data[c][r]==null?'':t.data[c][r])));if(!groups.has(k)){groups.set(k,[]);order.push(k)}groups.get(k).push(r)}
    const locs=mi.map(i=>{if(i<0)return'us';const sm=[];for(let r=0;r<t.n&&sm.length<300;r++)if(t.data[i][r])sm.push(t.data[i][r]);return W.detectNumberLocale(sm)});
    const names=W.dedupeColNames(cfg.groupBy.concat(ms.map(m=>m.fn==='count'&&!m.column?'count':m.column+'_'+m.fn)));
    const data=names.map(()=>[]);
    for(const k of order){
      const rows=groups.get(k);gi.forEach((c,j)=>data[j].push(t.data[c][rows[0]]));
      ms.forEach((m,j)=>{
        let v;
        if(m.fn==='count'&&!m.column)v=String(rows.length);
        else{
          const vals=rows.map(r=>t.data[mi[j]][r]==null?'':String(t.data[mi[j]][r]));
          if(m.fn==='count')v=String(vals.filter(x=>x.trim()!=='').length);
          else if(m.fn==='first')v=vals[0];
          else if(m.fn==='last')v=vals[vals.length-1];
          else if(m.fn==='concat')v=vals.filter(x=>x!=='').join(', ');
          else if(m.fn==='distinct')v=String(new Set(vals.filter(x=>x.trim()!=='')).size);
          else{
            const nums=vals.map(x=>{const p=W.parseNumber(x,{locale:locs[j]});return p?p.value:null}).filter(x=>x!=null);
            if(!nums.length)v='';
            else if(m.fn==='sum')v=W.canonicalNumber(nums.reduce((a,b)=>a+b,0));
            else if(m.fn==='min')v=W.canonicalNumber(Math.min.apply(null,nums));
            else if(m.fn==='max')v=W.canonicalNumber(Math.max.apply(null,nums));
            else v=W.canonicalNumber(nums.reduce((a,b)=>a+b,0)/nums.length)
          }
        }
        data[gi.length+j].push(v)
      })
    }
    return{table:{cols:names,data,n:order.length,rowIds:W.identity(order.length)},stats:{removed:t.n-order.length}}
  },
  toDsl:cfg=>'group by '+cfg.groupBy.map(q).join(', ')+' calculate '+cfg.metrics.map(q).join(', '),
  dslPattern:/^(group by|aggregate group by)\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.optWord('aggregate');cur.word('group','by');const groupBy=cur.strList();if(!cur.optWord('calculate'))cur.word('metrics');const metrics=cur.strList();cur.end();return{groupBy,metrics}},
  examples:[
    {cfg:{groupBy:['region'],metrics:['count','amount:sum','amount:average']},input:{cols:['region','amount'],rows:[['east','$10'],['west','5'],['east','30']]},expect:{cols:['region','count','amount_sum','amount_average'],rows:[['east','2','40','20'],['west','1','5','5']]}},
    {cfg:{groupBy:['g'],metrics:['v:concat']},input:{cols:['g','v'],rows:[]},expect:{cols:['g','v_concat'],rows:[]}}
  ]
});

function joinKey(vals,norm){
  return JSON.stringify(vals.map(v=>{
    let s=String(v==null?'':v);
    if(norm.numeric&&s.trim()){const p=W.parseNumber(s);if(p)return String(p.value)}
    if(norm.trim)s=s.trim().replace(/\s+/g,' ');
    if(norm.caseFold)s=s.toLowerCase();
    return s
  }))
}
W.joinKey=joinKey;
const blankKey=p=>p.every(v=>String(v==null?'':v).trim()==='');
W.defineOp({
  id:'join',label:'Join with reference',category:'add',
  keywords:['join','lookup','vlookup','merge','reference','enrich','match','combine','left join'],
  fields:[{key:'refName',type:'reference',label:'Reference file'},{key:'type',type:'select',label:'Join type',options:[['left','Keep every row, add matching data'],['inner','Keep only rows with a match'],['semi','Keep rows that have a match (no new columns)'],['anti','Keep rows with no match']]},{key:'onLeft',type:'columns',label:'Match this table\'s column(s)',allowAll:false},{key:'onRight',type:'refColumns',label:'to the reference column(s)'},{key:'columns',type:'refColumns',label:'Columns to bring in (blank = all)',optional:true},{key:'normTrim',type:'checkbox',label:'Ignore extra spaces'},{key:'normCaseFold',type:'checkbox',label:'Ignore letter case'},{key:'normNumeric',type:'checkbox',label:'Match numbers regardless of format (007 = 7)'},{key:'onDuplicate',type:'select',label:'If several reference rows match',options:[['first','Use the first match'],['fanout','Add one row per match']]}],
  defaults:(s,x)=>({refName:(x&&x.refName)||'',type:'left',onLeft:[s.cols[0]],onRight:[],columns:[],normTrim:true,normCaseFold:false,normNumeric:false,onDuplicate:'first'}),
  validate:cfg=>!cfg.refName?'Load a reference file first.':(!cfg.onLeft||!cfg.onLeft.length?'Pick the column to match on.':(!cfg.onRight||cfg.onRight.length!==cfg.onLeft.length?'Pick the same number of reference columns to match.':null)),
  describe:cfg=>({left:'Add data from',inner:'Join with',semi:'Keep rows found in',anti:'Keep rows missing from'}[cfg.type||'left'])+' "'+cfg.refName+'" matching '+cfg.onLeft.map(c=>'"'+c+'"').join('+')+' to '+cfg.onRight.map(c=>'"'+c+'"').join('+'),
  apply(t,cfg,ctx){
    const ref=ctx&&ctx.refs&&ctx.refs[cfg.refName];
    if(!ref)throw new Error('Reference file "'+cfg.refName+'" is not loaded. Load it from Combine ▸ Load reference file.');
    W.needCols(t,cfg.onLeft);
    const li=cfg.onLeft.map(c=>t.cols.indexOf(c));
    const ri=cfg.onRight.map(c=>{const i=ref.cols.indexOf(c);if(i===-1)throw new Error('Column "'+c+'" not found in "'+cfg.refName+'".');return i});
    const norm={trim:!!cfg.normTrim,caseFold:!!cfg.normCaseFold,numeric:!!cfg.normNumeric};
    const idx=new Map();
    for(let r=0;r<ref.n;r++){const p=ri.map(c=>ref.data[c][r]);if(blankKey(p))continue;const k=joinKey(p,norm);(idx.get(k)||idx.set(k,[]).get(k)).push(r)}
    const look=r=>{const p=li.map(c=>t.data[c][r]);return blankKey(p)?null:idx.get(joinKey(p,norm))};
    const type=cfg.type||'left';
    if(type==='semi'||type==='anti'){
      const keep=[];for(let r=0;r<t.n;r++){const m=look(r);if((type==='semi')===!!(m&&m.length))keep.push(r)}
      return{table:W.pickRows(t,keep),stats:{removed:t.n-keep.length}}
    }
    const bring=(cfg.columns&&cfg.columns.length?cfg.columns:ref.cols.filter((c,i)=>ri.indexOf(i)===-1)).map(c=>ref.cols.indexOf(c)).filter(i=>i!==-1);
    const used=new Set(t.cols);
    const newNames=bring.map(b=>{let nm=ref.cols[b];if(used.has(nm))nm=nm+'_'+cfg.refName.replace(/\.[^.]+$/,'').replace(/\W+/g,'_').slice(0,20);let k=2,base=nm;while(used.has(nm)){nm=base+'_'+k;k++}used.add(nm);return nm});
    const out=t.cols.concat(newNames).map(()=>[]);const ids=[];
    let matched=0,unmatched=0,fan=0;let next=ctx&&ctx.nextRowId!=null?ctx.nextRowId:t.n;
    let dupKeys=0;idx.forEach(v=>{if(v.length>1)dupKeys++});
    for(let r=0;r<t.n;r++){
      const m=look(r);
      if(!m||!m.length){unmatched++;if(type==='left'){for(let c=0;c<t.cols.length;c++)out[c].push(t.data[c][r]);for(let k=0;k<bring.length;k++)out[t.cols.length+k].push('');ids.push(t.rowIds[r])}continue}
      matched++;
      const use=cfg.onDuplicate==='fanout'?m:[m[0]];
      use.forEach((rr,j)=>{for(let c=0;c<t.cols.length;c++)out[c].push(t.data[c][r]);bring.forEach((b,k)=>out[t.cols.length+k].push(ref.data[b][rr]));if(j===0)ids.push(t.rowIds[r]);else{ids.push(next++);fan++}})
    }
    if(ctx)ctx.nextRowId=next;
    const res={table:{cols:t.cols.concat(newNames),data:out,n:ids.length,rowIds:ids},stats:{matched,unmatched,addedCols:newNames.length,added:fan,removed:type==='inner'?unmatched:0},touched:W.allTouched(t,newNames)};
    const notes=[];
    notes.push(W.fmtInt(matched)+' matched, '+W.fmtInt(unmatched)+' did not.');
    if(dupKeys&&cfg.onDuplicate!=='fanout')notes.push(W.plural(dupKeys,'key')+' matched several reference rows; only the first was used.');
    if(fan)notes.push(W.plural(fan,'extra row')+' were added for multiple matches.');
    if(unmatched||dupKeys||fan)res.warning=notes.join(' ');
    return res
  },
  toDsl(cfg){
    let s='join '+q(cfg.refName)+' '+(cfg.type||'left')+' on '+cfg.onLeft.map(q).join(', ')+' = '+cfg.onRight.map(q).join(', ');
    const f=[];if(cfg.normTrim)f.push('trim');if(cfg.normCaseFold)f.push('casefold');if(cfg.normNumeric)f.push('numeric');
    if(f.length)s+=' normalize '+f.join(',');
    if(cfg.columns&&cfg.columns.length)s+=' bring '+cfg.columns.map(q).join(', ');
    if(cfg.onDuplicate==='fanout')s+=' duplicates fanout';
    return s
  },
  dslPattern:/^join\b/i,
  fromDsl(line){
    const cur=W.cursor(line);cur.word('join');
    const cfg={refName:cur.str(),type:cur.oneOf(['left','inner','semi','anti']),onLeft:[],onRight:[],columns:[],normTrim:false,normCaseFold:false,normNumeric:false,onDuplicate:'first'};
    cur.word('on');cfg.onLeft=cur.strList();cur.word('=');cfg.onRight=cur.strList();
    while(!cur.done()){
      if(cur.optWord('normalize')){do{const x=cur.anyWord().toLowerCase();if(x==='trim')cfg.normTrim=true;else if(x==='casefold')cfg.normCaseFold=true;else if(x==='numeric')cfg.normNumeric=true;else throw new Error('Unknown normalize option "'+x+'".')}while(cur.optP(','))}
      else if(cur.optWord('bring'))cfg.columns=cur.cols().filter(c=>c!=='*');
      else{cur.word('duplicates');cfg.onDuplicate=cur.oneOf(['first','fanout'])}
    }
    return cfg
  },
  examples:[
    {cfg:{refName:'people',type:'left',onLeft:['id'],onRight:['id'],columns:['name'],normTrim:true,normCaseFold:false,normNumeric:true,onDuplicate:'first'},refs:{people:{cols:['id','name'],rows:[['7','Ada']]}},input:{cols:['id'],rows:[[' 007 '],['8']]},expect:{cols:['id','name'],rows:[[' 007 ','Ada'],['8','']]}},
    {cfg:{refName:'people',type:'anti',onLeft:['id'],onRight:['id'],columns:[],normTrim:false,normCaseFold:false,normNumeric:false,onDuplicate:'first'},refs:{people:{cols:['id'],rows:[['1']]}},input:{cols:['id'],rows:[['1'],['2'],['']]},expect:{cols:['id'],rows:[['2'],['']]}}
  ]
});

W.defineOp({
  id:'diff',label:'Compare with reference',category:'add',
  keywords:['diff','compare','changes','changed','added','removed','reconcile','reference'],
  fields:[{key:'refName',type:'reference',label:'Reference file (the older version)'},{key:'keyColumns',type:'columns',label:'Match rows on',allowAll:false},{key:'compareColumns',type:'columns',label:'Compare these columns',allowAll:true},{key:'includeRemoved',type:'checkbox',label:'Add rows that only exist in the reference'},{key:'onDuplicateRef',type:'select',label:'If a key appears more than once in the reference',options:[['error','Stop and tell me'],['first','Use the first'],['last','Use the last']]}],
  defaults:(s,x)=>({refName:(x&&x.refName)||'',keyColumns:[s.cols[0]],compareColumns:['*'],includeRemoved:true,onDuplicateRef:'error'}),
  validate:cfg=>!cfg.refName?'Load a reference file first.':(!cfg.keyColumns||!cfg.keyColumns.length?'Pick the column that identifies each row.':null),
  describe:cfg=>'Compare with "'+cfg.refName+'" by '+cfg.keyColumns.map(c=>'"'+c+'"').join('+'),
  apply(t,cfg,ctx){
    const ref=ctx&&ctx.refs&&ctx.refs[cfg.refName];
    if(!ref)throw new Error('Reference file "'+cfg.refName+'" is not loaded. Load it from Combine ▸ Load reference file.');
    W.needCols(t,cfg.keyColumns);
    const ki=cfg.keyColumns.map(c=>t.cols.indexOf(c));
    const rki=cfg.keyColumns.map(c=>{const i=ref.cols.indexOf(c);if(i===-1)throw new Error('Column "'+c+'" not found in "'+cfg.refName+'".');return i});
    const cmp=(cfg.compareColumns&&cfg.compareColumns[0]!=='*'?cfg.compareColumns:t.cols.filter((c,i)=>ki.indexOf(i)===-1&&ref.cols.indexOf(c)!==-1)).map(c=>[t.cols.indexOf(c),ref.cols.indexOf(c)]).filter(p=>p[0]!==-1&&p[1]!==-1);
    const idx=new Map();
    for(let r=0;r<ref.n;r++){const p=rki.map(c=>ref.data[c][r]);if(blankKey(p))continue;const k=joinKey(p,{});(idx.get(k)||idx.set(k,[]).get(k)).push(r)}
    let dup=0;idx.forEach(v=>{if(v.length>1)dup++});
    const pol=cfg.onDuplicateRef||'error';
    if(dup&&pol==='error')throw new Error(W.plural(dup,'key')+' appear more than once in "'+cfg.refName+'". Choose first or last.');
    const status=new Array(t.n),detail=new Array(t.n);const used=new Set();let added=0,changed=0,same=0;
    for(let r=0;r<t.n;r++){
      const p=ki.map(c=>t.data[c][r]);const m=blankKey(p)?null:idx.get(joinKey(p,{}));
      if(!m){status[r]='added';detail[r]='';added++;continue}
      m.forEach(x=>used.add(x));const rr=pol==='last'?m[m.length-1]:m[0];
      const diffs=[];for(const[a,b]of cmp){const va=String(t.data[a][r]==null?'':t.data[a][r]),vb=String(ref.data[b][rr]==null?'':ref.data[b][rr]);if(va!==vb)diffs.push(t.cols[a]+': '+W.trunc(vb,30)+' → '+W.trunc(va,30))}
      if(diffs.length){status[r]='changed';detail[r]=diffs.join('; ');changed++}else{status[r]='unchanged';detail[r]='';same++}
    }
    const names=W.dedupeColNames(t.cols.concat(['_diff','_changes']));
    const data=t.data.concat([status,detail]).map(c=>c.slice());
    const ids=Array.from(t.rowIds);let removed=0;let next=ctx&&ctx.nextRowId!=null?ctx.nextRowId:t.n;
    if(cfg.includeRemoved){
      for(let r=0;r<ref.n;r++){
        if(used.has(r)||blankKey(rki.map(c=>ref.data[c][r])))continue;
        removed++;
        t.cols.forEach((c,i)=>{const j=ref.cols.indexOf(c);data[i].push(j===-1?'':ref.data[j][r])});
        data[t.cols.length].push('removed');data[t.cols.length+1].push('');ids.push(next++)
      }
    }
    if(ctx)ctx.nextRowId=next;
    const res={table:{cols:names,data,n:ids.length,rowIds:ids},stats:{addedCols:2,added:removed},touched:W.allTouched(t,[names[names.length-2],names[names.length-1]])};
    res.warning=W.fmtInt(added)+' added, '+W.fmtInt(changed)+' changed, '+W.fmtInt(removed)+' removed, '+W.fmtInt(same)+' unchanged.';
    return res
  },
  toDsl:cfg=>'diff '+q(cfg.refName)+' key '+cfg.keyColumns.map(q).join(', ')+' compare '+cd(cfg.compareColumns)+(cfg.includeRemoved?' include-removed':'')+(cfg.onDuplicateRef&&cfg.onDuplicateRef!=='error'?' duplicates '+cfg.onDuplicateRef:''),
  dslPattern:/^(diff|compare with)\b/i,
  fromDsl(line){
    const cur=W.cursor(line);if(cur.optWord('compare'))cur.word('with');else cur.word('diff');
    const cfg={refName:cur.str(),keyColumns:[],compareColumns:['*'],includeRemoved:false,onDuplicateRef:'error'};
    cur.word('key');cfg.keyColumns=cur.strList();
    while(!cur.done()){if(cur.optWord('compare'))cfg.compareColumns=cur.cols();else if(cur.optWord('include-removed'))cfg.includeRemoved=true;else{cur.word('duplicates');cfg.onDuplicateRef=cur.oneOf(['first','last','error'])}}
    return cfg
  },
  examples:[
    {cfg:{refName:'old',keyColumns:['id'],compareColumns:['*'],includeRemoved:true,onDuplicateRef:'error'},refs:{old:{cols:['id','v'],rows:[['1','a'],['2','b'],['3','c']]}},input:{cols:['id','v'],rows:[['1','a'],['2','B'],['4','d']]},expect:{cols:['id','v','_diff','_changes'],rows:[['1','a','unchanged',''],['2','B','changed','v: b → B'],['4','d','added',''],['3','c','removed','']]}},
    {cfg:{refName:'old',keyColumns:['id'],compareColumns:['*'],includeRemoved:false,onDuplicateRef:'first'},refs:{old:{cols:['id'],rows:[['1'],['1']]}},input:{cols:['id'],rows:[['1']]},expect:{cols:['id','_diff','_changes'],rows:[['1','unchanged','']]}}
  ]
});
})(typeof self!=='undefined'?self:globalThis);
