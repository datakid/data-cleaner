'use strict';
const Inspector={
  tab:'suggestions',issues:[],issuesKey:'',fixed:null,col:null,cell:null,
  init(){
    $$('.insp-tab').forEach(b=>b.addEventListener('click',()=>this.show(b.dataset.tab)));
    $('#inspTabs').addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;const t=['suggestions','column','cell'];const i=t.indexOf(this.tab);const n=t[(i+(e.key==='ArrowRight'?1:2))%3];this.show(n);$('.insp-tab[data-tab="'+n+'"]').focus()})
  },
  show(tab){
    this.tab=tab;
    $$('.insp-tab').forEach(b=>{const on=b.dataset.tab===tab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1});
    const ins=$('#inspector');if(ins.classList.contains('hidden')||ins.classList.contains('closed'))Panels.toggle('inspector');
    this.render()
  },
  refresh(force){
    if(force)this.issuesKey='';
    if(this.tab!=='suggestions'){this.render();return}
    clearTimeout(this.rt);
    const tick=()=>{const idle=performance.now()-Engine.lastActive;if(Busy.n>0||idle<450){this.rt=setTimeout(tick,Math.max(120,450-idle));return}this.render()};
    this.rt=setTimeout(tick,450)
  },
  onSelection(){if(this.tab==='column'){const c=Sel.focusCol();if(c&&c!==this.col){this.col=c;this.render()}}},
  onColumn(c){this.col=c;if(this.tab==='column')this.render()},
  onCell(){
    const c=Sel.cursor;const cols=curCols();const d=Grid.rowAt(c.pos);
    if(!d||c.col<0||c.col>=cols.length)return;
    this.cell={rowId:d.id,col:cols[c.col],pos:c.pos};this.col=cols[c.col];
    if(this.tab==='cell'||this.tab==='column')this.render()
  },
  async render(){
    if(!S.loaded)return;
    const body=$('#inspBody');
    if(this.tab==='suggestions')return this.renderIssues(body);
    if(this.tab==='column')return this.renderColumn(body);
    return this.renderCell(body)
  },
  async renderIssues(body){
    const key=S.view.stateIdx+'|'+S.steps.length+'|'+S.states.map(s=>s.n).join(',')+'|'+S.dateOrder;
    if(key!==this.issuesKey){
      let r;try{r=await Engine.call('issues',{stateIdx:S.viewIdx},'issues')}catch(e){if(e.stale)return;r={issues:[]}}
      this.issuesKey=key;
      this.issues=r.issues;
      $('#issueCount').textContent=this.issues.length?String(this.issues.length):'';
      $('#issueCount').classList.toggle('hidden',!this.issues.length)
    }
    if(this.tab!=='suggestions')return;
    clear(body);
    if(this.fixed)body.append(h('div',{class:'fixed-line'},h('span',{},'Fixed · '+this.fixed),h('button',{type:'button',onclick:()=>{this.fixed=null;doUndo()}},'Undo')));
    if(!this.issues.length){
      body.append(h('div',{class:'all-clear'},h('img',{src:'favicon.svg',alt:''}),h('b',{},'No obvious problems found.'),'You can still select rows or columns and use the toolbar menus.'));
      return
    }
    if(!atEnd())body.append(h('p',{class:'insp-note',style:{padding:'0 4px 10px',textAlign:'left'}},'Suggestions for step '+S.viewIdx+'. Fixes are inserted after it.'));
    this.issues.forEach(is=>{
      const card=h('div',{class:'issue-card sev-'+is.severity},
        h('div',{class:'ic-top'},h('span',{class:'ic-title'},is.title),is.count?h('span',{class:'count-badge'},fmtInt(is.count)):null),
        h('div',{class:'ic-detail'},is.detail),
        h('div',{class:'ic-actions'},
          is.showRows?h('button',{type:'button',class:'btn btn-xs btn-ghost',onclick:()=>{if(is.showRows.rowIds)VFilter.set(is.title.toLowerCase(),{rowIds:is.showRows.rowIds,stateIdx:S.viewIdx});else VFilter.set(is.title.toLowerCase(),{filter:is.showRows.filter,stateIdx:S.viewIdx})}},'Show rows'):null,
          is.fix?h('button',{type:'button',class:'btn btn-xs btn-secondary',onclick:()=>{const d=W.OPS[is.fix.opId];if(d.fields.length)stepDialog(is.fix.opId,is.fix.cfg,{title:d.label}).then(r=>r&&this.applyFix(card,is,r))}},'Adjust…'):null,
          is.fix?h('button',{type:'button',class:'btn btn-xs btn-primary',onclick:()=>this.applyFix(card,is,is.fix.cfg)},icon('wand',14),'Fix'):null));
      body.append(card)
    })
  },
  async applyFix(card,is,cfg){
    card.style.opacity='0';card.style.transform='translateX(8px)';
    const ok=await addStep(is.fix.opId,cfg,{silent:true});
    if(ok){const m=S.meta[S.viewIdx-1];const chips=m&&m.chips?m.chips.filter(c=>c.kind!=='none').map(c=>c.text).join(', '):'';this.fixed=is.title+(chips?' ('+chips+')':'');Toast.show('Fixed: '+is.title+(chips?' · '+chips:''),{undo:doUndo});VFilter.clear();setTimeout(()=>{this.fixed=null;if(this.tab==='suggestions')this.render()},4000)}
    this.issuesKey='';this.render()
  },
  async renderColumn(body){
    const col=this.col&&curCols().indexOf(this.col)!==-1?this.col:Sel.focusCol();
    clear(body);
    if(!col){body.append(h('p',{class:'insp-note'},'Click a column header or a cell to see its details.'));return}
    let p;try{p=await Engine.call('profile',{stateIdx:S.viewIdx,col},'profile')}catch(e){return}
    if(!p||this.tab!=='column')return;
    clear(body);
    body.append(h('div',{class:'prof-head'},p.col),h('div',{class:'prof-sub'},(p.type==='number'?'Numbers':p.type==='date'?'Dates':'Text')+' · '+plural(p.n,'row')));
    const kv=[['Filled',fmtInt(p.filled)+' ('+Math.round(p.n?p.filled/p.n*100:0)+'%)'],['Empty',fmtInt(p.empty)],['Distinct values',fmtInt(p.distinct)]];
    if(p.number)kv.push(['Smallest',W.fmtNum(p.number.min)],['Largest',W.fmtNum(p.number.max)],['Average',W.fmtNum(p.number.mean)],['Total',W.fmtNum(p.number.sum)]);
    if(p.number&&p.number.unparsed)kv.push(['Not numbers',fmtInt(p.number.unparsed)]);
    if(p.date)kv.push(['Earliest',p.date.min],['Latest',p.date.max]);
    if(p.date&&p.date.ambiguous)kv.push(['Ambiguous dates',fmtInt(p.date.ambiguous)]);
    if(p.date&&p.date.unparsed)kv.push(['Not dates',fmtInt(p.date.unparsed)]);
    kv.push(['Length',p.minLen===p.maxLen?String(p.minLen):p.minLen+'–'+p.maxLen+' characters']);
    if(p.wsIssues)kv.push(['Extra spaces',fmtInt(p.wsIssues)]);
    body.append(h('dl',{class:'kv'},kv.map(x=>[h('dt',{},x[0]),h('dd',{},x[1])])));
    if(p.top.length){
      const max=p.top[0].count;
      body.append(h('div',{class:'sec-title'},'Most common values'),h('div',{class:'topv prof-'+p.type},p.top.map(t=>h('button',{type:'button',title:'Select rows with this value',onclick:async()=>{const r=await Engine.call('columnValues',{stateIdx:S.viewIdx,col,value:t.value});Sel.selectRowIds(r.rowIds,'"'+col+'" is "'+trunc(t.value,20)+'"')}},h('span',{class:'tv'},t.value),h('span',{class:'tc'},fmtInt(t.count)),h('span',{class:'bar'},h('i',{style:{width:Math.max(3,t.count/max*100)+'%'}}))))))
    }
    body.append(h('div',{class:'sec-title',style:{marginTop:'16px'}},'Quick actions'),h('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px'}},
      ['columns.rename','text.trim','rows.removeWhere','columns.split','view.sortAsc'].map(id=>{const c=Commands.get(id);return h('button',{type:'button',class:'btn btn-xs btn-secondary',onclick:()=>{if(!(Sel.kind==='cols'&&Sel.cols.has(col)))Sel.selectCol(col);Commands.run(c)}},c.title.replace(/…$/,''))})))
  },
  async renderCell(body){
    clear(body);
    const c=this.cell;
    if(!c||curCols().indexOf(c.col)===-1){body.append(h('p',{class:'insp-note'},'Click a cell to see its full value and how each step changed it.'));return}
    const [v,lin]=await Promise.all([Engine.call('getCell',{stateIdx:S.viewIdx,rowId:c.rowId,col:c.col}),Engine.call('lineage',{rowId:c.rowId,col:c.col,uptoIdx:S.viewIdx})]).catch(()=>[null,null]);
    if(!v||this.tab!=='cell')return;
    clear(body);
    body.append(h('div',{class:'prof-head'},'"'+c.col+'", row '+fmtInt(c.pos+1)));
    const box=h('div',{class:'cell-full'});
    if(v.value==null)box.textContent='(This row is not in this step.)';else if(v.value==='')box.append(h('span',{style:{color:'var(--ink-mute)'}},'(empty)'));else Grid.fillWs(box,v.value);
    body.append(h('div',{class:'sec-title'},'Full value'),box,
      h('div',{style:{display:'flex',gap:'6px',marginBottom:'16px'}},h('button',{type:'button',class:'btn btn-xs btn-secondary',onclick:()=>copyText(v.value||'','Copied cell value')},icon('copy',14),'Copy'),h('button',{type:'button',class:'btn btn-xs btn-secondary',onclick:()=>Grid.startEdit(c.pos,curCols().indexOf(c.col))},icon('pencil',14),'Edit')));
    if(lin&&lin.items){
      body.append(h('div',{class:'sec-title'},'History of this cell'));
      body.append(h('ol',{class:'lineage'},lin.items.map(it=>h('li',{},it.label+(it.col!==c.col?' (column "'+it.col+'")':''),it.removed?h('code',{},'Row removed here'):it.value===undefined?h('code',{},'(column not present yet)'):h('code',{},it.value===''?'(empty)':it.value)))));
      if(lin.items.length<=1)body.append(h('p',{class:'insp-note',style:{textAlign:'left',padding:'4px 0'}},'No step has changed this cell yet.'))
    }
  }
};
