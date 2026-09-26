(function(G){
'use strict';
const W=G.WeftCore;
const TOTAL_RE=new RegExp(W.TOTAL_SRC,'i');
const ART_RE=new RegExp(W.JUNK_ARTIFACT_SRC,'i');
const s=v=>v==null?'':String(v);

W.posMap=function(t){
  if(!t._pos){const m=new Map();for(let r=0;r<t.n;r++)m.set(t.rowIds[r],r);t._pos=m}
  return t._pos
};
W.typesOf=function(t,ctx){if(!t._types)t._types=W.inferTypes(t,ctx);return t._types};

W.profile=function(t,col,ctx){
  const ci=t.cols.indexOf(col);
  if(ci===-1)return null;
  const type=W.typesOf(t,ctx)[ci];
  const c=t.data[ci];
  let empty=0,minL=Infinity,maxL=0;const freq=new Map();
  let nMin=Infinity,nMax=-Infinity,sum=0,nn=0,dMin=Infinity,dMax=-Infinity,dn=0,notNum=0,notDate=0,ambiguous=0;
  const sm=[];for(let r=0;r<t.n&&sm.length<300;r++){const v=s(c[r]).trim();if(v)sm.push(v)}
  const loc=W.detectNumberLocale(sm);
  let wsIssues=0;
  for(let r=0;r<t.n;r++){
    const raw=s(c[r]);const v=raw.trim();
    if(!v){empty++;continue}
    if(raw!==v||/\s{2,}/.test(raw))wsIssues++;
    if(v.length<minL)minL=v.length;if(v.length>maxL)maxL=v.length;
    freq.set(v,(freq.get(v)||0)+1);
    if(type==='number'){const p=W.parseNumber(v,{locale:loc});if(p){nn++;sum+=p.value;if(p.value<nMin)nMin=p.value;if(p.value>nMax)nMax=p.value}else notNum++}
    else if(type==='date'){const d=W.parseDate(v,{order:ctx&&ctx.dateOrder,yearPivot:ctx&&ctx.yearPivot});if(d){dn++;const k=W.dateKey(d);if(k<dMin)dMin=k;if(k>dMax)dMax=k;if(W.isDateAmbiguous(v))ambiguous++}else notDate++}
  }
  const top=Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6).map(e=>({value:e[0],count:e[1]}));
  const k2d=k=>{if(!isFinite(k))return'';const y=Math.floor(k/10000),mo=Math.floor(k/100)%100,d=k%100;return W.fmtDateAs({y,mo,d},'iso')};
  return{col,type,n:t.n,empty,filled:t.n-empty,distinct:freq.size,top,minLen:isFinite(minL)?minL:0,maxLen:maxL,wsIssues,
    number:type==='number'?{min:nn?nMin:null,max:nn?nMax:null,mean:nn?sum/nn:null,sum:nn?sum:null,unparsed:notNum,locale:loc}:null,
    date:type==='date'?{min:k2d(dMin),max:k2d(dMax),unparsed:notDate,ambiguous}:null}
};

function findJunkTable(t){
  const res={title:[],headerRow:-1,totals:[],artifacts:[],repeated:[]};
  const n=t.n,w=t.cols.length;
  if(!n||w<1)return res;
  const ne=r=>{let k=0;for(let c=0;c<w;c++)if(s(t.data[c][r]).trim())k++;return k};
  const joined=r=>{const a=[];for(let c=0;c<w;c++){const v=s(t.data[c][r]).trim();if(v)a.push(v)}return a.join(' ')};
  for(let r=0;r<n&&res.artifacts.length<20000;r++){const j=joined(r);if(j&&j.length<40&&ART_RE.test(j))res.artifacts.push(r)}
  const art=new Set(res.artifacts);
  if(w>=2){
    const lim=Math.min(n,2000);const counts=[];for(let r=0;r<lim;r++)counts.push(ne(r));
    const md=W.modal(counts.filter(x=>x>0));
    for(let r=0;r<Math.min(10,n-1);r++){if(art.has(r))continue;const c=counts[r];if(c<=1||c<md.value/2)res.title.push(r);else break}
    if(res.title.length&&res.title.length>=n-1)res.title=[];
    const h=res.title.length;
    if(W.isGenericCols(t.cols)&&h<n-1){
      const cand=t.cols.map((_,c)=>s(t.data[c][h]).trim());
      const body=[];for(let r=h+1;r<Math.min(n,h+200);r++)body.push(t.cols.map((_,c)=>s(t.data[c][r])));
      if(cand.filter(Boolean).length>=Math.max(2,md.value-1)&&W.detectHeader([cand].concat(body)))res.headerRow=h
    }
  }
  let r=n-1,g=0;
  while(r>=0&&g<8){g++;if(art.has(r)||ne(r)===0){r--;continue}let first='';for(let c=0;c<w;c++){const v=s(t.data[c][r]).trim();if(v){first=v;break}}if(TOTAL_RE.test(first)){res.totals.unshift(r);r--;continue}break}
  let hdr=null;
  if(res.headerRow>=0)hdr=t.cols.map((_,c)=>s(t.data[c][res.headerRow]).trim().toLowerCase());
  else if(!W.isGenericCols(t.cols))hdr=t.cols.map(c=>String(c).trim().toLowerCase());
  if(hdr&&w>=2){
    const key=hdr.join('\u0001');
    for(let q=0;q<n&&res.repeated.length<20000;q++){if(q===res.headerRow)continue;let k='';for(let c=0;c<w;c++){if(c)k+='\u0001';k+=s(t.data[c][q]).trim().toLowerCase()}if(k===key)res.repeated.push(q)}
  }
  return res
}
W.findJunkTable=findJunkTable;

function looksStructured(vals){
  const ne=vals.filter(v=>v&&v.trim());
  if(ne.length<3)return null;
  const share=f=>ne.filter(f).length/ne.length;
  if(share(v=>{const x=v.trim();if(x[0]!=='{'&&x[0]!=='[')return false;try{const o=JSON.parse(x);return o&&typeof o==='object'}catch(e){return false}})>=0.6)return{kind:'json',params:{},label:'JSON'};
  let pc=0;for(const v of ne){let k=0;const re=/(^|\s)[A-Za-z_][\w.-]*=("[^"]*"|\S+)/g;while(re.exec(v))k++;if(k>=2)pc++}
  if(pc/ne.length>=0.6)return{kind:'logfmt',params:{},label:'key=value pairs'};
  if(share(v=>(v.match(/(^|[;|,]\s*)[A-Za-z][\w .-]{0,30}:\s*\S/g)||[]).length>=2)>=0.6)return{kind:'key-value',params:{sep:':'},label:'key: value pairs'};
  const fw=W.fixedWidthCuts(ne.slice(0,2000));
  if(fw&&fw.cuts.length>=2&&fw.strength>0.6&&ne.length>=5)return{kind:'fixed-width',params:{cuts:fw.cuts},label:'fixed-width columns'};
  const counts=ne.map(v=>v.trim().split(/\t| {2,}/).length);const md=W.modal(counts);
  if(md.value>=2&&md.share>=0.8)return{kind:'whitespace-runs',params:{},label:'columns separated by spaces'};
  for(const d of[' | ','|',';','\t']){const c=ne.map(v=>v.split(d).length);const m=W.modal(c);if(m.value>=3&&m.share>=0.8)return{kind:'delimited',params:{delimiter:d.trim()||d},label:'values separated by "'+(d.trim()||'tab')+'"'}}
  return null
}

W.issues=function(t,ctx){
  ctx=ctx||{};
  const out=[];const n=t.n,w=t.cols.length;
  if(!n||!w)return out;
  const types=W.typesOf(t,ctx);
  const push=o=>{o.id=o.id||(o.kind+':'+(o.column||''));out.push(o)};
  const junk=findJunkTable(t);
  const idsAt=list=>list.map(p=>t.rowIds[p]);
  if(junk.headerRow>=0){
    push({kind:'header',severity:'high',title:'Row '+(junk.headerRow+1)+' looks like the real header',detail:(junk.headerRow?'The '+W.plural(junk.headerRow,'row')+' above it look like a title. ':'')+'The columns are currently named '+W.trunc(t.cols.slice(0,3).join(', '),40)+'.',count:junk.headerRow+1,showRows:{rowIds:idsAt(W.identity(junk.headerRow+1))},fix:{opId:'promoteHeader',cfg:{rowIndex:junk.headerRow}}})
  }else if(junk.title.length){
    push({kind:'title',severity:'high',title:W.plural(junk.title.length,'title row')+' at the top',detail:'The first '+W.plural(junk.title.length,'row')+' have text in only one cell, like a report title.',count:junk.title.length,showRows:{rowIds:idsAt(junk.title)},fix:{opId:'skipRows',cfg:{top:junk.title[junk.title.length-1]+1,bottom:0}}})
  }
  if(junk.totals.length){
    const p=junk.totals[0];let col='*';for(let c=0;c<w;c++)if(TOTAL_RE.test(s(t.data[c][p]).trim())){col=t.cols[c];break}
    push({kind:'totals',severity:'high',title:junk.totals.length>1?W.plural(junk.totals.length,'totals row')+' at the bottom':'Totals row at the bottom',detail:'A row starting with "'+W.trunc(s(t.data[t.cols.indexOf(col)>=0?t.cols.indexOf(col):0][p]).trim(),24)+'" would be counted as data.',count:junk.totals.length,showRows:{rowIds:idsAt(junk.totals)},fix:{opId:'filterRows',cfg:{mode:'remove',match:'all',conditions:[{col,op:'matches',value:W.TOTAL_SRC,caseSensitive:false}]}}})
  }
  if(junk.repeated.length&&junk.headerRow<0){
    push({kind:'repeatedHeader',severity:'high',title:W.plural(junk.repeated.length,'repeated header row'),detail:'These rows repeat the column names, which usually happens at page breaks.',count:junk.repeated.length,showRows:{rowIds:idsAt(junk.repeated.slice(0,5000))},fix:{opId:'removeRepeatedHeaders',cfg:{}}})
  }
  if(junk.artifacts.length){
    push({kind:'artifacts',severity:'medium',title:W.plural(junk.artifacts.length,'page artifact row'),detail:'Rows like "Page 2 of 5" or lines of dashes.',count:junk.artifacts.length,showRows:{rowIds:idsAt(junk.artifacts.slice(0,5000))},fix:{opId:'filterRows',cfg:{mode:'remove',match:'any',conditions:[{col:'*',op:'matches',value:W.JUNK_ARTIFACT_SRC,caseSensitive:false}]}}})
  }
  let emptyRows=0;
  for(let r=0;r<n;r++){let e=true;for(let c=0;c<w;c++)if(s(t.data[c][r]).trim()){e=false;break}if(e)emptyRows++}
  if(emptyRows)push({kind:'emptyRows',severity:'medium',title:W.plural(emptyRows,'empty row'),detail:'Rows with nothing in any column.',count:emptyRows,showRows:{filter:{match:'all',conditions:[{col:'*',op:'isEmpty'}]}},fix:{opId:'dropEmptyRows',cfg:{columns:['*']}}});
  const emptyCols=[];
  for(let c=0;c<w;c++){let e=true;for(let r=0;r<n;r++)if(s(t.data[c][r]).trim()){e=false;break}if(e)emptyCols.push(t.cols[c])}
  if(emptyCols.length&&emptyCols.length<w)push({kind:'emptyCols',severity:'low',title:W.plural(emptyCols.length,'empty column'),detail:W.trunc(emptyCols.map(c=>'"'+c+'"').join(', '),80)+' '+(emptyCols.length===1?'has':'have')+' no values.',count:emptyCols.length,showRows:null,fix:{opId:'dropEmptyCols',cfg:{}}});
  if(n<=300000){
    const seen=new Map();let dups=0;const dupIds=[];
    for(let r=0;r<n;r++){let k='';for(let c=0;c<w;c++){k+=s(t.data[c][r]);k+='\u0001'}if(k.length===w)continue;if(seen.has(k)){dups++;if(dupIds.length<5000)dupIds.push(t.rowIds[r])}else seen.set(k,1)}
    if(dups)push({kind:'duplicates',severity:'medium',title:W.plural(dups,'exact duplicate row'),detail:'These rows are identical to an earlier row in every column.',count:dups,showRows:{rowIds:dupIds},fix:{opId:'dedupe',cfg:{on:['*'],ignoreCase:false,keep:'first'}}})
  }
  const wsCols=[];let wsCells=0;
  let inv=0;const invCols=new Set();
  const lim=Math.min(n,50000);
  for(let c=0;c<w;c++){
    let k=0;const col=t.data[c];
    for(let r=0;r<lim;r++){const v=s(col[r]);if(!v)continue;const cc0=v.charCodeAt(0),cc1=v.charCodeAt(v.length-1);if(cc0===32||cc0===9||cc1===32||cc1===9||v.indexOf('  ')!==-1)k++;if(/[\u00A0\u200B-\u200D\u2060\uFEFF\u2018\u2019\u201C\u201D\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v)){inv++;invCols.add(t.cols[c])}}
    if(k){wsCols.push(t.cols[c]);wsCells+=k}
  }
  if(wsCols.length)push({kind:'whitespace',severity:wsCells>n*0.05?'medium':'low',title:'Extra spaces in '+(wsCols.length===1?'"'+wsCols[0]+'"':W.plural(wsCols.length,'column')),detail:W.plural(wsCells,'cell')+' have spaces at the start or end, or doubled spaces'+(wsCols.length>1?': '+W.trunc(wsCols.map(c=>'"'+c+'"').join(', '),70):'')+'.',count:wsCells,column:wsCols.length===1?wsCols[0]:null,showRows:{filter:{match:'any',conditions:wsCols.slice(0,8).map(c=>({col:c,op:'matches',value:'^\\s|\\s$|\\s\\s'}))}},fix:{opId:'trim',cfg:{columns:wsCols.length===w?['*']:wsCols,collapse:true}}});
  if(inv)push({kind:'invisible',severity:'medium',title:'Invisible or curly characters',detail:W.plural(inv,'cell')+' contain non-breaking spaces, zero-width characters or curly quotes. They break matching and lookups.',count:inv,showRows:{filter:{match:'any',conditions:Array.from(invCols).slice(0,8).map(c=>({col:c,op:'matches',value:'[\\u00A0\\u200B-\\u200D\\u2060\\uFEFF\\u2018\\u2019\\u201C\\u201D]'}))}},fix:{opId:'cleanText',cfg:{columns:['*'],nbsp:true,zeroWidth:true,smartQuotes:true,nfc:true,controlChars:true}}});
  for(let c=0;c<w;c++){
    const name=t.cols[c],col=t.data[c],type=types[c];
    const vals=[];for(let r=0;r<Math.min(n,4000);r++)vals.push(s(col[r]));
    const ne=vals.filter(v=>v.trim());
    if(!ne.length)continue;
    if(type==='number'){
      const fmt=ne.filter(v=>/[$€£¥₹%,()]|\s/.test(v.trim())||/^[+]/.test(v.trim())).length;
      const loc=W.detectNumberLocale(ne);
      const bad=ne.filter(v=>!W.parseNumber(v,{locale:loc})).length;
      if(fmt)push({kind:'numText',severity:fmt>ne.length*0.2?'medium':'low',title:'Numbers stored as text in "'+name+'"',detail:W.plural(fmt,'value')+' include currency signs, thousands separators or brackets'+(loc==='eu'?' (European style)':'')+'. Spreadsheets may not add them up.',count:fmt,column:name,showRows:{filter:{match:'all',conditions:[{col:name,op:'matches',value:'[$€£¥₹%,()]|^\\s|\\s$'}]}},fix:{opId:'convertType',cfg:{column:name,to:'number',locale:loc,percentAsFraction:false}}});
      if(bad)push({kind:'notNum',severity:'low',title:W.plural(bad,'value')+' in "'+name+'" are not numbers',detail:'Examples: '+ne.filter(v=>!W.parseNumber(v,{locale:loc})).slice(0,3).map(v=>'"'+W.trunc(v,16)+'"').join(', ')+'.',count:bad,column:name,showRows:null,fix:null})
    }else if(type==='date'){
      const shapes=new Map();
      for(const v of ne){const sh=v.trim().replace(/[A-Za-z]{3,9}/g,'M').replace(/\d+/g,m=>'9'.repeat(Math.min(m.length,4)));shapes.set(sh,(shapes.get(sh)||0)+1)}
      const amb=ne.filter(W.isDateAmbiguous).length;
      if(shapes.size>1){const nonIso=ne.filter(v=>!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())).length;push({kind:'mixedDates',severity:'medium',title:'Mixed date formats in "'+name+'"',detail:shapes.size+' different formats, such as '+Array.from(shapes.keys()).slice(0,3).map(x=>'"'+ne.find(v=>v.trim().replace(/[A-Za-z]{3,9}/g,'M').replace(/\d+/g,m=>'9'.repeat(Math.min(m.length,4)))===x)+'"').join(', ')+'.',count:nonIso,column:name,showRows:{filter:{match:'all',conditions:[{col:name,op:'isNotEmpty'},{col:name,op:'matches',value:'^(?!\\d{4}-\\d{2}-\\d{2}$)'}]}},fix:{opId:'dateNormalize',cfg:{column:name,format:'iso'}}})}
      if(amb)push({kind:'ambiguousDates',severity:'low',title:'Ambiguous dates in "'+name+'"',detail:W.plural(amb,'date')+' like 3/4/2025 could be March 4 or April 3. They are read as '+((ctx.dateOrder||'mdy')==='dmy'?'day/month':'month/day')+'. Change this under View ▸ Date order.',count:amb,column:name,showRows:{filter:{match:'all',conditions:[{col:name,op:'matches',value:'^(0?[1-9]|1[0-2])[-/.](0?[1-9]|1[0-2])[-/.]\\d{2,4}$'}]}},fix:null})
    }else{
      const groups=new Map();
      for(const v of ne){const k=v.trim().replace(/\s+/g,' ').toLowerCase();if(!groups.has(k))groups.set(k,new Map());const g=groups.get(k);const tv=v.trim().replace(/\s+/g,' ');g.set(tv,(g.get(tv)||0)+1);if(groups.size>200)break}
      if(groups.size<=60&&groups.size<ne.length/2){
        let variants=0,rows=0;const allVar=new Map();
        groups.forEach(g=>{if(g.size>1){variants++;g.forEach((cnt,val)=>{allVar.set(val,cnt)});let tot=0;g.forEach(x=>tot+=x);rows+=tot-Math.max.apply(null,Array.from(g.values()))}});
        if(variants){
          let low=0,up=0,tit=0;allVar.forEach((cnt,v)=>{if(v===v.toLowerCase())low+=cnt;else if(v===v.toUpperCase())up+=cnt;else tit+=cnt});
          const mode=low>=up&&low>=tit?'lower':up>=tit?'upper':'title';
          push({kind:'caseVariants',severity:'medium',title:'Same values with different capitals in "'+name+'"',detail:'For example '+Array.from(allVar.keys()).slice(0,3).map(v=>'"'+v+'"').join(', ')+'. They would be counted as different values.',count:rows,column:name,showRows:null,fix:{opId:'case',cfg:{columns:[name],mode}}})
        }
      }
      const st=looksStructured(ne.slice(0,2000));
      if(st&&!(st.kind==='whitespace-runs'&&w>3))push({kind:'structured',severity:w===1?'high':'medium',title:'"'+name+'" contains '+st.label,detail:'Split it into separate columns so each piece can be filtered and sorted.',count:ne.length,column:name,showRows:null,fix:{opId:'structureColumn',cfg:{column:name,kind:st.kind,params:st.params,into:[],keepOriginal:false}}})
    }
  }
  const sev={high:0,medium:1,low:2};
  out.sort((a,b)=>sev[a.severity]-sev[b.severity]||(b.count||0)-(a.count||0));
  return out
};

W.likeThese=function(t,rowIds,ctx){
  const pm=W.posMap(t);
  const sel=[];for(const id of rowIds){const p=pm.get(id);if(p!==undefined)sel.push(p)}
  if(!sel.length)return[];
  const selSet=new Set(sel);
  const cands=[];
  const types=W.typesOf(t,ctx);
  for(let c=0;c<t.cols.length;c++){
    const col=t.data[c],name=t.cols[c];
    const vs=sel.map(p=>s(col[p]).trim());
    if(vs.every(v=>v===''))cands.push({col:name,op:'isEmpty'});
    else if(vs.every(v=>v!=='')){
      const low=vs.map(v=>v.toLowerCase());
      if(low.every(v=>v===low[0]))cands.push({col:name,op:'equals',value:vs[0]});
      let pre=low[0];for(const v of low){let i=0;while(i<pre.length&&i<v.length&&pre[i]===v[i])i++;pre=pre.slice(0,i)}
      if(pre.trim().length>=3&&!low.every(v=>v===pre))cands.push({col:name,op:'startsWith',value:vs[0].slice(0,pre.length)});
      if(low.every(v=>v.indexOf('total')!==-1))cands.push({col:name,op:'contains',value:'total'});
      if(low.every(v=>v.indexOf('test')!==-1))cands.push({col:name,op:'contains',value:'test'});
      if(vs.every(v=>/[A-Z]/.test(v)&&v===v.toUpperCase()))cands.push({col:name,op:'matches',value:'^[^a-z]*[A-Z][^a-z]*$',caseSensitive:true});
      if(types[c]==='number'){
        const loc=W.detectNumberLocale(vs);const nums=vs.map(v=>{const p=W.parseNumber(v,{locale:loc});return p?p.value:null});
        if(nums.every(x=>x!=null)){const mn=Math.min.apply(null,nums),mx=Math.max.apply(null,nums);cands.push({col:name,op:'gte',value:W.canonicalNumber(mn)});cands.push({col:name,op:'lte',value:W.canonicalNumber(mx)})}
      }else if(vs.every(v=>/^[\d\s.,$€£()%+-]+$/.test(v))&&types[c]!=='date')cands.push({col:name,op:'matches',value:'^[\\d\\s.,$€£()%+-]+$'});
      if(types[c]==='date'){
        const ks=vs.map(v=>W.dateKey(W.parseDate(v,{order:ctx&&ctx.dateOrder})));
        if(ks.every(k=>!isNaN(k))){const mn=Math.min.apply(null,ks),mx=Math.max.apply(null,ks);const f=k=>W.fmtDateAs({y:Math.floor(k/10000),mo:Math.floor(k/100)%100,d:k%100},'iso');cands.push({col:name,op:'lte',value:f(mx)});cands.push({col:name,op:'gte',value:f(mn)})}
      }
      const notTypical=types[c]!=='text'&&vs.every(v=>types[c]==='number'?!W.parseNumber(v):!W.parseDate(v));
      if(notTypical)cands.push({col:name,op:'matches',value:types[c]==='number'?'[^\\d\\s.,$€£()%+-]':'^(?!\\d)',caseSensitive:false});
    }
  }
  const evalCond=c=>{
    let tester;try{tester=W.rowTester(t,{match:'all',conditions:[Object.assign({caseSensitive:false},c)]},ctx)}catch(e){return null}
    let ms=0,mo=0;for(let r=0;r<t.n;r++){if(tester(r)){if(selSet.has(r))ms++;else mo++}}
    return{ms,mo}
  };
  const scored=[];
  for(const c of cands){const e=evalCond(c);if(e&&e.ms===sel.length)scored.push({conds:[c],ms:e.ms,mo:e.mo})}
  scored.sort((a,b)=>a.mo-b.mo);
  if(scored.length>=2&&scored[0].mo>0){
    const top=scored.slice(0,5);
    for(let i=0;i<top.length;i++)for(let j=i+1;j<top.length;j++){
      if(top[i].conds[0].col===top[j].conds[0].col&&top[i].conds[0].op===top[j].conds[0].op)continue;
      const conds=[top[i].conds[0],top[j].conds[0]];
      let tester;try{tester=W.rowTester(t,{match:'all',conditions:conds.map(c=>Object.assign({caseSensitive:false},c))},ctx)}catch(e){continue}
      let ms=0,mo=0;for(let r=0;r<t.n;r++)if(tester(r)){if(selSet.has(r))ms++;else mo++}
      if(ms===sel.length&&mo<top[i].mo)scored.push({conds,ms,mo})
    }
    scored.sort((a,b)=>a.mo-b.mo||a.conds.length-b.conds.length)
  }
  const seen=new Set();const out=[];
  for(const x of scored){
    const cfg={mode:'remove',match:'all',conditions:x.conds.map(c=>Object.assign({caseSensitive:false},c))};
    const key=JSON.stringify(cfg.conditions);if(seen.has(key))continue;seen.add(key);
    out.push({cfg,matchesSelected:x.ms,matchesOthers:x.mo,label:cfg.conditions.map(W.describeCond).join(' and ')});
    if(out.length>=3)break
  }
  return out
};

W.lineage=function(states,steps,rowId,col,upto){
  const out=[];let name=col;
  const top=Math.min(upto,states.length-1);
  const names=[col];
  for(let i=top;i>0;i--){
    const st=steps[i-1];
    if(!st.muted&&st.opId==='rename'&&st.cfg.to===name)name=st.cfg.from;
    names[top-i+1]=name
  }
  names.reverse();
  let prev=null;
  for(let i=0;i<=top;i++){
    const t=states[i];const p=W.posMap(t).get(rowId);const ci=t.cols.indexOf(names[i]);
    const v=p===undefined?null:(ci===-1?undefined:s(t.data[ci][p]));
    if(i===0)out.push({idx:0,label:'Original',value:v,col:names[i]});
    else if(v!==prev){const st=steps[i-1];out.push({idx:i,label:W.describeStep(st),value:v,col:names[i],removed:v===null})}
    prev=v;if(v===null)break
  }
  return out
};
})(typeof self!=='undefined'?self:globalThis);
