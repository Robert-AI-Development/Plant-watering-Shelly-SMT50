# 15 · Extending the controller with Claude Code

[Deutsch](../de/15-ausbau-mit-claude-code.md) · **English** — [Handbook](README.md) · Part E "Extend"

> **At a glance**
> - Outcome: an extension (a new cfg field, a new rule, a new tool) runs in the mock, runs on the device and is documented – in seven steps: plan, interview, acceptance criteria, debug environment, coding, verification, docs and commit.
> - Scope: seven steps, four check commands (`npm test`, `npm run check`, `npm run build`, `npm run docs:check`) and one device run that goes into the test protocol.
> - Key number: `bw_main` uses <!-- fact:dist.bw_main -->15 791<!-- /fact --> of <!-- fact:size_limit -->16 000<!-- /fact --> bytes, `bw_install` <!-- fact:dist.bw_install -->15 978<!-- /fact --> – every new line costs reserve, measure before coding.
> - Biggest pitfall: tests green, device red. The mock does not show hoisting or missing array methods (only `syntax.test.js` and the device do), and only the device shows the shared heap – so mock and tests first, then a device run, and every surprise goes into the lessons log and becomes a rule in the tests.
> - Commit and push only with the human's explicit consent.

## Prerequisites

- Claude Code runs in the repo: set up as in [10 · Installation with Claude Code](10-installation-claude-code.md); the device is reachable as `<ip>` on the LAN ([08 · Installation with a local server](08-installation-lokaler-server.md)) or through the tunnel `127.0.0.1:8010` ([09 · Installation with a VPS](09-installation-vps.md)).
- Node ≥ 20 for tests and build, Node ≥ 22 for `tools/console.js` and `tools/hwtest.js`; the project has no dependencies.
- [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) (hard rules, working method) and [AGENTS.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/AGENTS.md) (consent rule, definition of done) read – Claude Code reads CLAUDE.md itself at start-up, AGENTS.md applies to every agent.
- `npm test` is green before the change (<!-- fact:tests -->146<!-- /fact --> tests, 13 Sep 2026).
- Optional: the code index graft. `graft ask "…" --source`, `graft skeleton <file>` and `graft callers <symbol>` return the relevant spots without reading whole files; without graft Claude reads the files directly.

## Diagram

[![Extending with Claude Code: idea, plan, interview, acceptance criteria, debug environment, coding, verification, device run, docs, approval, commit](../diagramme/en/15-ausbau-mit-claude-code.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/15-ausbau-mit-claude-code.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/15-ausbau-mit-claude-code.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "From plan to criteria", 2 "Build and verify", 3 "Docs and approval".

## The seven steps

| Step | Who | Outcome | Evidence |
| --- | --- | --- | --- |
| 1 Plan | Claude in plan mode, the human approves | goal, affected scripts, size reserve, docs to touch | plan in the session |
| 2 Interview | Claude asks, the human decides | every open question answered (target band, start value, fast-forward, code, reader) | answers → decision table |
| 3 Acceptance criteria | Claude proposes, the human confirms | test case, limits, console line, device criterion – before the first line of code | list in the session |
| 4 Debug environment | Claude | mock runs, tunnel up, flash and time window checked | `run-script.js`, `preflight` |
| 5 Coding | Claude | code by the hard rules, `//!` docs, field in `DEF` and `ZR3`/`ZR4` | diff |
| 6 Verification | Claude, then the device | `npm test`, `check`, `build`, `docs:check` green; upload byte-identical; device run recorded | console, test protocol |
| 7 Docs and commit | Claude writes, the human approves | chapters 03, 13, 17, 18, 20 updated; branch, commit, pull request | `git log` |

The steps apply to every kind of extension. A new tool in `tools/` skips only the device rules of step 5; a new cfg field goes through all seven.

## Step 1: plan in plan mode

Claude Code plans first in plan mode and changes nothing before you approve. A usable plan names four things:

1. the goal in one sentence – what the device will do differently;
2. the affected scripts: `bw_main` (cycle, release chain, dose), `bw_pump` (window control loop), `bw_install` (start values, schedule), `bw_zeitraffer` (fast-forward profile), plus tests and tools;
3. the docs to touch: [03 · Configuration](03-konfiguration.md) for fields, [13 · Operation and maintenance](13-betrieb-und-wartung.md) for codes, [17 · Decision log](17-etappen-und-entscheidungslog.md) for the rationale;
4. the size reserve of the compact output.

| Script | Compact (`npm run build`) | Limit |
| --- | --- | --- |
| `bw_install` | <!-- fact:dist.bw_install -->15 978<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_main` | <!-- fact:dist.bw_main -->15 791<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_pump` | <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B | <!-- fact:size_limit_pump -->18 000<!-- /fact --> B (exception: thanks to the deadline it never runs next to `bw_main`) |
| `bw_hwtest` | <!-- fact:dist.bw_hwtest -->13 952<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_hwpump` | <!-- fact:dist.bw_hwpump -->14 500<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_zeitraffer` | <!-- fact:dist.bw_zeitraffer -->7 459<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |

`bw_install` is practically full: the gap to the limit is shorter than one `//!` line. Whoever adds a field there must shorten something else. According to CLAUDE.md, `bw_main` and `bw_hwpump` are also due for splitting or trimming.

> **Note:** The limit protects the shared script heap (~25 KB). If `bw_pump` grows, the device measurement applies as well: `mem_peak` of `bw_pump` plus 5 348 bytes of parse for `bw_main` below 25 000 (13 Sep 2026: 12 516 + 5 348, read with `hwtest.js watch`).

## Step 2: "Interview me"

Open design questions are decided by the human – Claude does not guess, it asks (AGENTS.md). The prompt for that is: "If you are unsure: interview me – one question per message." One question per message, so that every answer stands on its own and can later be quoted as a decision.

For a new cfg field, five questions always come up:

| Question | Why it matters | Example frost protection `tCold` |
| --- | --- | --- |
| Target band: does the field act on the release chain (`job.why`), on the dose or on the window control loop (`cfg4`)? | decides whether `bw_main` or `bw_pump` reads it and whether the band check is affected | release chain in `bw_main`: below `tCold` °C no job |
| Start value: which value goes into `DEF` of `bw_install`? `null` means "off" | the installer adds missing fields with exactly this value – also after an update | `null` (off), the operator enters e.g. 5 |
| Fast-forward value: does the profile `ZR3`/`ZR4` need its own value? | times shrink in fast-forward (cycle <!-- zr:cfg3.tick -->3<!-- /zr --> min, `tHot` <!-- zr:cfg3.tHot -->30<!-- /zr --> °C instead of <!-- def:cfg3.tHot -->35<!-- /def -->) | no – a temperature threshold stays; `ZR3` overwrites only its own fields |
| Error code: a new reason in `job.why` (does not block), a new fault in `err` (blocks, precedence in `BLOCK`) or a new hint in `err` (does not block, like `temp`, `zuviel`, `sink` in `ERR_ORDER`)? | a reason lasts only until the next cycle; a fault blocks the job, `noeff` must be deleted by a human; a hint does not block and clears itself | reason `kalt` (cold) in `job.why`, no fault |
| Who reads the field: mandatory in `REQ3` (missing → `err=cfg`) or optional (missing → off, like `dropW`, `sfUp`)? | a mandatory field forces an installer run after the update | optional |

The answers are the raw material for the decision table (step 7): numbers 1–63 are taken and stay stable, a new extension gets the next number.

## Step 3: acceptance criteria up front

Before Claude writes code, it is settled how success is measured. The criteria come from the existing checks:

| Criterion | Checked by | Limit and source |
| --- | --- | --- |
| Test case in the mock | `tools/test/*.test.js`, `npm test` | one test per rule; helpers `seeded()`, `patch()`, `voltFor()`, `runMain()` in `tools/test/helpers.js` |
| KVS size | `kvs-size.test.js` | 50 keys, every value ≤ 253 characters; the start values of `cfg3` are 202 characters (15 Sep 2026), the backup `zrb1` carries `cfg3` as a whole |
| Code size | `size.test.js`, `npm run build` | below <!-- fact:size_limit -->16 000<!-- /fact --> B, `bw_pump` <!-- fact:size_limit_pump -->18 000<!-- /fact --> B; only the `//!` lines survive as comments |
| Language subset | `syntax.test.js` | no `const`, no arrow functions, template strings, anonymous functions, no `Date`; no hoisting; only `push`/`slice`/`splice`/`indexOf`/`join` |
| Call depth | mock, line `max. Aufruftiefe` (maximum call depth) | ≤ <!-- fact:call_depth -->10<!-- /fact --> (device: 12 levels run, 14 crash) |
| Docs markers | `npm run docs:check` | every `DEF` field appears in the table of chapter 03 with a start-value marker; if one is missing the check reports "Feld fehlt" (field missing) |
| Console line | console, `console.js` | which line shows the new behaviour (e.g. `why=kalt`); never more than 15 `print` calls in a row |
| Device criterion | test protocol ([19](19-pruefprotokoll.md)) | what must be visible on the device: line, `mem_peak`, schedule, KVS content |

The start-value marker in chapter 03 looks like this (the check compares it with `DEF` in the installer):

```text
<!-- def:cfg3.tHot -->35<!-- /def -->   # start value from bw_install.js; fast-forward values with zr:, hardware test with hwt:/hwp:
```

## Step 4: start the debug environment

1. Mock first: `node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0` prints console, KVS, schedule, switch and the result line with `max. offene RPC` (open RPCs), `max. Aufruftiefe` (call depth) and `Fehler` (errors). `--seed` runs the installer and sets the band without `pctOk` – the cycle ends with `why=cfg`; `--kvs k=v` presets entries (complete band: see example output), `--hwdemo` plays the hardware tests with a virtual operator.
2. Reach the device: LAN IP or tunnel `127.0.0.1:8010` ([09](09-installation-vps.md)); `node tools/hwtest.js <ip> preflight` checks the clock, seconds to the next cycle, distance to the windows, running scripts, input, switch, KVS and the debug websocket.
3. Build the debug variant: `node tools/build.js --debug` sets `var DEBUG = 1;` in `dist/` – every script then logs steps, RPC calls and KVS entries. Follow along with `node tools/console.js <ip> [sec] [id]`; the debug websocket must be on (open the console once in the web UI). For normal operation upload `npm run build` again.
4. Check flash: `node tools/hwtest.js <ip> scripts` shows size, `mem_peak` and `fs_free`; `put-script.js` aborts if `fs_free` plus the old code is smaller than the new file plus 4 096 bytes. Test scripts cost flash (13 Sep 2026: `fs_free` 12 288 → 49 152 B after deleting three test scripts).
5. Pick the time window: never run pump tests in the <!-- hwp:winMin -->25<!-- /hwp --> min around `winA`, `winB` and midnight (`winMin` in `bw_hwpump`); `zeitraffer` and `normal` wait for a safe moment themselves (second 8–30, no production script running, in normal operation not in the 9 min after `winA`/`winB`, in fast-forward not in minutes 0–2 of a 6-minute cycle).

> **Caution (water/mains):** A device run with the pump needs a full tank and a hose that is in place. Ask for a short confirmation before a real watering – Claude asks, the human looks.

```bash
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0   # mock: cycle, band without pctOk → why=cfg
node tools/hwtest.js <ip> preflight        # device: clock, cycle, windows, scripts, KVS, debug websocket
node tools/build.js --debug                # dist/ with DEBUG = 1 (upload only for debugging)
node tools/console.js <ip> 600             # follow the console for 600 s (Node ≥ 22), connect first
node tools/hwtest.js <ip> scripts          # size, mem_peak, fs_free per script
```

## Step 5: coding

The complete rules with rationale are in [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) ("Harte Regeln für `scripts/*.js`", hard rules); `tools/test/syntax.test.js` enforces them. Short version (source: CLAUDE.md):

- Only `var` and named functions: no `const` (test), no arrow functions, template strings, anonymous functions, no `Date`. `let` is in the language reference, but the project does not use it.
- Array methods only `push`, `slice`, `splice`, `indexOf`, `join` – mJS does not know `shift`, `forEach`, `map` and friends (device 13 Sep 2026: `Function "shift" not found!`).
- No hoisting: use function names at module level only after their declaration; the step list `steps[]` sits at the very end. The mock hoists and does not show the error, only the test does.
- Flat call chain: `next()` is a loop, a finished step returns `true`; never call `next()` from inside a step.
- One open `Shelly.call` and one timer per script; all knowledge in the KVS as JSON strings, write only changes; time constants in cfg fields, not in the code.
- Shared heap: never two large scripts at the same time; long runners release `K`/`orig` while waiting.
- Console: never more than 15 `print` calls in a row; new diagnostics as `dbg(...)`, `DEBUG = 0` stays in the repo.
- Keep the version line in line 1 and `var VER` in step; the compact output must stay under the limit.

### Device docs with `//!`

Every script carries a block of `//!` lines directly under the version line: short and practical, what each setting does. The build keeps exactly these lines as `// …` in `dist/`, all other comments are dropped (`size.test.js` checks that). A new field gets its line in the `//!` block of the installer (group `cfg1`…`cfg4`) and in the script that reads it.

### A new cfg field

| Place | What to do |
| --- | --- |
| `scripts/bw_install.js`, `DEF` | field with start value in the right group; `ORDER` stays unless a new group is created. The installer adds it to existing entries on its next run (`hwtest.js <ip> normal`) |
| `scripts/bw_zeitraffer.js`, `ZR3`/`ZR4` | only if fast-forward needs a different value; the profile overwrites only the fields listed there, `zrb1`…`zrb5` back up the original |
| reading script | `REQ` list only for mandatory fields; read optional fields with a `null` check |
| `//!` block | one line in the installer and in the reading script |
| `tools/test/` | a test per rule; `kvs-size.test.js` with the worst case of the entry |
| chapter 03 | a row in the group's table with a start-value marker – otherwise `docs:check` fails |

Timing values such as `tDead`, `tPmin`, `tSoak` or `tStab` are never changed by gut feeling: first a measurement run on the setup (`hwtest.js <ip> mess`, result into the test protocol), then the start values.

## Step 6: verification

The order is fixed because every stage relies on the previous one:

1. `npm test` – <!-- fact:tests -->146<!-- /fact --> tests against the mock, including `syntax`, `size`, `kvs-size`, `dist` and `docs`.
2. `npm run check` – `node --check` of the six scripts (no output means passed).
3. `npm run build` – rewrite `dist/` and read the sizes. `dist/` is checked in; `dist.test.js` requires it to be byte-identical to the build, so it belongs in the commit.
4. `npm run docs:check` (= `node tools/check-docs.js --mit-tests`) – links, anchors, DE/EN parity, template, fact and start-value markers, outdated phrases, diagram receipts and the test count.
5. Upload: `node tools/put-script.js <ip> <id> dist/<script>.js` sends the file in chunks of 1 024 characters, reads the code back and reports `OK, byteidentisch` (byte-identical) with `fs_free` before → after. Then `node tools/verify-scripts.js <ip>`: all scripts against `dist/`, doc lines counted, versions `bw_main` = `bw_pump`.
6. Device run: start the script, follow the console, tick off the criterion from step 3; lines and measurements go into the test protocol ([19](19-pruefprotokoll.md)). After a script update run `hwtest.js <ip> normal` once so the installer creates new fields.
7. Surprise on the device? Entry in the lessons log ([18](18-lernlog-geraet.md)) following the scheme Symptom · Ursache · Warum unentdeckt · Fix · Vorbeugung (symptom, cause, why undetected, fix, prevention) – and the prevention as a rule in `syntax.test.js` or as an emulation in the mock.

```bash
npm test                                   # 146 tests, end: # pass 146 / # fail 0
npm run check                              # node --check of the six scripts
npm run build                              # dist/: size per script, doc lines
npm run docs:check                         # docs check with test count
node tools/put-script.js <ip> <id> dist/bw_main.js   # upload in chunks + byte comparison
node tools/verify-scripts.js <ip>          # all scripts on the device against dist/
node tools/hwtest.js <ip> normal 30        # installer: create new fields, verify the schedule
```

## Step 7: docs and commit

| Change | Where it goes |
| --- | --- |
| new or changed cfg field | [03 · Configuration](03-konfiguration.md): the group's table, start-value marker, who reads it, when the installer must run again |
| new `why` or `err` code | [13 · Operation and maintenance](13-betrieb-und-wartung.md): code table with meaning and fix |
| design decision | [17 · Stage and decision log](17-etappen-und-entscheidungslog.md): next number, topic, decision with rationale and date |
| device finding | [18 · Lessons from the device](18-lernlog-geraet.md): Symptom · Ursache · Warum unentdeckt · Fix · Vorbeugung |
| new RPC call | [20 · RPC and engine reference](20-rpc-referenz.md): look it up before the first call, then add call, parameters, response, used by, docs link |
| device run | [19 · Device test protocol](19-pruefprotokoll.md): date, versions, lines, measurements |

Commit and pull request:

1. Never work directly on `main`: create a branch, open a pull request.
2. Language in code comments, docs and commit messages: German.
3. `dist/` and the diagram receipts belong in the same commit as the source.
4. **`git commit` and `git push` only after the human's explicit consent** – Claude prepares, explains the diff and asks; this applies to every commit (AGENTS.md).
5. Pushing from the VPS needs a deploy key or a token: set up in [09 · Installation with a VPS](09-installation-vps.md).

## Example: frost protection `tCold` walked through

A field that does not exist in the repo (as of <!-- fact:project.version -->0.2.0<!-- /fact -->) – as a rehearsal of the process: below `tCold` °C `bw_main` shall not write a job, just as `tHot` <!-- def:cfg3.tHot -->35<!-- /def --> °C today shortens the pause to `pauseHot`.

| Step | Outcome for `tCold` |
| --- | --- |
| 1 Plan | only `bw_main` (release chain) and `bw_install` (`DEF.cfg3`); reserve: `bw_main` <!-- fact:dist.bw_main -->15 791<!-- /fact --> B is enough for one line, `bw_install` <!-- fact:dist.bw_install -->15 978<!-- /fact --> B is not enough for field plus `//!` line – tighten one doc line there |
| 2 Interview | release chain; start value `null` = off; no fast-forward value; reason `kalt` in `job.why`, no fault; optional (not in `REQ3`) |
| 3 Criteria | test: `tC` 2 °C with `tCold` 5 → `job.ok=false`, `why=kalt`; `tC` 8 → `why=ok`; `cfg3` stays under 253 characters (215 with `tCold`); console `why=kalt`; device: one cycle line with `why=kalt` with a cold probe |
| 4 Debug environment | mock with `--temp 2`; on the device the probe sleeve in ice water as in the hardware test |
| 5 Coding | in `stepEval()` an `else if` before `feucht`: `tCold !== null && m.tC !== null && m.tC < tCold` → `why = "kalt"`; `//!` line in both scripts; test in `main.test.js` |
| 6 Verification | `npm test`, `check`, `build`, `docs:check`; upload `bw_main` and `bw_install`, `verify-scripts`; `normal 30` creates `tCold`; device run into the test protocol |
| 7 Docs | chapters 03 (`cfg3`, marker), 13 (`kalt`), 17 (decision 64); commit only after approval |

This is what the test case could look like (pattern from `main.test.js`):

```js
test('Frostschutz: unter tCold kein Auftrag, why kalt', () => {
  const dev = seeded();                       // installer has run, example target band
  patch(dev, 'cfg3', { tCold: 5 });           // set the field
  dev.voltage = voltFor(34);                  // dry enough for a job
  dev.tC = 2;                                 // cold
  const r = runMain(dev);
  assert.deepEqual(r.errors, []);
  assert.equal(dev.kvsGet('job').ok, false);
  assert.equal(dev.kvsGet('job').why, 'kalt');
});
```

## Example output

Check chain in the repo on 15 Sep 2026, version <!-- fact:project.version -->0.2.0<!-- /fact --> without changes – this is what "green" looks like:

```text
$ npm test
# tests 146
# suites 0
# pass 146
# fail 0

$ npm run build
bw_install.js    23789 →  15978 Byte, 22 Doku-Zeilen
bw_main.js       23059 →  15791 Byte, 8 Doku-Zeilen
bw_pump.js       20330 →  17475 Byte, 5 Doku-Zeilen
bw_hwtest.js     16792 →  13952 Byte, 4 Doku-Zeilen
bw_hwpump.js     18736 →  14500 Byte, 4 Doku-Zeilen
bw_zeitraffer.js 13822 →   7459 Byte, 12 Doku-Zeilen
dist/ geschrieben – hochladen mit node tools/put-script.js <ip> <id> dist/<datei>, prüfen mit node tools/verify-scripts.js <ip>
```

The mock run of `bw_main` with a complete target band (cycle at 34 % moisture, 24 °C, tank full) needs `pctOk` via `--kvs`, because `--seed` leaves the field at `null`:

```bash
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0 --kvs 'cfg2={"pctSoll":55,"pctLo":40,"pctHi":60,"pctDry":28,"hyst":2,"dropSlow":4,"effMin":0.05,"effMax":30,"alpha":0.3,"sfMin":0.5,"sfStep":0.1,"pctOk":50,"dropW":null,"sfUp":0.05}'   # complete band; --seed alone leaves pctOk null → why=cfg, err=cfg
```

The run ends with the console line and the result line the criteria from step 3 hang on:

```text
[bw_main 0.2.0] V=1.2 pct=34.13 tC=24 lvl=0 st=beob dry=0 pause=24h why=ok sec=70 effW=- sf=0.7 err=- w=3 dauer=2600ms
--- Ergebnis --- beendet=true Dauer=2600 ms, max. offene RPC=1, max. Aufruftiefe=5, Fehler=0
```

`why=ok sec=70`: first job with `tStd`, because `effW` is still `null`; `w=3` write operations; one open RPC, call depth 5 of the allowed <!-- fact:call_depth -->10<!-- /fact -->, no error. On the device the same line arrives via `console.js` or `hwtest.js watch`.

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `npm test` green, on the device `ReferenceError: "stepRead" is not defined` (12 Sep 2026) | a function name used at module level before its declaration – the mock hoists, mJS does not | move the step list and tables with function references to the end of the file or into a function; `syntax.test.js` reports it when the line is outside a function |
| `Function "shift" not found!` | an array method mJS does not know | ring buffers by index, loops with `for`; only `push`/`slice`/`splice`/`indexOf`/`join` |
| script ends without a console line, `Script.GetStatus` shows `out_of_memory` | a second large script ran at the same time, or KVS objects stayed in the heap while waiting | never two large scripts in the same second; `K = {}; orig = {}` while waiting; measure `mem_peak` with `hwtest.js watch` |
| `Too much recursion` | nested calls beyond the stack depth | `next()` as a loop, steps return `true`; watch the mock line `max. Aufruftiefe` |
| `SyntaxError: Got EOF` after pasting in the editor | the web UI lost text while pasting (12 Sep 2026: 166 and 210 bytes) | use `put-script.js`, then `verify-scripts.js` – byte-identical |
| `bw_main` reports `err=cfg` ("cfg3.x fehlt", field missing) after the update | new mandatory field, installer not run yet | `hwtest.js <ip> normal 30` – or make the field optional |
| `docs:check`: "Tabelle cfg3: Feld tCold fehlt" (field missing) | field in `DEF` but not in chapter 03 | add the row with a start-value marker to the table |
| `dist.test.js` red | `dist/` not rebuilt or not checked in | `npm run build`, commit `dist/` too |
| upload aborts with "Flash zu voll" (flash full) | `fs_free` plus old code smaller than the file plus 4 096 B | `hwtest.js <ip> scripts`, remove a test script with `delete <id>` |

## Next

- [14 · Debugging and testing](14-debuggen-und-testen.md) – mock, tests, console and the complete tool reference for steps 4 and 6
- [16 · Concept and decisions](16-konzept-und-entscheidungen.md) – the design principles an extension has to measure up to
- [17 · Stage and decision log](17-etappen-und-entscheidungslog.md) – where the decision from the interview ends up
- [18 · Lessons from the device](18-lernlog-geraet.md) – where every surprise from the device goes
- [19 · Device test protocol](19-pruefprotokoll.md) – where the lines and measurements of the device run go
- [20 · RPC and engine reference](20-rpc-referenz.md) – look it up before every new RPC call
