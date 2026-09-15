# 14 · Debuggen und Testen

**Deutsch** · [English](../en/14-debuggen-und-testen.md) — [Handbuch](README.md) · Teil E „Erweitern“

> **Auf einen Blick**
> - Alles Verhalten wird zuerst ohne Gerät geprüft: `tools/mock/shelly-mock.js` führt die sechs Scripts unverändert aus, `npm test` läuft <!-- fact:tests -->146<!-- /fact --> Tests in rund 6 s, `run-script.js` zeigt Konsole, KVS, Zeitplan und Aufruftiefe eines einzelnen Laufs.
> - Aufs Gerät führt eine feste Kette: `npm run build` → `dist/` (Grenze <!-- fact:size_limit -->16000<!-- /fact --> B, `bw_pump` <!-- fact:size_limit_pump -->18000<!-- /fact --> B) → `put-script.js` (Upload in 1 024-Zeichen-Stücken, Flash-Prüfung) → `verify-scripts.js` (byteidentisch mit `dist/`).
> - Zusehen am Gerät: Debug-Websocket `/debug/log`; `console.js` zeigt alle Zeilen roh, `hwtest.js watch` filtert das Firmware-Rauschen und hängt alle 5 s eine Statuszeile an; `build.js --debug` liefert Scripts mit `DEBUG = 1`.
> - Größter Stolperstein: Fehler, die nur das Gerät zeigt – kein Hoisting, Aufruftiefe (Mock <!-- fact:call_depth -->10<!-- /fact -->, Gerät 12 ok / 14 Absturz), geteilter Script-Heap ~25 KB, Textverlust beim Einfügen im Web-Editor. Ein `ReferenceError` am Gerät heißt zuerst „Upload prüfen“, dann erst „Code prüfen“.

## Voraussetzungen

- Node ≥ 20 für Tests, Build und Mock; Node ≥ 22 für `console.js` und `hwtest.js` (globales `WebSocket`). Keine Abhängigkeiten, nichts nachzuinstallieren.
- Repo geklont; für die Abschnitte am Gerät eine erreichbare Adresse `<ip>` – lokal die IP des Shelly, vom VPS `127.0.0.1:8010` über den Tunnel ([09 · Installation mit VPS](09-installation-vps.md)).
- Debug-Websocket am Gerät eingeschaltet (Web-UI → Scripts → Konsole einmal öffnen); `hwtest.js preflight` meldet, ob er an ist.
- Hilfreich: [01 · Gesamtarchitektur](01-gesamtarchitektur.md) und die harten Regeln für die Scripts in [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md).

## Diagramm

[![Vom Quelltext zum Gerät und zurück: Mock und Tests, Build, Upload mit Prüfung, Konsole über den Debug-Websocket](../diagramme/de/14-debuggen-und-testen.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/14-debuggen-und-testen.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/14-debuggen-und-testen.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Ohne Gerät“, 2 „Aufs Gerät“, 3 „Am Gerät zusehen“.

## Ohne Gerät: der Mock

`tools/mock/shelly-mock.js` (v0.1.4) bildet in Node nach, was die Scripts vom Gerät brauchen. Die Scripts laufen unverändert per `vm.runInNewContext` in einer Sandbox mit den globalen Objekten `Shelly`, `Timer`, `print` und `console`. Alles hängt an einer virtuellen Uhr (Start 12.09.2026 08:00 lokal, UTC+2): RPC-Antworten kommen 20 ms später, Timer feuern in Reihenfolge, jeder Lauf ist deterministisch und dauert real Millisekunden.

| Bereich | Nachbildung | Grenze oder Gerätequirk |
| --- | --- | --- |
| KVS | 50 Schlüssel × 253 Zeichen, Rohwerte als JSON-String, Schreibzähler (`kvsWrites`, `kvs_rev`), `KVS.GetMany` paginiert | Seite 5 Einträge (Gerät 11); ein `KVS.Set` mit Nicht-String-Wert ist ein Fehler |
| Zeitplan | `Schedule.Create/Delete/DeleteAll/List`, Timespec mit 5, 6 oder 7 Feldern samt Sekundenfeld | `schedCreateFailFirst`: der erste `Schedule.Create` je Script-Lauf scheitert wie am Gerät (Retry im Installer) |
| Scripts | Liste mit den sechs Namen; `Script.Start` führt eine registrierte Datei (`dev.files[name]`) als zweites Script aus, eigene Timer und Fehler je Lauf, Laufgeneration gegen späte Callbacks | `Script.GetStatus` liefert feste Werte – der Mock hat kein Speichermodell |
| Switch | `Switch.Set` mit `toggle_after`, `auto_off`, `GetStatus/GetConfig/SetConfig`; Hook `dev.onSwitch` für Modelle | – |
| Sensoren | `Voltmeter`, `Temperature`, `Input` (Status und Konfiguration; deaktivierter Eingang → `state: null`) | Werte als Zahl, `null` oder Funktion der Uhr |
| Sys | `Sys.GetStatus` mit lokaler Uhrzeit, `unixtime`, `ram_free`, `kvs_rev`; `Shelly.getComponentStatus` | `fs_free` konstant |
| Engine-Grenzen | 5 offene RPC, 5 Timer, Aufruftiefe <!-- fact:call_depth -->10<!-- /fact --> je Script (gemessen per `Error().stack` an jeder Engine-Grenze) | Hoisting und Array-Methoden zeigt V8 nicht – das prüft nur `syntax.test.js` |

Die Aufruftiefe misst der Mock bei jedem `print`, `Shelly.call`, `Timer.set` und `JSON.*`; mehr als 10 Ebenen landen als Fehler in `dev.errors`. Am Gerät laufen 12 Ebenen, 14 stürzen mit `Too much recursion` ab (Probe vom 12.09.2026) – deshalb ist die Schrittkette `next()` eine flache Schleife, und der Fenster-Automat von `bw_pump` läuft über einen Tick-Timer mit `busy`-Sperre. Im Mock erreichen die sechs Scripts heute 5–6 Ebenen.

`simulate()` spielt den Zeitplan minutenweise durch: fällige Einträge laufen sekundengenau (Sekundenfeld, dann Anlagereihenfolge), ein Start auf ein noch laufendes Script wird wie am Gerät übersprungen (`was_running`). Jeder Lauf bekommt `maxMs` (Standard 10 min); startet ein Script, während ein früherer Lauf auf der echten Uhr noch liefe, meldet der Überlappungswächter das als Fehler – am Gerät liefen dann zwei Scripts auf dem geteilten Heap.

### Ein Script laufen lassen: run-script.js

`tools/run-script.js` lässt ein einzelnes Script gegen den Mock laufen und druckt Konsole, KVS, Zeitplan, Switch und Ergebnis. Exit-Code 1, wenn Fehler auftraten oder das Script sich nicht beendet hat.

| Option | Wirkung |
| --- | --- |
| `--seed` | vorher `bw_install.js` laufen lassen und ein Beispielband eintragen (`pctSoll` 55, `pctLo` 40, `pctHi` 65, `pctDry` 38, `dropSlow` 4; `pctOk` bleibt `null`) |
| `--voltage 1.2` · `--temp 24` · `--level 0` | Sensorwerte: Spannung des SMT50 in V, Temperatur in °C (`null` = Fühler fehlt), Schwimmer 0/1 |
| `--kvs k=v` | KVS-Eintrag vor dem Lauf setzen, Wert als JSON; mehrfach möglich |
| `--hwdemo` | Hardware-Tests mit virtuellem Bediener (`tools/mock/hwdemo.js`): Uhr 10:07, Laufzeit bis 60 min virtuell, `bw_pump` als zweites Script registriert |

```bash
node tools/run-script.js scripts/bw_install.js                                   # Installer: neun KVS-Einträge, drei Zeitplan-Einträge, auto_off
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0   # ein Takt; mit --seed endet er mit why=cfg (pctOk fehlt)
node tools/run-script.js scripts/bw_main.js --seed --kvs 'cfg2={"pctSoll":55,"pctLo":40,"pctOk":50,"pctHi":60,"pctDry":28,"hyst":2,"dropSlow":4,"effMin":0.05,"effMax":30,"alpha":0.3,"sfMin":0.5,"sfStep":0.1,"dropW":null,"sfUp":0.05}' --voltage 1.2   # vollständiges Band → why=ok sec=70
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":25,"pct":20,"why":"hand","ts":1789192500}'   # Handauftrag; ohne pctOk im Band: Einzelportion
node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo    # Sensortest, sechs Phasen mit Rampen und go-Kommandos
node tools/run-script.js scripts/bw_hwpump.js --seed --hwdemo    # Pumpentest, bw_pump läuft als zweites Script
node tools/run-script.js scripts/bw_zeitraffer.js --seed         # Zeitraffer: Sicherung zrb1..5, Profil, bw_install baut den 3/6-Zeitplan
```

> **Hinweis:** `--seed` legt kein `pctOk` an. `bw_main` meldet dann `why=cfg` (Band offen), `bw_pump` pumpt einen Handauftrag als Einzelportion ohne Messung. Wer den Regelkreis im Fenster sehen will, gibt `cfg2` vollständig per `--kvs` mit – oder nimmt gleich `pump.test.js` mit dem Topfmodell.

### Die Tests: npm test

`npm test` ist `node --test "tools/test/*.test.js"`: <!-- fact:tests -->146<!-- /fact --> Tests (Stand 13.09.2026), alle gegen den Mock, keine Netzverbindung. `npm run check` macht nur `node --check` der sechs Scripts.

| Datei | Prüft | Tests |
| --- | --- | --- |
| `syntax.test.js` | Sprachumfang der Engine je Script: `node --check`, Versionszeile, verbotene Konstrukte (`const`, `class`, Arrow-Functions, Template-Strings, `for…of`, Spread, `Date`, `async`/`Promise`, anonyme Funktionen, `parseInt`/`parseFloat`, Array-Methoden außer `push`/`slice`/`splice`/`indexOf`/`join`), Verwendung vor Deklaration auf Modulebene (kein Hoisting) | 6 |
| `size.test.js` | Kompakt-Ausgabe unter der Größengrenze, gültiges JS, genau die `//!`-Zeilen als Kommentar | 6 |
| `dist.test.js` | eingechecktes `dist/` ist byteidentisch mit dem Build (Copy-&-Paste-Installation) | 1 |
| `docs.test.js` | Doku-Prüfung (`check-docs.js`) ohne Testzahl-Ermittlung | 1 |
| `install.test.js` | Installer: neun KVS-Einträge, Zeitplan mit Sicherheits-Aus, Retry des ersten `Schedule.Create`, Idempotenz, Update alter Stände, statische Fensterprüfung, Abbruch bei laufendem Betriebs-Script | 18 |
| `main.test.js` | `bw_main`: Messung mit Ausreißerschnitt, Bandprüfung, Freigabekette, Dosis, Pausen, Trockentag, Nässe, Tageswechsel, Schreiben nur bei Änderung | 26 |
| `learn.test.js` | Kontrolle `soak` min nach dem Fenster: `zuviel` → `sf`, `sink`, altes `st`, Austrocknungsrate | 11 |
| `pump.test.js` | `bw_pump` als Regelkreis am Topfmodell: Ergebnismatrix aus dem Entscheidungslog (Einzelportion, `ok`, `over`, `feucht`, `nass`, `noeff`, `stall`, `unstab`, `wasser`, `extern`, Claim, `zeit`, `max`) | 20 |
| `potmodel.test.js` | Topfmodell (Rampe, Totzeit, Drain, Hydrophobie, Sättigung, Rauschen), `noBurst`, `simulate` mit Überlappungswächter | 9 |
| `szenario.test.js` | sieben simulierte Tage mit Zeitplan, Austrocknung und Pumpenwirkung; Hitzetage; Pumpe ohne Wirkung | 3 |
| `zeitraffer.test.js` | Zeitraffer aktivieren und zurückbauen, Fahrplan mit Topfmodell sekundengenau, kein Fenster läuft in einen Takt | 7 |
| `hwtest.test.js` · `hwpump.test.js` | Hardware-Test-Scripts mit virtuellem Bediener: Phasen, Kommandos, Kalibrierung, Timeouts; Pumpentest in zwei Durchgängen, Zeitwache, Sicherung und Rückbau | 12 · 15 |
| `kal.test.js` | Rechenkern des Kalibrierlaufs (`tools/lib/kal.js`): Fenster aus Proben, Zustände, Bericht, Schreibplan | 9 |
| `kvs-size.test.js` | Startwerte und realistische Betriebswerte bleiben unter 253 Zeichen je KVS-Wert | 2 |

`tools/test/helpers.js` liefert die gemeinsamen Bausteine: `seeded()` (Installer gelaufen, Beispielband), `patch()` (KVS-Eintrag ändern), `voltFor()` (Spannung zu Feuchte), `hwDevice()` (Gerätezustand vom 12.09.2026), `runHwtest()`, `pumpTest()` (Durchgang A, `bw_pump` allein, Durchgang B) und `runZeitraffer()` (`bw_zeitraffer` plus gestarteter `bw_install`).

### Topfmodell, virtueller Bediener, Konsolen-Burst

| Baustein | Datei | Zweck | Wichtige Parameter |
| --- | --- | --- | --- |
| `potModel(dev, opts)` | `tools/test/helpers.js` | analytisches Topfmodell für den Regelkreis: `dev.voltage` wird zur Funktion der Uhr, Portionen kommen aus dem Switch-Hook | `effLocal` (Wirkung je wirksame Pumpensekunde), `tDead`/`tDead2` (Totzeit erste/weitere Portion), `tRamp`, `delay`, `drainFrac`/`tau` (Drainage), `dryPerH` (Austrocknung), `pHydro` (Hydrophobie), `sat` (Sättigung), `noise`/`seed` (deterministisches Rauschen) |
| `ramps(dev, opts)` · `driver(dev, plan)` | `tools/mock/hwdemo.js` | virtueller Bediener für die Hardware-Tests: Sensor-Rampen je Phase (Fühler kalt/warm, Sensor trocken/nass, Schwimmer) und ein Treiber, der `go`/`skip`/`abort` über den `onRpc`-Hook schickt, sobald das Script `hwc` abfragt | Rampen: `tCold`/`tWarm`, `vDry`/`vWet`, `delay`, `slow`; Treiber-Plan: `key` (`hwr`/`hwp`), `goAfter` je Phase, `skip`, `abort` |
| `noBurst(dev, max)` | `tools/test/helpers.js` | zählt Konsolenzeilen mit demselben virtuellen Zeitstempel – die Geräte-Konsole verliert bei zu vielen synchronen `print`-Zeilen Text, die Regel lautet „nie mehr als 15 am Stück“ (je Portion eine Zeile, der Zustand steht im KVS) | `max` (Standard 15): darüber wirft die Funktion einen Fehler mit den ersten Zeilen; `null` misst nur |

### Was der Mock nicht zeigt

| Eigenheit des Geräts | Folge | Wo sie abgefangen wird |
| --- | --- | --- |
| mJS hoistet keine Funktionsdeklarationen | `ReferenceError` beim Start, wenn `var steps = [...]` vor den Funktionen steht | `syntax.test.js` (`useBeforeDecl`); Schrittliste steht ganz unten |
| Array-Methoden fehlen (`shift`, `forEach`, `map`, …) | `Function "shift" not found!` mitten im Lauf | `syntax.test.js`; Ringpuffer per Index |
| Aufruftiefe: 12 Ebenen laufen, 14 stürzen ab | `Too much recursion` | Mock-Grenze <!-- fact:call_depth -->10<!-- /fact --> als Frühwarnung; flache `next()`-Schleife |
| Script-Heap ~25 KB, von allen Scripts geteilt (`Script.GetStatus.mem_free` 24 920 im Leerlauf) | `out_of_memory` in `errors`, Script endet ohne Konsolenzeile | keine Nachbildung – `hwtest.js watch` zeigt `mem_used`/`mem_peak` im Zeitraffer, `hwtest.js scripts` (oder `Script.GetStatus`) während eines Laufs; Referenzwerte in [18 · Lernlog vom Gerät](18-lernlog-geraet.md) |
| `KVS.GetMany` liefert 11 Einträge je Seite | wer nur die erste Seite liest, übersieht Einträge | Mock paginiert mit 5, alle Leser paginieren |
| Web-Editor verliert beim Einfügen Text | `Got EOF` oder `ReferenceError` erst beim Start | `put-script.js` und `verify-scripts.js` vergleichen byteidentisch |
| erster `Schedule.Create` je Lauf wird abgelehnt | Zeitplan unvollständig | Installer wiederholt bis zu 3× nach 400 ms; Mock bildet den Quirk nach |

Jede neue Überraschung vom Gerät kommt nach [18 · Lernlog vom Gerät](18-lernlog-geraet.md) – und, wo sie sich statisch prüfen lässt, als Regel in `syntax.test.js`.

## Bauen: build.js und dist/

`npm run build` (`tools/build.js` v<!-- fact:ver.build -->0.1.1<!-- /fact -->) schreibt für jedes der sechs Scripts eine Kompakt-Ausgabe nach `dist/`: Kommentare, Einrückung und Leerzeilen fallen weg, Zeile 1 (Versionskommentar) bleibt, und Kommentarzeilen mit `//!` bleiben als `// …` stehen – das ist die Geräte-Doku, die im Script-Editor des Shelly lesbar ist. `scripts/` bleibt die Quelle; nur `dist/` kommt aufs Gerät.

Die Größengrenze schützt den geteilten Heap: <!-- fact:size_limit -->16000<!-- /fact --> Byte je Script, `bw_pump` darf <!-- fact:size_limit_pump -->18000<!-- /fact --> Byte, weil es dank der Frist nie neben `bw_main` läuft (Firmware 2.0.0 speichert auch 19 KB). Über der Grenze meldet der Build `ÜBER LIMIT` und endet mit Exit-Code 1; `size.test.js` und `dist.test.js` halten beides fest.

Aktuelle Größen der Kompakt-Ausgabe: `bw_install` <!-- fact:dist.bw_install -->15978<!-- /fact -->, `bw_main` <!-- fact:dist.bw_main -->15791<!-- /fact -->, `bw_pump` <!-- fact:dist.bw_pump -->17475<!-- /fact -->, `bw_hwtest` <!-- fact:dist.bw_hwtest -->13952<!-- /fact -->, `bw_hwpump` <!-- fact:dist.bw_hwpump -->14500<!-- /fact -->, `bw_zeitraffer` <!-- fact:dist.bw_zeitraffer -->7459<!-- /fact --> Byte. `bw_install` und `bw_main` liegen nahe an der Grenze – vor größeren Erweiterungen aufteilen oder kürzen.

```bash
npm run build                 # dist/ schreiben, Größen und Doku-Zeilen je Script anzeigen
node tools/build.js --debug   # dasselbe mit var DEBUG = 1 in jeder Datei – nur zum Debuggen hochladen
```

> **Hinweis:** `dist/` ist eingecheckt, damit die Installation per Copy & Paste ohne Node auskommt ([07 · Installation per Hand](07-installation-per-hand.md)). Nach jeder Änderung an `scripts/` gehört ein frisches `npm run build` dazu, sonst schlägt `dist.test.js` fehl.

## Aufs Gerät: put-script.js und verify-scripts.js

Der Web-Editor hat beim Einfügen Text verloren (12.09.2026: 166 bzw. 210 Byte fehlten – einmal das Dateiende, einmal ein Stück aus der Mitte; der Rest parste und starb erst beim Start). Deshalb geht der Upload per RPC – und wird danach geprüft.

1. `node tools/put-script.js <ip> <id> dist/<script>.js` (v<!-- fact:ver.put-script -->0.1.2<!-- /fact -->): prüft zuerst den Flash (`Sys.GetStatus.fs_free` plus alter Code des Scripts muss die neue Datei plus 4 096 Byte Reserve fassen), stoppt das Script (`Script.PutCode` geht nur bei gestopptem Script) und schickt die Datei in Stücken von 1 024 Zeichen (`append: true` ab dem zweiten).
2. Danach lädt es den Code per `Script.GetCode` komplett zurück und vergleicht ihn Byte für Byte mit der Datei. Exit-Code 0 nur bei `OK, byteidentisch`; sonst `FEHLER, Code weicht ab (N Byte Differenz)` – dann einfach erneut hochladen.
3. `node tools/verify-scripts.js <ip>` (Prüfung 2, v0.1.1): vergleicht alle Scripts am Gerät, die es in `dist/` gibt, zählt die Doku-Zeilen und prüft, dass `bw_main` und `bw_pump` dieselbe Version tragen (sie teilen sich `st`, `job`, `lrn`). Exit-Code 0 = alle gleich, 1 = Abweichung, 2 = Aufruffehler.

```bash
node tools/put-script.js <ip> <id> dist/bw_main.js   # Script-ID aus der Web-UI oder aus hwtest.js scripts
node tools/verify-scripts.js <ip>                    # nach jedem Upload, auch nach einem Upload per Editor
node tools/verify-scripts.js <ip> bw_main bw_pump    # nur bestimmte Scripts
```

Die Script-IDs vergibt das Gerät beim Anlegen; die Scripts und Werkzeuge suchen per Name. `hwtest.js scripts` zeigt alle Scripts mit ID, Größe, `mem_peak` und `fs_free`.

> **Am Gerät gemessen (13.09.2026):** Flash ist knapp. Mit sieben Scripts blieben `fs_free` 12 288 B; nach dem Löschen von `engine_probe`, `bw_hwtest` und `bw_hwpump` (per `Script.Delete`, heute `hwtest.js delete`) waren es 49 152 B (≈ 36 KB gewonnen), nach dem Upload von `bw_pump` mit 17 475 B noch 40 960 B – LittleFS rechnet in 4-KB-Blöcken. Ist der Flash zu voll, bricht `put-script.js` vor dem ersten Stück ab, damit kein halb geschriebener Code liegen bleibt.

## Am Gerät zusehen

### Debug-Websocket und console.js

Alle `print`-Zeilen der Scripts kommen über den Debug-Websocket `ws://<ip>/debug/log`. Er ist nur an, wenn `Sys.GetConfig` → `debug.websocket.enable` `true` ist; die Web-UI schaltet das beim Öffnen der Konsole ein, `hwtest.js preflight` warnt, wenn er aus ist. Ohne ihn sehen `console.js`, `hwtest.js watch` und der Rekorder von `kal` keine einzige Zeile.

`node tools/console.js <ip> [sek] [id]` (v<!-- fact:ver.console -->0.1.0<!-- /fact -->) verbindet sich, startet optional ein Script per `Script.Start` und sammelt `sek` Sekunden lang (Standard 10) alle Zeilen roh – auch das Firmware-Rauschen. Die Verbindung steht, bevor das Script startet; sonst fehlt die erste Zeile. Für ein ganzes Gießfenster reichen 900 s.

```bash
node tools/console.js <ip> 12 <id>    # verbinden, Script <id> starten, 12 s mitlesen
node tools/console.js <ip> 900        # ein ganzes Gießfenster ab 08:00:30 mitlesen (vorher starten)
```

### hwtest.js watch und die Statuszeile

`node tools/hwtest.js <ip> watch [sek]` liest denselben Websocket, filtert die Firmware-Zeilen weg, verbindet sich nach einem Abriss neu und schreibt alle 5 s eine Statuszeile, sobald sie sich ändert. Standard 120 s, höchstens 300 s; im Zeitraffer 1 800 s. Im Normalbetrieb endet `watch` nach wenigen Sekunden, wenn kein Test-Script läuft – nur die Hardware-Tests und der Zeitraffer (Sicherung `zrb1` vorhanden) halten es offen.

- Statuszeile normal: `[status HH:MM] läuft: … | V= tC= lvl= sw= | hwr: … | hwp: …`.
- Statuszeile im Zeitraffer: `ZEITRAFFER st=<state>/<why> n= sec= pctB= pctW= effW= tr= job=<why>/<sec> day.n= err= mem(used/peak) main=… pump=… free=…` – `mem` kommt aus `Script.GetStatus` und zeigt `!out_of_memory`, wenn ein Script abgestürzt ist.
- Im Pumpentest startet `watch` Durchgang B von `bw_hwpump` automatisch, sobald `bw_pump` fertig ist.

### DEBUG = 1

In jedem Script steht direkt unter `var VER` die Zeile `var DEBUG = 0;`. Auf `1` schreibt `dbg()` zusätzlich jeden Schritt (`schritt i/n`), jeden RPC-Aufruf mit Parametern (`rpc <Methode> <Parameter>`), jeden gelesenen KVS-Eintrag mit Typ und Inhalt (`kvs <Schlüssel> <Typ> <JSON>`) sowie Messwerte in die Konsole – als `[bw_main dbg] …`. Neue Diagnosepunkte kommen als `dbg(...)`, nie als `log(...)`.

Nicht jedes Script kennt alle drei Muster: `bw_pump` (Tick-Automat) loggt nur `rpc <Methode>` ohne Parameter und seine Messwerte (`ring …`), `bw_hwtest` die KVS-Einträge ohne Typ, `bw_hwpump` gar keine KVS-Einträge.

1. `node tools/build.js --debug` – `dist/` mit `DEBUG = 1`, ohne Handänderung im Editor.
2. Betroffenes Script mit `put-script.js` hochladen, `console.js` verbinden und starten.
3. Für den Normalbetrieb wieder `npm run build` und erneut hochladen; im Repo bleibt `DEBUG = 0`.

> **Hinweis:** Die Debug-Fassung ist größer und redet mehr. Nicht dauerhaft im Zeitplan lassen – der Websocket verliert bei Schwällen Zeilen, und der Heap ist geteilt.

### Firmware-Rauschen in der Konsole

Neben den `print`-Zeilen liefert der Websocket Zeilen der Firmware. Sie sind kein Script-Output und kein Fehler:

| Zeile | Bedeutung |
| --- | --- |
| `shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`, `y_notifications.cpp`, `shelly_debug.cpp`, `shelly_script.cpp`, `shos_init.c`, `mgos_…` | RPC- und Script-Verwaltung; `watch` filtert genau diese Präfixe |
| `JS RAM stat … used: N` beim Start | Heap nach dem Parsen (13.09.2026, Fassungen 0.1.x: `bw_hwtest` 3 564, `bw_main` 5 404, `bw_pump` 7 396 B; `bw_main` 0.2.0: 5 348 B) |
| `shelly_ejs_timer.cpp:44 Timer 1 handle not found` nach einem `bw_main`-Lauf | `Timer.clear` auf den eigenen wiederholenden Timer aus dessen Callback – harmlos |
| `persistent_counters.cpp:585 PCS write interval < 60s` | Zählerschreiben des Switch bei Portionen im Abstand unter 60 s – harmlos |
| `JS Error [id] out_of_memory used=… peak=… total=…` | ein Script ist am geteilten Heap gestorben – ernst, siehe Typische Fehler |

### Nachsehen per RPC

Jede Frage an das Gerät geht auch ohne Werkzeug per HTTP; die Antworten sind JSON. Vollständige Liste mit Parametern und Doku-Links: [20 · RPC- und Engine-Referenz](20-rpc-referenz.md).

| Frage | Aufruf | Worauf achten |
| --- | --- | --- |
| Was steht im KVS? | `curl -s "http://<ip>/rpc/KVS.GetMany?match=*"` oder `tools/kvs_dump.sh <ip>` | paginiert (11 je Seite); das Shell-Script liest alle Seiten und hängt `Sys.GetStatus` an |
| Ist das Script abgestürzt, wie viel Heap? | `curl -s "http://<ip>/rpc/Script.GetStatus?id=<id>"` | `errors` (z. B. `out_of_memory`, bleibt bis zum nächsten Lauf), `mem_used`, `mem_peak`, `mem_free` |
| Liegt der Code vollständig am Gerät? | `curl -s "http://<ip>/rpc/Script.GetCode?id=<id>&len=1"` | `left + 1` muss der Dateigröße entsprechen; besser `verify-scripts.js` |
| Stimmt der Zeitplan? | `curl -s http://<ip>/rpc/Schedule.List` | `jobs[].timespec`: `0 */15 * * * *`, `30 0 8,20 * * *`, `0 8 8,20 * * *` mit den Startwerten |
| Flash, RAM, Uhrzeit, Schreibzähler? | `curl -s http://<ip>/rpc/Sys.GetStatus` | `fs_free`, `ram_free`, `time`/`unixtime` (`null` ohne NTP), `kvs_rev` |
| Ist der Debug-Websocket an? | `curl -s http://<ip>/rpc/Sys.GetConfig` | `debug.websocket.enable` |

## Werkzeug-Referenz

Alle Werkzeuge liegen in `tools/` und brauchen keine Abhängigkeiten; die Geräte-Werkzeuge nehmen die Adresse `<ip>` als erstes Argument. Exit-Codes: 0 ok, 1 Fehler oder Blocker, 2 Aufruffehler.

| Werkzeug | Version | Aufruf | Zweck |
| --- | --- | --- | --- |
| `build.js` | <!-- fact:ver.build -->0.1.1<!-- /fact --> | `npm run build` · `node tools/build.js --debug` | `dist/` schreiben, Größen prüfen, `//!`-Doku behalten |
| `run-script.js` | 0.1.1 | `node tools/run-script.js scripts/<script>.js [--seed] [--voltage V] [--temp C] [--level 0/1] [--kvs k=v] [--hwdemo]` | ein Script gegen den Mock laufen lassen |
| `mock/shelly-mock.js` · `mock/hwdemo.js` | 0.1.4 · 0.1.0 | Bibliothek für Tests und `run-script.js` | Gerät in Node; virtueller Bediener |
| `put-script.js` | <!-- fact:ver.put-script -->0.1.2<!-- /fact --> | `node tools/put-script.js <ip> <id> dist/<script>.js` | Upload in Stücken mit Flash-Prüfung und byteidentischem Vergleich |
| `verify-scripts.js` | 0.1.1 | `node tools/verify-scripts.js <ip> [name …]` | alle Scripts am Gerät gegen `dist/` vergleichen, Versionen `bw_main` = `bw_pump` |
| `console.js` | <!-- fact:ver.console -->0.1.0<!-- /fact --> | `node tools/console.js <ip> [sek] [id]` | Konsole roh mitlesen, optional Script starten (Node ≥ 22) |
| `hwtest.js` | <!-- fact:ver.hwtest -->0.1.2<!-- /fact --> | `node tools/hwtest.js <ip> <kommando> [args]` | Hardware-Tests, Zeitraffer, Messlauf, Kalibrierlauf, Scripts am Gerät (Node ≥ 22); Unterbefehle unten |
| `kvs_dump.sh` | 0.1.0 | `tools/kvs_dump.sh <ip>` | alle KVS-Seiten roh plus `Sys.GetStatus` |
| `lib/kal.js` | 0.1.1 | Bibliothek für `hwtest.js kal` | Rechenkern des Kalibrierlaufs, ohne Gerät testbar (`kal.test.js`) |
| `probe/engine_probe.js` | 0.1.5 | per `put-script.js` hochladen, mit `console.js` starten | Sondier-Script für Engine-Eigenheiten (KVS.Set-Varianten, Antwortformat, Stacktiefe); läuft nicht im Mock |

### hwtest.js: Unterbefehle

Die Abläufe selbst stehen in [11 · Hardware-Check](11-hardware-check.md) (Sensor- und Pumpentest) und [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md) (Zeitraffer, Messlauf, Kalibrierlauf); hier nur, was jedes Kommando tut.

| Kommando | Tut |
| --- | --- |
| `preflight [hw]` | Vorprüfung: Uhrzeit, Sekunden bis zum nächsten Takt, Abstand zu `winA`/`winB`/Mitternacht, laufende Scripts, Input 1, Switch 0, KVS (`err`, `job`, `day`, `hwt`, `hwb*`), Debug-Websocket; legt `bw_zeitraffer` per `Script.Create` an, mit `hw` auch `bw_hwtest`/`bw_hwpump` (kosten Flash – nur bei Bedarf), und nennt die Upload-Befehle. Exit 1 bei Blockern |
| `scripts` | alle Scripts mit ID, Größe am Gerät, laufend, `mem_peak`, Fehlern; dazu `fs_free`, `ram_free`, freier Script-Heap |
| `delete <id>` (oder Name) | Test-Script per `Script.Delete` löschen, `fs_free` vorher/nachher; nie `bw_install`, `bw_main`, `bw_pump`, `bw_zeitraffer` |
| `input-on` | `Input.SetConfig` für `cfg1.idLvl`: `enable: true`, `type: "switch"` – die einzige Konfigänderung, nur auf Zuruf |
| `cfg k=v …` | Felder in `hwt` setzen, Werte als JSON (z. B. `cfg pumpSec=30 tLo=21`); Wert bleibt unter 253 Zeichen |
| `start bw_hwtest [sek]` · `start bw_hwpump [sek]` | `hwc {n:0}` schreiben, alten Bericht (`hwr`/`hwp`) löschen, Script per Name starten, dann `watch` (`sek`, Standard 60) |
| `watch [sek]` | Konsole gefiltert plus Statuszeile alle 5 s; endet, wenn kein Test-Script mehr läuft (Zeitraffer: rein zeitgesteuert), sonst nach `sek` (Standard 120, max 300, Zeitraffer 1 800); startet Durchgang B des Pumpentests automatisch |
| `go` · `skip` · `abort` | Kommando an die wartende Phase: `hwc` mit `n + 1` schreiben; `skip` überspringt (Code `sk`), `abort` beendet den Lauf (Code `ab`) |
| `status` | Einzeiler: laufende Scripts, `hwr`, `hwp`, Sensoren, Switch; im Zeitraffer die Zeitraffer-Statuszeile |
| `report` | `hwr`/`hwp` lesbar (Phasencodes `ok`, `sk`, `to`, `ab`, `fe`, `nl`, `aw`) mit Vergleich zu `cfg1` |
| `restore` | `hwb1`/`hwb2` nach `st`/`day`/`job`/`err`/`lrn` zurückschreiben, `job.ok` auf `false`, Sicherung löschen – nur wenn `bw_hwpump` nicht läuft |
| `cleanup` | `hwc`, `hwb1`, `hwb2` löschen; `hwt`, `hwr`, `hwp` bleiben als Nachweis |
| `stop` | Not-Aus: `Script.Stop` für `bw_hwtest`, `bw_hwpump`, `bw_zeitraffer`, `bw_pump` und `Switch.Set {on:false}`; danach `restore` |
| `zeitraffer [sek]` | Praxistest im Zeitraffer: Vorprüfung (Zielband vollständig und geordnet, `cfg3.tick`, Wasserstand VOLL, Ausgang aus, Code aller vier Betriebs-Scripts, keine `hwb*`), sicherer Moment, `Script.Start bw_zeitraffer`, mitlesen, danach Zeitplan/`cfg3`/`cfg4`/`auto_off`/Sicherung prüfen, Fahrplan zeigen |
| `normal [sek]` | zurück zum Normalbetrieb bzw. Installer nach einem Update: sicherer Moment, `Script.Start bw_install`, mitlesen, danach Zeitplan, `auto_off`, keine Sicherung mehr, keine Script-Fehler |
| `mess [sek] [n] [beob]` | Messlauf: `n` Pulse (1–6) à `sek` s (1–10) per `Switch.Set toggle_after`, Sensor alle 2 s über `beob` s (30–300, Standard 90) je Puls; je Puls Feuchte vorher, `tRise`, Spitze, Ruhewert, Gewinn %/s; Vorschläge für `effMax`, `tPmin`, `tMin`, `tDead`, `tSoak`, `tStab`; Rohdaten `docs/kal/<datum>-mess.json`. Nur bei Ausgang aus, Schwimmer VOLL, kein Zeitraffer |
| `kal [sek]` | Kalibrierlauf: Zeitraffer wie oben, Fahrplan trocken → mittel feucht → nass, Rekorder alle 5 s (Sensoren, Ausgang, `st`/`job`/`lrn` bei Änderung, Konsolenzeilen von `bw_main` und `bw_pump`) über `sek` s (600–3 600, Standard 2 400) nach `docs/kal/<datum>-kal.json`, am Ende Bericht; der Zeitraffer läuft weiter |
| `kal report [datei] [log]` | Bericht aus der jüngsten Aufzeichnung: je Fenster Zustand nach `m0`, Portionen, Σ s, `tRise`, Spitze, Ruhewert, `effW`, `why`; Gewinn je Zustand; Vorschläge `lrn.effW` (Skala „% je s nach tRise“), `cfg4.tDead2`, `cfg3.tDead`. `log` zieht Konsolenzeilen aus einer `watch`-Logdatei nach |
| `kal write [datei] [log]` | Vorschläge schreiben (`lrn.effW` als Mischung α 0,5 mit dem Vorwert, `cfg4.tDead2`, `cfg3.tDead`, `cfg3.tMin`) – nur im Normalbetrieb (verweigert bei `zrb1`), Lesen-Ändern-Schreiben, Vorher/Nachher in der Ausgabe |

Sicherer Moment (`zeitraffer`, `normal`, `mess`): Sekunde 8–30 der Minute (der Takt von `bw_main` ist fertig, der nächste weit weg); im Zeitraffer nicht in den Minuten 0–2 des 6er-Zyklus (dort regelt `bw_pump`); im Normalbetrieb nicht in den 9 min nach `winA`/`winB`; kein Betriebs- oder Test-Script läuft. Das Werkzeug wartet bis zu 4 min darauf.

### Doku-Werkzeuge

| Befehl | Tut |
| --- | --- |
| `npm run docs:geruest` | Indexe `docs/de/README.md` und `docs/en/README.md` aus `tools/docs/kapitel.json` neu schreiben, fehlende Kapitel als Platzhalter anlegen (vorhandene nie überschreiben) |
| `npm run docs:diagramme` · `node tools/docs/build-diagramme.mjs --only NN` | Archify-Diagramme aus `docs/diagramme/src/` bauen: validieren, HTML und SVG in beiden Sprachen, Quittung, Galerie; `--check` vergleicht nur die Prüfsummen |
| `npm run docs:check` · `node tools/check-docs.js --nur docs/de/NN-slug.md` | Doku-Prüfung: Links und Anker, Bilder, Parität DE/EN, Kapitelvorlage, Fakt- und Startwert-Marker gegen die Scripts, veraltete Ausdrücke, Lesbarkeit, Diagramm-Quittungen; `--mit-tests` ermittelt die Testzahl |

### Repo-Aufbau auf einen Blick

Wo was liegt (Stand 13.09.2026; `npm test` läuft <!-- fact:tests -->146<!-- /fact --> Tests aus `tools/test/`):

```text
scripts/      bw_install.js, bw_main.js, bw_pump.js, bw_hwtest.js, bw_hwpump.js, bw_zeitraffer.js  ← Quelle; laufen auf dem Shelly
dist/         Kompakt-Ausgabe der sechs Scripts für den Upload (eingecheckt, byteidentisch zum Build)
tools/        build.js, put-script.js, verify-scripts.js, console.js, hwtest.js, run-script.js, kvs_dump.sh, check-docs.js
tools/mock/   shelly-mock.js (Gerät in Node), hwdemo.js (virtueller Bediener)
tools/lib/    kal.js (Rechenkern des Kalibrierlaufs)
tools/probe/  engine_probe.js (Sondier-Script fürs Gerät, läuft nicht im Mock)
tools/test/   *.test.js für node --test, helpers.js (seeded, potModel, pumpTest, runZeitraffer …)
tools/docs/   Gerüst, Diagramm-Build, kapitel.json, verboten.json  ← Doku-Werkzeuge
docs/         de/ und en/ (dieses Handbuch), diagramme/ (src/ → de/, en/, receipts/), kal/ (Rohdaten der Mess- und Kalibrierläufe)
hardware/     Stückliste, Verdrahtung
.claude/      skills/graft/SKILL.md, settings.json; daneben .mcp.json (graft als MCP-Server)
README.md · CLAUDE.md (harte Regeln für die Scripts) · AGENTS.md (Regeln für KI-Agenten) · LICENSE
```

Konzept, Etappenlog, Lernlog vom Gerät, Prüfprotokoll und RPC-Referenz stehen in den Kapiteln [16 · Konzept und Entscheidungen](16-konzept-und-entscheidungen.md) bis [20 · RPC- und Engine-Referenz](20-rpc-referenz.md) dieses Handbuchs.

## graft

Das Repo ist mit graft indexiert (`graft/`, gitignored; der Index frischt sich vor jeder Abfrage selbst auf). Für Codefragen zuerst graft fragen, dann gezielt die genannte Stelle öffnen – das spart Zeit und bei Agenten Kontext. Die Installation von graft ist nicht Teil dieses Repos; ohne graft funktionieren `grep` und die Dateien in `scripts/` und `tools/` genauso. Details: [`.claude/skills/graft/SKILL.md`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/.claude/skills/graft/SKILL.md).

```bash
graft ask "wie entsteht der Gießauftrag" --source   # Fundstellen mit Datei:Zeile und Code
graft grep "toggle_after"                           # jedes Vorkommen, nach Funktion gruppiert
graft skeleton scripts/bw_pump.js                   # alle Signaturen einer Datei in ~200 Tokens
graft callers writeNext --depth 2                   # wer ruft ein Symbol – vor Umbenennungen
graft map                                           # Orientierung: Verzeichnisse, Hubs
graft check                                         # passt der Index zum Code? (CI)
graft build --deep                                  # Konzeptknoten nach größeren Änderungen
```

## Beispielausgabe

Echte Ausgaben der Werkzeuge im Repo-Stand vom 13.09.2026 (Mock und Build laufen ohne Gerät):

```text
$ npm test
…
ok 146 - Fahrplan im Zeitraffer (Topfmodell): feucht → Fenster 1 in Portionen → 12 min Pause → Fenster 2 → Hitze-Fenster nach 6 min → wasser → Fenster 4 → limit, 42 min
…
1..146
# tests 146
# suites 0
# pass 146
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5873.687028
```

```text
$ npm run build
bw_install.js    23789 →  15978 Byte, 22 Doku-Zeilen
bw_main.js       23059 →  15791 Byte, 8 Doku-Zeilen
bw_pump.js       20330 →  17475 Byte, 5 Doku-Zeilen
bw_hwtest.js     16792 →  13952 Byte, 4 Doku-Zeilen
bw_hwpump.js     18736 →  14500 Byte, 4 Doku-Zeilen
bw_zeitraffer.js 13822 →   7459 Byte, 12 Doku-Zeilen
dist/ geschrieben – hochladen mit node tools/put-script.js <ip> <id> dist/<datei>, prüfen mit node tools/verify-scripts.js <ip>
```

```text
$ node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
--- Konsole ---
[bw_main 0.2.0] V=1.2 pct=34.13 tC=24 lvl=0 st=beob dry=0 pause=24h why=cfg sec=- effW=- sf=0.7 err=cfg w=4 dauer=2620ms
--- KVS (13 Schreibvorgänge im Lauf: 4) ---
cfg1  139 {"vDry":0.2,"vWet":3.13,"vErrLo":0.1,"vErrHi":3.35,"nSample":5,"msSample":500,"lvlEmpty":1,"nLvl":3,"idV":100,"idT":100,"idLvl":1,"idSw":0}
…
job    63 {"ok":false,"sec":null,"pct":34.13,"why":"cfg","ts":1789192800}
day    35 {"date":"2026-09-12","n":0,"sec":0}
err    43 {"code":"cfg","ts":1789192800,"mem":120000}
--- Zeitplan ---
1 0 */15 * * * * [{"method":"Script.Start","params":{"id":2}}]
2 30 0 8,20 * * * [{"method":"Script.Start","params":{"id":3}}]
3 0 8 8,20 * * * [{"method":"Switch.Set","params":{"id":0,"on":false}}]
--- Switch 0 --- {"initial_state":"off","auto_off":true,"auto_off_delay":190,"auto_on":false,"auto_on_delay":0} output=false
--- Ergebnis --- beendet=true Dauer=2620 ms, max. offene RPC=1, max. Aufruftiefe=5, Fehler=0
```

So liest man das: Der Takt misst 34,1 % (1,2 V bei `vDry` 0,20 / `vWet` 3,13), aber `pctOk` ist `null` → `why=cfg`, `err=cfg`, vier Schreibvorgänge (`w=4`: `lrn` mit dem Tagesmaximum, `day` mit dem Datum, `job`, `err`; `st` blieb unverändert).

Der Zeitplan trägt die Sekunde 30 für `bw_pump` und das Sicherheits-Aus 8 min nach dem Fenster; `auto_off` steht auf `tMax` + 10 = 190 s. Die Ergebniszeile ist die eigentliche Prüfung: `beendet=true` (Script hat sich per `Script.Stop` beendet), höchstens ein offener RPC, Aufruftiefe 5 von erlaubten <!-- fact:call_depth -->10<!-- /fact -->, keine Fehler.

> **Am Gerät gemessen (13.09.2026):** Upload der vier Betriebs-Scripts per `put-script.js` und `verify-scripts.js`: `bw_pump` 17 475, `bw_main` 15 791, `bw_install` 15 978, `bw_zeitraffer` 7 453 B, alle `OK, byteidentisch`, Versionen `bw_main` = `bw_pump` = 0.2.0. Im ersten Regelkreis-Fenster zeigte die `watch`-Statuszeile für `bw_pump` `mem_used` 10 360–10 500 und `mem_peak` 12 516 bei `mem_free` 25 200 – zusammen mit den 5 348 B Parse-Bedarf von `bw_main` bleibt das unter 25 000.

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `put-script.js` meldet `FEHLER, Code weicht ab (N Byte Differenz)` | Transfer zum Gerät war nicht verlustfrei | erneut hochladen; nie per Editor einfügen, ohne danach `verify-scripts.js` zu laufen |
| `Script.PutCode` scheitert | Script läuft noch – `put-script.js` stoppt es vorher; oder `Flash zu voll: fs_free …` | Test-Scripts mit `hwtest.js scripts` / `delete <id>` entfernen (13.09.2026: +36 KB), dann erneut |
| `Uncaught ReferenceError: "…" is not defined` oder `Got EOF expected '}'` beim Start am Gerät | Dateiende oder Mitte fehlt (Editor) – oder ein Funktionsname wird auf Modulebene vor der Deklaration benutzt | zuerst `verify-scripts.js`; dann `npm test` (`syntax.test.js` nennt beide Zeilen) |
| `Too much recursion - the stack is about to overflow` | verschachtelte Aufrufkette tiefer als etwa 12 Ebenen | `next()` als Schleife: Schritte geben `true` zurück, Callbacks rufen `next()`; der Mock warnt ab <!-- fact:call_depth -->10<!-- /fact --> |
| `Function "shift" not found!` (oder `map`, `forEach` …) | mJS kennt nur `push`, `slice`, `splice`, `indexOf`, `join` | Ringpuffer per Index; `syntax.test.js` schlägt an, sobald die Methode im Code steht |
| `Script.GetStatus` → `errors: ["out_of_memory"]`, Script endet ohne Konsolenzeile | zwei große Scripts zur selben Zeit auf dem geteilten Heap (~25 KB): Test-Script neben `bw_main`, `bw_pump` zur selben Sekunde wie `bw_main` | nie zwei große Scripts gleichzeitig; Langläufer geben `K`/`orig` in Wartephasen frei; `bw_pump` startet bei Sekunde 30; `mem_peak` mit `hwtest.js watch` (Zeitraffer) oder `hwtest.js scripts` / `Script.GetStatus` während des Laufs messen |
| Konsole voller `shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`, `y_notifications.cpp` … | Firmware-Rauschen, kein Script-Output | ignorieren; `hwtest.js watch` filtert es, `console.js` zeigt es roh |
| `console.js` zeigt nichts, `watch` keine Konsolenzeilen | Debug-Websocket aus | Web-UI → Scripts → Konsole öffnen (schaltet `debug.websocket.enable` ein); `preflight` prüft es |
| erste Konsolenzeile eines Scripts fehlt | Websocket war beim `Script.Start` noch nicht verbunden | `console.js <ip> <sek> <id>` startet das Script erst nach dem Verbinden |
| `hwtest.js watch` endet nach wenigen Sekunden | im Normalbetrieb läuft kein Test-Script, das es offen hält | für ein echtes Fenster `console.js <ip> 900` oder die Web-UI-Konsole |
| Konsole verliert Zeilen bei vielen `print` am Stück | Schwall über ~15 Zeilen überfordert den Websocket | Zustand ins KVS, eine Zeile je Portion; `noBurst()` im Mock prüft es |
| `Hinweis: Schedule.Create '…' abgelehnt (…), Versuch 2/3` | schon die zweite Ablehnung desselben Eintrags (die erste wiederholt der Installer stumm, nur als `dbg`) | der Installer versucht es bis zu 3× nach 400 ms; scheitert auch der letzte Versuch, steht `Schedule.Create '…': <Fehlertext>` ohne `Hinweis` – dann `Schedule.List` ansehen, Installer erneut starten (`hwtest.js normal`) |
| `npm test` rot in `dist.test.js` | `scripts/` geändert, `dist/` nicht neu gebaut | `npm run build`, `dist/` mit einchecken |
| `run-script.js` endet mit `beendet=false` | Script hat sich nicht per `Script.Stop` beendet (offener Timer, fehlender Schritt) | Konsole des Laufs lesen; `--hwdemo` für die Langläufer nehmen |

## Weiter zu

- [15 · Ausbau der Steuerung mit Claude Code](15-ausbau-mit-claude-code.md) – die Werkzeuge im Arbeitsablauf: Plan, Prüfkriterien, Debug-Umgebung, Coding, Prüfung
- [18 · Lernlog vom Gerät](18-lernlog-geraet.md) – jede Überraschung, die der Mock nicht zeigt, mit Symptom, Ursache, Fix und Regel im Test
- [20 · RPC- und Engine-Referenz](20-rpc-referenz.md) – jede genutzte RPC mit Parametern und Antwort, Engine-Fakten mit Messdatum
