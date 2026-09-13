// tools/test/kal.test.js – Rechenkern des Kalibrierlaufs: Fenster aus Proben, Zustände, Bericht, Schreibplan (ohne Gerät)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const kal = require('../lib/kal.js');

const BAND = { pctDry: 28, pctLo: 40, pctOk: 50, pctSoll: 55, pctHi: 60 };

// synthetische Aufzeichnung: Proben alle 5 s; Fenster 1 bei 390 s (trocken 20 %, zwei Portionen), Fenster 2 bei 1110 s (mittel 34 %,
// eine Portion), danach Sensor im Wasserglas (nass 95 %)
function recording() {
  const samples = [];
  const st = [];
  const startUnix = 1789200000;
  const win = [
    { tOn: 390, portions: [[390, 402], [432, 447]], m0: 20, gain: [12, 15], effW: 1.1, tr: 3, why: 'ok', sec: 27, n: 2 },
    { tOn: 1110, portions: [[1110, 1125]], m0: 34, gain: [16], effW: 1.3, tr: null, why: 'ok', sec: 15, n: 1 },
  ];
  function pctAt(t) {   // je Abschnitt (Sensor umgesteckt bei 700 s und 1400 s) Grundwert plus die Gaben dieses Abschnitts, Rampe 10 s ab 4 s
    if (t >= 1400) return 95;
    const seg = t < 700 ? win[0] : win[1];
    let p = seg.m0;
    seg.portions.forEach((po, i) => { if (t >= po[0] + 4) p += seg.gain[i] * Math.min(1, (t - po[0] - 4) / 10); });
    return p;
  }
  for (let t = 0; t <= 1600; t += 5) {
    const sw = win.some((w) => w.portions.some((po) => t >= po[0] && t < po[1]));
    samples.push({ t: t, pct: pctAt(t), V: 0.3 + pctAt(t) / 100 * 2.8, tC: 22, lvl: false, sw: sw });
  }
  for (const w of win) {
    st.push({ t: w.tOn, st: { state: 'sperre', ts: startUnix + w.tOn, dur: 0, n: 0, sec: 0, pctB: w.m0, pctW: null, pctA: null, effW: null, why: 'laeuft', tr: null, rated: true, dryOk: true } });
    const pctW = w.m0 + w.gain.reduce((a, b) => a + b, 0);
    st.push({ t: w.tOn + 80, st: { state: 'gegossen', ts: startUnix + w.tOn, dur: 70, n: w.n, sec: w.sec, pctB: w.m0, pctW: pctW, pctA: null, effW: w.effW, why: w.why, tr: w.tr, rated: false, dryOk: true } });
    st.push({ t: w.tOn + 260, st: { state: 'sperre', ts: startUnix + w.tOn, dur: 70, n: w.n, sec: w.sec, pctB: w.m0, pctW: pctW, pctA: pctW - 2, effW: w.effW, why: w.why, tr: w.tr, rated: true, dryOk: true } });
  }
  return { start: new Date(startUnix * 1000).toISOString(), startUnix: startUnix, band: BAND, cfg1: {}, cfg3: {}, cfg4: { tDead2: 0 }, samples: samples, sts: st, jobs: [], lrns: [] };
}

test('classify: trocken unter pctDry, mittel bis pctLo (Gabe fällig), band bis pctHi, nass darüber', () => {
  assert.equal(kal.classify(20, BAND), 'trocken');
  assert.equal(kal.classify(27.9, BAND), 'trocken');
  assert.equal(kal.classify(28, BAND), 'mittel');
  assert.equal(kal.classify(39.9, BAND), 'mittel');
  assert.equal(kal.classify(40, BAND), 'band');
  assert.equal(kal.classify(60, BAND), 'band');
  assert.equal(kal.classify(60.1, BAND), 'nass');
  assert.equal(kal.classify(null, BAND), null);
  assert.equal(kal.classify(50, {}), null);
});

test('windows: Portionen mit weniger als 120 s Abstand bilden ein Fenster; m0, tRise, Spitze, Ruhewert, st-Zuordnung', () => {
  const rec = recording();
  const w = kal.windows(rec);
  assert.equal(w.length, 2);
  assert.equal(w[0].tOn, 390); assert.equal(w[0].runs, 2); assert.equal(w[0].m0, 20); assert.equal(w[0].cls, 'trocken');
  assert.equal(w[0].tRise, 5, 'erste Probe über m0 + 1 % nach 5 s (Raster)');
  assert.equal(w[0].peak, 47); assert.equal(w[0].settle, 47);
  assert.equal(w[0].st.why, 'ok'); assert.equal(w[0].st.n, 2); assert.equal(w[0].st.pctA, 45, 'jüngster Stand mit Kontrolle');
  assert.equal(w[1].cls, 'mittel'); assert.equal(w[1].st.tr, null);
});

test('proposals: effW-Mittel, tDead2 aus st.tr, Zustände mit Unterschied, Nass-Referenz ohne Fenster', () => {
  const p = kal.proposals(recording(), kal.windows(recording()));
  assert.equal(p.effW, 1.2); assert.equal(p.nWin, 2);
  assert.equal(p.tDead2, 3);
  assert.equal(p.tDead, 5);
  assert.deepEqual(p.cls.trocken, { effW: 1.1, n: 1 });
  assert.deepEqual(p.cls.mittel, { effW: 1.3, n: 1 });
  assert.equal(p.clsDiff, 15);
  assert.equal(p.wet.pct, 95); assert.ok(p.wet.n > 30);
});

test('report: Tabelle je Fenster, Zustände, Vorschläge, Schreibhinweis', () => {
  const lines = kal.report(recording());
  const text = lines.join('\n');
  assert.match(text, /2 Fenster/);
  assert.match(text, /trocken\s+20\.0\s+2\s+27/);
  assert.match(text, /mittel\s+34\.0\s+1\s+15/);
  assert.match(text, /Zustand nass \(Referenz ohne Gabe\): 95 %/);
  assert.match(text, /Unterschied trocken\/mittel: 15 % – ein Lernwert effW reicht/);
  assert.match(text, /Vorschlag: lrn\.effW 1\.2 \(Mittel aus 2 Fenstern, PROFILSKALA/);
  assert.match(text, /cfg4\.tDead2 3 s \(Median tRise der Folgeportionen\)/);
  assert.match(text, /kal write/);
});

const LINES = [
  '[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s',
  '[bw_pump 0.2.0] m0 10.4 % → P1 12 s',
  '[bw_pump 0.2.0] P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)',
  '[bw_pump 0.2.0] P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)',
  '[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199',
];

test('parseLines: Gerätezeilen vom 13.09.2026 → Block mit zwei Portionen und Ergebnis; realGain rechnet nach tRise', () => {
  const b = kal.parseLines(LINES);
  assert.equal(b.length, 1);
  assert.equal(b[0].portions.length, 2);
  assert.deepEqual(b[0].portions[0], { i: 1, sec: 12, from: 10.4, to: 34, d: 23.6, g: 2.357, tRise: 8, stable: true, tStab: 12 });
  assert.equal(b[0].portions[1].stable, false);
  assert.equal(b[0].result.why, 'unstab'); assert.equal(b[0].result.effW, 2.006);
  const r = kal.realGain(b[0].portions);
  assert.equal(r.effSec, 9, '(12 − 8) + (10 − 5)'); assert.equal(r.dpct, 40.1); assert.equal(r.effReal, 4.46); assert.equal(r.tRise1, 8); assert.deepEqual(r.tr2, [5]);
  assert.equal(kal.realGain([{ i: 1, sec: 5, d: 1, tRise: null }]), null);
});

test('Konsolenzeilen mit Zeitstempel werden dem Fenster zugeordnet: Vorschlag auf der Skala nach tRise, tDead/tDead2 aus tRise', () => {
  const rec = recording();
  rec.lines = LINES.map((line, i) => ({ t: 392 + i * 15, line: line }));   // Fenster 1 bei 390 s
  const w = kal.windows(rec);
  assert.ok(w[0].block && w[0].real, 'Block am Fenster 1'); assert.equal(w[1].block, undefined);
  const p = kal.proposals(rec, w);
  assert.equal(p.real, false, 'Fenster 2 ohne Zeilen → gemischt, Profilskala');
  rec.lines.push({ t: 1112, line: '[bw_pump 0.2.0] P1 15s: 34→50 (16, g 1.3, tRise 6, stabil 10s)' }, { t: 1150, line: '[bw_pump 0.2.0] ergebnis=ok n=1 sec=15 dur=20 pct=34→50 effW=1.3 sf=0.7 day.n=2 err=null w=4 dauer=50000' });
  const w2 = kal.windows(rec), p2 = kal.proposals(rec, w2);
  assert.equal(p2.real, true);
  assert.equal(p2.effW, 3.12, '(4.46 + 16/9) / 2'); assert.equal(p2.tDead, 8, "oberer Median der tRise-Erstportionen (8, 6)"); assert.equal(p2.tDead2, 5);
  const text = kal.report(rec).join('\n');
  assert.match(text, /P1 12s\/\+23\.6\/8s P2 10s\/\+16\.5\/5s → 4\.46 %\/s/);
  assert.match(text, /Skala % je Sekunde nach tRise/);
  const plan = kal.writePlan(rec, { effW: null }, { tDead2: 8, tPmin: 10 }, { tDead: 20, tMin: 25 });
  assert.equal(plan.lrn.effW, 3.12); assert.equal(plan.cfg4.tDead2, 5); assert.equal(plan.cfg3.tDead, 8);
  assert.match(plan.notes.join(" "), /cfg3\.tDead 20 → 8 s/);
  assert.equal(plan.cfg3.tMin, 10, 'max(tPmin 10, tDead 8 + 2)');
  assert.match(plan.notes.join(' '), /cfg3\.tMin 25 → 10 s/);
  const plan2 = kal.writePlan(rec, { effW: null }, { tDead2: 8, tPmin: 10 }, { tDead: 8, tMin: 10 });
  assert.equal(plan2.cfg3.tMin, 10); assert.ok(!/cfg3\.tMin/.test(plan2.notes.join(' ')), 'unverändert → keine Notiz');
  const plan3 = kal.writePlan(rec, { effW: null }, { tDead2: 8, tPmin: 10 }, { tDead: 20, tMin: 25 });
  rec.lines.forEach((l) => { l.line = l.line.replace('tRise 8', 'tRise 11').replace('tRise 6', 'tRise 11'); });   // Totzeit 11 s (< Portionslänge)
  const plan4 = kal.writePlan(rec, { effW: null }, { tDead2: 8, tPmin: 10 }, { tDead: 20, tMin: 25 });
  assert.equal(plan4.cfg3.tDead, 11); assert.equal(plan4.cfg3.tMin, 13, 'tDead 11 + 2 > tPmin');
  assert.equal(plan3.cfg3.tMin, 10);
});

test('Import ohne Zeitstempel: Blöcke in Reihenfolge nur bei gleicher Zahl; Profilskala wird im Schreibplan gewarnt', () => {
  const rec = recording();
  rec.lines = LINES.slice();   // ein Block, zwei Fenster → keine Zuordnung
  assert.ok(kal.windows(rec).every((w) => !w.block));
  const plan = kal.writePlan(rec, { effW: null }, { tDead2: 0 }, { tDead: 20 });
  assert.equal(plan.lrn.effW, 1.2); assert.equal(plan.cfg3.tDead, 20);
  assert.match(plan.notes.join(' '), /ACHTUNG: effW im Profilmaß/);
  rec.lines = LINES.concat(['[bw_pump 0.2.0] P1 15s: 34→50 (16, g 1.3, tRise 6, stabil 10s)', '[bw_pump 0.2.0] ergebnis=ok n=1 sec=15 dur=20 pct=34→50 effW=1.3 sf=0.7 day.n=2 err=null w=4 dauer=50000']);
  const w = kal.windows(rec);
  assert.equal(w[0].real.effReal, 4.46); assert.equal(w[1].real.effReal, 1.78);
});

test('report ohne Gaben: Hinweis statt Tabelle, keine Ausnahme', () => {
  const rec = recording(); rec.samples = rec.samples.map((s) => Object.assign({}, s, { sw: false })); rec.sts = [];
  const text = kal.report(rec).join('\n');
  assert.match(text, /keine Gabe aufgezeichnet/);
  assert.match(text, /lrn\.effW - \(kein reguläres Fenster\)/);
});

test('writePlan: Messwert ohne Vorwert, Mischung α 0,5 mit Vorwert, tDead2; noeff-Fenster zählen nicht', () => {
  const rec = recording();
  const a = kal.writePlan(rec, { effW: null, sf: 0.7 }, { tDead2: 0, tWin: 120 });
  assert.equal(a.lrn.effW, 1.2); assert.equal(a.lrn.sf, 0.7); assert.equal(a.cfg4.tDead2, 3); assert.equal(a.cfg4.tWin, 120); assert.equal(a.changed, true);
  const b = kal.writePlan(rec, { effW: 2, sf: 0.7 }, { tDead2: 3 }, { tDead: 20 });
  assert.equal(b.lrn.effW, 1.6, '(2 + 1.2) / 2'); assert.equal(b.changed, true);
  assert.match(b.notes.join(' '), /Mischung α 0\.5/);
  rec.sts = rec.sts.map((x) => ({ t: x.t, st: Object.assign({}, x.st, { why: x.st.why === 'ok' ? 'noeff' : x.st.why }) }));
  const c = kal.writePlan(rec, { effW: 2 }, { tDead2: 3 });
  assert.equal(c.lrn.effW, 2); assert.equal(c.changed, false);
});
