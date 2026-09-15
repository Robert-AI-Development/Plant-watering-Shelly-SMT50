# 11 · Hardware-Check (bw_hwtest, bw_hwpump)

**Deutsch** · [English](../en/11-hardware-check.md) — [Handbuch](README.md) · Teil D „Betreiben“

> **Auf einen Blick**
> - Ergebnis: Temperaturfühler, Bodenfeuchtesensor, Schwimmer und Pumpe sind am fertigen Aufbau geprüft; `cfg1.vDry`, `cfg1.vWet` und `cfg1.lvlEmpty` sind gemessen und eingetragen.
> - Umfang: zwei Test-Scripts, gesteuert im Interview mit `tools/hwtest.js` – Sensortest in sechs Phasen (am 13.09.2026: 532 s), Pumpentest mit einer Portion von <!-- hwt:pumpSec -->30<!-- /hwt --> s in zwei Durchgängen.
> - Wichtigste Zahlen: Timeout je Phase <!-- hwt:tPhase -->900<!-- /hwt --> s, für den ganzen Lauf <!-- hwt:tAll -->3600<!-- /hwt --> s; der Pumpentest startet nicht ± <!-- hwt:winMin -->25<!-- /hwt --> min um 08:00, 20:00 und Mitternacht.
> - Größter Stolperstein: der Script-Heap (~25 KB) ist geteilt – `bw_pump` muss allein laufen, deshalb zwei Durchgänge; und die Test-Scripts kosten Flash, also nach dem Test löschen.

## Voraussetzungen

- Installer gelaufen ([06 · Startanleitung](06-startanleitung.md)): `cfg1` muss `vDry`, `vWet`, `vErrLo`, `vErrHi`, `lvlEmpty`, `nLvl`, `idV`, `idT`, `idLvl`, `idSw` enthalten, sonst bricht `bw_hwtest` mit `cfg1.<Feld> fehlt – Installer zuerst` ab. Die Uhr des Shelly muss gestellt sein (NTP).
- Eingang 1 (Wasserstand) aktiv und vom Typ `switch`; `preflight` meldet sonst einen Blocker, `input-on` stellt es um.
- Node ≥ 22 auf einem Rechner mit Zugriff auf den Shelly – direkt im LAN ([08](08-installation-lokaler-server.md)) oder über den Tunnel ([09](09-installation-vps.md)). Der Debug-Websocket muss an sein, sonst zeigt `watch` keine Konsolenzeilen (Web-UI → Konsole öffnen; `preflight` warnt).
- `npm run build` ausgeführt, damit `dist/bw_hwtest.js` und `dist/bw_hwpump.js` aktuell sind.
- Am Aufbau: Eiswasser oder kaltes Leitungswasser (≤ <!-- hwt:tLo -->20<!-- /hwt --> °C), warmes Wasser oder Handwärme (≥ <!-- hwt:tHi -->30<!-- /hwt --> °C), ein Glas Wasser für den SMT50, ein Tuch, ein Eimer für den Pumpenschlauch, Wasserbehälter voll. Der Schwimmer muss sich von Hand in beide Stellungen bringen lassen.
- Nur die Metallhülse des DS18B20 bzw. den Sensorkörper des SMT50 eintauchen; Stecker und Kabel bleiben trocken.
- Zeitwache: nicht in den <!-- hwp:winMin -->25<!-- /hwp --> Minuten um 08:00, 20:00 oder Mitternacht starten – der Pumpentest wartet sonst. `preflight` warnt schon, wenn ein Fenster weniger als 30 min entfernt ist.

## Diagramm

[![Hardware-Check im Interview: Sensortest in sechs Phasen, Pumpentest in zwei Durchgängen, Not-Aus](../diagramme/de/11-hardware-check.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/11-hardware-check.html)

Interaktive Fassung (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Sensortest in sechs Phasen“, 2 „Pumpentest in zwei Durchgängen“, 3 „Not-Aus und Wiederanlauf“.

## So läuft der Check

Zwei zusätzliche Scripts prüfen den Aufbau Schritt für Schritt: `bw_hwtest` (Version <!-- fact:ver.bw_hwtest -->0.1.0<!-- /fact -->) die drei Sensoren, `bw_hwpump` (Version <!-- fact:ver.bw_hwpump -->0.1.0<!-- /fact -->) die Pumpe – und zwar über `bw_pump`, genau wie im Normalbetrieb. Beide laufen **nur von Hand**, nie im Zeitplan, und sind Langläufer: Sie warten je Phase, bis der physische Zustand da ist.

Gesteuert wird vom Rechner aus mit `tools/hwtest.js` (Version <!-- fact:ver.hwtest -->0.1.2<!-- /fact -->) im Interview: Das Script nennt in der Konsole die Anweisung, du (oder Claude über den Tunnel, [10 · Installation mittels Claude Code](10-installation-claude-code.md)) baust die Phase auf und gibst sie mit `go` frei. Die Kommandos gehen über den KVS-Eintrag `hwc`, der Stand steht jederzeit in `hwr` (Sensortest) und `hwp` (Pumpentest).

```bash
npm run build                                            # dist/ aktuell
node tools/hwtest.js <ip> preflight hw                   # Uhrzeit, Scripts, Eingang 1, Ausgang, KVS; legt bw_hwtest/bw_hwpump an, nennt die Upload-Befehle mit ID
node tools/put-script.js <ip> <id> dist/bw_hwtest.js     # Upload in Stücken, byteidentische Prüfung, Flash-Prüfung
node tools/put-script.js <ip> <id> dist/bw_hwpump.js
node tools/hwtest.js <ip> input-on                       # nur wenn preflight „Input 1 deaktiviert“ meldet
node tools/hwtest.js <ip> start bw_hwtest 20             # Sensortest starten, 20 s mitlesen
node tools/hwtest.js <ip> watch 120                      # Konsole + Statuszeile; beliebig oft wiederholen
node tools/hwtest.js <ip> go                             # wartende Phase freigeben (auch: skip, abort)
node tools/hwtest.js <ip> start bw_hwpump 20             # Pumpentest Durchgang A; danach go
node tools/hwtest.js <ip> watch 240                      # wartet auf bw_pump und startet Durchgang B von selbst
node tools/hwtest.js <ip> report                         # Berichte aus hwr/hwp mit cfg1-Vergleich
node tools/hwtest.js <ip> cleanup                        # hwc/hwb1/hwb2 löschen (hwt, hwr, hwp bleiben als Nachweis)
node tools/hwtest.js <ip> delete bw_hwtest               # Flash freigeben; ebenso delete bw_hwpump
```

Die Script-IDs vergibt das Gerät: `preflight hw` legt fehlende Test-Scripts per `Script.Create` an und druckt für jedes den fertigen Upload-Befehl mit ID; `hwtest.js <ip> scripts` zeigt die Liste jederzeit. Danach: Sensoren zurück in den Topf, Schwimmer auf VOLL, Behälter füllen.

> **Achtung (Wasser/Strom):** Der Pumpentest pumpt <!-- hwt:pumpSec -->30<!-- /hwt --> s in den Eimer. Bleib dabei, der Schlauch liegt sicher, der Behälter ist voll. Not-Aus: `node tools/hwtest.js <ip> stop` oder OUT1 in der Web-UI ausschalten.

## Sensortest bw_hwtest

### Sechs Phasen

Das Script liest jede Sekunde (`msTick`) den Eingang (für den Wechselzähler) und den Sensor der laufenden Phase, schreibt alle <!-- hwt:nLog -->5<!-- /hwt --> Ticks eine Konsolenzeile und fragt alle <!-- hwt:nCmd -->2<!-- /hwt --> Ticks den Kommandokanal ab. Jede Phase endet, wenn ihr Kriterium erfüllt ist – oder mit Timeout nach `tPhase` (<!-- hwt:tPhase -->900<!-- /hwt --> s).

| Phase | Anweisung am Aufbau | Ende, wenn |
| --- | --- | --- |
| t1 | Fühlerhülse in kaltes Wasser | `nStab` (<!-- hwt:nStab -->5<!-- /hwt -->) Lesungen in Folge ≤ `tLo` (<!-- hwt:tLo -->20<!-- /hwt --> °C) |
| t2 | Fühler in warmes Wasser oder in die Hand | `nStab` Lesungen in Folge ≥ `tHi` (<!-- hwt:tHi -->30<!-- /hwt --> °C) |
| m1 | SMT50 aus dem Topf, abwischen, trocken in der Luft halten, dann `go` | nach `go`: `nStab` Werte mit Spannweite ≤ `dV` (0,03 V), Mittel ≤ `vDryMax` (0,5 V) und ≥ `vErrLo` + 0,05 V → Trockenpunkt |
| m2 | Sensor senkrecht bis zur Markierung ins Wasserglas (kein `go`) | `nStab` stabile Werte, Mittel ≥ `vWetMin` (2,5 V) und ≤ `vErrHi` − 0,1 V → Nasspunkt |
| l1 | Schwimmer einmal bewegen, dann in Stellung LEER halten, `go` | nach `go`: mindestens ein beobachteter Eingangswechsel und `nLvl` (<!-- def:cfg1.nLvl -->3<!-- /def -->) gleiche Lesungen → `lvlEmpty` |
| l2 | Schwimmer auf VOLL halten, `go` | `nLvl` gleiche Lesungen, anders als in l1 |

Solange ein Kriterium nicht passt, sagt das Script einmal, was fehlt – mit dem Messwert in Klammern:

| Meldung | Phase | Bedeutung / Abhilfe |
| --- | --- | --- |
| `Sensor nicht trocken (0.62 V > 0.5) – abtrocknen, warten` | m1 | Mittel über `vDryMax`: Sensor abwischen, in der Luft halten, warten |
| `Spannung zu niedrig (0.12 V) – Sensor angeschlossen?` | m1 | Mittel unter `vErrLo` + 0,05 V: Stecker und Kabel des SMT50 prüfen |
| `Spannung zu hoch (3.3 V) – Verdrahtung/Messbereich prüfen` | m2 | Mittel über `vErrHi` − 0,1 V: Verdrahtung und Messbereich des Voltmeters prüfen |
| `noch kein Wechsel am Eingang gesehen – Schwimmer bewegen, dann LEER halten` | l1 | seit dem Start kein Eingangswechsel: Schwimmer einmal umlegen, dann LEER halten |
| `Eingang zeigt noch LEER (1) – Schwimmer auf VOLL` | l2 | Eingang wie in l1: Schwimmer in Stellung VOLL bringen |

Ein `go` in einer Phase, die nicht darauf wartet, wird gemeldet und verworfen.

### Ergebniscodes und Auswahl mit hwt.run

| Code | Bedeutung |
| --- | --- |
| `ok` | Kriterium erfüllt |
| `sk` | übersprungen (`skip`, oder die Phasengruppe steht nicht in `hwt.run`) |
| `to` | Timeout `tPhase` |
| `ab` | Abbruch (`abort` oder Gesamtzeit `tAll` überschritten); der Lauf springt zum Bericht |
| `nl` | Sensor liefert <!-- hwt:nNull -->10<!-- /hwt --> Ticks lang `null` – Fühler, Kabel oder Komponente prüfen |

Mit `hwt.run` wählst du Phasengruppen: `"tml"` (Standard) sind Temperatur, Feuchte und Wasserstand; `node tools/hwtest.js <ip> cfg run='"m"'` lässt nur m1/m2 laufen, etwa für eine neue Kalibrierung nach einem Sensorwechsel. Übersprungene Phasen stehen als `sk` im Stand. Ein Vermerk `t1:sofort` im Bericht heißt, dass die Phase innerhalb der ersten `nStab` Ticks fertig war – der Zustand war schon vorher da.

### Kalibrierwerte nach cfg1

Am Ende prüft das Script die Messwerte auf Plausibilität und schreibt sie nach `cfg1` (Lesen-Ändern-Schreiben auf einem frisch gelesenen Eintrag, nur bei Änderung):

- `vDry`/`vWet`: nur wenn m1 und m2 `ok` sind und der Nasspunkt mindestens 1 V über dem Trockenpunkt liegt; sonst Vermerk `cal:vWet-vDry<1V`.
- `lvlEmpty`: nur wenn l1 und l2 `ok` sind und LEER ≠ VOLL.
- Schalter `hwt.cal` (Startwert <!-- hwt:cal -->1<!-- /hwt -->): `0` meldet nur (`(nur melden)` in der Konsole), schreibt nichts.

Alt- und Neuwert stehen in `hwr.cal` als `alt>neu;alt>neu;alt>neu` (vDry, vWet, lvlEmpty). Der Bericht kommt als fünf Konsolenzeilen, eine je Tick, weil Print-Bursts im Debug-Websocket verloren gehen. Was die Werte bedeuten und wie das Zielband dazukommt: [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md).

## Pumpentest bw_hwpump in zwei Durchgängen

Der Pumpentest schaltet die Pumpe **nie selbst ein**. Er schreibt einen Auftrag und startet `bw_pump`, das mit `toggle_after`, `auto_off` und Wasserstandsprüfung genau wie im Gießfenster arbeitet ([04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md)). Weil der Script-Heap geteilt ist, beendet sich das Test-Script vor dem Pumpenlauf und kommt danach für die Bewertung zurück – erkennbar am KVS: ohne Sicherung `hwb1`/`hwb2` ist ein Start Durchgang A, mit Sicherung Durchgang B.

### Durchgang A: Freigabe, Zeitwache, Sicherung, Auftrag

1. Vorprüfung ohne Wartezeit: `bw_pump` muss am Gerät sein, es darf höchstens ein anderes Script laufen, und die Störung `noeff` darf nicht stehen – sonst endet p0 sofort mit `fe` (blockiert).
2. Phase p0 wartet auf `go` (Behälter voll, Schlauchende im Eimer, du bleibst dabei). Die Konsole zeigt alle `nLog` (<!-- hwp:nLog -->5<!-- /hwp -->) Ticks `p0 sw=0 lvl=0 t=25s (warte auf go)`.
3. Nach `go` greift die Zeitwache: nicht in den ersten `guardS` (<!-- hwp:guardS -->90<!-- /hwp -->) Sekunden eines Viertelstundentakts und nicht in dessen letzten `guardS` + `pumpSec` Sekunden (mit 30 s Pumpdauer: nach Sekunde 780), nicht ± `winMin` (<!-- hwp:winMin -->25<!-- /hwp -->) Minuten um `winA`, `winB` und 00:00. Das Script meldet `warte: takt`, `warte: fenster` oder `warte: uhr` und prüft weiter. Der Takt ist mit 15 min fest im Script – deshalb läuft der Pumpentest nur im Normalbetrieb, nicht im Zeitraffer.
4. Dann Vorbedingungen: Ausgang aus (`Ausgang EIN – ausschalten`), Wasserstand lesbar, `nLvl` gleiche Lesungen und nicht LEER (`Wasserstand LEER – füllen`).
5. KVS neu lesen, sichern: `st` und `day` nach `hwb1`, `job`, `err` und `lrn` nach `hwb2` (zwei Schlüssel, weil ein Eintrag höchstens 253 Zeichen fasst). Scheitert die Sicherung, endet A ohne Pumpenlauf (p1 `fe`).
6. Für den Lauf freimachen: `err` auf keine Störung, `day` bei erreichtem Tageslimit `maxDay` zurücksetzen, Auftrag `job = {ok:true, sec:pumpSec, pct:null, why:"hwtest"}` schreiben. `pct:null` heißt für `bw_pump`: Einzelportion ohne Messung und ohne Lernwert.
7. `Script.Start bw_pump`, Stand `hwp.s = "pumpt"` schreiben, `Script.Stop` auf die eigene ID: `fertig r=ok,-,-,-`.

`pumpSec` kommt aus `hwt` (Startwert <!-- hwp:pumpSec -->30<!-- /hwp --> s) und wird auf `cfg3.tMax` (<!-- def:cfg3.tMax -->180<!-- /def --> s) gekappt. Andere Dauer: `node tools/hwtest.js <ip> cfg pumpSec=10`.

### bw_pump: eine Portion

`bw_pump` sieht einen Auftrag ohne `pct` und läuft als Einzelportion: keine Frischmessung, keine Sperre `laeuft`, kein Lernwert. Es prüft den Wasserstand (`nLvl` gleiche Lesungen), schaltet mit `toggle_after` für `clamp(job.sec, 1, min(tPmax, tMax))` Sekunden ein – mit `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> und `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> also genau die 30 s – und kontrolliert alle `tChk` (<!-- def:cfg3.tChk -->5<!-- /def -->) s Schwimmer und Ausgang. Ergebnis im KVS: `st.state = gegossen`, `st.sec = 30`, `day.n + 1`, `job.ok = false`, `job.why = ok`.

### Durchgang B: Vergleich, Rückbau, Bericht

`hwtest.js watch` startet B von selbst, sobald `bw_pump` nicht mehr läuft (höchstens zwei Versuche); läuft `bw_pump` noch, wartet `watch` 5 s. B liest den KVS, vergleicht mit dem Auftrag und baut zurück:

| Code | ok, wenn | sonst |
| --- | --- | --- |
| p1 | `bw_pump` hat eine Gabe eingetragen (`st.ts` nach dem Start von A) | `fe`, p2 wird `sk` |
| p2 | Ausgang nach dem Ende von `bw_pump` aus | `aw` – B schaltet ihn aus (`Sicherheits-Aus`) |
| p3 | `st.state = gegossen`, `st.sec = pumpSec`, `job.ok = false`, `job.why = ok` | `aw` (Abweichung) |

Rückbau: `st`/`day` aus `hwb1`, `job`/`err`/`lrn` aus `hwb2` zurück, `job.ok` immer `false`, `hwp.s = "ende"`, Sicherung löschen – nur geänderte Einträge werden geschrieben. Der Echtbetrieb bemerkt vom Test nichts: keine Pause, kein Tageszähler, kein Lernwert, kein überlebender Testauftrag. Der Bericht sind zwei Zeilen: `Bericht 1/2 p0 ok | p1 ok | p2 ok | st=gegossen sec=30 why=ok | p3 ok` und `Bericht 2/2 Ende mit Rückbau rec=0 …`.

Startet B, ohne dass A regulär endete (Stand nicht `pumpt`), steht `rec=1` (Wiederanlauf) im Bericht. Meldet B `bw_pump läuft noch – später erneut starten`, bleibt die Sicherung stehen; `watch` oder ein erneuter `start bw_hwpump` holt B nach.

## Kommandokanal hwc und das Werkzeug hwtest.js

`go`, `skip` und `abort` schreibt `hwtest.js` als Zähler in den KVS-Schlüssel `hwc` (`{n, cmd}`). Das Script verarbeitet nur ein `n`, das größer ist als das zuletzt gesehene – alte Kommandos wirken nie, `start` setzt `n` auf 0. `skip` beendet die Phase mit `sk`, `abort` den Lauf mit `ab`. Alternativen wie `Script.Eval` wurden verworfen, weil der KVS überall sichtbar und im Mock nachgebildet ist (Entscheidung 22, [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md)).

| Kommando | Was es tut |
| --- | --- |
| `preflight [hw]` | Uhrzeit, Sekunden bis zum nächsten `bw_main`-Takt, Abstand zu `winA`/`winB`/Mitternacht, Debug-Websocket, laufende Scripts, Eingang 1, Ausgang, Sensoren, `err`/`job`/`day`/`hwt`, alte Sicherung `hwb1`/`hwb2`. Legt `bw_zeitraffer` an, mit `hw` auch `bw_hwtest`/`bw_hwpump`, und nennt die Upload-Befehle. Exit 1 bei Blockern |
| `scripts` | alle Scripts mit Größe am Gerät, laufend, `mem_peak`, Fehlern; `fs_free`, `ram_free`, freier Script-Heap |
| `delete <id\|name>` | Script per `Script.Delete` löschen, `fs_free` vorher/nachher; verweigert bei `bw_install`, `bw_main`, `bw_pump`, `bw_zeitraffer` und laufenden Scripts |
| `input-on` | `Input.SetConfig` Eingang `cfg1.idLvl` auf `enable: true, type: "switch"` – die einzige Konfigurationsänderung des Werkzeugs |
| `cfg k=v …` | Felder in `hwt` setzen, Werte als JSON: `cfg tLo=21 pumpSec=10 run='"m"'`; verweigert, wenn `hwt` über 253 Zeichen käme |
| `start <name> [sek]` | `hwc {n:0}` schreiben, alten Bericht (`hwr` bzw. `hwp`) löschen, Konsole verbinden, `Script.Start`, dann `watch` für `sek` s (Standard 60) |
| `watch [sek]` | Konsole über den Debug-Websocket plus alle 5 s eine Statuszeile aus `hwr`/`hwp` (nur bei Änderung gedruckt); startet Durchgang B; endet, wenn kein Test-Script mehr läuft, sonst nach `sek` (Standard 120, höchstens 300) |
| `go` / `skip` / `abort` | Kommando an das laufende Script (`hwc` mit `n + 1`) |
| `status` | Einzeiler: laufende Scripts, Sensoren, Ausgang, Stand aus `hwr` und `hwp` |
| `report` | `hwr`/`hwp` lesbar mit Klartext je Code und Vergleich mit `cfg1` |
| `restore` | `hwb1`/`hwb2` nach `st`/`day`/`job`/`err`/`lrn` zurückschreiben, `job.ok = false`, Sicherung löschen – nur, wenn `bw_hwpump` nicht läuft |
| `cleanup` | `hwc`, `hwb1`, `hwb2` löschen; `hwt`, `hwr`, `hwp` bleiben als Nachweis |
| `stop` | Not-Aus: `Script.Stop` für `bw_hwtest`, `bw_hwpump`, `bw_zeitraffer` und `bw_pump`, dann `Switch.Set {on:false}` |

`zeitraffer`, `normal`, `mess` und `kal` gehören zur Erstinbetriebnahme ([12](12-erstinbetriebnahme.md)); die vollständige Werkzeug-Referenz steht in [14 · Debuggen und Testen](14-debuggen-und-testen.md).

## KVS-Einträge des Hardware-Tests

Alle Werte sind JSON-Strings wie die übrigen Einträge ([03 · Konfiguration](03-konfiguration.md)). `hwt` legt das Script mit Startwerten an, wenn der Eintrag fehlt; fehlende Felder gelten als Startwert.

| Feld in `hwt` | Startwert (JSON) | Wirkung |
| --- | --- | --- |
| `tLo` / `tHi` | <!-- hwt:tLo -->20<!-- /hwt --> / <!-- hwt:tHi -->30<!-- /hwt --> | Schwellen °C für t1 / t2 |
| `vDryMax` / `vWetMin` | <!-- hwt:vDryMax -->0.5<!-- /hwt --> / <!-- hwt:vWetMin -->2.5<!-- /hwt --> | Grenzen V für Trocken- / Nasspunkt |
| `dV` | <!-- hwt:dV -->0.03<!-- /hwt --> | Spannweite V, bis zu der `nStab` Werte als stabil gelten |
| `nStab` | <!-- hwt:nStab -->5<!-- /hwt --> | Zahl gleichartiger Ticks je Kriterium |
| `nNull` | <!-- hwt:nNull -->10<!-- /hwt --> | Ticks ohne Wert, dann Code `nl` |
| `msTick` | <!-- hwt:msTick -->1000<!-- /hwt --> | Tick in ms (Sensoren lesen) |
| `nCmd` / `nLog` | <!-- hwt:nCmd -->2<!-- /hwt --> / <!-- hwt:nLog -->5<!-- /hwt --> | Ticks je Kommando-Abfrage / je Konsolenzeile |
| `tPhase` / `tAll` | <!-- hwt:tPhase -->900<!-- /hwt --> / <!-- hwt:tAll -->3600<!-- /hwt --> | Timeout je Phase / je Lauf in s |
| `pumpSec` | <!-- hwt:pumpSec -->30<!-- /hwt --> | Pumpdauer des Tests in s, höchstens `cfg3.tMax` |
| `tOn` | <!-- hwt:tOn -->20<!-- /hwt --> | reserviert – wird von keinem Script gelesen |
| `guardS` / `winMin` | <!-- hwt:guardS -->90<!-- /hwt --> / <!-- hwt:winMin -->25<!-- /hwt --> | Zeitwache: Abstand zum Takt in s / zu den Fenstern in min |
| `cal` | <!-- hwt:cal -->1<!-- /hwt --> | 1 = Kalibrierwerte nach `cfg1` schreiben, 0 = nur melden |
| `run` | <!-- hwt:run -->"tml"<!-- /hwt --> | Phasengruppen t, m, l |

| Eintrag | Felder | Bedeutung |
| --- | --- | --- |
| `hwc` | `n` Zähler · `cmd` `go` / `skip` / `abort` | Kommando an das laufende Script |
| `hwr` | `s` `lauf` / `ende` / `abbruch` · `t` [min, max] °C · `m` [vDry, vWet] · `l` [leer, voll] · `chg` Eingangswechsel · `r` Codes t1…l2 · `cal` alt>neu · `n` Vermerke · `mem` kleinster `ram_free` · `dur` s · `w` Schreibvorgänge · `run` Startzeit | Stand und Bericht des Sensortests; wird der Eintrag länger als 253 Zeichen, fallen die Vermerke weg |
| `hwp` | `s` `lauf` / `pumpt` / `ende` / `abbruch` · `pumpSec` · `sec` von `bw_pump` eingetragen · `st`, `why` · `r` Codes p0…p3 · `rec` 1 = Wiederanlauf · `mem`, `dur`, `w`, `run` | Stand und Bericht des Pumpentests |
| `hwb1` | Kopien von `st` und `day` | Sicherung zwischen Durchgang A und B |
| `hwb2` | Kopien von `job`, `err` und `lrn` | Sicherung zwischen Durchgang A und B |

## Speicher und Flash

Der Script-Heap des Shelly (`Script.GetStatus.mem_free`, im Leerlauf 24 920 Byte) ist von allen Scripts geteilt. Ein wartendes Test-Script gibt seine KVS-Objekte frei (`K = {}; orig = {}`) und liest vor dem Schreiben neu; so belegt `bw_hwpump` 9 044 und `bw_hwtest` 9 576 Byte, und `bw_main` läuft daneben im Takt weiter (5 404 Byte beim Parsen).

`bw_pump` braucht beim zweiten Lesen des KVS mit den Test-Einträgen über 15,8 KB Spitze und starb neben einem 9-KB-Script mit `out_of_memory` (sichtbar in `Script.GetStatus.errors`, `hwtest.js scripts` zeigt es). Deshalb der Pumpentest in zwei Durchgängen. Details, Messwerte und die Regel „nie zwei große Scripts gleichzeitig“: [18 · Lernlog vom Gerät](18-lernlog-geraet.md).

> **Am Gerät gemessen (13.09.2026):** Flash `fs_free` 12 288 Byte mit sieben Scripts → 49 152 Byte, nachdem `engine_probe`, `bw_hwtest` und `bw_hwpump` gelöscht waren (≈ 36 KB, LittleFS rechnet in 4-KB-Blöcken). Kompakt sind `bw_hwtest` <!-- fact:dist.bw_hwtest -->13952<!-- /fact --> Byte und `bw_hwpump` <!-- fact:dist.bw_hwpump -->14500<!-- /fact --> Byte (Grenze <!-- fact:size_limit -->16000<!-- /fact -->). `put-script.js` prüft vor dem Upload `fs_free` + alter Code ≥ neue Datei + 4 096.

Die Test-Scripts dürfen deshalb nur so lange am Gerät bleiben, wie sie gebraucht werden: nach dem Test `delete bw_hwtest` und `delete bw_hwpump`; `preflight hw` legt sie bei Bedarf wieder an. Niemand setzt `enable` für sie – sie stehen nicht im Zeitplan und starten nur von Hand.

## Not-Aus, Wiederanlauf, Tunnelabriss

- **Not-Aus:** `node tools/hwtest.js <ip> stop` stoppt `bw_hwtest`, `bw_hwpump`, `bw_zeitraffer` und `bw_pump` und schaltet den Ausgang aus; genauso wirkt OUT1 in der Web-UI. Auch ohne Script endet eine Portion spätestens mit `toggle_after` und `auto_off`.
- **Rückbau nach Abbruch:** Steht danach noch `hwb1`/`hwb2` im KVS, stellt `restore` den alten Zustand wieder her (nur, wenn `bw_hwpump` nicht läuft); erst dann `cleanup`. Ein Testauftrag wird dabei auf `job.ok = false` gesetzt.
- **Wiederanlauf:** Ein Start von `bw_hwpump` mit vorhandener Sicherung ist automatisch Durchgang B (`rec=1` im Bericht) – `bw_pump` muss beendet sein. Bei einer Ausnahme im Test-Script schaltet `fail()` eine laufende Pumpe aus und beendet sich; der Rückbau folgt beim nächsten Start.
- **Tunnelabriss:** Reißt die SSH-Verbindung ab, läuft das Script am Gerät autonom weiter. Jede Phase endet spätestens nach `tPhase` (<!-- hwt:tPhase -->900<!-- /hwt --> s) mit `to`, der ganze Lauf nach `tAll` (<!-- hwt:tAll -->3600<!-- /hwt --> s) mit `ab`. Der Stand steht in `hwr`/`hwp` und ist nach dem Wiederverbinden mit `status` oder `report` lesbar; `watch` verbindet den Websocket automatisch neu und übersteht RPC-Fehler.

## Beispielausgabe

Sensortest im Mock mit virtuellem Bediener (`node tools/run-script.js scripts/bw_hwtest.js --seed --hwdemo`), gekürzt – am Gerät sehen die Zeilen genauso aus, nur mit echten Werten:

```text
[bw_hwtest 0.1.0] Start run=tml | V=ok T=ok IN=ok | V=0.42 T=23.9 lvl=0
[bw_hwtest 0.1.0] Phase 1/6 t1: Fühler abkühlen auf <= 20 °C (Timeout 900 s)
[bw_hwtest 0.1.0] t1 23.41 °C t=4s
[bw_hwtest 0.1.0] t1 20.96 °C t=14s
[bw_hwtest 0.1.0] Phase t1: ok (19 °C, min 19, max 23.9) nach 22 s
[bw_hwtest 0.1.0] Phase 3/6 m1: Sensor trocken in Luft (<= 0.5 V), dann go (Timeout 900 s)
[bw_hwtest 0.1.0] m1 0.21 V t=14s (warte auf go)
[bw_hwtest 0.1.0] Kommando go (n=1)
[bw_hwtest 0.1.0] Phase m1: ok (0.21 V, min 0.21, max 0.42) nach 18 s
[bw_hwtest 0.1.0] Phase 5/6 l1: Schwimmer bewegen, dann auf LEER halten und go (Timeout 900 s)
[bw_hwtest 0.1.0] Phase l1: ok (1, min 0, max 1) nach 8 s
[bw_hwtest 0.1.0] Kalibrierung: 0.2>0.21;3.13>3.1;1>1
Bericht 1/5 Komponenten: V=ok T=ok IN=ok | Vermerke: -
Bericht 2/5 Temperatur: t1 ok min=19 °C | t2 ok max=31 °C
Bericht 3/5 Feuchte: m1 ok vDry=0.21 V | m2 ok vWet=3.1 V | cfg1 0.2>0.21;3.13>3.1;1>1 geschrieben
Bericht 4/5 Wasserstand: l1 ok leer=1 | l2 ok voll=0 | Wechsel=2 | lvlEmpty geschrieben
Bericht 5/5 Ende: dauer=105 s w=8 ram_min=120000 – Sensoren zurück in den Topf, Schwimmer auf VOLL? Pumpentest: bw_hwpump
[bw_hwtest 0.1.0] fertig ende r=ok,ok,ok,ok,ok,ok dauer=111040ms
```

Statuszeile von `watch` während m2 (Format des Werkzeugs, Werte aus dem Mock-Lauf):

```text
[status 10:08] läuft: bw_hwtest | V=1.944 tC=31.0 lvl=false sw=aus | hwr: lauf t1:ok t2:ok m1:ok m2:- l1:- l2:- | hwp: -
```

Pumpentest im Mock (Durchgang A, `bw_pump` allein, Durchgang B):

```text
[bw_hwpump 0.1.0] Start Durchgang A (Freigabe + Start) pumpSec=30 sw=0 lvl=0 err=cfg
[bw_hwpump 0.1.0] bw_pump id=3 andere=0
[bw_hwpump 0.1.0] Phase p0: Behälter voll, Schlauch im Eimer, dann go (30 s über bw_pump, Timeout 900 s)
[bw_hwpump 0.1.0] cmd go n=1
[bw_hwpump 0.1.0] p0 sw=0 lvl=0 t=5s
[bw_hwpump 0.1.0] Phase p0: ok nach 7 s
[bw_hwpump 0.1.0] bw_pump gestartet – Durchgang B nach dessen Ende (tools/hwtest.js watch)
[bw_hwpump 0.1.0] fertig r=ok,-,-,- dauer=7280ms
[bw_pump 0.2.0] Fenster: Auftrag 30 s, pct null, Einzelportion, Frist 420 s
[bw_pump 0.2.0] P1 aus: ok nach 30 s
[bw_pump 0.2.0] ergebnis=ok n=1 sec=30 dur=31 pct=null→null effW=null sf=0.7 day.n=1 err=null w=3 dauer=33340
[bw_hwpump 0.1.0] Start Durchgang B (Ergebnis + Rückbau) pumpSec=30 sw=0 lvl=0 err=null
[bw_hwpump 0.1.0] bw_pump id=3 andere=0
[bw_hwpump 0.1.0] bw_pump: st=gegossen sec=30 why=ok err=null → ok
[bw_hwpump 0.1.0] Rückbau schreibt st,day,job,err,hwp löscht hwb1,hwb2
Bericht 1/2 p0 ok | p1 ok | p2 ok | st=gegossen sec=30 why=ok | p3 ok
Bericht 2/2 Ende mit Rückbau rec=0 dauer=0 s w=5 ram_min=120000
[bw_hwpump 0.1.0] fertig r=ok,ok,ok,ok dauer=3080ms
```

`node tools/hwtest.js <ip> report` mit den KVS-Einträgen dieser Läufe:

```text
== bw_hwtest (Sensoren) – ende, 105 s, ram_min 120000, Vermerke: -
  t1 ok
  t2 ok
  m1 ok
  m2 ok
  l1 ok
  l2 ok
  Temperatur min 19.0 °C, max 31.0 °C
  Feuchte trocken 0.210 V, nass 3.100 V | cfg1 jetzt vDry=0.21 vWet=3.1 | Kalibrierung 0.2>0.21;3.13>3.1;1>1
  Wasserstand leer=1 voll=0 Wechsel=2 | cfg1 jetzt lvlEmpty=1
== bw_hwpump (Pumpe) – ende, 0 s, ram_min 120000
  p0 ok
  p1 ok
  p2 ok
  p3 ok
  Auftrag 30 s, bw_pump hat 30 s eingetragen, st=gegossen why=ok
```

> **Am Gerät gemessen (13.09.2026):** Sensortest alle sechs Phasen `ok` in 532 s – Fühler 19,8 °C im Eiswasser und 33,5 °C in warmem Wasser bzw. Hand, Trockenpunkt 0,296 V, Nasspunkt 3,134 V, damit `cfg1.vDry` 0,20 → 0,296 und `vWet` 3,13 → 3,134 automatisch geschrieben; Schwimmer LEER = 1, VOLL = 0 (8 Wechsel beobachtet), `lvlEmpty` 1 bestätigt; `ram_free` mindestens 125 424. Pumpentest: Durchgang A 26 s (Phase p0 `ok` nach 19 s), `bw_pump` 30 s, Durchgang B `ok,ok,ok,ok`, KVS danach byteidentisch zum Stand vor dem Test. Protokoll: [19 · Prüfprotokoll am Gerät](19-pruefprotokoll.md).

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `cfg1.vErrLo fehlt – Installer zuerst` beim Start | Installer nicht (erneut) gelaufen, `cfg1` unvollständig | `bw_install` starten ([06](06-startanleitung.md)), dann Test neu starten |
| Code `nl`, Konsole `Sensor liefert null – Fühler/Kabel/Komponente prüfen` | Komponente liefert `nNull` (<!-- hwt:nNull -->10<!-- /hwt -->) Ticks keinen Wert: Fühler oder Kabel ab, Peripherie nicht angelegt, falsche ID in `cfg1.idV`/`idT`/`idLvl` | Verdrahtung und Peripherie prüfen ([05](05-verkabelung-und-aufbau.md)); Startzeile `V=ok T=ok IN=ok` lesen; Phase mit `skip` überspringen |
| Code `to` nach `tPhase` (<!-- hwt:tPhase -->900<!-- /hwt --> s) | Zustand nicht erreicht: Wasser nicht kalt oder warm genug, Sensor nicht trocken, `go` vergessen | Schwelle anpassen (`cfg tLo=21`), abtrocknen, `go` senden; einzelne Gruppe wiederholen (`cfg run='"m"'`) |
| `go ignoriert: Phase t1 wartet nicht auf go` | `go` in einer Phase ohne Freigabe | nichts tun – t1, t2 und m2 enden von selbst, sobald der Wert stabil ist |
| Kommando kommt nicht an | `hwc.n` nicht größer als zuletzt gesehen (z. B. `hwc` von Hand mit altem `n` geschrieben) oder Script fragt gerade nicht ab | `hwtest.js go` nutzen (zählt hoch); `status` zeigt, ob das Script läuft |
| `Kalibrierung … nicht übernommen: vWet-vDry<1V` | Nasspunkt keine 1 V über dem Trockenpunkt: Sensor nicht tief genug im Wasser oder in m1 nicht trocken | m1/m2 wiederholen (`cfg run='"m"'`), Werte notfalls von Hand nach `cfg1` ([12](12-erstinbetriebnahme.md)) |
| p0 sofort `fe` | `bw_pump` fehlt, mehr als ein anderes Script läuft oder Störung `noeff` steht | `preflight hw`, `scripts`; `noeff` klären und `err` löschen ([13](13-betrieb-und-wartung.md)) |
| p0 bleibt bei `warte: takt` / `warte: fenster` / `warte: uhr` | Zeitwache: Anfang oder Ende des Viertelstundentakts, ± `winMin` (<!-- hwp:winMin -->25<!-- /hwp --> min) um Fenster oder Mitternacht, Uhr nicht gestellt | warten – das Script prüft bis `tPhase` weiter; außerhalb der Fenster starten; NTP prüfen |
| `Ausgang EIN – ausschalten` / `Wasserstand LEER – füllen` | Vorbedingung für den Pumpenlauf fehlt | `stop` schaltet aus; Behälter füllen, Schwimmer auf VOLL |
| p2 oder p3 `aw` | Ausgang nach `bw_pump` noch EIN (B schaltet aus) oder `st`/`job` passen nicht, etwa `why=wasser` (Behälter leer), `extern`, `alt` | Konsolenzeile `ergebnis=` von `bw_pump` lesen, Ursache beheben, Test wiederholen |
| `bw_pump läuft noch – später erneut starten` | Durchgang B zu früh | `watch` erneut aufrufen – es startet B, sobald `bw_pump` fertig ist |
| `hwb1`/`hwb2` bleiben stehen | Abbruch zwischen A und B (`stop`, Tunnel, Ausnahme) | `start bw_hwpump` (wird Durchgang B, `rec=1`) oder `restore`; danach `cleanup` |
| `watch` zeigt Statuszeilen, aber keine Konsole | Debug-Websocket aus | Web-UI → Konsole öffnen oder `Sys.SetConfig debug.websocket.enable`; `preflight` warnt davor |
| `bw_main` oder `bw_pump` mit `out_of_memory` in `scripts` | zweites großes Script neben dem Test-Script | nur ein Test-Script zur Zeit; Pumpentest nur über die zwei Durchgänge |
| `put-script.js` verweigert den Upload | Flash `fs_free` zu klein | `delete engine_probe` bzw. nicht gebrauchte Test-Scripts; `scripts` zeigt `fs_free` |

## Weiter zu

- [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md) – mit den gemessenen `cfg1`-Werten das Zielband eintragen, den Zeitraffer fahren und das erste Fenster sehen.
- [14 · Debuggen und Testen](14-debuggen-und-testen.md) – Mock mit virtuellem Bediener, Konsole, vollständige Werkzeug-Referenz.
- [19 · Prüfprotokoll am Gerät](19-pruefprotokoll.md) – die Messwerte vom 13.09.2026 und die Vorlage für den nächsten Lauf.
- [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md) – die Design-Entscheidungen 21–28 zum Hardware-Test: eigene Test-Scripts, Kommandokanal `hwc`, Pumpe nur über `bw_pump`, Zeitwache, Sicherung und Rückbau, automatische Kalibrierung, `Script.Start` im Mock, zwei Durchgänge.
