(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const tbl=(cols,rows)=>W.tableFromRows(cols,rows);
  const CTX={nextRowId:1,dateOrder:'mdy'};
  const treeFor=(col,b)=>({op:'and',children:[{col,op:'gte',value:b.lo,caseSensitive:false},{col,op:b.last?'lte':'lt',value:b.hi,caseSensitive:false}]});
  const matches=(t,col,b)=>W.OPS.filterRows.apply(t,{mode:'keep',tree:treeFor(col,b)},CTX).table.n;
  const hist=(rows,ctx)=>{const t=tbl(['v'],rows.map(x=>[x]));return{t,h:W.histogram(t,'v',ctx||CTX)}};

  test('histogram: numbers from 1 to 100 fill 20 bins that add up to every row',()=>{
    const {h}=hist(Array.from({length:100},(_,i)=>String(i+1)));
    eq(h.type,'number');eq(h.bins.length,20);eq(h.bins.reduce((a,b)=>a+b.count,0),100);eq(h.total,100);eq(h.min,1);eq(h.max,100);
    ok(h.bins[19].last&&!h.bins[0].last);eq(h.bins[0].lo,'1');eq(h.bins[19].hi,'100')
  });
  test('histogram: bins are contiguous and the largest count is reported',()=>{
    const {h}=hist(['1','2','2','2','3','10']);
    for(let i=1;i<h.bins.length;i++)eq(h.bins[i].lo,h.bins[i-1].hi);
    eq(h.maxCount,Math.max(...h.bins.map(b=>b.count)))
  });
  test('histogram: blank cells and text are counted apart from the numbers',()=>{
    const nums=Array.from({length:40},(_,i)=>String(i+1));
    const {h}=hist(nums.concat(['','x','  ','n/a']));
    eq(h.total,40);eq(h.empty,2);eq(h.skipped,2);
    eq(h.bins.reduce((a,b)=>a+b.count,0),40)
  });
  test('histogram: a column with a single value has a single bar',()=>{
    const {h}=hist(['4','4','4']);
    eq(h.bins.length,1);eq(h.bins[0].count,3);ok(h.bins[0].last)
  });
  test('histogram: an empty column has none',()=>{
    const {h}=hist(['','','']);
    eq(h,null)
  });
  test('histogram: text columns have none',()=>{
    const t=tbl(['v'],[['alpha'],['beta'],['gamma'],['delta']]);
    eq(W.histogram(t,'v',CTX),null);eq(W.histogram(t,'nope',CTX),null)
  });
  test('histogram: dates are binned by day and shown as ISO dates',()=>{
    const rows=[];for(let i=0;i<60;i++)rows.push('2026-01-'+String(1+i%28).padStart(2,'0'));
    const {h}=hist(rows);
    eq(h.type,'date');ok(h.bins.length<=20);eq(h.bins.reduce((a,b)=>a+b.count,0),60);
    eq(h.bins[0].lo,'2026-01-01');eq(h.bins[h.bins.length-1].hi,'2026-01-28');
    ok(h.bins.every(b=>/^\d{4}-\d{2}-\d{2}$/.test(b.lo)&&/^\d{4}-\d{2}-\d{2}$/.test(b.shown)))
  });
  test('histogram: a few dates give one bar per day at most',()=>{
    const {h}=hist(['2026-03-01','2026-03-03','2026-03-03']);
    eq(h.bins.length,3);eq(h.bins.map(b=>b.count),[1,0,2])
  });
  test('histogram: European amounts are read with the column locale and edges stay in that style',()=>{
    const {h}=hist(['1.234,50','2.000,00','10,5','999,99','3.500,25','7,00']);
    eq(h.locale,'eu');eq(h.total,6);ok(h.bins.every(b=>/^\d+(,\d+)?$/.test(b.lo)&&/^\d+(,\d+)?$/.test(b.hi)),h.bins.map(b=>b.lo+'|'+b.hi).join(' '))
  });
  test('histogram: never more bins than asked for',()=>{
    const {t}=hist(Array.from({length:500},(_,i)=>String(i*i)));
    [1,2,5,20,50].forEach(n=>ok(W.histogram(t,'v',CTX,n).bins.length<=n))
  });
  test('histogram: tiny differences on huge numbers still add up',()=>{
    const {h}=hist(['10000000000.00001','10000000000.00002','10000000000.00003']);
    eq(h.bins.reduce((a,b)=>a+b.count,0),3)
  });


  const orders=()=>{const x=W.makeSample('orders');const t=W.applyReading(x.text,W.detectReadings(x.text).readings[0],{htmlTables:null});return{x,t}};
  test('sample Orders 2025: is listed and is made the same way every time',()=>{
    ok(!!W.SAMPLES.orders&&W.SAMPLES.orders.title==='Orders 2025');
    eq(W.makeSample('orders').text,W.makeSample('orders').text);
    eq(W.makeSample('orders').fileName,'orders-2025.csv')
  });
  test('sample Orders 2025: reads as one 121-row table with nine columns',()=>{
    const {t}=orders();
    eq(t.n,121);eq(t.cols,['order_id','customer','status','region','amount_usd','amount_eur','order_date','ship_date','notes']);
    eq(W.findTables(W.makeSample('orders').text,{htmlTables:null}).split,false)
  });
  test('sample Orders 2025: statuses come in several spellings of the same word',()=>{
    const {t}=orders();
    const c=t.data[t.cols.indexOf('status')];
    const paid=new Set(c.filter(v=>v.toLowerCase()==='paid'));
    ok(paid.size>=3,Array.from(paid).join());
    ok(c.some(v=>v==='Pending')&&c.some(v=>v==='pending'))
  });
  test('sample Orders 2025: one amount column is US style and the other is European',()=>{
    const {t}=orders();
    const ctx={dateOrder:'mdy'};
    eq(W.profile(t,'amount_usd',ctx).number.locale,'us');eq(W.profile(t,'amount_eur',ctx).number.locale,'eu');
    eq(W.typesOf(t,ctx).slice(4,8),['number','number','date','date'])
  });
  test('sample Orders 2025: some dates and notes are blank',()=>{
    const {t}=orders();
    const ship=t.data[t.cols.indexOf('ship_date')],notes=t.data[t.cols.indexOf('notes')];
    ok(ship.filter(v=>!v).length>=5&&ship.filter(v=>!v).length<40);
    ok(notes.filter(v=>!v).length>60&&notes.some(v=>v))
  });
  test('sample Orders 2025: it contains exactly one duplicated row',()=>{
    const {t}=orders();
    const seen=new Map();let dup=0;
    for(let r=0;r<t.n;r++){const k=t.cols.map((_,c)=>t.data[c][r]).join('\u0001');if(seen.has(k))dup++;else seen.set(k,1)}
    eq(dup,1)
  });
  test('sample Orders 2025: the queries on the what\'s new card find rows',()=>{
    const {t}=orders();
    const ctx={dateOrder:'mdy',nextRowId:1};
    const run=src=>{const q=W.Q.parse(src,t.cols);ok(!q.errors||!q.errors.length,src);return W.OPS.filterRows.apply(t,{mode:'keep',tree:q.tree},ctx).table.n};
    const a=run('status:paid amount_usd>500'),b=run('=[amount_usd] > 500');
    ok(a>0&&a<t.n);ok(b>0&&b<t.n&&b>=a)
  });

  const E=W.Engine;
  const csvOf=(cols,rows)=>cols.join(',')+'\n'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const loadRows=(cols,rows)=>{E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy',today:null});E.handle('load',{text:csvOf(cols,rows),hint:{kind:'delimited',params:{delimiter:',',quote:'"',header:true},force:true}})};
  const idsOf=v=>E.handle('getRows',{viewKey:v.key,start:0,count:Math.max(1,v.n)}).rowIds.slice(0,v.n);
  const ALPHA=['a','b','i','s','k','I','S','K','İ','ı','ſ','K','Σ','σ','ς','é','É','x','1',' ','-','.'];
  const rcell=r=>{let x='';const n=1+((r()*6)|0);for(let i=0;i<n;i++)x+=ALPHA[(r()*ALPHA.length)|0];return x.trim()};
  [0xBEEF,0xFACE,0xC0DE].forEach(seed=>{
    test('free-text search: the first-run scan agrees with the folded text on random cells (seed '+seed.toString(16)+')',()=>{
      const r=W.mulberry32(seed);
      const rows=[];for(let i=0;i<300;i++)rows.push([rcell(r),rcell(r),rcell(r)]);
      loadRows(['a','b','c'],rows);
      const t=W.E.states[0];
      for(let q=0;q<60;q++){
        const term=['a','b','i','s','k','x','1'][(r()*7)|0]+(r()<0.6?['a','b','i','s','k','x','1','.','-'][(r()*9)|0]:'')+(r()<0.3?['i','s','k'][(r()*3)|0]:'');
        const want=[];
        for(let i=0;i<t.n;i++){let hit=false;for(let c=0;c<3&&!hit;c++){const v=t.data[c][i];if(v&&W.Q.norm(v).indexOf(W.Q.norm(term))!==-1)hit=true}if(hit)want.push(i)}
        delete t._search;t._searches=0;
        const v=E.handle('setView',{search:term,sort:[],filter:null,rowIds:null});
        eq(v.n,want.length,'term '+JSON.stringify(term));
        const ids=idsOf(v);
        eq(ids,want.map(i=>t.rowIds[i]),'term '+JSON.stringify(term))
      }
    })
  });
  test('free-text search: İ, ſ and the Kelvin sign are found by their plain letters on the first run',()=>{
    loadRows(['a'],[['İstanbul'],['Muſic'],['Kelvin'],['plain'],['istanbul']]);
    const f=q=>{const t=W.E.states[0];delete t._search;t._searches=0;return E.handle('setView',{search:q,sort:[],filter:null,rowIds:null}).n};
    eq(f('istanbul'),2);eq(f('music'),1);eq(f('kelvin'),1);eq(f('plain'),1);eq(f('zzz'),0);eq(f('a.b'),0)
  });
  test('free-text search: regular-expression characters in a word are taken literally on the first run',()=>{
    loadRows(['a'],[['a.b'],['axb'],['c+d'],['e\\f'],['g-h'],['a[1]']]);
    const f=q=>{const t=W.E.states[0];delete t._search;t._searches=0;return E.handle('setView',{search:q,sort:[],filter:null,rowIds:null}).n};
    eq(f('a.b'),1);eq(f('a[1]'),1);eq(f('c+d'),1);eq(f('e\\f'),1);eq(f('g-h'),1);eq(f('a*'),0)
  });
  const check=(name,rows,ctx)=>test('histogram: clicking any bar of '+name+' keeps exactly the rows it counts',()=>{
    const {t,h}=hist(rows,ctx);
    ok(h.bins.length>0);
    h.bins.forEach((b,i)=>eq(matches(t,'v',b),b.count,'bar '+(i+1)+' '+b.lo+' to '+b.hi))
  });
  const rng=W.mulberry32(0xC0FFEE);
  const rnd=(a,b)=>a+(b-a)*rng();
  check('integers',Array.from({length:400},()=>String(Math.floor(rnd(-50,500)))));
  check('decimals',Array.from({length:400},()=>rnd(0,3).toFixed(3)));
  check('money with symbols',Array.from({length:300},()=>'$'+Math.floor(rnd(1,99999)).toLocaleString('en-US')+'.'+String(Math.floor(rnd(0,99))).padStart(2,'0')));
  check('European amounts',Array.from({length:300},()=>Math.floor(rnd(1,9999))+','+String(Math.floor(rnd(0,99))).padStart(2,'0')));
  check('values sitting on bin edges',Array.from({length:200},(_,i)=>String(i%21*5)));
  check('negative and mixed',Array.from({length:300},()=>String((rnd(-1000,1000)).toFixed(2))).concat(['','n/a','abc']));
  check('dates',Array.from({length:300},()=>{const d=new Date(Date.UTC(2025,0,1)+Math.floor(rnd(0,420))*86400000);return d.toISOString().slice(0,10)}));
  check('few dates',['2026-02-01','2026-02-01','2026-02-09','2026-02-10']);
  check('one value',['8','8']);
  check('big numbers',Array.from({length:200},()=>String(Math.floor(rnd(1e9,1e10)))));
  check('tiny range',Array.from({length:100},()=>String(rnd(1,1.0001).toFixed(6))));
});
})(typeof self!=='undefined'?self:globalThis);
