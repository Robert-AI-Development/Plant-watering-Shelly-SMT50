// bw_pump.js v0.1.1 – Gießfenster (08:00/20:00): Auftrag prüfen, Pumpe schalten, Wasserstand überwachen, Ergebnis schreiben
//
// Einmal-Läufer: startet über den Zeitplan, lebt höchstens tMax + wenige Sekunden, beendet sich per Script.Stop.
// Schritte: 1 KVS lesen  2 Pflichtfelder/Uhr  3 Auftrag prüfen (ok, Alter, Störung, Tageslimit)  4 Wasserstand (Timer)
//           5 Switch.Set mit toggle_after, Überwachung alle tChk s  6 KVS neu lesen  7 Ergebnis in st/day/job
//           8 schreiben (nur Änderungen)  9 Konsole, Script.Stop
// Sicherheit: toggle_after im Einschaltbefehl, auto_off in der Switch-Konfiguration (Installer), Sicherheits-Aus im Zeitplan.
// Lesen-Ändern-Schreiben am Ende, weil bw_main um dieselbe Zeit läuft. Alle Callbacks benannt, ein offener RPC, ein Timer.

var VER = "0.1.1";
var DEBUG = 0;                 // 1 = Debug-Zeilen in der Konsole: Schritte, RPC-Aufrufe, KVS-Inhalt, Messwerte
var REQ1 = ["msSample", "lvlEmpty", "nLvl", "idLvl", "idSw"];
var REQ3 = ["tDead", "tMax", "jobAge", "maxDay", "tChk"];
var BLOCK = { noeff: 6, cfg: 5, uhr: 4, sensor: 3, wasser: 2 };

var K = {};
var orig = {};
var c1 = null, c3 = null;
var now = 0, today = "", ram = null;
var job = null;
var lvl = { s: [], h: null };
var run = { sec: 0, start: null, ticks: 0, elapsed: 0, h: null, result: "-", actual: 0, wasOn: false };
var out = { why: "-" };
var wq = [], wi = 0;
var t0 = 0;
var si = 0;

// ---- Hilfen ------------------------------------------------------------
function log(s) { print("[bw_pump " + VER + "] " + s); }
function dbg(s) { if (DEBUG) print("[bw_pump dbg] " + s); }
function rpc(m, p, cb, ud) { dbg("rpc " + m + " " + JSON.stringify(p)); Shelly.call(m, p, cb, ud); }
function stop() { rpc("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function fail(e) { log("ABBRUCH: " + (e && e.message ? e.message : e)); pumpOffSafe(); }
function pumpOffSafe() {
  // bei einer Ausnahme: Pumpe aus, dann Ende (Callback benannt, keine weitere Logik)
  if (c1 && typeof c1.idSw === "number") rpc("Switch.Set", { id: c1.idSw, on: false }, onFailOff);
  else stop();
}
function onFailOff() { stop(); }
function next() {
  // Flache Schleife statt verschachtelter Aufrufe: mJS verträgt nur etwa 10 Stack-Ebenen (LEARNING.md).
  // Ein Schritt gibt true zurück, wenn er sofort fertig ist; sonst wartet er auf seinen Callback, der next() ruft.
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
// Sprungziel setzen; der aufrufende Schritt gibt danach true zurück, damit next() dort weitermacht
function jumpTo(f) { for (var i = 0; i < steps.length; i++) { if (steps[i] === f) { si = i; break; } } }
function finish(why) { out.why = why; jumpTo(stepWrite); return true; }
function isNum(x) { return typeof x === "number" && x === x; }
// KVS-Werte sind JSON-Strings (Entscheidung 15: die Web-UI zeigt Objektwerte nur als [object Object]);
// unlesbare Werte gelten als fehlend (null)
function fromKvs(v) {
  if (typeof v !== "string") return v;
  var o = null;
  try { o = JSON.parse(v); } catch (e) { o = null; }
  return o === undefined ? null : o;
}
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function civil(days) {
  var z = days + 719468;
  var era = Math.floor(z / 146097);
  var doe = z - era * 146097;
  var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  var mp = Math.floor((5 * doy + 2) / 153);
  var d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  var mo = mp < 10 ? mp + 3 : mp - 9;
  var y = yoe + era * 400 + (mo <= 2 ? 1 : 0);
  return y + "-" + pad2(mo) + "-" + pad2(d);
}
function hhmm(s) {
  if (typeof s !== "string" || s.length < 5 || s.charCodeAt(2) !== 58) return null;
  var h = (s.charCodeAt(0) - 48) * 10 + (s.charCodeAt(1) - 48);
  var mi = (s.charCodeAt(3) - 48) * 10 + (s.charCodeAt(4) - 48);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}
function missing(o, req) {
  if (!o || typeof o !== "object") return req[0];
  for (var i = 0; i < req.length; i++) { var v = o[req[i]]; if (v === undefined || v === null) return req[i]; }
  return null;
}
function errCode() { return K.err && typeof K.err.code === "string" ? K.err.code : null; }
function setErr(code) {
  var cur = errCode();
  if (cur === code || cur === "noeff") return;
  var cb = BLOCK[cur] || 0, nb = BLOCK[code] || 0;
  if (cb > 0 && nb === 0) return;
  if (cb > 0 && nb > 0 && cb > nb) return;
  K.err = { code: code, ts: now, mem: ram };
}
function blockCode() { var c = errCode(); return c !== null && BLOCK[c] ? c : null; }
function abortErr(code, msg) { log("Störung " + code + ": " + msg); setErr(code); return finish(code); }
function readClock() {
  var s = Shelly.getComponentStatus("sys");
  ram = s && isNum(s.ram_free) ? s.ram_free : null;
  if (!s || !isNum(s.unixtime) || typeof s.time !== "string") return false;
  var minDay = hhmm(s.time);
  if (minDay === null) return false;
  now = s.unixtime;
  var off = minDay - (Math.floor(now / 60) % 1440);
  if (off > 720) off = off - 1440;
  if (off < -720) off = off + 1440;
  today = civil(Math.floor((now + off * 60) / 86400));
  return true;
}
function levelEmpty() {
  // aktueller Wasserstand: 1 = leer laut cfg1.lvlEmpty; null wenn nicht lesbar
  var is = Shelly.getComponentStatus("input", c1.idLvl);
  if (!is || typeof is.state !== "boolean") return null;
  return (is.state ? 1 : 0) === c1.lvlEmpty;
}

// ---- Schritt 1: KVS lesen (paginiert) -------------------------------------
function stepRead() { t0 = Shelly.getUptimeMs(); K = {}; kvsPage(0); }
function kvsPage(off) { rpc("KVS.GetMany", { match: "*", offset: off }, onKvsPage, off); }
function onKvsPage(res, ec, em, off) {
  if (ec !== 0) { fail("KVS.GetMany: " + em); return; }
  var items = res && res.items ? res.items : {};
  var n = 0;
  if (typeof items.length === "number") {
    for (var i = 0; i < items.length; i++) { K[items[i].key] = fromKvs(items[i].value); n = n + 1; }
  } else {
    var ks = Object.keys(items);
    for (var j = 0; j < ks.length; j++) { K[ks[j]] = fromKvs(items[ks[j]].value); n = n + 1; }
  }
  var total = res && isNum(res.total) ? res.total : 0;
  if (n > 0 && off + n < total) { kvsPage(off + n); return; }
  orig = {};
  var keys = Object.keys(K);
  for (var q = 0; q < keys.length; q++) orig[keys[q]] = JSON.stringify(K[keys[q]]);
  if (DEBUG) { for (var d = 0; d < keys.length; d++) dbg("kvs " + keys[d] + " " + typeof K[keys[d]] + " " + orig[keys[d]]); }
  if (!K.err || typeof K.err !== "object") K.err = { code: null, ts: null, mem: null };
  if (!K.day || typeof K.day !== "object") K.day = { date: null, n: 0, sec: 0 };
  next();
}

// ---- Schritt 2: Pflichtfelder, Uhr -----------------------------------------
function stepCfg() {
  c1 = K.cfg1; c3 = K.cfg3;
  readClock();
  var miss = missing(c1, REQ1);
  if (miss !== null) { return abortErr("cfg", "cfg1." + miss + " fehlt"); }
  miss = missing(c3, REQ3);
  if (miss !== null) { return abortErr("cfg", "cfg3." + miss + " fehlt"); }
  if (!(c1.nLvl >= 1) || !(c1.msSample >= 1) || !(c3.tChk >= 1)) { return abortErr("cfg", "cfg1.nLvl/msSample und cfg3.tChk müssen ≥ 1 sein"); }
  if (!readClock()) { return abortErr("uhr", "Uhrzeit nicht gesetzt"); }
  return true;
}

// ---- Schritt 3: Auftrag prüfen ---------------------------------------------
function stepCheck() {
  job = K.job;
  dbg("job " + JSON.stringify(job) + " now=" + now);
  if (!job || typeof job !== "object" || job.ok !== true) { log("kein Auftrag (job.ok=false, why=" + (job ? job.why : "-") + ")"); return finish("kein_auftrag"); }
  if (!isNum(job.ts) || now - job.ts > c3.jobAge * 60) { return abortErr("alt", "Auftrag ist " + (isNum(job.ts) ? Math.round((now - job.ts) / 60) : "?") + " min alt, erlaubt " + c3.jobAge); }
  var blk = blockCode();
  if (blk !== null) { log("Störung " + blk + " steht, kein Gießen"); return finish("err:" + blk); }
  if (K.day.date !== today) K.day = { date: today, n: 0, sec: 0 };
  if (K.day.n >= c3.maxDay) { return abortErr("limit", "Tageslimit " + c3.maxDay + " erreicht"); }
  if (!isNum(job.sec) || job.sec < 1) { log("Auftrag ohne gültige Sekunden"); return finish("kein_auftrag"); }
  return true;
}

// ---- Schritt 4: Wasserstand vor der Gabe, nLvl gleiche Lesungen ----------------
function stepLevel() { lvl.s = []; lvl.h = Timer.set(c1.msSample, true, onLevel); }
function onLevel() {
  try {
    lvl.s.push(levelEmpty());
    dbg("lvl " + JSON.stringify(lvl.s));
    if (lvl.s.length < c1.nLvl) return;
    Timer.clear(lvl.h);
    var stable = true;
    for (var i = 0; i < lvl.s.length; i++) { if (lvl.s[i] === null || lvl.s[i] !== lvl.s[0]) stable = false; }
    if (!stable) { log("Wasserstand unstabil, kein Gießen"); finish("lvl"); next(); return; }
    if (lvl.s[0] === true) { abortErr("wasser", "Behälter leer"); next(); return; }
    next();
  } catch (e) { Timer.clear(lvl.h); fail(e); }
}

// ---- Schritt 5: Pumpe ein, Überwachung ---------------------------------------
function stepPump() {
  run.sec = job.sec > c3.tMax ? c3.tMax : job.sec;
  rpc("Switch.Set", { id: c1.idSw, on: true, toggle_after: run.sec }, onSwitchOn);
}
function onSwitchOn(res, ec, em) {
  if (ec !== 0) { log("Switch.Set ein fehlgeschlagen: " + em); finish("switch"); next(); return; }
  run.wasOn = res && res.was_on === true;
  readClock();
  run.start = now;
  run.ticks = 0;
  log("Pumpe ein für " + run.sec + " s (Auftrag " + job.sec + " s, pct " + job.pct + ")");
  run.h = Timer.set(c3.tChk * 1000, true, onCheck);
}
function onCheck() {
  try {
    run.ticks = run.ticks + 1;
    run.elapsed = run.ticks * c3.tChk;
    var empty = levelEmpty();
    var sw = Shelly.getComponentStatus("switch", c1.idSw);
    dbg("check t=" + run.elapsed + "/" + run.sec + " out=" + (sw ? sw.output : "?") + " leer=" + empty);
    if (empty === true) { endRun("abbruch", run.elapsed); return; }
    if (sw && sw.output === false && run.elapsed < run.sec) { endRun("extern", run.elapsed); return; }
    if (run.elapsed >= run.sec + 2) { endRun("ok", run.sec); return; }
  } catch (e) { Timer.clear(run.h); fail(e); }
}
function endRun(result, actual) {
  Timer.clear(run.h);
  run.result = result;
  run.actual = actual;
  // Gürtel und Hosenträger: Ausgang in jedem Fall aus
  rpc("Switch.Set", { id: c1.idSw, on: false }, onSwitchOff);
}
function onSwitchOff(res, ec, em) {
  if (ec !== 0) log("Switch.Set aus fehlgeschlagen: " + em);
  log("Pumpe aus: " + run.result + " nach " + run.actual + " s");
  next();
}

// ---- Schritt 6: KVS neu lesen (bw_main kann inzwischen geschrieben haben) -------
function stepReread() { K = {}; kvsPage(0); }

// ---- Schritt 7: Ergebnis -----------------------------------------------------
function stepResult() {
  readClock();
  var pctB = isNum(job.pct) ? job.pct : null;
  if (run.result === "ok") {
    K.st = { state: "gegossen", ts: run.start, sec: run.actual, pctB: pctB, pctA: null, rated: false, dryOk: false };
  } else {
    // unvollständige Gabe: kein Lernwert (rated=true ohne pctA), Pause läuft trotzdem ab Start
    K.st = { state: "sperre", ts: run.start, sec: run.actual, pctB: pctB, pctA: null, rated: true, dryOk: false };
    if (run.result === "abbruch") setErr("wasser");
  }
  if (!K.day || K.day.date !== today) K.day = { date: today, n: 0, sec: 0 };
  K.day.n = K.day.n + 1;
  K.day.sec = K.day.sec + run.actual;
  K.job = { ok: false, sec: job.sec, pct: pctB, why: run.result, ts: job.ts };
  out.why = run.result;
  return true;
}

// ---- Schritt 8: schreiben, nur Änderungen -------------------------------------
function stepWrite() {
  var keys = ["st", "day", "job", "err"];
  wq = [];
  for (var i = 0; i < keys.length; i++) { if (K[keys[i]] !== undefined && JSON.stringify(K[keys[i]]) !== orig[keys[i]]) wq.push(keys[i]); }
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

// ---- Schritt 9: Konsole, Ende ---------------------------------------------------
function stepDone() {
  log("ergebnis=" + out.why + " sec=" + run.actual + " day.n=" + (K.day ? K.day.n : "-") + " err=" + (errCode() === null ? "-" : errCode()) + " w=" + wq.length + " dauer=" + (Shelly.getUptimeMs() - t0) + "ms");
  return true;
}

// Schrittliste erst hier: mJS hoistet Funktionen nicht, die Namen gibt es erst nach ihrer Deklaration.
var steps = [stepRead, stepCfg, stepCheck, stepLevel, stepPump, stepReread, stepResult, stepWrite, stepDone];
dbg("start");
next();
