// tools/test/potmodel.test.js v0.1.0 – Topfmodell potModel (Rampe, Totzeit, Drain, Hydrophobie, Sättigung, Rauschen),
// noBurst, simulate: maxMs je Lauf und Überlappungswächter
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Device, seeded, patch, potModel, noBurst, voltFor, runPump } = require('./helpers.js');
const { simulate } = require('../mock/shelly-mock.js');

const MIN = 60000;
// wie Switch.Set mit toggle_after: der Geräte-Timer schaltet nach sec Sekunden aus
function pump(dev, sec) { dev.setSwitch(0, true, sec, 'test'); }
function near(a, b, eps, msg) { assert.ok(Math.abs(a - b) <= eps, (msg || '') + ': ' + a + ' ≠ ' + b + ' ± ' + eps); }
function nextMinute(dev) { return dev.nowMs - (dev.nowMs % MIN) + MIN; }
function specAt(dev, ms) { const d = new Date(ms + dev.tzOffsetMin * MIN); return d.getUTCSeconds() + ' ' + d.getUTCMinutes() + ' ' + d.getUTCHours() + ' * * *'; }

// Zwei kleine Scripts für die simulate-Prüfungen: bw_lang wartet 3 min mit einem Timer, bw_kurz beendet sich sofort
function tmpScripts() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-potmodel-'));
  const lang = path.join(dir, 'bw_lang.js');
  fs.writeFileSync(lang, 'var ID = Shelly.getCurrentScriptId();\nprint("lang start");\nfunction stop() { Shelly.call("Script.Stop", { id: ID }); }\nTimer.set(180000, false, stop);\n');
  const kurz = path.join(dir, 'bw_kurz.js');
  fs.writeFileSync(kurz, 'print("kurz");\nShelly.call("Script.Stop", { id: Shelly.getCurrentScriptId() });\n');
  return { dir: dir, lang: lang, kurz: kurz, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
function withScripts(dev, names) {
  const ids = {};
  for (const n of names) { const id = 100 + Object.keys(ids).length; dev.scripts.push({ id: id, name: n, enable: true, running: false }); ids[n] = id; }
  return ids;
}

test('Rampe: Anstieg schon während der Portion, +15 % genau tRamp s nach dem Abschalten; tRamp 0 = Sofortmodell', () => {
  const dev = new Device();
  const m = potModel(dev, { pct0: 30, effLocal: 1, tDead: 5, tRamp: 15 });
  const t0 = dev.nowMs;
  assert.equal(m.pct(t0), 30);
  pump(dev, 20);
  dev.advance(5000);
  near(m.pct(), 30, 1e-9, 'Totzeit: noch nichts sichtbar');
  dev.advance(7500);
  assert.ok(m.pct() > 30 && m.pct() < 45, 'steigt während der Portion: ' + m.pct());
  dev.advance(7500);
  assert.equal(dev.switches[0].output, false, 'Geräte-Timer hat abgeschaltet');
  assert.equal(m.intervals[0].tOff, t0 + 20000);
  near(m.pct(), 37.5, 1e-9, 'beim Abschalten ist die Hälfte sichtbar');
  dev.advance(15000);
  near(m.pct(), 45, 1e-9, '+15 genau tRamp nach dem Abschalten');
  dev.advance(10 * MIN);
  near(m.pct(), 45, 1e-9, 'bleibt stehen (kein Drain, keine Austrocknung)');
  let prev = 30;
  for (let s = 0; s <= 40; s++) { const p = m.pct(t0 + s * 1000); assert.ok(p >= prev - 1e-9, 'monoton bei s=' + s); prev = p; }
  assert.deepEqual(m.portions().map((p) => [p.dur, p.dead, p.W, p.first]), [[20, 5, 15, true]]);
  // Sofortmodell: tRamp 0 → beim Abschalten alles da; Spannung folgt dem Modell
  const dev2 = new Device();
  const m2 = potModel(dev2, { pct0: 30, effLocal: 1, tDead: 5, tRamp: 0 });
  pump(dev2, 20);
  dev2.advance(20000);
  near(m2.pct(), 45, 1e-9, 'tRamp 0: sofort +15');
  near(dev2.readVoltage(), voltFor(45), 1e-9, 'Voltmeter liefert den Modellwert');
  near(dev2.componentStatus('voltmeter', 100).voltage, voltFor(45), 1e-9);
  // Transportverzögerung: mit delay 10 kommt alles 10 s später
  const dev3 = new Device();
  const m3 = potModel(dev3, { pct0: 30, effLocal: 1, tDead: 5, tRamp: 0, delay: 10 });
  pump(dev3, 20);
  dev3.advance(20000);
  near(m3.pct(), 35, 1e-9, 'delay 10: beim Abschalten erst 5 Wirksekunden sichtbar');
  dev3.advance(10000);
  near(m3.pct(), 45, 1e-9, 'delay 10: nach 10 s alles');
});

test('Totzeit: erste Portion eines Fensters tDead, weitere innerhalb gapMin tDead2, nach einer Lücke wieder tDead', () => {
  const dev = new Device();
  const m = potModel(dev, { pct0: 20, effLocal: 1, tDead: 20, tDead2: 10, tRamp: 0, gapMin: 10 });
  pump(dev, 30); dev.advance(30000);
  near(m.pct(), 30, 1e-9, 'erste Portion: 30 − 20 = 10 Wirksekunden');
  dev.advance(MIN);
  pump(dev, 30); dev.advance(30000);
  near(m.pct(), 50, 1e-9, 'zweite Portion nach 60 s: 30 − 10 = 20 Wirksekunden');
  dev.advance(11 * MIN);
  pump(dev, 30); dev.advance(30000);
  near(m.pct(), 60, 1e-9, 'nach mehr als gapMin wieder tDead');
  assert.deepEqual(m.portions().map((p) => [p.dead, p.W, p.first]), [[20, 10, true], [10, 20, false], [20, 10, true]]);
  // Portion kürzer als die Totzeit bringt nichts
  dev.advance(MIN);
  pump(dev, 8); dev.advance(8000);
  near(m.pct(), 60, 1e-9, '8 s < tDead2 10 s: kein Gewinn');
  assert.equal(m.portions()[3].W, 0);
});

test('Drain: der Anteil drainFrac sickert mit tau weg, der Rest bleibt; Austrocknung dryPerH linear', () => {
  const dev = new Device();
  const m = potModel(dev, { pct0: 40, effLocal: 1, tDead: 0, tRamp: 0, drainFrac: 0.5, tau: 60 });
  pump(dev, 10); dev.advance(10000);
  const tOff = dev.nowMs;
  near(m.pct(), 50, 1e-9, 'voller Gewinn beim Abschalten');
  near(m.pct(tOff + 60000), 40 + 10 * (0.5 + 0.5 * Math.exp(-1)), 1e-9, 'nach tau');
  dev.advance(5 * MIN);
  const p = m.pct();
  assert.ok(p > 45 && p < 45.1, 'nach 5 tau nahe der Hälfte des Gewinns: ' + p);
  let prev = 50;
  for (let s = 0; s <= 300; s += 10) { const q = m.pct(tOff + s * 1000); assert.ok(q <= prev + 1e-9, 'fällt monoton bei s=' + s); prev = q; }
  const dev2 = new Device();
  const m2 = potModel(dev2, { pct0: 40, dryPerH: 1.5 });
  near(m2.pct(dev2.nowMs + 2 * 3600000), 37, 1e-9, '1,5 %/h über 2 h');
  near(m2.pct(dev2.nowMs + 100 * 3600000), 0, 1e-9, 'unten begrenzt');
});

test('Hydrophobie: unter pHydro bringt die Portion nur die Hälfte; Sättigung skaliert mit (1 − pct/100)', () => {
  const dev = new Device();
  const m = potModel(dev, { pct0: 20, effLocal: 1, tDead: 0, tDead2: 0, tRamp: 0, pHydro: 30 });
  pump(dev, 20); dev.advance(20000);
  near(m.pct(), 30, 1e-9, 'halbiert: +10 statt +20');
  dev.advance(30000);
  pump(dev, 20); dev.advance(20000);
  near(m.pct(), 50, 1e-9, 'ab pHydro voller Gewinn');
  assert.deepEqual(m.portions().map((p) => [p.f, p.pctOn]), [[0.5, 20], [1, 30]]);
  const dev2 = new Device();
  const m2 = potModel(dev2, { pct0: 60, effLocal: 1, tDead: 0, tRamp: 0, sat: true });
  pump(dev2, 10); dev2.advance(10000);
  near(m2.pct(), 64, 1e-9, '10 s × (1 − 0,6) = +4');
  near(m2.pct(dev2.nowMs + 1000), 64, 1e-9);
});

test('onSwitch-Kette, offenes Intervall, zweites Ein verlängert nur, Rauschen deterministisch, reset', () => {
  const dev = new Device();
  const seen = [];
  dev.onSwitch = (d, id, on, t) => seen.push((on ? 'on' : 'off') + id);
  const m = potModel(dev, { pct0: 50, effLocal: 1, tDead: 0, tRamp: 0, noise: 0.5, seed: 7 });
  dev.setSwitch(1, true, 5, 'test');   // anderer Schalter zählt nicht
  pump(dev, 30); dev.advance(10000);
  assert.deepEqual(seen, ['on1', 'on0', 'off1'], 'vorhandener Hook bleibt in der Kette (Schalter 1 nach 5 s wieder aus)');
  assert.equal(m.intervals.length, 1);
  assert.equal(m.intervals[0].tOff, null, 'Intervall offen');
  near(m.level(), 60, 1e-9, 'offen: bis jetzt 10 Wirksekunden');
  const a = m.pct(dev.nowMs), b = m.pct(dev.nowMs);
  assert.equal(a, b, 'Rauschen ist reine Funktion der Zeit');
  assert.ok(Math.abs(a - 60) <= 0.5 && a !== 60, 'Rauschen wirkt: ' + a);
  assert.notEqual(m.pct(dev.nowMs), m.pct(dev.nowMs + 1), 'andere Millisekunde, anderes Rauschen');
  pump(dev, 40);   // Ein während Ein: Gerät verlängert nur den Timer, kein neues Intervall
  dev.advance(20000);
  assert.equal(m.intervals.length, 1);
  assert.equal(m.intervals[0].tOff, null, 'läuft noch (Timer verlängert)');
  dev.advance(20000);
  assert.equal(m.intervals[0].tOff, dev.nowMs, 'nach 10 + 40 s aus');
  near(m.level(), 100, 1e-9, '50 Wirksekunden, oben begrenzt');
  m.reset();
  assert.equal(m.intervals.length, 0);
  assert.equal(m.lastOff, null);
  near(m.level(), 100, 1e-9, 'reset übernimmt den aktuellen Pegel als pct0');
  m.reset({ pct0: 25, noise: 0 });
  assert.equal(m.pct(), 25);
  assert.equal(m.t0, dev.nowMs);
});

test('bw_pump am Topfmodell: Gabe 70 s → Totzeit 20 s, Rampe, +12,5 % am Fühler', () => {
  const dev = seeded();
  const m = potModel(dev, { pct0: 40 });   // Standard: effLocal 0.25, tDead 20, tRamp 15
  near(dev.readVoltage(), voltFor(40, dev.kvsGet('cfg1')), 1e-9, 'cfg1 des Geräts für die Umrechnung');
  patch(dev, 'job', { ok: true, sec: 70, pct: 40, why: 'ok', ts: dev.unixtime() - 900 });
  const r = runPump(dev);
  assert.deepEqual(r.errors, []);
  assert.equal(r.stopped, true);
  assert.deepEqual(m.portions().map((p) => [p.dur, p.dead, p.W]), [[70, 20, 12.5]]);
  dev.runUntil(m.intervals[0].tOff + 15000, null);
  near(m.pct(), 52.5, 1e-9);
  near(dev.componentStatus('voltmeter', 100).voltage, voltFor(52.5), 1e-9);
});

test('noBurst: größter Schwall Konsolenzeilen je Zeitstempel, Fehler ab max', () => {
  const dev = new Device();
  const sb = dev.makeSandbox(2, null);
  for (let i = 0; i < 10; i++) sb.print('a' + i);
  dev.advance(1000);
  for (let i = 0; i < 3; i++) sb.print('b' + i);
  assert.equal(noBurst(dev), 10);
  for (let i = 0; i < 6; i++) sb.print('c' + i);
  assert.equal(noBurst(dev), 10, '9 Zeilen in der zweiten Sekunde');
  for (let i = 0; i < 7; i++) sb.print('d' + i);
  assert.throws(() => noBurst(dev), /Burst: 16 Konsolenzeilen zum selben Zeitpunkt .* erlaubt 15\): b0 \| b1/);
  assert.equal(noBurst(dev, null), 16);
  assert.equal(noBurst(dev, 20), 16);
  assert.equal(noBurst(new Device()), 0);
});

test('simulate: Überlappungswächter meldet einen Start, während ein früherer Lauf noch liefe', () => {
  const s = tmpScripts();
  try {
    const dev = new Device();
    const ids = withScripts(dev, ['bw_lang', 'bw_kurz']);
    const S = nextMinute(dev);
    dev.schedules.push({ id: 1, enable: true, timespec: specAt(dev, S), calls: [{ method: 'Script.Start', params: { id: ids.bw_lang } }] });
    dev.schedules.push({ id: 2, enable: true, timespec: specAt(dev, S + MIN), calls: [{ method: 'Script.Start', params: { id: ids.bw_kurz } }] });
    const runs = simulate(dev, S + 5 * MIN, { bw_lang: s.lang, bw_kurz: s.kurz });
    assert.deepEqual(runs.map((r) => [r.name, r.t, r.end, r.result.stopped]), [['bw_lang', S, S + 3 * MIN, true], ['bw_kurz', S + MIN, S + MIN, true]], 'Ende = Zeitpunkt des Script.Stop (synchron im Dispatcher)');
    assert.deepEqual(runs.map((r) => r.result.errors), [[], []]);
    assert.equal(dev.errors.length, 1, dev.errors.join('\n'));
    assert.match(dev.errors[0], /^Überlappung: bw_kurz startet um \d\d:\d\d:\d\d, während bw_lang noch bis \d\d:\d\d:\d\d läuft$/);
    assert.equal(dev.script('bw_lang').running, false);
    // ohne Überlappung (bw_kurz erst nach dem Ende von bw_lang) keine Meldung; maxMs-Standard 10 min reicht für 3 min
    const dev2 = new Device();
    const ids2 = withScripts(dev2, ['bw_lang', 'bw_kurz']);
    const S2 = nextMinute(dev2);
    dev2.schedules.push({ id: 1, enable: true, timespec: specAt(dev2, S2), calls: [{ method: 'Script.Start', params: { id: ids2.bw_lang } }] });
    dev2.schedules.push({ id: 2, enable: true, timespec: specAt(dev2, S2 + 3 * MIN), calls: [{ method: 'Script.Start', params: { id: ids2.bw_kurz } }] });
    const runs2 = simulate(dev2, S2 + 5 * MIN, { bw_lang: s.lang, bw_kurz: s.kurz });
    assert.equal(runs2.length, 2);
    assert.deepEqual(dev2.errors, []);
  } finally { s.cleanup(); }
});

test('simulate: maxMs wird durchgereicht – ein Lauf ohne Script.Stop wird gemeldet, running zurückgesetzt, Simulation läuft weiter', () => {
  const s = tmpScripts();
  try {
    const dev = new Device();
    const ids = withScripts(dev, ['bw_lang']);
    const S = nextMinute(dev);
    dev.schedules.push({ id: 1, enable: true, timespec: specAt(dev, S), calls: [{ method: 'Script.Start', params: { id: ids.bw_lang } }] });
    dev.schedules.push({ id: 2, enable: true, timespec: specAt(dev, S + MIN), calls: [{ method: 'Script.Start', params: { id: ids.bw_lang } }] });
    const runs = simulate(dev, S + 2 * MIN, { bw_lang: s.lang }, { maxMs: MIN });
    assert.deepEqual(runs.map((r) => [r.name, r.t, r.end, r.skipped, r.result.stopped]), [['bw_lang', S, S + MIN, undefined, false], ['bw_lang', S + MIN, S + 2 * MIN, undefined, false]], 'zweiter Start nicht übersprungen: running wurde zurückgesetzt');
    assert.equal(dev.script('bw_lang').running, false);
    assert.equal(dev.errors.length, 2, dev.errors.join('\n'));
    for (const e of dev.errors) assert.match(e, /^Script bw_lang hat sich nicht beendet \(maxMs 60000 ms, Start \d\d:\d\d:\d\d\)$/);
    assert.deepEqual(runs[0].result.errors, [dev.errors[0]], 'auch im Laufergebnis');
    assert.equal(dev.timers.size, 0, 'Timer des abgebrochenen Laufs sind weg');
  } finally { s.cleanup(); }
});
