// bw_main.js v0.2.0 – Arbeitstakt (cfg3.tick, Standard 15 min): messen, kontrollieren, Trockenphase, Pause bestimmen, Gießauftrag schreiben
// Arbeitstakt (cfg3.tick, Standard alle 15 min): misst Feuchte, Temperatur und Wasserstand und schreibt den Gießauftrag "job".
// Auslöser: Feuchte unter cfg2.pctLo → job.ok=true, sec = (pctSoll−ist)/lrn.effW·sf + tDead, geklemmt tMin..tMax (ohne effW tStd).
// Gegossen wird erst im nächsten Fenster durch bw_pump, der dort in Portionen regelt und lrn.effW/sf lernt.
// Bremsen: Pause seit der letzten Gabe (pause 24 h; pauseHot 12 h bei Hitze über tHot oder nach why max/zeit unter pctLo; pauseSlow 48 h),
// Tageslimit maxDay, Behälter leer, Sensor unplausibel, Feuchte über pctLo. Der Grund steht in job.why (README).
// Kontrolle soak min nach dem Fenster: über pctHi+hyst → sf sinkt (Hinweis zuviel); Abfall seit dem Fenster über dropW → Hinweis sink.
// Trockenphase (keine Gabe bis Feuchte < pctDry): ab Wochentag cfg3.dryDay (5 = Freitag, null = nie) und bei Feuchte über pctHi.
// Band: pctDry<pctLo<pctOk<=pctSoll<pctHi und pctLo+hyst<pctOk, sonst Störung cfg. Dieses Script schaltet die Pumpe nie.
var VER = "0.2.0";
var DEBUG = 0;
var REQ1 = ["vDry", "vWet", "vErrLo", "vErrHi", "nSample", "msSample", "lvlEmpty", "nLvl", "idV", "idT", "idLvl", "idSw"];
var REQ2 = ["hyst", "effMin", "effMax", "alpha", "sfMin", "sfStep"];
var OPEN2 = ["pctSoll", "pctLo", "pctOk", "pctHi", "pctDry", "dropSlow"];
var REQ3 = ["tDead", "tMin", "tStd", "tMax", "tHot", "pauseHot", "pause", "pauseSlow", "soak", "jobAge", "maxDay", "tChk", "winA", "winB", "tick"];
var BLOCK = { noeff: 6, cfg: 5, uhr: 4, sensor: 3, wasser: 2 };
var ERR_ORDER = ["sink", "temp", "zuviel", "wasser", "sensor", "uhr", "cfg"];
var K = {};
var orig = {};
var c1 = null, c2 = null, c3 = null;
var now = 0, today = "", dayNo = 0, minDay = 0, ram = null;
var act = {};
var smp = { v: [], lvl: [], n: 0, h: null };
var m = { V: null, pct: null, tC: null, lvl: null, empty: null, sensorOk: false, lvlOk: false };
var out = { why: "-", sec: "-", pauseH: "-" };
var wq = [], wi = 0;
var t0 = 0;
var si = 0;
function log(s) { print("[bw_main " + VER + "] " + s); }
function dbg(s) { if (DEBUG) print("[bw_main dbg] " + s); }
function rpc(m, p, cb, ud) { dbg("rpc " + m + " " + JSON.stringify(p)); Shelly.call(m, p, cb, ud); }
function stop() { rpc("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function fail(e) { log("ABBRUCH: " + (e && e.message ? e.message : e)); stop(); }
function next() {
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
function fromKvs(v) {
if (typeof v !== "string") return v;
var o = null;
try { o = JSON.parse(v); } catch (e) { o = null; }
return o === undefined ? null : o;
}
function r1(x) { return Math.round(x * 10) / 10; }
function r3(x) { return Math.round(x * 1000) / 1000; }
function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
function durOf(s) { return isNum(s.dur) ? s.dur : (isNum(s.sec) ? s.sec : 0); }
function missing(o, req) {
if (!o || typeof o !== "object") return req[0];
for (var i = 0; i < req.length; i++) { var v = o[req[i]]; if (v === undefined || v === null) return req[i]; }
return null;
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
function errCode() { return K.err && typeof K.err.code === "string" ? K.err.code : null; }
function setErr(code) {
var cur = errCode();
if (cur === code || cur === "noeff") return;
var cb = BLOCK[cur] || 0, nb = BLOCK[code] || 0;
if (cb > 0 && nb === 0) return;
if (cb > 0 && nb > 0 && cb > nb) return;
K.err = { code: code, ts: now, mem: ram };
}
function clrErr(code) { if (errCode() === code) K.err = { code: null, ts: now, mem: ram }; }
function applyErr() {
for (var i = 0; i < ERR_ORDER.length; i++) { if (act[ERR_ORDER[i]] === false) clrErr(ERR_ORDER[i]); }
for (var j = 0; j < ERR_ORDER.length; j++) { if (act[ERR_ORDER[j]] === true) setErr(ERR_ORDER[j]); }
}
function blockCode() { var c = errCode(); return c !== null && BLOCK[c] ? c : null; }
function abortErr(code, msg) {
log("Störung " + code + ": " + msg);
act[code] = true;
setErr(code);
if (K.job && K.job.ok) K.job = { ok: false, sec: null, pct: K.job.pct, why: code, ts: now };
out.why = code;
jumpTo(stepWrite);
return true;
}
function stepRead() { t0 = Shelly.getUptimeMs(); kvsPage(0); }
function kvsPage(off) { rpc("KVS.GetMany", { match: "*", offset: off }, onKvsPage, off); }
function onKvsPage(res, ec, em, off) {
if (ec !== 0) { fail("KVS.GetMany: " + em); return; }
var items = res && res.items ? res.items : [];
for (var i = 0; i < items.length; i++) K[items[i].key] = fromKvs(items[i].value);
var total = res && isNum(res.total) ? res.total : 0;
if (items.length > 0 && off + items.length < total) { kvsPage(off + items.length); return; }
var keys = Object.keys(K);
for (var q = 0; q < keys.length; q++) orig[keys[q]] = JSON.stringify(K[keys[q]]);
if (DEBUG) { for (var d = 0; d < keys.length; d++) dbg("kvs " + keys[d] + " " + typeof K[keys[d]] + " " + orig[keys[d]]); }
next();
}
function stepCfg() {
c1 = K.cfg1; c2 = K.cfg2; c3 = K.cfg3;
if (!K.lrn || typeof K.lrn !== "object") K.lrn = { effW: null, sf: 0.7, rate: null, tMean: null, tMaxD: null, tMaxY: null };
if (!isNum(K.lrn.sf)) K.lrn.sf = 0.7;
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
if (!(c1.nSample >= 1) || !(c1.nLvl >= 1) || !(c1.msSample >= 1) || !(c3.tick >= 1)) { return abortErr("cfg", "cfg1.nSample/nLvl/msSample, cfg3.tick müssen ≥ 1 sein"); }
if (!(c1.vWet > c1.vDry)) { return abortErr("cfg", "cfg1.vWet muss größer als vDry sein"); }
if (hhmm(c3.winA) === null || hhmm(c3.winB) === null) { return abortErr("cfg", "cfg3.winA/winB ungültig (HH:MM)"); }
if (missing(c2, OPEN2) === null && !(c2.pctDry < c2.pctLo && c2.pctLo < c2.pctOk && c2.pctLo + c2.hyst < c2.pctOk && c2.pctOk <= c2.pctSoll && c2.pctSoll < c2.pctHi)) {
return abortErr("cfg", "cfg2: Band ungültig (pctDry<pctLo<pctOk<=pctSoll<pctHi, pctLo+hyst<pctOk)");
}
return true;
}
function stepClock() {
var s = Shelly.getComponentStatus("sys");
if (!s || !isNum(s.unixtime) || typeof s.time !== "string" || s.time.length < 5) { return abortErr("uhr", "Uhrzeit nicht gesetzt (kein NTP seit Neustart)"); }
now = s.unixtime;
minDay = hhmm(s.time.slice(0, 5));
if (minDay === null) { return abortErr("uhr", "Sys.time unlesbar: " + s.time); }
var utcMin = Math.floor(now / 60) % 1440;
var off = minDay - utcMin;
if (off > 720) off = off - 1440;
if (off < -720) off = off + 1440;
dayNo = Math.floor((now + off * 60) / 86400);
today = civil(dayNo);
return true;
}
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
function rateLive() {
var s = K.st;
if (!s.rated || !isNum(s.pctA) || !isNum(s.ts) || m.pct === null || !m.sensorOk) return null;
var hrs = (now - (s.ts + durOf(s) + c3.soak * 60)) / 3600;
if (hrs < 24) return null;
return (s.pctA - m.pct) / hrs;
}
function dryStart(why) {
var s = K.st;
if (s.state === "beob") { s.state = "sperre"; s.rated = true; }
else if (!s.dryOk) return;
s.dryOk = false;
log("Trockenphase (" + why + "): warte auf < " + c2.pctDry + " %");
}
function stepDay() {
var d = K.day, l = K.lrn;
if (d.date !== today) {
if (d.date !== null) {
l.tMaxY = l.tMaxD;
if (l.tMaxD !== null) l.tMean = r3(l.tMean === null ? l.tMaxD : 0.9 * l.tMean + 0.1 * l.tMaxD);
var r = rateLive();
if (r !== null) l.rate = r3(r);
K.err = { code: K.err.code, ts: K.err.ts, mem: ram };
if (isNum(c3.dryDay) && (dayNo + 4) % 7 === c3.dryDay) dryStart("Wochentag " + c3.dryDay);
}
l.tMaxD = null;
K.day = { date: today, n: 0, sec: 0 };
clrErr("limit");
}
return true;
}
function control() {
var l = K.lrn, s = K.st, pct = m.pct;
s.pctA = r1(pct);
s.rated = true;
s.state = "sperre";
if (!isNum(s.pctB) || !isNum(s.pctW)) { log("Kontrolle ohne Fensterwert"); return; }
act.zuviel = pct > c2.pctHi + c2.hyst && s.why !== "over";
if (act.zuviel) l.sf = r3(clamp(l.sf - c2.sfStep, c2.sfMin, 1));
act.sink = isNum(c2.dropW) && s.pctW - pct > c2.dropW;
log("Kontrolle: " + s.pctW + " → " + s.pctA + " % sf=" + l.sf + (act.zuviel ? " zuviel" : "") + (act.sink ? " sink" : ""));
}
function windowSoon() {
var e = c3.winEvery;
if (isNum(e) && e >= 1) return e - (minDay % e) <= c3.tick;
var w = [hhmm(c3.winA), hhmm(c3.winB)];
for (var i = 0; i < w.length; i++) {
var diff = w[i] - minDay;
if (diff < 0) diff = diff + 1440;
if (diff > 0 && diff <= c3.tick) return true;
}
return false;
}
function stepEval() {
var l = K.lrn, s = K.st, d = K.day;
var pct = m.pct;
var cfgOpen = missing(c2, OPEN2);
if (m.tC !== null) {
var tr = Math.round(m.tC / 2) * 2;
if (m.tC > c3.tHot && tr <= c3.tHot) tr = Math.floor(c3.tHot) + 1;
if (m.tC <= c3.tHot && tr > c3.tHot) tr = Math.floor(c3.tHot);
if (l.tMaxD === null || tr > l.tMaxD) l.tMaxD = tr;
}
if (cfgOpen === null && m.sensorOk && pct > c2.pctHi && s.state !== "gegossen") dryStart("nass " + r1(pct) + " %");
if (cfgOpen === null && s.state === "gegossen" && !s.rated && isNum(s.ts) && m.sensorOk && now - (s.ts + durOf(s)) >= c3.soak * 60) control();
act.uhr = false;
act.cfg = cfgOpen !== null;
act.sensor = !m.sensorOk;
act.wasser = m.lvlOk ? (m.empty === true) : null;
act.temp = m.tC === null;
applyErr();
if (s.state === "sperre" && !s.dryOk && m.sensorOk && c2.pctDry !== null && pct < c2.pctDry) s.dryOk = true;
var rate = rateLive();
var tMax24 = l.tMaxD;
if (l.tMaxY !== null && (tMax24 === null || l.tMaxY > tMax24)) tMax24 = l.tMaxY;
var pauseH = c3.pause;
if (tMax24 !== null && tMax24 > c3.tHot) pauseH = c3.pauseHot;
else if ((s.why === "max" || s.why === "zeit") && s.dryOk && isNum(s.pctA) && s.pctA < c2.pctLo) pauseH = c3.pauseHot;
else if (rate !== null && c2.dropSlow !== null && rate * 24 < c2.dropSlow) pauseH = c3.pauseSlow;
var pauseOk = !isNum(s.ts) || (now + 2 * c3.tick * 60) - s.ts >= pauseH * 3600;
if (s.state === "sperre" && pauseOk && s.dryOk) s.state = "beob";
out.pauseH = pauseH;
var j = { ok: false, sec: null, pct: pct === null ? null : r3(pct), why: "", ts: now };
var blk = blockCode();
var lo = K.job.ok ? c2.pctLo + c2.hyst : c2.pctLo;
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
j.ok = true;
j.why = "ok";
j.sec = l.effW > 0 ? clamp(Math.round((c2.pctSoll - pct) / l.effW * l.sf + c3.tDead), c3.tMin, c3.tMax) : c3.tStd;
}
dbg("job " + JSON.stringify(j) + " state=" + s.state + " pauseOk=" + pauseOk);
out.why = j.why;
out.sec = j.sec === null ? "-" : j.sec;
var changed = K.job.ok !== j.ok || K.job.why !== j.why;
if (changed || (j.ok && windowSoon())) {
K.job = j;
clrErr("alt");
}
return true;
}
function stepWrite() {
var keys = ["lrn", "st", "day", "err", "job"];
wq = [];
for (var i = 0; i < keys.length; i++) { if (JSON.stringify(K[keys[i]]) !== orig[keys[i]]) wq.push(keys[i]); }
wi = 0;
dbg("schreibe " + (wq.length ? wq.join(",") : "nichts"));
return writeNext();
}
function writeNext() {
if (wi >= wq.length) return true;
var k = wq[wi];
wi = wi + 1;
rpc("KVS.Set", { key: k, value: JSON.stringify(K[k]) }, onWrite, k);
}
function onWrite(res, ec, em, k) {
if (ec !== 0) log("KVS.Set " + k + " fehlgeschlagen: " + em);
if (writeNext()) next();
}
function stepDone() {
var l = K.lrn, s = K.st;
log("V=" + (m.V === null ? "-" : r3(m.V)) + " pct=" + (m.pct === null ? "-" : r3(m.pct)) + " tC=" + (m.tC === null ? "-" : m.tC)
+ " lvl=" + (m.lvl === null ? "?" : m.lvl) + " st=" + s.state + " dry=" + (s.dryOk ? 1 : 0) + " pause=" + out.pauseH + "h"
+ " why=" + out.why + " sec=" + out.sec + " effW=" + (isNum(l.effW) ? l.effW : "-") + " sf=" + l.sf
+ " err=" + (errCode() === null ? "-" : errCode()) + " w=" + wq.length + " dauer=" + (Shelly.getUptimeMs() - t0) + "ms");
return true;
}
var steps = [stepRead, stepCfg, stepClock, stepSample, stepDay, stepEval, stepWrite, stepDone];
dbg("start");
next();
