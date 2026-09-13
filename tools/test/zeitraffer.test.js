// tools/test/zeitraffer.test.js v0.2.0 – Etappe 9/10: Praxistest im Zeitraffer (bw_zeitraffer v0.2.0: Takt 3 / Fenster 6, cfg4-Profil,
// Trockenphase aus, Sicherung zrb1..5; Rückkehr über bw_install; Fahrplan-Simulation mit Topfmodell)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seeded, patch, runScript, runZeitraffer, FILES, potModel } = require('./helpers.js');
const { simulate } = require('../mock/shelly-mock.js');

function ok(r) { assert.deepEqual(r.errors, []); assert.equal(r.stopped, true, 'Script hat sich nicht beendet'); }
// Takt alle 3 min, Pumpe bei Sekunde 30 jeder 6er-Minute, Sicherheits-Aus 30 + tWin 120 + 10 = 160 s nach der Fensterminute → Minute +2, Sekunde 40
const ZR_SPECS = ['0 */3 * * * *', '30 */6 * * * *', '40 2,8,14,20,26,32,38,44,50,56 * * * *'];
const NORMAL_SPECS = ['0 */15 * * * *', '30 0 8,20 * * *', '0 8 8,20 * * *'];           // Installer-Startwerte (tWin 420 → +8 min)
const BETRIEB_SPECS = ['0 */15 * * * *', '30 0 8,20 * * *', '0 6 8,20 * * *'];          // inBetrieb(): tWin 300 → ceil(340/60) = 6 min
const ZR3 = { tick: 3, winEvery: 6, soak: 0.25, pauseHot: 0.1, pause: 0.2, pauseSlow: 0.35, jobAge: 5, maxDay: 4, tDead: 2, tMin: 10, tStd: 12, tMax: 40, tChk: 1, tHot: 30, dryDay: null };
const ZR4 = { tWin: 120, tTail: 20, nPort: 3, tPmin: 10, tPmax: 15, tSoak: 10, tStep: 5, tStab: 30, nStab: 3, dStab: 1, tDead2: 0, dEffMin: 1 };
const DEF = {
  lrn: { effW: null, sf: 0.7, rate: null, tMean: null, tMaxD: null, tMaxY: null },
  st: { state: 'beob', ts: null, sec: null, pctB: null, pctA: null, rated: false, dryOk: false },
  job: { ok: false, sec: null, pct: null, why: 'init', ts: null },
  day: { date: null, n: 0, sec: 0 },
  err: { code: null, ts: null, mem: null },
};
const ZRB = ['zrb1', 'zrb2', 'zrb3', 'zrb4', 'zrb5'];

// Gerät im Betrieb: Nutzeränderungen in cfg2/cfg3/cfg4, Lernwert, laufende Sperre, eine Gabe heute, stehende Störung
function inBetrieb() {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 8, 5, 20) }); // 10:05:20 lokal
  patch(dev, 'cfg3', { tMax: 90 });
  patch(dev, 'cfg4', { tWin: 300, nPort: 4 });
  patch(dev, 'cfg2', { pctDry: 30 });
  patch(dev, 'lrn', { effW: 0.3, sf: 0.8, tMaxD: 24 });
  patch(dev, 'st', { state: 'sperre', ts: dev.unixtime() - 7200, sec: 70, pctB: 30, pctA: 50, rated: true, dryOk: false });
  patch(dev, 'day', { date: '2026-09-12', n: 1, sec: 70 });
  patch(dev, 'err', { code: 'noeff', ts: dev.unixtime() - 3600, mem: 100000 });
  return dev;
}
function original(dev) {
  const o = {};
  for (const k of ['cfg2', 'cfg3', 'cfg4', 'lrn', 'st', 'day', 'err']) o[k] = dev.kvsGet(k);
  return o;
}

test('Zeitraffer aktivieren: Original in zrb1..5, Profile in cfg3/cfg4/cfg2, Zustand frisch, Zeitplan 3/6 mit Minutenliste, Marke verbraucht', () => {
  const dev = inBetrieb();
  const orig = original(dev);
  const r = runZeitraffer(dev);
  ok(r);
  assert.ok(dev.maxPendingRpc <= 2, 'je Script ein offener RPC (zwei Scripts kurz parallel)');
  assert.deepEqual(dev.kvsGet('zrb1'), { cfg3: orig.cfg3 });
  assert.deepEqual(dev.kvsGet('zrb2'), { lrn: orig.lrn, day: orig.day });
  assert.deepEqual(dev.kvsGet('zrb3'), { st: orig.st, err: orig.err });
  assert.deepEqual(dev.kvsGet('zrb4'), { cfg4: orig.cfg4 });
  assert.deepEqual(dev.kvsGet('zrb5'), { cfg2: orig.cfg2 });
  assert.equal(dev.kvsRaw('zr'), undefined, 'Marke vom Installer gelöscht');
  const c3 = dev.kvsGet('cfg3');
  assert.deepEqual(c3, Object.assign({}, orig.cfg3, ZR3));
  assert.equal(c3.winA, '08:00', 'Fensterzeiten bleiben stehen');
  assert.deepEqual(dev.kvsGet('cfg4'), Object.assign({}, orig.cfg4, ZR4));
  assert.deepEqual(dev.kvsGet('cfg2'), Object.assign({}, orig.cfg2, { pctDry: orig.cfg2.pctLo - 1 }), 'Trockenphase praktisch aus (pctDry knapp unter pctLo, Bandprüfung bleibt gültig), übriges Zielband unverändert');
  for (const k of Object.keys(DEF)) assert.deepEqual(dev.kvsGet(k), DEF[k], k + ' frisch');
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ZR_SPECS);
  assert.deepEqual(dev.schedules[0].calls, [{ method: 'Script.Start', params: { id: 2 } }]);
  assert.deepEqual(dev.schedules[1].calls, [{ method: 'Script.Start', params: { id: 3 } }]);
  assert.deepEqual(dev.schedules[2].calls, [{ method: 'Switch.Set', params: { id: 0, on: false } }]);
  assert.equal(dev.switches[0].config.auto_off_delay, 50, 'tMax 40 + 10');
  assert.match(r.log.join('\n'), /Sicherung zrb1\.\.5 wird geschrieben/);
  assert.match(r.log.join('\n'), /ZEITRAFFER aktiv: bw_main alle 3 min, bw_pump alle 6 min \(Sekunde 30\), Budget 120 s, bis 3 Portionen/);
  assert.equal(dev.script('bw_zeitraffer').running, false);
  assert.equal(dev.script('bw_install').running, false);
  for (const [k, v] of dev.kvs) assert.ok(v.length <= 253, k + ' hat ' + v.length + ' Zeichen');
});

test('erneuter Start im Zeitraffer: Sicherung des Originals bleibt, Profile und Zustand werden neu gesetzt', () => {
  const dev = inBetrieb();
  const orig = original(dev);
  ok(runZeitraffer(dev));
  patch(dev, 'cfg3', { tMax: 9, tHot: 35 });   // Handänderungen im Zeitraffer
  patch(dev, 'cfg4', { nPort: 1 });
  patch(dev, 'day', { date: '2026-09-12', n: 3, sec: 15 });
  const r = runZeitraffer(dev);
  ok(r);
  assert.match(r.log.join('\n'), /Sicherung bleibt/);
  assert.deepEqual(dev.kvsGet('zrb1'), { cfg3: orig.cfg3 }, 'Original nicht durch Zeitraffer-Werte ersetzt');
  assert.deepEqual(dev.kvsGet('zrb4'), { cfg4: orig.cfg4 });
  assert.deepEqual(dev.kvsGet('zrb5'), { cfg2: orig.cfg2 });
  assert.equal(dev.kvsGet('cfg3').tMax, 40);
  assert.equal(dev.kvsGet('cfg3').tHot, 30);
  assert.equal(dev.kvsGet('cfg4').nPort, 3);
  assert.deepEqual(dev.kvsGet('day'), DEF.day);
  assert.equal(dev.kvsRaw('zr'), undefined);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ZR_SPECS);
});

test('Sicherung einer älteren bw_zeitraffer-Version (nur zrb1..3): erneuter Start legt zrb4/zrb5 aus den noch unveränderten cfg4/cfg2 an', () => {
  const dev = inBetrieb();
  const orig = original(dev);
  dev.kvsSetRaw('zrb1', { cfg3: orig.cfg3 });
  dev.kvsSetRaw('zrb2', { lrn: orig.lrn, st: orig.st });   // alte Aufteilung
  dev.kvsSetRaw('zrb3', { day: orig.day, err: orig.err });
  patch(dev, 'cfg3', { tick: 1, winEvery: 2, tMax: 5 });
  ok(runZeitraffer(dev));
  assert.deepEqual(dev.kvsGet('zrb4'), { cfg4: orig.cfg4 });
  assert.deepEqual(dev.kvsGet('zrb5'), { cfg2: orig.cfg2 });
  assert.deepEqual(dev.kvsGet('zrb2'), { lrn: orig.lrn, st: orig.st }, 'vorhandene Sicherung unangetastet');
  ok(runScript(dev, FILES.bw_install));
  assert.deepEqual(dev.kvsGet('st'), orig.st, 'Rückbau nimmt st auch aus der alten zrb2-Aufteilung');
  assert.deepEqual(dev.kvsGet('day'), orig.day);
  assert.deepEqual(dev.kvsGet('cfg2'), orig.cfg2);
  for (const k of ZRB) assert.equal(dev.kvsRaw(k), undefined, k + ' gelöscht');
});

test('ohne cfg4 (Installer v0.1.3 noch nicht gelaufen) bricht bw_zeitraffer ab, nichts geschrieben', () => {
  const dev = inBetrieb();
  dev.kvs.delete('cfg4');
  const r = runZeitraffer(dev);
  assert.match(r.log.join('\n'), /ABBRUCH: cfg1\.\.cfg4 unvollständig – erst bw_install starten/);
  assert.equal(dev.kvsRaw('zrb1'), undefined);
  assert.equal(dev.kvsGet('cfg3').tick, 15);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), NORMAL_SPECS);
});

test('Rückkehr mit bw_install: Original zurück (cfg2/cfg3/cfg4, Zustand), Sicherung gelöscht, Zeitplan und auto_off normal, danach idempotent', () => {
  const dev = inBetrieb();
  const orig = original(dev);
  ok(runZeitraffer(dev));
  patch(dev, 'lrn', { tMaxD: 32, effW: 9.5 });   // Hitze und Lernwert im Test
  patch(dev, 'day', { date: '2026-09-12', n: 4, sec: 20 });
  let r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.match(r.log.join('\n'), /Zeitraffer beenden: Original aus zrb1\.\.5/);
  assert.match(r.log.join('\n'), /Zeitraffer beendet/);
  for (const k of Object.keys(orig)) assert.deepEqual(dev.kvsGet(k), orig[k], k + ' zurück');
  assert.deepEqual(dev.kvsGet('job'), DEF.job);
  for (const k of ['zr'].concat(ZRB)) assert.equal(dev.kvsRaw(k), undefined, k + ' gelöscht');
  assert.deepEqual(dev.schedules.map((j) => j.timespec), BETRIEB_SPECS, 'Sicherheits-Aus aus dem zurückgeschriebenen cfg4.tWin 300');
  assert.equal(dev.switches[0].config.auto_off_delay, 100, 'tMax 90 + 10');
  r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(r.writes, 0);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), BETRIEB_SPECS);
});

test('Abbruch vor der Marke: Sicherung ohne zr → der nächste bw_install baut zurück', () => {
  const dev = inBetrieb();
  const orig = original(dev);
  dev.kvsSetRaw('zrb1', { cfg3: orig.cfg3 });
  dev.kvsSetRaw('zrb2', { lrn: orig.lrn, day: orig.day });
  dev.kvsSetRaw('zrb3', { st: orig.st, err: orig.err });
  dev.kvsSetRaw('zrb4', { cfg4: orig.cfg4 });
  dev.kvsSetRaw('zrb5', { cfg2: orig.cfg2 });
  patch(dev, 'cfg3', { tick: 3, winEvery: 6, tMax: 40 });
  patch(dev, 'cfg4', { tWin: 120 });
  patch(dev, 'cfg2', { pctDry: 39 });
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  for (const k of Object.keys(orig)) assert.deepEqual(dev.kvsGet(k), orig[k], k + ' zurück');
  assert.deepEqual(dev.schedules.map((j) => j.timespec), BETRIEB_SPECS);
  for (const k of ZRB) assert.equal(dev.kvsRaw(k), undefined, k + ' gelöscht');
});

test('Fahrplan im Zeitraffer (Topfmodell): feucht → Fenster 1 in Portionen → 12 min Pause → Fenster 2 → Hitze-Fenster nach 6 min → wasser → Fenster 4 → limit, 42 min', () => {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 8, 5, 20) }); // 10:05:20 lokal; Simulation ab S = 10:06 (Minute ≡ 0 mod 6)
  ok(runZeitraffer(dev));
  const c2 = dev.kvsGet('cfg2');
  // Topfmodell: Schlauch am Sensor, Wirkung 1 %/s wirksamer Pumpensekunde, Totzeit 2 s (= cfg3.tDead) bzw. 0 (tDead2), sichtbar über 15 s.
  // Fenster 1: P1 tStd 12 s → 20+10 = 30 %, P2 aus der gemessenen Wirkung: Ziel min(55, 30+15) → 15 s → 45 %, P3: Ziel 52,5 → 7,5 s → tPmin 10 s
  // → 55 % ≥ pctOk 50 → ok, Σ 37 ≤ tMax 40, effW 1; Zeit 3·(Portion + tSoak 10 + 3·tStep) ≈ 113 s ≤ tWin 120. Danach Auftrag
  // round((55−20)/1·sf + 2) = 26–30 s → tPmax 15 → P1 15 s + Korrekturportionen → im Band, sf steigt je Fenster um sfUp.
  const model = potModel(dev, { pct0: 50, effLocal: 1, tDead: 2, tDead2: 0, tRamp: 15 });
  const env = { tC: 22, empty: false };
  dev.tC = () => env.tC;
  dev.inputs[1] = () => env.empty;
  // Handgriffe des Testers, wirksam ab Minute k (vor dem Takt der Minute k): Sensor in trockene Erde = Topfmodell auf 20 % zurücksetzen
  const at = {
    3: () => model.reset({ pct0: 20 }),                       // 3: Sensor aus dem Wasserglas in trockene Erde → Auftrag, 6:30 Fenster 1
    13: () => model.reset({ pct0: 20 }),                      // 9–14: Sensor zurück in trockene Erde (Kontrolle bei 9 sah den Fensterwert)
    19: () => { env.tC = 31; },                               // 19: Fühler über tHot 30 °C → pauseHot 0.1 h
    22: () => model.reset({ pct0: 20 }),                      // Sensor trocken, nachdem die Kontrolle bei 21 gelaufen ist
    25: () => { env.empty = true; },                          // 25–30: Schwimmer LEER
    31: () => { env.empty = false; model.reset({ pct0: 20 }); }, // 31: VOLL, Sensor trocken
  };
  const S = dev.nowMs - (dev.nowMs % 60000) + 60000;
  const MIN = 60000;
  const e0 = dev.errors.length;
  const runs = simulate(dev, S + 42 * MIN, { bw_main: FILES.bw_main, bw_pump: FILES.bw_pump }, {
    onMinute: (d, t) => { const k = Math.round((t - S) / MIN) + 1; if (at[k]) at[k](); },
  });
  assert.deepEqual(dev.errors.slice(e0), [], 'keine Überlappung mit bw_main, kein hängender Lauf');
  for (const r of runs) {
    assert.ok(!r.skipped, r.name + ' übersprungen (lief noch) um ' + new Date(r.t).toISOString());
    assert.deepEqual(r.result.errors, [], r.name + ' um ' + new Date(r.t).toISOString());
    assert.equal(r.result.stopped, true, r.name + ' hat sich nicht beendet');
  }
  const mains = runs.filter((r) => r.name === 'bw_main'), pumps = runs.filter((r) => r.name === 'bw_pump');
  assert.equal(mains.length, 15, 'bw_main alle 3 Minuten (0..42)');
  assert.equal(pumps.length, 8, 'bw_pump alle 6 Minuten (0..42)');
  for (const p of pumps) assert.ok(p.result.elapsedMs <= (ZR4.tWin + ZR4.tTail) * 1000, 'bw_pump-Lauf ' + p.result.elapsedMs + ' ms > tWin + tTail');
  const last = (r) => r.result.log[r.result.log.length - 1];
  const ergebnis = (r) => /ergebnis=(\S+)/.exec(last(r))[1];
  assert.deepEqual(pumps.map(ergebnis), ['kein_auftrag', 'ok', 'kein_auftrag', 'ok', 'ok', 'kein_auftrag', 'ok', 'kein_auftrag'], 'Fenster 1–4 bei Minute 6, 18, 24, 36');
  // Portionen: Einschaltbefehle je 6-min-Zyklus; erste Portion bei Sekunde 30–59 der Fensterminute, höchstens nPort je Fenster, Σ ≤ tMax
  const ons = dev.switchLog.filter((e) => e.on);
  const byWin = new Map();
  for (const e of ons) { const c = Math.floor((e.t - S) / (6 * MIN)); if (!byWin.has(c)) byWin.set(c, []); byWin.get(c).push(e); }
  assert.deepEqual([...byWin.keys()].map((c) => c * 6), [6, 18, 24, 36], 'Gaben in Minute 6, 18 (Pause 12 min), 24 (Hitze: 6 min), 36 (nach LEER)');
  for (const [c, list] of byWin) {
    const first = list[0].t - S - c * 6 * MIN;
    assert.ok(first >= 30000 && first < 60000, 'erste Portion nach dem Start bei Sekunde 30: ' + first + ' ms');
    assert.ok(list.length >= 2 && list.length <= ZR4.nPort, 'Fenster Minute ' + c * 6 + ': ' + list.length + ' Portionen (Regelkreis: mindestens eine Korrekturportion, höchstens nPort)');
    const sum = list.reduce((a, e) => a + e.toggle_after, 0);
    assert.ok(sum <= ZR3.tMax, 'Σ toggle_after ' + sum + ' ≤ tMax');
    for (const e of list) assert.ok(e.toggle_after >= ZR4.tPmin && e.toggle_after <= ZR4.tPmax, 'Portion ' + e.toggle_after + ' s in [tPmin, tPmax]');
  }
  assert.equal(byWin.get(1)[0].toggle_after, ZR3.tStd, 'allererste Portion = tStd');
  assert.equal(byWin.get(1).length, 3, 'Fenster 1: drei Portionen bis ins Band');
  for (const e of ons) {
    const off = dev.switchLog.find((x) => !x.on && x.t > e.t);
    assert.ok(off && off.t - e.t <= (e.toggle_after + 2) * 1000, 'Ausgang nach der Portion aus');
  }
  const why = (k) => /why=(\S+)/.exec(last(mains[k]))[1];
  assert.equal(why(0), 'feucht', 'Minute 0: Sensor im Wasserglas');
  assert.equal(why(1), 'ok', 'Minute 3: trockene Erde → Auftrag tStd');
  assert.match(last(mains[1]), /sec=12 /);
  assert.equal(why(3), 'pause', 'Minute 9: Kontrolle, normale Pause läuft');
  assert.match(mains[3].result.log.join('\n'), /Kontrolle: 5\d(\.\d)? → 5\d(\.\d)? %/);
  assert.equal(why(4), 'pause', 'Minute 12');
  assert.equal(why(5), 'ok', 'Minute 15: Pause vorbei, Dosis aus effW');
  assert.match(last(mains[7]), /pause=0\.1h/, 'Minute 21: Hitze → pauseHot');
  assert.equal(why(8), 'ok', 'Minute 24: Auftrag fürs Hitze-Fenster');
  assert.equal(why(9), 'wasser', 'Minute 27: Behälter leer');
  assert.equal(why(10), 'wasser', 'Minute 30');
  assert.equal(why(11), 'ok', 'Minute 33: wieder voll, Sensor trocken');
  assert.equal(why(13), 'limit', 'Minute 39: Tageslimit 4');
  assert.equal(why(14), 'limit');
  assert.equal(dev.kvsGet('day').n, 4);
  assert.equal(dev.kvsGet('err').code, null);
  const lrn = dev.kvsGet('lrn'), st = dev.kvsGet('st');
  assert.ok(Math.abs(lrn.effW - 1) < 0.2, 'im Fenster gelernt: effW ' + lrn.effW + ' ≈ 1 %/s');
  assert.ok(lrn.sf > 0.7 && lrn.sf <= 1, 'sf steigt um sfUp je Fenster mit Korrekturportion: ' + lrn.sf);
  assert.ok(lrn.tMaxD > 30, 'Hitze erkannt');
  assert.equal(st.why, 'ok');
  assert.ok(st.n >= 2 && st.pctW >= c2.pctOk && st.pctW <= c2.pctHi, 'letztes Fenster im Band: ' + JSON.stringify(st));
  // Sicherheits-Aus des Zeitplans: Minute ≡ 2 mod 6, Sekunde 40 (160 s nach der Fensterminute) – 7-mal in 42 min
  const offs = dev.rpcLog.filter((c) => c.source === 'schedule' && c.method === 'Switch.Set');
  assert.equal(offs.length, 7);
  assert.ok(offs.every((c) => (c.t - S) % (6 * MIN) === 2 * MIN + 40000), 'Sicherheits-Aus zur Sekunde 40 der Minute 2 jedes 6er-Zyklus');
});
