# Handbuch – Pflanzenbewässerung mit dem Shelly Plus Uni

**Deutsch** · [English](../en/README.md) — [Startseite](../index.md) · [Repository](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50)

Selbstlernende Bewässerung für eine Pflanze: ein Shelly Plus Uni misst Bodenfeuchte (SMT50), Temperatur (DS18B20) und Wasserstand, gießt in Portionen mit Nachmessen und lernt, wie viel Feuchte eine Pumpensekunde bringt. Alles läuft lokal auf dem Gerät, ohne Cloud. Dieses Handbuch ist in sechs Teile gegliedert; jedes Kapitel hat ein interaktives Diagramm.

> **Stand**
> - Projektversion <!-- fact:project.version -->0.2.0<!-- /fact --> · Scripts bw_main <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, bw_pump <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, bw_install <!-- fact:ver.bw_install -->0.1.3<!-- /fact -->, bw_zeitraffer <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact -->
> - Tests im Mock: <!-- fact:tests -->146<!-- /fact --> · Kompakt-Ausgabe bw_pump <!-- fact:dist.bw_pump -->17475<!-- /fact --> B (Grenze <!-- fact:size_limit_pump -->18000<!-- /fact -->), übrige Scripts unter <!-- fact:size_limit -->16000<!-- /fact --> B
> - Letzter Gerätelauf: 13.09.2026 (Regelkreis-Fenster im Zeitraffer, Kalibrierwerte geschrieben) – Kapitel 19

## Leserpfade

- **Einsteiger:** 05 Verkabelung → 06 Startanleitung → 07 oder 08 Installation → 12 Erstinbetriebnahme → 13 Betrieb
- **Maker:** 01 Architektur → 02 Flussdiagramm → 03 Konfiguration → 14 Debuggen → 15 Ausbau
- **KI-Agent:** [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) → 15 Ausbau → 17 Entscheidungslog → 18 Lernlog → 20 RPC-Referenz

## Kapitel

Diagramme: jedes Kapitel zeigt ein statisches Bild und verlinkt die interaktive Fassung (Zoom, Suche, Fokus auf ein Element, Beziehungs-Trace, Story-Kapitel, Hell/Dunkel). Die Bedienoberfläche der Diagramme ist Englisch (Werkzeuggrenze), die Beschriftung Deutsch.

### Teil A – Verstehen

| Nr | Kapitel | Für wen | Ergebnis | Diagramm |
| --- | --- | --- | --- | --- |
| 01 | [Gesamtarchitektur](01-gesamtarchitektur.md) | Einsteiger, Maker | Bauteile, sechs Scripts, Zeitplan und KVS in fünf Minuten verstehen | [interaktiv](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/01-gesamtarchitektur.html) |
| 02 | [Flussdiagramm: Takt, Auftrag, Fenster, Kontrolle, Pause](02-flussdiagramm.md) | Betreiber, Maker | Wissen, was das Gerät an einem Tag tut und warum es gerade nicht gießt | [interaktiv](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/02-flussdiagramm.html) |
| 03 | [Konfigurations-Zusammenspiel (Parameter-Referenz)](03-konfiguration.md) *(im Aufbau)* | Alle, die ein Feld ändern | Jedes Feld: wer liest es, was bewirkt es, wann muss der Installer neu laufen | – |
| 04 | [Sicherheit und Grenzen](04-sicherheit-und-grenzen.md) | Alle vor dem Aufbau | Warum die Pumpe nie durchläuft und wo Shelly und SMT50 an Grenzen stoßen | [interaktiv](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/04-sicherheit-und-grenzen.html) |

### Teil B – Aufbauen

| Nr | Kapitel | Für wen | Ergebnis | Diagramm |
| --- | --- | --- | --- | --- |
| 05 | [Verkabelung und Hardware-Aufbau](05-verkabelung-und-aufbau.md) *(im Aufbau)* | Bastler mit Lötkolben | Web-UI zeigt Spannung, Temperatur und Eingangswechsel | – |

### Teil C – Installieren

| Nr | Kapitel | Für wen | Ergebnis | Diagramm |
| --- | --- | --- | --- | --- |
| 06 | [Schritt-für-Schritt-Startanleitung](06-startanleitung.md) *(im Aufbau)* | Alle | Vom verdrahteten Gerät zum ersten Gießfenster, Wegwahl zu den Installationsarten | – |
| 07 | [Installation per Hand (Web-UI, Copy & Paste)](07-installation-per-hand.md) *(im Aufbau)* | Ohne Node, ohne Terminal | Scripts aus dist/ eingefügt, Byte-Prüfung bestanden, Installer gelaufen | – |
| 08 | [Installation mit lokalem Server (PC oder Raspberry im LAN)](08-installation-lokaler-server.md) *(im Aufbau)* | Node ≥ 22 im selben Netz | Upload, Prüfung und Installer mit den Werkzeugen direkt gegen die IP | – |
| 09 | [Installation mit VPS-Server (SSH-Rückwärtstunnel)](09-installation-vps.md) *(im Aufbau)* | Arbeit auf einem Server | Shelly zuhause über 127.0.0.1:8010 erreichbar, Werkzeuge und Claude Code auf dem VPS | – |
| 10 | [Installation mittels Claude Code](10-installation-claude-code.md) *(im Aufbau)* | KI soll führen | Installation im Interview: was Claude tut, was der Mensch entscheidet | – |

### Teil D – Betreiben

| Nr | Kapitel | Für wen | Ergebnis | Diagramm |
| --- | --- | --- | --- | --- |
| 11 | [Hardware-Check (bw_hwtest, bw_hwpump)](11-hardware-check.md) *(im Aufbau)* | Nach der Installation | Sensoren, Schwimmer und Pumpe geprüft, cfg1 gemessen | – |
| 12 | [Erstinbetriebnahme: Kalibrierung, Zielband, Zeitraffer, erstes Fenster](12-erstinbetriebnahme.md) *(im Aufbau)* | Nach dem Hardware-Check | Werte, mit denen das Gerät richtig gießt; einmal alles in 45 Minuten gesehen | – |
| 13 | [Betrieb und Wartung](13-betrieb-und-wartung.md) *(im Aufbau)* | Betreiber im Alltag | Ablesen, Codes deuten, Störung beheben, aktualisieren, warten, verreisen | – |

### Teil E – Erweitern

| Nr | Kapitel | Für wen | Ergebnis | Diagramm |
| --- | --- | --- | --- | --- |
| 14 | [Debuggen und Testen](14-debuggen-und-testen.md) *(im Aufbau)* | Entwickler, Agenten | Mock, Tests, Build, Upload und Konsole; vollständige Werkzeug-Referenz | – |
| 15 | [Ausbau der Steuerung mit Claude Code](15-ausbau-mit-claude-code.md) *(im Aufbau)* | Wer erweitern will | Plan, Interview, Prüfkriterien, Debug-Umgebung, Coding, Prüfung, Commit | – |

### Teil F – Entwicklung

| Nr | Kapitel | Für wen | Ergebnis | Diagramm |
| --- | --- | --- | --- | --- |
| 16 | [Konzept und Entscheidungen (Stand 0.2.0)](16-konzept-und-entscheidungen.md) *(im Aufbau)* | Wer das Warum sucht | Bauprinzipien, Regelungskern, verworfene Alternativen, Ausbaustufen | – |
| 17 | [Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md) *(im Aufbau)* | Agenten, Entwickler | Was wann warum entschieden wurde; Nummern 1–63 bleiben stabil; offene Punkte | – |
| 18 | [Lernlog vom Gerät](18-lernlog-geraet.md) *(im Aufbau)* | Wer eine Überraschung einordnet | Jeder Gerätefund mit Symptom, Ursache, Fix und Regel im Test | – |
| 19 | [Prüfprotokoll am Gerät](19-pruefprotokoll.md) *(im Aufbau)* | Wer Messwerte braucht | Was am echten Aufbau gemessen wurde; Vorlage für den nächsten Lauf | – |
| 20 | [RPC- und Engine-Referenz](20-rpc-referenz.md) *(im Aufbau)* | Wer einen RPC einbaut | Jede genutzte RPC mit Parametern, Antwort und Doku-Link; Engine-Fakten mit Messdatum | – |
| 21 | [SEO und Keywords](21-seo-keywords.md) *(im Aufbau)* | Wer das Projekt auffindbar macht | Keyword-Cluster, Platzierung, GitHub-Topics | – |

## Konventionen

- `<ip>` steht für die Adresse des Shelly, z. B. `192.168.88.10` im LAN oder `127.0.0.1:8010` über den SSH-Tunnel (Kapitel 09).
- Script-IDs vergibt das Gerät; `node tools/hwtest.js <ip> scripts` zeigt sie. Beispiele nennen die IDs des Referenzgeräts (1 = bw_install, 2 = bw_main, 3 = bw_pump, 7 = bw_zeitraffer).
- Konsolenzeilen, KVS-Felder und Störungscodes sind Deutsch und werden nie übersetzt; das englische Handbuch erklärt sie im Glossar.
- `[TODO am Gerät]` markiert Aussagen, die noch am echten Aufbau zu messen sind.
- Zahlen in den Kapiteln stammen aus den Scripts (`bw_install.js` DEF, `bw_zeitraffer.js` ZR3/ZR4) und den datierten Protokollen; `npm run docs:check` prüft sie.

## Glossar

| Begriff | Bedeutung |
| --- | --- |
| Takt | Lauf von `bw_main` alle `tick` Minuten (Standard 15): messen, bewerten, Auftrag schreiben |
| Fenster | Lauf von `bw_pump` zu den Gießzeiten (`winA`/`winB`, Sekunde 30): Frischmessung, Portionen, Lernen |
| Portion | ein Einschalten der Pumpe mit `toggle_after`; ein Fenster hat bis zu `nPort` Portionen |
| Gabe | die Summe der Portionen eines Fensters |
| Auftrag (`job`) | Übergabe von `bw_main` an `bw_pump`: `ok`, `sec`, `pct`, `why` |
| Kontrolle | Nachmessung durch `bw_main` `soak` Minuten nach dem Fenster |
| Pause / Sperre | Mindestabstand zwischen Gaben (`pause`, `pauseHot`, `pauseSlow`), Zustand `st.state = "sperre"` |
| Trockenphase | keine Gabe ab dem Trockentag (`dryDay`) oder nach Nässe (`> pctHi`), bis die Feuchte unter `pctDry` liegt |
| Zielband | `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` in Prozent Bodenfeuchte |
| Zeitraffer | dieselben Scripts mit kurzen Zeiten (Takt 3 min, Fenster alle 6 min) für einen 45-Minuten-Test |
| Messlauf / Kalibrierlauf | Werkzeuge `hwtest.js mess` und `kal`: Wirkung eines Pumpenpulses messen, Lernwerte ableiten |
| Frist | Zeit, die `bw_pump` im Fenster bis zum nächsten Takt hat (`tWin`, `tTail`) |
| Claim | `st.why = "laeuft"`: Markierung eines laufenden Fensters im KVS (abbruchsicher) |
| Störung (`err`) | Blockierender oder informierender Code, z. B. `wasser`, `noeff`, `cfg` |
