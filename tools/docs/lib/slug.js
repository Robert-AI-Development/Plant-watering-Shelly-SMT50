// tools/docs/lib/slug.js – Überschriften-Anker wie auf GitHub und GitHub Pages (kramdown, Eingabe GFM)
//
// Regeln (an Live-Seiten geprüft, 13.09.2026): Inline-Markup entfernen, Kleinschreibung, alles außer Buchstaben, Ziffern,
// Leerzeichen, Bindestrich und Unterstrich streichen (Umlaute bleiben), Leerzeichen → Bindestrich, Duplikate mit -1, -2 …
'use strict';

function plain(text) {
  return String(text)
    .replace(/`([^`]*)`/g, '$1')            // Code-Spans: Inhalt bleibt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // Bilder → Alt-Text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // Links → Linktext
    .replace(/<[^>]+>/g, '')                  // HTML-Tags
    .replace(/[*_~]+/g, '');                  // Hervorhebungen
}

function slugify(text) {
  return plain(text).trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}

// Anker aller Überschriften einer Datei in Reihenfolge, mit Dedupe wie GitHub
function slugsOf(headings) {
  const seen = new Map();
  const out = [];
  for (const h of headings) {
    const base = slugify(h.text);
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    out.push(n === 0 ? base : base + '-' + n);
  }
  return out;
}

module.exports = { slugify, slugsOf, plain };
