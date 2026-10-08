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
    onChange:null
  };
})();
