# 12 · Erstinbetriebnahme: Kalibrierung, Zielband, Zeitraffer, erstes Fenster

**Deutsch** · [English](../en/12-erstinbetriebnahme.md) — [Handbuch](README.md) · Teil D „Betreiben“

> **Auf einen Blick**
> - Ergebnis: die Werte, mit denen das Gerät richtig gießt – `cfg1` (Sensorskala), das Zielband in `cfg2`, der Lernwert `lrn.effW` und die Totzeiten `cfg3.tDead`/`cfg4.tDead2` – und der ganze Regelkreis einmal in 45 Minuten gesehen.
> - Reihenfolge: `cfg1` messen → Zielband eintragen → Installer (`normal`) → Messlauf (`mess`) → Praxistest im Zeitraffer (`zeitraffer`) → Kalibrierlauf (`kal`) → erstes echtes Fenster mitlesen.
> - Wichtigste Zahl: der Zeitraffer lässt dieselben Scripts mit Takt <!-- zr:cfg3.tick -->3<!-- /zr --> min und Gießfenster alle <!-- zr:cfg3.winEvery -->6<!-- /zr --> min laufen, Budget <!-- zr:cfg4.tWin -->120<!-- /zr --> s je Fenster, bis <!-- zr:cfg4.nPort -->3<!-- /zr --> Portionen – mit echtem Lernen.
> - Größter Stolperstein: der Schlauch muss **am Sensor** liegen (sonst Störung `noeff`), und vor jedem weiteren Fenster muss der Sensor zurück in trockene Erde (sonst `why=feucht`, keine Gabe).

## Voraussetzungen

- Installation abgeschlossen ([06 · Startanleitung](06-startanleitung.md)): `bw_install`, `bw_main`, `bw_pump` und `bw_zeitraffer` aus `dist/` hochgeladen und byteidentisch geprüft, Installer gelaufen, Zeitplan `0 */15 * * * *`, `30 0 8,20 * * *`, `0 8 8,20 * * *`.
- Hardware-Check bestanden ([11 · Hardware-Check](11-hardware-check.md)): Sensoren liefern Werte, `lvlEmpty` bestätigt, Pumpe lief; `cleanup` gemacht, keine Reste `hwb1`/`hwb2` im KVS.
- Node ≥ 22 auf einem Rechner mit Zugriff auf den Shelly – im LAN oder über den Tunnel `127.0.0.1:8010` ([09 · Installation mit VPS](09-installation-vps.md)); `<ip>` steht in diesem Kapitel für diese Adresse.
- Debug-Websocket an: Web-UI → Scripts → ein Script → Konsole öffnen; `node tools/hwtest.js <ip> preflight` meldet „Debug-Websocket an/aus“. Ohne ihn zeigen `watch`, `console.js` und der Rekorder von `kal` keine Konsolenzeilen, und `kal write` kann `tDead`/`tMin` nicht setzen.
- Am Topf: SMT50 unter den Tropfern (nassester Punkt – die Skala bezieht sich darauf), Schlauch am Sensor, Behälter voll, Schwimmer über dem Pumpeneinlauf. Für den Zeitraffer zusätzlich ein Glas Wasser, ein Becher warmes Wasser (über 30 °C) für den DS18B20 und ein zweiter Topf mit trockener Erde.
- Versionen dieses Kapitels: `bw_zeitraffer` <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact -->, `bw_main`/`bw_pump` <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, `hwtest.js` <!-- fact:ver.hwtest -->0.1.2<!-- /fact -->.

## Diagramm

[![Erstinbetriebnahme: von cfg1 über Zielband, Installer, Messlauf, Zeitraffer und Kalibrierlauf zum ersten echten Fenster](../diagramme/de/12-erstinbetriebnahme.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/12-erstinbetriebnahme.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/12-erstinbetriebnahme.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Kalibrierung“, 2 „Zeitraffer-Fahrplan“, 3 „Lernwerte übernehmen“.

## Die sieben Stationen

| Nr | Station | Befehl oder Handgriff | Ergebnis | Dauer |
| --- | --- | --- | --- | --- |
| 1 | Sensorkalibrierung | `bw_hwtest` (Phasen m1/m2) oder Voltmeter in der Web-UI ablesen | `cfg1.vDry`, `cfg1.vWet` | Minuten (Sensortest am 13.09.2026: 532 s für alle sechs Phasen) |
| 2 | Zielband | Referenzwerte an der Pflanze ablesen, `cfg2` per `KVS.Set` | sechs Felder in Bandordnung | Tage (die Pflanze muss einmal trocken werden) |
| 3 | Installer | `node tools/hwtest.js <ip> normal 60` | fehlende Felder ergänzt, Zeitplan und `auto_off` geprüft | 1 min |
| 4 | Messlauf | `node tools/hwtest.js <ip> mess 10 1` | Totzeit und Gewinn eines Pulses, Startwerte für `cfg3`/`cfg4` | gut 1,5 min je Puls (Beobachtung Standard 90 s, mit `mess 10 1 240` gut 4 min) |
| 5 | Praxistest im Zeitraffer | `zeitraffer 60` → `watch 300` → `normal 60` | vier Fenster, Pause, Hitze, `wasser`, `limit` gesehen | 45 min |
| 6 | Kalibrierlauf | `kal` → `normal 60` → `kal report` → `kal write` | `lrn.effW`, `cfg4.tDead2`, `cfg3.tDead`, `cfg3.tMin` | 40 min (Standard 2 400 s) |
| 7 | Erstes echtes Fenster | `node tools/console.js <ip> 900` ab 07:59 oder 19:59 | Portionszeilen, `ergebnis=`, Takt 08:45/20:45 `Kontrolle:` | 15 min mitlesen |

Station 1 und 2 sind Voraussetzung für alles Weitere: ohne `cfg1` stimmt die Prozentskala nicht, ohne vollständiges Band gießt das Gerät nie (`why=cfg`). Station 4 bis 6 sind der Weg zu belastbaren Lernwerten; Station 7 ist die Abnahme.

## Sensorkalibrierung cfg1

Die Feuchteskala ist eine eigene Kalibrierung, keine Herstellerformel: `pct = (V − vDry) / (vWet − vDry) · 100`. **0 % = Sensor trocken in Luft, 100 % = Sensor im Wasser**; 100 % ist ein Kalibrierpunkt, nie ein Zielwert. Startwerte: `vDry` <!-- def:cfg1.vDry -->0.20<!-- /def --> V, `vWet` <!-- def:cfg1.vWet -->3.13<!-- /def --> V.

> **Am Gerät gemessen (13.09.2026):** Trockenpunkt 0,296 V (Sensor abgewischt, in Luft; am 12.09. in der Web-UI 0,20 V), Nasspunkt 3,134 V – von `bw_hwtest` nach `cfg1` geschrieben (`vDry` 0,20 → 0,296, `vWet` 3,13 → 3,134).

Weg A – der Hardware-Test misst und schreibt (nur die Feuchtephasen; Ablauf und Kommandos in [11 · Hardware-Check](11-hardware-check.md)):

```bash
node tools/hwtest.js <ip> preflight hw          # legt bw_hwtest und bw_hwpump an, nennt die Upload-Befehle mit ID
node tools/put-script.js <ip> <id> dist/bw_hwtest.js
node tools/hwtest.js <ip> cfg run='"m"'         # nur die Phasen m1 (Sensor trocken) und m2 (Sensor im Wasser)
node tools/hwtest.js <ip> start bw_hwtest 20    # je Phase: watch 120, Sensor trocken bzw. im Wasserglas, dann go
node tools/hwtest.js <ip> report                # cfg1.vDry/vWet neu, alt>neu unter cal
node tools/hwtest.js <ip> delete bw_hwtest      # Flash freigeben, wenn der Test nicht mehr gebraucht wird
```

Weg B – von Hand: Sensor sauber und trocken in der Luft, in der Web-UI die Voltmeter-Spannung ablesen (oder `V=` in der ersten Konsolenzeile von `bw_main`); dann bis zur Markierung ins Wasserglas, wieder ablesen. Beide Werte eintragen:

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg1","value":"{\"vDry\":0.296,\"vWet\":3.134}"}'   # Teilobjekt reicht vor dem Installer
```

> **Hinweis:** `KVS.Set` ersetzt den ganzen Eintrag. Vor dem Installer genügt das Teilobjekt (er ergänzt die übrigen Felder mit Startwerten). Später ein Feld ändern: Web-UI → Settings → Key-Value Storage → Eintrag öffnen → „Format as JSON“ → nur das Feld ändern – oder nach einem Teil-Schreiben den Installer erneut starten.

## Referenzwerte an der Pflanze und Zielband cfg2

Das Zielband sind fünf Feuchtewerte plus `dropSlow`. Der Installer legt sie als `null` an (`pctOk` <!-- def:cfg2.pctOk -->null<!-- /def -->, `dropSlow` <!-- def:cfg2.dropSlow -->null<!-- /def -->); solange eines der sechs Felder `null` ist, misst und protokolliert das System, gießt aber nicht (`err=cfg`, `why=cfg`). Die Werte kommen von zwei Messungen an der Pflanze:

1. **Obere Referenz** („gut versorgt“): Sensor im Topf, einmal kräftig gießen, 30 Minuten warten, `pct=` in der Konsole ablesen. `[TODO am Gerät]`
2. **Untere Referenz** („jetzt gießen“): warten, bis die Pflanze sichtbar Wasser braucht und die Erde auch in der Tiefe trocken ist, `pct=` ablesen. `[TODO am Gerät]`
3. **`dropSlow`:** an einem normalen Tag ohne Gabe die Abnahme über 24 h ablesen (`pct=` morgens und am nächsten Morgen), etwa die Hälfte davon eintragen. Bleibt die Abnahme darunter, gilt die lange Pause `pauseSlow` (Staunässe-Verdacht). `[TODO am Gerät]`

| Feld | Regel | Beispielband (Gerät seit 13.09.2026) |
| --- | --- | --- |
| `pctDry` | deutlich unter `pctLo`; die Trockenphase endet, sobald eine Taktmessung darunter liegt | 28 |
| `pctLo` | untere Referenz: Taktmessung darunter → Auftrag (mit laufendem Auftrag hält er bis `pctLo + hyst`) | 40 |
| `pctOk` | „Ziel erreicht“: das Fenster endet, sobald die stabile Feuchte diesen Wert erreicht; Frischmessung `≥ pctOk` → `feucht` | 50 |
| `pctSoll` | Zielpunkt der Dosisrechnung, wenige Prozent über `pctOk` (Mitte zwischen unterer und oberer Referenz) | 55 |
| `pctHi` | obere Referenz plus wenige Prozent: im Fenster darüber `over`; Taktmessung darüber = nass → Trockenphase | 60 |
| `dropSlow` | %/24 h, siehe Schritt 3 | 4 (steht seit dem Lauf mit 0.1.x, an der Pflanze noch zu messen) |

Ordnung: `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` und `pctLo + hyst < pctOk` (`hyst` <!-- def:cfg2.hyst -->2<!-- /def --> %), sonst bricht der Takt mit `err=cfg` ab. Eintragen (Teilobjekt vor dem Installer, Feldnamen in Bandordnung):

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctDry\":28,\"pctLo\":40,\"pctOk\":50,\"pctSoll\":55,\"pctHi\":60,\"dropSlow\":4}"}'
```

Die übrigen `cfg2`-Felder (`hyst`, `effMin`, `effMax`, `alpha`, `sfMin`, `sfStep`, `sfUp`, `dropW`) ergänzt der Installer mit Startwerten. Was jedes Feld im Regelkreis tut, steht in [03 · Konfiguration](03-konfiguration.md); wie der Takt damit entscheidet, in [02 · Flussdiagramm](02-flussdiagramm.md).

## Installer starten: normal

`node tools/hwtest.js <ip> normal 60` wartet einen sicheren Moment ab, startet `bw_install`, liest 60 s die Konsole mit und prüft danach das Ergebnis. Der Installer legt fehlende Einträge und Felder an (nichts wird überschrieben), prüft die Fensterregeln, baut den Zeitplan aus `cfg3`/`cfg4` neu, setzt `auto_off` = `tMax` + 10 = 190 s und beendet sich. Läuft gerade `bw_main` oder `bw_pump`, bricht er ab – das Werkzeug verhindert das durch den sicheren Moment.

Nach dem Lauf meldet das Werkzeug je Punkt `ok` oder `ABWEICHUNG`: Zeitplan (drei eigene Einträge `0 */15 * * * *`, `30 0 8,20 * * *`, `0 8 8,20 * * *`), `auto_off 190 s`, `keine Zeitraffer-Sicherung`, `cfg3/cfg4: Takt 15 min, Fenster 08:00/20:00, tMax 180 s, tWin 420 s, Sicherheits-Aus +8 min`, Script-Fehler, freier Script-Heap – und schließt mit `NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet`. Bei Abweichungen: Konsole lesen, `normal` wiederholen.

Dasselbe Kommando nach jedem Script-Update: der Installer ergänzt neue Felder (bei 0.1.x → 0.2.0: `cfg4`, `cfg2.pctOk`/`dropW`/`sfUp`, `cfg3.dryDay`, `lrn.effW`) – `pctOk` allerdings nur als `null`, den Wert trägt man selbst ein.

> **Hinweis:** Ein Handstart von `bw_main` in der Web-UI ist erlaubt, aber nicht in Sekunde 0–8 einer Taktminute (sonst läuft er neben dem Zeitplan-Start). Die erste Zeile muss `V=` (Spannung), `tC=` (Temperatur) und `lvl=` 0 oder 1 zeigen; sonst `cfg1.idV`/`idT`/`idLvl` anpassen.

## Messlauf mess: Wirkung eines Pumpenpulses

Bevor Zeitwerte in `cfg3`/`cfg4` geändert werden, lohnt ein Blick auf den echten Aufbau. `node tools/hwtest.js <ip> mess [sek] [n] [beob]` schaltet die Pumpe `n`-mal (Standard 3, höchstens 6) für `sek` Sekunden (Standard 3, höchstens 10) mit `Switch.Set toggle_after` ein und liest den Sensor alle 2 s über `beob` Sekunden je Puls (Standard 90, 30–300). Reines Werkzeug, kein Gerätecode.

- Vorbedingungen: Ausgang aus, Schwimmer VOLL, Voltmeter plausibel, kein Zeitraffer aktiv (`zrb1`); dann wartet es den sicheren Moment ab (kein Script läuft, nicht bis 9 min nach einem Fenster).
- Je Puls druckt es: Feuchte vorher, Spitze mit Zeitpunkt, Ruhewert mit Einschwingzeit, `tRise` (erste Reaktion ≥ 1 %), Gewinn in %/wirksame Sekunde (brutto %/s) und wann der Ausgang ausging.
- Am Ende Vorschläge als Startwerte: `effMax`, `tPmin`, `tDead`, `tMin`, `tSoak`, `tStab`. `cfg4.tDead2` liest man selbst aus `tRise` der Folgepulse ab (`kal write` setzt es später aus dem Kalibrierlauf). Rohdaten: `docs/kal/<datum>-mess.json`.

> **Am Gerät gemessen (13.09.2026):** SMT50 mittig in trockener Erde, zwei Tropfer direkt darüber. **3-s-Pulse messen nur den Schlauch**: Totzeit 5–8 s, danach kriecht Nachlaufwasser minutenlang (+2 bis +12 %, Ruhe erst nach 65–160 s). **Ein 10-s-Puls** bei 37,5 % reagiert nach 7,9 s, erreicht die Spitze 49,1 % fünf Sekunden nach dem Ausschalten (+11,6 % = 5,6 %/wirksame s) und bleibt danach stabil.

| Lauf | Puls | Feuchte vorher → Spitze (t) → Ruhe | `tRise` | Gewinn | Befund |
| --- | --- | --- | --- | --- | --- |
| 14:54 | 3 s | 10,4 → 10,7 | – | – | keine Reaktion: der Puls füllt nur den leeren Schlauch |
| 14:56 | 3 s | 10,7 → 20,2 (86 s) | 5,3 s | +9,5 % | Sprung binnen 10 s, dann Kriechen bis 86 s |
| 14:58 | 3 s | 20,2 → 31,9 (80 s) | 5,5 s | +11,7 % | wie oben, Kriechen +8 % zwischen 20 und 87 s |
| 15:01 | 3 s | 34,0 → 36,1 (162 s) | 7,8 s | +2 % | bei feuchterer Erde fast nur Nachlauf |
| 15:05 | 3 s | 35,7 → 37,8 (65 s) | 7,9 s | +2 % | dito |
| 15:10 | 10 s | 37,5 → 49,1 (15 s), stabil 2 min | 7,9 s | +11,6 % = 5,6 %/wirksame s | Anstieg während des Pumpens, Ruhewert 5 s nach dem Ausschalten |

Daraus die Startwerte `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s, `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> s, `tMin` <!-- def:cfg3.tMin -->25<!-- /def --> s, `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s, `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s, `effMax` <!-- def:cfg2.effMax -->30<!-- /def --> und die Regel: **Portionen nie kürzer als die Totzeit.** Nebenbefunde: keine Spannungseinbrüche am Voltmeter bei laufender Pumpe, frische Werte bei 2-s-Abfrage.

## Praxistest im Zeitraffer (45 Minuten)

### Was der Zeitraffer tut

Im Normalbetrieb dauert es Tage, bis man Fenster, Pause, Hitzeregel und Tageslimit einmal gesehen hat. Der Zeitraffer lässt **dieselben Betriebs-Scripts `bw_main` und `bw_pump` unverändert laufen, nur mit kurzen Zeiten**: Takt 3 min statt 15, Gießfenster alle 6 min statt 08:00/20:00, Fenster-Budget 120 s mit bis zu 3 Portionen und echtem Lernen, Pause 12 min (Hitze 6 min), Tageslimit 4, Trockenphase aus.

`bw_zeitraffer` sichert die Betriebswerte (`cfg3`, `lrn`+`day`, `st`+`err`, `cfg4`, `cfg2` → `zrb1`–`zrb5`), schreibt die Profile, setzt den Zustand frisch, schreibt als Letztes die Marke `zr` und startet `bw_install`, der den Zeitplan baut. **Zurück bringt `bw_install`:** findet er die Sicherung ohne Marke, schreibt er das Original zurück – Lernwerte, Pause und Tageszähler sind danach wie vor dem Test; Testgaben und Testlernwerte zählen nicht.

### Start und Befehle

Voraussetzungen, die das Werkzeug vorab prüft (jeder Verstoß ist ein `BLOCKER`): Zielband vollständig und geordnet (auch `pctOk`), `cfg3.tick` vorhanden (Installer gelaufen), Eingang liefert einen Wert und Schwimmer VOLL, Ausgang aus, die vier Scripts vorhanden und mit Code, keine `hwb1`/`hwb2`. Eine stehende Störung `noeff` ist nur eine Warnung: der Zeitraffer legt sie beiseite, `bw_install` stellt sie danach wieder her.

```bash
npm run build                                   # dist/ aktuell?
node tools/hwtest.js <ip> preflight             # legt bw_zeitraffer an, nennt den Upload-Befehl mit ID
node tools/put-script.js <ip> <id> dist/bw_zeitraffer.js
node tools/hwtest.js <ip> normal 60             # Installer: ergänzt Felder, baut den Zeitplan
node tools/hwtest.js <ip> zeitraffer 60         # Vorprüfung, sicherer Moment, Start, Prüfung von Zeitplan/cfg3/cfg4/auto_off, Fahrplan
node tools/hwtest.js <ip> watch 300             # Konsole + Statuszeile (st, n, pctW, why, err, Speicher), beliebig oft; im Zeitraffer bis 1800 s
node tools/hwtest.js <ip> normal 60             # zurück: Original aus zrb1..5, Zeitplan und auto_off geprüft
```

Nach dem Start prüft das Werkzeug: Zeitplan `0 */3 * * * *`, `30 */6 * * * *` und `40 2,8,14,20,26,32,38,44,50,56 * * * *` (Sicherheits-Aus), `auto_off` 50 s (`tMax` 40 + 10), Sicherung `zrb1..5` vorhanden, Marke `zr` verbraucht, Profil in `cfg3`/`cfg4`. Dann meldet es `ZEITRAFFER AKTIV – mitlesen: … watch 300 · zurück: … normal` und druckt darunter den Fahrplan.

### Sicherer Moment

`zeitraffer`, `normal`, `mess` und `kal` starten nur in einem sicheren Moment und warten dafür bis zu 4 Minuten: Sekunde 8–30 einer Minute (`bw_main` liest und schreibt in den ersten Sekunden jedes Takts), im Zeitraffer nicht in den Minuten 0–2 eines 6er-Zyklus (dort regelt `bw_pump` bis zu 120 s lang), im Normalbetrieb nicht bis 9 min nach `winA`/`winB` (Fenster bis 30 + `tWin` s, Sicherheits-Aus bei +8 min), und kein Betriebs- oder Test-Script läuft. Ein Umbau dazwischen ginge verloren. Wer `bw_zeitraffer` oder `bw_install` von Hand in der Web-UI startet, hält sich an dieselbe Regel.

### Profil

`ZR3`/`ZR4` in `scripts/bw_zeitraffer.js`, dort je Feld dokumentiert und änderbar; alle anderen Felder in `cfg3`/`cfg4`/`cfg2` bleiben, wie sie sind.

| Feld | Normal | Zeitraffer | Wirkung im Test |
| --- | --- | --- | --- |
| `tick` | <!-- def:cfg3.tick -->15<!-- /def --> min | <!-- zr:cfg3.tick -->3<!-- /zr --> min | `bw_main` misst und entscheidet alle 3 Minuten |
| `winEvery` | <!-- def:cfg3.winEvery -->null<!-- /def --> | <!-- zr:cfg3.winEvery -->6<!-- /zr --> min | `bw_pump` läuft in jeder Minute ≡ 0 mod 6 (Sekunde 30) statt um `winA`/`winB` |
| `soak` | <!-- def:cfg3.soak -->30<!-- /def --> min | <!-- zr:cfg3.soak -->0.25<!-- /zr --> min | Kontrolle beim nächsten Takt (150 s nach dem Fensterstart) |
| `pauseHot` | <!-- def:cfg3.pauseHot -->12<!-- /def --> h | <!-- zr:cfg3.pauseHot -->0.1<!-- /zr --> h (360 s) | Hitze: nächstes Fenster 6 min nach dem letzten |
| `pause` | <!-- def:cfg3.pause -->24<!-- /def --> h | <!-- zr:cfg3.pause -->0.2<!-- /zr --> h (720 s) | normal: nächstes Fenster 12 min nach dem letzten |
| `pauseSlow` | <!-- def:cfg3.pauseSlow -->48<!-- /def --> h | <!-- zr:cfg3.pauseSlow -->0.35<!-- /zr --> h | nie aktiv (braucht 24 h Messreihe) |
| `jobAge` | <!-- def:cfg3.jobAge -->20<!-- /def --> min | <!-- zr:cfg3.jobAge -->5<!-- /zr --> min | Auftrag darf beim Fenster höchstens 5 min alt sein (Takt → Fenster 3,5 min) |
| `maxDay` | <!-- def:cfg3.maxDay -->2<!-- /def --> | <!-- zr:cfg3.maxDay -->4<!-- /zr --> | vier Fenster im Test, dann `limit` |
| `tDead` / `tMin` / `tStd` / `tMax` | <!-- def:cfg3.tDead -->20<!-- /def --> / <!-- def:cfg3.tMin -->25<!-- /def --> / <!-- def:cfg3.tStd -->70<!-- /def --> / <!-- def:cfg3.tMax -->180<!-- /def --> s | <!-- zr:cfg3.tDead -->2<!-- /zr --> / <!-- zr:cfg3.tMin -->10<!-- /zr --> / <!-- zr:cfg3.tStd -->12<!-- /zr --> / <!-- zr:cfg3.tMax -->40<!-- /zr --> s | Erstportion 12 s ohne Lernwert; Summe je Fenster 40 s; `auto_off` 50 s |
| `tChk` | <!-- def:cfg3.tChk -->5<!-- /def --> s | <!-- zr:cfg3.tChk -->1<!-- /zr --> s | Wasserstand während der Portion jede Sekunde |
| `tHot` | <!-- def:cfg3.tHot -->35<!-- /def --> °C | <!-- zr:cfg3.tHot -->30<!-- /zr --> °C | Handwärme oder ein Becher warmes Wasser reicht (35 nur mit Föhn) |
| `dryDay` | <!-- def:cfg3.dryDay -->5<!-- /def --> (Freitag) | <!-- zr:cfg3.dryDay -->null<!-- /zr --> | kein Trockentag |
| `cfg4` Fenster | `tWin` <!-- def:cfg4.tWin -->420<!-- /def -->, `tTail` <!-- def:cfg4.tTail -->20<!-- /def -->, `nPort` <!-- def:cfg4.nPort -->6<!-- /def -->, `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def -->, `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> | `tWin` <!-- zr:cfg4.tWin -->120<!-- /zr -->, `tTail` <!-- zr:cfg4.tTail -->20<!-- /zr -->, `nPort` <!-- zr:cfg4.nPort -->3<!-- /zr -->, `tPmin` <!-- zr:cfg4.tPmin -->10<!-- /zr -->, `tPmax` <!-- zr:cfg4.tPmax -->15<!-- /zr --> | Fenster ≤ 120 s, bis 3 Portionen von 10–15 s |
| `cfg4` Messung | `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def -->, `tStep` <!-- def:cfg4.tStep -->5<!-- /def -->, `tStab` <!-- def:cfg4.tStab -->60<!-- /def -->, `nStab` <!-- def:cfg4.nStab -->4<!-- /def -->, `dStab` <!-- def:cfg4.dStab -->1<!-- /def -->, `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def -->, `dEffMin` <!-- def:cfg4.dEffMin -->2<!-- /def --> | `tSoak` <!-- zr:cfg4.tSoak -->10<!-- /zr -->, `tStep` <!-- zr:cfg4.tStep -->5<!-- /zr -->, `tStab` <!-- zr:cfg4.tStab -->30<!-- /zr -->, `nStab` <!-- zr:cfg4.nStab -->3<!-- /zr -->, `dStab` <!-- zr:cfg4.dStab -->1<!-- /zr -->, `tDead2` <!-- zr:cfg4.tDead2 -->0<!-- /zr -->, `dEffMin` <!-- zr:cfg4.dEffMin -->1<!-- /zr --> | Einsickern 10 s, Stabilität aus 3 Werten binnen 30 s, keine Totzeit der Folgeportion |
| `cfg2.pctDry` | 28 (Beispielband) | <!-- zr:cfg2.pctDry -->pctLo − 1<!-- /zr --> | Trockenphase praktisch aus – der Sensor unter dem Schlauch bleibt nass |

### Warum die krummen Pausen

`bw_main` rechnet die Pause mit zwei Takten Vorlauf: `(now + 2·tick·60) − st.ts ≥ pause·3600`, weil der Auftrag einen Takt vor dem Fenster entsteht. Die Gabe startet bei Sekunde 30 der Fensterminute T. Damit ist `pauseHot` 0,1 h (360 s) beim Takt T+3 erfüllt (510 s) → Auftrag T+3, Fenster T+6:30; `pause` 0,2 h (720 s) beim Takt T+9 (870 s) → Fenster T+12:30.

Das Fenster-Budget 120 s endet mit Reserve `tTail` 20 s vor dem Takt T+3 (30 + 120 + 20 ≤ 180). Der Sicherheits-Aus des Zeitplans feuert 160 s nach der Fensterminute: Minute T+2, Sekunde 40 – deshalb die Minutenliste `40 2,8,14,…,56 * * * *`.

### Fahrplan

Minuten ab dem Start S, einer vollen 6er-Minute. `why` steht in der Konsolenzeile von `bw_main` und in der Statuszeile von `watch`; die Erwartungen sind im Mock als Test hinterlegt (`tools/test/zeitraffer.test.js` mit Topfmodell).

| Minute | Handgriff | Erwartung |
| --- | --- | --- |
| vor 0 | SMT50 ins Wasserglas (oder in feuchte Erde zwischen `pctLo` und `pctHi`), Schwimmer VOLL, `zeitraffer 60` | `bw_install`: „ZEITRAFFER aktiv“, Zeitplan `0 */3`, `30 */6`, `40 2,8,…,56`, `auto_off` 50 s |
| 0, 3 | – | Wasserglas (≈ 100 % > `pctHi`) → `why=trocken` mit Konsolenzeile `Trockenphase (nass 100 %): warte auf < 39 %`; feuchte Erde (≥ `pctLo`) → `why=feucht`. Beides: kein Auftrag; 0:30 `bw_pump`: `kein Auftrag` |
| 3 (nach dem Takt) | SMT50 in trockene Erde, Schlauch am Sensor | Minute 6 `why=ok sec=12`; **6:30 Fenster 1**: `Fenster: Auftrag 12 s …`, `m0 … → P1 12 s`, `P1 12s: …`, ggf. `P2 …`, `ergebnis=… n=… effW=…`; Minute 9 `Kontrolle: …`, danach `st=sperre why=pause` |
| 9–14 | SMT50 in den zweiten Topf mit trockener Erde (Schlauch mit) | Minute 15 `why=ok` mit `sec` aus `effW`; **18:30 Fenster 2** (12 min nach Fenster 1): Erstportion unter dem Ziel, Korrekturportion bis `pctOk` |
| 19 | DS18B20 in warmes Wasser, bis `tC` > 30; Sensor wieder in trockene Erde | Minute 21 `tC=31 pause=0.1h why=ok`; **24:30 Fenster 3** (6 min nach Fenster 2: Hitzeregel) |
| 25 | Schwimmer auf LEER | Minute 27 `why=wasser err=wasser`; 30:30 pumpt nicht |
| 31 | Schwimmer auf VOLL, Sensor in trockene Erde | Minute 33 `why=ok`; **36:30 Fenster 4**; Minute 39 `why=limit` (Tageslimit 4) |
| 40 | `normal 60` | `bw_install`: `Zeitraffer beenden: Original aus zrb1..5 zurück: …`, Zeitplan `0 */15`, `30 0 8,20`, `0 8 8,20`, `auto_off` 190 s, `zrb1..5`/`zr` gelöscht |

Optional: Schwimmer während einer Portion auf LEER → `ergebnis=abbruch err=wasser`; Sensor zum Fenster im Wasserglas lassen → `m0 … > pctHi – nass` ohne Gabe.

### Woran man den Regelkreis erkennt

Die Konsole von `bw_pump` zeigt je Fenster eine Kopfzeile, eine Zeile je Portion und eine Ergebniszeile – am 13.09.2026 in Fenster 1: `Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s` → `m0 10.4 % → P1 12 s` → `P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)` → `P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)` → `ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1`.

Eine `P`-Zeile nennt Feuchte vor → nach der Portion, den Zuwachs dieser Portion, `g` = bisheriger Fenstergewinn je wirksame Sekunde (alle Portionen seit `m0` zusammen, deshalb `P2` 2,006 = (23,6 + 16,5) / (10 + 10)), die erste Reaktion nach `tRise` s und die Stabilisierungszeit. Die Korrekturportion `P2` kommt aus dem in `P1` gemessenen Gewinn, geklemmt auf `tPmin` 10 s. Der Takt danach zeigt `Kontrolle: 50.5 → 53.7 % sf=0.7`.

### Rückbau und Prüfung

`normal 60` startet `bw_install` im sicheren Moment; ohne die Marke `zr` schreibt er das Original zurück (`Zeitraffer beenden: Original aus zrb1..5 zurück: cfg3,lrn,day,st,err,cfg4,cfg2,job`) und baut den normalen Zeitplan. Das Werkzeug prüft danach Zeitplan, `auto_off` = `tMax` + 10, dass `zrb1..5` und `zr` weg sind, `cfg3.winEvery` `null` ist, und meldet Script-Fehler. Nach der Rückkehr ist `job` frisch (`bw_main` schreibt ihn im nächsten Takt neu); ein im Test gelernter `effW` kommt nicht mit – das Original steht in `zrb2`, Lernwerte für den Betrieb liefert der Kalibrierlauf.

### Stolpersteine

- **Gelernt wird echt:** `tDead` 2 < `tStd` 12 → wirksame Sekunden; `bw_pump` lernt `lrn.effW` schon in Fenster 1 und dosiert Fenster 2 daraus. Bleibt die Wirkung zweimal aus (Schlauch nicht am Sensor), blockiert `noeff` – dann `err` löschen und Schlauch prüfen. Wer nur die Mechanik sehen will: `cfg4.nPort` 1 und den Schlauch in einen Eimer (Einzelportion ohne Messung und ohne Lernwert).
- **Hitze bleibt:** Das Tagesmaximum steht in `lrn.tMaxD` bis Mitternacht; ab der Erwärmung gilt `pauseHot` für den Rest des Tests. Deshalb kommt die Hitze im Fahrplan erst nach der normalen Pause.
- **Sensor umstecken:** Nach einem gelernten Fenster liegt die Feuchte über `pctOk`. Damit das nächste Fenster gießt, muss der Takt davor `pct < pctLo` sehen – den Sensor also rechtzeitig in trockene Erde stecken (die Frischmessung im Fenster prüft es noch einmal: `feucht` ohne Gabe).
- `preflight` meldet während des Zeitraffers zufällig „bw_main läuft“ (alle 3 min): normal. Steht in der Statuszeile `out_of_memory`, sofort `normal`.
- Eine vor dem Test stehende Störung `noeff` kommt nach der Rückkehr zurück.

### KVS-Einträge des Zeitraffers

| Eintrag | Inhalt | Wer löscht |
| --- | --- | --- |
| `zrb1` | Kopie von `cfg3` | `bw_install` beim Rückbau |
| `zrb2` | `lrn` und `day` | `bw_install` beim Rückbau |
| `zrb3` | `st` und `err` | `bw_install` beim Rückbau |
| `zrb4` | `cfg4` | `bw_install` beim Rückbau |
| `zrb5` | `cfg2` (Original mit dem echten `pctDry`) | `bw_install` beim Rückbau |
| `zr` | Startmarke `{go:1}`, die `bw_zeitraffer` als Letztes schreibt | `bw_install` beim Anlegen des Zeitraffer-Zeitplans; bricht der Start vorher ab, baut der nächste Installer-Lauf zurück |

## Kalibrierlauf kal: trocken, mittel feucht, nass

### Ablauf

`node tools/hwtest.js <ip> kal [sek]` ist ein Zeitraffer mit Rekorder (Standard 2 400 s, 600–3 600): er startet wie `zeitraffer` (Vorprüfung, sicherer Moment, Prüfung), zeigt seinen eigenen Fahrplan, zeichnet alle 5 s Sensorwerte und Ausgang, jede Änderung von `st`/`job`/`lrn` und die Konsolenzeilen von `bw_pump` nach `docs/kal/<datum>-kal.json` auf (jede Minute gespeichert) und druckt am Ende den Bericht. Strg+C beendet früher; der Zeitraffer läuft dann weiter.

```bash
node tools/hwtest.js <ip> kal 2400        # Zeitraffer + Rekorder; Sensor vorher in trockene Erde
node tools/hwtest.js <ip> normal 60       # Rückbau (Pflicht vor kal write)
node tools/hwtest.js <ip> kal report      # Bericht aus der jüngsten Aufzeichnung; optional: kal report <json> <watch-log>
node tools/hwtest.js <ip> kal write       # schreibt lrn.effW, cfg4.tDead2, cfg3.tDead, cfg3.tMin; Vorher/Nachher in der Ausgabe
```

### Zustände

Die Referenzzustände sind auf das normale Zielband abgebildet (`tools/lib/kal.js`, Rechenkern ohne Gerät):

| Zustand | Bereich (Beispielband) | Bedeutung | Gabe und Lernwert |
| --- | --- | --- | --- |
| trocken | unter `pctDry` (< 28 %) | Erde nach einer Trockenphase | ja |
| mittel | `pctDry`…`pctLo` (28–40 %) | hier entsteht im Alltag der Gießauftrag | ja |
| band | `pctLo`…`pctHi` (40–60 %) | Zielbereich, keine Gabe | nein (`feucht`) |
| nass | über `pctHi` (> 60 %) | im Echtbetrieb beginnt hier die Trockenphase; im Zeitraffer endet sie unter `pctLo − 1` | nein (`trocken`), nur Referenz |

### Fahrplan des Kalibrierlaufs

Wie ihn `kal` ausgibt (F1 = erstes Fenster, die erste 6er-Minute nach dem ersten Takt, Sekunde 30; Schlauch am Sensor):

1. Vor dem Start: Sensor in trockener Erde (unter `pctLo`, ideal unter `pctDry`) → Takt `why=ok`, F1 (trocken): Portionen bis ins Band. Sensor stecken lassen.
2. F1+3: Kontrolle (Nachlauf unter dem Tropfer). Danach Sensor in mittel feuchte, vorbefeuchtete Erde (28–40 %) → Pause 12 min: F1+9 `why=ok`, F1+12:30 F2 (mittel). Stecken lassen.
3. F2+3: Kontrolle. Danach Sensor ins nasse Substrat oder Wasserglas (über `pctHi`) → `why=trocken`, Fenster ohne Auftrag; mindestens 3 min drin lassen (Referenz nass).
4. Optional: Sensor zurück in trockene Erde → F3 nach der Pause (zweiter Trocken-Wert), bis `maxDay` 4 (`why=limit`).
5. Ende: Strg+C oder Zeit um → `normal 60` → `kal report` → `kal write`.

### kal report

Der Bericht zeigt je Fenster Zustand (nach `m0`), Portionen, Σ Sekunden, `tRise`, Spitze, Ruhewert, `pctW`, `effW`, `why` (mit Kontrollwert) und je Zustand den Gewinn; dazu die Referenz nass und die Vorschläge.

Entscheidend sind die Konsolenzeilen: `st.effW` rechnet mit den Totzeiten des Zeitraffer-Profils (`tDead` 2, `tDead2` 0), am Gerät kam das Wasser aber nach 8 bzw. 5 s. Der Bericht rechnet den Lernwert deshalb auf die Skala **„% je Sekunde nach `tRise`“** um: 40,1 % in (12 − 8) + (10 − 5) = 9 wirksamen Sekunden → 4,46 %/s statt 2,0 im Profilmaß. Mit dem Profilmaß hätte der Normalbetrieb (`tDead` 20) zu große Gaben gerechnet.

Fehlen die Zeilen in der Aufzeichnung (Rekorder vor `hwtest.js` 0.1.2, am Websocket verlorene Zeilen), zieht `kal report <json> <log>` sie aus einer Mitschrift nach, die die `bw_pump`-Zeilen enthält (`watch`-Log oder `console.js`). War der Websocket aus, gibt es keine solche Mitschrift: dann bleibt es beim Profilmaß mit `ACHTUNG`, `kal write` lässt `cfg3.tDead`/`tMin` unverändert und schriebe `effW` im Profilmaß – den Lauf mit eingeschaltetem Websocket wiederholen.

### kal write

`kal write [datei] [log]` verweigert, solange `zrb1` steht (`Zeitraffer aktiv (zrb1) – erst: … normal`) oder ein Betriebs-Script läuft, und schreibt sonst per Lesen-Ändern-Schreiben:

| Feld | Quelle | Regel |
| --- | --- | --- |
| `lrn.effW` | Mittel der Fensterlernwerte (nur reguläre Fenster: `ok`, `over`, `max`, `zeit`, `stall`, `unstab`) | ohne Vorwert übernommen; vorhandener Wert → Mischung α 0,5 |
| `cfg4.tDead2` | Median `tRise` der Folgeportionen | ersetzt den Wert |
| `cfg3.tDead` | Median `tRise` der Erstportionen aus den Konsolenzeilen | ersetzt den Wert; ohne Konsolenzeilen unverändert (der Bericht zeigt dann nur einen groben Vorschlag aus den Proben, Raster 5 s) |
| `cfg3.tMin` | `max(tPmin, tDead + 2)` | Portionen nie unter 10 s; sonst gösse die Klemme bei kurzem Schlauch weit über das Ziel (13.09.2026: 25 → 10) |

> **Am Gerät gemessen (13.09.2026, `kal write` 16:06):** `lrn.effW` null → 4.46, `cfg4.tDead2` 8 → 5, `cfg3.tDead` 20 → 8, `cfg3.tMin` 25 → 10. Die Totzeit gehört zum Schlauch, nicht zum Script: der Endaufbau mit längerem Schlauch (10–20 s Wasserlaufzeit) braucht ein neues `mess`, danach `tDead` und `tMin` prüfen. `[TODO am Gerät]`

## Erstes echtes Fenster mitlesen

Das erste Fenster im Normalbetrieb ist die Abnahme. Bedingungen: die Taktmessung um 07:45 bzw. 19:45 liegt unter `pctLo` (sonst `why=feucht` und keine Gabe), keine Pause läuft, `day.n` unter `maxDay`, Behälter voll. Mit `lrn.effW` aus `kal write` rechnet der Takt die Erstportion aus der Dosisformel – Beispiel mit den Gerätewerten: 30 % → (55 − 30) / 4,46 · 0,7 + 8 ≈ 12 s; ohne Lernwert pauschal `tStd` 70 s.

1. Konsole vor dem Start verbinden: `node tools/console.js <ip> 900` ab 07:59 bzw. 19:59 (liest 900 s, bis zum nächsten Takt; die erste Zeile fehlt sonst). Oder Web-UI → Scripts → `bw_pump` → Konsole.
2. Nicht `hwtest.js watch` nehmen: es endet im Normalbetrieb nach wenigen Sekunden, weil kein Test-Script und kein Zeitraffer läuft.
3. Erwartet: `Fenster: Auftrag … s, pct …, effW … sf 0.7, Frist 420 s`, `m0 … → P1 … s`, `P1 …`, ggf. `P2 …`, `ergebnis=… effW=…`.
4. Im ersten Takt mindestens 30 min (`soak`) nach dem Fensterende – im Normalbetrieb um 08:45 bzw. 20:45, also nach dem Ende von `console.js` – erscheint `Kontrolle: pctW → pctA %`; kein zweiter Lernwert.
5. Danach im KVS prüfen: `lrn.effW` zwischen `effMin` und `effMax`, `st.n`/`sec`/`pctB`/`pctW`/`effW`/`why` gefüllt, nach der Kontrolle auch `st.pctA`.

Von Hand gießen zum Testen und alle Konsolenzeilen: [13 · Betrieb und Wartung](13-betrieb-und-wartung.md). Das erste echte Fenster um 20:00 mit trockener Erde ist am Gerät noch offen: `[TODO am Gerät]`.

## Stand vom 13.09.2026 und offene Punkte

| Gelaufen | Ergebnis |
| --- | --- |
| Sensortest `bw_hwtest` | alle sechs Phasen ok, `cfg1.vDry`/`vWet` 0,296/3,134 V geschrieben, `lvlEmpty` 1 bestätigt |
| Zeitraffer-Lauf mit dem Fahrplan 0.1.3 (`bw_zeitraffer` 0.1.0, `bw_install` 0.1.2, `bw_main` 0.1.2, `bw_pump` 0.1.1 – noch ohne Regelkreis im Fenster) | alle Fahrplan-Fälle gezeigt: Gabe, Pause, Hitze-Doppelgabe, Behälter leer, `feucht`, Tageslimit, Rückbau; Schlauch lag an der Pflanze |
| Messlauf `mess` | sechs Pulse (Tabelle oben), Startwerte für `cfg3`/`cfg4` |
| Etappe 10: `normal` → `kal 780` → Fenster 1 → `normal` → `kal report` → `kal write` | Fenster 1 um 15:54:30: Portionen 12 + 10 s, 10,4 → 50,5 %, Laufzeit 100 s bei Frist 120 s, `mem_peak` 12 516 B; Kontrolle 53,7 %; `kal write` wie oben |

Offen (Details und Vorlage für den nächsten Lauf in [19 · Prüfprotokoll](19-pruefprotokoll.md)): Fenster 2–4 des Zeitraffer-Fahrplans 0.2.0 (Pause, Hitze, `wasser`, `limit`) mit `tMax` 40/`tSoak` 10; Zustände mittel feucht und nass des Kalibrierlaufs; erstes echtes Fenster um 20:00 mit trockener Erde; `cfg3.tDead`/`tMin` am Endaufbau mit längerem Schlauch per `mess`; obere und untere Referenz sowie `dropSlow` an der Pflanze. Rohdaten: [docs/kal/](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/tree/main/docs/kal).

## Beispielausgabe

> **Am Gerät gemessen (13.09.2026):** Start des Kalibrierlaufs (`kal 780`, Tunnel 127.0.0.1:8010) und Fenster 1 – Vorprüfung, sicherer Moment, `bw_zeitraffer`, `bw_install`, dann Takt, Fenster und Kontrolle. Gekürzt: Firmware-Zeilen, die wiederholten `warte`-Zeilen bis auf die erste, der Fahrplan-Ausdruck des Kalibrierlaufs (mit den Meldungen `kein bw_zeitraffer/bw_install läuft mehr` und `Rekorder läuft 780 s`), der zweite Takt 15:54 und alle Statuszeilen bis auf eine nach dem Fenster.

```text
ok       Uhrzeit 15:49 lokal, ram_free 133672, fs_free 40960
ok       cfg2 Zielband: pctLo 40 → Gabe, pctOk 50 Ziel erreicht, pctSoll 55, pctHi 60 zu viel, pctDry 28
ok       Wasserstand VOLL (lvl=false)
ok       Ausgang aus
ok       Sensoren: V=0.590 (10 %) tC=23.6
warte – Sekunde 52, warte auf 8–30
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
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] m0 10.4 % → P1 12 s
[bw_pump 0.2.0] P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)
[bw_pump 0.2.0] P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
[status 15:56] läuft: - | V=1.810 tC=23.6 lvl=false sw=aus | ZEITRAFFER st=gegossen/unstab n=2 sec=22 pctB=10.4 pctW=50.5 effW=2.006 tr=5 job=unstab/12 day.n=1 err=- mem(used/peak) main=- pump=- free=121972
[bw_main 0.2.0] Kontrolle: 50.5 → 53.7 % sf=0.7
[bw_main 0.2.0] V=1.82 pct=53.7 tC=23.6 lvl=0 st=sperre dry=1 pause=0.2h why=pause sec=- effW=2.006 sf=0.7 err=- w=2 dauer=5385ms
```

So liest man das: Die Vorprüfung ist grün, das Werkzeug wartet von Sekunde 52 bis Sekunde 9 der nächsten Minute. `bw_zeitraffer` sichert und schreibt das Profil, `bw_install` baut die drei Zeitplan-Einträge und `auto_off` 50 s; `pctDry` steht im Test auf 39 (`pctLo` − 1). Der Takt um 15:51 meldet 10,8 % unter `pctLo` ohne Lernwert → Auftrag `tStd` 12 s.

Fenster 1 um 15:54:30: `P1` hebt auf 34 %, die Korrekturportion (geklemmt auf `tPmin` 10 s) auf 50,5 % – Ziel `pctOk` 50 erreicht, beim Timeout noch steigend → `unstab`. Die Kontrolle beim nächsten Takt zeigt 53,7 %, danach `st=sperre why=pause`.

`kal report` mit den Konsolenzeilen aus dem `watch`-Log derselben Aufzeichnung (Zeilen aus `docs/kal/2026-09-13-13-50-kal-log.txt`, Rechenkern `tools/lib/kal.js`):

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

`kal write` danach (16:06, nach `normal`), die Vermerke der Ausgabe:

```text
  lrn.effW null → 4.46 (Messwert)
  cfg4.tDead2 8 → 5 s
  cfg3.tDead 20 → 8 s (tRise der Erstportion; Endaufbau mit anderem Schlauch: mess)
  cfg3.tMin 25 → 10 s (max(tPmin, tDead + 2))
```

Messlauf, der 10-s-Puls vom 13.09.2026 (Zeile in der Form, wie `mess` sie druckt, aus den Rohdaten `docs/kal/2026-09-13-13-14-mess.json`):

```text
Puls 1: 10 s → pct 37.5 → Spitze 49.1 (t=15.033 s) → Ruhe 49.1 (nach 36.226 s) | tRise 7.911 s | Gewinn 5.56 %/wirksame s (1.16 %/s brutto) | Ausgang aus bei 10.216 s
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `zeitraffer` meldet `BLOCKER cfg2 Zielband unvollständig` oder `nicht geordnet` | ein Bandfeld ist `null` (oft `pctOk` nach einem Update) oder die Ordnung `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` ist verletzt | Feld per `KVS.Set` oder „Format as JSON“ eintragen, dann `normal 60` |
| Takt meldet `why=cfg`, `err=cfg` | Band unvollständig, Ordnung verletzt oder Pflichtfeld fehlt (Konsole nennt das Feld) | wie oben; nach einem Teil-Schreiben den Installer erneut starten |
| Im Zeitraffer `err=noeff`, `ergebnis=noeff` | zwei volle Portionen ohne Wirkung: Schlauch liegt nicht am Sensor, Sensor sitzt nicht unter dem Tropfer | Schlauch und Sensorlage prüfen, `err` löschen: `curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"err"}'` |
| Fenster 2–4 gießen nicht, Takt `why=feucht` | Sensor nach dem gelernten Fenster nicht in trockene Erde umgesteckt: die Feuchte liegt noch über `pctOk` | Sensor vor dem Takt vor dem Fenster in den zweiten Topf stecken |
| `why=trocken` bleibt, obwohl der Sensor in Erde steckt | Trockenphase nach dem Wasserglas endet erst unter `pctDry` = `pctLo` − 1 (39 %) | trockenere Erde nehmen; die Frischmessung im Fenster hilft nicht, es zählt die Taktmessung |
| Statuszeile zeigt `out_of_memory` | zwei große Scripts zur selben Zeit auf dem geteilten Heap | sofort `normal 60`; Zeitplan prüfen (`bw_pump` bei Sekunde 30) |
| `kal write`: `Zeitraffer aktiv (zrb1) – erst: … normal` | der Rückbau fehlt noch | `normal 60`, dann `kal write` |
| `kal report` ohne Portionszeilen, `kal write` meldet `ACHTUNG: effW im Profilmaß` und lässt `tDead`/`tMin` stehen | Debug-Websocket war aus: der Rekorder sah keine Konsolenzeilen, also kein `tRise` | `kal write` nicht ausführen (es schriebe `effW` im Profilmaß); Websocket in der Web-UI-Konsole einschalten und den Kalibrierlauf wiederholen – Zeilen nachziehen (`kal report <json> <log>`) geht nur mit einer Mitschrift, die die `bw_pump`-Zeilen enthält |
| `kein sicherer Moment in 4 min` | dauernd läuft ein Script, oder die Uhr ist nicht gesetzt (NTP) | `preflight`; im Zeitraffer außerhalb der Minuten 0–2 des 6er-Zyklus erneut |
| `preflight` sagt „bw_main läuft“ | im Zeitraffer läuft `bw_main` alle 3 min ein paar Sekunden | erneut aufrufen; kein Fehler |
| Erstes echtes Fenster: `hwtest.js watch` endet sofort | im Normalbetrieb läuft kein Test-Script und kein Zeitraffer | `node tools/console.js <ip> 900` oder Web-UI-Konsole |
| `mess` meldet `keine Wirkung gemessen` | Puls kürzer als die Totzeit (3 s füllen nur den Schlauch), Schlauch leer oder Sensor nicht unter dem Tropfer | Puls 10 s, Beobachtung 240 s: `mess 10 1 240` |
| Nach dem Zeitraffer fehlt `lrn.effW` | gewollt: das Original aus `zrb2` kommt zurück, Testlernwerte zählen nicht | Lernwerte für den Betrieb über `kal` → `kal write` |

## Weiter zu

- [13 · Betrieb und Wartung](13-betrieb-und-wartung.md) – Konsole ablesen, alle `why`- und `err`-Codes, von Hand gießen, Störungen beheben
- [03 · Konfiguration](03-konfiguration.md) – jedes Feld aus `cfg1`…`cfg4`: Startwert, Wirkung, wann der Installer neu laufen muss
- [19 · Prüfprotokoll](19-pruefprotokoll.md) – die Messwerte vom 13.09.2026 und die Vorlage für den nächsten Gerätelauf
- [14 · Debuggen und Testen](14-debuggen-und-testen.md) – vollständige Referenz von `hwtest.js`, `console.js` und dem Mock
