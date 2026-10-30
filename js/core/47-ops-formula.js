(function(G){
'use strict';
const W=G.WeftCore;
const q=W.q;
const LINE_RE=/^add column\s+("(?:[^"\\]|\\.)*")(?:\s+after\s+("(?:[^"\\]|\\.)*"))?\s*=([\s\S]*)$/i;

W.defineOp({
  id:'formulaColumn',label:'Add column from formula',category:'add',
  keywords:['formula','calculate','calculated','compute','expression','excel formula','excel','new column','add column','math','if'],
  fields:[
    {key:'name',type:'text',label:'New column name'},
    {key:'expr',type:'formula',label:'Formula'},
    {key:'after',type:'column',label:'Insert after',optional:true}
  ],
  defaults:(s,x)=>({name:'Calculated',expr:'',after:(x&&x.col)||''}),
  validate(cfg,s){
    if(!String(cfg.name||'').trim())return'Name the new column.';
    const expr=String(cfg.expr||'');
    if(!expr.trim())return'Enter a formula, for example [Qty] * [Price].';
    if(/[\r\n]/.test(expr))return'A formula must stay on one line.';
    const ck=W.F.check(expr,W.F.colNames(s));
    if(ck.errors.length)return ck.errors[0].message;
    if(ck.missing.length)return'Column "'+ck.missing[0]+'" not found.';
    return null
  },
  describe:cfg=>'Add column "'+cfg.name+'" = '+W.trunc(String(cfg.expr||'').trim(),60),
  apply(t,cfg,ctx){
    const name=String(cfg.name||'').trim();
    if(!name)throw new Error('Name the new column.');
    const expr=String(cfg.expr||'');
    if(/[\r\n]/.test(expr))throw new Error('A formula must stay on one line.');
    const c=W.F.forTable(t,expr,ctx);
    if(c.errors.length)throw new Error(c.errors[0].message);
    if(c.missing.length)throw new Error(W.notFound(t,c.missing[0]));
    const D=t.data,n=t.n,f=c.run,out=new Array(n);
    let failed=0;const ex=[];
    for(let r=0;r<n;r++){
      let s;
      try{s=W.F.format(f(D,r))}
      catch(e){s=W.F.errCode(e);failed++;if(ex.length<3)ex.push('row '+(r+1)+' gives '+s)}
      out[r]=s
    }
    let at=null,note=null;
    if(cfg.after){
      const ai=t.cols.indexOf(cfg.after);
      if(ai===-1)note='The column "'+cfg.after+'" was not found, so the new column was added at the end.';
      else at=ai
    }
    const added=W.addColumnAt(t,name,out,at);
    const res={table:added.table,stats:{addedCols:1,failed,failedLabel:'error'},touched:new Map([[added.name,true]])};
    const warn=[];
    if(failed)warn.push(W.plural(failed,'cell')+' could not be calculated. First: '+ex.join(', ')+'.');
    if(note)warn.push(note);
    if(warn.length)res.warning=warn.join(' ');
    return res
  },
  toDsl:cfg=>'add column '+q(cfg.name)+(cfg.after?' after '+q(cfg.after):'')+' = '+String(cfg.expr||'').trim(),
  dslPattern:/^add column\s+"/i,
  fromDsl(line){
    const m=LINE_RE.exec(line.trim());
    if(!m)throw new Error('Write it as: add column "Total" = [Qty] * [Price]');
    const name=JSON.parse(m[1]);
    const after=m[2]?JSON.parse(m[2]):'';
    const expr=m[3].trim();
    if(!expr)throw new Error('Add column needs a formula after the = sign.');
    const ck=W.F.check(expr,null);
    if(ck.errors.length)throw new Error('The formula is not valid: '+ck.errors[0].message);
    return{name,expr,after}
  },
  examples:[
    {cfg:{name:'Total',expr:'[Qty] * [Price]',after:''},input:{cols:['Qty','Price'],rows:[['2','3.5'],['4','10']]},expect:{cols:['Qty','Price','Total'],rows:[['2','3.5','7'],['4','10','40']]}},
    {cfg:{name:'Label',expr:'UPPER(LEFT([Name],1)) & LOWER(MID([Name],2,20))',after:'Name'},input:{cols:['Name','Age'],rows:[['aLICE','3'],['bOB','4']]},expect:{cols:['Name','Label','Age'],rows:[['aLICE','Alice','3'],['bOB','Bob','4']]}},
    {cfg:{name:'Inverse',expr:'1/[n]',after:''},input:{cols:['n'],rows:[['2'],['0'],['x']]},expect:{cols:['n','Inverse'],rows:[['2','0.5'],['0','#DIV/0!'],['x','#VALUE!']]}},
    {cfg:{name:'Due',expr:'[Start] + 30',after:''},input:{cols:['Start'],rows:[['2025-01-15'],['Mar 3, 2025']]},expect:{cols:['Start','Due'],rows:[['2025-01-15','2025-02-14'],['Mar 3, 2025','2025-04-02']]}},
    {cfg:{name:'Band',expr:'IF([Amount] >= 1000, "Large", IF([Amount] >= 100, "Medium", "Small"))',after:''},input:{cols:['Amount'],rows:[['$1,200.00'],['150'],['5'],['']]},expect:{cols:['Amount','Band'],rows:[['$1,200.00','Large'],['150','Medium'],['5','Small'],['','Small']]}}
  ]
});
})(typeof self!=='undefined'?self:globalThis);
