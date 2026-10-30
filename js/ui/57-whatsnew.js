'use strict';
const WHATS_NEW_ID='3.0';
const WhatsNew={
  items:[
    {id:'query',title:'Weft Query',text:'Type column:value, comparisons and AND, OR or NOT straight into the search box.',example:'status:paid amount_usd>500'},
    {id:'filters',title:'Column filters',text:'Click the funnel on any column header to pick values or set a number or date range.',example:'Opens the filter for the status column'},
    {id:'replace',title:'Find and Replace',text:'See every change before it becomes a step, with patterns if you want them.',example:'pending → awaiting payment'},
    {id:'formulas',title:'Formulas',text:'Add a column from an Excel-style formula, or start a search with = to compare columns.',example:'ROUND([amount_usd] * 0.92, 2)'}
  ],
  pending(){return Tips.get('whatsNew')!==WHATS_NEW_ID},
  list(onTry){
    return h('ul',{class:'wn-list'},this.items.map(it=>h('li',{class:'wn-item','data-item':it.id},
      h('div',{class:'wn-title'},it.title),
      h('p',{class:'wn-text'},it.text),
      h('code',{class:'wn-ex'},it.example),
      h('button',{class:'btn btn-xs btn-secondary wn-try',type:'button','data-try':it.id,'aria-label':'Try it: '+it.title,onclick:()=>onTry(it.id)},'Try it'))))
  },
  render(){
    const el=$('#whatsNew');if(!el)return;
    clear(el);
    if(!this.pending()){el.classList.add('hidden');return}
    el.classList.remove('hidden');
    el.append(
      h('div',{class:'wn-head'},h('span',{class:'chip c-add'},'NEW'),h('h2',{},'What’s new in Weft 3.0'),h('span',{class:'grow-1'}),h('button',{class:'btn btn-sm btn-ghost wn-dismiss',type:'button',onclick:()=>this.dismiss()},'Got it')),
      this.list(id=>this.tryIt(id)))
  },
  dismiss(){Tips.set('whatsNew',WHATS_NEW_ID);this.render()},
  openDialog(){
    let d=null;
    const body=h('div',{class:'dlg-body wn-body'},h('p',{class:'dlg-note'},'Each example opens the Orders 2025 sample. If you already have data open, the sample goes into a new tab.'),this.list(id=>{d.close();this.tryIt(id)}));
    d=Dialog.open({title:'What’s new in Weft 3.0',body,wide:true,foot:[h('span',{class:'grow-1'}),h('button',{class:'btn btn-primary',type:'button',onclick:()=>d.close()},'Done')]});
    return d
  },
  async tryIt(id){
    const x=W.makeSample('orders');
    const ok=await Input.loadText(x.text,x.fileName,null,S.loaded?{target:'new'}:undefined);
    if(!ok)return;
    await new Promise(r=>setTimeout(r,250));
    if(id==='query'){
      const el=$('#searchInput');el.focus();el.value='status:paid amount_usd>500';el.dispatchEvent(new Event('input',{bubbles:true}))
    }else if(id==='filters'){
      ColFilter.openFor('status')
    }else if(id==='replace'){
      FindReplace.open({find:'pending',replace:'awaiting payment'})
    }else if(id==='formulas'){
      openStepConfig('formulaColumn',{col:'amount_usd',cfg:{name:'amount_eur_check',expr:'ROUND([amount_usd] * 0.92, 2)',after:'amount_usd'}})
    }
  }
};
