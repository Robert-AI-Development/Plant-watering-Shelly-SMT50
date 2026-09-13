// tools/test/kvs-size.test.js v0.1.3 – alle KVS-Werte bleiben unter 253 Zeichen (v0.1.2: Zeitraffer-Einträge; v0.1.3: cfg4, zrb4/zrb5, st mit Fensterfeldern)
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
  // Worst Case je Eintrag: alle Felder belegt, Dezimalstellen wie sie die Scripts (r3) und Handeinträge erzeugen
  const cfg2 = { pctSoll: 55.5, pctLo: 40.5, pctHi: 60.5, pctDry: 28.5, hyst: 2.5, dropSlow: 4.5, effMin: 0.05, effMax: 30.5, alpha: 0.3, sfMin: 0.5, sfStep: 0.1, pctOk: 50.5, dropW: 20.5, sfUp: 0.05 };
  const cfg4 = { tWin: 420.5, tTail: 20.5, nPort: 6, tPmin: 5.5, tPmax: 120.5, tSoak: 30.5, tStep: 5.5, tStab: 90.5, nStab: 4, dStab: 1.5, tDead2: 10.5, dEffMin: 2.5 };
  const lrn = { effW: 0.123, sf: 0.95, rate: -0.456, tMean: 31.234, tMaxD: 38.5, tMaxY: 37.5 };
  // st nach Etappe 10 (Fenster-Regelkreis): {state, ts, dur, n, sec, pctB, pctW, pctA, effW, why, tr, rated, dryOk}
  const st = { state: 'gegossen', ts: 1789200000, dur: 185.5, n: 6, sec: 180, pctB: 33.333, pctW: 51.234, pctA: 55.555, effW: 0.312, why: 'abbruch', tr: 14.5, rated: false, dryOk: false };
  const day = { date: '2026-09-12', n: 2, sec: 240 };
  const err = { code: 'sensor', ts: 1789200000, mem: 123456 };
  const job = { ok: true, sec: 120, pct: 33.333, why: 'kein_auftrag', ts: 1789200000 };
  const samples = {
    cfg2: cfg2,
    cfg4: cfg4,
    lrn: lrn,
    st: st,
    job: job,
    day: day,
    err: err,
    // Hardware-Test: Konfiguration, Berichte (Worst Case) und Sicherungen
    hwt: { tLo: 20, tHi: 30, vDryMax: 0.5, vWetMin: 2.5, dV: 0.03, nStab: 5, nNull: 10, msTick: 1000, nCmd: 2, nLog: 5, tPhase: 900, tAll: 3600, pumpSec: 30, tOn: 20, guardS: 90, winMin: 25, cal: 1, run: 'tml' },
    hwr: { run: 1789200000, s: 'abbruch', dur: 3600, mem: 123456, t: [-12.345, 85.123], m: [0.123, 3.123], l: [1, 0], chg: 123, r: 'ok,ok,ok,ok,ok,ok', cal: '0.2>0.123;3.13>3.123;1>0', n: 't1:sofort,cal:vWet-vDry<1V', w: 12 },
    hwp: { run: 1789200000, s: 'abbruch', dur: 3600, mem: 123456, pumpSec: 120, sec: 120, st: 'gegossen', why: 'abbruch', r: 'ok,ok,aw,aw', rec: 1, w: 12 },
    hwb1: { st: st, day: day },
    hwb2: { job: job, err: err, lrn: lrn },
    // Zeitraffer: Profil in cfg3, Sicherungen des Originals (nutzertypische Werte, Worst-Case-st) und Marke
    cfg3: { tDead: 2, tMin: 10, tStd: 12, tMax: 40, tHot: 30, pauseHot: 0.1, pause: 0.2, pauseSlow: 0.35, soak: 0.25, jobAge: 5, maxDay: 4, tChk: 1, winA: '08:00', winB: '20:00', tick: 3, winEvery: 6, dryDay: null },
    zrb1: { cfg3: { tDead: 25, tMin: 45, tStd: 75, tMax: 185, tHot: 33.5, pauseHot: 12.5, pause: 24.5, pauseSlow: 48.5, soak: 35, jobAge: 25, maxDay: 3, tChk: 5, winA: '07:30', winB: '19:45', tick: 15, winEvery: null, dryDay: 5 } },
    zrb2: { lrn: lrn, day: day },
    zrb3: { st: st, err: err },
    zrb4: { cfg4: cfg4 },
    zrb5: { cfg2: cfg2 },
    zr: { go: 1 },
  };
  for (const k of Object.keys(samples)) {
    const len = JSON.stringify(samples[k]).length;
    assert.ok(len <= KVS_MAX_VAL, k + ' hat ' + len + ' Zeichen');
  }
});
