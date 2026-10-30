(function(){
(window.WEFT_UI_MODULES=window.WEFT_UI_MODULES||[]).push(async function(T){
  const {ok,until,wait}=T;
  const shown=()=>Grid.pool.filter(r=>r.el.isConnected&&r.el.style.display!=='none');
  const gridFilled=()=>{const rows=shown();return rows.length>5&&!Grid.body.querySelector('.gc.pending')&&rows.every(r=>r.cells.slice(1).some(c=>c.textContent.trim()!==''))};
  {
    await App.reset();
    const lines=['id,name'];for(let i=0;i<6000;i++)lines.push(i+',row'+i);
    await Input.loadText(lines.join('\n'),'');await until(()=>S.loaded&&Grid.pool.length>0);await wait(800);
    for(let i=0;i<12;i++)await Engine.call('setView',{stateIdx:S.viewIdx,sort:[],search:'row'+i,filter:null,rowIds:null});
    Grid.sc.scrollTop=5000*Grid.rowH;Grid.sc.dispatchEvent(new Event('scroll'));
    await until(()=>shown().some(r=>+r.el.dataset.pos>=4900),5000);
    const filled=await until(()=>shown().some(r=>+r.el.dataset.pos>=4900)&&gridFilled(),5000);
    const deep=shown().filter(r=>+r.el.dataset.pos>=4900).length;
    ok('B4 rows still fill after the view was evicted from the engine',filled&&deep>5,'filled '+filled+' deep rows '+deep+' pending '+Grid.body.querySelectorAll('.gc.pending').length+' top '+Grid.sc.scrollTop+' sh '+Grid.sc.scrollHeight+' ch '+Grid.sc.clientHeight+' rowH '+Grid.rowH+' n '+S.view.n)
  }
  {
    await App.reset();
    await Input.loadText('a,b\n1,2\n3,4','');await until(()=>S.loaded&&Grid.pool.length>0);
    ExportDialog.open();await wait(100);
    const sel=document.querySelector('.dialog select.select');
    const box=document.querySelector('.dialog input[data-opt="header"]');
    sel.value='md';sel.dispatchEvent(new Event('change',{bubbles:true}));await wait(50);
    const lab=box&&box.closest('label');
    ok('B7 the header option is switched on and disabled for Markdown',!!box&&box.disabled&&box.checked&&!!lab&&/header row/.test(lab.title),box&&(box.disabled+' '+box.checked+' '+(lab&&lab.title)));
    sel.value='csv';sel.dispatchEvent(new Event('change',{bubbles:true}));await wait(50);
    ok('B7 the header option works again for other formats',box&&!box.disabled&&box.checked&&!(lab&&lab.title));
    box.click();await wait(20);sel.value='md';sel.dispatchEvent(new Event('change',{bubbles:true}));await wait(50);
    let sent=null;const call=Engine.call;
    Engine.call=function(t,p){if(t==='export')sent=p;return call.apply(this,arguments)};
    try{
      const copy=Array.from(document.querySelectorAll('.dialog button')).find(b=>b.textContent==='Copy');
      if(copy)copy.click();await wait(300)
    }finally{Engine.call=call;while(Layers.closeTop());}
    ok('B7 Markdown export always asks for a header even when the box was cleared before',!!sent&&sent.format==='md'&&sent.options.header===true,JSON.stringify(sent&&sent.options))
  }
});
})();
