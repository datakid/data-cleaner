(function(G){
'use strict';
const W=G.WeftCore;
G.runCoreTests=function(){
  const results=[];
  const test=(name,fn)=>{try{fn();results.push({name,ok:true})}catch(e){results.push({name,ok:false,error:e.message})}};
  const eq=(a,b,m)=>{if(!W.deepEqual(a,b))throw new Error((m?m+': ':'')+'expected '+JSON.stringify(b)+' got '+JSON.stringify(a))};
  const ok=(c,m)=>{if(!c)throw new Error(m||'assertion failed')};
  W.OP_ORDER.forEach(id=>{
    const d=W.OPS[id];
    test('op '+id+' has contract',()=>{ok(d.describe&&d.toDsl&&d.fromDsl&&d.keywords.length&&d.examples.length>=2,'missing parts')});
    d.examples.forEach((ex,k)=>{
      test('op '+id+' example '+(k+1),()=>{
        const t=W.tableFromRows(ex.input.cols,ex.input.rows);
        const refs={};if(ex.refs)for(const n in ex.refs)refs[n]=W.tableFromRows(ex.refs[n].cols,ex.refs[n].rows);
        const r=d.apply(t,W.clone(ex.cfg),{refs,nextRowId:1000});
        eq(r.table.cols,ex.expect.cols,'cols');
        eq(W.tableRows(r.table),ex.expect.rows,'rows')
      });
      test('op '+id+' DSL round-trip '+(k+1),()=>{
        const line=d.toDsl(ex.cfg);const p=W.parseStepLine(line);
        eq(p.opId,id,'op for "'+line+'"');
        eq(p.cfg,ex.cfg,'cfg for "'+line+'"')
      })
    })
  });
  test('v1 filter alias',()=>{const p=W.parseStepLine('filter contains "x"');eq(p.opId,'filterRows');eq(p.cfg.conditions[0],{col:'*',op:'contains',value:'x',caseSensitive:false})});
  test('mixed and/or rejected',()=>{let th=false;try{W.parseStepLine('keep rows where "a" is "1" and "b" is "2" or "c" is "3"')}catch(e){th=/either/.test(e.message)}ok(th)});
  test('recipe v2 parse',()=>{const r=W.textToSteps('# weft recipe v2\n@source {"kind":"delimited","params":{"delimiter":","}}\ntrim *\n#! remove empty rows\n# comment\nbogus line');eq(r.steps.length,2);eq(r.steps[1].muted,true);eq(r.source.kind,'delimited');eq(r.errors.length,1)});
  test('parseNumber variants',()=>{eq(W.parseNumber('1.234,50',{locale:'eu'}).value,1234.5);eq(W.parseNumber('(12.5)').value,-12.5);ok(Math.abs(W.parseNumber('12%').value-0.12)<1e-9);ok(W.parseNumber('12abc')===null)});
  test('parseDate variants',()=>{eq(W.parseDate('12/10/95').y,1995);eq(W.parseDate('01/02/2025',{order:'dmy'}).mo,2);eq(W.parseDate('2025-06-01T10:00:00Z').d,1)});
  test('unsafe regex',()=>{ok(W.isUnsafeRegexSource('(a+)+'));ok(!W.isUnsafeRegexSource('[\\w.]+@'))});
  test('synthesis trim',()=>{const r=W.synthesize([{before:'  Hi  ',after:'Hi'}],['  Hi  ',' x ']);eq(r[0].c.type,'trim')});
  (G.WEFT_FIXTURES||[]).forEach(f=>{
    test('fixture '+f.name,()=>{
      const text=f.text();
      const det=W.detectReadings(text,{htmlTables:f.html||null});
      const top=det.readings[0];
      const x=f.expect;
      if(x.kindIn)ok(x.kindIn.indexOf(top.kind)!==-1,'kind '+top.kind+' not in '+x.kindIn);
      else eq(top.kind,x.kind,'kind (others: '+det.readings.slice(1,4).map(r=>r.kind+'@'+r.confidence).join(', ')+')');
      if(f.maxTabularConf!=null){const tab=det.readings.filter(r=>r.kind!=='lines'&&r.kind!=='list');ok(!tab.some(r=>r.confidence>=f.maxTabularConf),'tabular reading too confident: '+tab.map(r=>r.kind+'@'+r.confidence).join(','))}
      const t=W.applyReading(text,top,{htmlTables:f.html||null});
      if(x.cols!=null)eq(t.cols.length,x.cols,'cols '+JSON.stringify(t.cols));
      if(x.rows!=null)eq(t.n,x.rows,'rows');
      if(f.issues){const is=W.issues(t,{});f.issues.forEach(k=>ok(is.some(i=>i.kind===k),'missing issue '+k+' have '+is.map(i=>i.kind).join(',')));
        let cur=t;for(const k of f.issues){const is2=W.issues(cur,{});const i=is2.find(z=>z.kind===k);if(!i||!i.fix)continue;cur=W.OPS[i.fix.opId].apply(cur,i.fix.cfg,{}).table}
        const after=W.issues(cur,{});f.issues.forEach(k=>ok(!after.some(i=>i.kind===k),'issue '+k+' not fixed'))}
    })
  });
  test('pipeline new rowIds + lineage',()=>{
    const b=W.tableFromRows(['a','tags'],[['x','p;q'],['y','r']]);
    const steps=[{opId:'splitToRows',cfg:{column:'tags',delimiter:';',trim:true}},{opId:'case',cfg:{columns:['a'],mode:'upper'}}];
    const r=W.runPipeline(b,steps,{},0);
    eq(r.states[2].n,3);eq(new Set(r.states[2].rowIds).size,3);
    const lin=W.lineage(r.states,steps,0,'a',2);eq(lin[lin.length-1].value,'X')
  });
  test('likeThese finds empty status',()=>{
    const t=W.tableFromRows(['id','status'],[['1','paid'],['2',''],['3','paid'],['4','']]);
    const c=W.likeThese(t,[1,3],{});ok(c.length&&c[0].cfg.conditions[0].op==='isEmpty'&&c[0].matchesOthers===0)
  });
  test('engine load + view + export',()=>{
    const E=W.Engine;
    const r=E.handle('load',{text:'a,b\n1,2\n3,4'});eq(r.baseSchema.n,2);
    const v=E.handle('setView',{stateIdx:0,search:'3'});eq(v.n,1);
    const x=E.handle('export',{scope:'final',format:'tsv',options:{header:true}});eq(x.text,'a\tb\n1\t2\n3\t4\n')
  });
  return results
};
})(typeof self!=='undefined'?self:globalThis);
