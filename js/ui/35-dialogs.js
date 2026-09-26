'use strict';
const Dialog={
  n:0,
  open(o){
    const id='dlg'+(++this.n);
    const prevFocus=document.activeElement;
    const scrim=h('div',{class:'scrim'});
    const title=h('h2',{id:id+'t',text:o.title||''});
    const box=h('div',{class:'dialog'+(o.wide?' wide':'')+(o.cls?' '+o.cls:''),role:'dialog','aria-modal':'true','aria-labelledby':id+'t',tabindex:'-1'},
      h('div',{class:'dlg-head'},title,h('button',{class:'icon-btn',type:'button','aria-label':'Close',onclick:()=>api.close()},icon('close'))),
      o.body||h('div',{class:'dlg-body'}),
      o.foot?h('div',{class:'dlg-foot'},o.foot):null);
    scrim.addEventListener('mousedown',()=>api.close());
    document.body.append(scrim,box);
    const trap=e=>{if(e.key!=='Tab')return;const f=$$('button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"],a[href]',box).filter(x=>x.offsetParent!==null);if(!f.length)return;const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}};
    box.addEventListener('keydown',trap);
    let closed=false;
    const api={el:box,body:box.querySelector('.dlg-body'),close(silent){if(closed)return;closed=true;Layers.pop(id);scrim.remove();box.remove();if(prevFocus&&prevFocus.focus&&document.contains(prevFocus))prevFocus.focus({preventScroll:true});if(!silent&&o.onClose)o.onClose()}};
    Layers.push(id,()=>api.close());
    setTimeout(()=>{if(!box.contains(document.activeElement)){const f=box.querySelector(o.focus||'.dlg-body input,.dlg-body select,.dlg-body textarea,.dlg-foot .btn-primary');(f||box).focus()}},20);
    return api
  },
  confirm(title,msg,okLabel,danger){
    return new Promise(res=>{
      const d=Dialog.open({title,body:h('div',{class:'dlg-body'},h('p',{class:'dlg-note'},msg)),foot:[h('span',{class:'grow-1'}),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>{d.close(true);res(false)}},'Cancel'),h('button',{class:'btn '+(danger?'btn-danger':'btn-primary'),type:'button',onclick:()=>{d.close(true);res(true)}},okLabel||'Continue')],onClose:()=>res(false),focus:'.dlg-foot .btn:last-child'})
    })
  },
  prompt(title,label,value,okLabel){
    return new Promise(res=>{
      const inp=h('input',{class:'input',value:value||'',style:{width:'100%'}});
      const go=()=>{const v=inp.value.trim();if(!v)return;d.close(true);res(v)};
      inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go()}});
      const d=Dialog.open({title,body:h('div',{class:'dlg-body'},h('div',{class:'field'},h('label',{},label),inp)),foot:[h('span',{class:'grow-1'}),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>{d.close(true);res(null)}},'Cancel'),h('button',{class:'btn btn-primary',type:'button',onclick:go},okLabel||'Save')],onClose:()=>res(null)});
      setTimeout(()=>{inp.focus();inp.select()},30)
    })
  }
};
