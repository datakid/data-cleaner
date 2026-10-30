(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const E=W.Engine;
  const CSV=[
    'Status,Amount,Date,Region,Order ID,Notes',
    'Paid,150.00,2025-01-15,EMEA,100,new york office',
    'paid,50,2025-02-10,APAC,101,"York, New"',
    'Pending,700,2025-03-31,emea,102,ref 12',
    'PAID,"1,200.50",2025-04-01,US,103,test card',
    'Late,-20,2024-12-31,APAC,104,',
    ',100,,EMEA,105,ref 7',
    'Paid,500,2025-03-01,US,106,New York'
  ].join('\n');
  const COLS=['Status','Amount','Date','Region','Order ID','Notes'];
  const load=()=>{E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy',today:null});E.handle('load',{text:CSV,hint:{kind:'delimited',params:{delimiter:',',quote:'"',header:true},force:true}})};
  const ids=q=>{const v=E.handle('setView',{search:q,sort:[],filter:null,rowIds:null});return E.handle('getRows',{viewKey:v.key,start:0,count:Math.max(1,v.n)}).rowIds.slice(0,v.n)};
  const C=(col,op,value,extra)=>Object.assign({col,op,value,caseSensitive:false},extra||{});
  const free=v=>C('*','contains',v);

  const TABLE=[
    ['paid',[0,1,3,6]],
    ['paid card',[3]],
    ['"new york"',[0,6]],
    ['status:paid',[0,1,3,6]],
    ['status:=paid',[0,1,3,6]],
    ['status:!=paid',[2,4,5]],
    ['-status:paid',[2,4,5]],
    ['NOT status:paid',[2,4,5]],
    ['-test',[0,1,2,4,5,6]],
    ['amount>100',[0,2,3,6]],
    ['amount>=100',[0,2,3,5,6]],
    ['amount<0',[4]],
    ['amount:100..500',[0,5,6]],
    ['date>2025-01-01',[0,1,2,3,6]],
    ['date:2025-01-01..2025-03-31',[0,1,2,6]],
    ['region:(emea|apac)',[0,1,2,4,5]],
    ['status:=""',[5]],
    ['status:!=""',[0,1,2,3,4,6]],
    ['notes:/^ref \\d+$/i',[2,5]],
    ['"order id":103',[3]],
    ['[order id]:104',[4]],
    ['status:paid OR status:pending',[0,1,2,3,6]],
    ['(status:late OR region:us) -notes:test',[4,6]],
    ['amount=100',[5]],
    ['amount!=100',[0,1,2,3,4,6]],
    ['region:=emea',[0,2,5]],
    ['status:paid amount>100',[0,3,6]],
    ['order_id:105',[5]]
  ];
  TABLE.forEach(([q,want])=>test('query "'+q+'" keeps rows '+JSON.stringify(want),()=>{load();eq(ids(q),want)}));

  const FALLBACK=[
    ['10:30',free('10:30')],
    ['http://x.com',free('http://x.com')],
    ['a:b',free('a:b')],
    ['5>3',free('5>3')],
    [':',free(':')],
    ['-',free('-')],
    ['--x',{op:'not',child:{op:'not',child:free('x')}}],
    ['',null],
    [' '.repeat(500),null]
  ];
  FALLBACK.forEach(([q,tree])=>test('free text fallback for '+JSON.stringify(q.length>20?q.length+' spaces':q)+' never throws',()=>{
    const r=W.Q.parse(q,COLS);
    eq(r.tree,tree);eq(r.errors.length,0)
  }));
  test('a lone quote is an error and does not throw',()=>{const r=W.Q.parse('"',COLS);eq(r.tree,null);eq(r.errors.length,1)});
  test('a lone bracket is an error and does not throw',()=>{const r=W.Q.parse('(',COLS);eq(r.tree,null);eq(r.errors.length,1)});
  test('an unclosed quote searches the rest as plain words',()=>{
    const r=W.Q.parse('status:paid "new york',COLS);
    eq(r.tree,{op:'and',children:[C('Status','contains','paid'),free('new'),free('york')]});
    eq(r.errors.length,1);ok(/quote/.test(r.errors[0].message))
  });
  test('an unclosed bracket still searches its contents',()=>{
    const r=W.Q.parse('(status:paid OR region:us',COLS);
    eq(r.tree,{op:'or',children:[C('Status','contains','paid'),C('Region','contains','us')]});
    eq(r.errors.length,1)
  });
  test('an unclosed value list is reported and still used',()=>{
    const r=W.Q.parse('region:(emea|apac',COLS);
    eq(r.tree,C('Region','in',undefined,{values:['emea','apac']}));eq(r.errors.length,1)
  });
  test('a stray closing bracket is searched as text',()=>{const r=W.Q.parse('paid)',COLS);eq(r.tree,free('paid)'));eq(r.errors.length,0)});
  test('a field with no value yet is incomplete and ignored',()=>{
    const r=W.Q.parse('status:',COLS);eq(r.tree,null);eq(r.errors.length,0);ok(r.tokens[0].incomplete===true);
    eq(W.Q.parse('amount>',COLS).tree,null)
  });
  test('500 nested brackets are refused without a stack overflow',()=>{
    const q='('.repeat(500)+'x'+')'.repeat(500);
    const r=W.Q.parse(q,COLS);ok(r.errors.length>0);ok(Array.isArray(r.tokens))
  });

  test('column names match exactly',()=>{eq(W.Q.parse('Status:x',COLS).tree.col,'Status')});
  test('column names match without regard to case',()=>{eq(W.Q.parse('STATUS:x',COLS).tree.col,'Status')});
  test('order_id matches Order ID',()=>{eq(W.Q.parse('order_id:5',COLS).tree.col,'Order ID')});
  test('quoted column names with spaces match',()=>{eq(W.Q.parse('"order id":5',COLS).tree.col,'Order ID')});
  test('bracketed column names with spaces match',()=>{eq(W.Q.parse('[Order ID]:5',COLS).tree.col,'Order ID')});
  test('an unresolved quoted column makes the whole token plain text',()=>{eq(W.Q.parse('"nope":5',COLS).tree,free('"nope":5'))});
  test('an unresolved bracketed column makes the whole token plain text',()=>{eq(W.Q.parse('[nope]:5',COLS).tree,free('[nope]:5'))});
  test('two columns that tie give a warning and use the first',()=>{
    const r=W.Q.parse('orderid:5',['Order ID','order_id']);
    eq(r.tree.col,'Order ID');eq(r.errors.length,1);eq(r.errors[0].level,'warn')
  });
  test('an exact name wins over a looser one',()=>{
    const r=W.Q.parse('status:x',['Status','status']);
    eq(r.tree.col,'status');eq(r.errors.length,0)
  });
  test('a column literally named OR can be searched',()=>{
    const r=W.Q.parse('OR:x',['OR','b']);
    eq(r.tree,C('OR','contains','x'))
  });
  test('matched columns are reported',()=>{
    const r=W.Q.parse('status:paid -region:us free',COLS);
    eq(r.matchedCols.sort(),['Region','Status'])
  });

  test('a OR b c means a OR (b AND c)',()=>{
    eq(W.Q.parse('a OR b c',COLS).tree,{op:'or',children:[free('a'),{op:'and',children:[free('b'),free('c')]}]})
  });
  test('-a OR b means (NOT a) OR b',()=>{
    eq(W.Q.parse('-a OR b',COLS).tree,{op:'or',children:[{op:'not',child:free('a')},free('b')]})
  });
  test('NOT (a OR b) negates the group',()=>{
    eq(W.Q.parse('NOT (a OR b)',COLS).tree,{op:'not',child:{op:'or',children:[free('a'),free('b')]}})
  });
  test('AND is optional and explicit AND gives the same tree',()=>{
    eq(W.Q.parse('a AND b',COLS).tree,W.Q.parse('a b',COLS).tree)
  });
  test('lowercase or is a search word',()=>{
    eq(W.Q.parse('a or b',COLS).tree,{op:'and',children:[free('a'),free('or'),free('b')]})
  });
  test('a dangling OR is a search word',()=>{
    eq(W.Q.parse('a OR',COLS).tree,{op:'and',children:[free('a'),free('OR')]})
  });
  test('grouping changes precedence',()=>{
    eq(W.Q.parse('(a OR b) c',COLS).tree,{op:'and',children:[{op:'or',children:[free('a'),free('b')]},free('c')]})
  });

  test('an unsafe pattern is refused and the rest of the query still works',()=>{
    load();
    const r=W.Q.parse('notes:/(a+)+$/ paid',COLS);
    eq(r.tree,free('paid'));eq(r.errors.length,1);ok(/pattern/.test(r.errors[0].message));
    eq(ids('notes:/(a+)+$/ paid'),[0,1,3,6])
  });
  test('an invalid pattern is reported and skipped',()=>{
    const r=W.Q.parse('notes:/(/ paid',COLS);
    eq(r.tree,free('paid'));eq(r.errors.length,1)
  });
  test('a path-like word is not a pattern',()=>{eq(W.Q.parse('/usr/bin',COLS).tree,free('/usr/bin'))});
  test('a pattern without i is case sensitive',()=>{
    eq(W.Q.parse('/Ref/',COLS).tree,{col:'*',op:'matches',value:'Ref',caseSensitive:true});
    eq(W.Q.parse('/Ref/i',COLS).tree,{col:'*',op:'matches',value:'Ref',caseSensitive:false})
  });

  test('a comparison that cannot be read shows a message and keeps every row',()=>{
    load();
    const v=E.handle('setView',{search:'amount>abc',sort:[],filter:null,rowIds:null});
    eq(v.n,7);eq(v.query.errors.length,1);ok(/cannot be compared/.test(v.query.errors[0].message))
  });
  test('setView returns tokens, matched columns and highlight terms',()=>{
    load();
    const v=E.handle('setView',{search:'status:paid york',sort:[],filter:null,rowIds:null});
    eq(v.query.matchedCols,['Status']);
    eq(v.query.highlights,{all:['york'],cols:{Status:['paid']}});
    ok(v.query.tokens.some(t=>t.kind==='field'&&t.col==='Status'))
  });
  test('negated terms are not highlighted',()=>{
    eq(W.Q.highlights(W.Q.parse('-test paid',COLS).tree),{all:['paid'],cols:{}})
  });

  test('B8 a phrase keeps New York and rejects York, New',()=>{
    load();
    const got=ids('"new york"');
    ok(got.indexOf(0)!==-1&&got.indexOf(6)!==-1,'New York rows missing');
    ok(got.indexOf(1)===-1,'York, New row wrongly kept')
  });
  test('B8 the same words without quotes keep both rows',()=>{load();const got=ids('new york');ok(got.indexOf(1)!==-1&&got.indexOf(0)!==-1)});
  test('B9 making a free-text search a step keeps the same rows as the view',()=>{
    load();
    ['paid card','paid','new york status:paid','-test','region:us OR region:apac'].forEach(q=>{
      const view=ids(q);
      const t=W.E.states[W.E.states.length-1];
      const cfg=W.cfgFromTree('keep',W.Q.parse(q,t.cols).tree);
      const out=W.OPS.filterRows.apply(t,cfg,{nextRowId:t.n}).table.rowIds.slice();
      eq(out,view,q)
    })
  });
  test('B9 a free-text search becomes a plain v2 step',()=>{
    const cfg=W.cfgFromTree('keep',W.Q.parse('paid card',COLS).tree);
    eq(cfg,{mode:'keep',match:'all',conditions:[free('paid'),free('card')]});
    ok(/^# weft recipe v2/.test(W.stepsToText([{opId:'filterRows',cfg,muted:false}],null)))
  })
})
})(typeof self!=='undefined'?self:globalThis);
