// tools/test/learn.test.js v0.1.0 – Etappe 5: Bewertung, Lernen, Sicherheitsfaktor, Austrocknungsrate
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seeded, patch, runMain, voltFor } = require('./helpers.js');

function ok(r) { assert.deepEqual(r.errors, []); assert.equal(r.stopped, true); }
const H = 3600;
function gift(dev, minAgo, sec, pctB) {
  patch(dev, 'st', { state: 'gegossen', ts: dev.unixtime() - minAgo * 60, sec: sec, pctB: pctB, pctA: null, rated: false, dryOk: false });
}

test('Bewertung 30 min nach der Gabe: eff_neu = Δ% / (sec − tDead), erster Lernwert', () => {
  const dev = seeded();
  gift(dev, 31, 70, 30);
  dev.voltage = voltFor(45);
  const r = runMain(dev);
  ok(r);
  const lrn = dev.kvsGet('lrn'), st = dev.kvsGet('st');
  assert.equal(lrn.eff, 0.3, '15 % / 50 s');
  assert.equal(st.rated, true);
  assert.equal(st.pctA, 45);
  assert.equal(st.state, 'sperre');
  assert.equal(st.dryOk, false);
  assert.match(r.log.join('\n'), /gelernt: eff_neu=0\.3 eff=0\.3/);
  assert.equal(dev.kvsGet('job').why, 'pause');
});

test('vor Ablauf der Einsickerzeit wird nicht bewertet', () => {
  const dev = seeded();
  gift(dev, 20, 70, 30);
  dev.voltage = voltFor(45);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').rated, false);
  assert.equal(dev.kvsGet('lrn').eff, null);
  assert.equal(dev.kvsGet('job').why, 'soak');
});

test('sanftes Nachziehen mit alpha und Begrenzung auf effMax', () => {
  const dev = seeded();
  patch(dev, 'lrn', { eff: 0.5 });
  gift(dev, 31, 70, 30);
  dev.voltage = voltFor(45);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').eff, 0.44, '0,7·0,5 + 0,3·0,3');
  const dev2 = seeded();
  gift(dev2, 31, 60, 5);
  dev2.voltage = voltFor(95);
  ok(runMain(dev2));
  assert.equal(dev2.kvsGet('lrn').eff, 2, '90/40 = 2,25 → effMax');
});

test('keine Wirkung: err noeff, kein Lernwert, nie mehr Wasser bis zum Löschen von err', () => {
  const dev = seeded();
  gift(dev, 31, 70, 30);
  dev.voltage = voltFor(31);
  const r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'noeff');
  assert.equal(dev.kvsGet('lrn').eff, null);
  assert.equal(dev.kvsGet('st').rated, true);
  assert.match(r.log.join('\n'), /ohne Wirkung/);
  // zwei Tage später, trocken, Pause abgelaufen: immer noch gesperrt
  dev.nowMs += 48 * H * 1000;
  dev.voltage = voltFor(20);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').ok, false);
  assert.equal(dev.kvsGet('job').why, 'err:noeff');
  dev.kvsDelete('err');
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').ok, true, 'nach dem Löschen von err wieder frei');
  assert.equal(dev.kvsGet('job').sec, 70, 'ohne Lernwert wieder tStd');
});

test('zu viel: Sicherheitsfaktor sinkt um sfStep bis sfMin, Hinweis zuviel bis zur nächsten Bewertung', () => {
  const dev = seeded();
  gift(dev, 31, 70, 40);
  dev.voltage = voltFor(70);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').sf, 0.9);
  assert.equal(dev.kvsGet('err').code, 'zuviel');
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, 'zuviel', 'bleibt bis zur nächsten Bewertung');
  patch(dev, 'lrn', { sf: 0.55 });
  gift(dev, 31, 70, 40);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').sf, 0.5, 'nicht unter sfMin');
  gift(dev, 31, 70, 40);
  dev.voltage = voltFor(55);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null, 'Bewertung im Zielband löscht zuviel');
  assert.equal(dev.kvsGet('lrn').sf, 0.5, 'Faktor steigt nicht von selbst');
});

test('Sicherheitsfaktor wirkt auf die Dosis', () => {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 17, 45, 0) });
  patch(dev, 'lrn', { eff: 0.5, sf: 0.6 });
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').sec, 50, '25/0,5·0,6 + 20');
});

test('Sensor beim Bewerten unplausibel: Bewertung wartet, kein noeff', () => {
  const dev = seeded();
  gift(dev, 31, 70, 30);
  dev.voltage = 0.02;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').rated, false);
  assert.equal(dev.kvsGet('err').code, 'sensor');
  dev.voltage = voltFor(45);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').rated, true);
  assert.equal(dev.kvsGet('lrn').eff, 0.3);
  assert.equal(dev.kvsGet('err').code, null);
});

test('Austrocknungsrate wird beim Tageswechsel persistiert', () => {
  const dev = seeded();
  const now = dev.unixtime();
  patch(dev, 'st', { state: 'sperre', ts: now - 30 * H, sec: 70, pctB: 30, pctA: 50, rated: true, dryOk: true });
  patch(dev, 'day', { date: '2026-09-11', n: 0, sec: 0 });
  dev.voltage = voltFor(40);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').rate, 0.339, '10 % in 29,5 h');
});

test('Abbruch-Gabe (rated ohne pctA) wird nicht bewertet und liefert keine Rate', () => {
  const dev = seeded();
  const now = dev.unixtime();
  patch(dev, 'st', { state: 'sperre', ts: now - 30 * H, sec: 35, pctB: 30, pctA: null, rated: true, dryOk: true });
  patch(dev, 'day', { date: '2026-09-11', n: 0, sec: 0 });
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').eff, null);
  assert.equal(dev.kvsGet('lrn').rate, null);
  assert.equal(dev.kvsGet('job').why, 'ok');
});
