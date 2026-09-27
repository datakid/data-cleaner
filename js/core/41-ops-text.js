(function(G){
'use strict';
const W=G.WeftCore;
const q=W.q,cd=W.colsDsl;
const colsText=c=>(!c||!c.length||c[0]==='*')?'all columns':c.map(x=>'"'+x+'"').join(', ');
function inCols(cur){cur.word('in');return cur.cols()}

W.defineOp({
  id:'trim',label:'Trim whitespace',category:'rewrite',
  keywords:['trim','whitespace','spaces','strip','clean','collapse'],
  fields:[{key:'columns',type:'columns',label:'Columns',allowAll:true},{key:'collapse',type:'checkbox',label:'Also collapse repeated inner spaces'}],
  defaults:()=>({columns:['*'],collapse:true}),
  describe:cfg=>'Trim whitespace in '+colsText(cfg.columns)+(cfg.collapse===false?' (keep inner spaces)':''),
  apply(t,cfg){
    W.needCols(t,cfg.columns);const cols=W.resolveCols(t,cfg.columns);const col=cfg.collapse!==false;
    const ws=c=>c<=32||c===160||c===0x2007||c===0x202F||c===0xFEFF;
    return W.rewriteCells(t,cols,v=>{
      const L=v.length;if(!L)return v;
      if(!ws(v.charCodeAt(0))&&!ws(v.charCodeAt(L-1))&&(!col||(v.indexOf('  ')===-1&&v.indexOf('\t')===-1&&v.indexOf('\u00A0')===-1)))return v;
      return col?v.replace(/[ \t\u00A0]+/g,' ').replace(/^\s+|\s+$/g,''):v.replace(/^\s+|\s+$/g,'')
    })
  },
  toDsl:cfg=>'trim '+cd(cfg.columns)+(cfg.collapse===false?' keep inner':''),
  dslPattern:/^trim\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.word('trim');const columns=cur.done()?['*']:cur.cols();let collapse=true;if(cur.optWord('keep')){cur.word('inner');collapse=false}cur.end();return{columns,collapse}},
  examples:[
    {cfg:{columns:['*'],collapse:true},input:{cols:['a'],rows:[['  Ada   Lovelace ']]},expect:{cols:['a'],rows:[['Ada Lovelace']]}},
    {cfg:{columns:['a'],collapse:false},input:{cols:['a','b'],rows:[[' x  y ',' z ']]},expect:{cols:['a','b'],rows:[['x  y',' z ']]}},
    {cfg:{columns:['*'],collapse:true},input:{cols:['a'],rows:[]},expect:{cols:['a'],rows:[]}}
  ]
});

const SMART={'\u2018':"'",'\u2019':"'",'\u201A':"'",'\u201B':"'",'\u201C':'"','\u201D':'"','\u201E':'"','\u2032':"'",'\u2033':'"'};
W.defineOp({
  id:'cleanText',label:'Clean invisible characters',category:'rewrite',
  keywords:['clean','invisible','nbsp','zero width','smart quotes','unicode','normalize','control'],
  fields:[{key:'columns',type:'columns',label:'Columns',allowAll:true},{key:'nbsp',type:'checkbox',label:'Turn non-breaking spaces into normal spaces'},{key:'zeroWidth',type:'checkbox',label:'Remove zero-width characters'},{key:'smartQuotes',type:'checkbox',label:'Turn curly quotes into straight quotes'},{key:'nfc',type:'checkbox',label:'Normalize Unicode (NFC)'},{key:'controlChars',type:'checkbox',label:'Remove control characters'}],
  defaults:()=>({columns:['*'],nbsp:true,zeroWidth:true,smartQuotes:true,nfc:true,controlChars:true}),
  describe:cfg=>'Clean invisible characters in '+colsText(cfg.columns),
  apply(t,cfg){
    W.needCols(t,cfg.columns);
    const cols=W.resolveCols(t,cfg.columns);
    return W.rewriteCells(t,cols,v=>{
      let s=v;
      if(cfg.nbsp!==false)s=s.replace(/[\u00A0\u2007\u202F]/g,' ');
      if(cfg.zeroWidth!==false)s=s.replace(/[\u200B-\u200D\u2060\uFEFF]/g,'');
      if(cfg.smartQuotes!==false)s=s.replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u2032\u2033]/g,c=>SMART[c]);
      if(cfg.controlChars!==false)s=s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'');
      if(cfg.nfc!==false&&s.normalize)s=s.normalize('NFC');
      return s
    })
  },
  toDsl(cfg){
    const off=['nbsp','zeroWidth','smartQuotes','nfc','controlChars'].filter(k=>cfg[k]===false);
    const names={nbsp:'nbsp',zeroWidth:'zero-width',smartQuotes:'quotes',nfc:'nfc',controlChars:'control'};
    return'clean text in '+cd(cfg.columns)+(off.length?' without '+off.map(k=>names[k]).join(', '):'')
  },
  dslPattern:/^clean text\b/i,
  fromDsl(line){
    const cur=W.cursor(line);cur.word('clean','text');
    const columns=cur.isWord('in')?inCols(cur):['*'];
    const cfg={columns,nbsp:true,zeroWidth:true,smartQuotes:true,nfc:true,controlChars:true};
    if(cur.optWord('without')){
      const map={nbsp:'nbsp','zero-width':'zeroWidth',quotes:'smartQuotes',nfc:'nfc',control:'controlChars'};
      do{const w=cur.anyWord().toLowerCase();if(!map[w])throw new Error('Unknown option "'+w+'". Use nbsp, zero-width, quotes, nfc or control.');cfg[map[w]]=false}while(cur.optP(','))
    }
    cur.end();return cfg
  },
  examples:[
    {cfg:{columns:['*'],nbsp:true,zeroWidth:true,smartQuotes:true,nfc:true,controlChars:true},input:{cols:['a'],rows:[['a\u00A0b\u200B'],['\u201Chi\u201D']]},expect:{cols:['a'],rows:[['a b'],['"hi"']]}},
    {cfg:{columns:['a'],nbsp:true,zeroWidth:true,smartQuotes:false,nfc:true,controlChars:true},input:{cols:['a'],rows:[['\u2018x\u2019']]},expect:{cols:['a'],rows:[['\u2018x\u2019']]}}
  ]
});

function titleCase(s){return s.toLowerCase().replace(/(^|[\s\-'(\/])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase())}
W.titleCase=titleCase;
W.defineOp({
  id:'case',label:'Change case',category:'rewrite',
  keywords:['case','upper','lower','title','capitalize','uppercase','lowercase'],
  fields:[{key:'columns',type:'columns',label:'Columns',allowAll:true},{key:'mode',type:'select',label:'Change to',options:[['lower','lowercase'],['upper','UPPERCASE'],['title','Title Case'],['sentence','Sentence case']]}],
  defaults:()=>({columns:['*'],mode:'lower'}),
  describe:cfg=>({lower:'Lowercase',upper:'Uppercase',title:'Title-case',sentence:'Sentence-case'}[cfg.mode]||'Change case of')+' '+colsText(cfg.columns),
  apply(t,cfg){
    W.needCols(t,cfg.columns);
    const f=cfg.mode==='upper'?s=>s.toUpperCase():cfg.mode==='title'?titleCase:cfg.mode==='sentence'?s=>{const l=s.toLowerCase();return l.replace(/^(\s*)(\p{L})/u,(m,a,b)=>a+b.toUpperCase())}:s=>s.toLowerCase();
    return W.rewriteCells(t,W.resolveCols(t,cfg.columns),f)
  },
  toDsl:cfg=>'case '+cfg.mode+' '+cd(cfg.columns),
  dslPattern:/^case\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.word('case');const mode=cur.oneOf(['lower','upper','title','sentence']);const columns=cur.done()?['*']:cur.cols();cur.end();return{columns,mode}},
  examples:[
    {cfg:{columns:['*'],mode:'title'},input:{cols:['a'],rows:[['ADA lovelace-byron'],['élan o\'brien']]},expect:{cols:['a'],rows:[['Ada Lovelace-Byron'],['Élan O\'Brien']]}},
    {cfg:{columns:['a'],mode:'upper'},input:{cols:['a','b'],rows:[['x','y']]},expect:{cols:['a','b'],rows:[['X','y']]}}
  ]
});

W.defineOp({
  id:'replace',label:'Find and replace',category:'rewrite',
  keywords:['replace','find','substitute','swap','regex','change'],
  fields:[{key:'columns',type:'columns',label:'Columns',allowAll:true},{key:'find',type:'text',label:'Find',placeholder:'text to find'},{key:'replace',type:'text',label:'Replace with',placeholder:'leave blank to remove'},{key:'regex',type:'checkbox',label:'Find is a pattern (regular expression)'},{key:'wholeCell',type:'checkbox',label:'Only when it is the whole cell'},{key:'matchCase',type:'checkbox',label:'Match case'}],
  defaults:()=>({columns:['*'],find:'',replace:'',regex:false,wholeCell:false,matchCase:false}),
  validate:cfg=>!cfg.find?'Enter something to find.':(cfg.regex&&W.isUnsafeRegexSource(cfg.find))?'That pattern is too long or could freeze the page. Simplify it.':null,
  describe:cfg=>(cfg.find&&!cfg.replace?'Remove ':'Replace ')+(cfg.regex?'/'+W.trunc(cfg.find,20)+'/':'"'+W.trunc(cfg.find,20)+'"')+(cfg.replace?' with "'+W.trunc(cfg.replace,20)+'"':'')+' in '+colsText(cfg.columns),
  apply(t,cfg){
    W.needCols(t,cfg.columns);
    if(!cfg.find)return{table:t,stats:{changed:0}};
    let src=cfg.regex?cfg.find:cfg.find.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(cfg.wholeCell)src='^(?:'+src+')$';
    const re=cfg.regex?W.compileRegex(src,cfg.matchCase?'g':'gi'):new RegExp(src,cfg.matchCase?'g':'gi');
    const rep=cfg.regex?String(cfg.replace||''):String(cfg.replace||'').replace(/\$/g,'$$$$');
    return W.rewriteCells(t,W.resolveCols(t,cfg.columns),v=>{re.lastIndex=0;return re.test(v)?(re.lastIndex=0,v.replace(re,rep)):v})
  },
  toDsl:cfg=>'replace '+(cfg.regex?W.reDsl(cfg.find,cfg.matchCase):q(cfg.find))+' with '+q(cfg.replace||'')+' in '+cd(cfg.columns)+(cfg.wholeCell?' whole':'')+(cfg.matchCase&&!cfg.regex?' matchcase':''),
  dslPattern:/^replace\b/i,
  fromDsl(line){
    const cur=W.cursor(line);cur.word('replace');
    const cfg={columns:['*'],find:'',replace:'',regex:false,wholeCell:false,matchCase:false};
    const x=cur.peek();
    if(x&&x.t==='re'){const r=cur.re();cfg.find=r.src;cfg.regex=true;cfg.matchCase=r.flags.indexOf('i')===-1}else cfg.find=cur.str();
    cur.word('with');cfg.replace=cur.str();
    if(cur.isWord('in'))cfg.columns=inCols(cur);
    while(!cur.done()){const w=cur.oneOf(['whole','matchcase']);if(w==='whole')cfg.wholeCell=true;else cfg.matchCase=true}
    return cfg
  },
  examples:[
    {cfg:{columns:['*'],find:'N/A',replace:'',regex:false,wholeCell:true,matchCase:false},input:{cols:['a'],rows:[['n/a'],['N/A later']]},expect:{cols:['a'],rows:[[''],['N/A later']]}},
    {cfg:{columns:['p'],find:'[^0-9]',replace:'',regex:true,wholeCell:false,matchCase:false},input:{cols:['p'],rows:[['(555) 123-4567']]},expect:{cols:['p'],rows:[['5551234567']]}},
    {cfg:{columns:['a'],find:'$',replace:'USD ',regex:false,wholeCell:false,matchCase:false},input:{cols:['a'],rows:[['$5']]},expect:{cols:['a'],rows:[['USD 5']]}}
  ]
});

W.defineOp({
  id:'dateNormalize',label:'Normalize dates',category:'rewrite',
  keywords:['date','dates','normalize','iso','format','reformat'],
  fields:[{key:'column',type:'column',label:'Column'},{key:'format',type:'select',label:'Write as',options:[['iso','ISO: 2025-03-04'],['us','US: 03/04/2025'],['eu','European: 04/03/2025'],['long','Long: Mar 4, 2025']]}],
  defaults:(s,x)=>({column:(x&&x.col)||s.cols.find((c,i)=>s.types&&s.types[i]==='date')||s.cols[0],format:'iso'}),
  describe:cfg=>'Normalize dates in "'+cfg.column+'" to '+({iso:'ISO',us:'US',eu:'European',long:'long'}[cfg.format]||cfg.format)+' format',
  apply(t,cfg,ctx){
    const ci=W.needCol(t,cfg.column);let failed=0;
    const r=W.rewriteCells(t,[ci],v=>{const s=v.trim();if(!s)return v;const d=W.parseDate(s,{order:ctx&&ctx.dateOrder,yearPivot:ctx&&ctx.yearPivot});if(!d){failed++;return v}return W.fmtDateAs(d,cfg.format||'iso')});
    r.stats.failed=failed;
    if(failed)r.warning=W.plural(failed,'cell')+' could not be read as dates and were left as they were.';
    return r
  },
  toDsl:cfg=>'dates '+q(cfg.column)+' -> '+cfg.format,
  dslPattern:/^(dates|normalize dates)\b/i,
  fromDsl(line){const cur=W.cursor(line);if(cur.isWord('normalize'))cur.word('normalize');cur.word('dates');const column=cur.str();if(!cur.optWord('->'))cur.word('to');const format=cur.oneOf(['iso','us','eu','long']);cur.end();return{column,format}},
  examples:[
    {cfg:{column:'d',format:'iso'},input:{cols:['d'],rows:[['3/4/2025'],['March 5, 2025'],['TBD']]},expect:{cols:['d'],rows:[['2025-03-04'],['2025-03-05'],['TBD']]}},
    {cfg:{column:'d',format:'long'},input:{cols:['d'],rows:[['']]},expect:{cols:['d'],rows:[['']]}}
  ]
});

W.defineOp({
  id:'convertType',label:'Change type',category:'rewrite',
  keywords:['type','convert','number','date','text','numeric','currency','clean numbers','format'],
  fields:[{key:'column',type:'column',label:'Column'},{key:'to',type:'select',label:'Convert to',options:[['number','Number'],['date','Date (ISO)'],['text','Text']]},{key:'locale',type:'select',label:'Number style',options:[['auto','Detect automatically'],['us','1,234.56'],['eu','1.234,56']]},{key:'percentAsFraction',type:'checkbox',label:'Write 12% as 0.12'}],
  defaults:(s,x)=>({column:(x&&x.col)||s.cols[0],to:(x&&x.to)||'number',locale:'auto',percentAsFraction:false}),
  describe:cfg=>'Convert "'+cfg.column+'" to '+cfg.to+(cfg.to==='number'&&cfg.locale&&cfg.locale!=='auto'?' ('+cfg.locale.toUpperCase()+' style)':''),
  apply(t,cfg,ctx){
    const ci=W.needCol(t,cfg.column);
    if(cfg.to==='text')return{table:t,stats:{changed:0}};
    let failed=0;
    let locale=cfg.locale;
    if(!locale||locale==='auto'){const sm=[];const col=t.data[ci];for(let r=0;r<t.n&&sm.length<400;r++)if(col[r]&&String(col[r]).trim())sm.push(col[r]);locale=W.detectNumberLocale(sm)}
    const res=W.rewriteCells(t,[ci],v=>{
      const s=v.trim();if(!s)return v;
      if(cfg.to==='number'){
        const p=W.parseNumber(s,{locale,percentAsFraction:!!cfg.percentAsFraction});
        if(!p){failed++;return v}
        let out=W.canonicalNumber(p.value);
        if(p.isPercent&&!cfg.percentAsFraction)out=W.canonicalNumber(p.value);
        return out
      }
      const d=W.parseDate(s,{order:ctx&&ctx.dateOrder,yearPivot:ctx&&ctx.yearPivot});
      if(!d){failed++;return v}
      return W.fmtDateAs(d,'iso')
    });
    res.stats.failed=failed;
    if(failed)res.warning=W.plural(failed,'cell')+' could not be read as '+(cfg.to==='number'?'numbers':'dates')+' and were left as they were.';
    return res
  },
  toDsl:cfg=>'convert '+q(cfg.column)+' to '+cfg.to+(cfg.to==='number'&&cfg.locale&&cfg.locale!=='auto'?' locale '+cfg.locale:'')+(cfg.percentAsFraction?' percent-as-fraction':''),
  dslPattern:/^convert\b/i,
  fromDsl(line){
    const cur=W.cursor(line);cur.word('convert');const column=cur.str();cur.word('to');const to=cur.oneOf(['number','date','text']);
    const cfg={column,to,locale:'auto',percentAsFraction:false};
    while(!cur.done()){if(cur.optWord('locale'))cfg.locale=cur.oneOf(['auto','us','eu']);else{cur.word('percent-as-fraction');cfg.percentAsFraction=true}}
    return cfg
  },
  examples:[
    {cfg:{column:'amount',to:'number',locale:'auto',percentAsFraction:false},input:{cols:['amount'],rows:[['$1,204.50'],['(30.00)'],['n/a']]},expect:{cols:['amount'],rows:[['1204.5'],['-30'],['n/a']]}},
    {cfg:{column:'amount',to:'number',locale:'eu',percentAsFraction:false},input:{cols:['amount'],rows:[['1.234,50 €'],['12,5']]},expect:{cols:['amount'],rows:[['1234.5'],['12.5']]}},
    {cfg:{column:'d',to:'date',locale:'auto',percentAsFraction:false},input:{cols:['d'],rows:[['12-Mar-2025'],['']]},expect:{cols:['d'],rows:[['2025-03-12'],['']]}}
  ]
});

W.defineOp({
  id:'fillDown',label:'Fill down',category:'rewrite',
  keywords:['fill','down','carry','forward','blank','empty','repeat'],
  fields:[{key:'columns',type:'columns',label:'Columns',allowAll:true}],
  defaults:(s,x)=>({columns:x&&x.cols&&x.cols.length?x.cols:['*']}),
  describe:cfg=>'Fill blanks down in '+colsText(cfg.columns),
  apply(t,cfg){
    W.needCols(t,cfg.columns);
    const cols=W.resolveCols(t,cfg.columns);const data=W.cow(t,cols);let changed=0;const touched=new Map();
    for(const ci of cols){let last='';const set=new Set();for(let r=0;r<t.n;r++){const v=String(data[ci][r]==null?'':data[ci][r]);if(v.trim()===''){if(last!==''){data[ci][r]=last;changed++;set.add(r)}}else last=v}if(set.size)touched.set(t.cols[ci],set)}
    return{table:W.keepSame(t,data),stats:{changed},touched}
  },
  toDsl:cfg=>'fill down '+cd(cfg.columns),
  dslPattern:/^fill down\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.word('fill','down');const columns=cur.done()?['*']:cur.cols();cur.end();return{columns}},
  examples:[
    {cfg:{columns:['g']},input:{cols:['g','v'],rows:[['A','1'],['','2'],['B','3'],[' ','4']]},expect:{cols:['g','v'],rows:[['A','1'],['A','2'],['B','3'],['B','4']]}},
    {cfg:{columns:['*']},input:{cols:['g'],rows:[[''],['x']]},expect:{cols:['g'],rows:[[''],['x']]}}
  ]
});

W.defineOp({
  id:'fillBlank',label:'Fill blanks',category:'rewrite',
  keywords:['fill','blank','empty','default','missing','null'],
  fields:[{key:'columns',type:'columns',label:'Columns',allowAll:true},{key:'value',type:'text',label:'Fill with',placeholder:'value for empty cells'}],
  defaults:(s,x)=>({columns:x&&x.cols&&x.cols.length?x.cols:['*'],value:''}),
  validate:cfg=>cfg.value===''?'Enter a value to put in empty cells.':null,
  describe:cfg=>'Fill blanks in '+colsText(cfg.columns)+' with "'+W.trunc(cfg.value,20)+'"',
  apply(t,cfg){W.needCols(t,cfg.columns);return W.rewriteCells(t,W.resolveCols(t,cfg.columns),v=>v.trim()===''?String(cfg.value):v)},
  toDsl:cfg=>'fill blank '+cd(cfg.columns)+' with '+q(cfg.value),
  dslPattern:/^fill blanks?\b/i,
  fromDsl(line){const cur=W.cursor(line);cur.word('fill');cur.oneOf(['blank','blanks']);const columns=cur.isWord('with')?['*']:cur.cols();cur.word('with');const value=cur.str();cur.end();return{columns,value}},
  examples:[
    {cfg:{columns:['*'],value:'unknown'},input:{cols:['a','b'],rows:[['','x'],['y',' ']]},expect:{cols:['a','b'],rows:[['unknown','x'],['y','unknown']]}},
    {cfg:{columns:['a'],value:'0'},input:{cols:['a'],rows:[]},expect:{cols:['a'],rows:[]}}
  ]
});
})(typeof self!=='undefined'?self:globalThis);
