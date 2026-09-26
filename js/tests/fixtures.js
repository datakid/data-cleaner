(function(G){
'use strict';
const L=a=>a.join('\n');
function csvClean(){const r=['id,name,email,amount'];for(let i=1;i<=20;i++)r.push(i+',Person '+i+',p'+i+'@x.com,'+(i*10.5).toFixed(2));return L(r)}
function csvEu(){const r=['id;produkt;preis;datum'];for(let i=1;i<=15;i++)r.push(i+';Artikel '+i+';'+(i*1234.5).toLocaleString('de-DE',{minimumFractionDigits:2})+';'+String(i).padStart(2,'0')+'.03.2025');return L(r)}
function csvTitles(){const r=['Quarterly Sales Report','Region: North',  'rep,units,revenue'];for(let i=1;i<=12;i++)r.push('Rep '+i+','+(i*3)+','+(i*300));r.push('Total,234,23400');return L(r)}
function csvRepeated(){const r=['sku,qty,price'];for(let i=1;i<=150;i++){r.push('S'+i+','+i+','+(i*2)+'.50');if(i%50===0&&i<150)r.push('sku,qty,price')}return L(r)}
function tsv(){const r=['Name\tDept\tSalary\tStart'];const d=['Ops','Eng','Sales'];for(let i=1;i<=18;i++)r.push('Emp '+i+'\t'+d[i%3]+'\t'+(50000+i*1000)+'\t2024-0'+(1+i%9)+'-1'+(i%9));return L(r)}
function md(){return L(['| Name | Role | Age |','|------|:----:|----:|','| Ada | Eng | 36 |','| Grace | Admiral | 85 |','| Alan | Math | 41 |','| Linus | Kernel | 54 |'])}
function mysql(){return L(['+----+-------+--------+','| id | name  | status |','+----+-------+--------+','|  1 | Ada   | active |','|  2 | Grace | idle   |','|  3 | Alan  | active |','+----+-------+--------+','3 rows in set (0.00 sec)'])}
function psql(){return L([' id | name  | city','----+-------+--------','  1 | Ada   | London','  2 | Grace | NYC','  3 | Alan  | Wilmslow','(3 rows)'])}
function docker(){return G.WeftCore.makeSample('terminal').text}
function lsl(){const pad=(s,w)=>String(s).padStart(w);const r=['total 48'];const n=['alpha.txt','beta.log','gamma.csv','delta.json','notes.md','run.sh','zeta.bin'];n.forEach((f,i)=>r.push('-rw-r--r--  1 ada  staff  '+pad(1000*(i+1)+i*37,6)+' Mar '+pad(i+1,2)+' 10:0'+i+' '+f));return L(r)}
function pdf(){const p=(s,w)=>s+' '.repeat(Math.max(2,w-s.length));const r=[p('Invoice',14)+p('Customer name',24)+p('Due date',14)+'Amount'];const c=['Acme Corp','Globex Inc','Initech LLC','Umbrella Co','Hooli','Wayne Ent'];for(let i=0;i<12;i++){const nm=c[i%6];r.push(p('INV-'+(100+i),14+(i%3===0?2:0))+p(nm,24-(i%3===0?2:0))+p('2025-0'+(1+i%9)+'-15',14)+'$'+(i*123+50)+'.00')}return L(r)}
function kv(){return G.WeftCore.makeSample('contacts').text}
function kvRepeat(){const r=[];for(let i=1;i<=10;i++){r.push('id='+i);r.push('host=srv'+i);r.push('state='+(i%2?'up':'down'));if(i%3)r.push('owner=team'+(i%4))}return L(r)}
function addr(){const r=[];for(let i=1;i<=12;i++){r.push('Person '+i);r.push(i*10+' Main Street');r.push('Springfield, IL 6270'+(i%10));r.push('')}return L(r)}
function logfmt(){const r=[];for(let i=0;i<30;i++)r.push('time=2025-06-01T10:00:'+String(i).padStart(2,'0')+'Z level='+(i%4?'info':'error')+' msg="request '+i+'" path=/api/'+(i%5)+' status='+(i%4?200:500));return L(r)}
function apache(){const r=[];for(let i=0;i<25;i++)r.push('192.168.1.'+(i%9)+' - - [10/Oct/2025:13:55:'+String(i).padStart(2,'0')+' -0700] "GET /page/'+i+' HTTP/1.1" '+(i%7?200:404)+' '+(1000+i*17)+' "http://example.com/start" "Mozilla/5.0 (X11; Linux x86_64)"');return L(r)}
function applog(){const lv=['INFO','WARN','ERROR','DEBUG'];const r=[];for(let i=0;i<30;i++)r.push('2025-06-01 12:00:'+String(i).padStart(2,'0')+'.'+String(i*7%1000).padStart(3,'0')+' '+lv[i%4]+' Worker thread '+i+' finished the batch');return L(r)}
function prefixedJson(){const r=[];for(let i=0;i<20;i++)r.push('2025-06-01T08:00:'+String(i).padStart(2,'0')+'Z INFO api '+JSON.stringify({req:i,user:{id:100+i},ok:i%3!==0}));return L(r)}
function bullets(){return L(['- Apples – crisp and sweet','- Bananas – good for smoothies','- Cherries – seasonal','- Dates – very sweet','- Elderberries – for syrup','- Figs – best fresh'])}
function ndjson(){const r=[];for(let i=0;i<12;i++)r.push(JSON.stringify({id:i,name:'n'+i,tags:['a','b'],meta:{ok:true}}));return L(r)}
function nested(){return G.WeftCore.makeSample('json').text}
function prose(){return L(['The committee met on Tuesday to discuss the budget for next year.','Several members raised concerns about the timeline, and the chair agreed','to revisit the matter at the next session. Minutes will be circulated','by the end of the week, along with a summary of the action items.','','In other business, the group welcomed two new volunteers who will help','with the spring fundraiser. Everyone is encouraged to bring ideas.'])}
const HTML_MATRIX={rows:[['Country','Population','Population_2','Capital'],['Portugal','10,573,100','10,639,726','Lisbon'],['Spain','46,576,897','48,619,695','Madrid'],['Poland','38,529,866','36,620,970','Warsaw'],['Poland','9,378,126','10,551,707','Stockholm']],thHeader:true,warnings:['1 spanning cell was repeated down.']};
G.WEFT_FIXTURES=[
  {name:'01 clean CSV',text:csvClean,expect:{kind:'delimited',cols:4,rows:20}},
  {name:'02 semicolon CSV EU numbers',text:csvEu,expect:{kind:'delimited',cols:4,rows:15}},
  {name:'03 CSV title rows + totals',text:csvTitles,expect:{kind:'delimited',rows:16},issues:['header','totals']},
  {name:'04 CSV repeated headers',text:csvRepeated,expect:{kind:'delimited',cols:3,rows:152},issues:['repeatedHeader']},
  {name:'05 TSV from Excel',text:tsv,expect:{kind:'delimited',cols:4,rows:18}},
  {name:'06 markdown table',text:md,expect:{kind:'markdown-table',cols:3,rows:4}},
  {name:'07 MySQL box',text:mysql,expect:{kind:'box-table',cols:3,rows:4}},
  {name:'08 psql table',text:psql,expect:{kind:'box-table',cols:3,rows:4}},
  {name:'09 docker ps',text:docker,expect:{kind:'fixed-width',cols:7,rows:25}},
  {name:'10 ls -l',text:lsl,expect:{kind:'fixed-width',rows:8}},
  {name:'11 PDF copy spaces',text:pdf,expect:{kind:'whitespace-runs',cols:4,rows:12}},
  {name:'12 key: value contacts',text:kv,expect:{kind:'key-value-blocks',rows:40}},
  {name:'13 key=value repeat',text:kvRepeat,expect:{kind:'key-value-blocks',cols:4,rows:10}},
  {name:'14 address blocks',text:addr,expect:{kind:'line-blocks',cols:3,rows:12}},
  {name:'15 logfmt',text:logfmt,expect:{kind:'logfmt',cols:5,rows:30}},
  {name:'16 apache combined',text:apache,expect:{kind:'access-log',cols:11,rows:25}},
  {name:'17 app log levels',text:applog,expect:{kind:'log-lines',cols:3,rows:30}},
  {name:'18 prefixed JSON',text:prefixedJson,expect:{kind:'prefixed-json',rows:20}},
  {name:'19 bullets name – desc',text:bullets,expect:{kind:'list',cols:2,rows:6}},
  {name:'20 HTML table matrix',text:()=>'',html:[HTML_MATRIX],expect:{kind:'html-table',cols:4,rows:4}},
  {name:'21 NDJSON',text:ndjson,expect:{kind:'ndjson',rows:12}},
  {name:'22 nested JSON',text:nested,expect:{kind:'json',rows:26}},
  {name:'23 prose',text:prose,expect:{kindIn:['lines','list']},maxTabularConf:0.6}
];
})(typeof self!=='undefined'?self:globalThis);
