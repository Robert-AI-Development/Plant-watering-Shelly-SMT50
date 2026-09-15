# Selbstlernende Pflanzenbewässerung mit Shelly Plus Uni & SMT50 – DIY Smart Home ohne Cloud

> Ein Shelly Plus Uni misst Bodenfeuchte, Temperatur und Wasserstand, gießt in Portionen mit Nachmessen und lernt, wie viel Feuchte eine Pumpensekunde bringt. Lokal, ohne Cloud, ideal für den Urlaub – programmiert und am Gerät live debuggt mit Claude Code.

**English:** [README.en.md](README.en.md) · **Handbuch:** [Deutsch](docs/de/README.md) · [English](docs/en/README.md) · **Online:** [robert-ai-development.github.io/Plant-watering-Shelly-SMT50](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/)

![Lizenz MIT](https://img.shields.io/badge/Lizenz-MIT-green) ![Shelly](https://img.shields.io/badge/Shelly-Plus%20Uni-orange)

Stand: Version <!-- fact:project.version -->0.2.0<!-- /fact --> · bw_main <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, bw_pump <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, bw_install <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> · letzter Gerätelauf 13.09.2026.

## Was es tut

Alle 15 Minuten misst das Script `bw_main` die Bodenfeuchte (SMT50 am Analogeingang), die Temperatur (DS18B20) und den Wasserstand (Schwimmer) und schreibt einen Gießauftrag ins KVS des Geräts. Zu zwei Uhrzeiten am Tag misst `bw_pump` frisch, gießt in Portionen mit Nachmessen bis ins Zielband und lernt die Wirkung je Pumpensekunde. Ein Installer legt Zeitplan und Startwerte an. Nichts läuft dauerhaft, nichts liegt im RAM, nichts geht in die Cloud.

[![Gesamtarchitektur: Sensoren, Scripts, Zeitplan, KVS](docs/diagramme/de/01-gesamtarchitektur.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/01-gesamtarchitektur.html)

Interaktive Fassung mit Story-Kapiteln, Fokus und Beziehungs-Trace: [Diagramm öffnen](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/01-gesamtarchitektur.html) · alle Diagramme: [docs/diagramme](docs/diagramme/README.md)

## Auf einen Blick

- **Ohne Cloud:** Zeitplan, Scripts und Gedächtnis (KVS) liegen auf dem Shelly; nur die Uhrzeit kommt per NTP.
- **Lernt:** Wirkung in Prozent Feuchte je wirksame Pumpensekunde (`lrn.effW`), Sicherheitsfaktor startet vorsichtig bei 0,7.
- **Portionen mit Nachmessen:** erst Frischmessung, dann Portion, einsickern, stabil messen, bei Bedarf Korrekturportion; Ziel erreicht → fertig.
- **Dreifache Abschaltung:** `toggle_after` je Portion, `auto_off` 190 s am Ausgang, Sicherheits-Aus im Zeitplan 8 Minuten nach dem Fenster.
- **Mit KI gebaut:** Mock, <!-- fact:tests -->146<!-- /fact --> Tests, Werkzeuge für Upload, Konsole, Zeitraffer und Kalibrierung; Claude Code führt Installation und Erweiterungen im Interview.

## Schnellstart

```bash
git clone https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50.git && cd Plant-watering-Shelly-SMT50
npm test                                              # Tests gegen den Mock, keine Abhängigkeiten
npm run build                                         # dist/ (Kompakt-Ausgabe, auch eingecheckt)
node tools/put-script.js <ip> <id> dist/bw_main.js    # Upload je Script, byteidentisch geprüft
node tools/verify-scripts.js <ip>                     # alle Scripts am Gerät gegen dist/ vergleichen
node tools/hwtest.js <ip> normal 60                   # Installer: Zeitplan, Startwerte, auto_off
```

Danach das Zielband eintragen und das erste Fenster mitlesen: [Kapitel 06 Startanleitung](docs/de/06-startanleitung.md) · ohne Node per Web-UI: [Kapitel 07](docs/de/07-installation-per-hand.md).

## Handbuch

| Teil | Kapitel |
| --- | --- |
| A Verstehen | [01 Gesamtarchitektur](docs/de/01-gesamtarchitektur.md) · [02 Flussdiagramm](docs/de/02-flussdiagramm.md) · [03 Konfiguration](docs/de/03-konfiguration.md) · [04 Sicherheit und Grenzen](docs/de/04-sicherheit-und-grenzen.md) |
| B Aufbauen | [05 Verkabelung und Hardware-Aufbau](docs/de/05-verkabelung-und-aufbau.md) |
| C Installieren | [06 Startanleitung](docs/de/06-startanleitung.md) · [07 per Hand](docs/de/07-installation-per-hand.md) · [08 lokaler Server](docs/de/08-installation-lokaler-server.md) · [09 VPS](docs/de/09-installation-vps.md) · [10 Claude Code](docs/de/10-installation-claude-code.md) |
| D Betreiben | [11 Hardware-Check](docs/de/11-hardware-check.md) · [12 Erstinbetriebnahme](docs/de/12-erstinbetriebnahme.md) · [13 Betrieb und Wartung](docs/de/13-betrieb-und-wartung.md) |
| E Erweitern | [14 Debuggen und Testen](docs/de/14-debuggen-und-testen.md) · [15 Ausbau mit Claude Code](docs/de/15-ausbau-mit-claude-code.md) |
| F Entwicklung | [16 Konzept und Entscheidungen](docs/de/16-konzept-und-entscheidungen.md) · [17 Etappen- und Entscheidungslog](docs/de/17-etappen-und-entscheidungslog.md) · [18 Lernlog vom Gerät](docs/de/18-lernlog-geraet.md) · [19 Prüfprotokoll](docs/de/19-pruefprotokoll.md) · [20 RPC-Referenz](docs/de/20-rpc-referenz.md) · [21 SEO](docs/de/21-seo-keywords.md) |

## Sicherheit

> **Achtung (Wasser/Strom):** Die 230-V-Seite von Pumpe oder Trafo gehört in die Hand einer Elektrofachkraft. Der Shelly-Ausgang schaltet nur ein Relais (Kontakt ≤ 30 V / 300 mA). Wasser, Behälter und Schlauch bleiben räumlich getrennt von Shelly und Netzteil. Details: [Kapitel 04](docs/de/04-sicherheit-und-grenzen.md).

## Mitmachen

Regeln für Menschen und KI-Agenten stehen in [AGENTS.md](AGENTS.md) und [CLAUDE.md](CLAUDE.md). Erweiterungen laufen nach dem Prozess in [Kapitel 15](docs/de/15-ausbau-mit-claude-code.md): Plan, Interview, Prüfkriterien, Debug-Umgebung, Coding, Prüfung, Commit. Commit und Push gibt es nur mit ausdrücklicher Zustimmung eines Menschen.

## Lizenz

MIT – siehe [LICENSE](LICENSE). Copyright 2026 Robert-AI-Development.
