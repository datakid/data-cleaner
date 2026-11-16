(function(){
(window.WEFT_UI_MODULES=window.WEFT_UI_MODULES||[]).push(async function(T){
  const {ok,until,wait}=T;
  const dlg=()=>document.querySelector('.dialog');
  const shown=()=>{const c=dlg().querySelector('.dd-cur');return c?c.textContent.trim():''};
  const nameBox=()=>dlg().querySelector('input.input');
  const typeName=v=>{const n=nameBox();n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}))};
  const pick=async label=>{dlg().querySelector('.dd-trigger').click();await wait(80);const it=Array.from(document.querySelectorAll('.dd-opt')).find(b=>b.textContent.trim().indexOf(label)===0);if(it)it.click();await wait(80)};
  const press=async text=>{const b=Array.from(dlg().querySelectorAll('button')).find(x=>x.textContent.trim()===text);if(b)b.click();await wait(700)};
  const closeAll=()=>{while(Layers.closeTop());};
  const load=async text=>{await App.reset();await Input.loadText(text,'');await until(()=>S.loaded&&Grid.pool.length>0)};
  const capture=()=>{
    const cap={wrote:[],text:[]};const w0=Xlsx.write,d0=window.downloadText;
    Xlsx.write=async(r,fn)=>{cap.wrote.push(fn)};window.downloadText=(n,t)=>{cap.text.push(n)};
    cap.restore=()=>{Xlsx.write=w0;window.downloadText=d0};
    return cap
  };
  const boxEl=document.createElement('div');document.body.appendChild(boxEl);
  const openForm=async(id,cfg,cols,types)=>{const f=StepForm(id,cfg,{cols,types,onChange:()=>{}});boxEl.appendChild(f.el);await wait(60);return f};
  const shownOf=s=>{const o=s.options[s.selectedIndex];return o?o.value:null};
  const choose=async(s,label)=>{s.parentNode.querySelector('.dd-trigger').click();await wait(80);const it=Array.from(document.querySelectorAll('.dd-opt')).find(b=>b.textContent.trim().indexOf(label)===0);if(it)it.click();await wait(80)};
  const CSV='id,zip,when,amt\n1,02134,2024-01-05,10.5\n2,90210,2024-02-10,20\n3,00501,2024-03-15,7';
  {
    await load(CSV);
    ExportDialog.open();await wait(150);
    ok('B1 the Export dialog opens showing the format it will really use',/^CSV/.test(shown()),shown());
    ok('B1 the file name extension matches the format shown when the dialog opens',/\.csv$/.test(nameBox().value),nameBox().value);
    closeAll();
    let cap=capture(),fmtShown='',nameShown='';
    try{
      ExportDialog.open();await wait(150);
      await pick('Excel');
      fmtShown=shown();nameShown=nameBox().value;
      await press('Download')
    }finally{cap.restore();closeAll()}
    ok('B1 choosing Excel shows Excel and renames the file to .xlsx',/^Excel/.test(fmtShown)&&/\.xlsx$/.test(nameShown),fmtShown+' | '+nameShown);
    ok('B1 choosing Excel and pressing Download writes a workbook, not a CSV',cap.wrote.length===1&&cap.text.length===0,'workbooks '+cap.wrote.length+' text files '+cap.text.length);
    ok('B1 the workbook file name ends in .xlsx',/\.xlsx$/i.test(cap.wrote[0]||''),String(cap.wrote[0]));
    cap=capture();
    try{
      ExportDialog.open();await wait(150);
      await press('Download')
    }finally{cap.restore();closeAll()}
    ok('B1 pressing Download without touching the format still writes a CSV',cap.text.length===1&&cap.wrote.length===0&&/\.csv$/.test(cap.text[0]||''),cap.text.join(',')+' '+cap.wrote.join(','))
  }
  {
    await load(CSV);
    const names=[];
    try{
      ExportDialog.open();await wait(150);
      typeName('report.csv');
      for(const l of ['TSV','JSON records','Excel','Markdown','Plain lines','CSV']){await pick(l);names.push(nameBox().value)}
    }finally{closeAll()}
    ok('B1a a typed file name follows the format through every switch',names.join('|')==='report.tsv|report.json|report.xlsx|report.md|report.txt|report.csv',names.join('|'));
    const cap=capture();let kept=[];
    try{
      ExportDialog.open();await wait(150);
      typeName('my export');
      await pick('TSV');kept.push(nameBox().value);
      await pick('Excel');kept.push(nameBox().value);
      await press('Download')
    }finally{cap.restore();closeAll()}
    ok('B1a a typed name without a known extension is left alone when the format changes',kept.join('|')==='my export|my export',kept.join('|'));
    ok('B1a an Excel download always ends in .xlsx',cap.wrote.length===1&&cap.wrote[0]==='my export.xlsx',String(cap.wrote[0]));
    const cap2=capture();
    try{
      ExportDialog.open();await wait(150);
      typeName('plain');
      await press('Download')
    }finally{cap2.restore();closeAll()}
    ok('B1a a CSV download keeps the typed name as it was',cap2.text.length===1&&cap2.text[0]==='plain',cap2.text.join(','))
  }
  {
    await load('Sales\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\nReturns\n| x | y |\n|---|---|\n| 5 | 6 |\n| 7 | 8 |');
    await until(()=>Tabs.list.length===2);
    const calls=[],errs=[];const c0=Engine.call,wb0=Xlsx.writeBook,te0=Toast.err;let fail=false;
    Engine.call=function(t,p,c){if(t==='exportTable'){calls.push(p);if(fail)return Promise.reject(new Error('boom'))}return c0.apply(this,arguments)};
    Xlsx.writeBook=async()=>{};
    Toast.err=function(m){errs.push(String(m));return te0.apply(this,arguments)};
    const everyTable=()=>Array.from(dlg().querySelectorAll('label.check')).find(l=>/every open table/.test(l.textContent)).querySelector('input');
    try{
      ExportDialog.open();await wait(150);
      await pick('Excel');
      everyTable().click();
      dlg().querySelector('input[data-opt="header"]').click();
      await press('Download');
      ok('B1b exporting every open table follows the header checkbox',calls.length===2&&calls.every(p=>p.options&&p.options.header===false),JSON.stringify(calls.map(p=>p.options)));
      calls.length=0;
      ExportDialog.open();await wait(150);
      await pick('Excel');
      everyTable().click();
      await press('Download');
      ok('B1b exporting every open table keeps the header when the box stays ticked',calls.length===2&&calls.every(p=>p.options&&p.options.header===true),JSON.stringify(calls.map(p=>p.options)));
      fail=true;errs.length=0;
      ExportDialog.open();await wait(150);
      await pick('Excel');
      everyTable().click();
      await press('Download');
      ok('B1b a failing every-open-table export tells the user why',errs.some(m=>/Could not build the workbook: boom/.test(m)),errs.join(' | '))
    }finally{Engine.call=c0;Xlsx.writeBook=wb0;Toast.err=te0;closeAll()}
  }
  {
    await load(CSV);
    const r=await Engine.call('export',{scope:'final',viewKey:S.view.key,selection:Sel.payload(),columns:null,format:'xlsx',options:{header:true}});
    const X=await Xlsx.load();const ws=Xlsx.sheet(X,r);
    ok('B1 an exported sheet keeps numbers as numbers',ws.D2&&ws.D2.t==='n'&&ws.D2.v===10.5&&ws.A2.t==='n',JSON.stringify([ws.A2,ws.D2]));
    ok('B1 an exported sheet keeps ISO dates as dates',ws.C2&&ws.C2.t==='n'&&ws.C2.z==='yyyy-mm-dd',JSON.stringify(ws.C2));
    ok('B1 an exported sheet keeps leading zero values as text',ws.B2&&ws.B2.t==='s'&&ws.B2.v==='02134'&&ws.B4.v==='00501',JSON.stringify([ws.B2,ws.B4]));
    ok('B1 an exported sheet turns the header filter on',!!ws['!autofilter'],JSON.stringify(ws['!autofilter']));
    const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'Weft');
    const u=new Uint8Array(X.write(wb,{type:'array',bookType:'xlsx',compression:true}));
    ok('B1 the written workbook is a real xlsx file',u[0]===0x50&&u[1]===0x4B,u[0]+' '+u[1]);
    const back=X.read(u,{type:'array',cellDates:false});const bs=back.Sheets[back.SheetNames[0]];
    ok('B1 the workbook reads back with the same values',bs.B2.v==='02134'&&bs.D2.v===10.5&&bs.A4.v===3,JSON.stringify([bs.B2&&bs.B2.v,bs.D2&&bs.D2.v,bs.A4&&bs.A4.v]))
  }
  {
    const f=await openForm('filterRows',{mode:'remove',match:'all',conditions:[{col:'ghost',op:'isEmpty',value:'',caseSensitive:false}]},['id','name'],['number','text']);
    const sel=f.el.querySelector('select[aria-label="Column"]');
    ok('B2 a filter condition on a missing column shows that column and not Any column',shownOf(sel)==='ghost',String(shownOf(sel)));
    await choose(sel,'Any column');
    ok('B2 choosing Any column for a condition on a missing column takes effect',f.cfg.conditions[0].col==='*',String(f.cfg.conditions[0].col));
    closeAll();boxEl.removeChild(f.el)
  }
  {
    const f=await openForm('sortRows',{keys:[{col:'ghost',dir:'asc',type:'auto'}]},['id','name'],['number','text']);
    const sel=f.el.querySelector('select[aria-label="Column"]');
    ok('B2 a sort key on a missing column shows that column and not the first column',shownOf(sel)==='ghost',String(shownOf(sel)));
    await choose(sel,'id');
    ok('B2 choosing the first column for a sort key on a missing column takes effect',f.cfg.keys[0].col==='id',String(f.cfg.keys[0].col));
    closeAll();boxEl.removeChild(f.el)
  }
  {
    const f=await openForm('aggregate',{groupBy:['name'],metrics:['ghost:sum']},['id','name','amount'],['number','text','number']);
    const sel=f.el.querySelector('[data-key="metrics"] select[aria-label="Column"]');
    ok('B2 a calculation on a missing column shows that column and not the first column',shownOf(sel)==='ghost',String(shownOf(sel)));
    await choose(sel,'id');
    ok('B2 choosing the first column for a calculation on a missing column takes effect',f.cfg.metrics[0]==='id:sum',String(f.cfg.metrics[0]));
    closeAll();boxEl.removeChild(f.el)
  }
  {
    await load(CSV);
    await Engine.call('refLoad',{text:'id,city\n1,Cairo\n2,Giza',name:'cities',replace:true});
    S.refs=(await Engine.call('refList',{})).refs;
    const f=await openForm('join',{refName:'regions',type:'left',onLeft:['id'],onRight:[],columns:[],normTrim:true,normCaseFold:false,normNumeric:false,onDuplicate:'first'},['id','name'],['number','text']);
    const sel=f.el.querySelector('[data-key="refName"] select');
    ok('B2 a join on a reference file that is not loaded shows that name and not another file',shownOf(sel)==='regions',String(shownOf(sel)));
    await choose(sel,'cities');
    ok('B2 choosing the only loaded reference file for a join on a missing one takes effect',f.cfg.refName==='cities',String(f.cfg.refName));
    closeAll();boxEl.removeChild(f.el);
    await App.reset()
  }
  {
    const sheetOf=async(text,pickIds)=>{
      await load(text);
      const g=await Engine.call('getRows',{viewKey:S.view.key,start:0,count:50});
      const sel=pickIds?{kind:'rows',rows:{all:false,ids:pickIds.map(i=>g.rowIds[i]),except:[]},cols:[],rect:null}:Sel.payload();
      const r=await Engine.call('export',{scope:pickIds?'selected':'final',viewKey:S.view.key,selection:sel,columns:null,format:'xlsx',options:{header:true}});
      return Xlsx.sheet(await Xlsx.load(),r)
    };
    const nums='id,amount\n1,10\n2,20\n3,30\n4,ITEM\n5,50\n6,60\n7,70\n8,80\n9,90\n10,100';
    let ws=await sheetOf(nums.replace('ITEM','none'));
    ok('B7 one word with an e in a number column does not turn off number conversion',ws.B2.t==='n'&&ws.B2.v===10&&ws.B11.v===100,JSON.stringify([ws.B2,ws.B11]));
    ok('B7 the word itself stays as text',ws.B5.t==='s'&&ws.B5.v==='none',JSON.stringify(ws.B5));
    ws=await sheetOf(nums.replace('ITEM','n/a'));
    ok('B7 n/a in a number column leaves the other cells as numbers',ws.B2.t==='n'&&ws.B5.t==='s',JSON.stringify([ws.B2,ws.B5]));
    ws=await sheetOf(nums.replace('ITEM','1e5'));
    ok('B7 scientific notation in a number column still keeps the column as text',ws.B2.t==='s'&&ws.B5.v==='1e5',JSON.stringify([ws.B2,ws.B5]));
    ws=await sheetOf(nums.replace('ITEM','2.5E-3'));
    ok('B7 scientific notation with a sign and capital E is recognised',ws.B2.t==='s',JSON.stringify(ws.B2));
    ws=await sheetOf('id,amount\n1,10\n2,20\n3,30\n4,12345678901234567890\n5,50');
    ok('B7 a value with more than 15 digits still keeps the column as text',ws.B2.t==='s'&&ws.B5.v==='12345678901234567890',JSON.stringify([ws.B2,ws.B5]))
  }
  {
    const sheetOf=async(text,pickIds)=>{
      await load(text);
      const g=await Engine.call('getRows',{viewKey:S.view.key,start:0,count:50});
      const sel={kind:'rows',rows:{all:false,ids:pickIds.map(i=>g.rowIds[i]),except:[]},cols:[],rect:null};
      const r=await Engine.call('export',{scope:'selected',viewKey:S.view.key,selection:sel,columns:null,format:'xlsx',options:{header:true}});
      return Xlsx.sheet(await Xlsx.load(),r)
    };
    const ws=await sheetOf('item;amount\nA;1.234,56\nB;2.000,00\nC;-3,5\nD;12',[1,2]);
    ok('B6 European numbers exported from selected rows keep their values',ws.B2.t==='n'&&ws.B2.v===2000&&ws.B3.t==='n'&&ws.B3.v===-3.5,JSON.stringify([ws.B2,ws.B3]))
  }
});
})();
