(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const E=W.Engine;
  const fresh=text=>{E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy'});return E.handle('load',{text})};
  const utf8=s=>new TextEncoder().encode(s).length;

  test('B4 the reported export size counts bytes, not characters',()=>{
    fresh('name,city\nJosé,Zürich\nÅsa,Tōkyō\nAda,Cairo');
    const x=E.handle('export',{scope:'final',format:'csv',options:{header:true}});
    ok(x.text.length<utf8(x.text),'fixture needs multi-byte characters');
    eq(x.bytes,utf8(x.text))
  });
  test('B4 the reported size counts emoji as four bytes',()=>{
    fresh('a\n😀\nplain');
    const x=E.handle('export',{scope:'final',format:'csv',options:{header:true}});
    eq(x.bytes,utf8(x.text))
  });
  test('B4 the reported size treats a lone surrogate like the encoder does',()=>{
    fresh('a\nx\uD83Dy\nz\uDE00');
    const x=E.handle('export',{scope:'final',format:'csv',options:{header:true}});
    eq(x.bytes,utf8(x.text))
  });
  test('B4 the reported size of plain ASCII is unchanged',()=>{
    fresh('a,b\n1,2\n3,4');
    const x=E.handle('export',{scope:'final',format:'csv',options:{header:true}});
    eq(x.bytes,x.text.length)
  });

})
})(typeof self!=='undefined'?self:globalThis);
