# 16 · Concept and decisions (as of 0.2.0)

[Deutsch](../de/16-konzept-und-entscheidungen.md) · **English** — [Handbook](README.md) · Part F "Development"

> **At a glance**
> - Why the system is built this way: the device's schedule drives everything, each script computes for seconds only, all knowledge lives in the KVS – and water flows only when a reading demands it.
> - A reading chapter. It merges six historical files (project analysis v1, concept v2, architecture v1, implementation plans v1 and v2, onboarding prompt) with the addenda of the decision table; decision numbers 1–63 are the same as in [17 · Stage and decision log](17-etappen-und-entscheidungslog.md).
> - Key numbers: cycle <!-- def:cfg3.tick -->15<!-- /def --> min, windows at <!-- def:cfg3.winA -->08:00<!-- /def --> and <!-- def:cfg3.winB -->20:00<!-- /def -->, first portion with safety factor `sf` <!-- def:lrn.sf -->0.7<!-- /def -->, at most `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s per window – all in the KVS, nothing in code.
> - Biggest pitfall in thinking: answering "no effect" with "more water". The `noeff` rule (no effect) forbids exactly that – since the first project analysis and to this day.

## Prerequisites

- none – a reading chapter. Parts and scripts are explained in [01 · Overall architecture](01-gesamtarchitektur.md), the daily flow in [02 · Flow](02-flussdiagramm.md), every field in [03 · Configuration](03-konfiguration.md), the limits in [04 · Safety and limits](04-sicherheit-und-grenzen.md).

## Diagram

[![Principles map 0.2.0: schedule drives, no state in RAM, no number in code, three scripts, reading-led, control loop in the window, learned value, no effect means never more water, triple shut-off, weekly dry phase, device findings, rejected ideas](../diagramme/en/16-konzept-und-entscheidungen.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/16-konzept-und-entscheidungen.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/16-konzept-und-entscheidungen.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Design", 2 "Control", 3 "Safety", 4 "Rejected". The numbers in brackets are decision numbers from [17 · Stage and decision log](17-etappen-und-entscheidungslog.md).

## Starting point and task

On 12 Sep 2026 the project lead fixed the task in an onboarding prompt: a Shelly Plus Uni (firmware 2.0.0, Gen2 scripting in mJS) measures soil moisture, ambient temperature and water level every 15 minutes, decides on its own whether and how long to water, and switches a pump through a relay at 08:00 and 20:00. The system learns the effect of one pump second, adapts to summer and winter and removes waterlogging through dry phases. Everything runs autonomously on the device, without a backend.

Three things were settled with that and still are:

| Given | Content | Consequence for the build |
| --- | --- | --- |
| Hardware fixed | output 0 switches an existing relay, the relay the pump (Gardena holiday watering 970548801); SMT50 on the analog input with its own calibration; DS18B20 on the one-wire bus; float switch on input 1 (1 = empty, to be confirmed on the setup); internet mostly available but with outages | no pump load on the Shelly, relative moisture scale, timing only through the internal schedule |
| Device limits | at most 3 scripts at once; KVS 50 entries of 253 characters each; schedule 20 entries of 5 calls each; long-running scripts crash after hours | every script is a one-shot runner, short field names, no state in RAM |
| Working rules | stages with a verification step, nothing gets built that is not in the plan; version line in every file; no invented requirements, one question per message; check calls against the Shelly Gen2 docs; no cloud calls | decision table, test protocol, `lib_notes` as RPC reference, mock instead of device for every intermediate state |

### What has changed since 12 Sep 2026

The prompt describes version 0.1.0. Some of its numbers and sentences no longer hold in 0.2.0; the reasons are in the sections below.

| In the prompt | As of 0.2.0 | Why |
| --- | --- | --- |
| "exactly three scripts" | six scripts: three operating scripts, two hardware-test scripts, one fast-forward script – never more than one of the large ones at a time | hardware test and fast-forward as separate scripts (decisions 21, 30) |
| dry point 0.20 V | measured 0.296 V, wet point 3.134 V (13 Sep 2026, `bw_hwtest`) | calibration on the real setup, written to `cfg1` automatically (26) |
| `cfg1/cfg2/cfg3` | `cfg1..4` – `cfg4` carries the window control loop | 253 characters per entry (53) |
| learning 30 min after the dose in `bw_main`, learned value `eff` | `bw_pump` learns `lrn.effW` in the window from stabilised readings; the 30-min value is only a check | control loop in the window (38, 39, 43) |
| safety-off at 08:05 and 20:05 | 08:08 and 20:08 (`0 8 8,20 * * *`), computed from `tWin` | window budget 420 s (54) |
| `tMax` 120 s per dose | `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s per window, `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s per portion | portions instead of one dose (41) |
| job only after a dry phase following every dose | weekly dry phase from Friday and on wetness | decision 58 |
| the Shelly web UI as the only tool: "paste scripts in the web UI", `tools/` optional (interview of 12 Sep 2026, architecture v1 sections 1 and 5) | the web UI stays for KVS and console; build, upload, verification and tests run through `tools/` and the mock, upload via RPC | test helpers (4), editor loses text (19), mock (27) |
| script IDs via `Script.List` by name | unchanged – the device assigns the IDs | – |

### The onboarding prompt verbatim

The German text of 12 Sep 2026 stays as a source; its numbers are version 0.1.0. It is kept in the original language – a translation would no longer be the prompt.

<details markdown="1">
<summary>Onboarding prompt (part A of the onboarding document v1, unchanged, German)</summary>

```text
# Projekt: Shelly Plus Uni – lernende Pflanzenbewässerung

Du bist mein Entwicklungspartner für ein DIY-Bewässerungssystem. Ich bin
Projektleiter und Entscheider, du programmierst und dokumentierst. Wir
arbeiten in Etappen mit Prüfschritt; nichts wird gebaut, was nicht im
Plan steht. Sprache: Deutsch. Code-Kommentare: Deutsch. Variablennamen:
Englisch, kurz.

## Was wir bauen
Ein Shelly Plus Uni (Firmware 2.0.0, Gen2-Scripting in mJS) misst alle
15 Minuten Bodenfeuchte, Umgebungstemperatur und Wasserstand, entscheidet
selbst, ob und wie lange gegossen wird, und schaltet um 08:00 und 20:00
über ein Relais eine Wasserpumpe. Das System lernt die Wirkung einer
Pumpensekunde, passt sich an Sommer und Winter an und baut Staunässe
durch Trockenphasen ab. Alles läuft autark am Gerät, ohne Backend.

## Hardware (fest)
- Shelly Plus Uni; Ausgang 0 schaltet ein vorhandenes Relais, das Relais
  schaltet die Pumpe (Gardena Urlaubsbewässerung 970548801)
- SMT50 Bodenfeuchtesensor am Analogeingang (Voltmeter):
  0,20 V = trocken (0 %), 3,13 V = im Wasser (100 %), eigene Kalibrierung
- DS18B20 Temperaturfühler am Ein-Draht-Bus, misst Umgebung
- Wasserstandsensor am Eingang 1: 1 = leer, 0 = Wasser vorhanden
  (am Aufbau noch zu bestätigen)
- Internet meist vorhanden, fällt aber öfter aus. Zeitsteuerung nur über
  den internen Shelly-Zeitplan.

## Gerätegrenzen (harte Fakten)
- max. 3 Scripts gleichzeitig → wir nutzen genau drei
- KVS: 50 Einträge à max. 253 Zeichen → kurze Feldnamen, kompaktes JSON
- Zeitplan: 20 Einträge, je bis zu 5 Aufrufe
- Erfahrung: Dauerscripts stürzen nach Stunden ab → jedes Script ist ein
  Einmal-Läufer: starten, Arbeit erledigen, Script.Stop auf sich selbst.
  Kein Zustand im RAM, alles im KVS.

## Architektur (entschieden, nicht verhandelbar)
Script 0 „bw_install": einmalig von Hand gestartet. Legt Zeitplan-
  Einträge an (alle 15 min → Script 1; 08:00 und 20:00 → Script 2;
  08:05 und 20:05 → Switch.Set Ausgang 0 aus als Sicherheits-Aus),
  schreibt cfg1/cfg2/cfg3 nur wenn nicht vorhanden, ermittelt Script-IDs
  über Script.List nach Namen.
Script 1 „bw_main": alle 15 min. Misst, bewertet, lernt, bestimmt Pause
  und schreibt einen Gießauftrag in den KVS-Eintrag „job". Rührt die
  Pumpe nie an. Übernimmt den Tageswechsel per Datumsvergleich.
Script 2 „bw_pump": 08:00 und 20:00. Liest „job", prüft Freigaben
  (job.ok, Alter des Auftrags, Tageslimit, Wasserstand), schaltet
  Ausgang 0 mit toggle_after = Sekunden, überwacht währenddessen den
  Wasserstand, schreibt Ergebnis in „st" und „day", setzt job.ok=false.

## Keine Konfiguration im Code
Jeder Schwellenwert, jede Zeit, jede Grenze liegt im KVS. Fehlt ein
Pflichtfeld, setzt das Script „err" und tut nichts. Katalog in
docs/umsetzungsplan-v2.md, Kurzfassung:
- cfg1 Sensor: vDry 0.20, vWet 3.13, vErrLo 0.10, vErrHi 3.35,
  nSample 5, lvlEmpty 1, nLvl 3
- cfg2 Regelung: pctSoll (SOLL-Mittelwert, Ziel jeder Gabe), pctLo,
  pctHi, pctDry, hyst 2, dropSlow, effMin 0.05, effMax 2.0, alpha 0.3
  – die pct-Werte und dropSlow sind noch offen und werden aus zwei
  Messungen an der Pflanze eingetragen; bis dahin null
- cfg3 Pumpe/Zeiten: tDead 20, tMin 40, tStd 70, tMax 120, tHot 35,
  pauseHot 12, pause 24, pauseSlow 48, soak 30, jobAge 20, maxDay 2

## Regelungskern (aus docs/konzept-v2.md und docs/umsetzungsplan-v1.md)
- Feuchte % = (V − vDry) / (vWet − vDry) × 100, begrenzt 0…100;
  mehrere Messungen, Mittelwert der mittleren Werte
- Auftrag nur wenn: Feuchte < pctLo UND Pause abgelaufen UND
  Trockenphase nachgewiesen UND Wasser vorhanden UND keine Störung
- Dosis: sec = (pctSoll − ist) / lrn.eff + tDead, begrenzt tMin…tMax;
  unter tMin → kein Auftrag. Erste Gabe überhaupt: tStd.
- Lernen 30 min nach Gabe: eff_neu = Δ% / (sec − tDead);
  lrn.eff = (1−alpha)·alt + alpha·neu, begrenzt effMin…effMax
- „Gegossen, keine Wirkung" → err, kein Lernwert, NIE mehr Wasser
- Pause: Tagesmax > tHot → pauseHot; Abnahme/24 h < dropSlow →
  pauseSlow; sonst pause
- Sensor unplausibel (V < vErrLo oder > vErrHi) → err, kein Auftrag
- Wasser leer während Gabe → sofort aus, kein Lernwert
- KVS schreiben nur bei Änderung, nie „einfach jeden Takt"

## KVS-Vertrag
cfg1, cfg2, cfg3 (Konfiguration) · lrn {eff, rate, tMean, tMax24} ·
st {state, ts, sec, pctB, pctA, rated, dryOk} · job {ok, sec, pct, why,
ts} · day {date, n, sec} · err {code, ts, mem}. Details und wer was
liest/schreibt: docs/umsetzungsplan-v1.md Abschnitt 4.

## Repository
Öffentliches GitHub-Repo, MIT-Lizenz. Struktur:
  README.md, LICENSE, docs/ (die fünf Konzeptdokumente + PLAN.md),
  scripts/bw_install.js, scripts/bw_main.js, scripts/bw_pump.js,
  scripts/lib_notes.md (Shelly-API-Aufrufe, die wir nutzen, mit Link),
  hardware/ (Stückliste, Verdrahtung als ASCII und später Foto),
  tools/ (optional: Test-Helfer, KVS-Dump per curl)
README-Anforderung: Ein Einsteiger UND ein Profi müssen das Projekt
vollständig nachbauen können. Inhalt: Zweck in drei Sätzen · Stückliste
mit Bezugsquelle · Verdrahtung Schritt für Schritt mit Bild/ASCII ·
Kalibrierung (Trocken-/Nasspunkt messen, zwei Pflanzenmessungen) ·
Installation (Scripts in Web-UI einfügen, Installer starten) ·
Konfiguration (alle KVS-Felder erklärt) · Betrieb und Ablesen ·
Störungen und was sie bedeuten · Sicherheit (Pumpe, Wasser, Strom) ·
Funktionsweise für Interessierte · Grenzen des Shelly.

## Arbeitsregeln
1. Wir gehen docs/PLAN.md Etappe für Etappe. Vor jeder Etappe zeigst du
   mir, was du bauen wirst; nach jeder Etappe den Prüfschritt.
2. Jede Datei bekommt eine Versionszeile im Kopf; Änderungen werden
   nicht still überschrieben, sondern im Commit benannt.
3. Erfinde keine Anforderungen. Ist etwas unklar, frag mich – eine Frage
   pro Nachricht.
4. Halte dich an die Shelly-Gen2-API-Dokumentation
   (https://shelly-api-docs.shelly.cloud/gen2/). Prüfe Aufrufnamen und
   Parameter dort, bevor du sie verwendest; rate nicht.
5. Scripts müssen ohne Internet laufen. Keine Cloud-Aufrufe.
6. Lies zuerst docs/ vollständig, fasse mir in zehn Zeilen zusammen, was
   du verstanden hast, und nenne offene Punkte. Dann beginnen wir mit
   Etappe 0.
```

</details>

## Design principles

### The schedule drives, the script computes briefly

Experience from operation: permanently running scripts crash on the Shelly after hours, whereas the device's schedule is stable. Therefore every operating script is a **one-shot runner**: the schedule starts it, it completes exactly one work cycle and stops itself with `Script.Stop` on its own ID. A script that lives for seconds cannot leak memory over hours; if one cycle crashes, the schedule starts the next one as normal. A failure costs one cycle, not the operation.

The schedule is the engine, the script the head, the KVS the memory (architecture v1). The schedule only sets the **cycle**, not the watering moment – that remains the difference to a timer switch. Concept v2 planned three entries (work cycle, safety-off, day change); today the installer creates these:

| Entry | Timespec | Call | Origin |
| --- | --- | --- | --- |
| work cycle | `0 */15 * * * *` (from `cfg3.tick`) | `Script.Start` `bw_main` | concept v2 0.2; 10-min cycle in the interview of 12 Sep 2026, 15 min with the split into three scripts |
| watering window | `30 0 8,20 * * *` (from `winA`/`winB`, second 30; two entries if the minutes differ) | `Script.Start` `bw_pump` | requirement of 12 Sep 2026 "exclusively at 08:00 and 20:00" (implementation plan v1); second 30 since decision 37 |
| safety-off | `0 8 8,20 * * *` (from `cfg4.tWin`, rounded up) | `Switch.Set {on:false}` | concept v2 0.2 "no script and no logic"; minute 8 since decision 54 |
| day change | no entry | `bw_main` compares `day.date` with the date | implementation plan v1 section 4: saves one entry and one script |

A work cycle still follows the sequence from concept v2 (0.3): read state, measure moisture (several values, mean of the middle values, plausibility), temperature, water level (several times, must be stable), decide, write (only on change), end. Only the step "switch the pump" moved into a script of its own with implementation plan v1.

The schedule needs a valid time (NTP). Concept v2 (0.7) proposed an emergency mode with its own cycle for sites without internet; the interview of 12 Sep 2026 rejected it: after a power failure without internet the system pauses until the time is back. As long as the device keeps running it keeps the time even without internet. This residual risk is accepted deliberately (architecture v1 section 7).

### No state in RAM

Everything the next cycle needs to know lives in the KVS: `cfg1..4`, `lrn`, `st`, `job`, `day`, `err`. Every cycle reads the state afresh and decides from scratch. There is no moment at which the system is "in the middle of something" and a restart would confuse it (concept v2 0.4). The state machine became simpler with the control loop:

| Concept v2 | Meaning then | As of 0.2.0 |
| --- | --- | --- |
| observe | measure only | `st.state = beob` (observing) |
| watered | dose completed, pump long off | `gegossen` (watered) – waits for the check `soak` min after the window end |
| soaking | reading not yet meaningful | no separate state any more: soaking (`tSoak`) and stabilisation happen in the window, in `bw_pump` |
| lock | dry phase or pause running | `sperre` (lock); `st.dryOk` says whether the dry phase has ended |
| fault | watering blocked until the cause is gone | separate in `err.code`; blocking codes clear themselves, `noeff` only by hand (decision 8) |

Writes happen only on a state change, never "simply every cycle" – the KVS lives in flash. With a 15-minute cycle that would be about a hundred writes a day; in reality it is 15 to 22 on a watering day (budget ≤ 24, measured in the 7-day simulation; test protocol: compare `kvs_rev` morning and evening). Time is computed from timestamps instead of cycle counters (concept v2 4.7) – possible because the schedule requires a valid time anyway; in the window the time comes from `Shelly.getUptimeMs()`, never from tick counters (44).

Two device findings sharpened the principle: KVS values are **JSON strings** (15), because the web UI shows objects only as `[object Object]` and `cfg2` is maintained by hand; and the installer **replaces unreadable entries** with defaults (16), adds missing fields (32) and never overwrites valid values. After a crash in the middle of the window the rule from concept v2 (0.5) holds: no learned value from an unsafe dose – today through the claim `st.why = laeuft` (running) (42).

### Three scripts instead of one

Concept v2 and architecture v1 knew one script that measures and switches in the same cycle. The requirement of 12 Sep 2026 – water only at 08:00 and 20:00 – separates measuring and watering: `bw_main` measures every 15 minutes and **only decides**, `bw_pump` waters in the windows, `bw_install` creates schedule, defaults and switch configuration once.

The KVS entry `job` is the interface: `bw_main` writes into it, `bw_pump` reads and executes. Because the job is rewritten on every change and before every window (11), at 08:00 the decision of 07:45 applies, not a stale one from yesterday (`jobAge` <!-- def:cfg3.jobAge -->20<!-- /def --> min).

Since 0.2.0 the division of labour is sharper (38):

| Script | decides on | writes |
| --- | --- | --- |
| `bw_main` (cycle) | band order, plausibility, day change, dry phase, pause, daily limit, job with first portion; check `soak` min after the window (`zuviel` (too much) → `sf`, hint `sink` (drop), catch-up pause) | `job`, `st` (check), `lrn` (`sf`, daily maximum, `tMean`, `rate`), `day`, `err` |
| `bw_pump` (window) | fresh reading, portions, stability, verdict of the window, learned value, deadline | claim `st`, at the end `st`, `day`, `job`, `lrn.effW`/`sf`, `err` |
| `bw_install` (once) | schedule from `cfg3`/`cfg4`, missing fields, `auto_off`, no autostart of the scripts (`Script.SetConfig` with `enable: false` – in the Gen2 API `enable` means "autostart at boot") | `cfg1..4`, empty states, schedule, switch config |

Three more scripts start only by hand and are never in the schedule: `bw_hwtest` and `bw_hwpump` (21: a single test script would have been 23.7 KB compact, so sensor and pump parts were split; the pump test never switches the pump itself but orders `bw_pump`, 23) and `bw_zeitraffer` (30: a pure profile with short times, the operating scripts run unchanged).

### No configuration in code

Implementation plan v2 fixed the principle: every threshold, the target band, every time and every limit live in the KVS; the scripts read them at every start. If a mandatory field is missing, the script sets `err = cfg` and does nothing. The installer writes defaults only when the entry is missing – manual changes in the web UI survive a reinstallation. Because of the 253 characters per entry the configuration is split: `cfg1` sensor, `cfg2` target band, `cfg3` pump and times, `cfg4` window control loop (53). All fields with defaults are in [03 · Configuration](03-konfiguration.md).

The catalogue from implementation plan v2 has grown in 0.2.0 at these places (deviations according to the decision table):

| Entry | added | Reason |
| --- | --- | --- |
| `cfg1` | `msSample` <!-- def:cfg1.msSample -->500<!-- /def --> ms, `idV`/`idT`/`idLvl`/`idSw` | time constants and component IDs belong in the KVS (5) |
| `cfg2` | `sfMin` <!-- def:cfg2.sfMin -->0.5<!-- /def -->, `sfStep` <!-- def:cfg2.sfStep -->0.1<!-- /def -->, `pctOk`, `dropW`, `sfUp` <!-- def:cfg2.sfUp -->0.05<!-- /def -->; `effMax` 2 → <!-- def:cfg2.effMax -->30<!-- /def --> | safety factor (10, 43), "target reached" point (47), gain scale on the device (40) |
| `cfg3` | `tChk` <!-- def:cfg3.tChk -->5<!-- /def --> s, `winA`/`winB` functional, `tick`, `winEvery`, `dryDay` <!-- def:cfg3.dryDay -->5<!-- /def -->; `tMin` 40 → <!-- def:cfg3.tMin -->25<!-- /def -->, `tMax` 120 → <!-- def:cfg3.tMax -->180<!-- /def --> | cycle and windows were the last time constants left in code (29); dry day (58); sum per window (41) |
| `cfg4` | new: `tWin`, `tTail`, `nPort`, `tPmin`, `tPmax`, `tSoak`, `tStep`, `tStab`, `nStab`, `dStab`, `tDead2`, `dEffMin` | control loop in the window; `cfg3` would have exceeded the 253 characters (53) |
| `lrn` | `sf`, `tMaxD`/`tMaxY` instead of `tMax24`, `effW` instead of `eff` | the heat rule must know yesterday's maximum at 08:00; window learning (43) |

The roles of the band fields come from implementation plan v2: `pctLo` decides **whether** to water, `pctSoll` **how much** – the only number that sets the dose.

### Upload from dist/, byte-for-byte check

Script storage on the device is limited, and the compact output spares the shared heap: `npm run build` removes comments, indentation and blank lines (17); only the version line and the `//!` lines remain as device documentation (35). `size.test.js` keeps every script below <!-- fact:size_limit -->16 000<!-- /fact --> B, `bw_pump` below <!-- fact:size_limit_pump -->18 000<!-- /fact --> B – today <!-- fact:dist.bw_main -->15 791<!-- /fact --> B and <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B. `scripts/` remains the only source.

Because the web UI editor lost the end of the file when pasting (166 and 210 bytes, 12 Sep 2026), `put-script.js` uploads via `Script.PutCode` in chunks and compares the code on the device byte for byte; `verify-scripts.js` repeats this check for all scripts (19, 35). Tools and procedure: [14 · Debugging and testing](14-debuggen-und-testen.md).

## Control core

### Reading-led instead of time-led

There is no fixed watering plan. Watering happens when the cycle reading falls below `pctLo`; the amount is the distance from actual to `pctSoll`. The seasonal effect follows by itself: in summer the soil dries faster, the lower limit is reached more often, in winter less often – without calendar logic (project analysis v1 4.1).

The moisture scale is a calibration of our own, not a datasheet value (question 1 of the project analysis, settled in concept v2): 0 % = `vDry` (sensor dry in air), 100 % = `vWet` (sensor in water), linear in between, clamped to 0 to 100. The datasheet ends at 3 V for 50 percent by volume; 3.13 V and later 3.134 V were measured in water – irrelevant for the control, because the scale is defined by our own measuring points. 100 % means "sensor stands in water": a calibration point, never a target. The target band lies well below.

Noise and plausibility (project analysis 1.2, 1.3): one moisture percent is about 0.03 V on the 0–15 V input, single values scatter. Hence `nSample` <!-- def:cfg1.nSample -->5<!-- /def --> values per reading (mean of the middle values in the cycle, median in the window), a hysteresis `hyst` <!-- def:cfg2.hyst -->2<!-- /def --> % at the lower limit and plausibility limits `vErrLo` <!-- def:cfg1.vErrLo -->0.10<!-- /def --> and `vErrHi` <!-- def:cfg1.vErrHi -->3.35<!-- /def --> V.

A torn cable delivers 0 V and would look like "completely dry" – exactly then watering would happen unchecked. The plausibility rule (`err = sensor`, no dose) is therefore the single most important protective rule.

### Target band from measurement

Concept v2 (4.2) replaces estimated defaults (project analysis: 35/48/60 %) with two measurements on the real plant: water generously once, wait 30 minutes, measure ("well supplied"); wait until the plant visibly needs water, measure ("water now"). That way the numbers fit plant, substrate and pot size without anyone inventing them (question 8). On the device an example band was set by hand on 13 Sep 2026; the calibration run `hwtest.js kal` provides the data basis ([12 · First commissioning](12-erstinbetriebnahme.md)).

Since 0.2.0 the band has five fields with a fixed order `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` and `pctLo + hyst < pctOk`; if a manual entry violates it, `bw_main` reports `why=cfg` (47). Example band 28 < 40 < 50 ≤ 55 < 60:

| Field | Question | refers to | Decision |
| --- | --- | --- | --- |
| `pctLo` | whether a job is created (`≥ pctLo` means `feucht` (moist), with a running job `≥ pctLo + hyst`) | cycle reading | 47 |
| `pctSoll` | how much the first portion aims for | stabilised window reading | 39, 47 |
| `pctOk` | from when no further portion is needed; fresh reading `≥ pctOk` → `feucht` | window reading | 47, 49 |
| `pctHi` | from when it is "too much" (`over`, `zuviel`) and wetness starts a dry phase | window reading or cycle reading | 39, 58 |
| `pctDry` | when a dry phase ends | cycle reading | 58 |

The reference (39) is the stabilised reading in the window: the sensor sits centrally under the drippers and measures the wettest point, quickly. The value 30 minutes later is drained soil and never enters the learned value.

### Learned value per effective second

A single learned value drives the dosing: how many moisture percent one **effective** pump second brings (`lrn.effW`). Effective means: minus the dead time. The first seconds only fill the hose – in the interview of 12 Sep 2026 "below 20 s no water arrives", hence `tDead` <!-- def:cfg3.tDead -->20<!-- /def --> s; the measurement run of 13 Sep 2026 showed on the test setup 3-s pulses without effect and a first reaction (`tRise`) after 5 to 8 s, `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s for follow-up portions with a full hose.

The dead time belongs to the hose, not to the plant: re-measure on the final setup with `hwtest.js mess`, `kal write` writes `tDead`/`tDead2` from `tRise`.

The procedure has been the same since project analysis v1 (4.3), only its place has moved: note the moisture before the portion, seconds = distance divided by learned value, pump, soak, re-measure, compute the effect per second, nudge the learned value gently – `alpha` <!-- def:cfg2.alpha -->0.3<!-- /def --> (70 % old, 30 % new), clamped to `effMin` <!-- def:cfg2.effMin -->0.05<!-- /def --> to `effMax` <!-- def:cfg2.effMax -->30<!-- /def --> %/s so that one outlier cannot tip the value.

`effMax` was 2 and was set to 30 because 5 s of pumping on the setup lifted the moisture from 0 to 36 and 54 % (40). The initial value is measured from the first standard dose `tStd` <!-- def:cfg3.tStd -->70<!-- /def --> s, not estimated.

The safety factor `sf` (10, 43) starts at <!-- def:lrn.sf -->0.7<!-- /def -->: the first portion deliberately lands below the target, correction portions in the window fetch the rest – better to top up than to flood. If a window ends with a single portion above `pctHi` (`over`), `sf` drops by `sfStep` (never below `sfMin`); if it ends in the band only after correction portions, `sf` rises by `sfUp` (at most 1).

`bw_main` computes the first portion: `sec = (pctSoll − actual) / effW · sf + tDead`, clamped to `tMin` … `tMax`; without a learned value `tStd`. The old `tmin` (no job below the minimum dose) became a clamp to `tMin` in 0.2.0 (38).

### Control loop in the window

Up to 0.1.x `bw_pump` gave exactly one dose per window, `bw_main` rated it 30 minutes later, and a dose too small or too large was corrected at the earliest on the next day ("one portion per cycle, the next cycle decides the next one", concept v2 4.4). The observation on the setup of 13 Sep 2026 – very dry soil often jumps only to 20 % after a dose, more than 60 % was too much – led to the addendum in the concept that replaces 4.3 and 4.4: the control loop closes **in the window**.

1. Fresh reading `m0` (`nSample` values, median): `≥ pctOk` → `feucht`, no dose, no learned value, no pause (49); `> pctHi` → `nass` (wet), dry phase (58).
2. Claim `st.why = laeuft` into the KVS, then portion 1 with `toggle_after` (first portion from the job).
3. Soak `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s, then measure every `tStep` <!-- def:cfg4.tStep -->5<!-- /def --> s until `nStab` <!-- def:cfg4.nStab -->4<!-- /def --> values lie within `dStab` <!-- def:cfg4.dStab -->1<!-- /def --> % **and** no longer rise, at most `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s (45).
4. Verdict: above `pctHi` → `over`; from `pctOk` → `ok`; otherwise the next portion from the effect measured in the window `g = ΣΔ % / Σ effective seconds`: target = half the way to `pctHi`, at most `pctSoll`; `sec = (target − actual) / max(g, effMin) + tDead2`, clamped to `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> … `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s, never multiplied by `sf` (40).
5. Limits: at most `nPort` <!-- def:cfg4.nPort -->6<!-- /def --> portions (`max`), together `tMax` s, budget `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s, and every further portion only if portion, soaking and stabilising still fit before the deadline (`zeit` (time), 44).
6. At the window end learning (`effW`, `sf`), result in `st`, `day`, `job`; one console line per portion, never more than about 15 lines in a row (52).

The stability rule (45) got its shape from the edge-case analysis: "three values within 1 %" is satisfied on a ramp. Therefore the trend counts as well (newest minus oldest ring value ≤ `dStab`/2); on timeout the ring mean applies, still rising → `unstab` (unstable: window ends, no further portion, learned value yes). The sequence "portion → re-measure → next portion" is the control structure of the literature on sensor-guided pulse irrigation (research below).

### No effect means never more water

The most important rule of the concept comes from the table "recognising too much and too little" (project analysis 4.5, concept v2 4.5): if the moisture stays practically unchanged after the soaking time, that is a suspected fault – pump, hose, sensor position – and **no** reason to water again. Otherwise a slipped sensor would flood the pot.

| Observation | Assessment | Reaction 0.2.0 |
| --- | --- | --- |
| above `pctHi` | too much | `over`: after a single portion `sf` drops, next first portion smaller |
| still below `pctOk` | too little | further portion from the measured effect `g` |
| practically unchanged (Δ < `dStab`) | suspected fault | first portion: exactly one full probe portion; if that also fails (ΣΔ < `dEffMin` <!-- def:cfg4.dEffMin -->2<!-- /def --> %) → `noeff`, blocking, cleared only by hand, no learned value (46); a later portion without effect → `stall` |
| in the band | fits | `ok`, nudge the learned value |

The capped probe portion is the only exception to the rule. Decision 46 replaces decision 7 (`eff_neu < effMin` in `bw_main`); since 0.2.0 `noeff` arises only in `bw_pump`.

### Pauses and weekly dry phase

The minimum pause comes from the interview of 12 Sep 2026 (question 9, architecture v1 6.2): daily maximum above `tHot` <!-- def:cfg3.tHot -->35<!-- /def --> °C → `pauseHot` <!-- def:cfg3.pauseHot -->12<!-- /def --> h, both windows may water; otherwise `pause` <!-- def:cfg3.pause -->24<!-- /def --> h, only one of the two windows; if the moisture drops by less than `dropSlow` in 24 h → `pauseSlow` <!-- def:cfg3.pauseSlow -->48<!-- /def --> h (suspected waterlogging remains).

The drying rate `lrn.rate` in %/h comes from project analysis 4.6: if it stays near zero despite warmth, that hints at waterlogging or a sensor fault.

| Rule | Effect in two-window operation (implementation plan v1 section 5) |
| --- | --- |
| `pauseHot` 12 h | 08:00 and 20:00 may both water |
| `pause` 24 h | only one of the two windows, the first after expiry |
| `pauseSlow` 48 h | one window, then a full day of pause |

Two addenda: the pause counts as expired when at the next window it is over except for one cycle – otherwise a 24-h pause would miss the 08:00 window by seconds and push the dose to 20:00 (7-day simulation). And if the window ended with `max`/`zeit` and the check reading afterwards (`st.pctA`) is still below `pctLo`, `pauseHot` applies as a catch-up window (38). Because `bw_main` decides afresh every 15 minutes, it can still say "no" at 07:45 although the soil looked dry last night.

The dry phase changed its form. Project analysis and concept v2 (4.6) required two conditions after **every** dose: moisture fallen once below the dry threshold and minimum pause expired.

Since 0.2.0 the **weekly dry phase** applies (58): water normally without a dry phase; from the day change to `dryDay` <!-- def:cfg3.dryDay -->5<!-- /def --> (Friday) and as soon as a cycle reading or the fresh reading in the window lies above `pctHi`, no dose until a cycle reading lies below `pctDry` (`why=trocken`, dry). For calibration and fast-forward it is switched off (`dryDay` null, `pctDry` = `pctLo − 1`).

### Temperature and water level

Temperature has two tasks on two time axes (project analysis 2.1): the current value acts on locks (heat rule `tHot`), a mean over days (`lrn.tMean`) serves as season indicator without a calendar. If the probe fails, watering continues with the base values and `err = temp` is set as a hint (question 4, decision 6) – the moisture reading carries the control, the temperature only refines it.

A frost lock for outdoor sites (proposal: no watering below 4 °C) depends on question 3 and is not built. The daily maximum is stored in 2 °C steps so that a summer day does not cost ten writes.

Water level (project analysis 3.1 to 3.5): the mapping "1 = empty" had to be confirmed on the setup, not assumed in the script – confirmed on 13 Sep 2026 (`lvlEmpty` <!-- def:cfg1.lvlEmpty -->1<!-- /def -->). The float switch bounces, so a state counts only after `nLvl` <!-- def:cfg1.nLvl -->3<!-- /def --> identical readings within one cycle.

If the empty signal arrives during a portion, the pump goes off within `tChk` <!-- def:cfg3.tChk -->5<!-- /def --> s (`abbruch` (abort), `err = wasser` (water)); the aborted portion yields no learned value, finished portions before it count (43). Nothing is caught up blindly: after refilling, the normal cycle decides anew (question 6). The float switch sits above the pump inlet so the pump never runs dry (question 7).

## Safety

### Triple shut-off

Project analysis v1 (5.2) provided two safeguards, concept v2 (5.2) three: the switch-off time in the switch-on command (`toggle_after`), the automatic switch-off in the device configuration (`auto_off`) and the safety-off in the schedule. The device executes all three without a script.

One condition came from the architecture: the maximum duration per dose must be shorter than the offset of the safety-off, so that it never cuts into an intended dose. The installer still honours it by computing the safety-off from `PUMP_SEC + tWin + 10` s (54) and setting `auto_off` to `tMax + 10` = 190 s (12, 41). Details and measurements: [04 · Safety and limits](04-sicherheit-und-grenzen.md).

Hard upper limits apply independently of all learned values – the emergency brake when the learning logic is wrong (project analysis 5.3): per portion `tPmax`, per window `tMax`, per day `maxDay` <!-- def:cfg3.maxDay -->2<!-- /def --> windows, minimum pause. After a power failure the output is safely off (`initial_state = off`, 5.4), and the lock time survives the restart because it lives in the KVS. The output itself carries only 30 V / 300 mA and switches the relay coil, never the pump (5.1 – the most critical finding of the project analysis, settled in concept v2 by the existing relay).

### Deadline and claim

The control loop brought two new safeguards. The **deadline** (44): at start `bw_pump` computes `B = min(tWin, tick·60 − q − tTail)` with `q` = seconds since the last cycle – normally 420 s – and starts no portion that no longer fits together with soaking and stabilising (`zeit`). The same condition "window end + `tTail` <!-- def:cfg4.tTail -->20<!-- /def --> s before the next cycle" is checked statically by the installer and by the mock as overlap guard. So `bw_main` and `bw_pump` never run at the same time; in addition `bw_pump` starts 30 s after the full minute (37).

The **claim** (42): before the first portion `bw_pump` writes `st.why = laeuft`. If the script dies in the middle of the window (`out_of_memory`, exception, `Script.Stop`, power), the pump goes off through the three shut-offs, `bw_main` keeps the pause, no learned value and no `noeff` arise. A claim in `job` instead of `st` was rejected (62) because `bw_main` refreshes `job` every cycle.

## What the device tests changed

The mock runs the scripts in V8. What V8 interprets more generously than mJS only showed on the device – and each time became a rule in the tests, not just a note. The short form; symptom, cause and fix per finding in [18 · Lessons from the device](18-lernlog-geraet.md):

| Date | Finding on the device | Rule since then | Decision |
| --- | --- | --- | --- |
| 12 Sep 2026 | `ReferenceError: "stepRead" is not defined` – mJS does not hoist function declarations | step list `steps` at the very bottom, `syntax.test.js` checks use before declaration | 13 |
| 12 Sep 2026 | `Too much recursion` in `bw_pump` at 9–11 nested calls; device: 12 levels run, 14 crash | `next()` as a flat loop; the mock measures the depth, limit <!-- fact:call_depth -->10<!-- /fact --> | 14 |
| 12 Sep 2026 | web UI shows KVS objects as `[object Object]` | KVS values as JSON strings; installer replaces unreadable entries | 15, 16 |
| 12 Sep 2026 | editor loses the end of the file when pasting (166/210 bytes) | upload via RPC in chunks, byte-for-byte check | 19 |
| 12 Sep 2026 | first `Schedule.Create` per run fails with a false "timespec" error | up to 3 attempts after 400 ms | 20 |
| 13 Sep 2026 | `Function "shift" not found!` – mJS lacks many array methods | only `push`, `slice`, `splice`, `indexOf`, `join`; ring buffer by index | rule in `syntax.test.js` |
| 13 Sep 2026 | `out_of_memory`: the script heap (~25 KB) is shared by all scripts | pump test in two passes, long runners free KVS objects in waiting phases | 28 |
| 13 Sep 2026 | `bw_pump` dies next to `bw_main` when both start at the full minute | `bw_pump` starts at second 30 (`PUMP_SEC`) | 37 |
| 13 Sep 2026 | flash: `fs_free` 12 288 B with seven scripts, 49 152 B without the three test scripts | delete test scripts before an upload; `put-script.js` checks `fs_free` | 59 |
| 13 Sep 2026 | measurement run: 3-s pulses only fill the hose, 10-s pulse +11.6 % from 7.9 s | portions never shorter than the dead time; `cfg4` defaults from the measurement run | stage 10 |
| 13 Sep 2026 | window 1 in fast-forward: `effW` 2.006 in the profile scale, 4.46 %/s after `tRise` | `kal write` writes `effW`, `tDead2`, `tDead`, `tMin` = max(`tPmin`, `tDead` + 2) | stage 10 |

The number of tests grew with every finding: 53 (12 Sep 2026), 58, 89 and 102 (13 Sep 2026), 144 after stage 10, today <!-- fact:tests -->146<!-- /fact --> tests against the mock.

## Rejected alternatives

| Alternative | Why rejected | Decision |
| --- | --- | --- |
| switching off at a lead threshold during the portion | with 10–20 s of water travel time and 7–20 %/s gain the value keeps rising after switch-off; the portion is neither reproducible nor usable as a learned value. "Portion → re-measure → next portion" is the control structure of the literature | 60 |
| class learning `effD`/`effN` (dry/normal) from the first window | more `lrn` fields and code size without a data basis; only once the calibration run shows more than 50 % difference between the states | 61, 57 |
| claim of the running window in `job` | `job` is the hand-over, not the state, and is refreshed every cycle; `st.why = laeuft` is a single write that only `bw_pump` sets | 62 |
| Smith predictor (model-based dead-time compensation) | needs a process model and a continuous controller; a one-shot runner without state in RAM cannot track a model. Dead time is handled additively (`tDead`, `tDead2` from `tRise`) | 63 |
| emergency-mode script for an invalid clock (concept v2 0.7) | the less stable path; interview of 12 Sep 2026: schedule only, the system pauses until NTP is back | architecture v1 section 5 |
| `Script.Eval` or the web UI as command channel for the hardware tests | the KVS entry `hwc` is visible everywhere and reproduced in the mock; old commands never act | 22 |
| a single hardware-test script | 23.7 KB compact, above the size limit | 21 |
| outlier rule "discard jumps > 25 %" | would discard every first portion on the device; plausibility only via `vErrLo`/`vErrHi`, stability via span and trend | 45 (calibration agent) |
| `eff` learning and `noeff` in `bw_main`, 30 min after the dose | the drained 30-min value is the wrong reference; learning and `noeff` live in the window | 38, 46 (replaces 7) |
| day change as a separate schedule entry | date comparison in `bw_main` saves an entry and a script | implementation plan v1 |
| measurement history or buffering on the device | KVS too small (50 × 253 characters); history is the job of stage 2 | project analysis 7, 8 |
| `auto_off` = `tPmax + 10` instead of `tMax + 10` | `auto_off` acts per switch-on command and covers a single portion longer than necessary; the one-liner stays documented as an alternative | 41 |

## Questions answered

The 13 open questions of project analysis v1 and the four new ones from concept v2 – with answer and status 0.2.0:

| No. | Question | Answer | Source |
| --- | --- | --- | --- |
| 1 | Moisture scale: percent by volume or relative scale 0–100 %? | relative scale via our own calibration points `vDry`/`vWet` | concept v2 1.1; 39 |
| 2 | Second probe for soil temperature? | not built; the green wire of the SMT50 stays unused, a second DS18B20 would be possible on the one-wire bus | open, idea |
| 3 | Site indoors or outdoors – frost lock? | open; no frost lock built | open |
| 4 | Probe failure: keep watering or suspend? | keep watering, `err = temp` does not block; heat rule inactive then | decision 6 |
| 5 | Does 1 mean empty? | yes: EMPTY = 1, FULL = 0 (8 transitions observed) | device, 13 Sep 2026 |
| 6 | Catch up a missed dose? | no – the next cycle decides via the reading | concept v2 3 |
| 7 | Float switch above the pump inlet? | build rule: yes, otherwise the pump runs dry | [05 · Wiring and hardware build](05-verkabelung-und-aufbau.md) |
| 8 | Plant, substrate, pot – target band? | example band by hand (13 Sep 2026), calibration run as a tool | 47, 48, 56 |
| 9 | Minimum pause? | 24 h; 12 h in heat above 35 °C; 48 h with slow decrease | interview, 12 Sep 2026 |
| 10 | Watering time windows? | yes: 08:00 and 20:00 in `cfg3.winA`/`winB`; the installer builds the schedule from them, `bw_main` refreshes the job before them | requirement of 12 Sep 2026; 11 |
| 11 | Pump, current draw, relay? | relay present, Gardena 970548801; the output carries no pump load | concept v2 5.1 |
| 12 | Reporting faults? | on the device only: `err` in the KVS and console; no webhook, no MQTT, output 1 stays free | interview, 12 Sep 2026 |
| 13 | Stage 2: accept gaps or a collector on the LAN? | open | stage 2 |
| 14 | Permanent Wi-Fi with internet? | mostly, with outages → schedule only, no emergency mode; after a power failure without internet the system pauses | interview, 12 Sep 2026 |
| 15 | Voltage of the dry sensor in air? | 0.20 V (12 Sep 2026); measured 0.296 V (13 Sep 2026) | `bw_hwtest` |
| 16 | Flow rate and maximum duration of a dose? | below 20 s no water, smallest dose 40 s, 60–80 s proven, 120 s maximum (12 Sep 2026); today `tMin` 25, `tStd` 70, `tPmax` 120, `tMax` 180 per window. Flow per second `[TODO am Gerät]` (to do on the device) | interview; 40, 41 |
| 17 | Cycle 15, 10 or 30 minutes? | 10 min in the interview, 15 min with the split into three scripts; today `cfg3.tick` | 29 |

## Edge cases and decisions

Before stage 10, 33 edge cases were collected from three viewpoints and cross-checked against the code: 30 confirmed, 3 rejected. Every confirmed case received a decision.

| Edge case | Weight | Decision |
| --- | --- | --- |
| window duration limited only via portions – collision with the `bw_main` cycle and the safety-off | high | 44, 54 |
| crash, stop or power failure in the middle of the window; state written only at the end | high | 42 |
| stability "three values within 1 %" is satisfied on a ramp – no trend, no timeout value | high | 45 |
| `noeff` threshold does not fit portions | high | 46 |
| two different learned values (window vs. drained 30-min value), write authority over `lrn` | high | 39, 43 |
| dead time of the follow-up portion unknown; `tMin` 40 is not a portion size | high | 40, 56 |
| `cfg3` exceeds 253 characters with new fields (and `zrb1` with it) | high | 53 |
| fast-forward timetable with bucket and control loop exclude each other | high | 55 |
| fast-forward budget ends inside the `bw_main` cycle | high | 44, 55 |
| `pctOk` missing on the device, `pctHi` stays 65, no order check of the band | high | 47, 48 |
| safety-off in the seconds field of the same minute | medium | 54 |
| `tMax` doubly used (portion vs. sum) | medium | 41 |
| abort matrix: EMPTY in or between portions, external, sensor, exception | medium | 42, result matrix in `pump.test.js` |
| `bw_pump` does not measure itself; `job.pct` is up to 20 min old | medium | 49 |
| hardware test and manual job without `pct` need a single portion | medium | 50 |
| very dry soil does not reach the band | medium | `max`, catch-up pause (38) |
| does `day.n` count portions or windows? | medium | 51 (windows; `day.sec` all seconds) |
| one timer, one open RPC, phase automaton | medium | tick automaton (stage 10) |
| code size (`bw_main` 700 B headroom) and heap (`GetMany "*"`) | medium | 38, 53 |
| mock acts instantly and cuts off at 5 min | medium | pot model, `simulate(maxMs)` |
| time arithmetic of the fast-forward | medium | 55 |
| learned value too large → `tmin` → no job | medium | 38 (clamp) |
| pause, `soak` and `rate` from window start instead of window end | medium | 52 (`dur`) |
| `sf` only ever drops | medium | 43 (`sfUp`) |
| backward compatibility and upload order | medium | 48 |
| new codes and console | medium | 52 |
| tests with fixed numbers and write budget | low | scenario, measured |
| tools assume windows ≤ `tMax + 10` | low | 54 (`expectedSpecs()`) |
| one sensor controls several drippers blindly | low | [04 · Safety and limits](04-sicherheit-und-grenzen.md) |
| flash space | low | 59 |
| added by the user: watered or fertilised by hand | – | 49 |

Twelve further gaps remained as notes; the measurement run checked the first three: no voltage dip at the voltmeter while the pump runs, fresh values at 2-s polling, run-off water from the hose dominates short pulses.

Still open: switching cycles and minimum pauses of relay and pump according to the manufacturer, a DS18B20 temperature jump as second proof of a portion, the runtime of the mock tests at 500-ms ticks, RPC latency in the long window (watch on the device with `hwtest.js watch`). A new calibration shifts the band and invalidates `effW` – delete it or repeat `kal write`.

The order job → claim → result on the timeline is secured by `zeitraffer.test.js` and `szenario.test.js`: normally 07:45 → 08:00:30 → 08:07:30 at the latest, the cycle at 08:15 finds the result; in fast-forward T−3 → T:30 → T+2:30 at the latest, before the cycle at T+3.

## Research and sources

A research agent evaluated the literature on sensor-guided pulse irrigation before stage 10.

Adopted: small dose → re-measure → next one if needed is the state of research; first portion deliberately below the target (factor ≈ 0.7 on the deficit, adjusted run-to-run) → `sf` 0.7; compute follow-up portions with the effect measured in the window; stability = span **and** no further rise; learn only with Δ ≥ 2 % and effective seconds, clamp the innovation, `alpha` 0.2 to 0.3; the 30-min value (drainage) must never enter `effW`; a sensor under the dripper measures the wettest point; the dead time is larger in the morning (empty hose) and can be read from `tRise`.

- Nemali & van Iersel 2006, *An automated system for controlling drought stress and irrigation in potted plants*, Scientia Horticulturae 110: https://doi.org/10.1016/j.scienta.2006.07.009
- HortTechnology 2018 (ASHS), sensor-guided irrigation in container culture: https://journals.ashs.org/horttech/
- PLOS One 2018 (PMC5988304), *A cost-effective and customizable automated irrigation system …*: https://pmc.ncbi.nlm.nih.gov/articles/PMC5988304/
- Frontiers 2022 and 2024, soil-moisture feedback and sensor placement: https://www.frontiersin.org/
- Agronomy 2021, 11(7) 1355: https://www.mdpi.com/2073-4395/11/7/1355 and 11(5) 907: https://www.mdpi.com/2073-4395/11/5/907
- Sensors 2020 (PMC7570759), variability of capacitance soil-moisture sensors under drip irrigation: https://pmc.ncbi.nlm.nih.gov/articles/PMC7570759/
- MathWorks, *Control of Processes with Long Dead Time: The Smith Predictor* (alternative, decision 63): https://www.mathworks.com/help/control/ug/control-of-processes-with-long-dead-time-the-smith-predictor.html
- IEEE, EWMA run-to-run control (learning between runs with clamped innovation → `alpha`, `effMin`/`effMax`): https://ieeexplore.ieee.org/
- US patent 8 219 254 B2, *Adaptive control for irrigation system*: https://patents.google.com/patent/US8219254B2/en
- UF/IFAS AE437, Soil-moisture-sensor-based irrigation controllers: https://ask.ifas.ufl.edu/publication/AE437
- EPA WaterSense, soil-moisture-based irrigation controllers: https://www.epa.gov/watersense
- aguafox, manufacturer documentation on drip irrigation (dripper flow, run-off, switching cycles) – link only in the agent report
- Trübner SMT50, manual (response time, measuring volume, output voltage): https://www.truebner.de/assets/download/Anleitung_SMT50.pdf
- Shelly Plus Uni, knowledge base: https://kb.shelly.cloud/knowledge-base/shelly-plus-uni
- Shelly Gen2: schedule https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule/ · script https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script/ · KVS https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS/

The conclusion of the calibration agent: the fast-forward is suitable for dose calibration (effect per second, `tRise`, settling time), not for drying and pauses – those remain a matter of real operation.

## Next stages and ideas

| Idea | Status | Origin |
| --- | --- | --- |
| stage 2: history to a VPS backend – control stays on the device, the backend records and displays; the cycle sends readings and events as JSON, each with a running number and device uptime so the order is right even with a wrong clock. Buffering on the device is not possible | open; question 13 (accept gaps on network failure or a collector on the LAN) unanswered | project analysis 8, concept v2 8 |
| learning classes `effD`/`effN` by initial moisture | only once the calibration run shows more than 50 % difference; the `kal` report provides the data basis | 57 |
| active fault reporting: second output as fault indicator, webhook, Shelly cloud or backend | open; today only `err` in the KVS and console | question 12 |
| soil temperature with a second DS18B20 (up to five probes on the one-wire bus) | open | question 2 |
| frost lock for outdoor sites | open | question 3 |
| shift the lower limit slightly with the temperature mean (stand drier in winter) | not built; `lrn.tMean` is maintained | project analysis 4.2 |
| log memory use per cycle so that a leak becomes visible | `err.mem` at the day change; peaks with `hwtest.js watch` | concept v2 0.6 |
| measure the dead time on the final setup (`hwtest.js mess`), adjust `tDead`/`tMin` | open `[TODO am Gerät]` | stage 10 |

The build stages A to E from concept v2 and architecture v1 (schedule and measuring, safeguards, control with fixed values, learning and waterlogging protection, stage 2) became stages 0 to 10 of the plan; stage 2 is the only one still outstanding ([17 · Stage and decision log](17-etappen-und-entscheidungslog.md)).

## Origin of this chapter

| Old file | Date | What it contained | Where it went |
| --- | --- | --- | --- |
| `docs/projektanalyse-v1.md` | before 12 Sep 2026 | review of the project description: findings 1.1 to 5.4, control principle, 13 open questions | control core, safety, questions answered |
| `docs/konzept-v2.md` | 12 Sep 2026, addendum 13 Sep 2026 | one-shot runner, schedule entries, state machine, calibration, triple shut-off, data storage, stage 2, questions 14–17, addendum on the control loop | design principles, control core, safety, next stages |
| `docs/architektur-v1.md` | 12 Sep 2026 | tool stack, overview "engine, head, memory", interview decisions, dead time, pauses, residual risk, stages A–E | starting point (tool stack), design principles, learned value, pauses, rejected alternatives |
| `docs/umsetzungsplan-v1.md` | 12 Sep 2026 | three scripts, `job` as interface, installer steps, KVS contract, pause rule in two-window operation, stages A–F | three scripts, pauses; defaults in [03 · Configuration](03-konfiguration.md), stages in [17 · Stage and decision log](17-etappen-und-entscheidungslog.md) |
| `docs/umsetzungsplan-v2.md` | 12 Sep 2026 | configuration in the KVS, catalogue `cfg1..3`, `pctSoll` as the dose number | no configuration in code; catalogue in 03 |
| `docs/onboarding-prompt.md` | 12 Sep 2026 | working basis for development with Claude Code | starting point, verbatim appendix |
| `docs/PLAN.md` (deviations, research, edge cases) | 12/13 Sep 2026 | deviations from the prompt, sources, 30 edge cases, gaps | no configuration in code, research, edge cases; stages and decisions 1–63 in 17 |

The finding "rule sources contradict each other" (concept v2 "feedback one day" against architecture v1 "there are no portions below 40 s") is thereby settled: the only rule source is this chapter, `tPmin` 10 applies to correction portions, `tMin` 25 to the first portion.

## Example output

This is what the principles look like on the device – window 1 of the calibration run on 13 Sep 2026, 15:54:30 (fast-forward, deadline <!-- zr:cfg4.tWin -->120<!-- /zr --> s). First portion from the job, fresh reading `m0`, correction portion from the measured effect `g`, target `pctOk` 50 reached, learned value `effW` at the window end, runtime below the deadline; at the first cycle at least `soak` (30 min, 15 s in fast-forward) after the window end – here 15:57 – the check in `bw_main`, which does not learn:

```text
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] m0 10.4 % → P1 12 s
[bw_pump 0.2.0] P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)
[bw_pump 0.2.0] P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
[bw_main 0.2.0] Kontrolle: 50.5 → 53.7 % sf=0.7
```

The German console words: `Fenster: Auftrag 12 s` (window: job 12 s), `Frist` (deadline), `stabil`/`unstabil` (stable/unstable), `ergebnis=` (result), `dauer` (duration in ms), `Kontrolle` (check). `unstab` means the second portion was still rising at the timeout – the window ends without a further portion, but the learned value is still produced (45). `effW` 2.006 is the profile scale of the fast-forward (`tDead` 2 s); on the scale "% per second after `tRise`" the report gave 4.46, and `kal write` wrote that value together with `tDead2` 5, `tDead` 8 and `tMin` 10.

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| an extension waters more "to be safe" after a missing effect | thinking error against the core rule: no effect means a suspected fault | the probe portion is the only exception; then `noeff` and a human |
| a new time constant as `var` in the script | violates "no configuration in code"; a change needs an upload instead of a manual entry | create the field in the installer's `DEF`, the script reads it, update chapter 03 |
| a script with an endless loop or a timer that runs "forever" | the design assumes one-shot runners; long-running scripts crash after hours and block the heap | put the work into the cycle, `Script.Stop` at the end; long runners only by hand and with memory release |
| "caching" state in a module variable | it is gone when the script ends; the next cycle does not know it | field in `st`, `lrn` or `day`; write only on change |
| learned value computed from the value 30 minutes after the window | drained soil, wrong reference (39) | only the stabilised window reading; the 30-min value is a check |
| 100 % entered as a target | 100 % is the calibration point "sensor in water" | target band well below; respect the band order, otherwise `why=cfg` |
| a window close to the cycle, `tWin` enlarged | deadline violated; the installer aborts with `err cfg` | keep `(window minute mod tick)·60 + 30 + tWin + tTail ≤ tick·60` |
| two large scripts started at the same time | shared heap ~25 KB → `out_of_memory` | never two large scripts at once; test scripts one at a time |
| an old concept document read as the rule | the six files partly contradict each other (e.g. learning after 30 min, safety-off at minute 5) | this chapter and [17 · Stage and decision log](17-etappen-und-entscheidungslog.md) are the rule sources |

## Next

- [17 · Stage and decision log](17-etappen-und-entscheidungslog.md) – every decision 1–63 with date and reasoning, stages 0 to 10, open items.
- [18 · Lessons from the device](18-lernlog-geraet.md) – every device finding with symptom, cause, fix and the rule in the tests.
- [03 · Configuration](03-konfiguration.md) – all the fields that grew out of the principles here.
