# AGENTS.md — Anleitung für KI-Agenten · Guide for AI agents

Diese Datei richtet sich an **KI-Agenten** (Claude Code, andere Coding-Agenten), die an diesem Projekt mitentwickeln. Sie ergänzt [`CLAUDE.md`](CLAUDE.md) (Claude-Code-spezifisch) herstellerübergreifend; Claude Code liest zusätzlich `CLAUDE.md`.

/ This file addresses **AI agents** contributing to this project. It complements [`CLAUDE.md`](CLAUDE.md) vendor-neutrally.

---

## ⚠️ Zustimmungsregel (verbindlich) · Consent rule (binding)

> **Deutsch:** Ein Agent darf Änderungen **erarbeiten, testen und vorbereiten** (Dateien ändern, `npm test` laufen lassen, einen Commit lokal *vorschlagen*). **Aber `git commit` und `git push` erfordern die ausdrückliche Zustimmung des Menschen (Robert).** Frage vor jedem Commit/Push aktiv nach. Bei offenen fachlichen Fragen entscheidet der Mensch – nicht raten, sondern fragen.
>
> **English:** An agent may **work out, test and prepare** changes (edit files, run `npm test`, *propose* a commit locally). **But `git commit` and `git push` require the explicit consent of the human (Robert).** Ask before every commit/push. For open design questions, the human decides – don't guess, ask.

---

## Deutsch

### Worum geht es?

Selbstlernende Pflanzenbewässerung auf dem **Shelly Plus Uni** (Bodenfeuchte SMT50, Temperatur DS18B20, Wasserstand-Schwimmer). Drei Betriebs-Scripts, zwei Hardware-Test-Scripts und ein Zeitraffer-Script laufen **auf dem Gerät** in der Shelly-Script-Engine (mJS); `tools/` enthält einen Node-Mock, damit alles ohne Gerät testbar ist. **Sprache in Code, Docs und Commits: Deutsch.**

`bw_main` misst im Takt, führt Pause, Tageslimit und Wochen-Trockenphase und schreibt nur den Auftrag `job`. `bw_pump` regelt das Gießfenster selbst: Frischmessung, Portionen mit Nachmessen bis ins Zielband, Lernwert `lrn.effW`, Frist bis zum nächsten Takt. Ablauf: [Kapitel 02](docs/de/02-flussdiagramm.md), Sicherheit: [Kapitel 04](docs/de/04-sicherheit-und-grenzen.md).

### Zuerst orientieren

1. [`docs/de/README.md`](docs/de/README.md) – Handbuch-Index (21 Kapitel, Leserpfade, Glossar); online unter https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/.
2. [`CLAUDE.md`](CLAUDE.md) – Aufbau, Befehle, **harte Regeln** für die Geräte-Scripts.
3. [Kapitel 03 Konfiguration](docs/de/03-konfiguration.md) – einzige Referenz aller KVS-Felder (Single Source); [Kapitel 13](docs/de/13-betrieb-und-wartung.md) – Konsolenzeilen und Störungscodes.
4. [Kapitel 15 Ausbau mit Claude Code](docs/de/15-ausbau-mit-claude-code.md) – der Prozess für Erweiterungen: Plan, Interview, Prüfkriterien, Debug-Umgebung, Coding, Prüfung, Commit.
5. [Kapitel 17 Entscheidungslog](docs/de/17-etappen-und-entscheidungslog.md) (Entscheidungen 1–63 mit Begründung), [Kapitel 18 Lernlog](docs/de/18-lernlog-geraet.md) (am Gerät gefundene Eigenheiten), [Kapitel 20 RPC-Referenz](docs/de/20-rpc-referenz.md).

### Effizient arbeiten (graft zuerst)

Das Repo ist mit **graft** indexiert. Für Codefragen zuerst `graft ask "…" --source`, `graft grep`, `graft skeleton <datei>` oder `graft callers <sym>` nutzen, statt ganze Dateien zu lesen. `graft check` prüft, ob der Index zum Code passt. Details: [`.claude/skills/graft/SKILL.md`](.claude/skills/graft/SKILL.md).

### Harte Regeln (nicht umgehen)

`tools/test/syntax.test.js` erzwingt den mJS-Sprachumfang. Kurz:

- Nur `var` und **benannte** Funktionen; keine Arrow-Functions, Template-Strings, `const`, anonyme Funktionen, `Date`.
- **Kein Hoisting** – Namen auf Modulebene erst nach der Deklaration (Schrittliste `steps[]` am Dateiende).
- **Flache Aufrufkette** – Gerät: 12 Ebenen laufen, 14 stürzen ab; Mock-Grenze 10. `next()` ist eine Schleife, Schritte geben `true` zurück.
- **Ein offener `Shelly.call`** und ein Timer je Script; **KVS-Werte als JSON-Strings**; Versionskommentar + `var VER` pflegen.
- **Nur Array-Methoden `push`/`slice`/`splice`/`indexOf`/`join`** – `shift`, `forEach`, `map` usw. kennt mJS nicht.
- **Script-Heap ~25 KB ist geteilt:** Langläufer geben KVS-Objekte in Wartephasen frei; nie zwei große Scripts gleichzeitig laufen lassen. Größenlimit der Kompakt-Ausgabe 16 KB, `bw_pump` 18 KB.

### Definition of Done

- `npm test` und `npm run check` grün; `npm run build` erzeugt `dist/` unter dem Größenlimit, und `dist/` ist mit eingecheckt (der Test prüft den Abgleich); nach einem Upload `node tools/verify-scripts.js <ip>`.
- `npm run docs:check` ohne Fehler: cfg-Feld → Kapitel 03 (DE und EN, mit Marker), err-/why-Code → Kapitel 13, RPC → Kapitel 20, Entscheidung → Kapitel 17, Geräte-Eigenheit → Kapitel 18 **und** als Test/Mock-Nachbildung, Gerätelauf → Kapitel 19.
- Änderungen vorbereitet und erklärt – **Commit/Push erst nach menschlicher Freigabe** (siehe oben).

### Am echten Gerät debuggen

Über einen SSH-Rückwärtstunnel kann ein Agent den Shelly fernsteuern (KVS/Scripts/Konsole): [Kapitel 09](docs/de/09-installation-vps.md). Werkzeuge und Konsole: [Kapitel 14](docs/de/14-debuggen-und-testen.md). Hardware-Check als Interview zwischen Mensch am Aufbau und Werkzeug: [Kapitel 11](docs/de/11-hardware-check.md). Zeitraffer, Messlauf und Kalibrierlauf: [Kapitel 12](docs/de/12-erstinbetriebnahme.md). Der Mensch bedient die Sensoren nach Fahrplan, der Agent fährt die Werkzeuge und fragt bei offenen Entscheidungen.

---

## English

### What is this?

Self-learning plant watering on the **Shelly Plus Uni** (SMT50 soil moisture, DS18B20 temperature, float switch). Three operating scripts, two hardware-test scripts and a fast-forward script run **on the device** in the Shelly script engine (mJS); `tools/` holds a Node mock so everything is testable without hardware. **Language in code, docs and commits: German.**

`bw_main` measures every cycle, keeps pause, daily limit and the weekly dry phase, and only writes the job. `bw_pump` controls the watering window itself: fresh reading, portions with re-measuring up to the target band, learning value `lrn.effW`, deadline before the next cycle. Flow: [chapter 02](docs/en/02-flussdiagramm.md), safety: [chapter 04](docs/en/04-sicherheit-und-grenzen.md).

### Get oriented first

1. [`docs/en/README.md`](docs/en/README.md) – handbook index (21 chapters, reading paths, glossary); online at https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/.
2. [`CLAUDE.md`](CLAUDE.md) – structure, commands, **hard rules** for the device scripts (German).
3. [Chapter 03 configuration](docs/en/03-konfiguration.md) – the single reference of all KVS fields; [chapter 13](docs/en/13-betrieb-und-wartung.md) – console lines and fault codes.
4. [Chapter 15 extending with Claude Code](docs/en/15-ausbau-mit-claude-code.md) – the process for extensions: plan, interview, acceptance criteria, debug environment, coding, verification, commit.
5. [Chapter 17 decision log](docs/en/17-etappen-und-entscheidungslog.md) (decisions 1–63 with reasons), [chapter 18 lessons from the device](docs/en/18-lernlog-geraet.md), [chapter 20 RPC reference](docs/en/20-rpc-referenz.md).

### Work efficiently (graft first)

The repo is indexed with **graft**. For code questions use `graft ask "…" --source`, `graft grep`, `graft skeleton <file>` or `graft callers <sym>` before reading whole files. See [`.claude/skills/graft/SKILL.md`](.claude/skills/graft/SKILL.md).

### Hard rules (do not bypass)

Enforced by `tools/test/syntax.test.js`: only `var` and **named** functions; no arrow functions, template strings, `const`, anonymous functions, `Date`; **no hoisting** (`steps[]` at end of file); **flat call chain** (device: 12 levels run, 14 crash; mock limit 10; `next()` is a loop, steps return `true`); **one open `Shelly.call`** and one timer per script; **KVS values as JSON strings**; keep the version comment + `var VER`; **only the array methods `push`/`slice`/`splice`/`indexOf`/`join`**; **the script heap (~25 KB) is shared** – long-running scripts release KVS objects while waiting; never run two large scripts at the same time; compact output limit 16 KB, `bw_pump` 18 KB.

### Definition of done

`npm test` and `npm run check` green; `npm run build` produces `dist/` under the size limit and `dist/` is committed too (a test checks the match); after an upload `node tools/verify-scripts.js <ip>`; `npm run docs:check` without errors: cfg field → chapter 03 (DE and EN, with marker), err/why code → chapter 13, RPC → chapter 20, decision → chapter 17, on-device quirk → chapter 18 **and** as a test/mock emulation, device run → chapter 19. Prepare and explain changes – **commit/push only after human approval** (see top).

### Debug the real device

Via an SSH reverse tunnel an agent can remote-control the Shelly (KVS/scripts/console): [chapter 09](docs/en/09-installation-vps.md). Tools and console: [chapter 14](docs/en/14-debuggen-und-testen.md). The hardware check runs as an interview between the human at the setup and the tool: [chapter 11](docs/en/11-hardware-check.md). Fast-forward test, measurement run and calibration run: [chapter 12](docs/en/12-erstinbetriebnahme.md). The human handles the sensors per schedule, the agent drives the tools and asks when a decision is open.
