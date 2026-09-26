'use strict';
function getPath(o,p){return p.split('.').reduce((a,k)=>a==null?a:a[k],o)}
function setPath(o,p,v){const ks=p.split('.');let x=o;for(let i=0;i<ks.length-1;i++){if(x[ks[i]]==null||typeof x[ks[i]]!=='object')x[ks[i]]={};x=x[ks[i]]}x[ks[ks.length-1]]=v}

function StepForm(opId,cfg,opts){
  opts=opts||{};
  const def=W.OPS[opId];
  const f={opId,cfg:W.clone(cfg),def,el:h('div',{class:'step-form'}),onChange:opts.onChange||(()=>{}),stateIdx:opts.stateIdx};
  const cols=opts.cols||curCols();
  const types=opts.types||curTypes();
  const changed=()=>{f.onChange(f.cfg);renderShow()};
  const blocks=[];
  function colChips(key,allowAll,optional,source){
    const list=source||cols;
    const wrap=h('div',{class:'col-chips',role:'group'});
    const cur=()=>getPath(f.cfg,key)||[];
    const draw=()=>{
      clear(wrap);
      const v=cur();
      if(allowAll)wrap.appendChild(h('button',{type:'button',class:'col-chip all','aria-pressed':String(v[0]==='*'),onclick:()=>{setPath(f.cfg,key,['*']);draw();changed()}},'All columns'));
      list.forEach(c=>wrap.appendChild(h('button',{type:'button',class:'col-chip','aria-pressed':String(v[0]!=='*'&&v.indexOf(c)!==-1),title:c,onclick:()=>{let x=cur().filter(z=>z!=='*');x=x.indexOf(c)!==-1?x.filter(z=>z!==c):x.concat([c]);if(!x.length&&allowAll)x=['*'];setPath(f.cfg,key,x);draw();changed()}},c)))
    };
    draw();return wrap
  }
  function colSelect(key,source,allowAny){
    const list=source||cols;const v=getPath(f.cfg,key);
    const s=h('select',{class:'select',onchange:()=>{setPath(f.cfg,key,s.value);changed()}});
    if(allowAny)s.appendChild(h('option',{value:'*'},'Any column'));
    list.forEach(c=>s.appendChild(h('option',{value:c,selected:c===v},c)));
    if(v&&list.indexOf(v)===-1&&v!=='*')s.appendChild(h('option',{value:v,selected:true},v+' (missing)'));
    return s
  }
  for(const fd of def.fields){
    let ctl=null;const id='ff_'+Math.random().toString(36).slice(2);
    const v=getPath(f.cfg,fd.key);
    switch(fd.type){
      case'columns':ctl=colChips(fd.key,fd.allowAll);break;
      case'column':ctl=colSelect(fd.key);ctl.id=id;break;
      case'text':ctl=h('input',{class:'input'+(/pattern|find|delim|joiner/i.test(fd.key)?' mono':''),id,value:v==null?'':v,placeholder:fd.placeholder||'',oninput:e=>{setPath(f.cfg,fd.key,e.target.value);changed()}});break;
      case'number':ctl=h('input',{class:'input',id,type:'number',min:fd.oneBased?'1':'0',value:v==null?0:(fd.oneBased?(+v)+1:v),style:{width:'120px'},oninput:e=>{let n=parseInt(e.target.value,10);if(isNaN(n))n=0;setPath(f.cfg,fd.key,fd.oneBased?Math.max(0,n-1):n);changed()}});break;
      case'checkbox':ctl=h('label',{class:'check'},h('input',{type:'checkbox',checked:v!==false&&!!v,onchange:e=>{setPath(f.cfg,fd.key,e.target.checked);changed()}}),fd.label);break;
      case'select':{ctl=h('select',{class:'select',id,onchange:e=>{setPath(f.cfg,fd.key,e.target.value);changed();if(fd.key==='preset'&&opId==='extract'){const c=f.cfg;if(!c.into||/_(email|phone|url|number|date|zip|hashtag|ip|extracted)$/.test(c.into)){c.into=c.column+'_'+(c.preset||'extracted');const inp=f.el.querySelector('[data-key="into"] input');if(inp)inp.value=c.into}}}});fd.options.forEach(o=>ctl.appendChild(h('option',{value:o[0],selected:String(v==null?'':v)===o[0]},o[1])));break}
      case'textlist':ctl=h('input',{class:'input',id,value:Array.isArray(v)?v.join(', '):'',placeholder:'automatic',oninput:e=>{setPath(f.cfg,fd.key,e.target.value.split(',').map(s=>s.trim()).filter(Boolean));changed()}});break;
      case'numlist':ctl=h('input',{class:'input mono',id,value:Array.isArray(v)?v.join(', '):'',placeholder:'detect automatically',oninput:e=>{const a=e.target.value.split(/[,\s]+/).map(Number).filter(n=>!isNaN(n)&&e.target.value.trim());setPath(f.cfg,fd.key,a.length?a:undefined);changed()}});break;
      case'conditions':ctl=FilterBuilder(f,cols,types,changed);break;
      case'sortkeys':ctl=SortKeys(f,cols,changed);break;
      case'metrics':ctl=MetricsEditor(f,cols,types,changed);break;
      case'reference':{const refs=S.refs.map(r=>r.name);ctl=h('div',{style:{display:'flex',gap:'8px',alignItems:'center'}});const s=h('select',{class:'select',style:{flex:'1'},onchange:()=>{setPath(f.cfg,fd.key,s.value);changed();f.rerender&&f.rerender()}});if(!refs.length)s.appendChild(h('option',{value:''},'No reference files loaded'));refs.forEach(n=>s.appendChild(h('option',{value:n,selected:n===v},n)));ctl.append(s,h('button',{type:'button',class:'btn btn-sm btn-secondary',onclick:()=>loadReference(()=>f.rerender&&f.rerender())},'Load file…'));break}
      case'refColumns':{const ref=S.refs.find(r=>r.name===f.cfg.refName);ctl=ref?colChips(fd.key,false,fd.optional,ref.cols):h('div',{class:'hint'},'Load and pick a reference file first.');break}
    }
    if(!ctl)continue;
    const blk=fd.type==='checkbox'?h('div',{class:'field-cb','data-key':fd.key},ctl):h('div',{class:'field','data-key':fd.key},fd.type==='conditions'||fd.type==='sortkeys'?null:h('label',{for:id},fd.label),ctl);
    blk._fd=fd;blocks.push(blk);f.el.appendChild(blk)
  }
  function renderShow(){blocks.forEach(b=>{const s=b._fd.showIf;if(!s)return;const ok=Object.keys(s).every(k=>String(getPath(f.cfg,k)==null?'':getPath(f.cfg,k))===String(s[k]));b.classList.toggle('hidden',!ok)})}
  renderShow();
  if(!def.fields.length)f.el.appendChild(h('p',{class:'dlg-note'},'This step has no settings.'));
  f.validate=()=>def.validate?def.validate(f.cfg,{cols,types}):null;
  return f
}

function FilterBuilder(f,cols,types,changed){
  const c=f.cfg;c.conditions=c.conditions||[];c.match=c.match||'all';c.mode=c.mode||'remove';
  const wrap=h('div',{class:'filter-builder'});
  const typeOf=col=>col==='*'?'text':(types[cols.indexOf(col)]||'text');
  function opsFor(col){const t=typeOf(col);return W.COND_OPS.filter(o=>t==='text'?(o[2]!=='cmp'&&o[2]!=='range'):true).concat(t==='text'?W.COND_OPS.filter(o=>o[2]==='cmp'||o[2]==='range'):[])}
  function draw(){
    clear(wrap);
    const seg=h('div',{class:'seg keeprm',role:'group','aria-label':'Keep or remove'},['keep','remove'].map(v=>h('button',{type:'button','data-v':v,'aria-pressed':String(c.mode===v),onclick:()=>{c.mode=v;draw();changed()}},v==='keep'?'Keep':'Remove')));
    const m=h('select',{class:'select',onchange:e=>{c.match=e.target.value;changed()}},h('option',{value:'all',selected:c.match==='all'},'all'),h('option',{value:'any',selected:c.match==='any'},'any'));
    wrap.append(h('div',{class:'fb-top'},seg,h('span',{},'rows where'),m,h('span',{},'of these are true')));
    c.conditions.forEach((cd,i)=>{
      const colS=h('select',{class:'select','aria-label':'Column',onchange:e=>{cd.col=e.target.value;const ok=opsFor(cd.col).some(o=>o[0]===cd.op);if(!ok)cd.op='contains';draw();changed()}},h('option',{value:'*',selected:cd.col==='*'},'Any column'),cols.map(x=>h('option',{value:x,selected:x===cd.col},x)));
      const opS=h('select',{class:'select','aria-label':'Comparison',onchange:e=>{cd.op=e.target.value;draw();changed()}},opsFor(cd.col).map(o=>h('option',{value:o[0],selected:o[0]===cd.op},o[1])));
      const k=W.COND_KIND[cd.op];const vals=h('div',{class:'vals'});
      const ph=typeOf(cd.col)==='date'?'e.g. 2025-01-31':typeOf(cd.col)==='number'?'e.g. 100':'value';
      if(k==='text'||k==='cmp')vals.append(h('input',{class:'input'+(cd.op==='matches'?' mono':''),'aria-label':'Value',value:cd.value||'',placeholder:cd.op==='matches'?'pattern, e.g. ^ref \\d+$':ph,oninput:e=>{cd.value=e.target.value;changed()}}));
      else if(k==='range')vals.append(h('input',{class:'input','aria-label':'From',value:cd.value||'',placeholder:ph,oninput:e=>{cd.value=e.target.value;changed()}}),h('span',{class:'hint'},'and'),h('input',{class:'input','aria-label':'To',value:cd.value2||'',placeholder:ph,oninput:e=>{cd.value2=e.target.value;changed()}}));
      else if(k==='list')vals.append(h('input',{class:'input','aria-label':'Values',value:(cd.values||[]).join(', '),placeholder:'comma-separated values',oninput:e=>{cd.values=e.target.value.split(',').map(s=>s.trim()).filter(Boolean);changed()}}));
      else vals.append(h('span',{class:'hint'},'No value needed'));
      wrap.append(h('div',{class:'cond-row'},colS,opS,vals,h('button',{type:'button',class:'icon-btn','aria-label':'Remove condition',disabled:c.conditions.length<2,onclick:()=>{c.conditions.splice(i,1);draw();changed()}},icon('close',14))))
    });
    wrap.append(h('button',{type:'button',class:'btn btn-sm btn-ghost',onclick:()=>{c.conditions.push({col:c.conditions.length?c.conditions[c.conditions.length-1].col:(cols[0]||'*'),op:'contains',value:'',caseSensitive:false});draw();changed()}},icon('plus',14),'Add condition'))
  }
  draw();return wrap
}
function SortKeys(f,cols,changed){
  const c=f.cfg;c.keys=c.keys||[];const wrap=h('div');
  function draw(){
    clear(wrap);wrap.append(h('div',{class:'flabel',style:{marginBottom:'6px'}},'Sort by'));
    c.keys.forEach((k,i)=>{
      wrap.append(h('div',{class:'cond-row',style:{gridTemplateColumns:'1.4fr 1fr 1fr 32px'}},
        h('select',{class:'select','aria-label':'Column',onchange:e=>{k.col=e.target.value;changed()}},cols.map(x=>h('option',{value:x,selected:x===k.col},x))),
        h('select',{class:'select','aria-label':'Direction',onchange:e=>{k.dir=e.target.value;changed()}},h('option',{value:'asc',selected:k.dir!=='desc'},'Ascending (A→Z, 1→9)'),h('option',{value:'desc',selected:k.dir==='desc'},'Descending (Z→A, 9→1)')),
        h('select',{class:'select','aria-label':'Compare as',onchange:e=>{k.type=e.target.value;changed()}},[['auto','Detect type'],['text','As text'],['number','As numbers'],['date','As dates']].map(o=>h('option',{value:o[0],selected:(k.type||'auto')===o[0]},o[1]))),
        h('button',{type:'button',class:'icon-btn','aria-label':'Remove sort key',disabled:c.keys.length<2,onclick:()=>{c.keys.splice(i,1);draw();changed()}},icon('close',14))))
    });
    wrap.append(h('button',{type:'button',class:'btn btn-sm btn-ghost',onclick:()=>{c.keys.push({col:cols.find(x=>!c.keys.some(k=>k.col===x))||cols[0],dir:'asc',type:'auto'});draw();changed()}},icon('plus',14),'Then by…'))
  }
  draw();return wrap
}
function MetricsEditor(f,cols,types,changed){
  const c=f.cfg;c.metrics=c.metrics||['count'];const wrap=h('div');
  const FN=[['count','Count rows'],['sum','Sum'],['average','Average'],['min','Smallest'],['max','Largest'],['first','First value'],['last','Last value'],['concat','List values'],['distinct','Count distinct']];
  function draw(){
    clear(wrap);
    c.metrics.forEach((m,i)=>{
      const p=W.parseMetric(m)||{column:null,fn:'count'};
      const fnS=h('select',{class:'select','aria-label':'Calculation',onchange:e=>{const fn=e.target.value;c.metrics[i]=fn==='count'&&!p.column?'count':(p.column||cols[0])+':'+fn;draw();changed()}},FN.map(o=>h('option',{value:o[0],selected:o[0]===p.fn},o[1])));
      const colS=h('select',{class:'select','aria-label':'Column',onchange:e=>{c.metrics[i]=e.target.value==='*'?'count':e.target.value+':'+p.fn;draw();changed()}},p.fn==='count'?h('option',{value:'*',selected:!p.column},'(all rows)'):null,cols.map(x=>h('option',{value:x,selected:x===p.column},x)));
      wrap.append(h('div',{class:'cond-row',style:{gridTemplateColumns:'1fr 1.3fr 32px'}},fnS,colS,h('button',{type:'button',class:'icon-btn','aria-label':'Remove',disabled:c.metrics.length<2,onclick:()=>{c.metrics.splice(i,1);draw();changed()}},icon('close',14))))
    });
    wrap.append(h('button',{type:'button',class:'btn btn-sm btn-ghost',onclick:()=>{const num=cols.find((x,i)=>types[i]==='number');c.metrics.push((num||cols[0])+':sum');draw();changed()}},icon('plus',14),'Add calculation'))
  }
  draw();return wrap
}

function PreviewBox(){
  const el=h('div',{class:'preview-box','aria-live':'polite'});let t=null,seq=0;
  const miniTable=(cols,rows,opts)=>{
    opts=opts||{};
    const show=cols.slice(0,8);
    const tb=h('table',{class:'mini-table'},h('thead',{},h('tr',{},show.map(c=>h('th',{title:c},c)))),h('tbody',{},rows.map((r,ri)=>h('tr',{class:opts.gone?'gone':''},show.map((c,ci)=>{const td=h('td',{title:r[ci]||''},r[ci]||'');if(opts.chg&&opts.chg[ri]&&opts.chg[ri].has(ci))td.className='chg';return td})))));
    return h('div',{class:'mini-wrap'},tb)
  };
  return{el,update(opId,cfg,stateIdx){
    clearTimeout(t);const my=++seq;
    t=setTimeout(async()=>{
      let r;try{r=await Engine.call('preview',{stateIdx,step:{opId,cfg}},'preview')}catch(e){if(e.stale)return;r={error:e.message}}
      if(my!==seq)return;
      clear(el);
      if(r.error){el.append(h('div',{class:'pv-err'},r.error));return}
      const d=r.n1-r.n0;
      const line=h('div',{class:'pv-line'});
      if(r.stats.removed){line.append(opId==='filterRows'&&cfg.mode==='keep'?'Keeps ':'Removes ',h('span',{class:'neg'},fmtInt(r.stats.removed)),' of '+fmtInt(r.n0)+' rows')}
      else if(d>0)line.append('Adds ',h('span',{class:'pos'},fmtInt(d)),' rows ('+fmtInt(r.n0)+' → '+fmtInt(r.n1)+')');
      else{const ch=r.chips.filter(c=>c.kind!=='none').map(c=>c.text);line.textContent=ch.length?ch.join(' · '):'No rows or cells would change'}
      el.append(line);
      if(r.warning)el.append(h('div',{class:'pv-warn'},r.warning));
      if(r.removedSample&&r.removedSample.length){el.append(h('div',{class:'pv-sec'},'Removed rows (sample)'),miniTable(r.cols0,r.removedSample,{gone:true}))}
      if(r.after&&r.after.length){
        const chg=r.after.map((row,i)=>{const b=r.before[i];const s=new Set();if(b&&r.cols0.join()===r.cols1.join())row.forEach((v,ci)=>{if(v!==b[ci])s.add(ci)});else r.touchedCols.forEach(c=>{const ci=r.cols1.indexOf(c);if(ci!==-1)s.add(ci)});return s});
        el.append(h('div',{class:'pv-sec'},r.stats.removed?'Kept rows (sample)':'Result (sample)'),miniTable(r.cols1,r.after,{chg}))
      }
    },180)
  }}
}

function stepDialog(opId,cfg,opts){
  opts=opts||{};
  const def=W.OPS[opId];
  const stateIdx=opts.editIndex!=null?opts.editIndex:S.viewIdx;
  return new Promise(async resolve=>{
    let cols=curCols(),types=curTypes();
    if(opts.editIndex!=null&&opts.editIndex!==S.viewIdx){const sc=await Engine.call('schema',{stateIdx});cols=sc.cols.map(c=>c.name);types=sc.cols.map(c=>c.type)}
    const pv=PreviewBox();
    const err=h('div',{class:'pv-err',style:{minHeight:'18px'}});
    let form;
    const body=h('div',{class:'dlg-body'});
    const build=()=>{
      clear(body);
      form=StepForm(opId,form?form.cfg:cfg,{cols,types,onChange:c=>{const e=form.validate();err.textContent=e||'';okBtn.disabled=!!e;if(!e)pv.update(opId,c,stateIdx)}});
      form.rerender=()=>build();
      body.append(opts.note?h('p',{class:'dlg-note'},opts.note):null,form.el,err,pv.el);
      const e=form.validate();err.textContent=e||'';okBtn.disabled=!!e;if(!e)pv.update(opId,form.cfg,stateIdx)
    };
    const okBtn=h('button',{class:'btn btn-primary',type:'button',onclick:()=>{const e=form.validate();if(e){err.textContent=e;return}close(form.cfg)}},opts.editIndex!=null?'Update step':'Add step');
    const d=Dialog.open({title:opts.title||def.label,wide:opts.wide,cls:'mid',body,foot:[h('span',{class:'grow-1'},opts.editIndex!=null?'Editing step '+(opts.editIndex+1)+'. Later steps will re-run.':(atEnd()?'Adds a new step at the end.':'Inserts after step '+S.viewIdx+'.')),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>close(null)},'Cancel'),okBtn],onClose:()=>resolve(null)});
    function close(v){d.close(true);resolve(v)}
    build();
    setTimeout(()=>{const x=body.querySelector('input:not([type=checkbox]),select');if(x)x.focus()},30)
  })
}
async function openStepConfig(opId,overrides,opts){
  if(!S.loaded){Toast.err('Load some data first.');return}
  const def=W.OPS[opId];
  const schema={cols:curCols(),types:curTypes()};
  let cfg=def.defaults?def.defaults(schema,overrides||{}):{};
  if(overrides&&overrides.cfg)cfg=Object.assign(cfg,overrides.cfg);
  const res=await stepDialog(opId,cfg,opts);
  if(res)await addStep(opId,res)
}
async function editStep(i){
  const st=S.steps[i];if(!st)return;
  const def=W.OPS[st.opId];
  if(!def.fields.length||def.portable===false&&st.opId!=='cellOverride'){openRecipeText();return}
  if(st.opId==='cellOverride'||st.opId==='infer'){openRecipeText();return}
  const res=await stepDialog(st.opId,st.cfg,{editIndex:i,title:'Edit step '+(i+1)+': '+def.label});
  if(res)await replaceStep(i,res)
}
function openFilterBuilder(cfg){openStepConfig('filterRows',{cfg})}
