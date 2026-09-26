'use strict';
const Xlsx={
  loading:null,
  load(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(this.loading)return this.loading;
    this.loading=new Promise((res,rej)=>{
      const s=document.createElement('script');s.src='vendor/xlsx.full.min.js';s.async=true;
      s.onload=()=>window.XLSX?res(window.XLSX):rej(new Error('The Excel reader did not start.'));
      s.onerror=()=>{this.loading=null;rej(new Error('The Excel reader (vendor/xlsx.full.min.js) could not be loaded.'))};
      document.head.appendChild(s)
    });
    return this.loading
  },
  isExcel(name){return/\.(xlsx|xlsm|xlsb|xls|ods|numbers)$/i.test(name||'')},
  async readFile(f){
    const X=await Busy.run('Loading the Excel reader',()=>this.load());
    const buf=await f.arrayBuffer();
    let wb;
    try{wb=X.read(buf,{type:'array',cellDates:false,cellText:true,dense:true})}
    catch(e){throw new Error('This spreadsheet could not be read: '+e.message)}
    const sheets=wb.SheetNames.map(n=>{const ws=wb.Sheets[n];const ref=ws['!ref'];let rows=0,cols=0;if(ref){const r=X.utils.decode_range(ref);rows=r.e.r-r.s.r+1;cols=r.e.c-r.s.c+1}return{name:n,rows,cols,hidden:!!(wb.Workbook&&wb.Workbook.Sheets&&(wb.Workbook.Sheets.find(s=>s.name===n)||{}).Hidden)}}).filter(s=>s.rows>0);
    if(!sheets.length)throw new Error('This workbook has no sheets with data.');
    let pick=sheets.find(s=>!s.hidden)||sheets[0];
    if(sheets.length>1){pick=await this.pickSheet(sheets,pick);if(!pick)return null}
    const ws=wb.Sheets[pick.name];
    const merges=(ws['!merges']||[]).length;
    const csv=X.utils.sheet_to_csv(ws,{FS:'\t',RS:'\n',blankrows:false,rawNumbers:false,strip:false,forceQuotes:false});
    return{text:csv,sheet:pick.name,sheets:sheets.length,merges}
  },
  pickSheet(sheets,def){
    return new Promise(res=>{
      let sel=sheets.indexOf(def);
      const body=h('div',{class:'dlg-body'},h('p',{class:'dlg-note'},'This workbook has '+plural(sheets.length,'sheet')+'. Pick the one to clean.'),
        sheets.map((s,i)=>h('label',{class:'radio'},h('input',{type:'radio',name:'sheet',checked:i===sel,onchange:()=>{sel=i}}),h('span',{},s.name,h('small',{},plural(s.rows,'row')+' × '+plural(s.cols,'column')+(s.hidden?' · hidden sheet':''))))));
      const d=Dialog.open({title:'Choose a sheet',body,foot:[h('span',{class:'grow-1'}),h('button',{class:'btn btn-secondary',type:'button',onclick:()=>{d.close(true);res(null)}},'Cancel'),h('button',{class:'btn btn-primary',type:'button',onclick:()=>{d.close(true);res(sheets[sel])}},'Open sheet')],onClose:()=>res(null)})
    })
  },
  async write(result,fileName,sheetName){
    const X=await Busy.run('Loading the Excel writer',()=>this.load());
    const data=JSON.parse(result.text);
    const aoa=[data.cols].concat(data.rows);
    const ws=X.utils.aoa_to_sheet(aoa,{cellDates:false});
    const types=data.types||[];
    if(ws['!ref']){
      const r=X.utils.decode_range(ws['!ref']);
      for(let R=1;R<=r.e.r;R++)for(let C=0;C<=r.e.c;C++){
        const a=X.utils.encode_cell({r:R,c:C});const cell=ws[a];if(!cell)continue;
        const v=String(cell.v);
        if(types[C]==='number'){const p=W.parseNumber(v,{locale:data.locales[C]||'us'});if(p&&v.trim()!==''){cell.t='n';cell.v=p.value;if(p.isPercent)cell.z='0.00%'}}
        else if(types[C]==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(v.trim())){cell.t='d';cell.v=v.trim();cell.z='yyyy-mm-dd'}
        else if(/^[=+\-@]/.test(v)&&!/^-?\d/.test(v)){cell.t='s'}
      }
      ws['!cols']=data.cols.map((c,i)=>{let w=String(c).length;for(let k=0;k<Math.min(200,data.rows.length);k++){const l=String(data.rows[k][i]==null?'':data.rows[k][i]).length;if(l>w)w=l}return{wch:Math.min(60,Math.max(8,w+2))}});
      ws['!autofilter']={ref:ws['!ref']};
      ws['!freeze']={xSplit:0,ySplit:1}
    }
    const wb=X.utils.book_new();
    X.utils.book_append_sheet(wb,ws,(sheetName||'Weft').replace(/[\\\/?*\[\]:]/g,' ').slice(0,31)||'Weft');
    X.writeFile(wb,fileName,{compression:true,bookType:'xlsx'})
  }
};
