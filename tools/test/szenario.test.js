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
  const ons = dev.switchLog.filter((e) => e.on);
  assert.ok(ons.length >= 3 && ons.length <= 7, 'Gaben in sieben Tagen: ' + ons.length);
  for (const e of ons) {
    const min = localMinute(dev, e.t);
    assert.ok(min === 8 * 60 || min === 20 * 60, 'Gabe außerhalb der Fenster um Minute ' + min);
    assert.ok(e.toggle_after >= 40 && e.toggle_after <= 120, 'toggle_after ' + e.toggle_after);
  }
  // nach jeder Gabe ist der Ausgang spätestens tMax + 10 s wieder aus
  for (let i = 0; i < dev.switchLog.length; i++) {
    const e = dev.switchLog[i];
    if (!e.on) continue;
    const off = dev.switchLog.slice(i + 1).find((x) => !x.on);
    assert.ok(off && off.t - e.t <= 130000, 'Ausgang blieb zu lange an');
  }
  const lrn = dev.kvsGet('lrn');
  assert.ok(lrn.eff !== null && Math.abs(lrn.eff - 0.25) < 0.08, 'eff gelernt: ' + lrn.eff);
  assert.equal(lrn.sf, 1);
  assert.equal(dev.kvsGet('err').code, null);
  assert.ok(dev.kvsGet('lrn').tMaxY >= 26 && dev.kvsGet('lrn').tMaxY <= 28, 'Tagesmaximum gestern: ' + dev.kvsGet('lrn').tMaxY);
  assert.ok(dev.kvsGet('lrn').rate > 0, 'Austrocknungsrate positiv: ' + dev.kvsGet('lrn').rate);
  // Erfahrungswert im Mock: 8–9 Schreibvorgänge an Tagen ohne Gabe, 13–16 an Tagen mit Gabe (statt 96 Takten);
  // der erste Tag enthält zusätzlich die drei Schreibvorgänge der Inbetriebnahme
  for (const w of writesPerDay.slice(1)) assert.ok(w <= 18, 'zu viele KVS-Schreibvorgänge an einem Tag: ' + w + ' (' + writesPerDay.join(',') + ')');
  const rest = writesPerDay.slice(1);
  assert.ok(rest.reduce((a, b) => a + b, 0) / rest.length < 14, 'Durchschnitt: ' + writesPerDay.join(','));
  assert.equal(dev.maxPendingRpc, 1);
  const pctEnd = Number(mains[mains.length - 1].result.log[0].match(/pct=([\d.]+)/)[1]);
  assert.ok(pctEnd > 30 && pctEnd < 70, 'Feuchte bleibt im Arbeitsbereich: ' + pctEnd);
});

test('Hitzetage: zwei Gaben am Tag möglich, Tageslimit hält', () => {
  const { dev } = runWeek({ pct: 42, dryPerH: 2.0, effTrue: 0.25, tBase: 32, tAmp: 6 });
  const ons = dev.switchLog.filter((e) => e.on);
  const perDay = {};
  for (const e of ons) { const d = new Date(e.t + dev.tzOffsetMin * 60000).toISOString().slice(0, 10); perDay[d] = (perDay[d] || 0) + 1; }
  const counts = Object.values(perDay);
  assert.ok(counts.some((c) => c === 2), 'an mindestens einem Tag zwei Gaben (12-h-Pause): ' + JSON.stringify(perDay));
  assert.ok(counts.every((c) => c <= 2), 'nie mehr als maxDay');
  assert.equal(dev.kvsGet('err').code, null);
});

test('Pumpe ohne Wirkung: genau eine Gabe, dann Störung noeff und nie wieder Wasser', () => {
  const { dev } = runWeek({ pct: 35, dryPerH: 0.7, effTrue: 0, tBase: 22, tAmp: 5 });
  const ons = dev.switchLog.filter((e) => e.on);
  assert.equal(ons.length, 1);
  assert.equal(dev.kvsGet('err').code, 'noeff');
  assert.equal(dev.kvsGet('lrn').eff, null);
});
