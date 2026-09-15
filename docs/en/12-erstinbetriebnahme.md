# 12 · First commissioning: calibration, target band, fast-forward, first window

[Deutsch](../de/12-erstinbetriebnahme.md) · **English** — [Handbook](README.md) · Part D "Operate"

> **At a glance**
> - Outcome: the values that make the device water correctly – `cfg1` (sensor scale), the target band in `cfg2`, the learned value `lrn.effW` and the dead times `cfg3.tDead`/`cfg4.tDead2` – and the whole control loop seen once in 45 minutes.
> - Order: measure `cfg1` → enter the target band → installer (`normal`) → pulse test (`mess`) → practical test in fast-forward (`zeitraffer`) → calibration run (`kal`) → follow the first real window.
> - Key number: fast-forward runs the same scripts with a cycle of <!-- zr:cfg3.tick -->3<!-- /zr --> min and a watering window every <!-- zr:cfg3.winEvery -->6<!-- /zr --> min, budget <!-- zr:cfg4.tWin -->120<!-- /zr --> s per window, up to <!-- zr:cfg4.nPort -->3<!-- /zr --> portions – with real learning.
> - Biggest pitfall: the hose must lie **at the sensor** (otherwise fault `noeff`, "no effect"), and before every further window the sensor must go back into dry soil (otherwise `why=feucht`, "moist": no watering).

## Prerequisites

- Installation finished ([06 · Start guide](06-startanleitung.md)): `bw_install`, `bw_main`, `bw_pump` and `bw_zeitraffer` uploaded from `dist/` and verified byte-identical, installer run, schedule `0 */15 * * * *`, `30 0 8,20 * * *`, `0 8 8,20 * * *`.
- Hardware check passed ([11 · Hardware check](11-hardware-check.md)): sensors deliver values, `lvlEmpty` confirmed, pump ran; `cleanup` done, no leftovers `hwb1`/`hwb2` in the KVS.
- Node ≥ 22 on a computer that can reach the Shelly – on the LAN or through the tunnel `127.0.0.1:8010` ([09 · Installation with a VPS](09-installation-vps.md)); `<ip>` stands for that address throughout this chapter.
- Debug websocket on: web UI → Scripts → any script → open the console; `node tools/hwtest.js <ip> preflight` reports "Debug-Websocket an/aus" (on/off). Without it `watch`, `console.js` and the recorder of `kal` show no console lines, and `kal write` cannot set `tDead`/`tMin`.
- At the pot: SMT50 under the drippers (wettest spot – the scale refers to it), hose at the sensor, tank full, float switch above the pump inlet. For fast-forward additionally a glass of water, a cup of warm water (above 30 °C) for the DS18B20 and a second pot with dry soil.
- Versions in this chapter: `bw_zeitraffer` <!-- fact:ver.bw_zeitraffer -->0.2.0<!-- /fact -->, `bw_main`/`bw_pump` <!-- fact:ver.bw_main -->0.2.0<!-- /fact -->, `hwtest.js` <!-- fact:ver.hwtest -->0.1.2<!-- /fact -->.

## Diagram

[![First commissioning: from cfg1 via target band, installer, pulse test, fast-forward and calibration run to the first real window](../diagramme/en/12-erstinbetriebnahme.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/12-erstinbetriebnahme.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/12-erstinbetriebnahme.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Calibration", 2 "Fast-forward timetable", 3 "Adopt the learned values".

## The seven stations

| No | Station | Command or action | Result | Duration |
| --- | --- | --- | --- | --- |
| 1 | Sensor calibration | `bw_hwtest` (phases m1/m2) or read the voltmeter in the web UI | `cfg1.vDry`, `cfg1.vWet` | minutes (sensor test on 13 Sep 2026: 532 s for all six phases) |
| 2 | Target band | read the reference values at the plant, write `cfg2` via `KVS.Set` | six fields in band order | days (the plant has to dry out once) |
| 3 | Installer | `node tools/hwtest.js <ip> normal 60` | missing fields added, schedule and `auto_off` verified | 1 min |
| 4 | Pulse test | `node tools/hwtest.js <ip> mess 10 1` | dead time and gain of one pulse, start values for `cfg3`/`cfg4` | a good 1.5 min per pulse (observation default 90 s, with `mess 10 1 240` a good 4 min) |
| 5 | Practical test in fast-forward | `zeitraffer 60` → `watch 300` → `normal 60` | four windows, pause, heat, `wasser` (water), `limit` seen | 45 min |
| 6 | Calibration run | `kal` → `normal 60` → `kal report` → `kal write` | `lrn.effW`, `cfg4.tDead2`, `cfg3.tDead`, `cfg3.tMin` | 40 min (default 2 400 s) |
| 7 | First real window | `node tools/console.js <ip> 900` from 07:59 or 19:59 | portion lines, `ergebnis=` (result), cycle 08:45/20:45 `Kontrolle:` (check) | 15 min of reading along |

Stations 1 and 2 are prerequisites for everything else: without `cfg1` the percentage scale is wrong, without a complete band the device never waters (`why=cfg`, configuration incomplete). Stations 4 to 6 are the way to reliable learned values; station 7 is the acceptance test.

## Sensor calibration cfg1

The moisture scale is a calibration of your own, not a manufacturer formula: `pct = (V − vDry) / (vWet − vDry) · 100`. **0 % = sensor dry in air, 100 % = sensor in water**; 100 % is a calibration point, never a target. Start values: `vDry` <!-- def:cfg1.vDry -->0.20<!-- /def --> V, `vWet` <!-- def:cfg1.vWet -->3.13<!-- /def --> V.

> **Measured on the device (13 Sep 2026):** dry point 0.296 V (sensor wiped, in air; 0.20 V in the web UI on 12 Sep), wet point 3.134 V – written to `cfg1` by `bw_hwtest` (`vDry` 0.20 → 0.296, `vWet` 3.13 → 3.134).

Route A – the hardware test measures and writes (moisture phases only; procedure and commands in [11 · Hardware check](11-hardware-check.md)):

```bash
node tools/hwtest.js <ip> preflight hw          # creates bw_hwtest and bw_hwpump, prints the upload commands with IDs
node tools/put-script.js <ip> <id> dist/bw_hwtest.js
node tools/hwtest.js <ip> cfg run='"m"'         # only phases m1 (sensor dry) and m2 (sensor in water)
node tools/hwtest.js <ip> start bw_hwtest 20    # per phase: watch 120, sensor dry or in the glass of water, then go
node tools/hwtest.js <ip> report                # new cfg1.vDry/vWet, old>new under cal
node tools/hwtest.js <ip> delete bw_hwtest      # free flash once the test is no longer needed
```

Route B – by hand: sensor clean and dry in the air, read the voltmeter voltage in the web UI (or `V=` in the first console line of `bw_main`); then into the glass of water up to the mark, read again. Enter both values:

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg1","value":"{\"vDry\":0.296,\"vWet\":3.134}"}'   # a partial object is enough before the installer
```

> **Note:** `KVS.Set` replaces the whole entry. Before the installer the partial object is enough (it adds the remaining fields with start values). Changing a field later: web UI → Settings → Key-Value Storage → open the entry → "Format as JSON" → change only that field – or run the installer again after a partial write.

## Reference values at the plant and target band cfg2

The target band is five moisture values plus `dropSlow`. The installer creates them as `null` (`pctOk` <!-- def:cfg2.pctOk -->null<!-- /def -->, `dropSlow` <!-- def:cfg2.dropSlow -->null<!-- /def -->); as long as one of the six fields is `null`, the system measures and logs but does not water (`err=cfg`, `why=cfg`). The values come from two measurements at the plant:

1. **Upper reference** ("well supplied"): sensor in the pot, water generously once, wait 30 minutes, read `pct=` in the console. `[TODO am Gerät]`
2. **Lower reference** ("water now"): wait until the plant visibly needs water and the soil is dry at depth too, read `pct=`. `[TODO am Gerät]`
3. **`dropSlow`:** on a normal day without watering read the decrease over 24 h (`pct=` in the morning and the next morning), enter about half of it. If the decrease stays below that, the long pause `pauseSlow` applies (suspected waterlogging). `[TODO am Gerät]`

| Field | Rule | Example band (device since 13 Sep 2026) |
| --- | --- | --- |
| `pctDry` | clearly below `pctLo`; the dry phase ends as soon as a cycle reading is below it | 28 |
| `pctLo` | lower reference: cycle reading below it → job (a running job holds until `pctLo + hyst`) | 40 |
| `pctOk` | "target reached": the window ends as soon as the stable moisture reaches this value; fresh reading `≥ pctOk` → `feucht` | 50 |
| `pctSoll` | target point of the dose calculation, a few percent above `pctOk` (midway between lower and upper reference) | 55 |
| `pctHi` | upper reference plus a few percent: above it in the window `over`; cycle reading above it = wet → dry phase | 60 |
| `dropSlow` | %/24 h, see step 3 | 4 (left from the 0.1.x run, still to be measured at the plant) |

Order: `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` and `pctLo + hyst < pctOk` (`hyst` <!-- def:cfg2.hyst -->2<!-- /def --> %), otherwise the cycle aborts with `err=cfg`. Enter it (partial object before the installer, field names in band order):

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctDry\":28,\"pctLo\":40,\"pctOk\":50,\"pctSoll\":55,\"pctHi\":60,\"dropSlow\":4}"}'
```

The remaining `cfg2` fields (`hyst`, `effMin`, `effMax`, `alpha`, `sfMin`, `sfStep`, `sfUp`, `dropW`) are added by the installer with start values. What each field does in the control loop is in [03 · Configuration](03-konfiguration.md); how the cycle decides with them, in [02 · Flow](02-flussdiagramm.md).

## Starting the installer: normal

`node tools/hwtest.js <ip> normal 60` waits for a safe moment, starts `bw_install`, reads the console for 60 s and then verifies the result. The installer creates missing entries and fields (nothing is overwritten), checks the window rules, rebuilds the schedule from `cfg3`/`cfg4`, sets `auto_off` = `tMax` + 10 = 190 s and stops itself. If `bw_main` or `bw_pump` is running, it aborts – the tool prevents that with the safe moment.

After the run the tool reports `ok` or `ABWEICHUNG` (deviation) per item: schedule (three own entries `0 */15 * * * *`, `30 0 8,20 * * *`, `0 8 8,20 * * *`), `auto_off 190 s`, `keine Zeitraffer-Sicherung` (no fast-forward backup), `cfg3/cfg4: Takt 15 min, Fenster 08:00/20:00, tMax 180 s, tWin 420 s, Sicherheits-Aus +8 min`, script errors, free script heap – and closes with `NORMALBETRIEB – Zeitplan und Konfiguration wie erwartet` (normal operation – schedule and configuration as expected). On deviations: read the console, repeat `normal`.

The same command after every script update: the installer adds new fields (for 0.1.x → 0.2.0: `cfg4`, `cfg2.pctOk`/`dropW`/`sfUp`, `cfg3.dryDay`, `lrn.effW`) – but `pctOk` only as `null`; you enter the value yourself.

> **Note:** Starting `bw_main` by hand in the web UI is allowed, but not in seconds 0–8 of a cycle minute (otherwise it runs next to the scheduled start). The first line must show `V=` (voltage), `tC=` (temperature) and `lvl=` 0 or 1; otherwise adjust `cfg1.idV`/`idT`/`idLvl`.

## Pulse test mess: effect of one pump pulse

Before changing time values in `cfg3`/`cfg4`, take a look at the real setup. `node tools/hwtest.js <ip> mess [sek] [n] [beob]` switches the pump on `n` times (default 3, at most 6) for `sek` seconds (default 3, at most 10) with `Switch.Set toggle_after` and reads the sensor every 2 s over `beob` seconds per pulse (default 90, 30–300). Pure tool, no device code.

- Preconditions: output off, float switch FULL, voltmeter plausible, no fast-forward active (`zrb1`); then it waits for the safe moment (no script running, not until 9 min after a window).
- Per pulse it prints: moisture before, peak with time, settled value with settling time, `tRise` (first reaction ≥ 1 %), gain in %/effective second (gross %/s) and when the output went off.
- At the end suggestions as start values: `effMax`, `tPmin`, `tDead`, `tMin`, `tSoak`, `tStab`. `cfg4.tDead2` you read yourself from `tRise` of the follow-up pulses (`kal write` sets it later from the calibration run). Raw data: `docs/kal/<datum>-mess.json`.

> **Measured on the device (13 Sep 2026):** SMT50 centred in dry soil, two drippers directly above it. **3-s pulses measure only the hose**: dead time 5–8 s, then trailing water creeps for minutes (+2 to +12 %, settled only after 65–160 s). **One 10-s pulse** at 37.5 % reacts after 7.9 s, reaches the peak of 49.1 % five seconds after switching off (+11.6 % = 5.6 %/effective s) and stays stable afterwards.

| Run | Pulse | Moisture before → peak (t) → settled | `tRise` | Gain | Finding |
| --- | --- | --- | --- | --- | --- |
| 14:54 | 3 s | 10.4 → 10.7 | – | – | no reaction: the pulse only fills the empty hose |
| 14:56 | 3 s | 10.7 → 20.2 (86 s) | 5.3 s | +9.5 % | jump within 10 s, then creeping up to 86 s |
| 14:58 | 3 s | 20.2 → 31.9 (80 s) | 5.5 s | +11.7 % | as above, creeping +8 % between 20 and 87 s |
| 15:01 | 3 s | 34.0 → 36.1 (162 s) | 7.8 s | +2 % | in moister soil almost only trailing water |
| 15:05 | 3 s | 35.7 → 37.8 (65 s) | 7.9 s | +2 % | ditto |
| 15:10 | 10 s | 37.5 → 49.1 (15 s), stable for 2 min | 7.9 s | +11.6 % = 5.6 %/effective s | rise while pumping, settled 5 s after switching off |

From this the start values `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s, `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> s, `tMin` <!-- def:cfg3.tMin -->25<!-- /def --> s, `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s, `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s, `effMax` <!-- def:cfg2.effMax -->30<!-- /def --> and the rule: **portions never shorter than the dead time.** Side findings: no voltage dips at the voltmeter while the pump runs, fresh values at a 2-s polling rate.

## Practical test in fast-forward (45 minutes)

### What fast-forward does

In normal operation it takes days until you have seen window, pause, heat rule and daily limit once. Fast-forward runs **the same operating scripts `bw_main` and `bw_pump` unchanged, only with short times**: cycle 3 min instead of 15, watering window every 6 min instead of 08:00/20:00, window budget 120 s with up to 3 portions and real learning, pause 12 min (heat 6 min), daily limit 4, dry phase off.

`bw_zeitraffer` backs up the operating values (`cfg3`, `lrn`+`day`, `st`+`err`, `cfg4`, `cfg2` → `zrb1`–`zrb5`), writes the profiles, resets the state, writes the marker `zr` last and starts `bw_install`, which builds the schedule. **`bw_install` brings everything back:** if it finds the backup without the marker, it restores the original – learned values, pause and daily counters are as before the test; test waterings and test learning do not count.

### Start and commands

Prerequisites the tool checks in advance (every violation is a `BLOCKER`): target band complete and ordered (including `pctOk`), `cfg3.tick` present (installer run), input delivers a value and float switch FULL, output off, the four scripts present and with code, no `hwb1`/`hwb2`. A standing fault `noeff` is only a warning: fast-forward sets it aside, `bw_install` restores it afterwards.

```bash
npm run build                                   # dist/ up to date?
node tools/hwtest.js <ip> preflight             # creates bw_zeitraffer, prints the upload command with ID
node tools/put-script.js <ip> <id> dist/bw_zeitraffer.js
node tools/hwtest.js <ip> normal 60             # installer: adds fields, builds the schedule
node tools/hwtest.js <ip> zeitraffer 60         # pre-check, safe moment, start, verification of schedule/cfg3/cfg4/auto_off, timetable
node tools/hwtest.js <ip> watch 300             # console + status line (st, n, pctW, why, err, memory), as often as you like; up to 1800 s in fast-forward
node tools/hwtest.js <ip> normal 60             # back: original from zrb1..5, schedule and auto_off verified
```

After the start the tool verifies: schedule `0 */3 * * * *`, `30 */6 * * * *` and `40 2,8,14,20,26,32,38,44,50,56 * * * *` (safety-off), `auto_off` 50 s (`tMax` 40 + 10), backup `zrb1..5` present, marker `zr` consumed, profile in `cfg3`/`cfg4`. Then it reports `ZEITRAFFER AKTIV – mitlesen: … watch 300 · zurück: … normal` (fast-forward active – read along … back …) and prints the timetable below it.

### Safe moment

`zeitraffer`, `normal`, `mess` and `kal` start only in a safe moment and wait up to 4 minutes for it: second 8–30 of a minute (`bw_main` reads and writes in the first seconds of every cycle), in fast-forward not in minutes 0–2 of a 6-minute cycle (there `bw_pump` regulates for up to 120 s), in normal operation not until 9 min after `winA`/`winB` (window up to 30 + `tWin` s, safety-off at +8 min), and no operating or test script running. A rebuild in between would be lost. Anyone starting `bw_zeitraffer` or `bw_install` by hand in the web UI follows the same rule.

### Profile

`ZR3`/`ZR4` in `scripts/bw_zeitraffer.js`, documented per field there and changeable; all other fields in `cfg3`/`cfg4`/`cfg2` stay as they are.

| Field | Normal | Fast-forward | Effect in the test |
| --- | --- | --- | --- |
| `tick` | <!-- def:cfg3.tick -->15<!-- /def --> min | <!-- zr:cfg3.tick -->3<!-- /zr --> min | `bw_main` measures and decides every 3 minutes |
| `winEvery` | <!-- def:cfg3.winEvery -->null<!-- /def --> | <!-- zr:cfg3.winEvery -->6<!-- /zr --> min | `bw_pump` runs in every minute ≡ 0 mod 6 (second 30) instead of at `winA`/`winB` |
| `soak` | <!-- def:cfg3.soak -->30<!-- /def --> min | <!-- zr:cfg3.soak -->0.25<!-- /zr --> min | check at the next cycle (150 s after the window start) |
| `pauseHot` | <!-- def:cfg3.pauseHot -->12<!-- /def --> h | <!-- zr:cfg3.pauseHot -->0.1<!-- /zr --> h (360 s) | heat: next window 6 min after the last one |
| `pause` | <!-- def:cfg3.pause -->24<!-- /def --> h | <!-- zr:cfg3.pause -->0.2<!-- /zr --> h (720 s) | normal: next window 12 min after the last one |
| `pauseSlow` | <!-- def:cfg3.pauseSlow -->48<!-- /def --> h | <!-- zr:cfg3.pauseSlow -->0.35<!-- /zr --> h | never active (needs a 24 h series) |
| `jobAge` | <!-- def:cfg3.jobAge -->20<!-- /def --> min | <!-- zr:cfg3.jobAge -->5<!-- /zr --> min | the job may be at most 5 min old at the window (cycle → window 3.5 min) |
| `maxDay` | <!-- def:cfg3.maxDay -->2<!-- /def --> | <!-- zr:cfg3.maxDay -->4<!-- /zr --> | four windows in the test, then `limit` |
| `tDead` / `tMin` / `tStd` / `tMax` | <!-- def:cfg3.tDead -->20<!-- /def --> / <!-- def:cfg3.tMin -->25<!-- /def --> / <!-- def:cfg3.tStd -->70<!-- /def --> / <!-- def:cfg3.tMax -->180<!-- /def --> s | <!-- zr:cfg3.tDead -->2<!-- /zr --> / <!-- zr:cfg3.tMin -->10<!-- /zr --> / <!-- zr:cfg3.tStd -->12<!-- /zr --> / <!-- zr:cfg3.tMax -->40<!-- /zr --> s | first portion 12 s without a learned value; sum per window 40 s; `auto_off` 50 s |
| `tChk` | <!-- def:cfg3.tChk -->5<!-- /def --> s | <!-- zr:cfg3.tChk -->1<!-- /zr --> s | water level checked every second during a portion |
| `tHot` | <!-- def:cfg3.tHot -->35<!-- /def --> °C | <!-- zr:cfg3.tHot -->30<!-- /zr --> °C | hand warmth or a cup of warm water is enough (35 only with a hair dryer) |
| `dryDay` | <!-- def:cfg3.dryDay -->5<!-- /def --> (Friday) | <!-- zr:cfg3.dryDay -->null<!-- /zr --> | no dry day |
| `cfg4` window | `tWin` <!-- def:cfg4.tWin -->420<!-- /def -->, `tTail` <!-- def:cfg4.tTail -->20<!-- /def -->, `nPort` <!-- def:cfg4.nPort -->6<!-- /def -->, `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def -->, `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> | `tWin` <!-- zr:cfg4.tWin -->120<!-- /zr -->, `tTail` <!-- zr:cfg4.tTail -->20<!-- /zr -->, `nPort` <!-- zr:cfg4.nPort -->3<!-- /zr -->, `tPmin` <!-- zr:cfg4.tPmin -->10<!-- /zr -->, `tPmax` <!-- zr:cfg4.tPmax -->15<!-- /zr --> | window ≤ 120 s, up to 3 portions of 10–15 s |
| `cfg4` measuring | `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def -->, `tStep` <!-- def:cfg4.tStep -->5<!-- /def -->, `tStab` <!-- def:cfg4.tStab -->60<!-- /def -->, `nStab` <!-- def:cfg4.nStab -->4<!-- /def -->, `dStab` <!-- def:cfg4.dStab -->1<!-- /def -->, `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def -->, `dEffMin` <!-- def:cfg4.dEffMin -->2<!-- /def --> | `tSoak` <!-- zr:cfg4.tSoak -->10<!-- /zr -->, `tStep` <!-- zr:cfg4.tStep -->5<!-- /zr -->, `tStab` <!-- zr:cfg4.tStab -->30<!-- /zr -->, `nStab` <!-- zr:cfg4.nStab -->3<!-- /zr -->, `dStab` <!-- zr:cfg4.dStab -->1<!-- /zr -->, `tDead2` <!-- zr:cfg4.tDead2 -->0<!-- /zr -->, `dEffMin` <!-- zr:cfg4.dEffMin -->1<!-- /zr --> | soak-in 10 s, stability from 3 values within 30 s, no dead time for follow-up portions |
| `cfg2.pctDry` | 28 (example band) | <!-- zr:cfg2.pctDry -->pctLo − 1<!-- /zr --> | dry phase practically off – the sensor under the hose stays wet |

### Why the odd pauses

`bw_main` calculates the pause with two cycles of lead: `(now + 2·tick·60) − st.ts ≥ pause·3600`, because the job is created one cycle before the window. The watering starts at second 30 of the window minute T. So `pauseHot` 0.1 h (360 s) is satisfied at cycle T+3 (510 s) → job at T+3, window at T+6:30; `pause` 0.2 h (720 s) at cycle T+9 (870 s) → window at T+12:30.

The window budget of 120 s ends with the reserve `tTail` 20 s before cycle T+3 (30 + 120 + 20 ≤ 180). The scheduled safety-off fires 160 s after the window minute: minute T+2, second 40 – hence the minute list `40 2,8,14,…,56 * * * *`.

### Timetable

Minutes from the start S, a full 6-minute mark. `why` is in the console line of `bw_main` and in the status line of `watch`; the expectations are stored in the mock as a test (`tools/test/zeitraffer.test.js` with a pot model).

| Minute | Action | Expectation |
| --- | --- | --- |
| before 0 | SMT50 into the glass of water (or into moist soil between `pctLo` and `pctHi`), float switch FULL, `zeitraffer 60` | `bw_install`: "ZEITRAFFER aktiv", schedule `0 */3`, `30 */6`, `40 2,8,…,56`, `auto_off` 50 s |
| 0, 3 | – | glass of water (≈ 100 % > `pctHi`) → `why=trocken` (dry phase) with console line `Trockenphase (nass 100 %): warte auf < 39 %` (dry phase (wet 100 %): waiting for < 39 %); moist soil (≥ `pctLo`) → `why=feucht`. Both: no job; 0:30 `bw_pump`: `kein Auftrag` (no job) |
| 3 (after the cycle) | SMT50 into dry soil, hose at the sensor | minute 6 `why=ok sec=12`; **6:30 window 1**: `Fenster: Auftrag 12 s …` (window: job 12 s), `m0 … → P1 12 s`, `P1 12s: …`, possibly `P2 …`, `ergebnis=… n=… effW=…`; minute 9 `Kontrolle: …`, then `st=sperre why=pause` (locked, pause) |
| 9–14 | SMT50 into the second pot with dry soil (hose along) | minute 15 `why=ok` with `sec` from `effW`; **18:30 window 2** (12 min after window 1): first portion below the target, correction portion up to `pctOk` |
| 19 | DS18B20 into warm water until `tC` > 30; sensor back into dry soil | minute 21 `tC=31 pause=0.1h why=ok`; **24:30 window 3** (6 min after window 2: heat rule) |
| 25 | float switch to EMPTY | minute 27 `why=wasser err=wasser`; 30:30 does not pump |
| 31 | float switch to FULL, sensor into dry soil | minute 33 `why=ok`; **36:30 window 4**; minute 39 `why=limit` (daily limit 4) |
| 40 | `normal 60` | `bw_install`: `Zeitraffer beenden: Original aus zrb1..5 zurück: …` (ending fast-forward: original restored), schedule `0 */15`, `30 0 8,20`, `0 8 8,20`, `auto_off` 190 s, `zrb1..5`/`zr` deleted |

Optional: float switch to EMPTY during a portion → `ergebnis=abbruch err=wasser` (abort); leave the sensor in the glass of water for a window → `m0 … > pctHi – nass` (wet) without watering.

### How to recognise the control loop

The console of `bw_pump` shows per window a header line, one line per portion and a result line – on 13 Sep 2026 in window 1: `Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s` (`Frist` = deadline) → `m0 10.4 % → P1 12 s` → `P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)` → `P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)` → `ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1`.

A `P` line names moisture before → after the portion, the gain of this portion, `g` = window gain so far per effective second (all portions since `m0` together, hence `P2` 2.006 = (23.6 + 16.5) / (10 + 10)), the first reaction after `tRise` s and the stabilisation time (`stabil`/`unstabil` = stable/unstable). The correction portion `P2` comes from the gain measured in `P1`, clamped to `tPmin` 10 s. The next cycle shows `Kontrolle: 50.5 → 53.7 % sf=0.7`.

### Restore and verification

`normal 60` starts `bw_install` in a safe moment; without the marker `zr` it restores the original (`Zeitraffer beenden: Original aus zrb1..5 zurück: cfg3,lrn,day,st,err,cfg4,cfg2,job`) and builds the normal schedule. Afterwards the tool checks the schedule, `auto_off` = `tMax` + 10, that `zrb1..5` and `zr` are gone, that `cfg3.winEvery` is `null`, and reports script errors. After the return `job` is fresh (`bw_main` rewrites it in the next cycle); an `effW` learned in the test does not carry over – the original is in `zrb2`, learned values for operation come from the calibration run.

### Pitfalls

- **Learning is real:** `tDead` 2 < `tStd` 12 → effective seconds; `bw_pump` learns `lrn.effW` already in window 1 and doses window 2 from it. If the effect fails twice (hose not at the sensor), `noeff` blocks – then delete `err` and check the hose. If you only want to see the mechanics: `cfg4.nPort` 1 and the hose into a bucket (single portion without measuring and without a learned value).
- **Heat stays:** the daily maximum sits in `lrn.tMaxD` until midnight; from the warming on, `pauseHot` applies for the rest of the test. That is why heat comes only after the normal pause in the timetable.
- **Move the sensor:** after a learned window the moisture is above `pctOk`. For the next window to water, the cycle before it must see `pct < pctLo` – so put the sensor into dry soil in time (the fresh reading in the window checks it again: `feucht` without watering).
- `preflight` occasionally reports "bw_main läuft" (running) during fast-forward (every 3 min): normal. If the status line shows `out_of_memory`, run `normal` immediately.
- A fault `noeff` that stood before the test comes back after the return.

### KVS entries of fast-forward

| Entry | Content | Who deletes it |
| --- | --- | --- |
| `zrb1` | copy of `cfg3` | `bw_install` on restore |
| `zrb2` | `lrn` and `day` | `bw_install` on restore |
| `zrb3` | `st` and `err` | `bw_install` on restore |
| `zrb4` | `cfg4` | `bw_install` on restore |
| `zrb5` | `cfg2` (original with the real `pctDry`) | `bw_install` on restore |
| `zr` | start marker `{go:1}`, written last by `bw_zeitraffer` | `bw_install` when creating the fast-forward schedule; if the start aborts before that, the next installer run restores |

## Calibration run kal: dry, medium moist, wet

### Procedure

`node tools/hwtest.js <ip> kal [sek]` is fast-forward with a recorder (default 2 400 s, 600–3 600): it starts like `zeitraffer` (pre-check, safe moment, verification), shows its own timetable, records every 5 s sensor values and output, every change of `st`/`job`/`lrn` and the console lines of `bw_pump` to `docs/kal/<datum>-kal.json` (saved every minute) and prints the report at the end. Ctrl+C ends earlier; fast-forward then keeps running.

```bash
node tools/hwtest.js <ip> kal 2400        # fast-forward + recorder; sensor into dry soil beforehand
node tools/hwtest.js <ip> normal 60       # restore (mandatory before kal write)
node tools/hwtest.js <ip> kal report      # report from the newest recording; optional: kal report <json> <watch-log>
node tools/hwtest.js <ip> kal write       # writes lrn.effW, cfg4.tDead2, cfg3.tDead, cfg3.tMin; before/after in the output
```

### States

The reference states are mapped onto the normal target band (`tools/lib/kal.js`, calculation core without a device):

| State | Range (example band) | Meaning | Watering and learned value |
| --- | --- | --- | --- |
| trocken (dry) | below `pctDry` (< 28 %) | soil after a dry phase | yes |
| mittel (medium) | `pctDry`…`pctLo` (28–40 %) | this is where the everyday watering job arises | yes |
| band | `pctLo`…`pctHi` (40–60 %) | target range, no watering | no (`feucht`) |
| nass (wet) | above `pctHi` (> 60 %) | in real operation the dry phase starts here; in fast-forward it ends below `pctLo − 1` | no (`trocken`), reference only |

### Timetable of the calibration run

As `kal` prints it (F1 = first window, the first 6-minute mark after the first cycle, second 30; hose at the sensor):

1. Before the start: sensor in dry soil (below `pctLo`, ideally below `pctDry`) → cycle `why=ok`, F1 (dry): portions up into the band. Leave the sensor in place.
2. F1+3: check (trailing water under the dripper). Then sensor into medium moist, pre-moistened soil (28–40 %) → pause 12 min: F1+9 `why=ok`, F1+12:30 F2 (medium). Leave it in place.
3. F2+3: check. Then sensor into the wet substrate or the glass of water (above `pctHi`) → `why=trocken`, window without a job; leave it in for at least 3 min (reference wet).
4. Optional: sensor back into dry soil → F3 after the pause (second dry value), up to `maxDay` 4 (`why=limit`).
5. End: Ctrl+C or time up → `normal 60` → `kal report` → `kal write`.

### kal report

The report shows per window the state (after `m0`), portions, Σ seconds, `tRise`, peak, settled value, `pctW`, `effW`, `why` (with the check value) and the gain per state; plus the wet reference and the suggestions.

The console lines are decisive: `st.effW` calculates with the dead times of the fast-forward profile (`tDead` 2, `tDead2` 0), but on the device the water arrived after 8 and 5 s. The report therefore converts the learned value to the scale **"% per second after `tRise`"**: 40.1 % in (12 − 8) + (10 − 5) = 9 effective seconds → 4.46 %/s instead of 2.0 in the profile measure. With the profile measure, normal operation (`tDead` 20) would have calculated doses that are too large.

If the lines are missing from the recording (recorder before `hwtest.js` 0.1.2, lines lost at the websocket), `kal report <json> <log>` pulls them from a log that contains the `bw_pump` lines (`watch` log or `console.js`). If the websocket was off, no such log exists: then it stays with the profile measure and `ACHTUNG` (warning), `kal write` leaves `cfg3.tDead`/`tMin` unchanged and would write `effW` in the profile measure – repeat the run with the websocket switched on.

### kal write

`kal write [datei] [log]` refuses as long as `zrb1` exists (`Zeitraffer aktiv (zrb1) – erst: … normal`: fast-forward active, run normal first) or an operating script is running, and otherwise writes by read-modify-write:

| Field | Source | Rule |
| --- | --- | --- |
| `lrn.effW` | mean of the window learned values (regular windows only: `ok`, `over`, `max`, `zeit`, `stall`, `unstab`) | adopted if no previous value; existing value → blend α 0.5 |
| `cfg4.tDead2` | median `tRise` of the follow-up portions | replaces the value |
| `cfg3.tDead` | median `tRise` of the first portions from the console lines | replaces the value; without console lines left unchanged (the report then only shows a rough proposal from the samples, 5-s grid) |
| `cfg3.tMin` | `max(tPmin, tDead + 2)` | portions never below 10 s; otherwise the clamp would water far past the target with a short hose (13 Sep 2026: 25 → 10) |

> **Measured on the device (13 Sep 2026, `kal write` 16:06):** `lrn.effW` null → 4.46, `cfg4.tDead2` 8 → 5, `cfg3.tDead` 20 → 8, `cfg3.tMin` 25 → 10. The dead time belongs to the hose, not to the script: the final setup with a longer hose (10–20 s water travel time) needs a new `mess`, then check `tDead` and `tMin`. `[TODO am Gerät]`

## Following the first real window

The first window in normal operation is the acceptance test. Conditions: the cycle reading at 07:45 or 19:45 is below `pctLo` (otherwise `why=feucht` and no watering), no pause is running, `day.n` below `maxDay`, tank full. With `lrn.effW` from `kal write` the cycle calculates the first portion from the dose formula – example with the device values: 30 % → (55 − 30) / 4.46 · 0.7 + 8 ≈ 12 s; without a learned value a flat `tStd` 70 s.

1. Connect the console before the start: `node tools/console.js <ip> 900` from 07:59 or 19:59 (reads 900 s, until the next cycle; otherwise the first line is missing). Or web UI → Scripts → `bw_pump` → console.
2. Do not use `hwtest.js watch`: in normal operation it ends after a few seconds because no test script and no fast-forward is running.
3. Expected: `Fenster: Auftrag … s, pct …, effW … sf 0.7, Frist 420 s`, `m0 … → P1 … s`, `P1 …`, possibly `P2 …`, `ergebnis=… effW=…`.
4. In the first cycle at least 30 min (`soak`) after the window ends – 08:45 or 20:45 in normal operation, i.e. after `console.js` has finished – `Kontrolle: pctW → pctA %` appears; no second learned value.
5. Then check in the KVS: `lrn.effW` between `effMin` and `effMax`, `st.n`/`sec`/`pctB`/`pctW`/`effW`/`why` filled, after the check also `st.pctA`.

Watering by hand for testing and all console lines: [13 · Operation and maintenance](13-betrieb-und-wartung.md). The first real window at 20:00 with dry soil is still open on the device: `[TODO am Gerät]`.

## Status as of 13 Sep 2026 and open items

| Done | Result |
| --- | --- |
| sensor test `bw_hwtest` | all six phases ok, `cfg1.vDry`/`vWet` 0.296/3.134 V written, `lvlEmpty` 1 confirmed |
| fast-forward run with timetable 0.1.3 (`bw_zeitraffer` 0.1.0, `bw_install` 0.1.2, `bw_main` 0.1.2, `bw_pump` 0.1.1 – still without the control loop in the window) | all timetable cases shown: watering, pause, double watering under heat, tank empty, `feucht`, daily limit, restore; the hose lay at the plant |
| pulse test `mess` | six pulses (table above), start values for `cfg3`/`cfg4` |
| stage 10: `normal` → `kal 780` → window 1 → `normal` → `kal report` → `kal write` | window 1 at 15:54:30: portions 12 + 10 s, 10.4 → 50.5 %, runtime 100 s against a deadline of 120 s, `mem_peak` 12 516 B; check 53.7 %; `kal write` as above |

Open (details and the template for the next run in [19 · Device test protocol](19-pruefprotokoll.md)): windows 2–4 of the 0.2.0 fast-forward timetable (pause, heat, `wasser`, `limit`) with `tMax` 40/`tSoak` 10; states medium moist and wet of the calibration run; the first real window at 20:00 with dry soil; `cfg3.tDead`/`tMin` on the final setup with a longer hose via `mess`; upper and lower reference and `dropSlow` at the plant. Raw data: [docs/kal/](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/tree/main/docs/kal).

## Example output

> **Measured on the device (13 Sep 2026):** start of the calibration run (`kal 780`, tunnel 127.0.0.1:8010) and window 1 – pre-check, safe moment, `bw_zeitraffer`, `bw_install`, then cycle, window and check. Shortened: firmware lines, the repeated `warte` lines except the first, the printed calibration timetable (with the messages `kein bw_zeitraffer/bw_install läuft mehr` and `Rekorder läuft 780 s`), the second cycle at 15:54 and all status lines except one after the window. The tool output is German (`ok` lines = checks passed, `warte` = waiting, `sicherer Moment` = safe moment).

```text
ok       Uhrzeit 15:49 lokal, ram_free 133672, fs_free 40960
ok       cfg2 Zielband: pctLo 40 → Gabe, pctOk 50 Ziel erreicht, pctSoll 55, pctHi 60 zu viel, pctDry 28
ok       Wasserstand VOLL (lvl=false)
ok       Ausgang aus
ok       Sensoren: V=0.590 (10 %) tC=23.6
warte – Sekunde 52, warte auf 8–30
sicherer Moment: 15:50:09
Script.Start bw_zeitraffer (id 7) → {"was_running":false}
[bw_zeitraffer 0.2.0] Sicherung zrb1..5 wird geschrieben; Profil: Takt 3 min, Fenster alle 6 min, Budget 120 s, bis 3 Portionen, tHot 30 °C, maxDay 4, Trockenphase aus
[bw_zeitraffer 0.2.0] bw_install gestartet (id 1) – baut Zeitplan und auto_off. Zurück zum Normalbetrieb: bw_install erneut starten
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] Zeitplan: 3 Einträge, davon eigene: 3
[bw_install 0.1.3] Switch 0: auto_off 50 s
[bw_install 0.1.3] KVS neu angelegt: keine
[bw_install 0.1.3] Zeitplan #1: 0 */3 * * * *
[bw_install 0.1.3] Zeitplan #2: 30 */6 * * * *
[bw_install 0.1.3] Zeitplan #3: 40 2,8,14,20,26,32,38,44,50,56 * * * *
[bw_install 0.1.3] fertig – ZEITRAFFER aktiv: bw_main alle 3 min, bw_pump alle 6 min (Sekunde 30), Budget 120 s, bis 3 Portionen, Sicherheits-Aus 160 s nach der Fensterminute; zurück: bw_install starten
ok       Zeitplan: #1 [0 */3 * * * *] #2 [30 */6 * * * *] #3 [40 2,8,14,20,26,32,38,44,50,56 * * * *]
ok       auto_off 50 s
ok       Sicherung zrb1..5 vorhanden (Original: tick 15, tMax 180, tWin 420, pctDry 28)
ok       Profil: Takt 3 min, Fenster alle 6 min, Budget 120 s, bis 3 Portionen, tStd 12 s, tHot 30 °C, maxDay 4, pctDry 39
ok       Script-Heap frei: 25200, ram_free 143208, kvs_rev 496
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] m0 10.4 % → P1 12 s
[bw_pump 0.2.0] P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)
[bw_pump 0.2.0] P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
[status 15:56] läuft: - | V=1.810 tC=23.6 lvl=false sw=aus | ZEITRAFFER st=gegossen/unstab n=2 sec=22 pctB=10.4 pctW=50.5 effW=2.006 tr=5 job=unstab/12 day.n=1 err=- mem(used/peak) main=- pump=- free=121972
[bw_main 0.2.0] Kontrolle: 50.5 → 53.7 % sf=0.7
[bw_main 0.2.0] V=1.82 pct=53.7 tC=23.6 lvl=0 st=sperre dry=1 pause=0.2h why=pause sec=- effW=2.006 sf=0.7 err=- w=2 dauer=5385ms
```

How to read it: the pre-check is green, the tool waits from second 52 to second 9 of the next minute. `bw_zeitraffer` backs up and writes the profile, `bw_install` builds the three schedule entries and `auto_off` 50 s; `pctDry` is 39 in the test (`pctLo` − 1). The cycle at 15:51 reports 10.8 %, below `pctLo`, without a learned value → job `tStd` 12 s.

Window 1 at 15:54:30: `P1` lifts to 34 %, the correction portion (clamped to `tPmin` 10 s) to 50.5 % – target `pctOk` 50 reached, still rising at the timeout → `unstab`. The check at the next cycle shows 53.7 %, then `st=sperre why=pause`.

`kal report` with the console lines from the `watch` log of the same recording (lines from `docs/kal/2026-09-13-13-50-kal-log.txt`, calculation core `tools/lib/kal.js`):

```text
Konsolenzeilen aus docs/kal/2026-09-13-13-50-kal-log.txt: 5
Aufzeichnung: docs/kal/2026-09-13-13-50-kal.json
Kalibrierlauf 2026-09-13T13:50:34.253Z – 155 Proben, 1 Fenster; Zustände: trocken < pctDry 28, mittel 28–40 (Gabe fällig), band 40–60 (keine Gabe), nass > pctHi 60 (Ziel pctOk 50, pctSoll 55)
Fenster  Start   Zustand       m0     n  Σs   tRise  Spitze  Ruhe   pctW   effW   why   | Portionen (Konsole): sec/Δ%/tRise → effW nach tRise
     1   4:06  trocken       10.4   2   22     12    55.5   55.5   50.5   2.01   unstab (Kontrolle 53.7)   | P1 12s/+23.6/8s P2 10s/+16.5/5s → 4.46 %/s
Zustand trocken: Gewinn effW 4.46 %/wirksame s aus 1 Fenster
Zustand nass: nicht aufgezeichnet (Sensor zum Schluss ins nasse Substrat oder Wasserglas)
Vorschlag: lrn.effW 4.46 (Mittel aus 1 Fenster, Skala % je Sekunde nach tRise aus den Konsolenzeilen) · cfg4.tDead2 5 s (Median tRise der Folgeportionen) · cfg3.tDead 8 s (tRise der Erstportion; gilt für DIESEN Schlauch – im Endaufbau per mess nachmessen)
Schreiben (nur im Normalbetrieb, mischt effW mit dem vorhandenen Wert α 0,5): node tools/hwtest.js <ip> kal write [datei]
```

(`Proben` = samples, `Fenster` = windows, `Spitze` = peak, `Ruhe` = settled, `Vorschlag` = suggestion, `Schreiben` = write.) `kal write` afterwards (16:06, after `normal`), the notes of the output:

```text
  lrn.effW null → 4.46 (Messwert)
  cfg4.tDead2 8 → 5 s
  cfg3.tDead 20 → 8 s (tRise der Erstportion; Endaufbau mit anderem Schlauch: mess)
  cfg3.tMin 25 → 10 s (max(tPmin, tDead + 2))
```

Pulse test, the 10-s pulse of 13 Sep 2026 (line in the form `mess` prints it, from the raw data `docs/kal/2026-09-13-13-14-mess.json`; `Puls` = pulse, `Spitze` = peak, `Ruhe` = settled, `Gewinn` = gain, `Ausgang aus bei` = output off at):

```text
Puls 1: 10 s → pct 37.5 → Spitze 49.1 (t=15.033 s) → Ruhe 49.1 (nach 36.226 s) | tRise 7.911 s | Gewinn 5.56 %/wirksame s (1.16 %/s brutto) | Ausgang aus bei 10.216 s
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `zeitraffer` reports `BLOCKER cfg2 Zielband unvollständig` (band incomplete) or `nicht geordnet` (not ordered) | a band field is `null` (often `pctOk` after an update) or the order `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` is violated | enter the field via `KVS.Set` or "Format as JSON", then `normal 60` |
| cycle reports `why=cfg`, `err=cfg` | band incomplete, order violated or a mandatory field missing (the console names the field) | as above; after a partial write run the installer again |
| in fast-forward `err=noeff`, `ergebnis=noeff` | two full portions without effect: the hose does not lie at the sensor, the sensor does not sit under the dripper | check hose and sensor position, delete `err`: `curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"err"}'` |
| windows 2–4 do not water, cycle `why=feucht` | sensor not moved into dry soil after the learned window: the moisture is still above `pctOk` | put the sensor into the second pot before the cycle that precedes the window |
| `why=trocken` persists although the sensor is in soil | the dry phase after the glass of water ends only below `pctDry` = `pctLo` − 1 (39 %) | use drier soil; the fresh reading in the window does not help, the cycle reading counts |
| status line shows `out_of_memory` | two large scripts at the same time on the shared heap | `normal 60` immediately; check the schedule (`bw_pump` at second 30) |
| `kal write`: `Zeitraffer aktiv (zrb1) – erst: … normal` | the restore is still missing | `normal 60`, then `kal write` |
| `kal report` without portion lines, `kal write` reports `ACHTUNG: effW im Profilmaß` (effW in profile measure) and leaves `tDead`/`tMin` untouched | the debug websocket was off: the recorder saw no console lines, hence no `tRise` | do not run `kal write` (it would write `effW` in the profile measure); switch the websocket on in the web-UI console and repeat the calibration run – pulling lines in with `kal report <json> <log>` only works with a log that contains the `bw_pump` lines |
| `kein sicherer Moment in 4 min` (no safe moment in 4 min) | a script is running all the time, or the clock is not set (NTP) | `preflight`; in fast-forward try again outside minutes 0–2 of the 6-minute cycle |
| `preflight` says "bw_main läuft" | in fast-forward `bw_main` runs for a few seconds every 3 min | call again; not an error |
| first real window: `hwtest.js watch` ends immediately | in normal operation no test script and no fast-forward is running | `node tools/console.js <ip> 900` or the web UI console |
| `mess` reports `keine Wirkung gemessen` (no effect measured) | pulse shorter than the dead time (3 s only fill the hose), hose empty or sensor not under the dripper | pulse 10 s, observation 240 s: `mess 10 1 240` |
| `lrn.effW` is missing after fast-forward | intended: the original from `zrb2` comes back, test learned values do not count | learned values for operation via `kal` → `kal write` |

## Next

- [13 · Operation and maintenance](13-betrieb-und-wartung.md) – reading the console, all `why` and `err` codes, watering by hand, fixing faults
- [03 · Configuration](03-konfiguration.md) – every field of `cfg1`…`cfg4`: start value, effect, when the installer must run again
- [19 · Device test protocol](19-pruefprotokoll.md) – the measurements of 13 Sep 2026 and the template for the next device run
- [14 · Debugging and testing](14-debuggen-und-testen.md) – complete reference of `hwtest.js`, `console.js` and the mock
