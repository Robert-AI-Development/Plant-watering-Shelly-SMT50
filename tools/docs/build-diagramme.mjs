// tools/docs/build-diagramme.mjs v0.1.0 – alle Archify-Diagramme der Doku bauen: validate → deliver → statisches SVG → Quittung
//
// Quelle:  docs/diagramme/src/NN-slug.<typ>.json   (Beschriftung Deutsch, kanonisch; typ = architecture|workflow|sequence|dataflow|lifecycle)
//          docs/diagramme/src/NN-slug.en.json      (Wörterbuch deutscher Text → englischer Text; Bezeichner als Identität eintragen)
// Ziel:    docs/diagramme/de/NN-slug.html|.svg, docs/diagramme/en/NN-slug.html|.svg, docs/diagramme/receipts/NN-slug.<lang>.json,
//          docs/diagramme/README.md (Galerie)
// Aufruf:  node tools/docs/build-diagramme.mjs [--only NN] [--check] [--archify <pfad>]      (npm run docs:diagramme)
//          --check baut nichts, sondern vergleicht die SHA-256 in den Quittungen mit Quelle/Wörterbuch/HTML/SVG (veraltet = Fehler)
// Archify: Skill-Paket unter ~/.claude/skills/archify (oder $ARCHIFY_DIR); Leser brauchen es nicht, die HTML-Dateien sind eingecheckt.
// Regeln:  meta.quality_profile muss "showcase" sein; die DE-Fassung hat kein meta.locale (Viewer-UI bleibt Englisch, Archify kennt nur
//          en/zh-CN), die EN-Fassung bekommt meta.locale "en". Jeder deutsche Text ohne Wörterbucheintrag ist ein Fehler (Parität).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractSvg } from './diagramm-svg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIA = path.join(ROOT, 'docs', 'diagramme');
const SRC = path.join(DIA, 'src'), REC = path.join(DIA, 'receipts'), TMP = path.join(REC, '.tmp');
const TYPES = ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle'];
const TEXT_KEYS = new Set(['title', 'subtitle', 'label', 'sublabel', 'tag', 'note', 'classification', 'description', 'text', 'items', 'headline', 'summary']);
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const checkOnly = args.includes('--check');
const ARCHIFY = args.includes('--archify') ? args[args.indexOf('--archify') + 1] : (process.env.ARCHIFY_DIR || path.join(os.homedir(), '.claude', 'skills', 'archify'));
const BIN = path.join(ARCHIFY, 'bin', 'archify.mjs');

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const shaFile = (f) => (fs.existsSync(f) ? sha(fs.readFileSync(f)) : null);

function translate(node, dict, missing, trail) {
  if (Array.isArray(node)) return node.map((x, i) => translate(x, dict, missing, trail));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (TEXT_KEYS.has(k) && typeof v === 'string') {
        if (Object.prototype.hasOwnProperty.call(dict, v)) out[k] = dict[v]; else { missing.add(v); out[k] = v; }
      } else if (TEXT_KEYS.has(k) && Array.isArray(v) && v.every((x) => typeof x === 'string')) {
        out[k] = v.map((s) => { if (Object.prototype.hasOwnProperty.call(dict, s)) return dict[s]; missing.add(s); return s; });
      } else out[k] = translate(v, dict, missing, trail + '.' + k);
    }
    return out;
  }
  return node;
}

function findKey(obj, key) {   // erste Fundstelle eines Schlüssels in verschachteltem JSON (Archify-Ausgabeformate defensiv lesen)
  if (!obj || typeof obj !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const v of Object.values(obj)) { const r = findKey(v, key); if (r !== undefined) return r; }
  return undefined;
}

function archify(cmd, typ, input, output) {
  const a = [BIN, cmd, typ, input];
  if (output) a.push(output);
  a.push('--quality', 'showcase', '--json');
  const r = spawnSync('node', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let json = null;
  const text = (r.stdout || '') + (r.stderr || '');
  const first = (r.stdout || '').indexOf('{');
  if (first >= 0) { try { json = JSON.parse((r.stdout || '').slice(first)); } catch (e) { json = null; } }
  return { status: r.status, json, text };
}

function summary(json) {
  const errors = findKey(json, 'errors'), warnings = findKey(json, 'warnings');
  const num = (x) => (Array.isArray(x) ? x.length : typeof x === 'number' ? x : 0);
  return { errors: num(errors), warnings: num(warnings), checksPassed: findKey(json, 'checksPassed'), checkCount: findKey(json, 'checkCount') };
}

function main() {
  if (!fs.existsSync(BIN)) { console.error('Archify nicht gefunden: ' + BIN + ' (ARCHIFY_DIR setzen oder --archify)'); process.exit(2); }
  const archifyVersion = JSON.parse(fs.readFileSync(path.join(ARCHIFY, 'package.json'), 'utf8')).version;
  fs.mkdirSync(SRC, { recursive: true }); fs.mkdirSync(REC, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
  for (const lang of ['de', 'en']) fs.mkdirSync(path.join(DIA, lang), { recursive: true });
  const specs = fs.readdirSync(SRC).filter((f) => /^\d\d-[a-z0-9-]+\.(architecture|workflow|sequence|dataflow|lifecycle)\.json$/.test(f)).sort();
  const fails = [];
  let built = 0, fresh = 0;
  for (const file of specs) {
    const m = /^(\d\d-[a-z0-9-]+)\.([a-z]+)\.json$/.exec(file);
    const name = m[1], typ = m[2];
    if (only && !name.startsWith(only)) continue;
    const specPath = path.join(SRC, file), dictPath = path.join(SRC, name + '.en.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    if (!spec.meta || spec.meta.quality_profile !== 'showcase') { fails.push(name + ': meta.quality_profile muss "showcase" sein'); continue; }
    if (spec.meta.locale) { fails.push(name + ': meta.locale in der deutschen Quelle nicht setzen (Viewer-UI bleibt Englisch; die EN-Fassung bekommt locale automatisch)'); continue; }
    if (spec.diagram_type !== typ) { fails.push(name + ': diagram_type "' + spec.diagram_type + '" passt nicht zum Dateinamen (' + typ + ')'); continue; }
    if (!fs.existsSync(dictPath)) { fails.push(name + ': Wörterbuch ' + path.relative(ROOT, dictPath) + ' fehlt'); continue; }
    const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
    const missing = new Set();
    const en = translate(spec, dict, missing, '');
    if (missing.size) { fails.push(name + ': ' + missing.size + ' Texte ohne Wörterbucheintrag: ' + [...missing].slice(0, 8).map((s) => JSON.stringify(s)).join(', ') + (missing.size > 8 ? ' …' : '')); continue; }
    en.meta.locale = 'en';
    for (const [lang, obj] of [['de', spec], ['en', en]]) {
      const html = path.join(DIA, lang, name + '.html'), svg = path.join(DIA, lang, name + '.svg'), rec = path.join(REC, name + '.' + lang + '.json');
      const quelle = { spec: sha(fs.readFileSync(specPath)), dict: sha(fs.readFileSync(dictPath)) };
      if (checkOnly) {
        const r = fs.existsSync(rec) ? JSON.parse(fs.readFileSync(rec, 'utf8')) : null;
        const ok = r && r.quelle.spec === quelle.spec && r.quelle.dict === quelle.dict && r.html.sha256 === shaFile(html) && r.svg.sha256 === shaFile(svg) && r.validierung.errors === 0 && r.validierung.warnings === 0;
        if (ok) fresh++; else fails.push(name + '.' + lang + ': ' + (r ? 'veraltet (Quelle oder Artefakt geändert) – npm run docs:diagramme' : 'keine Quittung – npm run docs:diagramme'));
        continue;
      }
      const tmp = path.join(TMP, name + '.' + lang + '.json');
      fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
      const v = archify('validate', typ, tmp);
      const vs = v.json ? summary(v.json) : { errors: 1, warnings: 0 };
      if (v.status !== 0 || vs.errors > 0 || vs.warnings > 0) { fails.push(name + '.' + lang + ': validate ' + (v.status !== 0 ? 'Exit ' + v.status : vs.errors + ' Fehler, ' + vs.warnings + ' Warnungen') + '\n' + v.text.slice(0, 1500)); continue; }
      const before = new Set(fs.readdirSync(path.join(DIA, lang)));
      const d = archify('deliver', typ, tmp, html);
      if (d.status !== 0) { fails.push(name + '.' + lang + ': deliver Exit ' + d.status + '\n' + d.text.slice(0, 1500)); continue; }
      const extra = fs.readdirSync(path.join(DIA, lang)).filter((f) => !before.has(f) && f !== name + '.html' && f !== name + '.svg');
      for (const f of extra) fs.rmSync(path.join(DIA, lang, f), { force: true, recursive: true });   // private Snapshot-Dateien von deliver
      const htmlBuf = fs.readFileSync(html);
      let svgText;
      try { svgText = extractSvg(htmlBuf.toString('utf8'), { lang }); } catch (e) { fails.push(name + '.' + lang + ': SVG-Extraktion: ' + e.message); continue; }
      fs.writeFileSync(svg, svgText);
      const ds = d.json ? summary(d.json) : vs;
      const receipt = {
        schemaVersion: 1, diagramm: name, sprache: lang, typ, archify: archifyVersion,
        quelle: { spec: quelle.spec, dict: quelle.dict, pfad: 'docs/diagramme/src/' + file },
        html: { sha256: sha(htmlBuf), bytes: htmlBuf.length }, svg: { sha256: sha(svgText), bytes: Buffer.byteLength(svgText) },
        validierung: { profile: 'showcase', errors: ds.errors || 0, warnings: ds.warnings || 0, checksPassed: ds.checksPassed === undefined ? vs.checksPassed : ds.checksPassed, checkCount: ds.checkCount === undefined ? vs.checkCount : ds.checkCount },
      };
      fs.writeFileSync(rec, JSON.stringify(receipt, null, 1) + '\n');
      built++;
    }
  }
  if (!checkOnly) galerie();
  for (const f of fails) console.error('FEHLER ' + f);
  console.log((checkOnly ? fresh + ' Fassungen aktuell' : built + ' Fassungen gebaut') + ', ' + fails.length + ' Fehler (Archify ' + archifyVersion + ')');
  process.exit(fails.length ? 1 : 0);
}

function galerie() {
  const K = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'docs', 'kapitel.json'), 'utf8'));
  const lines = ['# Diagramme · Diagrams', '', 'Interaktive Diagramme der Kapitel (Archify): Zoom, Suche, Fokus, Beziehungs-Trace, Story-Kapitel, Hell/Dunkel. Interactive chapter diagrams: zoom, search, focus, relationship trace, story chapters, light/dark.', '', '| Nr | Deutsch | English | Typ |', '| --- | --- | --- | --- |'];
  for (const k of K.kapitel) {
    const name = k.nr + '-' + k.slug;
    if (!fs.existsSync(path.join(DIA, 'de', name + '.html'))) continue;
    lines.push('| ' + k.nr + ' | [' + k.de.titel + '](de/' + name + '.html) · [Kapitel](../de/' + name + '.md) | [' + k.en.titel + '](en/' + name + '.html) · [chapter](../en/' + name + '.md) | ' + k.typ + ' |');
  }
  lines.push('', 'Quellen: `docs/diagramme/src/` (JSON-Spezifikation + Wörterbuch), Build: `npm run docs:diagramme`.', '');
  fs.writeFileSync(path.join(DIA, 'README.md'), lines.join('\n'));
}

main();
