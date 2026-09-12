// tools/mock/shelly-mock.js v0.1.2 – Geräte-Mock für die Shelly-Gen2-Scripts (Node ≥ 20, keine Abhängigkeiten)
//
// Bildet nach, was die Scripts vom Gerät brauchen: KVS (50 × 253 Zeichen, Rohwerte als String, Schreibzähler),
// Zeitplan, Script-Liste, Switch mit toggle_after/auto_off, Sensoren, Sys-Status mit lokaler
// Uhrzeit, Timer und RPC mit virtueller Uhr. Die Scripts laufen unverändert per vm in einer
// Sandbox mit den globalen Objekten Shelly, Timer, print, console.
// v0.1.2: Script.Start führt eine registrierte Datei (dev.files[name]) als zweites Script aus; Timer und Fehler
// werden je Script geführt; Input-Konfiguration (enable/type) mit state:null bei deaktiviertem Eingang; dev.onRpc-Hook.
'use strict';

const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const RPC_DELAY_MS = 20;      // Verzögerung bis zum Callback
const MAX_PENDING_RPC = 5;    // Gerätegrenze laut Doku
const MAX_TIMERS = 5;         // Gerätegrenze laut Doku
const MAX_CALL_DEPTH = 10;    // Aufruftiefe im Script: am Gerät gemessen – 12 Ebenen laufen, 14 stürzen ab ("Too much recursion", LEARNING.md)
Error.stackTraceLimit = 200;  // damit die Tiefenmessung alle Frames sieht
const KVS_MAX_KEYS = 50;
const KVS_MAX_KEY = 42;
const KVS_MAX_VAL = 253;
const SCHED_MAX = 20;
const SCHED_MAX_CALLS = 5;

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function val(x, dev) { return typeof x === 'function' ? x(dev) : x; }

function newSwitch() {
  return {
    output: false,
    timerEvent: null,
    timerStartedAt: null,
    timerDuration: null,
    source: 'init',
    config: { initial_state: 'off', auto_off: false, auto_off_delay: 0, auto_on: false, auto_on_delay: 0 },
  };
}

class Device {
  constructor(opts) {
    opts = opts || {};
    // Virtuelle Uhr in UTC-Millisekunden. Standard: 12.09.2026 06:00 UTC = 08:00 lokal (UTC+2).
    this.nowMs = opts.nowMs !== undefined ? opts.nowMs : Date.UTC(2026, 8, 12, 6, 0, 0);
    this.tzOffsetMin = opts.tzOffsetMin !== undefined ? opts.tzOffsetMin : 120;
    this.timeValid = opts.timeValid !== undefined ? opts.timeValid : true;
    this.bootMs = this.nowMs;
    this.ramFree = 120000;
    this.kvs = new Map();           // key → JSON-String
    this.kvsWrites = 0;
    this.kvsRev = 0;
    this.kvsPageSize = opts.kvsPageSize || 5;
    this.schedules = [];
    this.schedNextId = 1;
    this.schedRev = 0;
    this.schedCreateFailFirst = true;   // Gerätequirk (FW 2.0.0): der erste Schedule.Create je Script-Lauf scheitert mit "timespec validation" (LEARNING.md)
    this.schedCreateCount = 0;
    this.scripts = [
      { id: 1, name: 'bw_install', enable: false, running: false },
      { id: 2, name: 'bw_main', enable: false, running: false },
      { id: 3, name: 'bw_pump', enable: false, running: false },
      { id: 4, name: 'bw_hwtest', enable: false, running: false },   // am Gerät id 5/6; die Scripts suchen per Name
      { id: 5, name: 'bw_hwpump', enable: false, running: false },
    ];
    this.files = opts.files || {};   // Scriptname → Dateipfad: Script.Start führt die Datei als zweites Script aus
    this.switches = { 0: newSwitch(), 1: newSwitch() };
    this.components = { 'voltmeter:100': true, 'temperature:100': true, 'input:0': true, 'input:1': true };
    // Eingangs-Konfiguration wie am Gerät: ein deaktivierter Eingang liefert state:null (12.09.2026: input:1 enable:false)
    this.inputCfg = { 0: { enable: true, type: 'switch', invert: false }, 1: { enable: true, type: 'switch', invert: false } };
    this.onRpc = null;              // Hook function(dev, method, params, scriptId) vor jedem Shelly.call (Test-Treiber)
    this.runGen = {};               // Laufgeneration je Script: Callbacks eines beendeten Laufs treffen keinen Neustart desselben Scripts
    this.voltage = 1.5;             // Zahl, null oder function(dev)
    this.tC = 22;                   // Zahl, null oder function(dev)
    this.inputs = { 0: false, 1: false }; // bool oder function(dev)
    this.events = [];               // {at, seq, fn}
    this.eventSeq = 0;
    this.timers = new Map();        // id → {period, repeat, cb, ud}
    this.timerSeq = 0;
    this.pendingRpc = 0;
    this.maxPendingRpc = 0;
    this.maxTimersUsed = 0;
    this.log = [];
    this.logT = [];                 // virtuelle Zeit (ms) je Konsolenzeile, für Prüfungen der Ausgaberate
    this.rpcLog = [];
    this.switchLog = [];
    this.onSwitch = null;           // Hook function(dev, id, on, nowMs)
    this.errors = [];
    this.maxCallDepth = 0;          // tiefste gemessene Verschachtelung im Script
    this.depthReported = false;
    this.currentScript = null;
    this.rpcDelayMs = RPC_DELAY_MS;
  }

  // ---- Zeit -------------------------------------------------------------
  unixtime() { return Math.floor(this.nowMs / 1000); }
  localMs() { return this.nowMs + this.tzOffsetMin * 60000; }
  localHHMM() {
    const l = this.localMs();
    return pad2(Math.floor(l / 3600000) % 24) + ':' + pad2(Math.floor(l / 60000) % 60);
  }
  localDate() {
    const d = new Date(this.localMs());
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  uptimeMs() { return this.nowMs - this.bootMs; }
  sysStatus() {
    return {
      mac: 'MOCK000000',
      restart_required: false,
      time: this.timeValid ? this.localHHMM() : null,
      unixtime: this.timeValid ? this.unixtime() : null,
      uptime: Math.floor(this.uptimeMs() / 1000),
      ram_size: 250000,
      ram_free: this.ramFree,
      fs_size: 458752,
      fs_free: 200000,
      cfg_rev: 1,
      kvs_rev: this.kvsRev,
      schedule_rev: this.schedRev,
      available_updates: {},
    };
  }

  // ---- Ereignisse / virtuelle Uhr ---------------------------------------
  schedule(delayMs, fn) {
    const ev = { at: this.nowMs + delayMs, seq: this.eventSeq++, fn: fn };
    this.events.push(ev);
    return ev;
  }
  cancel(ev) { const i = this.events.indexOf(ev); if (i >= 0) this.events.splice(i, 1); }
  nextEvent() {
    let best = null;
    for (const ev of this.events) {
      if (!best || ev.at < best.at || (ev.at === best.at && ev.seq < best.seq)) best = ev;
    }
    return best;
  }
  // Ereignisse bis untilMs abarbeiten, oder bis cond() wahr ist.
  runUntil(untilMs, cond) {
    for (;;) {
      if (cond && cond()) return true;
      const ev = this.nextEvent();
      if (!ev || ev.at > untilMs) { if (!cond) this.nowMs = Math.max(this.nowMs, untilMs); return cond ? cond() : true; }
      this.cancel(ev);
      this.nowMs = ev.at;
      try { ev.fn(); } catch (e) { this.fail(e); }
    }
  }
  advance(ms) { return this.runUntil(this.nowMs + ms, null); }
  fail(e, scriptId) {
    this.errors.push(e && e.stack ? e.stack : String(e));
    // Auf dem Gerät beendet eine Exception im Callback das Script – samt seinen Timern.
    const sid = scriptId === undefined ? this.currentScript : scriptId;
    for (const s of this.scripts) if (s.id === sid) s.running = false;
    this.clearTimersOf(sid);
  }
  isRunning(scriptId) { const s = this.scripts.find((x) => x.id === scriptId); return !!(s && s.running); }
  clearTimersOf(scriptId) {
    for (const [id, t] of this.timers) { if (t.sid === scriptId) { if (t.ev) this.cancel(t.ev); this.timers.delete(id); } }
  }
  // Zweites Script starten (Script.Start auf eine registrierte Datei): eigene Sandbox, gleiche virtuelle Uhr
  spawn(script, file) {
    const code = fs.readFileSync(file, 'utf8');
    const sandbox = this.makeSandbox(script.id, file);
    try { vm.runInNewContext(code, sandbox, { filename: file }); } catch (e) { this.fail(e, script.id); }
  }

  // ---- Sensoren ---------------------------------------------------------
  readVoltage() { return val(this.voltage, this); }
  readTemp() { return val(this.tC, this); }
  readInput(id) { const v = this.inputs[id]; return v === undefined ? null : val(v, this); }

  // ---- Komponenten-Status (synchron) -------------------------------------
  componentStatus(typeOrKey, id) {
    let type = typeOrKey;
    if (typeof typeOrKey === 'string' && typeOrKey.indexOf(':') >= 0) {
      type = typeOrKey.split(':')[0];
      id = parseInt(typeOrKey.split(':')[1], 10);
    }
    switch (type) {
      case 'sys': return this.sysStatus();
      case 'voltmeter': {
        if (!this.components['voltmeter:' + id]) return null;
        const v = this.readVoltage();
        const st = { id: id, voltage: v };
        if (v === null) st.errors = ['read'];
        return st;
      }
      case 'temperature': {
        if (!this.components['temperature:' + id]) return null;
        const t = this.readTemp();
        const st = { id: id, tC: t, tF: t === null ? null : t * 9 / 5 + 32 };
        if (t === null) st.errors = ['read'];
        return st;
      }
      case 'input': {
        if (!this.components['input:' + id]) return null;
        const ic = this.inputCfg[id];
        if (ic && ic.enable === false) return { id: id, state: null };
        return { id: id, state: this.readInput(id) };
      }
      case 'switch': {
        const sw = this.switches[id];
        if (!sw) return null;
        const st = { id: id, source: sw.source, output: sw.output, temperature: { tC: 40, tF: 104 } };
        if (sw.timerEvent) { st.timer_started_at = sw.timerStartedAt; st.timer_duration = sw.timerDuration; }
        return st;
      }
      default: return null;
    }
  }
  componentConfig(typeOrKey, id) {
    let type = typeOrKey;
    if (typeof typeOrKey === 'string' && typeOrKey.indexOf(':') >= 0) {
      type = typeOrKey.split(':')[0];
      id = parseInt(typeOrKey.split(':')[1], 10);
    }
    if (type === 'switch' && this.switches[id]) return Object.assign({ id: id, name: null }, clone(this.switches[id].config));
    if (type === 'input' && this.inputCfg[id]) return Object.assign({ id: id, name: null }, clone(this.inputCfg[id]));
    if (type === 'sys') return { device: { name: 'mock' }, location: { tz: 'Europe/Vienna' } };
    return null;
  }

  // ---- Switch -----------------------------------------------------------
  setSwitch(id, on, toggleAfter, source) {
    const sw = this.switches[id];
    if (!sw) return { code: -105, msg: "Argument 'id': switch " + id + " not found" };
    const wasOn = sw.output;
    if (sw.timerEvent) { this.cancel(sw.timerEvent); sw.timerEvent = null; }
    sw.output = !!on;
    sw.source = source || 'script';
    this.switchLog.push({ t: this.nowMs, id: id, on: !!on, toggle_after: toggleAfter === undefined ? null : toggleAfter });
    if (this.onSwitch) this.onSwitch(this, id, !!on, this.nowMs);
    let delay = null;
    if (toggleAfter !== undefined && toggleAfter !== null) delay = toggleAfter;
    else if (on && sw.config.auto_off) delay = sw.config.auto_off_delay;
    if (delay !== null && delay > 0) {
      sw.timerStartedAt = this.unixtime();
      sw.timerDuration = delay;
      const dev = this;
      sw.timerEvent = this.schedule(delay * 1000, function () {
        sw.timerEvent = null;
        dev.setSwitch(id, !on, undefined, 'timer');
      });
    }
    return { result: { was_on: wasOn } };
  }

  // ---- KVS --------------------------------------------------------------
  // Der KVS hält Rohwerte wie das Gerät: unsere Scripts schreiben JSON-Strings (Entscheidung 15).
  // kvsGet liefert den geparsten Wert (Objekt), kvsSetRaw nimmt Objekte und speichert sie als JSON-String.
  kvsGet(key) {
    const s = this.kvs.get(key);
    if (s === undefined) return undefined;
    if (typeof s !== 'string') return clone(s);
    try { return JSON.parse(s); } catch (e) { return s; }
  }
  kvsSetRaw(key, value) { // ohne Zähler, für Test-Vorbereitung
    this.kvs.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  kvsRaw(key) { return this.kvs.get(key); }
  kvsDelete(key) { this.kvs.delete(key); }
  etag(key) { const s = this.kvs.get(key) || ''; let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffff; return h.toString(16); }

  // ---- RPC-Dispatcher ---------------------------------------------------
  dispatch(method, params) {
    params = params || {};
    const P = params;
    switch (method) {
      case 'KVS.Get': {
        if (!this.kvs.has(P.key)) return { code: -105, msg: "Argument 'key': key not found" };
        return { result: { etag: this.etag(P.key), value: this.kvs.get(P.key) } };
      }
      case 'KVS.Set': {
        if (typeof P.key !== 'string' || P.key.length === 0) return { code: -103, msg: "Argument 'key': missing" };
        if (P.key.length > KVS_MAX_KEY) return { code: -103, msg: "Argument 'key': too long" };
        if (P.value === undefined) return { code: -103, msg: "Argument 'value': missing" };
        // Gerät nimmt jeden JSON-Wert, die Web-UI zeigt aber nur Strings lesbar an → Projektregel: nur JSON-Strings
        if (typeof P.value !== 'string') this.errors.push('KVS.Set ' + P.key + ': Wert ist ' + typeof P.value + ', kein String – JSON.stringify verwenden (Web-UI zeigt Objekte als [object Object])');
        const s = typeof P.value === 'string' ? P.value : JSON.stringify(P.value);
        if (s.length > KVS_MAX_VAL) return { code: -103, msg: "Argument 'value': too long (" + s.length + ' > ' + KVS_MAX_VAL + ')' };
        if (!this.kvs.has(P.key) && this.kvs.size >= KVS_MAX_KEYS) return { code: -103, msg: 'KVS full' };
        this.kvs.set(P.key, s);
        this.kvsWrites++;
        this.kvsRev++;
        return { result: { etag: this.etag(P.key), rev: this.kvsRev } };
      }
      case 'KVS.Delete': {
        if (!this.kvs.has(P.key)) return { code: -105, msg: "Argument 'key': key not found" };
        this.kvs.delete(P.key);
        this.kvsRev++;
        return { result: { rev: this.kvsRev } };
      }
      case 'KVS.List': {
        const keys = {};
        for (const k of this.kvs.keys()) if (this.match(P.match, k)) keys[k] = { etag: this.etag(k) };
        return { result: { keys: keys, rev: this.kvsRev } };
      }
      case 'KVS.GetMany': {
        const all = [];
        for (const k of this.kvs.keys()) if (this.match(P.match, k)) all.push(k);
        // Antwortformat wie am Gerät gemessen (Probe 12.09.2026): items als Array von {key, etag, value}, dazu offset/total
        const off = P.offset || 0;
        const items = [];
        for (let i = off; i < all.length && i < off + this.kvsPageSize; i++) items.push({ key: all[i], etag: this.etag(all[i]), value: this.kvs.get(all[i]) });
        return { result: { items: items, offset: off, total: all.length } };
      }
      case 'Schedule.List':
        return { result: { jobs: clone(this.schedules), rev: this.schedRev } };
      case 'Schedule.Create': {
        // Gerätequirk: der erste Create je Script-Lauf scheitert mit einer irreführenden timespec-Meldung; ein Retry gelingt (LEARNING.md)
        if (this.schedCreateFailFirst && this.currentScript !== null && this.schedCreateCount === 0) { this.schedCreateCount++; return { code: -103, msg: "Argument 'timespec': Failed validation!" }; }
        if (typeof P.timespec !== 'string') return { code: -103, msg: "Argument 'timespec': missing" };
        if (!Array.isArray(P.calls) || P.calls.length === 0) return { code: -103, msg: "Argument 'calls': missing" };
        if (P.calls.length > SCHED_MAX_CALLS) return { code: -103, msg: 'too many calls' };
        if (this.schedules.length >= SCHED_MAX) return { code: -103, msg: 'too many schedules' };
        try { parseCron(P.timespec); } catch (e) { return { code: -103, msg: "Argument 'timespec': " + e.message }; }
        const job = { id: this.schedNextId++, enable: P.enable !== false, timespec: P.timespec, calls: clone(P.calls) };
        this.schedules.push(job);
        this.schedRev++;
        return { result: { id: job.id, rev: this.schedRev } };
      }
      case 'Schedule.Delete': {
        const i = this.schedules.findIndex((j) => j.id === P.id);
        if (i < 0) return { code: -105, msg: "Argument 'id': schedule not found" };
        this.schedules.splice(i, 1);
        this.schedRev++;
        return { result: { rev: this.schedRev } };
      }
      case 'Schedule.DeleteAll':
        this.schedules = [];
        this.schedRev++;
        return { result: { rev: this.schedRev } };
      case 'Script.List':
        return { result: { scripts: clone(this.scripts) } };
      case 'Script.Start': {
        const s = this.scripts.find((x) => x.id === P.id);
        if (!s) return { code: -105, msg: 'script not found' };
        const was = s.running; s.running = true;
        // Registrierte Datei: wie am Gerät asynchron als zweites Script starten (frischer Stack, gleiche Uhr)
        const file = this.files[s.name];
        if (!was && file) { const dev = this; this.schedule(0, function () { dev.spawn(s, file); }); }
        return { result: { was_running: was } };
      }
      case 'Script.Stop': {
        const s = this.scripts.find((x) => x.id === P.id);
        if (!s) return { code: -105, msg: 'script not found' };
        const was = s.running; s.running = false;
        this.clearTimersOf(s.id);   // Timer eines gestoppten Scripts verschwinden mit ihm
        return { result: { was_running: was } };
      }
      case 'Script.Create': {
        if (typeof P.name !== 'string' || !P.name) return { code: -103, msg: "Argument 'name': missing" };
        const nid = this.scripts.reduce((m, x) => Math.max(m, x.id), 0) + 1;
        this.scripts.push({ id: nid, name: P.name, enable: false, running: false });
        return { result: { id: nid } };
      }
      case 'Input.GetConfig': {
        const c = this.componentConfig('input', P.id);
        return c ? { result: c } : { code: -105, msg: "Argument 'id': input " + P.id + ' not found' };
      }
      case 'Input.SetConfig': {
        if (!this.inputCfg[P.id]) return { code: -105, msg: "Argument 'id': input " + P.id + ' not found' };
        Object.assign(this.inputCfg[P.id], P.config || {});
        return { result: { restart_required: false } };
      }
      case 'Script.SetConfig': {
        const s = this.scripts.find((x) => x.id === P.id);
        if (!s) return { code: -105, msg: 'script not found' };
        if (P.config && typeof P.config.enable === 'boolean') s.enable = P.config.enable;
        if (P.config && typeof P.config.name === 'string') s.name = P.config.name;
        return { result: { restart_required: false } };
      }
      case 'Script.GetStatus': {
        const s = this.scripts.find((x) => x.id === P.id);
        if (!s) return { code: -105, msg: 'script not found' };
        return { result: { id: s.id, running: s.running, mem_used: 12000, mem_peak: 15000, mem_free: 20000 } };
      }
      case 'Switch.Set': {
        if (typeof P.on !== 'boolean') return { code: -103, msg: "Argument 'on': missing" };
        return this.setSwitch(P.id, P.on, P.toggle_after, 'script');
      }
      case 'Switch.SetConfig': {
        const sw = this.switches[P.id];
        if (!sw) return { code: -105, msg: 'switch not found' };
        Object.assign(sw.config, P.config || {});
        return { result: { restart_required: false } };
      }
      case 'Switch.GetStatus': {
        const st = this.componentStatus('switch', P.id);
        return st ? { result: st } : { code: -105, msg: 'switch not found' };
      }
      case 'Switch.GetConfig': {
        const c = this.componentConfig('switch', P.id);
        return c ? { result: c } : { code: -105, msg: 'switch not found' };
      }
      case 'Sys.GetStatus': return { result: this.sysStatus() };
      case 'Voltmeter.GetStatus': {
        const st = this.componentStatus('voltmeter', P.id);
        return st ? { result: st } : { code: -105, msg: "Argument 'id': voltmeter " + P.id + ' not found' };
      }
      case 'Temperature.GetStatus': {
        const st = this.componentStatus('temperature', P.id);
        return st ? { result: st } : { code: -105, msg: "Argument 'id': temperature " + P.id + ' not found' };
      }
      case 'Input.GetStatus': {
        const st = this.componentStatus('input', P.id);
        return st ? { result: st } : { code: -105, msg: "Argument 'id': input " + P.id + ' not found' };
      }
      case 'Shelly.GetDeviceInfo':
        return { result: { id: 'shellyplusuni-mock', model: 'SNSN-0043X', gen: 2, fw_id: 'mock', ver: '2.0.0', app: 'PlusUni' } };
      default:
        return { code: -32601, msg: 'Method not found: ' + method };
    }
  }
  match(pattern, key) {
    if (!pattern || pattern === '*') return true;
    if (pattern.endsWith('*')) return key.startsWith(pattern.slice(0, -1));
    return pattern === key;
  }

  // ---- Sandbox für ein Script -------------------------------------------
  makeSandbox(scriptId, file) {
    const dev = this;
    const gen = (this.runGen[scriptId] = (this.runGen[scriptId] || 0) + 1);
    function alive() { return dev.isRunning(scriptId) && dev.runGen[scriptId] === gen; }
    // Aufruftiefe des Scripts an jeder Engine-Grenze messen (print, Shelly.call, Timer.set, JSON): V8 hoistet
    // und rekursiert beliebig tief, mJS auf dem Gerät nicht – zu tiefe Ketten gelten hier als Fehler.
    function depthCheck(where) {
      const lines = new Error().stack.split('\n');
      let d = 0;
      for (const l of lines) if (file && l.includes(file)) d++;
      if (d > dev.maxCallDepth) dev.maxCallDepth = d;
      if (d > MAX_CALL_DEPTH && !dev.depthReported) {
        dev.depthReported = true;
        dev.errors.push('Aufruftiefe ' + d + ' bei ' + where + ' – mJS verträgt nur etwa ' + MAX_CALL_DEPTH + ' Ebenen (Too much recursion, LEARNING.md)');
      }
    }
    function print() {
      depthCheck('print');
      const parts = [];
      for (let i = 0; i < arguments.length; i++) {
        const a = arguments[i];
        parts.push(typeof a === 'object' ? JSON.stringify(a) : String(a));
      }
      dev.log.push(parts.join(' '));
      dev.logT.push(dev.nowMs);
    }
    const Shelly = {
      call: function (method, params, cb, ud) {
        depthCheck('Shelly.call ' + method);
        dev.pendingRpc++;
        if (dev.pendingRpc > dev.maxPendingRpc) dev.maxPendingRpc = dev.pendingRpc;
        if (dev.pendingRpc > MAX_PENDING_RPC) dev.errors.push('Mehr als ' + MAX_PENDING_RPC + ' offene RPC-Aufrufe (' + method + ')');
        dev.rpcLog.push({ t: dev.nowMs, method: method, params: clone(params), sid: scriptId });
        if (dev.onRpc) dev.onRpc(dev, method, clone(params), scriptId);
        const r = dev.dispatch(method, clone(params));
        dev.schedule(dev.rpcDelayMs, function () {
          dev.pendingRpc--;
          if (typeof cb !== 'function' || !alive()) return;   // gestopptes Script (oder ein früherer Lauf) bekommt keine Antwort mehr
          try {
            if (r.code) cb(undefined, r.code, r.msg, ud);
            else cb(clone(r.result), 0, undefined, ud);
          } catch (e) { dev.fail(e, scriptId); }
        });
        return undefined;
      },
      getComponentStatus: function (t, id) { return clone(dev.componentStatus(t, id)); },
      getComponentConfig: function (t, id) { return clone(dev.componentConfig(t, id)); },
      getCurrentScriptId: function () { return scriptId; },
      getDeviceInfo: function () { return dev.dispatch('Shelly.GetDeviceInfo').result; },
      getUptimeMs: function () { return dev.uptimeMs(); },
      emitEvent: function () {},
      addEventHandler: function () { return 1; },
      addStatusHandler: function () { return 1; },
    };
    const Timer = {
      set: function (ms, repeat, cb, ud) {
        depthCheck('Timer.set');
        if (dev.timers.size >= MAX_TIMERS) { dev.errors.push('Mehr als ' + MAX_TIMERS + ' Timer'); }
        const id = ++dev.timerSeq;
        const t = { period: ms, repeat: !!repeat, cb: cb, ud: ud, ev: null, sid: scriptId };
        dev.timers.set(id, t);
        if (dev.timers.size > dev.maxTimersUsed) dev.maxTimersUsed = dev.timers.size;
        const fire = function () {
          if (dev.timers.get(id) !== t || !alive()) return;
          if (t.repeat) t.ev = dev.schedule(t.period, fire); else dev.timers.delete(id);
          try { t.cb(t.ud); } catch (e) { dev.fail(e, scriptId); }
        };
        t.ev = dev.schedule(ms, fire);
        return id;
      },
      clear: function (id) {
        const t = dev.timers.get(id);
        if (!t) return false;
        dev.timers.delete(id);
        if (t.ev) dev.cancel(t.ev);
        return true;
      },
      getInfo: function (id) { const t = dev.timers.get(id); return t ? { interval: t.repeat ? t.period : 0, next: t.ev ? t.ev.at - dev.bootMs : 0 } : undefined; },
    };
    const J = {
      stringify: function (v, r, sp) { depthCheck('JSON.stringify'); return JSON.stringify(v, r, sp); },
      parse: function (t, r) { depthCheck('JSON.parse'); return JSON.parse(t, r); },
    };
    return { Shelly: Shelly, Timer: Timer, print: print, console: { log: print }, JSON: J };
  }

  script(name) { return this.scripts.find((s) => s.name === name); }
}

// ---- Script ausführen ---------------------------------------------------
// Lädt die Datei, startet sie als Script mit dem Namen der Datei (bw_install/bw_main/bw_pump)
// und treibt die virtuelle Uhr, bis das Script sich per Script.Stop beendet hat.
// Achtung: V8 hoistet Funktionsdeklarationen, mJS auf dem Gerät nicht. Verwendung vor Deklaration auf
// Modulebene läuft hier durch und stirbt am Gerät – das prüft tools/test/syntax.test.js statisch.
function runScript(dev, file, opts) {
  opts = opts || {};
  const name = path.basename(file, '.js');
  const script = dev.script(name);
  if (!script) throw new Error('Script ' + name + ' ist auf dem Mock-Gerät nicht angelegt');
  const code = fs.readFileSync(file, 'utf8');
  const logStart = dev.log.length;
  const errStart = dev.errors.length;
  const writesStart = dev.kvsWrites;
  const t0 = dev.nowMs;
  script.running = true;
  dev.currentScript = script.id;
  dev.pendingRpc = 0;
  dev.maxCallDepth = 0;
  dev.depthReported = false;
  dev.schedCreateCount = 0;
  const sandbox = dev.makeSandbox(script.id, file);
  try {
    vm.runInNewContext(code, sandbox, { filename: file });
  } catch (e) {
    dev.fail(e);
  }
  if (opts.files) Object.assign(dev.files, opts.files);
  const maxMs = opts.maxMs || 10 * 60 * 1000;
  dev.runUntil(t0 + maxMs, function () { return !script.running; });
  // Offene Timer eines beendeten Scripts verschwinden mit dem Script (nur die eigenen – ein per Script.Start
  // gestartetes zweites Script läuft weiter).
  dev.clearTimersOf(script.id);
  dev.currentScript = null;
  return {
    stopped: !script.running,
    log: dev.log.slice(logStart),
    errors: dev.errors.slice(errStart),
    writes: dev.kvsWrites - writesStart,
    elapsedMs: dev.nowMs - t0,
    maxCallDepth: dev.maxCallDepth,
  };
}

// ---- Cron-Auswertung (Shelly-Timespec, 5/6/7 Felder) ---------------------
function parseField(f, min, max) {
  const set = new Set();
  for (const part of f.split(',')) {
    let m;
    if (part === '*') { for (let v = min; v <= max; v++) set.add(v); }
    else if ((m = /^\*\/(\d+)$/.exec(part))) { for (let v = min; v <= max; v += +m[1]) set.add(v); }
    else if ((m = /^(\d+)-(\d+)\/(\d+)$/.exec(part))) { for (let v = +m[1]; v <= +m[2]; v += +m[3]) set.add(v); }
    else if ((m = /^(\d+)-(\d+)$/.exec(part))) { for (let v = +m[1]; v <= +m[2]; v++) set.add(v); }
    else if ((m = /^(\d+)\/(\d+)$/.exec(part))) { for (let v = +m[1]; v <= max; v += +m[2]) set.add(v); }
    else if (/^\d+$/.test(part)) { const v = +part; if (v < min || v > max) throw new Error('Wert ' + v + ' außerhalb ' + min + '-' + max); set.add(v); }
    else throw new Error('unbekanntes Feld ' + part);
  }
  return set;
}
function parseCron(spec) {
  let f = spec.trim().split(/\s+/);
  if (f.length === 5) f = ['0'].concat(f);
  if (f.length === 7) f = f.slice(0, 6);
  if (f.length !== 6) throw new Error('timespec braucht 5, 6 oder 7 Felder');
  const dow = parseField(f[5], 0, 7);
  if (dow.has(7)) dow.add(0);
  return { sec: parseField(f[0], 0, 59), min: parseField(f[1], 0, 59), hour: parseField(f[2], 0, 23), dom: parseField(f[3], 1, 31), mon: parseField(f[4], 1, 12), dow: dow };
}
function cronMatch(spec, localMs) {
  const c = parseCron(spec);
  const d = new Date(localMs);
  return c.sec.has(d.getUTCSeconds()) && c.min.has(d.getUTCMinutes()) && c.hour.has(d.getUTCHours()) && c.dom.has(d.getUTCDate()) && c.mon.has(d.getUTCMonth() + 1) && c.dow.has(d.getUTCDay());
}

// ---- Zeitplan-Simulation -------------------------------------------------
// Läuft minutenweise bis untilMs, führt fällige Zeitplan-Einträge aus (Script.Start startet das
// Script aus `files[name]`, andere Calls gehen an den Dispatcher). onMinute(dev) je Minute.
function simulate(dev, untilMs, files, opts) {
  opts = opts || {};
  const runs = [];
  // auf die nächste volle Minute gehen
  let t = dev.nowMs - (dev.nowMs % 60000);
  if (t < dev.nowMs) t += 60000;
  while (t <= untilMs) {
    dev.runUntil(t, null);
    dev.nowMs = t;
    const localMs = dev.localMs();
    for (const job of dev.schedules.slice()) {
      if (!job.enable || !cronMatch(job.timespec, localMs)) continue;
      for (const call of job.calls) {
        if (call.method === 'Script.Start') {
          const s = dev.scripts.find((x) => x.id === call.params.id);
          if (s && files[s.name]) {
            const r = runScript(dev, files[s.name], { maxMs: 5 * 60 * 1000 });
            runs.push({ t: t, name: s.name, result: r });
            dev.nowMs = t; // Zeit für die weiteren Einträge derselben Minute zurücksetzen
          }
        } else {
          dev.rpcLog.push({ t: t, method: call.method, params: clone(call.params), source: 'schedule' });
          dev.dispatch(call.method, clone(call.params));
        }
      }
    }
    if (opts.onMinute) opts.onMinute(dev, t);
    t += 60000;
  }
  dev.runUntil(untilMs, null);
  return runs;
}

module.exports = {
  MAX_CALL_DEPTH, Device, runScript, simulate, cronMatch, parseCron, KVS_MAX_VAL, KVS_MAX_KEYS };
