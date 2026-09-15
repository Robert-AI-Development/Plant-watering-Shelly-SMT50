# 17 · Etappen- und Entscheidungslog

**Deutsch** · [English](../en/17-etappen-und-entscheidungslog.md) — [Handbuch](README.md) · Teil F „Entwicklung“

> **Auf einen Blick**
> - Dieses Kapitel ist der Nachfolger von `docs/PLAN.md`: zwölf Etappen (0–11), die nummerierten Entscheidungen 1–63 (Stand 15.09.2026), die Nachträge vom Gerät und die offenen Punkte. Vergebene Nummern bleiben stabil – eine abgelöste Entscheidung bleibt stehen und nennt ihren Nachfolger.
> - Eintragen: eine neue Entscheidung bekommt die nächste freie Nummer (Stand 15.09.2026: 64), Datum, Thema, die Entscheidung mit ihrem Grund und einen Verweis (Kapitel, Datei, Test). Eine neue Etappe bekommt einen eigenen Abschnitt mit Datum, Ergebnis (Versionen) und Prüfung (Tests mit Zahl und Datum, Gerätelauf mit Datum).
> - Stand: Projektversion <!-- fact:project.version -->0.2.0<!-- /fact -->, <!-- fact:tests -->146<!-- /fact --> Tests (13.09.2026), letzter Gerätelauf 13.09.2026.
> - Größter Stolperstein: Zahlen ohne Datum und Versionen aus der Planung statt aus der Datei. Der alte Plan nannte `bw_install` 0.2.0 und `hwtest.js` 0.2.0 – gebaut sind <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> und <!-- fact:ver.hwtest -->0.1.2<!-- /fact -->. Messwerte gehören ins Prüfprotokoll ([19](19-pruefprotokoll.md)), Ursachen ins Lernlog ([18](18-lernlog-geraet.md)); hier steht nur der Verweis.

## Voraussetzungen

- keine – ein Nachschlagekapitel. Das Warum hinter den Entscheidungen erklärt [16 · Konzept und Entscheidungen](16-konzept-und-entscheidungen.md) im Zusammenhang; die Begriffe (`cfg1..4`, `job`, `st`, Fenster, Takt) erklären [01 · Gesamtarchitektur](01-gesamtarchitektur.md) und [03 · Konfiguration](03-konfiguration.md).

## Diagramm

[![Lebenszyklus: Etappen 0–1, 2–5, 6–7, 8–9 und 10 auf dem Hauptpfad; darunter die Gerätetests vom 12.09. (Hoisting, Rekursion, Editor) und 13.09. (shift, Heap, PUMP_SEC, Messlauf); unten die offenen Punkte und Etappe 11 Doku-Neufassung](../diagramme/de/17-etappen-und-entscheidungslog.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/17-etappen-und-entscheidungslog.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/17-etappen-und-entscheidungslog.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Ohne Gerät gebaut“, 2 „Am Gerät gelernt“, 3 „Offen und weiter“.

## So wird eingetragen

Das Log hat drei Sorten von Einträgen. Jede Sorte hat einen festen Platz und eine feste Form, damit Verweise aus Code, Tests und anderen Kapiteln (zum Beispiel „Entscheidung 13“ in `tools/lib/kal.js` oder „Entscheidung 12“ in `bw_install.js`, Switch-Konfiguration) auf Dauer stimmen:

1. **Entscheidung:** neue Zeile am Ende der Entscheidungstabelle (Abschnitt „Entscheidungen“) mit der nächsten freien Nummer, dem Datum, dem Thema, der Entscheidung samt Grund und der Spalte „Kapitel“. Nie eine Nummer neu vergeben, nie eine Zeile löschen. Wird eine Entscheidung abgelöst, bleibt sie stehen und bekommt den Zusatz „abgelöst durch N“ (so wie 7 → 46, 30/34 → 55).
2. **Etappe:** neuer Abschnitt unter „Etappen“ mit Datum, Ziel in zwei Sätzen und der Tabelle Aufgabe | Ergebnis | Prüfung. In „Ergebnis“ stehen die gebauten Versionen (aus Zeile 1 der Datei, nicht aus dem Plan), in „Prüfung“ die Mock-Tests mit Zahl und Datum und der Gerätelauf mit Datum; was noch nicht am Gerät lief, heißt `[TODO am Gerät]`.
3. **Nachtrag:** was ein Lauf im Mock oder am Gerät an einer Etappe geändert hat, chronologisch unter „Nachträge“. Die Ursache einer Überraschung steht ausführlich im Lernlog ([18](18-lernlog-geraet.md)), die Messwerte im Prüfprotokoll ([19](19-pruefprotokoll.md)) – hier nur ein Satz und der Verweis.

Vorlage für die nächste Zeile der Entscheidungstabelle:

```text
| 64 | TT.MM.JJJJ | Thema in drei Worten | Was entschieden wurde – und warum; Alternative, falls verworfen. Verweis: Datei, Test, Kapitel | NN |
```

Jede Zahl im Log braucht eine Quelle: Startwerte aus `DEF` in `bw_install.js` bzw. `ZR3`/`ZR4` in `bw_zeitraffer.js`, Grenzen aus `tools/build.js` und `tools/mock/shelly-mock.js`, Testzahlen aus `npm test` mit Datum, Messwerte aus dem Prüfprotokoll mit Datum. Zahlen, die sich ändern können, tragen einen Fakt-Marker (`fact:tests`, `fact:ver.*`, `def:*`), den `tools/check-docs.js` gegen die Scripts prüft.

## Etappen

| Etappe | Datum | Inhalt | Ergebnis | Prüfung |
| --- | --- | --- | --- | --- |
| 0 | 12.09.2026 | Repository, Konzeptdokumente, `lib_notes.md`, README-Gerüst, Mock | `tools/mock/shelly-mock.js`, `npm test` | Tests laufen ohne Gerät |
| 1 | 12.09.2026 | Installer | `bw_install.js` v0.1.0 | Mock; Gerät 12.09. (nach den Fixes v0.1.1) |
| 2–3 | 12.09.2026 | `bw_main` messen, dann entscheiden | `bw_main.js` v0.1.0 | Mock |
| 4 | 12.09.2026 | `bw_pump` | `bw_pump.js` v0.1.0 | Mock |
| 5 | 12.09.2026 | Lernen und Schutz | `lrn`, `err.mem` | 53 Tests (12.09.), 7-Tage-Simulation |
| 6 | 12.09.2026 | Sicherheit und Störfälle | Prüfprotokoll-Vorlage | am Gerät teilweise offen ([19](19-pruefprotokoll.md)) |
| 7 | 12.09.2026 | README; erster Gerätelauf | README v0.1.0; Scripts v0.1.1; `put-script.js`, `console.js` | Gerät 12.09.: Engine-Fixes; 58 Tests (12.09.) |
| 8 | 13.09.2026 | Hardware-Test | `bw_hwtest.js`, `bw_hwpump.js` v0.1.0, `hwtest.js` v0.1.0 | 89 Tests (13.09.); Gerät 13.09. |
| 9 | 13.09.2026 | Zeitraffer, Takt aus `cfg3`, Geräte-Doku | `bw_zeitraffer.js` v0.1.0, `bw_main`/`bw_install` v0.1.2, `build.js` v0.1.1, `verify-scripts.js` | 102 Tests (13.09.); Gerät 13.09. |
| 10 | 13.09.2026 | Regelkreis im Gießfenster, `cfg4`, Wochen-Trockenphase, Kalibrierlauf | `bw_pump`/`bw_main`/`bw_zeitraffer` v0.2.0, `bw_install` v0.1.3, `hwtest.js` v0.1.2, `kal.js` | 144 Tests (13.09.); Gerät 13.09.: Fenster 1 |
| 11 | 13.–16.09.2026 | Doku-Neufassung: Handbuch DE/EN, Diagramme, Doku-Prüfung, Landingpage, Stubs | `docs/de`, `docs/en`, `tools/check-docs.js`, `tools/docs/` | <!-- fact:tests -->146<!-- /fact --> Tests (13.09.) |

Die Etappen 0–5 wurden in einer Sitzung ohne Gerät gebaut und gegen den Mock geprüft; die Spalte „Prüfung“ der Tabellen unten nennt den Prüfschritt am Gerät, den der Projektleiter ausführt. Alle Testzahlen sind der Stand von `npm test` am genannten Tag.

### Etappe 0 – Repository und Grundgerüst

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Repo anlegen, public, MIT | Ordnerstruktur wie im Onboarding-Prompt | `git log` zeigt den ersten Commit (12.09.2026) |
| Konzeptdokumente nach `docs/` | fünf Dateien (heute in [16](16-konzept-und-entscheidungen.md) aufgegangen) | Claude Code fasst sie zusammen |
| `scripts/lib_notes.md` | jeder genutzte RPC mit Doku-Link: `Schedule.List/Create/Delete`, `Script.List/Start/Stop/SetConfig`, `KVS.Get/Set/GetMany`, `Voltmeter.GetStatus`, `Temperature.GetStatus`, `Input.GetStatus`, `Switch.Set`, `Sys.GetStatus` (heute [20](20-rpc-referenz.md)) | jeder Aufruf gegen die Doku geprüft |
| README-Gerüst | alle Überschriften, noch leer | Struktur abgenommen |
| Testhelfer (Entscheidung 4) | `tools/mock/shelly-mock.js`, `npm test` | Tests laufen ohne Gerät |

### Etappe 1 – Installer (`bw_install.js`)

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Script-IDs über Namen finden | `findScriptId(name)` – die IDs vergibt das Gerät | Konsole zeigt die IDs |
| Alte eigene Zeitplan-Einträge löschen | wiederholbar | zweimal starten → keine Duplikate |
| Drei Zeitplan-Einträge anlegen | v0.1.0: `0 */15 * * * *`, `0 0 8,20 * * *`, `0 5 8,20 * * *`; seit v0.1.2 Pumpe bei Sekunde 30 (`30 0 8,20`), seit v0.1.3 (Projekt 0.2.0) Sicherheits-Aus `0 8 8,20` (Entscheidungen 37, 54) | `Schedule.List` in der Web-UI |
| `cfg1/cfg2/cfg3` nur, wenn nicht vorhanden | Startwerte aus dem Katalog (heute `DEF`, [03](03-konfiguration.md)) | KVS-Ansicht zeigt die Einträge |
| `st`, `day`, `err`, `lrn`, `job` initialisieren | leere Startzustände | KVS-Ansicht |
| Switch-Konfiguration (Entscheidung 12) | `initial_state off`, `auto_off` = `tMax` + 10 s | Switch-Einstellungen in der Web-UI |
| Selbstbeendigung | `Script.Stop` auf die eigene ID | Script steht nach dem Lauf |

### Etappe 2 – `bw_main` nur messen (Stufe 1)

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| `cfg1–3` lesen, Pflichtfelder prüfen | fehlt eines → `err cfg`, Ende | Feld löschen → `err` erscheint |
| Feuchte messen, umrechnen, filtern | `stepSample()`/`evalSamples()` (Mittel ohne Ausreißer, `midMean`) | vier Takte lang plausible Prozentwerte |
| Temperatur, Wasserstand lesen | in `stepSample()` (Wasserstand `nLvl` Proben, Fühler einmal in `evalSamples()`) | Konsole zeigt Werte |
| Plausibilität | `err sensor` bei Spannung außerhalb `vErrLo..vErrHi` | Sensor abstecken → `err` |
| Tageswechsel per Datum | `day` zurückgesetzt | Datum im KVS ändern → Reset |
| Selbstbeendigung, Laufzeit < 5 s | – | Konsole zeigt die Dauer |

### Etappe 3 – `bw_main` entscheidet (Stufe 2)

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Freigabekette | Bedarfslogik mit Begründung in `job.why` | jede Bedingung einzeln provozieren |
| Dosis mit `tDead`, `tMin`, `tMax`, `pctSoll` | Dosis in `stepEval()` (v0.1.0: unter `tMin` kein Auftrag, `why=tmin`; seit 0.2.0 Klemme, Entscheidung 38) | Handwerte im KVS → erwartete Sekunden |
| Pausenregel dreistufig | Pause in `stepEval()` (`pause`, `pauseHot`, `pauseSlow`) | Tagesmaximum und `dropSlow` variieren |
| Trockenphase | `st.dryOk` (seit 0.2.0 Wochen-Trockenphase, Entscheidung 58) | Verlauf simulieren |
| `job` nur bei Änderung schreiben (Entscheidung 11) | – | `Sys.GetStatus` → `kvs_rev` vorher/nachher vergleichen |

### Etappe 4 – Pumpe (`bw_pump.js`)

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| `job` lesen, Alter, Tageslimit prüfen | Abbruchgründe in `err` | alten Auftrag setzen → kein Gießen |
| Wasserstand vor und während der Gabe | Abbruch bei LEER | Sensor während des Laufs ziehen |
| `Switch.Set` mit `toggle_after` | Pumpe läuft genau `sec` Sekunden | Stoppuhr, Relais hörbar |
| Ergebnis in `st`, `day`; `job` verbrauchen | – | KVS nach dem Lauf |
| Erste Gabe mit `tStd` | 70 s | Handauftrag ohne Lernwert |

### Etappe 5 – Lernen und Schutz

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Bewertung 30 min nach der Gabe | `rateGift()` in `bw_main` v0.1.x (seit 0.2.0 lernt `bw_pump` im Fenster, `bw_main` kontrolliert nur noch mit `control()`, Entscheidung 38) | `lrn.eff` nach einer echten Gabe plausibel (heute `lrn.effW`) |
| Keine Wirkung → `err`, kein Lernwert | `noeff` (seit 0.2.0 nur aus `bw_pump`, Entscheidung 46) | Schlauch abziehen → `err`, kein zweiter Auftrag |
| Austrocknungsrate, Staunässe-Verdacht | `lrn.rate` | mehrere Tage Verlauf |
| Speicherverbrauch protokollieren | `err.mem` | Wert stabil über Tage |

### Etappe 6 – Sicherheit und Störfälle durchspielen

Sicherheits-Aus greift auch bei abgestürztem `bw_pump` · Ausgang nach Neustart aus · Tageslimit · Uhrzeit ungültig nach Stromausfall ohne Internet (System pausiert, kein Fehlverhalten) · alle `err`-Codes einmal ausgelöst und erklärt. Vorlage: das Prüfprotokoll ([19](19-pruefprotokoll.md)); die Zeilen 1, 5–7, 9–13, 15, 16 und 18–20 sind am Gerät noch offen (12, 13 und 18 deckt der Mock ab).

### Etappe 7 – README fertigstellen, erster Gerätelauf

Stückliste mit Bezugsquellen, Verdrahtung mit Bild, Kalibrieranleitung, Installationsschritte in der Web-UI, Konfigurationstabelle aus dem Katalog, Betriebsanleitung, Störungstabelle, Sicherheitshinweise, Funktionsbeschreibung, Grenzen. Abnahme: eine unbeteiligte Person baut nach der Doku nach – ohne Rückfrage.

Am Abend des 12.09.2026 liefen die Scripts erstmals am Gerät (Firmware 2.0.0). Drei Engine-Überraschungen (kein Hoisting, Stacktiefe, Editor verliert das Dateiende) führten zu den Entscheidungen 13–20, den Scripts v0.1.1 und den Werkzeugen `put-script.js` und `console.js`; danach 58 Tests (12.09.2026). Details: „Nachträge“ unten und [18 · Lernlog](18-lernlog-geraet.md).

### Etappe 8 – Hardware-Test (`bw_hwtest.js`, `bw_hwpump.js`, `tools/hwtest.js`)

Zwei Test-Scripts prüfen die Hardware phasenweise mit dem Menschen am Aufbau (Interview über Claude Code): Fühler ≤ 20 °C und ≥ 30 °C, Sensor trocken und im Wasser (Kalibrierpunkte automatisch nach `cfg1`), Schwimmer LEER und VOLL (`lvlEmpty`), Pumpe über den echten `bw_pump`-Pfad (Auftrag im KVS, `Script.Start`, Sicherung und Rückbau der Zustände). Vorher im Mock simuliert (`tools/mock/hwdemo.js`, `--hwdemo`), am Gerät über den Tunnel gefahren. Ablauf heute: [11 · Hardware-Check](11-hardware-check.md).

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Sensorphasen mit Kommandokanal `hwc`, Stand `hwr`, Schwellen `hwt` | `bw_hwtest.js` v0.1.0 | 12 Tests; Gerät 13.09.2026: alle Phasen ok, `vDry` 0,296 V, `vWet` 3,134 V, `lvlEmpty` 1 |
| Pumpentest über `bw_pump` mit Sicherung/Rückbau | `bw_hwpump.js` v0.1.0 (zwei Durchgänge, Entscheidung 28) | 15 Tests; Gerät 13.09.2026: 30 s gepumpt, KVS byteidentisch zurückgebaut |
| Mock: zweites Script per `Script.Start`, Input-Konfiguration, Laufgeneration | `shelly-mock.js` v0.1.2 | bestehende 58 Tests unverändert grün |
| Steuerung vom VPS | `tools/hwtest.js` v0.1.0 | Gerätelauf komplett über das Werkzeug geführt; 89 Tests (13.09.2026) |

### Etappe 9 – Praxistest im Zeitraffer (`bw_zeitraffer.js`, Takt und Fenster aus `cfg3`, Geräte-Doku)

Der erste Praxistest sollte in 30 Minuten durchlaufen: dieselben Betriebs-Scripts, nur mit kurzen Zeiten. Takt und Gießfenster wanderten aus dem Code in `cfg3` (`tick`, `winEvery`), ein neues Script sichert die Betriebswerte und schreibt das Profil, `bw_install` baut den Zeitplan und stellt später das Original wieder her. Dazu blieb in jedem Script am Gerät ein kurzer Doku-Block stehen (`//!`-Zeilen), und `tools/verify-scripts.js` prüft den Code am Gerät Byte für Byte.

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Takt/Fenster konfigurierbar (`cfg3.tick`, `cfg3.winEvery`), Installer ergänzt fehlende Felder | `bw_main.js` v0.1.2, `bw_install.js` v0.1.2 | 3 Tests main, 2 Tests install; bestehende Tests unverändert grün |
| Zeitraffer-Profil, Sicherung `zrb1..3`, Marke `zr`, Rückkehr über `bw_install` | `bw_zeitraffer.js` v0.1.0 (Profil damals Takt 1 min / Fenster 2 min / Gabe 5 s, Entscheidung 30) | 6 Tests inkl. 30-Minuten-Fahrplan im Mock (`zeitraffer.test.js`) |
| Geräte-Doku in `dist/`, Größengrenze 16 000 B, byteidentische Upload-Prüfung | `tools/build.js` v0.1.1, `size.test.js`, `tools/verify-scripts.js`, `put-script.js` v0.1.1 | 6 Größentests; Gerät: `verify-scripts` alle OK |
| Mock: sekundengenauer Zeitplan, laufende Scripts werden nicht neu gestartet | `shelly-mock.js` v0.1.3 | 7-Tage-Simulation unverändert |
| Steuerung vom VPS: `zeitraffer`, `normal`, sicherer Moment, Statuszeile mit Speicher | `tools/hwtest.js` v0.1.1 | Gerätelauf 13.09.2026, zwei Runden ([19](19-pruefprotokoll.md)); 102 Tests (13.09.2026) |

### Etappe 10 – Regelkreis im Gießfenster (`bw_pump` v0.2.0, `bw_main` v0.2.0, `cfg4`, Wochen-Trockenphase, Kalibrierlauf)

Bis 0.1.x goss `bw_pump` je Fenster genau eine Dosis, `bw_main` bewertete 30 min später, und eine zu kleine oder zu große Gabe wurde frühestens am nächsten Tag korrigiert. Beobachtung am Aufbau (13.09.2026, SMT50 mittig unter zwei Gardena-Tropfern): sehr trockene Erde sprang nach einer Gabe oft nur auf 20 %, über 60 % war zu viel; 5 s Pumpen hoben die Feuchte von 0 auf 36 bzw. 54 %.

Seit 0.2.0 schließt sich der Regelkreis im Fenster: Frischmessung → Portion → einsickern → messen bis stabil → unter dem Zielband weitere Portion, im Band fertig, darüber „zu viel“ für morgen merken. `bw_pump` ist der Regler des Fensters und lernt `lrn.effW`/`sf`; `bw_main` behält Takt, Auftrag, Pause, Tageslimit und die 30-min-Kontrolle. Beide bleiben Einmal-Läufer im Zeitplan und laufen nie gleichzeitig. Dazu kamen ein Messlauf am Aufbau vor der Umsetzung (Schritt 0), eine Wochen-Trockenphase und ein Kalibrierlauf als Werkzeug ohne Gerätecode.

Design, Formeln und Randfälle: Entscheidungen 38–63 und die Nachträge vom 13.09.2026; Herleitung in [16](16-konzept-und-entscheidungen.md), Ablauf im Fenster in [02](02-flussdiagramm.md). Reihenfolge der Umsetzung: Messlauf → Doku → Mock → Installer/Zeitraffer → `bw_pump` → `bw_main` → Szenario → Werkzeuge → Doku → Gerät.

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Messlauf-Werkzeug (Schritt 0): `n` Pulse ≤ 10 s mit 90 s Abstand, Voltmeter alle 2 s per RPC; je Puls `pct` vorher, `tRise`, Peak, Ruhewert, Zeit bis stabil, Gewinn %/s; Vorschläge für `effMax`, `tPmin`, `tMin`, `tDead/tDead2`, `tSoak`, `tStab`; Rohdaten `docs/kal/<datum>-mess.json` | `tools/hwtest.js mess [sek] [n]`, Rechenteil `tools/lib/kal.js` | Mock: `kal.test.js`; Gerät 13.09.2026: sechs Pulse, Nebenbefunde Spannungseinbruch/Voltmeter-Rate/Nachlaufwasser ([19](19-pruefprotokoll.md)) |
| Mock: Topfmodell `potModel()` (Rampe 15 s, Totzeit `tDead`/`tDead2`, Drain-Anteil mit τ, Austrocknung, Rauschen; Profile `effLocal` 0,25 und 10), `simulate(maxMs)`, Überlappungswächter (`Script.Start` in einen laufenden Lauf → `dev.errors`), `noBurst()` ≤ 15 Zeilen je Zeitstempel | `tools/test/helpers.js`, `shelly-mock.js` v0.1.4 | bestehende 102 Tests unverändert grün; das 7-Tage-Szenario behält das lineare Sofortmodell für die Schreibzahlen |
| Installer + Zeitraffer: `cfg4` in `DEF/ORDER`, `cfg2.pctOk/dropW/sfUp/effMax`, `cfg3.dryDay`, `lrn.effW/sf 0.7`; Prüfungen `tick`/`winEvery` Teiler von 60 und `(min mod tick)·60 + PUMP_SEC + tWin + tTail ≤ tick·60`; `SAFE_MIN = ceil((PUMP_SEC + tWin + 10)/60)` → `0 8 8,20`; Zeitraffer Minutenliste `40 2,8,…,56`; Sicherung `zrb1..5`; Abbruch bei laufendem `bw_main`/`bw_pump` | `bw_install.js` v0.1.3, `bw_zeitraffer.js` v0.2.0 (der Plan nannte 0.2.0 für beide) | Mock: `install.test.js` (`cfg4`, `zrb4/5`, `0 8 8,20`, `auto_off` 190, `tick 5`/`winA 07:25`/zu großes `tWin` → `failErr`, Minutenliste, Abbruch), `zeitraffer.test.js` (Profil 3/6, Rückkehr löscht `zrb1..5`); Gerät 13.09.2026: Minutenliste angenommen |
| `bw_pump` Regelkreis: `KVS.Get`-Kette statt `GetMany "*"`, Frischmessung m0, Frist `B`, Claim `st.why=laeuft`, Tick-Automat `m0 → lv → cl → on → pu → so → st → de`, Korrekturportionen aus dem Fenstergewinn, Stabilität Spanne + Trend, Urteile `ok/over/max/zeit/stall/unstab/noeff/wasser`, Lernen `effW`/`sf` am Fensterende, Einzelportion-Pfad | `bw_pump.js` v0.2.0 (<!-- fact:dist.bw_pump -->17 475<!-- /fact --> B kompakt; ein Timer, ein offener RPC, Tiefe ≤ 6) | Mock: `pump.test.js` neu nach der Ergebnismatrix (je Zeile ein Test; Regression Einzelportion, `elapsedMs ≤ (tWin + tTail)·1000`, `maxTimersUsed 1`, `maxPendingRpc 1`), `hwpump.test.js` unverändert; Gerät 13.09.2026: Fenster 1 (15:54:30) mit `P1`/`P2`, `tRise` 8/5 s, `st.n` 2, `pctW` 50,5, `effW` 2,006, `mem_peak` 12 516 B |
| `bw_main`: `control()` statt `rateGift` (nur `zuviel` → `sf`, Hinweis `sink`, Nachholpause `pauseHot` nach `max/zeit`), Bandordnung `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` → `why=cfg`, Dosis mit `effW` und `sf`, Klemme statt `tmin`, `dur` in Pause/`soak`, Wochen-Trockenphase (`dryDay`, `pctDry` 28, Nässe > `pctHi`) | `bw_main.js` v0.2.0 (<!-- fact:dist.bw_main -->15 791<!-- /fact --> B kompakt; Lernen, `noeff`, Objektzweig raus) | Mock: `learn.test.js` (Kontrolle: `zuviel` ohne Doppelabzug, `sink`, altes `st`), `main.test.js` (Bandprüfung, `pctOk` null → `cfg`, Freitag-Rollover → `trocken` bis < 28, Taktmessung 63 % → Trockenphase, Samstag ohne Wirkung, `dryDay` null); Gerät: `[TODO am Gerät]` erstes echtes 20:00-Fenster mit `console.js <ip> 900` |
| Szenario 7 Tage (linear + Rampe, mit Freitag): kein Lauf über einen Takt, Σ `toggle_after` je Fenster ≤ `tMax`, genau eine Trockenphase, Schreibbudget gemessen | `szenario.test.js` | Mock: 15–22 Schreibvorgänge je Gießtag, Budget ≤ 24 (Nachtrag unten) |
| Werkzeuge: `hwtest.js kal` (Rekorder alle 5 s, `report`, `write` erst nach `normal`), `expectedSpecs()/safeMoment()` für Takt 3/Fenster 6, Statuszeile `st.n/sec/pctW/why/mem_peak`, `pctOk` in der Vorprüfung, `zrb1..5`, `put-script.js` mit `fs_free`-Prüfung, `verify-scripts.js` Versionsgleichheit `bw_main`/`bw_pump` | `tools/hwtest.js` v0.1.2 (der Plan nannte 0.2.0), `tools/lib/kal.js` v0.1.1, `put-script.js` v0.1.2, `verify-scripts.js` v0.1.1 | Mock: `kal.test.js` (`write`-Sperre bei `zrb1`, Mischung α 0,5); Gerät 13.09.2026: `kal 780` → `report` → `write` (`effW` null → 4,46, `tDead2` 8 → 5, `tDead` 20 → 8, `tMin` 25 → 10); Zustände mittel feucht/nass offen |
| Doku: README (Regelkreis, Trockentag, `cfg4`-Tabelle, `job.why`, `st`-Felder, Von Hand gießen, Update mit Handwerten, Störungen `noeff`/`sink`, Sicherheit 8 min/190 s/`maxDay × tMax`, Zeitraffer 3/6, Grenzen), CLAUDE.md, AGENTS.md, Handbuch, `lib_notes.md`, Prüfprotokoll, Kurzanleitung | alle Dateien nachgezogen (13.09.2026); seit Etappe 11 in diesem Handbuch | Abnahme: eine unbeteiligte Person versteht Fenster, Portion und Trockentag aus der Doku; `[TODO am Gerät]`-Stellen bleiben bis zum Gerätelauf offen |
| Gerätelauf (nie in den 25 min um 08:00/20:00/Mitternacht): Test-Scripts löschen mit `fs_free` vorher/nachher, Upload `bw_pump`, `bw_main`, `bw_install`, `bw_zeitraffer`, `verify-scripts`, Handwerte `cfg2 {pctOk 50, pctHi 60, pctDry 28, effMax 30}` und `cfg3 {tMax 180, tMin 25}`, `hwtest.js normal` → `verifyState`, Zeitraffer-Fahrplan, `normal`, `kal`, erstes echtes Fenster | Prüfprotokoll Etappe 10 ([19](19-pruefprotokoll.md)), Überraschungen in [18](18-lernlog-geraet.md) und als Regel in die Tests | Gerät 13.09.2026: erledigt – `mem_peak` von `bw_pump` 12 516 + 5 348 B (Parse `bw_main`) < 25 000; Rückbau aus `zrb1..5` geprüft (`verifyState`); `effW` nach Fenster 1 in `lrn`; offen: Fenster 2–4, Zustände mittel feucht/nass, erstes echtes 20:00-Fenster; 144 Tests (13.09.2026) |

### Etappe 11 – Doku-Neufassung (13.–16.09.2026, abgeschlossen)

Die alte Doku (README mit 494 Zeilen, Kurzanleitung, siebenteiliges Handbuch, `docs/PLAN.md`, `LEARNING.md`, Prüfprotokoll, `lib_notes.md` und sechs Konzeptdateien) wird zu einem zweisprachigen Handbuch mit 21 Kapiteln in sechs Teilen (A–F) umgebaut; jedes Kapitel hat ein Archify-Diagramm in beiden Sprachen. Das Grundgerüst entstand am 13.09.2026; den Fortschritt zeigt die Kapitelübersicht im [Handbuch](README.md) („im Aufbau“).

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Kapitelvorlage (`docs/_vorlage-kapitel.md`, `docs/_template-chapter.md`), Kapitelliste `tools/docs/kapitel.json`, Teile A–F | 21 Platzhalter DE/EN, dann Kapitel für Kapitel | `tools/check-docs.js`: Vorlage, Links, Bilder, Parität DE/EN, Lesbarkeit |
| Jede Zahl aus Code oder datiertem Protokoll; Fakt-Marker (`fact:*`, `def:*`, `zr:*`, `hwt:*`, `hwp:*`) gegen `DEF`, `ZR3/ZR4`, `build.js`, `shelly-mock.js` | Befundliste der alten Doku (Sachfehler, Widersprüche, Lücken) wird kapitelweise geschlossen | `check-docs.js` meldet abweichende Marker als Fehler; veraltete Ausdrücke aus `tools/docs/verboten.json` |
| Diagramm-Pipeline: `tools/docs/build-diagramme.mjs` (validate → deliver → SVG → Quittung), Quelle Deutsch plus Wörterbuch EN | `docs/diagramme/src`, `de`, `en`, `receipts` | Quittung mit 0 Fehlern/0 Warnungen je Fassung |
| Tests `docs.test.js` (Doku-Prüfung) und `dist.test.js` (`dist/` aktuell) | `npm test` | <!-- fact:tests -->146<!-- /fact --> Tests (13.09.2026) |
| Alte Dateien | am 16.09.2026 entfernt (altes Handbuch, `hardware/*.md`, sechs Konzeptdateien, SEO-Datei); an den alten Pfaden stehen kurze Verweise mit Weiterleitung auf GitHub Pages (Regel „stub“ in `check-docs.js`: ≤ 8 Zeilen, Link auf `docs/de` bzw. `docs/en`) | `check-docs.js`; Pages: alle 126 Kapitel- und Diagrammseiten HTTP 200, Weiterleitungen geprüft |
| Abschluss | 21 Kapitel je als eigener Commit (Autor, Prüfer, Korrektur, Integrator), dann Landingpage `README.md`/`README.en.md`, `CLAUDE.md`/`AGENTS.md` nachgezogen | `npm test` grün, `npm run docs:check` 0 Fehler, `npm run docs:diagramme --check` 42 Fassungen aktuell |

## Entscheidungen

Stand 15.09.2026 reicht die Tabelle bis Nummer 63. Die Spalte „Kapitel“ nennt das Kapitel, in dem die Entscheidung heute wirkt. Entscheidungen 1–12 stammen aus dem Interview vom 12.09.2026, 13–20 aus dem ersten Gerätetest am selben Abend, 21–28 aus Etappe 8, 29–37 aus Etappe 9 und 38–63 aus Etappe 10 mit dem Interview vom 13.09.2026. Wo eine Entscheidung eine Interview-Nummer nennt, gilt die Zuordnung in der Tabelle „Interview-Nummern“ darunter.

| # | Datum | Thema | Entscheidung und Grund | Kapitel |
| --- | --- | --- | --- | --- |
| 1 | 12.09. | Konzeptdokumente | liegen in `docs/`; seit Etappe 11 in Kapitel 16 zusammengeführt | 16 |
| 2 | 12.09. | Lizenz | MIT, Copyright (c) 2026 Robert-AI-Development | – |
| 3 | 12.09. | Umfang der ersten Sitzung | Etappen 0–5 komplett, Etappe 6 als Prüfprotokoll-Vorlage, Etappe 7 README mit Platzhaltern | 19 |
| 4 | 12.09. | Testhelfer | ja, ab Etappe 0 in `tools/`: Mock und `npm test` (Node ≥ 20, keine Abhängigkeiten) | 14 |
| 5 | 12.09. | Komponenten-IDs | in `cfg1`: `idV` 100 (Voltmeter), `idT` 100 (Temperature), `idLvl` 1 (Input), `idSw` 0 (Switch) | 03, 05 |
| 6 | 12.09. | Temperaturfühler-Ausfall | weitergießen; `err.code = "temp"` blockiert nicht, die Hitzeregel ist dann inaktiv | 02, 13 |
| 7 | 12.09. | „Keine Wirkung“ | `eff_neu < effMin` → `err noeff`, kein Lernwert. Abgelöst durch 46 (Probeportion in `bw_pump`) | 04 |
| 8 | 12.09. | err-Reset | `noeff` nur von Hand (KVS-Eintrag `err` löschen); alle anderen Codes löschen sich, sobald die Ursache weg ist | 13 |
| 9 | 12.09. | Analogeingang | `voltmeter:100`, `Voltmeter.GetStatus` liefert Volt | 05, 20 |
| 10 | 12.09. | pctHi-Regel | Sicherheitsfaktor `lrn.sf` (Start damals 1.0, seit 43: 0.7); neue `cfg2`-Felder `sfMin` 0.5, `sfStep` 0.1; die Dosis wird mit `sf` multipliziert | 02, 03 |
| 11 | 12.09. | `job` schreiben | bei Änderung von `ok/sec/why/pct` (umgesetzt: `ok`/`why`; `sec`/`pct` kommen mit der Auffrischung vor dem Fenster) oder wenn das nächste Gießfenster im nächsten Takt liegt; `bw_main` liest `winA/winB` aus `cfg3`, der Installer baut den Zeitplan aus denselben Feldern | 02, 03 |
| 12 | 12.09. | Switch-Konfiguration | Installer setzt `Switch.SetConfig {initial_state:"off", auto_off:true, auto_off_delay: tMax + 10}` | 04 |
| 13 | 12.09. | Schrittliste `steps[]` am Dateiende | mJS hoistet Funktionsdeklarationen nicht: `var steps = [stepRead, …]` oben in der Datei brach am Gerät mit `ReferenceError` ab (erster Gerätetest). Die Liste steht in jedem Script direkt vor dem abschließenden `next()`; `syntax.test.js` prüft „Verwendung vor Deklaration auf Modulebene“, weil der Mock (V8) hoistet und den Fehler nicht zeigt | 14, 18 |
| 14 | 12.09. | Flache Schrittkette | mJS bricht bei ~10 verschachtelten Aufrufen ab (`bw_pump`: „Too much recursion“). `next()` ist eine Schleife: synchron fertige Schritte geben `true`, asynchrone rufen `next()` im Callback, Warteschlangen-Treiber `true` bei leerer Warteschlange. Der Mock misst die Tiefe, Grenze <!-- fact:call_depth -->10<!-- /fact --> (Gerät: 12 ok, 14 Absturz; Scripts vorher 9–11, v0.1.1: 5, `bw_pump` 0.2.0: 6) | 14, 18 |
| 15 | 12.09. | KVS-Werte als JSON-Strings | Das Gerät speichert Objekte korrekt (Probe 12.09.2026), die Web-UI zeigt sie aber als `[object Object]` und kann sie nicht bearbeiten – `cfg2` wird von Hand gepflegt. Deshalb `JSON.stringify` beim Schreiben, `fromKvs()` beim Lesen; der Mock hält Rohwerte wie das Gerät und meldet Nicht-String-Werte. Muster wie im Referenz-Script des Projektleiters (Spotelly) | 03, 18 |
| 16 | 12.09. | Installer ersetzt unlesbare Einträge | Ein KVS-Eintrag, der kein JSON-Objekt ergibt (`[object Object]` aus v0.1.0, Tippfehler beim Bearbeiten), wird durch die Startwerte ersetzt und in der Konsole gemeldet; gültige Einträge werden weiterhin nie überschrieben | 03, 06 |
| 17 | 12.09. | Upload aus `dist/` | Der Script-Speicher am Gerät ist begrenzt, `bw_main.js` mit Kommentaren passte nicht. `npm run build` schreibt die Kompakt-Ausgabe (Kommentare, Einrückung, Leerzeilen weg, Versionszeile bleibt), `size.test.js` prüft Grenze und `node --check`; `scripts/` bleibt die Quelle. Grenze damals 15 000 B (Firmware 2.0.0 speichert auch 19 KB), seit 35: <!-- fact:size_limit -->16 000<!-- /fact --> B | 14 |
| 18 | 12.09. | Debug-Schalter | `var DEBUG = 0;` in jedem Script; `dbg()` loggt nur bei 1. `rpc()` kapselt `Shelly.call` und loggt Methode + Parameter, `next()` jeden Schritt, `onKvsPage` jeden Eintrag mit Typ, dazu Messwerte. Kostet eine Stack-Ebene (Tiefe 5 statt 4) und ~0,6 KB | 14 |
| 19 | 12.09. | Upload per RPC mit Größenkontrolle | Der Editor der Web-UI verlor beim Einfügen das Dateiende (166 bzw. 210 Byte). `tools/put-script.js` lädt per `Script.PutCode` in Stücken hoch und vergleicht `Script.GetCode` mit der Datei; auch nach Einfügen im Editor ist diese Kontrolle Pflicht | 07, 14, 18 |
| 20 | 12.09. | `Schedule.Create`-Retry | Der erste `Schedule.Create` je Installer-Lauf scheitert am Gerät mit einem irreführenden „timespec validation“-Fehler (derselbe Aufruf per curl ist gültig). `onCreate` wiederholt bis 3× nach 400 ms, der zweite Versuch gelingt; der Mock bildet den Quirk nach (`schedCreateFailFirst`), zwei Tests sichern den Retry. Ursache nicht geklärt – 13.09.: auch ohne KVS-Objekte im Heap | 18, 20 |
| 21 | 13.09. | Eigene Test-Scripts (Etappe 8) | Hardware-Test als zwei eigene Scripts `bw_hwtest`/`bw_hwpump` (Langläufer 10–30 min, nur von Hand gestartet, nie im Zeitplan) statt Erweiterung von `bw_main`/`bw_pump`. Ein Script wäre 23,7 KB kompakt gewesen – über der Grenze; Aufteilung in Sensor- und Pumpenteil. Der Plan sah zusätzlich ein Abschalten des Autostarts für die Test-Scripts vor; das setzt niemand | 11 |
| 22 | 13.09. | Kommandokanal `hwc` | Mensch/Werkzeug schreiben `{n, cmd: go\|skip\|abort}` in den KVS; das Script pollt alle `nCmd` Ticks per `KVS.Get`, verarbeitet nur `n` größer als zuletzt gesehen (alte Kommandos wirken nie) und verwirft `go` in Phasen, die nicht warten. `Script.Eval`/Web-UI verworfen: der KVS ist überall sichtbar und im Mock nachgebildet | 11 |
| 23 | 13.09. | Pumpe nur über `bw_pump` | Der Test schaltet die Pumpe nie ein; er setzt `err={code:null}`, `day` (bei Tageslimit) und `job={ok:true,sec:pumpSec,pct:null,why:"hwtest"}` und startet `bw_pump`. `pct:null` verhindert Bewertung und Lernwert. Nur `Switch.Set on:false` als Sicherheits-Aus | 11 |
| 24 | 13.09. | Zeitwache statt Zeitplanänderung | Pumpenstart nur in der Lücke zum 15-min-Takt (`guardS` 90 s nach dem Takt bis 900 − `guardS` − `pumpSec`) und nicht ± `winMin` 25 min um `winA`, `winB` und Mitternacht. Der Bewässerungs-Zeitplan wird nie angefasst | 11 |
| 25 | 13.09. | Sicherung/Rückbau im KVS | `st/day` → `hwb1`, `job/err/lrn` → `hwb2` (zwei Schlüssel, zusammen > 253 Zeichen) vor dem Auftrag; Rückbau danach, `job.ok` immer false, Sicherung gelöscht. Stehen `hwb1/hwb2` beim Start (Absturz, Stop von außen), ist der Lauf automatisch Durchgang B (`rec:1`); `hwtest.js restore` als Notweg | 11 |
| 26 | 13.09. | Kalibrierwerte automatisch | `bw_hwtest` schreibt `vDry/vWet/lvlEmpty` nach `cfg1` (Lesen-Ändern-Schreiben), wenn plausibel: Trockenpunkt nur nach `go`, ≤ `vDryMax`, ≥ `vErrLo` + 0,05; Nasspunkt ≥ `vWetMin`, ≤ `vErrHi` − 0,10; `vWet − vDry ≥ 1 V`; Schwimmer LEER ≠ VOLL und mindestens ein beobachteter Wechsel. Sonst nur Meldung; Schalter `hwt.cal` | 11 |
| 27 | 13.09. | Mock führt `Script.Start` aus | Registrierte Dateien (`dev.files`) laufen als zweites Script im selben Ereignisstrom; Timer, Fehler und RPC-Callbacks je Script und je Laufgeneration; Input-Konfiguration mit `state:null` bei deaktiviertem Eingang; `dev.onRpc`-Hook für den virtuellen Bediener | 14 |
| 28 | 13.09. | Zwei Durchgänge wegen geteiltem Heap | Der Script-Heap (~25 KB) ist von allen Scripts geteilt; `bw_pump` brauchte mit den Test-Einträgen über 15,8 KB Spitze und starb neben dem Test-Script mit `out_of_memory`. Durchgang A startet `bw_pump` und beendet sich, B bewertet und baut zurück; `hwtest.js watch` startet B automatisch. Beide Test-Scripts geben `K/orig` in Wartephasen frei (9,0/9,6 KB statt 13,5 KB), damit `bw_main` weiterläuft | 11, 18 |
| 29 | 13.09. | Takt und Fenster aus `cfg3` | `tick` (min, Teiler von 60) ersetzt `TICK_MIN`/`TICK` im Code; `winEvery` (null oder Teiler von 60) lässt `bw_pump` alle N Minuten laufen statt um `winA/winB` (`30 */N * * * *`). Der Sicherheits-Aus lag damals im Sekundenfeld derselben Minute, deshalb `tMax ≤ 19` – abgelöst durch 54. `windowSoon()` rechnet `N − (Minute mod N) ≤ tick`. Zeitkonstanten gehören in den KVS | 03, 12 |
| 30 | 13.09. | Zeitraffer als reines Profil | `bw_zeitraffer` ändert nur `cfg3` und setzt den Zustand frisch; `bw_main`/`bw_pump` laufen unverändert. Profil 0.1.x: Takt 1 min, Fenster alle 2 min, Gabe 5 s, `pause` 0.17 h, `pauseHot` 0.035 h, `maxDay` 4, `tHot` 30, Lernen aus über `tDead = tStd`. Pausen als exakte Dezimalzahlen mit Reserve zur Zwei-Takte-Toleranz (0.035 h = 126 s ≤ 150 s bei T+1; 0.17 h = 612 s → T+9). Abgelöst durch 55 | 12 |
| 31 | 13.09. | Sicherung und Rückkehr über den Installer | Sicherung in `zrb1..3` (seit 53 `zrb1..5`), `job` wird frisch gesetzt. Marke `zr` als eigener Schlüssel, von `bw_zeitraffer` als Letztes geschrieben: `bw_install` mit Marke baut den Zeitraffer-Zeitplan und löscht die Marke; ohne Marke schreibt er das Original zurück und löscht die Sicherung (erst schreiben, dann löschen). Jeder Abbruch endet damit, dass der nächste Installer-Lauf zurückbaut | 12 |
| 32 | 13.09. | Installer ergänzt fehlende Felder | Vorhandene Einträge bekommen fehlende Felder aus `DEF` (`=== undefined`, damit `winEvery: null` stabil bleibt); Werte werden weiterhin nie überschrieben. Nach einem Script-Update ist deshalb ein Installer-Lauf nötig, sonst `err cfg` („cfg3.tick fehlt“) | 03, 13 |
| 33 | 13.09. | Sicherer Startmoment | `hwtest.js zeitraffer/normal` starten nur in Sekunde 8–30 (`bw_main` vom Takt ist fertig) und wenn kein Betriebs-/Test-Script läuft. Regel 0.1.3: im Zeitraffer nur in Minuten mit ungerader Zahl, normal > 3 min nach einem Fenster; seit 54: nicht in den Minuten 0–2 des 6er-Zyklus, normal bis `SAFE_MIN` + 1 min nach dem Fenster. `bw_zeitraffer` bricht ab, wenn eines läuft oder `hwb1/hwb2` stehen | 12 |
| 34 | 13.09. | Fahrplan-Reihenfolge | Feucht-Test vor der ersten Gabe (danach verlangt `sperre` erst `pct < pctDry` → `trocken`), normale Pause vor der Hitze (das Tagesmaximum bleibt in `lrn.tMaxD` bis Mitternacht), Reize im Takt vor dem Fenster (Mock und Gerät gleich: der Auftrag entsteht im Takt, die Gabe im Fenster). Fahrplan 0.1.3: Gaben in Minute 4, 14, 16, 20, dann `limit`. Abgelöst durch 55 | 12 |
| 35 | 13.09. | Geräte-Doku und Größengrenze | `//!`-Kommentarzeilen überleben den Build als `// …` (kurz: was macht welche Einstellung), alle anderen fallen weg; `size.test.js` verlangt genau diese Zeilen. Grenze 15 000 → 16 000 Byte (Firmware 2.0.0 speichert 19 KB; die Grenze schützt den geteilten Heap). Prüfung 2: `verify-scripts.js` vergleicht den Code am Gerät byteidentisch mit `dist/`, `put-script.js` nach jedem Upload | 14 |
| 36 | 13.09. | Mock sekundengenau | `simulate()` wertet das Sekundenfeld des Timespecs aus (Pumpe bei Sekunde 30 und Sicherheits-Aus feuern im Mock) und überspringt `Script.Start` auf ein laufendes Script wie das Gerät (`was_running`) | 14 |
| 37 | 13.09. | `bw_pump` startet 30 s nach der vollen Minute | Gerätelauf 13.09.2026: mit `bw_main` v0.1.2 (15,3 KB, Spitze 16,4 KB Heap bei 14 KVS-Einträgen) starb `bw_pump` beim gleichzeitigen Start zur vollen Minute mit `out_of_memory` (1,7 KB übrig). Der Installer setzt das Sekundenfeld des Pumpen-Zeitplans auf `PUMP_SEC` 30 (`30 0 8,20`; Zeitraffer damals `30 */2`, heute `30 */6`); `bw_main` (5–8 s) ist dann fertig. Auftrag weiterhin einen Takt vorher | 04, 18 |
| 38 | 13.09. | Aufgabenteilung `bw_main`/`bw_pump` (Etappe 10) | `bw_main`: Takt, Auftrag (`job.sec = clamp(round(raw), tMin, tMax)`, kein `tmin`), Pause, Tageslimit, Kontrolle `soak` min nach dem Fenster – `control()` statt `rateGift`: `pct > pctHi + hyst` → `sf` runter + `zuviel`, `pctW − pct > dropW` → `sink`, nach `max/zeit` mit `pctA < pctLo` → `pauseHot`. `bw_pump`: misst im Fenster, bis `nPort` Portionen, lernt `effW`/`sf`, hält die Frist. Kein `eff`-Lernen, kein `noeff` in `bw_main` (Interview 2/4) | 02 |
| 39 | 13.09. | Bezugsgröße: stabilisierte Fensterablesung | `pctSoll/pctOk/pctHi` und `effW` beziehen sich auf die stabilisierte Ablesung im Fenster (der Sensor mittig unter zwei Tropfern misst den nassesten Punkt, schnell); `pctLo/pctDry` auf die Taktmessung; der 30-min-Wert (Drainage) ist nur Kontrolle und geht nie in `effW`. Die Skala 50–60 % ist relativ zur `cfg1`-Kalibrierung, kein volumetrischer Wassergehalt | 02, 03 |
| 40 | 13.09. | Gewinnskala `effMax` 30, `tMin`/`tPmin` | `effMax` 30 %/s ist nur Sanity-Grenze (Gerät 7–20 %/s: 5 s hoben die Feuchte am 13.09. von 0 auf 36 bzw. 54 %). Korrekturportionen rechnen mit dem Fenstergewinn `gK = max(dpct/effSec, effMin)`, Ziel `tgt = min(pctSoll, pctNow + (pctHi − pctNow)/2)`, `raw = (tgt − pctNow)/gK + tDead2`, nie mit `sf`. Planwerte `tMin` 25, `tPmin` 5; der Messlauf setzte `tPmin` auf 10 (`DEF`), `kal write` schreibt am Gerät `tMin = max(tPmin, tDead + 2)` (13.09.2026: 25 → 10); `DEF.tMin` bleibt 25 | 02, 03 |
| 41 | 13.09. | `tMax` = Summe je Fenster, `auto_off` bleibt `tMax + 10` | `cfg3.tMax` 180 begrenzt die Summe aller Portionen eines Fensters, `cfg4.tPmax` 120 die einzelne Portion (`toggle_after`-Obergrenze), Vorrat je Tag `maxDay × tMax − day.sec`. `auto_off_delay = tMax + 10` = 190 s (Zeitraffer 50 s) folgt Interview 5; `auto_off` wirkt je Einschaltbefehl und deckt eine Einzelportion weiter ab als nötig – `tPmax + 10` wäre ein Einzeiler und bleibt dokumentiert | 04 |
| 42 | 13.09. | Claim nur in `st`, Guard in `stepCheck` | Claim vor dem ersten `Switch.Set`: `st = {state:"sperre", ts:now, why:"laeuft", rated:true, dryOk:true, …}`; scheitert er → `why=kvs`, nicht pumpen. Stirbt das Script (OOM, Ausnahme, `Script.Stop`, Strom), schalten `toggle_after`/`auto_off`/Sicherheits-Aus ab, `bw_main` meldet `why=pause`, `job.ok=false`; kein Lernwert, kein `noeff`. Guard: `st.why === "laeuft"` jünger als `jobAge` → kein Auftrag (Handstart). Nie `gegossen` + `rated:true` (bliebe ewig `soak`) | 04 |
| 43 | 13.09. | Ein Lernwert `lrn.effW`, `sf` startet 0,7, `sfUp` schließt die Ratsche | `effW` (%/wirksame s, Fensterskala) ersetzt `eff`: `effNew = clamp(dpct/effSec, effMin, effMax)`, `effW = (1 − alpha)·effW + alpha·effNew` (null → Übernahme), nur bei `effSec > 0`. Erstportion unter dem Ziel: `job.sec = (pctSoll − pct)/effW·sf + tDead`, `sf` 0,7 (Recherche: ≈ 0,7 auf das Defizit); `over` nach einer Portion → `sf − sfStep` (min `sfMin`), `ok` nach ≥ 2 → `sf + sfUp` (max 1). Kein Lernen bei `noeff/sensor/switch/laeuft`; `abbruch/extern` nur aus fertigen Portionen (Interview 14) | 02 |
| 44 | 13.09. | Frist `B` dreifach gehalten | `bw_pump`: `q = now mod (tick·60)`, `B = min(tWin, tick·60 − q − tTail)` (normal 420 s, Zeitraffer 120 s); passt die Erstportion nicht → `zeit` ohne Claim; weitere Portion nur, wenn `el + secK + tSoak + nStab·tStep ≤ B`. Installer statisch: `(min mod tick)·60 + PUMP_SEC + tWin + tTail ≤ tick·60` (normal 470 ≤ 900, Zeitraffer 170 ≤ 180; `tick 5`, `winA 07:25` fallen durch); Mock: Überlappungswächter. Zeit aus `Shelly.getUptimeMs()`, nie aus Tick-Zählern | 04 |
| 45 | 13.09. | Stabilität: Spanne + Trend, Timeout-Wert Ringmittel, `unstab` | Nach `tSoak` je `tStep` ein Ringwert (Median der Proben); stabil ⇔ Spanne der letzten `nStab` Werte ≤ `dStab` und jüngst minus ältest ≤ `dStab/2` (eine Rampe zählt nicht), höchstens `tStab` (Planwerte 30/90 s, nach dem Messlauf 20/60 s). Bei Timeout oder Frist gilt das Ringmittel: noch steigend → `unstab` (Fenster endet, Lernwert ja), fallend → Wert nutzen (auch für `over`/`ok`); Plausibilität in jeder Messung. Recherche: Spanne und kein Anstieg, bewertet wird der Wert nach dem Maximum | 02 |
| 46 | 13.09. | `noeff` nur in `bw_pump`, nach voller Probeportion; `dEffMin`, `stall` | Wirkungslos heißt `Δ_i < dStab`. Nach wirkungsloser Erstportion genau eine volle Probeportion (`clamp(sec1, tPmin, min(tPmax, tMax − win.sec))`); bleibt `dpct < dEffMin` → `noeff` (blockiert, nur von Hand löschen, `st sperre/rated:true`, kein Lernwert). War Wirkung nachgewiesen und bleibt eine spätere Portion wirkungslos → `stall` (kein `err`, Lernwert aus den Portionen). „Keine Wirkung darf nie zu mehr Wasser führen“ – die Probeportion ist die einzige, gedeckelte Ausnahme (Interview 6; löst 7 ab) | 04 |
| 47 | 13.09. | Bandordnung prüft nur `bw_main` | `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` und `pctLo + hyst < pctOk`, sonst `why=cfg`. `bw_pump` prüft nur Vollständigkeit: fehlt eines von `pctSoll pctOk pctHi effMin effMax alpha sfMin sfStep` → Einzelportion, fehlt `cfg4` → `err cfg`. Band: `pctLo` 40 Auslöser, `pctOk` 50 Ziel, `pctSoll` 55 Dosis-Zielpunkt, `pctHi` 60 zu viel/Nässe, `pctDry` 28 Ende der Trockenphase (Interview 1) | 02, 03 |
| 48 | 13.09. | Migration wassersicher: `pctOk` null in `OPEN2` | `cfg2.pctOk` startet null in `OPEN2` – bis zum Handeintrag kein Auftrag (`why=cfg`). `bw_main` 0.2.0 toleriert altes `st` (ohne `dur/pctW`) und `lrn` ohne `effW` (→ `tStd`); `bw_pump` 0.2.0 ohne `job.pct` gießt eine Einzelportion; fehlendes `cfg4` → `err cfg`. Jede Upload-Reihenfolge ist wassersicher; `verify-scripts.js` prüft die Versionsgleichheit. Handwerte: Nachtrag „Gerät (15:48–15:50)“ | 13 |
| 49 | 13.09. | Vorprüfung m0 ≥ `pctOk` → `feucht` | `bw_pump` misst vor Portion 1 (`nSample` Ticks → Median → `pctB`), weil `job.pct` bis 20 min alt ist. `pctB ≥ pctOk` (von Hand gegossen oder gedüngt) → keine Gabe, `job.why="feucht"`, kein Claim, kein Lernwert, keine Pause, `day` unverändert; unplausibel → `sensor` (Interview 9) | 02 |
| 50 | 13.09. | Einzelportion-Pfad | `!isNum(job.pct)` oder `cfg4.nPort === 1` oder Band unvollständig → `lv → on → pu → done` (ohne Claim `laeuft`): `clamp(job.sec, 1, min(tPmax, tMax))` Sekunden, keine Messung, kein Lernwert, `st` wie bisher (`gegossen/rated:false/pctB null`). Trägt `bw_hwpump` (`pct:null`, Entscheidung 23), Handaufträge und die Eimer-Variante des Zeitraffers; `hwpump.test.js` bleibt unverändert grün | 11, 12 |
| 51 | 13.09. | `day.n` zählt Fenster, `day.sec` alle Sekunden | `day.n` + 1 je Fenster mit mindestens einer Portion, `day.sec` = Σ aller Pumpensekunden inkl. Teilportion bei `abbruch/extern`; `maxDay` bleibt in Fenstern, der Vorrat `maxDay·tMax − day.sec` begrenzt jede Portion. Bei `feucht/sensor/wasser/zeit` vor der ersten Portion und beim Absturz bleibt `day` unverändert | 02, 13 |
| 52 | 13.09. | `st`-Form, `job.why`, Protokoll | `st = {state, ts, dur, n, sec, pctB, pctW, pctA, effW, why, tr, rated, dryOk}` (Worst Case 165 Zeichen): `dur` Sekunden bis Pumpe-aus der letzten Portion (Pause ab `ts`, Kontrolle ab `ts + dur`), `pctW` letzte stabile Fensterablesung, `tr` tRise der 2. Portion. `job.why` aus `bw_pump` 0.2.0: `ok over max zeit stall unstab noeff wasser abbruch extern sensor switch kvs lvl feucht nass`, dazu unverändert `cfg uhr alt limit err:<code>` ([02](02-flussdiagramm.md), [03](03-konfiguration.md)); `tmin` entfällt, `laeuft` steht nur in `st.why`, `kein_auftrag` nur in der Konsolenzeile; `err`: `noeff/sensor/wasser` auch von `bw_pump`, Hinweis `sink` (in `ERR_ORDER` vor `temp`). Je Portion eine Konsolenzeile, nie mehr als ~15 `print` synchron (Interview 7) | 03, 13 |
| 53 | 13.09. | `cfg4` als eigener Schlüssel, `zrb1..5` | `cfg3` würde mit den Fensterfeldern 253 Zeichen sprengen (und `zrb1` mit), deshalb `cfg4` „Fenster-Regelkreis“ (zwölf Felder, Worst Case 138 Zeichen; Planwerte `tPmin` 5, `tSoak` 30, `tStab` 90, `tDead2` 10 – nach dem Messlauf 10/20/60/8, heute in [03](03-konfiguration.md)), gelesen nur von `bw_pump`. Sicherung neu: `zrb1 {cfg3}`, `zrb2 {lrn, day}`, `zrb3 {st, err}`, `zrb4 {cfg4}`, `zrb5 {cfg2}` (je ≤ 225); 9 + 6 + 6 = 21 Schlüssel ≤ 50, `kvs-size.test.js` rechnet mit Worst-Case-`st`. `bw_pump` liest per `KVS.Get`-Kette genau neun Schlüssel statt `GetMany "*"` (keine `hw*/zrb*`-Strings im Heap) | 03, 12 |
| 54 | 13.09. | Sicherheits-Aus aus `PUMP_SEC + tWin + 10` | `safeSec = PUMP_SEC + tWin + 10`; normal `SAFE_MIN = ceil(460/60)` = 8 → `0 8 8,20 * * *` (statt Minute 5); Zeitraffer Minutenliste `40 2,8,14,…,56 * * * *` und Prüfung `safeSec < winEvery·60`; die alte Prüfung `tMax + 10 ≤ 59` entfällt. Die Minutenliste war `[TODO am Gerät]` – 13.09.2026 angenommen, kein Rückfall gebaut. `hwtest.js expectedSpecs()/safeMoment()` bauen die Formeln nach | 04, 12 |
| 55 | 13.09. | Zeitraffer Takt 3 / Fenster 6 / Budget 120 mit echtem Lernen | Profil `ZR3`/`ZR4` in `bw_zeitraffer.js` (Werte: Nachtrag „Zeitraffer-Profil angepasst“, [12](12-erstinbetriebnahme.md)): Portionen nie unter 10 s (Wasserlaufzeit im Schlauch), 12 + 15 + 10 s passen in `tMax` 40 und ins Budget 120 s; `pctDry = pctLo − 1`, `dryDay` null (Trockenphase aus). Schlauch am Sensor, echtes Lernen (Interview 8/11); Sensor vor jedem Fenster in trockene Erde. Fahrplan ~45 min: Fenster bei 6:30/18:30/24:30/36:30, `wasser`, `feucht`, `limit`, `normal` bei 40 (`pauseHot` 360 s → T+6:30, `pause` 720 s → T+12:30). Eimer-Variante `nPort` 1. Löst 30/34 ab | 12 |
| 56 | 13.09. | Kalibrierlauf und Messlauf als Werkzeug, kein Gerätecode | `hwtest.js mess [sek] [n]` (Schritt 0): Pulse ≤ 10 s mit 90 s Abstand, Voltmeter alle 2 s per RPC; je Puls `pct` vorher, `tRise`, Peak, Ruhewert, Zeit bis stabil, Gewinn %/s; Vorschläge für `effMax`, `tPmin`, `tMin`, `tDead/tDead2`, `tSoak`, `tStab`. `hwtest.js kal`: Zeitraffer mit Fahrplan, Rekorder alle 5 s nach `docs/kal/<datum>-kal.json`, `kal report` je Fenster, `kal write` erst nach `normal` (verweigert bei `zrb1`; `effW` Mischung α 0,5, `tDead2` aus `tRise`). Rechenkern `tools/lib/kal.js`, ohne Gerät testbar (Interview 10/12) | 12, 14 |
| 57 | 13.09. | Ein Lernwert jetzt, Klassen später | Nur `lrn.effW` plus `sf`; Klassen `effD/effN` (trocken/normal) erst in einer späteren Etappe, wenn der Kalibrierlauf > 50 % Unterschied zwischen den Zuständen zeigt – der `kal`-Bericht liefert die Datenbasis, schreibt Klassenwerte aber nicht. Interview 13 – so nennt sie auch `tools/lib/kal.js` („Entscheidung 13“ meint diese Zeile 57) | 12, 16 |
| 58 | 13.09. | Wochen-Trockenphase | Nicht mehr nach jeder Gabe (der Claim schreibt `dryOk: true`), sondern (a) ab dem Tageswechsel auf `cfg3.dryDay` 5 (Freitag; `dow = (days + 4) % 7`, null = nie) und (b) bei Nässe: Taktmessung `pct > pctHi` ohne Fenster in Arbeit, oder m0 > `pctHi` im Fenster (`nass`, keine Gabe). Beides: `st.state="sperre"`, `dryOk=false`, `why=trocken`, bis eine Taktmessung `pct < pctDry` zeigt. Die 30-min-Kontrolle setzt nur `sf`/`zuviel`; kein `pauseHot`-Nachholen in der Trockenphase. Zeitraffer/Kalibrierung: `dryDay` null, `pctDry = pctLo − 1`; `kal` ordnet trocken/mittel/nass zu (Interview 16) | 02, 13 |
| 59 | 13.09. | Flash: Test-Scripts vor dem Upload löschen | `engine_probe`, `bw_hwtest`, `bw_hwpump` (damals IDs 4/5/6) per `Script.Delete` entfernen: `fs_free` 12 288 B mit sieben Scripts → 49 152 B ohne die drei (≈ 36 KB); `put-script.js` prüft `fs_free` vor dem Upload; Hardware-Test-Scripts bei Bedarf wieder hochladen (Interview 15) | 13, 14 |
| 60 | 13.09. | Verworfen: Abschalten bei Vorhaltschwelle während der Portion | Pumpe laufen lassen und abschalten, sobald der Sensor eine Vorhaltschwelle erreicht – verworfen: bei 10–20 s Wasserlaufzeit und 7–20 %/s Gewinn läuft der Wert nach dem Abschalten weiter, die Portion ist weder reproduzierbar noch als Lernwert brauchbar; „Portion → nachmessen → nächste Portion“ ist die Regelstruktur der Literatur | 16 |
| 61 | 13.09. | Verworfen: Klassenlernen sofort | `effD/effN` nach Ausgangsfeuchte ab dem ersten Fenster – verworfen: mehr `lrn`-Felder und Codegröße ohne Datenbasis; erst nach dem Kalibrierlauf (57) | 16 |
| 62 | 13.09. | Verworfen: Claim in `job` | Den laufenden Lauf in `job` markieren – verworfen: `job` wird von `bw_main` im Takt aufgefrischt (`ok/sec/why/pct`) und ist die Übergabe, nicht der Zustand; ein Claim dort könnte überschrieben werden. `st.why="laeuft"` ist ein einziger Schreibvorgang, den nur `bw_pump` setzt und `bw_main` als `pause` liest | 04, 16 |
| 63 | 13.09. | Verworfen: Smith-Prädiktor | Modellgestützte Totzeitkompensation (MathWorks) – verworfen: braucht Prozessmodell und Dauerregler; ein Einmal-Läufer ohne Zustand im RAM kann kein Modell nachführen. Die Totzeit wird additiv behandelt (`tDead`, `tDead2` aus `tRise`), die Rückkopplung liegt zwischen den Portionen | 16 |

### Interview-Nummern

Das Interview vom 13.09.2026 (vier Runden vor Etappe 10) hat eine eigene Zählung. Die Entscheidungen 1–12 vom 12.09.2026 tragen dagegen dieselbe Nummer wie im damaligen Interview.

| Interview 13.09. | Thema | Tabellennummer |
| --- | --- | --- |
| 1 | Zielband `pctLo 40 / pctOk 50 / pctSoll 55 / pctHi 60 / pctDry 28` | 47 |
| 2, 4 | Aufgabenteilung `bw_main`/`bw_pump` | 38 |
| 5 | `auto_off` bleibt `tMax + 10` | 41 |
| 6 | `noeff` nach voller Probeportion | 46 |
| 7 | eine Konsolenzeile je Portion | 52 |
| 8, 11 | Zeitraffer mit Schlauch am Sensor, echtes Lernen | 55 |
| 9 | Vorprüfung m0 ≥ `pctOk` → `feucht` | 49 |
| 10, 12 | Kalibrierlauf und Messlauf als Werkzeug | 56 |
| 13 | ein Lernwert jetzt, Klassen später (`tools/lib/kal.js` nennt „Entscheidung 13“) | 57 |
| 14 | `sf` startet 0,7, `sfUp` | 43 |
| 15 | Test-Scripts vor dem Upload löschen (`tools/put-script.js` im Kopfkommentar und `tools/hwtest.js` im Abschnitt „Scripts am Gerät“ nennen „Entscheidung 15“; Tabellenzeile 15 ist dagegen „KVS-Werte als JSON-Strings“, die `bw_main.js`, `bw_install.js` und `shelly-mock.js` meinen) | 59 |
| 16 | Wochen-Trockenphase (`bw_main.js` in `dryStart()` und das Prüfprotokoll nennen „Entscheidung 16“) | 58 |

## Nachträge

Chronologisch, gestrafft. Messwerte stehen vollständig im Prüfprotokoll ([19](19-pruefprotokoll.md)), die Ursachen der Gerätefunde im Lernlog ([18](18-lernlog-geraet.md)). Die Recherche zur Puls-Bewässerung, die 30 bestätigten Randfälle mit ihren Quellen und die Abweichungen vom Onboarding-Prompt (Felder `msSample`, `sfMin/sfStep`, `tChk`, `lrn.tMaxD/tMaxY`, Autostart aus, `kvs_rev` als Schreibzähler, Rangfolge der `err`-Codes) sind nach [16 · Konzept und Entscheidungen](16-konzept-und-entscheidungen.md) umgezogen.

### 12.09.2026 – 7-Tage-Simulation (`szenario.test.js`)

- **Pause mit Toleranz:** Der Auftrag entsteht einen Takt vor dem Fenster (07:45), die Gabe startet Sekunden nach dem Fenster. Eine Pause von exakt 24 h würde das nächste 08:00-Fenster um Sekunden verfehlen. Deshalb gilt die Pause als abgelaufen, wenn sie beim nächsten Fenster bis auf einen Takt vorbei ist: `(now + 2·tick·60) − st.ts ≥ pause·3600` in `bw_main` („das erste Fenster nach Ablauf“ aus dem Umsetzungsplan).
- **Tagesmaximum in 2-°C-Schritten:** `lrn.tMaxD` wird auf gerade Grad gerundet, damit ein Sommertag nicht zehn Schreibvorgänge erzeugt; das Überschreiten von `tHot` wird unabhängig davon exakt erfasst.
- **`job` vor dem Fenster** wird nur aufgefrischt, wenn `job.ok = true` ist; bei `ok = false` prüft `bw_pump` das Alter nicht.
- **Unlesbarer Wasserstand:** Ist der Wasserstand in einem Takt unstabil, bleibt eine stehende Störung `wasser` erhalten (weder gesetzt noch gelöscht).
- **Erfahrungswerte 0.1.0:** je Tag 8 bis 9 KVS-Schreibvorgänge ohne Gabe, 13 bis 16 mit Gabe (seit 0.2.0: 15–22 je Gießtag, Nachtrag Etappe 10); `bw_main` lief im Mock 2,6 s, `bw_pump` `sec` + 5–7 s. Stand: 53 Tests grün (Installer, Messen, Freigabekette, Dosis, Pause, Pumpe, Lernen, Szenario über sieben Tage inklusive Hitzetage und „keine Wirkung“).

### 12.09.2026 – erster Gerätetest (Firmware 2.0.0)

- **Scripts starteten gar nicht** (`ReferenceError: "stepRead" is not defined`), obwohl alle 53 Mock-Tests grün waren → Entscheidung 13; Version der drei Scripts danach 0.1.1.
- **`bw_pump` starb mit „Too much recursion“** – die verschachtelte Schrittkette war 9–11 Ebenen tief → Entscheidung 14; der Mock misst die Aufruftiefe seitdem selbst (`max. Aufruftiefe` in `tools/run-script.js`).
- **Probe (`tools/probe/engine_probe.js`):** `KVS.Set` funktioniert mit RPC-Objekten, Literalen, JSON-Kopien und Strings gleichermaßen (`ec=0`); `KVS.GetMany` liefert `items` als Array; der frühere Fehler `KVS.Set lrn: Missing required argument 'key'` ließ sich nicht reproduzieren – er trat nur in der tiefen Aufrufkette auf. Stackgrenze: [18](18-lernlog-geraet.md).
- **`bw_main` v0.1.1 brach mit `ReferenceError: "evalSamples" is not defined` ab** – am Gerät fehlten 166 (`bw_install`) bzw. 210 Byte (`bw_main`) am Dateiende: Verlust beim Einfügen im Editor, nicht das Speicherlimit (Firmware 2.0.0 hält 19 KB) → Entscheidung 19.
- **Grenze des Mocks:** Der Mock führt die Scripts in V8 aus (`vm.runInNewContext`). Was V8 großzügiger auslegt als mJS (Hoisting, Stacktiefe, weitere Sprachdetails), fällt nur am Gerät oder über Regeln in `syntax.test.js` bzw. Messungen im Mock auf; jede weitere Engine-Überraschung wird dort nachgetragen.

### 13.09.2026 – Hardware-Test (Etappe 8)

- **Vierter Engine-Fehler:** `bw_hwtest` starb nach dem ersten Messtick mit `Function "shift" not found!` – mJS kennt `Array.prototype.shift` nicht. Ringpuffer per Index; neue Regel in `syntax.test.js` (verbotene Array-Methoden).
- **Fünfter Engine-Fehler:** `bw_pump` starb neben dem laufenden Test-Script mit `out_of_memory`, ebenso `bw_main` im Takt: der Script-Heap (~25 KB) ist geteilt → Entscheidung 28. Der Normalbetrieb mit `bw_main` + `bw_pump` um 08:00 war nicht betroffen (je ~7,4 KB).
- **Gemessen:** `KVS.GetMany` liefert 11 Einträge je Seite; Kalibrierpunkte `vDry`/`vWet`, `lvlEmpty` 1 und der Fühlerbereich bestätigt, der Flash war mit zwei Test-Scripts knapp – Werte in [19](19-pruefprotokoll.md).
- **Testzahl:** 89 (58 bisher + 12 `hwtest.test.js` + 15 `hwpump.test.js` + 4 Größe/Syntax); nach Etappe 9: 102 (+6 `zeitraffer.test.js`, +3 main, +2 install, +2 Größe/Syntax für `bw_zeitraffer`).

### 13.09.2026 – Zeitraffer 0.1.3 (Etappe 9)

- **Zielband am Gerät:** `cfg2` war bis 13.09.2026 leer (`why=cfg`); für den Praxistest wurde das Beispielband `pctSoll` 55 / `pctLo` 40 / `pctHi` 65 / `pctDry` 38 / `dropSlow` 4 gesetzt, es blieb nach dem Zeitraffer stehen (Handwerte 0.2.0: Entscheidung 48).
- **`tHot` im Zeitraffer 30 °C:** der DS18B20 erreichte im Hardware-Test mit warmem Wasser 33,5 °C; 35 °C sind ohne Föhn nicht erreichbar. Dieselbe Regel, nur eine erreichbare Schwelle.
- **Am Gerät bestätigt:** Timespec-Formen mit Sekundenfeld ≠ 0 (`15 */2`, `30 */2`, `45 */2`) werden angenommen; `bw_zeitraffer` startet `bw_install` ohne Speicherproblem (Heap-Werte in [19](19-pruefprotokoll.md)). Gefunden: `bw_pump` neben `bw_main` → `out_of_memory` → Entscheidung 37, Ursache in [18](18-lernlog-geraet.md).
- **Runde 2 (11:13–11:31):** alle Fahrplan-Fälle gezeigt (Gabe, Hitze-Doppelgabe mit 2-min-Pause, Schwimmer LEER → `wasser`, Sensor im Wasser → `feucht`, `limit`, Rückbau byteidentisch zum Original); der Schlauch lag an der Pflanze, deshalb stieg die Feuchte am Sensor mit jeder Gabe. Zeiten und Speicherwerte in [19](19-pruefprotokoll.md).
- **Erster `Schedule.Create`:** die Ablehnung bleibt auch mit freigegebenen KVS-Objekten (Gegenprobe 12:15:08) – kein KVS-Heap-Problem; der Installer wiederholt sie seit v0.1.2 stumm, gemeldet wird erst eine zweite Ablehnung (Entscheidung 20 bleibt).
- **Werkzeug:** `hwtest.js watch` übersteht seit Runde 2 einen Tunnel-Hänger (RPC-Timeout wird gemeldet, die Schleife läuft weiter); die Fahrplan-Ausgabe liest `cfg3` nach der Aktivierung.

### 13.09.2026 – Etappe 10 (Umsetzung und Gerätelauf)

- **Messlauf am Aufbau (Schritt 0):** 3-s-Pulse füllen nur den Schlauch (Totzeit 5–8 s, danach kriecht der Wert durch Nachtropfen); erst ein 10-s-Puls hebt die Feuchte deutlich und steht wenige Sekunden nach Pumpe-aus (Puls-Tabelle mit allen Werten in [19](19-pruefprotokoll.md)). Daraus die Startwerte in `cfg4`: `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> (Nutzer: „5 s sind sehr knapp, das Wasser braucht 10–20 s durch den Schlauch“), `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def -->, `tStab` <!-- def:cfg4.tStab -->60<!-- /def -->, `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def -->, `effMax` <!-- def:cfg2.effMax -->30<!-- /def -->; Rohdaten `docs/kal/2026-09-13-*-mess.json`.
- **Zeitraffer-Profil angepasst** (55 nachgezogen): `tMin` <!-- zr:cfg3.tMin -->10<!-- /zr -->, `tStd` <!-- zr:cfg3.tStd -->12<!-- /zr -->, `tMax` <!-- zr:cfg3.tMax -->40<!-- /zr --> (`auto_off` 50 s), `tPmin` <!-- zr:cfg4.tPmin -->10<!-- /zr -->, `tPmax` <!-- zr:cfg4.tPmax -->15<!-- /zr -->, `tSoak` <!-- zr:cfg4.tSoak -->10<!-- /zr --> – so passen bis zu drei Portionen à ≥ 10 s in Budget 120 s und Fenstersumme; der Fahrplan-Test rechnet mit Topfmodell 1 %/s (12 s → 30 %, 15 s → 45 %, 10 s → 55 % ok). Vollständiges Profil: [12](12-erstinbetriebnahme.md).
- **Profil 0.2.0 vollständig** (Startwerte aus `ZR3`/`ZR4` in `bw_zeitraffer.js`; alle anderen Felder bleiben, wie sie sind): `cfg3` `tick` <!-- zr:cfg3.tick -->3<!-- /zr -->, `winEvery` <!-- zr:cfg3.winEvery -->6<!-- /zr -->, `soak` <!-- zr:cfg3.soak -->0.25<!-- /zr -->, `pauseHot` <!-- zr:cfg3.pauseHot -->0.1<!-- /zr -->, `pause` <!-- zr:cfg3.pause -->0.2<!-- /zr -->, `pauseSlow` <!-- zr:cfg3.pauseSlow -->0.35<!-- /zr -->, `jobAge` <!-- zr:cfg3.jobAge -->5<!-- /zr -->, `maxDay` <!-- zr:cfg3.maxDay -->4<!-- /zr -->, `tDead` <!-- zr:cfg3.tDead -->2<!-- /zr -->, `tMin` <!-- zr:cfg3.tMin -->10<!-- /zr -->, `tStd` <!-- zr:cfg3.tStd -->12<!-- /zr -->, `tMax` <!-- zr:cfg3.tMax -->40<!-- /zr -->, `tChk` <!-- zr:cfg3.tChk -->1<!-- /zr -->, `tHot` <!-- zr:cfg3.tHot -->30<!-- /zr -->, `dryDay` <!-- zr:cfg3.dryDay -->null<!-- /zr -->; `cfg4` `tWin` <!-- zr:cfg4.tWin -->120<!-- /zr -->, `tTail` <!-- zr:cfg4.tTail -->20<!-- /zr -->, `nPort` <!-- zr:cfg4.nPort -->3<!-- /zr -->, `tPmin` <!-- zr:cfg4.tPmin -->10<!-- /zr -->, `tPmax` <!-- zr:cfg4.tPmax -->15<!-- /zr -->, `tSoak` <!-- zr:cfg4.tSoak -->10<!-- /zr -->, `tStep` <!-- zr:cfg4.tStep -->5<!-- /zr -->, `tStab` <!-- zr:cfg4.tStab -->30<!-- /zr -->, `nStab` <!-- zr:cfg4.nStab -->3<!-- /zr -->, `dStab` <!-- zr:cfg4.dStab -->1<!-- /zr -->, `tDead2` <!-- zr:cfg4.tDead2 -->0<!-- /zr -->, `dEffMin` <!-- zr:cfg4.dEffMin -->1<!-- /zr -->; `cfg2` `pctDry` = <!-- zr:cfg2.pctDry -->pctLo − 1<!-- /zr -->.
- **`pctDry` im Zeitraffer = `pctLo − 1` statt 101:** die Bandprüfung von `bw_main` (`pctDry < pctLo`) hätte 101 mit `why=cfg` abgelehnt. Mit `pctLo − 1` endet eine Trockenphase, sobald die Erde trocken genug für einen Auftrag ist – praktisch aus. Folge für den Fahrplan: der Sensor im Wasserglas liefert bei Minute 0 `why=trocken` (Nässe > `pctHi` startet die Trockenphase), nicht `feucht`; ab Minute 3 in trockener Erde geht es im selben Takt weiter (`dryOk` → `beob` → Auftrag).
- **Claim schreibt `dryOk: true`** (der Plan sagte `false`): eine Gabe im Fenster löst keine Trockenphase mehr aus (58); bliebe `dryOk` false im Claim, würde ein Absturz mitten im Fenster eine Trockenphase bis unter 28 % erzwingen. `nass` (m0 > `pctHi`) setzt `dryOk: false` weiterhin.
- **Frist in `bw_pump`:** `q = now mod (tick·60)` statt `(minDay mod tick)·60 + now mod 60` – gleichwertig, solange der UTC-Versatz ein Vielfaches von 15 min ist (alle Zeitzonen); spart `civil()` im Script.
- **`bw_pump` bis <!-- fact:size_limit_pump -->18 000<!-- /fact --> Byte** (`tools/build.js` `MAX_BYTES`, `limitFor()`): der Regelkreis passte nach allen Kürzungen (ein Schreibpfad, Median statt Mittelwert, knappe Zeilen) bei <!-- fact:dist.bw_pump -->17 475<!-- /fact --> Byte nicht unter 16 000; vertretbar, weil die Frist einen Lauf neben `bw_main` ausschließt.
- **Kalibrierzustände auf das Band abgebildet:** trocken < `pctDry`, mittel `pctDry`…`pctLo` (Gabe fällig = „normal gießen“), band `pctLo`…`pctHi` (keine Gabe), nass > `pctHi`. Gaben und Lernwerte entstehen nur in trocken und mittel; der `kal`-Fahrplan setzt den Sensor für den Mittelwert deshalb in Erde von 28–40 %, nicht 40–50.
- **Szenario 7 Tage:** je Fenster Claim + `st/day/job/lrn` → Schreibbudget von 18 auf 24 je Tag (gemessen 15–22), Durchschnitt < 18; Portionen liegen innerhalb von 8 min nach 08:00/20:00, Erstportion ≥ `tMin`, Fenstersumme ≤ 180.
- **Werkzeuge:** `hwtest.js scripts`/`delete` (Flash), `preflight hw` legt die Hardware-Test-Scripts nur noch auf Wunsch an; `put-script.js` bricht ab, wenn `fs_free` + alter Code < neue Datei + 4 096 B; `verify-scripts.js` prüft `VER` von `bw_main` und `bw_pump` auf Gleichheit.
- **Gerät (15:48–15:50):** Test-Scripts waren bereits gelöscht, Upload aller vier Scripts byteidentisch (Flash-Werte `fs_free` in [19](19-pruefprotokoll.md)); Handwerte `cfg2 {pctOk 50, pctHi 60, pctDry 28, effMax 30}`, `cfg3 {tMax 180, tMin 25}`, `lrn {sf 0.7, effW null, eff entfernt}`; der Installer legte `cfg4`, `dryDay`, `dropW/sfUp` an, Zeitplan `0 8 8,20`, `auto_off` 190 s. Die Zeitraffer-Minutenliste `40 2,8,14,…,56 * * * *` nahm das Gerät an (war `[TODO am Gerät]`).
- **Fenster 1 am Gerät (15:54:30, Zeitraffer, Kalibrierlauf):** zwei Portionen (P1 12 s, P2 10 s) hoben die trockene Erde ins Band, Ergebnis `unstab` (der Wert stieg beim Timeout noch), `effW` gelernt, Laufzeit unter der Frist von 120 s, kein `out_of_memory`; Konsolenzeilen, Feuchte- und Heap-Werte in [19](19-pruefprotokoll.md). `kal write` (nach `normal`): `lrn.effW` 4,46 (Skala nach `tRise`), `cfg4.tDead2` 5, `cfg3.tDead` 8, `cfg3.tMin` 10 – die Totzeit gehört zum Schlauch, am Endaufbau per `mess` nachmessen.
- **`kal write` schreibt auch `cfg3.tDead`/`tMin`** (Plan: nur `effW`/`tDead2`): ohne Anpassung hätte die Klemme `tMin` 25 bei 8 s Totzeit 17 wirksame Sekunden (≈ +75 %) gegossen; `tMin = max(tPmin, tDead + 2)` hält die Nutzervorgabe „Portionen ≥ 10 s“ ein.

## Offen

Zusammengeführt aus dem alten Plan („Offen, bevor Etappe 3 am Gerät abgeschlossen werden kann“) und dem Prüfprotokoll Etappe 10. Wer einen Punkt erledigt, trägt Datum und Ergebnis ins Prüfprotokoll ([19](19-pruefprotokoll.md)) ein und streicht ihn hier.

| Punkt | Stand | Nächster Schritt |
| --- | --- | --- |
| Zielband `pctSoll`, `pctLo`, `pctHi`, `pctDry` aus zwei Messungen an der Pflanze | am Gerät stehen seit 13.09.2026 Handwerte (55/40/60/28, `pctOk` 50) aus dem Beispielband, nicht gemessen | Kalibrierlauf zu Ende fahren ([12](12-erstinbetriebnahme.md)) |
| `dropSlow` für die 48-h-Regel | am Gerät 4 (seit 13.09.2026, 10:57), Beispielwert | Austrocknung über mehrere Tage aus `lrn.rate` ablesen |
| Kalibrierlauf: Zustände mittel feucht und nass | nur Fenster 1 (trocken) am 13.09.2026 | Sensor nach Fahrplan umstecken, `hwtest.js kal 2400` |
| Zeitraffer-Fahrplan Fenster 2–4 (Pause, Hitze, `wasser`, `limit`) mit `tMax` 40 / `tSoak` 10 | 0.2.0: nur Fenster 1 gelaufen; mit 0.1.3 alle Fälle gezeigt | `hwtest.js zeitraffer 60` → `watch 300` wiederholen → `normal 60` |
| Erstes echtes Fenster 20:00 mit trockener Erde | `[TODO am Gerät]` | `console.js <ip> 900` mitlesen (`hwtest.js watch` endet im Normalbetrieb) |
| `cfg3.tDead`/`tMin` am Endaufbau mit längerem Schlauch | `kal write` schrieb 8 s / 10 s für den Testschlauch | `hwtest.js mess 10 1 90` am Endaufbau (10–20 s laut Nutzer) |
| Prüfprotokoll Zeilen 1, 5–7, 9–13, 15, 16, 18–20 | am Gerät nie ausgelöst; 12, 13 und 18 deckt der Mock ab (`pump.test.js`) | einzeln nach [19](19-pruefprotokoll.md) durchspielen |
| ~~Eingang 1 (`input:1`, Klemme IN2) = 1 bedeutet LEER~~ | bestätigt 13.09.2026 per `bw_hwtest` (LEER = 1, VOLL = 0) | – |
| ~~Kalibrierpunkte `vDry`/`vWet`~~ | gemessen 13.09.2026 per `bw_hwtest` (0,296 V / 3,134 V, in `cfg1` geschrieben) | – |
| ~~Analogeingang heißt `voltmeter:100`, DS18B20 `temperature:100`~~ | bestätigt 12.09.2026 (`bw_main`: `V=0.28 … tC=24.4` mit den Standard-IDs 100) | – |
| ~~Form der Zeitraffer-Minutenliste~~ | `40 2,8,14,…,56 * * * *` am 13.09.2026 angenommen (54) | – |

## Doku-Schuld

Die Geräte-Doku in den Scripts (`//!`-Zeilen, die den Build überleben) verweist noch auf Abschnitte der alten README: `bw_main.js` Zeile 6, `bw_install.js` Zeile 22, `bw_hwtest.js` Zeile 5, `bw_hwpump.js` Zeile 5 und `bw_zeitraffer.js` Zeile 10. `tools/check-docs.js` meldet das als Warnung „doku-schuld“. Der Fix ist ein Script-Release (Version hochzählen, `npm run build`, Upload, `verify-scripts.js`) und gehört nicht in die Doku-Etappe.

Ebenso beschreibt der Kopfkommentar von `tools/hwtest.js` (Zeile 16) den sicheren Moment noch nach der Regel von 0.1.3; der Code (`safeMoment()`) sperrt längst die Minuten 0–2 des 6er-Zyklus (Entscheidung 54).

## Beispielausgabe

Die Doku-Prüfung über das ganze Repo (15.09.2026, mit diesem Kapitel): 0 Fehler, 29 Warnungen. Die 24 Warnungen `lesbarkeit` betreffen die langen Zellen der Entscheidungen 38, 40, 42–46, 52, 53, 55, 56 und 58 (DE und EN, je 12): der Wortlaut dieser Entscheidungen bleibt vollständig aus dem alten Plan erhalten, deshalb liegen sie über der Zellgrenze von 400 Zeichen. Die fünf Warnungen `doku-schuld` sind die Doku-Schuld von oben. Im Block sind die `lesbarkeit`-Zeilen gekürzt:

```text
$ node tools/check-docs.js
WARNUNG  docs/de/17-etappen-und-entscheidungslog.md:225 lesbarkeit   Tabellenzelle mit 446 Zeichen (Grenze 400)
WARNUNG  docs/de/17-etappen-und-entscheidungslog.md:227 lesbarkeit   Tabellenzelle mit 480 Zeichen (Grenze 400)
… (21 weitere Zeilen lesbarkeit: Entscheidungen 42–58 in docs/de und docs/en)
WARNUNG  docs/en/17-etappen-und-entscheidungslog.md:245 lesbarkeit   Tabellenzelle mit 587 Zeichen (Grenze 400)
WARNUNG  scripts/bw_hwpump.js:5                       doku-schuld  Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)
WARNUNG  scripts/bw_hwtest.js:5                       doku-schuld  Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)
WARNUNG  scripts/bw_install.js:22                     doku-schuld  Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)
WARNUNG  scripts/bw_main.js:6                         doku-schuld  Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)
WARNUNG  scripts/bw_zeitraffer.js:10                  doku-schuld  Geräte-Doku nennt noch README-Abschnitte (Script-Release nötig)
--- 0 Fehler, 29 Warnungen in 49 Dateien (0.1 s) ---
```

Die Testzahl, die dieses Kapitel nennt, kommt aus demselben Werkzeug mit `--mit-tests` (ruft `node --test` auf, etwa 6 s):

```bash
node tools/check-docs.js --mit-tests   # prüft die Marker fact:tests gegen die tatsächliche Testzahl
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| Zwei Einträge tragen dieselbe Nummer | Nummer aus einem alten Stand vergeben | nächste freie Nummer nehmen (Stand 15.09.2026: 64); Nummern nie umsortieren |
| Ein Verweis wie „Entscheidung 13“ in Code oder Test läuft ins Leere | eine Zeile wurde „bereinigt“ oder gelöscht | alte Zeile stehen lassen, „abgelöst durch N“ eintragen |
| Eine Zahl stimmt nach dem nächsten Commit nicht mehr | Zahl ohne Datum und ohne Fakt-Marker | Datum dazu oder Marker (`fact:tests`, `fact:ver.*`, `def:*`); `check-docs.js` prüft ihn |
| Version im Log passt nicht zur Datei | geplante statt gebaute Version übernommen (Plan: `bw_install` 0.2.0, `hwtest.js` 0.2.0) | `var VER` bzw. Zeile 1 der Datei nachsehen; Marker `fact:ver.*` |
| Messwerte stehen hier und im Prüfprotokoll verschieden | doppelt gepflegt | Messwerte nur in [19](19-pruefprotokoll.md), hier ein Satz mit Verweis |
| „Interview-Entscheidung 13“ mit Tabellenzeile 13 verwechselt | zwei Zählungen (Interview 13.09. und Tabelle) | Tabelle „Interview-Nummern“ oben |
| `check-docs.js` meldet „veraltet“ in diesem Kapitel | alter Wert ohne Kennzeichnung als Historie | „damals“, „abgelöst durch“ dazu; nur einige Muster aus `verboten.json` sind für Kapitel 17 ausgenommen |
| `[TODO am Gerät]` als erledigt markiert | Mock-Test mit Gerätelauf verwechselt | erst nach dem Gerätelauf streichen, Datum und Ergebnis ins Prüfprotokoll |
| `check-docs.js` warnt „Tabellenzelle mit … Zeichen“ in der Entscheidungstabelle | Wortlaut einer alten Entscheidung vollständig übernommen | für die Nummern 1–63 hinnehmen (Beispielausgabe); neue Zeilen unter 400 Zeichen halten, Details in die Nachträge |

## Weiter zu

- [18 · Lernlog vom Gerät](18-lernlog-geraet.md) – jede Überraschung aus den Nachträgen mit Symptom, Ursache, Fix und Regel im Test.
- [19 · Prüfprotokoll am Gerät](19-pruefprotokoll.md) – die Messwerte hinter den Etappen 8–10 und die Vorlage für den nächsten Gerätelauf.
- [16 · Konzept und Entscheidungen](16-konzept-und-entscheidungen.md) – das Warum hinter den Entscheidungen im Zusammenhang, Recherche und verworfene Alternativen.
