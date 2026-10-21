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
  {name:'07 MySQL box',text:mysql,expect:{kind:'box-table',cols:3,rows:3}},
  {name:'08 psql table',text:psql,expect:{kind:'box-table',cols:3,rows:3}},
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

const mRowsOf=(n,f)=>{const r=[];for(let i=1;i<=n;i++)r.push(f(i));return r};
const mCsvA=()=>L(['name,dept,salary'].concat(mRowsOf(4,i=>'Emp '+i+',Ops,'+(40000+i*1500))));
const mCsvB=()=>L(['sku,qty,price,stock'].concat(mRowsOf(5,i=>'S-'+i+','+(i*4)+','+(i*2.5).toFixed(2)+','+(i%2?'yes':'no'))));
const mSales=()=>L(['region,units,revenue'].concat(mRowsOf(3,i=>'North '+i+','+(i*7)+','+(i*700))));
const mReturns=()=>L(['region,units,revenue'].concat(mRowsOf(3,i=>'South '+i+','+(i*2)+','+(i*90))));
const mTbl=(h,rows)=>L([h].concat(rows));
const mdA=()=>L(['| Name | Role |','|------|------|','| Ada | Eng |','| Grace | Admiral |','| Alan | Math |']);
const mdB=()=>L(['| Region | Sales | Cost |','|--------|------:|-----:|','| North | 120 | 80 |','| South | 95 | 60 |','| East | 70 | 41 |']);
const myA=()=>L(['+----+-------+--------+','| id | name  | status |','+----+-------+--------+','|  1 | Ada   | active |','|  2 | Grace | idle   |','|  3 | Alan  | active |','+----+-------+--------+','3 rows in set (0.00 sec)']);
const myB=()=>L(['+-----+-----+','| sku | qty |','+-----+-----+','| A1  |  4  |','| B2  |  9  |','| C3  |  2  |','+-----+-----+','3 rows in set (0.00 sec)']);
const pgA=()=>L([' id | name  | city','----+-------+--------','  1 | Ada   | London','  2 | Grace | NYC','  3 | Alan  | Wilmslow','(3 rows)']);
const pgB=()=>L([' sku | qty','-----+-----',' A1  |   4',' B2  |   9','(2 rows)']);
const mPara=()=>'The first quarter closed with steady demand across every region. Management expects the same trend through the summer. Please review the figures below before the meeting on Friday.';
const mNdGroup=(k)=>L(mRowsOf(4,i=>'{"id":'+(k*10+i)+',"name":"n'+(k*10+i)+'","ok":true}'));
const mAddr=(k)=>L(['Name: Person '+k,'Street: '+k+' Main St','City: Town '+k,'Phone: 555-010'+k]);
const mHtmlT=(rows,docIndex,extra)=>Object.assign({rows,thHeader:true,warnings:[],docIndex},extra||{});
const mMany=()=>{const out=[];for(let k=1;k<=13;k++)out.push(L(['h'+k+'a,h'+k+'b,h'+k+'c','Item '+k+',5,9.5','Item '+(k+1)+',6,10.5']));return out.join('\n\n')};
const mSampleNames=()=>{const W=G.WeftCore;return Object.keys(W.SAMPLES).filter(k=>k!=='stress')};
const mEmptyRowCsv=()=>L(['email_address,id','no,q','no,x y z','yes,q','','yes,','yes,q','no,"hello, world"','','yes,plain','no,"hello, world"','no,','no,a; b']);
const mEmptyRowTsv=()=>L(['city\tamount','Lagos\t','\t','\t','Lima\tEdsger','\t','Cairo\tAda','Osaka\tAda Ken']);
const mRagged=()=>{const names=['Alder','Birch','Cedar','Dogwood','Elm','Fir','Gum','Hazel','Ironwood','Juniper','Kauri','Larch','Maple','Nutmeg','Oak','Pine','Quince','Rowan'];const out=['version,codename,series,created,release,eol,eol-lts,eol-elts'];names.forEach((n,i)=>{const y=1993+i;let r=[(1+i/10).toFixed(1),n,n.toLowerCase(),y+'-08-16'];if(i>=4)r=r.concat([(y+1)+'-06-17',(y+2)+'-06-05']);if(i>=12)r=r.concat([(y+5)+'-06-30',(y+7)+'-06-30']);out.push(r.join(','))});return L(out)};
G.WEFT_MULTI_FIXTURES=[
  {name:'M01 csv 3 cols then csv 4 cols',text:()=>mCsvA()+'\n\n'+mCsvB(),expect:{split:true,count:2}},
  {name:'M02 titled csv tables',text:()=>'Sales Q1\n'+mSales()+'\n\nReturns\n'+mReturns(),expect:{split:true,count:2,titles:['Sales Q1','Returns']}},
  {name:'M03 blank line, no second header',text:()=>mTbl('rep,units,revenue',mRowsOf(5,i=>'Rep '+i+','+(i*3)+','+(i*300)))+'\n\n'+L(mRowsOf(5,i=>'Rep '+(i+5)+','+((i+5)*3)+','+((i+5)*300))),expect:{split:false}},
  {name:'M04 blank line, same header repeated',text:()=>mTbl('sku,qty,price',mRowsOf(4,i=>'S'+i+','+i+','+(i*2)+'.50'))+'\n\n'+mTbl('sku,qty,price',mRowsOf(4,i=>'S'+(i+4)+','+(i+4)+','+((i+4)*2)+'.50')),expect:{split:false}},
  {name:'M05 two markdown tables back to back',text:()=>mdA()+'\n'+mdB(),expect:{split:true,count:2,kinds:['markdown-table','markdown-table']}},
  {name:'M06 two MySQL outputs',text:()=>myA()+'\n\n'+myB(),expect:{split:true,count:2}},
  {name:'M07 two psql outputs, no blank line',text:()=>pgA()+'\n'+pgB(),expect:{split:true,count:2}},
  {name:'M08 csv then tsv',text:()=>mCsvA()+'\n\n'+L(['Name\tDept\tSalary\tStart'].concat(mRowsOf(4,i=>'Emp '+i+'\tEng\t'+(50000+i*1000)+'\t2024-0'+i+'-1'+i))),expect:{split:true,count:2}},
  {name:'M09 width change without blank line',text:()=>L(['id,name,city'].concat(mRowsOf(4,i=>i+',Person '+i+',Town '+i)).concat(['sku,color,size,qty,price']).concat(mRowsOf(3,i=>'K'+i+',red,M,'+(i*2)+','+(i*1.5).toFixed(2)))),expect:{split:true,count:2}},
  {name:'M10 built-in samples',samples:true,expect:{split:false}},
  {name:'M11 paragraph between tables',text:()=>mCsvA()+'\n\n'+mPara()+'\n\n'+mCsvB(),expect:{split:true,count:2,skipped:1}},
  {name:'M12 NDJSON groups',text:()=>mNdGroup(1)+'\n\n'+mNdGroup(2),expect:{split:false}},
  {name:'M13 address blocks',text:()=>mAddr(1)+'\n\n'+mAddr(2)+'\n\n'+mAddr(3),expect:{split:false}},
  {name:'M14 html tables follow document order',text:()=>'',html:[mHtmlT([['x','y']],0),mHtmlT([['a','b','c','d'],['1','2','3','4'],['5','6','7','8']],2),mHtmlT([['p','q','r'],['1','2','3'],['4','5','6'],['7','8','9']],1)],expect:{split:true,count:2,htmlOrder:[2,1]}},
  {name:'M15 html with a nested table',text:()=>'',html:[mHtmlT([['a','b'],['1','2'],['3','4']],0),mHtmlT([['a','b'],['1','2'],['3','4']],1,{nested:true})],expect:{split:false}},
  {name:'M16 thirteen tables are capped',text:mMany,expect:{split:true,count:12,truncated:true,total:13}},
  {name:'M17 empty input',text:()=>'',expect:{split:false}},
  {name:'M17b whitespace only',text:()=>' \n \n',expect:{split:false}},
  {name:'M18 one csv table with empty rows',text:mEmptyRowCsv,expect:{split:false}},
  {name:'M19 one tsv table with empty rows',text:mEmptyRowTsv,expect:{split:false}},
  {name:'M20 one csv table with ragged trailing columns',text:mRagged,expect:{split:false}},
  {name:'M22 titles directly above markdown tables',text:()=>L(['Sales','| a | b |','|---|---|','| 1 | 2 |','| 3 | 4 |','Returns','| x | y | z |','|---|---|---|','| 1 | 2 | 3 |','| 4 | 5 | 6 |']),expect:{split:true,count:2,titles:['Sales','Returns'],kinds:['markdown-table','markdown-table']}},
  {name:'M23 title directly above the second MySQL table',text:()=>myA()+'\nReturns\n'+myB(),expect:{split:true,count:2,titles:['Table 1','Returns']}},
  {name:'M21 empty row inside the first of two tables',text:()=>mEmptyRowCsv()+'\n\n'+mCsvB(),expect:{split:true,count:2}}
];
G.WEFT_SAMPLE_NAMES=mSampleNames;
})(typeof self!=='undefined'?self:globalThis);
