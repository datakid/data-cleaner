(function(){
(window.WEFT_UI_MODULES=window.WEFT_UI_MODULES||[]).push(async function(T){
  const {ok,until,wait}=T;
  const dlg=()=>document.querySelector('.dialog');
  const shown=()=>{const c=dlg().querySelector('.dd-cur');return c?c.textContent.trim():''};
  const nameBox=()=>dlg().querySelector('input.input');
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
});
})();
