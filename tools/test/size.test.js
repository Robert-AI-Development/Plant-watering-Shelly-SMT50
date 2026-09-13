// tools/test/size.test.js v0.1.1 – Kompakt-Ausgabe bleibt unter der Größengrenze, ist gültiges JS und enthält genau die Geräte-Doku
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { build, docLines, limitFor } = require('../build.js');

for (const r of build(false)) {
  test('Größe ' + r.name, () => {
    assert.ok(r.bytes <= limitFor(r.name), r.name + ' kompakt ' + r.bytes + ' Byte > ' + limitFor(r.name));
    // Kommentarentfernung darf den Code nicht verändern: node --check auf der Kompakt-Ausgabe
    const tmp = path.join(os.tmpdir(), 'bw-size-' + process.pid + '-' + r.name);
    fs.writeFileSync(tmp, r.code);
    try { execFileSync(process.execPath, ['--check', tmp]); } finally { fs.unlinkSync(tmp); }
    const lines = r.code.split('\n');
    assert.match(lines[0], /^\/\/ bw_\w+\.js v\d+\.\d+\.\d+ – /, 'Versionszeile fehlt');
    // Geräte-Doku: genau die `//!`-Zeilen der Quelle bleiben als Kommentar stehen, sonst keine
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', r.name), 'utf8');
    const expected = docLines(src);
    assert.ok(expected.length >= 3, r.name + ' hat keine Geräte-Doku (//!-Zeilen)');
    assert.deepEqual(lines.slice(1).filter((l) => /^\s*\/\//.test(l)), expected, 'Kommentarzeilen in dist/ ≠ Geräte-Doku');
  });
}
