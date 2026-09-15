# 15 · Ausbau der Steuerung mit Claude Code

**Deutsch** · [English](../en/15-ausbau-mit-claude-code.md) — [Handbuch](README.md) · Teil E „Erweitern“

> **Auf einen Blick**
> - Ergebnis: Eine Erweiterung (neues cfg-Feld, neue Regel, neues Werkzeug) läuft im Mock, am Gerät und steht in der Doku – in sieben Schritten: Plan, Interview, Prüfkriterien, Debug-Umgebung, Coding, Prüfung, Doku und Commit.
> - Umfang: sieben Schritte, vier Prüfbefehle (`npm test`, `npm run check`, `npm run build`, `npm run docs:check`) und ein Gerätelauf, der ins Prüfprotokoll kommt.
> - Wichtigste Zahl: `bw_main` hat <!-- fact:dist.bw_main -->15 791<!-- /fact --> von <!-- fact:size_limit -->16 000<!-- /fact --> Byte, `bw_install` <!-- fact:dist.bw_install -->15 978<!-- /fact --> – jede neue Zeile kostet Reserve, vor dem Coding messen.
> - Größter Stolperstein: Test grün, Gerät rot. Hoisting und fehlende Array-Methoden zeigt der Mock nicht (nur `syntax.test.js` und das Gerät), den geteilten Heap nur das Gerät – deshalb Mock und Tests zuerst, dann Gerätelauf, jede Überraschung ins Lernlog und als Regel in den Test.
> - Commit und Push nur mit ausdrücklicher Zustimmung des Menschen.

## Voraussetzungen

- Claude Code läuft im Repo: nach [10 · Installation mittels Claude Code](10-installation-claude-code.md); das Gerät ist über `<ip>` im LAN ([08 · Installation mit lokalem Server](08-installation-lokaler-server.md)) oder über den Tunnel `127.0.0.1:8010` ([09 · Installation mit VPS-Server](09-installation-vps.md)) erreichbar.
- Node ≥ 20 für Tests und Build, Node ≥ 22 für `tools/console.js` und `tools/hwtest.js`; das Projekt hat keine Abhängigkeiten.
- [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) (harte Regeln, Arbeitsweise) und [AGENTS.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/AGENTS.md) (Zustimmungsregel, Definition of Done) gelesen – CLAUDE.md liest Claude Code beim Start selbst, AGENTS.md gilt für jeden Agenten.
- `npm test` ist vor der Änderung grün (<!-- fact:tests -->146<!-- /fact --> Tests, 13.09.2026).
- Optional: der Code-Index graft. `graft ask "…" --source`, `graft skeleton <datei>` und `graft callers <symbol>` liefern die passenden Stellen, ohne ganze Dateien zu lesen; ohne graft liest Claude die Dateien direkt.

## Diagramm

[![Erweiterung mit Claude Code: Idee, Plan, Interview, Prüfkriterien, Debug-Umgebung, Coding, Prüfung, Gerätelauf, Doku, Freigabe, Commit](../diagramme/de/15-ausbau-mit-claude-code.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/15-ausbau-mit-claude-code.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/15-ausbau-mit-claude-code.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Vom Plan zum Kriterium“, 2 „Bauen und prüfen“, 3 „Doku und Freigabe“.

## Die sieben Schritte

| Schritt | Wer | Ergebnis | Beleg |
| --- | --- | --- | --- |
| 1 Plan | Claude im Plan-Modus, Mensch gibt frei | Ziel, betroffene Scripts, Größenreserve, Doku-Stellen | Plan in der Sitzung |
| 2 Interview | Claude fragt, Mensch entscheidet | jede offene Frage beantwortet (Zielband, Startwert, Zeitraffer, Code, Leser) | Antworten → Entscheidungstabelle |
| 3 Prüfkriterien | Claude schlägt vor, Mensch bestätigt | Testfall, Grenzen, Konsolenzeile, Gerätekriterium – vor dem ersten Code | Liste in der Sitzung |
| 4 Debug-Umgebung | Claude | Mock läuft, Tunnel steht, Flash und Zeitfenster geprüft | `run-script.js`, `preflight` |
| 5 Coding | Claude | Code nach den harten Regeln, `//!`-Doku, Feld in `DEF` und `ZR3`/`ZR4` | Diff |
| 6 Prüfung | Claude, dann das Gerät | `npm test`, `check`, `build`, `docs:check` grün; Upload byteidentisch; Gerätelauf protokolliert | Konsole, Prüfprotokoll |
| 7 Doku und Commit | Claude schreibt, Mensch gibt frei | Kapitel 03, 13, 17, 18, 20 nachgezogen; Branch, Commit, Pull Request | `git log` |

Die Schritte gelten für jede Art von Erweiterung. Ein neues Werkzeug in `tools/` überspringt nur die Geräte-Regeln aus Schritt 5; ein neues cfg-Feld durchläuft alle sieben.

## Schritt 1: Plan im Plan-Modus

Claude Code plant im Plan-Modus zuerst und ändert erst nach deiner Freigabe. Ein brauchbarer Plan nennt vier Dinge:

1. das Ziel in einem Satz – was das Gerät danach anders tut;
2. die betroffenen Scripts: `bw_main` (Takt, Freigabekette, Dosis), `bw_pump` (Fenster-Regelkreis), `bw_install` (Startwerte, Zeitplan), `bw_zeitraffer` (Profil), dazu Tests und Werkzeuge;
3. die Doku-Stellen: [03 · Konfiguration](03-konfiguration.md) für Felder, [13 · Betrieb und Wartung](13-betrieb-und-wartung.md) für Codes, [17 · Entscheidungslog](17-etappen-und-entscheidungslog.md) für die Begründung;
4. die Größenreserve der Kompakt-Ausgabe.

| Script | Kompakt (`npm run build`) | Grenze |
| --- | --- | --- |
| `bw_install` | <!-- fact:dist.bw_install -->15 978<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_main` | <!-- fact:dist.bw_main -->15 791<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_pump` | <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B | <!-- fact:size_limit_pump -->18 000<!-- /fact --> B (Ausnahme: läuft dank Frist nie neben `bw_main`) |
| `bw_hwtest` | <!-- fact:dist.bw_hwtest -->13 952<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_hwpump` | <!-- fact:dist.bw_hwpump -->14 500<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |
| `bw_zeitraffer` | <!-- fact:dist.bw_zeitraffer -->7 459<!-- /fact --> B | <!-- fact:size_limit -->16 000<!-- /fact --> B |

`bw_install` ist praktisch voll: die Differenz zur Grenze ist kürzer als eine `//!`-Zeile. Wer dort ein Feld ergänzt, muss an anderer Stelle kürzen. `bw_main` und `bw_hwpump` stehen laut CLAUDE.md ebenfalls vor dem Aufteilen oder Kürzen.

> **Hinweis:** Die Grenze schützt den geteilten Script-Heap (~25 KB). Wächst `bw_pump`, gilt zusätzlich die Messung am Gerät: `mem_peak` von `bw_pump` plus 5 348 Byte Parse von `bw_main` unter 25 000 (13.09.2026: 12 516 + 5 348, abgelesen mit `hwtest.js watch`).

## Schritt 2: „Interview me“

Offene fachliche Fragen entscheidet der Mensch – Claude rät nicht, sondern fragt (AGENTS.md). Die Aufforderung dafür lautet: „Wenn du unsicher bist: interview me – eine Frage je Nachricht.“ Eine Frage je Nachricht, damit jede Antwort für sich steht und später als Entscheidung zitierbar ist.

Für ein neues cfg-Feld stehen fünf Fragen immer an:

| Frage | Warum sie zählt | Beispiel Frostschutz `tCold` |
| --- | --- | --- |
| Zielband-Bezug: Wirkt das Feld auf die Freigabekette (`job.why`), auf die Dosis oder auf den Fenster-Regelkreis (`cfg4`)? | entscheidet, ob `bw_main` oder `bw_pump` es liest und ob die Bandprüfung betroffen ist | Freigabekette in `bw_main`: unter `tCold` °C kein Auftrag |
| Startwert: Welcher Wert steht in `DEF` von `bw_install`? `null` heißt „aus“ | der Installer ergänzt fehlende Felder mit genau diesem Wert – auch nach einem Update | `null` (aus), Betreiber trägt z. B. 5 ein |
| Zeitraffer-Wert: Braucht das Profil `ZR3`/`ZR4` einen eigenen Wert? | Zeiten schrumpfen im Zeitraffer (Takt <!-- zr:cfg3.tick -->3<!-- /zr --> min, `tHot` <!-- zr:cfg3.tHot -->30<!-- /zr --> °C statt <!-- def:cfg3.tHot -->35<!-- /def -->) | nein – eine Temperaturschwelle bleibt; `ZR3` überschreibt nur seine eigenen Felder |
| Fehlercode: Neuer Grund in `job.why` (blockiert nicht), neue Störung in `err` (blockiert, Vorrang in `BLOCK`) oder neuer Hinweis in `err` (blockiert nicht, wie `temp`, `zuviel`, `sink` in `ERR_ORDER`)? | ein Grund gilt nur bis zum nächsten Takt; eine Störung blockiert den Auftrag, `noeff` muss ein Mensch löschen; ein Hinweis blockiert nicht und löscht sich selbst | Grund `kalt` in `job.why`, keine Störung |
| Wer liest das Feld: Pflichtfeld in `REQ3` (fehlt → `err=cfg`) oder freiwillig (fehlt → aus, wie `dropW`, `sfUp`)? | ein Pflichtfeld zwingt zum Installer-Lauf nach dem Update | freiwillig |

Die Antworten sind der Rohstoff für die Entscheidungstabelle (Schritt 7): Nummern 1–63 sind vergeben und bleiben stabil, eine neue Erweiterung bekommt die nächste Nummer.

## Schritt 3: Prüfkriterien vorab

Bevor Claude Code schreibt, steht fest, woran Erfolg gemessen wird. Die Kriterien kommen aus den bestehenden Prüfungen:

| Kriterium | Prüft | Grenze und Quelle |
| --- | --- | --- |
| Testfall im Mock | `tools/test/*.test.js`, `npm test` | je Regel ein Test; Helfer `seeded()`, `patch()`, `voltFor()`, `runMain()` in `tools/test/helpers.js` |
| KVS-Größe | `kvs-size.test.js` | 50 Schlüssel, jeder Wert ≤ 253 Zeichen; die Startwerte von `cfg3` haben 202 Zeichen (15.09.2026), die Sicherung `zrb1` trägt `cfg3` als Ganzes |
| Codegröße | `size.test.js`, `npm run build` | unter <!-- fact:size_limit -->16 000<!-- /fact --> B, `bw_pump` <!-- fact:size_limit_pump -->18 000<!-- /fact --> B; nur die `//!`-Zeilen bleiben als Kommentar |
| Sprachumfang | `syntax.test.js` | kein `const`, keine Arrow-Functions, Template-Strings, anonymen Funktionen, kein `Date`; kein Hoisting; nur `push`/`slice`/`splice`/`indexOf`/`join` |
| Aufruftiefe | Mock, Zeile `max. Aufruftiefe` | ≤ <!-- fact:call_depth -->10<!-- /fact --> (Gerät: 12 Ebenen laufen, 14 stürzen ab) |
| Doku-Marker | `npm run docs:check` | jedes `DEF`-Feld steht in der Tabelle von Kapitel 03 mit Startwert-Marker; fehlt eines, meldet die Prüfung „Feld fehlt“ |
| Konsolenzeile | Konsole, `console.js` | welche Zeile das neue Verhalten zeigt (z. B. `why=kalt`); nie mehr als 15 `print` am Stück |
| Gerätekriterium | Prüfprotokoll ([19](19-pruefprotokoll.md)) | was am Gerät zu sehen sein muss: Zeile, `mem_peak`, Zeitplan, KVS-Inhalt |

Der Startwert-Marker in Kapitel 03 sieht so aus (die Prüfung vergleicht ihn mit `DEF` im Installer):

```text
<!-- def:cfg3.tHot -->35<!-- /def -->   # Startwert aus bw_install.js; Zeitraffer-Werte mit zr:, Hardware-Test mit hwt:/hwp:
```

## Schritt 4: Debug-Umgebung starten

1. Mock zuerst: `node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0` zeigt Konsole, KVS, Zeitplan, Switch und die Ergebniszeile mit `max. offene RPC`, `max. Aufruftiefe` und `Fehler`. `--seed` lässt den Installer laufen und setzt das Band ohne `pctOk` – der Takt endet mit `why=cfg`; `--kvs k=v` setzt Einträge vorab (vollständiges Band: siehe Beispielausgabe), `--hwdemo` spielt die Hardware-Tests mit virtuellem Bediener.
2. Gerät erreichbar machen: LAN-IP oder Tunnel `127.0.0.1:8010` ([09](09-installation-vps.md)); `node tools/hwtest.js <ip> preflight` prüft Uhrzeit, Sekunden bis zum nächsten Takt, Abstand zu den Fenstern, laufende Scripts, Eingang, Switch, KVS und den Debug-Websocket.
3. Debug-Fassung bauen: `node tools/build.js --debug` setzt `var DEBUG = 1;` in `dist/` – jedes Script loggt dann Schritte, RPC-Aufrufe und KVS-Einträge. Mitlesen mit `node tools/console.js <ip> [sek] [id]`; der Debug-Websocket muss an sein (Web-UI → Konsole einmal öffnen). Für den Betrieb wieder `npm run build` hochladen.
4. Flash prüfen: `node tools/hwtest.js <ip> scripts` zeigt Größe, `mem_peak` und `fs_free`; `put-script.js` bricht ab, wenn `fs_free` plus alter Code kleiner als neue Datei plus 4 096 Byte ist. Test-Scripts kosten Flash (13.09.2026: `fs_free` 12 288 → 49 152 B nach dem Löschen von drei Test-Scripts).
5. Zeitfenster wählen: Pumpentests nie in den <!-- hwp:winMin -->25<!-- /hwp --> min um `winA`, `winB` und Mitternacht (`winMin` in `bw_hwpump`); `zeitraffer` und `normal` warten selbst auf einen sicheren Moment (Sekunde 8–30, kein Betriebs-Script läuft, im Normalbetrieb nicht in den 9 min nach `winA`/`winB`, im Zeitraffer nicht in den Minuten 0–2 eines 6er-Zyklus).

> **Achtung (Wasser/Strom):** Ein Gerätelauf mit Pumpe braucht einen vollen Behälter und einen liegenden Schlauch. Vor einer echten Gabe kurz bestätigen lassen – Claude fragt, der Mensch schaut hin.

```bash
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0   # Mock: Takt, Band ohne pctOk → why=cfg
node tools/hwtest.js <ip> preflight        # Gerät: Uhr, Takt, Fenster, Scripts, KVS, Debug-Websocket
node tools/build.js --debug                # dist/ mit DEBUG = 1 (nur zum Debuggen hochladen)
node tools/console.js <ip> 600             # Konsole 600 s mitlesen (Node ≥ 22), vorher verbinden
node tools/hwtest.js <ip> scripts          # Größe, mem_peak, fs_free je Script
```

## Schritt 5: Coding

Die vollständigen Regeln mit Begründung stehen in [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) („Harte Regeln für `scripts/*.js`“); `tools/test/syntax.test.js` erzwingt sie. Kurzfassung (Quelle: CLAUDE.md):

- Nur `var` und benannte Funktionen: kein `const` (Test), keine Arrow-Functions, Template-Strings, anonymen Funktionen, kein `Date`. `let` steht zwar in der Language Reference, das Projekt nutzt es nicht.
- Array-Methoden nur `push`, `slice`, `splice`, `indexOf`, `join` – `shift`, `forEach`, `map` und Co. kennt mJS nicht (Gerät 13.09.2026: `Function "shift" not found!`).
- Kein Hoisting: Funktionsnamen auf Modulebene erst nach der Deklaration; die Schrittliste `steps[]` steht ganz unten. Der Mock hoistet und zeigt den Fehler nicht, nur der Test.
- Flache Aufrufkette: `next()` ist eine Schleife, ein fertiger Schritt gibt `true` zurück; nie `next()` aus einem Schritt heraus rufen.
- Ein offener `Shelly.call` und ein Timer je Script; alles Wissen im KVS als JSON-String, nur Änderungen schreiben; Zeitkonstanten in cfg-Felder, nicht in den Code.
- Geteilter Heap: nie zwei große Scripts gleichzeitig; Langläufer geben `K`/`orig` in Wartephasen frei.
- Konsole: nie mehr als 15 `print` am Stück; neue Diagnosepunkte als `dbg(...)`, im Repo bleibt `DEBUG = 0`.
- Versionszeile in Zeile 1 und `var VER` mitziehen; die Kompakt-Ausgabe muss unter der Grenze bleiben.

### Geräte-Doku mit `//!`

Jedes Script trägt direkt unter der Versionszeile einen Block aus `//!`-Zeilen: kurz und praxisnah, was welche Einstellung bewirkt. Der Build lässt genau diese Zeilen als `// …` in `dist/` stehen, alle anderen Kommentare fallen weg (`size.test.js` prüft das). Ein neues Feld bekommt seine Zeile im `//!`-Block des Installers (Gruppe `cfg1`…`cfg4`) und im Script, das es liest.

### Ein neues cfg-Feld

| Stelle | Was zu tun ist |
| --- | --- |
| `scripts/bw_install.js`, `DEF` | Feld mit Startwert in die richtige Gruppe; `ORDER` bleibt, wenn keine neue Gruppe entsteht. Der Installer ergänzt es in vorhandenen Einträgen beim nächsten Lauf (`hwtest.js <ip> normal`) |
| `scripts/bw_zeitraffer.js`, `ZR3`/`ZR4` | nur, wenn der Zeitraffer einen anderen Wert braucht; das Profil überschreibt ausschließlich die dort genannten Felder, `zrb1`…`zrb5` sichern das Original |
| lesendes Script | `REQ`-Liste nur für Pflichtfelder; freiwillige Felder mit `null`-Prüfung lesen |
| `//!`-Block | eine Zeile im Installer und im lesenden Script |
| `tools/test/` | Test je Regel; `kvs-size.test.js` mit dem Worst Case des Eintrags |
| Kapitel 03 | Zeile in der Tabelle der Gruppe mit Startwert-Marker – sonst schlägt `docs:check` fehl |

Zeitwerte wie `tDead`, `tPmin`, `tSoak` oder `tStab` werden nie aus dem Bauch geändert: erst ein Messlauf am Aufbau (`hwtest.js <ip> mess`, Ergebnis ins Prüfprotokoll), dann die Startwerte.

## Schritt 6: Prüfung

Die Reihenfolge ist fest, weil jede Stufe die vorige voraussetzt:

1. `npm test` – <!-- fact:tests -->146<!-- /fact --> Tests gegen den Mock, inklusive `syntax`, `size`, `kvs-size`, `dist` und `docs`.
2. `npm run check` – `node --check` der sechs Scripts (keine Ausgabe heißt bestanden).
3. `npm run build` – `dist/` neu schreiben und die Größen lesen. `dist/` ist eingecheckt; `dist.test.js` verlangt, dass es byteidentisch zum Build ist, also gehört es in den Commit.
4. `npm run docs:check` (= `node tools/check-docs.js --mit-tests`) – Links, Anker, Parität DE/EN, Vorlage, Fakt- und Startwert-Marker, veraltete Ausdrücke, Diagramm-Quittungen und die Testzahl.
5. Upload: `node tools/put-script.js <ip> <id> dist/<script>.js` schickt die Datei in 1 024-Zeichen-Stücken, lädt den Code zurück und meldet `OK, byteidentisch` samt `fs_free` vorher → nachher. Danach `node tools/verify-scripts.js <ip>`: alle Scripts gegen `dist/`, Doku-Zeilen gezählt, Versionen `bw_main` = `bw_pump`.
6. Gerätelauf: Script starten, Konsole mitlesen, Kriterium aus Schritt 3 abhaken; Zeilen und Messwerte ins Prüfprotokoll ([19](19-pruefprotokoll.md)). Nach einem Script-Update einmal `hwtest.js <ip> normal`, damit der Installer neue Felder anlegt.
7. Überraschung am Gerät? Eintrag im Lernlog ([18](18-lernlog-geraet.md)) nach dem Schema Symptom · Ursache · Warum unentdeckt · Fix · Vorbeugung – und die Vorbeugung als Regel in `syntax.test.js` oder als Nachbildung im Mock.

```bash
npm test                                   # 146 Tests, Ende: # pass 146 / # fail 0
npm run check                              # node --check der sechs Scripts
npm run build                              # dist/: Größe je Script, Doku-Zeilen
npm run docs:check                         # Doku-Prüfung mit Testzahl
node tools/put-script.js <ip> <id> dist/bw_main.js   # Upload in Stücken + Byte-Vergleich
node tools/verify-scripts.js <ip>          # alle Scripts am Gerät gegen dist/
node tools/hwtest.js <ip> normal 30        # Installer: neue Felder anlegen, Zeitplan prüfen
```

## Schritt 7: Doku und Commit

| Änderung | Wohin |
| --- | --- |
| neues oder geändertes cfg-Feld | [03 · Konfiguration](03-konfiguration.md): Tabelle der Gruppe, Startwert-Marker, wer liest es, wann der Installer neu laufen muss |
| neuer `why`- oder `err`-Code | [13 · Betrieb und Wartung](13-betrieb-und-wartung.md): Codetabelle mit Bedeutung und Abhilfe |
| Design-Entscheidung | [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md): nächste Nummer, Thema, Entscheidung mit Begründung und Datum |
| Gerätefund | [18 · Lernlog vom Gerät](18-lernlog-geraet.md): Symptom · Ursache · Warum unentdeckt · Fix · Vorbeugung |
| neuer RPC-Aufruf | [20 · RPC- und Engine-Referenz](20-rpc-referenz.md): vor dem ersten Aufruf nachschlagen, dann Aufruf, Parameter, Antwort, Genutzt von, Doku-Link ergänzen |
| Gerätelauf | [19 · Prüfprotokoll am Gerät](19-pruefprotokoll.md): Datum, Versionen, Zeilen, Messwerte |

Commit und Pull Request:

1. Nie direkt auf `main` arbeiten: Branch anlegen, Pull Request öffnen.
2. Sprache in Code-Kommentaren, Doku und Commit-Text: Deutsch.
3. `dist/` und die Diagramm-Quittungen gehören in denselben Commit wie die Quelle.
4. **`git commit` und `git push` nur nach ausdrücklicher Zustimmung des Menschen** – Claude bereitet vor, erklärt den Diff und fragt; das gilt für jeden Commit (AGENTS.md).
5. Push vom VPS braucht einen Deploy-Key oder ein Token: eingerichtet in [09 · Installation mit VPS-Server](09-installation-vps.md).

## Beispiel: Frostschutz `tCold` durchgespielt

Ein Feld, das es im Repo (Stand <!-- fact:project.version -->0.2.0<!-- /fact -->) nicht gibt – als Probe für den Prozess: unter `tCold` °C soll `bw_main` keinen Auftrag schreiben, so wie `tHot` <!-- def:cfg3.tHot -->35<!-- /def --> °C heute die Pause auf `pauseHot` verkürzt.

| Schritt | Ergebnis für `tCold` |
| --- | --- |
| 1 Plan | nur `bw_main` (Freigabekette) und `bw_install` (`DEF.cfg3`); Reserve: `bw_main` <!-- fact:dist.bw_main -->15 791<!-- /fact --> B reicht für eine Zeile, `bw_install` <!-- fact:dist.bw_install -->15 978<!-- /fact --> B nicht für Feld plus `//!`-Zeile – dort eine Doku-Zeile straffen |
| 2 Interview | Freigabekette; Startwert `null` = aus; kein Zeitraffer-Wert; Grund `kalt` in `job.why`, keine Störung; freiwillig (nicht in `REQ3`) |
| 3 Kriterien | Test: `tC` 2 °C mit `tCold` 5 → `job.ok=false`, `why=kalt`; `tC` 8 → `why=ok`; `cfg3` bleibt unter 253 Zeichen (215 mit `tCold`); Konsole `why=kalt`; Gerät: eine Taktzeile mit `why=kalt` bei kaltem Fühler |
| 4 Debug-Umgebung | Mock mit `--temp 2`; am Gerät Fühler-Hülse ins Eiswasser wie beim Hardware-Test |
| 5 Coding | in `stepEval()` ein `else if` vor `feucht`: `tCold !== null && m.tC !== null && m.tC < tCold` → `why = "kalt"`; `//!`-Zeile in beiden Scripts; Test in `main.test.js` |
| 6 Prüfung | `npm test`, `check`, `build`, `docs:check`; Upload `bw_main` und `bw_install`, `verify-scripts`; `normal 30` legt `tCold` an; Gerätelauf ins Prüfprotokoll |
| 7 Doku | Kapitel 03 (`cfg3`, Marker), 13 (`kalt`), 17 (Entscheidung 64); Commit erst nach Freigabe |

So könnte der Testfall aussehen (Muster aus `main.test.js`):

```js
test('Frostschutz: unter tCold kein Auftrag, why kalt', () => {
  const dev = seeded();                       // Installer gelaufen, Beispiel-Zielband
  patch(dev, 'cfg3', { tCold: 5 });           // Feld setzen
  dev.voltage = voltFor(34);                  // trocken genug für einen Auftrag
  dev.tC = 2;                                 // kalt
  const r = runMain(dev);
  assert.deepEqual(r.errors, []);
  assert.equal(dev.kvsGet('job').ok, false);
  assert.equal(dev.kvsGet('job').why, 'kalt');
});
```

## Beispielausgabe

Prüfkette im Repo am 15.09.2026, Stand <!-- fact:project.version -->0.2.0<!-- /fact --> ohne Änderung – so sieht „grün“ aus:

```text
$ npm test
# tests 146
# suites 0
# pass 146
# fail 0

$ npm run build
bw_install.js    23789 →  15978 Byte, 22 Doku-Zeilen
bw_main.js       23059 →  15791 Byte, 8 Doku-Zeilen
bw_pump.js       20330 →  17475 Byte, 5 Doku-Zeilen
bw_hwtest.js     16792 →  13952 Byte, 4 Doku-Zeilen
bw_hwpump.js     18736 →  14500 Byte, 4 Doku-Zeilen
bw_zeitraffer.js 13822 →   7459 Byte, 12 Doku-Zeilen
dist/ geschrieben – hochladen mit node tools/put-script.js <ip> <id> dist/<datei>, prüfen mit node tools/verify-scripts.js <ip>
```

Der Mock-Lauf von `bw_main` mit vollständigem Zielband (Takt bei 34 % Feuchte, 24 °C, Behälter voll) braucht `pctOk` per `--kvs`, weil `--seed` das Feld auf `null` lässt:

```bash
node tools/run-script.js scripts/bw_main.js --seed --voltage 1.2 --temp 24 --level 0 --kvs 'cfg2={"pctSoll":55,"pctLo":40,"pctHi":60,"pctDry":28,"hyst":2,"dropSlow":4,"effMin":0.05,"effMax":30,"alpha":0.3,"sfMin":0.5,"sfStep":0.1,"pctOk":50,"dropW":null,"sfUp":0.05}'   # vollständiges Band; --seed allein lässt pctOk null → why=cfg, err=cfg
```

Der Lauf endet mit der Konsolen- und der Ergebniszeile, an denen die Kriterien aus Schritt 3 hängen:

```text
[bw_main 0.2.0] V=1.2 pct=34.13 tC=24 lvl=0 st=beob dry=0 pause=24h why=ok sec=70 effW=- sf=0.7 err=- w=3 dauer=2600ms
--- Ergebnis --- beendet=true Dauer=2600 ms, max. offene RPC=1, max. Aufruftiefe=5, Fehler=0
```

`why=ok sec=70`: erster Auftrag mit `tStd`, weil `effW` noch `null` ist; `w=3` Schreibvorgänge; ein offener RPC, Aufruftiefe 5 von erlaubten <!-- fact:call_depth -->10<!-- /fact -->, kein Fehler. Am Gerät kommt dieselbe Zeile über `console.js` oder `hwtest.js watch`.

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `npm test` grün, am Gerät `ReferenceError: "stepRead" is not defined` (12.09.2026) | Funktionsname auf Modulebene vor der Deklaration benutzt – der Mock hoistet, mJS nicht | Schrittliste und Tabellen mit Funktionsreferenzen ans Dateiende bzw. in eine Funktion; `syntax.test.js` meldet es, wenn die Zeile außerhalb einer Funktion steht |
| `Function "shift" not found!` | Array-Methode, die mJS nicht kennt | Ringpuffer per Index, Schleifen mit `for`; nur `push`/`slice`/`splice`/`indexOf`/`join` |
| Script endet ohne Konsolenzeile, `Script.GetStatus` zeigt `out_of_memory` | zweites großes Script lief gleichzeitig oder KVS-Objekte blieben in Wartephasen im Heap | nie zwei große Scripts zur selben Sekunde; `K = {}; orig = {}` in Wartephasen; `mem_peak` mit `hwtest.js watch` messen |
| `Too much recursion` | verschachtelte Aufrufe über die Stacktiefe hinaus | `next()` als Schleife, Schritte geben `true` zurück; Mock-Zeile `max. Aufruftiefe` beachten |
| `SyntaxError: Got EOF` nach dem Einfügen im Editor | die Web-UI hat beim Einfügen Text verloren (12.09.2026: 166 bzw. 210 Byte) | `put-script.js` nutzen, danach `verify-scripts.js` – byteidentisch |
| `bw_main` meldet `err=cfg` („cfg3.x fehlt“) nach dem Update | neues Pflichtfeld, Installer noch nicht gelaufen | `hwtest.js <ip> normal 30` – oder das Feld freiwillig machen |
| `docs:check`: „Tabelle cfg3: Feld tCold fehlt“ | Feld in `DEF`, aber nicht in Kapitel 03 | Zeile mit Startwert-Marker in die Tabelle |
| `dist.test.js` rot | `dist/` nicht neu gebaut oder nicht eingecheckt | `npm run build`, `dist/` mit committen |
| Upload bricht ab: „Flash zu voll“ | `fs_free` plus alter Code kleiner als Datei plus 4 096 B | `hwtest.js <ip> scripts`, Test-Script mit `delete <id>` entfernen |

## Weiter zu

- [14 · Debuggen und Testen](14-debuggen-und-testen.md) – Mock, Tests, Konsole und die vollständige Werkzeug-Referenz für Schritt 4 und 6
- [16 · Konzept und Entscheidungen](16-konzept-und-entscheidungen.md) – die Bauprinzipien, an denen sich eine Erweiterung messen lassen muss
- [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md) – wo die Entscheidung aus dem Interview landet
- [18 · Lernlog vom Gerät](18-lernlog-geraet.md) – wohin jede Überraschung vom Gerät kommt
- [19 · Prüfprotokoll am Gerät](19-pruefprotokoll.md) – wohin Zeilen und Messwerte des Gerätelaufs kommen
- [20 · RPC- und Engine-Referenz](20-rpc-referenz.md) – vor jedem neuen RPC-Aufruf nachschlagen
