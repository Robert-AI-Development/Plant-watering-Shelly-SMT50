// bw_install.js v0.1.3 – Installer: KVS-Startwerte (cfg1..4), Zeitplan mit Fenster-Budget, Script- und Switch-Konfiguration; Rückkehr aus dem Zeitraffer
// Installer (von Hand starten, wiederholbar): legt fehlende KVS-Einträge und Felder an, baut den Zeitplan aus cfg3 (tick, winEvery,
// winA/winB; bw_pump startet bei Sekunde 30, nie neben bw_main; Sicherheits-Aus 30+tWin+10 s nach dem Fenster), auto_off = tMax+10 s.
// Nach Änderung von tick, winEvery, winA/winB, tMax, tWin, tTail erneut starten; bricht ab, solange bw_main/bw_pump läuft. Zeitraffer beenden: starten.
// --- cfg1 Sensor und Kalibrierung ---
// vDry 0.20 V = 0 % (Sensor in Luft) · vWet 3.13 V = 100 % (Sensor im Wasser) – misst bw_hwtest
// vErrLo 0.10 / vErrHi 3.35 V: außerhalb Sensor defekt → Störung sensor, keine Gabe
// nSample 5 Messungen je Takt alle msSample 500 ms (Mittel ohne Ausreißer) · nLvl 3 gleiche Wasserstand-Lesungen
// lvlEmpty 1 = Eingang bei LEER · idV/idT 100, idLvl 1, idSw 0 = Komponenten (Voltmeter, Fühler, Schwimmer, Pumpe)
// --- cfg2 Zielband (null = offen → nur messen); Ordnung pctDry < pctLo < pctOk <= pctSoll < pctHi ---
// pctLo: darunter Gießauftrag (WANN) · pctOk: Ziel erreicht, keine weitere Portion · pctSoll: Zielpunkt der Dosis (WIE VIEL)
// pctHi: darüber "zu viel" (Dosis sinkt) bzw. nass → Trockenphase · pctDry: deren Ende · hyst 2 %: Auftrag hält bis pctLo+hyst
// dropSlow %/24 h: trocknet langsamer → pauseSlow · dropW % Einbruch bis zur Kontrolle (null = aus) · effMin/effMax, alpha, sfMin, sfStep, sfUp: Lernen
// --- cfg3 Pumpe und Zeiten ---
// tick 15 min Takt bw_main · winA 08:00 / winB 20:00 Gießfenster · winEvery null (N = Fenster alle N min, Zeitraffer)
// tDead 20 s Schlauch füllen · tMin 25 s kleinste Erstportion · tStd 70 s allererste Gabe · tMax 180 s Summe je Fenster
// pause 24 h nach jeder Gabe · pauseHot 12 h bei Tagesmaximum über tHot 35 °C · pauseSlow 48 h · dryDay 5 = Freitag Trockentag (null = nie)
// soak 30 min bis zur Kontrolle · jobAge 20 min Höchstalter des Auftrags im Fenster · maxDay 2 Gaben je Tag · tChk 5 s Wasserstand
// --- cfg4 Fenster-Regelkreis (bw_pump) ---
// tWin 420 s Budget je Fenster · tTail 20 s Reserve vor dem nächsten Takt · nPort 6 Portionen je Fenster (1 = Einzelportion)
// tPmin 10 / tPmax 120 s je Portion · tSoak 20 s einsickern · tStep 5 s, tStab 60 s, nStab 4, dStab 1 %: stabil · tDead2 8 s · dEffMin 2 % sonst noeff
// Zustand (schreiben die Scripts): lrn (effW, sf 0.7) · st · job · day · err (README "Störungen")
// Zeitraffer (bw_zeitraffer): zrb1..5 sichern cfg3 / lrn,day / st,err / cfg4 / cfg2, zr = Startmarke; ohne zr Rückbau.
var VER = "0.1.3";
var DEBUG = 0;
var NAME_MAIN = "bw_main";
var NAME_PUMP = "bw_pump";
var PUMP_SEC = 30;
var SAFE_MIN = 0;
var CRETRY_MAX = 3;
var CRETRY_MS = 400;
var cRetry = 0;
var DEF = {
cfg1: { vDry: 0.20, vWet: 3.13, vErrLo: 0.10, vErrHi: 3.35, nSample: 5, msSample: 500, lvlEmpty: 1, nLvl: 3, idV: 100, idT: 100, idLvl: 1, idSw: 0 },
cfg2: { pctSoll: null, pctLo: null, pctHi: null, pctDry: null, hyst: 2, dropSlow: null, effMin: 0.05, effMax: 30, alpha: 0.3, sfMin: 0.5, sfStep: 0.1, pctOk: null, dropW: null, sfUp: 0.05 },
cfg3: { tDead: 20, tMin: 25, tStd: 70, tMax: 180, tHot: 35, pauseHot: 12, pause: 24, pauseSlow: 48, soak: 30, jobAge: 20, maxDay: 2, tChk: 5, winA: "08:00", winB: "20:00", tick: 15, winEvery: null, dryDay: 5 },
cfg4: { tWin: 420, tTail: 20, nPort: 6, tPmin: 10, tPmax: 120, tSoak: 20, tStep: 5, tStab: 60, nStab: 4, dStab: 1, tDead2: 8, dEffMin: 2 },
lrn: { effW: null, sf: 0.7, rate: null, tMean: null, tMaxD: null, tMaxY: null },
st: { state: "beob", ts: null, sec: null, pctB: null, pctA: null, rated: false, dryOk: false },
job: { ok: false, sec: null, pct: null, why: "init", ts: null },
day: { date: null, n: 0, sec: 0 },
err: { code: null, ts: null, mem: null }
};
var ORDER = ["cfg1", "cfg2", "cfg3", "cfg4", "lrn", "st", "job", "day", "err"];
var STATE = ["lrn", "st", "day", "err"];
var K = {};
var newKeys = [];
var wq = [];
var wi = 0;
var ids = { self: 0, main: null, pump: null };
var idSw = 0;
var c3 = null;
var c4 = null;
var delq = [];
var di = 0;
var crq = [];
var ci = 0;
var created = [];
var scq = [];
var sci = 0;
var kq = [];
var ki = 0;
var mode = "normal";
var si = 0;
function log(s) { print("[bw_install " + VER + "] " + s); }
function dbg(s) { if (DEBUG) print("[bw_install dbg] " + s); }
function rpc(m, p, cb, ud) { dbg("rpc " + m + " " + JSON.stringify(p)); Shelly.call(m, p, cb, ud); }
function stop() { rpc("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function fail(msg) { log("ABBRUCH: " + msg); stop(); }
function failErr(msg) {
log("ABBRUCH: " + msg);
var sys = Shelly.getComponentStatus("sys");
var e = { code: "cfg", ts: sys ? sys.unixtime : null, mem: sys ? sys.ram_free : null };
rpc("KVS.Set", { key: "err", value: JSON.stringify(e) }, onFailWritten);
}
function onFailWritten() { stop(); }
function next() {
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
function obj(x) { return !!x && typeof x === "object"; }
function fromKvs(v) {
if (typeof v !== "string") return v;
var o = null;
try { o = JSON.parse(v); } catch (e) { o = null; }
return o === undefined ? null : o;
}
function hhmm(s) {
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
function specs(sec, a, b) {
if (a.m === b.m) {
var h1 = a.h < b.h ? a.h : b.h;
var h2 = a.h < b.h ? b.h : a.h;
return [sec + " " + a.m + " " + (h1 === h2 ? h1 : h1 + "," + h2) + " * * *"];
}
return [sec + " " + a.m + " " + a.h + " * * *", sec + " " + b.m + " " + b.h + " * * *"];
}
function everySpec(sec, n) {
return sec + " " + (n === 1 ? "*" : "*/" + n) + " * * * *";
}
function listSpec(sec, m0, n) {
var l = [];
for (var m = m0; m < 60; m = m + n) l.push(m);
return sec + " " + l.join(",") + " * * * *";
}
function winFit(m, t, tWin, tTail) {
return (m % t) * 60 + PUMP_SEC + tWin + tTail <= t * 60;
}
function stepRead() { kvsPage(0); }
function kvsPage(off) { rpc("KVS.GetMany", { match: "*", offset: off }, onKvsPage, off); }
function onKvsPage(res, ec, em, off) {
if (ec !== 0) { fail("KVS.GetMany: " + em); return; }
var items = res && res.items ? res.items : [];
for (var i = 0; i < items.length; i++) K[items[i].key] = fromKvs(items[i].value);
var total = res && isNum(res.total) ? res.total : 0;
if (items.length > 0 && off + items.length < total) { kvsPage(off + items.length); return; }
if (DEBUG) { var dk = Object.keys(K); for (var d = 0; d < dk.length; d++) dbg("kvs " + dk[d] + " " + typeof K[dk[d]] + " " + JSON.stringify(K[dk[d]])); }
next();
}
function stepScripts() {
ids.self = Shelly.getCurrentScriptId();
rpc("Script.List", {}, onScriptList);
}
function onScriptList(res, ec, em) {
if (ec !== 0) { fail("Script.List: " + em); return; }
var list = res && res.scripts ? res.scripts : [];
for (var i = 0; i < list.length; i++) {
var s = list[i];
if (s.name === NAME_MAIN) ids.main = s.id;
if (s.name === NAME_PUMP) ids.pump = s.id;
if (s.running === true && (s.name === NAME_MAIN || s.name === NAME_PUMP)) { failErr("Script " + s.name + " läuft – später erneut starten"); return; }
}
if (ids.main === null || ids.pump === null) {
failErr("Script " + (ids.main === null ? NAME_MAIN : NAME_PUMP) + " nicht gefunden");
return;
}
log("Script-IDs: install=" + ids.self + " main=" + ids.main + " pump=" + ids.pump);
next();
}
function stepZr() {
if (!obj(K.zrb1)) return true;
if (obj(K.zr)) { mode = "zeitraffer"; kq = ["zr"]; return true; }
mode = "rueckkehr";
if (obj(K.zrb1.cfg3)) { K.cfg3 = K.zrb1.cfg3; wq.push("cfg3"); }
var bs = [K.zrb2, K.zrb3];
for (var b = 0; b < bs.length; b++) {
if (!obj(bs[b])) continue;
for (var s = 0; s < STATE.length; s++) { if (obj(bs[b][STATE[s]])) { K[STATE[s]] = bs[b][STATE[s]]; wq.push(STATE[s]); } }
}
if (obj(K.zrb4) && obj(K.zrb4.cfg4)) { K.cfg4 = K.zrb4.cfg4; wq.push("cfg4"); }
if (obj(K.zrb5) && obj(K.zrb5.cfg2)) { K.cfg2 = K.zrb5.cfg2; wq.push("cfg2"); }
K.job = DEF.job;
wq.push("job");
kq = ["zrb1", "zrb2", "zrb3", "zrb4", "zrb5"];
if (obj(K.zr)) kq.push("zr");
log("Zeitraffer beenden: Original aus zrb1..5 zurück: " + wq.join(","));
return true;
}
function stepDefaults() {
for (var i = 0; i < ORDER.length; i++) {
var k = ORDER[i];
if (K[k] === undefined || K[k] === null) { K[k] = DEF[k]; wq.push(k); newKeys.push(k); }
else if (typeof K[k] !== "object") { log("KVS " + k + " kein Objekt, neu angelegt"); K[k] = DEF[k]; wq.push(k); newKeys.push(k); }
else {
var fk = Object.keys(DEF[k]), add = [];
for (var f = 0; f < fk.length; f++) { if (K[k][fk[f]] === undefined) { K[k][fk[f]] = DEF[k][fk[f]]; add.push(fk[f]); } }
if (add.length > 0) { if (wq.indexOf(k) < 0) wq.push(k); log("KVS " + k + " ergänzt: " + add.join(",")); }
}
}
if (!isNum(K.cfg1.idSw)) { failErr("cfg1.idSw fehlt oder ist keine Zahl"); return; }
if (!isNum(K.cfg3.tMax)) { failErr("cfg3.tMax fehlt oder ist keine Zahl"); return; }
var a = hhmm(K.cfg3.winA), b = hhmm(K.cfg3.winB);
if (!a || !b) { failErr("cfg3.winA/winB ungültig, Format HH:MM"); return; }
var t = K.cfg3.tick, e = K.cfg3.winEvery, tw = K.cfg4.tWin, tt = K.cfg4.tTail;
if (!isNum(t) || !(t >= 1) || t !== Math.floor(t) || 60 % t !== 0) { failErr("cfg3.tick muss ein Teiler von 60 sein"); return; }
if (!isNum(tw) || !isNum(tt) || tw < 0 || tt < 0) { failErr("cfg4.tWin/tTail fehlen"); return; }
var rule = ": " + PUMP_SEC + " + tWin " + tw + " + tTail " + tt + " s passen nicht in den Takt (tick " + t + " min)";
if (e !== null && e !== undefined) {
if (!isNum(e) || !(e >= 1) || e !== Math.floor(e) || 60 % e !== 0) { failErr("cfg3.winEvery muss null oder ein Teiler von 60 sein"); return; }
for (var m = 0; m < 60; m = m + e) { if (!winFit(m, t, tw, tt)) { failErr("Zeitraffer-Fenster Minute " + m + rule); return; } }
if (!(PUMP_SEC + tw + 10 < e * 60)) { failErr("cfg4.tWin " + tw + ": Sicherheits-Aus " + PUMP_SEC + "+tWin+10 s liegt nicht vor dem nächsten Fenster (winEvery " + e + " min)"); return; }
} else {
var w = [["winA", a.m], ["winB", b.m]];
for (var v = 0; v < 2; v++) { if (!winFit(w[v][1], t, tw, tt)) { failErr("cfg3." + w[v][0] + " " + K.cfg3[w[v][0]] + rule); return; } }
}
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
function stepKvsDel() { ki = 0; return kdNext(); }
function kdNext() {
if (ki >= kq.length) return true;
var k = kq[ki];
ki = ki + 1;
rpc("KVS.Delete", { key: k }, onKdel, k);
}
function onKdel(res, ec, em, k) {
if (ec !== 0 && ec !== -105) log("KVS.Delete " + k + ": " + em);
if (kdNext()) next();
}
function isOwn(job) {
var calls = job.calls || [];
for (var i = 0; i < calls.length; i++) {
var c = calls[i];
var p = c.params || {};
if (c.method === "Script.Start" && (p.id === ids.main || p.id === ids.pump)) return true;
if (c.method === "Switch.Set" && p.id === idSw) return true;
}
return false;
}
function stepSchedList() {
idSw = K.cfg1.idSw;
c3 = K.cfg3;
c4 = K.cfg4;
K = {};
rpc("Schedule.List", {}, onSchedList);
}
function onSchedList(res, ec, em) {
if (ec !== 0) { fail("Schedule.List: " + em); return; }
var jobs = res && res.jobs ? res.jobs : [];
delq = [];
for (var i = 0; i < jobs.length; i++) { if (isOwn(jobs[i])) delq.push(jobs[i].id); }
log("Zeitplan: " + jobs.length + " Einträge, davon eigene: " + delq.length);
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
function stepSchedCreate() {
var safeSec = PUMP_SEC + c4.tWin + 10;
SAFE_MIN = Math.floor((safeSec + 59) / 60);
crq = [{ timespec: everySpec(0, c3.tick), calls: [{ method: "Script.Start", params: { id: ids.main } }] }];
if (isNum(c3.winEvery)) {
crq.push({ timespec: everySpec(PUMP_SEC, c3.winEvery), calls: [{ method: "Script.Start", params: { id: ids.pump } }] });
crq.push({ timespec: listSpec(safeSec % 60, Math.floor(safeSec / 60), c3.winEvery), calls: [{ method: "Switch.Set", params: { id: idSw, on: false } }] });
} else {
var a = hhmm(c3.winA);
var b = hhmm(c3.winB);
var sp = specs(PUMP_SEC, a, b);
for (var i = 0; i < sp.length; i++) crq.push({ timespec: sp[i], calls: [{ method: "Script.Start", params: { id: ids.pump } }] });
var ss = specs(0, addMin(a, SAFE_MIN), addMin(b, SAFE_MIN));
for (var j = 0; j < ss.length; j++) crq.push({ timespec: ss[j], calls: [{ method: "Switch.Set", params: { id: idSw, on: false } }] });
}
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
if (ec !== 0 && cRetry < CRETRY_MAX) {
cRetry = cRetry + 1;
var msg = "Schedule.Create '" + ts + "' abgelehnt (" + em + "), Versuch " + cRetry + "/" + CRETRY_MAX;
if (cRetry === 1) dbg(msg); else log("Hinweis: " + msg);
Timer.set(CRETRY_MS, false, sendCreate);
return;
}
if (ec !== 0) log("Schedule.Create '" + ts + "': " + em);
else created.push({ id: res.id, timespec: ts });
ci = ci + 1;
if (createNext()) next();
}
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
function stepSwitchCfg() {
var cfg = { initial_state: "off", auto_off: true, auto_off_delay: c3.tMax + 10 };
rpc("Switch.SetConfig", { id: idSw, config: cfg }, onSwitchCfg);
}
function onSwitchCfg(res, ec, em) {
if (ec !== 0) log("Switch.SetConfig: " + em);
else log("Switch " + idSw + ": auto_off " + (c3.tMax + 10) + " s");
next();
}
function stepDone() {
log("KVS neu angelegt: " + (newKeys.length ? newKeys.join(", ") : "keine"));
for (var i = 0; i < created.length; i++) log("Zeitplan #" + created[i].id + ": " + created[i].timespec);
var s = "fertig – " + (isNum(c3.winEvery) ? "ZEITRAFFER aktiv: " : "") + "bw_main alle " + c3.tick + " min, bw_pump ";
if (isNum(c3.winEvery)) s = s + "alle " + c3.winEvery + " min (Sekunde " + PUMP_SEC + "), Budget " + c4.tWin + " s, bis " + c4.nPort + " Portionen, Sicherheits-Aus " + (PUMP_SEC + c4.tWin + 10) + " s nach der Fensterminute; zurück: bw_install starten";
else s = s + "um " + c3.winA + " und " + c3.winB + " (Sekunde " + PUMP_SEC + "), Budget tWin " + c4.tWin + " s, Sicherheits-Aus " + SAFE_MIN + " min danach" + (mode === "rueckkehr" ? " – Zeitraffer beendet" : "");
log(s);
return true;
}
var steps = [stepRead, stepScripts, stepZr, stepDefaults, stepKvsDel, stepSchedList, stepSchedDelete, stepSchedCreate, stepScriptCfg, stepSwitchCfg, stepDone];
dbg("start");
next();
