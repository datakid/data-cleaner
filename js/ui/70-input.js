'use strict';
function extractHtmlTables(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const out=[];
  const norm=s=>String(s||'').replace(/[\s\u00A0]+/g,' ').trim();
  doc.querySelectorAll('table').forEach(tb=>{
    const trs=Array.from(tb.rows);if(!trs.length)return;
    const grid=[];let spans=0;let thRows=0;
    trs.forEach((tr,ri)=>{
      grid[ri]=grid[ri]||[];
      const cells=Array.from(tr.cells);
      const isHead=cells.length&&cells.every(c=>c.tagName==='TH')||tr.parentNode.tagName==='THEAD';
      if(isHead&&ri===thRows)thRows++;
      let ci=0;
      cells.forEach(cell=>{
        while(grid[ri][ci]!==undefined)ci++;
        const txt=norm(cell.textContent);
        const cs=Math.min(50,Math.max(1,cell.colSpan||1)),rs=Math.min(500,Math.max(1,cell.rowSpan||1));
        if(rs>1)spans++;
        for(let dr=0;dr<rs;dr++){
          const r=ri+dr;grid[r]=grid[r]||[];
          for(let dc=0;dc<cs;dc++){grid[r][ci+dc]=dc===0||isHead?txt:''}
        }
        ci+=cs
      })
    });
    let w=0;grid.forEach(r=>{if(r&&r.length>w)w=r.length});
    let rows=grid.filter(Boolean).map(r=>{const o=[];for(let i=0;i<w;i++)o.push(r[i]==null?'':r[i]);return o});
    if(thRows>1){
      const head=rows[0].map((_,c)=>{const parts=[];for(let r=0;r<thRows;r++){const v=rows[r][c];if(v&&parts[parts.length-1]!==v)parts.push(v)}return parts.join(' ')});
      rows=[head].concat(rows.slice(thRows))
    }
    if(thRows>=1)rows[0]=W.dedupeColNames(rows[0].map((v,i)=>v||'column_'+(i+1)));
    rows=rows.filter(r=>r.some(v=>v!==''));
    if(rows.length<1||w<1)return;
    out.push({rows,thHeader:thRows>=1,warnings:spans?[plural(spans,'cell')+' spanned several rows; their value was repeated down.']:[]})
  });
  out.sort((a,b)=>b.rows.length*b.rows[0].length-a.rows.length*a.rows[0].length);
  return out
}

const Input={
  async loadText(text,fileName,html){
    $('#parseErr').textContent='';
    let htmlTables=null;
    if(html&&/<table/i.test(html)){try{htmlTables=extractHtmlTables(html)}catch(e){htmlTables=null}}
    if((!text||!text.trim())&&!(htmlTables&&htmlTables.length)){this.showErr('There is nothing to read. Paste some text or open a file.');return}
    const hint=S.pendingRecipe?(W.textToSteps(S.pendingRecipe.text).source||null):null;
    let r;
    try{r=await Busy.run('Reading your data',()=>Engine.call('load',{text:text||'',htmlTables,fileName:fileName||'',hint}))}
    catch(e){this.showErr(e.message);return}
    S.sourceText={text,html:htmlTables};S.htmlTables=htmlTables;S.htmlCount=htmlTables?htmlTables.length:0;
    await applyLoad(r,{fileName});
    const msg='Read as '+r.reading.label+' · '+plural(r.baseSchema.n,'row')+' × '+plural(r.baseSchema.cols.length,'column');
    Toast.show(msg);announce(msg);
    if(S.pendingRecipe){const p=S.pendingRecipe;S.pendingRecipe=null;await applyRecipeText(p.text,p.opts)}
  },
  showErr(msg){if(S.loaded)Toast.err(msg);else{const el=$('#parseErr');clear(el).append(icon('alert',14),h('span',{},msg))}},
  async loadFile(f){
    if(!f)return;
    if(f.size>300e6){this.showErr('That file is '+fmtBytes(f.size)+'. Weft cannot open files over 300 MB in a browser tab.');return}
    if(f.size>50e6&&!(await Dialog.confirm('Open a large file?','"'+f.name+'" is '+fmtBytes(f.size)+'. Reading it may take a while and use a lot of memory.','Open it')))return;
    if(/\.(xlsx|xls|numbers|pdf|docx|zip|png|jpe?g)$/i.test(f.name)){this.showErr('Weft reads text files (CSV, TSV, JSON, logs, plain text). For '+f.name.split('.').pop().toUpperCase()+' files, copy the table and paste it here instead.');return}
    let text;try{text=await f.text()}catch(e){this.showErr('Could not read the file: '+e.message);return}
    if(/\.weft\.txt$/i.test(f.name)||/^#\s*(weft|sift) recipe v\d/i.test(text.slice(0,40))){applyRecipeText(text,{name:f.name});return}
    if(/\.html?$/i.test(f.name))return this.loadText('',f.name,text);
    await this.loadText(text,f.name)
  },
  async loadSample(kind){
    const s=W.makeSample(kind);
    if(kind==='stress')Toast.show('Generating 200,000 rows…');
    await this.loadText(s.text,s.fileName,s.html)
  },
  async pasteFromClipboard(){
    try{
      if(navigator.clipboard.read){
        const items=await navigator.clipboard.read();let html='',text='';
        for(const it of items){if(it.types.indexOf('text/html')!==-1)html=await(await it.getType('text/html')).text();if(it.types.indexOf('text/plain')!==-1)text=await(await it.getType('text/plain')).text()}
        return this.loadText(text,'',html)
      }
      const t=await navigator.clipboard.readText();return this.loadText(t,'')
    }catch(e){Toast.err('The browser did not allow clipboard access. Press '+MOD+'V instead.')}
  },
  init(){
    $('#fileInput').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';this.loadFile(f)});
    $('#recipeInput').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const t=await f.text();const p=W.textToSteps(t);if(!p.steps.length){Toast.err('No steps found in "'+f.name+'".');return}reviewRecipe(t,p)});
    $('#btnRead').addEventListener('click',()=>{const t=$('#pasteArea').value;this.loadText(t,'')});
    $('#btnOpen').addEventListener('click',()=>$('#fileInput').click());
    $('#pasteArea').addEventListener('keydown',e=>{if(e.key==='Enter'&&(isMac?e.metaKey:e.ctrlKey)){e.preventDefault();$('#btnRead').click()}});
    document.addEventListener('paste',e=>{
      const t=e.target;const inArea=t&&t.id==='pasteArea';
      if(isEditable(t)&&!inArea)return;
      if(S.loaded&&!inArea){
        const cd=e.clipboardData;if(!cd)return;const text=cd.getData('text/plain'),html=cd.getData('text/html');
        if(!text&&!html)return;
        e.preventDefault();
        Dialog.confirm('Replace the current data?','You pasted '+(html&&/<table/i.test(html)?'a web table':plural(text.split('\n').length,'line'))+'. Read it as new data? Your recipe ('+plural(S.steps.length,'step')+') will be re-applied.','Read pasted data').then(async ok=>{if(!ok)return;const steps=cleanSteps(S.steps);await this.loadText(text,'',html);if(steps.length)await applyRecipeText(W.stepsToText(steps,null),{name:'current recipe'})});
        return
      }
      const cd=e.clipboardData;if(!cd)return;
      const html=cd.getData('text/html'),text=cd.getData('text/plain');
      if(html&&/<table/i.test(html)){e.preventDefault();this.loadText(text,'',html);return}
      if(!inArea&&text){e.preventDefault();$('#pasteArea').value=text;this.loadText(text,'')}
      else if(inArea&&text&&!t.value.trim()){setTimeout(()=>{if(t.value.trim()===text.trim())this.loadText(t.value,'')},0)}
    });
    let depth=0;const ov=$('#dropOverlay');
    document.addEventListener('dragenter',e=>{if(!e.dataTransfer||Array.from(e.dataTransfer.types||[]).indexOf('Files')===-1)return;depth++;ov.classList.add('on');const it=e.dataTransfer.items&&e.dataTransfer.items[0];$('#dropName').textContent=''});
    document.addEventListener('dragleave',()=>{depth=Math.max(0,depth-1);if(!depth)ov.classList.remove('on')});
    document.addEventListener('dragover',e=>{if(e.dataTransfer&&Array.from(e.dataTransfer.types||[]).indexOf('Files')!==-1)e.preventDefault()});
    document.addEventListener('drop',async e=>{if(!e.dataTransfer||!e.dataTransfer.files.length)return;e.preventDefault();depth=0;ov.classList.remove('on');const f=e.dataTransfer.files[0];if(S.loaded&&!(await Dialog.confirm('Open "'+f.name+'"?','This replaces the current data. Your recipe ('+plural(S.steps.length,'step')+') will be re-applied.','Open file')))return;const steps=cleanSteps(S.steps);await this.loadFile(f);if(steps.length&&S.loaded&&!S.steps.length)await applyRecipeText(W.stepsToText(steps,null),{name:'current recipe'})})
  }
};
