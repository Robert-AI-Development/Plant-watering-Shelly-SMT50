// tools/test/szenario.test.js v0.1.0 – sieben simulierte Tage mit Zeitplan, Austrocknung und Pumpenwirkung
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seeded, FILES, voltFor } = require('./helpers.js');
const { simulate } = require('../mock/shelly-mock.js');

const DAY = 24 * 3600 * 1000;

// Deterministisches Rauschen (LCG), damit der Test reproduzierbar bleibt
function makeRand(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }

// Einfaches Topfmodell: Feuchte sinkt linear, jede wirksame Pumpensekunde (nach tDead) bringt effTrue %
function setupModel(dev, opts) {
  const model = { pct: opts.pct, dryPerH: opts.dryPerH, effTrue: opts.effTrue, onAt: null, tDead: 20 };
  const rand = makeRand(opts.seed || 42);
  dev.voltage = () => voltFor(model.pct + (rand() - 0.5) * 0.3);
  dev.onSwitch = (d, id, on, t) => {
    if (id !== 0) return;
    if (on) model.onAt = t;
    else if (model.onAt !== null) {
      const s = (t - model.onAt) / 1000;
      model.pct = Math.min(100, model.pct + Math.max(0, s - model.tDead) * model.effTrue);
      model.onAt = null;
    }
  };
  return model;
}
function localMinute(dev, t) { return Math.floor((t + dev.tzOffsetMin * 60000) / 60000) % 1440; }
// Gießfenster = Gruppe von Einschaltungen (Portionen) mit weniger als 10 min Abstand; liefert je Fenster {t, ons}
function windows(dev) {
  const out = [];
  for (const e of dev.switchLog.filter((x) => x.on)) {
    const w = out[out.length - 1];
    if (w && e.t - w.t < 10 * 60000) w.ons.push(e); else out.push({ t: e.t, ons: [e] });
  }
  return out;
}

function runWeek(opts) {
  const dev = seeded({ nowMs: Date.UTC(2026, 8, 12, 4, 0, 0) }); // 06:00 lokal
  const model = setupModel(dev, opts);
  const start = dev.nowMs;
  const writesPerDay = [];
  let dayWrites = dev.kvsWrites, dayStart = start;
  const runs = simulate(dev, start + 7 * DAY, { bw_main: FILES.bw_main, bw_pump: FILES.bw_pump }, {
    onMinute: (d, t) => {
      model.pct = Math.max(0, model.pct - model.dryPerH / 60);
      const h = ((t + d.tzOffsetMin * 60000) / 3600000) % 24;
      d.tC = opts.tBase + opts.tAmp * Math.sin(((h - 9) / 24) * 2 * Math.PI); // Maximum am Nachmittag
      if (t - dayStart >= DAY) { writesPerDay.push(d.kvsWrites - dayWrites); dayWrites = d.kvsWrites; dayStart = t; }
    },
  });
  return { dev, model, runs, writesPerDay };
}

test('sieben Tage Normalbetrieb: Gaben nur in den Fenstern, Lernwert konvergiert, wenige Schreibvorgänge', () => {
  const { dev, runs, writesPerDay } = runWeek({ pct: 45, dryPerH: 0.7, effTrue: 0.25, tBase: 22, tAmp: 5 });
  for (const r of runs) {
    assert.deepEqual(r.result.errors, [], r.name + ' um ' + new Date(r.t).toISOString());
    assert.equal(r.result.stopped, true, r.name + ' hat sich nicht beendet');
  }
  const mains = runs.filter((r) => r.name === 'bw_main');
  const pumps = runs.filter((r) => r.name === 'bw_pump');
  assert.equal(mains.length, 7 * 96, 'bw_main alle 15 min');
  assert.equal(pumps.length, 7 * 2, 'bw_pump zweimal täglich');
  const wins = windows(dev);
  assert.ok(wins.length >= 3 && wins.length <= 7, 'Gaben (Fenster) in sieben Tagen: ' + wins.length);
  for (const w of wins) {
    const min = localMinute(dev, w.t);
    assert.ok(min === 8 * 60 || min === 20 * 60, 'Gabe außerhalb der Fenster um Minute ' + min);
    assert.ok(w.t % 60000 >= 30000 && w.t % 60000 < 45000, 'Pumpe schaltet nach dem Start bei Sekunde 30 ein (nie neben bw_main): ' + (w.t % 60000));
    let sum = 0;
    for (const e of w.ons) { assert.ok(e.toggle_after >= 10 && e.toggle_after <= 120, 'toggle_after ' + e.toggle_after); sum += e.toggle_after; assert.ok(e.t - w.t <= 8 * 60000, 'Portion später als 8 min nach dem Fenster'); }
    assert.ok(sum <= 180, 'Fenstersumme ' + sum);
    assert.ok(w.ons[0].toggle_after >= 25, 'Erstportion ≥ tMin');
  }
  // kein bw_pump-Lauf reicht in einen bw_main-Takt hinein (Überlappungswächter des Mocks meldet sonst dev.errors)
  // nach jeder Gabe ist der Ausgang spätestens tMax + 10 s wieder aus
  for (let i = 0; i < dev.switchLog.length; i++) {
    const e = dev.switchLog[i];
    if (!e.on) continue;
    const off = dev.switchLog.slice(i + 1).find((x) => !x.on);
    assert.ok(off && off.t - e.t <= 130000, 'Ausgang blieb zu lange an');
  }
  const lrn = dev.kvsGet('lrn');
  // seit bw_main v0.2.0 lernt nur bw_pump im Fenster (lrn.effW); bw_main bewertet nicht mehr
  assert.ok(lrn.effW !== null && Math.abs(lrn.effW - 0.25) < 0.08, 'effW gelernt: ' + lrn.effW);
  assert.ok(lrn.sf >= 0.7 && lrn.sf <= 1, 'sf nie unter dem Startwert 0,7 (kein zuviel): ' + lrn.sf);
  assert.equal(dev.kvsGet('err').code, null);
  assert.ok(dev.kvsGet('lrn').tMaxY >= 26 && dev.kvsGet('lrn').tMaxY <= 28, 'Tagesmaximum gestern: ' + dev.kvsGet('lrn').tMaxY);
  assert.ok(dev.kvsGet('lrn').rate > 0, 'Austrocknungsrate positiv: ' + dev.kvsGet('lrn').rate);
  // Erfahrungswert im Mock: 8–9 Schreibvorgänge an Tagen ohne Gabe, 13–16 an Tagen mit Gabe (statt 96 Takten);
  // der erste Tag enthält zusätzlich die drei Schreibvorgänge der Inbetriebnahme
  // Erfahrungswert seit Etappe 10: je Fenster Claim + st/day/job/lrn (5) statt 3; gemessen und in docs/PLAN.md eingetragen
  for (const w of writesPerDay.slice(1)) assert.ok(w <= 24, 'zu viele KVS-Schreibvorgänge an einem Tag: ' + w + ' (' + writesPerDay.join(',') + ')');
  const rest = writesPerDay.slice(1);
  assert.ok(rest.reduce((a, b) => a + b, 0) / rest.length < 18, 'Durchschnitt: ' + writesPerDay.join(','));
  assert.equal(dev.maxPendingRpc, 1);
  // Wochen-Trockenphase (bw_main v0.2.0, cfg3.dryDay 5): der Freitag 18.09. liegt in der Woche → genau eine Trockenphase,
  // danach sinkt die Feuchte vor der nächsten Gabe unter pctDry 28 – das Wochenende endet deshalb unter 30 %
  const dryLines = runs.flatMap((r) => (r.result ? r.result.log : [])).filter((l) => /Trockenphase/.test(l));
  assert.deepEqual(dryLines.map((l) => l.replace(/^\[bw_main [\d.]+\] /, '')), ['Trockenphase (Wochentag 5): warte auf < 28 %'], 'genau eine Trockenphase (Freitag)');
  const pctEnd = Number(mains[mains.length - 1].result.log[0].match(/pct=([\d.]+)/)[1]);
  assert.ok(pctEnd > 20 && pctEnd < 70, 'Feuchte bleibt im Arbeitsbereich (nach der Trockenphase unter 28): ' + pctEnd);
});

test('Hitzetage: zwei Gaben am Tag möglich, Tageslimit hält', () => {
  const { dev } = runWeek({ pct: 42, dryPerH: 2.0, effTrue: 0.25, tBase: 32, tAmp: 6 });
  const perDay = {};
  for (const w of windows(dev)) { const d = new Date(w.t + dev.tzOffsetMin * 60000).toISOString().slice(0, 10); perDay[d] = (perDay[d] || 0) + 1; }
  const counts = Object.values(perDay);
  assert.ok(counts.some((c) => c === 2), 'an mindestens einem Tag zwei Gaben (12-h-Pause): ' + JSON.stringify(perDay));
  assert.ok(counts.every((c) => c <= 2), 'nie mehr als maxDay');
  assert.equal(dev.kvsGet('err').code, null);
});

test('Pumpe ohne Wirkung: Störung noeff (aus dem Fenster, bw_pump) und nie wieder Wasser', () => {
  // bw_main v0.2.0 setzt noeff nicht mehr; bw_pump v0.2.0 entscheidet es nach zwei wirkungslosen Portionen im selben Fenster
  const { dev } = runWeek({ pct: 35, dryPerH: 0.7, effTrue: 0, tBase: 22, tAmp: 5 });
  const ons = dev.switchLog.filter((e) => e.on);
  assert.ok(ons.length >= 1 && ons.length <= 2, 'höchstens zwei Portionen (Erst- und Probeportion): ' + ons.length);
  assert.equal(dev.kvsGet('err').code, 'noeff');
  assert.equal(dev.kvsGet('lrn').effW, null);
});
