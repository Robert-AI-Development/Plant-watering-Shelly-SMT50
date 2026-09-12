# Pflanzenbewässerung mit Shelly Plus Uni und SMT50

Version 0.1.0 – Stand 12.09.2026. Stellen mit `[TODO am Gerät]` sind noch am echten Aufbau zu prüfen oder zu messen.

## Zweck

Ein Shelly Plus Uni misst alle 15 Minuten Bodenfeuchte, Umgebungstemperatur und Wasserstand und entscheidet selbst, ob und wie lange um 08:00 und 20:00 gegossen wird. Das Gerät lernt, wie viel Feuchte eine Pumpensekunde bringt, passt sich über die Temperatur an Sommer und Winter an und baut Staunässe über Trockenphasen ab. Alles läuft am Gerät ohne Backend und ohne Cloud; nur die Uhrzeit kommt aus dem Internet.

## Inhalt

1. [Stückliste](#stückliste)
2. [Verdrahtung](#verdrahtung)
3. [Kalibrierung](#kalibrierung)
4. [Installation](#installation)
5. [Konfiguration](#konfiguration-alle-kvs-felder)
6. [Betrieb und Ablesen](#betrieb-und-ablesen)
7. [Störungen](#störungen-und-was-sie-bedeuten)
8. [Sicherheit](#sicherheit-pumpe-wasser-strom)
9. [Funktionsweise](#funktionsweise-für-interessierte)
10. [Grenzen des Shelly](#grenzen-des-shelly)
11. [Entwicklung und Tests ohne Gerät](#entwicklung-und-tests-ohne-gerät)
12. [Lizenz](#lizenz)

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

1. **Trockenpunkt:** Sensor sauber und trocken in der Luft, in der Web-UI die Voltmeter-Spannung ablesen (oder erste Konsolenzeile von `bw_main`, Feld `V=`). Gemessen: 0,20 V → `cfg1.vDry`.
2. **Nasspunkt:** Sensor bis zur Markierung in ein Glas Wasser, Spannung ablesen. Gemessen: 3,13 V → `cfg1.vWet`.
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
3. **Scripts anlegen** (Web-UI → Scripts → Add script), Namen exakt `bw_install`, `bw_main`, `bw_pump`. Inhalt aus `scripts/bw_install.js`, `scripts/bw_main.js`, `scripts/bw_pump.js` einfügen und speichern. Kein Script auf „Run on startup" stellen.
4. **Installer starten:** `bw_install` einmal mit „Start" ausführen und die Konsole lesen. Er legt acht KVS-Einträge an (nur wenn sie fehlen), drei Zeitplan-Einträge und setzt die Switch-Konfiguration (Ausgang nach Neustart aus, automatische Abschaltung nach `tMax` + 10 s). Danach beendet er sich selbst. Er darf beliebig oft wiederholt werden.
5. **Prüfen:** Web-UI → Schedules zeigt `0 */15 * * * *` (bw_main), `0 0 8,20 * * *` (bw_pump) und `0 5 8,20 * * *` (Switch.Set aus). KVS ansehen: `http://<ip>/rpc/KVS.GetMany?match=*` im Browser oder `tools/kvs_dump.sh <ip>`.
6. **Zielband eintragen** (siehe Kalibrierung): Eintrag `cfg2` im KVS bearbeiten (Web-UI → Settings → Key-Value Storage, oder per RPC `KVS.Set`).
7. Ab jetzt läuft `bw_main` alle 15 Minuten. Die erste Konsolenzeile zeigt, ob alle drei Sensoren gelesen werden.

## Konfiguration (alle KVS-Felder)

Alle Werte liegen im KVS des Shelly; die Scripts enthalten keine Schwellen, Zeiten oder Grenzen. Fehlt ein Pflichtfeld, setzt das Script `err.code = "cfg"` und tut nichts. Der Installer schreibt die Startwerte nur, wenn der Eintrag fehlt; eigene Änderungen überleben eine Neuinstallation.

### cfg1 – Sensor und Kalibrierung

| Feld | Startwert | Bedeutung |
| --- | --- | --- |
| `vDry` | 0.20 | Spannung Sensor trocken in Luft = 0 % |
| `vWet` | 3.13 | Spannung Sensor im Wasser = 100 % |
| `vErrLo` | 0.10 | darunter: Sensor- oder Kabelfehler (abgerissenes Kabel sieht wie „trocken" aus) |
| `vErrHi` | 3.35 | darüber: Sensor- oder Kabelfehler |
| `nSample` | 5 | Messungen je Takt; Mittelwert der mittleren Werte (Minimum und Maximum fallen weg) |
| `msSample` | 500 | Millisekunden zwischen zwei Messungen |
| `lvlEmpty` | 1 | Wert des Wasserstand-Eingangs, der „leer" bedeutet `[TODO am Gerät]` |
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
- **Sprachumfang:** `let`/`var`, Funktionen, `JSON`, `Math`; kein `const`, keine Klassen, keine Promises, kein Hoisting. Details in [`scripts/lib_notes.md`](scripts/lib_notes.md).
- **Analogeingang:** 0–15 V (oder 0–30 V) für ein Nutzsignal von 0–3 V; ein Feuchteprozent sind rund 0,03 V, deshalb Mehrfachmessung und Hysterese.

## Entwicklung und Tests ohne Gerät

`tools/mock/shelly-mock.js` bildet das Gerät in Node nach (KVS, Zeitplan, Switch mit `toggle_after`, Sensoren, Sys-Status mit Ortszeit, Timer, RPC mit virtueller Uhr). Die Scripts laufen dort unverändert.

```
npm test                                   # 53 Tests: Installer, Messen, Freigabekette, Dosis, Pause, Pumpe, Lernen, 7-Tage-Simulation
npm run check                              # Syntaxprüfung der drei Scripts
node tools/run-script.js scripts/bw_install.js
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":70,"pct":34,"why":"hand","ts":1789192500}'
```

`tools/test/syntax.test.js` verbietet Konstrukte, die die Shelly-Engine nicht kennt (Arrow-Functions, Template-Strings, `const`, anonyme Funktionen, `Date`). Planung und Entscheidungen: [`docs/PLAN.md`](docs/PLAN.md); Prüfschritte am Gerät: [`docs/pruefprotokoll-etappe6.md`](docs/pruefprotokoll-etappe6.md).

## Lizenz

MIT, siehe [`LICENSE`](LICENSE). Copyright (c) 2026 Robert-AI-Development.
