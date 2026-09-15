# 02 · Flow: cycle, job, window, check, pause

[Deutsch](../de/02-flussdiagramm.md) · **English** — [Handbook](README.md) · Part A "Understand"

> **At a glance**
> - Every <!-- def:cfg3.tick -->15<!-- /def --> minutes `bw_main` measures and decides; watering happens only in the two windows `winA` <!-- def:cfg3.winA -->08:00<!-- /def --> and `winB` <!-- def:cfg3.winB -->20:00<!-- /def -->, run by `bw_pump` – in portions with re-measuring, together at most `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s.
> - The trigger is a cycle reading below `pctLo`; the window ends as soon as moisture reaches `pctOk`; the dose aims at `pctSoll`, damped by the safety factor `sf` <!-- def:lrn.sf -->0.7<!-- /def -->.
> - Brakes: pause <!-- def:cfg3.pause -->24<!-- /def --> h after every watering (heat <!-- def:cfg3.pauseHot -->12<!-- /def --> h, suspected waterlogging <!-- def:cfg3.pauseSlow -->48<!-- /def --> h), at most `maxDay` <!-- def:cfg3.maxDay -->2<!-- /def --> windows per day, a dry phase from Friday or whenever moisture exceeds `pctHi`.
> - Biggest pitfall: `job.why` is not an error. `pause`, `trocken` (dry phase), `feucht` (moist) and `soak` are expected reasons against watering; faults live separately in `err`.

## Prerequisites

- none; [01 · Overall architecture](01-gesamtarchitektur.md) helps (which scripts exist and why none of them runs permanently)

## Diagram

[![One day's flow: cycle, job, watering window, check, pause, brakes](../diagramme/en/02-flussdiagramm.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/02-flussdiagramm.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/02-flussdiagramm.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "One cycle", 2 "The watering window", 3 "Brakes: check, pause, dry phase", 4 "Faults".

## The target band

Every decision hangs on five moisture values in `cfg2`, which must keep this order: `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` and `pctLo + hyst < pctOk`. The installer creates them – like `dropSlow` (moisture drop per 24 h for `pauseSlow`) – as `null`; as long as any of these six fields is `null` there is no job (`why=cfg`, `err=cfg`). The operator enters the values ([03 · Configuration](03-konfiguration.md)). Moisture in percent is `(V − vDry) / (vWet − vDry) · 100`, i.e. relative to the sensor calibration.

| Field | Example (device, 13 Sep 2026) | Role |
| --- | --- | --- |
| `pctDry` | 28 % | end of the dry phase: watering resumes only below this |
| `pctLo` | 40 % | trigger: cycle reading below it → job (*when*) |
| `pctOk` | 50 % | target reached: no further portion; fresh reading `≥ pctOk` → no watering (*up to where*) |
| `pctSoll` | 55 % | target point of the dose calculation (*how much*) |
| `pctHi` | 60 % | above it "too much" (dose shrinks) or wet (dry phase starts) |
| `hyst` | <!-- def:cfg2.hyst -->2<!-- /def --> % | a running job holds until `pctLo + hyst`; the check reports "too much" only above `pctHi + hyst` |

The examples in this chapter use this band. `pctLo` and `pctDry` apply only to the cycle reading of `bw_main`, `pctOk` only to the stabilised reading in the window. `pctSoll` and `pctHi` are calibrated to the window scale but are also used in the cycle: `pctSoll` in the dose formula, `pctHi` for wetness (dry phase) and at the check (`zuviel`).

## One cycle: measure, check, order

`bw_main` starts from the schedule every `tick` minutes, reads the KVS, works through eight steps and stops itself. It never switches the pump.

### Measuring

- Moisture: `nSample` <!-- def:cfg1.nSample -->5<!-- /def --> voltage readings spaced `msSample` <!-- def:cfg1.msSample -->500<!-- /def --> ms apart; mean of the middle values (smallest and largest are dropped). A voltage outside `vErrLo`…`vErrHi` marks the sensor implausible.
- Water level: `nLvl` <!-- def:cfg1.nLvl -->3<!-- /def --> identical readings of the float switch; a value equal to `lvlEmpty` means EMPTY. Differing readings → not readable (`lvl`).
- Temperature from the DS18B20; the daily maximum lands in `lrn.tMaxD` (rounded to 2 °C, crossing `tHot` <!-- def:cfg3.tHot -->35<!-- /def --> °C is captured exactly).

### Release chain

After measuring, day change, check and dry phase the release chain runs. The first matching reason wins and is written to `job.why`:

| Order | Condition | `job.why` |
| --- | --- | --- |
| 1 | target band or `dropSlow` open (`null`) – required field missing or band order violated: see below | `cfg` |
| 2 | moisture sensor implausible | `sensor` |
| 3 | water level not readable stably | `lvl` |
| 4 | tank empty | `wasser` (water) |
| 5 | a blocking fault is set (`noeff`, `cfg`, `uhr`, `sensor`, `wasser`) | `err:<code>` |
| 6 | already `maxDay` windows today | `limit` |
| 7 | last window not yet checked | `soak` |
| 8 | pause since the last watering still running | `pause` |
| 9 | dry phase running | `trocken` (dry) |
| 10 | moisture `≥ pctLo` (with a running job `≥ pctLo + hyst`) | `feucht` (moist) |
| 11 | otherwise | `ok` – job with `sec` |

If a required field is missing or the band order is violated, the cycle aborts before the release chain: `err=cfg`, console `why=cfg`; a running job is withdrawn, otherwise `job` stays unchanged.

### The job

On `ok`, `bw_main` writes the first portion in seconds: `sec = (pctSoll − pct) / effW · sf + tDead`, rounded and clamped to `tMin`…`tMax`. As long as `lrn.effW` is still `null` (first window), the flat value `tStd` <!-- def:cfg3.tStd -->70<!-- /def --> s applies.

Example with the device values of 13 Sep 2026 (`effW` 4.46 %/s, `tDead` 8 s, `tMin` 10 s from `kal write`): the cycle reads 30 % → `(55 − 30) / 4.46 · 0.7 + 8 ≈ 12 s`. With the defaults `tDead` <!-- def:cfg3.tDead -->20<!-- /def --> s and `tMin` <!-- def:cfg3.tMin -->25<!-- /def --> s the same calculation gives 24 s, clamped to 25 s.

`sf` starts at 0.7: the first portion deliberately lands below the target; correction portions in the window make up the rest. `job` is written only when `ok` or `why` changes – or when `ok` holds and the next window lies within one cycle (then fresh, because `bw_pump` checks the age).

## The watering window: portions with re-measuring

`bw_pump` starts 30 s after the window minute (08:00:30, 20:00:30) so that it never runs next to `bw_main`. It reads exactly nine KVS entries and checks the job: `job.ok` must be `true`, `job.ts` at most `jobAge` <!-- def:cfg3.jobAge -->20<!-- /def --> min old (otherwise `alt`, stale), no blocking fault, `day.n < maxDay` (otherwise `limit`).

### Deadline

Before the first portion the script computes its deadline `B = min(tWin, tick·60 − q − tTail)`, `q` = seconds since the last cycle. Normal: `min(420, 900 − 30 − 20) = 420 s` (`tWin` <!-- def:cfg4.tWin -->420<!-- /def -->, `tTail` <!-- def:cfg4.tTail -->20<!-- /def -->). A portion starts only if portion + soak-in + stabilising (`tSoak + nStab·tStep` = 40 s) still fit into the deadline; otherwise the window ends with `zeit` (time). This way a window always ends before the next cycle.

### Fresh reading m0

The job may be up to 20 min old, so `bw_pump` measures first (`nSample` readings, median):

- `m0 > pctHi` → `nass` (wet): no watering, the dry phase starts.
- `m0 ≥ pctOk` → `feucht` (watered by hand or fertilised): no watering, no learning, no pause, `day` unchanged.
- otherwise first portion `P1 = clamp(job.sec, tMin, min(tPmax, tMax, daily reserve))`; daily reserve = `maxDay · tMax − day.sec`. If the reserve is smaller than `tMin`, the window ends with `max`.

### Portion, soak-in, stability

1. Check the water level (`nLvl` identical readings); EMPTY → `wasser`, fault `wasser`.
2. Write the claim: `st.why = laeuft` (running; see states). If the script dies mid-window, `bw_main` derives the pause from it.
3. Switch on with `Switch.Set {on:true, toggle_after: sec}` – the device switches off by itself after `sec` s, at most `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s per portion.
4. During the portion every `tChk` <!-- def:cfg3.tChk -->5<!-- /def --> s: tank empty → pump off immediately (`abbruch`, abort); output switched off externally → `extern`. The first rise by `dStab` is remembered as `tRise`.
5. Soak in for `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s, then every `tStep` <!-- def:cfg4.tStep -->5<!-- /def --> s one reading into a ring of `nStab` <!-- def:cfg4.nStab -->4<!-- /def --> values.
6. Stable means: span of the `nStab` values ≤ `dStab` <!-- def:cfg4.dStab -->1<!-- /def --> % **and** newest minus oldest value ≤ `dStab/2` (a ramp does not count). After `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s at the latest the ring mean is used.

### Verdict after each portion

| Finding | Result (`job.why`, `st.why`) | What follows |
| --- | --- | --- |
| still rising at the timeout | `unstab` | window ends, learning yes, no further portion |
| moisture `> pctHi` | `over` | window ends; if it was the first portion, `sf` drops |
| moisture `≥ pctOk` | `ok` | window ends within the band |
| portion 1 without effect (Δ < `dStab`) | – | exactly one full probe portion `clamp(P1, tPmin, remainder)` |
| portion 2 without effect, Σ < `dEffMin` <!-- def:cfg4.dEffMin -->2<!-- /def --> % | `noeff` | fault `noeff`, blocks until a human deletes `err` |
| portion 2 without effect with Σ ≥ `dEffMin`, or a later portion without effect | `stall` | window ends, learning from the effective portions |
| tank empty during the waiting phase | `wasser` | window ends, fault `wasser` |
| below `pctOk`, effect measurable | – | correction portion (below) |
| `nPort` <!-- def:cfg4.nPort -->6<!-- /def --> portions, `tMax` or daily reserve reached | `max` | window ends |
| next portion does not fit into the deadline | `zeit` | window ends |

Principle: "no effect" never leads to more water – the capped probe portion is the only exception; afterwards the window ends with `stall` or the fault `noeff` locks.

Correction portion: gain `g = Σ Δ% / Σ effective seconds` since `m0` (seconds minus dead time `tDead` for portion 1, `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s afterwards; never below `effMin`). Target = halfway to `pctHi`, at most `pctSoll`. `sec = (target − actual) / g + tDead2`, clamped to `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def -->…`min(tPmax, remainder of tMax, remainder of daily reserve)`. If the calculation is below `tPmin` and moisture already at `pctOk − dStab`, the window ends with `ok`.

Example from the device (13 Sep 2026, fast-forward): after `P1` 34 % with `g` 2.357 → target `min(55, 34 + 13) = 47` → `13 / 2.357 + 0 ≈ 5.5 s`, clamped to `tPmin` 10 s → `P2 10s` (see example output).

### Single portion

Without `job.pct`, with `nPort` 1 or with an incomplete band, `bw_pump` pumps exactly one portion `clamp(job.sec, 1, min(tPmax, tMax))` – no fresh reading, no learning. This is how the hardware test and a manual job without `pct` work ([13 · Operation and maintenance](13-betrieb-und-wartung.md)).

## Learning in the window

At the end of the window `bw_pump` learns – only with effective seconds and only on `ok`, `over`, `max`, `zeit`, `stall`, `unstab` and `wasser` after a completed portion (on `abbruch`/`extern` from the completed portions). No learning on `noeff`, `sensor`, `switch`, `kvs`, `feucht`, `nass` – nor on any end without a completed portion (crash: `st.why` stays `laeuft`).

- `effNew = Σ Δ% / Σ effective seconds`, clamped to `effMin` <!-- def:cfg2.effMin -->0.05<!-- /def -->…`effMax` <!-- def:cfg2.effMax -->30<!-- /def -->.
- `lrn.effW = (1 − alpha) · old + alpha · effNew` with `alpha` <!-- def:cfg2.alpha -->0.3<!-- /def -->; the first window takes `effNew` directly.
- `lrn.sf`: `over` with only one portion → `− sfStep` <!-- def:cfg2.sfStep -->0.1<!-- /def --> (never below `sfMin` <!-- def:cfg2.sfMin -->0.5<!-- /def -->); `ok` after at least two portions → `+ sfUp` <!-- def:cfg2.sfUp -->0.05<!-- /def --> (at most 1). So the ratchet closes again when correction portions were needed.

The 30-minute value of the check never enters `effW` – it already contains drainage.

## Check after the window

`soak` <!-- def:cfg3.soak -->30<!-- /def --> min after the end of the last portion the next `bw_main` cycle re-measures (`st.state` is `gegossen`, watered, until then; `job.why = soak`). The console shows `Kontrolle: pctW → pctA % sf=…` (Kontrolle = check):

| Finding | Effect | Hint in `err` |
| --- | --- | --- |
| `pctA > pctHi + hyst` and the window did not end with `over` | `sf − sfStep` | `zuviel` (too much) |
| `pctW − pctA > dropW` (only if `dropW` is set) | none | `sink` (dropped: drainage, sensor slipped?) |
| window ended with `max` or `zeit` and `pctA < pctLo` | catch-up window: the next pause is only `pauseHot` | – |

Afterwards `st.state = sperre` (locked); the hints last until the next check and block nothing.

## Pause

After every watering there is rest. In every cycle `bw_main` picks one of three pauses:

| Pause | Duration | When |
| --- | --- | --- |
| `pauseHot` | <!-- def:cfg3.pauseHot -->12<!-- /def --> h | daily maximum today or yesterday above `tHot` (both windows possible) – or catch-up window after `max`/`zeit` |
| `pauseSlow` | <!-- def:cfg3.pauseSlow -->48<!-- /def --> h | moisture drop per 24 h below `dropSlow` (suspected waterlogging; only after 24 h of data) |
| `pause` | <!-- def:cfg3.pause -->24<!-- /def --> h | otherwise |

The pause counts as over when `(now + 2·tick·60) − st.ts ≥ pause`: the job is created one cycle before the window and the watering starts 30 s after it. Without this tolerance of two cycles a 24 h pause would miss the same window on the next day by seconds. Once the pause is over and no dry phase is active, `st.state` changes from `sperre` to `beob` (observing).

## Dry phase

The dry phase reduces waterlogging on schedule, without waiting after every watering. It starts

- at the first cycle of weekday `dryDay` <!-- def:cfg3.dryDay -->5<!-- /def --> (0 = Sunday … 6 = Saturday, `null` = never), console `Trockenphase (Wochentag 5): warte auf < 28 %` (dry phase, weekday 5, waiting for < 28 %);
- as soon as a cycle reading exceeds `pctHi` – not directly after a window that has not been checked yet –, console `Trockenphase (nass 63 %): …`;
- in the window, when the fresh reading exceeds `pctHi` (`nass`).

While it runs, the cycle reports `why=trocken`. It ends as soon as a cycle reading falls below `pctDry`; only then (and after the pause has elapsed) does `beob` continue. The catch-up window `pauseHot` does not apply during the dry phase.

> **Fast-forward only:** the profile sets `dryDay` to `null` and `pctDry` to <!-- zr:cfg2.pctDry -->pctLo − 1<!-- /zr -->, so the dry phase is practically off. If the sensor sits in a glass of water at the start, a dry phase still begins (`why=trocken`) and ends as soon as the soil is dry enough for a job.

## States in st.state

| `st.state` | Meaning | Transition |
| --- | --- | --- |
| `beob` | observing, a job is possible | window with watering → `gegossen`; dry phase → `sperre` |
| `gegossen` | window with a regular end, waiting for the check (`rated:false`) | check → `sperre` |
| `sperre` | pause or dry phase running (`rated:true`); also the claim `laeuft` and non-regular window ends (`noeff`, `abbruch`, `extern`, `sensor` …) | pause over and `dryOk` → `beob` |

`st.why` carries the result of the last window, `laeuft` while it is in progress. Further fields: `ts` (window start), `dur` (seconds until pump-off of the last portion), `n` (portions), `sec` (pump seconds), `pctB`/`pctW`/`pctA` (moisture before, after the window, at the check), `effW` (window gain), `tr` (`tRise` of the second portion), `dryOk` (dry phase finished).

## Day change

There is no dedicated schedule entry at midnight. `bw_main` computes the local date without a `Date` object from `Sys.time` (HH:MM) and `unixtime` and compares it with `day.date`. On a change: `lrn.tMaxY ← tMaxD` (yesterday's maximum), `lrn.tMean` smoothed (0.9 old + 0.1 new), drying rate `lrn.rate`, `err.mem` (log memory), check the dry day, reset `day` to `{date, n:0, sec:0}` and clear the hint `limit`.

## KVS writes

Only what has changed is written. `bw_main` compares `lrn`, `st`, `day`, `err`, `job` with what it read; `bw_pump` writes the claim per window and at the end only the changed ones of `st`, `day`, `job`, `err`, `lrn` (normally claim + `st`/`day`/`job`/`lrn`, i.e. five). In the mock's 7-day model this is 15–22 writes per watering day (test limit 24, average below 18) – instead of 96 cycles. `Sys.GetStatus` shows the counter of all writes as `kvs_rev`.

## One day in regular operation

1. Cycle every 15 min: `bw_main` measures 5× (mean without outliers), temperature and water level. Moisture below `pctLo` and no brake → `job` with `ok=true` and `sec` from the dose formula (without `effW`: `tStd`).
2. Window 08:00:30 or 20:00:30: `bw_pump` reads `job` (age ≤ `jobAge`), computes the deadline, measures fresh: `≥ pctOk` → `feucht`, `> pctHi` → `nass`; checks the float switch and writes the claim `st.why=laeuft`.
3. Portions: portion 1, `tSoak` soak-in, measure until stable; below `pctOk` a correction portion from the measured gain; `≥ pctOk` → `ok`, `> pctHi` → `over`; limits `nPort`, `tMax`, daily reserve, deadline.
4. End of window: learn `effW` and `sf`, write `st`/`day`/`job`, console `ergebnis=…` (result).
5. Check `soak` min later: `Kontrolle: pctW → pctA`; above `pctHi + hyst` → `zuviel` (`sf − sfStep`); drop above `dropW` → `sink`.
6. Pause: until `pause` 24 h `why=pause`; if the daily maximum exceeded `tHot`, only `pauseHot` 12 h (i.e. both windows); hardly any drop → `pauseSlow` 48 h. At most `maxDay` windows per day, then `limit`.
7. Friday (`dryDay` 5): at the first cycle of the day the dry phase starts, `why=trocken`, no watering until a cycle reading falls below `pctDry`; then normal operation continues.
8. Wetness: if a cycle reading exceeds `pctHi` (not directly after an unchecked window), the dry phase starts immediately.

## Example output

> **Measured on the device (13 Sep 2026):** window 1 of the fast-forward schedule (cycle <!-- zr:cfg3.tick -->3<!-- /zr --> min, deadline <!-- zr:cfg4.tWin -->120<!-- /zr --> s, `pause` <!-- zr:cfg3.pause -->0.2<!-- /zr --> h, `tDead` <!-- zr:cfg3.tDead -->2<!-- /zr --> s, `tDead2` <!-- zr:cfg4.tDead2 -->0<!-- /zr --> s), sensor in dry soil, hose at the sensor.

```text
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] m0 10.4 % → P1 12 s
[bw_pump 0.2.0] P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)
[bw_pump 0.2.0] P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
[bw_main 0.2.0] Kontrolle: 50.5 → 53.7 % sf=0.7
[bw_main 0.2.0] V=1.82 pct=53.7 tC=23.6 lvl=0 st=sperre dry=1 pause=0.2h why=pause sec=- effW=2.006 sf=0.7 err=- w=2 dauer=5385ms
```

How to read it: the cycle reports 10.8 % below `pctLo`, no learned value (`effW=-`) → job `tStd` 12 s (fast-forward value). In the window (`Fenster: Auftrag` = window: job, `Frist` = deadline) `m0` reads 10.4 %, `P1` lifts it to 34 % (+23.6 %, first reaction after 8 s, `stabil` = stable after 12 s); the correction portion is clamped to `tPmin` 10 s and lifts it to 50.5 % – target `pctOk` 50 reached, but still rising at the timeout (`unstabil`) → `unstab`.

`g` is the gain since `m0` per effective second: `(23.6 + 16.5) / (10 + 10) ≈ 2.0` becomes `lrn.effW` (console 2.006, computed from unrounded values). The check at the next cycle (fast-forward `soak` 0.25 min) shows 53.7 %, no `zuviel`; afterwards `st=sperre why=pause`.

A `bw_main` line carries: voltage `V`, moisture `pct`, temperature `tC`, water level `lvl`, state `st`, `dry` (`st.dryOk`; 0 in `sperre` means a dry phase is open), chosen pause, reason `why`, job `sec`, learned values, fault `err`, number of writes `w`, runtime (`dauer`). The complete legend of all codes is in [13 · Operation and maintenance](13-betrieb-und-wartung.md).

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| "The window pumps exactly `sec` seconds" – it ran longer | `sec` is only the first portion; correction portions follow up to `pctOk`, together up to `tMax`. Only the single portion (without `pct`) pumps exactly `clamp(sec, 1, min(tPmax, tMax))` | read the console: one `P` line per portion, `ergebnis=` with `n` and `sec` |
| "The check 30 min later learns" – `effW` does not change there | the check only sets the hints `zuviel`/`sink` and possibly `sf`; `effW` comes from the window | look at `ergebnis=… effW=…` in the window |
| `why=pause` although nothing was watered | window aborted: the claim `st.why=laeuft` holds the pause (crash, stop, power) – or the window did not end regularly | read `st`; the pause runs out normally, a manual start within `jobAge` does not water |
| cycle reported `ok`, the window `feucht` | fresh reading `m0 ≥ pctOk`: watered by hand between cycle and window, or the sensor sits differently | nothing; no pause, no learning, the next cycle decides anew |
| `why=trocken` although the soil is not wet | the dry phase ends only below `pctDry` (28 %), not below `pctLo` | wait or check `pctDry` ([03 · Configuration](03-konfiguration.md)) |
| `why=soak` | the last window is still waiting for the check | resolves itself `soak` min after the window |
| `why=cfg` after an update | band incomplete (e.g. `pctOk` or `dropSlow` missing) or order violated; `err=cfg` | enter the missing field, run the installer |
| a manual start ends immediately with `zeit` | the deadline until the next cycle is too short for portion 1 plus measuring time | start shortly after a cycle (second 30) |
| `err=noeff`, nothing waters any more | two full portions without measurable effect (Σ < `dEffMin`) | check pump, hose, sensor position, then delete `err` ([13 · Operation and maintenance](13-betrieb-und-wartung.md)) |

## Next

- [03 · How the configuration fits together](03-konfiguration.md) – every field of this chapter: default, effect, when the installer must run again
- [04 · Safety and limits](04-sicherheit-und-grenzen.md) – why the pump switches off even without a script (`toggle_after`, `auto_off`, scheduled safety-off)
- [13 · Operation and maintenance](13-betrieb-und-wartung.md) – reading the console, all `why` and `err` codes, watering by hand
- [17 · Stage and decision log](17-etappen-und-entscheidungslog.md) – the reasons behind control loop, deadline and dry phase (decisions 38–63)
