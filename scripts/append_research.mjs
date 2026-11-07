// Agent-reviewed research snapshot in; append safely to existing workbook.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const root=process.cwd();
const batch=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const runId=`run-${today}-${Date.now()}`;
const qa=path.join(root,'outputs',runId);
const target=path.join(root,'guest-hunting.xlsx');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const norm=m=>JSON.stringify(m.map(r=>r.map(v=>v??'')));
const lockPath=path.join(root,'.hunt.lock');
const lock=await fs.open(lockPath,'wx');
try {
 await fs.mkdir(qa,{recursive:true}); await fs.mkdir('backups',{recursive:true});
 const initial=await fs.readFile(target);
 const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(target));
 const s=wb.worksheets.getItem('Guests'), l=wb.worksheets.getItem('Processing Log');
 const old={};
 for(const [name,last] of [['Guests','H'],['Processing Log','G'],['Needs research','E'],['Outreach History','F']]) old[name]=wb.worksheets.getItem(name).getRange(`A1:${last}1000`).values;
 let guestRow=old.Guests.reduce((n,r,i)=>r[0]?i+2:n,2);
 let logRow=old['Processing Log'].reduce((n,r,i)=>r[0]?i+2:n,2);
 const firstGuest=guestRow, firstLog=logRow;
 const previous=await wb.render({sheetName:'Guests',range:`A${Math.max(1,guestRow-2)}:H${guestRow-1}`,scale:1,format:'png'});
 await fs.writeFile(path.join(qa,'before.png'),new Uint8Array(await previous.arrayBuffer()));
 const added=[],logs=[];
 for(const item of batch) {
  if(path.basename(item.filename)!==item.filename) throw Error('Input filename must be top-level');
  if(item.status==='Needs review' || item.status==='Needs research') {
   const hash=sha(await fs.readFile(path.join(root,'SrcImages',item.filename)));
   const record=[item.filename,hash,item.name||'',item.status,new Date(`${today}T00:00:00+05:30`),'',item.issue];
   l.getRange(`A${logRow}:G${logRow}`).values=[record];
   l.getRange(`A${logRow}:G${logRow}`).format.verticalAlignment='top';
   l.getRange(`A${logRow}:G${logRow}`).format.autofitRows();
   l.getRange(`E${logRow}`).setNumberFormat('dd-mmm-yyyy');
   logs.push(record);logRow++;continue;
  }
  if(item.duplicateOf || item.repeatOf) {
   const hash=sha(await fs.readFile(path.join(root,'SrcImages',item.filename)));
   const original=logs.find(r=>r[0]===(item.duplicateOf||item.repeatOf) && (item.repeatOf||r[1]===hash) && r[2]===item.name);
   if(!original) throw Error('Duplicate must match an earlier verified item in this batch');
   let destination=path.join(root,'SrcImages','Archive',today,item.filename);
   try{await fs.access(destination);destination=path.join(path.dirname(destination),`${path.parse(item.filename).name}-${hash.slice(0,8)}${path.extname(item.filename)}`);}catch(e){if(e.code!=='ENOENT')throw e;}
   const record=[item.filename,hash,item.name,'Duplicate',new Date(`${today}T00:00:00+05:30`),destination,item.repeatOf?`Same verified guest/profile as ${item.repeatOf}; no new research information. Research completed once.`:`Identical SHA-256 to ${item.duplicateOf}; research completed once.`];
   l.getRange(`A${logRow}:G${logRow}`).values=[record];
   l.getRange(`A${logRow}:G${logRow}`).format.verticalAlignment='top';
   l.getRange(`A${logRow}:G${logRow}`).format.autofitRows();
   l.getRange(`E${logRow}`).setNumberFormat('dd-mmm-yyyy');
   logs.push(record);logRow++;continue;
  }
  if(old.Guests.some(r=>String(r[0]).toLowerCase()===item.name.toLowerCase())) throw Error('Existing guest requires merge, not append');
  if(!item.contact.includes('https://')||item.sources.length<1) throw Error('Missing contact or sources');
  const hash=sha(await fs.readFile(path.join(root,'SrcImages',item.filename)));
  if(old['Processing Log'].some(r=>r[1]===hash)) throw Error('Previously processed image: use duplicate workflow');
  let destination=path.join(root,'SrcImages','Archive',today,item.filename);
  try{await fs.access(destination);destination=path.join(path.dirname(destination),`${path.parse(item.filename).name}-${hash.slice(0,8)}${path.extname(item.filename)}`);}catch(e){if(e.code!=='ENOENT')throw e;}
  const values=[item.name,`${item.contact}\nChecked: ${today}`,`${item.description}\nSources (checked ${today}):\n${item.sources.join('\n')}`,item.fitment,'Not contacted','','',''];
  s.getRange(`A${guestRow}:H${guestRow}`).values=[values];
  s.getRange(`A${guestRow}:H${guestRow}`).format.verticalAlignment='top';
  s.getRange(`A${guestRow}:H${guestRow}`).format.autofitRows();
  if(item.sharedImageWith) {
   const index=logs.findIndex(r=>r[0]===item.filename && r[1]===hash && r[2]===item.sharedImageWith);
   if(index<0)throw Error('Shared screenshot does not match earlier guest/hash');
   logs[index][2]+='\n'+item.name;
   logs[index][6]+=' Both named founders saved as separate guest rows.';
   l.getRange(`A${firstLog+index}:G${firstLog+index}`).values=[logs[index]];
   l.getRange(`A${firstLog+index}:G${firstLog+index}`).format.autofitRows();
   added.push(values);guestRow++;continue;
  }
  const record=[item.filename,hash,item.name,'Saved',new Date(`${today}T00:00:00+05:30`),destination,item.issue];
  l.getRange(`A${logRow}:G${logRow}`).values=[record];
  l.getRange(`A${logRow}:G${logRow}`).format.verticalAlignment='top';
  l.getRange(`A${logRow}:G${logRow}`).format.autofitRows();
  l.getRange(`E${logRow}`).setNumberFormat('dd-mmm-yyyy');
  added.push(values);logs.push(record);guestRow++;logRow++;
 }
 wb.recalculate();
 const preview=await wb.render({sheetName:'Guests',range:`A${firstGuest}:H${guestRow-1}`,scale:1,format:'png'});
 await fs.writeFile(path.join(qa,'new-guests.png'),new Uint8Array(await preview.arrayBuffer()));
 const logPreview=await wb.render({sheetName:'Processing Log',range:`A${firstLog}:G${logRow-1}`,scale:1,format:'png'});
 await fs.writeFile(path.join(qa,'new-log.png'),new Uint8Array(await logPreview.arrayBuffer()));
 const temp=path.join(qa,'guest-hunting.xlsx');
 await (await SpreadsheetFile.exportXlsx(wb)).save(temp);
 const saved=await SpreadsheetFile.importXlsx(await FileBlob.load(temp));
 for(const [name,last] of [['Guests','H'],['Processing Log','G'],['Needs research','E'],['Outreach History','F']]) {
  const stop=name==='Guests'?firstGuest-1:name==='Processing Log'?firstLog-1:1000;
  if(norm(saved.worksheets.getItem(name).getRange(`A1:${last}${stop}`).values)!==norm(old[name].slice(0,stop))) throw Error(`Existing ${name} changed`);
 }
 if(norm(saved.worksheets.getItem('Guests').getRange(`A${firstGuest}:H${guestRow-1}`).values)!==norm(added)) throw Error('New guest round-trip mismatch');
 const readLogs=saved.worksheets.getItem('Processing Log').getRange(`A${firstLog}:G${logRow-1}`).values;
 for(let i=0;i<logs.length;i++)for(const c of [0,1,2,3,5,6])if((logs[i][c]??'')!==(readLogs[i][c]??''))throw Error('Log round-trip mismatch');
 if(sha(await fs.readFile(target))!==sha(initial))throw Error('Workbook modified concurrently');
 await fs.writeFile(path.join(root,'backups',`guest-hunting-${runId}.xlsx`),initial,{flag:'wx'});
 const staged=path.join(root,`${runId}.tmp.xlsx`);
 await fs.copyFile(temp,staged,fs.constants.COPYFILE_EXCL);await fs.rename(staged,target);
 console.log(JSON.stringify({added:added.length,totalGuests:guestRow-2,preview:path.join(qa,'new-guests.png'),logPreview:path.join(qa,'new-log.png'),date:today,preservedExisting:true}));
}finally{await lock.close();await fs.unlink(lockPath);}
