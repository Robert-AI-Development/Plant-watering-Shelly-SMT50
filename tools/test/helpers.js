// tools/test/helpers.js v0.1.1 – gemeinsame Helfer für die Tests (v0.1.1: Hardware-Test-Scripts)
'use strict';
const path = require('node:path');
const { Device, runScript } = require('../mock/shelly-mock.js');

const SCRIPTS = path.join(__dirname, '..', '..', 'scripts');
const FILES = {
  bw_install: path.join(SCRIPTS, 'bw_install.js'),
  bw_main: path.join(SCRIPTS, 'bw_main.js'),
  bw_pump: path.join(SCRIPTS, 'bw_pump.js'),
  bw_hwtest: path.join(SCRIPTS, 'bw_hwtest.js'),
  bw_hwpump: path.join(SCRIPTS, 'bw_hwpump.js'),
};

// Beispiel-Zielband für Tests (am Gerät kommen die Werte aus den zwei Pflanzenmessungen)
const BAND = { pctSoll: 55, pctLo: 40, pctHi: 65, pctDry: 38, dropSlow: 4 };

// Spannung für einen Feuchtewert nach der Kalibrierung 0,20 V = 0 %, 3,13 V = 100 %
function voltFor(pct, cfg1) {
  const c = cfg1 || { vDry: 0.2, vWet: 3.13 };
  return c.vDry + (pct / 100) * (c.vWet - c.vDry);
}

// Gerät mit Installer-Startwerten und Zielband; Sensoren auf "feucht genug"
function seeded(opts) {
  opts = opts || {};
  const dev = new Device(opts);
  const r = runScript(dev, FILES.bw_install);
  if (!r.stopped || r.errors.length) throw new Error('Installer im Mock fehlgeschlagen: ' + r.errors.join('\n'));
  if (!opts.noBand) {
    const cfg2 = dev.kvsGet('cfg2');
    Object.assign(cfg2, BAND);
    dev.kvsSetRaw('cfg2', cfg2);
  }
  dev.kvsWrites = 0;
  dev.voltage = voltFor(50);
  dev.tC = 22;
  dev.inputs[1] = false; // 0 = Wasser vorhanden
  return dev;
}

function patch(dev, key, fields) {
  const v = dev.kvsGet(key) || {};
  Object.assign(v, fields);
  dev.kvsSetRaw(key, v);
  return v;
}

function runMain(dev, opts) { return runScript(dev, FILES.bw_main, opts); }
function runPump(dev, opts) { return runScript(dev, FILES.bw_pump, opts); }
// Hardware-Test-Scripts: Langläufer, deshalb maxMs 60 min; bw_hwpump startet bw_pump per Script.Start (registrierte Datei)
function runHwtest(dev, opts) { return runScript(dev, FILES.bw_hwtest, Object.assign({ maxMs: 60 * 60 * 1000 }, opts || {})); }
function runHwpump(dev, opts) { return runScript(dev, FILES.bw_hwpump, Object.assign({ maxMs: 60 * 60 * 1000, files: { bw_pump: FILES.bw_pump } }, opts || {})); }
// Pumpentest komplett: Durchgang A (Freigabe, Auftrag, Script.Start), dann läuft bw_pump allein weiter (virtuelle Uhr),
// dann Durchgang B (Bewertung, Rückbau) – nur wenn A eine Sicherung hinterlassen hat
function pumpTest(dev, opts) {
  const a = runHwpump(dev, opts);
  let b = null;
  if (dev.kvsRaw('hwb1') !== undefined || dev.kvsRaw('hwb2') !== undefined) {
    dev.advance(90 * 1000);
    b = runHwpump(dev, opts);
  }
  return { a: a, b: b, log: a.log.concat(b ? b.log : []), errors: a.errors.concat(b ? b.errors : []), stopped: a.stopped && (b === null || b.stopped), writes: a.writes + (b ? b.writes : 0), maxCallDepth: Math.max(a.maxCallDepth, b ? b.maxCallDepth : 0) };
}

// Gerätezustand vom 12.09.2026: Installer gelaufen, cfg2-Zielband null (→ err=cfg nach einem bw_main-Takt), Sensor in Erde (0,42 V),
// 23,9 °C, Wasser vorhanden (input:1 = false). Uhrzeit 10:07 lokal: Taktlücke, kein Gießfenster.
function hwDevice(opts) {
  const dev = seeded(Object.assign({ noBand: true, nowMs: Date.UTC(2026, 8, 12, 8, 7, 0) }, opts || {}));
  dev.voltage = 0.42;
  dev.tC = 23.9;
  dev.inputs[1] = false;
  runMain(dev);
  dev.kvsWrites = 0;
  return dev;
}

module.exports = { Device, runScript, FILES, BAND, voltFor, seeded, patch, runMain, runPump, runHwtest, runHwpump, pumpTest, hwDevice };
