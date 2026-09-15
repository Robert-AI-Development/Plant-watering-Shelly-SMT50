# 19 · Prüfprotokoll am Gerät

**Deutsch** · [English](../en/19-pruefprotokoll.md) — [Handbuch](README.md) · Teil F „Entwicklung“

> **Auf einen Blick**
> - Letzter Lauf: 13.09.2026, 15:48–16:06 – der Regelkreis von `bw_pump` <!-- fact:ver.bw_pump -->0.2.0<!-- /fact --> lief zum ersten Mal am Gerät: Fenster 1 mit zwei Portionen (12 + 10 s), Feuchte 10,4 → 50,5 %, Laufzeit 100 s bei Frist 120 s, `mem_peak` 12 516 B; danach `kal write` mit `lrn.effW` 4,46.
> - Seit dem 12.09.2026 gemessen: Kalibrierpunkte 0,296 V / 3,134 V, Schwimmer LEER = 1, Fühler 19,8–33,5 °C, Script-Heap ~25 KB geteilt, Stacktiefe 12 ok / 14 Absturz, Flash 12 288 → 49 152 B ohne die drei Test-Scripts.
> - Prüfmatrix mit 21 Zeilen: sieben mit Gerätebeleg (2, 3, 4, 8, 14, 17, 21 – bei 14, 17 und 21 nur teilweise), drei nur im Mock (12, 13, 18), elf offen.
> - Offen: Fenster 2–4 des Zeitraffer-Fahrplans, Kalibrierzustände mittel feucht und nass, das erste echte 20:00-Fenster, `tDead`/`tMin` am Endaufbau, Zielband und `dropSlow` an der Pflanze.
> - Größter Stolperstein beim Protokollieren: Zahlen ohne Datum und Version – und die Dateinamen in `docs/kal/` sind UTC (`…-13-50-…` = 15:50 Ortszeit).

## Voraussetzungen

- keine – ein Nachschlagekapitel. Wer den nächsten Lauf fährt, braucht die Befehle aus [11 · Hardware-Check](11-hardware-check.md), [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md) und die Werkzeug-Referenz in [14 · Debuggen und Testen](14-debuggen-und-testen.md).

## Diagramm

[![Sequenz des Gerätelaufs vom 13.09.2026: hwtest.js normal und kal, bw_install baut den Zeitplan, bw_main schreibt den Auftrag, bw_pump gießt Fenster 1 in zwei Portionen, Rückbau und kal write](../diagramme/de/19-pruefprotokoll.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/19-pruefprotokoll.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/19-pruefprotokoll.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Aktivierung 15:48–15:51“, 2 „Fenster 1 um 15:54:30“, 3 „Rückbau und kal write“.

## Aufbau und Werkzeuge

Alle Läufe fanden am selben Gerät statt: ein Shelly Plus Uni mit Firmware 2.0.0, Zeitzone Europe/Vienna, im LAN des Nutzers. Claude Code arbeitet auf einem VPS ohne LAN-Zugang und erreicht das Gerät über einen SSH-Rückwärtstunnel unter `127.0.0.1:8010` ([09 · Installation mit VPS](09-installation-vps.md)). Der Mensch steht am Aufbau, steckt Sensoren um, bewegt den Schwimmer und bestätigt, bevor die Pumpe läuft.

| Teil | Stand beim letzten Lauf (13.09.2026) |
| --- | --- |
| Sensoren | SMT50 mittig in frischer, trockener Erde, direkt darüber zwei Gardena-Tropfer; DS18B20; Schwimmer im Behälter (`lvlEmpty` 1) |
| Scripts am Gerät | id 1 `bw_install` 0.1.3, id 2 `bw_main` 0.2.0, id 3 `bw_pump` 0.2.0, id 7 `bw_zeitraffer` 0.2.0; `engine_probe` (4), `bw_hwtest` (5) und `bw_hwpump` (6) am 13.09.2026 gelöscht (Flash) |
| Werkzeuge | `tools/put-script.js` (Upload in Stücken, byteidentische Prüfung), `tools/verify-scripts.js`, `tools/console.js`, `tools/hwtest.js` <!-- fact:ver.hwtest -->0.1.2<!-- /fact --> (`preflight`, `normal`, `zeitraffer`, `watch`, `mess`, `kal`) – Node ≥ 20, `console.js` und `hwtest.js` Node ≥ 22 (globales WebSocket), keine Abhängigkeiten |
| Rohdaten | `docs/kal/<datum>-mess.json` und `<datum>-kal.json`; die Logdatei `2026-09-13-13-50-kal-log.txt` enthält die Konsole des Etappe-10-Laufs |
| Mock-Stand | `npm test`: 53 Tests am 12.09.2026, 89 nach dem Hardware-Test, 102 nach dem Zeitraffer, 144 nach Etappe 10, heute <!-- fact:tests -->146<!-- /fact --> |

Spielregeln für jeden Eintrag: Datum, Uhrzeit in Ortszeit und Versionen der beteiligten Scripts stehen dabei; jede Zahl kommt aus der Konsole, der `watch`-Statuszeile, einer RPC-Antwort oder einer Rohdatendatei; Überraschungen, die der Mock nicht zeigt, wandern in [18 · Lernlog vom Gerät](18-lernlog-geraet.md) und als Regel in die Tests. Ein Prüfpunkt gilt erst als erledigt, wenn er am Gerät gelaufen ist – ein grüner Mock-Test steht als „Mock“ in der Spalte „Stand“.

## Gerätetest 12.09.2026 (v0.1.1, Firmware 2.0.0)

Erster Kontakt der drei Betriebs-Scripts mit der Engine, über den Tunnel mit `put-script.js` und `console.js`:

| Prüfpunkt | Ergebnis |
| --- | --- |
| Scripts vollständig geladen | Upload per `Script.PutCode` in Stücken, Byte-Zahl per `Script.GetCode` gegen die Datei geprüft. Der Web-Editor hatte beim Einfügen das Dateiende verloren: `bw_install` 166 B (12 131 → 11 965), `bw_main` 210 B (19 231 → 19 021); Firmware 2.0.0 speichert auch 19 KB |
| Installer | legt 8 KVS-Einträge (JSON-Strings, in der Web-UI mit „Format as JSON“ lesbar) und 3 Zeitplan-Einträge an: `0 */15 * * * *` für `bw_main`, `0 0 8,20 * * *` für `bw_pump`, `0 5 8,20 * * *` als Sicherheits-Aus (Stand 0.1.1; heute `30 0 8,20` und `0 8 8,20`). Der erste `Schedule.Create` eines Laufs wird vom Gerät abgelehnt und automatisch wiederholt |
| `bw_main` / `bw_pump` | starten ohne Uncaught-Fehler; Messwerte plausibel (`V≈0.27`, `tC≈24`) mit den Standard-IDs `voltmeter:100` und `temperature:100`. `err=cfg` / `why=cfg` ist erwartet, solange das Zielband in `cfg2` `null` ist |
| Engine-Grenzen (`tools/probe/engine_probe.js`) | kein Hoisting (`ReferenceError: "stepRead" is not defined`); Stacktiefe 12 läuft, 14 stürzt ab („Too much recursion“), Mock-Grenze seitdem <!-- fact:call_depth -->10<!-- /fact -->; KVS-Werte müssen Strings sein (die Web-UI zeigt Objekte als `[object Object]`); `KVS.GetMany` liefert `items` als Array |

## Hardware-Test 13.09.2026 (bw_hwtest 0.1.0, bw_hwpump 0.1.0)

Vom VPS mit `tools/hwtest.js` gesteuert (`preflight`, `start`, `watch`, `go`, `report`, `cleanup`); der Nutzer am Aufbau. Scripts am Gerät: id 5 `bw_hwtest`, id 6 `bw_hwpump`. Eingang 1 war bereits vom Typ `switch`, `input-on` wurde nicht gebraucht. Ablauf und Phasen erklärt [11 · Hardware-Check](11-hardware-check.md).

| Messung | Ergebnis |
| --- | --- |
| Sensortest, sechs Phasen t1, t2, m1, m2, l1, l2 | alle `ok`, Dauer 532 s; eine Konsolenzeile je 5 s je Phase |
| Fühler DS18B20 | 19,8 °C im Eiswasser, 33,5 °C im warmen Wasser bzw. in der Hand |
| Trockenpunkt / Nasspunkt | 0,296 V (Sensor abgewischt in Luft; Startwert `vDry` 0,20 V, Ablesung am 12.09. ≈ 0,27 V) / 3,134 V → automatisch nach `cfg1`: `vDry` 0,20 → 0,296, `vWet` 3,13 → 3,134 |
| Schwimmer | LEER = 1, VOLL = 0 → `lvlEmpty` 1 bestätigt, 8 Eingangswechsel beobachtet |
| `ram_free` während des Sensortests | mindestens 125 424 B; ein 1-s-Tick mit `getComponentStatus` kostet laut Firmware-Log 12–17 % CPU |
| Pumpentest Durchgang A | 26 s, Freigabe 19 s nach `go`; Sicherung nach `hwb1`/`hwb2`, Auftrag `job` mit `sec` <!-- hwp:pumpSec -->30<!-- /hwp --> und `why` `hwtest`, `Script.Start` von `bw_pump` |
| `bw_pump` allein | „Pumpe ein für 30 s (Auftrag 30 s, pct null)“, „Pumpe aus: ok nach 30 s“, `ergebnis=ok sec=30 day.n=1` |
| Durchgang B | p0–p3 `ok`, Rückbau von `st`/`day`/`job`/`err`, `hwb1`/`hwb2` gelöscht; KVS danach byteidentisch zum Stand vor dem Test (cfg1/2/3, day, err, job, lrn, st); `kvs_rev` am Ende 198 |
| Flash | `fs_free` 57 344 B vor dem Upload, 24 576 B nach den zwei Test-Scripts (13,4 + 13,9 KB) |

Engine-Befunde dieses Tages (Ursachen und Regeln in [18 · Lernlog vom Gerät](18-lernlog-geraet.md)):

| Befund | Messwerte | Folge |
| --- | --- | --- |
| `Function "shift" not found!` – mJS kennt `Array.prototype.shift` nicht | `bw_hwtest` brach nach dem ersten Messtick ab | Ringpuffer per Index; `syntax.test.js` verbietet `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort` |
| Script-Heap ist geteilt, ~25 KB | `mem_free` 24 920 B im Leerlauf für jedes Script; `bw_hwpump` mit allen KVS-Objekten im RAM 13 552 B (Spitze 15 400) → `bw_pump` beim Start `out_of_memory`, `bw_main` im 15-min-Takt ebenso | Test-Scripts geben in Wartephasen `K`/`orig` frei (`bw_hwpump` 9 044, `bw_hwtest` 9 576 B); Parse-Bedarf `bw_hwtest` 3 564, `bw_main` 5 404, `bw_pump` 7 396 B |
| `bw_pump` neben einem 9-KB-Script | beim zweiten KVS-Lesen (13 Einträge inkl. `hwt/hwr/hwp/hwb1/hwb2`) über 15,8 KB Spitze → erneut `out_of_memory`, Pumpe war aus, `st/day/job` nie geschrieben | Pumpentest in zwei Durchgängen, `bw_pump` läuft allein; `bw_main` + `bw_pump` zusammen (08:00/20:00) liefen an diesem Vormittag mit je ~7,4 KB – kein Spitzenwert, wie der Zeitraffer-Lauf unten zeigte |
| `KVS.GetMany` liefert 11 Einträge je Seite | Mock: 5; wer nur die erste Seite liest, übersieht `st` | Scripts, `kvs_dump.sh` und `hwtest.js` paginieren |
| Debug-Websocket | Firmware-Zeilen (`shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`, …) und `JS RAM stat … used: N` beim Start; die Konsole muss vor `Script.Start` verbunden sein | `hwtest.js watch` filtert das Rauschen, `console.js` nicht |

## Zeitraffer-Lauf 13.09.2026 (Profil 0.1.3)

Versionen: `bw_zeitraffer` 0.1.0, `bw_install` 0.1.2, `bw_main` 0.1.2, `bw_pump` 0.1.1; Werkzeuge `hwtest.js zeitraffer`/`watch`/`normal` und `verify-scripts.js`. Das Profil dieser Version hatte Takt 1 min, Fenster alle 2 min, Gabe 5 s (`auto_off` 15 s) und noch keinen Regelkreis – Vergleich zum heutigen Profil (Takt <!-- zr:cfg3.tick -->3<!-- /zr --> min, Fenster alle <!-- zr:cfg3.winEvery -->6<!-- /zr --> min) in [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md).

Autonom vom VPS über den Tunnel; der Nutzer hat ab Minute 7 der zweiten Runde die Handgriffe des Fahrplans gemacht (Fühler in heißes Wasser, Schwimmer, Sensor ins Wasser). **Der Schlauch lag an der Pflanze**, deshalb stieg die Feuchte am Sensor mit jeder Gabe. Erwartungen aus `tools/test/zeitraffer.test.js` (damals 102 Tests).

| Schritt | Erwartung | Ergebnis / Uhrzeit |
| --- | --- | --- |
| Timespec-Vorprüfung | `Schedule.Create` mit `15 */2 * * * *`, `0 * * * * *`, `0 */2 * * * *` wird angenommen | 10:56: alle drei angenommen (id 4, sofort gelöscht), per RPC kein Retry nötig |
| Upload und Prüfung 2 | sechs Scripts per `put-script.js`, `verify-scripts.js` byteidentisch, Doku-Zeilen sichtbar | 10:57: `bw_install` 14 295, `bw_main` 15 288, `bw_pump` 10 805, `bw_hwtest` 13 952, `bw_hwpump` 14 500, `bw_zeitraffer` 6 354 B; Doku-Zeilen 20/6/5/4/4/9. Nach dem Fix (Runde 2) `bw_install` 14 480, `bw_zeitraffer` 6 379 B – erneut alle OK; `fs_free` danach 12 288 B (vorher 24 576) |
| Zielband | `cfg2` = 55/40/65/38/4 (`pctSoll`/`pctLo`/`pctHi`/`pctDry`/`dropSlow`, Interview-Entscheidung) | 10:57 gesetzt, `kvs_rev` 202 |
| Installer-Update (`normal`) | „KVS cfg3 ergänzt: tick,winEvery“, Zeitplan `0 */15`, `0 0 8,20`, `0 5 8,20`, `auto_off` 130 s | 10:58:08 genau so; Heap danach 24 920 B frei |
| Zeitraffer-Start, Runde 1 | Zeitplan `0 * * * * *`, `0 */2`, `15 */2`, `auto_off` 15 s, `zr` weg, `zrb1..3` da | 10:59:09 genau so – **aber** `bw_pump` starb um 11:00 und 11:02 zur selben Sekunde wie `bw_main` mit `out_of_memory` (`used=791 peak=871 total=1746`); `bw_main` belegte 13 216 B (Spitze 16 380), Laufzeit 5–7,5 s. Keine Gabe. Rückbau 11:07:09 sauber |
| Fix | `bw_pump` startet 30 s nach der vollen Minute (`PUMP_SEC`, Entscheidung 37) | `bw_install` und `bw_zeitraffer` neu hochgeladen, `hwtest.js` prüft den neuen Zeitplan |
| Installer-Update, Runde 2 | Zeitplan `0 */15`, `30 0 8,20`, `0 5 8,20` | 11:12:08 genau so |
| Zeitraffer-Start, Runde 2 | Zeitplan `0 * * * * *`, `30 */2 * * * *`, `45 */2 * * * *`, `auto_off` 15 s | 11:13:08 genau so, `zr` gelöscht, `zrb1..3` da, Heap 24 920 B frei |
| Minute 1 | `bw_main`: `why=ok sec=5` (Erde trocken) | 11:14:00 `pct=0 … pause=0.17h why=ok sec=5` (5,4 s) |
| Minute 1:30 | `bw_pump`: `ergebnis=ok sec=5`, Ausgang binnen 7 s aus (Gabe 1) | 11:14:30 „Pumpe ein für 5 s“, „Pumpe aus: ok nach 5 s“, `day.n=1`, 13,1 s, `mem_used` 11 970 B (allein) |
| Minute 2 | `st=sperre dry=1 pause=0.17h why=pause` | 11:15 „Bewertung ohne Vorwert übersprungen“, genau so; Feuchte durch die Gabe 0 → 36 % |
| Hitze (Handgriff) | Fühler über 30 °C → `pause=0.035h why=ok`, Gabe im nächsten Fenster | ab ~11:20 Fühler in heißem Wasser (bis 86 °C, `lrn.tMaxD` 86): 11:21 `why=ok`, **11:22:30 Gabe 2** (pct 36,6; 8 min nach Gabe 1 – Hitze verkürzt die Pause) |
| Hitze-Doppelgabe | zweite Gabe 2 min nach der letzten | 11:23 `why=ok`, **11:24:32 Gabe 3** (`day.n=3`) |
| Schwimmer LEER | `why=wasser err=wasser`, Fenster pumpt nicht | 11:25:01 `why=wasser`, 11:26 `err=wasser`, 11:26:30 `bw_pump`: kein Auftrag |
| Sensor im Wasser | `why=feucht` (Verhalten 0.1.3; seit 0.2.0 startet Nässe > `pctHi` die Trockenphase: `why=trocken`) | 11:27 `pct=99 why=feucht`, `err` gelöscht (Schwimmer wieder VOLL) |
| Sensor trocken | `why=ok`, Gabe 4 | 11:28 `pct=0 why=ok`, **11:28:30 Gabe 4** (`day.n=4`) |
| Tageslimit | `why=limit`, kein Pumpen mehr | 11:29 `why=limit` (pct 54 nach der Gabe, `dry=0`), 11:30:30 `bw_pump`: kein Auftrag |
| Speicher | kein `out_of_memory` in Runde 2 | `bw_main` 13 216 / 16 380 B je Takt, `mem_free` min 11 536; `bw_pump` allein ≤ 11 970; Leerlauf 24 920. Nach jedem `bw_main`-Lauf `shelly_ejs_timer.cpp:44 Timer 1 handle not found` (harmlos) |
| Rückkehr (`normal`) | „Zeitraffer beendet“, `cfg3` Original mit `tick` 15 / `winEvery` null, `zr`/`zrb*` gelöscht, Zeitplan normal, `auto_off` 130 s, `day.n` 0 | 11:31:17 genau so; `lrn` (`tMaxD` 38, `tMaxY` 24, `tMean` 24) und `err` (`cfg` vom Vortag, löscht `bw_main` im nächsten Takt) wie vor dem Test; `kvs_rev` 287 – beide Runden zusammen 86 Schreibvorgänge |

Ergebnis: alle Fahrplan-Fälle am Gerät gezeigt – Gabe, normale Pause, Hitze-Doppelgabe, Behälter leer, feucht, Tageslimit, Rückbau. Einziger Befund: der gleichzeitige Start von `bw_pump` und `bw_main` (behoben mit Sekunde 30). Danach: Sensor zurück in die Erde, Schwimmer auf VOLL.

## Messlauf 13.09.2026 (`hwtest.js mess`)

Planung des Regelkreises für Etappe 10: SMT50 mittig in trockener Erde, zwei Gardena-Tropfer direkt darüber; Pumpe per `Switch.Set toggle_after`, Sensor alle 2 s per RPC, kein Gerätecode.

Rohdaten: [`2026-09-13-12-58-mess.json`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/docs/kal/2026-09-13-12-58-mess.json), [`…-13-09-mess.json`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/docs/kal/2026-09-13-13-09-mess.json), [`…-13-14-mess.json`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/docs/kal/2026-09-13-13-14-mess.json) (Dateinamen in UTC, Tabelle in Ortszeit).

| Lauf | Puls | Feuchte vorher → Spitze (t) → Ruhe | `tRise` | Gewinn | Befund |
| --- | --- | --- | --- | --- | --- |
| 14:54 | 3 s | 10,4 → 10,7 | – | – | keine Reaktion: der Schlauch war leer, 3 s füllen ihn nur |
| 14:56 | 3 s | 10,7 → 20,2 (86 s) | 5,3 s | +9,5 % | Sprung binnen 10 s, dann Kriechen bis 86 s (Nachlaufwasser) |
| 14:58 | 3 s | 20,2 → 31,9 (80 s) | 5,5 s | +11,7 % | wie oben, Kriechen +8 % zwischen 20 und 87 s |
| 15:01 | 3 s | 34,0 → 36,1 (162 s) | 7,8 s | +2 % | bei feuchterer Erde fast nur Nachlauf |
| 15:03 | 3 s | 35,7 → 37,8 (65 s) | 7,9 s | +2 % | dito |
| 15:10 | 10 s | 37,5 → 49,1 (15 s), stabil 2 min | 7,9 s | +11,6 % = 5,6 %/wirksame s | Anstieg während des Pumpens, Ruhewert 5 s nach dem Ausschalten, kein Kriechen |

Abgeleitete Startwerte, seither in `bw_install`: `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s, `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> s, `tMin` <!-- def:cfg3.tMin -->25<!-- /def --> s, `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s, `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s, `effMax` <!-- def:cfg2.effMax -->30<!-- /def --> als Plausibilitätsgrenze – und die Regel „Portionen nie kürzer als die Totzeit“.

Nebenbefunde: keine Spannungseinbrüche am Voltmeter bei laufender Pumpe (Werte während des Pulses plausibel); das Voltmeter liefert bei 2-s-Abfrage frische Werte in Stufen von 0,3 %; bei kurzen Pulsen ist Nachlaufwasser aus dem Schlauch der dominante Effekt.

## Etappe 10: Fenster 1, Heap, `kal write` (13.09.2026, 15:48–16:06)

Aufbau: SMT50 mittig in frischer, trockener Erde, zwei Gardena-Tropfer darüber, Behälter voll, Tunnel `127.0.0.1:8010`. Alle Schritte hat Claude über die Werkzeuge gefahren; der Sensor blieb während des Laufs stecken – deshalb nur Fenster 1 des Fahrplans, danach lag die Erde über dem Ziel (`feucht`). Das Diagramm oben zeigt diesen Lauf.

| Schritt | Ergebnis |
| --- | --- |
| Flash vor dem Upload | Scripts 4/5/6 (`engine_probe`, `bw_hwtest`, `bw_hwpump`) waren bereits gelöscht: `fs_free` 49 152 B (vorher 12 288 B mit sieben Scripts) |
| Upload | `bw_pump` 17 475 B, `bw_main` 15 791 B, `bw_install` 15 978 B, `bw_zeitraffer` 7 453 B – alle byteidentisch (`put-script.js`, `verify-scripts.js`, Versionsgleichheit `bw_main` = `bw_pump` = 0.2.0) |
| Kompakt-Ausgabe heute | `npm run build`: `bw_pump` <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B, `bw_main` <!-- fact:dist.bw_main -->15 791<!-- /fact --> B, `bw_install` <!-- fact:dist.bw_install -->15 978<!-- /fact --> B, `bw_zeitraffer` <!-- fact:dist.bw_zeitraffer -->7 459<!-- /fact --> B – weicht eine Zahl vom Upload ab, wurde das Script seit dem 13.09.2026 geändert |
| Flash nach dem Upload | `fs_free` 40 960 B (LittleFS rechnet in 4-KB-Blöcken); `put-script.js` prüft seit v0.1.2 vor jedem Upload `fs_free` + alter Code ≥ neue Datei + 4 096 B |
| Handwerte | `cfg2 {pctOk 50, pctHi 60, pctDry 28, effMax 30}`, `cfg3 {tMax 180, tMin 25}`, `lrn {sf 0.7, effW null}` (Feld `eff` entfernt); `cfg2.dropSlow` 4 seit 10:57 unverändert |
| `hwtest.js normal 60` (Installer 0.1.3), 15:48 | ergänzt `cfg2.dropW`/`sfUp`, `cfg3.dryDay`, legt `cfg4` an; Zeitplan `0 */15`, `30 0 8,20`, `0 8 8,20`; `auto_off` 190 s; `verifyState` ohne Abweichung; Heap 5 348 B |
| `hwtest.js kal 780` (Zeitraffer 3/6 mit Rekorder) | sicherer Moment 15:50:09, Aktivierung 15:50:34; Zeitplan `0 */3`, `30 */6`, **Minutenliste `40 2,8,…,56` angenommen**, kein `Hinweis: Schedule.Create …` in der Konsole (eine erste Ablehnung wiederholt der Installer stumm); `auto_off` 50 s; `kvs_rev` 496; JS RAM stat der Aktivierung 1 800 und 2 204 B. Takt 15:51: `pct=10.829 why=ok sec=12 sf=0.7`, `dauer=5660ms`, `w=3` |
| **Fenster 1**, 15:54:30 | `Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s` · `m0 10.4 % → P1 12 s` · `P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)` · `P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)` · `ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199` |
| Deutung | Erstportion, Frischmessung, Korrekturportion aus der gemessenen Wirkung, Ziel `pctOk` 50 erreicht; Laufzeit 100 s unter der Frist <!-- zr:cfg4.tWin -->120<!-- /zr --> s; P1 stabil nach 12 s, P2 lief in den 30-s-Timeout (`unstab` – unter dem Tropfer steigt der Wert nach); im Normalprofil sind `tStab` 60 und `tSoak` 20 dafür da |
| Heap im Fenster | `bw_pump` `mem_used` 10 206–10 500 B, **`mem_peak` 12 516 B** bei `mem_free` 25 200; kein `out_of_memory`. Die Ausnahme <!-- fact:size_limit_pump -->18 000<!-- /fact --> B für `bw_pump` ist gedeckt: der Parse von `bw_main` (5 348 B) kommt dank Frist nie dazu |
| Firmware-Hinweise | `shelly_ejs_timer.cpp:44 Timer 1 handle not found` (`Timer.clear` auf den eigenen Timer aus dessen Callback) und `persistent_counters.cpp:585 PCS write interval < 60s` (Zählerschreiben des Switch bei Portionen im Abstand < 60 s) – harmlos, Script lief sauber weiter (`w=4`, `Script.Stop`) |
| Kontrolle 15:57 | `Kontrolle: 50.5 → 53.7 % sf=0.7` (+3,2), `st=sperre dry=1 why=pause` (keine Trockenphase nach der Gabe, Entscheidung 58) · 16:00 `pct=56.871 why=pause` (Nachlauf +6,4 % gegenüber der Fensterablesung 50,5), 16:00:30 `bw_pump` ohne Auftrag · 16:03 `pct=56.401 why=feucht` |
| `hwtest.js normal 60`, 16:04 | Original aus `zrb1..5` zurück (`cfg3, lrn, day, st, err, cfg4, cfg2, job`), Zeitplan, `auto_off` und Sicherung geprüft, Heap frei 25 200 B |
| `kal report <json> <log>` | 155 Proben, 1 Fenster, Zustand trocken (m0 10,4 < `pctDry` 28): P1 12 s / +23,6 / `tRise` 8 s, P2 10 s / +16,5 / `tRise` 5 s → **4,46 %/s nach `tRise`** (Profilmaß `st.effW` 2,01 wegen `tDead` 2 / `tDead2` 0 im Zeitraffer). Die Konsolenzeilen kamen aus der `watch`-Logdatei, weil der Rekorder sie erst seit `hwtest.js` 0.1.2 selbst mitschreibt |
| `kal write`, 16:06 | `lrn.effW` null → 4,46; `cfg4.tDead2` 8 → 5; `cfg3.tDead` <!-- def:cfg3.tDead -->20<!-- /def --> → 8; `cfg3.tMin` 25 → 10 (`max(tPmin, tDead + 2)`); Vorher/Nachher in der Ausgabe, KVS gegengelesen |

> **Am Gerät gemessen (13.09.2026):** Die Totzeit gehört zum Schlauch, nicht zum Script. Die Werte `tDead` 8 s und `tMin` 10 s gelten für den kurzen Schlauch des Testaufbaus; der Endaufbau mit längerem Schlauch (10–20 s Wasserlaufzeit laut Nutzer) braucht ein neues `mess`, danach `tDead`/`tMin` prüfen.

## Prüfmatrix Nr. 1–21

Vorher: Installer gelaufen, Zielband in `cfg2`, Pumpe angeschlossen, Behälter gefüllt. KVS-Stand jederzeit mit `tools/kvs_dump.sh <ip>` oder `http://<ip>/rpc/KVS.GetMany?match=*`. Stand: „Gerät“ = am Aufbau gelaufen, „Mock“ = nur im Test nachgebildet, „offen“ = noch nicht ausgelöst.

| Nr. | Prüfung | Vorgehen | Erwartung | Stand |
| --- | --- | --- | --- | --- |
| 1 | Installer wiederholbar | `bw_install` zweimal starten, `Schedule.List` ansehen | genau drei eigene Einträge, cfg-Werte unverändert | offen – der Installer lief am 13.09.2026 mehrfach, jedes Mal „Zeitplan: 3 Einträge, davon eigene: 3“; ein gezielter Doppelstart mit Vergleich der cfg-Werte fehlt |
| 2 | Komponenten-IDs | erste Konsolenzeile von `bw_main` lesen | `V=` Spannung, `tC=` Temperatur, `lvl=` 0 oder 1; sonst `idV/idT/idLvl` in `cfg1` anpassen | Gerät 13.09.2026: alle drei Komponenten liefern Werte – 19,8–33,5 °C, 0,296–3,134 V, Schwimmer 0/1 (8 Wechsel) |
| 3 | Kalibrierpunkte | Sensor trocken in Luft, dann im Wasser: `V=` ablesen | nahe 0,20 V und 3,13 V; sonst `vDry/vWet` anpassen | Gerät 13.09.2026 per `bw_hwtest`: 0,296 V / 3,134 V, automatisch nach `cfg1` geschrieben |
| 4 | `lvlEmpty` | Behälter leer → `lvl=` ablesen | Wert = `cfg1.lvlEmpty` (Startwert 1) | Gerät 13.09.2026: LEER = 1, VOLL = 0 → `lvlEmpty` 1 bestätigt |
| 5 | Sensor abgesteckt | SMT50-Signalader lösen, einen Takt warten | `err.code = "sensor"`, `job.why = "sensor"`, keine Pumpe | offen |
| 6 | Sensor wieder dran | Ader anschließen, einen Takt warten | `err.code = null` | offen |
| 7 | Pflichtfeld fehlt | `cfg3.tMax` im KVS auf null setzen, Takt abwarten | `err.code = "cfg"`, `job.ok = false`; nach Rücksetzen wieder frei | offen |
| 8 | Hand-Auftrag | `job` = `{"ok":true,"sec":70,"why":"hand","ts":<jetzt>}` setzen (ohne `pct` = Einzelportion), `bw_pump` starten | Pumpe läuft clamp(`sec`, 1, min(`tPmax`, `tMax`)) = 70 s (Stoppuhr), `st.state = "gegossen"`, `day.n = 1`, `job.ok = false`. Mit `pct` (und `nPort` > 1) läuft der Regelkreis: Frischmessung m0; bei m0 ≥ `pctOk` `why=feucht` ohne Gabe, sonst P1 70 s und weitere Portionen bis `pctOk` (Σ ≤ `tMax` 180 s) | Gerät 13.09.2026 als Variante des Pumpentests: 30 s statt 70 s (`why` `hwtest`, ohne `pct`); `st.state = gegossen`, `st.sec = 30`, `day.n = 1`, `job.ok = false` vor dem Rückbau |
| 9 | Alter Auftrag | wie 8, aber `ts` 30 min in der Vergangenheit | `err.code = "alt"`, keine Pumpe | offen |
| 10 | Tageslimit | `day.n` auf 2 setzen, Hand-Auftrag | `err.code = "limit"`, keine Pumpe | offen (im Zeitraffer 0.1.3 kam `why=limit` nach Gabe 4) |
| 11 | Wasser leer vor Gabe | Schwimmer auf LEER, Hand-Auftrag | `err.code = "wasser"`, keine Pumpe | offen als Handauftrag (im Zeitraffer 0.1.3: `why=wasser`, `err=wasser`, Fenster ohne Gabe) |
| 12 | Wasser leer während Gabe | Hand-Auftrag mit `pct` (Regelkreis), nach 10 s Schwimmer auf LEER | Pumpe binnen `tChk` s aus, `st.state = "sperre"`, `st.rated = true`, `st.why = "abbruch"`, `err.code = "wasser"`, `day.sec` zählt die Teilportion | Mock: `pump.test.js` (LEER in P2 / in der Wartephase → `wasser`) |
| 13 | Sicherheits-Aus bei abgestürztem Script | Hand-Auftrag mit `pct` um 07:59, `bw_pump` um 08:00:30 laufen lassen, mitten im Fenster in der Web-UI stoppen | Ausgang spätestens 08:08 aus (Zeitplan `0 8 8,20`), sonst `toggle_after`/`auto_off` 190 s; `st.why` bleibt `laeuft`, nächster Takt `why=pause`, kein Lernwert | Zeitplan `0 8 8,20` am 13.09.2026 angelegt; Abbruch selbst nur im Mock (`pump.test.js`: `Script.Stop` → Claim + Guard) |
| 14 | `auto_off` | `Switch.Set {id:0,on:true}` ohne `toggle_after` per RPC | Ausgang nach `tMax` + 10 s = 190 s von selbst aus | Gerät 13.09.2026: `auto_off 190 s` vom Installer gesetzt (`verifyState`); das Abschalten selbst nicht ausgelöst |
| 15 | Ausgang nach Neustart | Ausgang einschalten, Shelly stromlos machen, wieder einschalten | Ausgang ist aus (`initial_state = off`) | offen |
| 16 | Uhrzeit ungültig | WLAN aus, Shelly stromlos starten (ohne NTP), `bw_main` von Hand starten | `err.code = "uhr"`, keine Pumpe, Zeitplan steht; nach WLAN-Rückkehr normal | offen |
| 17 | Bewertung und Lernwert | echtes Fenster mitlesen (`console.js <ip> 900`; `hwtest.js watch` endet im Normalbetrieb, sobald kein Test-Script läuft), danach `lrn.effW` und `st` lesen | Konsole `P1 …`, `P2 …`, `ergebnis=… effW=…`; `lrn.effW` zwischen `effMin` und `effMax`, `st.n/sec/pctB/pctW/effW/why` gefüllt; `soak` min später `Kontrolle: … → … %` mit `pctA`, kein zweiter Lernwert | Gerät 13.09.2026 im Zeitraffer: `effW` 2,006 (Profilmaß), Kontrolle 50,5 → 53,7 %; echtes 20:00-Fenster offen |
| 18 | Keine Wirkung | Schlauch von der Pflanze abziehen, Fenster abwarten | Erstportion ohne Wirkung → eine volle Probeportion → `st.why = "noeff"`, `err.code = "noeff"`, `lrn.effW` unverändert, `st.state = "sperre"`; nach Löschen von `err` wieder frei | Mock: `pump.test.js` (zwei volle Portionen, ΣΔ < `dEffMin`) |
| 19 | Temperaturfühler abgesteckt | DS18B20 lösen | `err.code = "temp"`, Auftrag weiterhin möglich | offen |
| 20 | Speicherverbrauch | `err.mem` über mehrere Tage notieren | Wert stabil (Unterschied < 10 %) | offen |
| 21 | KVS-Schreibvorgänge | `Sys.GetStatus.kvs_rev` morgens und abends notieren | Differenz unter 24 je Tag (je Fenster Claim + `st/day/job/lrn`; Mock 15–22) | Gerät 13.09.2026 nur je Lauf: Zeitraffer-Fenster `w=4`, Takt `w=0–3`; Tagesdifferenz offen |

## Offen

- Kalibrierzustände **mittel feucht** und **nass** des Kalibrierlaufs: Sensor nach Fahrplan umstecken, `hwtest.js <ip> kal 2400`, danach `normal`, `kal report`, `kal write` ([12 · Erstinbetriebnahme](12-erstinbetriebnahme.md)).
- **Fenster 2–4** des Zeitraffer-Fahrplans 0.2.0 (Pause, Hitze, `wasser`, `limit`) mit den Profilwerten `tMax` <!-- zr:cfg3.tMax -->40<!-- /zr --> s / `tSoak` <!-- zr:cfg4.tSoak -->10<!-- /zr --> s.
- **Erstes echtes 20:00-Fenster** mit trockener Erde, mitgelesen mit `console.js <ip> 900` (Matrix 17).
- `cfg3.tDead`/`tMin` am **Endaufbau mit längerem Schlauch** per `mess` nachmessen (10–20 s laut Nutzer).
- **Zielband** `cfg2` (obere und untere Referenz an der Pflanze) und `dropSlow` – noch die Beispielwerte vom 13.09.2026.
- Matrixzeilen 1, 5, 6, 7, 9, 10, 11, 15, 16, 19, 20 sowie das reale Auslösen der Abschaltungen (13, 14); Fördermenge der Pumpe je Sekunde ([04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md)); Verhalten nach Stromausfall und Firmware-Update ([13 · Betrieb und Wartung](13-betrieb-und-wartung.md)).

## Vorlage für den nächsten Eintrag

Neue Läufe kommen als eigener Abschnitt oberhalb der Prüfmatrix dazu, erledigte Matrixzeilen bekommen in der Spalte „Stand“ Datum und Beleg. Der Ablauf eines Gerätelaufs steht als Checkliste in [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md); die Kurzfassung:

1. `npm test` grün, `npm run build`, Flash prüfen (`hwtest.js <ip> scripts`).
2. Upload mit `put-script.js`, danach `verify-scripts.js` (byteidentisch, Versionsgleichheit).
3. `hwtest.js <ip> normal 30` – der Installer ergänzt neue Felder; `verifyState` ohne Abweichung.
4. Lauf fahren (`zeitraffer`, `kal`, `mess` oder ein echtes Fenster mit `console.js`), Konsole und Statuszeilen in eine Logdatei.
5. Zurück mit `normal 60`; Rohdaten in `docs/kal/`; Eintrag nach dieser Vorlage; Überraschungen nach [18 · Lernlog vom Gerät](18-lernlog-geraet.md).

```markdown
## <Lauf> <TT.MM.JJJJ> (<Script> v<x.y.z>, <Werkzeug> v<x.y.z>, Firmware <x.y.z>)

Aufbau: <Sensorlage, Schlauch, Behälter> · Werkzeuge: <Befehle> · Mock-Stand: npm test <n> grün · Logdatei: docs/kal/<datum>-….txt

| Schritt | Erwartung (Quelle: Test, Handbuch-Kapitel) | Ergebnis / Uhrzeit (Ortszeit) |
| --- | --- | --- |
| … | … | … |

Messwerte: mem_used/mem_peak je Script (watch-Statuszeile), mem_free im Leerlauf, fs_free, kvs_rev vorher/nachher, dauer= je Lauf
Befunde: <Symptom> → 18 · Lernlog (+ Regel in den Tests) · Entscheidungen → 17 · Etappenlog
Offen: <was nicht gezeigt wurde>
```

## Beispielausgabe

Aktivierung des Kalibrierlaufs am 13.09.2026 (`hwtest.js kal 780`, Auszug aus der Logdatei: Statuszeilen `[status …]`, Fahrplan- und Rekorder-Ausgabe des Werkzeugs, die Zeile `kein bw_zeitraffer/bw_install läuft mehr` und Firmware-Zeilen `JS RAM stat` weggelassen). `bw_zeitraffer` schreibt die Sicherung und startet `bw_install`, der den Zeitraffer-Zeitplan meldet; danach prüft das Werkzeug den Zustand:

```text
sicherer Moment: 15:50:09
Script.Start bw_zeitraffer (id 7) → {"was_running":false}
[bw_zeitraffer 0.2.0] Sicherung zrb1..5 wird geschrieben; Profil: Takt 3 min, Fenster alle 6 min, Budget 120 s, bis 3 Portionen, tHot 30 °C, maxDay 4, Trockenphase aus
[bw_zeitraffer 0.2.0] bw_install gestartet (id 1) – baut Zeitplan und auto_off. Zurück zum Normalbetrieb: bw_install erneut starten
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] Zeitplan: 3 Einträge, davon eigene: 3
[bw_install 0.1.3] Switch 0: auto_off 50 s
[bw_install 0.1.3] KVS neu angelegt: keine
[bw_install 0.1.3] Zeitplan #1: 0 */3 * * * *
[bw_install 0.1.3] Zeitplan #2: 30 */6 * * * *
[bw_install 0.1.3] Zeitplan #3: 40 2,8,14,20,26,32,38,44,50,56 * * * *
[bw_install 0.1.3] fertig – ZEITRAFFER aktiv: bw_main alle 3 min, bw_pump alle 6 min (Sekunde 30), Budget 120 s, bis 3 Portionen, Sicherheits-Aus 160 s nach der Fensterminute; zurück: bw_install starten
ok       Zeitplan: #1 [0 */3 * * * *] #2 [30 */6 * * * *] #3 [40 2,8,14,20,26,32,38,44,50,56 * * * *]
ok       auto_off 50 s
ok       Sicherung zrb1..5 vorhanden (Original: tick 15, tMax 180, tWin 420, pctDry 28)
ok       Profil: Takt 3 min, Fenster alle 6 min, Budget 120 s, bis 3 Portionen, tStd 12 s, tHot 30 °C, maxDay 4, pctDry 39
ok       Script-Heap frei: 25200, ram_free 143208, kvs_rev 496
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
```

Die Konsole von Fenster 1 (15:54:30) mit den `watch`-Statuszeilen steht in [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md). Der Bericht aus der Aufzeichnung lässt sich ohne Gerät jederzeit neu erzeugen – so sieht er heute aus:

```bash
node tools/hwtest.js <ip> kal report docs/kal/2026-09-13-13-50-kal.json docs/kal/2026-09-13-13-50-kal-log.txt   # Bericht aus JSON + Logdatei, kein Gerät nötig
```

```text
Konsolenzeilen aus docs/kal/2026-09-13-13-50-kal-log.txt: 5
Aufzeichnung: docs/kal/2026-09-13-13-50-kal.json
Kalibrierlauf 2026-09-13T13:50:34.253Z – 155 Proben, 1 Fenster; Zustände: trocken < pctDry 28, mittel 28–40 (Gabe fällig), band 40–60 (keine Gabe), nass > pctHi 60 (Ziel pctOk 50, pctSoll 55)
Fenster  Start   Zustand       m0     n  Σs   tRise  Spitze  Ruhe   pctW   effW   why   | Portionen (Konsole): sec/Δ%/tRise → effW nach tRise
     1   4:06  trocken       10.4   2   22     12    55.5   55.5   50.5   2.01   unstab (Kontrolle 53.7)   | P1 12s/+23.6/8s P2 10s/+16.5/5s → 4.46 %/s
Zustand trocken: Gewinn effW 4.46 %/wirksame s aus 1 Fenster
Zustand nass: nicht aufgezeichnet (Sensor zum Schluss ins nasse Substrat oder Wasserglas)
Vorschlag: lrn.effW 4.46 (Mittel aus 1 Fenster, Skala % je Sekunde nach tRise aus den Konsolenzeilen) · cfg4.tDead2 5 s (Median tRise der Folgeportionen) · cfg3.tDead 8 s (tRise der Erstportion; gilt für DIESEN Schlauch – im Endaufbau per mess nachmessen)
Schreiben (nur im Normalbetrieb, mischt effW mit dem vorhandenen Wert α 0,5): node tools/hwtest.js <ip> kal write [datei]
```

`kal write` um 16:06 meldete die vier Änderungen so (die Zeilen `vorher:`/`nachher:` mit dem vollständigen `lrn`/`cfg4`-Inhalt sind hier weggelassen; die Hinweiszeilen liefert der Rechenkern `tools/lib/kal.js` aus derselben Aufzeichnung):

```text
  lrn.effW null → 4.46 (Messwert)
  cfg4.tDead2 8 → 5 s
  cfg3.tDead 20 → 8 s (tRise der Erstportion; Endaufbau mit anderem Schlauch: mess)
  cfg3.tMin 25 → 10 s (max(tPmin, tDead + 2))
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| Uhrzeiten im Protokoll passen nicht zu den Dateinamen in `docs/kal/` (`…-13-50-…` gegen 15:50) | Dateinamen und das Feld `start` in den JSON-Dateien sind UTC; Konsole, Statuszeile und Protokoll sind Ortszeit (Europe/Vienna) | Ortszeit protokollieren, Dateinamen wörtlich zitieren, beim Vergleich zwei Stunden (Sommerzeit) dazurechnen |
| `kal report` zeigt `effW 2.01` und `tDead ≈ 12 s` statt 4,46 und 8 s | keine Konsolenzeilen von `bw_pump` in der Aufzeichnung (Rekorder älter als `hwtest.js` 0.1.2 oder Debug-Websocket aus) – der Bericht rechnet im Profilmaß | `kal report <json> <log>` mit der `watch`-Logdatei; `kal write` erst dann; vor dem nächsten `kal` den Websocket prüfen (`preflight`) |
| Heap-Zahlen widersprechen sich (24 920 gegen 25 200, 7,4 KB gegen 16 380) | Leerlauf und Spitze sind verschiedene Momente; `Script.GetStatus` misst nur den Augenblick | `mem_used`/`mem_peak` während des Laufs aus der `watch`-Statuszeile notieren, `mem_free` im Leerlauf getrennt, jeweils mit Script-Version |
| erste Konsolenzeile eines Scripts fehlt im Log | `console.js` oder `watch` wurde erst nach `Script.Start` verbunden | Konsole vor dem Start verbinden – `console.js <ip> 900 <id>` startet das Script selbst |
| `Schedule.Create '…': Invalid argument 'timespec'` als Fehler notiert | der erste `Schedule.Create` je Installer-Lauf scheiterte am 12./13.09.2026 in der Regel (Firmware-Eigenheit), der Installer wiederholt ihn stumm – bei `DEBUG = 0` nicht in der Konsole sichtbar | nur eine zweite Ablehnung (`Hinweis: Schedule.Create …`) ist ein Befund; Timespec per curl gegenprüfen |
| Prüfzeile als erledigt markiert, obwohl nur der Mock lief | Mock-Test und Gerätelauf verwechselt | Spalte „Stand“: „Gerät <Datum>“ nur mit Konsole, Statuszeile oder RPC-Antwort als Beleg; sonst „Mock: <Testdatei>“ |
| `preflight` meldet während des Zeitraffers „Script 2 bw_main läuft“ | im Zeitraffer läuft `bw_main` alle 3 min für 5–8 s | erneut aufrufen; kein Befund. Steht `out_of_memory` in der Statuszeile, sofort `normal` |
| `Timer 1 handle not found` oder `PCS write interval < 60s` im Log | Firmware-Hinweise: `Timer.clear` aus dem eigenen Callback, Zählerschreiben des Switch bei Portionen unter 60 s Abstand | nicht als Fehler protokollieren; Referenz für Abstürze ist `Script.GetStatus.errors` |

## Weiter zu

- [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md) – die offenen Fenster 2–4 und die Kalibrierzustände mittel feucht und nass fahren.
- [18 · Lernlog vom Gerät](18-lernlog-geraet.md) – Ursache, Fix und Regel zu jedem Befund aus diesen Läufen.
- [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md) – welche Entscheidung aus welchem Gerätelauf folgte.
