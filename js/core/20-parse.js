(function(G){
'use strict';
const W=G.WeftCore;

function isTrimWs(c){return c===32||(c>=9&&c<=13)||c===160||c===0xFEFF||c===0x1680||(c>=0x2000&&c<=0x200A)||c===0x2028||c===0x2029||c===0x202F||c===0x205F||c===0x3000}
function lineAt(text,pos){let k=1,i=-1;while((i=text.indexOf('\n',i+1))!==-1&&i<pos)k++;return k}
function parseFast(text,delim,quote,limitRows){
  const n=text.length,D=delim.charCodeAt(0),Q=quote?quote.charCodeAt(0):-1;
  const rows=[];let row=[];
  let f='',start=0,blank=true,cr=false,i=0;
  const take=end=>{let seg=text.slice(start,end);if(cr)seg=seg.replace(/\r/g,'');return f===''?seg:f+seg};
  while(i<n){
    const c=text.charCodeAt(i);
    if(c===D){row.push(take(i));i++;f='';start=i;blank=true;cr=false;continue}
    if(c===10){row.push(take(i));rows.push(row);row=[];i++;f='';start=i;blank=true;cr=false;if(limitRows&&rows.length>=limitRows)return rows;continue}
    if(c===Q&&blank){
      const open=i;f='';i++;
      for(;;){
        const k=text.indexOf(quote,i);
        if(k===-1)throw new Error('A quoted field starting near line '+lineAt(text,open)+' is never closed. A closing '+quote+' is missing.');
        if(text.charCodeAt(k+1)===Q){f+=text.slice(i,k+1);i=k+2;continue}
        f+=text.slice(i,k);i=k+1;break
      }
      start=i;cr=false;blank=f.trim()==='';
      continue
    }
    if(c===13)cr=true;else if(blank&&!isTrimWs(c))blank=false;
    i++
  }
  const last=take(n);
  if(last!==''||row.length){row.push(last);rows.push(row)}
  return rows
}
W.parseDelimited=function(text,delim,quote,limitRows){
  quote=quote===undefined?'"':quote;
  if(typeof delim==='string'&&delim.length===1&&delim!=='\n'&&delim!=='\r'&&(quote===''||quote.length===1)&&delim!==quote)return parseFast(text,delim,quote,limitRows);
  const rows=[];let row=[],f='',q=false,line=1,qLine=0;
  const n=text.length;
  for(let i=0;i<n;i++){
    const c=text[i];
    if(q){
      if(c===quote){
        if(text[i+1]===quote){f+=quote;i++}
        else q=false
      }else{if(c==='\n')line++;f+=c}
    }else{
      if(quote&&c===quote&&f.trim()===''){q=true;qLine=line;f=''}
      else if(c===delim){row.push(f);f=''}
      else if(c==='\n'){row.push(f);f='';rows.push(row);row=[];line++;if(limitRows&&rows.length>=limitRows)return rows}
      else if(c!=='\r')f+=c
    }
  }
  if(q)throw new Error('A quoted field starting near line '+qLine+' is never closed. A closing '+quote+' is missing.');
  if(f!==''||row.length){row.push(f);rows.push(row)}
  return rows
};
W.toDelimited=function(cols,rows,delim,opts){
  opts=opts||{};
  const eol=opts.eol||'\n';
  const guard=opts.formulaGuard;
  const q=v=>{
    let s=String(v==null?'':v);
    if(guard&&/^[=+\-@\t\r]/.test(s)&&!/^-?\d+(\.\d+)?$/.test(s))s="'"+s;
    return(s.indexOf(delim)!==-1||s.indexOf('"')!==-1||s.indexOf('\n')!==-1||s.indexOf('\r')!==-1)?'"'+s.replace(/"/g,'""')+'"':s
  };
  const out=[];
  if(cols)out.push(cols.map(q).join(delim));
  for(const r of rows)out.push(r.map(q).join(delim));
  return out.join(eol)
};

const MAX_DEPTH=25,MAX_COLS=2000;
W.flattenValue=function(value,prefix,out){
  const stack=[{v:value,p:prefix||'',d:0}];
  let truncated=false,count=Object.keys(out).length;
  while(stack.length){
    const fr=stack.pop(),v=fr.v,p=fr.p;
    if(count>=MAX_COLS){truncated=true;break}
    if(v===null||typeof v!=='object'){if(!(p in out))count++;out[p||'value']=v==null?'':String(v);continue}
    if(fr.d>=MAX_DEPTH){out[p||'value']=JSON.stringify(v).slice(0,2000);count++;continue}
    if(Array.isArray(v)){
      if(!v.length){out[p||'value']='[]';count++;continue}
      if(v.every(x=>x===null||typeof x!=='object')&&v.length>8){out[p||'value']=v.map(x=>x==null?'':String(x)).join('; ');count++;continue}
      for(let i=v.length-1;i>=0;i--)stack.push({v:v[i],p:p?p+'['+i+']':'['+i+']',d:fr.d+1});
      continue
    }
    const keys=Object.keys(v);
    if(!keys.length){out[p||'value']='{}';count++;continue}
    for(let i=keys.length-1;i>=0;i--)stack.push({v:v[keys[i]],p:p?p+'.'+keys[i]:keys[i],d:fr.d+1})
  }
  return truncated
};
function findRecordArray(val){
  if(Array.isArray(val))return{arr:val,path:''};
  if(val&&typeof val==='object'){
    const keys=Object.keys(val);
    let best=null;
    for(const k of keys){
      const v=val[k];
      if(Array.isArray(v)&&v.length&&v.every(x=>x&&typeof x==='object'&&!Array.isArray(x))){
        if(!best||v.length>best.arr.length)best={arr:v,path:k}
      }
    }
    if(best&&best.arr.length>=2)return best
  }
  return{arr:[val],path:''}
}
W.jsonToMatrix=function(val){
  const found=findRecordArray(val);
  const arr=found.arr;
  const warnings=[];
  if(!arr.length)return{cols:[],rows:[],warnings:['The JSON array is empty.']};
  if(found.path)warnings.push('Read the records in "'+found.path+'".');
  if(arr.every(r=>Array.isArray(r))){
    let w=0;for(const r of arr)if(r.length>w)w=r.length;
    const first=arr[0];
    const headerLike=arr.length>1&&first.every(x=>typeof x==='string'&&x.trim()!=='')&&new Set(first).size===first.length&&arr.slice(1).some(r=>r.some(x=>typeof x==='number'));
    const cols=headerLike?W.dedupeColNames(first.map(String)):W.identity(w,1).map(i=>'column_'+i);
    const body=headerLike?arr.slice(1):arr;
    const rows=body.map(r=>{const o=[];for(let i=0;i<w;i++){const v=r[i];o.push(v==null?'':typeof v==='object'?JSON.stringify(v):String(v))}return o});
    return{cols,rows,warnings}
  }
  let trunc=false;
  const recs=arr.map(o=>{
    const out={};
    if(o===null||typeof o!=='object'){out.value=o==null?'':String(o);return out}
    if(W.flattenValue(o,'',out))trunc=true;
    return out
  });
  const cols=[],seen=new Set();
  for(const r of recs)for(const k in r)if(!seen.has(k)){seen.add(k);cols.push(k)}
  const rows=recs.map(r=>cols.map(k=>r[k]===undefined?'':r[k]));
  if(cols.length>500)warnings.push('Flattening produced '+W.fmtInt(cols.length)+' columns. The JSON is very wide or deeply nested.');
  if(trunc)warnings.push('Some very large records were cut short while flattening.');
  return{cols,rows,warnings}
};

W.makeTable=function(cols,rows,opts){
  opts=opts||{};
  let w=cols.length;
  for(const r of rows)if(r.length>w)w=r.length;
  const names=cols.slice();
  const extra=[];
  for(let i=cols.length;i<w;i++){const nm=(opts.extraPrefix||'extra_')+(i-cols.length+1);names.push(nm);extra.push(nm)}
  const finalCols=W.dedupeColNames(names.map((c,i)=>{c=String(c==null?'':c).trim();return c||'column_'+(i+1)}));
  const n=rows.length;
  const data=finalCols.map(()=>new Array(n));
  let padded=0;
  for(let r=0;r<n;r++){
    const row=rows[r];
    if(row.length<w&&row.length>0&&!(row.length===1&&row[0]===''))padded++;
    for(let c=0;c<w;c++){const v=row[c];data[c][r]=v==null?'':String(v)}
  }
  const warnings=[];
  if(extra.length&&cols.length)warnings.push('Some rows had more fields than the header, so '+W.plural(extra.length,'column')+' ('+extra.join(', ')+') were added. No values were dropped.');
  const start=opts.idStart||0;
  return{cols:finalCols,data,n,rowIds:W.identity(n,start),warnings,padded}
};
W.emptyTable=function(){return{cols:[],data:[],n:0,rowIds:[]}};
W.tableRows=function(t,limit){
  const n=Math.min(t.n,limit==null?t.n:limit),out=[];
  for(let r=0;r<n;r++){const row=[];for(let c=0;c<t.cols.length;c++)row.push(t.data[c][r]);out.push(row)}
  return out
};
W.tableFromRows=function(cols,rows){
  const n=rows.length,data=cols.map(()=>new Array(n));
  for(let r=0;r<n;r++)for(let c=0;c<cols.length;c++){const v=rows[r][c];data[c][r]=v==null?'':String(v)}
  return{cols:cols.slice(),data,n,rowIds:W.identity(n)}
};
W.pickRows=function(t,keep,newIds){
  const data=t.data.map(col=>{const a=new Array(keep.length);for(let i=0;i<keep.length;i++)a[i]=col[keep[i]];return a});
  const rowIds=newIds||keep.map(r=>t.rowIds[r]);
  return{cols:t.cols,data,n:keep.length,rowIds}
};
W.colIdx=function(t,name){return t.cols.indexOf(name)};
W.resolveCols=function(t,names){
  if(!names||!names.length||names[0]==='*')return t.cols.map((_,i)=>i);
  return names.map(c=>t.cols.indexOf(c)).filter(i=>i!==-1)
};
W.missingCols=function(t,names){
  if(!names)return[];
  return names.filter(c=>c!=='*'&&t.cols.indexOf(c)===-1)
};
W.cow=function(t,idx){
  const s=idx instanceof Set?idx:new Set(idx);
  return t.data.map((col,ci)=>s.has(ci)?col.slice():col)
};
W.notFound=function(t,name){
  return'Column "'+name+'" not found. Available: '+W.trunc(t.cols.join(', '),160)+'.'
};
})(typeof self!=='undefined'?self:globalThis);
