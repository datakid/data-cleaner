(function(){
'use strict';
const W=window.WeftCore;
const out=[];
const log=s=>{out.push(s);console.log('BENCH '+s)};
function time(label,fn,reps){
  reps=reps||1;let best=Infinity,r;
  for(let i=0;i<reps;i++){const t=performance.now();r=fn();const d=performance.now()-t;if(d<best)best=d}
  log(label+': '+best.toFixed(1)+' ms');return r
}
const n=+(location.hash.match(/n=(\d+)/)||[])[1]||200000;
const st=time('makeStress',()=>W.makeStress(n));
const text=st.text;
log('bytes '+text.length);
const norm=time('normalizeInput',()=>W.normalizeInput(text),3);
time('split lines',()=>norm.split('\n'),3);
time('scanText',()=>W.scanText(norm),3);
const det=time('detectReadings',()=>W.detectReadings(norm),2);
time('parseDelimited',()=>W.parseDelimited(norm,',','"'),3);
const t=time('applyReading',()=>W.applyReading(norm,det.readings[0]),2);
time('inferTypes',()=>W.inferTypes(t,{dateOrder:'mdy'}),3);
time('full load',()=>W.Engine.handle('load',{text,fileName:'x.csv'}),2);
W.Engine.handle('setPipeline',{steps:[]});
const s0=time('step trim',()=>W.Engine.handle('setPipeline',{steps:[{id:'a',opId:'trim',cfg:{columns:['*'],collapse:true}}],force:true,fromIndex:0}),3);
time('step trim+sort',()=>W.Engine.handle('setPipeline',{steps:[{id:'a',opId:'trim',cfg:{columns:['*'],collapse:true}},{id:'b',opId:'sortRows',cfg:{keys:[{col:'amount',dir:'desc',type:'auto'}]}}],force:true,fromIndex:1}),3);
time('step +filter',()=>W.Engine.handle('setPipeline',{steps:[{id:'a',opId:'trim',cfg:{columns:['*'],collapse:true}},{id:'b',opId:'sortRows',cfg:{keys:[{col:'amount',dir:'desc',type:'auto'}]}},{id:'c',opId:'filterRows',cfg:{mode:'remove',match:'all',conditions:[{col:'payment_status',op:'equals',value:'paid',caseSensitive:false}]}}],force:true,fromIndex:2}),3);
time('step dedupe',()=>W.Engine.handle('setPipeline',{steps:[{id:'a',opId:'trim',cfg:{columns:['*'],collapse:true}},{id:'b',opId:'sortRows',cfg:{keys:[{col:'amount',dir:'desc',type:'auto'}]}},{id:'c',opId:'filterRows',cfg:{mode:'remove',match:'all',conditions:[{col:'payment_status',op:'equals',value:'paid',caseSensitive:false}]}},{id:'d',opId:'dedupe',cfg:{columns:['*']}}],force:true,fromIndex:3}),2);
time('view search',()=>W.Engine.handle('setView',{search:'lovelace'}),3);
time('view sort text',()=>W.Engine.handle('setView',{sort:[{col:'full_name',dir:'asc'}]}),2);
time('view sort num',()=>W.Engine.handle('setView',{sort:[{col:'amount',dir:'asc'}]}),2);
const v=W.Engine.handle('setView',{});
time('getRows',()=>W.Engine.handle('getRows',{viewKey:v.key,start:100000,count:256}),5);
time('issues (cold)',()=>{W.E.states.forEach(s=>{s._issues=null});return W.Engine.handle('issues',{})},2);
time('issues (cached)',()=>W.Engine.handle('issues',{}),3);
const ft=W.E.states[W.E.states.length-1];
time('  findJunkTable',()=>W.findJunkTable(ft),2);
time('  issues on 1-col text sample',()=>W.issues({cols:['full_name'],data:[ft.data[1]],n:ft.n,rowIds:ft.rowIds},{}),2);
time('  issues on email col',()=>W.issues({cols:['email'],data:[ft.data[2]],n:ft.n,rowIds:ft.rowIds},{}),2);
time('  dup map',()=>{const seen=new Map();const w=ft.cols.length;for(let r=0;r<ft.n;r++){let k='';for(let c=0;c<w;c++){const x=ft.data[c][r];if(x)k+=x;k+='\u0001'}if(!seen.has(k))seen.set(k,1)}},2);
time('profile amount',()=>W.Engine.handle('profile',{col:'amount'}),2);
time('export csv',()=>W.Engine.handle('export',{scope:'final',format:'csv',options:{header:true}}),2);
time('postMessage clone-ish (JSON)',()=>JSON.stringify(W.Engine.handle('getRows',{viewKey:v.key,start:0,count:256})),5);
document.getElementById('out').textContent=out.join('\n');
console.log('BENCH DONE');
})();
