// tools/test/helpers.js v0.1.0 – gemeinsame Helfer für die Tests
'use strict';
const path = require('node:path');
const { Device, runScript } = require('../mock/shelly-mock.js');

const SCRIPTS = path.join(__dirname, '..', '..', 'scripts');
const FILES = {
  bw_install: path.join(SCRIPTS, 'bw_install.js'),
  bw_main: path.join(SCRIPTS, 'bw_main.js'),
  bw_pump: path.join(SCRIPTS, 'bw_pump.js'),
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

module.exports = { Device, runScript, FILES, BAND, voltFor, seeded, patch, runMain, runPump };
