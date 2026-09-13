// tools/test/docs.test.js – Doku-Prüfung als Teil von npm test (ohne Testzahl-Ermittlung, sonst Rekursion in node --test)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runChecks } = require('../check-docs.js');

test('Doku ist konsistent: Links, Anker, Bilder, Parität DE/EN, Vorlage, Marker, veraltete Aussagen, Diagramme (node tools/check-docs.js)', () => {
  const r = runChecks({ mitTests: false });
  const text = r.fehler.map((b) => b.datei + ':' + b.zeile + ' ' + b.regel + ' ' + b.meldung).join('\n');
  assert.equal(r.fehler.length, 0, r.fehler.length + ' Doku-Fehler:\n' + text);
});
