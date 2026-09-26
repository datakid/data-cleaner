'use strict';
const Sel={
  kind:'none',rows:{all:false,ids:new Set(),except:new Set()},cols:new Set(),rect:null,anchor:null,cursor:{pos:0,col:0},rowAnchor:null,
  clear(silent){this.kind='none';this.rows={all:false,ids:new Set(),except:new Set()};this.cols=new Set();this.rect=null;this.anchor=null;this.rowAnchor=null;if(!silent)this.changed()},
  rowSelected(id){const r=this.rows;return r.all?!r.except.has(id):r.ids.has(id)},
  rowCount(){if(this.kind!=='rows')return 0;const r=this.rows;return r.all?Math.max(0,S.view.n-r.except.size):r.ids.size},
  colCount(){return this.kind==='cols'?this.cols.size:0},
  cellCount(){if(this.kind!=='cells'||!this.rect)return 0;const r=this.rect;return(r.r1-r.r0+1)*(r.c1-r.c0+1)},
  selectedCols(){return Array.from(this.cols).filter(c=>curCols().indexOf(c)!==-1)},
  focusCol(){const cols=curCols();if(this.kind==='cols'&&this.cols.size)return Array.from(this.cols)[0];const c=this.cursor.col;return c>=0&&c<cols.length?cols[c]:null},
  rowIdsArray(){return Array.from(this.rows.all?this.rows.except:this.rows.ids)},
  payload(){return{kind:this.kind,rows:{all:this.rows.all,ids:Array.from(this.rows.ids),except:Array.from(this.rows.except)},cols:Array.from(this.cols),rect:this.rect}},
  setRowOnly(id,pos){this.kind='rows';this.cols=new Set();this.rect=null;this.rows={all:false,ids:new Set([id]),except:new Set()};this.rowAnchor=pos;this.cursor={pos,col:-1};this.changed()},
  toggleRow(id,pos){
    if(this.kind!=='rows'){this.kind='rows';this.cols=new Set();this.rect=null;this.rows={all:false,ids:new Set(),except:new Set()}}
    const r=this.rows;
    if(r.all){r.except.has(id)?r.except.delete(id):r.except.add(id)}else{r.ids.has(id)?r.ids.delete(id):r.ids.add(id)}
    this.rowAnchor=pos;this.cursor={pos,col:-1};
    if(this.rowCount()===0)this.kind='none';
    this.changed()
  },
  async rangeRows(a,b,additive){
    const lo=Math.min(a,b),hi=Math.max(a,b);
    if(lo===0&&hi>=S.view.n-1&&!additive){this.selectAllRows();return}
    if(hi-lo>50000)Toast.show('Large selection; this may take a moment.');
    const r=await Engine.call('rowIdsForRange',{viewKey:S.view.key,a:lo,b:hi});
    if(this.kind!=='rows'||!additive){this.kind='rows';this.cols=new Set();this.rect=null;this.rows={all:false,ids:new Set(),except:new Set()}}
    if(this.rows.all)r.rowIds.forEach(id=>this.rows.except.delete(id));else r.rowIds.forEach(id=>this.rows.ids.add(id));
    this.cursor={pos:b,col:-1};this.changed()
  },
  selectAllRows(){this.kind='rows';this.cols=new Set();this.rect=null;this.rows={all:true,ids:new Set(),except:new Set()};this.changed();announce('All '+plural(S.view.n,'row')+' selected.')},
  invertRows(){
    if(this.kind!=='rows'){this.selectAllRows();return}
    const r=this.rows;
    this.rows=r.all?{all:false,ids:new Set(r.except),except:new Set()}:{all:true,ids:new Set(),except:new Set(r.ids)};
    if(this.rowCount()===0)this.kind='none';
    this.changed()
  },
  async selectRowIds(ids,label){this.kind='rows';this.cols=new Set();this.rect=null;this.rows={all:false,ids:new Set(ids),except:new Set()};this.changed();Toast.show('Selected '+plural(ids.length,'row')+(label?' where '+label:'')+'.')},
  selectCol(name,shift,mod){
    const cols=curCols();const i=cols.indexOf(name);if(i===-1)return;
    if(this.kind!=='cols'||(!shift&&!mod)){this.kind='cols';this.rows={all:false,ids:new Set(),except:new Set()};this.rect=null;this.cols=new Set([name])}
    else if(mod){this.cols.has(name)?this.cols.delete(name):this.cols.add(name);if(!this.cols.size)this.kind='none'}
    else if(shift){const a=cols.indexOf(this.colAnchor||name);const lo=Math.min(a,i),hi=Math.max(a,i);this.cols=new Set(cols.slice(lo,hi+1))}
    if(!shift)this.colAnchor=name;
    this.cursor={pos:this.cursor.pos,col:i};
    this.changed();
    announce('Column '+name+' selected. '+plural(this.cols.size,'column')+' selected.')
  },
  setCell(pos,col,extend){
    if(extend&&this.anchor){
      const a=this.anchor;this.kind='cells';
      this.rect={r0:Math.min(a.pos,pos),r1:Math.max(a.pos,pos),c0:Math.min(a.col,col),c1:Math.max(a.col,col)}
    }else{
      this.kind='cells';this.anchor={pos,col};this.rect={r0:pos,r1:pos,c0:col,c1:col};
      this.rows={all:false,ids:new Set(),except:new Set()};this.cols=new Set()
    }
    this.cursor={pos,col};this.changed()
  },
  pruneCols(names){let ch=false;this.cols.forEach(c=>{if(!names.has(c)){this.cols.delete(c);ch=true}});if(ch&&!this.cols.size&&this.kind==='cols')this.kind='none';const nc=names.size;if(this.cursor.col>=nc)this.cursor.col=Math.max(0,nc-1);if(this.rect&&(this.rect.c1>=nc||this.rect.r1>=S.view.n)){this.rect=null;if(this.kind==='cells')this.kind='none'}},
  changed(){Grid.paint();Status.render();Status.selStats();Inspector.onSelection();Toolbar.refreshState()}
};

async function ensureRowIdsForStep(){
  const r=Sel.rows;
  if(!r.all)return{mode:'ids',rowIds:Array.from(r.ids)};
  if(S.view.n===S.view.total)return{mode:'allExcept',rowIds:Array.from(r.except)};
  const all=await Engine.call('rowIdsForView',{viewKey:S.view.key});
  return{mode:'ids',rowIds:all.rowIds.filter(id=>!r.except.has(id))}
}

async function deleteSelection(){
  if(!S.loaded)return;
  if(Sel.kind==='rows'&&Sel.rowCount()>0){
    const n=Sel.rowCount();const cfg=await ensureRowIdsForStep();
    Sel.clear(true);
    await addStep('removeRowIds',cfg,{msg:'Deleted '+plural(n,'row')});
  }else if(Sel.kind==='cols'&&Sel.cols.size){
    const cols=Sel.selectedCols();Sel.clear(true);
    await addStep('dropColumn',{columns:cols},{msg:cols.length===1?'Deleted column "'+cols[0]+'"':'Deleted '+plural(cols.length,'column')});
  }else if(Sel.kind==='cells'&&Sel.rect){
    const r=Sel.rect;const n=Sel.cellCount();
    if(n>20000){Toast.err('Select up to 20,000 cells to clear, or delete whole rows or columns instead.');return}
    const ids=(await Engine.call('rowIdsForRange',{viewKey:S.view.key,a:r.r0,b:r.r1})).rowIds;
    const cols=curCols().slice(r.c0,r.c1+1);
    await addSteps(cols.map(c=>({opId:'cellOverride',cfg:{column:c,overrides:ids.map(id=>({rowId:id,value:''}))}})),'Cleared '+plural(n,'cell'));
  }else Toast.show('Select rows, columns or cells first.')
}
async function keepSelection(){
  if(Sel.kind==='cols'&&Sel.cols.size){const cols=Sel.selectedCols();Sel.clear(true);await addStep('selectColumns',{columns:cols},{msg:'Kept '+plural(cols.length,'column')});return}
  if(Sel.kind!=='rows'||!Sel.rowCount()){Toast.show('Select one or more rows first (click a row number).');return}
  if(Sel.rows.all&&!Sel.rows.except.size&&S.view.n===S.view.total){Toast.show('All rows are already kept.');return}
  const n=Sel.rowCount();const cfg=await ensureRowIdsForStep();Sel.clear(true);
  await addStep('keepRowIds',cfg,{msg:'Kept '+plural(n,'row')+', removed the rest'})
}
async function addSteps(list,msg){
  const steps=cleanSteps(S.steps);const idx=S.viewIdx;
  steps.splice(idx,0,...list.map(s=>({id:newStepId(),opId:s.opId,cfg:s.cfg,muted:false})));
  const ok=await setPipeline(steps,idx,{viewIdx:idx+list.length});
  if(ok)Toast.show(msg,{undo:doUndo});
  return ok
}
async function copySelection(){
  if(!S.loaded)return;
  const cols=curCols();
  let text='';
  if(Sel.kind==='cells'&&Sel.rect){
    const r=Sel.rect;if(Sel.cellCount()>200000){Toast.err('That is too many cells to copy. Use Export instead.');return}
    const lines=[];
    for(let s=r.r0;s<=r.r1;s+=512){const g=await Engine.call('getRows',{viewKey:S.view.key,start:s,count:Math.min(512,r.r1-s+1)});g.rows.forEach(row=>lines.push(row.slice(r.c0,r.c1+1).join('\t')))}
    text=lines.join('\n');await copyText(text,'Copied '+plural(Sel.cellCount(),'cell'));return
  }
  const p={scope:'view',viewKey:S.view.key,format:'tsv',options:{header:true}};
  if(Sel.kind==='rows'){p.scope='selected';p.selection=Sel.payload()}
  else if(Sel.kind==='cols')p.columns=Sel.selectedCols();
  else{const c=Sel.cursor;if(c.col>=0&&c.col<cols.length){const rr=Grid.rowAt(c.pos);if(rr){await copyText(rr.row[c.col],'Copied cell');return}}}
  const r=await Engine.call('export',p);
  await copyText(r.text.replace(/\n$/,''),'Copied '+plural(r.rows,'row')+(p.columns?' × '+plural(p.columns.length,'column'):''))
}
async function selectedRowIdsList(limit){
  if(Sel.kind!=='rows')return[];
  const cfg=await ensureRowIdsForStep();
  if(cfg.mode==='ids')return cfg.rowIds.slice(0,limit||1e9);
  const all=await Engine.call('rowIdsForView',{viewKey:S.view.key});const ex=new Set(cfg.rowIds);return all.rowIds.filter(id=>!ex.has(id)).slice(0,limit||1e9)
}
