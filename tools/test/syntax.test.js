// tools/test/syntax.test.js v0.1.1 – erzwingt den Sprachumfang der Shelly-Script-Engine
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPTS = ['bw_install.js', 'bw_main.js', 'bw_pump.js'].map((f) => path.join(__dirname, '..', '..', 'scripts', f));

// Verbotene Konstrukte: nicht in der Shelly Language Reference gelistet oder laut Doku gefährlich.
const FORBIDDEN = [
  [/=>/, 'Arrow-Function'],
  [/`/, 'Template-String'],
  [/\bconst\b/, 'const'],
  [/\bclass\b/, 'class'],
  [/\bfor\s*\(\s*(?:var|let)?\s*\w+\s+of\b/, 'for…of'],
  [/\.\.\./, 'Spread/Rest'],
  [/\bnew\s+Date\b|\bDate\./, 'Date'],
  [/\basync\b|\bawait\b|\bPromise\b/, 'async/Promise'],
  [/\bfunction\s*\(/, 'anonyme Funktion (Doku: verschachtelte anonyme Funktionen lassen das Gerät abstürzen)'],
  [/\bparseInt\b|\bparseFloat\b/, 'parseInt/parseFloat (nicht in der Language Reference gelistet)'],
];

for (const file of SCRIPTS) {
  const name = path.basename(file);
  test('Syntax ' + name, () => {
    assert.ok(fs.existsSync(file), name + ' fehlt');
    execFileSync(process.execPath, ['--check', file]);
    const src = fs.readFileSync(file, 'utf8');
    const first = src.split('\n')[0];
    assert.match(first, new RegExp('^// ' + name.replace('.', '\\.') + ' v\\d+\\.\\d+\\.\\d+ – '), 'Versionszeile fehlt: ' + first);
    // Kommentare und Strings entfernen, damit Regeln nur auf Code wirken
    const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
    for (const [re, what] of FORBIDDEN) assert.ok(!re.test(code), what + ' in ' + name);
    for (const m of useBeforeDecl(code)) assert.fail(m + ' in ' + name);
  });
}

// mJS hoistet Funktionsdeklarationen nicht: ein Funktionsname existiert erst, wenn die Ausführung an
// seiner Deklaration vorbei ist. Modulebene-Code (Klammertiefe 0, keine function-Zeile), der einen später
// deklarierten Namen benutzt, stirbt auf dem Gerät mit ReferenceError – der Node-Mock hoistet und merkt nichts.
function useBeforeDecl(code) {
  const lines = code.split('\n');
  const decl = new Map();
  lines.forEach((l, i) => { const m = /^\s*function\s+(\w+)\s*\(/.exec(l); if (m) decl.set(m[1], i + 1); });
  const found = [];
  let depth = 0;
  lines.forEach((l, i) => {
    if (depth === 0 && !/^\s*function\b/.test(l)) {
      for (const [fn, at] of decl) {
        if (at > i + 1 && new RegExp('\\b' + fn + '\\b').test(l)) found.push(fn + ' wird in Zeile ' + (i + 1) + ' vor seiner Deklaration (Zeile ' + at + ') benutzt – mJS hoistet nicht');
      }
    }
    for (const ch of l) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  });
  return found;
}
