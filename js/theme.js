(function(){
  var root=document.documentElement;
  var BG={light:'#F5F2EA',dark:'#1F1E1C'};
  function read(){try{return JSON.parse(localStorage.getItem('weft.prefs.v1')||'{}')}catch(e){return{}}}
  function mq(){return window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null}
  function effective(choice){if(choice==='light'||choice==='dark')return choice;var m=mq();return m&&m.matches?'dark':'light'}
  function apply(choice){
    choice=choice==='light'||choice==='dark'?choice:'system';
    if(choice==='system')root.removeAttribute('data-theme');else root.setAttribute('data-theme',choice);
    var eff=effective(choice);
    root.setAttribute('data-theme-choice',choice);
    root.style.colorScheme=eff;
    var metas=document.querySelectorAll('meta[name="theme-color"]');
    for(var i=0;i<metas.length;i++){if(choice==='system'){metas[i].setAttribute('content',metas[i].getAttribute('data-'+(metas[i].media.indexOf('dark')!==-1?'dark':'light'))||metas[i].content)}else metas[i].setAttribute('content',BG[eff])}
    return eff
  }
  var p=read();
  var q=location.search.match(/[?&]theme=(light|dark|system)/);
  apply(q?q[1]:p.theme);
  if(p.density)root.setAttribute('data-density',p.density);
  var cq=window.matchMedia?matchMedia('(prefers-contrast: more)'):null;
  function applyContrast(c){c=c==='high'||c==='normal'?c:'system';var on=c==='high'||(c==='system'&&cq&&cq.matches);if(on)root.setAttribute('data-contrast','high');else root.removeAttribute('data-contrast');root.setAttribute('data-contrast-choice',c);return on}
  var cqs=location.search.match(/[?&]contrast=(high|normal)/);
  applyContrast(cqs?cqs[1]:p.contrast);
  if(cq){var onc=function(){if(root.getAttribute('data-contrast-choice')==='system')applyContrast('system')};if(cq.addEventListener)cq.addEventListener('change',onc);else if(cq.addListener)cq.addListener(onc)}
  var m=mq();
  if(m){var on=function(){if((root.getAttribute('data-theme-choice')||'system')==='system'){root.classList.add('theme-switching');apply('system');setTimeout(function(){root.classList.remove('theme-switching')},320);if(window.WeftTheme&&WeftTheme.onChange)WeftTheme.onChange()}};if(m.addEventListener)m.addEventListener('change',on);else if(m.addListener)m.addListener(on)}
  window.WeftTheme={
    apply:apply,effective:effective,
    choice:function(){return root.getAttribute('data-theme-choice')||'system'},
    set:function(choice){
      root.classList.add('theme-switching');
      var eff=apply(choice);
      var d=read();d.theme=choice;try{localStorage.setItem('weft.prefs.v1',JSON.stringify(d))}catch(e){}
      clearTimeout(this._t);this._t=setTimeout(function(){root.classList.remove('theme-switching')},320);
      if(this.onChange)this.onChange();
      return eff
    },
    contrast:function(){return root.getAttribute('data-contrast-choice')||'system'},
    highContrast:function(){return root.getAttribute('data-contrast')==='high'},
    setContrast:function(c){root.classList.add('theme-switching');var on=applyContrast(c);var d=read();d.contrast=c;try{localStorage.setItem('weft.prefs.v1',JSON.stringify(d))}catch(e){}clearTimeout(this._t);this._t=setTimeout(function(){root.classList.remove('theme-switching')},320);return on},
    onChange:null
  };
})();
