// bw_hwtest.js v0.1.0 – Hardware-Test Sensoren: Temperaturfühler, Bodenfeuchte, Wasserstand; wartet je Phase auf den physischen Zustand
// Hardware-Test Sensoren (nur von Hand, nie im Zeitplan): sechs Phasen mit dir am Aufbau – Fühler kalt/warm, Sensor trocken/nass,
// Schwimmer LEER/VOLL. Kommandos go/skip/abort über KVS hwc (node tools/hwtest.js <ip> go), Stand und Bericht in hwr.
// Schwellen und Zeiten in hwt: tLo/tHi °C, vDryMax/vWetMin V, tPhase s je Phase, tAll s gesamt; cal=1 schreibt vDry/vWet/lvlEmpty nach cfg1.
// Danach Sensoren zurück in den Topf, Schwimmer auf VOLL. Ablauf und Tabellen: README "Hardware-Test".
var VER = "0.1.0";
var DEBUG = 0;
var REQ1 = ["vDry", "vWet", "vErrLo", "vErrHi", "lvlEmpty", "nLvl", "idV", "idT", "idLvl", "idSw"];
var DEF = { tLo: 20, tHi: 30, vDryMax: 0.5, vWetMin: 2.5, dV: 0.03, nStab: 5, nNull: 10, msTick: 1000, nCmd: 2, nLog: 5, tPhase: 900, tAll: 3600, pumpSec: 30, tOn: 20, guardS: 90, winMin: 25, cal: 1, run: "tml" };
var IDS = ["t1", "t2", "m1", "m2", "l1", "l2"];
var K = {}, orig = {};
var c1 = null, h = null;
var ram = null, ramMin = null, run0 = 0, t0 = 0;
var busy = false, rcb = null, rud = null;
var th = null, mode = "idle";
var PH = [], pi = -1, ph = null, p = null;
var res = { t1: "-", t2: "-", m1: "-", m2: "-", l1: "-", l2: "-" }, notes = [];
var R = { t: [null, null], m: [null, null], l: [null, null] };
var cmd = { last: 0 };
var comp = "";
var lvlChg = 0, lvlLast = null;
var abort = false;
var calV = null, calL = null, cal = "-";
var rep = [], ri = 0;
var wq = [], wi = 0, nW = 0;
var si = 0;
function log(s) { print("[bw_hwtest " + VER + "] " + s); }
function dbg(s) { if (DEBUG) print("[bw_hwtest dbg] " + s); }
function rpc(m, prm, cb, ud) { dbg("rpc " + m + " " + JSON.stringify(prm)); busy = true; rcb = cb; rud = ud; Shelly.call(m, prm, onRpc); }
function onRpc(r, ec, em) { busy = false; var cb = rcb; rcb = null; cb(r, ec, em, rud); }
function stop() { rpc("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function fail(e) { log("ABBRUCH: " + (e && e.message ? e.message : e)); if (th !== null) Timer.clear(th); th = null; stop(); }
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
function obj(x) { return x !== null && typeof x === "object"; }
function fromKvs(v) {
if (typeof v !== "string") return v;
var o = null;
try { o = JSON.parse(v); } catch (e) { o = null; }
return o === undefined ? null : o;
}
function r3(x) { return Math.round(x * 1000) / 1000; }
function fmt(v) { return v === null ? "-" : r3(v); }
function missing(o, req) {
if (!obj(o)) return req[0];
for (var i = 0; i < req.length; i++) { var v = o[req[i]]; if (v === undefined || v === null) return req[i]; }
return null;
}
function readSys() {
var s = Shelly.getComponentStatus("sys");
ram = s && isNum(s.ram_free) ? s.ram_free : null;
if (ram !== null && (ramMin === null || ram < ramMin)) ramMin = ram;
return s && isNum(s.unixtime) ? s.unixtime : null;
}
function up() { return Shelly.getUptimeMs(); }
function rdT() { var s = Shelly.getComponentStatus("temperature", c1.idT); return s && isNum(s.tC) ? s.tC : null; }
function rdV() { var s = Shelly.getComponentStatus("voltmeter", c1.idV); return s && isNum(s.voltage) ? s.voltage : null; }
function rdL() { var s = Shelly.getComponentStatus("input", c1.idLvl); return s && typeof s.state === "boolean" ? (s.state ? 1 : 0) : null; }
function newPhase() { return { n: 0, t0: up(), last: null, min: null, max: null, nOk: 0, nNull: 0, ring: [], ri: 0, go: false, pend: null, said: "" }; }
function note(v) {
p.last = v;
if (p.min === null || v < p.min) p.min = v;
if (p.max === null || v > p.max) p.max = v;
p.ring[p.ri % h.nStab] = v;
p.ri = p.ri + 1;
}
function ringAt(k) { return p.ring[(p.ri - 1 - k) % h.nStab]; }
function ringStable(n) {
if (p.ri < n) return false;
var lo = ringAt(0), hi = lo;
for (var i = 1; i < n; i++) { var x = ringAt(i); if (x < lo) lo = x; if (x > hi) hi = x; }
return hi - lo <= h.dV;
}
function ringMean() { var s = 0; for (var i = 0; i < h.nStab; i++) s = s + ringAt(i); return r3(s / h.nStab); }
function ringSame(n) {
if (n > h.nStab) n = h.nStab;
if (p.ri < n) return false;
for (var i = 1; i < n; i++) { if (ringAt(i) !== ringAt(0)) return false; }
return true;
}
function say(s) { if (p.said !== s) { p.said = s; log(s); } }
function held(cond) { if (cond) p.nOk = p.nOk + 1; else p.nOk = 0; return p.nOk >= h.nStab; }
function chkT1(v) { return held(v !== null && v <= h.tLo) ? "ok" : null; }
function chkT2(v) { return held(v !== null && v >= h.tHi) ? "ok" : null; }
function chkM1(v) {
if (!p.go || !ringStable(h.nStab)) return null;
var m = ringMean();
if (m > h.vDryMax) { say("Sensor nicht trocken (" + m + " V > " + h.vDryMax + ") – abtrocknen, warten"); return null; }
if (m < c1.vErrLo + 0.05) { say("Spannung zu niedrig (" + m + " V) – Sensor angeschlossen?"); return null; }
R.m[0] = m;
return "ok";
}
function chkM2(v) {
if (!ringStable(h.nStab)) return null;
var m = ringMean();
if (m < h.vWetMin) return null;
if (m > c1.vErrHi - 0.1) { say("Spannung zu hoch (" + m + " V) – Verdrahtung/Messbereich prüfen"); return null; }
R.m[1] = m;
return "ok";
}
function chkL1(v) {
if (!p.go) return null;
if (lvlChg < 1) { say("noch kein Wechsel am Eingang gesehen – Schwimmer bewegen, dann LEER halten"); return null; }
if (!ringSame(c1.nLvl)) return null;
R.l[0] = ringAt(0);
return "ok";
}
function chkL2(v) {
if (!p.go || !ringSame(c1.nLvl)) return null;
if (R.l[0] !== null && ringAt(0) === R.l[0]) { say("Eingang zeigt noch LEER (" + ringAt(0) + ") – Schwimmer auf VOLL"); return null; }
R.l[1] = ringAt(0);
return "ok";
}
function phases() {
return [
{ id: "t1", g: "t", txt: "Fühler abkühlen auf <= " + h.tLo + " °C", rd: rdT, chk: chkT1, go: false, u: " °C" },
{ id: "t2", g: "t", txt: "Fühler erwärmen auf >= " + h.tHi + " °C", rd: rdT, chk: chkT2, go: false, u: " °C" },
{ id: "m1", g: "m", txt: "Sensor trocken in Luft (<= " + h.vDryMax + " V), dann go", rd: rdV, chk: chkM1, go: true, u: " V" },
{ id: "m2", g: "m", txt: "Sensor bis zur Markierung ins Wasser (>= " + h.vWetMin + " V)", rd: rdV, chk: chkM2, go: false, u: " V" },
{ id: "l1", g: "l", txt: "Schwimmer bewegen, dann auf LEER halten und go", rd: rdL, chk: chkL1, go: true, u: "" },
{ id: "l2", g: "l", txt: "Schwimmer auf VOLL halten und go", rd: rdL, chk: chkL2, go: true, u: "" }
];
}
function onTick() {
try {
if (mode === "rep") { tickRep(); return; }
var l = rdL();
if (l !== null && lvlLast !== null && l !== lvlLast) lvlChg = lvlChg + 1;
lvlLast = l;
if (mode !== "ph" || p.pend !== null) return;
p.n = p.n + 1;
var el = Math.floor((up() - p.t0) / 1000);
var v = ph.rd();
if (v === null) p.nNull = p.nNull + 1; else { p.nNull = 0; note(v); }
if (up() - t0 > h.tAll * 1000) { log("Gesamtzeit " + h.tAll + " s überschritten"); endPhase("ab"); return; }
if (p.nNull >= h.nNull) { log(ph.id + ": Sensor liefert null – Fühler/Kabel/Komponente prüfen"); endPhase("nl"); return; }
if (el > h.tPhase) { endPhase("to"); return; }
var r = ph.chk(v);
if (r !== null) { if (p.n <= h.nStab) notes.push(ph.id + ":sofort"); endPhase(r); return; }
if (p.n % h.nLog === 0) log(ph.id + " " + fmt(v) + ph.u + " t=" + el + "s" + (ph.go && !p.go ? " (warte auf go)" : ""));
if (!busy && p.n % h.nCmd === 0) rpc("KVS.Get", { key: "hwc" }, onCmd);
} catch (e) { fail(e); }
}
function onCmd(r, ec, em) {
if (ec === 0 && r) {
var c = fromKvs(r.value);
if (obj(c) && isNum(c.n) && c.n > cmd.last) {
cmd.last = c.n;
log("Kommando " + c.cmd + " (n=" + c.n + ")");
if (mode === "ph" && p.pend === null) {
if (c.cmd === "abort") endPhase("ab");
else if (c.cmd === "skip") endPhase("sk");
else if (c.cmd === "go") { if (ph.go) p.go = true; else log("go ignoriert: Phase " + ph.id + " wartet nicht auf go"); }
}
}
}
if (mode === "ph" && p.pend !== null) endPhase(p.pend);
}
function endPhase(r) {
if (busy) { p.pend = r; return; }
mode = "idle";
res[ph.id] = r;
if (ph.id === "t1") R.t[0] = p.min;
if (ph.id === "t2") R.t[1] = p.max;
log("Phase " + ph.id + ": " + r + " (" + fmt(p.last) + ph.u + ", min " + fmt(p.min) + ", max " + fmt(p.max) + ") nach " + Math.floor((up() - p.t0) / 1000) + " s");
if (r === "ab") abort = true;
writeHwr("lauf", onPhaseDone);
}
function onPhaseDone(r, ec, em) {
if (ec !== 0) log("KVS.Set hwr: " + em);
if (abort) jumpTo(stepCal);
next();
}
function hwrObj(s) {
var rr = [];
for (var i = 0; i < IDS.length; i++) rr.push(res[IDS[i]] === undefined ? "-" : res[IDS[i]]);
var o = { run: run0, s: s, dur: Math.floor((up() - t0) / 1000), mem: ramMin, t: R.t, m: R.m, l: R.l, chg: lvlChg, r: rr.join(","), cal: cal, n: notes.join(","), w: nW };
if (JSON.stringify(o).length > 253) o.n = "";
return o;
}
function writeHwr(s, cb) { K.hwr = hwrObj(s); nW = nW + 1; rpc("KVS.Set", { key: "hwr", value: JSON.stringify(K.hwr) }, cb); }
function tickRep() {
if (ri < rep.length) { print(rep[ri]); ri = ri + 1; return; }
mode = "idle";
next();
}
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
for (var q = 0; q < keys.length; q++) { orig[keys[q]] = JSON.stringify(K[keys[q]]); dbg("kvs " + keys[q] + " " + orig[keys[q]]); }
next();
}
function stepCfg() {
c1 = K.cfg1;
var miss = missing(c1, REQ1);
if (miss !== null) throw new Error("cfg1." + miss + " fehlt – Installer zuerst");
var u = readSys();
if (u === null) throw new Error("Uhrzeit nicht gesetzt");
run0 = u;
h = {};
var hk = Object.keys(DEF);
var src = obj(K.hwt) ? K.hwt : null;
for (var i = 0; i < hk.length; i++) { var kk = hk[i]; h[kk] = src !== null && src[kk] !== undefined && src[kk] !== null ? src[kk] : DEF[kk]; }
wq = []; wi = 0;
if (src === null) { K.hwt = h; wq.push("hwt"); }
cmd.last = obj(K.hwc) && isNum(K.hwc.n) ? K.hwc.n : 0;
comp = "V=" + (Shelly.getComponentStatus("voltmeter", c1.idV) ? "ok" : "FEHLT") + " T=" + (Shelly.getComponentStatus("temperature", c1.idT) ? "ok" : "FEHLT") + " IN=" + (Shelly.getComponentStatus("input", c1.idLvl) ? "ok" : "FEHLT");
PH = phases();
log("Start run=" + h.run + " | " + comp + " | V=" + fmt(rdV()) + " T=" + fmt(rdT()) + " lvl=" + fmt(rdL()));
th = Timer.set(h.msTick, true, onTick);
return writeNext();
}
function stepPhase() {
pi = pi + 1;
ph = PH[pi];
if (pi === 0) { K = {}; orig = {}; }
if (h.run.indexOf(ph.g) < 0) { res[ph.id] = "sk"; writeHwr("lauf", onPhaseDone); return; }
p = newPhase();
mode = "ph";
log("Phase " + (pi + 1) + "/" + PH.length + " " + ph.id + ": " + ph.txt + " (Timeout " + h.tPhase + " s)");
}
function stepCal() {
mode = "idle";
var why = [];
if (res.m1 === "ok" && res.m2 === "ok") {
if (R.m[1] - R.m[0] < 1.0) why.push("vWet-vDry<1V"); else calV = [R.m[0], R.m[1]];
} else why.push("m:" + res.m1 + "/" + res.m2);
if (res.l1 === "ok" && res.l2 === "ok" && R.l[0] !== R.l[1]) calL = R.l[0]; else why.push("l:" + res.l1 + "/" + res.l2);
cal = (calV !== null ? c1.vDry + ">" + calV[0] + ";" + c1.vWet + ">" + calV[1] : "-") + ";" + (calL !== null ? c1.lvlEmpty + ">" + calL : "-");
if (why.length) notes.push("cal:" + why.join("/"));
log("Kalibrierung: " + cal + (why.length ? " nicht übernommen: " + why.join(" ") : "") + (h.cal === 1 ? "" : " (nur melden)"));
return true;
}
function stepReread() { K = {}; kvsPage(0); }
function stepWrite() {
if (h.cal === 1 && obj(K.cfg1)) {
if (calV !== null) { K.cfg1.vDry = calV[0]; K.cfg1.vWet = calV[1]; }
if (calL !== null) K.cfg1.lvlEmpty = calL;
}
K.hwr = hwrObj(abort ? "abbruch" : "ende");
wq = []; wi = 0;
var keys = ["cfg1", "hwr"];
for (var i = 0; i < keys.length; i++) { if (JSON.stringify(K[keys[i]]) !== orig[keys[i]]) wq.push(keys[i]); }
nW = nW + wq.length;
return writeNext();
}
function writeNext() {
if (wi >= wq.length) return true;
var k = wq[wi];
wi = wi + 1;
rpc("KVS.Set", { key: k, value: JSON.stringify(K[k]) }, onWrite, k);
}
function onWrite(r, ec, em, k) {
if (ec !== 0) log("KVS.Set " + k + " fehlgeschlagen: " + em);
if (writeNext() === true) next();
}
function stepReport() {
rep = [];
rep.push("Bericht 1/5 Komponenten: " + comp + " | Vermerke: " + (notes.length ? notes.join(",") : "-"));
rep.push("Bericht 2/5 Temperatur: t1 " + res.t1 + " min=" + fmt(R.t[0]) + " °C | t2 " + res.t2 + " max=" + fmt(R.t[1]) + " °C");
rep.push("Bericht 3/5 Feuchte: m1 " + res.m1 + " vDry=" + fmt(R.m[0]) + " V | m2 " + res.m2 + " vWet=" + fmt(R.m[1]) + " V | cfg1 " + cal + (calV !== null && h.cal === 1 ? " geschrieben" : ""));
rep.push("Bericht 4/5 Wasserstand: l1 " + res.l1 + " leer=" + fmt(R.l[0]) + " | l2 " + res.l2 + " voll=" + fmt(R.l[1]) + " | Wechsel=" + lvlChg + (calL !== null && h.cal === 1 ? " | lvlEmpty geschrieben" : ""));
rep.push("Bericht 5/5 " + (abort ? "ABBRUCH" : "Ende") + ": dauer=" + Math.floor((up() - t0) / 1000) + " s w=" + nW + " ram_min=" + ramMin + " – Sensoren zurück in den Topf, Schwimmer auf VOLL? Pumpentest: bw_hwpump");
ri = 0;
mode = "rep";
}
function stepDone() {
if (th !== null) Timer.clear(th);
th = null;
log("fertig " + (abort ? "abbruch" : "ende") + " r=" + K.hwr.r + " dauer=" + (up() - t0) + "ms");
return true;
}
var steps = [stepRead, stepCfg, stepPhase, stepPhase, stepPhase, stepPhase, stepPhase, stepPhase, stepCal, stepReread, stepWrite, stepReport, stepDone];
dbg("start");
next();
