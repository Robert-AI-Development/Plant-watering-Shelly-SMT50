# CLAUDE.md

Lernende Pflanzenbewässerung auf dem Shelly Plus Uni (Bodenfeuchte SMT50, DS18B20, Wasserstand-Schwimmer). Drei Betriebs-Scripts und zwei Hardware-Test-Scripts laufen **auf dem Gerät** in der Shelly-Script-Engine; `tools/` enthält einen Node-Mock, damit alles ohne Gerät testbar ist. Sprache in Code-Kommentaren, Docs und Commits: **Deutsch**.

## Aufbau

- `scripts/bw_install.js` – Installer: Zeitplan, KVS-Startwerte, Switch-Config; beendet sich selbst.
- `scripts/bw_main.js` – Arbeitstakt alle 15 min: messen, bewerten, lernen, Pause, Gießauftrag (`job`) schreiben. Rührt die Pumpe nie an.
- `scripts/bw_pump.js` – läuft in den Gießfenstern (08:00/20:00): liest `job`, prüft Wasserstand/Tageslimit, schaltet den Switch mit `toggle_after`.
- `scripts/bw_hwtest.js` – Hardware-Test Sensoren (nur von Hand, Langläufer): Phasen t1/t2 Fühler kalt/warm, m1/m2 Sensor trocken/nass (Kalibrierung → `cfg1`), l1/l2 Schwimmer LEER/VOLL; wartet je Phase auf den physischen Zustand, Kommandos über KVS `hwc`, Stand/Bericht in `hwr`, Schwellen in `hwt`.
- `scripts/bw_hwpump.js` – Hardware-Test Pumpe in zwei Durchgängen: A sichert `st/day/job/err/lrn` nach `hwb1/hwb2`, schreibt den Auftrag, startet `bw_pump` und beendet sich (geteilter Heap); B bewertet, baut zurück, berichtet (`hwp`). Schaltet die Pumpe nie ein.
- `tools/hwtest.js` – Steuerwerkzeug für die Hardware-Tests vom VPS: `preflight`, `input-on`, `cfg`, `start`, `watch` (startet Durchgang B automatisch), `go|skip|abort`, `status`, `report`, `restore`, `cleanup`, `stop`.
- `tools/mock/hwdemo.js` – virtueller Bediener für den Mock (Sensor-Rampen, go/skip/abort über den `onRpc`-Hook).
- `scripts/lib_notes.md` – jede genutzte Shelly-RPC mit Parametern, Antwort und Doku-Link. **Vor jedem neuen RPC-Aufruf hier nachschlagen und die Tabelle ergänzen.**
- `tools/mock/shelly-mock.js` – Gerät in Node (KVS, Schedule, Switch, Sensoren, Timer, virtuelle Uhr). `tools/run-script.js` lässt ein Script gegen den Mock laufen.
- `tools/test/*.test.js` – `node --test`; `helpers.js` liefert `seeded()`, `patch()`, `voltFor()`, `hwDevice()` (Gerätezustand vom 12.09.2026), `runHwtest()`, `pumpTest()` (Durchgang A, bw_pump allein, Durchgang B). `hwtest.test.js`/`hwpump.test.js` nutzen den virtuellen Bediener aus `tools/mock/hwdemo.js`.
- `tools/build.js` – schreibt `dist/` (Kommentare/Einrückung entfernt); **nur `dist/` in den Script-Editor einfügen**, `scripts/` ist die Quelle.
- `tools/put-script.js` – Upload per `Script.PutCode` in Stücken, prüft danach `Script.GetCode → left` gegen die Dateigröße. Nach **jedem** Upload (auch per Editor) die Größe prüfen.
- `tools/console.js` – liest die Geräte-Konsole über den Debug-Websocket mit (Node ≥ 22), optional startet es ein Script. Für Tests am Gerät zusammen mit `DEBUG = 1`.
- `tools/probe/engine_probe.js` – Sondier-Script fürs Gerät (KVS.Set-Varianten, Antwortformat, Stacktiefe); läuft nicht im Mock, Ergebnis kommt nach `LEARNING.md`.
- `docs/PLAN.md` – Etappenplan, **Entscheidungstabelle** und Abweichungen; hier stehen die Gründe für Design-Entscheidungen. `docs/konzept-v2.md`, `umsetzungsplan-v1/v2.md` sind die Regelquellen.
- `README.md` – vollständige Nutzerdoku (Stückliste, Verdrahtung, alle KVS-Felder, Störungscodes). Bei Änderungen an cfg-Feldern oder err-Codes mitziehen.
- `LEARNING.md` – Lern-Log vom echten Gerät (Symptom · Ursache · Warum unentdeckt · Fix · Vorbeugung). Jede Überraschung, die der Mock nicht zeigt, kommt hier hinein **und** als Regel in `syntax.test.js`.
- `AGENTS.md` – Anleitung für KI-Agenten (herstellerübergreifend). **Wichtig: Commit/Push nur mit ausdrücklicher menschlicher Zustimmung.**
- `docs/handbuch/` – zweisprachiges (DE/EN) Handbuch: Einführung, Hardware, Installation, VPS-Mitentwickeln, Claude Code & graft, **Shelly per Remote live debuggen**, Mitwirken. Bei Verhaltens-/Setup-Änderungen mitziehen.
- `docs/seo-keywords.md` – Keyword-/SEO-Analyse und GitHub-Topics-Liste; Keywords sind in README und Handbuch eingearbeitet.

## Befehle

```
npm test          # 89 Tests gegen den Mock (inkl. 7-Tage-Simulation und Hardware-Tests)
npm run check     # node --check der fünf Scripts
npm run build     # dist/: Kompakt-Ausgabe für den Upload
node tools/put-script.js <ip> <id> dist/bw_main.js   # Upload per RPC in Stücken + Größenprüfung (Editor verliert beim Einfügen Text)
node tools/console.js <ip> [sek] [id]                # Geräte-Konsole (Debug-Websocket) mitlesen, optional Script starten
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":70,"pct":34,"why":"hand","ts":1789192500}'
node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo   # Simulation des Sensortests mit virtuellem Bediener (auch bw_hwpump.js)
node tools/hwtest.js <ip> preflight|input-on|cfg k=v|start bw_hwtest|watch|go|skip|abort|status|report|restore|cleanup|stop   # Hardware-Test am Gerät
tools/kvs_dump.sh <ip>   # KVS eines echten Geräts auslesen
```

Node ≥ 20, keine Abhängigkeiten.

## Harte Regeln für `scripts/*.js` (Shelly-Engine)

`tools/test/syntax.test.js` erzwingt sie – nicht umgehen, sondern einhalten:

- Kein `const`/`let`, keine Arrow-Functions, keine Template-Strings, keine anonymen Funktionen, kein `Date`. Nur `var` und benannte Funktionen.
- **Array-Methoden:** nur `push`, `slice`, `splice`, `indexOf`, `join`. `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort` kennt mJS nicht (Gerät 13.09.2026: `Function "shift" not found!`); Ringpuffer per Index.
- **Kein Hoisting:** Funktionsnamen auf Modulebene erst nach ihrer Deklaration verwenden. Die Schrittliste `var steps = [...]` steht deshalb ganz unten, direkt vor `next()`. Der Mock (V8) hoistet und zeigt den Fehler nicht – nur der Test.
- **Immer nur ein offener `Shelly.call`** und ein Timer je Script (Gerätelimit 5). Schrittketten über benannte Callbacks (`next()`).
- **Flache Aufrufkette:** mJS bricht bei etwa 10 verschachtelten Aufrufen ab („Too much recursion“). `next()` ist deshalb eine Schleife: ein Schritt gibt `true` zurück, wenn er sofort fertig ist; asynchrone Schritte rufen `next()` aus ihrem Callback; Warteschlangen-Treiber (`writeNext` …) geben `true` zurück, wenn nichts mehr ansteht (`if (writeNext()) next();` im Callback). Nie `next()` aus einem Schritt heraus aufrufen. Der Mock misst die Tiefe (`max. Aufruftiefe`, Grenze 10; Gerät: 12 ok, 14 Absturz) und meldet Verstöße als Fehler.
- Scripts sind Einmal-Läufer: starten per Zeitplan, beenden sich per `Script.Stop` auf die eigene ID. Laufzeit < 5 s anstreben. Ausnahme: die Hardware-Test-Scripts warten mit einem Tick-Timer auf den Menschen (Timeouts `hwt.tPhase`/`tAll`), sind nie im Zeitplan und geben in Wartephasen Speicher frei.
- Kein Zustand im RAM – alles im KVS (`cfg1..3`, `lrn`, `st`, `job`, `day`, `err`). KVS-Limits: 50 Schlüssel, Wert ≤ 253 Zeichen (`kvs-size.test.js` prüft das). Nur schreiben, wenn sich etwas geändert hat.
- **KVS-Werte sind JSON-Strings:** schreiben mit `JSON.stringify(K[k])`, lesen mit `fromKvs()`. Die Web-UI zeigt Objektwerte nur als `[object Object]`; der Mock meldet Nicht-String-Werte als Fehler.
- **Codegröße:** die Kompakt-Ausgabe (`npm run build`) muss unter 15.000 Byte bleiben (`size.test.js`); `bw_main` liegt bei ~14,4 KB, `bw_hwpump` bei ~13,9 KB – vor größeren Erweiterungen aufteilen oder kürzen.
- **Geteilter Script-Heap (~25 KB, `Script.GetStatus.mem_free`):** nie zwei große Scripts gleichzeitig laufen lassen. Langläufer geben KVS-Objekte in Wartephasen frei (`K = {}; orig = {}`) und lesen vor dem Schreiben neu; ein Script, das ein zweites startet, beendet sich danach (Pumpentest in zwei Durchgängen). Der Mock hat kein Speichermodell – Messwerte in `LEARNING.md`.
- **Tabellen mit Funktionsreferenzen** (Phasentabellen) in einer Funktion bauen (`PH = phases()`), nie als mehrzeiliges Literal auf Modulebene.
- Zeitkonstanten gehören in cfg-Felder im KVS, nicht in den Code.
- Versionskommentar in Zeile 1 jeder Datei (`// bw_main.js v0.1.1 – …`) und `var VER` pflegen.
- **Debug-Schalter:** `var DEBUG = 0;` direkt unter `VER`; `dbg()` schreibt nur bei `DEBUG = 1`. Alle RPCs laufen über `rpc()` (loggt Methode + Parameter), `next()` loggt jeden Schritt, `onKvsPage` jeden KVS-Eintrag mit Typ. Neue Diagnosepunkte als `dbg(...)` ergänzen, nie als `log(...)`. Im Repo bleibt `DEBUG = 0`.

## Arbeitsweise

- Verhalten zuerst im Mock testen (`npm test` muss grün bleiben); Änderungen an err-Codes, cfg-Feldern oder RPCs in `README.md`, `lib_notes.md` und ggf. `docs/PLAN.md` nachziehen.
- Neue Design-Entscheidungen in die Entscheidungstabelle in `docs/PLAN.md` eintragen, nicht nur in den Code.
- Prüfschritte am echten Gerät: `docs/pruefprotokoll-etappe6.md`. Stellen mit `[TODO am Gerät]` in der README sind offen und dürfen nicht ohne Gerätetest als erledigt markiert werden.
- Hardware am Gerät prüfen (Mensch am Aufbau, Claude fragt per Interview): `node tools/hwtest.js <ip> preflight` → `put-script.js <ip> 5|6 dist/bw_hwtest.js|bw_hwpump.js` → `start bw_hwtest 20` → je Phase `watch 120` und `go`/`skip`/`abort` → `start bw_hwpump 20` → `go` → `watch 240` (Durchgang B startet automatisch) → `report` → `cleanup`. Ablauf und KVS-Felder in README „Hardware-Test“, Handbuch Kapitel 6; Messwerte im Prüfprotokoll. Nicht in den 25 min um 08:00/20:00/Mitternacht starten; kein zweites großes Script neben einem Test-Script.

## graft

Das Repo ist mit graft indexiert (`graft/`, gitignored, wird automatisch aktualisiert; nach größeren Änderungen `graft build --deep` für die Konzeptknoten). Für Codefragen zuerst `graft ask "…" --source`, `graft grep`, `graft skeleton <file>` oder `graft callers <sym>` nutzen statt Dateien ganz zu lesen; Details in `.claude/skills/graft/SKILL.md`. `graft check` prüft, ob der Graph zum Code passt.
