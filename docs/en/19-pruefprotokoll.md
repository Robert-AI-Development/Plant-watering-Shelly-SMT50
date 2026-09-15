# 19 · Device test protocol

[Deutsch](../de/19-pruefprotokoll.md) · **English** — [Handbook](README.md) · Part F "Development"

> **At a glance**
> - Last run: 13 Sep 2026, 15:48–16:06 – the control loop of `bw_pump` <!-- fact:ver.bw_pump -->0.2.0<!-- /fact --> ran on the device for the first time: window 1 with two portions (12 + 10 s), moisture 10.4 → 50.5 %, runtime 100 s against a deadline of 120 s, `mem_peak` 12,516 B; afterwards `kal write` with `lrn.effW` 4.46.
> - Measured since 12 Sep 2026: calibration points 0.296 V / 3.134 V, float switch EMPTY = 1, probe 19.8–33.5 °C, script heap ~25 KB shared, stack depth 12 ok / 14 crash, flash 12,288 → 49,152 B without the three test scripts.
> - Test matrix with 21 rows: seven with device evidence (2, 3, 4, 8, 14, 17, 21 – 14, 17 and 21 only partly), three only in the mock (12, 13, 18), eleven open.
> - Open: windows 2–4 of the fast-forward schedule, calibration states medium moist and wet, the first real 20:00 window, `tDead`/`tMin` on the final setup, target band and `dropSlow` at the plant.
> - Biggest pitfall when writing the protocol: numbers without date and version – and the file names in `docs/kal/` are UTC (`…-13-50-…` = 15:50 local time).

## Prerequisites

- none – a reference chapter. Whoever drives the next run needs the commands from [11 · Hardware check](11-hardware-check.md), [12 · First commissioning](12-erstinbetriebnahme.md) and the tool reference in [14 · Debugging and testing](14-debuggen-und-testen.md).

## Diagram

[![Sequence of the device run on 13 Sep 2026: hwtest.js normal and kal, bw_install builds the schedule, bw_main writes the job, bw_pump waters window 1 in two portions, restore and kal write](../diagramme/en/19-pruefprotokoll.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/19-pruefprotokoll.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/19-pruefprotokoll.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Activation 15:48–15:51", 2 "Window 1 at 15:54:30", 3 "Restore and kal write".

## Setup and tools

All runs took place on the same device: a Shelly Plus Uni with firmware 2.0.0, time zone Europe/Vienna, on the user's LAN. Claude Code works on a VPS without LAN access and reaches the device through a reverse SSH tunnel at `127.0.0.1:8010` ([09 · Installation with a VPS](09-installation-vps.md)). The human stands at the setup, moves sensors and the float switch, and confirms before the pump runs.

| Part | State at the last run (13 Sep 2026) |
| --- | --- |
| Sensors | SMT50 centred in fresh, dry soil with two Gardena drippers right above it; DS18B20; float switch in the reservoir (`lvlEmpty` 1) |
| Scripts on the device | id 1 `bw_install` 0.1.3, id 2 `bw_main` 0.2.0, id 3 `bw_pump` 0.2.0, id 7 `bw_zeitraffer` 0.2.0; `engine_probe` (4), `bw_hwtest` (5) and `bw_hwpump` (6) deleted on 13 Sep 2026 (flash) |
| Tools | `tools/put-script.js` (upload in chunks, byte-identical check), `tools/verify-scripts.js`, `tools/console.js`, `tools/hwtest.js` <!-- fact:ver.hwtest -->0.1.2<!-- /fact --> (`preflight`, `normal`, `zeitraffer`, `watch`, `mess`, `kal`) – Node ≥ 20, `console.js` and `hwtest.js` Node ≥ 22 (global WebSocket), no dependencies |
| Raw data | `docs/kal/<date>-mess.json` and `<date>-kal.json`; the log file `2026-09-13-13-50-kal-log.txt` holds the console of the stage-10 run |
| Mock state | `npm test`: 53 tests on 12 Sep 2026, 89 after the hardware test, 102 after the fast-forward run, 144 after stage 10, today <!-- fact:tests -->146<!-- /fact --> |

Rules for every entry: date, time in local time and versions of the scripts involved are written down; every number comes from the console, the `watch` status line, an RPC response or a raw data file; surprises the mock does not show go to [18 · Lessons from the device](18-lernlog-geraet.md) and become a rule in the tests. A test item counts as done only once it has run on the device – a green mock test is recorded as "mock" in the "State" column.

## Device test 12 Sep 2026 (v0.1.1, firmware 2.0.0)

First contact of the three operating scripts with the engine, through the tunnel with `put-script.js` and `console.js`:

| Check | Result |
| --- | --- |
| Scripts loaded completely | upload with `Script.PutCode` in chunks, byte count checked against the file with `Script.GetCode`. The web editor had lost the end of the file while pasting: `bw_install` 166 B (12,131 → 11,965), `bw_main` 210 B (19,231 → 19,021); firmware 2.0.0 stores 19 KB without complaint |
| Installer | creates 8 KVS entries (JSON strings, readable in the web UI with "Format as JSON") and 3 schedule entries: `0 */15 * * * *` for `bw_main`, `0 0 8,20 * * *` for `bw_pump`, `0 5 8,20 * * *` as safety-off (state 0.1.1; today `30 0 8,20` and `0 8 8,20`). The device rejects the first `Schedule.Create` of a run; it is retried automatically |
| `bw_main` / `bw_pump` | start without uncaught errors; readings plausible (`V≈0.27`, `tC≈24`) with the default IDs `voltmeter:100` and `temperature:100`. `err=cfg` / `why=cfg` (fault and reason "configuration incomplete") is expected while the target band in `cfg2` is still `null` |
| Engine limits (`tools/probe/engine_probe.js`) | no hoisting (`ReferenceError: "stepRead" is not defined`); stack depth 12 runs, 14 crashes ("Too much recursion"), mock limit <!-- fact:call_depth -->10<!-- /fact --> since then; KVS values must be strings (the web UI shows objects as `[object Object]`); `KVS.GetMany` returns `items` as an array |

## Hardware test 13 Sep 2026 (bw_hwtest 0.1.0, bw_hwpump 0.1.0)

Driven from the VPS with `tools/hwtest.js` (`preflight`, `start`, `watch`, `go`, `report`, `cleanup`); the user at the setup. Scripts on the device: id 5 `bw_hwtest`, id 6 `bw_hwpump`. Input 1 was already of type `switch`, `input-on` was not needed. Procedure and phases are explained in [11 · Hardware check](11-hardware-check.md).

| Measurement | Result |
| --- | --- |
| Sensor test, six phases t1, t2, m1, m2, l1, l2 | all `ok`, duration 532 s; one console line every 5 s per phase |
| Probe DS18B20 | 19.8 °C in ice water, 33.5 °C in warm water or in the hand |
| Dry point / wet point | 0.296 V (sensor wiped, in air; start value `vDry` 0.20 V, reading on 12 Sep ≈ 0.27 V) / 3.134 V → written to `cfg1` automatically: `vDry` 0.20 → 0.296, `vWet` 3.13 → 3.134 |
| Float switch | EMPTY = 1, FULL = 0 → `lvlEmpty` 1 confirmed, 8 input changes observed |
| `ram_free` during the sensor test | at least 125,424 B; a 1-s tick with `getComponentStatus` costs 12–17 % CPU according to the firmware log |
| Pump test pass A | 26 s, release 19 s after `go`; backup to `hwb1`/`hwb2`, job `job` with `sec` <!-- hwp:pumpSec -->30<!-- /hwp --> and `why` `hwtest`, `Script.Start` of `bw_pump` |
| `bw_pump` alone | "Pumpe ein für 30 s (Auftrag 30 s, pct null)" (pump on for 30 s, job 30 s), "Pumpe aus: ok nach 30 s" (pump off after 30 s), `ergebnis=ok sec=30 day.n=1` (result ok) |
| Pass B | p0–p3 `ok`, restore of `st`/`day`/`job`/`err`, `hwb1`/`hwb2` deleted; KVS afterwards byte-identical to the state before the test (cfg1/2/3, day, err, job, lrn, st); `kvs_rev` 198 at the end |
| Flash | `fs_free` 57,344 B before the upload, 24,576 B after the two test scripts (13.4 + 13.9 KB) |

Engine findings of that day (causes and rules in [18 · Lessons from the device](18-lernlog-geraet.md)):

| Finding | Measurements | Consequence |
| --- | --- | --- |
| `Function "shift" not found!` – mJS has no `Array.prototype.shift` | `bw_hwtest` aborted after the first measuring tick | ring buffer by index; `syntax.test.js` forbids `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort` |
| Script heap is shared, ~25 KB | `mem_free` 24,920 B idle for every script; `bw_hwpump` with all KVS objects in RAM 13,552 B (peak 15,400) → `bw_pump` `out_of_memory` at start, `bw_main` in the 15-min cycle as well | test scripts release `K`/`orig` while waiting (`bw_hwpump` 9,044, `bw_hwtest` 9,576 B); parse footprint `bw_hwtest` 3,564, `bw_main` 5,404, `bw_pump` 7,396 B |
| `bw_pump` next to a 9-KB script | on the second KVS read (13 entries incl. `hwt/hwr/hwp/hwb1/hwb2`) over 15.8 KB peak → `out_of_memory` again, pump was off, `st/day/job` never written | pump test in two passes, `bw_pump` runs alone; `bw_main` + `bw_pump` together (08:00/20:00) ran that morning with ~7.4 KB each – not a peak value, as the fast-forward run below showed |
| `KVS.GetMany` returns 11 entries per page | mock: 5; reading only the first page misses `st` | scripts, `kvs_dump.sh` and `hwtest.js` paginate |
| Debug websocket | firmware lines (`shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`, …) and `JS RAM stat … used: N` at start; the console must be connected before `Script.Start` | `hwtest.js watch` filters the noise, `console.js` does not |

## Fast-forward run 13 Sep 2026 (profile 0.1.3)

Versions: `bw_zeitraffer` 0.1.0, `bw_install` 0.1.2, `bw_main` 0.1.2, `bw_pump` 0.1.1; tools `hwtest.js zeitraffer`/`watch`/`normal` and `verify-scripts.js`. The profile of that version had a 1-min cycle, windows every 2 min, a 5-s dose (`auto_off` 15 s) and no control loop yet – compare today's profile (cycle <!-- zr:cfg3.tick -->3<!-- /zr --> min, windows every <!-- zr:cfg3.winEvery -->6<!-- /zr --> min) in [12 · First commissioning](12-erstinbetriebnahme.md).

Autonomous from the VPS through the tunnel; from minute 7 of the second round the user did the manual steps of the schedule (probe into hot water, float switch, sensor into water). **The hose lay at the plant**, so the moisture at the sensor rose with every dose. Expectations from `tools/test/zeitraffer.test.js` (102 tests at the time).

| Step | Expectation | Result / time |
| --- | --- | --- |
| Timespec pre-check | `Schedule.Create` with `15 */2 * * * *`, `0 * * * * *`, `0 */2 * * * *` is accepted | 10:56: all three accepted (id 4, deleted immediately), no retry needed via RPC |
| Upload and check 2 | six scripts via `put-script.js`, `verify-scripts.js` byte-identical, doc lines visible | 10:57: `bw_install` 14,295, `bw_main` 15,288, `bw_pump` 10,805, `bw_hwtest` 13,952, `bw_hwpump` 14,500, `bw_zeitraffer` 6,354 B; doc lines 20/6/5/4/4/9. After the fix (round 2) `bw_install` 14,480, `bw_zeitraffer` 6,379 B – all OK again; `fs_free` afterwards 12,288 B (before 24,576) |
| Target band | `cfg2` = 55/40/65/38/4 (`pctSoll`/`pctLo`/`pctHi`/`pctDry`/`dropSlow`, interview decision) | set at 10:57, `kvs_rev` 202 |
| Installer update (`normal`) | "KVS cfg3 ergänzt: tick,winEvery" (fields added), schedule `0 */15`, `0 0 8,20`, `0 5 8,20`, `auto_off` 130 s | 10:58:08 exactly so; heap 24,920 B free afterwards |
| Fast-forward start, round 1 | schedule `0 * * * * *`, `0 */2`, `15 */2`, `auto_off` 15 s, `zr` gone, `zrb1..3` present | 10:59:09 exactly so – **but** `bw_pump` died at 11:00 and 11:02, starting in the same second as `bw_main`, with `out_of_memory` (`used=791 peak=871 total=1746`); `bw_main` used 13,216 B (peak 16,380), runtime 5–7.5 s. No dose. Restore 11:07:09 clean |
| Fix | `bw_pump` starts 30 s after the full minute (`PUMP_SEC`, decision 37) | `bw_install` and `bw_zeitraffer` uploaded again, `hwtest.js` checks the new schedule |
| Installer update, round 2 | schedule `0 */15`, `30 0 8,20`, `0 5 8,20` | 11:12:08 exactly so |
| Fast-forward start, round 2 | schedule `0 * * * * *`, `30 */2 * * * *`, `45 */2 * * * *`, `auto_off` 15 s | 11:13:08 exactly so, `zr` deleted, `zrb1..3` present, heap 24,920 B free |
| Minute 1 | `bw_main`: `why=ok sec=5` (reason ok: watering job, soil dry) | 11:14:00 `pct=0 … pause=0.17h why=ok sec=5` (5.4 s) |
| Minute 1:30 | `bw_pump`: `ergebnis=ok sec=5`, output off within 7 s (dose 1) | 11:14:30 "Pumpe ein für 5 s", "Pumpe aus: ok nach 5 s", `day.n=1`, 13.1 s, `mem_used` 11,970 B (alone) |
| Minute 2 | `st=sperre dry=1 pause=0.17h why=pause` (`sperre` = locked, `pause` = minimum pause running) | 11:15 "Bewertung ohne Vorwert übersprungen" (rating skipped, no previous value), exactly so; moisture 0 → 36 % from the dose |
| Heat (manual step) | probe above 30 °C → `pause=0.035h why=ok`, dose in the next window | from ~11:20 probe in hot water (up to 86 °C, `lrn.tMaxD` 86): 11:21 `why=ok`, **11:22:30 dose 2** (pct 36.6; 8 min after dose 1 – heat shortens the pause) |
| Heat double dose | second dose 2 min after the last | 11:23 `why=ok`, **11:24:32 dose 3** (`day.n=3`) |
| Float switch EMPTY | `why=wasser err=wasser` (water: reservoir empty), window does not pump | 11:25:01 `why=wasser`, 11:26 `err=wasser`, 11:26:30 `bw_pump`: no job ("kein Auftrag") |
| Sensor in water | `why=feucht` (moist; behaviour of 0.1.3 – since 0.2.0 wetness > `pctHi` starts the dry phase: `why=trocken`) | 11:27 `pct=99 why=feucht`, `err` cleared (float switch FULL again) |
| Sensor dry | `why=ok`, dose 4 | 11:28 `pct=0 why=ok`, **11:28:30 dose 4** (`day.n=4`) |
| Daily limit | `why=limit`, no more pumping | 11:29 `why=limit` (pct 54 after the dose, `dry=0`), 11:30:30 `bw_pump`: no job |
| Memory | no `out_of_memory` in round 2 | `bw_main` 13,216 / 16,380 B per cycle, `mem_free` min 11,536; `bw_pump` alone ≤ 11,970; idle 24,920. After every `bw_main` run `shelly_ejs_timer.cpp:44 Timer 1 handle not found` (harmless) |
| Return (`normal`) | "Zeitraffer beendet" (fast-forward ended), `cfg3` original with `tick` 15 / `winEvery` null, `zr`/`zrb*` deleted, normal schedule, `auto_off` 130 s, `day.n` 0 | 11:31:17 exactly so; `lrn` (`tMaxD` 38, `tMaxY` 24, `tMean` 24) and `err` (`cfg` from the day before, cleared by `bw_main` in the next cycle) as before the test; `kvs_rev` 287 – both rounds together 86 writes |

Result: every schedule case shown on the device – dose, normal pause, heat double dose, reservoir empty, moist, daily limit, restore. Only finding: the simultaneous start of `bw_pump` and `bw_main` (fixed with second 30). Afterwards: sensor back into the soil, float switch to FULL.

## Measurement run 13 Sep 2026 (`hwtest.js mess`)

Planning the control loop for stage 10: SMT50 centred in dry soil, two Gardena drippers right above it; pump via `Switch.Set toggle_after`, sensor every 2 s via RPC, no device code.

Raw data: [`2026-09-13-12-58-mess.json`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/docs/kal/2026-09-13-12-58-mess.json), [`…-13-09-mess.json`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/docs/kal/2026-09-13-13-09-mess.json), [`…-13-14-mess.json`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/docs/kal/2026-09-13-13-14-mess.json) (file names in UTC, table in local time).

| Run | Pulse | Moisture before → peak (t) → rest | `tRise` | Gain | Finding |
| --- | --- | --- | --- | --- | --- |
| 14:54 | 3 s | 10.4 → 10.7 | – | – | no reaction: the hose was empty, 3 s only fill it |
| 14:56 | 3 s | 10.7 → 20.2 (86 s) | 5.3 s | +9.5 % | jump within 10 s, then creeping until 86 s (trailing water) |
| 14:58 | 3 s | 20.2 → 31.9 (80 s) | 5.5 s | +11.7 % | as above, creeping +8 % between 20 and 87 s |
| 15:01 | 3 s | 34.0 → 36.1 (162 s) | 7.8 s | +2 % | in moister soil almost only trailing water |
| 15:03 | 3 s | 35.7 → 37.8 (65 s) | 7.9 s | +2 % | ditto |
| 15:10 | 10 s | 37.5 → 49.1 (15 s), stable for 2 min | 7.9 s | +11.6 % = 5.6 %/effective s | rise while pumping, rest value 5 s after switching off, no creeping |

Derived start values, in `bw_install` since then: `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s, `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> s, `tMin` <!-- def:cfg3.tMin -->25<!-- /def --> s, `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s, `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s, `effMax` <!-- def:cfg2.effMax -->30<!-- /def --> as a plausibility limit – and the rule "portions never shorter than the dead time".

Side findings: no voltage dips at the voltmeter while the pump runs (values plausible during the pulse); the voltmeter delivers fresh values at 2-s polling in steps of 0.3 %; with short pulses, trailing water from the hose is the dominant effect.

## Stage 10: window 1, heap, `kal write` (13 Sep 2026, 15:48–16:06)

Setup: SMT50 centred in fresh, dry soil, two Gardena drippers above it, reservoir full, tunnel `127.0.0.1:8010`. Claude drove every step through the tools; the sensor stayed in place during the run – hence only window 1 of the schedule, afterwards the soil was above target (`feucht`). The diagram above shows this run.

| Step | Result |
| --- | --- |
| Flash before the upload | scripts 4/5/6 (`engine_probe`, `bw_hwtest`, `bw_hwpump`) were already deleted: `fs_free` 49,152 B (before 12,288 B with seven scripts) |
| Upload | `bw_pump` 17,475 B, `bw_main` 15,791 B, `bw_install` 15,978 B, `bw_zeitraffer` 7,453 B – all byte-identical (`put-script.js`, `verify-scripts.js`, version equality `bw_main` = `bw_pump` = 0.2.0) |
| Compact output today | `npm run build`: `bw_pump` <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B, `bw_main` <!-- fact:dist.bw_main -->15 791<!-- /fact --> B, `bw_install` <!-- fact:dist.bw_install -->15 978<!-- /fact --> B, `bw_zeitraffer` <!-- fact:dist.bw_zeitraffer -->7 459<!-- /fact --> B – if a number differs from the upload, the script has changed since 13 Sep 2026 |
| Flash after the upload | `fs_free` 40,960 B (LittleFS counts in 4-KB blocks); since v0.1.2 `put-script.js` checks `fs_free` + old code ≥ new file + 4,096 B before every upload |
| Manual values | `cfg2 {pctOk 50, pctHi 60, pctDry 28, effMax 30}`, `cfg3 {tMax 180, tMin 25}`, `lrn {sf 0.7, effW null}` (field `eff` removed); `cfg2.dropSlow` 4 unchanged since 10:57 |
| `hwtest.js normal 60` (installer 0.1.3), 15:48 | adds `cfg2.dropW`/`sfUp`, `cfg3.dryDay`, creates `cfg4`; schedule `0 */15`, `30 0 8,20`, `0 8 8,20`; `auto_off` 190 s; `verifyState` without deviation; heap 5,348 B |
| `hwtest.js kal 780` (fast-forward 3/6 with recorder) | safe moment 15:50:09, activation 15:50:34; schedule `0 */3`, `30 */6`, **minute list `40 2,8,…,56` accepted**, no `Hinweis: Schedule.Create …` line in the console (a first rejection is retried silently by the installer); `auto_off` 50 s; `kvs_rev` 496; JS RAM stat of the activation 1,800 and 2,204 B. Cycle 15:51: `pct=10.829 why=ok sec=12 sf=0.7`, `dauer=5660ms` (runtime), `w=3` (writes) |
| **Window 1**, 15:54:30 | `Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s` (window: job 12 s, deadline 120 s) · `m0 10.4 % → P1 12 s` · `P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)` · `P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)` · `ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199` |
| Interpretation | first portion, fresh reading, correction portion from the measured effect, target `pctOk` 50 reached; runtime 100 s below the deadline of <!-- zr:cfg4.tWin -->120<!-- /zr --> s; P1 stable after 12 s, P2 ran into the 30-s timeout (`unstab` – under the dripper the value keeps rising); in the normal profile `tStab` 60 and `tSoak` 20 cover this |
| Heap in the window | `bw_pump` `mem_used` 10,206–10,500 B, **`mem_peak` 12,516 B** at `mem_free` 25,200; no `out_of_memory`. The <!-- fact:size_limit_pump -->18 000<!-- /fact --> B exception for `bw_pump` is covered: thanks to the deadline the parse of `bw_main` (5,348 B) never comes on top |
| Firmware notices | `shelly_ejs_timer.cpp:44 Timer 1 handle not found` (`Timer.clear` on its own timer from within its callback) and `persistent_counters.cpp:585 PCS write interval < 60s` (counter write of the switch for portions less than 60 s apart) – harmless, the script ran on cleanly (`w=4`, `Script.Stop`) |
| Check 15:57 | `Kontrolle: 50.5 → 53.7 % sf=0.7` (check, +3.2), `st=sperre dry=1 why=pause` (no dry phase after the dose, decision 58) · 16:00 `pct=56.871 why=pause` (trailing water +6.4 % against the window reading 50.5), 16:00:30 `bw_pump` without a job · 16:03 `pct=56.401 why=feucht` |
| `hwtest.js normal 60`, 16:04 | original restored from `zrb1..5` (`cfg3, lrn, day, st, err, cfg4, cfg2, job`), schedule, `auto_off` and backup checked, heap free 25,200 B |
| `kal report <json> <log>` | 155 samples, 1 window, state dry (m0 10.4 < `pctDry` 28): P1 12 s / +23.6 / `tRise` 8 s, P2 10 s / +16.5 / `tRise` 5 s → **4.46 %/s after `tRise`** (profile scale `st.effW` 2.01 because of `tDead` 2 / `tDead2` 0 in the fast-forward profile). The console lines came from the `watch` log file because the recorder only writes them itself since `hwtest.js` 0.1.2 |
| `kal write`, 16:06 | `lrn.effW` null → 4.46; `cfg4.tDead2` 8 → 5; `cfg3.tDead` <!-- def:cfg3.tDead -->20<!-- /def --> → 8; `cfg3.tMin` 25 → 10 (`max(tPmin, tDead + 2)`); before/after in the output, KVS read back |

> **Measured on the device (13 Sep 2026):** The dead time belongs to the hose, not to the script. The values `tDead` 8 s and `tMin` 10 s apply to the short hose of the test setup; the final setup with a longer hose (10–20 s of water travel according to the user) needs a new `mess`, then check `tDead`/`tMin`.

## Test matrix no. 1–21

Before: installer run, target band in `cfg2`, pump connected, reservoir filled. KVS state at any time with `tools/kvs_dump.sh <ip>` or `http://<ip>/rpc/KVS.GetMany?match=*`. State: "device" = run on the setup, "mock" = only reproduced in the tests, "open" = not triggered yet.

| No. | Check | Procedure | Expectation | State |
| --- | --- | --- | --- | --- |
| 1 | Installer repeatable | start `bw_install` twice, look at `Schedule.List` | exactly three own entries, cfg values unchanged | open – the installer ran several times on 13 Sep 2026, each time "Zeitplan: 3 Einträge, davon eigene: 3" (3 entries, 3 own); a deliberate double start with a comparison of the cfg values is missing |
| 2 | Component IDs | read the first console line of `bw_main` | `V=` voltage, `tC=` temperature, `lvl=` 0 or 1; otherwise adjust `idV/idT/idLvl` in `cfg1` | device 13 Sep 2026: all three components deliver values – 19.8–33.5 °C, 0.296–3.134 V, float switch 0/1 (8 changes) |
| 3 | Calibration points | sensor dry in air, then in water: read `V=` | near 0.20 V and 3.13 V; otherwise adjust `vDry/vWet` | device 13 Sep 2026 via `bw_hwtest`: 0.296 V / 3.134 V, written to `cfg1` automatically |
| 4 | `lvlEmpty` | reservoir empty → read `lvl=` | value = `cfg1.lvlEmpty` (start value 1) | device 13 Sep 2026: EMPTY = 1, FULL = 0 → `lvlEmpty` 1 confirmed |
| 5 | Sensor unplugged | disconnect the SMT50 signal wire, wait one cycle | `err.code = "sensor"`, `job.why = "sensor"`, no pump | open |
| 6 | Sensor reconnected | reconnect the wire, wait one cycle | `err.code = null` | open |
| 7 | Mandatory field missing | set `cfg3.tMax` to null in the KVS, wait for a cycle | `err.code = "cfg"`, `job.ok = false`; free again after resetting | open |
| 8 | Manual job | set `job` = `{"ok":true,"sec":70,"why":"hand","ts":<now>}` (without `pct` = single portion), start `bw_pump` | pump runs clamp(`sec`, 1, min(`tPmax`, `tMax`)) = 70 s (stopwatch), `st.state = "gegossen"` (watered), `day.n = 1`, `job.ok = false`. With `pct` (and `nPort` > 1) the control loop runs: fresh reading m0; at m0 ≥ `pctOk` `why=feucht` without a dose, otherwise P1 70 s and further portions up to `pctOk` (Σ ≤ `tMax` 180 s) | device 13 Sep 2026 as a variant of the pump test: 30 s instead of 70 s (`why` `hwtest`, without `pct`); `st.state = gegossen`, `st.sec = 30`, `day.n = 1`, `job.ok = false` before the restore |
| 9 | Stale job | as 8, but `ts` 30 min in the past | `err.code = "alt"` (stale), no pump | open |
| 10 | Daily limit | set `day.n` to 2, manual job | `err.code = "limit"`, no pump | open (in the 0.1.3 fast-forward run `why=limit` came after dose 4) |
| 11 | Water empty before a dose | float switch to EMPTY, manual job | `err.code = "wasser"`, no pump | open as a manual job (in the 0.1.3 fast-forward run: `why=wasser`, `err=wasser`, window without a dose) |
| 12 | Water empty during a dose | manual job with `pct` (control loop), float switch to EMPTY after 10 s | pump off within `tChk` s, `st.state = "sperre"`, `st.rated = true`, `st.why = "abbruch"` (aborted), `err.code = "wasser"`, `day.sec` counts the partial portion | mock: `pump.test.js` (EMPTY in P2 / in the waiting phase → `wasser`) |
| 13 | Safety-off with a crashed script | manual job with `pct` at 07:59, let `bw_pump` run at 08:00:30, stop it mid-window in the web UI | output off by 08:08 at the latest (schedule `0 8 8,20`), otherwise `toggle_after`/`auto_off` 190 s; `st.why` stays `laeuft` (running), next cycle `why=pause`, nothing learned | schedule `0 8 8,20` created on 13 Sep 2026; the abort itself only in the mock (`pump.test.js`: `Script.Stop` → claim + guard) |
| 14 | `auto_off` | `Switch.Set {id:0,on:true}` without `toggle_after` via RPC | output off by itself after `tMax` + 10 s = 190 s | device 13 Sep 2026: `auto_off 190 s` set by the installer (`verifyState`); the switch-off itself not triggered |
| 15 | Output after restart | switch the output on, power-cycle the Shelly | output is off (`initial_state = off`) | open |
| 16 | Invalid clock | Wi-Fi off, power-cycle the Shelly (no NTP), start `bw_main` by hand | `err.code = "uhr"` (clock), no pump, schedule stands still; normal again after Wi-Fi returns | open |
| 17 | Rating and learned value | follow a real window (`console.js <ip> 900`; `hwtest.js watch` ends in normal operation as soon as no test script runs), then read `lrn.effW` and `st` | console `P1 …`, `P2 …`, `ergebnis=… effW=…`; `lrn.effW` between `effMin` and `effMax`, `st.n/sec/pctB/pctW/effW/why` filled; `soak` min later `Kontrolle: … → … %` with `pctA`, no second learned value | device 13 Sep 2026 in fast-forward: `effW` 2.006 (profile scale), check 50.5 → 53.7 %; real 20:00 window open |
| 18 | No effect | pull the hose off the plant, wait for a window | first portion without effect → one full probe portion → `st.why = "noeff"`, `err.code = "noeff"` (no effect), `lrn.effW` unchanged, `st.state = "sperre"`; free again after deleting `err` | mock: `pump.test.js` (two full portions, ΣΔ < `dEffMin`) |
| 19 | Temperature probe unplugged | disconnect the DS18B20 | `err.code = "temp"`, job still possible | open |
| 20 | Memory consumption | note `err.mem` over several days | value stable (difference < 10 %) | open |
| 21 | KVS writes | note `Sys.GetStatus.kvs_rev` in the morning and evening | difference below 24 per day (per window claim + `st/day/job/lrn`; mock 15–22) | device 13 Sep 2026 only per run: fast-forward window `w=4`, cycle `w=0–3`; daily difference open |

## Open

- Calibration states **medium moist** and **wet** of the calibration run: move the sensor as the schedule says, `hwtest.js <ip> kal 2400`, then `normal`, `kal report`, `kal write` ([12 · First commissioning](12-erstinbetriebnahme.md)).
- **Windows 2–4** of the 0.2.0 fast-forward schedule (pause, heat, `wasser`, `limit`) with the profile values `tMax` <!-- zr:cfg3.tMax -->40<!-- /zr --> s / `tSoak` <!-- zr:cfg4.tSoak -->10<!-- /zr --> s.
- **First real 20:00 window** with dry soil, followed with `console.js <ip> 900` (matrix 17).
- Re-measure `cfg3.tDead`/`tMin` on the **final setup with the longer hose** via `mess` (10–20 s according to the user).
- **Target band** `cfg2` (upper and lower reference at the plant) and `dropSlow` – still the example values of 13 Sep 2026.
- Matrix rows 1, 5, 6, 7, 9, 10, 11, 15, 16, 19, 20 and actually triggering the shut-offs (13, 14); pump delivery per second ([04 · Safety and limits](04-sicherheit-und-grenzen.md)); behaviour after a power failure and a firmware update ([13 · Operation and maintenance](13-betrieb-und-wartung.md)).

## Template for the next entry

New runs are added as their own section above the test matrix; completed matrix rows get date and evidence in the "State" column. The procedure of a device run is a checklist in [12 · First commissioning](12-erstinbetriebnahme.md); in short:

1. `npm test` green, `npm run build`, check the flash (`hwtest.js <ip> scripts`).
2. Upload with `put-script.js`, then `verify-scripts.js` (byte-identical, version equality).
3. `hwtest.js <ip> normal 30` – the installer adds new fields; `verifyState` without deviation.
4. Drive the run (`zeitraffer`, `kal`, `mess` or a real window with `console.js`), console and status lines into a log file.
5. Back with `normal 60`; raw data into `docs/kal/`; entry following this template; surprises to [18 · Lessons from the device](18-lernlog-geraet.md).

```markdown
## <run> <DD.MM.YYYY> (<script> v<x.y.z>, <tool> v<x.y.z>, firmware <x.y.z>)

Setup: <sensor position, hose, reservoir> · Tools: <commands> · Mock state: npm test <n> green · Log file: docs/kal/<date>-….txt

| Step | Expectation (source: test, handbook chapter) | Result / time (local time) |
| --- | --- | --- |
| … | … | … |

Measurements: mem_used/mem_peak per script (watch status line), mem_free idle, fs_free, kvs_rev before/after, dauer= per run
Findings: <symptom> → 18 · Lessons (+ rule in the tests) · decisions → 17 · Stage log
Open: <what was not shown>
```

## Example output

Activation of the calibration run on 13 Sep 2026 (`hwtest.js kal 780`, excerpt from the log file: `[status …]` lines, the tool's schedule and recorder printout, the line `kein bw_zeitraffer/bw_install läuft mehr` and firmware lines `JS RAM stat` omitted). `bw_zeitraffer` writes the backup and starts `bw_install`, which reports the fast-forward schedule; then the tool checks the state (`sicherer Moment` = safe moment, `Sicherung … wird geschrieben` = backup is being written, `Zeitplan` = schedule, `fertig` = done):

```text
sicherer Moment: 15:50:09
Script.Start bw_zeitraffer (id 7) → {"was_running":false}
[bw_zeitraffer 0.2.0] Sicherung zrb1..5 wird geschrieben; Profil: Takt 3 min, Fenster alle 6 min, Budget 120 s, bis 3 Portionen, tHot 30 °C, maxDay 4, Trockenphase aus
[bw_zeitraffer 0.2.0] bw_install gestartet (id 1) – baut Zeitplan und auto_off. Zurück zum Normalbetrieb: bw_install erneut starten
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] Zeitplan: 3 Einträge, davon eigene: 3
[bw_install 0.1.3] Switch 0: auto_off 50 s
[bw_install 0.1.3] KVS neu angelegt: keine
[bw_install 0.1.3] Zeitplan #1: 0 */3 * * * *
[bw_install 0.1.3] Zeitplan #2: 30 */6 * * * *
[bw_install 0.1.3] Zeitplan #3: 40 2,8,14,20,26,32,38,44,50,56 * * * *
[bw_install 0.1.3] fertig – ZEITRAFFER aktiv: bw_main alle 3 min, bw_pump alle 6 min (Sekunde 30), Budget 120 s, bis 3 Portionen, Sicherheits-Aus 160 s nach der Fensterminute; zurück: bw_install starten
ok       Zeitplan: #1 [0 */3 * * * *] #2 [30 */6 * * * *] #3 [40 2,8,14,20,26,32,38,44,50,56 * * * *]
ok       auto_off 50 s
ok       Sicherung zrb1..5 vorhanden (Original: tick 15, tMax 180, tWin 420, pctDry 28)
ok       Profil: Takt 3 min, Fenster alle 6 min, Budget 120 s, bis 3 Portionen, tStd 12 s, tHot 30 °C, maxDay 4, pctDry 39
ok       Script-Heap frei: 25200, ram_free 143208, kvs_rev 496
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
```

The console of window 1 (15:54:30) with the `watch` status lines is shown in [04 · Safety and limits](04-sicherheit-und-grenzen.md). The report from the recording can be regenerated at any time without the device – this is what it looks like today (`Aufzeichnung` = recording, `Kalibrierlauf` = calibration run, `Proben` = samples, `Zustand trocken` = state dry, `Vorschlag` = proposal):

```bash
node tools/hwtest.js <ip> kal report docs/kal/2026-09-13-13-50-kal.json docs/kal/2026-09-13-13-50-kal-log.txt   # report from JSON + log file, no device needed
```

```text
Konsolenzeilen aus docs/kal/2026-09-13-13-50-kal-log.txt: 5
Aufzeichnung: docs/kal/2026-09-13-13-50-kal.json
Kalibrierlauf 2026-09-13T13:50:34.253Z – 155 Proben, 1 Fenster; Zustände: trocken < pctDry 28, mittel 28–40 (Gabe fällig), band 40–60 (keine Gabe), nass > pctHi 60 (Ziel pctOk 50, pctSoll 55)
Fenster  Start   Zustand       m0     n  Σs   tRise  Spitze  Ruhe   pctW   effW   why   | Portionen (Konsole): sec/Δ%/tRise → effW nach tRise
     1   4:06  trocken       10.4   2   22     12    55.5   55.5   50.5   2.01   unstab (Kontrolle 53.7)   | P1 12s/+23.6/8s P2 10s/+16.5/5s → 4.46 %/s
Zustand trocken: Gewinn effW 4.46 %/wirksame s aus 1 Fenster
Zustand nass: nicht aufgezeichnet (Sensor zum Schluss ins nasse Substrat oder Wasserglas)
Vorschlag: lrn.effW 4.46 (Mittel aus 1 Fenster, Skala % je Sekunde nach tRise aus den Konsolenzeilen) · cfg4.tDead2 5 s (Median tRise der Folgeportionen) · cfg3.tDead 8 s (tRise der Erstportion; gilt für DIESEN Schlauch – im Endaufbau per mess nachmessen)
Schreiben (nur im Normalbetrieb, mischt effW mit dem vorhandenen Wert α 0,5): node tools/hwtest.js <ip> kal write [datei]
```

`kal write` at 16:06 reported the four changes like this (the lines `vorher:`/`nachher:` – before/after – with the full `lrn`/`cfg4` content are left out here; the note lines are produced by the calculation core `tools/lib/kal.js` from the same recording):

```text
  lrn.effW null → 4.46 (Messwert)
  cfg4.tDead2 8 → 5 s
  cfg3.tDead 20 → 8 s (tRise der Erstportion; Endaufbau mit anderem Schlauch: mess)
  cfg3.tMin 25 → 10 s (max(tPmin, tDead + 2))
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Times in the protocol do not match the file names in `docs/kal/` (`…-13-50-…` versus 15:50) | file names and the `start` field in the JSON files are UTC; console, status line and protocol are local time (Europe/Vienna) | write local time in the protocol, quote file names verbatim, add two hours (summer time) when comparing |
| `kal report` shows `effW 2.01` and `tDead ≈ 12 s` instead of 4.46 and 8 s | no `bw_pump` console lines in the recording (recorder older than `hwtest.js` 0.1.2 or debug websocket off) – the report calculates on the profile scale | `kal report <json> <log>` with the `watch` log file; only then `kal write`; check the websocket before the next `kal` (`preflight`) |
| Heap numbers contradict each other (24,920 versus 25,200, 7.4 KB versus 16,380) | idle and peak are different moments; `Script.GetStatus` only measures the instant | note `mem_used`/`mem_peak` during the run from the `watch` status line, `mem_free` idle separately, each with the script version |
| The first console line of a script is missing from the log | `console.js` or `watch` was connected only after `Script.Start` | connect the console before the start – `console.js <ip> 900 <id>` starts the script itself |
| `Schedule.Create '…': Invalid argument 'timespec'` noted as an error | the first `Schedule.Create` per installer run usually failed on 12/13 Sep 2026 (firmware quirk), the installer retries silently – not visible in the console with `DEBUG = 0` | only a second rejection (`Hinweis: Schedule.Create …`) is a finding; double-check the timespec with curl |
| Test row marked as done although only the mock ran | mock test and device run mixed up | "State" column: "device <date>" only with console, status line or RPC response as evidence; otherwise "mock: <test file>" |
| `preflight` reports "Script 2 bw_main läuft" (running) during the fast-forward run | in the fast-forward profile `bw_main` runs every 3 min for 5–8 s | call again; not a finding. If `out_of_memory` appears in the status line, run `normal` immediately |
| `Timer 1 handle not found` or `PCS write interval < 60s` in the log | firmware notices: `Timer.clear` from its own callback, counter write of the switch for portions less than 60 s apart | do not record as an error; the reference for crashes is `Script.GetStatus.errors` |

## Next

- [12 · First commissioning](12-erstinbetriebnahme.md) – drive the open windows 2–4 and the calibration states medium moist and wet.
- [18 · Lessons from the device](18-lernlog-geraet.md) – cause, fix and rule for every finding from these runs.
- [17 · Stage and decision log](17-etappen-und-entscheidungslog.md) – which decision followed from which device run.
