'use strict';
const W=window.WeftCore;
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const isMac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent||'');
const MOD=isMac?'⌘':'Ctrl ';
const fmtInt=W.fmtInt,plural=W.plural,trunc=W.trunc;
const PROPS=new Set(['value','checked','disabled','selected','indeterminate','readOnly','spellcheck']);
function h(tag,attrs){
  const el=document.createElement(tag);
  if(attrs)for(const k in attrs){
    const v=attrs[k];
    if(v==null||v===false)continue;
    if(k==='class')el.className=v;
    else if(k==='text')el.textContent=v;
    else if(k==='style'&&typeof v==='object')Object.assign(el.style,v);
    else if(k==='dataset')Object.assign(el.dataset,v);
    else if(k.slice(0,2)==='on'&&typeof v==='function')el.addEventListener(k.slice(2),v);
    else if(PROPS.has(k))el[k]=v;
    else el.setAttribute(k,v===true?'':v)
  }
  for(let i=2;i<arguments.length;i++)append(el,arguments[i]);
  return el
}
function append(el,c){
  if(c==null||c===false)return;
  if(Array.isArray(c)){c.forEach(x=>append(el,x));return}
  el.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(String(c)):c)
}
function clear(el){while(el.firstChild)el.removeChild(el.firstChild);return el}

const ICON_PATHS={
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  command:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9l6 6M15 9l-6 6" opacity="0"/><path d="M9.5 8v8M9.5 12l5-4M11.5 10.5l3.5 5.5"/>',
  trash:'<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.5h9l1-12.5"/>',
  rows:'<rect x="4" y="4.5" width="16" height="15" rx="3"/><path d="M4 9.5h16M4 14.5h16"/>',
  columns:'<rect x="4" y="4.5" width="16" height="15" rx="3"/><path d="M9.5 4.5v15M14.5 4.5v15"/>',
  filter:'<path d="M4.5 5.5h15l-5.8 7v5.5l-3.4 1.5v-7z"/>',
  sortAsc:'<path d="M7 18V6M3.5 9.5L7 6l3.5 3.5M13 7h7M13 12h5M13 17h3"/>',
  sortDesc:'<path d="M7 6v12M3.5 14.5L7 18l3.5-3.5M13 7h3M13 12h5M13 17h7"/>',
  split:'<path d="M12 4v16M5 8l-2.5 4L5 16M19 8l2.5 4L19 16M7.5 12H3M21 12h-4.5"/>',
  merge:'<path d="M4 6l6 6-6 6M20 6l-6 6 6 6"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff:'<path d="M3 3l18 18M10.5 5.7A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.3 0 2.5-.3 3.6-.8"/>',
  keyboard:'<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M6.5 10h1M10.5 10h1M14.5 10h1M8 14h8"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.7 2.2c-.8.4-1.3 1-1.3 1.9v.4"/><path d="M12 17.2v.1"/>',
  more:'<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3"/>',
  chevDown:'<path d="M7 10l5 5 5-5"/>',
  chevRight:'<path d="M10 7l5 5-5 5"/>',
  grip:'<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="2.8"/>',
  undo:'<path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11"/>',
  redo:'<path d="M15 7l4.5 4.5L15 16"/><path d="M19 11.5H9.5a5 5 0 0 0 0 10H13"/>',
  download:'<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  upload:'<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
  copy:'<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  file:'<path d="M13.5 3.5H7A2 2 0 0 0 5 5.5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13.5 3.5V9H19"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.1"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  save:'<path d="M5 4.5h11l3.5 3.5v11.5H5z"/><path d="M8.5 4.5v4.5h6V4.5M8 19.5v-5.5h8v5.5"/>',
  library:'<path d="M5 4.5v15M9.5 4.5v15M14 5l4.5 14"/>',
  compare:'<path d="M8 4v16M16 4v16M4 8h4M16 16h4M4 14l4-4M20 10l-4 4"/>',
  wand:'<path d="M4.5 19.5l11-11M13.5 6.5l4 4"/><path d="M18.5 3v3M20 4.5h-3M6 4v2M7 5H5"/>',
  pencil:'<path d="M15.5 4.5l4 4L8.5 19.5h-4v-4z"/><path d="M13 7l4 4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  text:'<path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/>',
  structure:'<path d="M4 6h16M4 12h7M15 12h5M4 18h4M12 18h8"/>',
  reshape:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/><path d="M15 7h2.5A1.5 1.5 0 0 1 19 8.5V10M9 17H6.5A1.5 1.5 0 0 1 5 15.5V14"/>',
  combine:'<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
  view:'<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 9.5h17"/>',
  recipe:'<path d="M6 4.5h9l3 3v12H6z"/><path d="M9 11h6M9 14.5h6M9 7.5h3"/>',
  back:'<path d="M14.5 6l-6 6 6 6"/>',
  clipboard:'<rect x="5" y="5" width="14" height="16" rx="2.5"/><path d="M9 5V3.5h6V5M9 11h6M9 15h4"/>',
  sparkle:'<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 16v4M16.5 18h4"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  panelLeft:'<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
  panelRight:'<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M14.5 4.5v15"/>',
  menu:'<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>'
};
function icon(name,size){
  const s=document.createElement('span');
  s.className='ico';s.setAttribute('aria-hidden','true');s.style.display='inline-flex';
  s.innerHTML='<svg width="'+(size||16)+'" height="'+(size||16)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+(ICON_PATHS[name]||'')+'</svg>';
  return s
}

const Prefs={
  d:{},
  load(){try{this.d=JSON.parse(localStorage.getItem('weft.prefs.v1')||'{}')}catch(e){this.d={}}return this.d},
  get(k,def){return this.d[k]===undefined?def:this.d[k]},
  set(k,v){this.d[k]=v;try{localStorage.setItem('weft.prefs.v1',JSON.stringify(this.d))}catch(e){}}
};
Prefs.load();
function lsGet(k,def){try{const v=localStorage.getItem(k);return v==null?def:JSON.parse(v)}catch(e){return def}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}

const Layers={
  stack:[],
  push(id,close){this.pop(id,true);this.stack.push({id,close});},
  pop(id,silent){const i=this.stack.findIndex(l=>l.id===id);if(i!==-1)this.stack.splice(i,1)},
  top(){return this.stack[this.stack.length-1]},
  closeTop(){const t=this.top();if(!t)return false;this.stack.pop();try{t.close()}catch(e){}return true},
  has(id){return this.stack.some(l=>l.id===id)}
};

const Toast={
  root:null,
  show(msg,o){
    o=o||{};
    if(!this.root)this.root=$('#toastRoot');
    const el=h('div',{class:'toast'+(o.err?' err':''),role:o.err?'alert':'status'},h('span',{text:msg}));
    const done=()=>{if(!el.parentNode)return;el.classList.add('out');setTimeout(()=>el.remove(),130)};
    if(o.undo)el.appendChild(h('button',{type:'button',onclick:()=>{done();o.undo()}},'Undo'));
    if(o.action)el.appendChild(h('button',{type:'button',onclick:()=>{done();o.action.fn()}},o.action.label));
    while(this.root.children.length>=3)this.root.firstChild.remove();
    this.root.appendChild(el);
    setTimeout(done,o.duration||(o.undo?8000:o.err?7000:3800));
    return el
  },
  err(msg,o){return this.show(msg,Object.assign({err:true},o||{}))}
};
function announce(msg){const el=$('#srAnnounce');if(!el)return;el.textContent='';requestAnimationFrame(()=>{el.textContent=msg})}

async function copyText(text,msg){
  try{await navigator.clipboard.writeText(text);if(msg)Toast.show(msg);return true}
  catch(e){
    const ta=h('textarea',{style:{position:'fixed',opacity:'0',left:'-9999px'}});ta.value=text;document.body.appendChild(ta);ta.select();
    let ok=false;try{ok=document.execCommand('copy')}catch(e2){}
    ta.remove();
    if(ok){if(msg)Toast.show(msg)}else Toast.err('The browser blocked clipboard access. Use Download instead.');
    return ok
  }
}
function downloadText(name,text,mime){
  const b=new Blob([text],{type:(mime||'text/plain')+';charset=utf-8'});
  const u=URL.createObjectURL(b);const a=h('a',{href:u,download:name});
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000)
}
function debounce(fn,ms){let t;return function(){const a=arguments,self=this;clearTimeout(t);t=setTimeout(()=>fn.apply(self,a),ms)}}
function placeFloating(el,x,y,opts){
  opts=opts||{};
  el.style.left='0px';el.style.top='0px';
  const r=el.getBoundingClientRect(),vw=innerWidth,vh=innerHeight;
  let left=x,top=y;
  if(left+r.width>vw-8)left=opts.flipX!=null?opts.flipX-r.width:vw-8-r.width;
  if(top+r.height>vh-8)top=opts.flipY!=null?Math.max(8,opts.flipY-r.height):vh-8-r.height;
  el.style.left=Math.max(8,left)+'px';el.style.top=Math.max(8,top)+'px'
}
function isEditable(t){return!!t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
