# 3 · Installation am Gerät — Installation on the device

**Sprache / Language:** [Deutsch](#deutsch) · [English](#english) — [Handbuch-Index](README.md)

---

## Deutsch

### Schnellstart

```bash
# Auf deinem Rechner (Node ≥ 20), im Projektordner:
npm install
npm test                 # 58 Tests gegen den Mock – müssen grün sein
npm run build            # erzeugt dist/ (kompakter Code für das Gerät)

# Scripts aufs Gerät laden (zuverlässiger als Copy&Paste im Web-Editor):
node tools/put-script.js <shelly-ip> 1 dist/bw_install.js
node tools/put-script.js <shelly-ip> 2 dist/bw_main.js
node tools/put-script.js <shelly-ip> 3 dist/bw_pump.js
# Danach im Web-UI 'bw_install' einmal starten, dann Zielband (cfg2) eintragen.
```

> **Voraussetzung:** Shelly im WLAN, Uhrzeit per NTP gesetzt, **Zeitzone** korrekt (die Fenster 08:00/20:00 sind
> Ortszeit). Die Scripts müssen am Gerät exakt `bw_install`, `bw_main`, `bw_pump` heißen (IDs 1/2/3).

### Schritt für Schritt

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
3. **Installer starten.** `bw_install` einmal mit „Start" ausführen. Er legt acht KVS-Einträge an, drei
   Zeitplan-Einträge und setzt die Switch-Sicherheit; dann beendet er sich. **Hinweis:** Der erste
   `Schedule.Create` scheitert am Gerät manchmal mit „timespec validation" – der Installer wiederholt ihn
   automatisch (`Versuch 1/3` in der Konsole ist normal).
4. **Prüfen.** Web-UI → Schedules zeigt `0 */15 * * * *`, `0 0 8,20 * * *`, `0 5 8,20 * * *`. KVS ansehen:
   `http://<ip>/rpc/KVS.GetMany?match=*` oder `tools/kvs_dump.sh <ip>`.

### Kalibrierung & Zielband

Das System **misst und protokolliert sofort, gießt aber erst, wenn das Zielband (`cfg2`) gesetzt ist**. Solange
`pctSoll`, `pctLo`, `pctHi`, `pctDry` oder `dropSlow` `null` sind, steht `err.code = "cfg"` – das ist normal und
kein Fehler. Die vier Kalibrier-Schritte (Trockenpunkt, Nasspunkt, obere/untere Referenz an der Pflanze) stehen
ausführlich im [README-Abschnitt „Kalibrierung"](../../README.md#kalibrierung).

> **KVS bearbeiten:** In der Web-UI unter Settings → Key-Value Storage den Eintrag `cfg2` öffnen, **„Format as
> JSON" anhaken** und die Werte eintragen. Alle KVS-Werte sind JSON-Strings – ohne den Haken zeigt die Web-UI
> nur `[object Object]`. (Hintergrund: [`../../LEARNING.md`](../../LEARNING.md).)

Alle Felder mit Startwerten und Bedeutung: [README-Abschnitt „Konfiguration"](../../README.md#konfiguration-alle-kvs-felder).

### Läuft es?

`bw_main` schreibt alle 15 Minuten eine Konsolenzeile, z. B.
`V=1.196 pct=34 tC=22 lvl=0 st=beob dry=0 pause=24h why=ok sec=70 …`. Steht dort `why=ok`, entsteht im nächsten
Fenster ein Gießauftrag. Von Hand gießen zum Testen: siehe [README-Abschnitt „Betrieb und Ablesen"](../../README.md#betrieb-und-ablesen).

---

## English

### Quick start

```bash
# On your machine (Node ≥ 20), in the project folder:
npm install
npm test                 # 58 tests against the mock – must be green
npm run build            # creates dist/ (compact code for the device)

# Upload scripts to the device (more reliable than copy&paste in the web editor):
node tools/put-script.js <shelly-ip> 1 dist/bw_install.js
node tools/put-script.js <shelly-ip> 2 dist/bw_main.js
node tools/put-script.js <shelly-ip> 3 dist/bw_pump.js
# Then start 'bw_install' once in the web UI, then enter the target band (cfg2).
```

> **Prerequisite:** Shelly on Wi-Fi, clock set via NTP, correct **time zone** (the 08:00/20:00 windows are local
> time). On the device the scripts must be named exactly `bw_install`, `bw_main`, `bw_pump` (IDs 1/2/3).

### Step by step

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
3. **Run the installer.** Start `bw_install` once. It creates eight KVS entries, three schedule entries and sets
   the switch safety config; then it stops itself. **Note:** the first `Schedule.Create` sometimes fails on the
   device with "timespec validation" – the installer retries automatically (`Versuch 1/3` in the console is normal).
4. **Verify.** Web UI → Schedules shows `0 */15 * * * *`, `0 0 8,20 * * *`, `0 5 8,20 * * *`. Inspect the KVS:
   `http://<ip>/rpc/KVS.GetMany?match=*` or `tools/kvs_dump.sh <ip>`.

### Calibration & target band

The system **measures and logs immediately but only waters once the target band (`cfg2`) is set**. As long as
`pctSoll`, `pctLo`, `pctHi`, `pctDry` or `dropSlow` are `null`, `err.code = "cfg"` – that is normal, not a fault.
The four calibration steps (dry point, wet point, upper/lower reference at the plant) are detailed in the
[README "Kalibrierung" section](../../README.md#kalibrierung).

> **Editing the KVS:** in the web UI under Settings → Key-Value Storage open the `cfg2` entry, **tick "Format as
> JSON"** and enter the values. All KVS values are JSON strings – without the tick the web UI only shows
> `[object Object]`. (Background: [`../../LEARNING.md`](../../LEARNING.md).)

All fields with defaults and meaning: [README "Konfiguration" section](../../README.md#konfiguration-alle-kvs-felder).

### Is it running?

`bw_main` writes a console line every 15 minutes, e.g.
`V=1.196 pct=34 tC=22 lvl=0 st=beob dry=0 pause=24h why=ok sec=70 …`. When it says `why=ok`, a watering job is
created for the next window. To water by hand for testing: see the
[README "Betrieb und Ablesen" section](../../README.md#betrieb-und-ablesen).
