// tools/put-script.js v0.1.0 – Script per RPC in Stücken hochladen und die Größe am Gerät prüfen
//
// Der Script-Editor der Web-UI hat beim Einfügen Text verloren (12.09.2026: 166 bzw. 210 Byte fehlten, LEARNING.md).
// Dieses Werkzeug schickt die Datei mit Script.PutCode in 1024-Zeichen-Stücken und vergleicht danach die
// Byte-Zahl am Gerät (Script.GetCode → left) mit der Datei. Node ≥ 20 (fetch), keine Abhängigkeiten.
//
// Aufruf: node tools/put-script.js <ip> <script-id> <datei>
//         node tools/put-script.js 192.168.88.10 2 dist/bw_main.js
// Das Script wird vorher gestoppt (Script.PutCode geht nur bei gestopptem Script).
'use strict';
const fs = require('node:fs');

const [ip, idArg, file] = process.argv.slice(2);
if (!ip || !idArg || !file) { console.error('Aufruf: node tools/put-script.js <ip> <script-id> <datei>'); process.exit(2); }
const id = Number(idArg);
const code = fs.readFileSync(file, 'utf8');
const bytes = Buffer.byteLength(code);
const CHUNK = 1024;   // Zeichen, nicht Byte – so wird kein UTF-8-Zeichen zerschnitten

async function rpc(method, params) {
  const r = await fetch('http://' + ip + '/rpc/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params), signal: AbortSignal.timeout(10000),
  });
  const j = await r.json();
  if (j && typeof j.code === 'number' && j.code < 0) throw new Error(method + ': ' + (j.message || j.msg));
  return j;
}

(async () => {
  await rpc('Script.Stop', { id: id }).catch(function () {});
  let len = 0, n = 0;
  for (let i = 0; i < code.length; i += CHUNK) {
    const r = await rpc('Script.PutCode', { id: id, code: code.slice(i, i + CHUNK), append: i > 0 });
    len = r.len; n++;
  }
  const g = await rpc('Script.GetCode', { id: id, len: 1 });
  const onDevice = g.left + 1;
  const ok = onDevice === bytes;
  console.log(file + ' → Script ' + id + ': ' + bytes + ' Byte in ' + n + ' Stücken gesendet, ' + onDevice + ' Byte am Gerät (PutCode len=' + len + ')' + (ok ? ' – OK' : ' – FEHLER, ' + (bytes - onDevice) + ' Byte fehlen'));
  process.exit(ok ? 0 : 1);
})().catch(function (e) { console.error('Fehler: ' + e.message); process.exit(1); });
