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
| 12 | Wasser leer während Gabe | Hand-Auftrag, nach 30 s Schwimmer auf „leer" | Pumpe binnen `tChk` s aus, `st.state = "sperre"`, `st.rated = true`, `st.pctA = null`, `err.code = "wasser"` | |
| 13 | Sicherheits-Aus bei abgestürztem Script | Hand-Auftrag mit `sec` 110 um 07:59 setzen, `bw_pump` um 08:00 laufen lassen und sofort in der Web-UI stoppen | Ausgang geht spätestens um 08:05 aus (Zeitplan), sonst über `toggle_after` | |
| 14 | auto_off | `Switch.Set {id:0,on:true}` ohne `toggle_after` per RPC | Ausgang nach tMax + 10 s (130 s) von selbst aus | |
| 15 | Ausgang nach Neustart | Ausgang einschalten, Shelly stromlos machen, wieder einschalten | Ausgang ist aus (`initial_state = off`) | |
| 16 | Uhrzeit ungültig | WLAN abschalten, Shelly stromlos machen und starten (ohne NTP), `bw_main` von Hand starten | `err.code = "uhr"`, keine Pumpe, Zeitplan läuft nicht; nach WLAN-Rückkehr normal | |
| 17 | Bewertung und Lernwert | echte Gabe abwarten, 30–45 min später `lrn.eff` lesen | Wert zwischen `effMin` und `effMax`, Konsole „gelernt" | |
| 18 | Keine Wirkung | Schlauch von der Pflanze abziehen, Gabe abwarten | `err.code = "noeff"`, `lrn.eff` unverändert, kein zweiter Auftrag; nach Löschen von `err` wieder frei | |
| 19 | Temperaturfühler abgesteckt | DS18B20 lösen | `err.code = "temp"`, Auftrag weiterhin möglich | |
| 20 | Speicherverbrauch | `err.mem` über mehrere Tage notieren | Wert stabil (Unterschied < 10 %) | |
| 21 | KVS-Schreibvorgänge | `Sys.GetStatus.kvs_rev` morgens und abends notieren | Differenz unter 20 pro Tag | |
