(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const E=W.Engine;
  const WORDS=['paid','Paid','PENDING','late','card','cash','new york','New York','York, New','ref 12','REF 7','test','İstanbul','istanbul','ΟΔΟΣ','οδος','Straße','strasse','ſtone','stone','a b','x','é','É','100','12.5','Kelvin K'];
  const TEXT_VOCAB=['paid','Paid','PAID','pending','Late','card payment','cash','New York','new york','York, New','REF 12','ref 7','test row','İstanbul','istanbul','ISTANBUL','ΟΔΟΣ','οδος','οδοσ','Straße','STRASSE','ſtone','stone','é','É','  padded  ','a b','x','Kelvin K','','',''];
  const NAMES=['Status','Amount','Date','Region','Order ID','Notes'];
  const REGEXES=['^ref \\d+$','a.c','^new','o+','\\d{2}','^$','st'];
  const rngOf=seed=>W.mulberry32(seed>>>0);
  const pick=(r,a)=>a[(r()*a.length)|0];
  const pad=(n,w)=>String(n).padStart(w,'0');
  function genTable(r){
    const nc=1+((r()*6)|0);
    const names=NAMES.slice().sort(()=>r()-0.5).slice(0,nc);
    const kinds=names.map(()=>pick(r,['text','text','number','date','blank','unicode']));
    const nr=r()<0.08?0:((r()*300)|0);
    const rows=[];
    for(let i=0;i<nr;i++){
      rows.push(kinds.map(k=>{
        if(k==='text')return pick(r,TEXT_VOCAB);
        if(k==='unicode')return pick(r,['İstanbul','ISTANBUL','ΟΔΟΣ','οδος','Straße','ſtone','é','É','','plain']);
        if(k==='blank')return r()<0.9?'':pick(r,['x','paid']);
        if(k==='number'){const u=r();if(u<0.12)return'';if(u<0.18)return'n/a';const v=Math.round((r()-0.3)*4000*100)/100;if(u<0.4)return String(Math.round(v));const s=Math.abs(v).toFixed(2);const parts=s.split('.');const g=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');return(v<0?'-':'')+g+'.'+parts[1]}
        const u=r();if(u<0.1)return'';if(u<0.15)return'TBD';return(2024+((r()*3)|0))+'-'+pad(1+((r()*12)|0),2)+'-'+pad(1+((r()*28)|0),2)
      }))
    }
    rows.forEach(row=>{if(row.every(c=>c===''))row[0]='x'});
    return{names,kinds,rows}
  }
  function genQuery(r,tb,depth){
    const ci=(r()*tb.names.length)|0;const col=tb.names[ci],kind=tb.kinds[ci];
    const u=r();
    if(depth<3&&u<0.35){
      const n=2+((r()*2)|0);const kids=[];for(let i=0;i<n;i++)kids.push(genQuery(r,tb,depth+1));
      return{t:r()<0.5?'and':'or',kids}
    }
    if(depth<3&&u<0.5)return{t:'not',kid:genQuery(r,tb,depth+1)};
    const a=r();
    if(a<0.22)return{t:'free',v:pick(r,WORDS)};
    if(a<0.27)return{t:'rx',col:null,src:pick(r,REGEXES),ci:r()<0.5};
    const fromRows=()=>{const f=kind==='date'?dateOf:numOf;const vals=tb.rows.map(x=>x[ci]).filter(x=>!/\s/.test(x)&&!Number.isNaN(f(x)));return vals.length?pick(r,vals):null};
    if(kind==='number'){
      const b=r();
      const val=(r()<0.5&&fromRows())||pick(r,['0','100','-50','1000','12.5','2500']);
      if(b<0.5)return{t:'cmp',col,op:pick(r,['>','>=','<','<=','=','!=']),v:val,kind};
      if(b<0.75){const v2=pick(r,['50','500','3000']);return{t:'between',col,a:val,b:v2,kind}}
      return{t:'empty',col,neg:r()<0.5}
    }
    if(kind==='date'){
      const b=r();
      const d=()=>(r()<0.5&&fromRows())||(2024+((r()*3)|0))+'-'+pad(1+((r()*12)|0),2)+'-'+pad(1+((r()*28)|0),2);
      if(b<0.5)return{t:'cmp',col,op:pick(r,['>','>=','<','<=','=','!=']),v:d(),kind};
      if(b<0.75)return{t:'between',col,a:d(),b:d(),kind};
      return{t:'empty',col,neg:r()<0.5}
    }
    const b=r();
    if(b<0.3)return{t:'has',col,v:pick(r,WORDS)};
    if(b<0.45)return{t:'eq',col,v:pick(r,WORDS),neg:r()<0.4};
    if(b<0.6)return{t:'in',col,vs:[pick(r,WORDS),pick(r,WORDS)]};
    if(b<0.72)return{t:'empty',col,neg:r()<0.5};
    if(b<0.85)return{t:'rx',col,src:pick(r,REGEXES),ci:r()<0.5};
    return{t:'has',col,v:pick(r,WORDS)}
  }
  const needsQuote=v=>/[\s()"|:<>=!\/\[\]]/.test(v)||v===''||/^[-]/.test(v)||/^(OR|AND|NOT)$/.test(v)||v.indexOf('..')!==-1;
  const qv=v=>needsQuote(v)?'"'+v+'"':v;
  const colRef=c=>/[\s:<>=!()"\[\]]/.test(c)?'['+c+']':c;
  function render(n,top){
    switch(n.t){
      case'free':return qv(n.v);
      case'has':return colRef(n.col)+':'+qv(n.v);
      case'eq':return colRef(n.col)+':'+(n.neg?'!=':'=')+qv(n.v);
      case'in':return colRef(n.col)+':('+n.vs.map(x=>x.indexOf('|')!==-1||x.indexOf(')')!==-1||x.indexOf('"')!==-1?'"'+x+'"':x).join('|')+')';
      case'empty':return colRef(n.col)+':'+(n.neg?'!=':'=')+'""';
      case'rx':return(n.col?colRef(n.col)+':':'')+'/'+n.src+'/'+(n.ci?'i':'');
      case'cmp':return colRef(n.col)+n.op+n.v;
      case'between':return colRef(n.col)+':'+n.a+'..'+n.b;
      case'not':{const inner=n.kid;const s=render(inner,false);if(inner.t==='and'||inner.t==='or')return'NOT ('+s+')';return'-'+s}
      case'and':return n.kids.map(k=>k.t==='or'?'('+render(k,false)+')':render(k,false)).join(' ');
      case'or':return n.kids.map(k=>render(k,false)).join(' OR ')
    }
  }
  const fold=s=>String(s).replace(/İ/g,'i').toLowerCase().replace(/ς/g,'σ').replace(/ſ/g,'s');
  function numOf(s){const t=String(s).trim();if(!t)return NaN;const p=W.parseNumber(t,{locale:'us'});return p?p.value:NaN}
  function dateOf(s){const t=String(s).trim();if(!t)return NaN;const d=W.parseDate(t,{order:'mdy'});return d?d.y*10000+d.mo*100+d.d:NaN}
  function evalRef(n,row,tb){
    const cell=name=>row[tb.names.indexOf(name)];
    switch(n.t){
      case'free':return row.some(c=>fold(c).indexOf(fold(n.v))!==-1);
      case'has':return fold(cell(n.col)).indexOf(fold(n.v))!==-1;
      case'eq':{const h=fold(String(cell(n.col)).trim())===fold(String(n.v).trim());return n.neg?!h:h}
      case'in':return n.vs.some(v=>fold(String(cell(n.col)).trim())===fold(String(v).trim()));
      case'empty':{const e=String(cell(n.col)).trim()==='';return n.neg?!e:e}
      case'rx':{const re=new RegExp(n.src,n.ci?'i':'');return n.col?re.test(cell(n.col)):row.some(c=>re.test(c))}
      case'cmp':{
        const f=n.kind==='date'?dateOf:numOf;const k=f(cell(n.col)),a=f(n.v);
        if(Number.isNaN(k))return n.op==='!=';
        return n.op==='>'?k>a:n.op==='>='?k>=a:n.op==='<'?k<a:n.op==='<='?k<=a:n.op==='='?k===a:k!==a
      }
      case'between':{
        const f=n.kind==='date'?dateOf:numOf;const k=f(cell(n.col));if(Number.isNaN(k))return false;
        const a=f(n.a),b=f(n.b);return k>=Math.min(a,b)&&k<=Math.max(a,b)
      }
      case'not':return!evalRef(n.kid,row,tb);
      case'and':return n.kids.every(k=>evalRef(k,row,tb));
      case'or':return n.kids.some(k=>evalRef(k,row,tb))
    }
  }
  const csv=tb=>{const q=v=>'"'+String(v).replace(/"/g,'""')+'"';return[tb.names.map(q).join(',')].concat(tb.rows.map(r=>r.map(q).join(','))).join('\n')};
  const idsOf=(v)=>E.handle('getRows',{viewKey:v.key,start:0,count:Math.max(1,v.n)}).rowIds.slice(0,v.n);
  function runCase(seed,iter){
    const r=rngOf((seed^Math.imul(iter+1,0x9E3779B1))>>>0);
    const tb=genTable(r);
    const ast=genQuery(r,tb,0);
    const text=render(ast,true);
    const info='seed '+seed+' iter '+iter+' query '+JSON.stringify(text)+' cols '+JSON.stringify(tb.names)+' kinds '+tb.kinds.join(',')+' rows '+JSON.stringify(tb.rows.slice(0,12));
    E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy',today:null});
    E.handle('load',{text:csv(tb),hint:{kind:'delimited',params:{delimiter:',',quote:'"',header:true},force:true}});
    const t=W.E.states[W.E.states.length-1];
    if(t.n!==tb.rows.length||t.cols.join('|')!==tb.names.join('|'))throw new Error('load mismatch '+t.n+' vs '+tb.rows.length+' ['+t.cols.join('|')+'] '+info);
    const expect=[];for(let i=0;i<tb.rows.length;i++)if(evalRef(ast,tb.rows[i],tb))expect.push(t.rowIds[i]);
    const v1=E.handle('setView',{search:text,sort:[],filter:null,rowIds:null});
    if(v1.query.errors.some(e=>e.level==='error'))throw new Error('unexpected query error '+JSON.stringify(v1.query.errors)+' '+info);
    const scan=idsOf(v1);
    const v2=E.handle('setView',{search:text,sort:[],filter:null,rowIds:null});
    const second=idsOf(v2);
    const parsed=W.Q.parse(text,t.cols);
    const cfg=W.cfgFromTree('keep',parsed.tree||{op:'and',children:[]});
    const stepText=W.stepsToText([{opId:'filterRows',cfg,muted:false}],null);
    const back=W.textToSteps(stepText);
    if(back.errors.length)throw new Error('step text did not parse: '+JSON.stringify(back.errors)+' '+stepText+' '+info);
    const stepCfg=parsed.tree?back.steps[0].cfg:null;
    let viaStep=[];
    if(parsed.tree){const res=W.OPS.filterRows.apply(t,stepCfg,{nextRowId:t.n});viaStep=res.table.rowIds.slice()}else viaStep=t.rowIds.slice();
    const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
    if(!same(scan,expect))throw new Error('scan differs from reference: got '+scan.length+' want '+expect.length+' '+info);
    if(!same(second,expect))throw new Error('second search differs from reference: got '+second.length+' want '+expect.length+' '+info);
    if(!same(viaStep,expect))throw new Error('step differs from reference: got '+viaStep.length+' want '+expect.length+' '+stepText+' '+info);
    return expect.length
  }
  const ITER=500;
  [0xC0FFEE,0xBADC0DE,0x5EED5].forEach(seed=>{
    test('parity fuzz '+ITER+' iterations seed 0x'+seed.toString(16),()=>{
      let nonEmpty=0;
      for(let i=0;i<ITER;i++)if(runCase(seed,i)>0)nonEmpty++;
      ok(nonEmpty>ITER*0.25,'too few non-empty results: '+nonEmpty)
    })
  })
})
})(typeof self!=='undefined'?self:globalThis);
