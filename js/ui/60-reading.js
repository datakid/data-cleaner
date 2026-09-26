'use strict';
const ReadingDialog={
  async open(){
    if(!S.loaded)return;
    const readings=S.readings;
    let sel=Math.max(0,readings.findIndex(r=>r.kind===S.reading.kind));
    let params=W.clone(Object.assign({},readings[sel].params,readings[sel].kind===S.reading.kind?S.reading.params:{}));
    const raw=(await Engine.call('rawLines',{start:0,count:30})).lines;
    const list=h('div',{class:'reading-list'});
    const right=h('div',{style:{minWidth:'0'}});
    const body=h('div',{class:'dlg-body'},h('div',{class:'rd-layout'},h('div',{},h('div',{class:'sec-title'},'Possible readings'),list),right));
    const pv=h('div',{class:'mini-wrap',style:{maxHeight:'300px'}});const pvInfo=h('div',{class:'pv-line',style:{margin:'4px 0 8px'}});
    let t=null;
    const preview=()=>{clearTimeout(t);t=setTimeout(async()=>{
      let r;try{r=await Engine.call('previewReading',{reading:{kind:readings[sel].kind,params:clean(params)}},'readprev')}catch(e){if(e.stale)return;clear(pv).append(h('div',{class:'pv-err',style:{padding:'8px'}},e.message));pvInfo.textContent='';return}
      pvInfo.textContent=plural(r.cols.length,'column')+' · '+plural(r.n,'row')+(r.n>=3999?' in the first part':'');
      const show=r.cols.slice(0,12);
      clear(pv).append(h('table',{class:'mini-table'},h('thead',{},h('tr',{},show.map(c=>h('th',{title:c},c)))),h('tbody',{},r.rows.map(row=>h('tr',{},show.map((c,i)=>h('td',{title:row[i]||''},row[i]||'')))))))
    },150)};
    const clean=p=>{const o=Object.assign({},p);delete o.junk;return o};
    const drawList=()=>{clear(list);readings.forEach((r,i)=>list.append(h('button',{type:'button',class:'reading-item','aria-pressed':String(i===sel),onclick:()=>{sel=i;params=W.clone(r.params);drawList();drawRight()}},h('b',{},r.label),h('small',{},r.strength+' · '+plural(r.preview.cols.length,'column')))))};
    const num=(label,key,min)=>h('div',{class:'field'},h('label',{},label),h('input',{class:'input',type:'number',min:String(min||0),value:String(params[key]||0),oninput:e=>{params[key]=Math.max(min||0,parseInt(e.target.value,10)||0);if(params.junk)params.junk=null;preview()}}));
    const drawRight=()=>{
      const r=readings[sel];clear(right);
      right.append(h('div',{class:'rd-explain'},r.explain));
      const pr=h('div',{class:'rd-params'});
      if(r.kind==='delimited'){
        const dl=[[',','Comma'],['\t','Tab'],[';','Semicolon'],['|','Pipe']];
        const isCustom=!dl.some(x=>x[0]===params.delimiter);
        const cust=h('input',{class:'input mono',maxlength:'1',value:isCustom?params.delimiter:'',placeholder:'e.g. ~',style:{width:'70px'},oninput:e=>{if(e.target.value){params.delimiter=e.target.value;sel_.value='custom';preview()}}});
        const sel_=h('select',{class:'select',onchange:e=>{if(e.target.value!=='custom'){params.delimiter=e.target.value;preview()}else cust.focus()}},dl.map(x=>h('option',{value:x[0],selected:x[0]===params.delimiter},x[1])),h('option',{value:'custom',selected:isCustom},'Other character'));
        pr.append(h('div',{class:'field'},h('label',{},'Separator'),sel_),h('div',{class:'field'},h('label',{},'Other'),cust),
          h('div',{class:'field'},h('label',{},'Quote character'),h('select',{class:'select',onchange:e=>{params.quote=e.target.value;preview()}},[['"','Double quote "'],["'","Single quote '"],['','None']].map(x=>h('option',{value:x[0],selected:(params.quote===undefined?'"':params.quote)===x[0]},x[1])))))
      }
      if(r.kind==='key-value-blocks'){
        pr.append(h('div',{class:'field'},h('label',{},'Separator'),h('select',{class:'select',onchange:e=>{params.sep=e.target.value;preview()}},[[':','key: value'],['=','key=value']].map(x=>h('option',{value:x[0],selected:params.sep===x[0]},x[1])))),
          h('div',{class:'field'},h('label',{},'A new record starts at'),h('select',{class:'select',onchange:e=>{params.boundary=e.target.value;preview()}},[['blank','a blank line'],['repeat','the first key repeating']].map(x=>h('option',{value:x[0],selected:params.boundary===x[0]},x[1])))))
      }
      if(r.kind==='log-lines'){
        pr.append(h('label',{class:'check'},h('input',{type:'checkbox',checked:params.level!==false,onchange:e=>{params.level=e.target.checked;preview()}}),'Separate the level (INFO, ERROR…)'),
          h('label',{class:'check'},h('input',{type:'checkbox',checked:params.source!==false,onchange:e=>{params.source=e.target.checked;preview()}}),'Separate the source'),
          h('label',{class:'check'},h('input',{type:'checkbox',checked:!!params.pairs,onchange:e=>{params.pairs=e.target.checked;preview()}}),'Turn key=value pairs into columns'))
      }
      if(r.kind==='list')pr.append(h('label',{class:'check'},h('input',{type:'checkbox',checked:!!params.split,onchange:e=>{params.split=e.target.checked;preview()}}),'Split "name – detail" into two columns'));
      if(r.kind==='html-table'&&S.hasHtml){const n=(S.htmlCount||1);if(n>1)pr.append(h('div',{class:'field'},h('label',{},'Table'),h('select',{class:'select',onchange:e=>{params.tableIndex=+e.target.value;preview()}},S.htmlTables.map((t,i)=>h('option',{value:String(i),selected:i===(params.tableIndex||0)},'Table '+(i+1)+' of '+n+', '+t.rows.length+' × '+((t.rows[0]||[]).length))))))}
      if(r.kind!=='json'&&r.kind!=='ndjson'&&r.kind!=='logfmt'&&r.kind!=='access-log'&&r.kind!=='key-value-blocks'&&r.kind!=='lines'&&r.kind!=='prefixed-json'&&r.kind!=='line-blocks'&&r.kind!=='list'&&r.kind!=='log-lines')
        pr.append(h('label',{class:'check',style:{marginBottom:'8px'}},h('input',{type:'checkbox',checked:params.header!==false,onchange:e=>{params.header=e.target.checked;preview()}}),'First row is the header'));
      if(r.kind!=='json'&&r.kind!=='html-table')pr.append(num('Skip first lines','skipTop'),num('Skip last lines','skipBottom'));
      right.append(pr);
      if(r.kind==='fixed-width'){right.append(h('div',{class:'sec-title'},'Column cuts: click between characters to add, click a cut to remove, drag to move'));right.append(Ruler(raw,params.cuts||[0],cuts=>{params.cuts=cuts;preview()}))}
      right.append(h('div',{class:'sec-title'},'Preview'),pvInfo,pv);
      preview()
    };
    drawList();drawRight();
    const d=Dialog.open({title:'How Weft reads your text',wide:true,body,foot:[h('span',{class:'grow-1'},S.file?'Source: '+S.file:''),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>d.close()},'Cancel'),h('button',{class:'btn btn-primary',type:'button',onclick:async()=>{d.close(true);await chooseReading({kind:readings[sel].kind,params:clean(params)})}},'Use this reading')]})
  }
};

function Ruler(lines,cuts,onChange){
  cuts=cuts.slice().filter(c=>c>0).sort((a,b)=>a-b);
  const chW=7.53;
  let maxLen=0;lines.forEach(l=>{if(l.length>maxLen)maxLen=l.length});maxLen=Math.max(maxLen,40)+4;
  let ruler='';for(let i=0;i<maxLen;i++)ruler+=i%10===0?'|':(i%5===0?'+':'·');
  let nums='';for(let i=0;i<maxLen;i+=10){const s=String(i);nums+=s+' '.repeat(Math.max(1,10-s.length))}
  const inner=h('div',{class:'ruler-inner'});
  const rulerEl=h('div',{class:'ruler'},nums+'\n'+ruler);
  const rawEl=h('div',{class:'ruler-raw'},lines.map(l=>l.replace(/\t/g,'    ')).join('\n'));
  const hover=h('div',{class:'cut-hover hidden'});const caretEl=h('div',{class:'cut-caret'});
  inner.append(rulerEl,rawEl,hover,caretEl);
  const wrap=h('div',{class:'ruler-wrap',tabindex:'0','aria-label':'Column cut editor. Left and right arrows move the caret, Enter toggles a cut, Delete removes the nearest cut.'},inner);
  let caret=cuts[0]||10;let cutEls=[];
  const measure=()=>{const probe=h('span',{style:{font:'450 12.5px var(--mono)',visibility:'hidden',position:'absolute'}},'0'.repeat(100));document.body.appendChild(probe);const w=probe.getBoundingClientRect().width/100;probe.remove();return w||chW};
  let cw=chW;
  const x=c=>12+c*cw;
  const draw=()=>{
    cutEls.forEach(e=>e.remove());cutEls=[];
    const all=[0].concat(cuts,[maxLen]);
    for(let i=0;i<all.length-1;i++)if(i%2===1){const b=h('div',{class:'band',style:{left:x(all[i])+'px',width:(x(all[i+1])-x(all[i]))+'px'}});inner.appendChild(b);cutEls.push(b)}
    cuts.forEach((c,k)=>{
      const el=h('div',{class:'cut',style:{left:(x(c)-1)+'px'},title:'Cut at '+c+'. Click to remove, drag to move.'});
      el.addEventListener('mousedown',ev=>{ev.preventDefault();ev.stopPropagation();const sx=ev.clientX;let moved=false;
        const mv=e2=>{const d=Math.round((e2.clientX-sx)/cw);if(d!==0)moved=true;const nc=Math.max(1,Math.min(maxLen-1,c+d));el.style.left=(x(nc)-1)+'px';el.dataset.nc=nc};
        const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);if(!moved){cuts.splice(k,1)}else{cuts[k]=+el.dataset.nc;cuts=Array.from(new Set(cuts)).sort((a,b)=>a-b)}draw();onChange([0].concat(cuts))};
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up)});
      inner.appendChild(el);cutEls.push(el)
    });
    caretEl.style.left=x(caret)+'px'
  };
  const posFromEvent=e=>{const r=inner.getBoundingClientRect();return Math.max(1,Math.min(maxLen-1,Math.round((e.clientX-r.left-12)/cw)))};
  inner.addEventListener('mousemove',e=>{if(e.target.classList.contains('cut'))return hover.classList.add('hidden');const p=posFromEvent(e);hover.style.left=x(p)+'px';hover.classList.remove('hidden')});
  inner.addEventListener('mouseleave',()=>hover.classList.add('hidden'));
  inner.addEventListener('click',e=>{if(e.target.classList.contains('cut'))return;const p=posFromEvent(e);caret=p;if(cuts.indexOf(p)===-1){cuts.push(p);cuts.sort((a,b)=>a-b)}draw();onChange([0].concat(cuts))});
  wrap.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'){e.preventDefault();caret=Math.min(maxLen-1,caret+(e.shiftKey?5:1));draw()}
    else if(e.key==='ArrowLeft'){e.preventDefault();caret=Math.max(1,caret-(e.shiftKey?5:1));draw()}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();const i=cuts.indexOf(caret);if(i===-1){cuts.push(caret);cuts.sort((a,b)=>a-b)}else cuts.splice(i,1);draw();onChange([0].concat(cuts));announce(i===-1?'Cut added at '+caret:'Cut removed at '+caret)}
    else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(!cuts.length)return;let best=0;cuts.forEach((c,i)=>{if(Math.abs(c-caret)<Math.abs(cuts[best]-caret))best=i});const rm=cuts.splice(best,1)[0];draw();onChange([0].concat(cuts));announce('Cut removed at '+rm)}
  });
  requestAnimationFrame(()=>{cw=measure();inner.style.width=(x(maxLen)+12)+'px';draw()});
  return wrap
}
