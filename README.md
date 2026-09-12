# Selbstlernende Pflanzenbewässerung mit Shelly Plus Uni & SMT50 — DIY Smart Home ohne Cloud

> **Gieß smart – Programmierung out of the box mit KI (Claude Code), läuft lokal auf deinem Shelly.**
> Automatische Pflanzenbewässerung mit Bodenfeuchte (SMT50) und Temperatur (DS18B20), selbstlernend, **ideal für
> den Urlaub** – und komplett **mit KI programmiert und live debuggt**.

*🇬🇧 English: A self-learning **Shelly plant-watering** system (soil moisture SMT50, DS18B20 temperature) that runs
**locally, no cloud** – built and live-debugged with **AI (Claude Code)**. Great for **watering plants while on
vacation**. See the bilingual [handbook](docs/handbuch/README.md).*

Version 0.1.2 – Stand 13.09.2026. Stellen mit `[TODO am Gerät]` sind noch am echten Aufbau zu prüfen oder zu messen; Kalibrierpunkte und Wasserstand wurden am 13.09.2026 mit dem Hardware-Test gemessen.

> 📖 **Neu hier?** Das zweisprachige **[Handbuch](docs/handbuch/README.md)** führt Schritt für Schritt durch
> Hardware, Installation, Weiterentwickeln auf einem eigenen Server und das **Live-Debuggen des Shelly per KI**.
> Für KI-Agenten: **[AGENTS.md](AGENTS.md)**.

## Zweck

Ein Shelly Plus Uni misst alle 15 Minuten Bodenfeuchte, Umgebungstemperatur und Wasserstand und entscheidet selbst, ob und wie lange um 08:00 und 20:00 gegossen wird. Das Gerät lernt, wie viel Feuchte eine Pumpensekunde bringt, passt sich über die Temperatur an Sommer und Winter an und baut Staunässe über Trockenphasen ab. Alles läuft am Gerät ohne Backend und ohne Cloud; nur die Uhrzeit kommt aus dem Internet.

**Ideal für den Urlaub:** einmal kalibriert, versorgt das System deine Zimmer- und Balkonpflanzen zuverlässig,
während du weg bist – mit harten Sicherheitsgrenzen gegen Überwässerung. **Besonderheit:** Dieses DIY-Projekt lässt
sich mit **künstlicher Intelligenz (Claude Code, Fable 5.1) direkt am echten Gerät live debuggen** – die KI liest
und schreibt den Shelly über einen Remote-Tunnel, lädt Scripts hoch und liest die Konsole mit. Wie das geht, steht
im [Handbuch, Kapitel 6](docs/handbuch/06-shelly-remote-debug.md).

## Inhalt

1. [Stückliste](#stückliste)
2. [Verdrahtung](#verdrahtung)
3. [Kalibrierung](#kalibrierung)
4. [Installation](#installation)
5. [Hardware-Test](#hardware-test-sensoren-und-pumpe-prüfen)
6. [Konfiguration](#konfiguration-alle-kvs-felder)
7. [Betrieb und Ablesen](#betrieb-und-ablesen)
8. [Störungen](#störungen-und-was-sie-bedeuten)
9. [Sicherheit](#sicherheit-pumpe-wasser-strom)
10. [Funktionsweise](#funktionsweise-für-interessierte)
11. [Grenzen des Shelly](#grenzen-des-shelly)
12. [Entwicklung und Tests ohne Gerät](#entwicklung-und-tests-ohne-gerät)
13. [Lizenz](#lizenz)

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
5. **Zielband eintragen** (cfg2), Vorschlag aus `docs/konzept-v2.md` Abschnitt 4.2:
   - `pctLo` = untere Referenz (löst den Auftrag aus)
   - `pctSoll` = Mitte zwischen unterer und oberer Referenz (Ziel jeder Gabe)
   - `pctHi` = obere Referenz plus wenige Prozent („zu viel")
   - `pctDry` = einige Prozent unter `pctLo` (Trockenphase gilt erst, wenn dieser Wert einmal unterschritten wurde)
6. **dropSlow:** an einem normalen Tag ohne Gabe die Abnahme der Feuchte über 24 h ablesen (`pct=` morgens und am nächsten Morgen). Etwa die Hälfte davon als Schwelle eintragen; bleibt die Abnahme darunter, gilt die lange Pause (Staunässe-Verdacht). `[TODO am Gerät]`

Solange `pctSoll`, `pctLo`, `pctHi`, `pctDry` oder `dropSlow` `null` sind, misst und protokolliert das System, gießt aber nicht (`err.code = "cfg"`, `job.why = "cfg"`).

## Installation

Voraussetzungen: Shelly Plus Uni im WLAN, Uhrzeit per NTP gesetzt, Zeitzone in den Geräteeinstellungen richtig (die Fenster 08:00/20:00 sind Ortszeit).

1. **Peripherie anlegen** (Web-UI des Shelly → Peripherals/Add-ons): Analogeingang als **Voltmeter** mit Bereich 0–15 V (kleinerer Bereich = feinere Auflösung), DS18B20 über den **1-Wire-Scan** hinzufügen. Die IDs erscheinen als `voltmeter:100` und `temperature:100`; weichen sie ab, später in `cfg1.idV`/`cfg1.idT` eintragen.
2. **Eingang 1** (IN2) in der Web-UI auf Typ „Switch" stellen.
3. **Scripts anlegen** (Web-UI → Scripts → Add script), Namen exakt `bw_install`, `bw_main`, `bw_pump` (optional dazu `bw_hwtest` und `bw_hwpump` für den [Hardware-Test](#hardware-test-sensoren-und-pumpe-prüfen); `node tools/hwtest.js <ip> preflight` legt sie an). Vorher `npm run build` ausführen und den Inhalt aus **`dist/`** (`dist/bw_install.js`, `dist/bw_main.js`, `dist/bw_pump.js`) einfügen und speichern – das ist derselbe Code ohne Kommentare und Einrückung, weil der Script-Speicher am Gerät begrenzt ist (seit Firmware 1.0.3 etwa 15 KB; `bw_main.js` mit Kommentaren liegt darüber). **Der Editor der Web-UI hat beim Einfügen Text verloren** (Firmware 2.0.0, 12.09.2026: 166 bzw. 210 Byte am Dateiende fehlten, Script startete mit `SyntaxError: Got EOF`). Zuverlässiger ist der Upload per RPC: `node tools/put-script.js <ip> <id> dist/bw_main.js` schickt die Datei in Stücken und vergleicht danach die Byte-Zahl am Gerät. Beim Einfügen im Editor **immer** prüfen: `http://<ip>/rpc/Script.GetCode?id=<id>&len=1` liefert `left`; `left + 1` muss der Dateigröße aus `npm run build` entsprechen. Kein Script auf „Run on startup" stellen.
4. **Installer starten:** `bw_install` einmal mit „Start" ausführen und die Konsole lesen. Er legt acht KVS-Einträge an (nur wenn sie fehlen), drei Zeitplan-Einträge und setzt die Switch-Konfiguration (Ausgang nach Neustart aus, automatische Abschaltung nach `tMax` + 10 s). Danach beendet er sich selbst. Er darf beliebig oft wiederholt werden.
5. **Prüfen:** Web-UI → Schedules zeigt `0 */15 * * * *` (bw_main), `0 0 8,20 * * *` (bw_pump) und `0 5 8,20 * * *` (Switch.Set aus). KVS ansehen: `http://<ip>/rpc/KVS.GetMany?match=*` im Browser oder `tools/kvs_dump.sh <ip>`.
6. **Zielband eintragen** (siehe Kalibrierung): Eintrag `cfg2` im KVS bearbeiten (Web-UI → Settings → Key-Value Storage, „Format as JSON“ anhaken, oder per RPC `KVS.Set`). Alle Werte sind JSON-Strings – die Web-UI kann nur Strings anzeigen und bearbeiten; ein Wert, der kein JSON-Objekt ist, wird vom Installer durch die Startwerte ersetzt (Konsole meldet es).
7. Ab jetzt läuft `bw_main` alle 15 Minuten. Die erste Konsolenzeile zeigt, ob alle drei Sensoren gelesen werden.

## Hardware-Test: Sensoren und Pumpe prüfen

Zwei zusätzliche Scripts prüfen den Aufbau Schritt für Schritt – mit dir am Gerät und einem Helfer (Mensch oder KI), der die Konsole liest und Kommandos schickt. Sie laufen **nur von Hand**, nie im Zeitplan, und dürfen nach dem Test am Gerät bleiben (`enable:false`). Am 13.09.2026 wurde der komplette Ablauf am echten Aufbau durchgeführt; die Werte stehen in [`docs/pruefprotokoll-etappe6.md`](docs/pruefprotokoll-etappe6.md).

**Voraussetzungen:** Installer gelaufen, Eingang 1 auf Typ „Switch", Node ≥ 22 auf dem Rechner mit Zugriff auf den Shelly (direkt oder per [Tunnel](docs/handbuch/06-shelly-remote-debug.md)). Am Aufbau: Eiswasser oder kaltes Leitungswasser (≤ 20 °C), warmes Wasser ~40 °C oder Handwärme (≥ 30 °C, nicht über 32 °C), ein Glas Wasser für den SMT50, ein Tuch, ein Eimer für den Schlauch, und der Schwimmer muss sich per Hand in beide Stellungen bringen lassen. Nur die Metallhülse des DS18B20 bzw. den Sensorkörper eintauchen, Stecker und Kabel trocken halten. Nicht in den 25 Minuten um 08:00, 20:00 oder Mitternacht starten (der Pumpentest wartet sonst).

```
npm run build
node tools/hwtest.js <ip> preflight                 # Uhrzeit, Scripts, Eingang 1, Ausgang, KVS; legt bw_hwtest (id 5) und bw_hwpump (id 6) an
node tools/put-script.js <ip> 5 dist/bw_hwtest.js   # Upload mit Größenprüfung
node tools/put-script.js <ip> 6 dist/bw_hwpump.js
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

- **Durchgang A** wartet auf `go` (Behälter voll, Schlauch im Eimer, du bleibst dabei), prüft Ausgang aus, Wasserstand stabil und nicht LEER, keine Störung `noeff`, und wartet die Zeitwache ab (nicht in den ersten/letzten 90 s eines 15-min-Takts, nicht ± 25 min um die Gießfenster und Mitternacht). Dann sichert es `st`, `day`, `job`, `err`, `lrn` nach `hwb1`/`hwb2`, setzt `err` auf keine Störung, `day` bei erreichtem Tageslimit zurück, schreibt den Auftrag `job = {ok:true, sec:hwt.pumpSec (30), pct:null, why:"hwtest"}`, startet `bw_pump` per `Script.Start` und beendet sich.
- **`bw_pump`** pumpt wie im Betrieb (mit `toggle_after`, `auto_off`, Wasserstandsprüfung) und schreibt sein Ergebnis.
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

## Konfiguration (alle KVS-Felder)

Alle Werte liegen im KVS des Shelly; die Scripts enthalten keine Schwellen, Zeiten oder Grenzen. Fehlt ein Pflichtfeld, setzt das Script `err.code = "cfg"` und tut nichts. Der Installer schreibt die Startwerte nur, wenn der Eintrag fehlt; eigene Änderungen überleben eine Neuinstallation.

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

| Feld | Startwert | Bedeutung |
| --- | --- | --- |
| `pctSoll` | null | SOLL-Mittelwert der Bodenfeuchte in %, Ziel jeder Gabe `[TODO am Gerät]` |
| `pctLo` | null | Untergrenze: darunter entsteht ein Gießauftrag `[TODO am Gerät]` |
| `pctHi` | null | Obergrenze: darüber nach einer Gabe gilt „zu viel", Sicherheitsfaktor sinkt `[TODO am Gerät]` |
| `pctDry` | null | Trockenphasen-Schwelle: muss seit der letzten Gabe einmal unterschritten sein `[TODO am Gerät]` |
| `hyst` | 2 | Hysterese in %: ein bestehender Auftrag bleibt bis `pctLo + hyst` |
| `dropSlow` | null | Feuchteabnahme je 24 h in %; darunter gilt `pauseSlow` `[TODO am Gerät]` |
| `effMin` | 0.05 | kleinster plausibler Lernwert (% je wirksame Pumpensekunde); darunter gilt „keine Wirkung" |
| `effMax` | 2.0 | größter plausibler Lernwert |
| `alpha` | 0.3 | Gewicht der neuen Messung beim Lernen (0,7 alt, 0,3 neu) |
| `sfMin` | 0.5 | Untergrenze des Sicherheitsfaktors |
| `sfStep` | 0.1 | Schritt, um den der Sicherheitsfaktor bei „zu viel" sinkt |

### cfg3 – Pumpe und Zeiten

| Feld | Startwert | Bedeutung |
| --- | --- | --- |
| `tDead` | 20 | s Totzeit: Leitungen füllen, kein Wasser an der Pflanze |
| `tMin` | 40 | s kleinste sinnvolle Gabe; kleinere Dosis → kein Auftrag |
| `tStd` | 70 | s Standardgabe für die allererste Gabe (ohne Lernwert) |
| `tMax` | 120 | s Höchstdauer je Gabe, muss unter dem Sicherheits-Aus (5 min) bleiben |
| `tHot` | 35 | °C Tagesmaximum (heute oder gestern), ab dem `pauseHot` gilt |
| `pauseHot` | 12 | h Mindestpause bei Hitze (beide Fenster möglich) |
| `pause` | 24 | h Mindestpause normal |
| `pauseSlow` | 48 | h Mindestpause bei geringer Abnahme (Staunässe-Verdacht) |
| `soak` | 30 | min Einsickerzeit bis zur Bewertung der Gabe |
| `jobAge` | 20 | min: älter darf der Auftrag im Fenster nicht sein |
| `maxDay` | 2 | Gaben je Kalendertag |
| `tChk` | 5 | s zwischen zwei Wasserstandsprüfungen während der Gabe |
| `winA` | "08:00" | erstes Gießfenster (Ortszeit); der Installer baut daraus den Zeitplan |
| `winB` | "20:00" | zweites Gießfenster |

### Zustandseinträge (schreiben die Scripts)

| Eintrag | Felder | Bedeutung |
| --- | --- | --- |
| `lrn` | `eff` % je wirksame Sekunde · `sf` Sicherheitsfaktor · `rate` Austrocknung %/h · `tMean` geglättetes Tagesmaximum (Jahreszeit) · `tMaxD`, `tMaxY` Tagesmaximum heute/gestern in 2-°C-Schritten | Lernwerte |
| `st` | `state` beob / gegossen / sperre · `ts` Start der letzten Gabe · `sec` · `pctB` Feuchte davor · `pctA` Feuchte nach der Bewertung · `rated` · `dryOk` Trockenphase nachgewiesen | Zustand |
| `job` | `ok` · `sec` · `pct` · `why` Begründung · `ts` | Gießauftrag von `bw_main` für `bw_pump` |
| `day` | `date` · `n` Gaben heute · `sec` Summe | Tageszähler |
| `err` | `code` · `ts` · `mem` freier RAM in Byte | letzte Störung |

## Betrieb und Ablesen

- **Installer/Zeitplan:** Der erste `Schedule.Create` je Lauf scheitert am Gerät gelegentlich mit „timespec validation" – der Installer wiederholt ihn automatisch (bis zu 3×). In der Konsole taucht dann eine Zeile `Schedule.Create '…' Versuch 1/3` auf; das ist normal, am Ende stehen alle drei Zeitplan-Einträge.
- **Debug:** In jedem Script steht oben `var DEBUG = 0;`. Auf `1` gesetzt, schreibt es zusätzlich jeden Schritt, jeden RPC-Aufruf mit Parametern, jeden gelesenen KVS-Eintrag mit Typ und Inhalt sowie Messwerte (`[bw_main dbg] …`) in die Konsole. Für den Normalbetrieb wieder auf `0`.
- **Konsole** (Web-UI → Scripts → Script öffnen → Konsole): `bw_main` schreibt je Takt eine Zeile, zum Beispiel `V=1.196 pct=34 tC=22 lvl=0 st=beob dry=0 pause=24h why=ok sec=70 eff=- sf=1 err=- w=3 dauer=2600ms`. `why` ist der Grund für oder gegen einen Auftrag (siehe Tabelle unten), `w` die Zahl der KVS-Schreibvorgänge dieses Takts, `dauer` die Laufzeit.
- **KVS** ablesen: `http://<ip>/rpc/KVS.GetMany?match=*` oder `tools/kvs_dump.sh <ip>`. `Sys.GetStatus` liefert `kvs_rev`, den Zähler aller Schreibvorgänge.
- **Von Hand gießen:** `job` auf `{"ok":true,"sec":70,"pct":30,"why":"hand","ts":<unixtime jetzt>}` setzen und innerhalb von `jobAge` Minuten `bw_pump` starten (oder das nächste Fenster abwarten). Die Gabe wird wie jede andere bewertet und gelernt.
- **Störung „keine Wirkung" zurücksetzen:** KVS-Eintrag `err` löschen (`KVS.Delete {key:"err"}`), nachdem Pumpe, Schlauch und Sensorlage geprüft sind. Alle anderen Störungen löschen sich selbst, wenn die Ursache weg ist.
- **Werte ändern:** cfg-Einträge jederzeit im KVS bearbeiten; die Scripts lesen sie bei jedem Start. Nach Änderung von `winA`/`winB` oder `tMax` den Installer erneut starten (Zeitplan und auto_off).

`job.why` im Überblick:

| why | Bedeutung |
| --- | --- |
| `ok` | Auftrag steht, `sec` Sekunden im nächsten Fenster |
| `cfg` | Zielband noch nicht eingetragen |
| `sensor` | Feuchtesensor unplausibel |
| `lvl` | Wasserstand in diesem Takt nicht stabil lesbar |
| `wasser` | Behälter leer |
| `err:<code>` | stehende Störung blockiert (z. B. `err:noeff`) |
| `limit` | Tageslimit `maxDay` erreicht |
| `soak` | Gabe wartet noch auf die Bewertung |
| `pause` | Mindestpause läuft (12 / 24 / 48 h) |
| `trocken` | Trockenphase noch nicht nachgewiesen (Feuchte war noch nicht unter `pctDry`) |
| `feucht` | Feuchte über `pctLo` |
| `tmin` | berechnete Dosis unter `tMin`, lieber nächsten Takt abwarten |

## Störungen und was sie bedeuten

| `err.code` | Gesetzt von | Blockiert das Gießen | Löscht sich | Was tun |
| --- | --- | --- | --- | --- |
| `cfg` | main, pump, install | ja | wenn cfg vollständig | fehlendes Feld eintragen (Konsole nennt es) |
| `uhr` | main, pump | ja | wenn Uhrzeit gültig | Internet/NTP prüfen; nach Stromausfall ohne Internet steht der Zeitplan ohnehin |
| `sensor` | main | ja | wenn Spannung im Bereich | Kabel, Stecker, Sensorlage prüfen |
| `wasser` | main, pump | ja | wenn Wasser vorhanden | Behälter füllen |
| `noeff` | main | ja | **nie** | Pumpe, Schlauch, Sensorlage prüfen, dann `err` löschen |
| `temp` | main | nein | wenn Fühler wieder liest | DS18B20 prüfen; Hitzeregel ist solange aus |
| `zuviel` | main | nein | bei der nächsten Bewertung | Hinweis: Gabe lag über `pctHi`, Sicherheitsfaktor gesenkt |
| `alt` | pump | nein | wenn `bw_main` einen neuen Auftrag schreibt | `bw_main` läuft nicht mehr? Zeitplan und Konsole prüfen |
| `limit` | pump | nein | beim Tageswechsel | Hinweis: `maxDay` erreicht |

Vorrang: `noeff` wird nie überschrieben; eine blockierende Störung verdrängt einen Hinweis; unter den blockierenden gilt cfg > uhr > sensor > wasser. `err.mem` wird bei jeder Störung und einmal täglich aktualisiert (Speicherleck sichtbar machen).

## Sicherheit (Pumpe, Wasser, Strom)

- **Dreifache Abschaltung der Pumpe:** `toggle_after` im Einschaltbefehl (Gerät schaltet nach `sec` selbst ab), `auto_off` in der Switch-Konfiguration (nach `tMax` + 10 s), Sicherheits-Aus im Zeitplan 5 Minuten nach jedem Fenster. Alle drei wirken ohne Script.
- **Ausgang nach Neustart aus** (`initial_state = off`, setzt der Installer).
- **Harte Grenzen unabhängig vom Lernen:** `tMax` je Gabe, `maxDay` je Tag, Mindestpause. Bei ungültiger Uhrzeit, unplausiblem Sensor, leerem Behälter oder stehender Störung wird nicht gegossen.
- **Keine Wirkung heißt nie mehr Wasser:** Eine Gabe ohne messbare Wirkung sperrt das System, bis ein Mensch nachgesehen hat. So wird ein abgerutschter Sensor nicht zum gefluteten Topf.
- **Strom:** Der Shelly-Ausgang trägt höchstens 30 V / 300 mA und schaltet nur die Relaisspule. Arbeiten an 230 V (Gardena-Trafo, Relaiskontakt) nur durch eine Elektrofachkraft. Shelly, Relais und Netzteil trocken und im Gehäuse, mit Abstand zum Wasser.
- **Wasser:** Schwimmer oberhalb des Pumpeneinlaufs, damit die Pumpe nicht trocken läuft. Schläuche so führen, dass ein Defekt keinen Wasserschaden macht. Vorrat so bemessen, dass `maxDay` Gaben mit `tMax` Sekunden sicher möglich sind.

## Funktionsweise für Interessierte

**Drei Einmal-Läufer, ein Zeitplan, ein Gedächtnis.** Dauerhaft laufende Scripts sind auf dem Shelly nach Stunden abgestürzt. Deshalb startet der Zeitplan des Geräts jedes Script nur für Sekunden: Es liest den KVS, arbeitet, schreibt Änderungen zurück und beendet sich selbst (`Script.Stop`). Es gibt keinen Zustand im Arbeitsspeicher; jeder Takt beginnt sauber.

- `bw_install` (einmalig): legt KVS-Startwerte, Zeitplan und Switch-Konfiguration an.
- `bw_main` (alle 15 min): misst Feuchte (`nSample` Werte, Mittelwert der Mitte), Temperatur und Wasserstand, prüft Plausibilität, bewertet die letzte Gabe, lernt, bestimmt die Pause und schreibt den Auftrag `job` mit Begründung. Rührt die Pumpe nie an.
- `bw_pump` (08:00, 20:00): liest `job`, prüft Freigaben (ok, Alter, Störung, Tageslimit, Wasserstand), schaltet den Ausgang mit `toggle_after`, überwacht den Wasserstand alle `tChk` s, schreibt Ergebnis in `st` und `day` und verbraucht den Auftrag.

**Regelung:** Feuchte % = (V − vDry) / (vWet − vDry) × 100. Ein Auftrag entsteht nur, wenn Feuchte < `pctLo`, die Pause abgelaufen ist, die Trockenphase nachgewiesen ist (Feuchte war seit der letzten Gabe einmal unter `pctDry`), Wasser vorhanden ist und keine Störung steht. Dosis: `sec = (pctSoll − ist) / eff · sf + tDead`, begrenzt auf `tMin … tMax`; die allererste Gabe bekommt `tStd`.

**Lernen:** `soak` Minuten nach der Gabe misst `bw_main` nach: `eff_neu = Δ% / (sec − tDead)`. Der Lernwert folgt sanft: `eff = 0,7 · alt + 0,3 · neu`, begrenzt auf `effMin … effMax`. Liegt `eff_neu` unter `effMin`, gilt die Gabe als wirkungslos (Störung `noeff`). Liegt die Feuchte danach über `pctHi`, sinkt der Sicherheitsfaktor `sf` um `sfStep` (nie unter `sfMin`), die nächste Gabe wird kleiner.

**Pause:** Tagesmaximum (heute oder gestern) über `tHot` → `pauseHot` (beide Fenster möglich). Feuchteabnahme je 24 h unter `dropSlow` → `pauseSlow` (Staunässe-Verdacht). Sonst `pause`. Die Pause gilt als abgelaufen, wenn sie beim nächsten Fenster bis auf einen Takt vorbei ist, damit die 24-h-Regel das gleiche Fenster am nächsten Tag trifft.

**Zustände** in `st.state`: `beob` (beobachten) → Gabe → `gegossen` (wartet auf Bewertung) → `sperre` (Pause und Trockenphase laufen) → `beob`. Störungen laufen getrennt in `err`.

**Tageswechsel** ohne eigenen Zeitplan-Eintrag: `bw_main` vergleicht `day.date` mit dem lokalen Datum, das es ohne `Date`-Objekt aus `Sys.time` (HH:MM) und `unixtime` berechnet.

**KVS-Schreibvorgänge:** nur bei Zustandsänderung. Im Modell sind das 8–9 Schreibvorgänge an Tagen ohne Gabe und 13–16 an Tagen mit Gabe, statt 96 Takten.

## Grenzen des Shelly

- Maximal **3 laufende Scripts**, hier genau drei. Maximal 5 offene RPC-Aufrufe und 5 Timer je Script; mehr als zwei bis drei verschachtelte anonyme Funktionen lassen das Gerät abstürzen. Die Scripts halten deshalb immer nur einen RPC offen und nutzen benannte Callbacks.
- **KVS:** 50 Einträge, je 253 Zeichen. Es gibt keine Messhistorie am Gerät; wer Verläufe will, braucht Stufe 2 (Backend, siehe `docs/konzept-v2.md` Abschnitt 8).
- **Uhrzeit:** Der Zeitplan braucht eine gültige Uhrzeit. Solange das Gerät durchläuft, hält es die Zeit auch ohne Internet. Nach einem Stromausfall **ohne** Internet steht der Zeitplan, bis NTP wieder erreichbar ist; das System pausiert dann bewusst.
- **Flash:** Jeder KVS-Schreibvorgang geht auf den Flash-Speicher; die Scripts schreiben nur bei Änderung.
- **Sprachumfang:** `let`/`var`, Funktionen, `JSON`, `Math`; kein `const`, keine Klassen, keine Promises, kein Hoisting – Funktionsnamen dürfen auf Modulebene erst nach ihrer Deklaration benutzt werden, deshalb steht die Schrittliste `steps[]` in jedem Script ganz unten. Die Aufruftiefe ist auf etwa zehn Ebenen begrenzt, deshalb ist die Schrittkette eine flache Schleife. Details in [`scripts/lib_notes.md`](scripts/lib_notes.md), Erfahrungen vom Gerät in [`LEARNING.md`](LEARNING.md).
- **Analogeingang:** 0–15 V (oder 0–30 V) für ein Nutzsignal von 0–3 V; ein Feuchteprozent sind rund 0,03 V, deshalb Mehrfachmessung und Hysterese.

## Entwicklung und Tests ohne Gerät

`tools/mock/shelly-mock.js` bildet das Gerät in Node nach (KVS, Zeitplan, Switch mit `toggle_after`, Sensoren, Sys-Status mit Ortszeit, Timer, RPC mit virtueller Uhr). Die Scripts laufen dort unverändert.

```
npm test                                   # 89 Tests: Installer, Messen, Freigabekette, Dosis, Pause, Pumpe, Lernen, 7-Tage-Simulation, Hardware-Tests
npm run check                              # Syntaxprüfung der fünf Scripts
npm run build                              # dist/ – kompakter Code für den Upload aufs Gerät
node tools/run-script.js scripts/bw_install.js
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":70,"pct":34,"why":"hand","ts":1789192500}'
node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo    # Hardware-Test mit virtuellem Bediener (Sensor-Rampen, go-Kommandos)
node tools/run-script.js scripts/bw_hwpump.js --seed --hwdemo    # Pumpentest, bw_pump läuft als zweites Script im Mock
```

`tools/test/syntax.test.js` verbietet Konstrukte, die die Shelly-Engine nicht kennt (Arrow-Functions, Template-Strings, `const`, anonyme Funktionen, `Date`, Array-Methoden wie `shift`/`forEach`/`map`). Planung und Entscheidungen: [`docs/PLAN.md`](docs/PLAN.md); Prüfschritte am Gerät: [`docs/pruefprotokoll-etappe6.md`](docs/pruefprotokoll-etappe6.md); am Gerät gefundene Eigenheiten: [`LEARNING.md`](LEARNING.md).

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
