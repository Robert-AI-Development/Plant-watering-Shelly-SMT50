# Verdrahtung (v0.1.0)

Aderfarben des Shelly Plus Uni laut Shelly-Wissensdatenbank (https://kb.shelly.cloud/knowledge-base/shelly-plus-uni). Die Aderfarben des SMT50 sind mit `[TODO laut Datenblatt prüfen]` markiert: gelb = Feuchte und grün = Bodentemperatur stammen aus `docs/projektanalyse-v1.md`, Versorgung und Masse bitte vor dem Anschluss im Datenblatt (https://www.truebner.de/assets/download/Anleitung_SMT50.pdf) nachsehen.

```
                         12 V DC Netzteil
                         +12 V ───────┬──────────────────────────────┬──────────────┐
                         GND  ────┬───┼──────────────────────────────┼─────┐        │
                                  │   │                              │     │        │
   SHELLY PLUS UNI                │   │                              │     │        │
   ┌───────────────────────────┐  │   │                              │     │        │
   │ VAC1 (rot)      ◄─────────┼──┼───┘  Versorgung +                │     │        │
   │ VAC2 (schwarz)  ◄─────────┼──┘      Versorgung −                │     │        │
   │                           │                                     │     │        │
   │ ANALOG IN (weiß) ◄────────┼───── SMT50 gelb  (Feuchte 0–3 V)    │     │        │
   │ GND (grün)      ◄─────────┼──┬── SMT50 Masse [TODO Datenblatt]  │     │        │
   │                           │  │   SMT50 Versorgung + ────────────┘     │        │
   │                           │  │   [TODO Datenblatt]                    │        │
   │                           │  │   SMT50 grün (Bodentemp.) ── frei      │        │
   │                           │  │                                        │        │
   │ SENSOR VCC (gelb) ────────┼──┼── DS18B20 VDD (rot)                    │        │
   │ DATA (blau)     ◄─────────┼──┼── DS18B20 DATA (gelb/weiß)             │        │
   │ GND (grün)      ◄─────────┼──┴── DS18B20 GND (schwarz)                │        │
   │                           │                                           │        │
   │ IN2 (braun)     ◄─────────┼───── Schwimmerschalter ──── GND (grün)    │        │
   │        = input:1          │      (Öffner oder Schließer, siehe unten) │        │
   │                           │                                           │        │
   │ OUT1 (schwarz)  ──────────┼───── Relaisspule + ◄──────────────────────┘        │
   │ OUT1 (schwarz)  ──────────┼───── Relaisspule − ◄─────────────────────── GND ───┘
   │        = switch:0         │      (potenzialfreier Kontakt, max. 30 V / 300 mA)
   └───────────────────────────┘
                                      Relaiskontakt ──► Pumpe (Gardena 970548801)
                                      [TODO am Gerät: schaltet das Relais die 230-V-Seite des
                                       Gardena-Trafos oder die Kleinspannungsseite zur Pumpe?]
```

## Schritt für Schritt

1. **Alles stromlos.** Netzteil erst ganz am Ende einstecken.
2. **Versorgung:** Netzteil +12 V an VAC1 (rot), Netzteil − an VAC2 (schwarz). Die grüne GND-Ader ist die Sensormasse; sie wird mit dem Minus des Netzteils verbunden.
3. **SMT50:** gelbe Ader an ANALOG IN (weiß). Masse des Sensors an GND (grün), Versorgung des Sensors an +12 V. Die grüne Ader (Bodentemperatur) bleibt isoliert frei. `[TODO laut Datenblatt prüfen]`, welche Adern Versorgung und Masse sind.
4. **DS18B20:** rot an SENSOR VCC (gelb), Datenader an DATA (blau), schwarz an GND (grün). Laut Shelly-Wissensdatenbank sind bis zu fünf Fühler direkt anschließbar; ein externer Pull-up-Widerstand ist dort nicht genannt. `[TODO am Gerät]`: Wird der Fühler beim 1-Wire-Scan nicht gefunden, 4,7 kΩ zwischen DATA und SENSOR VCC einsetzen.
5. **Schwimmerschalter:** zwischen IN2 (braun) und GND (grün). IN2 ist in der API `input:1`. In der Web-UI den Eingang auf Typ „Switch" stellen.
6. **Relais:** Spule über den potenzialfreien Kontakt OUT1 (beide schwarzen OUT1-Adern) in Reihe mit +12 V und GND. Der Shelly-Ausgang trägt nur den Spulenstrom (< 300 mA), nie die Pumpe.
7. **Pumpe:** an den Relaiskontakt. Wird die 230-V-Seite des Gardena-Trafos geschaltet, gehört diese Arbeit in die Hände einer Elektrofachkraft. Die Gardena-eigene Zeitschaltung bleibt dauerhaft ausgeschaltet oder wird überbrückt, damit nur das Relais entscheidet.
8. **Prüfen vor dem Einschalten:** keine blanken Adern, Sensormasse und Netzteilminus verbunden, Relaisspule richtig gepolt (bei Relais mit Freilaufdiode), Shelly und Relais trocken und im Gehäuse.
9. **Einschalten** und in der Web-UI prüfen: `voltmeter:100` zeigt eine Spannung, `temperature:100` eine Temperatur, `input:1` wechselt beim Bewegen des Schwimmers.

## Schwimmerschalter: bedeutet 1 „leer"?

Je nach Schwimmertyp (Öffner/Schließer) und Einbaulage liefert der Eingang bei leerem Behälter 1 oder 0. Prüfung am Gerät: Behälter leer → Input-Status in der Web-UI ablesen → diesen Wert in `cfg1.lvlEmpty` eintragen (Startwert 1). Der Schwimmer sitzt **oberhalb** des Pumpeneinlaufs, damit die Pumpe bei „leer" noch im Wasser steht und nicht trocken läuft.

Foto: `[TODO am Gerät]`
