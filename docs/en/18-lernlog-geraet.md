# 18 · Lessons from the device

[Deutsch](../de/18-lernlog-geraet.md) · **English** — [Handbook](README.md) · Part F "Development"

> **At a glance**
> - What the mock does not show and only the Shelly Plus Uni reveals: eleven entries from 12 and 13 Sep 2026, each following the same scheme **Symptom · Cause · Why undetected · Fix · Prevention**. New entries go on top.
> - Every finding ends in something that checks: statically checkable → `syntax.test.js`, behaviour → a replica in the mock, working practice → a hard rule in CLAUDE.md. A sentence in the docs protects nobody; only a test does.
> - The numbers that came out of it: shared script heap of about 25 KB; call depth 12 levels run, 14 crash (mock limit <!-- fact:call_depth -->10<!-- /fact -->); compact build ≤ <!-- fact:size_limit -->16 000<!-- /fact --> B per script, `bw_pump` ≤ <!-- fact:size_limit_pump -->18 000<!-- /fact --> B; `bw_pump` starts 30 s after `bw_main`.
> - Biggest pitfall: taking an error message literally. `Invalid argument 'timespec'`, `Got EOF`, `[object Object]` and `ReferenceError` meant something different on the device than they said – cross-check with curl or a probe script first, then suspect the code.

## Prerequisites

- none – a reading chapter. If you want to measure on the device yourself, you need the console and the tools from [14 · Debugging and testing](14-debuggen-und-testen.md); the measurements behind the entries are in [19 · Device test protocol](19-pruefprotokoll.md), the engine facts with measurement dates in [20 · RPC and engine reference](20-rpc-referenz.md).

## Diagram

[![Data flow: error line from the console or Script.GetStatus, symptom, cross-check via curl or a probe script, cause, fix in a script or tool, then a rule in syntax.test.js, a replica in the mock, a rule in CLAUDE.md and an entry in the lessons log](../diagramme/en/18-lernlog-geraet.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/18-lernlog-geraet.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/18-lernlog-geraet.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "From symptom to cause", 2 "Fix in script or tool", 3 "Where the rule ends up".

## How an entry comes about

The scheme is mandatory because each paragraph answers a different question:

| Paragraph | Question | What must go in |
| --- | --- | --- |
| Symptom | What did the device report? | console line or `Script.GetStatus.errors` verbatim, time, script version, firmware |
| Cause | What is really behind it? | the cross-check (curl, probe script, measurement) that proves the cause – not the first guess |
| Why undetected | Why did mock and tests not show it? | the gap in the mock (no memory model, V8 hoists …) or in the test |
| Fix | What was changed? | script, installer or tool with version; decision number from [17 · Stage and decision log](17-etappen-und-entscheidungslog.md) |
| Prevention | What checks it from now on? | rule in `syntax.test.js`, replica in the mock, hard rule in CLAUDE.md, check in a tool |

When the device surprises you, in this order:

1. Secure the symptom: the console line from `tools/console.js` or `hwtest.js watch`, plus `Script.GetStatus` – `errors` stays until the next run and reveals a silent crash.
2. Cross-check: the same request via curl or from a small probe script ([tools/probe/engine_probe.js](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/probe/engine_probe.js)) before the code is suspected.
3. Reproduce in the mock: write a replica or a static rule, test red, fix, test green (`npm test`).
4. Entry at the top of this chapter, a row in the rules table, decision in chapter 17.
5. Measurements into the test protocol (19), engine facts into the RPC reference (20).

> **Note:** The mock has no memory model and no engine stack limit – it merely measures the call depth at every engine boundary and reports an overrun as an error instead of crashing. Heap peaks (`mem_peak`) exist only on the device: `node tools/hwtest.js <ip> scripts` or the status line of `status`/`watch` (fast-forward only).

## Rules from the findings

| Finding | Rule | Checked by | Date |
| --- | --- | --- | --- |
| Learned value in fast-forward has the wrong dead-time scale | `cfg3.tDead` belongs to the hose: after every rebuild `hwtest.js mess` (CLAUDE.md "Messlauf vor Zeitwert-Änderungen", measurement run before time-value changes); never copy learned values between profiles without taking the dead time along (the no-copy rule lives only here) | `bw_pump` prints `tRise` per portion; `tools/lib/kal.js` converts to "% per s after tRise" (`kal.test.js`) | 13 Sep 2026 |
| Short pulses measure the hose, not the soil | Portions never shorter than the dead time (`tPmin`/`tMin` ≥ `tDead2`/`tDead`); measurement run before any change of the time values | pot model `potModel()` with dead time, ramp, drainage (`potmodel.test.js`, `pump.test.js`) | 13 Sep 2026 |
| `bw_pump` dies next to `bw_main` (`out_of_memory`) | Never start two scripts in the same second: `PUMP_SEC` 30; measure peaks during the run, not `mem_free` when idle | `install.test.js` (schedule `30 0 8,20`), `zeitraffer.test.js` (no window runs into a cycle), overlap guard in the mock | 13 Sep 2026 |
| Test script next to `bw_pump` (`out_of_memory`) | Never two large scripts at once; long runners release `K`/`orig` while waiting; a script that starts a second one ends itself | pump test in two passes (`hwpump.test.js`); the mock runs `Script.Start` as a second script | 13 Sep 2026 |
| `Function "shift" not found!` | Array methods only `push`, `slice`, `splice`, `indexOf`, `join`; ring buffer by index | `syntax.test.js` forbids `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort` | 13 Sep 2026 |
| First `Schedule.Create` per run fails | Never take a firmware "validation failed" literally – cross-check with curl first (rule only here and in the mock quirk, not in CLAUDE.md) | mock `schedCreateFailFirst` (on by default); `install.test.js`: the retry creates all entries, no console line | 12 Sep 2026, addendum 13 Sep |
| Editor loses the end of the file | Upload only with `put-script.js`, then `verify-scripts.js` – after every upload, even via the editor | `put-script.js` compares byte for byte and checks the flash; `verify-scripts.js` is check 2 | 12 Sep 2026 |
| `"evalSamples" is not defined` | Only `dist/` goes to the device; compact build below the size limit | `size.test.js`: ≤ <!-- fact:size_limit -->16 000<!-- /fact --> B, `bw_pump` ≤ <!-- fact:size_limit_pump -->18 000<!-- /fact --> B, `node --check` | 12 Sep 2026 |
| Web UI shows `[object Object]` | KVS values are JSON strings: write with `JSON.stringify`, read with `fromKvs()` | the mock keeps raw values and reports `KVS.Set` with a non-string as an error; the installer replaces unreadable entries | 12 Sep 2026 |
| `Too much recursion` | Flat call chain: `next()` as a loop, steps return `true`, never call `next()` from inside a step | the mock measures the call depth at every engine boundary, limit <!-- fact:call_depth -->10<!-- /fact --> (`run-script.js`: `max. Aufruftiefe`) | 12 Sep 2026 |
| `"stepRead" is not defined` | No hoisting: function names at module level only after their declaration; `steps[]` at the very bottom | `syntax.test.js` `useBeforeDecl` | 12 Sep 2026 |

The rules are spelled out in [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) – except for the two marked in the table, which live only here and in the mock; the checks in [tools/test/syntax.test.js](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/test/syntax.test.js) and [tools/mock/shelly-mock.js](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/mock/shelly-mock.js). The entries follow, newest first.

## 13 Sep 2026 – Learned value in fast-forward has the wrong dead-time scale

**Symptom.** Window 1 of the fast-forward run (15:54:30, dry soil 10.4 %): `P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)` (stabil = stable), `P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)` (unstabil = unstable), `ergebnis=unstab n=2 sec=22 effW=2.006` (ergebnis = result). The control loop works – first portion, measurement, correction portion, target 50 reached – but `effW` 2.0 %/s is the gain per *profile* second.

**Cause.** `effW` is defined as "% per effective second", effective = `sec − tDead` of the running profile. The fast-forward profile calculates with `tDead` <!-- zr:cfg3.tDead -->2<!-- /zr --> s and `tDead2` <!-- zr:cfg4.tDead2 -->0<!-- /zr --> s, but the water arrived after 8 and 5 s. Real: 40.1 % in (12 − 8) + (10 − 5) = 9 s → 4.46 %/s. With `kal write` in the profile scale, normal operation (`tDead` <!-- def:cfg3.tDead -->20<!-- /def --> s) would have computed the dose from 2.0 instead of 4.5 – portions far too large.

If the profile does not match the hose, the error migrates into the learned value. In fast-forward the small dead time is intended (so that learning happens at all); when carrying it over into normal operation it is not.

**Why undetected.** The pot model in the mock uses the same dead times as the profile – profile and "hose" always agree there.

**Fix.** `bw_pump` prints `tRise` (the real dead time) per portion in the console; the recorder of `hwtest.js kal` captures these lines; [tools/lib/kal.js](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/lib/kal.js) converts the learned value to the scale "% per second after tRise" and proposes `cfg3.tDead` (median of the `tRise` of the first portions) and `cfg4.tDead2` (median of the follow-up portions). Without console lines it stays in the profile scale with a warning; `kal report <json> <log>` pulls the lines from a log file. Decision 56.

On the device (16:06): `kal write` wrote `lrn.effW null → 4.46`, `cfg4.tDead2 8 → 5`, `cfg3.tDead 20 → 8` and `cfg3.tMin 25 → 10` (max(`tPmin`, `tDead` + 2)).

**Prevention.** `cfg3.tDead` belongs to the hose, not to the script: after every rebuild `hwtest.js mess` (yields `tRise`) and check the dose start values. Never copy learned values between profiles without taking the dead time along. `kal.test.js` checks the conversion without a device.

## 13 Sep 2026 – Measurement run: short pulses measure the hose, not the soil

**Symptom.** Three pulses of 3 s (`hwtest.js mess 3 3`, sensor under two drippers, soil 10 %): pulse 1 no reaction; pulses 2 and 3 raise the moisture by 9.5 and 11.7 %, but the value keeps rising for 80–90 s (peak only at 86 and 80 s). At 34 % moisture, 3-s pulses bring only +1–2 % over four minutes. A 10-s pulse at 37.5 %: rise from 7.9 s (pump still running), peak 49.1 % five seconds after switch-off, then stable for two minutes – no creeping.

**Cause.** With 3-s pulses most of the water goes into refilling the hose (dead time on the test rig 5–8 s, in real operation 10–20 s according to the user); the creeping afterwards is trailing water dripping from the hose onto the sensor for minutes. A pulse longer than the dead time gives a fast, clean answer: the water front reaches the sensor while pumping, the resting value stands about 5 s after switch-off.

**Why undetected.** Until then the mock had no time model (effect immediately at switch-off); the fast-forward profiles with 5-s portions looked plausible in the mock.

**Fix.** Control-loop start values from the measurement run: correction portion at least `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> s (longer than the dead time), first portion `tMin` <!-- def:cfg3.tMin -->25<!-- /def --> s, `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s, `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s, `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s.

Stability with a trend clause: span of the last `nStab` <!-- def:cfg4.nStab -->4<!-- /def --> values ≤ `dStab` <!-- def:cfg4.dStab -->1<!-- /def --> % **and** rise ≤ `dStab`/2 over (`nStab` − 1) · `tStep` = 15 s. Gain on the device 5–6 % per effective second at 37 % (`effMax` <!-- def:cfg2.effMax -->30<!-- /def --> as a sanity limit).

Also: fast-forward portions at least 10 s instead of 5 s, and the pot model in the mock (`potModel()` in `tools/test/helpers.js`) calculates with dead time, ramp and drainage. Decision 56 (measurement run as a tool).

**Prevention.** Portions never shorter than the dead time; repeat `hwtest.js mess` before every change of the time values (raw data in `docs/kal/`); observe the trailing water for at least 240 s. The pulse table is in the test protocol ([19 · Device test protocol](19-pruefprotokoll.md)).

## 13 Sep 2026 – bw_pump dies next to bw_main with out_of_memory as soon as both start on the full minute

**Symptom.** In the morning's fast-forward run (`bw_zeitraffer` 0.1.0, `bw_install` 0.1.2, `bw_main` 0.1.2, `bw_pump` 0.1.1; schedule `0 * * * * *` for `bw_main`, `0 */2 * * * *` for `bw_pump`) `Script.GetStatus` of `bw_pump` reports `out_of_memory` in every even minute; console: `JS Error [5] out_of_memory used=791 peak=871 total=1746`. No portion. `bw_main` v0.1.2 alone: `mem_used` 13 216, `mem_peak` 16 380 (14 KVS entries, code 15.3 KB), `mem_free` at least 11 536; runtime 5–7.5 s.

**Cause.** The script heap (about 25 KB) is shared. While reading, `bw_main` holds all KVS entries twice – objects in `K`, JSON strings in `orig` – and thus needs over 16 KB at its peak; for `bw_pump`, starting in the same second, 1.7 KB remain. In the morning of the same day the pair still ran at 08:00 because `bw_main` was smaller and fewer entries were stored – the margin had simply never been measured.

**Why undetected.** The mock has no memory model and executes schedule entries one after the other; the earlier measurement ("~7.4 KB each", entry below) referred to a different moment in the run, not the peak.

**Fix.** The installer sets the seconds field of the pump schedule to `PUMP_SEC` 30: `30 0 8,20 * * *`, in fast-forward back then `30 */2 * * * *` with safety-off `45 */2`, today `30 */6 * * * *`. `bw_pump` starts 30 s after `bw_main`, which has long finished by then. `hwtest.js` checks the schedule afterwards; in fast-forward the status line of `watch` shows `mem_used`/`mem_peak` and `errors` of both scripts. The device accepts timespecs with a seconds field ≠ 0 and `*` in the minute (checked via RPC without retry). Decision 37.

Round 2 (11:13–11:31): four portions, `bw_pump` alone `mem_used` ≤ 11 970, `bw_main` unchanged 13 216/16 380, no error; restore byte-identical.

**Prevention.** Never start two scripts in the same second; measure peak values with `Script.GetStatus` during the run (`hwtest.js watch`), not just `mem_free` when idle. When `bw_main` or the KVS entries grow, measure the heap first. Since stage 10, "window end + `tTail` before the next cycle" is enforced three times: installer (static), `bw_pump` (deadline), mock (overlap guard).

Side findings: flash `fs_free` after uploading the six scripts 12 288 bytes (before 24 576; with `engine_probe` there were seven scripts on the device) – delete `engine_probe` before another script. After every `bw_main` run the console reports `shelly_ejs_timer.cpp:44 Timer 1 handle not found` (`Timer.clear` on the sampling timer) – without consequences.

## 13 Sep 2026 – Hardware test: bw_pump dies next to the test script – the script heap is shared

**Symptom.** `bw_hwpump` (test script, compact 14.9 KB at the time) starts `bw_pump` via `Script.Start`; `bw_pump` ends immediately without a single console line, `Script.GetStatus` shows `"errors":["out_of_memory"]`. While the sensor test was running, `bw_main` died the same way in its 15-min cycle. After a first memory diet `bw_pump` started and pumped for 30 s, but then died at the second KVS read – `st/day/job` were never written.

**Cause.** All scripts share a heap of about 25 KB; when idle, `Script.GetStatus` reports the same `mem_free: 24920` for every script. Measured:

- `bw_hwpump` occupied 13 552 bytes (peak 15 400) because it held all KVS entries as objects plus `orig` strings for the whole waiting time; for `bw_pump` (7 396 at parse time) 11 354 remained – too little.
- Without `K`/`orig` during the waiting phases: `bw_hwpump` 9 044, `bw_hwtest` 9 576. With that, `bw_main` (5 404 at parse time) and `bw_pump` start next to them.
- When re-reading 13 KVS entries (with the test entries `hwt`, `hwr`, `hwp`, `hwb1`, `hwb2`), `bw_pump` needs over 15.8 KB at its peak – next to a 9-KB script `out_of_memory` again.
- `bw_main` + `bw_pump` at the same time (normal operation at 08:00/20:00) still ran that morning (~7.4 KB each; `bw_main` finishes after 4 s, before `bw_pump` reaches its peak) – the entry above shows how tight that was.

**Why undetected.** The mock has no memory model; until then only one script ever ran, and the operating scripts finish within seconds. A long runner next to a second script was a new pattern.

**Fix.** (1) Both test scripts set `K = {}; orig = {};` as soon as they wait; the state is re-read before writing. (2) The pump test runs in two passes: A prepares the job, starts `bw_pump` and ends itself; `bw_pump` pumps alone; B (recognisable by the backup `hwb1`/`hwb2`) evaluates, restores and reports. `hwtest.js watch` starts B automatically. Decision 28.

**Prevention.** Rule in CLAUDE.md: never run two large scripts at the same time; long runners release KVS objects while waiting; consider `mem_free` before a `Script.Start` from within a script. `hwtest.js scripts` shows size, `running` and `mem_peak` of all scripts, `preflight` only the running ones (plus `ram_free`/`fs_free`); the status line of `status`/`watch` shows `mem_used`/`mem_peak` only in fast-forward; `Script.GetStatus.errors` stays until the next run and reveals the crash. There is no memory model in the mock – the numbers above are the reference.

Replica in the mock: `Script.Start` runs a registered file as a second script, and callbacks of a finished run never hit a restart of the same script (run generation) – otherwise pass B would die in the mock from a `Script.Stop` callback of pass A. Decision 27.

## 13 Sep 2026 – Function "shift" not found!: mJS does not know Array.prototype.shift

**Symptom.** `bw_hwtest` aborts on the device after the first sampling tick: `ABBRUCH: Function "shift" not found!` (ABBRUCH = abort) – in the mock the same ring buffer (`push` + `shift`) ran without error.

**Cause.** The Shelly engine implements only part of the array methods: `push`, `slice`, `splice`, `indexOf`, `join` are confirmed; `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort` count as absent.

**Why undetected.** V8 in the mock knows all methods; `syntax.test.js` checked language constructs, not method names.

**Fix.** Ring buffer by index (`ring[i % n] = v`, read via `(i − 1 − k) % n`), no array methods except `push`.

**Prevention.** New rule in `syntax.test.js`: the listed method names are forbidden in `scripts/*.js`; the same list is a hard rule in CLAUDE.md.

## 12 Sep 2026 – Installer: the first Schedule.Create per run fails with a false "timespec" error

**Symptom.** The installer does not create the cycle: `Schedule.Create '0 */15 * * * *': Invalid argument 'timespec': Failed validation!`. The two following creates of the same run (window, safety-off) succeed.

**Cause.** It is **not** the timespec: via curl and from a small probe script exactly the same string is accepted reliably (10/10); the explicit form `0 0,15,30,45 * * * *` fails in the installer just the same. Ruled out by probe: timespec syntax, call structure (byte-identical), create inside the delete callback, deleting persisted schedules, the full installer prelude (read KVS + `Script.List`).

The only reproducible fact: the **first** `Schedule.Create` of a run of the large installer script fails, regardless of its content. The failed attempt frees something itself (presumably engine heap), because the next create succeeds immediately without a pause. A small script never triggers it – it depends on the memory and state profile of the large script.

**Why undetected.** The mock always created schedules on the first attempt.

**Fix.** `onCreate` repeats a failed `Schedule.Create` up to `CRETRY_MAX` = 3 times after `CRETRY_MS` = 400 ms (`sendCreate` via `Timer.set`). The first attempt fails, the second succeeds; all entries are created (verified on the device through the SSH tunnel). Decision 20.

**Prevention.** The mock replicates the quirk (`schedCreateFailFirst`, on by default): the first `Schedule.Create` per script run fails with the same message. Two tests in `install.test.js` check that the retry creates all entries (four create calls for three entries) and that without the quirk three calls suffice.

> **Note:** Addendum 13 Sep 2026 – during the manual test the message was read as an error again. Cross-check: `bw_install` v0.1.2 releases the KVS objects before `Script.List` and the schedule steps (`K = {}`, only `idSw` and `cfg3` remain) – the first rejection came anyway (12:15:08). So it is not a KVS heap problem but depends on the script itself (size, engine state).

> **Note:** Consequence: the installer repeats the first rejection silently (`dbg`); only a second one appears as `Hinweis: Schedule.Create '…' abgelehnt …` (Hinweis = note, abgelehnt = rejected); `install.test.js` checks that the console contains no `Schedule.Create` line in the normal case. Principle confirmed: a firmware "validation failed" must not always be taken literally – cross-check with curl or a probe whether the request is really invalid.

## 12 Sep 2026 – The script editor loses the end of the file when pasting

**Symptom.** After pasting `scripts/bw_install.js` (12 131 bytes) the device reports `Uncaught SyntaxError: Got EOF expected '}' at function stepDone()`. `Script.GetCode?id=<id>&len=1` → `left: 11964`, i.e. 11 965 bytes on the device: **166 bytes are missing**, exactly the end of the file (rest of `stepDone`, step list, `next()`). `bw_main`: 19 021 instead of 19 231 bytes (210 missing). `bw_pump`: complete. Firmware 2.0.0 – it is not the memory limit, 19 KB were stored.

**Cause.** The transfer clipboard → editor → `Script.PutCode` is not lossless; where exactly cannot be determined (no error visible in the UI). The effect is the same as with the `evalSamples` error (next entry).

**Why undetected.** A script with a missing end parses to the end and reports `Got EOF` only at start; a script with a missing middle starts and dies at the first call of the missing function. Both look like a code error.

**Fix.** [tools/put-script.js](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/put-script.js) `<ip> <id> <file>`: upload via `Script.PutCode` in chunks of 1 024 characters (characters, not bytes – no UTF-8 character gets cut), then comparison with the code on the device, exit code ≠ 0 on any deviation.

Since v0.1.1 (stage 9) it loads the code back completely and compares byte for byte instead of only the length; since v<!-- fact:ver.put-script -->0.1.2<!-- /fact --> (stage 10) it checks the flash beforehand (`fs_free` + old code ≥ new file + 4 096 B). `tools/verify-scripts.js <ip>` (check 2) compares all scripts on the device with `dist/`. Decision 19.

**Prevention.** After **every** upload check the bytes – even after an upload via the editor. A `ReferenceError` or `Got EOF` on the device means "check the upload" first, and only then "check the code".

## 12 Sep 2026 – bw_main v0.1.1: ReferenceError "evalSamples" is not defined

**Symptom.** After the rebuild to the flat step chain, `bw_main` aborts in the timer callback `onSample` because `evalSamples` – a function from the middle of the file (byte 10 700 of 18 879) – does not exist. The same path ran through with v0.1.0 half an hour earlier; `bw_install` (12 KB) and `bw_pump` (12 KB) run.

**Cause.** Loss during the transfer into the editor (entry above, confirmed via `Script.GetCode`). The memory limit of ~15 KB mentioned in the forum (FW 1.0.3) no longer applies on firmware 2.0.0 – 19 KB were stored. A missing piece takes exactly the functions that were in it; the rest keeps parsing.

**Why undetected.** The mock reads the file directly; a size limit was replicated nowhere.

**Fix.** `npm run build` writes `dist/` – comments, indentation and blank lines removed, the version line is kept (since stage 9 also the `//!` device docs, decision 35); `bw_main.js` at the time 19.2 KB → 13.8 KB. Only `dist/` goes to the device; `scripts/` remains the source. Decision 17.

**Prevention.** `size.test.js` keeps every compact build below the limit and checks it with `node --check`. Back then that was 15 000 bytes; since stage 9 it is <!-- fact:size_limit -->16 000<!-- /fact --> B, since stage 10 for `bw_pump` <!-- fact:size_limit_pump -->18 000<!-- /fact --> B (today `bw_main` <!-- fact:dist.bw_main -->15 791<!-- /fact --> B, `bw_pump` <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B). After every upload `verify-scripts.js`; by hand it worked back then with `Script.GetCode?id=<id>&len=1` → `left + 1` must equal the file size.

## 12 Sep 2026 – Web UI shows KVS values as [object Object]

**Symptom.** Settings → Key-Value Storage shows `[object Object]`, length 15, for all eight entries of v0.1.0; the edit dialog likewise. First impression: the installer wrote garbage.

**Cause.** A false impression – the device stores objects correctly: `KVS.Get lrn` in the probe returns `"value":{"eff":null,"sf":1,…}` (field names of v0.1.0), and `bw_main` reads `cfg1.idV` successfully. But the web UI is built for string values only: it shows `String(value)` and would write the text `[object Object]` back when saving. Because `cfg2` (target band) is maintained by hand in the KVS, this is a real defect, not a cosmetic one.

**Why undetected.** The mock stored objects as JSON and returned them as objects – convenient, but the web UI did not appear in it. The KVS docs ("any valid JSON value") are correct and still not the whole truth.

**Fix.** KVS values are JSON strings: `JSON.stringify` when writing, `fromKvs()` when reading (unreadable → `null`; the installer replaces such entries with start values and reports it). This matches the project lead's reference script (Spotelly: `setKVS` → `JSON.stringify`, `getKVS` → `JSON.parse`). Once on the device: delete the eight v0.1.0 entries, start the installer. In the web UI the strings are readable with "Format as JSON".

**Prevention.** The mock keeps raw values like the device (`KVS.Get`/`KVS.GetMany` return the string) and reports every `KVS.Set` with a non-string value as an error (`Wert ist object, kein String – JSON.stringify verwenden`, i.e. value is object, not string – use JSON.stringify). Decisions 15 and 16.

## 12 Sep 2026 – bw_pump dies: Too much recursion – the stack is about to overflow

**Symptom.** After the hoisting fix the installer runs through, `bw_main` too, but `bw_pump` aborts:

```text
Uncaught Error: Too much recursion - the stack is about to overflow
 at ...s.length; i++) { if (K[keys[i]] !== undefined && JSON.string...   (stepWrite)
in function "f" called from   try { f(); } catch (e) { fail(e); }         (next)
in function "next" called from ... { si = i; break; } } next();           (jumpTo)
in function "jumpTo" called from out.why = why; jumpTo(stepWrite);        (finish)
```

**Cause.** The step chain was nested: every synchronously finished step called `next()`, which called the next step, which called `next()` again … Without a job `bw_pump` ran like this: RPC callback → `next` → `stepCfg` → `next` → `stepCheck` → `finish` → `jumpTo` → `next` → `stepWrite` → `JSON.stringify` – ten levels. mJS has a very small stack: measured, 12 levels run and 14 crash, each plus a timer frame and `print` – about 13–15 levels in total. `bw_main` just made it through with nine levels.

**Why undetected.** V8 recurses tens of thousands of levels deep; the mock had no notion of a stack limit. The Shelly docs do not name the limit – only "more than 2–3 nested anonymous functions crash the device", which describes the same problem from the other side.

**Fix.** `next()` is now a flat loop: a step returns `true` when it is finished immediately, and the loop calls the next one; asynchronous steps return nothing, their callback calls `next()` from a fresh stack. `jumpTo` only sets the target, `finish`/`abortErr` return `true` (`return abortErr(...)` in a step, `abortErr(...); next(); return;` in a callback). Queue drivers (`writeNext`, `delNext`, `createNext`, `scNext`) return `true` when nothing is pending; callbacks write `if (writeNext()) next();`. Deepest chain afterwards: 4.

**Prevention.**

- The mock measures the script's call depth at every engine boundary (`print`, `Shelly.call`, `Timer.set`, `JSON.*`) via `Error().stack` and reports more than `MAX_CALL_DEPTH` levels as an error – first 8, after the measurement on the device <!-- fact:call_depth -->10<!-- /fact -->. With the old scripts this fired in 16 tests (depth 9–11), with the new ones in none. `tools/run-script.js` shows `max. Aufruftiefe` (max. call depth) in its result (15 Sep 2026 in the mock: `bw_main` 5, `bw_pump` 6, `bw_install` 6).
- Rule in CLAUDE.md ("flat call chain"), decision 14, engine fact in [20 · RPC and engine reference](20-rpc-referenz.md).
- `tools/probe/engine_probe.js` measured the limit on the device (section G of an earlier version; the checked-in v0.1.5 contains only the `Schedule.Create` probe). The first measurement failed at the log transport: 20 `print` lines in one recursion arrived neither in the web UI nor in the debug websocket (buffer overflows) – so the measurement was done in timer ticks, one depth per tick.

## 12 Sep 2026 – Scripts do not start: ReferenceError "stepRead" is not defined

**Symptom.** The first start of `bw_install.js` on the device (web UI, script editor) aborts immediately:

```text
Uncaught ReferenceError: "stepRead" is not defined
 at var steps = [stepRead, stepDefaults, stepScripts, stepSchedL...
```

`bw_main.js` and `bw_pump.js` would have reacted the same way at their first scheduled start – the same pattern in all three files.

**Cause.** The Shelly script engine (mJS) does not hoist function declarations. A name like `stepRead` exists only once execution has passed `function stepRead() {…}`. The step list `var steps = [stepRead, …]` sat in the variable block at the top of the file; the functions only came from line 90 on. Calls *inside* functions (such as `next()` → `steps[si]()`) are harmless because they are resolved at run time.

**Why undetected.** Three reasons at once:

1. The mock runs the scripts with Node `vm.runInNewContext` – V8 hoists, so everything ran there.
2. `syntax.test.js` only checked forbidden constructs (`const`, `=>`, template strings …), not the order.
3. The knowledge was there – the RPC notes had listed "not supported: hoisting" since stage 0 – but was never translated into a rule. A sentence in the docs protects nobody; only a test does.

**Fix.** `var steps = [...]` moved to the end of the file in all three scripts, directly before the closing `next();`. Scripts to v0.1.1. No change to the logic.

**Prevention.** New rule in `syntax.test.js` (`useBeforeDecl`): code outside function bodies (back then only brace depth 0, since stage 8 also multi-line literals at module level) that names a function declared only later fails – with the line numbers of both places. Red for all three scripts before the fix, green afterwards. Rule in CLAUDE.md ("hard rules"), decision 13.

General lesson: **every statement of the Shelly docs that the mock does not replicate belongs in the repo as a static test, not just as a note.** And: start new scripts once by hand on the device before scheduled operation.

## Small lessons without their own entry

Side findings of the probe (12 Sep 2026), of the hardware test and of the first stage-10 run (13 Sep 2026). The measurements are in [19 · Device test protocol](19-pruefprotokoll.md), the RPC details in [20 · RPC and engine reference](20-rpc-referenz.md).

| Finding | Consequence |
| --- | --- |
| `KVS.GetMany` returns 11 entries per page on the device (mock: 5) – reading only the first page misses entries (`st` seemed to be missing) | scripts, `tools/kvs_dump.sh` and `hwtest.js` paginate; `install.test.js` reads with page size 2 |
| `KVS.GetMany` returns `items` as an **array** `[{key, etag, value}]` plus `offset`, `total` (docs: object) | the mock answers like the device |
| `KVS.Set` with an RPC object (changed in place), a literal with `null`, a JSON copy and a string: all `ec=0` | no engine restriction – the string rule is a web UI matter |
| `KVS.Set lrn: Missing required argument 'key'!` from v0.1.0 not reproducible; it only occurred in the deep call chain | keep watching |
| Debug websocket: besides the `print` lines there are firmware lines (`shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`, `y_notifications.cpp`, `shelly_debug.cpp`, `shelly_script.cpp`) and at start `JS RAM stat … used: N` (heap after parsing; numbers per script in 19) | `hwtest.js watch` filters the noise, `console.js` does not; the console must be connected before `Script.Start`, otherwise the first line is missing |
| Log transport: 20 `print` lines in one recursion arrived nowhere; one console line per 5 s arrives completely | one line per cycle or per portion; rule "console burst" ≤ 15 lines (CLAUDE.md, interview decision 7); `noBurst()` in `tools/test/helpers.js` checks it in `pump.test.js`/`potmodel.test.js` |
| A 1-s tick with `getComponentStatus` costs 12–17 % CPU according to the firmware log | the test scripts tick like that (`msTick` 1 000 ms, long runners); `bw_pump` 0.2.0 ticks in the window every `msSample` <!-- def:cfg1.msSample -->500<!-- /def --> ms (switch and water level every `tChk`), bounded by the deadline ≤ `tWin`; `bw_main` only for the `nSample` readings per cycle |
| Flash: LittleFS counts in 4-KB blocks; the three test scripts `engine_probe`, `bw_hwtest`, `bw_hwpump` cost about 36 KB (`fs_free` series in 19) | `put-script.js` checks `fs_free` + old code ≥ new file + 4 096 B; make room with `hwtest.js scripts` and `delete` |
| Firmware notices without consequences: `shelly_ejs_timer.cpp:44 Timer 1 handle not found` (`Timer.clear` of the script's own repeating timer from inside its callback), `persistent_counters.cpp:585 PCS write interval < 60s` (counter write of the switch for portions less than 60 s apart) | no action |
| Heap in the window (stage 10): the peak of `bw_pump` 0.2.0 stays well below the free heap, and the parse of `bw_main` never adds to it thanks to the deadline (measurements in 19) | the exception of <!-- fact:size_limit_pump -->18 000<!-- /fact --> B for `bw_pump` in `tools/build.js` is covered |
| FW 2.0.0 accepts the minute list with a seconds field `40 2,8,14,20,26,32,38,44,50,56 * * * *` (safety-off of the fast-forward run) | the installer builds it from `winEvery` and `tWin` |

## Example output

The error lines as they appeared on the device – each led to an entry above:

| Line on the device | Date | What it really meant |
| --- | --- | --- |
| `Uncaught ReferenceError: "stepRead" is not defined` | 12 Sep 2026 | no hoisting – `steps[]` came before the functions |
| `Uncaught Error: Too much recursion - the stack is about to overflow` | 12 Sep 2026 | nested step chain, ten levels |
| `ReferenceError: "evalSamples" is not defined` | 12 Sep 2026 | the editor lost a piece from the middle of the file – the function at byte 10 700 of 18 879 was missing (confirmed via `Script.GetCode`) |
| `Uncaught SyntaxError: Got EOF expected '}' at function stepDone()` | 12 Sep 2026 | the editor lost 166 bytes at the end of the file (`bw_main`: 210 bytes, 19 231 → 19 021) |
| `Schedule.Create '0 */15 * * * *': Invalid argument 'timespec': Failed validation!` | 12 Sep 2026 | the timespec was valid – the first create per run fails |
| `ABBRUCH: Function "shift" not found!` | 13 Sep 2026 | mJS without `Array.prototype.shift` |
| `"errors":["out_of_memory"]` in `Script.GetStatus` | 13 Sep 2026 | the test script held 13.5 KB of the shared heap |
| `JS Error [5] out_of_memory used=791 peak=871 total=1746` | 13 Sep 2026 | `bw_pump` started in the same second as `bw_main` |

What the mock has checked since – result lines of `node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":25,"pct":20,"why":"hand","ts":1789192500}'` (15 Sep 2026; Fenster = window, Auftrag = job, Einzelportion = single portion, Frist = deadline, P1 aus = P1 off, Ergebnis = result, Dauer = duration, max. offene RPC = max. open RPC calls, max. Aufruftiefe = max. call depth, Fehler = errors):

```text
[bw_pump 0.2.0] Fenster: Auftrag 25 s, pct 20, Einzelportion, Frist 420 s
[bw_pump 0.2.0] P1 aus: ok nach 25 s
[bw_pump 0.2.0] ergebnis=ok n=1 sec=25 dur=26 pct=null→null effW=null sf=0.7 day.n=1 err=null w=3 dauer=28340
--- Ergebnis --- beendet=true Dauer=28340 ms, max. offene RPC=1, max. Aufruftiefe=6, Fehler=0
```

`max. Aufruftiefe=6` is below the limit <!-- fact:call_depth -->10<!-- /fact -->; `Fehler=0` means: no uncaught error in the script, no `KVS.Set` with a non-string, no call depth above the limit, never more than 5 open RPC calls and never more than 5 timers; `beendet=true` is the `Script.Stop`. The overlap of two runs (and a run without `Script.Stop`) is reported only by `simulate()` in the tests.

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| The entry describes the fix, but nothing checks it | prevention is missing or is only a sentence in the docs | rule in `syntax.test.js` (static), replica in the mock (behaviour) or hard rule in CLAUDE.md – without a test the entry is incomplete |
| Symptom without version, time and console line | written from memory | take the line verbatim from the `console.js` or `watch` log, plus `Script.GetStatus.errors`, script version, date |
| The cause is a guess | no cross-check | reproduce via curl or a probe script – on 12 Sep 2026 "timespec validation" was no timespec error and `[object Object]` no installer error |
| The same error shows up again although it is in the log | the mock still does not show it: V8 hoists, knows all array methods and has neither a stack nor a memory limit | the rule must be enforced by a static test or the mock; there is no model for the heap – measure on the device (`hwtest.js scripts`, in fast-forward `watch`) |
| A number in the entry contradicts code or protocol | old state (size limit 15 000 bytes, mock depth 8) | use fact markers (`fact:size_limit`, `fact:call_depth`); `node tools/check-docs.js` checks them against the scripts |
| Entry appended at the bottom, measurements in the prose | convention forgotten | new entries at the top, a row in the rules table; measurements to 19, engine facts to 20, decision to 17 |

## Next

- [19 · Device test protocol](19-pruefprotokoll.md) – the measurements behind the entries: heap, flash, calibration, pulses, window 1.
- [20 · RPC and engine reference](20-rpc-referenz.md) – every RPC in use and the engine facts with measurement dates.
- [17 · Stage and decision log](17-etappen-und-entscheidungslog.md) – decisions 13, 14, 15, 16, 17, 19, 20, 27, 28, 37 and 56 that grew out of these findings.
- [14 · Debugging and testing](14-debuggen-und-testen.md) – console, mock and tools with which the next finding is secured.
