import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile, FileBlob } from '@oai/artifact-tool';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'guest-hunting.xlsx');
try { await fs.access(target); throw new Error('Tracker already exists; initialization refuses to overwrite it.'); }
catch (e) { if (e.code !== 'ENOENT') throw e; }
const wb = Workbook.create();
const definitions = {
  'Guests': ['Name', 'Social media link, alternate link or phone no', 'Description', 'Fitment as per YouTube Guest Hunter', 'Status', 'Remark', 'Next follow-up date', 'Follow-up action'],
  'Processing Log': ['Filename', 'SHA-256', 'Guest identity', 'Processing status', 'Processed date', 'Archive path', 'Issue'],
  'Needs research': ['Name or visible handle', 'Screenshot', 'Issue', 'Sources checked', 'Last checked'],
  'Outreach History': ['Date', 'Guest identity', 'Status', 'Remark', 'Next follow-up date', 'Follow-up action'],
};
for (const [name, headers] of Object.entries(definitions)) {
  const s = wb.worksheets.add(name);
  const last = String.fromCharCode(64 + headers.length);
  s.getRange(`A1:${last}1`).values = [headers];
  s.showGridLines = false;
  s.freezePanes.freezeRows(1);
  s.getRange(`A1:${last}20`).format.font = {name:'Arial',size:11};
  s.getRange(`A1:${last}1`).format = {fill:'#24364B',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:48,verticalAlignment:'center'};
  s.getRange(`A1:${last}1`).format.columnWidth = 28;
  s.getRange(`A2:${last}1000`).format.wrapText = true;
  if (name === 'Guests') {
    s.tabColor = '#24364B';
    s.getRange('B1:D1').format.columnWidth = 48;
    s.getRange('E2:E1000').dataValidation = {rule:{type:'list',values:['Not contacted','Contacted','Replied','Follow-up needed','Booked','Completed','Declined','Do not contact']}};
    s.getRange('G2:G1000').setNumberFormat('dd-mmm-yyyy');
    s.getRange('E2:H1000').format.fill = '#FFF8E7';
    s.getRange('G2:G1000').conditionalFormats.addCustom('AND($A2<>"",ISNUMBER($G2),$G2<TODAY(),$E2<>"Booked",$E2<>"Completed",$E2<>"Declined",$E2<>"Do not contact")',{fill:'#FDE2E2',font:{color:'#9C2020'}});
  }
  if (name === 'Outreach History') {
    s.getRange('A2:A1000').setNumberFormat('dd-mmm-yyyy');
    s.getRange('E2:E1000').setNumberFormat('dd-mmm-yyyy');
  }
}
wb.recalculate();
const qa = path.join(root,'outputs','phase1-setup');
await fs.mkdir(qa,{recursive:true});
for (const name of Object.keys(definitions)) {
  const preview = await wb.render({sheetName:name,range:`A1:${name==='Guests'?'H':name==='Processing Log'?'G':name==='Needs research'?'E':'F'}4`,scale:1,format:'png'});
  await fs.writeFile(path.join(qa,`${name.replaceAll(' ','-')}.png`),new Uint8Array(await preview.arrayBuffer()));
}
const temp = path.join(qa,'guest-hunting.xlsx');
await (await SpreadsheetFile.exportXlsx(wb)).save(temp);
const reopened = await SpreadsheetFile.importXlsx(await FileBlob.load(temp));
for (const [name,headers] of Object.entries(definitions)) {
  const actual = reopened.worksheets.getItem(name).getRange(`A1:${String.fromCharCode(64+headers.length)}1`).values[0];
  if (JSON.stringify(actual)!==JSON.stringify(headers)) throw new Error(`Header mismatch: ${name}`);
}
await fs.copyFile(temp,target,fs.constants.COPYFILE_EXCL);
console.log('Created and reopened tracker; all four sheet headers verified.');
