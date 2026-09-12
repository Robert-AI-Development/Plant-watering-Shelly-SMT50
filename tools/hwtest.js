// tools/hwtest.js v0.1.0 – Hardware-Test vom VPS aus steuern: Vorprüfung, Eingang aktivieren, hwt setzen, starten, mitlesen, Kommandos, Bericht, Rückbau, Aufräumen, Not-Aus
//
// Aufruf: node tools/hwtest.js <ip> <kommando> [args]   (ip z. B. 127.0.0.1:8010 über den SSH-Tunnel, Handbuch Kapitel 6)
//   preflight              Uhrzeit, Sekunden bis zum 15-min-Takt, Abstand zu winA/winB/Mitternacht, Scripts (running), Input 1, Switch 0,
//                          KVS (err/job/day/hwt/hwb*), Debug-Websocket; legt bw_hwtest/bw_hwpump per Script.Create an und nennt die Upload-Befehle
//   input-on               Input.SetConfig {id: cfg1.idLvl, config: {enable: true, type: "switch"}} + Kontrolle (einzige Konfigänderung, nur auf Zuruf)
//   cfg k=v …              hwt-Felder setzen (Werte als JSON), z. B. cfg pumpSec=30 tLo=21 run='"m"'
//   start <name> [sek]     hwc {n:0} schreiben, alten Bericht löschen, Script per Name starten (bw_hwtest | bw_hwpump), dann watch
//   watch [sek]            Konsole (Debug-Websocket) mitlesen + alle 5 s eine Statuszeile aus hwr/hwp; startet Durchgang B von bw_hwpump, sobald bw_pump fertig ist;
//                          Ende, wenn kein Test-Script mehr läuft, sonst nach sek (Standard 120, max 300)
//   go | skip | abort      Kommando an das laufende Script (hwc n+1)
//   status                 Einzeiler: laufende Scripts, hwr, hwp, Sensoren, Switch
//   report                 hwr/hwp lesbar aufbereitet + Vergleich mit cfg1
//   restore                hwb1/hwb2 → st/day/job/err/lrn zurückschreiben (nur wenn bw_hwpump nicht läuft), job.ok=false, hwb löschen
//   cleanup                hwc/hwb1/hwb2 löschen (hwt, hwr, hwp bleiben als Nachweis)
//   stop                   Not-Aus: Script.Stop bw_hwtest, bw_hwpump, bw_pump und Switch.Set {on:false}
// Node ≥ 22 (fetch, globales WebSocket), keine Abhängigkeiten. Exit-Code 0 ok, 1 Fehler/Blocker, 2 Aufruffehler.
'use strict';

const [ip, cmd, ...rest] = process.argv.slice(2);
if (!ip || !cmd) { console.error('Aufruf: node tools/hwtest.js <ip> <preflight|input-on|cfg|start|watch|go|skip|abort|status|report|restore|cleanup|stop> [args]'); process.exit(2); }

const TEST_SCRIPTS = ['bw_hwtest', 'bw_hwpump'];
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

async function preflight() {
  let blockers = 0;
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
  for (const name of TEST_SCRIPTS) {
    if (!list.find((x) => x.name === name)) {
      const r = await rpc('Script.Create', { name: name });
      info('Script ' + name + ' angelegt als id ' + r.id);
      list.push({ id: r.id, name: name });
    }
  }
  for (const name of TEST_SCRIPTS) {
    const sc = list.find((x) => x.name === name);
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
  const [hwr, hwp, list, s] = await Promise.all([kvsGet('hwr'), kvsGet('hwp'), scripts(), sensors()]);
  const running = list.filter((x) => x.running).map((x) => x.name);
  return '[status ' + s.sys.time + '] läuft: ' + (running.length ? running.join(',') : '-') + ' | V=' + num(s.V, 3) + ' tC=' + num(s.tC, 1) + ' lvl=' + s.lvl + ' sw=' + (s.sw ? 'EIN' : 'aus')
    + ' | hwr: ' + (hwr ? hwr.s + ' ' + fmtPhases(hwr, HW_PHASES) : '-') + ' | hwp: ' + (hwp ? hwp.s + ' ' + fmtPhases(hwp, HP_PHASES) : '-');
}

async function watch(seconds, before) {
  seconds = Math.min(Number(seconds || 120), 300);
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
      };
      ws.onclose = () => { ws = null; };
      ws.onerror = () => { ws = null; };
    } catch (e) { ws = null; }
  }
  connect();
  if (before) { await new Promise((res) => setTimeout(res, 700)); await before(); }   // Konsole steht, bevor das Script startet
  for (;;) {
    const st = await statusLine();
    if (st !== lastStatus) { console.log(st); lastStatus = st; }
    const list = await scripts();
    const running = list.some((x) => TEST_SCRIPTS.includes(x.name) && x.running);
    if (!running && Date.now() - t0 > 3000) {
      // Pumpentest Durchgang B: Sicherung vorhanden und bw_pump fertig → bw_hwpump erneut starten (bewertet, baut zurück)
      const pump = list.find((x) => x.name === 'bw_pump');
      const hwpump = list.find((x) => x.name === 'bw_hwpump');
      const backup = (await kvsGet('hwb1')) !== undefined || (await kvsGet('hwb2')) !== undefined;
      if (backup && pump && pump.running) { await new Promise((res) => setTimeout(res, 5000)); continue; }   // bw_pump pumpt noch: weiter warten
      if (backup && hwpump && pump && !pump.running && passB < 2) {
        passB++;
        await new Promise((res) => setTimeout(res, 2000));
        const r = await rpc('Script.Start', { id: hwpump.id });
        console.log('Durchgang B: Script.Start bw_hwpump → ' + JSON.stringify(r));
        continue;
      }
      console.log('kein Test-Script läuft mehr' + (backup ? ' – Sicherung hwb1/hwb2 steht noch (bw_pump läuft?), später: watch oder restore' : ''));
      break;
    }
    if (Date.now() - t0 > seconds * 1000) { console.log('watch-Zeit um (' + seconds + ' s) – erneut aufrufen'); break; }
    if (!ws) connect();
    await new Promise((res) => setTimeout(res, 5000));
  }
  if (ws) try { ws.close(); } catch (e) { /* egal */ }
  process.exit(0);
}

async function start(name, seconds) {
  if (!TEST_SCRIPTS.includes(name)) { console.error('start <bw_hwtest|bw_hwpump> [sek]'); process.exit(2); }
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

(async () => {
  switch (cmd) {
    case 'preflight': return preflight();
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
    default: console.error('unbekanntes Kommando: ' + cmd); process.exit(2);
  }
})().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
