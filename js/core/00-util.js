(function(G){
'use strict';
const W=G.WeftCore||(G.WeftCore={});
W.version='2.0.0';
W.OPS=W.OPS||{};
W.OP_ORDER=W.OP_ORDER||[];

W.fmtInt=function(n){
  n=Math.round(Number(n)||0);
  const s=String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return n<0?'-'+s:s
};
W.fmtNum=function(x){
  if(x==null||!isFinite(x))return'';
  const a=Math.abs(x);
  if(Number.isInteger(x))return W.fmtInt(x);
  const d=a>=1000?2:a>=1?2:4;
  const s=x.toFixed(d).replace(/0+$/,'').replace(/\.$/,'');
  const parts=s.split('.');
  return W.fmtInt(Number(parts[0]))+(parts[1]?'.'+parts[1]:'')
};
W.plural=function(n,word,pl){return W.fmtInt(n)+' '+(n===1?word:(pl||word+'s'))};
W.trunc=function(s,n){s=String(s==null?'':s);return s.length>n?s.slice(0,Math.max(1,n-1))+'…':s};
W.mulberry32=function(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
W.stripBOM=function(t){return t.length&&t.charCodeAt(0)===0xFEFF?t.slice(1):t};
W.normalizeInput=function(t){return W.stripBOM(String(t==null?'':t)).replace(/\r\n|\r/g,'\n')};
W.isBlank=function(v){return v==null||String(v).trim()===''};
W.identity=function(n,start){start=start||0;const a=new Array(n);for(let i=0;i<n;i++)a[i]=start+i;return a};

W.dedupeColNames=function(cols){
  const seen=new Map();
  return cols.map(function(name){
    name=String(name==null?'':name);
    if(!seen.has(name)){seen.set(name,1);return name}
    let n=seen.get(name)+1,c=name+'_'+n;
    while(seen.has(c)){n++;c=name+'_'+n}
    seen.set(name,n);seen.set(c,1);
    return c
  })
};

W.isUnsafeRegexSource=function(src){
  if(typeof src!=='string'||!src)return true;
  if(src.length>200)return true;
  if(/\([^()]*[+*][^()]*\)\s*[+*{]/.test(src))return true;
  if(/\\[1-9]/.test(src))return true;
  return false
};
W.compileRegex=function(src,flags){
  if(W.isUnsafeRegexSource(src))throw new Error('That pattern is too long or could freeze the page (nested repetition). Simplify it.');
  try{return new RegExp(src,flags||'')}
  catch(e){throw new Error('The pattern is not valid: '+e.message)}
};

W.hashString=function(s){
  let h=0x811c9dc5;
  const step=s.length>200000?Math.floor(s.length/200000):1;
  for(let i=0;i<s.length;i+=step){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}
  h^=s.length;
  return(h>>>0).toString(36)
};

W.deepEqual=function deq(a,b){
  if(a===b)return true;
  if(typeof a!==typeof b||a==null||b==null)return a===b;
  if(typeof a!=='object')return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  const ka=Object.keys(a).filter(k=>a[k]!==undefined),kb=Object.keys(b).filter(k=>b[k]!==undefined);
  if(ka.length!==kb.length)return false;
  for(const k of ka){if(!Object.prototype.hasOwnProperty.call(b,k)||!deq(a[k],b[k]))return false}
  return true
};
W.clone=function(v){return v==null?v:JSON.parse(JSON.stringify(v))};

W.q=function(s){return JSON.stringify(String(s==null?'':s))};
W.colsDsl=function(cols){return(!cols||!cols.length||cols[0]==='*')?'*':cols.map(W.q).join(', ')};
W.valDsl=function(v){v=String(v==null?'':v);return/^-?\d+(\.\d+)?$/.test(v)?v:W.q(v)};
W.reDsl=function(src,cs){return'/'+String(src).replace(/\//g,'\\/')+'/'+(cs?'':'i')};

W.lex=function(s){
  const toks=[];let i=0;const n=s.length;
  while(i<n){
    const c=s[i];
    if(c===' '||c==='\t'){i++;continue}
    if(c==='"'){
      let j=i+1,out='';
      while(j<n&&s[j]!=='"'){
        if(s[j]==='\\'&&j+1<n){
          const e=s[j+1];
          if(e==='n'){out+='\n';j+=2}
          else if(e==='t'){out+='\t';j+=2}
          else if(e==='r'){out+='\r';j+=2}
          else if(e==='u'&&/^[0-9a-fA-F]{4}$/.test(s.slice(j+2,j+6))){out+=String.fromCharCode(parseInt(s.slice(j+2,j+6),16));j+=6}
          else{out+=e;j+=2}
        }else{out+=s[j];j++}
      }
      if(j>=n)throw new Error('A quoted value is missing its closing quote.');
      toks.push({t:'str',v:out});i=j+1;continue
    }
    if(c==='/'){
      let j=i+1,src='',inCls=false;
      while(j<n){
        const d=s[j];
        if(d==='\\'&&j+1<n){if(s[j+1]==='/'&&!inCls){src+='/'}else{src+=d+s[j+1]}j+=2;continue}
        if(d==='['){inCls=true}
        else if(d===']'){inCls=false}
        else if(d==='/'&&!inCls)break;
        src+=d;j++
      }
      if(j>=n)throw new Error('A /pattern/ is missing its closing slash.');
      j++;let flags='';
      while(j<n&&/[a-z]/.test(s[j])){flags+=s[j];j++}
      toks.push({t:'re',v:src,flags});i=j;continue
    }
    if(c==='('||c===')'||c===','){toks.push({t:'p',v:c});i++;continue}
    let j=i;
    while(j<n&&!/[\s"(),]/.test(s[j]))j++;
    toks.push({t:'word',v:s.slice(i,j)});i=j
  }
  return toks
};

function Cursor(line){this.src=line;this.t=W.lex(line);this.i=0}
Cursor.prototype.peek=function(k){return this.t[this.i+(k||0)]};
Cursor.prototype.done=function(){return this.i>=this.t.length};
Cursor.prototype.near=function(){const x=this.peek();return x?(' near "'+(x.t==='str'?'"'+x.v+'"':x.v)+'"'):' at the end of the line'};
Cursor.prototype.isWord=function(w,k){const x=this.peek(k);return!!x&&x.t==='word'&&x.v.toLowerCase()===w};
Cursor.prototype.optWord=function(w){if(this.isWord(w)){this.i++;return true}return false};
Cursor.prototype.word=function(){
  for(let a=0;a<arguments.length;a++){
    const w=arguments[a];
    if(!this.isWord(w))throw new Error('Expected "'+w+'"'+this.near()+'.');
    this.i++
  }
};
Cursor.prototype.anyWord=function(){const x=this.peek();if(!x||x.t!=='word')throw new Error('Expected a word'+this.near()+'.');this.i++;return x.v};
Cursor.prototype.oneOf=function(list){
  const x=this.peek();
  if(x&&x.t==='word'&&list.indexOf(x.v.toLowerCase())!==-1){this.i++;return x.v.toLowerCase()}
  throw new Error('Expected one of '+list.join(', ')+this.near()+'.')
};
Cursor.prototype.isStr=function(k){const x=this.peek(k);return!!x&&x.t==='str'};
Cursor.prototype.str=function(){const x=this.peek();if(!x||x.t!=='str')throw new Error('Expected a quoted value'+this.near()+'.');this.i++;return x.v};
Cursor.prototype.val=function(){
  const x=this.peek();
  if(x&&(x.t==='str'||x.t==='word')){this.i++;return x.v}
  throw new Error('Expected a value'+this.near()+'.')
};
Cursor.prototype.num=function(){
  const x=this.peek();
  if(x&&x.t==='word'&&/^-?\d+$/.test(x.v)){this.i++;return parseInt(x.v,10)}
  throw new Error('Expected a whole number'+this.near()+'.')
};
Cursor.prototype.isP=function(p,k){const x=this.peek(k);return!!x&&x.t==='p'&&x.v===p};
Cursor.prototype.optP=function(p){if(this.isP(p)){this.i++;return true}return false};
Cursor.prototype.p=function(p){if(!this.optP(p))throw new Error('Expected "'+p+'"'+this.near()+'.')};
Cursor.prototype.strList=function(){const out=[this.str()];while(this.optP(','))out.push(this.str());return out};
Cursor.prototype.cols=function(){if(this.isWord('*')){this.i++;return['*']}return this.strList()};
Cursor.prototype.re=function(){const x=this.peek();if(!x||x.t!=='re')throw new Error('Expected a /pattern/'+this.near()+'.');this.i++;return{src:x.v,flags:x.flags}};
Cursor.prototype.end=function(){if(!this.done())throw new Error('Unexpected text'+this.near()+'.')};
W.Cursor=Cursor;
W.cursor=function(line){return new Cursor(line)};

W.jsonDirective=function(line,prefix){
  const rest=line.slice(prefix.length).trim();
  try{return JSON.parse(rest)}catch(e){throw new Error('The settings after '+prefix+' are not valid JSON.')}
};
})(typeof self!=='undefined'?self:globalThis);
