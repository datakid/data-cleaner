(function(G){
'use strict';
const W=G.WeftCore;
W.TABLE_KINDS=new Set(['delimited','markdown-table','box-table','fixed-width','whitespace-runs']);
W.MULTI={maxBytes:20e6,maxBlocks:400,maxTables:12,minCols:2,minLines:2,titleMaxLines:3,titleMaxLen:80,widthScanMaxLines:50000,pieceSampleLines:2000};
const NB=/\S/;
const PSQL_END=/^\s*\(\d+ rows?\)\s*$/;
const ROWS_IN_SET=/rows? in set/i;
const fc=l=>{for(let i=0;i<l.length;i++){const c=l.charCodeAt(i);if(c!==32&&c!==9)return c}return 0};
const names=a=>(a||[]).map(x=>String(x==null?'':x).trim().toLowerCase()).join('\u0001');

W.sliceLines=function(lines,from,to){return lines.slice(from,to).join('\n')};

W.tableBlocks=function(lines){
  const out=[];let from=-1;
  for(let i=0;i<lines.length;i++){
    if(!NB.test(lines[i])){if(from!==-1){out.push({from,to:i});from=-1}}
    else if(from===-1)from=i
  }
  if(from!==-1)out.push({from,to:lines.length});
  return out
};

W.countFields=function(line,delim,st){
  const d=delim.charCodeAt(0);
  let n=1,q=st.q,fs=!st.q;
  for(let i=0;i<line.length;i++){
    const c=line.charCodeAt(i);
    if(q){if(c===34){if(line.charCodeAt(i+1)===34)i++;else q=false}}
    else if(c===d){n++;fs=true}
    else if(c===34&&fs){q=true;fs=false}
    else if(c!==32)fs=false
  }
  st.q=q;
  return{n,open:q}
};

W.guessDelimiter=function(lines,from,to){
  const sample=[];
  for(let i=from;i<to&&sample.length<200;i++)if(NB.test(lines[i]))sample.push(lines[i]);
  if(sample.length<2)return null;
  let best=null,bn=0;
  for(const d of[',','\t',';','|']){
    const st={q:false},counts=[];let has=0;
    for(const l of sample){if(l.indexOf(d)!==-1)has++;counts.push(W.countFields(l,d,st).n)}
    if(has/sample.length<0.8)continue;
    const md=W.modal(counts);
    if(md.value>=2&&md.value>bn){best=d;bn=md.value}
  }
  return best
};

W.recordWidths=function(lines,from,to,delim){
  const out=[],st={q:false};let cur=null;
  for(let i=from;i<to;i++){
    const was=st.q;
    const r=W.countFields(lines[i],delim,st);
    if(was&&cur)cur.n+=r.n-1;
    else{cur={line:i,n:r.n};out.push(cur)}
    if(!r.open)cur=null
  }
  return out
};

W.splitByWidthChange=function(lines,from,to,delim){
  if(to-from>W.MULTI.widthScanMaxLines)return[{from,to}];
  const rec=W.recordWidths(lines,from,to,delim);
  if(rec.length<4)return[{from,to}];
  const runs=[];
  rec.forEach((r,i)=>{const l=runs[runs.length-1];if(l&&l.n===r.n)l.c++;else runs.push({n:r.n,start:r.line,ri:i,c:1})});
  if(runs.length<2)return[{from,to}];
  const cuts=[];
  for(let k=0;k<runs.length-1;k++){
    const a=runs[k],b=runs[k+1];
    if(a.c<2||b.c<2)continue;
    let ok=a.c>=3&&b.c>=3;
    if(!ok){
      const last=Math.min(rec.length,b.ri+Math.min(b.c,50));
      const end=last<rec.length?rec[last].line:to;
      let rows=null;
      try{rows=W.parseDelimited(W.sliceLines(lines,b.start,end),delim,'"')}catch(e){rows=null}
      ok=!!(rows&&rows.length&&W.detectHeader(rows))
    }
    if(ok)cuts.push(b.start)
  }
  const out=[];let prev=from;
  cuts.forEach(c=>{if(c>prev){out.push({from:prev,to:c});prev=c}});
  out.push({from:prev,to});
  return out
};

function cutAt(from,to,cuts){
  const out=[];let prev=from;
  cuts.forEach(c=>{if(c>prev&&c<to){out.push({from:prev,to:c});prev=c}});
  out.push({from:prev,to});
  return out
}

W.splitMarkdownTables=function(lines,from,to){
  const sep=new RegExp(W.SEPARATOR_MD_SRC),starts=[];
  for(let i=from+1;i<to;i++){
    const l=lines[i],c=fc(l);
    if((c===124||c===58||c===45)&&l.indexOf('-')!==-1&&sep.test(l))starts.push(i-1)
  }
  return cutAt(from,to,starts.slice(1))
};

W.splitBoxTables=function(lines,from,to){
  const my=new RegExp(W.BOX_MYSQL_SRC),starts=[],cuts=[];
  for(let i=from;i<to;i++){
    const l=lines[i],c=fc(l);
    if(c===43){
      if(my.test(l)&&i+2<to&&my.test(lines[i+2])&&!my.test(lines[i+1])&&(i===from||fc(lines[i-1])!==124))starts.push(i)
    }else if(c===40&&PSQL_END.test(l)&&i+1<to)cuts.push(i+1)
  }
  return cutAt(from,to,starts.slice(1).concat(cuts).sort((a,b)=>a-b))
};

function structured(lines,p){
  const md=new RegExp(W.SEPARATOR_MD_SRC),my=new RegExp(W.BOX_MYSQL_SRC),pg=new RegExp(W.BOX_PSQL_SRC);
  for(let i=p.from;i<p.to;i++){
    const l=lines[i],c=fc(l);
    if(c===43&&my.test(l))return true;
    if((c===124||c===58||c===45)&&((l.indexOf('-')!==-1&&md.test(l))||pg.test(l)))return true
  }
  return false
}

W.splitRegion=function(lines,block){
  let parts=W.splitBoxTables(lines,block.from,block.to);
  parts=parts.flatMap(p=>W.splitMarkdownTables(lines,p.from,p.to));
  return parts.flatMap(p=>{
    if(p.to-p.from>W.MULTI.widthScanMaxLines||structured(lines,p))return[p];
    const dl=W.guessDelimiter(lines,p.from,p.to);
    return dl?W.splitByWidthChange(lines,p.from,p.to,dl):[p]
  })
};

W.classifyPiece=function(lines,part){
  const text=W.sliceLines(lines,part.from,Math.min(part.to,part.from+W.MULTI.pieceSampleLines));
  const fail=kind=>({from:part.from,to:part.to,kind,tabular:false,lines:0,cols:0});
  let det;
  try{det=W.detectReadings(text)}catch(e){return fail()}
  const top=det.readings[0];
  if(!top)return fail();
  let rr;
  try{rr=W.runReader(top.kind,text,top.params,{})}catch(e){return fail(top.kind)}
  let from=part.from,title=null,header=rr.header,colNames=rr.cols;
  if(!rr.header&&rr.matrixKind){
    const k=W.findJunk(rr.cols,rr.rows).headerRow;
    if(k>0&&k<=W.MULTI.titleMaxLines&&rr.rows[k]){
      const tl=[];let i=part.from;
      for(;i<part.to&&tl.length<k;i++)if(NB.test(lines[i]))tl.push(lines[i]);
      if(tl.length===k&&tl.every(l=>l.indexOf('"')===-1&&l.trim().length<=W.MULTI.titleMaxLen)){
        title=rr.rows.slice(0,k).map(r=>r.map(x=>String(x==null?'':x).trim()).filter(Boolean).join(' ')).filter(Boolean).join(' · ')||null;
        from=i;header=true;colNames=rr.rows[k].map(String)
      }
    }
  }
  let n=0;
  for(let i=from;i<part.to;i++)if(NB.test(lines[i]))n++;
  const cols=rr.cols.length;
  return{from,to:part.to,kind:top.kind,label:top.label,params:top.params,confidence:top.confidence,cols,colNames,header,title,lines:n,
    tabular:W.TABLE_KINDS.has(top.kind)&&cols>=W.MULTI.minCols&&n>=(top.kind==='markdown-table'?3:W.MULTI.minLines)}
};

W.tableSignature=function(p){return p.kind+'|'+((p.params&&p.params.delimiter)||'')+'|'+p.cols};

W.isFooterText=function(text){
  const total=new RegExp(W.TOTAL_SRC,'i'),art=new RegExp(W.JUNK_ARTIFACT_SRC,'i');
  const ls=String(text).split('\n').map(l=>l.trim()).filter(Boolean);
  return ls.length>0&&ls.every(l=>total.test(l)||art.test(l)||ROWS_IN_SET.test(l)||PSQL_END.test(l))
};

W.isTitlePiece=function(lines,p){
  if(p.tabular||p.lines>W.MULTI.titleMaxLines)return false;
  const ls=lines.slice(p.from,p.to).filter(l=>NB.test(l));
  return ls.length>0&&ls.every(l=>l.trim().length<=W.MULTI.titleMaxLen)&&!W.isFooterText(ls.join('\n'))
};

W.mergePieces=function(lines,pieces){
  const tables=[];let skipped=0,ttl=null,adj=false;
  for(let i=0;i<pieces.length;i++){
    const p=pieces[i],last=tables[tables.length-1];
    if(!p.tabular){
      const text=W.sliceLines(lines,p.from,p.to);
      if(adj&&last&&W.isFooterText(text)){last.to=p.to;continue}
      const nx=pieces[i+1];
      if(W.isTitlePiece(lines,p)&&nx&&nx.tabular){ttl=text.split('\n').map(l=>l.trim()).filter(Boolean).join(' · ');adj=false;continue}
      skipped++;ttl=null;adj=false;continue
    }
    if(adj&&last&&!p.title&&W.tableSignature(last)===W.tableSignature(p)&&!(p.header&&(!last.header||names(last.colNames)!==names(p.colNames)))){last.to=p.to;continue}
    tables.push({from:p.from,to:p.to,kind:p.kind,params:p.params,cols:p.cols,header:p.header,colNames:p.colNames,title:p.title||ttl});
    ttl=null;adj=true
  }
  return{tables,skipped}
};

W.findTables=function(text,opts){
  opts=opts||{};
  const M=W.MULTI;
  const out=(extra)=>Object.assign({split:false,tables:[],skipped:0,truncated:false,total:0,reason:''},extra);
  const finish=(tables,skipped)=>{
    const total=tables.length;
    return out({split:true,tables:tables.slice(0,M.maxTables),skipped,truncated:total>M.maxTables,total})
  };
  if(opts.htmlTables&&opts.htmlTables.length){
    const good=[];
    opts.htmlTables.forEach((t,i)=>{if(t&&!t.nested&&t.rows&&t.rows.length>=3&&t.rows[0].length>=2)good.push({t,i})});
    if(good.length>=2){
      good.sort((a,b)=>(a.t.docIndex==null?a.i:a.t.docIndex)-(b.t.docIndex==null?b.i:b.t.docIndex));
      return finish(good.map((g,k)=>({source:'html',htmlIndex:g.i,title:W.trunc(g.t.caption||('Table '+(k+1)),40)})),0)
    }
    return out({reason:'html'})
  }
  text=W.normalizeInput(text||'');
  if(!NB.test(text))return out({reason:'empty'});
  if(text.length>M.maxBytes)return out({reason:'large'});
  const lines=text.split('\n'),blocks=W.tableBlocks(lines);
  if(blocks.length>M.maxBlocks)return out({reason:'blocks'});
  const parts=blocks.flatMap(b=>W.splitRegion(lines,b));
  if(parts.length<2)return out({reason:'single'});
  let whole=null;
  try{whole=W.detectReadings(text).readings[0]}catch(e){whole=null}
  if(whole&&whole.confidence>=0.8&&!W.TABLE_KINDS.has(whole.kind))return out({reason:'kind:'+whole.kind});
  const merged=W.mergePieces(lines,parts.map(p=>W.classifyPiece(lines,p)));
  if(merged.tables.length<2)return out({reason:'merged'});
  return finish(merged.tables.map((t,k)=>({source:'text',from:t.from,to:t.to,kind:t.kind,params:t.params,title:W.trunc(t.title||('Table '+(k+1)),40)})),merged.skipped)
};
})(typeof self!=='undefined'?self:globalThis);
