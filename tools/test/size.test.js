// tools/test/size.test.js v0.1.0 – Kompakt-Ausgabe bleibt unter dem Script-Speicherlimit und ist gültiges JS
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { build, SCRIPT_MAX_BYTES } = require('../build.js');

for (const r of build(false)) {
  test('Größe ' + r.name, () => {
    assert.ok(r.bytes <= SCRIPT_MAX_BYTES, r.name + ' kompakt ' + r.bytes + ' Byte > ' + SCRIPT_MAX_BYTES);
    // Kommentarentfernung darf den Code nicht verändern: node --check auf der Kompakt-Ausgabe
    const tmp = path.join(os.tmpdir(), 'bw-size-' + process.pid + '-' + r.name);
    fs.writeFileSync(tmp, r.code);
    try { execFileSync(process.execPath, ['--check', tmp]); } finally { fs.unlinkSync(tmp); }
    assert.match(r.code.split('\n')[0], /^\/\/ bw_\w+\.js v\d+\.\d+\.\d+ – /, 'Versionszeile fehlt');
    assert.ok(!/^\s*\/\//m.test(r.code.split('\n').slice(1).join('\n')), 'Kommentarzeile übrig');
  });
}
