(function(G){
'use strict';
const W=G.WeftCore;
function vendor(n,seed,junk){
  const rnd=W.mulberry32(seed);
  const F=['Ada','Grace','Alan','Edsger','Barbara','Donald','Katherine','John','Anita','Radia','Linus','Margaret','Dennis','Frances','Ken','Tim','Jean','Marie','Niklaus','Shafi'];
  const L=['Lovelace','Hopper','Turing','Dijkstra','Liskov','Knuth','Johnson','Bartik','Allen','Perlman','Torvalds','Hamilton','Ritchie','Spence','Thompson','Cerf','Curie','Wirth','McCarthy','Goldwasser'];
  const R=['Northeast','Southeast','Midwest','Southwest','West','EMEA','APAC'];
  const ST=['paid','Paid','PENDING','overdue','paid','paid','paid'];
  const DOM=['example.com','corp.example','vendor.example','mail.example'];
  const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const p2=x=>String(x).padStart(2,'0');
  const cols=['invoice_id','full_name','email','date','amount','region','payment_status','notes'];
  const rows=[],ids=[];let total=0;
  for(let i=0;i<n;i++){
    const idn=i>10&&rnd()<0.05?ids[(rnd()*ids.length)|0]:10000+i;ids.push(idn);
    const f=F[(rnd()*F.length)|0],l=L[(rnd()*L.length)|0];
    let inv='INV-2025-'+String(idn).padStart(5,'0');if(rnd()<0.045)inv=inv.toLowerCase();
    let name=f+' '+l;const nm=rnd();if(nm<0.1)name=f+'  '+l;else if(nm<0.15)name=' '+f+' '+l;else if(nm<0.2)name=f+' '+l+' ';
    const y=rnd()<0.85?2025:2024,mo=1+((rnd()*12)|0),dd=1+((rnd()*28)|0);const df=rnd();
    let date=df<0.3?y+'-'+p2(mo)+'-'+p2(dd):df<0.55?mo+'/'+dd+'/'+y:df<0.7?p2(mo)+'/'+p2(dd)+'/'+String(y).slice(2):df<0.85?MN[mo-1]+' '+dd+', '+y:dd+'-'+W.M3[mo-1]+'-'+y;
    if(rnd()<0.008)date='TBD';
    const amt=40+rnd()*48000;total+=amt;const af=rnd();
    let amount=af<0.45?'$'+amt.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):af<0.65?amt.toFixed(2):af<0.85?'$ '+amt.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'$'+amt.toFixed(2);
    if(rnd()<0.006)amount='';
    let email=(f+'.'+l).toLowerCase()+'@'+DOM[(rnd()*DOM.length)|0];if(rnd()<0.06)email=email[0].toUpperCase()+email.slice(1);if(rnd()<0.05)email+=' ';
    let status=ST[(rnd()*ST.length)|0];if(rnd()<0.08)status+=' ';
    const nf=rnd();const notes=nf<0.05?'follow up':nf<0.09?'PO-88'+((rnd()*90)|0):nf<0.12?'verified by finance':nf<0.14?'ref '+(1000+((rnd()*9000)|0)):'';
    const row=[inv,name,email,date,amount,R[(rnd()*R.length)|0],status,notes];
    rows.push(row);if(rnd()<0.02)rows.push(row.slice())
  }
  if(!junk)return W.toDelimited(cols,rows,',');
  const out=[];
  out.push('Acme Supplies - Accounts Receivable Export');
  out.push('Generated 2025-06-30 by FinanceBot');
  out.push(W.toDelimited(cols,[],','));
  const chunk=Math.ceil(rows.length/4);
  for(let i=0;i<rows.length;i++){
    if(i>0&&i%chunk===0)out.push(W.toDelimited(cols,[],','));
    out.push(W.toDelimited(null,[rows[i]],','))
  }
  out.push(W.toDelimited(null,[['TOTAL','','','','$'+total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),'','','']],','));
  return out.join('\n')
}
function serverLog(){
  const rnd=W.mulberry32(3141);
  const svc=['auth','payments','edge','search','billing','sync'];
  const lv=['INFO','INFO','INFO','DEBUG','DEBUG','WARN','ERROR'];
  const paths=['/api/login','/api/cart','/api/checkout','/health','/api/search','/api/users/42'];
  const msgs={INFO:['request complete','cache warm','user signed in','job finished'],DEBUG:['cache lookup','retry scheduled','opening connection'],WARN:['slow response','retrying upstream','deprecated endpoint'],ERROR:['upstream timeout','payment declined','connection reset']};
  const lines=[];let ts=Date.UTC(2025,5,30,8,0,0);
  for(let i=0;i<300;i++){
    ts+=Math.floor(rnd()*9000);
    const d=new Date(ts).toISOString().replace('Z','');
    const l=lv[(rnd()*lv.length)|0];const s=svc[(rnd()*svc.length)|0];
    const m=msgs[l][(rnd()*msgs[l].length)|0];
    const dur=Math.floor(5+rnd()*(l==='WARN'?4000:600));
    const st=l==='ERROR'?[500,502,504][(rnd()*3)|0]:200;
    let line=d.slice(0,23)+' '+l+' ['+s+'] '+m+' path='+paths[(rnd()*paths.length)|0]+' status='+st+' duration_ms='+dur+(rnd()<0.4?' user_id='+(1000+((rnd()*90)|0)):'');
    if(rnd()<0.05)line+=' note="needs review"';
    lines.push(line)
  }
  return lines.join('\n')
}
function contacts(){
  const rnd=W.mulberry32(777);
  const F=['Priya Shah','Tom Rees','Elena Vidal','Marcus Cole','Sana Iqbal','Owen Kato','Ines Duarte','Jacob Lund','Mei Chen','Liam Byrne','Noor Haddad','Ravi Menon'];
  const C=['Northwind','Contoso','Fabrikam','Initech','Globex','Umbrella','Hooli','Stark Industries'];
  const T=['Buyer','CFO','Office Manager','Engineer','Account Lead','Director'];
  const out=[];
  for(let i=0;i<40;i++){
    const n=F[(rnd()*F.length)|0];const c=C[(rnd()*C.length)|0];
    const b=['Name: '+n];
    if(rnd()<0.85)b.push('Email: '+n.toLowerCase().replace(' ','.')+'@'+c.toLowerCase().replace(/\s+/g,'')+'.example');
    if(rnd()<0.7)b.push('Phone: +1 ('+(200+((rnd()*700)|0))+') 555-'+String(1000+((rnd()*8999)|0)));
    b.push('Company: '+c);
    if(rnd()<0.6)b.push('Title: '+T[(rnd()*T.length)|0]);
    if(rnd()<0.3)b.push('Notes: met at '+['trade show','webinar','referral'][(rnd()*3)|0]);
    out.push(b.join('\n'))
  }
  return out.join('\n\n')
}
function dockerPs(){
  const rnd=W.mulberry32(99);
  const imgs=['nginx:1.27','postgres:16','redis:7-alpine','node:20-slim','grafana/grafana:11','prom/prometheus:v2.53'];
  const names=['web','db','cache','api','dash','metrics','worker','queue','auth','search'];
  const st=['Up 2 hours','Up 3 days','Exited (0) 5 minutes ago','Up 11 minutes','Up 2 weeks (healthy)','Restarting (1) 3 seconds ago'];
  const pad=(s,w)=>s+' '.repeat(Math.max(3,w-s.length));
  const W1=16,W2=26,W3=24,W4=18,W5=32,W6=28;
  const lines=[pad('CONTAINER ID',W1)+pad('IMAGE',W2)+pad('COMMAND',W3)+pad('CREATED',W4)+pad('STATUS',W5)+pad('PORTS',W6)+'NAMES'];
  for(let i=0;i<25;i++){
    const id=Array.from({length:12},()=>'0123456789abcdef'[(rnd()*16)|0]).join('');
    const img=imgs[(rnd()*imgs.length)|0];
    const cmd='"'+['docker-entrypoint.s…','nginx -g \'daemon of…','/run.sh','redis-server','node server.js'][(rnd()*5)|0]+'"';
    const cr=(1+((rnd()*9)|0))+' '+['hours','days','weeks'][(rnd()*3)|0]+' ago';
    const s=st[(rnd()*st.length)|0];
    const port=rnd()<0.7?'0.0.0.0:'+(3000+((rnd()*6000)|0))+'->'+[80,5432,6379,3000,9090][(rnd()*5)|0]+'/tcp':'';
    lines.push(pad(id,W1)+pad(img,W2)+pad(cmd,W3)+pad(cr,W4)+pad(s,W5)+pad(port,W6)+names[i%names.length]+(i>=10?'-'+(1+(i/10|0)):''))
  }
  return lines.join('\n')
}
const WEB_TABLE='<table><thead><tr><th>Country</th><th colspan="2">Population</th><th>Capital</th></tr><tr><th></th><th>2010</th><th>2024</th><th></th></tr></thead><tbody>'+
  [['Portugal','10,573,100','10,639,726','Lisbon'],['Spain','46,576,897','48,619,695','Madrid'],['France','65,027,512','68,516,699','Paris'],['Germany','81,776,930','84,552,242','Berlin'],['Italy','59,190,143','58,989,749','Rome'],['Netherlands','16,574,989','17,994,000','Amsterdam'],['Belgium','10,895,586','11,822,592','Brussels'],['Austria','8,361,069','9,158,750','Vienna'],['Poland','38,529,866','36,620,970','Warsaw'],['Sweden','9,378,126','10,551,707','Stockholm']].map((r,i)=>'<tr>'+(i===8?'<td rowspan="2">'+r[0]+'</td>':i===9?'':'<td>'+r[0]+'</td>')+'<td>'+r[1]+'</td><td>'+r[2]+'</td><td>'+r[3]+'</td></tr>').join('')+
  '</tbody></table>';
function nested(){
  const rnd=W.mulberry32(48120);
  const N=['Priya Shah','Tom Rees','Elena Vidal','Marcus Cole','Sana Iqbal','Owen Kato','Ines Duarte','Jacob Lund'];
  const S=['SKU-1042','SKU-2210','SKU-3388','SKU-4471','SKU-5502','SKU-6119'];
  const out=[];
  for(let i=0;i<26;i++){
    const items=[];const k=1+((rnd()*3)|0);for(let j=0;j<k;j++)items.push({sku:S[(rnd()*S.length)|0],qty:1+((rnd()*4)|0),price:Number((5+rnd()*180).toFixed(2))});
    const nm=N[(rnd()*N.length)|0];
    out.push({order_id:'ORD-'+(5000+i),customer:{name:nm,email:nm.toLowerCase().replace(' ','.')+'@example.com'},items,placed_at:'2025-0'+(1+((rnd()*9)|0))+'-'+String(1+((rnd()*27)|0)).padStart(2,'0'),status:['placed','shipped','delivered','cancelled'][(rnd()*4)|0]})
  }
  return JSON.stringify({orders:out,page:1},null,2)
}
W.SAMPLES={
  vendor:{title:'Vendor CSV with problems',badge:'CSV',tone:'rewrite',sub:'300 invoices · title rows, totals, repeated headers',file:'vendor-invoices.csv',make:()=>({text:vendor(300,20260906,true)})},
  log:{title:'Server log',badge:'LOG',tone:'structure',sub:'300 lines · timestamps, levels, key=value',file:'app.log',make:()=>({text:serverLog()})},
  web:{title:'Copied web table',badge:'HTML',tone:'reshape',sub:'10 rows · merged header and a spanning cell',file:'web-table',make:()=>({html:WEB_TABLE,text:''})},
  contacts:{title:'Contact list',badge:'KV',tone:'add',sub:'40 records · key: value blocks, gaps',file:'contacts.txt',make:()=>({text:contacts()})},
  terminal:{title:'Terminal output',badge:'FIXED',tone:'manual',sub:'25 containers · docker ps columns',file:'docker-ps.txt',make:()=>({text:dockerPs()})},
  json:{title:'API JSON',badge:'JSON',tone:'reshape',sub:'26 orders · nested customers and items',file:'orders.json',make:()=>({text:nested()})},
  stress:{title:'Performance test (200,000 rows)',badge:'CSV',tone:'rewrite',sub:'200,000 invoices',file:'stress-200k.csv',make:()=>({text:vendor(200000,990001,false)})}
};
W.makeSample=function(kind){const s=W.SAMPLES[kind];if(!s)throw new Error('Unknown example "'+kind+'".');const r=s.make();r.fileName=s.file;r.title=s.title;return r};
})(typeof self!=='undefined'?self:globalThis);
