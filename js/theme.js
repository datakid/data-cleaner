(function(){
  try{
    var p=JSON.parse(localStorage.getItem('weft.prefs.v1')||'{}');
    var q=location.search.match(/[?&]theme=(light|dark)/);
    var t=q?q[1]:p.theme;
    if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);
    if(p.density)document.documentElement.setAttribute('data-density',p.density);
  }catch(e){}
})();
