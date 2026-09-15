# 13 · Betrieb und Wartung

**Deutsch** · [English](../en/13-betrieb-und-wartung.md) — [Handbuch](README.md) · Teil D „Betreiben“

> **Auf einen Blick**
> - Im Alltag genügt die Konsolenzeile von `bw_main` (eine je Takt, alle <!-- def:cfg3.tick -->15<!-- /def --> min): `why` sagt, warum gegossen wird oder nicht, `err` ob eine Störung steht.
> - `job.why` ist kein Fehler. `pause`, `trocken`, `feucht`, `soak` und `limit` sind erwartete Bremsen; Störungen stehen in `err.code`, und nur `noeff`, `cfg`, `uhr`, `sensor`, `wasser` blockieren das Gießen.
> - Genau eine Störung braucht einen Menschen: `noeff` (zwei Portionen ohne Wirkung) – Pumpe, Schlauch, Tropfer und Sensorlage prüfen, dann `err` löschen. Alle anderen löschen sich selbst.
> - Werte ändern geht jederzeit im KVS; nach `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin` oder `tTail` den Installer starten. Update: `npm run build` → Upload → `verify-scripts` → `hwtest.js <ip> normal 30`.
> - Größter Stolperstein: Upload und Installer nie in einem Gießfenster – `put-script.js` stoppt das Script sofort und wartet nicht; einen sicheren Moment (Sekunde 8–30, nicht in den 9 min nach `winA`/`winB`, kein Script läuft) warten nur `hwtest.js normal`, `zeitraffer` und `mess` ab.

## Voraussetzungen

- Installation abgeschlossen ([06 · Startanleitung](06-startanleitung.md)), Zielband eingetragen und das erste Fenster gesehen ([12 · Erstinbetriebnahme](12-erstinbetriebnahme.md))
- Zugriff auf die Web-UI des Shelly oder per RPC (`curl`); für die Werkzeuge Node ≥ 22 auf einem Rechner mit Zugriff auf `<ip>` – vom VPS über den Tunnel `127.0.0.1:8010` ([09 · Installation mit VPS](09-installation-vps.md))
- Für Konsolenzeilen muss der Debug-Websocket an sein: Web-UI → Scripts → Script öffnen → Konsole öffnen. `tools/console.js` und `hwtest.js watch` lesen denselben Kanal

## Diagramm

[![Zustände im Betrieb: st.state, Sperren, Störungen, noeff](../diagramme/de/13-betrieb-und-wartung.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/13-betrieb-und-wartung.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/13-betrieb-und-wartung.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Normaler Zyklus“, 2 „Bremsen“, 3 „Störungen und Rückweg“, 4 „noeff: nur von Hand“.

## Ablesen

### Die Konsolenzeile von bw_main

`bw_main` schreibt je Takt genau eine Zeile (Web-UI → Scripts → `bw_main` → Konsole, oder `node tools/console.js <ip> 900`). Beispiel vom Gerät (13.09.2026, Zeitraffer-Profil):

```text
[bw_main 0.2.0] V=1.82 pct=53.7 tC=23.6 lvl=0 st=sperre dry=1 pause=0.2h why=pause sec=- effW=2.006 sf=0.7 err=- w=2 dauer=5385ms
```

| Feld | Bedeutung |
| --- | --- |
| `V` | Sensorspannung in V (Mittel aus `nSample` Werten ohne Ausreißer) |
| `pct` | Feuchte in % nach der Kalibrierung `vDry`/`vWet` |
| `tC` | Temperatur des DS18B20; `-` wenn der Fühler nicht liest (`err=temp`) |
| `lvl` | Schwimmer: Wert gleich `lvlEmpty` heißt LEER; `?` wenn die `nLvl` Lesungen nicht übereinstimmen |
| `st` | `st.state`: `beob`, `gegossen` oder `sperre` |
| `dry` | `st.dryOk`: 0 in `sperre` heißt Trockenphase offen |
| `pause` | die in diesem Takt gewählte Pause in h (`pause`, `pauseHot` oder `pauseSlow`) |
| `why` | Grund für oder gegen einen Auftrag (Tabelle unten) |
| `sec` | Erstportion des Auftrags in s, sonst `-` |
| `effW`, `sf` | Lernwerte: Wirkung je wirksame Pumpensekunde (`-` bis zum ersten Fenster) und Sicherheitsfaktor |
| `err` | stehende Störung oder `-` |
| `w` | KVS-Schreibvorgänge dieses Takts (nur geänderte Einträge) |
| `dauer` | Laufzeit in ms |

Vor dieser Zeile können Sonderzeilen stehen: `Kontrolle: 50.5 → 53.7 % sf=0.7` (Feuchte nach dem Fenster → jetzt; angehängt `zuviel` oder `sink`), `Trockenphase (Wochentag 5): warte auf < 28 %`, `Trockenphase (nass 63 %): …` sowie `Störung cfg: cfg3.tick fehlt` mit dem fehlenden Feld.

### Die Konsolenzeilen von bw_pump

Ein Fenster liefert eine Kopfzeile, eine Zeile je Portion und eine Ergebniszeile:

| Zeile | Beispiel (Gerät 13.09.2026) | Lesart |
| --- | --- | --- |
| Kopf | `Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s` | Auftrag, Feuchte laut Takt, Lernstand, Frist = Zeitbudget des Fensters ab Scriptstart (Rest bis zum nächsten Takt minus `tTail`, höchstens `tWin`); ohne `pct` steht hier `Einzelportion` |
| Frischmessung | `m0 10.4 % → P1 12 s` | Median vor der ersten Portion und deren Länge |
| Portion | `P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)` | Feuchte vor → nach der Portion, Zuwachs, Gewinn je wirksame Sekunde, erste Reaktion nach s, stabil (oder `unstabil`) nach s |
| Ergebnis | `ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199` | Ergebnis (= `job.why`; ab der ersten Portion oder bei `nass` auch `st.why`), Portionen, Pumpensekunden, Fensterdauer, Feuchte vor → nach, neuer Lernwert, Fenster heute, Störung, Schreibvorgänge, Laufzeit in ms |

Sonderzeilen: `m0 … ≥ pctOk – feucht`, `m0 … > pctHi – nass`, `keine Wirkung: Probeportion … s`, `Störung noeff: ΣΔ … % nach 2 Portionen – von Hand löschen`, `Frist: Rest … s`, `Grenze erreicht`, `Behälter leer`, `Ausgang war EIN – Ende (extern)`, `kein Auftrag` und `Fenster abgebrochen (laeuft) – kein Auftrag`.

> **Hinweis:** Jedes Script hat oben `var DEBUG = 0;`. Auf `1` gesetzt (oder mit `node tools/build.js --debug` gebaut), schreibt es zusätzlich jeden Schritt, jeden RPC-Aufruf mit Parametern, jeden gelesenen KVS-Eintrag und die Messwerte als `[bw_main dbg] …` in die Konsole. Für den Normalbetrieb wieder `0` ([14 · Debuggen und Testen](14-debuggen-und-testen.md)).

### KVS lesen

Alle Einträge auf einmal: `http://<ip>/rpc/KVS.GetMany?match=*` im Browser oder `tools/kvs_dump.sh <ip>`. In der Web-UI (Settings → Key-Value Storage) jeden Eintrag mit „Format as JSON“ öffnen, sonst steht dort nur `[object Object]`. Die Zustandseinträge:

| Eintrag | Felder | Bedeutung |
| --- | --- | --- |
| `st` | `state`, `why`, `ts`, `dur`, `n`, `sec`, `pctB`, `pctW`, `pctA`, `effW`, `tr`, `rated`, `dryOk` | Zustand; `ts` = Start des letzten Fensters, `dur` = s bis Pumpe-aus der letzten Portion, `n` Portionen, `sec` Pumpensekunden, Feuchte vor/nach dem Fenster/bei der Kontrolle |
| `job` | `ok`, `sec`, `pct`, `why`, `ts` | Auftrag von `bw_main`; `bw_pump` trägt das Ergebnis in `why` ein und setzt `ok=false` |
| `day` | `date`, `n`, `sec` | Fenster heute und Summe aller Pumpensekunden (auch Teilportionen) |
| `lrn` | `effW`, `sf`, `rate`, `tMean`, `tMaxD`, `tMaxY` | Lernwerte (`effW`, `sf`), Austrocknung %/h (`rate`), geglättetes Tagesmaximum (`tMean`), Tagesmaximum heute/gestern in 2-°C-Schritten (`tMaxD`/`tMaxY`; beide zählen für `tHot`) |
| `err` | `code`, `ts`, `mem` | letzte Störung, Zeitpunkt, freier RAM in Byte (bei jeder Störung und einmal täglich) |

Eine Gabe ist ein Gießfenster mit bis zu `nPort` Portionen: `day.n` zählt Fenster, `day.sec` alle Pumpensekunden, `st.n` die Portionen des letzten Fensters; Pause und Tageslimit rechnen in Fenstern.

`Sys.GetStatus` liefert mit `kvs_rev` den Zähler aller Schreibvorgänge. Geschrieben wird nur, was sich geändert hat: im 7-Tage-Modell des Mocks 15–22 Schreibvorgänge je Gießtag (Grenze im Test 24; je Fenster der Claim und `st`/`day`/`job`/`lrn`).

> **Am Gerät gemessen (13.09.2026):** Zeitraffer-Fenster `w=4`, Takte `w=0` bis `w=3`.

## Die Gründe in job.why

Bis zum Fenster schreibt `bw_main` den Grund für oder gegen einen Auftrag, im Fenster `bw_pump` das Ergebnis (ab der ersten Portion oder bei `nass` zugleich `st.why`; endet das Fenster vorher, bleibt `st` unverändert). Der erste zutreffende Grund gewinnt ([02 · Flussdiagramm](02-flussdiagramm.md)).

| `why` | von | Bedeutung |
| --- | --- | --- |
| `ok` | main | Auftrag steht: `sec` Sekunden Erstportion im nächsten Fenster |
| `ok` | pump | Fenster im Band beendet (`pctW ≥ pctOk`) |
| `cfg` | main | Zielband unvollständig (auch `pctOk`, `dropSlow`), Ordnung verletzt oder Pflichtfeld fehlt (`err=cfg`) |
| `sensor` | main, pump | Feuchtesensor unplausibel (`err=sensor`; im Fenster vor oder zwischen den Portionen) |
| `lvl` | main, pump | Wasserstand nicht stabil lesbar (`nLvl` Lesungen ungleich) |
| `wasser` | main, pump | Behälter leer (`err=wasser`; im Fenster vor der ersten Portion oder in der Wartephase danach) |
| `err:<code>` | main, pump | stehende Störung blockiert, z. B. `err:noeff` |
| `limit` | main, pump | Tageslimit `maxDay` <!-- def:cfg3.maxDay -->2<!-- /def --> erreicht |
| `alt` | pump | Auftrag älter als `jobAge` <!-- def:cfg3.jobAge -->20<!-- /def --> min (`err=alt`) – läuft `bw_main` noch? |
| `soak` | main | Fenster wartet noch auf die Kontrolle (`soak` <!-- def:cfg3.soak -->30<!-- /def --> min) |
| `pause` | main | Mindestpause läuft (24 / 12 / 48 h; im Zeitraffer 12 / 6 min) – auch nach einem abgebrochenen Fenster (`st.why=laeuft`) |
| `trocken` | main | Trockenphase (Trockentag `dryDay` oder Nässe über `pctHi`): keine Gabe, bis eine Taktmessung unter `pctDry` liegt |
| `feucht` | main, pump | Taktmessung `≥ pctLo` (mit laufendem Auftrag `≥ pctLo + hyst`) bzw. Frischmessung `≥ pctOk`: keine Gabe, kein Lernwert, keine Pause |
| `nass` | pump | Frischmessung über `pctHi` → Trockenphase, keine Gabe |
| `over` | pump | Portion endete über `pctHi`; war es die erste, sinkt `sf` |
| `max` | pump | Grenze erreicht: `nPort` Portionen, `tMax` oder Tagesvorrat |
| `zeit` | pump | Frist bis zum nächsten Takt reicht nicht für die nächste (oder erste) Portion |
| `stall` | pump | spätere Portion ohne Wirkung, obwohl frühere wirkten (kein `err`) |
| `unstab` | pump | Messwert stieg beim Timeout noch – Fenster beendet, keine weitere Portion |
| `noeff` | pump | zwei volle Portionen ohne Wirkung (Σ < `dEffMin` <!-- def:cfg4.dEffMin -->2<!-- /def --> %) → `err=noeff` |
| `abbruch` | pump | Behälter während einer Portion leer → Pumpe sofort aus, `err=wasser` |
| `extern` | pump | Ausgang war schon EIN oder wurde von außen ausgeschaltet – Fenster beendet |
| `switch` / `kvs` | pump | `Switch.Set` bzw. der Claim `st.why=laeuft` schlug fehl – nicht gepumpt |
| `laeuft` | pump (nur `st.why`) | Fenster in Arbeit; bleibt es stehen, starb das Script mitten im Fenster – Pumpe geht über `toggle_after`, `auto_off` und Sicherheits-Aus aus, `bw_main` hält die Pause |
| `kein_auftrag` | pump (nur Konsole `ergebnis=`) | ohne gültigen Auftrag gelaufen: Handstart, `job.ok=false`, `sec` < 1 oder Claim `laeuft` jünger als `jobAge`; `job` und `st` bleiben unverändert |

## Störungen in err.code

| `err.code` | gesetzt von | blockiert | löscht sich | was tun |
| --- | --- | --- | --- | --- |
| `cfg` | main, pump, install | ja | beim nächsten Takt mit vollständiger, geordneter Konfiguration | Pflichtfeld: Konsole nennt es (`Störung cfg: cfg3.tick fehlt`) → Installer starten; leeres Bandfeld: nur `why=cfg err=cfg` → `cfg2` prüfen und eintragen |
| `uhr` | main, pump | ja | beim nächsten Takt mit gültiger Uhrzeit | WLAN/NTP prüfen; nach Stromausfall ohne Internet steht der Zeitplan ohnehin |
| `sensor` | main, pump | ja | sobald die Spannung wieder in `vErrLo`…`vErrHi` liegt | Kabel, Stecker, Sensorlage, `cfg1.idV` prüfen |
| `wasser` | main, pump | ja | sobald der Schwimmer stabil VOLL meldet | Behälter füllen |
| `noeff` | pump | ja | **nie** | zwei volle Portionen ohne messbare Wirkung: Pumpe, Schlauch, Tropfer, Sensorlage prüfen, dann `err` löschen (unten) |
| `temp` | main | nein | sobald der Fühler wieder liest | DS18B20 prüfen; die Hitzeregel (`tHot`) ist solange aus |
| `zuviel` | main | nein | bei der nächsten Kontrolle | Hinweis: Kontrolle über `pctHi + hyst`, `sf` gesenkt (außer das Fenster endete schon mit `over`) |
| `sink` | main | nein | bei der nächsten Kontrolle | Hinweis: Feuchte seit der Fensterablesung um mehr als `dropW` gefallen (nur wenn `dropW` gesetzt) – Drainage, Sensor verrutscht? |
| `alt` | pump | nein | sobald `bw_main` einen neuen Auftrag schreibt | `bw_main` läuft nicht mehr? Zeitplan und Konsole prüfen |
| `limit` | pump | nein | beim Tageswechsel | Hinweis: `maxDay` erreicht |

Vorrang: `noeff` wird nie überschrieben; ein blockierender Code bleibt vor einem Hinweis stehen; unter den blockierenden gilt `cfg` > `uhr` > `sensor` > `wasser`. Keine Störung, aber eine Sperre sind `nass` und `trocken`: Die Trockenphase endet von selbst, sobald eine Taktmessung unter `pctDry` liegt.

## Störung beheben

### noeff zurücksetzen

`noeff` heißt: Zwei volle Portionen haben am Sensor zusammen weniger als `dEffMin` % bewirkt. Das System gießt erst wieder, wenn ein Mensch nachgesehen hat.

1. Ursache suchen: Fördert die Pumpe (Sichtprüfung, Behälter voll)? Ist der Schlauch geknickt, der Tropfer verstopft? Liegt der Tropfer über dem Sensor und steckt der Sensor in der Erde?
2. `err` löschen – per RPC oder in der Web-UI (Settings → Key-Value Storage → `err` → Delete):

   ```bash
   curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"err"}'   # Antwort: {"rev":…}; bw_main legt err beim nächsten Takt leer neu an
   ```

3. Nächsten Takt lesen: `err=-`, `why` wieder `ok`, `pause` oder `feucht`. Die Pause seit dem `noeff`-Fenster läuft normal ab (`st.state` ist `sperre`).

### Selbstlöschende Störungen

Bei `cfg`, `uhr`, `sensor`, `wasser` und `temp` genügt es, die Ursache zu beseitigen; der nächste Takt räumt den Code weg. Bei `alt` lohnt ein Blick auf den Zeitplan: `bw_main` hat seit mehr als `jobAge` Minuten keinen Auftrag mehr geschrieben.

```bash
curl -s http://<ip>/rpc/Schedule.List             # eigene Einträge: 0 */15 * * * * (bw_main), 30 0 8,20 * * * (bw_pump), 0 8 8,20 * * * (Sicherheits-Aus)
node tools/hwtest.js <ip> status                   # Einzeiler: laufende Scripts, Sensoren, Switch
node tools/hwtest.js <ip> normal 30                # Installer neu laufen lassen: baut den Zeitplan und prüft ihn danach
```

Die Zeitplan-IDs vergibt das Gerät; der Installer erkennt seine Einträge an `Script.Start` auf `bw_main`/`bw_pump` und `Switch.Set` auf den Pumpenausgang. Es sind drei Einträge, wenn `winA` und `winB` dieselbe Minute haben (Standard 08:00/20:00), sonst bis zu fünf.

## Von Hand gießen

Ein Handauftrag ist ein normaler `job`, den `bw_pump` innerhalb von `jobAge` Minuten abholt. Mit `pct` läuft der ganze Regelkreis (Frischmessung, Portionen bis `pctOk`, Lernwert); mit `"pct":null` pumpt `bw_pump` genau eine Einzelportion `clamp(sec, 1, min(tPmax, tMax))` ohne Messung und ohne Lernwert – so arbeitet auch der Hardware-Test.

1. Unixzeit holen: `curl -s http://<ip>/rpc/Sys.GetStatus` → Feld `unixtime`.
2. Auftrag schreiben (Wert ist ein JSON-String, deshalb die Anführungszeichen mit `\"`):

   ```bash
   curl -s -X POST http://<ip>/rpc/KVS.Set -d '{"key":"job","value":"{\"ok\":true,\"sec\":25,\"pct\":30,\"why\":\"hand\",\"ts\":<unixtime>}"}'
   ```

3. `bw_pump` starten: Web-UI → Scripts → `bw_pump` → Start, oder `curl -s -X POST http://<ip>/rpc/Script.Start -d '{"id":<id>}'` (ID aus `node tools/hwtest.js <ip> scripts`). Am besten kurz nach einem Takt (Sekunde 30), denn `bw_pump` bekommt nur die Frist bis zum nächsten Takt – sonst `why=zeit`.
4. Konsole lesen: `Fenster: Auftrag 25 s …`, Portionszeilen, `ergebnis=`.

Auch die Einzelportion zählt als Fenster: `day.n` + 1, `day.sec` + Sekunden, danach Pause ab `st.ts`. Liegt die Frischmessung schon bei `pctOk`, gibt es keine Gabe (`why=feucht`). Steht noch ein Claim `st.why=laeuft`, der jünger als `jobAge` ist, meldet `bw_pump` `Fenster abgebrochen (laeuft) – kein Auftrag`.

## Werte ändern

Alle `cfg1..4`-Felder lassen sich jederzeit im KVS ändern; die Scripts lesen sie bei jedem Start. `KVS.Set` ersetzt den ganzen Eintrag – in der Web-UI mit „Format as JSON“ nur das Feld ändern, per RPC das vollständige Objekt schreiben (ein Teilobjekt lässt Pflichtfelder fehlen → `err=cfg`; der Installer ergänzt sie wieder mit Startwerten). Was ein Feld bewirkt: [03 · Konfiguration](03-konfiguration.md).

| Geändert | Danach |
| --- | --- |
| `tick`, `winEvery`, `winA`/`winB`, `tWin`, `tTail` | Installer starten – er baut den Zeitplan neu (Takt, Fenster bei Sekunde 30, Sicherheits-Aus 30 + `tWin` + 10 s aufgerundet) |
| `tMax` | Installer starten – `auto_off` = `tMax` + 10 s (Startwert <!-- def:cfg3.tMax -->180<!-- /def --> + 10 = 190 s) |
| Zielband `cfg2`, Pausen, `maxDay`, `dryDay`, `tHot` | nichts – wirkt ab dem nächsten Takt |
| `vDry`/`vWet` (`cfg1`) | die Prozentskala verschiebt sich: `lrn.effW` löschen (Rückfall auf `tStd` <!-- def:cfg3.tStd -->70<!-- /def --> s) oder `kal write` wiederholen ([12 · Erstinbetriebnahme](12-erstinbetriebnahme.md)) |
| `tDead`, `tDead2`, `tPmin`, `tSoak`, `tStab` | vorher ein Messlauf `node tools/hwtest.js <ip> mess 10 1` – Zeitwerte nie aus dem Bauch |

Der Installer bricht ab, solange `bw_main` oder `bw_pump` läuft. `node tools/hwtest.js <ip> normal 30` wartet deshalb einen sicheren Moment ab (Sekunde 8–30, nicht in den 9 min nach `winA`/`winB`, kein Betriebs-Script läuft), startet `bw_install` und prüft danach Zeitplan, `cfg3`/`cfg4` und `auto_off`.

Der erste `Schedule.Create` eines Laufs wird vom Gerät gelegentlich mit „timespec validation“ abgelehnt; der Installer wiederholt ihn bis zu dreimal, die erste Ablehnung stumm. Erst eine zweite erscheint als `Hinweis: Schedule.Create '…' abgelehnt (…), Versuch 2/3`; nur eine Zeile `Schedule.Create '…': …` ohne „Hinweis“ heißt, dass ein Eintrag fehlt (`normal` meldet dann `ABWEICHUNG`).

```text
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] Zeitplan: 3 Einträge, davon eigene: 3
[bw_install 0.1.3] Switch 0: auto_off 190 s
[bw_install 0.1.3] KVS neu angelegt: keine
[bw_install 0.1.3] Zeitplan #4: 0 */15 * * * *
[bw_install 0.1.3] Zeitplan #5: 30 0 8,20 * * *
[bw_install 0.1.3] Zeitplan #6: 0 8 8,20 * * *
[bw_install 0.1.3] fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach
```

(Konsole des Installers im Mock, `node tools/run-script.js scripts/bw_install.js --seed`, 15.09.2026; am Gerät stehen andere Script- und Zeitplan-IDs, und ergänzte Felder erscheinen als `KVS cfg3 ergänzt: …`.)

## Update der Scripts

### Jede neue Version

Stand der Scripts: `bw_install` <!-- fact:ver.bw_install -->0.1.3<!-- /fact -->, `bw_main` <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, `bw_pump` <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, `bw_zeitraffer` <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact -->; Werkzeuge `hwtest.js` <!-- fact:ver.hwtest -->0.1.2<!-- /fact -->, `put-script.js` <!-- fact:ver.put-script -->0.1.2<!-- /fact -->, `console.js` <!-- fact:ver.console -->0.1.0<!-- /fact -->.

Kompakt-Ausgabe: `bw_main` <!-- fact:dist.bw_main -->15 791<!-- /fact --> B, `bw_pump` <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B (Grenze <!-- fact:size_limit -->16 000<!-- /fact --> B, für `bw_pump` <!-- fact:size_limit_pump -->18 000<!-- /fact --> B).

1. Quelle aktualisieren (`git pull`), `npm test` und `npm run build` – nur `dist/` kommt aufs Gerät.
2. Script-IDs und Flash ansehen: `node tools/hwtest.js <ip> scripts` (`fs_free`; `put-script.js` prüft ihn vor jedem Upload).
3. Außerhalb der Fenster hochladen, ein Script je Aufruf: `node tools/put-script.js <ip> <id> dist/bw_pump.js` (stoppt das Script, sendet in Stücken, lädt zurück und vergleicht byteidentisch). Die Reihenfolge ist wassersicher: `bw_main` und `bw_pump` müssen am Ende dieselbe Version haben.
4. Alle Scripts prüfen: `node tools/verify-scripts.js <ip>`.
5. Installer: `node tools/hwtest.js <ip> normal 30` – ergänzt neue cfg-Felder mit Startwerten, baut Zeitplan und `auto_off` neu und prüft das Ergebnis.
6. Ersten Takt lesen: `err=-`. Steht `err=cfg`, fehlt ein Pflichtfeld (Konsole nennt es; Installer nicht gelaufen) oder ein Bandfeld in `cfg2` ist noch `null` (nur `why=cfg err=cfg`).

> **Achtung (Wasser/Strom):** `put-script.js` stoppt das Script vor dem Upload. Ein Upload von `bw_pump` während eines Fensters bricht die Gabe ab (`st.why=laeuft` bleibt stehen, die Pumpe geht über `toggle_after` aus). Zwischen 08:00 und 08:09 sowie 20:00 und 20:09 nichts hochladen.

### Migration 0.1.x → 0.2.0

Seit 0.2.0 gießt `bw_pump` in Portionen mit Nachmessen (`cfg4`), `bw_main` schreibt nur den Auftrag, kontrolliert `soak` min später und führt die Trockenphase. Am Gerät am 13.09.2026 durchgeführt ([19 · Prüfprotokoll](19-pruefprotokoll.md)).

1. Flash freiräumen: Test-Scripts (`engine_probe`, `bw_hwtest`, `bw_hwpump`) mit `node tools/hwtest.js <ip> delete <id|name>` löschen – am 13.09.2026 stieg `fs_free` dadurch von 12 288 auf 49 152 B. Bei Bedarf legt `preflight hw` sie später wieder an.
2. `npm run build`, dann `dist/bw_pump.js`, `bw_main.js`, `bw_install.js`, `bw_zeitraffer.js` mit `put-script.js` hochladen; `node tools/verify-scripts.js <ip>`.
3. Handwerte im KVS (Beispielband am Gerät, in Bandordnung `pctDry` 28 < `pctLo` 40 < `pctOk` 50 ≤ `pctSoll` 55 < `pctHi` 60): `cfg2` → `pctOk` 50, `pctHi` 60, `pctDry` 28, `effMax` 30; `cfg3` → `tMax` 180 (jetzt Summe je Fenster), `tMin` 25; `lrn` → `sf` 0.7 (altes `eff` löschen) – der Installer ergänzt nur fehlende Felder, ein vorhandenes `sf` 1 bliebe stehen.
4. `node tools/hwtest.js <ip> normal 30`: der Installer ergänzt `cfg4`, `cfg3.dryDay`, `cfg2.dropW`/`sfUp` und `lrn.effW` (`null`), baut den Zeitplan mit Sicherheits-Aus `0 8 8,20 * * *` und setzt `auto_off` 190 s.

Bis `pctOk` eingetragen ist, gießt das System nicht (`why=cfg`). Jede Upload-Reihenfolge ist wassersicher: altes `st`/`lrn` wird toleriert, ein Auftrag ohne `pct` wird zur Einzelportion. Bleibt das alte Feld `lrn.eff` stehen, wird es ignoriert.

## Firmware-Update

Gemessen wurde bisher nur Firmware 2.0.0 (12./13.09.2026). Ob Scripts, KVS und Zeitplan ein Firmware-Update unverändert überstehen, ist nicht geprüft: `[TODO am Gerät]`. Deshalb vorher sichern und danach prüfen:

1. Vorher: `tools/kvs_dump.sh <ip> > sicherung.json` (unten), `node tools/hwtest.js <ip> scripts` (Versionen, Größen) notieren.
2. Update nur in einem sicheren Moment starten (nicht in den 9 min nach `winA`/`winB`, kein Script läuft): Web-UI → Settings → Firmware.
3. Danach: `node tools/verify-scripts.js <ip>` (Code byteidentisch?), `curl -s http://<ip>/rpc/Schedule.List` (drei eigene Einträge?), `curl -s "http://<ip>/rpc/Switch.GetConfig?id=0"` (`initial_state` off, `auto_off_delay` 190?).
4. Fehlt etwas: `node tools/hwtest.js <ip> normal 30` baut Zeitplan und Switch-Konfiguration neu; fehlende KVS-Einträge bekommen Startwerte, gesicherte Werte zurückspielen (unten).
5. Web-UI → Scripts → Konsole öffnen (schaltet den Debug-Websocket wieder ein) und den ersten Takt lesen: `err=-`.

## KVS sichern und zurückspielen

`tools/kvs_dump.sh <ip>` gibt die Seiten der `KVS.GetMany`-Antwort und den `Sys.GetStatus` (mit `kvs_rev`) aus; die Ausgabe in eine Datei umleiten ist die Sicherung. Sichern lohnt vor Firmware-Updates, vor der Deinstallation und nach der Kalibrierung (`cfg1`, `lrn.effW`).

```bash
tools/kvs_dump.sh <ip> > sicherung-2026-09-15.json          # alle Einträge als JSON-Strings, dazu Sys.GetStatus
curl -s -X POST http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctSoll\":55,\"pctLo\":40,\"pctHi\":60,\"pctDry\":28,\"hyst\":2,\"dropSlow\":4,\"effMin\":0.05,\"effMax\":30,\"alpha\":0.3,\"sfMin\":0.5,\"sfStep\":0.1,\"pctOk\":50,\"dropW\":null,\"sfUp\":0.05}"}'
```

Zurückspielen geht je Schlüssel mit `KVS.Set`: `value` ist der String aus der Sicherung (die inneren Anführungszeichen mit `\"`). Sinnvoll sind `cfg1`…`cfg4` und `lrn`; die Zustandseinträge `st`, `job`, `day`, `err` legt der Installer frisch an. Danach einmal `node tools/hwtest.js <ip> normal 30`, damit fehlende Felder ergänzt werden.

## Nach einem Stromausfall

- Der Pumpenausgang ist nach dem Neustart aus (`initial_state` off, setzt der Installer), und kein Script startet von selbst (`Script.SetConfig` `enable` false – nur der Zeitplan startet sie).
- Der Zustand liegt im KVS und überlebt den Ausfall: Pause, Lernwerte, `day` und `err` sind danach wie vorher.
- Der Zeitplan braucht eine gültige Uhrzeit. Ohne Internet bleibt `Sys.time` leer, der Zeitplan steht; ein von Hand gestartetes `bw_main` meldet `Störung uhr: Uhrzeit nicht gesetzt (kein NTP seit Neustart)` und `err=uhr`. Sobald NTP da ist, läuft alles weiter; `uhr` löscht sich beim nächsten Takt.
- Ein versäumtes Fenster wird nicht nachgeholt. Kommt der Strom kurz vor einem Fenster zurück, kann der Auftrag älter als `jobAge` sein → `why=alt`, `err=alt`; der nächste Takt schreibt den Auftrag neu und löscht den Hinweis.
- Fiel der Strom mitten im Fenster aus, bleibt der Claim `st.why=laeuft` stehen: die Pause läuft ab `st.ts`, es entsteht kein Lernwert, und ein Handstart innerhalb von `jobAge` Minuten gießt nicht.

Nach der Rückkehr genügt ein Blick auf den nächsten Takt (`err=-`) und `node tools/hwtest.js <ip> status`. Das Verhalten folgt aus Konfiguration und Code; der Stromausfall selbst (Prüfungen 15 und 16 im [19 · Prüfprotokoll](19-pruefprotokoll.md)) ist am Gerät noch nicht durchgespielt: `[TODO am Gerät]`.

## Zeitzone und Sommerzeit

- Die Fenster `winA`/`winB` sind Ortszeit: Der Zeitplan des Geräts läuft in der Zeitzone aus den Geräteeinstellungen (Web-UI → Settings → Timezone/NTP). Die Zeitplan-Einträge enthalten keine Zeitzone; eine geänderte Geräte-Zeitzone braucht keinen neuen Zeitplan.
- `bw_main` rechnet den lokalen Tag (Tageswechsel, `dryDay`) minutengenau aus `Sys.time` (HH:MM) und `unixtime`; `bw_pump` rechnet seine Frist aus `unixtime` und setzt dabei einen Zeitzonenversatz in Vielfachen von 15 Minuten voraus, was für alle Zeitzonen gilt.
- Die Pause rechnet in Unixzeit: `(now + 2·tick·60) − st.ts ≥ pause·3600`, Toleranz zwei Takte (30 min). Bei der Umstellung auf Sommerzeit liegt das Fenster, das sonst genau 24 h nach der letzten Gabe käme, nur 23 h danach – die Pause ist dann samt Toleranz noch nicht abgelaufen, dieses Fenster fällt aus, erst das folgende (12 h später) gießt wieder. Bei der Umstellung zurück (25 h) ändert sich nichts. Das folgt aus dem Code und wurde nicht am Gerät beobachtet: `[TODO am Gerät]`.

## Wartung

| Teil | Wann | Was tun | Danach im System |
| --- | --- | --- | --- |
| Behälter und Schwimmer | beim Nachfüllen | Behälter reinigen, Schwimmer auf Gängigkeit prüfen; er sitzt oberhalb des Pumpeneinlaufs | `lvl=0` in der Konsolenzeile (bei `lvlEmpty` 1); `err=wasser` löscht sich selbst |
| Pumpe, Ansaugsieb, Schlauch | bei sinkender Wirkung | Sieb reinigen, Schlauch auf Knicke und Luft prüfen | ein Messlauf `node tools/hwtest.js <ip> mess 10 1` zeigt `tRise` und Gewinn je Sekunde ([12 · Erstinbetriebnahme](12-erstinbetriebnahme.md)) |
| Tropfer | bei `effW`-Abfall, `stall` oder `noeff` | Tropfer freispülen oder tauschen; er muss über dem Sensor liegen | `lrn.effW` lernt in den nächsten Fenstern nach (`alpha` 0.3); nach `noeff` `err` löschen |
| Schlauch geändert oder verlängert | einmalig | Totzeit neu bestimmen: `mess`, dann `cfg3.tDead`/`tMin` und `cfg4.tDead2` setzen (`kal write` oder von Hand) | `tDead` <!-- def:cfg3.tDead -->20<!-- /def --> s ist der Startwert; am Testaufbau ergab `kal write` 8 s |
| Sensor SMT50 | umgesteckt oder gereinigt | Kalibrierpunkte neu messen (`bw_hwtest`, [11 · Hardware-Check](11-hardware-check.md)) | neue `vDry`/`vWet` verschieben die Prozentskala: `lrn.effW` löschen oder `kal write` wiederholen |
| Fühler DS18B20 | bei `err=temp` | Stecker und 1-Wire-Anschluss prüfen | Hitzeregel wieder aktiv, sobald `tC` einen Wert zeigt |
| Speicher | gelegentlich | `err.mem` über Tage vergleichen (wird täglich aktualisiert) | am 13.09.2026: Heap frei 25 200 B im Leerlauf, `mem_peak` von `bw_pump` 12 516 B |

Schlauch, Tropfer und Sensor bilden eine Messstrecke: Der Regelkreis misst nur am Sensor (nassester Punkt unter dem Tropfer). Weitere Tropfer am selben Verteiler werden blind mitversorgt und sollten baugleich sein.

## Vor dem Urlaub und im Winter

1. Behälter voll, Schwimmer auf VOLL (`lvl=0`). Je Tag sind höchstens `maxDay` × `tMax` = 2 × 180 = 360 Pumpensekunden möglich; die Fördermenge je Sekunde einmal mit Messbecher und `mess 10 1` bestimmen und den Vorrat danach bemessen: `[TODO am Gerät]`.
2. Letzte Konsolenzeilen lesen: `err=-`, `why` plausibel (`ok`, `pause`, `feucht`), `effW` gelernt (nicht `-`), `dauer` wie gewohnt.
3. Zeitplan steht (`Schedule.List`, drei eigene Einträge) und die Uhrzeit ist gesetzt (`Sys.GetStatus` → `time`).
4. `dryDay` <!-- def:cfg3.dryDay -->5<!-- /def --> (Freitag) bewusst lassen: die Trockenphase ist die Staunässe-Bremse; wer sie nicht will, setzt `null` (kein Installer nötig).
5. Hitze: über `tHot` <!-- def:cfg3.tHot -->35<!-- /def --> °C gilt nur `pauseHot` <!-- def:cfg3.pauseHot -->12<!-- /def --> h, also beide Fenster – der Verbrauch verdoppelt sich, die Grenze `maxDay` × `tMax` bleibt.
6. KVS sichern (`kvs_dump.sh`), damit Kalibrierung und Lernwerte nach einem Gerätetausch zurückkommen.

Winter: Die Software kennt keine Frostsperre (offene Konzeptfrage; die Temperatur wirkt nur über `tHot`). Draußen Behälter, Schlauch und Pumpe frostfrei halten oder den Betrieb sauber stoppen: Behälter leeren – `why=wasser`, `err=wasser`, keine Gabe, Messung läuft weiter, und mit dem ersten Nachfüllen geht es ohne Handgriff weiter. Innen ändert sich nichts: gegossen wird nach Feuchte, nicht nach Kalender.

## Deinstallation

1. Stoppen: `node tools/hwtest.js <ip> stop` (Not-Aus: `Script.Stop` für `bw_pump` und die Test-Scripts, `Switch.Set` aus) – am besten außerhalb der Fenster.
2. KVS sichern, falls Kalibrierung und Lernwerte wiederverwendet werden sollen (`tools/kvs_dump.sh <ip> > sicherung.json`).
3. Zeitplan: `curl -s http://<ip>/rpc/Schedule.List`, dann je eigenen Eintrag `curl -s -X POST http://<ip>/rpc/Schedule.Delete -d '{"id":<id>}'` (oder Web-UI → Schedules).
4. KVS: je Schlüssel `curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"cfg1"}'` für `cfg1`, `cfg2`, `cfg3`, `cfg4`, `lrn`, `st`, `job`, `day`, `err`; falls vorhanden auch `zr`, `zrb1`…`zrb5`, `hwt`, `hwr`, `hwp`, `hwc`, `hwb1`, `hwb2`.
5. Scripts: gestoppt per RPC löschen, `curl -s -X POST http://<ip>/rpc/Script.Delete -d '{"id":<id>}'` (`hwtest.js delete` weigert sich bei Betriebs-Scripts, deshalb direkt per RPC).
6. Switch: `curl -s -X POST http://<ip>/rpc/Switch.SetConfig -d '{"id":0,"config":{"auto_off":false}}'`, wenn der Ausgang anders genutzt wird; `initial_state` off darf bleiben.
7. Pumpe und Netzteil stromlos, Behälter leeren, Sensor trocknen. Arbeiten an 230 V nur durch eine Elektrofachkraft ([04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md)).

## Beispielausgabe

> **Am Gerät gemessen (13.09.2026):** vier Takte von `bw_main` rund um Fenster 1 des Zeitraffer-Fahrplans (Takt <!-- zr:cfg3.tick -->3<!-- /zr --> min, `pause` <!-- zr:cfg3.pause -->0.2<!-- /zr --> h), Uhrzeiten 15:51, 15:57, 16:00 und 16:03.

```text
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
[bw_main 0.2.0] Kontrolle: 50.5 → 53.7 % sf=0.7
[bw_main 0.2.0] V=1.82 pct=53.7 tC=23.6 lvl=0 st=sperre dry=1 pause=0.2h why=pause sec=- effW=2.006 sf=0.7 err=- w=2 dauer=5385ms
[bw_main 0.2.0] V=1.91 pct=56.871 tC=23.6 lvl=0 st=sperre dry=1 pause=0.2h why=pause sec=- effW=2.006 sf=0.7 err=- w=0 dauer=4426ms
[bw_main 0.2.0] V=1.897 pct=56.401 tC=23.6 lvl=0 st=beob dry=1 pause=0.2h why=feucht sec=- effW=2.006 sf=0.7 err=- w=2 dauer=5343ms
```

So liest man das: 15:51 misst der Takt 10,8 % unter `pctLo` 40, kein Lernwert (`effW=-`), Auftrag `tStd` 12 s (`why=ok sec=12`, `w=3`: `job`, `lrn` (Tagesmaximum `tMaxD`), `day`). Das Fenster 15:54:30 hebt die Feuchte auf 50,5 % und lernt `effW` 2,006 ([02 · Flussdiagramm](02-flussdiagramm.md)). 15:57 folgt die Kontrolle: 53,7 % liegt unter `pctHi + hyst`, kein `zuviel`; danach `st=sperre why=pause`, `w=2` (`st` und `job`).

16:00 ändert sich nichts (`w=0`). 16:03 ist die Pause samt Toleranz von zwei Takten vorbei: `st=beob`, aber 56,4 % ist nicht unter `pctLo` 40, also `why=feucht` – kein Auftrag, `w=2` (`st` und `job`). `err=-` in allen vier Zeilen: keine Störung. Im Normalbetrieb stünde hier `pause=24h` und `dauer` bleibt bei etwa 5 s.

Der Handstart ohne Auftrag sieht so aus (Mock, `node tools/run-script.js scripts/bw_pump.js --seed`, 15.09.2026):

```text
[bw_pump 0.2.0] kein Auftrag
[bw_pump 0.2.0] ergebnis=kein_auftrag n=0 sec=0 dur=0 pct=null→null effW=null sf=0.7 day.n=0 err=null w=0 dauer=280
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `why=pause`, obwohl nichts gegossen wurde | Claim `st.why=laeuft` steht: Fenster abgebrochen (Absturz, Stop, Strom) – die Pause hält | `st` lesen; die Pause läuft normal ab, ein Handstart binnen `jobAge` gießt nicht |
| `err=cfg` nach einem Update | Pflichtfeld fehlt (Installer nicht gelaufen) oder ein Bandfeld (`pctOk`, `dropSlow`) ist noch `null` | Pflichtfeld: Konsole nennt es (`Störung cfg: cfg3.tick fehlt`; ein `cfg4`-Feld meldet erst `bw_pump` im Fenster) → `hwtest.js <ip> normal 30`; Bandfeld: nur `why=cfg err=cfg` ohne Feldname → `cfg2` lesen und eintragen |
| `err=alt`, kein Fenster mehr | `bw_main` läuft nicht: Zeitplan weg, Uhrzeit ungültig oder Script gestoppt | `Schedule.List`, Konsole; Installer neu laufen lassen |
| Handstart: `kein Auftrag` oder nur `ergebnis=kein_auftrag` | `job.ok` ist `false`, `sec` fehlt oder < 1, oder ein Claim `laeuft` ist jünger als `jobAge` (fehlt `ts`, kommt stattdessen `Störung alt: Auftrag zu alt`) | `job` mit `ok:true`, `sec`, `ts` = jetzt neu schreiben |
| Handstart endet sofort mit `zeit` | Frist bis zum nächsten Takt reicht nicht für Portion 1 samt Messzeit | kurz nach einem Takt starten (Sekunde 30) |
| `watch`/`console.js` zeigen nichts | Debug-Websocket aus, oder `watch` endet im Normalbetrieb nach Sekunden (nur Test-Scripts halten es offen) | Web-UI → Konsole öffnen; echtes Fenster mit `node tools/console.js <ip> 900` mitlesen – vor dem Start verbinden, sonst fehlt die erste Zeile |
| Web-UI zeigt `[object Object]` | KVS-Werte sind JSON-Strings | „Format as JSON“ anhaken |
| Nach `KVS.Set` fehlen Felder | `KVS.Set` ersetzt den ganzen Eintrag | ganzes Objekt schreiben oder Installer starten (ergänzt Startwerte) |
| Installer: `ABBRUCH: Script bw_main läuft – später erneut starten` | Takt oder Fenster läuft gerade | `hwtest.js <ip> normal 30` wartet den sicheren Moment ab |
| Installer: `Hinweis: Schedule.Create '…' abgelehnt (…), Versuch 2/3` | die Firmware weist den ersten `Schedule.Create` sporadisch ab; der Installer wiederholt | nichts, solange am Ende alle Einträge stehen (`Zeitplan #<id>: …`); sonst `normal 30` erneut |
| Konsole: `Timer 1 handle not found`, `PCS write interval < 60s` | Firmware-Hinweise beim Timer-Aufräumen und beim Schaltzähler | harmlos, kein Handgriff |
| `put-script.js`: `Flash zu voll` | zu wenig `fs_free` für die neue Datei | Test-Scripts löschen (`hwtest.js <ip> scripts`, `delete <id>`) |
| dauernd `why=feucht`, die Erde wirkt trocken | Sensor liegt nicht unter dem Tropfer oder das Band passt nicht zur Kalibrierung | Sensorlage prüfen, Band neu bestimmen ([12 · Erstinbetriebnahme](12-erstinbetriebnahme.md)) |
| `err=noeff` nach Umbau von Schlauch oder Tropfer | Wasser kommt nicht am Sensor an | Wasserweg prüfen, `err` löschen, Totzeit per `mess` nachmessen |

## Weiter zu

- [14 · Debuggen und Testen](14-debuggen-und-testen.md) – Mock, Tests, Konsole und die vollständige Werkzeug-Referenz
- [03 · Konfigurations-Zusammenspiel](03-konfiguration.md) – jedes Feld: Startwert, Wirkung, wann der Installer neu laufen muss
- [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md) – Messlauf, Kalibrierlauf und `kal write` nach Umbauten; Praxistest im Zeitraffer, um alles einmal in 45 Minuten zu sehen
- [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md) – warum die Pumpe auch ohne Script ausgeht
