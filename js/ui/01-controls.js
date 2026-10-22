'use strict';
const Controls=(()=>{
  const selProto=HTMLSelectElement.prototype;
  const valueDesc=Object.getOwnPropertyDescriptor(selProto,'value');
  const indexDesc=Object.getOwnPropertyDescriptor(selProto,'selectedIndex');
  let openState=null;

  const labelOf=o=>o.label||o.textContent||'';

  function closeList(refocus){
    if(!openState)return;
    const s=openState;openState=null;
    s.list.remove();s.scrim.remove();
    window.removeEventListener('resize',s.onAway);
    document.removeEventListener('scroll',s.onScroll,true);
    Layers.pop('dd');
    s.trigger.setAttribute('aria-expanded','false');
    if(refocus&&document.contains(s.trigger))s.trigger.focus({preventScroll:true})
  }

  function enhanceSelect(sel){
    if(sel._dd||sel.multiple||sel.size>1||!sel.parentNode)return;
    const wrap=h('span',{class:'dd'});
    wrap.style.cssText=sel.style.cssText;sel.removeAttribute('style');
    const cur=h('span',{class:'dd-cur'});
    const ghosts=h('span',{class:'dd-ghosts','aria-hidden':'true'});
    const trigger=h('button',{type:'button',class:'select dd-trigger',role:'combobox','aria-haspopup':'listbox','aria-expanded':'false'},h('span',{class:'dd-label'},cur,ghosts),icon('chevDown',14));
    const names=sel.labels?Array.from(sel.labels).map(l=>l.textContent.trim()).filter(Boolean).join(' '):'';
    const al=sel.getAttribute('aria-label')||names;
    if(al)trigger.setAttribute('aria-label',al);

    const refresh=()=>{
      const i=indexDesc.get.call(sel);
      cur.textContent=i>=0?labelOf(sel.options[i]):'';
      clear(ghosts);
      Array.from(sel.options).map(labelOf).sort((a,b)=>b.length-a.length).slice(0,3).forEach(t=>ghosts.appendChild(h('span',{},t)));
      trigger.disabled=sel.disabled
    };
    Object.defineProperty(sel,'value',{configurable:true,get(){return valueDesc.get.call(sel)},set(v){valueDesc.set.call(sel,v);refresh()}});
    Object.defineProperty(sel,'selectedIndex',{configurable:true,get(){return indexDesc.get.call(sel)},set(v){indexDesc.set.call(sel,v);refresh()}});
    new MutationObserver(refresh).observe(sel,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','label']});

    const choose=i=>{
      const o=sel.options[i];if(!o||o.disabled)return;
      const changed=i!==sel.selectedIndex;
      closeList(true);
      if(changed){
        sel.selectedIndex=i;
        sel.dispatchEvent(new Event('input',{bubbles:true}));
        sel.dispatchEvent(new Event('change',{bubbles:true}))
      }
    };

    const open=()=>{
      if(openState&&openState.trigger===trigger){closeList(true);return}
      closeList();
      if(trigger.disabled)return;
      const list=h('div',{class:'menu dd-list',role:'listbox'});
      if(al)list.setAttribute('aria-label',al);
      const items=[];
      Array.from(sel.options).forEach((o,i)=>{
        if(o.hidden)return;
        const on=i===sel.selectedIndex;
        const it=h('button',{type:'button',class:'menu-item dd-opt',role:'option','aria-selected':String(on),'data-i':String(i)},h('span',{class:'mi-label'},labelOf(o)),on?icon('check',14):null);
        if(o.disabled)it.setAttribute('aria-disabled','true');
        items.push(it);list.appendChild(it)
      });
      if(!items.length)list.appendChild(h('div',{class:'dd-empty'},'Nothing to choose'));
      const scrim=h('div',{class:'dd-scrim',onmousedown:e=>{e.preventDefault();closeList(true)}});
      document.body.append(scrim,list);
      const r=trigger.getBoundingClientRect();
      list.style.minWidth=r.width+'px';
      list.style.maxWidth=Math.max(480,r.width)+'px';
      const below=innerHeight-r.bottom-12,above=r.top-12;
      const want=Math.min(340,list.scrollHeight);
      list.style.maxHeight=Math.max(120,Math.min(340,below>=want?below:Math.max(below,above)))+'px';
      placeFloating(list,r.left,r.bottom+4,{flipY:r.top-4});
      const onAway=()=>closeList();
      const onScroll=e=>{if(!list.contains(e.target))closeList()};
      window.addEventListener('resize',onAway);
      document.addEventListener('scroll',onScroll,true);
      openState={trigger,list,scrim,onAway,onScroll};
      trigger.setAttribute('aria-expanded','true');
      Layers.push('dd',()=>closeList(true));

      const usable=()=>items.filter(x=>x.getAttribute('aria-disabled')!=='true');
      list.addEventListener('click',e=>{const it=e.target.closest('.dd-opt');if(it)choose(+it.dataset.i)});
      list.addEventListener('mousemove',e=>{const it=e.target.closest('.dd-opt');if(it&&it!==document.activeElement&&it.getAttribute('aria-disabled')!=='true')it.focus({preventScroll:true})});
      list.addEventListener('keydown',ev=>{
        const u=usable();if(!u.length&&ev.key!=='Escape'&&ev.key!=='Tab')return;
        const i=u.indexOf(document.activeElement);
        if(ev.key==='ArrowDown'){ev.preventDefault();u[(i+1)%u.length].focus()}
        else if(ev.key==='ArrowUp'){ev.preventDefault();u[(i-1+u.length)%u.length].focus()}
        else if(ev.key==='Home'){ev.preventDefault();u[0].focus()}
        else if(ev.key==='End'){ev.preventDefault();u[u.length-1].focus()}
        else if(ev.key==='PageDown'){ev.preventDefault();u[Math.min(u.length-1,Math.max(0,i)+8)].focus()}
        else if(ev.key==='PageUp'){ev.preventDefault();u[Math.max(0,i-8)].focus()}
        else if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();if(i>=0)choose(+u[i].dataset.i)}
        else if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();closeList(true)}
        else if(ev.key==='Tab'){ev.preventDefault();closeList(true)}
        else if(ev.key.length===1&&!ev.ctrlKey&&!ev.metaKey&&!ev.altKey){
          const k=ev.key.toLowerCase();
          for(let j=1;j<=u.length;j++){const it=u[(Math.max(0,i)+j)%u.length];if(it.textContent.trim().toLowerCase().indexOf(k)===0){it.focus();break}}
        }
      });
      const target=items.find(x=>+x.dataset.i===sel.selectedIndex&&x.getAttribute('aria-disabled')!=='true')||usable()[0];
      if(target){
        target.focus({preventScroll:true});
        list.scrollTop=Math.max(0,target.offsetTop-list.clientHeight/2+target.offsetHeight/2)
      }
    };

    trigger.addEventListener('click',open);
    trigger.addEventListener('keydown',ev=>{if((ev.key==='ArrowDown'||ev.key==='ArrowUp')&&!ev.altKey&&!ev.ctrlKey&&!ev.metaKey){ev.preventDefault();open()}});
    sel.addEventListener('focus',()=>trigger.focus());

    sel._dd=true;
    sel.classList.add('dd-native');sel.tabIndex=-1;sel.setAttribute('aria-hidden','true');
    sel.parentNode.insertBefore(wrap,sel);
    wrap.append(trigger,sel);
    refresh()
  }

  function enhanceNumber(inp){
    if(inp._num||!inp.parentNode)return;
    inp._num=true;
    const wrap=h('span',{class:'num'});
    if(inp.style.width){wrap.style.width=inp.style.width;inp.style.width=''}
    const step=d=>{
      if(inp.disabled||inp.readOnly)return;
      const before=inp.value;
      if(d>0)inp.stepUp();else inp.stepDown();
      if(inp.value!==before){
        inp.dispatchEvent(new Event('input',{bubbles:true}));
        inp.dispatchEvent(new Event('change',{bubbles:true}))
      }
    };
    const mk=(d,name)=>{
      const b=h('button',{type:'button',class:'num-btn num-'+(d>0?'up':'down'),tabindex:'-1','aria-label':name},icon('chevDown',14));
      let t1=null,t2=null;
      const stop=()=>{clearTimeout(t1);clearInterval(t2);t1=t2=null};
      b.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        e.preventDefault();
        inp.focus({preventScroll:true});
        step(d);
        t1=setTimeout(()=>{t2=setInterval(()=>step(d),55)},380)
      });
      ['pointerup','pointerleave','pointercancel'].forEach(n=>b.addEventListener(n,stop));
      b.addEventListener('click',e=>{if(e.detail===0)step(d)});
      return b
    };
    inp.parentNode.insertBefore(wrap,inp);
    wrap.append(inp,h('span',{class:'num-btns'},mk(1,'Increase'),mk(-1,'Decrease')))
  }

  const inputValueDesc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');

  function enhanceSearch(inp){
    if(inp._clr||!inp.parentNode)return;
    inp._clr=true;
    const b=h('button',{type:'button',class:'icon-btn sm search-clear hidden',tabindex:'-1','aria-label':'Clear search'},icon('close',12));
    const sync=()=>b.classList.toggle('hidden',!inputValueDesc.get.call(inp));
    Object.defineProperty(inp,'value',{configurable:true,get(){return inputValueDesc.get.call(inp)},set(v){inputValueDesc.set.call(inp,v);sync()}});
    inp.addEventListener('input',sync);
    b.addEventListener('mousedown',e=>e.preventDefault());
    b.addEventListener('click',()=>{
      inp.value='';
      inp.dispatchEvent(new Event('input',{bubbles:true}));
      inp.focus()
    });
    inp.after(b);
    sync()
  }

  const SELECTOR='select,input[type="number"],input[type="search"]';
  function enhance(x){
    if(x.matches('select'))enhanceSelect(x);
    else if(x.matches('input[type="number"]'))enhanceNumber(x);
    else enhanceSearch(x)
  }
  function scan(root){
    if(!root||root.nodeType!==1||!root.isConnected)return;
    if(root.matches(SELECTOR))enhance(root);
    root.querySelectorAll(SELECTOR).forEach(enhance)
  }

  new MutationObserver(ms=>{for(const m of ms)m.addedNodes.forEach(scan)}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.body)scan(document.body);
  else document.addEventListener('DOMContentLoaded',()=>scan(document.body));

  return{scan,close:closeList}
})();
