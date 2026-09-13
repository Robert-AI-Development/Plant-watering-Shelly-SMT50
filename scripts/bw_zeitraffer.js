// bw_zeitraffer.js v0.2.0 – Praxistest im Zeitraffer: Betriebswerte sichern, kurze Zeiten und Fenster-Regelkreis schreiben, bw_install baut den Zeitplan
//! Zeitraffer = dieselben Betriebs-Scripts (bw_main, bw_pump), nur mit kurzen Zeiten: Takt 3 min, Gießfenster alle 6 min (Pumpe bei
//! Sekunde 30), Fenster-Budget 120 s, bis 3 Portionen mit echtem Lernen (Schlauch AM Sensor), Trockenphase aus (pctDry = pctLo−1, dryDay null).
//! Start (nur von Hand, am besten: node tools/hwtest.js <ip> zeitraffer): sichert cfg3 / lrn,day / st,err / cfg4 / cfg2 nach zrb1..5,
//! schreibt die Profile (cfg3, cfg4, cfg2.pctDry), setzt lrn/st/day/job/err frisch, setzt die Marke zr und startet bw_install (Zeitplan, auto_off).
//! Zurück zum Normalbetrieb: bw_install starten (node tools/hwtest.js <ip> normal) – ohne Marke zr schreibt er das Original zurück.
//! Profil cfg3 (Normal → Zeitraffer): tick 15→3 min · winEvery null→6 · soak 30→0.25 min · pauseHot 12→0.1 h (Fenster 6 min nach der Gabe)
//! pause 24→0.2 h (12 min) · pauseSlow 48→0.35 h · jobAge 20→5 min · maxDay 2→4 · tDead 20→2 s · tMin 25→10 · tStd 70→12 · tMax 180→40 s
//! tChk 5→1 s · tHot 35→30 °C (Handwärme reicht). cfg4: tWin 120, tTail 20, nPort 3, tPmin 10, tPmax 15, tSoak 10, tStab 30, nStab 3, tDead2 0, dEffMin 1.
//! Fahrplan (Minute ab Start S, S = volle 6er-Minute; README "Praxistest im Zeitraffer"): vor 0 Sensor im Wasserglas → 0 why=trocken (nass) ·
//! 3 Sensor in trockene Erde → 6:30 FENSTER 1 · 9 Kontrolle, why=pause · 9–14 Sensor zurück in trockene Erde → 15 why=ok, 18:30 FENSTER 2 ·
//! 19 Fühler > tHot, Sensor trocken → 21 pause 0.1 h, 24:30 FENSTER 3 · 25 Schwimmer LEER → 27 why=wasser · 31 VOLL, Sensor trocken →
//! 36:30 FENSTER 4 · 39 why=limit · 40 normal (Rückbau, zrb1..5/zr weg). Sicherheits-Aus Minute ≡ 2 mod 6 bei Sekunde 40.
//
// Ablauf: 1 KVS lesen   2 Script.List (ID von bw_install; nichts Wichtiges läuft; keine hwb-Sicherung; cfg1..4 vorhanden)
//         3 Sicherung, Profile, frischer Zustand, Marke schreiben (zr zuletzt)   4 K freigeben, Script.Start bw_install, Ende (Script.Stop).
// Voraussetzung am Gerät: cfg2 vollständig (auch pctOk), sonst gießt bw_main nie (why=cfg) – hwtest.js zeitraffer prüft das vorab.
// Ein offener RPC-Aufruf, benannte Callbacks, flache next()-Schleife, steps ganz unten (mJS hoistet nicht) – wie in bw_install.
// Warum diese Pausen: bw_main rechnet die Pause mit zwei Takten Toleranz ((now + 2·tick·60) − st.ts ≥ pause·3600), weil der Auftrag
// einen Takt vor dem Fenster entsteht; Toleranz hier 2·3·60 = 360 s. Die Gabe startet bei Sekunde 30 der Fensterminute T (Installer:
// PUMP_SEC, damit bw_pump nie neben bw_main läuft – geteilter Heap), st.ts = T:30. pauseHot 0.1 h = 360 s: Takt T+3 → (180 + 360) − 30
// = 510 ≥ 360 → Auftrag T+3, Fenster T+6:30. pause 0.2 h = 720 s: T+6 → 690 nein, T+9 → 870 ja → Auftrag T+9, Fenster T+12:30.
// jobAge 5 min ≥ 3,5 min (Auftrag aus dem Takt vor dem Fenster). soak 0.25 min = 15 s: Kontrolle beim Takt T+3 (150 s nach der Gabe).
// Exakte Dezimalzahlen, damit JSON.stringify keine 18-stelligen Brüche schreibt.
// Warum tDead 2 < tStd 12: die Gabe hat wirksame Sekunden, bw_pump lernt im Fenster (effW) – dafür muss der Schlauch am Sensor liegen,
// sonst Störung noeff. Eimer-Variante ohne Messung: cfg4.nPort 1 von Hand setzen (Einzelportion).
// Marke zuletzt: bricht das Script vorher ab, findet der nächste bw_install eine Sicherung ohne Marke und baut zurück (nie halb umgebaut).

var VER = "0.2.0";
var DEBUG = 0;                 // 1 = Debug-Zeilen in der Konsole: Schritte, RPC-Aufrufe, KVS-Inhalt
var NAME_INSTALL = "bw_install";
var BUSY = ["bw_install", "bw_main", "bw_pump", "bw_hwtest", "bw_hwpump"];   // keins davon darf beim Start laufen (Heap, Schreibkonflikte)

// Zeitraffer-Profil cfg3: nur diese Felder werden überschrieben, alle anderen (winA, winB, …) bleiben wie sie sind.
// Was man gefahrlos ändern darf, steht je Zeile; nach einer Änderung hier: npm test, npm run build, Upload, Script neu starten.
var ZR3 = {
  tick: 3,         // min – bw_main misst und entscheidet alle 3 Minuten (Normal 15). Teiler von 60, winEvery ein Vielfaches davon.
  winEvery: 6,     // min – bw_pump läuft alle 6 Minuten (Minute ≡ 0 mod 6) statt um winA/winB (Normal null). Teiler von 60.
  soak: 0.25,      // min = 15 s – Kontrolle der Gabe beim nächsten Takt (Normal 30); die Gabe startet bei Sekunde 30, der Takt bei 0
  pauseHot: 0.1,   // h = 360 s – bei Hitze nächstes Fenster 6 min nach der Gabe (Normal 12 h)
  pause: 0.2,      // h = 720 s – normal nächstes Fenster 12 min nach der Gabe (Normal 24 h)
  pauseSlow: 0.35, // h – nur der Vollständigkeit halber; braucht 24 h Messreihe, im Zeitraffer nie aktiv (Normal 48 h)
  jobAge: 5,       // min – Auftrag darf beim Fenster höchstens 5 min alt sein (Normal 20)
  maxDay: 4,       // Fenster je Tag im Test, danach why=limit (Normal 2). Mehr Fälle testen: erhöhen.
  tDead: 2,        // s – Totzeit der Erstportion (Normal 20); tDead < tStd, damit gelernt wird
  tMin: 10,        // s – kleinste Erstportion (Normal 25); nie unter 10 s: das Wasser braucht den Schlauch (Messlauf 13.09.2026)
  tStd: 12,        // s – allererste Gabe (Normal 70)
  tMax: 40,        // s – Summe je Fenster, drei Portionen 12 + 15 + 10 passen; auto_off tMax + 10 s (Normal 180)
  tChk: 1,         // s – Wasserstand während der Portion jede Sekunde prüfen (Normal 5)
  tHot: 30,        // °C – Hitzeschwelle im Test: Handwärme oder ein Becher warmes Wasser reicht (Normal 35; 35 nur mit Föhn erreichbar)
  dryDay: null     // kein Trockentag im Test (Normal 5 = Freitag)
};
// Zeitraffer-Profil cfg4 (Fenster-Regelkreis von bw_pump): Budget 120 s passt mit Pumpenstart 30 s + tTail 20 s in den 3-min-Takt (170 ≤ 180)
var ZR4 = {
  tWin: 120,       // s – Zeitbudget je Fenster ab Scriptstart (Normal 420); Sicherheits-Aus 30 + 120 + 10 = 160 s → Minute +2, Sekunde 40
  tTail: 20,       // s – Reserve vor dem nächsten bw_main-Takt (Normal 20)
  nPort: 3,        // Portionen je Fenster (Normal 6); 1 = Einzelportion ohne Messung (Eimer-Variante)
  tPmin: 10,       // s – kleinste Korrekturportion (Normal 10)
  tPmax: 15,       // s – je Portion (Normal 120)
  tSoak: 10,       // s – einsickern nach jeder Portion (Normal 20); Schlauch am Sensor, Wert steht 5 s nach Pumpe-aus (Messlauf)
  tStep: 5,        // s – Abstand der Ringwerte (Normal 5)
  tStab: 30,       // s – Timeout der Stabilisierung (Normal 60)
  nStab: 3,        // Ringwerte für "stabil" (Normal 4)
  dStab: 1,        // % Spanne "stabil" (Normal 1)
  tDead2: 0,       // s – Totzeit Folgeportionen, Schlauch ist voll (Normal 8)
  dEffMin: 1       // % ΣΔ zweier voller Portionen, darunter noeff (Normal 2)
};
// Zeitraffer-Profil cfg2: Trockenphase praktisch aus – der Sensor liegt unter dem Schlauch und bleibt nass. pctDry wird auf pctLo − ZR_DRY
// gesetzt (der Plan nannte 101; die Bandprüfung von bw_main verlangt pctDry < pctLo): sobald die Erde trocken genug für einen Auftrag ist,
// gilt die Phase als beendet. Die übrigen cfg2-Felder bleiben, wie sie sind (Sicherung zrb5).
var ZR_DRY = 1;
// frischer Zustand für den Test (wie nach der Installation); das Original liegt solange in zrb1..5
var DEF = {
  lrn: { effW: null, sf: 0.7, rate: null, tMean: null, tMaxD: null, tMaxY: null },
  st: { state: "beob", ts: null, sec: null, pctB: null, pctA: null, rated: false, dryOk: false },
  job: { ok: false, sec: null, pct: null, why: "init", ts: null },
  day: { date: null, n: 0, sec: 0 },
  err: { code: null, ts: null, mem: null }
};

var K = {};          // gelesene KVS-Einträge
var wq = [], wi = 0; // Schreib-Warteschlange
var idInstall = null;
var si = 0;

// ---- Hilfen ------------------------------------------------------------
function log(s) { print("[bw_zeitraffer " + VER + "] " + s); }
function dbg(s) { if (DEBUG) print("[bw_zeitraffer dbg] " + s); }
function rpc(m, p, cb, ud) { dbg("rpc " + m + " " + JSON.stringify(p)); Shelly.call(m, p, cb, ud); }
function stop() { rpc("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function fail(msg) { log("ABBRUCH: " + msg); stop(); }
function next() {
  // Flache Schleife statt verschachtelter Aufrufe: mJS verträgt nur etwa 10 Stack-Ebenen (LEARNING.md).
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
  // Profil p über den KVS-Eintrag k legen (nur die Felder des Profils)
  var keys = Object.keys(p);
  for (var i = 0; i < keys.length; i++) K[k][keys[i]] = p[keys[i]];
}

// ---- Schritt 1: KVS lesen (paginiert) -------------------------------------
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

// ---- Schritt 2: Script-Liste: ID von bw_install, nichts Wichtiges läuft, cfg1..4 vorhanden -------
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

// ---- Schritt 3: Sicherung, Profile, frischer Zustand, Marke (zr zuletzt) ------
function stepPlan() {
  // Erneuter Start im Zeitraffer: die Sicherung des Originals bleibt unangetastet. Fehlt eine einzelne Sicherung (Abbruch beim
  // ersten Lauf oder ältere Version ohne zrb4/zrb5), wird sie aus dem aktuellen Eintrag angelegt – der ist dann noch das Original.
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
  if (wi >= wq.length) return true;   // Warteschlange leer → nächster Schritt
  var k = wq[wi];
  wi = wi + 1;
  rpc("KVS.Set", { key: k, value: JSON.stringify(K[k]) }, onWrite, k);
}
function onWrite(res, ec, em, k) {
  if (ec !== 0) log("KVS.Set " + k + " fehlgeschlagen: " + em);
  if (writeNext()) next();
}

// ---- Schritt 4: Heap freigeben, bw_install starten, Ende ----------------------
function stepStart() {
  K = {};   // geteilter Script-Heap: das zweite Script soll Platz haben (LEARNING.md)
  rpc("Script.Start", { id: idInstall }, onStart);
}
function onStart(res, ec, em) {
  if (ec !== 0) { fail("Script.Start " + NAME_INSTALL + ": " + em); return; }
  log("bw_install gestartet (id " + idInstall + (res && res.was_running ? ", lief schon" : "") + ") – baut Zeitplan und auto_off. Zurück zum Normalbetrieb: bw_install erneut starten");
  next();
}

// Schrittliste erst hier: mJS hoistet Funktionen nicht, die Namen gibt es erst nach ihrer Deklaration.
var steps = [stepRead, stepScripts, stepPlan, stepStart];
dbg("start");
next();
