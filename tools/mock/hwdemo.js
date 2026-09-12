// tools/mock/hwdemo.js v0.1.0 – virtueller Bediener für bw_hwtest/bw_hwpump im Mock: Sensor-Rampen je Phase und Auto-Kommandos
//
// Die Scripts schreiben nach jeder Phase ihren Stand nach hwr (bw_hwtest) bzw. hwp (bw_hwpump); daraus liest der Treiber die
// laufende Phase (erste "-" im Feld r) und stellt die Sensoren so, wie es ein Mensch am Aufbau täte: erst nach einer Verzögerung
// fällt die Temperatur, steigt die Spannung usw. Kommandos (go/skip/abort) kommen über den onRpc-Hook, sobald das Script hwc pollt.
// Alles hängt an der virtuellen Uhr, der Lauf ist deterministisch.
'use strict';

const HW_IDS = ['t1', 't2', 'm1', 'm2', 'l1', 'l2'];
const HP_IDS = ['p0', 'p1', 'p2', 'p3'];

// laufende Phase aus dem Statuseintrag: Index der ersten noch offenen Phase
function phaseIndex(dev, key, ids) {
  const st = dev.kvsGet(key);
  if (!st || typeof st.r !== 'string') return 0;
  const parts = st.r.split(',');
  for (let i = 0; i < ids.length; i++) if (parts[i] === undefined || parts[i] === '-') return i;
  return ids.length;
}

function lin(t, t0, t1, v0, v1) { if (t <= t0) return v0; if (t >= t1) return v1; return v0 + (v1 - v0) * (t - t0) / (t1 - t0); }

// Sensorverlauf für bw_hwtest: Werte hängen von der Phase und der Zeit seit Phasenbeginn ab (Sekunden)
function ramps(dev, opts) {
  opts = opts || {};
  const o = Object.assign({ tRoom: 23.9, tCold: 19, tWarm: 31, vSoil: 0.42, vDry: 0.21, vWet: 3.10, delay: 3, slow: 20 }, opts);
  const s = { idx: -1, t0: dev.nowMs };
  function phase() {
    const i = phaseIndex(dev, 'hwr', HW_IDS);
    if (i !== s.idx) { s.idx = i; s.t0 = dev.nowMs; }
    return { id: HW_IDS[i] || 'end', sec: (dev.nowMs - s.t0) / 1000 };
  }
  dev.tC = function () {
    const p = phase();
    if (p.id === 't1') return lin(p.sec, o.delay, o.delay + o.slow, o.tRoom, o.tCold);
    if (p.id === 't2') return lin(p.sec, o.delay, o.delay + o.slow, o.tCold, o.tWarm);
    return s.idx < 1 ? o.tRoom : o.tWarm;
  };
  dev.voltage = function () {
    const p = phase();
    if (p.id === 'm1') return lin(p.sec, o.delay, o.delay + 8, o.vSoil, o.vDry);
    if (p.id === 'm2') return lin(p.sec, o.delay, o.delay + 10, o.vDry, o.vWet);
    return s.idx < 2 ? o.vSoil : (s.idx < 3 ? o.vDry : o.vWet);
  };
  dev.inputs[1] = function () {
    const p = phase();
    // Ruhezustand false (Wasser vorhanden); in l1 nach delay auf true (LEER), in l2 nach delay zurück auf false
    if (p.id === 'l1') return p.sec >= o.delay;
    if (p.id === 'l2') return p.sec < o.delay;
    return false;
  };
  return s;
}

// Kommandos wie ein Bediener: go für Phasen, die darauf warten (nach goAfter Sekunden in der Phase), optional skip/abort
// plan: { key: 'hwr'|'hwp', ids, goAfter: {m1: 15, l1: 6, l2: 6, p0: 2}, skip: ['t1'], abort: 'm2', goPhases }
function driver(dev, plan) {
  plan = plan || {};
  const key = plan.key || 'hwr';
  const ids = plan.ids || (key === 'hwp' ? HP_IDS : HW_IDS);
  const goAfter = Object.assign({ m1: 15, l1: 6, l2: 6, p0: 2 }, plan.goAfter || {});
  const s = { n: 0, idx: -1, t0: dev.nowMs, sent: {} };
  function send(cmd) { s.n += 1; dev.kvsSetRaw('hwc', { n: s.n, cmd: cmd }); s.sent[cmd + ':' + s.idx] = true; }
  const prev = dev.onRpc;
  dev.onRpc = function (d, method, params, sid) {
    if (prev) prev(d, method, params, sid);
    if (method !== 'KVS.Get' || !params || params.key !== 'hwc') return;
    const i = phaseIndex(dev, key, ids);
    if (i !== s.idx) { s.idx = i; s.t0 = dev.nowMs; }
    const id = ids[i];
    const sec = (dev.nowMs - s.t0) / 1000;
    if (plan.abort === id && !s.sent['abort:' + i] && sec >= (plan.abortAfter || 2)) { send('abort'); return; }
    if (plan.skip && plan.skip.indexOf(id) >= 0 && !s.sent['skip:' + i] && sec >= (plan.skipAfter || 2)) { send('skip'); return; }
    if (goAfter[id] !== undefined && !s.sent['go:' + i] && sec >= goAfter[id] && !(plan.noGo && plan.noGo.indexOf(id) >= 0)) send('go');
  };
  return s;
}

module.exports = { ramps, driver, phaseIndex, HW_IDS, HP_IDS };
