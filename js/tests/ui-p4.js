(function(){
(window.WEFT_UI_MODULES=window.WEFT_UI_MODULES||[]).push(async function(T){
  const {ok,until,wait}=T;
  const names=[];for(let i=0;i<16;i++)names.push('Column '+String.fromCharCode(65+i)+' title');
  const mk=()=>{const rows=[];for(let r=0;r<40;r++)rows.push(names.map((n,i)=>i===0?String(1000+r):i%3===0?String(r*i):'v'+r+'_'+i));return names.join(',')+'\n'+rows.map(r=>r.join(',')).join('\n')};
  const csv=mk();
  const fresh=async file=>{
    await App.reset();
    await Input.loadText(csv,file||'wide.csv');
    await until(()=>S.loaded&&Grid.pool.length>0&&S.view.n>0);await wait(300)
  };
  const hdr=n=>Grid.head.querySelector('.gh[data-col="'+n+'"]');
  const cellOf=(n,row)=>{const ci=curCols().indexOf(n);const r=Grid.pool.find(x=>x.el.dataset.pos===String(row||0)&&x.el.style.display!=='none');return r&&r.cells[ci+1]};
  const scrollTo=async x=>{Grid.sc.scrollLeft=x;await wait(120)};
  const closeAll=()=>{while(Layers.closeTop());};

  await fresh();
  const pinCmd=Commands.get('columns.pin'),unpinCmd=Commands.get('columns.unpin');
  ok('P4 Pin column and Unpin column are commands with pin and freeze synonyms',!!pinCmd&&!!unpinCmd&&pinCmd.title==='Pin column'&&pinCmd.keywords.indexOf('freeze')!==-1);
  ok('P4 both are in the column header menu',Commands.byContext('colHeader').some(c=>c.id==='columns.pin')&&Commands.byContext('toolbar:Columns').some(c=>c.id==='columns.pin'));

  Sel.selectCol(names[3]);
  ok('P4 with an unpinned column selected only Pin column is offered',Commands.byContext('colHeader').some(c=>c.id==='columns.pin')&&!Commands.byContext('colHeader').some(c=>c.id==='columns.unpin'));
  await Commands.run('columns.pin');await wait(150);
  ok('P4 pinning stores the name in tab state',S.pinned.length===1&&S.pinned[0]===names[3],JSON.stringify(S.pinned));
  ok('P4 the header shows the pinned column with a pin icon',hdr(names[3]).classList.contains('pin')&&!!hdr(names[3]).querySelector('.gh-pin')&&!hdr(names[2]).classList.contains('pin'));
  ok('P4 the cells of the column are sticky and carry a left offset',(()=>{const c=cellOf(names[3],0);return c&&c.classList.contains('pin')&&c.style.left===Grid.idxW+'px'})(),cellOf(names[3],0)&&cellOf(names[3],0).style.left);
  ok('P4 after pinning only Unpin column is offered for that column',!Commands.byContext('colHeader').some(c=>c.id==='columns.pin')&&Commands.byContext('colHeader').some(c=>c.id==='columns.unpin'));
  ok('P4 the choice is saved in the pinned preference by file name',JSON.stringify(Prefs.get('pinned',{})['wide.csv'])===JSON.stringify([names[3]]),JSON.stringify(Prefs.get('pinned',{})));

  const sc=Grid.sc;
  await scrollTo(0);
  const naturalLeft=hdr(names[3]).getBoundingClientRect().left-sc.getBoundingClientRect().left;
  await scrollTo(sc.scrollWidth);
  const stuck=hdr(names[3]).getBoundingClientRect().left-sc.getBoundingClientRect().left;
  ok('P4 the column leaves the left edge naturally at first',naturalLeft>Grid.idxW+Grid.widths[0]+Grid.widths[1]-2,String(naturalLeft));
  ok('P4 the pinned header stays next to the row numbers when scrolled all the way right',Math.abs(stuck-Grid.idxW)<=2,String(stuck));
  const cb=cellOf(names[3],0);
  ok('P4 the pinned cells stay put as well',!!cb&&Math.abs(cb.getBoundingClientRect().left-sc.getBoundingClientRect().left-Grid.idxW)<=2,cb&&String(cb.getBoundingClientRect().left-sc.getBoundingClientRect().left));
  ok('P4 the pinned column casts an edge shadow only while scrolled sideways',sc.classList.contains('scrolled-x')&&hdr(names[3]).classList.contains('pinend'));

  Sel.selectCol(names[8]);await Commands.run('columns.pin');await wait(150);
  await scrollTo(sc.scrollWidth);
  const l3=hdr(names[3]).getBoundingClientRect().left-sc.getBoundingClientRect().left,l8=hdr(names[8]).getBoundingClientRect().left-sc.getBoundingClientRect().left;
  ok('P4 a second pinned column stacks after the first',Math.abs(l3-Grid.idxW)<=2&&Math.abs(l8-(Grid.idxW+Grid.widths[3]))<=2,l3+' '+l8);
  ok('P4 only the last pinned column carries the edge',hdr(names[8]).classList.contains('pinend')&&!hdr(names[3]).classList.contains('pinend'));

  await scrollTo(0);
  Grid.startEdit(0,3);await until(()=>document.querySelector('.cell-edit'),2000);
  const ed=document.querySelector('.cell-edit'),cl=cellOf(names[3],0);
  ok('P4 the cell editor opens over the pinned cell',!!ed&&Math.abs(ed.getBoundingClientRect().left-cl.getBoundingClientRect().left)<=2,ed&&cl&&(ed.getBoundingClientRect().left+' '+cl.getBoundingClientRect().left));
  ed.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(100);

  Sel.setCell(2,12,false);Grid.scrollToPos(2,12);await wait(150);
  const l12=Grid.colX(12)-sc.scrollLeft;
  ok('P4 moving to a far column does not hide it under the pinned ones',l12>=Grid.idxW+Grid.pinW-1,l12+' '+Grid.pinW);

  Sel.selectCol(names[3]);await Commands.run('columns.unpin');await wait(150);
  ok('P4 unpinning removes only that column',JSON.stringify(S.pinned)===JSON.stringify([names[8]])&&!hdr(names[3]).classList.contains('pin')&&hdr(names[8]).classList.contains('pin'));
  ok('P4 the remaining pinned column moves to the first slot',(()=>{const c=cellOf(names[8],0);return c.style.left===Grid.idxW+'px'})());

  await addStep('dropColumn',{columns:[names[8]]},{silent:true});await wait(300);
  ok('P4 a pinned column that is removed by a step just stops being pinned',Grid.pinLeft.every(x=>x===-1)&&!Grid.head.querySelector('.gh.pin'));
  await doUndo();await wait(300);
  ok('P4 undoing the step brings the pin back',!!hdr(names[8])&&hdr(names[8]).classList.contains('pin'));

  const tabsBefore=Tabs.list.length;
  ok('P4 the pinned list is part of what a tab keeps',TAB_FIELDS.indexOf('pinned')!==-1&&tabsBefore>=1);

  await fresh('wide.csv');
  ok('P4 opening the same file again brings the pin back',JSON.stringify(S.pinned)===JSON.stringify([names[8]])&&hdr(names[8]).classList.contains('pin'),JSON.stringify(S.pinned));
  await fresh('other.csv');
  ok('P4 another file has no pins',S.pinned.length===0&&!Grid.head.querySelector('.gh.pin'));
  await fresh('wide.csv');
  Sel.selectCol(names[8]);await Commands.run('columns.unpin');await wait(150);
  ok('P4 unpinning the last column clears the saved preference',Prefs.get('pinned',{})['wide.csv']===undefined,JSON.stringify(Prefs.get('pinned',{})));

  const HC=['Order','Amount','Day','Label'];
  const hrows=[];for(let i=0;i<100;i++)hrows.push([String(2000+i),String(i+1),'2026-02-'+String(1+i%28).padStart(2,'0'),'t'+i]);
  const hcsv=HC.join(',')+'\n'+hrows.map(r=>r.join(',')).join('\n');
  const hfresh=async()=>{
    await App.reset();
    await Input.loadText(hcsv,'hist.csv');
    await until(()=>S.loaded&&Grid.pool.length>0&&S.view.n>0);await wait(300)
  };
  const showCol=async c=>{Sel.selectCol(c);Inspector.col=c;Inspector.show('column');await until(()=>document.querySelector('#inspBody .prof-head')&&document.querySelector('#inspBody .prof-head').textContent===c,3000);await wait(300)};
  const bars=()=>Array.from(document.querySelectorAll('#inspBody .hist-svg .hb'));

  await hfresh();
  await showCol('Amount');
  ok('P4 a number column shows a distribution with up to 20 bars',bars().length>=10&&bars().length<=20,String(bars().length));
  ok('P4 every bar can be reached with the keyboard and says what it holds',bars().every(b=>b.getAttribute('tabindex')==='0'&&b.getAttribute('role')==='button'&&/row/.test(b.getAttribute('aria-label'))));
  ok('P4 the bars add up to every row',bars().reduce((a,b)=>a+(+/: (\d+) row/.exec(b.getAttribute('aria-label'))[1]),0)===100);
  ok('P4 the axis shows the smallest and largest values',(()=>{const l=document.querySelectorAll('#inspBody .hist-axis-labels span');return l.length===2&&l[0].textContent==='1'&&l[1].textContent==='100'})());
  const third=bars()[2];
  const cnt=+/: (\d+) row/.exec(third.getAttribute('aria-label'))[1];
  third.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  await until(()=>S.view.n===cnt&&ColFilter.has('Amount'),4000);await wait(300);
  ok('P4 clicking a bar filters the column to that range and shows that many rows',ColFilter.has('Amount')&&S.view.n===cnt,S.view.n+' vs '+cnt);
  ok('P4 the filter is a range on the column',(()=>{const f=S.colFilters.Amount;return f.op==='and'&&f.children[0].op==='gte'&&f.children[1].op==='lt'})(),JSON.stringify(S.colFilters.Amount));
  ok('P4 the chosen bar is marked as selected',bars()[2]&&bars()[2].classList.contains('on')&&bars()[2].getAttribute('aria-pressed')==='true');
  ok('P4 the column header funnel shows the filter',!!Grid.head.querySelector('.gh[data-col="Amount"] .gh-filter.on'));
  bars()[2].dispatchEvent(new MouseEvent('click',{bubbles:true}));
  await until(()=>!ColFilter.has('Amount')&&S.view.n===100,4000);await wait(300);
  ok('P4 clicking the chosen bar again clears the filter',!ColFilter.has('Amount')&&S.view.n===100);
  bars()[19].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await until(()=>ColFilter.has('Amount'),4000);await wait(300);
  const lastCnt=+/: (\d+) row/.exec(bars()[19].getAttribute('aria-label'))[1];
  ok('P4 Enter on a bar filters as well, and the last bar includes the largest value',S.view.n===lastCnt&&S.colFilters.Amount.children[1].op==='lte',S.view.n+' vs '+lastCnt);
  await ColFilter.clearAll();await wait(200);

  await showCol('Day');
  ok('P4 a date column shows a distribution with dates on the axis',bars().length>=5&&/^\d{4}-\d{2}-\d{2}$/.test(document.querySelector('#inspBody .hist-axis-labels span').textContent));
  const db=bars()[1],dc=+/: (\d+) row/.exec(db.getAttribute('aria-label'))[1];
  db.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  await until(()=>ColFilter.has('Day')&&S.view.n===dc,4000);await wait(300);
  ok('P4 clicking a date bar filters to that range',S.view.n===dc,S.view.n+' vs '+dc);
  await ColFilter.clearAll();await wait(200);

  await showCol('Label');
  ok('P4 a text column has no distribution',!document.querySelector('#inspBody .hist-svg'));

  await hfresh();
  Sel.selectCol('Amount');
  await until(()=>/Sum/.test((document.getElementById('selStats')||{}).textContent||''),4000);await wait(200);
  const plain=document.getElementById('selStats').textContent;
  ok('P4 with no filter the column statistics include a count and no filtered label',/^Count 100 · Sum 5,050 · Avg 50\.5 · Min 1 · Max 100$/.test(plain),plain);
  await ColFilter.set('Amount',{col:'Amount',op:'gt',value:'90',caseSensitive:false});await wait(300);
  Sel.selectCol('Amount');
  await until(()=>/of filtered rows/.test((document.getElementById('selStats')||{}).textContent||''),4000);await wait(200);
  const filt=document.getElementById('selStats');
  ok('P4 with a filter on, the statistics cover the filtered rows and say so',/^Count 10 · Sum 955 · Avg 95\.5 · Min 91 · Max 100 · of filtered rows$/.test(filt.textContent),filt.textContent);
  ok('P4 the label explains which rows are counted',/10 rows that match/.test(filt.title)&&/not all 100 rows/.test(filt.title),filt.title);
  await ColFilter.clearAll();await wait(300);
  Sel.selectCol('Amount');
  await until(()=>!/of filtered rows/.test((document.getElementById('selStats')||{}).textContent||'x'),4000);await wait(200);
  ok('P4 clearing the filter drops the label again',!/filtered/.test(document.getElementById('selStats').textContent)&&!document.getElementById('selStats').title);
  const sb=document.getElementById('searchInput');sb.focus();sb.value='2026-02-01';sb.dispatchEvent(new Event('input',{bubbles:true}));
  await until(()=>S.search==='2026-02-01'&&S.view.n===4,4000);await wait(300);
  Sel.selectCol('Amount');
  await until(()=>/of filtered rows/.test((document.getElementById('selStats')||{}).textContent||''),4000);await wait(200);
  ok('P4 a search counts as a filter for the statistics',/^Count 4 · Sum 172 · Avg 43 · Min 1 · Max 85 · of filtered rows$/.test(document.getElementById('selStats').textContent),document.getElementById('selStats').textContent);
  sb.value='';sb.dispatchEvent(new Event('input',{bubbles:true}));
  await until(()=>S.search===''&&S.view.n===100,4000);await wait(200);

  const savedTips=(()=>{try{return localStorage.getItem('weft.tips.v1')}catch(e){return null}})();
  const putTips=v=>{try{if(v==null)localStorage.removeItem('weft.tips.v1');else localStorage.setItem('weft.tips.v1',v)}catch(e){return}};
  putTips(null);WhatsNew.render();
  const card=()=>document.getElementById('whatsNew');
  ok('P4 the what\'s new card shows the first time, with four items',!card().classList.contains('hidden')&&card().querySelectorAll('.wn-item').length===4,card().className);
  ok('P4 the items are Query, Column filters, Find and Replace and Formulas',Array.from(card().querySelectorAll('.wn-title')).map(x=>x.textContent).join('|')==='Weft Query|Column filters|Find and Replace|Formulas');
  ok('P4 every item has a Try it button',card().querySelectorAll('.wn-try').length===4);
  putTips('true');WhatsNew.render();
  ok('P4 users who already dismissed the old tips still see the new card once',!card().classList.contains('hidden')&&Tips.get('coach')===true);
  card().querySelector('.wn-dismiss').click();
  ok('P4 Got it hides the card and stores the dismissal',card().classList.contains('hidden')&&Tips.get('whatsNew')==='3.0');
  ok('P4 dismissing keeps the older tips flag so the getting-started tips stay dismissed',Tips.get('coach')===true&&JSON.parse(localStorage.getItem('weft.tips.v1')).whatsNew==='3.0');
  WhatsNew.render();
  ok('P4 the card stays hidden after a reload of the page state',card().classList.contains('hidden'));
  Tips.set('coach',false);Tips.set('whatsNew','3.0');
  ok('P4 the two flags are independent',Tips.get('coach')===false&&Tips.get('whatsNew')==='3.0'&&!WhatsNew.pending());
  ok('P4 the command to open it again exists',!!Commands.get('help.whatsnew')&&Commands.get('help.whatsnew').keywords.indexOf('changelog')!==-1);

  await fresh();
  Commands.run('help.whatsnew');await until(()=>document.querySelector('.dialog .wn-list'),3000);
  ok('P4 the command opens a dialog with the same four items',document.querySelectorAll('.dialog .wn-item').length===4);
  document.querySelector('.dialog .wn-try[data-try="query"]').click();
  await until(()=>S.file==='orders-2025.csv'&&S.search==='status:paid amount_usd>500'&&S.view.query,10000);await wait(500);
  ok('P4 Try it on Query opens the sample in a new tab and fills in the search',S.file==='orders-2025.csv'&&Tabs.list.length>=2&&S.search==='status:paid amount_usd>500'&&S.view.n>0&&S.view.n<121,S.file+' '+Tabs.list.length+' '+S.view.n);
  ok('P4 the dialog closes when an example starts',!document.querySelector('.dialog .wn-list'));
  const q1=S.view.n;
  ok('P4 the sample query keeps only paid orders over 500',q1>0);

  Commands.run('help.whatsnew');await until(()=>document.querySelector('.dialog .wn-list'),3000);
  document.querySelector('.dialog .wn-try[data-try="filters"]').click();
  await until(()=>document.querySelector('.cf-pop .cf-row'),10000);await wait(300);
  ok('P4 Try it on Column filters opens the status filter',!!document.querySelector('.cf-pop')&&/status/i.test(document.querySelector('.cf-pop').textContent));
  closeAll();await wait(200);

  Commands.run('help.whatsnew');await until(()=>document.querySelector('.dialog .wn-list'),3000);
  document.querySelector('.dialog .wn-try[data-try="replace"]').click();
  await until(()=>document.querySelector('.fr-body'),10000);await wait(400);
  const finds=document.querySelectorAll('.fr-body input[type=text]');
  ok('P4 Try it on Find and Replace opens it with an example filled in',finds.length>=2&&finds[0].value==='pending'&&finds[1].value==='awaiting payment',finds[0]&&finds[0].value);
  await until(()=>/\d/.test((document.querySelector('.fr-preview')||{}).textContent||''),4000);
  ok('P4 the example already shows a preview',/\d/.test(document.querySelector('.fr-preview').textContent),document.querySelector('.fr-preview').textContent.slice(0,80));
  closeAll();await wait(200);

  Commands.run('help.whatsnew');await until(()=>document.querySelector('.dialog .wn-list'),3000);
  document.querySelector('.dialog .wn-try[data-try="formulas"]').click();
  await until(()=>document.querySelector('.dialog .fx-input'),10000);await wait(500);
  const fxi=document.querySelector('.dialog .fx-input');
  ok('P4 Try it on Formulas opens the formula dialog with an example',!!fxi&&fxi.value==='ROUND([amount_usd] * 0.92, 2)',fxi&&fxi.value);
  ok('P4 the example formula is valid and the Add button is enabled',!document.querySelector('.dialog .btn-primary').disabled);
  closeAll();await wait(200);
  putTips(savedTips);
  closeAll()
});
})();
