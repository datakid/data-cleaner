(function(){
(window.WEFT_UI_MODULES=window.WEFT_UI_MODULES||[]).push(async function(T){
  const {ok,until,wait}=T;
  const REG=['EMEA','APAC','AMER','EMEA'],STA=['paid','pending','refunded'];
  const rows=[];
  for(let i=0;i<60;i++){
    const d=new Date(Date.UTC(2026,0,1+i));
    rows.push({status:STA[i%3],region:REG[i%4],amount:10+i*5,date:d.toISOString().slice(0,10),id:1000+i,notes:i%10===0?'new york order':'standard'})
  }
  const csv='Status,Amount,Region,Date,Order ID,Notes\n'+rows.map(r=>[r.status,r.amount,r.region,r.date,r.id,r.notes].join(',')).join('\n');
  const count=f=>rows.filter(f).length;
  const shown=()=>Grid.pool.filter(r=>r.el.isConnected&&r.el.style.display!=='none');
  const settled=()=>S.view&&S.view.key&&!Grid.body.querySelector('.gc.pending')&&shown().length>0;
  const si=()=>document.getElementById('searchInput');
  const toasts=()=>document.querySelectorAll('#toastRoot .toast.err').length;
  const typeQ=async q=>{
    const el=si();el.focus();el.value=q;el.dispatchEvent(new Event('input',{bubbles:true}));
    await until(()=>S.search===q&&S.view.query&&S.view.query.src===q,4000);await wait(120)
  };
  const markCols=()=>{const set=new Set();Grid.body.querySelectorAll('mark.hit').forEach(m=>{const c=m.closest('.gc');if(c)set.add(curCols()[+c.dataset.ci])});return Array.from(set).sort()};
  const fresh=async(text,name)=>{
    await App.reset();
    await Input.loadText(text||csv,name||'orders.csv');
    await until(()=>S.loaded&&Grid.pool.length>0&&S.view.n>0);await wait(300);
    await Engine.call('setCtx',{today:null});
    ColFilter.applyFunnels()
  };
  const keyOn=(el,key,opts)=>el.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key,bubbles:true,cancelable:true},opts||{})));
  const pop=()=>document.querySelector('.cf-pop');
  const funnel=col=>Array.from(Grid.head.querySelectorAll('.gh[data-col]')).find(g=>g.dataset.col===col).querySelector('.gh-filter');
  const closeAll=()=>{while(Layers.closeTop());};
  const rowLabels=()=>Array.from(document.querySelectorAll('.cf-pop .cf-row:not(.cf-all)')).map(r=>({v:r.querySelector('.cf-val').textContent,n:+r.querySelector('.cf-n').textContent.replace(/,/g,''),box:r.querySelector('input')}));
  const clickApply=async()=>{pop().querySelector('[data-act="apply"]').click();await until(()=>!pop(),2000);await wait(200)};

  await fresh();
  ok('P2 sample loads 60 rows with 6 columns',S.view.total===60&&curCols().length===6,S.view.total+' '+curCols().length);

  await typeQ('status:=paid');
  ok('P2 query status:=paid keeps the paid rows',S.view.n===count(r=>r.status==='paid'),S.view.n+' vs '+count(r=>r.status==='paid'));
  await until(settled,3000);
  ok('P2 fielded query highlights only its column',markCols().join()==='Status',markCols().join());
  ok('P2 the column part of a fielded token is underlined in the search box',!!si().parentNode.querySelector('.sb-mirror .qt-col'));

  await typeQ('amount>100');
  ok('P2 query amount>100',S.view.n===count(r=>r.amount>100),S.view.n+' vs '+count(r=>r.amount>100));
  await typeQ('"new york"');
  await until(settled,3000);
  ok('P2 phrase query "new york"',S.view.n===count(r=>r.notes==='new york order')&&markCols().join()==='Notes',S.view.n+' '+markCols().join());
  await typeQ('-status:paid');
  ok('P2 negated query -status:paid',S.view.n===count(r=>r.status!=='paid'),S.view.n);
  await typeQ('(region:emea OR region:apac)');
  ok('P2 grouped OR query',S.view.n===count(r=>r.region==='EMEA'||r.region==='APAC'),S.view.n);
  await typeQ('status:paid amount>=100');
  ok('P2 two fielded terms are ANDed',S.view.n===count(r=>r.status==='paid'&&r.amount>=100),S.view.n);
  await typeQ('date:2026-01-01..2026-01-31');
  ok('P2 date range query',S.view.n===31,S.view.n);
  await typeQ('region:(emea|apac)');
  ok('P2 one-of query',S.view.n===count(r=>r.region!=='AMER'),S.view.n);
  await typeQ('standard');
  await until(settled,3000);
  ok('P2 free text still works and highlights where it matches',S.view.n===count(r=>r.notes==='standard')&&markCols().join()==='Notes',S.view.n+' '+markCols().join());
  await typeQ('10:30');
  ok('P2 an unknown column name is searched as plain text without errors',S.view.n===0&&$('#searchBadge').classList.contains('hidden'),$('#searchBadge').className);

  const t0=toasts();
  await typeQ('notes:/(/');
  await wait(200);
  const badge=$('#searchBadge');
  ok('P2 an invalid query shows the amber badge with the message',!badge.classList.contains('hidden')&&/pattern/.test(badge.title)&&/Search problem/.test(badge.getAttribute('aria-label')),badge.className+' '+badge.title);
  ok('P2 an invalid query does not raise error toasts',toasts()<=t0,toasts()+' vs '+t0);
  ok('P2 an invalid pattern is skipped so every row still shows',S.view.n===60,S.view.n);
  await typeQ('');
  ok('P2 clearing the search restores every row and hides the badge',S.view.n===60&&$('#searchBadge').classList.contains('hidden'));

  $('#btnSearchHelp').click();await wait(150);
  const helpDlg=document.querySelector('.dialog');
  ok('P2 the ? button opens the search syntax sheet',!!helpDlg&&/Search syntax/.test(helpDlg.textContent)&&helpDlg.querySelectorAll('tbody tr').length>=12,helpDlg&&helpDlg.textContent.slice(0,60));
  closeAll();
  ok('P2 Search syntax is a command',!!Commands.get('view.searchSyntax')&&!!Commands.get('view.findNext')&&!!Commands.get('view.funnels'));

  si().focus();
  await typeQ('sta');
  await until(()=>document.querySelector('.sb-suggest'),2000);
  const sugg=Array.from(document.querySelectorAll('.sb-suggest .menu-item')).map(x=>x.querySelector('.mi-label').textContent);
  ok('P2 typing a column prefix suggests the column',sugg.indexOf('Status')!==-1,sugg.join());
  keyOn(si(),'ArrowDown');keyOn(si(),'Enter');await wait(150);
  ok('P2 arrow plus Enter accepts a column suggestion',si().value==='Status:','"'+si().value+'"');
  await until(()=>document.querySelector('.sb-suggest'),2000);
  const vals=Array.from(document.querySelectorAll('.sb-suggest .menu-item')).map(x=>x.textContent);
  ok('P2 after the colon the values are suggested with counts',vals.length===3&&vals.some(v=>/paid/.test(v)&&/20/.test(v)),vals.join('|'));
  keyOn(si(),'Tab');await wait(150);
  ok('P2 Tab accepts the first value',/^Status:\w+ $/.test(si().value),'"'+si().value+'"');
  await until(()=>S.search===si().value,2000);
  await typeQ('sta');await until(()=>document.querySelector('.sb-suggest'),2000);
  keyOn(si(),'Escape');await wait(100);
  ok('P2 Escape closes the suggestions without clearing the search',!document.querySelector('.sb-suggest')&&si().value==='sta');
  await typeQ('');closeAll();

  await fresh();
  const funnels=Grid.head.querySelectorAll('.gh-filter');
  ok('P2 every header has a funnel button',funnels.length===6&&Array.from(funnels).every(f=>/Filter /.test(f.getAttribute('aria-label'))),funnels.length);
  funnel('Status').click();await until(()=>pop()&&rowLabels().length>0,3000);
  const labs=rowLabels();
  ok('P2 the funnel opens a popover that lists the values with counts',!!pop()&&labs.length===3&&labs.every(l=>l.n===20),JSON.stringify(labs.map(l=>l.v+':'+l.n)));
  ok('P2 the popover has sort, search, select all and the text filters',!!pop().querySelector('.cf-sort')&&!!pop().querySelector('.cf-search')&&!!pop().querySelector('.cf-all input')&&/Text filters/.test(pop().textContent));
  const allBox=pop().querySelector('.cf-all input');
  labs.find(l=>l.v==='paid').box.click();await wait(50);
  ok('P2 Select all becomes indeterminate when one value is unticked',pop().querySelector('.cf-all input').indeterminate===true&&pop().querySelector('.cf-all input').checked===false);
  await clickApply();
  ok('P2 unticking a value and applying updates the row count',S.view.n===count(r=>r.status!=='paid'),S.view.n);
  ok('P2 the funnel is accented when a filter is active',funnel('Status').classList.contains('on'));
  const bar=document.getElementById('vfilter');
  ok('P2 the filter bar shows the count and a chip',!bar.classList.contains('hidden')&&/Showing 40 of 60 rows/.test(bar.textContent)&&bar.querySelectorAll('.vf-chip').length===1,bar.textContent);
  funnel('Region').click();await until(()=>pop()&&rowLabels().length>0,3000);
  const rl=rowLabels();
  const sumN=rl.reduce((a,x)=>a+x.n,0);
  ok('P2 the value list of another column counts only rows that pass the other filters',sumN===40&&rl.find(x=>x.v==='EMEA').n===count(r=>r.status!=='paid'&&r.region==='EMEA'),JSON.stringify(rl.map(x=>x.v+':'+x.n)));
  closeAll();await wait(100);
  ok('P2 Escape closes the popover and gives the funnel back its focus',!pop()&&document.activeElement===funnel('Region'),String(document.activeElement&&document.activeElement.className));
  funnel('Status').click();await until(()=>pop()&&rowLabels().length>0,3000);
  const keepLabs=rowLabels();
  ok('P2 reopening shows the current selection',keepLabs.find(l=>l.v==='paid').box.checked===false&&keepLabs.find(l=>l.v==='pending').box.checked===true);
  pop().querySelector('.cf-clear').click();await wait(300);
  ok('P2 Clear filter from the column removes it',S.view.n===60&&!ColFilter.has('Status'));

  funnel('Amount').click();await until(()=>pop(),3000);
  pop().querySelector('.cf-typebtn').click();await wait(80);
  const opSel=pop().querySelector('.cf-op');
  ok('P2 the number submenu offers comparisons, top N and average',Array.from(opSel.options).map(o=>o.textContent).join('|')==='=|≠|>|≥|<|≤|between|top N|bottom N|above average|below average',Array.from(opSel.options).map(o=>o.textContent).join('|'));
  opSel.value='gt';opSel.dispatchEvent(new Event('change',{bubbles:true}));await wait(60);
  pop().querySelector('.cf-v1').value='abc';pop().querySelector('.cf-v1').dispatchEvent(new Event('input',{bubbles:true}));
  pop().querySelector('[data-act="apply"]').click();await wait(80);
  ok('P2 a bad number shows an inline error and does not apply',!!pop()&&/not a number/.test(pop().querySelector('.cf-error').textContent)&&!ColFilter.has('Amount'),pop()&&pop().querySelector('.cf-error').textContent);
  pop().querySelector('.cf-v1').value='100';pop().querySelector('.cf-v1').dispatchEvent(new Event('input',{bubbles:true}));
  await clickApply();
  ok('P2 Amount > 100 from the number submenu',S.view.n===count(r=>r.amount>100)&&ColFilter.has('Amount'),S.view.n);
  ok('P2 the chip describes the filter in words',/Amount.*greater than.*100/.test(document.querySelector('.vf-chip').textContent),document.querySelector('.vf-chip').textContent);
  document.querySelector('.vf-chip-x').click();await wait(300);
  ok('P2 the chip cross removes the filter',S.view.n===60&&document.getElementById('vfilter').classList.contains('hidden'));

  funnel('Amount').click();await until(()=>pop(),3000);
  pop().querySelector('.cf-typebtn').click();await wait(60);
  const op2=pop().querySelector('.cf-op');op2.value='rel:top';op2.dispatchEvent(new Event('change',{bubbles:true}));await wait(60);
  pop().querySelector('.cf-n1').value='5';pop().querySelector('.cf-n1').dispatchEvent(new Event('input',{bubbles:true}));
  await clickApply();
  ok('P2 top 5 keeps the five largest amounts',S.view.n===5,S.view.n);
  await ColFilter.clearAll();

  await Engine.call('setCtx',{today:'2026-01-15'});
  funnel('Date').click();await until(()=>pop(),3000);
  pop().querySelector('.cf-typebtn').click();await wait(60);
  const op3=pop().querySelector('.cf-op');op3.value='rel:thisMonth';op3.dispatchEvent(new Event('change',{bubbles:true}));await wait(60);
  await clickApply();
  ok('P2 this month resolves against today',S.view.n===31,S.view.n);
  await ColFilter.clearAll();
  funnel('Date').click();await until(()=>pop(),3000);
  pop().querySelector('.cf-typebtn').click();await wait(60);
  const op4=pop().querySelector('.cf-op');op4.value='rel:lastDays';op4.dispatchEvent(new Event('change',{bubbles:true}));await wait(60);
  pop().querySelector('.cf-n1').value='7';pop().querySelector('.cf-n1').dispatchEvent(new Event('input',{bubbles:true}));
  await clickApply();
  ok('P2 last 7 days includes both ends',S.view.n===8,S.view.n);
  const stepsBefore=S.steps.length;
  document.querySelector('#vfilter [data-act="filters-step"]').click();
  await until(()=>S.steps.length===stepsBefore+1,4000);await wait(300);
  const st=S.steps[S.steps.length-1];
  ok('P2 Make this a step fixes relative dates in the recipe',st.opId==='filterRows'&&st.cfg.conditions&&st.cfg.conditions[0].op==='between'&&st.cfg.conditions[0].fixedOn==='2026-01-15'&&st.cfg.conditions[0].value==='2026-01-08',JSON.stringify(st.cfg));
  ok('P2 Make this a step keeps the same rows and clears the filters',finalN()===8&&S.view.n===8&&!ColFilter.count(),finalN()+' '+S.view.n);
  await doUndo();await wait(300);
  ok('P2 undo removes the step and brings the filters back',S.steps.length===stepsBefore&&ColFilter.has('Date')&&S.view.n===8,S.steps.length+' '+ColFilter.has('Date')+' '+S.view.n);
  await doRedo();await wait(300);
  ok('P2 redo applies the step again and clears the filters',S.steps.length===stepsBefore+1&&!ColFilter.count()&&S.view.n===8,S.steps.length+' '+S.view.n);
  await Engine.call('setCtx',{today:null});
  await setPipeline([],0,{noUndo:true});await wait(200);

  await fresh();
  await typeQ('status:paid amount>100');
  const n1=S.view.n;
  $('#btnSearchStep').click();await until(()=>S.steps.length===1,4000);await wait(300);
  ok('P2 Make this a step on a query keeps the same rows and clears the box',S.view.n===n1&&n1===count(r=>r.status==='paid'&&r.amount>100)&&si().value===''&&S.search==='',S.view.n+' vs '+n1);
  ok('P2 a simple query becomes the flat conditions shape',S.steps[0].cfg.conditions&&S.steps[0].cfg.conditions.length===2&&S.steps[0].cfg.match==='all',JSON.stringify(S.steps[0].cfg).slice(0,160));
  await doUndo();await wait(300);
  ok('P2 undo restores the query text',S.steps.length===0&&S.search==='status:paid amount>100'&&si().value===S.search&&S.view.n===n1);
  await typeQ('(status:paid OR region:amer) -amount<50');
  const n2=S.view.n;
  $('#btnSearchStep').click();await until(()=>S.steps.length===1,4000);await wait(300);
  ok('P2 a grouped query becomes a tree step with the same rows',!!S.steps[0].cfg.tree&&S.view.n===n2&&n2===count(r=>(r.status==='paid'||r.region==='AMER')&&!(r.amount<50)),S.view.n+' vs '+n2);
  const f=StepForm('filterRows',S.steps[0].cfg,{});
  ok('P2 the filter step editor shows a tree step as text instead of breaking',!!f.el.querySelector('.fb-tree')&&/not|and|or/.test(f.el.querySelector('.fb-tree').textContent),f.el.textContent.slice(0,80));
  await setPipeline([],0,{noUndo:true});await wait(200);

  await fresh();
  Grid.sc.focus();
  keyOn(Grid.sc,'ArrowDown',{altKey:true});
  await until(()=>pop(),3000);
  ok('P2 Alt+Down opens the filter for the column under the cursor',!!pop()&&pop().dataset.col===curCols()[Math.max(0,Sel.cursor.col)],pop()&&pop().dataset.col);
  closeAll();await wait(100);
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'L',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true}));await wait(100);
  ok('P2 Ctrl+Shift+L hides the filter buttons',$('#grid').classList.contains('no-funnels')&&getComputedStyle(funnel('Status')).display==='none');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'L',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true}));await wait(100);
  ok('P2 Ctrl+Shift+L shows them again',!$('#grid').classList.contains('no-funnels')&&getComputedStyle(funnel('Status')).display!=='none');

  await ColFilter.set('Status',{col:'Status',op:'in',values:['paid'],caseSensitive:true});await wait(300);
  const firstId=Tabs.active;
  await Tabs.create({name:'second',origin:'paste',payload:{text:'x,y\n1,2\n3,4',fileName:''},activate:true});
  await until(()=>Tabs.active!==firstId&&S.loaded&&Grid.pool.length>0,5000);await wait(300);
  ok('P2 a new tab starts without filters',ColFilter.count()===0&&S.view.n===2,ColFilter.count()+' '+S.view.n);
  await Tabs.activate(firstId);await wait(400);
  ok('P2 filters stay with their tab when switching back',ColFilter.has('Status')&&S.view.n===20&&document.getElementById('vfilter').textContent.indexOf('Showing 20 of 60')!==-1,S.view.n);
  const extraTab=Tabs.list.find(t=>t.id!==firstId);
  if(extraTab)await Tabs.close(extraTab.id);
  await wait(300);

  await addStep('rename',{from:'Status',to:'State'},{silent:true});await wait(400);
  ok('P2 renaming a filtered column drops its filter with a toast',!ColFilter.has('Status')&&S.view.n===60&&Array.from(document.getElementById('toastRoot').children).some(t=>/filter on "Status"/.test(t.textContent)),S.view.n);
  await setPipeline([],0,{noUndo:true});await wait(200);

  await fresh();
  await ColFilter.set('Region',{col:'Region',op:'in',values:['EMEA'],caseSensitive:true});
  await ColFilter.set('Status',{col:'Status',op:'in',values:['paid'],caseSensitive:true});await wait(200);
  ok('P2 two column filters are ANDed',S.view.n===count(r=>r.region==='EMEA'&&r.status==='paid'),S.view.n);
  await typeQ('amount>100');
  ok('P2 column filters combine with the search box',S.view.n===count(r=>r.region==='EMEA'&&r.status==='paid'&&r.amount>100),S.view.n);
  await typeQ('');
  document.querySelector('#vfilter [data-act="filters-clear"]').click();await wait(300);
  ok('P2 Clear all filters shows every row again',S.view.n===60&&!ColFilter.count()&&document.getElementById('vfilter').classList.contains('hidden'));

  const many=['k'];for(let i=0;i<1500;i++)many.push('v'+i+',x');
  await fresh('k,z\n'+many.slice(1).map(x=>x).join('\n'),'many.csv');
  funnel('k').click();await until(()=>pop()&&rowLabels().length>0,4000);
  ok('P2 a long value list is capped at 1,000 with a hint',rowLabels().length===1000&&/Showing the first 1,000 of 1,500/.test(pop().textContent),rowLabels().length+' '+(pop().querySelector('.cf-more')||{}).textContent);
  const sbox=pop().querySelector('.cf-search');sbox.value='v149';sbox.dispatchEvent(new Event('input',{bubbles:true}));await wait(150);
  ok('P2 searching narrows the value list',rowLabels().length>=1&&rowLabels().every(l=>l.v.indexOf('v149')!==-1),rowLabels().length);
  closeAll();

  await fresh('a,b\nx,1\n,2\ny,3\n ,4\nx,5');
  funnel('a').click();await until(()=>pop()&&rowLabels().length>0,3000);
  const bl=rowLabels();
  ok('P2 blanks are listed first as (Blanks) with their count',bl[0].v==='(Blanks)'&&bl[0].n===2&&bl.length===3,JSON.stringify(bl.map(x=>x.v+':'+x.n)));
  bl[0].box.click();await clickApply();
  ok('P2 unticking (Blanks) hides the empty cells',S.view.n===3,S.view.n);
  await ColFilter.clearAll();

  await fresh();
  await typeQ('standard');
  si().focus();
  keyOn(si(),'Enter');
  await until(()=>/of/.test($('#searchCount').textContent),3000);
  const cnt1=$('#searchCount').textContent;
  ok('P2 Enter in the search box jumps to the first matching cell and counts matches',/^1 of 54 matches$/.test(cnt1)&&!!Grid.body.querySelector('.gc.findcur'),cnt1);
  keyOn(si(),'Enter');await wait(300);
  ok('P2 Enter again moves to the next match',/^2 of 54 matches$/.test($('#searchCount').textContent),$('#searchCount').textContent);
  keyOn(si(),'Enter',{shiftKey:true});await wait(300);
  ok('P2 Shift+Enter goes back',/^1 of 54 matches$/.test($('#searchCount').textContent),$('#searchCount').textContent);
  keyOn(si(),'Enter',{shiftKey:true});await wait(300);
  ok('P2 going back from the first match wraps to the last',/^54 of 54 matches$/.test($('#searchCount').textContent),$('#searchCount').textContent);
  Grid.sc.focus();
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'F3',bubbles:true,cancelable:true}));await wait(300);
  ok('P2 F3 finds the next match from anywhere',/^1 of 54 matches$/.test($('#searchCount').textContent),$('#searchCount').textContent);
  const cur=Find.cur;
  ok('P2 the outlined cell is the match the engine reported',!!cur&&cur.col===curCols().indexOf('Notes'),JSON.stringify(cur));
  await typeQ('');
  ok('P2 clearing the search clears the counter',$('#searchCount').classList.contains('hidden'));

  document.dispatchEvent(new KeyboardEvent('keydown',{key:'h',ctrlKey:true,bubbles:true,cancelable:true}));
  await until(()=>document.querySelector('.fr-body'),3000);
  ok('P2 Ctrl+H opens Find and replace',!!document.querySelector('.fr-body')&&/Find and replace/.test(document.querySelector('.dialog').textContent));
  const dlg=document.querySelector('.dialog');
  const inputs=dlg.querySelectorAll('.fr-body input.input');
  inputs[0].value='standard';inputs[0].dispatchEvent(new Event('input',{bubbles:true}));
  inputs[1].value='regular';inputs[1].dispatchEvent(new Event('input',{bubbles:true}));
  await until(()=>/will change/.test(dlg.querySelector('.fr-preview').textContent),3000);
  ok('P2 the live preview counts the cells and columns that will change',/54 cells in 1 column will change/.test(dlg.querySelector('.fr-preview').textContent),dlg.querySelector('.fr-preview').textContent);
  ok('P2 the preview shows before and after samples',dlg.querySelectorAll('.fr-table tbody tr').length===5&&/standard/.test(dlg.querySelector('.fr-before').textContent)&&/regular/.test(dlg.querySelector('.fr-after').textContent));
  const nb=S.steps.length;
  dlg.querySelector('[data-act="apply"]').click();
  await until(()=>S.steps.length===nb+1,4000);await wait(300);
  const rs=S.steps[S.steps.length-1];
  ok('P2 Apply adds the existing replace step',rs.opId==='replace'&&rs.cfg.find==='standard'&&rs.cfg.replace==='regular'&&rs.cfg.columns[0]==='*',JSON.stringify(rs.cfg));
  await typeQ('regular');
  ok('P2 the applied replace changed exactly the previewed cells',S.view.n===54,S.view.n);
  await typeQ('');
  await doUndo();await wait(300);

  Sel.setCell(0,5,false);Sel.rect={r0:0,r1:9,c0:5,c1:5};Sel.kind='cells';Sel.changed();
  Commands.run('text.replace');await until(()=>document.querySelector('.fr-body'),3000);
  const d2=document.querySelector('.dialog');
  const w=d2.querySelector('select');w.value='selection';w.dispatchEvent(new Event('change',{bubbles:true}));
  const i2=d2.querySelectorAll('.fr-body input.input');
  i2[0].value='new york';i2[0].dispatchEvent(new Event('input',{bubbles:true}));
  i2[1].value='NYC';i2[1].dispatchEvent(new Event('input',{bubbles:true}));
  await until(()=>/will change/.test(d2.querySelector('.fr-preview').textContent),3000);
  ok('P2 Within selection previews only the selected cells and explains the override steps',/1 cell in 1 column will change/.test(d2.querySelector('.fr-preview').textContent)&&!d2.querySelector('.fr-note').classList.contains('hidden'),d2.querySelector('.fr-preview').textContent);
  const nb2=S.steps.length;
  d2.querySelector('[data-act="apply"]').click();
  await until(()=>S.steps.length===nb2+1,4000);await wait(300);
  ok('P2 Within selection creates a cell override step',S.steps[S.steps.length-1].opId==='cellOverride'&&S.steps[S.steps.length-1].cfg.column==='Notes'&&S.steps[S.steps.length-1].cfg.overrides.length===1,JSON.stringify(S.steps[S.steps.length-1].cfg).slice(0,120));
  await setPipeline([],0,{noUndo:true});await wait(200);Sel.clear(true);

  Commands.run('text.replace');await until(()=>document.querySelector('.fr-body'),3000);
  const d3=document.querySelector('.dialog');
  const o3=d3.querySelectorAll('.fr-body input.input');
  o3[0].value='(a+)+$';o3[0].dispatchEvent(new Event('input',{bubbles:true}));
  d3.querySelector('input[data-k="regex"]').click();
  await until(()=>d3.querySelector('.fr-err'),3000);
  ok('P2 an unsafe pattern shows an error and disables Replace',!!d3.querySelector('.fr-err')&&d3.querySelector('[data-act="apply"]').disabled,d3.querySelector('.fr-preview').textContent);
  closeAll();

  await typeQ('standard');await until(settled,3000);
  Grid.paint();
  keyOn(si(),'Escape');
  await wait(300);
  ok('P2 Escape cleared the query and the rows',S.search===''&&S.view.n===60,S.search+' '+S.view.n)
});
})();
