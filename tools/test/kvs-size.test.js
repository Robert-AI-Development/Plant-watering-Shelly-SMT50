// tools/test/kvs-size.test.js v0.1.0 – alle KVS-Werte bleiben unter 253 Zeichen
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Device, runScript, FILES, KVS_MAX_VAL } = Object.assign({}, require('./helpers.js'), require('../mock/shelly-mock.js'));

test('Startwerte des Installers bleiben unter dem KVS-Limit', () => {
  const dev = new Device();
  runScript(dev, FILES.bw_install);
  for (const [k, v] of dev.kvs) assert.ok(v.length <= KVS_MAX_VAL, k + ' hat ' + v.length + ' Zeichen');
});

test('realistische Betriebswerte bleiben unter dem KVS-Limit', () => {
  const samples = {
    cfg2: { pctSoll: 55.5, pctLo: 40.5, pctHi: 65.5, pctDry: 38.5, hyst: 2.5, dropSlow: 4.5, effMin: 0.05, effMax: 2.0, alpha: 0.3, sfMin: 0.5, sfStep: 0.1 },
    lrn: { eff: 0.123, sf: 0.9, rate: -0.456, tMean: 31.234, tMaxD: 38.5, tMaxY: 37.5 },
    st: { state: 'gegossen', ts: 1789200000, sec: 120, pctB: 33.333, pctA: 55.555, rated: false, dryOk: false },
    job: { ok: true, sec: 120, pct: 33.333, why: 'trocken', ts: 1789200000 },
    day: { date: '2026-09-12', n: 2, sec: 240 },
    err: { code: 'sensor', ts: 1789200000, mem: 123456 },
  };
  for (const k of Object.keys(samples)) {
    const len = JSON.stringify(samples[k]).length;
    assert.ok(len <= KVS_MAX_VAL, k + ' hat ' + len + ' Zeichen');
  }
});
