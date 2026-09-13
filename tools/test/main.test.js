// tools/test/main.test.js v0.2.0 – Etappe 2, 3 und 10: bw_main misst, prüft das Band, entscheidet; Dosis mit effW, Trockenphase, Nachholfenster
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seeded, patch, runMain, voltFor } = require('./helpers.js');

function ok(r) { assert.deepEqual(r.errors, []); assert.equal(r.stopped, true, 'Script hat sich nicht beendet'); }
const H = 3600;

test('misst plausibel, erste Gabe mit tStd, Laufzeit unter 5 s, ein RPC und ein Timer offen', () => {
  const dev = seeded();
  dev.voltage = voltFor(34);
  const tStart = dev.unixtime();
  const r = runMain(dev);
  ok(r);
  const job = dev.kvsGet('job');
  assert.equal(job.ok, true);
  assert.equal(job.sec, 70, 'erste Gabe = tStd');
  assert.equal(job.why, 'ok');
  assert.ok(Math.abs(job.pct - 34) < 0.01, 'pct ' + job.pct);
  assert.equal(job.ts, tStart, 'job.ts = Zeit des Takts');
  assert.ok(r.elapsedMs < 5000, 'Laufzeit ' + r.elapsedMs);
  assert.equal(dev.maxPendingRpc, 1);
  assert.equal(dev.maxTimersUsed, 1);
  assert.equal(dev.kvsGet('day').date, '2026-09-12');
  assert.equal(dev.kvsGet('lrn').tMaxD, 22, 'Tagesmaximum in 2-°C-Schritten');
  assert.match(r.log.join('\n'), /V=1\.196 pct=34 tC=22 lvl=0 st=beob/);
});

test('Mittelwert der mittleren Werte: Ausreißer fallen weg', () => {
  const dev = seeded();
  const seq = [voltFor(50), voltFor(50), 0.0, voltFor(50), 3.3];
  let i = 0;
  dev.voltage = () => seq[i++ % seq.length];
  ok(runMain(dev));
  assert.ok(Math.abs(dev.kvsGet('job').pct - 50) < 0.01);
  assert.equal(dev.kvsGet('err').code, null);
});

test('fehlendes Pflichtfeld: err cfg, laufender Auftrag zurückgenommen, nichts gemessen', () => {
  const dev = seeded();
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').ok, true);
  patch(dev, 'cfg3', { tMax: null });
  const r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.equal(dev.kvsGet('job').ok, false);
  assert.equal(dev.kvsGet('job').why, 'cfg');
  assert.match(r.log.join('\n'), /cfg3\.tMax fehlt/);
  assert.equal(r.elapsedMs < 500, true, 'kein Messtimer gelaufen');
  patch(dev, 'cfg3', { tMax: 120 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null, 'cfg-Störung löscht sich selbst');
  assert.equal(dev.kvsGet('job').ok, true);
});

test('offenes Zielband (null): messen und protokollieren, aber kein Auftrag, err cfg', () => {
  const dev = seeded({ noBand: true });
  dev.voltage = voltFor(30);
  const r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('job').ok, false);
  assert.equal(dev.kvsGet('job').why, 'cfg');
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.match(r.log.join('\n'), /pct=30/);
});

test('pctOk fehlt (null): Band offen → why cfg, err cfg, gemessen wird trotzdem', () => {
  const dev = seeded();
  patch(dev, 'cfg2', { pctOk: null });
  dev.voltage = voltFor(30);
  const r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('job').ok, false);
  assert.equal(dev.kvsGet('job').why, 'cfg');
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.match(r.log.join('\n'), /pct=30/);
  assert.doesNotMatch(r.log.join('\n'), /Band ungültig/, 'offenes Band ist keine Ordnungsverletzung');
  patch(dev, 'cfg2', { pctOk: 50 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null);
  assert.equal(dev.kvsGet('job').why, 'ok');
});

test('Bandprüfung: pctDry<pctLo<pctOk<=pctSoll<pctHi und pctLo+hyst<pctOk, sonst Störung cfg (selbstlöschend, nichts gemessen)', () => {
  const dev = seeded();
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').ok, true);
  function bad(fields, what) {
    const keep = Object.assign({}, dev.kvsGet('cfg2'));
    patch(dev, 'cfg2', fields);
    const r = runMain(dev);
    ok(r);
    assert.equal(dev.kvsGet('err').code, 'cfg', what);
    assert.equal(dev.kvsGet('job').ok, false, what);
    assert.equal(dev.kvsGet('job').why, 'cfg', what);
    assert.match(r.log.join('\n'), /cfg2: Band ungültig/, what);
    assert.ok(r.elapsedMs < 500, 'kein Messtimer gelaufen: ' + what);
    dev.kvsSetRaw('cfg2', keep);
    ok(runMain(dev));
    assert.equal(dev.kvsGet('err').code, null, 'löscht sich selbst: ' + what);
    assert.equal(dev.kvsGet('job').ok, true, what);
  }
  bad({ pctOk: 56 }, 'pctOk > pctSoll');
  bad({ pctOk: 41 }, 'pctLo + hyst >= pctOk');
  bad({ pctOk: 42 }, 'pctLo + hyst = pctOk ist nicht kleiner');
  bad({ pctDry: 40 }, 'pctDry = pctLo');
  bad({ pctHi: 55 }, 'pctSoll = pctHi');
  bad({ pctLo: 50 }, 'pctLo = pctOk');
  patch(dev, 'cfg2', { pctOk: 55 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null, 'pctOk = pctSoll ist erlaubt');
});

test('Sensor unplausibel: err sensor, kein Auftrag; wieder plausibel: err gelöscht', () => {
  const dev = seeded();
  dev.voltage = 0.05;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, 'sensor');
  assert.equal(dev.kvsGet('job').why, 'sensor');
  dev.voltage = null;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, 'sensor');
  dev.voltage = 3.4;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, 'sensor');
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null);
  assert.equal(dev.kvsGet('job').why, 'ok');
});

test('Uhrzeit ungültig: err uhr, Auftrag zurückgenommen', () => {
  const dev = seeded();
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  dev.timeValid = false;
  const r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'uhr');
  assert.equal(dev.kvsGet('job').ok, false);
  assert.equal(dev.kvsGet('job').why, 'uhr');
  dev.timeValid = true;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null);
});

test('Tageswechsel: day zurückgesetzt, Tagesmaximum weitergereicht, limit gelöscht', () => {
  const dev = seeded();
  patch(dev, 'day', { date: '2026-09-11', n: 2, sec: 140 });
  patch(dev, 'lrn', { tMaxD: 31, tMaxY: 28, tMean: 30 });
  patch(dev, 'err', { code: 'limit', ts: 1, mem: 1 });
  dev.tC = 19;
  ok(runMain(dev));
  const day = dev.kvsGet('day'), lrn = dev.kvsGet('lrn');
  assert.deepEqual(day, { date: '2026-09-12', n: 0, sec: 0 });
  assert.equal(lrn.tMaxY, 31);
  assert.equal(lrn.tMaxD, 20, '19 °C in 2-°C-Schritten');
  assert.equal(lrn.tMean, 30.1);
  assert.equal(dev.kvsGet('err').code, null);
  assert.equal(dev.kvsGet('err').mem, dev.ramFree, 'Speicherstand täglich protokolliert');
});

test('lokales Datum aus Sys.time und unixtime, auch über Mitternacht', () => {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 22, 30, 0), tzOffsetMin: 120 }); // 00:30 lokal am 13.09.
  ok(runMain(dev));
  assert.equal(dev.kvsGet('day').date, '2026-09-13');
  const dev2 = seeded({ nowMs: Date.UTC(2026, 0, 1, 3, 0, 0), tzOffsetMin: -300 }); // 31.12. 22:00 lokal (UTC-5)
  ok(runMain(dev2));
  assert.equal(dev2.kvsGet('day').date, '2025-12-31');
});

test('Freigabekette: wasser, lvl, limit, soak, pause, trocken, feucht, Klemme tMin', () => {
  const dev = seeded();
  const now = dev.unixtime();
  dev.voltage = voltFor(30);

  dev.inputs[1] = true; // 1 = leer
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'wasser');
  assert.equal(dev.kvsGet('err').code, 'wasser');

  let k = 0;
  dev.inputs[1] = () => (k++ % 2 === 0);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'lvl');
  assert.equal(dev.kvsGet('err').code, 'wasser', 'unstabiler Stand löscht keine Störung');
  dev.inputs[1] = false;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null);
  dev.inputs[1] = () => (k++ % 2 === 0);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'lvl');
  assert.equal(dev.kvsGet('err').code, null, 'unstabiler Stand ist keine Störung');
  dev.inputs[1] = false;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null);
  assert.equal(dev.kvsGet('job').why, 'ok');

  patch(dev, 'day', { n: 2 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'limit');
  patch(dev, 'day', { n: 0 });

  patch(dev, 'st', { state: 'gegossen', ts: now - 10 * 60, dur: 70, sec: 70, pctB: 30, pctW: 52, pctA: null, rated: false, dryOk: true });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'soak');

  patch(dev, 'st', { state: 'sperre', ts: now - 10 * H, sec: 70, pctB: 30, pctA: 50, rated: true, dryOk: true });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'pause');
  patch(dev, 'st', { state: 'sperre', ts: now - 23 * H, sec: 70, pctB: 30, pctA: 50, rated: true, dryOk: true });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'pause', '23 h: auch mit Toleranz noch nicht');
  patch(dev, 'st', { state: 'sperre', ts: now - 23.5 * H, sec: 70, pctB: 30, pctA: 50, rated: true, dryOk: true });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'ok', '23,5 h: Pause ist beim nächsten Fenster abgelaufen (ein Takt Toleranz)');

  patch(dev, 'st', { state: 'sperre', ts: now - 30 * H, sec: 70, pctB: 30, pctA: 60, rated: true, dryOk: false });
  dev.voltage = voltFor(39);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'trocken');
  assert.equal(dev.kvsGet('st').dryOk, false);
  dev.voltage = voltFor(29);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'trocken', '29 % ist noch nicht unter pctDry 28');
  dev.voltage = voltFor(27);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').dryOk, true);
  assert.equal(dev.kvsGet('st').state, 'beob');
  assert.equal(dev.kvsGet('job').why, 'ok');

  dev.voltage = voltFor(50);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'feucht');

  patch(dev, 'lrn', { effW: 5, sf: 1 });
  dev.voltage = voltFor(39.5);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'ok', 'kein why tmin mehr');
  assert.equal(dev.kvsGet('job').sec, dev.kvsGet('cfg3').tMin, '(55-39.5)/5 + 20 = 23,1 s → auf tMin geklemmt');
});

test('Hysterese an der Untergrenze', () => {
  const dev = seeded();
  dev.voltage = voltFor(39);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').ok, true);
  dev.voltage = voltFor(41);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').ok, true, 'laufender Auftrag bleibt bis pctLo + hyst');
  dev.voltage = voltFor(42.5);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'feucht');
  dev.voltage = voltFor(41);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'feucht', 'ohne laufenden Auftrag gilt pctLo');
});

test('Dosis: (pctSoll − ist) / effW · sf + tDead, geklemmt auf tMin..tMax', () => {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 17, 45, 0) }); // 19:45 lokal: job wird jeden Takt aufgefrischt
  patch(dev, 'cfg3', { tMin: 40, tMax: 120 });
  patch(dev, 'lrn', { effW: 0.5, sf: 1 });
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').sec, 70, '25/0.5 + 20');
  patch(dev, 'lrn', { effW: 0.5, sf: 0.8 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').sec, 60, '25/0.5·0.8 + 20');
  patch(dev, 'lrn', { effW: 0.5, sf: 0.7 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').sec, 55, '25/0.5·0.7 + 20: Startwert sf 0,7 (Erstportion unter dem Ziel)');
  patch(dev, 'lrn', { effW: 0.1, sf: 1 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').sec, 120, 'auf tMax begrenzt');
  patch(dev, 'lrn', { effW: 5, sf: 1 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').sec, 40, '25/5 + 20 = 25 s → auf tMin geklemmt, Auftrag bleibt ok');
  patch(dev, 'lrn', { eff: 0.5, effW: null, sf: 1 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').sec, 70, 'altes lrn.eff wird ignoriert, ohne effW gilt tStd');
});

test('Pausenregel dreistufig: Hitze 12 h, geringe Abnahme 48 h, sonst 24 h', () => {
  const dev = seeded();
  const now = dev.unixtime();
  dev.voltage = voltFor(30);
  // 13 h nach der Gabe, Trockenphase erfüllt
  patch(dev, 'st', { state: 'sperre', ts: now - 13 * H, sec: 70, pctB: 20, pctA: 50, rated: true, dryOk: true });
  patch(dev, 'lrn', { tMaxY: 30, tMaxD: 30 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'pause', 'normal 24 h');
  patch(dev, 'lrn', { tMaxY: 36 });
  const r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('job').why, 'ok', 'Tagesmaximum gestern > tHot → 12 h');
  assert.match(r.log.join('\n'), /pause=12h/);
  // 30 h nach der Gabe, Feuchte kaum gesunken → 48 h
  patch(dev, 'lrn', { tMaxY: 20, tMaxD: 20 });
  patch(dev, 'st', { state: 'sperre', ts: now - 30 * H, sec: 70, pctB: 20, pctA: 32, rated: true, dryOk: true });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'pause', 'Abnahme 2 % in 29,5 h → 1,6 %/24 h < dropSlow 4');
  assert.match(runMain(dev).log.join('\n'), /pause=48h/);
  // deutliche Abnahme → 24 h reichen
  patch(dev, 'st', { state: 'sperre', ts: now - 30 * H, sec: 70, pctB: 20, pctA: 45, rated: true, dryOk: true });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'ok');
});

test('Nachholfenster: nach why max/zeit mit Kontrollwert unter pctLo gilt pauseHot, nicht in der Trockenphase', () => {
  const dev = seeded();
  const now = dev.unixtime();
  dev.voltage = voltFor(30);
  const st = { state: 'sperre', ts: now - 13 * H, dur: 200, n: 6, sec: 180, pctB: 20, pctW: 32, pctA: 30, why: 'max', rated: true, dryOk: true };
  patch(dev, 'st', st);
  let r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('job').why, 'ok', 'Portionen erschöpft, Feuchte unter pctLo → 12 h');
  assert.match(r.log.join('\n'), /pause=12h/);
  patch(dev, 'st', Object.assign({}, st, { why: 'zeit' }));
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'ok', 'Frist erreicht → 12 h');
  patch(dev, 'st', Object.assign({}, st, { why: 'ok' }));
  r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('job').why, 'pause', 'normales Fensterende → 24 h');
  assert.match(r.log.join('\n'), /pause=24h/);
  patch(dev, 'st', Object.assign({}, st, { pctA: 45 }));
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'pause', 'max, aber Kontrollwert über pctLo → 24 h');
  patch(dev, 'st', Object.assign({}, st, { dryOk: false }));
  r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('job').why, 'pause', 'Trockenphase: kein Nachholfenster');
  assert.match(r.log.join('\n'), /pause=24h/);
});

test('Trockentag: Tageswechsel auf cfg3.dryDay startet die Trockenphase, Ende erst unter pctDry', () => {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 18, 4, 0, 0) }); // Freitag 18.09.2026, 06:00 lokal
  patch(dev, 'cfg3', { dryDay: 5 });
  patch(dev, 'day', { date: '2026-09-17', n: 1, sec: 70 });
  dev.voltage = voltFor(35);
  let r = runMain(dev);
  ok(r);
  let st = dev.kvsGet('st');
  assert.equal(st.state, 'sperre');
  assert.equal(st.rated, true);
  assert.equal(st.dryOk, false);
  assert.equal(dev.kvsGet('job').why, 'trocken');
  assert.match(r.log.join('\n'), /Trockenphase \(Wochentag 5\): warte auf < 28 %/);
  assert.equal(dev.kvsGet('day').date, '2026-09-18');
  r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('job').why, 'trocken', 'bleibt über dem Tag');
  assert.doesNotMatch(r.log.join('\n'), /Trockenphase/, 'Konsolenzeile nur beim Start');
  dev.voltage = voltFor(28.5);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'trocken', '28,5 % ist nicht unter 28');
  dev.voltage = voltFor(27);
  ok(runMain(dev));
  st = dev.kvsGet('st');
  assert.equal(st.dryOk, true);
  assert.equal(st.state, 'beob');
  assert.equal(dev.kvsGet('job').why, 'ok');
  assert.equal(dev.kvsGet('job').sec, 70);
});

test('Trockentag: Samstag-Wechsel und dryDay null starten keine Trockenphase; Freitag ohne Tageswechsel auch nicht', () => {
  const sat = seeded({ nowMs: Date.UTC(2026, 8, 19, 4, 0, 0) }); // Samstag 19.09.
  patch(sat, 'cfg3', { dryDay: 5 });
  patch(sat, 'day', { date: '2026-09-18', n: 0, sec: 0 });
  sat.voltage = voltFor(35);
  let r = runMain(sat);
  ok(r);
  assert.equal(sat.kvsGet('st').state, 'beob');
  assert.equal(sat.kvsGet('job').why, 'ok');
  assert.doesNotMatch(r.log.join('\n'), /Trockenphase/);
  const off = seeded({ nowMs: Date.UTC(2026, 8, 18, 4, 0, 0) }); // Freitag, Trockentag aus
  patch(off, 'cfg3', { dryDay: null });
  patch(off, 'day', { date: '2026-09-17', n: 0, sec: 0 });
  off.voltage = voltFor(35);
  r = runMain(off);
  ok(r);
  assert.equal(off.kvsGet('st').state, 'beob');
  assert.equal(off.kvsGet('job').why, 'ok');
  assert.doesNotMatch(r.log.join('\n'), /Trockenphase/);
  const same = seeded({ nowMs: Date.UTC(2026, 8, 18, 10, 0, 0) }); // Freitag 12:00, Tag schon eingetragen
  patch(same, 'cfg3', { dryDay: 5 });
  patch(same, 'day', { date: '2026-09-18', n: 0, sec: 0 });
  same.voltage = voltFor(35);
  ok(runMain(same));
  assert.equal(same.kvsGet('job').why, 'ok', 'nur der Tageswechsel selbst startet den Trockentag');
});

test('Nässe: Taktmessung über pctHi startet die Trockenphase – nicht der Wert direkt nach dem Fenster', () => {
  const dev = seeded();
  const now = dev.unixtime();
  dev.voltage = voltFor(63);
  let r = runMain(dev);
  ok(r);
  let st = dev.kvsGet('st');
  assert.equal(st.state, 'sperre');
  assert.equal(st.rated, true);
  assert.equal(st.dryOk, false);
  assert.equal(dev.kvsGet('job').why, 'trocken');
  assert.match(r.log.join('\n'), /Trockenphase \(nass 63 %\): warte auf < 28 %/);
  dev.voltage = voltFor(27);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('st').dryOk, true);
  assert.equal(dev.kvsGet('job').why, 'ok');
  // Fenster noch unkontrolliert: 63 % zählt nicht (why soak); Kontrolle → sperre mit zuviel; erst der nächste Takt startet die Trockenphase
  patch(dev, 'lrn', { sf: 0.7 });
  patch(dev, 'st', { state: 'gegossen', ts: now - 10 * 60, dur: 100, n: 2, sec: 80, pctB: 30, pctW: 64, pctA: null, why: 'ok', rated: false, dryOk: true });
  dev.voltage = voltFor(63);
  r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('job').why, 'soak');
  assert.equal(dev.kvsGet('st').dryOk, true);
  assert.doesNotMatch(r.log.join('\n'), /Trockenphase/);
  patch(dev, 'st', { ts: now - 40 * 60 });
  r = runMain(dev);
  ok(r);
  st = dev.kvsGet('st');
  assert.equal(st.state, 'sperre');
  assert.equal(st.dryOk, true, 'die Kontrolle selbst startet keine Trockenphase');
  assert.equal(dev.kvsGet('err').code, 'zuviel');
  assert.equal(dev.kvsGet('lrn').sf, 0.6);
  assert.doesNotMatch(r.log.join('\n'), /Trockenphase/);
  r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('st').dryOk, false, 'nächste Taktmessung über pctHi → Trockenphase');
  assert.match(r.log.join('\n'), /Trockenphase \(nass 63 %\)/);
  assert.equal(dev.kvsGet('job').why, 'pause', 'die Pause der Gabe steht in der Kette vor trocken');
  patch(dev, 'st', { ts: now - 50 * H });   // 50 h: auch pauseSlow (48 h, Feuchte seit der Kontrolle nicht gesunken) ist vorbei
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'trocken', 'nach der Pause bleibt die Trockenphase');
});

test('Überschreiten von tHot wird trotz 2-°C-Schritten exakt erfasst', () => {
  const dev = seeded();
  dev.tC = 35.0;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').tMaxD, 35, '35,0 ist nicht über tHot');
  dev.tC = 35.2;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').tMaxD, 36, 'über tHot');
  dev.tC = 34.9;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('lrn').tMaxD, 36);
});

test('Temperaturfühler-Ausfall blockiert nicht, überschreibt keine blockierende Störung', () => {
  const dev = seeded();
  dev.voltage = voltFor(30);
  dev.tC = null;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, 'temp');
  assert.equal(dev.kvsGet('job').ok, true);
  dev.voltage = 0.02;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, 'sensor');
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, 'sensor', 'temp verdrängt sensor nicht');
  dev.voltage = voltFor(30);
  dev.tC = 25;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null);
});

test('Störung noeff (von bw_pump gesetzt) blockiert bis sie von Hand gelöscht wird', () => {
  const dev = seeded();
  dev.voltage = voltFor(30);
  patch(dev, 'err', { code: 'noeff', ts: 1, mem: 1 });
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').why, 'err:noeff');
  dev.voltage = 0.02;
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, 'noeff', 'noeff wird nie überschrieben');
  dev.voltage = voltFor(30);
  dev.kvsDelete('err');
  ok(runMain(dev));
  assert.equal(dev.kvsGet('err').code, null, 'err wird neu angelegt');
  assert.equal(dev.kvsGet('job').why, 'ok');
});

test('KVS schreiben nur bei Änderung; ein ok-Auftrag wird vor dem Gießfenster aufgefrischt', () => {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 8, 0, 0) }); // 10:00 lokal
  dev.voltage = voltFor(50);
  let r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 3, 'day (Datum), lrn (tMaxD), job (why)');
  r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 0, 'unverändert → nichts geschrieben');
  dev.voltage = () => voltFor(50 + Math.random());
  r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 0, 'Messrauschen erzeugt keinen Schreibvorgang');
  dev.nowMs = Date.UTC(2026, 8, 12, 17, 45, 0); // 19:45 lokal → Fenster 20:00 im nächsten Takt
  r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 0, 'ok=false braucht keine Auffrischung, die Pumpe prüft das Alter nur bei ok=true');
  dev.voltage = voltFor(30);
  dev.nowMs = Date.UTC(2026, 8, 12, 9, 0, 0); // 11:00 lokal
  r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 1, 'ok wechselt auf true');
  r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 0);
  dev.nowMs = Date.UTC(2026, 8, 12, 17, 45, 0); // 19:45 lokal
  const tStart = dev.unixtime();
  r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 1, 'ok-Auftrag vor dem Fenster aufgefrischt');
  assert.equal(dev.kvsGet('job').ts, tStart);
  dev.nowMs = Date.UTC(2026, 8, 12, 18, 0, 0); // 20:00 lokal → kein Fenster mehr im nächsten Takt
  r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 0);
});

test('Auftrag-Sekunden dürfen driften, ohne jeden Takt zu schreiben', () => {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 8, 0, 0) });
  patch(dev, 'lrn', { effW: 0.5 });
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  dev.voltage = voltFor(30.6);
  const r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 0);
});

// ---- Zeitfenster aus cfg3: tick und winEvery (Zeitraffer) ----------------------------------
test('Zeitfenster alle winEvery Minuten: ok-Auftrag wird nur in der Minute vor dem Fenster aufgefrischt', () => {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 8, 1, 0) }); // 10:01 lokal, Fenster in geraden Minuten
  patch(dev, 'cfg3', { tick: 1, winEvery: 2, jobAge: 3 });
  dev.voltage = voltFor(30);
  ok(runMain(dev));
  assert.equal(dev.kvsGet('job').ok, true);
  dev.nowMs = Date.UTC(2026, 8, 12, 8, 3, 0); // 10:03: Fenster 10:04 liegt im nächsten Takt
  let tStart = dev.unixtime();
  patch(dev, 'job', { ts: tStart - 300 });
  let r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 1, 'Auftrag vor dem Fenster aufgefrischt');
  assert.equal(dev.kvsGet('job').ts, tStart);
  dev.nowMs = Date.UTC(2026, 8, 12, 8, 4, 0); // 10:04: nächstes Fenster erst in 2 min
  tStart = dev.unixtime();
  patch(dev, 'job', { ts: tStart - 300 });
  r = runMain(dev);
  ok(r);
  assert.equal(r.writes, 0, 'in der Fensterminute selbst keine Auffrischung');
  assert.equal(dev.kvsGet('job').ts, tStart - 300);
});

test('Pausentoleranz folgt cfg3.tick: zwei Takte Vorlauf, im Zeitraffer 2 min', () => {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 8, 5, 0) });
  patch(dev, 'cfg3', { tick: 1, winEvery: 2, pause: 0.175, soak: 0.5, tDead: 5, tMin: 5, tStd: 5, tMax: 5 });
  dev.voltage = voltFor(30);
  const now = dev.unixtime();
  patch(dev, 'st', { state: 'sperre', ts: now - 500, sec: 5, pctB: 30, pctA: 30, rated: true, dryOk: true });
  let r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('job').why, 'pause', '500 s + 120 s Vorlauf < 630 s');
  assert.match(r.log.join('\n'), /pause=0\.175h/);
  patch(dev, 'st', { ts: now - 520 });
  r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('job').why, 'ok', '520 s + 120 s ≥ 630 s');
  assert.equal(dev.kvsGet('job').sec, 5, 'ohne Lernwert = tStd');
});

test('fehlendes cfg3.tick: err cfg, kein Auftrag', () => {
  const dev = seeded();
  dev.voltage = voltFor(30);
  patch(dev, 'cfg3', { tick: null });
  const r = runMain(dev);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.equal(dev.kvsGet('job').ok, false);
  assert.match(r.log.join('\n'), /cfg3\.tick fehlt/);
});
