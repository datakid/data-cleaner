(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const gold=G.WEFT_GOLDEN_V2;
  const fnv=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(16).padStart(8,'0')};
  const digest=t=>fnv(JSON.stringify({cols:t.cols,rows:W.tableRows(t)}));
  test('golden v2 data is present',()=>{ok(gold&&gold.ops.length>=80&&gold.scenarios.length>=4,'golden data missing')});
  if(!gold)return;
  gold.ops.forEach(g=>{
    test('golden v2 '+g.id+' #'+(g.k+1)+' line parses to the same step',()=>{
      const p=W.parseStepLine(g.line);
      eq(p.opId,g.id,'op');
      eq(p.cfg,g.parsed,'cfg');
      eq(W.OPS[g.id].toDsl(p.cfg),g.line,'line')
    });
    test('golden v2 '+g.id+' #'+(g.k+1)+' gives the same table',()=>{
      const p=W.parseStepLine(g.line);
      const t=W.tableFromRows(g.input.cols,g.input.rows);
      const refs={};if(g.refs)for(const n in g.refs)refs[n]=W.tableFromRows(g.refs[n].cols,g.refs[n].rows);
      const r=W.OPS[g.id].apply(t,W.clone(p.cfg),{refs,nextRowId:1000});
      eq(r.table.cols,g.out.cols,'cols');
      eq(W.tableRows(r.table),g.out.rows,'rows')
    })
  });
  const sample=W.makeSample('vendor');
  const base=W.applyReading(sample.text,W.detectReadings(sample.text).readings[0],{htmlTables:null});
  test('golden v2 vendor sample reads the same',()=>{eq(digest(base),gold.baseDigest);eq(base.n,gold.baseRows)});
  gold.scenarios.forEach(g=>{
    test('golden v2 recipe "'+g.name+'" parses and re-serialises unchanged',()=>{
      const r=W.textToSteps(g.text);
      eq(r.errors.length,0,'errors');
      eq(W.stepsToText(r.steps,null),g.recipe)
    });
    test('golden v2 recipe "'+g.name+'" gives the same result at every step',()=>{
      const r=W.textToSteps(g.recipe);
      const run=W.runPipeline(base,r.steps,{});
      eq(run.meta.filter(m=>m.error).length,0,'step errors');
      eq(run.states.slice(1).map(digest),g.stepDigests);
      const fin=run.states[run.states.length-1];
      eq(fin.n,g.n);eq(fin.cols,g.cols)
    })
  })
})
})(typeof self!=='undefined'?self:globalThis);
