# Bewässerungs-System – Umsetzungsplan v2 (Konfiguration im KVS)

Änderung gegenüber v1: **Keine Konfiguration im Script.** Jeder Schwellenwert, das Zielband, die Höchstdauer und alle Zeiten liegen im Gerätespeicher. Die Scripts lesen sie bei jedem Start. Neu ist der SOLL-Mittelwert der Bodenfeuchte als eigene Variable. Höchstdauer je Gabe ist mit 120 s bestätigt.

Aufbau der drei Scripts, Abläufe und Bauetappen bleiben wie in v1. Dieses Dokument ergänzt v1 um den vollständigen Konfigurationskatalog.

* * *

## 0 Grundsatz

```
 Script 0 (Installer)  ──schreibt einmalig──►  cfg1, cfg2, cfg3
                                                     │
 Du in der Web-UI      ──änderst jederzeit──►        │
                                                     ▼
 Script 1 und Script 2 ──lesen bei jedem Start──  KVS.Get
```

Regeln:

- Die Scripts enthalten **keine** Zahlenwerte für Schwellen, Zeiten oder Grenzen. Fehlt ein Feld im KVS, setzt das Script eine Störung und tut nichts.
- Der Installer schreibt Startwerte nur, wenn der Eintrag noch nicht existiert. Deine Änderungen in der Web-UI überleben eine Neuinstallation.
- Wegen der Grenze von 253 Zeichen je Eintrag ist die Konfiguration in drei Einträge aufgeteilt.

* * *

## 1 Konfigurationskatalog

### cfg1 – Sensor und Kalibrierung

| Feld | Startwert | Bedeutung |
| --- | --- | --- |
| `vDry` | 0.20 | Spannung Sensor trocken in Luft = 0 % |
| `vWet` | 3.13 | Spannung Sensor im Wasser = 100 % |
| `vErrLo` | 0.10 | darunter: Sensor- oder Kabelfehler |
| `vErrHi` | 3.35 | darüber: Sensor- oder Kabelfehler |
| `nSample` | 5 | Messungen je Takt, Mittelwert der mittleren Werte |
| `lvlEmpty` | 1 | Wert des Wasserstand-Eingangs, der „leer" bedeutet |
| `nLvl` | 3 | Abfragen des Wasserstands je Prüfung, müssen gleich sein |

### cfg2 – Zielband und Regelung

| Feld | Startwert | Bedeutung |
| --- | --- | --- |
| `pctSoll` | *offen* | **SOLL-Mittelwert der Bodenfeuchte in %** – die Mitte, auf die jede Gabe zielt |
| `pctLo` | *offen* | Untergrenze: darunter wird ein Gießauftrag erzeugt |
| `pctHi` | *offen* | Obergrenze: darüber gilt „zu viel", Sicherheitsfaktor sinkt |
| `pctDry` | *offen* | Trockenphasen-Schwelle: muss seit der letzten Gabe einmal unterschritten sein |
| `hyst` | 2 | Hysterese in % an der Untergrenze |
| `dropSlow` | *offen* | Feuchteabnahme je 24 h in %, darunter gilt die lange Pause |
| `effStart` | *aus erster Gabe* | Startwert Lernwert: % je wirksame Pumpensekunde |
| `effMin` / `effMax` | 0.05 / 2.0 | Plausibilitätsgrenzen für den Lernwert |
| `alpha` | 0.3 | Gewicht der neuen Messung beim Lernen (0,7 alt / 0,3 neu) |

Zielband, Untergrenze, Obergrenze und Trockenschwelle kommen aus den zwei Messungen an der echten Pflanze und werden dann eingetragen.

### cfg3 – Pumpe und Zeiten

| Feld | Startwert | Bedeutung |
| --- | --- | --- |
| `tDead` | 20 | s, Leitungen füllen – kein Wasser an der Pflanze |
| `tMin` | 40 | s, kleinste sinnvolle Gabe |
| `tStd` | 70 | s, Standardgabe für erste Gabe und Lernstart |
| `tMax` | 120 | s, Höchstdauer je Gabe – bestätigt |
| `tHot` | 35 | °C Tagesmaximum, ab dem zwei Gaben am Tag erlaubt sind |
| `pauseHot` | 12 | h Mindestpause bei Hitze |
| `pause` | 24 | h Mindestpause normal |
| `pauseSlow` | 48 | h Mindestpause bei geringer Abnahme |
| `soak` | 30 | min Einsickerzeit bis zur Bewertung |
| `jobAge` | 20 | min, älter darf der Auftrag um 08:00 / 20:00 nicht sein |
| `maxDay` | 2 | Gaben je Tag |
| `winA` / `winB` | 08:00 / 20:00 | Gießfenster (nur Dokumentation – der Zeitplan trägt die Zeiten selbst) |

* * *

## 2 Was sich in den Scripts ändert

| Script | Änderung |
| --- | --- |
| 0 – Installer | schreibt `cfg1`, `cfg2`, `cfg3` mit den Startwerten, nur wenn nicht vorhanden; Felder mit *offen* bleiben leer |
| 1 – Main | liest zu Beginn alle drei Einträge; fehlt ein Pflichtfeld → `err` „cfg unvollständig", kein Auftrag. Dosis: `sec = (pctSoll − ist) / lrn.eff + tDead`, begrenzt auf `tMin … tMax` |
| 2 – Gießen | liest `cfg3`; begrenzt `job.sec` nochmals auf `tMax`, prüft `maxDay` und `jobAge` |

Der SOLL-Mittelwert `pctSoll` ist damit die einzige Zahl, die die Dosis bestimmt. Untergrenze `pctLo` entscheidet nur, **ob** gegossen wird; `pctSoll` entscheidet, **wie viel**.

* * *

## 3 Hinweise zum Speicherplatz

| Eintrag | Felder | geschätzte Länge |
| --- | --- | --- |
| `cfg1` | 7 | ~110 Zeichen |
| `cfg2` | 10 | ~150 Zeichen |
| `cfg3` | 13 | ~170 Zeichen |

Alle drei bleiben deutlich unter 253 Zeichen. Zusammen mit `lrn`, `st`, `job`, `day`, `err` sind acht von fünfzig Einträgen belegt.

* * *

## 4 Offen vor dem Bau

- `pctSoll`, `pctLo`, `pctHi`, `pctDry` aus den zwei Messungen an der Pflanze
- `dropSlow` für die 48-h-Regel
- Bestätigung am Aufbau: `lvlEmpty` = 1 stimmt
