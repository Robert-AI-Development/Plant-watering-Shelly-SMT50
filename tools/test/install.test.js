// tools/test/install.test.js v0.1.3 – Etappe 1/10: Installer (cfg4, Fenster-Budget tWin, Sicherheits-Aus aus tWin, Minutenliste im Zeitraffer)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Device, runScript, FILES, patch } = require('./helpers.js');

function ok(r) { assert.deepEqual(r.errors, []); assert.equal(r.stopped, true, 'Script hat sich nicht beendet'); }
// Normalbetrieb: Takt 15 min, Pumpe 30 s nach 08:00/20:00, Sicherheits-Aus SAFE_MIN = ceil((30 + tWin 420 + 10)/60) = 8 min danach
const NORMAL_SPECS = ['0 */15 * * * *', '30 0 8,20 * * *', '0 8 8,20 * * *'];
const CFG4 = { tWin: 420, tTail: 20, nPort: 6, tPmin: 10, tPmax: 120, tSoak: 20, tStep: 5, tStab: 60, nStab: 4, dStab: 1, tDead2: 8, dEffMin: 2 };

test('Installer legt neun KVS-Einträge, drei Zeitplan-Einträge (Pumpe 30 s nach der vollen Minute, Sicherheits-Aus +8 min) und die Switch-Konfiguration an', () => {
  const dev = new Device();
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.deepEqual([...dev.kvs.keys()].sort(), ['cfg1', 'cfg2', 'cfg3', 'cfg4', 'day', 'err', 'job', 'lrn', 'st']);
  assert.equal(r.writes, 9);
  assert.equal(dev.maxPendingRpc, 1, 'immer nur ein offener RPC');
  assert.deepEqual(dev.schedules.map((j) => j.timespec), NORMAL_SPECS);
  assert.deepEqual(dev.schedules[0].calls, [{ method: 'Script.Start', params: { id: 2 } }]);
  assert.deepEqual(dev.schedules[1].calls, [{ method: 'Script.Start', params: { id: 3 } }]);
  assert.deepEqual(dev.schedules[2].calls, [{ method: 'Switch.Set', params: { id: 0, on: false } }]);
  assert.equal(dev.script('bw_main').enable, false);
  assert.equal(dev.script('bw_pump').enable, false);
  assert.equal(dev.switches[0].config.initial_state, 'off');
  assert.equal(dev.switches[0].config.auto_off, true);
  assert.equal(dev.switches[0].config.auto_off_delay, 190, 'tMax 180 + 10');
  assert.equal(dev.kvsGet('st').state, 'beob');
  assert.equal(dev.kvsGet('job').ok, false);
  assert.deepEqual(dev.kvsGet('cfg4'), CFG4);
  const c2 = dev.kvsGet('cfg2'), c3 = dev.kvsGet('cfg3'), lrn = dev.kvsGet('lrn');
  assert.equal(c2.pctSoll, null);
  assert.equal(c2.pctOk, null, 'Zielband-Feld pctOk offen');
  assert.equal(c2.dropW, null);
  assert.equal(c2.sfUp, 0.05);
  assert.equal(c2.effMax, 30);
  assert.equal(c3.tMax, 180); assert.equal(c3.tMin, 25); assert.equal(c3.dryDay, 5);
  assert.deepEqual(lrn, { effW: null, sf: 0.7, rate: null, tMean: null, tMaxD: null, tMaxY: null });
  assert.match(r.log.join('\n'), /Script-IDs: install=1 main=2 pump=3/);
  assert.match(r.log.join('\n'), /Budget tWin 420 s, Sicherheits-Aus 8 min danach/);
});

test('Retry: der am Gerät fehlschlagende erste Schedule.Create wird wiederholt, alle drei Einträge entstehen', () => {
  const dev = new Device();               // schedCreateFailFirst ist standardmäßig an (Gerätequirk)
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), NORMAL_SPECS, 'Takt-Eintrag trotz erstem Fehlschlag vorhanden');
  const creates = dev.rpcLog.filter((c) => c.method === 'Schedule.Create').length;
  assert.equal(creates, 4, 'ein fehlgeschlagener plus drei erfolgreiche Create-Aufrufe');
  assert.doesNotMatch(r.log.join('\n'), /Schedule\.Create/, 'die erste Ablehnung wird stumm wiederholt (nur dbg)');
});

test('ohne den Gerätequirk entstehen die drei Einträge in genau drei Create-Aufrufen', () => {
  const dev = new Device();
  dev.schedCreateFailFirst = false;
  ok(runScript(dev, FILES.bw_install));
  assert.equal(dev.schedules.length, 3);
  assert.equal(dev.rpcLog.filter((c) => c.method === 'Schedule.Create').length, 3);
});

test('zweiter Lauf: keine Duplikate im Zeitplan, keine KVS-Schreibvorgänge, Änderungen bleiben erhalten', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg2', { pctLo: 40 });
  patch(dev, 'cfg3', { tMax: 90 });
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(r.writes, 0);
  assert.equal(dev.schedules.length, 3);
  assert.equal(dev.kvsGet('cfg2').pctLo, 40);
  assert.equal(dev.switches[0].config.auto_off_delay, 100, 'auto_off folgt dem geänderten tMax');
  assert.match(r.log.join('\n'), /davon eigene: 3/);
});

test('fremde Zeitplan-Einträge bleiben stehen', () => {
  const dev = new Device();
  dev.dispatch('Schedule.Create', { enable: true, timespec: '0 0 6 * * *', calls: [{ method: 'Switch.Set', params: { id: 1, on: true } }] });
  ok(runScript(dev, FILES.bw_install));
  assert.equal(dev.schedules.length, 4);
  assert.equal(dev.schedules[0].timespec, '0 0 6 * * *');
});

test('Fenster mit ungleichen Minuten ergeben je zwei Einträge, Sicherheits-Aus +8 min mit Stundenübertrag', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg3', { winA: '07:30', winB: '19:52' });   // 52 mod 15 = 7 → 420 + 470 = 890 ≤ 900 passt gerade noch
  ok(runScript(dev, FILES.bw_install));
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ['0 */15 * * * *', '30 30 7 * * *', '30 52 19 * * *', '0 38 7 * * *', '0 0 20 * * *']);
});

test('Sicherheits-Aus folgt tWin: tWin 200 → ceil(240/60) = 4 min nach dem Fenster', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg4', { tWin: 200 });
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ['0 */15 * * * *', '30 0 8,20 * * *', '0 4 8,20 * * *']);
  assert.match(r.log.join('\n'), /Sicherheits-Aus 4 min danach/);
});

test('fehlt bw_pump, bricht der Installer mit err cfg ab und legt keinen Zeitplan an', () => {
  const dev = new Device();
  dev.scripts = dev.scripts.filter((s) => s.name !== 'bw_pump');
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.equal(dev.schedules.length, 0);
  assert.match(r.log.join('\n'), /bw_pump.*nicht gefunden/);
});

test('ungültiges Fensterformat bricht mit err cfg ab', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg3', { winA: '8:00' });
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.equal(dev.schedules.length, 3, 'alter Zeitplan bleibt unangetastet');
});

test('KVS.GetMany wird paginiert gelesen (Seitengröße 2)', () => {
  const dev = new Device({ kvsPageSize: 2 });
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg3', { tMax: 60 });
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(r.writes, 0, 'alle neun Einträge wurden gefunden, nichts neu angelegt');
  assert.equal(dev.switches[0].config.auto_off_delay, 70);
});

// ---- v0.1.2: fehlende Felder ergänzen, tick/winEvery prüfen ----------------------------------
test('Installer ergänzt fehlende Felder in vorhandenem cfg3 (Script-Update), zweiter Lauf schreibt nichts', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  const c3 = dev.kvsGet('cfg3');
  delete c3.tick; delete c3.winEvery;
  dev.kvsSetRaw('cfg3', c3);
  let r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(r.writes, 1, 'nur cfg3 geschrieben');
  assert.equal(dev.kvsGet('cfg3').tick, 15);
  assert.equal(dev.kvsGet('cfg3').winEvery, null);
  assert.equal(dev.kvsGet('cfg3').tMax, 180, 'vorhandene Felder unangetastet');
  assert.match(r.log.join('\n'), /KVS cfg3 ergänzt: tick,winEvery/);
  r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(r.writes, 0);
});

test('tick, der 60 nicht teilt, bricht mit err cfg ab; alter Zeitplan bleibt', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg3', { tick: 7 });
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.match(r.log.join('\n'), /cfg3\.tick muss ein Teiler von 60/);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), NORMAL_SPECS);
});

// ---- v0.1.3: cfg4, Altgerät-Update, Fenster-Budget-Regel, Minutenliste, laufendes Script ----------------------
test('Altgerät (Stand v0.1.2): Installer legt cfg4 an und ergänzt pctOk/dropW/sfUp, dryDay, effW/sf – Handwerte bleiben', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  dev.kvs.delete('cfg4');
  const c2 = dev.kvsGet('cfg2'); delete c2.pctOk; delete c2.dropW; delete c2.sfUp; c2.effMax = 2; c2.pctHi = 65; dev.kvsSetRaw('cfg2', c2);
  const c3 = dev.kvsGet('cfg3'); delete c3.dryDay; c3.tMax = 120; c3.tMin = 40; dev.kvsSetRaw('cfg3', c3);
  dev.kvsSetRaw('lrn', { eff: 0.3, sf: 1, rate: null, tMean: null, tMaxD: null, tMaxY: null });
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(r.writes, 4, 'cfg4 neu, cfg2/cfg3/lrn ergänzt');
  assert.deepEqual(dev.kvsGet('cfg4'), CFG4);
  assert.deepEqual(dev.kvsGet('cfg2'), Object.assign(c2, { pctOk: null, dropW: null, sfUp: 0.05 }), 'Handwerte effMax 2 / pctHi 65 bleiben, neue Felder mit Startwert');
  assert.equal(dev.kvsGet('cfg3').dryDay, 5);
  assert.equal(dev.kvsGet('cfg3').tMax, 120, 'Handwert bleibt (README: Update-Kapitel nennt die neuen Werte)');
  assert.deepEqual(dev.kvsGet('lrn'), { eff: 0.3, sf: 1, rate: null, tMean: null, tMaxD: null, tMaxY: null, effW: null }, 'eff bleibt auf dem Altgerät stehen, sf nicht angefasst');
  assert.equal(dev.switches[0].config.auto_off_delay, 130);
  assert.match(r.log.join('\n'), /KVS neu angelegt: cfg4/);
  assert.match(r.log.join('\n'), /KVS cfg2 ergänzt: pctOk,dropW,sfUp/);
});

test('tick 5: Fenster 08:00 + 30 s + tWin 420 + tTail 20 passen nicht in 300 s → err cfg, Zeitplan bleibt', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg3', { tick: 5 });
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.match(r.log.join('\n'), /cfg3\.winA 08:00.*tWin 420.*tick 5 min/);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), NORMAL_SPECS);
});

test('winA 07:25: Minute 25 liegt 10 min nach dem Takt, 600 + 470 > 900 → err cfg mit Nennung des Fensters', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg3', { winA: '07:25' });
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.match(r.log.join('\n'), /ABBRUCH: cfg3\.winA 07:25/);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), NORMAL_SPECS);
  patch(dev, 'cfg3', { winA: '07:07' });   // 7 mod 15 = 7 → 420 + 470 = 890 passt
  ok(runScript(dev, FILES.bw_install));
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ['0 */15 * * * *', '30 7 7 * * *', '30 0 20 * * *', '0 15 7 * * *', '0 8 20 * * *']);
});

test('Zeitraffer: winEvery 6 mit tWin 200 bei tick 3 → err cfg (250 > 180); tWin 120 → Minutenliste fürs Sicherheits-Aus', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg3', { tick: 3, winEvery: 6, tMax: 40 });
  patch(dev, 'cfg4', { tWin: 200 });
  let r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.match(r.log.join('\n'), /Zeitraffer-Fenster Minute 0:.*tWin 200.*tick 3 min/);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), NORMAL_SPECS, 'Zeitplan unverändert');
  patch(dev, 'cfg4', { tWin: 120 });
  r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ['0 */3 * * * *', '30 */6 * * * *', '40 2,8,14,20,26,32,38,44,50,56 * * * *']);
  assert.deepEqual(dev.schedules[2].calls, [{ method: 'Switch.Set', params: { id: 0, on: false } }]);
  assert.equal(dev.switches[0].config.auto_off_delay, 50);
  assert.match(r.log.join('\n'), /ZEITRAFFER aktiv: bw_main alle 3 min, bw_pump alle 6 min \(Sekunde 30\), Budget 120 s, bis 6 Portionen, Sicherheits-Aus 160 s/);
});

test('Zeitraffer: Sicherheits-Aus muss vor dem nächsten Fenster liegen (winEvery 2, tWin 100: 140 s ≥ 120 s → err cfg)', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg3', { tick: 2, winEvery: 2 });
  patch(dev, 'cfg4', { tWin: 60, tTail: 10 });   // 30 + 60 + 10 = 100 ≤ 120 (Takt), Sicherheits-Aus 100 < 120 → ok
  ok(runScript(dev, FILES.bw_install));
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ['0 */2 * * * *', '30 */2 * * * *', '40 1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,39,41,43,45,47,49,51,53,55,57,59 * * * *']);
  patch(dev, 'cfg3', { tick: 3 });               // Fenster alle 2 min im 3-min-Takt: Minute 2 liegt 2 min nach dem Takt → 120 + 100 > 180
  let r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.match(r.log.join('\n'), /Zeitraffer-Fenster Minute 2:/);
  patch(dev, 'cfg3', { tick: 5, winEvery: 2 });
  patch(dev, 'cfg4', { tWin: 100, tTail: 0 });   // Fensterminuten 0,2,4 im 5er-Takt: Minute 2 passt (250 ≤ 300), Minute 4 nicht (370)
  r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.match(r.log.join('\n'), /Zeitraffer-Fenster Minute 4:/);
  patch(dev, 'cfg3', { winEvery: 10, tick: 10 });
  patch(dev, 'cfg4', { tWin: 560, tTail: 0 });   // 590 ≤ 600 (Takt), aber Sicherheits-Aus 600 < 600? nein → Fensterregel
  r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.match(r.log.join('\n'), /cfg4\.tWin 560: Sicherheits-Aus .* vor dem nächsten Fenster .*winEvery 10 min/);
});

test('läuft bw_main oder bw_pump, bricht der Installer vor jedem KVS-Schreibvorgang mit err cfg ab; Zeitplan bleibt', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg3', { winA: '07:00' });
  dev.script('bw_main').running = true;      // runScript setzt running nur für das gestartete Script (bw_install)
  let r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.equal(dev.kvsGet('err').code, 'cfg');
  assert.match(r.log.join('\n'), /ABBRUCH: Script bw_main läuft – später erneut starten/);
  assert.equal(r.writes, 1, 'nur err geschrieben');
  assert.deepEqual(dev.schedules.map((j) => j.timespec), NORMAL_SPECS, 'Zeitplan unverändert (winA 07:00 nicht übernommen)');
  dev.script('bw_main').running = false;
  dev.script('bw_pump').running = true;
  r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.match(r.log.join('\n'), /Script bw_pump läuft/);
  dev.script('bw_pump').running = false;
  ok(runScript(dev, FILES.bw_install));
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ['0 */15 * * * *', '30 0 7,20 * * *', '0 8 7,20 * * *'], 'nach dem Ende des Laufs übernimmt der Installer winA 07:00');
});
