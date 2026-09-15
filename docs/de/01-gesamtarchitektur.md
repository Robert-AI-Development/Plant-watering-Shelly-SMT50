# 01 · Gesamtarchitektur

**Deutsch** · [English](../en/01-gesamtarchitektur.md) — [Handbuch](README.md) · Teil A „Verstehen“

> **Auf einen Blick**
> - Ein Shelly Plus Uni misst Bodenfeuchte, Temperatur und Wasserstand und gießt eine Pflanze selbst – lokal, ohne Cloud; nur die Uhrzeit kommt per NTP aus dem Internet. Es lernt die Wirkung einer Pumpensekunde, passt die Pause über die Temperatur an Sommer und Winter an und baut Staunässe über eine wöchentliche Trockenphase ab – gedacht für Zimmer- und Balkonpflanzen im Urlaub.
> - Sechs Scripts, keines läuft dauerhaft: der Zeitplan des Geräts startet `bw_main` alle <!-- def:cfg3.tick -->15<!-- /def --> min für wenige Sekunden und `bw_pump` im Gießfenster für höchstens `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s; `bw_install`, die zwei Hardware-Test-Scripts und das Zeitraffer-Script startet ein Mensch von Hand.
> - Ein Gedächtnis: neun Einträge im KVS des Geräts (`cfg1`…`cfg4`, `lrn`, `st`, `job`, `day`, `err`), nichts im Arbeitsspeicher.
> - Takt alle <!-- def:cfg3.tick -->15<!-- /def --> min (`bw_main` misst und entscheidet), Gießfenster <!-- def:cfg3.winA -->08:00<!-- /def --> und <!-- def:cfg3.winB -->20:00<!-- /def --> (`bw_pump` gießt in Portionen).
> - Größter Stolperstein: `bw_main` gießt nie, und der Zeitplan startet nur Scripts – Wasser fließt erst, wenn im Fenster ein Auftrag mit `ok=true` vorliegt und alle Freigaben stimmen.

## Voraussetzungen

- keine – ein Lesekapitel; Stückliste und Anschluss folgen in [05 · Verkabelung und Hardware-Aufbau](05-verkabelung-und-aufbau.md)

## Diagramm

[![Gesamtarchitektur: Sensoren, Betriebs-Scripts, Zeitplan, KVS und Pumpe auf dem Shelly Plus Uni](../diagramme/de/01-gesamtarchitektur.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/01-gesamtarchitektur.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/01-gesamtarchitektur.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Messen und entscheiden“, 2 „Gießen im Fenster“, 3 „Sicherheit ohne Script“, 4 „Von außen“. Das Bild zeigt den Regelbetrieb; die drei Test-Scripts (`bw_hwtest`, `bw_hwpump`, `bw_zeitraffer`) fehlen darin, weil sie nur zum Prüfen dienen und nie im Zeitplan stehen.

## Die Bauteile

Alles hängt direkt am Shelly Plus Uni. Die Komponenten-IDs in Klammern sind die Startwerte in `cfg1` (`idV`, `idT`, `idLvl`, `idSw`); weichen sie am eigenen Gerät ab, werden sie dort eingetragen.

| Bauteil | Aufgabe | Anschluss am Shelly |
| --- | --- | --- |
| Shelly Plus Uni | misst, rechnet, schaltet; Firmware 2.0.0 | Versorgung 12 V DC (das Gerät nimmt 9–28 V) |
| Trübner SMT50 | Bodenfeuchte als Spannung 0–3 V | ANALOG IN, Voltmeter-Bereich 0–15 V (`voltmeter:100`) |
| DS18B20, wasserdicht | Umgebungstemperatur für Hitzeregel und Pause | 1-Wire (`temperature:100`) |
| Schwimmerschalter | Wasserstand im Behälter: LEER oder VOLL | IN2 gegen GND, Typ „Switch“ (`input:1`) |
| Relais 12 V, Spule < 300 mA | trennt den Shelly-Ausgang von der Pumpe | OUT1, potenzialfrei, Kontakt ≤ 30 V / 300 mA (`switch:0`) |
| Pumpe (Gardena Urlaubsbewässerung 970548801) | fördert Wasser zu den Tropfern | am Relaiskontakt, nie direkt am Shelly |
| Netzteil 12 V DC, ≥ 1 A | versorgt Shelly, SMT50 und Relaisspule | – |

Aus der Sensorspannung wird Feuchte in Prozent: `pct = (V − vDry) / (vWet − vDry) × 100`. Die beiden Kalibrierpunkte stehen als Startwerte in `cfg1` (`vDry` <!-- def:cfg1.vDry -->0.20<!-- /def --> V in Luft, `vWet` <!-- def:cfg1.vWet -->3.13<!-- /def --> V im Wasser) und werden am eigenen Aufbau gemessen ([11 · Hardware-Check](11-hardware-check.md)). Grenzen des Sensors: [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md).

## Sechs Scripts, ein Zeitplan, ein Gedächtnis

### Die Scripts

Drei Scripts tragen den Betrieb, drei helfen beim Prüfen. Alle liegen als Kompakt-Ausgabe aus `dist/` auf dem Gerät und nennen ihre Version in Zeile 1. Der Installer findet `bw_main` und `bw_pump` über den Namen; die Script-IDs vergibt das Gerät.

| Script | Version | Wer startet es | Aufgabe |
| --- | --- | --- | --- |
| `bw_install` | <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> | Mensch, beliebig oft | ergänzt fehlende KVS-Einträge und Felder (überschreibt nichts), baut den Zeitplan aus `cfg3`/`cfg4`, setzt `auto_off`, holt den Betrieb aus dem Zeitraffer zurück; beendet sich |
| `bw_main` | <!-- fact:ver.bw_main -->0.2.0<!-- /fact --> | Zeitplan, alle `tick` min | misst Feuchte, Temperatur und Wasserstand, prüft Band und Störungen, führt Kontrolle, Trockenphase und Pause, schreibt den Auftrag `job` mit Grund `job.why`. Schaltet die Pumpe nie |
| `bw_pump` | <!-- fact:ver.bw_pump -->0.2.0<!-- /fact --> | Zeitplan, `winA`/`winB` bei Sekunde 30 | liest `job`, prüft die Freigaben, misst frisch, gießt in Portionen mit Nachmessen, lernt `lrn.effW`/`lrn.sf`, schreibt `st`/`day` und verbraucht den Auftrag |
| `bw_hwtest` | <!-- fact:ver.bw_hwtest -->0.1.0<!-- /fact --> | Mensch (`tools/hwtest.js`) | Sensortest in sechs Phasen (Fühler kalt/warm, Sensor trocken/nass, Schwimmer LEER/VOLL); schreibt die Kalibrierpunkte nach `cfg1` |
| `bw_hwpump` | <!-- fact:ver.bw_hwpump -->0.1.0<!-- /fact --> | Mensch (`tools/hwtest.js`) | Pumpentest in zwei Durchgängen: sichert den Zustand, schreibt einen Testauftrag, startet `bw_pump`; später bewerten und zurückbauen. Schaltet die Pumpe nie selbst |
| `bw_zeitraffer` | <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact --> | Mensch (`tools/hwtest.js zeitraffer`) | sichert `cfg2`…`cfg4`, `lrn`, `st`, `day`, `err` nach `zrb1`…`zrb5`, schreibt kurze Zeiten (Takt <!-- zr:cfg3.tick -->3<!-- /zr --> min, Fenster alle <!-- zr:cfg3.winEvery -->6<!-- /zr --> min) und startet `bw_install` |

> **Hinweis:** Die drei Test-Scripts werden nur für den Hardware-Check ([11](11-hardware-check.md)) und die Erstinbetriebnahme ([12](12-erstinbetriebnahme.md)) gebraucht und kosten Flash. Am Referenzgerät brachte das Löschen von `engine_probe`, `bw_hwtest` und `bw_hwpump` (drei von sieben Scripts) am 13.09.2026 den freien Flash von 12 288 auf 49 152 B; `bw_zeitraffer` blieb.

### Der Zeitplan

Der Zeitplan (`Schedule`) des Geräts ist der einzige Taktgeber. Der Installer legt im Normalbetrieb drei Einträge an; ein Timespec liest sich als Sekunde, Minute, Stunde, Tag, Monat, Wochentag.

| Eintrag | Timespec | Wirkung |
| --- | --- | --- |
| Takt | `0 */15 * * * *` | `Script.Start` auf `bw_main`, alle `tick` min zur vollen Minute |
| Gießfenster | `30 0 8,20 * * *` | `Script.Start` auf `bw_pump` um 08:00:30 und 20:00:30 – 30 s nach `bw_main`, damit beide nie gleichzeitig laufen |
| Sicherheits-Aus | `0 8 8,20 * * *` | `Switch.Set` aus, 8 min nach der Fensterminute (30 s + `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s + 10 s, auf volle Minuten aufgerundet); wirkt ohne Script |

Liegen `winA` und `winB` nicht auf derselben Minute, werden es bis zu fünf Einträge. Nach jeder Änderung von `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin` oder `tTail` muss `bw_install` erneut laufen, denn nur der Installer baut den Zeitplan (aus `tick`, `winEvery`, `winA`/`winB`, `tWin`), setzt `auto_off` aus `tMax` und prüft mit `tTail`, dass ein Fenster in den Takt passt.

> **Nur Zeitraffer:** Dieselben Scripts mit kurzen Zeiten – `0 */3 * * * *` (Takt), `30 */6 * * * *` (Fenster), `40 2,8,14,…,56 * * * *` (Sicherheits-Aus). So sieht man einen ganzen Gießtag in 45 Minuten ([12 · Erstinbetriebnahme](12-erstinbetriebnahme.md)).

### Das Gedächtnis (KVS)

Alles, was ein Takt vom vorigen wissen muss, steht im Key-Value-Store (KVS) des Geräts – als JSON-String je Eintrag, damit die Web-UI ihn lesbar zeigt. Der KVS ist laut Shelly-Doku ein persistenter Speicher; jeder Schreibvorgang geht auf den Flash, deshalb schreiben die Scripts nur, was sich geändert hat. Dass Zustand und Zeitplan einen Stromausfall überstehen, prüft [13 · Betrieb und Wartung](13-betrieb-und-wartung.md) am Gerät `[TODO am Gerät]`.

| Eintrag | Inhalt | Wer schreibt |
| --- | --- | --- |
| `cfg1` | Sensor und Kalibrierung: `vDry`, `vWet`, Komponenten-IDs | Installer (Startwerte), `bw_hwtest`, Mensch |
| `cfg2` | Zielband `pctDry < pctLo < pctOk ≤ pctSoll < pctHi`, Lernparameter | Mensch (Band), Installer (übrige Felder), `bw_zeitraffer` (`pctDry` im Zeitraffer) |
| `cfg3` | Pumpe und Zeiten: `tick`, `winA`/`winB`, `tMax`, Pausen, `maxDay` | Installer, Mensch, `bw_zeitraffer` |
| `cfg4` | Fenster-Regelkreis: `tWin`, `nPort`, Portionen, Einsickern, Stabilität | Installer, Mensch, `bw_zeitraffer` |
| `lrn` | Lernwerte: `effW` (Prozent Feuchte je Pumpensekunde), `sf` (Sicherheitsfaktor) | `bw_pump`, `bw_main` (Kontrolle) |
| `st` | Zustand und Ergebnis des letzten Fensters: `state`, `ts`, `why` | `bw_pump`, `bw_main` |
| `job` | Auftrag von `bw_main` an `bw_pump`: `ok`, `sec`, `pct`, `why`, `ts` | `bw_main` schreibt, `bw_pump` verbraucht |
| `day` | Tageszähler: Fenster `n` und Pumpensekunden `sec` | `bw_main` (Tageswechsel), `bw_pump` |
| `err` | Störungscode – sperrend `cfg`, `uhr`, `sensor`, `wasser`, `noeff`; Hinweise `temp`, `zuviel`, `sink`, `alt`, `limit` – mit Zeitstempel und Speicherstand | `bw_main`, `bw_pump`, Installer (`cfg`) |

Zeitweise kommen weitere Einträge dazu: im Zeitraffer die Sicherungen `zrb1`…`zrb5` und die Marke `zr`; bei den Hardware-Tests `hwt` (Schwellen), `hwc` (Kommandos), `hwr`/`hwp` (Berichte) und die Sicherungen `hwb1`/`hwb2`. Grenzen des Geräts: 50 Schlüssel, je Wert höchstens 253 Zeichen (`kvs-size.test.js` prüft jeden Eintrag). Jedes Feld mit Startwert und Wirkung: [03 · Konfiguration](03-konfiguration.md).

## Warum Einmal-Läufer

Dauerhaft laufende Scripts sind auf dem Shelly nach Stunden abgestürzt – aus dieser Erfahrung entstand das Konzept. Deshalb läuft kein Betriebs-Script dauerhaft: `bw_main` und `bw_install` sind nach wenigen Sekunden fertig, `bw_pump` endet spätestens mit der Frist vor dem nächsten Takt (höchstens `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s). Jedes liest den KVS, arbeitet eine feste Schrittkette ab, schreibt Änderungen zurück und beendet sich mit `Script.Stop`. Stürzt ein Takt trotzdem ab, startet der Zeitplan den nächsten ganz normal – ein Ausfall kostet einen Takt, nicht den Betrieb.

Drei Gerätegrenzen prägen das Muster – Heap und Stack am Gerät gemessen, die Codegrenze als Vorsichtsmaß gesetzt:

| Grenze | Am Gerät | Folge im Code |
| --- | --- | --- |
| Geteilter Heap | etwa 25 KB für alle Scripts zusammen (`Script.GetStatus` meldet im Leerlauf `mem_free` 24 920); zwei große Scripts zur selben Sekunde enden mit `out_of_memory` | `bw_pump` startet 30 s nach `bw_main`; die Test-Scripts geben in Wartephasen ihre KVS-Objekte frei |
| Flacher Stack | die Script-Engine mJS verträgt 12 verschachtelte Aufrufe, bei 14 stürzt sie ab | Schrittketten laufen als flache Schleife (`next()`), nie als Rekursion; der Mock bricht schon bei <!-- fact:call_depth -->10<!-- /fact --> Ebenen ab |
| Codegröße | Vorsichtsmaß <!-- fact:size_limit -->16 000<!-- /fact --> B je Script (`bw_main` derzeit <!-- fact:dist.bw_main -->15 791<!-- /fact --> B); die Firmware speichert auch 19 KB | nur die Kompakt-Ausgabe aus `dist/` kommt aufs Gerät (Kommentare und Einrückung entfernt, Kurzdoku bleibt); `bw_pump` darf <!-- fact:size_limit_pump -->18 000<!-- /fact --> B groß sein, weil es dank der Frist nie neben `bw_main` läuft |

> **Am Gerät gemessen (13.09.2026):** `bw_main` 0.2.0 braucht 5 660 ms je Takt und schreibt dabei 3 KVS-Einträge; `bw_pump` 0.2.0 (<!-- fact:dist.bw_pump -->17 475<!-- /fact --> B) erreicht im Fenster eine Heap-Spitze von 12 516 B bei 25 200 B frei. Zuvor hatte `bw_main` 0.1.2 mit 16 380 B Spitze ein zur selben Sekunde startendes `bw_pump` verdrängt – daraus kam der Pumpenstart bei Sekunde 30.

## Warum bw_main und bw_pump getrennt sind

Die messende und lernende Logik kann die Pumpe nie versehentlich auslösen: `bw_main` enthält keinen `Switch.Set`-Aufruf. Es entscheidet nur und legt die Entscheidung als Auftrag `job` in den KVS – mit `ok`, Pumpensekunden `sec`, gemessener Feuchte `pct`, Grund `why` und Zeitstempel `ts`.

`bw_pump` ist im Fenster ein eigener Prüfer. Es gießt nur, wenn `ok` wahr ist, der Auftrag höchstens `jobAge` <!-- def:cfg3.jobAge -->20<!-- /def --> min alt ist, keine sperrende Störung steht, das Tageslimit `maxDay` <!-- def:cfg3.maxDay -->2<!-- /def --> nicht erreicht ist, der Schwimmer VOLL meldet und die Frischmessung unter `pctOk` liegt. Danach verbraucht es den Auftrag – ein Fenster, eine Gabe.

Zeitlich sind beide getrennt: `bw_pump` startet bei Sekunde 30 und rechnet sich eine Frist aus, die vor dem nächsten Takt endet – Budget `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s, Reserve `tTail` <!-- def:cfg4.tTail -->20<!-- /def --> s. Der Installer prüft beim Anlegen des Zeitplans, dass Fenster plus Reserve in den Takt passen.

Vor der ersten Portion schreibt `bw_pump` den Claim `st.why=laeuft` (läuft) in den KVS. Stirbt das Script mitten im Fenster, sieht `bw_main` den Claim, hält die Pause ein und lernt nichts aus dem halben Fenster.

Abgeschaltet wird die Pumpe auch ohne Script, dreifach: `toggle_after` in jedem Einschaltbefehl (höchstens `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s je Portion), `auto_off` in der Switch-Konfiguration (`tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s + 10 s = 190 s) und der Sicherheits-Aus im Zeitplan. Warum das reicht: [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md); was an einem Tag passiert: [02 · Flussdiagramm](02-flussdiagramm.md).

## Was von außen dazukommt

Die Scripts öffnen keine Netzverbindung; jede Verbindung geht von außen zum Shelly. Nur eines braucht das Internet: die Uhrzeit.

| Von außen | Weg | Wozu |
| --- | --- | --- |
| NTP | Internet | gültige Uhrzeit für Zeitplan und Zeitstempel; ohne Uhr Störung `uhr` und keine Gabe |
| Web-UI des Shelly | Browser im LAN | Scripts anlegen und starten, KVS-Einträge ändern („Format as JSON“), Zeitplan ansehen, Konsole lesen |
| HTTP-RPC | `http://<ip>/rpc/<Methode>` per `curl` oder Werkzeug | alles, was die Web-UI kann, als Befehl: `KVS.Get`, `Script.Start`, `Schedule.List` … |
| Debug-Websocket | `tools/console.js`, `tools/hwtest.js watch` | Konsolenzeilen der Scripts mitlesen; die Konsole muss in der Web-UI eingeschaltet sein |
| Werkzeuge in `tools/` | Node ≥ 20, für `hwtest.js` und `console.js` ≥ 22; keine Abhängigkeiten | `build.js` (Kompakt-Ausgabe), `put-script.js` (Upload mit Byte-Prüfung), `verify-scripts.js`, `hwtest.js`, `run-script.js` |
| Mock und Tests | `npm test` auf dem PC | Gerät in Node nachgebildet (KVS, Zeitplan, Switch, Sensoren, Uhr); <!-- fact:tests -->146<!-- /fact --> Tests ohne Gerät |
| Claude Code | SSH-Rückwärtstunnel `127.0.0.1:8010` | dieselben Werkzeuge vom Server aus: Installation im Interview, Live-Debugging am Gerät ([09](09-installation-vps.md), [10](10-installation-claude-code.md)) |

## Beispielausgabe

So sieht ein Takt aus – die erste Zeile schreibt `bw_main`, die beiden anderen `bw_pump` im Fenster danach (Zeitraffer-Lauf vom 13.09.2026, 15:51 bis 15:56 Uhr):

```text
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
```

Lesart: `V` Sensorspannung, `pct` Feuchte, `tC` Temperatur, `lvl=0` Wasser vorhanden, `st=beob` Zustand „beobachten“, `why=ok` Auftrag geschrieben, `sec=12` Pumpensekunden, `w=3` KVS-Schreibvorgänge, `dauer` Laufzeit. Im Fenster gießt `bw_pump` zwei Portionen (`n=2`, zusammen 22 s) und lernt `effW=2.006`. Alle Felder und Codes: [13 · Betrieb und Wartung](13-betrieb-und-wartung.md).

> **Nur Zeitraffer:** `pause=0.2h` und `Frist 120 s` stammen aus dem Testprofil; im Normalbetrieb stehen dort `pause=24h` und `Frist 420 s`. Quelle: [Konsolenmitschnitt vom 13.09.2026](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/docs/kal/2026-09-13-13-50-kal-log.txt).

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `bw_main` meldet `why=ok`, aber es fließt kein Wasser | `bw_main` gießt nie; der Auftrag wartet auf das nächste Fenster um 08:00:30 oder 20:00:30 | Fenster abwarten und die Konsolenzeile `ergebnis=` von `bw_pump` lesen |
| „Der Zeitplan steht auf 08:00, also gießt es um 08:00“ | Der Zeitplan startet nur `bw_pump`; ohne Auftrag oder bei `feucht`, `wasser`, `limit` gießt es nicht | `job.why` und `st.why` im KVS ansehen; Bedeutung der Codes in [13 · Betrieb und Wartung](13-betrieb-und-wartung.md) |
| Nach dem Ändern von `winA` gießt es weiter zur alten Zeit | Den Zeitplan baut nur der Installer | `node tools/hwtest.js <ip> normal 30` startet `bw_install` in einem sicheren Moment |
| `bw_pump` endet ohne Konsolenzeile, `Script.GetStatus` zeigt `out_of_memory` | Ein zweites großes Script lief gleichzeitig (Test-Script, Dauerlauf) | nie zwei große Scripts zugleich; Test-Scripts nur außerhalb von Takt und Fenster starten |
| Ein Betriebs-Script steht auf „Run on startup“ | Betriebs-Scripts startet nur der Zeitplan; Autostart läuft direkt nach dem Neustart ohne Uhrzeit (`err=uhr`) und außerhalb des Takts | Startautomatik aus – der Installer schaltet sie für `bw_main` und `bw_pump` selbst ab |
| KVS-Wert erscheint in der Web-UI als `[object Object]` | Wert als Objekt statt als JSON-String geschrieben | Eintrag als JSON-String neu schreiben ([03 · Konfiguration](03-konfiguration.md)) |

## Weiter zu

- [02 · Flussdiagramm: Takt, Auftrag, Fenster, Kontrolle, Pause](02-flussdiagramm.md) – was das Gerät an einem Tag tut und warum es gerade nicht gießt
- [05 · Verkabelung und Hardware-Aufbau](05-verkabelung-und-aufbau.md) – die Bauteile anschließen
- [06 · Schritt-für-Schritt-Startanleitung](06-startanleitung.md) – vom verdrahteten Gerät zum ersten Gießfenster
