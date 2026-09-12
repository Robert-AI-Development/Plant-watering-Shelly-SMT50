// bw_hwpump.js v0.1.0 – Hardware-Test Pumpe in zwei Durchgängen: A Auftrag vorbereiten und bw_pump starten, B Ergebnis prüfen und Zustände zurückbauen
//
// Nur von Hand gestartet, nie im Zeitplan. Ein Timer (Tick je hwt.msTick), ein offener RPC (busy-Flag). Sensorphasen: bw_hwtest.js.
// Der Script-Heap des Geräts (~25 KB) ist von allen Scripts geteilt (LEARNING.md): während bw_pump läuft, darf kein zweites großes
// Script laufen. Deshalb zwei Durchgänge, erkennbar am KVS:
//   A (keine Sicherung hwb1/hwb2): p0 Freigabe (Kommando go + Zeitwache + Vorprüfungen) → KVS neu lesen → st/day/job/err/lrn nach
//     hwb1/hwb2 sichern → err={code:null}, day (bei Tageslimit) und job={ok:true,sec:pumpSec,…} schreiben → Script.Start bw_pump →
//     hwp {s:"pumpt"} schreiben → Ende. bw_pump pumpt allein (toggle_after, auto_off, Sicherheits-Aus des Zeitplans bleiben wirksam).
//   B (Sicherung vorhanden, bw_pump beendet): st/job mit dem Auftrag vergleichen (p1/p2/p3), Ausgang notfalls aus, Rückbau aus
//     hwb1/hwb2 (kein Testauftrag überlebt), hwb1/hwb2 löschen, Bericht. tools/hwtest.js watch startet B, sobald bw_pump fertig ist.
// Dieses Script schaltet die Pumpe nie EIN. Zeitwache in A: Lücke zum 15-min-Takt von bw_main, Abstand zu Gießfenstern und Mitternacht.
// Bericht und Stand in hwp; Kommandos über hwc {n, cmd}. Ergebniscodes: ok sk to ab fe (blockiert) aw (bw_pump-Ergebnis weicht ab)

var VER = "0.1.0";
var DEBUG = 0;                 // 1 = Debug-Zeilen: Schritte, RPC-Aufrufe
var NAME_PUMP = "bw_pump";
var REQ1 = ["lvlEmpty", "nLvl", "idLvl", "idSw"];
var REQ3 = ["tMax", "maxDay", "winA", "winB"];
// Startwerte für die hier genutzten hwt-Felder (Eintrag wird nur angelegt, wenn er fehlt; fehlende Felder gelten als Standard)
var DEF = { msTick: 1000, nCmd: 2, nLog: 5, tPhase: 900, tAll: 3600, pumpSec: 30, guardS: 90, winMin: 25 };

var K = {}, orig = {};
var c1 = null, c3 = null, h = null;
var now = 0, minDay = 0, ram = null, ramMin = null, run0 = 0, t0 = 0;
var pumpId = null, nOther = 0, pumpRun = false;
var busy = false, rcb = null, rud = null;
var th = null, mode = "idle";
var p = null, tmo = 0;
var res = { p0: "-", p1: "-", p2: "-", p3: "-" }, rec = 0;
var R = { sec: null, st: "-", why: "-" };
var cmd = { last: 0 };
var lrn0 = null, passB = false, bakFail = false, abort = false, noeff = false;
var rep = [], ri = 0;
var wq = [], wi = 0, dq = [], di = 0, nW = 0;
var si = 0;

// ---- Hilfen ------------------------------------------------------------
function log(s) { print("[bw_hwpump " + VER + "] " + s); }
function dbg(s) { if (DEBUG) print("[bw_hwpump dbg] " + s); }
// genau ein offener Shelly.call: Callback und Userdata liegen in Modulvariablen, busy sperrt den Tick
function rpc(m, prm, cb, ud) { dbg("rpc " + m + " " + JSON.stringify(prm)); busy = true; rcb = cb; rud = ud; Shelly.call(m, prm, onRpc); }
function onRpc(r, ec, em) { busy = false; var cb = rcb; rcb = null; cb(r, ec, em, rud); }
function stop() { rpc("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function fail(e) {
  // bei einer Ausnahme: laufende Pumpe aus, dann Ende (Rückbau beim nächsten Start = Durchgang B)
  log("ABBRUCH: " + (e && e.message ? e.message : e));
  if (th !== null) Timer.clear(th);
  th = null;
  if (c1 !== null && rdSw() === 1) rpc("Switch.Set", { id: c1.idSw, on: false }, onFailOff);
  else stop();
}
function onFailOff() { stop(); }
function next() {
  // Flache Schleife statt verschachtelter Aufrufe: mJS verträgt nur etwa 10 Stack-Ebenen (LEARNING.md).
  while (si < steps.length) {
    var f = steps[si];
    si = si + 1;
    dbg("schritt " + si + "/" + steps.length);
    var more = false;
    try { more = f(); } catch (e) { fail(e); return; }
    if (more !== true) return;
  }
  stop();
}
function jumpTo(f) { for (var i = 0; i < steps.length; i++) { if (steps[i] === f) { si = i; break; } } }
function isNum(x) { return typeof x === "number" && x === x; }
function obj(x) { return x !== null && typeof x === "object"; }
function fromKvs(v) {
  if (typeof v !== "string") return v;
  var o = null;
  try { o = JSON.parse(v); } catch (e) { o = null; }
  return o === undefined ? null : o;
}
function fmt(v) { return v === null ? "-" : v; }
function missing(o, req) {
  if (!obj(o)) return req[0];
  for (var i = 0; i < req.length; i++) { var v = o[req[i]]; if (v === undefined || v === null) return req[i]; }
  return null;
}
function hhmm(s) {
  // "HH:MM" → Minuten des Tages, sonst null
  if (typeof s !== "string" || s.length < 5) return null;
  var v = (s.charCodeAt(0) - 48) * 600 + (s.charCodeAt(1) - 48) * 60 + (s.charCodeAt(3) - 48) * 10 + (s.charCodeAt(4) - 48);
  return v >= 0 && v < 1440 && (s.charCodeAt(4) - 48) < 10 ? v : null;
}
function readClock() {
  var s = Shelly.getComponentStatus("sys");
  ram = s && isNum(s.ram_free) ? s.ram_free : null;
  if (ram !== null && (ramMin === null || ram < ramMin)) ramMin = ram;
  var md = s ? hhmm(s.time) : null;
  if (md === null || !isNum(s.unixtime)) return false;
  now = s.unixtime;
  minDay = md;
  return true;
}
function up() { return Shelly.getUptimeMs(); }
function rdL() { var s = Shelly.getComponentStatus("input", c1.idLvl); return s && typeof s.state === "boolean" ? (s.state ? 1 : 0) : null; }
function rdSw() { var s = Shelly.getComponentStatus("switch", c1.idSw); return s && typeof s.output === "boolean" ? (s.output ? 1 : 0) : null; }
// Zeitwache: "" = frei, sonst Grund. Lücke zum 15-min-Takt (bw_main schreibt err/job) und Abstand zu Gießfenstern/Mitternacht.
function safeWindow() {
  if (!readClock()) return "uhr";
  var q = (minDay % 15) * 60 + (now % 60);
  if (q < h.guardS || q > 900 - h.guardS - h.pumpSec) return "takt";
  var wins = [c3.winA, c3.winB, "00:00"];
  for (var i = 0; i < wins.length; i++) {
    var w = hhmm(wins[i]);
    if (w === null) continue;
    var d = minDay - w;
    if (d > 720) d = d - 1440;
    if (d < -720) d = d + 1440;
    if (d > -h.winMin && d < h.winMin) return "fenster";
  }
  return "";
}

// ---- Freigabe p0 (einzige Wartephase, Durchgang A) ----------------------------------------------
function newPhase() { return { n: 0, t0: up(), ring: [], ri: 0, go: false, pend: null, said: "" }; }
// Ringpuffer per Index (mJS kennt kein Array.shift, LEARNING.md): n gleiche jüngste Lesungen?
function ringSame(n) {
  if (p.ri < n) return false;
  for (var i = 1; i < n; i++) { if (p.ring[(p.ri - 1 - i) % n] !== p.ring[(p.ri - 1) % n]) return false; }
  return true;
}
function say(s) { if (p.said !== s) { p.said = s; log(s); } }
// null = weiter warten, sonst Ergebniscode
function chkP0(v) {
  if (pumpId === null) { log("bw_pump fehlt"); return "fe"; }
  if (nOther > 1) { log("zu viele laufende Scripts: " + nOther); return "fe"; }
  if (noeff) { log("noeff steht"); return "fe"; }
  if (!p.go) return null;
  var why = safeWindow();
  if (why !== "") { say("warte: " + why); return null; }
  if (v !== 0) { say("Ausgang EIN – ausschalten"); return null; }
  var l = rdL();
  if (l === null) { say("Wasserstand unlesbar"); return null; }
  p.ring[p.ri % c1.nLvl] = l;
  p.ri = p.ri + 1;
  if (!ringSame(c1.nLvl)) return null;
  if (l === c1.lvlEmpty) { say("Wasserstand LEER – füllen"); return null; }
  return "ok";
}
function onTick() {
  try {
    if (mode === "rep") { tickRep(); return; }
    if (mode !== "ph" || p.pend !== null) return;
    p.n = p.n + 1;
    var el = Math.floor((up() - p.t0) / 1000);
    var v = rdSw();
    if (up() - t0 > h.tAll * 1000) { log("Gesamtzeit überschritten"); endPhase("ab"); return; }
    if (el > h.tPhase) { endPhase("to"); return; }
    var r = chkP0(v);
    if (r !== null) { endPhase(r); return; }
    if (p.n % h.nLog === 0) log("p0 sw=" + fmt(v) + " lvl=" + fmt(rdL()) + " t=" + el + "s" + (p.go ? "" : " (warte auf go)"));
    if (!busy && p.n % h.nCmd === 0) rpc("KVS.Get", { key: "hwc" }, onCmd);
  } catch (e) { fail(e); }
}
function onCmd(r, ec, em) {
  if (ec === 0 && r) {
    var c = fromKvs(r.value);
    if (obj(c) && isNum(c.n) && c.n > cmd.last) {
      cmd.last = c.n;
      log("cmd " + c.cmd + " n=" + c.n);
      if (mode === "ph" && p.pend === null) {
        if (c.cmd === "abort") endPhase("ab");
        else if (c.cmd === "skip") endPhase("sk");
        else if (c.cmd === "go") p.go = true;
      }
    }
  }
  if (mode === "ph" && p.pend !== null) endPhase(p.pend);
}
function endPhase(r) {
  if (busy) { p.pend = r; return; }
  mode = "idle";
  res.p0 = r;
  log("Phase p0: " + r + " nach " + Math.floor((up() - p.t0) / 1000) + " s");
  if (r === "ab") abort = true;
  if (r !== "ok") { res.p1 = "sk"; res.p2 = "sk"; }
  writeHwp("lauf", onPhaseDone);
}
function onPhaseDone(r, ec, em) {
  if (ec !== 0) log("KVS.Set hwp: " + em);
  if (res.p0 !== "ok") jumpTo(stepReport);
  next();
}
function hwpObj(s) {
  return { run: run0, s: s, dur: Math.floor((up() - t0) / 1000), mem: ramMin, pumpSec: h.pumpSec, sec: R.sec, st: R.st, why: R.why, r: res.p0 + "," + res.p1 + "," + res.p2 + "," + res.p3, rec: rec, w: nW };
}
function writeHwp(s, cb) { K.hwp = hwpObj(s); nW = nW + 1; rpc("KVS.Set", { key: "hwp", value: JSON.stringify(K.hwp) }, cb); }
function tickRep() {
  if (ri < rep.length) { print(rep[ri]); ri = ri + 1; return; }
  mode = "idle";
  next();
}

// ---- Schritt 1: KVS lesen (paginiert, items als Array wie am Gerät gemessen) -------------
function stepRead() { t0 = up(); K = {}; kvsPage(0); }
function kvsPage(off) { rpc("KVS.GetMany", { match: "*", offset: off }, onKvsPage, off); }
function onKvsPage(r, ec, em, off) {
  if (ec !== 0) { fail("KVS.GetMany: " + em); return; }
  var items = r && r.items ? r.items : [];
  for (var i = 0; i < items.length; i++) K[items[i].key] = fromKvs(items[i].value);
  var total = r && isNum(r.total) ? r.total : 0;
  if (items.length > 0 && off + items.length < total) { kvsPage(off + items.length); return; }
  orig = {};
  var keys = Object.keys(K);
  for (var q = 0; q < keys.length; q++) orig[keys[q]] = JSON.stringify(K[keys[q]]);
  next();
}
function changed(keys) {
  var out = [];
  for (var i = 0; i < keys.length; i++) { if (K[keys[i]] !== undefined && JSON.stringify(K[keys[i]]) !== orig[keys[i]]) out.push(keys[i]); }
  return out;
}

// ---- Schritt 2: Konfiguration, Durchgang erkennen -------------------------------------------------
function stepCfg() {
  c1 = K.cfg1; c3 = K.cfg3;
  var miss = missing(c1, REQ1);
  if (miss !== null) throw new Error("cfg1." + miss + " fehlt");
  miss = missing(c3, REQ3);
  if (miss !== null) throw new Error("cfg3." + miss + " fehlt");
  if (!readClock()) throw new Error("Uhrzeit nicht gesetzt");
  h = {};
  var hk = Object.keys(DEF);
  var src = obj(K.hwt) ? K.hwt : null;
  for (var i = 0; i < hk.length; i++) { var kk = hk[i]; h[kk] = src !== null && src[kk] !== undefined && src[kk] !== null ? src[kk] : DEF[kk]; }
  if (h.pumpSec > c3.tMax) h.pumpSec = c3.tMax;
  wq = []; wi = 0;
  if (src === null) { K.hwt = h; wq.push("hwt"); }
  cmd.last = obj(K.hwc) && isNum(K.hwc.n) ? K.hwc.n : 0;
  lrn0 = obj(K.lrn) ? K.lrn : null;
  noeff = obj(K.err) && K.err.code === "noeff";
  passB = obj(K.hwb1) || obj(K.hwb2);
  run0 = now;
  if (passB) {
    // Durchgang B: Startzeit und Pumpdauer aus dem Stand von A; rec = 1, wenn A nicht regulär endete (Absturz, Stop von außen)
    rec = obj(K.hwp) && K.hwp.s === "pumpt" ? 0 : 1;
    if (obj(K.hwp)) { if (isNum(K.hwp.run)) run0 = K.hwp.run; if (isNum(K.hwp.pumpSec)) h.pumpSec = K.hwp.pumpSec; }
  }
  log("Start Durchgang " + (passB ? "B (Ergebnis + Rückbau)" : "A (Freigabe + Start)") + " pumpSec=" + h.pumpSec + " sw=" + fmt(rdSw()) + " lvl=" + fmt(rdL()) + " err=" + (obj(K.err) ? K.err.code : "-"));
  return writeNext();
}

// ---- Schritt 3: Script-IDs; Durchgang B springt zur Bewertung ------------------------------------
function stepScripts() { rpc("Script.List", {}, onScriptList); }
function onScriptList(r, ec, em) {
  var list = r && r.scripts ? r.scripts : [];
  var self = Shelly.getCurrentScriptId();
  pumpId = null; nOther = 0; pumpRun = false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].name === NAME_PUMP) { pumpId = list[i].id; pumpRun = list[i].running === true; }
    if (list[i].running === true && list[i].id !== self) nOther = nOther + 1;
  }
  log("bw_pump id=" + fmt(pumpId) + (pumpRun ? " läuft" : "") + " andere=" + nOther);
  th = Timer.set(h.msTick, true, onTick);
  if (passB) jumpTo(stepEval);
  next();
}

// ---- Durchgang A: Freigabe, KVS neu lesen, sichern, Auftrag schreiben, bw_pump starten ------------------
function stepPhase() {
  K = {}; orig = {};   // Speicher freigeben: bw_main darf im Takt weiterlaufen (Heap geteilt, LEARNING.md)
  p = newPhase();
  mode = "ph";
  log("Phase p0: Behälter voll, Schlauch im Eimer, dann go (" + h.pumpSec + " s über bw_pump, Timeout " + h.tPhase + " s)");
}
function stepPrepRead() { K = {}; kvsPage(0); }
function stepPrepWrite() {
  K.hwb1 = { st: K.st, day: K.day };
  K.hwb2 = { job: K.job, err: K.err, lrn: lrn0 !== null ? lrn0 : K.lrn };
  wq = ["hwb1", "hwb2"]; wi = 0; bakFail = false;
  return writeNext();
}
function stepPrepJob() {
  if (bakFail) { log("Sicherung fehlgeschlagen"); res.p1 = "fe"; res.p2 = "sk"; jumpTo(stepReport); return true; }
  readClock();
  if (obj(K.err) && K.err.code !== null) K.err = { code: null, ts: now, mem: ram };
  if (obj(K.day) && K.day.n >= c3.maxDay) K.day = { date: null, n: 0, sec: 0 };   // bw_pump setzt das Datum selbst
  K.job = { ok: true, sec: h.pumpSec, pct: null, why: "hwtest", ts: now };          // pct null: keine Bewertung, kein Lernwert
  run0 = now;
  wq = changed(["err", "day", "job"]); wi = 0;
  return writeNext();
}
function stepPumpStart() {
  K = {}; orig = {};   // Speicher für bw_pump freigeben
  rpc("Script.Start", { id: pumpId }, onPumpStart);
}
function onPumpStart(r, ec, em) {
  if (ec !== 0 || (r && r.was_running === true)) { log("Script.Start: " + (ec !== 0 ? em : "lief bereits")); res.p1 = "fe"; res.p2 = "sk"; }
  else log("bw_pump gestartet – Durchgang B nach dessen Ende (tools/hwtest.js watch)");
  writeHwp("pumpt", onPumptWritten);
}
function onPumptWritten(r, ec, em) { if (ec !== 0) log("KVS.Set hwp: " + em); jumpTo(stepDone); next(); }

// ---- Durchgang B: Ergebnis bewerten, Rückbau, Bericht ------------------------------------------------
function stepEval() {
  if (pumpRun) { log("bw_pump läuft noch – später erneut starten"); jumpTo(stepDone); return true; }
  var s = obj(K.st) ? K.st : {};
  var j = obj(K.job) ? K.job : {};
  R.st = typeof s.state === "string" ? s.state : "-";
  R.why = typeof j.why === "string" ? j.why : "-";
  R.sec = isNum(s.sec) ? s.sec : null;
  var lief = isNum(s.ts) && s.ts >= run0;                       // bw_pump hat eine Gabe eingetragen
  var an = rdSw() === 1;                                        // Ausgang nach dem Ende von bw_pump noch EIN?
  res.p0 = "ok";
  res.p1 = lief ? "ok" : "fe";
  res.p2 = lief ? (an ? "aw" : "ok") : "sk";
  res.p3 = lief && !an && s.state === "gegossen" && s.sec === h.pumpSec && j.ok === false && j.why === "ok" ? "ok" : "aw";
  log("bw_pump: st=" + R.st + " sec=" + fmt(R.sec) + " why=" + R.why + " err=" + (obj(K.err) ? K.err.code : "-") + " → " + res.p3);
  if (an) { rpc("Switch.Set", { id: c1.idSw, on: false }, onOffCont); return; }
  return true;
}
function onOffCont(r, ec, em) { log("Sicherheits-Aus" + (ec !== 0 ? " fehlgeschlagen: " + em : "")); next(); }
// Rückbau: st/day/job/err/lrn aus hwb1/hwb2 zurück, kein Testauftrag überlebt, Sicherung löschen
function stepRestore() {
  var b1 = obj(K.hwb1) ? K.hwb1 : null;
  var b2 = obj(K.hwb2) ? K.hwb2 : null;
  dq = []; di = 0;
  if (b1 !== null) { if (b1.st) K.st = b1.st; if (b1.day) K.day = b1.day; dq.push("hwb1"); }
  if (b2 !== null) { if (b2.job) K.job = b2.job; if (b2.err) K.err = b2.err; if (b2.lrn) K.lrn = b2.lrn; dq.push("hwb2"); }
  if (obj(K.job) && K.job.ok === true) K.job.ok = false;
  K.hwp = hwpObj("ende");
  wq = changed(["st", "day", "job", "err", "lrn", "hwp"]); wi = 0;
  nW = nW + wq.length;
  K.hwp.w = nW;
  log("Rückbau schreibt " + wq.join(",") + (dq.length ? " löscht " + dq.join(",") : ""));
  if (writeNext() === true) return delNext();
}
function writeNext() {
  if (wi >= wq.length) return true;
  var k = wq[wi];
  wi = wi + 1;
  rpc("KVS.Set", { key: k, value: JSON.stringify(K[k]) }, onWrite, k);
}
function onWrite(r, ec, em, k) {
  if (ec !== 0) { log("KVS.Set " + k + " fehlgeschlagen: " + em); if (k === "hwb1" || k === "hwb2") bakFail = true; }
  if (writeNext() === true) { if (delNext() === true) next(); }
}
function delNext() {
  if (di >= dq.length) return true;
  var k = dq[di];
  di = di + 1;
  rpc("KVS.Delete", { key: k }, onDel, k);
}
function onDel(r, ec, em, k) {
  if (ec !== 0) log("KVS.Delete " + k + ": " + em);
  if (delNext() === true) next();
}

// ---- Bericht (eine Zeile je Tick: Print-Bursts gehen im Debug-Websocket verloren) ------------
function stepReport() {
  if (!passB && res.p0 === "ok" && res.p1 !== "fe") return true;   // Durchgang A ohne Fehler: Bericht kommt in B
  rep = [];
  rep.push("Bericht 1/2 p0 " + res.p0 + " | p1 " + res.p1 + " | p2 " + res.p2 + " | st=" + R.st + " sec=" + fmt(R.sec) + " why=" + R.why + " | p3 " + res.p3);
  rep.push("Bericht 2/2 " + (abort ? "ABBRUCH" : "Ende") + (passB ? " mit Rückbau" : " ohne Pumpenlauf") + " rec=" + rec + " dauer=" + Math.floor((up() - t0) / 1000) + " s w=" + nW + " ram_min=" + ramMin);
  ri = 0;
  if (!passB) { writeHwp(abort ? "abbruch" : "ende", onRepWritten); return; }   // A ohne Pumpenlauf: Stand schreiben, dann drucken
  mode = "rep";
}
function onRepWritten(r, ec, em) { if (ec !== 0) log("KVS.Set hwp: " + em); mode = "rep"; }
function stepDone() {
  if (th !== null) Timer.clear(th);
  th = null;
  log("fertig r=" + res.p0 + "," + res.p1 + "," + res.p2 + "," + res.p3 + " dauer=" + (up() - t0) + "ms");
  return true;
}

// Schrittliste erst hier: mJS hoistet Funktionen nicht, die Namen gibt es erst nach ihrer Deklaration.
var steps = [stepRead, stepCfg, stepScripts, stepPhase, stepPrepRead, stepPrepWrite, stepPrepJob, stepPumpStart, stepEval, stepRestore, stepReport, stepDone];
dbg("start");
next();
