# Handbuch · Handbook

**Sprache / Language:** [Deutsch](#deutsch) · [English](#english)

Ein Handbuch für die **selbstlernende Pflanzenbewässerung mit dem Shelly Plus Uni** – vom Aufbau der Hardware
über die Installation bis zum Weiterentwickeln mit KI (Claude Code). Aufgebaut wie ein Handbuch: Kapitel für
Kapitel, jedes zweisprachig (Deutsch und English), jeweils mit ausführlicher Erklärung **und** einem
`Schnellstart`-Kasten mit Copy-&-Paste-Befehlen.

---

## Deutsch

### Für wen ist das?

- **Anfänger:** Du willst Pflanzen automatisch gießen (auch **im Urlaub**), hast einen Shelly und einen
  Bodenfeuchtesensor – folge den Kapiteln 1–3 der Reihe nach.
- **Fortgeschrittene / Maker:** Du willst das System verstehen, anpassen oder erweitern – Kapitel 4–7 zeigen,
  wie man auf einem eigenen Server mit **Claude Code** weiterprogrammiert und den Shelly **live debuggt**.

### Kapitel

| # | Kapitel | Inhalt |
| --- | --- | --- |
| 1 | [Einführung & Architektur](01-einfuehrung.md) | Was das Projekt kann, warum es **ohne Cloud** läuft, wie die drei Scripts zusammenspielen |
| 2 | [Hardware & Verdrahtung](02-hardware-verdrahtung.md) | Stückliste, SMT50, DS18B20, Schwimmerschalter, Anschluss |
| 3 | [Installation am Gerät](03-installation.md) | Scripts aufspielen, KVS, Kalibrierung, Zielband eintragen |
| 4 | [Auf eigenem VPS mitentwickeln](04-vps-mitentwickeln.md) | Hostinger-VPS, SSH, Node, `git clone`, Claude Code starten |
| 5 | [Claude Code & graft](05-claude-code-graft.md) | Aufbau und Verwendung des KI-Editors und des Code-Index |
| 6 | [Shelly per Remote live debuggen](06-shelly-remote-debug.md) | **Kernstück:** KI debuggt echte Hardware über einen MobaXterm-Tunnel |
| 7 | [Mitwirken & Tests](07-mitwirken-tests.md) | Mock, Tests, Regeln, Beiträge – auch für KI-Agenten ([`AGENTS.md`](../../AGENTS.md)) |

### Wo liegt was?

- Projektübersicht und alle Feld-/Störungstabellen: [`../../README.md`](../../README.md)
- Design-Entscheidungen: [`../PLAN.md`](../PLAN.md) · Gerät-Erfahrungen: [`../../LEARNING.md`](../../LEARNING.md)
- Regeln für KI-Agenten: [`../../AGENTS.md`](../../AGENTS.md) · für Claude Code speziell: [`../../CLAUDE.md`](../../CLAUDE.md)
- SEO/Keyword-Analyse: [`../seo-keywords.md`](../seo-keywords.md)

---

## English

### Who is this for?

- **Beginners:** you want to water plants automatically (even **while on vacation**), you have a Shelly and a
  soil-moisture sensor – follow chapters 1–3 in order.
- **Advanced / makers:** you want to understand, adapt or extend the system – chapters 4–7 show how to keep
  developing on your own server with **Claude Code** and how to **live-debug** the Shelly.

### Chapters

| # | Chapter | Content |
| --- | --- | --- |
| 1 | [Introduction & architecture](01-einfuehrung.md) | What it does, why it runs **cloud-free**, how the three scripts work together |
| 2 | [Hardware & wiring](02-hardware-verdrahtung.md) | Bill of materials, SMT50, DS18B20, float switch, connections |
| 3 | [Installation on the device](03-installation.md) | Upload scripts, KVS, calibration, target band |
| 4 | [Develop on your own VPS](04-vps-mitentwickeln.md) | Hostinger VPS, SSH, Node, `git clone`, run Claude Code |
| 5 | [Claude Code & graft](05-claude-code-graft.md) | How the AI editor and the code index are built and used |
| 6 | [Live-debug the Shelly remotely](06-shelly-remote-debug.md) | **Core:** the AI debugs real hardware through a MobaXterm tunnel |
| 7 | [Contributing & tests](07-mitwirken-tests.md) | Mock, tests, rules, contributions – incl. AI agents ([`AGENTS.md`](../../AGENTS.md)) |

### Where things live

- Project overview and all field/error tables: [`../../README.md`](../../README.md)
- Design decisions: [`../PLAN.md`](../PLAN.md) · on-device lessons: [`../../LEARNING.md`](../../LEARNING.md)
- Rules for AI agents: [`../../AGENTS.md`](../../AGENTS.md) · Claude-Code specific: [`../../CLAUDE.md`](../../CLAUDE.md)
- SEO/keyword analysis: [`../seo-keywords.md`](../seo-keywords.md)
