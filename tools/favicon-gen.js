(function(){
'use strict';
const SRC='../favicon.svg';
function loadSvg(){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('favicon.svg could not be loaded'));i.src=SRC+'?'+Date.now()})}
function draw(img,s){const c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(img,0,0,s,s);return c}
function toPng(c){return new Promise((res,rej)=>c.toBlob(b=>b?b.arrayBuffer().then(ab=>res(new Uint8Array(ab))):rej(new Error('PNG encoding failed')),'image/png'))}
async function buildIco(img,sizes){
  const pngs=[];for(const s of sizes)pngs.push(await toPng(draw(img,s)));
  const n=sizes.length,head=6+16*n;let total=head;pngs.forEach(p=>total+=p.length);
  const out=new Uint8Array(total),dv=new DataView(out.buffer);
  dv.setUint16(0,0,true);dv.setUint16(2,1,true);dv.setUint16(4,n,true);
  let off=head;
  sizes.forEach((s,i)=>{const e=6+16*i;out[e]=s>=256?0:s;out[e+1]=s>=256?0:s;dv.setUint16(e+4,1,true);dv.setUint16(e+6,32,true);dv.setUint32(e+8,pngs[i].length,true);dv.setUint32(e+12,off,true);out.set(pngs[i],off);off+=pngs[i].length});
  return out
}
function dl(name,bytes,type){
  const u=URL.createObjectURL(new Blob([bytes],{type}));
  const a=document.createElement('a');a.href=u;a.download=name;a.rel='noopener';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),30000);
  return u
}
const info=document.getElementById('info');
const btnIco=document.getElementById('dl'),btnPng=document.getElementById('dlpng');
btnIco.disabled=btnPng.disabled=true;
(async()=>{
  let img;
  try{img=await loadSvg()}catch(e){info.textContent=e.message+'. Open this page from the project (tools/favicon.html), not as a loose file.';return}
  const pv=document.getElementById('previews');
  [16,32,48,64,128].forEach(s=>{const c=draw(img,s);const big=document.createElement('canvas');const z=s<=48?4:s<=64?2:1;big.width=big.height=s*z;const g=big.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(c,0,0,s*z,s*z);const f=document.createElement('figure');f.append(big,Object.assign(document.createElement('figcaption'),{textContent:s+' px'}));pv.append(f)});
  const ico=await buildIco(img,[16,32,48,256]);
  const png=await toPng(draw(img,180));
  const url=URL.createObjectURL(new Blob([ico],{type:'image/x-icon'}));
  document.getElementById('tabIcon').src=url;document.getElementById('tabIcon2').src=url;
  const fallback=(name,href)=>{let a=document.getElementById('fb-'+name);if(!a){a=document.createElement('a');a.id='fb-'+name;a.download=name;a.textContent='If nothing downloaded, right-click here and choose "Save link as…" ('+name+')';a.style.display='block';a.style.marginTop='6px';info.after(a)}a.href=href};
  btnIco.onclick=()=>{const u=dl('favicon.ico',ico,'image/x-icon');fallback('favicon.ico',u);info.textContent='favicon.ico ('+ico.length+' bytes, 16/32/48/256 px). Put it in the project root next to index.html.'};
  btnPng.onclick=()=>{const u=dl('apple-touch-icon.png',png,'image/png');fallback('apple-touch-icon.png',u)};
  btnIco.disabled=btnPng.disabled=false;
  info.textContent='Ready. Drawn from favicon.svg at 16, 32, 48 and 256 px.';
  window.WEFT_ICO={bytes:ico.length}
})();
})();
