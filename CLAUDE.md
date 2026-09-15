# CLAUDE.md

Lernende Pflanzenbewässerung auf dem Shelly Plus Uni (Bodenfeuchte SMT50, DS18B20, Wasserstand-Schwimmer). Drei Betriebs-Scripts, zwei Hardware-Test-Scripts und ein Zeitraffer-Script laufen **auf dem Gerät** in der Shelly-Script-Engine (mJS); `tools/` enthält einen Node-Mock, damit alles ohne Gerät testbar ist. Sprache in Code-Kommentaren, Docs und Commits: **Deutsch**. Die Nutzer- und Entwicklungsdoku ist das zweisprachige Handbuch `docs/de/` (Deutsch) und `docs/en/` (English), 21 Kapitel mit interaktiven Diagrammen; online unter https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/.

## Aufbau

Scripts (Quelle `scripts/`, Kompakt-Ausgabe `dist/` ist eingecheckt und wird per Test gegen den Build geprüft):

- `scripts/bw_install.js` – Installer: KVS-Startwerte `cfg1..4` (`DEF`/`ORDER`; fehlende Felder werden ergänzt, nichts überschrieben), Zeitplan aus `cfg3.tick`/`winEvery`/`winA`/`winB` mit Sicherheits-Aus aus `cfg4.tWin` (`0 8 8,20`; Zeitraffer Minutenliste `40 2,8,…,56`), statische Prüfung, dass ein Fenster samt `tWin + tTail` vor dem nächsten Takt endet; Switch-Config `auto_off = tMax + 10`; Rückkehr aus dem Zeitraffer (Sicherung `zrb1..5` ohne Marke `zr`); beendet sich selbst.
- `scripts/bw_main.js` – Arbeitstakt (`cfg3.tick`, Standard 15 min): messen, Bandordnung prüfen (`pctDry < pctLo < pctOk ≤ pctSoll < pctHi`), Kontrolle `soak` min nach dem Fenster (`zuviel` → `sf`, Hinweis `sink`, Nachholfenster `pauseHot` nach `max`/`zeit`), Wochen-Trockenphase (`dryDay`, Ende bei `pct < pctDry`, Nässe `> pctHi` startet sie), Pause, Tageslimit, Auftrag `job`. Rührt die Pumpe nie an.
- `scripts/bw_pump.js` – Regler des Gießfensters (`winA`/`winB` bei Sekunde 30, im Zeitraffer alle `winEvery` min): liest genau 9 Schlüssel per `KVS.Get`-Kette, misst frisch (m0: `≥ pctOk` → `feucht`, `> pctHi` → `nass`), schreibt vor der ersten Portion den Claim `st.why=laeuft`, gießt in Portionen mit Nachmessen bis `pctOk` (Grenzen `nPort`, `tMax`, Tagesvorrat, Frist bis zum nächsten Takt), lernt `lrn.effW` und `sf`, schreibt `st`/`day`/`job`/`err` als Lesen-Ändern-Schreiben.
- `scripts/bw_hwtest.js` – Hardware-Test Sensoren (nur von Hand, Langläufer): Phasen t1/t2 Fühler kalt/warm, m1/m2 Sensor trocken/nass (Kalibrierung → `cfg1`), l1/l2 Schwimmer LEER/VOLL; Kommandos über KVS `hwc`, Stand/Bericht in `hwr`, Schwellen in `hwt`.
- `scripts/bw_hwpump.js` – Hardware-Test Pumpe in zwei Durchgängen: A sichert `st/day/job/err/lrn` nach `hwb1/hwb2`, schreibt den Auftrag, startet `bw_pump` und beendet sich (geteilter Heap); B bewertet, baut zurück, berichtet (`hwp`). Schaltet die Pumpe nie ein.
- `scripts/bw_zeitraffer.js` – Praxistest im Zeitraffer: sichert `cfg3`/`lrn,day`/`st,err`/`cfg4`/`cfg2` nach `zrb1..5`, schreibt die Profile `ZR3`/`ZR4` (Takt 3 min, Fenster alle 6 min, Budget 120 s, bis 3 Portionen von 10–15 s, `pctDry = pctLo − 1`), setzt den Zustand frisch, schreibt die Marke `zr` als Letztes und startet `bw_install`. Nie im Zeitplan.

Werkzeuge (Node ≥ 20 für Tests und Build, Node ≥ 22 für `console.js` und `hwtest.js`; keine Abhängigkeiten):

- `tools/hwtest.js` – Steuerwerkzeug vom Rechner: `preflight [hw]`, `scripts`, `delete`, `input-on`, `cfg`, `start`, `watch`, `go|skip|abort`, `status`, `report`, `restore`, `cleanup`, `stop`, `zeitraffer`, `normal`, `mess`, `kal | kal report | kal write`. Vollständige Referenz: Kapitel 14.
- `tools/put-script.js` (Upload in Stücken, Flash-Prüfung, byteidentischer Vergleich), `tools/verify-scripts.js` (alle Scripts am Gerät gegen `dist/`, Versionsgleichheit bw_main/bw_pump), `tools/console.js` (Debug-Websocket mitlesen), `tools/run-script.js` (ein Script gegen den Mock), `tools/build.js` (`dist/`, `//!`-Zeilen bleiben als Geräte-Doku), `tools/lib/kal.js` (Rechenkern des Kalibrierlaufs), `tools/kvs_dump.sh`.
- `tools/mock/shelly-mock.js` (Gerät in Node: KVS, Zeitplan, Switch, Sensoren, Timer, virtuelle Uhr, Aufruftiefe), `tools/mock/hwdemo.js` (virtueller Bediener), `tools/test/*.test.js` mit `helpers.js` (`seeded()`, `patch()`, `voltFor()`, `hwDevice()`, `runHwtest()`, `pumpTest()`, `runZeitraffer()`, `potModel()`, `noBurst()`).
- Doku-Werkzeuge: `tools/docs/geruest.mjs` (Indexe `docs/de|en/README.md` aus `tools/docs/kapitel.json`), `tools/docs/build-diagramme.mjs` (Archify-Diagramme je Kapitel und Sprache: `docs/diagramme/src/*.json` → HTML/SVG/Quittungen), `tools/docs/diagramm-svg.mjs`, `tools/check-docs.js` (Links, Anker, Parität DE/EN, Vorlage, veraltete Ausdrücke aus `tools/docs/verboten.json`, Fakt-/Startwert-Marker gegen die Scripts, Diagramme, Stubs).

Doku (alles unter `docs/`, Kapitel identisch benannt in `de/` und `en/`):

- Teil A Verstehen: 01 Gesamtarchitektur · 02 Flussdiagramm · **03 Konfiguration** (einzige Parameter-Referenz aller KVS-Felder; Startwerte tragen Marker `<!-- def:cfg3.tick -->…`, die `check-docs` gegen `DEF`/`ZR3`/`ZR4` prüft) · 04 Sicherheit und Grenzen.
- Teil B/C/D: 05 Verkabelung · 06 Startanleitung · 07 per Hand · 08 lokaler Server · 09 VPS · 10 Claude Code · 11 Hardware-Check · 12 Erstinbetriebnahme (Zeitraffer, Messlauf, Kalibrierlauf) · **13 Betrieb und Wartung** (Konsolenlegende, `job.why`/`err`-Tabellen, Störungen, Update, Wartung).
- Teil E/F: 14 Debuggen und Testen (Werkzeug-Referenz) · 15 Ausbau mit Claude Code (Prozess Plan → Interview → Prüfkriterien → Debug-Umgebung → Coding → Prüfung → Commit) · 16 Konzept und Entscheidungen (Regelquelle) · **17 Etappen- und Entscheidungslog** (Entscheidungsnummern 1–63, neue Entscheidungen anhängen) · **18 Lernlog vom Gerät** (Symptom · Ursache · Warum unentdeckt · Fix · Vorbeugung) · 19 Prüfprotokoll · **20 RPC- und Engine-Referenz** (vor jedem neuen RPC-Aufruf nachschlagen und ergänzen) · 21 SEO.
- Die alten Pfade (`docs/PLAN.md`, `LEARNING.md`, `scripts/lib_notes.md`, die frühere Kurzanleitung, das Prüfprotokoll, das alte Handbuch, `hardware/`) sind nur noch Stubs mit Weiterleitung; dort nichts mehr eintragen.
- `AGENTS.md` – Anleitung für KI-Agenten (herstellerübergreifend). **Wichtig: Commit/Push nur mit ausdrücklicher menschlicher Zustimmung.**

## Befehle

```bash
npm test          # Tests gegen den Mock (Stand: 146; inkl. Fenster-Regelkreis, 7-Tage-Simulation, Hardware-Tests, Zeitraffer, Doku-Prüfung, dist-Abgleich)
npm run check     # node --check der sechs Scripts
npm run build     # dist/: Kompakt-Ausgabe (Versionszeile + //!-Doku-Block bleiben); dist/ ist eingecheckt, tools/test/dist.test.js prüft den Abgleich
npm run docs:check      # Doku-Prüfung inkl. Testzahl (tools/check-docs.js --mit-tests)
npm run docs:diagramme  # alle Archify-Diagramme neu bauen (validate/deliver je Sprache, SVG, Quittungen)
npm run docs:geruest    # Indexe docs/de|en/README.md aus tools/docs/kapitel.json
node tools/put-script.js <ip> <id> dist/bw_main.js   # Upload per RPC in Stücken + byteidentische Prüfung
node tools/verify-scripts.js <ip>                    # alle Scripts am Gerät gegen dist/ vergleichen
node tools/console.js <ip> [sek] [id]                # Geräte-Konsole (Debug-Websocket) mitlesen, optional Script starten
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":25,"pct":20,"why":"hand","ts":1789192500}'   # mit pct + Band: Regelkreis, sonst Einzelportion
node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo   # Sensortest mit virtuellem Bediener (auch bw_hwpump.js)
node tools/run-script.js scripts/bw_zeitraffer.js --seed         # Zeitraffer im Mock (startet bw_install mit)
node tools/hwtest.js <ip> normal 60 | zeitraffer 60 | watch 300  # Installer, Zeitraffer, mitlesen (sicherer Moment: Sekunde 8–30)
node tools/hwtest.js <ip> mess 10 1 90 | kal 2400 | kal report | kal write   # Messlauf, Kalibrierlauf, Bericht, Werte schreiben (erst nach normal)
node tools/hwtest.js <ip> preflight hw | scripts | delete <id>   # Hardware-Test-Scripts anlegen, Scripts mit Größe/mem_peak/fs_free, Test-Script löschen
tools/kvs_dump.sh <ip>   # KVS eines echten Geräts auslesen
```

## Harte Regeln für `scripts/*.js` (Shelly-Engine)

`tools/test/syntax.test.js` erzwingt sie – nicht umgehen, sondern einhalten:

- Kein `const`, keine Arrow-Functions, keine Template-Strings, keine anonymen Funktionen, kein `Date`, kein `class`, kein `for…of`, kein Spread, kein `async`, kein `parseInt`/`parseFloat`. Konvention: nur `var` und benannte Funktionen (`let` kennt mJS, wird hier nicht genutzt).
- **Array-Methoden:** nur `push`, `slice`, `splice`, `indexOf`, `join`. `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort` kennt mJS nicht (Gerät 13.09.2026: `Function "shift" not found!`); Ringpuffer per Index.
- **Kein Hoisting:** Funktionsnamen auf Modulebene erst nach ihrer Deklaration verwenden. Die Schrittliste `var steps = [...]` steht deshalb ganz unten, direkt vor `next()`. Der Mock (V8) hoistet und zeigt den Fehler nicht – nur der Test.
- **Immer nur ein offener `Shelly.call`** und ein Timer je Script (Gerätelimit 5). Schrittketten über benannte Callbacks (`next()`); der Fenster-Automat von `bw_pump` läuft über einen Tick-Timer mit `busy`-Sperre (`rpc()`-Wrapper wie in `bw_hwtest`).
- **Flache Aufrufkette:** mJS bricht bei tiefer Verschachtelung ab („Too much recursion“; Gerät: 12 Ebenen laufen, 14 stürzen ab; Mock-Grenze 10). `next()` ist deshalb eine Schleife: ein Schritt gibt `true` zurück, wenn er sofort fertig ist; asynchrone Schritte rufen `next()` aus ihrem Callback; Warteschlangen-Treiber (`writeNext` …) geben `true` zurück, wenn nichts mehr ansteht. Nie `next()` aus einem Schritt heraus aufrufen; der Mock misst die Tiefe und meldet Verstöße als Fehler.
- Scripts sind Einmal-Läufer: starten per Zeitplan, beenden sich per `Script.Stop` auf die eigene ID. Laufzeit < 5 s anstreben. Ausnahmen: `bw_pump` regelt im Fenster bis `cfg4.tWin` (420 s) und endet über die Frist immer vor dem nächsten `bw_main`-Takt (`tTail` Reserve); die Hardware-Test-Scripts warten mit einem Tick-Timer auf den Menschen und geben in Wartephasen Speicher frei. `bw_zeitraffer` ist nie im Zeitplan.
- **Takt und Fenster kommen aus `cfg3`** (`tick`, `winEvery`, `winA`/`winB`): kein `TICK_MIN`/`TICK` im Code. `bw_pump` startet immer 30 s nach der vollen Minute (`PUMP_SEC`), damit es nie neben `bw_main` läuft (geteilter Heap: Gerät 13.09.2026 `out_of_memory`).
- Kein Zustand im RAM – alles im KVS (`cfg1..4`, `lrn`, `st`, `job`, `day`, `err`); `bw_pump` schreibt vor der ersten Portion den Claim `st.why=laeuft` und am Ende nur Änderungen. KVS-Limits: 50 Schlüssel, Wert ≤ 253 Zeichen (`kvs-size.test.js` prüft das). Nur schreiben, wenn sich etwas geändert hat (Budget im Modell ≤ 24 Schreibvorgänge je Gießtag).
- **KVS-Werte sind JSON-Strings:** schreiben mit `JSON.stringify(K[k])`, lesen mit `fromKvs()`. Die Web-UI zeigt Objektwerte nur als `[object Object]`; der Mock meldet Nicht-String-Werte als Fehler.
- **Codegröße:** die Kompakt-Ausgabe (`npm run build`) muss unter 16 000 Byte bleiben (`size.test.js`; die Grenze schützt den geteilten Heap, FW 2.0.0 speichert auch 19 KB). Ausnahme `bw_pump`: bis 18 000 Byte, weil es dank Frist nie neben `bw_main` läuft (gemessen 13.09.2026: `mem_peak` 12 516 B bei 25 200 B frei). Kürzungsreihenfolge: Sonderzeilen → `dbg`, `st.tr` weg.
- **Geräte-Doku:** Kommentarzeilen mit `//!` (kurz, praxisnah: was macht welche Einstellung) überleben den Build als `// …` und sind die einzigen Kommentare in `dist/`. Jedes Script hat einen solchen Block direkt unter der Versionszeile. Die Blöcke nennen noch README-Abschnitte (Doku-Schuld, `check-docs` warnt): erst mit dem nächsten Script-Release ändern, weil jede Änderung `dist/` und das Gerät verändert (bw_main und bw_pump immer gemeinsam, gleiche Version).
- **Geteilter Script-Heap (~25 KB, `Script.GetStatus.mem_free`):** nie zwei große Scripts gleichzeitig laufen lassen. Langläufer geben KVS-Objekte in Wartephasen frei (`K = {}; orig = {}`) und lesen vor dem Schreiben neu; ein Script, das ein zweites startet, beendet sich danach. Der Mock hat kein Speichermodell – Messwerte in Kapitel 18/19.
- **Tabellen mit Funktionsreferenzen** in einer Funktion bauen (`PH = phases()`), nie als mehrzeiliges Literal auf Modulebene.
- Zeitkonstanten gehören in cfg-Felder im KVS, nicht in den Code. **Portionen nie kürzer als die Totzeit:** `tPmin`/`tMin` ≥ `tDead2`/`tDead` (Messlauf 13.09.2026: 3-s-Pulse füllen nur den Schlauch; 10-s-Puls: Anstieg ab 7,9 s). Zeitwerte nie aus dem Bauch ändern: erst `hwtest.js mess`, dann Startwerte in `bw_install`/`bw_zeitraffer` und Kapitel 03.
- **Konsolen-Burst:** nie mehr als 15 `print` synchron am Stück (der Debug-Websocket verliert sonst Zeilen); der Mock prüft es mit `noBurst()`.
- Versionskommentar in Zeile 1 jeder Datei (`// bw_main.js v0.2.0 – …`) und `var VER` pflegen; `check-docs` vergleicht die Versionen mit den Fakt-Markern der Doku.
- **Debug-Schalter:** `var DEBUG = 0;` direkt unter `VER`; `dbg()` schreibt nur bei `DEBUG = 1`. Alle RPCs laufen über `rpc()`, `next()` loggt jeden Schritt. Neue Diagnosepunkte als `dbg(...)`, nie als `log(...)`. Im Repo bleibt `DEBUG = 0`.

## Arbeitsweise

- Verhalten zuerst im Mock testen (`npm test` muss grün bleiben, es enthält den Doku- und den dist-Abgleich). Änderungen an cfg-Feldern → Kapitel 03 (Tabellenzeile mit Marker in DE und EN), an err-/why-Codes → Kapitel 13, an RPCs → Kapitel 20, neue Design-Entscheidung → Kapitel 17 (nächste freie Nummer), Gerätefund → Kapitel 18 **und** als Regel in `syntax.test.js` oder Nachbildung im Mock, Gerätelauf → Kapitel 19. Danach `npm run docs:check`.
- Doku-Regeln stehen in `docs/_vorlage-kapitel.md`: Zeile 3 Sprachumschalter, Kasten „Auf einen Blick“, feste H2-Folge, Diagrammblock, kurze Absätze, jede Zahl aus Code oder datiertem Protokoll; DE und EN gleich strukturiert. Diagramme: Spezifikation in `docs/diagramme/src/`, Wörterbuch für EN, `npm run docs:diagramme`.
- Prüfschritte am echten Gerät: Kapitel 19. `[TODO am Gerät]` darf nicht ohne Gerätetest als erledigt markiert werden. Nicht in den 25 min um 08:00/20:00/Mitternacht Pumpentests starten; kein zweites großes Script neben einem Test-Script.
- Hardware-Check (Kapitel 11): `preflight hw` → Upload → `start bw_hwtest` → je Phase `watch` und `go` → `start bw_hwpump` → `report` → `cleanup`. Zeitraffer und Kalibrierung (Kapitel 12): `npm run build` → Upload aller Scripts → `verify-scripts` → `normal 60` → `zeitraffer 60` oder `kal 2400` → `watch` → `normal 60` → `kal report`/`kal write`. Der Mensch bedient die Sensoren nach Fahrplan, Claude fährt die Werkzeuge über den Tunnel (Kapitel 09) und interviewt bei offenen Entscheidungen.

## graft

Das Repo ist mit graft indexiert (`graft/`, gitignored, wird automatisch aktualisiert; nach größeren Änderungen `graft build --deep` für die Konzeptknoten). Für Codefragen zuerst `graft ask "…" --source`, `graft grep`, `graft skeleton <file>` oder `graft callers <sym>` nutzen statt Dateien ganz zu lesen; Details in `.claude/skills/graft/SKILL.md`. `graft check` prüft, ob der Graph zum Code passt.
