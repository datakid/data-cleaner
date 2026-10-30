'use strict';
const QB_HELP=[
  ['paid card','both words appear (any column)'],
  ['"new york"','the exact phrase'],
  ['status:paid','Status contains paid'],
  ['status:=paid','Status is exactly paid'],
  ['status:!=paid','Status is not paid'],
  ['-status:paid','leave out matching rows (or NOT)'],
  ['amount>100','compare numbers (>, >=, <, <=, =, !=)'],
  ['amount:100..500','between, inclusive'],
  ['date>2026-01-01','compare dates'],
  ['region:(emea|apac)','one of these values'],
  ['status:=""','empty cells (use != for not empty)'],
  ['notes:/^ref \\d+$/i','pattern (regular expression)'],
  ['"order id":123','column names with spaces (or [order id])'],
  ['a:x OR b:y','either side (OR and AND in capitals)'],
  ['(a:x OR b:y) -c:z','group with brackets'],
  ['=[amount] > [budget]','start with = to compare columns with a formula']
];

const QueryBar={
  sug:null,
  items:[],
  active:-1,
  seq:0,
  lastBadge:'',
  init(){
    this.input=$('#searchInput');
    this.mirror=$('#searchMirror');
    this.badge=$('#searchBadge');
    this.input.addEventListener('input',()=>{this.syncMirror();this.suggest()});
    this.input.addEventListener('scroll',()=>this.syncScroll());
    this.input.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='Home'||e.key==='End'){this.syncScroll();this.suggest()}});
    this.input.addEventListener('click',()=>{this.syncScroll();this.suggest()});
    this.input.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==this.input&&!(this.sug&&this.sug.contains(document.activeElement)))this.closeSuggest()},120));
    this.input.addEventListener('keydown',e=>this.onKey(e),true);
    $('#btnSearchHelp').addEventListener('click',()=>this.help());
    this.badge.addEventListener('click',()=>{Toast.show(this.badge.title)})
  },
  tokensFor(){
    const q=S.view&&S.view.query;
    if(!q||q.src!==this.input.value)return null;
    return q
  },
  syncScroll(){this.mirror.scrollLeft=this.input.scrollLeft},
  syncMirror(){
    const text=this.input.value;
    const q=this.tokensFor();
    clear(this.mirror);
    if(!text){return}
    const spans=[];
    if(q){
      const tk=q.tokens.slice().sort((a,b)=>a.start-b.start);
      const errs=q.errors.map(e=>[e.start,e.end,e.level]);
      const cuts=new Set([0,text.length]);
      tk.forEach(t=>{cuts.add(t.start);cuts.add(t.end);if(t.colEnd!=null)cuts.add(t.colEnd)});
      errs.forEach(e=>{cuts.add(Math.max(0,e[0]));cuts.add(Math.min(text.length,e[1]))});
      const pts=Array.from(cuts).filter(x=>x>=0&&x<=text.length).sort((a,b)=>a-b);
      for(let i=0;i<pts.length-1;i++){
        const a=pts[i],b=pts[i+1];
        let cls='';
        const t=tk.find(x=>a>=x.start&&b<=x.end);
        if(t){
          if(t.kind==='field')cls=a<t.colEnd?'qt-col':'qt-val';
          else if(t.kind==='op')cls='qt-op';
          else if(t.kind==='regex')cls='qt-re'
        }
        const er=errs.find(x=>a>=x[0]&&b<=x[1]&&x[1]>x[0]);
        if(er)cls+=(cls?' ':'')+(er[2]==='warn'?'qt-warn':'qt-err');
        spans.push(h('span',{class:cls||null,text:text.slice(a,b)}))
      }
    }else spans.push(document.createTextNode(text));
    this.mirror.append(...spans);
    this.syncScroll()
  },
  render(){
    this.syncMirror();
    const q=this.tokensFor();
    const errs=q?q.errors.filter(e=>e.level!=='warn'):[];
    const warns=q?q.errors.filter(e=>e.level==='warn'):[];
    const all=errs.concat(warns);
    const msg=all.map(e=>e.message).filter((m,i,a)=>a.indexOf(m)===i).join(' ');
    this.badge.classList.toggle('hidden',!msg);
    this.badge.title=msg;
    this.badge.setAttribute('aria-label',msg?'Search problem: '+msg:'');
    this.badge.classList.toggle('warn',!!msg&&!errs.length);
    if(msg&&msg!==this.lastBadge)announce('Search problem: '+msg);
    this.lastBadge=msg;
  },
  context(){
    const text=this.input.value,caret=this.input.selectionStart==null?text.length:this.input.selectionStart;
    let i=caret;
    while(i>0&&!/[\s()]/.test(text[i-1]))i--;
    let start=i,w=text.slice(i,caret);
    if(w[0]==='-'){start++;w=w.slice(1)}
    return{text,caret,start,w}
  },
  quoteCol(name){return/^[A-Za-z0-9_]+$/.test(name)?name:'"'+name.replace(/"/g,'')+'"'},
  quoteVal(v){return/^[A-Za-z0-9_.\-@]+$/.test(v)?v:'"'+v.replace(/"/g,'')+'"'},
  async suggest(){
    if(!S.loaded||document.activeElement!==this.input){this.closeSuggest();return}
    const c=this.context();
    const my=++this.seq;
    const cols=curCols();
    const colon=c.w.indexOf(':');
    if(colon>0){
      let left=c.w.slice(0,colon);
      if((left[0]==='"'&&left[left.length-1]==='"')||(left[0]==='['&&left[left.length-1]===']'))left=left.slice(1,-1);
      const rc=W.Q.resolveCol(left,cols);
      if(!rc){this.closeSuggest();return}
      let off=colon+1;
      if(c.w[off]==='=')off++;
      else if(c.w.slice(off,off+2)==='!=')off+=2;
      if(c.w[off]==='"')off++;
      else if(c.w[off]==='('||c.w[off]==='/'){this.closeSuggest();return}
      const rest=c.w.slice(off);
      let r;
      try{r=await Engine.call('distinctValues',{col:rc.col,stateIdx:S.viewIdx,limit:20},'qb')}
      catch(e){return}
      if(my!==this.seq||document.activeElement!==this.input)return;
      const q=W.Q.norm(rest);
      const items=r.values.filter(x=>!q||W.Q.norm(x.v).indexOf(q)!==-1).filter(x=>x.v!==rest).slice(0,20)
        .map(x=>({label:x.v,n:x.n,insert:this.quoteVal(x.v),replaceFrom:c.start+off,kind:'value'}));
      this.show(items,c);
      return
    }
    if(!c.w||/^[<>=!]/.test(c.w)||/[<>=]/.test(c.w)){this.closeSuggest();return}
    let name=c.w;
    if(name[0]==='"'||name[0]==='[')name=name.slice(1);
    const k=W.Q.norm(name).replace(/[\s_\-.]+/g,'');
    if(!k){this.closeSuggest();return}
    const items=cols.filter(x=>W.Q.norm(x).replace(/[\s_\-.]+/g,'').indexOf(k)===0).concat(cols.filter(x=>{const y=W.Q.norm(x).replace(/[\s_\-.]+/g,'');return y.indexOf(k)>0})).slice(0,8)
      .map(x=>({label:x,insert:this.quoteCol(x)+':',replaceFrom:c.start,kind:'column',type:colType(x)}));
    this.show(items,c)
  },
  show(items,c){
    if(!items.length){this.closeSuggest();return}
    this.items=items;this.active=-1;this.ctx=c;
    if(!this.sug){
      this.sug=h('div',{class:'menu sb-suggest',role:'listbox',id:'sbSuggest','aria-label':'Suggestions'});
      document.body.appendChild(this.sug);
      this.sug.addEventListener('mousedown',e=>e.preventDefault());
      this.sug.addEventListener('click',e=>{const it=e.target.closest('.menu-item');if(it)this.accept(+it.dataset.i)})
    }
    clear(this.sug);
    items.forEach((x,i)=>this.sug.appendChild(h('button',{type:'button',class:'menu-item',role:'option',id:'sbs'+i,'data-i':String(i),'aria-selected':'false',tabindex:'-1'},
      h('span',{class:'mi-label',text:x.label}),
      x.kind==='value'?h('span',{class:'sb-n',text:fmtInt(x.n)}):h('span',{class:'sb-n',text:x.type==='number'?'123':x.type==='date'?'date':'text'}))));
    this.input.setAttribute('role','combobox');
    this.input.setAttribute('aria-expanded','true');
    this.input.setAttribute('aria-controls','sbSuggest');
    this.input.removeAttribute('aria-activedescendant');
    const r=$('#searchBox').getBoundingClientRect();
    this.sug.style.minWidth=Math.max(220,r.width)+'px';
    placeFloating(this.sug,r.left,r.bottom+6,{flipY:r.top-6});
  },
  mark(){
    $$('.menu-item',this.sug).forEach((el,i)=>{const on=i===this.active;el.classList.toggle('active',on);el.setAttribute('aria-selected',String(on));if(on){this.input.setAttribute('aria-activedescendant',el.id);el.scrollIntoView({block:'nearest'})}})
  },
  closeSuggest(){
    if(this.sug){this.sug.remove();this.sug=null}
    this.items=[];this.active=-1;this.seq++;
    this.input.removeAttribute('aria-activedescendant');
    this.input.setAttribute('aria-expanded','false')
  },
  accept(i){
    const x=this.items[i];const c=this.ctx;if(!x||!c)return;
    const text=this.input.value;
    const caret=this.input.selectionStart==null?text.length:this.input.selectionStart;
    const before=text.slice(0,x.replaceFrom);
    const next=before+x.insert+(x.kind==='value'?' ':'')+text.slice(caret);
    const pos=(before+x.insert).length+(x.kind==='value'?1:0);
    this.closeSuggest();
    this.input.value=next;
    this.input.setSelectionRange(pos,pos);
    this.input.dispatchEvent(new Event('input',{bubbles:true}))
  },
  onKey(e){
    if(!this.sug||!this.items.length)return;
    const n=this.items.length;
    if(e.key==='ArrowDown'){e.preventDefault();e.stopImmediatePropagation();this.active=this.active<0?0:(this.active+1)%n;this.mark()}
    else if(e.key==='ArrowUp'){e.preventDefault();e.stopImmediatePropagation();this.active=this.active<=0?n-1:this.active-1;this.mark()}
    else if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();this.accept(this.active<0?0:this.active)}
    else if(e.key==='Enter'&&this.active>=0){e.preventDefault();e.stopImmediatePropagation();this.accept(this.active)}
    else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.closeSuggest()}
  },
  help(){
    const rows=QB_HELP.map(r=>h('tr',{},h('td',{},h('code',{class:'qb-code',text:r[0]})),h('td',{text:r[1]})));
    const body=h('div',{class:'dlg-body'},
      h('p',{class:'dlg-note'},'Type words to search every column. Name a column to search just that one. If a name does not match a column, it is searched as plain text, so times like 10:30 and links still work.'),
      h('div',{class:'mini-wrap',style:{maxHeight:'none'}},h('table',{class:'mini-table qb-table'},h('thead',{},h('tr',{},h('th',{},'Type'),h('th',{},'Finds rows where'))),h('tbody',{},rows))),
      h('p',{class:'dlg-note',style:{marginTop:'12px'}},'Press Enter in the box to jump to the next matching cell, and Shift+Enter for the previous one. "Make this a step" keeps exactly these rows.'));
    Dialog.open({title:'Search syntax',body,foot:[h('span',{class:'grow-1'}),h('button',{class:'btn btn-primary',type:'button',onclick:()=>{const d=$('.dialog');d&&d.querySelector('.icon-btn')&&d.querySelector('.icon-btn').click()}},'Done')]})
  }
};
