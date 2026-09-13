// tools/check-docs.js v0.1.0 – Doku-Prüfung: Links und Anker, Bilder, Sprachparität DE/EN, Kapitelvorlage, veraltete Aussagen,
// Fakt- und Startwert-Marker gegen die Scripts, Lesbarkeit, Diagramm-Artefakte, Stubs, Doku-Schuld, Jekyll-Fallen
//
// Aufruf: node tools/check-docs.js [--mit-tests] [--json] [--streng] [--nur <datei>]      (npm run docs:check = --mit-tests)
//   --mit-tests  ermittelt die Testzahl per node --test (~6 s) und prüft die Marker fact:tests
//   --streng     Warnungen zählen wie Fehler
//   --nur        nur diese Datei (relativ zum Repo) prüfen; Paritäts- und Diagrammprüfung laufen trotzdem für das Gegenstück
// Exit 0 = keine Fehler, 1 = Fehler, 2 = Aufruffehler. tools/test/docs.test.js ruft runChecks() ohne Testzahl auf.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parse } = require('./docs/lib/markdown.js');
const { slugsOf } = require('./docs/lib/slug.js');
const { fakten } = require('./docs/lib/startwerte.js');

const ROOT = path.resolve(__dirname, '..');
const K = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'docs', 'kapitel.json'), 'utf8'));
const VERBOTEN = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'docs', 'verboten.json'), 'utf8'));
const BASE = K.basis;
const STUBS = ['LEARNING.md', 'docs/PLAN.md', 'docs/kurzanleitung.md', 'docs/pruefprotokoll-etappe6.md', 'scripts/lib_notes.md', 'docs/handbuch/README.md', 'hardware/README.md'];
const H2 = {
  de: { vor: 'Voraussetzungen', dia: 'Diagramm', bsp: 'Beispielausgabe', fehler: 'Typische Fehler', weiter: 'Weiter zu', blick: 'Auf einen Blick' },
  en: { vor: 'Prerequisites', dia: 'Diagram', bsp: 'Example output', fehler: 'Typical problems', weiter: 'Next', blick: 'At a glance' },
};
const BSP_PFLICHT = ['06', '07', '08', '09', '10', '11', '12', '13', '14'];
const CODE_SPAN = /^(cfg[1-4]\.\w+|lrn\.\w+|st\.\w+|job\.\w+|day\.\w+|err\.\w+|why=\w+|err=\w+|bw_\w+(\.js)?|zrb\d|hw[a-z]\d?)$/;

function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }
function exists(p) { try { fs.accessSync(p); return true; } catch (e) { return false; } }

function collectFiles() {
  const out = [];
  for (const f of ['README.md', 'README.en.md', 'CLAUDE.md', 'AGENTS.md', 'docs/index.md', 'docs/diagramme/README.md']) if (exists(path.join(ROOT, f))) out.push(f);
  for (const lang of ['de', 'en']) {
    const dir = path.join(ROOT, 'docs', lang);
    if (!exists(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) out.push('docs/' + lang + '/' + f);
  }
  return out;
}

function kapitelInfo(file) {
  const m = /^docs\/(de|en)\/(\d\d)-([a-z0-9-]+)\.md$/.exec(file);
  if (!m) return null;
  const k = K.kapitel.find((x) => x.nr === m[2] && x.slug === m[3]);
  return { lang: m[1], nr: m[2], slug: m[3], name: m[2] + '-' + m[3], kapitel: k };
}

function runChecks(opts) {
  opts = opts || {};
  const befunde = [];
  const F = (datei, zeile, regel, meldung) => befunde.push({ schwere: 'FEHLER', datei, zeile, regel, meldung });
  const W = (datei, zeile, regel, meldung) => befunde.push({ schwere: 'WARNUNG', datei, zeile, regel, meldung });
  const files = collectFiles().filter((f) => !opts.nur || f === opts.nur || (kapitelInfo(f) && kapitelInfo(opts.nur) && kapitelInfo(f).name === kapitelInfo(opts.nur).name));
  const docs = new Map();
  for (const f of collectFiles()) docs.set(f, parse(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  const slugCache = new Map();
  const slugs = (f) => { if (!slugCache.has(f)) { const d = docs.get(f) || parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); slugCache.set(f, new Set(slugsOf(d.headings))); } return slugCache.get(f); };
  const facts = fakten({ mitTests: !!opts.mitTests });

  for (const f of files) {
    const d = docs.get(f);
    const info = kapitelInfo(f);
    const lang = info ? info.lang : (f.startsWith('docs/en') || f === 'README.en.md' ? 'en' : 'de');
    const inDocs = f.startsWith('docs/');
    // 1 Links und Anker
    for (const l of d.links) {
      let t = l.target;
      if (/^(mailto:|tel:)/.test(t)) continue;
      if (/^https?:\/\//.test(t)) {
        if (!t.startsWith(BASE)) continue;
        t = path.join(ROOT, 'docs', t.slice(BASE.length).split('#')[0]);
        const cand = [t, t.replace(/\.html$/, '.md'), path.join(t, 'README.md'), t.replace(/\/$/, '') + '.md', path.join(t, 'index.md')];
        if (!cand.some(exists)) F(f, l.line, 'link', 'Pages-URL ohne lokales Gegenstück: ' + l.target);
        continue;
      }
      const [file, anchor] = t.split('#');
      let target = file ? path.resolve(path.dirname(path.join(ROOT, f)), file) : path.join(ROOT, f);
      if (file && !exists(target)) { F(f, l.line, 'link', 'Ziel fehlt: ' + t); continue; }
      if (file && fs.statSync(target).isDirectory()) { if (exists(path.join(target, 'README.md'))) target = path.join(target, 'README.md'); else { F(f, l.line, 'link', 'Ordner ohne README.md: ' + t); continue; } }
      if (inDocs && file && !rel(target).startsWith('docs/')) F(f, l.line, 'link', 'relativer Link aus docs/ heraus (auf Pages tot), absolute GitHub-URL nutzen: ' + t);
      if (anchor) {
        if (!target.endsWith('.md')) continue;
        const s = slugs(rel(target));
        if (!s.has(anchor)) F(f, l.line, 'anker', 'Anker #' + anchor + ' fehlt in ' + rel(target) + (s.size ? ' (vorhanden: ' + [...s].slice(0, 6).join(', ') + (s.size > 6 ? ' …' : '') + ')' : ''));
      }
    }
    // 2 Bilder
    for (const im of d.images) {
      if (/^https?:\/\//.test(im.src)) continue;
      const target = path.resolve(path.dirname(path.join(ROOT, f)), im.src.split('#')[0]);
      if (!exists(target)) F(f, im.line, 'bild', 'Bild fehlt: ' + im.src);
      else if (im.src.includes('diagramme/') && !exists(path.join(ROOT, 'docs', 'diagramme', 'receipts', path.basename(im.src, '.svg') + '.' + (im.src.includes('/en/') ? 'en' : 'de') + '.json'))) F(f, im.line, 'bild', 'Diagramm ohne Quittung (npm run docs:diagramme): ' + im.src);
    }
    // 12 Jekyll
    if (inDocs) {
      d.lines.forEach((l, n) => { if (!d.rawBlocks[n] && /\{\{|\{%(?!\s*raw)/.test(l) && !/\{%\s*endraw/.test(l)) F(f, n + 1, 'jekyll', 'Liquid-Zeichen {{ oder {% außerhalb {% raw %} – Pages würde sie interpretieren'); });
    }
    if (d.h1 !== 1) F(f, 1, 'vorlage', 'genau eine H1 erwartet, gefunden ' + d.h1);
    // 6 Fakt-Marker, 7 Startwert-Marker
    let tabelle = null;
    const seenInTable = new Set();
    for (const m of d.markers) {
      if (m.art === 'tabelle') { tabelle = m.key; seenInTable.clear(); continue; }
      if (m.art === 'tabelle-ende') {
        const src = tabelle === 'hwt' ? facts.hwt : tabelle === 'hwp' ? facts.hwp : facts.DEF[tabelle];
        if (!src) F(f, m.line, 'startwert', 'unbekannte Tabelle ' + tabelle);
        else for (const key of Object.keys(src)) if (!seenInTable.has(key)) F(f, m.line, 'startwert', 'Tabelle ' + tabelle + ': Feld ' + key + ' fehlt');
        tabelle = null; continue;
      }
      const norm = (v) => (v === null || v === undefined ? 'null' : typeof v === 'string' ? v : JSON.stringify(v));
      if (m.art === 'fact') {
        if (m.key === 'tests' && !opts.mitTests) continue;
        const soll = facts.fakten[m.key];
        if (soll === undefined || soll === null) { if (m.key !== 'tests') F(f, m.line, 'fakt', 'unbekannter Fakt ' + m.key); continue; }
        if (String(m.value).replace(/\s/g, '') !== String(soll).replace(/\s/g, '')) F(f, m.line, 'fakt', m.key + ' = ' + m.value + ', Quelle sagt ' + soll);
        continue;
      }
      const [grp, field] = m.key.split('.');
      let src = null;
      if (m.art === 'def') src = facts.DEF[grp]; else if (m.art === 'zr') src = facts.ZR[grp]; else if (m.art === 'hwt') src = facts.hwt; else if (m.art === 'hwp') src = facts.hwp;
      const fld = m.art === 'hwt' || m.art === 'hwp' ? grp : field;
      if (m.art === 'zr' && m.key === 'cfg2.pctDry') { if (m.value.replace(/\s/g, '') !== 'pctLo−1' && m.value.replace(/\s/g, '') !== 'pctLo-1') F(f, m.line, 'startwert', 'zr:cfg2.pctDry ist pctLo − 1 (ZR_DRY)'); continue; }
      if (!src || !Object.prototype.hasOwnProperty.call(src, fld)) { F(f, m.line, 'startwert', 'unbekanntes Feld ' + m.art + ':' + m.key); continue; }
      if (tabelle && (m.art === 'def' || m.art === 'hwt' || m.art === 'hwp') && (m.art !== 'def' || grp === tabelle)) seenInTable.add(fld);
      const soll = norm(src[fld]);
      const ist = m.value.replace(/^"|"$/g, '');
      if (ist !== soll.replace(/^"|"$/g, '') && !(Number(ist) === Number(soll) && ist !== '' && !isNaN(Number(ist)))) F(f, m.line, 'startwert', m.art + ':' + m.key + ' = ' + m.value + ', Script sagt ' + soll);
    }
    // 5 verbotene Ausdrücke
    if (VERBOTEN.geltung.some((g) => f === g || f.startsWith(g + '/'))) {
      for (const e of VERBOTEN.eintraege) {
        if (e.ausser && info && e.ausser.some((p) => info.name.startsWith(p))) continue;
        const re = e.regex ? new RegExp(e.muster) : null;
        d.lines.forEach((l, n) => { if (d.inCode(n)) return; if (re ? re.test(l) : l.includes(e.muster)) F(f, n + 1, 'veraltet', '„' + e.muster + '“ – ' + e.hinweis); });
      }
    }
    // 8 Lesbarkeit (Geltungsbereich wie die veralteten Ausdrücke: Altdateien bis zum README-Umbau ausgenommen)
    if (VERBOTEN.geltung.some((g) => f === g || f.startsWith(g + '/')))
    for (const p of d.paragraphs) { if (p.text.length > 900) F(f, p.start, 'lesbarkeit', 'Absatz mit ' + p.text.length + ' Zeichen (Grenze 900)'); else if (p.text.length > 700) W(f, p.start, 'lesbarkeit', 'Absatz mit ' + p.text.length + ' Zeichen (Ziel ≤ 600)'); }
    if (VERBOTEN.geltung.some((g) => f === g || f.startsWith(g + '/'))) {
      for (const c of d.cells) if (c.text.length > 400) W(f, c.line, 'lesbarkeit', 'Tabellenzelle mit ' + c.text.length + ' Zeichen (Grenze 400)');
      for (const h of d.headings) if (h.level >= 4) F(f, h.line, 'lesbarkeit', 'H4 und tiefer sind nicht erlaubt: ' + h.text);
      for (const c of d.code) { if (!c.lang) W(f, c.start + 1, 'lesbarkeit', 'Code-Block ohne Sprachkennung'); if (c.offen) F(f, c.start + 1, 'lesbarkeit', 'Code-Block nicht geschlossen'); }
    }
    // 3/4/9 Kapitelregeln
    if (info && !d.imAufbau) {
      const t = H2[info.lang];
      const h2 = d.headings.filter((h) => h.level === 2).map((h) => h.text);
      const want = [t.vor, t.dia].concat(BSP_PFLICHT.includes(info.nr) ? [t.bsp] : []).concat([t.fehler, t.weiter]);
      let pos = -1;
      for (const w of want) { const i = h2.findIndex((x, idx) => idx > pos && x === w); if (i < 0) F(f, 1, 'vorlage', 'Pflichtabschnitt „## ' + w + '“ fehlt oder steht an falscher Stelle'); else pos = i; }
      if (!(d.lines[2] || '').includes(info.lang === 'de' ? '../en/' + info.name + '.md' : '../de/' + info.name + '.md')) F(f, 3, 'vorlage', 'Zeile 3 muss der Sprachumschalter mit Link auf das Gegenstück sein');
      if (!d.lines.slice(3, 10).some((l) => l.includes('**' + t.blick + '**'))) F(f, 4, 'vorlage', 'Kasten „> **' + t.blick + '**“ direkt nach dem Sprachumschalter fehlt');
      const svg = '../diagramme/' + info.lang + '/' + info.name + '.svg';
      if (d.images.filter((im) => im.src === svg).length !== 1) F(f, 1, 'diagramm', 'genau ein Bild ' + svg + ' erwartet');
      const html = BASE + 'diagramme/' + info.lang + '/' + info.name + '.html';
      if (!d.links.some((l) => l.target === html)) F(f, 1, 'diagramm', 'Link auf die interaktive Fassung fehlt: ' + html);
      for (const p of ['src/' + info.name + '.' + (info.kapitel ? info.kapitel.typ : 'x') + '.json', 'src/' + info.name + '.en.json', info.lang + '/' + info.name + '.html', info.lang + '/' + info.name + '.svg', 'receipts/' + info.name + '.' + info.lang + '.json']) if (!exists(path.join(ROOT, 'docs', 'diagramme', p))) F(f, 1, 'diagramm', 'Diagramm-Datei fehlt: docs/diagramme/' + p);
      const rec = path.join(ROOT, 'docs', 'diagramme', 'receipts', info.name + '.' + info.lang + '.json');
      if (exists(rec)) { const r = JSON.parse(fs.readFileSync(rec, 'utf8')); if (r.validierung.errors || r.validierung.warnings) F(f, 1, 'diagramm', 'Quittung meldet ' + r.validierung.errors + ' Fehler, ' + r.validierung.warnings + ' Warnungen'); }
      // Parität mit dem Gegenstück
      const other = 'docs/' + (info.lang === 'de' ? 'en' : 'de') + '/' + info.name + '.md';
      const od = docs.get(other);
      if (!od) F(f, 1, 'paritaet', 'Gegenstück fehlt: ' + other);
      else if (info.lang === 'de' && !od.imAufbau) {
        const cnt = (x, lvl) => x.headings.filter((h) => h.level === lvl).length;
        if (cnt(d, 2) !== cnt(od, 2)) F(f, 1, 'paritaet', 'H2-Zahl DE ' + cnt(d, 2) + ' ≠ EN ' + cnt(od, 2));
        if (cnt(d, 3) !== cnt(od, 3)) W(f, 1, 'paritaet', 'H3-Zahl DE ' + cnt(d, 3) + ' ≠ EN ' + cnt(od, 3));
        if (d.code.length !== od.code.length) W(f, 1, 'paritaet', 'Code-Blöcke DE ' + d.code.length + ' ≠ EN ' + od.code.length);
        const spans = (x) => new Set(x.codeSpans.map((s) => s.text).filter((s) => CODE_SPAN.test(s)));
        const a = spans(d), b = spans(od);
        const diff = [...a].filter((s) => !b.has(s)).concat([...b].filter((s) => !a.has(s)));
        if (diff.length) W(f, 1, 'paritaet', 'Code-Spans unterscheiden sich DE/EN: ' + diff.slice(0, 8).join(', '));
      } else if (info.lang === 'de' && od.imAufbau) F(f, 1, 'paritaet', 'englisches Gegenstück ist noch Platzhalter: ' + other);
    }
  }
  // 3 Dateiparität
  if (!opts.nur) {
    const ls = (lang) => (exists(path.join(ROOT, 'docs', lang)) ? fs.readdirSync(path.join(ROOT, 'docs', lang)).filter((x) => x.endsWith('.md')) : []);
    const de = new Set(ls('de')), en = new Set(ls('en'));
    for (const x of de) if (!en.has(x)) F('docs/en/' + x, 1, 'paritaet', 'fehlt in docs/en');
    for (const x of en) if (!de.has(x)) F('docs/de/' + x, 1, 'paritaet', 'fehlt in docs/de');
    for (const k of K.kapitel) for (const lang of ['de', 'en']) if (!exists(path.join(ROOT, 'docs', lang, k.nr + '-' + k.slug + '.md'))) F('docs/' + lang + '/' + k.nr + '-' + k.slug + '.md', 1, 'paritaet', 'Kapitel aus kapitel.json fehlt');
    // 9 Diagramm-Artefakte aktuell?
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'docs', 'build-diagramme.mjs'), '--check'], { encoding: 'utf8' });
    if (r.status !== 0) for (const l of (r.stderr || '').split('\n').filter((x) => x.startsWith('FEHLER'))) F('docs/diagramme', 0, 'diagramm', l.replace(/^FEHLER /, ''));
    // 10 Stubs
    for (const s of STUBS) {
      const p = path.join(ROOT, s);
      if (!exists(p)) continue;
      const txt = fs.readFileSync(p, 'utf8');
      const isStub = /umgezogen|moved to|redirect_to/.test(txt);
      if (isStub && (txt.split('\n').filter((l) => l.trim()).length > 8 || !/docs\/(de|en)\//.test(txt))) F(s, 1, 'stub', 'Stub muss kurz bleiben (≤ 8 Zeilen) und auf docs/de bzw. docs/en verweisen');
    }
    // 11 Doku-Schuld
    for (const sc of fs.readdirSync(path.join(ROOT, 'scripts')).filter((x) => x.endsWith('.js'))) {
      fs.readFileSync(path.join(ROOT, 'scripts', sc), 'utf8').split('\n').forEach((l, n) => { if (l.startsWith('//!') && /README/.test(l)) W('scripts/' + sc, n + 1, 'doku-schuld', 'Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)'); });
    }
  }
  const fehler = befunde.filter((b) => b.schwere === 'FEHLER'), warnungen = befunde.filter((b) => b.schwere === 'WARNUNG');
  return { befunde, fehler, warnungen, dateien: files.length, fakten: facts.fakten };
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const opts = { mitTests: a.includes('--mit-tests'), streng: a.includes('--streng'), nur: a.includes('--nur') ? a[a.indexOf('--nur') + 1] : null };
  const t0 = Date.now();
  const r = runChecks(opts);
  if (a.includes('--json')) { console.log(JSON.stringify(r, null, 1)); }
  else {
    for (const b of r.befunde) console.log(b.schwere.padEnd(8) + ' ' + (b.datei + (b.zeile ? ':' + b.zeile : '')).padEnd(44) + ' ' + b.regel.padEnd(12) + ' ' + b.meldung);
    if (opts.mitTests) console.log('Tests: ' + r.fakten.tests + ' (' + r.fakten.testsPass + ' bestanden)');
    console.log('--- ' + r.fehler.length + ' Fehler, ' + r.warnungen.length + ' Warnungen in ' + r.dateien + ' Dateien (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s) ---');
  }
  process.exit(r.fehler.length || (opts.streng && r.warnungen.length) ? 1 : 0);
}

module.exports = { runChecks };
