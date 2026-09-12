# AGENTS.md — Anleitung für KI-Agenten · Guide for AI agents

Diese Datei richtet sich an **KI-Agenten** (Claude Code, andere Coding-Agenten), die an diesem Projekt
mitentwickeln. Sie ergänzt [`CLAUDE.md`](CLAUDE.md) (Claude-Code-spezifisch) herstellerübergreifend – kein
Widerspruch: Claude Code liest zusätzlich `CLAUDE.md`.

/ This file addresses **AI agents** contributing to this project. It complements [`CLAUDE.md`](CLAUDE.md)
vendor-neutrally.

---

## ⚠️ Zustimmungsregel (verbindlich) · Consent rule (binding)

> **Deutsch:** Ein Agent darf Änderungen **erarbeiten, testen und vorbereiten** (Dateien ändern, `npm test`
> laufen lassen, einen Commit lokal *vorschlagen*). **Aber `git commit` und `git push` erfordern die
> ausdrückliche Zustimmung des Menschen (Robert).** Frage vor jedem Commit/Push aktiv nach. Bei offenen fachlichen
> Fragen entscheidet der Mensch – nicht raten, sondern fragen.
>
> **English:** An agent may **work out, test and prepare** changes (edit files, run `npm test`, *propose* a commit
> locally). **But `git commit` and `git push` require the explicit consent of the human (Robert).** Ask before
> every commit/push. For open design questions, the human decides – don't guess, ask.

---

## Deutsch

### Worum geht es?

Selbstlernende Pflanzenbewässerung auf dem **Shelly Plus Uni** (Bodenfeuchte SMT50, Temperatur DS18B20,
Wasserstand-Schwimmer). Drei Betriebs-Scripts und zwei Hardware-Test-Scripts laufen **auf dem Gerät** in der Shelly-Script-Engine (mJS); `tools/` enthält
einen Node-Mock, damit alles ohne Gerät testbar ist. **Sprache in Code, Docs und Commits: Deutsch.**

### Zuerst orientieren

1. [`README.md`](README.md) – Nutzerdoku, alle KVS-Felder und Störungscodes (Single Source).
2. [`CLAUDE.md`](CLAUDE.md) – Aufbau, Befehle, **harte Regeln** für die Geräte-Scripts.
3. [`docs/PLAN.md`](docs/PLAN.md) – Entscheidungstabelle mit Begründungen. [`LEARNING.md`](LEARNING.md) –
   am echten Gerät gefundene Eigenheiten.
4. [`docs/handbuch/`](docs/handbuch/README.md) – zweisprachiges Handbuch (Hardware, Installation, VPS, Debug).

### Effizient arbeiten (graft zuerst)

Das Repo ist mit **graft** indexiert. Für Codefragen zuerst `graft ask "…" --source`, `graft grep`,
`graft skeleton <datei>` oder `graft callers <sym>` nutzen, statt ganze Dateien zu lesen. `graft check` prüft, ob
der Index zum Code passt. Details: [`.claude/skills/graft/SKILL.md`](.claude/skills/graft/SKILL.md).

### Harte Regeln (nicht umgehen)

`tools/test/syntax.test.js` erzwingt den mJS-Sprachumfang. Kurz:

- Nur `var` und **benannte** Funktionen; keine Arrow-Functions, Template-Strings, `const`, anonyme Funktionen, `Date`.
- **Kein Hoisting** – Namen auf Modulebene erst nach der Deklaration (Schrittliste `steps[]` am Dateiende).
- **Flache Aufrufkette** – Stack ~12 Ebenen; `next()` ist eine Schleife, Schritte geben `true` zurück.
- **Ein offener `Shelly.call`** und ein Timer je Script; **KVS-Werte als JSON-Strings**; Versionskommentar + `var VER` pflegen.
- **Nur Array-Methoden `push`/`slice`/`splice`/`indexOf`/`join`** – `shift`, `forEach`, `map` usw. kennt mJS nicht (`syntax.test.js`).
- **Script-Heap ~25 KB ist von allen Scripts geteilt:** Langläufer (`bw_hwtest`/`bw_hwpump`) geben KVS-Objekte in Wartephasen frei; nie zwei große Scripts gleichzeitig laufen lassen.

### Definition of Done

- `npm test` (89) und `npm run check` grün; `npm run build` erzeugt `dist/` unter dem Größenlimit.
- Bei Änderungen an err-Codes/cfg-Feldern/RPCs: README, `scripts/lib_notes.md`, ggf. `docs/PLAN.md` nachgezogen.
- Neue Entscheidung → `docs/PLAN.md`; Geräte-Eigenheit → `LEARNING.md` **und** als Test/Mock-Nachbildung.
- Änderungen vorbereitet und erklärt – **Commit/Push erst nach menschlicher Freigabe** (siehe oben).

### Am echten Gerät debuggen

Über einen SSH-Rückwärtstunnel kann ein Agent den Shelly fernsteuern (KVS/Scripts/Konsole). Anleitung:
[`docs/handbuch/06-shelly-remote-debug.md`](docs/handbuch/06-shelly-remote-debug.md). Werkzeuge: `tools/put-script.js`,
`tools/console.js`, `tools/probe/`, `tools/hwtest.js` (Hardware-Test vom VPS steuern). Der Hardware-Test der Sensoren
und der Pumpe (`bw_hwtest`/`bw_hwpump` am Gerät) läuft als Interview: `node tools/hwtest.js <ip> preflight`, dann
`start bw_hwtest` bzw. `start bw_hwpump`, mit `watch` beobachten und je Phase `go` senden.

---

## English

### What is this?

Self-learning plant watering on the **Shelly Plus Uni** (SMT50 soil moisture, DS18B20 temperature, float switch).
Three operating scripts and two hardware-test scripts run **on the device** in the Shelly script engine (mJS); `tools/` holds a Node mock so everything is
testable without hardware. **Language in code, docs and commits: German.**

### Get oriented first

Read [`README.md`](README.md) (all KVS fields and error codes – single source), [`CLAUDE.md`](CLAUDE.md) (structure,
commands, **hard rules**), [`docs/PLAN.md`](docs/PLAN.md) (decisions) and [`LEARNING.md`](LEARNING.md) (on-device
quirks). The bilingual handbook is in [`docs/handbuch/`](docs/handbuch/README.md).

### Work efficiently (graft first)

The repo is indexed with **graft**. For code questions use `graft ask "…" --source`, `graft grep`,
`graft skeleton <file>` or `graft callers <sym>` before reading whole files. See
[`.claude/skills/graft/SKILL.md`](.claude/skills/graft/SKILL.md).

### Hard rules (do not bypass)

Enforced by `tools/test/syntax.test.js`: only `var` and **named** functions; no arrow functions, template strings,
`const`, anonymous functions, `Date`; **no hoisting** (`steps[]` at end of file); **flat call chain** (`next()` is a
loop, steps return `true`); **one open `Shelly.call`** and one timer per script; **KVS values as JSON strings**;
keep the version comment + `var VER`; **only the array methods `push`/`slice`/`splice`/`indexOf`/`join`** – mJS has no
`shift`, `forEach`, `map` etc. (`syntax.test.js`); **the script heap (~25 KB) is shared by all scripts** – long-running
scripts (`bw_hwtest`/`bw_hwpump`) release KVS objects while waiting; never run two large scripts at the same time.

### Definition of done

`npm test` (89) and `npm run check` green; `npm run build` produces `dist/` under the size limit; docs updated when
err codes/cfg fields/RPCs change; new decisions in `docs/PLAN.md`, on-device quirks in `LEARNING.md` **and** as a
test/mock emulation. Prepare and explain changes – **commit/push only after human approval** (see top).

### Debug the real device

Via an SSH reverse tunnel an agent can remote-control the Shelly (KVS/scripts/console). Guide:
[`docs/handbuch/06-shelly-remote-debug.md`](docs/handbuch/06-shelly-remote-debug.md). Tools: `tools/put-script.js`,
`tools/console.js`, `tools/probe/`, `tools/hwtest.js` (drive the hardware test from the VPS). The hardware test of
sensors and pump (`bw_hwtest`/`bw_hwpump` on the device) runs as an interview: `node tools/hwtest.js <ip> preflight`,
then `start bw_hwtest` or `start bw_hwpump`, observe with `watch` and send `go` per phase.
