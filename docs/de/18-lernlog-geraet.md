# 18 · Lernlog vom Gerät

**Deutsch** · [English](../en/18-lernlog-geraet.md) — [Handbuch](README.md) · Teil F „Entwicklung“

> **Auf einen Blick**
> - Was der Mock nicht zeigt und erst am Shelly Plus Uni auffällt: elf Einträge vom 12. und 13.09.2026, jeder nach demselben Schema **Symptom · Ursache · Warum unentdeckt · Fix · Vorbeugung**. Neue Einträge kommen oben dazu.
> - Jeder Fund endet in etwas, das prüft: statisch prüfbar → `syntax.test.js`, Verhalten → Nachbildung im Mock, Arbeitsweise → harte Regel in CLAUDE.md. Ein Satz in der Doku schützt nicht, nur ein Test.
> - Die Zahlen, die daraus wurden: geteilter Script-Heap rund 25 KB; Aufruftiefe 12 Ebenen laufen, 14 stürzen ab (Mock-Grenze <!-- fact:call_depth -->10<!-- /fact -->); Kompakt-Ausgabe ≤ <!-- fact:size_limit -->16 000<!-- /fact --> B je Script, `bw_pump` ≤ <!-- fact:size_limit_pump -->18 000<!-- /fact --> B; `bw_pump` startet 30 s nach `bw_main`.
> - Größter Stolperstein: eine Fehlermeldung wörtlich nehmen. `Invalid argument 'timespec'`, `Got EOF`, `[object Object]` und `ReferenceError` meinten am Gerät etwas anderes, als sie sagten – erst per curl oder Probe-Script gegenprüfen, dann den Code verdächtigen.

## Voraussetzungen

- keine – ein Lesekapitel. Wer selbst am Gerät nachmisst, braucht die Konsole und die Werkzeuge aus [14 · Debuggen und Testen](14-debuggen-und-testen.md); die Messwerte hinter den Einträgen stehen in [19 · Prüfprotokoll](19-pruefprotokoll.md), die Engine-Fakten mit Messdatum in [20 · RPC-Referenz](20-rpc-referenz.md).

## Diagramm

[![Datenfluss: Fehlerzeile aus Konsole oder Script.GetStatus, Symptom, Gegenprobe per curl oder Probe-Script, Ursache, Fix in Script oder Werkzeug, dann Regel in syntax.test.js, Nachbildung im Mock, Regel in CLAUDE.md und Eintrag im Lernlog](../diagramme/de/18-lernlog-geraet.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/18-lernlog-geraet.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/18-lernlog-geraet.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Vom Symptom zur Ursache“, 2 „Fix in Script oder Werkzeug“, 3 „Wo die Regel landet“.

## So entsteht ein Eintrag

Das Schema ist Pflicht, weil jeder Absatz eine andere Frage beantwortet:

| Absatz | Frage | Was hinein muss |
| --- | --- | --- |
| Symptom | Was hat das Gerät gemeldet? | Konsolenzeile oder `Script.GetStatus.errors` wörtlich, Uhrzeit, Script-Version, Firmware |
| Ursache | Was steckt wirklich dahinter? | die Gegenprobe (curl, Probe-Script, Messung), die die Ursache belegt – nicht die erste Vermutung |
| Warum unentdeckt | Warum haben Mock und Tests es nicht gezeigt? | die Lücke im Mock (kein Speichermodell, V8 hoistet …) oder im Test |
| Fix | Was wurde geändert? | Script, Installer oder Werkzeug mit Version; Entscheidungsnummer aus [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md) |
| Vorbeugung | Was prüft das ab jetzt? | Regel in `syntax.test.js`, Nachbildung im Mock, harte Regel in CLAUDE.md, Prüfung im Werkzeug |

Wenn das Gerät überrascht, in dieser Reihenfolge:

1. Symptom sichern: Konsolenzeile aus `tools/console.js` oder `hwtest.js watch`, dazu `Script.GetStatus` – `errors` bleibt bis zum nächsten Lauf stehen und verrät einen stillen Absturz.
2. Gegenprobe machen: dieselbe Anfrage per curl oder aus einem kleinen Probe-Script ([tools/probe/engine_probe.js](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/probe/engine_probe.js)), bevor der Code verdächtigt wird.
3. Im Mock nachstellen: Nachbildung oder statische Regel schreiben, Test rot, Fix, Test grün (`npm test`).
4. Eintrag oben in dieses Kapitel, Zeile in der Regel-Tabelle, Entscheidung in Kapitel 17.
5. Messwerte ins Prüfprotokoll (19), Engine-Fakten in die RPC-Referenz (20).

> **Hinweis:** Der Mock hat kein Speichermodell und keine Stackgrenze der Engine – er misst die Aufruftiefe nur nach. Heap-Spitzen (`mem_peak`) gibt es nur am Gerät: `node tools/hwtest.js <ip> scripts` oder die Statuszeile von `status`/`watch` (nur im Zeitraffer).

## Regeln aus den Funden

| Fund | Regel | Prüft es | Datum |
| --- | --- | --- | --- |
| Lernwert im Zeitraffer hat die falsche Totzeit-Skala | `cfg3.tDead` gehört zum Schlauch: nach jedem Umbau `hwtest.js mess` (CLAUDE.md „Messlauf vor Zeitwert-Änderungen“); Lernwerte nie zwischen Profilen kopieren, ohne die Totzeit mitzunehmen (Kopierverbot nur hier) | `bw_pump` nennt `tRise` je Portion; `tools/lib/kal.js` rechnet auf „% je s nach tRise“ um (`kal.test.js`) | 13.09.2026 |
| Kurze Pulse messen den Schlauch, nicht die Erde | Portionen nie kürzer als die Totzeit (`tPmin`/`tMin` ≥ `tDead2`/`tDead`); Messlauf vor jeder Änderung der Zeitwerte | Topfmodell `potModel()` mit Totzeit, Rampe, Drainage (`potmodel.test.js`, `pump.test.js`) | 13.09.2026 |
| `bw_pump` stirbt neben `bw_main` (`out_of_memory`) | Zwei Scripts nie zur selben Sekunde starten: `PUMP_SEC` 30; Spitzen während des Laufs messen, nicht `mem_free` im Leerlauf | `install.test.js` (Zeitplan `30 0 8,20`), `zeitraffer.test.js` (kein Fenster läuft in einen Takt), Überlappungswächter im Mock | 13.09.2026 |
| Test-Script neben `bw_pump` (`out_of_memory`) | Nie zwei große Scripts gleichzeitig; Langläufer geben `K`/`orig` in Wartephasen frei; ein Script, das ein zweites startet, beendet sich | Pumpentest in zwei Durchgängen (`hwpump.test.js`); Mock führt `Script.Start` als zweites Script aus | 13.09.2026 |
| `Function "shift" not found!` | Array-Methoden nur `push`, `slice`, `splice`, `indexOf`, `join`; Ringpuffer per Index | `syntax.test.js` verbietet `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort` | 13.09.2026 |
| Erster `Schedule.Create` je Lauf scheitert | Ein „validation failed“ der Firmware nie wörtlich nehmen – erst per curl gegenprüfen (Regel nur hier und im Mock-Quirk, nicht in CLAUDE.md) | Mock `schedCreateFailFirst` (Standard an); `install.test.js`: Retry erzeugt alle Einträge, keine Konsolenzeile | 12.09.2026, Nachtrag 13.09. |
| Editor verliert das Dateiende | Upload nur mit `put-script.js`, danach `verify-scripts.js` – nach jedem Upload, auch per Editor | `put-script.js` vergleicht byteidentisch und prüft den Flash; `verify-scripts.js` ist Prüfung 2 | 12.09.2026 |
| `"evalSamples" is not defined` | Nur `dist/` aufs Gerät; Kompakt-Ausgabe unter der Größengrenze | `size.test.js`: ≤ <!-- fact:size_limit -->16 000<!-- /fact --> B, `bw_pump` ≤ <!-- fact:size_limit_pump -->18 000<!-- /fact --> B, `node --check` | 12.09.2026 |
| Web-UI zeigt `[object Object]` | KVS-Werte sind JSON-Strings: `JSON.stringify` schreiben, `fromKvs()` lesen | Mock hält Rohwerte und meldet `KVS.Set` mit Nicht-String als Fehler; Installer ersetzt unlesbare Einträge | 12.09.2026 |
| `Too much recursion` | Flache Aufrufkette: `next()` als Schleife, Schritte geben `true` zurück, nie `next()` aus einem Schritt | Mock misst die Aufruftiefe an jeder Engine-Grenze, Grenze <!-- fact:call_depth -->10<!-- /fact --> (`run-script.js`: `max. Aufruftiefe`) | 12.09.2026 |
| `"stepRead" is not defined` | Kein Hoisting: Funktionsnamen auf Modulebene erst nach ihrer Deklaration; `steps[]` ganz unten | `syntax.test.js` `useBeforeDecl` | 12.09.2026 |

Die Regeln stehen im Wortlaut in [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) – bis auf die zwei in der Tabelle markierten, die nur hier und im Mock geführt werden; die Prüfungen in [tools/test/syntax.test.js](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/test/syntax.test.js) und [tools/mock/shelly-mock.js](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/mock/shelly-mock.js). Die Einträge folgen, neueste zuerst.

## 13.09.2026 – Lernwert im Zeitraffer hat die falsche Totzeit-Skala

**Symptom.** Fenster 1 des Zeitraffers (15:54:30, trockene Erde 10,4 %): `P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)`, `P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)`, `ergebnis=unstab n=2 sec=22 effW=2.006`. Der Regelkreis arbeitet – Erstportion, Messung, Korrekturportion, Ziel 50 erreicht –, aber `effW` 2,0 %/s ist der Gewinn je *Profil*-Sekunde.

**Ursache.** `effW` ist definiert als „% je wirksame Sekunde“, wirksam = `sec − tDead` des laufenden Profils. Das Zeitraffer-Profil rechnet mit `tDead` <!-- zr:cfg3.tDead -->2<!-- /zr --> s und `tDead2` <!-- zr:cfg4.tDead2 -->0<!-- /zr --> s, das Wasser kam aber nach 8 bzw. 5 s. Echt: 40,1 % in (12 − 8) + (10 − 5) = 9 s → 4,46 %/s. Mit `kal write` im Profilmaß hätte der Normalbetrieb (`tDead` <!-- def:cfg3.tDead -->20<!-- /def --> s) die Dosis aus 2,0 statt 4,5 gerechnet – zu große Gaben.

Stimmt das Profil nicht mit dem Schlauch überein, wandert der Fehler in den Lernwert. Im Zeitraffer ist die kleine Totzeit gewollt (damit überhaupt gelernt wird), beim Übertragen in den Normalbetrieb nicht.

**Warum unentdeckt.** Das Topfmodell im Mock nutzt dieselben Totzeiten wie das Profil – Profil und „Schlauch“ stimmen dort immer überein.

**Fix.** `bw_pump` nennt je Portion `tRise` (echte Totzeit) in der Konsole; der Rekorder von `hwtest.js kal` schreibt diese Zeilen mit; [tools/lib/kal.js](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/lib/kal.js) rechnet den Lernwert auf die Skala „% je Sekunde nach tRise“ um und schlägt `cfg3.tDead` (Median der `tRise` der Erstportionen) und `cfg4.tDead2` (Median der Folgeportionen) vor. Ohne Konsolenzeilen bleibt es beim Profilmaß mit Warnung; `kal report <json> <log>` zieht die Zeilen aus einer Logdatei nach. Entscheidung 56.

Am Gerät (16:06): `kal write` schrieb `lrn.effW null → 4.46`, `cfg4.tDead2 8 → 5`, `cfg3.tDead 20 → 8` und `cfg3.tMin 25 → 10` (max(`tPmin`, `tDead` + 2)).

**Vorbeugung.** `cfg3.tDead` gehört zum Schlauch, nicht zum Script: nach jedem Umbau `hwtest.js mess` (liefert `tRise`) und die Dosis-Startwerte prüfen. Lernwerte nie zwischen Profilen kopieren, ohne die Totzeit mitzunehmen. `kal.test.js` prüft die Umrechnung ohne Gerät.

## 13.09.2026 – Messlauf: kurze Pulse messen den Schlauch, nicht die Erde

**Symptom.** Drei Pulse à 3 s (`hwtest.js mess 3 3`, Sensor unter zwei Tropfern, Erde 10 %): Puls 1 ohne Reaktion; Puls 2 und 3 heben die Feuchte um 9,5 bzw. 11,7 %, der Wert steigt aber 80–90 s lang weiter (Spitze erst bei 86 bzw. 80 s). Bei 34 % Feuchte bringen 3-s-Pulse nur noch +1–2 % über vier Minuten. Ein 10-s-Puls bei 37,5 %: Anstieg ab 7,9 s (Pumpe läuft noch), Spitze 49,1 % fünf Sekunden nach dem Ausschalten, danach zwei Minuten stabil – kein Kriechen.

**Ursache.** Bei 3-s-Pulsen geht der größte Teil ins Nachfüllen des Schlauchs (Totzeit am Aufbau 5–8 s, im Echtbetrieb laut Nutzer 10–20 s); das Kriechen danach ist Nachlaufwasser, das minutenlang aus dem Schlauch auf den Sensor tropft. Ein Puls, der länger ist als die Totzeit, liefert eine schnelle, saubere Antwort: Die Wasserfront erreicht den Sensor während des Pumpens, der Ruhewert steht etwa 5 s nach dem Ausschalten.

**Warum unentdeckt.** Der Mock hatte bis dahin kein Zeitmodell (Wirkung sofort beim Ausschalten); die Zeitraffer-Profile mit 5-s-Gaben sahen im Mock plausibel aus.

**Fix.** Regelkreis-Startwerte aus dem Messlauf: Korrekturportion mindestens `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> s (länger als die Totzeit), Erstportion `tMin` <!-- def:cfg3.tMin -->25<!-- /def --> s, `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s, `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s, `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s.

Stabilität mit Trendklausel: Spanne der letzten `nStab` <!-- def:cfg4.nStab -->4<!-- /def --> Werte ≤ `dStab` <!-- def:cfg4.dStab -->1<!-- /def --> % **und** Anstieg ≤ `dStab`/2 über (`nStab` − 1) · `tStep` = 15 s. Gewinn am Gerät 5–6 % je wirksame Sekunde bei 37 % (`effMax` <!-- def:cfg2.effMax -->30<!-- /def --> als Sanity-Grenze).

Dazu: Zeitraffer-Portionen mindestens 10 s statt 5 s, und das Topfmodell im Mock (`potModel()` in `tools/test/helpers.js`) rechnet mit Totzeit, Rampe und Drainage. Entscheidung 56 (Messlauf als Werkzeug).

**Vorbeugung.** Portionen nie kürzer als die Totzeit; `hwtest.js mess` vor jeder Änderung der Zeitwerte wiederholen (Rohdaten in `docs/kal/`); für den Nachlauf mindestens 240 s beobachten. Die Puls-Tabelle steht im Prüfprotokoll ([19 · Prüfprotokoll](19-pruefprotokoll.md)).

## 13.09.2026 – bw_pump stirbt neben bw_main mit out_of_memory, sobald beide zur vollen Minute starten

**Symptom.** Im Zeitraffer-Lauf vom Vormittag (`bw_zeitraffer` 0.1.0, `bw_install` 0.1.2, `bw_main` 0.1.2, `bw_pump` 0.1.1; Zeitplan `0 * * * * *` für `bw_main`, `0 */2 * * * *` für `bw_pump`) meldet `Script.GetStatus` von `bw_pump` in jeder geraden Minute `out_of_memory`; Konsole: `JS Error [5] out_of_memory used=791 peak=871 total=1746`. Keine Gabe. `bw_main` v0.1.2 allein: `mem_used` 13 216, `mem_peak` 16 380 (14 KVS-Einträge, Code 15,3 KB), `mem_free` mindestens 11 536; Laufzeit 5–7,5 s.

**Ursache.** Der Script-Heap (rund 25 KB) ist geteilt. `bw_main` hält beim Lesen alle KVS-Einträge doppelt – Objekte in `K`, JSON-Strings in `orig` – und braucht damit über 16 KB Spitze; für `bw_pump`, das zur selben Sekunde startet, bleiben 1,7 KB. Am Morgen desselben Tages lief das Paar um 08:00 noch, weil `bw_main` kleiner war und weniger Einträge lagen – der Spielraum war nur nie gemessen worden.

**Warum unentdeckt.** Der Mock hat kein Speichermodell und führt Zeitplan-Einträge nacheinander aus; die frühere Messung („je ~7,4 KB“, Eintrag darunter) galt einem anderen Moment im Lauf, nicht der Spitze.

**Fix.** Der Installer setzt das Sekundenfeld des Pumpen-Zeitplans auf `PUMP_SEC` 30: `30 0 8,20 * * *`, im Zeitraffer damals `30 */2 * * * *` mit Sicherheits-Aus `45 */2`, heute `30 */6 * * * *`. `bw_pump` startet 30 s nach `bw_main`, das dann längst fertig ist. `hwtest.js` prüft den Zeitplan danach; die Statuszeile von `watch` zeigt im Zeitraffer `mem_used`/`mem_peak` und `errors` beider Scripts. Timespecs mit Sekundenfeld ≠ 0 und `*` in der Minute nimmt das Gerät an (per RPC ohne Retry geprüft). Entscheidung 37.

Runde 2 (11:13–11:31): vier Gaben, `bw_pump` allein `mem_used` ≤ 11 970, `bw_main` unverändert 13 216/16 380, kein Fehler; Rückbau byteidentisch.

**Vorbeugung.** Zwei Scripts nie zur selben Sekunde starten; Spitzenwerte mit `Script.GetStatus` während des Laufs messen (`hwtest.js watch`), nicht nur `mem_free` im Leerlauf. Beim Wachsen von `bw_main` oder der KVS-Einträge zuerst den Heap messen. Seit Etappe 10 gilt „Fensterende + `tTail` vor dem nächsten Takt“ dreifach: Installer (statisch), `bw_pump` (Frist), Mock (Überlappungswächter).

Nebenbefunde: Flash `fs_free` nach dem Upload der sechs Scripts 12 288 Byte (vorher 24 576; mit `engine_probe` lagen sieben Scripts am Gerät) – vor einem weiteren Script `engine_probe` löschen. Die Konsole meldet nach jedem `bw_main`-Lauf `shelly_ejs_timer.cpp:44 Timer 1 handle not found` (`Timer.clear` auf den Mess-Timer) – ohne Folgen.

## 13.09.2026 – Hardware-Test: bw_pump stirbt neben dem Test-Script – der Script-Heap ist geteilt

**Symptom.** `bw_hwpump` (Test-Script, kompakt damals 14,9 KB) startet `bw_pump` per `Script.Start`; `bw_pump` endet sofort ohne eine Konsolenzeile, `Script.GetStatus` zeigt `"errors":["out_of_memory"]`. Während der Sensortest lief, starb auch `bw_main` im 15-min-Takt so. Nach einer ersten Speicherdiät lief `bw_pump` an und pumpte 30 s, starb dann aber beim zweiten KVS-Lesen – `st/day/job` wurden nie geschrieben.

**Ursache.** Alle Scripts teilen sich einen Heap von etwa 25 KB; `Script.GetStatus` meldet im Leerlauf für jedes Script dasselbe `mem_free: 24920`. Gemessen:

- `bw_hwpump` belegte 13 552 Byte (Spitze 15 400), weil es alle KVS-Einträge als Objekte plus `orig`-Strings über die ganze Wartezeit hielt; für `bw_pump` (7 396 beim Parsen) blieben 11 354 – zu wenig.
- Ohne `K`/`orig` in den Wartephasen: `bw_hwpump` 9 044, `bw_hwtest` 9 576. Damit laufen `bw_main` (5 404 beim Parsen) und `bw_pump` daneben an.
- `bw_pump` braucht beim erneuten Lesen von 13 KVS-Einträgen (mit den Test-Einträgen `hwt`, `hwr`, `hwp`, `hwb1`, `hwb2`) über 15,8 KB Spitze – neben einem 9-KB-Script wieder `out_of_memory`.
- `bw_main` + `bw_pump` gleichzeitig (Normalbetrieb um 08:00/20:00) liefen an diesem Morgen noch (je ~7,4 KB; `bw_main` ist nach 4 s fertig, bevor `bw_pump` seine Spitze hat) – wie knapp das war, zeigt der Eintrag darüber.

**Warum unentdeckt.** Der Mock hat kein Speichermodell; bisher lief immer nur ein Script, und die Betriebs-Scripts sind nach Sekunden fertig. Ein Langläufer neben einem zweiten Script war ein neues Muster.

**Fix.** (1) Beide Test-Scripts setzen `K = {}; orig = {};`, sobald sie warten; der Stand wird vor dem Schreiben neu gelesen. (2) Der Pumpentest läuft in zwei Durchgängen: A bereitet den Auftrag vor, startet `bw_pump` und beendet sich; `bw_pump` pumpt allein; B (erkennbar an der Sicherung `hwb1`/`hwb2`) bewertet, baut zurück und berichtet. `hwtest.js watch` startet B automatisch. Entscheidung 28.

**Vorbeugung.** Regel in CLAUDE.md: nie zwei große Scripts gleichzeitig laufen lassen; Langläufer geben KVS-Objekte in Wartephasen frei; vor einem `Script.Start` aus einem Script `mem_free` bedenken. `hwtest.js scripts` zeigt Größe, `running` und `mem_peak` aller Scripts, `preflight` nur die laufenden (dazu `ram_free`/`fs_free`); die Statuszeile von `status`/`watch` zeigt `mem_used`/`mem_peak` nur im Zeitraffer; `Script.GetStatus.errors` bleibt bis zum nächsten Lauf stehen und verrät den Absturz. Ein Speichermodell im Mock gibt es nicht – die Zahlen oben sind die Referenz.

Nachbildung im Mock: `Script.Start` führt eine registrierte Datei als zweites Script aus, und Callbacks eines beendeten Laufs treffen keinen Neustart desselben Scripts (Laufgeneration) – sonst stürbe Durchgang B im Mock an einem `Script.Stop`-Callback aus Durchgang A. Entscheidung 27.

## 13.09.2026 – Function "shift" not found!: mJS kennt Array.prototype.shift nicht

**Symptom.** `bw_hwtest` bricht am Gerät nach dem ersten Messtick ab: `ABBRUCH: Function "shift" not found!` – im Mock lief derselbe Ringpuffer (`push` + `shift`) fehlerfrei.

**Ursache.** Die Shelly-Engine implementiert nur einen Teil der Array-Methoden: `push`, `slice`, `splice`, `indexOf`, `join` sind belegt; `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort` gelten als nicht vorhanden.

**Warum unentdeckt.** V8 im Mock kennt alle Methoden; `syntax.test.js` prüfte Sprachkonstrukte, keine Methodennamen.

**Fix.** Ringpuffer per Index (`ring[i % n] = v`, Lesen über `(i − 1 − k) % n`), keine Array-Methoden außer `push`.

**Vorbeugung.** Neue Regel in `syntax.test.js`: die genannten Methodennamen sind in `scripts/*.js` verboten; dieselbe Liste steht als harte Regel in CLAUDE.md.

## 12.09.2026 – Installer: erster Schedule.Create je Lauf scheitert mit falschem „timespec“-Fehler

**Symptom.** Der Installer legt den Takt nicht an: `Schedule.Create '0 */15 * * * *': Invalid argument 'timespec': Failed validation!`. Die zwei folgenden Creates desselben Laufs (Fenster, Sicherheits-Aus) gelingen.

**Ursache.** Es liegt **nicht** am Timespec: Per curl und aus einem kleinen Probe-Script wird exakt derselbe String zuverlässig angenommen (10/10); auch die explizite Form `0 0,15,30,45 * * * *` scheitert im Installer genauso. Per Probe ausgeschlossen: Timespec-Syntax, Aufrufstruktur (byteidentisch), Create im Delete-Callback, Löschen persistierter Pläne, voller Installer-Vorlauf (KVS lesen + `Script.List`).

Reproduzierbar ist nur: der **erste** `Schedule.Create` eines Laufs des großen Installer-Scripts scheitert, unabhängig vom Inhalt. Der fehlgeschlagene Versuch räumt selbst etwas frei (vermutlich Engine-Heap), denn der nächste Create gelingt ohne Pause sofort. Ein kleines Script löst das nie aus – es hängt am Speicher- und Zustandsprofil des großen Scripts.

**Warum unentdeckt.** Der Mock legte Zeitpläne immer beim ersten Versuch an.

**Fix.** `onCreate` wiederholt einen fehlgeschlagenen `Schedule.Create` bis zu `CRETRY_MAX` = 3-mal nach `CRETRY_MS` = 400 ms (`sendCreate` über `Timer.set`). Der erste Versuch scheitert, der zweite gelingt; alle Einträge entstehen (am Gerät über den SSH-Tunnel verifiziert). Entscheidung 20.

**Vorbeugung.** Der Mock bildet den Quirk nach (`schedCreateFailFirst`, Standard an): der erste `Schedule.Create` je Script-Lauf scheitert mit derselben Meldung. Zwei Tests in `install.test.js` prüfen, dass der Retry alle Einträge erzeugt (vier Create-Aufrufe für drei Einträge) und dass ohne Quirk drei Aufrufe genügen.

> **Hinweis:** Nachtrag 13.09.2026 – die Meldung wurde beim manuellen Test erneut als Fehler gelesen. Gegenprobe: `bw_install` v0.1.2 gibt vor `Script.List` und den Zeitplan-Schritten die KVS-Objekte frei (`K = {}`, nur `idSw` und `cfg3` bleiben) – die erste Ablehnung kam trotzdem (12:15:08). Es ist also kein KVS-Heap-Problem, sondern hängt am Script selbst (Größe, Zustand der Engine).

> **Hinweis:** Konsequenz: der Installer wiederholt die erste Ablehnung stumm (`dbg`), erst eine zweite erscheint als `Hinweis: Schedule.Create '…' abgelehnt …`; `install.test.js` prüft, dass die Konsole im Normalfall keine `Schedule.Create`-Zeile enthält. Grundsatz bestätigt: Ein „validation failed“ der Firmware ist nicht immer wörtlich zu nehmen – erst per curl oder Probe gegenprüfen, ob die Anfrage wirklich ungültig ist.

## 12.09.2026 – Der Script-Editor verliert beim Einfügen das Dateiende

**Symptom.** Nach dem Einfügen von `scripts/bw_install.js` (12 131 Byte) meldet das Gerät `Uncaught SyntaxError: Got EOF expected '}' at function stepDone()`. `Script.GetCode?id=<id>&len=1` → `left: 11964`, also 11 965 Byte am Gerät: **166 Byte fehlen**, genau das Dateiende (Rest von `stepDone`, Schrittliste, `next()`). `bw_main`: 19 021 statt 19 231 Byte (210 fehlen). `bw_pump`: vollständig. Firmware 2.0.0 – das Speicherlimit ist es nicht, 19 KB wurden gespeichert.

**Ursache.** Der Transfer Zwischenablage → Editor → `Script.PutCode` ist nicht verlustfrei; wo genau, ist nicht bestimmbar (kein Fehler in der UI sichtbar). Der Effekt ist derselbe wie beim `evalSamples`-Fehler (nächster Eintrag).

**Warum unentdeckt.** Ein Script mit fehlendem Ende parst bis zum Ende und meldet erst beim Start `Got EOF`; ein Script mit fehlender Mitte startet und stirbt beim ersten Aufruf der fehlenden Funktion. Beides sieht aus wie ein Codefehler.

**Fix.** [tools/put-script.js](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/put-script.js) `<ip> <id> <datei>`: Upload per `Script.PutCode` in 1 024-Zeichen-Stücken (Zeichen, nicht Byte – kein UTF-8-Zeichen wird zerschnitten), danach Vergleich mit dem Code am Gerät, Exit-Code ≠ 0 bei Abweichung.

Seit v0.1.1 (Etappe 9) lädt es den Code komplett zurück und vergleicht byteidentisch statt nur die Länge; seit v<!-- fact:ver.put-script -->0.1.2<!-- /fact --> (Etappe 10) prüft es vorher den Flash (`fs_free` + alter Code ≥ neue Datei + 4 096 B). `tools/verify-scripts.js <ip>` (Prüfung 2) vergleicht alle Scripts am Gerät mit `dist/`. Entscheidung 19.

**Vorbeugung.** Nach **jedem** Upload die Bytes prüfen – auch nach einem Upload per Editor. Ein `ReferenceError` oder `Got EOF` am Gerät heißt zuerst „Upload prüfen“, dann erst „Code prüfen“.

## 12.09.2026 – bw_main v0.1.1: ReferenceError "evalSamples" is not defined

**Symptom.** Nach dem Umbau auf die flache Schrittkette bricht `bw_main` im Timer-Callback `onSample` ab, weil `evalSamples` – eine Funktion aus der Dateimitte (Byte 10 700 von 18 879) – nicht existiert. Derselbe Pfad lief mit v0.1.0 eine halbe Stunde vorher durch; `bw_install` (12 KB) und `bw_pump` (12 KB) laufen.

**Ursache.** Verlust beim Übertragen in den Editor (Eintrag darüber, per `Script.GetCode` bestätigt). Das im Forum genannte Speicherlimit von ~15 KB (FW 1.0.3) gilt auf Firmware 2.0.0 nicht mehr – 19 KB wurden gespeichert. Ein fehlendes Stück nimmt genau die Funktionen mit, die darin standen; der Rest parst weiter.

**Warum unentdeckt.** Der Mock liest die Datei direkt; eine Größenbeschränkung war nirgends nachgebildet.

**Fix.** `npm run build` schreibt `dist/` – Kommentare, Einrückung und Leerzeilen entfernt, Versionszeile bleibt (seit Etappe 9 auch die `//!`-Geräte-Doku, Entscheidung 35); `bw_main.js` damals 19,2 KB → 13,8 KB. Nur `dist/` kommt aufs Gerät; `scripts/` bleibt die Quelle. Entscheidung 17.

**Vorbeugung.** `size.test.js` hält jede Kompakt-Ausgabe unter der Grenze und prüft sie mit `node --check`. Damals waren das 15 000 Byte; seit Etappe 9 sind es <!-- fact:size_limit -->16 000<!-- /fact --> B, seit Etappe 10 für `bw_pump` <!-- fact:size_limit_pump -->18 000<!-- /fact --> B (heute `bw_main` <!-- fact:dist.bw_main -->15 791<!-- /fact --> B, `bw_pump` <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B). Nach jedem Upload `verify-scripts.js`; von Hand ging es damals mit `Script.GetCode?id=<id>&len=1` → `left + 1` muss der Dateigröße entsprechen.

## 12.09.2026 – Web-UI zeigt KVS-Werte als [object Object]

**Symptom.** Settings → Key-Value Storage zeigt für alle acht Einträge von v0.1.0 `[object Object]`, Länge 15; der Bearbeiten-Dialog ebenso. Erster Eindruck: der Installer hat Müll geschrieben.

**Ursache.** Falscher Eindruck – das Gerät speichert Objekte korrekt: `KVS.Get lrn` in der Probe liefert `"value":{"eff":null,"sf":1,…}` (Feldnamen von v0.1.0), und `bw_main` liest `cfg1.idV` erfolgreich. Die Web-UI ist aber nur für String-Werte gebaut: sie zeigt `String(value)` und würde beim Speichern den Text `[object Object]` zurückschreiben. Weil `cfg2` (Zielband) von Hand im KVS gepflegt wird, ist das ein echter Mangel, kein Schönheitsfehler.

**Warum unentdeckt.** Der Mock speicherte Objekte als JSON und gab sie als Objekte zurück – bequem, aber die Web-UI kam darin nicht vor. Die KVS-Doku („any valid JSON value“) ist korrekt und trotzdem nicht die ganze Wahrheit.

**Fix.** KVS-Werte sind JSON-Strings: `JSON.stringify` beim Schreiben, `fromKvs()` beim Lesen (unlesbar → `null`; der Installer ersetzt solche Einträge durch Startwerte und meldet es). Das entspricht dem Referenz-Script des Projektleiters (Spotelly: `setKVS` → `JSON.stringify`, `getKVS` → `JSON.parse`). Einmalig am Gerät: die acht v0.1.0-Einträge löschen, Installer starten. In der Web-UI liest man die Strings mit „Format as JSON“.

**Vorbeugung.** Der Mock hält Rohwerte wie das Gerät (`KVS.Get`/`KVS.GetMany` liefern den String) und meldet jeden `KVS.Set` mit Nicht-String-Wert als Fehler (`Wert ist object, kein String – JSON.stringify verwenden`). Entscheidungen 15 und 16.

## 12.09.2026 – bw_pump stirbt: Too much recursion – the stack is about to overflow

**Symptom.** Nach dem Hoisting-Fix läuft der Installer durch, `bw_main` auch, aber `bw_pump` bricht ab:

```text
Uncaught Error: Too much recursion - the stack is about to overflow
 at ...s.length; i++) { if (K[keys[i]] !== undefined && JSON.string...   (stepWrite)
in function "f" called from   try { f(); } catch (e) { fail(e); }         (next)
in function "next" called from ... { si = i; break; } } next();           (jumpTo)
in function "jumpTo" called from out.why = why; jumpTo(stepWrite);        (finish)
```

**Ursache.** Die Schrittkette war verschachtelt: jeder synchron fertige Schritt rief `next()`, das den nächsten Schritt rief, der wieder `next()` rief … Ohne Auftrag lief `bw_pump` so: RPC-Callback → `next` → `stepCfg` → `next` → `stepCheck` → `finish` → `jumpTo` → `next` → `stepWrite` → `JSON.stringify` – zehn Ebenen. mJS hat einen sehr kleinen Stack: gemessen laufen 12 Ebenen, 14 stürzen ab, jeweils plus Timer-Frame und `print` – also etwa 13–15 Ebenen insgesamt. `bw_main` kam mit neun Ebenen gerade noch durch.

**Warum unentdeckt.** V8 rekursiert zehntausende Ebenen tief; der Mock hatte keine Vorstellung von einer Stackgrenze. Die Shelly-Doku nennt die Grenze nicht – nur „mehr als 2–3 verschachtelte anonyme Funktionen lassen das Gerät abstürzen“, was dasselbe Problem von der anderen Seite beschreibt.

**Fix.** `next()` ist jetzt eine flache Schleife: ein Schritt gibt `true` zurück, wenn er sofort fertig ist, und die Schleife ruft den nächsten; asynchrone Schritte geben nichts zurück, ihr Callback ruft `next()` aus einem frischen Stack. `jumpTo` setzt nur noch das Ziel, `finish`/`abortErr` geben `true` zurück (`return abortErr(...)` im Schritt, `abortErr(...); next(); return;` im Callback). Warteschlangen-Treiber (`writeNext`, `delNext`, `createNext`, `scNext`) geben `true` zurück, wenn nichts mehr ansteht; Callbacks schreiben `if (writeNext()) next();`. Tiefste Kette danach: 4.

**Vorbeugung.**

- Der Mock misst die Aufruftiefe des Scripts an jeder Engine-Grenze (`print`, `Shelly.call`, `Timer.set`, `JSON.*`) per `Error().stack` und meldet mehr als `MAX_CALL_DEPTH` Ebenen als Fehler – zuerst 8, nach der Messung am Gerät <!-- fact:call_depth -->10<!-- /fact -->. Mit den alten Scripts schlug das in 16 Tests an (Tiefe 9–11), mit den neuen in keinem. `tools/run-script.js` zeigt `max. Aufruftiefe` im Ergebnis (15.09.2026 im Mock: `bw_main` 5, `bw_pump` 6, `bw_install` 6).
- Regel in CLAUDE.md („Flache Aufrufkette“), Entscheidung 14, Engine-Fakt in [20 · RPC-Referenz](20-rpc-referenz.md).
- `tools/probe/engine_probe.js` maß die Grenze am Gerät (Abschnitt G einer früheren Fassung; die eingecheckte v0.1.5 enthält nur noch die `Schedule.Create`-Probe). Die erste Messung scheiterte am Log-Transport: 20 `print`-Zeilen in einer Rekursion kamen weder in der Web-UI noch im Debug-Websocket an (Puffer läuft über) – darum wurde in Timer-Ticks gemessen, eine Tiefe je Tick.

## 12.09.2026 – Scripts starten nicht: ReferenceError "stepRead" is not defined

**Symptom.** Der erste Start von `bw_install.js` am Gerät (Web-UI, Script-Editor) bricht sofort ab:

```text
Uncaught ReferenceError: "stepRead" is not defined
 at var steps = [stepRead, stepDefaults, stepScripts, stepSchedL...
```

`bw_main.js` und `bw_pump.js` hätten beim ersten Zeitplan-Start genauso reagiert – gleiches Muster in allen drei Dateien.

**Ursache.** Die Shelly-Script-Engine (mJS) hoistet Funktionsdeklarationen nicht. Ein Name wie `stepRead` existiert erst, wenn die Ausführung an `function stepRead() {…}` vorbeigelaufen ist. Die Schrittliste `var steps = [stepRead, …]` stand im Variablenblock am Dateianfang, die Funktionen kamen erst ab Zeile 90. Aufrufe *innerhalb* von Funktionen (etwa `next()` → `steps[si]()`) sind unkritisch, weil sie erst zur Laufzeit aufgelöst werden.

**Warum unentdeckt.** Drei Gründe auf einmal:

1. Der Mock führt die Scripts mit Node `vm.runInNewContext` aus – V8 hoistet, also lief dort alles.
2. `syntax.test.js` prüfte nur verbotene Konstrukte (`const`, `=>`, Template-Strings …), nicht die Reihenfolge.
3. Das Wissen war da – die RPC-Notizen listeten „Nicht unterstützt: Hoisting“ seit Etappe 0 –, wurde aber nie in eine Regel übersetzt. Ein Satz in der Doku schützt nicht; nur ein Test schützt.

**Fix.** `var steps = [...]` in allen drei Scripts ans Dateiende, direkt vor das abschließende `next();`. Scripts auf v0.1.1. Keine Änderung an der Logik.

**Vorbeugung.** Neue Regel in `syntax.test.js` (`useBeforeDecl`): Code außerhalb von Funktionskörpern (damals nur Klammertiefe 0, seit Etappe 8 auch mehrzeilige Literale auf Modulebene), der eine erst später deklarierte Funktion nennt, schlägt fehl – mit Zeilennummern beider Stellen. Vor dem Fix rot für alle drei Scripts, danach grün. Regel in CLAUDE.md („Harte Regeln“), Entscheidung 13.

Allgemeine Lehre: **Jede Aussage der Shelly-Doku, die der Mock nicht nachbildet, gehört als statischer Test ins Repo, nicht nur als Notiz.** Und: neue Scripts vor dem Zeitplan-Betrieb einmal von Hand am Gerät starten.

## Kleine Lehren ohne eigenen Eintrag

Nebenbefunde der Probe (12.09.2026), des Hardware-Tests und des ersten Etappe-10-Laufs (13.09.2026). Die Messwerte dazu stehen in [19 · Prüfprotokoll](19-pruefprotokoll.md), die RPC-Details in [20 · RPC-Referenz](20-rpc-referenz.md).

| Befund | Folge |
| --- | --- |
| `KVS.GetMany` liefert am Gerät 11 Einträge je Seite (Mock: 5) – wer nur die erste Seite liest, übersieht Einträge (`st` fehlte scheinbar) | Scripts, `tools/kvs_dump.sh` und `hwtest.js` paginieren; `install.test.js` liest mit Seitengröße 2 |
| `KVS.GetMany` liefert `items` als **Array** `[{key, etag, value}]` plus `offset`, `total` (Doku: Objekt) | Mock antwortet wie das Gerät |
| `KVS.Set` mit RPC-Objekt (in place geändert), Literal mit `null`, JSON-Kopie und String: alle `ec=0` | keine Engine-Einschränkung – die String-Regel ist eine Web-UI-Frage |
| `KVS.Set lrn: Missing required argument 'key'!` aus v0.1.0 nicht reproduzierbar; trat nur in der tiefen Aufrufkette auf | beobachten |
| Debug-Websocket: neben den `print`-Zeilen kommen Firmware-Zeilen (`shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`, `y_notifications.cpp`, `shelly_debug.cpp`, `shelly_script.cpp`) und beim Start `JS RAM stat … used: N` (Heap nach dem Parsen; Zahlen je Script in 19) | `hwtest.js watch` filtert das Rauschen, `console.js` nicht; die Konsole muss vor `Script.Start` verbunden sein, sonst fehlt die erste Zeile |
| Log-Transport: 20 `print`-Zeilen in einer Rekursion kamen nirgends an; eine Konsolenzeile je 5 s kommt vollständig | eine Zeile je Takt bzw. je Portion; Regel „Konsolen-Burst“ ≤ 15 Zeilen (CLAUDE.md, Interview-Entscheidung 7); `noBurst()` in `tools/test/helpers.js` prüft es in `pump.test.js`/`potmodel.test.js` |
| Ein 1-s-Tick mit `getComponentStatus` kostet laut Firmware-Log 12–17 % CPU | Test-Scripts ticken so (`msTick` 1 000 ms, Langläufer); `bw_pump` 0.2.0 tickt im Fenster alle `msSample` <!-- def:cfg1.msSample -->500<!-- /def --> ms (Switch und Wasserstand je `tChk`), begrenzt auf die Frist ≤ `tWin`; `bw_main` nur für die `nSample` Messungen je Takt |
| Flash: LittleFS rechnet in 4-KB-Blöcken; die drei Test-Scripts `engine_probe`, `bw_hwtest`, `bw_hwpump` kosten rund 36 KB (`fs_free`-Messreihe in 19) | `put-script.js` prüft `fs_free` + alter Code ≥ neue Datei + 4 096 B; Platz schaffen mit `hwtest.js scripts` und `delete` |
| Firmware-Hinweise ohne Folgen: `shelly_ejs_timer.cpp:44 Timer 1 handle not found` (`Timer.clear` des eigenen wiederholenden Timers aus dessen Callback), `persistent_counters.cpp:585 PCS write interval < 60s` (Zählerschreiben des Switch bei Portionen im Abstand < 60 s) | keine Maßnahme |
| Heap im Fenster (Etappe 10): die Spitze von `bw_pump` 0.2.0 bleibt weit unter dem freien Heap, und der Parse von `bw_main` kommt dank Frist nie dazu (Messwerte in 19) | die Ausnahme <!-- fact:size_limit_pump -->18 000<!-- /fact --> B für `bw_pump` in `tools/build.js` ist gedeckt |
| Minutenliste mit Sekundenfeld `40 2,8,14,20,26,32,38,44,50,56 * * * *` (Sicherheits-Aus des Zeitraffers) nimmt FW 2.0.0 an | Installer baut sie aus `winEvery` und `tWin` |

## Beispielausgabe

Die Fehlerzeilen, wie sie am Gerät erschienen – jede führte zu einem Eintrag oben:

| Zeile am Gerät | Datum | Was sie wirklich bedeutete |
| --- | --- | --- |
| `Uncaught ReferenceError: "stepRead" is not defined` | 12.09.2026 | kein Hoisting – `steps[]` stand vor den Funktionen |
| `Uncaught Error: Too much recursion - the stack is about to overflow` | 12.09.2026 | verschachtelte Schrittkette, zehn Ebenen |
| `ReferenceError: "evalSamples" is not defined` | 12.09.2026 | Editor verlor ein Stück aus der Dateimitte – die Funktion bei Byte 10 700 von 18 879 fehlte (per `Script.GetCode` bestätigt) |
| `Uncaught SyntaxError: Got EOF expected '}' at function stepDone()` | 12.09.2026 | Editor verlor 166 Byte am Dateiende (`bw_main`: 210 Byte, 19 231 → 19 021) |
| `Schedule.Create '0 */15 * * * *': Invalid argument 'timespec': Failed validation!` | 12.09.2026 | Timespec war gültig – erster Create je Lauf scheitert |
| `ABBRUCH: Function "shift" not found!` | 13.09.2026 | mJS ohne `Array.prototype.shift` |
| `"errors":["out_of_memory"]` in `Script.GetStatus` | 13.09.2026 | Test-Script hielt 13,5 KB des geteilten Heaps |
| `JS Error [5] out_of_memory used=791 peak=871 total=1746` | 13.09.2026 | `bw_pump` startete zur selben Sekunde wie `bw_main` |

Was der Mock seither prüft – Ergebniszeile von `node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":25,"pct":20,"why":"hand","ts":1789192500}'` (15.09.2026):

```text
[bw_pump 0.2.0] Fenster: Auftrag 25 s, pct 20, Einzelportion, Frist 420 s
[bw_pump 0.2.0] P1 aus: ok nach 25 s
[bw_pump 0.2.0] ergebnis=ok n=1 sec=25 dur=26 pct=null→null effW=null sf=0.7 day.n=1 err=null w=3 dauer=28340
--- Ergebnis --- beendet=true Dauer=28340 ms, max. offene RPC=1, max. Aufruftiefe=6, Fehler=0
```

`max. Aufruftiefe=6` liegt unter der Grenze <!-- fact:call_depth -->10<!-- /fact -->; `Fehler=0` heißt: kein Uncaught-Fehler im Script, kein `KVS.Set` mit Nicht-String, keine Aufruftiefe über der Grenze, nie mehr als 5 offene RPC-Aufrufe und nie mehr als 5 Timer; `beendet=true` ist das `Script.Stop`. Die Überlappung zweier Läufe (und einen Lauf ohne `Script.Stop`) meldet nur `simulate()` in den Tests.

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| Der Eintrag beschreibt den Fix, aber nichts prüft ihn | Vorbeugung fehlt oder ist nur ein Satz in der Doku | Regel in `syntax.test.js` (statisch), Nachbildung im Mock (Verhalten) oder harte Regel in CLAUDE.md – ohne Test ist der Eintrag unvollständig |
| Symptom ohne Version, Uhrzeit und Konsolenzeile | aus dem Gedächtnis geschrieben | Zeile aus dem `console.js`- oder `watch`-Log wörtlich übernehmen, dazu `Script.GetStatus.errors`, Script-Version, Datum |
| Die Ursache ist eine Vermutung | keine Gegenprobe | per curl oder Probe-Script nachstellen – am 12.09.2026 war „timespec validation“ kein Timespec-Fehler und `[object Object]` kein Installer-Fehler |
| Derselbe Fehler taucht wieder auf, obwohl er im Log steht | der Mock zeigt ihn weiterhin nicht: V8 hoistet, kennt alle Array-Methoden und hat weder Stack- noch Speichergrenze | die Regel muss ein statischer Test oder der Mock erzwingen; für den Heap gibt es kein Modell – am Gerät messen (`hwtest.js scripts`, im Zeitraffer `watch`) |
| Eine Zahl im Eintrag widerspricht Code oder Protokoll | alter Stand (Größengrenze 15 000 Byte, Mock-Tiefe 8) | Fakt-Marker (`fact:size_limit`, `fact:call_depth`) nutzen; `node tools/check-docs.js` prüft sie gegen die Scripts |
| Eintrag unten angehängt, Messwerte im Fließtext | Konvention vergessen | neue Einträge oben, Zeile in der Regel-Tabelle; Messwerte nach 19, Engine-Fakten nach 20, Entscheidung nach 17 |

## Weiter zu

- [19 · Prüfprotokoll am Gerät](19-pruefprotokoll.md) – die Messwerte hinter den Einträgen: Heap, Flash, Kalibrierung, Pulse, Fenster 1.
- [20 · RPC- und Engine-Referenz](20-rpc-referenz.md) – jede genutzte RPC und die Engine-Fakten mit Messdatum.
- [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md) – die Entscheidungen 13, 14, 15, 16, 17, 19, 20, 27, 28, 37 und 56, die aus diesen Funden wurden.
- [14 · Debuggen und Testen](14-debuggen-und-testen.md) – Konsole, Mock und Werkzeuge, mit denen der nächste Fund gesichert wird.
