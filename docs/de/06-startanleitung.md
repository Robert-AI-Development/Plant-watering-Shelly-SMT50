# 06 · Schritt-für-Schritt-Startanleitung

**Deutsch** · [English](../en/06-startanleitung.md) — [Handbuch](README.md) · Teil C „Installieren“

> **Auf einen Blick**
> - Ergebnis: vom verdrahteten Shelly zum ersten mitgelesenen Gießfenster – in zehn festen Schritten, gleich für alle vier Installationswege 07 bis 10.
> - Umfang: zehn Schritte am Rechner und am Topf; danach wartest du nur noch auf das nächste Fenster um <!-- def:cfg3.winA -->08:00<!-- /def --> oder <!-- def:cfg3.winB -->20:00<!-- /def --> Uhr (Pumpenstart bei Sekunde 30).
> - Wichtigste Zahl: `bw_main` misst alle <!-- def:cfg3.tick -->15<!-- /def --> min – und gießt erst, wenn alle sechs Bandfelder in `cfg2` gesetzt sind (vorher `why=cfg`).
> - Größter Stolperstein: der Web-Editor verliert beim Einfügen Text (`Got EOF`). Deshalb nach jedem Upload `node tools/verify-scripts.js <ip>` – der Code am Gerät muss byteidentisch sein.

## Voraussetzungen

- Hardware nach [05 · Verkabelung und Hardware-Aufbau](05-verkabelung-und-aufbau.md): die Web-UI zeigt eine Spannung am Voltmeter, eine Temperatur des DS18B20 und Wechsel am Schwimmer-Eingang.
- Shelly Plus Uni im WLAN, Uhrzeit per NTP gesetzt, Zeitzone richtig – die Fenster sind Ortszeit. Ohne gültige Uhr meldet `bw_main` `err=uhr` und der Zeitplan steht.
- Rechner mit Node ≥ 20 für `npm run build`, `put-script.js` und `verify-scripts.js`; Node ≥ 22 für `hwtest.js` und `console.js` (globales `WebSocket`). Keine Abhängigkeiten. Weg 07 kommt ganz ohne Node aus, weil `dist/` im Repo liegt.
- Debug-Websocket an: Web-UI → Scripts → ein Script → Konsole öffnen (schaltet `debug.websocket.enable` ein; `node tools/hwtest.js <ip> preflight` meldet „Debug-Websocket an/aus“). Ohne ihn zeigen `watch`, `console.js` und der Rekorder von `kal` keine Konsolenzeilen; `kal write` schreibt dann `effW` nur im Profilmaß und `tDead`/`tMin` gar nicht.
- Für Schritt 10: Wasserbehälter, Pumpe am Relais, Schlauch mit Tropfern am Topf.

## Diagramm

[![Wegwahl zu den Installationswegen 07 bis 10 und die gemeinsamen Schritte bis zum ersten Gießfenster](../diagramme/de/06-startanleitung.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/06-startanleitung.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/06-startanleitung.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Wegwahl“, 2 „Gemeinsame Schritte“, 3 „Nach der Installation“.

## Welcher Weg passt zu dir

Alle vier Wege durchlaufen dieselben zehn Schritte. Sie unterscheiden sich nur darin, wie du baust, hochlädst, prüfst und den Installer startest (Schritte 2 bis 5 und 8).

| Deine Situation | Weg | Kapitel |
| --- | --- | --- |
| Kein Node, kein Terminal – nur ein Browser | Scripts aus dem eingecheckten `dist/` in die Web-UI einfügen, Byte-Prüfung per RPC im Browser | [07 · Installation per Hand](07-installation-per-hand.md) |
| PC oder Raspberry Pi mit Node ≥ 22 im selben Netz wie der Shelly | Werkzeuge direkt gegen die IP: Upload, Prüfung, `normal`, `console.js` | [08 · Installation mit lokalem Server](08-installation-lokaler-server.md) |
| Du arbeitest auf einem Server (VPS), der Shelly steht zu Hause | SSH-Rückwärtstunnel; der Shelly ist am VPS als `127.0.0.1:8010` erreichbar, `<ip>` ist dann diese Adresse | [09 · Installation mit VPS-Server](09-installation-vps.md) |
| Die KI soll führen | Claude Code fährt die Schritte im Interview über die Werkzeuge; du entscheidest und bedienst den Aufbau | [10 · Installation mittels Claude Code](10-installation-claude-code.md) |

## Die zehn Schritte

Die Reihenfolge ist fest: 1 Gerät vorbereiten → 2 bauen → 3 Scripts anlegen → 4 hochladen → 5 prüfen → 6 `cfg1` → 7 `cfg2` → 8 Installer → 9 Zeitplan prüfen → 10 Aufbau und erstes Fenster. Der Installer ergänzt fehlende Felder und überschreibt nichts, deshalb sind die Schritte 6 und 7 vor ihm wassersicher: solange ein Bandfeld fehlt, wird nicht gegossen.

### 1 Gerät vorbereiten (Web-UI)

1. Uhrzeit per NTP und Zeitzone prüfen (Settings).
2. Peripherals/Add-ons: Analogeingang als **Voltmeter** mit Bereich 0–15 V anlegen (kleinerer Bereich = feinere Auflösung). Es entsteht `voltmeter:100`.
3. DS18B20 per **1-Wire-Scan** hinzufügen. Es entsteht `temperature:100`. Weichen die Nummern ab, später in `cfg1.idV` bzw. `cfg1.idT` eintragen (Startwert je <!-- def:cfg1.idV -->100<!-- /def -->).
4. Eingang 1 (Klemme IN2, Schwimmer) auf Typ „Switch“ stellen – oder `node tools/hwtest.js <ip> input-on` (`Input.SetConfig` mit `enable` und `type: "switch"` auf `cfg1.idLvl` = <!-- def:cfg1.idLvl -->1<!-- /def -->).
5. Kein Script auf „Run on startup“ stellen. Der Zeitplan startet die Scripts; der Installer setzt den Autostart für `bw_main` und `bw_pump` ohnehin aus.

### 2 Bauen: `npm run build`

```bash
npm run build            # schreibt dist/: Kommentare und Einrückung weg, Versionszeile und //!-Doku bleiben
```

Nur `dist/` kommt aufs Gerät, `scripts/` ist die lesbare Quelle. Der Build hält die Kompakt-Ausgabe unter <!-- fact:size_limit -->16000<!-- /fact --> B (Ausnahme `bw_pump`: <!-- fact:size_limit_pump -->18000<!-- /fact --> B), weil der Script-Heap des Geräts (~25 KB) von allen Scripts geteilt wird. Aktuell: `bw_install` <!-- fact:dist.bw_install -->15978<!-- /fact --> B, `bw_main` <!-- fact:dist.bw_main -->15791<!-- /fact --> B, `bw_pump` <!-- fact:dist.bw_pump -->17475<!-- /fact --> B, `bw_zeitraffer` <!-- fact:dist.bw_zeitraffer -->7459<!-- /fact --> B.

Wer am Code geändert hat, lässt vorher `npm test` laufen: <!-- fact:tests -->146<!-- /fact --> Tests gegen den Mock müssen grün sein.

> **Hinweis:** `dist/` ist eingecheckt – wer nichts am Code ändert, kann die Dateien direkt aus dem Repo nehmen ([dist/](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/tree/main/dist)). Auch ein Update von 0.1.x läuft über diesen Schritt: erst bauen (oder das eingecheckte `dist/`), dann hochladen; die Update-Reihenfolge steht in [13 · Betrieb und Wartung](13-betrieb-und-wartung.md).

### 3 Scripts anlegen

1. Web-UI → Scripts → Add script: drei Scripts mit den exakten Namen `bw_install`, `bw_main`, `bw_pump` anlegen. Der Installer findet sie per Name (`Script.List`); die IDs vergibt das Gerät.
2. Optional `bw_zeitraffer` für [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md): `node tools/hwtest.js <ip> preflight` legt es an und nennt den Upload-Befehl mit der richtigen ID. `preflight hw` legt zusätzlich `bw_hwtest` und `bw_hwpump` für [11 · Hardware-Check](11-hardware-check.md) an.
3. IDs nachsehen: `node tools/hwtest.js <ip> scripts` zeigt jedes Script mit ID, Name, Größe am Gerät, `mem_peak` und darunter `fs_free`. `put-script.js` prüft den Namen nicht – die ID muss zum Dateinamen passen.

> **Am Gerät gemessen (13.09.2026):** Der Flash für Scripts ist knapp. Mit sieben Scripts blieben 12 288 B frei, nach dem Löschen von `engine_probe`, `bw_hwtest` und `bw_hwpump` 49 152 B. `put-script.js` bricht ab, wenn `fs_free` plus alter Code kleiner ist als die Datei plus 4 096 B Reserve („Flash zu voll“); Platz schafft `node tools/hwtest.js <ip> delete <id>` (löscht nie Betriebs-Scripts).

### 4 Hochladen

```bash
node tools/hwtest.js <ip> scripts                     # IDs der eigenen Scripts (id = Name)
node tools/put-script.js <ip> <id> dist/bw_install.js # je Script mit seiner ID
node tools/put-script.js <ip> <id> dist/bw_main.js
node tools/put-script.js <ip> <id> dist/bw_pump.js
node tools/put-script.js <ip> <id> dist/bw_zeitraffer.js   # nur wenn angelegt
```

`put-script.js` stoppt das Script, schickt die Datei per `Script.PutCode` in 1 024-Zeichen-Stücken, lädt den Code danach komplett zurück und vergleicht ihn byteidentisch mit der Datei. Der Grund: der Editor der Web-UI hat beim Einfügen Text verloren (Firmware 2.0.0, 12.09.2026: 166 bzw. 210 Byte am Dateiende fehlten, das Script startete mit `SyntaxError: Got EOF`).

Ohne Node geht es über den Editor: Inhalt aus `dist/` einfügen, dann im Browser `http://<ip>/rpc/Script.GetCode?id=<id>&len=1` aufrufen – `left` + 1 muss der Dateigröße aus dem Build entsprechen. Der Ablauf im Detail steht in [07 · Installation per Hand](07-installation-per-hand.md).

### 5 Prüfen: `verify-scripts.js`

```bash
node tools/verify-scripts.js <ip>   # jedes Script am Gerät gegen dist/ vergleichen, Versionen bw_main = bw_pump
```

Das Werkzeug lädt jeden Code per `Script.GetCode` komplett herunter, vergleicht ihn byteidentisch mit `dist/`, zählt die Doku-Zeilen und prüft, dass `bw_main` und `bw_pump` dieselbe Version tragen (sie teilen sich `st`, `job`, `lrn`). Nach **jedem** Upload ausführen – auch nach einem Upload per Editor – und immer dann, wenn ein Script „unerklärlich“ abbricht.

### 6 Sensor-Kalibrierung `cfg1`

Die Feuchteskala ist eine eigene Kalibrierung: 0 % = Sensor trocken in Luft (`vDry`), 100 % = Sensor im Wasserglas (`vWet`). Die Startwerte <!-- def:cfg1.vDry -->0.20<!-- /def --> V und <!-- def:cfg1.vWet -->3.13<!-- /def --> V reichen für den Start; am Gerät wurden am 13.09.2026 mit `bw_hwtest` 0,296 V und 3,134 V gemessen. Die Spannung liest du am Voltmeter in der Web-UI ab oder später als `V=` in der ersten Konsolenzeile.

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg1","value":"{\"vDry\":0.296,\"vWet\":3.134}"}'
```

Oder Web-UI → Settings → Key-Value Storage → Eintrag anlegen, „Format as JSON“ anhaken. Alle KVS-Werte sind JSON-Strings: der Wert ist der JSON-Text in Anführungszeichen (wie im `curl`-Befehl oben), der Haken macht ihn in der Web-UI bearbeitbar. Vor dem Installer genügt dieses Teilobjekt – er ergänzt `vErrLo`, `nSample`, `idV` und die übrigen Felder mit Startwerten. Genauer misst der [Hardware-Check](11-hardware-check.md): er schreibt `vDry` und `vWet` bei plausiblem Ergebnis selbst.

### 7 Zielband `cfg2`

Das Band muss geordnet sein: `pctDry` < `pctLo` < `pctOk` ≤ `pctSoll` < `pctHi`, außerdem `pctLo` + `hyst` < `pctOk` (`hyst` Startwert <!-- def:cfg2.hyst -->2<!-- /def -->). Beispielband vom Gerät seit 13.09.2026, in Bandordnung:

| Feld | Beispiel | Bedeutung |
| --- | --- | --- |
| `pctDry` | 28 | Ende der Trockenphase: deutlich unter `pctLo` |
| `pctLo` | 40 | darunter entsteht ein Gießauftrag („jetzt gießen“) |
| `pctOk` | 50 | Ziel erreicht: keine weitere Portion im Fenster |
| `pctSoll` | 55 | Zielpunkt der Dosisrechnung, wenige Prozent über `pctOk` |
| `pctHi` | 60 | „zu viel“: darüber gilt der Topf als nass, Trockenphase beginnt |
| `dropSlow` | 4 | Abnahme in %/24 h, unter der die lange Pause gilt (Staunässe-Verdacht); der Wert stammt aus dem 0.1.x-Lauf, die richtige Schwelle misst man an der Pflanze |

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctSoll\":55,\"pctLo\":40,\"pctOk\":50,\"pctHi\":60,\"pctDry\":28,\"dropSlow\":4}"}'
```

Die Werte beziehen sich auf den Sensor unter dem Tropfer und deine `cfg1`-Kalibrierung, nicht auf einen volumetrischen Wassergehalt. Wie du dein eigenes Band an der Pflanze herleitest, steht in [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md). Der Installer legt `pctOk` und die anderen Bandfelder nur als `null` an – die Werte kommen immer von Hand. Auch `lrn.effW` bleibt `null`, bis `bw_pump` im ersten Fenster lernt oder `kal write` es schreibt.

> **Hinweis:** `KVS.Set` ersetzt den ganzen Eintrag. Vor dem Installer reicht das Teilobjekt (er ergänzt `hyst`, `effMin`, `effMax`, `alpha`, `sfMin`, `sfStep`, `dropW`, `sfUp`). Später ein Feld ändern: Web-UI → Key-Value Storage → „Format as JSON“ → nur das Feld ändern, oder nach einem Teil-Schreiben den Installer wiederholen. Solange ein Bandfeld `null` ist, misst und protokolliert das System nur (`why=cfg`, `err=cfg`) – das ist normal und kein Fehler. Ein fehlendes Pflichtfeld wie `cfg2.hyst` oder ein ungeordnetes Band stoppt ebenfalls mit `err=cfg`.

### 8 Installer starten

```bash
node tools/hwtest.js <ip> normal 60   # sicherer Moment, Script.Start bw_install, 60 s Konsole, danach Zeitplan/cfg3/cfg4/auto_off prüfen
```

`normal` wartet einen sicheren Moment ab: Sekunde 8–30 einer Minute, nicht bis 9 min nach `winA`/`winB` (dort läuft das Fenster bis zum Sicherheits-Aus), und kein Betriebs- oder Test-Script läuft. Es pollt alle 2 s und gibt nach 4 min auf. Danach prüft es Zeitplan, `cfg3`/`cfg4`, `auto_off` und dass keine Zeitraffer-Sicherung steht, und meldet `NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet`. Ohne Werkzeug: Web-UI → Scripts → `bw_install` → „Start“ – und dieselbe Regel für den Moment von Hand einhalten.

Was `bw_install` <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> tut:

1. Liest alle KVS-Einträge (paginiert) und die Script-Liste. Läuft `bw_main` oder `bw_pump`, bricht er ab (`ABBRUCH: Script bw_main läuft – später erneut starten`) und schreibt `err=cfg`, damit der Grund auch ohne Konsole sichtbar ist.
2. Legt die neun Einträge `cfg1`, `cfg2`, `cfg3`, `cfg4`, `lrn`, `st`, `job`, `day`, `err` an, wenn sie fehlen, und ergänzt in vorhandenen Einträgen fehlende Felder mit Startwerten (Konsole `KVS cfg2 ergänzt: …`). Vorhandene Werte überschreibt er nie; nur ein Eintrag, der kein JSON-Objekt ist, wird neu angelegt.
3. Prüft die Fensterregel: ein Fenster muss samt Budget und Reserve vor dem nächsten Takt enden, (Fensterminute mod `tick`)·60 + 30 + `tWin` + `tTail` ≤ `tick`·60. Mit den Startwerten sind das 0 + 30 + <!-- def:cfg4.tWin -->420<!-- /def --> + <!-- def:cfg4.tTail -->20<!-- /def --> = 470 s von 900 s.
4. Löscht seine alten Zeitplan-Einträge (erkannt an `Script.Start` auf `bw_main`/`bw_pump` oder `Switch.Set` auf den Pumpenausgang) und legt sie neu an. Die erste Ablehnung von `Schedule.Create` („timespec validation“) wiederholt er stumm; erst eine zweite erscheint als `Hinweis: Schedule.Create …`.
5. Setzt für `bw_main` und `bw_pump` den Autostart aus und die Switch-Konfiguration: `initial_state` off, `auto_off` nach `tMax` + 10 s = <!-- def:cfg3.tMax -->180<!-- /def --> + 10 = 190 s.
6. Schreibt die Zusammenfassung mit den Zeitplan-Zeilen und beendet sich selbst (`Script.Stop`). Er ist beliebig oft wiederholbar.

### 9 Zeitplan prüfen

Web-UI → Schedules, oder per RPC: `curl -s http://<ip>/rpc/Schedule.List`. Erwartet sind drei eigene Einträge:

| Timespec | Aufruf | Bedeutung |
| --- | --- | --- |
| `0 */15 * * * *` | `Script.Start` `bw_main` | Takt aus `cfg3.tick`, zur vollen Minute |
| `30 0 8,20 * * *` | `Script.Start` `bw_pump` | Gießfenster `winA`/`winB`, 30 s nach der vollen Minute – so läuft `bw_pump` nie gleichzeitig mit `bw_main` (geteilter Heap) |
| `0 8 8,20 * * *` | `Switch.Set` aus | Sicherheits-Aus: 30 s + `tWin` 420 s + 10 s, auf volle Minuten aufgerundet = 8 min nach dem Fenster |

Haben `winA` und `winB` verschiedene Minuten, sind es bis zu fünf Einträge (je zwei für Fenster und Sicherheits-Aus). Die Schedule-IDs vergibt das Gerät; die Konsole nennt sie als `Zeitplan #<id>: <timespec>`. KVS ansehen: `tools/kvs_dump.sh <ip>` oder im Browser `http://<ip>/rpc/KVS.GetMany?match=*`.

> **Nur Zeitraffer:** Im Praxistest aus Kapitel 12 baut derselbe Installer den Zeitplan aus `cfg3.winEvery`: Takt <!-- zr:cfg3.tick -->3<!-- /zr --> min, Fenster alle <!-- zr:cfg3.winEvery -->6<!-- /zr --> min (`0 */3 * * * *`, `30 */6 * * * *`) und das Sicherheits-Aus als Minutenliste `40 2,8,14,…,56 * * * *`.

### 10 Aufbau am Topf, erste Zeile, erstes Fenster

1. Sensor in den Topf unter die Tropfer stecken (nassester Punkt – die Skala bezieht sich darauf).
2. Schlauchende mit den Tropfern am Sensor auslegen.
3. Behälter füllen, Schwimmer über dem Pumpeneinlauf.
4. Erste Konsolenzeile von `bw_main` lesen: Web-UI → Scripts → `bw_main` → Konsole, oder `node tools/console.js <ip> 900` – das hört 900 s mit und erwischt so den nächsten 15-min-Takt. Vorher verbinden, sonst fehlt die erste Zeile.
5. In der Zeile prüfen: `V=` zeigt eine Spannung, `tC=` eine Temperatur, `lvl=` 0 oder 1. Sonst `idV`/`idT`/`idLvl` in `cfg1` anpassen.
6. Erstes Fenster mitlesen: `node tools/console.js <ip> 900` ab 07:59 bzw. 19:59, oder Web-UI → Scripts → `bw_pump` → Konsole. `hwtest.js watch` hilft hier nicht: im Normalbetrieb endet es nach wenigen Sekunden, weil kein Test-Script läuft.

Ein Handstart von `bw_main` ist erlaubt, aber nicht in den Sekunden 0–8 einer Taktminute: dort läuft gerade der Zeitplan-Start (am Gerät 5–7,5 s), und zwei Läufe teilen sich den Heap.

Erwartung im Takt vor dem Fenster: `why=ok sec=70` (Feuchte unter `pctLo`, erste Gabe mit `tStd` <!-- def:cfg3.tStd -->70<!-- /def --> s). Im Fenster folgen `Fenster: Auftrag 70 s …`, `m0 … → P1 …`, `P1 …`, gegebenenfalls `P2 …` und `ergebnis=…`; `soak` = <!-- def:cfg3.soak -->30<!-- /def --> min später `Kontrolle: … → … %`. Liegt die Feuchte bei `pctLo` oder darüber, steht `why=feucht` und es gibt keine Gabe – das ist kein Fehler.

> **Achtung (Wasser/Strom):** Die Relaisspule hängt am potenzialfreien Kontakt OUT1 (max. 30 V / 300 mA); der Relaiskontakt schaltet die Pumpe. Arbeiten an 230 V nur durch eine Elektrofachkraft. Beim Hantieren mit Wasserglas und Behälter Stecker und Kabel trocken halten.

## Wann der Installer erneut laufen muss

| Auslöser | Was der Installer dann tut |
| --- | --- |
| Änderung von `cfg3.tick`, `cfg3.winEvery`, `cfg3.winA`/`winB`, `cfg3.tMax`, `cfg4.tWin` oder `cfg4.tTail` | Baut Zeitplan, Sicherheits-Aus und `auto_off` neu |
| Script-Update | Ergänzt neue Felder mit Startwert (z. B. `cfg4`, `cfg2.pctOk`, `cfg3.dryDay`, `lrn.effW`); ohne ihn stoppen `bw_main` bzw. `bw_pump` mit `err=cfg` („cfg3.tick fehlt“, „cfg4.tWin fehlt“) |
| Teil-Schreiben eines Eintrags per `KVS.Set` | Ergänzt die übrigen Felder des Eintrags wieder mit Startwerten |
| Rückkehr aus dem Zeitraffer: Sicherung `zrb1` steht, Marke `zr` fehlt | Schreibt das Original zurück und löscht die Sicherung (`node tools/hwtest.js <ip> normal 60`) |

Solange `bw_main` oder `bw_pump` läuft, bricht er ab – dann einfach im nächsten sicheren Moment wiederholen.

## Beispielausgabe

Installer-Konsole bei einer frischen Installation (Mock, `node tools/run-script.js scripts/bw_install.js`; am Gerät kamen am 13.09.2026 dieselben drei Zeitplan-Zeilen, die Schedule-IDs vergibt das Gerät):

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

So wartet `hwtest.js` auf den sicheren Moment (Gerät, 13.09.2026, 15:49, Auszug – die Zeilen sind bei `normal`, `zeitraffer` und `kal` gleich):

```text
warte – Sekunde 52, warte auf 8–30
warte – Sekunde 0, warte auf 8–30
sicherer Moment: 15:50:09
```

`verify-scripts.js` nach dem Upload – Ausgabeformat des Werkzeugs, am 15.09.2026 gegen einen lokalen Stub mit dem aktuellen `dist/` erzeugt, kein Gerätelauf; Script-IDs wie am Gerät am 13.09.2026 (echter Lauf: [19 · Prüfprotokoll am Gerät](19-pruefprotokoll.md)):

```text
Script 1 bw_install      15978 Byte am Gerät,  15978 Byte dist/, 22 Doku-Zeilen, v0.1.3 – OK, byteidentisch
Script 2 bw_main         15791 Byte am Gerät,  15791 Byte dist/, 8 Doku-Zeilen, v0.2.0 – OK, byteidentisch
Script 3 bw_pump         17475 Byte am Gerät,  17475 Byte dist/, 5 Doku-Zeilen, v0.2.0 – OK, byteidentisch
Script 7 bw_zeitraffer    7459 Byte am Gerät,   7459 Byte dist/, 12 Doku-Zeilen, v0.2.0 – OK, byteidentisch
4 Scripts mit dist/ verglichen, alle byteidentisch
```

Erste Konsolenzeile von `bw_main`, solange das Band unvollständig ist (Mock: `pctOk` fehlt noch → `why=cfg`, die Sensoren werden trotzdem gelesen):

```text
[bw_main 0.2.0] V=1.2 pct=34.13 tC=24 lvl=0 st=beob dry=0 pause=24h why=cfg sec=- effW=- sf=0.7 err=cfg w=4 dauer=2620ms
```

Takt und Fenster am Gerät (13.09.2026, 15:51–15:57, Zeitraffer-Profil: deshalb `pause=0.2h`, `sec=12` und `Frist 120 s`; im Normalbetrieb stehen dort `pause=24h`, `sec=70` und `Frist 420 s`):

```text
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] m0 10.4 % → P1 12 s
[bw_pump 0.2.0] P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)
[bw_pump 0.2.0] P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
[bw_main 0.2.0] Kontrolle: 50.5 → 53.7 % sf=0.7
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `why=cfg`, `err=cfg` in jedem Takt | Ein Bandfeld in `cfg2` ist `null`, das Band ist ungeordnet, oder nach einem Script-Update fehlt ein Feld („cfg3.tick fehlt“, „cfg4.tWin fehlt“) | Alle sechs Bandfelder eintragen (Schritt 7), Ordnung prüfen, Installer erneut starten |
| `SyntaxError: Got EOF` oder `ReferenceError` beim Start | Der Web-Editor hat beim Einfügen Text verloren | `put-script.js` verwenden, danach `verify-scripts.js`; erst dann den Code selbst verdächtigen |
| `err=uhr`, kein Takt | Keine Uhrzeit per NTP seit dem Neustart | WLAN/NTP prüfen; ohne Uhr läuft auch der Zeitplan nicht |
| `ABBRUCH: Script bw_main läuft – später erneut starten` | Installer im Takt oder im Fenster gestartet | `normal 60` wartet den sicheren Moment ab (Sekunde 8–30, bis 9 min nach dem Fenster nicht) |
| `ABBRUCH: Script bw_main nicht gefunden` | Name weicht ab | Scripts exakt `bw_install`, `bw_main`, `bw_pump` nennen |
| Handstart von `bw_main` zur vollen Taktminute | Läuft neben dem Zeitplan-Start – zwei Scripts teilen sich den Heap (13.09.2026: `out_of_memory`, als `bw_pump` zur selben Sekunde wie `bw_main` startete) | Auf Sekunde 8–30 warten |
| `hwtest.js watch` endet nach Sekunden | Im Normalbetrieb läuft kein Test-Script | Erstes Fenster mit `console.js <ip> 900` oder der Web-UI-Konsole lesen |
| `watch`/`console.js` zeigen keine Konsolenzeilen | Debug-Websocket aus | Web-UI → Scripts → Konsole öffnen (oder `Sys.SetConfig` `debug.websocket.enable`) |
| Erste Zeile eines Laufs fehlt | `console.js` erst nach `Script.Start` verbunden | Erst verbinden, dann starten (`console.js <ip> <sek> <id>` macht beides) |
| `Hinweis: Schedule.Create … abgelehnt` | Zweite Ablehnung derselben Timespec | Konsole und Web-UI → Schedules prüfen, Installer wiederholen |
| Web-UI zeigt `[object Object]` | Der Eintrag liegt als JSON-Objekt statt als String im KVS (0.1.0-Eintrag oder `KVS.Set` mit Objekt als `value`) – die Web-UI kann nur Strings anzeigen | Nicht in der Web-UI speichern (sie schriebe den Text `[object Object]` zurück); Eintrag per `KVS.Set` mit String-Wert neu schreiben oder löschen und den Installer starten |
| `Flash zu voll` beim Upload | `fs_free` reicht nicht für Datei plus 4 096 B Reserve | Test-Scripts löschen: `node tools/hwtest.js <ip> delete <id>` |
| `why=feucht` im ersten Fenster, keine Gabe | Taktmessung liegt bei `pctLo` oder darüber | Kein Fehler; Erde trocknen lassen oder Band an der Pflanze herleiten (Kapitel 12) |

## Weiter zu

- [11 · Hardware-Check (bw_hwtest, bw_hwpump)](11-hardware-check.md) – Sensoren, Schwimmer und Pumpe im Interview prüfen; `vDry`/`vWet` werden gemessen und geschrieben.
- [12 · Erstinbetriebnahme: Kalibrierung, Zielband, Zeitraffer, erstes Fenster](12-erstinbetriebnahme.md) – eigenes Band herleiten und den ganzen Ablauf einmal in 45 Minuten sehen.
- Für die Schritte 2 bis 5 und 8 dein Weg: [07 · per Hand](07-installation-per-hand.md), [08 · lokaler Server](08-installation-lokaler-server.md), [09 · VPS](09-installation-vps.md), [10 · Claude Code](10-installation-claude-code.md).
