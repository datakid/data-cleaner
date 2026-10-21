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
  test('A1 three-decimal values are not European thousands',()=>{
    eq(W.detectNumberLocale(['1.234','2.500','0.125']),'us');
    eq(W.detectNumberLocale(['1.234.567','2.500,50']),'eu');
    eq(W.parseNumber('0.125',{locale:'eu'}),null);
    const t=W.tableFromRows(['k','v'],[['a','1.250'],['a','0.125']]);
    const r=W.OPS.aggregate.apply(t,{groupBy:['k'],metrics:['v:sum']},{});
    eq(W.tableRows(r.table),[['a','1.375']])
  });
  test('A5 aggregate and longToWide give new rows fresh ids',()=>{
    const b=W.tableFromRows(['k','v'],[['a','1;2'],['a','3'],['b','4']]);
    const r=W.runPipeline(b,[{opId:'splitToRows',cfg:{column:'v',delimiter:';',trim:true}},{opId:'aggregate',cfg:{groupBy:['k'],metrics:['count']}}],{},0);
    const base=new Set(r.states[0].rowIds);const fin=r.states[r.states.length-1].rowIds;
    ok(fin.length===2&&!fin.some(i=>base.has(i)),'final ids '+fin.join(',')+' base '+Array.from(base).join(','));
    const b2=W.tableFromRows(['id','k','v'],[['1','x','5'],['1','y','6'],['2','x','7']]);
    const r2=W.runPipeline(b2,[{opId:'longToWide',cfg:{idColumns:['id'],keyColumn:'k',valueColumn:'v',duplicatePolicy:'error'}}],{},0);
    const base2=new Set(r2.states[0].rowIds);const fin2=r2.states[1].rowIds;
    ok(fin2.length===2&&!fin2.some(i=>base2.has(i)),'wide ids '+fin2.join(',')+' base '+Array.from(base2).join(','))
  });
  test('A6 splitToRows never creates blank rows',()=>{
    const run=(v,d)=>W.tableRows(W.OPS.splitToRows.apply(W.tableFromRows(['c'],[[v]]),{column:'c',delimiter:d,trim:true},{nextRowId:10}).table);
    eq(run('a;',';'),[['a']]);
    eq(run(',,',','),[['']]);
    eq(run('a,,b',','),[['a'],['b']])
  });
  test('A8 suggestion fixes remove exactly the counted rows',()=>{
    const bad=[];let seen=0;
    (G.WEFT_FIXTURES||[]).forEach(f=>{
      let t;try{const text=f.text();const det=W.detectReadings(text,{htmlTables:f.html||null});t=W.applyReading(text,det.readings[0],{htmlTables:f.html||null})}catch(e){return}
      W.issues(t,{}).forEach(i=>{
        if(!i.fix||['header','title','totals','repeatedHeader','artifacts','emptyRows','duplicates','caseVariants'].indexOf(i.kind)===-1)return;
        let r;try{r=W.OPS[i.fix.opId].apply(t,W.clone(i.fix.cfg),{nextRowId:t.n+1000})}catch(e){bad.push(f.name+':'+i.kind+' threw '+e.message);return}
        seen++;
        if(i.kind==='caseVariants'){const ci=t.cols.indexOf(i.column);let ch=0;for(let k=0;k<t.n;k++)if(t.data[ci][k]!==r.table.data[ci][k])ch++;if(ch!==i.count)bad.push(f.name+':'+i.kind+' count '+i.count+' changed '+ch);return}
        const removed=t.n-r.table.n;
        if(removed!==i.count)bad.push(f.name+':'+i.kind+' count '+i.count+' removed '+removed)
      })
    });
    ok(seen>0,'no issues exercised');
    eq(bad,[],'mismatches')
  });
  test('A8 artifacts fix removes the detected rows only',()=>{
    const rows=[];for(let i=1;i<=10;i++)rows.push(['item '+i,String(i)]);
    rows.splice(3,0,['Page','2']);rows.splice(7,0,['---','data']);
    const t=W.tableFromRows(['a','b'],rows);
    const i=W.issues(t,{}).find(x=>x.kind==='artifacts');
    ok(i&&i.fix,'artifacts issue');
    const r=W.OPS[i.fix.opId].apply(t,W.clone(i.fix.cfg),{nextRowId:100});
    const left=W.tableRows(r.table).map(x=>x.join('|'));
    eq(t.n-r.table.n,i.count,'removed vs count');
    ok(left.indexOf('Page|2')===-1&&left.indexOf('---|data')!==-1,'removed '+JSON.stringify(left))
  });
  test('A8 totals fix removes only the bottom totals',()=>{
    const rows=[];for(let i=1;i<=10;i++)rows.push(['item '+i,String(i)]);
    rows.splice(4,0,['Total shipping','5']);rows.push(['Total','100']);
    const t=W.tableFromRows(['name','amount'],rows);
    const i=W.issues(t,{}).find(x=>x.kind==='totals');
    ok(i&&i.fix,'totals issue');
    const r=W.OPS[i.fix.opId].apply(t,W.clone(i.fix.cfg),{nextRowId:100});
    const left=W.tableRows(r.table).map(x=>x.join('|'));
    eq(t.n-r.table.n,i.count,'removed vs count');
    ok(left.indexOf('Total shipping|5')!==-1&&left.indexOf('Total|100')===-1,'left '+JSON.stringify(left))
  });
  test('A8 case variants are unified to the most common spelling',()=>{
    const v=[];for(let k=0;k<4;k++)v.push('USA','Paris');v.push('usa','usa','paris','paris');
    const t=W.tableFromRows(['place'],v.map(x=>[x]));
    const i=W.issues(t,{}).find(x=>x.kind==='caseVariants');
    ok(i&&i.fix,'caseVariants issue');
    const r=W.OPS[i.fix.opId].apply(t,W.clone(i.fix.cfg),{nextRowId:100});
    let changed=0;for(let k=0;k<t.n;k++)if(t.data[0][k]!==r.table.data[0][k])changed++;
    eq(changed,i.count,'changed vs count');
    eq(Array.from(new Set(r.table.data[0])).sort(),['Paris','USA']);
    eq(W.describeStep(i.fix),'Unify capitals (2 values) in "place"')
  });
  test('A8 row text condition round-trips',()=>{
    const cfg={mode:'remove',match:'all',conditions:[{col:'@row',op:'matches',value:'^page \\d+$',caseSensitive:false}]};
    eq(W.parseStepLine(W.OPS.filterRows.toDsl(cfg)).cfg,cfg);
    eq(W.missingCols(W.tableFromRows(['a'],[]),['@row']),[])
  });
  test('A9 title case does not capitalise after every apostrophe',()=>{
    eq(W.titleCase('don\'t stop'),'Don\'t Stop');
    eq(W.titleCase('o\'brien'),'O\'Brien');
    eq(W.titleCase('it\'s'),'It\'s');
    eq(W.titleCase('ADA lovelace-byron'),'Ada Lovelace-Byron')
  });
  test('A10 merge with drop originals keeps the first column position',()=>{
    const t=W.tableFromRows(['a','b','c'],[['x','y','z']]);
    const r=W.OPS.merge.apply(t,{columns:['a','b'],joiner:' ',into:'ab',skipBlank:true,keepOriginal:false},{nextRowId:10});
    eq(r.table.cols,['ab','c']);
    eq(W.tableRows(r.table),[['x y','z']]);
    const k=W.OPS.merge.apply(t,{columns:['a','b'],joiner:' ',into:'ab',skipBlank:true,keepOriginal:true},{nextRowId:10});
    eq(k.table.cols,['a','b','ab','c'])
  });
  test('A11 database row-count footers are skipped with a warning',()=>{
    ['07 MySQL box','08 psql table'].forEach(nm=>{
      const f=(G.WEFT_FIXTURES||[]).find(x=>x.name===nm);const text=f.text();
      const t=W.applyReading(text,W.detectReadings(text,{}).readings[0],{});
      eq(t.n,3,nm+' rows');
      ok((t.warnings||[]).some(w=>/Skipped 1 line below the table/.test(w)),nm+' warnings '+JSON.stringify(t.warnings))
    });
    const rows=[];for(let i=1;i<=8;i++)rows.push(['item '+i,String(i)]);rows.push(['5 rows in set (0.01 sec)','']);
    const i=W.issues(W.tableFromRows(['a','b'],rows),{}).find(x=>x.kind==='artifacts');
    ok(i&&i.count===1,'artifact issue '+JSON.stringify(i&&i.count))
  });
  test('A12 fmtNum keeps the minus sign and tiny numbers',()=>{
    eq(W.fmtNum(-0.5),'-0.5');
    eq(W.fmtNum(0.00001),'0.00001');
    eq(W.fmtNum(1234.5),'1,234.5');
    eq(W.fmtNum(-1234.567),'-1,234.57');
    eq(W.fmtNum(0),'0');
    eq(W.fmtNum(-3),'-3')
  });
  test('A13 regex safety scanner',()=>{
    ['(a|aa)+$','((a+))+','(?:(\\w+))*$','(a{1,})+','(?<n>a|b)*','(a|b){2,}'].forEach(x=>ok(W.isUnsafeRegexSource(x),'should be unsafe: '+x));
    ['\\d{4}-\\d{2}-\\d{2}','^(\\d{3})-(\\d{4})$','^(total|totals|sum)\\b','(foo|bar)','(?:ab)?c','[(a|b)+]x','\\(a|b\\)+'].forEach(x=>ok(!W.isUnsafeRegexSource(x),'should be safe: '+x));
    ok(!W.isUnsafeRegexSource(W.JUNK_ARTIFACT_SRC)&&!W.isUnsafeRegexSource(W.TOTAL_SRC),'built-in patterns');
    let msg='';try{W.parseStepLine('remove rows where "a" matches /(a|aa)+$/')}catch(e){msg=e.message}
    ok(/freeze/.test(msg),'recipe import rejects it: '+msg)
  });
  test('C3 formula guard skips numbers but still guards formulas',()=>{
    const g=v=>W.toDelimited(null,[[v]],',',{formulaGuard:true});
    ['-12.50','+44 20 7946 0958','-1,234.5','+5'].forEach(v=>ok(g(v)===(v.indexOf(',')!==-1?'\"'+v+'\"':v),'should not be prefixed: '+v+' -> '+g(v)));
    ['=1+1','@SUM(A1)','+cmd','-2+3','+1+1'].forEach(v=>ok(g(v).charAt(0)==='\''||g(v).slice(0,2)==='\"\''||g(v).indexOf('\'')===0,'should be prefixed: '+v+' -> '+g(v)));
    eq(W.toDelimited(null,[['=1+1']],',',{formulaGuard:false}),'=1+1')
  });
  test('C5 replace validates the pattern as it will run',()=>{
    const v=(wholeCell,n)=>W.OPS.replace.validate({columns:['*'],find:'a'.repeat(n),replace:'',regex:true,wholeCell,matchCase:false},null);
    eq(v(false,197),null);
    ok(v(true,197)!==null,'a whole-cell pattern that grows past 200 characters must be refused');
    eq(v(true,190),null);
    let threw=false;try{W.OPS.replace.apply(W.tableFromRows(['c'],[['x']]),{columns:['*'],find:'a'.repeat(197),replace:'',regex:true,wholeCell:true,matchCase:false},{})}catch(e){threw=true}
    ok(threw,'running it does throw, which is why validate must catch it')
  });
  test('C8 convertType and dead-code removals keep behaviour',()=>{
    const conv=(v,frac)=>W.tableRows(W.OPS.convertType.apply(W.tableFromRows(['c'],[[v]]),{column:'c',to:'number',locale:'us',percentAsFraction:!!frac},{}).table)[0][0];
    eq([conv('12%',false),conv('12%',true),conv('1,234.5',false)],['12','0.12','1234.5']);
  });
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
  (G.WEFT_MULTI_FIXTURES||[]).forEach(f=>{
    test('multi '+f.name,()=>{
      if(f.samples){
        G.WEFT_SAMPLE_NAMES().forEach(k=>{const r=W.findTables(W.makeSample(k).text,{htmlTables:null});ok(r.split===false,'sample '+k+' split into '+r.tables.length+' ('+r.reason+')')});
        return
      }
      const r=W.findTables(f.text(),{htmlTables:f.html||null});
      const x=f.expect;
      eq(r.split,x.split,'split ('+r.reason+')');
      if(x.count!=null)eq(r.tables.length,x.count,'count');
      if(x.titles)eq(r.tables.map(t=>t.title),x.titles,'titles');
      if(x.kinds)eq(r.tables.map(t=>t.kind),x.kinds,'kinds');
      if(x.skipped!=null)eq(r.skipped,x.skipped,'skipped');
      if(x.truncated!=null)eq(r.truncated,x.truncated,'truncated');
      if(x.total!=null)eq(r.total,x.total,'total');
      if(x.htmlOrder)eq(r.tables.map(t=>t.htmlIndex),x.htmlOrder,'html order')
    })
  });
  test('no split on existing fixtures',()=>{
    (G.WEFT_FIXTURES||[]).forEach(f=>{
      const r=W.findTables(f.text(),{htmlTables:f.html||null});
      ok(r.split===false,f.name+' split into '+r.tables.length)
    })
  });
  test('countFields quotes',()=>{
    eq(W.countFields('"a,b",c',',',{q:false}).n,2);
    eq(W.countFields('"x',',',{q:false}).open,true);
    eq(W.recordWidths(['"a','b",c','d,e'],0,3,',').map(r=>r.n),[2,2])
  });
  test('sliceLines',()=>{eq(W.sliceLines(['a','b','c'],1,3),'b\nc')});
  test('sessions isolated',()=>{
    const E=W.Engine;
    E.handle('tableReset',{id:'t1'});E.handle('load',{text:'a,b\n1,2'});
    E.handle('tableNew',{id:'t2'});E.handle('load',{text:'x,y\n1,2\n2,3\n3,4'});
    E.handle('setPipeline',{steps:[{opId:'trim',cfg:{columns:['*'],collapse:true}}]});
    E.handle('tableUse',{id:'t1'});
    eq(W.E.steps.length,0);
    const l=E.handle('tableList',{}).tables;
    const a=l.find(t=>t.id==='t1'),b=l.find(t=>t.id==='t2');
    eq([a.rows,b.rows,b.steps],[1,3,1])
  });
  test('view keys unique across sessions',()=>{
    const E=W.Engine;
    E.handle('tableUse',{id:'t1'});const a=E.handle('setView',{});
    E.handle('tableUse',{id:'t2'});const b=E.handle('setView',{});
    ok(a.key!==b.key,'same key');
    let th=false;try{E.handle('getRows',{viewKey:a.key,start:0,count:5})}catch(e){th=/out of date/.test(e.message)}
    ok(th,'cross-session view did not throw')
  });
  test('setCtx reaches every session',()=>{
    const E=W.Engine;
    E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy'});
    const txt='d,n\n01/02/2025,1\n03/04/2025,2\n13/4/2025,3\n14/5/2025,4';
    const conv=[{id:'c',opId:'convertType',cfg:{column:'d',to:'date',locale:'auto',percentAsFraction:false},muted:false}];
    E.handle('load',{text:txt});E.handle('setPipeline',{steps:conv,fromIndex:0});
    E.handle('tableNew',{id:'t2'});E.handle('load',{text:txt});E.handle('setPipeline',{steps:conv,fromIndex:0});
    const info=()=>{
      const ty=E.handle('schema',{}).cols[0].type;
      const i=E.handle('issues',{stateIdx:0}).issues.find(x=>x.kind==='ambiguousDates');
      const v=E.handle('setView',{stateIdx:1,search:'',sort:[],filter:null,rowIds:null});
      const cell=E.handle('getRows',{viewKey:v.key,start:0,count:1}).rows[0][0];
      return ty+'|'+(i?(/read as month\/day/.test(i.detail)?'mdy':/read as day\/month/.test(i.detail)?'dmy':'?'):'none')+'|'+cell
    };
    const before=[info()];
    E.handle('tableUse',{id:'t1'});before.push(info());
    E.handle('setCtx',{dateOrder:'dmy'});
    const after=[info()];
    E.handle('tableUse',{id:'t2'});after.push(info());
    E.handle('setCtx',{dateOrder:'mdy'});
    eq(before,['date|mdy|2025-01-02','date|mdy|2025-01-02']);
    eq(after,['date|dmy|2025-02-01','date|dmy|2025-02-01'])
  });
  test('exportTable keeps active',()=>{
    const E=W.Engine;
    E.handle('tableReset',{id:'t1'});E.handle('load',{text:'a,b\n1,2'});
    E.handle('tableNew',{id:'t2'});E.handle('load',{text:'x,y\n1,2\n2,3'});
    eq(E.handle('exportTable',{id:'t1',format:'tsv',options:{header:true}}).text,'a\tb\n1\t2\n');
    eq(E.handle('tableList',{}).active,'t2')
  });
  test('tableClose active falls back',()=>{
    const E=W.Engine;
    E.handle('tableClose',{id:'t2'});
    const a=E.handle('tableList',{}).active;
    ok(W.E===W.T.map.get(a),'engine not on the active table');eq(a,'t1')
  });
  test('findTables fast on stress',()=>{
    const s=W.makeStress(200000).text;const t0=Date.now();
    const r=W.findTables(s);const ms=Date.now()-t0;
    eq(r.split,false);ok(ms<150,'took '+ms+' ms')
  });
  test('B3 chooseReading round-trip',()=>{
    const E=W.Engine;E.handle('tableReset',{id:'t1'});
    const a=E.handle('load',{text:'a;b\n1;2',hint:{kind:'delimited',params:{delimiter:','}}});
    const b=E.handle('chooseReading',{reading:{kind:'delimited',params:{delimiter:';'}}});
    eq([a.baseSchema.cols.length,b.baseSchema.cols.length],[1,2])
  });
  test('B6 views cleared on reading change',()=>{
    const E=W.Engine;E.handle('tableReset',{id:'t1'});
    const r=E.handle('load',{text:'a;b\n1;2\n3;4'});const v=E.handle('setView',{});
    E.handle('chooseReading',{index:r.readings.length>1?1:0});
    let th=false;try{E.handle('getRows',{viewKey:v.key,start:0,count:5})}catch(e){th=/out of date/.test(e.message)}
    ok(th,'stale view key still worked')
  });
  test('B7 long cell marked',()=>{
    const E=W.Engine;E.handle('tableReset',{id:'t1'});
    E.handle('load',{text:'a,b\n'+'x'.repeat(1500)+',1\nq,2'});const v=E.handle('setView',{});
    const c=E.handle('getRows',{viewKey:v.key,start:0,count:5}).rows[0][0];
    eq([c.length,c.slice(-1)],[1001,'…'])
  });
  test('failed load keeps the table',()=>{
    const E=W.Engine;E.handle('tableReset',{id:'t1'});
    E.handle('load',{text:'a,b\n1,2\n3,4'});E.handle('setPipeline',{steps:[{opId:'trim',cfg:{columns:['*'],collapse:true}}]});
    const v0=E.handle('setView',{});
    let th=false;try{E.handle('load',{text:'   \n  '})}catch(e){th=/nothing to read/.test(e.message)}
    ok(th,'load did not throw');
    eq([W.E.steps.length,W.E.states.length],[1,2]);
    const v=E.handle('setView',{});
    eq(E.handle('getRows',{viewKey:v.key,start:0,count:5}).rows,[['1','2'],['3','4']]);
    let old=false;try{E.handle('getRows',{viewKey:v0.key,start:0,count:5});old=true}catch(e){old=false}
    ok(old,'views from before the failed load were dropped')
  });
  test('refLoad refreshes joins in every table',()=>{
    const E=W.Engine;E.handle('tableReset',{id:'t1'});
    E.handle('load',{text:'id,name\n1,Ann\n2,Bob'});
    E.handle('refLoad',{text:'id,score\n1,90\n2,85',name:'scores'});
    E.handle('setPipeline',{steps:[{opId:'join',cfg:{refName:'scores',type:'left',onLeft:['id'],onRight:['id'],columns:['score'],normTrim:true,normCaseFold:false,normNumeric:true,onDuplicate:'first'}}]});
    E.handle('tableNew',{id:'t2'});E.handle('load',{text:'x\n1'});
    E.handle('refLoad',{text:'id,score\n1,11\n2,22',name:'scores',replace:true});
    const t=E.handle('exportTable',{id:'t1',format:'tsv',options:{header:true}}).text;
    eq(t,'id\tname\tscore\n1\tAnn\t11\n2\tBob\t22\n');
    eq(E.handle('tableList',{}).active,'t2')
  });
  test('table readers skip lines above the table',()=>{
    const E=W.Engine;
    const cases=[
      ['markdown','Q2 report\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |',2,1],
      ['markdown, two lines','Report\nQ2\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |',2,2],
      ['markdown, underlined title','Title\n-----\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |',2,1],
      ['mysql','Q2 report\n+---+---+\n| a | b |\n+---+---+\n| 1 | 2 |\n| 3 | 4 |\n+---+---+',2,1],
      ['psql','Q2 report\n a | b\n---+---\n 1 | 2\n 3 | 4',2,1]
    ];
    cases.forEach(c=>{
      const r=E.handle('load',{text:c[1]});
      eq(r.baseSchema.cols.map(x=>x.name),['a','b'],c[0]+' columns');
      eq(r.baseSchema.n,c[2],c[0]+' rows');
      ok(r.warnings.some(w=>w==='Skipped '+c[3]+(c[3]===1?' line':' lines')+' above the table.'),c[0]+' warning: '+JSON.stringify(r.warnings))
    })
  });
  test('table readers unchanged when nothing sits above the table',()=>{
    const E=W.Engine;
    const a=E.handle('load',{text:'| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\nSource: x'});
    eq([a.baseSchema.cols.map(x=>x.name),a.baseSchema.n,a.warnings],[['a','b'],3,[]]);
    const b=E.handle('load',{text:'plain one\nplain two\nplain three',hint:{kind:'markdown-table'}});
    ok(b.warnings.every(w=>!/Skipped/.test(w)),'plain text got a skip warning');
    const c=E.handle('load',{text:'+---+---+\n| a | b |\n+---+---+\n| 1 | 2 |\n+---+---+\n1 rows in set (0.00 sec)'});
    eq([c.baseSchema.cols.map(x=>x.name),c.baseSchema.n,c.warnings.filter(w=>/above the table/.test(w))],[['a','b'],1,[]])
  });
  test('titled markdown tables split cleanly',()=>{
    const f=G.WEFT_MULTI_FIXTURES.find(x=>/^M22/.test(x.name));
    const t=f.text(),lines=W.normalizeInput(t).split('\n'),r=W.findTables(t,{});
    eq(r.tables.length,2);
    const E=W.Engine;
    const a=E.handle('load',{text:W.sliceLines(lines,r.tables[0].from,r.tables[0].to)});
    const b=E.handle('load',{text:W.sliceLines(lines,r.tables[1].from,r.tables[1].to)});
    eq([a.baseSchema.cols.map(x=>x.name),a.baseSchema.n],[['a','b'],2]);
    eq([b.baseSchema.cols.map(x=>x.name),b.baseSchema.n],[['x','y','z'],2])
  });
  test('A14 date order change drops stale views and refreshes issues',()=>{
    const E=W.Engine;
    E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy'});
    E.handle('load',{text:'date,n\n01/02/2024,1\n31/01/2024,2\n15/02/2024,3\n03/04/2024,4\n12/12/2024,5\n20/03/2024,6\n25/04/2024,7\n05/06/2024,8\n07/08/2024,9\n09/10/2024,10'});
    const v=E.handle('setView',{stateIdx:0,sort:[],search:'',filter:null,rowIds:null});
    const amb=()=>{const i=E.handle('issues',{stateIdx:0}).issues.find(x=>x.kind==='ambiguousDates');return i?i.detail:''};
    ok(/read as month\/day/.test(amb()),'before '+amb());
    E.handle('setCtx',{dateOrder:'dmy'});
    let stale=false;try{E.handle('getRows',{viewKey:v.key,start:0,count:5})}catch(e){stale=/out of date/.test(e.message)}
    ok(stale,'old view should be gone');
    ok(/read as day\/month/.test(amb()),'after '+amb());
    E.handle('setCtx',{dateOrder:'mdy'})
  });
  test('B11 removing a reference re-runs the steps that use it',()=>{
    const E=W.Engine;E.handle('tableReset',{id:'t1'});
    E.handle('load',{text:'id,name\n1,Ada\n2,Bob'});
    E.handle('refLoad',{text:'id,city\n1,Cairo',name:'cities_b11',replace:true});
    const cfg={refName:'cities_b11',type:'left',onLeft:['id'],onRight:['id'],columns:['city'],normTrim:true,normCaseFold:false,normNumeric:false,onDuplicate:'first'};
    const r=E.handle('setPipeline',{steps:[{id:'j',opId:'join',cfg,muted:false}],fromIndex:0});
    ok(!r.stepsMeta[0].error,'join error before: '+r.stepsMeta[0].error);
    E.handle('refRemove',{name:'cities_b11'});
    const info=E.handle('pipelineInfo',{});
    ok(/not loaded/.test(info.stepsMeta[0].error||''),'after removal: '+JSON.stringify(info.stepsMeta[0].error));
    E.handle('tableReset',{id:'t1'})
  });
  test('C1 reshape previews do not list removed rows',()=>{
    const E=W.Engine;E.handle('tableReset',{id:'t1'});
    E.handle('load',{text:'k,v\na,1\na,2\nb,3\nb,4'});
    const agg=E.handle('preview',{step:{opId:'aggregate',cfg:{groupBy:['k'],metrics:['count']}}});
    ok(!agg.error&&agg.n1<agg.n0&&agg.removedSample.length===0,'aggregate sample '+JSON.stringify(agg.removedSample)+' '+agg.error);
    const rm=E.handle('preview',{step:{opId:'filterRows',cfg:{mode:'remove',match:'all',conditions:[{col:'k',op:'equals',value:'a',caseSensitive:false}]}}});
    ok(!rm.error&&rm.removedSample.length===2,'filter sample '+JSON.stringify(rm.removedSample)+' '+rm.error);
    E.handle('tableReset',{id:'t1'})
  });
  test('C2 only the two newest search indexes are kept',()=>{
    const E=W.Engine;E.handle('tableReset',{id:'t1'});
    E.handle('load',{text:'a,b\n x ,1\ny,2\nz,3'});
    E.handle('setPipeline',{steps:[{id:'a',opId:'trim',cfg:{columns:['*'],collapse:true},muted:false},{id:'b',opId:'case',cfg:{columns:['a'],mode:'upper'},muted:false}],fromIndex:0});
    for(let i=0;i<3;i++)for(const q of ['x','y'])E.handle('setView',{stateIdx:i,search:q,sort:[],filter:null,rowIds:null});
    const st=W.E.states;
    ok(st.length===3&&!st[0]._search&&!!st[1]._search&&!!st[2]._search,'indexes '+st.map(t=>!!t._search).join(','));
    const r=E.handle('setView',{stateIdx:0,search:'x',sort:[],filter:null,rowIds:null});
    ok(r.n===1,'search still works on the oldest state: '+r.n);
    E.handle('tableReset',{id:'t1'})
  });
  test('reset tables',()=>{W.Engine.handle('tableReset',{id:'t1'})});
  return results
};
})(typeof self!=='undefined'?self:globalThis);
