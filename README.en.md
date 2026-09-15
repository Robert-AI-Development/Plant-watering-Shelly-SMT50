# Self-learning plant watering with Shelly Plus Uni & SMT50 – DIY smart home without cloud

> A Shelly Plus Uni measures soil moisture, temperature and water level, waters in portions with re-measuring and learns how much moisture one pump second brings. Local, no cloud, ideal for holidays – programmed and live-debugged on the device with Claude Code.

**Deutsch:** [README.md](README.md) · **Handbook:** [English](docs/en/README.md) · [Deutsch](docs/de/README.md) · **Online:** [robert-ai-development.github.io/Plant-watering-Shelly-SMT50](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/)

![License MIT](https://img.shields.io/badge/License-MIT-green) ![Shelly](https://img.shields.io/badge/Shelly-Plus%20Uni-orange)

Status: version <!-- fact:project.version -->0.2.0<!-- /fact --> · bw_main <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, bw_pump <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, bw_install <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> · last device run 13 Sep 2026.

## What it does

Every 15 minutes the script `bw_main` measures soil moisture (SMT50 on the analog input), temperature (DS18B20) and water level (float switch) and writes a watering job to the device's KVS. At two times a day `bw_pump` takes a fresh reading, waters in portions with re-measuring until the target band is reached and learns the effect per pump second. An installer creates the schedule and the default values. Nothing runs permanently, nothing lives in RAM, nothing goes to the cloud.

[![Overall architecture: sensors, scripts, schedule, KVS](docs/diagramme/en/01-gesamtarchitektur.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/01-gesamtarchitektur.html)

Interactive version with story chapters, focus and relationship trace: [open the diagram](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/01-gesamtarchitektur.html) · all diagrams: [docs/diagramme](docs/diagramme/README.md)

## At a glance

- **No cloud:** schedule, scripts and memory (KVS) live on the Shelly; only the time comes via NTP.
- **It learns:** effect in percent moisture per effective pump second (`lrn.effW`); the safety factor starts cautiously at 0.7.
- **Portions with re-measuring:** fresh reading first, then a portion, soak, stable reading, a correction portion if needed; target reached → done.
- **Triple shut-off:** `toggle_after` per portion, `auto_off` 190 s on the output, scheduled safety-off 8 minutes after the window.
- **Built with AI:** mock, <!-- fact:tests -->146<!-- /fact --> tests, tools for upload, console, fast-forward test and calibration; Claude Code drives installation and extensions as an interview.

## Quick start

```bash
git clone https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50.git && cd Plant-watering-Shelly-SMT50
npm test                                              # tests against the mock, no dependencies
npm run build                                         # dist/ (compact output, also checked in)
node tools/put-script.js <ip> <id> dist/bw_main.js    # upload per script, verified byte for byte
node tools/verify-scripts.js <ip>                     # compare all scripts on the device with dist/
node tools/hwtest.js <ip> normal 60                   # installer: schedule, defaults, auto_off
```

Then enter the target band and follow the first window: [chapter 06 start guide](docs/en/06-startanleitung.md) · without Node via the web UI: [chapter 07](docs/en/07-installation-per-hand.md).

## Handbook

| Part | Chapters |
| --- | --- |
| A Understand | [01 Overall architecture](docs/en/01-gesamtarchitektur.md) · [02 Flow](docs/en/02-flussdiagramm.md) · [03 Configuration](docs/en/03-konfiguration.md) · [04 Safety and limits](docs/en/04-sicherheit-und-grenzen.md) |
| B Build | [05 Wiring and hardware build](docs/en/05-verkabelung-und-aufbau.md) |
| C Install | [06 Start guide](docs/en/06-startanleitung.md) · [07 By hand](docs/en/07-installation-per-hand.md) · [08 Local server](docs/en/08-installation-lokaler-server.md) · [09 VPS](docs/en/09-installation-vps.md) · [10 Claude Code](docs/en/10-installation-claude-code.md) |
| D Operate | [11 Hardware check](docs/en/11-hardware-check.md) · [12 First commissioning](docs/en/12-erstinbetriebnahme.md) · [13 Operation and maintenance](docs/en/13-betrieb-und-wartung.md) |
| E Extend | [14 Debugging and testing](docs/en/14-debuggen-und-testen.md) · [15 Extending with Claude Code](docs/en/15-ausbau-mit-claude-code.md) |
| F Development | [16 Concept and decisions](docs/en/16-konzept-und-entscheidungen.md) · [17 Stage and decision log](docs/en/17-etappen-und-entscheidungslog.md) · [18 Lessons from the device](docs/en/18-lernlog-geraet.md) · [19 Device test protocol](docs/en/19-pruefprotokoll.md) · [20 RPC reference](docs/en/20-rpc-referenz.md) · [21 SEO](docs/en/21-seo-keywords.md) |

## Safety

> **Caution (water/mains):** The 230 V side of the pump or its transformer is for a qualified electrician. The Shelly output only switches a relay (contact ≤ 30 V / 300 mA). Water, tank and hose stay physically apart from the Shelly and the power supply. Details: [chapter 04](docs/en/04-sicherheit-und-grenzen.md).

## Contributing

Rules for humans and AI agents are in [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md). Extensions follow the process in [chapter 15](docs/en/15-ausbau-mit-claude-code.md): plan, interview, acceptance criteria, debug environment, coding, verification, commit. Commits and pushes happen only with a human's explicit consent.

## License

MIT – see [LICENSE](LICENSE). Copyright 2026 Robert-AI-Development.
