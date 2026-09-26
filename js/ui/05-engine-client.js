'use strict';
const Engine={
  worker:null,mode:'none',seq:0,pending:new Map(),gens:{},recovering:null,lastLoad:null,lastReading:null,
  async init(){
    const noWorker=/[?&]noworker=1/.test(location.search);
    if(!noWorker&&typeof Worker==='function'){
      try{
        this.worker=new Worker('js/worker.js');
        this.worker.onmessage=e=>{const d=e.data,p=this.pending.get(d.id);if(!p)return;this.pending.delete(d.id);d.ok?p.resolve(d.result):p.reject(Object.assign(new Error(d.error&&d.error.message||'Engine error'),{code:d.error&&d.error.code}))};
        this.worker.onerror=e=>{if(e&&e.preventDefault)e.preventDefault();this.fallback('worker error')};
        this.mode='worker';
        const ok=await Promise.race([this.call('ping').then(()=>true,()=>false),sleep(8000).then(()=>false)]);
        if(ok)return;
      }catch(e){}
    }
    this.fallback(noWorker?'disabled':'unavailable')
  },
  fallback(reason){
    if(this.mode==='main')return;
    try{if(this.worker)this.worker.terminate()}catch(e){}
    this.worker=null;this.mode='main';
    const stalled=Array.from(this.pending.values());this.pending.clear();
    this.recovering=Promise.resolve().then(()=>this.replay()).catch(()=>{}).then(()=>{this.recovering=null});
    stalled.forEach(p=>{this.direct(p.type,p.payload).then(p.resolve,p.reject)});
    if(reason!=='disabled'&&!sessionStorage.getItem('weft.noworker')){try{sessionStorage.setItem('weft.noworker','1')}catch(e){}setTimeout(()=>Toast.show('Running without a background worker. Large files may feel slow.'),600)}
  },
  replay(){
    if(!this.lastLoad||typeof S==='undefined'||!S.loaded)return;
    const H=W.Engine;
    H.handle('setCtx',{dateOrder:S.dateOrder});
    H.handle('load',this.lastLoad);
    if(this.lastReading)H.handle('chooseReading',{reading:this.lastReading});
    (S.refsRaw||[]).forEach(r=>H.handle('refLoad',r));
    if(S.steps.length)H.handle('setPipeline',{steps:cleanSteps(S.steps),fromIndex:0});
    const vf=S.vfilter||{};
    S.view=H.handle('setView',{stateIdx:S.viewIdx,sort:S.sort,search:S.search,filter:vf.filter||null,rowIds:vf.rowIds||null});
    Grid.pages.clear()
  },
  async direct(type,payload){
    if(this.recovering&&type!=='ping')await this.recovering;
    await sleep(0);
    if(payload&&payload.viewKey&&S.view&&payload.viewKey!==S.view.key&&!/^(getRows)$/.test(type)){try{return W.Engine.handle(type,payload)}catch(e){if(/out of date/.test(e.message))return W.Engine.handle(type,Object.assign({},payload,{viewKey:S.view.key}));throw e}}
    return W.Engine.handle(type,payload)
  },
  call(type,payload,channel){
    if(type==='load'){this.lastLoad=payload;this.lastReading=null;S.refsRaw=S.refsRaw||[]}
    if(type==='chooseReading')this.lastReading=payload.reading||(S.readings[payload.index]?{kind:S.readings[payload.index].kind,params:S.readings[payload.index].params}:null);
    if(type==='refLoad')S.refsRaw=(S.refsRaw||[]).concat([payload]);
    let gen=0;
    if(channel){gen=(this.gens[channel]||0)+1;this.gens[channel]=gen}
    const p=this.mode==='worker'?new Promise((resolve,reject)=>{const id=++this.seq;this.pending.set(id,{resolve,reject,type,payload});this.worker.postMessage({id,type,payload})}):this.direct(type,payload);
    if(!channel)return p;
    return p.then(r=>{if(this.gens[channel]!==gen)throw Object.assign(new Error('stale'),{stale:true});return r})
  }
};
const Busy={
  n:0,label:'',t:null,
  async run(label,fn){
    this.n++;this.label=label;
    if(!this.t)this.t=setTimeout(()=>{if(this.n>0){$('#progress').classList.remove('hidden');Status.work(this.label)}},300);
    try{return await fn()}
    finally{this.n--;if(this.n<=0){this.n=0;clearTimeout(this.t);this.t=null;$('#progress').classList.add('hidden');Status.work(null)}}
  }
};
