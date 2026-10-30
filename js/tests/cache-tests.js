(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const CUR=/[$€£¥₹₩₽₺₴₦₪﷼]/g;
  function refParse(raw,opts){
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
    s=s.replace(/[\s  ']/g,'');
    if(!s)return null;
    if(locale==='eu'){
      if(/^0\d*\./.test(s))return null;
      if(!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(s))return null;
      s=s.replace(/\./g,'').replace(',','.')
    }else{
      if(!/^\d{1,3}(,\d{3})*(\.\d+)?$|^\d*\.?\d+$|^\d+\.$/.test(s)&&!/^\d+(\.\d+)?[eE][+-]?\d+$/.test(s))return null;
      s=s.replace(/,/g,'')
    }
    const num=Number(s);
    if(!isFinite(num))return null;
    return{value:(neg?-Math.abs(num):num)*(pct&&opts.percentAsFraction!==false?0.01:1),isPercent:pct,negative:neg}
  }

  const E=W.Engine;
  const load=text=>{E.handle('tableReset',{id:'t1'});E.handle('setCtx',{today:null,dateOrder:'mdy'});return E.handle('load',{text})};
  test('a repeated view gives the same positions and a changed query gives different ones',()=>{
    load('a,b\nx,1\ny,2\nx,3');
    const k1=E.handle('setView',{search:'a:x'});const k2=E.handle('setView',{search:'a:x'});const k3=E.handle('setView',{search:'a:y'});
    eq([k1.n,k2.n,k3.n],[2,2,1]);
    eq(E.handle('getRows',{viewKey:k2.viewKey,start:0,count:10}).rows.map(r=>r.cells?r.cells[1]:r[1]),E.handle('getRows',{viewKey:k1.viewKey,start:0,count:10}).rows.map(r=>r.cells?r.cells[1]:r[1]))
  });
  test('the filter cache is keyed by the date context so a new today gives new rows',()=>{
    load('d,z\n2026-03-05,1\n2026-04-05,1\n2026-04-20,1');
    const cf={d:{col:'d',op:'relDate',rel:'thisMonth',caseSensitive:false}};
    E.handle('setCtx',{today:'2026-03-15'});const a=E.handle('setView',{colFilters:cf}).n;
    E.handle('setCtx',{today:'2026-04-15'});const b=E.handle('setView',{colFilters:cf}).n;
    eq([a,b],[1,2])
  });
  test('changing the date order invalidates cached comparisons',()=>{
    load('d,z\n03/04/2026,1\n13/04/2026,1');
    const cf={d:{col:'d',op:'gt',value:'2026-03-31',caseSensitive:false}};
    E.handle('setCtx',{dateOrder:'mdy'});const a=E.handle('setView',{colFilters:cf}).n;
    E.handle('setCtx',{dateOrder:'dmy'});const b=E.handle('setView',{colFilters:cf}).n;
    eq([a,b],[1,2])
  });
  test('parseNumber fast path agrees with the reference on 60000 random money-like strings',()=>{
    const r=W.mulberry32(4242);
    const alpha=['0','1','2','3','7','9',',','.','$','-',' ','(',')','%','+','e','€',' ','0','00'];
    let bad=null;
    for(let i=0;i<60000&&!bad;i++){
      const n=1+((r()*14)|0);let s='';
      for(let k=0;k<n;k++)s+=alpha[(r()*alpha.length)|0];
      for(const loc of ['us','eu',undefined]){
        const a=W.parseNumber(s,loc?{locale:loc}:undefined),b=refParse(s,loc?{locale:loc}:undefined);
        if(JSON.stringify(a)!==JSON.stringify(b)||Object.is(a&&a.value,-0)!==Object.is(b&&b.value,-0)){bad=[s,loc,a,b];break}
      }
    }
    eq(bad,null)
  });
  test('parseNumber fast path agrees with the reference on structured amounts',()=>{
    const r=W.mulberry32(99);
    let bad=null;
    for(let i=0;i<40000&&!bad;i++){
      const whole=String((r()*5e6)|0);
      let g=whole;if(r()<0.6)g=whole.replace(/\B(?=(\d{3})+(?!\d))/g,',');
      if(r()<0.2)g=g.replace(',','');
      const s=(r()<0.2?'-':'')+(r()<0.6?'$':'')+(r()<0.4?' ':'')+g+(r()<0.8?'.'+String((r()*100)|0).padStart(2,'0'):'');
      const a=W.parseNumber(s),b=refParse(s);
      if(JSON.stringify(a)!==JSON.stringify(b)){bad=[s,a,b];break}
    }
    eq(bad,null)
  })
})
})(typeof self!=='undefined'?self:globalThis);
