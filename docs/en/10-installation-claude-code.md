# 10 · Installation with Claude Code

[Deutsch](../de/10-installation-claude-code.md) · **English** — [Handbook](README.md) · Part C "Install"

> **At a glance**
> - Claude Code carries out the steps of chapter 06 itself – build, upload, byte-identical check, run the installer – and asks you before every decision.
> - Scope: one prompt, eight interview steps, three decisions that stay with you (script names, target band, approval of commit and push).
> - Expected result: `verify-scripts` reports "4 Scripts mit dist/ verglichen, alle byteidentisch" (4 scripts compared with dist/, all byte-identical), `normal 60` ends with "NORMALBETRIEB" (normal operation); the largest script `bw_pump` is <!-- fact:dist.bw_pump -->17475<!-- /fact --> bytes in `dist/`.
> - Biggest pitfall: the Claude Code sandbox blocks network access to the Shelly until its address is listed in `.claude/settings.local.json`.

## Prerequisites

- A computer with access to the Shelly as in [08 · Installation with a local server](08-installation-lokaler-server.md) (`<ip>` is the LAN address, e.g. `192.168.88.10`) or [09 · Installation with a VPS](09-installation-vps.md) (`<ip>` is `127.0.0.1:8010` through the tunnel).
- Node ≥ 22, the repo cloned, `npm test` green (<!-- fact:tests -->146<!-- /fact --> tests); no other dependencies.
- An Anthropic account to sign in to Claude Code on first start.
- The device is prepared as in [06 · Start guide](06-startanleitung.md) step 1: voltmeter and DS18B20 added as peripherals, input 1 set to switch, debug websocket on (web UI → Scripts → open the console).
- The three operating scripts `bw_install`, `bw_main`, `bw_pump` exist on the device with exactly these names – or you let question 1 create them. `preflight` creates `bw_zeitraffer` itself.

## Diagram

[![Installation as an interview: human, Claude, tools, device](../diagramme/en/10-installation-claude-code.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/10-installation-claude-code.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/10-installation-claude-code.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Roles", 2 "Approvals", 3 "Check the result".

## Installing and starting Claude Code

Claude Code is the command-line AI assistant this project was built with. It works in your project folder: reads and edits files, runs commands (tests, tools, git) and completes multi-step tasks – in this project all the way to the Shelly, which it reaches via RPC through the tools in `tools/`.

```bash
npm install -g @anthropic-ai/claude-code   # once; Node ≥ 22 is there anyway for the tools
cd Plant-watering-Shelly-SMT50             # always start inside the project folder – only there does Claude read CLAUDE.md
claude                                     # first session: sign in with your Anthropic account
```

Inside the session `/help` lists the commands; everything else you write in plain language, for example "run npm test and summarise the result" or "explain how `bw_main` computes the pause".

## What Claude reads in the repo

Claude Code follows guidance and configuration files in the repo. That is why the session must start in the project folder – otherwise the AI knows neither the hard rules of the Shelly scripts nor the procedure on the device.

| File / folder | Role during installation |
| --- | --- |
| [`CLAUDE.md`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) | project guide for Claude Code only: structure, commands, hard rules of the Shelly scripts, working method on the device (upload, `verify-scripts`, `normal`, fast-forward) |
| [`AGENTS.md`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/AGENTS.md) | guide for all AI agents, vendor-neutral; contains the consent rule for commit and push |
| `.claude/settings.json` | committed: hooks and status line for graft, pre-approved `graft` commands – nothing else |
| `.claude/settings.local.json` | personal, gitignored: sandbox allowance for the network (your Shelly's address) and your permanent command approvals |
| `.claude/skills/graft/` | skill: how Claude queries the graft code index |
| `.mcp.json` | registers the MCP server `graft mcp` |

### graft is optional

The code index graft (`graft/`, gitignored) lets Claude answer code questions with `graft ask "…" --source`, `graft grep`, `graft skeleton <file>` and `graft callers <symbol>` in seconds instead of reading whole files. The installation does not need it: without graft the hooks in `.claude/settings.json` do nothing (`graft-hooks.cjs` silently catches the failed import and does nothing) and Claude reads the files directly.

If you want it, install the package `@nanonets/graft` globally with npm and build the index in the project folder with `graft build`; `graft check` later verifies that the index matches the code. Commands and examples: [14 · Debugging and testing](14-debuggen-und-testen.md) and [`.claude/skills/graft/SKILL.md`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/.claude/skills/graft/SKILL.md).

## The installation dialogue as an interview

The installation is an interview: Claude drives the tools, reads their output and asks you exactly the questions a tool cannot answer. The order is the same as in chapter 06 – build, create scripts, upload, verify, target band, installer, check the schedule; in the interview only the pre-check with `preflight` comes before it.

### Prompt template

```text
Installiere die Scripts auf <ip>. Lies Script-Namen und IDs mit preflight vom Gerät, frage mich, welche fehlenden Scripts angelegt werden sollen, und nach dem Zielband, bevor du am Gerät schreibst.
Ablauf: hwtest.js preflight → npm run build → put-script.js je Script → verify-scripts.js (byteidentisch) → cfg2 → hwtest.js normal 60 → erste Konsolenzeile zeigen.
Nichts committen.
```

(In English: "Install the scripts on `<ip>`. Read script names and IDs from the device with preflight, ask me which missing scripts to create and for the target band before you write to the device. Sequence: hwtest.js preflight → npm run build → put-script.js per script → verify-scripts.js (byte-identical) → cfg2 → hwtest.js normal 60 → show the first console line. Do not commit anything." The project language is German; the prompt follows the sequence described in `CLAUDE.md`, and an English prompt works just as well.)

### The steps

| Step | Claude runs | What you see or decide |
| --- | --- | --- |
| 1 Pre-check | `node tools/hwtest.js <ip> preflight` | time (NTP), seconds to the next cycle, scripts with IDs, input 1, output, debug websocket; creates `bw_zeitraffer` and prints its upload command; the IDs of the three operating scripts are in the line "Scripts: …". A "BLOCKER" (e.g. "Input 1 (Wasserstand) ist deaktiviert", input 1 for the water level is disabled) must be cleared before going on. |
| 2 Build | `npm run build` | six files in `dist/` with byte counts; only `dist/` goes to the device, `scripts/` is the source. |
| 3 Question 1 | – | Claude lists the scripts it found and asks whether missing operating scripts should be created (web UI → Scripts → Add script, or via RPC `Script.Create` with the exact name). The device assigns the IDs; Claude reads them from `Script.List` and never guesses them. |
| 4 Upload | `node tools/put-script.js <ip> <id> dist/<name>.js` – four times | per script "… Byte in n Stücken gesendet … OK, byteidentisch; fs_free a → b" (bytes sent in n chunks, OK, byte-identical). The tool checks the flash first and stops the script; the web editor lost text on paste, so always upload via RPC. |
| 5 Verify | `node tools/verify-scripts.js <ip>` | one line per script, ending with "4 Scripts mit dist/ verglichen, alle byteidentisch"; also checks that `bw_main` and `bw_pump` carry the same version. |
| 6 Question 2 | `KVS.Set cfg2` via `curl` | Claude asks for the target band and `dropSlow`; you name the values or say "measure only for now" (then `cfg2` stays open: `why=cfg`, `err=cfg`, no watering). Claude writes them as a JSON string **before** the installer – a partial object is enough. |
| 7 Installer | `node tools/hwtest.js <ip> normal 60` | waits for a safe moment (second 8–30, not within 9 min after a watering window, no script running), starts `bw_install`, follows the console and then checks schedule, `auto_off` and backup: "NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet" (normal operation – schedule and configuration as expected). |
| 8 First line | `node tools/console.js <ip> 900` | the first line of `bw_main` at the next cycle (wait at most <!-- def:cfg3.tick -->15<!-- /def --> min). The console must be connected before the cycle, otherwise the line is missing. |

### Entering the target band

The target band is the most important decision, and it stays with you: Claude does not know your plant. Example band on the device since 13 Sep 2026, in band order: `pctDry` 28 < `pctLo` 40 < `pctOk` 50 ≤ `pctSoll` 55 < `pctHi` 60, plus `dropSlow` 4. How to derive it at the plant is in [12 · First commissioning](12-erstinbetriebnahme.md), the meaning of every field in [03 · Configuration](03-konfiguration.md). `cfg1` keeps its defaults; the hardware check in chapter 11 measures the calibration points.

```bash
curl -s -X POST http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctDry\":28,\"pctLo\":40,\"pctOk\":50,\"pctSoll\":55,\"pctHi\":60,\"dropSlow\":4}"}'   # the value is a JSON string
```

> **Note:** `KVS.Set` replaces the whole entry. Before the installer a partial object is enough, because `bw_install` adds missing fields with their defaults (console: "KVS cfg2 ergänzt: hyst,effMin,…", cfg2 completed). If you change `cfg2` later, write the complete entry (web UI: "Format as JSON") or run the installer once more afterwards.

## What Claude does and what you decide

| Claude does itself | You decide |
| --- | --- |
| `npm test`, `npm run build`, `hwtest.js preflight` and `scripts`, `put-script.js`, `verify-scripts.js`, `hwtest.js normal`, `console.js`, `kvs_dump.sh`, reading `Schedule.List` | the target band and all hand-set values in `cfg2`/`cfg3` |
| writing values to the KVS that you named | configuration changes on the device: `hwtest.js input-on` is, according to the tool, the "einzige Konfigänderung, nur auf Zuruf" (only config change, only on request) |
| interpreting output, reporting deviations, proposing the next step | creating or deleting scripts (flash is scarce), hands-on work at the setup (sensor, float switch, hose) |
| drafting results for the test protocol | starting the hardware check and the fast-forward test ([11](11-hardware-check.md), [12](12-erstinbetriebnahme.md)); commit and push |

> **Note:** consent rule from `AGENTS.md` (binding, abridged): "An agent may work out, test and prepare changes (edit files, run `npm test`, propose a commit locally). But `git commit` and `git push` require the explicit consent of the human. Ask before every commit/push. For open design questions, the human decides – don't guess, ask."

### Building on after the installation

The same division of roles applies to every later task – the short form, in full in [15 · Extending with Claude Code](15-ausbau-mit-claude-code.md):

1. Start the session in the project folder: `claude`.
2. Describe the task in plain language.
3. For larger changes, review and approve the plan.
4. The AI edits code and tests; `npm test` must stay green.
5. New decisions go to [17 · Stage and decision log](17-etappen-und-entscheidungslog.md), device lessons to [18 · Lessons from the device](18-lernlog-geraet.md).
6. Commit and push only after your approval.

## Permissions, plan mode, sandbox

**Permissions:** Claude Code asks before every command and every file change that is not pre-approved. The committed `.claude/settings.json` allows only `graft` commands; `node tools/…`, `curl` and `npm` you confirm on first use, permanent approvals land in your `settings.local.json`. Read the prompt: it shows the full command, including which file goes to which script ID.

**Plan mode:** for the installation the interview prompt is enough. For larger tasks – such as an extension following [15 · Extending with Claude Code](15-ausbau-mit-claude-code.md) – Claude plans first in plan mode and asks for your approval before changing anything.

**Sandbox:** Claude Code runs commands in a sandbox with a network block. For the tools to reach the Shelly, its address must be in the personal settings file – easiest is to tell Claude directly ("allow access to `http://<ip>`"); the `update-config` skill writes it:

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": ["127.0.0.1", "localhost"]
    }
  }
}
```

This is the file `.claude/settings.local.json` in the project folder (gitignored) for the tunnel route; on the LAN the Shelly's address replaces `127.0.0.1`. Test afterwards: `curl -s http://<ip>/rpc/Shelly.GetDeviceInfo`.

## Checking the result

1. `verify-scripts.js`: every line ends with "OK, byteidentisch", `bw_main` and `bw_pump` carry the same version <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->.
2. `normal 60`: schedule with three own entries (with the defaults; if `winA` and `winB` have different minutes, up to five) – `0 */15 * * * *` (`bw_main` every <!-- def:cfg3.tick -->15<!-- /def --> min), `30 0 8,20 * * *` (`bw_pump` 30 s after <!-- def:cfg3.winA -->08:00<!-- /def --> and <!-- def:cfg3.winB -->20:00<!-- /def -->) and `0 8 8,20 * * *` (safety-off 8 min after the window: 30 s + `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s + 10 s, rounded up); `auto_off` 190 s (`tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s + 10); "keine Zeitraffer-Sicherung" (no fast-forward backup); final line "NORMALBETRIEB".
3. KVS: `tools/kvs_dump.sh <ip>` shows nine entries `cfg1`, `cfg2`, `cfg3`, `cfg4`, `lrn`, `st`, `job`, `day`, `err` as JSON strings; `cfg2` carries your band, all other fields their defaults.
4. First console line of `bw_main`: `V=` a voltage, `tC=` a temperature, `lvl=` 0 or 1, `err=-`. `why=cfg` (with `err=cfg`) appears only while the band is incomplete.
5. Nothing committed in the repo: `git status` shows at most files you changed yourself (`settings.local.json` is gitignored).

## Example output

Upload and verification (script IDs as on the device on 13 Sep 2026, byte counts from `dist/` at <!-- fact:project.version -->0.2.0<!-- /fact -->, `fs_free` from the upload on 13 Sep 2026):

```text
$ node tools/put-script.js <ip> 3 dist/bw_pump.js
dist/bw_pump.js → Script 3: 17475 Byte in 18 Stücken gesendet, 17475 Byte am Gerät (PutCode len=17475), 5 Doku-Zeilen – OK, byteidentisch; fs_free 49152 → 40960
$ node tools/verify-scripts.js <ip>
Script 1 bw_install      15978 Byte am Gerät,  15978 Byte dist/, 22 Doku-Zeilen, v0.1.3 – OK, byteidentisch
Script 2 bw_main         15791 Byte am Gerät,  15791 Byte dist/, 8 Doku-Zeilen, v0.2.0 – OK, byteidentisch
Script 3 bw_pump         17475 Byte am Gerät,  17475 Byte dist/, 5 Doku-Zeilen, v0.2.0 – OK, byteidentisch
Script 7 bw_zeitraffer    7459 Byte am Gerät,   7459 Byte dist/, 12 Doku-Zeilen, v0.2.0 – OK, byteidentisch
4 Scripts mit dist/ verglichen, alle byteidentisch
```

("Byte am Gerät" = bytes on the device, "Doku-Zeilen" = documentation lines, "Stücken" = chunks.) Installer console after a partial `cfg2` written beforehand (run of `bw_install` <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> in the mock, `node tools/run-script.js scripts/bw_install.js --kvs 'cfg2={…}'`; on the device the numbers after `#` are the schedule IDs assigned by the device):

```text
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] KVS cfg2 ergänzt: hyst,effMin,effMax,alpha,sfMin,sfStep,dropW,sfUp
[bw_install 0.1.3] Zeitplan: 0 Einträge, davon eigene: 0
[bw_install 0.1.3] Switch 0: auto_off 190 s
[bw_install 0.1.3] KVS neu angelegt: cfg1, cfg3, cfg4, lrn, st, job, day, err
[bw_install 0.1.3] Zeitplan #1: 0 */15 * * * *
[bw_install 0.1.3] Zeitplan #2: 30 0 8,20 * * *
[bw_install 0.1.3] Zeitplan #3: 0 8 8,20 * * *
[bw_install 0.1.3] fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach
```

("ergänzt" = completed, "Zeitplan … Einträge, davon eigene" = schedule entries, of which own, "KVS neu angelegt" = KVS entries created, "fertig" = done, "Sicherheits-Aus … danach" = safety-off … afterwards.) First line of `bw_main` at the next cycle after a fresh installation with the example band (run in the mock: `node tools/run-script.js scripts/bw_main.js --seed --voltage 1.196 --temp 23.6 --level 0 --kvs 'cfg2={…}'`; `why=ok` means a job was written; `err=-` no fault; `w=3` three KVS writes):

```text
[bw_main 0.2.0] V=1.196 pct=33.993 tC=23.6 lvl=0 st=beob dry=0 pause=24h why=ok sec=70 effW=- sf=0.7 err=- w=3 dauer=2600ms
```

Here `sec=` is the default `tStd` (<!-- def:cfg3.tStd -->70<!-- /def --> s) and `effW=-` stays until the first learned window; after that `bw_main` computes the seconds from the learned value (device, 13 Sep 2026 after `kal write`: `lrn.effW` 4.46, in the line `effW=4.46`).

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| tools report "Tunnel 127.0.0.1:8010 offen?" (tunnel open?) or `fetch failed`, while `curl` from the shell works | the Claude Code sandbox blocks the network | allow the Shelly's address in `.claude/settings.local.json` (sandbox section), repeat the command – if in doubt restart the session |
| Claude writes `put-script.js <ip> 2 …` for `bw_pump` or quotes "IDs 1, 2, 3" from old documentation | IDs guessed instead of read | only the IDs from `hwtest.js <ip> scripts` or `preflight` count; names exactly `bw_install`, `bw_main`, `bw_pump`, `bw_zeitraffer` |
| `put-script.js`: "Flash zu voll: fs_free … – erst Platz schaffen" (flash too full, make room first) | test scripts (`engine_probe`, `bw_hwtest`, `bw_hwpump`) occupy the flash | `hwtest.js <ip> scripts`, then `delete <id>` for the test scripts; upload again afterwards |
| `verify-scripts.js`: "WEICHT AB ab Zeichen …" (differs from character …) or "VERSIONEN WEICHEN AB" (versions differ) | upload incomplete, or only one of the pair `bw_main`/`bw_pump` updated | upload the named script again with `put-script.js`, keep both operating scripts on the same version |
| `normal 60`: "kein sicherer Moment in 4 min: läuft: …" (no safe moment in 4 min, running: …) | an operating or test script keeps running (e.g. a waiting `bw_hwtest`) | `hwtest.js <ip> stop`, then `normal 60` again |
| `normal 60`: "ABWEICHUNG Zeitplan ist … erwartet …" (deviation: schedule is …, expected …) | `Schedule.Create` rejected by the device, or old entries in the way | read the installer console, repeat `normal 60`; `bw_install` removes its own entries itself |
| first console line missing, `console.js` shows only firmware lines | console connected only after the cycle, or debug websocket off | start `console.js` before the cycle; opening the console in the web UI turns the websocket on (`preflight` reports "Debug-Websocket an") |
| `why=cfg`, `err=cfg`, readings present in the line (`V=1.196 …`) | target band incomplete: one of the six fields `pctSoll`, `pctLo`, `pctOk`, `pctHi`, `pctDry`, `dropSlow` is `null` | enter the missing band fields in `cfg2` (section on the target band); at the next cycle `bw_main` clears `err=cfg` itself |
| console "Störung cfg: cfg2.hyst fehlt" (fault cfg: cfg2.hyst missing), line with `V=- pct=-` | `cfg2` written as a partial object after the installer – required fields such as `hyst` are gone | write `cfg2` completely (web UI "Format as JSON") or run `normal 60` again (adds missing fields) |
| Claude wants to "commit to wrap up" | consent rule ignored | decline or approve explicitly – without your yes there is no commit |

## Next

- [11 · Hardware check](11-hardware-check.md) – verify sensors, float switch and pump in the same interview and let `cfg1` be measured.
- [12 · First commissioning](12-erstinbetriebnahme.md) – derive the target band at the plant, measurement run, fast-forward test, first real window.
- [15 · Extending with Claude Code](15-ausbau-mit-claude-code.md) – once the installation runs and you want to extend the controller.
