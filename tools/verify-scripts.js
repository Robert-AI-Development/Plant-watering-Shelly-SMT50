// tools/verify-scripts.js v0.1.1 – Prüfung 2: Code jedes Scripts am Gerät Byte für Byte mit dist/ vergleichen, Doku-Block zählen, Versionen (bw_main = bw_pump)
//
// Der Script-Editor der Web-UI zeigt nur, was am Gerät liegt – ob das vollständig ist, sieht man ihm nicht an (LEARNING.md: beim
// Einfügen fehlten 166/210 Byte). Dieses Werkzeug lädt den Code per Script.GetCode komplett herunter, vergleicht ihn mit der
// Kompakt-Ausgabe in dist/ und zählt die Geräte-Doku-Zeilen (Kommentare im Kopf, die der Build stehen lässt).
// Aufruf: node tools/verify-scripts.js <ip> [name …]      (ohne Namen: alle Scripts am Gerät, die es in dist/ gibt)
// Exit-Code 0 = alle gleich, 1 = Abweichung oder Fehler, 2 = Aufruffehler. Node ≥ 20 (fetch), keine Abhängigkeiten.
// put-script.js ruft verifyOne() nach jedem Upload auf.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist');

async function rpc(ip, method, params) {
  const r = await fetch('http://' + ip + '/rpc/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params || {}), signal: AbortSignal.timeout(15000),
  });
  const j = await r.json();
  if (j && typeof j.code === 'number' && j.code < 0) throw new Error(method + ': ' + (j.message || j.msg));
  return j;
}

// Kompletten Code holen: offset/len in Byte; nach jedem Stück um die tatsächlich gelieferten Byte weiterrücken
async function getCode(ip, id) {
  let code = '', off = 0;
  for (let i = 0; i < 64; i++) {
    const r = await rpc(ip, 'Script.GetCode', { id: id, offset: off, len: 8192 });
    const data = typeof r.data === 'string' ? r.data : '';
    code += data;
    off += Buffer.byteLength(data);
    if (!r.left || !data.length) break;
  }
  return code;
}

// Version aus dem Code (var VER = "x.y.z"); bw_main und bw_pump teilen sich st/job/lrn – ungleiche Versionen sind ein Fehler
function verOf(code) { const m = /var VER = "([^"]+)"/.exec(code || ''); return m ? m[1] : null; }

// Ein Script prüfen: {name, id, ok, onDevice, local, doc, first, ver} – local === null, wenn es keine dist-Datei gibt
async function verifyOne(ip, sc) {
  const file = path.join(DIST, sc.name + '.js');
  const local = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const code = await getCode(ip, sc.id);
  const doc = code.split('\n').slice(1).filter((l) => /^\s*\/\//.test(l)).length;
  let first = -1;
  if (local !== null && code !== local) { const n = Math.min(code.length, local.length); first = 0; while (first < n && code[first] === local[first]) first++; }
  return { name: sc.name, id: sc.id, ok: local !== null && code === local, onDevice: Buffer.byteLength(code), local: local === null ? null : Buffer.byteLength(local), doc: doc, first: first, ver: verOf(code) };
}

function report(v) {
  if (v.local === null) return 'Script ' + v.id + ' ' + v.name.padEnd(14) + ' ' + String(v.onDevice).padStart(6) + ' Byte am Gerät – keine dist-Datei (nicht geprüft)';
  return 'Script ' + v.id + ' ' + v.name.padEnd(14) + ' ' + String(v.onDevice).padStart(6) + ' Byte am Gerät, ' + String(v.local).padStart(6) + ' Byte dist/, ' + v.doc + ' Doku-Zeilen, v' + (v.ver || '?') + ' – '
    + (v.ok ? 'OK, byteidentisch' : 'WEICHT AB ab Zeichen ' + v.first + ' → node tools/put-script.js <ip> ' + v.id + ' dist/' + v.name + '.js');
}

async function verifyAll(ip, names) {
  const list = (await rpc(ip, 'Script.List')).scripts || [];
  const out = [];
  for (const sc of list) {
    if (names && names.length && !names.includes(sc.name)) continue;
    out.push(await verifyOne(ip, sc));
  }
  return out;
}

if (require.main === module) {
  const [ip, ...names] = process.argv.slice(2);
  if (!ip) { console.error('Aufruf: node tools/verify-scripts.js <ip> [name …]'); process.exit(2); }
  verifyAll(ip, names).then((res) => {
    let bad = 0;
    for (const v of res) { console.log(report(v)); if (v.local !== null && !v.ok) bad++; }
    const checked = res.filter((v) => v.local !== null).length;
    const vm = res.find((v) => v.name === 'bw_main'), vp = res.find((v) => v.name === 'bw_pump');
    if (vm && vp && vm.ver && vp.ver && vm.ver !== vp.ver) { console.log('VERSIONEN WEICHEN AB: bw_main v' + vm.ver + ', bw_pump v' + vp.ver + ' – beide hochladen (teilen st/job/lrn)'); bad++; }
    console.log(checked + ' Scripts mit dist/ verglichen, ' + (bad ? bad + ' Abweichungen' : 'alle byteidentisch'));
    process.exit(bad ? 1 : 0);
  }).catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
}

module.exports = { verifyOne, verifyAll, getCode, report, verOf };
