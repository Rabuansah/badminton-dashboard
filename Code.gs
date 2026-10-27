/** BADMINTON TOURNAMENT DASHBOARD — Google Apps Script backend
 * Sheet tabs: Teams, Matches, Settings
 * Publish as Web App: Execute as you; access Anyone (read-only public endpoint).
 * Protect writes with Script Property ADMIN_KEY. Never put the key in public HTML.
 */
const SHEETS = { TEAMS: 'Teams', MATCHES: 'Matches', SETTINGS: 'Settings' };
const TARGET_SCORE = 42;
function setupTournament() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEETS.TEAMS, ['teamId','teamName','active','createdAt']);
  ensureSheet_(ss, SHEETS.MATCHES, ['matchId','teamAId','teamBId','status','scoreA','scoreB','round','updatedAt']);
  const settings = ensureSheet_(ss, SHEETS.SETTINGS, ['key','value']);
  if (settings.getLastRow() < 2) settings.getRange(2,1,3,2).setValues([
    ['eventTitle','Badminton Championship'],['targetScore',TARGET_SCORE],['switchSideAt',21]
  ]);
  const teams = ss.getSheetByName(SHEETS.TEAMS);
  if (teams.getLastRow() < 2) teams.getRange(2,1,7,4).setValues(
    ['Tim A','Tim B','Tim C','Tim D','Tim E','Tim F','Tim G'].map((n,i)=>['T'+(i+1),n,true,new Date()])
  );
  generateMissingMatches_();
  return 'Setup selesai. Buat Script Property ADMIN_KEY sebelum deploy.';
}
function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name); if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1); sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#145c43').setFontColor('#ffffff');
  return sh;
}
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'publicData';
    if (action !== 'publicData') return json_({ok:false,error:'Action tidak dikenal'});
    return json_({ok:true,data:getPublicData_(),generatedAt:new Date().toISOString()});
  } catch(err) { return json_({ok:false,error:String(err)}); }
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
    if (!expected) return json_({ok:false,error:'ADMIN_KEY belum disetel di Script Properties.'});
    if (!body.adminKey || body.adminKey !== expected) return json_({ok:false,error:'Kunci operator tidak valid.'});
    lock.waitLock(10000);
    let result;
    if (body.action === 'saveScore') result = saveScore_(body);
    else if (body.action === 'setStatus') result = setStatus_(body);
    else if (body.action === 'clearResult') result = clearResult_(body);
    else if (body.action === 'addTeam') result = addTeam_(body.teamName);
    else if (body.action === 'renameTeam') result = renameTeam_(body.teamId, body.teamName);
    else return json_({ok:false,error:'Action tidak dikenal.'});
    return json_({ok:true,result:result,data:getPublicData_()});
  } catch(err) { return json_({ok:false,error:String(err)}); }
  finally { try { lock.releaseLock(); } catch(_) {} }
}
function getPublicData_() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const teams=rows_(ss.getSheetByName(SHEETS.TEAMS)).filter(r=>r.teamId && truthy_(r.active)).map(r=>({id:String(r.teamId),name:String(r.teamName),active:true}));
  const matches=rows_(ss.getSheetByName(SHEETS.MATCHES)).filter(r=>r.matchId && teams.some(t=>t.id===String(r.teamAId)) && teams.some(t=>t.id===String(r.teamBId))).map(r=>({id:String(r.matchId),a:String(r.teamAId),b:String(r.teamBId),status:String(r.status||'Belum'),round:Number(r.round)||null,scoreA:r.scoreA===''||r.scoreA==null?null:Number(r.scoreA),scoreB:r.scoreB===''||r.scoreB==null?null:Number(r.scoreB),updatedAt:r.updatedAt?new Date(r.updatedAt).toISOString():null}));
  const settings=rows_(ss.getSheetByName(SHEETS.SETTINGS)).reduce((o,r)=>{if(r.key)o[String(r.key)]=r.value;return o;},{});
  return {eventTitle:settings.eventTitle||'Badminton Championship',targetScore:Number(settings.targetScore)||42,switchSideAt:Number(settings.switchSideAt)||21,teams,matches};
}
function generateMissingMatches_() {
  const ss=SpreadsheetApp.getActiveSpreadsheet(), t=rows_(ss.getSheetByName(SHEETS.TEAMS)).filter(r=>r.teamId&&truthy_(r.active));
  const sh=ss.getSheetByName(SHEETS.MATCHES), existing=rows_(sh).filter(r=>r.matchId);
  const keys=new Set(existing.map(r=>pairKey_(String(r.teamAId),String(r.teamBId))));
  let next=existing.reduce((n,r)=>Math.max(n,Number(String(r.matchId).replace(/\D/g,''))||0),0)+1;
  const add=[];
  for(let i=0;i<t.length;i++)for(let j=i+1;j<t.length;j++){
    const key=pairKey_(String(t[i].teamId),String(t[j].teamId)); if(keys.has(key))continue;
    add.push(['M'+String(next++).padStart(3,'0'),String(t[i].teamId),String(t[j].teamId),'Belum','','',null,new Date()]); keys.add(key);
  }
  if(add.length) sh.getRange(sh.getLastRow()+1,1,add.length,8).setValues(add);
  return add.length;
}
function saveScore_(b) {
  const a=Number(b.scoreA),c=Number(b.scoreB);
  if(!Number.isInteger(a)||!Number.isInteger(c)||a<0||c<0) throw Error('Skor harus berupa bilangan bulat positif atau nol.');
  if (Math.max(a,c) < TARGET_SCORE || Math.abs(a-c) < 2) throw Error('Skor akhir sah jika minimal satu tim mencapai 42 poin dan unggul sekurang-kurangnya 2 poin, misalnya 42–40 atau 41–43.');
  const row=findMatchRow_(b.matchId); if(!row)throw Error('Pertandingan tidak ditemukan.');
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.MATCHES); sh.getRange(row,4,1,5).setValues([['Selesai',a,c,sh.getRange(row,7).getValue(),new Date()]]);
  return 'Skor tersimpan.';
}
function setStatus_(b) { if(!['Belum','Berlangsung'].includes(b.status))throw Error('Status tidak valid.');const row=findMatchRow_(b.matchId);if(!row)throw Error('Pertandingan tidak ditemukan.');const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.MATCHES);if(sh.getRange(row,4).getValue()==='Selesai')throw Error('Hapus/koreksi hasil terlebih dahulu.');sh.getRange(row,4).setValue(b.status);sh.getRange(row,8).setValue(new Date());return 'Status diperbarui.'; }
function clearResult_(b) { const row=findMatchRow_(b.matchId);if(!row)throw Error('Pertandingan tidak ditemukan.');SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.MATCHES).getRange(row,4,1,5).setValues([['Belum','','','',new Date()]]);return 'Hasil dibatalkan.'; }
function addTeam_(name) { name=String(name||'').trim();if(!name)throw Error('Nama tim wajib diisi.');const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.TEAMS),all=rows_(sh);if(all.some(r=>truthy_(r.active)&&String(r.teamName).toLowerCase()===name.toLowerCase()))throw Error('Nama tim sudah digunakan.');const n=all.reduce((m,r)=>Math.max(m,Number(String(r.teamId||'').replace(/\D/g,''))||0),0)+1;sh.appendRow(['T'+n,name,true,new Date()]);const count=generateMissingMatches_();return `Tim ditambahkan; ${count} pasangan pertandingan baru dibuat.`; }
function renameTeam_(id,name) { name=String(name||'').trim();if(!name)throw Error('Nama tim wajib diisi.');const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.TEAMS),data=rows_(sh),idx=data.findIndex(r=>String(r.teamId)===String(id));if(idx<0)throw Error('Tim tidak ditemukan.');if(data.some((r,i)=>i!==idx&&truthy_(r.active)&&String(r.teamName).toLowerCase()===name.toLowerCase()))throw Error('Nama tim sudah digunakan.');sh.getRange(idx+2,2).setValue(name);return 'Nama tim diperbarui.'; }
function findMatchRow_(id) { const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.MATCHES);const vals=sh.getRange(2,1,Math.max(0,sh.getLastRow()-1),1).getValues();for(let i=0;i<vals.length;i++)if(String(vals[i][0])===String(id))return i+2;return null; }
function rows_(sh) { if(!sh||sh.getLastRow()<2)return [];const v=sh.getDataRange().getValues(),h=v.shift();return v.map(row=>h.reduce((o,k,i)=>(o[k]=row[i],o),{})); }
function pairKey_(a,b) { return [a,b].sort().join('|'); }
function truthy_(v) { return v===true||String(v).toLowerCase()==='true'||String(v)==='1'||String(v).toLowerCase()==='yes'; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
