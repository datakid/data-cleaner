'use strict';
const ExportDialog={
  open(){
    const viewDiffers=S.search||S.sort.length||S.vfilter||!atEnd();
    const rowSel=Sel.kind==='rows'&&Sel.rowCount()>0;const colSel=Sel.kind==='cols'&&Sel.cols.size>0;
    const st={format:'csv',scope:rowSel?'selected':'final',cols:colSel?'selected':'all',header:true,guard:true,excel:false,name:''};
    const base=(S.file||'').replace(/\.[^.]+$/,'')||'weft-export';
    const EXT={xlsx:'xlsx',csv:'csv',tsv:'tsv',json:'json',jsoncols:'json',ndjson:'ndjson',md:'md',lines:'txt'};
    const fname=h('input',{class:'input',style:{width:'100%'}});
    const setName=()=>{if(!st.nameTouched)fname.value=(S.file?base+'-clean':'weft-export')+'.'+EXT[st.format]};
    fname.addEventListener('input',()=>{st.nameTouched=true});
    const radio=(name,val,label,sub,checked,on)=>h('label',{class:'radio'},h('input',{type:'radio',name,value:val,checked,onchange:()=>{on(val);refresh()}}),h('span',{},label,sub?h('small',{},sub):null));
    const scopeBox=h('div');
    const summary=h('span',{class:'grow-1'});
    const guardBox=h('label',{class:'check'},h('input',{type:'checkbox',checked:st.guard,onchange:e=>{st.guard=e.target.checked}}),h('span',{},'Formula protection',h('small',{style:{display:'block',color:'var(--ink-mute)',fontSize:'12px'}},'Prefixes cells starting with = + - @ so spreadsheets don\'t run them')));
    const excelBox=h('label',{class:'check'},h('input',{type:'checkbox',checked:st.excel,onchange:e=>{st.excel=e.target.checked}}),'Excel-friendly (BOM and Windows line endings)');
    const refresh=()=>{
      clear(scopeBox);
      const fin=finalN();
      scopeBox.append(radio('scope','final','Final result ('+plural(fin,'row')+')',null,st.scope==='final',v=>st.scope=v));
      if(viewDiffers){const bits=[];if(!atEnd())bits.push(S.viewIdx===0?'original data':'at step '+S.viewIdx);if(S.search)bits.push('filtered by search');if(S.vfilter)bits.push('showing '+S.vfilter.label);if(S.sort.length)bits.push('sorted by '+S.sort[0].col);scopeBox.append(radio('scope','view','Current view ('+plural(S.view.n,'row')+')',bits.join(', '),st.scope==='view',v=>st.scope=v))}
      if(rowSel)scopeBox.append(radio('scope','selected','Selected rows ('+fmtInt(Sel.rowCount())+')',null,st.scope==='selected',v=>st.scope=v));
      guardBox.classList.toggle('hidden',!(st.format==='csv'||st.format==='tsv'));
      xlNote.classList.toggle('hidden',st.format!=='xlsx');excelBox.classList.toggle('hidden',!(st.format==='csv'||st.format==='tsv'));
      setName();
      const n=st.scope==='final'?finalN():st.scope==='view'?S.view.n:Sel.rowCount();
      summary.textContent=plural(n,'row')+' × '+plural(st.cols==='selected'?Sel.cols.size:(st.scope==='final'?(S.states[S.states.length-1]||{cols:0}).cols:curCols().length),'column')
    };
    const fmtSel=h('select',{class:'select',onchange:e=>{st.format=e.target.value;refresh()}},[['xlsx','Excel workbook (.xlsx)'],['csv','CSV (comma-separated)'],['tsv','TSV (tab-separated)'],['json','JSON records'],['jsoncols','JSON columns'],['ndjson','NDJSON (one record per line)'],['md','Markdown table'],['lines','Plain lines']].map(o=>h('option',{value:o[0]},o[1])));
    const xlNote=h('p',{class:'hint hidden',style:{marginTop:'-6px'}},'Numbers and ISO dates are stored as real Excel values. The header row is frozen with filters turned on. Formulas are never created.');
    const body=h('div',{class:'dlg-body'},
      h('div',{class:'field'},h('label',{},'Format'),fmtSel,xlNote),
      h('div',{class:'field'},h('span',{class:'flabel'},'Rows'),scopeBox),
      colSel?h('div',{class:'field'},h('span',{class:'flabel'},'Columns'),radio('cols','all','All columns',null,st.cols==='all',v=>st.cols=v),radio('cols','selected','Selected columns ('+Sel.cols.size+')',Sel.selectedCols().join(', '),st.cols==='selected',v=>st.cols=v)):null,
      h('div',{class:'field'},h('span',{class:'flabel'},'Options'),h('label',{class:'check'},h('input',{type:'checkbox',checked:st.header,onchange:e=>{st.header=e.target.checked}}),'Include header row'),guardBox,excelBox),
      h('div',{class:'field'},h('label',{},'File name'),fname));
    const build=()=>Engine.call('export',{scope:st.scope,viewKey:S.view.key,selection:Sel.payload(),columns:st.cols==='selected'&&st.scope!=='final'?Sel.selectedCols():(st.cols==='selected'?Sel.selectedCols():null),format:st.format,options:{header:st.header,formulaGuard:st.guard,excel:st.excel}});
    const d=Dialog.open({title:'Export',body,foot:[summary,
      h('button',{class:'btn btn-secondary',type:'button',onclick:async()=>{const r=await Busy.run('Preparing copy',()=>Engine.call('export',{scope:st.scope,viewKey:S.view.key,selection:Sel.payload(),columns:st.cols==='selected'?Sel.selectedCols():null,format:(st.format==='csv'||st.format==='xlsx')?'tsv':st.format,options:{header:st.header,formulaGuard:false}}));const sp=st.format==='csv'||st.format==='tsv'||st.format==='xlsx';const ok=await copyText(r.text,'Copied '+plural(r.rows,'row')+(sp?'. Paste into any spreadsheet.':'.'));if(ok)d.close(true)}},icon('copy',16),'Copy'),
      h('button',{class:'btn btn-primary',type:'button',onclick:async()=>{
        if(st.format==='xlsx'){try{const r=await Busy.run('Building workbook',build);await Xlsx.write(r,fname.value.trim()||'weft-export.xlsx',(S.file||'Weft').replace(/\.[^.]+$/,''));Toast.show('Downloaded '+plural(r.rows,'row')+' as an Excel workbook');d.close(true)}catch(e){Toast.err('Could not build the workbook: '+e.message)}return}
        const r=await Busy.run('Building file',build);const mime={csv:'text/csv',tsv:'text/tab-separated-values',json:'application/json',jsoncols:'application/json',ndjson:'application/x-ndjson',md:'text/markdown',lines:'text/plain'}[st.format];downloadText(fname.value.trim()||'weft-export.'+EXT[st.format],r.text,mime);Toast.show('Downloaded '+plural(r.rows,'row')+' ('+fmtBytes(r.bytes)+')');d.close(true)}},icon('download',16),'Download')]});
    refresh()
  }
};
function fmtBytes(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB'}

const Recipes={
  lib(){return lsGet('weft.library.v2',[])},
  setLib(v){if(!lsSet('weft.library.v2',v))Toast.err('Could not save. Browser storage is full or blocked.')},
  migrate(){
    if(localStorage.getItem('weft.library.v2')!=null)return;
    const old=lsGet('sift_library_v1',null);
    if(!Array.isArray(old)){return}
    const out=[];
    old.forEach(e=>{try{const text=e.dsl||e.text||'';const p=W.textToSteps(text);if(p.steps.length)out.push({id:'r'+Date.now().toString(36)+out.length,name:e.name||'Imported recipe',text:W.stepsToText(p.steps,null),savedAt:e.savedAt||Date.now()})}catch(x){}});
    if(out.length){this.setLib(out)}
  },
  async text(steps,source){const r=await Engine.call('recipeText',{steps:steps||cleanSteps(S.steps),source:source===undefined?undefined:source});return r.text},
  manualCount(steps){return(steps||S.steps).filter(s=>W.OPS[s.opId]&&W.OPS[s.opId].portable===false).length},
  manualWarn(){const n=this.manualCount();return n?h('div',{class:'warn-box'},plural(n,'step')+' '+(n===1?'deletes or edits':'delete or edit')+' specific rows by position. '+(n===1?'It':'They')+' will be skipped when this recipe runs on a different file. ',h('button',{type:'button',class:'link-btn',onclick:()=>{const i=S.steps.findIndex(s=>/RowIds$/.test(s.opId));if(i>=0)convertManual(i);else Toast.show('Only row-deletion steps can be converted to rules.')}},'Convert to rules…')):null},
  async saveDialog(){
    const name=h('input',{class:'input',style:{width:'100%'},value:(S.file||'My recipe').replace(/\.[^.]+$/,'')+' cleanup'});
    const shape=h('input',{type:'checkbox',checked:true});
    const body=h('div',{class:'dlg-body'},this.manualWarn(),h('div',{class:'field'},h('label',{},'Name'),name),h('label',{class:'check'},shape,'Also remember the shape of the result, to warn when a future file looks different'),h('p',{class:'dlg-note'},'Saved recipes stay in this browser. Only the steps are saved, never your data.'));
    const d=Dialog.open({title:'Save recipe',body,foot:[h('span',{class:'grow-1'},plural(S.steps.length,'step')),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>d.close()},'Cancel'),h('button',{class:'btn btn-primary',type:'button',onclick:async()=>{const n=name.value.trim();if(!n)return;const text=await this.text();let contract=null;if(shape.checked)contract=(await Engine.call('contract',{})).contract;const lib=this.lib();const ex=lib.findIndex(x=>x.name===n);const entry={id:ex>=0?lib[ex].id:'r'+Date.now().toString(36),name:n,text,contract,fileName:S.file,savedAt:Date.now(),steps:S.steps.length};if(ex>=0)lib[ex]=entry;else lib.unshift(entry);this.setLib(lib);S.contract=contract;d.close(true);Toast.show('Saved "'+n+'" to your recipe library')}},'Save')]});
    setTimeout(()=>{name.focus();name.select()},30)
  },
  libraryDialog(){
    const body=h('div',{class:'dlg-body'});
    const draw=()=>{
      clear(body);const lib=this.lib();
      if(!lib.length){body.append(h('div',{class:'all-clear'},h('b',{},'No saved recipes yet'),'Clean a file, then use Recipe ▸ Save recipe. Saved recipes can be applied to the next file with one click.'));return}
      lib.forEach((e,i)=>{
        const p=W.textToSteps(e.text);
        body.append(h('div',{class:'lib-row'},icon('recipe',18),h('div',{class:'grow-1'},h('b',{},e.name),h('small',{},plural(p.steps.length,'step')+(p.source?' · reads '+((W.READERS[p.source.kind]||{}).label||p.source.kind):'')+' · saved '+new Date(e.savedAt).toLocaleDateString())),
          h('button',{type:'button',class:'btn btn-xs btn-primary',disabled:!S.loaded,title:S.loaded?'Apply to the current data':'Load a file first',onclick:()=>{d.close(true);S.contract=e.contract||null;applyRecipeText(e.text,{name:e.name,contract:e.contract})}},'Apply'),
          h('button',{type:'button',class:'icon-btn sm','aria-label':'More',onclick:ev=>{const r=ev.currentTarget.getBoundingClientRect();Menus.open([
            {title:'Rename…',icon:'pencil',keywords:[],contexts:[],run:async()=>{const n=await Dialog.prompt('Rename recipe','Name',e.name,'Rename');if(n){const l=this.lib();l[i].name=n;this.setLib(l);draw()}}},
            {title:'Download file',icon:'download',keywords:[],contexts:[],run:()=>downloadText(e.name.replace(/[^\w-]+/g,'-')+'.weft.txt',e.text)},
            {title:'Copy share link',icon:'link',keywords:[],contexts:[],run:()=>this.share(e.text)},
            {title:'Edit as text…',icon:'recipe',keywords:[],contexts:[],run:()=>{d.close(true);openRecipeText(e.text,t=>{const l=this.lib();l[i].text=t;l[i].savedAt=Date.now();this.setLib(l);Toast.show('Updated "'+e.name+'"')})}},
            '-',
            {title:'Delete',icon:'trash',danger:true,keywords:[],contexts:[],run:async()=>{if(await Dialog.confirm('Delete "'+e.name+'"?','This removes the recipe from this browser.','Delete',true)){const l=this.lib();l.splice(i,1);this.setLib(l);draw()}}}
          ],r.left,r.bottom+4,ev.currentTarget)}},icon('more',16))))
      })
    };
    const d=Dialog.open({title:'Recipe library',body,foot:[h('span',{class:'grow-1'},'Stored in this browser only.'),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>{d.close(true);$('#recipeInput').click()}},icon('upload',16),'Import file…'),S.steps.length?h('button',{class:'btn btn-primary',type:'button',onclick:()=>{d.close(true);this.saveDialog()}},'Save current recipe'):null]});
    draw()
  },
  async share(text){
    text=text||await this.text();
    const hash=await compressToHash(text);
    const url=location.href.split('#')[0]+'#r='+hash;
    if(this.manualCount()&&!arguments.length)Toast.show(plural(this.manualCount(),'manual step')+' in this link will be skipped on other files.');
    copyText(url,'Copied share link. It contains only the steps, never your data.')
  },
  async download(){downloadText(((S.file||'weft').replace(/\.[^.]+$/,''))+'.weft.txt',await this.text())}
};

async function applyRecipeText(text,opts){
  opts=opts||{};
  const p=W.textToSteps(text);
  if(p.errors.length&&!p.steps.length){Toast.err('This recipe could not be read: line '+p.errors[0].line+': '+p.errors[0].message);return false}
  if(!S.loaded){S.pendingRecipe={text,opts};Toast.show('Recipe ready. Load a file and it will be applied.');return false}
  if(p.source&&S.reading&&p.source.kind!==S.reading.kind){
    const exp=(W.READERS[p.source.kind]||{}).label||p.source.kind;
    const has=S.readings.findIndex(r=>r.kind===p.source.kind);
    const use=await Dialog.confirm('Which reading should the recipe use?','This recipe expects '+exp.toLowerCase()+', but this file looks like '+(S.reading.label||'').toLowerCase()+'. Use the recipe\'s reading or the detected one?','Use the recipe\'s reading');
    if(use){
      try{const r=await Engine.call('chooseReading',{reading:p.source});await applyLoad(r,{keepSteps:true})}catch(e){Toast.err('The recipe\'s reading did not work on this file: '+e.message)}
    }else if(has<0){}
  }
  const cols=curCols();
  const want=new Set();p.steps.forEach(s=>W.stepColumns(s).forEach(c=>want.add(c)));
  const dict=W.matchColumns(Array.from(want),S.baseSchema.cols.map(c=>c.name));
  const steps=Object.keys(dict).length?p.steps.map(s=>W.remapStep(s,dict)):p.steps;
  const start=S.steps.length?S.steps:[];
  const combined=opts.replace===false?start.concat(steps):steps;
  const ok=await setPipeline(combined,0,{label:'Applying recipe'});
  if(!ok)return false;
  const bad=S.meta.filter(m=>m.error).length;
  let msg='Applied '+(opts.name?'"'+opts.name+'" · ':'')+plural(steps.length,'step');
  if(Object.keys(dict).length)msg+=' · matched '+plural(Object.keys(dict).length,'renamed column');
  if(bad)Toast.err(msg+'. '+plural(bad,'step')+' could not run and are marked in red.',{undo:doUndo});
  else Toast.show(msg,{undo:doUndo});
  if(p.errors.length)Toast.err(plural(p.errors.length,'line')+' of the recipe could not be read and were skipped.');
  if(opts.contract)checkDrift(opts.contract,true);
  return true
}
async function checkDrift(contract,quiet){
  contract=contract||S.contract;if(!contract)return;
  const r=await Engine.call('drift',{contract});
  if(!r.drift.length){if(!quiet)Toast.show('This file has the same shape as the saved recipe expects.');return}
  const body=h('div',{class:'dlg-body'},h('p',{class:'dlg-note'},'Compared with the file this recipe was saved from, the result looks different in '+plural(r.drift.length,'way')+'. Check these before exporting.'),h('ul',{class:'review-list'},r.drift.slice(0,30).map(x=>h('li',{},x.text))));
  const d=Dialog.open({title:'This file looks different',body,foot:[h('span',{class:'grow-1'}),h('button',{class:'btn btn-primary',type:'button',onclick:()=>d.close()},'OK')]})
}

function openRecipeText(initial,onSave){
  const ta=h('textarea',{class:'textarea',spellcheck:false,'aria-label':'Recipe text',style:{minHeight:'320px'}});
  const errs=h('div',{class:'dsl-errs'});
  const help=h('details',{style:{marginTop:'10px',font:'500 12.5px var(--sans)',color:'var(--ink-dim)'}},h('summary',{style:{cursor:'pointer'}},'Examples of steps you can write'),h('pre',{class:'cell-full',style:{marginTop:'8px'}},['remove rows where "status" is empty','keep rows where "amount" > 100 and "region" in ("EMEA", "APAC")','remove rows where any column contains "test"','trim *','case title "name"','replace "N/A" with "" in * whole','convert "amount" to number','dates "date" -> iso','sort by "amount" desc, "name" asc','split "name" on " " into "first", "last"','split "line" by whitespace-runs','use row 3 as header','remove duplicates by "email" ignore case','rename "e-mail" -> "email"','#! lines starting with #! are muted steps'].join('\n')));
  const check=debounce(()=>{const p=W.textToSteps(ta.value);clear(errs);if(p.errors.length)errs.append(h('div',{class:'err-box'},p.errors.slice(0,5).map(e=>h('div',{},'Line '+e.line+': '+e.message))));else errs.append(h('div',{class:'hint',style:{color:'var(--sage)',font:'500 12.5px var(--sans)'}},plural(p.steps.length,'step')+', no problems found.'))},200);
  ta.addEventListener('input',check);
  const body=h('div',{class:'dlg-body'},h('p',{class:'dlg-note'},'Each line is one step. Edit, reorder or paste steps, then apply.'),ta,errs,help);
  const d=Dialog.open({title:'Recipe as text',cls:'mid',body,foot:[h('span',{class:'grow-1'}),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>copyText(ta.value,'Copied recipe text')},icon('copy',16),'Copy'),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>d.close()},'Cancel'),h('button',{class:'btn btn-primary',type:'button',onclick:async()=>{const p=W.textToSteps(ta.value);if(p.errors.length){Toast.err('Fix line '+p.errors[0].line+' first: '+p.errors[0].message);return}d.close(true);if(onSave){onSave(ta.value);return}await setPipeline(p.steps,0,{label:'Applying recipe'});Toast.show('Recipe updated · '+plural(p.steps.length,'step'),{undo:doUndo})}},onSave?'Save':'Apply')]});
  (async()=>{ta.value=initial!=null?initial:await Recipes.text();check()})()
}

async function streamToBytes(readable){const chunks=[];const rd=readable.getReader();for(;;){const{done,value}=await rd.read();if(done)break;chunks.push(value)}const n=chunks.reduce((a,c)=>a+c.length,0),out=new Uint8Array(n);let o=0;for(const c of chunks){out.set(c,o);o+=c.length}return out}
function b64u(bytes){let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64u(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
async function compressToHash(text){if(typeof CompressionStream==='function'){try{const cs=new CompressionStream('deflate-raw'),w=cs.writable.getWriter();w.write(new TextEncoder().encode(text));w.close();return'z'+b64u(await streamToBytes(cs.readable))}catch(e){}}return'r'+b64u(new TextEncoder().encode(text))}
async function decompressFromHash(hash){if(!hash)throw new Error('The link is missing its recipe.');const v=hash[0],p=hash.slice(1);if(v==='r')return new TextDecoder().decode(unb64u(p));if(v==='z'){if(typeof DecompressionStream!=='function')throw new Error('This browser cannot open compressed links. Try a newer browser.');const ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();w.write(unb64u(p));w.close();return new TextDecoder().decode(await streamToBytes(ds.readable))}throw new Error('This link format is not recognised.')}

async function readShareLink(){
  const m=location.hash.match(/^#([rp])=(.+)$/);if(!m)return;
  let text;try{text=await decompressFromHash(decodeURIComponent(m[2]))}catch(e){Toast.err('The share link could not be opened: '+e.message);return}
  history.replaceState(null,'',location.pathname+location.search);
  const p=W.textToSteps(text);
  if(!p.steps.length){Toast.err('The share link has no steps.');return}
  reviewRecipe(text,p)
}
function reviewRecipe(text,p){
  const body=h('div',{class:'dlg-body'},h('p',{class:'dlg-note'},'Someone shared a recipe with '+plural(p.steps.length,'step')+'. Review what it will do before it touches your data. Recipes can only change the table in this tab. They cannot send data anywhere.'),
    h('ol',{class:'review-list'},p.steps.map(s=>h('li',{},(s.muted?'(muted) ':'')+W.describeStep(s)))),
    p.errors.length?h('div',{class:'warn-box'},plural(p.errors.length,'line')+' could not be read and will be skipped.'):null);
  const d=Dialog.open({title:'Review shared recipe',body,foot:[h('span',{class:'grow-1'}),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>d.close()},'Don\'t apply'),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>{const l=Recipes.lib();l.unshift({id:'r'+Date.now().toString(36),name:'Shared recipe '+new Date().toLocaleDateString(),text,savedAt:Date.now()});Recipes.setLib(l);Toast.show('Saved to your recipe library')}},'Save to library'),h('button',{class:'btn btn-primary',type:'button',onclick:()=>{d.close(true);applyRecipeText(text,{name:'shared recipe'})}},S.loaded?'Apply recipe':'Apply to the next file')]})
}

async function likeTheseDialog(){
  const ids=await selectedRowIdsList(5000);
  if(!ids.length)return;
  const r=await Busy.run('Looking for a rule',()=>Engine.call('likeThese',{stateIdx:S.viewIdx,rowIds:ids}));
  let pick=0;
  const body=h('div',{class:'dlg-body'});
  if(!r.candidates.length){body.append(h('p',{class:'dlg-note'},'Weft could not find a simple rule that matches all '+plural(ids.length,'selected row')+'. Build one yourself, or delete these rows directly.'))}
  else{
    body.append(h('p',{class:'dlg-note'},'These rules match all '+plural(ids.length,'selected row')+'. A rule also works on future files, unlike deleting rows by position.'));
    r.candidates.forEach((c,i)=>body.append(h('label',{class:'radio'},h('input',{type:'radio',name:'like',checked:i===0,onchange:()=>{pick=i}}),h('span',{},c.label.replace(/^./,m=>m.toUpperCase())+'.',h('small',{},'Matches your '+plural(c.matchesSelected,'selected row')+(c.matchesOthers?' and '+plural(c.matchesOthers,'other'):' and no others')+'.')))))
  }
  const d=Dialog.open({title:'Remove rows like these',body,foot:[h('span',{class:'grow-1'}),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>{d.close(true);openFilterBuilder(r.candidates.length?W.clone(r.candidates[pick].cfg):{mode:'remove',match:'all',conditions:[{col:curCols()[0],op:'isEmpty',caseSensitive:false}]})}},'Edit conditions…'),r.candidates.length?h('button',{class:'btn btn-primary',type:'button',onclick:async()=>{d.close(true);Sel.clear(true);await addStep('filterRows',r.candidates[pick].cfg)}},'Remove matching rows'):h('button',{class:'btn btn-primary',type:'button',onclick:()=>{d.close(true);deleteSelection()}},'Delete selected rows')]})
}
async function convertManual(i){
  const st=S.steps[i];if(!st||!/RowIds$/.test(st.opId))return;
  if(st.cfg.mode==='allExcept'){Toast.err('This step keeps or removes almost every row, so it cannot be turned into a rule.');return}
  await setViewIdx(i);
  const r=await Engine.call('likeThese',{stateIdx:i,rowIds:st.cfg.rowIds});
  if(!r.candidates.length){Toast.err('No simple rule matches exactly these rows. Keep the manual step, or build a filter yourself.');return}
  const c=r.candidates[0];
  const ok=await Dialog.confirm('Convert step '+(i+1)+' to a rule?','Replace "'+W.describeStep(st)+'" with "'+(st.opId==='keepRowIds'?'Keep':'Remove')+' rows where '+c.label+'". It matches '+plural(c.matchesSelected,'of those rows')+(c.matchesOthers?' and '+plural(c.matchesOthers,'other row'):'')+'.','Convert');
  if(!ok)return;
  const steps=cleanSteps(S.steps);steps[i]={id:steps[i].id,opId:'filterRows',cfg:Object.assign({},c.cfg,{mode:st.opId==='keepRowIds'?'keep':'remove'}),muted:steps[i].muted};
  if(await setPipeline(steps,i,{viewIdx:i+1}))Toast.show('Step '+(i+1)+' is now a rule and will work on other files.',{undo:doUndo})
}
async function loadReference(after){
  const inp=$('#refInput');
  inp.onchange=async()=>{
    const f=inp.files[0];inp.value='';if(!f)return;
    if(f.size>300e6){Toast.err('That file is larger than 300 MB. Weft cannot open files that big in a browser tab.');return}
    let text;
    if(Xlsx.isExcel(f.name)){try{const x=await Xlsx.readFile(f);if(!x)return;text=x.text}catch(e){Toast.err(e.message);return}}
    else text=await f.text();
    try{const r=await Busy.run('Reading reference file',()=>Engine.call('refLoad',{text,name:f.name}));S.refs=(await Engine.call('refList',{})).refs;Toast.show('Loaded reference "'+r.name+'" · '+plural(r.n,'row')+' × '+plural(r.cols.length,'column'));if(after)after(r.name)}
    catch(e){Toast.err('Could not read the reference file: '+e.message)}
  };
  inp.click()
}

const HelpSheet={
  open(all){
    const q=h('input',{class:'input',placeholder:'Filter commands and shortcuts',style:{width:'100%',marginBottom:'14px'},'aria-label':'Filter'});
    const grid=h('div',{class:'help-grid'});
    const draw=()=>{
      clear(grid);const f=q.value.trim().toLowerCase();
      const extra={Grid:[['Move the cursor','Arrows'],['Extend a selection','Shift + arrows'],['Edit a cell','Enter or F2'],['Select a row','Space on a row, or click its number'],['Select rows in range','Shift+click row numbers'],['Toggle one row',MOD+'click a row number'],['Select the rows of a cell range','Shift+Space'],['Select the columns of a cell range',MOD+'Space'],['Rename a column','Double-click its header'],['Close the top menu or dialog','Esc']]};
      Object.keys(extra).forEach(g=>{const rows=extra[g].filter(x=>!f||(x[0]+x[1]).toLowerCase().indexOf(f)!==-1);if(rows.length)grid.append(h('div',{class:'help-sec'},h('h3',{},'In the grid'),rows.map(x=>h('div',{class:'help-row'},h('span',{},x[0]),h('span',{class:'kbd'},x[1])))))});
      GROUPS.forEach(g=>{const cs=Commands.list.filter(c=>c.group===g&&Commands.visible(c)&&(all||c.shortcut||true)).filter(c=>!f||(c.title+' '+c.keywords.join(' ')+' '+(c.description||'')).toLowerCase().indexOf(f)!==-1);if(!cs.length)return;grid.append(h('div',{class:'help-sec'},h('h3',{},g),cs.map(c=>h('div',{class:'help-row'},h('span',{},c.title,c.description?h('small',{},c.description):null),c.shortcut?h('span',{class:'kbd'},fmtShortcut(c.shortcut)):null))))})
    };
    q.addEventListener('input',draw);draw();
    Dialog.open({title:all?'What Weft can do':'Keyboard shortcuts and commands',wide:true,body:h('div',{class:'dlg-body'},q,grid)})
  }
};
