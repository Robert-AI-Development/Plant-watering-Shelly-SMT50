# Prüfprotokoll Etappe 6 – Sicherheit und Störfälle am Gerät (v0.1.0)

Jede Zeile einmal am echten Aufbau durchspielen, Ergebnis und Datum eintragen. Vorher: Installer gelaufen, cfg2-Zielband eingetragen, Pumpe angeschlossen, Behälter gefüllt. KVS-Stand jederzeit mit `tools/kvs_dump.sh <ip>` oder `http://<ip>/rpc/KVS.GetMany?match=*` ablesen.

## Inbetriebnahme / Gerätetest 12.09.2026 (v0.1.1, Firmware 2.0.0)

Über einen SSH-Tunnel zum Gerät (`tools/put-script.js`, `tools/console.js`) verifiziert:

- **Scripts vollständig geladen:** Upload per `Script.PutCode` in Stücken, Byte-Zahl am Gerät gegen die Datei geprüft (`Script.GetCode`). Der Web-Editor hatte beim Einfügen Text verloren (Dateiende fehlte) – siehe `LEARNING.md`.
- **Installer:** legt 8 KVS-Einträge (alle als JSON-Strings, in der Web-UI mit „Format as JSON" lesbar) und 3 Zeitplan-Einträge an (`0 */15 * * * *` bw_main, `0 0 8,20 * * *` bw_pump, `0 5 8,20 * * *` Sicherheits-Aus). Der erste `Schedule.Create` scheitert am Gerät und wird automatisch wiederholt (`LEARNING.md`).
- **bw_main / bw_pump:** starten ohne Uncaught-Fehler; Messwerte plausibel (`V≈0,27`, `tC≈24`). `err=cfg`/`why=cfg` ist erwartet, solange das Zielband in `cfg2` noch `null` ist.
- **Sprach-/Engine-Grenzen gemessen:** kein Hoisting; Stacktiefe (12 ok, 14 Absturz); KVS-Werte müssen Strings sein. Details in `LEARNING.md`.

## Hardware-Test 13.09.2026 (bw_hwtest v0.1.0, bw_hwpump v0.1.0)

Vom VPS über den SSH-Tunnel mit `tools/hwtest.js` gesteuert (`preflight`, `start`, `watch`, `go`, `report`, `cleanup`); Robert am Aufbau. Scripts am Gerät: id 5 `bw_hwtest`, id 6 `bw_hwpump`; Firmware 2.0.0. Input 1 war bereits aktiv (Typ switch), das Kommando `input-on` wurde nicht gebraucht.

- **Sensortest (`bw_hwtest`):** alle 6 Phasen (t1, t2, m1, m2, l1, l2) ok, Dauer 532 s. Temperatur min 19,8 °C (Eiswasser), max 33,5 °C (warmes Wasser/Hand). Trockenpunkt 0,296 V, Nasspunkt 3,134 V → automatisch in `cfg1` geschrieben: `vDry` 0,20 → 0,296, `vWet` 3,13 → 3,134. Schwimmer: LEER = 1, VOLL = 0 → `lvlEmpty` 1 bestätigt (8 Eingangswechsel beobachtet). `ram_free` min 125.424. Konsole während des Laufs: 1 Zeile je 5 s je Phase.
- **Pumpentest (`bw_hwpump`, zwei Durchgänge):** Durchgang A 26 s (Freigabe nach `go` 19 s, Sicherung nach `hwb1`/`hwb2`, Auftrag `job` mit `sec` 30 und `why` „hwtest", `Script.Start` bw_pump). `bw_pump` allein: „Pumpe ein für 30 s (Auftrag 30 s, pct null)", „Pumpe aus: ok nach 30 s", „ergebnis=ok sec=30 day.n=1". Durchgang B: p0–p3 ok, Rückbau st/day/job/err, `hwb1`/`hwb2` gelöscht. KVS danach byteidentisch zum Stand vor dem Pumpentest (cfg1/2/3, day, err, job, lrn, st); `kvs_rev` am Ende 198.

Engine-Befunde (Details in `LEARNING.md`):

- **`Array.prototype.shift` fehlt** in mJS („Function "shift" not found!") – Ringpuffer per Index; `syntax.test.js` verbietet jetzt shift/unshift/forEach/map/filter/reduce/find/includes/some/every/sort.
- **Script-Heap ist geteilt, ~25 KB** (`Script.GetStatus` mem_free 24.920 im Leerlauf). `bw_hwpump` mit allen KVS-Objekten im RAM belegte 13.552 Byte (Spitze 15.400) → `bw_pump` beim Start `out_of_memory`, `bw_main` alle 15 min ebenfalls. Nach Freigabe der KVS-Objekte in den Wartephasen (bw_hwpump 9.044, bw_hwtest 9.576) laufen `bw_main` (5.404 beim Parsen) und `bw_pump` (7.396) daneben; `bw_pump` braucht beim zweiten KVS-Lesen (13 Einträge) aber über 15,8 KB und fiel neben einem 9-KB-Script erneut mit `out_of_memory` aus (Pumpe war aus, st/day/job nie geschrieben). Deshalb Pumpentest in zwei Durchgängen – `bw_pump` läuft allein. `bw_main` + `bw_pump` gleichzeitig (Normalbetrieb 08:00/20:00) laufen problemlos (je ~7,4 KB).

## Zeitraffer-Lauf 13.09.2026 (bw_zeitraffer v0.1.0, bw_install v0.1.2, bw_main v0.1.2, bw_pump v0.1.1)

Autonom vom VPS über den Tunnel (`tools/hwtest.js zeitraffer`/`watch`/`normal`, `tools/verify-scripts.js`); Robert hat ab Minute 7 der zweiten Runde die Handgriffe des Fahrplans am Aufbau gemacht (Fühler in heißes Wasser, Schwimmer, Sensor ins Wasser). Der Schlauch lag an der Pflanze, deshalb stieg die Feuchte am Sensor mit jeder Gabe. Erwartungen aus `tools/test/zeitraffer.test.js`.

| Schritt | Erwartung | Ergebnis / Uhrzeit |
| --- | --- | --- |
| Timespec-Vorprüfung | `Schedule.Create` mit `15 */2 * * * *`, `0 * * * * *`, `0 */2 * * * *` wird angenommen (danach gelöscht) | 10:56: alle drei angenommen (id 4, sofort gelöscht), per RPC kein Retry nötig |
| Upload + Prüfung 2 | sechs Scripts per `put-script.js`, `verify-scripts.js`: alle byteidentisch, Doku-Zeilen sichtbar | 10:57: 14 295 / 15 288 / 10 805 / 13 952 / 14 500 / 6 354 Byte, Doku-Zeilen 20/6/5/4/4/9, alle byteidentisch; nach dem Fix (Runde 2) bw_install 14 480, bw_zeitraffer 6 379 – erneut alle OK. `fs_free` danach 12 288 (vorher 24 576) |
| Zielband | `cfg2` = 55/40/65/38/4 | 10:57 gesetzt (kvs_rev 202) |
| Installer-Update (`normal`) | „KVS cfg3 ergänzt: tick,winEvery", Zeitplan `0 */15`, `0 0 8,20`, `0 5 8,20`, auto_off 130 | 10:58:08 genau so; Heap danach 24 920 frei |
| Zeitraffer-Start, Runde 1 | Zeitplan `0 * * * * *`, `0 */2`, `15 */2`, auto_off 15, `zr` weg, `zrb1..3` da | 10:59:09 genau so – **aber:** `bw_pump` starb um 11:00 und 11:02 beim Start zur selben Sekunde wie `bw_main` mit `out_of_memory` (`used=791 peak=871 total=1746`); `bw_main` belegte 13 216 (Spitze 16 380), Laufzeit 5–7,5 s. Keine Gabe. Rückbau 11:07:09 sauber. Fix: Pumpe 30 s nach der vollen Minute (`PUMP_SEC`, Entscheidung 37, LEARNING.md) |
| Installer-Update, Runde 2 | Zeitplan `0 */15`, `30 0 8,20`, `0 5 8,20` | 11:12:08 genau so |
| Zeitraffer-Start, Runde 2 | Zeitplan `0 * * * * *`, `30 */2 * * * *`, `45 */2 * * * *`, auto_off 15 | 11:13:08 genau so, `zr` gelöscht, `zrb1..3` da, Heap 24 920 frei |
| Minute 1 | `bw_main`: `why=ok sec=5` (Erde trocken) | 11:14:00 `pct=0 … pause=0.17h why=ok sec=5` (5,4 s) |
| Minute 1:30 | `bw_pump`: `ergebnis=ok sec=5`, Ausgang binnen 7 s aus (Gabe 1) | 11:14:30 „Pumpe ein für 5 s", „Pumpe aus: ok nach 5 s", `day.n=1`, 13,1 s, `mem_used` 11 970 (allein) |
| Minute 2 | `st=sperre dry=1 pause=0.17h why=pause` | 11:15 „Bewertung ohne Vorwert übersprungen", genau so; Feuchte am Sensor durch die Gabe 0 → 36 % |
| Hitze (Robert) | Fühler über 30 °C → `pause=0.035h why=ok`, Gabe im nächsten Fenster | ab ~11:20 Fühler in heißem Wasser (bis 86 °C, `lrn.tMaxD` 86): 11:21 `why=ok`, **11:22:30 Gabe 2** (pct 36,6; 8 min nach Gabe 1, Hitze verkürzt die normale Pause) |
| Hitze-Doppelgabe | zweite Gabe 2 min nach der letzten | 11:23 `why=ok`, **11:24:32 Gabe 3** (`day.n=3`) |
| Schwimmer LEER | `why=wasser err=wasser`, Fenster pumpt nicht | 11:25:01 `why=wasser`, 11:26 `err=wasser`, 11:26:30 `bw_pump`: kein Auftrag |
| Sensor im Wasser | `why=feucht` | 11:27 `pct=99 why=feucht`, `err` gelöscht (Schwimmer wieder VOLL) |
| Sensor trocken | `why=ok`, Gabe 4 | 11:28 `pct=0 why=ok`, **11:28:30 Gabe 4** (`day.n=4`) |
| Tageslimit | `why=limit`, kein Pumpen mehr | 11:29 `why=limit` (pct 54 nach der Gabe, `dry=0`), 11:30:30 `bw_pump`: kein Auftrag |
| Speicher | kein `out_of_memory` in Runde 2 | `bw_main` used 13 216 / peak 16 380 je Takt, `mem_free` min 11 536; `bw_pump` allein ≤ 11 970; Leerlauf 24 920. Konsole nach jedem `bw_main`-Lauf: `shelly_ejs_timer.cpp:44 Timer 1 handle not found` (harmlos) |
| Rückkehr (`normal`) | „Zeitraffer beendet", `cfg3` Original + tick 15/winEvery null, `zr`/`zrb*` gelöscht, Zeitplan normal, auto_off 130, `day.n` 0 | 11:31:17 genau so; `lrn` (tMaxD 38, tMaxY 24, tMean 24) und `err` (`cfg` von gestern, löscht `bw_main` im nächsten Takt) wie vor dem Test; kvs_rev 287 (beide Runden zusammen 86 Schreibvorgänge) |

Ergebnis: alle Fahrplan-Fälle am Gerät gezeigt – Gabe, normale Pause, Hitze-Doppelgabe (2 min), Behälter leer, feucht, Tageslimit, Rückbau. Einziger Befund: der gleichzeitige Start von `bw_pump` und `bw_main` (behoben, Sekunde 30). Nach dem Lauf: Sensor zurück in die Erde, Schwimmer auf VOLL.

## Messlauf 13.09.2026 (`hwtest.js mess`, Regelkreis-Planung Etappe 10)

Aufbau: SMT50 mittig in trockener Erde, direkt darüber zwei Gardena-Tropfer; Pumpe per `Switch.Set toggle_after`, Sensor alle 2 s per RPC. Rohdaten in `docs/kal/2026-09-13-*-mess.json`.

| Lauf | Puls | Feuchte vorher → Spitze (t) → Ruhe | tRise | Gewinn | Befund |
| --- | --- | --- | --- | --- | --- |
| 14:54 | 3 s | 10,4 → 10,7 | – | – | keine Reaktion: Schlauch leer, 3 s füllen ihn nur |
| 14:56 | 3 s | 10,7 → 20,2 (86 s) | 5,3 s | +9,5 % | Sprung binnen 10 s, dann Kriechen bis 86 s (Nachlaufwasser) |
| 14:58 | 3 s | 20,2 → 31,9 (80 s) | 5,5 s | +11,7 % | wie oben, Kriechen +8 % zwischen 20 und 87 s |
| 15:01 | 3 s | 34,0 → 36,1 (162 s) | 7,8 s | +2 % | bei feuchterer Erde fast nur Nachlauf |
| 15:03 | 3 s | 35,7 → 37,8 (65 s) | 7,9 s | +2 % | dito |
| 15:10 | 10 s | 37,5 → 49,1 (15 s), stabil 2 min | 7,9 s | +11,6 % = 5,6 %/wirksame s | Anstieg während des Pumpens, Ruhewert 5 s nach dem Ausschalten, kein Kriechen |

Abgeleitete Startwerte: `tDead2` 8 s, `tPmin` 10 s, `tMin` 25 s, `tSoak` 20 s, `tStab` 60 s, `effMax` 30 (Sanity). Nebenbefunde: keine Spannungseinbrüche am Voltmeter bei laufender Pumpe (Werte plausibel während des Pulses), Voltmeter liefert bei 2-s-Abfrage frische Werte (0,3-%-Stufen), Nachlaufwasser aus dem Schlauch ist bei kurzen Pulsen der dominante Effekt.

Offen (an der Pflanze zu messen): Zielband `cfg2`, `dropSlow` – die Zeilen unten sowie die `[TODO am Gerät]`-Stellen in der README. Die Kalibrierpunkte `vDry/vWet` und `lvlEmpty` sind seit 13.09.2026 gemessen (siehe Hardware-Test, Zeilen 3 und 4).

| Nr. | Prüfung | Vorgehen | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- | --- |
| 1 | Installer wiederholbar | `bw_install` zweimal starten, `Schedule.List` ansehen | genau drei eigene Einträge, cfg-Werte unverändert | |
| 2 | Komponenten-IDs | erste Konsolenzeile von `bw_main` lesen | `V=` zeigt eine Spannung, `tC=` eine Temperatur, `lvl=` 0 oder 1; sonst `idV/idT/idLvl` in cfg1 anpassen | 13.09.2026 per bw_hwtest/bw_hwpump: alle drei Komponenten liefern Werte – Temperatur 19,8–33,5 °C, Spannung 0,296–3,134 V, Schwimmer 0/1 (8 Wechsel) |
| 3 | Kalibrierpunkte | Sensor trocken in Luft, dann im Wasser: `V=` ablesen | nahe 0,20 V und 3,13 V; sonst `vDry/vWet` anpassen | 13.09.2026 per bw_hwtest/bw_hwpump: trocken 0,296 V, nass 3,134 V → `cfg1.vDry` 0,20→0,296, `vWet` 3,13→3,134 automatisch geschrieben |
| 4 | lvlEmpty | Behälter leer → `lvl=` ablesen | Wert = `cfg1.lvlEmpty` (Startwert 1); sonst anpassen | 13.09.2026 per bw_hwtest/bw_hwpump: LEER = 1, VOLL = 0 → `lvlEmpty` 1 bestätigt (8 Wechsel beobachtet) |
| 5 | Sensor abgesteckt | SMT50-Signalader lösen, einen Takt warten | `err.code = "sensor"`, `job.why = "sensor"`, keine Pumpe | |
| 6 | Sensor wieder dran | Ader anschließen, einen Takt warten | `err.code = null` | |
| 7 | Pflichtfeld fehlt | `cfg3.tMax` im KVS auf null setzen, Takt abwarten | `err.code = "cfg"`, `job.ok = false`; nach Rücksetzen wieder frei | |
| 8 | Hand-Auftrag | `job` = `{"ok":true,"sec":70,"pct":30,"why":"hand","ts":<unixtime jetzt>}` setzen, `bw_pump` starten | Relais zieht an, Pumpe läuft 70 s (Stoppuhr), `st.state = "gegossen"`, `day.n = 1`, `job.ok = false` | 13.09.2026 per bw_hwtest/bw_hwpump: Pumpe lief 30 s statt 70 s (Auftrag des Tests, `why` „hwtest"); `st.state = "gegossen"`, `st.sec = 30`, `day.n = 1`, `job.ok = false` vor dem Rückbau |
| 9 | Alter Auftrag | wie 8, aber `ts` 30 min in der Vergangenheit | `err.code = "alt"`, keine Pumpe | |
| 10 | Tageslimit | `day.n` auf 2 setzen, Hand-Auftrag | `err.code = "limit"`, keine Pumpe | |
| 11 | Wasser leer vor Gabe | Schwimmer auf „leer", Hand-Auftrag | `err.code = "wasser"`, keine Pumpe | |
| 12 | Wasser leer während Gabe | Hand-Auftrag mit `pct` (Regelkreis), nach 10 s Schwimmer auf „leer" | Pumpe binnen `tChk` s aus, `st.state = "sperre"`, `st.rated = true`, `st.why = "abbruch"`, `err.code = "wasser"`, `day.sec` zählt die Teilportion | seit v0.2.0: Mock `pump.test.js` (LEER in P2 / in der Wartephase → `wasser`) |
| 13 | Sicherheits-Aus bei abgestürztem Script | Hand-Auftrag mit `pct` um 07:59 setzen, `bw_pump` um 08:00:30 laufen lassen und mitten im Fenster in der Web-UI stoppen | Ausgang geht spätestens um 08:08 aus (Zeitplan `0 8 8,20`), sonst über `toggle_after`/auto_off 190 s; `st.why` bleibt `laeuft` (Claim), nächster Takt `why=pause`, kein Lernwert | Zeitplan `0 8 8,20` am 13.09.2026 angelegt; Mock `pump.test.js` (Script.Stop → Claim + Guard) |
| 14 | auto_off | `Switch.Set {id:0,on:true}` ohne `toggle_after` per RPC | Ausgang nach tMax + 10 s (190 s) von selbst aus | 13.09.2026: `auto_off 190 s` vom Installer gesetzt (`verifyState`) |
| 15 | Ausgang nach Neustart | Ausgang einschalten, Shelly stromlos machen, wieder einschalten | Ausgang ist aus (`initial_state = off`) | |
| 16 | Uhrzeit ungültig | WLAN abschalten, Shelly stromlos machen und starten (ohne NTP), `bw_main` von Hand starten | `err.code = "uhr"`, keine Pumpe, Zeitplan läuft nicht; nach WLAN-Rückkehr normal | |
| 17 | Bewertung und Lernwert | echtes Fenster mitlesen (`tools/console.js <ip> 900`; `hwtest.js watch` endet im Normalbetrieb, sobald kein Test-Script läuft), danach `lrn.effW` und `st` lesen | Konsole `P1 …`, `P2 …`, `ergebnis=… effW=…`; `lrn.effW` zwischen `effMin` und `effMax`, `st.n/sec/pctB/pctW/effW/why` gefüllt; 30 min später `Kontrolle: … → … %` mit `pctA`, kein zweiter Lernwert | 13.09.2026 im Zeitraffer: `effW` 2,006 (Profilmaß), Kontrolle 50,5 → 53,7 %; Etappe 10 unten |
| 18 | Keine Wirkung | Schlauch von der Pflanze abziehen, Fenster abwarten | Erstportion ohne Wirkung → eine volle Probeportion → `st.why = "noeff"`, `err.code = "noeff"`, `lrn.effW` unverändert, `st.state = "sperre"`; nach Löschen von `err` wieder frei | seit v0.2.0 aus `bw_pump` (zwei volle Portionen, ΣΔ < `dEffMin`); Mock `pump.test.js` |
| 19 | Temperaturfühler abgesteckt | DS18B20 lösen | `err.code = "temp"`, Auftrag weiterhin möglich | |
| 20 | Speicherverbrauch | `err.mem` über mehrere Tage notieren | Wert stabil (Unterschied < 10 %) | |
| 21 | KVS-Schreibvorgänge | `Sys.GetStatus.kvs_rev` morgens und abends notieren | Differenz unter 24 pro Tag (je Fenster Claim + `st/day/job/lrn`; Mock 15–22) | 13.09.2026: Zeitraffer-Fenster `w=4`, Takt `w=0–3` |

## Etappe 10 – Regelkreis im Gießfenster am Gerät (13.09.2026, 15:48–16:06)

Aufbau: SMT50 mittig in frischer trockener Erde, zwei Gardena-Tropfer direkt darüber, Behälter voll, Tunnel 127.0.0.1:8010. Alle Schritte hat Claude über die Werkzeuge gefahren; der Sensor blieb während des Laufs stecken (nur Fenster 1 des Fahrplans, danach war die Erde über dem Ziel → `feucht`).

| Schritt | Ergebnis |
| --- | --- |
| Flash vor dem Upload | Scripts 4/5/6 (`engine_probe`, `bw_hwtest`, `bw_hwpump`) waren bereits gelöscht: `fs_free` 49 152 B (vorher 12 288 B mit sieben Scripts) |
| Upload `bw_pump` 17 475 B, `bw_main` 15 791 B, `bw_install` 15 978 B, `bw_zeitraffer` 7 453 B | alle byteidentisch (`put-script.js` + `verify-scripts.js`, Versionen bw_main = bw_pump = 0.2.0); `fs_free` danach 40 960 B |
| Handwerte | `cfg2 {pctOk 50, pctHi 60, pctDry 28, effMax 30}`, `cfg3 {tMax 180, tMin 25}`, `lrn {sf 0.7, effW null}` (`eff` entfernt); `cfg2.dropSlow` 4 unverändert seit 10:57 (Zeile „Zielband" oben: 55/40/65/38/4 in der Feldfolge pctSoll/pctLo/pctHi/pctDry/dropSlow des Installers 0.1.x) |
| `hwtest.js normal 60` (Installer v0.1.3) | ergänzt `cfg2.dropW/sfUp`, `cfg3.dryDay`, legt `cfg4` an; Zeitplan `0 */15`, `30 0 8,20`, `0 8 8,20`; auto_off 190 s; `verifyState` ohne Abweichung; Heap 5 348 B |
| `hwtest.js kal 780` (Zeitraffer 3/6, Rekorder) | Aktivierung 15:50:34, Zeitplan `0 */3`, `30 */6`, **Minutenliste `40 2,8,…,56` angenommen**; Takt 15:51: `pct=10.8 why=ok sec=12 sf=0.7` |
| **Fenster 1** 15:54:30 | `Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s` · `m0 10.4 % → P1 12 s` · `P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)` · `P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)` · `ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199` – Regelkreis: Erstportion, Frischmessung, Korrekturportion aus der gemessenen Wirkung, Ziel `pctOk` 50 erreicht, Laufzeit 100 s < Frist 120 s |
| Heap im Fenster | `bw_pump` `mem_used` 10 360–10 500, **`mem_peak` 12 516** (frei 25 200); kein `out_of_memory`; Firmware-Hinweise `Timer 1 handle not found` (Timer.clear im eigenen Callback) und `PCS write interval < 60s` – harmlos, LEARNING.md |
| Kontrolle 15:57 | `Kontrolle: 50.5 → 53.7 % sf=0.7`, `st=sperre dry=1 why=pause` (keine Trockenphase nach der Gabe, Entscheidung 16) · 16:00 `pause`, 16:00:30 `bw_pump` ohne Auftrag · 16:03 `why=feucht` (56,4 %) |
| `hwtest.js normal 60` 16:04 | Original aus `zrb1..5` zurück (`cfg3, lrn, day, st, err, cfg4, cfg2, job`), Zeitplan/auto_off/Sicherung geprüft, Heap frei 25 200 |
| `kal report docs/kal/2026-09-13-13-50-kal.json docs/kal/2026-09-13-13-50-kal-log.txt` (Konsolenzeilen aus dem watch-Log, weil der Rekorder sie erst seit v0.1.2 selbst mitschreibt) | 155 Proben, 1 Fenster, Zustand trocken (m0 10,4 < pctDry 28): P1 12 s/+23,6/tRise 8 s, P2 10 s/+16,5/tRise 5 s → **4,46 %/s nach tRise** (Profilmaß `st.effW` 2,01 wegen `tDead` 2/0 im Zeitraffer, LEARNING.md) |
| `kal write` 16:06 | `lrn.effW null → 4.46`, `cfg4.tDead2 8 → 5`, `cfg3.tDead 20 → 8`, `cfg3.tMin 25 → 10` (max(tPmin, tDead + 2)); Vorher/Nachher in der Ausgabe, KVS gegengelesen |

Offen: Zustände mittel feucht und nass des Kalibrierlaufs (Sensor umstecken nach Fahrplan, `hwtest.js kal 2400`), Fenster 2–4 des Zeitraffer-Fahrplans (Pause, Hitze, `wasser`, `limit`) mit den Profilwerten `tMax` 40 / `tSoak` 10, erstes echtes Fenster 20:00 mit trockener Erde (`console.js <ip> 900`), `cfg3.tDead`/`tMin` am Endaufbau mit längerem Schlauch per `mess` nachmessen (10–20 s laut Nutzer).
