// tools/build.js v0.1.0 – Kompakt-Ausgabe der Scripts für den Upload: Kommentare, Einrückung und Leerzeilen weg
//
// Der Script-Speicher am Gerät ist begrenzt (Firmware ≥ 1.0.3 laut Forum ~15.000 Byte je Script; bw_main.js
// mit Kommentaren liegt darüber). scripts/ bleibt die lesbare Quelle, dist/ ist das, was in den Editor kommt.
// Zeile 1 (Versionskommentar) bleibt erhalten, damit das Script am Gerät erkennbar ist.
// `node tools/build.js --debug` setzt dabei `var DEBUG = 1;` – so kommt die Debug-Fassung ohne Handänderung im Editor aufs Gerät.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SCRIPT_MAX_BYTES = 15000;
const SRC = path.join(__dirname, '..', 'scripts');
const OUT = path.join(__dirname, '..', 'dist');
const NAMES = ['bw_install.js', 'bw_main.js', 'bw_pump.js'];

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

function compact(src, debug) {
  if (debug) src = src.replace(/^var DEBUG = 0;/m, 'var DEBUG = 1;');
  const lines = src.split('\n');
  const first = lines.shift();
  const out = [first];
  for (const l of lines.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
    const t = stripLineComment(l).trim();
    if (t) out.push(t);
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
    result.push({ name: name, bytes: bytes, srcBytes: Buffer.byteLength(src), code: code });
  }
  return result;
}

if (require.main === module) {
  const debug = process.argv.includes('--debug');
  let bad = false;
  for (const r of build(true, debug)) {
    const over = r.bytes > SCRIPT_MAX_BYTES;
    if (over) bad = true;
    console.log(r.name.padEnd(14) + String(r.srcBytes).padStart(6) + ' → ' + String(r.bytes).padStart(6) + ' Byte' + (over ? '  ÜBER LIMIT ' + SCRIPT_MAX_BYTES : ''));
  }
  console.log('dist/ geschrieben' + (debug ? ' (DEBUG = 1)' : '') + ' – hochladen mit node tools/put-script.js <ip> <id> dist/<datei>');
  process.exit(bad ? 1 : 0);
}

module.exports = { build, compact, SCRIPT_MAX_BYTES, NAMES };
