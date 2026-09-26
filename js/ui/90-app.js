'use strict';
const App={
  showWorkspace(){
    $('#emptyView').classList.add('hidden');$('#workspace').classList.remove('hidden');
    $('#fileMeta').classList.remove('hidden');$('#searchBox').classList.remove('hidden');$('#btnExport').classList.remove('hidden');$('#btnRecipe').classList.remove('hidden');$('#btnNew').classList.remove('hidden');
    $('#fmtTag').textContent=(S.reading&&S.reading.kind||'').replace(/-/g,' ').toUpperCase();
    $('#fileName').textContent=S.file||'Pasted text';$('#fileName').title=S.file||'Pasted text';
    Toolbar.render()
  },
  reset(){
    S.loaded=false;S.steps=[];S.meta=[];S.states=[];S.viewIdx=0;S.undo=[];S.redo=[];S.sort=[];S.search='';S.vfilter=null;S.sourceText=null;
    Sel.clear(true);Grid.pool.forEach(r=>r.el.remove());Grid.pool=[];
    ['#workspace','#fileMeta','#searchBox','#btnExport','#btnRecipe','#btnNew','#readingBar','#toolbar','#scrub','#statusBar','#coach'].forEach(s=>$(s).classList.add('hidden'));
    $('#emptyView').classList.remove('hidden');$('#pasteArea').value='';$('#searchInput').value='';
    App.renderSession()
  },
  renderSession(){
    const el=$('#sessionBanner');const s=Session.get();
    if(!s||S.loaded){el.classList.add('hidden');return}
    el.classList.remove('hidden');clear(el).append(icon('clock',18),h('span',{},'Your last recipe ('+plural(s.steps.length,'step')+(s.fileName?', from '+s.fileName:'')+') is saved. Load a file to reapply it, or discard it.'),
      h('button',{type:'button',class:'btn btn-sm btn-primary',onclick:()=>{S.pendingRecipe={text:W.stepsToText(s.steps,s.source),opts:{name:'your last recipe'}};$('#fileInput').click()}},'Load a file to reapply'),
      h('button',{type:'button',class:'btn btn-sm btn-ghost',onclick:()=>{Session.discard();el.classList.add('hidden')}},'Discard'))
  },
  renderExamples(){
    const g=$('#examplesGrid');clear(g);
    Object.keys(W.SAMPLES).filter(k=>k!=='stress').forEach(k=>{const s=W.SAMPLES[k];g.append(h('button',{type:'button',class:'example-card',onclick:()=>Input.loadSample(k)},h('span',{class:'chip c-'+s.tone},s.badge),h('span',{class:'ex-title'},s.title),h('span',{class:'ex-sub'},s.sub)))})
  }
};

function onKey(e){
  if(e.isComposing)return;
  const key=e.key&&e.key.length===1?e.key.toLowerCase():e.key;
  const mod=isMac?e.metaKey:e.ctrlKey;
  const ed=isEditable(e.target);
  if(mod&&key==='k'){e.preventDefault();if(Palette.el)Palette.close();else Palette.open();return}
  if(key==='Escape'){if(Layers.stack.length){e.preventDefault();Layers.closeTop();return}if(!ed&&S.vfilter){VFilter.clear();return}if(!ed&&Sel.kind!=='none'){Sel.clear();return}return}
  if(ed)return;
  if(Layers.stack.length&&!Layers.has('halo'))return;
  if(key==='?'&&!mod){e.preventDefault();HelpSheet.open();return}
  if(mod&&key==='z'&&!e.shiftKey){e.preventDefault();Commands.run('recipe.undo');return}
  if(mod&&((key==='z'&&e.shiftKey)||key==='y')){e.preventDefault();Commands.run('recipe.redo');return}
  if(mod&&key==='f'&&S.loaded){e.preventDefault();Commands.run('view.search');return}
  if(mod&&key==='o'){e.preventDefault();Commands.run('file.open');return}
  if(mod&&key==='s'&&S.loaded){e.preventDefault();Commands.run('recipe.save');return}
  if(mod&&key==='e'&&S.loaded){e.preventDefault();Commands.run('file.export');return}
  if(mod&&key==='h'&&S.loaded){e.preventDefault();Commands.run('text.replace');return}
  if(mod&&e.shiftKey&&key==='c'&&S.loaded){e.preventDefault();Commands.run('file.copyAll');return}
  if(e.altKey&&(key==='ArrowLeft'||key==='ArrowRight')&&S.loaded&&document.activeElement===Grid.sc){e.preventDefault();Commands.run(key==='ArrowLeft'?'columns.moveLeft':'columns.moveRight');return}
  if(S.loaded&&document.activeElement!==Grid.sc&&!e.target.closest('.rail,.inspector,.toolbar,.app-header,.reading-bar,.scrub,.coach')){
    if(key==='Delete'||key==='Backspace'){if(Sel.kind!=='none'){e.preventDefault();deleteSelection()}return}
    if(mod&&key==='a'){e.preventDefault();Sel.selectAllRows();return}
    if(mod&&key==='c'&&Sel.kind!=='none'){e.preventDefault();copySelection();return}
  }
}

async function boot(){
  window.addEventListener('error',e=>{if(!e.message||/ResizeObserver/.test(e.message))return;reportError(e.message,e.error&&e.error.stack)});
  window.addEventListener('unhandledrejection',e=>{const r=e.reason;if(r&&r.stale)return;reportError(r&&r.message||String(r),r&&r.stack)});
  document.addEventListener('keydown',onKey,true);
  document.addEventListener('mousedown',e=>{if(Menus.el&&!e.target.closest('.menu')&&!e.target.closest('[aria-haspopup="menu"]'))Menus.close();if(Halo.el&&!e.target.closest('.halo'))Halo.close()});
  window.addEventListener('beforeunload',e=>{if(S.loaded&&S.steps.length&&S.sessionDirty){e.preventDefault();e.returnValue=''}});
  Grid.init();Inspector.init();Panels.init();Input.init();
  Recipes.migrate();
  App.renderExamples();App.renderSession();
  $('#cmdHint').textContent=MOD+'K';$('#searchHint').textContent=MOD+'F';$('#pasteHint').textContent='or press '+MOD+'V anywhere';
  $('#btnCommands').addEventListener('click',()=>Palette.open());
  $('#stressLink').addEventListener('click',()=>Perf.run());
  $('#btnExport').addEventListener('click',()=>Commands.run('file.export'));
  $('#btnNew').addEventListener('click',()=>Commands.run('file.new'));
  $('#btnHelp').addEventListener('click',()=>Commands.run('help.keys'));
  $('#btnRecipe').addEventListener('click',e=>{const b=e.currentTarget;if(Menus.anchor===b){Menus.close();return}const r=b.getBoundingClientRect();Menus.open(Commands.byGroup('Recipe').filter(c=>!/^recipe\.(undo|redo|up|down|edit|mute|delete)$/.test(c.id)).concat(['-',Commands.get('file.copyAll')]),r.right-260,r.bottom+6,b)});
  $('#btnAddStep').addEventListener('click',()=>Palette.open(''));
  $('#btnRailText').addEventListener('click',()=>openRecipeText());
  $('#btnRailSave').addEventListener('click',()=>Commands.run('recipe.save'));
  $('#btnRailLib').addEventListener('click',()=>Commands.run('recipe.library'));
  $('#scrubStart').addEventListener('click',()=>setViewIdx(0));$('#scrubEnd').addEventListener('click',()=>setViewIdx(S.steps.length));
  const si=$('#searchInput');
  si.addEventListener('input',debounce(()=>{S.search=si.value;refreshView()},150));
  si.addEventListener('keydown',e=>{if(e.key==='Escape'&&si.value){e.preventDefault();e.stopPropagation();si.value='';S.search='';refreshView()}else if(e.key==='Enter'){e.preventDefault();Grid.sc.focus()}});
  $('#btnSearchStep').addEventListener('click',()=>Commands.run('view.searchToStep'));
  $('#pillLocal').addEventListener('click',()=>Toast.show('Your data never leaves this browser tab. Network access is blocked by this page\'s security policy.'));
  S.dateOrder=Prefs.get('dateOrder','mdy');
  await Engine.init();
  if(S.dateOrder!=='mdy')await Engine.call('setCtx',{dateOrder:S.dateOrder});
  await readShareLink();
  if(Prefs.get('rememberData',false)){
    const d=await DataStore.get();
    if(d&&(d.text||d.html)){
      await Input.loadText(d.text,d.fileName,null);
      if(d.steps&&d.steps.length)await setPipeline(d.steps,0,{noUndo:true});
      Toast.show('Restored your data from this browser.')
    }
  }
  if(!S.loaded)setTimeout(()=>{const p=$('#pasteArea');if(p&&!matchMedia('(pointer:coarse)').matches)p.focus({preventScroll:true})},50)
}
function reportError(msg,stack){
  Toast.err('Something went wrong: '+msg,{action:{label:'Copy details',fn:()=>copyText(msg+'\n'+(stack||'')+'\nLast commands: '+S.lastCmds.join(', '),'Copied error details')}})
}
document.addEventListener('DOMContentLoaded',boot);
