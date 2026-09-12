# 2 · Hardware & Verdrahtung — Hardware & wiring

**Sprache / Language:** [Deutsch](#deutsch) · [English](#english) — [Handbuch-Index](README.md)

---

## Deutsch

### Schnellstart

> **Du brauchst:** Shelly Plus Uni · Truebner SMT50 (Bodenfeuchte) · DS18B20 (Temperatur) · Schwimmerschalter ·
> 12-V-Relais (Spule < 300 mA) · 12-V-Netzteil (≥ 1 A) · eine kleine Pumpe (z. B. aus einem
> **Gardena-Urlaubsbewässerungs-Set**) · Schlauch/Tropfer/Gehäuse.
> **Anschluss in einem Satz:** SMT50-Signal → Analog-In (`voltmeter:100`), DS18B20 → 1-Wire (`temperature:100`),
> Schwimmer → IN2 (`input:1`), Relaisspule → OUT1 (`switch:0`); Relaiskontakt schaltet die Pumpe.
> **Vollständige Tabellen und Fotos:** [`../../hardware/stueckliste.md`](../../hardware/stueckliste.md) und
> [`../../hardware/verdrahtung.md`](../../hardware/verdrahtung.md).

### Die Bauteile im Detail

Die komplette **Stückliste mit Bezugsquellen** steht in [`../../hardware/stueckliste.md`](../../hardware/stueckliste.md)
und als Übersicht in der [README](../../README.md#stückliste). Kurz erklärt:

- **Shelly Plus Uni** – das Steuergerät. Es hat einen Analogeingang (für den SMT50), einen 1-Wire-Anschluss
  (für den DS18B20), digitale Eingänge (für den Schwimmer) und einen potenzialfreien Ausgang (für das Relais).
- **Truebner SMT50** – misst die **Bodenfeuchte** als Spannung 0–3 V. Wir kalibrieren selbst: trocken in Luft = 0 %,
  im Wasser = 100 % (siehe [Kapitel 3](03-installation.md)).
- **DS18B20** – misst die **Umgebungstemperatur**. Damit passt das System die Wassermenge an Sommer/Winter an und
  aktiviert bei Hitze die kürzere Pause.
- **Schwimmerschalter** – meldet, ob im Vorratsbehälter noch **Wasser** ist. Verhindert Trockenlauf der Pumpe.
- **Relais + Pumpe** – der Shelly-Ausgang schaltet nur die Relaisspule (max. 30 V / 300 mA); der Relaiskontakt
  schaltet die eigentliche Pumpe.

### Verdrahtung

Der vollständige, bebilderte Plan mit Aderfarben steht in
[`../../hardware/verdrahtung.md`](../../hardware/verdrahtung.md). Die Kurzform (Details siehe
[README-Abschnitt „Verdrahtung"](../../README.md#verdrahtung)):

1. **Alles stromlos.** Versorgung: +12 V an VAC1, − an VAC2, Netzteil-Minus zusätzlich an GND (Sensormasse).
2. **SMT50:** Signal an ANALOG IN, Masse an GND, Versorgung an +12 V. (Welche Ader Versorgung/Masse ist, laut
   Datenblatt prüfen.)
3. **DS18B20:** rot an SENSOR VCC, Daten an DATA, schwarz an GND.
4. **Schwimmer** zwischen IN2 und GND; den Eingang in der Web-UI auf Typ „Switch" stellen. Schwimmer **oberhalb**
   des Pumpeneinlaufs montieren.
5. **Relaisspule** an OUT1 (potenzialfrei). Der Relaiskontakt schaltet die Pumpe.

> ⚠️ **Sicherheit:** Arbeiten an 230 V (Gardena-Trafo, Relaiskontakt) nur durch eine **Elektrofachkraft**. Shelly,
> Relais und Netzteil trocken und im Gehäuse, mit Abstand zum Wasser. Siehe README-Abschnitt „Sicherheit".

### Test vor der Software

Einschalten und in der Web-UI prüfen: Zeigt das **Voltmeter** eine Spannung? Kommt vom **DS18B20** eine
Temperatur? Wechselt der **Eingang**, wenn du den Schwimmer bewegst? Erst wenn alle drei stimmen, weiter zu
[Kapitel 3 · Installation](03-installation.md).

---

## English

### Quick start

> **You need:** Shelly Plus Uni · Truebner SMT50 (soil moisture) · DS18B20 (temperature) · float switch ·
> 12 V relay (coil < 300 mA) · 12 V PSU (≥ 1 A) · a small pump (e.g. from a **Gardena holiday-watering kit**) ·
> tubing/drippers/enclosure.
> **Wiring in one line:** SMT50 signal → analog in (`voltmeter:100`), DS18B20 → 1-Wire (`temperature:100`), float
> switch → IN2 (`input:1`), relay coil → OUT1 (`switch:0`); the relay contact switches the pump.
> **Full tables and photos:** [`../../hardware/stueckliste.md`](../../hardware/stueckliste.md) and
> [`../../hardware/verdrahtung.md`](../../hardware/verdrahtung.md).

### The parts in detail

The complete **bill of materials with sources** is in
[`../../hardware/stueckliste.md`](../../hardware/stueckliste.md) and summarised in the
[README](../../README.md#stückliste). In short:

- **Shelly Plus Uni** – the controller. It has an analog input (for the SMT50), a 1-Wire port (for the DS18B20),
  digital inputs (for the float switch) and a dry-contact output (for the relay).
- **Truebner SMT50** – measures **soil moisture** as a 0–3 V voltage. We calibrate it ourselves: dry in air = 0 %,
  in water = 100 % (see [chapter 3](03-installation.md)).
- **DS18B20** – measures **ambient temperature**, so the system adapts the amount of water to summer/winter and
  switches to a shorter pause in heat.
- **Float switch** – reports whether the reservoir still has **water**, preventing the pump from running dry.
- **Relay + pump** – the Shelly output only switches the relay coil (max 30 V / 300 mA); the relay contact
  switches the actual pump.

### Wiring

The complete, illustrated wiring plan with wire colours is in
[`../../hardware/verdrahtung.md`](../../hardware/verdrahtung.md). Short form (details in the
[README "Verdrahtung" section](../../README.md#verdrahtung)):

1. **Power off everything.** Supply: +12 V to VAC1, − to VAC2, PSU minus also to GND (sensor ground).
2. **SMT50:** signal to ANALOG IN, ground to GND, supply to +12 V. (Check the datasheet for which wire is
   supply/ground.)
3. **DS18B20:** red to SENSOR VCC, data to DATA, black to GND.
4. **Float switch** between IN2 and GND; set the input to type "Switch" in the web UI. Mount the float **above**
   the pump inlet.
5. **Relay coil** to OUT1 (dry contact). The relay contact switches the pump.

> ⚠️ **Safety:** work on 230 V (Gardena transformer, relay contact) only by a **qualified electrician**. Keep the
> Shelly, relay and PSU dry and enclosed, away from water. See the README "Sicherheit" section.

### Test before software

Power up and check in the web UI: does the **voltmeter** show a voltage? Does the **DS18B20** report a
temperature? Does the **input** toggle when you move the float switch? Only when all three are fine, continue to
[chapter 3 · Installation](03-installation.md).
