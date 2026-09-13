// tools/test/pump.test.js v0.2.0 – Etappe 10: bw_pump als Regelkreis im Fenster (Ergebnismatrix aus docs/PLAN.md, Topfmodell aus helpers.js)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seeded, patch, runPump, voltFor, potModel, noBurst } = require('./helpers.js');

function ok(r) { assert.deepEqual(r.errors, []); assert.equal(r.stopped, true, 'Script hat sich nicht beendet'); }
const CFG4 = { tWin: 420, tTail: 20, nPort: 6, tPmin: 10, tPmax: 120, tSoak: 20, tStep: 5, tStab: 60, nStab: 4, dStab: 1, tDead2: 8, dEffMin: 2 };
// Gerät im Fenster 08:00:30 mit vollständigem Band und Regelkreis-Feldern; Topfmodell mit Gerätescala (~5 %/wirksame s)
function prep(opts) {
  opts = opts || {};
  const dev = seeded({ nowMs: opts.nowMs || Date.UTC(2026, 8, 12, 6, 0, 30) });
  patch(dev, 'cfg2', { pctSoll: 55, pctLo: 40, pctOk: 50, pctHi: 60, pctDry: 28, dropW: null, sfUp: 0.05, effMax: 30 });
  patch(dev, 'cfg3', { tMax: 180, tMin: 25, dryDay: 5 });
  dev.kvsSetRaw('cfg4', Object.assign({}, CFG4, opts.cfg4 || {}));
  patch(dev, 'lrn', Object.assign({ effW: null, sf: 0.7 }, opts.lrn || {}));
  const model = potModel(dev, Object.assign({ pct0: 20, effLocal: 5, tDead: 20, tDead2: 8, tRamp: 10, noise: 0.2 }, opts.model || {}));
  patch(dev, 'job', Object.assign({ ok: true, sec: 25, pct: 20, why: 'ok', ts: dev.unixtime() - 30 }, opts.job || {}));
  dev.kvsWrites = 0;
  return { dev, model };
}
function ons(dev) { return dev.switchLog.filter((e) => e.on); }
function onOff(dev) { return dev.switchLog.map((e) => (e.on ? 'on:' + e.toggle_after : 'off')); }

test('Einzelportion (Auftrag ohne pct, Hardware-Test/Hand): genau job.sec Sekunden, keine Messung, kein Lernwert, 3 Schreibvorgänge', () => {
  const { dev } = prep({ job: { pct: null, sec: 70 } });
  const r = runPump(dev);
  ok(r);
  assert.deepEqual(onOff(dev), ['on:70', 'off', 'off']);
  const st = dev.kvsGet('st');
  assert.equal(st.state, 'gegossen'); assert.equal(st.rated, false); assert.equal(st.n, 1); assert.equal(st.sec, 70); assert.equal(st.pctB, null); assert.equal(st.why, 'ok'); assert.equal(st.dryOk, true);
  assert.equal(dev.kvsGet('lrn').effW, null);
  assert.equal(dev.kvsGet('day').n, 1); assert.equal(dev.kvsGet('day').sec, 70);
  assert.equal(dev.kvsGet('job').ok, false); assert.equal(dev.kvsGet('job').why, 'ok');
  assert.equal(r.writes, 3);
  assert.equal(dev.maxTimersUsed, 1); assert.equal(dev.maxPendingRpc, 1);
  assert.ok(r.elapsedMs > 70000 && r.elapsedMs < 130000, 'Laufzeit ' + r.elapsedMs);
  noBurst(dev);
});

test('nPort 1 (Eimer-Variante): Einzelportion trotz pct', () => {
  const { dev } = prep({ cfg4: { nPort: 1 } });
  ok(runPump(dev));
  assert.deepEqual(onOff(dev), ['on:25', 'off', 'off']);
  assert.equal(dev.kvsGet('st').pctB, null);
  assert.equal(dev.kvsGet('lrn').effW, null);
});

test('Ziel in einer Portion: m0 frisch gemessen, why ok, effW gelernt, sf unverändert, Claim + 4 Schreibvorgänge', () => {
  const { dev } = prep({ model: { pct0: 45, effLocal: 2 }, job: { pct: 44 } });   // kleinste Erstportion tMin 25 s → +10 %
  const r = runPump(dev);
  ok(r);
  assert.equal(ons(dev).length, 1);
  const st = dev.kvsGet('st');
  assert.equal(st.why, 'ok'); assert.equal(st.n, 1); assert.equal(st.state, 'gegossen'); assert.equal(st.rated, false);
  assert.ok(Math.abs(st.pctB - 45) < 0.5, 'Frischwert ' + st.pctB);
  assert.ok(st.pctW >= 50 && st.pctW <= 60, 'Fensterwert ' + st.pctW);
  assert.ok(st.effW > 1.5 && st.effW < 3, 'effW ' + st.effW);
  assert.equal(dev.kvsGet('lrn').effW, st.effW);
  assert.equal(dev.kvsGet('lrn').sf, 0.7, 'eine Portion im Band ändert sf nicht');
  assert.equal(r.writes, 5, 'Claim st + st/day/job/lrn');
  assert.equal(dev.maxTimersUsed, 1); assert.equal(dev.maxPendingRpc, 1);
  assert.ok(r.maxCallDepth <= 8, 'Aufruftiefe ' + r.maxCallDepth);
});

test('trockene Erde 20 %: mehrere Portionen bis pctOk, Summe ≤ tMax, jede ≥ tPmin, sf steigt um sfUp, Laufzeit ≤ tWin + tTail', () => {
  const { dev } = prep();
  const r = runPump(dev);
  ok(r);
  const on = ons(dev);
  assert.ok(on.length >= 2 && on.length <= 3, 'Portionen ' + on.length);
  let sum = 0;
  for (const e of on) { assert.ok(e.toggle_after >= CFG4.tPmin, 'Portion ' + e.toggle_after); sum += e.toggle_after; }
  assert.ok(sum <= 180);
  const st = dev.kvsGet('st');
  assert.equal(st.why, 'ok'); assert.equal(st.n, on.length); assert.equal(st.sec, sum);
  assert.ok(st.pctW >= 50 && st.pctW <= 60, 'Fensterwert ' + st.pctW);
  assert.ok(st.tr !== null, 'tRise der 2. Portion');
  assert.equal(dev.kvsGet('lrn').sf, 0.75);
  assert.ok(dev.kvsGet('lrn').effW > 3);
  assert.ok(r.elapsedMs <= (CFG4.tWin + CFG4.tTail) * 1000, 'Laufzeit ' + r.elapsedMs);
  // zweite Portion frühestens nach Einsickern + Messung
  const off1 = dev.switchLog.find((e) => !e.on).t;
  assert.ok(on[1].t - off1 >= (CFG4.tSoak + CFG4.nStab * CFG4.tStep) * 1000, 'zu früh: ' + (on[1].t - off1) / 1000 + ' s');
  noBurst(dev);
});

test('Frischwert schon im Band (von Hand gegossen): keine Gabe, why feucht, Auftrag verbraucht', () => {
  const { dev } = prep({ model: { pct0: 58 }, job: { pct: 34 } });
  const r = runPump(dev);
  ok(r);
  assert.equal(ons(dev).length, 0);
  assert.equal(dev.kvsGet('job').ok, false); assert.equal(dev.kvsGet('job').why, 'feucht');
  assert.equal(dev.kvsGet('st').state, 'beob', 'st unverändert');
  assert.equal(dev.kvsGet('day').n, 0);
  assert.equal(r.writes, 1);
});

test('Frischwert über pctHi (nass): Trockenphase, st sperre mit dryOk false, keine Gabe', () => {
  const { dev } = prep({ model: { pct0: 63 }, job: { pct: 34 } });
  ok(runPump(dev));
  assert.equal(ons(dev).length, 0);
  const st = dev.kvsGet('st');
  assert.equal(st.state, 'sperre'); assert.equal(st.dryOk, false); assert.equal(st.why, 'nass'); assert.equal(st.rated, true);
  assert.equal(dev.kvsGet('job').why, 'nass');
});

test('Sensor unplausibel vor Portion 1: err sensor, kein Switch.Set', () => {
  const { dev } = prep();
  dev.voltage = 3.4;
  ok(runPump(dev));
  assert.equal(ons(dev).length, 0);
  assert.equal(dev.kvsGet('err').code, 'sensor');
  assert.equal(dev.kvsGet('job').why, 'sensor');
});

test('erste Portion über pctHi: why over, sf sinkt um sfStep, effW gelernt und auf effMax begrenzt', () => {
  const { dev } = prep({ model: { pct0: 20, effLocal: 45, tDead: 24 }, job: { pct: 20 } });   // 1 wirksame Sekunde → +45 %
  patch(dev, 'cfg3', { tDead: 24 });
  ok(runPump(dev));
  assert.equal(ons(dev).length, 1);
  const st = dev.kvsGet('st');
  assert.equal(st.why, 'over'); assert.ok(st.pctW > 60);
  assert.equal(dev.kvsGet('lrn').sf, 0.6);
  assert.equal(dev.kvsGet('lrn').effW, 30, 'Sanity-Grenze effMax');
});

test('keine Wirkung: volle Probeportion, dann Störung noeff, sperre ohne Lernwert', () => {
  const { dev } = prep({ model: { effLocal: 0 } });
  ok(runPump(dev));
  assert.deepEqual(ons(dev).map((e) => e.toggle_after), [25, 25], 'Portion + Probeportion');
  const st = dev.kvsGet('st');
  assert.equal(st.state, 'sperre'); assert.equal(st.rated, true); assert.equal(st.why, 'noeff'); assert.equal(st.pctA, null); assert.equal(st.sec, 50);
  assert.equal(dev.kvsGet('err').code, 'noeff');
  assert.equal(dev.kvsGet('lrn').effW, null);
  assert.equal(dev.kvsGet('day').n, 1);
});

test('Stabilisierung wartet auf das Plateau: langsame Rampe ergibt keine verfrühte zweite Portion', () => {
  const { dev } = prep({ model: { pct0: 30, tRamp: 40 }, job: { pct: 30 } });
  ok(runPump(dev));
  const on = ons(dev);
  assert.ok(on.length >= 1);
  const st = dev.kvsGet('st');
  assert.ok(st.why === 'ok' || st.why === 'unstab', st.why);
  if (on.length > 1) {
    const off1 = dev.switchLog.find((e) => !e.on).t;
    assert.ok(on[1].t - off1 >= CFG4.tSoak * 1000 + CFG4.nStab * CFG4.tStep * 1000);
  }
});

test('Wert steigt beim Timeout noch: why unstab, keine weitere Portion, effW aus dem Ringmittel', () => {
  const { dev } = prep({ model: { pct0: 30, tRamp: 300, noise: 0 }, job: { pct: 30 } });
  ok(runPump(dev));
  assert.equal(ons(dev).length, 1);
  const st = dev.kvsGet('st');
  assert.equal(st.why, 'unstab'); assert.equal(st.state, 'gegossen');
  assert.ok(st.effW !== null && st.effW > 0);
});

test('Behälter leer in Portion 2: sofort aus, abbruch, err wasser, sperre, effW aus Portion 1', () => {
  const { dev } = prep();
  let firstOff = null;
  const prev = dev.onSwitch;
  dev.onSwitch = (d, id, on, t) => { if (prev) prev(d, id, on, t); if (id === 0 && !on && firstOff === null) firstOff = t; };
  dev.inputs[1] = (d) => firstOff !== null && d.nowMs > firstOff + 45000;   // LEER kurz nach dem Start von Portion 2
  ok(runPump(dev));
  const on = ons(dev);
  assert.equal(on.length, 2);
  const st = dev.kvsGet('st');
  assert.equal(st.why, 'abbruch'); assert.equal(st.state, 'sperre'); assert.equal(st.rated, true);
  assert.equal(dev.kvsGet('err').code, 'wasser');
  assert.ok(dev.kvsGet('lrn').effW > 0, 'Lernwert aus der fertigen Portion 1');
  assert.equal(dev.switches[0].output, false);
});

test('Behälter leer in der Wartephase: keine weitere Portion, why wasser, Fenster regulär bewertet', () => {
  const { dev } = prep();
  let firstOff = null;
  const prev = dev.onSwitch;
  dev.onSwitch = (d, id, on, t) => { if (prev) prev(d, id, on, t); if (id === 0 && !on && firstOff === null) firstOff = t; };
  dev.inputs[1] = (d) => firstOff !== null && d.nowMs > firstOff + 3000;
  ok(runPump(dev));
  assert.equal(ons(dev).length, 1);
  const st = dev.kvsGet('st');
  assert.equal(st.why, 'wasser'); assert.equal(st.state, 'gegossen'); assert.equal(st.rated, false);
  assert.equal(dev.kvsGet('err').code, 'wasser');
  assert.ok(dev.kvsGet('lrn').effW > 0);
});

test('Ausgang extern abgeschaltet in Portion 2: why extern, sperre, kein err', () => {
  const { dev } = prep();
  let firstOff = null, done = false;
  const prev = dev.onSwitch;
  dev.onSwitch = (d, id, on, t) => {
    if (prev) prev(d, id, on, t);
    if (id === 0 && !on && firstOff === null) firstOff = t;
    if (id === 0 && on && firstOff !== null && !done) { done = true; d.schedule(3000, () => d.setSwitch(0, false, undefined, 'schedule')); }
  };
  ok(runPump(dev));
  const st = dev.kvsGet('st');
  assert.equal(st.why, 'extern'); assert.equal(st.state, 'sperre');
  assert.equal(dev.kvsGet('err').code, null);
});

test('Script.Stop nach Portion 1 (Absturz): Claim st.why laeuft bleibt, Ausgang aus, Auftrag bleibt für den Guard', () => {
  const { dev } = prep();
  dev.schedule(40000, () => dev.dispatch('Script.Stop', { id: 3 }));
  const r = runPump(dev);
  assert.equal(r.stopped, true);
  const st = dev.kvsGet('st');
  assert.equal(st.why, 'laeuft'); assert.equal(st.state, 'sperre'); assert.equal(st.rated, true); assert.equal(st.n, 0);
  assert.equal(dev.kvsGet('job').ok, true);
  assert.equal(dev.kvsGet('day').n, 0);
  dev.runUntil(dev.nowMs + 200000, null);
  assert.equal(dev.switches[0].output, false, 'toggle_after schaltet aus');
  // Handstart 10 min später: Guard verhindert ein zweites Fenster
  dev.nowMs += 10 * 60 * 1000;
  const r2 = runPump(dev);
  ok(r2);
  assert.equal(ons(dev).length, 1);
  assert.match(r2.log.join('\n'), /laeuft/);
});

test('Handstart kurz vor dem bw_main-Takt: Frist zu kurz, why zeit, keine Pumpe', () => {
  const { dev } = prep({ nowMs: Date.UTC(2026, 8, 12, 6, 14, 0) }); // 08:14:00 lokal
  ok(runPump(dev));
  assert.equal(ons(dev).length, 0);
  assert.equal(dev.kvsGet('job').why, 'zeit');
  assert.equal(dev.kvsGet('st').state, 'beob');
});

test('Tagesvorrat aufgebraucht (day.sec nahe maxDay·tMax): why max ohne Pumpe', () => {
  const { dev } = prep();
  patch(dev, 'day', { date: '2026-09-12', n: 1, sec: 350 });
  ok(runPump(dev));
  assert.equal(ons(dev).length, 0);
  assert.equal(dev.kvsGet('job').why, 'max');
});

test('fehlendes cfg4: err cfg, keine Pumpe', () => {
  const { dev } = prep();
  dev.kvs.delete('cfg4');
  const r = runPump(dev);
  ok(r);
  assert.equal(ons(dev).length, 0);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.match(r.log.join('\n'), /cfg4\.tWin fehlt/);
});

test('kein Auftrag / alter Auftrag / Tageslimit / stehende Störung: wie bisher keine Pumpe', () => {
  let { dev } = prep({ job: { ok: false } });
  let r = runPump(dev); ok(r); assert.equal(ons(dev).length, 0); assert.equal(r.writes, 0);
  ({ dev } = prep({ job: { ts: 1789192800 - 40 * 60 } }));
  r = runPump(dev); ok(r); assert.equal(ons(dev).length, 0); assert.equal(dev.kvsGet('err').code, 'alt');
  ({ dev } = prep());
  patch(dev, 'day', { date: '2026-09-12', n: 2, sec: 100 });
  r = runPump(dev); ok(r); assert.equal(ons(dev).length, 0); assert.equal(dev.kvsGet('err').code, 'limit');
  ({ dev } = prep());
  patch(dev, 'err', { code: 'noeff', ts: 1, mem: 1 });
  r = runPump(dev); ok(r); assert.equal(ons(dev).length, 0); assert.equal(dev.kvsGet('err').code, 'noeff'); assert.equal(dev.kvsGet('job').why, 'err:noeff');
});

test('Lesen-Ändern-Schreiben: Änderungen von bw_main während des Fensters bleiben erhalten', () => {
  const { dev } = prep({ model: { pct0: 45 }, job: { pct: 44 } });
  dev.schedule(10000, () => { patch(dev, 'day', { date: '2026-09-12', n: 0, sec: 0 }); patch(dev, 'err', { code: 'temp', ts: 5, mem: 1 }); patch(dev, 'lrn', { tMaxD: 30 }); });
  ok(runPump(dev));
  assert.equal(dev.kvsGet('err').code, 'temp');
  assert.equal(dev.kvsGet('lrn').tMaxD, 30);
  assert.equal(dev.kvsGet('day').n, 1);
});
