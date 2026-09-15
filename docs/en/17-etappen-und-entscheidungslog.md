# 17 · Stage and decision log

[Deutsch](../de/17-etappen-und-entscheidungslog.md) · **English** — [Handbook](README.md) · Part F "Development"

> **At a glance**
> - This chapter succeeds `docs/PLAN.md`: twelve stages (0–11), the numbered decisions 1–63 (as of 15 Sep 2026), the addenda from the device and the open items. Assigned numbers stay stable – a superseded decision stays in place and names its successor.
> - How to add: a new decision gets the next free number (as of 15 Sep 2026: 64), a date, a topic, the decision with its reason and a reference (chapter, file, test). A new stage gets its own section with date, result (versions) and verification (tests with count and date, device run with date).
> - Status: project version <!-- fact:project.version -->0.2.0<!-- /fact -->, <!-- fact:tests -->146<!-- /fact --> tests (13 Sep 2026), last device run 13 Sep 2026.
> - Biggest pitfall: numbers without a date, and versions taken from the plan instead of the file. The old plan named `bw_install` 0.2.0 and `hwtest.js` 0.2.0 – what was built is <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> and <!-- fact:ver.hwtest -->0.1.2<!-- /fact -->. Measurements belong in the test protocol ([19](19-pruefprotokoll.md)), root causes in the lessons log ([18](18-lernlog-geraet.md)); here only the reference.

## Prerequisites

- none – a reference chapter. The why behind the decisions is explained in context by [16 · Concept and decisions](16-konzept-und-entscheidungen.md); the terms (`cfg1..4`, `job`, `st`, window, cycle) by [01 · Overall architecture](01-gesamtarchitektur.md) and [03 · Configuration](03-konfiguration.md).

## Diagram

[![Lifecycle: stages 0–1, 2–5, 6–7, 8–9 and 10 on the main rail; below them the device tests of 12 Sep (hoisting, recursion, editor) and 13 Sep (shift, heap, PUMP_SEC, measurement run); at the bottom the open items and stage 11 docs rewrite](../diagramme/en/17-etappen-und-entscheidungslog.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/17-etappen-und-entscheidungslog.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/17-etappen-und-entscheidungslog.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Built without the device", 2 "Learned on the device", 3 "Open and next".

## How to add an entry

The log has three kinds of entries. Each kind has a fixed place and a fixed form so that references from code, tests and other chapters (for example "Entscheidung 13" – decision 13 – in `tools/lib/kal.js` or "Entscheidung 12" in `bw_install.js`, switch configuration) stay valid for good:

1. **Decision:** a new row at the end of the decision table (section "Decisions") with the next free number, the date, the topic, the decision with its reason and the column "Chapter". Never reassign a number, never delete a row. When a decision is superseded, it stays and gets the note "superseded by N" (as with 7 → 46, 30/34 → 55).
2. **Stage:** a new section under "Stages" with date, goal in two sentences and the table Task | Result | Verification. "Result" holds the versions actually built (from line 1 of the file, not from the plan), "Verification" the mock tests with count and date and the device run with date; what has not run on the device yet is marked `[TODO am Gerät]` (open on the device).
3. **Addendum:** what a run in the mock or on the device changed about a stage, chronologically under "Addenda". The cause of a surprise is described in full in the lessons log ([18](18-lernlog-geraet.md)), the measurements in the test protocol ([19](19-pruefprotokoll.md)) – here only one sentence and the reference.

Template for the next row of the decision table:

```text
| 64 | DD.MM.YYYY | Topic in three words | What was decided – and why; alternative, if rejected. Reference: file, test, chapter | NN |
```

Every number in the log needs a source: defaults from `DEF` in `bw_install.js` or `ZR3`/`ZR4` in `bw_zeitraffer.js`, limits from `tools/build.js` and `tools/mock/shelly-mock.js`, test counts from `npm test` with a date, measurements from the test protocol with a date. Numbers that can change carry a fact marker (`fact:tests`, `fact:ver.*`, `def:*`) that `tools/check-docs.js` checks against the scripts.

## Stages

| Stage | Date | Content | Result | Verification |
| --- | --- | --- | --- | --- |
| 0 | 12 Sep 2026 | repository, concept documents, `lib_notes.md`, README skeleton, mock | `tools/mock/shelly-mock.js`, `npm test` | tests run without the device |
| 1 | 12 Sep 2026 | installer | `bw_install.js` v0.1.0 | mock; device 12 Sep (after the fixes v0.1.1) |
| 2–3 | 12 Sep 2026 | `bw_main` measure, then decide | `bw_main.js` v0.1.0 | mock |
| 4 | 12 Sep 2026 | `bw_pump` | `bw_pump.js` v0.1.0 | mock |
| 5 | 12 Sep 2026 | learning and protection | `lrn`, `err.mem` | 53 tests (12 Sep), 7-day simulation |
| 6 | 12 Sep 2026 | safety and fault cases | test protocol template | partly open on the device ([19](19-pruefprotokoll.md)) |
| 7 | 12 Sep 2026 | README; first device run | README v0.1.0; scripts v0.1.1; `put-script.js`, `console.js` | device 12 Sep: engine fixes; 58 tests (12 Sep) |
| 8 | 13 Sep 2026 | hardware test | `bw_hwtest.js`, `bw_hwpump.js` v0.1.0, `hwtest.js` v0.1.0 | 89 tests (13 Sep); device 13 Sep |
| 9 | 13 Sep 2026 | fast-forward, cycle from `cfg3`, device docs | `bw_zeitraffer.js` v0.1.0, `bw_main`/`bw_install` v0.1.2, `build.js` v0.1.1, `verify-scripts.js` | 102 tests (13 Sep); device 13 Sep |
| 10 | 13 Sep 2026 | control loop in the watering window, `cfg4`, weekly dry phase, calibration run | `bw_pump`/`bw_main`/`bw_zeitraffer` v0.2.0, `bw_install` v0.1.3, `hwtest.js` v0.1.2, `kal.js` | 144 tests (13 Sep); device 13 Sep: window 1 |
| 11 | since 13 Sep 2026 | docs rewrite: handbook DE/EN, diagrams, docs check | `docs/de`, `docs/en`, `tools/check-docs.js`, `tools/docs/` | <!-- fact:tests -->146<!-- /fact --> tests (13 Sep) |

Stages 0–5 were built in one session without the device and checked against the mock; the column "Verification" of the tables below names the check on the device that the project lead performs. All test counts are the state of `npm test` on the day named.

### Stage 0 – Repository and skeleton

| Task | Result | Verification |
| --- | --- | --- |
| create repo, public, MIT | folder structure as in the onboarding prompt | `git log` shows the first commit (12 Sep 2026) |
| concept documents into `docs/` | five files (today merged into [16](16-konzept-und-entscheidungen.md)) | Claude Code summarises them |
| `scripts/lib_notes.md` | every RPC in use with docs link: `Schedule.List/Create/Delete`, `Script.List/Start/Stop/SetConfig`, `KVS.Get/Set/GetMany`, `Voltmeter.GetStatus`, `Temperature.GetStatus`, `Input.GetStatus`, `Switch.Set`, `Sys.GetStatus` (today [20](20-rpc-referenz.md)) | every call checked against the docs |
| README skeleton | all headings, still empty | structure accepted |
| test helpers (decision 4) | `tools/mock/shelly-mock.js`, `npm test` | tests run without the device |

### Stage 1 – Installer (`bw_install.js`)

| Task | Result | Verification |
| --- | --- | --- |
| find script IDs by name | `findScriptId(name)` – the device assigns the IDs | console shows the IDs |
| delete old own schedule entries | repeatable | start twice → no duplicates |
| create three schedule entries | v0.1.0: `0 */15 * * * *`, `0 0 8,20 * * *`, `0 5 8,20 * * *`; since v0.1.2 pump at second 30 (`30 0 8,20`), since v0.1.3 (project 0.2.0) safety-off `0 8 8,20` (decisions 37, 54) | `Schedule.List` in the web UI |
| `cfg1/cfg2/cfg3` only if missing | defaults from the catalogue (today `DEF`, [03](03-konfiguration.md)) | KVS view shows the entries |
| initialise `st`, `day`, `err`, `lrn`, `job` | empty initial states | KVS view |
| switch configuration (decision 12) | `initial_state off`, `auto_off` = `tMax` + 10 s | switch settings in the web UI |
| self-termination | `Script.Stop` on its own ID | script is stopped after the run |

### Stage 2 – `bw_main` measure only (level 1)

| Task | Result | Verification |
| --- | --- | --- |
| read `cfg1–3`, check mandatory fields | one missing → `err cfg`, end | delete a field → `err` appears |
| measure moisture, convert, filter | `stepSample()`/`evalSamples()` (mean without outliers, `midMean`) | plausible percentages for four cycles |
| read temperature, water level | in `stepSample()` (water level `nLvl` samples, probe once in `evalSamples()`) | console shows values |
| plausibility | `err sensor` when the voltage is outside `vErrLo..vErrHi` | unplug the sensor → `err` |
| day change by date | `day` reset | change the date in the KVS → reset |
| self-termination, runtime < 5 s | – | console shows the duration |

### Stage 3 – `bw_main` decides (level 2)

| Task | Result | Verification |
| --- | --- | --- |
| release chain | demand logic with reason in `job.why` | provoke every condition one by one |
| dose with `tDead`, `tMin`, `tMax`, `pctSoll` | dose in `stepEval()` (v0.1.0: below `tMin` no job, `why=tmin`; since 0.2.0 clamp, decision 38) | hand values in the KVS → expected seconds |
| three-level pause rule | pause in `stepEval()` (`pause`, `pauseHot`, `pauseSlow`) | vary daily maximum and `dropSlow` |
| dry phase | `st.dryOk` (since 0.2.0 weekly dry phase, decision 58) | simulate the course |
| write `job` only on change (decision 11) | – | `Sys.GetStatus` → compare `kvs_rev` before/after |

### Stage 4 – Pump (`bw_pump.js`)

| Task | Result | Verification |
| --- | --- | --- |
| read `job`, check age and daily limit | abort reasons in `err` | set an old job → no watering |
| water level before and during the portion | abort on EMPTY | pull the sensor during the run |
| `Switch.Set` with `toggle_after` | pump runs exactly `sec` seconds | stopwatch, relay audible |
| result into `st`, `day`; consume `job` | – | KVS after the run |
| first portion with `tStd` | 70 s | manual job without learned value |

### Stage 5 – Learning and protection

| Task | Result | Verification |
| --- | --- | --- |
| rating 30 min after the portion | `rateGift()` in `bw_main` v0.1.x (since 0.2.0 `bw_pump` learns in the window, `bw_main` only checks with `control()`, decision 38) | `lrn.eff` plausible after a real portion (today `lrn.effW`) |
| no effect → `err`, no learned value | `noeff` (since 0.2.0 only from `bw_pump`, decision 46) | pull the hose → `err`, no second job |
| drying rate, waterlogging suspicion | `lrn.rate` | several days of history |
| log memory use | `err.mem` | value stable over days |

### Stage 6 – Play through safety and fault cases

Safety-off also works with a crashed `bw_pump` · output off after a reboot · daily limit · invalid time after a power cut without internet (system pauses, no misbehaviour) · every `err` code triggered once and explained. Template: the test protocol ([19](19-pruefprotokoll.md)); rows 1, 5–7, 9–13, 15, 16 and 18–20 are still open on the device (12, 13 and 18 are covered by the mock).

### Stage 7 – Finish the README, first device run

Parts list with sources, wiring with picture, calibration guide, installation steps in the web UI, configuration table from the catalogue, operating guide, fault table, safety notes, functional description, limits. Acceptance: an uninvolved person rebuilds the system from the docs – without asking.

On the evening of 12 Sep 2026 the scripts ran on the device for the first time (firmware 2.0.0). Three engine surprises (no hoisting, stack depth, the editor loses the end of the file) led to decisions 13–20, the scripts v0.1.1 and the tools `put-script.js` and `console.js`; afterwards 58 tests (12 Sep 2026). Details: "Addenda" below and [18 · Lessons from the device](18-lernlog-geraet.md).

### Stage 8 – Hardware test (`bw_hwtest.js`, `bw_hwpump.js`, `tools/hwtest.js`)

Two test scripts check the hardware phase by phase with the human at the setup (interview via Claude Code): probe ≤ 20 °C and ≥ 30 °C, sensor dry and in water (calibration points automatically into `cfg1`), float switch EMPTY and FULL (`lvlEmpty`), pump via the real `bw_pump` path (job in the KVS, `Script.Start`, backup and restore of the states). Simulated in the mock first (`tools/mock/hwdemo.js`, `--hwdemo`), then run on the device through the tunnel. Today's procedure: [11 · Hardware check](11-hardware-check.md).

| Task | Result | Verification |
| --- | --- | --- |
| sensor phases with command channel `hwc`, state `hwr`, thresholds `hwt` | `bw_hwtest.js` v0.1.0 | 12 tests; device 13 Sep 2026: all phases ok, `vDry` 0.296 V, `vWet` 3.134 V, `lvlEmpty` 1 |
| pump test via `bw_pump` with backup/restore | `bw_hwpump.js` v0.1.0 (two passes, decision 28) | 15 tests; device 13 Sep 2026: pumped 30 s, KVS restored byte-identically |
| mock: second script via `Script.Start`, input configuration, run generation | `shelly-mock.js` v0.1.2 | existing 58 tests unchanged and green |
| control from the VPS | `tools/hwtest.js` v0.1.0 | device run driven entirely through the tool; 89 tests (13 Sep 2026) |

### Stage 9 – Practical test in fast-forward (`bw_zeitraffer.js`, cycle and windows from `cfg3`, device docs)

The first practical test was meant to complete in 30 minutes: the same operating scripts, only with short times. Cycle and watering windows moved from the code into `cfg3` (`tick`, `winEvery`), a new script backs up the operating values and writes the profile, `bw_install` builds the schedule and later restores the original. In addition, a short docs block (`//!` lines) stays in every script on the device, and `tools/verify-scripts.js` checks the code on the device byte by byte.

| Task | Result | Verification |
| --- | --- | --- |
| cycle/windows configurable (`cfg3.tick`, `cfg3.winEvery`), installer adds missing fields | `bw_main.js` v0.1.2, `bw_install.js` v0.1.2 | 3 tests main, 2 tests install; existing tests unchanged and green |
| fast-forward profile, backup `zrb1..3`, marker `zr`, return via `bw_install` | `bw_zeitraffer.js` v0.1.0 (profile back then cycle 1 min / window every 2 min / portion 5 s, decision 30) | 6 tests incl. the 30-minute schedule in the mock (`zeitraffer.test.js`) |
| device docs in `dist/`, size limit 16 000 B, byte-identical upload check | `tools/build.js` v0.1.1, `size.test.js`, `tools/verify-scripts.js`, `put-script.js` v0.1.1 | 6 size tests; device: `verify-scripts` all OK |
| mock: second-accurate schedule, running scripts are not restarted | `shelly-mock.js` v0.1.3 | 7-day simulation unchanged |
| control from the VPS: `zeitraffer`, `normal`, safe moment, status line with memory | `tools/hwtest.js` v0.1.1 | device run 13 Sep 2026, two rounds ([19](19-pruefprotokoll.md)); 102 tests (13 Sep 2026) |

### Stage 10 – Control loop in the watering window (`bw_pump` v0.2.0, `bw_main` v0.2.0, `cfg4`, weekly dry phase, calibration run)

Up to 0.1.x `bw_pump` watered exactly one dose per window, `bw_main` rated it 30 min later, and a portion that was too small or too large was corrected the next day at the earliest. Observation at the setup (13 Sep 2026, SMT50 centred under two Gardena drippers): very dry soil often jumped only to 20 % after a portion, above 60 % was too much; 5 s of pumping raised the moisture from 0 to 36 and 54 % respectively.

Since 0.2.0 the control loop closes inside the window: fresh measurement → portion → soak → measure until stable → below the target band another portion, inside the band done, above it remember "too much" for tomorrow. `bw_pump` is the controller of the window and learns `lrn.effW`/`sf`; `bw_main` keeps cycle, job, pause, daily limit and the 30-min check. Both remain one-shot runners in the schedule and never run at the same time. Added to that: a measurement run at the setup before implementation (step 0), a weekly dry phase and a calibration run as a tool without device code.

Design, formulas and edge cases: decisions 38–63 and the addenda of 13 Sep 2026; derivation in [16](16-konzept-und-entscheidungen.md), the sequence inside the window in [02](02-flussdiagramm.md). Order of implementation: measurement run → docs → mock → installer/fast-forward → `bw_pump` → `bw_main` → scenario → tools → docs → device.

| Task | Result | Verification |
| --- | --- | --- |
| measurement-run tool (step 0): `n` pulses ≤ 10 s with 90 s spacing, voltmeter every 2 s via RPC; per pulse `pct` before, `tRise`, peak, resting value, time to stable, gain %/s; proposals for `effMax`, `tPmin`, `tMin`, `tDead/tDead2`, `tSoak`, `tStab`; raw data `docs/kal/<datum>-mess.json` | `tools/hwtest.js mess [sek] [n]`, maths in `tools/lib/kal.js` | mock: `kal.test.js`; device 13 Sep 2026: six pulses, side findings voltage dip/voltmeter rate/run-off water ([19](19-pruefprotokoll.md)) |
| mock: pot model `potModel()` (ramp 15 s, dead time `tDead`/`tDead2`, drain share with τ, drying, noise; profiles `effLocal` 0.25 and 10), `simulate(maxMs)`, overlap guard (`Script.Start` into a running run → `dev.errors`), `noBurst()` ≤ 15 lines per timestamp | `tools/test/helpers.js`, `shelly-mock.js` v0.1.4 | existing 102 tests unchanged and green; the 7-day scenario keeps the linear instant model for the write counts |
| installer + fast-forward: `cfg4` in `DEF/ORDER`, `cfg2.pctOk/dropW/sfUp/effMax`, `cfg3.dryDay`, `lrn.effW/sf 0.7`; checks `tick`/`winEvery` divisor of 60 and `(min mod tick)·60 + PUMP_SEC + tWin + tTail ≤ tick·60`; `SAFE_MIN = ceil((PUMP_SEC + tWin + 10)/60)` → `0 8 8,20`; fast-forward minute list `40 2,8,…,56`; backup `zrb1..5`; abort while `bw_main`/`bw_pump` is running | `bw_install.js` v0.1.3, `bw_zeitraffer.js` v0.2.0 (the plan named 0.2.0 for both) | mock: `install.test.js` (`cfg4`, `zrb4/5`, `0 8 8,20`, `auto_off` 190, `tick 5`/`winA 07:25`/too large `tWin` → `failErr`, minute list, abort), `zeitraffer.test.js` (profile 3/6, return deletes `zrb1..5`); device 13 Sep 2026: minute list accepted |
| `bw_pump` control loop: `KVS.Get` chain instead of `GetMany "*"`, fresh measurement m0, deadline `B`, claim `st.why=laeuft` (running), tick automaton `m0 → lv → cl → on → pu → so → st → de`, correction portions from the gain, stability range + trend, verdicts `ok/over/max/zeit/stall/unstab/noeff/wasser` (`zeit` = time, `wasser` = water), learning `effW`/`sf` at window end, single-portion path | `bw_pump.js` v0.2.0 (<!-- fact:dist.bw_pump -->17 475<!-- /fact --> B compact; one timer, one open RPC, depth ≤ 6) | mock: `pump.test.js` rewritten after the result matrix (one test per row; regression single portion, `elapsedMs ≤ (tWin + tTail)·1000`, `maxTimersUsed 1`, `maxPendingRpc 1`), `hwpump.test.js` unchanged; device 13 Sep 2026: window 1 (15:54:30) with `P1`/`P2`, `tRise` 8/5 s, `st.n` 2, `pctW` 50.5, `effW` 2.006, `mem_peak` 12 516 B |
| `bw_main`: `control()` instead of `rateGift` (only `zuviel` – too much – → `sf`, hint `sink` – sinking –, catch-up pause `pauseHot` after `max/zeit`), band order `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` → `why=cfg`, dose with `effW` and `sf`, clamp instead of `tmin`, `dur` in pause/`soak`, weekly dry phase (`dryDay`, `pctDry` 28, wetness > `pctHi`) | `bw_main.js` v0.2.0 (<!-- fact:dist.bw_main -->15 791<!-- /fact --> B compact; learning, `noeff`, object branch removed) | mock: `learn.test.js` (check: `zuviel` without double deduction, `sink`, old `st`), `main.test.js` (band check, `pctOk` null → `cfg`, Friday rollover → `trocken` – dry – until < 28, cycle reading 63 % → dry phase, Saturday without effect, `dryDay` null); device: `[TODO am Gerät]` first real 20:00 window with `console.js <ip> 900` |
| 7-day scenario (linear + ramp, with Friday): no run across a cycle, Σ `toggle_after` per window ≤ `tMax`, exactly one dry phase, write budget measured | `szenario.test.js` | mock: 15–22 writes per watering day, budget ≤ 24 (addendum below) |
| tools: `hwtest.js kal` (recorder every 5 s, `report`, `write` only after `normal`), `expectedSpecs()/safeMoment()` for cycle 3/window 6, status line `st.n/sec/pctW/why/mem_peak`, `pctOk` in the preflight, `zrb1..5`, `put-script.js` with `fs_free` check, `verify-scripts.js` version equality `bw_main`/`bw_pump` | `tools/hwtest.js` v0.1.2 (the plan named 0.2.0), `tools/lib/kal.js` v0.1.1, `put-script.js` v0.1.2, `verify-scripts.js` v0.1.1 | mock: `kal.test.js` (`write` lock with `zrb1`, blend α 0.5); device 13 Sep 2026: `kal 780` → `report` → `write` (`effW` null → 4.46, `tDead2` 8 → 5, `tDead` 20 → 8, `tMin` 25 → 10); states medium moist/wet open |
| docs: README (control loop, dry day, `cfg4` table, `job.why`, `st` fields, watering by hand, update with hand values, faults `noeff`/`sink`, safety 8 min/190 s/`maxDay × tMax`, fast-forward 3/6, limits), CLAUDE.md, AGENTS.md, handbook, `lib_notes.md`, test protocol, quick guide | all files updated (13 Sep 2026); since stage 11 in this handbook | acceptance: an uninvolved person understands window, portion and dry day from the docs; `[TODO am Gerät]` spots stay open until the device run |
| device run (never in the 25 min around 08:00/20:00/midnight): delete test scripts with `fs_free` before/after, upload `bw_pump`, `bw_main`, `bw_install`, `bw_zeitraffer`, `verify-scripts`, hand values `cfg2 {pctOk 50, pctHi 60, pctDry 28, effMax 30}` and `cfg3 {tMax 180, tMin 25}`, `hwtest.js normal` → `verifyState`, fast-forward schedule, `normal`, `kal`, first real window | test protocol stage 10 ([19](19-pruefprotokoll.md)), surprises in [18](18-lernlog-geraet.md) and as rules in the tests | device 13 Sep 2026: done – `mem_peak` of `bw_pump` 12 516 + 5 348 B (parse of `bw_main`) < 25 000; restore from `zrb1..5` checked (`verifyState`); `effW` in `lrn` after window 1; open: windows 2–4, states medium moist/wet, first real 20:00 window; 144 tests (13 Sep 2026) |

### Stage 11 – Docs rewrite (since 13 Sep 2026)

The old documentation (README with 494 lines, quick guide, seven-part handbook, `docs/PLAN.md`, `LEARNING.md`, test protocol, `lib_notes.md` and six concept files) is being rebuilt into a bilingual handbook with 21 chapters in six parts (A–F); every chapter has an Archify diagram in both languages. The skeleton was created on 13 Sep 2026; the chapter overview in the [Handbook](README.md) shows the progress ("in progress").

| Task | Result | Verification |
| --- | --- | --- |
| chapter template (`docs/_vorlage-kapitel.md`, `docs/_template-chapter.md`), chapter list `tools/docs/kapitel.json`, parts A–F | 21 placeholders DE/EN, then chapter by chapter | `tools/check-docs.js`: template, links, images, DE/EN parity, readability |
| every number from code or a dated protocol; fact markers (`fact:*`, `def:*`, `zr:*`, `hwt:*`, `hwp:*`) against `DEF`, `ZR3/ZR4`, `build.js`, `shelly-mock.js` | the findings list of the old docs (factual errors, contradictions, gaps) is closed chapter by chapter | `check-docs.js` reports deviating markers as errors; outdated phrases from `tools/docs/verboten.json` |
| diagram pipeline: `tools/docs/build-diagramme.mjs` (validate → deliver → SVG → receipt), German source plus EN dictionary | `docs/diagramme/src`, `de`, `en`, `receipts` | receipt with 0 errors/0 warnings per version |
| tests `docs.test.js` (docs check) and `dist.test.js` (`dist/` up to date) | `npm test` | <!-- fact:tests -->146<!-- /fact --> tests (13 Sep 2026) |
| old files | stay until all chapters are done; then short pointers (rule "stub" in `check-docs.js`: ≤ 8 lines, link to `docs/de` or `docs/en`) | `check-docs.js` |

## Decisions

As of 15 Sep 2026 the table runs up to number 63. The column "Chapter" names the chapter in which the decision applies today. Decisions 1–12 come from the interview of 12 Sep 2026, 13–20 from the first device test the same evening, 21–28 from stage 8, 29–37 from stage 9 and 38–63 from stage 10 with the interview of 13 Sep 2026. Where a decision names an interview number, the mapping in the table "Interview numbers" below applies.

| # | Date | Topic | Decision and reason | Chapter |
| --- | --- | --- | --- | --- |
| 1 | 12 Sep | concept documents | live in `docs/`; since stage 11 merged into chapter 16 | 16 |
| 2 | 12 Sep | licence | MIT, Copyright (c) 2026 Robert-AI-Development | – |
| 3 | 12 Sep | scope of the first session | stages 0–5 complete, stage 6 as test protocol template, stage 7 README with placeholders | 19 |
| 4 | 12 Sep | test helpers | yes, from stage 0 in `tools/`: mock and `npm test` (Node ≥ 20, no dependencies) | 14 |
| 5 | 12 Sep | component IDs | in `cfg1`: `idV` 100 (voltmeter), `idT` 100 (temperature), `idLvl` 1 (input), `idSw` 0 (switch) | 03, 05 |
| 6 | 12 Sep | temperature probe failure | keep watering; `err.code = "temp"` does not block, the heat rule is then inactive | 02, 13 |
| 7 | 12 Sep | "no effect" | `eff_neu < effMin` → `err noeff`, no learned value. Superseded by 46 (probe portion in `bw_pump`) | 04 |
| 8 | 12 Sep | err reset | `noeff` only by hand (delete the KVS entry `err`); all other codes clear themselves once the cause is gone | 13 |
| 9 | 12 Sep | analog input | `voltmeter:100`, `Voltmeter.GetStatus` returns volts | 05, 20 |
| 10 | 12 Sep | pctHi rule | safety factor `lrn.sf` (start 1.0 back then, since 43: 0.7); new `cfg2` fields `sfMin` 0.5, `sfStep` 0.1; the dose is multiplied by `sf` | 02, 03 |
| 11 | 12 Sep | writing `job` | on a change of `ok/sec/why/pct` (implemented: `ok`/`why`; `sec`/`pct` come with the refresh before the window) or when the next watering window falls into the next cycle; `bw_main` reads `winA/winB` from `cfg3`, the installer builds the schedule from the same fields | 02, 03 |
| 12 | 12 Sep | switch configuration | the installer sets `Switch.SetConfig {initial_state:"off", auto_off:true, auto_off_delay: tMax + 10}` | 04 |
| 13 | 12 Sep | step list `steps[]` at the end of the file | mJS does not hoist function declarations: `var steps = [stepRead, …]` at the top of the file aborted on the device with `ReferenceError` (first device test). The list sits in every script directly before the final `next()`; `syntax.test.js` checks "use before declaration at module level", because the mock (V8) hoists and does not show the error | 14, 18 |
| 14 | 12 Sep | flat step chain | mJS aborts at about 10 nested calls (`bw_pump`: "Too much recursion"). `next()` is a loop: steps that finish synchronously return `true`, asynchronous ones call `next()` from the callback, queue drivers return `true` on an empty queue. The mock measures the call depth, limit <!-- fact:call_depth -->10<!-- /fact --> (device: 12 ok, 14 crash; scripts before 9–11, v0.1.1: 5, `bw_pump` 0.2.0: 6) | 14, 18 |
| 15 | 12 Sep | KVS values as JSON strings | The device stores objects correctly (probe 12 Sep 2026), but the web UI shows them as `[object Object]` and cannot edit them – and `cfg2` is maintained by hand. Hence `JSON.stringify` when writing, `fromKvs()` when reading; the mock keeps raw values like the device and reports non-string values. Same pattern as in the project lead's reference script (Spotelly) | 03, 18 |
| 16 | 12 Sep | installer replaces unreadable entries | A KVS entry that does not yield a JSON object (`[object Object]` from v0.1.0, a typo while editing) is replaced by the defaults and reported in the console; valid entries are still never overwritten | 03, 06 |
| 17 | 12 Sep | upload from `dist/` | Script storage on the device is limited, `bw_main.js` with comments did not fit. `npm run build` writes the compact output (comments, indentation, blank lines removed, version line kept), `size.test.js` checks limit and `node --check`; `scripts/` remains the source. Limit back then 15 000 B (firmware 2.0.0 also stores 19 KB), since 35: <!-- fact:size_limit -->16 000<!-- /fact --> B | 14 |
| 18 | 12 Sep | debug switch | `var DEBUG = 0;` in every script; `dbg()` logs only at 1. `rpc()` wraps `Shelly.call` and logs method + parameters, `next()` every step, `onKvsPage` every entry with type, plus measurements. Costs one stack level (depth 5 instead of 4) and ~0.6 KB | 14 |
| 19 | 12 Sep | upload via RPC with size check | The editor of the web UI lost the end of the file when pasting (166 and 210 bytes). `tools/put-script.js` uploads in chunks via `Script.PutCode` and compares `Script.GetCode` with the file; even after pasting in the editor this check is mandatory | 07, 14, 18 |
| 20 | 12 Sep | `Schedule.Create` retry | The first `Schedule.Create` of each installer run fails on the device with a misleading "timespec validation" error (the same call via curl is valid). `onCreate` retries up to 3× after 400 ms, the second attempt succeeds; the mock reproduces the quirk (`schedCreateFailFirst`), two tests guard the retry. Cause not resolved – 13 Sep: also without KVS objects in the heap | 18, 20 |
| 21 | 13 Sep | own test scripts (stage 8) | Hardware test as two separate scripts `bw_hwtest`/`bw_hwpump` (long runners 10–30 min, started by hand only, never in the schedule) instead of extending `bw_main`/`bw_pump`. One script would have been 23.7 KB compact – above the limit; split into sensor and pump part. The plan also foresaw disabling autostart for the test scripts; nobody sets that | 11 |
| 22 | 13 Sep | command channel `hwc` | Human/tool write `{n, cmd: go\|skip\|abort}` into the KVS; the script polls every `nCmd` ticks via `KVS.Get`, processes only `n` greater than last seen (old commands never act) and discards `go` in phases that are not waiting. `Script.Eval`/web UI rejected: the KVS is visible everywhere and reproduced in the mock | 11 |
| 23 | 13 Sep | pump only via `bw_pump` | The test never switches the pump on itself; it sets `err={code:null}`, `day` (at the daily limit) and `job={ok:true,sec:pumpSec,pct:null,why:"hwtest"}` and starts `bw_pump`. `pct:null` prevents rating and learned value. Only `Switch.Set on:false` as safety-off | 11 |
| 24 | 13 Sep | time guard instead of schedule change | Pump start only in the gap of the 15-min cycle (`guardS` 90 s after the cycle up to 900 − `guardS` − `pumpSec`) and not within ± `winMin` 25 min of `winA`, `winB` and midnight. The watering schedule is never touched | 11 |
| 25 | 13 Sep | backup/restore in the KVS | `st/day` → `hwb1`, `job/err/lrn` → `hwb2` (two keys, together > 253 characters) before the job; restore afterwards, `job.ok` always false, backup deleted. If `hwb1/hwb2` exist at start (crash, stop from outside), the run is automatically pass B (`rec:1`); `hwtest.js restore` as emergency path | 11 |
| 26 | 13 Sep | calibration values automatically | `bw_hwtest` writes `vDry/vWet/lvlEmpty` into `cfg1` (read-modify-write) when plausible: dry point only after `go`, ≤ `vDryMax`, ≥ `vErrLo` + 0.05; wet point ≥ `vWetMin`, ≤ `vErrHi` − 0.10; `vWet − vDry ≥ 1 V`; float switch EMPTY ≠ FULL and at least one observed change. Otherwise only a message; switch `hwt.cal` | 11 |
| 27 | 13 Sep | mock executes `Script.Start` | Registered files (`dev.files`) run as a second script in the same event stream; timers, errors and RPC callbacks per script and per run generation; input configuration with `state:null` for a disabled input; `dev.onRpc` hook for the virtual operator | 14 |
| 28 | 13 Sep | two passes because of the shared heap | The script heap (~25 KB) is shared by all scripts; `bw_pump` needed over 15.8 KB peak with the test entries and died next to the test script with `out_of_memory`. Pass A starts `bw_pump` and terminates, B rates and restores; `hwtest.js watch` starts B automatically. Both test scripts release `K/orig` in waiting phases (9.0/9.6 KB instead of 13.5 KB) so that `bw_main` keeps running | 11, 18 |
| 29 | 13 Sep | cycle and windows from `cfg3` | `tick` (min, divisor of 60) replaces `TICK_MIN`/`TICK` in the code; `winEvery` (null or divisor of 60) lets `bw_pump` run every N minutes instead of at `winA/winB` (`30 */N * * * *`). The safety-off sat in the seconds field of the same minute back then, hence `tMax ≤ 19` – superseded by 54. `windowSoon()` computes `N − (minute mod N) ≤ tick`. Time constants belong in the KVS | 03, 12 |
| 30 | 13 Sep | fast-forward as a pure profile | `bw_zeitraffer` changes only `cfg3` and resets the state; `bw_main`/`bw_pump` run unchanged. Profile 0.1.x: cycle 1 min, window every 2 min, portion 5 s, `pause` 0.17 h, `pauseHot` 0.035 h, `maxDay` 4, `tHot` 30, learning off via `tDead = tStd`. Pauses as exact decimals with reserve for the two-cycle tolerance (0.035 h = 126 s ≤ 150 s at T+1; 0.17 h = 612 s → T+9). Superseded by 55 | 12 |
| 31 | 13 Sep | backup and return via the installer | Backup in `zrb1..3` (since 53 `zrb1..5`), `job` is set fresh. Marker `zr` as its own key, written last by `bw_zeitraffer`: `bw_install` with marker builds the fast-forward schedule and deletes the marker; without marker it writes the original back and deletes the backup (write first, then delete). Every abort in between ends with the next installer run restoring | 12 |
| 32 | 13 Sep | installer adds missing fields | Existing entries get missing fields from `DEF` (`=== undefined`, so that `winEvery: null` stays stable); values are still never overwritten. After a script update an installer run is therefore required, otherwise `err cfg` ("cfg3.tick fehlt" – missing) | 03, 13 |
| 33 | 13 Sep | safe start moment | `hwtest.js zeitraffer/normal` start only in second 8–30 (`bw_main` of the cycle is done) and when no operating/test script runs. Rule 0.1.3: in fast-forward only in odd-numbered minutes, in normal operation > 3 min after a window; since 54: not in minutes 0–2 of the 6-min cycle, in normal operation up to `SAFE_MIN` + 1 min after the window. `bw_zeitraffer` aborts if one runs or `hwb1/hwb2` exist | 12 |
| 34 | 13 Sep | schedule order | Moist test before the first portion (afterwards `sperre` – lock – first requires `pct < pctDry` → `trocken`), normal pause before the heat (the daily maximum stays in `lrn.tMaxD` until midnight), stimuli in the cycle before the window (mock and device alike: the job is created in the cycle, the portion in the window). Schedule 0.1.3: portions in minute 4, 14, 16, 20, then `limit`. Superseded by 55 | 12 |
| 35 | 13 Sep | device docs and size limit | `//!` comment lines survive the build as `// …` (short: what each setting does), all others are dropped; `size.test.js` requires exactly these lines. Limit 15 000 → 16 000 bytes (firmware 2.0.0 stores 19 KB; the limit protects the shared heap). Check 2: `verify-scripts.js` compares the code on the device byte-identically with `dist/`, `put-script.js` after every upload | 14 |
| 36 | 13 Sep | mock second-accurate | `simulate()` evaluates the seconds field of the timespec (pump at second 30 and safety-off fire in the mock) and skips `Script.Start` on a running script like the device (`was_running`) | 14 |
| 37 | 13 Sep | `bw_pump` starts 30 s after the full minute | Device run 13 Sep 2026: with `bw_main` v0.1.2 (15.3 KB, peak 16.4 KB heap with 14 KVS entries) `bw_pump` died when started together at the full minute with `out_of_memory` (1.7 KB left). The installer sets the seconds field of the pump schedule to `PUMP_SEC` 30 (`30 0 8,20`; fast-forward `30 */2` then, `30 */6` today); `bw_main` (5–8 s) is done by then. The job is still created one cycle earlier | 04, 18 |
| 38 | 13 Sep | division of labour `bw_main`/`bw_pump` (stage 10) | `bw_main`: cycle, job (`job.sec = clamp(round(raw), tMin, tMax)`, no `tmin`), pause, daily limit, check `soak` min after the window – `control()` instead of `rateGift`: `pct > pctHi + hyst` → `sf` down + `zuviel`, `pctW − pct > dropW` → `sink`, after `max/zeit` with `pctA < pctLo` → `pauseHot`. `bw_pump`: measures in the window, up to `nPort` portions, learns `effW`/`sf`, keeps the deadline. No `eff` learning, no `noeff` in `bw_main` (interview 2/4) | 02 |
| 39 | 13 Sep | reference: stabilised window reading | `pctSoll/pctOk/pctHi` and `effW` refer to the stabilised reading in the window (the sensor centred under two drippers measures the wettest spot, fast); `pctLo/pctDry` to the cycle reading; the 30-min value (drainage) is only a check and never enters `effW`. The 50–60 % scale is relative to the `cfg1` calibration, not a volumetric water content | 02, 03 |
| 40 | 13 Sep | gain scale `effMax` 30, `tMin`/`tPmin` | `effMax` 30 %/s is only a sanity limit (device 7–20 %/s: 5 s raised the moisture on 13 Sep from 0 to 36 and 54 %). Correction portions use the window gain `gK = max(dpct/effSec, effMin)`, target `tgt = min(pctSoll, pctNow + (pctHi − pctNow)/2)`, `raw = (tgt − pctNow)/gK + tDead2`, never with `sf`. Planned values `tMin` 25, `tPmin` 5; the measurement run set `tPmin` to 10 (`DEF`), `kal write` writes `tMin = max(tPmin, tDead + 2)` on the device (13 Sep 2026: 25 → 10); `DEF.tMin` stays 25 | 02, 03 |
| 41 | 13 Sep | `tMax` = sum per window, `auto_off` stays `tMax + 10` | `cfg3.tMax` 180 limits the sum of all portions of a window, `cfg4.tPmax` 120 the single portion (`toggle_after` upper bound), daily reserve `maxDay × tMax − day.sec`. `auto_off_delay = tMax + 10` = 190 s (fast-forward 50 s) follows interview 5; `auto_off` acts per switch-on command and covers a single portion further than needed – `tPmax + 10` would be a one-liner and stays documented | 04 |
| 42 | 13 Sep | claim only in `st`, guard in `stepCheck` | Claim before the first `Switch.Set`: `st = {state:"sperre", ts:now, why:"laeuft", rated:true, dryOk:true, …}`; if it fails → `why=kvs`, no pumping. If the script dies (OOM, exception, `Script.Stop`, power), `toggle_after`/`auto_off`/safety-off switch off, `bw_main` reports `why=pause`, `job.ok=false`; no learned value, no `noeff`. Guard: `st.why === "laeuft"` younger than `jobAge` → no job (manual start). Never write `gegossen` (watered) + `rated:true` (would stay in `soak` forever) | 04 |
| 43 | 13 Sep | one learned value `lrn.effW`, `sf` starts at 0.7, `sfUp` closes the ratchet | `effW` (%/effective s, window scale) replaces `eff`: `effNew = clamp(dpct/effSec, effMin, effMax)`, `effW = (1 − alpha)·effW + alpha·effNew` (null → adopt), only with `effSec > 0`. First portion deliberately below target: `job.sec = (pctSoll − pct)/effW·sf + tDead`, `sf` 0.7 (research: ≈ 0.7 of the deficit); `over` after one portion → `sf − sfStep` (min `sfMin`), `ok` after ≥ 2 → `sf + sfUp` (max 1). No learning on `noeff/sensor/switch/laeuft`; `abbruch/extern` (abort/external) only from completed portions (interview 14) | 02 |
| 44 | 13 Sep | deadline `B` kept three times | `bw_pump`: `q = now mod (tick·60)`, `B = min(tWin, tick·60 − q − tTail)` (normal 420 s, fast-forward 120 s); if the first portion does not fit → `zeit` (time) without claim; another portion only if `el + secK + tSoak + nStab·tStep ≤ B`. Installer statically: `(min mod tick)·60 + PUMP_SEC + tWin + tTail ≤ tick·60` (normal 470 ≤ 900, fast-forward 170 ≤ 180; `tick 5`, `winA 07:25` fail); mock: overlap guard. Time from `Shelly.getUptimeMs()`, never from tick counters | 04 |
| 45 | 13 Sep | stability: range + trend, timeout value ring mean, `unstab` | After `tSoak` one ring value per `tStep` (median of the samples); stable ⇔ range of the last `nStab` values ≤ `dStab` and newest minus oldest ≤ `dStab/2` (a ramp does not count), at most `tStab` (planned 30/90 s, after the measurement run 20/60 s). On timeout or deadline the ring mean applies: still rising → `unstab` (window ends, learned value yes), falling → use the value (also for `over`/`ok`); plausibility in every measurement. Research: range and no rise, rated is the value after the maximum | 02 |
| 46 | 13 Sep | `noeff` only in `bw_pump`, after a full probe portion; `dEffMin`, `stall` | Ineffective means `Δ_i < dStab`. After an ineffective first portion exactly one full probe portion (`clamp(sec1, tPmin, min(tPmax, tMax − win.sec))`); if `dpct < dEffMin` persists → `noeff` (blocks, delete by hand only, `st sperre/rated:true`, no learned value). If effect was already proven and a later portion is ineffective → `stall` (no `err`, learned value from the portions). "No effect must never lead to more water" – the probe portion is the only capped exception (interview 6; supersedes 7) | 04 |
| 47 | 13 Sep | band order checked only by `bw_main` | `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` and `pctLo + hyst < pctOk`, otherwise `why=cfg`. `bw_pump` checks only completeness: if one of `pctSoll pctOk pctHi effMin effMax alpha sfMin sfStep` is missing → single portion, `cfg4` missing → `err cfg`. Band: `pctLo` 40 trigger, `pctOk` 50 target, `pctSoll` 55 dose target point, `pctHi` 60 too much/wetness, `pctDry` 28 dry-phase end (interview 1) | 02, 03 |
| 48 | 13 Sep | water-safe migration: `pctOk` null in `OPEN2` | `cfg2.pctOk` starts null in `OPEN2` – no job until entered by hand (`why=cfg`). `bw_main` 0.2.0 tolerates an old `st` (without `dur/pctW`) and `lrn` without `effW` (→ `tStd`); `bw_pump` 0.2.0 without `job.pct` waters a single portion; missing `cfg4` → `err cfg`. Every upload order is water-safe; `verify-scripts.js` checks version equality. Hand values: addendum "Device (15:48–15:50)" | 13 |
| 49 | 13 Sep | preflight m0 ≥ `pctOk` → `feucht` | `bw_pump` measures before portion 1 (`nSample` ticks → median → `pctB`), because `job.pct` is up to 20 min old. `pctB ≥ pctOk` (watered or fertilised by hand) → no portion, `job.why="feucht"` (moist), no claim, no learned value, no pause, `day` unchanged; implausible → `sensor` (interview 9) | 02 |
| 50 | 13 Sep | single-portion path | `!isNum(job.pct)` or `cfg4.nPort === 1` or incomplete band → `lv → on → pu → done` (no claim `laeuft`): `clamp(job.sec, 1, min(tPmax, tMax))` seconds, no measurement, no learned value, `st` as before (`gegossen/rated:false/pctB null`). Carries `bw_hwpump` (`pct:null`, decision 23), manual jobs and the bucket variant of the fast-forward run; `hwpump.test.js` stays green unchanged | 11, 12 |
| 51 | 13 Sep | `day.n` counts windows, `day.sec` all seconds | `day.n` + 1 per window with at least one portion, `day.sec` = Σ of all pump seconds incl. the partial portion on `abbruch/extern`; `maxDay` stays in windows, the reserve `maxDay·tMax − day.sec` limits every portion. On `feucht/sensor/wasser/zeit` before the first portion and on a crash `day` stays unchanged | 02, 13 |
| 52 | 13 Sep | `st` shape, `job.why`, protocol | `st = {state, ts, dur, n, sec, pctB, pctW, pctA, effW, why, tr, rated, dryOk}` (worst case 165 characters): `dur` seconds until pump-off of the last portion (pause from `ts`, check from `ts + dur`), `pctW` last stable window reading, `tr` tRise of the 2nd portion. `job.why` from `bw_pump` 0.2.0: `ok over max zeit stall unstab noeff wasser abbruch extern sensor switch kvs lvl feucht nass`, plus unchanged `cfg uhr alt limit err:<code>` ([02](02-flussdiagramm.md), [03](03-konfiguration.md)); `tmin` dropped, `laeuft` only in `st.why`, `kein_auftrag` (no job) only in the console line; `err`: `noeff/sensor/wasser` also from `bw_pump`, hint `sink` (in `ERR_ORDER` before `temp`). One console line per portion, never more than ~15 `print` synchronously (interview 7) | 03, 13 |
| 53 | 13 Sep | `cfg4` as its own key, `zrb1..5` | `cfg3` would exceed 253 characters with the window fields (and `zrb1` with it), hence `cfg4` "window control loop" (twelve fields, worst case 138 characters; planned `tPmin` 5, `tSoak` 30, `tStab` 90, `tDead2` 10 – after the measurement run 10/20/60/8, today in [03](03-konfiguration.md)), read only by `bw_pump`. Backup redistributed: `zrb1 {cfg3}`, `zrb2 {lrn, day}`, `zrb3 {st, err}`, `zrb4 {cfg4}`, `zrb5 {cfg2}` (each ≤ 225); 9 + 6 + 6 = 21 keys ≤ 50, `kvs-size.test.js` computes with a worst-case `st`. `bw_pump` reads exactly nine keys via a `KVS.Get` chain instead of `GetMany "*"` (no `hw*/zrb*` strings in the heap) | 03, 12 |
| 54 | 13 Sep | safety-off from `PUMP_SEC + tWin + 10` | `safeSec = PUMP_SEC + tWin + 10`; normal `SAFE_MIN = ceil(460/60)` = 8 → `0 8 8,20 * * *` (instead of minute 5); fast-forward minute list `40 2,8,14,…,56 * * * *` and check `safeSec < winEvery·60`; the old check `tMax + 10 ≤ 59` is dropped. The minute list was `[TODO am Gerät]` – accepted 13 Sep 2026, no fallback built. `hwtest.js expectedSpecs()/safeMoment()` mirror the formulas | 04, 12 |
| 55 | 13 Sep | fast-forward cycle 3 / window 6 / budget 120 with real learning | Profile `ZR3`/`ZR4` in `bw_zeitraffer.js` (values: addendum "Fast-forward profile adjusted", [12](12-erstinbetriebnahme.md)): portions never below 10 s (water transit time in the hose), 12 + 15 + 10 s fit into `tMax` 40 and the 120 s budget; `pctDry = pctLo − 1`, `dryDay` null (dry phase off). Hose at the sensor, real learning (interview 8/11); sensor into dry soil before every window. Schedule ~45 min: windows at 6:30/18:30/24:30/36:30, `wasser`, `feucht`, `limit`, `normal` at 40 (`pauseHot` 360 s → T+6:30, `pause` 720 s → T+12:30). Bucket variant `nPort` 1. Supersedes 30/34 | 12 |
| 56 | 13 Sep | calibration run and measurement run as tools, no device code | `hwtest.js mess [sek] [n]` (step 0): pulses ≤ 10 s with 90 s spacing, voltmeter every 2 s via RPC; per pulse `pct` before, `tRise`, peak, resting value, time to stable, gain %/s; proposals for `effMax`, `tPmin`, `tMin`, `tDead/tDead2`, `tSoak`, `tStab`. `hwtest.js kal`: fast-forward with schedule, recorder every 5 s into `docs/kal/<datum>-kal.json`, `kal report` per window, `kal write` only after `normal` (refused with `zrb1`; `effW` blend α 0.5, `tDead2` from `tRise`). Maths in `tools/lib/kal.js`, testable without the device (interview 10/12) | 12, 14 |
| 57 | 13 Sep | one learned value now, classes later | Only `lrn.effW` plus `sf`; classes `effD/effN` (dry/normal) only in a later stage, if the calibration run shows > 50 % difference between the states – the `kal` report provides the data basis but does not write class values. Interview 13 – which is how `tools/lib/kal.js` names it ("Entscheidung 13" means this row 57) | 12, 16 |
| 58 | 13 Sep | weekly dry phase | No longer after every portion (the claim writes `dryOk: true`), but (a) from the day change to `cfg3.dryDay` 5 (Friday; `dow = (days + 4) % 7`, null = never) and (b) on wetness: cycle reading `pct > pctHi` with no window in progress, or m0 > `pctHi` in the window (`nass` – wet –, no portion). Both: `st.state="sperre"`, `dryOk=false`, `why=trocken`, until a cycle reading shows `pct < pctDry`. The 30-min check only sets `sf`/`zuviel`; no `pauseHot` catch-up in the dry phase. Fast-forward/calibration: `dryDay` null, `pctDry = pctLo − 1`; `kal` classifies dry/medium/wet (interview 16) | 02, 13 |
| 59 | 13 Sep | flash: delete the test scripts before the upload | Remove `engine_probe`, `bw_hwtest`, `bw_hwpump` (IDs 4/5/6 back then) via `Script.Delete`: `fs_free` 12 288 B with seven scripts → 49 152 B without the three (≈ 36 KB); `put-script.js` checks `fs_free` before the upload; re-upload the hardware-test scripts when needed (interview 15) | 13, 14 |
| 60 | 13 Sep | rejected: switch-off at a lead threshold during the portion | Let the pump run and switch off as soon as the sensor reaches a lead threshold – rejected: with 10–20 s water transit time and 7–20 %/s gain the value keeps rising after switch-off, the portion is neither reproducible nor usable as a learned value; "portion → re-measure → next portion" is the control structure of the literature | 16 |
| 61 | 13 Sep | rejected: class learning right away | `effD/effN` by initial moisture from the first window – rejected: more `lrn` fields and code size without a data basis; only after the calibration run (57) | 16 |
| 62 | 13 Sep | rejected: claim in `job` | Mark the running run in `job` – rejected: `job` is refreshed by `bw_main` every cycle (`ok/sec/why/pct`) and is the hand-over, not the state; a claim there could be overwritten. `st.why="laeuft"` is a single write that only `bw_pump` sets and `bw_main` reads as `pause` | 04, 16 |
| 63 | 13 Sep | rejected: Smith predictor | Model-based dead-time compensation (MathWorks) – rejected: needs a process model and a continuous controller; a one-shot runner without state in RAM cannot track a model. Dead time is handled additively (`tDead`, `tDead2` from `tRise`), the feedback lies between the portions | 16 |

### Interview numbers

The interview of 13 Sep 2026 (four rounds before stage 10) has its own numbering. Decisions 1–12 of 12 Sep 2026, by contrast, carry the same number as in that interview.

| Interview 13 Sep | Topic | Table number |
| --- | --- | --- |
| 1 | target band `pctLo 40 / pctOk 50 / pctSoll 55 / pctHi 60 / pctDry 28` | 47 |
| 2, 4 | division of labour `bw_main`/`bw_pump` | 38 |
| 5 | `auto_off` stays `tMax + 10` | 41 |
| 6 | `noeff` after a full probe portion | 46 |
| 7 | one console line per portion | 52 |
| 8, 11 | fast-forward with the hose at the sensor, real learning | 55 |
| 9 | preflight m0 ≥ `pctOk` → `feucht` | 49 |
| 10, 12 | calibration run and measurement run as tools | 56 |
| 13 | one learned value now, classes later (`tools/lib/kal.js` says "Entscheidung 13") | 57 |
| 14 | `sf` starts at 0.7, `sfUp` | 43 |
| 15 | delete the test scripts before the upload (`tools/put-script.js` in its header comment and `tools/hwtest.js` in the section "Scripts am Gerät" say "Entscheidung 15"; table row 15, by contrast, is "KVS values as JSON strings", which is what `bw_main.js`, `bw_install.js` and `shelly-mock.js` mean) | 59 |
| 16 | weekly dry phase (`bw_main.js` in `dryStart()` and the test protocol say "Entscheidung 16") | 58 |

## Addenda

Chronological, condensed. Measurements are complete in the test protocol ([19](19-pruefprotokoll.md)), the causes of the device findings in the lessons log ([18](18-lernlog-geraet.md)). The research on pulse irrigation, the 30 confirmed edge cases with their sources and the deviations from the onboarding prompt (fields `msSample`, `sfMin/sfStep`, `tChk`, `lrn.tMaxD/tMaxY`, autostart off, `kvs_rev` as write counter, precedence of the `err` codes) have moved to [16 · Concept and decisions](16-konzept-und-entscheidungen.md).

### 12 Sep 2026 – 7-day simulation (`szenario.test.js`)

- **Pause with tolerance:** The job is created one cycle before the window (07:45), the portion starts seconds after the window. A pause of exactly 24 h would miss the next 08:00 window by seconds. Hence the pause counts as over when, at the next window, it is over except for one cycle: `(now + 2·tick·60) − st.ts ≥ pause·3600` in `bw_main` ("the first window after expiry" from the implementation plan).
- **Daily maximum in 2 °C steps:** `lrn.tMaxD` is rounded to even degrees so that a summer day does not produce ten writes; exceeding `tHot` is captured exactly regardless.
- **`job` before the window** is only refreshed when `job.ok = true`; with `ok = false` `bw_pump` does not check the age.
- **Unreadable water level:** If the water level is unstable in a cycle, a standing fault `wasser` (water) is kept (neither set nor cleared).
- **Empirical values 0.1.0:** per day 8 to 9 KVS writes without a portion, 13 to 16 with a portion (since 0.2.0: 15–22 per watering day, addendum stage 10); `bw_main` ran 2.6 s in the mock, `bw_pump` `sec` + 5–7 s. Status: 53 tests green (installer, measuring, release chain, dose, pause, pump, learning, scenario over seven days including heat days and "no effect").

### 12 Sep 2026 – first device test (firmware 2.0.0)

- **Scripts did not start at all** (`ReferenceError: "stepRead" is not defined`), although all 53 mock tests were green → decision 13; version of the three scripts afterwards 0.1.1.
- **`bw_pump` died with "Too much recursion"** – the nested step chain was 9–11 levels deep → decision 14; the mock has measured the call depth itself since then (`max. Aufruftiefe` in `tools/run-script.js`).
- **Probe (`tools/probe/engine_probe.js`):** `KVS.Set` works equally with RPC objects, literals, JSON copies and strings (`ec=0`); `KVS.GetMany` returns `items` as an array; the earlier error `KVS.Set lrn: Missing required argument 'key'` could not be reproduced – it only occurred in the deep call chain. Stack limit: [18](18-lernlog-geraet.md).
- **`bw_main` v0.1.1 aborted with `ReferenceError: "evalSamples" is not defined`** – on the device 166 (`bw_install`) and 210 bytes (`bw_main`) were missing at the end of the file: loss when pasting in the editor, not the storage limit (firmware 2.0.0 holds 19 KB) → decision 19.
- **Limit of the mock:** The mock runs the scripts in V8 (`vm.runInNewContext`). Whatever V8 interprets more generously than mJS (hoisting, stack depth, further language details) only shows up on the device or through rules in `syntax.test.js` or measurements in the mock; every further engine surprise is added there.

### 13 Sep 2026 – hardware test (stage 8)

- **Fourth engine error:** `bw_hwtest` died after the first measurement tick with `Function "shift" not found!` – mJS does not know `Array.prototype.shift`. Ring buffer by index; new rule in `syntax.test.js` (forbidden array methods).
- **Fifth engine error:** `bw_pump` died next to the running test script with `out_of_memory`, as did `bw_main` in its cycle: the script heap (~25 KB) is shared → decision 28. Normal operation with `bw_main` + `bw_pump` at 08:00 was not affected (~7.4 KB each).
- **Measured:** `KVS.GetMany` returns 11 entries per page; calibration points `vDry`/`vWet`, `lvlEmpty` 1 and the probe range confirmed, the flash was tight with two test scripts – values in [19](19-pruefprotokoll.md).
- **Test count:** 89 (58 so far + 12 `hwtest.test.js` + 15 `hwpump.test.js` + 4 size/syntax); after stage 9: 102 (+6 `zeitraffer.test.js`, +3 main, +2 install, +2 size/syntax for `bw_zeitraffer`).

### 13 Sep 2026 – fast-forward 0.1.3 (stage 9)

- **Target band on the device:** `cfg2` was empty until 13 Sep 2026 (`why=cfg`); for the practical test the example band `pctSoll` 55 / `pctLo` 40 / `pctHi` 65 / `pctDry` 38 / `dropSlow` 4 was set and stayed after the fast-forward run (hand values 0.2.0: decision 48).
- **`tHot` in fast-forward 30 °C:** the DS18B20 reached 33.5 °C with warm water in the hardware test; 35 °C is unreachable without a hair dryer. Same rule, only a reachable threshold.
- **Confirmed on the device:** timespec forms with a seconds field ≠ 0 (`15 */2`, `30 */2`, `45 */2`) are accepted; `bw_zeitraffer` starts `bw_install` without memory trouble (heap values in [19](19-pruefprotokoll.md)). Found: `bw_pump` next to `bw_main` → `out_of_memory` → decision 37, cause in [18](18-lernlog-geraet.md).
- **Round 2 (11:13–11:31):** all schedule cases shown (portion, heat double portion with a 2-min pause, float EMPTY → `wasser`, sensor in water → `feucht`, `limit`, restore byte-identical to the original); the hose lay at the plant, so the moisture at the sensor rose with every portion. Times and memory values in [19](19-pruefprotokoll.md).
- **First `Schedule.Create`:** the rejection persists even with KVS objects released (counter-check 12:15:08) – not a KVS heap problem; the installer has retried it silently since v0.1.2, only a second rejection is reported (decision 20 stands).
- **Tool:** `hwtest.js watch` has survived a tunnel hang since round 2 (RPC timeout is reported, the loop keeps running); the schedule output reads `cfg3` after activation.

### 13 Sep 2026 – stage 10 (implementation and device run)

- **Measurement run at the setup (step 0):** 3-s pulses only fill the hose (dead time 5–8 s, then the value creeps through dripping); only a 10-s pulse raises the moisture clearly and settles a few seconds after pump-off (pulse table with all values in [19](19-pruefprotokoll.md)). From this the defaults in `cfg4`: `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> (user: "5 s is very tight, the water needs 10–20 s through the hose"), `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def -->, `tStab` <!-- def:cfg4.tStab -->60<!-- /def -->, `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def -->, `effMax` <!-- def:cfg2.effMax -->30<!-- /def -->; raw data `docs/kal/2026-09-13-*-mess.json`.
- **Fast-forward profile adjusted** (55 updated): `tMin` <!-- zr:cfg3.tMin -->10<!-- /zr -->, `tStd` <!-- zr:cfg3.tStd -->12<!-- /zr -->, `tMax` <!-- zr:cfg3.tMax -->40<!-- /zr --> (`auto_off` 50 s), `tPmin` <!-- zr:cfg4.tPmin -->10<!-- /zr -->, `tPmax` <!-- zr:cfg4.tPmax -->15<!-- /zr -->, `tSoak` <!-- zr:cfg4.tSoak -->10<!-- /zr --> – so up to three portions of ≥ 10 s fit into the 120 s budget and the window sum; the schedule test uses a pot model of 1 %/s (12 s → 30 %, 15 s → 45 %, 10 s → 55 % ok). Full profile: [12](12-erstinbetriebnahme.md).
- **Profile 0.2.0 in full** (defaults from `ZR3`/`ZR4` in `bw_zeitraffer.js`; all other fields stay as they are): `cfg3` `tick` <!-- zr:cfg3.tick -->3<!-- /zr -->, `winEvery` <!-- zr:cfg3.winEvery -->6<!-- /zr -->, `soak` <!-- zr:cfg3.soak -->0.25<!-- /zr -->, `pauseHot` <!-- zr:cfg3.pauseHot -->0.1<!-- /zr -->, `pause` <!-- zr:cfg3.pause -->0.2<!-- /zr -->, `pauseSlow` <!-- zr:cfg3.pauseSlow -->0.35<!-- /zr -->, `jobAge` <!-- zr:cfg3.jobAge -->5<!-- /zr -->, `maxDay` <!-- zr:cfg3.maxDay -->4<!-- /zr -->, `tDead` <!-- zr:cfg3.tDead -->2<!-- /zr -->, `tMin` <!-- zr:cfg3.tMin -->10<!-- /zr -->, `tStd` <!-- zr:cfg3.tStd -->12<!-- /zr -->, `tMax` <!-- zr:cfg3.tMax -->40<!-- /zr -->, `tChk` <!-- zr:cfg3.tChk -->1<!-- /zr -->, `tHot` <!-- zr:cfg3.tHot -->30<!-- /zr -->, `dryDay` <!-- zr:cfg3.dryDay -->null<!-- /zr -->; `cfg4` `tWin` <!-- zr:cfg4.tWin -->120<!-- /zr -->, `tTail` <!-- zr:cfg4.tTail -->20<!-- /zr -->, `nPort` <!-- zr:cfg4.nPort -->3<!-- /zr -->, `tPmin` <!-- zr:cfg4.tPmin -->10<!-- /zr -->, `tPmax` <!-- zr:cfg4.tPmax -->15<!-- /zr -->, `tSoak` <!-- zr:cfg4.tSoak -->10<!-- /zr -->, `tStep` <!-- zr:cfg4.tStep -->5<!-- /zr -->, `tStab` <!-- zr:cfg4.tStab -->30<!-- /zr -->, `nStab` <!-- zr:cfg4.nStab -->3<!-- /zr -->, `dStab` <!-- zr:cfg4.dStab -->1<!-- /zr -->, `tDead2` <!-- zr:cfg4.tDead2 -->0<!-- /zr -->, `dEffMin` <!-- zr:cfg4.dEffMin -->1<!-- /zr -->; `cfg2` `pctDry` = <!-- zr:cfg2.pctDry -->pctLo − 1<!-- /zr -->.
- **`pctDry` in fast-forward = `pctLo − 1` instead of 101:** the band check of `bw_main` (`pctDry < pctLo`) would have rejected 101 with `why=cfg`. With `pctLo − 1` a dry phase ends as soon as the soil is dry enough for a job – practically off. Consequence for the schedule: the sensor in the water glass yields `why=trocken` at minute 0 (wetness > `pctHi` starts the dry phase), not `feucht`; from minute 3 in dry soil it continues in the same cycle (`dryOk` → `beob` – observing – → job).
- **Claim writes `dryOk: true`** (the plan said `false`): a portion in the window no longer triggers a dry phase (58); if `dryOk` stayed false in the claim, a crash mid-window would force a dry phase down to below 28 %. `nass` (m0 > `pctHi`) still sets `dryOk: false`.
- **Deadline in `bw_pump`:** `q = now mod (tick·60)` instead of `(minDay mod tick)·60 + now mod 60` – equivalent as long as the UTC offset is a multiple of 15 min (all time zones); saves `civil()` in the script.
- **`bw_pump` up to <!-- fact:size_limit_pump -->18 000<!-- /fact --> bytes** (`tools/build.js` `MAX_BYTES`, `limitFor()`): after all cuts (one write path, median instead of mean, terse lines) the control loop did not fit below 16 000 at <!-- fact:dist.bw_pump -->17 475<!-- /fact --> bytes; acceptable because the deadline rules out a run next to `bw_main`.
- **Calibration states mapped onto the band:** dry < `pctDry`, medium `pctDry`…`pctLo` (portion due = "normal watering"), band `pctLo`…`pctHi` (no portion), wet > `pctHi`. Portions and learned values only arise in dry and medium; the `kal` schedule therefore puts the sensor into soil of 28–40 % for the medium value, not 40–50.
- **7-day scenario:** per window claim + `st/day/job/lrn` → write budget from 18 to 24 per day (measured 15–22), average < 18; portions lie within 8 min after 08:00/20:00, first portion ≥ `tMin`, window sum ≤ 180.
- **Tools:** `hwtest.js scripts`/`delete` (flash), `preflight hw` creates the hardware-test scripts only on request; `put-script.js` aborts when `fs_free` + old code < new file + 4 096 B; `verify-scripts.js` checks `VER` of `bw_main` and `bw_pump` for equality.
- **Device (15:48–15:50):** test scripts were already deleted, upload of all four scripts byte-identical (flash values `fs_free` in [19](19-pruefprotokoll.md)); hand values `cfg2 {pctOk 50, pctHi 60, pctDry 28, effMax 30}`, `cfg3 {tMax 180, tMin 25}`, `lrn {sf 0.7, effW null, eff entfernt}`; the installer created `cfg4`, `dryDay`, `dropW/sfUp`, schedule `0 8 8,20`, `auto_off` 190 s. The device accepted the fast-forward minute list `40 2,8,14,…,56 * * * *` (was `[TODO am Gerät]`).
- **Window 1 on the device (15:54:30, fast-forward, calibration run):** two portions (P1 12 s, P2 10 s) lifted the dry soil into the band, result `unstab` (the value was still rising at the timeout), `effW` learned, runtime below the 120 s deadline, no `out_of_memory`; console lines, moisture and heap values in [19](19-pruefprotokoll.md). `kal write` (after `normal`): `lrn.effW` 4.46 (scale after `tRise`), `cfg4.tDead2` 5, `cfg3.tDead` 8, `cfg3.tMin` 10 – the dead time belongs to the hose, re-measure on the final setup with `mess`.
- **`kal write` also writes `cfg3.tDead`/`tMin`** (plan: only `effW`/`tDead2`): without the adjustment the clamp `tMin` 25 with 8 s dead time would have watered 17 effective seconds (≈ +75 %); `tMin = max(tPmin, tDead + 2)` keeps the user's requirement "portions ≥ 10 s".

## Open

Merged from the old plan ("Open before stage 3 can be completed on the device") and the test protocol of stage 10. Whoever completes an item enters date and result in the test protocol ([19](19-pruefprotokoll.md)) and strikes it out here.

| Item | Status | Next step |
| --- | --- | --- |
| target band `pctSoll`, `pctLo`, `pctHi`, `pctDry` from two measurements at the plant | since 13 Sep 2026 the device holds hand values (55/40/60/28, `pctOk` 50) from the example band, not measured | finish the calibration run ([12](12-erstinbetriebnahme.md)) |
| `dropSlow` for the 48-h rule | 4 on the device (since 13 Sep 2026, 10:57), example value | read the drying from `lrn.rate` over several days |
| calibration run: states medium moist and wet | only window 1 (dry) on 13 Sep 2026 | move the sensor per schedule, `hwtest.js kal 2400` |
| fast-forward schedule windows 2–4 (pause, heat, `wasser`, `limit`) with `tMax` 40 / `tSoak` 10 | 0.2.0: only window 1 ran; with 0.1.3 all cases shown | `hwtest.js zeitraffer 60` → repeat `watch 300` → `normal 60` |
| first real 20:00 window with dry soil | `[TODO am Gerät]` | follow with `console.js <ip> 900` (`hwtest.js watch` ends in normal operation) |
| `cfg3.tDead`/`tMin` on the final setup with a longer hose | `kal write` wrote 8 s / 10 s for the test hose | `hwtest.js mess 10 1 90` on the final setup (10–20 s according to the user) |
| test protocol rows 1, 5–7, 9–13, 15, 16, 18–20 | never triggered on the device; 12, 13 and 18 covered by the mock (`pump.test.js`) | play through one by one per [19](19-pruefprotokoll.md) |
| ~~input 1 (`input:1`, terminal IN2) = 1 means EMPTY~~ | confirmed 13 Sep 2026 via `bw_hwtest` (EMPTY = 1, FULL = 0) | – |
| ~~calibration points `vDry`/`vWet`~~ | measured 13 Sep 2026 via `bw_hwtest` (0.296 V / 3.134 V, written into `cfg1`) | – |
| ~~analog input is called `voltmeter:100`, DS18B20 `temperature:100`~~ | confirmed 12 Sep 2026 (`bw_main`: `V=0.28 … tC=24.4` with the default IDs 100) | – |
| ~~form of the fast-forward minute list~~ | `40 2,8,14,…,56 * * * *` accepted on 13 Sep 2026 (54) | – |

## Documentation debt

The device docs in the scripts (`//!` lines that survive the build) still point to sections of the old README: `bw_main.js` line 6, `bw_install.js` line 22, `bw_hwtest.js` line 5, `bw_hwpump.js` line 5 and `bw_zeitraffer.js` line 10. `tools/check-docs.js` reports this as the warning "doku-schuld" (documentation debt). The fix is a script release (bump the version, `npm run build`, upload, `verify-scripts.js`) and does not belong to the docs stage.

Likewise, the header comment of `tools/hwtest.js` (line 16) still describes the safe moment by the 0.1.3 rule; the code (`safeMoment()`) has long blocked minutes 0–2 of the 6-min cycle (decision 54).

## Example output

The docs check over the whole repo (15 Sep 2026, with this chapter): 0 errors, 29 warnings. The 24 `lesbarkeit` (readability) warnings concern the long cells of decisions 38, 40, 42–46, 52, 53, 55, 56 and 58 (DE and EN, 12 each): the wording of these decisions is kept in full from the old plan, so they exceed the cell limit of 400 characters. The five `doku-schuld` warnings are the documentation debt from above. In the block the `lesbarkeit` lines are shortened:

```text
$ node tools/check-docs.js
WARNUNG  docs/de/17-etappen-und-entscheidungslog.md:225 lesbarkeit   Tabellenzelle mit 446 Zeichen (Grenze 400)
WARNUNG  docs/de/17-etappen-und-entscheidungslog.md:227 lesbarkeit   Tabellenzelle mit 480 Zeichen (Grenze 400)
… (21 weitere Zeilen lesbarkeit: Entscheidungen 42–58 in docs/de und docs/en)
WARNUNG  docs/en/17-etappen-und-entscheidungslog.md:245 lesbarkeit   Tabellenzelle mit 587 Zeichen (Grenze 400)
WARNUNG  scripts/bw_hwpump.js:5                       doku-schuld  Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)
WARNUNG  scripts/bw_hwtest.js:5                       doku-schuld  Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)
WARNUNG  scripts/bw_install.js:22                     doku-schuld  Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)
WARNUNG  scripts/bw_main.js:6                         doku-schuld  Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)
WARNUNG  scripts/bw_zeitraffer.js:10                  doku-schuld  Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)
--- 0 Fehler, 29 Warnungen in 49 Dateien (0.1 s) ---
```

(`WARNUNG` = warning, "Tabellenzelle mit 446 Zeichen (Grenze 400)" = table cell with 446 characters (limit 400), "Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)" = device docs still name README sections (script release needed), "0 Fehler, 29 Warnungen in 49 Dateien" = 0 errors, 29 warnings in 49 files.) The test count this chapter cites comes from the same tool with `--mit-tests` (runs `node --test`, about 6 s):

```bash
node tools/check-docs.js --mit-tests   # checks the fact:tests markers against the actual test count
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| two entries carry the same number | number taken from an old state | take the next free number (as of 15 Sep 2026: 64); never re-sort numbers |
| a reference such as "Entscheidung 13" in code or a test points nowhere | a row was "cleaned up" or deleted | keep the old row, add "superseded by N" |
| a number is wrong after the next commit | number without a date and without a fact marker | add the date or a marker (`fact:tests`, `fact:ver.*`, `def:*`); `check-docs.js` checks it |
| the version in the log does not match the file | planned instead of built version copied (plan: `bw_install` 0.2.0, `hwtest.js` 0.2.0) | look up `var VER` or line 1 of the file; marker `fact:ver.*` |
| measurements differ between here and the test protocol | maintained twice | measurements only in [19](19-pruefprotokoll.md), here one sentence with a reference |
| "interview decision 13" confused with table row 13 | two numberings (interview 13 Sep and table) | table "Interview numbers" above |
| `check-docs.js` reports "veraltet" (outdated) in this chapter | old value without being marked as history | add "back then", "superseded by"; only some patterns from `verboten.json` are exempt for chapter 17 |
| `[TODO am Gerät]` marked as done | mock test confused with a device run | strike out only after the device run, date and result into the test protocol |
| `check-docs.js` warns "Tabellenzelle mit … Zeichen" (table cell with … characters) in the decision table | wording of an old decision copied in full | accept for numbers 1–63 (example output); keep new rows below 400 characters, details go into the addenda |

## Next

- [18 · Lessons from the device](18-lernlog-geraet.md) – every surprise from the addenda with symptom, cause, fix and the rule in the tests.
- [19 · Device test protocol](19-pruefprotokoll.md) – the measurements behind stages 8–10 and the template for the next device run.
- [16 · Concept and decisions](16-konzept-und-entscheidungen.md) – the why behind the decisions in context, research and rejected alternatives.
