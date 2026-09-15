# 20 · RPC and engine reference

[Deutsch](../de/20-rpc-referenz.md) · **English** — [Handbook](README.md) · Part F "Development"

> **At a glance**
> - Rule: before every new `Shelly.call`, look it up here – and extend the table (parameters, response, who calls it, docs link). Every call has been checked against the Gen2 docs, as of 0.2.0 (13 Sep 2026); base URL `https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/<Component>`.
> - 27 RPC methods across scripts and tools, seven functions of the script API. Each script keeps at most one `Shelly.call` and one timer open (device limit 5 each).
> - Engine facts with a measurement date: 12 stack levels run, 14 crash (mock limit <!-- fact:call_depth -->10<!-- /fact -->); one script heap of about 25 KB for all scripts; mJS does not hoist and has no `shift`; compact code at most <!-- fact:size_limit -->16 000<!-- /fact --> B per script, `bw_pump` <!-- fact:size_limit_pump -->18 000<!-- /fact --> B.
> - Biggest pitfall: the firmware message "Failed validation" on the first `Schedule.Create` of an installer run is wrong – the installer silently repeats the call.

## Prerequisites

- none – a reference chapter. The rules themselves (what is forbidden in `scripts/*.js`, how the step chain is built) live in [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) and are enforced by [`tools/test/syntax.test.js`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/test/syntax.test.js); this chapter holds the facts and measurements behind them.
- What the limits mean for operation is explained in [04 · Safety and limits](04-sicherheit-und-grenzen.md); the tools that measure them are in [14 · Debugging and testing](14-debuggen-und-testen.md).

## Diagram

[![Sequence: bw_pump in the watering window – Script.Start from the schedule, nine KVS.Get, clock read synchronously, claim via KVS.Set, Switch.Set with toggle_after, measurements every tChk and tStep, re-read, KVS.Set only for changes, Script.Stop](../diagramme/en/20-rpc-referenz.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/20-rpc-referenz.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/20-rpc-referenz.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Read: Script.Start, KVS.Get ×9", 2 "Portion: claim, Switch.Set, measure", 3 "Write and end".

The diagram shows `bw_pump` <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, the script that combines RPC calls, synchronous reads and a timer in one window, in the order of its step chain: read (steps 1–3), window as a tick state machine (step 4), re-read, result, write and end (steps 5–8). Solid arrows are `Shelly.call` requests (asynchronous, never more than one open), dashed arrows are all synchronous reads via `Shelly.getComponentStatus` (clock, fresh measurement `m0`, checks every `tChk`/`tStep`). Responses appear as return arrows: `value` as a JSON string, `was_on`, `etag`/`rev`.

## RPC calls via Shelly.call

All calls go through `Shelly.call(method, params, callback, userdata)`; the tools in `tools/` call the same methods over HTTP (`POST http://<ip>/rpc/<Method>` with a JSON body; `console.js` and `kvs_dump.sh` use `GET …?param=value`). The column "Used by" names the script or tool; the column "Docs" links to the component under the base URL. The tables are split by component so that no cell grows longer than necessary.

### KVS

| Call | Parameters | Response | Used by | Docs |
| --- | --- | --- | --- | --- |
| `KVS.GetMany` | `match` (default `*`), `offset` | `items`, `offset`, `total` – paginated: keep reading until `offset + count ≥ total`. On the device `items` is an array of `{key, etag, value}` (probe 12 Sep 2026); the docs describe an object `key → {etag, value}` – only `bw_zeitraffer` reads both forms; `bw_main`, `bw_install`, `bw_hwtest`, `bw_hwpump` expect the array | `bw_main`, `bw_install`, `bw_zeitraffer`, `bw_hwtest`, `bw_hwpump`, `tools/kvs_dump.sh` | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Get` | `key` | `etag`, `value`; error `-105` when the key is missing (in the script → `null`) | `bw_pump`: chain over exactly nine keys `cfg1 cfg2 cfg3 cfg4 lrn st job day err` (driver `getNext()`) instead of `GetMany "*"`, so that no `hw*`/`zrb*` strings sit in the heap; after the window it re-reads `st day job err lrn`. `bw_hwtest`, `bw_hwpump`: command channel `hwc` (command entry) every `nCmd` <!-- hwt:nCmd -->2<!-- /hwt --> ticks. `tools/hwtest.js` | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Set` | `key`, `value` – always a JSON string (`JSON.stringify`), optional `etag` | `etag`, `rev` | all scripts, only on change. Before the first portion of a regulated window `bw_pump` writes the claim `st` with `why:"laeuft"` (running; if it fails → `why=kvs`, no watering; the single portion writes no claim) and at the end only changed entries; `tools/hwtest.js` (`cfg`, `start`, `go`/`skip`/`abort`, `restore`, `kal write`) | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Delete` | `key` | `rev`; `-105` when the key is missing | `bw_install` (marker `zr`, backup `zrb1`…`zrb5`; `-105` from an older backup without `zrb4`/`zrb5` is ignored), `bw_hwpump` (`hwb1`/`hwb2` after the restore), `tools/hwtest.js start` (old report `hwr`/`hwp`), `restore`/`cleanup`, a human (deleting `err`) | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |

> **Note:** `KVS.Set` replaces the whole entry. A partial object entered by hand (say only `{"pctLo":40}`) deletes all other fields – so use "Format as JSON" in the web UI and run the installer again after a manual change; it fills missing fields with their defaults ([03 · Configuration](03-konfiguration.md)).

### Schedule

| Call | Parameters | Response | Used by | Docs |
| --- | --- | --- | --- | --- |
| `Schedule.Create` | `enable`, `timespec` (5, 6 or 7 cron fields), `calls[] {method, params}` | `id`, `rev` | `bw_install`. The first Create of a run reproducibly fails on the device (deterministic, device runs 12/13 Sep 2026) with "Invalid argument 'timespec': Failed validation!" – retried up to `CRETRY_MAX` 3 times after `CRETRY_MS` 400 ms, the first rejection silently, only the second as `Hinweis:` (note) in the console | [Schedule](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule) |
| `Schedule.List` | – | `jobs[] {id, enable, timespec, calls[]}`, `rev` | `bw_install` (recognising its own entries: `Script.Start` on `bw_main`/`bw_pump` or `Switch.Set` on `cfg1.idSw`), `tools/hwtest.js` (`verifyState` after `normal`/`zeitraffer`) | [Schedule](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule) |
| `Schedule.Delete` | `id` | `rev` | `bw_install` (its own entries before creating them anew) | [Schedule](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule) |

The installer creates three entries when `winA` and `winB` share the same minute, otherwise up to five; the device assigns the IDs, the console reports `Zeitplan #<id>: <timespec>` (schedule). These timespec forms have been accepted by the device:

```text
# As of 0.2.0 (installer v0.1.3) – accepted by the device 13 Sep 2026, FW 2.0.0
0 */15 * * * *                           bw_main every 15 min (cfg3.tick)
30 0 8,20 * * *                          bw_pump at 08:00:30 and 20:00:30 (PUMP_SEC 30, never alongside bw_main)
0 8 8,20 * * *                           safety-off: SAFE_MIN = (30 + tWin + 10) s rounded up = 8 min after the window minute
0 */3 * * * *   30 */6 * * * *           fast-forward: cycle 3 min, window every 6 min
40 2,8,14,20,26,32,38,44,50,56 * * * *   fast-forward: safety-off 160 s after every window minute (minute list with seconds field)
# History 0.1.3 (kept only as proof that the device accepts these forms; 13 Sep 2026)
0 5 8,20 * * *                           safety-off back then at minute 5
0 * * * * *   0 */2   15 */2   30 */2   45 */2 * * * *   fast-forward 0.1.3: seconds field not 0 and * in the minute
```

The minute list with a seconds field was open until the device run on 13 Sep 2026 and was accepted there on the first attempt (schedule of the fast-forward run, [19 · Device test protocol](19-pruefprotokoll.md)).

### Script

| Call | Parameters | Response | Used by | Docs |
| --- | --- | --- | --- | --- |
| `Script.List` | – | `scripts[] {id, name, enable, running}` | `bw_install` (IDs by name; aborts with `err.code = "cfg"` while `bw_main`/`bw_pump` is running), `bw_zeitraffer` (ID of `bw_install`; no operating or test script may run), `bw_hwpump` (ID of `bw_pump`, number of running scripts), `tools/hwtest.js`, `tools/verify-scripts.js` | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.Start` | `id` | `was_running` | schedule (`bw_main`, `bw_pump`); `bw_hwpump` → `bw_pump` (stops itself afterwards: shared heap); `bw_zeitraffer` → `bw_install` (`K` released first); `tools/hwtest.js`, `tools/console.js` | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.Stop` | `id` | `was_running` | all scripts on their own ID (`Shelly.getCurrentScriptId()`); `tools/hwtest.js stop` (emergency off), `tools/put-script.js` before the upload | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.SetConfig` | `id`, `config {enable}` – `enable` is the autostart at boot | `restart_required` | `bw_install`: `enable` false for `bw_main` and `bw_pump`, the schedule starts them. The test scripts are never in the schedule and start only by hand | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.GetStatus` | `id` | `running`, `mem_used`, `mem_peak` (only while running), `mem_free` (free script heap, the same for all scripts), `cpu`, `errors[]` (e.g. `"out_of_memory"`, stays until the next run), `error_msg` | `tools/hwtest.js` (`watch`, `status`, `scripts`): in fast-forward mode `mem_used`/`mem_peak` of `bw_main` and `bw_pump` in the status line | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.Create` | `name` | `id` | `tools/hwtest.js preflight` (creates `bw_zeitraffer`, with `preflight hw` also `bw_hwtest`/`bw_hwpump`) | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.Delete` | `id` | `{}` – the script must be stopped | `tools/hwtest.js delete <id\|name>` (never an operating script; shows `fs_free` before/after); before the 0.2.0 upload `engine_probe`, `bw_hwtest`, `bw_hwpump` were removed this way (13 Sep 2026) | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.PutCode` | `id`, `code` (string), `append` (true = append) | `len` (total length in bytes) | `tools/put-script.js`: upload in 1024-character chunks, script stopped first, `fs_free` checked first | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.GetCode` | `id`, `offset`, `len` | `data`, `left` (remainder in bytes) | `tools/verify-scripts.js` and `put-script.js`: load the whole code (in chunks until `left` is 0) and compare it byte for byte with `dist/`. Short form `len=1` → `left + 1` = file size (`hwtest.js preflight`/`scripts`) | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |

> **Measured on the device (13 Sep 2026):** `Script.GetStatus.mem_free` idle 24 920 B (stage 10: 25 200 B), the same value for every script – the heap is shared. `bw_pump` in the window `mem_used` 10 360–10 500, `mem_peak` 12 516; `bw_main` 5 348 B when parsing, per cycle `mem_used` 13 216 / `mem_peak` 16 380 (v0.1.2 with 14 KVS entries). Acceptance stage 10: 12 516 + 5 348 < 25 000.

### Switch

| Call | Parameters | Response | Used by | Docs |
| --- | --- | --- | --- | --- |
| `Switch.Set` | `id`, `on`, optional `toggle_after` (s) | `was_on` | `bw_pump`: per portion `on:true, toggle_after: sec` (at most `cfg4.tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s; `was_on === true` → window ends with `extern` (external)), after every portion and on abort `on:false`. Schedule (safety-off), `bw_hwpump` only `on:false` (error case), `tools/hwtest.js stop` and `mess` (pulses up to 10 s) | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |
| `Switch.SetConfig` | `id`, `config {initial_state, auto_off, auto_off_delay}` | `restart_required` | `bw_install`: `initial_state "off"`, `auto_off` true, `auto_off_delay = tMax + 10` = 190 s with `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> – applies per switch-on command, so it covers every portion | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |
| `Switch.GetStatus` | `id` | `output`, `timer_started_at`, `timer_duration`, `source` | `bw_pump`, `bw_hwpump` (synchronous: is the output ON?), `tools/hwtest.js` (status line, `mess`, `kal`) | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |
| `Switch.GetConfig` | `id` | `initial_state`, `auto_off`, `auto_off_delay`, `auto_on`, `auto_on_delay` | `tools/hwtest.js` (`verifyState`: `auto_off_delay` must be `tMax + 10`) | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |

### Sys, sensors and input

| Call | Parameters | Response | Used by | Docs |
| --- | --- | --- | --- | --- |
| `Sys.GetStatus` | – | `time` (HH:MM local, `null` without NTP), `unixtime` (UTC, `null` without NTP), `ram_free`, `kvs_rev` (counter of all writes), `uptime`, `fs_free` (free flash in bytes) | every script except `bw_zeitraffer` synchronously via `Shelly.getComponentStatus("sys")` (clock, `ram_free` → `err.mem` or `hwr.mem`/`hwp.mem`); `tools/hwtest.js` (`preflight`, safe moment), `put-script.js` (`fs_free` before the upload), `kvs_dump.sh` (`kvs_rev`) | [Sys](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Sys) |
| `Sys.GetConfig` | – | among others `debug.websocket.enable`, `location.tz` | `tools/hwtest.js preflight` (is the debug websocket on?) | [Sys](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Sys) |
| `Voltmeter.GetStatus` | `id` (here 100) | `voltage` (V, `null` on error), `errors[]` | `bw_main`, `bw_pump`, `bw_hwtest` (synchronous); `tools/hwtest.js` (`mess`, `kal`, status line) | [Voltmeter](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Voltmeter) |
| `Temperature.GetStatus` | `id` (here 100) | `tC` (`null` on error), `tF`, `errors[]` | `bw_main`, `bw_hwtest` (synchronous); `tools/hwtest.js` | [Temperature](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Temperature) |
| `Input.GetStatus` | `id` (here 1) | `state` (bool for type `switch`; `null` when the input is disabled – device 12 Sep 2026), `errors[]` | `bw_main`, `bw_pump`, `bw_hwtest`, `bw_hwpump` (synchronous); `tools/hwtest.js` | [Input](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Input) |
| `Input.GetConfig` / `Input.SetConfig` | `id`; `config {enable, type ("switch"), invert}` | the configuration (GetConfig) or `restart_required` (SetConfig) | `tools/hwtest.js preflight` / `input-on` (enable input 1 as type `switch` – the tool's only configuration change, only on request) | [Input](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Input) |

## Limits per docs and measured

| Limit | Per docs | On the device (date) | Consequence in the project |
| --- | --- | --- | --- |
| Schedule | 20 entries, 5 calls per entry; timespec 5, 6 or 7 fields (6 = second minute hour day month weekday) | seconds field not 0, `*` in the minute and a minute list with seconds field accepted (13 Sep 2026) | installer: 3 to 5 entries, `bw_pump` at second 30 |
| KVS | 50 keys, key ≤ 42 characters, value ≤ 253 characters | `KVS.GetMany` returns 11 entries per page, mock 5 (13 Sep 2026) | 9 operating entries plus `hw*`/`zrb*`; `kvs-size.test.js` checks the length; every reader paginates |
| Scripts | at most 3 running at once; per script 5 open `Shelly.call` and 5 timers | – | one open call, one timer per script; operating scripts never run at the same time |
| Script heap | not documented | about 25 KB, shared by all scripts: `mem_free` 24 920 to 25 200 B idle; two large scripts at once → `out_of_memory` (13 Sep 2026) | offset `PUMP_SEC` 30 s, deadline, `K = {}` while waiting, pump test in two passes |
| Stack | not quantified – "more than 2–3 nested anonymous functions" crash | 12 levels run, 14 crash ("Too much recursion"), 12 Sep 2026, FW 2.0.0 | flat `next()` loop; mock limit `MAX_CALL_DEPTH` <!-- fact:call_depth -->10<!-- /fact --> |
| Code size per script | forum: ~15 KB (FW 1.0.3) | FW 2.0.0 stores 19 KB (12 Sep 2026) | `dist/` ≤ <!-- fact:size_limit -->16 000<!-- /fact --> B, `bw_pump` ≤ <!-- fact:size_limit_pump -->18 000<!-- /fact --> B – the limit protects the heap, not the flash |
| Flash (`fs_free`) | – | 57 344 B before the upload; 24 576 B after two test scripts; 12 288 B with seven scripts; 49 152 B without the three test scripts (≈ 36 KB freed); 40 960 B after uploading `bw_pump` 17 475 B – LittleFS counts in 4 KB blocks (13 Sep 2026) | `put-script.js` aborts when `fs_free` + old code < file + 4 096 B |
| Console | – | 20 `print` lines inside one recursion reached neither the web UI nor the debug websocket (12 Sep 2026) | never more than 15 lines synchronously; one line per cycle and per portion (`noBurst()` in `tools/test/helpers.js`, limit 15 lines per timestamp) |
| CPU | – | a 1 s tick with `getComponentStatus` costs 12–17 % (firmware log 13 Sep 2026) | `bw_main` samples 2.5 s per cycle, `bw_pump` only in the window, test scripts only by hand |

## Script API

Docs: [Shelly](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Shelly), [Timer](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Timer), [Language Reference](https://shelly-api-docs.shelly.cloud/gen2/Scripts/LanguageReference).

| Function | Signature | How the scripts use it |
| --- | --- | --- |
| `Shelly.call` | `Shelly.call(method, params, callback, userdata)`; `callback(result, error_code, error_message, userdata)` | asynchronous; `error_code` 0 = ok, `-105` = KVS key missing. At most 5 open calls per script – we always keep only one open: `rpc()` wrapper; in `bw_pump`/`bw_hwtest`/`bw_hwpump` callback and userdata live in module variables and `busy` blocks the tick |
| `Shelly.getComponentStatus` | `Shelly.getComponentStatus(type, id)` → object or `null` | synchronous, recommended by the docs to save callbacks; `type` `"sys"` (without id), `"voltmeter"`, `"temperature"`, `"input"`, `"switch"` |
| `Shelly.getCurrentScriptId` | `→ number` | `Script.Stop` on itself; `bw_hwpump` uses it to count the other running scripts |
| `Shelly.getUptimeMs` | `→ number` | run time: `bw_pump` computes the deadline `B` (seconds since script start against `min(tWin, tick·60 − q − tTail)`), portion duration, soaking and stabilisation from it – never from tick counters (timer jitter); `bw_main` measures `dauer=` (duration) |
| `Timer.set` | `Timer.set(period_ms, repeat, callback, userdata)` → handle | at most 5 per script; we use one: `bw_main` sampling timer `msSample` <!-- def:cfg1.msSample -->500<!-- /def --> ms, `bw_pump` tick timer `msSample`, test scripts `hwt.msTick` <!-- hwt:msTick -->1000<!-- /hwt --> ms, `bw_install` once 400 ms for the retry |
| `Timer.clear` | `Timer.clear(handle)` | allowed inside its own repeating callback; the firmware then reports `Timer 1 handle not found` – harmless (13 Sep 2026) |
| `print` | `print(...)` | console of the web UI and debug websocket; one line per cycle and per portion, `dbg()` only with `DEBUG = 1` |

## Engine facts from the Language Reference and from the device

The rules live in CLAUDE.md; this is where they come from. Each row names the symptom with its date and the place that prevents it today ([18 · Lessons from the device](18-lernlog-geraet.md) has the full story).

| Fact | Evidence | Consequence in the project |
| --- | --- | --- |
| mJS language scope: `var`, `let`, functions, `String`/`Number`/`Array`/`Math`/`JSON`, `Object.keys`, `try/catch/finally`, `throw`; not: hoisting, ES6 classes, promises/async; `const` is not in the list | Language Reference | convention: only `var` and named functions. `syntax.test.js` forbids `const`, arrow functions, template strings, `class`, `for…of`, spread, `Date`, `async`/`await`/`Promise`, anonymous functions, `parseInt`/`parseFloat` and the unknown array methods (not `let`) |
| No hoisting: a function name exists only once execution has passed its declaration; calls inside functions are harmless | `ReferenceError: "stepRead" is not defined` on the first start on the device (12 Sep 2026); the mock (V8) hoists and notices nothing | `var steps = [...]` sits at the very bottom before `next()`; `useBeforeDecl` in `syntax.test.js` checks every module-level line, including multi-line literals; phase tables are built inside a function (`PH = phases()`) |
| More than 2–3 nested anonymous functions crash the device | Language Reference | all callbacks are named top-level functions; the flow is a step chain `steps[]` + `next()` |
| Stack: 12 levels run, 14 crash, each plus the timer frame and `print` | `tools/probe/engine_probe.js` section G (12 Sep 2026); before that `bw_pump` died with ten levels (RPC callback → `next` → `stepCfg` → `next` → `stepCheck` → `finish` → `jumpTo` → `next` → `stepWrite` → `JSON.stringify`) | `next()` is a flat loop: a step returns `true` when it finishes immediately; queue drivers such as `writeNext()` return `true` when nothing is left (`if (writeNext()) next();`); deepest chain today 6. The mock measures the depth at `print`, `Shelly.call`, `Timer.set` and `JSON.*` and reports more than <!-- fact:call_depth -->10<!-- /fact --> levels as an error |
| KVS values are JSON strings | The device stores any JSON value, but the web UI shows object values as `[object Object]` and would write them back like that on save (12 Sep 2026) | write with `JSON.stringify`, read with `fromKvs()` (unreadable → `null`, the installer recreates the entry); the mock reports non-string values as errors; decision 15 |
| Array methods: only `push`, `slice`, `splice`, `indexOf`, `join` are proven | `ABBRUCH: Function "shift" not found!` (abort) in `bw_hwtest` after the first sampling tick (13 Sep 2026) | `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort` are forbidden; ring buffers by index (`ring[i % n]`), sorting with a hand-written insertion loop |
| Code size: FW 2.0.0 stores even 19 KB per script; the heap is the limit, not the flash | `bw_main` 0.1.1: 19 021 of 19 231 B arrived on the device – size was not the problem, the editor was (12 Sep 2026) | compact output from `npm run build`: `dist/` ≤ <!-- fact:size_limit -->16 000<!-- /fact --> B, `bw_pump` ≤ <!-- fact:size_limit_pump -->18 000<!-- /fact --> B (`size.test.js`); today `bw_install` <!-- fact:dist.bw_install -->15 978<!-- /fact -->, `bw_main` <!-- fact:dist.bw_main -->15 791<!-- /fact -->, `bw_pump` <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B |
| The web UI script editor loses text when pasting | 166 B (`bw_install`) and 210 B (`bw_main`) were missing at the end of the file: `SyntaxError: Got EOF expected '}'` (12 Sep 2026) | upload only with `put-script.js` (`Script.PutCode` in chunks), then `verify-scripts.js` byte for byte against `dist/` – also after every paste into the editor |
| Shared script heap of about 25 KB | `out_of_memory` in `Script.GetStatus.errors`: `bw_pump` next to `bw_hwpump` (13 552 B in use) and next to `bw_main` in the same second (13 Sep 2026) | long runners release KVS objects while waiting (`K = {}; orig = {}`) and re-read before writing; a script that starts a second one stops itself; `bw_pump` reads nine keys one by one and releases `K`/`orig` before the window; `bw_pump` starts 30 s after `bw_main` |
| Long loops block the firmware | Language Reference | every step computes for milliseconds only; waiting goes through timers |
| An exception in an asynchronous callback ends the script | Language Reference; `fail()` in every script | every step and every tick runs inside `try/catch`; on error `bw_pump` switches the pump off first (`pumpOffSafe`) |
| The first `Schedule.Create` of a large script is rejected, whatever its content | `Invalid argument 'timespec': Failed validation!` (12 Sep 2026); the same string via curl valid 10/10; the rejection persists even with released KVS objects (13 Sep 2026) | retry in the installer, mock quirk `schedCreateFailFirst`, two tests in `install.test.js`. Lesson: cross-check a firmware "validation failed" via curl first |
| Console: the debug websocket must be on, drops bursts and mixes in firmware lines (`JS RAM stat … used: N` at start) | 12/13 Sep 2026 | `hwtest.js watch` filters the noise, `console.js` does not; connect the console before `Script.Start`, otherwise the first line is missing |

## Example output

A run of `bw_pump` against the mock. The tool's result line shows what this chapter measures: one open RPC, call depth 6 of the allowed <!-- fact:call_depth -->10<!-- /fact -->, only three writes (`w=3`: `st`, `day`, `job` – the single portion writes no claim):

```bash
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":25,"pct":20,"why":"hand","ts":1789192500}'   # single portion: pctOk is missing in the seed band
```

```text
[bw_pump 0.2.0] Fenster: Auftrag 25 s, pct 20, Einzelportion, Frist 420 s
[bw_pump 0.2.0] P1 aus: ok nach 25 s
[bw_pump 0.2.0] ergebnis=ok n=1 sec=25 dur=26 pct=null→null effW=null sf=0.7 day.n=1 err=null w=3 dauer=28340
--- Ergebnis --- beendet=true Dauer=28340 ms, max. offene RPC=1, max. Aufruftiefe=6, Fehler=0
```

(`Fenster: Auftrag` = window: job, `Einzelportion` = single portion, `Frist` = deadline, `P1 aus: ok nach 25 s` = portion 1 off: ok after 25 s, `ergebnis` = result, `dauer` = duration; `Ergebnis … beendet … max. offene RPC … max. Aufruftiefe … Fehler` = result, stopped, max open RPC, max call depth, errors.)

This is what the three engine errors look like on the device – the ones the mock never sees – console of the web UI, 12 and 13 Sep 2026:

```text
Uncaught ReferenceError: "stepRead" is not defined
 at var steps = [stepRead, stepDefaults, stepScripts, stepSchedL...
Uncaught Error: Too much recursion - the stack is about to overflow
 at ...s.length; i++) { if (K[keys[i]] !== undefined && JSON.string...   (stepWrite)
in function "f" called from   try { f(); } catch (e) { fail(e); }         (next)
JS Error [5] out_of_memory used=791 peak=871 total=1746
```

Two KVS responses from the mock after the installer (`KVS.Get st` and `KVS.GetMany`, the second shortened). The shape is the one measured on the device (probe 12 Sep 2026): `value` is a JSON string, `items` an array with `offset` and `total`; the `etag` values are internal to the mock:

```json
{"etag":"cc0d61","value":"{\"state\":\"beob\",\"ts\":null,\"sec\":null,\"pctB\":null,\"pctA\":null,\"rated\":false,\"dryOk\":false}"}
{"items":[{"key":"cfg1","etag":"30060e","value":"{\"vDry\":0.2,\"vWet\":3.13,\"vErrLo\":0.1,…}"},{"key":"cfg2","etag":"138b85","value":"…"}],"offset":0,"total":9}
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ReferenceError: "<name>" is not defined` at start | function name used at module level before its declaration (no hoisting) – or the upload lost the function | move `steps` to the end of the file; `node tools/verify-scripts.js <ip>`; `npm test` (`syntax.test.js`) |
| `Too much recursion - the stack is about to overflow` | call chain deeper than about 10 levels | steps return `true` instead of calling `next()`; check `max. Aufruftiefe` (max call depth) in `run-script.js` |
| `Function "shift" not found!` | array method unknown to mJS | only `push`, `slice`, `splice`, `indexOf`, `join`; ring buffers by index |
| script ends without a console line, `Script.GetStatus.errors` = `out_of_memory` | two large scripts at once in the 25 KB heap | test scripts one at a time, `K = {}` while waiting, `bw_pump` never in the same second as `bw_main`; measure the heap with `hwtest.js scripts` |
| `Schedule.Create '…': Invalid argument 'timespec': Failed validation!` | firmware quirk on the first Create of a run | the installer retries up to 3 times; on a second rejection cross-check the timespec via `curl` |
| `SyntaxError: Got EOF expected '}'` or a function from the middle of the file is missing | pasting into the web editor lost text | `put-script.js` instead of the editor; `verify-scripts.js` after every upload |
| web UI shows `[object Object]` in the KVS | object value instead of a JSON string | delete the entry, run the installer; the scripts write `JSON.stringify` only |
| `KVS.Get` answers `-105` | key missing – normal after deleting `err` | scripts take `null`; `bw_main` recreates state entries |
| `hwtest.js watch`/`console.js` show no console lines | debug websocket off, console connected only after `Script.Start`, or more than 15 lines in a row | web UI → open the console (switches the websocket on), connect `console.js` before the start, one line per step |
| `Input.GetStatus.state` is `null` | input disabled or not of type `switch` | `node tools/hwtest.js <ip> input-on` |
| console: `Timer 1 handle not found`, `PCS write interval < 60s` | `Timer.clear` inside its own callback; the switch writing its counters for portions less than 60 s apart | harmless, no change needed |
| `put-script.js`: `Flash zu voll` (flash too full) | `fs_free` + old code < file + 4 096 B | remove test scripts with `hwtest.js delete`, then upload again |

## Next

- [18 · Lessons from the device](18-lernlog-geraet.md) – every device finding behind this table with symptom, cause, fix and the rule in the tests.
- [14 · Debugging and testing](14-debuggen-und-testen.md) – mock, tests, build, upload and console: the tools that measure the limits.
- [04 · Safety and limits](04-sicherheit-und-grenzen.md) – what the limits mean for pump, water and operation.
