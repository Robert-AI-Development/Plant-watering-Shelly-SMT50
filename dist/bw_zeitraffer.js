// bw_zeitraffer.js v0.2.0 – Praxistest im Zeitraffer: Betriebswerte sichern, kurze Zeiten und Fenster-Regelkreis schreiben, bw_install baut den Zeitplan
// Zeitraffer = dieselben Betriebs-Scripts (bw_main, bw_pump), nur mit kurzen Zeiten: Takt 3 min, Gießfenster alle 6 min (Pumpe bei
// Sekunde 30), Fenster-Budget 120 s, bis 3 Portionen mit echtem Lernen (Schlauch AM Sensor), Trockenphase aus (pctDry = pctLo−1, dryDay null).
// Start (nur von Hand, am besten: node tools/hwtest.js <ip> zeitraffer): sichert cfg3 / lrn,day / st,err / cfg4 / cfg2 nach zrb1..5,
// schreibt die Profile (cfg3, cfg4, cfg2.pctDry), setzt lrn/st/day/job/err frisch, setzt die Marke zr und startet bw_install (Zeitplan, auto_off).
// Zurück zum Normalbetrieb: bw_install starten (node tools/hwtest.js <ip> normal) – ohne Marke zr schreibt er das Original zurück.
// Profil cfg3 (Normal → Zeitraffer): tick 15→3 min · winEvery null→6 · soak 30→0.25 min · pauseHot 12→0.1 h (Fenster 6 min nach der Gabe)
// pause 24→0.2 h (12 min) · pauseSlow 48→0.35 h · jobAge 20→5 min · maxDay 2→4 · tDead 20→2 s · tMin 25→10 · tStd 70→12 · tMax 180→40 s
// tChk 5→1 s · tHot 35→30 °C (Handwärme reicht). cfg4: tWin 120, tTail 20, nPort 3, tPmin 10, tPmax 15, tSoak 10, tStab 30, nStab 3, tDead2 0, dEffMin 1.
// Fahrplan (Minute ab Start S, S = volle 6er-Minute; README "Praxistest im Zeitraffer"): vor 0 Sensor im Wasserglas → 0 why=trocken (nass) ·
// 3 Sensor in trockene Erde → 6:30 FENSTER 1 · 9 Kontrolle, why=pause · 9–14 Sensor zurück in trockene Erde → 15 why=ok, 18:30 FENSTER 2 ·
// 19 Fühler > tHot, Sensor trocken → 21 pause 0.1 h, 24:30 FENSTER 3 · 25 Schwimmer LEER → 27 why=wasser · 31 VOLL, Sensor trocken →
// 36:30 FENSTER 4 · 39 why=limit · 40 normal (Rückbau, zrb1..5/zr weg). Sicherheits-Aus Minute ≡ 2 mod 6 bei Sekunde 40.
var VER = "0.2.0";
var DEBUG = 0;
var NAME_INSTALL = "bw_install";
var BUSY = ["bw_install", "bw_main", "bw_pump", "bw_hwtest", "bw_hwpump"];
var ZR3 = {
tick: 3,
winEvery: 6,
soak: 0.25,
pauseHot: 0.1,
pause: 0.2,
pauseSlow: 0.35,
jobAge: 5,
maxDay: 4,
tDead: 2,
tMin: 10,
tStd: 12,
tMax: 40,
tChk: 1,
tHot: 30,
dryDay: null
};
var ZR4 = {
tWin: 120,
tTail: 20,
nPort: 3,
tPmin: 10,
tPmax: 15,
tSoak: 10,
tStep: 5,
tStab: 30,
nStab: 3,
dStab: 1,
tDead2: 0,
dEffMin: 1
};
var ZR_DRY = 1;
var DEF = {
lrn: { effW: null, sf: 0.7, rate: null, tMean: null, tMaxD: null, tMaxY: null },
st: { state: "beob", ts: null, sec: null, pctB: null, pctA: null, rated: false, dryOk: false },
job: { ok: false, sec: null, pct: null, why: "init", ts: null },
day: { date: null, n: 0, sec: 0 },
err: { code: null, ts: null, mem: null }
};
var K = {};
var wq = [], wi = 0;
var idInstall = null;
var si = 0;
function log(s) { print("[bw_zeitraffer " + VER + "] " + s); }
function dbg(s) { if (DEBUG) print("[bw_zeitraffer dbg] " + s); }
function rpc(m, p, cb, ud) { dbg("rpc " + m + " " + JSON.stringify(p)); Shelly.call(m, p, cb, ud); }
function stop() { rpc("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function fail(msg) { log("ABBRUCH: " + msg); stop(); }
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
function copy(o) { return JSON.parse(JSON.stringify(o)); }
function overlay(k, p) {
var keys = Object.keys(p);
for (var i = 0; i < keys.length; i++) K[k][keys[i]] = p[keys[i]];
}
function stepRead() { kvsPage(0); }
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
if (DEBUG) { var dk = Object.keys(K); for (var d = 0; d < dk.length; d++) dbg("kvs " + dk[d] + " " + typeof K[dk[d]] + " " + JSON.stringify(K[dk[d]])); }
next();
}
function stepScripts() { rpc("Script.List", {}, onScriptList); }
function onScriptList(res, ec, em) {
if (ec !== 0) { fail("Script.List: " + em); return; }
var list = res && res.scripts ? res.scripts : [];
for (var i = 0; i < list.length; i++) {
if (list[i].name === NAME_INSTALL) idInstall = list[i].id;
if (list[i].running === true && BUSY.indexOf(list[i].name) >= 0) { fail("Script " + list[i].name + " läuft gerade – in einer ruhigen Sekunde erneut starten"); return; }
}
if (idInstall === null) { fail("Script '" + NAME_INSTALL + "' nicht gefunden"); return; }
if (!obj(K.cfg1) || !obj(K.cfg2) || !obj(K.cfg3) || !obj(K.cfg4)) { fail("cfg1..cfg4 unvollständig – erst bw_install starten"); return; }
if (obj(K.hwb1) || obj(K.hwb2)) { fail("hwb1/hwb2 vorhanden (Hardware-Test nicht zurückgebaut) – erst node tools/hwtest.js <ip> restore"); return; }
next();
}
function stepPlan() {
var fresh = !obj(K.zrb1);
var bk = [["zrb1", { cfg3: copy(K.cfg3) }], ["zrb2", { lrn: obj(K.lrn) ? K.lrn : DEF.lrn, day: obj(K.day) ? K.day : DEF.day }],
["zrb3", { st: obj(K.st) ? K.st : DEF.st, err: obj(K.err) ? K.err : DEF.err }], ["zrb4", { cfg4: copy(K.cfg4) }], ["zrb5", { cfg2: copy(K.cfg2) }]];
wq = [];
for (var b = 0; b < bk.length; b++) { if (!obj(K[bk[b][0]])) { K[bk[b][0]] = bk[b][1]; wq.push(bk[b][0]); } }
overlay("cfg3", ZR3);
overlay("cfg4", ZR4);
if (isNum(K.cfg2.pctLo)) K.cfg2.pctDry = K.cfg2.pctLo - ZR_DRY;
K.lrn = DEF.lrn; K.st = DEF.st; K.day = DEF.day; K.job = DEF.job; K.err = DEF.err;
K.zr = { go: 1 };
var rest = ["cfg3", "cfg4", "cfg2", "lrn", "st", "day", "job", "err", "zr"];
for (var r = 0; r < rest.length; r++) wq.push(rest[r]);
wi = 0;
log((fresh ? "Sicherung zrb1..5 wird geschrieben" : "Sicherung bleibt (erneuter Start)") + "; Profil: Takt " + ZR3.tick + " min, Fenster alle " + ZR3.winEvery + " min, Budget " + ZR4.tWin + " s, bis " + ZR4.nPort + " Portionen, tHot " + ZR3.tHot + " °C, maxDay " + ZR3.maxDay + ", Trockenphase aus");
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
function stepStart() {
K = {};
rpc("Script.Start", { id: idInstall }, onStart);
}
function onStart(res, ec, em) {
if (ec !== 0) { fail("Script.Start " + NAME_INSTALL + ": " + em); return; }
log("bw_install gestartet (id " + idInstall + (res && res.was_running ? ", lief schon" : "") + ") – baut Zeitplan und auto_off. Zurück zum Normalbetrieb: bw_install erneut starten");
next();
}
var steps = [stepRead, stepScripts, stepPlan, stepStart];
dbg("start");
next();
