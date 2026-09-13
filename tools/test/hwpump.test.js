// tools/test/hwpump.test.js v0.1.0 – Etappe 8: bw_hwpump (Pumpentest über bw_pump in zwei Durchgängen, Zeitwache, Sicherung/Rückbau) im Mock
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hwDevice, patch, runHwpump, pumpTest, FILES } = require('./helpers.js');
const { driver } = require('../mock/hwdemo.js');
const { KVS_MAX_VAL } = require('../mock/shelly-mock.js');

function ok(r) { assert.deepEqual(r.errors, []); assert.equal(r.stopped, true, 'Script hat sich nicht beendet'); }
const STATE = ['st', 'day', 'job', 'err', 'lrn'];
function snapshot(dev) { const o = {}; for (const k of STATE) o[k] = dev.kvsRaw(k); return o; }
function localMs(h, m, s) { return Date.UTC(2026, 8, 12, h - 2, m, s || 0); }   // Europe/Vienna im September = UTC+2
function calls(dev, method, sid) { return dev.rpcLog.filter((e) => e.method === method && (sid === undefined || e.sid === sid)); }

test('Volldurchlauf: A bereitet vor und startet bw_pump, Pumpe 30 s, B bewertet ok und baut byteidentisch zurück', () => {
  const dev = hwDevice();
  const before = snapshot(dev);
  assert.equal(dev.kvsGet('err').code, 'cfg', 'Gerätezustand: Störung cfg steht');
  driver(dev, { key: 'hwp' });
  const r = pumpTest(dev);
  ok(r.a); ok(r.b);
  assert.match(r.a.log.join('\n'), /bw_pump gestartet – Durchgang B/);
  const hwp = dev.kvsGet('hwp');
  assert.equal(hwp.r, 'ok,ok,ok,ok');
  assert.equal(hwp.s, 'ende');
  assert.equal(hwp.st, 'gegossen');
  assert.equal(hwp.why, 'ok');
  assert.equal(hwp.sec, 30);
  assert.equal(hwp.rec, 0);
  assert.ok(dev.kvsRaw('hwp').length <= KVS_MAX_VAL);
  assert.deepEqual(snapshot(dev), before, 'st/day/job/err/lrn wie vor dem Test');
  assert.equal(dev.kvsRaw('hwb1'), undefined);
  assert.equal(dev.kvsRaw('hwb2'), undefined);
  assert.deepEqual(dev.switchLog.map((e) => (e.on ? 'on' : 'off') + (e.toggle_after ? ':' + e.toggle_after : '')), ['on:30', 'off', 'off'], 'nur bw_pump schaltet');
  assert.equal(calls(dev, 'Switch.Set', 5).length, 0, 'bw_hwpump selbst schaltet nicht');
  assert.equal(calls(dev, 'Script.Start', 5).length, 1);
  assert.match(dev.log.join('\n'), /\[bw_pump 0\.\d+\.\d+\] Fenster: Auftrag 30 s, pct null, Einzelportion/, 'bw_pump lief allein weiter (Konsole des Geräts)');
  assert.match(dev.log.join('\n'), /P1 aus: ok nach 30 s/);
  assert.match(r.b.log.join('\n'), /Bericht 2\/2 Ende mit Rückbau/);
  assert.ok(r.writes <= 16, 'Schreibvorgänge ' + r.writes);
  assert.ok(r.maxCallDepth <= 10, 'Aufruftiefe ' + r.maxCallDepth);
  assert.ok(dev.maxTimersUsed <= 2);
  assert.ok(dev.maxPendingRpc <= 2);
});

test('Störung noeff blockiert die Freigabe; kein Script.Start, Zustände unverändert, Bericht in A', () => {
  const dev = hwDevice();
  patch(dev, 'err', { code: 'noeff', ts: 1, mem: 1 });
  const before = snapshot(dev);
  driver(dev, { key: 'hwp' });
  const r = pumpTest(dev);
  ok(r.a);
  assert.equal(r.b, null, 'kein Durchgang B nötig');
  assert.equal(dev.kvsGet('hwp').r, 'fe,sk,sk,-');
  assert.equal(calls(dev, 'Script.Start').length, 0);
  assert.deepEqual(snapshot(dev), before);
  assert.match(r.a.log.join('\n'), /Bericht 2\/2 Ende ohne Pumpenlauf/);
});

test('Tageslimit erreicht: day für bw_pump zurückgesetzt, danach wieder der alte Zähler', () => {
  const dev = hwDevice();
  patch(dev, 'day', { date: '2026-09-12', n: 2, sec: 140 });
  driver(dev, { key: 'hwp' });
  const r = pumpTest(dev);
  ok(r.a); ok(r.b);
  assert.equal(dev.kvsGet('hwp').r, 'ok,ok,ok,ok');
  assert.deepEqual(dev.kvsGet('day'), { date: '2026-09-12', n: 2, sec: 140 });
});

test('Taktsperre: go kurz vor dem bw_main-Takt wartet bis in die Lücke, bw_main läuft dazwischen ohne Schaden', () => {
  const dev = hwDevice({ nowMs: localMs(10, 14, 20) });
  dev.files.bw_main = FILES.bw_main;
  const tick = localMs(10, 15, 0);
  dev.schedule(tick - dev.nowMs, () => dev.dispatch('Script.Start', { id: 2 }));
  const before = snapshot(dev);
  driver(dev, { key: 'hwp' });
  const r = pumpTest(dev);
  ok(r.a); ok(r.b);
  assert.equal(dev.kvsGet('hwp').r, 'ok,ok,ok,ok');
  const st = calls(dev, 'Script.Start', 5)[0];
  assert.ok(st.t >= tick + 90 * 1000, 'Start erst nach Takt + guardS: ' + (st.t - tick) / 1000 + ' s');
  assert.match(r.a.log.join('\n'), /warte: takt/);
  assert.match(r.log.join("\n"), /\[bw_main 0\.\d+\.\d+\]/, "bw_main lief als zweites Script");
  assert.deepEqual(snapshot(dev), before);
});

test('Fenstersperre: vor dem Gießfenster 08:00 wird bis 08:25 gewartet', () => {
  const dev = hwDevice({ nowMs: localMs(7, 50, 0) });
  patch(dev, 'hwt', { tPhase: 3600 });
  driver(dev, { key: 'hwp' });
  const r = pumpTest(dev);
  ok(r.a); ok(r.b);
  assert.equal(dev.kvsGet('hwp').r, 'ok,ok,ok,ok');
  const st = calls(dev, 'Script.Start', 5)[0];
  assert.ok(st.t >= localMs(8, 25, 0), 'Start um ' + new Date(st.t + 7200000).toISOString());
  assert.match(r.a.log.join('\n'), /warte: fenster/);
});

test('Mitternacht zählt als Fenster: Lauf um 23:50 wartet bis 00:25', () => {
  const dev = hwDevice({ nowMs: localMs(23, 50, 0) });
  patch(dev, 'hwt', { tPhase: 3600 });
  driver(dev, { key: 'hwp' });
  const r = pumpTest(dev);
  ok(r.a); ok(r.b);
  assert.equal(dev.kvsGet('hwp').r, 'ok,ok,ok,ok');
  assert.ok(calls(dev, 'Script.Start', 5)[0].t >= localMs(24, 25, 0));
});

test('Wasser leer während der Gabe: bw_pump bricht ab, Ergebnis aw, Störung wasser wird zurückgebaut', () => {
  const dev = hwDevice();
  const before = snapshot(dev);
  let onAt = null;
  dev.onSwitch = (d, id, on, t) => { if (on) onAt = t; };
  dev.inputs[1] = () => onAt !== null && dev.nowMs - onAt > 10000;   // 10 s nach EIN: leer
  driver(dev, { key: 'hwp' });
  const r = pumpTest(dev);
  ok(r.a); ok(r.b);
  const hwp = dev.kvsGet('hwp');
  assert.equal(hwp.r, 'ok,ok,ok,aw');
  assert.equal(hwp.st, 'sperre');
  assert.equal(hwp.why, 'abbruch');
  assert.ok(hwp.sec < 20, 'Pumpe früh aus: ' + hwp.sec);
  assert.deepEqual(snapshot(dev), before, 'err=wasser und st=sperre zurückgebaut');
});

test('bw_pump lehnt ab (Wasserstand flackert nach dem Start): p1 fe, kein Testauftrag bleibt liegen', () => {
  const dev = hwDevice();
  const before = snapshot(dev);
  let started = false, flicker = false;
  dev.inputs[1] = () => { if (!started) return false; flicker = !flicker; return flicker; };
  driver(dev, { key: 'hwp' });
  const drv = dev.onRpc;
  dev.onRpc = (d, m, p, sid) => { if (m === 'Script.Start') started = true; drv(d, m, p, sid); };
  const r = pumpTest(dev);
  ok(r.a); ok(r.b);
  assert.equal(dev.kvsGet('hwp').r, 'ok,fe,sk,aw');
  assert.equal(dev.switchLog.length, 0);
  assert.equal(dev.kvsGet('job').ok, false);
  assert.deepEqual(snapshot(dev), before);
  assert.match(dev.log.join('\n'), /Wasserstand unstabil/);
});

test('bw_pump fehlt in der Script-Liste: Freigabe blockiert', () => {
  const dev = hwDevice();
  dev.scripts = dev.scripts.filter((s) => s.name !== 'bw_pump');
  driver(dev, { key: 'hwp' });
  const r = pumpTest(dev);
  ok(r.a);
  assert.equal(dev.kvsGet('hwp').r, 'fe,sk,sk,-');
});

test('Ausgang nach bw_pump noch EIN: Durchgang B schaltet aus und wertet p2/p3 als Abweichung', () => {
  const dev = hwDevice();
  dev.onSwitch = (d, id, on, t) => { if (!on && d.switchLog.filter((e) => !e.on).length === 2) d.schedule(1000, () => { d.switches[0].output = true; }); };
  driver(dev, { key: 'hwp' });
  const r = pumpTest(dev);
  ok(r.a); ok(r.b);
  assert.equal(dev.kvsGet('hwp').r, 'ok,ok,aw,aw');
  assert.equal(calls(dev, 'Switch.Set', 5).length, 1, 'Sicherheits-Aus durch bw_hwpump');
  assert.equal(dev.switches[0].output, false);
  assert.match(r.b.log.join('\n'), /Sicherheits-Aus/);
});

test('Durchgang B, während bw_pump noch läuft: nichts geschrieben, später normal', () => {
  const dev = hwDevice();
  const before = snapshot(dev);
  driver(dev, { key: 'hwp' });
  ok(runHwpump(dev));
  dev.advance(5000);
  const early = runHwpump(dev);
  ok(early);
  assert.match(early.log.join('\n'), /bw_pump läuft noch/);
  assert.notEqual(dev.kvsRaw('hwb1'), undefined, 'Sicherung bleibt');
  assert.equal(dev.kvsGet('hwp').s, 'pumpt');
  dev.advance(90 * 1000);
  ok(runHwpump(dev));
  assert.equal(dev.kvsGet('hwp').r, 'ok,ok,ok,ok');
  assert.deepEqual(snapshot(dev), before);
});

test('Wiederanlauf: Sicherung aus abgebrochenem Lauf (ohne hwp) wird zurückgebaut, rec=1', () => {
  const dev = hwDevice();
  const before = snapshot(dev);
  dev.kvsSetRaw('hwb1', { st: dev.kvsGet('st'), day: dev.kvsGet('day') });
  dev.kvsSetRaw('hwb2', { job: dev.kvsGet('job'), err: dev.kvsGet('err'), lrn: dev.kvsGet('lrn') });
  patch(dev, 'st', { state: 'gegossen', ts: 123, sec: 30 });
  patch(dev, 'err', { code: null });
  patch(dev, 'job', { ok: true, sec: 30, why: 'hwtest' });
  const r = runHwpump(dev);
  ok(r);
  const hwp = dev.kvsGet('hwp');
  assert.equal(hwp.rec, 1);
  assert.equal(hwp.r, 'ok,fe,sk,aw');
  assert.equal(calls(dev, 'Script.Start').length, 0, 'kein neuer Pumpenlauf');
  assert.deepEqual(snapshot(dev), before, 'Vorzustand wiederhergestellt, job.ok false');
  assert.equal(dev.kvsRaw('hwb1'), undefined);
});

test('Sicherung scheitert (Wert über 253 Zeichen): kein Pumpenlauf; halbe Sicherung räumt B auf', () => {
  const dev = hwDevice();
  patch(dev, 'st', { note: 'x'.repeat(200) });   // st + day passen dann nicht mehr in hwb1
  const before = snapshot(dev);
  driver(dev, { key: 'hwp' });
  const a = runHwpump(dev);
  ok(a);
  assert.equal(dev.kvsGet('hwp').r, 'ok,fe,sk,-');
  assert.equal(calls(dev, 'Script.Start').length, 0);
  assert.match(a.log.join('\n'), /Sicherung fehlgeschlagen/);
  assert.notEqual(dev.kvsRaw('hwb2'), undefined, 'zweiter Sicherungsschlüssel wurde geschrieben');
  ok(runHwpump(dev));
  assert.equal(dev.kvsRaw('hwb2'), undefined);
  assert.deepEqual(snapshot(dev), before);
});

test('abort in der Freigabe: Bericht abbruch, kein Start, nichts geschrieben außer hwt/hwp', () => {
  const dev = hwDevice();
  const before = snapshot(dev);
  driver(dev, { key: 'hwp', abort: 'p0' });
  const r = pumpTest(dev);
  ok(r.a);
  const hwp = dev.kvsGet('hwp');
  assert.equal(hwp.r, 'ab,sk,sk,-');
  assert.equal(hwp.s, 'abbruch');
  assert.equal(calls(dev, 'Script.Start').length, 0);
  assert.deepEqual(snapshot(dev), before);
});

test('Ausgang steht beim Start schon auf EIN: Freigabe wartet, kein Start', () => {
  const dev = hwDevice();
  patch(dev, 'hwt', { tPhase: 30 });
  dev.setSwitch(0, true, undefined, 'hand');
  driver(dev, { key: 'hwp' });
  const r = pumpTest(dev);
  ok(r.a);
  assert.equal(dev.kvsGet('hwp').r, 'to,sk,sk,-');
  assert.match(r.a.log.join('\n'), /Ausgang EIN/);
  assert.equal(calls(dev, 'Script.Start').length, 0);
});
