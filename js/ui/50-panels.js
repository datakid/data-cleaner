'use strict';
const Panels={
  toggle(which){
    const el=$('#'+which);const narrow=innerWidth<=(which==='rail'?900:1100);
    if(narrow){el.classList.toggle('closed');if(!el.classList.contains('closed'))Layers.push(which,()=>el.classList.add('closed'));else Layers.pop(which)}
    else{el.classList.toggle('hidden');Prefs.set('hide_'+which,el.classList.contains('hidden'))}
    Grid.paint()
  },
  init(){
    ['rail','inspector'].forEach(w=>{if(Prefs.get('hide_'+w,false))$('#'+w).classList.add('hidden')});
    const apply=()=>{$('#rail').classList.toggle('closed',innerWidth<=900);$('#inspector').classList.toggle('closed',innerWidth<=1100)};
    apply();let last=innerWidth;addEventListener('resize',debounce(()=>{if((last>1100)!==(innerWidth>1100)||(last>900)!==(innerWidth>900))apply();last=innerWidth;Toolbar.render()},150))
  }
};

const Rail={
  dragFrom:-1,
  render(){
    const list=$('#railList');clear(list);
    $('#railCount').textContent=String(S.steps.length);
    const b=S.states[0]||{n:0,cols:0};
    const start=h('div',{class:'tl tl-start t-manual',style:{'--tl':S.steps.length?'var(--border-hi)':'var(--border)'}},h('span',{class:'tl-node'}),
      h('div',{class:'step-card'+(S.viewIdx===0&&S.steps.length?' active':''),tabindex:'0',role:'button','aria-label':'View original data',onclick:()=>setViewIdx(0),onkeydown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setViewIdx(0)}}},
        h('div',{class:'sc-row1'},h('span',{class:'sc-name'},'Original')),h('div',{class:'sc-meta'},fmtInt(b.n)+' rows × '+b.cols+' columns')));
    list.appendChild(start);
    if(!S.steps.length){
      list.appendChild(h('div',{class:'rail-empty'},'No steps yet, so your data is unchanged. Select rows and press ',h('span',{class:'kbd'},'Delete'),', pick a fix from Suggestions, or open Commands (',h('span',{class:'kbd'},MOD+'K'),').'));
      return
    }
    S.steps.forEach((st,i)=>{
      const m=S.meta[i]||{};const def=W.OPS[st.opId]||{label:st.opId};
      const cat=m.category||W.categoryOf(st);
      const active=S.viewIdx===i+1;
      const node=h('span',{class:'tl-node','aria-hidden':'true'},m.error?'!':String(i+1));
      const act=(ic,label,fn,extra)=>h('button',Object.assign({type:'button',class:'icon-btn','aria-label':label,title:label,onclick:e=>{e.stopPropagation();fn(e)}},extra||{}),icon(ic,14));
      const card=h('div',{class:'step-card'+(active?' active':''),tabindex:'0',role:'button','aria-label':'Step '+(i+1)+': '+(m.describe||def.label)+(st.muted?' (muted)':'')+'. '+(W.CATEGORY_LABEL[cat]||''),'aria-current':active?'step':null,title:(W.CATEGORY_LABEL[cat]||'')+' step',
        onclick:()=>setViewIdx(i+1),
        ondblclick:()=>editStep(i),
        onkeydown:e=>{if(e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();this.move(i,e.key==='ArrowUp'?-1:1)}else if(e.key==='Enter'){e.preventDefault();setViewIdx(i+1)}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopPropagation();this.remove(i)}}},
        h('div',{class:'sc-row1'},h('span',{class:'grip','aria-hidden':'true',title:'Drag to reorder'},icon('grip',14)),h('span',{class:'sc-name'},def.label),
          h('span',{class:'sc-actions'},act('pencil','Edit step',()=>editStep(i)),act(st.muted?'eye':'eyeOff',st.muted?'Unmute step':'Mute step',()=>this.toggleMute(i)),act('trash','Delete step',()=>this.remove(i)),act('more','More actions',e=>{const r=e.currentTarget.getBoundingClientRect();Menus.open(this.moreMenu(i),r.left,r.bottom+4,e.currentTarget)},{'aria-haspopup':'menu'}))),
        h('div',{class:'sc-desc',title:m.describe||''},m.describe||W.describeStep(st)),
        (m.chips&&m.chips.length||m.portable===false)?h('div',{class:'sc-chips'},(m.chips||[]).map(c=>h('span',{class:'chip c-'+(c.kind==='none'?'x':c.kind)},c.text)),m.portable===false?h('span',{class:'chip c-manual'},'Manual'):null,st.muted?h('span',{class:'chip'},'Muted'):null):null,
        m.error?h('div',{class:'sc-err'},m.error):null,
        !m.error&&m.warning?h('div',{class:'sc-warn'},m.warning):null);
      const item=h('div',{class:'tl t-'+cat+(st.muted?' muted':'')+(m.error?' err':''),draggable:'true','data-i':String(i)},node,card);
      item.addEventListener('dragstart',e=>{this.dragFrom=i;item.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','step')});
      item.addEventListener('dragend',()=>{item.classList.remove('dragging');$$('.tl.drop-before').forEach(x=>x.classList.remove('drop-before'))});
      item.addEventListener('dragover',e=>{if(this.dragFrom<0)return;e.preventDefault();$$('.tl.drop-before').forEach(x=>x.classList.remove('drop-before'));item.classList.add('drop-before')});
      item.addEventListener('drop',e=>{e.preventDefault();const from=this.dragFrom;this.dragFrom=-1;if(from<0||from===i)return;const steps=cleanSteps(S.steps);const [s]=steps.splice(from,1);steps.splice(from<i?i-1:i,0,s);setPipeline(steps,Math.min(from,i),{viewIdx:S.steps.length}).then(ok=>ok&&Toast.show('Moved step. Later steps were re-run.',{undo:doUndo}))});
      list.appendChild(item)
    });
    const fin=S.states[S.states.length-1]||{n:0,cols:0};
    list.appendChild(h('div',{class:'tl tl-end',style:{'--tl':'var(--ink)'}},h('span',{class:'tl-node'}),
      h('div',{class:'step-card'+(atEnd()?' active':''),tabindex:'0',role:'button','aria-label':'View final result',onclick:()=>setViewIdx(S.steps.length),onkeydown:e=>{if(e.key==='Enter'){e.preventDefault();setViewIdx(S.steps.length)}}},
        h('div',{class:'sc-row1'},h('span',{class:'sc-name'},'Result')),h('div',{class:'sc-meta'},fmtInt(fin.n)+' rows × '+fin.cols+' columns'))));
    const a=list.querySelector('.step-card.active');if(a)a.scrollIntoView({block:'nearest'})
  },
  moreMenu(i){
    const mk=(label,ic,fn,w)=>({title:label,icon:ic,when:()=>w===undefined?true:w,run:fn,keywords:[],contexts:[]});
    return[
      mk('View data at this step','eye',()=>setViewIdx(i+1)),
      mk('Edit step','pencil',()=>editStep(i)),
      mk('Duplicate step','copy',()=>{const steps=cleanSteps(S.steps);steps.splice(i+1,0,Object.assign(W.clone(steps[i]),{id:newStepId()}));setPipeline(steps,i+1,{viewIdx:i+2}).then(ok=>ok&&Toast.show('Duplicated step '+(i+1),{undo:doUndo}))}),
      mk('Move up','chevRight',()=>this.move(i,-1),i>0?true:'This is already the first step.'),
      mk('Move down','chevDown',()=>this.move(i,1),i<S.steps.length-1?true:'This is already the last step.'),
      mk('Select rows this step removed','rows',async()=>{const r=await Engine.call('removedIds',{stateIdx:i+1});if(!r.rowIds.length){Toast.show('This step did not remove any rows.');return}await setViewIdx(i);VFilter.set('removed by step '+(i+1),{rowIds:r.rowIds,stateIdx:i})},(S.meta[i]&&S.meta[i].stats&&S.meta[i].stats.removed)?true:'This step did not remove rows.'),
      mk('Convert to a rule…','wand',()=>convertManual(i),W.OPS[S.steps[i].opId].portable===false&&/RowIds$/.test(S.steps[i].opId)?true:'Only row-deletion steps can be converted.'),
      '-',
      Object.assign(mk('Delete step','trash',()=>this.remove(i)),{danger:true})
    ]
  },
  async toggleMute(i){const steps=cleanSteps(S.steps);steps[i].muted=!steps[i].muted;const ok=await setPipeline(steps,i,{viewIdx:S.viewIdx});if(ok)Toast.show((steps[i].muted?'Muted':'Unmuted')+' step '+(i+1),{undo:doUndo})},
  async remove(i){const steps=cleanSteps(S.steps);const d=W.describeStep(steps[i]);steps.splice(i,1);const ok=await setPipeline(steps,i,{viewIdx:Math.min(S.viewIdx>i?S.viewIdx-1:S.viewIdx,steps.length)});if(ok)Toast.show('Deleted step: '+trunc(d,60),{undo:doUndo})},
  async move(i,d){const j=i+d;if(i<0||j<0||j>=S.steps.length)return;const steps=cleanSteps(S.steps);const [s]=steps.splice(i,1);steps.splice(j,0,s);const ok=await setPipeline(steps,Math.min(i,j),{viewIdx:j+1});if(ok){Toast.show('Moved step to position '+(j+1),{undo:doUndo});const c=$$('.tl .step-card')[j+1];c&&c.focus()}}
};

const Scrub={
  render(){
    const el=$('#scrub');
    if(!S.loaded||!S.steps.length){el.classList.add('hidden');return}
    el.classList.remove('hidden');
    const n=S.steps.length;const track=$('#scrubTrack');
    clear(track);
    track.append(h('div',{class:'rail-line'}),h('div',{class:'fill-line',style:{width:'calc((100% - 16px) * '+(S.viewIdx/n)+')'}}));
    S.steps.forEach((st,i)=>{const cat=W.categoryOf(st);track.appendChild(h('span',{class:'tick t-'+cat,style:{left:'calc(8px + (100% - 16px) * '+((i+1)/n)+')',background:'var(--tl)',opacity:st.muted?'.4':'1'}}))});
    const inp=h('input',{type:'range',min:'0',max:String(n),step:'1',value:String(S.viewIdx),'aria-label':'View data at step','aria-valuetext':S.viewIdx===0?'Original data':'Step '+S.viewIdx+' of '+n});
    inp.addEventListener('input',()=>setViewIdx(+inp.value));
    track.appendChild(inp);
    const lab=$('#scrubLabel');clear(lab);
    if(S.viewIdx===0)lab.append(h('b',{},'Original data'),' · before any steps');
    else lab.append(h('b',{},'Step '+S.viewIdx+' of '+n),' · '+(S.meta[S.viewIdx-1]?S.meta[S.viewIdx-1].describe:''))
  }
};

const ReadingBar={
  render(){
    const el=$('#readingBar');if(!S.loaded||!S.reading){el.classList.add('hidden');return}
    el.classList.remove('hidden');clear(el);
    const b=S.baseSchema;
    el.append(h('span',{class:'small-label'},'Read as'),h('button',{type:'button',class:'kind-badge',title:'Change how the input is read',onclick:()=>ReadingDialog.open()},S.reading.label||S.reading.kind,icon('chevDown',14)),
      h('span',{class:'rb-counts'},plural(b.cols.length,'column')+' · '+plural(b.n,'row')));
    const others=S.readings.map((r,i)=>({r,i})).filter(x=>x.r.kind!==S.reading.kind||JSON.stringify(x.r.params.delimiter)!==JSON.stringify(S.reading.params.delimiter)).slice(0,3);
    if(others.length){el.append(h('span',{class:'small-label',style:{marginLeft:'6px'}},'Other readings'));others.forEach(x=>el.append(h('button',{type:'button',class:'rb-chip',title:x.r.explain,onclick:()=>chooseReading(x.i)},x.r.label)))}
    el.append(h('button',{type:'button',class:'btn btn-xs btn-ghost',onclick:()=>ReadingDialog.open()},'Adjust…'));
    const warns=S.warnings.slice();
    if(warns.length)el.append(h('span',{class:'rb-warn',title:warns.join('\n')},icon('alert',14),h('span',{},warns[0]+(warns.length>1?' (+'+(warns.length-1)+' more)':''))))
  }
};
async function chooseReading(indexOrReading){
  const payload=typeof indexOrReading==='number'?{index:indexOrReading}:{reading:indexOrReading};
  let r;try{r=await Busy.run('Re-reading the input',()=>Engine.call('chooseReading',payload))}catch(e){Toast.err(e.message);return}
  const steps=S.steps;
  await applyLoad(r,{keepSteps:true});
  if(steps.length){
    await setPipeline(steps,0,{noUndo:true});
    const bad=S.meta.filter(m=>m.error).length;
    if(bad)Toast.err('Reading changed. '+plural(bad,'step')+' refer to columns that no longer exist; they are marked in red.');
    else Toast.show('Now reading as '+S.reading.label+'. '+plural(steps.length,'step')+' re-ran.')
  }else Toast.show('Now reading as '+S.reading.label+' · '+plural(S.baseSchema.cols.length,'column')+' · '+plural(S.baseSchema.n,'row'))
}

const Status={
  render(){
    const el=$('#statusBar');if(!S.loaded){el.classList.add('hidden');return}
    el.classList.remove('hidden');clear(el);
    const v=S.view;
    el.append(h('span',{id:'statusRows'},h('b',{},fmtInt(v.n)),v.n!==v.total?' of '+fmtInt(v.total):'',' rows'),h('span',{class:'sb-opt'},h('b',{},String(v.schema.cols.length)),' columns'));
    const n=Sel.kind==='rows'?Sel.rowCount():Sel.kind==='cols'?Sel.colCount():Sel.kind==='cells'&&Sel.cellCount()>1?Sel.cellCount():0;
    if(n)el.append(h('span',{class:'sb-sel'},h('b',{},fmtInt(n)),' '+(Sel.kind==='rows'?(n===1?'row':'rows'):Sel.kind==='cols'?(n===1?'column':'columns'):'cells')+' selected'));
    el.append(h('span',{id:'selStats',class:'sb-opt'}));
    if(S.steps.length)el.append(h('span',{class:'sb-opt'},S.viewIdx===0?'Viewing original':'Viewing step '+S.viewIdx+' of '+S.steps.length));
    if(S.sort.length)el.append(h('span',{class:'sb-opt'},'View sorted by "'+S.sort[0].col+'"'));
    el.append(h('span',{class:'spacer'}));
    el.append(h('span',{id:'sbWork',class:'sb-work hidden'},h('i'),h('span')));
    el.append(h('span',{class:'sb-opt'},Engine.mode==='worker'?'Background engine on':'Main-thread engine'));
    this.selStats()
  },
  selStats:debounce(async function(){
    const el=$('#selStats');if(!el)return;
    if(!(Sel.kind==='cols'||(Sel.kind==='cells'&&Sel.cellCount()>1))){el.textContent='';return}
    let r;try{r=await Engine.call('selectionStats',{viewKey:S.view.key,selection:Sel.payload()},'selstats')}catch(e){return}
    if(!r.numericCount){el.textContent='';return}
    el.textContent='Sum '+W.fmtNum(r.sum)+' · Avg '+W.fmtNum(r.avg)+' · Min '+W.fmtNum(r.min)+' · Max '+W.fmtNum(r.max)
  },120),
  work(label){const el=$('#sbWork');if(!el)return;if(label){el.classList.remove('hidden');el.lastChild.textContent='Working… '+label}else el.classList.add('hidden')}
};

const Toolbar={
  render(){
    const el=$('#toolbar');if(!S.loaded){el.classList.add('hidden');return}
    el.classList.remove('hidden');clear(el);
    const groups=[['Rows','rows'],['Columns','columns'],['Text','text'],['Structure','structure'],['Reshape','reshape'],['Combine','combine'],['View','view']];
    const narrow=false;
    const mkMenuBtn=(label,ic,entries,cls)=>{const b=h('button',{type:'button',class:'tb-btn '+(cls||''),'aria-haspopup':'menu','aria-expanded':'false'},icon(ic,16),label,icon('chevDown',12));b.addEventListener('click',()=>{if(Menus.anchor===b){Menus.close();return}const r=b.getBoundingClientRect();Menus.open(entries(),r.left,r.bottom+4,b)});b.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();b.click()}});return b};
    el.append(mkMenuBtn('Actions','menu',()=>groups.map(g=>({label:g[0],icon:g[1],sub:Menus.groupEntries(g[0])})),'tb-narrow'));
    groups.forEach(g=>el.append(mkMenuBtn(g[0],g[1],()=>Menus.groupEntries(g[0]),'tb-wide')));
    el.append(h('span',{class:'tb-sep'}));
    const u=Commands.get('recipe.undo'),r=Commands.get('recipe.redo');
    this.undoBtn=h('button',{type:'button',class:'tb-btn',title:'Undo ('+fmtShortcut(u.shortcut)+')','aria-label':'Undo',onclick:()=>Commands.run(u)},icon('undo',16),h('span',{class:'tb-wide'},'Undo'));
    this.redoBtn=h('button',{type:'button',class:'tb-btn',title:'Redo ('+fmtShortcut(r.shortcut)+')','aria-label':'Redo',onclick:()=>Commands.run(r)},icon('redo',16),h('span',{class:'tb-wide'},'Redo'));
    el.append(this.undoBtn,this.redoBtn,h('span',{class:'tb-sep'}));
    const ws=h('input',{type:'checkbox',id:'wsToggle',checked:S.showWs,onchange:()=>Commands.run('view.whitespace')});
    el.append(h('label',{class:'tb-check'},ws,'Show whitespace'));
    el.append(h('span',{class:'spacer'}));
    el.append(h('button',{type:'button',class:'tb-btn',title:'Recipe panel','aria-label':'Recipe panel',onclick:()=>Panels.toggle('rail')},icon('panelLeft',16),h('span',{class:'tb-narrow-label'},'Recipe')));
    el.append(h('button',{type:'button',class:'tb-btn',title:'Inspector','aria-label':'Inspector',onclick:()=>Panels.toggle('inspector')},icon('panelRight',16),h('span',{class:'tb-mid-label'},'Inspector')));
    this.refreshState()
  },
  refreshState(){if(!this.undoBtn)return;this.undoBtn.setAttribute('aria-disabled',String(!S.undo.length));this.redoBtn.setAttribute('aria-disabled',String(!S.redo.length))}
};

const Coach={
  maybeShow(){if(!lsGet('weft.tips.v1',false))this.show()},
  show(){
    const el=$('#coach');clear(el).classList.remove('hidden');
    const tips=[['This is how Weft read your text. Change it in the bar above.','#readingBar'],['Click row numbers to select rows. Press Delete to remove them.','#grid'],['Every change becomes a step on the left. Undo, mute or reorder any time.','#rail']];
    el.append(h('ol',{},tips.map((t,i)=>h('li',{},h('span',{class:'n'},String(i+1)),h('span',{class:'t'},t[0]),h('button',{type:'button',onclick:()=>{const x=$(t[1]);if(!x)return;if(x.classList.contains('closed')||x.classList.contains('hidden'))Panels.toggle(t[1].slice(1));x.classList.add('pulse-ring');setTimeout(()=>x.classList.remove('pulse-ring'),2000)}},'Show me')))),
      h('button',{type:'button',class:'btn btn-xs btn-secondary',onclick:()=>{el.classList.add('hidden');lsSet('weft.tips.v1',true);Grid.paint()}},'Got it'))
  }
};
