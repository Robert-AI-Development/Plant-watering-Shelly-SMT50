# 08 · Installation with a local server (PC or Raspberry Pi on the LAN)

[Deutsch](../de/08-installation-lokaler-server.md) · **English** — [Handbook](README.md) · Part C "Install"

> **At a glance**
> - Outcome: every script sits on the device byte for byte, the installer has set schedule and `auto_off`, the first console line has been read – all from your computer with `node tools/…` against the Shelly's IP.
> - Scope: seven steps in a fixed order – `npm test`, `npm run build`, `preflight`, `put-script.js` per script, `verify-scripts.js`, target band, `normal 60`.
> - Key number: Node ≥ 22 on the computer (global `WebSocket` for `hwtest.js` and `console.js`); `npm test` runs <!-- fact:tests -->146<!-- /fact --> tests without a single third-party package.
> - Biggest pitfall: the Shelly's debug websocket is off – then `watch` and `console.js` show no line at all. Open the console once in the web UI; afterwards `preflight` reports `Debug-Websocket an` (debug websocket on).

## Prerequisites

- Hardware wired as in [05 · Wiring and hardware build](05-verkabelung-und-aufbau.md); Shelly on Wi-Fi, clock set via NTP, time zone set (the windows `winA`/`winB` are local time).
- Device prepared as in [06 · Step-by-step start guide](06-startanleitung.md), step 1: voltmeter, 1-Wire sensor, IN2 as type "Switch"; the scripts `bw_install`, `bw_main`, `bw_pump` created with exactly these names, none set to "Run on startup".
- A computer on the same network – PC, laptop or Raspberry Pi – with git and Node ≥ 22; the Shelly's IP, called `<ip>` below (e.g. `192.168.88.10`).
- Debug websocket on: web UI → Scripts → any script → open the console (sets `debug.websocket.enable`).
- Nothing else: the project has no dependencies, no package gets installed on top.

## Diagram

[![Sequence: pre-check, upload, byte-identical verification, installer and console from the PC](../diagramme/en/08-installation-lokaler-server.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/08-installation-lokaler-server.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/08-installation-lokaler-server.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Upload and verification", 2 "Installer and check", 3 "Following the console".

## Node and git on the computer

Tests and build run from Node 20 on; the two device tools need the built-in `WebSocket`, which only exists from Node 22. Install Node 22 right away and everything fits.

| Tool | Node | Reason |
| --- | --- | --- |
| `npm test`, `npm run build`, `put-script.js`, `verify-scripts.js` | ≥ 20 | `node --test` and built-in `fetch` |
| `hwtest.js`, `console.js` | ≥ 22 | global `WebSocket` for the device console (`ws://<ip>/debug/log`) |

On Debian, Ubuntu and Raspberry Pi OS (64-bit):

```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v            # must show v22 or higher
```

On Windows and macOS the installers from nodejs.org (version 22 or newer) and git are enough; the commands in this chapter are the same there.

## Get the repo, tests, build

```bash
git clone https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50.git
cd Plant-watering-Shelly-SMT50
npm test           # 146 tests against the mock – must be green
npm run build      # writes dist/: the code that goes onto the device
```

`scripts/` is the readable source, `dist/` the compact output: the build strips comments, indentation and blank lines; only the version line and the short device docs (`//!` lines) remain. **Only `dist/` goes onto the device.** The folder is checked in; whoever changes `scripts/` or installs an update runs `npm run build` first, otherwise old code ends up on the device.

| Script | Version | Size in `dist/` | Limit (`tools/build.js`) |
| --- | --- | --- | --- |
| `bw_install` | <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> | <!-- fact:dist.bw_install -->15 978<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_main` | <!-- fact:ver.bw_main -->0.2.0<!-- /fact --> | <!-- fact:dist.bw_main -->15 791<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_pump` | <!-- fact:ver.bw_pump -->0.2.0<!-- /fact --> | <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B | <!-- fact:size_limit_pump -->18 000<!-- /fact --> B |
| `bw_zeitraffer` | <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact --> | <!-- fact:dist.bw_zeitraffer -->7 459<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_hwtest` | <!-- fact:ver.bw_hwtest -->0.1.0<!-- /fact --> | <!-- fact:dist.bw_hwtest -->13 952<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_hwpump` | <!-- fact:ver.bw_hwpump -->0.1.0<!-- /fact --> | <!-- fact:dist.bw_hwpump -->14 500<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |

The limit protects the device's script heap (about 25 KB, shared by all scripts); the build reports `ÜBER LIMIT` (over limit) if a script exceeds it. For the installation you need the first three scripts, `bw_zeitraffer` for the fast-forward run in [12 · First commissioning](12-erstinbetriebnahme.md); the two hardware-test scripts only go onto the device in [11 · Hardware check](11-hardware-check.md).

## Pre-check: preflight and scripts

```bash
node tools/hwtest.js <ip> preflight   # clock, scripts, input, output, sensors, KVS, debug websocket
node tools/hwtest.js <ip> scripts     # list: id, name, bytes on the device, running?, mem_peak; fs_free
```

`preflight` queries the device via HTTP RPC (`Sys.GetStatus`, `Script.List`, `Input.GetConfig`, `Sys.GetConfig`) and prints `ok`, `WARNUNG` (warning) or `BLOCKER` per line; it ends with `Vorprüfung ohne Blocker` (pre-check without blockers, exit 0) or the number of blockers (exit 1).

| Line | Meaning | Level |
| --- | --- | --- |
| Clock, seconds until the next `bw_main` cycle, `ram_free`, `fs_free` | clock set via NTP; flash and RAM of the device | blocker if the clock is missing |
| Window `winA`/`winB`/midnight closer than 30 min | better run device tests later | warning |
| Debug websocket on/off | without it `watch` and `console.js` show no console | warning |
| Script … läuft (running) | an operating script is writing the KVS right now | blocker (test script: warning) |
| Scripts: `1=bw_install, 2=bw_main, …` | IDs as the device assigned them | info |
| Script `bw_zeitraffer` created as id … | `preflight` creates it via `Script.Create` if missing (with `preflight hw` also `bw_hwtest`/`bw_hwpump` – they cost flash) | info |
| Upload `bw_zeitraffer`: … bytes on the device – `node tools/put-script.js …` | ready-made upload command with the right ID | info |
| Input 1 (water level) disabled or wrong type | the input must be `enable` and type `switch` | blocker → `node tools/hwtest.js <ip> input-on` |
| Output (pump) is ON | relay is switched on | blocker |
| Sensors `V=… tC=… lvl=…`, `err`/`job`/`day`/`hwt` | current readings and state in the KVS | info |

`input-on` is the only configuration change the tool makes (`Input.SetConfig {enable: true, type: "switch"}`), and only when you ask for it.

## Upload: put-script.js

Look at `scripts` first – one line per script, `Script <id> <name> … Byte` (or the `preflight` line `Scripts: 1=bw_install, 2=bw_main, …`) – then upload with your own IDs. The device assigns the IDs when a script is created; `put-script.js` does not check the name, it stubbornly uploads to the given ID. The IDs here are those of the reference device on 13 Sep 2026.

```bash
node tools/put-script.js <ip> 1 dist/bw_install.js
node tools/put-script.js <ip> 2 dist/bw_main.js
node tools/put-script.js <ip> 3 dist/bw_pump.js
node tools/put-script.js <ip> 7 dist/bw_zeitraffer.js   # for chapter 12; preflight created the script
```

What one call does, in this order:

1. `Sys.GetStatus.fs_free` plus the script's old code must hold the new file plus 4 096 B reserve, otherwise the tool stops before half-written code ends up on the device.
2. `Script.Stop` on the ID – `Script.PutCode` only works on a stopped script.
3. `Script.PutCode` in chunks of 1 024 characters (`append: true` from the second chunk on); characters rather than bytes, so no umlaut gets cut in half.
4. `Script.GetCode` reads the whole code back; it must be **byte-identical** to the file, not merely the same length.
5. One result line: bytes sent, chunks, bytes on the device, doc lines, `OK, byteidentisch` (byte-identical) or `FEHLER, Code weicht ab` (error, code differs), `fs_free` before → after. Exit 0 only on OK.

> **Measured on the device (12 Sep 2026):** The script editor of the web UI lost 166 and 210 bytes at the end of the file when pasting; the script started with `SyntaxError: Got EOF`. Hence the upload via RPC – and after every upload the verification in the next section, even if you did use the editor once.

> **Note:** Do not upload into a watering window and not in seconds 0–8 of a cycle minute: `put-script.js` stops the script it writes to. `preflight` shows the seconds until the next `bw_main` cycle and warns if `winA`/`winB` or midnight are closer than 30 min.

## Verify: verify-scripts.js

```bash
node tools/verify-scripts.js <ip>            # every script on the device that has a dist/ file
node tools/verify-scripts.js <ip> bw_main    # only the named ones
```

The tool downloads each script's code completely via `Script.GetCode`, compares it byte for byte with `dist/`, counts the doc lines in the header and reads the version (`var VER`). If a script differs, it names the first differing character and the matching `put-script.js` command. `bw_main` and `bw_pump` share `st`, `job` and `lrn`: if they carry different versions it reports `VERSIONEN WEICHEN AB` (versions differ) – then upload both. Exit 0 = all equal, 1 = difference.

Run it after every upload; it is also the first thing to do when a script on the device aborts "inexplicably" with `ReferenceError` or `Got EOF`: check the upload first, then the code.

## Enter calibration values and target band

Before the installer you enter `cfg1` (sensor) and `cfg2` (target band); KVS values are JSON strings. A partial object is enough at this point, because the installer completes all missing fields in the next step. After the installer, however, `KVS.Set` replaces the whole entry – changing one field later then means: web UI → Key-Value Storage → "Format as JSON" → change only that field, or run the installer again after a partial write.

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg1","value":"{\"vDry\":0.296,\"vWet\":3.134}"}'
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctDry\":28,\"pctLo\":40,\"pctOk\":50,\"pctSoll\":55,\"pctHi\":60,\"dropSlow\":4}"}'
```

> **Measured on the device (13 Sep 2026):** `vDry` 0.296 V (sensor dry in air), `vWet` 3.134 V (in a glass of water); the installer's defaults are <!-- def:cfg1.vDry -->0.20<!-- /def --> / <!-- def:cfg1.vWet -->3.13<!-- /def --> V. The example band is the reference device's, in band order `pctDry` < `pctLo` < `pctOk` ≤ `pctSoll` < `pctHi`; `dropSlow` 4 has been there since the 0.1.x run and has not yet been measured at the plant.

As long as one of the six band fields (`pctSoll`, `pctLo`, `pctOk`, `pctHi`, `pctDry`, `dropSlow`) is `null`, the system only measures and reports `why=cfg` (reason: configuration incomplete). How to derive the values is in [12 · First commissioning](12-erstinbetriebnahme.md), every field in [03 · Configuration](03-konfiguration.md).

## Installer at the safe moment: normal 60

```bash
node tools/hwtest.js <ip> normal 60   # waits for the safe moment, starts bw_install, follows the console, checks the result
```

`normal` is called that because the same command leads back from fast-forward to normal operation; without a fast-forward backup `bw_install` simply runs as the installer. The tool first checks that `bw_install` exists on the device, then waits for a safe moment (polling every 2 s, at most 4 min, otherwise abort with exit 1):

| Condition | Reason |
| --- | --- |
| seconds 8–30 of the minute | `bw_main` from the cycle (second 0) is done, the next start is far away |
| blocked up to and including minute 9 after `winA`/`winB`, free from minute 10 | the window runs until 30 s + `tWin`, the safety-off comes at +8 min; message `Gießfenster 08:00 gerade vorbei, Fenster läuft bis 9 min danach` (window just passed, runs until 9 min after) |
| no operating or test script running | shared script heap; a running script is writing the KVS |
| clock set | no schedule without a clock |

Then it opens the debug websocket, calls `Script.Start` for `bw_install` and follows the console until the script finishes. The installer itself:

1. reads all KVS entries and fetches the IDs of `bw_main` and `bw_pump` by name from `Script.List`; if one of them is running, it aborts (`ABBRUCH: Script bw_main läuft – später erneut starten` – abort, script running, start again later).
2. creates the nine entries `cfg1`, `cfg2`, `cfg3`, `cfg4`, `lrn`, `st`, `job`, `day`, `err` where missing and fills in missing fields with defaults – it never overwrites existing values.
3. checks the window rule: a window must end, including budget `tWin` and reserve `tTail`, before the next cycle (`(minute mod tick)·60 + 30 + tWin + tTail ≤ tick·60`; with defaults 470 ≤ 900 s).
4. deletes its own schedule entries and creates them afresh; the first rejection of a `Schedule.Create` ("timespec validation") is retried silently.
5. sets `bw_main` and `bw_pump` to `enable: false` – no autostart, the schedule starts them.
6. configures the output: `initial_state` off, `auto_off` after `tMax` + 10 s.
7. prints the summary and stops itself via `Script.Stop`.

| Schedule entry | timespec (defaults) | Effect |
| --- | --- | --- |
| Cycle | `0 */15 * * * *` | `Script.Start bw_main` every <!-- def:cfg3.tick -->15<!-- /def --> min at second 0 |
| Watering window | `30 0 8,20 * * *` | `Script.Start bw_pump` at <!-- def:cfg3.winA -->08:00<!-- /def --> and <!-- def:cfg3.winB -->20:00<!-- /def -->, second 30 each – never alongside `bw_main` |
| Safety-off | `0 8 8,20 * * *` | `Switch.Set off` 8 min after the window minute: 30 s + `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s + 10 s, rounded up |

Three entries result when `winA` and `winB` share the same minute; otherwise up to five. The console names each as `Zeitplan #<id>: <timespec>` (schedule), the numbers are assigned by the device. Afterwards `auto_off` is `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> + 10 = 190 s.

After the run, `normal` compares the device with `cfg3`/`cfg4`: schedule entries as expected, `auto_off` = `tMax` + 10, no fast-forward mark `zr` and no backup `zrb1`…`zrb5`, no error in `Script.GetStatus` of the four scripts, free script heap. If it ends with `NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet` (normal operation – schedule and configuration as expected), you are done; on `N Abweichungen – Konsole prüfen` (N deviations – check the console) repeat the run.

> **Note:** The installer runs again after every change of `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin` or `tTail` – and after every script update, because it adds new cfg fields. Whoever starts it with "Start" in the web UI instead ([07 · Installation by hand](07-installation-per-hand.md)) has to respect the safe moment on their own.

## Following the console

```bash
node tools/console.js <ip> 900        # listen for 900 s: the next bw_main line arrives within 15 min at the latest
node tools/console.js <ip> 12 2       # connects, starts script 2 (bw_main) by hand, listens for 12 s
node tools/hwtest.js <ip> status      # one-liner: running scripts, V, tC, lvl, output
```

`console.js` connects to `ws://<ip>/debug/log`, starts a script only afterwards if asked (so the first line is not lost) and exits by itself after the waiting time. It shows everything raw, including firmware lines such as `shelly_ejs_rpc.cpp` – that is noise, not script output.

`hwtest.js watch` filters most of it out (truncated lines such as `lly_user_script.cpp:371 JS RAM stat: …` stay visible and are noise as well), but in normal operation ends after a few seconds because no test script is running; for a real watering window, `console.js <ip> 900` from 07:59 or 19:59 is the right tool.

The first line of `bw_main` shows whether the peripherals are right: `V=` voltage of the SMT50, `tC=` temperature, `lvl=` 0 or 1. If a value is missing, `idV`/`idT`/`idLvl` in `cfg1` do not match the components. Starting `bw_main` by hand is allowed, just not in seconds 0–8 of a cycle minute, because it would then run alongside the scheduled start.

## Tools at a glance

| Command | Purpose | Node |
| --- | --- | --- |
| `npm test` | <!-- fact:tests -->146<!-- /fact --> tests against the mock, including the 7-day simulation, hardware tests and the fast-forward timetable | ≥ 20 |
| `npm run check` | `node --check` of the six scripts | ≥ 20 |
| `npm run build` | write `dist/` (version line and `//!` docs remain) | ≥ 20 |
| `node tools/put-script.js <ip> <id> dist/<script>.js` | upload in chunks plus byte-identical verification | ≥ 20 |
| `node tools/verify-scripts.js <ip> [name …]` | compare all scripts on the device with `dist/`, check versions | ≥ 20 |
| `node tools/console.js <ip> [sec] [id]` | follow the device console, optionally start a script | ≥ 22 |
| `node tools/hwtest.js <ip> preflight \| scripts \| delete <id> \| input-on` | pre-check, script list with `fs_free`, delete a test script, enable the input | ≥ 22 |
| `node tools/hwtest.js <ip> normal [sec] \| watch [sec] \| status` | installer at the safe moment, console with status line, one-liner | ≥ 22 |
| `tools/kvs_dump.sh <ip>` | print all KVS entries and `Sys.GetStatus` (with `kvs_rev`) via curl | sh, curl |
| `node tools/run-script.js scripts/<script>.js --seed …` | run a script against the mock (without a device) | ≥ 20 |

The complete reference of all `hwtest.js` subcommands (hardware test, fast-forward, measurement run, calibration run) is in [14 · Debugging and testing](14-debuggen-und-testen.md).

## Remote access (optional)

If the computer is not on the home network – a VPS running Claude Code, for instance – a reverse SSH tunnel brings the Shelly there; `<ip>` is then `127.0.0.1:8010`, all commands stay the same. The setup is in [09 · Installation with a VPS](09-installation-vps.md), the installation as an interview with the AI in [10 · Installation with Claude Code](10-installation-claude-code.md).

## Example output

Build, upload of one script and verification of all four – byte counts from the current `dist/`, `fs_free` from the device run on 13 Sep 2026 (49 152 B free with four scripts, 40 960 B after uploading `bw_pump`; the file system counts in 4 KB blocks):

```text
$ npm run build
bw_install.js    23789 →  15978 Byte, 22 Doku-Zeilen
bw_main.js       23059 →  15791 Byte, 8 Doku-Zeilen
bw_pump.js       20330 →  17475 Byte, 5 Doku-Zeilen
bw_hwtest.js     16792 →  13952 Byte, 4 Doku-Zeilen
bw_hwpump.js     18736 →  14500 Byte, 4 Doku-Zeilen
bw_zeitraffer.js 13822 →   7459 Byte, 12 Doku-Zeilen
dist/ geschrieben – hochladen mit node tools/put-script.js <ip> <id> dist/<datei>, prüfen mit node tools/verify-scripts.js <ip>

$ node tools/put-script.js 192.168.88.10 3 dist/bw_pump.js
dist/bw_pump.js → Script 3: 17475 Byte in 18 Stücken gesendet, 17475 Byte am Gerät (PutCode len=17475), 5 Doku-Zeilen – OK, byteidentisch; fs_free 49152 → 40960

$ node tools/verify-scripts.js 192.168.88.10
Script 1 bw_install      15978 Byte am Gerät,  15978 Byte dist/, 22 Doku-Zeilen, v0.1.3 – OK, byteidentisch
Script 2 bw_main         15791 Byte am Gerät,  15791 Byte dist/, 8 Doku-Zeilen, v0.2.0 – OK, byteidentisch
Script 3 bw_pump         17475 Byte am Gerät,  17475 Byte dist/, 5 Doku-Zeilen, v0.2.0 – OK, byteidentisch
Script 7 bw_zeitraffer    7459 Byte am Gerät,   7459 Byte dist/, 12 Doku-Zeilen, v0.2.0 – OK, byteidentisch
4 Scripts mit dist/ verglichen, alle byteidentisch
```

The tools speak German: `Doku-Zeilen` = doc lines, `in 18 Stücken gesendet` = sent in 18 chunks, `Byte am Gerät` = bytes on the device, `byteidentisch` = byte-identical, `dist/ geschrieben – hochladen mit … prüfen mit …` = dist/ written – upload with … verify with ….

Installer via `normal 60` for the fresh installation of this chapter (`cfg1`/`cfg2` as partial objects from the section above, otherwise an empty KVS) – line format and order from the code, reproduced in the mock; time, script IDs, readings and memory values are device-specific, `…` stands for values that differ per run. The `[status …]` lines come from the tool (every 5 s, only on change) and interleave with the installer lines depending on timing:

```text
$ node tools/hwtest.js 192.168.88.10 normal 60
kein Zeitraffer aktiv – bw_install läuft als normaler Installer (ergänzt fehlende Felder, baut den Zeitplan)
warte – Sekunde 52, warte auf 8–30
sicherer Moment: <HH:MM:SS>
Script.Start bw_install (id 1) → {"was_running":false}
[status <HH:MM>] läuft: bw_install | V=1.196 tC=22.0 lvl=false sw=aus | hwr: - | hwp: -
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
[status <HH:MM>] läuft: - | V=1.196 tC=22.0 lvl=false sw=aus | hwr: - | hwp: -
kein bw_install läuft mehr
ok       Zeitplan: #1 [0 */15 * * * *] #2 [30 0 8,20 * * *] #3 [0 8 8,20 * * *]
ok       auto_off 190 s
ok       keine Zeitraffer-Sicherung
ok       cfg3/cfg4: Takt 15 min, Fenster 08:00/20:00, tMax 180 s, tWin 420 s, Sicherheits-Aus +8 min
ok       Script-Heap frei: 25200, ram_free …, kvs_rev …
NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet
```

Reading aid: `kein Zeitraffer aktiv` = no fast-forward active, `warte … auf 8–30` = waiting for seconds 8–30, `sicherer Moment` = safe moment, `[status …] läuft:` = running (`-` = nothing), `KVS cfg1 ergänzt: …` = fields added to cfg1, `Zeitplan: 0 Einträge, davon eigene: 0` = schedule: 0 entries, 0 of them ours, `KVS neu angelegt` = KVS entries created, `fertig` = done, `Sicherheits-Aus 8 min danach` = safety-off 8 min later, `kein bw_install läuft mehr` = bw_install no longer running, `keine Zeitraffer-Sicherung` = no fast-forward backup, `Script-Heap frei` = script heap free.

For an update instead of a fresh installation the installer names only the new fields – device run on 13 Sep 2026 (test protocol): `KVS cfg2 ergänzt: dropW,sfUp`, `KVS cfg3 ergänzt: dryDay`, `KVS neu angelegt: cfg4`; schedule `0 */15`, `30 0 8,20`, `0 8 8,20`, `auto_off` 190 s, no deviation.

The first cycle line afterwards, one per cycle (`why` = reason for or against a job, `w` = KVS writes, `dauer` = runtime) – reproduced in the mock with the `cfg1`/`cfg2` values from above, 1.196 V, 22 °C, float switch FULL; `dry=0` because the installer creates `st.dryOk` as `false`:

```text
[bw_main 0.2.0] V=1.196 pct=31.712 tC=22 lvl=0 st=beob dry=0 pause=24h why=ok sec=70 effW=- sf=0.7 err=- w=3 dauer=2600ms
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ReferenceError: WebSocket is not defined` on `console.js`; `normal`/`watch` show only `[status …]` lines and no console lines (looks like the debug websocket is off) | Node older than 22 | check `node -v`, install Node 22 (section above) |
| `Flash zu voll: fs_free … < … + Reserve 4096` (flash too full) | the flash for scripts is tight; test scripts occupy it (13 Sep 2026: 12 288 B free with seven scripts, 49 152 B with four) | `node tools/hwtest.js <ip> scripts`, then `delete <id>` for a test script – the tool never deletes operating scripts |
| `Fehler: Script.PutCode: …` (error) during upload | the script was still running (`Script.Stop` failed, e.g. in the middle of a cycle or window) – `Script.PutCode` only works on a stopped script | stop it in the web UI or wait for `preflight` (`Script … läuft`), repeat the upload, then `verify-scripts.js` |
| `FEHLER, Code weicht ab (N Byte Differenz)` or `WEICHT AB ab Zeichen N` (code differs from character N) | transfer disturbed or code from the web editor incomplete | repeat `put-script.js` for that script, then `verify-scripts.js` |
| `VERSIONEN WEICHEN AB: bw_main v…, bw_pump v…` (versions differ) | only one of the two scripts updated | upload both from the same `dist/` – they share `st`, `job`, `lrn` |
| `WARNUNG  Debug-Websocket aus` – `watch`/`console.js` show nothing | `debug.websocket.enable` is off | web UI → Scripts → script → open the console, repeat `preflight` |
| `BLOCKER  Input 1 (Wasserstand) ist deaktiviert` (input disabled) | input not configured as a switch | `node tools/hwtest.js <ip> input-on` |
| `kein sicherer Moment in 4 min: läuft: …` (no safe moment in 4 min: running: …) | a script runs permanently or a window has just passed | read the reason in the message; `status` shows running scripts; try again later |
| `ABBRUCH: Script bw_pump nicht gefunden` (abort: script not found) | script name on the device differs | name the scripts exactly `bw_install`, `bw_main`, `bw_pump`; `scripts` shows the names |
| `N Abweichungen – Konsole prüfen` after `normal` | e.g. a `Schedule.Create` stayed rejected | read the console lines, repeat `normal 60` |
| `why=cfg` in every cycle line | a band field in `cfg2` is still `null` | enter all six band fields (section "Enter calibration values and target band") |
| RPC error with the suffix `Tunnel 127.0.0.1:8010 offen?` (tunnel open?) | the device does not answer – on the LAN usually a wrong IP or a different network | check `curl http://<ip>/rpc/Shelly.GetDeviceInfo`; for a tunnel see [09](09-installation-vps.md) |

## Next

- [11 · Hardware check](11-hardware-check.md) – verify sensors, float switch and pump with `bw_hwtest`/`bw_hwpump`, let it measure `cfg1`.
- [12 · First commissioning](12-erstinbetriebnahme.md) – calibration, deriving the target band, seeing the whole cycle once in fast-forward, first window.
- [06 · Step-by-step start guide](06-startanleitung.md) – steps 9 and 10: setup at the pot and following the first watering window.
- [14 · Debugging and testing](14-debuggen-und-testen.md) – mock, tests and the complete tool reference.
