(function(G){
'use strict';
(G.WEFT_TEST_MODULES=G.WEFT_TEST_MODULES||[]).push(function(T){
  const {test,eq,ok,W}=T;
  const E=W.Engine;
  const run=(expr,cols,row,opts)=>W.F.compile(expr,cols||[],opts).fn(row||[]);
  const EXPRS=[];
  const table=(rows,cols,row,opts)=>{
    rows.forEach(r=>{
      const expr=r[0],want=r[1];
      EXPRS.push(expr);
      test('formula '+expr+' gives '+JSON.stringify(want),()=>eq(run(expr,cols,row,opts),want))
    })
  };

  table([
    ['1+2','3'],['2+3*4^2','50'],['-2^2','4'],['2^-2','0.25'],['2^3^2','64'],['(1+2)*3','9'],['10/4','2.5'],['7-10','-3'],
    ['50%','0.5'],['200*10%','20'],['-(3)','-3'],['+5','5'],['1e3+1','1001'],['.5+.25','0.75'],['0.1+0.2','0.3'],['0.1*3','0.3'],
    ['1/3','0.333333333333'],['2/3*3','2'],['10^21','1000000000000000000000'],['10^-7','0.0000001'],['123456789012*10','1234567890120'],
    ['=1+2','3'],['  7 ','7'],['--3','3'],['5-3-1','1'],['2*3+4*5','26'],['100/10/5','2']
  ]);
  table([
    ['1/0','#DIV/0!'],['0/0','#DIV/0!'],['0^0','#NUM!'],['0^-1','#DIV/0!'],['(-8)^(1/3)','#NUM!'],['10^400','#NUM!'],['MOD(5,0)','#DIV/0!'],
    ['[Missing]','#REF!'],['FOO()','#NAME?'],['"a"+1','#VALUE!'],['foo','#NAME?'],['IFERROR(1/0,"x")','x'],['IFERROR([Missing],"gone")','gone'],
    ['IFERROR(1,2)','1'],['ISBLANK(1/0)','FALSE'],['ISNUMBER(1/0)','FALSE'],['-"a"','#VALUE!'],['"a"*2','#VALUE!'],['IFERROR(FOO(),"n")','n']
  ]);
  table([
    ['"a"&1+2','a3'],['1+2&"x"','3x'],['1&2=12','TRUE'],['1<2','TRUE'],['2<>2','FALSE'],['"a"="A"','TRUE'],['"a"<"b"','TRUE'],['"b"<"a"','FALSE'],
    ['1="1"','TRUE'],['TRUE+1','2'],['TRUE&"x"','TRUEx'],['NOT(TRUE)','FALSE'],['2>=2','TRUE'],['2<=1','FALSE'],['"abc"&"def"&1','abcdef1'],
    ['1<"a"','TRUE'],['"a"<TRUE','TRUE'],['""=""','TRUE'],['"é"="É"','TRUE'],['"a"&""&"b"','ab'],['"say ""hi"""','say "hi"']
  ]);
  table([
    ['IF(TRUE,1,2)','1'],['IF(FALSE,1)','FALSE'],['IF(1>2,"a")','FALSE'],['IF("x",1,2)','#VALUE!'],['IF("",1,2)','2'],['IF(TRUE,1,1/0)','1'],['IF(FALSE,1/0,2)','2'],
    ['IFS(1>2,"a",2>1,"b")','b'],['IFS(1>2,"a")','#N/A'],['AND(TRUE,1,"true")','TRUE'],['AND(TRUE,FALSE)','FALSE'],['OR(FALSE,0)','FALSE'],['OR(FALSE,1)','TRUE'],
    ['NOT(0)','TRUE'],['COALESCE("","  ","x","y")','x'],['COALESCE("","")',''],['COALESCE(0,5)','0'],['ISNUMBER("12")','TRUE'],['ISNUMBER("abc")','FALSE'],
    ['ISNUMBER("")','FALSE'],['ISNUMBER(TRUE)','FALSE'],['ISBLANK("  ")','TRUE'],['ISBLANK(0)','FALSE'],['AND(1>2,1/0>1)','FALSE'],['OR(1<2,1/0>1)','TRUE']
  ]);
  table([
    ['LEN("héllo")','5'],['LEN("😀")','1'],['LEN("")','0'],['LEFT("abcdef",2)','ab'],['LEFT("abc")','a'],['LEFT("abc",10)','abc'],['LEFT("abc",-1)','#VALUE!'],
    ['RIGHT("abcdef",2)','ef'],['RIGHT("abc",0)',''],['RIGHT("abc",5)','abc'],['MID("abcdef",2,3)','bcd'],['MID("abc",0,1)','#VALUE!'],['MID("abc",5,2)',''],
    ['LEFT("😀ab",2)','😀a'],['RIGHT("ab😀",1)','😀'],['MID("a😀bc",2,2)','😀b'],['UPPER("aé")','AÉ'],['LOWER("ABC")','abc'],['PROPER("hello WORLD")','Hello World'],
    ['PROPER("it\'s")','It\'S'],['TRIM("  a   b  ")','a b'],['CONCAT("a",1,TRUE)','a1TRUE'],['TEXTJOIN("-",TRUE,"a","","b")','a-b'],['TEXTJOIN("-",FALSE,"a","","b")','a--b'],
    ['SUBSTITUTE("a-b-c","-","+")','a+b+c'],['SUBSTITUTE("a-b-c","-","+",2)','a-b+c'],['SUBSTITUTE("abc","","x")','abc'],['SUBSTITUTE("a-b","-","+",5)','a-b'],
    ['REPLACE("abcdef",2,3,"X")','aXef'],['REPLACE("abc",9,1,"X")','abcX'],['FIND("b","abcb")','2'],['FIND("b","abcb",3)','4'],['FIND("B","abc")','#VALUE!'],
    ['SEARCH("B","abc")','2'],['FIND("😀","a😀b")','2'],['FIND("","abc")','1'],['CONTAINS("Hello","ELL")','TRUE'],['STARTSWITH("Hello","he")','TRUE'],
    ['ENDSWITH("Hello","LO")','TRUE'],['ENDSWITH("a","abc")','FALSE'],['CONTAINS("abc","")','TRUE']
  ]);
  table([
    ['VALUE("1,234.5")','1234.5'],['VALUE("5%")','0.05'],['VALUE("abc")','#VALUE!'],['VALUE("")','#VALUE!'],['VALUE("(12)")','-12'],['VALUE("2025-01-01")','45658'],['VALUE(7)','7'],
    ['TEXT(1234.5,"#,##0.00")','1,234.50'],['TEXT(0.256,"0.0%")','25.6%'],['TEXT(5,"000")','005'],['TEXT(1234.567,"0.00")','1234.57'],['TEXT(-5,"$0.00")','-$5.00'],
    ['TEXT(DATE(2025,3,5),"yyyy-mm-dd")','2025-03-05'],['TEXT(DATE(2025,3,5),"mmm d, yyyy")','Mar 5, 2025'],['TEXT(DATE(2025,3,5),"dddd")','Wednesday'],
    ['TEXT("2025-03-05","dd/mm/yy")','05/03/25'],['TEXT("abc","0.0")','abc'],['TEXT(1,"abc")','#VALUE!'],['TEXT(0,"#")',''],['TEXT(0.5,"#.##")','.5'],
    ['TEXT(1234,"#,##0")','1,234'],['TEXT(12,"0 \\u")','12 u'],['TEXT(12,"0 ""kg""")','12 kg'],['TEXT(-0.001,"0.00")','0.00'],['TEXT(2.5,"0")','3'],
    ['TEXT("","0.00")','']
  ]);
  table([
    ['ROUND(2.5,0)','3'],['ROUND(-2.5,0)','-3'],['ROUND(1.005,2)','1.01'],['ROUND(1234.567,-2)','1200'],['ROUND(2.345,2)','2.35'],['ROUND(7)','7'],
    ['ROUNDUP(2.1,0)','3'],['ROUNDUP(-2.1,0)','-3'],['ROUNDDOWN(2.9,0)','2'],['ROUNDDOWN(-2.9,0)','-2'],['ROUNDUP(3.14159,2)','3.15'],['ROUNDDOWN(3.14159,3)','3.141'],
    ['ABS(-4)','4'],['ABS("-4.5")','4.5'],['INT(-1.5)','-2'],['INT(1.9)','1'],['MOD(7,3)','1'],['MOD(-7,3)','2'],['MOD(7,-3)','-2'],
    ['SUM(1,2,3)','6'],['SUM("1","2")','3'],['SUM("a")','#VALUE!'],['AVERAGE(1,2,6)','3'],['MIN(3,1,2)','1'],['MAX(3,1,2)','3'],['SUM(0.1,0.2)','0.3']
  ]);
  table([
    ['DATE(2025,1,31)','2025-01-31'],['DATE(2025,13,1)','2026-01-01'],['DATE(2025,3,0)','2025-02-28'],['DATE(2024,2,29)','2024-02-29'],['YEAR(DATE(2025,3,5))','2025'],
    ['MONTH("2025-03-05")','3'],['DAY("Mar 5, 2025")','5'],['WEEKDAY(DATE(2025,3,5))','4'],['WEEKDAY(DATE(2025,3,5),2)','3'],['WEEKDAY(DATE(2025,3,2),3)','6'],
    ['WEEKDAY(DATE(2025,3,5),9)','#NUM!'],['YEAR("nope")','#VALUE!'],['EDATE(DATE(2025,1,31),1)','2025-02-28'],['EDATE(DATE(2025,3,15),-3)','2024-12-15'],
    ['EDATE("2025-01-31",13)','2026-02-28'],['DATEDIF("2020-01-15","2025-03-10","Y")','5'],['DATEDIF("2020-01-15","2025-03-10","M")','61'],
    ['DATEDIF("2020-01-15","2025-03-10","D")',String(Math.round((Date.UTC(2025,2,10)-Date.UTC(2020,0,15))/86400000))],['DATEDIF("2020-01-15","2025-03-10","YM")','1'],
    ['DATEDIF("2020-01-15","2025-03-10","MD")','23'],['DATEDIF("2020-01-15","2025-03-10","YD")','54'],['DATEDIF("2025-03-10","2020-01-15","Y")','#NUM!'],
    ['DATEDIF("2020-01-15","2025-03-10","X")','#NUM!'],['DATE(2025,1,31)+1','2025-02-01'],['"2025-01-31"+1','2025-02-01'],['1+"2025-01-31"','2025-02-01'],
    ['DATE(2025,3,1)-DATE(2025,2,1)','28'],['"2025-03-01"-"2025-02-01"','28'],['DATE(2025,3,1)-1','2025-02-28'],['1-DATE(2025,3,1)','#VALUE!'],
    ['DATE(2025,1,1)+DATE(2025,1,1)','#VALUE!'],['DATE(2025,1,31)&""','2025-01-31'],['DATE(2025,1,31)>DATE(2025,1,1)','TRUE'],['"2025-01-31"="2025-1-31"','TRUE'],
    ['YEAR(45658)','2025'],['DATE(10000,1,1)','#NUM!']
  ]);
  table([
    ['REGEXMATCH("abc123","\\d+")','TRUE'],['REGEXMATCH("ABC","abc")','FALSE'],['REGEXMATCH("ABC","abc","i")','TRUE'],['REGEXMATCH("a","a","x")','#VALUE!'],
    ['REGEXEXTRACT("order 123 x","(\\d+)")','123'],['REGEXEXTRACT("abc","\\d")','#N/A'],['REGEXEXTRACT("a1b22","\\d+")','1'],['REGEXREPLACE("a1b22","\\d+","#")','a#b#'],
    ['REGEXREPLACE("john smith","(\\w+) (\\w+)","$2, $1")','smith, john'],['REGEXREPLACE("AaA","a","x","i")','xxx'],['REGEXMATCH("aaaa","(a+)+$")','#VALUE!'],['REGEXMATCH("a","(")','#VALUE!']
  ]);

  const COLS=['Qty','Price','Order Total','order_id'];
  const ROW=['2','3.5','$1,200.50','A1'];
  table([
    ['[Qty]*[Price]','7'],['Qty*Price','7'],['qty*price','7'],['[order total]+1','1201.5'],['[Order_ID]','A1'],['[Order Total]*2','2401'],
    ['order_id&"-"&Qty','A1-2'],['[ qty ]','2'],['SUM([Qty],[Price],1)','6.5'],['UPPER([order_id])','A1'],['[Qty]>[Price]','FALSE'],['[Order Total]>1000','TRUE']
  ],COLS,ROW);
  table([['[OR]','x'],['[and]&"!"','y!']],['OR','and'],['x','y']);
  table([['[p]*2','2469'],['[p]+0','1234.5'],['[p]>1000','TRUE'],['SUM([p],1)','1235.5']],['p'],['1.234,50'],{locale:()=>'eu'});
  table([['[Qty]+1','1'],['ISBLANK([Qty])','TRUE'],['[Qty]=""','TRUE'],['[Qty]=0','FALSE'],['[Qty]>0','FALSE'],['[Qty]<5','FALSE'],['[Qty]<>5','TRUE'],['LEN([Qty])','0'],['[Qty]*3','0'],['[Qty]&"x"','x']],['Qty'],['']);
  table([['[a]>[b]','TRUE'],['[a]<[b]','FALSE'],['[a]=[b]','FALSE']],['a','b'],['1,200','900']);
  table([['[a]>[b]','TRUE']],['a','b'],['10','9']);
  table([['[a]<[b]','TRUE']],['a','b'],['abc','abd']);
  table([['[a]>[b]','TRUE'],['[a]-[b]','14']],['a','b'],['2025-03-01','2025-02-15']);
  table([['[a]<[b]','TRUE']],['a','b'],['01/02/2025','03/01/2025'],{dateOrder:'mdy'});
  table([['[a]<[b]','FALSE']],['a','b'],['01/02/2025','03/01/2025'],{dateOrder:'dmy'});
  table([['SUM([a],[b],[c])','5'],['AVERAGE([a],[b],[c])','5'],['AVERAGE([b],[c])','#DIV/0!'],['MAX([b],[c])','0'],['MIN([a],10)','5'],['SUM([a],"")','5']],['a','b','c'],['5','','n/a']);
  table([['COALESCE([a],[b])','z'],['IF(ISBLANK([a]),"none",[a])','none'],['[a]&[b]','z']],['a','b'],['','z']);

  test('formula table has at least 80 cases',()=>{ok(EXPRS.length>=80,String(EXPRS.length))});
  test('every function appears in at least one formula test',()=>{
    const all=EXPRS.join('\n').toUpperCase();
    const missing=W.F.NAMES.filter(n=>all.indexOf(n+'(')===-1);
    eq(missing,[])
  });
  test('the function table lists the 48 functions of the brief',()=>{
    const want='IF IFS IFERROR AND OR NOT ISBLANK ISNUMBER COALESCE LEN LEFT RIGHT MID UPPER LOWER PROPER TRIM CONCAT TEXTJOIN SUBSTITUTE REPLACE FIND SEARCH CONTAINS STARTSWITH ENDSWITH VALUE TEXT ROUND ROUNDUP ROUNDDOWN ABS MIN MAX SUM AVERAGE MOD INT DATE YEAR MONTH DAY WEEKDAY DATEDIF EDATE REGEXMATCH REGEXEXTRACT REGEXREPLACE'.split(' ').sort();
    eq(W.F.NAMES,want)
  });
  test('function names are case-insensitive',()=>{eq(run('if(true,upper("a"),"b")'),'A');eq(run('Round(2.5)'),'3')});

  test('unknown function reports its name and position',()=>{
    const c=W.F.compile('1 + FOO()',[]);
    eq(c.errors.length,1);eq(c.errors[0].pos,4);eq(c.errors[0].message,'Unknown function FOO at position 5.');eq(c.errors[0].code,'#NAME?');eq(c.fn([]),'#NAME?')
  });
  test('TODAY and NOW are refused with the reason',()=>{
    for(const f of['TODAY()','NOW()','RAND()','RANDBETWEEN(1,2)']){
      const c=W.F.compile('1+'+f,[]);
      eq(c.errors.length,1,f);ok(/same result every time/.test(c.errors[0].message),c.errors[0].message);eq(c.errors[0].pos,2)
    }
  });
  test('wrong argument counts are compile errors that say what is needed',()=>{
    ok(/IF needs 2 to 3 values, but has 1/.test(W.F.compile('IF(1)',[]).errors[0].message));
    ok(/LEN needs 1 value, but has 0/.test(W.F.compile('LEN()',[]).errors[0].message));
    ok(/SUM needs at least 1 value/.test(W.F.compile('SUM()',[]).errors[0].message));
    ok(/IFS needs pairs/.test(W.F.compile('IFS(1,2,3)',[]).errors[0].message))
  });
  const SYNTAX=[['1+',1],['(1',0],['1 2',2],['"abc',0],['[abc',0],['IF(1,2',0],['',0],['=',0],['1 @ 2',2],['[]',0],['1)',1],['IF(1,,2)',5],['1 +* 2',3],['AND',0],['and+1',0]];
  SYNTAX.forEach(([src,pos])=>{
    test('syntax error for '+JSON.stringify(src)+' has a message and a caret',()=>{
      const c=W.F.compile(src,[]);
      eq(c.errors.length,1,JSON.stringify(c.errors));
      ok(c.errors[0].message.length>5);
      eq(c.errors[0].pos,pos,c.errors[0].message);
      ok(c.fn([]).charAt(0)==='#')
    })
  });
  test('a bare unknown name says to use brackets',()=>{
    const c=W.F.compile('Total*2',['A']);
    eq(c.errors.length,1);ok(/\[square brackets\]/.test(c.errors[0].message));eq(c.fn(['1']),'#NAME?')
  });
  test('missing bracketed columns are listed once and give #REF!',()=>{
    const c=W.F.compile('[Nope]+[Nope]+[A]',['A']);
    eq(c.missing,['Nope']);eq(c.errors,[]);eq(c.refs,['A']);eq(c.fn(['1']),'#REF!')
  });
  test('refs lists resolved column names once in order of use',()=>{
    eq(W.F.compile('[b]+a+[B]',['a','b']).refs,['b','a'])
  });

  test('security: prototype names are unknown, never looked up on objects',()=>{
    for(const n of['constructor','__proto__','toString','valueOf','hasOwnProperty','prototype','alert']){
      eq(run(n),'#NAME?',n);
      eq(run(n+'()'),'#NAME?',n+'()');
      eq(run(n+'(1,2)'),'#NAME?')
    }
    eq(run('[constructor]'),'#REF!');eq(run('[__proto__]'),'#REF!')
  });
  test('security: a column called __proto__ or constructor is just a column',()=>{
    eq(run('[__proto__]',['__proto__'],['ok']),'ok');
    eq(run('__proto__&"!"',['__proto__'],['ok']),'ok!');
    eq(run('[constructor]&[toString]',['constructor','toString'],['a','b']),'ab');
    ok(!('polluted' in {}));ok(Object.getPrototypeOf({})===Object.prototype);ok(!Object.prototype.hasOwnProperty('ok'))
  });
  test('security: the function table has no prototype',()=>{
    eq(W.F.arity('constructor'),null);eq(W.F.arity('__proto__'),null);eq(W.F.arity('toString'),null);ok(W.F.arity('sum')!==null)
  });
  test('security: no eval or Function in the compiled output',()=>{
    const bad=['Function("return 1")()','ev'+'al("1")','this','globalThis','window','process','require("fs")'];
    for(const b of bad){const c=W.F.compile(b,[]);ok(c.fn([]).charAt(0)==='#',b)}
  });
  test('limit: formulas over 2,000 characters are refused',()=>{
    const long='1'+'+1'.repeat(1000);
    eq(long.length,2001);
    const c=W.F.compile(long,[]);
    eq(c.errors.length,1);ok(/2,000 characters/.test(c.errors[0].message));ok(c.fn([]).charAt(0)==='#');
    const fine=W.F.compile('1'+'+1'.repeat(999),[]);
    eq(fine.errors,[]);eq(fine.fn([]),'1000')
  });
  test('limit: 65 levels of brackets are refused and 64 are fine',()=>{
    const deep=n=>'('.repeat(n)+'1'+')'.repeat(n);
    const bad=W.F.compile(deep(65),[]);
    eq(bad.errors.length,1);ok(/nested too deeply/.test(bad.errors[0].message));
    eq(W.F.compile(deep(64),[]).fn([]),'1')
  });
  test('limit: 65 nested function calls are refused and 64 are fine',()=>{
    const deep=n=>'ABS('.repeat(n)+'1'+')'.repeat(n);
    ok(/nested too deeply/.test(W.F.compile(deep(65),[]).errors[0].message));
    eq(W.F.compile(deep(64),[]).fn([]),'1')
  });
  test('limit: 65 chained minus signs are refused and 64 are fine',()=>{
    ok(/nested too deeply/.test(W.F.compile('-'.repeat(65)+'1',[]).errors[0].message));
    eq(W.F.compile('-'.repeat(64)+'1',[]).fn([]),'1')
  });
  test('regex: an unsafe literal pattern is refused at compile time with a position',()=>{
    const c=W.F.compile('1+REGEXMATCH("aaaa","(a+)+$")',[]);
    eq(c.errors.length,1);ok(/freeze the page/.test(c.errors[0].message));eq(c.errors[0].pos,20)
  });
  test('regex: an unsafe pattern read from a column gives #VALUE! per cell',()=>{
    eq(run('REGEXMATCH("aaaa",[p])',['p'],['(a+)+$']),'#VALUE!');
    eq(run('REGEXMATCH("aaaa",[p])',['p'],['a+$']),'TRUE')
  });
  test('regex: an invalid literal pattern is a compile error',()=>{
    const c=W.F.compile('REGEXEXTRACT("a","[")',[]);
    eq(c.errors.length,1);ok(/not valid/.test(c.errors[0].message))
  });
  test('regex: catastrophic input finishes quickly',()=>{
    const t0=Date.now();
    run('REGEXMATCH([t],"^(a|aa)+$")',['t'],['a'.repeat(5000)+'b']);
    ok(Date.now()-t0<2000,'took '+(Date.now()-t0)+' ms')
  });

  test('refsOf returns bracketed and bare names but not functions, booleans or text',()=>{
    eq(W.F.refsOf('[Qty] * Price + SUM(Tax, [Order Total]) & "[Nope]" & TRUE'),['Qty','Price','Tax','Order Total'])
  });
  test('refsOf copes with broken formulas',()=>{
    eq(W.F.refsOf('[A] + [B] @ [C]'),['A','B']);eq(W.F.refsOf(''),[]);eq(W.F.refsOf('[A'),[])
  });
  test('remap renames only column references and always brackets the new name',()=>{
    eq(W.F.remap('[Qty] * [Price] + Tax',{Qty:'Quantity',Tax:'Tax Rate'}),'[Quantity] * [Price] + [Tax Rate]');
    eq(W.F.remap('"[Qty]" & [Qty] & Qty',{Qty:'Q]x'}),'"[Qty]" & [Q]]x] & [Q]]x]');
    eq(W.F.remap('IF(Qty>1,Qty,0)',{Qty:'N'}),'IF([N]>1,[N],0)');
    eq(W.F.remap('[A]+1',{}),'[A]+1');eq(W.F.remap('SUM(Sum)',{Sum:'S'}),'SUM([S])')
  });
  test('remap ignores dictionary keys that are prototype names',()=>{
    eq(W.F.remap('[toString]+[constructor]',{}),'[toString]+[constructor]')
  });

  const step=(cfg)=>({opId:'formulaColumn',cfg:Object.assign({after:''},cfg),muted:false});
  const tbl=(cols,rows)=>W.tableFromRows(cols,rows);
  const runStep=(t,cfg,ctx)=>W.OPS.formulaColumn.apply(t,Object.assign({after:''},cfg),ctx||{nextRowId:1000});

  test('formulaColumn stats count failed cells and the warning shows three examples',()=>{
    const t=tbl(['n'],[['1'],['0'],['x'],['0'],['y'],['2']]);
    const r=runStep(t,{name:'Inv',expr:'1/[n]'});
    eq(r.stats.failed,4);eq(r.stats.failedLabel,'error');eq(r.stats.addedCols,1);
    eq(r.warning,'4 cells could not be calculated. First: row 2 gives #DIV/0!, row 3 gives #VALUE!, row 4 gives #DIV/0!.');
    eq(W.statsChips(r.stats,6,6).map(c=>c.text),['+1 column','4 errors']);
    eq(W.statsChips({failed:1,failedLabel:'error'},1,1).map(c=>c.text),['1 error']);
    eq(W.statsChips({failed:2},1,1).map(c=>c.text),['2 not converted'])
  });
  test('formulaColumn without errors has no warning',()=>{
    const r=runStep(tbl(['n'],[['1'],['2']]),{name:'D',expr:'[n]*2'});
    eq(r.warning,undefined);eq(r.stats.failed,0)
  });
  test('formulaColumn gives a unique name when the name is taken',()=>{
    const r=runStep(tbl(['a','Total'],[['1','2']]),{name:'Total',expr:'[a]+1'});
    eq(r.table.cols,['a','Total','Total_2'])
  });
  test('formulaColumn inserts after the chosen column and warns when it is missing',()=>{
    const t=tbl(['a','b','c'],[['1','2','3']]);
    eq(runStep(t,{name:'X',expr:'[a]',after:'a'}).table.cols,['a','X','b','c']);
    const r=runStep(t,{name:'X',expr:'[a]',after:'zz'});
    eq(r.table.cols,['a','b','c','X']);ok(/"zz" was not found/.test(r.warning))
  });
  test('formulaColumn refuses bad formulas and unknown columns with a clear message',()=>{
    const t=tbl(['a'],[['1']]);
    let m='';try{runStep(t,{name:'X',expr:'FOO([a])'})}catch(e){m=e.message}
    eq(m,'Unknown function FOO at position 1.');
    try{runStep(t,{name:'X',expr:'[b]+1'})}catch(e){m=e.message}
    ok(/Column "b" not found/.test(m));
    try{runStep(t,{name:' ',expr:'1'})}catch(e){m=e.message}
    eq(m,'Name the new column.');
    try{runStep(t,{name:'X',expr:'1\n+2'})}catch(e){m=e.message}
    eq(m,'A formula must stay on one line.')
  });
  test('formulaColumn validate mirrors apply and uses the shape when given',()=>{
    const v=W.OPS.formulaColumn.validate;
    eq(v({name:'',expr:'1'},{cols:['a']}),'Name the new column.');
    ok(/Enter a formula/.test(v({name:'X',expr:'  '},{cols:['a']})));
    ok(/Column "b" not found/.test(v({name:'X',expr:'[b]'},{cols:['a']})));
    eq(v({name:'X',expr:'[a]'},{cols:['a']}),null);
    eq(v({name:'X',expr:'[a]'},{cols:[{name:'a',type:'text'}]}),null);
    ok(/Column "b" not found/.test(v({name:'X',expr:'[b]'},{cols:[{name:'a',type:'text'}]})));
    eq(v({name:'X',expr:'[b]'},null),null);
    ok(/Unknown function/.test(v({name:'X',expr:'FOO()'},null)))
  });
  test('formulaColumn reads each referenced column with its own number locale',()=>{
    const t=tbl(['eu','us'],[['1.234,50','1,234.50'],['2.000,00','2,000.00'],['3,25','3.25']]);
    const r=runStep(t,{name:'S',expr:'[eu]+[us]'});
    eq(W.tableRows(r.table).map(x=>x[2]),['2469','4000','6.5'])
  });
  test('formulaColumn honours the date order of the context',()=>{
    const t=tbl(['d'],[['01/02/2025']]);
    eq(W.tableRows(runStep(t,{name:'M',expr:'MONTH([d])'},{dateOrder:'mdy',nextRowId:9}).table)[0][1],'1');
    eq(W.tableRows(runStep(t,{name:'M',expr:'MONTH([d])'},{dateOrder:'dmy',nextRowId:9}).table)[0][1],'2')
  });
  test('formulaColumn marks the new column as touched',()=>{
    const r=runStep(tbl(['a'],[['1']]),{name:'N',expr:'1'});
    eq(Array.from(r.touched.keys()),['N'])
  });
  test('formulaColumn runs inside a pipeline and reports its failures on the step',()=>{
    const base=tbl(['n'],[['2'],['0']]);
    const res=W.runPipeline(base,[step({name:'Inv',expr:'1/[n]'})],{});
    const m=res.meta[0];
    eq(m.error,null);ok(/1 cell could not be calculated/.test(m.warning));eq(W.tableRows(res.states[1]),[['2','0.5'],['0','#DIV/0!']]);
    const bad=W.runPipeline(base,[step({name:'Inv',expr:'FOO()'})],{});
    eq(bad.meta[0].error,'Unknown function FOO at position 1.');eq(bad.states[1],bad.states[0])
  });
  test('formulaColumn results chain into later steps',()=>{
    const base=tbl(['a','b'],[['2','3'],['4','5']]);
    const res=W.runPipeline(base,[step({name:'S',expr:'[a]+[b]'}),step({name:'T',expr:'[S]*10'})],{});
    eq(W.tableRows(res.states[2]),[['2','3','5','50'],['4','5','9','90']])
  });
  test('formula output is deterministic across runs and independent of row order',()=>{
    const rows=[];const rnd=W.mulberry32(0xC0FFEE);
    for(let i=0;i<50;i++)rows.push([String((rnd()*100)|0),String((rnd()*10)|0)]);
    const f=t=>W.tableRows(runStep(t,{name:'X',expr:'IF([b]>5,[a]/[b],ROUND([a]*1.15,1))'}).table).map(r=>r[2]);
    const a=f(tbl(['a','b'],rows)),b=f(tbl(['a','b'],rows));
    eq(a,b);
    const rev=f(tbl(['a','b'],rows.slice().reverse())).reverse();
    eq(rev,a)
  });

  test('DSL: add column round trip with and without after',()=>{
    const cfgs=[
      {name:'Total',expr:'[Qty] * [Price]',after:''},
      {name:'Total',expr:'[Qty] * [Price]',after:'Qty'},
      {name:'He said "hi"',expr:'"a ""quoted"" word" & [x]',after:'The "after" col'},
      {name:'Split',expr:'IF(AND([a]>1,[b]<2),"x and y","z")',after:''},
      {name:'日本',expr:'[名前] & "é"',after:''},
      {name:'D',expr:'[a]/[b]/2',after:''}
    ];
    for(const cfg of cfgs){
      const steps=[{opId:'formulaColumn',cfg,muted:false}];
      const text=W.stepsToText(steps,null);
      const back=W.textToSteps(text);
      eq(back.errors,[],text);eq(back.steps,steps,text);eq(W.stepsToText(back.steps,null),text)
    }
  });
  test('DSL: the line is exactly what the brief shows',()=>{
    eq(W.OPS.formulaColumn.toDsl({name:'Total',expr:'[Qty] * [Price]',after:''}),'add column "Total" = [Qty] * [Price]');
    const p=W.parseStepLine('add column "Total" = [Qty] * [Price]');
    eq(p.opId,'formulaColumn');eq(p.cfg,{name:'Total',expr:'[Qty] * [Price]',after:''})
  });
  test('DSL: formulas that use equals signs, slashes and quotes keep their text',()=>{
    const p=W.parseStepLine('add column "Ok" = IF([a]="x", [b]/2, "n/a")');
    eq(p.cfg.expr,'IF([a]="x", [b]/2, "n/a")')
  });
  test('DSL: a recipe with a formula step writes the v3 header and v2 recipes still write v2',()=>{
    const f=[{opId:'formulaColumn',cfg:{name:'X',expr:'1',after:''},muted:false}];
    ok(/^# weft recipe v3\n/.test(W.stepsToText(f,null)));
    ok(/^# weft recipe v3\n/.test(W.stepsToText([{opId:'formulaColumn',cfg:{name:'X',expr:'1',after:''},muted:true}],null)));
    ok(/^# weft recipe v2\n/.test(W.stepsToText([{opId:'trim',cfg:{columns:['*'],collapse:true},muted:false}],null)))
  });
  test('DSL: a bad formula in a recipe is reported on its line and the rest still loads',()=>{
    const r=W.textToSteps('# weft recipe v3\ntrim *\nadd column "X" = FOO(1)\nadd column "Y" = 1+\nadd column "Z" =\nadd column "OK" = 1+1');
    eq(r.steps.map(s=>s.opId),['trim','formulaColumn']);
    eq(r.errors.map(e=>e.line),[3,4,5]);
    ok(/Unknown function FOO/.test(r.errors[0].message));
    ok(/formula after the = sign/.test(r.errors[2].message))
  });
  test('DSL: a muted formula step round trips',()=>{
    const steps=[{opId:'formulaColumn',cfg:{name:'X',expr:'1+1',after:''},muted:true}];
    eq(W.textToSteps(W.stepsToText(steps,null)).steps,steps)
  });

  const F=(expr,extra)=>Object.assign({col:'@formula',op:'formula',expr,caseSensitive:false},extra||{});
  const C=(col,op,value)=>({col,op,value,caseSensitive:false});
  test('formula condition: DSL form from the brief parses and writes back identically',()=>{
    const line='keep rows where formula [Amount] > [Budget]';
    const p=W.parseStepLine(line);
    eq(p.opId,'filterRows');eq(p.cfg,{mode:'keep',match:'all',conditions:[F('[Amount] > [Budget]')]});
    eq(W.OPS.filterRows.toDsl(p.cfg),line)
  });
  test('formula condition: combined with other conditions, groups and not',()=>{
    const lines=[
      'keep rows where formula [Amount] > [Budget] and "status" is "paid"',
      'keep rows where "status" is "paid" or formula [a]/[b] > 2',
      'remove rows where (formula AND([a]>1,[b]<2) or "x" is "y") and not formula [q]="a and b"',
      'keep rows where not formula LEN([n]) = 0',
      'keep rows where (formula [a]/[b] > 2) or "x" is "y"'
    ];
    for(const l of lines){
      const p=W.parseStepLine(l);
      const back=W.OPS.filterRows.toDsl(p.cfg);
      eq(W.parseStepLine(back).cfg,p.cfg,l);
      eq(W.OPS.filterRows.toDsl(W.parseStepLine(back).cfg),back)
    }
  });
  test('formula condition: v3 header and tree round trip through recipe text',()=>{
    const tree={op:'or',children:[{op:'and',children:[F('[a]>[b]'),C('s','equals','x')]},{op:'not',child:F('ISBLANK([c])')}]};
    const steps=[{opId:'filterRows',cfg:W.cfgFromTree('keep',tree),muted:false}];
    const text=W.stepsToText(steps,null);
    ok(/^# weft recipe v3\n/.test(text));
    eq(W.textToSteps(text).steps,steps);
    const flat=[{opId:'filterRows',cfg:{mode:'keep',match:'all',conditions:[F('[a]>1')]},muted:false}];
    ok(/^# weft recipe v3\n/.test(W.stepsToText(flat,null)))
  });
  test('formula condition: a broken formula in a recipe line is an error on that line',()=>{
    const r=W.textToSteps('keep rows where formula [a] > and "s" is "x"\nkeep rows where formula FOO() > 1');
    eq(r.steps.length,0);eq(r.errors.length,2);ok(/not valid/.test(r.errors[0].message))
  });
  test('formula condition: the word formula inside quotes or as a column name is untouched',()=>{
    const p=W.parseStepLine('keep rows where "formula" is "formula x" and "notes" contains "where formula 1"');
    eq(p.cfg.conditions.map(c=>c.col+'|'+c.value),['formula|formula x','notes|where formula 1'])
  });
  test('formula condition: filterRows keeps exactly the rows the formula selects',()=>{
    const t=tbl(['Amount','Budget','s'],[['1,200','1000','a'],['900','1000','b'],['abc','1','c'],['','5','d'],['50','5','e']]);
    const keep=W.OPS.filterRows.apply(t,{mode:'keep',match:'all',conditions:[F('[Amount] > [Budget]')]},{nextRowId:9});
    eq(W.tableRows(keep.table).map(r=>r[2]),['a','c','e']);
    const rem=W.OPS.filterRows.apply(t,{mode:'remove',match:'all',conditions:[F('[Amount] > [Budget]')]},{nextRowId:9});
    eq(W.tableRows(rem.table).map(r=>r[2]),['b','d']);
    const neg=W.OPS.filterRows.apply(t,{mode:'keep',tree:{op:'not',child:F('[Amount] > [Budget]')}},{nextRowId:9});
    eq(W.tableRows(neg.table).map(r=>r[2]),['b','d'])
  });
  test('formula condition: rows where the formula errors are not matched, and numbers are truthy',()=>{
    const t=tbl(['n'],[['0'],['2'],['x']]);
    const r=W.OPS.filterRows.apply(t,{mode:'keep',match:'all',conditions:[F('1/[n]')]},{nextRowId:9});
    eq(W.tableRows(r.table),[['2']])
  });
  test('formula condition: validate explains problems',()=>{
    const v=W.OPS.filterRows.validate;
    const mk=expr=>({mode:'keep',match:'all',conditions:[F(expr)]});
    ok(/Enter a formula/.test(v(mk(' '),{cols:['a']})));
    ok(/Unknown function FOO at position 1/.test(v(mk('FOO()'),{cols:['a']})));
    ok(/Column "b" not found/.test(v(mk('[b]>1'),{cols:['a']})));
    eq(v(mk('[a]>1'),{cols:['a']}),null);
    ok(/one line/.test(v(mk('1\n>2'),null)))
  });
  test('formula condition: describeCond shows the formula',()=>{
    eq(W.describeCond(F('[a]>1')),'formula [a]>1');
    eq(W.describeTree({op:'not',child:F('[a]>1')}),'not formula [a]>1')
  });
  test('formula condition: leafColumnOk drops formulas whose columns are gone',()=>{
    const t=tbl(['a'],[['1']]);
    ok(W.leafColumnOk(t,F('[a]>0')));ok(!W.leafColumnOk(t,F('[b]>0')));ok(!W.leafColumnOk(t,F('FOO()')))
  });

  test('stepColumns finds formula references, bare names and the after column',()=>{
    eq(W.stepColumns(step({name:'T',expr:'[Qty] * Price + SUM([Order Total], Tax)',after:'Qty'})).sort(),['Order Total','Price','Qty','Tax']);
    eq(W.stepColumns({opId:'filterRows',cfg:{mode:'keep',match:'all',conditions:[F('[A] > [B]'),C('c','equals','x')]}}).sort(),['A','B','c']);
    eq(W.stepColumns({opId:'filterRows',cfg:{mode:'keep',tree:{op:'not',child:F('LEN([n])>1')}}}),['n'])
  });
  test('remapStep renames formula references in formula columns and formula conditions',()=>{
    const dict={Qty:'Quantity',Price:'Unit Price'};
    const s=W.remapStep(step({name:'T',expr:'[Qty] * Price',after:'Qty'}),dict);
    eq(s.cfg,{name:'T',expr:'[Quantity] * [Unit Price]',after:'Quantity'});
    const f=W.remapStep({opId:'filterRows',cfg:{mode:'keep',tree:{op:'or',children:[F('[Qty]>1'),{op:'not',child:C('Price','equals','3')}]}}},dict);
    eq(f.cfg.tree.children[0].expr,'[Quantity]>1');eq(f.cfg.tree.children[1].child.col,'Unit Price');
    const g=W.remapStep({opId:'filterRows',cfg:{mode:'keep',match:'all',conditions:[F('[Qty]>1')]}},dict);
    eq(g.cfg.conditions[0].expr,'[Quantity]>1');
    eq(W.remapStep(step({name:'T',expr:'[Qty]'}),{}).cfg.expr,'[Qty]')
  });
  test('recipe column matching keeps working on a new file with renamed headers',()=>{
    const steps=[step({name:'Total',expr:'[Qty] * [Price]',after:'Price'}),{opId:'filterRows',cfg:{mode:'keep',match:'all',conditions:[F('[Total] > 10')]},muted:false}];
    const want=Array.from(new Set(steps.flatMap(s=>W.stepColumns(s))));
    const fresh=tbl(['qty','PRICE','note'],[['2','3','n1'],['4','5','n2'],['1','1','n3']]);
    const dict=W.matchColumns(want,fresh.cols);
    eq(dict,{Qty:'qty',Price:'PRICE'});
    const mapped=steps.map(s=>W.remapStep(s,dict));
    const res=W.runPipeline(fresh,mapped,{});
    eq(res.meta.map(m=>m.error),[null,null]);
    eq(W.tableRows(res.states[2]),[['4','5','20','n2']]);
    eq(res.states[2].cols,['qty','PRICE','Total','note'])
  });
  test('a formula column shows up in the shape contract as a numeric column',()=>{
    const res=W.runPipeline(tbl(['a'],[['1'],['2']]),[step({name:'B',expr:'[a]*2'})],{});
    const sc=W.shapeContract(res.states[1]);
    eq(sc.cols.map(c=>c.name),['a','B']);eq(sc.cols[1].numeric,true)
  });

  const csv=(cols,rows)=>cols.join(',')+'\n'+rows.map(r=>r.join(',')).join('\n');
  const load=(cols,rows)=>{E.handle('tableReset',{id:'t1'});E.handle('setCtx',{dateOrder:'mdy',today:null});E.handle('load',{text:csv(cols,rows),hint:{kind:'delimited',params:{delimiter:',',quote:'"',header:true},force:true}})};
  const idsOf=v=>E.handle('getRows',{viewKey:v.key,start:0,count:Math.max(1,v.n)}).rowIds.slice(0,v.n);
  test('search: a query starting with = is a formula filter',()=>{
    const p=W.Q.parse('=[Amount]>[Budget]',['Amount','Budget']);
    eq(p.errors,[]);eq(p.tree,{col:'@formula',op:'formula',expr:'[Amount]>[Budget]',caseSensitive:false});
    eq(W.Q.parse('  = [a] > 1 ',['a']).tree.expr,'[a] > 1')
  });
  test('search: formula problems give an error with a position and no filter',()=>{
    const a=W.Q.parse('=FOO([a])',['a']);
    eq(a.tree,null);eq(a.errors.length,1);eq(a.errors[0].start,1);ok(/Unknown function FOO/.test(a.errors[0].message));
    const b=W.Q.parse('=[zz]>1',['a']);
    eq(b.tree,null);ok(/Column "zz" was not found/.test(b.errors[0].message));
    const c=W.Q.parse('=',['a']);
    eq(c.tree,null);eq(c.errors.length,1);
    const d=W.Q.parse('=1+',['a']);
    eq(d.tree,null);ok(d.errors[0].end<=3)
  });
  test('search: = in the middle of a query is still plain text or an operator',()=>{
    eq(W.Q.parse('a=b',['a']).tree.col,'a');
    eq(W.Q.parse('x =y',['a']).tree.children.map(c=>c.value),['x','=y'])
  });
  test('search: formula filter through the engine, scan path then cached path, matches the step',()=>{
    load(['Amount','Budget','s'],[['1200','1000','a'],['900','1000','b'],['50','5','c'],['x','1','d'],['','2','e'],['7','7','f']]);
    const t=W.E.states[W.E.states.length-1];
    const v1=E.handle('setView',{search:'=[Amount]>[Budget]',sort:[],filter:null,rowIds:null});
    const v2=E.handle('setView',{search:'=[Amount]>[Budget]',sort:[],filter:null,rowIds:null});
    const step=W.OPS.filterRows.apply(t,{mode:'keep',match:'all',conditions:[F('[Amount]>[Budget]')]},{nextRowId:t.n}).table.rowIds.slice();
    eq(idsOf(v1),step);eq(idsOf(v2),step);eq(v1.n,3);eq(v1.query.errors,[])
  });
  test('search: formula errors reach the view as query errors without hiding rows',()=>{
    load(['a'],[['1'],['2']]);
    const v=E.handle('setView',{search:'=FOO([a])',sort:[],filter:null,rowIds:null});
    eq(v.n,2);ok(v.query.errors.length>=1)
  });
  test('find: a formula filter does not light up individual cells',()=>{
    load(['a','b'],[['1','2'],['3','4']]);
    const v=E.handle('setView',{search:'=[a]>0',sort:[],filter:null,rowIds:null});
    eq(v.n,2);
    const f=E.handle('findCount',{viewKey:v.key,query:'=[a]>0'});
    eq(f.total,0)
  });
  test('formula filter agrees with a naive evaluator over random tables',()=>{
    const rnd=W.mulberry32(0xC0FFEE);
    for(let it=0;it<60;it++){
      const rows=[];const n=(rnd()*40)|0;
      for(let i=0;i<n;i++)rows.push([String(((rnd()*200)|0)-50),rnd()<0.2?'':String((rnd()*100)|0),['aa','Bb','cc',''][(rnd()*4)|0]||'zz']);
      load(['x','y','z'],rows);
      const t=W.E.states[W.E.states.length-1];
      const exprs=['[x]>[y]','AND([x]>0,[y]<50)','OR(ISBLANK([y]),[x]=0)','NOT(ISNUMBER([y]))','UPPER([z])="BB"','LEN([z])>1','[x]+[y]>100'];
      const expr=exprs[(rnd()*exprs.length)|0];
      const got=W.OPS.filterRows.apply(t,{mode:'keep',match:'all',conditions:[F(expr)]},{nextRowId:t.n}).table.rowIds.slice();
      const want=[];
      rows.forEach((r,i)=>{
        const x=+r[0],yb=r[1]==='',y=yb?0:+r[1],z=r[2];
        let hit;
        switch(expr){
          case'[x]>[y]':hit=!yb&&x>y;break;
          case'AND([x]>0,[y]<50)':hit=x>0&&!yb&&y<50;break;
          case'OR(ISBLANK([y]),[x]=0)':hit=yb||x===0;break;
          case'NOT(ISNUMBER([y]))':hit=yb;break;
          case'UPPER([z])="BB"':hit=z.toUpperCase()==='BB';break;
          case'LEN([z])>1':hit=z.length>1;break;
          default:hit=x+y>100
        }
        if(hit)want.push(t.rowIds[i])
      });
      eq(got,want,'iteration '+it+' expr '+expr+' rows '+JSON.stringify(rows))
    }
  });

  test('fuzz: random text never throws from compile or fn',()=>{
    const rnd=W.mulberry32(0xC0FFEE);
    const alphabet='[]()",.+-*/^&=<>% 0123456789abcXYZ_\'é😀IFSUMLEN\\';
    const cols=['a','b c','é'];
    for(let i=0;i<1500;i++){
      const len=(rnd()*40)|0;let s='';
      for(let k=0;k<len;k++)s+=alphabet[(rnd()*alphabet.length)|0];
      let c;
      try{c=W.F.compile(s,cols)}catch(e){throw new Error('compile threw for '+JSON.stringify(s)+': '+e.message)}
      let out;
      try{out=c.fn(['1','x','2025-01-01'])}catch(e){throw new Error('fn threw for '+JSON.stringify(s)+': '+e.message)}
      ok(typeof out==='string',JSON.stringify(s));
      ok(Array.isArray(c.errors)&&Array.isArray(c.missing))
    }
  });
  test('fuzz: random valid formulas evaluate to a string or an error code and are stable',()=>{
    const rnd=W.mulberry32(0xC0FFEE+1);
    const atoms=['1','2.5','0','"a"','""','TRUE','[n]','[t]','[d]','[b]','DATE(2025,2,28)','-3','10%'];
    const bin=['+','-','*','/','^','&','=','<>','<','>','<=','>='];
    const fns=[['ABS',1],['LEN',1],['UPPER',1],['ROUND',2],['MOD',2],['IF',3],['IFERROR',2],['LEFT',2],['MID',3],['SUM',3],['MAX',2],['TEXT',2],['YEAR',1],['EDATE',2],['NOT',1],['COALESCE',2],['TRIM',1],['VALUE',1]];
    const gen=d=>{
      const u=rnd();
      if(d>=4||u<0.3)return atoms[(rnd()*atoms.length)|0];
      if(u<0.65)return '('+gen(d+1)+bin[(rnd()*bin.length)|0]+gen(d+1)+')';
      const f=fns[(rnd()*fns.length)|0];
      const a=[];for(let i=0;i<f[1];i++)a.push(gen(d+1));
      return f[0]+'('+a.join(',')+')'
    };
    const codes=new Set(W.F.ERROR_CODES);
    for(let i=0;i<800;i++){
      const src=gen(0);
      const c=W.F.compile(src,['n','t','d','b']);
      eq(c.errors,[],src);
      const row=['3','abc','2025-01-31',''];
      const a=c.fn(row),b=W.F.compile(src,['n','t','d','b']).fn(row);
      ok(typeof a==='string',src);
      eq(a,b,src);
      if(a.charAt(0)==='#')ok(codes.has(a),src+' gave '+a)
    }
  });
  test('DATE, YEAR, MONTH, DAY and WEEKDAY agree with the JavaScript calendar for 6,000 random dates and overflows',()=>{
    const rnd=W.mulberry32(0xC0FFEE+2);
    for(let i=0;i<6000;i++){
      const y=1000+((rnd()*2000)|0),m=((rnd()*60)|0)-20,d=((rnd()*200)|0)-60;
      const dt=new Date(0);dt.setUTCFullYear(y,m-1,d);
      const label=y+','+m+','+d;
      eq(run('DATE('+label+')'),dt.toISOString().slice(0,10),label);
      eq(run('YEAR(DATE('+label+'))'),String(dt.getUTCFullYear()),label);
      eq(run('MONTH(DATE('+label+'))'),String(dt.getUTCMonth()+1),label);
      eq(run('DAY(DATE('+label+'))'),String(dt.getUTCDate()),label);
      eq(run('WEEKDAY(DATE('+label+'))'),String(dt.getUTCDay()+1),label)
    }
  });
  test('EDATE and DATEDIF agree with a calendar walk',()=>{
    const rnd=W.mulberry32(0xC0FFEE+3);
    for(let i=0;i<1500;i++){
      const y=1990+((rnd()*60)|0),m=1+((rnd()*12)|0),d=1+((rnd()*31)|0),k=((rnd()*60)|0)-30;
      const base=new Date(0);base.setUTCFullYear(y,m-1,d);
      if(base.getUTCMonth()!==m-1)continue;
      const total=y*12+(m-1)+k,ty=Math.floor(total/12),tm=total-ty*12;
      const last=new Date(0);last.setUTCFullYear(ty,tm+1,0);
      const want=new Date(0);want.setUTCFullYear(ty,tm,Math.min(d,last.getUTCDate()));
      const lab=y+'-'+m+'-'+d+' '+k;
      eq(run('EDATE(DATE('+y+','+m+','+d+'),'+k+')'),want.toISOString().slice(0,10),lab);
      const ds=run('DATEDIF(DATE('+y+','+m+','+d+'),EDATE(DATE('+y+','+m+','+d+'),'+(Math.abs(k)+1)+'),"M")');
      ok(+ds>=Math.abs(k)||+ds===Math.abs(k),lab+' months '+ds)
    }
  });
  test('formula engine never stores per-row state: the same compiled formula gives the same answer in any order',()=>{
    const c=W.F.compile('IF([a]>2,[a]*2,"no")',['a']);
    const D=[['1','5','2','9','3']];
    const first=[0,1,2,3,4].map(r=>W.F.format(c.run(D,r)));
    const second=[4,3,2,1,0].map(r=>W.F.format(c.run(D,r))).reverse();
    eq(first,second);eq(first,['no','10','no','18','6'])
  });
});
})(typeof self!=='undefined'?self:globalThis);
