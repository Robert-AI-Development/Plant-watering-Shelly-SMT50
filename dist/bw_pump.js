// bw_pump.js v0.2.0 – Gießfenster als Regelkreis: Frischmessung, Portionen mit Einsickern und Stabilisierung, Lernen im Fenster, Frist bis zum nächsten Takt
// Gießfenster (winA/winB bei Sekunde 30; Zeitraffer alle winEvery min): liest "job" von bw_main. Regelkreis (cfg4): frisch messen
// (m0 ≥ pctOk → keine Gabe "feucht", m0 > pctHi → Trockenphase "nass"), Portion pumpen, tSoak s einsickern, alle tStep s messen bis stabil
// (nStab Werte in dStab %), unter pctOk nächste Portion aus der gemessenen Wirkung, ab pctOk "ok", über pctHi "over". Grenzen: nPort
// Portionen, tMax s je Fenster, tWin s Budget, fertig vor dem nächsten bw_main-Takt. Keine Wirkung: volle Probeportion, dann noeff.
// Lernt lrn.effW und lrn.sf. Vor Portion 1 steht st.why="laeuft" im KVS (Absturz → Pause). Auftrag ohne pct oder nPort 1: eine Portion.
var VER = "0.2.0";
var DEBUG = 0;
var REQ1 = ["msSample", "lvlEmpty", "nLvl", "idLvl", "idSw", "vDry", "vWet", "vErrLo", "vErrHi", "nSample", "idV"];
var REQ3 = ["tDead", "tMin", "tMax", "jobAge", "maxDay", "tChk", "tick"];
var REQ4 = ["tWin", "tTail", "nPort", "tPmin", "tPmax", "tSoak", "tStep", "tStab", "nStab", "dStab", "tDead2", "dEffMin"];
var BAND = ["pctSoll", "pctOk", "pctHi", "effMin", "effMax", "alpha", "sfMin", "sfStep"];
var BLOCK = { noeff: 6, cfg: 5, uhr: 4, sensor: 3, wasser: 2 };
var KEYS = ["cfg1", "cfg2", "cfg3", "cfg4", "lrn", "st", "job", "day", "err"];
var RE = ["st", "day", "job", "err", "lrn"];
var K = {}, orig = {};
var c1 = null, c2 = null, c3 = null, c4 = null;
var now = 0, ram = null;
var j = null, l = null, dn = 0, ds = 0;
var B = 0, t0 = 0;
var th = null, mode = "", busy = false, rcb = null, rud = null;
var smp = [], ring = [], ri = 0, lv = [], li = 0, lvRun = 0, lvlBad = false;
var win = { n: 0, sec: 0, dpct: 0, effSec: 0, pctB: null, pctW: null, tr: null, ts: null, dur: 0 };
var P = { sec: 0, tOn: 0, pre: null, rise: null, res: "" };
var stab = { t0: 0, at: 0 };
var soak0 = 0, chk0 = 0, sec1 = 0, tMeas = 0;
var why = "", errSet = null, claimed = false, single = true;
var keys = [], gi = 0, wq = [], wi = 0;
var si = 0;
function log(s) { print("[bw_pump " + VER + "] " + s); }
function dbg(s) { if (DEBUG) print("[bw_pump dbg] " + s); }
function up() { return Shelly.getUptimeMs(); }
function el() { return Math.floor((up() - t0) / 1000); }
function rpc(m, p, cb, ud) { dbg("rpc " + m); busy = true; rcb = cb; rud = ud; Shelly.call(m, p, onRpc); }
function onRpc(r, ec, em) { busy = false; var cb = rcb; rcb = null; if (cb) cb(r, ec, em, rud); }
function stop() { rpc("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function fail(e) { log("ABBRUCH: " + (e && e.message ? e.message : e)); if (th !== null) Timer.clear(th); pumpOffSafe(); }
function pumpOffSafe() {
if (c1 && typeof c1.idSw === "number") rpc("Switch.Set", { id: c1.idSw, on: false }, onFailOff);
else stop();
}
function onFailOff() { stop(); }
function next() {
while (si < steps.length) {
var f = steps[si];
si = si + 1;
var more = false;
try { more = f(); } catch (e) { fail(e); return; }
if (more !== true) return;
}
stop();
}
function jumpTo(f) { for (var i = 0; i < steps.length; i++) { if (steps[i] === f) { si = i; break; } } }
function finish(w) { why = w; jumpTo(stepReread); return true; }
function abortErr(code, msg) { log("Störung " + code + ": " + msg); errSet = code; return finish(code); }
function isNum(x) { return typeof x === "number" && x === x; }
function obj(x) { return !!x && typeof x === "object"; }
function fromKvs(v) {
if (typeof v !== "string") return v;
var o = null;
try { o = JSON.parse(v); } catch (e) { o = null; }
return o === undefined ? null : o;
}
function r1(x) { return Math.round(x * 10) / 10; }
function r3(x) { return Math.round(x * 1000) / 1000; }
function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
function missing(o, req) {
if (!obj(o)) return req[0];
for (var i = 0; i < req.length; i++) { var v = o[req[i]]; if (v === undefined || v === null) return req[i]; }
return null;
}
function errCode() { return obj(K.err) && typeof K.err.code === "string" ? K.err.code : null; }
function setErr(code) {
var cur = errCode();
if (cur === code || cur === "noeff") return;
var cb = BLOCK[cur] || 0, nb = BLOCK[code] || 0;
if (cb > 0 && nb === 0) return;
if (cb > 0 && nb > 0 && cb > nb) return;
K.err = { code: code, ts: now, mem: ram };
}
function blockCode() { var c = errCode(); return c !== null && BLOCK[c] ? c : null; }
function readClock() {
var s = Shelly.getComponentStatus("sys");
ram = s && isNum(s.ram_free) ? s.ram_free : null;
if (!s || !isNum(s.unixtime) || typeof s.time !== "string") return false;
now = s.unixtime;
return true;
}
function levelEmpty() {
var is = Shelly.getComponentStatus("input", c1.idLvl);
if (!is || typeof is.state !== "boolean") return null;
return (is.state ? 1 : 0) === c1.lvlEmpty;
}
function swOn() { var s = Shelly.getComponentStatus("switch", c1.idSw); return s ? s.output === true : null; }
function rdV() { var s = Shelly.getComponentStatus("voltmeter", c1.idV); return s && isNum(s.voltage) ? s.voltage : null; }
function toPct(V) { return clamp((V - c1.vDry) / (c1.vWet - c1.vDry) * 100, 0, 100); }
function sortNum(a) {
for (var i = 1; i < a.length; i++) { var x = a[i]; var k = i - 1; while (k >= 0 && a[k] > x) { a[k + 1] = a[k]; k = k - 1; } a[k + 1] = x; }
return a;
}
function pctOf(arr) {
for (var i = 0; i < arr.length; i++) { if (arr[i] === null) return null; }
var V = sortNum(arr.slice())[Math.floor(arr.length / 2)];
return V < c1.vErrLo || V > c1.vErrHi ? null : toPct(V);
}
function ringAt(k) { return ring[(ri - 1 - k) % c4.nStab]; }
function ringMean() { var n = ri < c4.nStab ? ri : c4.nStab, s = 0; for (var i = 0; i < n; i++) s = s + ringAt(i); return s / n; }
function stabil() {
if (ri < c4.nStab) return false;
var lo = ringAt(0), hi = lo;
for (var i = 1; i < c4.nStab; i++) { var x = ringAt(i); if (x < lo) lo = x; if (x > hi) hi = x; }
var tr = ringAt(0) - ringAt(c4.nStab - 1);
return hi - lo <= c4.dStab && (tr < 0 ? -tr : tr) <= c4.dStab / 2;
}
function end(w) { why = w; mode = "done"; }
function offThen(cb) { mode = "wait"; rpc("Switch.Set", { id: c1.idSw, on: false }, cb); }
function stepRead() { t0 = up(); K = {}; keys = KEYS; gi = 0; getNext(); }
function getNext() {
if (gi >= keys.length) return true;
var k = keys[gi];
gi = gi + 1;
rpc("KVS.Get", { key: k }, onGet, k);
}
function onGet(r, ec, em, k) {
if (ec === 0 && r) K[k] = fromKvs(r.value);
if (getNext()) next();
}
function stepCfg() {
c1 = K.cfg1; c2 = K.cfg2; c3 = K.cfg3; c4 = K.cfg4;
readClock();
var miss = missing(c1, REQ1);
if (miss !== null) return abortErr("cfg", "cfg1." + miss + " fehlt");
miss = missing(c3, REQ3);
if (miss !== null) return abortErr("cfg", "cfg3." + miss + " fehlt");
miss = missing(c4, REQ4);
if (miss !== null) return abortErr("cfg", "cfg4." + miss + " fehlt");
if (!(c1.nLvl >= 1) || !(c1.msSample >= 1) || !(c3.tChk >= 1) || !(c1.nSample >= 1)) return abortErr("cfg", "Werte < 1");
if (!readClock()) return abortErr("uhr", "Uhrzeit nicht gesetzt");
single = missing(c2, BAND) !== null;
tMeas = c4.tSoak + c4.nStab * c4.tStep;
return true;
}
function stepCheck() {
var job = K.job, s = K.st;
if (!obj(job) || job.ok !== true) { log("kein Auftrag"); return finish("kein_auftrag"); }
if (obj(s) && s.why === "laeuft" && isNum(s.ts) && now - s.ts < c3.jobAge * 60) { log("Fenster abgebrochen (laeuft) – kein Auftrag"); return finish("kein_auftrag"); }
if (!isNum(job.ts) || now - job.ts > c3.jobAge * 60) return abortErr("alt", "Auftrag zu alt");
var blk = blockCode();
if (blk !== null) { log("Störung " + blk + " steht – keine Gabe"); return finish("err:" + blk); }
dn = obj(K.day) && isNum(K.day.n) ? K.day.n : 0;
ds = obj(K.day) && isNum(K.day.sec) ? K.day.sec : 0;
if (dn >= c3.maxDay) return abortErr("limit", "Tageslimit " + c3.maxDay);
if (!isNum(job.sec) || job.sec < 1) return finish("kein_auftrag");
if (!isNum(job.pct) || !(c4.nPort > 1)) single = true;
var q = now % (c3.tick * 60);
B = c3.tick * 60 - q - c4.tTail;
if (c4.tWin < B) B = c4.tWin;
j = { sec: job.sec, pct: isNum(job.pct) ? job.pct : null, ts: job.ts };
l = { effW: obj(K.lrn) && isNum(K.lrn.effW) ? K.lrn.effW : null, sf: obj(K.lrn) && isNum(K.lrn.sf) ? K.lrn.sf : 0.7 };
K = {}; orig = {};
log("Fenster: Auftrag " + j.sec + " s, pct " + j.pct + (single ? ", Einzelportion" : ", effW " + l.effW + " sf " + l.sf) + ", Frist " + B + " s");
return true;
}
function stepWin() {
mode = swOn() === true ? "off0" : (single ? "lv" : "m0");
P.sec = single ? clamp(j.sec, 1, c4.tPmax < c3.tMax ? c4.tPmax : c3.tMax) : 0;
th = Timer.set(c1.msSample, true, onTick);
}
function onTick() {
if (busy) return;
try {
if (mode === "m0") tickM0();
else if (mode === "lv") tickLv();
else if (mode === "cl") rpc("KVS.Set", { key: "st", value: JSON.stringify(claimSt()) }, onClaim);
else if (mode === "on") tickOn();
else if (mode === "pu") tickPu();
else if (mode === "so") tickSo();
else if (mode === "st") tickSt();
else if (mode === "off0") offThen(onOff0);
else if (mode === "done") { Timer.clear(th); th = null; next(); }
} catch (e) { fail(e); }
}
function onOff0() { log("Ausgang war EIN – Ende (extern)"); end("extern"); }
function tickM0() {
smp.push(rdV());
if (smp.length < c1.nSample) return;
var pct = pctOf(smp);
smp = [];
if (pct === null) { errSet = "sensor"; log("Sensor unplausibel"); end("sensor"); return; }
win.pctB = r1(pct);
if (pct > c2.pctHi) { log("m0 " + win.pctB + " % > pctHi – nass"); end("nass"); return; }
if (pct >= c2.pctOk) { log("m0 " + win.pctB + " % ≥ pctOk – feucht"); end("feucht"); return; }
var cap = c4.tPmax < c3.tMax ? c4.tPmax : c3.tMax;
if (c3.maxDay * c3.tMax - ds < cap) cap = c3.maxDay * c3.tMax - ds;
if (cap < c3.tMin) { log("Tagesvorrat aufgebraucht"); end("max"); return; }
sec1 = clamp(Math.round(j.sec), c3.tMin, cap);
if (el() + sec1 + tMeas > B) { log("Frist zu kurz für P1 " + sec1 + " s"); end("zeit"); return; }
P.sec = sec1;
log("m0 " + win.pctB + " % → P1 " + sec1 + " s");
mode = "lv"; li = 0; lv = [];
}
function tickLv() {
lv[li % c1.nLvl] = levelEmpty();
li = li + 1;
if (li < c1.nLvl) return;
var same = true, v0 = lv[0];
for (var i = 0; i < c1.nLvl; i++) { if (lv[i] === null || lv[i] !== v0) same = false; }
if (!same) { if (li >= c1.nLvl * 4) { log("Wasserstand unstabil"); end(win.n ? "wasser" : "lvl"); } return; }
if (v0 === true) { errSet = "wasser"; log("Behälter leer"); end("wasser"); return; }
mode = claimed || single ? "on" : "cl";
}
function claimSt() {
return { state: "sperre", ts: now, dur: 0, n: 0, sec: 0, pctB: win.pctB, pctW: null, pctA: null, effW: null, why: "laeuft", tr: null, rated: true, dryOk: true };
}
function onClaim(r, ec, em) {
if (ec !== 0) { log("Claim fehlgeschlagen: " + em); end("kvs"); return; }
claimed = true;
readClock();
win.ts = now;
mode = "on";
}
function tickOn() {
mode = "wait";
rpc("Switch.Set", { id: c1.idSw, on: true, toggle_after: P.sec }, onSwitchOn);
}
function onSwitchOn(res, ec, em) {
if (ec !== 0) { log("Switch.Set ein: " + em); end("switch"); return; }
if (res && res.was_on === true) { offThen(onOff0); return; }
readClock();
if (win.ts === null) win.ts = now;
win.n = win.n + 1;
P.tOn = up(); P.rise = null; P.res = ""; chk0 = P.tOn;
P.pre = win.n === 1 ? win.pctB : win.pctW;
mode = "pu";
}
function tickPu() {
if (up() - chk0 < c3.tChk * 1000) return;
chk0 = up();
var t = Math.floor((up() - P.tOn) / 1000);
if (levelEmpty() === true) { endPortion("abbruch", t); return; }
if (swOn() === false && t < P.sec) { endPortion("extern", t); return; }
if (P.rise === null) { var V = rdV(); if (V !== null && toPct(V) >= P.pre + c4.dStab) P.rise = t; }
if (t >= P.sec) endPortion("ok", P.sec);
}
function endPortion(res, actual) {
P.res = res;
win.sec = win.sec + actual;
readClock();
win.dur = now - win.ts;
mode = "wait";
rpc("Switch.Set", { id: c1.idSw, on: false }, onPortionOff, actual);
}
function onPortionOff(res, ec, em, actual) {
if (ec !== 0) log("Switch.Set aus: " + em);
if (P.res !== "ok") { log("P" + win.n + " " + P.res + " nach " + actual + " s"); if (P.res === "abbruch") errSet = "wasser"; end(P.res); return; }
if (single) { log("P1 aus: ok nach " + actual + " s"); end("ok"); return; }
if (win.n === 2 && P.rise !== null) win.tr = P.rise;
var e = P.sec - (win.n === 1 ? c3.tDead : c4.tDead2);
if (e > 0) win.effSec = win.effSec + e;
soak0 = up(); chk0 = soak0; lvRun = 0;
mode = "so";
}
function chkLevel() {
if (up() - chk0 < c3.tChk * 1000) return;
chk0 = up();
lvRun = levelEmpty() === true ? lvRun + 1 : 0;
if (lvRun >= c1.nLvl) lvlBad = true;
}
function tickSo() {
chkLevel();
if (up() - soak0 < c4.tSoak * 1000) return;
ri = 0; ring = []; smp = [];
stab.t0 = up(); stab.at = stab.t0;
mode = "st";
}
function tickSt() {
chkLevel();
if (up() >= stab.at) {
smp.push(rdV());
if (smp.length >= c1.nSample) {
var pct = pctOf(smp);
smp = [];
if (pct === null) { errSet = "sensor"; log("Sensor unplausibel"); end("sensor"); return; }
ring[ri % c4.nStab] = pct;
ri = ri + 1;
stab.at = stab.at + c4.tStep * 1000;
dbg("ring " + ri + " " + r1(pct));
}
}
var tEl = Math.floor((up() - stab.t0) / 1000);
if ((ri >= c4.nStab && stabil()) || tEl >= c4.tStab || el() >= B) decide(tEl);
}
function decide(tEl) {
if (ri === 0) { end("unstab"); return; }
var ok = stabil(), pctNow = ok ? ringAt(0) : ringMean();
var trUp = ri >= c4.nStab && ringAt(0) - ringAt(c4.nStab - 1) > c4.dStab / 2;
var delta = pctNow - P.pre;
win.pctW = r1(pctNow);
win.dpct = pctNow - win.pctB;
var g = win.effSec > 0 ? win.dpct / win.effSec : 0;
log("P" + win.n + " " + P.sec + "s: " + r1(P.pre) + "→" + win.pctW + " (" + r1(delta) + ", g " + r3(g) + ", tRise " + P.rise + ", " + (ok ? "stabil " : "unstabil ") + tEl + "s)");
if (!ok && trUp) { end("unstab"); return; }
if (pctNow > c2.pctHi) { end("over"); return; }
if (pctNow >= c2.pctOk) { end("ok"); return; }
var cap = c4.tPmax;
if (c3.tMax - win.sec < cap) cap = c3.tMax - win.sec;
if (c3.maxDay * c3.tMax - ds - win.sec < cap) cap = c3.maxDay * c3.tMax - ds - win.sec;
var secK;
if (delta < c4.dStab) {
if (win.n === 1) { secK = Math.round(clamp(sec1, c4.tPmin, cap)); log("keine Wirkung: Probeportion " + secK + " s"); }
else if (win.n === 2 && win.dpct < c4.dEffMin) { errSet = "noeff"; log("Störung noeff: ΣΔ " + r1(win.dpct) + " % nach 2 Portionen – von Hand löschen"); end("noeff"); return; }
else { end("stall"); return; }
} else {
if (lvlBad) { errSet = "wasser"; log("Behälter leer in der Wartephase"); end("wasser"); return; }
var gK = g > c2.effMin ? g : c2.effMin;
var tgt = pctNow + (c2.pctHi - pctNow) / 2;
if (tgt > c2.pctSoll) tgt = c2.pctSoll;
var raw = (tgt - pctNow) / gK + c4.tDead2;
if (raw < c4.tPmin && pctNow >= c2.pctOk - c4.dStab) { end("ok"); return; }
secK = Math.round(clamp(raw, c4.tPmin, cap));
}
if (win.n >= c4.nPort || cap < c4.tPmin || !isNum(secK)) { log("Grenze erreicht"); end("max"); return; }
if (el() + secK + tMeas > B) { log("Frist: Rest " + (B - el()) + " s"); end("zeit"); return; }
P.sec = secK; lvlBad = false; li = 0; lv = [];
mode = "lv";
}
function stepReread() { K = {}; keys = RE; gi = 0; getNext(); }
function stepResult() {
readClock();
for (var i = 0; i < RE.length; i++) orig[RE[i]] = JSON.stringify(K[RE[i]]);
if (!obj(K.err)) K.err = { code: null, ts: null, mem: null };
if (!obj(K.day)) K.day = { date: null, n: 0, sec: 0 };
if (!obj(K.lrn)) K.lrn = { effW: null, sf: 0.7, rate: null, tMean: null, tMaxD: null, tMaxY: null };
var regular = " ok over max zeit stall unstab ".indexOf(" " + why + " ") >= 0 || (why === "wasser" && P.res === "ok");
if (errSet !== null) setErr(errSet);
if (why === "nass") {
var c = claimSt(); c.why = "nass"; c.dryOk = false; K.st = c;
} else if (win.n > 0) {
var effNew = null;
if (!single && win.effSec > 0 && (regular || why === "abbruch" || why === "extern")) {
effNew = clamp(win.dpct / win.effSec, c2.effMin, c2.effMax);
K.lrn.effW = r3(l.effW === null ? effNew : (1 - c2.alpha) * l.effW + c2.alpha * effNew);
var sf = isNum(K.lrn.sf) ? K.lrn.sf : l.sf;
if (why === "over" && win.n === 1) sf = sf - c2.sfStep;
if (why === "ok" && win.n >= 2 && isNum(c2.sfUp)) sf = sf + c2.sfUp;
K.lrn.sf = r3(clamp(sf, c2.sfMin, 1));
effNew = r3(effNew);
}
K.st = { state: regular ? "gegossen" : "sperre", ts: win.ts, dur: win.dur, n: win.n, sec: win.sec, pctB: win.pctB, pctW: win.pctW, pctA: null, effW: effNew, why: why, tr: win.tr, rated: !regular, dryOk: true };
K.day.n = K.day.n + 1;
K.day.sec = K.day.sec + win.sec;
}
if (why !== "kein_auftrag" && obj(K.job)) K.job = { ok: false, sec: K.job.sec, pct: j !== null && j.pct === null ? win.pctB : K.job.pct, why: why, ts: K.job.ts };
return true;
}
function stepWrite() {
wq = [];
for (var i = 0; i < RE.length; i++) { if (JSON.stringify(K[RE[i]]) !== orig[RE[i]]) wq.push(RE[i]); }
wi = 0;
return writeNext();
}
function writeNext() {
if (wi >= wq.length) return true;
var k = wq[wi];
wi = wi + 1;
rpc("KVS.Set", { key: k, value: JSON.stringify(K[k]) }, onWrite, k);
}
function onWrite(res, ec, em, k) {
if (ec !== 0) log("KVS.Set " + k + ": " + em);
if (writeNext()) next();
}
function stepDone() {
log("ergebnis=" + why + " n=" + win.n + " sec=" + win.sec + " dur=" + win.dur + " pct=" + win.pctB + "→" + win.pctW + " effW=" + K.lrn.effW + " sf=" + K.lrn.sf + " day.n=" + K.day.n + " err=" + errCode() + " w=" + wq.length + " dauer=" + (up() - t0));
return true;
}
var steps = [stepRead, stepCfg, stepCheck, stepWin, stepReread, stepResult, stepWrite, stepDone];
dbg("start");
next();
