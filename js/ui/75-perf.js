'use strict';
const Perf={
  BUDGET:{load:3000,trim:600,sort:900,search:250,scroll:100,longtask:50},
  async run(nRows){
    nRows=nRows||200000;
    if(S.loaded&&S.steps.length&&!(await Dialog.confirm('Run the performance test?','This replaces your current data with 200,000 generated rows. Your recipe stays in autosave.','Run test')))return;
    const out=[];const long=[];let obs=null;
    if(window.PerformanceObserver&&PerformanceObserver.supportedEntryTypes&&PerformanceObserver.supportedEntryTypes.indexOf('longtask')!==-1){obs=new PerformanceObserver(l=>l.getEntries().forEach(e=>long.push({t:e.startTime,d:e.duration})));obs.observe({entryTypes:['longtask']})}
    const mark=()=>performance.now();
    const phases=[];
    const time=async(label,budgetKey,fn,note)=>{const t0=mark();await fn();const ms=mark()-t0;phases.push({label,t0,t1:mark()});out.push({label,ms,budget:this.BUDGET[budgetKey],note});return ms};
    Toast.show('Running the performance test. This takes a few seconds.');
    const st=await Input.stageStress(nRows);
    const bytes=st.bytes;
    await sleep(50);
    await time('Read and detect '+fmtBytes(bytes)+' of CSV ('+fmtInt(nRows)+' rows)','load',async()=>{await Input.loadStaged(st.fileName);for(let i=0;i<100&&(!Grid.pages.has(0)||Grid.autoFitPending);i++)await sleep(20);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await sleep(30)});
    const afterLoad=mark();this.afterLoad=afterLoad;
    await time('Trim whitespace on all columns','trim',()=>addStep('trim',{columns:['*'],collapse:true},{silent:true}));
    await time('Sort by "amount" (as a step)','sort',()=>addStep('sortRows',{keys:[{col:'amount',dir:'desc',type:'auto'}]},{silent:true}));
    await time('Remove rows where "payment_status" is "paid"','sort',()=>addStep('filterRows',{mode:'remove',match:'all',conditions:[{col:'payment_status',op:'equals',value:'paid',caseSensitive:false}]},{silent:true}));
    await time('Search rows for "lovelace"','search',async()=>{S.search='lovelace';await refreshView()});
    S.search='';await refreshView();
    await time('Fetch a page of rows while scrolling (middle of the table)','scroll',async()=>{const pi=Math.floor(S.view.n/2/256);Grid.pages.delete(pi);await Grid.fetchPage(pi)});
    await time('Undo the last step','trim',()=>doUndo());
    await sleep(60);
    if(obs)obs.disconnect();
    const lt=long.filter(e=>e.t>=afterLoad);
    const worst=lt.reduce((m,e)=>Math.max(m,e.d),0);
    this.longTasks=lt.map(e=>{const p=phases.find(p=>e.t>=p.t0-5&&e.t<=p.t1+5);return{d:Math.round(e.d),t:Math.round(e.t),phase:p?p.label:'between steps'}});
    this.show(out,{engine:Engine.mode,worst,longCount:lt.length,supported:!!obs,bytes})
  },
  show(rows,info){
    const pass=r=>r.ms<=r.budget;
    const tbl=h('table',{class:'mini-table',style:{fontSize:'12.5px'}},
      h('thead',{},h('tr',{},h('th',{style:{width:'52%'}},'Action'),h('th',{},'Time'),h('th',{},'Budget'),h('th',{},'Result'))),
      h('tbody',{},rows.map(r=>h('tr',{},h('td',{title:r.label},r.label),h('td',{},fmtMs(r.ms)),h('td',{},'≤ '+fmtMs(r.budget)),h('td',{style:{color:pass(r)?'var(--sage)':'var(--rose)',fontWeight:'650'}},pass(r)?'Within budget':'Over budget')))));
    const lines=[];
    if(info.supported)lines.push(info.worst>50?'Longest freeze of the page after loading: '+fmtMs(info.worst)+' ('+plural(info.longCount,'long task')+'). Budget: 50 ms.':'No freezes over 50 ms after loading ('+plural(info.longCount,'long task')+').');
    else lines.push('This browser cannot measure page freezes (long tasks). Try Chrome or Edge for that part.');
    lines.push(info.engine==='worker'?'The background engine was used, so heavy work stayed off the page.':'The engine ran on the main thread (no background worker), so the page may freeze during heavy steps. Open Weft from a web server rather than from a file to enable the worker.');
    const ok=rows.filter(pass).length;
    const report=['Weft performance test',new Date().toISOString(),navigator.userAgent,'Engine: '+info.engine,''].concat(rows.map(r=>r.label+': '+Math.round(r.ms)+' ms (budget '+r.budget+' ms) '+(pass(r)?'OK':'OVER'))).concat(['',lines.join(' ')]).join('\n');
    const body=h('div',{class:'dlg-body'},h('p',{class:'dlg-note'},ok+' of '+rows.length+' actions finished within budget on this device.'),h('div',{class:'mini-wrap',style:{maxHeight:'none'}},tbl),lines.map(l=>h('p',{class:'dlg-note',style:{marginTop:'12px'}},l)));
    const d=Dialog.open({title:'Performance test results',cls:'mid',body,foot:[h('span',{class:'grow-1'},'Times depend on your device and browser.'),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>copyText(report,'Copied the report')},icon('copy',16),'Copy report'),h('button',{class:'btn btn-primary',type:'button',onclick:()=>d.close()},'Done')]});
    window.WEFT_PERF={rows,info}
  }
};
function fmtMs(ms){return ms<1000?Math.round(ms)+' ms':(ms/1000).toFixed(2)+' s'}
