// tools/lib/kal.js v0.1.1 – Rechenkern des Kalibrierlaufs (hwtest.js kal): Aufzeichnung → Fenster → Bericht → Schreibvorschlag
//
// Kein Gerätecode: der Kalibrierlauf ist der Zeitraffer mit einem Fahrplan trocken → mittel feucht → nass; dieses Modul wertet die
// Aufzeichnung (docs/kal/<datum>-kal.json) aus. Alles rein rechnend, ohne Gerät testbar (tools/test/kal.test.js).
//
// Aufzeichnung (rec): { start: ISO, startUnix: s, band: {pctDry, pctLo, pctOk, pctSoll, pctHi}  – das NORMALE Band (zrb5), nicht das
//   Zeitraffer-Overlay –, cfg1, cfg3, cfg4, samples: [{t, pct, V, tC, lvl, sw}] alle ~5 s (t = Sekunden seit Start, sw = Ausgang EIN),
//   sts: [{t, st}] jede Änderung von st, jobs/lrns ebenso, lines: [{t, line}] Konsolenzeilen von bw_pump (Portionen mit tRise) }.
// Warum die Konsolenzeilen zählen: st.effW rechnet mit den Totzeiten des laufenden Profils (Zeitraffer tDead 2 / tDead2 0). Die Zeile
//   „P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, …)" nennt die echte Totzeit tRise je Portion; daraus entsteht der Lernwert auf der
//   Skala „% je Sekunde nach tRise" (Gerät 13.09.2026: 40,1 % in 22 − 8 − 5 = 9 wirksamen s → 4,46 %/s statt 2,0 im Profilmaß).
// Zustände (Nutzervorgabe 13.09.2026, auf das Band abgebildet): trocken = unter pctDry (nach einer Trockenphase), mittel = pctDry…pctLo
//   (Gabe fällig = „normal gießen"), band = pctLo…pctHi (keine Gabe), nass = über pctHi (im Echtbetrieb Start der Trockenphase –
//   im Kalibrierlauf nur aufgezeichnet). Gaben gibt es nur in trocken und mittel; nur dort entsteht ein Lernwert.
'use strict';

const REGULAR = ['ok', 'over', 'max', 'zeit', 'stall', 'unstab'];   // Fensterergebnisse mit gültigem Lernwert (wie bw_pump)

function r1(x) { return Math.round(x * 10) / 10; }
function r2(x) { return Math.round(x * 100) / 100; }
function median(a) { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; }
function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }
function isNum(x) { return typeof x === 'number' && !Number.isNaN(x); }

// Zustand eines Messwerts im normalen Band
function classify(pct, band) {
  if (!isNum(pct) || !band || !isNum(band.pctLo) || !isNum(band.pctHi)) return null;
  if (pct > band.pctHi) return 'nass';
  if (pct >= band.pctLo) return 'band';
  if (isNum(band.pctDry) && pct < band.pctDry) return 'trocken';
  return 'mittel';
}

// Gießfenster aus den Proben: Ausgang-EIN-Läufe, die weniger als gapSec auseinanderliegen, bilden ein Fenster (Portionen).
// Je Fenster: Startzeit, Portionen (Zahl der EIN-Läufe, grob – Proben alle 5 s), m0 (Median der letzten drei Proben davor),
// tRise (erste Probe ≥ m0 + 1 % nach dem Start), Spitze bis 60 s nach der letzten Portion, Ruhewert (Median der letzten drei Proben
// vor dem nächsten Fenster, spätestens 180 s nach der letzten Portion – danach steckt der Tester den Sensor um), dazu der passende
// st-Eintrag von bw_pump (n, sec, pctB, pctW, effW, tr, why).
function windows(rec, gapSec) {
  gapSec = gapSec || 120;
  const S = rec.samples || [];
  const runs = [];
  let cur = null;
  for (const s of S) {
    if (s.sw) { if (cur) cur.tEnd = s.t; else { cur = { tOn: s.t, tEnd: s.t }; runs.push(cur); } }
    else cur = null;
  }
  const wins = [];
  for (const r of runs) {
    const w = wins[wins.length - 1];
    if (w && r.tOn - w.tEnd < gapSec) { w.tEnd = r.tEnd; w.runs++; } else wins.push({ tOn: r.tOn, tEnd: r.tEnd, runs: 1 });
  }
  const startUnix = rec.startUnix || (rec.start ? Math.floor(Date.parse(rec.start) / 1000) : 0);
  const sts = (rec.sts || []).map((x) => x.st).filter((st) => st && isNum(st.ts));
  wins.forEach((w, i) => {
    const before = S.filter((s) => s.t < w.tOn && !s.sw && isNum(s.pct)).slice(-3).map((s) => s.pct);
    w.m0 = before.length ? median(before) : null;
    const limit = Math.min(i + 1 < wins.length ? wins[i + 1].tOn : Infinity, w.tEnd + 180);
    const after = S.filter((s) => s.t > w.tOn && s.t < limit && isNum(s.pct));
    w.peak = after.length ? Math.max(...after.map((s) => s.pct)) : null;
    const rise = w.m0 === null ? null : after.find((s) => s.pct >= w.m0 + 1);
    w.tRise = rise ? rise.t - w.tOn : null;
    const tail = after.filter((s) => !s.sw).slice(-3).map((s) => s.pct);
    w.settle = tail.length ? median(tail) : null;
    w.cls = classify(w.m0, rec.band);
    // st-Eintrag von bw_pump zu diesem Fenster: ts nahe dem Fensterstart, kein Claim (why laeuft), jüngster Stand (pctA kommt später dazu)
    const near = sts.filter((st) => Math.abs(st.ts - (startUnix + w.tOn)) <= 120 && st.why !== 'laeuft');
    w.st = near.length ? near[near.length - 1] : null;
  });
  attachBlocks(wins, parseLines(rec.lines));
  return wins;
}

// Referenzwert „nass": Proben über pctHi außerhalb der Fenster (Sensor im nassen Substrat/Wasserglas) – Mittelwert und Zahl
function wetReference(rec, wins) {
  const S = (rec.samples || []).filter((s) => isNum(s.pct) && !s.sw && classify(s.pct, rec.band) === 'nass'
    && !wins.some((w) => s.t >= w.tOn - 5 && s.t <= w.tEnd + 180));
  return S.length ? { pct: r1(mean(S.map((s) => s.pct))), V: r2(mean(S.filter((s) => isNum(s.V)).map((s) => s.V))), n: S.length } : null;
}

// Vorschläge: lrn.effW = Mittel der Fensterlernwerte (nur reguläre Ergebnisse), cfg4.tDead2 = Median von st.tr (Totzeit der zweiten
// Portion), tDead = kleinste tRise der Erstportionen, je Zustand der eigene Gewinn (nur Bericht, Entscheidung 13)
function proposals(rec, wins) {
  const whyOf = (w) => (w.st ? w.st.why : (w.block && w.block.result ? w.block.result.why : null));
  const good = wins.filter((w) => REGULAR.includes(whyOf(w)) && ((w.real && w.real.effReal > 0) || (w.st && isNum(w.st.effW) && w.st.effW > 0)));
  const real = good.every((w) => w.real && w.real.effReal > 0);   // alle Fenster mit Portionszeilen → Skala „nach tRise"
  const effOf = (w) => (real ? w.real.effReal : (w.st && isNum(w.st.effW) ? w.st.effW : w.real.effReal));
  const byCls = {};
  for (const w of good) { (byCls[w.cls || '?'] = byCls[w.cls || '?'] || []).push(effOf(w)); }
  const tr = real ? good.reduce((a, w) => a.concat(w.real.tr2), []) : good.map((w) => w.st.tr).filter(isNum);
  const tRise = real ? good.map((w) => w.real.tRise1).filter(isNum) : wins.map((w) => w.tRise).filter(isNum);
  const cls = {};
  for (const k of Object.keys(byCls)) cls[k] = { effW: r2(mean(byCls[k])), n: byCls[k].length };
  const effD = cls.trocken ? cls.trocken.effW : null, effN = cls.mittel ? cls.mittel.effW : null;
  const diff = effD !== null && effN !== null ? Math.round(Math.abs(effD - effN) / Math.max(effD, effN) * 100) : null;
  return {
    effW: good.length ? r2(mean(good.map(effOf))) : null,
    real: real && good.length > 0,
    nWin: good.length,
    tDead2: tr.length ? Math.round(median(tr)) : null,
    tDead: tRise.length ? Math.round(real ? median(tRise) : Math.min(...tRise)) : null,
    cls: cls,
    clsDiff: diff,
    wet: wetReference(rec, wins),
  };
}

// Konsolenzeilen von bw_pump in Fensterblöcke zerlegen: "Fenster: Auftrag …" öffnet, "P<i> <sec>s: a→b (d, g x, tRise r, stabil|unstabil s)"
// je Portion, "ergebnis=…" schließt. Zeilen als {t, line} (Rekorder) oder String (Import aus einem Logfile, dann Zuordnung in Reihenfolge).
const RE_P = /P(\d+) (\d+)s: ([\d.]+)→([\d.]+) \(([-\d.]+), g ([-\d.]+), tRise (\d+|-), (stabil|unstabil) (\d+)s\)/;
const RE_E = /ergebnis=(\S+) n=(\d+) sec=(\d+) dur=(\d+) pct=([\d.]+)→([\d.]+) effW=(\S+)/;
function parseLines(lines) {
  const blocks = [];
  let cur = null;
  for (const raw of lines || []) {
    const line = typeof raw === 'string' ? raw : raw.line, t = typeof raw === 'string' ? null : raw.t;
    if (typeof line !== 'string' || line.indexOf('[bw_pump') < 0) continue;
    if (line.indexOf('] Fenster:') >= 0) { cur = { t: t, portions: [], result: null }; blocks.push(cur); continue; }
    const p = RE_P.exec(line);
    if (p) {
      if (!cur || cur.result) { cur = { t: t, portions: [], result: null }; blocks.push(cur); }
      if (cur.t === null) cur.t = t;
      cur.portions.push({ i: Number(p[1]), sec: Number(p[2]), from: Number(p[3]), to: Number(p[4]), d: Number(p[5]), g: Number(p[6]), tRise: p[7] === '-' ? null : Number(p[7]), stable: p[8] === 'stabil', tStab: Number(p[9]) });
      continue;
    }
    const e = RE_E.exec(line);
    if (e && cur) cur.result = { why: e[1], n: Number(e[2]), sec: Number(e[3]), dur: Number(e[4]), pctB: Number(e[5]), pctW: Number(e[6]), effW: e[7] === 'null' ? null : Number(e[7]) };
  }
  return blocks.filter((b) => b.portions.length || b.result);
}

// Echte Wirkung eines Fensters aus den Portionszeilen: Σ Gewinn / Σ (sec − tRise); null ohne Zeilen oder ohne tRise
function realGain(portions) {
  const ok = (portions || []).filter((p) => isNum(p.tRise) && p.sec > p.tRise);
  if (!ok.length) return null;
  const d = ok.reduce((s, p) => s + p.d, 0), e = ok.reduce((s, p) => s + (p.sec - p.tRise), 0);
  return e > 0 ? { effReal: r2(d / e), dpct: r1(d), effSec: e, tRise1: ok[0].i === 1 ? ok[0].tRise : null, tr2: ok.filter((p) => p.i > 1).map((p) => p.tRise) } : null;
}

// Blöcke den Fenstern zuordnen: mit Zeitstempel nach Nähe (≤ 150 s), sonst in Reihenfolge (nur wenn die Zahl übereinstimmt)
function attachBlocks(wins, blocks) {
  if (!blocks.length) return;
  const timed = blocks.every((b) => isNum(b.t));
  if (timed) { for (const w of wins) { const b = blocks.find((x) => Math.abs(x.t - w.tOn) <= 150); if (b) w.block = b; } }
  else if (blocks.length === wins.length) wins.forEach((w, i) => { w.block = blocks[i]; });
  for (const w of wins) if (w.block) w.real = realGain(w.block.portions);
}

function fmt(x, d) { return isNum(x) ? x.toFixed(d === undefined ? 1 : d) : '-'; }

// Bericht als Zeilen (hwtest.js druckt sie)
function report(rec) {
  const wins = windows(rec);
  const p = proposals(rec, wins);
  const b = rec.band || {};
  const out = [];
  out.push('Kalibrierlauf ' + (rec.start || '?') + ' – ' + (rec.samples || []).length + ' Proben, ' + wins.length + ' Fenster; Zustände: trocken < pctDry ' + b.pctDry + ', mittel ' + b.pctDry + '–' + b.pctLo + ' (Gabe fällig), band ' + b.pctLo + '–' + b.pctHi + ' (keine Gabe), nass > pctHi ' + b.pctHi + ' (Ziel pctOk ' + b.pctOk + ', pctSoll ' + b.pctSoll + ')');
  out.push('Fenster  Start   Zustand       m0     n  Σs   tRise  Spitze  Ruhe   pctW   effW   why' + (wins.some((w) => w.real) ? '   | Portionen (Konsole): sec/Δ%/tRise → effW nach tRise' : ''));
  wins.forEach((w, i) => {
    const st = w.st || {};
    out.push(String(i + 1).padStart(6) + '  ' + fmtT(w.tOn) + '  ' + (w.cls || '?').padEnd(12) + fmt(w.m0).padStart(6) + '  ' + String(st.n === undefined ? w.runs + '~' : st.n).padStart(2) + '  ' + String(st.sec === undefined ? '-' : st.sec).padStart(3) + '  ' + fmt(w.tRise, 0).padStart(5) + '  ' + fmt(w.peak).padStart(6) + '  ' + fmt(w.settle).padStart(5) + '  ' + fmt(st.pctW).padStart(5) + '  ' + fmt(st.effW, 2).padStart(5) + '   ' + (st.why || (w.block && w.block.result ? w.block.result.why : '-')) + (isNum(st.pctA) ? ' (Kontrolle ' + st.pctA + ')' : '')
      + (w.real ? '   | ' + w.block.portions.map((p) => 'P' + p.i + ' ' + p.sec + 's/+' + p.d + '/' + (p.tRise === null ? '-' : p.tRise + 's')).join(' ') + ' → ' + w.real.effReal + ' %/s' : ''));
  });
  if (!wins.length) out.push('  (keine Gabe aufgezeichnet – lief bw_pump? Schlauch am Sensor? Auftrag vorhanden?)');
  for (const k of ['trocken', 'mittel', 'band', 'nass']) {
    if (p.cls[k]) out.push('Zustand ' + k + ': Gewinn effW ' + p.cls[k].effW + ' %/wirksame s aus ' + p.cls[k].n + ' Fenster' + (p.cls[k].n > 1 ? 'n' : '') + (k === 'band' || k === 'nass' ? ' (Gabe von Hand oder ohne Vorprüfung – Fenster oberhalb pctLo sind ungewöhnlich)' : ''));
  }
  if (p.wet) out.push('Zustand nass (Referenz ohne Gabe): ' + p.wet.pct + ' % (' + p.wet.V + ' V) aus ' + p.wet.n + ' Proben – im Echtbetrieb startet hier die Trockenphase, Gießen erst wieder unter pctDry ' + b.pctDry + ' %');
  else out.push('Zustand nass: nicht aufgezeichnet (Sensor zum Schluss ins nasse Substrat oder Wasserglas)');
  if (p.clsDiff !== null) out.push('Unterschied trocken/mittel: ' + p.clsDiff + ' %' + (p.clsDiff > 50 ? ' – über 50 %: Klassenlernen (effD/effN) wäre eine eigene Etappe (docs/PLAN.md Entscheidung 13)' : ' – ein Lernwert effW reicht (Entscheidung 13)'));
  out.push('Vorschlag: lrn.effW ' + (p.effW === null ? '- (kein reguläres Fenster)' : p.effW + ' (Mittel aus ' + p.nWin + ' Fenster' + (p.nWin > 1 ? 'n' : '') + (p.real ? ', Skala % je Sekunde nach tRise aus den Konsolenzeilen' : ', PROFILSKALA aus st.effW – ohne Konsolenzeilen nicht auf den Normalbetrieb übertragbar') + ')')
    + ' · cfg4.tDead2 ' + (p.tDead2 === null ? '- (keine zweite Portion)' : p.tDead2 + ' s (Median tRise der Folgeportionen)') + ' · cfg3.tDead ' + (p.tDead === null ? '-' : p.tDead + ' s (tRise der Erstportion' + (p.real ? '' : ', Raster 5 s') + '; gilt für DIESEN Schlauch – im Endaufbau per mess nachmessen)'));
  out.push('Schreiben (nur im Normalbetrieb, mischt effW mit dem vorhandenen Wert α 0,5): node tools/hwtest.js <ip> kal write [datei]');
  return out;
}

function fmtT(sec) { const m = Math.floor(sec / 60), s = sec % 60; return String(m).padStart(2) + ':' + (s < 10 ? '0' : '') + s; }

// Schreibplan: neue lrn/cfg4 aus Aufzeichnung + aktuellem Gerätestand (Lesen-Ändern-Schreiben durch den Aufrufer)
function writePlan(rec, lrn, cfg4, cfg3, alpha) {
  alpha = alpha === undefined ? 0.5 : alpha;
  const p = proposals(rec, windows(rec));
  const notes = [];
  const outLrn = Object.assign({}, lrn || {}), outCfg4 = Object.assign({}, cfg4 || {});
  let changed = false;
  if (p.effW !== null) {
    const old = lrn && isNum(lrn.effW) ? lrn.effW : null;
    outLrn.effW = old === null ? p.effW : Math.round(((1 - alpha) * old + alpha * p.effW) * 1000) / 1000;
    notes.push('lrn.effW ' + (old === null ? 'null' : old) + ' → ' + outLrn.effW + (old === null ? ' (Messwert)' : ' (Mischung α ' + alpha + ' aus ' + old + ' und ' + p.effW + ')'));
    changed = changed || outLrn.effW !== old;
  } else notes.push('lrn.effW unverändert – kein reguläres Fenster in der Aufzeichnung');
  if (p.tDead2 !== null) {
    const old = cfg4 && isNum(cfg4.tDead2) ? cfg4.tDead2 : null;
    outCfg4.tDead2 = p.tDead2;
    notes.push('cfg4.tDead2 ' + (old === null ? 'null' : old) + ' → ' + p.tDead2 + ' s');
    changed = changed || old !== p.tDead2;
  } else notes.push('cfg4.tDead2 unverändert – keine zweite Portion aufgezeichnet');
  const outCfg3 = Object.assign({}, cfg3 || {});
  if (p.real && p.tDead !== null && cfg3) {
    const old = isNum(cfg3.tDead) ? cfg3.tDead : null;
    outCfg3.tDead = p.tDead;
    notes.push('cfg3.tDead ' + (old === null ? 'null' : old) + ' → ' + p.tDead + ' s (tRise der Erstportion; Endaufbau mit anderem Schlauch: mess)');
    changed = changed || old !== p.tDead;
    // kleinste Erstportion folgt der Totzeit: tDead + 2 wirksame s, nie unter tPmin (Nutzervorgabe: Portionen ≥ 10 s) – sonst gießt
    // die Klemme tMin bei kurzem Schlauch weit über das Ziel (13.09.2026: tMin 25 bei tDead 8 wären 17 wirksame s ≈ +75 %)
    const tPmin = cfg4 && isNum(cfg4.tPmin) ? cfg4.tPmin : 10;
    const tMin = Math.max(tPmin, p.tDead + 2), oldMin = isNum(cfg3.tMin) ? cfg3.tMin : null;
    if (oldMin !== tMin) { outCfg3.tMin = tMin; notes.push('cfg3.tMin ' + (oldMin === null ? 'null' : oldMin) + ' → ' + tMin + ' s (max(tPmin, tDead + 2))'); changed = true; }
  } else if (cfg3) notes.push('cfg3.tDead unverändert – ' + (p.real ? 'keine Erstportion mit tRise' : 'keine Konsolenzeilen (Profilskala)'));
  if (!p.real && p.effW !== null) notes.push('ACHTUNG: effW im Profilmaß (Zeitraffer tDead 2) – lieber mit Logdatei auswerten: kal write <json> <log>');
  return { lrn: outLrn, cfg4: outCfg4, cfg3: outCfg3, notes: notes, changed: changed, proposals: p };
}

module.exports = { classify, windows, wetReference, proposals, report, writePlan, parseLines, realGain, REGULAR };
