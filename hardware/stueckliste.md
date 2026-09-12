# Stückliste (v0.1.0)

Bezugsquellen sind Beispiele; jeder Elektronik- oder Gartenhändler mit den genannten Artikeln ist gleichwertig. Preise ändern sich, deshalb keine Angabe.

| Nr. | Teil | Menge | Zweck | Bezugsquelle (Beispiel) | Hinweis |
| --- | --- | --- | --- | --- | --- |
| 1 | Shelly Plus Uni | 1 | Steuergerät: misst, rechnet, schaltet | shelly.com, Elektronikhandel | Gen2-Gerät, Firmware ab 1.x mit Scripting; hier Firmware 2.0.0 |
| 2 | Trübner SMT50 Bodenfeuchtesensor | 1 | Bodenfeuchte (0–3 V) und Bodentemperatur (ungenutzt) | truebner.de, Elektronikhandel | Versorgung 3,3–30 V DC, Ausgang gelb = Feuchte |
| 3 | DS18B20 Temperaturfühler, wasserdicht mit Kabel | 1 | Umgebungstemperatur am 1-Wire-Bus | Elektronikhandel (Reichelt, Conrad, Amazon) | bis zu fünf Fühler am Bus möglich |
| 4 | Schwimmerschalter (Reed, Öffner oder Schließer) | 1 | Wasserstand im Vorratsbehälter | Elektronikhandel, Aquaristik | ob 1 = leer, wird am Gerät geprüft (cfg1.lvlEmpty) |
| 5 | Relais 12 V DC, Spulenstrom < 300 mA, Kontakt für die Pumpenlast | 1 (vorhanden) | trennt den Shelly-Ausgang (max. 30 V / 300 mA) von der Pumpe | Elektronikhandel | Kontakt nach Pumpenspannung wählen (230 V AC oder Kleinspannung) |
| 6 | Gardena Urlaubsbewässerung, Art. 970548801 | 1 (vorhanden) | Pumpe mit Trafo und Verteiler | Gardena, Baumarkt | Pumpe läuft in unserem Aufbau nur über das Relais, die Gardena-Zeitschaltung bleibt aus |
| 7 | Netzteil 12 V DC, mindestens 1 A | 1 | versorgt Shelly, SMT50 und Relaisspule | Elektronikhandel | Shelly nimmt 9–28 V DC; 12 V passt für alle drei |
| 8 | Vorratsbehälter mit Deckel | 1 | Wasservorrat | Baumarkt | Schwimmer oberhalb des Pumpeneinlaufs montieren (Trockenlaufschutz) |
| 9 | Schlauch, Tropfer, Kabel, Aderendhülsen, Wago-Klemmen, Gehäuse IP54 | nach Bedarf | Verteilung, Verdrahtung, Schutz | Baumarkt, Elektronikhandel | Shelly und Relais nie ungeschützt neben Wasser |

Foto des Aufbaus: `[TODO am Gerät]` – nach dem Aufbau in `hardware/` ablegen und hier verlinken.
