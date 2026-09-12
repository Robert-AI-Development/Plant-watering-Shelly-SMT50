// bw_install.js v0.1.1 – Installer: KVS-Startwerte, Zeitplan, Script- und Switch-Konfiguration (einmalig von Hand starten)
//
// Ablauf als Schrittkette, immer nur ein offener RPC-Aufruf (Gerätegrenze: 5):
//   1 KVS lesen            2 fehlende Einträge anlegen     3 Script-IDs per Name (Script.List)
//   4 Zeitplan lesen       5 eigene Einträge löschen        6 Einträge anlegen (Takt, Fenster, Sicherheits-Aus)
//   7 Script-Konfiguration 8 Switch-Konfiguration           9 Zusammenfassung, Script.Stop auf sich selbst
// Vorhandene KVS-Einträge werden nie überschrieben (außer sie sind kein JSON-Objekt). Der Installer ist beliebig oft wiederholbar:
// eigene Zeitplan-Einträge erkennt er an Script.Start auf bw_main/bw_pump oder Switch.Set auf den Pumpenausgang.
// Alle Callbacks sind benannte Funktionen (Doku: verschachtelte anonyme Funktionen lassen das Gerät abstürzen).
// mJS hoistet nicht: die Schrittliste steps steht deshalb ganz unten, nach allen Funktionsdeklarationen.

var VER = "0.1.1";
var DEBUG = 0;                 // 1 = Debug-Zeilen in der Konsole: Schritte, RPC-Aufrufe, KVS-Inhalt, Messwerte
var NAME_MAIN = "bw_main";
var NAME_PUMP = "bw_pump";
var TICK = "0 */15 * * * *";   // Arbeitstakt bw_main: Sekunde Minute Stunde Tag Monat Wochentag
var SAFE_MIN = 5;              // Sicherheits-Aus so viele Minuten nach jedem Gießfenster (docs/PLAN.md Etappe 1)
var CRETRY_MAX = 3;            // Schedule.Create scheitert am Gerät sporadisch mit "timespec validation" (LEARNING.md); so oft erneut versuchen
var CRETRY_MS = 400;           // Pause vor dem erneuten Versuch (gibt der Firmware Zeit). Installer-intern, kein Verhaltensparameter
var cRetry = 0;

// Startwerte laut Katalog docs/umsetzungsplan-v2.md, ergänzt um die Entscheidungen in docs/PLAN.md.
// null = noch offen, wird nach den zwei Messungen an der Pflanze von Hand eingetragen.
var DEF = {
  cfg1: { vDry: 0.20, vWet: 3.13, vErrLo: 0.10, vErrHi: 3.35, nSample: 5, msSample: 500, lvlEmpty: 1, nLvl: 3, idV: 100, idT: 100, idLvl: 1, idSw: 0 },
  cfg2: { pctSoll: null, pctLo: null, pctHi: null, pctDry: null, hyst: 2, dropSlow: null, effMin: 0.05, effMax: 2.0, alpha: 0.3, sfMin: 0.5, sfStep: 0.1 },
  cfg3: { tDead: 20, tMin: 40, tStd: 70, tMax: 120, tHot: 35, pauseHot: 12, pause: 24, pauseSlow: 48, soak: 30, jobAge: 20, maxDay: 2, tChk: 5, winA: "08:00", winB: "20:00" },
  lrn: { eff: null, sf: 1, rate: null, tMean: null, tMaxD: null, tMaxY: null },
  st: { state: "beob", ts: null, sec: null, pctB: null, pctA: null, rated: false, dryOk: false },
  job: { ok: false, sec: null, pct: null, why: "init", ts: null },
  day: { date: null, n: 0, sec: 0 },
  err: { code: null, ts: null, mem: null }
};
var ORDER = ["cfg1", "cfg2", "cfg3", "lrn", "st", "job", "day", "err"];

var K = {};          // gelesene KVS-Einträge
var newKeys = [];    // in diesem Lauf neu angelegte Einträge
var wq = [];         // Schreib-Warteschlange (Schlüssel)
var wi = 0;
var ids = { self: 0, main: null, pump: null };
var delq = [];       // zu löschende Zeitplan-IDs
var di = 0;
var crq = [];        // anzulegende Zeitplan-Einträge {timespec, calls}
var ci = 0;
var created = [];    // angelegte Einträge {id, timespec}
var scq = [];        // Script-IDs für SetConfig
var sci = 0;
var si = 0;

// ---- Hilfen ------------------------------------------------------------
function log(s) { print("[bw_install " + VER + "] " + s); }
function dbg(s) { if (DEBUG) print("[bw_install dbg] " + s); }
function rpc(m, p, cb, ud) { dbg("rpc " + m + " " + JSON.stringify(p)); Shelly.call(m, p, cb, ud); }
function stop() { rpc("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function fail(msg) { log("ABBRUCH: " + msg); stop(); }
function failErr(msg) {
  // Abbruch mit Störung "cfg" im KVS, damit der Grund auch ohne Konsole sichtbar ist
  log("ABBRUCH: " + msg);
  var sys = Shelly.getComponentStatus("sys");
  var e = { code: "cfg", ts: sys ? sys.unixtime : null, mem: sys ? sys.ram_free : null };
  rpc("KVS.Set", { key: "err", value: JSON.stringify(e) }, onFailWritten);
}
function onFailWritten() { stop(); }
function next() {
  // Flache Schleife statt verschachtelter Aufrufe: mJS verträgt nur etwa 10 Stack-Ebenen (LEARNING.md).
  // Ein Schritt gibt true zurück, wenn er sofort fertig ist; sonst wartet er auf seinen Callback, der next() ruft.
  while (si < steps.length) {
    var f = steps[si];
    si = si + 1;
    dbg("schritt " + si + "/" + steps.length);
    var more = false;
    try { more = f(); } catch (e) { fail("Ausnahme in Schritt " + si + ": " + (e && e.message ? e.message : e)); return; }
    if (more !== true) return;
  }
  stop();
}
function isNum(x) { return typeof x === "number" && x === x; }
// KVS-Werte sind JSON-Strings (Entscheidung 15: die Web-UI zeigt Objektwerte nur als [object Object]);
// unlesbare Werte gelten als fehlend (null)
function fromKvs(v) {
  if (typeof v !== "string") return v;
  var o = null;
  try { o = JSON.parse(v); } catch (e) { o = null; }
  return o === undefined ? null : o;
}
function hhmm(s) {
  // "08:00" → {h, m}; null bei falschem Format
  if (typeof s !== "string" || s.length !== 5 || s.charCodeAt(2) !== 58) return null;
  var h = (s.charCodeAt(0) - 48) * 10 + (s.charCodeAt(1) - 48);
  var m = (s.charCodeAt(3) - 48) * 10 + (s.charCodeAt(4) - 48);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h: h, m: m };
}
function addMin(t, plus) {
  var m = t.m + plus;
  var h = t.h;
  while (m >= 60) { m = m - 60; h = h + 1; }
  return { h: h % 24, m: m };
}
function specs(a, b) {
  // Zeitplan-Timespecs für zwei Uhrzeiten: gleiche Minute → ein Eintrag "0 M hA,hB * * *", sonst zwei
  if (a.m === b.m) {
    var h1 = a.h < b.h ? a.h : b.h;
    var h2 = a.h < b.h ? b.h : a.h;
    return ["0 " + a.m + " " + (h1 === h2 ? h1 : h1 + "," + h2) + " * * *"];
  }
  return ["0 " + a.m + " " + a.h + " * * *", "0 " + b.m + " " + b.h + " * * *"];
}

// ---- Schritt 1: KVS lesen (paginiert) -------------------------------------
function stepRead() { kvsPage(0); }
function kvsPage(off) { rpc("KVS.GetMany", { match: "*", offset: off }, onKvsPage, off); }
function onKvsPage(res, ec, em, off) {
  if (ec !== 0) { fail("KVS.GetMany: " + em); return; }
  var items = res && res.items ? res.items : {};
  var n = 0;
  if (typeof items.length === "number") {
    // ältere Firmware: Array von {key, etag, value}
    for (var i = 0; i < items.length; i++) { K[items[i].key] = fromKvs(items[i].value); n = n + 1; }
  } else {
    var ks = Object.keys(items);
    for (var j = 0; j < ks.length; j++) { K[ks[j]] = fromKvs(items[ks[j]].value); n = n + 1; }
  }
  var total = res && isNum(res.total) ? res.total : 0;
  if (n > 0 && off + n < total) { kvsPage(off + n); return; }
  if (DEBUG) { var dk = Object.keys(K); for (var d = 0; d < dk.length; d++) dbg("kvs " + dk[d] + " " + typeof K[dk[d]] + " " + JSON.stringify(K[dk[d]])); }
  next();
}

// ---- Schritt 2: fehlende Einträge anlegen ----------------------------------
function stepDefaults() {
  for (var i = 0; i < ORDER.length; i++) {
    var k = ORDER[i];
    if (K[k] === undefined || K[k] === null) { K[k] = DEF[k]; wq.push(k); newKeys.push(k); }
    else if (typeof K[k] !== "object") { log("KVS " + k + " ist kein JSON-Objekt, wird neu angelegt"); K[k] = DEF[k]; wq.push(k); newKeys.push(k); }
  }
  // Felder, die der Installer selbst braucht, müssen gültig sein (auch bei vorhandenen Einträgen)
  if (!isNum(K.cfg1.idSw)) { failErr("cfg1.idSw fehlt oder ist keine Zahl"); return; }
  if (!isNum(K.cfg3.tMax)) { failErr("cfg3.tMax fehlt oder ist keine Zahl"); return; }
  if (!hhmm(K.cfg3.winA) || !hhmm(K.cfg3.winB)) { failErr("cfg3.winA/winB ungültig, Format HH:MM"); return; }
  wi = 0;
  dbg("schreibe " + (wq.length ? wq.join(",") : "nichts"));
  return writeNext();
}
function writeNext() {
  if (wi >= wq.length) return true;   // Warteschlange leer → nächster Schritt
  var k = wq[wi];
  wi = wi + 1;
  rpc("KVS.Set", { key: k, value: JSON.stringify(K[k]) }, onWrite, k);
}
function onWrite(res, ec, em, k) {
  if (ec !== 0) log("KVS.Set " + k + " fehlgeschlagen: " + em);
  if (writeNext()) next();
}

// ---- Schritt 3: Script-IDs per Name ----------------------------------------
function findScriptId(list, name) {
  for (var i = 0; i < list.length; i++) { if (list[i].name === name) return list[i].id; }
  return null;
}
function stepScripts() {
  ids.self = Shelly.getCurrentScriptId();
  rpc("Script.List", {}, onScriptList);
}
function onScriptList(res, ec, em) {
  if (ec !== 0) { fail("Script.List: " + em); return; }
  var list = res && res.scripts ? res.scripts : [];
  ids.main = findScriptId(list, NAME_MAIN);
  ids.pump = findScriptId(list, NAME_PUMP);
  if (ids.main === null || ids.pump === null) {
    failErr("Script '" + (ids.main === null ? NAME_MAIN : NAME_PUMP) + "' nicht gefunden – Scripts mit genau diesem Namen anlegen");
    return;
  }
  log("Script-IDs: install=" + ids.self + " main=" + ids.main + " pump=" + ids.pump);
  next();
}

// ---- Schritt 4/5: eigene Zeitplan-Einträge finden und löschen ---------------
function isOwn(job) {
  var calls = job.calls || [];
  for (var i = 0; i < calls.length; i++) {
    var c = calls[i];
    var p = c.params || {};
    if (c.method === "Script.Start" && (p.id === ids.main || p.id === ids.pump)) return true;
    if (c.method === "Switch.Set" && p.id === K.cfg1.idSw) return true;
  }
  return false;
}
function stepSchedList() { rpc("Schedule.List", {}, onSchedList); }
function onSchedList(res, ec, em) {
  if (ec !== 0) { fail("Schedule.List: " + em); return; }
  var jobs = res && res.jobs ? res.jobs : [];
  delq = [];
  for (var i = 0; i < jobs.length; i++) { if (isOwn(jobs[i])) delq.push(jobs[i].id); }
  log("Zeitplan: " + jobs.length + " Einträge vorhanden, davon eigene: " + delq.length);
  next();
}
function stepSchedDelete() { di = 0; return delNext(); }
function delNext() {
  if (di >= delq.length) return true;
  var id = delq[di];
  di = di + 1;
  rpc("Schedule.Delete", { id: id }, onDel, id);
}
function onDel(res, ec, em, id) {
  if (ec !== 0) log("Schedule.Delete " + id + ": " + em);
  if (delNext()) next();
}

// ---- Schritt 6: Zeitplan-Einträge anlegen ----------------------------------
function stepSchedCreate() {
  var a = hhmm(K.cfg3.winA);
  var b = hhmm(K.cfg3.winB);
  crq = [{ timespec: TICK, calls: [{ method: "Script.Start", params: { id: ids.main } }] }];
  var sp = specs(a, b);
  for (var i = 0; i < sp.length; i++) crq.push({ timespec: sp[i], calls: [{ method: "Script.Start", params: { id: ids.pump } }] });
  var ss = specs(addMin(a, SAFE_MIN), addMin(b, SAFE_MIN));
  for (var j = 0; j < ss.length; j++) crq.push({ timespec: ss[j], calls: [{ method: "Switch.Set", params: { id: K.cfg1.idSw, on: false } }] });
  ci = 0;
  return createNext();
}
function createNext() {
  if (ci >= crq.length) return true;
  cRetry = 0;
  sendCreate();
  return false;
}
function sendCreate() {
  var e = crq[ci];
  dbg("create ci=" + ci + " versuch=" + cRetry + " ts=[" + e.timespec + "]");
  rpc("Schedule.Create", { enable: true, timespec: e.timespec, calls: e.calls }, onCreate, e.timespec);
}
function onCreate(res, ec, em, ts) {
  // Das Gerät weist den ersten Create eines Laufs sporadisch mit "timespec validation" ab; ein Retry gelingt (LEARNING.md)
  if (ec !== 0 && cRetry < CRETRY_MAX) {
    cRetry = cRetry + 1;
    log("Schedule.Create '" + ts + "' Versuch " + cRetry + "/" + CRETRY_MAX + " nach Fehler: " + em);
    Timer.set(CRETRY_MS, false, sendCreate);
    return;
  }
  if (ec !== 0) log("Schedule.Create '" + ts + "': " + em);
  else created.push({ id: res.id, timespec: ts });
  ci = ci + 1;
  if (createNext()) next();
}

// ---- Schritt 7: Script-Konfiguration (kein Autostart, der Zeitplan startet) ---
function stepScriptCfg() { scq = [ids.main, ids.pump]; sci = 0; return scNext(); }
function scNext() {
  if (sci >= scq.length) return true;
  var id = scq[sci];
  sci = sci + 1;
  rpc("Script.SetConfig", { id: id, config: { enable: false } }, onScriptCfg, id);
}
function onScriptCfg(res, ec, em, id) {
  if (ec !== 0) log("Script.SetConfig " + id + ": " + em);
  if (scNext()) next();
}

// ---- Schritt 8: Switch-Konfiguration (Entscheidung 12) ----------------------
function stepSwitchCfg() {
  var cfg = { initial_state: "off", auto_off: true, auto_off_delay: K.cfg3.tMax + 10 };
  rpc("Switch.SetConfig", { id: K.cfg1.idSw, config: cfg }, onSwitchCfg);
}
function onSwitchCfg(res, ec, em) {
  if (ec !== 0) log("Switch.SetConfig: " + em);
  else log("Switch " + K.cfg1.idSw + ": initial_state=off, auto_off nach " + (K.cfg3.tMax + 10) + " s");
  next();
}

// ---- Schritt 9: Zusammenfassung --------------------------------------------
function stepDone() {
  log("KVS neu angelegt: " + (newKeys.length ? newKeys.join(", ") : "keine (alle vorhanden)"));
  for (var i = 0; i < created.length; i++) log("Zeitplan #" + created[i].id + ": " + created[i].timespec);
  log("fertig – bw_main läuft alle 15 min, bw_pump um " + K.cfg3.winA + " und " + K.cfg3.winB + ", Sicherheits-Aus " + SAFE_MIN + " min danach");
  return true;
}

// Schrittliste erst hier: mJS hoistet Funktionen nicht, die Namen gibt es erst nach ihrer Deklaration.
var steps = [stepRead, stepDefaults, stepScripts, stepSchedList, stepSchedDelete, stepSchedCreate, stepScriptCfg, stepSwitchCfg, stepDone];
dbg("start");
next();
