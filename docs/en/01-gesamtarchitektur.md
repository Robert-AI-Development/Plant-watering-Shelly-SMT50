# 01 · Overall architecture

[Deutsch](../de/01-gesamtarchitektur.md) · **English** — [Handbook](README.md) · Part A "Understand"

> **At a glance**
> - A Shelly Plus Uni measures soil moisture, temperature and water level and waters one plant on its own – locally, no cloud; only the time comes from the internet via NTP. It learns the effect of one pump second, adapts the pause to summer and winter via the temperature and clears waterlogging with a weekly dry phase – made for house and balcony plants while you are on holiday.
> - Six scripts, none of them runs permanently: the device schedule starts `bw_main` every <!-- def:cfg3.tick -->15<!-- /def --> min for a few seconds and `bw_pump` in the watering window for at most `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s; a human starts `bw_install`, the two hardware-test scripts and the fast-forward script by hand.
> - One memory: nine entries in the device KVS (`cfg1`…`cfg4`, `lrn`, `st`, `job`, `day`, `err`), nothing in RAM.
> - Cycle every <!-- def:cfg3.tick -->15<!-- /def --> min (`bw_main` measures and decides), watering windows at <!-- def:cfg3.winA -->08:00<!-- /def --> and <!-- def:cfg3.winB -->20:00<!-- /def --> (`bw_pump` waters in portions).
> - Biggest pitfall: `bw_main` never waters, and the schedule only starts scripts – water flows only when a job with `ok=true` is waiting in the window and every clearance passes.

## Prerequisites

- none – a reading chapter; parts list and wiring follow in [05 · Wiring and hardware build](05-verkabelung-und-aufbau.md)

## Diagram

[![Overall architecture: sensors, operating scripts, schedule, KVS and pump on the Shelly Plus Uni](../diagramme/en/01-gesamtarchitektur.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/01-gesamtarchitektur.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/01-gesamtarchitektur.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Measure and decide", 2 "Watering in the window", 3 "Safety without a script", 4 "From outside". The picture shows normal operation; the three test scripts (`bw_hwtest`, `bw_hwpump`, `bw_zeitraffer`) are not in it because they serve only for testing and are never in the schedule.

## The parts

Everything connects directly to the Shelly Plus Uni. The component IDs in brackets are the defaults in `cfg1` (`idV`, `idT`, `idLvl`, `idSw`); if your device differs, enter the IDs there.

| Part | Job | Connection on the Shelly |
| --- | --- | --- |
| Shelly Plus Uni | measures, computes, switches; firmware 2.0.0 | supply 12 V DC (the device accepts 9–28 V) |
| Trübner SMT50 | soil moisture as a 0–3 V voltage | ANALOG IN, voltmeter range 0–15 V (`voltmeter:100`) |
| DS18B20, waterproof | ambient temperature for the heat rule and the pause | 1-Wire (`temperature:100`) |
| Float switch | water level in the tank: LEER (empty) or VOLL (full) | IN2 to GND, type "Switch" (`input:1`) |
| Relay 12 V, coil < 300 mA | isolates the Shelly output from the pump | OUT1, potential-free, contact ≤ 30 V / 300 mA (`switch:0`) |
| Pump (Gardena holiday watering set 970548801) | delivers water to the drippers | on the relay contact, never directly on the Shelly |
| Power supply 12 V DC, ≥ 1 A | powers Shelly, SMT50 and relay coil | – |

The sensor voltage becomes moisture in percent: `pct = (V − vDry) / (vWet − vDry) × 100`. The two calibration points are defaults in `cfg1` (`vDry` <!-- def:cfg1.vDry -->0.20<!-- /def --> V in air, `vWet` <!-- def:cfg1.vWet -->3.13<!-- /def --> V in water) and are measured on your own setup ([11 · Hardware check](11-hardware-check.md)). Sensor limits: [04 · Safety and limits](04-sicherheit-und-grenzen.md).

## Six scripts, one schedule, one memory

### The scripts

Three scripts carry the operation, three help with testing. All of them sit on the device as the compact build from `dist/` and state their version in line 1. The installer finds `bw_main` and `bw_pump` by name; the script IDs are assigned by the device.

| Script | Version | Who starts it | Job |
| --- | --- | --- | --- |
| `bw_install` | <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> | human, any number of times | adds missing KVS entries and fields (overwrites nothing), builds the schedule from `cfg3`/`cfg4`, sets `auto_off`, brings operation back from fast-forward; stops itself |
| `bw_main` | <!-- fact:ver.bw_main -->0.2.0<!-- /fact --> | schedule, every `tick` min | measures moisture, temperature and water level, checks band and faults, runs the check, dry phase and pause, writes the job `job` with reason `job.why`. Never switches the pump |
| `bw_pump` | <!-- fact:ver.bw_pump -->0.2.0<!-- /fact --> | schedule, `winA`/`winB` at second 30 | reads `job`, checks the clearances, takes a fresh reading, waters in portions with re-measuring, learns `lrn.effW`/`lrn.sf`, writes `st`/`day` and consumes the job |
| `bw_hwtest` | <!-- fact:ver.bw_hwtest -->0.1.0<!-- /fact --> | human (`tools/hwtest.js`) | sensor test in six phases (probe cold/warm, sensor dry/wet, float switch LEER/VOLL); writes the calibration points to `cfg1` |
| `bw_hwpump` | <!-- fact:ver.bw_hwpump -->0.1.0<!-- /fact --> | human (`tools/hwtest.js`) | pump test in two passes: backs up the state, writes a test job, starts `bw_pump`; later evaluates and restores. Never switches the pump itself |
| `bw_zeitraffer` | <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact --> | human (`tools/hwtest.js zeitraffer`) | backs up `cfg2`…`cfg4`, `lrn`, `st`, `day`, `err` to `zrb1`…`zrb5`, writes short times (cycle <!-- zr:cfg3.tick -->3<!-- /zr --> min, window every <!-- zr:cfg3.winEvery -->6<!-- /zr --> min) and starts `bw_install` |

> **Note:** The three test scripts are needed only for the hardware check ([11](11-hardware-check.md)) and first commissioning ([12](12-erstinbetriebnahme.md)) and cost flash. On the reference device, deleting `engine_probe`, `bw_hwtest` and `bw_hwpump` (three of seven scripts) on 13 Sep 2026 raised free flash from 12 288 to 49 152 B; `bw_zeitraffer` stayed.

### The schedule

The device schedule (`Schedule`) is the only clock. In normal operation the installer creates three entries; a timespec reads as second, minute, hour, day, month, weekday.

| Entry | Timespec | Effect |
| --- | --- | --- |
| Cycle | `0 */15 * * * *` | `Script.Start` on `bw_main`, every `tick` min at the full minute |
| Watering window | `30 0 8,20 * * *` | `Script.Start` on `bw_pump` at 08:00:30 and 20:00:30 – 30 s after `bw_main`, so the two never run at the same time |
| Safety-off | `0 8 8,20 * * *` | `Switch.Set` off, 8 min after the window minute (30 s + `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s + 10 s, rounded up to full minutes); works without any script |

If `winA` and `winB` do not share the same minute, there are up to five entries. After every change of `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin` or `tTail`, `bw_install` must run again, because only the installer builds the schedule (from `tick`, `winEvery`, `winA`/`winB`, `tWin`), sets `auto_off` from `tMax` and checks with `tTail` that a window fits into the cycle.

> **Fast-forward only:** The same scripts with short times – `0 */3 * * * *` (cycle), `30 */6 * * * *` (window), `40 2,8,14,…,56 * * * *` (safety-off). This shows a whole watering day in 45 minutes ([12 · First commissioning](12-erstinbetriebnahme.md)).

### The memory (KVS)

Everything one cycle needs to know from the previous one lives in the device's key-value store (KVS) – as a JSON string per entry, so the web UI shows it readably. According to the Shelly docs the KVS is persistent storage; every write goes to flash, which is why the scripts write only what has changed. Whether state and schedule survive a power cut is verified on the device in [13 · Operation and maintenance](13-betrieb-und-wartung.md) `[TODO am Gerät]`.

| Entry | Content | Who writes |
| --- | --- | --- |
| `cfg1` | sensor and calibration: `vDry`, `vWet`, component IDs | installer (defaults), `bw_hwtest`, human |
| `cfg2` | target band `pctDry < pctLo < pctOk ≤ pctSoll < pctHi`, learning parameters | human (band), installer (remaining fields), `bw_zeitraffer` (`pctDry` during fast-forward) |
| `cfg3` | pump and times: `tick`, `winA`/`winB`, `tMax`, pauses, `maxDay` | installer, human, `bw_zeitraffer` |
| `cfg4` | window control loop: `tWin`, `nPort`, portions, soaking, stability | installer, human, `bw_zeitraffer` |
| `lrn` | learned values: `effW` (percent moisture per pump second), `sf` (safety factor) | `bw_pump`, `bw_main` (check) |
| `st` | state and result of the last window: `state`, `ts`, `why` | `bw_pump`, `bw_main` |
| `job` | job from `bw_main` to `bw_pump`: `ok`, `sec`, `pct`, `why`, `ts` | `bw_main` writes, `bw_pump` consumes |
| `day` | daily counters: windows `n` and pump seconds `sec` | `bw_main` (day change), `bw_pump` |
| `err` | fault code – blocking `cfg`, `uhr` (clock), `sensor`, `wasser` (water), `noeff` (no effect); notices `temp`, `zuviel` (too much), `sink` (dropping), `alt` (stale), `limit` – with timestamp and memory reading | `bw_main`, `bw_pump`, installer (`cfg`) |

Further entries appear temporarily: during fast-forward the backups `zrb1`…`zrb5` and the marker `zr`; during the hardware tests `hwt` (thresholds), `hwc` (commands), `hwr`/`hwp` (reports) and the backups `hwb1`/`hwb2`. Device limits: 50 keys, at most 253 characters per value (`kvs-size.test.js` checks every entry). Every field with default and effect: [03 · Configuration](03-konfiguration.md).

## Why one-shot runners

Permanently running scripts crashed on the Shelly after a few hours – the concept grew out of that experience. So no operating script runs permanently: `bw_main` and `bw_install` finish within a few seconds, `bw_pump` ends at the latest with the deadline before the next cycle (at most `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s). Each one reads the KVS, works through a fixed chain of steps, writes changes back and ends with `Script.Stop`. If a cycle crashes anyway, the schedule starts the next one as usual – a failure costs one cycle, not the operation.

Three device limits shape the pattern – heap and stack measured on the device, the code size limit set as a safety margin:

| Limit | On the device | Consequence in the code |
| --- | --- | --- |
| Shared heap | about 25 KB for all scripts together (`Script.GetStatus` reports `mem_free` 24 920 when idle); two large scripts starting in the same second end with `out_of_memory` | `bw_pump` starts 30 s after `bw_main`; the test scripts release their KVS objects while waiting |
| Shallow stack | the mJS script engine tolerates 12 nested calls and crashes at 14 | step chains run as a flat loop (`next()`), never as recursion; the mock already aborts at <!-- fact:call_depth -->10<!-- /fact --> levels |
| Code size | safety margin of <!-- fact:size_limit -->16 000<!-- /fact --> B per script (`bw_main` currently <!-- fact:dist.bw_main -->15 791<!-- /fact --> B); the firmware also stores 19 KB | only the compact build from `dist/` goes to the device (comments and indentation removed, short docs kept); `bw_pump` may be <!-- fact:size_limit_pump -->18 000<!-- /fact --> B, because thanks to the deadline it never runs next to `bw_main` |

> **Measured on the device (13 Sep 2026):** `bw_main` 0.2.0 takes 5 660 ms per cycle and writes 3 KVS entries; `bw_pump` 0.2.0 (<!-- fact:dist.bw_pump -->17 475<!-- /fact --> B) reaches a heap peak of 12 516 B in the window with 25 200 B free. Before that, `bw_main` 0.1.2 with a 16 380 B peak had starved a `bw_pump` starting in the same second – hence the pump start at second 30.

## Why bw_main and bw_pump are separate

The measuring and learning logic can never trigger the pump by accident: `bw_main` contains no `Switch.Set` call. It only decides and puts the decision into the KVS as the job `job` – with `ok`, pump seconds `sec`, measured moisture `pct`, reason `why` and timestamp `ts`.

In the window, `bw_pump` is a checker in its own right. It waters only if `ok` is true, the job is at most `jobAge` <!-- def:cfg3.jobAge -->20<!-- /def --> min old, no blocking fault is set, the daily limit `maxDay` <!-- def:cfg3.maxDay -->2<!-- /def --> is not reached, the float switch reports VOLL and the fresh reading is below `pctOk`. Then it consumes the job – one window, one dose.

The two are separated in time as well: `bw_pump` starts at second 30 and computes a deadline that ends before the next cycle – budget `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s, reserve `tTail` <!-- def:cfg4.tTail -->20<!-- /def --> s. When creating the schedule, the installer checks that window plus reserve fit into the cycle.

Before the first portion, `bw_pump` writes the claim `st.why=laeuft` (running) to the KVS. If the script dies in the middle of the window, `bw_main` sees the claim, keeps the pause and learns nothing from the half window.

The pump is switched off without any script, three times over: `toggle_after` in every switch-on command (at most `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s per portion), `auto_off` in the switch configuration (`tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s + 10 s = 190 s) and the safety-off in the schedule. Why that is enough: [04 · Safety and limits](04-sicherheit-und-grenzen.md); what happens in a day: [02 · Flow](02-flussdiagramm.md).

## What comes from outside

The scripts open no network connection; every connection goes from outside to the Shelly. Only one thing needs the internet: the time.

| From outside | Path | Purpose |
| --- | --- | --- |
| NTP | internet | valid time for schedule and timestamps; without a clock, fault `uhr` and no dose |
| Shelly web UI | browser on the LAN | create and start scripts, edit KVS entries ("Format as JSON"), view the schedule, read the console |
| HTTP RPC | `http://<ip>/rpc/<Method>` via `curl` or a tool | everything the web UI can do, as a command: `KVS.Get`, `Script.Start`, `Schedule.List` … |
| Debug websocket | `tools/console.js`, `tools/hwtest.js watch` | follow the scripts' console lines; the console must be switched on in the web UI |
| Tools in `tools/` | Node ≥ 20, for `hwtest.js` and `console.js` ≥ 22; no dependencies | `build.js` (compact build), `put-script.js` (upload with byte check), `verify-scripts.js`, `hwtest.js`, `run-script.js` |
| Mock and tests | `npm test` on the PC | the device modelled in Node (KVS, schedule, switch, sensors, clock); <!-- fact:tests -->146<!-- /fact --> tests without a device |
| Claude Code | reverse SSH tunnel `127.0.0.1:8010` | the same tools from a server: installation as an interview, live debugging on the device ([09](09-installation-vps.md), [10](10-installation-claude-code.md)) |

## Example output

This is what one cycle looks like – the first line is written by `bw_main`, the other two by `bw_pump` in the window that follows (fast-forward run of 13 Sep 2026, 15:51 to 15:56):

```text
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
```

How to read it: `V` sensor voltage, `pct` moisture, `tC` temperature, `lvl=0` water present, `st=beob` state "observing", `why=ok` job written, `sec=12` pump seconds, `w=3` KVS writes, `dauer` runtime. In the window (`Fenster: Auftrag` = window: job), `bw_pump` waters two portions (`n=2`, 22 s in total) and learns `effW=2.006`; `ergebnis` is the window result. All fields and codes: [13 · Operation and maintenance](13-betrieb-und-wartung.md).

> **Fast-forward only:** `pause=0.2h` and `Frist 120 s` (deadline) come from the test profile; in normal operation they read `pause=24h` and `Frist 420 s`. Source: [console log of 13 Sep 2026](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/docs/kal/2026-09-13-13-50-kal-log.txt).

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `bw_main` reports `why=ok`, but no water flows | `bw_main` never waters; the job waits for the next window at 08:00:30 or 20:00:30 | wait for the window and read the `ergebnis=` console line of `bw_pump` |
| "The schedule says 08:00, so it waters at 08:00" | the schedule only starts `bw_pump`; without a job or with `feucht` (moist), `wasser` (tank empty), `limit` it does not water | look at `job.why` and `st.why` in the KVS; meaning of the codes in [13 · Operation and maintenance](13-betrieb-und-wartung.md) |
| After changing `winA` it still waters at the old time | only the installer builds the schedule | `node tools/hwtest.js <ip> normal 30` starts `bw_install` at a safe moment |
| `bw_pump` ends without a console line, `Script.GetStatus` shows `out_of_memory` | a second large script was running at the same time (test script, permanent run) | never two large scripts at once; start test scripts only away from cycle and window |
| An operating script is set to "Run on startup" | only the schedule starts operating scripts; autostart runs right after a restart without a valid clock (`err=uhr`) and outside the cycle | switch autostart off – the installer switches it off for `bw_main` and `bw_pump` itself |
| A KVS value shows as `[object Object]` in the web UI | value written as an object instead of a JSON string | rewrite the entry as a JSON string ([03 · Configuration](03-konfiguration.md)) |

## Next

- [02 · Flow: cycle, job, window, check, pause](02-flussdiagramm.md) – what the device does in a day and why it is not watering right now
- [05 · Wiring and hardware build](05-verkabelung-und-aufbau.md) – connecting the parts
- [06 · Step-by-step start guide](06-startanleitung.md) – from the wired device to the first watering window
