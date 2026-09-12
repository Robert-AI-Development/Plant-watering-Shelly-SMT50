# Bewässerungs-System – Projektanalyse v1

Dieses Dokument prüft die Projektbeschreibung vor der Programmierung: Was steht fest, wo gibt es Konflikte oder Lücken, und welche Logik wird vorgeschlagen. Die Gliederung folgt dem Ablauf 1–5 aus der Projektbeschreibung.

**Alle Vorschläge in diesem Dokument sind Zuarbeit und noch nicht entschieden.** Sie sind als *Vorschlag* gekennzeichnet. Offene Punkte stehen gesammelt in Abschnitt 9.

* * *

## 0 Architektur

Entschieden: **Stufe 1 läuft vollständig am Shelly.** Messen, Entscheiden, Lernen und Schalten passieren im Gerät, damit der Offline-Betrieb ohne Server funktioniert. Die Historie geht in **Stufe 2** zusätzlich an das VPS-Backend (siehe Abschnitt 8).

Daraus folgen drei harte Rahmenbedingungen:

| Thema | Grenze am Gerät | Folge für die Logik |
| --- | --- | --- |
| Lernwerte-Speicher (KVS) | 50 Einträge, je 253 Zeichen, Schlüssel max. 42 Zeichen | Kompaktes JSON, kurze Namen, keine Messhistorie am Gerät |
| Speicher ist Flash | Häufiges Schreiben nutzt Flash ab | Nur bei Ereignissen speichern, nicht bei jeder Messung |
| Uhrzeit | Kommt per Internet-Zeitserver | Im Offline-Betrieb ist die Uhrzeit nicht verlässlich → Logik rechnet mit Laufzeit und Intervallen, nicht mit Kalenderzeit |

* * *

## 1 Feuchtigkeit der Erde messen

### Was feststeht

Der SMT50 liefert die Bodenfeuchte als Spannung 0–3 V über die **gelbe** Ader. Versorgung 3,3–30 V DC, damit ist eine gemeinsame 12-V-Versorgung mit dem Shelly möglich. Genauigkeit ±3 % im Referenzboden.

### Befund 1.1 – Skala 0–3 V, nicht 0–3,13 V (Konflikt)

Die Projektbeschreibung nennt 3,13 V = 100 % Feuchtigkeit. Laut Herstellerangabe ist der Endwert **3 V**, und dieser Endwert entspricht **50 % volumetrischem Wassergehalt**, nicht 100 %. Die Herstellerformel lautet:

> Wassergehalt in Volumenprozent = Spannung × 50 ÷ 3

Es sind also zwei verschiedene Skalen im Spiel: die Sensorskala (0–50 Vol.-%) und eine Anzeigeskala 0–100 %.

*Vorschlag:* Intern immer mit Volumenprozent nach Herstellerformel rechnen. Für Anzeige und Zielwerte eine relative Skala 0–100 % verwenden, die 100 % = Sensorendwert bedeutet. Beide Werte sind ineinander umrechenbar, und die Regelung bleibt sauber definiert. Zu klären: welche Skala in Anzeige und Zielwerten geführt wird (Frage 1).

### Befund 1.2 – Auflösung und Rauschen

Der Analogeingang des Shelly misst in den Bereichen 0–15 V oder 0–30 V. Das Nutzsignal belegt davon nur 0–3 V, also höchstens ein Fünftel. Ein Feuchteprozent entspricht rund 0,03 V. Einzelmessungen schwanken dadurch merkbar.

*Vorschlag:* Kleineren Messbereich (0–15 V) einstellen, pro Messung mehrere Werte nehmen und den Mittelwert der mittleren Werte verwenden, sowie eine Hysterese setzen, damit die Regelung nicht bei jedem Rauschsprung reagiert.

### Befund 1.3 – Plausibilitätsprüfung fehlt noch

Ein abgerissenes Kabel liefert 0 V und sieht wie „völlig trocken" aus. Genau dann würde ungeprüft gegossen.

*Vorschlag:* Werte unter etwa 0,05 V und über etwa 3,2 V gelten als Sensor- oder Kabelfehler. In diesem Fall wird nicht gegossen, sondern eine Störung gesetzt.

### Befund 1.4 – Zweiter Messwert des Sensors bleibt ungenutzt

Der SMT50 liefert über die grüne Ader zusätzlich die **Bodentemperatur**. Der Shelly hat aber nur einen Analogeingang, der für die Feuchte gebraucht wird.

*Vorschlag:* So lassen. Wenn die Bodentemperatur später gewünscht ist, kann ein zweiter DS18B20 in die Erde gelegt werden – am Ein-Draht-Bus sind bis zu fünf Fühler möglich (Frage 2).

* * *

## 2 Temperatur messen

### Was feststeht

Der DS18B20 hängt am Ein-Draht-Bus und misst die Umgebungstemperatur. Bis zu fünf Fühler wären möglich.

### Befund 2.1 – Zwei Temperaturwerte mit verschiedener Aufgabe

Die Beschreibung nutzt die Temperatur für zwei Dinge: aktueller Bedarf und Jahreszeit. Das sind unterschiedliche Zeitachsen.

*Vorschlag:* Beides trennen. Der **aktuelle Messwert** wirkt auf Sperren (Frost, Hitze). Ein **langfristiger Mittelwert über mehrere Tage** dient als Jahreszeit-Anzeiger, ohne Kalender und ohne Uhrzeit. So verhält sich das System im Winter automatisch anders als im Sommer.

### Befund 2.2 – Frostsperre und Standort

Ob eine Frostsperre gebraucht wird, hängt vom Standort ab. Der ist in der Beschreibung nicht festgelegt (Frage 3).

*Vorschlag, falls außen:* Unter etwa 4 °C nicht gießen.

### Befund 2.3 – Verhalten bei Ausfall des Fühlers

Nicht festgelegt: Soll das System ohne Temperaturwert weitergießen oder aussetzen?

*Vorschlag:* Weitergießen mit den Basiswerten, aber Störung melden. Die Feuchtemessung allein trägt die Regelung; die Temperatur verfeinert sie nur (Frage 4).

* * *

## 3 Wasserstand prüfen

### Was feststeht

Der Wasserstandssensor liegt am zweiten digitalen Eingang. Laut Beschreibung: 1 = leer, 0 = Wasser vorhanden.

### Befund 3.1 – Logik am realen Aufbau bestätigen

Die Eingänge des Shelly schalten bei niedriger Spannung. Ob am Ende 1 tatsächlich „leer" bedeutet, hängt von Schwimmertyp (Öffner oder Schließer) und Verdrahtung ab. Das muss am Gerät geprüft werden, nicht im Script vorausgesetzt (Frage 5).

### Befund 3.2 – Schwimmer prellt

Wasserbewegung lässt einen Schwimmerschalter flattern.

*Vorschlag:* Ein Zustand gilt erst als gültig, wenn er einige Sekunden stabil anliegt.

### Befund 3.3 – Leermeldung während des Pumpens

Beim Pumpen sinkt der Pegel. Die Meldung kann also mitten im Gießvorgang kommen.

*Vorschlag:* Pumpe sofort abschalten, Vorgang als unvollständig verbuchen, Lernwerte aus diesem Vorgang **nicht** übernehmen (das Ergebnis wäre verfälscht).

### Befund 3.4 – Verhalten nach dem Auffüllen

Nicht festgelegt: Wird ein ausgefallener Gießvorgang nachgeholt, sobald wieder Wasser da ist?

*Vorschlag:* Ja, aber nur über die normale Messung – also beim nächsten Messtakt neu entscheiden, nicht blind nachschütten (Frage 6).

### Befund 3.5 – Trockenlaufschutz

Sitzt der Sensor oberhalb des Pumpeneinlaufs, läuft die Pumpe nach der Leermeldung noch kurz mit Wasser. Sitzt er darunter, kann sie trocken laufen. Das ist eine Frage des Aufbaus (Frage 7).

* * *

## 4 Bewässerungszeit und Intervall bestimmen

Das ist das Kernstück und der Teil, der in der Beschreibung nur als Ziel formuliert ist. Hier der vollständige Vorschlag.

### 4.1 Regelprinzip: messgeführt statt zeitgeführt

*Vorschlag:* Es gibt keinen festen Gießplan. Gegossen wird, wenn die gemessene Feuchte unter die untere Zielgrenze fällt. Die Menge ist der Weg von Ist bis Zielmitte.

Der Vorteil: Der Jahreszeit-Effekt ergibt sich von selbst. Im Sommer trocknet die Erde schneller aus, die Untergrenze wird häufiger erreicht, es wird häufiger gegossen. Im Winter seltener. Es braucht dafür keine Kalenderlogik.

### 4.2 Zielband

Zwei Werte steuern alles: untere Zielgrenze (löst das Gießen aus) und obere Zielgrenze (gilt als „zu viel").

*Vorschlag als Startwerte auf der relativen Skala:* Untergrenze 35 %, Obergrenze 60 %, Zielmitte rund 48 %. Diese Werte hängen von Pflanze und Substrat ab und müssen kalibriert werden (Frage 8).

Optional kann die Untergrenze über den langfristigen Temperaturmittelwert leicht verschoben werden, damit die Pflanze im Winter trockener stehen darf.

### 4.3 Dosis lernen: Wirkung pro Pumpensekunde

*Vorschlag:* Das System merkt sich einen einzigen Lernwert für die Dosierung – **wie viele Feuchteprozent eine Pumpensekunde bringt.**

Der Ablauf je Gießvorgang:

1. Feuchte vor dem Gießen merken
2. Gießsekunden berechnen: Weg bis Zielmitte geteilt durch den gelernten Wirkungswert
3. Pumpen, dann Einsickerzeit abwarten (*Vorschlag:* 20–30 Minuten)
4. Nachmessen und die tatsächliche Wirkung pro Sekunde ausrechnen
5. Lernwert sanft nachziehen: 70 % alter Wert, 30 % neue Messung

So gleitet der Wert langsam auf den echten Aufbau ein und reagiert auf Änderungen, ohne bei einem einzelnen Ausreißer zu kippen. Der Lernwert wird nach oben und unten begrenzt, damit ein Fehlwert die Anlage nicht entgleisen lässt.

### 4.4 In Etappen gießen

*Vorschlag:* Große Dosen werden in Portionen mit Pausen gegeben statt in einem Dauerlauf. Das Wasser kann einsickern, läuft nicht am Topfrand vorbei, und die Messung zwischen den Portionen zeigt die Wirkung. Zusätzlich gilt eine Höchstzahl an Portionen pro Tag.

### 4.5 Zu viel und zu wenig erkennen

| Beobachtung nach der Einsickerzeit | Bewertung | Reaktion (Vorschlag) |
| --- | --- | --- |
| Feuchte über der Obergrenze | zu viel gegossen | Dosis-Sicherheitsfaktor senken, nächste Gabe kleiner |
| Feuchte noch unter der Untergrenze | zu wenig gegossen | eine weitere Portion, Wirkungswert nach unten korrigieren |
| Feuchte praktisch unverändert | Störungsverdacht: Pumpe, Schlauch, Sensorlage | **nicht** blind nachgießen, Störung melden |
| Feuchte im Zielband | passt | Lernwert wie gewohnt nachziehen |

Die dritte Zeile ist wichtig: „keine Wirkung" darf nicht zu „dann mehr Wasser" führen. Sonst würde bei einem abgerutschten Sensor der Topf geflutet.

### 4.6 Staunässe abbauen

Die Beschreibung verlangt Trockenphasen. Eine reine Mindestpause reicht dafür nicht, weil sie nicht prüft, ob die Erde wirklich abgetrocknet ist.

*Vorschlag:* Zwei Bedingungen müssen gemeinsam erfüllt sein, bevor wieder gegossen wird:

1. **Nachweis der Trockenphase:** Die Feuchte ist seit dem letzten Gießen mindestens einmal unter die Trockenphasen-Schwelle gefallen (also unter die Untergrenze, nicht nur bis dahin).
2. **Mindestpause:** Seit dem letzten Gießen ist eine Sperrzeit abgelaufen (*Vorschlag:* 12–24 Stunden, Frage 9).

Zusätzlich wird die **Austrocknungsrate** gemessen, also wie viele Feuchteprozent pro Stunde verloren gehen. Bleibt sie trotz Wärme nahe null, ist das ein direkter Hinweis auf Staunässe oder Sensorfehler und löst eine Störung statt einer Gabe aus.

### 4.7 Gießzeitfenster

Offen, ob nur zu bestimmten Tageszeiten gegossen werden soll (Frage 10). Zu bedenken: Im Offline-Betrieb ist die Uhrzeit nach einem Stromausfall nicht verlässlich. Ein Zeitfenster wäre also nur eine Komfortfunktion für den Online-Betrieb, die Grundlogik darf nicht davon abhängen.

### 4.8 Messtakt

*Vorschlag:* Messen alle 10–15 Minuten. Das reicht für Erde, hält die Last klein und liefert genug Punkte für die Austrocknungsrate. Gespeichert wird nur bei Ereignissen – Gießvorgang, gelernter Wert, Störung –, nicht bei jeder Messung.

* * *

## 5 Pumpe einschalten

### Befund 5.1 – Die Pumpe kann nicht direkt am Ausgang hängen (kritisch)

Die Ausgänge des Shelly Plus Uni sind Halbleiterausgänge mit **maximal 30 V und 300 mA**. Typische kleine 12-V-Wasserpumpen ziehen ein Mehrfaches davon.

*Vorschlag:* Der Ausgang schaltet ein externes Relais oder Halbleiterrelais, dieses schaltet die Pumpe. Nur wenn die Pumpe nachweislich unter 300 mA bleibt, wäre der direkte Anschluss zulässig. Dafür fehlen noch Pumpentyp und Stromaufnahme (Frage 11).

### Befund 5.2 – Abschaltung doppelt absichern

*Vorschlag:* Zwei voneinander unabhängige Sicherungen.

1. Der Einschaltbefehl enthält die Abschaltzeit mit, sodass das Gerät selbst abschaltet – auch wenn das Script hängt oder neu startet.
2. Zusätzlich wird in der Gerätekonfiguration eine automatische Abschaltzeit gesetzt, als zweites Netz.

### Befund 5.3 – Harte Obergrenzen

*Vorschlag:* Höchstdauer je Gießvorgang, Höchstsumme je Tag und Mindestpause zwischen zwei Schaltvorgängen. Diese Grenzen gelten unabhängig von allen Lernwerten. Sie sind die Notbremse, wenn die Lernlogik falsch liegt.

### Befund 5.4 – Zustand nach Stromausfall

*Vorschlag:* Der Ausgang muss nach dem Einschalten des Geräts sicher **aus** stehen, und die Sperrzeit nach dem letzten Gießen muss einen Neustart überleben. Beides ist am Gerät zu prüfen und im Lernspeicher zu hinterlegen.

* * *

## 6 Störungen und Meldungen

Diese Fälle sollte das System erkennen und festhalten:

- Wasserbehälter leer
- Feuchtesensor unplausibel (Kabel, Stecker, Sensorlage)
- Temperaturfühler antwortet nicht
- Gießen ohne Wirkung
- Tageslimit erreicht
- Staunässe-Verdacht (keine Austrocknung)

Offen ist der Meldeweg (Frage 12). Im Offline-Betrieb bleibt nur der lokale Status; denkbar ist der zweite Ausgang als Störmelder. Online kämen Webhook, Shelly-Cloud oder das VPS-Backend infrage.

* * *

## 7 Datenhaltung am Gerät

*Vorschlag:* Fünf Speichereinträge, jeder deutlich unter 253 Zeichen, mit kurzen Feldnamen.

| Eintrag | Inhalt | Wird geschrieben |
| --- | --- | --- |
| Einstellungen | Zielband, Grenzen, Sperrzeit, Einsickerzeit | nur bei Änderung |
| Lernwerte | Wirkung pro Sekunde, Sicherheitsfaktor, Austrocknungsrate, Temperaturmittel | nach jedem abgeschlossenen Gießvorgang |
| Zustand | letzter Gießvorgang, Sekunden, Feuchte davor und danach, Trockenphase erfüllt ja/nein | bei Ereignis |
| Tageszähler | Summe Sekunden, Anzahl Gaben | bei Ereignis |
| Störung | letzter Fehler und Zeitpunkt | bei Ereignis |

Messwerte selbst bleiben im Arbeitsspeicher. Eine Historie am Gerät ist nicht vorgesehen – dafür ist Stufe 2 zuständig.

* * *

## 8 Ausbaustufe 2: Historie an das VPS-Backend

Entschieden: Die Steuerung bleibt am Gerät. Das Backend zeichnet nur auf und zeigt an.

*Vorschlag:* Der Shelly sendet Ereignisse als JSON an das Backend – Messwerte im Takt, jeden Gießvorgang, jede Störung und jede Lernwert-Änderung. Eine Pufferung am Gerät ist kaum möglich, weil der Speicher dafür zu klein ist.

Daraus folgt eine Entscheidung (Frage 13): Entweder Lücken in der Historie bei Netzausfall akzeptieren, oder eine Sammelstelle im lokalen Netz vorsehen, die das Gerät regelmäßig abfragt und die Daten gebündelt zum VPS weitergibt. Die erste Variante ist deutlich einfacher, die zweite lückenfrei.

Wichtig für die Gestaltung: Weil die Uhrzeit offline unsicher ist, sollte jedes Ereignis eine laufende Nummer und die Gerätelaufzeit mitschicken. Dann lässt sich die Reihenfolge auch bei falscher Uhrzeit serverseitig richtig einordnen.

* * *

## 9 Offene Fragen

| Nr. | Frage | Betrifft |
| --- | --- | --- |
| 1 | Welche Feuchteskala wird geführt: Volumenprozent nach Datenblatt oder relative Skala 0–100 %? | 1.1 |
| 2 | Soll später ein zweiter Fühler die Bodentemperatur messen? | 1.4 |
| 3 | Standort innen oder außen – ist eine Frostsperre nötig? | 2.2 |
| 4 | Bei Ausfall des Temperaturfühlers weitergießen oder aussetzen? | 2.3 |
| 5 | Ist am realen Aufbau bestätigt, dass 1 = leer bedeutet? | 3.1 |
| 6 | Wird ein wegen Wassermangel ausgefallener Gießvorgang nachgeholt? | 3.4 |
| 7 | Sitzt der Wasserstandssensor über dem Pumpeneinlauf? | 3.5 |
| 8 | Welche Pflanze, welches Substrat, welche Topfgröße – für die Kalibrierung des Zielbands? | 4.2 |
| 9 | Wie lang soll die Mindestpause zwischen zwei Gaben sein? | 4.6 |
| 10 | Soll es ein Gießzeitfenster geben? | 4.7 |
| 11 | Welche Pumpe mit welcher Stromaufnahme, und ist ein Relais vorhanden? | 5.1 |
| 12 | Wie sollen Störungen gemeldet werden? | 6 |
| 13 | Stufe 2: Lücken akzeptieren oder Sammelstelle im lokalen Netz? | 8 |

* * *

## 10 Vorgeschlagene nächste Schritte

1. Offene Fragen aus Abschnitt 9 klären – besonders 1, 5, 8 und 11, weil davon die Grundwerte und die Verdrahtung abhängen.
2. Konzept v2 mit den entschiedenen Werten festschreiben.
3. Erst dann das Gerätescript in Abschnitten bauen, jeweils mit Prüfschritt: Messwerte lesen, dann Sicherheiten, dann Regelung, dann Lernen, dann Stufe 2.

### Quellen

- Trübner SMT50, Bedienungsanleitung: https://www.truebner.de/assets/download/Anleitung_SMT50.pdf
- Shelly Plus Uni, Wissensdatenbank: https://kb.shelly.cloud/knowledge-base/shelly-plus-uni
- Shelly Speicher (KVS), technische Dokumentation: https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS/
