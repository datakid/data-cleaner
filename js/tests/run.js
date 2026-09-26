(function(){
const res=runCoreTests();
const fails=res.filter(r=>!r.ok);
document.getElementById('sum').textContent=(res.length-fails.length)+' / '+res.length+' passed';
const out=document.getElementById('out');
res.forEach(r=>{const d=document.createElement('div');d.className=r.ok?'p':'f';d.textContent=(r.ok?'PASS ':'FAIL ')+r.name+(r.error?' — '+r.error:'');out.appendChild(d)});
console.log('RESULT '+(res.length-fails.length)+'/'+res.length);
fails.forEach(f=>console.log('FAIL '+f.name+' :: '+f.error));
})();
