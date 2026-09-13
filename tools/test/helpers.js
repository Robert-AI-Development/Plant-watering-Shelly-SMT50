// tools/test/helpers.js v0.1.3 – gemeinsame Helfer für die Tests (v0.1.2: Zeitraffer; v0.1.3: Topfmodell potModel, noBurst)
'use strict';
const path = require('node:path');
const { Device, runScript } = require('../mock/shelly-mock.js');

const SCRIPTS = path.join(__dirname, '..', '..', 'scripts');
const FILES = {
  bw_install: path.join(SCRIPTS, 'bw_install.js'),
  bw_main: path.join(SCRIPTS, 'bw_main.js'),
  bw_pump: path.join(SCRIPTS, 'bw_pump.js'),
  bw_hwtest: path.join(SCRIPTS, 'bw_hwtest.js'),
  bw_hwpump: path.join(SCRIPTS, 'bw_hwpump.js'),
  bw_zeitraffer: path.join(SCRIPTS, 'bw_zeitraffer.js'),
};

// Beispiel-Zielband für Tests (am Gerät kommen die Werte aus den zwei Pflanzenmessungen)
const BAND = { pctSoll: 55, pctLo: 40, pctOk: 50, pctHi: 60, pctDry: 28, dropSlow: 4 };

// Spannung für einen Feuchtewert nach der Kalibrierung 0,20 V = 0 %, 3,13 V = 100 %
function voltFor(pct, cfg1) {
  const c = cfg1 || { vDry: 0.2, vWet: 3.13 };
  return c.vDry + (pct / 100) * (c.vWet - c.vDry);
}

// Gerät mit Installer-Startwerten und Zielband; Sensoren auf "feucht genug"
function seeded(opts) {
  opts = opts || {};
  const dev = new Device(opts);
  const r = runScript(dev, FILES.bw_install);
  if (!r.stopped || r.errors.length) throw new Error('Installer im Mock fehlgeschlagen: ' + r.errors.join('\n'));
  if (!opts.noBand) {
    const cfg2 = dev.kvsGet('cfg2');
    Object.assign(cfg2, BAND);
    dev.kvsSetRaw('cfg2', cfg2);
  }
  dev.kvsWrites = 0;
  dev.voltage = voltFor(50);
  dev.tC = 22;
  dev.inputs[1] = false; // 0 = Wasser vorhanden
  return dev;
}

function patch(dev, key, fields) {
  const v = dev.kvsGet(key) || {};
  Object.assign(v, fields);
  dev.kvsSetRaw(key, v);
  return v;
}

function runMain(dev, opts) { return runScript(dev, FILES.bw_main, opts); }
function runPump(dev, opts) { return runScript(dev, FILES.bw_pump, opts); }
// Hardware-Test-Scripts: Langläufer, deshalb maxMs 60 min; bw_hwpump startet bw_pump per Script.Start (registrierte Datei)
function runHwtest(dev, opts) { return runScript(dev, FILES.bw_hwtest, Object.assign({ maxMs: 60 * 60 * 1000 }, opts || {})); }
function runHwpump(dev, opts) { return runScript(dev, FILES.bw_hwpump, Object.assign({ maxMs: 60 * 60 * 1000, files: { bw_pump: FILES.bw_pump } }, opts || {})); }
// Pumpentest komplett: Durchgang A (Freigabe, Auftrag, Script.Start), dann läuft bw_pump allein weiter (virtuelle Uhr),
// dann Durchgang B (Bewertung, Rückbau) – nur wenn A eine Sicherung hinterlassen hat
function pumpTest(dev, opts) {
  const a = runHwpump(dev, opts);
  let b = null;
  if (dev.kvsRaw('hwb1') !== undefined || dev.kvsRaw('hwb2') !== undefined) {
    dev.advance(90 * 1000);
    b = runHwpump(dev, opts);
  }
  return { a: a, b: b, log: a.log.concat(b ? b.log : []), errors: a.errors.concat(b ? b.errors : []), stopped: a.stopped && (b === null || b.stopped), writes: a.writes + (b ? b.writes : 0), maxCallDepth: Math.max(a.maxCallDepth, b ? b.maxCallDepth : 0) };
}

// Zeitraffer: bw_zeitraffer schreibt Sicherung und Profil und startet bw_install (registrierte Datei), der den Zeitplan baut.
// Liefert Log/Fehler beider Läufe; der Installer läuft nach dem Ende von bw_zeitraffer auf der virtuellen Uhr weiter.
function runZeitraffer(dev, opts) {
  const e0 = dev.errors.length, l0 = dev.log.length;
  const r = runScript(dev, FILES.bw_zeitraffer, Object.assign({ files: { bw_install: FILES.bw_install } }, opts || {}));
  dev.runUntil(dev.nowMs + 30000, () => !dev.script('bw_install').running && !dev.script('bw_zeitraffer').running);
  return { stopped: r.stopped && !dev.script('bw_install').running, log: dev.log.slice(l0), errors: dev.errors.slice(e0), maxCallDepth: r.maxCallDepth };
}

// Gerätezustand vom 12.09.2026: Installer gelaufen, cfg2-Zielband null (→ err=cfg nach einem bw_main-Takt), Sensor in Erde (0,42 V),
// 23,9 °C, Wasser vorhanden (input:1 = false). Uhrzeit 10:07 lokal: Taktlücke, kein Gießfenster.
function hwDevice(opts) {
  const dev = seeded(Object.assign({ noBand: true, nowMs: Date.UTC(2026, 8, 12, 8, 7, 0) }, opts || {}));
  dev.voltage = 0.42;
  dev.tC = 23.9;
  dev.inputs[1] = false;
  runMain(dev);
  dev.kvsWrites = 0;
  return dev;
}

// ---- Topfmodell ------------------------------------------------------------------------------------------------
// Deterministisches Rauschen als reine Funktion der Zeit (Hash aus seed und Millisekunde, zwei LCG-Schritte) → [−1, 1).
// Prüfungen mit pct(t) verändern so keine Zufallsfolge, und derselbe Zeitpunkt liefert immer denselben Wert.
function noiseAt(seed, tMs) {
  let x = (seed ^ Math.imul((tMs % 4294967296) | 0, 0x9E3779B1)) >>> 0;
  x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
  x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
  return (x / 4294967296 - 0.5) * 2;
}

// potModel(dev, opts): analytisches Topf-/Bodenmodell für den Regelkreis im Gießfenster. Es wird beim Lesen ausgewertet:
// dev.voltage wird zur Funktion von dev.nowMs, die Portionen kommen aus dev.onSwitch (Schalter 0; ein vorhandener Hook
// bleibt in der Kette). Intervalle [tOn, tOff] in ms; ein offenes Intervall (tOff null) reicht bis dev.nowMs.
//
// Feuchte in %:  pct(t) = clamp( pct0 − dryPerH·(t − t0)/1 h + Σ_i g_i(t)·d_i(t) + noise(t), 0, 100 )
//   e_i(u) = clamp( min(u, tOff_i) − tOn_i − dead_i, 0, ∞ )         gepumpte Wirksekunden bis u (Totzeit dead_i abgezogen)
//   g_i(t) = effLocal·f_i · (1/tRamp)·∫_{t−delay−tRamp}^{t−delay} e_i(u) du    gleitendes Mittel über tRamp s: das Wasser
//            braucht delay s bis zum Fühler und wird dort über tRamp s sichtbar. Der Wert steigt also schon während der
//            Portion (ab tOn_i + dead_i + delay), beim Abschalten ist noch nicht alles sichtbar, und genau tRamp s nach
//            tOff_i + delay ist der Endwert W_i = effLocal·f_i·max(0, dur_i − dead_i) erreicht. tRamp 0 → g_i(t) = effLocal·f_i·e_i(t − delay).
//   d_i(t) = (1 − drainFrac) + drainFrac·exp(−max(0, t − tOff_i)/tau)    Drain: der Anteil drainFrac sickert mit Zeitkonstante tau weg
//   dead_i = tDead für die erste Portion eines Fensters (Lücke zur vorigen Abschaltung > gapMin min oder erste überhaupt), sonst tDead2
//   f_i    = Faktor beim Einschalten (Pegel ohne Rauschen): ×0,5 wenn pct(tOn_i) < pHydro (hydrophob), ×(1 − pct(tOn_i)/100) bei sat
//   noise  = noiseAt(seed, t)·noise (Amplitude in %)
// Rückgabe: { opts, intervals, t0, lastOff, pct(t), level(t) (ohne Rauschen), portions() → [{tOn, tOff, dur, dead, first, f, pctOn, W}],
//            reset(patch) } – reset übernimmt den aktuellen Pegel als pct0 (oder patch.pct0), setzt t0 = jetzt, löscht Intervalle und
//            Fensterlücke; weitere Felder in patch überschreiben Optionen. Das 7-Tage-Szenario behält sein lineares Sofortmodell.
function potModel(dev, opts) {
  const o = Object.assign({ pct0: 50, dryPerH: 0, effLocal: 0.25, tDead: 20, tDead2: 10, tRamp: 15, delay: 0, drainFrac: 0, tau: 600, pHydro: null, sat: false, noise: 0, seed: 42, gapMin: 10, cfg1: null }, opts || {});
  const m = { opts: o, intervals: [], t0: dev.nowMs, lastOff: null };
  const offOf = (iv) => (iv.tOff === null ? dev.nowMs : iv.tOff);
  const clamp = (p) => Math.max(0, Math.min(100, p));
  // Stammfunktion von e_i in Sekunden: E(x) = ∫_{−∞}^{x} clamp(u − A, 0, D) du
  function E(x, A, D) { if (x <= A) return 0; if (x <= A + D) return (x - A) * (x - A) / 2; return D * D / 2 + D * (x - A - D); }
  function gain(iv, tMs) {
    const A = iv.tOn / 1000 + iv.dead, D = Math.max(0, (offOf(iv) - iv.tOn) / 1000 - iv.dead);
    const x1 = tMs / 1000 - o.delay;
    const e = o.tRamp > 0 ? (E(x1, A, D) - E(x1 - o.tRamp, A, D)) / o.tRamp : Math.min(D, Math.max(0, x1 - A));
    const dt = Math.max(0, (tMs - offOf(iv)) / 1000);
    const d = (1 - o.drainFrac) + o.drainFrac * (o.tau > 0 ? Math.exp(-dt / o.tau) : (dt > 0 ? 0 : 1));
    return o.effLocal * iv.f * e * d;
  }
  function level(tMs) {
    let p = o.pct0 - o.dryPerH * (tMs - m.t0) / 3600000;
    for (const iv of m.intervals) p += gain(iv, tMs);
    return p;
  }
  m.level = (t) => clamp(level(t === undefined ? dev.nowMs : t));
  m.pct = (t) => { if (t === undefined) t = dev.nowMs; return clamp(level(t) + (o.noise ? noiseAt(o.seed, t) * o.noise : 0)); };
  m.portions = () => m.intervals.map((iv) => {
    const dur = (offOf(iv) - iv.tOn) / 1000;
    return { tOn: iv.tOn, tOff: iv.tOff, dur: dur, dead: iv.dead, first: iv.first, f: iv.f, pctOn: iv.pctOn, W: o.effLocal * iv.f * Math.max(0, dur - iv.dead) };
  });
  m.reset = (patch) => {
    const p = patch || {};
    const cur = clamp(level(dev.nowMs));
    Object.assign(o, p);
    if (p.pct0 === undefined) o.pct0 = cur;
    m.t0 = dev.nowMs; m.intervals = []; m.lastOff = null;
    return m;
  };
  const prev = dev.onSwitch;
  dev.onSwitch = (d, id, on, t) => {
    if (prev) prev(d, id, on, t);
    if (id !== 0) return;
    const last = m.intervals[m.intervals.length - 1];
    if (on) {
      if (last && last.tOff === null) return;   // schon an: das Gerät verlängert nur den Timer
      const first = m.lastOff === null || t - m.lastOff > o.gapMin * 60000;
      const pctOn = clamp(level(t));
      let f = 1;
      if (o.pHydro !== null && pctOn < o.pHydro) f *= 0.5;
      if (o.sat) f *= 1 - pctOn / 100;
      m.intervals.push({ tOn: t, tOff: null, dead: first ? o.tDead : o.tDead2, first: first, f: f, pctOn: pctOn });
    } else if (last && last.tOff === null) {
      last.tOff = t;
      m.lastOff = t;
    }
  };
  dev.voltage = () => voltFor(m.pct(dev.nowMs), o.cfg1 || dev.kvsGet('cfg1'));
  return m;
}

// noBurst(dev, max): größte Zahl Konsolenzeilen mit demselben virtuellen Zeitstempel (Schwall). Die Geräte-Konsole verliert
// bei zu vielen synchronen print-Zeilen Text (Regel: nie mehr als ~15). Überschreitet der Schwall max (Standard 15), wirft
// die Funktion einen Fehler mit den ersten Zeilen; max null/Infinity misst nur. Rückgabe: die Zahl.
function noBurst(dev, max) {
  if (max === undefined) max = 15;
  const perT = new Map();
  let best = 0, bestT = null;
  for (const t of dev.logT) {
    const n = (perT.get(t) || 0) + 1;
    perT.set(t, n);
    if (n > best) { best = n; bestT = t; }
  }
  if (max !== null && best > max) {
    const lines = [];
    for (let i = 0; i < dev.logT.length && lines.length < 5; i++) if (dev.logT[i] === bestT) lines.push(dev.log[i]);
    throw new Error('Burst: ' + best + ' Konsolenzeilen zum selben Zeitpunkt (' + new Date(bestT).toISOString() + ', erlaubt ' + max + '): ' + lines.join(' | ') + (best > 5 ? ' …' : ''));
  }
  return best;
}

module.exports = { Device, runScript, FILES, BAND, voltFor, seeded, patch, runMain, runPump, runHwtest, runHwpump, pumpTest, runZeitraffer, hwDevice, potModel, noBurst };
