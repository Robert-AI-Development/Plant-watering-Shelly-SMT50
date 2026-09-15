# 11 · Hardware check (bw_hwtest, bw_hwpump)

[Deutsch](../de/11-hardware-check.md) · **English** — [Handbook](README.md) · Part D "Operate"

> **At a glance**
> - Outcome: temperature probe, soil-moisture sensor, float switch and pump are verified on the finished setup; `cfg1.vDry`, `cfg1.vWet` and `cfg1.lvlEmpty` are measured and written.
> - Scope: two test scripts, driven as an interview with `tools/hwtest.js` – a sensor test in six phases (532 s on 13 Sep 2026) and a pump test with one portion of <!-- hwt:pumpSec -->30<!-- /hwt --> s in two passes.
> - Key numbers: timeout per phase <!-- hwt:tPhase -->900<!-- /hwt --> s, for the whole run <!-- hwt:tAll -->3600<!-- /hwt --> s; the pump test does not start within ± <!-- hwt:winMin -->25<!-- /hwt --> min of 08:00, 20:00 and midnight.
> - Biggest pitfall: the script heap (~25 KB) is shared – `bw_pump` has to run alone, hence the two passes; and the test scripts cost flash, so delete them after the test.

## Prerequisites

- Installer has run ([06 · Start guide](06-startanleitung.md)): `cfg1` must contain `vDry`, `vWet`, `vErrLo`, `vErrHi`, `lvlEmpty`, `nLvl`, `idV`, `idT`, `idLvl`, `idSw`, otherwise `bw_hwtest` aborts with `cfg1.<field> fehlt – Installer zuerst` (field missing – run the installer first). The Shelly's clock must be set (NTP).
- Input 1 (water level) enabled and of type `switch`; `preflight` reports a blocker otherwise, `input-on` changes it.
- Node ≥ 22 on a computer that can reach the Shelly – directly on the LAN ([08](08-installation-lokaler-server.md)) or through the tunnel ([09](09-installation-vps.md)). The debug websocket must be on, otherwise `watch` shows no console lines (web UI → open the console; `preflight` warns).
- `npm run build` executed so that `dist/bw_hwtest.js` and `dist/bw_hwpump.js` are current.
- At the setup: ice water or cold tap water (≤ <!-- hwt:tLo -->20<!-- /hwt --> °C), warm water or the warmth of your hand (≥ <!-- hwt:tHi -->30<!-- /hwt --> °C), a glass of water for the SMT50, a cloth, a bucket for the pump hose, water tank full. The float switch must be movable by hand into both positions.
- Immerse only the metal sleeve of the DS18B20 and the sensor body of the SMT50; plugs and cables stay dry.
- Time guard: do not start within the <!-- hwp:winMin -->25<!-- /hwp --> minutes around 08:00, 20:00 or midnight – the pump test would wait. `preflight` already warns when a window is less than 30 min away.

## Diagram

[![Hardware check as an interview: sensor test in six phases, pump test in two passes, emergency stop](../diagramme/en/11-hardware-check.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/11-hardware-check.html)

Interactive version (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Sensor test in six phases", 2 "Pump test in two passes", 3 "Emergency stop and restart".

## How the check runs

Two additional scripts verify the setup step by step: `bw_hwtest` (version <!-- fact:ver.bw_hwtest -->0.1.0<!-- /fact -->) the three sensors, `bw_hwpump` (version <!-- fact:ver.bw_hwpump -->0.1.0<!-- /fact -->) the pump – through `bw_pump`, exactly as in normal operation. Both run **by hand only**, never in the schedule, and are long runners: in each phase they wait until the physical state is there.

They are driven from the computer with `tools/hwtest.js` (version <!-- fact:ver.hwtest -->0.1.2<!-- /fact -->) as an interview: the script prints the instruction on the console, you (or Claude through the tunnel, [10 · Installation with Claude Code](10-installation-claude-code.md)) set up the phase and release it with `go`. Commands travel through the KVS entry `hwc`; the state is always available in `hwr` (sensor test) and `hwp` (pump test).

```bash
npm run build                                            # dist/ up to date
node tools/hwtest.js <ip> preflight hw                   # time, scripts, input 1, output, KVS; creates bw_hwtest/bw_hwpump, prints the upload commands with IDs
node tools/put-script.js <ip> <id> dist/bw_hwtest.js     # upload in chunks, byte-identical check, flash check
node tools/put-script.js <ip> <id> dist/bw_hwpump.js
node tools/hwtest.js <ip> input-on                       # only if preflight reports input 1 as disabled
node tools/hwtest.js <ip> start bw_hwtest 20             # start the sensor test, follow for 20 s
node tools/hwtest.js <ip> watch 120                      # console + status line; repeat as often as you like
node tools/hwtest.js <ip> go                             # release the waiting phase (also: skip, abort)
node tools/hwtest.js <ip> start bw_hwpump 20             # pump test pass A; then go
node tools/hwtest.js <ip> watch 240                      # waits for bw_pump and starts pass B by itself
node tools/hwtest.js <ip> report                         # reports from hwr/hwp with cfg1 comparison
node tools/hwtest.js <ip> cleanup                        # delete hwc/hwb1/hwb2 (hwt, hwr, hwp stay as evidence)
node tools/hwtest.js <ip> delete bw_hwtest               # free flash; likewise delete bw_hwpump
```

The device assigns the script IDs: `preflight hw` creates missing test scripts with `Script.Create` and prints the complete upload command with ID for each; `hwtest.js <ip> scripts` shows the list at any time. Afterwards: sensors back into the pot, float switch to FULL, fill the tank.

> **Caution (water/mains):** The pump test pumps <!-- hwt:pumpSec -->30<!-- /hwt --> s into the bucket. Stay there, the hose lies securely, the tank is full. Emergency stop: `node tools/hwtest.js <ip> stop` or switch OUT1 off in the web UI.

## Sensor test bw_hwtest

### Six phases

Every second (`msTick`) the script reads the input (for the change counter) and the sensor of the current phase, prints one console line every <!-- hwt:nLog -->5<!-- /hwt --> ticks and polls the command channel every <!-- hwt:nCmd -->2<!-- /hwt --> ticks. Each phase ends when its criterion is met – or with a timeout after `tPhase` (<!-- hwt:tPhase -->900<!-- /hwt --> s).

| Phase | Instruction at the setup | Ends when |
| --- | --- | --- |
| t1 | probe sleeve into cold water | `nStab` (<!-- hwt:nStab -->5<!-- /hwt -->) consecutive readings ≤ `tLo` (<!-- hwt:tLo -->20<!-- /hwt --> °C) |
| t2 | probe into warm water or into your hand | `nStab` consecutive readings ≥ `tHi` (<!-- hwt:tHi -->30<!-- /hwt --> °C) |
| m1 | SMT50 out of the pot, wipe it, hold it dry in the air, then `go` | after `go`: `nStab` values with a spread ≤ `dV` (0.03 V), mean ≤ `vDryMax` (0.5 V) and ≥ `vErrLo` + 0.05 V → dry point |
| m2 | sensor upright into the glass of water up to the mark (no `go`) | `nStab` stable values, mean ≥ `vWetMin` (2.5 V) and ≤ `vErrHi` − 0.1 V → wet point |
| l1 | move the float switch once, then hold it in the EMPTY position, `go` | after `go`: at least one observed input change and `nLvl` (<!-- def:cfg1.nLvl -->3<!-- /def -->) identical readings → `lvlEmpty` |
| l2 | hold the float switch at FULL, `go` | `nLvl` identical readings, different from l1 |

As long as a criterion does not match, the script says once what is missing – with the measured value in parentheses:

| Message | Phase | Meaning / fix |
| --- | --- | --- |
| `Sensor nicht trocken (0.62 V > 0.5) – abtrocknen, warten` (sensor not dry – dry it, wait) | m1 | mean above `vDryMax`: wipe the sensor, hold it in the air, wait |
| `Spannung zu niedrig (0.12 V) – Sensor angeschlossen?` (voltage too low – sensor connected?) | m1 | mean below `vErrLo` + 0.05 V: check the plug and cable of the SMT50 |
| `Spannung zu hoch (3.3 V) – Verdrahtung/Messbereich prüfen` (voltage too high – check wiring/range) | m2 | mean above `vErrHi` − 0.1 V: check the wiring and the voltmeter's range |
| `noch kein Wechsel am Eingang gesehen – Schwimmer bewegen, dann LEER halten` (no input change seen yet – move the float, then hold EMPTY) | l1 | no input change since the start: flip the float switch once, then hold EMPTY |
| `Eingang zeigt noch LEER (1) – Schwimmer auf VOLL` (input still shows EMPTY – float to FULL) | l2 | input as in l1: bring the float switch to FULL |

A `go` in a phase that is not waiting for it is reported and discarded.

### Result codes and selection with hwt.run

| Code | Meaning |
| --- | --- |
| `ok` | criterion met |
| `sk` | skipped (`skip`, or the phase group is not in `hwt.run`) |
| `to` | timeout `tPhase` |
| `ab` | abort (`abort` or total time `tAll` exceeded); the run jumps to the report |
| `nl` | sensor delivers `null` for <!-- hwt:nNull -->10<!-- /hwt --> ticks – check probe, cable or component |

`hwt.run` selects phase groups: `"tml"` (default) is temperature, moisture and water level; `node tools/hwtest.js <ip> cfg run='"m"'` runs only m1/m2, for example for a new calibration after a sensor swap. Skipped phases appear as `sk` in the state. A note `t1:sofort` (immediately) in the report means the phase finished within the first `nStab` ticks – the state was already there.

### Calibration values into cfg1

At the end the script checks the measurements for plausibility and writes them to `cfg1` (read-modify-write on a freshly read entry, only when something changed):

- `vDry`/`vWet`: only if m1 and m2 are `ok` and the wet point is at least 1 V above the dry point; otherwise the note `cal:vWet-vDry<1V`.
- `lvlEmpty`: only if l1 and l2 are `ok` and EMPTY ≠ FULL.
- Switch `hwt.cal` (default <!-- hwt:cal -->1<!-- /hwt -->): `0` only reports (`(nur melden)` on the console) and writes nothing.

Old and new values are in `hwr.cal` as `old>new;old>new;old>new` (vDry, vWet, lvlEmpty). The report comes as five console lines, one per tick, because print bursts get lost on the debug websocket. What the values mean and how the target band is added: [12 · First commissioning](12-erstinbetriebnahme.md).

## Pump test bw_hwpump in two passes

The pump test **never switches the pump on itself**. It writes a job and starts `bw_pump`, which works with `toggle_after`, `auto_off` and the water-level check exactly as in a watering window ([04 · Safety and limits](04-sicherheit-und-grenzen.md)). Because the script heap is shared, the test script stops before the pump run and comes back afterwards for the evaluation – recognisable from the KVS: without the backup `hwb1`/`hwb2` a start is pass A, with the backup it is pass B.

### Pass A: release, time guard, backup, job

1. Pre-check without waiting: `bw_pump` must exist on the device, at most one other script may be running, and the fault `noeff` must not be set – otherwise p0 ends immediately with `fe` (blocked).
2. Phase p0 waits for `go` (tank full, hose end in the bucket, you stay there). The console shows `p0 sw=0 lvl=0 t=25s (warte auf go)` (waiting for go) every `nLog` (<!-- hwp:nLog -->5<!-- /hwp -->) ticks.
3. After `go` the time guard applies: not in the first `guardS` (<!-- hwp:guardS -->90<!-- /hwp -->) seconds of a quarter-hour cycle and not in its last `guardS` + `pumpSec` seconds (with 30 s of pumping: after second 780), not within ± `winMin` (<!-- hwp:winMin -->25<!-- /hwp -->) minutes of `winA`, `winB` and 00:00. The script reports `warte: takt` (waiting: cycle), `warte: fenster` (window) or `warte: uhr` (clock) and keeps checking. The cycle is fixed at 15 min in the script – that is why the pump test runs only in normal operation, not in fast-forward.
4. Then the preconditions: output off (`Ausgang EIN – ausschalten` = output ON, switch it off), water level readable, `nLvl` identical readings and not EMPTY (`Wasserstand LEER – füllen` = water level EMPTY, fill up).
5. Re-read the KVS, back up: `st` and `day` to `hwb1`, `job`, `err` and `lrn` to `hwb2` (two keys, because one entry holds at most 253 characters). If the backup fails, A ends without a pump run (p1 `fe`).
6. Clear the way for the run: `err` to no fault, reset `day` if the daily limit `maxDay` is reached, write the job `job = {ok:true, sec:pumpSec, pct:null, why:"hwtest"}`. `pct:null` tells `bw_pump`: single portion without measurement and without a learning value.
7. `Script.Start bw_pump`, write the state `hwp.s = "pumpt"` (pumping), `Script.Stop` on its own ID: `fertig r=ok,-,-,-` (done).

`pumpSec` comes from `hwt` (default <!-- hwp:pumpSec -->30<!-- /hwp --> s) and is capped at `cfg3.tMax` (<!-- def:cfg3.tMax -->180<!-- /def --> s). Different duration: `node tools/hwtest.js <ip> cfg pumpSec=10`.

### bw_pump: one portion

`bw_pump` sees a job without `pct` and runs as a single portion: no fresh measurement, no lock `laeuft` (running), no learning value. It checks the water level (`nLvl` identical readings), switches on with `toggle_after` for `clamp(job.sec, 1, min(tPmax, tMax))` seconds – with `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> and `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> exactly the 30 s – and checks float switch and output every `tChk` (<!-- def:cfg3.tChk -->5<!-- /def -->) s. Result in the KVS: `st.state = gegossen` (watered), `st.sec = 30`, `day.n + 1`, `job.ok = false`, `job.why = ok`.

### Pass B: comparison, restore, report

`hwtest.js watch` starts B by itself as soon as `bw_pump` is no longer running (at most two attempts); while `bw_pump` is still running, `watch` waits 5 s. B reads the KVS, compares with the job and restores:

| Code | ok when | otherwise |
| --- | --- | --- |
| p1 | `bw_pump` has recorded a watering (`st.ts` after the start of A) | `fe`, p2 becomes `sk` |
| p2 | output off after `bw_pump` finished | `aw` – B switches it off (`Sicherheits-Aus`, safety off) |
| p3 | `st.state = gegossen`, `st.sec = pumpSec`, `job.ok = false`, `job.why = ok` | `aw` (deviation) |

Restore: `st`/`day` back from `hwb1`, `job`/`err`/`lrn` back from `hwb2`, `job.ok` always `false`, `hwp.s = "ende"` (finished), delete the backup – only changed entries are written. Normal operation notices nothing of the test: no pause, no daily counter, no learning value, no surviving test job. The report is two lines: `Bericht 1/2 p0 ok | p1 ok | p2 ok | st=gegossen sec=30 why=ok | p3 ok` and `Bericht 2/2 Ende mit Rückbau rec=0 …` (end with restore).

If B starts without A having ended regularly (state not `pumpt`), the report shows `rec=1` (restart). If B reports `bw_pump läuft noch – später erneut starten` (bw_pump still running – start again later), the backup stays; `watch` or another `start bw_hwpump` catches up on B.

## Command channel hwc and the tool hwtest.js

`hwtest.js` writes `go`, `skip` and `abort` as a counter into the KVS key `hwc` (`{n, cmd}`). The script processes only an `n` greater than the last one seen – old commands never act, `start` resets `n` to 0. `skip` ends the phase with `sk`, `abort` ends the run with `ab`. Alternatives such as `Script.Eval` were rejected because the KVS is visible everywhere and reproduced in the mock (decision 22, [17 · Stage and decision log](17-etappen-und-entscheidungslog.md)).

| Command | What it does |
| --- | --- |
| `preflight [hw]` | time, seconds until the next `bw_main` cycle, distance to `winA`/`winB`/midnight, debug websocket, running scripts, input 1, output, sensors, `err`/`job`/`day`/`hwt`, old backup `hwb1`/`hwb2`. Creates `bw_zeitraffer`, with `hw` also `bw_hwtest`/`bw_hwpump`, and prints the upload commands. Exit 1 on blockers |
| `scripts` | all scripts with size on the device, running, `mem_peak`, errors; `fs_free`, `ram_free`, free script heap |
| `delete <id\|name>` | delete a script with `Script.Delete`, `fs_free` before/after; refuses `bw_install`, `bw_main`, `bw_pump`, `bw_zeitraffer` and running scripts |
| `input-on` | `Input.SetConfig` input `cfg1.idLvl` to `enable: true, type: "switch"` – the tool's only configuration change |
| `cfg k=v …` | set fields in `hwt`, values as JSON: `cfg tLo=21 pumpSec=10 run='"m"'`; refuses if `hwt` would exceed 253 characters |
| `start <name> [sec]` | write `hwc {n:0}`, delete the old report (`hwr` or `hwp`), connect the console, `Script.Start`, then `watch` for `sec` s (default 60) |
| `watch [sec]` | console over the debug websocket plus a status line from `hwr`/`hwp` every 5 s (printed only on change); starts pass B; ends when no test script is running any more, otherwise after `sec` (default 120, at most 300) |
| `go` / `skip` / `abort` | command to the running script (`hwc` with `n + 1`) |
| `status` | one-liner: running scripts, sensors, output, state from `hwr` and `hwp` |
| `report` | `hwr`/`hwp` readable with plain text per code and comparison with `cfg1` |
| `restore` | write `hwb1`/`hwb2` back to `st`/`day`/`job`/`err`/`lrn`, `job.ok = false`, delete the backup – only while `bw_hwpump` is not running |
| `cleanup` | delete `hwc`, `hwb1`, `hwb2`; `hwt`, `hwr`, `hwp` stay as evidence |
| `stop` | emergency stop: `Script.Stop` for `bw_hwtest`, `bw_hwpump`, `bw_zeitraffer` and `bw_pump`, then `Switch.Set {on:false}` |

`zeitraffer`, `normal`, `mess` and `kal` belong to first commissioning ([12](12-erstinbetriebnahme.md)); the complete tool reference is in [14 · Debugging and testing](14-debuggen-und-testen.md).

## KVS entries of the hardware test

All values are JSON strings like the other entries ([03 · Configuration](03-konfiguration.md)). The script creates `hwt` with defaults if the entry is missing; missing fields count as default.

| Field in `hwt` | Default (JSON) | Effect |
| --- | --- | --- |
| `tLo` / `tHi` | <!-- hwt:tLo -->20<!-- /hwt --> / <!-- hwt:tHi -->30<!-- /hwt --> | thresholds in °C for t1 / t2 |
| `vDryMax` / `vWetMin` | <!-- hwt:vDryMax -->0.5<!-- /hwt --> / <!-- hwt:vWetMin -->2.5<!-- /hwt --> | limits in V for dry / wet point |
| `dV` | <!-- hwt:dV -->0.03<!-- /hwt --> | spread in V up to which `nStab` values count as stable |
| `nStab` | <!-- hwt:nStab -->5<!-- /hwt --> | number of matching ticks per criterion |
| `nNull` | <!-- hwt:nNull -->10<!-- /hwt --> | ticks without a value, then code `nl` |
| `msTick` | <!-- hwt:msTick -->1000<!-- /hwt --> | tick in ms (read sensors) |
| `nCmd` / `nLog` | <!-- hwt:nCmd -->2<!-- /hwt --> / <!-- hwt:nLog -->5<!-- /hwt --> | ticks per command poll / per console line |
| `tPhase` / `tAll` | <!-- hwt:tPhase -->900<!-- /hwt --> / <!-- hwt:tAll -->3600<!-- /hwt --> | timeout per phase / per run in s |
| `pumpSec` | <!-- hwt:pumpSec -->30<!-- /hwt --> | pumping time of the test in s, at most `cfg3.tMax` |
| `tOn` | <!-- hwt:tOn -->20<!-- /hwt --> | reserved – no script reads it |
| `guardS` / `winMin` | <!-- hwt:guardS -->90<!-- /hwt --> / <!-- hwt:winMin -->25<!-- /hwt --> | time guard: distance to the cycle in s / to the windows in min |
| `cal` | <!-- hwt:cal -->1<!-- /hwt --> | 1 = write calibration values to `cfg1`, 0 = report only |
| `run` | <!-- hwt:run -->"tml"<!-- /hwt --> | phase groups t, m, l |

| Entry | Fields | Meaning |
| --- | --- | --- |
| `hwc` | `n` counter · `cmd` `go` / `skip` / `abort` | command to the running script |
| `hwr` | `s` `lauf` (running) / `ende` (finished) / `abbruch` (aborted) · `t` [min, max] °C · `m` [vDry, vWet] · `l` [empty, full] · `chg` input changes · `r` codes t1…l2 · `cal` old>new · `n` notes · `mem` smallest `ram_free` · `dur` s · `w` writes · `run` start time | state and report of the sensor test; if the entry gets longer than 253 characters, the notes are dropped |
| `hwp` | `s` `lauf` / `pumpt` (pumping) / `ende` / `abbruch` · `pumpSec` · `sec` recorded by `bw_pump` · `st`, `why` · `r` codes p0…p3 · `rec` 1 = restart · `mem`, `dur`, `w`, `run` | state and report of the pump test |
| `hwb1` | copies of `st` and `day` | backup between pass A and B |
| `hwb2` | copies of `job`, `err` and `lrn` | backup between pass A and B |

## Memory and flash

The Shelly's script heap (`Script.GetStatus.mem_free`, 24 920 bytes when idle) is shared by all scripts. A waiting test script releases its KVS objects (`K = {}; orig = {}`) and re-reads before writing; this way `bw_hwpump` occupies 9 044 and `bw_hwtest` 9 576 bytes, and `bw_main` keeps running on its cycle next to it (5 404 bytes when parsed).

`bw_pump` needs a peak of more than 15.8 KB when reading the KVS a second time with the test entries, and it died next to a 9 KB script with `out_of_memory` (visible in `Script.GetStatus.errors`; `hwtest.js scripts` shows it). Hence the pump test in two passes. Details, measurements and the rule "never two large scripts at the same time": [18 · Lessons from the device](18-lernlog-geraet.md).

> **Measured on the device (13 Sep 2026):** flash `fs_free` 12 288 bytes with seven scripts → 49 152 bytes after `engine_probe`, `bw_hwtest` and `bw_hwpump` had been deleted (≈ 36 KB, LittleFS counts in 4 KB blocks). Compact sizes are `bw_hwtest` <!-- fact:dist.bw_hwtest -->13952<!-- /fact --> bytes and `bw_hwpump` <!-- fact:dist.bw_hwpump -->14500<!-- /fact --> bytes (limit <!-- fact:size_limit -->16000<!-- /fact -->). Before an upload `put-script.js` checks `fs_free` + old code ≥ new file + 4 096.

The test scripts should therefore stay on the device only as long as they are needed: after the test `delete bw_hwtest` and `delete bw_hwpump`; `preflight hw` creates them again when needed. Nobody sets `enable` for them – they are not in the schedule and start by hand only.

## Emergency stop, restart, tunnel loss

- **Emergency stop:** `node tools/hwtest.js <ip> stop` stops `bw_hwtest`, `bw_hwpump`, `bw_zeitraffer` and `bw_pump` and switches the output off; OUT1 in the web UI does the same. Even without a script a portion ends at the latest with `toggle_after` and `auto_off`.
- **Restore after an abort:** if `hwb1`/`hwb2` are still in the KVS afterwards, `restore` brings back the old state (only while `bw_hwpump` is not running); only then `cleanup`. A test job is set to `job.ok = false` in the process.
- **Restart:** a start of `bw_hwpump` with an existing backup is automatically pass B (`rec=1` in the report) – `bw_pump` must have finished. On an exception in the test script, `fail()` switches a running pump off and stops; the restore follows on the next start.
- **Tunnel loss:** if the SSH connection drops, the script continues autonomously on the device. Every phase ends at the latest after `tPhase` (<!-- hwt:tPhase -->900<!-- /hwt --> s) with `to`, the whole run after `tAll` (<!-- hwt:tAll -->3600<!-- /hwt --> s) with `ab`. The state is in `hwr`/`hwp` and can be read after reconnecting with `status` or `report`; `watch` reconnects the websocket automatically and survives RPC errors.

## Example output

Sensor test in the mock with the virtual operator (`node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo`), shortened – on the device the lines look the same, only with real values:

```text
[bw_hwtest 0.1.0] Start run=tml | V=ok T=ok IN=ok | V=0.42 T=23.9 lvl=0
[bw_hwtest 0.1.0] Phase 1/6 t1: Fühler abkühlen auf <= 20 °C (Timeout 900 s)
[bw_hwtest 0.1.0] t1 23.41 °C t=4s
[bw_hwtest 0.1.0] t1 20.96 °C t=14s
[bw_hwtest 0.1.0] Phase t1: ok (19 °C, min 19, max 23.9) nach 22 s
[bw_hwtest 0.1.0] Phase 3/6 m1: Sensor trocken in Luft (<= 0.5 V), dann go (Timeout 900 s)
[bw_hwtest 0.1.0] m1 0.21 V t=14s (warte auf go)
[bw_hwtest 0.1.0] Kommando go (n=1)
[bw_hwtest 0.1.0] Phase m1: ok (0.21 V, min 0.21, max 0.42) nach 18 s
[bw_hwtest 0.1.0] Phase 5/6 l1: Schwimmer bewegen, dann auf LEER halten und go (Timeout 900 s)
[bw_hwtest 0.1.0] Phase l1: ok (1, min 0, max 1) nach 8 s
[bw_hwtest 0.1.0] Kalibrierung: 0.2>0.21;3.13>3.1;1>1
Bericht 1/5 Komponenten: V=ok T=ok IN=ok | Vermerke: -
Bericht 2/5 Temperatur: t1 ok min=19 °C | t2 ok max=31 °C
Bericht 3/5 Feuchte: m1 ok vDry=0.21 V | m2 ok vWet=3.1 V | cfg1 0.2>0.21;3.13>3.1;1>1 geschrieben
Bericht 4/5 Wasserstand: l1 ok leer=1 | l2 ok voll=0 | Wechsel=2 | lvlEmpty geschrieben
Bericht 5/5 Ende: dauer=105 s w=8 ram_min=120000 – Sensoren zurück in den Topf, Schwimmer auf VOLL? Pumpentest: bw_hwpump
[bw_hwtest 0.1.0] fertig ende r=ok,ok,ok,ok,ok,ok dauer=111040ms
```

`Phase 1/6 t1: Fühler abkühlen auf <= 20 °C` = phase 1/6 t1: cool the probe down to ≤ 20 °C; `Kommando go` = command go; `Kalibrierung` = calibration; `Bericht` = report (`Komponenten` components, `Temperatur`, `Feuchte` moisture, `Wasserstand` water level, `Vermerke` notes, `Wechsel` changes, `geschrieben` written); `fertig ende` = done, finished.

Status line of `watch` during m2 (format of the tool, values from the mock run; `läuft` = running, `lauf` = running):

```text
[status 10:08] läuft: bw_hwtest | V=1.944 tC=31.0 lvl=false sw=aus | hwr: lauf t1:ok t2:ok m1:ok m2:- l1:- l2:- | hwp: -
```

Pump test in the mock (pass A, `bw_pump` alone, pass B):

```text
[bw_hwpump 0.1.0] Start Durchgang A (Freigabe + Start) pumpSec=30 sw=0 lvl=0 err=cfg
[bw_hwpump 0.1.0] bw_pump id=3 andere=0
[bw_hwpump 0.1.0] Phase p0: Behälter voll, Schlauch im Eimer, dann go (30 s über bw_pump, Timeout 900 s)
[bw_hwpump 0.1.0] cmd go n=1
[bw_hwpump 0.1.0] p0 sw=0 lvl=0 t=5s
[bw_hwpump 0.1.0] Phase p0: ok nach 7 s
[bw_hwpump 0.1.0] bw_pump gestartet – Durchgang B nach dessen Ende (tools/hwtest.js watch)
[bw_hwpump 0.1.0] fertig r=ok,-,-,- dauer=7280ms
[bw_pump 0.2.0] Fenster: Auftrag 30 s, pct null, Einzelportion, Frist 420 s
[bw_pump 0.2.0] P1 aus: ok nach 30 s
[bw_pump 0.2.0] ergebnis=ok n=1 sec=30 dur=31 pct=null→null effW=null sf=0.7 day.n=1 err=null w=3 dauer=33340
[bw_hwpump 0.1.0] Start Durchgang B (Ergebnis + Rückbau) pumpSec=30 sw=0 lvl=0 err=null
[bw_hwpump 0.1.0] bw_pump id=3 andere=0
[bw_hwpump 0.1.0] bw_pump: st=gegossen sec=30 why=ok err=null → ok
[bw_hwpump 0.1.0] Rückbau schreibt st,day,job,err,hwp löscht hwb1,hwb2
Bericht 1/2 p0 ok | p1 ok | p2 ok | st=gegossen sec=30 why=ok | p3 ok
Bericht 2/2 Ende mit Rückbau rec=0 dauer=0 s w=5 ram_min=120000
[bw_hwpump 0.1.0] fertig r=ok,ok,ok,ok dauer=3080ms
```

`Durchgang A (Freigabe + Start)` = pass A (release + start); `Phase p0: Behälter voll, … dann go` = tank full, hose end in the bucket, then go; `bw_pump gestartet – Durchgang B nach dessen Ende` = bw_pump started – pass B after it ends; `Fenster: Auftrag 30 s, pct null, Einzelportion, Frist 420 s` = window: job 30 s, pct null, single portion, deadline 420 s; `P1 aus: ok nach 30 s` = P1 off: ok after 30 s; `ergebnis` = result; `Ergebnis + Rückbau` = result + restore; `Rückbau schreibt … löscht …` = restore writes … deletes …; `Ende mit Rückbau` = end with restore.

`node tools/hwtest.js <ip> report` with the KVS entries of these runs (`Sensoren` sensors, `Pumpe` pump, `Temperatur`, `Feuchte trocken/nass` moisture dry/wet, `Wasserstand leer/voll` water level empty/full, `Kalibrierung` calibration, `Auftrag … s, bw_pump hat … s eingetragen` = job … s, bw_pump recorded … s):

```text
== bw_hwtest (Sensoren) – ende, 105 s, ram_min 120000, Vermerke: -
  t1 ok
  t2 ok
  m1 ok
  m2 ok
  l1 ok
  l2 ok
  Temperatur min 19.0 °C, max 31.0 °C
  Feuchte trocken 0.210 V, nass 3.100 V | cfg1 jetzt vDry=0.21 vWet=3.1 | Kalibrierung 0.2>0.21;3.13>3.1;1>1
  Wasserstand leer=1 voll=0 Wechsel=2 | cfg1 jetzt lvlEmpty=1
== bw_hwpump (Pumpe) – ende, 0 s, ram_min 120000
  p0 ok
  p1 ok
  p2 ok
  p3 ok
  Auftrag 30 s, bw_pump hat 30 s eingetragen, st=gegossen why=ok
```

> **Measured on the device (13 Sep 2026):** sensor test all six phases `ok` in 532 s – probe 19.8 °C in ice water and 33.5 °C in warm water or hand, dry point 0.296 V, wet point 3.134 V, so `cfg1.vDry` 0.20 → 0.296 and `vWet` 3.13 → 3.134 written automatically; float switch EMPTY = 1, FULL = 0 (8 changes observed), `lvlEmpty` 1 confirmed; `ram_free` at least 125 424. Pump test: pass A 26 s (phase p0 `ok` after 19 s), `bw_pump` 30 s, pass B `ok,ok,ok,ok`, KVS byte-identical to the state before the test afterwards. Protocol: [19 · Device test protocol](19-pruefprotokoll.md).

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `cfg1.vErrLo fehlt – Installer zuerst` at start | installer has not run (again), `cfg1` incomplete | start `bw_install` ([06](06-startanleitung.md)), then restart the test |
| code `nl`, console `Sensor liefert null – Fühler/Kabel/Komponente prüfen` (sensor delivers null) | component delivers no value for `nNull` (<!-- hwt:nNull -->10<!-- /hwt -->) ticks: probe or cable disconnected, peripheral not created, wrong ID in `cfg1.idV`/`idT`/`idLvl` | check wiring and peripherals ([05](05-verkabelung-und-aufbau.md)); read the start line `V=ok T=ok IN=ok`; skip the phase with `skip` |
| code `to` after `tPhase` (<!-- hwt:tPhase -->900<!-- /hwt --> s) | state not reached: water not cold or warm enough, sensor not dry, `go` forgotten | adjust the threshold (`cfg tLo=21`), dry the sensor, send `go`; repeat a single group (`cfg run='"m"'`) |
| `go ignoriert: Phase t1 wartet nicht auf go` (go ignored: phase does not wait for go) | `go` in a phase without release | nothing to do – t1, t2 and m2 end by themselves once the value is stable |
| command does not arrive | `hwc.n` not greater than the last one seen (e.g. `hwc` written by hand with an old `n`) or the script is not polling right now | use `hwtest.js go` (counts up); `status` shows whether the script is running |
| `Kalibrierung … nicht übernommen: vWet-vDry<1V` (calibration not applied) | wet point not 1 V above the dry point: sensor not deep enough in the water or not dry in m1 | repeat m1/m2 (`cfg run='"m"'`), if necessary write the values to `cfg1` by hand ([12](12-erstinbetriebnahme.md)) |
| p0 immediately `fe` | `bw_pump` missing, more than one other script running, or fault `noeff` set | `preflight hw`, `scripts`; clarify `noeff` and delete `err` ([13](13-betrieb-und-wartung.md)) |
| p0 stays at `warte: takt` / `warte: fenster` / `warte: uhr` | time guard: start or end of the quarter-hour cycle, ± `winMin` (<!-- hwp:winMin -->25<!-- /hwp --> min) around a window or midnight, clock not set | wait – the script keeps checking until `tPhase`; start outside the windows; check NTP |
| `Ausgang EIN – ausschalten` / `Wasserstand LEER – füllen` | precondition for the pump run missing | `stop` switches off; fill the tank, float switch to FULL |
| p2 or p3 `aw` | output still ON after `bw_pump` (B switches it off) or `st`/`job` do not match, e.g. `why=wasser` (tank empty), `extern` (switched externally), `alt` (job too old) | read the `ergebnis=` line of `bw_pump`, fix the cause, repeat the test |
| `bw_pump läuft noch – später erneut starten` | pass B too early | call `watch` again – it starts B as soon as `bw_pump` has finished |
| `hwb1`/`hwb2` remain | abort between A and B (`stop`, tunnel, exception) | `start bw_hwpump` (becomes pass B, `rec=1`) or `restore`; then `cleanup` |
| `watch` shows status lines but no console | debug websocket off | web UI → open the console or `Sys.SetConfig debug.websocket.enable`; `preflight` warns about it |
| `bw_main` or `bw_pump` with `out_of_memory` in `scripts` | second large script next to the test script | only one test script at a time; pump test only through the two passes |
| `put-script.js` refuses the upload | flash `fs_free` too small | `delete engine_probe` or unused test scripts; `scripts` shows `fs_free` |

## Next

- [12 · First commissioning](12-erstinbetriebnahme.md) – enter the target band with the measured `cfg1` values, run the fast-forward and watch the first window.
- [14 · Debugging and testing](14-debuggen-und-testen.md) – mock with the virtual operator, console, complete tool reference.
- [19 · Device test protocol](19-pruefprotokoll.md) – the measurements of 13 Sep 2026 and the template for the next run.
- [17 · Stage and decision log](17-etappen-und-entscheidungslog.md) – design decisions 21–28 for the hardware test: dedicated test scripts, command channel `hwc`, pump only through `bw_pump`, time guard, backup and restore, automatic calibration, `Script.Start` in the mock, two passes.
