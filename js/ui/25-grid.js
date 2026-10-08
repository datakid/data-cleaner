'use strict';
const Grid={
  pool:[],widths:[],idxW:64,pages:new Map(),lru:[],inflight:new Set(),rowH:34,lastTop:0,editing:null,dragSel:null,
  init(){
    this.sc=$('#gscroll');this.head=$('#ghead');this.body=$('#gbody');this.sizer=$('#gsizer');this.rect=$('#selrect');
    this.rowH_();
    this.scrollY=0;this.scrollX=0;
    let raf=0;
    this.sc.addEventListener('scroll',()=>{
      this.scrollY=this.sc.scrollTop;this.scrollX=this.sc.scrollLeft;
      this.sc.classList.toggle('scrolled-x',this.scrollX>0);this.sc.classList.toggle('scrolled-y',this.scrollY>0);
      if(!raf)raf=requestAnimationFrame(()=>{raf=0;this.paint()});
      if(Halo.el)Halo.close()
    },{passive:true});
    new ResizeObserver(en=>{const r=en[0]&&en[0].contentRect;this.vh=r&&r.height?r.height:0;this.paint()}).observe(this.sc);
    this.body.addEventListener('mousedown',e=>this.onBodyDown(e));
    this.body.addEventListener('dblclick',e=>{const c=e.target.closest('.gc');if(c&&!c.classList.contains('idx'))this.startEdit(+c.parentNode.dataset.pos,+c.dataset.ci)});
    this.body.addEventListener('contextmenu',e=>this.onContext(e));
    this.head.addEventListener('contextmenu',e=>this.onContext(e));
    this.head.addEventListener('click',e=>this.onHeadClick(e));
    this.head.addEventListener('dblclick',e=>{const g=e.target.closest('.gh[data-col]');if(g&&!e.target.closest('.gresize,.gh-menu,.typebadge'))this.renameInline(g)});
    this.head.addEventListener('mousedown',e=>this.onHeadDown(e));
    this.sc.addEventListener('keydown',e=>this.onKey(e));
    let lp=null;
    this.sc.addEventListener('touchstart',e=>{const t=e.touches[0];const tg=e.target;lp={x:t.clientX,y:t.clientY,tm:setTimeout(()=>{this.onContext({preventDefault(){},target:tg,clientX:lp.x,clientY:lp.y});lp=null},500)}},{passive:true});
    this.sc.addEventListener('touchmove',e=>{if(!lp)return;const t=e.touches[0];if(Math.abs(t.clientX-lp.x)>8||Math.abs(t.clientY-lp.y)>8){clearTimeout(lp.tm);lp=null}},{passive:true});
    this.sc.addEventListener('touchend',()=>{if(lp){clearTimeout(lp.tm);lp=null}});
    document.addEventListener('mouseup',()=>{this.dragSel=null});
  },
  rowHCache:0,
  rowH_(){if(!this.rowHCache)this.rowHCache=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-h'))||34;return this.rowHCache},
  reset(keepScroll){
    const top0=keepScroll?this.scrollY:0;
    this.pages.clear();this.lru=[];this.inflight.clear();
    this.rowH=this.rowH_();
    const sig=S.view.schema.cols.map(c=>c.name).join('\u0001');
    const same=sig===this.lastSig;
    if(!same){this.computeWidths();this.renderHead();this.lastSig=sig}
    else{this.idxW=Math.max(56,String(S.view.n).length*8+28);this.renderHead()}
    if(!keepScroll){if(this.scrollY||this.scrollX){this.sc.scrollTop=0;this.sc.scrollLeft=0}this.scrollY=0;this.scrollX=0}
    if(!same){this.pool.forEach(r=>r.el.remove());this.pool=[]}
    else this.pool.forEach(r=>{r.key=''});
    this.cancelEdit();
    this.layout();this.paint(top0)
  },
  computeWidths(){
    const cols=S.view.schema.cols;const saved=Prefs.get('colWidths',{});
    this.idxW=Math.max(56,String(S.view.n).length*8+28);
    this.widths=cols.map(c=>{if(saved[c.name])return saved[c.name];return Math.min(300,Math.max(96,c.name.length*8+64))});
    this.autoFitPending=true
  },
  autoFit(){
    if(!this.autoFitPending)return;
    const p=this.pages.get(0);if(!p)return;
    this.autoFitPending=false;
    const saved=Prefs.get('colWidths',{});
    S.view.schema.cols.forEach((c,i)=>{
      if(saved[c.name])return;
      let mx=c.name.length*8+64;
      for(const row of p.rows.slice(0,250)){const v=row[i]||'';const L=Math.min(v.length,60);if(L*7.3+30>mx)mx=L*7.3+30}
      this.widths[i]=Math.round(Math.min(360,Math.max(80,mx)))
    });
    const hs=this.head.children;for(let i=0;i<this.widths.length;i++)if(hs[i+1])hs[i+1].style.width=this.widths[i]+'px';
    this.layout();this.paint()
  },
  totalW(){return this.idxW+this.widths.reduce((a,b)=>a+b,0)},
  layout(){const hh=(S.view.n*this.rowH+40)+'px',ww=this.totalW()+'px',st=S.view.total+'|'+S.view.n;if(this._lay===hh+ww+st)return;this._lay=hh+ww+st;this.sizer.style.height=(S.view.n*this.rowH+40)+'px';this.sizer.style.width=this.totalW()+'px';this.head.style.width=this.totalW()+'px';$('#gridEmpty').classList.toggle('hidden',S.view.n>0);$('#gridEmpty').textContent=S.view.total&&!S.view.n?'No rows match. Clear the search or filter to see all rows.':'This step has no rows.'},
  renderHead(){
    const cols=S.view.schema.cols;
    const frag=[h('div',{class:'gh idx',role:'columnheader','aria-colindex':'1',style:{width:this.idxW+'px'}},'#')];
    cols.forEach((c,i)=>{
      const sk=S.sort.find(k=>k.col===c.name);
      const el=h('div',{class:'gh t-'+c.type+(Sel.kind==='cols'&&Sel.cols.has(c.name)?' colsel':''),role:'columnheader','aria-colindex':String(i+2),'aria-sort':sk?(sk.dir==='desc'?'descending':'ascending'):'none','data-col':c.name,'data-ci':String(i),title:c.name,draggable:'true',style:{width:this.widths[i]+'px'}},
        h('span',{class:'typebadge',title:'Change type','data-act':'type'},c.type==='number'?'123':c.type==='date'?'DATE':'ABC'),
        h('span',{class:'gh-name',text:c.name}),
        sk?h('button',{class:'gh-sort',type:'button',title:'Sorted '+(sk.dir==='desc'?'descending':'ascending')+'. Click to change.','data-act':'sort'},icon(sk.dir==='desc'?'sortDesc':'sortAsc',14)):null,
        h('button',{class:'gh-menu',type:'button','aria-label':'Column menu for '+c.name,'data-act':'menu'},icon('chevDown',14)),
        h('div',{class:'gresize','data-ci':String(i)}),
        c.fill!=null?h('span',{class:'gh-fill'+(c.fill<0.5?' low':c.fill<0.95?' mid':''),title:Math.round(c.fill*1000)/10+'% of rows have a value','aria-hidden':'true'},h('i',{style:{width:(c.fill*100).toFixed(1)+'%'}})):null);
      frag.push(el)
    });
    this.headSelKey=null;
    clear(this.head).append(...frag);
    const g=$('#grid');g.setAttribute('aria-rowcount',String(S.view.n+1));g.setAttribute('aria-colcount',String(cols.length+1))
  },
  pageOf(pos){return Math.floor(pos/256)},
  rowAt(pos){const p=this.pages.get(this.pageOf(pos));if(!p)return null;const i=pos-p.start;return i<p.rows.length?{row:p.rows[i],id:p.rowIds[i],changed:p.changed?p.changed[i]:null}:null},
  async fetchPage(pi){
    const key=S.view.key+':'+pi;
    if(this.pages.has(pi)||this.inflight.has(key))return;
    this.inflight.add(key);const vk=S.view.key;
    try{
      const r=await Engine.call('getRows',{viewKey:vk,start:pi*256,count:256});
      if(vk!==S.view.key)return;
      this.pages.set(pi,r);this.lru.push(pi);
      while(this.lru.length>40){const old=this.lru.shift();if(old!==pi)this.pages.delete(old)}
      this.paint();if(pi===0)this.autoFit()
    }catch(e){}
    finally{this.inflight.delete(key)}
  },
  paint(topArg){
    if(!S.loaded||!this.sc)return;
    const top=typeof topArg==='number'?topArg:this.scrollY,rh=this.rowH;
    const vh=this.vh||Math.max(600,innerHeight);
    const first=Math.max(0,Math.floor((top)/rh)-8),last=Math.min(S.view.n-1,Math.ceil((top+vh)/rh)+8);
    const need=last-first+1;
    while(this.pool.length<need&&this.pool.length<400){const el=h('div',{class:'grow',role:'row'});this.body.appendChild(el);this.pool.push({el,pos:-1,cols:-1,key:''})}
    const pf=this.pageOf(first),pl=this.pageOf(Math.max(first,last));
    for(let p=pf;p<=pl;p++)this.fetchPage(p);
    const dir=top>=this.lastTop?1:-1;this.lastTop=top;
    const pre=dir>0?pl+1:pf-1;if(pre>=0&&pre*256<S.view.n)this.fetchPage(pre);
    const cols=S.view.schema.cols;const types=cols.map(c=>c.type);
    const sq=S.search.trim().toLowerCase();
    if(sq!==this._sq){this._sq=sq;this._terms=sq?sq.split(/\s+/).filter(Boolean).sort((a,b)=>b.length-a.length):null}
    const terms=this._terms;
    const t0=performance.now();
    let deferred=false;
    for(let i=0;i<this.pool.length;i++){
      const r=this.pool[i];const pos=first+i;
      if(!deferred&&r.key===''&&performance.now()-t0>12){deferred=true;requestAnimationFrame(()=>this.paint())}
      if(deferred&&r.key===''){continue}
      if(pos>last||pos>=S.view.n){r.el.style.display='none';r.pos=-1;continue}
      r.el.style.display='';
      const data=this.rowAt(pos);
      const k=pos+'|'+(data?data.id:'x');
      if(r.cols!==cols.length){clear(r.el);r.cells=[];const idx=h('div',{class:'gc idx',role:'rowheader'});idx.style.width=this.idxW+'px';r.el.appendChild(idx);r.cells.push(idx);cols.forEach((c,ci)=>{const d=h('div',{class:'gc',role:'gridcell'});d.dataset.ci=ci;d.style.width=this.widths[ci]+'px';r.el.appendChild(d);r.cells.push(d)});r.cols=cols.length;r.key=''}
      r.el.style.transform='translateY('+(pos*rh+40)+'px)';
      r.el.dataset.pos=pos;r.el.setAttribute('aria-rowindex',String(pos+2));
      const sel=data&&Sel.kind==='rows'&&Sel.rowSelected(data.id);
      r.el.className='grow'+(pos%2?' even':'')+(sel?' sel':'');
      if(sel)r.el.setAttribute('aria-selected','true');else r.el.removeAttribute('aria-selected');
      const dk=k+'|'+S.showWs+'|'+sq;
      if(r.key!==dk){
        r.key=dk;
        r.cells[0].textContent=fmtInt(pos+1);
        const ch=data&&data.changed?new Set(data.changed):null;
        for(let ci=0;ci<cols.length;ci++){
          const cell=r.cells[ci+1];const v=data?data.row[ci]:'';
          if(S.showWs&&data)this.fillWs(cell,v);else if(terms&&data&&v)this.fillMark(cell,v,terms);else cell.textContent=v;
          let cls='gc';if(types[ci]==='number')cls+=' num';if(!data)cls+=' pending';else if(v.trim()==='')cls+=' empty';if(ch&&ch.has(ci))cls+=' changed';
          cell.dataset.base=cls
        }
      }
      for(let ci=0;ci<cols.length;ci++){
        const cell=r.cells[ci+1];let cls=cell.dataset.base||'gc';
        if(Sel.kind==='cols'&&Sel.cols.has(cols[ci].name))cls+=' colsel';
        if(Sel.cursor.pos===pos&&Sel.cursor.col===ci&&document.activeElement===this.sc)cls+=' cursor';
        if(cell.className!==cls)cell.className=cls;
        const wv=this.widths[ci];if(cell._w!==wv){cell._w=wv;cell.style.width=wv+'px'}
      }
      if(r.cells[0]._w!==this.idxW){r.cells[0]._w=this.idxW;r.cells[0].style.width=this.idxW+'px'}
    }
    this.paintRect();
    const selKey=Sel.kind==='cols'?Array.from(Sel.cols).join('\u0001'):'';
    if(selKey!==this.headSelKey){this.headSelKey=selKey;$$('.gh[data-col]',this.head).forEach(g=>g.classList.toggle('colsel',Sel.kind==='cols'&&Sel.cols.has(g.dataset.col)))}
  },
  fillWs(cell,v){
    clear(cell);
    const re=/^[ \t]+|[ \t]+$|\t|\u00A0|[\u200B-\u200D\uFEFF]/g;let last=0,m;
    while((m=re.exec(v))){
      if(m.index>last)cell.appendChild(document.createTextNode(v.slice(last,m.index)));
      const s=m[0].replace(/ /g,'·').replace(/\t/g,'→').replace(/\u00A0/g,'°').replace(/[\u200B-\u200D\uFEFF]/g,'¦');
      cell.appendChild(h('span',{class:'ws',text:s}));last=m.index+m[0].length;if(m[0]==='')re.lastIndex++
    }
    if(last<v.length)cell.appendChild(document.createTextNode(v.slice(last)))
  },
  fillMark(cell,v,terms){
    const low=v.toLowerCase();let i=0,hit=false;const parts=[];
    while(i<low.length){
      let best=-1,bl=0;
      for(const tm of terms){const j=low.indexOf(tm,i);if(j!==-1&&(best===-1||j<best||(j===best&&tm.length>bl))){best=j;bl=tm.length}}
      if(best===-1)break;
      if(best>i)parts.push(v.slice(i,best));
      parts.push({m:v.slice(best,best+bl)});i=best+bl;hit=true
    }
    if(!hit){cell.textContent=v;return}
    if(i<v.length)parts.push(v.slice(i));
    clear(cell);
    for(const p of parts)cell.appendChild(typeof p==='string'?document.createTextNode(p):h('mark',{class:'hit',text:p.m}))
  },
  colX(ci){let x=this.idxW;for(let i=0;i<ci;i++)x+=this.widths[i];return x},
  paintRect(){
    if(Sel.kind!=='cells'||!Sel.rect||(Sel.rect.r0===Sel.rect.r1&&Sel.rect.c0===Sel.rect.c1)){this.rect.classList.add('hidden');return}
    const r=Sel.rect;const x=this.colX(r.c0),w=this.colX(r.c1+1)-x;
    Object.assign(this.rect.style,{left:x+'px',top:(r.r0*this.rowH+40)+'px',width:w+'px',height:((r.r1-r.r0+1)*this.rowH)+'px'});
    this.rect.classList.remove('hidden')
  },
  cellFromEvent(e){const c=e.target.closest('.gc');if(!c)return null;const row=c.parentNode;const pos=+row.dataset.pos;if(c.classList.contains('idx'))return{pos,idx:true};return{pos,col:+c.dataset.ci}},
  async onBodyDown(e){
    if(e.button!==0)return;
    const hit=this.cellFromEvent(e);if(!hit)return;
    this.sc.focus({preventScroll:true});
    Halo.close();
    const mod=isMac?e.metaKey:e.ctrlKey;
    if(hit.idx){
      e.preventDefault();
      const d=this.rowAt(hit.pos);if(!d)return;
      if(e.shiftKey&&Sel.rowAnchor!=null)await Sel.rangeRows(Sel.rowAnchor,hit.pos,mod);
      else if(mod)Sel.toggleRow(d.id,hit.pos);
      else if(Sel.kind==='rows'&&Sel.rowCount()===1&&Sel.rowSelected(d.id))Sel.clear();
      else Sel.setRowOnly(d.id,hit.pos);
      this.dragSel={type:'rows',from:Sel.rowAnchor!=null?Sel.rowAnchor:hit.pos};
      announce('Row '+fmtInt(hit.pos+1)+(Sel.rowSelected(d.id)?' selected. ':' deselected. ')+plural(Sel.rowCount(),'row')+' selected.');
      return
    }
    Sel.setCell(hit.pos,hit.col,e.shiftKey);
    this.dragSel={type:'cells'};
    const move=ev=>{if(!this.dragSel)return document.removeEventListener('mousemove',move);const el=document.elementFromPoint(ev.clientX,ev.clientY);if(!el)return;const c=el.closest&&el.closest('.gc');if(!c||!this.body.contains(c))return;const p=+c.parentNode.dataset.pos;if(this.dragSel.type==='cells'&&!c.classList.contains('idx')){const ci=+c.dataset.ci;if(!Sel.rect||Sel.rect.r1!==p||Sel.rect.c1!==ci)Sel.setCell(p,ci,true)}};
    document.addEventListener('mousemove',move);
    Inspector.onCell()
  },
  onHeadDown(e){
    const rz=e.target.closest('.gresize');
    if(!rz)return;
    e.preventDefault();e.stopPropagation();
    const ci=+rz.dataset.ci;const sx=e.clientX,sw=this.widths[ci];rz.classList.add('on');
    const mv=ev=>{this.widths[ci]=Math.max(48,Math.min(800,sw+ev.clientX-sx));this.head.children[ci+1].style.width=this.widths[ci]+'px';this.layout();this.paint()};
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);rz.classList.remove('on');const s=Prefs.get('colWidths',{});s[curCols()[ci]]=this.widths[ci];Prefs.set('colWidths',s)};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
    rz.ondblclick=()=>{const s=Prefs.get('colWidths',{});delete s[curCols()[ci]];Prefs.set('colWidths',s);this.autoFitPending=true;this.autoFit()}
  },
  onHeadClick(e){
    const g=e.target.closest('.gh[data-col]');if(!g)return;
    if(e.target.closest('.gresize'))return;
    const col=g.dataset.col;
    const act=e.target.closest('[data-act]');
    if(act&&act.dataset.act==='menu'){e.stopPropagation();const r=act.getBoundingClientRect();if(!(Sel.kind==='cols'&&Sel.cols.has(col)))Sel.selectCol(col);Menus.openContext('colHeader',r.left,r.bottom+4,act);return}
    if(act&&act.dataset.act==='type'){e.stopPropagation();if(!(Sel.kind==='cols'&&Sel.cols.has(col)))Sel.selectCol(col);const r=act.getBoundingClientRect();Menus.openList(Commands.byPrefix('columns.type.'),r.left,r.bottom+4,act);return}
    if(act&&act.dataset.act==='sort'){e.stopPropagation();cycleViewSort(col);return}
    const mod=isMac?e.metaKey:e.ctrlKey;
    Sel.selectCol(col,e.shiftKey,mod);Inspector.onColumn(col)
  },
  renameInline(g){
    const col=g.dataset.col;const r=g.getBoundingClientRect(),sr=this.sc.getBoundingClientRect();
    const inp=h('input',{class:'cell-edit',value:col,'aria-label':'New name for column '+col});
    Object.assign(inp.style,{left:(r.left-sr.left+this.sc.scrollLeft)+'px',top:(this.sc.scrollTop)+'px',width:Math.max(140,r.width)+'px',height:'40px',position:'absolute'});
    this.sc.appendChild(inp);inp.focus();inp.select();
    let done=false;
    const fin=async ok=>{if(done)return;done=true;const v=inp.value.trim();inp.remove();this.sc.focus({preventScroll:true});if(ok&&v&&v!==col){if(curCols().indexOf(v)!==-1){Toast.err('A column called "'+v+'" already exists.');return}await addStep('rename',{from:col,to:v},{msg:'Renamed "'+col+'" to "'+v+'"'})}};
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();fin(true)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();fin(false)}});
    inp.addEventListener('blur',()=>fin(true))
  },
  onContext(e){
    const hit=this.cellFromEvent(e);const g=e.target.closest&&e.target.closest('.gh[data-col]');
    if(!hit&&!g)return;
    e.preventDefault();
    let ctx;
    if(g){const col=g.dataset.col;if(!(Sel.kind==='cols'&&Sel.cols.has(col)))Sel.selectCol(col);ctx='colHeader'}
    else if(hit.idx){const d=this.rowAt(hit.pos);if(d&&!(Sel.kind==='rows'&&Sel.rowSelected(d.id)))Sel.setRowOnly(d.id,hit.pos);ctx='rowHeader'}
    else{
      const inRect=Sel.kind==='cells'&&Sel.rect&&hit.pos>=Sel.rect.r0&&hit.pos<=Sel.rect.r1&&hit.col>=Sel.rect.c0&&hit.col<=Sel.rect.c1;
      const d=this.rowAt(hit.pos);
      const inRows=Sel.kind==='rows'&&d&&Sel.rowSelected(d.id);
      const inCols=Sel.kind==='cols'&&Sel.cols.has(curCols()[hit.col]);
      if(!inRect&&!inRows&&!inCols)Sel.setCell(hit.pos,hit.col,false);
      ctx=inRows?'rowHeader':inCols?'colHeader':'cell'
    }
    Menus.openContext(ctx,e.clientX,e.clientY)
  },
  scrollToPos(pos,col){
    const rh=this.rowH,top=pos*rh,vh=this.sc.clientHeight-40;
    if(top<this.sc.scrollTop)this.sc.scrollTop=top;else if(top+rh>this.sc.scrollTop+vh)this.sc.scrollTop=top+rh-vh;this.scrollY=this.sc.scrollTop;
    if(col!=null&&col>=0){const x=this.colX(col),w=this.widths[col];const vw=this.sc.clientWidth;if(x-this.idxW<this.sc.scrollLeft)this.sc.scrollLeft=x-this.idxW;else if(x+w>this.sc.scrollLeft+vw)this.sc.scrollLeft=x+w-vw}
  },
  onKey(e){
    if(this.editing)return;
    const n=S.view.n,nc=curCols().length;if(!n&&!nc)return;
    const mod=isMac?e.metaKey:e.ctrlKey;
    const c=Sel.cursor;let pos=c.pos,col=c.col<0?0:c.col;const page=Math.max(1,Math.floor((this.sc.clientHeight-40)/this.rowH)-1);
    let moved=false;
    switch(e.key){
      case'ArrowDown':pos=mod?n-1:Math.min(n-1,pos+1);moved=true;break;
      case'ArrowUp':pos=mod?0:Math.max(0,pos-1);moved=true;break;
      case'ArrowRight':col=mod?nc-1:Math.min(nc-1,col+1);moved=true;break;
      case'ArrowLeft':col=mod?0:Math.max(0,col-1);moved=true;break;
      case'PageDown':pos=Math.min(n-1,pos+page);moved=true;break;
      case'PageUp':pos=Math.max(0,pos-page);moved=true;break;
      case'Home':if(mod)pos=0;col=0;moved=true;break;
      case'End':if(mod)pos=n-1;col=nc-1;moved=true;break;
      case'Enter':case'F2':e.preventDefault();this.startEdit(pos,col);return;
      case' ':{
        e.preventDefault();
        if(e.shiftKey){if(Sel.kind==='cells'&&Sel.rect)Sel.rangeRows(Sel.rect.r0,Sel.rect.r1,false);else{const d=this.rowAt(pos);if(d)Sel.setRowOnly(d.id,pos)}return}
        if(mod){const cols=curCols();if(Sel.kind==='cells'&&Sel.rect){Sel.kind='cols';Sel.cols=new Set(cols.slice(Sel.rect.c0,Sel.rect.c1+1));Sel.rect=null;Sel.changed()}else Sel.selectCol(cols[col]);return}
        const d=this.rowAt(pos);if(d)Sel.toggleRow(d.id,pos);return
      }
      case'a':if(mod){e.preventDefault();Sel.selectAllRows()}return;
      case'c':if(mod&&!e.shiftKey){e.preventDefault();copySelection()}return;
      case'Delete':case'Backspace':e.preventDefault();deleteSelection();return;
      case'Escape':if(Sel.kind!=='none'){e.preventDefault();e.stopPropagation();Sel.clear();}return;
      default:
        if(e.key.length===1&&!mod&&!e.altKey&&/\S/.test(e.key)){e.preventDefault();this.startEdit(pos,col,e.key)}
        return
    }
    if(moved){
      e.preventDefault();
      if(n===0)return;
      if(e.shiftKey){if(!Sel.anchor||Sel.kind!=='cells')Sel.anchor={pos:c.pos,col:Math.max(0,c.col)};Sel.setCell(pos,col,true)}
      else Sel.setCell(pos,col,false);
      this.scrollToPos(pos,col);Inspector.onCell()
    }
  },
  async startEdit(pos,ci,initial){
    const cols=curCols();if(ci<0||ci>=cols.length||pos<0||pos>=S.view.n)return;
    const d=this.rowAt(pos);if(!d)return;
    this.scrollToPos(pos,ci);
    const full=await Engine.call('getCell',{stateIdx:S.viewIdx,rowId:d.id,col:cols[ci]});
    const x=this.colX(ci),y=pos*this.rowH+40;
    const inp=h('input',{class:'cell-edit',value:initial!=null?initial:(full.value||''),'aria-label':'Edit cell'});
    Object.assign(inp.style,{left:x+'px',top:y+'px',width:Math.max(this.widths[ci],180)+'px',height:this.rowH+'px'});
    this.sizer.appendChild(inp);inp.focus();if(initial==null)inp.select();
    this.editing={pos,ci,id:d.id,col:cols[ci],before:full.value||'',el:inp};
    let done=false;
    const fin=async ok=>{
      if(done)return;done=true;const ed=this.editing;this.editing=null;const v=inp.value;inp.remove();this.sc.focus({preventScroll:true});
      if(!ok||v===ed.before)return;
      await addStep('cellOverride',{column:ed.col,overrides:[{rowId:ed.id,value:v}]},{msg:'Edited 1 cell in "'+ed.col+'"'});
      Halo.offer(ed)
    };
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();fin(true)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();fin(false)}else if(e.key==='Tab'){e.preventDefault();fin(true)}});
    inp.addEventListener('blur',()=>fin(true))
  },
  cancelEdit(){if(this.editing){try{this.editing.el.remove()}catch(e){}this.editing=null}}
};

function cycleViewSort(col){
  const k=S.sort.find(x=>x.col===col);
  if(!k)S.sort=[{col,dir:'asc'}];else if(k.dir==='asc')S.sort=[{col,dir:'desc'}];else S.sort=[];
  refreshView(true);announce(S.sort.length?'Sorted view by '+col+', '+(S.sort[0].dir==='desc'?'descending':'ascending'):'View sort cleared')
}
function setViewSort(col,dir){S.sort=dir?[{col,dir}]:[];refreshView(true)}

const Halo={
  el:null,
  close(){if(this.el){this.el.remove();this.el=null;Layers.pop('halo')}},
  async offer(ed){
    this.close();
    if(!ed.before||!ed.before.trim())return;
    const i=S.steps.length-1;
    let r;try{r=await Engine.call('synthesize',{stateIdx:Math.max(0,S.viewIdx-1),col:ed.col,before:ed.before,after:S.lastEditAfter!=null?S.lastEditAfter:null,rowId:ed.id})}catch(e){return}
    return r
  }
};
Halo.offer=async function(ed){
  this.close();
  if(!ed.before)return;
  const g=await Engine.call('getCell',{stateIdx:S.viewIdx,rowId:ed.id,col:ed.col}).catch(()=>null);
  if(!g||g.value==null)return;
  const after=g.value;
  let r;try{r=await Engine.call('synthesize',{stateIdx:Math.max(0,S.viewIdx-1),col:ed.col,before:ed.before,after})}catch(e){return}
  const cands=(r.candidates||[]).filter(c=>c.candidate.type!=='mapValue'&&c.changed>1);
  if(!cands.length)return;
  let pick=0;
  const cellPos=Grid.colX(ed.ci),sr=Grid.sc.getBoundingClientRect();
  const el=h('div',{class:'halo',role:'dialog','aria-label':'Apply to similar cells'});
  const render=()=>{
    const c=cands[pick];
    clear(el).append(
      h('p',{},'Apply the same change to '+fmtInt(c.changed-1)+' similar cells in "'+ed.col+'"?'),
      h('div',{class:'halo-alts'},cands.slice(0,4).map((x,i)=>h('button',{type:'button','aria-pressed':String(i===pick),onclick:()=>{pick=i;render()}},x.label+' · '+plural(x.changed,'cell')))),
      h('div',{class:'halo-actions'},h('button',{class:'btn btn-sm btn-ghost',type:'button',onclick:()=>this.close()},'Only this cell'),h('button',{class:'btn btn-sm btn-primary',type:'button',onclick:async()=>{this.close();const steps=cleanSteps(S.steps);const last=steps[steps.length-1];if(last&&last.opId==='cellOverride'&&last.cfg.column===ed.col){last.cfg.overrides=last.cfg.overrides.filter(o=>o.rowId!==ed.id);if(!last.cfg.overrides.length)steps.pop()}const idx=steps.length;steps.push({id:newStepId(),opId:'infer',cfg:{column:ed.col,candidate:c.candidate}});const ok=await setPipeline(steps,Math.max(0,idx-1),{viewIdx:steps.length});if(ok)Toast.show(c.label+' in "'+ed.col+'" · '+plural((S.meta[idx]&&S.meta[idx].stats&&S.meta[idx].stats.changed)||0,'cell')+' changed',{undo:doUndo})}},'Apply to column')))
  };
  render();
  document.body.appendChild(el);this.el=el;
  const top=sr.top+ed.pos*Grid.rowH+40-Grid.sc.scrollTop+Grid.rowH+8;
  placeFloating(el,sr.left+cellPos-Grid.sc.scrollLeft,top,{flipY:top-Grid.rowH-16});
  Layers.push('halo',()=>{if(this.el){this.el.remove();this.el=null}})
};
