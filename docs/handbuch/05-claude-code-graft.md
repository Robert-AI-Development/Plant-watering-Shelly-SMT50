# 5 · Claude Code & graft — aufbau & verwendung / structure & usage

**Sprache / Language:** [Deutsch](#deutsch) · [English](#english) — [Handbuch-Index](README.md)

---

## Deutsch

Dieses Kapitel erklärt die beiden Werkzeuge, mit denen das Projekt entwickelt wird: **Claude Code** (der
KI-Programmierer) und **graft** (ein Code-Index, der der KI hilft, sich im Projekt zurechtzufinden). Ziel: Du
verstehst, wie das Repo aufgebaut ist, und kannst das Projekt „out of the box" mit der KI weiterbauen.

### Schnellstart

```bash
cd Plant-watering-Shelly-SMT50
claude                       # KI-Sitzung starten (siehe Kapitel 4)

# Nützliche Claude-Code-Kommandos in der Sitzung:
/help                        # Übersicht
# Einfach auf Deutsch fragen, z. B.:
#   "führe npm test aus und fasse das Ergebnis zusammen"
#   "erkläre, wie bw_main die Pause berechnet"
#   "füge ein cfg-Feld für die minimale Nachtpause hinzu"

# graft direkt auf der Shell (falls installiert):
graft ask "wie berechnet bw_main die Dosis?" --source
graft skeleton scripts/bw_main.js
graft grep "KVS.Set"
```

### Was ist Claude Code?

Claude Code ist ein KI-Assistent für die Kommandozeile, der in deinem Projektordner arbeitet: Dateien lesen und
ändern, Befehle ausführen (Tests, git), recherchieren und mehrstufige Aufgaben erledigen. Er richtet sich nach
Konfigurations- und Anleitungsdateien im Repo:

| Datei / Ordner | Rolle |
| --- | --- |
| [`../../CLAUDE.md`](../../CLAUDE.md) | Projekt-Anleitung **speziell für Claude Code**: Aufbau, Befehle, **harte Regeln** für die Shelly-Scripts |
| [`../../AGENTS.md`](../../AGENTS.md) | Anleitung für **alle** KI-Agenten (herstellerübergreifend), inkl. **Zustimmungsregel für Commits** |
| `.claude/` | Einstellungen (`settings.json`), Skills, Helfer. `settings.local.json` ist **persönlich/gitignoriert** (z. B. Sandbox-Freigaben) |
| `.mcp.json` | Meldet den `graft`-MCP-Server an, damit die KI graft nutzen kann |

**Plan-Modus:** Für größere Aufgaben plant Claude Code zuerst und holt deine Freigabe, bevor er ändert – ideal,
um Umfang und Vorgehen abzustimmen. **Permissions/Sandbox:** Claude Code fragt vor heiklen Aktionen nach; welche
Netzwerkziele (z. B. dein Shelly) erlaubt sind, steht in `.claude/settings.local.json` – siehe
[Kapitel 6](06-shelly-remote-debug.md).

> **Wichtig für die Zusammenarbeit:** Ein Agent darf Änderungen erarbeiten, testen und vorbereiten, aber
> **Commit und Push brauchen deine ausdrückliche Zustimmung als Mensch.** Diese Regel steht in
> [`../../AGENTS.md`](../../AGENTS.md).

### Was ist graft?

Damit die KI nicht bei jeder Frage ganze Dateien lesen muss, ist das Repo mit **graft** indexiert: ein Graph aller
Symbole (Funktionen, Variablen) mit genauer `Datei:Zeile`-Angabe und den Aufrufbeziehungen („wer ruft was auf").
Der Index liegt unter `graft/` (gitignored, wird automatisch aktualisiert) und ist auch als MCP-Werkzeug
verfügbar. Typische Kommandos:

- `graft ask "…" --source` – „Wie funktioniert X / wo liegt Y" – liefert die relevanten Stellen mit Code.
- `graft grep "text"` – findet **jedes** Vorkommen, gruppiert nach Funktion.
- `graft skeleton <datei>` – die ganze API einer Datei in ~200 Tokens (alle Signaturen).
- `graft callers <symbol>` – wer ruft ein Symbol auf (wichtig vor Umbenennungen/Änderungen).
- `graft check` – prüft, ob der Index zum aktuellen Code passt.

**Faustregel:** erst graft fragen, dann gezielt die genannte Stelle öffnen. Das spart Zeit (und bei der KI:
Kontext/Kosten). Details: [`.claude/skills/graft/SKILL.md`](../../.claude/skills/graft/SKILL.md).

### Repo-Aufbau auf einen Blick

```
scripts/     bw_install.js, bw_main.js, bw_pump.js  ← laufen auf dem Shelly
             lib_notes.md  ← jede genutzte Shelly-RPC dokumentiert
tools/       mock/ (Gerät in Node), run-script.js, build.js, put-script.js,
             console.js, probe/  ← Entwicklung & Geräte-Debug
tools/test/  node --test (89 Tests, inkl. 7-Tage-Simulation)
docs/        PLAN.md (Entscheidungen), handbuch/ (dieses Handbuch), seo-keywords.md
hardware/    Stückliste, Verdrahtung
README.md · CLAUDE.md · AGENTS.md · LEARNING.md
```

### So baust du das Projekt weiter

1. Sitzung starten: `claude`. 2. Aufgabe auf Deutsch beschreiben. 3. Bei größeren Änderungen den **Plan** prüfen
und freigeben. 4. Die KI ändert Code + Tests. 5. **`npm test` muss grün bleiben.** 6. Neue Design-Entscheidungen in
[`../PLAN.md`](../PLAN.md), Geräte-Erfahrungen in [`../../LEARNING.md`](../../LEARNING.md) festhalten. 7. Commit/Push
**erst nach deiner Freigabe**. Der komplette Beitrags-Workflow steht in [Kapitel 7](07-mitwirken-tests.md).

---

## English

This chapter explains the two tools the project is developed with: **Claude Code** (the AI programmer) and
**graft** (a code index that helps the AI navigate the project). Goal: you understand how the repo is structured
and can keep extending the project with the AI out of the box.

### Quick start

```bash
cd Plant-watering-Shelly-SMT50
claude                       # start the AI session (see chapter 4)

# Useful Claude Code commands in the session:
/help                        # overview
# Just ask in plain language, e.g.:
#   "run npm test and summarise the result"
#   "explain how bw_main computes the pause"
#   "add a cfg field for a minimum night pause"

# graft on the shell directly (if installed):
graft ask "how does bw_main compute the dose?" --source
graft skeleton scripts/bw_main.js
graft grep "KVS.Set"
```

### What is Claude Code?

Claude Code is a command-line AI assistant that works in your project folder: reading and editing files, running
commands (tests, git), researching and doing multi-step tasks. It follows configuration and guidance files in the
repo:

| File / folder | Role |
| --- | --- |
| [`../../CLAUDE.md`](../../CLAUDE.md) | Project guide **specifically for Claude Code**: structure, commands, **hard rules** for the Shelly scripts |
| [`../../AGENTS.md`](../../AGENTS.md) | Guide for **all** AI agents (vendor-neutral), incl. the **commit consent rule** |
| `.claude/` | Settings (`settings.json`), skills, helpers. `settings.local.json` is **personal/gitignored** (e.g. sandbox allowlists) |
| `.mcp.json` | Registers the `graft` MCP server so the AI can use graft |

**Plan mode:** for larger tasks Claude Code plans first and asks for your approval before changing anything – ideal
to agree on scope and approach. **Permissions/sandbox:** Claude Code asks before sensitive actions; which network
targets (e.g. your Shelly) are allowed lives in `.claude/settings.local.json` – see
[chapter 6](06-shelly-remote-debug.md).

> **Important for collaboration:** an agent may work out, test and prepare changes, but **commit and push require
> your explicit human consent.** This rule is in [`../../AGENTS.md`](../../AGENTS.md).

### What is graft?

So the AI need not read whole files for every question, the repo is indexed with **graft**: a graph of all symbols
(functions, variables) with exact `file:line` locations and the call relationships ("who calls what"). The index
lives under `graft/` (gitignored, auto-updated) and is also available as an MCP tool. Typical commands:

- `graft ask "…" --source` – "how does X work / where is Y" – returns the relevant spots with code.
- `graft grep "text"` – finds **every** occurrence, grouped by function.
- `graft skeleton <file>` – a file's whole API in ~200 tokens (all signatures).
- `graft callers <symbol>` – who calls a symbol (important before renames/changes).
- `graft check` – verifies the index matches the current code.

**Rule of thumb:** ask graft first, then open the exact spot it names. Saves time (and for the AI: context/cost).
Details: [`.claude/skills/graft/SKILL.md`](../../.claude/skills/graft/SKILL.md).

### Repo layout at a glance

See the tree in the German section above. In short: `scripts/` runs on the Shelly, `tools/` holds development and
device-debug tooling plus the Node mock, `docs/` holds decisions and this handbook, `hardware/` the wiring.

### How to keep building

1. Start a session: `claude`. 2. Describe the task in plain language. 3. For larger changes, review and approve the
**plan**. 4. The AI edits code + tests. 5. **`npm test` must stay green.** 6. Record new design decisions in
[`../PLAN.md`](../PLAN.md), on-device lessons in [`../../LEARNING.md`](../../LEARNING.md). 7. Commit/push **only
after your approval**. The full contribution workflow is in [chapter 7](07-mitwirken-tests.md).
