// tools/test/dist.test.js – dist/ ist eingecheckt (Copy-&-Paste-Installation): jede Datei muss byteidentisch mit npm run build sein
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build, NAMES } = require('../build.js');

test('dist/ ist aktuell: jede Kompakt-Datei entspricht build() aus scripts/ (sonst npm run build und dist/ mit einchecken)', () => {
  const out = build(false);
  for (const r of out) {
    const file = path.join(__dirname, '..', '..', 'dist', r.name);
    assert.ok(fs.existsSync(file), 'dist/' + r.name + ' fehlt – npm run build');
    const disk = fs.readFileSync(file, 'utf8');
    assert.equal(disk, r.code, 'dist/' + r.name + ' weicht vom Build ab (' + Buffer.byteLength(disk) + ' vs ' + r.bytes + ' Byte) – npm run build, dann einchecken');
  }
  assert.equal(out.length, NAMES.length);
});
