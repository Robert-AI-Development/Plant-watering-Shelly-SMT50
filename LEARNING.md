# LEARNING.md – Lern-Log vom echten Gerät

Was der Mock nicht zeigt und erst am Shelly Plus Uni auffällt. Jeder Eintrag nach demselben Schema:
**Symptom · Ursache · Warum unentdeckt · Fix · Vorbeugung.** Neue Einträge oben anfügen; jede Vorbeugung, die
sich statisch prüfen lässt, landet zusätzlich als Regel in `tools/test/syntax.test.js`.

## 2026-09-13 – Hardware-Test: `bw_pump` stirbt neben dem Test-Script mit `out_of_memory` – der Script-Heap ist geteilt

**Symptom.** `bw_hwpump` (Test-Script, Kompakt 14,9 KB) startet `bw_pump` per `Script.Start`; `bw_pump` endet sofort ohne eine
Konsolenzeile, `Script.GetStatus` zeigt `"errors":["out_of_memory"]`. Während der Sensortest lief, starb auch `bw_main` im
15-min-Takt so. Nach einer Speicherdiät lief `bw_pump` zwar an und pumpte 30 s, starb dann aber beim zweiten KVS-Lesen –
`st/day/job` wurden nie geschrieben.

**Ursache.** Alle Scripts teilen sich einen Heap von etwa 25 KB (`Script.GetStatus` meldet im Leerlauf für jedes Script
dasselbe `mem_free: 24920`). Gemessen: `bw_hwpump` belegte 13.552 Byte (Spitze 15.400), weil es alle KVS-Einträge als
Objekte plus `orig`-Strings über die ganze Wartezeit hielt; für `bw_pump` (7.396 beim Parsen) blieben 11.354 – zu wenig.
Ohne `K/orig` in den Wartephasen: `bw_hwpump` 9.044, `bw_hwtest` 9.576. Damit laufen `bw_main` (5.404 beim Parsen) und
`bw_pump` daneben an. `bw_pump` braucht aber beim erneuten Lesen von 13 KVS-Einträgen (mit den Test-Einträgen `hwt/hwr/hwp/
hwb1/hwb2`) über 15,8 KB Spitze – neben einem 9-KB-Script wieder `out_of_memory`. `bw_main` + `bw_pump` gleichzeitig
(Normalbetrieb um 08:00/20:00) laufen problemlos (je ~7,4 KB, `bw_main` ist nach 4 s fertig, bevor `bw_pump` seine Spitze hat).

**Warum unentdeckt.** Der Mock hat kein Speichermodell; bisher lief immer nur ein Script, und die Betriebs-Scripts sind nach
Sekunden fertig. Ein Langläufer neben einem zweiten Script ist ein neues Muster.

**Fix.** (1) Beide Test-Scripts setzen `K = {}; orig = {};`, sobald sie warten (der Stand wird vor dem Schreiben neu
gelesen). (2) Der Pumpentest läuft in zwei Durchgängen: A bereitet den Auftrag vor, startet `bw_pump` und beendet sich;
`bw_pump` pumpt allein; B (erkennbar an der Sicherung `hwb1/hwb2`) bewertet, baut zurück und berichtet. `tools/hwtest.js
watch` startet B automatisch. Entscheidung 28 in `docs/PLAN.md`.

**Vorbeugung.** Regel in `CLAUDE.md`: nie zwei große Scripts gleichzeitig laufen lassen; Langläufer geben KVS-Objekte in
Wartephasen frei; vor einem `Script.Start` aus einem Script `mem_free` bedenken. `hwtest.js preflight/status` zeigt
laufende Scripts, `Script.GetStatus.errors` bleibt bis zum nächsten Lauf stehen und verrät den Absturz. Ein Speichermodell
im Mock gibt es nicht – die Zahlen oben sind die Referenz.

## 2026-09-13 – `Function "shift" not found!`: mJS kennt `Array.prototype.shift` nicht

**Symptom.** `bw_hwtest` bricht am Gerät nach dem ersten Messtick ab: `ABBRUCH: Function "shift" not found!` – im Mock lief
derselbe Ringpuffer (`push` + `shift`) fehlerfrei.

**Ursache.** Die Shelly-Engine implementiert nur einen Teil der Array-Methoden (`push`, `slice`, `splice`, `indexOf`,
`join` sind belegt); `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort`
gelten als nicht vorhanden.

**Warum unentdeckt.** V8 im Mock kennt alle Methoden; `syntax.test.js` prüfte Sprachkonstrukte, keine Methodennamen.

**Fix.** Ringpuffer per Index (`ring[i % n] = v`, Lesen über `(i − 1 − k) % n`), keine Array-Methoden außer `push`.

**Vorbeugung.** Neue Regel in `syntax.test.js`: die genannten Methodennamen sind in `scripts/*.js` verboten.

## 2026-09-13 – Messwerte des Hardware-Tests (`bw_hwtest`, `bw_hwpump`, `tools/hwtest.js`)

- **Kalibrierung am Gerät:** Trockenpunkt 0,296 V (Sensor abgewischt in Luft; am 12.09. 0,20 V), Nasspunkt 3,134 V, Schwimmer
  LEER = 1 / VOLL = 0 (`lvlEmpty` 1 bestätigt), Fühler 19,8 °C im Eiswasser und 33,5 °C im warmen Wasser; alle sechs Phasen
  in 532 s, `ram_free` mindestens 125.424. Pumpentest: `bw_pump` „Pumpe ein für 30 s“, „Pumpe aus: ok nach 30 s“,
  Durchgang B `ok,ok,ok,ok`, KVS danach byteidentisch.
- **`KVS.GetMany` liefert am Gerät 11 Einträge je Seite** (Mock: 5) – wer nur die erste Seite liest, übersieht Einträge
  (`st` fehlte scheinbar). Die Scripts paginieren; `tools/kvs_dump.sh` und `hwtest.js` ebenfalls.
- **Debug-Websocket:** neben den `print`-Zeilen kommen Firmware-Zeilen (`shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`,
  `y_notifications.cpp`, `shelly_debug.cpp`, `shelly_script.cpp`) und beim Start `JS RAM stat … used: N` (Heap nach dem
  Parsen: `bw_hwtest` 3.564, `bw_main` 5.404, `bw_pump` 7.396); `hwtest.js watch` filtert das Rauschen, `console.js` nicht.
  Die Konsole muss vor `Script.Start` verbunden sein, sonst fehlt die erste Zeile.
- **Ein 1-s-Tick mit `getComponentStatus`** kostet laut Firmware-Log 12–17 % CPU; eine Konsolenzeile je 5 s je Phase kommt
  vollständig an.
- **Flash:** `fs_free` 57.344 vor dem Upload, 24.576 nach zwei Test-Scripts (13,4 + 13,9 KB). Script 4 (`engine_probe`)
  kann gelöscht werden, wenn Platz fehlt.
- **Mock-Nachbildung:** `Script.Start` führt eine registrierte Datei als zweites Script aus; Callbacks eines beendeten Laufs
  dürfen einen Neustart desselben Scripts nicht treffen (Laufgeneration) – sonst stirbt Durchgang B im Mock an einem
  `Script.Stop`-Callback aus Durchgang A.

## 2026-09-12 – Installer: erster `Schedule.Create` je Lauf scheitert mit falschem „timespec"-Fehler

**Symptom.** Der Installer legt den 15-min-Takt nicht an: `Schedule.Create '0 */15 * * * *': Invalid argument 'timespec': Failed validation!`. Die beiden folgenden Creates (`0 0 8,20`, `0 5 8,20`) gelingen im selben Lauf.

**Ursache.** Es liegt **nicht** am Timespec: Über curl und aus einem kleinen Probe-Script wird exakt derselbe String zuverlässig akzeptiert (10/10), auch die explizite Form `0 0,15,30,45 * * * *` scheitert im Installer genauso. Ausgeschlossen per Probe: Timespec-Syntax, Aufrufstruktur (byte-identisch), Create-im-Delete-Callback, Löschen persistierter Pläne, voller Installer-Vorlauf (KVS lesen + Script.List). Reproduzierbar ist nur: **der erste** `Schedule.Create` eines Laufs des großen Installer-Scripts scheitert, unabhängig vom Inhalt; der fehlgeschlagene Versuch räumt selbst etwas frei (vermutlich espruino-Heap), denn der nächste Create gelingt **ohne** Pause sofort. Ein kleines Script löst das nie aus – es hängt am Speicher-/Zustandsprofil des großen Scripts.

**Warum unentdeckt.** Der Mock legte Zeitpläne immer beim ersten Versuch an.

**Fix.** `onCreate` wiederholt einen fehlgeschlagenen `Schedule.Create` bis zu `CRETRY_MAX = 3` mal nach `CRETRY_MS = 400` ms (`sendCreate`/`Timer`). Der erste Versuch scheitert, der zweite gelingt; alle drei Einträge entstehen (am Gerät verifiziert über den SSH-Tunnel).

**Vorbeugung.** Der Mock bildet den Quirk nach (`schedCreateFailFirst`, Standard an): der erste `Schedule.Create` je Script-Lauf scheitert mit derselben Meldung. Zwei Tests in `install.test.js` prüfen, dass der Retry alle drei Einträge erzeugt. Grundsatz bestätigt: Ein „validation failed" der Firmware ist nicht immer wörtlich zu nehmen – erst per curl/Probe gegenprüfen, ob die Anfrage wirklich ungültig ist.

## 2026-09-12 – Der Script-Editor verliert beim Einfügen das Dateiende

**Symptom.** Nach dem Einfügen von `scripts/bw_install.js` (12.131 Byte) meldet das Gerät `Uncaught SyntaxError: Got EOF
expected '}' at function stepDone()`. `Script.GetCode?id=1&len=1` → `left: 11964`, also 11.965 Byte am Gerät: **166 Byte
fehlen**, genau das Dateiende (Rest von `stepDone`, Schrittliste, `next()`). `bw_main`: 19.021 statt 19.231 Byte (210 fehlen).
`bw_pump`: vollständig. Firmware 2.0.0 – das Speicherlimit ist es nicht, 19 KB wurden gespeichert.

**Ursache.** Der Transfer Zwischenablage → Editor → `Script.PutCode` ist nicht verlustfrei; wo genau, ist nicht bestimmbar
(kein Fehler in der UI sichtbar). Der Effekt ist derselbe wie beim `evalSamples`-Fehler davor.

**Warum unentdeckt.** Ein Script mit fehlendem Ende parst bis zum Ende und meldet erst beim Start `Got EOF`; ein Script
mit fehlender Mitte startet und stirbt beim ersten Aufruf der fehlenden Funktion. Beides sieht aus wie ein Codefehler.

**Fix.** `tools/put-script.js <ip> <id> <datei>`: Upload per RPC in 1024-Zeichen-Stücken, danach Vergleich
`Script.GetCode → left + 1` mit der Dateigröße, Exit-Code ≠ 0 bei Abweichung.

**Vorbeugung.** Nach **jedem** Upload die Byte-Zahl prüfen (README, CLAUDE.md). Ein `ReferenceError` oder `Got EOF`
am Gerät heißt zuerst „Upload prüfen“, dann erst „Code prüfen“.

## 2026-09-12 – `bw_main` v0.1.1: `ReferenceError: "evalSamples" is not defined`

**Symptom.** Nach dem Umbau auf die flache Schrittkette bricht `bw_main` im Timer-Callback `onSample` ab, weil
`evalSamples` – eine Funktion aus der Dateimitte (Byte 10.700 von 18.879) – nicht existiert. Derselbe Pfad lief mit v0.1.0
eine halbe Stunde vorher durch; `bw_install` (12 KB) und `bw_pump` (12 KB) laufen.

**Ursache.** Verlust beim Übertragen in den Editor (siehe Eintrag oben, per `Script.GetCode` bestätigt); das
Speicherlimit von ~15 KB (Forum, FW 1.0.3) gilt auf Firmware 2.0.0 nicht mehr – 19 KB wurden gespeichert. Ein fehlendes
Stück nimmt genau die Funktionen mit, die darin standen; der Rest parst weiter.

**Warum unentdeckt.** Der Mock liest die Datei direkt; eine Größenbeschränkung war nirgends nachgebildet.

**Fix.** `npm run build` schreibt `dist/` – Kommentare, Einrückung und Leerzeilen entfernt, Versionszeile bleibt
(`bw_main.js` 19,2 KB → 13,8 KB). Nur `dist/` kommt in den Editor; `scripts/` bleibt die Quelle.

**Vorbeugung.** `tools/test/size.test.js` hält jede Kompakt-Ausgabe unter 15.000 Byte und prüft sie mit `node --check`.
Nach jedem Upload: `http://<ip>/rpc/Script.GetCode?id=<id>&len=1` → `left + 1` muss der Dateigröße entsprechen.

## 2026-09-12 – Web-UI zeigt KVS-Werte als `[object Object]`

**Symptom.** Settings → Key-Value Storage zeigt für alle acht Einträge `[object Object]`, Länge 15; der Bearbeiten-Dialog
ebenso. Erster Eindruck: der Installer hat Müll geschrieben.

**Ursache.** Falscher Eindruck – das Gerät speichert Objekte korrekt: `KVS.Get lrn` in der Probe liefert
`"value":{"eff":null,"sf":1,…}`, und `bw_main` liest `cfg1.idV` erfolgreich. Die Web-UI ist aber nur für String-Werte
gebaut: sie zeigt `String(value)` an und würde beim Speichern den Text `[object Object]` zurückschreiben. Weil `cfg2`
(Zielband) von Hand im KVS gepflegt werden soll, ist das ein echter Mangel, kein Schönheitsfehler.

**Warum unentdeckt.** Der Mock speicherte Objekte als JSON und gab sie als Objekte zurück – bequem, aber die Web-UI kam
darin nicht vor. Die KVS-Doku („any valid JSON value“) ist korrekt und trotzdem nicht die ganze Wahrheit.

**Fix.** KVS-Werte sind jetzt JSON-Strings: `JSON.stringify` beim Schreiben, `fromKvs()` beim Lesen (unlesbar → null,
der Installer ersetzt solche Einträge und meldet es). Das entspricht dem Referenz-Script des Projektleiters (Spotelly:
`setKVS` → `JSON.stringify`, `getKVS` → `JSON.parse`). Einmalig am Gerät: die acht v0.1.0-Einträge löschen, Installer starten.

**Vorbeugung.** Der Mock hält Rohwerte wie das Gerät (`KVS.Get`/`GetMany` liefern den String) und meldet jeden
`KVS.Set` mit Nicht-String-Wert als Fehler. Entscheidung 15/16 in `docs/PLAN.md`.

## 2026-09-12 – Messwerte der Probe (`tools/probe/engine_probe.js`)

- `KVS.Set` mit RPC-Objekt (in place geändert), Literal mit `null`, JSON-Kopie und String: alle `ec=0`.
- `KVS.GetMany` liefert `items` als **Array** `[{key, etag, value}]` plus `offset`, `total` (Doku: Objekt) – Mock angepasst.
- `KVS.Set lrn: Missing required argument 'key'!` aus v0.1.0 nicht reproduzierbar; trat nur in der tiefen Aufrufkette auf. Beobachten.
- Stackgrenze (Abschnitt G, Firmware 2.0.0): Rekursionstiefe **12 läuft, 14 stürzt ab** (`Too much recursion`), jeweils plus Timer-Frame und `print` – also etwa 13–15 Ebenen insgesamt. Die alten Scripts lagen mit 9–11 gemessenen Ebenen (ohne die C-seitigen Frames von `JSON.stringify`/`print`) genau an der Kante; die neuen erreichen 5. Mock-Grenze `MAX_CALL_DEPTH = 10`.
- Erste Messung der Grenze scheiterte am Log-Transport: 20 `print`-Zeilen in einer Rekursion kamen weder in der Web-UI noch im Debug-Websocket an (Puffer läuft über). Messen darum in Timer-Ticks, eine Tiefe je Tick.

## 2026-09-12 – `bw_pump` stirbt: `Too much recursion - the stack is about to overflow`

**Symptom.** Nach dem Hoisting-Fix läuft der Installer durch, `bw_main` auch, aber `bw_pump` bricht ab:

```
Uncaught Error: Too much recursion - the stack is about to overflow
 at ...s.length; i++) { if (K[keys[i]] !== undefined && JSON.string...   (stepWrite)
in function "f" called from   try { f(); } catch (e) { fail(e); }         (next)
in function "next" called from ... { si = i; break; } } next();           (jumpTo)
in function "jumpTo" called from out.why = why; jumpTo(stepWrite);        (finish)
```

**Ursache.** Die Schrittkette war verschachtelt: jeder synchron fertige Schritt rief `next()`, das den nächsten Schritt
rief, der wieder `next()` rief … Ohne Auftrag lief `bw_pump` so: RPC-Callback → `next` → `stepCfg` → `next` → `stepCheck`
→ `finish` → `jumpTo` → `next` → `stepWrite` → `JSON.stringify` – zehn Ebenen. mJS auf dem Gerät hat einen sehr
kleinen Stack (gemessen: 12 Ebenen laufen, 14 stürzen ab, siehe Messwerte unten). `bw_main` kam mit neun Ebenen gerade noch durch.

**Warum unentdeckt.** V8 rekursiert zehntausende Ebenen tief; der Mock hatte keine Vorstellung von einer Stackgrenze.
Die Shelly-Doku nennt die Grenze nicht – nur „mehr als 2–3 verschachtelte anonyme Funktionen lassen das Gerät abstürzen“,
was dasselbe Problem von der anderen Seite beschreibt.

**Fix.** `next()` ist jetzt eine flache Schleife: ein Schritt gibt `true` zurück, wenn er sofort fertig ist, und die
Schleife ruft den nächsten; asynchrone Schritte geben nichts zurück und ihr Callback ruft `next()` aus einem frischen
Stack. `jumpTo` setzt nur noch das Ziel, `finish`/`abortErr` geben `true` zurück (`return abortErr(...)` im Schritt,
`abortErr(...); next(); return;` im Callback). Warteschlangen-Treiber (`writeNext`, `delNext`, `createNext`, `scNext`)
geben `true` zurück, wenn nichts mehr ansteht; Callbacks schreiben `if (writeNext()) next();`. Tiefste Kette jetzt 4.

**Vorbeugung.**
- Der Mock misst die Aufruftiefe des Scripts an jeder Engine-Grenze (`print`, `Shelly.call`, `Timer.set`, `JSON.*`) per
  `Error().stack` und meldet mehr als `MAX_CALL_DEPTH = 8` Ebenen als Fehler. Mit den alten Scripts schlug das in 16 Tests
  an (Tiefe 9–11), mit den neuen in keinem. `tools/run-script.js` zeigt `max. Aufruftiefe` im Ergebnis.
- Regel in `CLAUDE.md` („Flache Aufrufkette“), Entscheidung 14 in `docs/PLAN.md`, Sprachregel in `lib_notes.md`.
- `tools/probe/engine_probe.js` misst die tatsächliche Grenze am Gerät (Abschnitt G); Ergebnis wird hier nachgetragen.

## 2026-09-12 – Scripts starten nicht: `ReferenceError: "stepRead" is not defined`

**Symptom.** Erster Start von `bw_install.js` am Gerät (Web-UI, Script-Editor) bricht sofort ab:

```
Uncaught ReferenceError: "stepRead" is not defined
 at var steps = [stepRead, stepDefaults, stepScripts, stepSchedL...
```

`bw_main.js` und `bw_pump.js` hätten beim ersten Zeitplan-Start genauso reagiert – gleiches Muster in allen drei Dateien.

**Ursache.** Die Shelly-Script-Engine (mJS) hoistet Funktionsdeklarationen nicht. Ein Name wie `stepRead` existiert
erst, wenn die Ausführung an `function stepRead() {…}` vorbeigelaufen ist. Die Schrittliste
`var steps = [stepRead, …]` stand im Variablenblock am Dateianfang, die Funktionen kamen erst ab Zeile 90.
Aufrufe *innerhalb* von Funktionen (etwa `next()` → `steps[si]()`) sind unkritisch, weil sie erst zur Laufzeit aufgelöst werden.

**Warum unentdeckt.** Drei Gründe auf einmal:
1. Der Mock führt die Scripts mit Node `vm.runInNewContext` aus – V8 hoistet, also lief dort alles.
2. `syntax.test.js` prüfte nur verbotene Konstrukte (`const`, `=>`, Template-Strings …), nicht die Reihenfolge.
3. Das Wissen war da – `scripts/lib_notes.md` listete „Nicht unterstützt: Hoisting“ seit Etappe 0 –, wurde aber
   nie in eine Regel übersetzt. Ein Satz in der Doku schützt nicht; nur ein Test schützt.

**Fix.** `var steps = [...]` in allen drei Scripts ans Dateiende, direkt vor das abschließende `next();`.
Scripts auf v0.1.1. Keine Änderung an der Logik.

**Vorbeugung.**
- Neue Regel in `tools/test/syntax.test.js` (`useBeforeDecl`): Modulebene-Code (Klammertiefe 0), der eine
  erst später deklarierte Funktion nennt, schlägt fehl – mit Zeilennummern beider Stellen. Vor dem Fix rot für
  alle drei Scripts, danach grün.
- Regel in `CLAUDE.md` („Harte Regeln“), Entscheidung 13 in `docs/PLAN.md`, Hinweis in `README.md` und `lib_notes.md`.
- Allgemeine Lehre: **Jede Aussage der Shelly-Doku, die der Mock nicht nachbildet, gehört als statischer Test ins
  Repo, nicht nur als Notiz.** Und: neue Scripts vor dem Zeitplan-Betrieb einmal von Hand am Gerät starten.
