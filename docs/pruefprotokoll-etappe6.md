# Prüfprotokoll Etappe 6 – Sicherheit und Störfälle am Gerät (v0.1.0)

Jede Zeile einmal am echten Aufbau durchspielen, Ergebnis und Datum eintragen. Vorher: Installer gelaufen, cfg2-Zielband eingetragen, Pumpe angeschlossen, Behälter gefüllt. KVS-Stand jederzeit mit `tools/kvs_dump.sh <ip>` oder `http://<ip>/rpc/KVS.GetMany?match=*` ablesen.

| Nr. | Prüfung | Vorgehen | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- | --- |
| 1 | Installer wiederholbar | `bw_install` zweimal starten, `Schedule.List` ansehen | genau drei eigene Einträge, cfg-Werte unverändert | |
| 2 | Komponenten-IDs | erste Konsolenzeile von `bw_main` lesen | `V=` zeigt eine Spannung, `tC=` eine Temperatur, `lvl=` 0 oder 1; sonst `idV/idT/idLvl` in cfg1 anpassen | |
| 3 | Kalibrierpunkte | Sensor trocken in Luft, dann im Wasser: `V=` ablesen | nahe 0,20 V und 3,13 V; sonst `vDry/vWet` anpassen | |
| 4 | lvlEmpty | Behälter leer → `lvl=` ablesen | Wert = `cfg1.lvlEmpty` (Startwert 1); sonst anpassen | |
| 5 | Sensor abgesteckt | SMT50-Signalader lösen, einen Takt warten | `err.code = "sensor"`, `job.why = "sensor"`, keine Pumpe | |
| 6 | Sensor wieder dran | Ader anschließen, einen Takt warten | `err.code = null` | |
| 7 | Pflichtfeld fehlt | `cfg3.tMax` im KVS auf null setzen, Takt abwarten | `err.code = "cfg"`, `job.ok = false`; nach Rücksetzen wieder frei | |
| 8 | Hand-Auftrag | `job` = `{"ok":true,"sec":70,"pct":30,"why":"hand","ts":<unixtime jetzt>}` setzen, `bw_pump` starten | Relais zieht an, Pumpe läuft 70 s (Stoppuhr), `st.state = "gegossen"`, `day.n = 1`, `job.ok = false` | |
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
