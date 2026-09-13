// tools/put-script.js v0.1.2 – Script per RPC in Stücken hochladen und den Code am Gerät Byte für Byte prüfen; vorher Flash-Platz prüfen
//
// Der Script-Editor der Web-UI hat beim Einfügen Text verloren (12.09.2026: 166 bzw. 210 Byte fehlten, LEARNING.md).
// Dieses Werkzeug schickt die Datei mit Script.PutCode in 1024-Zeichen-Stücken und vergleicht danach die
// Code am Gerät (Script.GetCode, komplett) mit der Datei – byteidentisch, nicht nur gleich lang (tools/verify-scripts.js).
// Node ≥ 20 (fetch), keine Abhängigkeiten.
//
// Aufruf: node tools/put-script.js <ip> <script-id> <datei>
//         node tools/put-script.js 192.168.88.10 2 dist/bw_main.js
// Das Script wird vorher gestoppt (Script.PutCode geht nur bei gestopptem Script).
// Flash: Sys.GetStatus.fs_free plus der alte Code des Scripts (wird beim ersten Stück überschrieben) muss die neue Datei plus RESERVE fassen,
// sonst bricht der Upload ab, bevor das Gerät halb geschriebenen Code behält (LEARNING.md: fs_free 12 288 bei sechs Scripts) –
// Platz schaffen: node tools/hwtest.js <ip> scripts / delete <id> (engine_probe, bw_hwtest, bw_hwpump; PLAN Entscheidung 15).
'use strict';
const fs = require('node:fs');
const { getCode } = require('./verify-scripts.js');

const [ip, idArg, file] = process.argv.slice(2);
if (!ip || !idArg || !file) { console.error('Aufruf: node tools/put-script.js <ip> <script-id> <datei>'); process.exit(2); }
const id = Number(idArg);
const code = fs.readFileSync(file, 'utf8');
const bytes = Buffer.byteLength(code);
const CHUNK = 1024;   // Zeichen, nicht Byte – so wird kein UTF-8-Zeichen zerschnitten
const RESERVE = 4096; // Byte Flash, die nach dem Upload frei bleiben müssen (Dateisystem-Verwaltung, KVS-Schreiben)

async function rpc(method, params) {
  const r = await fetch('http://' + ip + '/rpc/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params), signal: AbortSignal.timeout(10000),
  });
  const j = await r.json();
  if (j && typeof j.code === 'number' && j.code < 0) throw new Error(method + ': ' + (j.message || j.msg));
  return j;
}

(async () => {
  const sys = await rpc('Sys.GetStatus', {});
  const old = await rpc('Script.GetCode', { id: id, len: 1 }).catch(function () { return { left: -1 }; });
  const oldBytes = Math.max(0, (old.left || 0) + 1);
  if (typeof sys.fs_free === 'number' && sys.fs_free + oldBytes < bytes + RESERVE) {
    console.error('Flash zu voll: fs_free ' + sys.fs_free + ' + alter Code ' + oldBytes + ' Byte < ' + bytes + ' + Reserve ' + RESERVE + ' – erst Platz schaffen (node tools/hwtest.js ' + ip + ' scripts / delete <id>)');
    process.exit(1);
  }
  await rpc('Script.Stop', { id: id }).catch(function () {});
  let len = 0, n = 0;
  for (let i = 0; i < code.length; i += CHUNK) {
    const r = await rpc('Script.PutCode', { id: id, code: code.slice(i, i + CHUNK), append: i > 0 });
    len = r.len; n++;
  }
  const back = await getCode(ip, id);
  const onDevice = Buffer.byteLength(back);
  const ok = back === code;
  const doc = back.split('\n').slice(1).filter((l) => /^\s*\/\//.test(l)).length;
  const after = await rpc('Sys.GetStatus', {}).catch(function () { return {}; });
  console.log(file + ' → Script ' + id + ': ' + bytes + ' Byte in ' + n + ' Stücken gesendet, ' + onDevice + ' Byte am Gerät (PutCode len=' + len + '), ' + doc + ' Doku-Zeilen' + (ok ? ' – OK, byteidentisch' : ' – FEHLER, Code weicht ab (' + (bytes - onDevice) + ' Byte Differenz)') + '; fs_free ' + sys.fs_free + ' → ' + after.fs_free);
  process.exit(ok ? 0 : 1);
})().catch(function (e) { console.error('Fehler: ' + e.message); process.exit(1); });
