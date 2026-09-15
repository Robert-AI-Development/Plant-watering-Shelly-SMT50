# 03 · How the configuration fits together (parameter reference)

[Deutsch](../de/03-konfiguration.md) · **English** — [Handbook](README.md) · Part A "Understand"

> **At a glance**
> - Everything the device knows lives in the Shelly's KVS (key-value storage): `cfg1`–`cfg4` are settings, `lrn` learned values, `st`, `job`, `day`, `err` state. The scripts contain no thresholds, times or limits.
> - Every KVS value is a JSON string. The installer `bw_install` creates missing entries and fields with their defaults and never overwrites an existing value.
> - After changing `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin`, `tTail` or `cfg1.idSw`, start `bw_install` once – schedule, safety-off and `auto_off` are built only from there. All other fields take effect at the next cycle.
> - Key numbers: cycle <!-- def:cfg3.tick -->15<!-- /def --> min, budget per window <!-- def:cfg4.tWin -->420<!-- /def --> s, total per window <!-- def:cfg3.tMax -->180<!-- /def --> s, `auto_off` = `tMax` + 10 = 190 s.
> - Biggest pitfall: the target band `cfg2` stays `null` after installation – until all six band fields (including `pctOk`) are set, the device only measures (`why=cfg`, "reason: configuration incomplete").

## Prerequisites

- none – a reading chapter. To change values you need the Shelly web UI (Settings → Key-Value Storage) or `curl` against `http://<ip>/rpc`.
- Useful beforehand: [01 · Overall architecture](01-gesamtarchitektur.md) (what `bw_main`, `bw_pump` and the installer do) and [02 · Flow](02-flussdiagramm.md) (when each value comes into play).

## Diagram

[![Who reads and writes which KVS entries: installer, tools and human write cfg1–cfg4, bw_main reads cfg1–cfg3 every cycle and writes job, st, day, err and lrn, bw_pump reads all four in the window and writes st, day, err and lrn](../diagramme/en/03-konfiguration.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/03-konfiguration.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/03-konfiguration.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Settings cfg1–cfg4", 2 "Job and result", 3 "Learning", 4 "Tools write calibration". In the picture `cfg3` and `cfg4` share one box; `day` and `err` share the box with `st`. Of the settings only `cfg3 · cfg4` has an arrow into `bw_pump` in the picture – that it also reads `cfg1` and `cfg2` is stated in its subtitle ("window: reads cfg1–cfg4"); the matrix and the tables below list every field individually.

## Ground rules

The scripts re-read their entries on every start and keep nothing in RAM. A change in the KVS therefore takes effect at the latest with the next `bw_main` cycle (every `cfg3.tick` minutes) or the next watering window of `bw_pump`.

| Rule | What it means | Source |
| --- | --- | --- |
| JSON strings | Every value is written with `JSON.stringify` and read with `JSON.parse`. The web UI can only display strings; a string that does not parse to a JSON object counts as missing and is replaced by the installer (console: `KVS cfg2 kein Objekt, neu angelegt` – "not an object, recreated"; unreadable text only in the final line `KVS neu angelegt: …`); an object value is kept (see Typical problems) | `fromKvs()` in all scripts, decisions 15/16 |
| The installer never overwrites | `bw_install` writes an entry only if it is missing and adds only missing fields to existing entries (`KVS cfg3 ergänzt: dryDay` – "completed"). Your own values survive every reinstall and every script update | `stepDefaults()` in `bw_install.js` |
| The only exception | After a fast-forward run the installer finds the backup `zrb1` without the marker `zr` and writes the saved original back (chapter 12) | `stepZr()` |
| Required fields | If a required field is missing or the band is out of order, the script sets `err.code = "cfg"` and does not water; the console names the field (`cfg3.tick fehlt` – "missing") | `REQ1`–`REQ4` in `bw_main.js`, `bw_pump.js` |
| Run the installer again | after `cfg3.tick`, `winEvery`, `winA`, `winB`, `tMax`, after `cfg4.tWin`, `tTail` and after `cfg1.idSw` – it builds schedule, safety-off and `auto_off` from them. It aborts while `bw_main` or `bw_pump` is running; `node tools/hwtest.js <ip> normal 60` waits for a safe moment | `stepSchedCreate()`, `stepSwitchCfg()` |
| Write only changes | `bw_main` and `bw_pump` write an entry only if its JSON changed: at most 24 writes per day, on average below 18 (checked in `szenario.test.js`) | `stepWrite()` |
| KVS limits | 50 keys, key ≤ 42 characters, value ≤ 253 characters. The project uses at most 21 keys (9 operation + 6 fast-forward + 6 hardware check); `kvs-size.test.js` checks the value lengths. That is why times and window settings are split across `cfg3` and `cfg4` | Shelly docs, decision 53 |

> **Note:** `KVS.Set` always replaces the whole entry. A partial object (only `vDry`/`vWet`, only the band) therefore makes sense only *before* the installer – it fills in the rest. To change a single field later: web UI with "Format as JSON", or run the installer again after a partial write.

Origin of the fields: the field catalogue of the implementation plan (chapter 16), extended by decisions from the decision log (chapter 17) – `cfg1.msSample` and the four ID fields, `cfg2.sfMin`/`sfStep`, `cfg3.tChk`, `lrn.sf` plus `tMaxD`/`tMaxY` instead of a stored `tMax24`, `cfg4` as its own key (stage 10). The installer deliberately sets no autostart for `bw_main` and `bw_pump`: the schedule starts them, and an autostart after a reboot could water outside the windows.

## Who reads, who writes

R = reads, W = writes, "creates" = only if the entry or field is missing. `bw_main` reads all entries with `KVS.GetMany`, `bw_pump` exactly nine keys with `KVS.Get` (`cfg1`–`cfg4`, `lrn`, `st`, `job`, `day`, `err`) so that no backups sit in the scarce script heap.

| Entry | `bw_install` | `bw_main` | `bw_pump` | `bw_hwtest` / `bw_hwpump` | `bw_zeitraffer` | Tools (`hwtest.js`) | Human |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cfg1` | creates; R `idSw` | R | R | W `vDry`, `vWet`, `lvlEmpty` (if `hwt.cal` 1) / R | R (must exist) | `report` compares | W (calibration points, IDs) |
| `cfg2` | creates (`pctOk`, band `null`) | R | R | – | W `pctDry` = `pctLo` − 1, backup `zrb5` | `zeitraffer` checks the band | W (target band) |
| `cfg3` | creates; R `tick`, `winEvery`, `winA`, `winB`, `tMax` | R | R | R `tMax`, `maxDay`, `winA`, `winB` (`bw_hwpump`) | W profile `ZR3`, backup `zrb1` | `kal write` W `tDead`, `tMin` | W (times, windows) |
| `cfg4` | creates; R `tWin`, `tTail` | – | R | – | W profile `ZR4`, backup `zrb4` | `kal write` W `tDead2` | W (window control loop) |
| `lrn` | creates (`effW` `null`, `sf` 0.7) | R, W `tMaxD`, `tMaxY`, `tMean`, `rate`, `sf` (check `zuviel`, too much) | R, W `effW`, `sf` | backs up to `hwb2`, restores | resets, backup `zrb2` | `kal write` W `effW`; `restore` | clear `effW` after a new calibration |
| `st` | creates | R, W (check, dry phase, pause) | R, W (claim `laeuft` (running), result) | backs up to `hwb1`, restores | resets, backup `zrb3` | `restore`; `watch` shows it | read only |
| `job` | creates (`why` `init`); fresh after fast-forward | W (job), R (hysteresis) | R, W `ok` false, `why` = result | W test job (`bw_hwpump`), backup `hwb2` | resets | `restore` | rarely: manual job |
| `day` | creates | R, W (day change) | R, W `n`, `sec` | backs up to `hwb1`; resets at the daily limit | resets, backup `zrb2` | `restore` | read only |
| `err` | W `cfg` on abort | R, W | R, W | W `code` `null` before the test, backup `hwb2` | resets, backup `zrb3` | `restore` | delete on `noeff` (no effect) |

`bw_main` does not read `cfg4`: the window control loop belongs to `bw_pump` alone. Conversely `bw_pump` needs only `tDead`, `tMin`, `tMax`, `jobAge`, `maxDay`, `tChk` and `tick` from `cfg3`.

## The ten most important levers

All of them live in `cfg2` and `cfg3`; the fine points of the window (portions, soaking, stability) live in `cfg4`.

| Field | Question | Effect | Installer afterwards? |
| --- | --- | --- | --- |
| `cfg2.pctLo` | *when?* | below it a watering job is created; higher = water earlier | no |
| `cfg2.pctOk` | *up to where?* | the window ends without another portion as soon as the stable moisture reaches this value | no |
| `cfg2.pctSoll` | *how much?* | target point of the dose calculation for first and correction portions | no |
| `cfg2.pctHi` | brake | above it in the window: `over` (safety factor drops); above it in the cycle reading the pot counts as wet → dry phase | no |
| `cfg2.pctDry` | end of the dry phase | watering resumes as soon as a cycle reading falls below it | no |
| `cfg3.winA`, `winB` | *at what time?* | the two watering windows (local time); `bw_pump` starts at second 30 of the minute | **yes** |
| `cfg3.tMax` | emergency brake | sum of all portions in one window; `auto_off` = `tMax` + 10 s | **yes** |
| `cfg3.maxDay` | windows per day | more windows → `why=limit`; daily reserve = `maxDay` × `tMax` pump seconds | no |
| `cfg3.dryDay` | dry day | weekday from which no watering happens until the moisture has fallen below `pctDry` (`null` = never) | no |
| `cfg3.tHot`, `pauseHot`, `pause` | heat rule, rest time | minimum pause after every watering; with a daily maximum above `tHot` only `pauseHot` (both windows possible) | no |

## cfg1 – sensor and calibration

Read by `bw_main` and `bw_pump` (measurement, water level, components); the installer needs `idSw` for the schedule and the switch configuration. `bw_hwtest` writes the measured calibration points itself.

> **Measured on the device (13 Sep 2026):** `vDry` 0.296 V, `vWet` 3.134 V (written automatically by `bw_hwtest`), `lvlEmpty` 1 confirmed (float switch EMPTY = 1, FULL = 0, 8 input changes).

<!-- tabelle:cfg1 -->

| Field | Default | Effect | When to change | Installer afterwards? |
| --- | --- | --- | --- | --- |
| `vDry` | <!-- def:cfg1.vDry -->0.20<!-- /def --> V | sensor voltage dry in air = 0 % | after the hardware check (chapter 11) or read by hand from the voltmeter | no |
| `vWet` | <!-- def:cfg1.vWet -->3.13<!-- /def --> V | voltage in water = 100 %; must be greater than `vDry`, otherwise `err=cfg` | like `vDry` | no |
| `vErrLo` | <!-- def:cfg1.vErrLo -->0.10<!-- /def --> V | below it fault `sensor` (a torn cable looks like "dry") | only with a different sensor | no |
| `vErrHi` | <!-- def:cfg1.vErrHi -->3.35<!-- /def --> V | above it fault `sensor` | only with a different sensor | no |
| `nSample` | <!-- def:cfg1.nSample -->5<!-- /def --> | samples per reading: `bw_main` takes the mean of the middle values (minimum and maximum are dropped), `bw_pump` the median | increase for noisy values | no |
| `msSample` | <!-- def:cfg1.msSample -->500<!-- /def --> ms | interval between two samples; also the tick of the window automaton in `bw_pump` | rarely | no |
| `lvlEmpty` | <!-- def:cfg1.lvlEmpty -->1<!-- /def --> | value of the water-level input that means EMPTY | if the float switch works the other way round (`bw_hwtest` measures it) | no |
| `nLvl` | <!-- def:cfg1.nLvl -->3<!-- /def --> | identical readings in a row for a valid water level (debounce); `bw_pump` tries up to 4 × `nLvl` ticks, otherwise `lvl` (level unstable) or `wasser` (water) | rarely | no |
| `idV` | <!-- def:cfg1.idV -->100<!-- /def --> | ID of the voltmeter component (`voltmeter:100`) | if the web UI shows a different ID | no |
| `idT` | <!-- def:cfg1.idT -->100<!-- /def --> | ID of the DS18B20 (`temperature:100`) | like `idV` | no |
| `idLvl` | <!-- def:cfg1.idLvl -->1<!-- /def --> | ID of the input for the float switch (`input:1` = terminal IN2) | different input | no |
| `idSw` | <!-- def:cfg1.idSw -->0<!-- /def --> | ID of the switch for the pump (`switch:0` = OUT1); scheduled off and `auto_off` target this ID | different output | **yes** |

<!-- /tabelle -->

> **Caution (water/mains):** New `vDry`/`vWet` shift the percentage scale. A previously learned `lrn.effW` no longer fits: set `effW` to `null` (fallback to `tStd`) or repeat `kal write` – otherwise the device doses with a wrong effect per second.

## cfg2 – target band and learning

Order of the band: `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` and `pctLo + hyst < pctOk`. If a value violates this, `bw_main` reports `err.code = "cfg"` and writes no job. As long as one of the six open fields is `null`, the system only measures (`why=cfg`) – the normal state right after installation.

Two reference readings: `pctLo`, `pctDry` and the dry-phase threshold `pctHi` apply to the **cycle reading** (sensor in the pot, 15-minute cycle). `pctOk`, `pctSoll`, `pctHi` as the window limit and `lrn.effW` apply to the **stabilised reading in the watering window** (sensor under the dripper, after `tSoak`).

> **Note:** example band on the device (13 Sep 2026) in band order `pctDry` 28 < `pctLo` 40 < `pctOk` 50 ≤ `pctSoll` 55 < `pctHi` 60, `dropSlow` 4. The right thresholds for your own plant emerge during first commissioning (chapter 12) `[TODO am Gerät]` (to do on the device).

<!-- tabelle:cfg2 -->

| Field | Default | Fast-forward | Effect | When to change | Installer afterwards? |
| --- | --- | --- | --- | --- | --- |
| `pctDry` | <!-- def:cfg2.pctDry -->null<!-- /def --> | <!-- zr:cfg2.pctDry -->pctLo − 1<!-- /zr --> | end of the dry phase: watering resumes as soon as a cycle reading falls below it (example 28) | with the band | no |
| `pctLo` | <!-- def:cfg2.pctLo -->null<!-- /def --> | – | lower limit: below it a watering job is created, from `pctLo` upwards the reason is `feucht` (moist); a running job holds until `pctLo + hyst` (example 40) | with the band | no |
| `pctOk` | <!-- def:cfg2.pctOk -->null<!-- /def --> | – | "target reached": the window ends without another portion from this value; fresh reading `m0` ≥ `pctOk` → `feucht` (moist) (example 50). After an update from 0.1.x the installer only creates the field as `null` – enter the value by hand | with the band | no |
| `pctSoll` | <!-- def:cfg2.pctSoll -->null<!-- /def --> | – | target point of the dose calculation: first portion `(pctSoll − pct) / effW · sf + tDead` (example 55) | with the band | no |
| `pctHi` | <!-- def:cfg2.pctHi -->null<!-- /def --> | – | above it in the window `over` (`sf` drops only if portion 1 already ended above it); cycle reading above it = wet → dry phase (example 60) | with the band | no |
| `hyst` | <!-- def:cfg2.hyst -->2<!-- /def --> % | – | hysteresis: a job holds until `pctLo + hyst`; the check reports `zuviel` (too much) only above `pctHi + hyst` | rarely | no |
| `dropSlow` | <!-- def:cfg2.dropSlow -->null<!-- /def --> %/24 h | – | if the soil dries slower than this, `pauseSlow` applies (suspected waterlogging); needs a 24 h series since the check (example 4) `[TODO am Gerät]` | measure at the plant | no |
| `dropW` | <!-- def:cfg2.dropW -->null<!-- /def --> % | – | drop from the last window reading to the check above `dropW` → hint `sink` (sinking); `null` = off | once the drainage of the setup is known | no |
| `effMin` | <!-- def:cfg2.effMin -->0.05<!-- /def --> %/s | – | floor for the effect per effective pump second; correction portions never calculate with less | rarely | no |
| `effMax` | <!-- def:cfg2.effMax -->30<!-- /def --> %/s | – | plausibility limit of the learned value `effW` (measurement run 13 Sep 2026: 5.6 %/s) | rarely | no |
| `alpha` | <!-- def:cfg2.alpha -->0.3<!-- /def --> | – | weight of the new window value when learning: `effW` = 0.7 · old + 0.3 · new; the first window takes the measurement directly | rarely | no |
| `sfMin` | <!-- def:cfg2.sfMin -->0.5<!-- /def --> | – | lower limit of the safety factor `lrn.sf` | rarely | no |
| `sfStep` | <!-- def:cfg2.sfStep -->0.1<!-- /def --> | – | step by which `sf` drops: portion 1 ends with `over`, or the check reports `zuviel` | rarely | no |
| `sfUp` | <!-- def:cfg2.sfUp -->0.05<!-- /def --> | – | step by which `sf` rises (at most 1) when the window ends with `ok` only after correction portions; if the field is missing, `sf` never rises | rarely | no |

<!-- /tabelle -->

The fast-forward run backs up `cfg2` to `zrb5` and only sets `pctDry` to `pctLo − 1`: the dry phase then ends as soon as the soil is dry enough for a job. The other fields stay as they are.

## cfg3 – pump and times

Read by `bw_main` (all fields except `winEvery`, `dryDay` are required), `bw_pump` (`tDead`, `tMin`, `tMax`, `jobAge`, `maxDay`, `tChk`, `tick`) and the installer (`tick`, `winEvery`, `winA`, `winB`, `tMax`). The "Fast-forward" column shows the profile `ZR3` from `bw_zeitraffer.js`; `winA`/`winB` stay unchanged in fast-forward mode.

<!-- tabelle:cfg3 -->

| Field | Default | Fast-forward | Effect | When to change | Installer afterwards? |
| --- | --- | --- | --- | --- | --- |
| `tick` | <!-- def:cfg3.tick -->15<!-- /def --> min | <!-- zr:cfg3.tick -->3<!-- /zr --> | working cycle of `bw_main` (schedule `0 */tick * * * *`); divisor of 60; pause tolerance and deadline use it | rarely | **yes** |
| `winA` | <!-- def:cfg3.winA -->"08:00"<!-- /def --> | unchanged | first watering window (local time, `HH:MM`); `bw_pump` starts at second 30, never alongside `bw_main` | different watering time | **yes** |
| `winB` | <!-- def:cfg3.winB -->"20:00"<!-- /def --> | unchanged | second watering window | different watering time | **yes** |
| `winEvery` | <!-- def:cfg3.winEvery -->null<!-- /def --> | <!-- zr:cfg3.winEvery -->6<!-- /zr --> min | `null` = windows at `winA`/`winB`; number N = `bw_pump` every N minutes and safety-off as a minute list (fast-forward only); divisor of 60 | never by hand | **yes** |
| `jobAge` | <!-- def:cfg3.jobAge -->20<!-- /def --> min | <!-- zr:cfg3.jobAge -->5<!-- /zr --> | the job must not be older than this in the window (`err=alt`, "old"); an aborted window (`st.why=laeuft`, "running") blocks for the same time; must stay above `tick` + 0.5 min | only together with `tick` | no |
| `soak` | <!-- def:cfg3.soak -->30<!-- /def --> min | <!-- zr:cfg3.soak -->0.25<!-- /zr --> | waiting time after the end of the window until the check by `bw_main` (`zuviel`, `sink`) | soaking time of the soil | no |
| `tDead` | <!-- def:cfg3.tDead -->20<!-- /def --> s | <!-- zr:cfg3.tDead -->2<!-- /zr --> | dead time of the first portion (filling the line); added to the dose; `kal write` enters `tRise` of the first portion (13 Sep 2026: 20 → 8) | measurement run `mess` on the final setup | no |
| `tMin` | <!-- def:cfg3.tMin -->25<!-- /def --> s | <!-- zr:cfg3.tMin -->10<!-- /zr --> | smallest first portion; a smaller dose is raised to it; `kal write` sets `max(tPmin, tDead + 2)` (13 Sep 2026: 25 → 10) | with `tDead` | no |
| `tStd` | <!-- def:cfg3.tStd -->70<!-- /def --> s | <!-- zr:cfg3.tStd -->12<!-- /zr --> | very first watering while `lrn.effW` is `null` | very small or very large pot | no |
| `tMax` | <!-- def:cfg3.tMax -->180<!-- /def --> s | <!-- zr:cfg3.tMax -->40<!-- /zr --> | sum of all portions in one window; `auto_off` = `tMax` + 10 s | pot size, pump output | **yes** |
| `tChk` | <!-- def:cfg3.tChk -->5<!-- /def --> s | <!-- zr:cfg3.tChk -->1<!-- /zr --> | interval of the water-level checks during a portion (empty → `abbruch`, abort) and while soaking (empty → `wasser`) | rarely | no |
| `pause` | <!-- def:cfg3.pause -->24<!-- /def --> h | <!-- zr:cfg3.pause -->0.2<!-- /zr --> | minimum pause after every watering (with two cycles of tolerance, see below) | plant, season | no |
| `pauseHot` | <!-- def:cfg3.pauseHot -->12<!-- /def --> h | <!-- zr:cfg3.pauseHot -->0.1<!-- /zr --> | minimum pause in heat (daily maximum today or yesterday above `tHot`, both windows possible); also the catch-up window when a window ended with `max`/`zeit` (time) and the check was below `pctLo` | rarely | no |
| `pauseSlow` | <!-- def:cfg3.pauseSlow -->48<!-- /def --> h | <!-- zr:cfg3.pauseSlow -->0.35<!-- /zr --> | minimum pause when the moisture drops by less than `dropSlow` per 24 h (suspected waterlogging) | with `dropSlow` | no |
| `tHot` | <!-- def:cfg3.tHot -->35<!-- /def --> °C | <!-- zr:cfg3.tHot -->30<!-- /zr --> | heat threshold: if the daily maximum (kept in 2 °C steps in `lrn.tMaxD`) is above it, `pauseHot` applies | location | no |
| `maxDay` | <!-- def:cfg3.maxDay -->2<!-- /def --> | <!-- zr:cfg3.maxDay -->4<!-- /zr --> | watering windows per calendar day; daily reserve `maxDay` × `tMax` pump seconds | rarely | no |
| `dryDay` | <!-- def:cfg3.dryDay -->5<!-- /def --> | <!-- zr:cfg3.dryDay -->null<!-- /zr --> | weekday of the dry phase (0 = Sunday … 6 = Saturday; `null` = never): from the first cycle of that day no watering until a reading falls below `pctDry` | plant | no |

<!-- /tabelle -->

## cfg4 – window control loop

Read only by `bw_pump`; the installer checks `tWin`/`tTail` against the cycle and builds the safety-off from them. `tPmin`, `tSoak`, `tStab` and `tDead2` come from the measurement run of 13 Sep 2026 (chapter 19), the other defaults from decision 53 (chapter 17); the "Fast-forward" column shows the profile `ZR4`.

<!-- tabelle:cfg4 -->

| Field | Default | Fast-forward | Effect | When to change | Installer afterwards? |
| --- | --- | --- | --- | --- | --- |
| `tWin` | <!-- def:cfg4.tWin -->420<!-- /def --> s | <!-- zr:cfg4.tWin -->120<!-- /zr --> | time budget per window from script start; the window including `tTail` must end before the next `bw_main` cycle | longer or shorter windows | **yes** |
| `tTail` | <!-- def:cfg4.tTail -->20<!-- /def --> s | <!-- zr:cfg4.tTail -->20<!-- /zr --> | reserve between the end of the window and the next cycle | rarely | **yes** |
| `nPort` | <!-- def:cfg4.nPort -->6<!-- /def --> | <!-- zr:cfg4.nPort -->3<!-- /zr --> | portions per window; 1 = single portion without measurement and without learning (bucket variant, sensor not in the water path) | setup | no |
| `tPmin` | <!-- def:cfg4.tPmin -->10<!-- /def --> s | <!-- zr:cfg4.tPmin -->10<!-- /zr --> | smallest correction portion; never shorter than the dead time, otherwise it only fills the hose | measurement run | no |
| `tPmax` | <!-- def:cfg4.tPmax -->120<!-- /def --> s | <!-- zr:cfg4.tPmax -->15<!-- /zr --> | longest portion (`toggle_after` in the switch-on command) | pot size | no |
| `tSoak` | <!-- def:cfg4.tSoak -->20<!-- /def --> s | <!-- zr:cfg4.tSoak -->10<!-- /zr --> | soaking after every portion before measuring (measurement run: the value settles 5 s after pump off) | measurement run (settled value) | no |
| `tStep` | <!-- def:cfg4.tStep -->5<!-- /def --> s | <!-- zr:cfg4.tStep -->5<!-- /zr --> | interval of the ring values while stabilising | rarely | no |
| `tStab` | <!-- def:cfg4.tStab -->60<!-- /def --> s | <!-- zr:cfg4.tStab -->30<!-- /zr --> | timeout of the stabilisation; afterwards the mean counts, still rising → `unstab` (unstable) | measurement run (settling time) | no |
| `nStab` | <!-- def:cfg4.nStab -->4<!-- /def --> | <!-- zr:cfg4.nStab -->3<!-- /zr --> | ring values that must lie within `dStab` for "stable"; measuring time per portion `tSoak + nStab · tStep` = 40 s | rarely | no |
| `dStab` | <!-- def:cfg4.dStab -->1<!-- /def --> % | <!-- zr:cfg4.dStab -->1<!-- /zr --> | span for "stable" (trend at most half of it); also the threshold "portion without effect" and the resolution of `tRise` | rarely | no |
| `tDead2` | <!-- def:cfg4.tDead2 -->8<!-- /def --> s | <!-- zr:cfg4.tDead2 -->0<!-- /zr --> | dead time of the follow-up portions (hose full); `kal write` enters the median of `tRise` (13 Sep 2026: 8 → 5) | calibration run | no |
| `dEffMin` | <!-- def:cfg4.dEffMin -->2<!-- /def --> % | <!-- zr:cfg4.dEffMin -->1<!-- /zr --> | sum of the effect of two full portions; below it fault `noeff` (no effect; stays until `err` is deleted) | rarely | no |

<!-- /tabelle -->

This is how the window calculates: first portion = `clamp(job.sec, tMin, min(tPmax, tMax, daily reserve − day.sec))`; after every portion soak for `tSoak` s, then measure every `tStep` s until `nStab` values lie within `dStab` (at the latest after `tStab`). Correction portion: target = `min(pctSoll, pct + (pctHi − pct) / 2)`, `sec = (target − pct) / gain + tDead2` with the gain measured in this window (at least `effMin`), clamped to `tPmin` … `min(tPmax, tMax − so far, daily reserve)`.

Without `pct` in the job, with `nPort` 1 or an incomplete band, `bw_pump` pumps a single portion `clamp(job.sec, 1, min(tPmax, tMax))` without measurement and without learning. The results (`ok`, `over`, `max`, `zeit`, `stall` (no gain), `unstab`, `noeff`, `wasser`) are explained in chapter 13.

## State entries lrn, st, job, day, err

Written only by the scripts; the installer creates them with defaults. Two manual interventions make sense: set `lrn.effW` to `null` after a new calibration and delete `err` on `noeff`.

<!-- tabelle:lrn -->

| `lrn` | Default | Meaning | Written by |
| --- | --- | --- | --- |
| `effW` | <!-- def:lrn.effW -->null<!-- /def --> | % moisture per effective pump second (window scale): per window new = Δmoisture / effective seconds, clamped `effMin` … `effMax`, then blended with `alpha`; `null` → first portion `tStd` | `bw_pump` at the end of the window, `kal write` |
| `sf` | <!-- def:lrn.sf -->0.7<!-- /def --> | safety factor of the first portion: deliberately starts below the target; − `sfStep` on `over` with one portion or `zuviel`, + `sfUp` on `ok` after ≥ 2 portions; clamped `sfMin` … 1 | `bw_pump`, `bw_main` (check) |
| `rate` | <!-- def:lrn.rate -->null<!-- /def --> | drying in %/h since the check, only after a 24 h series | `bw_main` at the day change |
| `tMean` | <!-- def:lrn.tMean -->null<!-- /def --> | smoothed daily maximum (0.9 old + 0.1 new), season indicator | `bw_main` at the day change |
| `tMaxD` | <!-- def:lrn.tMaxD -->null<!-- /def --> | today's daily maximum in 2 °C steps (saves writes; exceeding `tHot` is captured exactly) | `bw_main` every cycle |
| `tMaxY` | <!-- def:lrn.tMaxY -->null<!-- /def --> | yesterday's daily maximum – the heat rule at 08:00 needs the previous day | `bw_main` at the day change |

<!-- /tabelle -->

An old `eff` from 0.1.x stays in `lrn` and is ignored.

<!-- tabelle:st -->

| `st` | Default | Meaning |
| --- | --- | --- |
| `state` | <!-- def:st.state -->"beob"<!-- /def --> | `beob` (observing) · `gegossen` (watered, check pending) · `sperre` (blocked: pause or dry phase) |
| `ts` | <!-- def:st.ts -->null<!-- /def --> | Unix time of the window start (claim); the pause counts from here |
| `sec` | <!-- def:st.sec -->null<!-- /def --> | pump seconds of the window |
| `pctB` | <!-- def:st.pctB -->null<!-- /def --> | fresh reading `m0` before the first portion |
| `pctA` | <!-- def:st.pctA -->null<!-- /def --> | moisture at the check (`soak` min after the window) |
| `rated` | <!-- def:st.rated -->false<!-- /def --> | check done |
| `dryOk` | <!-- def:st.dryOk -->false<!-- /def --> | dry phase finished (reading below `pctDry`) |
| `dur`, `n`, `pctW`, `effW`, `why`, `tr` | – (set by `bw_pump`) | window duration until pump off · portions · last stable reading · effect of this window · result (`laeuft` = in progress or aborted) · seconds until the first sensor reaction in portion 2 |

<!-- /tabelle -->

<!-- tabelle:job -->

| `job` | Default | Meaning |
| --- | --- | --- |
| `ok` | <!-- def:job.ok -->false<!-- /def --> | `true` = watering job pending; `bw_pump` sets `false` after the window |
| `sec` | <!-- def:job.sec -->null<!-- /def --> | requested first portion in s (dose formula or `tStd`) |
| `pct` | <!-- def:job.pct -->null<!-- /def --> | moisture at the decision; without `pct` `bw_pump` waters a single portion |
| `why` | <!-- def:job.why -->"init"<!-- /def --> | reason from `bw_main` (`ok`, `feucht` moist, `pause`, `trocken` dry phase, `cfg`, `uhr` clock, `sensor`, `wasser` water, `limit`, `soak`, `lvl` level unstable, `err:<code>`) or the window result from `bw_pump` |
| `ts` | <!-- def:job.ts -->null<!-- /def --> | time of the job; `bw_pump` checks it against `jobAge` |

<!-- /tabelle -->

<!-- tabelle:day -->

| `day` | Default | Meaning |
| --- | --- | --- |
| `date` | <!-- def:day.date -->null<!-- /def --> | local date `YYYY-MM-DD`; `bw_main` detects the day change from it (no separate schedule entry) |
| `n` | <!-- def:day.n -->0<!-- /def --> | watering windows today (`maxDay`) |
| `sec` | <!-- def:day.sec -->0<!-- /def --> | pump seconds today, including partial portions (daily reserve) |

<!-- /tabelle -->

<!-- tabelle:err -->

| `err` | Default | Meaning |
| --- | --- | --- |
| `code` | <!-- def:err.code -->null<!-- /def --> | last fault: blocking `cfg`, `uhr` (clock), `sensor`, `wasser` (water), `noeff`; hints `temp`, `zuviel`, `sink`, `alt`, `limit`. `noeff` is never overwritten, a blocking code displaces a hint; among the blocking ones cfg > uhr > sensor > wasser |
| `ts` | <!-- def:err.ts -->null<!-- /def --> | time |
| `mem` | <!-- def:err.mem -->null<!-- /def --> | free RAM in bytes at the fault and once a day (makes a memory leak visible) |

<!-- /tabelle -->

## Backups and test entries

The backups `zrb1`…`zrb5`, `zr`, `hwc`, `hwb1`, `hwb2` exist only during a fast-forward run (chapter 12) or a hardware check (chapter 11); `hwt`, `hwr`, `hwp` stay after `hwtest.js cleanup` as a record. All are JSON strings like the other entries.

| Entry | Content | Who |
| --- | --- | --- |
| `zrb1` … `zrb5` | copies of `cfg3` · `lrn` + `day` · `st` + `err` · `cfg4` · `cfg2` | `bw_zeitraffer` writes them once; `bw_install` restores from them and deletes them |
| `zr` | start marker `{"go":1}`, written last | `bw_install` deletes it when building the fast-forward schedule; backup without marker = return to normal |
| `hwt` | thresholds and times of the hardware checks (table below) | the test script creates the defaults; change with `node tools/hwtest.js <ip> cfg tLo=21` |
| `hwc` | `n` counter · `cmd` `go` / `skip` / `abort` | command to the running test script; only an `n` greater than the last one seen takes effect |
| `hwr`, `hwp` | status and report of the sensor or pump test (codes `ok`, `sk`, `to`, `ab`, `fe`, `nl`, `aw`) | `bw_hwtest`, `bw_hwpump`; `hwtest.js report` formats them |
| `hwb1`, `hwb2` | copies of `st` + `day` and `job` + `err` + `lrn` | `bw_hwpump` pass A backs up, pass B or `hwtest.js restore` restores |

<!-- tabelle:hwt -->

| `hwt` | Default | Meaning |
| --- | --- | --- |
| `tLo` | <!-- hwt:tLo -->20<!-- /hwt --> °C | phase t1: probe cold, `nStab` readings ≤ `tLo` |
| `tHi` | <!-- hwt:tHi -->30<!-- /hwt --> °C | phase t2: probe warm, `nStab` readings ≥ `tHi` |
| `vDryMax` | <!-- hwt:vDryMax -->0.5<!-- /hwt --> V | phase m1: the dry point must be below it |
| `vWetMin` | <!-- hwt:vWetMin -->2.5<!-- /hwt --> V | phase m2: the wet point must be above it |
| `dV` | <!-- hwt:dV -->0.03<!-- /hwt --> V | span of the last `nStab` readings for "stable" |
| `nStab` | <!-- hwt:nStab -->5<!-- /hwt --> | identical or stable ticks per phase |
| `nNull` | <!-- hwt:nNull -->10<!-- /hwt --> | ticks without a reading → result `nl` |
| `msTick` | <!-- hwt:msTick -->1000<!-- /hwt --> ms | tick of the test timer |
| `nCmd` | <!-- hwt:nCmd -->2<!-- /hwt --> | ticks per poll of `hwc` |
| `nLog` | <!-- hwt:nLog -->5<!-- /hwt --> | ticks per console line |
| `tPhase` | <!-- hwt:tPhase -->900<!-- /hwt --> s | timeout per phase → `to` |
| `tAll` | <!-- hwt:tAll -->3600<!-- /hwt --> s | timeout of the whole test → `ab` |
| `pumpSec` | <!-- hwt:pumpSec -->30<!-- /hwt --> s | test job of the pump test (at most `cfg3.tMax`) |
| `tOn` | <!-- hwt:tOn -->20<!-- /hwt --> | reserved – not read by any script |
| `guardS` | <!-- hwt:guardS -->90<!-- /hwt --> s | time guard of the pump test: not in the first `guardS` s of a 15-minute cycle and not in the last `guardS` + `pumpSec` s |
| `winMin` | <!-- hwt:winMin -->25<!-- /hwt --> min | distance to `winA`, `winB` and midnight within which the pump test does not start |
| `cal` | <!-- hwt:cal -->1<!-- /hwt --> | 1 = `bw_hwtest` writes plausible `vDry`, `vWet`, `lvlEmpty` to `cfg1`; 0 = report only |
| `run` | <!-- hwt:run -->"tml"<!-- /hwt --> | phase groups: t temperature, m moisture, l water level (`"m"` = moisture only) |

<!-- /tabelle -->

`bw_hwpump` uses only `msTick`, `nCmd`, `nLog`, `tPhase`, `tAll`, `pumpSec`, `guardS` and `winMin` from `hwt`.

## Derived values

These numbers are not stored in any KVS field; they follow from the fields above. `PUMP_SEC` = 30 is the only fixed clock time in the schedule (`bw_install.js`: `bw_pump` starts 30 s after the full minute so that it never runs alongside `bw_main`); apart from it there are only the fixed reserves of 10 s (`safeSec`, `auto_off`) and the 24 h minimum series for `lrn.rate`.

| Quantity | Formula | Normal | Fast-forward |
| --- | --- | --- | --- |
| Schedule `bw_main` | `0 */tick * * * *` | `0 */15 * * * *` | `0 */3 * * * *` |
| Schedule `bw_pump` | `30 M hA,hB * * *` if both windows share the minute, otherwise two entries; fast-forward `30 */winEvery * * * *` | `30 0 8,20 * * *` | `30 */6 * * * *` |
| Safety-off (`Switch.Set` off, without a script) | `safeSec` = 30 + `tWin` + 10 s after the window minute; normally rounded up to full minutes (`SAFE_MIN`), fast-forward as a minute list with a seconds field | 460 s → `SAFE_MIN` 8 → `0 8 8,20 * * *` | 160 s → `40 2,8,14,20,26,32,38,44,50,56 * * * *` |
| Schedule entries | 3 if `winA` and `winB` share the minute, otherwise up to 5; the device assigns the IDs (console `Zeitplan #<id>: <timespec>`) | 3 | 3 |
| `auto_off` (switch configuration) | `tMax` + 10 s, the output switches itself off after every switch-on | 190 s | 50 s |
| Window rule (checked by the installer, otherwise `err=cfg`) | `(window minute mod tick) · 60 + 30 + tWin + tTail ≤ tick · 60` | 0 + 30 + 420 + 20 = 470 ≤ 900; a window at 08:05 fits (770), one at 08:10 does not (1,070) | 30 + 120 + 20 = 170 ≤ 180; additionally 30 + `tWin` + 10 < `winEvery` · 60 (160 < 360) |
| Deadline `B` in `bw_pump` | `min(tWin, tick · 60 − q − tTail)`, q = seconds since the last cycle; a portion starts only if `elapsed + sec + tSoak + nStab · tStep ≤ B`, otherwise `why=zeit` (time) | q = 30 → min(420, 850) = 420 s; measuring time 20 + 4 · 5 = 40 s | min(120, 130) = 120 s; measuring time 10 + 3 · 5 = 25 s |
| Pause tolerance | `(now + 2 · tick · 60) − st.ts ≥ pause · 3600` – the job is created one cycle before the window | 30 min lead | 6 min |
| `jobAge` condition | job from the cycle before the window, window up to `tick` min + 30 s later: `jobAge` > `tick` + 0.5 min; `bw_main` always rewrites the job in the cycle before a window | 15.5 min < 20 | 3.5 min < 5 |
| Dose of the first portion | `clamp(round((pctSoll − pct) / effW · sf + tDead), tMin, tMax)`; without `effW` → `tStd` | device values 13 Sep 2026: cycle reads 30 % → (55 − 30) / 4.46 · 0.7 + 8 ≈ 12 s | – |
| Daily reserve | `maxDay` × `tMax` pump seconds minus `day.sec` | 360 s | 160 s |

## Editing the KVS

1. Read: `http://<ip>/rpc/KVS.GetMany?match=*` in the browser (the device returns 11 entries per page) or `tools/kvs_dump.sh <ip>`, which prints all pages plus `kvs_rev` (write counter).
2. Web UI: Settings → Key-Value Storage → open the entry → **tick "Format as JSON"** → change the field → save. Without the tick the web UI shows the JSON text as a plain string; `[object Object]` means the value is not a string (see Typical problems).
3. Via RPC before the installer (a partial object is enough, the installer fills in the rest):

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg1","value":"{\"vDry\":0.296,\"vWet\":3.134}"}'   # calibration points of 13 Sep 2026
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctSoll\":55,\"pctLo\":40,\"pctOk\":50,\"pctHi\":60,\"pctDry\":28,\"dropSlow\":4}"}'   # example band
node tools/hwtest.js <ip> normal 60          # start the installer in a safe moment, it fills in the missing fields
curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"err"}'   # delete fault noeff (bw_main recreates err in the next cycle)
```

4. Changing a single field during operation: web UI with "Format as JSON", or write the whole entry with `KVS.Set`. After `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin`, `tTail` or `cfg1.idSw` start the installer (step 3, last line).
5. Verify: Web UI → Schedules shows the three entries from the table above; the first console line of `bw_main` shows `err=-` and `why=ok` or `why=feucht`.

## Example output

Installer <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> in the mock with the two partial objects from step 3 (`node tools/run-script.js scripts/bw_install.js --kvs 'cfg1=…' --kvs 'cfg2=…'`): missing fields are completed (`ergänzt`), the other entries are created (`neu angelegt`). On the device the firmware assigns the schedule IDs itself.

```text
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] KVS cfg1 ergänzt: vErrLo,vErrHi,nSample,msSample,lvlEmpty,nLvl,idV,idT,idLvl,idSw
[bw_install 0.1.3] KVS cfg2 ergänzt: hyst,effMin,effMax,alpha,sfMin,sfStep,dropW,sfUp
[bw_install 0.1.3] Zeitplan: 0 Einträge, davon eigene: 0
[bw_install 0.1.3] Switch 0: auto_off 190 s
[bw_install 0.1.3] KVS neu angelegt: cfg3, cfg4, lrn, st, job, day, err
[bw_install 0.1.3] Zeitplan #1: 0 */15 * * * *
[bw_install 0.1.3] Zeitplan #2: 30 0 8,20 * * *
[bw_install 0.1.3] Zeitplan #3: 0 8 8,20 * * *
[bw_install 0.1.3] fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach
```

`kal write` from the recording of 13 Sep 2026 (`docs/kal/2026-09-13-13-50-kal.json` with console log, calculation core `tools/lib/kal.js` against the defaults): four fields in three entries via read-modify-write (`vorher` = before, `nachher` = after).

```text
Konsolenzeilen aus docs/kal/2026-09-13-13-50-kal-log.txt: 5
Aufzeichnung: docs/kal/2026-09-13-13-50-kal.json
  lrn.effW null → 4.46 (Messwert)
  cfg4.tDead2 8 → 5 s
  cfg3.tDead 20 → 8 s (tRise der Erstportion; Endaufbau mit anderem Schlauch: mess)
  cfg3.tMin 25 → 10 s (max(tPmin, tDead + 2))
vorher:  lrn={"effW":null,"sf":0.7,"rate":null,"tMean":null,"tMaxD":null,"tMaxY":null} cfg4={"tWin":420,"tTail":20,"nPort":6,"tPmin":10,"tPmax":120,"tSoak":20,"tStep":5,"tStab":60,"nStab":4,"dStab":1,"tDead2":8,"dEffMin":2} cfg3.tDead=20
nachher: lrn={"effW":4.46,"sf":0.7,"rate":null,"tMean":null,"tMaxD":null,"tMaxY":null} cfg4={"tWin":420,"tTail":20,"nPort":6,"tPmin":10,"tPmax":120,"tSoak":20,"tStep":5,"tStab":60,"nStab":4,"dStab":1,"tDead2":5,"dEffMin":2} cfg3.tDead=8
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `why=cfg`, `err=cfg` after a script update; console `cfg4.tWin fehlt` or `cfg3.tick fehlt` (missing) | new fields are missing in the KVS | start `bw_install` once (`hwtest.js <ip> normal 60`); it only creates `pctOk` as `null` – enter the value by hand |
| `why=cfg` although all band fields are set; console `cfg2: Band ungültig` (band invalid) | order violated, often `pctLo + hyst < pctOk` | check the band in band order: `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` |
| Web UI shows `[object Object]`, saving makes it worse | value is not a JSON string (entry from 0.1.0 or written as an object via RPC); the installer keeps object values because `fromKvs()` passes them through – only the written-back text `[object Object]` is replaced by defaults (the console reports it only in the final line `KVS neu angelegt: …`) | delete the entry (`curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"cfg2"}'`) or rewrite it as a JSON string via `KVS.Set`, then start `bw_install` (`hwtest.js <ip> normal 60`) and enter your own values |
| After `KVS.Set` with a partial object other fields are missing (`cfg2.hyst fehlt`) | `KVS.Set` replaces the whole entry | run the installer again (it completes) or change only the field in the web UI |
| Installer aborts: `cfg3.winA 08:10: 30 + tWin 420 + tTail 20 s passen nicht in den Takt (tick 15 min)` (do not fit into the cycle) | window does not end before the next cycle | put the window minute on a multiple of `tick`, reduce `tWin` or increase `tick` |
| Installer aborts: `Script bw_main läuft – später erneut starten` (running – start again later), `err=cfg` is set | started during a cycle or window | `hwtest.js <ip> normal 60` waits for a safe moment; `bw_main` clears `err` in the next cycle |
| Dose far too large or too small after a new calibration | `lrn.effW` comes from the old percentage scale | set `effW` to `null` or repeat `kal write` |
| `err=noeff` stays despite the repair | `noeff` is never cleared automatically | check pump, hose, sensor position, then `KVS.Delete err` |
| Schedule shows old times after changing `winA` | installer not started | start `bw_install`; it deletes its own entries (recognised by `Script.Start` on `bw_main`/`bw_pump`, `Switch.Set`) and creates them anew |

## Next

- [02 · Flow](02-flussdiagramm.md) – when each value comes into play during the day
- [11 · Hardware check](11-hardware-check.md) – have `cfg1` measured instead of guessed
- [12 · First commissioning](12-erstinbetriebnahme.md) – find the target band, calibration run, fast-forward
- [13 · Operation and maintenance](13-betrieb-und-wartung.md) – read the console, decode `why` and `err` codes
