(function(){
const log=(...a)=>console.log('[UI] '+a.join(' '));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms){const t=Date.now();while(Date.now()-t<(ms||8000)){try{if(fn())return true}catch(e){}await wait(50)}return false}
const mode=(location.hash.match(/t=(\w+)/)||[])[1]||window.UI_MODE||'full';
async function run(){
  await until(()=>Engine.mode!=='none',5000);
  const results=[];const ok=(n,c,extra)=>{results.push([n,!!c]);log((c?'PASS ':'FAIL ')+n+(extra?' :: '+extra:''))};
  try{
    await Input.loadSample('vendor');
    await until(()=>S.loaded&&Grid.pool.length>0);
    ok('vendor loaded',S.loaded,S.reading.label+' '+S.baseSchema.n+' rows '+S.baseSchema.cols.map(c=>c.name).join('|'));
    await wait(300);
    await Inspector.renderIssues($('#inspBody'));
    ok('issues found',Inspector.issues.length>0,Inspector.issues.map(i=>i.kind).join(','));
    const hdr=Inspector.issues.find(i=>i.kind==='header'||i.kind==='title');
    if(hdr){await addStep(hdr.fix.opId,hdr.fix.cfg);ok('header fix applied',S.steps.length===1,curCols().join('|'))}
    await Inspector.renderIssues($('#inspBody'));
    for(const k of ['repeatedHeader','totals']){await Inspector.renderIssues($('#inspBody'));const is=Inspector.issues.find(i=>i.kind===k);if(is){await addStep(is.fix.opId,is.fix.cfg);ok('fix '+k,true,'rows now '+finalN())}else ok('fix '+k+' present',false,Inspector.issues.map(i=>i.kind).join(','))}
    const n0=finalN();
    await Sel.rangeRows(2,4,false);
    ok('3 rows selected',Sel.rowCount()===3);
    await deleteSelection();
    ok('delete 3 rows',finalN()===n0-3,finalN()+' vs '+(n0-3));
    await doUndo();
    ok('undo restores',finalN()===n0);
    Sel.selectAllRows();await keepSelection();ok('keep all no-op',finalN()===n0);
    await addStep('filterRows',{mode:'remove',match:'all',conditions:[{col:'amount',op:'isEmpty',caseSensitive:false}]});
    ok('filter amount empty',finalN()<n0,(n0-finalN())+' removed');
    const txt=await Recipes.text();ok('recipe text',txt.indexOf('remove rows where "amount" is empty')!==-1,txt.split('\n').length+' lines');
    Palette.open('remove duplicates');ok('palette dedupe',Palette.items[0]&&Palette.items[0].id==='rows.dedupe',Palette.items.slice(0,3).map(c=>c.id).join(','));
    Palette.input.value='delete rows';Palette.q='delete rows';Palette.render();ok('palette delete rows',Palette.items.some(c=>c.id==='rows.deleteSelected')&&Palette.items.some(c=>c.id==='rows.removeWhere'),Palette.items.slice(0,4).map(c=>c.id+':'+(c._w===true)).join(','));
    Palette.input.value='unpivot';Palette.q='unpivot';Palette.render();ok('palette unpivot',Palette.items[0]&&Palette.items[0].id==='reshape.wideToLong');
    Palette.input.value='';Palette.q='';Palette.render();
    const pl=Palette.list;ok('palette scrollable',pl.scrollHeight>pl.clientHeight,pl.scrollHeight+'>'+pl.clientHeight);
    Palette.close();
    const ids=new Set();GROUPS.forEach(g=>{Menus.groupEntries(g).forEach(function f(e){if(typeof e==='string')return;if(Array.isArray(e.sub))e.sub.forEach(f);else if(e.id)ids.add(e.id)})});
    const missing=Array.from(ids).filter(id=>!Commands.get(id));ok('menu items registered',!missing.length);
    const hov=$$('.gh button, .step-card button').filter(b=>getComputedStyle(b).opacity==='0');ok('no hidden controls',!hov.length);
    const ctxs=[{hasData:false,sel:{kind:'none',rowCount:0,colCount:0,cellCount:0}},{hasData:true,sel:{kind:'none',rowCount:0,colCount:0,cellCount:0}},{hasData:true,sel:{kind:'rows',rowCount:3,colCount:0,cellCount:0}},{hasData:true,sel:{kind:'cols',rowCount:0,colCount:1,cellCount:0}}];
    const badWhen=Commands.list.filter(c=>ctxs.some(x=>{const w=Commands.when(c,x);return!(w===true||(typeof w==='string'&&w.length))}));ok('when() contract',!badWhen.length,badWhen.map(c=>c.id).join(','));
    Sel.clear();
    await Engine.call('load',{text:'<img src=x onerror="window.__xss=1">,b\n"<script>window.__xss=2<\/script>",2'}).then(r=>applyLoad(r));await wait(400);
    ok('xss safe',window.__xss===undefined);
    await Input.loadSample('terminal');await until(()=>S.reading&&S.reading.kind==='fixed-width');ok('docker fixed-width',S.reading.kind==='fixed-width',curCols().join('|'));
    const ex=await Engine.call('export',{scope:'final',format:'csv',options:{header:true}});ok('export csv',ex.rows===25&&ex.text.split('\n')[0].indexOf('CONTAINER ID')!==-1,ex.rows+' rows '+ex.text.slice(0,60));
    await Input.loadSample('contacts');ok('contacts kv',S.reading.kind==='key-value-blocks',curCols().join('|'));
    await Input.loadSample('log');ok('log reading',/log/.test(S.reading.kind),S.reading.kind+' '+curCols().join('|'));
    if(curCols().indexOf('level')!==-1){await addStep('filterRows',{mode:'remove',match:'all',conditions:[{col:'level',op:'equals',value:'DEBUG',caseSensitive:false}]});await addStep('sortRows',{keys:[{col:'timestamp',dir:'desc',type:'auto'}]});ok('log steps',S.steps.length===2&&!S.meta.some(m=>m.error))}
    await Input.loadSample('web');ok('web table',S.reading.kind==='html-table',curCols().join('|')+' '+S.baseSchema.n);
    await Input.loadSample('json');ok('json',S.reading.kind==='json',S.baseSchema.n+' rows');
    let blocked=false;try{await fetch('data:,x')}catch(e){blocked=true}ok('csp blocks fetch',blocked);
  }catch(e){log('ERROR '+e.message+' '+e.stack)}
  const f=results.filter(r=>!r[1]);log('DONE '+(results.length-f.length)+'/'+results.length);
  if(mode==='shot'){}
}
if(mode!=='none')setTimeout(run,300);
})();
