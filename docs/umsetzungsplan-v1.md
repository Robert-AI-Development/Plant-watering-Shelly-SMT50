# Bewässerungs-System – Umsetzungsplan v1 (drei Scripts)

Plan für die Aufteilung in drei Scripts, wie am 12.09.2026 vorgegeben. Baut auf Konzept v2 und Architektur v1 auf. *Vorschläge* sind gekennzeichnet; alles andere kommt aus deinen Vorgaben.

Wichtige Änderung gegenüber Architektur v1: Messen und Gießen sind jetzt getrennt. Script 1 misst alle 15 Minuten und **entscheidet nur**. Gegossen wird ausschließlich um 08:00 und 20:00 durch Script 2. Der Shelly erlaubt maximal drei Scripts – die Aufteilung nutzt das Limit genau aus.

* * *

## 0 Überblick

```
 ZEITPLAN (Shelly-Scheduler)
 ┌──────────────────────────┐   ┌──────────────────────────┐
 │ alle 15 min              │   │ 08:00 und 20:00          │
 │ :00 :15 :30 :45          │   │                          │
 └────────────┬─────────────┘   └────────────┬─────────────┘
              │ Script.Start(1)               │ Script.Start(2)
              ▼                                ▼
 ┌──────────────────────────┐   ┌──────────────────────────┐
 │ SCRIPT 1 – Main          │   │ SCRIPT 2 – Gießen        │
 │ misst Feuchte, Temp,     │   │ liest Auftrag aus KVS    │
 │ Wasserstand              │   │ prüft Freigaben          │
 │ bewertet, lernt          │   │ Pumpe EIN für n Sekunden │
 │ schreibt Auftrag ins KVS │   │ schreibt Ergebnis ins KVS│
 └────────────┬─────────────┘   └────────────┬─────────────┘
              │  KVS.Set                      │  KVS.Set / KVS.Get
              ▼                                ▼
 ┌────────────────────────────────────────────────────────┐
 │ KVS – gemeinsames Gedächtnis                            │
 │ cfg  lrn  st  job  day  err                             │
 └────────────────────────────────────────────────────────┘
              ▲
              │ legt Zeitplan an, schreibt cfg-Startwerte
 ┌──────────────────────────┐
 │ SCRIPT 0 – Installer     │  einmalig von Hand starten
 └──────────────────────────┘
```

Der Eintrag `job` ist die Schnittstelle zwischen den beiden Scripts: Script 1 schreibt hinein, Script 2 liest und führt aus.

* * *

## 1 Script 0 – Installer

Läuft einmal, von Hand aus der Web-UI gestartet. Danach deaktivieren, nicht löschen (Neuinstallation bleibt möglich).

| Schritt | Aufruf | Inhalt |
| --- | --- | --- |
| 1 | `Schedule.List` | vorhandene eigene Einträge finden und löschen (Wiederholbarkeit) |
| 2 | `Schedule.Create` | `0 */15 * * * *` → `Script.Start {id: 1}` |
| 3 | `Schedule.Create` | `0 0 8,20 * * *` → `Script.Start {id: 2}` |
| 4 | `Schedule.Create` | *Vorschlag:* `0 5 8,20 * * *` → `Switch.Set {id: 0, on: false}` – Sicherheits-Aus |
| 5 | `KVS.Set cfg` | Startwerte, nur wenn `cfg` noch nicht existiert |
| 6 | `KVS.Set st` | Zustand `beobachten`, leere Historie |
| 7 | `Script.SetConfig` | Script 1 und 2: `enable: true`, kein Autostart |
| 8 | Konsole | Zusammenfassung ausgeben, Script beendet sich |

Script-IDs sind am Gerät nachzusehen; sie hängen von der Anlege-Reihenfolge ab. *Vorschlag:* Installer sucht die IDs über `Script.List` nach Namen (`bw_main`, `bw_pump`) statt sie fest einzutragen.

Startwerte für `cfg` (aus deinen Angaben, Rest als *Vorschlag* markiert):

| Feld | Wert | Herkunft |
| --- | --- | --- |
| `vDry` | 0,20 V | gemessen |
| `vWet` | 3,13 V | gemessen |
| `tDead` | 20 s | Leitungen füllen |
| `tMin` | 40 s | kleinste Gabe |
| `tStd` | 70 s | Standardgabe (60–80 s) |
| `tMax` | 120 s | *Vorschlag*, unter Sicherheits-Aus-Versatz |
| `tHot` | 35 °C | Schwelle für zwei Gaben am Tag |
| `pause` | 24 h | Normalfall |
| `pauseSlow` | 48 h | bei geringer Abnahme |
| `dropSlow` | *offen* | Feuchteabnahme je 24 h, unter der 48 h gelten |
| `lo` / `mid` / `hi` | *offen* | Zielband, aus den zwei Messungen an der Pflanze |

* * *

## 2 Script 1 – Main (alle 15 Minuten)

Einmal-Läufer: lebt wenige Sekunden, hält nichts im Arbeitsspeicher.

```
 Start
  ├─ 1 KVS lesen: cfg, lrn, st, job, day
  ├─ 2 Feuchte messen
  │     Voltmeter mehrfach lesen → Mittelwert der mittleren Werte
  │     % = (V − vDry) / (vWet − vDry) × 100, begrenzt 0…100
  │     V < 0,1 oder V > 3,35 → err "sensor", Ende
  ├─ 3 Temperatur messen
  │     aktuell + gleitendes Tagesmaximum + Langzeitmittel
  ├─ 4 Wasserstand lesen
  │     mehrfach über 2 s, stabil → leer / voll
  ├─ 5 Bewerten
  │     a) Lernen: lag die letzte Gabe 30 min zurück und ist unbewertet
  │        → Wirkung je wirksame Sekunde (t − tDead) berechnen
  │        → lrn.eff = 0,7 × alt + 0,3 × neu
  │        → keine Wirkung → err "keine_wirkung", kein Lernwert
  │     b) Austrocknungsrate: %-Abnahme je Stunde seit letzter Gabe
  │     c) Trockenphase erfüllt? (Feuchte war unter Schwelle)
  │     d) Pause bestimmen:
  │           Tagesmax > tHot → 12 h
  │           Abnahme in 24 h < dropSlow → 48 h
  │           sonst → 24 h
  ├─ 6 Auftrag schreiben (job)
  │     Bedarf = Feuchte < lo  UND Pause abgelaufen  UND Trockenphase
  │              UND Wasser vorhanden  UND keine Störung
  │     Sekunden = (mid − ist) / lrn.eff + tDead
  │                begrenzt auf tMin … tMax; unter tMin → kein Auftrag
  │     job = { ok: true/false, sec: n, why: "...", ts: jetzt }
  ├─ 7 KVS schreiben – nur was sich geändert hat
  └─ Ende
```

Script 1 rührt die Pumpe nie an. Es darf jederzeit abstürzen, der nächste Takt beginnt sauber.

Der Auftrag wird bei jedem Takt neu geschrieben. Damit gilt um 08:00 immer die Entscheidung von 07:45, nicht eine veraltete von gestern.

* * *

## 3 Script 2 – Gießen (08:00 und 20:00)

```
 Start
  ├─ 1 KVS lesen: cfg, job, st, day
  ├─ 2 Auftrag prüfen
  │     job.ok = false          → Ende, nichts tun
  │     job.ts älter als 20 min → Ende, err "auftrag_alt"
  │     day.n ≥ 2               → Ende, Tageslimit
  ├─ 3 Wasserstand nochmals lesen
  │     leer → Ende, err "wasser_leer"
  ├─ 4 Pumpe EIN
  │     Switch.Set {id: 0, on: true, toggle_after: job.sec}
  │     sec zusätzlich auf tMax begrenzen
  ├─ 5 Warten sec + 2 s, dabei alle 5 s Wasserstand prüfen
  │     leer → Switch.Set off, Ergebnis "abgebrochen"
  ├─ 6 Ergebnis schreiben
  │     st = { zustand: "gegossen", ts, sec, pctVor: job.pct, bewertet: false }
  │     day.n + 1, day.sec + sec
  │     job.ok = false  (Auftrag verbraucht)
  └─ Ende
```

Script 2 lebt maximal rund zwei Minuten. Die Abschaltzeit im Einschaltbefehl schaltet die Pumpe auch dann ab, wenn das Script mittendrin abstürzt. Der Sicherheits-Aus um 08:05 / 20:05 ist die zweite Sicherung.

* * *

## 4 KVS-Vertrag zwischen den Scripts

| Schlüssel | Schreibt | Liest | Inhalt (kurze Feldnamen, < 253 Zeichen) |
| --- | --- | --- | --- |
| `cfg` | Installer, du von Hand | 1, 2 | Kalibrierung, Zielband, Zeiten, Grenzen |
| `lrn` | 1 | 1 | `eff` (% je Sekunde), `rate` (% je h), `tMean`, `tMax24` |
| `st` | 1, 2 | 1, 2 | Zustand, letzte Gabe, Feuchte davor/danach, bewertet, Trockenphase |
| `job` | 1 | 2 | `ok`, `sec`, `pct`, `why`, `ts` |
| `day` | 2, Tageswechsel | 1, 2 | `n` Gaben, `sec` Summe, `date` |
| `err` | 1, 2 | du in der Web-UI | letzter Fehler, Zeitpunkt, Speicherverbrauch |

Der Tageswechsel wird ohne eigenen Zeitplan-Eintrag gelöst: Script 1 vergleicht `day.date` mit dem heutigen Datum und setzt bei Abweichung zurück. *Vorschlag*, spart einen Eintrag und ein Script.

* * *

## 5 Wie die Pausenregel im Zwei-Fenster-Betrieb wirkt

| Regel | Wirkung auf die Fenster |
| --- | --- |
| Pause 12 h (über 35 °C) | 08:00 und 20:00 können beide gießen |
| Pause 24 h | nur eines der beiden Fenster, das erste nach Ablauf |
| Pause 48 h | ein Fenster, dann ein voller Tag Pause |

Weil Script 1 alle 15 Minuten neu entscheidet, kann es auch um 07:45 noch „nein" sagen, obwohl die Erde gestern Abend trocken aussah – etwa weil Regen oder Kondenswasser die Feuchte angehoben hat.

* * *

## 6 Bauetappen mit Prüfschritt

| Etappe | Inhalt | Prüfung |
| --- | --- | --- |
| A | Installer: Zeitplan, cfg, st anlegen | `Schedule.List` zeigt drei Einträge, KVS zeigt cfg |
| B | Script 1: nur messen und in die Konsole schreiben | 4 Takte lang plausible Feuchte-% und Temperatur |
| C | Script 1: Plausibilität, Wasserstand, job schreiben (ok immer false) | `KVS.Get job` zeigt aktuellen Auftrag mit Begründung |
| D | Script 2: Auftrag lesen, Pumpe mit fester Zeit 70 s | Hand-Auftrag per KVS setzen, 20:00 abwarten, Pumpe läuft 70 s, Abschaltzeit greift |
| E | Script 1: Bewertung, Lernwert, Pausenregel, Trockenphase | Nach einer Gabe: lrn.eff plausibel, kein zweiter Auftrag vor Pause |
| F | Sicherheits-Aus, Tageslimit, Störfälle durchspielen | Wasser abziehen, Sensor abstecken – jeweils err gesetzt, keine Pumpe |

* * *

## 7 Offen vor dem Bau

- Zielband `lo` / `mid` / `hi` aus den zwei Messungen an der Pflanze
- Schwelle `dropSlow` für die 48-h-Regel
- Bestätigung am Aufbau: Eingang 1 = 1 bedeutet leer
- Höchstdauer `tMax` 120 s in Ordnung?
