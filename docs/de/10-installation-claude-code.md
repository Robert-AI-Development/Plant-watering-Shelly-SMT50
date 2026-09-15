# 10 · Installation mittels Claude Code

**Deutsch** · [English](../en/10-installation-claude-code.md) — [Handbuch](README.md) · Teil C „Installieren“

> **Auf einen Blick**
> - Claude Code führt die Schritte aus Kapitel 06 selbst aus – bauen, hochladen, byteidentisch prüfen, Installer starten – und fragt dich vor jeder Entscheidung.
> - Umfang: ein Prompt, acht Schritte im Interview, drei Entscheidungen bei dir (Script-Namen, Zielband, Freigabe von Commit und Push).
> - Erwartetes Ergebnis: `verify-scripts` meldet „4 Scripts mit dist/ verglichen, alle byteidentisch“, `normal 60` endet mit „NORMALBETRIEB“; das größte Script `bw_pump` hat in `dist/` <!-- fact:dist.bw_pump -->17475<!-- /fact --> Byte.
> - Größter Stolperstein: die Sandbox von Claude Code blockt den Netzwerkzugriff auf den Shelly, bis seine Adresse in `.claude/settings.local.json` steht.

## Voraussetzungen

- Ein Rechner mit Zugriff auf den Shelly nach [08 · Installation mit lokalem Server](08-installation-lokaler-server.md) (`<ip>` ist die LAN-Adresse, z. B. `192.168.88.10`) oder [09 · Installation mit VPS-Server](09-installation-vps.md) (`<ip>` ist `127.0.0.1:8010` durch den Tunnel).
- Node ≥ 22, das Repo geklont, `npm test` grün (<!-- fact:tests -->146<!-- /fact --> Tests); keine weiteren Abhängigkeiten.
- Ein Anthropic-Konto für die Anmeldung von Claude Code beim ersten Start.
- Das Gerät ist vorbereitet wie in [06 · Startanleitung](06-startanleitung.md) Schritt 1: Voltmeter und DS18B20 als Peripherie, Eingang 1 als Switch, Debug-Websocket an (Web-UI → Scripts → Konsole öffnen).
- Die drei Betriebs-Scripts `bw_install`, `bw_main`, `bw_pump` existieren am Gerät mit exakt diesen Namen – oder du lässt sie in Frage 1 anlegen. `bw_zeitraffer` legt `preflight` selbst an.

## Diagramm

[![Installation im Interview: Mensch, Claude, Werkzeuge, Gerät](../diagramme/de/10-installation-claude-code.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/10-installation-claude-code.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/10-installation-claude-code.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Rollen“, 2 „Freigaben“, 3 „Ergebnis prüfen“.

## Claude Code installieren und starten

Claude Code ist der KI-Assistent für die Kommandozeile, mit dem dieses Projekt gebaut wurde. Er arbeitet in deinem Projektordner: liest und ändert Dateien, führt Befehle aus (Tests, Werkzeuge, git) und erledigt mehrstufige Aufgaben – bei diesem Projekt bis hin zum Shelly, den er über die Werkzeuge in `tools/` per RPC erreicht.

```bash
npm install -g @anthropic-ai/claude-code   # einmalig; Node ≥ 22 ist für die Werkzeuge ohnehin da
cd Plant-watering-Shelly-SMT50             # immer im Projektordner starten – nur dort liest Claude CLAUDE.md
claude                                     # erste Sitzung: Anmeldung mit dem Anthropic-Konto
```

In der Sitzung zeigt `/help` die Kommandos; alles andere schreibst du auf Deutsch, zum Beispiel „führe npm test aus und fasse das Ergebnis zusammen“ oder „erkläre, wie `bw_main` die Pause berechnet“.

## Was Claude im Repo liest

Claude Code richtet sich nach Anleitungs- und Konfigurationsdateien im Repo. Deshalb muss die Sitzung im Projektordner starten – sonst kennt die KI weder die harten Regeln der Shelly-Scripts noch den Ablauf am Gerät.

| Datei / Ordner | Rolle bei der Installation |
| --- | --- |
| [`CLAUDE.md`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) | Projektanleitung nur für Claude Code: Aufbau, Befehle, harte Regeln der Shelly-Scripts, Arbeitsweise am Gerät (Upload, `verify-scripts`, `normal`, Zeitraffer) |
| [`AGENTS.md`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/AGENTS.md) | Anleitung für alle KI-Agenten, herstellerübergreifend; enthält die Zustimmungsregel für Commit und Push |
| `.claude/settings.json` | eingecheckt: Hooks und Statuszeile für graft, vorab erlaubte `graft`-Befehle – sonst nichts |
| `.claude/settings.local.json` | persönlich, gitignoriert: Sandbox-Freigabe für das Netz (die Adresse deines Shelly) und deine dauerhaften Befehlsfreigaben |
| `.claude/skills/graft/` | Skill: wie Claude den Code-Index graft befragt |
| `.mcp.json` | meldet den MCP-Server `graft mcp` an |

### graft ist optional

Der Code-Index graft (`graft/`, gitignoriert) lässt Claude Codefragen mit `graft ask "…" --source`, `graft grep`, `graft skeleton <datei>` und `graft callers <symbol>` in Sekunden beantworten, statt ganze Dateien zu lesen. Für die Installation braucht es ihn nicht: Fehlt graft, laufen die Hooks aus `.claude/settings.json` leer (`graft-hooks.cjs` fängt den fehlgeschlagenen Import still ab und tut nichts) und Claude liest die Dateien direkt.

Wer ihn will, installiert das Paket `@nanonets/graft` global per npm und baut den Index im Projektordner mit `graft build`; `graft check` prüft später, ob der Index zum Code passt. Kommandos und Beispiele: [14 · Debuggen und Testen](14-debuggen-und-testen.md) und [`.claude/skills/graft/SKILL.md`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/.claude/skills/graft/SKILL.md).

## Der Installations-Dialog als Interview

Die Installation ist ein Interview: Claude bedient die Werkzeuge, liest ihre Ausgaben und stellt dir genau die Fragen, die ein Werkzeug nicht beantworten kann. Die Reihenfolge ist dieselbe wie in Kapitel 06 – bauen, Scripts anlegen, hochladen, prüfen, Zielband, Installer, Zeitplan prüfen; im Interview steht davor nur die Vorprüfung mit `preflight`.

### Prompt-Vorlage

```text
Installiere die Scripts auf <ip>. Lies Script-Namen und IDs mit preflight vom Gerät, frage mich, welche fehlenden Scripts angelegt werden sollen, und nach dem Zielband, bevor du am Gerät schreibst.
Ablauf: hwtest.js preflight → npm run build → put-script.js je Script → verify-scripts.js (byteidentisch) → cfg2 → hwtest.js normal 60 → erste Konsolenzeile zeigen.
Nichts committen.
```

### Die Schritte

| Schritt | Claude ruft auf | Was du siehst oder entscheidest |
| --- | --- | --- |
| 1 Vorprüfung | `node tools/hwtest.js <ip> preflight` | Uhrzeit (NTP), Sekunden bis zum Takt, Scripts mit IDs, Eingang 1, Ausgang, Debug-Websocket; legt `bw_zeitraffer` an und nennt dafür den Upload-Befehl; die IDs der drei Betriebs-Scripts stehen in der Zeile „Scripts: …“. Ein „BLOCKER“ (z. B. „Input 1 (Wasserstand) ist deaktiviert“) muss weg, bevor es weitergeht. |
| 2 Bauen | `npm run build` | sechs Dateien in `dist/` mit Byte-Zahl; nur `dist/` geht aufs Gerät, `scripts/` ist die Quelle. |
| 3 Frage 1 | – | Claude nennt die gefundenen Scripts und fragt, ob fehlende Betriebs-Scripts angelegt werden sollen (Web-UI → Scripts → Add script, oder per RPC `Script.Create` mit dem exakten Namen). Die IDs vergibt das Gerät; Claude liest sie aus `Script.List` und rät sie nie. |
| 4 Hochladen | `node tools/put-script.js <ip> <id> dist/<name>.js` – viermal | je Script „… Byte in n Stücken gesendet … OK, byteidentisch; fs_free a → b“. Das Werkzeug prüft vorher den Flash und stoppt das Script; der Web-Editor hat beim Einfügen Text verloren, deshalb immer per RPC. |
| 5 Prüfen | `node tools/verify-scripts.js <ip>` | eine Zeile je Script, am Ende „4 Scripts mit dist/ verglichen, alle byteidentisch“; prüft auch, dass `bw_main` und `bw_pump` dieselbe Version tragen. |
| 6 Frage 2 | `KVS.Set cfg2` per `curl` | Claude fragt nach dem Zielband und `dropSlow`; du nennst die Werte oder „erst nur messen“ (dann bleibt `cfg2` offen: `why=cfg`, `err=cfg`, keine Gabe). Claude schreibt sie als JSON-String **vor** dem Installer – ein Teilobjekt reicht. |
| 7 Installer | `node tools/hwtest.js <ip> normal 60` | wartet den sicheren Moment ab (Sekunde 8–30, nicht in den 9 min nach einem Gießfenster, kein Script läuft), startet `bw_install`, liest die Konsole mit und prüft danach Zeitplan, `auto_off` und Sicherung: „NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet“. |
| 8 Erste Zeile | `node tools/console.js <ip> 900` | die erste Zeile von `bw_main` beim nächsten Takt (höchstens <!-- def:cfg3.tick -->15<!-- /def --> min warten). Die Konsole muss vor dem Takt verbunden sein, sonst fehlt die Zeile. |

### Zielband eintragen

Das Zielband ist die wichtigste Entscheidung, und sie bleibt bei dir: Claude kennt deine Pflanze nicht. Beispielband vom Gerät seit 13.09.2026 in Bandordnung: `pctDry` 28 < `pctLo` 40 < `pctOk` 50 ≤ `pctSoll` 55 < `pctHi` 60, dazu `dropSlow` 4. Die Herleitung an der Pflanze steht in [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md), die Bedeutung jedes Feldes in [03 · Konfiguration](03-konfiguration.md). `cfg1` bleibt bei den Startwerten; die Kalibrierpunkte misst der Hardware-Check in Kapitel 11.

```bash
curl -s -X POST http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctDry\":28,\"pctLo\":40,\"pctOk\":50,\"pctSoll\":55,\"pctHi\":60,\"dropSlow\":4}"}'   # Wert ist ein JSON-String
```

> **Hinweis:** `KVS.Set` ersetzt den ganzen Eintrag. Vor dem Installer reicht ein Teilobjekt, weil `bw_install` fehlende Felder mit dem Startwert ergänzt (Konsole: „KVS cfg2 ergänzt: hyst,effMin,…“). Änderst du `cfg2` später, schreibe den vollständigen Eintrag (Web-UI: „Format as JSON“) oder lass den Installer danach noch einmal laufen.

## Was Claude darf und was du entscheidest

| Claude macht selbst | Du entscheidest |
| --- | --- |
| `npm test`, `npm run build`, `hwtest.js preflight` und `scripts`, `put-script.js`, `verify-scripts.js`, `hwtest.js normal`, `console.js`, `kvs_dump.sh`, `Schedule.List` lesen | das Zielband und alle Handwerte in `cfg2`/`cfg3` |
| Werte in den KVS schreiben, die du genannt hast | Konfigänderungen am Gerät: `hwtest.js input-on` ist laut Werkzeug die „einzige Konfigänderung, nur auf Zuruf“ |
| Ausgaben deuten, Abweichungen melden, nächsten Schritt vorschlagen | Scripts anlegen oder löschen (Flash ist knapp), Handgriffe am Aufbau (Sensor, Schwimmer, Schlauch) |
| Ergebnisse fürs Prüfprotokoll formulieren | Start von Hardware-Check und Zeitraffer ([11](11-hardware-check.md), [12](12-erstinbetriebnahme.md)); Commit und Push |

> **Hinweis:** Zustimmungsregel aus `AGENTS.md` (verbindlich, gekürzt): „Ein Agent darf Änderungen erarbeiten, testen und vorbereiten (Dateien ändern, `npm test` laufen lassen, einen Commit lokal vorschlagen). Aber `git commit` und `git push` erfordern die ausdrückliche Zustimmung des Menschen. Frage vor jedem Commit/Push aktiv nach. Bei offenen fachlichen Fragen entscheidet der Mensch – nicht raten, sondern fragen.“

### Nach der Installation weiterbauen

Dieselbe Rollenverteilung gilt für jede spätere Aufgabe – die Kurzfassung, ausführlich in [15 · Ausbau mit Claude Code](15-ausbau-mit-claude-code.md):

1. Sitzung im Projektordner starten: `claude`.
2. Aufgabe auf Deutsch beschreiben.
3. Bei größeren Änderungen den Plan prüfen und freigeben.
4. Die KI ändert Code und Tests; `npm test` muss grün bleiben.
5. Neue Entscheidungen ins [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md), Geräte-Erfahrungen ins [18 · Lernlog vom Gerät](18-lernlog-geraet.md).
6. Commit und Push erst nach deiner Freigabe.

## Permissions, Plan-Modus, Sandbox

**Permissions:** Claude Code fragt vor jedem Befehl und jeder Dateiänderung, die nicht vorab erlaubt ist. Die eingecheckte `.claude/settings.json` erlaubt nur `graft`-Befehle; `node tools/…`, `curl` und `npm` bestätigst du beim ersten Aufruf, dauerhafte Freigaben landen in deiner `settings.local.json`. Lies die Abfrage: sie zeigt den vollständigen Befehl, also auch, welche Datei auf welche Script-ID geht.

**Plan-Modus:** Für die Installation reicht der Interview-Prompt. Bei größeren Aufgaben – etwa einer Erweiterung nach [15 · Ausbau mit Claude Code](15-ausbau-mit-claude-code.md) – plant Claude im Plan-Modus zuerst und holt deine Freigabe, bevor er etwas ändert.

**Sandbox:** Claude Code führt Befehle in einer Sandbox mit Netzwerksperre aus. Damit die Werkzeuge den Shelly erreichen, muss seine Adresse in der persönlichen Einstellungsdatei stehen – am einfachsten sagst du es Claude direkt („erlaube Zugriff auf `http://<ip>`“), der `update-config`-Skill trägt es ein:

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": ["127.0.0.1", "localhost"]
    }
  }
}
```

Das ist die Datei `.claude/settings.local.json` im Projektordner (gitignoriert) für den Weg über den Tunnel; im LAN steht statt `127.0.0.1` die Adresse des Shelly. Test danach: `curl -s http://<ip>/rpc/Shelly.GetDeviceInfo`.

## Ergebnis prüfen

1. `verify-scripts.js`: jede Zeile endet mit „OK, byteidentisch“, `bw_main` und `bw_pump` tragen dieselbe Version <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->.
2. `normal 60`: Zeitplan mit drei eigenen Einträgen (bei den Startwerten; haben `winA` und `winB` verschiedene Minuten, sind es bis zu fünf) – `0 */15 * * * *` (`bw_main` alle <!-- def:cfg3.tick -->15<!-- /def --> min), `30 0 8,20 * * *` (`bw_pump` 30 s nach <!-- def:cfg3.winA -->08:00<!-- /def --> und <!-- def:cfg3.winB -->20:00<!-- /def -->) und `0 8 8,20 * * *` (Sicherheits-Aus 8 min nach dem Fenster: 30 s + `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s + 10 s, aufgerundet); `auto_off` 190 s (`tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s + 10); „keine Zeitraffer-Sicherung“; Schlusszeile „NORMALBETRIEB“.
3. KVS: `tools/kvs_dump.sh <ip>` zeigt neun Einträge `cfg1`, `cfg2`, `cfg3`, `cfg4`, `lrn`, `st`, `job`, `day`, `err` als JSON-Strings; `cfg2` trägt dein Band, alle übrigen Felder Startwerte.
4. Erste Konsolenzeile von `bw_main`: `V=` eine Spannung, `tC=` eine Temperatur, `lvl=` 0 oder 1, `err=-`. `why=cfg` (mit `err=cfg`) erscheint nur, solange das Band unvollständig ist.
5. Im Repo ist nichts committet: `git status` zeigt höchstens Dateien, die du selbst geändert hast (`settings.local.json` ist gitignoriert).

## Beispielausgabe

Upload und Prüfung (Script-IDs wie am Gerät vom 13.09.2026, Byte-Zahlen aus `dist/` Stand <!-- fact:project.version -->0.2.0<!-- /fact -->, `fs_free` vom Upload am 13.09.2026):

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

Installer-Konsole nach einem vorher eingetragenen Teil-`cfg2` (Lauf von `bw_install` <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> im Mock, `node tools/run-script.js scripts/bw_install.js --kvs 'cfg2={…}'`; am Gerät stehen hinter `#` die Zeitplan-IDs, die das Gerät vergibt):

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

Erste Zeile von `bw_main` beim nächsten Takt nach frischer Installation mit dem Beispielband (Lauf im Mock: `node tools/run-script.js scripts/bw_main.js --seed --voltage 1.196 --temp 23.6 --level 0 --kvs 'cfg2={…}'`; `why=ok` heißt: Auftrag geschrieben; `err=-` keine Störung; `w=3` drei KVS-Schreibvorgänge):

```text
[bw_main 0.2.0] V=1.196 pct=33.993 tC=23.6 lvl=0 st=beob dry=0 pause=24h why=ok sec=70 effW=- sf=0.7 err=- w=3 dauer=2600ms
```

`sec=` ist hier der Startwert `tStd` (<!-- def:cfg3.tStd -->70<!-- /def --> s) und `effW=-` bleibt bis zum ersten gelernten Fenster; danach rechnet `bw_main` die Sekunden aus dem Lernwert (Gerät 13.09.2026 nach `kal write`: `lrn.effW` 4.46, in der Zeile `effW=4.46`).

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| Werkzeuge melden „Tunnel 127.0.0.1:8010 offen?“ oder `fetch failed`, `curl` aus der Shell geht | Sandbox von Claude Code blockt das Netz | Adresse des Shelly in `.claude/settings.local.json` freigeben (Abschnitt Sandbox), Befehl wiederholen – im Zweifel die Sitzung neu starten |
| Claude schreibt `put-script.js <ip> 2 …` für `bw_pump` oder nennt „IDs 1, 2, 3“ aus einer alten Doku | IDs geraten statt gelesen | Nur die IDs aus `hwtest.js <ip> scripts` bzw. `preflight` gelten; Namen exakt `bw_install`, `bw_main`, `bw_pump`, `bw_zeitraffer` |
| `put-script.js`: „Flash zu voll: fs_free … – erst Platz schaffen“ | Test-Scripts (`engine_probe`, `bw_hwtest`, `bw_hwpump`) belegen den Flash | `hwtest.js <ip> scripts`, dann `delete <id>` für die Test-Scripts; danach erneut hochladen |
| `verify-scripts.js`: „WEICHT AB ab Zeichen …“ oder „VERSIONEN WEICHEN AB“ | Upload unvollständig oder nur ein Script der beiden `bw_main`/`bw_pump` aktualisiert | genanntes Script erneut mit `put-script.js` hochladen, beide Betriebs-Scripts auf denselben Stand |
| `normal 60`: „kein sicherer Moment in 4 min: läuft: …“ | ein Betriebs- oder Test-Script läuft dauernd (z. B. wartendes `bw_hwtest`) | `hwtest.js <ip> stop`, dann `normal 60` erneut |
| `normal 60`: „ABWEICHUNG Zeitplan ist … erwartet …“ | `Schedule.Create` vom Gerät abgelehnt oder alte Einträge stehen quer | Installer-Konsole lesen, `normal 60` wiederholen; eigene Einträge räumt `bw_install` selbst weg |
| erste Konsolenzeile fehlt, `console.js` zeigt nur Firmware-Zeilen | Konsole erst nach dem Takt verbunden oder Debug-Websocket aus | `console.js` vor dem Takt starten; Web-UI → Konsole öffnen schaltet den Websocket ein (`preflight` meldet „Debug-Websocket an“) |
| `why=cfg`, `err=cfg`, Messwerte stehen in der Zeile (`V=1.196 …`) | Zielband unvollständig: eines der sechs Felder `pctSoll`, `pctLo`, `pctOk`, `pctHi`, `pctDry`, `dropSlow` ist `null` | fehlende Bandfelder in `cfg2` eintragen (Abschnitt Zielband); beim nächsten Takt löscht `bw_main` `err=cfg` selbst |
| Konsole „Störung cfg: cfg2.hyst fehlt“, Zeile mit `V=- pct=-` | `cfg2` nach dem Installer als Teilobjekt geschrieben – Pflichtfelder wie `hyst` fehlen | `cfg2` vollständig schreiben (Web-UI „Format as JSON“) oder `normal 60` erneut (ergänzt fehlende Felder) |
| Claude will „zum Abschluss committen“ | Zustimmungsregel nicht beachtet | ablehnen oder ausdrücklich freigeben – ohne dein Ja gibt es keinen Commit |

## Weiter zu

- [11 · Hardware-Check](11-hardware-check.md) – Sensoren, Schwimmer und Pumpe im selben Interview prüfen und `cfg1` messen lassen.
- [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md) – Zielband an der Pflanze herleiten, Messlauf, Zeitraffer, erstes echtes Fenster.
- [15 · Ausbau mit Claude Code](15-ausbau-mit-claude-code.md) – wenn die Installation läuft und du die Steuerung erweitern willst.
