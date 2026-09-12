// tools/test/kvs-size.test.js v0.1.1 – alle KVS-Werte bleiben unter 253 Zeichen (v0.1.1: Hardware-Test-Einträge)
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
    // Hardware-Test: Konfiguration, Berichte (Worst Case) und Sicherungen
    hwt: { tLo: 20, tHi: 30, vDryMax: 0.5, vWetMin: 2.5, dV: 0.03, nStab: 5, nNull: 10, msTick: 1000, nCmd: 2, nLog: 5, tPhase: 900, tAll: 3600, pumpSec: 30, tOn: 20, guardS: 90, winMin: 25, cal: 1, run: 'tml' },
    hwr: { run: 1789200000, s: 'abbruch', dur: 3600, mem: 123456, t: [-12.345, 85.123], m: [0.123, 3.123], l: [1, 0], chg: 123, r: 'ok,ok,ok,ok,ok,ok', cal: '0.2>0.123;3.13>3.123;1>0', n: 't1:sofort,cal:vWet-vDry<1V', w: 12 },
    hwp: { run: 1789200000, s: 'abbruch', dur: 3600, mem: 123456, pumpSec: 120, sec: 120, st: 'gegossen', why: 'abbruch', r: 'ok,ok,aw,aw', rec: 1, w: 12 },
    hwb1: { st: { state: 'gegossen', ts: 1789200000, sec: 120, pctB: 33.333, pctA: 55.555, rated: false, dryOk: false }, day: { date: '2026-09-12', n: 2, sec: 240 } },
    hwb2: { job: { ok: true, sec: 120, pct: 33.333, why: 'trocken', ts: 1789200000 }, err: { code: 'sensor', ts: 1789200000, mem: 123456 }, lrn: { eff: 0.123, sf: 0.9, rate: -0.456, tMean: 31.234, tMaxD: 38.5, tMaxY: 37.5 } },
  };
  for (const k of Object.keys(samples)) {
    const len = JSON.stringify(samples[k]).length;
    assert.ok(len <= KVS_MAX_VAL, k + ' hat ' + len + ' Zeichen');
  }
});
