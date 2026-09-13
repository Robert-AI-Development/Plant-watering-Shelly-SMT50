# 3 · Installation am Gerät — Installation on the device

**Sprache / Language:** [Deutsch](#deutsch) · [English](#english) — [Handbuch-Index](README.md)

---

## Deutsch

### Schnellstart

```bash
# Auf deinem Rechner (Node ≥ 20; für hwtest.js/console.js Node ≥ 22), im Projektordner:
npm install
npm test                 # 144 Tests gegen den Mock – müssen grün sein
npm run build            # erzeugt dist/ (kompakter Code für das Gerät)

# Scripts aufs Gerät laden (zuverlässiger als Copy&Paste im Web-Editor):
node tools/put-script.js <shelly-ip> 1 dist/bw_install.js
node tools/put-script.js <shelly-ip> 2 dist/bw_main.js
node tools/put-script.js <shelly-ip> 3 dist/bw_pump.js
node tools/verify-scripts.js <shelly-ip>        # Prüfung: Code am Gerät byteidentisch mit dist/? (und bw_main/bw_pump gleiche Version)
# Danach im Web-UI 'bw_install' einmal starten (oder: node tools/hwtest.js <shelly-ip> normal 30), dann Zielband (cfg2, auch pctOk) eintragen.
# Update von 0.1.x: vorher engine_probe/bw_hwtest/bw_hwpump löschen (Flash) und Handwerte setzen – siehe unten.
```

> **Voraussetzung:** Shelly im WLAN, Uhrzeit per NTP gesetzt, **Zeitzone** korrekt (die Fenster 08:00/20:00 sind
> Ortszeit). Die Scripts müssen am Gerät exakt `bw_install`, `bw_main`, `bw_pump` heißen (IDs 1/2/3).

### Schritt für Schritt

Kompakt in zehn Schritten, mit Zeitraffer, Kalibrierung und Parameter-Überblick: [Kurzanleitung](../kurzanleitung.md).

Die ausführliche Fassung steht im [README-Abschnitt „Installation"](../../README.md#installation). Hier der
rote Faden mit den wichtigen Fallstricken, die wir am echten Gerät gefunden haben (siehe
[`../../LEARNING.md`](../../LEARNING.md)):

1. **Peripherie anlegen** (Web-UI → Peripherals/Add-ons): Analogeingang als **Voltmeter** (Bereich 0–15 V),
   DS18B20 per **1-Wire-Scan**. Es entstehen `voltmeter:100` und `temperature:100`. Eingang 1 (IN2) auf Typ
   „Switch" stellen.
2. **Scripts anlegen.** Erzeuge drei Scripts mit den exakten Namen `bw_install`, `bw_main`, `bw_pump`.
   - **Am besten per RPC hochladen:** `node tools/put-script.js <ip> <id> dist/<datei>` lädt in Stücken hoch und
     **prüft danach die Byte-Zahl am Gerät** gegen die Datei. Grund: Der Web-Editor hat beim Einfügen schon
     Text am Dateiende verloren (Script startete mit `SyntaxError: Got EOF`).
   - **Wenn du doch den Web-Editor nutzt:** Inhalt aus **`dist/`** (nicht `scripts/`!) einfügen und danach
     prüfen: `http://<ip>/rpc/Script.GetCode?id=<id>&len=1` liefert `left`; `left + 1` muss der Dateigröße aus
     `npm run build` entsprechen. Kein Script auf „Run on startup" stellen.
3. **Installer starten.** `bw_install` einmal mit „Start" ausführen. Er legt neun KVS-Einträge an (`cfg1`–`cfg4`,
   `lrn`, `st`, `job`, `day`, `err`), ergänzt in vorhandenen Einträgen fehlende Felder, prüft, dass ein Gießfenster
   samt Budget `cfg4.tWin` vor dem nächsten Takt endet, legt drei Zeitplan-Einträge an und setzt die
   Switch-Sicherheit (`auto_off` 190 s); dann beendet er sich. Läuft gerade `bw_main` oder `bw_pump`, bricht er ab. **Hinweis:** Der erste
   `Schedule.Create` scheitert am Gerät manchmal mit „timespec validation" – der Installer wiederholt ihn
   automatisch und stumm; erst eine zweite Ablehnung erscheint als `Hinweis: Schedule.Create …` in der Konsole.
4. **Prüfen.** Web-UI → Schedules zeigt `0 */15 * * * *`, `30 0 8,20 * * *` (Pumpe 30 s nach der vollen Minute), `0 8 8,20 * * *`
   (Sicherheits-Aus 8 min nach dem Fenster: 30 s + `tWin` 420 s + 10 s). KVS ansehen:
   `http://<ip>/rpc/KVS.GetMany?match=*` oder `tools/kvs_dump.sh <ip>`.

### Update von 0.1.x auf 0.2.0 (Regelkreis im Gießfenster)

Seit 0.2.0 gießt `bw_pump` im Fenster in **Portionen mit Nachmessen** und lernt selbst (`cfg4`); `bw_main` schreibt nur
noch den Auftrag, kontrolliert 30 min später und führt die Wochen-Trockenphase (Freitag, Ende unter `pctDry` 28 %,
Start auch bei Nässe über `pctHi` 60 %). Reihenfolge beim Update:

1. **Flash freiräumen:** `engine_probe`, `bw_hwtest`, `bw_hwpump` per `Script.Delete` löschen (`put-script.js` prüft
   `fs_free` vor dem Upload); die Test-Scripts lädt man bei Bedarf wieder hoch.
2. **Hochladen** (`dist/`): `bw_pump`, `bw_main`, `bw_install`, `bw_zeitraffer`; dann `node tools/verify-scripts.js <ip>`.
3. **Handwerte im KVS** (Beispielband am Gerät): `cfg2` → `pctOk` 50, `pctHi` 60, `pctDry` 28, `effMax` 30;
   `cfg3` → `tMax` 180 (jetzt Summe je Fenster), `tMin` 25.
4. **Installer:** `node tools/hwtest.js <ip> normal 30` – ergänzt `cfg4`, `cfg3.dryDay`, `cfg2.dropW`/`sfUp`,
   `lrn.effW`/`sf` 0.7, baut den Zeitplan neu (`0 8 8,20`) und setzt `auto_off` 190 s.

Bis `pctOk` eingetragen ist, gießt das System nicht (`why=cfg`); jede Upload-Reihenfolge ist wassersicher. Alle
Schritte mit Erklärung: [README „Betrieb und Ablesen“](../../README.md#betrieb-und-ablesen).

### Hardware prüfen (bw_hwtest / bw_hwpump)

Bevor du kalibrierst, kannst du die Verdrahtung mit zwei zusätzlichen Geräte-Scripts durchprüfen: `bw_hwtest`
testet die Sensoren (DS18B20 kalt/warm, SMT50 trocken/nass, Schwimmer LEER/VOLL), `bw_hwpump` die Pumpe – und
zwar über `bw_pump`, genau wie im Normalbetrieb. Gesteuert wird vom Rechner aus mit `tools/hwtest.js` (Node ≥ 22)
im Interview: Das Script wartet, du baust die Phase auf und gibst sie mit `go` frei. Der Ablauf im Detail steht in
[Kapitel 6, „Hardware-Test im Interview"](06-shelly-remote-debug.md#hardware-test-im-interview).

**Voraussetzungen:** Eiswasser oder kaltes Wasser (≤ 20 °C) und warmes Wasser (≥ 30 °C, nicht über 32 °C) für die
Fühler-Hülse, ein Glas Wasser und ein Tuch für den SMT50, ein Eimer für den Pumpenschlauch, Wasserbehälter voll,
Schwimmer von Hand bewegbar, Input 1 aktiv (Typ Switch). Nicht in den 25 Minuten um 08:00, 20:00 oder Mitternacht
starten – die Zeitwache des Pumpentests wartet sonst.

```bash
node tools/hwtest.js <ip> preflight hw          # Uhrzeit, Scripts, Input 1, Switch, KVS prüfen; legt bw_hwtest/bw_hwpump an und nennt die Upload-Befehle
node tools/put-script.js <ip> <id> dist/bw_hwtest.js   # ID aus der preflight-Ausgabe oder `hwtest.js <ip> scripts`
node tools/put-script.js <ip> <id> dist/bw_hwpump.js
node tools/hwtest.js <ip> input-on              # nur wenn preflight Input 1 als deaktiviert meldet

node tools/hwtest.js <ip> start bw_hwtest 20    # Sensortest: Phasen t1 t2 m1 m2 l1 l2
node tools/hwtest.js <ip> watch 120             # Konsole und Statuszeile mitlesen
node tools/hwtest.js <ip> go                    # wartende Phase freigeben (auch: skip, abort)

node tools/hwtest.js <ip> start bw_hwpump 20    # Pumpentest: nach go pumpt bw_pump, Durchgang B folgt automatisch
node tools/hwtest.js <ip> watch 240
node tools/hwtest.js <ip> report                # Ergebnis (hwr/hwp) und cfg1 lesbar ausgeben
node tools/hwtest.js <ip> cleanup               # hwc/hwb1/hwb2 löschen
```

- Die Kalibrierwerte **`vDry`, `vWet` (Trocken-/Nasspunkt des SMT50) und `lvlEmpty` (Schwimmer-Pegel für LEER)
  landen bei plausiblem Ergebnis automatisch in `cfg1`** (Schalter `hwt.cal`, Standard 1; Alt- und Neuwert stehen
  im Bericht unter `cal`).
- Die Test-Scripts legt `preflight hw` per `Script.Create` an; die ID vergibt das Gerät (am 13.09.2026 waren 4/5/6
  gelöscht, der Flash ist knapp). Sie **gehören nie in den Zeitplan**: Sie sind Langläufer und werden nur von Hand gestartet.
- **Not-Aus:** `node tools/hwtest.js <ip> stop` stoppt die Test-Scripts und `bw_pump` und schaltet den Ausgang aus;
  danach `restore`, falls ein Pumpentest unterbrochen wurde. Zum Schluss Sensoren zurück in den Topf, Schwimmer auf
  VOLL, Behälter füllen.

### Kalibrierung & Zielband

Das System **misst und protokolliert sofort, gießt aber erst, wenn das Zielband (`cfg2`) gesetzt ist**. Solange
`pctSoll`, `pctLo`, `pctOk`, `pctHi`, `pctDry` oder `dropSlow` `null` sind, steht `err.code = "cfg"` – das ist normal und
kein Fehler. Das Band muss geordnet sein (`pctDry < pctLo < pctOk ≤ pctSoll < pctHi`); Beispielband am Gerät:
55 / 40 / 50 / 60 / 28, `dropSlow` 4. Die vier Kalibrier-Schritte (Trockenpunkt, Nasspunkt, obere/untere Referenz an der Pflanze) stehen
ausführlich im [README-Abschnitt „Kalibrierung"](../../README.md#kalibrierung).

> **KVS bearbeiten:** In der Web-UI unter Settings → Key-Value Storage den Eintrag `cfg2` öffnen, **„Format as
> JSON" anhaken** und die Werte eintragen. Alle KVS-Werte sind JSON-Strings – ohne den Haken zeigt die Web-UI
> nur `[object Object]`. (Hintergrund: [`../../LEARNING.md`](../../LEARNING.md).)

Alle Felder mit Startwerten und Bedeutung: [README-Abschnitt „Konfiguration"](../../README.md#konfiguration-alle-kvs-felder).

### Läuft es?

`bw_main` schreibt alle 15 Minuten eine Konsolenzeile, z. B.
`V=1.196 pct=34 tC=22 lvl=0 st=beob dry=1 pause=24h why=ok sec=70 effW=- sf=0.7 …`. Steht dort `why=ok`, gießt `bw_pump`
im nächsten Fenster – mit je einer Zeile pro Portion (`m0 20 % → P1 25 s`, `P1 25s: 20→44.9 (24.9, g 4.976, tRise 25,
stabil 17s)`) und einer Ergebniszeile (`ergebnis=ok n=2 sec=35 … effW=5.027 sf=0.75`). Von Hand gießen zum Testen und
alle Konsolenzeilen: [README-Abschnitt „Betrieb und Ablesen"](../../README.md#betrieb-und-ablesen).

### Praxistest im Zeitraffer (45 Minuten)

Statt Tage zu warten, lässt du dieselben Betriebs-Scripts **im Zeitraffer** laufen: `bw_main` alle 3 Minuten, `bw_pump`
alle 6 Minuten mit einem Fenster-Budget von 120 s und bis zu 3 Portionen (10–15 s) mit **echtem Lernen**, Pause 12 min
(Hitze: 6 min), Tageslimit 4, Trockenphase aus. Das Script `bw_zeitraffer` sichert deine Betriebswerte (`zrb1`–`zrb5`)
und schreibt die Profile; **`bw_install` bringt alles zurück** – Lernwerte, Pause und Tageszähler sind danach wie vor
dem Test.

```bash
node tools/hwtest.js <ip> preflight             # legt bw_zeitraffer an und nennt den Upload-Befehl (am Gerät vom 13.09.2026: id 7)
node tools/put-script.js <ip> <id> dist/bw_zeitraffer.js
node tools/hwtest.js <ip> normal 30             # Installer einmal laufen lassen (ergänzt cfg4, pctOk, dryDay, effW)
node tools/hwtest.js <ip> zeitraffer 60         # Vorprüfung, sicherer Moment, Start, Kontrolle, Fahrplan
node tools/hwtest.js <ip> watch 300             # mitlesen (beliebig oft): Statuszeile mit st, n, pctW, why, err, Speicher
node tools/hwtest.js <ip> normal 60             # zurück zum Normalbetrieb
```

Vorbereitung: Zielband in `cfg2` vollständig (auch `pctOk`), Behälter voll, **Schlauch mit den Tropfern am Sensor** in
trockener Erde (der Regelkreis braucht die Rückmeldung; nur Mechanik: `cfg4.nPort` 1 und Schlauch in den Eimer), ein
Glas Wasser für den SMT50, ein Becher warmes Wasser für den DS18B20, ein zweiter Topf mit trockener Erde. Der Fahrplan
(Minuten ab einer vollen 6er-Minute: Sensor im Wasser → `trocken` (Nässe über `pctHi` startet die Trockenphase; feuchte Erde → `feucht`), kein Auftrag; Minute 3 in trockene Erde →
**Fenster 1 bei 6:30** mit Portionszeilen `P1 …`, `P2 …` und `effW`; Sensor vor jedem weiteren Fenster in trockene Erde
stecken; normale Pause → Fenster 2 bei 18:30; Fühler erwärmen → Fenster 3 bei 24:30; Schwimmer LEER → `wasser`; VOLL →
Fenster 4 bei 36:30; Minute 39 `limit`; Minute 40 `normal`) steht mit allen Erwartungen im
[README-Abschnitt „Praxistest im Zeitraffer"](../../README.md#praxistest-im-zeitraffer-45-minuten). Dort auch der
**Messlauf** (`hwtest.js mess`: Wirkung eines Pumpenpulses am Aufbau, Grundlage für `cfg4`) und der **Kalibrierlauf**
(`hwtest.js kal`: Zeitraffer mit Rekorder über die Zustände trocken → mittel feucht → nass, `kal report [datei] [log]`,
`kal write` erst nach `normal`; setzt `lrn.effW`, `cfg4.tDead2`, `cfg3.tDead`, `cfg3.tMin`).

---

## English

### Quick start

```bash
# On your machine (Node ≥ 20; Node ≥ 22 for hwtest.js/console.js), in the project folder:
npm install
npm test                 # 144 tests against the mock – must be green
npm run build            # creates dist/ (compact code for the device)

# Upload scripts to the device (more reliable than copy&paste in the web editor):
node tools/put-script.js <shelly-ip> 1 dist/bw_install.js
node tools/put-script.js <shelly-ip> 2 dist/bw_main.js
node tools/put-script.js <shelly-ip> 3 dist/bw_pump.js
node tools/verify-scripts.js <shelly-ip>        # check: code on the device byte-identical to dist/? (and bw_main/bw_pump same version)
# Then start 'bw_install' once in the web UI (or: node tools/hwtest.js <shelly-ip> normal 30), then enter the target band (cfg2, incl. pctOk).
# Updating from 0.1.x: delete engine_probe/bw_hwtest/bw_hwpump first (flash) and set the manual values – see below.
```

> **Prerequisite:** Shelly on Wi-Fi, clock set via NTP, correct **time zone** (the 08:00/20:00 windows are local
> time). On the device the scripts must be named exactly `bw_install`, `bw_main`, `bw_pump` (IDs 1/2/3).

### Step by step

Quick guide (German): [Kurzanleitung](../kurzanleitung.md) – setup in ten steps, fast-forward test, calibration, parameters.

The detailed version is in the [README "Installation" section](../../README.md#installation). Here is the
storyline with the important pitfalls we found on the real device (see [`../../LEARNING.md`](../../LEARNING.md)):

1. **Add peripherals** (web UI → Peripherals/Add-ons): analog input as **Voltmeter** (range 0–15 V), DS18B20 via
   **1-Wire scan**. This yields `voltmeter:100` and `temperature:100`. Set input 1 (IN2) to type "Switch".
2. **Create the scripts** with the exact names `bw_install`, `bw_main`, `bw_pump`.
   - **Best: upload via RPC:** `node tools/put-script.js <ip> <id> dist/<file>` uploads in chunks and **then
     verifies the byte count on the device** against the file. Reason: the web editor has lost text at the end of
     the file on paste (script started with `SyntaxError: Got EOF`).
   - **If you use the web editor anyway:** paste the content from **`dist/`** (not `scripts/`!) and then check:
     `http://<ip>/rpc/Script.GetCode?id=<id>&len=1` returns `left`; `left + 1` must equal the file size from
     `npm run build`. Do not set any script to "Run on startup".
3. **Run the installer.** Start `bw_install` once. It creates nine KVS entries (`cfg1`–`cfg4`, `lrn`, `st`, `job`,
   `day`, `err`), adds missing fields to existing entries, checks that a watering window plus budget `cfg4.tWin` ends
   before the next cycle, creates three schedule entries and sets the switch safety config (`auto_off` 190 s); then it
   stops itself. It aborts while `bw_main` or `bw_pump` is running. **Note:** the first `Schedule.Create` sometimes fails on the
   device with "timespec validation" – the installer retries automatically and silently; only a second rejection shows up as `Hinweis: Schedule.Create …` in the console.
4. **Verify.** Web UI → Schedules shows `0 */15 * * * *`, `30 0 8,20 * * *` (pump 30 s after the full minute), `0 8 8,20 * * *`
   (safety-off 8 min after the window: 30 s + `tWin` 420 s + 10 s). Inspect the KVS:
   `http://<ip>/rpc/KVS.GetMany?match=*` or `tools/kvs_dump.sh <ip>`.

### Updating from 0.1.x to 0.2.0 (closed loop in the watering window)

Since 0.2.0 `bw_pump` waters the window in **portions with re-measuring** and learns by itself (`cfg4`); `bw_main` only
writes the job, checks 30 min later and runs the weekly dry phase (Friday, ends below `pctDry` 28 %, also starts when
wet above `pctHi` 60 %). Order of the update:

1. **Free flash:** delete `engine_probe`, `bw_hwtest`, `bw_hwpump` via `Script.Delete` (`put-script.js` checks
   `fs_free` before uploading); re-upload the test scripts when needed.
2. **Upload** (`dist/`): `bw_pump`, `bw_main`, `bw_install`, `bw_zeitraffer`; then `node tools/verify-scripts.js <ip>`.
3. **Manual values in the KVS** (example band on the device): `cfg2` → `pctOk` 50, `pctHi` 60, `pctDry` 28, `effMax` 30;
   `cfg3` → `tMax` 180 (now the sum per window), `tMin` 25.
4. **Installer:** `node tools/hwtest.js <ip> normal 30` – adds `cfg4`, `cfg3.dryDay`, `cfg2.dropW`/`sfUp`,
   `lrn.effW`/`sf` 0.7, rebuilds the schedule (`0 8 8,20`) and sets `auto_off` 190 s.

Until `pctOk` is entered the system does not water (`why=cfg`); every upload order is water-safe. All steps with
explanation: [README "Betrieb und Ablesen"](../../README.md#betrieb-und-ablesen) (German).

### Check the hardware (bw_hwtest / bw_hwpump)

Before calibrating you can verify the wiring with two additional device scripts: `bw_hwtest` tests the sensors
(DS18B20 cold/warm, SMT50 dry/wet, float switch EMPTY/FULL), `bw_hwpump` tests the pump – through `bw_pump`, exactly
as in normal operation. You drive it from your machine with `tools/hwtest.js` (Node ≥ 22) as an interview: the
script waits, you set up the phase and release it with `go`. The detailed procedure is in
[chapter 6, "Hardware test as an interview"](06-shelly-remote-debug.md#hardware-test-as-an-interview).

**Prerequisites:** ice water or cold water (≤ 20 °C) and warm water (≥ 30 °C, not above 32 °C) for the probe
sleeve, a glass of water and a cloth for the SMT50, a bucket for the pump hose, water tank full, float switch
movable by hand, input 1 enabled (type Switch). Do not start within the 25 minutes around 08:00, 20:00 or midnight –
the pump test's time guard would wait.

```bash
node tools/hwtest.js <ip> preflight hw          # check clock, scripts, input 1, switch, KVS; creates bw_hwtest/bw_hwpump and prints the upload commands
node tools/put-script.js <ip> <id> dist/bw_hwtest.js   # ID from the preflight output or `hwtest.js <ip> scripts`
node tools/put-script.js <ip> <id> dist/bw_hwpump.js
node tools/hwtest.js <ip> input-on              # only if preflight reports input 1 as disabled

node tools/hwtest.js <ip> start bw_hwtest 20    # sensor test: phases t1 t2 m1 m2 l1 l2
node tools/hwtest.js <ip> watch 120             # follow console and status line
node tools/hwtest.js <ip> go                    # release the waiting phase (also: skip, abort)

node tools/hwtest.js <ip> start bw_hwpump 20    # pump test: after go, bw_pump pumps; pass B follows automatically
node tools/hwtest.js <ip> watch 240
node tools/hwtest.js <ip> report                # print result (hwr/hwp) and cfg1 readably
node tools/hwtest.js <ip> cleanup               # delete hwc/hwb1/hwb2
```

- The calibration values **`vDry`, `vWet` (dry/wet point of the SMT50) and `lvlEmpty` (float level meaning EMPTY)
  are written to `cfg1` automatically when the result is plausible** (switch `hwt.cal`, default 1; old and new
  values appear in the report under `cal`).
- `preflight hw` creates the test scripts via `Script.Create`; the device assigns the ID (on 13.09.2026 ids 4/5/6
  had been deleted, flash is tight). They **never belong in the schedule**: they are long runners and are only started by hand.
- **Emergency stop:** `node tools/hwtest.js <ip> stop` stops the test scripts and `bw_pump` and switches the output
  off; then `restore` if a pump test was interrupted. Finally put the sensors back into the pot, float to FULL,
  refill the tank.

### Calibration & target band

The system **measures and logs immediately but only waters once the target band (`cfg2`) is set**. As long as
`pctSoll`, `pctLo`, `pctOk`, `pctHi`, `pctDry` or `dropSlow` are `null`, `err.code = "cfg"` – that is normal, not a fault.
The band must be ordered (`pctDry < pctLo < pctOk ≤ pctSoll < pctHi`); example band on the device: 55 / 40 / 50 / 60 / 28,
`dropSlow` 4.
The four calibration steps (dry point, wet point, upper/lower reference at the plant) are detailed in the
[README "Kalibrierung" section](../../README.md#kalibrierung).

> **Editing the KVS:** in the web UI under Settings → Key-Value Storage open the `cfg2` entry, **tick "Format as
> JSON"** and enter the values. All KVS values are JSON strings – without the tick the web UI only shows
> `[object Object]`. (Background: [`../../LEARNING.md`](../../LEARNING.md).)

All fields with defaults and meaning: [README "Konfiguration" section](../../README.md#konfiguration-alle-kvs-felder).

### Is it running?

`bw_main` writes a console line every 15 minutes, e.g.
`V=1.196 pct=34 tC=22 lvl=0 st=beob dry=1 pause=24h why=ok sec=70 effW=- sf=0.7 …`. When it says `why=ok`, `bw_pump`
waters in the next window – one line per portion (`m0 20 % → P1 25 s`, `P1 25s: 20→44.9 (24.9, g 4.976, tRise 25,
stabil 17s)`) and a result line (`ergebnis=ok n=2 sec=35 … effW=5.027 sf=0.75`). To water by hand for testing and
all console lines: see the [README "Betrieb und Ablesen" section](../../README.md#betrieb-und-ablesen).

### Fast-forward practice test (45 minutes)

Instead of waiting for days, run the same production scripts **in fast-forward**: `bw_main` every 3 minutes, `bw_pump`
every 6 minutes with a window budget of 120 s and up to 3 portions (10–15 s) with **real learning**, a 12-minute pause
(heat: 6 minutes), daily limit 4, dry phase off. The script `bw_zeitraffer` backs up your operating values
(`zrb1`–`zrb5`) and writes the profiles; **`bw_install` brings everything back** – learned values, pause and daily
counter are as before the test.

```bash
node tools/hwtest.js <ip> preflight             # creates bw_zeitraffer and prints the upload command (device of 13.09.2026: id 7)
node tools/put-script.js <ip> <id> dist/bw_zeitraffer.js
node tools/hwtest.js <ip> normal 30             # run the installer once (adds cfg4, pctOk, dryDay, effW)
node tools/hwtest.js <ip> zeitraffer 60         # pre-check, safe moment, start, verification, schedule of steps
node tools/hwtest.js <ip> watch 300             # follow (as often as you like): status line with st, n, pctW, why, err, memory
node tools/hwtest.js <ip> normal 60             # back to normal operation
```

Preparation: target band in `cfg2` complete (incl. `pctOk`), tank full, **hose with the drippers at the sensor** in dry
soil (the loop needs the feedback; mechanics only: `cfg4.nPort` 1 and hose into a bucket), a glass of water for the SMT50,
a cup of warm water for the DS18B20, a second pot of dry soil. The schedule of steps (minutes from a full multiple of 6:
sensor in water → `trocken` (wet above `pctHi` starts the dry phase; moist soil → `feucht`), no job; minute 3 into dry soil → **window 1 at 6:30** with portion lines `P1 …`,
`P2 …` and `effW`; put the sensor into dry soil before every further window; normal pause → window 2 at 18:30; warm the
probe → window 3 at 24:30; float EMPTY → `wasser`; FULL → window 4 at 36:30; minute 39 `limit`; minute 40 `normal`) with
all expectations is in the [README section "Praxistest im Zeitraffer"](../../README.md#praxistest-im-zeitraffer-45-minuten)
(German). There you also find the **measurement run** (`hwtest.js mess`: effect of one pump pulse on the rig, basis for
`cfg4`) and the **calibration run** (`hwtest.js kal`: fast-forward with a recorder through the states dry → medium-moist → wet,
`kal report [file] [log]`, `kal write` only after `normal`; sets `lrn.effW`, `cfg4.tDead2`, `cfg3.tDead`, `cfg3.tMin`).
