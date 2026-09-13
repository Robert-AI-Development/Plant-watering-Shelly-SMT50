// tools/test/learn.test.js v0.2.0 – Etappe 10: Kontrolle nach dem Fenster (zuviel → sf, sink), dur, altes st, Austrocknungsrate
// bw_main lernt seit v0.2.0 nicht mehr (effW und noeff kommen aus dem Fenster, bw_pump); hier nur noch die Kontrolle.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seeded, patch, runMain, voltFor } = require('./helpers.js');

function ok(r) { assert.deepEqual(r.errors, []); assert.equal(r.stopped, true); }
const H = 3600;
// Fensterergebnis von bw_pump v0.2.0: gegossen, unkontrolliert, dur s bis Pumpe-aus der letzten Portion, pctW = letzte stabile Fensterablesung
function window(dev, minAgo, f) {
  patch(dev, 'st', Object.assign({ state: 'gegossen', ts: dev.unixtime() - minAgo * 60, dur: 100, n: 2, sec: 80, pctB: 30, pctW: 52, pctA: null, effW: 0.3, why: 'ok', tr: 12, rated: false, dryOk: true }, f || {}));
}

test('Kontrolle soak Minuten nach dem Fensterende: pctA, sperre, dryOk bleibt, kein Lernwert in bw_main', () => {
  const dev = seeded();
  patch(dev, 'lrn', { effW: 0.3, sf: 0.7 });
  window(dev, 32);                       // 32 min − 100 s dur = 1820 s ≥ soak 30 min
  dev.voltage = voltFor(50.04);
  const r = runMain(dev);
  ok(r);
  const lrn = dev.kvsGet('lrn'), st = dev.kvsGet('st');
  assert.equal(st.rated, true);
  assert.equal(st.pctA, 50, 'eine Nachkommastelle');
  assert.equal(st.state, 'sperre');
  assert.equal(st.dryOk, true, 'Kontrolle setzt keine Trockenphase mehr');
  assert.equal(lrn.effW, 0.3, 'effW unverändert: lernt nur bw_pump');
  assert.equal(lrn.sf, 0.7);
  assert.equal(dev.kvsGet('err').code, null);
  assert.match(r.log.join('\n'), /Kontrolle: 52 → 50 % sf=0\.7/);
  assert.equal(dev.kvsGet('job').why, 'pause');
});

test('Kontrolle rechnet ab Fensterende: ts + dur + soak', () => {
  const dev = seeded();
  dev.voltage = voltFor(50);
  window(dev, 25, { dur: 400 });         // 1500 s − 400 s = 1100 s < 1800 s
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').rated, false);
  assert.equal(dev.kvsGet('job').why, 'soak');
  window(dev, 37, { dur: 400 });         // 2220 s − 400 s = 1820 s
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').rated, true);
  assert.equal(dev.kvsGet('st').state, 'sperre');
});

test('zu viel: sf sinkt um sfStep bis sfMin, Hinweis zuviel bis zur nächsten Kontrolle; nicht doppelt nach why=over', () => {
  const dev = seeded();
  patch(dev, 'lrn', { effW: 0.3, sf: 1 });
  window(dev, 32, { pctW: 64 });
  dev.voltage = voltFor(63);             // > pctHi 60 + hyst 2
  const r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('lrn').sf, 0.9);
  assert.equal(dev.kvsGet('err').code, 'zuviel');
  assert.match(r.log.join('\n'), /Kontrolle: 64 → 63 % sf=0\.9 zuviel/);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, 'zuviel', 'bleibt bis zur nächsten Kontrolle');
  window(dev, 32, { pctW: 64, why: 'over' });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').sf, 0.9, 'bw_pump hat sf bei over schon gesenkt: kein zweiter Abzug');
  assert.equal(dev.kvsGet('err').code, null);
  patch(dev, 'lrn', { sf: 0.55 });
  window(dev, 32, { pctW: 64 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').sf, 0.5, 'nicht unter sfMin');
  assert.equal(dev.kvsGet('err').code, 'zuviel');
  window(dev, 32);
  dev.voltage = voltFor(61.5);           // über pctHi, aber innerhalb hyst
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null, 'Kontrolle unter pctHi + hyst löscht zuviel');
  assert.equal(dev.kvsGet('lrn').sf, 0.5, 'Faktor steigt in bw_main nicht');
});

test('eingebrochen: Abfall seit der Fensterablesung über dropW → Hinweis sink, nicht blockierend, bei der nächsten Kontrolle gelöscht', () => {
  const dev = seeded();
  window(dev, 32, { pctW: 55 });
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null, 'ohne dropW kein Hinweis');
  patch(dev, 'cfg2', { dropW: 20 });
  window(dev, 32, { pctW: 55 });
  const r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'sink');
  assert.match(r.log.join('\n'), /Kontrolle: 55 → 30 % sf=[\d.]+ sink/);
  assert.equal(dev.kvsGet('job').why, 'pause');
  patch(dev, 'st', { ts: dev.unixtime() - 30 * H });
  dev.voltage = voltFor(20);             // deutlich gesunken, sonst greift pauseSlow (48 h)
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').ok, true, 'sink blockiert den Auftrag nicht');
  assert.equal(dev.kvsGet('err').code, 'sink');
  window(dev, 32, { pctW: 55 });
  dev.voltage = voltFor(50);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null);
});

test('altes st (v0.1, ohne dur/pctW): Kontrolle ohne Fensterwert, kein Fehler, kein noeff', () => {
  const dev = seeded();
  patch(dev, 'st', { state: 'gegossen', ts: dev.unixtime() - 32 * 60, sec: 70, pctB: 30, pctA: null, rated: false, dryOk: false });
  dev.voltage = voltFor(31);             // praktisch keine Wirkung – früher noeff; ohne dur zählt sec (70 s) als Fensterdauer
  const r = runMain(dev);
  ok(r);
  const st = dev.kvsGet('st');
  assert.equal(st.rated, true);
  assert.equal(st.pctA, 31);
  assert.equal(st.state, 'sperre');
  assert.equal(dev.kvsGet('err').code, null);
  assert.equal(dev.kvsGet('lrn').effW, null);
  assert.match(r.log.join('\n'), /Kontrolle ohne Fensterwert/);
  assert.equal(dev.kvsGet('job').why, 'pause');
});

test('keine Wirkung im Fenster setzt in bw_main kein noeff mehr (das entscheidet bw_pump)', () => {
  const dev = seeded();
  patch(dev, 'lrn', { effW: 0.3 });
  window(dev, 32, { pctB: 30, pctW: 30, why: 'stall' });
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').rated, true);
  assert.equal(dev.kvsGet('err').code, null);
  assert.equal(dev.kvsGet('lrn').effW, 0.3);
});

test('Kontrolle wartet, solange das Band offen ist (kein sf-Abzug gegen null)', () => {
  const dev = seeded();
  patch(dev, 'cfg2', { pctOk: null });
  window(dev, 32, { pctW: 64 });
  dev.voltage = voltFor(63);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').rated, false);
  assert.equal(dev.kvsGet('job').why, 'cfg');
  patch(dev, 'cfg2', { pctOk: 50 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').rated, true);
});

test('Sicherheitsfaktor wirkt auf die Dosis', () => {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 17, 45, 0) });
  patch(dev, 'cfg3', { tMin: 40, tMax: 120 });
  patch(dev, 'lrn', { effW: 0.5, sf: 0.6 });
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').sec, 50, '25/0,5·0,6 + 20');
});

test('Sensor bei der Kontrolle unplausibel: Kontrolle wartet', () => {
  const dev = seeded();
  window(dev, 32);
  dev.voltage = 0.02;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').rated, false);
  assert.equal(dev.kvsGet('err').code, 'sensor');
  dev.voltage = voltFor(50);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').rated, true);
  assert.equal(dev.kvsGet('err').code, null);
});

test('Austrocknungsrate wird beim Tageswechsel persistiert, gerechnet ab Fensterende + soak', () => {
  const dev = seeded();
  const now = dev.unixtime();
  patch(dev, 'st', { state: 'sperre', ts: now - 30 * H, dur: 400, sec: 100, pctB: 30, pctW: 52, pctA: 50, why: 'ok', rated: true, dryOk: true });
  patch(dev, 'day', { date: '2026-09-11', n: 0, sec: 0 });
  dev.voltage = voltFor(40);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').rate, 0.34, '10 % in 30 h − 400 s − 30 min = 29,39 h');
});

test('Abbruch-Gabe (rated ohne pctA) wird nicht bewertet und liefert keine Rate', () => {
  const dev = seeded();
  const now = dev.unixtime();
  patch(dev, 'st', { state: 'sperre', ts: now - 30 * H, dur: 35, sec: 35, pctB: 30, pctW: null, pctA: null, why: 'abbruch', rated: true, dryOk: true });
  patch(dev, 'day', { date: '2026-09-11', n: 0, sec: 0 });
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').effW, null);
  assert.equal(dev.kvsGet('lrn').rate, null);
  assert.equal(dev.kvsGet('job').why, 'ok');
});
