// tools/test/install.test.js v0.1.1 – Etappe 1: Installer
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Device, runScript, FILES, patch } = require('./helpers.js');

function ok(r) { assert.deepEqual(r.errors, []); assert.equal(r.stopped, true, 'Script hat sich nicht beendet'); }

test('Installer legt acht KVS-Einträge, drei Zeitplan-Einträge und die Switch-Konfiguration an', () => {
  const dev = new Device();
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.deepEqual([...dev.kvs.keys()].sort(), ['cfg1', 'cfg2', 'cfg3', 'day', 'err', 'job', 'lrn', 'st']);
  assert.equal(r.writes, 8);
  assert.equal(dev.maxPendingRpc, 1, 'immer nur ein offener RPC');
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ['0 */15 * * * *', '0 0 8,20 * * *', '0 5 8,20 * * *']);
  assert.deepEqual(dev.schedules[0].calls, [{ method: 'Script.Start', params: { id: 2 } }]);
  assert.deepEqual(dev.schedules[1].calls, [{ method: 'Script.Start', params: { id: 3 } }]);
  assert.deepEqual(dev.schedules[2].calls, [{ method: 'Switch.Set', params: { id: 0, on: false } }]);
  assert.equal(dev.script('bw_main').enable, false);
  assert.equal(dev.script('bw_pump').enable, false);
  assert.equal(dev.switches[0].config.initial_state, 'off');
  assert.equal(dev.switches[0].config.auto_off, true);
  assert.equal(dev.switches[0].config.auto_off_delay, 130);
  assert.equal(dev.kvsGet('st').state, 'beob');
  assert.equal(dev.kvsGet('job').ok, false);
  assert.equal(dev.kvsGet('cfg2').pctSoll, null);
  assert.match(r.log.join('\n'), /Script-IDs: install=1 main=2 pump=3/);
});

test('Retry: der am Gerät fehlschlagende erste Schedule.Create wird wiederholt, alle drei Einträge entstehen', () => {
  const dev = new Device();               // schedCreateFailFirst ist standardmäßig an (Gerätequirk)
  const r = runScript(dev, FILES.bw_install);
  ok(r);
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ['0 */15 * * * *', '0 0 8,20 * * *', '0 5 8,20 * * *'], 'Takt-Eintrag trotz erstem Fehlschlag vorhanden');
  const creates = dev.rpcLog.filter((c) => c.method === 'Schedule.Create').length;
  assert.equal(creates, 4, 'ein fehlgeschlagener plus drei erfolgreiche Create-Aufrufe');
  assert.match(r.log.join('\n'), /Versuch 1\/3/);
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

test('Fenster mit ungleichen Minuten ergeben je zwei Einträge, Sicherheits-Aus mit Minutenübertrag', () => {
  const dev = new Device();
  ok(runScript(dev, FILES.bw_install));
  patch(dev, 'cfg3', { winA: '07:30', winB: '19:57' });
  ok(runScript(dev, FILES.bw_install));
  assert.deepEqual(dev.schedules.map((j) => j.timespec), ['0 */15 * * * *', '0 30 7 * * *', '0 57 19 * * *', '0 35 7 * * *', '0 2 20 * * *']);
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
  assert.equal(r.writes, 0, 'alle acht Einträge wurden gefunden, nichts neu angelegt');
  assert.equal(dev.switches[0].config.auto_off_delay, 70);
});
