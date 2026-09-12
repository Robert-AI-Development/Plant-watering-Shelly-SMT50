#!/usr/bin/env node
// tools/run-script.js v0.1.1 – ein Script gegen den Mock laufen lassen und Konsole + KVS ausgeben
// Aufruf: node tools/run-script.js scripts/bw_install.js [--seed] [--voltage 1.4] [--temp 24] [--level 0]
//   --seed      vorher bw_install.js laufen lassen und Beispiel-Zielband eintragen
//   --kvs k=v   KVS-Eintrag vor dem Lauf setzen (v als JSON), mehrfach möglich
//   --hwdemo    Simulation der Hardware-Tests: virtueller Bediener (Sensor-Rampen, go-Kommandos), bw_pump als zweites Script,
//               Laufzeit bis 60 min virtuell – z. B. node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo
'use strict';
const path = require('node:path');
const { Device, runScript } = require('./mock/shelly-mock.js');
const { ramps, driver } = require('./mock/hwdemo.js');

const args = process.argv.slice(2);
const file = args.find((a) => a.endsWith('.js'));
if (!file) { console.error('Aufruf: node tools/run-script.js scripts/<script>.js [Optionen]'); process.exit(2); }
const dev = new Device();
function opt(name, def) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; }
dev.voltage = parseFloat(opt('--voltage', '1.4'));
dev.tC = opt('--temp', '24') === 'null' ? null : parseFloat(opt('--temp', '24'));
dev.inputs[1] = opt('--level', '0') === '1';
if (args.includes('--seed')) {
  runScript(dev, path.join(__dirname, '..', 'scripts', 'bw_install.js'));
  const cfg2 = dev.kvsGet('cfg2');
  Object.assign(cfg2, { pctSoll: 55, pctLo: 40, pctHi: 65, pctDry: 38, dropSlow: 4 });
  dev.kvsSetRaw('cfg2', cfg2);
  dev.log.push('--- seed fertig ---');
}
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--kvs') { const kv = args[i + 1]; const k = kv.slice(0, kv.indexOf('=')); dev.kvsSetRaw(k, JSON.parse(kv.slice(k.length + 1))); }
}
const opts = {};
if (args.includes('--hwdemo')) {
  const name = path.basename(file, '.js');
  opts.maxMs = 60 * 60 * 1000;
  dev.nowMs = dev.bootMs = Date.UTC(2026, 8, 12, 8, 7, 0);   // 10:07 lokal: Taktlücke, kein Gießfenster
  opts.files = { bw_pump: path.join(__dirname, '..', 'scripts', 'bw_pump.js') };
  if (name === 'bw_hwtest') { ramps(dev); driver(dev); }
  if (name === 'bw_hwpump') driver(dev, { key: 'hwp' });
  dev.log.push('--- hwdemo: virtueller Bediener aktiv ---');
}
const r = runScript(dev, path.resolve(file), opts);
console.log('--- Konsole ---');
for (const l of r.log) console.log(l);
console.log('--- KVS (' + dev.kvsWrites + ' Schreibvorgänge im Lauf: ' + r.writes + ') ---');
for (const [k, v] of dev.kvs) console.log(k.padEnd(5), v.length.toString().padStart(3), v);
console.log('--- Zeitplan ---');
for (const j of dev.schedules) console.log(j.id, j.timespec, JSON.stringify(j.calls));
console.log('--- Switch 0 ---', JSON.stringify(dev.switches[0].config), 'output=' + dev.switches[0].output);
console.log('--- Ergebnis --- beendet=' + r.stopped + ' Dauer=' + r.elapsedMs + ' ms, max. offene RPC=' + dev.maxPendingRpc + ', max. Aufruftiefe=' + r.maxCallDepth + ', Fehler=' + r.errors.length);
for (const e of r.errors) console.log(e);
process.exit(r.errors.length || !r.stopped ? 1 : 0);
