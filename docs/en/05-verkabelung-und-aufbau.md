# 05 · Wiring and hardware build

[Deutsch](../de/05-verkabelung-und-aufbau.md) · **English** — [Handbook](README.md) · Part B "Build"

> **At a glance**
> - Outcome: PSU, SMT50, DS18B20, float switch and relay are connected to the Shelly Plus Uni; the web UI shows a voltage, a temperature and an input that toggles when you move the float.
> - Scope: 9 parts, 9 steps, everything wired with the power off – the PSU is plugged in last.
> - Key number: OUT1 carries at most 30 V / 300 mA and switches only the relay coil, never the pump. The float switch reports "empty" with the default `cfg1.lvlEmpty` = <!-- def:cfg1.lvlEmpty -->1<!-- /def --> (confirmed on 13 Sep 2026).
> - Biggest pitfall: the green GND wire is the sensor ground and must be connected to the minus of the PSU.

## Prerequisites

- All parts from the parts list below. Tools: wire stripper, crimping tool with ferrules, Wago terminals, screwdriver, multimeter, a soldering iron if needed.
- The Shelly Plus Uni is on the Wi-Fi and its web UI is reachable at `http://<ip>` (set up as described by Shelly).
- For anything at 230 V (Gardena transformer, relay contact): a qualified electrician. You wire the low-voltage side (12 V) yourself.
- Read: [04 · Safety and limits](04-sicherheit-und-grenzen.md) – why the pump never runs away and what the Shelly output can take.

## Diagram

[![Shelly Plus Uni terminal plan: PSU, SMT50, DS18B20, float switch, relay and pump with wire colours](../diagramme/en/05-verkabelung-und-aufbau.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/05-verkabelung-und-aufbau.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/05-verkabelung-und-aufbau.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Power supply", 2 "Sensors", 3 "Switching the pump (230 V)", 4 "Component IDs".

## Parts list

Sources are examples; any electronics or garden retailer carrying the listed items is equivalent. Prices change, so none are given. The relay and the Gardena kit were already on hand in the reference build.

| No. | Part | Qty | Purpose | Source (example) | Note |
| --- | --- | --- | --- | --- | --- |
| 1 | Shelly Plus Uni | 1 | controller: measures, computes, switches | shelly.com, electronics retailer | Gen2 device, firmware 1.x or later with scripting; reference device runs firmware 2.0.0 |
| 2 | Truebner SMT50 soil moisture sensor | 1 | soil moisture as a 0–3 V voltage; soil temperature (unused) | truebner.de, electronics retailer | supply 3.3–30 V DC per [datasheet](https://www.truebner.de/assets/download/Anleitung_SMT50.pdf); yellow wire = moisture |
| 3 | DS18B20 temperature probe, waterproof with cable | 1 | ambient temperature on the 1-Wire bus | electronics retailer (Reichelt, Conrad, Amazon) | up to five probes on the bus per the Shelly knowledge base |
| 4 | Float switch (reed, NC or NO) | 1 | water level in the reservoir | electronics retailer, aquarium supplies | whether 1 means "empty" is measured by the hardware check, which writes `cfg1.lvlEmpty` |
| 5 | Relay 12 V DC, coil current < 300 mA, contact rated for the pump load | 1 (on hand) | isolates OUT1 (max 30 V / 300 mA) from the pump | electronics retailer | choose the contact for the pump voltage (230 V AC or low voltage) |
| 6 | Gardena holiday watering kit, art. 970548801 | 1 (on hand) | pump with transformer and distributor | Gardena, DIY store | runs only via the relay; the Gardena timer stays off |
| 7 | PSU 12 V DC, at least 1 A | 1 | powers Shelly, SMT50 and relay coil | electronics retailer | 12 V suits all three (manufacturer data: Shelly 9–28 V DC, SMT50 3.3–30 V DC) |
| 8 | Reservoir with lid | 1 | water supply | DIY store | float above the pump inlet; per day at most `maxDay` × `tMax` pump seconds (defaults <!-- def:cfg3.maxDay -->2<!-- /def --> × <!-- def:cfg3.tMax -->180<!-- /def --> s) – size the reservoir for the planned absence accordingly |
| 9 | Tubing, drippers, cable, ferrules, Wago terminals, IP54 enclosure | as needed | distribution, wiring, protection | DIY store, electronics retailer | never leave Shelly, relay and PSU unprotected next to water |

Photo of the build: `[TODO am Gerät]` (to do on the device).

## The parts explained

| Part | Job | Shelly terminal | In the software |
| --- | --- | --- | --- |
| Shelly Plus Uni | measures, computes, switches; runs the six scripts | analog input, 1-Wire, digital input, dry-contact output | components `voltmeter:100`, `temperature:100`, `input:1`, `switch:0`; the IDs live in `cfg1` (`idV`, `idT`, `idLvl`, `idSw`) |
| Truebner SMT50 | soil moisture as a 0–3 V voltage. The percent scale is our own calibration: dry in air = 0 %, in water = 100 % | ANALOG IN | `cfg1.vDry` <!-- def:cfg1.vDry -->0.20<!-- /def --> V and `cfg1.vWet` <!-- def:cfg1.vWet -->3.13<!-- /def --> V as defaults; the hardware check writes the measured points (13 Sep 2026: 0.296 V and 3.134 V) |
| DS18B20 | ambient temperature: shortens the pause in heat (`cfg3.tHot`) and feeds the season indicator | SENSOR VCC, DATA, GND | `temperature:100`; without the probe `err=temp` is set (fault: no temperature reading), watering continues anyway |
| Float switch | reports whether the reservoir is empty; protects the pump from running dry | IN2 to GND | `input:1` with `cfg1.lvlEmpty`; empty → `why=wasser` (reason: no water), no watering |
| Relay and pump | OUT1 switches only the relay coil, the relay contact switches the pump | OUT1 (both wires) | `switch:0`; every portion with `toggle_after`, plus `auto_off` = `tMax` + 10 s as a second safety net |

## Terminal plan

Shelly Plus Uni wire colours per the [Shelly knowledge base](https://kb.shelly.cloud/knowledge-base/shelly-plus-uni); compare with the leaflet of your own device before connecting.

For the SMT50, the [datasheet](https://www.truebner.de/assets/download/Anleitung_SMT50.pdf), section 2 "Technische Daten und Anschlussbelegung" (technical data and pin assignment), gives: brown = +Vcc, white = ground, yellow = moisture 0–3 V, green = soil temperature 0–3 V – compare with your own cable before connecting. (The PDF header says "RS485 Version"; the table with the 0–3 V outputs describes the analog sensor.)

| Terminal (Shelly wire) | Other end | Component | Remark |
| --- | --- | --- | --- |
| VAC1 (red) | PSU +12 V | – | supply + |
| VAC2 (black) | PSU − | – | supply − |
| GND (green) | PSU −, SMT50 white (ground), DS18B20 black, float switch, relay coil | – | sensor ground; also connect it to the PSU minus |
| ANALOG IN (white) | SMT50 yellow (moisture 0–3 V) | `voltmeter:100` (`cfg1.idV` <!-- def:cfg1.idV -->100<!-- /def -->) | add in the web UI as a voltmeter with range 0–15 V |
| SENSOR VCC (yellow) | DS18B20 VDD (red) | `temperature:100` | probe supply |
| DATA (blue) | DS18B20 DATA (yellow or white) | `temperature:100` (`cfg1.idT` <!-- def:cfg1.idT -->100<!-- /def -->) | 1-Wire bus, add the probe via scan |
| IN2 (brown) | float switch, other side to GND | `input:1` (`cfg1.idLvl` <!-- def:cfg1.idLvl -->1<!-- /def -->) | type "Switch" in the web UI |
| OUT1 (black, both wires) | in series: +12 V → OUT1 → OUT1 → relay coil → GND | `switch:0` (`cfg1.idSw` <!-- def:cfg1.idSw -->0<!-- /def -->) | dry contact, max 30 V / 300 mA |
| – | SMT50 brown (+Vcc) | – | to +12 V of the PSU |
| – | SMT50 green (soil temperature) | – | stays insulated and unused; the Shelly has only one analog input |

<details markdown="1">
<summary>Wiring plan as text graphic (all wires at a glance)</summary>

```text
                         12 V DC Netzteil (PSU)
                         +12 V ───────┬──────────────────────────────┬──────────────┐
                         GND  ────┬───┼──────────────────────────────┼─────┐        │
                                  │   │                              │     │        │
   SHELLY PLUS UNI                │   │                              │     │        │
   ┌───────────────────────────┐  │   │                              │     │        │
   │ VAC1 (rot/red)  ◄─────────┼──┼───┘  supply +                    │     │        │
   │ VAC2 (schwarz/black) ◄────┼──┘      supply −                    │     │        │
   │                           │                                     │     │        │
   │ ANALOG IN (weiß/white) ◄──┼───── SMT50 yellow (moisture 0–3 V)  │     │        │
   │ GND (grün/green) ◄────────┼──┬── SMT50 white (ground)           │     │        │
   │                           │  │   SMT50 brown (+Vcc) ────────────┘     │        │
   │                           │  │   SMT50 green (soil temp.) ── unused   │        │
   │                           │  │                                        │        │
   │ SENSOR VCC (gelb/yellow) ─┼──┼── DS18B20 VDD (red)                    │        │
   │ DATA (blau/blue) ◄────────┼──┼── DS18B20 DATA (yellow/white)          │        │
   │ GND (grün/green) ◄────────┼──┴── DS18B20 GND (black)                  │        │
   │                           │                                           │        │
   │ IN2 (braun/brown) ◄───────┼───── float switch ──────── GND (green)    │        │
   │        = input:1          │      (NC or NO, see below)                │        │
   │                           │                                           │        │
   │ OUT1 (schwarz/black) ─────┼───── relay coil + ◄───────────────────────┘        │
   │ OUT1 (schwarz/black) ─────┼───── relay coil − ◄──────────────────────── GND ───┘
   │        = switch:0         │      (dry contact, max 30 V / 300 mA)
   └───────────────────────────┘
                                      relay contact ──► pump (Gardena 970548801)
                                      [TODO on the device: does the relay switch the 230 V side of the
                                       Gardena transformer or the low-voltage side to the pump?]
```

</details>

## Step by step

1. **Everything powered off.** Plug in the PSU only at the very end.
2. **Supply:** PSU +12 V to VAC1 (red), PSU − to VAC2 (black). The green GND wire is the sensor ground; connect it to the PSU minus as well.
3. **SMT50:** brown to +12 V of the PSU, white to GND (green), yellow to ANALOG IN (white); green (soil temperature) stays insulated and unused – assignment per the datasheet, section 2.
4. **DS18B20:** red to SENSOR VCC (yellow), data wire to DATA (blue), black to GND (green). Per the Shelly knowledge base up to five probes connect directly; an external pull-up resistor is not mentioned there.
5. **Float switch:** between IN2 (brown) and GND (green). In the API, IN2 is `input:1`.
6. **Relay:** coil through the dry contact OUT1 (both black OUT1 wires) in series with +12 V and GND. The Shelly output carries only the coil current (< 300 mA), never the pump. Relay with a flyback diode: mind the polarity.
7. **Pump:** to the relay contact. If the 230 V side of the Gardena transformer is switched, this work belongs to a qualified electrician. The Gardena's own timer stays permanently off or is bypassed so that only the relay decides.
8. **Check before power-on:** no bare wires, sensor ground and PSU minus connected, relay coil polarity right, Shelly and relay dry and inside the enclosure.
9. **Power on** and check in the web UI – section "Test before the software".

> **Caution (water/mains):** keep Shelly, relay and PSU dry and enclosed, away from water. Route the tubing so a defect cannot cause water damage. Work on 230 V only by a qualified electrician.

## Float switch: does 1 mean "empty"?

Depending on the float type (NC or NO) and its mounting, the input reads 1 or 0 with an empty reservoir. The scripts compare the reading with `cfg1.lvlEmpty`: if it matches, the reservoir counts as empty – `bw_main` writes `why=wasser`, `bw_pump` does not water.

Check on the device: reservoir empty (or float held by hand in the EMPTY position) → read the input in the web UI → enter that value into `cfg1.lvlEmpty`. Easier: the [hardware check](11-hardware-check.md) watches both positions and writes the value itself.

> **Measured on the device (13 Sep 2026):** float EMPTY = 1, FULL = 0 – the default `lvlEmpty` 1 matches the reference build (8 input changes observed, `bw_hwtest`).

Mounting: the float sits **above** the pump inlet so that at "empty" the pump is still under water and does not run dry. `bw_pump` checks the water level before every portion and, while pumping, every `cfg3.tChk` = <!-- def:cfg3.tChk -->5<!-- /def --> s.

## Relay and pump

The outputs of the Shelly Plus Uni are solid-state outputs rated for at most 30 V and 300 mA. Small 12 V pumps draw several times that, and the Gardena pump is powered by its own transformer anyway. So OUT1 switches only the coil of a relay (12 V, coil current below 300 mA), and the relay contact switches the pump.

- **Choose the contact for the pump voltage:** either the 230 V side of the Gardena transformer (electrician only) or the low-voltage side between transformer and pump. Which side the reference build switches: `[TODO am Gerät]` (to check on the device).
- **Gardena timer off:** permanently switched off or bypassed so that the relay alone decides.
- **Switching cycles:** every portion is one relay cycle, up to `cfg4.nPort` = <!-- def:cfg4.nPort -->6<!-- /def --> per window. Look up the manufacturer limits of relay and pump in their datasheets.
- **Shut-off without a script:** `toggle_after` in every on command, `auto_off` after `tMax` + 10 s and the scheduled safety-off – details in [04 · Safety and limits](04-sicherheit-und-grenzen.md).

## Test before the software

1. Plug in the PSU, open the web UI (`http://<ip>`).
2. **Add peripherals** (web UI → Peripherals/Add-ons): add the analog input as a **voltmeter** with range 0–15 V (the useful signal is 0–3 V, one moisture percent is about 0.03 V – the smaller range gives finer resolution), add the DS18B20 via the **1-Wire scan**. The IDs appear as `voltmeter:100` and `temperature:100`; if they differ, they go into `cfg1.idV`/`cfg1.idT` later.
3. **Enable input 1** (IN2) and set it to type "Switch". A disabled input returns `state: null`; `bw_main` then reports `why=lvl` (water level not readable).
4. **Read:** the voltmeter shows a voltage (sensor dry in air about 0.3 V, in a glass of water about 3.1 V), the temperature component shows a temperature, the input toggles when you move the float. Only when all three are right, continue with [06 · Start guide](06-startanleitung.md).

Plausibility limits of the scripts: below `cfg1.vErrLo` = <!-- def:cfg1.vErrLo -->0.10<!-- /def --> V or above `cfg1.vErrHi` = <!-- def:cfg1.vErrHi -->3.35<!-- /def --> V the sensor counts as defective (`err=sensor`, no watering) – a torn cable would otherwise look like "dry".

The device RPCs return the same values in the browser or via `curl`; with Node ≥ 22, `tools/hwtest.js` enables the input from your computer as well:

```bash
curl -s "http://<ip>/rpc/Voltmeter.GetStatus?id=100"     # field voltage in V
curl -s "http://<ip>/rpc/Temperature.GetStatus?id=100"   # field tC in °C
curl -s "http://<ip>/rpc/Input.GetStatus?id=1"           # field state true/false; null = input disabled
node tools/hwtest.js <ip> input-on                        # input 1: enable true, type switch, then verification
```

## Example output

Readings of the reference build, taken by the hardware check on 13 Sep 2026 (`bw_hwtest`, firmware 2.0.0). The block is compiled from the `bw_hwtest` report, not a literal device output; the report lines themselves are shown in [11 · Hardware check](11-hardware-check.md). A console line of `bw_main` on 12 Sep 2026 showed `V=0.28` and `tC=24.4` with the default IDs 100.

```text
voltmeter:100     0.296 V   SMT50 wiped, dry in air              -> cfg1.vDry
                  3.134 V   SMT50 in a glass of water            -> cfg1.vWet
temperature:100   19.8 °C   DS18B20 in ice water
                  33.5 °C   DS18B20 in warm water
input:1           1 at EMPTY, 0 at FULL (8 changes observed)    -> cfg1.lvlEmpty = 1
```

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| DS18B20 does not show up in the 1-Wire scan; later `err=temp` | wires swapped (VDD, DATA, GND) or bus without pull-up | check the wires; if that does not help, fit 4.7 kΩ between DATA and SENSOR VCC `[TODO am Gerät]` (to verify on the device) |
| voltmeter shows 0 V or jumps around | sensor ground (GND green) not connected to the PSU minus, SMT50 without supply, broken cable | connect the ground, check +12 V at the sensor (brown); below `cfg1.vErrLo` (<!-- def:cfg1.vErrLo -->0.10<!-- /def --> V) `bw_main` reports `err=sensor` |
| voltmeter shows more than `cfg1.vErrHi` (<!-- def:cfg1.vErrHi -->3.35<!-- /def --> V) | wrong wire on the analog input (brown instead of yellow: supply instead of signal) | yellow wire to ANALOG IN, range 0–15 V; above `vErrHi` `bw_main` reports `err=sensor` |
| input shows no value (`state: null`), console later `why=lvl` | input 1 disabled or not of type "Switch" | web UI: enable input 1, type Switch – or `node tools/hwtest.js <ip> input-on` |
| reservoir full but `why=wasser` (or empty, and it waters) | float inverted: NC instead of NO, different mounting | set `cfg1.lvlEmpty` to the value the input shows at EMPTY; the hardware check writes it automatically |
| relay clicks, pump does not run | Gardena timer active, relay contact on the wrong side, coil reversed (flyback diode) | timer off or bypassed, check the contact; 230 V side only by a qualified electrician |
| pump runs dry although the input still reports "full" | float mounted too low | mount the float above the pump inlet |

## Next

- [06 · Step-by-step start guide](06-startanleitung.md) – upload the scripts, run the installer, first watering window.
- [11 · Hardware check (bw_hwtest, bw_hwpump)](11-hardware-check.md) – measures dry and wet point, float position and pump and writes `cfg1`.
- [04 · Safety and limits](04-sicherheit-und-grenzen.md) – triple pump shut-off, limits of Shelly and SMT50.
