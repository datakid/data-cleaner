'use strict';
const Find={
  cur:null,
  info:null,
  busy:false,
  reset(){
    this.cur=null;this.info=null;
    const el=$('#searchCount');if(el){el.classList.add('hidden');el.textContent=''}
  },
  label(i){
    const f=this.info;if(!f)return'';
    if(!f.total)return'No matches';
    const tot=f.capped?fmtInt(f.total)+'+':fmtInt(f.total);
    return(i?fmtInt(i)+' of ':'')+tot+' match'+(f.total===1&&!f.capped?'':'es')
  },
  async step(dir){
    if(!S.loaded)return;
    const q=S.search.trim();
    if(!q){const si=$('#searchInput');si.focus();Toast.show('Type something in the search box first.');return}
    if(this.busy)return;
    this.busy=true;
    try{
      const vk=S.view.key;
      if(!this.info||this.info.key!==vk+'|'+q){
        const c=await Engine.call('findCount',{viewKey:vk,query:q});
        if(vk!==S.view.key)return;
        this.info={key:vk+'|'+q,total:c.total,capped:c.capped};
        this.cur=null
      }
      if(!this.info.total){this.showCount(0);announce('No matches');return}
      const r=await Engine.call('findCells',{viewKey:vk,query:q,dir:dir<0?-1:1,from:this.cur?{pos:this.cur.pos,col:this.cur.col}:null});
      if(vk!==S.view.key)return;
      if(r.pos<0){this.showCount(0);return}
      this.cur={pos:r.pos,col:r.col};
      Grid.scrollToPos(r.pos,r.col);
      Grid.pool.forEach(x=>{x.key=''});
      Grid.paint();
      this.showCount(r.index);
      announce((r.index?'Match '+fmtInt(r.index)+' of '+fmtInt(this.info.total):'Match')+(r.wrapped?'. Wrapped around.':'')+'. Row '+fmtInt(r.pos+1)+', column '+curCols()[r.col]+'.')
    }catch(e){
      if(!isQuiet(e)){if(/out of date/.test(e.message)){await refreshView(true)}else Toast.err('Could not search the cells: '+e.message)}
    }finally{this.busy=false}
  },
  showCount(i){
    const el=$('#searchCount');
    el.classList.remove('hidden');
    el.textContent=this.label(i)
  }
};

const FindReplace={
  dlg:null,
  seq:0,
  open(preset){
    if(!S.loaded)return;
    const cols=curCols();
    const cell=Sel.kind==='cells'&&Grid.rowAt(Sel.cursor.pos)?(Grid.rowAt(Sel.cursor.pos).row[Sel.cursor.col]||''):'';
    const st={find:preset&&preset.find!=null?preset.find:(cell&&cell.length<=80&&cell.indexOf('\n')===-1?cell:''),replace:preset&&preset.replace!=null?preset.replace:'',scope:'all',cols:Sel.kind==='cols'?Sel.selectedCols():[],matchCase:false,wholeCell:false,regex:false,result:null,error:null,selection:Sel.kind==='cells'||Sel.kind==='rows'?Sel.payload():null};
    if(st.cols.length)st.scope='columns';
    const hasSel=Sel.kind==='cells'||Sel.kind==='rows';
    const find=h('input',{class:'input',type:'text','aria-label':'Find',value:st.find,spellcheck:false,autocomplete:'off',oninput:e=>{st.find=e.target.value;this.refresh(st)}});
    const rep=h('input',{class:'input',type:'text','aria-label':'Replace with',value:st.replace,spellcheck:false,autocomplete:'off',oninput:e=>{st.replace=e.target.value;this.refresh(st)}});
    const within=h('select',{class:'select','aria-label':'Within',onchange:e=>{st.scope=e.target.value;this.draw(st);this.refresh(st)}},
      h('option',{value:'all',selected:st.scope==='all'},'All columns'),
      h('option',{value:'columns',selected:st.scope==='columns'},'Chosen columns'),
      h('option',{value:'selection',selected:st.scope==='selection',disabled:!hasSel},hasSel?'Selection ('+(Sel.kind==='rows'?plural(Sel.rowCount(),'row'):plural(Sel.cellCount(),'cell'))+')':'Selection (select cells or rows first)'));
    const chips=h('div',{class:'col-chips',role:'group','aria-label':'Columns'});
    const opt=(key,label)=>h('label',{class:'check'},h('input',{type:'checkbox','data-k':key,checked:st[key],onchange:e=>{st[key]=e.target.checked;this.refresh(st)}}),label);
    const note=h('p',{class:'dlg-note fr-note hidden'},'Selections are not portable between files, so Weft adds one step per column that sets just these cells.');
    const preview=h('div',{class:'preview-box fr-preview','aria-live':'polite'});
    const apply=h('button',{class:'btn btn-primary',type:'button','data-act':'apply',disabled:true,onclick:()=>this.apply(st)},'Replace all');
    const body=h('div',{class:'dlg-body fr-body'},
      h('div',{class:'field'},h('label',{},'Find'),find),
      h('div',{class:'field'},h('label',{},'Replace with'),rep),
      h('div',{class:'field'},h('label',{},'Within'),within,chips,note),
      h('div',{class:'fr-opts'},opt('matchCase','Match case'),opt('wholeCell','Whole cell'),opt('regex','Use pattern')),
      preview);
    const d=Dialog.open({title:'Find and replace',body,foot:[h('span',{class:'grow-1'}),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>d.close()},'Cancel'),apply],focus:'.fr-body input',onClose:()=>{this.dlg=null}});
    st.el={body,chips,note,preview,apply,find,rep,within,cols};
    this.dlg=d;
    this.draw(st);
    this.refresh(st);
    setTimeout(()=>{find.focus();find.select()},30)
  },
  draw(st){
    const e=st.el;
    clear(e.chips);
    e.chips.classList.toggle('hidden',st.scope!=='columns');
    e.note.classList.toggle('hidden',st.scope!=='selection');
    if(st.scope==='columns'){
      e.cols.forEach(c=>e.chips.append(h('button',{type:'button',class:'col-chip','aria-pressed':String(st.cols.indexOf(c)!==-1),title:c,onclick:()=>{st.cols=st.cols.indexOf(c)!==-1?st.cols.filter(x=>x!==c):st.cols.concat([c]);this.draw(st);this.refresh(st)}},c)))
    }
  },
  cfg(st){
    const cols=st.scope==='columns'?st.cols:['*'];
    return{columns:cols.length?cols:['*'],find:st.find,replace:st.replace,regex:st.regex,wholeCell:st.wholeCell,matchCase:st.matchCase}
  },
  payload(st,overrides){
    const p={cfg:this.cfg(st)};
    if(st.scope==='selection'){p.viewKey=S.view.key;p.selection=st.selection;p.overrides=!!overrides}
    else p.stateIdx=S.viewIdx;
    return p
  },
  refresh(st){
    const e=st.el;if(!e)return;
    const my=++this.seq;
    if(st.scope==='columns'&&!st.cols.length){this.show(st,{error:'Pick at least one column.',cells:0,columns:0,samples:[]});return}
    if(!st.find){this.show(st,{error:null,empty:true,cells:0,columns:0,samples:[]});return}
    clearTimeout(st.timer);
    st.timer=setTimeout(async()=>{
      let r;
      try{r=await Engine.call('replacePreview',this.payload(st,false),'fr')}
      catch(err){if(isQuiet(err)||my!==this.seq)return;this.show(st,{error:err.message,cells:0,columns:0,samples:[]});return}
      if(my!==this.seq)return;
      this.show(st,r)
    },120)
  },
  show(st,r){
    const e=st.el;if(!e||!document.contains(e.preview))return;
    st.result=r;
    clear(e.preview);
    if(r.error){e.preview.append(h('div',{class:'fr-err',role:'alert',text:r.error}));e.apply.disabled=true;return}
    if(r.empty){e.preview.append(h('div',{class:'hint',text:'Type what to find. A preview of the changes appears here.'}));e.apply.disabled=true;return}
    e.preview.append(h('div',{class:'fr-sum',text:r.cells?plural(r.cells,'cell')+' in '+plural(r.columns,'column')+' will change.':'No cells will change.'}));
    if(r.samples.length){
      e.preview.append(h('table',{class:'mini-table fr-table'},h('thead',{},h('tr',{},h('th',{},'Column'),h('th',{},'Before'),h('th',{},'After'))),
        h('tbody',{},r.samples.map(x=>h('tr',{},h('td',{text:W.trunc(x.col,18)}),h('td',{class:'fr-before',text:W.trunc(x.before,40)}),h('td',{class:'fr-after',text:W.trunc(x.after,40)}))))));
      if(r.cells>r.samples.length)e.preview.append(h('div',{class:'hint',text:'and '+fmtInt(r.cells-r.samples.length)+' more'}))
    }
    e.apply.disabled=!r.cells;
    e.apply.textContent=r.cells?'Replace '+fmtInt(r.cells)+(r.cells===1?' cell':' cells'):'Replace all'
  },
  async apply(st){
    if(!st.result||!st.result.cells)return;
    const cfg=this.cfg(st);
    if(st.scope!=='selection'){
      const n=st.result.cells;
      this.dlg.close(true);
      await addStep('replace',cfg,{msg:'Replaced '+plural(n,'cell')+' in '+plural(st.result.columns,'column')});
      return
    }
    let r;
    try{r=await Engine.call('replacePreview',this.payload(st,true))}
    catch(e){if(!isQuiet(e))Toast.err('Something went wrong: '+e.message);return}
    if(!r.overrides.length)return;
    if(r.capped){Toast.err('That selection changes too many cells. Narrow it down.');return}
    const by=new Map();
    r.overrides.forEach(o=>{if(!by.has(o.col))by.set(o.col,[]);by.get(o.col).push({rowId:o.rowId,value:o.value})});
    const steps=cleanSteps(S.steps);
    const idx=S.viewIdx;
    const add=Array.from(by,([column,overrides])=>({id:newStepId(),opId:'cellOverride',cfg:{column,overrides},muted:false}));
    steps.splice(idx,0,...add);
    this.dlg.close(true);
    const ok=await setPipeline(steps,idx,{viewIdx:idx+add.length,label:'Replacing'});
    if(ok)Toast.show('Replaced '+plural(r.cells,'cell')+' in '+plural(by.size,'column'),{undo:doUndo})
  }
};
