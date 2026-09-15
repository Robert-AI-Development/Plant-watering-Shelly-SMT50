# 07 · Installation by hand (web UI, copy & paste)

[Deutsch](../de/07-installation-per-hand.md) · **English** — [Handbook](README.md) · Part C "Install"

> **At a glance**
> - Outcome: the scripts are on the device with the correct byte count (byte check passed), `bw_install` has created the defaults and the schedule, and the target band is in `cfg2` – with nothing but a browser and the web UI, no Node, no terminal.
> - Scope: about 30 minutes, 7 steps for three scripts (`bw_install`, `bw_main`, `bw_pump`; `bw_zeitraffer` optional).
> - The key number: the byte check. `left + 1` from `Script.GetCode` must equal the file size in `dist/`, for `bw_main` that is <!-- fact:dist.bw_main -->15791<!-- /fact --> bytes.
> - The biggest pitfall: the web UI editor has lost text on paste (12 Sep 2026: 166 and 210 bytes at the end of the file). Without the byte check such a script starts with `Got EOF` or dies later with a `ReferenceError`.

## Prerequisites

- Step 1 of the [start guide](06-startanleitung.md) is done: Shelly on the WLAN, time set via NTP, time zone set, analog input as voltmeter (`voltmeter:100`), DS18B20 added by 1-Wire scan (`temperature:100`), input 1 (IN2) set to type "Switch".
- A browser on the same network; the web UI is reachable at `http://<ip>`, RPC responses appear as text at `http://<ip>/rpc/<Method>?…`.
- The folder [`dist/`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/tree/main/dist) from the repository. It is checked in and byte-identical with `npm run build` (a test keeps it current); versions: bw_install <!-- fact:ver.bw_install -->0.1.3<!-- /fact -->, bw_main <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, bw_pump <!-- fact:ver.bw_pump -->0.2.0<!-- /fact -->, bw_zeitraffer <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact -->.
- No Node, no terminal, no dependencies. If you later want to run the hardware check or the fast-forward test with the tools, you also need a computer as in chapter [08](08-installation-lokaler-server.md) or [09](09-installation-vps.md).

## Diagram

[![By hand: open dist/, create script, paste code, byte check, installer, console, schedules, cfg2](../diagramme/en/07-installation-per-hand.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/07-installation-per-hand.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/07-installation-per-hand.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Paste and verify", 2 "When bytes are missing", 3 "Installer and target band".

## What works by hand – and what does not

The web UI can do everything the installation needs. The tools in `tools/` merely take the checks off your hands and wait for a safe moment by themselves.

| Task | By hand (this chapter) | With the tools (chapters 08/09) |
| --- | --- | --- |
| Upload scripts | web UI editor, content from `dist/`, then the byte check per script in the browser | `put-script.js` uploads in chunks and compares byte for byte; `verify-scripts.js` checks all scripts |
| Installer | `bw_install` in the web UI with "Start", console open | `hwtest.js <ip> normal 60` waits for the safe moment and afterwards checks the schedule and `auto_off` |
| Check schedule and KVS | web UI → Schedules, `http://<ip>/rpc/Schedule.List`, `http://<ip>/rpc/KVS.GetMany?match=*` | the same RPCs, plus `tools/kvs_dump.sh <ip>` |
| Enter the target band | web UI → Settings → Key-Value Storage, "Format as JSON" | `KVS.Set` via curl |
| Hardware check (chapter 11) | possible but impractical: write the commands by hand as KVS entry `hwc` (text `{"n":1,"cmd":"go"}`, `n` +1 per command), read state and report in `hwr`/`hwp` – `hwtest.js` is the intended way | `start bw_hwtest`, `watch`, `go`, `report` |
| Fast-forward (chapter 12) | only starting the script `bw_zeitraffer` by hand, without pre-check and status line – see below | `zeitraffer 60`, `watch 300`, `normal 60`; measurement run `mess`, calibration run `kal` |

## The seven steps

### Step 1: open dist/ and copy

`dist/` contains the same code as `scripts/`, but without indentation and without the long comments. Only the version line and a short documentation block per script (what the script does, what each setting changes) remain. **Only `dist/` goes into the device, never `scripts/`** – the source files are larger, and the loss on paste was measured with exactly those.

1. Open the file in the repository, for example [`dist/bw_install.js`](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/dist/bw_install.js).
2. Click "Raw" so that only the plain text is shown.
3. Select all (Ctrl+A) and copy (Ctrl+C).

Alternatively download the repository as a ZIP (GitHub: "Code" → "Download ZIP") and open the files from `dist/` in a text editor. Both ways give the same file; the sizes are in the table at step 4.

### Step 2: create the scripts

1. Web UI → Scripts → "Add script".
2. Enter the name **exactly**: `bw_install`, `bw_main`, `bw_pump` – one script per name.
3. Optionally create `bw_zeitraffer` (practice test in fast-forward, chapter 12). Create `bw_hwtest` and `bw_hwpump` only if a computer with `hwtest.js` joins in (chapter 11): every script costs flash.
4. Do not set any script to "Run on startup". The schedule does the starting; the installer switches autostart off for `bw_main` and `bw_pump` anyway (`Script.SetConfig`).

The device assigns the script IDs. The installer finds `bw_main` and `bw_pump` by name (`Script.List`) and reports the IDs in the console; a misspelled name ends with `ABBRUCH: Script bw_main nicht gefunden` (abort: script not found) and `err=cfg` (fault code: configuration).

### Step 3: paste the code and save

1. Open the script in the web UI and clear the editor.
2. Paste the copied content from `dist/` (Ctrl+V).
3. Press "Save". Do **not** start it yet.
4. Repeat for every further script.

> **Measured on the device (12 Sep 2026):** After pasting `scripts/bw_install.js` (12 131 bytes) the device held 11 965 bytes – 166 bytes were missing, exactly the end of the file. `bw_main` lost 210 bytes. Firmware 2.0.0 stores 19 KB as well, so the loss was not a size limit but the path clipboard → editor → `Script.PutCode`. Since then the compact `dist/` files have only been uploaded via RPC; whether the editor takes them without loss: `[TODO am Gerät]` (open until tested on the device). That is why the byte check decides. Full entry with cause and prevention: chapter [18](18-lernlog-geraet.md).

### Step 4: byte check

`Script.GetCode` with `len=1` returns the first byte (`data`) and the number of remaining bytes (`left`). `left + 1` is the size of the code on the device and must equal the file size in `dist/`.

1. Look up the script ID: open `http://<ip>/rpc/Script.List` in the browser; the response lists `id`, `name`, `enable`, `running` per script.
2. Open `http://<ip>/rpc/Script.GetCode?id=<id>&len=1`.
3. Compare `left + 1` with the table.
4. If the number differs: clear the editor, paste the content again (step 3), check again.

| Script | Size in `dist/` (bytes) |
| --- | --- |
| `bw_install` | <!-- fact:dist.bw_install -->15978<!-- /fact --> |
| `bw_main` | <!-- fact:dist.bw_main -->15791<!-- /fact --> |
| `bw_pump` | <!-- fact:dist.bw_pump -->17475<!-- /fact --> |
| `bw_zeitraffer` | <!-- fact:dist.bw_zeitraffer -->7459<!-- /fact --> |
| `bw_hwtest` | <!-- fact:dist.bw_hwtest -->13952<!-- /fact --> |
| `bw_hwpump` | <!-- fact:dist.bw_hwpump -->14500<!-- /fact --> |

The sizes count bytes, not characters (umlauts and dashes in the documentation block take two or three bytes) and include the line break at the end of the file. On any difference, first clear the editor and paste again. If exactly 1 byte is still missing, it is probably just that line break – harmless for the script, not yet seen on the device `[TODO am Gerät]`: press Enter on the last line of the editor, save, check again. If many bytes are missing, text was lost.

> **Note:** The numbers apply to the checked-in state of `dist/`. If you take another release, read the size of your own file (file properties in the operating system or the output of `npm run build`).

### Step 5: start the installer and read the console

`bw_install` creates the nine KVS entries `cfg1`–`cfg4`, `lrn`, `st`, `job`, `day`, `err` (only missing entries and fields, nothing is overwritten), checks that a watering window including the budget `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s and the reserve `tTail` <!-- def:cfg4.tTail -->20<!-- /def --> s ends before the next cycle, builds the schedule from `cfg3`/`cfg4`, sets the switch configuration (output off after a restart, `auto_off` = `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> + 10 = 190 s) and stops itself after a few seconds.

1. Web UI → Scripts → open `bw_install` and open the script's console. This enables the debug websocket; the console must be open **before** the start, otherwise the first line is missing.
2. Press "Start".
3. Read the console: it ends with `fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach` (done – bw_main every 15 min, bw_pump at 08:00 and 20:00 (second 30), budget tWin 420 s, safety-off 8 min later). Before that come the script IDs, `KVS neu angelegt: …` (KVS entries newly created) and one line `Zeitplan #<id>: <timespec>` (schedule entry) per schedule entry.

The installer may run as often as you like. If `bw_main` or `bw_pump` is running at that moment, it aborts with `ABBRUCH: Script bw_main läuft – später erneut starten` (abort: script running – start again later) and sets `err=cfg`; simply start it again later. On the very first run there is no schedule yet, hence no conflict either.

> **Note:** The firmware occasionally rejects the first `Schedule.Create` of a run with "timespec validation". The installer repeats it silently (up to 3 times, 400 ms pause); only a second rejection shows up as `Hinweis: Schedule.Create … abgelehnt` (note: rejected). What counts in the end is that all schedule entries appear in the console.

### Step 6: check the schedule

Web UI → Schedules shows three entries with the defaults `winA` <!-- def:cfg3.winA -->08:00<!-- /def --> and `winB` <!-- def:cfg3.winB -->20:00<!-- /def --> (up to five if the windows have different minutes). `http://<ip>/rpc/Schedule.List` in the browser returns the same as text (`jobs[]` with `id`, `enable`, `timespec`, `calls`).

| Timespec | Call | Meaning |
| --- | --- | --- |
| `0 */15 * * * *` | `Script.Start` bw_main | cycle every `tick` <!-- def:cfg3.tick -->15<!-- /def --> min: measure, evaluate, write the job |
| `30 0 8,20 * * *` | `Script.Start` bw_pump | watering windows at 08:00:30 and 20:00:30 – 30 s after the full minute, so that `bw_pump` never runs next to `bw_main` |
| `0 8 8,20 * * *` | `Switch.Set` off | safety-off 8 min after the window minute (30 s + `tWin` 420 s + 10 s, rounded up to full minutes) |

`http://<ip>/rpc/KVS.GetMany?match=*` shows the KVS; all values are JSON strings, so the objects appear there as text with `\"` quotes.

### Step 7: enter the target band in cfg2

After the installer the six band fields are `null`. As long as one of them is `null`, `bw_main` measures every cycle and writes `why=cfg` (reason against a job: configuration incomplete) together with `err=cfg` – it does not water. That is water-safe, but it is no irrigation either.

1. Web UI → Settings → Key-Value Storage → open the entry `cfg2`.
2. Tick "Format as JSON": the stored string becomes editable as a JSON object.
3. Change only the six band fields, leave all other fields as they are: `pctDry` < `pctLo` < `pctOk` ≤ `pctSoll` < `pctHi`, plus `dropSlow`. In addition `pctLo` + `hyst` (<!-- def:cfg2.hyst -->2<!-- /def -->) must be below `pctOk`.
4. Save. From the next cycle on, the console of `bw_main` shows `why=ok` or another reason instead of `why=cfg`.

Example band from the device (13 Sep 2026, field names in band order): `pctDry` 28 < `pctLo` 40 < `pctOk` 50 ≤ `pctSoll` 55 < `pctHi` 60, `dropSlow` 4. The values belong to a sensor under the dripper and to the calibration `cfg1`; how to derive them for your own pot is in chapter [12](12-erstinbetriebnahme.md).

```json
{"pctSoll":55,"pctLo":40,"pctHi":60,"pctDry":28,"hyst":2,"dropSlow":4,"effMin":0.05,"effMax":30,"alpha":0.3,"sfMin":0.5,"sfStep":0.1,"pctOk":50,"dropW":null,"sfUp":0.05}
```

> **Note:** An entry that is no longer valid JSON after editing (missing quote, extra comma) counts as missing for the scripts: `bw_main` reports `Störung cfg: cfg2.hyst fehlt` (fault cfg: cfg2.hyst missing), the next installer run creates the entry anew with defaults (console: `KVS neu angelegt: cfg2`). Then enter the band again. A partial object (only the six fields) makes sense only **before** the first installer run – it adds the rest; later `KVS.Set` always replaces the whole entry.

## Flash memory for scripts

Flash for scripts is scarce; `http://<ip>/rpc/Sys.GetStatus` shows it as `fs_free` in bytes. Before an upload `put-script.js` demands `fs_free` + old code ≥ new file + 4 096 B – the same rule of thumb applies when pasting by hand, otherwise the device may keep half-written code.

> **Measured on the device (13 Sep 2026):** `fs_free` 12 288 B with seven scripts; after deleting `engine_probe`, `bw_hwtest` and `bw_hwpump` 49 152 B (≈ 36 KB freed); after uploading `bw_pump` (17 475 B) 40 960 B – the file system counts in 4 KB blocks.

If you need space, delete scripts you do not need in the web UI (the hardware test scripts after the test, old probe scripts); a script has to be stopped for that. The operating scripts `bw_install`, `bw_main`, `bw_pump` stay.

## Fast-forward and updates by hand

`bw_zeitraffer` can be run in the web UI with "Start": it backs up `cfg3`, `lrn`/`day`, `st`/`err`, `cfg4`, `cfg2` to `zrb1..5`, writes the profile (cycle <!-- zr:cfg3.tick -->3<!-- /zr --> min, windows every <!-- zr:cfg3.winEvery -->6<!-- /zr --> min, budget <!-- zr:cfg4.tWin -->120<!-- /zr --> s) and starts `bw_install`. Starting `bw_install` again brings you back to normal operation: without the marker `zr` it writes the original back. A complete target band is required – otherwise the fast-forward never waters (`why=cfg`).

> **Fast-forward only:** Without the tool there is no pre-check, no status line and no timetable; the console lines remain readable (web UI → Scripts → `bw_main` or `bw_pump` → console). Timetable, expectations and restoring are in chapter [12](12-erstinbetriebnahme.md).

Both starts need a safe moment, which `hwtest.js` otherwise waits for by itself:

| Condition | Normal operation | In fast-forward |
| --- | --- | --- |
| Second of the minute | 8–30 (the cycle at second 0 is finished, the next one is far away) | 8–30 |
| Distance to the watering window | not within the 9 min after `winA`/`winB` (window up to 30 s + `tWin`, safety-off at 8 min) | not in minutes 0–2 of a 6-minute cycle (that is where `bw_pump` regulates) |
| Running scripts | none of `bw_install`, `bw_main`, `bw_pump`, `bw_hwtest`, `bw_hwpump`, `bw_zeitraffer` is running (web UI → Scripts shows "running") | likewise |

A script update by hand works exactly like the first installation: paste the new file from `dist/` (the script must not be running meanwhile), byte check, then start `bw_install` once – it adds new fields with defaults, rebuilds the schedule and sets `auto_off`. Order, migration from 0.1.x and manual values: chapter [13](13-betrieb-und-wartung.md).

## Example output

Byte check in the browser for `bw_main` (response to `http://<ip>/rpc/Script.GetCode?id=<id>&len=1`; `left` = 15 791 − 1):

```json
{"data":"/","left":15790}
```

Console of `bw_install` with an empty KVS (run in the mock with `node tools/run-script.js scripts/bw_install.js`; on the device the script and schedule numbers are the ones it assigned). `Zeitplan` = schedule, `Einträge, davon eigene` = entries, of which own, `KVS neu angelegt` = KVS entries newly created, `fertig` = done:

```text
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] Zeitplan: 0 Einträge, davon eigene: 0
[bw_install 0.1.3] Switch 0: auto_off 190 s
[bw_install 0.1.3] KVS neu angelegt: cfg1, cfg2, cfg3, cfg4, lrn, st, job, day, err
[bw_install 0.1.3] Zeitplan #1: 0 */15 * * * *
[bw_install 0.1.3] Zeitplan #2: 30 0 8,20 * * *
[bw_install 0.1.3] Zeitplan #3: 0 8 8,20 * * *
[bw_install 0.1.3] fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach
```

First line of `bw_main` before the target band (mock, sensor 1.2 V) and one cycle line with a complete band (README example): `why` is the reason for or against a job, `w` the number of KVS writes, `dauer` the run time; `st=beob` means state "observing".

```text
[bw_main 0.2.0] V=1.2 pct=34.13 tC=24 lvl=0 st=beob dry=0 pause=24h why=cfg sec=- effW=- sf=0.7 err=cfg w=4 dauer=2620ms
[bw_main 0.2.0] V=1.196 pct=34 tC=22 lvl=0 st=beob dry=1 pause=24h why=ok sec=70 effW=- sf=0.7 err=- w=3 dauer=2600ms
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Uncaught SyntaxError: Got EOF expected '}'` at start | end of file lost on paste (12 Sep 2026: 166 bytes for `bw_install`) | byte check; clear the editor, paste again from `dist/`, save, check again |
| `ReferenceError: "…" is not defined` in the middle of a run | a piece from the middle of the file is missing, the function in it does not exist (12 Sep 2026: `evalSamples` in `bw_main`) | as above – check the upload first, suspect the code second |
| `left + 1` differs by exactly 1 byte | probably only the line break at the end of the file is missing – harmless for the script, not yet seen on the device `[TODO am Gerät]` | clear the editor and paste again; if it stays at exactly 1 byte, press Enter on the last line, save, check |
| Key-Value Storage shows `[object Object]` | entries of an old script version (0.1.0) stored as objects instead of JSON strings | delete the entries (per entry `http://<ip>/rpc/KVS.Delete?key=<name>` in the browser or in the web UI under Key-Value Storage), then start `bw_install`: it creates them anew as JSON strings (`KVS neu angelegt: …`); enter the target band again afterwards. The installer alone does not replace object entries, it only adds missing fields |
| `ABBRUCH: Script bw_main nicht gefunden`, `err=cfg` | script name misspelled or script missing | names exactly `bw_main`/`bw_pump`, start the installer again |
| `ABBRUCH: Script bw_main läuft – später erneut starten` | installer started during a cycle or a window | wait for a safe moment (second 8–30, not within the 9 min after the window), start again |
| Console stays empty at start | console opened only after "Start"; the installer is done after a few seconds | open the console first (debug websocket), then start; alternatively check the result via `Schedule.List` and `KVS.GetMany` |
| A script is set to "Run on startup" | autostart set in the web UI | switch it off; `bw_pump` with autostart could water outside the windows after a restart |
| `bw_main` keeps writing `why=cfg` | a band field is still `null`, the band violates the order, or `cfg2` is no longer valid JSON | check all six fields (`pctDry` < `pctLo` < `pctOk` ≤ `pctSoll` < `pctHi`, `pctLo` + `hyst` < `pctOk`), read the console for `Störung cfg: …` |
| `fs_free` in `Sys.GetStatus` is smaller than file size + 4 096 B | flash for scripts is scarce (13 Sep 2026: 12 288 B free with seven scripts) | delete scripts you do not need (≈ 36 KB from the three test scripts), then paste |

## Next

- [06 · Step-by-step start guide](06-startanleitung.md) – from step 6 on: check `cfg1`, set up at the pot, read the first console line and follow the first watering window.
- [12 · First commissioning](12-erstinbetriebnahme.md) – calibration, deriving the target band, practice test in fast-forward.
- [13 · Operation and maintenance](13-betrieb-und-wartung.md) – reading the console, changing values, updating scripts.
