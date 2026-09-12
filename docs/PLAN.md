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

## Etappe 8 – Hardware-Test (`bw_hwtest.js`, `bw_hwpump.js`, `tools/hwtest.js`)

Zwei Test-Scripts prüfen die Hardware phasenweise mit dem Menschen am Aufbau (Interview über Claude Code): Fühler ≤ 20 °C und ≥ 30 °C, Sensor trocken und im Wasser (Kalibrierpunkte automatisch nach `cfg1`), Schwimmer LEER und VOLL (`lvlEmpty`), Pumpe über den echten `bw_pump`-Pfad (Auftrag im KVS, `Script.Start`, Sicherung und Rückbau der Zustände). Vorher im Mock simuliert (`tools/mock/hwdemo.js`, `--hwdemo`), am Gerät über den Tunnel gefahren.

| Aufgabe | Ergebnis | Prüfung |
| --- | --- | --- |
| Sensorphasen mit Kommandokanal `hwc`, Stand `hwr`, Schwellen `hwt` | `bw_hwtest.js` | 12 Tests; Gerät 13.09.2026: alle Phasen ok, vDry 0,296 V, vWet 3,134 V, lvlEmpty 1 |
| Pumpentest über `bw_pump` mit Sicherung/Rückbau | `bw_hwpump.js` (zwei Durchgänge) | 15 Tests; Gerät 13.09.2026: 30 s gepumpt, KVS byteidentisch zurückgebaut |
| Mock: zweites Script per `Script.Start`, Input-Konfiguration, Laufgeneration | `shelly-mock.js` v0.1.2 | bestehende 58 Tests unverändert grün |
| Steuerung vom VPS | `tools/hwtest.js` | Gerätelauf komplett über das Werkzeug geführt |

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
| 13 | Schrittliste `steps[]` am Dateiende | mJS hoistet Funktionsdeklarationen nicht; `var steps = [stepRead, …]` oben in der Datei bricht am Gerät mit `ReferenceError` ab (erster Gerätetest 12.09.2026). Die Liste steht deshalb in allen drei Scripts direkt vor dem abschließenden `next()`. `syntax.test.js` prüft „Verwendung vor Deklaration auf Modulebene“, weil der Node-Mock hoistet und den Fehler nicht zeigt. Details in `LEARNING.md` |
| 14 | Flache Schrittkette | mJS bricht bei etwa 10 verschachtelten Aufrufen ab (`bw_pump` am Gerät: „Too much recursion“). `next()` ist eine Schleife; synchron fertige Schritte geben `true` zurück, asynchrone rufen `next()` aus dem Callback, Warteschlangen-Treiber geben `true` bei leerer Warteschlange. Aufruftiefe im Mock gemessen und auf 10 begrenzt (Gerät: 12 ok, 14 Absturz; Scripts vorher 9–11, jetzt 5). Details in `LEARNING.md` |
| 15 | KVS-Werte als JSON-Strings | Das Gerät speichert Objekte korrekt (Probe am 12.09.2026), aber die Web-UI zeigt sie als `[object Object]` und kann sie nicht bearbeiten – `cfg2` wird aber von Hand gepflegt. Deshalb `JSON.stringify` beim Schreiben, `fromKvs()` (JSON.parse) beim Lesen; der Mock hält Rohwerte wie das Gerät und meldet Nicht-String-Werte. Gleiches Muster wie im Referenz-Script des Projektleiters (Spotelly) |
| 16 | Installer ersetzt unlesbare Einträge | Ein KVS-Eintrag, der kein JSON-Objekt ergibt (z. B. `[object Object]` aus v0.1.0 oder ein Tippfehler beim Bearbeiten), wird durch die Startwerte ersetzt und in der Konsole gemeldet. Gültige Einträge werden weiterhin nie überschrieben |
| 17 | Upload aus `dist/` | Script-Speicher am Gerät ist begrenzt (~15.000 Byte seit FW 1.0.3); `bw_main.js` mit Kommentaren überschreitet das. `npm run build` schreibt die Kompakt-Ausgabe (Kommentare, Einrückung, Leerzeilen entfernt, Versionszeile bleibt), `size.test.js` prüft Grenze und `node --check`. `scripts/` bleibt die einzige Quelle. Nachtrag: Firmware 2.0.0 speichert auch 19 KB – die 15-KB-Grenze bleibt als Vorsichtsmaß im Test |
| 18 | Debug-Schalter | `var DEBUG = 0;` in jedem Script; `dbg()` loggt nur bei 1. `rpc()` kapselt `Shelly.call` und loggt Methode + Parameter, `next()` loggt jeden Schritt, `onKvsPage` jeden Eintrag mit Typ, dazu Messwerte (Proben, Wasserstand, Pumpen-Überwachung, Auftrag). Kostet eine Stack-Ebene (Tiefe 5 statt 4) und ~0,6 KB |
| 19 | Upload per RPC mit Größenkontrolle | Der Editor der Web-UI hat beim Einfügen das Dateiende verloren (166/210 Byte). `tools/put-script.js` lädt per `Script.PutCode` in Stücken hoch und vergleicht `Script.GetCode → left` mit der Dateigröße; auch nach Einfügen im Editor ist diese Kontrolle Pflicht (README) |
| 20 | Schedule.Create-Retry | Der erste `Schedule.Create` je Installer-Lauf scheitert am Gerät mit einem irreführenden „timespec validation"-Fehler (Inhalt egal; per curl/Probe ist derselbe Aufruf gültig). `onCreate` wiederholt bis 3× nach 400 ms; der zweite Versuch gelingt. Mock bildet den Quirk nach (`schedCreateFailFirst`), zwei Tests sichern den Retry. Root Cause vermutlich espruino-Heap des großen Scripts, nicht abschließend geklärt |
| 21 | Eigene Test-Scripts (Etappe 8) | Hardware-Test als zwei eigene Scripts `bw_hwtest`/`bw_hwpump` (Langläufer 10–30 min, nur von Hand gestartet, nie im Zeitplan, `enable:false`) statt Erweiterung von `bw_main`/`bw_pump`. Ein Script wäre 23,7 KB kompakt gewesen – über der 15-KB-Grenze; Aufteilung in Sensor- und Pumpenteil |
| 22 | Kommandokanal `hwc` | Mensch/Werkzeug schreiben `{n, cmd: go\|skip\|abort}` in den KVS; das Script pollt alle `nCmd` Ticks per `KVS.Get`, verarbeitet nur `n` größer als zuletzt gesehen (alte Kommandos wirken nie) und verwirft `go` in Phasen, die nicht warten. Alternative `Script.Eval`/Web-UI verworfen: KVS ist überall sichtbar und im Mock nachgebildet |
| 23 | Pumpe nur über `bw_pump` | Der Test schaltet die Pumpe nie ein; er setzt `err={code:null}`, `day` (bei Tageslimit) und `job={ok:true,sec:pumpSec,pct:null,why:"hwtest"}` und startet `bw_pump`. `pct:null` verhindert Bewertung und Lernwert. Nur `Switch.Set on:false` als Sicherheits-Aus |
| 24 | Zeitwache statt Zeitplanänderung | Pumpenstart nur in der Lücke zum 15-min-Takt (`guardS` 90 s nach dem Takt bis 900 − guardS − pumpSec) und nicht ± `winMin` (25 min) um `winA`, `winB` und Mitternacht. Der Bewässerungs-Zeitplan wird nie angefasst |
| 25 | Sicherung/Rückbau im KVS | `st/day` → `hwb1`, `job/err/lrn` → `hwb2` (zwei Schlüssel, zusammen > 253 Zeichen) vor dem Auftrag; Rückbau danach, `job.ok` immer false, Sicherung gelöscht. Stehen `hwb1/hwb2` beim Start (Absturz, Stop von außen), ist der Lauf automatisch Durchgang B (Wiederanlauf, `rec:1`); `tools/hwtest.js restore` als Notweg |
| 26 | Kalibrierwerte automatisch | Interview-Entscheidung: `bw_hwtest` schreibt `vDry/vWet/lvlEmpty` nach `cfg1` (Lesen-Ändern-Schreiben auf frisch gelesenem `cfg1`), wenn plausibel: Trockenpunkt nur nach `go`, ≤ `vDryMax`, ≥ `vErrLo`+0,05; Nasspunkt ≥ `vWetMin`, ≤ `vErrHi`−0,10; `vWet − vDry ≥ 1 V`; Schwimmer LEER ≠ VOLL und mindestens ein beobachteter Wechsel. Sonst nur Meldung; Schalter `hwt.cal` |
| 27 | Mock führt `Script.Start` aus | Registrierte Dateien (`dev.files`) laufen als zweites Script im selben Ereignisstrom; Timer, Fehler und RPC-Callbacks je Script und je Laufgeneration; Input-Konfiguration mit `state:null` bei `enable:false`; `dev.onRpc`-Hook für den virtuellen Bediener |
| 28 | Zwei Durchgänge wegen geteiltem Heap | Der Script-Heap (~25 KB) ist von allen Scripts geteilt; `bw_pump` braucht mit den Test-Einträgen über 15,8 KB Spitze und starb neben dem Test-Script mit `out_of_memory`. Durchgang A startet `bw_pump` und beendet sich; B bewertet und baut zurück; `hwtest.js watch` startet B automatisch. Beide Test-Scripts geben `K/orig` in Wartephasen frei, damit `bw_main` im Takt weiterläuft (9,0/9,6 KB statt 13,5 KB). Messwerte in `LEARNING.md` |

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

## Nachträge aus dem ersten Gerätetest (12.09.2026)

- **Abweichung zu Etappe 1/2/4:** Die Scripts v0.1.0 starteten am Gerät gar nicht (`ReferenceError: "stepRead" is not defined`), obwohl alle 53 Mock-Tests grün waren. Ursache und Fix: Entscheidung 13; Lern-Log in `LEARNING.md`. Version der drei Scripts jetzt 0.1.1.
- **Zweiter Fehler am Gerät:** `bw_pump` starb mit „Too much recursion“ – die verschachtelte Schrittkette (jeder Schritt ruft `next()`, das den nächsten Schritt ruft) war 9–11 Ebenen tief. Fix: Entscheidung 14. Der Mock misst die Aufruftiefe jetzt selbst (`max. Aufruftiefe` in `tools/run-script.js`).
- **Probe am Gerät (`tools/probe/engine_probe.js`):** `KVS.Set` funktioniert mit RPC-Objekten, Literalen, JSON-Kopien und Strings gleichermaßen (ec=0); `KVS.GetMany` liefert `items` als Array; der frühere Fehler `KVS.Set lrn: Missing required argument 'key'` ließ sich nicht reproduzieren – er trat nur in der tiefen Aufrufkette auf und wird nach dem Umbau beobachtet. Stackgrenze: siehe `LEARNING.md`.
- **Dritter Fehler am Gerät:** `bw_main` v0.1.1 brach mit `ReferenceError: "evalSamples" is not defined` ab – eine Funktion aus der Dateimitte fehlte, obwohl derselbe Pfad mit v0.1.0 lief. Ursache per `Script.GetCode` bestätigt: am Gerät fehlten 166 (`bw_install`) bzw. 210 Byte (`bw_main`) am Dateiende – Verlust beim Einfügen im Editor, nicht das Speicherlimit (Firmware 2.0.0 hält 19 KB). Abhilfe: Entscheidung 19.
- **Grenze des Mocks:** Der Mock führt die Scripts in V8 aus (`vm.runInNewContext`). Was V8 großzügiger auslegt als mJS (Hoisting, Stacktiefe, evtl. weitere Sprachdetails), fällt nur am Gerät oder über Regeln in `syntax.test.js` bzw. Messungen im Mock auf. Jede weitere Engine-Überraschung wird dort nachgetragen.

## Nachträge aus dem Hardware-Test (13.09.2026)

- **Vierter Engine-Fehler:** `bw_hwtest` starb nach dem ersten Messtick mit `Function "shift" not found!` – mJS kennt `Array.prototype.shift` nicht. Ringpuffer per Index; neue Regel in `syntax.test.js` (verbotene Array-Methoden). `LEARNING.md`.
- **Fünfter Engine-Fehler:** `bw_pump` starb neben dem laufenden Test-Script mit `out_of_memory`, ebenso `bw_main` im Takt. Der Script-Heap (~25 KB) ist geteilt. Entscheidung 28; Zahlen in `LEARNING.md`. Normalbetrieb (`bw_main` + `bw_pump` um 08:00) ist nicht betroffen (je ~7,4 KB).
- **Gemessen:** `KVS.GetMany` 11 Einträge je Seite; Trockenpunkt 0,296 V (12.09.: 0,20 V – Sensor damals in Erde/feucht?), Nasspunkt 3,134 V, `lvlEmpty` 1 bestätigt; Fühler 19,8–33,5 °C; Flash `fs_free` nach zwei Test-Scripts 24.576 Byte.
- **Testzahl:** 89 (58 bisher + 12 `hwtest.test.js` + 15 `hwpump.test.js` + 4 Größe/Syntax).

## Offen, bevor Etappe 3 am Gerät abgeschlossen werden kann

- `pctSoll`, `pctLo`, `pctHi`, `pctDry` aus den zwei Messungen an der Pflanze
- `dropSlow` für die 48-h-Regel
- ~~Bestätigung: Eingang 1 (`input:1`, Klemme IN2) = 1 bedeutet leer~~ – bestätigt 13.09.2026 per `bw_hwtest` (LEER = 1, VOLL = 0)
- ~~Kalibrierpunkte `vDry`/`vWet`~~ – gemessen 13.09.2026 per `bw_hwtest` (0,296 V / 3,134 V, in `cfg1` geschrieben)
- ~~Bestätigung: Analogeingang heißt `voltmeter:100`, DS18B20 heißt `temperature:100`~~ – bestätigt 12.09.2026 (`bw_main`: `V=0.28 … tC=24.4` mit den Standard-IDs 100)
