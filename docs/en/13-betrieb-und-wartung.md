# 13 · Operation and maintenance

[Deutsch](../de/13-betrieb-und-wartung.md) · **English** — [Handbook](README.md) · Part D "Operate"

> **At a glance**
> - Day to day, the console line of `bw_main` is enough (one per cycle, every <!-- def:cfg3.tick -->15<!-- /def --> min): `why` says why the device waters or not, `err` whether a fault is standing.
> - `job.why` is not an error. `pause`, `trocken` (dry phase), `feucht` (moist), `soak` and `limit` are expected brakes; faults live in `err.code`, and only `noeff`, `cfg`, `uhr` (clock), `sensor`, `wasser` (water) block watering.
> - Exactly one fault needs a human: `noeff` (two portions without effect) – check pump, hose, dripper and sensor position, then delete `err`. All others clear themselves.
> - Values can be changed in the KVS at any time; after `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin` or `tTail` run the installer. Update: `npm run build` → upload → `verify-scripts` → `hwtest.js <ip> normal 30`.
> - Biggest pitfall: never upload or run the installer inside a watering window – `put-script.js` stops the script immediately and does not wait; only `hwtest.js normal`, `zeitraffer` and `mess` wait for a safe moment (second 8–30, not in the 9 min after `winA`/`winB`, no script running).

## Prerequisites

- Installation finished ([06 · Start guide](06-startanleitung.md)), target band entered and the first window seen ([12 · First commissioning](12-erstinbetriebnahme.md))
- Access to the Shelly web UI or via RPC (`curl`); for the tools Node ≥ 22 on a machine that reaches `<ip>` – from the VPS through the tunnel `127.0.0.1:8010` ([09 · Installation with a VPS](09-installation-vps.md))
- Console lines need the debug websocket: web UI → Scripts → open a script → open the console. `tools/console.js` and `hwtest.js watch` read the same channel

## Diagram

[![States in operation: st.state, locks, faults, noeff](../diagramme/en/13-betrieb-und-wartung.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/13-betrieb-und-wartung.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/13-betrieb-und-wartung.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Normal cycle", 2 "Brakes", 3 "Faults and the way back", 4 "noeff: by hand only".

## Reading the console

### The bw_main console line

`bw_main` writes exactly one line per cycle (web UI → Scripts → `bw_main` → console, or `node tools/console.js <ip> 900`). Example from the device (13 Sep 2026, fast-forward profile):

```text
[bw_main 0.2.0] V=1.82 pct=53.7 tC=23.6 lvl=0 st=sperre dry=1 pause=0.2h why=pause sec=- effW=2.006 sf=0.7 err=- w=2 dauer=5385ms
```

| Field | Meaning |
| --- | --- |
| `V` | sensor voltage in V (mean of `nSample` readings without outliers) |
| `pct` | moisture in % after the calibration `vDry`/`vWet` |
| `tC` | DS18B20 temperature; `-` when the probe does not read (`err=temp`) |
| `lvl` | float switch: a value equal to `lvlEmpty` means EMPTY; `?` when the `nLvl` readings disagree |
| `st` | `st.state`: `beob` (observing), `gegossen` (watered) or `sperre` (locked) |
| `dry` | `st.dryOk`: 0 in `sperre` means a dry phase is open |
| `pause` | the pause chosen in this cycle in h (`pause`, `pauseHot` or `pauseSlow`) |
| `why` | reason for or against a job (table below) |
| `sec` | first portion of the job in s, otherwise `-` |
| `effW`, `sf` | learned values: effect per effective pump second (`-` until the first window) and safety factor |
| `err` | standing fault or `-` |
| `w` | KVS writes in this cycle (changed entries only) |
| `dauer` | runtime in ms |

Special lines can precede it: `Kontrolle: 50.5 → 53.7 % sf=0.7` (check: moisture after the window → now; `zuviel` (too much) or `sink` (dropped) appended), `Trockenphase (Wochentag 5): warte auf < 28 %` (dry phase from weekday 5, waiting for a reading below 28 %), `Trockenphase (nass 63 %): …` (dry phase because wet) and `Störung cfg: cfg3.tick fehlt` (fault cfg: field missing) naming the missing field.

### The bw_pump console lines

A window produces a header line, one line per portion and a result line:

| Line | Example (device, 13 Sep 2026) | How to read it |
| --- | --- | --- |
| Header | `Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s` | window: job, moisture from the cycle, learned state, `Frist` = time budget of the window from script start (remaining time until the next cycle minus `tTail`, at most `tWin`); without `pct` it says `Einzelportion` (single portion) |
| Fresh reading | `m0 10.4 % → P1 12 s` | median before the first portion and its length |
| Portion | `P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)` | moisture before → after the portion, gain, gain per effective second, first reaction after s, `stabil` (stable; or `unstabil`) after s |
| Result | `ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199` | result (= `job.why`; from the first portion on, or with `nass`, also `st.why`), portions, pump seconds, window duration, moisture before → after, new learned value, windows today, fault, writes, runtime in ms |

Special lines: `m0 … ≥ pctOk – feucht` (moist), `m0 … > pctHi – nass` (wet), `keine Wirkung: Probeportion … s` (no effect: probe portion), `Störung noeff: ΣΔ … % nach 2 Portionen – von Hand löschen` (delete by hand), `Frist: Rest … s` (deadline: remaining), `Grenze erreicht` (limit reached), `Behälter leer` (tank empty), `Ausgang war EIN – Ende (extern)` (output was ON), `kein Auftrag` (no job) and `Fenster abgebrochen (laeuft) – kein Auftrag` (window aborted).

> **Note:** every script has `var DEBUG = 0;` at the top. Set to `1` (or built with `node tools/build.js --debug`) it additionally writes every step, every RPC call with parameters, every KVS entry read and the readings as `[bw_main dbg] …` to the console. Back to `0` for normal operation ([14 · Debugging and testing](14-debuggen-und-testen.md)).

### Reading the KVS

All entries at once: `http://<ip>/rpc/KVS.GetMany?match=*` in the browser or `tools/kvs_dump.sh <ip>`. In the web UI (Settings → Key-Value Storage) open each entry with "Format as JSON", otherwise it only shows `[object Object]`. The state entries:

| Entry | Fields | Meaning |
| --- | --- | --- |
| `st` | `state`, `why`, `ts`, `dur`, `n`, `sec`, `pctB`, `pctW`, `pctA`, `effW`, `tr`, `rated`, `dryOk` | state; `ts` = start of the last window, `dur` = s until pump-off of the last portion, `n` portions, `sec` pump seconds, moisture before/after the window/at the check |
| `job` | `ok`, `sec`, `pct`, `why`, `ts` | job from `bw_main`; `bw_pump` writes the result into `why` and sets `ok=false` |
| `day` | `date`, `n`, `sec` | windows today and the sum of all pump seconds (partial portions included) |
| `lrn` | `effW`, `sf`, `rate`, `tMean`, `tMaxD`, `tMaxY` | learned values (`effW`, `sf`), drying rate %/h (`rate`), smoothed daily maximum (`tMean`), daily maximum today/yesterday in 2 °C steps (`tMaxD`/`tMaxY`; both count for `tHot`) |
| `err` | `code`, `ts`, `mem` | last fault, time, free RAM in bytes (on every fault and once a day) |

One watering is one window with up to `nPort` portions: `day.n` counts windows, `day.sec` all pump seconds, `st.n` the portions of the last window; pause and daily limit count in windows.

`Sys.GetStatus` returns `kvs_rev`, the counter of all writes. Only what changed is written: in the mock's 7-day model 15–22 writes per watering day (test limit 24; per window the claim plus `st`/`day`/`job`/`lrn`).

> **Measured on the device (13 Sep 2026):** fast-forward window `w=4`, cycles `w=0` to `w=3`.

## The reasons in job.why

Until the window, `bw_main` writes the reason for or against a job; in the window `bw_pump` writes the result (from the first portion on, or with `nass`, also `st.why`; if the window ends earlier, `st` stays unchanged). The first matching reason wins ([02 · Flow](02-flussdiagramm.md)).

| `why` | from | Meaning |
| --- | --- | --- |
| `ok` | main | job stands: `sec` seconds first portion in the next window |
| `ok` | pump | window ended inside the band (`pctW ≥ pctOk`) |
| `cfg` | main | target band incomplete (including `pctOk`, `dropSlow`), order violated or mandatory field missing (`err=cfg`) |
| `sensor` | main, pump | moisture sensor implausible (`err=sensor`; in the window before or between portions) |
| `lvl` | main, pump | water level not readable stably (`nLvl` readings differ) |
| `wasser` | main, pump | tank empty (`err=wasser`; in the window before the first portion or in the waiting phase after it) |
| `err:<code>` | main, pump | a standing fault blocks, e.g. `err:noeff` |
| `limit` | main, pump | daily limit `maxDay` <!-- def:cfg3.maxDay -->2<!-- /def --> reached |
| `alt` | pump | job older than `jobAge` <!-- def:cfg3.jobAge -->20<!-- /def --> min (`err=alt`) – is `bw_main` still running? |
| `soak` | main | the window still waits for the check (`soak` <!-- def:cfg3.soak -->30<!-- /def --> min) |
| `pause` | main | minimum pause running (24 / 12 / 48 h; 12 / 6 min in fast-forward) – also after an aborted window (`st.why=laeuft`) |
| `trocken` | main | dry phase (dry day `dryDay` or wetness above `pctHi`): no watering until a cycle reading falls below `pctDry` |
| `feucht` | main, pump | cycle reading `≥ pctLo` (with a running job `≥ pctLo + hyst`) or fresh reading `≥ pctOk`: no watering, no learned value, no pause |
| `nass` | pump | fresh reading above `pctHi` → dry phase, no watering |
| `over` | pump | portion ended above `pctHi`; if it was the first, `sf` drops |
| `max` | pump | limit reached: `nPort` portions, `tMax` or daily budget |
| `zeit` | pump | deadline until the next cycle too short for the next (or first) portion |
| `stall` | pump | a later portion without effect although earlier ones worked (no `err`) |
| `unstab` | pump | reading still rising at the timeout – window ended, no further portion |
| `noeff` | pump | two full portions without effect (Σ < `dEffMin` <!-- def:cfg4.dEffMin -->2<!-- /def --> %) → `err=noeff` |
| `abbruch` | pump | tank ran empty during a portion → pump off immediately, `err=wasser` |
| `extern` | pump | output was already ON or was switched off externally – window ended |
| `switch` / `kvs` | pump | `Switch.Set` or the claim `st.why=laeuft` failed – nothing pumped |
| `laeuft` | pump (only `st.why`) | window in progress; if it stays, the script died mid-window – the pump goes off via `toggle_after`, `auto_off` and the safety-off, `bw_main` keeps the pause |
| `kein_auftrag` | pump (console `ergebnis=` only) | ran without a valid job: manual start, `job.ok=false`, `sec` < 1 or a claim `laeuft` younger than `jobAge`; `job` and `st` stay unchanged |

## Faults in err.code

| `err.code` | set by | blocks | clears itself | what to do |
| --- | --- | --- | --- | --- |
| `cfg` | main, pump, install | yes | at the next cycle with a complete, ordered configuration | mandatory field: the console names it (`Störung cfg: cfg3.tick fehlt`) → run the installer; empty band field: only `why=cfg err=cfg` → check `cfg2` and enter it |
| `uhr` | main, pump | yes | at the next cycle with a valid clock | check Wi-Fi/NTP; after a power failure without internet the schedule stands still anyway |
| `sensor` | main, pump | yes | as soon as the voltage is back within `vErrLo`…`vErrHi` | check cable, plug, sensor position, `cfg1.idV` |
| `wasser` | main, pump | yes | as soon as the float switch stably reports FULL | fill the tank |
| `noeff` | pump | yes | **never** | two full portions without measurable effect: check pump, hose, dripper, sensor position, then delete `err` (below) |
| `temp` | main | no | as soon as the probe reads again | check the DS18B20; the heat rule (`tHot`) is off meanwhile |
| `zuviel` | main | no | at the next check | hint: check above `pctHi + hyst`, `sf` lowered (unless the window already ended with `over`) |
| `sink` | main | no | at the next check | hint: moisture dropped by more than `dropW` since the window reading (only if `dropW` is set) – drainage, sensor slipped? |
| `alt` | pump | no | as soon as `bw_main` writes a new job | `bw_main` no longer running? Check schedule and console |
| `limit` | pump | no | at the day change | hint: `maxDay` reached |

Precedence: `noeff` is never overwritten; a blocking code stays ahead of a hint; among the blocking ones `cfg` > `uhr` > `sensor` > `wasser`. `nass` and `trocken` are locks, not faults: the dry phase ends by itself as soon as a cycle reading falls below `pctDry`.

## Fixing a fault

### Resetting noeff

`noeff` means: two full portions changed the sensor reading by less than `dEffMin` % in total. The system waters again only after a human has looked.

1. Find the cause: does the pump deliver (visual check, tank full)? Is the hose kinked, the dripper clogged? Is the dripper above the sensor and the sensor in the soil?
2. Delete `err` – via RPC or in the web UI (Settings → Key-Value Storage → `err` → Delete):

   ```bash
   curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"err"}'   # reply: {"rev":…}; bw_main recreates err empty at the next cycle
   ```

3. Read the next cycle: `err=-`, `why` back to `ok`, `pause` or `feucht`. The pause since the `noeff` window runs normally (`st.state` is `sperre`).

### Self-clearing faults

For `cfg`, `uhr`, `sensor`, `wasser` and `temp` it is enough to remove the cause; the next cycle clears the code. For `alt` look at the schedule: `bw_main` has not written a job for more than `jobAge` minutes.

```bash
curl -s http://<ip>/rpc/Schedule.List             # own entries: 0 */15 * * * * (bw_main), 30 0 8,20 * * * (bw_pump), 0 8 8,20 * * * (safety-off)
node tools/hwtest.js <ip> status                   # one-liner: running scripts, sensors, switch
node tools/hwtest.js <ip> normal 30                # run the installer again: rebuilds the schedule and verifies it afterwards
```

Schedule IDs are assigned by the device; the installer recognises its entries by `Script.Start` on `bw_main`/`bw_pump` and `Switch.Set` on the pump output. There are three entries when `winA` and `winB` share the same minute (default 08:00/20:00), otherwise up to five.

## Watering by hand

A manual job is a normal `job` that `bw_pump` picks up within `jobAge` minutes. With `pct` the whole control loop runs (fresh reading, portions up to `pctOk`, learned value); with `"pct":null` `bw_pump` pumps exactly one single portion `clamp(sec, 1, min(tPmax, tMax))` without measuring and without learning – the hardware test works the same way.

1. Get the Unix time: `curl -s http://<ip>/rpc/Sys.GetStatus` → field `unixtime`.
2. Write the job (the value is a JSON string, hence the quotes escaped as `\"`):

   ```bash
   curl -s -X POST http://<ip>/rpc/KVS.Set -d '{"key":"job","value":"{\"ok\":true,\"sec\":25,\"pct\":30,\"why\":\"hand\",\"ts\":<unixtime>}"}'
   ```

3. Start `bw_pump`: web UI → Scripts → `bw_pump` → Start, or `curl -s -X POST http://<ip>/rpc/Script.Start -d '{"id":<id>}'` (ID from `node tools/hwtest.js <ip> scripts`). Best shortly after a cycle (second 30), because `bw_pump` only gets the deadline until the next cycle – otherwise `why=zeit`.
4. Read the console: `Fenster: Auftrag 25 s …`, portion lines, `ergebnis=`.

The single portion also counts as a window: `day.n` + 1, `day.sec` + seconds, then a pause from `st.ts`. If the fresh reading is already at `pctOk`, there is no watering (`why=feucht`). If a claim `st.why=laeuft` younger than `jobAge` is still standing, `bw_pump` reports `Fenster abgebrochen (laeuft) – kein Auftrag`.

## Changing values

All `cfg1..4` fields can be changed in the KVS at any time; the scripts read them at every start. `KVS.Set` replaces the whole entry – in the web UI change only the field with "Format as JSON", via RPC write the complete object (a partial object leaves mandatory fields missing → `err=cfg`; the installer fills them in again with defaults). What a field does: [03 · Configuration](03-konfiguration.md).

| Changed | Afterwards |
| --- | --- |
| `tick`, `winEvery`, `winA`/`winB`, `tWin`, `tTail` | run the installer – it rebuilds the schedule (cycle, windows at second 30, safety-off 30 + `tWin` + 10 s rounded up) |
| `tMax` | run the installer – `auto_off` = `tMax` + 10 s (default <!-- def:cfg3.tMax -->180<!-- /def --> + 10 = 190 s) |
| target band `cfg2`, pauses, `maxDay`, `dryDay`, `tHot` | nothing – takes effect at the next cycle |
| `vDry`/`vWet` (`cfg1`) | the percent scale shifts: delete `lrn.effW` (fallback to `tStd` <!-- def:cfg3.tStd -->70<!-- /def --> s) or repeat `kal write` ([12 · First commissioning](12-erstinbetriebnahme.md)) |
| `tDead`, `tDead2`, `tPmin`, `tSoak`, `tStab` | a measurement run first, `node tools/hwtest.js <ip> mess 10 1` – never change timing values by gut feeling |

The installer aborts while `bw_main` or `bw_pump` is running. `node tools/hwtest.js <ip> normal 30` therefore waits for a safe moment (second 8–30, not in the 9 min after `winA`/`winB`, no operating script running), starts `bw_install` and then verifies schedule, `cfg3`/`cfg4` and `auto_off`.

The device occasionally rejects the first `Schedule.Create` of a run with "timespec validation"; the installer retries up to three times, the first rejection silently. Only a second one shows up as `Hinweis: Schedule.Create '…' abgelehnt (…), Versuch 2/3` (notice: rejected, attempt 2/3); only a line `Schedule.Create '…': …` without `Hinweis` means an entry is missing (`normal` then reports `ABWEICHUNG`, deviation).

```text
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] Zeitplan: 3 Einträge, davon eigene: 3
[bw_install 0.1.3] Switch 0: auto_off 190 s
[bw_install 0.1.3] KVS neu angelegt: keine
[bw_install 0.1.3] Zeitplan #4: 0 */15 * * * *
[bw_install 0.1.3] Zeitplan #5: 30 0 8,20 * * *
[bw_install 0.1.3] Zeitplan #6: 0 8 8,20 * * *
[bw_install 0.1.3] fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach
```

(Installer console in the mock, `node tools/run-script.js scripts/bw_install.js --seed`, 15 Sep 2026: `Script-IDs` = script IDs found by name, `Zeitplan: 3 Einträge, davon eigene: 3` = 3 schedule entries, 3 of them ours, `KVS neu angelegt: keine` = no new KVS entries, `fertig` = done, safety-off 8 min after the window; the device assigns other script and schedule IDs, and added fields show up as `KVS cfg3 ergänzt: …`.)

## Updating the scripts

### Every new version

Current scripts: `bw_install` <!-- fact:ver.bw_install -->0.1.3<!-- /fact -->, `bw_main` <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, `bw_pump` <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, `bw_zeitraffer` <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact -->; tools `hwtest.js` <!-- fact:ver.hwtest -->0.1.2<!-- /fact -->, `put-script.js` <!-- fact:ver.put-script -->0.1.2<!-- /fact -->, `console.js` <!-- fact:ver.console -->0.1.0<!-- /fact -->.

Compact output: `bw_main` <!-- fact:dist.bw_main -->15 791<!-- /fact --> B, `bw_pump` <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B (limit <!-- fact:size_limit -->16 000<!-- /fact --> B, for `bw_pump` <!-- fact:size_limit_pump -->18 000<!-- /fact --> B).

1. Update the source (`git pull`), `npm test` and `npm run build` – only `dist/` goes to the device.
2. Look at script IDs and flash: `node tools/hwtest.js <ip> scripts` (`fs_free`; `put-script.js` checks it before every upload).
3. Upload outside the windows, one script per call: `node tools/put-script.js <ip> <id> dist/bw_pump.js` (stops the script, sends in chunks, reads back and compares byte for byte). The order is water-safe: `bw_main` and `bw_pump` must end up with the same version.
4. Verify all scripts: `node tools/verify-scripts.js <ip>`.
5. Installer: `node tools/hwtest.js <ip> normal 30` – adds new cfg fields with defaults, rebuilds schedule and `auto_off` and verifies the result.
6. Read the first cycle: `err=-`. If it says `err=cfg`, a mandatory field is missing (the console names it; installer not run) or a band field in `cfg2` is still `null` (only `why=cfg err=cfg`).

> **Caution (water/mains):** `put-script.js` stops the script before uploading. Uploading `bw_pump` during a window aborts the watering (`st.why=laeuft` stays, the pump goes off via `toggle_after`). Do not upload between 08:00 and 08:09 or between 20:00 and 20:09.

### Migration 0.1.x → 0.2.0

Since 0.2.0 `bw_pump` waters in portions with re-measuring (`cfg4`); `bw_main` only writes the job, checks `soak` min later and runs the dry phase. Done on the device on 13 Sep 2026 ([19 · Device test protocol](19-pruefprotokoll.md)).

1. Free flash: delete the test scripts (`engine_probe`, `bw_hwtest`, `bw_hwpump`) with `node tools/hwtest.js <ip> delete <id|name>` – on 13 Sep 2026 this raised `fs_free` from 12 288 to 49 152 B. `preflight hw` recreates them later if needed.
2. `npm run build`, then upload `dist/bw_pump.js`, `bw_main.js`, `bw_install.js`, `bw_zeitraffer.js` with `put-script.js`; `node tools/verify-scripts.js <ip>`.
3. Manual values in the KVS (example band on the device, in band order `pctDry` 28 < `pctLo` 40 < `pctOk` 50 ≤ `pctSoll` 55 < `pctHi` 60): `cfg2` → `pctOk` 50, `pctHi` 60, `pctDry` 28, `effMax` 30; `cfg3` → `tMax` 180 (now the sum per window), `tMin` 25; `lrn` → `sf` 0.7 (delete the old `eff`) – the installer only adds missing fields, an existing `sf` 1 would stay.
4. `node tools/hwtest.js <ip> normal 30`: the installer adds `cfg4`, `cfg3.dryDay`, `cfg2.dropW`/`sfUp` and `lrn.effW` (`null`), builds the schedule with the safety-off `0 8 8,20 * * *` and sets `auto_off` 190 s.

Until `pctOk` is entered, the system does not water (`why=cfg`). Every upload order is water-safe: old `st`/`lrn` is tolerated, a job without `pct` becomes a single portion. If the old field `lrn.eff` is left in place, it is ignored.

## Firmware update

Only firmware 2.0.0 has been measured so far (12/13 Sep 2026). Whether scripts, KVS and schedule survive a firmware update unchanged has not been verified: `[TODO am Gerät]` (to do on the device). So back up first and verify afterwards:

1. Before: `tools/kvs_dump.sh <ip> > sicherung.json` (below), note `node tools/hwtest.js <ip> scripts` (versions, sizes).
2. Start the update only in a safe moment (not in the 9 min after `winA`/`winB`, no script running): web UI → Settings → Firmware.
3. Afterwards: `node tools/verify-scripts.js <ip>` (code byte-identical?), `curl -s http://<ip>/rpc/Schedule.List` (three own entries?), `curl -s "http://<ip>/rpc/Switch.GetConfig?id=0"` (`initial_state` off, `auto_off_delay` 190?).
4. If something is missing: `node tools/hwtest.js <ip> normal 30` rebuilds schedule and switch configuration; missing KVS entries get defaults, restore backed-up values (below).
5. Web UI → Scripts → open the console (switches the debug websocket back on) and read the first cycle: `err=-`.

## Backing up and restoring the KVS

`tools/kvs_dump.sh <ip>` prints the pages of the `KVS.GetMany` reply and the `Sys.GetStatus` (with `kvs_rev`); redirecting the output into a file is the backup. Worth doing before firmware updates, before uninstalling and after calibration (`cfg1`, `lrn.effW`).

```bash
tools/kvs_dump.sh <ip> > sicherung-2026-09-15.json          # all entries as JSON strings, plus Sys.GetStatus
curl -s -X POST http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctSoll\":55,\"pctLo\":40,\"pctHi\":60,\"pctDry\":28,\"hyst\":2,\"dropSlow\":4,\"effMin\":0.05,\"effMax\":30,\"alpha\":0.3,\"sfMin\":0.5,\"sfStep\":0.1,\"pctOk\":50,\"dropW\":null,\"sfUp\":0.05}"}'
```

Restoring works per key with `KVS.Set`: `value` is the string from the backup (inner quotes escaped as `\"`). `cfg1`…`cfg4` and `lrn` are worth restoring; the state entries `st`, `job`, `day`, `err` are recreated fresh by the installer. Then run `node tools/hwtest.js <ip> normal 30` once so that missing fields are filled in.

## After a power failure

- The pump output is off after the restart (`initial_state` off, set by the installer), and no script starts on its own (`Script.SetConfig` `enable` false – only the schedule starts them).
- The state lives in the KVS and survives the outage: pause, learned values, `day` and `err` are as before.
- The schedule needs a valid clock. Without internet `Sys.time` stays empty and the schedule stands still; a manually started `bw_main` reports `Störung uhr: Uhrzeit nicht gesetzt (kein NTP seit Neustart)` (clock not set, no NTP since restart) and `err=uhr`. As soon as NTP is back everything continues; `uhr` clears at the next cycle.
- A missed window is not caught up. If power returns shortly before a window, the job can be older than `jobAge` → `why=alt`, `err=alt`; the next cycle rewrites the job and clears the hint.
- If power failed mid-window, the claim `st.why=laeuft` stays: the pause runs from `st.ts`, no learned value is formed, and a manual start within `jobAge` minutes does not water.

After power returns, a look at the next cycle (`err=-`) and `node tools/hwtest.js <ip> status` is enough. This behaviour follows from configuration and code; the power failure itself (checks 15 and 16 in [19 · Device test protocol](19-pruefprotokoll.md)) has not been played through on the device yet: `[TODO am Gerät]`.

## Time zone and daylight saving time

- The windows `winA`/`winB` are local time: the device schedule runs in the time zone from the device settings (web UI → Settings → Timezone/NTP). The schedule entries carry no time zone; a changed device time zone needs no new schedule.
- `bw_main` computes the local day (day change, `dryDay`) to the minute from `Sys.time` (HH:MM) and `unixtime`; `bw_pump` computes its deadline from `unixtime` and assumes a time-zone offset in multiples of 15 minutes, which holds for all time zones.
- The pause counts in Unix time: `(now + 2·tick·60) − st.ts ≥ pause·3600`, tolerance two cycles (30 min). When clocks go forward, the window that would normally come exactly 24 h after the last watering comes only 23 h later – the pause has not elapsed yet even with the tolerance, that window is skipped, only the following one (12 h later) waters again. When clocks go back (25 h) nothing changes. This follows from the code and has not been observed on the device: `[TODO am Gerät]`.

## Maintenance

| Part | When | What to do | Afterwards in the system |
| --- | --- | --- | --- |
| tank and float switch | when refilling | clean the tank, check that the float moves freely; it sits above the pump inlet | `lvl=0` in the console line (with `lvlEmpty` 1); `err=wasser` clears itself |
| pump, intake strainer, hose | when the effect drops | clean the strainer, check the hose for kinks and air | a measurement run `node tools/hwtest.js <ip> mess 10 1` shows `tRise` and gain per second ([12 · First commissioning](12-erstinbetriebnahme.md)) |
| dripper | when `effW` drops, on `stall` or `noeff` | flush or replace the dripper; it must sit above the sensor | `lrn.effW` re-learns over the next windows (`alpha` 0.3); after `noeff` delete `err` |
| hose changed or extended | once | determine the dead time again: `mess`, then set `cfg3.tDead`/`tMin` and `cfg4.tDead2` (`kal write` or by hand) | `tDead` <!-- def:cfg3.tDead -->20<!-- /def --> s is the default; on the test rig `kal write` gave 8 s |
| SMT50 sensor | moved or cleaned | measure the calibration points again (`bw_hwtest`, [11 · Hardware check](11-hardware-check.md)) | new `vDry`/`vWet` shift the percent scale: delete `lrn.effW` or repeat `kal write` |
| DS18B20 probe | on `err=temp` | check plug and 1-Wire connection | heat rule active again as soon as `tC` shows a value |
| memory | occasionally | compare `err.mem` over days (updated daily) | on 13 Sep 2026: heap free 25 200 B idle, `mem_peak` of `bw_pump` 12 516 B |

Hose, dripper and sensor form one measuring path: the control loop measures only at the sensor (wettest spot under the dripper). Further drippers on the same manifold are supplied blindly and should be identical.

## Before a holiday and in winter

1. Tank full, float switch at FULL (`lvl=0`). Per day at most `maxDay` × `tMax` = 2 × 180 = 360 pump seconds are possible; determine the flow per second once with a measuring jug and `mess 10 1` and size the supply accordingly: `[TODO am Gerät]`.
2. Read the last console lines: `err=-`, `why` plausible (`ok`, `pause`, `feucht`), `effW` learned (not `-`), `dauer` as usual.
3. The schedule stands (`Schedule.List`, three own entries) and the clock is set (`Sys.GetStatus` → `time`).
4. Leave `dryDay` <!-- def:cfg3.dryDay -->5<!-- /def --> (Friday) on purpose: the dry phase is the waterlogging brake; if you do not want it, set `null` (no installer needed).
5. Heat: above `tHot` <!-- def:cfg3.tHot -->35<!-- /def --> °C only `pauseHot` <!-- def:cfg3.pauseHot -->12<!-- /def --> h applies, i.e. both windows – consumption doubles, the limit `maxDay` × `tMax` stays.
6. Back up the KVS (`kvs_dump.sh`) so that calibration and learned values come back after a device swap.

Winter: the software has no frost lock (open concept question; temperature only acts via `tHot`). Outdoors keep tank, hose and pump frost-free or stop cleanly: empty the tank – `why=wasser`, `err=wasser`, no watering, measuring continues, and the first refill resumes without any action. Indoors nothing changes: watering follows moisture, not the calendar.

## Uninstalling

1. Stop: `node tools/hwtest.js <ip> stop` (emergency stop: `Script.Stop` for `bw_pump` and the test scripts, `Switch.Set` off) – best outside the windows.
2. Back up the KVS if calibration and learned values are to be reused (`tools/kvs_dump.sh <ip> > sicherung.json`).
3. Schedule: `curl -s http://<ip>/rpc/Schedule.List`, then per own entry `curl -s -X POST http://<ip>/rpc/Schedule.Delete -d '{"id":<id>}'` (or web UI → Schedules).
4. KVS: per key `curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"cfg1"}'` for `cfg1`, `cfg2`, `cfg3`, `cfg4`, `lrn`, `st`, `job`, `day`, `err`; if present also `zr`, `zrb1`…`zrb5`, `hwt`, `hwr`, `hwp`, `hwc`, `hwb1`, `hwb2`.
5. Scripts: delete them stopped via RPC, `curl -s -X POST http://<ip>/rpc/Script.Delete -d '{"id":<id>}'` (`hwtest.js delete` refuses operating scripts, hence RPC directly).
6. Switch: `curl -s -X POST http://<ip>/rpc/Switch.SetConfig -d '{"id":0,"config":{"auto_off":false}}'` if the output is used for something else; `initial_state` off may stay.
7. Pump and power supply de-energised, tank emptied, sensor dried. Work on 230 V only by a qualified electrician ([04 · Safety and limits](04-sicherheit-und-grenzen.md)).

## Example output

> **Measured on the device (13 Sep 2026):** four `bw_main` cycles around window 1 of the fast-forward schedule (cycle <!-- zr:cfg3.tick -->3<!-- /zr --> min, `pause` <!-- zr:cfg3.pause -->0.2<!-- /zr --> h), times 15:51, 15:57, 16:00 and 16:03.

```text
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
[bw_main 0.2.0] Kontrolle: 50.5 → 53.7 % sf=0.7
[bw_main 0.2.0] V=1.82 pct=53.7 tC=23.6 lvl=0 st=sperre dry=1 pause=0.2h why=pause sec=- effW=2.006 sf=0.7 err=- w=2 dauer=5385ms
[bw_main 0.2.0] V=1.91 pct=56.871 tC=23.6 lvl=0 st=sperre dry=1 pause=0.2h why=pause sec=- effW=2.006 sf=0.7 err=- w=0 dauer=4426ms
[bw_main 0.2.0] V=1.897 pct=56.401 tC=23.6 lvl=0 st=beob dry=1 pause=0.2h why=feucht sec=- effW=2.006 sf=0.7 err=- w=2 dauer=5343ms
```

How to read it: at 15:51 the cycle measures 10.8 % below `pctLo` 40, no learned value (`effW=-`), job `tStd` 12 s (`why=ok sec=12`, `w=3`: `job`, `lrn` (daily maximum `tMaxD`), `day`). The window at 15:54:30 lifts the moisture to 50.5 % and learns `effW` 2.006 ([02 · Flow](02-flussdiagramm.md)). At 15:57 the check follows (`Kontrolle`): 53.7 % is below `pctHi + hyst`, no `zuviel`; then `st=sperre why=pause`, `w=2` (`st` and `job`).

At 16:00 nothing changes (`w=0`). At 16:03 the pause including the two-cycle tolerance is over: `st=beob`, but 56.4 % is not below `pctLo` 40, so `why=feucht` – no job, `w=2` (`st` and `job`). `err=-` in all four lines: no fault. In normal operation the line would show `pause=24h`, and `dauer` (runtime) stays around 5 s.

A manual start without a job looks like this (mock, `node tools/run-script.js scripts/bw_pump.js --seed`, 15 Sep 2026):

```text
[bw_pump 0.2.0] kein Auftrag
[bw_pump 0.2.0] ergebnis=kein_auftrag n=0 sec=0 dur=0 pct=null→null effW=null sf=0.7 day.n=0 err=null w=0 dauer=280
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `why=pause` although nothing was watered | the claim `st.why=laeuft` is standing: window aborted (crash, stop, power) – the pause holds | read `st`; the pause runs out normally, a manual start within `jobAge` does not water |
| `err=cfg` after an update | mandatory field missing (installer not run) or a band field (`pctOk`, `dropSlow`) still `null` | mandatory field: the console names it (`Störung cfg: cfg3.tick fehlt`; a `cfg4` field is only reported by `bw_pump` in the window) → `hwtest.js <ip> normal 30`; band field: only `why=cfg err=cfg` without a field name → read `cfg2` and enter it |
| `err=alt`, no more windows | `bw_main` is not running: schedule gone, clock invalid or script stopped | `Schedule.List`, console; run the installer again |
| manual start: `kein Auftrag` or only `ergebnis=kein_auftrag` | `job.ok` is `false`, `sec` missing or < 1, or a claim `laeuft` younger than `jobAge` (if `ts` is missing you get `Störung alt: Auftrag zu alt` instead) | rewrite `job` with `ok:true`, `sec`, `ts` = now |
| manual start ends immediately with `zeit` | deadline until the next cycle too short for portion 1 plus measuring time | start shortly after a cycle (second 30) |
| `watch`/`console.js` show nothing | debug websocket off, or `watch` ends in normal operation after seconds (only test scripts keep it open) | web UI → open the console; follow a real window with `node tools/console.js <ip> 900` – connect before the start, otherwise the first line is missing |
| web UI shows `[object Object]` | KVS values are JSON strings | tick "Format as JSON" |
| fields missing after `KVS.Set` | `KVS.Set` replaces the whole entry | write the whole object or run the installer (adds defaults) |
| installer: `ABBRUCH: Script bw_main läuft – später erneut starten` | a cycle or window is running right now (abort: script running, start again later) | `hwtest.js <ip> normal 30` waits for the safe moment |
| installer: `Hinweis: Schedule.Create '…' abgelehnt (…), Versuch 2/3` | the firmware sporadically rejects the first `Schedule.Create`; the installer retries | nothing, as long as all entries are listed at the end (`Zeitplan #<id>: …`); otherwise run `normal 30` again |
| console: `Timer 1 handle not found`, `PCS write interval < 60s` | firmware notices from timer cleanup and the switch counter | harmless, nothing to do |
| `put-script.js`: `Flash zu voll` (flash too full) | not enough `fs_free` for the new file | delete test scripts (`hwtest.js <ip> scripts`, `delete <id>`) |
| constantly `why=feucht`, the soil feels dry | sensor not under the dripper, or the band does not match the calibration | check the sensor position, redetermine the band ([12 · First commissioning](12-erstinbetriebnahme.md)) |
| `err=noeff` after rebuilding hose or dripper | water does not reach the sensor | check the water path, delete `err`, re-measure the dead time with `mess` |

## Next

- [14 · Debugging and testing](14-debuggen-und-testen.md) – mock, tests, console and the complete tool reference
- [03 · How the configuration fits together](03-konfiguration.md) – every field: default, effect, when the installer must run again
- [12 · First commissioning](12-erstinbetriebnahme.md) – measurement run, calibration run and `kal write` after rebuilds; the fast-forward practice test to see everything once in 45 minutes
- [04 · Safety and limits](04-sicherheit-und-grenzen.md) – why the pump goes off even without a script
