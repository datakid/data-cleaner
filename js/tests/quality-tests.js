(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const E=W.Engine;
  const fresh=text=>{E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy'});return E.handle('load',{text})};
  const utf8=s=>new TextEncoder().encode(s).length;
  const guarded=(cell,opts)=>W.toDelimited(null,[[cell]],'\t',Object.assign({formulaGuard:true},opts||{}));

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

  test('B5 the formula guard leaves a European negative number alone',()=>{
    eq(guarded('-1.234,56'),'-1.234,56');
    eq(guarded('-1,5'),'-1,5');
    eq(guarded('-2.000,00'),'-2.000,00')
  });
  test('B5 the formula guard still leaves US numbers alone',()=>{
    eq(guarded('-5'),'-5');
    eq(guarded('-1,234.56'),'-1,234.56');
    eq(guarded('-0.5'),'-0.5')
  });
  test('B5 the formula guard still protects real formulas',()=>{
    eq(guarded('=SUM(A1:A2)'),"'=SUM(A1:A2)");
    eq(guarded('@cmd'),"'@cmd");
    eq(guarded('-'),"'-");
    eq(guarded('-1+2'),"'-1+2");
    eq(guarded('+cmd|x'),"'+cmd|x");
    eq(guarded('+1 555'),'+1 555')
  });
  test('B5 a European negative survives a CSV export untouched',()=>{
    fresh('item;amount\nA;-1.234,56\nB;-2.345,00');
    const x=E.handle('export',{scope:'final',format:'tsv',options:{header:true,formulaGuard:true}});
    ok(x.text.indexOf("'")===-1,x.text);
    eq(x.text,'item\tamount\nA\t-1.234,56\nB\t-2.345,00\n')
  });
})
})(typeof self!=='undefined'?self:globalThis);
