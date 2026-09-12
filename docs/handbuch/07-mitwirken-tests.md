# 7 · Mitwirken & Tests — Contributing & tests

**Sprache / Language:** [Deutsch](#deutsch) · [English](#english) — [Handbuch-Index](README.md)

---

## Deutsch

Beiträge sind willkommen – von Menschen **und** von KI-Agenten. Dieses Kapitel fasst den Arbeitsablauf und die
Regeln zusammen. Für KI-Agenten gilt zusätzlich [`../../AGENTS.md`](../../AGENTS.md) (inklusive der
**Zustimmungsregel** für Commits).

### Schnellstart

```bash
npm install
npm test            # 58 Tests gegen den Mock (inkl. 7-Tage-Simulation) – müssen grün bleiben
npm run check       # node --check der drei Geräte-Scripts
npm run build       # dist/ neu erzeugen (nach Änderungen an scripts/)

# Ohne Gerät ausprobieren:
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
```

### Der Ablauf

1. **Verhalten zuerst im Mock testen.** `tools/mock/shelly-mock.js` bildet den Shelly in Node nach (KVS, Zeitplan,
   Switch, Sensoren, Timer, virtuelle Uhr). Neue Funktion → passenden Test in `tools/test/*.test.js` ergänzen.
2. **`npm test` muss grün bleiben** (aktuell 58 Tests). Ändern sich err-Codes, cfg-Felder oder RPCs, ziehe
   [`../../README.md`](../../README.md), [`../../scripts/lib_notes.md`](../../scripts/lib_notes.md) und ggf.
   [`../PLAN.md`](../PLAN.md) mit.
3. **Neue Design-Entscheidungen** kommen in die Entscheidungstabelle in [`../PLAN.md`](../PLAN.md).
4. **Am Gerät gefundene Eigenheiten** kommen in [`../../LEARNING.md`](../../LEARNING.md) **und** – wo möglich – als
   Regel/Nachbildung in die Tests (so wie Hoisting, Stacktiefe, KVS-Strings und der Schedule-Retry).
5. **Commit & Pull Request.** Sprache in Code-Kommentaren, Docs und Commits: **Deutsch**. Nicht auf `main` direkt
   arbeiten – Branch anlegen, PR öffnen.

### Harte Regeln für die Geräte-Scripts

Die Shelly-Script-Engine (mJS) ist eingeschränkt. `tools/test/syntax.test.js` erzwingt die Regeln – die wichtigsten:

- Nur `var` und **benannte** Funktionen; **kein** `const`/`let`-Zwang aufheben, keine Arrow-Functions, keine
  Template-Strings, keine anonymen Funktionen, kein `Date`.
- **Kein Hoisting:** Funktionsnamen auf Modulebene erst **nach** ihrer Deklaration nutzen (Schrittliste `steps[]`
  steht am Dateiende).
- **Flache Aufrufkette:** der Stack fasst nur ~12 Ebenen; `next()` ist eine Schleife, Schritte geben `true` zurück.
- **Immer nur ein offener `Shelly.call`** und ein Timer je Script.
- **KVS-Werte als JSON-Strings** (`JSON.stringify`/`fromKvs`).
- **Versionskommentar** in Zeile 1 und `var VER` pflegen.

Die vollständige Liste mit Begründungen steht in [`../../CLAUDE.md`](../../CLAUDE.md) und
[`../../scripts/lib_notes.md`](../../scripts/lib_notes.md).

### Für KI-Agenten

Andere Agenten dürfen aktiv mitentwickeln. Bitte [`../../AGENTS.md`](../../AGENTS.md) lesen. Kernpunkt:

> Ein Agent darf Änderungen erarbeiten, testen und vorbereiten – **Commit und Push erfordern die ausdrückliche
> Zustimmung des Menschen (Robert).** Offene Fragen an den Menschen richten.

---

## English

Contributions are welcome – from humans **and** AI agents. This chapter summarises the workflow and rules. AI
agents must additionally follow [`../../AGENTS.md`](../../AGENTS.md) (including the **consent rule** for commits).

### Quick start

```bash
npm install
npm test            # 58 tests against the mock (incl. 7-day simulation) – must stay green
npm run check       # node --check of the three device scripts
npm run build       # regenerate dist/ (after changes to scripts/)

# Try without a device:
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
```

### The workflow

1. **Test behaviour in the mock first.** `tools/mock/shelly-mock.js` emulates the Shelly in Node (KVS, schedule,
   switch, sensors, timers, virtual clock). New feature → add a matching test in `tools/test/*.test.js`.
2. **`npm test` must stay green** (currently 58 tests). If err codes, cfg fields or RPCs change, update
   [`../../README.md`](../../README.md), [`../../scripts/lib_notes.md`](../../scripts/lib_notes.md) and possibly
   [`../PLAN.md`](../PLAN.md).
3. **New design decisions** go into the decision table in [`../PLAN.md`](../PLAN.md).
4. **On-device quirks** go into [`../../LEARNING.md`](../../LEARNING.md) **and** – where possible – as a
   rule/emulation in the tests (like hoisting, stack depth, KVS strings and the schedule retry).
5. **Commit & pull request.** Language in code comments, docs and commits: **German**. Don't work on `main`
   directly – create a branch, open a PR.

### Hard rules for the device scripts

The Shelly script engine (mJS) is limited. `tools/test/syntax.test.js` enforces the rules – the most important:

- Only `var` and **named** functions; no arrow functions, no template strings, no `const`, no anonymous functions,
  no `Date`.
- **No hoisting:** use function names at module level only **after** their declaration (the `steps[]` list is at
  the end of the file).
- **Flat call chain:** the stack holds only ~12 levels; `next()` is a loop, steps return `true`.
- **Only one open `Shelly.call`** and one timer per script.
- **KVS values as JSON strings** (`JSON.stringify`/`fromKvs`).
- Maintain the **version comment** on line 1 and `var VER`.

The full list with rationale is in [`../../CLAUDE.md`](../../CLAUDE.md) and
[`../../scripts/lib_notes.md`](../../scripts/lib_notes.md).

### For AI agents

Other agents may actively contribute. Please read [`../../AGENTS.md`](../../AGENTS.md). Key point:

> An agent may work out, test and prepare changes – **commit and push require the explicit consent of the human
> (Robert).** Direct open questions to the human.
