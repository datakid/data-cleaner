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

  test('B9 the file pickers accept every spreadsheet format the README lists',()=>{
    const x=new XMLHttpRequest();x.open('GET','index.html',false);x.send();
    ok(!!x.responseText,'index.html could not be read; serve the folder over http as the README describes');
    const doc=new DOMParser().parseFromString(x.responseText,'text/html');
    const acc=id=>(doc.getElementById(id).getAttribute('accept')||'').split(',');
    const sheets=['.xlsx','.xlsm','.xlsb','.xls','.ods'];
    const gone=(id)=>sheets.filter(e=>acc(id).indexOf(e)===-1);
    eq(gone('fileInput'),[]);
    eq(gone('refInput'),[])
  });

  test('E every export format writes the right contents for each header and column choice',()=>{
    const src='id,name,note\n01,"Ann, A.","line1\nline2"\n2,Bob,"say ""hi"""\n3,Zoë,a|b\n4,,=1+1';
    const grid=W.parseDelimited(src,',','"');
    const bad=[];
    for(const colSet of [null,['name','id'],['note']]){
      for(const header of [true,false]){
        fresh(src);
        const names=colSet||grid[0];
        const idx=names.map(n=>grid[0].indexOf(n));
        const body=grid.slice(1).map(r=>idx.map(i=>r[i]));
        const run=(fmt,extra)=>E.handle('export',{scope:'final',format:fmt,columns:colSet,options:Object.assign({header},extra||{})});
        const tag=(fmt,why)=>bad.push(fmt+' header='+header+' cols='+(colSet||'all')+': '+why);
        const asObjects=()=>body.map(r=>{const o={};names.forEach((n,k)=>{o[n]=r[k]});return o});
        for(const [fmt,d] of [['csv',','],['tsv','\t']]){
          const x=run(fmt);const back=W.parseDelimited(x.text,d,'"');
          const want=(header?[names]:[]).concat(body);
          if(JSON.stringify(back)!==JSON.stringify(want))tag(fmt,'round trip differs');
          if(x.rows!==body.length||x.cols!==names.length)tag(fmt,'counts '+x.rows+'x'+x.cols)
        }
        {
          const x=run('csv',{excel:true});
          if(x.text.charCodeAt(0)!==0xFEFF||x.text.indexOf('\r\n')===-1)tag('csv excel','BOM or CRLF missing')
        }
        {
          const on=run('csv',{formulaGuard:true});
          if(names.indexOf('note')!==-1&&on.text.indexOf("'=1+1")===-1)tag('csv guard','formula not protected');
          const off=run('csv',{formulaGuard:false});
          if(off.text.indexOf("'=")!==-1)tag('csv guard off','apostrophe added')
        }
        if(JSON.stringify(JSON.parse(run('json').text))!==JSON.stringify(asObjects()))tag('json','records differ');
        {
          const want={};names.forEach((n,k)=>{want[n]=body.map(r=>r[k])});
          if(JSON.stringify(JSON.parse(run('jsoncols').text))!==JSON.stringify(want))tag('jsoncols','columns differ')
        }
        {
          const lines=run('ndjson').text.split('\n').filter(Boolean).map(l=>JSON.parse(l));
          if(JSON.stringify(lines)!==JSON.stringify(asObjects()))tag('ndjson','lines differ')
        }
        {
          const md=run('md').text.split('\n').filter(Boolean);
          if(md.length!==body.length+2||!/^\| /.test(md[0])||!/^\|( --- \|)+$/.test(md[1]))tag('md','header or row count wrong: '+md.length)
        }
        {
          const x=run('lines');
          if(x.rows!==body.length)tag('lines','row count');
          if(names.length>1&&header&&x.text.indexOf(names.join(' '))!==0)tag('lines','header missing')
        }
        {
          const x=JSON.parse(run('xlsx').text);
          if(x.header!==header||x.rows.length!==body.length||x.cols.join()!==names.join())tag('xlsx','payload differs')
        }
      }
    }
    eq(bad,[])
  });
})
})(typeof self!=='undefined'?self:globalThis);
