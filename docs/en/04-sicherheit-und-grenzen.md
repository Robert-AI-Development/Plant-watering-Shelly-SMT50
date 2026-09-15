# 04 · Safety and limits

[Deutsch](../de/04-sicherheit-und-grenzen.md) · **English** — [Handbook](README.md) · Part A "Understand"

> **At a glance**
> - The pump never runs away: every portion is switched off three ways – `toggle_after` in the switch-on command (at most `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s), `auto_off` 190 s in the switch configuration and the scheduled safety-off 8 min after the window. All three work without a script.
> - Hard limits apply regardless of learning: per portion, per window (`tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s), per day (`maxDay` <!-- def:cfg3.maxDay -->2<!-- /def --> windows), minimum pause <!-- def:cfg3.pause -->24<!-- /def --> h. Two portions without effect lock the system (`noeff`) until a human has checked.
> - Mains: the Shelly output carries at most 30 V / 300 mA and only switches the relay coil; anything at 230 V is done by a qualified electrician.
> - Limits of the hardware: a shared script heap of about 25 KB, a KVS of 50 entries with 253 characters each, the narrow script language mJS, time only via NTP – and an SMT50 that delivers 0–3 V (about 0.03 V per percent) and measures at one spot only.

## Prerequisites

- none – a reading chapter. Parts and scripts are explained in [01 · Overall architecture](01-gesamtarchitektur.md), every field in [03 · Configuration](03-konfiguration.md).

## Diagram

[![Sequence: one portion and its three shut-offs – claim in the KVS, Switch.Set with toggle_after, auto_off, scheduled safety-off; script dies; reservoir empty](../diagramme/en/04-sicherheit-und-grenzen.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/04-sicherheit-und-grenzen.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/04-sicherheit-und-grenzen.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Normal portion", 2 "Script dies mid-window", 3 "Reservoir empty during the portion".

## Three-fold pump shut-off

`bw_pump` switches the pump on per portion with `Switch.Set {on:true, toggle_after:<seconds>}`. Three independent paths switch it off again. The device executes all three itself – even when the script has just died.

| Level | Where | Value normal / fast-forward | Kicks in when |
| --- | --- | --- | --- |
| 1 `toggle_after` in the switch-on command | every `Switch.Set on` from `bw_pump` | at most `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s per portion / <!-- zr:cfg4.tPmax -->15<!-- /zr --> s | always – the firmware switches off by itself when the time is up, even if the script dies right after switching on |
| 2 `auto_off` in the switch configuration | `Switch.SetConfig`, set by the installer | `tMax` + 10 s = 190 s per switch-on command / 50 s | the switch-on command came without `toggle_after` – by hand, from the web UI or from a foreign script |
| 3 safety-off in the schedule | entry `0 8 8,20 * * *` with `Switch.Set {on:false}` | 30 s + `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s + 10 s after the window minute, rounded up to full minutes = 8 min / minute list `40 2,8,14,…,56 * * * *` | both upper levels are misconfigured |

On top of that, `initial_state = off`: after a reboot or power cut the output is off. The installer derives level 2 from `cfg3.tMax` and level 3 from `cfg4.tWin`; after changing `tMax`, `tWin`, `tTail`, `winA`/`winB`, `tick` or `winEvery` it has to run again ([03 · Configuration](03-konfiguration.md)).

The layering comes from the concept ([16 · Concept and decisions](16-konzept-und-entscheidungen.md)). One condition from it is still kept by the installer: the safety-off lies behind every intended window because it is derived from `tWin`. Normally the window ends at the latest 30 + 420 = 450 s after the window minute, the safety-off fires at 480 s; in fast-forward mode the installer additionally checks `30 + tWin + 10` smaller than `winEvery · 60` (160 < 360) and aborts otherwise.

> **Measured on the device (13 Sep 2026):** after the installer, `hwtest.js normal` found the entries `0 */15`, `30 0 8,20` and `0 8 8,20` plus `auto_off 190 s`; firmware 2.0.0 accepted the fast-forward minute list `40 2,8,14,20,26,32,38,44,50,56 * * * *`; the pump test ran for 30 s (console "Pumpe aus: ok nach 30 s" – pump off, ok after 30 s). Which of the three levels actually switches off has not yet been triggered one by one (script abort mid-window, `Switch.Set on` without `toggle_after`, reboot) – test protocol rows 13 to 15 `[TODO am Gerät]` (open on the device); in the mock, `pump.test.js` covers the abort.

## Deadline before the next cycle

`bw_main` and `bw_pump` share the script heap and must never run at the same time. An offset and a deadline take care of that; the deadline is checked twice – in the script and in the installer:

1. **Offset:** `bw_pump` starts at second 30 of the window minute (`PUMP_SEC` in `bw_install`), `bw_main` at the full minute; it is done after 5 to 8 s (13 Sep 2026: `dauer=5660ms`).
2. **Deadline in `bw_pump`:** at start `B = min(tWin, tick·60 − q − tTail)` with `q` = seconds since the last cycle. Normal: `min(420, 900 − 30 − 20)` = 420 s. A portion only starts if `elapsed + sec + tSoak + nStab·tStep ≤ B`; otherwise the window ends with `why=zeit` (time; before the first portion without a claim). Time comes from `Shelly.getUptimeMs()`, never from tick counters.
3. **Installer, static:** `(window minute mod tick)·60 + 30 + tWin + tTail ≤ tick·60`. Normal 470 ≤ 900, fast-forward 170 ≤ 180. A window at 08:05 fits (770), one at 08:10 does not (1 070) – then the installer aborts with `err.code = "cfg"` and names the field.

The mock reports every actual overlap of two runs (overlap guard). A manual start in the middle of a cycle only gets the remainder until the next cycle. The pump test `bw_hwpump` additionally keeps a time guard of its own ([11 · Hardware check](11-hardware-check.md)).

## Abort safety: the claim

Before the first portion of a regulated window, `bw_pump` writes a **claim** to the KVS: `st = {state:"sperre", ts:<now>, why:"laeuft", …}` (`sperre` = locked, `laeuft` = running). If this write fails, nothing is pumped (`why=kvs`). If the script then dies mid-window – `out_of_memory`, an exception, `Script.Stop`, power cut – this happens:

1. The pump goes off via the three shut-offs.
2. `st.why` stays `laeuft`. `bw_main` sees `state=sperre` with the claim's timestamp and reports `why=pause` until the minimum pause has elapsed; `job.ok` becomes `false`.
3. No learned value, no `noeff`, and `day` stays unchanged.
4. A manual start within `jobAge` <!-- def:cfg3.jobAge -->20<!-- /def --> min does not water: `Fenster abgebrochen (laeuft) – kein Auftrag` (window aborted – no job).

The single portion (hardware test, manual job without `pct`, `nPort` 1) writes no claim; it is covered by the three shut-offs alone. To reproduce the crash: test protocol row 13 ([19 · Device test protocol](19-pruefprotokoll.md)).

## Hard limits regardless of learning

The learned value `lrn.effW` only determines the dose. All limits below also hold when learning is wrong:

| Limit | Field | Default | Effect |
| --- | --- | --- | --- |
| per portion | `cfg4.tPmax` | <!-- def:cfg4.tPmax -->120<!-- /def --> s | upper bound for `toggle_after` of every portion; the job from `bw_main` is additionally clamped to `tMin` <!-- def:cfg3.tMin -->25<!-- /def --> … `tMax` |
| per window | `cfg3.tMax` | <!-- def:cfg3.tMax -->180<!-- /def --> s | sum of all portions; `auto_off` = `tMax` + 10 s |
| portions per window | `cfg4.nPort` | <!-- def:cfg4.nPort -->6<!-- /def --> | afterwards the window ends with `max` |
| time budget per window | `cfg4.tWin` | <!-- def:cfg4.tWin -->420<!-- /def --> s | deadline, ends with `tTail` <!-- def:cfg4.tTail -->20<!-- /def --> s reserve before the next cycle (`zeit`) |
| windows per day | `cfg3.maxDay` | <!-- def:cfg3.maxDay -->2<!-- /def --> | afterwards `limit`; daily reserve `maxDay × tMax − day.sec` = 360 pump seconds |
| minimum pause | `cfg3.pause` / `pauseHot` / `pauseSlow` | <!-- def:cfg3.pause -->24<!-- /def --> / <!-- def:cfg3.pauseHot -->12<!-- /def --> / <!-- def:cfg3.pauseSlow -->48<!-- /def --> h | until then `why=pause` – also after an aborted window |
| age of the job | `cfg3.jobAge` | <!-- def:cfg3.jobAge -->20<!-- /def --> min | older → `alt` (old), no watering |
| learned value | `cfg2.effMin` / `effMax` | <!-- def:cfg2.effMin -->0.05<!-- /def --> / <!-- def:cfg2.effMax -->30<!-- /def --> %/s | clamp for `effW`; a correction portion never calculates with less than `effMin` |
| safety factor | `cfg2.sfMin` | <!-- def:cfg2.sfMin -->0.5<!-- /def --> | `lrn.sf` stays between `sfMin` and 1 (start 0.7): the first portion deliberately lands below the target |

No watering at all with an invalid clock (`uhr`), an implausible sensor (`sensor`: voltage below `vErrLo` <!-- def:cfg1.vErrLo -->0.10<!-- /def --> V or above `vErrHi` <!-- def:cfg1.vErrHi -->3.35<!-- /def --> V), an empty reservoir (`wasser`, water), an incomplete target band (`cfg`) and with any standing blocking fault (`err:<code>`). Precedence when setting: `noeff` before `cfg` before `uhr` before `sensor` before `wasser`; all codes are explained in [13 · Operation and maintenance](13-betrieb-und-wartung.md).

### No effect means no more water

If the first portion shows no measurable effect (gain below `dStab` <!-- def:cfg4.dStab -->1<!-- /def --> %), exactly one full probe portion follows. If that one has no effect either (sum below `dEffMin` <!-- def:cfg4.dEffMin -->2<!-- /def --> %), `bw_pump` sets the fault `noeff`. It blocks every watering, is never cleared by itself and produces no learned value. This way a sensor that slipped out does not turn into a flooded pot.

Only after pump, hose and sensor position have been checked does a human delete the entry:

```bash
curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"err"}'   # reset noeff – check pump, hose and sensor position first
```

Three neighbours of this rule: if a **later** portion has no effect although earlier ones did, the window ends with `stall` (no fault). If the fresh reading in the window lies between `pctOk` and `pctHi` – watered or fertilised by hand – there is no watering (`feucht`, moist), no learned value and no pause.

If the fresh reading is above `pctHi`, the window ends with `nass` (wet): `bw_pump` writes `st` as a lock, the minimum pause runs from now on (`why=pause`), and a dry phase begins – no watering until a cycle reading lies below `pctDry` (after the pause `why=trocken`, dry).

## Mains

- The Shelly output OUT1 is a potential-free contact for at most 30 V / 300 mA. It only switches the relay coil (coil current below 300 mA), never the pump.
- Work at 230 V – Gardena transformer, relay contact – only by a qualified electrician. The Gardena's own timer stays off so that only the relay decides.
- Shelly, relay and power supply dry and in an enclosure (parts list: IP54), away from water; a relay with a flyback diode must be polarised correctly.
- Supply: 12 V DC power supply with at least 1 A. The Shelly accepts 9–28 V DC, the SMT50 3.3–30 V DC; the sensor ground is tied to the supply minus.

> **Caution (water/mains):** Power everything down before any work on the setup. No bare wires, no electronics next to the reservoir. Wiring details in [05 · Wiring and hardware build](05-verkabelung-und-aufbau.md).

## Water

- The float switch sits above the pump inlet so the pump never runs dry. `cfg1.lvlEmpty` <!-- def:cfg1.lvlEmpty -->1<!-- /def --> is the input value for EMPTY (confirmed 13 Sep 2026: EMPTY = 1, FULL = 0).
- The water level is checked four times: by `bw_main` in every cycle (`nLvl` <!-- def:cfg1.nLvl -->3<!-- /def --> identical readings, otherwise `lvl`), by `bw_pump` before every portion, during the portion every `tChk` <!-- def:cfg3.tChk -->5<!-- /def --> s (EMPTY → pump off immediately, `abbruch` = abort, `err=wasser`) and while soaking and stabilising (EMPTY → `wasser`, no further portion).
- Route hoses so that a defect cannot cause water damage; reservoir with a lid.
- Reserve: at least `maxDay × tMax` = 2 × 180 s = 360 pump seconds per day must be safely possible. The pump's flow per second has not been measured yet `[TODO am Gerät]` (open on the device: measuring jug, stopwatch, one pulse with `hwtest.js mess 10 1`).
- Trailing water: after switching off, the hose keeps dripping (measurement run 13 Sep 2026: with 3-s pulses the moisture crept up for 65 to 162 s). That is why portions in the control loop are never shorter than `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> s (first portion at least `tMin`) and the sensor sits under the dripper; only the single portion (from 1 s) and `hwtest.js mess` may be shorter.

## Limits of the Shelly

| Limit | Value | Consequence in the project |
| --- | --- | --- |
| running scripts | at most 3 at once (Shelly docs) | the three operating scripts never run at the same time; test scripts start by hand only |
| open RPC calls, timers | 5 each per script | every script keeps exactly one open |
| script heap | about 25 KB, shared by all scripts (`mem_free` 24 920 to 25 200 B when idle) | two large scripts at once end with `out_of_memory`; in the window `bw_pump` needs <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B of code and up to 12 516 B of heap, `bw_main` 5 348 B when parsing – hence offset and deadline |
| code size | `dist/` ≤ <!-- fact:size_limit -->16 000<!-- /fact --> B per script, `bw_pump` ≤ <!-- fact:size_limit_pump -->18 000<!-- /fact --> B (`size.test.js`) | `bw_main` is at <!-- fact:dist.bw_main -->15 791<!-- /fact --> B – shorten or split before extending |
| call depth | 12 levels run, 14 crash ("Too much recursion"); mock limit <!-- fact:call_depth -->10<!-- /fact --> | flat step chain `next()`, named callbacks only |
| KVS | 50 keys, key ≤ 42 characters, value ≤ 253 characters; `KVS.GetMany` returns 11 per page | 9 operating entries plus test and fast-forward entries; `kvs-size.test.js` checks the length; no measurement history on the device (that needs a backend) |
| flash | `fs_free` 12 288 B with seven scripts, 49 152 B without the three test scripts, 40 960 B after uploading `bw_pump` (4 KB blocks) | delete test scripts before an upload; `put-script.js` checks the space. Every KVS write goes to flash: write only on change, 15 to 22 per watering day (budget ≤ 24) |
| schedule | 20 entries, 5 calls per entry; six cron fields including seconds | the installer creates 3 entries (up to 5 when `winA` and `winB` have different minutes) |
| clock | NTP only; without a valid time no schedule runs | while the device keeps running it keeps the time without internet; after a power cut without internet the schedule stands still until NTP is reachable again – no cycle, no console line; `err=uhr` is only set by a manual start of `bw_main`. Windows are local time: check the time zone on the device |
| script language mJS | no `const`, no classes, no promises, no hoisting, no `Date`; array methods only `push`, `slice`, `splice`, `indexOf`, `join`; more than two or three nested anonymous functions crash | `syntax.test.js` enforces the rules; measurements and RPC details in [20 · RPC reference](20-rpc-referenz.md) |
| analog input | range 0–15 V (or 0–30 V) for a 0–3 V signal; values in steps of about 0.3 % | `nSample` <!-- def:cfg1.nSample -->5<!-- /def --> readings per cycle (mean of the middle values, the median in the window), hysteresis `hyst` <!-- def:cfg2.hyst -->2<!-- /def --> % |
| console | more than about 15 `print` lines in one go get lost on the debug websocket; the websocket must be switched on | one line per cycle or per portion; diagnosis via `console.js` or `hwtest.js watch` |
| CPU | a 1-s tick with `getComponentStatus` costs 12–17 % (firmware log) | `bw_main` polls like that for only 2.5 s per cycle (`msSample` <!-- def:cfg1.msSample -->500<!-- /def --> ms), `bw_pump` only in the window (at most `tWin` s, twice a day); the hardware test scripts tick like that for minutes and start by hand only |

## Limits of the SMT50

**Signal and scale.** The SMT50 delivers soil moisture as 0–3 V on the yellow wire `[TODO laut Datenblatt]` (open per data sheet); according to the data sheet 3 V corresponds to about 50 percent by volume (manufacturer formula `vol.-% = V × 50 / 3`), accuracy ±3 % in the reference soil. The project does not calculate in percent by volume but relative to `cfg1`: 0 % = `vDry` (sensor dry in air, 13 Sep 2026: 0.296 V), 100 % = `vWet` (sensor in water, 3.134 V). 100 % is a calibration point, never a target.

A new calibration shifts the percent scale and with it the target band. `lrn.effW` is invalid afterwards: delete it (fallback to `tStd` <!-- def:cfg3.tStd -->70<!-- /def --> s) or repeat the calibration run ([12 · First commissioning](12-erstinbetriebnahme.md)).

| Limit | What the sensor can do | What the project makes of it |
| --- | --- | --- |
| resolution | about 0.03 V per moisture percent at the 0–15 V input; single readings scatter | `nSample` 5 readings per measurement, hysteresis 2 %, stability within `dStab` 1 % |
| plausibility | a torn cable delivers 0 V and would look like "completely dry" | below `vErrLo` 0.10 V or above `vErrHi` 3.35 V: `err=sensor`, no watering |
| response time | measurement run 13 Sep 2026: first reaction (`tRise`) after 5 to 8 s with a full hose; a 10-s pulse rose from 7.9 s, peak 5 s after pump-off (+11.6 % = 5.6 % per effective second); 3-s pulses only filled the hose | `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s, `tPmin` 10 s, `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s, `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s; portions never shorter than the dead time. Window 1 in fast-forward measured `tRise` 8 s and 5 s |
| one measuring point | the sensor only measures where it sits: under the dripper that is the wettest spot of the pot | target band and learned value apply to that spot; a sensor that slipped ends in `noeff` or in the hint `sink` (`dropW`) |
| temperature, fertiliser | soil temperature and salt content (fertilising) can shift the reading – check the magnitude in the data sheet `[TODO laut Datenblatt]` (open per data sheet) | a fresh reading in the window between `pctOk` and `pctHi` counts as `feucht` (no watering), above that as `nass` (dry phase); the check above `pctHi + hyst` lowers `sf` |
| second output | the green wire `[TODO laut Datenblatt]` delivers soil temperature | stays unconnected – the Shelly Plus Uni has only one analog input; temperature comes from the DS18B20 |

### One sensor, several drippers

The control loop measures at the sensor only. Further drippers on the same distributor are supplied blindly; they should be identical and sit in pots with the same soil and size, otherwise one plant gets too much or too little.

Every portion is one switching cycle of the relay – up to `nPort` 6 per window, with `maxDay` 2 up to 12 per day. Between two portions there are at least `tSoak` 20 s of soaking and the stabilisation measurement (`nStab` <!-- def:cfg4.nStab -->4<!-- /def --> readings `tStep` <!-- def:cfg4.tStep -->5<!-- /def --> s apart). The manufacturer limits of relay and pump for switching cycles and minimum pauses have not been looked up `[TODO laut Datenblatt]`. For portions less than 60 s apart the firmware reports `PCS write interval < 60s` – a note about the switch writing its counters, not an error.

## Example output

Window 1 of the fast-forward run on 13 Sep 2026, 15:54 (`hwtest.js kal 780`, status lines from `watch` every 5 s, excerpt). The status line shows `st=sperre/laeuft` from the claim to the end of the window – also between portions with `sw=aus` (off); the `sw=aus` in the third status line is the end of the 12-s portion (firmware `toggle_after` and the script's `Switch.Set off` coincide here); `Frist 120 s` (deadline) is the fast-forward budget, `dauer=100199` ms (duration) stayed below it:

```text
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] m0 10.4 % → P1 12 s
[status 15:54] läuft: bw_pump | V=0.590 tC=23.6 lvl=false sw=EIN | ZEITRAFFER st=sperre/laeuft job=ok/12 day.n=0 err=- mem(used/peak) main=- pump=10262/12516 free=129368
[status 15:54] läuft: bw_pump | V=0.760 tC=23.6 lvl=false sw=EIN | ZEITRAFFER st=sperre/laeuft job=ok/12 day.n=0 err=- mem(used/peak) main=- pump=10262/12516 free=134396
[status 15:54] läuft: bw_pump | V=1.280 tC=23.6 lvl=false sw=aus | ZEITRAFFER st=sperre/laeuft job=ok/12 day.n=0 err=- mem(used/peak) main=- pump=10276/12516 free=129820
[bw_pump 0.2.0] P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)
[bw_pump 0.2.0] P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
```

Inspect the three shut-offs on the device – three RPC calls that change no configuration:

```bash
curl -s "http://<ip>/rpc/Schedule.List"           # safety-off: timespec "0 8 8,20 * * *" with Switch.Set on:false
curl -s "http://<ip>/rpc/Switch.GetConfig?id=0"   # auto_off true, auto_off_delay 190, initial_state off
curl -s "http://<ip>/rpc/Switch.GetStatus?id=0"   # during a portion: output true, timer_duration = seconds of the portion
```

Responses from the mock (`node tools/run-script.js scripts/bw_install.js`, then `Switch.Set` with `toggle_after` 25 s); the field names follow the Shelly docs ([20 · RPC reference](20-rpc-referenz.md)). Confirmed on the device (13 Sep 2026): the three schedule entries and `auto_off 190 s`; the IDs are assigned by the device.

```json
{"jobs":[{"id":1,"enable":true,"timespec":"0 */15 * * * *","calls":[{"method":"Script.Start","params":{"id":2}}]},{"id":2,"enable":true,"timespec":"30 0 8,20 * * *","calls":[{"method":"Script.Start","params":{"id":3}}]},{"id":3,"enable":true,"timespec":"0 8 8,20 * * *","calls":[{"method":"Switch.Set","params":{"id":0,"on":false}}]}],"rev":3}
{"id":0,"name":null,"initial_state":"off","auto_off":true,"auto_off_delay":190,"auto_on":false,"auto_on_delay":0}
{"id":0,"source":"script","output":true,"temperature":{"tC":40,"tF":104},"timer_started_at":1789192800,"timer_duration":25}
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| output stays ON after the window | switch-on command without `toggle_after` (by hand, web UI) and `auto_off` not set – the installer never ran | emergency stop: `node tools/hwtest.js <ip> stop` or OUT1 in the web UI; check `Switch.GetConfig`, run the installer |
| `why=zeit`, console `Frist zu kurz für P1` (deadline too short) | manual start in the middle of a cycle, or `tWin`/`tTail` do not fit the cycle | start `bw_pump` in the window; the installer checks the rule and names the field |
| `st.why=laeuft` stays, next cycle `why=pause`, no learned value | script died mid-window (`out_of_memory`, exception, `Script.Stop`, power) | read `Script.GetStatus` → `errors`; the pump is off via the shut-offs; after the pause everything continues normally. With `out_of_memory`: no second large script next to `bw_pump` |
| `err=noeff` stays | two full portions without measurable effect | check pump, hose and sensor position, then delete `err` (command above) |
| `err=wasser`, reservoir is full | `cfg1.lvlEmpty` does not match the float switch, or the float sticks | move the float; hardware test phases l1/l2 ([11 · Hardware check](11-hardware-check.md)) |
| no cycle line after a power cut; `err=uhr` after a manual start of `bw_main` | no NTP – time invalid, schedule stopped | check Wi-Fi and internet; with a valid time the schedule resumes by itself |
| `err=sensor` | voltage outside 0.10–3.35 V: cable, connector, sensor in air instead of soil | check wiring and sensor position; clears itself |
| installer: `passen nicht in den Takt` (do not fit the cycle) | the window minute lies too far behind the cycle (`(minute mod tick)·60 + 30 + tWin + tTail > tick·60`) or `tWin` is too large | move windows closer to :00/:15/:30/:45 (with `tWin` 420 up to 7 min after fit) or shorten `tWin`, run the installer again |
| `Script.GetStatus` reports `out_of_memory` | two large scripts ran at the same time (test script next to `bw_pump`) | test scripts one at a time; pump test in two passes; measure the heap with `hwtest.js scripts` |
| `ergebnis=extern` (result: external) | the output was already ON at start or was switched off from outside during the portion | find out who switches OUT1 (web UI, hand, other automation); the window ends without a further portion |

## Next

- [05 · Wiring and hardware build](05-verkabelung-und-aufbau.md) – turn the mains and water rules from here into the build.
- [13 · Operation and maintenance](13-betrieb-und-wartung.md) – decode states, fix faults, maintain reservoir and hose.
