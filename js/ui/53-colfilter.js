'use strict';
const CF_LIMIT=1000;
const CF_CONDS={
  text:[['equals','equals'],['notEquals','does not equal'],['startsWith','begins with'],['endsWith','ends with'],['contains','contains'],['notContains','does not contain'],['matches','matches pattern']],
  number:[['eq','='],['ne','≠'],['gt','>'],['gte','≥'],['lt','<'],['lte','≤'],['between','between'],['rel:top','top N'],['rel:bottom','bottom N'],['rel:above','above average'],['rel:below','below average']],
  date:[['lt','before'],['gt','after'],['between','between'],['rel:thisMonth','this month'],['rel:lastMonth','last month'],['rel:thisYear','this year'],['rel:lastDays','last N days']]
};
const CF_REL_LABEL={thisMonth:'is this month',lastMonth:'is last month',thisYear:'is this year',lastDays:'is in the last {n} days',top:'is in the top {n}',bottom:'is in the bottom {n}',above:'is above average',below:'is below average'};
const CF_TITLE={text:'Text filters',number:'Number filters',date:'Date filters'};

const ColFilter={
  pop:null,
  seq:0,
  active(){const k=Object.keys(S.colFilters||{});return k.length?S.colFilters:null},
  has(col){return!!(S.colFilters&&S.colFilters[col])},
  count(){return Object.keys(S.colFilters||{}).length},
  async set(col,node){
    if(!S.colFilters)S.colFilters={};
    if(node)S.colFilters[col]=node;else delete S.colFilters[col];
    await refreshView();
    announce(node?'Filter applied to '+col+'. '+plural(S.view.n,'row')+' shown.':'Filter cleared from '+col+'. '+plural(S.view.n,'row')+' shown.')
  },
  async clearAll(){
    if(!this.count())return;
    S.colFilters={};
    await refreshView();
    announce('All column filters cleared.')
  },
  prune(names){
    const gone=Object.keys(S.colFilters||{}).filter(c=>!names.has(c));
    if(!gone.length)return;
    gone.forEach(c=>{delete S.colFilters[c]});
    Toast.show(gone.length===1?'The filter on "'+gone[0]+'" was removed because that column is gone.':'Removed the filters on '+gone.map(c=>'"'+c+'"').join(', ')+' because those columns are gone.')
  },
  listModel(col,node){
    if(!node)return null;
    const leafIn=n=>n&&n.col===col&&n.op==='in'&&n.caseSensitive===true;
    const leafEmpty=n=>n&&n.col===col&&n.op==='isEmpty';
    if(leafIn(node))return{base:'none',set:new Set(node.values||[])};
    if(leafEmpty(node))return{base:'none',set:new Set([''])};
    if(node.op==='or'&&node.children.length===2&&leafIn(node.children[0])&&leafEmpty(node.children[1]))return{base:'none',set:new Set((node.children[0].values||[]).concat(['']))};
    if(node.op==='not'){
      if(leafIn(node.child))return{base:'all',set:new Set(node.child.values||[])};
      if(leafEmpty(node.child))return{base:'all',set:new Set([''])}
    }
    if(node.op==='and'&&node.children.length===2&&node.children[0].op==='not'&&node.children[1].op==='not'&&leafIn(node.children[0].child)&&leafEmpty(node.children[1].child))return{base:'all',set:new Set((node.children[0].child.values||[]).concat(['']))};
    return null
  },
  buildListNode(col,model,all){
    const inLeaf=values=>({col,op:'in',values,caseSensitive:true});
    const empty={col,op:'isEmpty',caseSensitive:false};
    if(model.base==='all'&&!model.set.size)return null;
    if(model.base==='none'||all){
      let values,blanks;
      if(model.base==='none'){values=Array.from(model.set).filter(v=>v!=='');blanks=model.set.has('')}
      else{values=all.values.filter(v=>!model.set.has(v));blanks=!model.set.has('')}
      if(values.length&&blanks)return{op:'or',children:[inLeaf(values),empty]};
      if(blanks)return empty;
      return inLeaf(values)
    }
    const values=Array.from(model.set).filter(v=>v!=='');
    const kids=[];
    if(values.length)kids.push({op:'not',child:inLeaf(values)});
    if(model.set.has(''))kids.push({op:'not',child:empty});
    return kids.length===1?kids[0]:{op:'and',children:kids}
  },
  describe(col,node){
    const model=this.listModel(col,node);
    const q=v=>'"'+W.trunc(v,18)+'"';
    if(model){
      const vals=Array.from(model.set).filter(v=>v!=='');
      const blanks=model.set.has('');
      const parts=vals.slice(0,4).map(q);
      if(vals.length>4)parts.push('+'+(vals.length-4)+' more');
      if(model.base==='none'){
        if(blanks)parts.push('(blanks)');
        if(!parts.length)return col+' matches nothing';
        return col+' is '+(parts.length>1?'one of ('+parts.join(', ')+')':parts[0])
      }
      const out=parts.slice();
      if(blanks)out.push('(blanks)');
      return col+' is not '+(out.length>1?'one of ('+out.join(', ')+')':out[0])
    }
    if(!W.isTreeGroup(node)){
      if(node.op==='relDate'||node.op==='relNum')return col+' '+(CF_REL_LABEL[node.rel]||node.rel).replace('{n}',node.n||'')
      return W.describeCond(node)
    }
    return W.describeTree(node)
  },
  chips(){
    return Object.keys(S.colFilters||{}).map(col=>({col,text:this.describe(col,S.colFilters[col])}))
  },
  async makeStep(only){
    if(!S.loaded)return;
    const useCols=only!=='search';
    if(!(useCols&&this.count())&&!S.search.trim()){Toast.show('Nothing to make into a step.');return}
    let r;
    try{r=await Engine.call('filterTree',{stateIdx:S.viewIdx,search:S.search,colFilters:useCols?S.colFilters:null})}
    catch(e){if(!isQuiet(e))Toast.err('Something went wrong: '+e.message);return}
    if(!r.tree){Toast.show('These filters do not match any column in the current table.');return}
    const saved={search:S.search,colFilters:S.colFilters};
    S.search='';$('#searchInput').value='';
    if(useCols)S.colFilters={};
    const ok=await addStep('filterRows',W.cfgFromTree('keep',r.tree),{msg:'Kept only the rows that match'+(useCols?' the filters':' the search')});
    if(!ok){S.search=saved.search;S.colFilters=saved.colFilters;$('#searchInput').value=saved.search;await refreshView();return}
    const snap=S.undo[S.undo.length-1];
    if(snap)snap.restore={search:saved.search,colFilters:useCols?W.clone(saved.colFilters):null}
  },
  toggleFunnels(){
    const on=!Prefs.get('funnels',true);
    Prefs.set('funnels',on);
    this.applyFunnels();
    announce(on?'Filter buttons shown.':'Filter buttons hidden.')
  },
  applyFunnels(){
    const g=$('#grid');
    if(g)g.classList.toggle('no-funnels',!Prefs.get('funnels',true))
  },
  openFor(col,anchor){
    if(!S.loaded||!col||curCols().indexOf(col)===-1)return;
    const a=anchor||$$('.gh[data-col]',Grid.head).find(x=>x.dataset.col===col);
    const btn=a&&(a.classList.contains('gh-filter')?a:a.querySelector('.gh-filter'));
    this.open(col,btn||a)
  },
  openCursor(){
    const cols=curCols();
    const col=Sel.focusCol()||cols[Math.max(0,Sel.cursor.col)];
    if(!col)return;
    const ci=cols.indexOf(col);
    if(ci!==-1)Grid.scrollToPos(Math.max(0,Sel.cursor.pos),ci);
    requestAnimationFrame(()=>this.openFor(col))
  },
  close(refocus){
    const p=this.pop;if(!p)return;
    this.pop=null;
    p.el.remove();p.scrim.remove();
    window.removeEventListener('resize',p.onResize);
    Layers.pop('colfilter');
    if(p.anchor)p.anchor.setAttribute('aria-expanded','false');
    if(refocus&&p.anchor&&document.contains(p.anchor))p.anchor.focus({preventScroll:true})
  },
  async open(col,anchor){
    this.close();
    const my=++this.seq;
    const type=colType(col);
    const existing=(S.colFilters||{})[col]||null;
    const model=this.listModel(col,existing);
    const st={col,type,mode:existing&&!model?'cond':'list',base:model?model.base:'all',set:model?new Set(model.set):new Set(),data:null,query:'',condKey:null};
    const sort=S.sort.find(k=>k.col===col);
    const scrim=h('div',{class:'cf-scrim',onmousedown:()=>this.close(true)});
    const el=h('div',{class:'cf-pop',role:'dialog','aria-label':'Filter '+col,'data-col':col});
    document.body.append(scrim,el);
    const onResize=()=>this.place();
    window.addEventListener('resize',onResize);
    this.pop={el,scrim,anchor,st,onResize,my};
    if(anchor)anchor.setAttribute('aria-expanded','true');
    Layers.push('colfilter',()=>this.close(true));
    el.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.close(true)}
    });
    this.render();
    this.place();
    let r;
    try{
      const vf=S.vfilter||{};
      r=await Engine.call('distinctValues',{col,stateIdx:S.viewIdx,search:S.search,colFilters:S.colFilters,filter:vf.filter||null,rowIds:vf.rowIds||null,limit:CF_LIMIT},'cf')
    }catch(e){
      if(isQuiet(e)||this.pop===null||this.pop.my!==my)return;
      this.close();Toast.err('Could not list the values: '+e.message);return
    }
    if(!this.pop||this.pop.my!==my)return;
    st.data=r;
    this.render();
    this.place();
    const f=el.querySelector('.cf-search');if(f&&st.mode==='list')f.focus()
  },
  place(){
    const p=this.pop;if(!p)return;
    if(matchMedia('(max-width:640px)').matches){p.el.classList.add('sheet');p.el.style.left='';p.el.style.top='';return}
    p.el.classList.remove('sheet');
    const r=p.anchor?p.anchor.getBoundingClientRect():{left:120,bottom:120,top:120};
    placeFloating(p.el,r.left,r.bottom+6,{flipY:r.top-6})
  },
  visibleValues(st){
    const d=st.data;if(!d)return[];
    const q=W.Q.norm(st.query.trim());
    const rows=[];
    if(d.blanks>0&&(!q||'(blanks)'.indexOf(q)!==-1))rows.push({v:'',n:d.blanks,blank:true});
    for(const x of d.values)if(!q||W.Q.norm(x.v).indexOf(q)!==-1)rows.push({v:x.v,n:x.n,blank:false});
    return rows
  },
  isChecked(st,v){return st.base==='all'?!st.set.has(v):st.set.has(v)},
  setChecked(st,v,on){
    const want=st.base==='all'?!on:on;
    if(want)st.set.add(v);else st.set.delete(v)
  },
  render(){
    const p=this.pop;if(!p)return;
    const st=p.st,el=p.el,col=st.col;
    const keep=el.querySelector('.cf-search');const hadFocus=keep&&document.activeElement===keep;const caret=hadFocus?keep.selectionStart:0;
    clear(el);
    const sk=S.sort.find(k=>k.col===col);
    const labels=st.type==='number'?['Sort smallest to largest','Sort largest to smallest']:st.type==='date'?['Sort oldest to newest','Sort newest to oldest']:['Sort A to Z','Sort Z to A'];
    el.append(h('div',{class:'cf-head'},h('span',{class:'cf-title',text:col}),h('button',{class:'icon-btn sm',type:'button','aria-label':'Close',onclick:()=>this.close(true)},icon('close',14))));
    el.append(h('div',{class:'cf-sort',role:'group','aria-label':'Sort'},
      h('button',{type:'button',class:'cf-sbtn','aria-pressed':String(!!sk&&sk.dir==='asc'),onclick:()=>{this.close(true);setViewSort(col,'asc')}},icon('sortAsc',14),labels[0]),
      h('button',{type:'button',class:'cf-sbtn','aria-pressed':String(!!sk&&sk.dir==='desc'),onclick:()=>{this.close(true);setViewSort(col,'desc')}},icon('sortDesc',14),labels[1])));
    if(st.mode==='cond')this.renderCond(el);else this.renderList(el);
    const has=this.has(col);
    const apply=h('button',{class:'btn btn-primary btn-sm',type:'button','data-act':'apply',onclick:()=>this.apply()},'Apply');
    el.append(h('div',{class:'cf-foot'},
      h('button',{class:'btn btn-ghost btn-sm cf-clear',type:'button',disabled:!has,onclick:()=>{this.close(true);this.set(col,null)}},'Clear filter from "'+W.trunc(col,22)+'"'),
      h('span',{class:'grow-1'}),
      h('button',{class:'btn btn-secondary btn-sm',type:'button','data-act':'cancel',onclick:()=>this.close(true)},'Cancel'),apply));
    if(hadFocus){const f=el.querySelector('.cf-search');if(f){f.focus();if(typeof f.setSelectionRange==='function'&&/^(text|search)$/.test(f.type))f.setSelectionRange(caret,caret)}}
  },
  renderList(el){
    const st=this.pop.st,d=st.data;
    const typeBtn=h('button',{type:'button',class:'cf-typebtn','aria-haspopup':'true',onclick:()=>{st.mode='cond';this.render();this.place()}},h('span',{},CF_TITLE[st.type]),icon('chevRight',14));
    el.append(typeBtn);
    const search=h('input',{class:'input cf-search',type:'text',placeholder:'Search values','aria-label':'Search the values of '+st.col,value:st.query,autocomplete:'off',spellcheck:false,oninput:e=>{st.query=e.target.value;this.render()}});
    el.append(h('div',{class:'cf-searchrow'},search));
    if(!d){el.append(h('div',{class:'cf-loading',role:'status'},'Listing values…'));return}
    const rows=this.visibleValues(st);
    const list=h('div',{class:'cf-list',role:'group','aria-label':'Values'});
    const allOn=rows.length>0&&rows.every(r=>this.isChecked(st,r.v));
    const anyOn=rows.some(r=>this.isChecked(st,r.v));
    const selAll=h('input',{type:'checkbox','aria-label':st.query.trim()?'Select all search results':'Select all',checked:allOn,indeterminate:anyOn&&!allOn,onchange:e=>{
      const on=e.target.checked;
      if(st.query.trim())rows.forEach(r=>this.setChecked(st,r.v,on));
      else{st.base=on?'all':'none';st.set=new Set()}
      this.render()
    }});
    list.append(h('label',{class:'cf-row cf-all'},selAll,h('span',{class:'cf-val'},st.query.trim()?'Select all search results':'Select all'),h('span',{class:'cf-n'},fmtInt(d.rows))));
    rows.forEach(r=>{
      const cb=h('input',{type:'checkbox','data-v':r.v,checked:this.isChecked(st,r.v),onchange:e=>{this.setChecked(st,r.v,e.target.checked);this.syncAll(list,rows,selAll)}});
      list.append(h('label',{class:'cf-row'+(r.blank?' blank':''),title:r.blank?'Empty cells':r.v},cb,h('span',{class:'cf-val'},r.blank?'(Blanks)':r.v),h('span',{class:'cf-n'},fmtInt(r.n))))
    });
    if(!rows.length)list.append(h('div',{class:'cf-empty'},st.query.trim()?'No values match "'+W.trunc(st.query,30)+'".':'No values.'));
    list.addEventListener('keydown',e=>{
      if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;
      const boxes=$$('input[type="checkbox"]',list);const i=boxes.indexOf(document.activeElement);
      if(i===-1)return;
      e.preventDefault();
      const n=boxes[Math.max(0,Math.min(boxes.length-1,i+(e.key==='ArrowDown'?1:-1)))];n&&n.focus()
    });
    el.append(list);
    if(d.truncated)el.append(h('div',{class:'cf-more'},'Showing the first '+fmtInt(CF_LIMIT)+' of '+fmtInt(d.total)+' values. Search to narrow the list.'));
    search.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'){e.preventDefault();const b=list.querySelector('input[type="checkbox"]');b&&b.focus()}
      else if(e.key==='Enter'){e.preventDefault();this.apply()}
    })
  },
  syncAll(list,rows,selAll){
    const st=this.pop.st;
    const allOn=rows.length>0&&rows.every(r=>this.isChecked(st,r.v));
    const anyOn=rows.some(r=>this.isChecked(st,r.v));
    selAll.checked=allOn;selAll.indeterminate=anyOn&&!allOn
  },
  condFromNode(st,node){
    if(!node||W.isTreeGroup(node))return null;
    if(node.op==='relDate'||node.op==='relNum')return{key:'rel:'+node.rel,node};
    return{key:node.op,node}
  },
  renderCond(el){
    const st=this.pop.st,col=st.col;
    const opts=CF_CONDS[st.type]||CF_CONDS.text;
    const cur=this.condFromNode(st,(S.colFilters||{})[col]);
    if(!st.condKey)st.condKey=cur&&opts.some(o=>o[0]===cur.key)?cur.key:opts[0][0];
    if(!st.condVals)st.condVals=cur?{value:cur.node.value==null?'':cur.node.value,value2:cur.node.value2==null?'':cur.node.value2,n:cur.node.n==null?'':String(cur.node.n)}:{value:'',value2:'',n:''};
    const back=h('button',{type:'button',class:'cf-typebtn back',onclick:()=>{st.mode='list';this.render();this.place()}},icon('back',14),h('span',{},'Back to the list of values'));
    el.append(back);
    const sel=h('select',{class:'select cf-op','aria-label':'Comparison',onchange:e=>{st.condKey=e.target.value;st.error='';st.focused=false;this.render()}},opts.map(o=>h('option',{value:o[0],selected:o[0]===st.condKey},o[1])));
    const need=this.needs(st.condKey);
    const ph=st.type==='date'?'e.g. 2026-03-31':st.type==='number'?'e.g. 100':st.condKey==='matches'?'pattern, e.g. ^ref \\d+$':'value';
    const body=h('div',{class:'cf-cond'},h('div',{class:'field'},h('label',{},CF_TITLE[st.type]),sel));
    if(need.value)body.append(h('div',{class:'field'},h('label',{},need.value2?'From':'Value'),h('input',{class:'input cf-v1'+(st.condKey==='matches'?' mono':''),type:'text',value:st.condVals.value,placeholder:ph,'aria-label':need.value2?'From':'Value',oninput:e=>{st.condVals.value=e.target.value;st.error=''},onkeydown:e=>{if(e.key==='Enter'){e.preventDefault();this.apply()}}})));
    if(need.value2)body.append(h('div',{class:'field'},h('label',{},'To'),h('input',{class:'input cf-v2',type:'text',value:st.condVals.value2,placeholder:ph,'aria-label':'To',oninput:e=>{st.condVals.value2=e.target.value;st.error=''},onkeydown:e=>{if(e.key==='Enter'){e.preventDefault();this.apply()}}})));
    if(need.n)body.append(h('div',{class:'field'},h('label',{},st.condKey==='rel:lastDays'?'Number of days':'How many'),h('input',{class:'input cf-n1',type:'text',inputmode:'numeric',value:st.condVals.n,placeholder:st.condKey==='rel:lastDays'?'e.g. 7':'e.g. 10','aria-label':'Count',oninput:e=>{st.condVals.n=e.target.value;st.error=''},onkeydown:e=>{if(e.key==='Enter'){e.preventDefault();this.apply()}}})));
    if(st.condKey.indexOf('rel:')===0)body.append(h('p',{class:'cf-note'},'Relative filters follow today\'s date and the data. When you make this a step, the values are fixed so the recipe stays the same every time it runs.'));
    body.append(h('div',{class:'cf-error',role:'alert'},st.error||''));
    el.append(body);
    const f=body.querySelector('.cf-v1,.cf-n1');if(f&&!st.focused){st.focused=true;setTimeout(()=>f.focus(),0)}
  },
  needs(key){
    if(key==='between')return{value:true,value2:true};
    if(key==='rel:top'||key==='rel:bottom'||key==='rel:lastDays')return{n:true};
    if(key.indexOf('rel:')===0)return{};
    return{value:true}
  },
  buildCond(st){
    const key=st.condKey,col=st.col,v=st.condVals,type=st.type;
    const need=this.needs(key);
    const fail=m=>({error:m});
    const checkVal=(raw,label)=>{
      const x=String(raw).trim();
      if(!x)return'Enter '+label+'.';
      if(key==='matches'){try{W.compileRegex(x,'i')}catch(e){return e.message||'That pattern is not valid.'}return null}
      if(type==='number'&&key!=='contains'){if(!W.parseNumber(x))return'"'+W.trunc(x,20)+'" is not a number.'}
      if(type==='date'){if(!W.parseDate(x,{order:S.dateOrder}))return'"'+W.trunc(x,20)+'" is not a date. Try 2026-03-31.'}
      return null
    };
    let value,value2,n;
    if(need.value){const m=checkVal(v.value,need.value2?'a start value':'a value');if(m)return fail(m);value=String(v.value).trim()}
    if(need.value2){const m=checkVal(v.value2,'an end value');if(m)return fail(m);value2=String(v.value2).trim()}
    if(need.n){const k=Math.floor(Number(String(v.n).trim()));if(!isFinite(k)||k<1||!/^\d+$/.test(String(v.n).trim()))return fail('Enter a whole number of 1 or more.');n=k}
    if(key.indexOf('rel:')===0){
      const rel=key.slice(4);
      const node={col,op:st.type==='date'?'relDate':'relNum',rel,caseSensitive:false};
      if(n!=null)node.n=n;
      return{node}
    }
    const node={col,op:key,value,caseSensitive:false};
    if(value2!=null)node.value2=value2;
    return{node}
  },
  apply(){
    const p=this.pop;if(!p)return;
    const st=p.st,col=st.col;
    if(st.mode==='cond'){
      const r=this.buildCond(st);
      if(r.error){st.error=r.error;this.render();const f=p.el.querySelector('.cf-v1,.cf-v2,.cf-n1');f&&f.focus();return}
      this.close(true);this.set(col,r.node);return
    }
    if(!st.data)return;
    const all=st.data.truncated?null:{values:st.data.values.map(x=>x.v)};
    const node=this.buildListNode(col,{base:st.base,set:st.set},all);
    this.close(true);this.set(col,node)
  }
};
