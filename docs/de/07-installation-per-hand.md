# 07 · Installation per Hand (Web-UI, Copy & Paste)

**Deutsch** · [English](../en/07-installation-per-hand.md) — [Handbuch](README.md) · Teil C „Installieren“

> **Auf einen Blick**
> - Ergebnis: die Scripts stehen mit der richtigen Byte-Zahl am Gerät (Byte-Prüfung bestanden), `bw_install` hat Startwerte und Zeitplan angelegt, das Zielband steht in `cfg2` – nur mit Browser und Web-UI, ohne Node und ohne Terminal.
> - Umfang: etwa 30 Minuten, 7 Schritte für drei Scripts (`bw_install`, `bw_main`, `bw_pump`; `bw_zeitraffer` optional).
> - Wichtigste Zahl: die Byte-Prüfung. `left + 1` aus `Script.GetCode` muss der Dateigröße in `dist/` gleichen, für `bw_main` also <!-- fact:dist.bw_main -->15791<!-- /fact --> Byte.
> - Größter Stolperstein: der Editor der Web-UI hat beim Einfügen Text verloren (12.09.2026: 166 bzw. 210 Byte am Dateiende). Ohne Byte-Prüfung startet ein solches Script mit `Got EOF` oder stirbt später an einem `ReferenceError`.

## Voraussetzungen

- Schritt 1 der [Startanleitung](06-startanleitung.md) ist erledigt: Shelly im WLAN, Uhrzeit per NTP, Zeitzone gesetzt, Analogeingang als Voltmeter (`voltmeter:100`), DS18B20 per 1-Wire-Scan (`temperature:100`), Eingang 1 (IN2) als Typ „Switch“.
- Ein Browser im selben Netz; die Web-UI ist unter `http://<ip>` erreichbar, RPC-Antworten erscheinen als Text unter `http://<ip>/rpc/<Methode>?…`.
- Der Ordner [`dist/`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/tree/main/dist) aus dem Repository. Er ist eingecheckt und byteidentisch mit `npm run build` (ein Test hält ihn aktuell); Stand: bw_install <!-- fact:ver.bw_install -->0.1.3<!-- /fact -->, bw_main <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, bw_pump <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, bw_zeitraffer <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact -->.
- Kein Node, kein Terminal, keine Abhängigkeiten. Wer später den Hardware-Check oder den Zeitraffer mit Werkzeug fahren will, braucht zusätzlich einen Rechner nach Kapitel [08](08-installation-lokaler-server.md) oder [09](09-installation-vps.md).

## Diagramm

[![Per Hand: dist/ öffnen, Script anlegen, Code einfügen, Byte-Prüfung, Installer, Konsole, Schedules, cfg2](../diagramme/de/07-installation-per-hand.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/07-installation-per-hand.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/07-installation-per-hand.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Einfügen und prüfen“, 2 „Wenn Bytes fehlen“, 3 „Installer und Zielband“.

## Was per Hand geht – und was nicht

Die Web-UI kann alles, was die Installation braucht. Die Werkzeuge aus `tools/` nehmen einem nur die Prüfungen ab und warten von selbst auf einen sicheren Moment.

| Aufgabe | Per Hand (dieses Kapitel) | Mit Werkzeugen (Kapitel 08/09) |
| --- | --- | --- |
| Scripts hochladen | Web-UI-Editor, Inhalt aus `dist/`, danach Byte-Prüfung je Script im Browser | `put-script.js` lädt in Stücken und vergleicht byteidentisch; `verify-scripts.js` prüft alle Scripts |
| Installer | `bw_install` in der Web-UI mit „Start“, Konsole offen | `hwtest.js <ip> normal 60` wartet den sicheren Moment ab und prüft danach Zeitplan und `auto_off` |
| Zeitplan und KVS prüfen | Web-UI → Schedules, `http://<ip>/rpc/Schedule.List`, `http://<ip>/rpc/KVS.GetMany?match=*` | dieselben RPCs, plus `tools/kvs_dump.sh <ip>` |
| Zielband eintragen | Web-UI → Settings → Key-Value Storage, „Format as JSON“ | `KVS.Set` per curl |
| Hardware-Check (Kapitel 11) | möglich, aber unpraktisch: Kommandos als KVS-Eintrag `hwc` von Hand schreiben (Text `{"n":1,"cmd":"go"}`, `n` je Kommando +1), Stand und Bericht in `hwr`/`hwp` lesen – vorgesehen ist `hwtest.js` | `start bw_hwtest`, `watch`, `go`, `report` |
| Zeitraffer (Kapitel 12) | nur das Script `bw_zeitraffer` von Hand starten, ohne Vorprüfung und Statuszeile – siehe unten | `zeitraffer 60`, `watch 300`, `normal 60`; Messlauf `mess`, Kalibrierlauf `kal` |

## Die sieben Schritte

### Schritt 1: dist/ öffnen und kopieren

`dist/` enthält denselben Code wie `scripts/`, aber ohne Einrückung und ohne lange Kommentare. Nur die Versionszeile und ein kurzer Doku-Block je Script (was das Script tut, was welche Einstellung bewirkt) bleiben stehen. **Nur `dist/` kommt ins Gerät, nie `scripts/`** – die Quelldateien sind größer, und der Verlust beim Einfügen wurde genau mit ihnen gemessen.

1. Die Datei im Repository öffnen, zum Beispiel [`dist/bw_install.js`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/dist/bw_install.js).
2. Auf „Raw“ klicken, damit nur der reine Text erscheint.
3. Alles markieren (Strg+A) und kopieren (Strg+C).

Alternativ das Repository als ZIP herunterladen (GitHub: „Code“ → „Download ZIP“) und die Dateien aus `dist/` in einem Texteditor öffnen. Beide Wege liefern dieselbe Datei; die Größen stehen in der Tabelle bei Schritt 4.

### Schritt 2: Scripts anlegen

1. Web-UI → Scripts → „Add script“.
2. Name **exakt** `bw_install`, `bw_main`, `bw_pump` eintragen – ein Script je Name.
3. Optional `bw_zeitraffer` anlegen (Praxistest im Zeitraffer, Kapitel 12). `bw_hwtest` und `bw_hwpump` nur anlegen, wenn ein Rechner mit `hwtest.js` dazukommt (Kapitel 11): jedes Script kostet Flash.
4. Kein Script auf „Run on startup“ stellen. Den Start übernimmt der Zeitplan; der Installer schaltet den Autostart für `bw_main` und `bw_pump` ohnehin ab (`Script.SetConfig`).

Die Script-IDs vergibt das Gerät. Der Installer findet `bw_main` und `bw_pump` über den Namen (`Script.List`) und meldet die IDs in der Konsole; ein falsch geschriebener Name endet mit `ABBRUCH: Script bw_main nicht gefunden` und `err=cfg`.

### Schritt 3: Code einfügen und speichern

1. Das Script in der Web-UI öffnen, den Editor leeren.
2. Den kopierten Inhalt aus `dist/` einfügen (Strg+V).
3. „Save“ drücken. Noch **nicht** starten.
4. Für jedes weitere Script wiederholen.

> **Am Gerät gemessen (12.09.2026):** Nach dem Einfügen von `scripts/bw_install.js` (12 131 Byte) lagen 11 965 Byte am Gerät – 166 Byte fehlten, genau das Dateiende. `bw_main` verlor 210 Byte. Die Firmware 2.0.0 speichert auch 19 KB, der Verlust lag also nicht an einem Größenlimit, sondern am Weg Zwischenablage → Editor → `Script.PutCode`. Die kompakten `dist/`-Dateien wurden seither nur per RPC hochgeladen; ob der Editor sie verlustfrei übernimmt: `[TODO am Gerät]`. Deshalb entscheidet die Byte-Prüfung. Ausführlich mit Ursache und Vorbeugung: Kapitel [18](18-lernlog-geraet.md).

### Schritt 4: Byte-Prüfung

`Script.GetCode` mit `len=1` liefert das erste Byte (`data`) und die Zahl der restlichen Bytes (`left`). `left + 1` ist die Größe des Codes am Gerät und muss der Dateigröße in `dist/` gleichen.

1. Die ID des Scripts nachsehen: `http://<ip>/rpc/Script.List` im Browser öffnen; die Antwort nennt je Script `id`, `name`, `enable`, `running`.
2. `http://<ip>/rpc/Script.GetCode?id=<id>&len=1` öffnen.
3. `left + 1` mit der Tabelle vergleichen.
4. Weicht die Zahl ab: Editor leeren, Inhalt erneut einfügen (Schritt 3), erneut prüfen.

| Script | Größe in `dist/` (Byte) |
| --- | --- |
| `bw_install` | <!-- fact:dist.bw_install -->15978<!-- /fact --> |
| `bw_main` | <!-- fact:dist.bw_main -->15791<!-- /fact --> |
| `bw_pump` | <!-- fact:dist.bw_pump -->17475<!-- /fact --> |
| `bw_zeitraffer` | <!-- fact:dist.bw_zeitraffer -->7459<!-- /fact --> |
| `bw_hwtest` | <!-- fact:dist.bw_hwtest -->13952<!-- /fact --> |
| `bw_hwpump` | <!-- fact:dist.bw_hwpump -->14500<!-- /fact --> |

Die Größen zählen Bytes, nicht Zeichen (Umlaute und Gedankenstriche im Doku-Block belegen zwei oder drei Byte) und schließen den Zeilenumbruch am Dateiende ein. Bei jeder Abweichung zuerst den Editor leeren und erneut einfügen. Bleibt es bei genau 1 Byte, fehlt vermutlich nur dieser Umbruch – für das Script ohne Folgen, am Gerät bisher nicht beobachtet `[TODO am Gerät]`: in der letzten Zeile des Editors Enter drücken, speichern, erneut prüfen. Fehlen viele Bytes, ist Text verloren gegangen.

> **Hinweis:** Die Zahlen gelten für den eingecheckten Stand von `dist/`. Wer ein anderes Release nimmt, liest die Größe der eigenen Datei ab (Dateieigenschaften im Betriebssystem oder die Ausgabe von `npm run build`).

### Schritt 5: Installer starten und Konsole lesen

`bw_install` legt die neun KVS-Einträge `cfg1`–`cfg4`, `lrn`, `st`, `job`, `day`, `err` an (nur fehlende Einträge und Felder, nichts wird überschrieben), prüft, dass ein Gießfenster samt Budget `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s und Reserve `tTail` <!-- def:cfg4.tTail -->20<!-- /def --> s vor dem nächsten Takt endet, baut den Zeitplan aus `cfg3`/`cfg4`, setzt die Switch-Konfiguration (Ausgang nach Neustart aus, `auto_off` = `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> + 10 = 190 s) und beendet sich nach wenigen Sekunden selbst.

1. Web-UI → Scripts → `bw_install` öffnen und die Konsole des Scripts öffnen. Das schaltet den Debug-Websocket ein; die Konsole muss **vor** dem Start offen sein, sonst fehlt die erste Zeile.
2. „Start“ drücken.
3. Die Konsole lesen: sie endet mit `fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach`. Davor stehen die Script-IDs, `KVS neu angelegt: …` und je Zeitplan-Eintrag `Zeitplan #<id>: <timespec>`.

Der Installer darf beliebig oft laufen. Läuft gerade `bw_main` oder `bw_pump`, bricht er mit `ABBRUCH: Script bw_main läuft – später erneut starten` ab und setzt `err=cfg`; dann einfach später noch einmal starten. Beim allerersten Lauf gibt es noch keinen Zeitplan, also auch keinen Konflikt.

> **Hinweis:** Der erste `Schedule.Create` eines Laufs wird von der Firmware gelegentlich mit „timespec validation“ abgelehnt. Der Installer wiederholt ihn stumm (bis zu 3-mal, 400 ms Pause); erst eine zweite Ablehnung erscheint als `Hinweis: Schedule.Create … abgelehnt`. Am Ende zählt, dass alle Zeitplan-Einträge in der Konsole stehen.

### Schritt 6: Zeitplan prüfen

Web-UI → Schedules zeigt bei den Startwerten `winA` <!-- def:cfg3.winA -->08:00<!-- /def --> und `winB` <!-- def:cfg3.winB -->20:00<!-- /def --> drei Einträge (haben die Fenster verschiedene Minuten, bis zu fünf). Dasselbe liefert `http://<ip>/rpc/Schedule.List` im Browser als Text (`jobs[]` mit `id`, `enable`, `timespec`, `calls`).

| Timespec | Aufruf | Bedeutung |
| --- | --- | --- |
| `0 */15 * * * *` | `Script.Start` bw_main | Takt alle `tick` <!-- def:cfg3.tick -->15<!-- /def --> min: messen, bewerten, Auftrag schreiben |
| `30 0 8,20 * * *` | `Script.Start` bw_pump | Gießfenster um 08:00:30 und 20:00:30 – 30 s nach der vollen Minute, damit `bw_pump` nie neben `bw_main` läuft |
| `0 8 8,20 * * *` | `Switch.Set` aus | Sicherheits-Aus 8 min nach der Fensterminute (30 s + `tWin` 420 s + 10 s, auf volle Minuten aufgerundet) |

Den KVS zeigt `http://<ip>/rpc/KVS.GetMany?match=*`; alle Werte sind JSON-Strings, deshalb erscheinen die Objekte dort als Text mit `\"`-Anführungszeichen.

### Schritt 7: Zielband in cfg2 eintragen

Nach dem Installer sind die sechs Bandfelder `null`. Solange eines davon `null` ist, misst `bw_main` jeden Takt und schreibt `why=cfg` (Grund gegen einen Auftrag: Konfiguration offen) mit `err=cfg` – es gießt nicht. Das ist wassersicher, aber eben auch keine Bewässerung.

1. Web-UI → Settings → Key-Value Storage → Eintrag `cfg2` öffnen.
2. „Format as JSON“ anhaken: der gespeicherte String wird als JSON-Objekt bearbeitbar.
3. Nur die sechs Bandfelder ändern, alle anderen Felder stehen lassen: `pctDry` < `pctLo` < `pctOk` ≤ `pctSoll` < `pctHi`, dazu `dropSlow`. Außerdem muss `pctLo` + `hyst` (<!-- def:cfg2.hyst -->2<!-- /def -->) unter `pctOk` liegen.
4. Speichern. Ab dem nächsten Takt zeigt die Konsole von `bw_main` `why=ok` oder einen anderen Grund statt `why=cfg`.

Beispielband vom Gerät (13.09.2026, Feldnamen in Bandordnung): `pctDry` 28 < `pctLo` 40 < `pctOk` 50 ≤ `pctSoll` 55 < `pctHi` 60, `dropSlow` 4. Die Werte gehören zu einem Sensor unter dem Tropfer und zur Kalibrierung `cfg1`; die Herleitung für den eigenen Topf steht in Kapitel [12](12-erstinbetriebnahme.md).

```json
{"pctSoll":55,"pctLo":40,"pctHi":60,"pctDry":28,"hyst":2,"dropSlow":4,"effMin":0.05,"effMax":30,"alpha":0.3,"sfMin":0.5,"sfStep":0.1,"pctOk":50,"dropW":null,"sfUp":0.05}
```

> **Hinweis:** Ein Eintrag, der nach dem Bearbeiten kein gültiges JSON mehr ist (fehlendes Anführungszeichen, Komma zu viel), gilt für die Scripts als fehlend: `bw_main` meldet `Störung cfg: cfg2.hyst fehlt`, der nächste Installer-Lauf legt den Eintrag mit Startwerten neu an (Konsole: `KVS neu angelegt: cfg2`). Dann das Band erneut eintragen. Ein Teilobjekt (nur die sechs Felder) ist nur **vor** dem ersten Installer-Lauf sinnvoll – er ergänzt den Rest; später ersetzt `KVS.Set` immer den ganzen Eintrag.

## Flash-Speicher der Scripts

Der Flash für Scripts ist knapp; `http://<ip>/rpc/Sys.GetStatus` zeigt ihn als `fs_free` in Byte. `put-script.js` verlangt vor einem Upload `fs_free` + alter Code ≥ neue Datei + 4 096 B – dieselbe Faustregel gilt beim Einfügen von Hand, sonst kann das Gerät halb geschriebenen Code behalten.

> **Am Gerät gemessen (13.09.2026):** `fs_free` 12 288 B mit sieben Scripts; nach dem Löschen von `engine_probe`, `bw_hwtest` und `bw_hwpump` 49 152 B (≈ 36 KB gewonnen); nach dem Upload von `bw_pump` (17 475 B) 40 960 B – das Dateisystem rechnet in 4-KB-Blöcken.

Wer Platz braucht, löscht nicht benötigte Scripts in der Web-UI (die Hardware-Test-Scripts nach dem Test, alte Sondier-Scripts); ein Script muss dafür gestoppt sein. Die Betriebs-Scripts `bw_install`, `bw_main`, `bw_pump` bleiben.

## Zeitraffer und Updates von Hand

`bw_zeitraffer` lässt sich in der Web-UI mit „Start“ ausführen: es sichert `cfg3`, `lrn`/`day`, `st`/`err`, `cfg4`, `cfg2` nach `zrb1..5`, schreibt das Profil (Takt <!-- zr:cfg3.tick -->3<!-- /zr --> min, Fenster alle <!-- zr:cfg3.winEvery -->6<!-- /zr --> min, Budget <!-- zr:cfg4.tWin -->120<!-- /zr --> s) und startet `bw_install`. Zurück in den Normalbetrieb bringt ein erneuter Start von `bw_install`: ohne die Marke `zr` schreibt er das Original zurück. Voraussetzung ist ein vollständiges Zielband – sonst gießt der Zeitraffer nie (`why=cfg`).

> **Nur Zeitraffer:** Ohne Werkzeug fehlen Vorprüfung, Statuszeile und Fahrplan; die Konsolenzeilen bleiben lesbar (Web-UI → Scripts → `bw_main` bzw. `bw_pump` → Konsole). Fahrplan, Erwartungen und Rückbau stehen in Kapitel [12](12-erstinbetriebnahme.md).

Beide Starts brauchen einen sicheren Moment, den `hwtest.js` sonst selbst abwartet:

| Bedingung | Normalbetrieb | Im Zeitraffer |
| --- | --- | --- |
| Sekunde der Minute | 8–30 (der Takt bei Sekunde 0 ist fertig, der nächste weit weg) | 8–30 |
| Abstand zum Gießfenster | nicht in den 9 min nach `winA`/`winB` (Fenster bis 30 s + `tWin`, Sicherheits-Aus bei 8 min) | nicht in den Minuten 0–2 eines 6-min-Zyklus (dort regelt `bw_pump`) |
| Laufende Scripts | keines von `bw_install`, `bw_main`, `bw_pump`, `bw_hwtest`, `bw_hwpump`, `bw_zeitraffer` läuft (Web-UI → Scripts zeigt „running“) | ebenso |

Ein Script-Update läuft per Hand genauso wie die Erstinstallation: neue Datei aus `dist/` einfügen (das Script darf dabei nicht laufen), Byte-Prüfung, dann `bw_install` einmal starten – er ergänzt neue Felder mit Startwerten, baut den Zeitplan neu und setzt `auto_off`. Reihenfolge, Migration von 0.1.x und Handwerte: Kapitel [13](13-betrieb-und-wartung.md).

## Beispielausgabe

Byte-Prüfung im Browser für `bw_main` (Antwort auf `http://<ip>/rpc/Script.GetCode?id=<id>&len=1`; `left` = 15 791 − 1):

```json
{"data":"/","left":15790}
```

Konsole von `bw_install` bei leerem KVS (Lauf im Mock mit `node tools/run-script.js scripts/bw_install.js`; am Gerät stehen die dort vergebenen Script- und Zeitplan-Nummern):

```text
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] Zeitplan: 0 Einträge, davon eigene: 0
[bw_install 0.1.3] Switch 0: auto_off 190 s
[bw_install 0.1.3] KVS neu angelegt: cfg1, cfg2, cfg3, cfg4, lrn, st, job, day, err
[bw_install 0.1.3] Zeitplan #1: 0 */15 * * * *
[bw_install 0.1.3] Zeitplan #2: 30 0 8,20 * * *
[bw_install 0.1.3] Zeitplan #3: 0 8 8,20 * * *
[bw_install 0.1.3] fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach
```

Erste Zeile von `bw_main` vor dem Zielband (Mock, Sensor 1,2 V) und eine Taktzeile mit vollständigem Band (README-Beispiel): `why` ist der Grund für oder gegen einen Auftrag, `w` die Zahl der KVS-Schreibvorgänge, `dauer` die Laufzeit.

```text
[bw_main 0.2.0] V=1.2 pct=34.13 tC=24 lvl=0 st=beob dry=0 pause=24h why=cfg sec=- effW=- sf=0.7 err=cfg w=4 dauer=2620ms
[bw_main 0.2.0] V=1.196 pct=34 tC=22 lvl=0 st=beob dry=1 pause=24h why=ok sec=70 effW=- sf=0.7 err=- w=3 dauer=2600ms
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `Uncaught SyntaxError: Got EOF expected '}'` beim Start | Dateiende beim Einfügen verloren (12.09.2026: 166 Byte bei `bw_install`) | Byte-Prüfung; Editor leeren, aus `dist/` erneut einfügen, speichern, erneut prüfen |
| `ReferenceError: "…" is not defined` mitten im Lauf | Ein Stück aus der Dateimitte fehlt, die Funktion darin existiert nicht (12.09.2026: `evalSamples` in `bw_main`) | wie oben – erst Upload prüfen, dann Code verdächtigen |
| `left + 1` weicht um genau 1 Byte ab | vermutlich fehlt nur der Zeilenumbruch am Dateiende – für das Script ohne Folgen, am Gerät bisher nicht beobachtet `[TODO am Gerät]` | Editor leeren und erneut einfügen; bleibt es bei genau 1 Byte, in der letzten Zeile Enter drücken, speichern, prüfen |
| Key-Value Storage zeigt `[object Object]` | Einträge einer alten Script-Version (0.1.0) als Objekt statt JSON-String gespeichert | Einträge löschen (je Eintrag `http://<ip>/rpc/KVS.Delete?key=<name>` im Browser oder in der Web-UI im Key-Value Storage), dann `bw_install` starten: er legt sie als JSON-Strings neu an (`KVS neu angelegt: …`); Zielband danach neu eintragen. Der Installer allein ersetzt Objekt-Einträge nicht, er ergänzt nur fehlende Felder |
| `ABBRUCH: Script bw_main nicht gefunden`, `err=cfg` | Script-Name falsch geschrieben oder Script fehlt | Namen exakt `bw_main`/`bw_pump`, Installer erneut starten |
| `ABBRUCH: Script bw_main läuft – später erneut starten` | Installer im Takt oder im Fenster gestartet | sicheren Moment abwarten (Sekunde 8–30, nicht in den 9 min nach dem Fenster), erneut starten |
| Konsole bleibt beim Start leer | Konsole erst nach „Start“ geöffnet; der Installer ist nach wenigen Sekunden fertig | Konsole zuerst öffnen (Debug-Websocket), dann starten; Ergebnis alternativ über `Schedule.List` und `KVS.GetMany` prüfen |
| Script steht auf „Run on startup“ | Autostart in der Web-UI gesetzt | ausschalten; `bw_pump` mit Autostart könnte nach einem Neustart außerhalb der Fenster gießen |
| `bw_main` schreibt weiter `why=cfg` | Ein Bandfeld ist noch `null`, das Band verletzt die Ordnung, oder `cfg2` ist kein gültiges JSON mehr | alle sechs Felder prüfen (`pctDry` < `pctLo` < `pctOk` ≤ `pctSoll` < `pctHi`, `pctLo` + `hyst` < `pctOk`), Konsole auf `Störung cfg: …` lesen |
| `fs_free` in `Sys.GetStatus` ist kleiner als Dateigröße + 4 096 B | Flash der Scripts knapp (13.09.2026: 12 288 B frei mit sieben Scripts) | nicht benötigte Scripts löschen (≈ 36 KB durch die drei Test-Scripts), dann einfügen |

## Weiter zu

- [06 · Schritt-für-Schritt-Startanleitung](06-startanleitung.md) – ab Schritt 6: `cfg1` prüfen, Aufbau am Topf, erste Konsolenzeile und erstes Gießfenster mitlesen.
- [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md) – Kalibrierung, Herleitung des Zielbands, Praxistest im Zeitraffer.
- [13 · Betrieb und Wartung](13-betrieb-und-wartung.md) – Konsole deuten, Werte ändern, Scripts aktualisieren.
