(function(){
'use strict';
const CLAY='#D97757',PAPER='#FAF7F0';
const PIX16=[
'...CCCCCCCCCC...',
'.CCCCCCCCCCCCCC.',
'.CCCCCCCCCCCCCC.',
'CCCCCCCCCCCCCCCC',
'CCCPPCCCCCPPCCCC',
'CCPCCPCCCPCCPCCC',
'CCCCCCPPPCCCCPCC',
'CCCCCCCCCCCCCCCC',
'CCCCCCCCCCCCCCCC',
'CCCPPPPPPPPPPCCC',
'CCCCCCCCCCCCCCCC',
'CCCCCCCCCCCCCCCC',
'CCCPPPPPPPPPPCCC',
'.CCCCCCCCCCCCCC.',
'.CCCCCCCCCCCCCC.',
'...CCCCCCCCCC...'];
function drawPix(rows,s){
  const c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');
  const n=rows.length,z=s/n;
  rows.forEach((row,y)=>[...row].forEach((ch,i)=>{if(ch==='.')return;x.fillStyle=ch==='P'?PAPER:CLAY;x.fillRect(i*z,y*z,z,z)}));
  return c
}
function draw(s){
  if(s===16)return drawPix(PIX16,16);
  const c=document.createElement('canvas');c.width=c.height=s;
  const x=c.getContext('2d');
  const r=Math.round(s*0.28);
  x.fillStyle=CLAY;x.beginPath();
  if(x.roundRect)x.roundRect(0,0,s,s,r);else{x.moveTo(r,0);x.arcTo(s,0,s,s,r);x.arcTo(s,s,0,s,r);x.arcTo(0,s,0,0,r);x.arcTo(0,0,s,0,r)}
  x.fill();
  const lw=s<=16?2:s<=32?3:s<=48?4:Math.round(s*0.082);
  const off=lw%2?0.5:0;
  const L=Math.round(s*0.25),R=s-L;
  const y1=Math.round(s*0.33)+off,y2=Math.round(s*0.53)+off,y3=Math.round(s*0.71)+off;
  x.strokeStyle=PAPER;x.lineWidth=lw;x.lineCap='round';x.lineJoin='round';
  const a=Math.max(1.5,s*0.075);
  x.beginPath();x.moveTo(L,y1);
  const seg=(R-L)/2;
  x.bezierCurveTo(L+seg*0.35,y1-a*2,L+seg*0.65,y1+a*2,L+seg,y1);
  x.bezierCurveTo(L+seg*1.35,y1-a*2,L+seg*1.65,y1+a*2,R,y1);
  x.stroke();
  x.beginPath();x.moveTo(L,y2);x.lineTo(R,y2);x.moveTo(L,y3);x.lineTo(R,y3);x.stroke();
  if(s>=48){
    const gx=Math.round(s*0.45)+(lw%2?0:0);
    x.strokeStyle=CLAY;x.lineWidth=Math.max(2,Math.round(lw*0.8));x.lineCap='butt';
    x.beginPath();x.moveTo(gx,y2-lw);x.lineTo(gx,y2+lw);x.stroke();
    x.strokeStyle=PAPER;x.lineWidth=Math.max(1,Math.round(lw*0.45));
    x.beginPath();x.moveTo(gx,y1+lw);x.lineTo(gx,y3+lw*0.2);x.stroke()
  }
  return c
}
function toPng(c){return new Promise(res=>c.toBlob(b=>b.arrayBuffer().then(ab=>res(new Uint8Array(ab))),'image/png'))}
async function buildIco(sizes){
  const pngs=[];for(const s of sizes)pngs.push(await toPng(draw(s)));
  const n=sizes.length,head=6+16*n;let total=head;pngs.forEach(p=>total+=p.length);
  const out=new Uint8Array(total),dv=new DataView(out.buffer);
  dv.setUint16(0,0,true);dv.setUint16(2,1,true);dv.setUint16(4,n,true);
  let off=head;
  sizes.forEach((s,i)=>{const e=6+16*i;out[e]=s>=256?0:s;out[e+1]=s>=256?0:s;out[e+2]=0;out[e+3]=0;dv.setUint16(e+4,1,true);dv.setUint16(e+6,32,true);dv.setUint32(e+8,pngs[i].length,true);dv.setUint32(e+12,off,true);out.set(pngs[i],off);off+=pngs[i].length});
  return out
}
function b64(bytes){let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s)}
function fnv(bytes){let h=0x811c9dc5;for(let i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,0x01000193)}return(h>>>0).toString(16)}
function dl(name,bytes,type){const u=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000)}
(async()=>{
  const sizes=[16,32,48,256];
  const pv=document.getElementById('previews');
  [16,32,48,64,128].forEach(s=>{const c=draw(s);const big=document.createElement('canvas');const z=s<=48?4:s<=64?2:1;big.width=big.height=s*z;const g=big.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(c,0,0,s*z,s*z);const f=document.createElement('figure');f.append(big,Object.assign(document.createElement('figcaption'),{textContent:s+' px'}));pv.append(f)});
  const ico=await buildIco(sizes);
  const data='data:image/x-icon;base64,'+b64(ico);
  document.getElementById('tabIcon').src=data;document.getElementById('tabIcon2').src=data;
  document.getElementById('info').textContent='favicon.ico: '+ico.length+' bytes, sizes '+sizes.join(', ')+' px, checksum '+fnv(ico);
  document.getElementById('dl').onclick=()=>dl('favicon.ico',ico,'image/x-icon');
  document.getElementById('dlpng').onclick=async()=>dl('apple-touch-icon.png',await toPng(draw(180)),'image/png');
  const small=await buildIco([16,32,48]);
  const s64=b64(small);
  console.log('ICO_LEN '+small.length+' FNV '+fnv(small)+' B64LEN '+s64.length);
  const u64=s64.replace(/\+/g,'-').replace(/\//g,'_');
  for(let i=0;i<u64.length;i+=900)console.log('ICO_URL '+(i/900)+' '+u64.slice(i,i+900));
  const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');g.drawImage(img,0,0,16,16);const p=g.getImageData(8,1,1,1).data,q=g.getImageData(4,4,1,1).data;console.log('BAKED favicon.ico '+img.naturalWidth+'x'+img.naturalHeight+' clay='+p.join(',')+' paper='+q.join(','))};img.onerror=()=>console.log('BAKED favicon.ico missing');img.src='../favicon.ico?'+Date.now();
  window.WEFT_ICO={small,full:ico,s64}
})();
})();
