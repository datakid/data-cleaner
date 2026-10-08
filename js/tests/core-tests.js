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
  const slowParse=(text,delim,quote)=>{
    const rows=[];let row=[],f='',q=false;
    for(let i=0;i<text.length;i++){const c=text[i];
      if(q){if(c===quote){if(text[i+1]===quote){f+=quote;i++}else q=false}else f+=c}
      else{if(quote&&c===quote&&f.trim()===''){q=true;f=''}else if(c===delim){row.push(f);f=''}else if(c==='\n'){row.push(f);f='';rows.push(row);row=[]}else if(c!=='\r')f+=c}}
    if(f!==''||row.length){row.push(f);rows.push(row)}
    return rows
  };
  [
    ['plain','a,b\n1,2\n'],['crlf','a,b\r\n1,2\r\n3,4'],['quoted comma','"x,y",2\n'],['escaped quote','"say ""hi""",z'],
    ['quoted newline','"line1\nline2",b\nc,d'],['space before quote','a, "b,c" ,d'],['quote mid field','ab"c,d'],
    ['empty fields',',,\n,'],['trailing delim','a,b,\n'],['lone cr','a\rb,c'],['nbsp before quote','\u00A0"x,y",z'],
    ['empty quoted','"",x'],['blank lines','a\n\nb'],['no newline end','a,b'],['only quotes','""""'],['tab',"a\tb\n\"c\td\"\te"]
  ].forEach(([name,txt])=>{
    test('parser parity: '+name,()=>{const d=txt.indexOf('\t')!==-1?'\t':',';eq(W.parseDelimited(txt,d,'"'),slowParse(txt,d,'"'));eq(W.parseDelimited(txt,d,''),slowParse(txt,d,''))})
  });
  test('parser unclosed quote reports line',()=>{let m='';try{W.parseDelimited('a,b\nc,"d\ne,f',',','"')}catch(e){m=e.message}ok(/line 2/.test(m),m)});
  test('parser row limit',()=>{eq(W.parseDelimited('1\n2\n3\n4',',','"',2).length,2)});
  test('sort stable + blanks last both directions',()=>{
    const t=W.tableFromRows(['k','i'],[['b','1'],['','2'],['a','3'],['B','4'],['a','5'],['','6']]);
    const asc=W.OPS.sortRows.apply(t,{keys:[{col:'k',dir:'asc',type:'text'}]},{}).table;
    eq(asc.data[1],['3','5','1','4','2','6']);
    const desc=W.OPS.sortRows.apply(t,{keys:[{col:'k',dir:'desc',type:'text'}]},{}).table;
    eq(desc.data[1],['1','4','3','5','2','6'])
  });
  test('sort natural numeric text',()=>{const t=W.tableFromRows(['k'],[['item 10'],['item 2'],['item 1']]);eq(W.OPS.sortRows.apply(t,{keys:[{col:'k',dir:'asc',type:'text'}]},{}).table.data[0],['item 1','item 2','item 10'])});
  test('sort multi-key mixed types',()=>{const t=W.tableFromRows(['g','n'],[['x','2'],['y','1'],['x','10'],['y',''],['x','1']]);const o=W.OPS.sortRows.apply(t,{keys:[{col:'g',dir:'asc',type:'text'},{col:'n',dir:'desc',type:'number'}]},{}).table;eq(o.data[1],['10','2','1','1',''])});
  test('issues cached per table and date order',()=>{const t=W.tableFromRows(['d'],[['3/4/2025'],['5/6/2025'],['2025-01-01']]);const a=W.issues(t,{dateOrder:'mdy'});ok(W.issues(t,{dateOrder:'mdy'})===a,'not cached');ok(W.issues(t,{dateOrder:'dmy'})!==a,'cache ignores date order')});
  test('issues duplicates via hash chain',()=>{
    const rows=[['a','1'],['a','1'],['a','11'],['a1',''],['a','1'],['',''],['','']];
    const t=W.tableFromRows(['x','y'],rows);const is=W.issues(t,{});
    const d=is.find(i=>i.kind==='duplicates');ok(d&&d.count===2,'dups '+(d&&d.count));
    const e=is.find(i=>i.kind==='emptyRows');ok(e&&e.count===2,'empty '+(e&&e.count))
  });
  test('issues whitespace + invisible scan',()=>{
    const t=W.tableFromRows(['a','b'],[['x  y','ok'],[' lead','a\u00A0b'],['fine','q\u201Cx'],['tab\t','c\u0007']]);const is=W.issues(t,{});
    const ws=is.find(i=>i.kind==='whitespace');ok(ws&&ws.count===3,'ws '+(ws&&ws.count));
    const inv=is.find(i=>i.kind==='invisible');ok(inv&&inv.count===3,'inv '+(inv&&inv.count))
  });
  test('date shape matches original regex',()=>{
    const old=v=>v.replace(/[A-Za-z]{3,9}/g,'M').replace(/\d+/g,m=>'9'.repeat(Math.min(m.length,4)));
    ['2025-01-02','3/4/25','March 4, 2025','4-Jan-2025','Wed, 5 Mar 2025','12 de enero 2025','Sept 9 2025','ab 2025','20250102','Thursdayyyyyy 4','x','TBD','10:30 PM 1/2/2025'].forEach(v=>eq(W._dateShape(v),old(v),v))
  });
  test('search index gives same rows as scan',()=>{
    const E=W.Engine;E.handle('load',{text:'n,c\nAda Lovelace,UK\nalan turing,uk\nGrace,US\nada b,us'});
    const a=E.handle('setView',{search:'ada'}).n,b=E.handle('setView',{search:'ada us'}).n;
    const t=W.E.states[W.E.states.length-1];ok(!!t._search,'index not built after repeat searches');
    eq([E.handle('setView',{search:'ada'}).n,E.handle('setView',{search:'ada us'}).n,E.handle('setView',{search:'UK'}).n],[a,b,2]);eq([a,b],[2,1])
  });
  test('schema reports fill share',()=>{const r=W.Engine.handle('load',{text:'a,b\n1,\n2,x\n3,\n4,'});eq(r.finalSchema.cols.map(c=>c.fill),[1,0.25])});
  return results
};
})(typeof self!=='undefined'?self:globalThis);
