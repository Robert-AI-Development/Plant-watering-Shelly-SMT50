// tools/docs/geruest.mjs v0.1.0 – Index docs/de|en/README.md aus tools/docs/kapitel.json erzeugen, fehlende Kapitel als Platzhalter anlegen
//
// Aufruf: node tools/docs/geruest.mjs            (npm run docs:geruest)
// Schreibt beide Indexe vollständig neu (Parität DE/EN garantiert); vorhandene Kapiteldateien werden nie überschrieben.
// Status je Kapitel steht in kapitel.json ("aufbau" | "fertig"); der Integrator setzt ihn beim Commit des Kapitels.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const K = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'docs', 'kapitel.json'), 'utf8'));
const DOCS = path.join(ROOT, 'docs');

const T = {
  de: {
    h1: 'Handbuch – Pflanzenbewässerung mit dem Shelly Plus Uni',
    switch: '**Deutsch** · [English](../en/README.md) — [Startseite](../index.md) · [Repository](' + K.repo + ')',
    intro: 'Selbstlernende Bewässerung für eine Pflanze: ein Shelly Plus Uni misst Bodenfeuchte (SMT50), Temperatur (DS18B20) und Wasserstand, gießt in Portionen mit Nachmessen und lernt, wie viel Feuchte eine Pumpensekunde bringt. Alles läuft lokal auf dem Gerät, ohne Cloud. Dieses Handbuch ist in sechs Teile gegliedert; jedes Kapitel hat ein interaktives Diagramm.',
    stand: 'Stand', standZeilen: [
      'Projektversion <!-- fact:project.version -->0.2.0<!-- /fact --> · Scripts bw_main <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, bw_pump <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, bw_install <!-- fact:ver.bw_install -->0.1.3<!-- /fact -->, bw_zeitraffer <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact -->',
      'Tests im Mock: <!-- fact:tests -->146<!-- /fact --> · Kompakt-Ausgabe bw_pump <!-- fact:dist.bw_pump -->17475<!-- /fact --> B (Grenze <!-- fact:size_limit_pump -->18000<!-- /fact -->), übrige Scripts unter <!-- fact:size_limit -->16000<!-- /fact --> B',
      'Letzter Gerätelauf: 13.09.2026 (Regelkreis-Fenster im Zeitraffer, Kalibrierwerte geschrieben) – Kapitel 19',
    ],
    pfade: 'Leserpfade', pfadeZeilen: [
      '**Einsteiger:** 05 Verkabelung → 06 Startanleitung → 07 oder 08 Installation → 12 Erstinbetriebnahme → 13 Betrieb',
      '**Maker:** 01 Architektur → 02 Flussdiagramm → 03 Konfiguration → 14 Debuggen → 15 Ausbau',
      '**KI-Agent:** [CLAUDE.md](' + K.repo + '/blob/main/CLAUDE.md) → 15 Ausbau → 17 Entscheidungslog → 18 Lernlog → 20 RPC-Referenz',
    ],
    kapitel: 'Kapitel', teil: 'Teil', spalten: '| Nr | Kapitel | Für wen | Ergebnis | Diagramm |', aufbau: 'im Aufbau',
    diagramm: 'interaktiv', diagrammHinweis: 'Diagramme: jedes Kapitel zeigt ein statisches Bild und verlinkt die interaktive Fassung (Zoom, Suche, Fokus auf ein Element, Beziehungs-Trace, Story-Kapitel, Hell/Dunkel). Die Bedienoberfläche der Diagramme ist Englisch (Werkzeuggrenze), die Beschriftung Deutsch.',
    konv: 'Konventionen', konvZeilen: [
      '`<ip>` steht für die Adresse des Shelly, z. B. `192.168.88.10` im LAN oder `127.0.0.1:8010` über den SSH-Tunnel (Kapitel 09).',
      'Script-IDs vergibt das Gerät; `node tools/hwtest.js <ip> scripts` zeigt sie. Beispiele nennen die IDs des Referenzgeräts (1 = bw_install, 2 = bw_main, 3 = bw_pump, 7 = bw_zeitraffer).',
      'Konsolenzeilen, KVS-Felder und Störungscodes sind Deutsch und werden nie übersetzt; das englische Handbuch erklärt sie im Glossar.',
      '`[TODO am Gerät]` markiert Aussagen, die noch am echten Aufbau zu messen sind.',
      'Zahlen in den Kapiteln stammen aus den Scripts (`bw_install.js` DEF, `bw_zeitraffer.js` ZR3/ZR4) und den datierten Protokollen; `npm run docs:check` prüft sie.',
    ],
    glossar: 'Glossar', glossarZeilen: [
      '| Begriff | Bedeutung |', '| --- | --- |',
      '| Takt | Lauf von `bw_main` alle `tick` Minuten (Standard 15): messen, bewerten, Auftrag schreiben |',
      '| Fenster | Lauf von `bw_pump` zu den Gießzeiten (`winA`/`winB`, Sekunde 30): Frischmessung, Portionen, Lernen |',
      '| Portion | ein Einschalten der Pumpe mit `toggle_after`; ein Fenster hat bis zu `nPort` Portionen |',
      '| Gabe | die Summe der Portionen eines Fensters |',
      '| Auftrag (`job`) | Übergabe von `bw_main` an `bw_pump`: `ok`, `sec`, `pct`, `why` |',
      '| Kontrolle | Nachmessung durch `bw_main` `soak` Minuten nach dem Fenster |',
      '| Pause / Sperre | Mindestabstand zwischen Gaben (`pause`, `pauseHot`, `pauseSlow`), Zustand `st.state = "sperre"` |',
      '| Trockenphase | keine Gabe ab dem Trockentag (`dryDay`) oder nach Nässe (`> pctHi`), bis die Feuchte unter `pctDry` liegt |',
      '| Zielband | `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` in Prozent Bodenfeuchte |',
      '| Zeitraffer | dieselben Scripts mit kurzen Zeiten (Takt 3 min, Fenster alle 6 min) für einen 45-Minuten-Test |',
      '| Messlauf / Kalibrierlauf | Werkzeuge `hwtest.js mess` und `kal`: Wirkung eines Pumpenpulses messen, Lernwerte ableiten |',
      '| Frist | Zeit, die `bw_pump` im Fenster bis zum nächsten Takt hat (`tWin`, `tTail`) |',
      '| Claim | `st.why = "laeuft"`: Markierung eines laufenden Fensters im KVS (abbruchsicher) |',
      '| Störung (`err`) | Blockierender oder informierender Code, z. B. `wasser`, `noeff`, `cfg` |',
    ],
    platzhalterTitel: 'Im Aufbau', platzhalter: 'Dieses Kapitel wird gerade geschrieben. Bis dahin gilt die bisherige Dokumentation:',
    handbuch: 'Handbuch',
  },
  en: {
    h1: 'Handbook – Plant watering with the Shelly Plus Uni',
    switch: '[Deutsch](../de/README.md) · **English** — [Start page](../index.md) · [Repository](' + K.repo + ')',
    intro: 'Self-learning watering for one plant: a Shelly Plus Uni measures soil moisture (SMT50), temperature (DS18B20) and water level, waters in portions with re-measuring and learns how much moisture one pump second brings. Everything runs locally on the device, no cloud. This handbook has six parts; every chapter comes with an interactive diagram.',
    stand: 'Status', standZeilen: [
      'Project version <!-- fact:project.version -->0.2.0<!-- /fact --> · scripts bw_main <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, bw_pump <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, bw_install <!-- fact:ver.bw_install -->0.1.3<!-- /fact -->, bw_zeitraffer <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact -->',
      'Mock tests: <!-- fact:tests -->146<!-- /fact --> · compact output bw_pump <!-- fact:dist.bw_pump -->17475<!-- /fact --> B (limit <!-- fact:size_limit_pump -->18000<!-- /fact -->), other scripts below <!-- fact:size_limit -->16000<!-- /fact --> B',
      'Last device run: 13 Sep 2026 (control-loop window in fast-forward, calibration values written) – chapter 19',
    ],
    pfade: 'Reading paths', pfadeZeilen: [
      '**Beginner:** 05 wiring → 06 start guide → 07 or 08 installation → 12 first commissioning → 13 operation',
      '**Maker:** 01 architecture → 02 flow → 03 configuration → 14 debugging → 15 extending',
      '**AI agent:** [CLAUDE.md](' + K.repo + '/blob/main/CLAUDE.md) → 15 extending → 17 decision log → 18 lessons → 20 RPC reference',
    ],
    kapitel: 'Chapters', teil: 'Part', spalten: '| No. | Chapter | For whom | Outcome | Diagram |', aufbau: 'in progress',
    diagramm: 'interactive', diagrammHinweis: 'Diagrams: every chapter shows a static image and links the interactive version (zoom, search, focus on one element, relationship trace, story chapters, light/dark). The diagram UI is English; labels follow the chapter language.',
    konv: 'Conventions', konvZeilen: [
      '`<ip>` is the Shelly address, e.g. `192.168.88.10` on the LAN or `127.0.0.1:8010` through the SSH tunnel (chapter 09).',
      'Script IDs are assigned by the device; `node tools/hwtest.js <ip> scripts` lists them. Examples use the IDs of the reference device (1 = bw_install, 2 = bw_main, 3 = bw_pump, 7 = bw_zeitraffer).',
      'Console lines, KVS fields and fault codes are German and are never translated; the glossary below explains them.',
      '`[TODO am Gerät]` marks statements that still have to be measured on the real setup.',
      'Numbers in the chapters come from the scripts (`bw_install.js` DEF, `bw_zeitraffer.js` ZR3/ZR4) and the dated protocols; `npm run docs:check` verifies them.',
    ],
    glossar: 'Glossary', glossarZeilen: [
      '| Term (German) | Meaning |', '| --- | --- |',
      '| Takt (cycle) | run of `bw_main` every `tick` minutes (default 15): measure, evaluate, write the job |',
      '| Fenster (window) | run of `bw_pump` at the watering times (`winA`/`winB`, second 30): fresh measurement, portions, learning |',
      '| Portion | one pump switch-on with `toggle_after`; a window has up to `nPort` portions |',
      '| Gabe (dose) | the sum of all portions of one window |',
      '| Auftrag (`job`) | hand-over from `bw_main` to `bw_pump`: `ok`, `sec`, `pct`, `why` |',
      '| Kontrolle (check) | re-measurement by `bw_main` `soak` minutes after the window |',
      '| Pause / Sperre (lock) | minimum distance between doses (`pause`, `pauseHot`, `pauseSlow`), state `st.state = "sperre"` |',
      '| Trockenphase (dry phase) | no dose from the dry day (`dryDay`) or after wetness (`> pctHi`) until moisture drops below `pctDry` |',
      '| Zielband (target band) | `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` in percent soil moisture |',
      '| Zeitraffer (fast-forward) | the same scripts with short times (cycle 3 min, window every 6 min) for a 45-minute test |',
      '| Messlauf / Kalibrierlauf | tools `hwtest.js mess` and `kal`: measure the effect of a pump pulse, derive learning values |',
      '| Frist (deadline) | time `bw_pump` has inside the window before the next cycle (`tWin`, `tTail`) |',
      '| Claim | `st.why = "laeuft"`: marks a running window in the KVS (crash-safe) |',
      '| Störung (`err`, fault) | blocking or informational code, e.g. `wasser` (water), `noeff` (no effect), `cfg` |',
      '| Console words | `feucht` = moist (no dose), `trocken` = dry phase, `wasser` = tank empty, `laeuft` = running, `gegossen` = watered, `beob` = observing, `ok` = job ready |',
    ],
    platzhalterTitel: 'In progress', platzhalter: 'This chapter is being written. Until then the previous documentation applies:',
    handbuch: 'Handbook',
  },
};

function teilName(id, lang) { return K.teile.find((t) => t.id === id)[lang]; }

function index(lang) {
  const t = T[lang];
  const out = [];
  out.push('# ' + t.h1, '', t.switch, '', t.intro, '');
  out.push('> **' + t.stand + '**');
  for (const z of t.standZeilen) out.push('> - ' + z);
  out.push('');
  out.push('## ' + t.pfade, '');
  for (const z of t.pfadeZeilen) out.push('- ' + z);
  out.push('');
  out.push('## ' + t.kapitel, '');
  out.push(t.diagrammHinweis, '');
  for (const teil of K.teile) {
    out.push('### ' + t.teil + ' ' + teil.id + ' – ' + teil[lang], '');
    out.push(t.spalten, '| --- | --- | --- | --- | --- |');
    for (const k of K.kapitel.filter((x) => x.teil === teil.id)) {
      const file = k.nr + '-' + k.slug + '.md';
      const status = k.status === 'fertig' ? '' : ' *(' + t.aufbau + ')*';
      const dia = k.status === 'fertig' ? '[' + t.diagramm + '](' + K.basis + 'diagramme/' + lang + '/' + k.nr + '-' + k.slug + '.html)' : '–';
      out.push('| ' + k.nr + ' | [' + k[lang].titel + '](' + file + ')' + status + ' | ' + k[lang].wer + ' | ' + k[lang].ergebnis + ' | ' + dia + ' |');
    }
    out.push('');
  }
  out.push('## ' + t.konv, '');
  for (const z of t.konvZeilen) out.push('- ' + z);
  out.push('');
  out.push('## ' + t.glossar, '');
  for (const z of t.glossarZeilen) out.push(z);
  out.push('');
  return out.join('\n');
}

function platzhalter(k, lang) {
  const t = T[lang];
  const other = lang === 'de' ? 'en' : 'de';
  const file = k.nr + '-' + k.slug + '.md';
  const sw = lang === 'de'
    ? '**Deutsch** · [English](../en/' + file + ') — [Handbuch](README.md) · Teil ' + k.teil + ' „' + teilName(k.teil, 'de') + '“'
    : '[Deutsch](../de/' + file + ') · **English** — [Handbook](README.md) · Part ' + k.teil + ' "' + teilName(k.teil, 'en') + '"';
  return [
    '# ' + k.nr + ' · ' + k[lang].titel, '', sw, '', '<!-- im-aufbau -->',
    '> **' + t.platzhalterTitel + ':** ' + t.platzhalter + ' [README](' + K.repo + '/blob/main/README.md).', '',
  ].join('\n') + (other ? '' : '');
}

let created = 0;
for (const lang of ['de', 'en']) {
  const dir = path.join(DOCS, lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), index(lang));
  for (const k of K.kapitel) {
    const file = path.join(dir, k.nr + '-' + k.slug + '.md');
    if (!fs.existsSync(file)) { fs.writeFileSync(file, platzhalter(k, lang)); created++; }
  }
}
console.log('Index docs/de/README.md und docs/en/README.md geschrieben, ' + created + ' Platzhalter angelegt (' + K.kapitel.length + ' Kapitel).');
