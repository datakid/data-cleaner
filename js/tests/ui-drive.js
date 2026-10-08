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
    try{
      const X=await Xlsx.load();ok('xlsx library loads under CSP',!!X.utils,X.version);
      await Input.loadSample('vendor');
      const r=await Engine.call('export',{scope:'final',format:'xlsx',options:{header:true}});
      const d=JSON.parse(r.text);
      const ws=X.utils.aoa_to_sheet([d.cols].concat(d.rows));const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'T');
      const bin=X.write(wb,{type:'array',bookType:'xlsx'});
      ok('xlsx write',bin.byteLength>1000,bin.byteLength+' bytes');
      const f=new File([bin],'roundtrip.xlsx');
      const back=await Xlsx.readFile(f);
      await Input.loadText(back.text,'roundtrip.xlsx');
      ok('xlsx round-trip',S.baseSchema.n===d.rows.length+1||S.baseSchema.n===d.rows.length,S.reading.label+' '+S.baseSchema.n+' vs '+d.rows.length+' '+curCols().slice(0,3).join('|'));
      const types=d.types;ok('xlsx typed export info',types.length===d.cols.length,types.join(','))
    }catch(e){ok('xlsx',false,e.message)}
    const html=document.documentElement;
    setTheme('dark',true);ok('theme dark',html.getAttribute('data-theme')==='dark'&&WeftTheme.choice()==='dark'&&$('#themeSwitch [data-theme-opt="dark"]').getAttribute('aria-checked')==='true');
    setTheme('light',true);ok('theme light',html.getAttribute('data-theme')==='light'&&JSON.parse(localStorage.getItem('weft.prefs.v1')).theme==='light');
    setTheme('system',true);ok('theme system default',!html.hasAttribute('data-theme')&&WeftTheme.choice()==='system'&&Commands.get('view.theme.system').checked());
    Commands.run('view.contrast.high');await wait(50);ok('contrast high',html.getAttribute('data-contrast')==='high'&&getComputedStyle(html).getPropertyValue('--ink').trim().toUpperCase()==='#000000');
    Commands.run('view.contrast.normal');await wait(50);ok('contrast normal',!html.hasAttribute('data-contrast'));
    Commands.run('view.contrast.system');await wait(50);
    await Input.loadSample('vendor');await until(()=>S.loaded&&Grid.pages.has(0));
    const fb=$('.gh-fill.can');ok('fill bar clickable',!!fb);
    if(fb){const col=fb.closest('.gh').dataset.col;fb.click();await until(()=>S.vfilter);await wait(200);ok('fill bar filters empties',S.vfilter&&/is empty/.test(S.vfilter.label)&&S.view.n<S.view.total,col+' '+S.view.n+'/'+S.view.total);VFilter.clear();await wait(100)}
    let blocked=false;try{await fetch('data:,x')}catch(e){blocked=true}ok('csp blocks fetch',blocked);
  }catch(e){log('ERROR '+e.message+' '+e.stack)}
  const f=results.filter(r=>!r[1]);log('DONE '+(results.length-f.length)+'/'+results.length);
  if(mode==='shot'){}
}
const PROF={};
function wrap(obj,name,label){const f=obj[name];if(typeof f!=='function')return;obj[name]=function(){const t=performance.now();const r=f.apply(this,arguments);const done=()=>{const d=performance.now()-t;const p=PROF[label]||(PROF[label]={n:0,max:0,sum:0});p.n++;p.sum+=d;if(d>p.max)p.max=d};if(r&&typeof r.then==='function'){const t2=performance.now()-t;const p=PROF[label+' (sync part)']||(PROF[label+' (sync part)']={n:0,max:0,sum:0});p.n++;p.sum+=t2;if(t2>p.max)p.max=t2}else done();return r}}
const SLOWT=[];
if(/\[perf\d*\]/.test(document.title)&&!/nowrap/.test(document.title)){
  const oST=window.setTimeout;
  window.setTimeout=function(fn,ms){if(typeof fn!=='function')return oST.apply(window,arguments);const src=String(fn).slice(0,90).replace(/\s+/g,' ');const stack=(new Error().stack||'').split('\n').slice(2,4).map(s=>s.trim().replace(/https?:\/\/[^)]*\//,'')).join(' < ');return oST.call(window,function(){const t=performance.now();const r=fn.apply(this,arguments);const d=performance.now()-t;if(d>25)SLOWT.push({d:Math.round(d),src,stack});const mc=new MessageChannel();mc.port1.onmessage=()=>{const full=performance.now()-t;if(full>45)SLOWT.push({d:Math.round(full),src:'TASK+microtasks '+src,stack})};mc.port2.postMessage(0);return r},ms)};
  const oRAF=window.requestAnimationFrame;
  window.requestAnimationFrame=function(fn){const src=String(fn).slice(0,60);return oRAF.call(window,function(ts){const t=performance.now();fn(ts);const d=performance.now()-t;if(d>25)SLOWT.push({d:Math.round(d),src:'rAF '+src,stack:''})})};
}
const MSGT=[];
if(/\[perf\d*\]/.test(document.title)&&!/nowrap/.test(document.title)){
  const oAdd=Worker.prototype.addEventListener;
  const desc=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage');
  Object.defineProperty(Worker.prototype,'onmessage',{set(fn){desc.set.call(this,function(e){const t=performance.now();fn.call(this,e);const mc=new MessageChannel();mc.port1.onmessage=()=>{const d=performance.now()-t;if(d>40){const res=e.data&&e.data.result;MSGT.push({d:Math.round(d),keys:res?Object.keys(res).slice(0,6).join(','):'',rows:res&&res.rows?res.rows.length:''})}};mc.port2.postMessage(0)})},get(){return desc.get.call(this)},configurable:true});
}
const LOAF=[];
try{new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(e.duration<50)return;LOAF.push({t:Math.round(e.startTime),d:Math.round(e.duration),block:Math.round(e.blockingDuration||0),layout:Math.round(e.styleAndLayoutStart?e.startTime+e.duration-e.styleAndLayoutStart:0),render:Math.round(e.renderStart?e.startTime+e.duration-e.renderStart:0),scripts:(e.scripts||[]).map(s=>({d:Math.round(s.duration),fl:Math.round(s.forcedStyleAndLayoutDuration||0),inv:s.invoker,src:(s.sourceURL||'').split('/').pop()+':'+(s.sourceFunctionName||'')+'@'+s.sourceCharPosition})).filter(s=>s.d>3)})})).observe({type:'long-animation-frame',buffered:false})}catch(e){}
async function perf(){
  if(!/nowrap/.test(document.title))[[Grid,'reset','Grid.reset'],[Grid,'paint','Grid.paint'],[Grid,'autoFit','Grid.autoFit'],[Grid,'renderHead','Grid.renderHead'],[Rail,'render','Rail.render'],[Inspector,'renderIssues','Inspector.renderIssues'],[Status,'render','Status.render'],[ReadingBar,'render','ReadingBar.render'],[Scrub,'render','Scrub.render'],[Toolbar,'render','Toolbar.render'],[window,'cleanSteps','cleanSteps'],[Session,'save','Session.save'],[App,'showWorkspace','App.showWorkspace'],[W,'makeStress','makeStress'],[JSON,'parse','JSON.parse'],[JSON,'stringify','JSON.stringify']].forEach(a=>wrap(a[0],a[1],a[2]));
  const om=Engine.worker&&Engine.worker.onmessage;
  for(let i=0;i<200&&!Engine.ready;i++)await wait(50);
  const tr=performance.now();await Engine.ready;log('ENGINE ready after extra '+Math.round(performance.now()-tr)+'ms mode '+Engine.mode+' reason '+(Engine.fallbackReason||'-'));
  if(Engine.worker&&!/nowrap/.test(document.title)){const orig=Engine.worker.onmessage;Engine.worker.onmessage=function(e){const t=performance.now();const sz=JSON.stringify(e.data).length;if(sz>200000)log('BIGMSG '+Math.round(sz/1024)+'KB id '+e.data.id+' keys '+Object.keys(e.data.result||{}).join(','));orig.call(this,e);const d=performance.now()-t;const p=PROF['worker message handler']||(PROF['worker message handler']={n:0,max:0,sum:0});p.n++;p.sum+=d;if(d>p.max)p.max=d}}
  const po=Engine.worker&&Engine.worker.postMessage.bind(Engine.worker);
  if(po&&!/nowrap/.test(document.title))Engine.worker.postMessage=function(m){const t=performance.now();po(m);const d=performance.now()-t;const p=PROF['postMessage '+m.type]||(PROF['postMessage '+m.type]={n:0,max:0,sum:0});p.n++;p.sum+=d;if(d>p.max)p.max=d};
  const RES=[];const oc=Engine.call.bind(Engine);Engine.call=function(type,payload,ch){const t=performance.now();const p=oc(type,payload,ch);p.then(r=>RES.push({type,t:Math.round(t),d:Math.round(performance.now()-t),r}),()=>{});return p};
  window.__RES=RES;
  log('PERF engine '+Engine.mode);
  const t0=performance.now();
  const n=+(document.title.match(/\[perf(\d+)?\]/)[1]||200000);
  try{await Perf.run(n)}catch(e){log('PERF ERROR '+e.message);return}
  const p=window.WEFT_PERF;if(!p){log('PERF no result');return}
  p.rows.forEach(r=>log('PERF '+(r.ms<=r.budget?'OK   ':'OVER ')+Math.round(r.ms)+'ms / '+r.budget+'ms  '+r.label));
  (Perf.longTasks||[]).forEach(t=>log('PERF long task '+t.d+'ms @'+t.t+' during: '+t.phase));
  LOAF.filter(f=>(Perf.longTasks||[]).some(t=>Math.abs(t.t-f.t)<300)).forEach(f=>log('LOAF @'+f.t+' '+f.d+'ms block '+f.block+' rl '+f.render+' :: '+f.scripts.map(s=>s.d+'ms(f'+s.fl+') '+s.inv+' '+s.src).join(' | ')));
  log('PERF longest freeze '+Math.round(p.info.worst)+'ms, long tasks '+p.info.longCount+', supported '+p.info.supported);
  log('PERF total '+Math.round(performance.now()-t0)+'ms, final rows '+finalN());
  log('MSGS '+RES.filter(x=>x.t>=(Perf.afterLoad||0)-2000).map(x=>x.type+':'+Math.round(JSON.stringify(x.r||{}).length/1024)+'KB/'+x.d+'ms@'+x.t).join(' '));
  log('STEPMS '+S.meta.map(m=>m.ms).join(',')+' mode now '+Engine.mode+' reason '+Engine.fallbackReason);
  MSGT.forEach(m=>log('SLOWMSG '+m.d+'ms (incl. microtasks) result keys: '+m.keys+' rows:'+m.rows));
  SLOWT.filter(s=>s.d<1000).slice(0,0).forEach(s=>log('SLOWTIMER '+s.d+'ms :: '+s.src+' :: '+s.stack));
  LOAF.slice(0,0).forEach(f=>log('LOAF '+f.d+'ms block '+f.block+' render+layout '+f.render+' :: '+f.scripts.map(s=>s.d+'ms(forced '+s.fl+') '+s.inv+' '+s.src).join(' | ')));
  Object.keys(PROF).map(k=>[k,PROF[k]]).sort((a,b)=>b[1].max-a[1].max).slice(0,6).forEach(([k,p])=>log('PROF '+k+': max '+Math.round(p.max)+'ms, total '+Math.round(p.sum)+'ms, calls '+p.n))
}
if(/\[perf\d*\]/.test(document.title))setTimeout(perf,1000);
else if(mode!=='none')setTimeout(run,300);
})();
