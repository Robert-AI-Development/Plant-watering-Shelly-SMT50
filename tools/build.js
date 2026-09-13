// tools/build.js v0.1.1 – Kompakt-Ausgabe der Scripts für den Upload: Kommentare, Einrückung und Leerzeilen weg, Geräte-Doku bleibt
//
// Warum kompakt: Der Script-Heap am Gerät (~25 KB, von allen Scripts geteilt) trägt die Codegröße mit; die Web-UI hat außerdem beim
// Einfügen großer Dateien Text verloren (LEARNING.md). scripts/ bleibt die lesbare Quelle, dist/ ist das, was aufs Gerät kommt.
// Zeile 1 (Versionskommentar) bleibt erhalten, damit das Script am Gerät erkennbar ist.
// v0.1.1: Kommentarzeilen, die mit `//!` beginnen, sind Geräte-Doku (kurz: was macht welche Einstellung) und bleiben als `// …`
// in der Kompakt-Ausgabe stehen – so ist jedes Script im Script-Editor des Shelly lesbar dokumentiert. Alle anderen Kommentare fallen weg.
// `node tools/build.js --debug` setzt dabei `var DEBUG = 1;` – so kommt die Debug-Fassung ohne Handänderung im Editor aufs Gerät.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SCRIPT_MAX_BYTES = 16000;   // Vorsichtsmaß für den geteilten Heap (Firmware 2.0.0 speichert auch 19 KB, LEARNING.md)
const MAX_BYTES = { 'bw_pump.js': 18000 };   // Ausnahme: bw_pump läuft dank Frist nie neben bw_main (Etappe 10); Heap-Spitze am Gerät messen
function limitFor(name) { return MAX_BYTES[name] || SCRIPT_MAX_BYTES; }
const SRC = path.join(__dirname, '..', 'scripts');
const OUT = path.join(__dirname, '..', 'dist');
const NAMES = ['bw_install.js', 'bw_main.js', 'bw_pump.js', 'bw_hwtest.js', 'bw_hwpump.js', 'bw_zeitraffer.js'];

// Zeilenkommentar ab dem ersten // außerhalb eines Strings abschneiden
function stripLineComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") q = ch;
    else if (ch === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

// Geräte-Doku-Zeilen einer Quelle: `//! text` → `// text`
function docLines(src) {
  const out = [];
  for (const l of src.split('\n')) {
    const t = l.trim();
    if (t.startsWith('//!')) out.push('//' + t.slice(3).replace(/\s+$/, ''));
  }
  return out;
}

function compact(src, debug) {
  if (debug) src = src.replace(/^var DEBUG = 0;/m, 'var DEBUG = 1;');
  const lines = src.split('\n');
  const first = lines.shift();
  const out = [first];
  for (const l of lines.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
    const t = l.trim();
    if (t.startsWith('//!')) { out.push('//' + t.slice(3).replace(/\s+$/, '')); continue; }
    const c = stripLineComment(l).trim();
    if (c) out.push(c);
  }
  return out.join('\n') + '\n';
}

function build(write, debug) {
  const result = [];
  if (write) fs.mkdirSync(OUT, { recursive: true });
  for (const name of NAMES) {
    const src = fs.readFileSync(path.join(SRC, name), 'utf8');
    const code = compact(src, debug);
    const bytes = Buffer.byteLength(code);
    if (write) fs.writeFileSync(path.join(OUT, name), code);
    result.push({ name: name, bytes: bytes, srcBytes: Buffer.byteLength(src), code: code, doc: docLines(src).length });
  }
  return result;
}

if (require.main === module) {
  const debug = process.argv.includes('--debug');
  let bad = false;
  for (const r of build(true, debug)) {
    const over = r.bytes > limitFor(r.name);
    if (over) bad = true;
    console.log(r.name.padEnd(16) + String(r.srcBytes).padStart(6) + ' → ' + String(r.bytes).padStart(6) + ' Byte, ' + r.doc + ' Doku-Zeilen' + (over ? '  ÜBER LIMIT ' + limitFor(r.name) : ''));
  }
  console.log('dist/ geschrieben' + (debug ? ' (DEBUG = 1)' : '') + ' – hochladen mit node tools/put-script.js <ip> <id> dist/<datei>, prüfen mit node tools/verify-scripts.js <ip>');
  process.exit(bad ? 1 : 0);
}

module.exports = { build, compact, docLines, limitFor, SCRIPT_MAX_BYTES, NAMES };
