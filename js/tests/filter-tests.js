(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const E=W.Engine;
  const load=text=>{E.handle('tableReset',{id:'t1'});E.handle('setCtx',{today:null,dateOrder:'auto'});return E.handle('load',{text})};
  const leaf=(col,op,value,extra)=>Object.assign({col,op,value,caseSensitive:false},extra||{});
  const inLeaf=(col,values)=>({col,op:'in',values,caseSensitive:true});
  const view=p=>E.handle('setView',p);
  const csv=(cols,rows)=>cols.join(',')+'\n'+rows.map(r=>r.join(',')).join('\n');

  test('distinctValues counts match a brute-force count and sort by count then natural order',()=>{
    const r=W.mulberry32(77);
    const words=['a','B','b','item 2','item 10','item 1','x y',''];
    const rows=[];for(let i=0;i<400;i++)rows.push([words[(r()*words.length)|0]||'-',String((r()*5)|0)]);
    rows[0][0]='k';
    load(csv(['w','n'],rows));
    const d=E.handle('distinctValues',{col:'w',stateIdx:-1});
    const want=new Map();rows.forEach(x=>want.set(x[0],(want.get(x[0])||0)+1));
    eq(d.total,want.size);
    d.values.forEach(v=>eq(v.n,want.get(v.v),v.v));
    for(let i=1;i<d.values.length;i++){
      const a=d.values[i-1],b=d.values[i];
      ok(a.n>b.n||(a.n===b.n),'order '+a.v+' '+b.v)
    }
  });
  test('distinctValues reports blanks separately',()=>{
    load('a,b\nx,1\n,2\n  ,3\nx,4\ny,5');
    const d=E.handle('distinctValues',{col:'a',stateIdx:-1});
    eq(d.blanks,2);eq(d.values,[{v:'x',n:2},{v:'y',n:1}]);eq(d.total,2)
  });
  test('distinctValues ignores the column own filter but honours the other columns',()=>{
    load('a,b\nx,1\nx,2\ny,1\nz,2\nz,2');
    const cf={a:inLeaf('a',['x']),b:inLeaf('b',['2'])};
    const d=E.handle('distinctValues',{col:'a',stateIdx:-1,colFilters:cf});
    eq(d.values.map(v=>v.v+':'+v.n).sort(),['x:1','z:2']);
    eq(d.rows,3)
  });
  test('distinctValues honours the search query',()=>{
    load('a,b\nx,apple\ny,apple\nz,pear');
    const d=E.handle('distinctValues',{col:'a',stateIdx:-1,search:'apple'});
    eq(d.values.map(v=>v.v).sort(),['x','y'])
  });
  test('distinctValues truncates at the limit and says so',()=>{
    const rows=[];for(let i=0;i<1500;i++)rows.push(['v'+i,'1']);
    load(csv(['a','b'],rows));
    const d=E.handle('distinctValues',{col:'a',stateIdx:-1});
    eq(d.values.length,1000);eq(d.total,1500);eq(d.truncated,true)
  });
  test('distinctValues for an unknown column is empty',()=>{
    load('a\n1');eq(E.handle('distinctValues',{col:'nope',stateIdx:-1}).values,[])
  });
  test('distinctValues cache is invalidated when the filters change',()=>{
    load('a,b\nx,1\ny,2');
    const d1=E.handle('distinctValues',{col:'a',stateIdx:-1});
    const d2=E.handle('distinctValues',{col:'a',stateIdx:-1,colFilters:{b:inLeaf('b',['1'])}});
    eq(d1.values.length,2);eq(d2.values.length,1)
  });

  const colFilterN=(text,cf)=>{load(text);return view({colFilters:cf,search:''}).n};
  test('column filter checklist matches exact trimmed values case-sensitively',()=>{
    eq(colFilterN('a,z\nApple,1\napple,1\n Apple ,1\nPear,1',{a:inLeaf('a',['Apple'])}),2)
  });
  test('column filter with blanks chosen uses or isEmpty',()=>{
    eq(colFilterN('a\nx\n\ny\n ',{a:{op:'or',children:[inLeaf('a',['x']),{col:'a',op:'isEmpty',caseSensitive:false}]}}),3)
  });
  test('several column filters combine with and',()=>{
    eq(colFilterN('a,b\nx,1\nx,2\ny,1',{a:inLeaf('a',['x']),b:inLeaf('b',['1'])}),1)
  });
  test('a column filter on a column that no longer exists is ignored',()=>{
    eq(colFilterN('a,z\n1,1\n2,1\n3,1',{gone:inLeaf('gone',['1']),a:inLeaf('a',['2'])}),1);
    eq(colFilterN('a,z\n1,1\n2,1\n3,1',{gone:inLeaf('gone',['1'])}),3)
  });
  test('a column filter combines with the search box',()=>{
    load('a,b\nx,red\ny,red\nx,blue');
    eq(view({search:'red',colFilters:{a:inLeaf('a',['x'])}}).n,1)
  });
  test('a column filter combines with a query that uses a tree',()=>{
    load('a,b\nx,1\nx,9\ny,9');
    eq(view({search:'b>5 OR a:y',colFilters:{a:inLeaf('a',['x'])}}).n,1)
  });

  const dates=['2026-03-01','2026-03-31','2026-02-28','2026-04-01','2025-12-31','2026-01-01','2026-03-10'];
  const dateText='d,n\n'+dates.map((d,i)=>d+','+(i+1)).join('\n');
  const rel=(today,col,leafSpec,text)=>{load(text||dateText);E.handle('setCtx',{today});return view({colFilters:{[col]:Object.assign({col,caseSensitive:false},leafSpec)}}).n};
  test('relative date: this month',()=>{eq(rel('2026-03-15','d',{op:'relDate',rel:'thisMonth'}),3)});
  test('relative date: last month',()=>{eq(rel('2026-03-15','d',{op:'relDate',rel:'lastMonth'}),1)});
  test('relative date: last month wraps over the year',()=>{eq(rel('2026-01-20','d',{op:'relDate',rel:'lastMonth'}),1)});
  test('relative date: this year',()=>{eq(rel('2026-03-15','d',{op:'relDate',rel:'thisYear'}),6)});
  test('relative date: last 10 days includes both ends',()=>{eq(rel('2026-03-11','d',{op:'relDate',rel:'lastDays',n:10}),2)});
  test('relative date: leap day is the last day of February',()=>{
    eq(rel('2028-02-10','d',{op:'relDate',rel:'thisMonth'},'d,z\n2028-02-29,1\n2028-03-01,1\n2028-02-01,1'),2)
  });
  test('relative number: top 2 keeps ties',()=>{eq(rel('2026-03-15','n',{op:'relNum',rel:'top',n:2},'n,z\n9,1\n7,1\n7,1\n1,1'),3)});
  test('relative number: bottom 1',()=>{eq(rel('2026-03-15','n',{op:'relNum',rel:'bottom',n:1},'n,z\n9,1\n7,1\n1,1\n1,1'),2)});
  test('relative number: above and below average',()=>{
    eq(rel('2026-03-15','n',{op:'relNum',rel:'above'},'n,z\n1,1\n2,1\n3,1\n10,1'),1);
    eq(rel('2026-03-15','n',{op:'relNum',rel:'below'},'n,z\n1,1\n2,1\n3,1\n10,1'),3)
  });
  test('relative number on an empty column matches nothing',()=>{eq(rel('2026-03-15','n',{op:'relNum',rel:'top',n:3},'n,z\n,1\n,1\nx,1'),0)});
  test('resolveRelative pins fixedOn to the context date',()=>{
    load(dateText);
    const r=W.resolveRelative({col:'d',op:'relDate',rel:'thisMonth'},E.stateAt?E.stateAt(0):W.E.states[0],{today:'2026-03-15'});
    eq([r.op,r.value,r.value2,r.fixedOn],['between','2026-03-01','2026-03-31','2026-03-15'])
  });
  test('resolveRelative leaves absolute trees untouched',()=>{
    const tr={op:'and',children:[leaf('a','equals','1'),leaf('b','gt','2')]};
    ok(W.resolveRelative(tr,null,{})===tr)
  });


  test('filterTree combines the query and the column filters into one tree that keeps the same rows',()=>{
    load('a,b,n\nx,red,1\nx,blue,9\ny,red,9\nz,red,4');
    const cf={a:inLeaf('a',['x','y']),n:{col:'n',op:'relNum',rel:'top',n:2,caseSensitive:false}};
    const v=view({search:'red',colFilters:cf});
    const f=E.handle('filterTree',{stateIdx:-1,search:'red',colFilters:cf});
    ok(f.tree&&f.tree.op==='and');
    E.handle('setPipeline',{steps:[{id:'s1',opId:'filterRows',cfg:W.cfgFromTree('keep',f.tree),muted:false}],fromIndex:0});
    const after=E.handle('pipelineInfo',{}).states;
    eq(after[after.length-1].n,v.n)
  });
  test('filterTree resolves relative filters to fixed values',()=>{
    load('d,z\n2026-03-05,1\n2026-04-05,1');
    E.handle('setCtx',{today:'2026-03-15'});
    const f=E.handle('filterTree',{stateIdx:-1,search:'',colFilters:{d:{col:'d',op:'relDate',rel:'thisMonth',caseSensitive:false}}});
    eq([f.tree.op,f.tree.value,f.tree.value2,f.tree.fixedOn],['between','2026-03-01','2026-03-31','2026-03-15'])
  });
  test('filterTree drops filters on missing columns and is null when nothing is left',()=>{
    load('a,b\n1,2');
    eq(E.handle('filterTree',{stateIdx:-1,search:'',colFilters:{gone:inLeaf('gone',['1'])}}).tree,null)
  });

  const changedCells=(a,b)=>{let n=0;for(let c=0;c<a.cols.length;c++)for(let r=0;r<a.n;r++)if(String(a.data[c][r])!==String(b.data[c][r]))n++;return n};
  const rcfg=(extra)=>Object.assign({columns:['*'],find:'x',replace:'y',regex:false,wholeCell:false,matchCase:false},extra||{});
  const states=()=>W.E.states;
  test('replacePreview counts the same cells the step then changes',()=>{
    load('a,b\nxa,x\nbx,c\nxx,X\nq,r');
    const cfg=rcfg();
    const pv=E.handle('replacePreview',{stateIdx:-1,cfg});
    E.handle('setPipeline',{steps:[{id:'r',opId:'replace',cfg,muted:false}],fromIndex:0});
    const st=states();
    eq(pv.cells,changedCells(st[0],st[1]));
    eq(pv.columns,2);
    ok(pv.samples.length>0&&pv.samples.length<=5)
  });
  test('replacePreview respects whole cell, match case and patterns',()=>{
    load('a,z\nx,1\nxx,1\nX,1');
    eq(E.handle('replacePreview',{stateIdx:-1,cfg:rcfg({columns:['a'],wholeCell:true})}).cells,2);
    eq(E.handle('replacePreview',{stateIdx:-1,cfg:rcfg({columns:['a'],matchCase:true})}).cells,2);
    eq(E.handle('replacePreview',{stateIdx:-1,cfg:rcfg({columns:['a'],regex:true,find:'^x+$'})}).cells,3)
  });
  test('replacePreview reports an error for an empty find and an unsafe pattern',()=>{
    load('a,z\nx,1');
    ok(/something to find/.test(E.handle('replacePreview',{stateIdx:-1,cfg:rcfg({find:''})}).error));
    ok(E.handle('replacePreview',{stateIdx:-1,cfg:rcfg({regex:true,find:'(a+)+$'})}).error)
  });
  test('replacePreview limited to a selection of cells only counts those cells and returns overrides',()=>{
    load('a,b\nx,x\nx,x\nx,x\nx,x');
    const k=view({search:''}).viewKey;
    const pv=E.handle('replacePreview',{viewKey:k,selection:{kind:'cells',rect:{r0:1,r1:2,c0:0,c1:0},rows:{all:false,ids:[],except:[]},cols:[]},cfg:rcfg(),overrides:true});
    eq(pv.cells,2);eq(pv.overrides.length,2);eq(pv.overrides[0].col,'a')
  });
  test('replacePreview limited to selected rows and selected columns',()=>{
    load('a,b\nx,x\nx,x\nx,x');
    const k=view({search:''}).viewKey;
    const ids=W.E.states[0].rowIds;
    const rows=E.handle('replacePreview',{viewKey:k,selection:{kind:'rows',rows:{all:false,ids:[ids[0],ids[2]],except:[]},cols:[]},cfg:rcfg()});
    eq(rows.cells,4);
    const cols=E.handle('replacePreview',{viewKey:k,selection:{kind:'cols',cols:['b'],rows:{all:false,ids:[],except:[]}},cfg:rcfg()});
    eq(cols.cells,3)
  });
  const viewOf=(text,query)=>{load(text);return view({search:''}).viewKey};
  test('findCount counts matching cells, not rows',()=>{
    const k=viewOf('a,b\nfoo,foo\nbar,foo\nbaz,qux');
    eq(E.handle('findCount',{viewKey:k,query:'foo'}).total,3)
  });
  test('findCells walks forward cell by cell and wraps',()=>{
    const k=viewOf('a,b\nfoo,foo\nbar,foo\nbaz,qux');
    E.handle('findCount',{viewKey:k,query:'foo'});
    const seen=[];let from=null;
    for(let i=0;i<4;i++){const r=E.handle('findCells',{viewKey:k,query:'foo',dir:1,from});seen.push([r.pos,r.col]);from={pos:r.pos,col:r.col}}
    eq(seen,[[0,0],[0,1],[1,1],[0,0]])
  });
  test('findCells walks backwards and wraps',()=>{
    const k=viewOf('a,b\nfoo,foo\nbar,foo\nbaz,qux');
    const r=E.handle('findCells',{viewKey:k,query:'foo',dir:-1,from:{pos:0,col:0}});
    eq([r.pos,r.col,!!r.wrapped],[1,1,true])
  });
  test('findCells reports an index once the count is cached',()=>{
    const k=viewOf('a,b\nfoo,foo\nbar,foo');
    E.handle('findCount',{viewKey:k,query:'foo'});
    const r=E.handle('findCells',{viewKey:k,query:'foo',dir:1,from:{pos:0,col:0}});
    eq([r.index,r.total],[2,3])
  });
  test('findCells finds nothing for an absent word',()=>{
    const k=viewOf('a\nfoo');
    eq(E.handle('findCells',{viewKey:k,query:'zzz',dir:1}).pos,-1);
    eq(E.handle('findCount',{viewKey:k,query:'zzz'}).total,0)
  });
  test('find is case-insensitive and folds special letters like the search box',()=>{
    const k=viewOf('a\nİstanbul\nSTRASSE\nstraße');
    eq(E.handle('findCount',{viewKey:k,query:'istanbul'}).total,1);
    eq(E.handle('findCount',{viewKey:k,query:'STRASSE'}).total,1)
  });
  test('find respects the sort order and the filter of the view',()=>{
    load('a\nfoo 3\nfoo 1\nbar\nfoo 2');
    const k=view({search:'foo',sort:[{col:'a',dir:'asc'}]}).viewKey;
    const r=E.handle('findCells',{viewKey:k,query:'foo',dir:1});
    eq([r.pos,r.col],[0,0]);
    eq(E.handle('findCount',{viewKey:k,query:'foo'}).total,3)
  });
  test('an outdated view key gives the friendly refresh error',()=>{
    let m='';try{E.handle('findCount',{viewKey:'v0',query:'a'})}catch(e){m=e.message}ok(/out of date/.test(m),m)
  })
})
})(typeof self!=='undefined'?self:globalThis);
