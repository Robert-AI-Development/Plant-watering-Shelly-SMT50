# 06 · Step-by-step start guide

[Deutsch](../de/06-startanleitung.md) · **English** — [Handbook](README.md) · Part C "Install"

> **At a glance**
> - Outcome: from the wired Shelly to the first watering window you follow on the console – in ten fixed steps, the same for all four installation routes 07 to 10.
> - Scope: ten steps at the computer and at the pot; after that you only wait for the next window at <!-- def:cfg3.winA -->08:00<!-- /def --> or <!-- def:cfg3.winB -->20:00<!-- /def --> (pump start at second 30).
> - Key number: `bw_main` measures every <!-- def:cfg3.tick -->15<!-- /def --> min – and waters only once all six band fields in `cfg2` are set (until then `why=cfg`, reason "configuration incomplete").
> - Biggest pitfall: the web editor loses text when you paste (`Got EOF`). So run `node tools/verify-scripts.js <ip>` after every upload – the code on the device must be byte-identical.

## Prerequisites

- Hardware wired as in [05 · Wiring and hardware build](05-verkabelung-und-aufbau.md): the web UI shows a voltage on the voltmeter, a temperature from the DS18B20 and changes on the float-switch input.
- Shelly Plus Uni on Wi-Fi, time set via NTP, time zone correct – the windows are local time. Without a valid clock `bw_main` reports `err=uhr` (clock fault) and the schedule stands still.
- A computer with Node ≥ 20 for `npm run build`, `put-script.js` and `verify-scripts.js`; Node ≥ 22 for `hwtest.js` and `console.js` (global `WebSocket`). No dependencies. Route 07 needs no Node at all because `dist/` is checked in.
- Debug websocket on: web UI → Scripts → any script → open the console (turns on `debug.websocket.enable`; `node tools/hwtest.js <ip> preflight` reports "Debug-Websocket an/aus", on/off). Without it `watch`, `console.js` and the `kal` recorder show no console lines; `kal write` then writes `effW` only in the profile scale and `tDead`/`tMin` not at all.
- For step 10: water tank, pump on the relay, hose with drippers at the pot.

## Diagram

[![Choosing one of the installation routes 07 to 10 and the shared steps up to the first watering window](../diagramme/en/06-startanleitung.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/06-startanleitung.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/06-startanleitung.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Choosing a route", 2 "Shared steps", 3 "After installation".

## Which route suits you

All four routes go through the same ten steps. They differ only in how you build, upload, verify and start the installer (steps 2 to 5 and 8).

| Your situation | Route | Chapter |
| --- | --- | --- |
| No Node, no terminal – just a browser | Paste the scripts from the checked-in `dist/` into the web UI, byte check via RPC in the browser | [07 · Installation by hand](07-installation-per-hand.md) |
| PC or Raspberry Pi with Node ≥ 22 on the same network as the Shelly | Tools straight against the IP: upload, verification, `normal`, `console.js` | [08 · Installation with a local server](08-installation-lokaler-server.md) |
| You work on a server (VPS), the Shelly is at home | Reverse SSH tunnel; on the VPS the Shelly is reachable as `127.0.0.1:8010`, and `<ip>` is that address | [09 · Installation with a VPS](09-installation-vps.md) |
| The AI should lead | Claude Code drives the steps through the tools as an interview; you decide and handle the setup | [10 · Installation with Claude Code](10-installation-claude-code.md) |

## The ten steps

The order is fixed: 1 prepare the device → 2 build → 3 create scripts → 4 upload → 5 verify → 6 `cfg1` → 7 `cfg2` → 8 installer → 9 check the schedule → 10 set up at the pot and follow the first window. The installer adds missing fields and overwrites nothing, so steps 6 and 7 before it are water-safe: as long as a band field is missing, nothing is watered.

### 1 Prepare the device (web UI)

1. Check time via NTP and the time zone (Settings).
2. Peripherals/Add-ons: add the analog input as a **voltmeter** with range 0–15 V (a smaller range means finer resolution). This creates `voltmeter:100`.
3. Add the DS18B20 via the **1-Wire scan**. This creates `temperature:100`. If the numbers differ, enter them later in `cfg1.idV` or `cfg1.idT` (default <!-- def:cfg1.idV -->100<!-- /def --> each).
4. Set input 1 (terminal IN2, float switch) to type "Switch" – or run `node tools/hwtest.js <ip> input-on` (`Input.SetConfig` with `enable` and `type: "switch"` on `cfg1.idLvl` = <!-- def:cfg1.idLvl -->1<!-- /def -->).
5. Do not set any script to "Run on startup". The schedule starts the scripts; the installer switches autostart off for `bw_main` and `bw_pump` anyway.

### 2 Build: `npm run build`

```bash
npm run build            # writes dist/: comments and indentation removed, version line and //! docs kept
```

Only `dist/` goes to the device; `scripts/` is the readable source. The build keeps the compact output below <!-- fact:size_limit -->16000<!-- /fact --> B (exception `bw_pump`: <!-- fact:size_limit_pump -->18000<!-- /fact --> B) because the device's script heap (~25 KB) is shared by all scripts. Currently: `bw_install` <!-- fact:dist.bw_install -->15978<!-- /fact --> B, `bw_main` <!-- fact:dist.bw_main -->15791<!-- /fact --> B, `bw_pump` <!-- fact:dist.bw_pump -->17475<!-- /fact --> B, `bw_zeitraffer` <!-- fact:dist.bw_zeitraffer -->7459<!-- /fact --> B.

If you changed the code, run `npm test` first: <!-- fact:tests -->146<!-- /fact --> tests against the mock must be green.

> **Note:** `dist/` is checked in – if you change nothing in the code, take the files straight from the repo ([dist/](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/tree/main/dist)). An update from 0.1.x also goes through this step: build first (or use the checked-in `dist/`), then upload; the update order is in [13 · Operation and maintenance](13-betrieb-und-wartung.md).

### 3 Create the scripts

1. Web UI → Scripts → Add script: create three scripts with the exact names `bw_install`, `bw_main`, `bw_pump`. The installer finds them by name (`Script.List`); the device assigns the IDs.
2. Optionally `bw_zeitraffer` for [12 · First commissioning](12-erstinbetriebnahme.md): `node tools/hwtest.js <ip> preflight` creates it and prints the upload command with the right ID. `preflight hw` additionally creates `bw_hwtest` and `bw_hwpump` for [11 · Hardware check](11-hardware-check.md).
3. Look up the IDs: `node tools/hwtest.js <ip> scripts` lists every script with ID, name, size on the device, `mem_peak` and below that `fs_free`. `put-script.js` does not check the name – the ID must match the file name.

> **Measured on the device (13 Sep 2026):** Flash for scripts is tight. With seven scripts 12 288 B were free, after deleting `engine_probe`, `bw_hwtest` and `bw_hwpump` 49 152 B. `put-script.js` aborts when `fs_free` plus the old code is smaller than the file plus a 4 096 B reserve ("Flash zu voll", flash full); `node tools/hwtest.js <ip> delete <id>` makes room (it never deletes the operating scripts).

### 4 Upload

```bash
node tools/hwtest.js <ip> scripts                     # IDs of your scripts (id = name)
node tools/put-script.js <ip> <id> dist/bw_install.js # each script with its ID
node tools/put-script.js <ip> <id> dist/bw_main.js
node tools/put-script.js <ip> <id> dist/bw_pump.js
node tools/put-script.js <ip> <id> dist/bw_zeitraffer.js   # only if created
```

`put-script.js` stops the script, sends the file via `Script.PutCode` in 1 024-character chunks, then downloads the whole code again and compares it byte for byte with the file. The reason: the web UI editor lost text when pasting (firmware 2.0.0, 12 Sep 2026: 166 and 210 bytes were missing at the end of the file, and the script started with `SyntaxError: Got EOF`).

Without Node you use the editor: paste the content from `dist/`, then open `http://<ip>/rpc/Script.GetCode?id=<id>&len=1` in the browser – `left` + 1 must equal the file size from the build. The procedure in detail is in [07 · Installation by hand](07-installation-per-hand.md).

### 5 Verify: `verify-scripts.js`

```bash
node tools/verify-scripts.js <ip>   # compare every script on the device with dist/, versions bw_main = bw_pump
```

The tool downloads each script's code completely via `Script.GetCode`, compares it byte for byte with `dist/`, counts the doc lines and checks that `bw_main` and `bw_pump` carry the same version (they share `st`, `job`, `lrn`). Run it after **every** upload – including uploads through the editor – and whenever a script aborts "inexplicably".

### 6 Sensor calibration `cfg1`

The moisture scale is your own calibration: 0 % = sensor dry in air (`vDry`), 100 % = sensor in a glass of water (`vWet`). The defaults <!-- def:cfg1.vDry -->0.20<!-- /def --> V and <!-- def:cfg1.vWet -->3.13<!-- /def --> V are enough to start; on the device, `bw_hwtest` measured 0.296 V and 3.134 V on 13 Sep 2026. Read the voltage from the voltmeter in the web UI or later as `V=` in the first console line.

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg1","value":"{\"vDry\":0.296,\"vWet\":3.134}"}'
```

Or web UI → Settings → Key-Value Storage → create the entry, tick "Format as JSON". All KVS values are JSON strings: the value is the JSON text in quotes (as in the `curl` command above), and the tick makes it editable in the web UI. Before the installer this partial object is enough – it adds `vErrLo`, `nSample`, `idV` and the remaining fields with defaults. The [hardware check](11-hardware-check.md) measures more precisely: it writes `vDry` and `vWet` itself when the result is plausible.

### 7 Target band `cfg2`

The band must be ordered: `pctDry` < `pctLo` < `pctOk` ≤ `pctSoll` < `pctHi`, and also `pctLo` + `hyst` < `pctOk` (`hyst` default <!-- def:cfg2.hyst -->2<!-- /def -->). Example band from the device since 13 Sep 2026, in band order:

| Field | Example | Meaning |
| --- | --- | --- |
| `pctDry` | 28 | end of the dry phase: well below `pctLo` |
| `pctLo` | 40 | below this a watering job is created ("water now") |
| `pctOk` | 50 | target reached: no further portion in the window |
| `pctSoll` | 55 | target point of the dose calculation, a few percent above `pctOk` |
| `pctHi` | 60 | "too much": above this the pot counts as wet and a dry phase starts |
| `dropSlow` | 4 | drop in %/24 h below which the long pause applies (suspected waterlogging); the value comes from the 0.1.x run, the right threshold is measured at the plant |

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctSoll\":55,\"pctLo\":40,\"pctOk\":50,\"pctHi\":60,\"pctDry\":28,\"dropSlow\":4}"}'
```

The values refer to the sensor under the dripper and your `cfg1` calibration, not to a volumetric water content. How to derive your own band at the plant is in [12 · First commissioning](12-erstinbetriebnahme.md). The installer creates `pctOk` and the other band fields only as `null` – the values always come from you. `lrn.effW` also stays `null` until `bw_pump` learns in the first window or `kal write` writes it.

> **Note:** `KVS.Set` replaces the whole entry. Before the installer the partial object is enough (it adds `hyst`, `effMin`, `effMax`, `alpha`, `sfMin`, `sfStep`, `dropW`, `sfUp`). To change a field later: web UI → Key-Value Storage → "Format as JSON" → change only that field, or repeat the installer after a partial write. As long as a band field is `null`, the system only measures and logs (`why=cfg`, `err=cfg`) – that is normal, not an error. A missing required field such as `cfg2.hyst` or an unordered band also stops with `err=cfg`.

### 8 Run the installer

```bash
node tools/hwtest.js <ip> normal 60   # safe moment, Script.Start bw_install, 60 s of console, then check schedule/cfg3/cfg4/auto_off
```

`normal` waits for a safe moment: second 8–30 of a minute, not within 9 min after `winA`/`winB` (the window runs there until the safety-off), and no operating or test script running. It polls every 2 s and gives up after 4 min. Afterwards it checks the schedule, `cfg3`/`cfg4`, `auto_off` and that no fast-forward backup is left, and reports `NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet` (normal operation, schedule and configuration as expected). Without the tool: web UI → Scripts → `bw_install` → "Start" – and keep the same rule for the moment by hand.

What `bw_install` <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> does:

1. Reads all KVS entries (paginated) and the script list. If `bw_main` or `bw_pump` is running, it aborts (`ABBRUCH: Script bw_main läuft – später erneut starten`, abort: script running, start again later) and writes `err=cfg` so the reason is visible even without a console.
2. Creates the nine entries `cfg1`, `cfg2`, `cfg3`, `cfg4`, `lrn`, `st`, `job`, `day`, `err` if they are missing, and adds missing fields with defaults to existing entries (console `KVS cfg2 ergänzt: …`, "supplemented"). It never overwrites existing values; only an entry that is not a JSON object is recreated.
3. Checks the window rule: a window including budget and reserve must end before the next cycle, (window minute mod `tick`)·60 + 30 + `tWin` + `tTail` ≤ `tick`·60. With the defaults that is 0 + 30 + <!-- def:cfg4.tWin -->420<!-- /def --> + <!-- def:cfg4.tTail -->20<!-- /def --> = 470 s of 900 s.
4. Deletes its old schedule entries (recognised by `Script.Start` on `bw_main`/`bw_pump` or `Switch.Set` on the pump output) and creates them anew. The first rejection of `Schedule.Create` ("timespec validation") is retried silently; only a second one appears as `Hinweis: Schedule.Create …`.
5. Switches autostart off for `bw_main` and `bw_pump` and sets the switch configuration: `initial_state` off, `auto_off` after `tMax` + 10 s = <!-- def:cfg3.tMax -->180<!-- /def --> + 10 = 190 s.
6. Prints the summary with the schedule lines and stops itself (`Script.Stop`). It can be repeated as often as you like.

### 9 Check the schedule

Web UI → Schedules, or via RPC: `curl -s http://<ip>/rpc/Schedule.List`. Three own entries are expected:

| Timespec | Call | Meaning |
| --- | --- | --- |
| `0 */15 * * * *` | `Script.Start` `bw_main` | cycle from `cfg3.tick`, on the full minute |
| `30 0 8,20 * * *` | `Script.Start` `bw_pump` | watering windows `winA`/`winB`, 30 s after the full minute – so `bw_pump` never runs at the same time as `bw_main` (shared heap) |
| `0 8 8,20 * * *` | `Switch.Set` off | safety-off: 30 s + `tWin` 420 s + 10 s, rounded up to full minutes = 8 min after the window |

If `winA` and `winB` have different minutes, there are up to five entries (two each for the windows and the safety-off). The device assigns the schedule IDs; the console names them as `Zeitplan #<id>: <timespec>`. View the KVS: `tools/kvs_dump.sh <ip>` or in the browser `http://<ip>/rpc/KVS.GetMany?match=*`.

> **Fast-forward only:** In the practical test from chapter 12 the same installer builds the schedule from `cfg3.winEvery`: cycle <!-- zr:cfg3.tick -->3<!-- /zr --> min, window every <!-- zr:cfg3.winEvery -->6<!-- /zr --> min (`0 */3 * * * *`, `30 */6 * * * *`) and the safety-off as a minute list `40 2,8,14,…,56 * * * *`.

### 10 Set up at the pot, first line, first window

1. Push the sensor into the pot under the drippers (the wettest point – the scale refers to it).
2. Lay out the hose end with the drippers at the sensor.
3. Fill the tank, float switch above the pump inlet.
4. Read the first console line of `bw_main`: web UI → Scripts → `bw_main` → console, or `node tools/console.js <ip> 900` – it listens for 900 s and thus catches the next 15-minute cycle. Connect first, otherwise the first line is missing.
5. Check the line: `V=` shows a voltage, `tC=` a temperature, `lvl=` 0 or 1. Otherwise adjust `idV`/`idT`/`idLvl` in `cfg1`.
6. Follow the first window: `node tools/console.js <ip> 900` from 07:59 or 19:59, or web UI → Scripts → `bw_pump` → console. `hwtest.js watch` does not help here: in normal operation it ends after a few seconds because no test script is running.

Starting `bw_main` by hand is allowed, but not in seconds 0–8 of a cycle minute: the scheduled start is running then (5–7.5 s on the device), and two runs would share the heap.

Expected in the cycle before the window: `why=ok sec=70` (moisture below `pctLo`, first watering with `tStd` <!-- def:cfg3.tStd -->70<!-- /def --> s). In the window follow `Fenster: Auftrag 70 s …` (window: job), `m0 … → P1 …`, `P1 …`, possibly `P2 …` and `ergebnis=…` (result); `soak` = <!-- def:cfg3.soak -->30<!-- /def --> min later `Kontrolle: … → … %` (check). If moisture is at `pctLo` or above, the line says `why=feucht` (moist) and there is no watering – that is not an error.

> **Caution (water/mains):** The relay coil hangs on the potential-free contact OUT1 (max. 30 V / 300 mA); the relay contact switches the pump. Work on 230 V only by a qualified electrician. Keep plugs and cables dry while handling the glass of water and the tank.

## When the installer must run again

| Trigger | What the installer then does |
| --- | --- |
| A change of `cfg3.tick`, `cfg3.winEvery`, `cfg3.winA`/`winB`, `cfg3.tMax`, `cfg4.tWin` or `cfg4.tTail` | Rebuilds the schedule, the safety-off and `auto_off` |
| A script update | Adds new fields with their defaults (e.g. `cfg4`, `cfg2.pctOk`, `cfg3.dryDay`, `lrn.effW`); without it `bw_main` or `bw_pump` stop with `err=cfg` ("cfg3.tick fehlt", "cfg4.tWin fehlt" – field missing) |
| A partial write of an entry via `KVS.Set` | Adds the remaining fields of the entry back with their defaults |
| Return from fast-forward: backup `zrb1` present, marker `zr` missing | Writes the original back and deletes the backup (`node tools/hwtest.js <ip> normal 60`) |

While `bw_main` or `bw_pump` is running it aborts – simply repeat it at the next safe moment.

## Example output

Installer console for a fresh installation (mock, `node tools/run-script.js scripts/bw_install.js`; on the device the same three schedule lines appeared on 13 Sep 2026, the device assigns the schedule IDs):

```text
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] Zeitplan: 0 Einträge, davon eigene: 0
[bw_install 0.1.3] Switch 0: auto_off 190 s
[bw_install 0.1.3] KVS neu angelegt: cfg1, cfg2, cfg3, cfg4, lrn, st, job, day, err
[bw_install 0.1.3] Zeitplan #1: 0 */15 * * * *
[bw_install 0.1.3] Zeitplan #2: 30 0 8,20 * * *
[bw_install 0.1.3] Zeitplan #3: 0 8 8,20 * * *
[bw_install 0.1.3] fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach
```

(`Zeitplan` = schedule, `KVS neu angelegt` = KVS entries created, `fertig` = done.) This is how `hwtest.js` waits for the safe moment (device, 13 Sep 2026, 15:49, excerpt – the lines are the same for `normal`, `zeitraffer` and `kal`; `warte` = waiting, `sicherer Moment` = safe moment):

```text
warte – Sekunde 52, warte auf 8–30
warte – Sekunde 0, warte auf 8–30
sicherer Moment: 15:50:09
```

`verify-scripts.js` after the upload – the tool's output format, generated on 15 Sep 2026 against a local stub with the current `dist/`, not a device run; script IDs as on the device on 13 Sep 2026 (real run: [19 · Device test protocol](19-pruefprotokoll.md)); `Byte am Gerät` = bytes on the device, `Doku-Zeilen` = doc lines:

```text
Script 1 bw_install      15978 Byte am Gerät,  15978 Byte dist/, 22 Doku-Zeilen, v0.1.3 – OK, byteidentisch
Script 2 bw_main         15791 Byte am Gerät,  15791 Byte dist/, 8 Doku-Zeilen, v0.2.0 – OK, byteidentisch
Script 3 bw_pump         17475 Byte am Gerät,  17475 Byte dist/, 5 Doku-Zeilen, v0.2.0 – OK, byteidentisch
Script 7 bw_zeitraffer    7459 Byte am Gerät,   7459 Byte dist/, 12 Doku-Zeilen, v0.2.0 – OK, byteidentisch
4 Scripts mit dist/ verglichen, alle byteidentisch
```

First console line of `bw_main` while the band is incomplete (mock: `pctOk` still missing → `why=cfg`, the sensors are read anyway):

```text
[bw_main 0.2.0] V=1.2 pct=34.13 tC=24 lvl=0 st=beob dry=0 pause=24h why=cfg sec=- effW=- sf=0.7 err=cfg w=4 dauer=2620ms
```

Cycle and window on the device (13 Sep 2026, 15:51–15:57, fast-forward profile: hence `pause=0.2h`, `sec=12` and `Frist 120 s`; in normal operation you see `pause=24h`, `sec=70` and `Frist 420 s`; `st=beob` = observing, `Frist` = deadline, `stabil`/`unstabil` = stable/unstable, `Kontrolle` = check):

```text
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] m0 10.4 % → P1 12 s
[bw_pump 0.2.0] P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)
[bw_pump 0.2.0] P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
[bw_main 0.2.0] Kontrolle: 50.5 → 53.7 % sf=0.7
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `why=cfg`, `err=cfg` in every cycle | A band field in `cfg2` is `null`, the band is unordered, or a field is missing after a script update ("cfg3.tick fehlt", "cfg4.tWin fehlt") | Enter all six band fields (step 7), check the order, run the installer again |
| `SyntaxError: Got EOF` or `ReferenceError` at start | The web editor lost text when pasting | Use `put-script.js`, then `verify-scripts.js`; only then suspect the code itself |
| `err=uhr`, no cycle | No time via NTP since the restart | Check Wi-Fi/NTP; without a clock the schedule does not run either |
| `ABBRUCH: Script bw_main läuft – später erneut starten` | Installer started during the cycle or the window | `normal 60` waits for the safe moment (second 8–30, not within 9 min after the window) |
| `ABBRUCH: Script bw_main nicht gefunden` (not found) | Name differs | Name the scripts exactly `bw_install`, `bw_main`, `bw_pump` |
| `bw_main` started by hand on the full cycle minute | Runs next to the scheduled start – two scripts share the heap (13 Sep 2026: `out_of_memory` when `bw_pump` started in the same second as `bw_main`) | Wait for seconds 8–30 |
| `hwtest.js watch` ends after seconds | No test script runs in normal operation | Read the first window with `console.js <ip> 900` or the web UI console |
| `watch`/`console.js` show no console lines | Debug websocket off | Web UI → Scripts → open the console (or `Sys.SetConfig` `debug.websocket.enable`) |
| First line of a run is missing | `console.js` connected only after `Script.Start` | Connect first, then start (`console.js <ip> <sec> <id>` does both) |
| `Hinweis: Schedule.Create … abgelehnt` (rejected) | Second rejection of the same timespec | Check the console and web UI → Schedules, repeat the installer |
| Web UI shows `[object Object]` | The entry is stored as a JSON object instead of a string (a 0.1.0 entry or `KVS.Set` with an object as `value`) – the web UI can only show strings | Do not save in the web UI (it would write back the text `[object Object]`); rewrite the entry via `KVS.Set` with a string value, or delete it and run the installer |
| `Flash zu voll` (flash full) on upload | `fs_free` is not enough for the file plus 4 096 B reserve | Delete test scripts: `node tools/hwtest.js <ip> delete <id>` |
| `why=feucht` in the first window, no watering | The cycle reading is at `pctLo` or above | Not an error; let the soil dry or derive the band at the plant (chapter 12) |

## Next

- [11 · Hardware check (bw_hwtest, bw_hwpump)](11-hardware-check.md) – check sensors, float switch and pump in an interview; `vDry`/`vWet` are measured and written.
- [12 · First commissioning: calibration, target band, fast-forward, first window](12-erstinbetriebnahme.md) – derive your own band and see the whole cycle once in 45 minutes.
- Your route for steps 2 to 5 and 8: [07 · by hand](07-installation-per-hand.md), [08 · local server](08-installation-lokaler-server.md), [09 · VPS](09-installation-vps.md), [10 · Claude Code](10-installation-claude-code.md).
