# 08 · Installation mit lokalem Server (PC oder Raspberry im LAN)

**Deutsch** · [English](../en/08-installation-lokaler-server.md) — [Handbuch](README.md) · Teil C „Installieren“

> **Auf einen Blick**
> - Ergebnis: alle Scripts liegen byteidentisch am Gerät, der Installer hat Zeitplan und `auto_off` gesetzt, die erste Konsolenzeile ist gelesen – alles vom Rechner aus mit `node tools/…` gegen die IP des Shelly.
> - Umfang: sieben Handgriffe in fester Reihenfolge – `npm test`, `npm run build`, `preflight`, `put-script.js` je Script, `verify-scripts.js`, Zielband, `normal 60`.
> - Wichtigste Zahl: Node ≥ 22 auf dem Rechner (globales `WebSocket` für `hwtest.js` und `console.js`); `npm test` läuft mit <!-- fact:tests -->146<!-- /fact --> Tests ohne ein einziges Fremdpaket.
> - Größter Stolperstein: der Debug-Websocket des Shelly ist aus – dann zeigen `watch` und `console.js` keine Zeile. Einmal in der Web-UI die Konsole öffnen; `preflight` meldet danach `Debug-Websocket an`.

## Voraussetzungen

- Hardware nach [05 · Verkabelung und Hardware-Aufbau](05-verkabelung-und-aufbau.md) verdrahtet; Shelly im WLAN, Uhr per NTP, Zeitzone gesetzt (die Fenster `winA`/`winB` sind Ortszeit).
- Gerät vorbereitet wie in [06 · Startanleitung](06-startanleitung.md), Schritt 1: Voltmeter, 1-Wire-Fühler, IN2 als Typ „Switch“; die Scripts `bw_install`, `bw_main`, `bw_pump` mit exakt diesen Namen angelegt, keines auf „Run on startup“.
- Ein Rechner im selben Netz – PC, Notebook oder Raspberry Pi – mit git und Node ≥ 22; die IP des Shelly, im Folgenden `<ip>` (z. B. `192.168.88.10`).
- Debug-Websocket an: Web-UI → Scripts → ein Script → Konsole öffnen (setzt `debug.websocket.enable`).
- Sonst nichts: das Projekt hat keine Abhängigkeiten, es wird kein Paket nachinstalliert.

## Diagramm

[![Sequenz: Vorprüfung, Upload, byteidentische Prüfung, Installer und Konsole vom PC aus](../diagramme/de/08-installation-lokaler-server.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/08-installation-lokaler-server.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/08-installation-lokaler-server.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Upload und Prüfung“, 2 „Installer und Kontrolle“, 3 „Mitlesen“.

## Node und git auf dem Rechner

Die Tests und der Build laufen ab Node 20; die beiden Geräte-Werkzeuge brauchen das eingebaute `WebSocket`, das es erst ab Node 22 gibt. Nimm gleich Node 22, dann passt alles.

| Werkzeug | Node | Grund |
| --- | --- | --- |
| `npm test`, `npm run build`, `put-script.js`, `verify-scripts.js` | ≥ 20 | `node --test` und eingebautes `fetch` |
| `hwtest.js`, `console.js` | ≥ 22 | globales `WebSocket` für die Geräte-Konsole (`ws://<ip>/debug/log`) |

Auf Debian, Ubuntu und Raspberry Pi OS (64 Bit):

```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v            # muss v22 oder höher zeigen
```

Unter Windows und macOS genügen die Installer von nodejs.org (Version 22 oder neuer) und git; die Befehle in diesem Kapitel sind dort dieselben.

## Repo holen, Tests, Build

```bash
git clone https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50.git
cd Plant-watering-Shelly-SMT50
npm test           # 146 Tests gegen den Mock – müssen grün sein
npm run build      # schreibt dist/: der Code, der aufs Gerät kommt
```

`scripts/` ist die lesbare Quelle, `dist/` die Kompakt-Ausgabe: der Build entfernt Kommentare, Einrückung und Leerzeilen; nur die Versionszeile und die Kurzdoku (`//!`-Zeilen) bleiben stehen. **Nur `dist/` kommt aufs Gerät.** Der Ordner ist eingecheckt; wer `scripts/` ändert oder ein Update einspielt, führt vorher `npm run build` aus, sonst geht alter Code aufs Gerät.

| Script | Version | Größe `dist/` | Grenze (`tools/build.js`) |
| --- | --- | --- | --- |
| `bw_install` | <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> | <!-- fact:dist.bw_install -->15 978<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_main` | <!-- fact:ver.bw_main -->0.2.0<!-- /fact --> | <!-- fact:dist.bw_main -->15 791<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_pump` | <!-- fact:ver.bw_pump -->0.2.0<!-- /fact --> | <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B | <!-- fact:size_limit_pump -->18 000<!-- /fact --> B |
| `bw_zeitraffer` | <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact --> | <!-- fact:dist.bw_zeitraffer -->7 459<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_hwtest` | <!-- fact:ver.bw_hwtest -->0.1.0<!-- /fact --> | <!-- fact:dist.bw_hwtest -->13 952<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_hwpump` | <!-- fact:ver.bw_hwpump -->0.1.0<!-- /fact --> | <!-- fact:dist.bw_hwpump -->14 500<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |

Die Grenze schützt den Script-Heap des Geräts (etwa 25 KB, von allen Scripts geteilt); der Build meldet `ÜBER LIMIT`, wenn ein Script sie reißt. Für die Installation brauchst du die ersten drei Scripts, `bw_zeitraffer` für den Zeitraffer in [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md); die beiden Hardware-Test-Scripts kommen erst in [11 · Hardware-Check](11-hardware-check.md) aufs Gerät.

## Vorprüfung: preflight und scripts

```bash
node tools/hwtest.js <ip> preflight   # Uhr, Scripts, Eingang, Ausgang, Sensoren, KVS, Debug-Websocket
node tools/hwtest.js <ip> scripts     # Liste: id, Name, Byte am Gerät, läuft?, mem_peak; fs_free
```

`preflight` fragt das Gerät per HTTP-RPC ab (`Sys.GetStatus`, `Script.List`, `Input.GetConfig`, `Sys.GetConfig`) und druckt je Zeile `ok`, `WARNUNG` oder `BLOCKER`; am Ende steht `Vorprüfung ohne Blocker` (Exit 0) oder die Zahl der Blocker (Exit 1).

| Zeile | Bedeutung | Stufe |
| --- | --- | --- |
| Uhrzeit, Sekunden bis zum nächsten `bw_main`-Takt, `ram_free`, `fs_free` | Uhr per NTP gesetzt; Flash und RAM des Geräts | Blocker, wenn die Uhr fehlt |
| Fenster `winA`/`winB`/Mitternacht näher als 30 min | für Tests am Gerät lieber später | Warnung |
| Debug-Websocket an/aus | ohne ihn zeigen `watch` und `console.js` keine Konsole | Warnung |
| Script … läuft | ein Betriebs-Script schreibt gerade KVS | Blocker (Test-Script: Warnung) |
| Scripts: `1=bw_install, 2=bw_main, …` | IDs, wie sie das Gerät vergeben hat | Info |
| Script `bw_zeitraffer` angelegt als id … | `preflight` legt es per `Script.Create` an, wenn es fehlt (mit `preflight hw` auch `bw_hwtest`/`bw_hwpump` – kosten Flash) | Info |
| Upload `bw_zeitraffer`: … Byte am Gerät – `node tools/put-script.js …` | fertiger Upload-Befehl mit der richtigen ID | Info |
| Input 1 (Wasserstand) deaktiviert oder falscher Typ | Eingang muss `enable` und Typ `switch` sein | Blocker → `node tools/hwtest.js <ip> input-on` |
| Ausgang (Pumpe) ist EIN | Relais steht auf ein | Blocker |
| Sensoren `V=… tC=… lvl=…`, `err`/`job`/`day`/`hwt` | aktuelle Messwerte und Zustand im KVS | Info |

`input-on` ist die einzige Konfigurationsänderung, die das Werkzeug vornimmt (`Input.SetConfig {enable: true, type: "switch"}`), und nur auf Zuruf.

## Hochladen: put-script.js

Erst `scripts` ansehen – je Script eine Zeile `Script <id> <Name> … Byte` (oder die `preflight`-Zeile `Scripts: 1=bw_install, 2=bw_main, …`) – und dann mit den eigenen IDs hochladen. Die IDs vergibt das Gerät beim Anlegen; `put-script.js` prüft den Namen nicht, es lädt stur auf die angegebene ID. Die IDs hier sind die des Referenzgeräts vom 13.09.2026.

```bash
node tools/put-script.js <ip> 1 dist/bw_install.js
node tools/put-script.js <ip> 2 dist/bw_main.js
node tools/put-script.js <ip> 3 dist/bw_pump.js
node tools/put-script.js <ip> 7 dist/bw_zeitraffer.js   # für 12; preflight hat das Script angelegt
```

Was ein Aufruf tut, in dieser Reihenfolge:

1. `Sys.GetStatus.fs_free` plus der alte Code des Scripts müssen die neue Datei plus 4 096 B Reserve fassen, sonst bricht das Werkzeug ab, bevor halb geschriebener Code am Gerät liegt.
2. `Script.Stop` auf die ID – `Script.PutCode` geht nur bei gestopptem Script.
3. `Script.PutCode` in Stücken zu 1 024 Zeichen (`append: true` ab dem zweiten Stück); Zeichen statt Byte, damit kein Umlaut zerschnitten wird.
4. `Script.GetCode` lädt den Code komplett zurück; er muss **byteidentisch** zur Datei sein, nicht nur gleich lang.
5. Eine Zeile Ergebnis: Byte gesendet, Stücke, Byte am Gerät, Doku-Zeilen, `OK, byteidentisch` oder `FEHLER, Code weicht ab`, `fs_free` vorher → nachher. Exit 0 nur bei OK.

> **Am Gerät gemessen (12.09.2026):** Der Script-Editor der Web-UI hat beim Einfügen 166 bzw. 210 Byte am Dateiende verloren; das Script startete mit `SyntaxError: Got EOF`. Deshalb der Upload per RPC – und nach jedem Upload die Prüfung im nächsten Abschnitt, auch wenn du doch einmal den Editor benutzt hast.

> **Hinweis:** Nicht in ein Gießfenster hinein hochladen und nicht in Sekunde 0–8 einer Taktminute: `put-script.js` stoppt das Script, das es beschreibt. `preflight` nennt die Sekunden bis zum nächsten `bw_main`-Takt und warnt, wenn `winA`/`winB` oder Mitternacht näher als 30 min liegen.

## Prüfen: verify-scripts.js

```bash
node tools/verify-scripts.js <ip>            # alle Scripts am Gerät, zu denen es eine dist/-Datei gibt
node tools/verify-scripts.js <ip> bw_main    # nur die genannten
```

Das Werkzeug lädt jeden Code per `Script.GetCode` komplett herunter, vergleicht ihn Byte für Byte mit `dist/`, zählt die Doku-Zeilen im Kopf und liest die Version (`var VER`) aus. Weicht ein Script ab, nennt es das erste abweichende Zeichen und den passenden `put-script.js`-Befehl. `bw_main` und `bw_pump` teilen sich `st`, `job` und `lrn`: tragen sie verschiedene Versionen, meldet es `VERSIONEN WEICHEN AB` – dann beide hochladen. Exit 0 = alle gleich, 1 = Abweichung.

Der Aufruf gehört nach jedem Upload dazu und ist der erste Griff, wenn ein Script am Gerät „unerklärlich“ mit `ReferenceError` oder `Got EOF` abbricht: erst Upload prüfen, dann Code.

## Kalibrierwerte und Zielband eintragen

Vor dem Installer trägst du `cfg1` (Sensor) und `cfg2` (Zielband) ein; KVS-Werte sind JSON-Strings. Ein Teilobjekt reicht jetzt noch, weil der Installer im nächsten Schritt alle fehlenden Felder ergänzt. Nach dem Installer ersetzt `KVS.Set` dagegen den ganzen Eintrag – später ein Feld ändern heißt dann: Web-UI → Key-Value Storage → „Format as JSON“ → nur das Feld ändern, oder nach einem Teil-Schreiben den Installer erneut laufen lassen.

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg1","value":"{\"vDry\":0.296,\"vWet\":3.134}"}'
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctDry\":28,\"pctLo\":40,\"pctOk\":50,\"pctSoll\":55,\"pctHi\":60,\"dropSlow\":4}"}'
```

> **Am Gerät gemessen (13.09.2026):** `vDry` 0,296 V (Sensor trocken in Luft), `vWet` 3,134 V (im Wasserglas); die Startwerte des Installers sind <!-- def:cfg1.vDry -->0.20<!-- /def --> / <!-- def:cfg1.vWet -->3.13<!-- /def --> V. Das Beispielband ist das des Referenzgeräts in Bandordnung `pctDry` < `pctLo` < `pctOk` ≤ `pctSoll` < `pctHi`; `dropSlow` 4 stand dort seit dem Lauf mit 0.1.x und ist noch nicht an der Pflanze gemessen.

Solange eines der sechs Bandfelder (`pctSoll`, `pctLo`, `pctOk`, `pctHi`, `pctDry`, `dropSlow`) `null` ist, misst das System nur und meldet `why=cfg`. Die Herleitung der Werte steht in [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md), alle Felder in [03 · Konfiguration](03-konfiguration.md).

## Installer im sicheren Moment: normal 60

```bash
node tools/hwtest.js <ip> normal 60   # wartet den sicheren Moment ab, startet bw_install, liest mit, prüft das Ergebnis
```

`normal` heißt so, weil derselbe Befehl aus dem Zeitraffer zurück in den Normalbetrieb führt; ohne Zeitraffer-Sicherung läuft `bw_install` einfach als Installer. Das Werkzeug prüft zuerst, dass `bw_install` am Gerät existiert, und wartet dann auf einen sicheren Moment (Abfrage alle 2 s, höchstens 4 min, sonst Abbruch mit Exit 1):

| Bedingung | Grund |
| --- | --- |
| Sekunde 8–30 der Minute | `bw_main` vom Takt (Sekunde 0) ist fertig, der nächste Start ist weit weg |
| bis einschließlich Minute 9 nach `winA`/`winB` gesperrt, frei ab Minute 10 | das Fenster läuft bis 30 s + `tWin`, der Sicherheits-Aus liegt bei +8 min; Meldung `Gießfenster 08:00 gerade vorbei, Fenster läuft bis 9 min danach` |
| kein Betriebs- oder Test-Script läuft | geteilter Script-Heap; ein laufendes Script schreibt gerade KVS |
| Uhr gesetzt | ohne Uhrzeit kein Zeitplan |

Dann öffnet es den Debug-Websocket, ruft `Script.Start` für `bw_install` und liest die Konsole, bis das Script fertig ist. Der Installer selbst:

1. liest alle KVS-Einträge und holt die IDs von `bw_main` und `bw_pump` per Name aus `Script.List`; läuft eines davon, bricht er ab (`ABBRUCH: Script bw_main läuft – später erneut starten`).
2. legt die neun Einträge `cfg1`, `cfg2`, `cfg3`, `cfg4`, `lrn`, `st`, `job`, `day`, `err` an, soweit sie fehlen, und ergänzt fehlende Felder mit Startwerten – vorhandene Werte überschreibt er nie.
3. prüft die Fensterregel: ein Fenster muss samt Budget `tWin` und Reserve `tTail` vor dem nächsten Takt enden (`(Minute mod tick)·60 + 30 + tWin + tTail ≤ tick·60`; mit Startwerten 470 ≤ 900 s).
4. löscht seine eigenen Zeitplan-Einträge und legt sie neu an; die erste Ablehnung eines `Schedule.Create` („timespec validation“) wiederholt er stumm.
5. setzt `bw_main` und `bw_pump` auf `enable: false` – kein Autostart, der Zeitplan startet sie.
6. konfiguriert den Ausgang: `initial_state` off, `auto_off` nach `tMax` + 10 s.
7. schreibt die Zusammenfassung und beendet sich per `Script.Stop`.

| Zeitplan-Eintrag | timespec (Startwerte) | Wirkung |
| --- | --- | --- |
| Takt | `0 */15 * * * *` | `Script.Start bw_main` alle <!-- def:cfg3.tick -->15<!-- /def --> min zur Sekunde 0 |
| Gießfenster | `30 0 8,20 * * *` | `Script.Start bw_pump` um <!-- def:cfg3.winA -->08:00<!-- /def --> und <!-- def:cfg3.winB -->20:00<!-- /def -->, jeweils Sekunde 30 – nie neben `bw_main` |
| Sicherheits-Aus | `0 8 8,20 * * *` | `Switch.Set off` 8 min nach der Fensterminute: 30 s + `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s + 10 s, aufgerundet |

Drei Einträge entstehen, wenn `winA` und `winB` dieselbe Minute haben; sonst bis zu fünf. Die Konsole nennt jeden als `Zeitplan #<id>: <timespec>`, die Nummern vergibt das Gerät. `auto_off` steht danach auf `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> + 10 = 190 s.

Nach dem Lauf vergleicht `normal` das Gerät mit `cfg3`/`cfg4`: Zeitplan-Einträge wie erwartet, `auto_off` = `tMax` + 10, keine Zeitraffer-Marke `zr` und keine Sicherung `zrb1`…`zrb5`, kein Fehler in `Script.GetStatus` der vier Scripts, freier Script-Heap. Steht am Ende `NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet`, bist du fertig; bei `N Abweichungen – Konsole prüfen` den Lauf wiederholen.

> **Hinweis:** Der Installer läuft erneut nach jeder Änderung von `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin` oder `tTail` – und nach jedem Script-Update, weil er neue cfg-Felder ergänzt. Wer ihn stattdessen in der Web-UI mit „Start“ anstößt ([07 · Installation per Hand](07-installation-per-hand.md)), muss den sicheren Moment selbst einhalten.

## Konsole mitlesen

```bash
node tools/console.js <ip> 900        # 900 s mithören: die nächste bw_main-Zeile kommt spätestens nach 15 min
node tools/console.js <ip> 12 2       # verbindet, startet Script 2 (bw_main) von Hand, hört 12 s zu
node tools/hwtest.js <ip> status      # Einzeiler: laufende Scripts, V, tC, lvl, Ausgang
```

`console.js` verbindet sich mit `ws://<ip>/debug/log`, startet auf Wunsch ein Script erst danach (so geht die erste Zeile nicht verloren) und beendet sich nach der Wartezeit von selbst. Es zeigt alles roh, auch Firmware-Zeilen wie `shelly_ejs_rpc.cpp` – das ist Rauschen, kein Script-Output.

`hwtest.js watch` filtert das meiste davon weg (abgeschnittene Zeilen wie `lly_user_script.cpp:371 JS RAM stat: …` bleiben sichtbar und sind ebenfalls Rauschen), endet im Normalbetrieb aber nach wenigen Sekunden, weil kein Test-Script läuft; für ein echtes Gießfenster ist `console.js <ip> 900` ab 07:59 bzw. 19:59 das richtige Werkzeug.

Die erste Zeile von `bw_main` zeigt, ob die Peripherie stimmt: `V=` Spannung des SMT50, `tC=` Temperatur, `lvl=` 0 oder 1. Fehlt ein Wert, passen `idV`/`idT`/`idLvl` in `cfg1` nicht zu den Komponenten. Ein Handstart von `bw_main` ist erlaubt, nur nicht in Sekunde 0–8 einer Taktminute, weil es sonst neben dem Zeitplan-Start läuft.

## Werkzeuge im Überblick

| Befehl | Zweck | Node |
| --- | --- | --- |
| `npm test` | <!-- fact:tests -->146<!-- /fact --> Tests gegen den Mock, inklusive 7-Tage-Simulation, Hardware-Tests und Zeitraffer-Fahrplan | ≥ 20 |
| `npm run check` | `node --check` der sechs Scripts | ≥ 20 |
| `npm run build` | `dist/` schreiben (Versionszeile und `//!`-Doku bleiben) | ≥ 20 |
| `node tools/put-script.js <ip> <id> dist/<script>.js` | Upload in Stücken plus byteidentische Prüfung | ≥ 20 |
| `node tools/verify-scripts.js <ip> [name …]` | alle Scripts am Gerät gegen `dist/` vergleichen, Versionen prüfen | ≥ 20 |
| `node tools/console.js <ip> [sek] [id]` | Geräte-Konsole mitlesen, optional ein Script starten | ≥ 22 |
| `node tools/hwtest.js <ip> preflight \| scripts \| delete <id> \| input-on` | Vorprüfung, Script-Liste mit `fs_free`, Test-Script löschen, Eingang aktivieren | ≥ 22 |
| `node tools/hwtest.js <ip> normal [sek] \| watch [sek] \| status` | Installer im sicheren Moment, Konsole mit Statuszeile, Einzeiler | ≥ 22 |
| `tools/kvs_dump.sh <ip>` | alle KVS-Einträge und `Sys.GetStatus` (mit `kvs_rev`) per curl ausgeben | sh, curl |
| `node tools/run-script.js scripts/<script>.js --seed …` | ein Script gegen den Mock laufen lassen (ohne Gerät) | ≥ 20 |

Die vollständige Referenz aller Unterbefehle von `hwtest.js` (Hardware-Test, Zeitraffer, Messlauf, Kalibrierlauf) steht in [14 · Debuggen und Testen](14-debuggen-und-testen.md).

## Fernzugriff (optional)

Steht der Rechner nicht im Heimnetz – etwa ein VPS, auf dem auch Claude Code läuft –, bringt ein SSH-Rückwärtstunnel den Shelly dorthin; `<ip>` heißt dann `127.0.0.1:8010`, alle Befehle bleiben gleich. Der Aufbau steht in [09 · Installation mit VPS-Server](09-installation-vps.md), die Installation im Interview mit der KI in [10 · Installation mittels Claude Code](10-installation-claude-code.md).

## Beispielausgabe

Build, Upload eines Scripts und Prüfung aller vier – Byte-Zahlen aus dem aktuellen `dist/`, `fs_free` vom Gerätelauf am 13.09.2026 (49 152 B frei mit vier Scripts, 40 960 B nach dem Upload von `bw_pump`; das Dateisystem rechnet in 4-KB-Blöcken):

```text
$ npm run build
bw_install.js    23789 →  15978 Byte, 22 Doku-Zeilen
bw_main.js       23059 →  15791 Byte, 8 Doku-Zeilen
bw_pump.js       20330 →  17475 Byte, 5 Doku-Zeilen
bw_hwtest.js     16792 →  13952 Byte, 4 Doku-Zeilen
bw_hwpump.js     18736 →  14500 Byte, 4 Doku-Zeilen
bw_zeitraffer.js 13822 →   7459 Byte, 12 Doku-Zeilen
dist/ geschrieben – hochladen mit node tools/put-script.js <ip> <id> dist/<datei>, prüfen mit node tools/verify-scripts.js <ip>

$ node tools/put-script.js 192.168.88.10 3 dist/bw_pump.js
dist/bw_pump.js → Script 3: 17475 Byte in 18 Stücken gesendet, 17475 Byte am Gerät (PutCode len=17475), 5 Doku-Zeilen – OK, byteidentisch; fs_free 49152 → 40960

$ node tools/verify-scripts.js 192.168.88.10
Script 1 bw_install      15978 Byte am Gerät,  15978 Byte dist/, 22 Doku-Zeilen, v0.1.3 – OK, byteidentisch
Script 2 bw_main         15791 Byte am Gerät,  15791 Byte dist/, 8 Doku-Zeilen, v0.2.0 – OK, byteidentisch
Script 3 bw_pump         17475 Byte am Gerät,  17475 Byte dist/, 5 Doku-Zeilen, v0.2.0 – OK, byteidentisch
Script 7 bw_zeitraffer    7459 Byte am Gerät,   7459 Byte dist/, 12 Doku-Zeilen, v0.2.0 – OK, byteidentisch
4 Scripts mit dist/ verglichen, alle byteidentisch
```

Installer über `normal 60` bei der Frischinstallation dieses Kapitels (`cfg1`/`cfg2` als Teilobjekte aus dem Abschnitt oben, sonst leerer KVS) – Zeilenform und Reihenfolge aus dem Code, im Mock nachgestellt; Uhrzeit, Script-IDs, Messwerte und Speicherwerte sind gerätespezifisch, `…` steht für Werte, die je Lauf anders sind. Die `[status …]`-Zeilen kommen vom Werkzeug (alle 5 s, nur bei Änderung) und mischen sich je nach Laufzeit zwischen die Installer-Zeilen:

```text
$ node tools/hwtest.js 192.168.88.10 normal 60
kein Zeitraffer aktiv – bw_install läuft als normaler Installer (ergänzt fehlende Felder, baut den Zeitplan)
warte – Sekunde 52, warte auf 8–30
sicherer Moment: <HH:MM:SS>
Script.Start bw_install (id 1) → {"was_running":false}
[status <HH:MM>] läuft: bw_install | V=1.196 tC=22.0 lvl=false sw=aus | hwr: - | hwp: -
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] KVS cfg1 ergänzt: vErrLo,vErrHi,nSample,msSample,lvlEmpty,nLvl,idV,idT,idLvl,idSw
[bw_install 0.1.3] KVS cfg2 ergänzt: hyst,effMin,effMax,alpha,sfMin,sfStep,dropW,sfUp
[bw_install 0.1.3] Zeitplan: 0 Einträge, davon eigene: 0
[bw_install 0.1.3] Switch 0: auto_off 190 s
[bw_install 0.1.3] KVS neu angelegt: cfg3, cfg4, lrn, st, job, day, err
[bw_install 0.1.3] Zeitplan #1: 0 */15 * * * *
[bw_install 0.1.3] Zeitplan #2: 30 0 8,20 * * *
[bw_install 0.1.3] Zeitplan #3: 0 8 8,20 * * *
[bw_install 0.1.3] fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach
[status <HH:MM>] läuft: - | V=1.196 tC=22.0 lvl=false sw=aus | hwr: - | hwp: -
kein bw_install läuft mehr
ok       Zeitplan: #1 [0 */15 * * * *] #2 [30 0 8,20 * * *] #3 [0 8 8,20 * * *]
ok       auto_off 190 s
ok       keine Zeitraffer-Sicherung
ok       cfg3/cfg4: Takt 15 min, Fenster 08:00/20:00, tMax 180 s, tWin 420 s, Sicherheits-Aus +8 min
ok       Script-Heap frei: 25200, ram_free …, kvs_rev …
NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet
```

Bei einem Update statt einer Frischinstallation nennt der Installer nur die neuen Felder – Gerätelauf am 13.09.2026 (Prüfprotokoll): `KVS cfg2 ergänzt: dropW,sfUp`, `KVS cfg3 ergänzt: dryDay`, `KVS neu angelegt: cfg4`; Zeitplan `0 */15`, `30 0 8,20`, `0 8 8,20`, `auto_off` 190 s, keine Abweichung.

Die erste Taktzeile danach, je Takt eine (`why` = Grund für oder gegen einen Auftrag, `w` = KVS-Schreibvorgänge, `dauer` = Laufzeit) – im Mock nachgestellt mit den `cfg1`/`cfg2`-Werten von oben, 1,196 V, 22 °C, Schwimmer VOLL; `dry=0`, weil der Installer `st.dryOk` mit `false` anlegt:

```text
[bw_main 0.2.0] V=1.196 pct=31.712 tC=22 lvl=0 st=beob dry=0 pause=24h why=ok sec=70 effW=- sf=0.7 err=- w=3 dauer=2600ms
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `ReferenceError: WebSocket is not defined` bei `console.js`; `normal`/`watch` zeigen nur `[status …]`-Zeilen und keine Konsolenzeilen (sieht aus wie Debug-Websocket aus) | Node älter als 22 | `node -v` prüfen, Node 22 installieren (Abschnitt oben) |
| `Flash zu voll: fs_free … < … + Reserve 4096` | der Flash für Scripts ist knapp; Test-Scripts belegen ihn (13.09.2026: 12 288 B frei mit sieben Scripts, 49 152 B mit vier) | `node tools/hwtest.js <ip> scripts`, dann `delete <id>` für ein Test-Script – Betriebs-Scripts löscht das Werkzeug nie |
| `Fehler: Script.PutCode: …` beim Upload | das Script lief noch (`Script.Stop` fehlgeschlagen, z. B. mitten im Takt oder Fenster) – `Script.PutCode` geht nur bei gestopptem Script | in der Web-UI stoppen bzw. `preflight` abwarten (`Script … läuft`), Upload wiederholen, dann `verify-scripts.js` |
| `FEHLER, Code weicht ab (N Byte Differenz)` bzw. `WEICHT AB ab Zeichen N` | Übertragung gestört oder Code aus dem Web-Editor unvollständig | `put-script.js` für dieses Script wiederholen, danach `verify-scripts.js` |
| `VERSIONEN WEICHEN AB: bw_main v…, bw_pump v…` | nur eines der beiden Scripts aktualisiert | beide aus demselben `dist/` hochladen – sie teilen `st`, `job`, `lrn` |
| `WARNUNG  Debug-Websocket aus` – `watch`/`console.js` zeigen nichts | `debug.websocket.enable` ist aus | Web-UI → Scripts → Script → Konsole öffnen, `preflight` wiederholen |
| `BLOCKER  Input 1 (Wasserstand) ist deaktiviert` | Eingang nicht als Switch konfiguriert | `node tools/hwtest.js <ip> input-on` |
| `kein sicherer Moment in 4 min: läuft: …` | ein Script läuft dauerhaft oder ein Fenster ist gerade vorbei | Grund in der Meldung lesen; `status` zeigt laufende Scripts; später wiederholen |
| `ABBRUCH: Script bw_pump nicht gefunden` | Script-Name am Gerät weicht ab | Scripts exakt `bw_install`, `bw_main`, `bw_pump` nennen; `scripts` zeigt die Namen |
| `N Abweichungen – Konsole prüfen` nach `normal` | z. B. ein `Schedule.Create` blieb abgelehnt | Konsolenzeilen lesen, `normal 60` wiederholen |
| `why=cfg` in jeder Taktzeile | ein Bandfeld in `cfg2` ist noch `null` | alle sechs Bandfelder eintragen (Abschnitt „Kalibrierwerte und Zielband“) |
| RPC-Fehler mit dem Zusatz `Tunnel 127.0.0.1:8010 offen?` | das Gerät antwortet nicht – im LAN meist falsche IP oder anderes Netz | `curl http://<ip>/rpc/Shelly.GetDeviceInfo` prüfen; über einen Tunnel siehe [09](09-installation-vps.md) |

## Weiter zu

- [11 · Hardware-Check](11-hardware-check.md) – Sensoren, Schwimmer und Pumpe mit `bw_hwtest`/`bw_hwpump` prüfen, `cfg1` messen lassen.
- [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md) – Kalibrierung, Zielband herleiten, einmal alles im Zeitraffer sehen, erstes Fenster.
- [06 · Startanleitung](06-startanleitung.md) – Schritte 9 und 10: Aufbau am Topf und erstes Gießfenster mitlesen.
- [14 · Debuggen und Testen](14-debuggen-und-testen.md) – Mock, Tests und die vollständige Werkzeug-Referenz.
