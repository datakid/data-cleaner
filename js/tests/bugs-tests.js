(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const E=W.Engine;
  const fresh=text=>{E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy'});return E.handle('load',{text})};
  const viewIds=p=>{const v=E.handle('setView',Object.assign({sort:[],filter:null,rowIds:null},p));return E.handle('getRows',{viewKey:v.key,start:0,count:Math.max(1,v.n)}).rowIds.slice(0,v.n)};
  const last=()=>W.E.states[W.E.states.length-1];
  const stepIds=(conds,match)=>{const t=last();const test=W.rowTester(t,{match:match||'all',conditions:conds},W.E.ctx);const out=[];for(let r=0;r<t.n;r++)if(test(r))out.push(t.rowIds[r]);return out};

  test('B1 a row-text view filter hides the same rows as the step',()=>{
    fresh('a,b\npage 1,x\nhello,y\npage 22,z\nthe page 3,w');
    const cond={col:'@row',op:'matches',value:'^page \\d+',caseSensitive:false};
    const viaStep=stepIds([cond]);
    const viaView=viewIds({filter:{match:'all',conditions:[cond]}});
    eq(viaStep.length,2,'step rows');
    eq(viaView,viaStep,'view rows')
  });
  test('B1 a view filter still ignores a condition on a missing column',()=>{
    fresh('a,b\n1,x\n2,y');
    eq(viewIds({filter:{match:'all',conditions:[{col:'gone',op:'equals',value:'1',caseSensitive:false}]}}).length,2)
  });

  const U=['İstanbul','ISTANBUL','istanbul','Straße','STRASSE','strasse','ΟΔΟΣ','οδος','οδοσ','ſtone','stone','STONE','Kelvin K','kelvin k','plain'];
  const uText='name\n'+U.join('\n');
  const scanIds=q=>{fresh(uText);const r=viewIds({search:q});ok(!last()._search,'scan expected');return r};
  const indexIds=q=>{fresh(uText);viewIds({search:'zzzz'});const r=viewIds({search:q});ok(!!last()._search,'index expected');return r};
  const termsStep=q=>{fresh(uText);return stepIds(q.trim().split(/\s+/).map(t=>({col:'*',op:'contains',value:t,caseSensitive:false})))};
  ['i','istanbul','İSTANBUL','ss','straße','σ','οδοσ','οδος','ΟΔΟΣ','s','ſ','stone','k','kelvin','plain','zzz','e s'].forEach(q=>{
    test('B2 scan, index and step agree for "'+q+'"',()=>{
      const a=scanIds(q),b=indexIds(q),c=termsStep(q);
      eq(b,a,'index vs scan');eq(c,a,'step vs scan')
    })
  });
  test('B2 the same query gives the same rows on the first and second search',()=>{
    fresh(uText);
    const first=viewIds({search:'οδοσ'});const second=viewIds({search:'οδοσ'});const third=viewIds({search:'οδοσ'});
    eq(second,first);eq(third,first)
  });
  test('B2 final sigma and capital sigma fold together',()=>{eq(scanIds('οδοσ').length,3);eq(indexIds('οδος').length,3)});
  test('B2 the dotted capital I folds to i',()=>{eq(scanIds('istanbul').length,3);eq(indexIds('ISTANBUL').length,3)});

  test('B3 valueKey is shared and trims without changing case',()=>{
    ok(typeof W.valueKey==='function','W.valueKey missing');
    eq(W.valueKey('  Paid '),'Paid');eq(W.valueKey(null),'');eq(W.valueKey('PAID'),'PAID')
  });
  test('B3 each top value selects as many rows as the profile counts',()=>{
    fresh('status,n\nPaid,1\n paid,2\npaid ,3\nPAID,4\nPaid,5\npaid,6\nlate,7\nPaid,8\nLate,9');
    const p=E.handle('profile',{stateIdx:0,col:'status'});
    ok(p.top.length>=3,'profile top '+p.top.length);
    p.top.forEach(t=>eq(E.handle('columnValues',{stateIdx:0,col:'status',value:t.value}).rowIds.length,t.count,t.value))
  });

  const eu='eu,d,note\n"1.234,50",2025-03-04,a\n"999,00",2024-01-01,b\n"12,5",2026-05-06,c\n"2.000,00",2023-02-02,d';
  const anyCol=(op,value,value2)=>{fresh(eu);return stepIds([{col:'*',op,value,value2,caseSensitive:false}])};
  test('B5 any column > 1000 reads European numbers',()=>{eq(anyCol('gt','1000'),[0,3])});
  test('B5 any column between reads European numbers',()=>{eq(anyCol('between','1000','2500'),[0,3])});
  test('B5 any column > a date compares dates only',()=>{eq(anyCol('gt','2025-01-01'),[0,2])});
  test('B5 any column < 15 reads each column on its own scale',()=>{eq(anyCol('lt','15'),[2])});
  test('B5 a value no column can read is still an error',()=>{let msg='';try{anyCol('gt','abc')}catch(e){msg=e.message}ok(/cannot be compared/.test(msg),msg)});

  test('B6 changing the date order recomputes only the open table',()=>{
    const txt='d,n\n01/02/2025,1\n03/04/2025,2\n13/4/2025,3\n14/5/2025,4';
    const conv=[{id:'c',opId:'convertType',cfg:{column:'d',to:'date',locale:'auto',percentAsFraction:false},muted:false}];
    E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy'});
    E.handle('load',{text:txt});E.handle('setPipeline',{steps:conv,fromIndex:0});
    E.handle('tableNew',{id:'t2'});E.handle('load',{text:txt});E.handle('setPipeline',{steps:conv,fromIndex:0});
    E.handle('tableNew',{id:'t3'});E.handle('load',{text:txt});E.handle('setPipeline',{steps:conv,fromIndex:0});
    const real=W.runPipeline;let calls=0;W.runPipeline=function(){calls++;return real.apply(this,arguments)};
    try{E.handle('setCtx',{dateOrder:'dmy'})}finally{W.runPipeline=real}
    eq(calls,1,'pipelines run by setCtx');
    ['t1','t2','t3'].forEach(id=>{
      E.handle('tableUse',{id});
      const v=E.handle('setView',{stateIdx:1,search:'',sort:[],filter:null,rowIds:null});
      eq(E.handle('getRows',{viewKey:v.key,start:0,count:1}).rows[0][0],'2025-02-01',id+' first date')
    });
    E.handle('setCtx',{dateOrder:'mdy'})
  });
  test('B6 a table reached by id is recomputed first',()=>{
    const txt='d,n\n01/02/2025,1\n13/4/2025,2';
    const conv=[{id:'c',opId:'convertType',cfg:{column:'d',to:'date',locale:'auto',percentAsFraction:false},muted:false}];
    E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy'});
    E.handle('load',{text:txt});E.handle('setPipeline',{steps:conv,fromIndex:0});
    E.handle('tableNew',{id:'t2'});E.handle('load',{text:txt});E.handle('setPipeline',{steps:conv,fromIndex:0});
    E.handle('tableUse',{id:'t1'});
    E.handle('setCtx',{dateOrder:'dmy'});
    const out=E.handle('exportTable',{id:'t2',format:'csv',options:{}});
    ok(/2025-02-01/.test(out.text),out.text);
    E.handle('setCtx',{dateOrder:'mdy'})
  })
  const trimmed=(cols,rows,collapse)=>W.tableRows(W.OPS.trim.apply(W.tableFromRows(cols,rows),{columns:['*'],collapse},{nextRowId:100}).table);
  test('H1 trim removes Unicode spaces at the edges of a cell',()=>{
    eq(trimmed(['a'],[['\u3000Ada\u3000'],['\u2003x'],['x\u2009'],['\u00a0y'],['\u202fz\u205f']],true),[['Ada'],['x'],['x'],['y'],['z']]);
    eq(trimmed(['a'],[['\u3000Ada\u3000']],false),[['Ada']])
  });
  test('H1 trim still leaves clean cells alone',()=>{
    eq(trimmed(['a'],[['Ada'],[''],['a b'],['\u3000']],true),[['Ada'],[''],['a b'],['']])
  });
})
})(typeof self!=='undefined'?self:globalThis);
