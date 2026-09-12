# Bewässerungs-System – Tool-Stack & Architektur v1

Kompakte Beschreibung, wie das System am Shelly Plus Uni aufgebaut wird. Grundlage: Konzept v2 und die Antworten aus dem Interview vom 12.09.2026. Neue Entscheidungen aus dem Interview sind in Abschnitt 5 gesammelt. *Vorschläge* sind gekennzeichnet.

* * *

## 1 Tool-Stack

Alles läuft am Gerät. Kein Backend, kein Broker, kein externes Werkzeug in Stufe 1.

| Baustein | Was | Wofür |
| --- | --- | --- |
| Shelly Plus Uni, Firmware 2.0.0 | Steuergerät | Messen, Rechnen, Schalten |
| Zeitplan (Schedule) | eingebaute Zeitsteuerung | Taktgeber und Sicherheits-Aus – die stabile Schicht |
| Script (mJS) | ein Einmal-Läufer | Messen, Entscheiden, Lernen – lebt nur Sekunden |
| Gerätespeicher (KVS) | 50 Einträge à 253 Zeichen | Zustand, Lernwerte, Einstellungen, Störungen |
| Shelly Web-UI | Editor, Konsole, Zeitplan-Pflege | einziges Entwicklungs- und Bedienwerkzeug |
| Relais (vorhanden) | Leistungsschalter | Ausgang 0 schaltet Relais, Relais schaltet Pumpe |

Eingänge: SMT50 am Analogeingang (0,2 V trocken … 3,13 V nass), DS18B20 am Ein-Draht-Bus, Wasserstand am digitalen Eingang 1.

* * *

## 2 Architektur-Übersicht

```
                     SHELLY PLUS UNI
 ┌──────────────────────────────────────────────────────────┐
 │                                                          │
 │   ZEITPLAN (stabil, läuft immer)                         │
 │   ┌────────────────┐  ┌────────────────┐  ┌───────────┐  │
 │   │ Arbeitstakt    │  │ Sicherheits-Aus│  │Tageswechsel│ │
 │   │ alle 10 min    │  │ alle 10 min +3 │  │ 1x täglich │ │
 │   │ :00 :10 :20 …  │  │ :03 :13 :23 …  │  │            │ │
 │   └───────┬────────┘  └───────┬────────┘  └─────┬─────┘  │
 │           │ startet           │ Ausgang 0 AUS   │ Zähler │
 │           ▼                   │ (ohne Logik)    │ = 0    │
 │   ┌────────────────┐          │                 │        │
 │   │ SCRIPT         │          │                 │        │
 │   │ Einmal-Läufer  │◄─────────┼─────────────────┘        │
 │   │ messen →       │          │                          │
 │   │ entscheiden →  │          │                          │
 │   │ schalten →     │          │                          │
 │   │ Ende           │          │                          │
 │   └──┬─────────┬───┘          │                          │
 │      │ liest/  │ schaltet     │                          │
 │      │ schreibt│ mit Abschalt-│                          │
 │      ▼         │ zeit         ▼                          │
 │   ┌────────┐   │        ┌──────────┐                     │
 │   │  KVS   │   └───────►│ Ausgang 0│                     │
 │   │ 5 Ein- │            └────┬─────┘                     │
 │   │ träge  │                 │                           │
 │   └────────┘                 │                           │
 └──────────────────────────────┼───────────────────────────┘
        ▲        ▲        ▲     │
        │        │        │     ▼
   ┌────┴───┐ ┌──┴────┐ ┌─┴─────┐  ┌───────┐   ┌───────┐
   │ SMT50  │ │DS18B20│ │Wasser-│  │Relais │──►│ Pumpe │
   │ Erde   │ │Umgebg.│ │stand  │  └───────┘   └───────┘
   └────────┘ └───────┘ └───────┘
```

Lesart: Der Zeitplan ist der Motor, das Script ist der Kopf, der Speicher ist das Gedächtnis. Fällt das Script aus, läuft der Motor weiter und der Sicherheits-Aus greift trotzdem.

* * *

## 3 Ein Arbeitstakt (alle 10 Minuten)

```
 Zeitplan ──► Script startet
                 │
                 ├─ 1  KVS lesen: Einstellungen, Lernwerte, Zustand, Zähler
                 ├─ 2  Feuchte messen  (mehrfach, Mittelwert der Mitte, Plausibilität)
                 ├─ 3  Temperatur messen (aktuell + Langzeitmittel)
                 ├─ 4  Wasserstand prüfen (mehrfach, muss stabil sein)
                 ├─ 5  Zustandsmaschine entscheiden
                 │        Beobachten → Gegossen → Einsickern → Sperre → Beobachten
                 │                                    └──► Störung
                 ├─ 6  ggf. Ausgang 0 EIN mit Abschaltzeit (max. Gabe)
                 ├─ 7  KVS schreiben – nur bei Zustandswechsel
                 │
                 └─ Script beendet sich          Dauer: wenige Sekunden

 :03  Zeitplan ──► Ausgang 0 AUS  (bedingungslos, Sicherheitsnetz)
```

Dreifache Abschaltung der Pumpe bleibt wie in v2: Abschaltzeit im Einschaltbefehl, automatische Abschaltung in der Gerätekonfiguration, Sicherheits-Aus im Zeitplan.

* * *

## 4 Datenhaltung im Gerätespeicher

| Schlüssel | Inhalt | Geschrieben |
| --- | --- | --- |
| `cfg` | Kalibrierpunkte 0,2 V / 3,13 V, Zielband, Grenzen, Pausen | nur bei Änderung |
| `lrn` | Feuchte-% je Pumpensekunde, Sicherheitsfaktor, Austrocknungsrate, Temperaturmittel | nach bewerteter Gabe |
| `st` | Zustand, Zeitpunkt letzte Gabe, Sekunden, Feuchte davor/danach, Trockenphase erfüllt | bei Zustandswechsel |
| `day` | Summe Sekunden, Anzahl Gaben heute | bei Gabe und Tageswechsel |
| `err` | letzte Störung, Zeitpunkt, Speicherverbrauch | bei Änderung |

Störungen werden nur hier abgelegt und in der Web-UI gelesen. Es gibt keinen aktiven Meldeweg.

* * *

## 5 Entscheidungen aus dem Interview

| Thema | Entscheidung | Folge für den Bau |
| --- | --- | --- |
| Zeitsteuerung | ausschließlich interner Shelly-Zeitplan | kein Notbetrieb im Script; nach Stromausfall ohne Internet pausiert das System, bis die Uhrzeit wieder da ist |
| Werkzeug | nur Shelly Web-UI | Script als eine Datei, kommentiert, Versionsnummer im Kopf; Sicherung durch Kopie des Quelltexts |
| Sichtbarkeit | nur am Gerät (KVS + Konsole) | kein Webhook, kein MQTT in Stufe 1 |
| Störmeldung | nur KVS | Eintrag `err`, Ausgang 1 bleibt frei |
| Takt | 10 Minuten | Sicherheits-Aus 3 Minuten versetzt; Einsickerzeit 30 Minuten = 3 Takte |
| Trockenpunkt | 0,2 V | Skala ist vollständig: 0,2 V = 0 %, 3,13 V = 100 % |
| Pumpe | unter 20 s kommt kein Wasser an; Gabe mindestens 40 s; 60–80 s ist der bewährte Schnitt | siehe 6.1 |
| Mindestpause | über 35 °C: früh und abends; sonst 24 h; bei geringer Abnahme 48 h | siehe 6.2 |

* * *

## 6 Was sich dadurch am Regelungskern ändert

### 6.1 Dosierung mit Totzeit

Die ersten rund 20 Sekunden füllen nur die Leitungen. *Vorschlag:*

- Totzeit 20 s wird beim Lernen abgezogen: wirksame Sekunden = Laufzeit − 20.
- Kleinste Gabe 40 s, Standardgabe 60–80 s, Höchstdauer je Gabe 120 s (*Vorschlag*, muss unter dem 3-Minuten-Versatz bleiben).
- Portionen unter 40 s gibt es nicht. Reicht der berechnete Bedarf nicht für 40 s, wird auf den nächsten Takt gewartet statt kurz gepumpt.
- Startwert des Lernwerts wird aus der ersten Standardgabe (70 s) gemessen, nicht geschätzt.

### 6.2 Mindestpause nach Temperatur und Austrocknung

*Vorschlag* für die Sperre-Logik:

```
 Tagesmaximum > 35 °C  ──►  Pause 12 h, Gießen nur im Fenster früh / abends
 sonst                 ──►  Pause 24 h
 Feuchte nimmt in 24 h nur wenig ab  ──►  Pause 48 h (Staunässe-Verdacht bleibt)
```

Die Fensterzeiten (früh, abends) sind noch festzulegen.

* * *

## 7 Restrisiko und offene Punkte

- **Uhrzeit:** Der Zeitplan braucht eine gültige Uhrzeit. Solange das Gerät durchläuft, hält es die Zeit auch bei Internetausfall. Nur nach Stromausfall *und* fehlendem Internet steht der Takt, bis das Netz zurück ist. Bewusst akzeptiert.
- **Uhrzeitfenster** für heiße Tage: konkrete Stunden fehlen.
- **Schwelle „wenig Abnahme"** für die 48-h-Regel: Feuchteprozent je 24 h noch festlegen.
- **Zielband** aus zwei Messungen an der echten Pflanze (Konzept v2, 4.2) steht noch aus.
- Aus v2 weiterhin offen: Fragen 2, 3, 4, 5, 7, 8, 10, 13.

* * *

## 8 Bau in Etappen

1. **A** – Zeitplan anlegen, Script liest nur Sensoren und schreibt Konsole
2. **B** – Sicherheiten: Plausibilität, Wasserstand, Sicherheits-Aus, Abschaltzeit
3. **C** – Regelung mit festen Werten: 70 s Standardgabe, 24 h Pause
4. **D** – Lernen, Totzeit, Temperaturregel, Staunässe-Schutz
5. **E** – später: Stufe 2, Historie an das Backend
