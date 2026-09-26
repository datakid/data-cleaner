(function(G){
'use strict';
const W=G.WeftCore;
const LEVEL_RE=/^\[?(DEBUG|INFO|WARN|WARNING|ERROR|ERR|FATAL|TRACE|NOTICE|CRITICAL|CRIT)\]?:?(?=\s|$)/i;
const TS_RES=[
  /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d{1,9})?)?\s?(?:Z|UTC|[+-]\d{2}:?\d{2})?)\]?(?=\s|$)/,
  /^\[?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [ \d]\d \d{2}:\d{2}:\d{2})\]?(?=\s|$)/,
  /^\[(\d{2}\/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})\](?=\s|$)/,
  /^\[?(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\]?(?=\s|$)/
];
const ACCESS_RE=/^(\S+) (\S+) (\S+) \[([^\]]{10,40})\] "(\S+)(?: (\S+))?(?: (\S+))?" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?/;
const ACCESS_COLS=['ip','ident','user','time','method','path','protocol','status','bytes','referrer','user_agent'];
const PAIR_RE=/(^|\s)([A-Za-z_][\w.\-\/]{0,40})=("(?:[^"\\]|\\.)*"|[^\s"]*)/g;
const BULLET_RE=/^\s*(?:[-*•·–]|\d{1,3}[.)])\s+(.*)$/;
const KV_RE=/^\s*([A-Za-z][^:=]{0,39}?)\s*([:=])\s?(.*)$/;
const SEPARATOR_MD=/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const BOX_MYSQL=/^\s*\+[-+]+\+\s*$/;
const BOX_PSQL=/^\s*-+(\+-+)+\s*$/;
const JUNK_ARTIFACT=/^(page \d+( of \d+)?|[-=_*]{3,}|\(\d+ rows?\))$/i;
const TOTAL_RE=/^(total|totals|sum|grand total|subtotal|sub-total)\b/i;
W.JUNK_ARTIFACT_SRC='^(page \\d+( of \\d+)?|[-=_*]{3,}|\\(\\d+ rows?\\))$';
W.TOTAL_SRC='^(total|totals|sum|grand total|subtotal|sub-total)\\b';

function looksNumOrDate(v){v=String(v).trim();return!!(W.parseNumber(v)||W.parseNumber(v,{locale:'eu'})||W.parseDate(v))}
W.looksNumOrDate=looksNumOrDate;
W.isGenericCols=function(cols){return cols.length>0&&cols.every((c,i)=>/^(column|field|c|col|extra)_?\d+$/i.test(c))};

W.detectHeader=function(rows){
  if(!rows.length)return false;
  const cells=rows[0].map(x=>String(x==null?'':x).trim());
  if(cells.length<1||cells.some(c=>!c))return false;
  if(new Set(cells.map(c=>c.toLowerCase())).size!==cells.length)return false;
  if(cells.some(looksNumOrDate))return false;
  if(cells.some(c=>c.length>60))return false;
  const body=rows.slice(1,301);
  if(body.length){const md=modal(body.map(r=>r.filter(v=>String(v==null?'':v).trim()!=='').length));if(md.value>=2&&cells.length<md.value*0.6)return false}
  if(!body.length)return true;
  for(let c=0;c<cells.length;c++){
    let ne=0,nd=0;
    for(const r of body){const v=String(r[c]==null?'':r[c]).trim();if(!v)continue;ne++;if(looksNumOrDate(v))nd++}
    if(ne&&nd/ne>=0.8)return true
  }
  if(!cells.some(c=>/\d/.test(c))){
    let d=0;for(const r of body)if(r.some(x=>/\d/.test(String(x))))d++;
    if(d/body.length>=0.5)return true
  }
  let reappear=0;
  for(let c=0;c<cells.length;c++){
    const h=cells[c].toLowerCase();
    for(const r of body){const v=String(r[c]==null?'':r[c]).trim().toLowerCase();if(v===h&&!r.every((x,k)=>String(x).trim().toLowerCase()===cells[k].toLowerCase())){reappear++;break}}
  }
  if(reappear)return false;
  const identLike=cells.filter(c=>/^[A-Za-z_#][\w .#\/()%-]{0,39}$/.test(c)&&c.split(/\s+/).length<=4).length;
  return identLike===cells.length
};

function modal(counts){
  const f=new Map();let best=0,bc=0;
  for(const c of counts){const v=(f.get(c)||0)+1;f.set(c,v);if(v>bc||(v===bc&&c>best)){bc=v;best=c}}
  return{value:best,count:bc,share:counts.length?bc/counts.length:0}
}
W.modal=modal;

function nonEmptyLines(lines){const o=[];for(const l of lines)if(l.trim()!=='')o.push(l);return o}

function splitMdRow(line){
  let s=line.trim();
  if(s[0]==='|')s=s.slice(1);
  if(s[s.length-1]==='|'&&s[s.length-2]!=='\\')s=s.slice(0,-1);
  const out=[];let cur='';
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(c==='\\'&&s[i+1]==='|'){cur+='|';i++;continue}
    if(c==='|'){out.push(cur.trim());cur='';continue}
    cur+=c
  }
  out.push(cur.trim());
  return out
}

function parseLogLine(line,opts){
  let ts=null,rest=line;
  for(const re of TS_RES){const m=re.exec(line);if(m){ts=m[1];rest=line.slice(m[0].length);break}}
  if(ts==null)return null;
  rest=rest.replace(/^\s+/,'');
  let level='',source='';
  if(!opts||opts.level!==false){
    const lm=LEVEL_RE.exec(rest);
    if(lm){level=lm[1].toUpperCase();rest=rest.slice(lm[0].length).replace(/^\s+/,'')}
  }
  if(!opts||opts.source!==false){
    const sm=/^(\[[^\]]{1,60}\]|[^\s:=\[\]"]{1,60}:)(?=\s|$)/.exec(rest);
    if(sm){source=sm[1].replace(/^\[|\]$|:$/g,'');rest=rest.slice(sm[0].length).replace(/^\s+/,'')}
  }
  return{ts,level,source,msg:rest}
}
W.parseLogLine=parseLogLine;

function extractPairs(text){
  const pairs=[];let leftover='';let last=0;
  PAIR_RE.lastIndex=0;
  let m;
  while((m=PAIR_RE.exec(text))){
    leftover+=text.slice(last,m.index)+m[1];
    let v=m[3];
    if(v[0]==='"'){v=v.slice(1,-1).replace(/\\(.)/g,'$1')}
    pairs.push([m[2],v]);
    last=PAIR_RE.lastIndex
  }
  leftover+=text.slice(last);
  return{pairs,leftover:leftover.replace(/\s+/g,' ').trim()}
}
W.extractPairs=extractPairs;
function countPairs(line){let n=0;PAIR_RE.lastIndex=0;while(PAIR_RE.exec(line))n++;return n}

function fixedWidthCuts(lines){
  const L=lines.filter(l=>l.trim()!==''&&l.indexOf('\t')===-1);
  if(L.length<5)return null;
  let maxLen=0;for(const l of L)if(l.length>maxLen)maxLen=l.length;
  if(maxLen>2000)return null;
  const spaceCnt=new Int32Array(maxLen),lenCnt=new Int32Array(maxLen+1);
  for(const l of L){
    lenCnt[l.length]++;
    for(let p=0;p<l.length;p++)if(l.charCodeAt(p)===32)spaceCnt[p]++
  }
  const longer=new Int32Array(maxLen+1);
  let acc=0;for(let p=maxLen;p>=0;p--){longer[p]=acc;acc+=lenCnt[p]}
  const nonBlankAt=new Int32Array(maxLen);
  for(let p=0;p<maxLen;p++)nonBlankAt[p]=longer[p]-spaceCnt[p];
  const isG=new Uint8Array(maxLen);
  const fr=new Float64Array(maxLen);
  for(let p=0;p<maxLen;p++){
    const lg=longer[p];
    if(lg<Math.max(3,L.length*0.5))continue;
    fr[p]=spaceCnt[p]/lg;
    if(fr[p]>=0.95)isG[p]=1
  }
  let firstContent=0;while(firstContent<maxLen&&isG[firstContent])firstContent++;
  const cuts=[],strengths=[];
  const l0=L[0];
  let p=firstContent;
  while(p<maxLen){
    if(isG[p]){
      let q=p;let sum=0,l0space=false;
      while(q<maxLen&&isG[q]){sum+=fr[q];if(p>=l0.length||l0.charCodeAt(q)===32||q>=l0.length)l0space=true;q++}
      const single=q-p===1;
      let exact=true;if(single)for(const l of L){if(p<l.length&&l.charCodeAt(p)!==32){exact=false;break}}
      if(q<maxLen&&longer[q]>=Math.max(3,L.length*0.5)&&nonBlankAt[q]>0&&l0space&&(!single||exact)){
        cuts.push(q);strengths.push(sum/(q-p))
      }
      p=q
    }else p++
  }
  if(cuts.length<2)return null;
  const mean=strengths.reduce((a,b)=>a+b,0)/strengths.length;
  const strength=Math.max(0,Math.min(1,(mean-0.95)/0.05))*0.5+0.5*Math.min(1,L.length/12);
  return{cuts:[firstContent].concat(cuts).filter((c,i,a)=>i===0||c>a[i-1]),strength}
}
W.fixedWidthCuts=fixedWidthCuts;
function sliceFixed(line,cuts){
  const out=[];
  for(let i=0;i<cuts.length;i++){
    const a=i===0?0:cuts[i],b=i+1<cuts.length?cuts[i+1]:line.length;
    out.push(a<line.length?line.slice(a,Math.max(a,b)).trim():'')
  }
  return out
}
W.sliceFixed=sliceFixed;

function splitWsRuns(line){return line.trim().split(/\t| {2,}/)}

function kvLineMatch(line){
  const m=KV_RE.exec(line);
  if(!m)return null;
  const key=m[1].trim();
  if(!key||key.split(/\s+/).length>5)return null;
  if(/^(https?|ftp|mailto)$/i.test(key))return null;
  if(/\d$/.test(key)&&/^\d{2}\b/.test(m[3]))return null;
  return{key,sep:m[2],value:m[3].trim()}
}

function presetName(values){
  const ne=values.filter(v=>v&&v.trim());
  if(!ne.length)return null;
  const share=re=>ne.filter(v=>re.test(v.trim())).length/ne.length;
  if(share(/^[\w.+-]+@[\w-]+\.[\w.-]+$/)>=0.8)return'email';
  if(share(/^(\+?\d[\d\s().-]{6,}\d)$/)>=0.8)return'phone';
  if(share(/^(https?:\/\/|www\.)\S+$/i)>=0.8)return'url';
  return null
}

const DETECTORS=[];
function def(kind,o){o.kind=kind;DETECTORS.push(o);W.READERS[kind]=o}
W.READERS={};

def('html-table',{
  label:'Web table',
  detect(ctx){
    if(!ctx.htmlTables||!ctx.htmlTables.length)return null;
    let best=0,bi=0;
    ctx.htmlTables.forEach((t,i)=>{const cells=t.rows.length*(t.rows[0]||[]).length;if(cells>best){best=cells;bi=i}});
    const t=ctx.htmlTables[bi];
    return{confidence:0.97,params:{tableIndex:bi,header:t.thHeader||W.detectHeader(t.rows)},explain:'The clipboard contained a web table'+(ctx.htmlTables.length>1?' (table '+(bi+1)+' of '+ctx.htmlTables.length+')':'')+', so its rows and cells were used directly.'}
  },
  parse(text,params,ctx){
    const t=(ctx.htmlTables||[])[params.tableIndex||0];
    if(!t)throw new Error('The web table is no longer available. Paste it again.');
    let rows=t.rows.slice(params.skipTop||0,t.rows.length-(params.skipBottom||0));
    return{matrix:rows,warnings:t.warnings||[]}
  }
});

def('json',{
  label:'JSON',
  detect(ctx){
    const t=ctx.trimmed;
    if(t[0]!=='{'&&t[0]!=='[')return null;
    const v=ctx.json();
    if(v===undefined)return null;
    return{confidence:0.99,params:{},explain:'The text is valid JSON, so nested fields were flattened into columns like customer.name.'}
  },
  parse(text,params,ctx){
    const v=ctx.json();
    if(v===undefined)throw new Error('This is not valid JSON.');
    const r=W.jsonToMatrix(v);
    return{cols:r.cols,rows:r.rows,warnings:r.warnings}
  }
});

def('ndjson',{
  label:'JSON lines',
  detect(ctx){
    const ls=ctx.nonEmpty;
    if(ls.length<2)return null;
    const n=Math.min(ls.length,300);
    for(let i=0;i<n;i++){
      const s=ls[i].trim();
      if(s[0]!=='{'&&s[0]!=='[')return null;
      try{const v=JSON.parse(s);if(typeof v!=='object'||v===null)return null}catch(e){return null}
    }
    return{confidence:0.97,params:{},explain:'Each line is its own JSON object, so each line became a row.'}
  },
  parse(text,params){
    const ls=nonEmptyLines(text.split('\n'));
    const recs=[];let bad=0;
    for(const l of ls){try{recs.push(JSON.parse(l))}catch(e){bad++;recs.push({_unparsed:l})}}
    const r=W.jsonToMatrix(recs);
    if(bad)r.warnings.push(W.plural(bad,'line')+' could not be read as JSON and were kept in "_unparsed".');
    return{cols:r.cols,rows:r.rows,warnings:r.warnings}
  }
});

function splitPrefixed(line){
  const s=line.replace(/\s+$/,'');
  const a=s.indexOf('{');
  if(a<=0||s[s.length-1]!=='}')return null;
  const prefix=s.slice(0,a).trim();
  if(!prefix)return null;
  try{const v=JSON.parse(s.slice(a));if(v&&typeof v==='object')return{prefix,obj:v}}catch(e){}
  return null
}
def('prefixed-json',{
  label:'Log lines with JSON',
  detect(ctx){
    const ls=ctx.nonEmpty;if(ls.length<2)return null;
    let hit=0;const n=Math.min(ls.length,400);
    for(let i=0;i<n;i++)if(splitPrefixed(ls[i]))hit++;
    const f=hit/n;
    if(f<0.7)return null;
    return{confidence:0.6+0.3*f,params:{},explain:'Most lines start with some text and end with a JSON object. The text was split into columns and the JSON was flattened.'}
  },
  parse(text){
    const ls=nonEmptyLines(text.split('\n'));
    const recs=[];
    for(const l of ls){
      const sp=splitPrefixed(l);
      const rec={};
      if(!sp){rec.message=l;recs.push(rec);continue}
      const lg=parseLogLine(sp.prefix);
      if(lg){rec.timestamp=lg.ts;if(lg.level)rec.level=lg.level;if(lg.source)rec.source=lg.source;if(lg.msg)rec.message=lg.msg}
      else{sp.prefix.split(/\s+/).forEach((tok,i)=>{rec['prefix_'+(i+1)]=tok})}
      W.flattenValue(sp.obj,'',rec);
      recs.push(rec)
    }
    const cols=[],seen=new Set();
    for(const r of recs)for(const k in r)if(!seen.has(k)){seen.add(k);cols.push(k)}
    return{cols,rows:recs.map(r=>cols.map(k=>r[k]==null?'':r[k])),warnings:[]}
  }
});

const DELIMS=[[',','Comma-separated'],['\t','Tab-separated'],[';','Semicolon-separated'],['|','Pipe-separated']];
def('delimited',{
  label:'Delimited',
  labelFor(p){const d=DELIMS.find(x=>x[0]===p.delimiter);return d?d[1]:'Separated by "'+p.delimiter+'"'},
  detect(ctx){
    if(ctx.nonEmpty.length<1)return null;
    let best=null;
    for(const [d] of DELIMS){
      if(ctx.sample.indexOf(d)===-1)continue;
      let rows;
      try{rows=W.parseDelimited(ctx.sample,d,'"',2000)}catch(e){try{rows=W.parseDelimited(ctx.sample,d,'',2000)}catch(e2){continue}}
      rows=rows.filter(r=>!(r.length===1&&r[0].trim()===''));
      if(rows.length<2)continue;
      const counts=rows.map(r=>r.length);
      const md=modal(counts);
      if(md.value<2)continue;
      let consistency=md.share;
      const sampleRows=rows.filter(r=>r.length===md.value).slice(0,200);
      let words=0,cells=0,emptyCells=0;
      for(const r of sampleRows)for(const c of r){cells++;const t=c.trim();if(!t)emptyCells++;else words+=t.split(/\s+/).length}
      const avgWords=cells?words/Math.max(1,cells-emptyCells):0;
      let conf=0.5+0.45*consistency;
      if((d===','||d===';')&&avgWords>4.5)conf-=0.4;
      const withD=ctx.nonEmpty.filter(l=>l.indexOf(d)!==-1).length/ctx.nonEmpty.length;
      if(withD<0.6)conf-=0.25;
      if(d==='|'&&ctx.nonEmpty.filter(l=>/^\s*\|.*\|\s*$/.test(l)).length/ctx.nonEmpty.length>0.6)conf-=0.2;
      if(emptyCells/Math.max(1,cells)>0.6)conf-=0.2;
      const cand={confidence:conf,consistency,cols:md.value,params:{delimiter:d,quote:'"'}};
      if(!best||cand.confidence>best.confidence+1e-9||(Math.abs(cand.confidence-best.confidence)<1e-9&&cand.cols>best.cols))best=cand
    }
    if(!best)return null;
    const lbl=DELIMS.find(x=>x[0]===best.params.delimiter)[1].toLowerCase();
    best.explain=Math.round(best.consistency*100)+'% of lines split into '+best.cols+' fields on the '+(best.params.delimiter==='\t'?'tab':'"'+best.params.delimiter+'"')+' character ('+lbl+').';
    best.params.headerAuto=true;
    return best
  },
  parse(text,params){
    let rows;
    try{rows=W.parseDelimited(text,params.delimiter||',',params.quote===undefined?'"':params.quote)}
    catch(e){
      if(params.quote==='')throw e;
      rows=W.parseDelimited(text,params.delimiter||',','');
      return{matrix:rows.filter(r=>!(r.length===1&&r[0].trim()==='')),warnings:[e.message+' Quotes were treated as normal characters.']}
    }
    return{matrix:rows.filter(r=>!(r.length===1&&r[0].trim()==='')),warnings:[]}
  }
});

def('markdown-table',{
  label:'Markdown table',
  detect(ctx){
    const ls=ctx.nonEmpty;
    const piped=ls.filter(l=>/^\s*\|.*\|\s*$/.test(l)).length;
    if(piped<2)return null;
    if(!ls.some(l=>SEPARATOR_MD.test(l)&&l.indexOf('-')!==-1))return null;
    return{confidence:0.95,params:{header:true},explain:'Lines are wrapped in | characters with a ---- separator under the header, like a Markdown table.'}
  },
  parse(text){
    const out=[];
    for(const l of text.split('\n')){
      if(!l.trim())continue;
      if(SEPARATOR_MD.test(l)&&l.indexOf('-')!==-1)continue;
      if(/^\s*\|.*\|\s*$/.test(l)||l.indexOf('|')!==-1)out.push(splitMdRow(l));
      else out.push([l.trim()])
    }
    return{matrix:out,warnings:[]}
  }
});

def('box-table',{
  label:'Box-drawn table',
  detect(ctx){
    const ls=ctx.nonEmpty;
    const my=ls.filter(l=>BOX_MYSQL.test(l)).length,pg=ls.filter(l=>BOX_PSQL.test(l)).length;
    if(my>=2)return{confidence:0.94,params:{style:'mysql',header:true},explain:'The text is drawn with +---+ borders and | separators, like MySQL output.'};
    if(pg>=1&&ls.filter(l=>l.indexOf('|')!==-1).length>=2)return{confidence:0.94,params:{style:'psql',header:true},explain:'A ---+--- rule sits under a header with | separators, like psql output.'};
    return null
  },
  parse(text,params){
    const ls=text.split('\n');
    const out=[];let pos=null;
    for(const l of ls){
      if(!l.trim())continue;
      if(BOX_MYSQL.test(l)){if(!pos){pos=[];for(let i=0;i<l.length;i++)if(l[i]==='+')pos.push(i)}continue}
      if(BOX_PSQL.test(l)){if(!pos){pos=[-1];for(let i=0;i<l.length;i++)if(l[i]==='+')pos.push(i);pos.push(1e9)}continue}
      if(params.style==='mysql'&&/^\s*\|.*\|\s*$/.test(l)){out.push(splitMdRow(l));continue}
      if(params.style==='psql'&&l.indexOf('|')!==-1){out.push(l.split('|').map(s=>s.trim()));continue}
      out.push([l.trim()])
    }
    return{matrix:out,warnings:[]}
  }
});

def('fixed-width',{
  label:'Fixed-width columns',
  detect(ctx){
    const fw=fixedWidthCuts(ctx.nonEmpty.slice(0,2000));
    if(!fw)return null;
    return{confidence:0.55+0.4*fw.strength,consistency:1,cols:fw.cuts.length,params:{cuts:fw.cuts,headerAuto:true},explain:'Columns line up at the same character positions on '+(fw.strength>0.9?'every':'almost every')+' line, so the text was cut at '+fw.cuts.length+' positions.'}
  },
  parse(text,params){
    const cuts=(params.cuts||[0]).slice().sort((a,b)=>a-b);
    if(cuts[0]!==0)cuts.unshift(0);
    const out=[];
    for(const l of text.split('\n')){if(l.trim())out.push(sliceFixed(l.replace(/\t/g,'    '),cuts))}
    return{matrix:out,warnings:[]}
  }
});

def('whitespace-runs',{
  label:'Whitespace-separated',
  detect(ctx){
    const ls=ctx.nonEmpty.slice(0,2000);
    if(ls.length<3)return null;
    const counts=ls.map(l=>splitWsRuns(l).length);
    const md=modal(counts);
    if(md.value<2||md.share<0.8)return null;
    return{confidence:0.5+0.4*md.share,consistency:md.share,cols:md.value,params:{headerAuto:true},explain:Math.round(md.share*100)+'% of lines split into '+md.value+' fields on tabs or runs of two or more spaces.'}
  },
  parse(text){
    const out=[];
    for(const l of text.split('\n'))if(l.trim())out.push(splitWsRuns(l));
    return{matrix:out,warnings:[]}
  }
});

def('key-value-blocks',{
  label:'Key: value records',
  detect(ctx){
    const ls=ctx.nonEmpty.slice(0,2000);
    if(ls.length<2)return null;
    let hit=0,colon=0,eq=0,multiPair=0;
    for(const l of ls){const m=kvLineMatch(l);if(m){hit++;if(m.sep===':')colon++;else eq++;if(countPairs(l)>=2)multiPair++}}
    const f=hit/ls.length;
    if(f<0.6)return null;
    if(multiPair/Math.max(1,hit)>0.5)return null;
    const sep=colon>=eq?':':'=';
    const hasBlank=/\n[ \t]*\n\s*\S/.test(ctx.sample.trim());
    const boundary=hasBlank?'blank':'repeat';
    const keys=new Set();for(const l of ls){const m=kvLineMatch(l);if(m&&m.sep===sep)keys.add(m.key.toLowerCase())}
    let conf=0.5+0.45*f;
    if(keys.size<2)conf-=0.2;
    return{confidence:conf,params:{sep,boundary},explain:Math.round(f*100)+'% of lines look like "key'+sep+' value". Each '+(boundary==='blank'?'blank-line-separated block':'group that restarts at the first key')+' became one row.'}
  },
  parse(text,params){
    const sep=params.sep||':';
    const lines=text.split('\n');
    const recs=[];let cur=null,lastKey=null,firstKey=null;
    const flush=()=>{if(cur&&Object.keys(cur).length)recs.push(cur);cur=null;lastKey=null};
    for(const raw of lines){
      if(!raw.trim()){if(params.boundary!=='repeat')flush();continue}
      const m=kvLineMatch(raw);
      if(m&&m.sep===sep){
        if(firstKey==null)firstKey=m.key;
        if(params.boundary==='repeat'&&cur&&m.key===firstKey)flush();
        if(!cur)cur={};
        let k=m.key;
        if(k in cur){let i=2;while((k+'_'+i) in cur)i++;k=k+'_'+i}
        cur[k]=m.value;lastKey=k
      }else{
        if(!cur)cur={};
        if(lastKey)cur[lastKey]=(cur[lastKey]?cur[lastKey]+' ':'')+raw.trim();
        else cur.text=(cur.text?cur.text+' ':'')+raw.trim()
      }
    }
    flush();
    const cols=[],seen=new Set();
    for(const r of recs)for(const k in r)if(!seen.has(k)){seen.add(k);cols.push(k)}
    return{cols,rows:recs.map(r=>cols.map(k=>r[k]==null?'':r[k])),warnings:[]}
  }
});

function blocksOf(text){
  const blocks=[];let cur=[];
  for(const l of text.split('\n')){
    if(l.trim()===''){if(cur.length){blocks.push(cur);cur=[]}}
    else cur.push(l.trim())
  }
  if(cur.length)blocks.push(cur);
  return blocks
}
def('line-blocks',{
  label:'Blocks of lines',
  detect(ctx){
    const b=blocksOf(ctx.sample);
    if(b.length<2)return null;
    const md=modal(b.map(x=>x.length));
    if(md.value<2||md.value>12||md.share<0.8)return null;
    return{confidence:0.75,consistency:md.share,cols:md.value,params:{k:md.value},explain:'The text is split into blocks by blank lines and most blocks have '+md.value+' lines, so each block became a row.'}
  },
  parse(text,params){
    const b=blocksOf(text);
    let k=params.k||2;for(const x of b)if(x.length>k)k=x.length;
    const rows=b.map(x=>{const r=x.slice();while(r.length<k)r.push('');return r});
    const cols=[];const used=new Set();
    for(let i=0;i<k;i++){
      const nm=presetName(rows.map(r=>r[i]));
      let name=nm&&!used.has(nm)?nm:'field_'+(i+1);
      used.add(name);cols.push(name)
    }
    return{cols,rows,warnings:[]}
  }
});

def('logfmt',{
  label:'key=value pairs',
  detect(ctx){
    const ls=ctx.nonEmpty.slice(0,1000);if(ls.length<2)return null;
    let hit=0;for(const l of ls)if(countPairs(l)>=3)hit++;
    const f=hit/ls.length;
    if(f<0.7)return null;
    return{confidence:0.85,params:{},explain:Math.round(f*100)+'% of lines contain three or more key=value pairs. Each key became a column and leftover text went to "message".'}
  },
  parse(text){
    const recs=[];const keys=[],seen=new Set();let hasMsg=false;
    for(const l of text.split('\n')){
      if(!l.trim())continue;
      const e=extractPairs(l);const rec={};
      for(const[k,v]of e.pairs){let kk=k;if(kk in rec){let i=2;while((kk+'_'+i) in rec)i++;kk=kk+'_'+i}rec[kk]=v;if(!seen.has(kk)){seen.add(kk);keys.push(kk)}}
      if(e.leftover){rec.__msg=e.leftover;hasMsg=true}
      recs.push(rec)
    }
    const capped=keys.slice(0,300);
    const cols=capped.slice();const msgName=seen.has('message')?'message_text':'message';
    if(hasMsg)cols.push(msgName);
    const rows=recs.map(r=>{const o=capped.map(k=>r[k]==null?'':r[k]);if(hasMsg)o.push(r.__msg||'');return o});
    return{cols,rows,warnings:keys.length>300?['Only the first 300 distinct keys became columns.']:[]}
  }
});

def('access-log',{
  label:'Web server access log',
  detect(ctx){
    const ls=ctx.nonEmpty.slice(0,1000);if(!ls.length)return null;
    let hit=0;for(const l of ls)if(ACCESS_RE.test(l))hit++;
    const f=hit/ls.length;
    if(f<0.7)return null;
    return{confidence:0.95,params:{},explain:Math.round(f*100)+'% of lines match the Apache/Nginx access log format.'}
  },
  parse(text){
    const rows=[];let other=0;
    for(const l of text.split('\n')){
      if(!l.trim())continue;
      const m=ACCESS_RE.exec(l);
      if(m){rows.push(m.slice(1,12).map(v=>v==null?'':v).concat(['']))}
      else{other++;const r=new Array(11).fill('');r.push(l);rows.push(r)}
    }
    const cols=ACCESS_COLS.slice();
    if(other)cols.push('unparsed');else rows.forEach(r=>r.pop());
    return{cols,rows,warnings:other?[W.plural(other,'line')+' did not match the log format and were kept in "unparsed".']:[]}
  }
});

def('log-lines',{
  label:'Log lines',
  detect(ctx){
    const ls=ctx.nonEmpty.slice(0,1000);if(ls.length<2)return null;
    let hit=0,lv=0,src=0,pairs=0;
    for(const l of ls){const p=parseLogLine(l);if(p){hit++;if(p.level)lv++;if(p.source)src++;if(countPairs(p.msg)>=2)pairs++}}
    const f=hit/ls.length;
    if(f<0.7)return null;
    const usePairs=pairs/hit>=0.5;
    return{confidence:usePairs?0.88:0.8,params:{level:lv/hit>=0.3,source:src/hit>=0.3,pairs:usePairs},explain:Math.round(f*100)+'% of lines start with a timestamp'+(lv/hit>=0.3?', followed by a level like INFO or ERROR':'')+(usePairs?'. key=value pairs in the message became columns':'')+'. Lines without a timestamp were joined to the line above.'}
  },
  parse(text,params){
    const recs=[];const pairKeys=[],pk=new Set();
    for(const l of text.split('\n')){
      if(!l.trim())continue;
      const p=parseLogLine(l,params);
      if(!p){
        if(recs.length){const last=recs[recs.length-1];last.message=(last.message?last.message+'\n':'')+l}
        else recs.push({timestamp:'',level:'',source:'',message:l,pairs:[]});
        continue
      }
      let msg=p.msg,pairs=[];
      if(params.pairs){const e=extractPairs(msg);pairs=e.pairs;msg=e.leftover;for(const[k]of pairs)if(!pk.has(k)){pk.add(k);pairKeys.push(k)}}
      recs.push({timestamp:p.ts,level:p.level,source:p.source,message:msg,pairs})
    }
    const cols=['timestamp'];
    if(params.level!==false&&recs.some(r=>r.level))cols.push('level');
    if(params.source!==false&&recs.some(r=>r.source))cols.push('source');
    cols.push('message');
    const keys=pairKeys.slice(0,200).filter(k=>cols.indexOf(k)===-1);
    const rows=recs.map(r=>{
      const o=[r.timestamp];
      if(cols.indexOf('level')!==-1)o.push(r.level);
      if(cols.indexOf('source')!==-1)o.push(r.source);
      o.push(r.message);
      if(keys.length){const m={};for(const[k,v]of r.pairs)if(!(k in m))m[k]=v;for(const k of keys)o.push(m[k]==null?'':m[k])}
      return o
    });
    return{cols:cols.concat(keys),rows,warnings:[]}
  }
});

def('list',{
  label:'Bulleted list',
  detect(ctx){
    const ls=ctx.nonEmpty.slice(0,2000);if(ls.length<2)return null;
    let hit=0,det=0;
    for(const l of ls){const m=BULLET_RE.exec(l);if(m){hit++;if(/ [-–—] |: /.test(m[1]))det++}}
    const f=hit/ls.length;
    if(f<0.7)return null;
    const split=det/hit>=0.7;
    return{confidence:0.7,params:{split},explain:Math.round(f*100)+'% of lines start with a bullet or number'+(split?', and most items have a " – " or ": " that separates a name from a detail':'')+'.'}
  },
  parse(text,params){
    const rows=[];
    for(const l of text.split('\n')){
      if(!l.trim())continue;
      const m=BULLET_RE.exec(l);
      const item=m?m[1].trim():l.trim();
      if(params.split){
        const sm=/^(.*?)\s+[-–—]\s+(.*)$/.exec(item)||/^(.*?):\s+(.*)$/.exec(item);
        rows.push(sm?[sm[1].trim(),sm[2].trim()]:[item,''])
      }else rows.push([item])
    }
    return{cols:params.split?['item','detail']:['item'],rows,warnings:[]}
  }
});

def('lines',{
  label:'Plain lines',
  detect(){return{confidence:0.3,params:{keepBlank:false},explain:'No column structure was found, so each line became one row in a single "line" column.'}},
  parse(text,params){
    const ls=text.split('\n');
    while(ls.length&&ls[ls.length-1]==='')ls.pop();
    const rows=[];
    for(const l of ls){if(!params.keepBlank&&!l.trim())continue;rows.push([l])}
    return{cols:['line'],rows,warnings:[]}
  }
});

W.scanText=function(text){
  const s={nbsp:0,zeroWidth:0,smartQuotes:0,mixedIndent:0,control:0};
  const lim=Math.min(text.length,4000000);
  for(let i=0;i<lim;i++){
    const c=text.charCodeAt(i);
    if(c===0xA0)s.nbsp++;
    else if(c>=0x200B&&c<=0x200D||c===0xFEFF||c===0x2060)s.zeroWidth++;
    else if(c===0x2018||c===0x2019||c===0x201C||c===0x201D)s.smartQuotes++;
    else if(c<32&&c!==9&&c!==10&&c!==13)s.control++
  }
  return s
};

function applySkip(text,params){
  const top=params.skipTop|0,bot=params.skipBottom|0;
  if(!top&&!bot)return text;
  const ls=text.split('\n');
  while(ls.length&&ls[ls.length-1].trim()==='')ls.pop();
  return ls.slice(top,Math.max(top,ls.length-bot)).join('\n')
}

W.runReader=function(kind,text,params,ctx){
  const R=W.READERS[kind];
  if(!R)throw new Error('Unknown reading "'+kind+'".');
  const src=kind==='html-table'||kind==='json'?text:applySkip(text,params);
  const out=R.parse(src,params,ctx);
  let cols,rows,header=false;
  if(out.matrix){
    const hdr=params.header!=null?params.header:(params.headerAuto?W.detectHeader(out.matrix):true);
    header=!!hdr;
    if(header&&out.matrix.length){cols=out.matrix[0].map(String);rows=out.matrix.slice(1)}
    else{let w=0;for(const r of out.matrix)if(r.length>w)w=r.length;cols=W.identity(w,1).map(i=>'column_'+i);rows=out.matrix}
  }else{cols=out.cols;rows=out.rows;header=true}
  return{cols,rows,warnings:out.warnings||[],header,matrixKind:!!out.matrix}
};

W.findJunk=function(cols,rows){
  const n=rows.length;
  const res={title:[],headerRow:-1,totals:[],artifacts:[],repeated:[]};
  if(!n)return res;
  const lim=Math.min(n,3000);
  const ne=r=>{let k=0;for(const v of r)if(String(v==null?'':v).trim())k++;return k};
  const counts=[];for(let i=0;i<lim;i++)counts.push(ne(rows[i]));
  const md=modal(counts.filter(c=>c>0));
  const width=cols.length;
  const joined=r=>r.map(v=>String(v==null?'':v).trim()).filter(Boolean).join(' ');
  for(let i=0;i<n;i++){if(JUNK_ARTIFACT.test(joined(rows[i])))res.artifacts.push(i);if(res.artifacts.length>5000)break}
  const art=new Set(res.artifacts);
  if(width>=2&&md.value>=2){
    for(let i=0;i<Math.min(10,n-1);i++){
      if(art.has(i))continue;
      const c=counts[i];
      if(c<=1||c<md.value/2)res.title.push(i);else break
    }
    const generic=W.isGenericCols(cols);
    const h=res.title.length;
    if(generic&&h<n-1){
      const cand=rows[h].map(v=>String(v==null?'':v).trim());
      if(cand.filter(Boolean).length>=Math.max(2,md.value-1)&&W.detectHeader([cand].concat(rows.slice(h+1,h+200))))res.headerRow=h
    }
  }
  if(res.title.length&&res.title.length===n)res.title=[];
  let i=n-1,guard=0;
  while(i>=0&&guard<8){
    guard++;
    const r=rows[i];
    if(art.has(i)||ne(r)===0){i--;continue}
    const first=r.map(v=>String(v==null?'':v).trim()).find(Boolean)||'';
    if(TOTAL_RE.test(first)){res.totals.unshift(i);i--;continue}
    break
  }
  const hdrNames=(res.headerRow>=0?rows[res.headerRow]:(W.isGenericCols(cols)?null:cols));
  if(hdrNames&&width>=2){
    const key=hdrNames.map(v=>String(v==null?'':v).trim().toLowerCase()).join('\u0001');
    for(let j=0;j<n;j++){
      if(j===res.headerRow)continue;
      if(rows[j].map(v=>String(v==null?'':v).trim().toLowerCase()).join('\u0001')===key)res.repeated.push(j);
      if(res.repeated.length>5000)break
    }
  }
  return res
};

W.detectReadings=function(text,opts){
  opts=opts||{};
  text=W.normalizeInput(text||'');
  const htmlTables=opts.htmlTables||null;
  const trimmed=text.trim();
  if(!trimmed&&!(htmlTables&&htmlTables.length))throw new Error('There is nothing to read. The input is empty.');
  const all=text.split('\n');
  let sampleEnd=all.length,cnt=0,bytes=0;
  for(let i=0;i<all.length;i++){
    bytes+=all[i].length+1;
    if(all[i].trim())cnt++;
    if(cnt>=2000||bytes>=2000000){sampleEnd=i+1;break}
  }
  const sampleLines=all.slice(0,sampleEnd);
  const sample=sampleLines.join('\n');
  let jsonCache;
  const ctx={
    text,trimmed,sample,lines:sampleLines,nonEmpty:nonEmptyLines(sampleLines),htmlTables,
    json(){if(jsonCache===undefined){jsonCache=null;try{jsonCache=JSON.parse(trimmed)}catch(e){jsonCache=null}}return jsonCache===null?undefined:jsonCache}
  };
  const found=[];
  for(const D of DETECTORS){
    let r=null;
    const t0=Date.now();
    try{r=D.detect(ctx)}catch(e){r=null}
    if(!r)continue;
    r.kind=D.kind;
    r.ms=Date.now()-t0;
    found.push(r)
  }
  const has=k=>found.find(r=>r.kind===k);
  const logs=has('log-lines'),acc=has('access-log'),kv=has('key-value-blocks'),fw=has('fixed-width'),ws=has('whitespace-runs'),dl=has('delimited'),md=has('markdown-table'),bx=has('box-table'),js=has('json')||has('ndjson');
  if(kv&&(logs||acc||has('logfmt')))kv.confidence-=0.35;
  const logLike=[logs,acc,has('logfmt'),has('prefixed-json')].filter(Boolean);
  if(logLike.length){const top=Math.max.apply(null,logLike.map(r=>r.confidence));[fw,ws,dl].forEach(r=>{if(r&&r.confidence>top-0.05)r.confidence=top-0.05})}
  if(acc&&logs)logs.confidence-=0.2;
  if(md||bx){[fw,ws,dl].forEach(r=>{if(r)r.confidence-=0.3})}
  if(js){found.forEach(r=>{if(r!==js&&r.kind!=='lines')r.confidence-=0.3})}
  if(has('prefixed-json')&&logs)logs.confidence-=0.1;
  if(has('logfmt')&&dl&&dl.params.delimiter===' ')dl.confidence-=0.3;
  if(dl&&dl.params.delimiter==='\t'&&ws)ws.confidence=Math.min(ws.confidence,dl.confidence-0.06);
  if(dl&&fw&&dl.consistency>=0.95&&dl.params.delimiter!==' ')fw.confidence=Math.min(fw.confidence,dl.confidence-0.05);
  if(has('list')){const l=has('list');[fw,ws,kv].forEach(r=>{if(r&&r.confidence>l.confidence-0.05)r.confidence=l.confidence-0.05})}
  if(has('line-blocks')&&kv&&kv.confidence>0.6)has('line-blocks').confidence=Math.min(0.7,kv.confidence-0.05);
  found.forEach(r=>{r.confidence=Math.max(0.05,Math.min(0.99,r.confidence))});
  const readings=[];
  for(const r of found){
    let prev;
    try{prev=W.runReader(r.kind,r.kind==='json'?text:sample,r.params,ctx)}catch(e){continue}
    if(!prev.cols.length)continue;
    if(prev.matrixKind&&r.params.header==null)r.params.header=prev.header;
    delete r.params.headerAuto;
    const R=W.READERS[r.kind];
    const junk=W.findJunk(prev.cols,prev.rows);
    readings.push({
      kind:r.kind,
      label:R.labelFor?R.labelFor(r.params):R.label,
      confidence:Math.round(r.confidence*1000)/1000,
      strength:r.confidence>=0.8?'Strong match':r.confidence>=0.5?'Possible match':'Fallback',
      params:Object.assign({},r.params,{junk:{title:junk.title.length,headerRow:junk.headerRow,totals:junk.totals.length,artifacts:junk.artifacts.length,repeated:junk.repeated.length}}),
      explain:r.explain,
      consistency:r.consistency==null?1:r.consistency,
      preview:{cols:W.dedupeColNames(prev.cols.map((c,i)=>String(c).trim()||'column_'+(i+1))),rows:prev.rows.slice(0,50),total:prev.rows.length}
    })
  }
  readings.sort((a,b)=>b.confidence-a.confidence);
  if(readings.length>1&&readings[0].kind==='fixed-width'){
    const wi=readings.findIndex(r=>r.kind==='whitespace-runs');
    if(wi>0&&readings[wi].consistency>=0.95&&readings[wi].preview.cols.length===readings[0].preview.cols.length){const w=readings.splice(wi,1)[0];w.confidence=Math.max(w.confidence,readings[0].confidence);readings.unshift(w)}
  }
  if(readings.length>1){
    const a=readings[0],b=readings[1];
    if(a.confidence-b.confidence<0.05&&b.preview.cols.length>a.preview.cols.length&&b.consistency>=0.9&&b.kind!=='lines'){readings[0]=b;readings[1]=a}
  }
  return{readings,scan:W.scanText(text),sampleLines:sampleLines.slice(0,60),lineCount:all.length}
};

W.applyReading=function(text,reading,opts){
  opts=opts||{};
  text=W.normalizeInput(text||'');
  let jsonCache;
  const trimmed=text.trim();
  const ctx={text,trimmed,htmlTables:opts.htmlTables||null,json(){if(jsonCache===undefined){jsonCache=null;try{jsonCache=JSON.parse(trimmed)}catch(e){}}return jsonCache===null?undefined:jsonCache}};
  const out=W.runReader(reading.kind,text,reading.params||{},ctx);
  const t=W.makeTable(out.cols,out.rows);
  t.warnings=(out.warnings||[]).concat(t.warnings||[]);
  return t
};

W.structureValues=function(values,kind,params){
  params=params||{};
  const rows=[];let cols=null;
  if(kind==='fixed-width'){
    const cuts=(params.cuts&&params.cuts.length?params.cuts:(fixedWidthCuts(values.filter(Boolean).slice(0,2000))||{cuts:[0]}).cuts).slice().sort((a,b)=>a-b);
    if(cuts[0]!==0)cuts.unshift(0);
    for(const v of values)rows.push(v?sliceFixed(String(v),cuts):[]);
    return{rows,cols:null,params:{cuts}}
  }
  if(kind==='whitespace-runs'){for(const v of values)rows.push(v&&String(v).trim()?splitWsRuns(String(v)):[]);return{rows,cols:null,params}}
  if(kind==='delimited'){const d=params.delimiter||',';for(const v of values)rows.push(v?String(v).split(d).map(s=>s.trim()):[]);return{rows,cols:null,params}}
  const recs=[],keys=[],seen=new Set();
  const add=(rec,k,v)=>{k=String(k).trim();if(!k)return;let kk=k;if(kk in rec){let i=2;while((kk+'_'+i) in rec)i++;kk=kk+'_'+i}rec[kk]=v;if(!seen.has(kk)){seen.add(kk);keys.push(kk)}};
  let re=null;
  if(kind==='pattern'){
    re=W.compileRegex(params.pattern||'',params.caseSensitive?'':'i');
  }
  for(const v of values){
    const rec={};const s=String(v==null?'':v);
    if(!s.trim()){recs.push(rec);continue}
    if(kind==='key-value'){
      const sep=params.sep||':';
      const parts=s.split(/\s*[;\n|]\s*|,\s*(?=[A-Za-z][\w .-]{0,30}\s*[:=])/);
      for(const p of parts){const i=p.indexOf(sep);if(i>0)add(rec,p.slice(0,i),p.slice(i+1).trim());else if(p.trim())add(rec,'text',p.trim())}
    }else if(kind==='logfmt'){
      const e=extractPairs(s);for(const[k,val]of e.pairs)add(rec,k,val);if(e.leftover)add(rec,'message',e.leftover)
    }else if(kind==='json'){
      let o;try{o=JSON.parse(s)}catch(e){o=undefined}
      if(o!==undefined&&o!==null&&typeof o==='object'){const out={};W.flattenValue(o,'',out);for(const k in out)add(rec,k,out[k])}
      else add(rec,'_unparsed',s)
    }else if(kind==='pattern'){
      const m=re.exec(s);
      if(m){
        if(m.groups&&Object.keys(m.groups).length){for(const k in m.groups)add(rec,k,m.groups[k]==null?'':m.groups[k])}
        else for(let i=1;i<m.length;i++)add(rec,'group_'+i,m[i]==null?'':m[i]);
        if(m.length===1)add(rec,'match',m[0])
      }
    }else throw new Error('Unknown split kind "'+kind+'".')
    recs.push(rec)
  }
  if(kind==='pattern'&&!keys.length){
    const src=params.pattern||'';const names=[];const gre=/\(\?<([A-Za-z_]\w*)>/g;let g;while((g=gre.exec(src)))names.push(g[1]);
    names.forEach(k=>{if(!seen.has(k)){seen.add(k);keys.push(k)}})
  }
  cols=keys.slice(0,300);
  for(const r of recs)rows.push(cols.map(k=>r[k]==null?'':r[k]));
  return{rows,cols,params}
};
})(typeof self!=='undefined'?self:globalThis);
