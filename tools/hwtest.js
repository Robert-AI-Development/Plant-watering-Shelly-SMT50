// tools/hwtest.js v0.1.2 – Hardware-Test, Zeitraffer, Messlauf und Kalibrierlauf vom VPS aus steuern: Vorprüfung, Eingang aktivieren, hwt setzen, starten, mitlesen, Kommandos, Bericht, Rückbau, Aufräumen, Not-Aus
//
// Aufruf: node tools/hwtest.js <ip> <kommando> [args]   (ip z. B. 127.0.0.1:8010 über den SSH-Tunnel, Handbuch Kapitel 6)
//   preflight [hw]         Uhrzeit, Sekunden bis zum 15-min-Takt, Abstand zu winA/winB/Mitternacht, Scripts (running), Input 1, Switch 0,
//                          KVS (err/job/day/hwt/hwb*), Debug-Websocket; legt bw_zeitraffer (mit „hw" auch bw_hwtest/bw_hwpump) per Script.Create an
//                          und nennt die Upload-Befehle. Die Hardware-Test-Scripts kosten Flash (LEARNING.md) – nur anlegen, wenn sie gebraucht werden
//   scripts                Alle Scripts mit Größe am Gerät, laufend, mem_peak, Fehlern; fs_free/ram_free
//   delete <id|name>       Script am Gerät löschen (Script.Delete) und fs_free vorher/nachher zeigen – nie bw_install/bw_main/bw_pump/bw_zeitraffer
//   input-on               Input.SetConfig {id: cfg1.idLvl, config: {enable: true, type: "switch"}} + Kontrolle (einzige Konfigänderung, nur auf Zuruf)
//   cfg k=v …              hwt-Felder setzen (Werte als JSON), z. B. cfg pumpSec=30 tLo=21 run='"m"'
//   start <name> [sek]     hwc {n:0} schreiben, alten Bericht löschen, Script per Name starten (bw_hwtest | bw_hwpump), dann watch
//   watch [sek]            Konsole (Debug-Websocket) mitlesen + alle 5 s eine Statuszeile aus hwr/hwp (im Zeitraffer: st/job/day/err und Speicher
//                          von bw_main/bw_pump); startet Durchgang B von bw_hwpump, sobald bw_pump fertig ist; Ende, wenn kein Test-Script
//                          mehr läuft (im Zeitraffer: rein zeitgesteuert), sonst nach sek (Standard 120, max 300, im Zeitraffer 1800)
//   zeitraffer [sek]       Praxistest im Zeitraffer: Vorprüfung (Zielband, Wasserstand, Ausgang, Scripts, hwb*), sicherer Moment (Sekunde 8–30,
//                          ungerade Minute, nichts läuft), Script.Start bw_zeitraffer, mitlesen, danach Zeitplan/cfg3/auto_off prüfen, Fahrplan zeigen
//   normal [sek]           Zurück zum Normalbetrieb: sicherer Moment, Script.Start bw_install, mitlesen, danach Sicherung weg / Zeitplan normal prüfen
//                          (auch für ein Script-Update: der Installer ergänzt neue cfg-Felder)
//   mess [sek] [n] [beob]  Messlauf am Aufbau (Regelkreis-Planung): n Pulse Switch.Set on toggle_after sek (≤ 10 s), Sensor alle 2 s über beob s (Standard 90, max 300) je Puls;
//                          je Puls Feuchte vorher, tRise, Spitze, Ruhewert, Einschwingzeit, Gewinn %/s; Vorschläge für effMax/tPmin/tMin/tDead/tSoak/tStab;
//                          Rohdaten nach docs/kal/<datum>-mess.json. Nur wenn Ausgang aus, Schwimmer VOLL, kein Script läuft, nicht nahe den Fenstern
//   kal [sek]              Kalibrierlauf: Zeitraffer wie oben starten, Fahrplan trocken → mittel feucht → nass zeigen, Rekorder (Sensoren/Ausgang alle 5 s,
//                          st/job/lrn bei Änderung) über sek s (Standard 2400, max 3600) nach docs/kal/<datum>-kal.json, am Ende Bericht; danach normal
//   kal report [datei] [log]  Bericht aus der (jüngsten) Aufzeichnung: je Fenster Zustand nach m0, Portionen, Σs, tRise, Spitze, Ruhewert, effW, why;
//                          Gewinn je Zustand, Referenz nass, Vorschläge lrn.effW (Skala „% je s nach tRise" aus den bw_pump-Konsolenzeilen, die der
//                          Rekorder mitschreibt; log = watch-Logdatei zum Nachziehen), cfg4.tDead2, cfg3.tDead (Rechenkern tools/lib/kal.js)
//   kal write [datei] [log]   Vorschläge schreiben (nur im Normalbetrieb – verweigert bei zrb1; Lesen-Ändern-Schreiben, effW als Mischung α 0,5); Vorher/Nachher
//   go | skip | abort      Kommando an das laufende Script (hwc n+1)
//   status                 Einzeiler: laufende Scripts, hwr, hwp, Sensoren, Switch
//   report                 hwr/hwp lesbar aufbereitet + Vergleich mit cfg1
//   restore                hwb1/hwb2 → st/day/job/err/lrn zurückschreiben (nur wenn bw_hwpump nicht läuft), job.ok=false, hwb löschen
//   cleanup                hwc/hwb1/hwb2 löschen (hwt, hwr, hwp bleiben als Nachweis)
//   stop                   Not-Aus: Script.Stop bw_hwtest, bw_hwpump, bw_pump und Switch.Set {on:false}
// Node ≥ 22 (fetch, globales WebSocket), keine Abhängigkeiten. Exit-Code 0 ok, 1 Fehler/Blocker, 2 Aufruffehler.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const [ip, cmd, ...rest] = process.argv.slice(2);
if (!ip || !cmd) { console.error('Aufruf: node tools/hwtest.js <ip> <preflight|input-on|cfg|start|watch|go|skip|abort|status|report|restore|cleanup|stop|zeitraffer|normal|mess|kal|scripts|delete> [args]'); process.exit(2); }

const TEST_SCRIPTS = ['bw_hwtest', 'bw_hwpump', 'bw_zeitraffer'];
const HW_SCRIPTS = ['bw_hwtest', 'bw_hwpump'];   // Scripts mit Kommandokanal hwc und Bericht hwr/hwp
const BUSY = ['bw_install', 'bw_main', 'bw_pump', 'bw_hwtest', 'bw_hwpump', 'bw_zeitraffer'];
const HW_PHASES = ['t1', 't2', 'm1', 'm2', 'l1', 'l2'];
const HP_PHASES = ['p0', 'p1', 'p2', 'p3'];
const CODES = { ok: 'ok', sk: 'übersprungen', to: 'Timeout', ab: 'Abbruch', fe: 'blockiert/Fehler', nl: 'Sensor null', aw: 'Abweichung', '-': 'offen' };

async function rpc(method, params) {
  let last = null;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('http://' + ip + '/rpc/' + method, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params || {}), signal: AbortSignal.timeout(10000),
      });
      const j = await r.json();
      if (j && typeof j.code === 'number' && j.code < 0) { const e = new Error(method + ': ' + (j.message || j.msg)); e.code = j.code; throw e; }
      return j;
    } catch (e) {
      if (e.code !== undefined) throw e;           // RPC-Fehler vom Gerät: nicht wiederholen
      last = e;
      await new Promise((res) => setTimeout(res, 1000));   // Tunnel/Netz: kurz warten, nochmal
    }
  }
  throw new Error(method + ': ' + last.message + ' – Tunnel 127.0.0.1:8010 offen? (Handbuch 6)');
}
function parseKvs(v) { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return null; } }
async function kvsGet(key) { try { const r = await rpc('KVS.Get', { key: key }); return parseKvs(r.value); } catch (e) { if (e.code === -105) return undefined; throw e; } }
async function kvsSet(key, obj) { return rpc('KVS.Set', { key: key, value: JSON.stringify(obj) }); }
async function kvsDel(key) { try { await rpc('KVS.Delete', { key: key }); return true; } catch (e) { if (e.code === -105) return false; throw e; } }
async function scripts() { return (await rpc('Script.List')).scripts || []; }
async function scriptByName(name) { return (await scripts()).find((s) => s.name === name) || null; }
function hhmm(s) { const m = /^(\d\d):(\d\d)/.exec(s || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function fmtPhases(st, ids) {
  if (!st) return '-';
  const parts = String(st.r || '').split(',');
  return ids.map((id, i) => id + ':' + (parts[i] || '-')).join(' ');
}
function num(v, d) { return typeof v === 'number' ? v.toFixed(d) : '-'; }
function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

async function sensors() {
  const cfg1 = (await kvsGet('cfg1')) || {};
  const [v, t, i, sw, sys] = await Promise.all([
    rpc('Voltmeter.GetStatus', { id: cfg1.idV === undefined ? 100 : cfg1.idV }).catch(() => ({})),
    rpc('Temperature.GetStatus', { id: cfg1.idT === undefined ? 100 : cfg1.idT }).catch(() => ({})),
    rpc('Input.GetStatus', { id: cfg1.idLvl === undefined ? 1 : cfg1.idLvl }).catch(() => ({})),
    rpc('Switch.GetStatus', { id: cfg1.idSw === undefined ? 0 : cfg1.idSw }).catch(() => ({})),
    rpc('Sys.GetStatus'),
  ]);
  return { cfg1, V: v.voltage, tC: t.tC, lvl: i.state, sw: sw.output, sys };
}

async function preflight(mode) {
  let blockers = 0;
  const create = mode === 'hw' ? TEST_SCRIPTS : ['bw_zeitraffer'];   // Hardware-Test-Scripts nur mit „preflight hw" anlegen (Flash)
  const warn = (s) => { console.log('WARNUNG  ' + s); };
  const block = (s) => { console.log('BLOCKER  ' + s); blockers++; };
  const info = (s) => { console.log('ok       ' + s); };
  const s = await sensors();
  const sys = s.sys;
  const min = hhmm(sys.time);
  if (min === null || !sys.unixtime) block('Uhrzeit nicht gesetzt (NTP)'); else {
    const q = (min % 15) * 60 + (sys.unixtime % 60);
    info('Uhrzeit ' + sys.time + ' lokal, ' + (900 - q) + ' s bis zum nächsten bw_main-Takt, ram_free ' + sys.ram_free + ', fs_free ' + sys.fs_free);
    const cfg3 = (await kvsGet('cfg3')) || {};
    for (const w of [cfg3.winA, cfg3.winB, '00:00']) {
      const wm = hhmm(w); if (wm === null) continue;
      let d = min - wm; if (d > 720) d -= 1440; if (d < -720) d += 1440;
      if (Math.abs(d) < 30) warn('Fenster ' + w + ' ist ' + Math.abs(d) + ' min entfernt – Pumpentest wartet (winMin) bzw. lieber später');
    }
  }
  const cfg = await rpc('Sys.GetConfig');
  if (cfg.debug && cfg.debug.websocket && cfg.debug.websocket.enable) info('Debug-Websocket an'); else warn('Debug-Websocket aus – watch zeigt keine Konsole (Web-UI → Konsole öffnen oder Sys.SetConfig debug.websocket.enable)');
  const list = await scripts();
  for (const sc of list) { if (sc.running) (TEST_SCRIPTS.includes(sc.name) ? warn : block)('Script ' + sc.id + ' ' + sc.name + ' läuft'); }
  info('Scripts: ' + list.map((x) => x.id + '=' + x.name).join(', '));
  for (const name of create) {
    if (!list.find((x) => x.name === name)) {
      const r = await rpc('Script.Create', { name: name });
      info('Script ' + name + ' angelegt als id ' + r.id);
      list.push({ id: r.id, name: name });
    }
  }
  for (const name of TEST_SCRIPTS) {
    const sc = list.find((x) => x.name === name);
    if (!sc) { info('Script ' + name + ' nicht am Gerät (anlegen: preflight hw)'); continue; }
    const g = await rpc('Script.GetCode', { id: sc.id, len: 1 }).catch(() => ({ left: -1 }));
    const bytes = g.left + 1;
    info('Upload ' + name + ': ' + (bytes > 0 ? bytes + ' Byte am Gerät' : 'leer') + ' – node tools/put-script.js ' + ip + ' ' + sc.id + ' dist/' + name + '.js');
  }
  const ic = await rpc('Input.GetConfig', { id: s.cfg1.idLvl === undefined ? 1 : s.cfg1.idLvl });
  if (!ic.enable || ic.type !== 'switch') block('Input ' + ic.id + ' (Wasserstand) ist ' + (ic.enable ? 'Typ ' + ic.type : 'deaktiviert') + ' → node tools/hwtest.js ' + ip + ' input-on');
  else info('Input ' + ic.id + ' aktiv, Typ switch, invert ' + ic.invert + ', state ' + s.lvl);
  if (s.sw === true) block('Ausgang (Pumpe) ist EIN'); else info('Ausgang aus');
  info('Sensoren: V=' + num(s.V, 3) + ' tC=' + num(s.tC, 1) + ' lvl=' + s.lvl);
  const err = await kvsGet('err'), job = await kvsGet('job'), day = await kvsGet('day'), hwt = await kvsGet('hwt');
  info('err=' + (err ? err.code : '-') + ' job.ok=' + (job ? job.ok : '-') + ' day.n=' + (day ? day.n : '-') + ' hwt=' + (hwt ? JSON.stringify(hwt) : '(fehlt, Script legt Startwerte an)'));
  if (err && err.code === 'noeff') warn('Störung noeff steht – bw_hwpump blockiert die Pumpenphase (err von Hand prüfen/löschen)');
  if ((await kvsGet('hwb1')) !== undefined || (await kvsGet('hwb2')) !== undefined) warn('hwb1/hwb2 aus einem abgebrochenen Lauf vorhanden – bw_hwpump baut beim Start zurück, oder: hwtest.js restore');
  console.log(blockers ? blockers + ' Blocker' : 'Vorprüfung ohne Blocker');
  process.exit(blockers ? 1 : 0);
}

async function inputOn() {
  const cfg1 = (await kvsGet('cfg1')) || {};
  const id = cfg1.idLvl === undefined ? 1 : cfg1.idLvl;
  const r = await rpc('Input.SetConfig', { id: id, config: { enable: true, type: 'switch' } });
  const st = await rpc('Input.GetStatus', { id: id });
  console.log('Input ' + id + ' aktiviert, Typ switch, restart_required=' + r.restart_required + ', state=' + st.state + (typeof st.state === 'boolean' ? ' – ok' : ' – noch null, Neustart nötig?'));
  process.exit(typeof st.state === 'boolean' ? 0 : 1);
}

async function cfgSet(args) {
  const hwt = (await kvsGet('hwt')) || {};
  for (const a of args) {
    const i = a.indexOf('='); if (i < 0) { console.error('Erwartet k=v: ' + a); process.exit(2); }
    hwt[a.slice(0, i)] = JSON.parse(a.slice(i + 1));
  }
  const s = JSON.stringify(hwt);
  if (s.length > 253) { console.error('hwt wäre ' + s.length + ' Zeichen (> 253)'); process.exit(1); }
  await kvsSet('hwt', hwt);
  console.log('hwt = ' + s);
}

async function sendCmd(c) {
  const cur = (await kvsGet('hwc')) || { n: 0 };
  const n = (typeof cur.n === 'number' ? cur.n : 0) + 1;
  await kvsSet('hwc', { n: n, cmd: c });
  console.log('Kommando ' + c + ' gesendet (n=' + n + ')');
}

async function statusLine() {
  const [hwr, hwp, zrb1, list, s] = await Promise.all([kvsGet('hwr'), kvsGet('hwp'), kvsGet('zrb1'), scripts(), sensors()]);
  const running = list.filter((x) => x.running).map((x) => x.name);
  const head = '[status ' + s.sys.time + '] läuft: ' + (running.length ? running.join(',') : '-') + ' | V=' + num(s.V, 3) + ' tC=' + num(s.tC, 1) + ' lvl=' + s.lvl + ' sw=' + (s.sw ? 'EIN' : 'aus');
  if (zrb1 === undefined) return head + ' | hwr: ' + (hwr ? hwr.s + ' ' + fmtPhases(hwr, HW_PHASES) : '-') + ' | hwp: ' + (hwp ? hwp.s + ' ' + fmtPhases(hwp, HP_PHASES) : '-');
  // Zeitraffer aktiv: Zustand der Betriebs-Scripts und ihr Speicher (Konsolenzeilen gehen am Websocket manchmal verloren)
  const [st, job, day, err] = await Promise.all([kvsGet('st'), kvsGet('job'), kvsGet('day'), kvsGet('err')]);
  const mem = [];
  for (const n of ['bw_main', 'bw_pump']) {
    const sc = list.find((x) => x.name === n); if (!sc) continue;
    const g = await rpc('Script.GetStatus', { id: sc.id }).catch(() => ({}));
    mem.push(n.slice(3) + '=' + (g.mem_used === undefined ? '-' : g.mem_used) + (g.mem_peak === undefined ? '' : '/' + g.mem_peak) + (g.errors && g.errors.length ? '!' + g.errors.join('/') : ''));
  }
  const win = st && typeof st.n === 'number' && st.n > 0 ? ' n=' + st.n + ' sec=' + st.sec + ' pctB=' + st.pctB + ' pctW=' + st.pctW + ' effW=' + st.effW + ' tr=' + st.tr : '';
  return head + ' | ZEITRAFFER st=' + (st ? st.state + '/' + st.why : '-') + win + ' job=' + (job ? job.why + '/' + job.sec : '-') + ' day.n=' + (day ? day.n : '-') + ' err=' + (err && err.code ? err.code : '-') + ' mem(used/peak) ' + mem.join(' ') + ' free=' + s.sys.ram_free;
}

async function watch(seconds, before, opts) {
  opts = opts || {};
  const zrActive = (await kvsGet('zrb1')) !== undefined;   // Zeitraffer läuft: kein Test-Script, rein zeitgesteuert mitlesen
  const names = opts.names || TEST_SCRIPTS;
  seconds = Math.min(Number(seconds || 120), opts.max || (zrActive ? 1800 : 300));
  const t0 = Date.now();
  let lastStatus = '';
  let ws = null;
  let passB = 0;
  function connect() {
    try {
      ws = new WebSocket('ws://' + ip + '/debug/log');
      ws.onmessage = (ev) => {
        let line = String(ev.data);
        try { const j = JSON.parse(line); if (j && typeof j.data === 'string') line = j.data.replace(/\n$/, ''); } catch (e) { /* Rohzeile */ }
        if (/^(shos_rpc_inst\.c|shelly_ejs_rpc\.cpp|y_notifications\.cpp|shelly_debug\.cpp|shelly_script\.cpp|shos_init\.c|mgos_)/.test(line)) return;   // Firmware-Rauschen
        console.log(line);
        if (opts.onLine) opts.onLine(line);
      };
      ws.onclose = () => { ws = null; };
      ws.onerror = () => { ws = null; };
    } catch (e) { ws = null; }
  }
  connect();
  if (before) { await new Promise((res) => setTimeout(res, 700)); await before(); }   // Konsole steht, bevor das Script startet
  for (;;) {
    let st, list;
    try { st = await statusLine(); list = await scripts(); }
    catch (e) { console.log('[status] RPC-Fehler, weiter: ' + e.message); await sleep(5000); if (Date.now() - t0 > seconds * 1000) break; continue; }   // Tunnel-Hänger überstehen
    if (st !== lastStatus) { console.log(st); lastStatus = st; }
    const running = list.some((x) => names.includes(x.name) && x.running);
    if (!running && !opts.keepGoing && !(zrActive && !opts.names) && Date.now() - t0 > 3000) {
      // Pumpentest Durchgang B: Sicherung vorhanden und bw_pump fertig → bw_hwpump erneut starten (bewertet, baut zurück)
      const pump = list.find((x) => x.name === 'bw_pump');
      const hwpump = list.find((x) => x.name === 'bw_hwpump');
      const backup = names.includes('bw_hwpump') && ((await kvsGet('hwb1')) !== undefined || (await kvsGet('hwb2')) !== undefined);
      if (backup && pump && pump.running) { await sleep(5000); continue; }   // bw_pump pumpt noch: weiter warten
      if (backup && hwpump && pump && !pump.running && passB < 2) {
        passB++;
        await sleep(2000);
        const r = await rpc('Script.Start', { id: hwpump.id });
        console.log('Durchgang B: Script.Start bw_hwpump → ' + JSON.stringify(r));
        continue;
      }
      console.log('kein ' + (opts.names ? names.join('/') : 'Test-Script') + ' läuft mehr' + (backup ? ' – Sicherung hwb1/hwb2 steht noch (bw_pump läuft?), später: watch oder restore' : ''));
      break;
    }
    if (Date.now() - t0 > seconds * 1000) { console.log('watch-Zeit um (' + seconds + ' s) – erneut aufrufen'); break; }
    if (!ws) connect();
    await new Promise((res) => setTimeout(res, 5000));
  }
  if (ws) try { ws.close(); } catch (e) { /* egal */ }
  if (!opts.noExit) process.exit(0);
}

async function start(name, seconds) {
  if (!HW_SCRIPTS.includes(name)) { console.error('start <bw_hwtest|bw_hwpump> [sek] – Zeitraffer: hwtest.js zeitraffer'); process.exit(2); }
  const sc = await scriptByName(name);
  if (!sc) { console.error('Script ' + name + ' fehlt am Gerät – preflight legt es an'); process.exit(1); }
  if (sc.running) { console.error(name + ' läuft bereits'); process.exit(1); }
  await kvsSet('hwc', { n: 0, cmd: '' });
  await kvsDel(name === 'bw_hwtest' ? 'hwr' : 'hwp');
  await watch(seconds || 60, async () => {
    const r = await rpc('Script.Start', { id: sc.id });
    console.log('Script.Start ' + name + ' (id ' + sc.id + ') → ' + JSON.stringify(r));
  });
}

async function report() {
  const [hwr, hwp, cfg1] = await Promise.all([kvsGet('hwr'), kvsGet('hwp'), kvsGet('cfg1')]);
  if (hwr) {
    console.log('== bw_hwtest (Sensoren) – ' + hwr.s + ', ' + hwr.dur + ' s, ram_min ' + hwr.mem + ', Vermerke: ' + (hwr.n || '-'));
    const parts = String(hwr.r).split(',');
    HW_PHASES.forEach((id, i) => console.log('  ' + id + ' ' + (CODES[parts[i]] || parts[i] || '-')));
    console.log('  Temperatur min ' + num(hwr.t[0], 1) + ' °C, max ' + num(hwr.t[1], 1) + ' °C');
    console.log('  Feuchte trocken ' + num(hwr.m[0], 3) + ' V, nass ' + num(hwr.m[1], 3) + ' V | cfg1 jetzt vDry=' + cfg1.vDry + ' vWet=' + cfg1.vWet + ' | Kalibrierung ' + hwr.cal);
    console.log('  Wasserstand leer=' + hwr.l[0] + ' voll=' + hwr.l[1] + ' Wechsel=' + hwr.chg + ' | cfg1 jetzt lvlEmpty=' + cfg1.lvlEmpty);
  } else console.log('== bw_hwtest: kein Bericht (hwr fehlt)');
  if (hwp) {
    console.log('== bw_hwpump (Pumpe) – ' + hwp.s + ', ' + hwp.dur + ' s, ram_min ' + hwp.mem + (hwp.rec ? ', Wiederanlauf' : ''));
    const parts = String(hwp.r).split(',');
    HP_PHASES.forEach((id, i) => console.log('  ' + id + ' ' + (CODES[parts[i]] || parts[i] || '-')));
    console.log('  Auftrag ' + hwp.pumpSec + ' s, bw_pump hat ' + hwp.sec + ' s eingetragen, st=' + hwp.st + ' why=' + hwp.why);
  } else console.log('== bw_hwpump: kein Bericht (hwp fehlt)');
}

async function restore() {
  const sc = await scriptByName('bw_hwpump');
  if (sc && sc.running) { console.error('bw_hwpump läuft – erst stop'); process.exit(1); }
  const b1 = await kvsGet('hwb1'), b2 = await kvsGet('hwb2');
  if (!b1 && !b2) { console.log('keine Sicherung (hwb1/hwb2) vorhanden'); return; }
  const w = {};
  if (b1) { if (b1.st) w.st = b1.st; if (b1.day) w.day = b1.day; }
  if (b2) { if (b2.job) w.job = b2.job; if (b2.err) w.err = b2.err; if (b2.lrn) w.lrn = b2.lrn; }
  if (w.job && w.job.ok === true) w.job.ok = false;
  const job = await kvsGet('job');
  if (!w.job && job && job.ok === true) { job.ok = false; w.job = job; }
  for (const k of Object.keys(w)) { await kvsSet(k, w[k]); console.log('zurückgeschrieben: ' + k + ' = ' + JSON.stringify(w[k])); }
  for (const k of ['hwb1', 'hwb2']) if (await kvsDel(k)) console.log('gelöscht: ' + k);
}

async function cleanup() {
  for (const k of ['hwc', 'hwb1', 'hwb2']) console.log(k + ': ' + ((await kvsDel(k)) ? 'gelöscht' : 'nicht vorhanden'));
}

async function stop() {
  const list = await scripts();
  for (const name of TEST_SCRIPTS.concat(['bw_pump'])) {
    const sc = list.find((x) => x.name === name);
    if (sc) { const r = await rpc('Script.Stop', { id: sc.id }); console.log('Script.Stop ' + name + ' → was_running=' + r.was_running); }
  }
  const cfg1 = (await kvsGet('cfg1')) || {};
  const r = await rpc('Switch.Set', { id: cfg1.idSw === undefined ? 0 : cfg1.idSw, on: false });
  console.log('Switch.Set aus → was_on=' + r.was_on + ' – danach: hwtest.js restore');
}

// ---- Zeitraffer (bw_zeitraffer.js) und Rückkehr (bw_install.js) ------------------------------------------------
// Sicherer Moment für bw_zeitraffer/bw_install: Sekunde 8–30 (bw_main vom Takt ist fertig, der nächste ist weit weg), bei gesetztem
// winEvery nicht in den Minuten 0…ceil((30 + tWin)/60) − 1 jedes winEvery-Zyklus (dort regelt bw_pump im Fenster; ein Rückbau dazwischen
// ginge verloren; tWin 120 → Minuten 0, 1, 2), im Normalbetrieb bis SAFE_MIN + 1 min nach winA/winB (Fenster bis 30 + tWin s, Sicherheits-Aus
// bei SAFE_MIN), und keins der Betriebs-/Test-Scripts läuft. cfg4 optional (sonst aus dem KVS; fehlt es: tWin 420). Pollt alle 2 s, höchstens 4 min.
const PUMP_SEC = 30;   // wie im Installer: bw_pump startet 30 s nach der vollen Minute
function safeMin(cfg4) { return Math.ceil((PUMP_SEC + (cfg4 && typeof cfg4.tWin === 'number' ? cfg4.tWin : 420) + 10) / 60); }
async function safeMoment(cfg3, cfg4) {
  if (!cfg4) cfg4 = (await kvsGet('cfg4')) || {};
  const tWin = typeof cfg4.tWin === 'number' ? cfg4.tWin : 420;
  const zrBlock = Math.ceil((PUMP_SEC + tWin) / 60), nBlock = safeMin(cfg4) + 1;
  const t0 = Date.now();
  let last = '';
  for (;;) {
    const [sys, list] = await Promise.all([rpc('Sys.GetStatus'), scripts()]);
    const min = hhmm(sys.time), sec = sys.unixtime % 60;
    const busy = list.filter((x) => x.running && BUSY.includes(x.name)).map((x) => x.name);
    let why = '';
    if (min === null || !sys.unixtime) why = 'Uhrzeit nicht gesetzt (NTP)';
    else if (sec < 8 || sec > 30) why = 'Sekunde ' + sec + ', warte auf 8–30';
    else if (typeof cfg3.winEvery === 'number' && cfg3.winEvery > 1 && min % cfg3.winEvery < zrBlock) why = 'Fenster des Zeitraffers (bw_pump regelt bis Minute ' + (zrBlock - 1) + ' des ' + cfg3.winEvery + '-min-Zyklus, tWin ' + tWin + ' s)';
    else if (typeof cfg3.winEvery !== 'number') {
      for (const w of [cfg3.winA, cfg3.winB]) { const wm = hhmm(w); if (wm !== null && (min - wm + 1440) % 1440 <= nBlock) why = 'Gießfenster ' + w + ' gerade vorbei, Fenster läuft bis ' + nBlock + ' min danach'; }
    }
    if (!why && busy.length) why = 'läuft: ' + busy.join(',');
    if (!why) { console.log('sicherer Moment: ' + sys.time + ':' + (sec < 10 ? '0' : '') + sec); return sys; }
    if (Date.now() - t0 > 240000) { console.error('kein sicherer Moment in 4 min: ' + why); process.exit(1); }
    if (why !== last) { console.log('warte – ' + why); last = why; }
    await sleep(2000);
  }
}

// Zeitplan, den bw_install aus cfg3/cfg4 baut (gleiche Regeln wie im Script): Takt, Fenster, Sicherheits-Aus safeSec = 30 + tWin + 10 s
// (normal SAFE_MIN = aufgerundete Minuten nach winA/winB; Zeitraffer Minutenliste mit Sekundenfeld, z. B. tWin 120 → "40 2,8,14,… * * * *")
function expectedSpecs(cfg3, cfg4) {
  const tWin = cfg4 && typeof cfg4.tWin === 'number' ? cfg4.tWin : 420;
  const safeSec = PUMP_SEC + tWin + 10;
  const every = (sec, n) => sec + ' ' + (n === 1 ? '*' : '*/' + n) + ' * * * *';
  const out = [every(0, cfg3.tick)];
  if (typeof cfg3.winEvery === 'number') {
    const mins = [];
    for (let m = Math.floor(safeSec / 60); m < 60; m += cfg3.winEvery) mins.push(m);
    out.push(every(PUMP_SEC, cfg3.winEvery));
    out.push((safeSec % 60) + ' ' + mins.join(',') + ' * * * *');
    return out;
  }
  const t = (s) => ({ h: Number(s.slice(0, 2)), m: Number(s.slice(3, 5)) });
  const add = (x, plus) => { let m = x.m + plus, h = x.h; while (m >= 60) { m -= 60; h++; } return { h: h % 24, m: m }; };
  const specs = (sec, a, b) => a.m === b.m ? [sec + ' ' + a.m + ' ' + (a.h === b.h ? a.h : Math.min(a.h, b.h) + ',' + Math.max(a.h, b.h)) + ' * * *'] : [sec + ' ' + a.m + ' ' + a.h + ' * * *', sec + ' ' + b.m + ' ' + b.h + ' * * *'];
  const a = t(cfg3.winA), b = t(cfg3.winB), sm = safeMin(cfg4);
  return out.concat(specs(PUMP_SEC, a, b), specs(0, add(a, sm), add(b, sm)));
}

// Nach bw_install prüfen: eigene Zeitplan-Einträge, cfg3/cfg4, Marke/Sicherung zrb1..5, auto_off, Script-Fehler. Liefert die Zahl der Abweichungen.
async function verifyState(expectZr) {
  let bad = 0;
  const miss = (s) => { console.log('ABWEICHUNG ' + s); bad++; };
  const info = (s) => { console.log('ok       ' + s); };
  const ZRB = ['zrb1', 'zrb2', 'zrb3', 'zrb4', 'zrb5'];
  const [cfg1, cfg3, cfg4, zr, list, sch] = await Promise.all([kvsGet('cfg1'), kvsGet('cfg3'), kvsGet('cfg4'), kvsGet('zr'), scripts(), rpc('Schedule.List')]);
  const zrb = {};
  for (const k of ZRB) zrb[k] = await kvsGet(k);
  const ids = { main: (list.find((x) => x.name === 'bw_main') || {}).id, pump: (list.find((x) => x.name === 'bw_pump') || {}).id };
  const own = (sch.jobs || []).filter((j) => (j.calls || []).some((c) => (c.method === 'Script.Start' && (c.params.id === ids.main || c.params.id === ids.pump)) || (c.method === 'Switch.Set' && c.params.id === cfg1.idSw)));
  if (cfg4 === undefined) miss('cfg4 fehlt – bw_install v0.1.3 legt es an (Fenster-Regelkreis)');
  const got = own.map((j) => j.timespec).sort(), want = expectedSpecs(cfg3, cfg4).sort();
  if (JSON.stringify(got) === JSON.stringify(want)) info('Zeitplan: ' + own.map((j) => '#' + j.id + ' [' + j.timespec + ']').join(' ')); else miss('Zeitplan ist ' + JSON.stringify(got) + ', erwartet ' + JSON.stringify(want) + ' (Schedule.Create abgelehnt? Minutenliste vom Gerät verweigert? Konsole prüfen)');
  const sw = await rpc('Switch.GetConfig', { id: cfg1.idSw });
  if (sw.auto_off === true && sw.auto_off_delay === cfg3.tMax + 10) info('auto_off ' + sw.auto_off_delay + ' s'); else miss('auto_off ' + sw.auto_off + '/' + sw.auto_off_delay + ', erwartet ' + (cfg3.tMax + 10));
  if (zr !== undefined) miss('Marke zr steht noch – bw_install ist nicht durchgelaufen');
  const have = ZRB.filter((k) => zrb[k] !== undefined), lack = ZRB.filter((k) => zrb[k] === undefined);
  if (expectZr) {
    if (lack.length) miss('Sicherung ' + lack.join(',') + ' fehlt'); else info('Sicherung zrb1..5 vorhanden (Original: tick ' + zrb.zrb1.cfg3.tick + ', tMax ' + zrb.zrb1.cfg3.tMax + ', tWin ' + (zrb.zrb4.cfg4 || {}).tWin + ', pctDry ' + (zrb.zrb5.cfg2 || {}).pctDry + ')');
    if (typeof cfg3.winEvery === 'number' && cfg3.tick < 15 && cfg4 && cfg4.tWin < 420) info('Profil: Takt ' + cfg3.tick + ' min, Fenster alle ' + cfg3.winEvery + ' min, Budget ' + cfg4.tWin + ' s, bis ' + cfg4.nPort + ' Portionen, tStd ' + cfg3.tStd + ' s, tHot ' + cfg3.tHot + ' °C, maxDay ' + cfg3.maxDay + ', pctDry ' + ((await kvsGet('cfg2')) || {}).pctDry); else miss('cfg3/cfg4 tragen nicht das Zeitraffer-Profil: ' + JSON.stringify(cfg3) + ' ' + JSON.stringify(cfg4));
  } else {
    if (have.length) miss('Sicherung ' + have.join(',') + ' steht noch'); else info('keine Zeitraffer-Sicherung');
    if (typeof cfg3.winEvery !== 'number') info('cfg3/cfg4: Takt ' + cfg3.tick + ' min, Fenster ' + cfg3.winA + '/' + cfg3.winB + ', tMax ' + cfg3.tMax + ' s, tWin ' + (cfg4 || {}).tWin + ' s, Sicherheits-Aus +' + safeMin(cfg4) + ' min'); else miss('cfg3.winEvery ist noch gesetzt: ' + cfg3.winEvery);
  }
  for (const n of ['bw_install', 'bw_zeitraffer', 'bw_main', 'bw_pump']) {
    const sc = list.find((x) => x.name === n); if (!sc) continue;
    const g = await rpc('Script.GetStatus', { id: sc.id }).catch(() => ({}));
    if (g.errors && g.errors.length) miss(n + ' meldet ' + g.errors.join('/') + (g.error_msg ? ': ' + g.error_msg : '')); 
  }
  const sys = await rpc('Sys.GetStatus');
  info('Script-Heap frei: ' + ((await rpc('Script.GetStatus', { id: 1 }).catch(() => ({}))).mem_free || '-') + ', ram_free ' + sys.ram_free + ', kvs_rev ' + sys.kvs_rev);
  return bad;
}

async function zeitraffer(seconds, opts) {
  opts = opts || {};
  let blockers = 0;
  const block = (s) => { console.log('BLOCKER  ' + s); blockers++; };
  const warn = (s) => { console.log('WARNUNG  ' + s); };
  const info = (s) => { console.log('ok       ' + s); };
  const s = await sensors();
  if (hhmm(s.sys.time) === null || !s.sys.unixtime) block('Uhrzeit nicht gesetzt (NTP)'); else info('Uhrzeit ' + s.sys.time + ' lokal, ram_free ' + s.sys.ram_free + ', fs_free ' + s.sys.fs_free);
  const cfg2 = (await kvsGet('cfg2')) || {}, cfg3 = (await kvsGet('cfg3')) || {};
  const open = ['pctSoll', 'pctLo', 'pctOk', 'pctHi', 'pctDry', 'dropSlow'].filter((k) => typeof cfg2[k] !== 'number');
  if (open.length) block('cfg2 Zielband unvollständig (' + open.join(',') + ') – ohne Band gießt bw_main nie (why=cfg); Werte per KVS.Set cfg2 eintragen');
  else if (!(cfg2.pctDry < cfg2.pctLo && cfg2.pctLo < cfg2.pctOk && cfg2.pctOk <= cfg2.pctSoll && cfg2.pctSoll < cfg2.pctHi)) block('cfg2 Zielband nicht geordnet (pctDry < pctLo < pctOk ≤ pctSoll < pctHi): ' + JSON.stringify(cfg2));
  else info('cfg2 Zielband: pctLo ' + cfg2.pctLo + ' → Gabe, pctOk ' + cfg2.pctOk + ' Ziel erreicht, pctSoll ' + cfg2.pctSoll + ', pctHi ' + cfg2.pctHi + ' zu viel, pctDry ' + cfg2.pctDry);
  if (typeof cfg3.tick !== 'number') block('cfg3.tick fehlt – erst den Installer starten (node tools/hwtest.js ' + ip + ' normal)');
  const lvlEmpty = s.cfg1.lvlEmpty === undefined ? 1 : s.cfg1.lvlEmpty;
  if (typeof s.lvl !== 'boolean') block('Eingang ' + (s.cfg1.idLvl === undefined ? 1 : s.cfg1.idLvl) + ' liefert keinen Wert → input-on');
  else if ((s.lvl ? 1 : 0) === lvlEmpty) block('Schwimmer meldet LEER – Behälter füllen, sonst gießt bw_pump nicht (why=wasser)');
  else info('Wasserstand VOLL (lvl=' + s.lvl + ')');
  if (s.sw === true) block('Ausgang (Pumpe) ist EIN'); else info('Ausgang aus');
  info('Sensoren: V=' + num(s.V, 3) + ' (' + (s.cfg1.vDry !== undefined ? Math.round((s.V - s.cfg1.vDry) / (s.cfg1.vWet - s.cfg1.vDry) * 100) : '?') + ' %) tC=' + num(s.tC, 1));
  const list = await scripts();
  for (const name of ['bw_install', 'bw_main', 'bw_pump', 'bw_zeitraffer']) {
    const sc = list.find((x) => x.name === name);
    if (!sc) { block('Script ' + name + ' fehlt am Gerät – preflight legt bw_zeitraffer an'); continue; }
    const g = await rpc('Script.GetCode', { id: sc.id, len: 1 }).catch(() => ({ left: -1 }));
    if (g.left + 1 <= 1) block(name + ' hat keinen Code – node tools/put-script.js ' + ip + ' ' + sc.id + ' dist/' + name + '.js');
  }
  if ((await kvsGet('hwb1')) !== undefined || (await kvsGet('hwb2')) !== undefined) block('hwb1/hwb2 vorhanden (Hardware-Test nicht zurückgebaut) → restore/cleanup');
  const err = await kvsGet('err');
  if (err && err.code === 'noeff') warn('Störung noeff steht – der Zeitraffer legt sie beiseite, bw_install stellt sie danach wieder her');
  if ((await kvsGet('zrb1')) !== undefined) warn('Zeitraffer ist schon aktiv – erneuter Start setzt den Testzustand zurück, die Sicherung bleibt');
  if (blockers) { console.log(blockers + ' Blocker – nicht gestartet'); process.exit(1); }
  const zr = list.find((x) => x.name === 'bw_zeitraffer');
  await safeMoment(cfg3);
  await watch(seconds || 60, async () => {
    const r = await rpc('Script.Start', { id: zr.id });
    console.log('Script.Start bw_zeitraffer (id ' + zr.id + ') → ' + JSON.stringify(r));
  }, { names: ['bw_zeitraffer', 'bw_install'], noExit: true });
  await sleep(1500);
  const bad = await verifyState(true);
  if (bad) { console.log(bad + ' Abweichungen – Konsole prüfen; zurück: node tools/hwtest.js ' + ip + ' normal'); process.exit(1); }
  const zc = (await kvsGet('cfg3')) || cfg3, z4 = (await kvsGet('cfg4')) || {}, z2 = (await kvsGet('cfg2')) || {};   // Profil nach der Aktivierung
  if (opts.kal) {
    console.log([
      'KALIBRIERLAUF – Zeitraffer aktiv (Takt ' + zc.tick + ' min, Fenster alle ' + zc.winEvery + ' min bei Sekunde 30, Budget ' + z4.tWin + ' s, bis ' + z4.nPort + ' Portionen à ' + z4.tPmin + '–' + z4.tPmax + ' s, maxDay ' + zc.maxDay + '; Trockenphase gilt hier nicht: pctDry ' + z2.pctDry + ', dryDay ' + zc.dryDay + ')',
      'Fahrplan (F1 = erstes Fenster: die erste 6er-Minute nach dem ersten Takt, Sekunde 30; Schlauch liegt AM Sensor):',
      '  vor dem Start  Sensor in TROCKENER Erde (< pctLo ' + cfg2.pctLo + ', ideal < pctDry ' + cfg2.pctDry + ') → Takt: why=ok, F1 (trocken): Portionen bis ins Band; Sensor stecken lassen',
      '  F1+3           Kontrolle (Nachlauf unter dem Tropfer) · DANACH Sensor in MITTEL FEUCHTE Erde (' + cfg2.pctDry + '–' + cfg2.pctLo + ' %, vorbefeuchtet: Gabe fällig) → Pause 12 min: F1+9 why=ok, F1+12:30 F2 (mittel); stecken lassen',
      '  F2+3           Kontrolle · DANACH Sensor ins NASSE Substrat oder Wasserglas (> pctHi ' + cfg2.pctHi + ') → why=trocken (Nässe startet die Trockenphase; hier endet sie unter ' + z2.pctDry + ' %), Fenster ohne Auftrag; ≥ 3 min drin lassen (Referenz nass)',
      '  optional       Sensor zurück in trockene Erde → F3 nach der Pause (zweiter Trocken-Wert), bis maxDay ' + zc.maxDay + ' (why=limit)',
      '  Ende           Strg+C oder Zeit um → node tools/hwtest.js ' + ip + ' normal 60 (Rückbau) → kal report → kal write',
    ].join('\n'));
    return;
  }
  console.log([
    'ZEITRAFFER AKTIV – mitlesen: node tools/hwtest.js ' + ip + ' watch 300 (beliebig oft) · zurück: node tools/hwtest.js ' + ip + ' normal',
    'Fahrplan (Minute ab der nächsten vollen 6er-Minute S; Takt alle ' + zc.tick + ' min, Fenster alle ' + zc.winEvery + ' min bei Sekunde 30, Budget ' + z4.tWin + ' s, bis ' + z4.nPort + ' Portionen):',
    '  vor 0 SMT50 im Wasserglas → 0 why=trocken (nass > pctHi: Trockenphase, endet unter ' + z2.pctDry + ' %), 0:30 bw_pump ohne Auftrag · 3 (nach dem Takt) SMT50 in trockene Erde, Schlauch AM Sensor',
    '  → 6:30 FENSTER 1: Portionen bis ins Band (P1 …, P2 …), st.n/effW · 9 Kontrolle, sperre, why=pause · 9–14 Sensor zurück in trockene Erde',
    '  → 15 why=ok, 18:30 FENSTER 2 (12 min Pause) · 19 Fühler > ' + zc.tHot + ' °C (warmes Wasser), Sensor trocken → 21 pause=0.1h, 24:30 FENSTER 3 (Hitze: 6 min)',
    '  25 Schwimmer LEER → 27 why=wasser err=wasser, 30:30 pumpt nicht · 31 Schwimmer VOLL, Sensor trocken → 33 why=ok, 36:30 FENSTER 4 · 39 why=limit (maxDay ' + zc.maxDay + ')',
    '  40 node tools/hwtest.js ' + ip + ' normal 60 → Rückbau (zrb1..5/zr weg) · Sicherheits-Aus des Zeitplans: Minute ≡ 2 mod 6, Sekunde 40',
  ].join('\n'));
  process.exit(0);
}

async function normal(seconds) {
  const list = await scripts();
  const inst = list.find((x) => x.name === 'bw_install');
  if (!inst) { console.error('Script bw_install fehlt am Gerät'); process.exit(1); }
  const cfg3 = (await kvsGet('cfg3')) || {};
  const zrb1 = await kvsGet('zrb1');
  console.log(zrb1 !== undefined ? 'Zeitraffer aktiv – bw_install schreibt das Original zurück' : 'kein Zeitraffer aktiv – bw_install läuft als normaler Installer (ergänzt fehlende Felder, baut den Zeitplan)');
  await safeMoment(cfg3);
  await watch(seconds || 60, async () => {
    const r = await rpc('Script.Start', { id: inst.id });
    console.log('Script.Start bw_install (id ' + inst.id + ') → ' + JSON.stringify(r));
  }, { names: ['bw_install'], noExit: true });
  await sleep(1500);
  const bad = await verifyState(false);
  if (bad) { console.log(bad + ' Abweichungen – Konsole prüfen'); process.exit(1); }
  console.log('NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet');
  process.exit(0);
}

// ---- Kalibrierlauf: Zeitraffer + Fahrplan trocken → mittel → nass, Rekorder, Bericht, Schreiben (Rechenkern tools/lib/kal.js) ----
const kalLib = require('./lib/kal.js');
const KAL_DIR = path.join(__dirname, '..', 'docs', 'kal');
function newestKal() {
  if (!fs.existsSync(KAL_DIR)) return null;
  const f = fs.readdirSync(KAL_DIR).filter((n) => /-kal\.json$/.test(n)).sort();
  return f.length ? path.join(KAL_DIR, f[f.length - 1]) : null;
}
function loadKal(fileArg, logArg) {
  const file = fileArg ? path.resolve(fileArg) : newestKal();
  if (!file || !fs.existsSync(file)) { console.error('keine Aufzeichnung gefunden (docs/kal/<datum>-kal.json) – erst: node tools/hwtest.js ' + ip + ' kal'); process.exit(1); }
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (logArg) {   // Konsolenzeilen aus einer watch-/kal-Logdatei nachziehen (Zuordnung zu den Fenstern in Reihenfolge)
    rec.lines = fs.readFileSync(path.resolve(logArg), 'utf8').split('\n').filter((l) => l.indexOf('[bw_pump') >= 0);
    console.log('Konsolenzeilen aus ' + logArg + ': ' + rec.lines.length);
  }
  return { file: file, rec: rec };
}
// Rekorder: alle 5 s Sensoren + Ausgang (Probe), st/job/lrn nur bei Änderung; Datei jede Minute fortgeschrieben (ein Tunnelabbruch kostet ≤ 1 min)
function recorder(file, meta) {
  const rec = Object.assign({ samples: [], sts: [], jobs: [], lrns: [], lines: [] }, meta);
  const t0 = Date.now();
  const last = { st: '', job: '', lrn: '' };
  let busy = false, n = 0;
  const save = () => { try { fs.writeFileSync(file, JSON.stringify(rec)); } catch (e) { console.log('[kal] Datei nicht geschrieben: ' + e.message); } };
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const [s, st, job, lrn] = await Promise.all([sensors(), kvsGet('st'), kvsGet('job'), kvsGet('lrn')]);
      const t = Math.round((Date.now() - t0) / 1000);
      rec.samples.push({ t: t, pct: typeof s.V === 'number' ? Math.round(pctOf(s.V, rec.cfg1) * 10) / 10 : null, V: s.V, tC: s.tC, lvl: s.lvl, sw: s.sw === true });
      for (const [k, v] of [['st', st], ['job', job], ['lrn', lrn]]) { const j = JSON.stringify(v); if (j !== last[k]) { const e = { t: t }; e[k] = v; rec[k + 's'].push(e); last[k] = j; } }
      if (++n % 12 === 0) save();
    } catch (e) { /* Tunnel-Hänger: diese Probe fehlt */ }
    busy = false;
  }
  const iv = setInterval(tick, 5000);
  tick();
  const onLine = (line) => { if (/\[bw_(pump|main) /.test(line)) rec.lines.push({ t: Math.round((Date.now() - t0) / 1000), line: line }); };
  return { rec: rec, onLine: onLine, stop: () => { clearInterval(iv); save(); return rec; } };
}
async function kal(sub, arg, arg2) {
  if (sub === 'report') {
    const k = loadKal(arg, arg2);
    console.log('Aufzeichnung: ' + path.relative(process.cwd(), k.file));
    console.log(kalLib.report(k.rec).join('\n'));
    process.exit(0);
  }
  if (sub === 'write') {
    const k = loadKal(arg, arg2);
    if ((await kvsGet('zrb1')) !== undefined) { console.error('Zeitraffer aktiv (zrb1) – erst: node tools/hwtest.js ' + ip + ' normal'); process.exit(1); }
    const busy = (await scripts()).filter((x) => x.running && BUSY.includes(x.name));
    if (busy.length) { console.error('läuft: ' + busy.map((x) => x.name).join(',') + ' – später erneut'); process.exit(1); }
    const lrn = (await kvsGet('lrn')) || {}, cfg4 = (await kvsGet('cfg4')) || {}, cfg3 = (await kvsGet('cfg3')) || {};   // Lesen-Ändern-Schreiben
    const plan = kalLib.writePlan(k.rec, lrn, cfg4, cfg3);
    console.log('Aufzeichnung: ' + path.relative(process.cwd(), k.file));
    for (const n of plan.notes) console.log('  ' + n);
    if (!plan.changed) { console.log('nichts zu schreiben'); process.exit(0); }
    console.log('vorher:  lrn=' + JSON.stringify(lrn) + ' cfg4=' + JSON.stringify(cfg4) + ' cfg3.tDead=' + cfg3.tDead);
    if (JSON.stringify(plan.lrn) !== JSON.stringify(lrn)) await kvsSet('lrn', plan.lrn);
    if (JSON.stringify(plan.cfg4) !== JSON.stringify(cfg4)) await kvsSet('cfg4', plan.cfg4);
    if (JSON.stringify(plan.cfg3) !== JSON.stringify(cfg3)) await kvsSet('cfg3', plan.cfg3);
    console.log('nachher: lrn=' + JSON.stringify(await kvsGet('lrn')) + ' cfg4=' + JSON.stringify(await kvsGet('cfg4')) + ' cfg3.tDead=' + ((await kvsGet('cfg3')) || {}).tDead);
    process.exit(0);
  }
  // kal [sek]: Zeitraffer starten (Vorprüfung, sicherer Moment, Prüfung wie zeitraffer), Fahrplan zeigen, aufzeichnen, Bericht
  const seconds = Math.min(Math.max(Number(sub || 2400), 600), 3600);
  const cfg2 = (await kvsGet('cfg2')) || {}, zrb5 = await kvsGet('zrb5');
  const band0 = zrb5 && zrb5.cfg2 ? zrb5.cfg2 : cfg2;   // das NORMALE Band (bei erneutem Start im Zeitraffer aus der Sicherung)
  await zeitraffer(60, { kal: true });
  const band = {};
  for (const k of ['pctDry', 'pctLo', 'pctOk', 'pctSoll', 'pctHi']) band[k] = band0[k];
  const cfg1 = (await kvsGet('cfg1')) || {}, cfg3 = await kvsGet('cfg3'), cfg4 = await kvsGet('cfg4');
  fs.mkdirSync(KAL_DIR, { recursive: true });
  const now = new Date();
  const file = path.join(KAL_DIR, now.toISOString().slice(0, 16).replace(/[:T]/g, '-') + '-kal.json');
  const r = recorder(file, { ip: ip, start: now.toISOString(), startUnix: Math.floor(now.getTime() / 1000), band: band, cfg1: cfg1, cfg3: cfg3, cfg4: cfg4 });
  console.log('Rekorder läuft ' + seconds + ' s → ' + path.relative(process.cwd(), file) + ' (Strg+C beendet früher; die Datei ist jede Minute aktuell, kal report wertet sie aus)');
  process.on('SIGINT', () => { r.stop(); console.log('\nabgebrochen – Aufzeichnung gespeichert; der Zeitraffer läuft weiter (normal 60 baut zurück)'); process.exit(0); });
  await watch(seconds, null, { noExit: true, max: 3600, onLine: r.onLine });
  const rec = r.stop();
  console.log(kalLib.report(rec).join('\n'));
  console.log('Zeitraffer läuft weiter – zurück: node tools/hwtest.js ' + ip + ' normal 60, dann: node tools/hwtest.js ' + ip + ' kal write ' + path.relative(process.cwd(), file));
  process.exit(0);
}

// ---- Scripts am Gerät: Liste mit Größe/Speicher, Löschen (Flash freiräumen, Entscheidung 15 in docs/PLAN.md) --------------------
async function listScripts() {
  const [list, sys] = await Promise.all([scripts(), rpc('Sys.GetStatus')]);
  for (const sc of list) {
    const g = await rpc('Script.GetCode', { id: sc.id, len: 1 }).catch(() => ({ left: -1 }));
    const st = await rpc('Script.GetStatus', { id: sc.id }).catch(() => ({}));
    console.log('Script ' + sc.id + ' ' + sc.name.padEnd(14) + String(g.left + 1).padStart(6) + ' Byte' + (sc.running ? ' läuft' : '      ') + (st.mem_peak === undefined ? '' : '  mem_peak ' + st.mem_peak) + (st.errors && st.errors.length ? '  Fehler ' + st.errors.join('/') : ''));
  }
  console.log('fs_free ' + sys.fs_free + ' Byte, ram_free ' + sys.ram_free + ', Script-Heap frei ' + ((await rpc('Script.GetStatus', { id: list.length ? list[0].id : 1 }).catch(() => ({}))).mem_free || '-'));
  process.exit(0);
}
async function deleteScript(idArg) {
  const KEEP = ['bw_install', 'bw_main', 'bw_pump', 'bw_zeitraffer'];
  const list = await scripts();
  const sc = list.find((x) => x.id === Number(idArg) || x.name === idArg);
  if (!sc) { console.error('Script ' + idArg + ' gibt es nicht am Gerät'); process.exit(1); }
  if (KEEP.includes(sc.name)) { console.error(sc.name + ' ist ein Betriebs-Script – wird nicht gelöscht'); process.exit(1); }
  if (sc.running) { console.error(sc.name + ' läuft – erst stop'); process.exit(1); }
  const before = (await rpc('Sys.GetStatus')).fs_free;
  await rpc('Script.Delete', { id: sc.id });
  const after = (await rpc('Sys.GetStatus')).fs_free;
  console.log('Script ' + sc.id + ' ' + sc.name + ' gelöscht: fs_free ' + before + ' → ' + after + ' Byte (+' + (after - before) + ')');
  process.exit(0);
}

// ---- Messlauf: Dosis-Wirkung am Aufbau messen (Regelkreis-Planung, kein Gerätecode) ------------------------------------
function pctOf(V, cfg1) { return Math.max(0, Math.min(100, (V - cfg1.vDry) / (cfg1.vWet - cfg1.vDry) * 100)); }
function median(a) { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; }
async function readV() { const r = await rpc('Voltmeter.GetStatus', { id: 100 }).catch(() => ({})); return typeof r.voltage === 'number' ? r.voltage : null; }
async function mess(sekArg, nArg, beobArg) {
  const sek = Math.min(Math.max(Number(sekArg || 3), 1), 10), n = Math.min(Math.max(Number(nArg || 3), 1), 6);
  const POLL = 2000, AFTER = Math.min(Math.max(Number(beobArg || 90), 30), 300) * 1000;   // Beobachtung je Puls in s
  const s = await sensors();
  const cfg1 = s.cfg1, cfg3 = (await kvsGet('cfg3')) || {};
  let blockers = 0;
  const block = (m) => { console.log('BLOCKER  ' + m); blockers++; };
  if (hhmm(s.sys.time) === null) block('Uhrzeit nicht gesetzt');
  if (s.sw === true) block('Ausgang (Pumpe) ist EIN');
  if (typeof s.lvl !== 'boolean') block('Eingang 1 liefert keinen Wert'); else if ((s.lvl ? 1 : 0) === (cfg1.lvlEmpty === undefined ? 1 : cfg1.lvlEmpty)) block('Schwimmer meldet LEER – Behälter füllen');
  if (typeof s.V !== 'number' || s.V < 0.1 || s.V > 3.35) block('Voltmeter unplausibel: ' + s.V);
  if ((await kvsGet('zrb1')) !== undefined) block('Zeitraffer aktiv – erst normal');
  if (blockers) { console.log(blockers + ' Blocker – kein Messlauf'); process.exit(1); }
  console.log('Messlauf: ' + n + ' Pulse à ' + sek + ' s, Sensor alle ' + POLL / 1000 + ' s über ' + AFTER / 1000 + ' s je Puls; Kalibrierung vDry ' + cfg1.vDry + ' vWet ' + cfg1.vWet + '; Start ' + s.sys.time + ' (pct ' + pctOf(s.V, cfg1).toFixed(1) + ', tC ' + num(s.tC, 1) + ')');
  await safeMoment(cfg3);
  const t00 = Date.now();
  const pulses = [];
  for (let i = 1; i <= n; i++) {
    const pre = []; for (let k = 0; k < 5; k++) { const V = await readV(); if (V !== null) pre.push(pctOf(V, cfg1)); await sleep(400); }
    const p0 = median(pre);
    const tOn = Date.now();
    const r = await rpc('Switch.Set', { id: cfg1.idSw === undefined ? 0 : cfg1.idSw, on: true, toggle_after: sek });
    const rows = [];
    let tRise = null, peak = p0, tPeak = 0, swOffAt = null, settled = null, tSettle = null;
    while (Date.now() - tOn < AFTER) {
      const V = await readV(); const sw = await rpc('Switch.GetStatus', { id: 0 }).catch(() => ({}));
      const el = (Date.now() - tOn) / 1000, pct = V === null ? null : pctOf(V, cfg1);
      rows.push({ t: Math.round(el * 10) / 10, V: V, pct: pct === null ? null : Math.round(pct * 10) / 10, sw: !!sw.output });
      if (pct !== null) {
        if (tRise === null && pct >= p0 + 1) tRise = el;
        if (pct > peak) { peak = pct; tPeak = el; }
        // Ruhewert: die letzten 5 Proben (10 s) innerhalb 1 % und nicht mehr steigend
        const last = rows.slice(-10).map((x) => x.pct).filter((x) => x !== null);
        if (last.length === 10 && Math.max(...last) - Math.min(...last) <= 1 && last[9] - last[0] <= 0.5 && tRise !== null && el - tRise >= 20 && settled === null && el >= 30) { settled = last[9]; tSettle = el; }
      }
      if (sw.output === false && swOffAt === null && el > sek - 1) swOffAt = el;
      await sleep(POLL);
    }
    const end = rows[rows.length - 1].pct;
    const fin = settled === null ? end : settled;
    const dead = tRise === null ? null : Math.min(tRise, sek);
    const effSec = dead === null ? sek : Math.max(0.5, sek - dead);
    const gain = (fin - p0) / effSec, gainRaw = (fin - p0) / sek;
    pulses.push({ i: i, sek: sek, p0: Math.round(p0 * 10) / 10, tRise: tRise, peak: Math.round(peak * 10) / 10, tPeak: tPeak, settled: settled === null ? null : Math.round(settled * 10) / 10, tSettle: tSettle, end: end, gain: Math.round(gain * 100) / 100, gainRaw: Math.round(gainRaw * 100) / 100, swOffAt: swOffAt, wasOn: r.was_on, rows: rows });
    console.log('Puls ' + i + ': ' + sek + ' s → pct ' + p0.toFixed(1) + ' → Spitze ' + peak.toFixed(1) + ' (t=' + tPeak + ' s) → Ruhe ' + (settled === null ? 'nicht stabil, Ende ' + end : settled.toFixed(1) + ' (nach ' + tSettle + ' s)') + ' | tRise ' + (tRise === null ? '- (keine Reaktion ≥ 1 %)' : tRise + ' s') + ' | Gewinn ' + gain.toFixed(2) + ' %/wirksame s (' + gainRaw.toFixed(2) + ' %/s brutto) | Ausgang aus bei ' + swOffAt + ' s');
  }
  const dir = path.join(__dirname, '..', 'docs', 'kal'); fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const file = path.join(dir, stamp + '-mess.json');
  fs.writeFileSync(file, JSON.stringify({ ip: ip, start: new Date(t00).toISOString(), sek: sek, n: n, cfg1: cfg1, pulses: pulses }, null, 1));
  const g = pulses.map((p) => p.gain).filter((x) => x > 0), gMax = g.length ? Math.max(...g) : null, gMed = g.length ? median(g) : null;
  const tR = pulses.map((p) => p.tRise).filter((x) => x !== null), tS = pulses.map((p) => p.tSettle).filter((x) => x !== null);
  console.log('Vorschläge (Startwerte, nachprüfen): ' + (gMed === null ? 'keine Wirkung gemessen – Schlauch/Pumpe/Sensorlage prüfen' :
    'effMax ≥ ' + Math.ceil(gMax * 1.5) + ' (Gewinn max ' + gMax + ', Median ' + gMed + ' %/s) · tPmin ' + Math.max(2, Math.ceil(2 / gMed)) + ' s (≈ +2 %) · tDead ' + (tR.length ? Math.round(Math.min(...tR)) : '?') + ' s (erste Reaktion) · tMin ' + ((tR.length ? Math.round(Math.min(...tR)) : 0) + Math.max(2, Math.ceil(2 / gMed))) + ' s · tSoak ' + (tS.length ? Math.max(10, Math.ceil(median(tS)) - 10) : '?') + ' s · tStab ' + (tS.length ? Math.max(30, Math.ceil(Math.max(...tS)) + 15) : '?') + ' s'));
  console.log('Rohdaten: ' + path.relative(process.cwd(), file));
  const sw = await rpc('Switch.GetStatus', { id: 0 }); if (sw.output) { await rpc('Switch.Set', { id: 0, on: false }); console.log('Ausgang war noch EIN – ausgeschaltet'); }
  process.exit(0);
}

(async () => {
  switch (cmd) {
    case 'preflight': return preflight(rest[0]);
    case 'input-on': return inputOn();
    case 'cfg': return cfgSet(rest);
    case 'start': return start(rest[0], rest[1]);
    case 'watch': return watch(rest[0]);
    case 'go': case 'skip': case 'abort': return sendCmd(cmd);
    case 'status': return console.log(await statusLine());
    case 'report': return report();
    case 'restore': return restore();
    case 'cleanup': return cleanup();
    case 'stop': return stop();
    case 'zeitraffer': return zeitraffer(rest[0]);
    case 'normal': return normal(rest[0]);
    case 'mess': return mess(rest[0], rest[1], rest[2]);
    case 'kal': return kal(rest[0], rest[1], rest[2]);
    case 'scripts': return listScripts();
    case 'delete': return deleteScript(rest[0]);
    default: console.error('unbekanntes Kommando: ' + cmd); process.exit(2);
  }
})().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
