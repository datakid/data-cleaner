'use strict';
const SYN={delete:'remove',drop:'remove',erase:'remove',filter:'where',dedupe:'duplicate',dedup:'duplicate',unpivot:'wide',melt:'wide',pivot:'long',lookup:'join',vlookup:'join',rename:'rename',clean:'clean'};
function tokenize(s){return s.toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean)}
const Palette={
  el:null,items:[],active:0,q:'',
  open(q){
    if(this.el){this.input.focus();return}
    const scrim=h('div',{class:'scrim',onmousedown:()=>this.close()});
    this.input=h('input',{role:'combobox','aria-expanded':'true','aria-controls':'plist','aria-autocomplete':'list','aria-label':'Search commands',placeholder:S.loaded?'Type a command, like "remove duplicates" or "split"':'Open a file, try an example, or get help',autocomplete:'off',spellcheck:false});
    this.list=h('div',{class:'plist',id:'plist',role:'listbox'});
    this.el=h('div',{class:'palette',role:'dialog','aria-modal':'true','aria-label':'Commands'},h('div',{class:'psearch'},icon('search',18),this.input,h('span',{class:'kbd'},'Esc')),this.list,h('div',{class:'pfoot-hint'},h('span',{},'↑↓ to move'),h('span',{},'Enter to run'),h('span',{},'Esc to close')));
    this.scrim=scrim;
    this.prevFocus=document.activeElement;
    document.body.append(scrim,this.el);
    this.input.addEventListener('input',()=>{this.q=this.input.value;this.render()});
    this.input.addEventListener('keydown',e=>this.key(e));
    this.list.addEventListener('mousemove',e=>{const it=e.target.closest('.pitem');if(it){const i=+it.dataset.i;if(i!==this.active){this.active=i;this.mark()}}});
    this.list.addEventListener('click',e=>{const it=e.target.closest('.pitem');if(it)this.exec(+it.dataset.i)});
    Layers.push('palette',()=>this.close(true));
    this.input.value=q||'';this.q=q||'';this.render();this.input.focus()
  },
  close(fromLayer){
    if(!this.el)return;
    this.el.remove();this.scrim.remove();this.el=null;
    if(!fromLayer)Layers.pop('palette');
    if(this.prevFocus&&document.contains(this.prevFocus))try{this.prevFocus.focus({preventScroll:true})}catch(e){}
  },
  score(c,toks,q,ctx){
    const title=tokenize(c.title),kw=c.keywords.concat(tokenize(c.group)).map(k=>k.toLowerCase()).flatMap(tokenize);
    let s=0;
    for(const t of toks){
      const inT=title.some(w=>w.indexOf(t)===0),inK=kw.some(w=>w.indexOf(t)===0);
      if(!inT&&!inK)return-1;
      if(inT)s+=50;else s+=20
    }
    if(c.title.toLowerCase().indexOf(q)===0)s+=100;
    if(c._w!==true)s-=30;
    return s
  },
  render(){
    const ctx=Commands.ctx();
    const all=Commands.list.filter(c=>Commands.visible(c)&&c.id!=='palette.open');
    all.forEach(c=>{c._w=Commands.when(c,ctx)});
    const q=this.q.trim().toLowerCase();
    clear(this.list);this.items=[];
    const add=(c,showGroup)=>{
      const i=this.items.length;this.items.push(c);
      const dis=c._w!==true;
      const id='pi'+i;
      const el=h('div',{class:'pitem',role:'option',id,'data-i':String(i),'aria-disabled':dis?'true':null,'aria-selected':'false'},
        h('span',{class:'pi-ico'},icon(c.icon||'chevRight',16)),
        h('span',{class:'pi-text'},h('span',{class:'pi-title'},c.title,showGroup?h('span',{class:'pi-group'},c.group):null),dis?h('span',{class:'pi-reason'},c._w):null),
        c.shortcut?h('span',{class:'kbd'},fmtShortcut(c.shortcut)):null);
      this.list.appendChild(el)
    };
    if(!q){
      const rec=S.recent.map(id=>Commands.get(id)).filter(c=>c&&Commands.visible(c));
      if(rec.length){this.list.appendChild(h('div',{class:'pgroup',role:'presentation'},'Recent'));rec.forEach(c=>add(c))}
      GROUPS.forEach(g=>{const cs=all.filter(c=>c.group===g);if(!cs.length)return;this.list.appendChild(h('div',{class:'pgroup',role:'presentation'},g));cs.forEach(c=>add(c))})
    }else{
      const orig=tokenize(q),toks=orig.map(t=>SYN[t]||t);
      const scored=all.map(c=>{const a=this.score(c,orig,q,ctx),b=this.score(c,toks,q,ctx);return{c,s:a>=0?a+40:b}}).filter(x=>x.s>=0).sort((a,b)=>b.s-a.s||a.c.title.localeCompare(b.c.title));
      scored.forEach(x=>add(x.c,true));
      if(!scored.length)this.list.appendChild(h('div',{class:'pempty'},'No commands match "'+this.q+'". Try "remove", "split", "sort" or "export".'))
    }
    this.active=0;
    const firstEnabled=this.items.findIndex(c=>c._w===true);if(q&&firstEnabled>0&&firstEnabled<3)this.active=firstEnabled;
    this.mark()
  },
  mark(){
    $$('.pitem',this.list).forEach(el=>{const on=+el.dataset.i===this.active;el.classList.toggle('active',on);el.setAttribute('aria-selected',String(on));if(on){this.input.setAttribute('aria-activedescendant',el.id);el.scrollIntoView({block:'nearest'})}})
  },
  key(e){
    const n=this.items.length;
    if(e.key==='ArrowDown'){e.preventDefault();this.active=(this.active+1)%Math.max(1,n);this.mark()}
    else if(e.key==='ArrowUp'){e.preventDefault();this.active=(this.active-1+n)%Math.max(1,n);this.mark()}
    else if(e.key==='PageDown'){e.preventDefault();this.active=Math.min(n-1,this.active+8);this.mark()}
    else if(e.key==='PageUp'){e.preventDefault();this.active=Math.max(0,this.active-8);this.mark()}
    else if(e.key==='Home'&&!this.input.value){e.preventDefault();this.active=0;this.mark()}
    else if(e.key==='End'&&!this.input.value){e.preventDefault();this.active=n-1;this.mark()}
    else if(e.key==='Enter'){e.preventDefault();this.exec(this.active)}
    else if(e.key==='Tab'){e.preventDefault()}
  },
  exec(i){
    const c=this.items[i];if(!c)return;
    if(c._w!==true){Toast.show(c._w);return}
    this.close();Commands.run(c)
  }
};

const Menus={
  el:null,sub:null,anchor:null,
  close(){if(this.sub){this.sub.remove();this.sub=null}if(this.el){this.el.remove();this.el=null;Layers.pop('menu')}if(this.anchor){this.anchor.setAttribute('aria-expanded','false');this.anchor=null}},
  build(entries,isSub){
    const m=h('div',{class:'menu',role:'menu'});
    const ctx=Commands.ctx();
    entries.forEach(e=>{
      if(e==='-'){m.appendChild(h('div',{class:'menu-sep',role:'separator'}));return}
      if(e.head){m.appendChild(h('div',{class:'menu-head'},e.head));return}
      if(e.sub){
        const it=h('button',{type:'button',class:'menu-item',role:'menuitem','aria-haspopup':'menu'},e.icon?icon(e.icon,16):h('span',{style:{width:'16px'}}),h('span',{class:'mi-label'},e.label),icon('chevRight',14));
        const open=()=>{if(this.sub)this.sub.remove();$$('.menu-item.open',m).forEach(x=>x.classList.remove('open'));it.classList.add('open');this.sub=this.build(e.sub,true);document.body.appendChild(this.sub);const r=it.getBoundingClientRect();placeFloating(this.sub,r.right+4,r.top-6,{flipX:r.left-4});return this.sub};
        it.addEventListener('mouseenter',open);it.addEventListener('click',()=>{const s=open();const f=s.querySelector('.menu-item');f&&f.focus()});
        it.addEventListener('keydown',ev=>{if(ev.key==='ArrowRight'){ev.preventDefault();const s=open();const f=s.querySelector('.menu-item');f&&f.focus()}});
        m.appendChild(it);return
      }
      const c=e.cmd||e;const w=Commands.when(c,ctx);const dis=w!==true;
      const checked=c.checked?c.checked():null;
      const it=h('button',{type:'button',class:'menu-item'+(c.danger?' danger':''),role:checked==null?'menuitem':'menuitemradio','aria-checked':checked==null?null:String(!!checked),'aria-disabled':dis?'true':null,title:dis?w:(c.description||'')},
        c.icon?icon(c.icon,16):h('span',{style:{width:'16px'}}),h('span',{class:'mi-label'},e.label||c.title),c.shortcut?h('span',{class:'kbd'},fmtShortcut(c.shortcut)):null);
      it.addEventListener('click',()=>{if(dis){Toast.show(w);return}this.close();Commands.run(c)});
      if(!isSub)it.addEventListener('mouseenter',()=>{if(this.sub){this.sub.remove();this.sub=null;$$('.menu-item.open',m).forEach(x=>x.classList.remove('open'))}});
      m.appendChild(it)
    });
    m.addEventListener('keydown',ev=>{
      const items=$$('.menu-item',m);const i=items.indexOf(document.activeElement);
      if(ev.key==='ArrowDown'){ev.preventDefault();(items[(i+1)%items.length]||items[0]).focus()}
      else if(ev.key==='ArrowUp'){ev.preventDefault();(items[(i-1+items.length)%items.length]||items[0]).focus()}
      else if(ev.key==='ArrowLeft'&&isSub){ev.preventDefault();this.sub.remove();this.sub=null;const o=this.el&&this.el.querySelector('.menu-item.open');o&&(o.classList.remove('open'),o.focus())}
      else if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();if(isSub){this.sub.remove();this.sub=null;const o=this.el.querySelector('.menu-item.open');o&&o.focus()}else{const a=this.anchor;this.close();a&&a.focus()}}
      else if(ev.key==='Tab'){ev.preventDefault();this.close()}
      else if(ev.key.length===1&&/\w/.test(ev.key)){const k=ev.key.toLowerCase();const start=i+1;for(let j=0;j<items.length;j++){const it=items[(start+j)%items.length];if(it.textContent.trim().toLowerCase().indexOf(k)===0){it.focus();break}}}
    });
    return m
  },
  open(entries,x,y,anchor,opts){
    this.close();
    this.el=this.build(entries);document.body.appendChild(this.el);
    placeFloating(this.el,x,y,opts);
    if(anchor){this.anchor=anchor;anchor.setAttribute('aria-expanded','true')}
    Layers.push('menu',()=>{const a=this.anchor;this.close();a&&a.focus&&a.focus()});
    setTimeout(()=>{const f=this.el&&this.el.querySelector('.menu-item:not([aria-disabled])')||this.el&&this.el.querySelector('.menu-item');if(f&&(opts&&opts.focus!==false))f.focus()},0)
  },
  openList(cmds,x,y,anchor){this.open(cmds,x,y,anchor)},
  openContext(ctx,x,y,anchor){
    const cmds=Commands.byContext(ctx);
    const out=[];let last=null;
    cmds.forEach(c=>{if(last&&last!==c.group)out.push('-');out.push(c);last=c.group});
    const types=out.filter(c=>c!=='-'&&c.id&&c.id.indexOf('columns.type.')===0);
    let final=out.filter(c=>!(c.id&&c.id.indexOf('columns.type.')===0));
    const cases=final.filter(c=>c.id&&c.id.indexOf('text.case.')===0);
    final=final.filter(c=>!(c.id&&c.id.indexOf('text.case.')===0));
    if(types.length)final.push('-',{label:'Change type',icon:'columns',sub:types});
    if(cases.length)final.push({label:'Change case',icon:'text',sub:cases});
    const head=ctx==='colHeader'?(Sel.kind==='cols'&&Sel.cols.size>1?plural(Sel.cols.size,'column')+' selected':'Column "'+trunc(Sel.focusCol()||'',28)+'"'):ctx==='rowHeader'?plural(Sel.rowCount(),'row')+' selected':'Cell';
    final.unshift({head});
    this.open(final.filter((e,i,a)=>!(e==='-'&&(a[i-1]==='-'||i===a.length-1||(a[i-1]&&a[i-1].head)))),x,y,anchor)
  },
  groupEntries(g){
    const cmds=Commands.list.filter(c=>c.contexts.indexOf('toolbar:'+g)!==-1&&Commands.visible(c));
    const sub=(prefix,label,ic)=>{const list=cmds.filter(c=>c.id.indexOf(prefix)===0);return list.length?{label,icon:ic,sub:list}:null};
    let rest=cmds.filter(c=>!/^(columns\.type\.|text\.case\.|view\.density\.|view\.theme\.|view\.contrast\.|view\.dates\.)/.test(c.id));
    const extra=[sub('columns.type.','Change type','columns'),sub('text.case.','Change case','text'),sub('view.density.','Row density','rows'),sub('view.theme.','Theme','sun'),sub('view.contrast.','Contrast','eye'),sub('view.dates.','Date order','clock')].filter(Boolean);
    const out=rest.slice();if(extra.length){out.push('-');extra.forEach(e=>out.push(e))}
    return out
  }
};
