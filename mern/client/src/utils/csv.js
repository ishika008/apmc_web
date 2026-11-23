import { getPath } from './format.js';

export function exportCsv(rows,columns,filename) {
  const csv=[columns.map(([,label])=>label),...rows.map(row=>columns.map(([key])=>getPath(row,key)??''))]
    .map(line=>line.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}
