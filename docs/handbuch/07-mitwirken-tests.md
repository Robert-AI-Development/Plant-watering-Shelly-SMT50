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
npm test            # 144 Tests gegen den Mock (inkl. Fenster-Regelkreis, 7-Tage-Simulation) – müssen grün bleiben
npm run check       # node --check der sechs Geräte-Scripts
npm run build       # dist/ neu erzeugen (nach Änderungen an scripts/)

# Ohne Gerät ausprobieren:
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
# Hardware-Tests mit virtuellem Bediener (tools/mock/hwdemo.js): Sensor-Rampen, go/skip/abort automatisch
node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo
node tools/run-script.js scripts/bw_hwpump.js --seed --hwdemo   # Uhr 10:07, bw_pump läuft als zweites Script
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":25,"pct":20,"why":"hand","ts":1789192500}'   # Fenster-Regelkreis (mit Band in cfg2)
```

### Der Ablauf

1. **Verhalten zuerst im Mock testen.** `tools/mock/shelly-mock.js` bildet den Shelly in Node nach (KVS, Zeitplan,
   Switch, Sensoren, Timer, virtuelle Uhr). Seit v0.1.2 führt `Script.Start` eine registrierte Datei
   (`dev.files[name]`) als zweites Script aus – mit eigenen Timern, Fehlern und Callbacks je Lauf –, und Eingänge
   haben eine Konfiguration (`dev.inputCfg`, `Input.GetConfig`/`SetConfig`; deaktiviert → `state: null`).
   `tools/mock/hwdemo.js` ist ein virtueller Bediener für die Hardware-Tests: Sensor-Rampen je Phase und ein
   Treiber, der `go`/`skip`/`abort` schickt, sobald das Script `hwc` abfragt. Für den Regelkreis im Gießfenster gibt es
   `potModel()` in `tools/test/helpers.js` – ein Topfmodell (Wirkung je wirksame Pumpensekunde, Totzeit `tDead`/`tDead2`,
   Rampe, Drainage, Austrocknung, Rauschen), gegen das `pump.test.js` die Ergebnismatrix aus `docs/PLAN.md` durchspielt
   (je Zeile ein Test: Einzelportion, Korrekturportionen, `feucht`, `over`, `noeff`, `stall`, `unstab`, `zeit`, LEER,
   extern, Claim); `zeitraffer.test.js` nutzt es für den 45-Minuten-Fahrplan. Neue Funktion → passenden Test in
   `tools/test/*.test.js` ergänzen (Hardware-Tests: `hwtest.test.js`, `hwpump.test.js`).
2. **`npm test` muss grün bleiben** (aktuell 144 Tests). Ändern sich err-Codes, cfg-Felder oder RPCs, ziehe
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
- **Keine Array-Methoden, die mJS nicht kennt:** `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`,
  `includes`, `some`, `every`, `sort` sind verboten (am Gerät: `Function "shift" not found!`) – Ringpuffer per
  Index, Schleifen mit `for`.
- **Speicher:** Der Script-Heap (~25 KB) ist von allen Scripts geteilt. Langläufer wie `bw_hwtest`/`bw_hwpump`
  müssen die KVS-Objekte `K`/`orig` in Wartephasen freigeben, sonst fällt der 15-min-Takt von `bw_main` daneben
  mit `out_of_memory` aus. `bw_pump` regelt im Fenster bis zu `tWin` s und hält die Frist bis zum nächsten Takt
  selbst ein – es läuft nie neben `bw_main`.
- **Konsolen-Burst:** nie mehr als 15 `print` am Stück (der Debug-Websocket verliert sonst Zeilen); `noBurst()` prüft es.
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
npm test            # 144 tests against the mock (incl. window control loop, 7-day simulation) – must stay green
npm run check       # node --check of the six device scripts
npm run build       # regenerate dist/ (after changes to scripts/)

# Try without a device:
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
# Hardware tests with a virtual operator (tools/mock/hwdemo.js): sensor ramps, go/skip/abort automatically
node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo
node tools/run-script.js scripts/bw_hwpump.js --seed --hwdemo   # clock 10:07, bw_pump runs as a second script
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":25,"pct":20,"why":"hand","ts":1789192500}'   # window control loop (band in cfg2 required)
```

### The workflow

1. **Test behaviour in the mock first.** `tools/mock/shelly-mock.js` emulates the Shelly in Node (KVS, schedule,
   switch, sensors, timers, virtual clock). Since v0.1.2 `Script.Start` runs a registered file (`dev.files[name]`)
   as a second script – with its own timers, errors and callbacks per run –, and inputs have a configuration
   (`dev.inputCfg`, `Input.GetConfig`/`SetConfig`; disabled → `state: null`). `tools/mock/hwdemo.js` is a virtual
   operator for the hardware tests: sensor ramps per phase and a driver that sends `go`/`skip`/`abort` as soon as
   the script polls `hwc`. For the control loop in the watering window there is `potModel()` in `tools/test/helpers.js`
   – a pot model (gain per effective pump second, dead time `tDead`/`tDead2`, ramp, drainage, drying, noise) against which
   `pump.test.js` plays through the result matrix from `docs/PLAN.md` (one test per row: single portion, correction
   portions, `feucht`, `over`, `noeff`, `stall`, `unstab`, `zeit`, EMPTY, external, claim); `zeitraffer.test.js` uses it
   for the 45-minute schedule. New feature → add a matching test in `tools/test/*.test.js` (hardware tests:
   `hwtest.test.js`, `hwpump.test.js`).
2. **`npm test` must stay green** (currently 144 tests). If err codes, cfg fields or RPCs change, update
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
- **No array methods mJS does not know:** `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`,
  `includes`, `some`, `every`, `sort` are forbidden (on the device: `Function "shift" not found!`) – ring buffers by
  index, loops with `for`.
- **Memory:** the script heap (~25 KB) is shared by all scripts. Long runners like `bw_hwtest`/`bw_hwpump` must
  release the KVS objects `K`/`orig` during waiting phases, otherwise `bw_main`'s 15-minute cycle next to them fails
  with `out_of_memory`. `bw_pump` controls the window for up to `tWin` s and keeps the deadline before the next cycle
  itself – it never runs next to `bw_main`.
- **Console burst:** never more than 15 `print` calls in a row (the debug websocket drops lines otherwise); `noBurst()` checks it.
- Maintain the **version comment** on line 1 and `var VER`.

The full list with rationale is in [`../../CLAUDE.md`](../../CLAUDE.md) and
[`../../scripts/lib_notes.md`](../../scripts/lib_notes.md).

### For AI agents

Other agents may actively contribute. Please read [`../../AGENTS.md`](../../AGENTS.md). Key point:

> An agent may work out, test and prepare changes – **commit and push require the explicit consent of the human
> (Robert).** Direct open questions to the human.
