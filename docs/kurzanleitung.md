# Kurzanleitung – Einrichtung, Testlauf, Kalibrierung, Parameter

Ein Shelly Plus Uni misst alle 15 Minuten Bodenfeuchte (SMT50), Temperatur (DS18B20) und Wasserstand (Schwimmer) und gießt zu zwei Uhrzeiten in Portionen mit Nachmessen, bis das Zielband erreicht ist; dabei lernt er, wie viel Feuchte eine Pumpensekunde bringt. Diese Datei ist für den Aufbau am Gerät gedacht: einrichten, einmal im Zeitraffer zusehen, kalibrieren, Parameter verstehen. Alles Weitere (Stückliste, Verdrahtung, alle Felder, Störungen, Sicherheit) steht in `README.md` und im Handbuch `docs/handbuch/`.

Stand 13.09.2026: bw_main 0.2.0, bw_pump 0.2.0, bw_install 0.1.3, bw_zeitraffer 0.2.0. Alle Zahlen stammen aus `scripts/bw_install.js` (Startwerte `DEF`), `scripts/bw_zeitraffer.js` (Profil `ZR3`/`ZR4`) und dem Prüfprotokoll `docs/pruefprotokoll-etappe6.md`. Werte in Klammern mit „Gerät" sind die am 13.09.2026 am Gerät eingetragenen bzw. per `kal write` geschriebenen Werte.

## 1. Einrichtung in zehn Schritten

`<ip>` ist die Adresse des Shelly, z. B. `192.168.88.10` im LAN oder `127.0.0.1:8010` über den SSH-Tunnel (Handbuch Kapitel 6). Script-IDs sind Beispiele vom Gerät: 1 = bw_install, 2 = bw_main, 3 = bw_pump, 7 = bw_zeitraffer; `node tools/hwtest.js <ip> scripts` zeigt die eigenen. Node ≥ 22 auf dem Rechner, keine Abhängigkeiten. **Debug-Websocket einschalten:** Web-UI → Scripts → ein Script → Konsole öffnen (schaltet `debug.websocket.enable` ein; `node tools/hwtest.js <ip> preflight` meldet „Debug-Websocket an/aus"). Ohne ihn zeigen `watch`, `console.js` und der Rekorder von `kal` keine Konsolenzeilen; `kal write` schreibt dann `effW` im Profilmaß und `tDead`/`tMin` nicht.

1. **Gerät vorbereiten** (Web-UI): Uhrzeit per NTP und Zeitzone gesetzt (die Fenster sind Ortszeit). Analogeingang als Voltmeter (`voltmeter:100`), DS18B20 per 1-Wire-Scan (`temperature:100`), Eingang 1 (IN2) als Typ „Switch" (oder `node tools/hwtest.js <ip> input-on`). Scripts `bw_install`, `bw_main`, `bw_pump` anlegen; `node tools/hwtest.js <ip> preflight` legt `bw_zeitraffer` an. Kein Script auf „Run on startup".
2. **Bauen:** `npm run build` schreibt `dist/` (kompakt, nur Versionszeile und Kurzdoku bleiben). Nur `dist/` kommt aufs Gerät, `scripts/` ist die Quelle.
3. **Hochladen** per RPC in Stücken (der Editor der Web-UI verliert beim Einfügen Text). Erst `node tools/hwtest.js <ip> scripts` (zeigt id = Name; `put-script.js` prüft den Namen nicht), dann mit den eigenen IDs:
   ```
   node tools/put-script.js <ip> 1 dist/bw_install.js
   node tools/put-script.js <ip> 2 dist/bw_main.js
   node tools/put-script.js <ip> 3 dist/bw_pump.js
   node tools/put-script.js <ip> 7 dist/bw_zeitraffer.js
   ```
4. **Prüfen:** `node tools/verify-scripts.js <ip>` lädt jeden Code zurück und vergleicht ihn byteidentisch mit `dist/`; prüft auch, dass bw_main und bw_pump dieselbe Version tragen. Nach jedem Upload.
5. **Sensor kalibrieren (cfg1):** `vDry` = Spannung des Sensors trocken in Luft (0 %), `vWet` = Spannung im Wasserglas (100 %). Startwerte 0.20 / 3.13 V; am Gerät gemessen 0.296 / 3.134 V. Spannung in der Web-UI am Voltmeter ablesen und eintragen (Beispiel unten), oder den Hardware-Test `bw_hwtest` messen und schreiben lassen (Abschnitt 3.3).
6. **Zielband eintragen (cfg2):** KVS-Werte sind JSON-Strings. Beispielband vom Gerät: `pctSoll` 55, `pctLo` 40, `pctOk` 50, `pctHi` 60, `pctDry` 28, `dropSlow` 4 (steht seit dem Lauf mit 0.1.x auf 4; die richtige Schwelle misst man an der Pflanze, README „Kalibrierung" Schritt 6).
   ```
   curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg1","value":"{\"vDry\":0.296,\"vWet\":3.134}"}'
   curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctSoll\":55,\"pctLo\":40,\"pctOk\":50,\"pctHi\":60,\"pctDry\":28,\"dropSlow\":4}"}'
   ```
   Oder Web-UI → Settings → Key-Value Storage → Eintrag öffnen, „Format as JSON". Die übrigen Felder (`cfg1`: `vErrLo`, `nSample`, `idV` …; `cfg2`: `hyst`, `effMin`, `effMax`, `alpha`, `sfMin`, `sfStep`, `sfUp`, `dropW`) ergänzt der Installer im nächsten Schritt mit Startwerten. Solange ein Bandfeld `null` ist, misst das System nur (`why=cfg`). `KVS.Set` schreibt den ganzen Eintrag neu: vor dem Installer reicht das Teilobjekt (er ergänzt den Rest). Später ein Feld ändern: Web-UI → Key-Value Storage → „Format as JSON" → nur das Feld ändern, oder nach einem Teil-Schreiben Schritt 7 wiederholen (der Installer ergänzt fehlende Felder wieder). Ein fehlendes Pflichtfeld (z. B. `cfg2.hyst`) stoppt das Gießen mit `err=cfg`.
7. **Installer:** `node tools/hwtest.js <ip> normal 60` wartet einen sicheren Moment ab (Sekunde 8–30, kein Betriebs-Script läuft), startet `bw_install` und prüft danach das Ergebnis. Der Installer legt `cfg1..cfg4`, `lrn`, `st`, `job`, `day`, `err` an (nur fehlende Einträge und Felder, nichts wird überschrieben), prüft die Fensterzeiten, baut den Zeitplan aus `cfg3` (`tick`, `winA`/`winB`) und `cfg4` (`tWin`), setzt die Switch-Konfiguration (`initial_state` off, `auto_off` = `tMax` + 10 = 190 s) und beendet sich. Läuft `bw_main` oder `bw_pump`, bricht er ab: später wiederholen.
8. **Zeitplan prüfen** (Ausgabe von `normal` oder Web-UI → Schedules): `0 */15 * * * *` (bw_main alle 15 min), `30 0 8,20 * * *` (bw_pump um 08:00:30 und 20:00:30) und `0 8 8,20 * * *` (Sicherheits-Aus des Ausgangs 8 min nach dem Fenster). KVS ansehen: `tools/kvs_dump.sh <ip>` oder `http://<ip>/rpc/KVS.GetMany?match=*`.
9. **Aufbau:** Sensor in den Topf unter die Tropfer (nassester Punkt, die Skala bezieht sich darauf), Schlauch am Sensor, Behälter voll, Schwimmer über dem Pumpeneinlauf. Erste Konsolenzeile von bw_main lesen (Web-UI → Scripts → bw_main → Konsole, oder `node tools/console.js <ip> 900`, das bis zum nächsten 15-min-Takt mithört; ein Handstart von bw_main ist erlaubt, aber nicht in Sekunde 0–8 einer Taktminute, weil es sonst neben dem Zeitplan-Start läuft): `V=` Spannung, `tC=` Temperatur, `lvl=` 0 oder 1, sonst `idV`/`idT`/`idLvl` in `cfg1` anpassen.
10. **Erstes Fenster mitlesen:** Web-UI → Scripts → bw_pump → Konsole öffnen, oder vom Rechner `node tools/console.js <ip> 900` ab 07:59 bzw. 19:59 (liest die Geräte-Konsole 900 s lang; Debug-Websocket muss an sein, siehe oben). `hwtest.js watch` zeigt die Konsole nur, solange ein Test-Script oder der Zeitraffer läuft; im Normalbetrieb endet es nach wenigen Sekunden. Erwartet: eine Zeile je Takt, z. B. `V=1.196 pct=34 … why=ok sec=70 effW=- sf=0.7 err=-`, im Fenster `Fenster: Auftrag 70 s …`, `m0 … → P1 …`, `P1 …`, `ergebnis=…`. Bedingung: die Taktmessung vor dem Fenster liegt unter `pctLo`, sonst `why=feucht` und keine Gabe.

Nach jeder Änderung von `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin` oder `tTail`: Schritt 7 wiederholen (Zeitplan, Sicherheits-Aus, `auto_off`).

## 2. Testlauf im Zeitraffer

Der Zeitraffer lässt dieselben Scripts `bw_main` und `bw_pump` unverändert laufen, nur mit kurzen Zeiten: Takt 3 min, Gießfenster alle 6 min bei Sekunde 30, Budget 120 s je Fenster, bis 3 Portionen von 10–15 s, Pause 12 min (Hitze 6 min), Tageslimit 4, Trockenphase aus. `bw_zeitraffer` sichert `cfg3`, `lrn`+`day`, `st`+`err`, `cfg4`, `cfg2` nach `zrb1..zrb5`, schreibt das Profil, setzt den Zustand frisch, schreibt die Marke `zr` und startet `bw_install`, der den Zeitplan baut. Zurück bringt `bw_install`: findet er die Sicherung ohne Marke, schreibt er das Original zurück; Testgaben und Testlernwerte zählen nicht.

Profil (`ZR3`/`ZR4` in `scripts/bw_zeitraffer.js`): alle Werte in der Spalte „Zeitraffer" der Tabellen 4.1–4.3; dazu `cfg2.pctDry` = `pctLo` − 1 (Trockenphase praktisch aus). Alles andere bleibt, wie es ist.

**Voraussetzungen:** Installer gelaufen, Zielband vollständig (auch `pctOk`), Behälter voll, Schwimmer VOLL, Ausgang aus, keine `hwb1`/`hwb2`-Reste. Schlauch mit den Tropfern AM Sensor in trockener Erde (der Regelkreis braucht die Rückmeldung, sonst Störung `noeff`; nur Mechanik sehen: `cfg4.nPort` 1, Schlauch in den Eimer). Dazu ein Glas Wasser, ein Becher warmes Wasser (über 30 °C) für den Fühler und ein zweiter Topf mit trockener Erde. Nicht in den 25 Minuten um 08:00, 20:00 oder Mitternacht starten.

```
node tools/hwtest.js <ip> zeitraffer 60    # Vorprüfung, sicherer Moment, Start, Prüfung von Zeitplan/cfg3/cfg4/auto_off, Fahrplan
node tools/hwtest.js <ip> watch 300        # Konsole und Statuszeile (st, n, pctW, why, err, Speicher), beliebig oft; im Zeitraffer bis 1800 s
node tools/hwtest.js <ip> normal 60        # Rückbau und Prüfung
```

Sicherer Moment: Sekunde 8–30, im Zeitraffer nicht in den Minuten 0–2 eines 6er-Zyklus (dort regelt bw_pump), kein Betriebs-Script läuft; das Werkzeug wartet bis zu 4 min darauf. Wer die Scripts von Hand in der Web-UI startet, hält sich an dieselbe Regel.

Fahrplan (Minute ab S, der nächsten vollen 6er-Minute; `why` steht in der Konsolenzeile von bw_main und in der Statuszeile von `watch`):

| Minute | Handgriff | Erwartung |
| --- | --- | --- |
| vor 0 | SMT50 ins Wasserglas, Schwimmer VOLL, `zeitraffer 60` | Zeitplan `0 */3 * * * *`, `30 */6 * * * *`, `40 2,8,14,…,56 * * * *`; `auto_off` 50 s |
| 0 und 3 | nichts | `why=trocken` (Wasserglas > `pctHi` startet die Trockenphase, nicht `feucht`); 0:30 bw_pump „kein Auftrag" |
| 3 (nach dem Takt) | SMT50 in trockene Erde, Schlauch am Sensor | 6 `why=ok sec=12`; **6:30 Fenster 1**: `Fenster: Auftrag 12 s …`, `m0 … → P1 12 s`, `P1 …`, ggf. `P2 …`, `ergebnis=…`; 9 Kontrolle, `st=sperre why=pause` |
| 9–14 | SMT50 in den zweiten trockenen Topf, Schlauch mit | 15 `why=ok` mit `sec` aus `effW`; **18:30 Fenster 2** (12 min Pause): Erstportion unter dem Ziel, Korrektur bis `pctOk` |
| 19 | Fühler in warmes Wasser bis `tC` > 30; Sensor in trockene Erde | 21 `pause=0.1h why=ok`; **24:30 Fenster 3** (Hitze: 6 min Pause) |
| 25 | Schwimmer auf LEER | 27 `why=wasser err=wasser`; 30:30 pumpt nicht |
| 31 | Schwimmer auf VOLL, Sensor in trockene Erde | 33 `why=ok`; **36:30 Fenster 4**; 39 `why=limit` (`maxDay` 4) |
| 40 | `normal 60` | Original zurück, `zrb1..5` und `zr` gelöscht; Zeitplan `0 */15`, `30 0 8,20`, `0 8 8,20`; `auto_off` 190 s |

Der Sicherheits-Aus des Zeitplans feuert im Zeitraffer in jeder Minute ≡ 2 mod 6 bei Sekunde 40 (30 + 120 + 10 = 160 s nach der Fensterminute). Das Tagesmaximum bleibt bis Mitternacht in `lrn.tMaxD`: ab der Erwärmung gilt `pauseHot` für den Rest des Tests.

**Woran man den Regelkreis erkennt** (Konsole von bw_pump, je Fenster): `Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s` → `m0 10.4 % → P1 12 s` → `P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)` → `P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)` → `ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1`. Eine P-Zeile nennt Feuchte vor → nach der Portion, den Zuwachs dieser Portion, `g` = bisheriger Fenstergewinn je wirksame Sekunde (alle Portionen seit `m0` zusammen, deshalb P2 2.006 = (23.6 + 16.5)/(10 + 10)), erste Reaktion nach `tRise` s und die Stabilisierungszeit. Der Takt danach zeigt `Kontrolle: 50.5 → 53.7 % sf=0.7`.

**Rückbau und Prüfung:** `normal 60` startet bw_install im sicheren Moment; `verifyState` prüft danach den Zeitplan gegen die erwarteten Einträge, `auto_off` = `tMax` + 10, dass `zrb1..5` und `zr` weg sind und `cfg3.winEvery` null ist, und meldet Script-Fehler. Bei Abweichungen: Konsole lesen, `normal` wiederholen. Nach der Rückkehr ist `job` frisch; ein im Test gelernter `effW` kommt nicht mit (Original aus `zrb2`).

Am 13.09.2026 lief Fenster 1 dieses Fahrplans am Gerät (im Kalibrierlauf, 15:54:30): zwei Portionen 12 + 10 s, 10,4 → 50,5 %, Laufzeit 100 s bei Frist 120 s, `mem_peak` 12 516 B, Kontrolle 53,7 %; Fenster 2–4 (Pause, Hitze, Wasser, Limit) sind noch offen (`docs/pruefprotokoll-etappe6.md`, Abschnitt Etappe 10).

## 3. Kalibrierung

### 3.1 Messlauf

`node tools/hwtest.js <ip> mess [sek] [n] [beob]` schaltet die Pumpe `n`-mal (Standard 3, höchstens 6) für `sek` Sekunden (Standard 3, höchstens 10) mit `Switch.Set toggle_after` ein und liest den Sensor alle 2 s über `beob` Sekunden je Puls (Standard 90, 30–300). Kein Gerätecode. Voraussetzung: Ausgang aus, Schwimmer VOLL, kein Script läuft, kein Zeitraffer aktiv, kein Fenster nahe. Je Puls druckt es Feuchte vorher, `tRise` (erste Reaktion ≥ 1 %), Spitze, Ruhewert, Einschwingzeit und Gewinn in %/wirksame Sekunde; am Ende Vorschläge für `cfg2.effMax`, `cfg4.tPmin`, `cfg3.tDead`, `cfg3.tMin`, `cfg4.tSoak`, `cfg4.tStab`. `cfg4.tDead2` liest man von Hand aus `tRise` der Folgepulse ab (das Werkzeug schlägt es nicht vor; `kal write` setzt es später aus dem Kalibrierlauf). Rohdaten: `docs/kal/<datum>-mess.json`.

Ergebnis 13.09.2026: 3-s-Pulse füllen nur den Schlauch (Totzeit 5–8 s, danach minutenlanges Nachtropfen); ein 10-s-Puls reagiert nach 7,9 s, bringt +11,6 % (5,6 %/wirksame s) und steht 5 s nach Pumpe-aus. Daraus die Startwerte `tDead2` 8, `tPmin` 10, `tMin` 25, `tSoak` 20, `tStab` 60, `effMax` 30 und die Regel: Portionen nie kürzer als die Totzeit.

### 3.2 Kalibrierlauf

Der Kalibrierlauf ist ein Zeitraffer mit Rekorder. Ablauf: `node tools/hwtest.js <ip> kal [sek]` (Standard 2400 s, 600–3600) → nach dem Ende `normal 60` → `kal report [json] [log]` → `kal write [json] [log]` (ohne Dateiname nimmt er die jüngste Aufzeichnung).

Zustände, auf das Zielband abgebildet (`tools/lib/kal.js`): **trocken** unter `pctDry` (28 %), **mittel** `pctDry`…`pctLo` (28–40 %, Gabe fällig), **band** `pctLo`…`pctHi` (40–60 %, keine Gabe), **nass** über `pctHi` (60 %; im Echtbetrieb Start der Trockenphase). Gaben und Lernwerte entstehen nur in trocken und mittel. Fahrplan, wie ihn `kal` ausgibt: vor dem Start Sensor in trockener Erde → Fenster F1 (trocken); F1+3 Kontrolle, danach Sensor in mittel feuchte Erde → Pause 12 min, F1+9 `why=ok`, F1+12:30 Fenster F2 (mittel); F2+3 Kontrolle, danach Sensor ins nasse Substrat oder Wasserglas, mindestens 3 min (Referenz nass, `why=trocken`); optional zurück in trockene Erde → F3, bis `maxDay` 4. Nach jedem Fenster bleibt der Sensor für die Kontrolle stecken.

Der Rekorder schreibt alle 5 s Sensorwerte und Ausgang, jede Änderung von `st`/`job`/`lrn` und die Konsolenzeilen von bw_pump nach `docs/kal/<datum>-kal.json`. `kal report` zeigt je Fenster Zustand (nach `m0`), Portionen, Σ Sekunden, `tRise`, Spitze, Ruhewert, `effW`, `why` und je Zustand den Gewinn. Der Lernwert wird aus den Konsolenzeilen auf die Skala „% je Sekunde nach `tRise`" umgerechnet, weil `st.effW` mit den Totzeiten des Zeitraffer-Profils (`tDead` 2, `tDead2` 0) rechnet und im Normalbetrieb zu große Gaben ergäbe. Fehlen die Zeilen, zieht `log` sie aus einer `watch`-Logdatei nach. Ohne Konsolenzeilen meldet `kal write` ACHTUNG und lässt `cfg3.tDead`/`tMin` unverändert: Websocket vor `kal` prüfen.

`kal write` verweigert, solange `zrb1` steht (erst `normal`), und schreibt per Lesen-Ändern-Schreiben:

| Feld | Quelle | Regel |
| --- | --- | --- |
| `lrn.effW` | Mittel der Fensterlernwerte (nur reguläre Fenster: ok, over, max, zeit, stall, unstab) | vorhandener Wert → Mischung α 0,5 |
| `cfg4.tDead2` | Median `tRise` der Folgeportionen | ersetzt den Wert |
| `cfg3.tDead` | `tRise` der Erstportion | ersetzt den Wert |
| `cfg3.tMin` | `max(tPmin, tDead + 2)` | Portionen nie unter 10 s; sonst gösse die Klemme bei kurzem Schlauch weit über das Ziel |

Die Totzeit gehört zum Schlauch, nicht zum Script: der Endaufbau mit längerem Schlauch (10–20 s Wasserlaufzeit) braucht ein neues `mess`, danach `tDead` und `tMin` prüfen. Ergebnis 13.09.2026 (`kal write` 16:06): `lrn.effW` null → 4.46, `cfg4.tDead2` 8 → 5, `cfg3.tDead` 20 → 8, `cfg3.tMin` 25 → 10.

### 3.3 Sensorkalibrierung cfg1

`vDry`/`vWet` (0 % trocken in Luft, 100 % im Wasser) misst `bw_hwtest` in den Phasen m1/m2 und schreibt sie nach `cfg1`:

```
node tools/hwtest.js <ip> preflight hw          # legt bw_hwtest und bw_hwpump an und nennt die Upload-Befehle mit ID
node tools/put-script.js <ip> <id> dist/bw_hwtest.js
node tools/hwtest.js <ip> cfg run='"m"'         # nur die Feuchtephasen m1/m2
node tools/hwtest.js <ip> start bw_hwtest 20   # dann je Phase: watch 120, Sensor trocken bzw. im Wasserglas, go
node tools/hwtest.js <ip> report               # cfg1 vDry/vWet neu, alt>neu unter cal
```

Von Hand: Voltmeter in der Web-UI ablesen und wie in Schritt 5 eintragen (README „Kalibrierung", Handbuch Kapitel 3). Der Flash ist knapp: `bw_hwtest` nach dem Test mit `node tools/hwtest.js <ip> delete bw_hwtest` entfernen.

## 4. Quick How-to: Was die Parameter machen

Werte ändern: Eintrag im KVS bearbeiten (Web-UI oder `KVS.Set`), die Scripts lesen ihn bei jedem Start. `cfg1..cfg4` sind Einstellungen, `lrn` Lernwerte, `st`/`job`/`day`/`err` Zustand. Startwert = `DEF` in `bw_install`; Zeitraffer = `ZR3`/`ZR4`.

### 4.1 Zeitfenster und Mindestzeiten

| Feld | Wo | Startwert (Normal / Zeitraffer) | Wirkung | Wann ändern |
| --- | --- | --- | --- | --- |
| `tick` | cfg3 | 15 / 3 min | Takt von bw_main (Zeitplan `0 */tick * * * *`); Teiler von 60 | selten; danach Installer |
| `winA`, `winB` | cfg3 | 08:00, 20:00 / unverändert | Gießfenster, Ortszeit; bw_pump startet bei Sekunde 30 der Minute | andere Gießzeiten; danach Installer |
| `winEvery` | cfg3 | null / 6 min | Zahl N: Fenster alle N min statt `winA`/`winB`; Teiler von 60 | nur Zeitraffer |
| `PUMP_SEC` | Code bw_install | 30 s | bw_pump startet 30 s nach der vollen Minute, nie neben bw_main (geteilter Heap) | nie |
| `tWin` | cfg4 | 420 / 120 s | Zeitbudget je Fenster ab Scriptstart; Fenster endet spätestens dann | längere oder kürzere Fenster; danach Installer |
| `tTail` | cfg4 | 20 / 20 s | Reserve zwischen Fensterende und nächstem Takt | selten; danach Installer |
| Sicherheits-Aus | Zeitplan | 8 min / Minute +2, Sekunde 40 | `Switch.Set off` 30 + `tWin` + 10 s nach der Fensterminute, auf volle Minuten aufgerundet (`SAFE_MIN`): `0 8 8,20 * * *`; wirkt ohne Script | rechnet der Installer |
| `jobAge` | cfg3 | 20 / 5 min | Höchstalter des Auftrags im Fenster (`err=alt`); so lange sperrt auch ein abgebrochenes Fenster (`st.why=laeuft`) | nur mit `tick`, muss über `tick` + 0,5 min bleiben |
| `tChk` | cfg3 | 5 / 1 s | Abstand der Wasserstandsprüfungen während einer Portion | selten |
| `tSoak` | cfg4 | 20 / 10 s | Einsickern nach jeder Portion, bevor gemessen wird | Messlauf (Ruhewert) |
| `tStep` | cfg4 | 5 / 5 s | Abstand der Messwerte beim Stabilisieren | selten |
| `tStab` | cfg4 | 60 / 30 s | Timeout der Stabilisierung; danach zählt der Mittelwert, noch steigend → `unstab` | Messlauf (Einschwingzeit) |
| `nStab` | cfg4 | 4 / 3 | Messwerte, die für „stabil" innerhalb `dStab` liegen müssen | selten |

**Mindestbedingungen** (prüft `bw_install`; ein Verstoß bricht den Installer mit `err.code=cfg` ab, die Konsole nennt das Feld):

- Ein Fenster muss samt Reserve vor dem nächsten Takt enden: `(Fensterminute mod tick)·60 + 30 + tWin + tTail ≤ tick·60`. Normal: 0 + 30 + 420 + 20 = 470 ≤ 900. Zeitraffer: 30 + 120 + 20 = 170 ≤ 180. Ein Fenster um 08:05 passt (300 + 470 = 770), eines um 08:10 nicht (1070).
- Zeitraffer zusätzlich: der Sicherheits-Aus liegt vor dem nächsten Fenster, `30 + tWin + 10 < winEvery·60` (160 < 360).
- Frist in bw_pump (Schritt 3 von `bw_pump`): `B = min(tWin, tick·60 − q − tTail)`, q = Sekunden seit dem letzten Takt. Eine Portion startet nur, wenn `vergangen + sec + tSoak + nStab·tStep ≤ B` (Messzeit 20 + 4·5 = 40 s normal, 10 + 3·5 = 25 s Zeitraffer); sonst endet das Fenster mit `why=zeit`. Normal: q = 30 → B = min(420, 850) = 420 s. Ein Handstart mitten im Takt bekommt nur den Rest bis zum Takt.
- Pause mit Toleranz: `(now + 2·tick·60) − st.ts ≥ pause·3600`, also zwei Takte Vorlauf (30 min normal, 6 min Zeitraffer), weil der Auftrag einen Takt vor dem Fenster entsteht.
- `jobAge` muss den Abstand Takt → Fenster decken: der Auftrag entsteht im Takt vor dem Fenster, das Fenster startet bis zu `tick` min + 30 s später (Normal 15,5 min < 20; Zeitraffer 3,5 min < 5). Zu klein → `err=alt`, keine Gabe. bw_main schreibt den Auftrag im Takt vor dem Fenster immer frisch.

### 4.2 Bewässerung

| Feld | Wo | Startwert (Normal / Zeitraffer) | Wirkung im Regelkreis |
| --- | --- | --- | --- |
| `tDead` | cfg3 | 20 (Gerät 8) / 2 s | Totzeit der Erstportion (Schlauch füllen); geht in die Dosis ein: `sec = (pctSoll − pct)/effW·sf + tDead` |
| `tMin` | cfg3 | 25 (Gerät 10) / 10 s | kleinste Erstportion; `kal write` setzt `max(tPmin, tDead + 2)` |
| `tStd` | cfg3 | 70 / 12 s | Erstportion, solange `lrn.effW` null ist |
| `tMax` | cfg3 | 180 / 40 s | Summe aller Portionen je Fenster; `auto_off` = `tMax` + 10 |
| `tPmin` | cfg4 | 10 / 10 s | kleinste Korrekturportion; nie unter 10 s (Wasserlaufzeit im Schlauch) |
| `tPmax` | cfg4 | 120 / 15 s | längste Portion (`toggle_after` im Einschaltbefehl) |
| `nPort` | cfg4 | 6 / 3 | Portionen je Fenster; 1 = Einzelportion ohne Messung und ohne Lernwert |
| `tDead2` | cfg4 | 8 (Gerät 5) / 0 s | Totzeit der Folgeportionen (Schlauch schon voll) |
| `dEffMin` | cfg4 | 2 / 1 % | Summe der Wirkung zweier voller Portionen; darunter Störung `noeff` |
| `dStab` | cfg4 | 1 / 1 % | Spanne „stabil" (Trend höchstens die Hälfte); zugleich Schwelle „Portion ohne Wirkung" |
| `maxDay` | cfg3 | 2 / 4 | Fenster je Kalendertag; Tagesvorrat = `maxDay` × `tMax` Pumpensekunden (360 / 160) |
| `auto_off` | Switch-Config | 190 / 50 s | das Gerät schaltet den Ausgang `tMax` + 10 s nach jedem Einschalten selbst ab; setzt der Installer |
| `lvlEmpty`, `nLvl` | cfg1 | 1, 3 | Eingangswert für LEER (Gerät: LEER = 1, VOLL = 0) und Zahl gleicher Lesungen; leer vor der Gabe → `wasser`, während der Portion → `abbruch` |

So rechnet das Fenster: Erstportion = `clamp(job.sec, tMin, min(tPmax, tMax, Tagesvorrat − day.sec))`; nach jeder Portion `tSoak` s einsickern, dann alle `tStep` s messen, bis `nStab` Werte in `dStab` liegen (spätestens `tStab`). Korrekturportion: Ziel = `min(pctSoll, pct + (pctHi − pct)/2)`, `sec = (Ziel − pct)/Gewinn + tDead2` mit dem im Fenster gemessenen Gewinn (mindestens `effMin`), geklemmt auf `tPmin` … `min(tPmax, tMax − bisher, Tagesvorrat)`. Ende: Feuchte ≥ `pctOk` → `ok`; > `pctHi` → `over`; `nPort` erreicht oder Rest < `tPmin` → `max`; Frist → `zeit`. Bleibt Portion 1 ohne Wirkung (Δ < `dStab`), folgt genau eine volle Probeportion; ΣΔ < `dEffMin` nach Portion 2 → `noeff`, gesperrt bis `err` gelöscht ist. Beispiel mit den Gerätewerten: Takt misst 30 % → Auftrag (55 − 30)/4,46 · 0,7 + 8 ≈ 12 s.

### 4.3 Steuerung im Regelbetrieb

| Feld | Wo | Startwert (Gerät 13.09.2026) | Wirkung |
| --- | --- | --- | --- |
| `pctDry` | cfg2 | null (28) | Ende der Trockenphase: gegossen wird wieder, sobald eine Taktmessung darunter liegt |
| `pctLo` | cfg2 | null (40) | Auftrag, wenn die Taktmessung darunter liegt; ein laufender Auftrag hält bis `pctLo` + `hyst` |
| `pctOk` | cfg2 | null (50) | Ziel erreicht: das Fenster endet, sobald die stabile Feuchte diesen Wert erreicht; Frischmessung ≥ `pctOk` → `feucht` |
| `pctSoll` | cfg2 | null (55) | Zielpunkt der Dosisrechnung (Erst- und Korrekturportion) |
| `pctHi` | cfg2 | null (60) | im Fenster darüber `over` (`sf` sinkt nur, wenn schon die erste Portion darüber lag); Taktmessung darüber = nass → Trockenphase |
| Ordnung | cfg2 | | `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` und `pctLo + hyst < pctOk`, sonst `err=cfg`, `why=cfg`, keine Gabe |
| `hyst` | cfg2 | 2 % | Auftrag hält bis `pctLo` + `hyst`; Kontrolle meldet „zu viel" erst über `pctHi` + `hyst` |
| `dropSlow` | cfg2 | null (4) %/24 h | trocknet die Erde langsamer als das → `pauseSlow` (Staunässe-Verdacht); Schwelle an der Pflanze noch zu messen (README „Kalibrierung" Schritt 6) |
| `dropW` | cfg2 | null | Abfall von der letzten Fensterablesung bis zur Kontrolle über `dropW` → Hinweis `sink`; null = aus |
| `effMin`, `effMax` | cfg2 | 0.05, 30 | Grenzen für `effW` und die Korrekturrechnung |
| `alpha` | cfg2 | 0.3 | Gewicht des neuen Fensterwerts beim Lernen (0,7 alt, 0,3 neu) |
| `sfMin`, `sfStep`, `sfUp` | cfg2 | 0.5, 0.1, 0.05 | Untergrenze, Schritt abwärts und Schritt aufwärts des Sicherheitsfaktors |
| `pause`, `pauseHot`, `pauseSlow` | cfg3 | 24, 12, 48 h (Zeitraffer 0.2, 0.1, 0.35) | Mindestpause seit der letzten Gabe: normal / Tagesmaximum über `tHot` oder Nachholen nach `max`/`zeit` unter `pctLo` / langsame Abnahme |
| `soak` | cfg3 | 30 min (Zeitraffer 0.25) | Kontrolle durch bw_main so viele Minuten nach dem Fensterende |
| `tHot` | cfg3 | 35 °C (Zeitraffer 30) | Tagesmaximum heute oder gestern darüber → `pauseHot`, also beide Fenster am Tag |
| `dryDay` | cfg3 | 5 = Freitag (Zeitraffer null) | Trockenphase ab dem ersten Takt dieses Wochentags (0 = Sonntag … 6 = Samstag); null = nie |
| `lrn.effW` | lrn | null (4.46) | % Feuchte je wirksame Pumpensekunde; lernt bw_pump je Fenster: neu = ΔFeuchte / wirksame s (geklemmt `effMin`…`effMax`), `effW` = (1 − `alpha`)·alt + `alpha`·neu; erstes Fenster nimmt neu direkt |
| `lrn.sf` | lrn | 0.7 | Sicherheitsfaktor der Erstportion, startet bewusst unter dem Ziel; − `sfStep` bei `over` mit einer Portion oder Kontrolle „zu viel", + `sfUp` bei `ok` nach ≥ 2 Portionen; Klemme `sfMin` … 1 |

**Ein Tag im Regelbetrieb:**

1. Takt alle 15 min: bw_main misst 5× (Mittel ohne Ausreißer), Temperatur und Wasserstand. Feuchte unter `pctLo` und keine Bremse → `job` mit `ok=true` und `sec` aus der Dosisformel (ohne `effW`: `tStd`).
2. Fenster 08:00:30 oder 20:00:30: bw_pump liest `job` (Alter ≤ `jobAge`), rechnet die Frist, misst frisch (`m0`): ≥ `pctOk` → `feucht`, > `pctHi` → `nass`; prüft den Schwimmer und schreibt den Claim `st.why=laeuft`.
3. Portionen: Portion 1, `tSoak` einsickern, messen bis stabil, unter `pctOk` Korrekturportion aus dem gemessenen Gewinn; ≥ `pctOk` → `ok`, > `pctHi` → `over`; Grenzen `nPort`, `tMax`, Tagesvorrat, Frist.
4. Fensterende: `effW` und `sf` lernen, `st`/`day`/`job` schreiben (`ergebnis=…`).
5. Kontrolle `soak` min nach dem Fensterende: `Kontrolle: pctW → pctA`; über `pctHi` + `hyst` → `zuviel` (`sf` − `sfStep`); Abfall über `dropW` → `sink`.
6. Pause: bis `pause` (24 h) `why=pause`; lag das Tagesmaximum über `tHot`, nur `pauseHot` (12 h, also beide Fenster); kaum Abnahme → `pauseSlow` (48 h). Höchstens `maxDay` Fenster je Tag, dann `limit`.
7. Freitag (`dryDay` 5): beim ersten Takt des Tages beginnt die Trockenphase, `why=trocken`, keine Gabe, bis eine Taktmessung unter `pctDry` (28 %) liegt; dann läuft es normal weiter.
8. Nässe: zeigt eine Taktmessung mehr als `pctHi` (60 %, nicht direkt nach einem unkontrollierten Fenster), beginnt die Trockenphase sofort (`Trockenphase (nass 63 %)`).

Die wichtigsten Codes (`job.why` schreibt bw_main bis zum Fenster, bw_pump im Fenster; dort zugleich `st.why`):

| why | von | Bedeutung |
| --- | --- | --- |
| `ok` | main / pump | Auftrag steht, `sec` Erstportion / Fenster im Band beendet (`pctW` ≥ `pctOk`) |
| `feucht` | main / pump | Taktmessung ≥ `pctLo` (+ `hyst`) bzw. Frischmessung ≥ `pctOk`: keine Gabe, keine Pause, kein Lernwert |
| `pause` | main | Mindestpause läuft (auch nach einem abgebrochenen Fenster) |
| `trocken` | main | Trockenphase (Trockentag oder Nässe) bis Taktmessung < `pctDry` |
| `wasser` | main / pump | Behälter leer (`err=wasser`); während einer Portion: `abbruch` |
| `limit` | main / pump | `maxDay` Fenster erreicht |
| `cfg` | main / pump | Band unvollständig oder ungeordnet, Pflichtfeld fehlt (`err=cfg`) |
| `laeuft` | pump (`st.why`) | Fenster in Arbeit; bleibt es stehen, starb das Script: Pumpe geht über `toggle_after`/`auto_off`/Sicherheits-Aus aus, Pause hält |
| `over` | pump | stabile Feuchte nach einer Portion über `pctHi` (Fensterende, Lernwert wird gebildet); war es schon die erste Portion, sinkt `sf` um `sfStep`, nach einer Korrekturportion bleibt `sf` |
| `max` | pump | `nPort`, `tMax` oder Tagesvorrat erreicht |
| `zeit` | pump | Frist bis zum nächsten Takt reicht nicht für die nächste (oder erste) Portion |
| `unstab` | pump | Messwert stieg beim Timeout noch: keine weitere Portion |
| `noeff` | pump | zwei volle Portionen ohne Wirkung (`err=noeff`, bleibt bis ein Mensch `err` löscht) |
| `nass` | pump | Frischmessung über `pctHi`: Trockenphase, keine Gabe |
| `kein_auftrag` | pump (nur Konsole `ergebnis=`) | bw_pump lief ohne gültigen Auftrag (Handstart, `job.ok=false`, oder abgebrochenes Fenster `laeuft` jünger als `jobAge`); `job` und `st` bleiben unverändert |
| `sensor` / `lvl` | main / pump | Feuchtesensor unplausibel (`err=sensor`; `cfg1.idV`, Kabel) bzw. Wasserstand nicht stabil lesbar (`idLvl`) |
| `err:<code>` | main / pump | stehende Störung blockiert, z. B. `err:noeff` |
| `soak` | main | Fenster wartet noch auf die Kontrolle (`soak` min) |
| `alt` | pump | Auftrag älter als `jobAge` (`err=alt`): läuft bw_main noch? |

## 5. Wo steht mehr

- `README.md`: Stückliste, Verdrahtung, Kalibrierung, Installation, Hardware-Test, Praxistest im Zeitraffer (mit Messlauf und Kalibrierlauf), Konfiguration cfg1..cfg4 und Zustandseinträge, Betrieb und Ablesen (Konsolenzeilen, von Hand gießen, Update von 0.1.x), Störungen, Sicherheit, Funktionsweise, Grenzen des Shelly.
- `docs/handbuch/`: 1 Einführung und Architektur, 2 Hardware und Verdrahtung, 3 Installation am Gerät, 4 Auf eigenem VPS mitentwickeln, 5 Claude Code und graft, 6 Shelly per Remote live debuggen (Tunnel, Konsole), 7 Mitwirken und Tests; zweisprachig DE/EN.
- `docs/PLAN.md`: Etappenplan, Entscheidungstabelle (Regelkreis und Kalibrierung: Entscheidungen 38–63), Nachträge aus Etappe 10 mit den Gründen für Zeitraffer-Profil, `pctDry`, Frist, `kal write`.
- `docs/pruefprotokoll-etappe6.md`: Hardware-Test, Zeitraffer-Lauf, Messlauf (Tabelle der Pulse), Etappe 10 am Gerät (Fenster 1, Heap, `kal write`), offene Prüfungen.
- `LEARNING.md`: Überraschungen vom echten Gerät (Editor verliert Text, Heap bei zwei Scripts, Messlauf, Totzeit-Skala des Lernwerts, Messwerte aus Etappe 10).
- `scripts/lib_notes.md`: jede genutzte Shelly-RPC mit Parametern, Antwort und Doku-Link.
- `docs/kal/`: Rohdaten von Messlauf und Kalibrierlauf (`<datum>-mess.json`, `<datum>-kal.json`).
