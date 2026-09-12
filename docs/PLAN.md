# Programmierplan (PLAN.md) – Bewässerungs-System Shelly Plus Uni

Version 1.1 – 12.09.2026. Teil B des Onboarding-Dokuments v1, ergänzt um die Entscheidungen aus dem Interview und die daraus folgenden Abweichungen. Die Etappen 0–5 wurden in einer Sitzung ohne Gerät gebaut und gegen den Mock in `tools/` geprüft; die Spalte „Prüfung" ist der Prüfschritt am Gerät, den der Projektleiter ausführt.

## Etappe 0 – Repository und Grundgerüst

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Repo anlegen, public, MIT | Ordnerstruktur wie im Prompt | `git log` zeigt ersten Commit |
| Konzeptdokumente nach `docs/` | fünf Dateien vorhanden | Claude Code fasst sie zusammen |
| `scripts/lib_notes.md` | Liste aller genutzten RPC-Aufrufe mit Doku-Link: `Schedule.List/Create/Delete`, `Script.List/Start/Stop/SetConfig`, `KVS.Get/Set/GetMany`, `Voltmeter.GetStatus`, `Temperature.GetStatus`, `Input.GetStatus`, `Switch.Set`, `Sys.GetStatus` | jeder Aufruf gegen die Doku geprüft |
| README-Gerüst | alle Überschriften, noch leer | Struktur abgenommen |
| Testhelfer (Entscheidung 4) | `tools/mock/shelly-mock.js`, `npm test` | Tests laufen ohne Gerät |

## Etappe 1 – Installer (`bw_install.js`)

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Script-IDs über Namen finden | Funktion `findScriptId(name)` | Konsole zeigt IDs |
| Alte eigene Zeitplan-Einträge löschen | wiederholbar | zweimal starten → keine Duplikate |
| Drei Zeitplan-Einträge anlegen | `0 */15 * * * *`, `0 0 8,20 * * *`, `0 5 8,20 * * *` (Fenster aus `cfg3.winA/winB`) | `Schedule.List` in der Web-UI |
| cfg1/cfg2/cfg3 nur wenn nicht vorhanden | Startwerte aus Katalog | KVS-Ansicht zeigt drei Einträge |
| st, day, err, lrn, job initialisieren | leere Startzustände | KVS-Ansicht |
| Switch-Konfiguration (Entscheidung 12) | `initial_state off`, `auto_off` = tMax + 10 s | Switch-Einstellungen in der Web-UI |
| Selbstbeendigung | `Script.Stop` auf eigene ID | Script steht nach dem Lauf |

## Etappe 2 – Main nur messen (`bw_main.js`, Stufe 1)

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| cfg1–3 lesen, Pflichtfelder prüfen | fehlt eines → err, Ende | Feld löschen → err erscheint |
| Feuchte messen, umrechnen, filtern | `readMoisture()` | vier Takte lang plausible Prozentwerte |
| Temperatur, Wasserstand lesen | `readTemp()`, `readLevel()` | Konsole zeigt Werte |
| Plausibilität | err bei V außerhalb | Sensor abstecken → err |
| Tageswechsel per Datum | day zurückgesetzt | Datum im KVS ändern → Reset |
| Selbstbeendigung, Laufzeit < 5 s |  | Konsole zeigt Dauer |

## Etappe 3 – Main entscheidet (`bw_main.js`, Stufe 2)

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Freigabekette | Bedarf-Logik mit Begründung in `job.why` | jede Bedingung einzeln provozieren |
| Dosis mit tDead, tMin, tMax, pctSoll | `calcSeconds()` | Hand-Werte im KVS → erwartete Sekunden |
| Pausenregel dreistufig | `calcPause()` | Tagesmax und dropSlow variieren |
| Trockenphase | `st.dryOk` | Verlauf simulieren |
| job schreiben, nur bei Änderung (Entscheidung 11) |  | `Sys.GetStatus` → `kvs_rev` vorher/nachher vergleichen |

## Etappe 4 – Pumpe (`bw_pump.js`)

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| job lesen, Alter, Tageslimit prüfen | Abbruchgründe in err | alten Auftrag setzen → kein Gießen |
| Wasserstand vor und während der Gabe | Abbruch bei leer | Sensor während Lauf ziehen |
| `Switch.Set` mit `toggle_after` | Pumpe läuft exakt sec | Stoppuhr, Relais hörbar |
| Ergebnis in st, day; job verbrauchen |  | KVS nach Lauf |
| Erste Gabe mit tStd | 70 s | Hand-Auftrag ohne Lernwert |

## Etappe 5 – Lernen und Schutz

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Bewertung 30 min nach Gabe | `rateLastRun()` | lrn.eff nach echter Gabe plausibel |
| Keine Wirkung → err, kein Lernwert |  | Schlauch abziehen → err, kein zweiter Auftrag |
| Austrocknungsrate, Staunässe-Verdacht | lrn.rate | mehrere Tage Verlauf |
| Speicherverbrauch protokollieren | err.mem | Wert stabil über Tage |

## Etappe 6 – Sicherheit und Störfälle durchspielen

Sicherheits-Aus greift auch bei abgestürztem Script 2 · Ausgang nach Neustart aus · Tageslimit · Uhrzeit ungültig nach Stromausfall ohne Internet (System pausiert, kein Fehlverhalten) · alle err-Codes einmal ausgelöst und in der README erklärt. Vorlage: `docs/pruefprotokoll-etappe6.md`.

## Etappe 7 – README fertigstellen

Stückliste mit Bezugsquellen, Verdrahtung mit Bild, Kalibrieranleitung, Installationsschritte in der Web-UI, Konfigurationstabelle aus dem Katalog, Betriebsanleitung, Störungstabelle, Sicherheitshinweise, Funktionsbeschreibung, Grenzen. Abschluss: eine unbeteiligte Person baut nach der README nach – ohne Rückfrage. Stand: README vollständig, Stellen mit `[TODO am Gerät]` sind noch offen.

* * *

## Entscheidungen aus dem Interview vom 12.09.2026

| # | Thema | Entscheidung |
| --- | --- | --- |
| 1 | Konzeptdokumente | liegen in `docs/` |
| 2 | Lizenz | MIT, Copyright (c) 2026 Robert-AI-Development |
| 3 | Umfang der ersten Sitzung | Etappe 0–5 komplett, Etappe 6 als Prüfprotokoll-Vorlage, Etappe 7 README mit Platzhaltern |
| 4 | Testhelfer | ja, ab Etappe 0 in `tools/` (Node ≥ 20, keine Abhängigkeiten) |
| 5 | Komponenten-IDs | in cfg1: `idV` 100 (Voltmeter), `idT` 100 (Temperature), `idLvl` 1 (Input), `idSw` 0 (Switch) |
| 6 | Temperaturfühler-Ausfall | weitergießen; `err.code = "temp"` blockiert nicht; Hitzeregel ist dann inaktiv |
| 7 | „Keine Wirkung" | `eff_neu < effMin` → `err "noeff"`, kein Lernwert |
| 8 | err-Reset | `noeff` nur von Hand (KVS-Eintrag `err` löschen); alle anderen Codes löschen sich, sobald die Ursache weg ist |
| 9 | Analogeingang | `voltmeter:100`, `Voltmeter.GetStatus` liefert Volt |
| 10 | pctHi-Regel | Sicherheitsfaktor `lrn.sf` (Start 1.0); neue cfg2-Felder `sfMin` 0.5, `sfStep` 0.1; Dosis wird mit `sf` multipliziert |
| 11 | job schreiben | bei Änderung von `ok/sec/why/pct` **oder** wenn das nächste Gießfenster im nächsten Takt liegt; `bw_main` liest `winA/winB` aus cfg3, der Installer baut den Zeitplan aus denselben Feldern |
| 12 | Switch-Konfiguration | Installer setzt `Switch.SetConfig {initial_state:"off", auto_off:true, auto_off_delay: tMax + 10}` |

## Abweichungen vom Onboarding-Prompt (alle aus Entscheidungen oder aus Widersprüchen der Docs)

- **cfg1** zusätzlich `msSample` (ms zwischen zwei Messungen, Start 500) und die vier ID-Felder. Zeitkonstanten gehören laut Prompt in den KVS, nicht in den Code.
- **cfg2** zusätzlich `sfMin`, `sfStep` (Entscheidung 10).
- **cfg3** zusätzlich `tChk` (s zwischen zwei Wasserstandsprüfungen während der Gabe, Start 5; Wert aus umsetzungsplan-v1 Abschnitt 3). `winA`/`winB` sind funktional (Entscheidung 11).
- **lrn** hat `sf` (Entscheidung 10) und `tMaxD`/`tMaxY` (Tagesmaximum heute/gestern) statt `tMax24`. Grund: Die Hitzeregel muss um 08:00 das Maximum des Vortags kennen; `tMax24 = max(tMaxD, tMaxY)` wird gerechnet, nicht gespeichert.
- **Installer** setzt `Script.SetConfig {enable:false}` für `bw_main` und `bw_pump` (umsetzungsplan-v1 sagt `enable:true`). In der Gen2-API bedeutet `enable` „Autostart beim Boot"; `Script.Start` aus dem Zeitplan funktioniert unabhängig davon. Ein Autostart von `bw_pump` nach einem Neustart könnte außerhalb der Fenster gießen.
- **KVS-Schreibzähler** (Etappe 3): kein eigenes Feld, sondern `Sys.GetStatus.kvs_rev` vorher/nachher; im Mock ein Zähler.
- **err-Codes**: `cfg`, `uhr`, `sensor`, `wasser`, `noeff` blockieren den Auftrag; `temp`, `zuviel`, `alt`, `limit` sind Hinweise. `noeff` wird nie überschrieben, ein blockierender Code überschreibt einen Hinweis, unter den blockierenden gilt cfg > uhr > sensor > wasser.
- **Gleichzeitiger Start** von `bw_main` und `bw_pump` um 08:00/20:00: unkritisch, weil `bw_pump` seine Ergebnisse am Ende per Lesen-Ändern-Schreiben ablegt und `job.ok=false` als letzten Schritt setzt.

## Nachträge aus der 7-Tage-Simulation (tools/test/szenario.test.js)

- **Pause mit Toleranz:** Der Auftrag entsteht einen Takt vor dem Fenster (07:45), die Gabe startet Sekunden nach dem Fenster. Eine Pause von exakt 24 h würde das nächste 08:00-Fenster um Sekunden verfehlen und die Gabe auf 20:00 schieben. Deshalb gilt die Pause als abgelaufen, wenn sie beim nächsten Fenster bis auf einen Takt (15 min) vorbei ist. Das entspricht der Regel „das erste Fenster nach Ablauf" aus umsetzungsplan-v1 Abschnitt 5.
- **Tagesmaximum in 2-°C-Schritten:** `lrn.tMaxD` wird auf gerade Grad gerundet, damit ein Sommertag nicht zehn Schreibvorgänge erzeugt. Das Überschreiten von `tHot` wird unabhängig davon exakt erfasst.
- **job vor dem Fenster** wird nur aufgefrischt, wenn `job.ok = true` ist; bei `ok = false` prüft `bw_pump` das Alter nicht.
- **Störung bei unlesbarem Wasserstand:** Ist der Wasserstand in einem Takt unstabil, bleibt eine stehende Störung `wasser` erhalten (weder gesetzt noch gelöscht).
- **Erfahrungswerte:** 8–9 KVS-Schreibvorgänge an Tagen ohne Gabe, 13–16 an Tagen mit Gabe; `bw_main` läuft im Mock 2,6 s, `bw_pump` `sec` + 5–7 s.
- **Stand der Prüfung:** 53 Tests in `tools/test/` grün (Installer, Messen, Freigabekette, Dosis, Pause, Pumpe, Lernen, Szenario über sieben Tage inklusive Hitzetage und „keine Wirkung").

## Offen, bevor Etappe 3 am Gerät abgeschlossen werden kann

- `pctSoll`, `pctLo`, `pctHi`, `pctDry` aus den zwei Messungen an der Pflanze
- `dropSlow` für die 48-h-Regel
- Bestätigung: Eingang 1 (`input:1`, Klemme IN2) = 1 bedeutet leer
- Bestätigung: Analogeingang heißt `voltmeter:100`, DS18B20 heißt `temperature:100` (erste Konsolenzeile von `bw_main`)
