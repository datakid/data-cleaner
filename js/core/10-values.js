(function(G){
'use strict';
const W=G.WeftCore;
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const M3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
W.M3=M3;
function mk(y,mo,d){
  if(!(y>=1000&&y<=2999)||mo<1||mo>12||d<1||d>31)return null;
  const dt=new Date(Date.UTC(y,mo-1,d));
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d?{y,mo,d}:null
}
function yy(s,pivot){let y=+s;if(s.length<=2)y=y<=pivot?2000+y:1900+y;return y}
W.parseDate=function(s,opts){
  opts=opts||{};
  const order=opts.order||'mdy',pivot=opts.yearPivot!=null?opts.yearPivot:69;
  s=String(s==null?'':s).trim();
  if(!s||s.length>40)return null;
  let m;
  if((m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}:?\d{2})?)?$/)))return mk(+m[1],+m[2],+m[3]);
  if((m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp][Mm])?)?$/))){
    const a=+m[1],b=+m[2],y=yy(m[3],pivot);
    if(a>12&&b<=12)return mk(y,b,a);
    if(b>12&&a<=12)return mk(y,a,b);
    if(a>12&&b>12)return null;
    if(order==='reject'&&a!==b)return null;
    return order==='dmy'?mk(y,b,a):mk(y,a,b)
  }
  if((m=s.match(/^(?:[A-Za-z]{3,9},?\s+)?([A-Za-z]{3,9})\.?[\s\-.]+(\d{1,2})(?:st|nd|rd|th)?[\s\-,]+(\d{2,4})$/))){
    const mo=MON[m[1].slice(0,3).toLowerCase()];return mo?mk(yy(m[3],pivot),mo,+m[2]):null
  }
  if((m=s.match(/^(?:[A-Za-z]{3,9},?\s+)?(\d{1,2})(?:st|nd|rd|th)?[\s\-.]+([A-Za-z]{3,9})\.?[\s\-,]+(\d{2,4})$/))){
    const mo=MON[m[2].slice(0,3).toLowerCase()];return mo?mk(yy(m[3],pivot),mo,+m[1]):null
  }
  if((m=s.match(/^(\d{4})(\d{2})(\d{2})$/)))return mk(+m[1],+m[2],+m[3]);
  return null
};
W.isDateAmbiguous=function(s){
  const m=String(s).trim().match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.]\d{2,4}$/);
  if(!m)return false;
  const a=+m[1],b=+m[2];
  return a<=12&&b<=12&&a!==b
};
W.fmtDateAs=function(d,fmt){
  const p2=x=>String(x).padStart(2,'0');
  if(fmt==='us')return p2(d.mo)+'/'+p2(d.d)+'/'+d.y;
  if(fmt==='eu')return p2(d.d)+'/'+p2(d.mo)+'/'+d.y;
  if(fmt==='long')return M3[d.mo-1]+' '+d.d+', '+d.y;
  if(fmt==='compact')return d.y+p2(d.mo)+p2(d.d);
  return d.y+'-'+p2(d.mo)+'-'+p2(d.d)
};
W.dateKey=function(d){return d?d.y*10000+d.mo*100+d.d:NaN};

const CUR=/[$€£¥₹₩₽₺₴₦₪﷼]/g;
W.parseNumber=function(raw,opts){
  opts=opts||{};
  const locale=opts.locale||'us';
  let s=String(raw==null?'':raw).trim();
  if(s===''||s.length>40)return null;
  if(s.length<16){const c0=s.charCodeAt(0);if((c0>=48&&c0<=57)||c0===45){if(locale==='eu'?/^-?\d+$/.test(s):/^-?\d+(\.\d+)?$/.test(s)){const v=+s;return{value:v,isPercent:false,negative:c0===45}}}}
  let neg=false;
  if(s.length>1&&s[0]==='('&&s[s.length-1]===')'){neg=true;s=s.slice(1,-1).trim()}
  if(s[0]==='-'||s[0]==='−'){neg=true;s=s.slice(1).trim()}
  else if(s[0]==='+')s=s.slice(1).trim();
  const pct=/%\s*$/.test(s);
  if(pct)s=s.replace(/%\s*$/,'').trim();
  s=s.replace(CUR,'').replace(/^(usd|eur|gbp)\s*/i,'').replace(/\s*(usd|eur|gbp)$/i,'');
  if(s[0]==='-'){neg=!neg;s=s.slice(1)}
  s=s.replace(/[\s\u00A0\u202F']/g,'');
  if(!s)return null;
  if(locale==='eu'){
    if(!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(s))return null;
    s=s.replace(/\./g,'').replace(',','.')
  }else{
    if(!/^\d{1,3}(,\d{3})*(\.\d+)?$|^\d*\.?\d+$|^\d+\.$/.test(s)&&!/^\d+(\.\d+)?[eE][+-]?\d+$/.test(s))return null;
    s=s.replace(/,/g,'')
  }
  const num=Number(s);
  if(!isFinite(num))return null;
  return{value:(neg?-Math.abs(num):num)*(pct&&opts.percentAsFraction!==false?0.01:1),isPercent:pct,negative:neg}
};
W.detectNumberLocale=function(values){
  let us=0,eu=0;
  for(const raw of values){
    const s=String(raw==null?'':raw).trim().replace(CUR,'').replace(/[\s()%+-]/g,'');
    if(!s)continue;
    if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)||/^\d+\.\d{1,2}$/.test(s))us++;
    else if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)||/^\d+,\d{1,2}$/.test(s))eu++
  }
  return eu>us?'eu':'us'
};
W.canonicalNumber=function(v){
  if(!isFinite(v))return'';
  if(Number.isInteger(v))return String(v);
  return String(Math.round(v*1e10)/1e10)
};

W.inferType=function(col,n,ctx){
  ctx=ctx||{};
  const sampleN=Math.min(n,400);
  let seen=0,num=0,date=0;
  const vals=[];
  for(let r=0;r<sampleN;r++){const v=String(col[r]==null?'':col[r]).trim();if(v)vals.push(v)}
  const locale=W.detectNumberLocale(vals);
  for(const v of vals){
    seen++;
    if(W.parseNumber(v,{locale}))num++;
    else if(W.parseDate(v,{order:ctx.dateOrder||'mdy',yearPivot:ctx.yearPivot}))date++
  }
  if(!seen)return'text';
  if(num/seen>=0.9)return'number';
  if(date/seen>=0.9)return'date';
  if((num+date)/seen>=0.9&&date>num)return'date';
  return'text'
};
W.inferTypes=function(t,ctx){return t.cols.map((_,c)=>W.inferType(t.data[c],t.n,ctx))};

W.sortKeysFor=function(col,type,ctx){
  ctx=ctx||{};
  const n=col.length;
  if(type==='number'){
    const sample=[];for(let r=0;r<n&&sample.length<250;r++){const v=col[r];if(v!=null&&String(v).trim()!=='')sample.push(v)}
    const locale=W.detectNumberLocale(sample);
    const k=new Float64Array(n);
    for(let r=0;r<n;r++){const p=W.parseNumber(col[r],{locale});k[r]=p?p.value:NaN}
    return k
  }
  if(type==='date'){
    const k=new Float64Array(n);
    for(let r=0;r<n;r++)k[r]=W.dateKey(W.parseDate(col[r],{order:ctx.dateOrder,yearPivot:ctx.yearPivot}));
    return k
  }
  const k=new Array(n);
  for(let r=0;r<n;r++)k[r]=String(col[r]==null?'':col[r]).trim().toLowerCase();
  return k
};
W.sortPositions=function(positions,keySets){
  const coll=typeof Intl!=='undefined'?new Intl.Collator(undefined,{numeric:true,sensitivity:'base'}):null;
  const cmpText=coll?coll.compare:(a,b)=>a<b?-1:a>b?1:0;
  const idx=positions.map((p,i)=>i);
  idx.sort((ia,ib)=>{
    const a=positions[ia],b=positions[ib];
    for(const ks of keySets){
      const ka=ks.keys[a],kb=ks.keys[b];
      const text=ks.type==='text';
      const ea=text?ka==='':Number.isNaN(ka),eb=text?kb==='':Number.isNaN(kb);
      if(ea&&eb)continue;
      if(ea)return 1;
      if(eb)return-1;
      const c=text?cmpText(ka,kb):(ka-kb);
      if(c!==0)return ks.dir*c
    }
    return ia-ib
  });
  return idx.map(i=>positions[i])
};
})(typeof self!=='undefined'?self:globalThis);
