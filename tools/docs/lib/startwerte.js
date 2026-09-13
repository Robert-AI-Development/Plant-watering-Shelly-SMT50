// tools/docs/lib/startwerte.js – Fakten aus dem Repo für check-docs.js: Startwerte (DEF/ZR3/ZR4/hwt/hwp), Versionen, Größen, Grenzen
//
// Die Objektliterale werden per Regex aus den Scripts geschnitten (`var NAME = {` … `^};`) und mit new Function ausgewertet –
// die Literale enthalten nur Zahlen, Strings, null und Zeilenkommentare, kein Shelly-API.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');

function literal(file, name) {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', file), 'utf8');
  const start = src.search(new RegExp('^var ' + name + ' = \\{', 'm'));
  if (start < 0) throw new Error(name + ' nicht in ' + file);
  const open = src.indexOf('{', start);
  let depth = 0, i = open, inStr = null, inCmt = false;
  for (; i < src.length; i++) {   // Klammern zählen, Strings und Zeilenkommentare überspringen
    const c = src[i];
    if (inCmt) { if (c === '\n') inCmt = false; continue; }
    if (inStr) { if (c === inStr && src[i - 1] !== '\\') inStr = null; continue; }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '/' && src[i + 1] === '/') { inCmt = true; continue; }
    if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) break; }
  }
  const body = src.slice(open, i + 1);
  return new Function('return ' + body)();   // eslint-disable-line no-new-func
}

function version(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = /var VER = "([^"]+)"/.exec(src) || /v(\d+\.\d+\.\d+)/.exec(src.split('\n')[0]);
  return m ? m[1] : null;
}

function fakten(opts) {
  opts = opts || {};
  const build = require(path.join(ROOT, 'tools', 'build.js'));
  const DEF = literal('bw_install.js', 'DEF');
  const ZR3 = literal('bw_zeitraffer.js', 'ZR3'), ZR4 = literal('bw_zeitraffer.js', 'ZR4');
  const hwt = literal('bw_hwtest.js', 'DEF'), hwp = literal('bw_hwpump.js', 'DEF');
  const mock = fs.readFileSync(path.join(ROOT, 'tools', 'mock', 'shelly-mock.js'), 'utf8');
  const depth = /MAX_CALL_DEPTH = (\d+)/.exec(mock);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const f = {
    'project.version': pkg.version,
    size_limit: String(build.SCRIPT_MAX_BYTES),
    size_limit_pump: String(build.limitFor('bw_pump.js')),
    call_depth: depth ? depth[1] : null,
  };
  for (const r of build.build(false)) f['dist.' + r.name.replace(/\.js$/, '')] = String(r.bytes);
  for (const n of ['bw_install', 'bw_main', 'bw_pump', 'bw_hwtest', 'bw_hwpump', 'bw_zeitraffer']) f['ver.' + n] = version('scripts/' + n + '.js');
  for (const t of ['hwtest', 'build', 'put-script', 'verify-scripts', 'console', 'run-script']) { const v = version('tools/' + t + '.js'); if (v) f['ver.' + t] = v; }
  if (opts.mitTests) {
    const tests = fs.readdirSync(path.join(ROOT, 'tools', 'test')).filter((x) => x.endsWith('.test.js')).map((x) => 'tools/test/' + x);
    const r = spawnSync('node', ['--test', '--test-reporter=tap'].concat(tests), { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const m = /^# tests (\d+)/m.exec(r.stdout || '');
    f.tests = m ? m[1] : null;
    const p = /^# pass (\d+)/m.exec(r.stdout || '');
    f.testsPass = p ? p[1] : null;
  }
  return { fakten: f, DEF, ZR: { cfg3: ZR3, cfg4: ZR4 }, hwt, hwp };
}

module.exports = { fakten, literal, version };
