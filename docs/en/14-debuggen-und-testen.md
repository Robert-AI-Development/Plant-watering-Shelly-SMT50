# 14 · Debugging and testing

[Deutsch](../de/14-debuggen-und-testen.md) · **English** — [Handbook](README.md) · Part E "Extend"

> **At a glance**
> - All behaviour is checked without the device first: `tools/mock/shelly-mock.js` runs the six scripts unchanged, `npm test` runs <!-- fact:tests -->146<!-- /fact --> tests in about 6 s, `run-script.js` prints console, KVS, schedule and call depth of a single run.
> - The way onto the device is a fixed chain: `npm run build` → `dist/` (limit <!-- fact:size_limit -->16000<!-- /fact --> B, `bw_pump` <!-- fact:size_limit_pump -->18000<!-- /fact --> B) → `put-script.js` (upload in 1 024-character chunks, flash check) → `verify-scripts.js` (byte-identical with `dist/`).
> - Watching the device: debug websocket `/debug/log`; `console.js` shows every line raw, `hwtest.js watch` filters the firmware noise and appends a status line every 5 s; `build.js --debug` produces scripts with `DEBUG = 1`.
> - Biggest pitfall: errors only the device shows – no hoisting, call depth (mock <!-- fact:call_depth -->10<!-- /fact -->, device 12 ok / 14 crash), shared script heap of ~25 KB, text lost when pasting into the web editor. A `ReferenceError` on the device means "check the upload" first, "check the code" second.

## Prerequisites

- Node ≥ 20 for tests, build and mock; Node ≥ 22 for `console.js` and `hwtest.js` (global `WebSocket`). No dependencies, nothing to install.
- Repo cloned; for the device sections a reachable address `<ip>` – locally the IP of the Shelly, from the VPS `127.0.0.1:8010` through the tunnel ([09 · Installation with a VPS](09-installation-vps.md)).
- Debug websocket enabled on the device (web UI → Scripts → open the console once); `hwtest.js preflight` reports whether it is on.
- Helpful: [01 · Overall architecture](01-gesamtarchitektur.md) and the hard rules for the scripts in [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md).

## Diagram

[![From source to device and back: mock and tests, build, upload with verification, console via the debug websocket](../diagramme/en/14-debuggen-und-testen.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/14-debuggen-und-testen.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/14-debuggen-und-testen.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Without the device", 2 "Onto the device", 3 "Watching the device".

## Without the device: the mock

`tools/mock/shelly-mock.js` (v0.1.4) reproduces in Node what the scripts need from the device. The scripts run unchanged via `vm.runInNewContext` in a sandbox with the global objects `Shelly`, `Timer`, `print` and `console`. Everything runs on a virtual clock (start 12 Sep 2026 08:00 local, UTC+2): RPC answers arrive 20 ms later, timers fire in order, every run is deterministic and takes milliseconds of real time.

| Area | Reproduced | Limit or device quirk |
| --- | --- | --- |
| KVS | 50 keys × 253 characters, raw values as JSON strings, write counters (`kvsWrites`, `kvs_rev`), `KVS.GetMany` paginated | page of 5 entries (device 11); a `KVS.Set` with a non-string value is an error |
| Schedule | `Schedule.Create/Delete/DeleteAll/List`, timespec with 5, 6 or 7 fields including the seconds field | `schedCreateFailFirst`: the first `Schedule.Create` per script run fails like on the device (retry in the installer) |
| Scripts | list with the six names; `Script.Start` runs a registered file (`dev.files[name]`) as a second script, own timers and errors per run, run generation against late callbacks | `Script.GetStatus` returns fixed values – the mock has no memory model |
| Switch | `Switch.Set` with `toggle_after`, `auto_off`, `GetStatus/GetConfig/SetConfig`; hook `dev.onSwitch` for models | – |
| Sensors | `Voltmeter`, `Temperature`, `Input` (status and configuration; a disabled input → `state: null`) | values as number, `null` or function of the clock |
| Sys | `Sys.GetStatus` with local time, `unixtime`, `ram_free`, `kvs_rev`; `Shelly.getComponentStatus` | `fs_free` constant |
| Engine limits | 5 open RPCs, 5 timers, call depth <!-- fact:call_depth -->10<!-- /fact --> per script (measured via `Error().stack` at every engine boundary) | hoisting and array methods are invisible to V8 – only `syntax.test.js` checks them |

The mock measures the call depth at every `print`, `Shelly.call`, `Timer.set` and `JSON.*`; more than 10 levels end up as an error in `dev.errors`. On the device 12 levels run, 14 crash with `Too much recursion` (probe of 12 Sep 2026) – which is why the step chain `next()` is a flat loop and the window automaton of `bw_pump` runs on a tick timer with a `busy` lock. In the mock the six scripts reach 5–6 levels today.

`simulate()` plays the schedule minute by minute: due entries run to the second (seconds field, then creation order), a start on a script that is still running is skipped like on the device (`was_running`). Each run gets `maxMs` (default 10 min); if a script starts while an earlier run would still be running on the real clock, the overlap guard reports it as an error – on the device two scripts would then share the heap.

### Running one script: run-script.js

`tools/run-script.js` runs a single script against the mock and prints console, KVS, schedule, switch and result. Exit code 1 if errors occurred or the script did not stop itself.

| Option | Effect |
| --- | --- |
| `--seed` | run `bw_install.js` first and enter an example band (`pctSoll` 55, `pctLo` 40, `pctHi` 65, `pctDry` 38, `dropSlow` 4; `pctOk` stays `null`) |
| `--voltage 1.2` · `--temp 24` · `--level 0` | sensor values: SMT50 voltage in V, temperature in °C (`null` = probe missing), float switch 0/1 |
| `--kvs k=v` | set a KVS entry before the run, value as JSON; may be repeated |
| `--hwdemo` | hardware tests with the virtual operator (`tools/mock/hwdemo.js`): clock 10:07, up to 60 min of virtual runtime, `bw_pump` registered as a second script |

```bash
node tools/run-script.js scripts/bw_install.js                                   # installer: nine KVS entries, three schedule entries, auto_off
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0   # one cycle; with --seed it ends with why=cfg (pctOk missing)
node tools/run-script.js scripts/bw_main.js --seed --kvs 'cfg2={"pctSoll":55,"pctLo":40,"pctOk":50,"pctHi":60,"pctDry":28,"hyst":2,"dropSlow":4,"effMin":0.05,"effMax":30,"alpha":0.3,"sfMin":0.5,"sfStep":0.1,"dropW":null,"sfUp":0.05}' --voltage 1.2   # complete band → why=ok sec=70
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":25,"pct":20,"why":"hand","ts":1789192500}'   # manual job; without pctOk in the band: single portion
node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo    # sensor test, six phases with ramps and go commands
node tools/run-script.js scripts/bw_hwpump.js --seed --hwdemo    # pump test, bw_pump runs as a second script
node tools/run-script.js scripts/bw_zeitraffer.js --seed         # fast-forward: backup zrb1..5, profile, bw_install builds the 3/6 schedule
```

> **Note:** `--seed` does not create `pctOk`. `bw_main` then reports `why=cfg` (band open, `cfg` = configuration), `bw_pump` pumps a manual job as a single portion without measuring. To see the control loop in the window, pass a complete `cfg2` via `--kvs` – or go straight to `pump.test.js` with the pot model.

### The tests: npm test

`npm test` is `node --test "tools/test/*.test.js"`: <!-- fact:tests -->146<!-- /fact --> tests (as of 13 Sep 2026), all against the mock, no network. `npm run check` only runs `node --check` on the six scripts.

| File | Checks | Tests |
| --- | --- | --- |
| `syntax.test.js` | language scope of the engine per script: `node --check`, version line, forbidden constructs (`const`, `class`, arrow functions, template strings, `for…of`, spread, `Date`, `async`/`Promise`, anonymous functions, `parseInt`/`parseFloat`, array methods other than `push`/`slice`/`splice`/`indexOf`/`join`), use before declaration at module level (no hoisting) | 6 |
| `size.test.js` | compact output below the size limit, valid JS, exactly the `//!` lines as comments | 6 |
| `dist.test.js` | the committed `dist/` is byte-identical with the build (copy-and-paste installation) | 1 |
| `docs.test.js` | documentation check (`check-docs.js`) without counting tests | 1 |
| `install.test.js` | installer: nine KVS entries, schedule with safety-off, retry of the first `Schedule.Create`, idempotence, update of old states, static window check, abort while an operating script runs | 18 |
| `main.test.js` | `bw_main`: measurement with outlier trimming, band check, release chain, dose, pauses, dry day, wetness, day change, writing only on change | 26 |
| `learn.test.js` | check `soak` minutes after the window: `zuviel` (too much) → `sf`, `sink` (dropped), old `st`, drying rate | 11 |
| `pump.test.js` | `bw_pump` as a control loop on the pot model: result matrix from the decision log (single portion, `ok`, `over`, `feucht` (moist), `nass` (wet), `noeff` (no effect), `stall`, `unstab`, `wasser` (water), `extern`, claim, `zeit` (time), `max`) | 20 |
| `potmodel.test.js` | pot model (ramp, dead time, drain, hydrophobia, saturation, noise), `noBurst`, `simulate` with overlap guard | 9 |
| `szenario.test.js` | seven simulated days with schedule, drying and pump effect; hot days; pump without effect | 3 |
| `zeitraffer.test.js` | activate fast-forward and revert, timetable with the pot model to the second, no window runs into a cycle | 7 |
| `hwtest.test.js` · `hwpump.test.js` | hardware test scripts with the virtual operator: phases, commands, calibration, timeouts; pump test in two passes, time guard, backup and restore | 12 · 15 |
| `kal.test.js` | computation core of the calibration run (`tools/lib/kal.js`): windows from samples, states, report, write plan | 9 |
| `kvs-size.test.js` | defaults and realistic operating values stay below 253 characters per KVS value | 2 |

`tools/test/helpers.js` provides the shared building blocks: `seeded()` (installer run, example band), `patch()` (change a KVS entry), `voltFor()` (voltage for a moisture value), `hwDevice()` (device state of 12 Sep 2026), `runHwtest()`, `pumpTest()` (pass A, `bw_pump` alone, pass B) and `runZeitraffer()` (`bw_zeitraffer` plus the started `bw_install`).

### Pot model, virtual operator, console burst

| Building block | File | Purpose | Key parameters |
| --- | --- | --- | --- |
| `potModel(dev, opts)` | `tools/test/helpers.js` | analytical pot model for the control loop: `dev.voltage` becomes a function of the clock, portions come from the switch hook | `effLocal` (effect per effective pump second), `tDead`/`tDead2` (dead time of the first/further portions), `tRamp`, `delay`, `drainFrac`/`tau` (drainage), `dryPerH` (drying), `pHydro` (hydrophobia), `sat` (saturation), `noise`/`seed` (deterministic noise) |
| `ramps(dev, opts)` · `driver(dev, plan)` | `tools/mock/hwdemo.js` | virtual operator for the hardware tests: sensor ramps per phase (probe cold/warm, sensor dry/wet, float switch) and a driver that sends `go`/`skip`/`abort` through the `onRpc` hook as soon as the script polls `hwc` | ramps: `tCold`/`tWarm`, `vDry`/`vWet`, `delay`, `slow`; driver plan: `key` (`hwr`/`hwp`), `goAfter` per phase, `skip`, `abort` |
| `noBurst(dev, max)` | `tools/test/helpers.js` | counts console lines with the same virtual timestamp – the device console loses text when too many `print` lines arrive synchronously, the rule is "never more than 15 in a row" (one line per portion, the state lives in the KVS) | `max` (default 15): above it the function throws an error with the first lines; `null` only measures |

### What the mock does not show

| Device peculiarity | Consequence | Where it is caught |
| --- | --- | --- |
| mJS does not hoist function declarations | `ReferenceError` at start when `var steps = [...]` precedes the functions | `syntax.test.js` (`useBeforeDecl`); the step list sits at the very end |
| array methods missing (`shift`, `forEach`, `map`, …) | `Function "shift" not found!` in the middle of a run | `syntax.test.js`; ring buffer by index |
| call depth: 12 levels run, 14 crash | `Too much recursion` | mock limit <!-- fact:call_depth -->10<!-- /fact --> as an early warning; flat `next()` loop |
| script heap ~25 KB, shared by all scripts (`Script.GetStatus.mem_free` 24 920 idle) | `out_of_memory` in `errors`, script ends without a console line | not reproduced – `hwtest.js watch` shows `mem_used`/`mem_peak` in fast-forward, `hwtest.js scripts` (or `Script.GetStatus`) during a run; reference values in [18 · Lessons from the device](18-lernlog-geraet.md) |
| `KVS.GetMany` returns 11 entries per page | reading only the first page misses entries | mock paginates with 5, every reader paginates |
| web editor loses text when pasting | `Got EOF` or `ReferenceError` only at start | `put-script.js` and `verify-scripts.js` compare byte for byte |
| first `Schedule.Create` per run is rejected | incomplete schedule | installer retries up to 3× after 400 ms; the mock reproduces the quirk |

Every new surprise from the device goes into [18 · Lessons from the device](18-lernlog-geraet.md) – and, wherever it can be checked statically, as a rule into `syntax.test.js`.

## Build: build.js and dist/

`npm run build` (`tools/build.js` v<!-- fact:ver.build -->0.1.1<!-- /fact -->) writes a compact version of each of the six scripts to `dist/`: comments, indentation and blank lines are removed, line 1 (version comment) stays, and comment lines starting with `//!` remain as `// …` – that is the device documentation readable in the Shelly script editor. `scripts/` remains the source; only `dist/` goes onto the device.

The size limit protects the shared heap: <!-- fact:size_limit -->16000<!-- /fact --> bytes per script, `bw_pump` may have <!-- fact:size_limit_pump -->18000<!-- /fact --> bytes because, thanks to the deadline, it never runs next to `bw_main` (firmware 2.0.0 also stores 19 KB). Above the limit the build reports `ÜBER LIMIT` (over limit) and exits with code 1; `size.test.js` and `dist.test.js` pin both down.

Current sizes of the compact output: `bw_install` <!-- fact:dist.bw_install -->15978<!-- /fact -->, `bw_main` <!-- fact:dist.bw_main -->15791<!-- /fact -->, `bw_pump` <!-- fact:dist.bw_pump -->17475<!-- /fact -->, `bw_hwtest` <!-- fact:dist.bw_hwtest -->13952<!-- /fact -->, `bw_hwpump` <!-- fact:dist.bw_hwpump -->14500<!-- /fact -->, `bw_zeitraffer` <!-- fact:dist.bw_zeitraffer -->7459<!-- /fact --> bytes. `bw_install` and `bw_main` are close to the limit – split or shorten before larger extensions.

```bash
npm run build                 # write dist/, show sizes and doc lines per script
node tools/build.js --debug   # the same with var DEBUG = 1 in every file – upload only for debugging
```

> **Note:** `dist/` is committed so that the copy-and-paste installation works without Node ([07 · Installation by hand](07-installation-per-hand.md)). Every change to `scripts/` needs a fresh `npm run build`, otherwise `dist.test.js` fails.

## Onto the device: put-script.js and verify-scripts.js

The web editor lost text when pasting (12 Sep 2026: 166 and 210 bytes were missing – once the end of the file, once a piece from the middle; the rest parsed and died only at start). That is why the upload goes via RPC – and is verified afterwards.

1. `node tools/put-script.js <ip> <id> dist/<script>.js` (v<!-- fact:ver.put-script -->0.1.2<!-- /fact -->): first checks the flash (`Sys.GetStatus.fs_free` plus the script's old code must hold the new file plus 4 096 bytes of reserve), stops the script (`Script.PutCode` only works on a stopped script) and sends the file in chunks of 1 024 characters (`append: true` from the second one).
2. Then it downloads the code completely via `Script.GetCode` and compares it byte for byte with the file. Exit code 0 only for `OK, byteidentisch` (byte-identical); otherwise `FEHLER, Code weicht ab (N Byte Differenz)` (error, code differs by N bytes) – then simply upload again.
3. `node tools/verify-scripts.js <ip>` (check 2, v0.1.1): compares all scripts on the device that exist in `dist/`, counts the doc lines and checks that `bw_main` and `bw_pump` carry the same version (they share `st`, `job`, `lrn`). Exit code 0 = all equal, 1 = difference, 2 = usage error.

```bash
node tools/put-script.js <ip> <id> dist/bw_main.js   # script id from the web UI or from hwtest.js scripts
node tools/verify-scripts.js <ip>                    # after every upload, even after an upload via the editor
node tools/verify-scripts.js <ip> bw_main bw_pump    # only specific scripts
```

The device assigns the script ids when a script is created; the scripts and tools look scripts up by name. `hwtest.js scripts` lists all scripts with id, size, `mem_peak` and `fs_free`.

> **Measured on the device (13 Sep 2026):** flash is tight. With seven scripts `fs_free` was 12 288 B; after deleting `engine_probe`, `bw_hwtest` and `bw_hwpump` (via `Script.Delete`, today `hwtest.js delete`) it was 49 152 B (≈ 36 KB gained), after uploading `bw_pump` with 17 475 B still 40 960 B – LittleFS counts in 4 KB blocks. If the flash is too full, `put-script.js` aborts before the first chunk so that no half-written code is left behind.

## Watching the device

### Debug websocket and console.js

All `print` lines of the scripts arrive via the debug websocket `ws://<ip>/debug/log`. It is only on when `Sys.GetConfig` → `debug.websocket.enable` is `true`; the web UI switches it on when the console is opened, `hwtest.js preflight` warns when it is off. Without it `console.js`, `hwtest.js watch` and the recorder of `kal` see not a single line.

`node tools/console.js <ip> [sec] [id]` (v<!-- fact:ver.console -->0.1.0<!-- /fact -->) connects, optionally starts a script via `Script.Start` and collects all lines raw for `sec` seconds (default 10) – including the firmware noise. The connection is up before the script starts; otherwise the first line is missing. 900 s cover a whole watering window.

```bash
node tools/console.js <ip> 12 <id>    # connect, start script <id>, read for 12 s
node tools/console.js <ip> 900        # read a whole watering window from 08:00:30 (start it beforehand)
```

### hwtest.js watch and the status line

`node tools/hwtest.js <ip> watch [sec]` reads the same websocket, filters the firmware lines out, reconnects after a drop and writes a status line every 5 s whenever it changes. Default 120 s, at most 300 s; in fast-forward 1 800 s. In normal operation `watch` ends after a few seconds when no test script is running – only the hardware tests and the fast-forward (backup `zrb1` present) keep it open.

- Status line normal: `[status HH:MM] läuft: … | V= tC= lvl= sw= | hwr: … | hwp: …` (`läuft` = running).
- Status line in fast-forward: `ZEITRAFFER st=<state>/<why> n= sec= pctB= pctW= effW= tr= job=<why>/<sec> day.n= err= mem(used/peak) main=… pump=… free=…` (`ZEITRAFFER` = fast-forward) – `mem` comes from `Script.GetStatus` and shows `!out_of_memory` when a script has crashed.
- In the pump test `watch` starts pass B of `bw_hwpump` automatically as soon as `bw_pump` has finished.

### DEBUG = 1

Every script has the line `var DEBUG = 0;` directly below `var VER`. Set to `1`, `dbg()` additionally writes every step (`schritt i/n`, `schritt` = step), every RPC call with parameters (`rpc <method> <params>`), every KVS entry read with type and content (`kvs <key> <type> <JSON>`) and measurements to the console – as `[bw_main dbg] …`. New diagnostic points go in as `dbg(...)`, never as `log(...)`.

Not every script has all three patterns: `bw_pump` (tick automaton) logs only `rpc <method>` without parameters plus its measurements (`ring …`), `bw_hwtest` logs the KVS entries without a type, `bw_hwpump` no KVS entries at all.

1. `node tools/build.js --debug` – `dist/` with `DEBUG = 1`, no manual edit in the editor.
2. Upload the affected script with `put-script.js`, connect `console.js` and start it.
3. For normal operation run `npm run build` again and upload again; the repo keeps `DEBUG = 0`.

> **Note:** the debug version is larger and talks more. Do not leave it in the schedule permanently – the websocket drops lines during bursts, and the heap is shared.

### Firmware noise in the console

Besides the `print` lines the websocket delivers lines from the firmware. They are neither script output nor errors:

| Line | Meaning |
| --- | --- |
| `shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`, `y_notifications.cpp`, `shelly_debug.cpp`, `shelly_script.cpp`, `shos_init.c`, `mgos_…` | RPC and script management; `watch` filters exactly these prefixes |
| `JS RAM stat … used: N` at start | heap after parsing (13 Sep 2026, versions 0.1.x: `bw_hwtest` 3 564, `bw_main` 5 404, `bw_pump` 7 396 B; `bw_main` 0.2.0: 5 348 B) |
| `shelly_ejs_timer.cpp:44 Timer 1 handle not found` after a `bw_main` run | `Timer.clear` on its own repeating timer from inside its callback – harmless |
| `persistent_counters.cpp:585 PCS write interval < 60s` | counter write of the switch for portions less than 60 s apart – harmless |
| `JS Error [id] out_of_memory used=… peak=… total=…` | a script died on the shared heap – serious, see Typical problems |

### Looking things up via RPC

Every question to the device also works without a tool via HTTP; the answers are JSON. Complete list with parameters and documentation links: [20 · RPC and engine reference](20-rpc-referenz.md).

| Question | Call | What to look at |
| --- | --- | --- |
| What is in the KVS? | `curl -s "http://<ip>/rpc/KVS.GetMany?match=*"` or `tools/kvs_dump.sh <ip>` | paginated (11 per page); the shell script reads all pages and appends `Sys.GetStatus` |
| Did the script crash, how much heap? | `curl -s "http://<ip>/rpc/Script.GetStatus?id=<id>"` | `errors` (e.g. `out_of_memory`, stays until the next run), `mem_used`, `mem_peak`, `mem_free` |
| Is the code complete on the device? | `curl -s "http://<ip>/rpc/Script.GetCode?id=<id>&len=1"` | `left + 1` must equal the file size; better `verify-scripts.js` |
| Is the schedule right? | `curl -s http://<ip>/rpc/Schedule.List` | `jobs[].timespec`: `0 */15 * * * *`, `30 0 8,20 * * *`, `0 8 8,20 * * *` with the defaults |
| Flash, RAM, time, write counter? | `curl -s http://<ip>/rpc/Sys.GetStatus` | `fs_free`, `ram_free`, `time`/`unixtime` (`null` without NTP), `kvs_rev` |
| Is the debug websocket on? | `curl -s http://<ip>/rpc/Sys.GetConfig` | `debug.websocket.enable` |

## Tool reference

All tools live in `tools/` and need no dependencies; the device tools take the address `<ip>` as the first argument. Exit codes: 0 ok, 1 error or blocker, 2 usage error.

| Tool | Version | Call | Purpose |
| --- | --- | --- | --- |
| `build.js` | <!-- fact:ver.build -->0.1.1<!-- /fact --> | `npm run build` · `node tools/build.js --debug` | write `dist/`, check sizes, keep the `//!` docs |
| `run-script.js` | 0.1.1 | `node tools/run-script.js scripts/<script>.js [--seed] [--voltage V] [--temp C] [--level 0/1] [--kvs k=v] [--hwdemo]` | run one script against the mock |
| `mock/shelly-mock.js` · `mock/hwdemo.js` | 0.1.4 · 0.1.0 | library for the tests and `run-script.js` | device in Node; virtual operator |
| `put-script.js` | <!-- fact:ver.put-script -->0.1.2<!-- /fact --> | `node tools/put-script.js <ip> <id> dist/<script>.js` | upload in chunks with flash check and byte-identical comparison |
| `verify-scripts.js` | 0.1.1 | `node tools/verify-scripts.js <ip> [name …]` | compare all scripts on the device with `dist/`, versions `bw_main` = `bw_pump` |
| `console.js` | <!-- fact:ver.console -->0.1.0<!-- /fact --> | `node tools/console.js <ip> [sec] [id]` | read the console raw, optionally start a script (Node ≥ 22) |
| `hwtest.js` | <!-- fact:ver.hwtest -->0.1.2<!-- /fact --> | `node tools/hwtest.js <ip> <command> [args]` | hardware tests, fast-forward, measurement run, calibration run, scripts on the device (Node ≥ 22); subcommands below |
| `kvs_dump.sh` | 0.1.0 | `tools/kvs_dump.sh <ip>` | all KVS pages raw plus `Sys.GetStatus` |
| `lib/kal.js` | 0.1.1 | library for `hwtest.js kal` | computation core of the calibration run, testable without a device (`kal.test.js`) |
| `probe/engine_probe.js` | 0.1.5 | upload with `put-script.js`, start with `console.js` | probe script for engine peculiarities (KVS.Set variants, response format, stack depth); does not run in the mock |

### hwtest.js: subcommands

The procedures themselves are in [11 · Hardware check](11-hardware-check.md) (sensor and pump test) and [12 · First commissioning](12-erstinbetriebnahme.md) (fast-forward, measurement run, calibration run); here only what each command does.

| Command | Does |
| --- | --- |
| `preflight [hw]` | pre-check: time, seconds to the next cycle, distance to `winA`/`winB`/midnight, running scripts, input 1, switch 0, KVS (`err`, `job`, `day`, `hwt`, `hwb*`), debug websocket; creates `bw_zeitraffer` via `Script.Create`, with `hw` also `bw_hwtest`/`bw_hwpump` (they cost flash – only when needed), and prints the upload commands. Exit 1 on blockers |
| `scripts` | all scripts with id, size on the device, running, `mem_peak`, errors; plus `fs_free`, `ram_free`, free script heap |
| `delete <id>` (or name) | delete a test script via `Script.Delete`, `fs_free` before/after; never `bw_install`, `bw_main`, `bw_pump`, `bw_zeitraffer` |
| `input-on` | `Input.SetConfig` for `cfg1.idLvl`: `enable: true`, `type: "switch"` – the only configuration change, only on request |
| `cfg k=v …` | set fields in `hwt`, values as JSON (e.g. `cfg pumpSec=30 tLo=21`); the value stays below 253 characters |
| `start bw_hwtest [sec]` · `start bw_hwpump [sec]` | write `hwc {n:0}`, delete the old report (`hwr`/`hwp`), start the script by name, then `watch` (`sec`, default 60) |
| `watch [sec]` | filtered console plus a status line every 5 s; ends when no test script is running any more (fast-forward: purely time-controlled), otherwise after `sec` (default 120, max 300, fast-forward 1 800); starts pass B of the pump test automatically |
| `go` · `skip` · `abort` | command to the waiting phase: write `hwc` with `n + 1`; `skip` skips (code `sk`), `abort` ends the run (code `ab`) |
| `status` | one-liner: running scripts, `hwr`, `hwp`, sensors, switch; in fast-forward the fast-forward status line |
| `report` | `hwr`/`hwp` readable (phase codes `ok`, `sk`, `to`, `ab`, `fe`, `nl`, `aw`) with comparison to `cfg1` |
| `restore` | write `hwb1`/`hwb2` back to `st`/`day`/`job`/`err`/`lrn`, set `job.ok` to `false`, delete the backup – only while `bw_hwpump` is not running |
| `cleanup` | delete `hwc`, `hwb1`, `hwb2`; `hwt`, `hwr`, `hwp` remain as evidence |
| `stop` | emergency stop: `Script.Stop` for `bw_hwtest`, `bw_hwpump`, `bw_zeitraffer`, `bw_pump` and `Switch.Set {on:false}`; then `restore` |
| `zeitraffer [sec]` | practice test in fast-forward: pre-check (target band complete and ordered, `cfg3.tick`, water level FULL, output off, code of all four operating scripts, no `hwb*`), safe moment, `Script.Start bw_zeitraffer`, read along, then verify schedule/`cfg3`/`cfg4`/`auto_off`/backup, print the timetable |
| `normal [sec]` | back to normal operation or installer after an update: safe moment, `Script.Start bw_install`, read along, then schedule, `auto_off`, no backup left, no script errors |
| `mess [sec] [n] [obs]` | measurement run: `n` pulses (1–6) of `sec` s (1–10) via `Switch.Set toggle_after`, sensor every 2 s over `obs` s (30–300, default 90) per pulse; per pulse moisture before, `tRise`, peak, settled value, gain %/s; suggestions for `effMax`, `tPmin`, `tMin`, `tDead`, `tSoak`, `tStab`; raw data `docs/kal/<date>-mess.json`. Only with output off, float switch FULL, no fast-forward |
| `kal [sec]` | calibration run: fast-forward as above, timetable dry → medium moist → wet, recorder every 5 s (sensors, output, `st`/`job`/`lrn` on change, console lines of `bw_main` and `bw_pump`) over `sec` s (600–3 600, default 2 400) to `docs/kal/<date>-kal.json`, report at the end; the fast-forward keeps running |
| `kal report [file] [log]` | report from the newest recording: per window the state after `m0`, portions, Σ s, `tRise`, peak, settled value, `effW`, `why`; gain per state; suggestions for `lrn.effW` (scale "% per s after tRise"), `cfg4.tDead2`, `cfg3.tDead`. `log` pulls console lines from a `watch` log file |
| `kal write [file] [log]` | write the suggestions (`lrn.effW` as a mix α 0.5 with the previous value, `cfg4.tDead2`, `cfg3.tDead`, `cfg3.tMin`) – only in normal operation (refused while `zrb1` exists), read-modify-write, before/after in the output |

Safe moment (`zeitraffer`, `normal`, `mess`): second 8–30 of the minute (the `bw_main` cycle is done, the next one is far away); in fast-forward not in minutes 0–2 of the 6-minute cycle (`bw_pump` is regulating there); in normal operation not in the 9 min after `winA`/`winB`; no operating or test script running. The tool waits up to 4 min for it.

### Documentation tools

| Command | Does |
| --- | --- |
| `npm run docs:geruest` | rewrite the indexes `docs/de/README.md` and `docs/en/README.md` from `tools/docs/kapitel.json`, create missing chapters as placeholders (never overwrite existing ones) |
| `npm run docs:diagramme` · `node tools/docs/build-diagramme.mjs --only NN` | build the Archify diagrams from `docs/diagramme/src/`: validate, HTML and SVG in both languages, receipt, gallery; `--check` only compares the checksums |
| `npm run docs:check` · `node tools/check-docs.js --nur docs/de/NN-slug.md` | documentation check: links and anchors, images, DE/EN parity, chapter template, fact and default markers against the scripts, outdated phrases, readability, diagram receipts; `--mit-tests` determines the test count |

### Repository layout at a glance

Where things live (as of 13 Sep 2026; `npm test` runs <!-- fact:tests -->146<!-- /fact --> tests from `tools/test/`):

```text
scripts/      bw_install.js, bw_main.js, bw_pump.js, bw_hwtest.js, bw_hwpump.js, bw_zeitraffer.js  ← source; run on the Shelly
dist/         compact output of the six scripts for the upload (committed, byte-identical with the build)
tools/        build.js, put-script.js, verify-scripts.js, console.js, hwtest.js, run-script.js, kvs_dump.sh, check-docs.js
tools/mock/   shelly-mock.js (device in Node), hwdemo.js (virtual operator)
tools/lib/    kal.js (computation core of the calibration run)
tools/probe/  engine_probe.js (probe script for the device, does not run in the mock)
tools/test/   *.test.js for node --test, helpers.js (seeded, potModel, pumpTest, runZeitraffer …)
tools/docs/   scaffold, diagram build, kapitel.json, verboten.json  ← documentation tools
docs/         de/ and en/ (this handbook), diagramme/ (src/ → de/, en/, receipts/), kal/ (raw data of measurement and calibration runs)
hardware/     parts list, wiring
.claude/      skills/graft/SKILL.md, settings.json; next to it .mcp.json (graft as MCP server)
README.md · CLAUDE.md (hard rules for the scripts) · AGENTS.md (rules for AI agents) · LICENSE
```

Concept, stage log, lessons from the device, test protocol and RPC reference are chapters [16 · Concept and decisions](16-konzept-und-entscheidungen.md) to [20 · RPC and engine reference](20-rpc-referenz.md) of this handbook.

## graft

The repo is indexed with graft (`graft/`, gitignored; the index refreshes itself before every query). For code questions ask graft first, then open exactly the place it names – that saves time and, for agents, context. Installing graft is not part of this repo; without graft, `grep` and the files in `scripts/` and `tools/` work just as well. Details: [`.claude/skills/graft/SKILL.md`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/.claude/skills/graft/SKILL.md).

```bash
graft ask "how is the watering job created" --source   # hits with file:line and code
graft grep "toggle_after"                              # every occurrence, grouped by function
graft skeleton scripts/bw_pump.js                      # all signatures of a file in ~200 tokens
graft callers writeNext --depth 2                      # who calls a symbol – before renaming
graft map                                              # orientation: directories, hubs
graft check                                            # does the index match the code? (CI)
graft build --deep                                     # concept nodes after larger changes
```

## Example output

Real output of the tools at the repo state of 13 Sep 2026 (mock and build run without a device):

```text
$ npm test
…
ok 146 - Fahrplan im Zeitraffer (Topfmodell): feucht → Fenster 1 in Portionen → 12 min Pause → Fenster 2 → Hitze-Fenster nach 6 min → wasser → Fenster 4 → limit, 42 min
…
1..146
# tests 146
# suites 0
# pass 146
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5873.687028
```

```text
$ npm run build
bw_install.js    23789 →  15978 Byte, 22 Doku-Zeilen
bw_main.js       23059 →  15791 Byte, 8 Doku-Zeilen
bw_pump.js       20330 →  17475 Byte, 5 Doku-Zeilen
bw_hwtest.js     16792 →  13952 Byte, 4 Doku-Zeilen
bw_hwpump.js     18736 →  14500 Byte, 4 Doku-Zeilen
bw_zeitraffer.js 13822 →   7459 Byte, 12 Doku-Zeilen
dist/ geschrieben – hochladen mit node tools/put-script.js <ip> <id> dist/<datei>, prüfen mit node tools/verify-scripts.js <ip>
```

```text
$ node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
--- Konsole ---
[bw_main 0.2.0] V=1.2 pct=34.13 tC=24 lvl=0 st=beob dry=0 pause=24h why=cfg sec=- effW=- sf=0.7 err=cfg w=4 dauer=2620ms
--- KVS (13 Schreibvorgänge im Lauf: 4) ---
cfg1  139 {"vDry":0.2,"vWet":3.13,"vErrLo":0.1,"vErrHi":3.35,"nSample":5,"msSample":500,"lvlEmpty":1,"nLvl":3,"idV":100,"idT":100,"idLvl":1,"idSw":0}
…
job    63 {"ok":false,"sec":null,"pct":34.13,"why":"cfg","ts":1789192800}
day    35 {"date":"2026-09-12","n":0,"sec":0}
err    43 {"code":"cfg","ts":1789192800,"mem":120000}
--- Zeitplan ---
1 0 */15 * * * * [{"method":"Script.Start","params":{"id":2}}]
2 30 0 8,20 * * * [{"method":"Script.Start","params":{"id":3}}]
3 0 8 8,20 * * * [{"method":"Switch.Set","params":{"id":0,"on":false}}]
--- Switch 0 --- {"initial_state":"off","auto_off":true,"auto_off_delay":190,"auto_on":false,"auto_on_delay":0} output=false
--- Ergebnis --- beendet=true Dauer=2620 ms, max. offene RPC=1, max. Aufruftiefe=5, Fehler=0
```

How to read it (`Konsole` = console, `Schreibvorgänge` = writes, `Zeitplan` = schedule, `Ergebnis` = result, `Doku-Zeilen` = doc lines, `st=beob` = state "observing"): the cycle measures 34.1 % (1.2 V with `vDry` 0.20 / `vWet` 3.13), but `pctOk` is `null` → `why=cfg`, `err=cfg`, four writes (`w=4`: `lrn` with the day's maximum, `day` with the date, `job`, `err`; `st` stayed unchanged).

The schedule carries second 30 for `bw_pump` and the safety-off 8 min after the window; `auto_off` is `tMax` + 10 = 190 s. The result line is the actual check: `beendet=true` (the script stopped itself via `Script.Stop`), at most one open RPC, call depth (`Aufruftiefe`) 5 of <!-- fact:call_depth -->10<!-- /fact --> allowed, no errors (`Fehler=0`).

> **Measured on the device (13 Sep 2026):** upload of the four operating scripts with `put-script.js` and `verify-scripts.js`: `bw_pump` 17 475, `bw_main` 15 791, `bw_install` 15 978, `bw_zeitraffer` 7 453 B, all `OK, byteidentisch`, versions `bw_main` = `bw_pump` = 0.2.0. In the first control-loop window the `watch` status line showed `mem_used` 10 360–10 500 and `mem_peak` 12 516 for `bw_pump` at `mem_free` 25 200 – together with the 5 348 B parse footprint of `bw_main` that stays below 25 000.

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `put-script.js` reports `FEHLER, Code weicht ab (N Byte Differenz)` | the transfer to the device was not lossless | upload again; never paste via the editor without running `verify-scripts.js` afterwards |
| `Script.PutCode` fails | the script is still running – `put-script.js` stops it beforehand; or `Flash zu voll: fs_free …` (flash too full) | remove test scripts with `hwtest.js scripts` / `delete <id>` (13 Sep 2026: +36 KB), then retry |
| `Uncaught ReferenceError: "…" is not defined` or `Got EOF expected '}'` at start on the device | end or middle of the file missing (editor) – or a function name is used at module level before its declaration | `verify-scripts.js` first; then `npm test` (`syntax.test.js` names both lines) |
| `Too much recursion - the stack is about to overflow` | nested call chain deeper than about 12 levels | `next()` as a loop: steps return `true`, callbacks call `next()`; the mock warns from <!-- fact:call_depth -->10<!-- /fact --> |
| `Function "shift" not found!` (or `map`, `forEach` …) | mJS only knows `push`, `slice`, `splice`, `indexOf`, `join` | ring buffer by index; `syntax.test.js` fails as soon as the method appears in the code |
| `Script.GetStatus` → `errors: ["out_of_memory"]`, script ends without a console line | two large scripts at the same time on the shared heap (~25 KB): a test script next to `bw_main`, `bw_pump` in the same second as `bw_main` | never two large scripts at once; long runners release `K`/`orig` while waiting; `bw_pump` starts at second 30; measure `mem_peak` with `hwtest.js watch` (fast-forward) or `hwtest.js scripts` / `Script.GetStatus` during the run |
| console full of `shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`, `y_notifications.cpp` … | firmware noise, not script output | ignore; `hwtest.js watch` filters it, `console.js` shows it raw |
| `console.js` shows nothing, `watch` no console lines | debug websocket off | web UI → Scripts → open the console (switches `debug.websocket.enable` on); `preflight` checks it |
| the first console line of a script is missing | the websocket was not connected yet at `Script.Start` | `console.js <ip> <sec> <id>` starts the script only after connecting |
| `hwtest.js watch` ends after a few seconds | in normal operation no test script keeps it open | for a real window `console.js <ip> 900` or the web UI console |
| console loses lines with many `print` calls in a row | a burst of more than ~15 lines overwhelms the websocket | state into the KVS, one line per portion; `noBurst()` in the mock checks it |
| `Hinweis: Schedule.Create '…' abgelehnt (…), Versuch 2/3` (rejected, attempt 2/3) | already the second rejection of the same entry (the installer retries the first one silently, `dbg` only) | the installer tries up to 3× after 400 ms; if the last attempt fails too, the line reads `Schedule.Create '…': <error text>` without `Hinweis` – then look at `Schedule.List` and start the installer again (`hwtest.js normal`) |
| `npm test` red in `dist.test.js` | `scripts/` changed, `dist/` not rebuilt | `npm run build`, then commit `dist/` as well |
| `run-script.js` ends with `beendet=false` | the script did not stop itself via `Script.Stop` (open timer, missing step) | read the console of the run; use `--hwdemo` for the long runners |

## Next

- [15 · Extending the controller with Claude Code](15-ausbau-mit-claude-code.md) – the tools in the workflow: plan, acceptance criteria, debug environment, coding, verification
- [18 · Lessons from the device](18-lernlog-geraet.md) – every surprise the mock does not show, with symptom, cause, fix and the rule in the tests
- [20 · RPC and engine reference](20-rpc-referenz.md) – every RPC in use with parameters and response, engine facts with measurement date
