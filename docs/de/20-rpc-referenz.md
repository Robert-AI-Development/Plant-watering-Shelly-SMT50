# 20 · RPC- und Engine-Referenz

**Deutsch** · [English](../en/20-rpc-referenz.md) — [Handbuch](README.md) · Teil F „Entwicklung“

> **Auf einen Blick**
> - Regel: vor jedem neuen `Shelly.call` hier nachschlagen – und die Tabelle ergänzen (Parameter, Antwort, wer ruft, Doku-Link). Jeder Aufruf ist gegen die Gen2-Doku geprüft, Stand 0.2.0 (13.09.2026); Basis-URL `https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/<Komponente>`.
> - 27 RPC-Methoden in Scripts und Werkzeugen, sieben Funktionen der Script-API. Jedes Script hält höchstens einen `Shelly.call` und einen Timer offen (Gerätegrenze je 5).
> - Engine-Fakten mit Messdatum: 12 Stack-Ebenen laufen, 14 stürzen ab (Mock-Grenze <!-- fact:call_depth -->10<!-- /fact -->); ein Script-Heap von etwa 25 KB für alle Scripts; mJS hoistet nicht und kennt kein `shift`; Kompakt-Code höchstens <!-- fact:size_limit -->16 000<!-- /fact --> B je Script, `bw_pump` <!-- fact:size_limit_pump -->18 000<!-- /fact --> B.
> - Größter Stolperstein: die Firmware-Meldung „Failed validation“ beim ersten `Schedule.Create` eines Installer-Laufs ist falsch – der Installer wiederholt den Aufruf stumm.

## Voraussetzungen

- keine – ein Nachschlagekapitel. Die Regeln selbst (was in `scripts/*.js` verboten ist, wie die Schrittkette gebaut wird) stehen in [CLAUDE.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/CLAUDE.md) und werden von [`tools/test/syntax.test.js`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/tools/test/syntax.test.js) erzwungen; hier stehen die Fakten und Messwerte dahinter.
- Was die Grenzen für den Betrieb bedeuten, erklärt [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md); die Werkzeuge, mit denen man sie misst, [14 · Debuggen und Testen](14-debuggen-und-testen.md).

## Diagramm

[![Sequenz: bw_pump im Gießfenster – Script.Start vom Zeitplan, neun KVS.Get, Uhr synchron, Claim per KVS.Set, Switch.Set mit toggle_after, Messungen je tChk und tStep, Neulesen, KVS.Set nur für Geändertes, Script.Stop](../diagramme/de/20-rpc-referenz.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/20-rpc-referenz.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/20-rpc-referenz.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Lesen: Script.Start, KVS.Get ×9“, 2 „Portion: Claim, Switch.Set, Messen“, 3 „Schreiben und Ende“.

Das Diagramm zeigt `bw_pump` <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, das Script, das RPC-Aufrufe, synchrone Lesungen und einen Timer in einem Fenster verbindet, in der Reihenfolge seiner Schrittkette: Lesen (Schritte 1–3), Fenster als Tick-Automat (Schritt 4), Neulesen, Ergebnis, Schreiben und Ende (Schritte 5–8). Durchgezogene Pfeile sind `Shelly.call`-Aufrufe (asynchron, immer nur einer offen), gestrichelt sind alle synchronen Lesungen über `Shelly.getComponentStatus` (Uhr, Frischmessung `m0`, Kontrollen je `tChk`/`tStep`). Die Rückgaben stehen als Return-Pfeile: `value` als JSON-String, `was_on`, `etag`/`rev`.

## RPC-Aufrufe über Shelly.call

Alle Aufrufe laufen über `Shelly.call(method, params, callback, userdata)`; die Werkzeuge in `tools/` rufen dieselben Methoden per HTTP (`POST http://<ip>/rpc/<Methode>` mit JSON-Body; `console.js` und `kvs_dump.sh` per `GET …?param=wert`). Die Spalte „Genutzt von“ nennt Script oder Werkzeug; die Spalte „Doku“ verlinkt die Komponente unter der Basis-URL. Die Tabellen sind nach Komponente geteilt, damit keine Zelle länger als nötig wird.

### KVS

| Aufruf | Parameter | Antwort | Genutzt von | Doku |
| --- | --- | --- | --- | --- |
| `KVS.GetMany` | `match` (Standard `*`), `offset` | `items`, `offset`, `total` – paginiert: weiterlesen, bis `offset + Anzahl ≥ total`. `items` ist am Gerät ein Array aus `{key, etag, value}` (Probe 12.09.2026); die Doku beschreibt ein Objekt `key → {etag, value}` – nur `bw_zeitraffer` liest beide Formen, `bw_main`, `bw_install`, `bw_hwtest`, `bw_hwpump` erwarten das Array | `bw_main`, `bw_install`, `bw_zeitraffer`, `bw_hwtest`, `bw_hwpump`, `tools/kvs_dump.sh` | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Get` | `key` | `etag`, `value`; Fehler `-105`, wenn der Schlüssel fehlt (im Script → `null`) | `bw_pump`: Kette über genau neun Schlüssel `cfg1 cfg2 cfg3 cfg4 lrn st job day err` (Treiber `getNext()`) statt `GetMany "*"`, damit keine `hw*`/`zrb*`-Strings im Heap liegen; nach dem Fenster Neulesen von `st day job err lrn`. `bw_hwtest`, `bw_hwpump`: Kommandokanal `hwc` alle `nCmd` <!-- hwt:nCmd -->2<!-- /hwt --> Ticks. `tools/hwtest.js` | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Set` | `key`, `value` – immer ein JSON-String (`JSON.stringify`), optional `etag` | `etag`, `rev` | alle Scripts, nur bei Änderung. `bw_pump` schreibt vor der ersten Portion eines geregelten Fensters den Claim `st` mit `why:"laeuft"` (scheitert er → `why=kvs`, keine Gabe; die Einzelportion schreibt keinen Claim) und am Ende nur geänderte Einträge; `tools/hwtest.js` (`cfg`, `start`, `go`/`skip`/`abort`, `restore`, `kal write`) | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Delete` | `key` | `rev`; `-105`, wenn der Schlüssel fehlt | `bw_install` (Marke `zr`, Sicherung `zrb1`…`zrb5`; `-105` bei älterer Sicherung ohne `zrb4`/`zrb5` wird ignoriert), `bw_hwpump` (`hwb1`/`hwb2` nach dem Rückbau), `tools/hwtest.js start` (alter Bericht `hwr`/`hwp`), `restore`/`cleanup`, Mensch (`err` löschen) | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |

> **Hinweis:** `KVS.Set` ersetzt den ganzen Eintrag. Ein Teilobjekt von Hand (etwa nur `{"pctLo":40}`) löscht alle anderen Felder – deshalb in der Web-UI „Format as JSON“ nutzen und nach einer Handänderung den Installer erneut starten; er ergänzt fehlende Felder mit dem Startwert ([03 · Konfiguration](03-konfiguration.md)).

### Zeitplan (Schedule)

| Aufruf | Parameter | Antwort | Genutzt von | Doku |
| --- | --- | --- | --- | --- |
| `Schedule.Create` | `enable`, `timespec` (5, 6 oder 7 Cron-Felder), `calls[] {method, params}` | `id`, `rev` | `bw_install`. Der erste Create je Lauf scheitert am Gerät reproduzierbar (deterministisch, Gerätelauf 12./13.09.2026) mit „Invalid argument 'timespec': Failed validation!“ – Wiederholung bis `CRETRY_MAX` 3 nach `CRETRY_MS` 400 ms, die erste Ablehnung stumm, erst die zweite als `Hinweis:` in der Konsole | [Schedule](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule) |
| `Schedule.List` | – | `jobs[] {id, enable, timespec, calls[]}`, `rev` | `bw_install` (eigene Einträge erkennen: `Script.Start` auf `bw_main`/`bw_pump` oder `Switch.Set` auf `cfg1.idSw`), `tools/hwtest.js` (`verifyState` nach `normal`/`zeitraffer`) | [Schedule](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule) |
| `Schedule.Delete` | `id` | `rev` | `bw_install` (eigene Einträge vor dem Neuanlegen) | [Schedule](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule) |

Der Installer legt drei Einträge an, wenn `winA` und `winB` dieselbe Minute haben, sonst bis zu fünf; die IDs vergibt das Gerät, die Konsole meldet `Zeitplan #<id>: <timespec>`. Diese Timespec-Formen hat das Gerät angenommen:

```text
# Stand 0.2.0 (Installer v0.1.3) – am Gerät angenommen 13.09.2026, FW 2.0.0
0 */15 * * * *                           bw_main alle 15 min (cfg3.tick)
30 0 8,20 * * *                          bw_pump um 08:00:30 und 20:00:30 (PUMP_SEC 30, nie neben bw_main)
0 8 8,20 * * *                           Sicherheits-Aus: SAFE_MIN = aufgerundet (30 + tWin + 10) s = 8 min nach der Fensterminute
0 */3 * * * *   30 */6 * * * *           Zeitraffer: Takt 3 min, Fenster alle 6 min
40 2,8,14,20,26,32,38,44,50,56 * * * *   Zeitraffer: Sicherheits-Aus 160 s nach jeder Fensterminute (Minutenliste mit Sekundenfeld)
# Historie 0.1.3 (nur noch als Beleg, dass das Gerät diese Formen nimmt; 13.09.2026)
0 5 8,20 * * *                           Sicherheits-Aus damals bei Minute 5
0 * * * * *   0 */2   15 */2   30 */2   45 */2 * * * *   Zeitraffer 0.1.3: Sekundenfeld ungleich 0 und * in der Minute
```

Die Minutenliste mit Sekundenfeld war bis zum Gerätelauf am 13.09.2026 offen und wurde dort beim ersten Versuch angenommen (Zeitplan des Zeitraffers, [19 · Prüfprotokoll](19-pruefprotokoll.md)).

### Script

| Aufruf | Parameter | Antwort | Genutzt von | Doku |
| --- | --- | --- | --- | --- |
| `Script.List` | – | `scripts[] {id, name, enable, running}` | `bw_install` (IDs per Name; Abbruch mit `err.code = "cfg"`, wenn `bw_main`/`bw_pump` läuft), `bw_zeitraffer` (ID von `bw_install`; kein Betriebs- oder Test-Script darf laufen), `bw_hwpump` (ID von `bw_pump`, Zahl laufender Scripts), `tools/hwtest.js`, `tools/verify-scripts.js` | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.Start` | `id` | `was_running` | Zeitplan (`bw_main`, `bw_pump`); `bw_hwpump` → `bw_pump` (beendet sich danach: geteilter Heap); `bw_zeitraffer` → `bw_install` (`K` vorher freigegeben); `tools/hwtest.js`, `tools/console.js` | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.Stop` | `id` | `was_running` | alle Scripts auf die eigene ID (`Shelly.getCurrentScriptId()`); `tools/hwtest.js stop` (Not-Aus), `tools/put-script.js` vor dem Upload | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.SetConfig` | `id`, `config {enable}` – `enable` ist der Autostart beim Boot | `restart_required` | `bw_install`: `enable` false für `bw_main` und `bw_pump`, der Zeitplan startet sie. Die Test-Scripts stehen nie im Zeitplan und starten nur von Hand | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.GetStatus` | `id` | `running`, `mem_used`, `mem_peak` (nur während des Laufs), `mem_free` (freier Script-Heap, für alle Scripts gleich), `cpu`, `errors[]` (z. B. `"out_of_memory"`, bleibt bis zum nächsten Lauf stehen), `error_msg` | `tools/hwtest.js` (`watch`, `status`, `scripts`): im Zeitraffer `mem_used`/`mem_peak` von `bw_main` und `bw_pump` in der Statuszeile | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.Create` | `name` | `id` | `tools/hwtest.js preflight` (legt `bw_zeitraffer` an, mit `preflight hw` auch `bw_hwtest`/`bw_hwpump`) | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.Delete` | `id` | `{}` – das Script muss gestoppt sein | `tools/hwtest.js delete <id\|name>` (nie ein Betriebs-Script; zeigt `fs_free` vorher/nachher); vor dem Upload von 0.2.0 wurden so `engine_probe`, `bw_hwtest`, `bw_hwpump` entfernt (13.09.2026) | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.PutCode` | `id`, `code` (String), `append` (true = anhängen) | `len` (Gesamtlänge in Byte) | `tools/put-script.js`: Upload in 1024-Zeichen-Stücken, Script vorher gestoppt, `fs_free` vorher geprüft | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.GetCode` | `id`, `offset`, `len` | `data`, `left` (Rest in Byte) | `tools/verify-scripts.js` und `put-script.js`: Code komplett laden (in Stücken bis `left` 0) und byteidentisch mit `dist/` vergleichen. Kurzform `len=1` → `left + 1` = Dateigröße (`hwtest.js preflight`/`scripts`) | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |

> **Am Gerät gemessen (13.09.2026):** `Script.GetStatus.mem_free` im Leerlauf 24 920 B (Etappe 10: 25 200 B), für jedes Script derselbe Wert – der Heap ist geteilt. `bw_pump` im Fenster `mem_used` 10 360–10 500, `mem_peak` 12 516; `bw_main` beim Parsen 5 348 B, je Takt `mem_used` 13 216 / `mem_peak` 16 380 (v0.1.2 mit 14 KVS-Einträgen). Abnahme Etappe 10: 12 516 + 5 348 < 25 000.

### Switch

| Aufruf | Parameter | Antwort | Genutzt von | Doku |
| --- | --- | --- | --- | --- |
| `Switch.Set` | `id`, `on`, optional `toggle_after` (s) | `was_on` | `bw_pump`: je Portion `on:true, toggle_after: sec` (höchstens `cfg4.tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s; `was_on === true` → Fensterende `extern`), nach jeder Portion und bei Abbruch `on:false`. Zeitplan (Sicherheits-Aus), `bw_hwpump` nur `on:false` (Fehlerfall), `tools/hwtest.js stop` und `mess` (Pulse bis 10 s) | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |
| `Switch.SetConfig` | `id`, `config {initial_state, auto_off, auto_off_delay}` | `restart_required` | `bw_install`: `initial_state "off"`, `auto_off` true, `auto_off_delay = tMax + 10` = 190 s bei `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> – wirkt je Einschaltbefehl, deckt also jede Portion ab | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |
| `Switch.GetStatus` | `id` | `output`, `timer_started_at`, `timer_duration`, `source` | `bw_pump`, `bw_hwpump` (synchron: ist der Ausgang EIN?), `tools/hwtest.js` (Statuszeile, `mess`, `kal`) | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |
| `Switch.GetConfig` | `id` | `initial_state`, `auto_off`, `auto_off_delay`, `auto_on`, `auto_on_delay` | `tools/hwtest.js` (`verifyState`: `auto_off_delay` muss `tMax + 10` sein) | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |

### Sys, Sensoren und Eingang

| Aufruf | Parameter | Antwort | Genutzt von | Doku |
| --- | --- | --- | --- | --- |
| `Sys.GetStatus` | – | `time` (HH:MM lokal, `null` ohne NTP), `unixtime` (UTC, `null` ohne NTP), `ram_free`, `kvs_rev` (Zähler aller Schreibvorgänge), `uptime`, `fs_free` (freier Flash in Byte) | alle Scripts außer `bw_zeitraffer` synchron über `Shelly.getComponentStatus("sys")` (Uhr, `ram_free` → `err.mem` bzw. `hwr.mem`/`hwp.mem`); `tools/hwtest.js` (`preflight`, sicherer Moment), `put-script.js` (`fs_free` vor dem Upload), `kvs_dump.sh` (`kvs_rev`) | [Sys](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Sys) |
| `Sys.GetConfig` | – | u. a. `debug.websocket.enable`, `location.tz` | `tools/hwtest.js preflight` (ist der Debug-Websocket an?) | [Sys](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Sys) |
| `Voltmeter.GetStatus` | `id` (hier 100) | `voltage` (V, `null` bei Fehler), `errors[]` | `bw_main`, `bw_pump`, `bw_hwtest` (synchron); `tools/hwtest.js` (`mess`, `kal`, Statuszeile) | [Voltmeter](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Voltmeter) |
| `Temperature.GetStatus` | `id` (hier 100) | `tC` (`null` bei Fehler), `tF`, `errors[]` | `bw_main`, `bw_hwtest` (synchron); `tools/hwtest.js` | [Temperature](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Temperature) |
| `Input.GetStatus` | `id` (hier 1) | `state` (bool bei Typ `switch`; `null`, wenn der Eingang deaktiviert ist – Gerät 12.09.2026), `errors[]` | `bw_main`, `bw_pump`, `bw_hwtest`, `bw_hwpump` (synchron); `tools/hwtest.js` | [Input](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Input) |
| `Input.GetConfig` / `Input.SetConfig` | `id`; `config {enable, type ("switch"), invert}` | Konfiguration bzw. `restart_required` | `tools/hwtest.js preflight` / `input-on` (Eingang 1 als Typ `switch` aktivieren – die einzige Konfigurationsänderung des Werkzeugs, nur auf Zuruf) | [Input](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Input) |

## Limits laut Doku und gemessen

| Grenze | Laut Doku | Am Gerät (Datum) | Folge im Projekt |
| --- | --- | --- | --- |
| Zeitplan | 20 Einträge, 5 Aufrufe je Eintrag; Timespec 5, 6 oder 7 Felder (6 = Sekunde Minute Stunde Tag Monat Wochentag) | Sekundenfeld ungleich 0, `*` in der Minute und Minutenliste mit Sekundenfeld angenommen (13.09.2026) | Installer: 3 bis 5 Einträge, `bw_pump` bei Sekunde 30 |
| KVS | 50 Schlüssel, Schlüssel ≤ 42 Zeichen, Wert ≤ 253 Zeichen | `KVS.GetMany` liefert 11 Einträge je Seite, Mock 5 (13.09.2026) | 9 Betriebseinträge plus `hw*`/`zrb*`; `kvs-size.test.js` prüft die Länge; alle Leser paginieren |
| Scripts | höchstens 3 laufen gleichzeitig; je Script 5 offene `Shelly.call` und 5 Timer | – | ein offener Aufruf, ein Timer je Script; Betriebs-Scripts laufen nie gleichzeitig |
| Script-Heap | nicht dokumentiert | etwa 25 KB, von allen Scripts geteilt: `mem_free` 24 920 bis 25 200 B im Leerlauf; zwei große Scripts zugleich → `out_of_memory` (13.09.2026) | Versatz `PUMP_SEC` 30 s, Frist, `K = {}` in Wartephasen, Pumpentest in zwei Durchgängen |
| Stack | nicht beziffert – „mehr als 2–3 verschachtelte anonyme Funktionen“ stürzen ab | 12 Ebenen laufen, 14 stürzen ab („Too much recursion“), 12.09.2026, FW 2.0.0 | flache `next()`-Schleife; Mock-Grenze `MAX_CALL_DEPTH` <!-- fact:call_depth -->10<!-- /fact --> |
| Codegröße je Script | Forum: ~15 KB (FW 1.0.3) | FW 2.0.0 speichert 19 KB (12.09.2026) | `dist/` ≤ <!-- fact:size_limit -->16 000<!-- /fact --> B, `bw_pump` ≤ <!-- fact:size_limit_pump -->18 000<!-- /fact --> B – die Grenze schützt den Heap, nicht den Flash |
| Flash (`fs_free`) | – | 57 344 B vor dem Upload; 24 576 B nach zwei Test-Scripts; 12 288 B mit sieben Scripts; 49 152 B ohne die drei Test-Scripts (≈ 36 KB frei); 40 960 B nach dem Upload von `bw_pump` 17 475 B – LittleFS rechnet in 4-KB-Blöcken (13.09.2026) | `put-script.js` bricht ab, wenn `fs_free` + alter Code < Datei + 4 096 B |
| Konsole | – | 20 `print`-Zeilen in einer Rekursion kamen weder in der Web-UI noch im Debug-Websocket an (12.09.2026) | nie mehr als 15 Zeilen synchron; eine Zeile je Takt und je Portion (`noBurst()` in `tools/test/helpers.js`, Grenze 15 Zeilen je Zeitstempel) |
| CPU | – | ein 1-s-Tick mit `getComponentStatus` kostet 12–17 % (Firmware-Log 13.09.2026) | `bw_main` misst 2,5 s je Takt, `bw_pump` nur im Fenster, Test-Scripts nur von Hand |

## Script-API

Doku: [Shelly](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Shelly), [Timer](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Timer), [Language Reference](https://shelly-api-docs.shelly.cloud/gen2/Scripts/LanguageReference).

| Funktion | Signatur | So nutzen es die Scripts |
| --- | --- | --- |
| `Shelly.call` | `Shelly.call(method, params, callback, userdata)`; `callback(result, error_code, error_message, userdata)` | asynchron; `error_code` 0 = ok, `-105` = KVS-Schlüssel fehlt. Höchstens 5 offene Aufrufe je Script – wir halten immer nur einen offen: `rpc()`-Wrapper, in `bw_pump`/`bw_hwtest`/`bw_hwpump` liegen Callback und Userdata in Modulvariablen und `busy` sperrt den Tick |
| `Shelly.getComponentStatus` | `Shelly.getComponentStatus(type, id)` → Objekt oder `null` | synchron, von der Doku empfohlen, um Callbacks zu sparen; `type` `"sys"` (ohne id), `"voltmeter"`, `"temperature"`, `"input"`, `"switch"` |
| `Shelly.getCurrentScriptId` | `→ number` | `Script.Stop` auf sich selbst; `bw_hwpump` zählt damit die anderen laufenden Scripts |
| `Shelly.getUptimeMs` | `→ number` | Laufzeit: `bw_pump` rechnet die Frist `B` (Sekunden seit Scriptstart gegen `min(tWin, tick·60 − q − tTail)`), Portionsdauer, Einsickern und Stabilisierung damit – nie aus Tick-Zählern (Timer-Jitter); `bw_main` misst `dauer=` |
| `Timer.set` | `Timer.set(period_ms, repeat, callback, userdata)` → handle | höchstens 5 je Script; wir nutzen einen: `bw_main` Mess-Timer `msSample` <!-- def:cfg1.msSample -->500<!-- /def --> ms, `bw_pump` Tick-Timer `msSample`, Test-Scripts `hwt.msTick` <!-- hwt:msTick -->1000<!-- /hwt --> ms, `bw_install` einmalig 400 ms für den Retry |
| `Timer.clear` | `Timer.clear(handle)` | im eigenen wiederholenden Callback erlaubt; die Firmware meldet dann `Timer 1 handle not found` – harmlos (13.09.2026) |
| `print` | `print(...)` | Konsole der Web-UI und Debug-Websocket; je Takt und je Portion eine Zeile, `dbg()` nur bei `DEBUG = 1` |

## Engine-Fakten aus der Language Reference und vom Gerät

Die Regeln dazu stehen in CLAUDE.md; hier steht, woher sie kommen. Jede Zeile nennt das Symptom mit Datum und die Stelle, die es heute verhindert ([18 · Lernlog vom Gerät](18-lernlog-geraet.md) hat die ganze Geschichte).

| Fakt | Beleg | Folge im Projekt |
| --- | --- | --- |
| Sprachumfang mJS: `var`, `let`, Funktionen, `String`/`Number`/`Array`/`Math`/`JSON`, `Object.keys`, `try/catch/finally`, `throw`; nicht: Hoisting, ES6-Klassen, Promises/async; `const` steht nicht in der Liste | Language Reference | Konvention: nur `var` und benannte Funktionen. `syntax.test.js` verbietet `const`, Arrow-Functions, Template-Strings, `class`, `for…of`, Spread, `Date`, `async`/`await`/`Promise`, anonyme Funktionen, `parseInt`/`parseFloat` und die unbekannten Array-Methoden (nicht `let`) |
| Kein Hoisting: ein Funktionsname existiert erst, wenn die Ausführung an seiner Deklaration vorbei ist; Aufrufe innerhalb von Funktionen sind unkritisch | `ReferenceError: "stepRead" is not defined` beim ersten Start am Gerät (12.09.2026); der Mock (V8) hoistet und merkt nichts | `var steps = [...]` steht ganz unten vor `next()`; `useBeforeDecl` in `syntax.test.js` prüft alle Modulebene-Zeilen, auch mehrzeilige Literale; Phasentabellen entstehen in einer Funktion (`PH = phases()`) |
| Mehr als 2–3 verschachtelte anonyme Funktionen lassen das Gerät abstürzen | Language Reference | alle Callbacks sind benannte Funktionen auf oberster Ebene; Ablauf als Schrittkette `steps[]` + `next()` |
| Stack: 12 Ebenen laufen, 14 stürzen ab, jeweils plus Timer-Frame und `print` | `tools/probe/engine_probe.js` Abschnitt G (12.09.2026); vorher starb `bw_pump` mit zehn Ebenen (RPC-Callback → `next` → `stepCfg` → `next` → `stepCheck` → `finish` → `jumpTo` → `next` → `stepWrite` → `JSON.stringify`) | `next()` ist eine flache Schleife: ein Schritt gibt `true` zurück, wenn er sofort fertig ist; Warteschlangen-Treiber wie `writeNext()` geben `true` zurück, wenn nichts mehr ansteht (`if (writeNext()) next();`); tiefste Kette heute 6. Der Mock misst die Tiefe an `print`, `Shelly.call`, `Timer.set` und `JSON.*` und meldet mehr als <!-- fact:call_depth -->10<!-- /fact --> Ebenen als Fehler |
| KVS-Werte sind JSON-Strings | Das Gerät speichert jeden JSON-Wert, aber die Web-UI zeigt Objektwerte als `[object Object]` und würde sie beim Speichern so zurückschreiben (12.09.2026) | schreiben mit `JSON.stringify`, lesen mit `fromKvs()` (unlesbar → `null`, der Installer legt den Eintrag neu an); der Mock meldet Nicht-String-Werte als Fehler; Entscheidung 15 |
| Array-Methoden: belegt sind nur `push`, `slice`, `splice`, `indexOf`, `join` | `ABBRUCH: Function "shift" not found!` in `bw_hwtest` nach dem ersten Messtick (13.09.2026) | `shift`, `unshift`, `forEach`, `map`, `filter`, `reduce`, `find`, `includes`, `some`, `every`, `sort` sind verboten; Ringpuffer per Index (`ring[i % n]`), Sortieren mit eigener Einfügeschleife |
| Codegröße: FW 2.0.0 speichert auch 19 KB je Script; begrenzend ist der Heap, nicht der Flash | `bw_main` 0.1.1: 19 021 von 19 231 B kamen am Gerät an – die Größe war nicht das Problem, der Editor war es (12.09.2026) | Kompakt-Ausgabe aus `npm run build`: `dist/` ≤ <!-- fact:size_limit -->16 000<!-- /fact --> B, `bw_pump` ≤ <!-- fact:size_limit_pump -->18 000<!-- /fact --> B (`size.test.js`); heute `bw_install` <!-- fact:dist.bw_install -->15 978<!-- /fact -->, `bw_main` <!-- fact:dist.bw_main -->15 791<!-- /fact -->, `bw_pump` <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B |
| Der Script-Editor der Web-UI verliert beim Einfügen Text | 166 B (`bw_install`) und 210 B (`bw_main`) fehlten am Dateiende: `SyntaxError: Got EOF expected '}'` (12.09.2026) | Upload nur mit `put-script.js` (`Script.PutCode` in Stücken), danach `verify-scripts.js` byteidentisch gegen `dist/` – auch nach jedem Einfügen im Editor |
| Geteilter Script-Heap von etwa 25 KB | `out_of_memory` in `Script.GetStatus.errors`: `bw_pump` neben `bw_hwpump` (13 552 B belegt) und neben `bw_main` zur selben Sekunde (13.09.2026) | Langläufer geben KVS-Objekte in Wartephasen frei (`K = {}; orig = {}`) und lesen vor dem Schreiben neu; ein Script, das ein zweites startet, beendet sich; `bw_pump` liest neun Schlüssel einzeln und gibt `K`/`orig` vor dem Fenster frei; `bw_pump` startet 30 s nach `bw_main` |
| Lange Schleifen blockieren die Firmware | Language Reference | jeder Schritt rechnet nur Millisekunden; Warten läuft über Timer |
| Eine Exception in einem asynchronen Callback beendet das Script | Language Reference; `fail()` in jedem Script | jeder Schritt und jeder Tick läuft in `try/catch`; `bw_pump` schaltet im Fehlerfall zuerst die Pumpe aus (`pumpOffSafe`) |
| Der erste `Schedule.Create` eines großen Scripts wird abgelehnt, der Inhalt ist egal | `Invalid argument 'timespec': Failed validation!` (12.09.2026); derselbe String per curl 10/10 gültig; Ablehnung bleibt auch mit freigegebenen KVS-Objekten (13.09.2026) | Retry im Installer, Mock-Quirk `schedCreateFailFirst`, zwei Tests in `install.test.js`. Lehre: ein „validation failed“ der Firmware erst per curl gegenprüfen |
| Konsole: der Debug-Websocket muss an sein, verliert Bursts und mischt Firmware-Zeilen ein (`JS RAM stat … used: N` beim Start) | 12.09./13.09.2026 | `hwtest.js watch` filtert das Rauschen, `console.js` nicht; die Konsole vor `Script.Start` verbinden, sonst fehlt die erste Zeile |

## Beispielausgabe

Ein Lauf von `bw_pump` gegen den Mock. Die Ergebniszeile des Werkzeugs zeigt, was dieses Kapitel misst: ein offener RPC, Aufruftiefe 6 von erlaubten <!-- fact:call_depth -->10<!-- /fact -->, nur drei Schreibvorgänge (`w=3`: `st`, `day`, `job` – die Einzelportion schreibt keinen Claim):

```bash
node tools/run-script.js scripts/bw_pump.js --seed --kvs 'job={"ok":true,"sec":25,"pct":20,"why":"hand","ts":1789192500}'   # Einzelportion: pctOk fehlt im Seed-Band
```

```text
[bw_pump 0.2.0] Fenster: Auftrag 25 s, pct 20, Einzelportion, Frist 420 s
[bw_pump 0.2.0] P1 aus: ok nach 25 s
[bw_pump 0.2.0] ergebnis=ok n=1 sec=25 dur=26 pct=null→null effW=null sf=0.7 day.n=1 err=null w=3 dauer=28340
--- Ergebnis --- beendet=true Dauer=28340 ms, max. offene RPC=1, max. Aufruftiefe=6, Fehler=0
```

So sehen die drei Engine-Fehler am Gerät aus, die den Mock nie erreichen – Konsole der Web-UI, 12.09. und 13.09.2026:

```text
Uncaught ReferenceError: "stepRead" is not defined
 at var steps = [stepRead, stepDefaults, stepScripts, stepSchedL...
Uncaught Error: Too much recursion - the stack is about to overflow
 at ...s.length; i++) { if (K[keys[i]] !== undefined && JSON.string...   (stepWrite)
in function "f" called from   try { f(); } catch (e) { fail(e); }         (next)
JS Error [5] out_of_memory used=791 peak=871 total=1746
```

Zwei KVS-Antworten aus dem Mock nach dem Installer (`KVS.Get st` und `KVS.GetMany`, zweite gekürzt). Die Form ist die am Gerät gemessene (Probe 12.09.2026): `value` ist ein JSON-String, `items` ein Array mit `offset` und `total`; die `etag`-Werte sind Mock-intern:

```json
{"etag":"cc0d61","value":"{\"state\":\"beob\",\"ts\":null,\"sec\":null,\"pctB\":null,\"pctA\":null,\"rated\":false,\"dryOk\":false}"}
{"items":[{"key":"cfg1","etag":"30060e","value":"{\"vDry\":0.2,\"vWet\":3.13,\"vErrLo\":0.1,…}"},{"key":"cfg2","etag":"138b85","value":"…"}],"offset":0,"total":9}
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `ReferenceError: "<name>" is not defined` beim Start | Funktionsname auf Modulebene vor seiner Deklaration (kein Hoisting) – oder der Upload hat die Funktion verloren | `steps` ans Dateiende; `node tools/verify-scripts.js <ip>`; `npm test` (`syntax.test.js`) |
| `Too much recursion - the stack is about to overflow` | Aufrufkette tiefer als etwa 10 Ebenen | Schritte geben `true` zurück statt `next()` zu rufen; `max. Aufruftiefe` in `run-script.js` prüfen |
| `Function "shift" not found!` | Array-Methode, die mJS nicht kennt | nur `push`, `slice`, `splice`, `indexOf`, `join`; Ringpuffer per Index |
| Script endet ohne Konsolenzeile, `Script.GetStatus.errors` = `out_of_memory` | zwei große Scripts zugleich im 25-KB-Heap | Test-Scripts nur einzeln, `K = {}` in Wartephasen, `bw_pump` nie zur selben Sekunde wie `bw_main`; Heap mit `hwtest.js scripts` messen |
| `Schedule.Create '…': Invalid argument 'timespec': Failed validation!` | Firmware-Quirk beim ersten Create eines Laufs | der Installer wiederholt bis 3×; bei einer zweiten Ablehnung den Timespec per `curl` gegenprüfen |
| `SyntaxError: Got EOF expected '}'` oder eine Funktion aus der Dateimitte fehlt | Einfügen im Web-Editor hat Text verloren | `put-script.js` statt Editor; `verify-scripts.js` nach jedem Upload |
| Web-UI zeigt `[object Object]` im KVS | Objektwert statt JSON-String | Eintrag löschen, Installer starten; Scripts schreiben nur `JSON.stringify` |
| `KVS.Get` antwortet `-105` | Schlüssel fehlt – nach dem Löschen von `err` normal | Scripts nehmen `null`; `bw_main` legt Zustandseinträge neu an |
| `hwtest.js watch`/`console.js` zeigen keine Konsolenzeilen | Debug-Websocket aus, Konsole erst nach `Script.Start` verbunden, oder mehr als 15 Zeilen am Stück | Web-UI → Konsole öffnen (schaltet den Websocket ein), `console.js` vor dem Start verbinden, eine Zeile je Schritt |
| `Input.GetStatus.state` ist `null` | Eingang deaktiviert oder nicht Typ `switch` | `node tools/hwtest.js <ip> input-on` |
| Konsole: `Timer 1 handle not found`, `PCS write interval < 60s` | `Timer.clear` im eigenen Callback; Zählerschreiben des Switch bei Portionen unter 60 s Abstand | harmlos, keine Änderung nötig |
| `put-script.js`: `Flash zu voll` | `fs_free` + alter Code < Datei + 4 096 B | Test-Scripts mit `hwtest.js delete` entfernen, danach erneut hochladen |

## Weiter zu

- [18 · Lernlog vom Gerät](18-lernlog-geraet.md) – jeder Gerätefund hinter dieser Tabelle mit Symptom, Ursache, Fix und Regel im Test.
- [14 · Debuggen und Testen](14-debuggen-und-testen.md) – Mock, Tests, Build, Upload und Konsole: die Werkzeuge, mit denen man die Grenzen misst.
- [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md) – was die Grenzen für Pumpe, Wasser und Betrieb bedeuten.
