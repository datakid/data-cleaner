(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const E=W.Engine;
  const C=(col,op,value,extra)=>Object.assign({col,op,value,caseSensitive:false},extra||{});
  const LEAVES=[C('a','equals','x'),C('b','contains','y'),C('c','gt','5'),C('d','startsWith','z'),C('e','isEmpty',undefined),C('*','contains','q'),C('f','between','1',{value2:'9'}),C('g','in',undefined,{values:['p','q r']}),C('@row','matches','^a\\d$'),C('h','wholeWord','w'),C('i','eq','3'),C('j','ne','4'),C('k','endsWith','end',{caseSensitive:true}),C('l','notContains','nn')];
  const clean=l=>{const o=Object.assign({},l);for(const k of Object.keys(o))if(o[k]===undefined)delete o[k];return o};
  function genTree(r,depth){
    const u=r();
    if(depth>=3||u<0.4)return clean(LEAVES[(r()*LEAVES.length)|0]);
    if(u<0.55)return{op:'not',child:genTree(r,depth+1)};
    const op=u<0.78?'and':'or';
    const n=2+((r()*2)|0);
    const kids=[];
    for(let i=0;i<n;i++){
      let k=genTree(r,depth+1);
      if(k.op===op&&k.children)k={op:'not',child:k};
      kids.push(k)
    }
    return{op,children:kids}
  }
  const rng=W.mulberry32(0xC0FFEE);
  const trees=[];
  while(trees.length<40){const t=W.normTree(genTree(rng,0));if(t&&(t.op==='and'||t.op==='or'||t.op==='not'))trees.push(t)}
  trees.forEach((tree,i)=>{
    test('tree round trip '+(i+1),()=>{
      const steps=[{opId:'filterRows',cfg:W.cfgFromTree(i%2?'keep':'remove',tree),muted:false}];
      const text=W.stepsToText(steps,null);
      const back=W.textToSteps(text);
      eq(back.errors,[],'errors in '+text);
      eq(back.steps,steps,text)
    })
  });
  test('tree round trip covers deep nesting of not, or and and',()=>{
    const tree={op:'or',children:[{op:'and',children:[C('a','equals','1'),{op:'not',child:{op:'or',children:[C('b','equals','2'),C('c','equals','3')]}}]},{op:'not',child:{op:'not',child:C('d','isEmpty')}}]};
    const steps=[{opId:'filterRows',cfg:W.cfgFromTree('keep',tree),muted:true}];
    eq(W.textToSteps(W.stepsToText(steps,null)).steps,steps)
  });

  test('header rule: v2-only recipes write v2',()=>{
    const flat=[{opId:'filterRows',cfg:{mode:'keep',match:'any',conditions:[C('a','equals','1'),C('b','equals','2')]},muted:false},{opId:'trim',cfg:{columns:['*'],collapse:true},muted:false}];
    ok(/^# weft recipe v2\n/.test(W.stepsToText(flat,null)))
  });
  test('header rule: recipes with a condition tree write v3',()=>{
    const steps=[{opId:'filterRows',cfg:W.cfgFromTree('keep',{op:'not',child:C('a','equals','1')}),muted:false}];
    ok(/^# weft recipe v3\n/.test(W.stepsToText(steps,null)))
  });
  test('header rule: a muted tree step still makes the recipe v3',()=>{
    const steps=[{opId:'filterRows',cfg:W.cfgFromTree('keep',{op:'not',child:C('a','equals','1')}),muted:true}];
    ok(/^# weft recipe v3\n/.test(W.stepsToText(steps,null)))
  });
  test('flat conditions serialise exactly as before',()=>{
    const line=W.OPS.filterRows.toDsl({mode:'keep',match:'all',conditions:[C('amount','gt','100'),C('region','in',undefined,{values:['EMEA','APAC']})]});
    eq(line,'keep rows where "amount" > 100 and "region" in ("EMEA", "APAC")')
  });
  test('mixed and/or without brackets is still refused with a hint',()=>{
    let msg='';try{W.parseStepLine('keep rows where "a" is "1" and "b" is "2" or "c" is "3"')}catch(e){msg=e.message}
    ok(/either/.test(msg)&&/parentheses/.test(msg),msg)
  });
  test('brackets allow mixed and/or',()=>{
    const p=W.parseStepLine('keep rows where ("a" is "1" and "b" is "2") or "c" is "3"');
    eq(p.cfg.tree,{op:'or',children:[{op:'and',children:[C('a','equals','1'),C('b','equals','2')]},C('c','equals','3')]})
  });
  test('not parses in front of a condition and a group',()=>{
    eq(W.parseStepLine('remove rows where not "a" is empty').cfg.tree,{op:'not',child:C('a','isEmpty')});
    eq(W.parseStepLine('remove rows where not ("a" is empty or "b" is empty)').cfg.tree,{op:'not',child:{op:'or',children:[C('a','isEmpty'),C('b','isEmpty')]}})
  });
  test('brackets around a single condition give the old flat shape',()=>{
    eq(W.parseStepLine('keep rows where ("a" is "1")').cfg,{mode:'keep',match:'all',conditions:[C('a','equals','1')]})
  });
  test('brackets around one kind of operator are flattened',()=>{
    eq(W.parseStepLine('keep rows where ("a" is "1" and "b" is "2") and "c" is "3"').cfg,{mode:'keep',match:'all',conditions:[C('a','equals','1'),C('b','equals','2'),C('c','equals','3')]})
  });
  test('an unclosed bracket in a step is an error',()=>{
    let msg='';try{W.parseStepLine('keep rows where ("a" is "1"')}catch(e){msg=e.message}ok(/\)/.test(msg),msg)
  });
  test('very deep brackets in a step are refused',()=>{
    let msg='';try{W.parseStepLine('keep rows where '+'('.repeat(80)+'"a" is "1"'+')'.repeat(80))}catch(e){msg=e.message}ok(/deeply/.test(msg),msg)
  });
  test('whole word, equal to and not equal to survive the DSL',()=>{
    ['"a" has word "x"','"a" is equal to 5','"a" is not equal to 5'].forEach(c=>{
      const p=W.parseStepLine('keep rows where '+c);eq(W.OPS.filterRows.toDsl(p.cfg),'keep rows where '+c)
    })
  });
  test('a tree step describes itself in words',()=>{
    const d=W.OPS.filterRows.describe(W.cfgFromTree('keep',{op:'or',children:[{op:'and',children:[C('a','equals','1'),C('b','equals','2')]},C('c','equals','3')]}));
    eq(d,'Keep rows where ("a" is "1" and "b" is "2") or "c" is "3"')
  });
  test('a tree step validates its leaves',()=>{
    const bad=W.cfgFromTree('keep',{op:'not',child:C('a','equals','')});
    ok(/Enter a value/.test(W.OPS.filterRows.validate(bad)||''))
  });
  test('stepColumns and remapStep see the leaves of a tree',()=>{
    const step={opId:'filterRows',cfg:W.cfgFromTree('keep',{op:'or',children:[C('Amount','gt','1'),{op:'not',child:C('Status','isEmpty')}]}),muted:false};
    eq(W.stepColumns(step).sort(),['Amount','Status']);
    const m=W.remapStep(step,{Amount:'Total'});
    eq(W.stepColumns(m).sort(),['Status','Total']);
    eq(step.cfg.tree.children[0].col,'Amount')
  });
  test('treeTester agrees with the flat tester for old-style conditions',()=>{
    E.handle('tableReset',{id:'t1'});
    E.handle('load',{text:'a,b\n1,x\n2,y\n3,x\n4,z'});
    const t=W.E.states[0];
    const conds=[C('a','gt','1'),C('b','in',undefined,{values:['x','z']})];
    ['all','any'].forEach(match=>{
      const flat=W.rowTester(t,{match,conditions:conds},{});
      const tree=W.treeTester(t,W.condsToTree({match,conditions:conds}),{});
      for(let r=0;r<t.n;r++)eq(tree(r),flat(r))
    })
  });
  test('pruneTree drops leaves and empty groups',()=>{
    const tree={op:'and',children:[C('a','equals','1'),{op:'or',children:[C('gone','equals','2'),C('gone','equals','3')]}]};
    eq(W.pruneTree(tree,l=>l.col!=='gone'),C('a','equals','1'));
    eq(W.pruneTree({op:'not',child:C('gone','equals','1')},l=>l.col!=='gone'),null)
  });
  test('a tree step runs through the whole pipeline and undoes to the same rows',()=>{
    E.handle('tableReset',{id:'t1'});
    E.handle('load',{text:'s,n\npaid,5\nlate,9\npaid,1\nopen,7'});
    const steps=[{id:'f',opId:'filterRows',cfg:W.cfgFromTree('keep',{op:'and',children:[C('s','equals','paid'),{op:'not',child:C('n','lt','3')}]}),muted:false}];
    const r=E.handle('setPipeline',{steps,fromIndex:0});
    eq(r.states[r.states.length-1].n,1);
    E.handle('setPipeline',{steps:[],fromIndex:0});
    eq(E.handle('pipelineInfo',{}).states[0].n,4)
  })
})
})(typeof self!=='undefined'?self:globalThis);
