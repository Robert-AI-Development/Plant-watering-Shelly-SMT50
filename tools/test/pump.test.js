// tools/test/pump.test.js v0.1.0 – Etappe 4: bw_pump
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seeded, patch, runPump } = require('./helpers.js');

function ok(r) { assert.deepEqual(r.errors, []); assert.equal(r.stopped, true, 'Script hat sich nicht beendet'); }
function withJob(dev, fields) {
  const now = dev.unixtime();
  return patch(dev, 'job', Object.assign({ ok: true, sec: 70, pct: 34.1, why: 'ok', ts: now - 15 * 60 }, fields || {}));
}
function onOff(dev) { return dev.switchLog.map((e) => (e.on ? 'on' : 'off') + (e.toggle_after ? ':' + e.toggle_after : '')); }

test('Gabe laut Auftrag: Switch.Set mit toggle_after, Ergebnis in st/day/job', () => {
  const dev = seeded();
  withJob(dev);
  const tStart = dev.unixtime();
  const r = runPump(dev);
  ok(r);
  assert.deepEqual(onOff(dev), ['on:70', 'off', 'off'], 'ein mit toggle_after, Geräte-Timer aus, Script aus');
  assert.equal(dev.switches[0].output, false);
  assert.equal(dev.switchLog[1].t - dev.switchLog[0].t, 70000, 'Geräte-Timer nach exakt 70 s');
  const st = dev.kvsGet('st');
  assert.equal(st.state, 'gegossen');
  assert.equal(st.sec, 70);
  assert.equal(st.pctB, 34.1);
  assert.equal(st.rated, false);
  assert.ok(st.ts >= tStart && st.ts <= tStart + 5, 'ts = Startzeit der Gabe');
  assert.deepEqual(dev.kvsGet('day'), { date: '2026-09-12', n: 1, sec: 70 });
  assert.equal(dev.kvsGet('job').ok, false, 'Auftrag verbraucht');
  assert.equal(dev.kvsGet('job').why, 'ok');
  assert.equal(r.writes, 3);
  assert.equal(dev.maxPendingRpc, 1);
  assert.equal(dev.maxTimersUsed, 1);
  assert.ok(r.elapsedMs > 70000 && r.elapsedMs < 130000, 'Laufzeit ' + r.elapsedMs + ' ms, vor dem Sicherheits-Aus');
});

test('kein Auftrag: nichts passiert, nichts geschrieben', () => {
  const dev = seeded();
  const r = runPump(dev);
  ok(r);
  assert.equal(dev.switchLog.length, 0);
  assert.equal(r.writes, 0);
  assert.match(r.log.join('\n'), /kein Auftrag/);
});

test('alter Auftrag: err alt, keine Pumpe', () => {
  const dev = seeded();
  withJob(dev, { ts: dev.unixtime() - 25 * 60 });
  ok(runPump(dev));
  assert.equal(dev.switchLog.length, 0);
  assert.equal(dev.kvsGet('err').code, 'alt');
  assert.equal(dev.kvsGet('job').ok, true, 'Auftrag bleibt, bw_main schreibt ihn neu');
});

test('Tageslimit: err limit, keine Pumpe; Vortagszähler zählt nicht', () => {
  const dev = seeded();
  withJob(dev);
  patch(dev, 'day', { date: '2026-09-12', n: 2, sec: 140 });
  ok(runPump(dev));
  assert.equal(dev.switchLog.length, 0);
  assert.equal(dev.kvsGet('err').code, 'limit');
  patch(dev, 'day', { date: '2026-09-11', n: 2, sec: 140 });
  patch(dev, 'err', { code: null, ts: null, mem: null });
  ok(runPump(dev));
  assert.equal(dev.switchLog.length, 3, 'gestriger Zähler zählt nicht');
  assert.deepEqual(dev.kvsGet('day'), { date: '2026-09-12', n: 1, sec: 70 });
});

test('stehende blockierende Störung: keine Pumpe, kein neuer err', () => {
  const dev = seeded();
  withJob(dev);
  patch(dev, 'err', { code: 'sensor', ts: 1, mem: 1 });
  const r = runPump(dev);
  ok(r);
  assert.equal(dev.switchLog.length, 0);
  assert.equal(dev.kvsGet('err').code, 'sensor');
  assert.equal(r.writes, 0);
});

test('Wasser leer vor der Gabe: err wasser; unstabil: keine Pumpe, kein err', () => {
  const dev = seeded();
  withJob(dev);
  dev.inputs[1] = true;
  ok(runPump(dev));
  assert.equal(dev.switchLog.length, 0);
  assert.equal(dev.kvsGet('err').code, 'wasser');
  patch(dev, 'err', { code: null, ts: null, mem: null });
  let k = 0;
  dev.inputs[1] = () => (k++ % 2 === 0);
  const r = runPump(dev);
  ok(r);
  assert.equal(dev.switchLog.length, 0);
  assert.equal(dev.kvsGet('err').code, null);
  assert.match(r.log.join('\n'), /unstabil/);
});

test('Wasser leer während der Gabe: sofort aus, kein Lernwert, err wasser', () => {
  const dev = seeded();
  withJob(dev);
  const t0 = dev.nowMs;
  dev.inputs[1] = (d) => d.nowMs > t0 + 33000;
  ok(runPump(dev));
  assert.deepEqual(onOff(dev), ['on:70', 'off']);
  assert.ok(dev.switchLog[1].t - dev.switchLog[0].t <= 36000, 'aus beim nächsten 5-s-Check');
  const st = dev.kvsGet('st');
  assert.equal(st.state, 'sperre');
  assert.equal(st.rated, true, 'kein Lernwert');
  assert.equal(st.pctA, null);
  assert.equal(st.sec, 35);
  assert.equal(dev.kvsGet('err').code, 'wasser');
  assert.deepEqual(dev.kvsGet('day'), { date: '2026-09-12', n: 1, sec: 35 });
  assert.equal(dev.kvsGet('job').why, 'abbruch');
});

test('Auftrag über tMax wird auf tMax begrenzt', () => {
  const dev = seeded();
  withJob(dev, { sec: 300 });
  ok(runPump(dev));
  assert.equal(dev.switchLog[0].toggle_after, 120);
  assert.equal(dev.kvsGet('st').sec, 120);
});

test('Ausgang extern abgeschaltet: Ergebnis extern, Pause läuft, kein err', () => {
  const dev = seeded();
  withJob(dev);
  dev.schedule(40500, () => dev.setSwitch(0, false, undefined, 'schedule'));
  ok(runPump(dev));
  const st = dev.kvsGet('st');
  assert.equal(st.state, 'sperre');
  assert.equal(st.rated, true);
  assert.ok(st.sec >= 40 && st.sec <= 45, 'beim nächsten tChk-Check erkannt: ' + st.sec);
  assert.equal(dev.kvsGet('err').code, null);
  assert.equal(dev.kvsGet('job').why, 'extern');
});

test('Lesen-Ändern-Schreiben: Änderungen von bw_main während der Gabe gehen nicht verloren', () => {
  const dev = seeded();
  withJob(dev);
  dev.schedule(10000, () => {
    patch(dev, 'day', { date: '2026-09-12', n: 1, sec: 50 });
    patch(dev, 'err', { code: 'temp', ts: 5, mem: 5 });
  });
  ok(runPump(dev));
  assert.deepEqual(dev.kvsGet('day'), { date: '2026-09-12', n: 2, sec: 120 });
  assert.equal(dev.kvsGet('err').code, 'temp');
});

test('Uhrzeit ungültig oder cfg unvollständig: err, keine Pumpe', () => {
  const dev = seeded();
  withJob(dev);
  dev.timeValid = false;
  ok(runPump(dev));
  assert.equal(dev.kvsGet('err').code, 'uhr');
  assert.equal(dev.switchLog.length, 0);
  dev.timeValid = true;
  patch(dev, 'err', { code: null, ts: null, mem: null });
  patch(dev, 'cfg3', { tChk: null });
  ok(runPump(dev));
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.equal(dev.switchLog.length, 0);
});

test('KVS.GetMany paginiert auch beim Neu-Lesen', () => {
  const dev = seeded({ kvsPageSize: 3 });
  withJob(dev);
  ok(runPump(dev));
  assert.equal(dev.kvsGet('day').n, 1);
  assert.equal(dev.kvsGet('st').state, 'gegossen');
});
