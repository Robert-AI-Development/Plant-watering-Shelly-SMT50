# Selbstlernende Pflanzenbewässerung mit Shelly Plus Uni & SMT50 — DIY Smart Home ohne Cloud

> **Gieß smart – Programmierung out of the box mit KI (Claude Code), läuft lokal auf deinem Shelly.**
> Automatische Pflanzenbewässerung mit Bodenfeuchte (SMT50) und Temperatur (DS18B20), selbstlernend, **ideal für
> den Urlaub** – und komplett **mit KI programmiert und live debuggt**.

*🇬🇧 English: A self-learning **Shelly plant-watering** system (soil moisture SMT50, DS18B20 temperature) that runs
**locally, no cloud** – built and live-debugged with **AI (Claude Code)**. Great for **watering plants while on
vacation**. See the bilingual [handbook](docs/handbuch/README.md).*

Version 0.2.0 – Stand 13.09.2026. Stellen mit `[TODO am Gerät]` sind noch am echten Aufbau zu prüfen oder zu messen; Kalibrierpunkte, Wasserstand und die Wirkung eines Pumpenpulses wurden am 13.09.2026 mit Hardware-Test und Messlauf gemessen. Neu in 0.2.0: **Regelkreis im Gießfenster** – `bw_pump` misst frisch, gießt in Portionen, misst nach und lernt (`cfg4`), Wochen-Trockenphase, [Zeitraffer](#praxistest-im-zeitraffer-45-minuten) mit Takt 3 min, [Messlauf](#messlauf-wirkung-eines-pumpenpulses) und [Kalibrierlauf](#kalibrierlauf-referenzwerte-trocken-mittel-feucht-nass). 0.1.3: Praxistest im Zeitraffer, Takt und Gießfenster aus `cfg3`, kurze Geräte-Doku in jedem Script.

> 📖 **Neu hier?** Das zweisprachige **[Handbuch](docs/handbuch/README.md)** führt Schritt für Schritt durch
> Hardware, Installation, Weiterentwickeln auf einem eigenen Server und das **Live-Debuggen des Shelly per KI**.
> Für KI-Agenten: **[AGENTS.md](AGENTS.md)**.

> ⏱ **Quick Note – so entscheidet das System, und was du im Betrieb einstellst**
>
> **Kurzanleitung:** [`docs/kurzanleitung.md`](docs/kurzanleitung.md) – Einrichtung in zehn Schritten, Testlauf im Zeitraffer, Kalibrierung, was die Parameter machen. Erster Einstieg für den Aufbau am Gerät.
>
> **Auslöser:** Alle 15 Minuten misst der Shelly die Bodenfeuchte. Fällt sie unter die Untergrenze `pctLo` (z. B. 40 %), schreibt er sich einen Gießauftrag. **Gegossen wird trotzdem nur zu den zwei Gießzeiten** `winA`/`winB` (08:00 und 20:00). Dort misst `bw_pump` erst frisch und gießt dann **in Portionen mit Nachmessen**: Portion, `tSoak` (20 s) einsickern, messen bis der Wert stabil steht, unter dem Ziel `pctOk` (50 %) die nächste Portion aus der eben gemessenen Wirkung – bis zu `nPort` (6) Portionen, zusammen höchstens `tMax` (180 s). Die allererste Portion dauert pauschal `tStd` (70 s); danach weiß das Gerät aus jedem Fenster, wie viel Prozent Feuchte eine Pumpensekunde bringt (`lrn.effW`), und dosiert die Erstportion bewusst etwas unter dem Ziel.
> **Bremsen:** Nach einer Gabe ist mindestens `pause` (24 h) Ruhe – lag das Tagesmaximum über `tHot` (35 °C), nur `pauseHot` (12 h, also beide Fenster); trocknet die Erde kaum ab, `pauseSlow` (48 h, Staunässe-Verdacht). Höchstens `maxDay` (2) Gießfenster am Tag. **Trockenphase:** ab jedem `dryDay` (5 = Freitag) wird nicht gegossen, bis die Feuchte einmal unter `pctDry` (28 %) lag; zeigt eine Messung mehr als `pctHi` (60 %, nass), beginnt die Trockenphase sofort. Leerer Behälter, unplausibler Sensor oder zwei Portionen ohne Wirkung → keine Gabe und ein Code in `err` ([Störungen](#störungen-und-was-sie-bedeuten)).
> **Stellschrauben im laufenden Betrieb** (Web-UI → Settings → Key-Value Storage → Eintrag öffnen, „Format as JSON", Feld ändern; wirkt ab dem nächsten Takt):
> `cfg2.pctLo` – *wann*: höher = früher gießen · `cfg2.pctOk` – *bis wohin*: das Fenster endet, sobald die Feuchte diesen Wert erreicht · `cfg2.pctSoll` – *wie viel*: Zielpunkt der Dosisrechnung · `cfg2.pctHi` – Bremse: darüber ist es „zu viel" (nächste Erstportion kleiner) bzw. nass (Trockenphase) · `cfg2.pctDry` – Ende der Trockenphase · `cfg3.winA`/`winB` – *zu welcher Uhrzeit* · `cfg3.tMax` – Notbremse: Summe aller Portionen eines Fensters · `cfg3.maxDay` – Fenster je Tag · `cfg3.dryDay` – Trockentag (null = nie) · `cfg3.tHot`/`pauseHot`/`pause` – Hitzeregel und Ruhezeit · `cfg4` – Feinheiten des Fensters (Portionen, Einsickern, Stabilität).
> Nach `winA`, `winB`, `tMax`, `tick`, `winEvery`, `tWin` oder `tTail` einmal `bw_install` starten (Zeitplan und Abschaltzeit). Alle Felder: [Konfiguration](#konfiguration-alle-kvs-felder). Das Ganze in 45 Minuten live sehen: [Praxistest im Zeitraffer](#praxistest-im-zeitraffer-45-minuten). Dieselbe Kurzfassung steht als Kommentar im Kopf jedes Scripts am Gerät.

## Zweck

Ein Shelly Plus Uni misst alle 15 Minuten Bodenfeuchte, Umgebungstemperatur und Wasserstand und entscheidet selbst, ob um 08:00 und 20:00 gegossen wird. Im Gießfenster gießt es in Portionen und misst nach jeder nach, bis das Zielband erreicht ist. Das Gerät lernt, wie viel Feuchte eine Pumpensekunde bringt, passt sich über die Temperatur an Sommer und Winter an und baut Staunässe über eine wöchentliche Trockenphase ab. Alles läuft am Gerät ohne Backend und ohne Cloud; nur die Uhrzeit kommt aus dem Internet.

**Ideal für den Urlaub:** einmal kalibriert, versorgt das System deine Zimmer- und Balkonpflanzen zuverlässig,
während du weg bist – mit harten Sicherheitsgrenzen gegen Überwässerung. **Besonderheit:** Dieses DIY-Projekt lässt
sich mit **künstlicher Intelligenz (Claude Code, Fable 5.1) direkt am echten Gerät live debuggen** – die KI liest
und schreibt den Shelly über einen Remote-Tunnel, lädt Scripts hoch und liest die Konsole mit. Wie das geht, steht
im [Handbuch, Kapitel 6](docs/handbuch/06-shelly-remote-debug.md).

## Inhalt

Erster Einstieg: [Kurzanleitung](docs/kurzanleitung.md) (Einrichtung in zehn Schritten, Zeitraffer, Kalibrierung, Parameter).

1. [Stückliste](#stückliste)
2. [Verdrahtung](#verdrahtung)
3. [Kalibrierung](#kalibrierung)
4. [Installation](#installation)
5. [Hardware-Test](#hardware-test-sensoren-und-pumpe-prüfen)
6. [Praxistest im Zeitraffer](#praxistest-im-zeitraffer-45-minuten)
7. [Konfiguration](#konfiguration-alle-kvs-felder)
8. [Betrieb und Ablesen](#betrieb-und-ablesen)
9. [Störungen](#störungen-und-was-sie-bedeuten)
10. [Sicherheit](#sicherheit-pumpe-wasser-strom)
11. [Funktionsweise](#funktionsweise-für-interessierte)
12. [Grenzen des Shelly](#grenzen-des-shelly)
13. [Entwicklung und Tests ohne Gerät](#entwicklung-und-tests-ohne-gerät)
14. [Lizenz](#lizenz)

## Stückliste

| Teil | Zweck | Bezugsquelle (Beispiel) |
| --- | --- | --- |
| Shelly Plus Uni | Steuergerät | shelly.com, Elektronikhandel |
| Trübner SMT50 | Bodenfeuchte 0–3 V | truebner.de |
| DS18B20, wasserdicht | Umgebungstemperatur | Elektronikhandel |
| Schwimmerschalter | Wasserstand | Elektronikhandel, Aquaristik |
| Relais 12 V, Spule < 300 mA | schaltet die Pumpe | Elektronikhandel |
| Gardena Urlaubsbewässerung 970548801 | Pumpe, Trafo, Verteiler | Gardena, Baumarkt |
| Netzteil 12 V DC, ≥ 1 A | versorgt Shelly, Sensor, Relais | Elektronikhandel |
| Behälter, Schlauch, Tropfer, Gehäuse, Klemmen | Aufbau | Baumarkt |

Details und Hinweise: [`hardware/stueckliste.md`](hardware/stueckliste.md).

## Verdrahtung

Aderfarben des Shelly laut Shelly-Wissensdatenbank. Vollständiger Plan mit Schritt-für-Schritt-Anleitung: [`hardware/verdrahtung.md`](hardware/verdrahtung.md).

```
 12 V Netzteil ─ + ──► VAC1 (rot)          SMT50 gelb ──────────► ANALOG IN (weiß)   = voltmeter:100
               ─ − ──► VAC2 (schwarz)      SMT50 Masse ─────────► GND (grün)         [TODO Datenblatt]
                       GND (grün) ◄── Netzteil −                SMT50 Versorgung + ► +12 V

 DS18B20 rot ─────────► SENSOR VCC (gelb)  Schwimmer ───────────► IN2 (braun) … GND  = input:1
 DS18B20 Daten ───────► DATA (blau)        Relaisspule (+12 V) ─► OUT1 … OUT1        = switch:0
 DS18B20 schwarz ─────► GND (grün)         Relaiskontakt ───────► Pumpe
```

Schritte in Kurzform:

1. Alles stromlos. Versorgung: +12 V an VAC1, − an VAC2, Netzteil − zusätzlich an GND (Sensormasse).
2. SMT50: gelb an ANALOG IN, Masse an GND, Versorgung an +12 V; grüne Ader (Bodentemperatur) bleibt frei. `[TODO laut Datenblatt prüfen]` welche Adern Versorgung und Masse sind.
3. DS18B20: rot an SENSOR VCC, Daten an DATA, schwarz an GND.
4. Schwimmerschalter zwischen IN2 und GND; Eingang in der Web-UI auf Typ „Switch" stellen. Schwimmer oberhalb des Pumpeneinlaufs montieren.
5. Relaisspule über den potenzialfreien Kontakt OUT1 (max. 30 V / 300 mA). Der Relaiskontakt schaltet die Pumpe. Arbeiten an 230 V nur durch eine Elektrofachkraft.
6. Einschalten, in der Web-UI prüfen: Spannung am Voltmeter, Temperatur, Eingang wechselt beim Bewegen des Schwimmers.

Foto des Aufbaus: `[TODO am Gerät]`.

## Kalibrierung

Die Feuchteskala ist eine eigene Kalibrierung, keine Herstellerformel: **0 % = Sensor trocken in Luft, 100 % = Sensor im Wasser.** 100 % ist ein Kalibrierpunkt, nie ein Zielwert.

1. **Trockenpunkt:** Sensor sauber und trocken in der Luft, in der Web-UI die Voltmeter-Spannung ablesen (oder erste Konsolenzeile von `bw_main`, Feld `V=`). Gemessen: 0,20 V (12.09., Web-UI) bzw. 0,296 V (13.09., `bw_hwtest`, Sensor abgewischt) → `cfg1.vDry`. Bequemer: der [Hardware-Test](#hardware-test-sensoren-und-pumpe-prüfen) misst Trocken- und Nasspunkt und schreibt sie nach `cfg1`.
2. **Nasspunkt:** Sensor bis zur Markierung in ein Glas Wasser, Spannung ablesen. Gemessen: 3,13 V (12.09.) bzw. 3,134 V (13.09., `bw_hwtest`) → `cfg1.vWet`.
3. **Obere Referenz an der Pflanze:** Sensor in den Topf stecken, einmal kräftig gießen, 30 Minuten warten, Prozentwert ablesen (`pct=` in der Konsole). Das ist „gut versorgt". `[TODO am Gerät]`
4. **Untere Referenz:** Warten, bis die Pflanze sichtbar Wasser braucht und die Erde auch in der Tiefe trocken ist, Prozentwert ablesen. Das ist „jetzt gießen". `[TODO am Gerät]`
5. **Zielband eintragen** (cfg2), Vorschlag aus `docs/konzept-v2.md` Abschnitt 4.2; Ordnung `pctDry < pctLo < pctOk ≤ pctSoll < pctHi`, sonst `why=cfg`:
   - `pctLo` = untere Referenz (löst den Auftrag aus)
   - `pctOk` = „Ziel erreicht": das Gießfenster endet, sobald die stabilisierte Feuchte diesen Wert erreicht
   - `pctSoll` = Zielpunkt der Dosisrechnung, wenige Prozent über `pctOk` (Mitte zwischen unterer und oberer Referenz)
   - `pctHi` = obere Referenz plus wenige Prozent („zu viel"; in der Taktmessung darüber gilt der Topf als nass → Trockenphase)
   - `pctDry` = deutlich unter `pctLo` (die Trockenphase endet, sobald dieser Wert unterschritten wurde)
   - Beispielband am Gerät seit 13.09.2026: `pctSoll` 55, `pctLo` 40, `pctOk` 50, `pctHi` 60, `pctDry` 28, `dropSlow` 4. Die Skala bezieht sich auf den Sensor unter dem Tropfer (nassester Punkt) und die `cfg1`-Kalibrierung, nicht auf einen volumetrischen Wassergehalt.
6. **dropSlow:** an einem normalen Tag ohne Gabe die Abnahme der Feuchte über 24 h ablesen (`pct=` morgens und am nächsten Morgen). Etwa die Hälfte davon als Schwelle eintragen; bleibt die Abnahme darunter, gilt die lange Pause (Staunässe-Verdacht). `[TODO am Gerät]`
7. **Wirkung eines Pulses:** `node tools/hwtest.js <ip> mess 10 1` zeigt, wie schnell und wie stark der Sensor auf einen 10-s-Puls reagiert ([Messlauf](#messlauf-wirkung-eines-pumpenpulses)); der [Kalibrierlauf](#kalibrierlauf-referenzwerte-trocken-mittel-feucht-nass) liefert danach `lrn.effW`, `cfg4.tDead2`, `cfg3.tDead` und `cfg3.tMin`.

Solange `pctSoll`, `pctLo`, `pctOk`, `pctHi`, `pctDry` oder `dropSlow` `null` sind, misst und protokolliert das System, gießt aber nicht (`err.code = "cfg"`, `job.why = "cfg"`).

## Installation

Voraussetzungen: Shelly Plus Uni im WLAN, Uhrzeit per NTP gesetzt, Zeitzone in den Geräteeinstellungen richtig (die Fenster 08:00/20:00 sind Ortszeit).

1. **Peripherie anlegen** (Web-UI des Shelly → Peripherals/Add-ons): Analogeingang als **Voltmeter** mit Bereich 0–15 V (kleinerer Bereich = feinere Auflösung), DS18B20 über den **1-Wire-Scan** hinzufügen. Die IDs erscheinen als `voltmeter:100` und `temperature:100`; weichen sie ab, später in `cfg1.idV`/`cfg1.idT` eintragen.
2. **Eingang 1** (IN2) in der Web-UI auf Typ „Switch" stellen.
3. **Scripts anlegen** (Web-UI → Scripts → Add script), Namen exakt `bw_install`, `bw_main`, `bw_pump` (optional dazu `bw_hwtest`, `bw_hwpump` für den [Hardware-Test](#hardware-test-sensoren-und-pumpe-prüfen) und `bw_zeitraffer` für den [Praxistest](#praxistest-im-zeitraffer-45-minuten); `node tools/hwtest.js <ip> preflight` legt `bw_zeitraffer` an, `preflight hw` zusätzlich `bw_hwtest`/`bw_hwpump` – sie kosten Flash und wurden am 13.09.2026 gelöscht). Vorher `npm run build` ausführen: **`dist/`** enthält denselben Code ohne Einrückung und ohne lange Kommentare – nur die Versionszeile und ein **kurzer Doku-Block je Script** (was das Script tut, was welche Einstellung bewirkt) bleiben stehen, damit jedes Script im Script-Editor des Shelly lesbar ist. Kompakt muss es sein, weil der Script-Speicher (~25 KB Heap, von allen Scripts geteilt) die Codegröße mitträgt. **Der Editor der Web-UI hat beim Einfügen Text verloren** (Firmware 2.0.0, 12.09.2026: 166 bzw. 210 Byte am Dateiende fehlten, Script startete mit `SyntaxError: Got EOF`). Deshalb per RPC hochladen: `node tools/put-script.js <ip> <id> dist/bw_main.js` schickt die Datei in Stücken und lädt den Code danach komplett zurück – er muss **byteidentisch** sein. Alle Scripts auf einmal prüfen: `node tools/verify-scripts.js <ip>` (nach jedem Upload und wenn ein Script „unerklärlich" abbricht). Kein Script auf „Run on startup" stellen. Der Flash für Scripts ist knapp (`Sys.GetStatus.fs_free`, `put-script.js` prüft ihn vor dem Upload): vor dem Upload der 0.2.0-Scripts `engine_probe`, `bw_hwtest`, `bw_hwpump` per `Script.Delete` entfernen; Test-Scripts bei Bedarf wieder hochladen.
4. **Installer starten:** `bw_install` einmal mit „Start" ausführen und die Konsole lesen (oder `node tools/hwtest.js <ip> normal 30`, das wartet einen ruhigen Moment ab und prüft danach das Ergebnis). Er legt neun KVS-Einträge an (nur wenn sie fehlen) und ergänzt in vorhandenen Einträgen fehlende Felder mit dem Startwert (nach einem Script-Update z. B. `cfg4`, `cfg2.pctOk`, `cfg3.dryDay`, `lrn.effW`), prüft, dass ein Gießfenster samt Budget `cfg4.tWin` und Reserve `tTail` vor dem nächsten Takt endet, baut drei Zeitplan-Einträge aus `cfg3`/`cfg4` (`tick`, `winA`/`winB`, Sicherheits-Aus) und setzt die Switch-Konfiguration (Ausgang nach Neustart aus, automatische Abschaltung nach `tMax` + 10 s = 190 s). Danach beendet er sich selbst. Er darf beliebig oft wiederholt werden; solange `bw_main` oder `bw_pump` läuft, bricht er ab. **Nach jedem Script-Update einmal starten**, sonst meldet `bw_main` bzw. `bw_pump` `err.code = "cfg"` („cfg3.tick fehlt", „cfg4.tWin fehlt"). Update von 0.1.x: [Betrieb und Ablesen](#betrieb-und-ablesen).
5. **Prüfen:** Web-UI → Schedules zeigt `0 */15 * * * *` (bw_main, aus `cfg3.tick`), `30 0 8,20 * * *` (bw_pump, 30 s nach der vollen Minute, damit es nie gleichzeitig mit `bw_main` läuft – geteilter Script-Heap) und `0 8 8,20 * * *` (Switch.Set aus: 30 s + `tWin` 420 s + 10 s, auf volle Minuten aufgerundet). KVS ansehen: `http://<ip>/rpc/KVS.GetMany?match=*` im Browser oder `tools/kvs_dump.sh <ip>`.
6. **Zielband eintragen** (siehe Kalibrierung): Eintrag `cfg2` im KVS bearbeiten – alle sechs Bandfelder, auch `pctOk` (Web-UI → Settings → Key-Value Storage, „Format as JSON“ anhaken, oder per RPC `KVS.Set`). Alle Werte sind JSON-Strings – die Web-UI kann nur Strings anzeigen und bearbeiten; ein Wert, der kein JSON-Objekt ist, wird vom Installer durch die Startwerte ersetzt (Konsole meldet es).
7. Ab jetzt läuft `bw_main` alle 15 Minuten. Die erste Konsolenzeile zeigt, ob alle drei Sensoren gelesen werden.

## Hardware-Test: Sensoren und Pumpe prüfen

Zwei zusätzliche Scripts prüfen den Aufbau Schritt für Schritt – mit dir am Gerät und einem Helfer (Mensch oder KI), der die Konsole liest und Kommandos schickt. Sie laufen **nur von Hand**, nie im Zeitplan, und dürfen nach dem Test am Gerät bleiben (`enable:false`) – seit 0.2.0 ist der Flash für Scripts allerdings knapp: vor einem Upload der Betriebs-Scripts die Test-Scripts per `Script.Delete` entfernen und bei Bedarf wieder hochladen (`preflight` legt sie neu an). Am 13.09.2026 wurde der komplette Ablauf am echten Aufbau durchgeführt; die Werte stehen in [`docs/pruefprotokoll-etappe6.md`](docs/pruefprotokoll-etappe6.md).

**Voraussetzungen:** Installer gelaufen, Eingang 1 auf Typ „Switch", Node ≥ 22 auf dem Rechner mit Zugriff auf den Shelly (direkt oder per [Tunnel](docs/handbuch/06-shelly-remote-debug.md)). Am Aufbau: Eiswasser oder kaltes Leitungswasser (≤ 20 °C), warmes Wasser ~40 °C oder Handwärme (≥ 30 °C, nicht über 32 °C), ein Glas Wasser für den SMT50, ein Tuch, ein Eimer für den Schlauch, und der Schwimmer muss sich per Hand in beide Stellungen bringen lassen. Nur die Metallhülse des DS18B20 bzw. den Sensorkörper eintauchen, Stecker und Kabel trocken halten. Nicht in den 25 Minuten um 08:00, 20:00 oder Mitternacht starten (der Pumpentest wartet sonst).

```
npm run build
node tools/hwtest.js <ip> preflight hw              # Uhrzeit, Scripts, Eingang 1, Ausgang, KVS; legt bw_hwtest/bw_hwpump an und nennt die Upload-Befehle mit ID
node tools/put-script.js <ip> <id> dist/bw_hwtest.js   # Upload mit Größenprüfung (ID aus der preflight-Ausgabe oder `hwtest.js <ip> scripts`)
node tools/put-script.js <ip> <id> dist/bw_hwpump.js
node tools/hwtest.js <ip> input-on                  # nur wenn preflight „Input 1 deaktiviert" meldet
node tools/hwtest.js <ip> start bw_hwtest 20        # Sensortest starten, 20 s Konsole
node tools/hwtest.js <ip> watch 120                 # Konsole + Statuszeile; beliebig oft wiederholen
node tools/hwtest.js <ip> go                        # Kommando an das Script (auch skip, abort)
node tools/hwtest.js <ip> start bw_hwpump 20        # Pumpentest Durchgang A; danach go
node tools/hwtest.js <ip> watch 240                 # wartet auf bw_pump und startet Durchgang B von selbst
node tools/hwtest.js <ip> report                    # Berichte aus hwr/hwp mit cfg1-Vergleich
node tools/hwtest.js <ip> cleanup                   # hwc/hwb1/hwb2 löschen (hwt, hwr, hwp bleiben)
```

**Sensortest `bw_hwtest`** (sechs Phasen, jede wartet auf den physischen Zustand, Timeout `hwt.tPhase` = 15 min):

| Phase | Anweisung | Ende, wenn |
| --- | --- | --- |
| t1 | Fühlerhülse in kaltes Wasser | 5 Lesungen in Folge ≤ `tLo` (20 °C) |
| t2 | Fühler in warmes Wasser / in die Hand | 5 Lesungen ≥ `tHi` (30 °C) |
| m1 | SMT50 aus dem Topf, abwischen, trocken in der Luft halten, dann `go` | nach `go` 5 stabile Lesungen (Spannweite ≤ `dV`) mit Mittel ≤ `vDryMax` (0,5 V) und ≥ `vErrLo` + 0,05 → Trockenpunkt |
| m2 | Sensor senkrecht bis zur Markierung ins Wasserglas | 5 stabile Lesungen ≥ `vWetMin` (2,5 V) und ≤ `vErrHi` − 0,1 → Nasspunkt |
| l1 | Schwimmer einmal bewegen, dann in Stellung LEER halten, `go` | nach `go` `nLvl` gleiche Lesungen (und mindestens ein beobachteter Wechsel) → `lvlEmpty` |
| l2 | Schwimmer auf VOLL halten, `go` | `nLvl` gleiche Lesungen, anders als l1 |

Am Ende schreibt das Script die Kalibrierwerte nach `cfg1` (`vDry`, `vWet`, `lvlEmpty`; nur wenn plausibel: Nasspunkt mindestens 1 V über dem Trockenpunkt, LEER ≠ VOLL; abschaltbar mit `hwt.cal = 0`) und einen fünfzeiligen Bericht in die Konsole; der Stand liegt jederzeit in `hwr`. Ergebniscodes je Phase: `ok`, `sk` (übersprungen), `to` (Timeout), `ab` (Abbruch), `nl` (Sensor liefert `null` – Fühler, Kabel oder Komponente prüfen). Mit `hwt.run` lassen sich Phasengruppen auswählen (`"m"` = nur Feuchte). Danach: Sensoren zurück in den Topf, Schwimmer auf VOLL, Behälter füllen.

**Pumpentest `bw_hwpump`** läuft in zwei Durchgängen, weil der Script-Speicher des Shelly (~25 KB) von allen Scripts geteilt wird und `bw_pump` allein laufen muss:

- **Durchgang A** wartet auf `go` (Behälter voll, Schlauch im Eimer, du bleibst dabei), prüft Ausgang aus, Wasserstand stabil und nicht LEER, keine Störung `noeff`, und wartet die Zeitwache ab (nicht in den ersten/letzten 90 s eines 15-min-Takts, nicht ± 25 min um die Gießfenster und Mitternacht). Dann sichert es `st`, `day`, `job`, `err`, `lrn` nach `hwb1`/`hwb2`, setzt `err` auf keine Störung, `day` bei erreichtem Tageslimit zurück, schreibt den Auftrag `job = {ok:true, sec:hwt.pumpSec (30), pct:null, why:"hwtest"}` (`pct:null` → Einzelportion ohne Messung und ohne Lernwert), startet `bw_pump` per `Script.Start` und beendet sich.
- **`bw_pump`** pumpt genau `pumpSec` Sekunden als Einzelportion (mit `toggle_after`, `auto_off`, Wasserstandsprüfung) und schreibt sein Ergebnis.
- **Durchgang B** (startet `watch` automatisch, sobald `bw_pump` fertig ist) vergleicht `st`/`job` mit dem Auftrag (`p3 = ok`, wenn `st.state = gegossen`, `st.sec = pumpSec`, `job.ok = false`, `job.why = ok`), schaltet den Ausgang notfalls aus, schreibt die gesicherten Zustände zurück (kein Testauftrag überlebt), löscht `hwb1`/`hwb2` und berichtet. Der Echtbetrieb bemerkt vom Test nichts: keine Pause, kein Tageszähler, kein Lernwert.

Steht `hwb1`/`hwb2` nach einem Abbruch noch im KVS, ist der nächste Start von `bw_hwpump` automatisch ein Durchgang B (`rec:1` im Bericht); `node tools/hwtest.js <ip> restore` tut dasselbe vom Rechner aus. Not-Aus: `node tools/hwtest.js <ip> stop` (stoppt die Test-Scripts und `bw_pump`, schaltet den Ausgang aus) oder OUT1 in der Web-UI.

**KVS-Einträge des Hardware-Tests** (JSON-Strings wie alle anderen):

| Eintrag | Felder | Bedeutung |
| --- | --- | --- |
| `hwt` | `tLo` 20 · `tHi` 30 °C · `vDryMax` 0.5 · `vWetMin` 2.5 V · `dV` 0.03 V Spannweite für „stabil" · `nStab` 5 gleiche Ticks · `nNull` 10 Ticks ohne Wert → `nl` · `msTick` 1000 · `nCmd` 2 Ticks je Kommando-Abfrage · `nLog` 5 Ticks je Konsolenzeile · `tPhase` 900 s · `tAll` 3600 s · `pumpSec` 30 s (höchstens `cfg3.tMax`) · `guardS` 90 s Abstand zum Takt · `winMin` 25 min Abstand zu den Fenstern · `cal` 1 Kalibrierwerte schreiben · `run` "tml" Phasengruppen | Schwellen und Zeiten; das Script legt die Startwerte an, wenn der Eintrag fehlt; ändern mit `node tools/hwtest.js <ip> cfg tLo=21 pumpSec=10` |
| `hwc` | `n` Zähler · `cmd` go / skip / abort | Kommando an das laufende Script; nur ein `n` größer als das zuletzt gesehene wirkt |
| `hwr` | `s` lauf / ende / abbruch · `t` [min, max] °C · `m` [vDry, vWet] · `l` [leer, voll] · `chg` Eingangswechsel · `r` Codes t1…l2 · `cal` alt>neu · `n` Vermerke · `mem` kleinster `ram_free` · `dur`, `w` | Stand und Bericht des Sensortests |
| `hwp` | `s` lauf / pumpt / ende / abbruch · `pumpSec` · `sec` von `bw_pump` eingetragen · `st`, `why` · `r` Codes p0…p3 · `rec` 1 = Wiederanlauf · `mem`, `dur`, `w` | Stand und Bericht des Pumpentests (`aw` = Ergebnis von `bw_pump` weicht ab, `fe` = Freigabe blockiert) |
| `hwb1`, `hwb2` | Kopien von `st`, `day` bzw. `job`, `err`, `lrn` | Sicherung zwischen Durchgang A und B |

**Speicher:** Solange ein Test-Script wartet, belegt es rund 9–10 KB des gemeinsamen Script-Heaps; `bw_main` läuft daneben im Takt weiter. Zwei große Scripts gleichzeitig enden mit `out_of_memory` (sichtbar in `Script.GetStatus.errors`), deshalb der Pumpentest in zwei Durchgängen. Details in [`LEARNING.md`](LEARNING.md).

## Praxistest im Zeitraffer (45 Minuten)

Im Normalbetrieb dauert es Tage, bis man Fenster, Pause, Hitzeregel und Tageslimit einmal gesehen hat. Der Zeitraffer lässt **dieselben Betriebs-Scripts `bw_main` und `bw_pump` unverändert laufen, nur mit kurzen Zeiten**: Takt 3 min statt 15, Gießfenster alle 6 min statt 08:00/20:00, Fenster-Budget 120 s mit bis zu 3 Portionen und **echtem Lernen** (der Schlauch liegt am Sensor), Pause 12 min (Hitze: 6 min), Tageslimit 4, Trockenphase aus. Das Script `bw_zeitraffer` sichert die Betriebswerte (`cfg3`, `lrn`+`day`, `st`+`err`, `cfg4`, `cfg2` → `zrb1`–`zrb5`), schreibt die Profile, setzt den Zustand frisch und startet den Installer, der den Zeitplan baut. **Zurück in den Normalbetrieb bringt `bw_install`:** findet er die Sicherung ohne die Startmarke `zr`, schreibt er das Original zurück – Lernwerte, Pause und Tageszähler sind danach wie vor dem Test, die Testgaben zählen nicht. Am 13.09.2026 lief der Fahrplan der Version 0.1.3 (Takt 1 / Fenster 2, Schlauch im Eimer) am echten Aufbau ([`docs/pruefprotokoll-etappe6.md`](docs/pruefprotokoll-etappe6.md)); vom Fahrplan 0.2.0 lief am 13.09.2026 Fenster 1 im Kalibrierlauf (15:54:30, Portionen 12 + 10 s, 10,4 → 50,5 %), Fenster 2–4 (Pause, Hitze, `wasser`, `limit`) sind `[TODO am Gerät]`.

**Voraussetzungen:** Installer gelaufen, Zielband in `cfg2` vollständig (auch `pctOk`; sonst `why=cfg` und keine Gabe), Eingang 1 als Switch, Behälter voll, **Schlauch mit den Tropfern am Sensor** in trockener Erde (der Regelkreis braucht die Rückmeldung; wer nur die Mechanik sehen will, setzt `cfg4.nPort` 1 und legt den Schlauch in einen Eimer – Einzelportion ohne Messung), ein Glas Wasser für den SMT50, ein Becher warmes Wasser (≥ 30 °C) für den DS18B20 und ein zweiter Topf mit trockener Erde, in den der Sensor vor jedem weiteren Fenster wandert (nach einem gelernten Fenster liegt die Feuchte sonst über `pctOk`). Kein Hardware-Test-Script läuft, keine `hwb1`/`hwb2`-Reste (`cleanup`). Node ≥ 22 auf dem Rechner mit Zugriff auf den Shelly (direkt oder per [Tunnel](docs/handbuch/06-shelly-remote-debug.md)).

```
npm run build
node tools/hwtest.js <ip> preflight            # legt bw_zeitraffer an und nennt den Upload-Befehl (am Gerät vom 13.09.2026: id 7)
node tools/put-script.js <ip> <id> dist/bw_zeitraffer.js
node tools/hwtest.js <ip> normal 30            # nach einem Script-Update: Installer einmal laufen lassen (ergänzt cfg4, pctOk, dryDay, effW)
node tools/hwtest.js <ip> zeitraffer 60        # Vorprüfung, sicherer Moment, Start, Kontrolle von Zeitplan/cfg3/cfg4/auto_off, Fahrplan
node tools/hwtest.js <ip> watch 300            # Konsole + Statuszeile (st, n, pctW, why, err, Speicher von bw_main/bw_pump), beliebig oft
node tools/hwtest.js <ip> normal 60            # zurück: Original aus zrb1..5, Zeitplan 0 */15 / 30 0 8,20 / 0 8 8,20, auto_off 190 s
```

Das Werkzeug startet nur in einem **sicheren Moment** (Sekunde 8–30 einer Minute, im Zeitraffer nicht in den Minuten 0–2 eines 6er-Zyklus, kein Script läuft): `bw_main` liest und schreibt in den ersten Sekunden jedes Takts, `bw_pump` regelt ab Sekunde 30 der Fensterminute bis zu 120 s lang – ein Umbau dazwischen ginge verloren. Wer `bw_zeitraffer` oder `bw_install` von Hand in der Web-UI startet, hält sich an dieselbe Regel.

**Profil** (`ZR3`/`ZR4` in `scripts/bw_zeitraffer.js`, dort je Feld dokumentiert und änderbar; alles andere in `cfg3`/`cfg4`/`cfg2` bleibt, wie es ist):

| Feld | Normal | Zeitraffer | Wirkung im Test |
| --- | --- | --- | --- |
| `tick` | 15 min | 3 min | `bw_main` misst und entscheidet alle 3 Minuten |
| `winEvery` | null | 6 min | `bw_pump` läuft in jeder Minute ≡ 0 mod 6 (bei Sekunde 30) statt um `winA`/`winB` |
| `soak` | 30 min | 0.25 min | Kontrolle des Fensters beim nächsten Takt (150 s nach dem Fensterstart) |
| `pauseHot` | 12 h | 0.1 h (360 s) | Hitze: nächstes Fenster 6 min nach dem letzten |
| `pause` | 24 h | 0.2 h (720 s) | normal: nächstes Fenster 12 min nach dem letzten |
| `pauseSlow` | 48 h | 0.35 h | nie aktiv (braucht 24 h Messreihe) |
| `jobAge` | 20 min | 5 min | Auftrag darf beim Fenster höchstens 5 min alt sein |
| `maxDay` | 2 | 4 | vier Fenster im Test, dann `limit` |
| `tDead`, `tMin`, `tStd`, `tMax` | 20/25/70/180 s | 2/10/12/40 s | Erstportion 12 s ohne Lernwert, sonst 10–15 s; Summe je Fenster 40 s; `auto_off` 50 s |
| `tChk` | 5 s | 1 s | Wasserstand während der Portion jede Sekunde |
| `tHot` | 35 °C | 30 °C | Handwärme oder ein Becher warmes Wasser reicht (35 nur mit Föhn) |
| `dryDay` | 5 | null | kein Trockentag |
| `cfg4` | [Tabelle](#cfg4--fenster-regelkreis) | `tWin` 120, `nPort` 3, `tPmin` 10, `tPmax` 15, `tSoak` 10, `tStab` 30, `nStab` 3, `tDead2` 0, `dEffMin` 1 | Fenster ≤ 120 s, bis 3 Portionen von 10–15 s, Stabilität aus 3 Werten |
| `cfg2.pctDry` | 28 | `pctLo` − 1 | Trockenphase praktisch aus (der Sensor unter dem Schlauch bleibt nass) |

Warum die krummen Pausen: `bw_main` rechnet die Pause mit zwei Takten Vorlauf (`(now + 2·tick·60) − st.ts ≥ pause·3600`), weil der Auftrag einen Takt vor dem Fenster entsteht; die Gabe startet bei Sekunde 30 der Fensterminute T. Dann ist 0.1 h (360 s) beim Takt T+3 erfüllt (510 s) → Auftrag T+3, Fenster T+6:30; 0.2 h (720 s) bei T+9 (870 s) → Fenster T+12:30. Das Fenster-Budget 120 s endet mit Reserve `tTail` 20 s vor dem Takt T+3 (30 + 120 + 20 ≤ 180); der Sicherheits-Aus des Zeitplans feuert bei Minute T+2, Sekunde 40.

**Fahrplan** (Minuten ab dem Start S, einer vollen 6er-Minute; `why` steht in der Konsolenzeile von `bw_main` und in der Statuszeile von `watch`; die Erwartungen sind im Mock als Test hinterlegt, `tools/test/zeitraffer.test.js` mit Topfmodell):

| Minute | Handgriff | Erwartung |
| --- | --- | --- |
| vor 0 | SMT50 ins Wasserglas (oder in feuchte Erde zwischen `pctLo` und `pctHi`), Schwimmer VOLL, `zeitraffer 60` | `bw_install`: „ZEITRAFFER aktiv", Zeitplan `0 */3 * * * *`, `30 */6 * * * *`, `40 2,8,14,…,56 * * * *`, auto_off 50 s |
| 0, 3 | – | `bw_main`: feuchte Erde → `why=feucht`; Wasserglas (≈ 100 % > `pctHi`) → `why=trocken` mit Konsolenzeile `Trockenphase (nass 100 %)` – beides: kein Auftrag; 0:30 `bw_pump`: „kein Auftrag" |
| 3 (nach dem Takt) | SMT50 in trockene Erde, Schlauch am Sensor | Minute 6 `why=ok sec=12`; **6:30 Fenster 1**: `Fenster: Auftrag 12 s …`, `m0 … → P1 12 s`, `P1 12s: …`, ggf. `P2 …`, `ergebnis=ok n=… effW=…`; Minute 9 Kontrolle, `st=sperre why=pause` |
| 9–14 | SMT50 in den zweiten Topf mit trockener Erde (Schlauch mit) | Minute 15 `why=ok` mit `sec` aus `effW`; **18:30 Fenster 2** (12 min nach Fenster 1): Erstportion unter dem Ziel, Korrekturportion bis `pctOk` |
| 19 | DS18B20 in warmes Wasser, bis `tC` > 30; Sensor wieder in trockene Erde | Minute 21 `tC=31 pause=0.1h why=ok`; **24:30 Fenster 3** (6 min nach Fenster 2: Hitzeregel) |
| 25 | Schwimmer auf LEER | Minute 27 `why=wasser err=wasser`, 30:30 pumpt nicht |
| 31 | Schwimmer auf VOLL, Sensor in trockene Erde | Minute 33 `why=ok`; **36:30 Fenster 4**; Minute 39 `why=limit` (Tageslimit 4) |
| 40 | `normal 60` | „Zeitraffer beendet – Normalbetrieb wiederhergestellt", Zeitplan `0 */15`, `30 0 8,20`, `0 8 8,20`, auto_off 190 s, `zrb1..5`/`zr` gelöscht |

Optional: Schwimmer während einer Portion auf LEER → `ergebnis=abbruch err=wasser`; Sensor zum Fenster im Wasserglas lassen → `m0 … > pctHi – nass` ohne Gabe. Was man dabei wissen muss:

- **Gelernt wird echt:** `tDead` 2 < `tStd` 12 → wirksame Sekunden, `bw_pump` lernt `lrn.effW` schon im Fenster 1 und dosiert Fenster 2 daraus. Bleibt die Wirkung zweimal aus (Schlauch nicht am Sensor), blockiert `noeff` – dann `err` löschen und Schlauch prüfen. Eimer-Variante: `cfg4.nPort` 1 (Einzelportion, kein Lernwert).
- **Hitze bleibt:** Das Tagesmaximum steht in `lrn.tMaxD` bis Mitternacht; ab der Erwärmung gilt `pauseHot` für den Rest des Tests. Deshalb kommt die Hitze im Fahrplan erst nach der normalen Pause.
- **Sensor umstecken:** Nach einem gelernten Fenster liegt die Feuchte über `pctOk`; damit das nächste Fenster gießt, muss der Takt vor dem Fenster `pct < pctLo` sehen – also den Sensor rechtzeitig in trockene Erde stecken (die Frischmessung im Fenster prüft es noch einmal: `feucht` ohne Gabe).
- `preflight` meldet während des Zeitraffers zufällig „bw_main läuft" (alle 3 min): normal. Steht in der Statuszeile `out_of_memory`, sofort `normal`.
- Nach der Rückkehr ist `job` frisch (`bw_main` schreibt ihn im nächsten Takt neu); eine vor dem Test stehende Störung `noeff` kommt zurück, der im Test gelernte `lrn.effW` nicht (das Original steht in `zrb2`; Lernwerte für den Betrieb liefert der [Kalibrierlauf](#kalibrierlauf-referenzwerte-trocken-mittel-feucht-nass)).

**KVS-Einträge des Zeitraffers:** `zrb1` = Kopie von `cfg3`, `zrb2` = `lrn` und `day`, `zrb3` = `st` und `err`, `zrb4` = `cfg4`, `zrb5` = `cfg2` (Original; `bw_install` schreibt es zurück und löscht die fünf); `zr` = Startmarke `{go:1}`, die `bw_zeitraffer` als Letztes schreibt und `bw_install` beim Anlegen des Zeitraffer-Zeitplans löscht – bricht der Start vorher ab, baut der nächste Installer-Lauf zurück.

### Messlauf: Wirkung eines Pumpenpulses

Bevor Zeitwerte in `cfg3`/`cfg4` geändert werden, lohnt ein Blick auf den echten Aufbau: `node tools/hwtest.js <ip> mess [sek] [n] [beob]` schaltet die Pumpe `n`-mal (Standard 3, höchstens 6) für `sek` Sekunden (Standard 3, höchstens 10) mit `Switch.Set toggle_after` ein und liest den Sensor alle 2 s über `beob` Sekunden (Standard 90, 30–300) je Puls – reines Werkzeug, kein Gerätecode. Je Puls druckt es Feuchte vorher, `tRise` (erste Reaktion ≥ 1 %), Spitze, Ruhewert, Einschwingzeit und Gewinn in %/wirksame Sekunde, am Ende Vorschläge für `effMax`, `tPmin`, `tMin`, `tDead`, `tSoak`, `tStab`; Rohdaten liegen in `docs/kal/<datum>-mess.json`. Nur wenn Ausgang aus, Schwimmer VOLL, kein Script läuft und kein Fenster nahe ist.

Ergebnis vom 13.09.2026 (SMT50 mittig unter zwei Tropfern, trockene Erde; Zeilen im [Prüfprotokoll](docs/pruefprotokoll-etappe6.md)): **3-s-Pulse messen nur den Schlauch** – Totzeit 5–8 s, danach kriecht Nachlaufwasser minutenlang (+2 bis +12 %, Ruhe erst nach 65–160 s). **Ein 10-s-Puls** reagiert ab 7,9 s, erreicht die Spitze 5 s nach dem Ausschalten (+11,6 % = 5,6 %/wirksame s) und bleibt danach stabil. Daraus die Startwerte `tDead2` 8, `tPmin` 10, `tMin` 25, `tSoak` 20, `tStab` 60 und die Regel „Portionen nie kürzer als die Totzeit". Nebenbefunde: keine Spannungseinbrüche am Voltmeter bei laufender Pumpe, frische Werte bei 2-s-Abfrage.

### Kalibrierlauf: Referenzwerte trocken, mittel feucht, nass

`node tools/hwtest.js <ip> kal [sek]` ist ein Zeitraffer mit Rekorder (am 13.09.2026 am Gerät gelaufen: Fenster trocken, `report`, `write`): er startet wie `zeitraffer`, zeichnet alle 5 s Sensorwerte und Ausgang, jede Änderung von `st`/`job`/`lrn` und die Konsolenzeilen von `bw_pump` nach `docs/kal/<datum>-kal.json` auf und führt durch die Referenzzustände, auf das Zielband abgebildet: **trocken** (unter `pctDry`, Sensor in trockener Erde), **mittel feucht** (`pctDry`–`pctLo`, vorbefeuchtete Erde: hier entsteht im Alltag der Gießauftrag), **band** (`pctLo`–`pctHi`, keine Gabe) und **nass** (über `pctHi`: dort beginnt im Echtbetrieb die Trockenphase; nur beobachten, im Zeitraffer endet sie, sobald der Sensor wieder unter `pctLo − 1` liegt). Nach jedem Fenster bleibt der Sensor für die Kontrolle (Nachlauf unter dem Tropfer) stecken, erst dann kommt die nächste Erde. `kal report [datei] [log]` zeigt je Fenster Zustand (nach `m0`), Portionen, Σ Sekunden, `tRise`, Spitze, Ruhewert, `effW` und je Zustand den Gewinn je Sekunde; die Konsolenzeilen liefern die **echte Totzeit `tRise` je Portion**, daraus rechnet der Bericht den Lernwert auf die Skala „% je Sekunde nach `tRise`“ um (der `effW` in `st` gilt nur für die Totzeiten des laufenden Profils – im Zeitraffer 2 s / 0 s). Fehlen die Zeilen (Websocket), zieht `log` sie aus einer `watch`-Logdatei nach. `kal write [datei] [log]` **verweigert, solange `zrb1` steht** (erst `normal`), und schreibt per Lesen-Ändern-Schreiben `lrn.effW` (vorhandener Wert → Mischung α 0,5), `cfg4.tDead2` (Median `tRise` der Folgeportionen) und `cfg3.tDead` (`tRise` der Erstportion – gilt für diesen Schlauch, im Endaufbau mit `mess` nachmessen) sowie `cfg3.tMin` = `max(tPmin, tDead + 2)` (Portionen nie unter 10 s; 13.09.2026: 25 → 10); Vorher/Nachher stehen in der Ausgabe.

## Konfiguration (alle KVS-Felder)

Alle Werte liegen im KVS des Shelly; die Scripts enthalten keine Schwellen, Zeiten oder Grenzen. Fehlt ein Pflichtfeld, setzt das Script `err.code = "cfg"` und tut nichts. Der Installer schreibt die Startwerte nur, wenn der Eintrag fehlt, und ergänzt in vorhandenen Einträgen nur fehlende Felder; eigene Änderungen überleben eine Neuinstallation. Einzige Ausnahme: nach einem [Zeitraffer](#praxistest-im-zeitraffer-45-minuten) stellt er das gesicherte Original wieder her. Dieselbe Kurzerklärung je Feld steht als Doku-Block im Kopf von `bw_install` am Gerät.

### cfg1 – Sensor und Kalibrierung

| Feld | Startwert | Bedeutung |
| --- | --- | --- |
| `vDry` | 0.20 | Spannung Sensor trocken in Luft = 0 %; der Hardware-Test schreibt den gemessenen Wert (13.09.2026: 0.296) |
| `vWet` | 3.13 | Spannung Sensor im Wasser = 100 %; der Hardware-Test schreibt den gemessenen Wert (13.09.2026: 3.134) |
| `vErrLo` | 0.10 | darunter: Sensor- oder Kabelfehler (abgerissenes Kabel sieht wie „trocken" aus) |
| `vErrHi` | 3.35 | darüber: Sensor- oder Kabelfehler |
| `nSample` | 5 | Messungen je Takt; Mittelwert der mittleren Werte (Minimum und Maximum fallen weg) |
| `msSample` | 500 | Millisekunden zwischen zwei Messungen |
| `lvlEmpty` | 1 | Wert des Wasserstand-Eingangs, der „leer" bedeutet – bestätigt 13.09.2026 per `bw_hwtest` (Schwimmer LEER = 1, VOLL = 0) |
| `nLvl` | 3 | Abfragen des Wasserstands je Prüfung, müssen gleich sein (entprellt) |
| `idV` | 100 | ID der Voltmeter-Komponente (Analogeingang) |
| `idT` | 100 | ID der Temperature-Komponente (DS18B20) |
| `idLvl` | 1 | ID des Input für den Wasserstand (`input:1` = Klemme IN2) |
| `idSw` | 0 | ID des Switch für die Pumpe (`switch:0` = OUT1) |

### cfg2 – Zielband und Regelung

Ordnung des Bands: `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` und `pctLo + hyst < pctOk`; sonst meldet `bw_main` `err.code = "cfg"`. `pctSoll`, `pctOk`, `pctHi` und `lrn.effW` beziehen sich auf die **stabilisierte Ablesung im Gießfenster** (Sensor unter dem Tropfer), `pctLo` und `pctDry` auf die Taktmessung.

| Feld | Startwert | Bedeutung |
| --- | --- | --- |
| `pctSoll` | null | Zielpunkt der Dosisrechnung in % (Beispielband 55) `[TODO am Gerät]` |
| `pctLo` | null | Untergrenze: darunter entsteht ein Gießauftrag (Beispielband 40) `[TODO am Gerät]` |
| `pctOk` | null | „Ziel erreicht": das Fenster endet ohne weitere Portion, sobald die stabilisierte Feuchte diesen Wert erreicht (Beispielband 50); nach einem Update von Hand eintragen, sonst `why=cfg` `[TODO am Gerät]` |
| `pctHi` | null | „zu viel": darüber sinkt der Sicherheitsfaktor; in der Taktmessung darüber gilt der Topf als nass → Trockenphase (Beispielband 60) `[TODO am Gerät]` |
| `pctDry` | null | Ende der Trockenphase: gegossen wird wieder, sobald eine Taktmessung darunter liegt (Beispielband 28) `[TODO am Gerät]` |
| `hyst` | 2 | Hysterese in %: ein bestehender Auftrag bleibt bis `pctLo + hyst`; die Kontrolle meldet „zu viel" erst über `pctHi + hyst` |
| `dropSlow` | null | Feuchteabnahme je 24 h in %; darunter gilt `pauseSlow` (Beispielband 4) `[TODO am Gerät]` |
| `dropW` | null | % Einbruch zwischen letzter Fensterablesung und Kontrolle → Hinweis `sink`; null = aus, bis der Drain am Aufbau gemessen ist |
| `effMin` | 0.05 | Boden für die Wirkung je wirksamer Pumpensekunde (Korrekturportionen rechnen nie mit weniger) |
| `effMax` | 30 | Plausibilitätsgrenze des Lernwerts `effW` (Messlauf 13.09.2026: 5,6 %/s) |
| `alpha` | 0.3 | Gewicht des neuen Fensterwerts beim Lernen (0,7 alt, 0,3 neu) |
| `sfMin` | 0.5 | Untergrenze des Sicherheitsfaktors `lrn.sf` |
| `sfStep` | 0.1 | Schritt, um den `sf` sinkt, wenn schon die erste Portion über `pctHi` landet oder die Kontrolle „zu viel" meldet |
| `sfUp` | 0.05 | Schritt, um den `sf` steigt (höchstens 1), wenn das Fenster erst nach Korrekturportionen im Band endet |

### cfg3 – Pumpe und Zeiten

| Feld | Startwert | Bedeutung |
| --- | --- | --- |
| `tDead` | 20 | s Totzeit der ersten Portion: Leitungen füllen, kein Wasser an der Pflanze (Messlauf: erste Reaktion nach 5–8 s bei vollem Schlauch) |
| `tMin` | 25 | s kleinste Erstportion; eine kleinere Dosis wird auf `tMin` angehoben |
| `tStd` | 70 | s Erstportion, solange kein Lernwert `effW` vorliegt |
| `tMax` | 180 | s Summe aller Portionen eines Fensters; `auto_off` = `tMax` + 10 s |
| `tHot` | 35 | °C Tagesmaximum (heute oder gestern), ab dem `pauseHot` gilt |
| `pauseHot` | 12 | h Mindestpause bei Hitze (beide Fenster möglich); gilt auch als Nachholfenster, wenn ein Fenster mit `max`/`zeit` endete und die Kontrolle unter `pctLo` lag |
| `pause` | 24 | h Mindestpause normal |
| `pauseSlow` | 48 | h Mindestpause bei geringer Abnahme (Staunässe-Verdacht) |
| `soak` | 30 | min nach dem Fensterende bis zur Kontrolle durch `bw_main` |
| `jobAge` | 20 | min: älter darf der Auftrag im Fenster nicht sein; so lange sperrt auch ein abgebrochenes Fenster (`st.why = laeuft`) |
| `maxDay` | 2 | Gießfenster je Kalendertag; Vorrat je Tag = `maxDay × tMax` Pumpensekunden |
| `tChk` | 5 | s zwischen zwei Wasserstandsprüfungen während einer Portion |
| `winA` | "08:00" | erstes Gießfenster (Ortszeit); der Installer baut daraus den Zeitplan |
| `winB` | "20:00" | zweites Gießfenster |
| `tick` | 15 | min Arbeitstakt von `bw_main` (Zeitplan `0 */tick * * * *`); Teiler von 60; nach Änderung Installer starten |
| `winEvery` | null | null = Fenster bei `winA`/`winB`; Zahl N = `bw_pump` alle N Minuten (bei Sekunde 30) und Sicherheits-Aus als Minutenliste (nur Zeitraffer) |
| `dryDay` | 5 | Wochentag der Trockenphase (0 = Sonntag … 6 = Samstag; null = nie): ab diesem Tag keine Gabe, bis die Feuchte unter `pctDry` liegt |

### cfg4 – Fenster-Regelkreis

Liest nur `bw_pump`; der Installer legt den Eintrag an. Startwerte aus dem [Messlauf](#messlauf-wirkung-eines-pumpenpulses) vom 13.09.2026; die Zeitraffer-Werte stehen im [Praxistest](#praxistest-im-zeitraffer-45-minuten).

| Feld | Startwert | Bedeutung |
| --- | --- | --- |
| `tWin` | 420 | s Zeitbudget je Fenster ab Scriptstart; das Fenster muss samt `tTail` vor dem nächsten `bw_main`-Takt enden (Installer prüft das) |
| `tTail` | 20 | s Reserve vor dem nächsten Takt |
| `nPort` | 6 | Portionen je Fenster; 1 = Einzelportion ohne Messung und Lernwert (Eimer-Variante) |
| `tPmin` | 10 | s kleinste Korrekturportion – nie kürzer als die Totzeit, sonst füllt sie nur den Schlauch |
| `tPmax` | 120 | s längste Portion (`toggle_after`-Obergrenze) |
| `tSoak` | 20 | s einsickern nach jeder Portion, bevor gemessen wird |
| `tStep` | 5 | s Abstand der Messwerte beim Stabilisieren |
| `tStab` | 60 | s Timeout der Stabilisierung; danach zählt der Mittelwert (noch steigend → `unstab`) |
| `nStab` | 4 | Messwerte, die für „stabil" in `dStab` liegen müssen |
| `dStab` | 1 | % Spanne für „stabil" (halbe Spanne für „kein Trend"); zugleich Auflösung für „Portion ohne Wirkung" |
| `tDead2` | 8 | s Totzeit der Folgeportionen (Schlauch voll); der Kalibrierlauf trägt sie aus `st.tr` nach |
| `dEffMin` | 2 | % Summe der Wirkung zweier voller Portionen; darunter Störung `noeff` |

### Zustandseinträge (schreiben die Scripts)

| Eintrag | Felder | Bedeutung |
| --- | --- | --- |
| `lrn` | `effW` % Feuchte je wirksame Pumpensekunde (Fensterskala, lernt `bw_pump`) · `sf` Sicherheitsfaktor der Erstportion (Start 0.7) · `rate` Austrocknung %/h · `tMean` geglättetes Tagesmaximum (Jahreszeit) · `tMaxD`, `tMaxY` Tagesmaximum heute/gestern in 2-°C-Schritten | Lernwerte (ein altes `eff` aus 0.1.x bleibt stehen und wird ignoriert) |
| `st` | `state` beob / gegossen / sperre · `ts` Start des letzten Fensters · `dur` s bis Pumpe-aus der letzten Portion (Pause ab `ts`, Kontrolle ab `ts + dur`) · `n` Portionen · `sec` Pumpensekunden · `pctB` Frischmessung vor der ersten Portion · `pctW` letzte stabile Fensterablesung · `pctA` Feuchte bei der Kontrolle · `effW` Wirkung dieses Fensters · `why` Ergebnis des Fensters (`laeuft` = in Arbeit oder abgebrochen) · `tr` s bis zur ersten Sensorreaktion in Portion 2 · `rated` · `dryOk` Trockenphase beendet | Zustand |
| `job` | `ok` · `sec` · `pct` · `why` Begründung · `ts` | Gießauftrag von `bw_main` für `bw_pump`; `bw_pump` trägt das Fensterergebnis in `why` ein und setzt `ok=false` |
| `day` | `date` · `n` Gießfenster heute · `sec` Summe aller Pumpensekunden (auch Teilportionen) | Tageszähler |
| `err` | `code` · `ts` · `mem` freier RAM in Byte | letzte Störung |
| `zrb1`…`zrb5`, `zr` | Kopien von `cfg3` · `lrn`+`day` · `st`+`err` · `cfg4` · `cfg2` · Startmarke `{go:1}` | nur während des [Zeitraffers](#praxistest-im-zeitraffer-45-minuten); `bw_install` baut daraus zurück |

## Betrieb und Ablesen

- **Installer/Zeitplan:** Der erste `Schedule.Create` je Lauf scheitert am Gerät gelegentlich mit „timespec validation" – der Installer wiederholt ihn automatisch (bis zu 3×). Seit v0.1.2 wiederholt er die erste Ablehnung stumm (sichtbar nur mit `DEBUG = 1`); erst eine zweite Ablehnung erscheint als `Hinweis: Schedule.Create '…' vom Gerät abgelehnt …`. Am Ende stehen alle drei Zeitplan-Einträge (`Zeitplan #1..#3` in der Konsole). Die Ablehnung hängt nicht am KVS-Speicher: sie bleibt auch, wenn der Installer die KVS-Objekte vorher freigibt (Gerät 13.09.2026).
- **Debug:** In jedem Script steht oben `var DEBUG = 0;`. Auf `1` gesetzt, schreibt es zusätzlich jeden Schritt, jeden RPC-Aufruf mit Parametern, jeden gelesenen KVS-Eintrag mit Typ und Inhalt sowie Messwerte (`[bw_main dbg] …`) in die Konsole. Für den Normalbetrieb wieder auf `0`.
- **Konsole** (Web-UI → Scripts → Script öffnen → Konsole): `bw_main` schreibt je Takt eine Zeile, zum Beispiel `V=1.196 pct=34 tC=22 lvl=0 st=beob dry=1 pause=24h why=ok sec=70 effW=- sf=0.7 err=- w=3 dauer=2600ms`. `why` ist der Grund für oder gegen einen Auftrag (siehe Tabelle unten), `w` die Zahl der KVS-Schreibvorgänge dieses Takts, `dauer` die Laufzeit. Bei der Kontrolle `soak` min nach dem Fenster kommt `Kontrolle: 55.2 → 48.1 % sf=0.75` dazu, in der Trockenphase `Trockenphase (Wochentag 5): warte auf < 28 %` bzw. `Trockenphase (nass 63 %): …`.
- **Konsole von `bw_pump`** (je Fenster: Kopfzeile, eine Zeile je Portion, Ergebniszeile): `Fenster: Auftrag 25 s, pct 20, effW null sf 0.7, Frist 420 s` (Auftrag, Lernstand, Sekunden bis zum nächsten Takt) · `m0 20 % → P1 25 s` (Frischmessung, Erstportion) · `P1 25s: 20→44.9 (24.9, g 4.976, tRise 25, stabil 17s)` (Feuchte vor → nach der Portion, Zuwachs, Wirkung je wirksame Sekunde, erste Reaktion nach s, Stabilisierung nach s) · `ergebnis=ok n=2 sec=35 dur=76 pct=20→55.2 effW=5.027 sf=0.75 day.n=1 err=null w=4 dauer=118860` (Ergebnis, Portionen, Pumpensekunden, Fensterdauer, Feuchte vor → nach, neuer Lernwert, Sicherheitsfaktor, Fenster heute, Störung, Schreibvorgänge, Laufzeit in ms). Sonderzeilen: `m0 … ≥ pctOk – feucht`, `m0 … > pctHi – nass`, `keine Wirkung: Probeportion …`, `Störung noeff …`, `Frist: Rest … s`, `Grenze erreicht`, `Behälter leer`, `Ausgang war EIN – Ende (extern)`, `Fenster abgebrochen (laeuft) – kein Auftrag`.
- **KVS** ablesen: `http://<ip>/rpc/KVS.GetMany?match=*` oder `tools/kvs_dump.sh <ip>`. `Sys.GetStatus` liefert `kvs_rev`, den Zähler aller Schreibvorgänge.
- **Gabe = ein Gießfenster** mit bis zu `nPort` Portionen: `day.n` zählt Fenster, `day.sec` alle Pumpensekunden, `st.n` die Portionen des letzten Fensters. Pause und Tageslimit rechnen in Fenstern.
- **Von Hand gießen:** `job` auf `{"ok":true,"sec":25,"pct":30,"why":"hand","ts":<unixtime jetzt>}` setzen und innerhalb von `jobAge` Minuten `bw_pump` starten (oder das nächste Fenster abwarten). Mit `pct` läuft der Regelkreis wie im Fenster: Frischmessung (liegt sie schon über `pctOk`, gibt es keine Gabe – `why=feucht`), Portionen bis ins Band, Lernwert. Ohne `pct` (`"pct":null`) pumpt `bw_pump` genau `sec` Sekunden als Einzelportion ohne Messung und ohne Lernwert – so arbeitet auch der Hardware-Test. Ein Handstart außerhalb des Fensters bekommt nur die Frist bis zum nächsten Takt (`why=zeit`, wenn sie nicht reicht).
- **Störung „keine Wirkung" zurücksetzen:** KVS-Eintrag `err` löschen (`KVS.Delete {key:"err"}`), nachdem Pumpe, Schlauch und Sensorlage geprüft sind. Alle anderen Störungen löschen sich selbst, wenn die Ursache weg ist.
- **Werte ändern:** cfg-Einträge jederzeit im KVS bearbeiten; die Scripts lesen sie bei jedem Start. Nach Änderung von `winA`/`winB`, `tick`, `winEvery`, `tMax`, `tWin` oder `tTail` den Installer erneut starten (Zeitplan, Sicherheits-Aus und auto_off), am einfachsten mit `node tools/hwtest.js <ip> normal 30`. Vor Änderungen an Zeitwerten (`tDead`, `tDead2`, `tPmin`, `tSoak`, `tStab`) lohnt ein [Messlauf](#messlauf-wirkung-eines-pumpenpulses). Die wichtigsten Stellschrauben für Laien stehen in der Quick Note oben.
- **Update von 0.1.x auf 0.2.0:** (1) Flash freiräumen: `engine_probe`, `bw_hwtest`, `bw_hwpump` per `Script.Delete` entfernen (`put-script.js` prüft `fs_free`). (2) `dist/bw_pump.js`, `bw_main.js`, `bw_install.js`, `bw_zeitraffer.js` hochladen, `verify-scripts.js` (prüft auch, dass `bw_main` und `bw_pump` dieselbe Version haben). (3) Handwerte (Beispielband am Gerät): `cfg2` → `pctOk` 50, `pctHi` 60, `pctDry` 28, `effMax` 30; `cfg3` → `tMax` 180, `tMin` 25. (4) `node tools/hwtest.js <ip> normal 30`: der Installer ergänzt `cfg4`, `cfg3.dryDay`, `cfg2.dropW`/`sfUp`, `lrn.effW`/`sf` 0.7, baut den Zeitplan mit Sicherheits-Aus `0 8 8,20` und setzt `auto_off` 190 s. Bis `pctOk` eingetragen ist, gießt das System nicht (`why=cfg`); jede Upload-Reihenfolge ist wassersicher (altes `st`/`lrn` werden toleriert, ein Auftrag ohne `pct` wird zur Einzelportion). Das alte `lrn.eff` darf gelöscht werden.
- **Alles einmal live sehen:** [Praxistest im Zeitraffer](#praxistest-im-zeitraffer-45-minuten) – dieselben Scripts mit 3-min-Takt, Fenstern alle 6 min und Portionen von 10–15 s; zurück mit `bw_install`.

`job.why` im Überblick – bis zum Fenster schreibt es `bw_main` (Grund für oder gegen einen Auftrag), im Fenster `bw_pump` (Ergebnis, zugleich `st.why`):

| why | von | Bedeutung |
| --- | --- | --- |
| `ok` | main | Auftrag steht, `sec` Sekunden Erstportion im nächsten Fenster |
| `cfg` | main | Zielband unvollständig (auch `pctOk`) oder Ordnung verletzt |
| `sensor` | main, pump | Feuchtesensor unplausibel (im Fenster: vor oder zwischen den Portionen, `err=sensor`) |
| `lvl` | main, pump | Wasserstand nicht stabil lesbar |
| `wasser` | main, pump | Behälter leer (im Fenster: vor der ersten Portion oder in der Wartephase danach, `err=wasser`) |
| `err:<code>` | main, pump | stehende Störung blockiert (z. B. `err:noeff`) |
| `limit` | main, pump | Tageslimit `maxDay` erreicht |
| `alt` | pump | Auftrag älter als `jobAge` (`err=alt`) – läuft `bw_main` noch? |
| `soak` | main | Fenster wartet noch auf die Kontrolle |
| `pause` | main | Mindestpause läuft (12 / 24 / 48 h; im Zeitraffer 6 / 12 min) – auch nach einem abgebrochenen Fenster (`st.why = laeuft`) |
| `trocken` | main | Trockenphase (Trockentag oder Feuchte über `pctHi`): keine Gabe, bis eine Taktmessung unter `pctDry` liegt |
| `feucht` | main, pump | Feuchte über `pctLo` (Takt) bzw. Frischmessung im Fenster schon ≥ `pctOk` – keine Gabe, kein Lernwert, keine Pause |
| `nass` | pump | Frischmessung im Fenster über `pctHi` → Trockenphase, keine Gabe |
| `ok` | pump | Fenster im Band beendet (`pctW ≥ pctOk`) |
| `over` | pump | schon die erste Portion über `pctHi`: `sf` sinkt |
| `max` | pump | Grenze erreicht: `nPort` Portionen, `tMax` oder Tagesvorrat aufgebraucht |
| `zeit` | pump | Frist bis zum nächsten Takt reicht nicht für die nächste (oder erste) Portion |
| `stall` | pump | eine spätere Portion blieb ohne Wirkung, obwohl frühere wirkten (kein `err`) |
| `unstab` | pump | Messwert stieg beim Timeout noch – Fenster beendet, keine weitere Portion |
| `noeff` | pump | zwei volle Portionen ohne Wirkung → Störung `noeff` |
| `abbruch` | pump | Behälter während einer Portion leer → Pumpe sofort aus, `err=wasser` |
| `extern` | pump | Ausgang war schon EIN oder wurde von außen ausgeschaltet – Fenster beendet |
| `switch` / `kvs` | pump | `Switch.Set` bzw. der Claim `st.why=laeuft` schlug fehl – nicht gepumpt |
| `laeuft` | pump (nur `st.why`) | Fenster in Arbeit; bleibt es stehen, starb das Script mitten im Fenster (Pumpe geht über `toggle_after`/`auto_off`/Sicherheits-Aus aus, `bw_main` hält die Pause) |
| `kein_auftrag` | pump | `bw_pump` lief ohne gültigen Auftrag (z. B. Handstart) |

## Störungen und was sie bedeuten

| `err.code` | Gesetzt von | Blockiert das Gießen | Löscht sich | Was tun |
| --- | --- | --- | --- | --- |
| `cfg` | main, pump, install | ja | wenn cfg vollständig und das Band geordnet ist | fehlendes Feld eintragen (Konsole nennt es); nach einem Update `pctOk` von Hand, `cfg4` per Installer |
| `uhr` | main, pump | ja | wenn Uhrzeit gültig | Internet/NTP prüfen; nach Stromausfall ohne Internet steht der Zeitplan ohnehin |
| `sensor` | main, pump | ja | wenn Spannung im Bereich | Kabel, Stecker, Sensorlage prüfen |
| `wasser` | main, pump | ja | wenn Wasser vorhanden | Behälter füllen |
| `noeff` | pump | ja | **nie** | zwei volle Portionen im Fenster ohne messbare Wirkung (Σ < `dEffMin`): Pumpe, Schlauch, Sensorlage prüfen, dann `err` löschen |
| `temp` | main | nein | wenn Fühler wieder liest | DS18B20 prüfen; Hitzeregel ist solange aus |
| `zuviel` | main | nein | bei der nächsten Kontrolle | Hinweis: Feuchte bei der Kontrolle über `pctHi + hyst`, Sicherheitsfaktor gesenkt (außer das Fenster endete schon mit `over`) |
| `sink` | main | nein | bei der nächsten Kontrolle | Hinweis: Feuchte seit der letzten Fensterablesung um mehr als `dropW` gefallen (Drainage, Sensor verrutscht?) – nur wenn `dropW` gesetzt ist |
| `alt` | pump | nein | wenn `bw_main` einen neuen Auftrag schreibt | `bw_main` läuft nicht mehr? Zeitplan und Konsole prüfen |
| `limit` | pump | nein | beim Tageswechsel | Hinweis: `maxDay` erreicht |

Vorrang: `noeff` wird nie überschrieben; eine blockierende Störung verdrängt einen Hinweis; unter den blockierenden gilt cfg > uhr > sensor > wasser. `err.mem` wird bei jeder Störung und einmal täglich aktualisiert (Speicherleck sichtbar machen). Keine Störung, aber eine Sperre: `job.why = nass` bzw. `trocken` – die Trockenphase (Trockentag oder Feuchte über `pctHi`) endet von selbst, sobald eine Taktmessung unter `pctDry` liegt.

## Sicherheit (Pumpe, Wasser, Strom)

- **Dreifache Abschaltung der Pumpe:** `toggle_after` im Einschaltbefehl jeder Portion (Gerät schaltet nach höchstens `tPmax` s selbst ab), `auto_off` in der Switch-Konfiguration (nach `tMax` + 10 s = 190 s je Einschaltbefehl), Sicherheits-Aus im Zeitplan 8 Minuten nach jedem Fenster (`0 8 8,20 * * *` = 30 s Start + `tWin` 420 s + 10 s, aufgerundet). Alle drei wirken ohne Script.
- **Ausgang nach Neustart aus** (`initial_state = off`, setzt der Installer).
- **Frist bis zum Takt:** `bw_pump` rechnet beim Start aus, wie viele Sekunden bis zum nächsten `bw_main`-Takt bleiben (höchstens `tWin`, abzüglich `tTail`), und startet keine Portion, die samt Einsickern und Stabilisieren nicht mehr hineinpasst (`why=zeit`). Der Installer prüft dieselbe Bedingung für den Zeitplan. So laufen die beiden Scripts nie gleichzeitig (geteilter Heap).
- **Abbruchsicher:** vor der ersten Portion steht `st.why = laeuft` im KVS. Stirbt das Script mitten im Fenster, geht die Pumpe über die drei Abschaltungen aus, `bw_main` hält die Pause, es entsteht kein Lernwert, und ein Handstart innerhalb von `jobAge` Minuten gießt nicht.
- **Harte Grenzen unabhängig vom Lernen:** `tPmax` je Portion, `tMax` je Fenster, `nPort` Portionen, `maxDay` Fenster je Tag, Mindestpause. Korrekturportionen rechnen mit der im Fenster gemessenen Wirkung, nie mit weniger als `effMin`. Bei ungültiger Uhrzeit, unplausiblem Sensor, leerem Behälter oder stehender Störung wird nicht gegossen.
- **Keine Wirkung heißt nie mehr Wasser:** Bleibt die erste Portion ohne messbare Wirkung, folgt genau eine volle Probeportion; bleibt auch die aus, sperrt `noeff` das System, bis ein Mensch nachgesehen hat. So wird ein abgerutschter Sensor nicht zum gefluteten Topf.
- **Strom:** Der Shelly-Ausgang trägt höchstens 30 V / 300 mA und schaltet nur die Relaisspule. Arbeiten an 230 V (Gardena-Trafo, Relaiskontakt) nur durch eine Elektrofachkraft. Shelly, Relais und Netzteil trocken und im Gehäuse, mit Abstand zum Wasser.
- **Wasser:** Schwimmer oberhalb des Pumpeneinlaufs, damit die Pumpe nicht trocken läuft. Schläuche so führen, dass ein Defekt keinen Wasserschaden macht. Vorrat so bemessen, dass `maxDay × tMax` Pumpensekunden (Startwerte: 2 × 180 s) sicher möglich sind.

## Funktionsweise für Interessierte

**Drei Einmal-Läufer, ein Zeitplan, ein Gedächtnis.** Dauerhaft laufende Scripts sind auf dem Shelly nach Stunden abgestürzt. Deshalb startet der Zeitplan des Geräts jedes Script nur für Sekunden: Es liest den KVS, arbeitet, schreibt Änderungen zurück und beendet sich selbst (`Script.Stop`). Es gibt keinen Zustand im Arbeitsspeicher; jeder Takt beginnt sauber.

- `bw_install` (einmalig): legt KVS-Startwerte, Zeitplan und Switch-Konfiguration an und prüft, dass ein Fenster samt Budget vor dem nächsten Takt endet.
- `bw_main` (alle 15 min): misst Feuchte (`nSample` Werte, Mittelwert der Mitte), Temperatur und Wasserstand, prüft Plausibilität und Bandordnung, kontrolliert das letzte Fenster, führt die Trockenphase, bestimmt die Pause und schreibt den Auftrag `job` mit Begründung. Rührt die Pumpe nie an.
- `bw_pump` (08:00:30, 20:00:30): liest `job`, prüft Freigaben (ok, Alter, Störung, Tageslimit), misst frisch und regelt das Fenster in Portionen (unten), lernt `lrn.effW`/`sf`, schreibt Ergebnis in `st` und `day` und verbraucht den Auftrag. Läuft höchstens `tWin` s und endet vor dem nächsten Takt.

**Regelung:** Feuchte % = (V − vDry) / (vWet − vDry) × 100. Ein Auftrag entsteht nur, wenn Feuchte < `pctLo`, die Pause abgelaufen ist, keine Trockenphase läuft, Wasser vorhanden ist und keine Störung steht. Erstportion: `sec = (pctSoll − ist) / effW · sf + tDead`, begrenzt auf `tMin … tMax`; ohne Lernwert `tStd`. Der Sicherheitsfaktor `sf` startet bei 0,7 – die Erstportion landet bewusst **unter** dem Ziel, den Rest holen Korrekturportionen im Fenster.

**Im Fenster** (`bw_pump`): Frischmessung `m0` (≥ `pctOk` → `feucht`, keine Gabe; > `pctHi` → `nass`, Trockenphase) → Portion mit `toggle_after` → `tSoak` s einsickern → alle `tStep` s messen, bis `nStab` Werte in `dStab` % liegen und nicht mehr steigen (höchstens `tStab` s) → Urteil: über `pctHi` → `over`; ≥ `pctOk` → `ok`; sonst nächste Portion aus der **im Fenster gemessenen** Wirkung `g = Σ Δ% / Σ wirksame Sekunden` (Sekunden minus Totzeit `tDead` bzw. `tDead2`): `sec = (Ziel − ist) / g + tDead2`, Ziel = halber Weg bis `pctHi`, höchstens `pctSoll`; geklemmt auf `tPmin … tPmax`, Rest von `tMax` und Tagesvorrat, und nur, wenn Portion + Einsickern + Stabilisieren noch in die Frist passen (`zeit`). Höchstens `nPort` Portionen (`max`). Eine Portion ohne Wirkung (Δ < `dStab`): als erste → eine volle Probeportion, danach `noeff` (Σ < `dEffMin`); als spätere → `stall`.

**Lernen** (am Fensterende, nur mit wirksamen Sekunden): `effNew = Σ Δ% / Σ wirksame Sekunden`, begrenzt auf `effMin … effMax`; `effW = 0,7 · alt + 0,3 · neu` (erstes Fenster: Übernahme). Landet schon die erste Portion über `pctHi` (`over`), sinkt `sf` um `sfStep` (nie unter `sfMin`); endet das Fenster erst nach Korrekturportionen im Band, steigt `sf` um `sfUp` (höchstens 1). Kein Lernen bei `noeff`, `sensor`, `switch`, `laeuft`; bei `abbruch`/`extern` nur aus fertigen Portionen.

**Kontrolle** (`bw_main`, `soak` min nach dem Fensterende): der 30-min-Wert geht nie in `effW` (Drainage). Liegt er über `pctHi + hyst` und das Fenster endete nicht schon mit `over`, sinkt `sf` (Hinweis `zuviel`); ist er seit der Fensterablesung um mehr als `dropW` gefallen, Hinweis `sink`. Endete das Fenster mit `max`/`zeit` und liegt der Wert unter `pctLo`, gilt `pauseHot` als Nachholfenster.

**Trockenphase:** ab dem Tageswechsel auf `dryDay` (Freitag) und sobald eine Taktmessung über `pctHi` liegt (auch die Frischmessung im Fenster) wird nicht gegossen, bis eine Taktmessung unter `pctDry` liegt (`why=trocken`). Das baut Staunässe planmäßig ab, ohne nach jeder Gabe zu warten.

**Pause:** Tagesmaximum (heute oder gestern) über `tHot` → `pauseHot` (beide Fenster möglich). Feuchteabnahme je 24 h unter `dropSlow` → `pauseSlow` (Staunässe-Verdacht). Sonst `pause`. Die Pause gilt als abgelaufen, wenn sie beim nächsten Fenster bis auf einen Takt vorbei ist, damit die 24-h-Regel das gleiche Fenster am nächsten Tag trifft.

**Zustände** in `st.state`: `beob` (beobachten) → Fenster → `gegossen` (wartet auf die Kontrolle) → `sperre` (Pause oder Trockenphase läuft) → `beob`. `st.why` trägt das Ergebnis des Fensters, `laeuft` solange es in Arbeit ist. Störungen laufen getrennt in `err`.

**Tageswechsel** ohne eigenen Zeitplan-Eintrag: `bw_main` vergleicht `day.date` mit dem lokalen Datum, das es ohne `Date`-Objekt aus `Sys.time` (HH:MM) und `unixtime` berechnet.

**KVS-Schreibvorgänge:** nur bei Zustandsänderung; `bw_pump` schreibt je Fenster den Claim und am Ende nur die geänderten von `st`, `day`, `job`, `err`, `lrn`. Im Modell sind das 8–9 Schreibvorgänge an Tagen ohne Gabe und 13–16 an Tagen mit Gabe, statt 96 Takten (Zahlen für 0.2.0: 7-Tage-Simulation in `docs/PLAN.md`).

## Grenzen des Shelly

- Maximal **3 laufende Scripts**, hier genau drei. Maximal 5 offene RPC-Aufrufe und 5 Timer je Script; mehr als zwei bis drei verschachtelte anonyme Funktionen lassen das Gerät abstürzen. Die Scripts halten deshalb immer nur einen RPC offen und nutzen benannte Callbacks.
- **KVS:** 50 Einträge, je 253 Zeichen. Es gibt keine Messhistorie am Gerät; wer Verläufe will, braucht Stufe 2 (Backend, siehe `docs/konzept-v2.md` Abschnitt 8).
- **Uhrzeit:** Der Zeitplan braucht eine gültige Uhrzeit. Solange das Gerät durchläuft, hält es die Zeit auch ohne Internet. Nach einem Stromausfall **ohne** Internet steht der Zeitplan, bis NTP wieder erreichbar ist; das System pausiert dann bewusst.
- **Flash:** Jeder KVS-Schreibvorgang geht auf den Flash-Speicher; die Scripts schreiben nur bei Änderung.
- **Sprachumfang:** `let`/`var`, Funktionen, `JSON`, `Math`; kein `const`, keine Klassen, keine Promises, kein Hoisting – Funktionsnamen dürfen auf Modulebene erst nach ihrer Deklaration benutzt werden, deshalb steht die Schrittliste `steps[]` in jedem Script ganz unten. Die Aufruftiefe ist auf etwa zehn Ebenen begrenzt, deshalb ist die Schrittkette eine flache Schleife. Details in [`scripts/lib_notes.md`](scripts/lib_notes.md), Erfahrungen vom Gerät in [`LEARNING.md`](LEARNING.md).
- **Ein Sensor, mehrere Tropfer:** Der Regelkreis misst nur am Sensor (nassester Punkt unter dem Tropfer); weitere Tropfer am selben Verteiler werden blind mitversorgt und sollten baugleich sein. Jede Portion ist ein Schaltspiel des Relais (bis `nPort` je Fenster).
- **Analogeingang:** 0–15 V (oder 0–30 V) für ein Nutzsignal von 0–3 V; ein Feuchteprozent sind rund 0,03 V, deshalb Mehrfachmessung und Hysterese.

## Entwicklung und Tests ohne Gerät

`tools/mock/shelly-mock.js` bildet das Gerät in Node nach (KVS, Zeitplan, Switch mit `toggle_after`, Sensoren, Sys-Status mit Ortszeit, Timer, RPC mit virtueller Uhr, Überlappungswächter für gleichzeitig gestartete Scripts). Die Scripts laufen dort unverändert. `potModel()` in `tools/test/helpers.js` ist ein Topfmodell für den Regelkreis (Wirkung je wirksame Sekunde, Totzeit `tDead`/`tDead2`, Rampe, Drainage, Austrocknung, Rauschen); damit spielt `pump.test.js` die Ergebnismatrix aus `docs/PLAN.md` durch – Einzelportion, Ziel in einer Portion, Korrekturportionen, `feucht`, `nass`, `over`, `noeff`, `stall`, `unstab`, `max`, `zeit`, LEER, extern, Claim.

```
npm test                                   # 144 Tests: Installer, Messen, Freigabekette, Dosis, Pause, Fenster-Regelkreis, Kontrolle, 7-Tage-Simulation, Hardware-Tests, Zeitraffer
npm run check                              # Syntaxprüfung der sechs Scripts
npm run build                              # dist/ – kompakter Code für den Upload aufs Gerät (nur Versionszeile und //!-Doku-Block bleiben als Kommentar)
node tools/run-script.js scripts/bw_install.js
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":25,"pct":20,"why":"hand","ts":1789192500}'   # mit pct und Band: Regelkreis; ohne pct: Einzelportion
node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo    # Hardware-Test mit virtuellem Bediener (Sensor-Rampen, go-Kommandos)
node tools/run-script.js scripts/bw_hwpump.js --seed --hwdemo    # Pumpentest, bw_pump läuft als zweites Script im Mock
node tools/run-script.js scripts/bw_zeitraffer.js --seed          # Zeitraffer: Sicherung, Profile, bw_install baut den 3/6-Zeitplan
```

`tools/test/syntax.test.js` verbietet Konstrukte, die die Shelly-Engine nicht kennt (Arrow-Functions, Template-Strings, `const`, anonyme Funktionen, `Date`, Array-Methoden wie `shift`/`forEach`/`map`). `tools/test/zeitraffer.test.js` spielt den 45-Minuten-Fahrplan mit dem Topfmodell sekundengenau im Mock durch (feucht → Fenster 1 in Portionen → 12-min-Pause → Fenster 2 → Hitze-Fenster nach 6 min → wasser → Fenster 4 → limit) und prüft, dass kein Fenster in einen `bw_main`-Takt läuft. Planung und Entscheidungen: [`docs/PLAN.md`](docs/PLAN.md); Prüfschritte am Gerät: [`docs/pruefprotokoll-etappe6.md`](docs/pruefprotokoll-etappe6.md); am Gerät gefundene Eigenheiten: [`LEARNING.md`](LEARNING.md).

## Handbuch & Weiterentwicklung

Das zweisprachige (Deutsch/English) **[Handbuch unter `docs/handbuch/`](docs/handbuch/README.md)** erklärt alles
ausführlich – für Anfänger und Fortgeschrittene:

1. [Einführung & Architektur](docs/handbuch/01-einfuehrung.md)
2. [Hardware & Verdrahtung](docs/handbuch/02-hardware-verdrahtung.md)
3. [Installation am Gerät](docs/handbuch/03-installation.md)
4. [Auf eigenem VPS mitentwickeln](docs/handbuch/04-vps-mitentwickeln.md) (Hostinger, git clone, Node, Claude Code)
5. [Claude Code & graft](docs/handbuch/05-claude-code-graft.md) (Aufbau & Verwendung)
6. [Shelly per Remote live debuggen](docs/handbuch/06-shelly-remote-debug.md) (MobaXterm-Tunnel – **KI debuggt Hardware live**)
7. [Mitwirken & Tests](docs/handbuch/07-mitwirken-tests.md)

- Mitentwickeln mit **KI-Agenten:** [`AGENTS.md`](AGENTS.md) (inkl. Regel: Commits nur mit menschlicher Zustimmung).
- Projekt auf einem eigenen Server aufsetzen? Empfehlung **Hostinger VPS** (Rabatt über den Freunde-Link):
  <https://www.hostinger.com/de?REFERRALCODE=KPQ4INFOETIT>
- Warum das Projekt so heißt und wofür es rankt: [`docs/seo-keywords.md`](docs/seo-keywords.md).

## Lizenz

MIT, siehe [`LICENSE`](LICENSE). Copyright (c) 2026 Robert-AI-Development.
