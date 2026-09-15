# 05 · Verkabelung und Hardware-Aufbau

**Deutsch** · [English](../en/05-verkabelung-und-aufbau.md) — [Handbuch](README.md) · Teil B „Aufbauen“

> **Auf einen Blick**
> - Ergebnis: Netzteil, SMT50, DS18B20, Schwimmerschalter und Relais hängen am Shelly Plus Uni; die Web-UI zeigt eine Spannung, eine Temperatur und einen Eingang, der beim Bewegen des Schwimmers wechselt.
> - Umfang: 9 Teile, 9 Schritte, alles stromlos verdrahtet – das Netzteil kommt zuletzt.
> - Wichtigste Zahl: OUT1 trägt höchstens 30 V / 300 mA und schaltet nur die Relaisspule, nie die Pumpe. Der Schwimmer meldet mit dem Startwert `cfg1.lvlEmpty` = <!-- def:cfg1.lvlEmpty -->1<!-- /def --> „leer“ (am 13.09.2026 bestätigt).
> - Größter Stolperstein: die grüne GND-Ader ist die Sensormasse und muss mit dem Minus des Netzteils verbunden sein.

## Voraussetzungen

- Alle Teile der Stückliste unten. Werkzeug: Abisolierzange, Crimpzange mit Aderendhülsen, Wago-Klemmen, Schraubendreher, Multimeter, bei Bedarf Lötkolben.
- Der Shelly Plus Uni ist im WLAN, seine Web-UI ist unter `http://<ip>` erreichbar (Einrichtung laut Shelly-Anleitung).
- Für alles an 230 V (Gardena-Trafo, Relaiskontakt): eine Elektrofachkraft. Die Kleinspannungsseite (12 V) verdrahtest du selbst.
- Gelesen: [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md) – warum die Pumpe nie durchläuft und was der Shelly-Ausgang verträgt.

## Diagramm

[![Klemmenplan Shelly Plus Uni: Netzteil, SMT50, DS18B20, Schwimmer, Relais und Pumpe mit Aderfarben](../diagramme/de/05-verkabelung-und-aufbau.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/05-verkabelung-und-aufbau.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/05-verkabelung-und-aufbau.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Versorgung“, 2 „Sensoren“, 3 „Pumpe schalten (230 V)“, 4 „Komponenten-IDs“.

## Stückliste

Bezugsquellen sind Beispiele; jeder Elektronik- oder Gartenhändler mit den genannten Artikeln ist gleichwertig. Preise ändern sich, deshalb keine Angabe. Relais und Gardena-Set waren im Referenzaufbau schon vorhanden.

| Nr. | Teil | Menge | Zweck | Bezugsquelle (Beispiel) | Hinweis |
| --- | --- | --- | --- | --- | --- |
| 1 | Shelly Plus Uni | 1 | Steuergerät: misst, rechnet, schaltet | shelly.com, Elektronikhandel | Gen2-Gerät, Firmware ab 1.x mit Scripting; Referenzgerät mit Firmware 2.0.0 |
| 2 | Trübner SMT50 Bodenfeuchtesensor | 1 | Bodenfeuchte als Spannung 0–3 V; Bodentemperatur (ungenutzt) | truebner.de, Elektronikhandel | Versorgung 3,3–30 V DC laut [Datenblatt](https://www.truebner.de/assets/download/Anleitung_SMT50.pdf); gelbe Ader = Feuchte |
| 3 | DS18B20 Temperaturfühler, wasserdicht mit Kabel | 1 | Umgebungstemperatur am 1-Wire-Bus | Elektronikhandel (Reichelt, Conrad, Amazon) | laut Shelly-Wissensdatenbank bis zu fünf Fühler am Bus |
| 4 | Schwimmerschalter (Reed, Öffner oder Schließer) | 1 | Wasserstand im Vorratsbehälter | Elektronikhandel, Aquaristik | ob 1 „leer“ bedeutet, misst der Hardware-Check und schreibt `cfg1.lvlEmpty` |
| 5 | Relais 12 V DC, Spulenstrom < 300 mA, Kontakt für die Pumpenlast | 1 (vorhanden) | trennt OUT1 (max. 30 V / 300 mA) von der Pumpe | Elektronikhandel | Kontakt nach Pumpenspannung wählen (230 V AC oder Kleinspannung) |
| 6 | Gardena Urlaubsbewässerung, Art. 970548801 | 1 (vorhanden) | Pumpe mit Trafo und Verteiler | Gardena, Baumarkt | läuft nur über das Relais; die Gardena-Zeitschaltung bleibt aus |
| 7 | Netzteil 12 V DC, mindestens 1 A | 1 | versorgt Shelly, SMT50 und Relaisspule | Elektronikhandel | 12 V passen für alle drei (Herstellerangaben: Shelly 9–28 V DC, SMT50 3,3–30 V DC) |
| 8 | Vorratsbehälter mit Deckel | 1 | Wasservorrat | Baumarkt | Schwimmer oberhalb des Pumpeneinlaufs; je Tag höchstens `maxDay` × `tMax` Pumpensekunden (Startwerte <!-- def:cfg3.maxDay -->2<!-- /def --> × <!-- def:cfg3.tMax -->180<!-- /def --> s) – den Vorrat für die geplante Abwesenheit entsprechend vervielfachen |
| 9 | Schlauch, Tropfer, Kabel, Aderendhülsen, Wago-Klemmen, Gehäuse IP54 | nach Bedarf | Verteilung, Verdrahtung, Schutz | Baumarkt, Elektronikhandel | Shelly, Relais und Netzteil nie ungeschützt neben Wasser |

Foto des Aufbaus: `[TODO am Gerät]`.

## Die Bauteile erklärt

| Bauteil | Aufgabe | Klemme am Shelly | In der Software |
| --- | --- | --- | --- |
| Shelly Plus Uni | misst, rechnet, schaltet; führt die sechs Scripts aus | Analogeingang, 1-Wire, digitaler Eingang, potenzialfreier Ausgang | Komponenten `voltmeter:100`, `temperature:100`, `input:1`, `switch:0`; die IDs stehen in `cfg1` (`idV`, `idT`, `idLvl`, `idSw`) |
| Trübner SMT50 | Bodenfeuchte als Spannung 0–3 V. Die Prozentskala ist eine eigene Kalibrierung: trocken in Luft = 0 %, im Wasser = 100 % | ANALOG IN | `cfg1.vDry` <!-- def:cfg1.vDry -->0.20<!-- /def --> V und `cfg1.vWet` <!-- def:cfg1.vWet -->3.13<!-- /def --> V als Startwerte; der Hardware-Check schreibt die gemessenen Punkte (13.09.2026: 0,296 V und 3,134 V) |
| DS18B20 | Umgebungstemperatur: verkürzt die Pause bei Hitze (`cfg3.tHot`) und liefert den Jahreszeit-Anzeiger | SENSOR VCC, DATA, GND | `temperature:100`; ohne Fühler steht `err=temp` (Störung: kein Temperaturwert), gegossen wird trotzdem |
| Schwimmerschalter | meldet, ob der Behälter leer ist; schützt die Pumpe vor Trockenlauf | IN2 gegen GND | `input:1` mit `cfg1.lvlEmpty`; leer → `why=wasser` (Grund: kein Wasser), keine Gabe |
| Relais und Pumpe | OUT1 schaltet nur die Relaisspule, der Relaiskontakt schaltet die Pumpe | OUT1 (beide Adern) | `switch:0`; jede Portion mit `toggle_after`, dazu `auto_off` = `tMax` + 10 s als zweites Netz |

## Klemmenplan

Aderfarben des Shelly Plus Uni laut [Shelly-Wissensdatenbank](https://kb.shelly.cloud/knowledge-base/shelly-plus-uni); vor dem Anschluss mit dem Beipackzettel des eigenen Geräts vergleichen.

Beim SMT50 gilt laut [Datenblatt](https://www.truebner.de/assets/download/Anleitung_SMT50.pdf), Abschnitt 2 „Technische Daten und Anschlussbelegung“: braun = +Vcc, weiß = Masse, gelb = Feuchte 0–3 V, grün = Bodentemperatur 0–3 V – vor dem Anschluss mit dem eigenen Kabel vergleichen. (Die Kopfzeile des PDF nennt „RS485 Version“; die Tabelle mit den 0–3-V-Ausgängen beschreibt den analogen Sensor.)

| Klemme (Ader Shelly) | Gegenstelle | Komponente | Bemerkung |
| --- | --- | --- | --- |
| VAC1 (rot) | Netzteil +12 V | – | Versorgung + |
| VAC2 (schwarz) | Netzteil − | – | Versorgung − |
| GND (grün) | Netzteil −, SMT50 weiß (Masse), DS18B20 schwarz, Schwimmer, Relaisspule | – | Sensormasse; zusätzlich mit dem Netzteil-Minus verbinden |
| ANALOG IN (weiß) | SMT50 gelb (Feuchte 0–3 V) | `voltmeter:100` (`cfg1.idV` <!-- def:cfg1.idV -->100<!-- /def -->) | in der Web-UI als Voltmeter mit Bereich 0–15 V anlegen |
| SENSOR VCC (gelb) | DS18B20 VDD (rot) | `temperature:100` | Versorgung des Fühlers |
| DATA (blau) | DS18B20 DATA (gelb oder weiß) | `temperature:100` (`cfg1.idT` <!-- def:cfg1.idT -->100<!-- /def -->) | 1-Wire-Bus, Fühler per Scan hinzufügen |
| IN2 (braun) | Schwimmerschalter, andere Seite an GND | `input:1` (`cfg1.idLvl` <!-- def:cfg1.idLvl -->1<!-- /def -->) | in der Web-UI Typ „Switch“ |
| OUT1 (schwarz, beide Adern) | in Reihe: +12 V → OUT1 → OUT1 → Relaisspule → GND | `switch:0` (`cfg1.idSw` <!-- def:cfg1.idSw -->0<!-- /def -->) | potenzialfrei, max. 30 V / 300 mA |
| – | SMT50 braun (+Vcc) | – | an +12 V des Netzteils |
| – | SMT50 grün (Bodentemperatur) | – | bleibt isoliert frei; der Shelly hat nur einen Analogeingang |

<details markdown="1">
<summary>Verdrahtungsplan als Textgrafik (alle Adern auf einen Blick)</summary>

```text
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
   │ GND (grün)      ◄─────────┼──┬── SMT50 weiß (Masse)             │     │        │
   │                           │  │   SMT50 braun (+Vcc) ────────────┘     │        │
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

</details>

## Schritt für Schritt

1. **Alles stromlos.** Netzteil erst ganz am Ende einstecken.
2. **Versorgung:** Netzteil +12 V an VAC1 (rot), Netzteil − an VAC2 (schwarz). Die grüne GND-Ader ist die Sensormasse; sie wird zusätzlich mit dem Minus des Netzteils verbunden.
3. **SMT50:** braun an +12 V des Netzteils, weiß an GND (grün), gelb an ANALOG IN (weiß); grün (Bodentemperatur) bleibt isoliert frei – Belegung laut Datenblatt, Abschnitt 2.
4. **DS18B20:** rot an SENSOR VCC (gelb), Datenader an DATA (blau), schwarz an GND (grün). Laut Shelly-Wissensdatenbank sind bis zu fünf Fühler direkt anschließbar; ein externer Pull-up-Widerstand ist dort nicht genannt.
5. **Schwimmerschalter:** zwischen IN2 (braun) und GND (grün). IN2 heißt in der API `input:1`.
6. **Relais:** Spule über den potenzialfreien Kontakt OUT1 (beide schwarzen OUT1-Adern) in Reihe mit +12 V und GND. Der Shelly-Ausgang trägt nur den Spulenstrom (< 300 mA), nie die Pumpe. Relais mit Freilaufdiode: auf die Polung achten.
7. **Pumpe:** an den Relaiskontakt. Wird die 230-V-Seite des Gardena-Trafos geschaltet, gehört diese Arbeit in die Hände einer Elektrofachkraft. Die Gardena-eigene Zeitschaltung bleibt dauerhaft aus oder wird überbrückt, damit nur das Relais entscheidet.
8. **Prüfen vor dem Einschalten:** keine blanken Adern, Sensormasse und Netzteil-Minus verbunden, Relaisspule richtig gepolt, Shelly und Relais trocken und im Gehäuse.
9. **Einschalten** und in der Web-UI prüfen – Abschnitt „Test vor der Software“.

> **Achtung (Wasser/Strom):** Shelly, Relais und Netzteil trocken und im Gehäuse, mit Abstand zum Wasser. Schläuche so führen, dass ein Defekt keinen Wasserschaden anrichtet. Arbeiten an 230 V nur durch eine Elektrofachkraft.

## Schwimmer: bedeutet 1 „leer“?

Je nach Schwimmertyp (Öffner oder Schließer) und Einbaulage liefert der Eingang bei leerem Behälter 1 oder 0. Die Scripts vergleichen den gelesenen Wert mit `cfg1.lvlEmpty`: stimmt er überein, gilt der Behälter als leer – `bw_main` schreibt `why=wasser`, `bw_pump` gießt nicht.

Prüfung am Gerät: Behälter leer (oder Schwimmer von Hand in Stellung LEER) → Eingang in der Web-UI ablesen → diesen Wert nach `cfg1.lvlEmpty` eintragen. Bequemer: der [Hardware-Check](11-hardware-check.md) beobachtet beide Stellungen und schreibt den Wert selbst.

> **Am Gerät gemessen (13.09.2026):** Schwimmer LEER = 1, VOLL = 0 – der Startwert `lvlEmpty` 1 passt zum Referenzaufbau (8 Eingangswechsel beobachtet, `bw_hwtest`).

Montage: der Schwimmer sitzt **oberhalb** des Pumpeneinlaufs, damit die Pumpe bei „leer“ noch im Wasser steht und nicht trocken läuft. `bw_pump` prüft den Wasserstand vor jeder Portion und während des Pumpens alle `cfg3.tChk` = <!-- def:cfg3.tChk -->5<!-- /def --> s.

## Relais und Pumpe

Die Ausgänge des Shelly Plus Uni sind Halbleiterausgänge mit höchstens 30 V und 300 mA. Kleine 12-V-Pumpen ziehen ein Mehrfaches davon, die Gardena-Pumpe hängt ohnehin an ihrem Trafo. Deshalb schaltet OUT1 nur die Spule eines Relais (12 V, Spulenstrom unter 300 mA), und der Relaiskontakt schaltet die Pumpe.

- **Kontakt nach Pumpenspannung wählen:** entweder die 230-V-Seite des Gardena-Trafos (nur Elektrofachkraft) oder die Kleinspannungsseite zwischen Trafo und Pumpe. Welche Seite der Referenzaufbau schaltet: `[TODO am Gerät]`.
- **Gardena-Zeitschaltung aus:** dauerhaft ausgeschaltet oder überbrückt, damit allein das Relais entscheidet.
- **Schaltspiele:** jede Portion ist ein Schaltspiel des Relais, bis zu `cfg4.nPort` = <!-- def:cfg4.nPort -->6<!-- /def --> je Fenster. Herstellergrenzen von Relais und Pumpe im Datenblatt nachsehen.
- **Abschaltung ohne Script:** `toggle_after` in jedem Einschaltbefehl, `auto_off` nach `tMax` + 10 s und der Sicherheits-Aus im Zeitplan – Details in [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md).

## Test vor der Software

1. Netzteil einstecken, Web-UI öffnen (`http://<ip>`).
2. **Peripherie anlegen** (Web-UI → Peripherals/Add-ons): den Analogeingang als **Voltmeter** mit Bereich 0–15 V anlegen (das Nutzsignal ist 0–3 V, ein Feuchteprozent rund 0,03 V – der kleinere Bereich misst feiner), den DS18B20 über den **1-Wire-Scan** hinzufügen. Die IDs erscheinen als `voltmeter:100` und `temperature:100`; weichen sie ab, kommen sie später nach `cfg1.idV`/`cfg1.idT`.
3. **Eingang 1** (IN2) aktivieren und auf Typ „Switch“ stellen. Ein deaktivierter Eingang liefert `state: null`; `bw_main` meldet dann `why=lvl` (Wasserstand nicht lesbar).
4. **Ablesen:** das Voltmeter zeigt eine Spannung (Sensor trocken in Luft rund 0,3 V, im Wasserglas rund 3,1 V), die Temperature-Komponente eine Temperatur, der Eingang wechselt beim Bewegen des Schwimmers. Erst wenn alle drei stimmen, weiter mit [06 · Startanleitung](06-startanleitung.md).

Plausibilitätsgrenzen der Scripts: unter `cfg1.vErrLo` = <!-- def:cfg1.vErrLo -->0.10<!-- /def --> V oder über `cfg1.vErrHi` = <!-- def:cfg1.vErrHi -->3.35<!-- /def --> V gilt der Sensor als defekt (`err=sensor`, keine Gabe) – ein abgerissenes Kabel sähe sonst wie „trocken“ aus.

Dieselben Werte liefern die RPCs des Geräts im Browser oder per `curl`; mit Node ≥ 22 aktiviert `tools/hwtest.js` den Eingang auch vom Rechner aus:

```bash
curl -s "http://<ip>/rpc/Voltmeter.GetStatus?id=100"     # Feld voltage in V
curl -s "http://<ip>/rpc/Temperature.GetStatus?id=100"   # Feld tC in °C
curl -s "http://<ip>/rpc/Input.GetStatus?id=1"           # Feld state true/false; null = Eingang deaktiviert
node tools/hwtest.js <ip> input-on                        # Input 1: enable true, Typ switch, danach Kontrolle
```

## Beispielausgabe

Messwerte des Referenzaufbaus, aufgenommen vom Hardware-Check am 13.09.2026 (`bw_hwtest`, Firmware 2.0.0). Der Block ist eine Zusammenstellung aus dem Bericht von `bw_hwtest`, keine wörtliche Geräteausgabe; die Berichtszeilen selbst zeigt [11 · Hardware-Check](11-hardware-check.md). Eine Konsolenzeile von `bw_main` zeigte am 12.09.2026 mit den Standard-IDs 100 `V=0.28` und `tC=24.4`.

```text
voltmeter:100     0.296 V   SMT50 abgewischt, trocken in Luft   -> cfg1.vDry
                  3.134 V   SMT50 im Wasserglas                 -> cfg1.vWet
temperature:100   19.8 °C   DS18B20 in Eiswasser
                  33.5 °C   DS18B20 in warmem Wasser
input:1           1 bei LEER, 0 bei VOLL (8 Wechsel beobachtet) -> cfg1.lvlEmpty = 1
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| DS18B20 erscheint beim 1-Wire-Scan nicht; später `err=temp` | Adern vertauscht (VDD, DATA, GND) oder Bus ohne Pull-up | Adern prüfen; hilft das nicht, 4,7 kΩ zwischen DATA und SENSOR VCC einsetzen `[TODO am Gerät]` |
| Voltmeter zeigt 0 V oder springt | Sensormasse (GND grün) nicht mit dem Netzteil-Minus verbunden, SMT50 ohne Versorgung, Kabelbruch | Masse verbinden, +12 V am Sensor (braun) prüfen; unter `cfg1.vErrLo` (<!-- def:cfg1.vErrLo -->0.10<!-- /def --> V) meldet `bw_main` `err=sensor` |
| Voltmeter zeigt über `cfg1.vErrHi` (<!-- def:cfg1.vErrHi -->3.35<!-- /def --> V) | falsche Ader am Analogeingang (braun statt gelb: Versorgung statt Signal) | gelbe Ader an ANALOG IN, Bereich 0–15 V; über `vErrHi` meldet `bw_main` `err=sensor` |
| Eingang zeigt keinen Wert (`state: null`), Konsole später `why=lvl` | Eingang 1 deaktiviert oder nicht vom Typ „Switch“ | Web-UI: Input 1 aktivieren, Typ Switch – oder `node tools/hwtest.js <ip> input-on` |
| Behälter voll, trotzdem `why=wasser` (oder leer, und es wird gegossen) | Schwimmer invertiert: Öffner statt Schließer, andere Einbaulage | `cfg1.lvlEmpty` auf den Wert setzen, den der Eingang bei LEER zeigt; der Hardware-Check schreibt ihn automatisch |
| Relais klickt, Pumpe läuft nicht | Gardena-Zeitschaltung aktiv, Relaiskontakt an der falschen Seite, Spule verpolt (Freilaufdiode) | Zeitschaltung aus oder überbrücken, Kontakt prüfen; 230-V-Seite nur durch eine Elektrofachkraft |
| Pumpe läuft trocken, obwohl der Eingang noch „voll“ meldet | Schwimmer zu tief montiert | Schwimmer oberhalb des Pumpeneinlaufs anbringen |

## Weiter zu

- [06 · Schritt-für-Schritt-Startanleitung](06-startanleitung.md) – Scripts hochladen, Installer starten, erstes Gießfenster.
- [11 · Hardware-Check (bw_hwtest, bw_hwpump)](11-hardware-check.md) – misst Trocken- und Nasspunkt, Schwimmerstellung und Pumpe und schreibt `cfg1`.
- [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md) – dreifache Abschaltung der Pumpe, Grenzen von Shelly und SMT50.
