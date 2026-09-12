// engine_probe.js v0.1.5 – voller Installer-Vorlauf (KVS lesen, Script.List) vor der Zeitplanphase
var TICK = "0 */15 * * * *";
function log(s) { print("[probe] " + s); }
function res(tag, r, ec, em) { log(tag + ": ec=" + ec + (ec !== 0 ? " em=" + em : "") + " res=" + JSON.stringify(r)); }
function fin() { log("fertig"); Shelly.call("Script.Stop", { id: Shelly.getCurrentScriptId() }); }
function calls() { return [{ method: "Script.Start", params: { id: 2 } }]; }

// Vorlauf 1: KVS paginiert lesen (wie stepRead)
function stepR() { Shelly.call("KVS.GetMany", { match: "*", offset: 0 }, onR0); }
function onR0(r, ec, em) { var n = r && r.items ? r.items.length : 0; log("R KVS Seite 0: " + n + " / total " + (r ? r.total : "?")); Shelly.call("KVS.GetMany", { match: "*", offset: n }, onR1); }
function onR1(r, ec, em) { log("R KVS Seite 2 gelesen"); stepSL(); }
// Vorlauf 2: Script.List
function stepSL() { Shelly.call("Script.List", {}, onSL); }
function onSL(r, ec, em) { var sc = r && r.scripts ? r.scripts.length : 0; log("R Script.List: " + sc + " Scripts"); stepList(); }

// Zeitplanphase wie der Installer
var ids = [], di = 0, last = null;
function stepList() { Shelly.call("Schedule.List", {}, onList); }
function onList(r, ec, em) { ids = []; var jobs = r && r.jobs ? r.jobs : []; for (var i = 0; i < jobs.length; i++) ids.push(jobs[i].id); log("L Pläne: " + JSON.stringify(ids)); di = 0; delNext(); }
function delNext() { if (di >= ids.length) { afterDel(); return; } var id = ids[di]; di = di + 1; Shelly.call("Schedule.Delete", { id: id }, onDel); }
function onDel(r, ec, em) { delNext(); }
function afterDel() { Shelly.call("Schedule.Create", { enable: true, timespec: TICK, calls: calls() }, onC1); }
function onC1(r, ec, em) { res("L Create Takt nach vollem Vorlauf", r, ec, em); last = r && r.id; cleanup(); }
function cleanup() { if (typeof last === "number") { Shelly.call("Schedule.Delete", { id: last }, onCl); } else recreate(); }
function onCl(r, ec, em) { recreate(); }

var rec = [{ ts: "0 0 8,20 * * *", c: [{ method: "Script.Start", params: { id: 3 } }] }, { ts: "0 5 8,20 * * *", c: [{ method: "Switch.Set", params: { id: 0, on: false } }] }];
var ri = 0;
function recreate() { if (ri >= rec.length) { fin(); return; } var e = rec[ri]; ri = ri + 1; Shelly.call("Schedule.Create", { enable: true, timespec: e.ts, calls: e.c }, onRec); }
function onRec(r, ec, em) { recreate(); }

stepR();
