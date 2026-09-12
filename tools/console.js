// tools/console.js v0.1.0 – Konsole des Geräts mitlesen (Debug-Websocket /debug/log), optional ein Script starten
//
// Aufruf: node tools/console.js <ip> [sekunden] [script-id]
//   node tools/console.js 127.0.0.1:8010 12 2   → verbindet, startet Script 2, sammelt 12 s lang Konsolenzeilen
// Voraussetzung: Sys.GetConfig → debug.websocket.enable = true (die Web-UI schaltet das beim Öffnen der Konsole ein).
// Node ≥ 22 (globales WebSocket), keine Abhängigkeiten. Beendet sich nach der Wartezeit von selbst.
'use strict';
const [ip, secArg, idArg] = process.argv.slice(2);
if (!ip) { console.error('Aufruf: node tools/console.js <ip> [sekunden] [script-id]'); process.exit(2); }
const seconds = Number(secArg || 10);
const ws = new WebSocket('ws://' + ip + '/debug/log');
ws.onopen = async function () {
  console.error('verbunden, höre ' + seconds + ' s' + (idArg ? ', starte Script ' + idArg : ''));
  if (idArg) {
    const r = await fetch('http://' + ip + '/rpc/Script.Start?id=' + idArg, { signal: AbortSignal.timeout(10000) });
    console.error('Script.Start → ' + (await r.text()));
  }
  setTimeout(function () { ws.close(); process.exit(0); }, seconds * 1000);
};
ws.onmessage = function (ev) {
  let line = String(ev.data);
  try { const j = JSON.parse(line); if (j && typeof j.data === 'string') line = j.data.replace(/\n$/, ''); } catch (e) { /* Rohzeile */ }
  console.log(line);
};
ws.onerror = function (e) { console.error('Websocket-Fehler: ' + (e.message || e.type)); process.exit(1); };
ws.onclose = function () { process.exit(0); };
