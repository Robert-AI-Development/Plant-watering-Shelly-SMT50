// bw_main.js v0.1.1 – Arbeitstakt alle 15 min: messen, bewerten, lernen, Pause bestimmen, Gießauftrag schreiben
//
// Einmal-Läufer: startet über den Zeitplan, arbeitet eine Schrittkette ab und beendet sich per Script.Stop.
// Rührt die Pumpe nie an. Alles Wissen liegt im KVS (cfg1..3, lrn, st, job, day, err), nichts im RAM.
// Schritte:  1 KVS lesen   2 Pflichtfelder   3 Uhrzeit   4 Messen (Timer)   5 Tageswechsel
//            6 Bewerten/Lernen/Pause/Auftrag   7 KVS schreiben (nur Änderungen)   8 Konsole, Script.Stop
// Regeln: docs/konzept-v2.md, docs/umsetzungsplan-v1.md/-v2.md, Entscheidungen in docs/PLAN.md.
// Immer nur ein offener RPC-Aufruf, ein Timer, alle Callbacks benannt (Gerätegrenzen laut Doku).

var VER = "0.1.1";
var DEBUG = 0;                 // 1 = Debug-Zeilen in der Konsole: Schritte, RPC-Aufrufe, KVS-Inhalt, Messwerte
var TICK_MIN = 15;   // Takt des Zeitplans in Minuten (bw_install: "0 */15 * * * *"); nur für die job-Schreibregel

// Pflichtfelder je Konfigurationseintrag; OPEN2 darf null sein (Kalibrierung noch offen → nur messen)
var REQ1 = ["vDry", "vWet", "vErrLo", "vErrHi", "nSample", "msSample", "lvlEmpty", "nLvl", "idV", "idT", "idLvl", "idSw"];
var REQ2 = ["hyst", "effMin", "effMax", "alpha", "sfMin", "sfStep"];
var OPEN2 = ["pctSoll", "pctLo", "pctHi", "pctDry", "dropSlow"];
var REQ3 = ["tDead", "tMin", "tStd", "tMax", "tHot", "pauseHot", "pause", "pauseSlow", "soak", "jobAge", "maxDay", "tChk", "winA", "winB"];

// Störungscodes: Wert > 0 blockiert den Auftrag und ist der Vorrang beim Überschreiben; noeff wird nie überschrieben
var BLOCK = { noeff: 6, cfg: 5, uhr: 4, sensor: 3, wasser: 2 };
var ERR_ORDER = ["temp", "wasser", "sensor", "uhr", "cfg"];   // Reihenfolge beim Setzen: aufsteigender Vorrang

var K = {};        // gelesene KVS-Einträge
var orig = {};     // JSON der Einträge beim Lesen, für "schreiben nur bei Änderung"
var c1 = null, c2 = null, c3 = null;
var now = 0, today = "", minDay = 0, ram = null;
var act = {};      // in diesem Takt aktive Störbedingungen
var smp = { v: [], lvl: [], n: 0, h: null };
var m = { V: null, pct: null, tC: null, lvl: null, empty: null, sensorOk: false, lvlOk: false };
var out = { why: "-", sec: "-", pauseH: "-" };
var wq = [], wi = 0;
var t0 = 0;
var si = 0;

// ---- Hilfen ------------------------------------------------------------
function log(s) { print("[bw_main " + VER + "] " + s); }
function dbg(s) { if (DEBUG) print("[bw_main dbg] " + s); }
function rpc(m, p, cb, ud) { dbg("rpc " + m + " " + JSON.stringify(p)); Shelly.call(m, p, cb, ud); }
function stop() { rpc("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function fail(e) { log("ABBRUCH: " + (e && e.message ? e.message : e)); stop(); }
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
function isNum(x) { return typeof x === "number" && x === x; }
// KVS-Werte sind JSON-Strings (Entscheidung 15: die Web-UI zeigt Objektwerte nur als [object Object]);
// unlesbare Werte gelten als fehlend (null)
function fromKvs(v) {
  if (typeof v !== "string") return v;
  var o = null;
  try { o = JSON.parse(v); } catch (e) { o = null; }
  return o === undefined ? null : o;
}
function r3(x) { return Math.round(x * 1000) / 1000; }
function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
function missing(o, req) {
  if (!o || typeof o !== "object") return req[0];
  for (var i = 0; i < req.length; i++) { var v = o[req[i]]; if (v === undefined || v === null) return req[i]; }
  return null;
}
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function civil(days) {
  // Tage seit 1970-01-01 → "YYYY-MM-DD" (Algorithmus civil_from_days, H. Hinnant)
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
  if (typeof s !== "string" || s.length !== 5 || s.charCodeAt(2) !== 58) return null;
  var h = (s.charCodeAt(0) - 48) * 10 + (s.charCodeAt(1) - 48);
  var mi = (s.charCodeAt(3) - 48) * 10 + (s.charCodeAt(4) - 48);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}
function sortNum(a) {
  for (var i = 1; i < a.length; i++) { var x = a[i]; var j = i - 1; while (j >= 0 && a[j] > x) { a[j + 1] = a[j]; j = j - 1; } a[j + 1] = x; }
  return a;
}
function midMean(arr) {
  // Mittelwert der mittleren Werte: sortieren, ab drei Werten Minimum und Maximum verwerfen
  var a = [];
  for (var i = 0; i < arr.length; i++) { if (arr[i] !== null) a.push(arr[i]); }
  if (a.length === 0) return null;
  sortNum(a);
  var lo = 0, hi = a.length;
  if (a.length >= 3) { lo = 1; hi = a.length - 1; }
  var s = 0;
  for (var k = lo; k < hi; k++) s = s + a[k];
  return s / (hi - lo);
}

// ---- Störungen: setzen, löschen, Vorrang ----------------------------------
function errCode() { return K.err && typeof K.err.code === "string" ? K.err.code : null; }
function setErr(code) {
  var cur = errCode();
  if (cur === code || cur === "noeff") return;
  var cb = BLOCK[cur] || 0, nb = BLOCK[code] || 0;
  if (cb > 0 && nb === 0) return;            // blockierender Code bleibt vor einem Hinweis
  if (cb > 0 && nb > 0 && cb > nb) return;   // höherer Vorrang bleibt
  K.err = { code: code, ts: now, mem: ram };
}
function clrErr(code) { if (errCode() === code) K.err = { code: null, ts: now, mem: ram }; }
function applyErr() {
  // erst alle nicht mehr aktiven Bedingungen löschen, dann die aktiven in aufsteigendem Vorrang setzen;
  // null = Bedingung in diesem Takt nicht prüfbar (z. B. Wasserstand unstabil) → Störung bleibt wie sie ist
  for (var i = 0; i < ERR_ORDER.length; i++) { if (act[ERR_ORDER[i]] === false) clrErr(ERR_ORDER[i]); }
  for (var j = 0; j < ERR_ORDER.length; j++) { if (act[ERR_ORDER[j]] === true) setErr(ERR_ORDER[j]); }
}
function blockCode() { var c = errCode(); return c !== null && BLOCK[c] ? c : null; }
function abortErr(code, msg) {
  // Abbruch mit Störung: err setzen, laufenden Auftrag zurücknehmen, dann nur noch schreiben und beenden
  log("Störung " + code + ": " + msg);
  act[code] = true;
  setErr(code);
  if (K.job && K.job.ok) K.job = { ok: false, sec: null, pct: K.job.pct, why: code, ts: now };
  out.why = code;
  jumpTo(stepWrite);
  return true;
}

// ---- Schritt 1: KVS lesen (paginiert) -------------------------------------
function stepRead() { t0 = Shelly.getUptimeMs(); kvsPage(0); }
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
  var keys = Object.keys(K);
  for (var q = 0; q < keys.length; q++) orig[keys[q]] = JSON.stringify(K[keys[q]]);
  if (DEBUG) { for (var d = 0; d < keys.length; d++) dbg("kvs " + keys[d] + " " + typeof K[keys[d]] + " " + orig[keys[d]]); }
  next();
}

// ---- Schritt 2: Pflichtfelder und Zustandseinträge ---------------------------
function stepCfg() {
  c1 = K.cfg1; c2 = K.cfg2; c3 = K.cfg3;
  // Zustandseinträge dürfen fehlen (z. B. err von Hand gelöscht) → Standard annehmen, wird zurückgeschrieben
  if (!K.lrn || typeof K.lrn !== "object") K.lrn = { eff: null, sf: 1, rate: null, tMean: null, tMaxD: null, tMaxY: null };
  if (K.lrn.sf === undefined || K.lrn.sf === null) K.lrn.sf = 1;
  if (!K.st || typeof K.st !== "object") K.st = { state: "beob", ts: null, sec: null, pctB: null, pctA: null, rated: false, dryOk: false };
  if (!K.day || typeof K.day !== "object") K.day = { date: null, n: 0, sec: 0 };
  if (!K.err || typeof K.err !== "object") K.err = { code: null, ts: null, mem: null };
  if (!K.job || typeof K.job !== "object") K.job = { ok: false, sec: null, pct: null, why: "init", ts: null };
  var sys = Shelly.getComponentStatus("sys");
  ram = sys && isNum(sys.ram_free) ? sys.ram_free : null;
  now = sys && isNum(sys.unixtime) ? sys.unixtime : null;
  var miss = missing(c1, REQ1);
  if (miss !== null) { return abortErr("cfg", "cfg1." + miss + " fehlt"); }
  miss = missing(c2, REQ2);
  if (miss !== null) { return abortErr("cfg", "cfg2." + miss + " fehlt"); }
  miss = missing(c3, REQ3);
  if (miss !== null) { return abortErr("cfg", "cfg3." + miss + " fehlt"); }
  if (!(c1.nSample >= 1) || !(c1.nLvl >= 1) || !(c1.msSample >= 1)) { return abortErr("cfg", "cfg1.nSample/nLvl/msSample müssen ≥ 1 sein"); }
  if (!(c1.vWet > c1.vDry)) { return abortErr("cfg", "cfg1.vWet muss größer als vDry sein"); }
  if (hhmm(c3.winA) === null || hhmm(c3.winB) === null) { return abortErr("cfg", "cfg3.winA/winB ungültig (HH:MM)"); }
  return true;
}

// ---- Schritt 3: Uhrzeit (lokales Datum ohne Date-Objekt) ---------------------
function stepClock() {
  var s = Shelly.getComponentStatus("sys");
  if (!s || !isNum(s.unixtime) || typeof s.time !== "string" || s.time.length < 5) { return abortErr("uhr", "Uhrzeit nicht gesetzt (kein NTP seit Neustart)"); }
  now = s.unixtime;
  minDay = hhmm(s.time.slice(0, 5));
  if (minDay === null) { return abortErr("uhr", "Sys.time unlesbar: " + s.time); }
  var utcMin = Math.floor(now / 60) % 1440;
  var off = minDay - utcMin;                // Zeitzonenversatz in Minuten aus lokaler Uhr und Unix-Zeit
  if (off > 720) off = off - 1440;
  if (off < -720) off = off + 1440;
  today = civil(Math.floor((now + off * 60) / 86400));
  return true;
}

// ---- Schritt 4: Messen mit einem Timer -------------------------------------
function stepSample() { smp.h = Timer.set(c1.msSample, true, onSample); }
function onSample() {
  try {
    var vs = Shelly.getComponentStatus("voltmeter", c1.idV);
    smp.v.push(vs && isNum(vs.voltage) ? vs.voltage : null);
    if (smp.lvl.length < c1.nLvl) {
      var is = Shelly.getComponentStatus("input", c1.idLvl);
      smp.lvl.push(is && typeof is.state === "boolean" ? (is.state ? 1 : 0) : null);
    }
    smp.n = smp.n + 1;
    dbg("probe " + smp.n + " V=" + smp.v[smp.v.length - 1] + " lvl=" + (smp.lvl.length ? smp.lvl[smp.lvl.length - 1] : "-"));
    if (smp.n >= c1.nSample && smp.lvl.length >= c1.nLvl) {
      Timer.clear(smp.h);
      evalSamples();
      next();
    }
  } catch (e) { Timer.clear(smp.h); fail(e); }
}
function evalSamples() {
  var good = 0;
  for (var i = 0; i < smp.v.length; i++) { if (smp.v[i] !== null) good = good + 1; }
  m.V = midMean(smp.v);
  m.sensorOk = good === smp.v.length && m.V !== null && m.V >= c1.vErrLo && m.V <= c1.vErrHi;
  m.pct = m.V === null ? null : clamp((m.V - c1.vDry) / (c1.vWet - c1.vDry) * 100, 0, 100);
  m.lvlOk = smp.lvl.length > 0;
  for (var j = 0; j < smp.lvl.length; j++) { if (smp.lvl[j] === null || smp.lvl[j] !== smp.lvl[0]) m.lvlOk = false; }
  m.lvl = m.lvlOk ? smp.lvl[0] : null;
  m.empty = m.lvlOk ? (m.lvl === c1.lvlEmpty) : null;
  var ts = Shelly.getComponentStatus("temperature", c1.idT);
  m.tC = ts && isNum(ts.tC) ? ts.tC : null;
}

// ---- Schritt 5: Tageswechsel per Datumsvergleich -----------------------------
function rateLive() {
  // Austrocknungsrate in %/h seit der letzten Bewertung; erst ab 24 h aussagekräftig (dropSlow gilt je 24 h)
  var s = K.st;
  if (!s.rated || !isNum(s.pctA) || !isNum(s.ts) || m.pct === null || !m.sensorOk) return null;
  var hrs = (now - (s.ts + c3.soak * 60)) / 3600;
  if (hrs < 24) return null;
  return (s.pctA - m.pct) / hrs;
}
function stepDay() {
  var d = K.day, l = K.lrn;
  if (d.date !== today) {
    if (d.date !== null) {
      // echter Tageswechsel: Tagesmaximum weiterreichen, Jahreszeit-Anzeiger glätten, Rate und Speicher protokollieren
      l.tMaxY = l.tMaxD;
      if (l.tMaxD !== null) l.tMean = r3(l.tMean === null ? l.tMaxD : 0.9 * l.tMean + 0.1 * l.tMaxD);
      var r = rateLive();
      if (r !== null) l.rate = r3(r);
      K.err = { code: K.err.code, ts: K.err.ts, mem: ram };
    }
    l.tMaxD = null;
    K.day = { date: today, n: 0, sec: 0 };
    clrErr("limit");
  }
  return true;
}

// ---- Schritt 6: Bewerten, Lernen, Pause, Freigabekette -----------------------
function rateGift() {
  // Bewertung nach der Einsickerzeit: Wirkung je wirksamer Pumpensekunde, sanft nachziehen
  var l = K.lrn, s = K.st, pct = m.pct;
  var effSec = s.sec - c3.tDead;
  if (!isNum(s.pctB) || !isNum(s.sec) || effSec <= 0) {
    log("Bewertung ohne Vorwert übersprungen");
  } else {
    var effNew = (pct - s.pctB) / effSec;
    if (effNew < c2.effMin) {
      setErr("noeff");
      log("Gabe ohne Wirkung: " + r3(s.pctB) + " % → " + r3(pct) + " % nach " + s.sec + " s – kein Lernwert, Störung noeff (von Hand löschen)");
    } else {
      if (effNew > c2.effMax) effNew = c2.effMax;
      var eff = l.eff === null ? effNew : (1 - c2.alpha) * l.eff + c2.alpha * effNew;
      l.eff = r3(clamp(eff, c2.effMin, c2.effMax));
      if (c2.pctHi !== null && pct > c2.pctHi) {
        l.sf = r3(clamp(l.sf - c2.sfStep, c2.sfMin, 1));
        act.zuviel = true;
        log("zu viel: " + r3(pct) + " % > pctHi, Sicherheitsfaktor " + l.sf);
      } else {
        clrErr("zuviel");   // Hinweis gilt bis zur nächsten Bewertung
      }
      log("gelernt: eff_neu=" + r3(effNew) + " eff=" + l.eff);
    }
  }
  s.pctA = r3(pct);
  s.rated = true;
  s.state = "sperre";
  s.dryOk = false;
}
function windowSoon() {
  // liegt ein Gießfenster innerhalb des nächsten Takts? Dann job frisch schreiben (Entscheidung 11)
  var w = [hhmm(c3.winA), hhmm(c3.winB)];
  for (var i = 0; i < w.length; i++) {
    var diff = w[i] - minDay;
    if (diff < 0) diff = diff + 1440;
    if (diff > 0 && diff <= TICK_MIN) return true;
  }
  return false;
}
function stepEval() {
  var l = K.lrn, s = K.st, d = K.day;
  var pct = m.pct;
  var cfgOpen = missing(c2, OPEN2);

  // Temperatur → Tagesmaximum in 2-°C-Schritten (spart Schreibvorgänge); das Überschreiten von tHot wird exakt erfasst
  if (m.tC !== null) {
    var tr = Math.round(m.tC / 2) * 2;
    if (m.tC > c3.tHot && tr <= c3.tHot) tr = Math.floor(c3.tHot) + 1;
    if (m.tC <= c3.tHot && tr > c3.tHot) tr = Math.floor(c3.tHot);
    if (l.tMaxD === null || tr > l.tMaxD) l.tMaxD = tr;
  }

  // Bewertung 30 min nach der Gabe (nur mit gültigem Sensor)
  if (s.state === "gegossen" && !s.rated && isNum(s.ts) && m.sensorOk && pct !== null && now - s.ts >= c3.soak * 60) rateGift();

  // Störbedingungen dieses Takts
  act.uhr = false;                       // bis hierher kommt der Takt nur mit gültiger Uhrzeit
  act.cfg = cfgOpen !== null;
  act.sensor = !m.sensorOk;
  act.wasser = m.lvlOk ? (m.empty === true) : null;
  act.temp = m.tC === null;
  applyErr();
  if (act.zuviel) setErr("zuviel");

  // Trockenphase nachgewiesen?
  if (s.state === "sperre" && !s.dryOk && m.sensorOk && c2.pctDry !== null && pct < c2.pctDry) s.dryOk = true;

  // Pause dreistufig
  var rate = rateLive();
  var tMax24 = l.tMaxD;
  if (l.tMaxY !== null && (tMax24 === null || l.tMaxY > tMax24)) tMax24 = l.tMaxY;
  var pauseH = c3.pause;
  if (tMax24 !== null && tMax24 > c3.tHot) pauseH = c3.pauseHot;
  else if (rate !== null && c2.dropSlow !== null && rate * 24 < c2.dropSlow) pauseH = c3.pauseSlow;
  // Der Auftrag entsteht einen Takt vor dem Fenster, die Gabe selbst startet Sekunden nach dem Fenster:
  // die Pause gilt als abgelaufen, wenn sie beim nächsten Fenster bis auf einen Takt Toleranz vorbei ist
  var pauseOk = !isNum(s.ts) || (now + 2 * TICK_MIN * 60) - s.ts >= pauseH * 3600;
  if (s.state === "sperre" && pauseOk && s.dryOk) s.state = "beob";
  out.pauseH = pauseH;

  // Freigabekette → Auftrag mit Begründung
  var j = { ok: false, sec: null, pct: pct === null ? null : r3(pct), why: "", ts: now };
  var blk = blockCode();
  var lo = K.job.ok ? c2.pctLo + c2.hyst : c2.pctLo;   // Hysterese: laufender Auftrag bleibt bis pctLo + hyst
  if (cfgOpen !== null) j.why = "cfg";
  else if (!m.sensorOk) j.why = "sensor";
  else if (!m.lvlOk) j.why = "lvl";
  else if (m.empty) j.why = "wasser";
  else if (blk !== null) j.why = "err:" + blk;
  else if (d.n >= c3.maxDay) j.why = "limit";
  else if (s.state === "gegossen") j.why = "soak";
  else if (!pauseOk) j.why = "pause";
  else if (s.state === "sperre") j.why = "trocken";
  else if (pct >= lo) j.why = "feucht";
  else {
    var sec = null;
    if (l.eff === null) sec = c3.tStd;                       // erste Gabe überhaupt: Standardgabe
    else {
      var raw = (c2.pctSoll - pct) / l.eff * l.sf + c3.tDead;
      if (raw < c3.tMin) j.why = "tmin";
      else sec = Math.round(raw) > c3.tMax ? c3.tMax : Math.round(raw);
    }
    if (sec !== null) { j.ok = true; j.sec = sec; j.why = "ok"; }
  }
  dbg("job " + JSON.stringify(j) + " state=" + s.state + " pauseOk=" + pauseOk);
  out.why = j.why;
  out.sec = j.sec === null ? "-" : j.sec;

  // Auftrag schreiben: bei Änderung von ok/why, oder vor einem Gießfenster, wenn er ok ist (bw_pump prüft dann das Alter)
  var changed = K.job.ok !== j.ok || K.job.why !== j.why;
  if (changed || (j.ok && windowSoon())) {
    K.job = j;
    clrErr("alt");
  }
  return true;
}

// ---- Schritt 7: KVS schreiben, nur geänderte Einträge ------------------------
function stepWrite() {
  var keys = ["lrn", "st", "day", "err", "job"];
  wq = [];
  for (var i = 0; i < keys.length; i++) { if (JSON.stringify(K[keys[i]]) !== orig[keys[i]]) wq.push(keys[i]); }
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

// ---- Schritt 8: eine Konsolenzeile, Ende ------------------------------------
function stepDone() {
  var l = K.lrn, s = K.st;
  log("V=" + (m.V === null ? "-" : r3(m.V)) + " pct=" + (m.pct === null ? "-" : r3(m.pct)) + " tC=" + (m.tC === null ? "-" : m.tC)
    + " lvl=" + (m.lvl === null ? "?" : m.lvl) + " st=" + s.state + " dry=" + (s.dryOk ? 1 : 0) + " pause=" + out.pauseH + "h"
    + " why=" + out.why + " sec=" + out.sec + " eff=" + (l.eff === null ? "-" : l.eff) + " sf=" + l.sf
    + " err=" + (errCode() === null ? "-" : errCode()) + " w=" + wq.length + " dauer=" + (Shelly.getUptimeMs() - t0) + "ms");
  return true;
}

// Schrittliste erst hier: mJS hoistet Funktionen nicht, die Namen gibt es erst nach ihrer Deklaration.
var steps = [stepRead, stepCfg, stepClock, stepSample, stepDay, stepEval, stepWrite, stepDone];
dbg("start");
next();
