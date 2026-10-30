(function(G){
'use strict';
const W=G.WeftCore;
const MAX_LEN=2000,MAX_DEPTH=64;
const NONWS=/\S/;
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function FErr(code){this.code=code}
const ERR={};
['#VALUE!','#DIV/0!','#REF!','#NAME?','#NUM!','#N/A'].forEach(c=>{ERR[c]=Object.freeze(new FErr(c))});
const VALUE=ERR['#VALUE!'],DIV0=ERR['#DIV/0!'],REF=ERR['#REF!'],NAME=ERR['#NAME?'],NUM=ERR['#NUM!'],NA=ERR['#N/A'];
function FDate(n){this.n=n}
function FSyntax(message,pos,end,err){this.message=message;this.pos=pos;this.end=end==null?pos+1:end;this.err=err||null}

const NUM_RE=/(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const ID_RE=/[\p{L}_][\p{L}\p{N}_.]*/uy;
const WS_RE=/\s/;

function Lexer(src,prefix){this.s=src;this.i=0;this.prefix=prefix;this.first=true}
Lexer.prototype.next=function(){
  const s=this.s,n=s.length;
  while(this.i<n&&WS_RE.test(s[this.i]))this.i++;
  const pos=this.i;
  if(pos>=n)return{k:'eof',pos,end:pos};
  const c=s[pos];
  if(this.first){
    this.first=false;
    if(c==='='){this.i++;return this.next()}
  }
  if((c>='0'&&c<='9')||(c==='.'&&s[pos+1]>='0'&&s[pos+1]<='9')){
    NUM_RE.lastIndex=pos;
    const m=NUM_RE.exec(s);
    this.i=pos+m[0].length;
    return{k:'num',v:Number(m[0]),pos,end:this.i}
  }
  if(c==='"'){
    let j=pos+1,out='';
    for(;;){
      if(j>=n)throw new FSyntax('Text is missing its closing quote',pos,n);
      if(s[j]==='"'){if(s[j+1]==='"'){out+='"';j+=2;continue}break}
      out+=s[j];j++
    }
    this.i=j+1;
    return{k:'str',v:out,pos,end:this.i}
  }
  if(c==='['){
    let j=pos+1,out='';
    for(;;){
      if(j>=n)throw new FSyntax('Column name is missing its closing ]',pos,n);
      if(s[j]===']'){if(s[j+1]===']'){out+=']';j+=2;continue}break}
      out+=s[j];j++
    }
    if(!out.trim())throw new FSyntax('Column name is empty',pos,j+1);
    this.i=j+1;
    return{k:'ref',v:out,pos,end:this.i}
  }
  ID_RE.lastIndex=pos;
  const im=ID_RE.exec(s);
  if(im){this.i=pos+im[0].length;return{k:'id',v:im[0],pos,end:this.i}}
  const two=s.substr(pos,2);
  if(two==='<>'||two==='<='||two==='>='){this.i=pos+2;return{k:'op',v:two,pos,end:this.i}}
  if('+-*/^&=<>(),%'.indexOf(c)!==-1){this.i=pos+1;return{k:'op',v:c,pos,end:this.i}}
  throw new FSyntax('Unexpected character "'+c+'"',pos,pos+1)
};

function Parser(src,prefix){
  this.src=src;this.prefix=prefix;this.lx=new Lexer(src,prefix);this.lastEnd=0;this.t=null;
  this.pull()
}
Parser.prototype.pull=function(){
  if(!this.prefix){this.t=this.lx.next();return}
  try{this.t=this.lx.next()}
  catch(e){if(e instanceof FSyntax)this.t={k:'bad',pos:e.pos,end:e.end,err:e};else throw e}
};
Parser.prototype.adv=function(){const t=this.t;this.lastEnd=t.end;this.pull();return t};
Parser.prototype.isOp=function(v){return this.t.k==='op'&&this.t.v===v};
Parser.prototype.fail=function(t){
  if(t.k==='bad'&&t.err)throw t.err;
  if(t.k==='eof')throw new FSyntax('The formula ends too soon. Something is missing after the last part',Math.max(0,t.pos-1),t.pos);
  const text=t.k==='str'?'"'+t.v+'"':t.k==='ref'?'['+t.v+']':t.k==='num'?String(t.v):t.v;
  throw new FSyntax('Unexpected '+(t.k==='op'?'"'+text+'"':'"'+text+'"'),t.pos,t.end)
};
Parser.prototype.enter=function(d,t){
  if(d+1>MAX_DEPTH)throw new FSyntax('This formula is nested too deeply (the limit is '+MAX_DEPTH+' levels)',t.pos,t.end);
  return d+1
};
Parser.prototype.parseAll=function(){
  if(this.t.k==='eof')throw new FSyntax('Type a formula, for example [Qty] * [Price]',0,1);
  const e=this.cmp(0);
  if(this.t.k!=='eof'&&!this.prefix)this.fail(this.t);
  return e
};
Parser.prototype.cmp=function(d){
  let l=this.cat(d);
  for(;;){
    const t=this.t;
    if(t.k==='op'&&(t.v==='='||t.v==='<>'||t.v==='<'||t.v==='>'||t.v==='<='||t.v==='>=')){
      this.adv();
      const r=this.cat(d);
      l={t:'bin',op:t.v,l,r,pos:t.pos}
    }else return l
  }
};
Parser.prototype.cat=function(d){
  const first=this.add(d);
  if(!this.isOp('&'))return first;
  const parts=[first];
  while(this.isOp('&')){this.adv();parts.push(this.add(d))}
  return{t:'cat',parts,pos:first.pos}
};
Parser.prototype.add=function(d){
  let l=this.mul(d);
  while(this.t.k==='op'&&(this.t.v==='+'||this.t.v==='-')){
    const t=this.adv();
    l={t:'bin',op:t.v,l,r:this.mul(d),pos:t.pos}
  }
  return l
};
Parser.prototype.mul=function(d){
  let l=this.pow(d);
  while(this.t.k==='op'&&(this.t.v==='*'||this.t.v==='/')){
    const t=this.adv();
    l={t:'bin',op:t.v,l,r:this.pow(d),pos:t.pos}
  }
  return l
};
Parser.prototype.pow=function(d){
  let l=this.unary(d);
  while(this.isOp('^')){
    const t=this.adv();
    l={t:'bin',op:'^',l,r:this.unary(d),pos:t.pos}
  }
  return l
};
Parser.prototype.unary=function(d){
  const t=this.t;
  if(t.k==='op'&&(t.v==='-'||t.v==='+')){
    const nd=this.enter(d,t);
    this.adv();
    const e=this.unary(nd);
    return t.v==='-'?{t:'neg',e,pos:t.pos}:e
  }
  return this.postfix(d)
};
Parser.prototype.postfix=function(d){
  let e=this.primary(d);
  while(this.isOp('%')){const t=this.adv();e={t:'pct',e,pos:t.pos}}
  return e
};
Parser.prototype.primary=function(d){
  const t=this.t;
  if(t.k==='num'){this.adv();return{t:'num',v:t.v,pos:t.pos,end:t.end}}
  if(t.k==='str'){this.adv();return{t:'str',v:t.v,pos:t.pos,end:t.end}}
  if(t.k==='ref'){this.adv();return{t:'ref',name:t.v,pos:t.pos,end:t.end}}
  if(t.k==='op'&&t.v==='('){
    const nd=this.enter(d,t);
    this.adv();
    const e=this.cmp(nd);
    if(!this.isOp(')')){
      if(this.t.k==='eof')throw new FSyntax('A ( is missing its closing )',t.pos,t.end);
      this.fail(this.t)
    }
    this.adv();
    return{t:'group',e,pos:t.pos}
  }
  if(t.k==='id'){
    this.adv();
    if(this.isOp('(')){
      const nd=this.enter(d,t);
      this.adv();
      const args=[];
      if(this.isOp(')')){this.adv()}
      else{
        for(;;){
          args.push(this.cmp(nd));
          if(this.isOp(',')){this.adv();continue}
          if(this.isOp(')')){this.adv();break}
          if(this.t.k==='eof')throw new FSyntax('The ( after '+t.v+' is missing its closing )',t.pos,t.end);
          this.fail(this.t)
        }
      }
      return{t:'call',name:t.v,args,pos:t.pos,end:this.lastEnd}
    }
    const up=t.v.toUpperCase();
    if(up==='TRUE')return{t:'bool',v:true,pos:t.pos,end:t.end};
    if(up==='FALSE')return{t:'bool',v:false,pos:t.pos,end:t.end};
    if(up==='AND'||up==='OR')throw new FSyntax('"'+t.v+'" here needs brackets to be a column name, like ['+t.v+']',t.pos,t.end);
    return{t:'id',name:t.v,pos:t.pos,end:t.end}
  }
  this.fail(t)
};

function isBlank(s){return s===''||!NONWS.test(s)}
function pn(s,loc){const p=W.parseNumber(s,LOCALE_OPTS[loc]||LOCALE_OPTS.us);return p?p.value:null}
function pd(s,o){
  const d=W.parseDate(s,o);
  return d?new FDate(utcDays(d.y,d.mo,d.d)):null
}
function utcDays(y,m,d){
  y+=Math.floor((m-1)/12);
  m=((m-1)%12+12)%12+1;
  const yy=m<=2?y-1:y;
  const era=Math.floor(yy/400);
  const yoe=yy-era*400;
  const doy=Math.floor((153*((m+9)%12)+2)/5)+d-1;
  const doe=yoe*365+Math.floor(yoe/4)-Math.floor(yoe/100)+doy;
  return era*146097+doe-719468
}
const MIN_DAY=utcDays(0,1,1),MAX_DAY=utcDays(9999,12,31);
function mkDate(n){if(!(n>=MIN_DAY&&n<=MAX_DAY))throw NUM;return new FDate(n)}
function ymd(n){
  const z=n+719468;
  const era=Math.floor(z/146097);
  const doe=z-era*146097;
  const yoe=Math.floor((doe-Math.floor(doe/1460)+Math.floor(doe/36524)-Math.floor(doe/146096))/365);
  const doy=doe-(365*yoe+Math.floor(yoe/4)-Math.floor(yoe/100));
  const mp=Math.floor((5*doy+2)/153);
  const d=doy-Math.floor((153*mp+2)/5)+1;
  const m=mp<10?mp+3:mp-9;
  return{y:yoe+era*400+(m<=2?1:0),mo:m,d}
}
function dim(y,m){return utcDays(y,m+1,1)-utcDays(y,m,1)}
function fmtDate(n){
  const p=ymd(n);
  return String(p.y).padStart(4,'0')+'-'+String(p.mo).padStart(2,'0')+'-'+String(p.d).padStart(2,'0')
}
function fromSerial(s){const k=Math.floor(s);if(!(k>=1&&k<=2958465))throw NUM;return mkDate(k-25569)}
function toDate(v,o){
  if(v instanceof FDate)return v;
  if(typeof v==='number')return fromSerial(v);
  if(typeof v==='string'){
    const d=pd(v,o);
    if(d)return d;
    const p=pn(v,'us');
    if(p!==null)return fromSerial(p);
    throw VALUE
  }
  throw VALUE
}
const LOCALE_OPTS={us:{locale:'us'},eu:{locale:'eu'}};
function toNum(v,loc){
  switch(typeof v){
    case'number':return v;
    case'boolean':return v?1:0;
    case'string':{
      if(v==='')return 0;
      const p=W.parseNumber(v,LOCALE_OPTS[loc]||LOCALE_OPTS.us);
      if(p)return p.value;
      if(!NONWS.test(v))return 0;
      throw VALUE
    }
    default:if(v instanceof FDate)return v.n+25569;throw VALUE
  }
}
function numOrNull(v,loc){
  switch(typeof v){
    case'number':return v;
    case'boolean':return v?1:0;
    case'string':{
      if(v==='')return 0;
      const p=W.parseNumber(v,LOCALE_OPTS[loc]||LOCALE_OPTS.us);
      if(p)return p.value;
      return isBlank(v)?0:null
    }
    default:return null
  }
}
function expandExp(s){
  const m=/^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
  if(!m)return s;
  const digits=m[2]+(m[3]||''),exp=+m[4];
  if(exp>=0){
    const point=1+exp;
    if(digits.length<=point)return m[1]+digits+'0'.repeat(point-digits.length);
    return m[1]+digits.slice(0,point)+'.'+digits.slice(point)
  }
  return m[1]+'0.'+'0'.repeat(-exp-1)+digits
}
function fmtNum(x){
  if(!isFinite(x))throw NUM;
  if(x===0)return'0';
  if(Number.isInteger(x)&&x<1e15&&x>-1e15)return String(x);
  let s=String(Number(x.toPrecision(12)));
  if(s.indexOf('e')!==-1)s=expandExp(s);
  return s
}
function toStr(v){
  switch(typeof v){
    case'string':return v;
    case'number':return fmtNum(v);
    case'boolean':return v?'TRUE':'FALSE';
    default:return v instanceof FDate?fmtDate(v.n):''
  }
}
function toBool(v){
  switch(typeof v){
    case'boolean':return v;
    case'number':return v!==0;
    case'string':{
      const u=v.trim().toUpperCase();
      if(u==='TRUE')return true;
      if(u==='FALSE'||u==='')return false;
      throw VALUE
    }
    default:throw VALUE
  }
}
function chk(v){if(!isFinite(v))throw NUM;return v+0}
function format(v){
  if(typeof v==='string')return v;
  if(v===undefined||v===null)return'';
  return toStr(v)
}
function errCode(e){return e instanceof FErr?e.code:'#VALUE!'}

function addVals(x,y,sign,la,lb,o){
  if(typeof x==='number'&&typeof y==='number')return chk(x+sign*y);
  let dx=x instanceof FDate?x:null,dy=y instanceof FDate?y:null;
  const nx=dx?null:numOrNull(x,la),ny=dy?null:numOrNull(y,lb);
  if(!dx&&nx===null&&typeof x==='string')dx=pd(x,o);
  if(!dy&&ny===null&&typeof y==='string')dy=pd(y,o);
  if(dx&&dy){if(sign>0)throw VALUE;return dx.n-dy.n}
  if(dx){if(ny===null)throw VALUE;return mkDate(dx.n+sign*Math.floor(ny))}
  if(dy){if(sign<0||nx===null)throw VALUE;return mkDate(dy.n+Math.floor(nx))}
  if(nx===null||ny===null)throw VALUE;
  return chk(nx+sign*ny)
}
function rank(x){return typeof x==='boolean'?2:typeof x==='string'?1:0}
function cmpNum(a,b){return a<b?-1:a>b?1:0}
function compareVals(x,y,la,lb,o){
  const sx=typeof x==='string',sy=typeof y==='string';
  if(sx&&sy){
    const bx=isBlank(x),by=isBlank(y);
    if(bx||by)return bx&&by?0:null;
    const nx=pn(x,la),ny=pn(y,lb);
    if(nx!==null&&ny!==null)return cmpNum(nx,ny);
    const dx=pd(x,o),dy=pd(y,o);
    if(dx&&dy)return cmpNum(dx.n,dy.n);
    const fx=W.Q.norm(x.trim()),fy=W.Q.norm(y.trim());
    return fx<fy?-1:fx>fy?1:0
  }
  const dxv=x instanceof FDate,dyv=y instanceof FDate;
  if(dxv||dyv){
    if(dxv&&dyv)return cmpNum(x.n,y.n);
    const dv=dxv?x:y,ot=dxv?y:x,lo=dxv?lb:la;
    let c;
    if(typeof ot==='string'){
      if(isBlank(ot))return null;
      const d2=pd(ot,o);
      if(d2)c=cmpNum(dv.n,d2.n);
      else{const nn=pn(ot,lo);if(nn!==null)c=cmpNum(dv.n+25569,nn);else return dxv?-1:1}
    }else if(typeof ot==='number')c=cmpNum(dv.n+25569,ot);
    else return dxv?-1:1;
    return dxv?c:-c
  }
  if(typeof x==='number'&&sy||sx&&typeof y==='number'){
    const s=sx?x:y,nv=sx?y:x,ls=sx?la:lb;
    if(isBlank(s))return null;
    const nn=pn(s,ls);
    if(nn===null)return sx?1:-1;
    const c=cmpNum(nv,nn);
    return sx?-c:c
  }
  const rx=rank(x),ry=rank(y);
  if(rx!==ry)return rx<ry?-1:1;
  if(rx===2)return cmpNum(x?1:0,y?1:0);
  return cmpNum(x,y)
}

const SURR=/[\ud800-\udfff]/;
function cps(s){return SURR.test(s)?Array.from(s):null}
function sLen(s){const a=cps(s);return a?a.length:s.length}
function sSlice(s,from,to){const a=cps(s);return a?a.slice(from,to).join(''):s.slice(from,to)}
function unitOffset(s,k){
  if(!SURR.test(s))return k;
  let u=0,c=0;
  while(c<k&&u<s.length){const code=s.charCodeAt(u);u+=(code>=0xd800&&code<=0xdbff&&u+1<s.length)?2:1;c++}
  return u
}
function cpIndex(s,u){return SURR.test(s)?sLen(s.slice(0,u)):u}

function shiftE(x,e){
  const s=String(x);
  if(/e/i.test(s))return null;
  return Number(s+'e'+e)
}
function roundGen(x,dig,mode){
  if(!isFinite(x))throw NUM;
  dig=Math.trunc(dig);
  if(dig>300||dig<-300)throw NUM;
  const neg=x<0,a=Math.abs(x);
  let up=shiftE(a,dig);
  if(up===null)up=a*Math.pow(10,dig);
  const r=mode==='up'?Math.ceil(up):mode==='down'?Math.floor(up):Math.round(up);
  let back=shiftE(r,-dig);
  if(back===null)back=r/Math.pow(10,dig);
  return chk(neg?-back:back)
}

const REGEX_CACHE=new Map();
function getRegex(src,flags){
  if(typeof src!=='string')throw VALUE;
  const key=flags+'/'+src;
  const hit=REGEX_CACHE.get(key);
  if(hit)return hit;
  if(W.isUnsafeRegexSource(src))throw VALUE;
  let re;
  try{re=new RegExp(src,flags)}catch(e){throw VALUE}
  if(REGEX_CACHE.size>=200)REGEX_CACHE.delete(REGEX_CACHE.keys().next().value);
  REGEX_CACHE.set(key,re);
  return re
}
function cleanFlags(f){
  if(f==null||f==='')return'';
  if(typeof f!=='string'||!/^[ims]+$/.test(f))throw VALUE;
  return Array.from(new Set(f.split(''))).join('')
}

const FMT_CACHE=new Map();
function parseFmt(f){
  const hit=FMT_CACHE.get(f);
  if(hit)return hit;
  const toks=[];let i=0;
  while(i<f.length){
    const c=f[i],lc=c.toLowerCase();
    if(c==='"'){
      const j=f.indexOf('"',i+1);
      if(j===-1)throw VALUE;
      toks.push({k:'lit',v:f.slice(i+1,j)});i=j+1;continue
    }
    if(c==='\\'){
      if(i+1>=f.length)throw VALUE;
      toks.push({k:'lit',v:f[i+1]});i+=2;continue
    }
    if(lc==='y'||lc==='m'||lc==='d'){
      let j=i;while(j<f.length&&f[j].toLowerCase()===lc)j++;
      toks.push({k:lc,n:j-i});i=j;continue
    }
    if(c==='0'||c==='#'||c==='.'||c===','){toks.push({k:'ch',v:c});i++;continue}
    if(c==='%'){toks.push({k:'pct'});i++;continue}
    if(/[A-Za-z@*_\[\];]/.test(c))throw VALUE;
    toks.push({k:'lit',v:c});i++
  }
  const isDate=toks.some(t=>t.k==='y'||t.k==='m'||t.k==='d');
  let plan;
  if(isDate){
    const dt=toks.map(t=>t.k==='ch'&&(t.v===','||t.v==='.')?{k:'lit',v:t.v}:t);
    if(dt.some(t=>t.k==='ch'||t.k==='pct'))throw VALUE;
    plan={date:true,toks:dt}
  }else{
    let a=-1,b=-1;
    toks.forEach((t,k)=>{if(t.k==='ch'){if(a===-1)a=k;b=k}});
    let pre=toks,core='',suf=[];
    if(a!==-1){
      for(let k=a;k<=b;k++)if(toks[k].k!=='ch')throw VALUE;
      pre=toks.slice(0,a);core=toks.slice(a,b+1).map(t=>t.v).join('');suf=toks.slice(b+1)
    }
    const parts=core.split('.');
    if(parts.length>2)throw VALUE;
    const ip=parts[0],fp=parts[1]||'';
    if(/[^0#,]/.test(ip)||/[^0#]/.test(fp))throw VALUE;
    if(/,$/.test(ip)||/^,/.test(ip))throw VALUE;
    plan={
      date:false,pre,suf,hasCore:a!==-1,
      group:ip.indexOf(',')!==-1,
      intMin:(ip.match(/0/g)||[]).length,
      dec:fp.length,
      minFrac:(fp.match(/0/g)||[]).length,
      pct:toks.some(t=>t.k==='pct')
    }
  }
  if(FMT_CACHE.size>=200)FMT_CACHE.delete(FMT_CACHE.keys().next().value);
  FMT_CACHE.set(f,plan);
  return plan
}
function litText(toks){return toks.map(t=>t.k==='lit'?t.v:t.k==='pct'?'%':'').join('')}
function textFormat(v,f,loc,o){
  const plan=parseFmt(f);
  if(plan.date){
    let d;
    if(typeof v==='string'){
      if(isBlank(v))return'';
      try{d=toDate(v,o)}catch(e){if(e===VALUE)return v;throw e}
    }else if(typeof v==='boolean')return toStr(v);
    else d=toDate(v,o);
    const p=ymd(d.n),dow=((d.n%7)+7+4)%7;
    return plan.toks.map(t=>{
      switch(t.k){
        case'lit':return t.v;
        case'y':return t.n>=3?String(p.y).padStart(4,'0'):String(p.y%100).padStart(2,'0');
        case'm':return t.n===1?String(p.mo):t.n===2?String(p.mo).padStart(2,'0'):t.n===3?MONTHS[p.mo-1].slice(0,3):MONTHS[p.mo-1];
        case'd':return t.n===1?String(p.d):t.n===2?String(p.d).padStart(2,'0'):t.n===3?DAYS[dow].slice(0,3):DAYS[dow];
        default:return''
      }
    }).join('')
  }
  let x;
  if(typeof v==='string'){
    if(isBlank(v))return'';
    x=numOrNull(v,loc);
    if(x===null)return v
  }else if(typeof v==='boolean')return toStr(v);
  else x=toNum(v,loc);
  if(!plan.hasCore)return litText(plan.pre)+litText(plan.suf);
  if(plan.pct)x*=100;
  if(!isFinite(x)||Math.abs(x)>=1e21)throw NUM;
  const neg=x<0;
  const rounded=roundGen(Math.abs(x),plan.dec,'half');
  const fixed=rounded.toFixed(plan.dec);
  let [ints,fr]=fixed.split('.');
  fr=fr||'';
  while(fr.length>plan.minFrac&&fr[fr.length-1]==='0')fr=fr.slice(0,-1);
  if(ints.length<plan.intMin)ints=ints.padStart(plan.intMin,'0');
  if(plan.intMin===0&&ints==='0')ints='';
  if(plan.group)ints=ints.replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const body=ints+(fr?'.'+fr:'');
  const showNeg=neg&&rounded!==0;
  return(showNeg?'-':'')+litText(plan.pre)+body+litText(plan.suf)
}

const FN=Object.create(null);
const NONDET={TODAY:1,NOW:1,RAND:1,RANDBETWEEN:1};
function K(v,kind,loc){return{v,kind:kind||'any',loc:loc||'us',ref:-1}}
function def(name,min,max,mk){FN[name]={name,min,max,mk}}
function asNum(c){if(c.kind==='num')return c.v;const v=c.v,loc=c.loc;return(D,r)=>toNum(v(D,r),loc)}
function asStr(c){if(c.kind==='str')return c.v;const v=c.v;return(D,r)=>toStr(v(D,r))}
function asBool(c){if(c.kind==='bool')return c.v;const v=c.v;return(D,r)=>toBool(v(D,r))}
function asDate(c,cx){const v=c.v,o=cx.dopts;return(D,r)=>toDate(v(D,r),o)}
function pickLoc(list){for(const c of list)if(c.ref>=0)return c.loc;return'us'}
function litStr(node){return node&&node.t==='str'?node.v:null}
function checkLiteralRegex(node,cx){
  const s=litStr(node);
  if(s===null)return;
  if(W.isUnsafeRegexSource(s)){cx.err('That pattern is too long or could freeze the page (nested repetition). Simplify it',node.pos,node.end,'#VALUE!');return}
  try{new RegExp(s)}catch(e){cx.err('The pattern is not valid: '+e.message,node.pos,node.end,'#VALUE!')}
}
function flagArg(a,i){
  if(!a[i])return()=>'';
  const f=asStr(a[i]);
  return(D,r)=>cleanFlags(f(D,r))
}
function intArg(c){const f=asNum(c);return(D,r)=>Math.floor(f(D,r))}

def('IF',2,3,(a)=>{
  const c=asBool(a[0]),t=a[1].v,e=a[2]?a[2].v:()=>false;
  const k=a[2]?(a[1].kind===a[2].kind?a[1].kind:'any'):'any';
  return K((D,r)=>c(D,r)?t(D,r):e(D,r),k,pickLoc(a.slice(1)))
});
def('IFS',2,254,(a,cx,node)=>{
  if(a.length%2){cx.err('IFS needs pairs of a condition and a result',node.pos,node.end,'#VALUE!')}
  const cs=[],vs=[];
  for(let i=0;i+1<a.length;i+=2){cs.push(asBool(a[i]));vs.push(a[i+1].v)}
  const n=cs.length;
  return K((D,r)=>{for(let i=0;i<n;i++)if(cs[i](D,r))return vs[i](D,r);throw NA},'any',pickLoc(a))
});
def('IFERROR',2,2,(a)=>{
  const x=a[0].v,y=a[1].v;
  return K((D,r)=>{try{return x(D,r)}catch(e){if(e instanceof FErr)return y(D,r);throw e}},'any',pickLoc(a))
});
def('AND',1,254,(a)=>{
  const fs=a.map(asBool),n=fs.length;
  return K((D,r)=>{for(let i=0;i<n;i++)if(!fs[i](D,r))return false;return true},'bool')
});
def('OR',1,254,(a)=>{
  const fs=a.map(asBool),n=fs.length;
  return K((D,r)=>{for(let i=0;i<n;i++)if(fs[i](D,r))return true;return false},'bool')
});
def('NOT',1,1,(a)=>{const f=asBool(a[0]);return K((D,r)=>!f(D,r),'bool')});
def('ISBLANK',1,1,(a)=>{
  const v=a[0].v;
  return K((D,r)=>{try{const x=v(D,r);return typeof x==='string'&&isBlank(x)}catch(e){if(e instanceof FErr)return false;throw e}},'bool')
});
def('ISNUMBER',1,1,(a)=>{
  const v=a[0].v,loc=a[0].loc;
  return K((D,r)=>{
    try{
      const x=v(D,r);
      if(typeof x==='number')return isFinite(x);
      if(typeof x==='string')return !isBlank(x)&&pn(x,loc)!==null;
      return false
    }catch(e){if(e instanceof FErr)return false;throw e}
  },'bool')
});
def('COALESCE',1,254,(a)=>{
  const vs=a.map(c=>c.v),n=vs.length;
  return K((D,r)=>{
    for(let i=0;i<n;i++){const x=vs[i](D,r);if(!(typeof x==='string'&&isBlank(x)))return x}
    return''
  },'any',pickLoc(a))
});

def('LEN',1,1,(a)=>{const f=asStr(a[0]);return K((D,r)=>sLen(f(D,r)),'num')});
def('LEFT',1,2,(a)=>{
  const f=asStr(a[0]),n=a[1]?intArg(a[1]):()=>1;
  return K((D,r)=>{const s=f(D,r),k=n(D,r);if(k<0)throw VALUE;return sSlice(s,0,k)},'str')
});
def('RIGHT',1,2,(a)=>{
  const f=asStr(a[0]),n=a[1]?intArg(a[1]):()=>1;
  return K((D,r)=>{
    const s=f(D,r),k=n(D,r);
    if(k<0)throw VALUE;
    if(k===0)return'';
    const len=sLen(s);
    return k>=len?s:sSlice(s,len-k)
  },'str')
});
def('MID',3,3,(a)=>{
  const f=asStr(a[0]),st=intArg(a[1]),n=intArg(a[2]);
  return K((D,r)=>{
    const s=f(D,r),p=st(D,r),k=n(D,r);
    if(p<1||k<0)throw VALUE;
    return sSlice(s,p-1,p-1+k)
  },'str')
});
def('UPPER',1,1,(a)=>{const f=asStr(a[0]);return K((D,r)=>f(D,r).toUpperCase(),'str')});
def('LOWER',1,1,(a)=>{const f=asStr(a[0]);return K((D,r)=>f(D,r).toLowerCase(),'str')});
def('PROPER',1,1,(a)=>{
  const f=asStr(a[0]);
  return K((D,r)=>f(D,r).toLowerCase().replace(/(^|[^\p{L}\p{M}])(\p{L})/gu,(m,p,l)=>p+l.toUpperCase()),'str')
});
def('TRIM',1,1,(a)=>{const f=asStr(a[0]);return K((D,r)=>f(D,r).replace(/\s+/g,' ').trim(),'str')});
def('CONCAT',1,254,(a)=>{
  const fs=a.map(asStr),n=fs.length;
  return K((D,r)=>{let s='';for(let i=0;i<n;i++)s+=fs[i](D,r);return s},'str')
});
def('TEXTJOIN',3,254,(a)=>{
  const d=asStr(a[0]),ig=asBool(a[1]),fs=a.slice(2).map(asStr),n=fs.length;
  return K((D,r)=>{
    const sep=d(D,r),skip=ig(D,r);
    let out='',first=true;
    for(let i=0;i<n;i++){
      const s=fs[i](D,r);
      if(skip&&isBlank(s))continue;
      if(!first)out+=sep;
      out+=s;first=false
    }
    return out
  },'str')
});
def('SUBSTITUTE',3,4,(a)=>{
  const f=asStr(a[0]),o=asStr(a[1]),nw=asStr(a[2]),inst=a[3]?intArg(a[3]):null;
  return K((D,r)=>{
    const s=f(D,r),old=o(D,r),rep=nw(D,r);
    if(old==='')return s;
    if(!inst)return s.split(old).join(rep);
    const k=inst(D,r);
    if(k<1)throw VALUE;
    let idx=-1,from=0;
    for(let i=0;i<k;i++){idx=s.indexOf(old,from);if(idx===-1)return s;from=idx+old.length}
    return s.slice(0,idx)+rep+s.slice(idx+old.length)
  },'str')
});
def('REPLACE',4,4,(a)=>{
  const f=asStr(a[0]),st=intArg(a[1]),ln=intArg(a[2]),nw=asStr(a[3]);
  return K((D,r)=>{
    const s=f(D,r),p=st(D,r),k=ln(D,r),rep=nw(D,r);
    if(p<1||k<0)throw VALUE;
    return sSlice(s,0,p-1)+rep+sSlice(s,p-1+k)
  },'str')
});
function findLike(fold){
  return(a)=>{
    const nf=asStr(a[0]),tf=asStr(a[1]),sf=a[2]?intArg(a[2]):()=>1;
    return K((D,r)=>{
      let needle=nf(D,r),text=tf(D,r);
      const st=sf(D,r);
      if(st<1)throw VALUE;
      if(fold){needle=needle.toLowerCase();text=text.toLowerCase()}
      if(st-1>sLen(text))throw VALUE;
      const u=unitOffset(text,st-1);
      const idx=text.indexOf(needle,u);
      if(idx===-1)throw VALUE;
      return cpIndex(text,idx)+1
    },'num')
  }
}
def('FIND',2,3,findLike(false));
def('SEARCH',2,3,findLike(true));
def('CONTAINS',2,2,(a)=>{
  const x=asStr(a[0]),y=asStr(a[1]);
  return K((D,r)=>W.Q.norm(x(D,r)).indexOf(W.Q.norm(y(D,r)))!==-1,'bool')
});
def('STARTSWITH',2,2,(a)=>{
  const x=asStr(a[0]),y=asStr(a[1]);
  return K((D,r)=>W.Q.norm(x(D,r)).indexOf(W.Q.norm(y(D,r)))===0,'bool')
});
def('ENDSWITH',2,2,(a)=>{
  const x=asStr(a[0]),y=asStr(a[1]);
  return K((D,r)=>{const s=W.Q.norm(x(D,r)),e=W.Q.norm(y(D,r));return s.length>=e.length&&s.slice(s.length-e.length)===e},'bool')
});
def('VALUE',1,1,(a,cx)=>{
  const v=a[0].v,loc=a[0].loc,o=cx.dopts;
  return K((D,r)=>{
    const x=v(D,r);
    if(typeof x==='number')return x;
    if(x instanceof FDate)return x.n+25569;
    if(typeof x==='string'){
      if(isBlank(x))throw VALUE;
      const p=pn(x,loc);
      if(p!==null)return p;
      const d=pd(x,o);
      if(d)return d.n+25569
    }
    throw VALUE
  },'num')
});
def('TEXT',2,2,(a,cx)=>{
  const v=a[0].v,loc=a[0].loc,f=asStr(a[1]),o=cx.dopts;
  return K((D,r)=>textFormat(v(D,r),f(D,r),loc,o),'str')
});

function roundDef(mode){
  return(a)=>{
    const x=asNum(a[0]),d=a[1]?asNum(a[1]):()=>0;
    return K((D,r)=>roundGen(x(D,r),d(D,r),mode),'num')
  }
}
def('ROUND',1,2,roundDef('half'));
def('ROUNDUP',1,2,roundDef('up'));
def('ROUNDDOWN',1,2,roundDef('down'));
def('ABS',1,1,(a)=>{const f=asNum(a[0]);return K((D,r)=>Math.abs(f(D,r)),'num')});
def('INT',1,1,(a)=>{const f=asNum(a[0]);return K((D,r)=>chk(Math.floor(f(D,r))),'num')});
def('MOD',2,2,(a)=>{
  const x=asNum(a[0]),y=asNum(a[1]);
  return K((D,r)=>{
    const p=x(D,r),q=y(D,r);
    if(q===0)throw DIV0;
    return chk(p-q*Math.floor(p/q))
  },'num')
});
function aggArgs(a){
  return a.map(c=>{
    if(c.ref>=0){const v=c.v,loc=c.loc;return(D,r,out)=>{const x=v(D,r);if(typeof x==='string'){if(isBlank(x))return;const p=pn(x,loc);if(p!==null)out.push(p);return}out.push(toNum(x,loc))}}
    const f=asNum(c);
    return(D,r,out)=>{out.push(f(D,r))}
  })
}
function aggDef(reduce){
  return(a)=>{
    const fs=aggArgs(a),n=fs.length;
    return K((D,r)=>{const out=[];for(let i=0;i<n;i++)fs[i](D,r,out);return chk(reduce(out))},'num')
  }
}
def('SUM',1,254,aggDef(v=>{let s=0;for(let i=0;i<v.length;i++)s+=v[i];return s}));
def('AVERAGE',1,254,aggDef(v=>{if(!v.length)throw DIV0;let s=0;for(let i=0;i<v.length;i++)s+=v[i];return s/v.length}));
def('MIN',1,254,aggDef(v=>{let m=Infinity;for(let i=0;i<v.length;i++)if(v[i]<m)m=v[i];return v.length?m:0}));
def('MAX',1,254,aggDef(v=>{let m=-Infinity;for(let i=0;i<v.length;i++)if(v[i]>m)m=v[i];return v.length?m:0}));

def('DATE',3,3,(a)=>{
  const y=intArg(a[0]),m=intArg(a[1]),d=intArg(a[2]);
  return K((D,r)=>mkDate(utcDays(y(D,r),m(D,r),d(D,r))),'date')
});
function partDef(key){
  return(a,cx)=>{const f=asDate(a[0],cx);return K((D,r)=>ymd(f(D,r).n)[key],'num')}
}
def('YEAR',1,1,partDef('y'));
def('MONTH',1,1,partDef('mo'));
def('DAY',1,1,partDef('d'));
def('WEEKDAY',1,2,(a,cx)=>{
  const f=asDate(a[0],cx),t=a[1]?intArg(a[1]):()=>1;
  return K((D,r)=>{
    const n=f(D,r).n,k=t(D,r),dow=((n%7)+7+4)%7;
    if(k===1)return dow+1;
    if(k===2)return(dow+6)%7+1;
    if(k===3)return(dow+6)%7;
    throw NUM
  },'num')
});
def('DATEDIF',3,3,(a,cx)=>{
  const sf=asDate(a[0],cx),ef=asDate(a[1],cx),uf=asStr(a[2]);
  return K((D,r)=>{
    const s=sf(D,r).n,e=ef(D,r).n,u=uf(D,r).toUpperCase();
    if(s>e)throw NUM;
    const p=ymd(s),q=ymd(e);
    switch(u){
      case'D':return e-s;
      case'Y':{let y=q.y-p.y;if(q.mo<p.mo||(q.mo===p.mo&&q.d<p.d))y--;return y}
      case'M':{let m=(q.y-p.y)*12+q.mo-p.mo;if(q.d<p.d)m--;return m}
      case'YM':{let m=q.mo-p.mo;if(q.d<p.d)m--;return(m+12)%12}
      case'MD':{
        if(q.d>=p.d)return q.d-p.d;
        const pm=q.mo===1?12:q.mo-1,py=q.mo===1?q.y-1:q.y;
        return q.d+dim(py,pm)-p.d
      }
      case'YD':{
        let d1=utcDays(q.y,p.mo,p.d);
        if(d1>e)d1=utcDays(q.y-1,p.mo,p.d);
        return e-d1
      }
      default:throw NUM
    }
  },'num')
});
def('EDATE',2,2,(a,cx)=>{
  const f=asDate(a[0],cx),m=intArg(a[1]);
  return K((D,r)=>{
    const p=ymd(f(D,r).n),k=m(D,r);
    const total=p.y*12+(p.mo-1)+k;
    const y=Math.floor(total/12),mo=total-y*12+1;
    return mkDate(utcDays(y,mo,Math.min(p.d,dim(y,mo))))
  },'date')
});

def('REGEXMATCH',2,3,(a,cx,node)=>{
  checkLiteralRegex(node.args[1],cx);
  const t=asStr(a[0]),p=asStr(a[1]),fl=flagArg(a,2);
  return K((D,r)=>getRegex(p(D,r),fl(D,r)).test(t(D,r)),'bool')
});
def('REGEXEXTRACT',2,3,(a,cx,node)=>{
  checkLiteralRegex(node.args[1],cx);
  const t=asStr(a[0]),p=asStr(a[1]),fl=flagArg(a,2);
  return K((D,r)=>{
    const m=getRegex(p(D,r),fl(D,r)).exec(t(D,r));
    if(!m)throw NA;
    if(m.length>1)return m[1]===undefined?'':m[1];
    return m[0]
  },'str')
});
def('REGEXREPLACE',3,4,(a,cx,node)=>{
  checkLiteralRegex(node.args[1],cx);
  const t=asStr(a[0]),p=asStr(a[1]),rp=asStr(a[2]),fl=flagArg(a,3);
  return K((D,r)=>{
    const flags=fl(D,r);
    return t(D,r).replace(getRegex(p(D,r),flags.indexOf('g')===-1?flags+'g':flags),rp(D,r))
  },'str')
});

W.F={};
W.F.NAMES=Object.keys(FN).sort();
W.F.MAX_LEN=MAX_LEN;
W.F.MAX_DEPTH=MAX_DEPTH;
W.F.ERROR_CODES=['#VALUE!','#DIV/0!','#REF!','#NAME?','#NUM!','#N/A'];
W.F.arity=function(name){const d=FN[String(name).toUpperCase()];return d?{min:d.min,max:d.max}:null};

function colKey(s){return String(s).toLowerCase().replace(/[\s_\-.]+/g,'')}
function makeResolver(cols){
  if(!cols)return null;
  const exact=new Map(),lower=new Map(),key=new Map();
  cols.forEach((c,i)=>{
    if(!exact.has(c))exact.set(c,i);
    const l=String(c).toLowerCase();
    if(!lower.has(l))lower.set(l,i);
    const k=colKey(c);
    if(k&&!key.has(k))key.set(k,i)
  });
  return name=>{
    if(exact.has(name))return exact.get(name);
    const l=String(name).toLowerCase();
    if(lower.has(l))return lower.get(l);
    const k=colKey(name);
    if(k&&key.has(k))return key.get(k);
    return-1
  }
}
function errObj(message,pos,end,code,withPos){
  const e={message:withPos===false?message:message+' at position '+(pos+1)+'.',base:message,pos,end:end==null?pos+1:end,code:code||'#VALUE!'};
  return e
}

function cNode(node,cx){
  switch(node.t){
    case'num':{const v=node.v;return K(()=>v,'num')}
    case'str':{const v=node.v;return K(()=>v,'str')}
    case'bool':{const v=node.v;return K(()=>v,'bool')}
    case'group':return cNode(node.e,cx);
    case'ref':case'id':return cRef(node,cx);
    case'neg':{const f=asNum(cNode(node.e,cx));return K((D,r)=>{const x=-f(D,r);return x+0},'num')}
    case'pct':{const f=asNum(cNode(node.e,cx));return K((D,r)=>f(D,r)/100,'num')}
    case'cat':{
      const fs=node.parts.map(p=>asStr(cNode(p,cx))),n=fs.length;
      return K((D,r)=>{let s='';for(let i=0;i<n;i++)s+=fs[i](D,r);return s},'str')
    }
    case'bin':return cBin(node,cx);
    case'call':return cCall(node,cx)
  }
  throw new FSyntax('Unsupported formula part',node.pos||0)
}
function cRef(node,cx){
  const name=node.name;
  if(!cx.res){
    cx.names.push(name);
    return K(()=>'','any')
  }
  const ci=cx.res(name);
  if(ci<0){
    if(node.t==='ref'){
      if(cx.missing.indexOf(name)===-1)cx.missing.push(name);
      return K(()=>{throw REF},'any')
    }
    cx.err('Unknown name "'+name+'". Put column names in [square brackets]',node.pos,node.end,'#NAME?');
    return K(()=>{throw NAME},'any')
  }
  const cn=cx.cols[ci];
  if(cx.refs.indexOf(cn)===-1)cx.refs.push(cn);
  const c=K((D,r)=>{const x=D[ci][r];return x==null?'':typeof x==='string'?x:String(x)},'any',cx.locOf(ci));
  c.ref=ci;
  return c
}
function cBin(node,cx){
  const a=cNode(node.l,cx),b=cNode(node.r,cx),op=node.op,o=cx.dopts;
  if(op==='+'||op==='-'){
    const sign=op==='+'?1:-1,av=a.v,bv=b.v,la=a.loc,lb=b.loc;
    if(a.kind==='num'&&b.kind==='num')return K(sign>0?(D,r)=>chk(av(D,r)+bv(D,r)):(D,r)=>chk(av(D,r)-bv(D,r)),'num');
    return K((D,r)=>addVals(av(D,r),bv(D,r),sign,la,lb,o),'any')
  }
  if(op==='*'||op==='/'||op==='^'){
    const x=asNum(a),y=asNum(b);
    if(op==='*')return K((D,r)=>chk(x(D,r)*y(D,r)),'num');
    if(op==='/')return K((D,r)=>{const q=y(D,r);if(q===0)throw DIV0;return chk(x(D,r)/q)},'num');
    return K((D,r)=>{
      const p=x(D,r),q=y(D,r);
      if(p===0&&q<=0)throw q===0?NUM:DIV0;
      return chk(Math.pow(p,q))
    },'num')
  }
  const av=a.v,bv=b.v,la=a.loc,lb=b.loc;
  switch(op){
    case'=':return K((D,r)=>compareVals(av(D,r),bv(D,r),la,lb,o)===0,'bool');
    case'<>':return K((D,r)=>compareVals(av(D,r),bv(D,r),la,lb,o)!==0,'bool');
    case'<':return K((D,r)=>{const z=compareVals(av(D,r),bv(D,r),la,lb,o);return z!==null&&z<0},'bool');
    case'>':return K((D,r)=>{const z=compareVals(av(D,r),bv(D,r),la,lb,o);return z!==null&&z>0},'bool');
    case'<=':return K((D,r)=>{const z=compareVals(av(D,r),bv(D,r),la,lb,o);return z!==null&&z<=0},'bool');
    default:return K((D,r)=>{const z=compareVals(av(D,r),bv(D,r),la,lb,o);return z!==null&&z>=0},'bool')
  }
}
function cCall(node,cx){
  const up=node.name.toUpperCase();
  const d=FN[up];
  if(!d){
    if(NONDET[up]===1)cx.err(up+' is not allowed because a recipe must give the same result every time it runs. Type the date with DATE(2026,1,31) or use a date column instead',node.pos,node.end,'#NAME?');
    else cx.err('Unknown function '+node.name,node.pos,node.end,'#NAME?');
    for(const x of node.args)cNode(x,cx);
    return K(()=>{throw NAME},'any')
  }
  const n=node.args.length;
  if(n<d.min||n>d.max){
    const need=d.min===d.max?String(d.min):d.max>=254?'at least '+d.min:d.min+' to '+d.max;
    cx.err(d.name+' needs '+need+' value'+(d.min===1&&d.max===1?'':'s')+', but has '+n,node.pos,node.end,'#VALUE!');
    for(const x of node.args)cNode(x,cx);
    return K(()=>{throw VALUE},'any')
  }
  const args=node.args.map(x=>cNode(x,cx));
  return d.mk(args,cx,node)
}

function failedFn(code){
  const e=ERR[code];
  return()=>{throw e}
}

W.F.compile=function(src,cols,opts){
  opts=opts||{};
  src=src==null?'':String(src);
  const errors=[],missing=[],refs=[],names=[];
  const out={src,fn:null,run:null,test:null,errors,missing,refs,names,kind:'any'};
  const dopts={order:opts.dateOrder||'mdy',yearPivot:opts.yearPivot};
  const finishFail=(code)=>{
    const f=failedFn(code);
    out.run=f;
    out.fn=()=>code;
    out.test=()=>false;
    return out
  };
  if(src.length>MAX_LEN){
    errors.push(errObj('Formulas can be at most '+MAX_LEN.toLocaleString('en-US')+' characters',MAX_LEN,src.length,'#VALUE!',false));
    return finishFail('#VALUE!')
  }
  let ast;
  try{ast=new Parser(src,false).parseAll()}
  catch(e){
    if(!(e instanceof FSyntax))throw e;
    errors.push(errObj(e.message,e.pos,e.end,'#VALUE!'));
    return finishFail('#VALUE!')
  }
  const memo=new Map();
  const cx={
    cols:cols||null,res:makeResolver(cols),dopts,errors,missing,refs,names,
    err(message,pos,end,code){errors.push(errObj(message,pos,end,code))},
    locOf(ci){
      if(!opts.locale)return'us';
      if(!memo.has(ci))memo.set(ci,opts.locale(ci)||'us');
      return memo.get(ci)
    }
  };
  let root;
  try{root=cNode(ast,cx)}
  catch(e){
    if(!(e instanceof FSyntax))throw e;
    errors.push(errObj(e.message,e.pos,e.end,'#VALUE!'));
    return finishFail('#VALUE!')
  }
  const f=root.v;
  out.kind=root.kind;
  out.run=f;
  out.test=(D,r)=>{
    try{
      const v=f(D,r);
      if(typeof v==='boolean')return v;
      if(typeof v==='number')return v!==0;
      if(typeof v==='string'){const u=v.trim().toUpperCase();return u==='TRUE'}
      return false
    }catch(e){return false}
  };
  out.fn=row=>{
    const n=cols?cols.length:(row?row.length:0);
    const D=new Array(n);
    for(let i=0;i<n;i++)D[i]=[row&&row[i]!==undefined?row[i]:''];
    try{return format(f(D,0))}catch(e){return errCode(e)}
  };
  return out
};
W.F.check=function(src,cols,opts){
  const c=W.F.compile(src,cols,opts);
  return{ok:!c.errors.length&&!c.missing.length,errors:c.errors,missing:c.missing,refs:c.refs}
};
W.F.colNames=function(shape){
  if(!shape||!Array.isArray(shape.cols))return null;
  return shape.cols.map(c=>typeof c==='string'?c:c&&c.name)
};
W.F.format=format;
W.F.errCode=errCode;
W.F.isError=e=>e instanceof FErr;

W.F.localeOf=function(t,ci){
  const col=t.data[ci],sm=[];
  for(let r=0;r<t.n&&sm.length<250;r++){
    const v=col[r];
    if(v!=null&&v!==''){const s=String(v);if(NONWS.test(s))sm.push(s)}
  }
  return W.detectNumberLocale(sm)
};
W.F.optsFor=function(t,ctx){
  ctx=ctx||{};
  return{dateOrder:ctx.dateOrder,yearPivot:ctx.yearPivot,locale:ci=>W.F.localeOf(t,ci)}
};
W.F.forTable=function(t,src,ctx){return W.F.compile(src,t.cols,W.F.optsFor(t,ctx))};

function scanTokens(src){
  const lx=new Lexer(src,true);
  const out=[];
  for(;;){
    let t;
    try{t=lx.next()}catch(e){if(e instanceof FSyntax)break;throw e}
    if(t.k==='eof')break;
    out.push(t)
  }
  return out
}
function refTokens(src){
  const toks=scanTokens(String(src==null?'':src));
  const out=[];
  toks.forEach((t,i)=>{
    if(t.k==='ref')out.push(t);
    else if(t.k==='id'){
      const nx=toks[i+1];
      if(nx&&nx.k==='op'&&nx.v==='(')return;
      const up=t.v.toUpperCase();
      if(up==='TRUE'||up==='FALSE'||up==='AND'||up==='OR')return;
      out.push(t)
    }
  });
  return out
}
W.F.refsOf=function(src){
  const seen=new Set(),out=[];
  for(const t of refTokens(src))if(!seen.has(t.v)){seen.add(t.v);out.push(t.v)}
  return out
};
W.F.remap=function(src,dict){
  src=String(src==null?'':src);
  const toks=refTokens(src);
  let out='',at=0;
  for(const t of toks){
    if(!Object.prototype.hasOwnProperty.call(dict,t.v))continue;
    out+=src.slice(at,t.pos)+'['+String(dict[t.v]).replace(/\]/g,']]')+']';
    at=t.end
  }
  return out+src.slice(at)
};
W.F.scanPrefix=function(src,from){
  const text=src.slice(from);
  const p=new Parser(text,true);
  try{p.parseAll()}
  catch(e){
    if(e instanceof FSyntax)throw new Error('The formula is not valid: '+e.message+' at position '+(e.pos+1)+'.');
    throw e
  }
  const end=p.lastEnd;
  const raw=text.slice(0,end).trim();
  const c=W.F.compile(raw,null);
  if(c.errors.length)throw new Error('The formula is not valid: '+c.errors[0].message);
  return{expr:raw,end:from+end}
};
})(typeof self!=='undefined'?self:globalThis);
