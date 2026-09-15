# Handbook – Plant watering with the Shelly Plus Uni

[Deutsch](../de/README.md) · **English** — [Start page](../index.md) · [Repository](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50)

Self-learning watering for one plant: a Shelly Plus Uni measures soil moisture (SMT50), temperature (DS18B20) and water level, waters in portions with re-measuring and learns how much moisture one pump second brings. Everything runs locally on the device, no cloud. This handbook has six parts; every chapter comes with an interactive diagram.

> **Status**
> - Project version <!-- fact:project.version -->0.2.0<!-- /fact --> · scripts bw_main <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, bw_pump <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, bw_install <!-- fact:ver.bw_install -->0.1.3<!-- /fact -->, bw_zeitraffer <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact -->
> - Mock tests: <!-- fact:tests -->146<!-- /fact --> · compact output bw_pump <!-- fact:dist.bw_pump -->17475<!-- /fact --> B (limit <!-- fact:size_limit_pump -->18000<!-- /fact -->), other scripts below <!-- fact:size_limit -->16000<!-- /fact --> B
> - Last device run: 13 Sep 2026 (control-loop window in fast-forward, calibration values written) – chapter 19

## Reading paths

- **Beginner:** 05 wiring → 06 start guide → 07 or 08 installation → 12 first commissioning → 13 operation
- **Maker:** 01 architecture → 02 flow → 03 configuration → 14 debugging → 15 extending
- **AI agent:** [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) → 15 extending → 17 decision log → 18 lessons → 20 RPC reference

## Chapters

Diagrams: every chapter shows a static image and links the interactive version (zoom, search, focus on one element, relationship trace, story chapters, light/dark). The diagram UI is English; labels follow the chapter language.

### Part A – Understand

| No. | Chapter | For whom | Outcome | Diagram |
| --- | --- | --- | --- | --- |
| 01 | [Overall architecture](01-gesamtarchitektur.md) | Beginners, makers | Understand parts, six scripts, schedule and KVS in five minutes | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/01-gesamtarchitektur.html) |
| 02 | [Flow: cycle, job, window, check, pause](02-flussdiagramm.md) | Operators, makers | Know what the device does in a day and why it is not watering right now | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/02-flussdiagramm.html) |
| 03 | [How the configuration fits together (parameter reference)](03-konfiguration.md) | Anyone changing a field | Every field: who reads it, what it does, when the installer must run again | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/03-konfiguration.html) |
| 04 | [Safety and limits](04-sicherheit-und-grenzen.md) | Everyone before building | Why the pump never runs away and where the Shelly and the SMT50 hit their limits | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/04-sicherheit-und-grenzen.html) |

### Part B – Build

| No. | Chapter | For whom | Outcome | Diagram |
| --- | --- | --- | --- | --- |
| 05 | [Wiring and hardware build](05-verkabelung-und-aufbau.md) | Makers with a soldering iron | The web UI shows voltage, temperature and input changes | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/05-verkabelung-und-aufbau.html) |

### Part C – Install

| No. | Chapter | For whom | Outcome | Diagram |
| --- | --- | --- | --- | --- |
| 06 | [Step-by-step start guide](06-startanleitung.md) | Everyone | From the wired device to the first watering window, choosing an installation route | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/06-startanleitung.html) |
| 07 | [Installation by hand (web UI, copy & paste)](07-installation-per-hand.md) | No Node, no terminal | Scripts pasted from dist/, byte check passed, installer done | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/07-installation-per-hand.html) |
| 08 | [Installation with a local server (PC or Raspberry Pi on the LAN)](08-installation-lokaler-server.md) | Node ≥ 22 on the same network | Upload, verification and installer with the tools straight against the IP | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/08-installation-lokaler-server.html) |
| 09 | [Installation with a VPS (reverse SSH tunnel)](09-installation-vps.md) | Working on a server | The Shelly at home reachable via 127.0.0.1:8010, tools and Claude Code on the VPS | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/09-installation-vps.html) |
| 10 | [Installation with Claude Code](10-installation-claude-code.md) | Let the AI lead | Installation as an interview: what Claude does, what the human decides | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/10-installation-claude-code.html) |

### Part D – Operate

| No. | Chapter | For whom | Outcome | Diagram |
| --- | --- | --- | --- | --- |
| 11 | [Hardware check (bw_hwtest, bw_hwpump)](11-hardware-check.md) | After installation | Sensors, float switch and pump verified, cfg1 measured | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/11-hardware-check.html) |
| 12 | [First commissioning: calibration, target band, fast-forward, first window](12-erstinbetriebnahme.md) | After the hardware check | Values that make the device water correctly; the whole cycle seen once in 45 minutes | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/12-erstinbetriebnahme.html) |
| 13 | [Operation and maintenance](13-betrieb-und-wartung.md) | Day-to-day operators | Read the console, decode states, fix faults, update, maintain, travel | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/13-betrieb-und-wartung.html) |

### Part E – Extend

| No. | Chapter | For whom | Outcome | Diagram |
| --- | --- | --- | --- | --- |
| 14 | [Debugging and testing](14-debuggen-und-testen.md) | Developers, agents | Mock, tests, build, upload and console; complete tool reference | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/14-debuggen-und-testen.html) |
| 15 | [Extending the controller with Claude Code](15-ausbau-mit-claude-code.md) | Anyone extending it | Plan, interview, acceptance criteria, debug environment, coding, verification, commit | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/15-ausbau-mit-claude-code.html) |

### Part F – Development

| No. | Chapter | For whom | Outcome | Diagram |
| --- | --- | --- | --- | --- |
| 16 | [Concept and decisions (as of 0.2.0)](16-konzept-und-entscheidungen.md) | Anyone asking why | Design principles, control core, rejected alternatives, next stages | [interactive](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/16-konzept-und-entscheidungen.html) |
| 17 | [Stage and decision log](17-etappen-und-entscheidungslog.md) *(in progress)* | Agents, developers | What was decided when and why; numbers 1–63 stay stable; open items | – |
| 18 | [Lessons from the device](18-lernlog-geraet.md) *(in progress)* | Anyone hit by a surprise | Every device finding with symptom, cause, fix and the rule in the tests | – |
| 19 | [Device test protocol](19-pruefprotokoll.md) *(in progress)* | Anyone needing measurements | What was measured on the real setup; template for the next run | – |
| 20 | [RPC and engine reference](20-rpc-referenz.md) *(in progress)* | Anyone adding an RPC | Every RPC in use with parameters, response and docs link; engine facts with measurement date | – |
| 21 | [SEO and keywords](21-seo-keywords.md) *(in progress)* | Anyone making the project findable | Keyword clusters, placement, GitHub topics | – |

## Conventions

- `<ip>` is the Shelly address, e.g. `192.168.88.10` on the LAN or `127.0.0.1:8010` through the SSH tunnel (chapter 09).
- Script IDs are assigned by the device; `node tools/hwtest.js <ip> scripts` lists them. Examples use the IDs of the reference device (1 = bw_install, 2 = bw_main, 3 = bw_pump, 7 = bw_zeitraffer).
- Console lines, KVS fields and fault codes are German and are never translated; the glossary below explains them.
- `[TODO am Gerät]` marks statements that still have to be measured on the real setup.
- Numbers in the chapters come from the scripts (`bw_install.js` DEF, `bw_zeitraffer.js` ZR3/ZR4) and the dated protocols; `npm run docs:check` verifies them.

## Glossary

| Term (German) | Meaning |
| --- | --- |
| Takt (cycle) | run of `bw_main` every `tick` minutes (default 15): measure, evaluate, write the job |
| Fenster (window) | run of `bw_pump` at the watering times (`winA`/`winB`, second 30): fresh measurement, portions, learning |
| Portion | one pump switch-on with `toggle_after`; a window has up to `nPort` portions |
| Gabe (dose) | the sum of all portions of one window |
| Auftrag (`job`) | hand-over from `bw_main` to `bw_pump`: `ok`, `sec`, `pct`, `why` |
| Kontrolle (check) | re-measurement by `bw_main` `soak` minutes after the window |
| Pause / Sperre (lock) | minimum distance between doses (`pause`, `pauseHot`, `pauseSlow`), state `st.state = "sperre"` |
| Trockenphase (dry phase) | no dose from the dry day (`dryDay`) or after wetness (`> pctHi`) until moisture drops below `pctDry` |
| Zielband (target band) | `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` in percent soil moisture |
| Zeitraffer (fast-forward) | the same scripts with short times (cycle 3 min, window every 6 min) for a 45-minute test |
| Messlauf / Kalibrierlauf | tools `hwtest.js mess` and `kal`: measure the effect of a pump pulse, derive learning values |
| Frist (deadline) | time `bw_pump` has inside the window before the next cycle (`tWin`, `tTail`) |
| Claim | `st.why = "laeuft"`: marks a running window in the KVS (crash-safe) |
| Störung (`err`, fault) | blocking or informational code, e.g. `wasser` (water), `noeff` (no effect), `cfg` |
| Console words | `feucht` = moist (no dose), `trocken` = dry phase, `wasser` = tank empty, `laeuft` = running, `gegossen` = watered, `beob` = observing, `ok` = job ready |
