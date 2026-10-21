'use strict';
const Engine={
  worker:null,mode:'none',seq:0,pending:new Map(),gens:{},recovering:null,lastLoad:null,lastReading:null,lastActive:0,active:'t1',loads:{},readingsBy:{},
  init(){if(!this.ready)this.ready=this.init_().finally(()=>{this.ready_=true;const pp=document.getElementById('pageProgress');if(pp&&!Busy.n)pp.classList.add('hidden')});return this.ready},
  async init_(){
    const noWorker=/[?&]noworker=1/.test(location.search);
    if(!noWorker&&typeof Worker==='function'){
      try{
        this.worker=new Worker('js/worker.js');
        this.worker.onmessage=e=>{const d=e.data,p=this.pending.get(d.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(d.id);d.ok?p.resolve(d.result):p.reject(Object.assign(new Error(d.error&&d.error.message||'Engine error'),{code:d.error&&d.error.code}))};
        this.worker.onerror=e=>{if(e&&e.preventDefault)e.preventDefault();this.fallback('worker error')};
        this.mode='worker';
        const ok=await Promise.race([this.call('ping').then(()=>true,()=>false),sleep(20000).then(()=>false)]);
        if(ok)return;
      }catch(e){}
    }
    this.fallback(noWorker?'disabled':'unavailable')
  },
  fallback(reason){
    if(this.mode==='main')return;
    this.fallbackReason=reason;
    try{if(this.worker)this.worker.terminate()}catch(e){}
    this.worker=null;this.mode='main';
    const stalled=Array.from(this.pending.values());this.pending.clear();
    this.recovering=Promise.resolve().then(()=>this.replay()).catch(()=>{}).then(()=>{this.recovering=null});
    stalled.forEach(p=>{this.direct(p.type,p.payload).then(p.resolve,p.reject)});
    let seen=false;try{seen=!!sessionStorage.getItem('weft.noworker')}catch(e){}
    if(reason!=='disabled'&&!seen){try{sessionStorage.setItem('weft.noworker','1')}catch(e){}setTimeout(()=>Toast.show('Running without a background worker. Large files may feel slow.'),600)}
  },
  async replay(){
    if(typeof S==='undefined'||!S.loaded)return;
    const H=W.Engine;
    const run=(type,payload)=>this.mode==='worker'?this.post(type,payload):Promise.resolve(H.handle(type,payload));
    const tabs=typeof Tabs!=='undefined'?Tabs.list:[];
    const ids=tabs.length?tabs.map(t=>t.id):[this.active];
    const cur=tabs.length&&Tabs.active?Tabs.active:ids[0];
    if(!ids.some(id=>this.loads[id]))return;
    const stepsOf=id=>{if(id===cur)return S.steps;const t=tabs.find(x=>x.id===id);return t&&t.ui&&t.ui.steps||[]};
    const failed=new Set();
    await run('tableReset',{id:ids[0]});
    await run('setCtx',{dateOrder:S.dateOrder});
    for(let k=0;k<ids.length;k++){
      const id=ids[k];
      try{
        if(k)await run('tableNew',{id});
        const L=this.loads[id];if(!L)continue;
        if(L.__stress){await run('stageStress',{n:L.__stress});await run('loadStaged',{})}else await run('load',L);
        if(this.readingsBy[id])await run('chooseReading',{reading:this.readingsBy[id]})
      }catch(e){failed.add(id)}
    }
    for(const r of (S.refsRaw||[])){try{await run('refLoad',r)}catch(e){}}
    for(const id of ids){
      if(failed.has(id))continue;
      try{const st=stepsOf(id);if(st.length){await run('tableUse',{id});await run('setPipeline',{steps:cleanSteps(st),fromIndex:0})}}catch(e){failed.add(id)}
    }
    if(failed.size){const names=ids.filter(id=>failed.has(id)).map(id=>{const t=tabs.find(x=>x.id===id);return t?t.name:id});Toast.err('Some tables could not be restored: '+names.join(', '))}
    await run('tableUse',{id:cur});
    const vf=S.vfilter||{};
    S.view=await run('setView',{stateIdx:S.viewIdx,sort:S.sort,search:S.search,filter:vf.filter||null,rowIds:vf.rowIds||null});
    Grid.pages.clear()
  },
  post(type,payload){
    return new Promise((resolve,reject)=>{
      const id=++this.seq;const e={resolve,reject,type,payload};
      if(type!=='ping')e.timer=setTimeout(()=>Engine.onSlow(id,type),20000);
      this.pending.set(id,e);this.worker.postMessage({id,type,payload})
    })
  },
  async onSlow(id,type){
    const e=this.pending.get(id);if(!e)return;
    if(this.asking){e.timer=setTimeout(()=>Engine.onSlow(id,type),20000);return}
    this.asking=true;
    let c;try{c=await Dialog.choose('This is taking a long time','The last action is still running.',[{id:'wait',label:'Keep waiting',kind:'secondary'},{id:'stop',label:'Stop it',kind:'danger'}])}finally{this.asking=false}
    const cur=this.pending.get(id);if(!cur)return;
    if(c==='stop'){await this.restartWorker();return}
    cur.timer=setTimeout(()=>Engine.onSlow(id,type),20000)
  },
  async restartWorker(){
    if(this.mode!=='worker'||this.restarting)return;
    this.restarting=true;
    try{
      try{this.worker.terminate()}catch(e){}
      const stalled=Array.from(this.pending.values());this.pending.clear();
      stalled.forEach(p=>{clearTimeout(p.timer);p.reject(Object.assign(new Error('Stopped.'),{code:'cancelled'}))});
      this.worker=new Worker('js/worker.js');
      this.worker.onmessage=e=>{const d=e.data,p=this.pending.get(d.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(d.id);d.ok?p.resolve(d.result):p.reject(Object.assign(new Error(d.error&&d.error.message||'Engine error'),{code:d.error&&d.error.code}))};
      this.worker.onerror=e=>{if(e&&e.preventDefault)e.preventDefault();this.fallback('worker error')};
      this.recovering=this.replay().catch(()=>{}).then(()=>{this.recovering=null});
      await this.recovering;
      Toast.show('That step took too long and was stopped.')
    }finally{this.restarting=false}
  },
  async direct(type,payload){
    if(this.recovering&&type!=='ping')await this.recovering;
    await sleep(0);
    return W.Engine.handle(type,payload)
  },
  GLOBAL_TYPES:new Set(['ping','setCtx','tableNew','tableUse','tableClose','tableReset','tableList','exportTable','findTables','sample','parseRecipe']),
  call(type,payload,channel){
    if(type!=='issues'&&type!=='ping')this.lastActive=performance.now();
    if(type==='tableReset'){this.active=payload.id;this.loads={};this.readingsBy={}}
    const at=this.active;
    const bound=this.GLOBAL_TYPES.has(type)?null:(payload&&payload.tableId||at);
    const sent=bound?Object.assign({},payload,{tableId:bound}):payload;
    const rd=type==='chooseReading'?(payload.reading||(S.readings[payload.index]?{kind:S.readings[payload.index].kind,params:S.readings[payload.index].params}:null)):null;
    let gen=0;
    if(channel){gen=(this.gens[channel]||0)+1;this.gens[channel]=gen}
    let p=this.mode==='worker'?(this.recovering&&type!=='ping'?this.recovering.then(()=>this.post(type,sent)):this.post(type,sent)):this.direct(type,sent);
    if(bound&&!/^(load|setPipeline|chooseReading|tableUse|pipelineInfo)$/.test(type))p=p.then(r=>{if(bound!==this.active)throw Object.assign(new Error('stale'),{stale:true});return r});
    if(type==='load')p=p.then(r=>{this.lastLoad=payload;this.lastReading=null;this.loads[at]=payload;this.readingsBy[at]=null;S.refsRaw=S.refsRaw||[];return r});
    else if(type==='stageStress')p=p.then(r=>{const L={__stress:payload.n};this.lastLoad=L;this.lastReading=null;this.loads[at]=L;this.readingsBy[at]=null;return r});
    else if(type==='chooseReading')p=p.then(r=>{this.lastReading=rd;this.readingsBy[at]=rd;return r});
    else if(type==='refLoad')p=p.then(r=>{S.refsRaw=(S.refsRaw||[]).filter(x=>!(payload.replace&&x.name===payload.name)).concat([payload]);return r});
    else if(type==='refRemove')p=p.then(r=>{S.refsRaw=(S.refsRaw||[]).filter(x=>x.name!==payload.name);return r});
    if(type==='tableNew'||type==='tableUse')p=p.then(r=>{this.active=payload.id;return r});
    else if(type==='tableClose')p=p.then(r=>{this.active=r.active;delete this.loads[payload.id];delete this.readingsBy[payload.id];return r});
    if(!channel)return p;
    return p.then(r=>{if(this.gens[channel]!==gen)throw Object.assign(new Error('stale'),{stale:true});return r})
  }
};
try{Engine.init()}catch(e){}
const Busy={
  n:0,label:'',t:null,
  async run(label,fn){
    this.n++;this.label=label;
    const pp=$('#pageProgress');if(pp&&$('#workspace').classList.contains('hidden'))pp.classList.remove('hidden');
    if(!this.t)this.t=setTimeout(()=>{if(this.n>0){$('#progress').classList.remove('hidden');Status.work(this.label)}},300);
    try{return await fn()}
    finally{this.n--;if(this.n<=0){this.n=0;clearTimeout(this.t);this.t=null;$('#progress').classList.add('hidden');Status.work(null);const pp=$('#pageProgress');if(pp&&Engine.ready_)pp.classList.add('hidden')}}
  }
};
