'use strict';
const Tabs={
  list:[],active:null,seq:1,groups:{},bound:false,
  get(id){return this.list.find(t=>t.id===id)},
  current(){return this.get(this.active)},
  idle(){return new Promise(res=>{const f=()=>Busy.n>0?setTimeout(f,50):res();f()})},
  uniqueName(n,self){
    const base=String(n||'').trim().slice(0,40).trim()||'Table';
    const used=new Set(this.list.filter(t=>t!==self).map(t=>t.name));
    if(!used.has(base))return base;
    let k=2;while(used.has(base+' ('+k+')'))k++;
    return base+' ('+k+')'
  },
  ensureFirst(name){
    if(this.list.length||!S.loaded)return this.current();
    const id=Engine.active;
    const t={id,name:this.uniqueName(name||S.file||'Pasted text'),group:null,origin:'paste',payload:Engine.loads[id]||null,ui:null,scroll:{top:0,left:0}};
    this.list.push(t);this.active=id;this.render();
    return t
  },
  noteLoaded(name,origin){
    if(!this.list.length){this.ensureFirst(name);return}
    const t=this.current();if(!t)return;
    t.payload=Engine.loads[Engine.active]||t.payload;t.name=this.uniqueName(name,t);t.group=null;t.origin=origin;
    this.render()
  },
  stash(noScroll){
    const t=this.current();if(!t)return;
    t.ui={};TAB_FIELDS.forEach(k=>{t.ui[k]=S[k]});
    if(!noScroll&&Grid.sc)t.scroll={top:Grid.sc.scrollTop,left:Grid.sc.scrollLeft}
  },
  restore(t){
    Object.assign(S,t.ui);S.loaded=true;
    if(!S.colFilters)S.colFilters={};
    $('#searchInput').value=S.search||'';
    Sel.clear(true);Sel.cursor={pos:0,col:0};
    Inspector.cell=null;Inspector.col=null;
    Grid.pages.clear();Grid.lru=[];Grid.inflight.clear()
  },
  async paintAll(t){
    App.showWorkspace();
    await refreshView();
    if(t&&t.scroll){Grid.sc.scrollTop=t.scroll.top;Grid.sc.scrollLeft=t.scroll.left}
    Grid.paint();
    ReadingBar.render();Rail.render();Scrub.render();
    Inspector.refresh(true);Status.render();this.render()
  },
  async activate(id,opts){
    if(opts&&opts.wait){await this.idle();while(this.switching)await new Promise(r=>setTimeout(r,30))}
    if(this.switching)return;
    if(id===this.active)return;
    const t=this.get(id);if(!t||!t.ui)return;
    if(Busy.n>0){Toast.show('Wait for the current step to finish.');return}
    this.switching=true;
    try{
      this.stash();
      try{await Engine.call('tableUse',{id})}catch(e){if(!isQuiet(e))Toast.err(e.message);return}
      try{const pr=await Engine.call('pipelineInfo',{tableId:id});t.ui.meta=pr.stepsMeta;t.ui.states=pr.states}catch(e){}
      this.active=id;
      this.restore(t);
      await this.paintAll(t);
      Session.save();
      announce(t.name+', '+plural(S.view.total,'row')+' × '+plural(curCols().length,'column'))
    }finally{this.switching=false}
  },
  async create(o){
    if(Tabs.switching){Toast.show('Wait for the table to finish switching.');return false}
    await this.idle();
    const reuse=!this.list.length;
    if(!reuse)this.stash();
    const keep=reuse?null:this.active;
    const id=reuse?Engine.active:'t'+(++this.seq)+Date.now().toString(36);
    if(!reuse){try{await Engine.call('tableNew',{id})}catch(e){if(!isQuiet(e))Toast.err(e.message);return null}}
    let r;
    try{r=await Busy.run('Reading '+o.name,()=>Engine.call('load',o.payload))}
    catch(e){
      if(!reuse){
        await Engine.call('tableClose',{id}).catch(()=>{});
        if(keep)await Engine.call('tableUse',{id:keep}).catch(()=>{})
      }
      if(!isQuiet(e))Toast.err(e.message);return null
    }
    const n=r.baseSchema.n,pl=o.payload;
    const ui=Object.assign(loadState(r,{fileName:pl.fileName}),{
      view:{key:null,n,total:n,stateIdx:0,schema:r.baseSchema},
      sourceText:{text:pl.text,html:pl.htmlTables||null},htmlTables:pl.htmlTables||null,htmlCount:pl.htmlTables?pl.htmlTables.length:0,contract:null
    });
    const t={id,name:this.uniqueName(o.name),group:o.group||null,origin:o.origin||'paste',payload:pl,ui,scroll:{top:0,left:0}};
    const at=o.at==null?this.list.length:Math.max(0,Math.min(o.at,this.list.length));
    this.list.splice(at,0,t);
    if(o.activate||reuse){this.active=id;this.restore(t);await this.paintAll(t)}
    else{
      if(keep)await Engine.call('tableUse',{id:keep}).catch(()=>{});
      this.render()
    }
    Session.save();
    return t
  },
  async close(id,force){
    const t=this.get(id);if(!t)return false;
    if(Busy.n>0){Toast.show('Wait for the current step to finish.');return false}
    const n=((id===this.active?S.steps:t.ui&&t.ui.steps)||[]).length;
    if(n&&!force&&!(await Dialog.confirm('Close "'+t.name+'"?','Its recipe ('+plural(n,'step')+') will be lost. Save it to the library first if you need it.','Close table',true)))return false;
    if(this.list.length===1){await App.reset();return true}
    await this.drop(id);
    return true
  },
  async drop(id){
    if(Tabs.switching){Toast.show('Wait for the table to finish switching.');return false}
    const i=this.list.findIndex(t=>t.id===id);if(i<0)return;
    const was=id===this.active,g=this.list[i].group;
    this.list.splice(i,1);
    if(g&&!this.list.some(t=>t.group===g))delete this.groups[g];
    await Engine.call('tableClose',{id});
    if(was){
      const nb=this.list[Math.min(i,this.list.length-1)];
      await Engine.call('tableUse',{id:nb.id});
      this.active=nb.id;this.restore(nb);await this.paintAll(nb)
    }else this.render();
    Session.save()
  },
  async rename(id){
    const t=this.get(id||this.active);if(!t)return;
    const v=await Dialog.prompt('Rename table','Name',t.name,'Rename');
    if(!v)return;
    t.name=this.uniqueName(v,t);
    this.render();
    Session.save()
  },
  async openFound(src,found,mode){
    const group='g'+Date.now().toString(36)+(++this.seq);
    const lines=src.text?W.normalizeInput(src.text).split('\n'):[];
    const prefix=src.fileName?src.fileName+' ▸ ':'';
    const mk=x=>x.source==='html'
      ?{text:'',fileName:prefix+x.title,htmlTables:[src.htmlTables[x.htmlIndex]]}
      :{text:W.sliceLines(lines,x.from,x.to),fileName:prefix+x.title,htmlTables:null};
    const items=found.tables;
    const replace=mode==='replace'||!S.loaded;
    let rest=items,at,made=0,first=null;
    if(replace){
      const p=mk(items[0]);
      const ok=await Input.loadSingle(p.text,p.fileName,p.htmlTables,{quiet:true});
      if(!ok)return false;
      let t=this.current();
      if(!t)t=this.ensureFirst(items[0].title);
      t.name=this.uniqueName(items[0].title,t);t.group=group;t.origin='split';t.payload=Engine.loads[Engine.active]||p;
      first=t;made=1;rest=items.slice(1);at=this.list.indexOf(t)+1
    }else{
      this.ensureFirst(S.file||'Pasted text');
      at=this.list.indexOf(this.current())+1
    }
    for(const x of rest){
      const t=await this.create({name:x.title,origin:'split',group,payload:mk(x),activate:false,at});
      if(t){at=this.list.indexOf(t)+1;made++;if(!first)first=t}
    }
    this.groups[group]=src;
    if(first&&first.id!==this.active)await this.activate(first.id,{wait:true});
    this.render();
    const M=W.MULTI;
    Toast.show((made===found.total||found.truncated?'Found '+found.total+' tables. Each one opened in its own tab.':'Found '+found.total+' tables; '+made+' opened in tabs.')+(found.truncated?' Showing the first '+M.maxTables+'.':'')+(found.skipped?' '+plural(found.skipped,'text passage')+' between them were left out.':''),
      {duration:9000,action:{label:src.htmlTables&&src.htmlTables.length?'Keep the largest table':'Keep as one table',fn:()=>Tabs.mergeBack(group,src)}});
    announce('Opened '+plural(made,'table')+' in separate tabs');
    return made>0
  },
  async mergeBack(group,src){
    src=src||this.groups[group];
    const ids=this.list.filter(t=>t.group===group);
    if(!src||!ids.length){Toast.show('This table was not split from a paste.');return}
    if(ids.length<2){Toast.show('Only one table from this paste is still open, so there is nothing to join.');return}
    if(Busy.n>0){Toast.show('Wait for the current step to finish.');return}
    this.stash(true);
    const steps=ids.reduce((a,t)=>a+((t.id===this.active?S.steps:t.ui&&t.ui.steps)||[]).length,0);
    if(steps&&!(await Dialog.confirm('Join these tables back into one?','The recipes on these '+plural(ids.length,'table')+' ('+plural(steps,'step')+') will be lost.','Join tables',true)))return;
    if(this.active!==ids[0].id)await this.activate(ids[0].id,{wait:true});
    const ok=await Input.loadText(src.text||'',src.fileName||'',null,{single:true,target:'replace',htmlTables:src.htmlTables||null});
    if(!ok)return;
    for(const t of ids.slice(1))await this.drop(t.id);
    const c=this.current();
    if(c){c.group=null;c.origin='paste';c.name=this.uniqueName(src.fileName||'Pasted text',c)}
    delete this.groups[group];
    this.render();Session.save();
    if(src.htmlTables&&src.htmlTables.length)Toast.show('Kept the largest table from this page.')
  },
  async fromResult(name,origin,payload,at){
    this.ensureFirst(S.file||'Pasted text');
    const cur=this.current();
    return this.create({name:name||(cur?cur.name:'Table'),origin,payload,activate:true,at:cur?this.list.indexOf(cur)+1:null})
  },
  async extractSelection(){
    if(!S.loaded||Sel.kind!=='rows'||!Sel.rowCount())return;
    const r=await Busy.run('Copying rows',()=>withFreshView(()=>Engine.call('export',selectionExportPayload('tsv'))));
    this.ensureFirst(S.file||'Pasted text');
    const cur=this.current();
    const t=await this.fromResult(cur.name+' · rows','extract',{text:r.text,fileName:S.file,htmlTables:null,hint:{kind:'delimited',params:{delimiter:'\t',quote:'"',header:true},force:true}});
    if(t)Toast.show('Opened '+plural(r.rows,'row')+' as a new table')
  },  async splitAtRow(){
    if(!S.loaded)return;
    if(this.switching||Busy.n>0){Toast.show('Wait for the current step to finish.');return}
    if(S.sort.length||S.search||S.vfilter){Toast.err('Clear the sort, search and filter first, so the row position is clear.');return}
    if(!atEnd()){Toast.err('View the final result first. The split works on the end of the recipe.');return}
    const ids=Sel.kind==='rows'&&!Sel.rows.all&&Sel.rowCount()===1?Sel.rowIdsArray():[];
    if(ids.length!==1){Toast.err('Select the one row where the second table starts.');return}
    const p=await withFreshView(()=>Engine.call('positionOfRow',{viewKey:S.view.key,rowId:ids[0]}));
    const pos=p.pos,n=S.view.n;
    if(pos<1){Toast.err('Pick a row below the first row.');return}
    if(pos>n-2){Toast.err('The second table needs its header row and at least one row under it.');return}
    const rng=await withFreshView(()=>Engine.call('rowIdsForRange',{viewKey:S.view.key,a:pos,b:n-1}));
    const r=await Busy.run('Splitting the table',()=>withFreshView(()=>Engine.call('export',{scope:'selected',viewKey:S.view.key,format:'tsv',selection:{kind:'rows',rows:{all:false,ids:rng.rowIds,except:[]},cols:[],rect:null},options:{header:false,formulaGuard:false}})));
    this.ensureFirst(S.file||'Pasted text');
    const cur=this.current();
    const t=await this.create({name:cur.name+' (part 2)',origin:'extract',payload:{text:r.text,fileName:S.file,htmlTables:null,hint:{kind:'delimited',params:{delimiter:'\t',quote:'"',header:true},force:true}},activate:false,at:this.list.indexOf(cur)+1});
    if(!t)return;
    Sel.clear(true);
    const done=await addStep('removeRowIds',{mode:'ids',rowIds:rng.rowIds},{msg:'Moved '+plural(rng.rowIds.length,'row')+' to "'+t.name+'"'});
    if(done)announce('Split into two tables');
    else{await this.close(t.id,true);Toast.err('The split could not be finished. Nothing was changed.')}
  },

  async duplicate(){
    if(!S.loaded)return;
    const r=await Busy.run('Copying the result',()=>Engine.call('export',{scope:'final',format:'tsv',options:{header:true}}));
    this.ensureFirst(S.file||'Pasted text');
    const cur=this.current();
    const t=await this.fromResult(cur.name+' · copy','duplicate',{text:r.text,fileName:S.file,htmlTables:null,hint:{kind:'delimited',params:{delimiter:'\t',quote:'"',header:true},force:true}});
    if(t)Toast.show('Opened a copy of the result as a new table')
  },
  async exportWorkbook(name){
    if(this.list.length<2)return;
    if(Busy.n>0){Toast.show('Wait for the current step to finish.');return}
    this.stash(true);
    const sheets=[];
    for(const t of this.list){
      const r=await Busy.run('Building workbook',()=>Engine.call('exportTable',{id:t.id,format:'xlsx',options:{header:true}}));
      sheets.push({r,name:t.name})
    }
    let fn=String(name||'').trim()||'weft-tables.xlsx';if(!/\.xlsx$/i.test(fn))fn+='.xlsx';
    await Xlsx.writeBook(sheets,fn);
    Toast.show('Downloaded '+plural(this.list.length,'table')+' as one workbook')
  },
  async restoreAll(d){
    const items=d.tabs||[];
    const map={};let n=0;
    for(const r of (d.refs||[])){try{await Engine.call('refLoad',r)}catch(e){}}
    for(let k=0;k<items.length;k++){
      const x=items[k],p=x&&x.payload;
      if(!p||!((p.text&&p.text.trim())||(p.htmlTables&&p.htmlTables.length)))continue;
      let ok;
      if(!this.list.length){
        ok=await Input.loadText(p.text||'',p.fileName||'',null,{single:true,htmlTables:p.htmlTables||null,hint:p.hint||null});
        if(ok){const t=this.current();if(t){t.name=this.uniqueName(x.name,t);t.origin='restore'}}
      }else ok=!!(await this.create({name:x.name,origin:'restore',payload:p,activate:true}));
      if(!ok)continue;
      n++;map[k]=this.active;
      await App.applyStoredReading(x.reading);
      if(x.steps&&x.steps.length)await setPipeline(x.steps,0,{noUndo:true})
    }
    if(!n)return false;
    const want=map[d.activeIdx];
    if(want&&want!==this.active)await this.activate(want,{wait:true});
    return true
  },
  size(t){
    const st=t.id===this.active?S.states:(t.ui&&t.ui.states)||[];
    const l=st[st.length-1];
    return l?fmtInt(l.n)+' × '+l.cols:''
  },
  bind(el){
    if(this.bound)return;
    this.bound=true;
    el.addEventListener('click',e=>{
      const add=e.target.closest('.tt-add');
      if(add){
        if(Menus.anchor===add){Menus.close();return}
        const r=add.getBoundingClientRect();
        Menus.open(['tables.newFromClipboard','tables.openFile','tables.duplicate','tables.extractSelection'].map(id=>Commands.get(id)),r.left,r.bottom+6,add);
        return
      }
      const tab=e.target.closest('.tt');if(!tab)return;
      if(e.target.closest('.tt-x'))this.close(tab.dataset.id);
      else this.activate(tab.dataset.id)
    });
    el.addEventListener('dblclick',e=>{const tab=e.target.closest('.tt');if(tab&&!e.target.closest('.tt-x'))this.rename(tab.dataset.id)});
    el.addEventListener('keydown',e=>{
      const tab=e.target.closest('.tt');if(!tab)return;
      const tabs=$$('.tt',el),i=tabs.indexOf(tab);
      const go=j=>{e.preventDefault();const n=tabs[(j+tabs.length)%tabs.length];if(n)n.focus()};
      if(e.key==='ArrowRight')go(i+1);
      else if(e.key==='ArrowLeft')go(i-1);
      else if(e.key==='Home')go(0);
      else if(e.key==='End')go(tabs.length-1);
      else if(e.key==='Delete'){e.preventDefault();this.close(tab.dataset.id)}
      else if(e.key==='F2'){e.preventDefault();this.rename(tab.dataset.id)}
    })
  },
  render(){
    const el=$('#tableTabs');if(!el)return;
    this.bind(el);
    const hide=this.list.length<2;
    el.classList.toggle('hidden',hide);
    if(hide){clear(el);return}
    const fa=document.activeElement,fid=fa&&el.contains(fa)?(fa.dataset.id||(fa.classList.contains('tt-add')?'add':null)):null;
    clear(el);
    this.list.forEach(t=>{
      const on=t.id===this.active;
      el.append(h('button',{type:'button',class:'tt',role:'tab',id:'tab-'+t.id,'aria-selected':String(on),tabindex:on?'0':'-1','aria-controls':'workspace',title:t.name+' (press Delete to close)',dataset:{id:t.id}},
        h('span',{class:'tt-name'},t.name),
        h('span',{class:'tt-size'},this.size(t)),
        h('span',{class:'tt-x','aria-hidden':'true','aria-label':'Close '+t.name},icon('close',12))))
    });
    el.append(h('button',{type:'button',class:'tt-add','aria-haspopup':'menu','aria-label':'Add a table',title:'Add a table'},icon('plus',16)));
    const a=$('.tt[aria-selected="true"]',el);
    if(a)a.scrollIntoView({block:'nearest',inline:'nearest'});
    if(fid){const n=fid==='add'?$('.tt-add',el):$('.tt[data-id="'+fid+'"]',el);if(n)n.focus({preventScroll:true})}
  }
};
