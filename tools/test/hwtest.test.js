// tools/test/hwtest.test.js v0.1.0 – Etappe 8: bw_hwtest (Sensorphasen, Kommandos, Kalibrierung) im Mock mit virtuellem Bediener
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hwDevice, patch, runHwtest } = require('./helpers.js');
const { ramps, driver } = require('../mock/hwdemo.js');
const { KVS_MAX_VAL } = require('../mock/shelly-mock.js');

function ok(r) { assert.deepEqual(r.errors, []); assert.equal(r.stopped, true, 'Script hat sich nicht beendet'); }
function snapshot(dev, keys) { const o = {}; for (const k of keys) o[k] = dev.kvsRaw(k); return o; }
const CFG1_REST = ['vErrLo', 'vErrHi', 'nSample', 'msSample', 'nLvl', 'idV', 'idT', 'idLvl', 'idSw'];

test('Volldurchlauf: alle sechs Phasen ok, Kalibrierwerte in cfg1, ein Timer, ein RPC, flache Kette', () => {
  const dev = hwDevice();
  const before = snapshot(dev, ['st', 'day', 'job', 'err', 'lrn', 'cfg1']);
  ramps(dev); driver(dev);
  const r = runHwtest(dev);
  ok(r);
  const hwr = dev.kvsGet('hwr');
  assert.equal(hwr.r, 'ok,ok,ok,ok,ok,ok');
  assert.equal(hwr.s, 'ende');
  assert.deepEqual(hwr.t, [19, 31]);
  assert.deepEqual(hwr.m, [0.21, 3.1]);
  assert.deepEqual(hwr.l, [1, 0]);
  assert.equal(hwr.n, '', 'keine Vermerke (kein "sofort")');
  assert.ok(dev.kvsRaw('hwr').length <= KVS_MAX_VAL);
  assert.ok(dev.kvsRaw('hwt').length <= KVS_MAX_VAL, 'hwt angelegt und unter dem Limit');
  const cfg1 = dev.kvsGet('cfg1');
  assert.equal(cfg1.vDry, 0.21);
  assert.equal(cfg1.vWet, 3.1);
  assert.equal(cfg1.lvlEmpty, 1);
  const c0 = JSON.parse(before.cfg1);
  for (const k of CFG1_REST) assert.equal(cfg1[k], c0[k], 'cfg1.' + k + ' unverändert');
  for (const k of ['st', 'day', 'job', 'err', 'lrn']) assert.equal(dev.kvsRaw(k), before[k], k + ' unberührt');
  assert.equal(dev.switchLog.length, 0, 'schaltet nie');
  assert.ok(r.writes <= 12, 'Schreibvorgänge ' + r.writes);
  assert.ok(r.maxCallDepth <= 10, 'Aufruftiefe ' + r.maxCallDepth);
  assert.equal(dev.maxTimersUsed, 1);
  assert.equal(dev.maxPendingRpc, 1);
  assert.match(r.log.join('\n'), /Bericht 5\/5 Ende/);
  // Ausgaberate: nie mehr als 4 Zeilen in derselben virtuellen Sekunde (Phasenwechsel), sonst höchstens eine
  const perSec = new Map();
  dev.logT.slice(dev.logT.length - r.log.length).forEach((t) => perSec.set(Math.floor(t / 1000), (perSec.get(Math.floor(t / 1000)) || 0) + 1));
  assert.ok(Math.max(...perSec.values()) <= 4, 'Print-Burst: ' + Math.max(...perSec.values()) + ' Zeilen in einer Sekunde');
});

test('hwt wirkt: eigene Schwelle, nur Feuchte-Phasen, Kalibrierung nur melden', () => {
  const dev = hwDevice();
  patch(dev, 'hwt', { tLo: 22, run: 'm', cal: 0 });
  const c0 = dev.kvsRaw('cfg1');
  ramps(dev); driver(dev);
  const r = runHwtest(dev);
  ok(r);
  const hwr = dev.kvsGet('hwr');
  assert.equal(hwr.r, 'sk,sk,ok,ok,sk,sk');
  assert.equal(dev.kvsRaw('cfg1'), c0, 'cfg1 unverändert (cal=0)');
  assert.match(r.log.join('\n'), /nur melden/);
  assert.equal(dev.kvsGet('hwt').tLo, 22, 'hwt nicht überschrieben');
});

test('Timeout je Phase: Temperatur bleibt, Lauf geht weiter, Kalibrierung der übrigen Phasen bleibt möglich', () => {
  const dev = hwDevice();
  patch(dev, 'hwt', { tPhase: 30 });
  ramps(dev); driver(dev);
  dev.tC = 24;
  const r = runHwtest(dev);
  ok(r);
  const hwr = dev.kvsGet('hwr');
  assert.equal(hwr.r, 'to,to,ok,ok,ok,ok');
  assert.deepEqual(hwr.t, [24, 24]);
  assert.equal(dev.kvsGet('cfg1').vDry, 0.21);
  assert.ok(r.elapsedMs < 10 * 60 * 1000);
});

test('Kommandos: skip überspringt, abort bricht ab und schreibt den Bericht; nichts in cfg1', () => {
  const dev = hwDevice();
  const c0 = dev.kvsRaw('cfg1');
  ramps(dev); driver(dev, { skip: ['t1'], abort: 'm2' });
  const r = runHwtest(dev);
  ok(r);
  const hwr = dev.kvsGet('hwr');
  assert.equal(hwr.r, 'sk,ok,ok,ab,-,-');
  assert.equal(hwr.s, 'abbruch');
  assert.equal(dev.kvsRaw('cfg1'), c0);
  assert.match(r.log.join('\n'), /ABBRUCH: dauer/);
});

test('altes Kommando in hwc wird ignoriert; go in einer Phase ohne Warten wird verworfen', () => {
  const dev = hwDevice();
  dev.kvsSetRaw('hwc', { n: 5, cmd: 'abort' });
  ramps(dev);
  const d = driver(dev, { goAfter: { t1: 2, m1: 15, l1: 6, l2: 6 } });
  d.n = 5;   // der Treiber zählt hinter dem alten Eintrag weiter
  const r = runHwtest(dev);
  ok(r);
  assert.equal(dev.kvsGet('hwr').r, 'ok,ok,ok,ok,ok,ok');
  assert.match(r.log.join('\n'), /go ignoriert: Phase t1/);
  assert.doesNotMatch(r.log.join('\n'), /Kommando abort/);
});

test('Sensor liefert null: Phase endet mit nl statt zu hängen', () => {
  const dev = hwDevice();
  ramps(dev); driver(dev);
  dev.tC = null;
  const r = runHwtest(dev);
  ok(r);
  const hwr = dev.kvsGet('hwr');
  assert.equal(hwr.r, 'nl,nl,ok,ok,ok,ok');
  assert.match(r.log.join('\n'), /t1: Sensor liefert null/);
});

test('input:1 deaktiviert (Gerätezustand 12.09.2026): Schwimmerphasen nl, Feuchte kalibriert, lvlEmpty unverändert', () => {
  const dev = hwDevice();
  dev.inputCfg[1].enable = false;
  ramps(dev); driver(dev);
  const r = runHwtest(dev);
  ok(r);
  const hwr = dev.kvsGet('hwr');
  assert.equal(hwr.r, 'ok,ok,ok,ok,nl,nl');
  assert.equal(dev.kvsGet('cfg1').vDry, 0.21);
  assert.equal(dev.kvsGet('cfg1').lvlEmpty, 1);
  assert.match(hwr.cal, /;-$/);
});

test('Bedingung beim Start schon erfüllt: Vermerk "sofort" im Bericht', () => {
  const dev = hwDevice();
  ramps(dev); driver(dev);
  dev.tC = 19;
  const r = runHwtest(dev);
  ok(r);
  const hwr = dev.kvsGet('hwr');
  assert.equal(hwr.r.slice(0, 5), 'ok,to');
  assert.match(hwr.n, /t1:sofort/);
});

test('Kalibrierung unplausibel: Sensor halb im Wasser (vWet − vDry < 1 V) wird gemeldet, nicht geschrieben', () => {
  const dev = hwDevice();
  patch(dev, 'hwt', { vWetMin: 1.0 });
  const c0 = dev.kvsRaw('cfg1');
  ramps(dev, { vWet: 1.15 }); driver(dev);
  const r = runHwtest(dev);
  ok(r);
  const hwr = dev.kvsGet('hwr');
  assert.equal(hwr.r, 'ok,ok,ok,ok,ok,ok');
  assert.match(hwr.n, /cal:vWet-vDry<1V/);
  const c1 = dev.kvsGet('cfg1');
  assert.equal(c1.vDry, JSON.parse(c0).vDry);
  assert.equal(c1.vWet, JSON.parse(c0).vWet);
  assert.equal(c1.lvlEmpty, 1, 'Schwimmer-Kalibrierung unabhängig davon');
});

test('Trockenpunkt nur unter vDryMax und nicht mehr fallend: feuchter Sensor bleibt in der Warteschleife', () => {
  const dev = hwDevice();
  patch(dev, 'hwt', { tPhase: 40, run: 'm' });
  ramps(dev, { vDry: 0.6 }); driver(dev);
  const r = runHwtest(dev);
  ok(r);
  assert.equal(dev.kvsGet('hwr').r, 'sk,sk,to,ok,sk,sk');
  assert.match(r.log.join('\n'), /Sensor nicht trocken/);
  assert.equal(dev.kvsGet('cfg1').vDry, 0.2, 'cfg1 unverändert');
});

test('Schwimmer ohne beobachteten Wechsel: l1 wartet trotz go bis zum Timeout, l2 danach ohne Vergleichswert', () => {
  const dev = hwDevice();
  patch(dev, 'hwt', { tPhase: 30, run: 'l' });
  driver(dev);
  dev.inputs[1] = false;   // Schwimmer bewegt sich nie
  const r = runHwtest(dev);
  ok(r);
  const hwr = dev.kvsGet('hwr');
  assert.equal(hwr.r, 'sk,sk,sk,sk,to,ok');
  assert.match(r.log.join('\n'), /noch kein Wechsel/);
  assert.equal(dev.kvsGet('cfg1').lvlEmpty, 1);
});

test('Ausnahme im Tick beendet das Script sauber; hwr bleibt auf "lauf"', () => {
  const dev = hwDevice();
  ramps(dev); driver(dev);
  let n = 0;
  dev.tC = () => { n++; if (n === 30) throw new Error('Sensorfehler simuliert'); return 19; };
  const r = runHwtest(dev);
  assert.equal(r.stopped, true);
  assert.equal(r.errors.length, 0, 'Fehler wird im Script gefangen: ' + r.errors.join());
  assert.match(r.log.join('\n'), /ABBRUCH: Sensorfehler simuliert/);
  assert.equal(dev.timers.size, 0, 'Timer aufgeräumt');
});
