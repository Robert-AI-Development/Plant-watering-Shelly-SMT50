# Bewässerungs-System – Konzept v2

Diese Fassung baut auf der Projektanalyse v1 auf und setzt drei Klärungen sowie eine neue Betriebsanforderung um: **Die wichtigen Routinen laufen über den Zeitplan des Geräts, nicht über ein dauerhaft laufendes Script.**

Vorschläge sind als *Vorschlag* gekennzeichnet. Offene Punkte stehen in Abschnitt 9.

* * *

## Was sich gegenüber v1 geändert hat

| Thema | v1 | v2 |
| --- | --- | --- |
| Pumpe schalten | offen, Ausgang zu schwach für Direktanschluss | **geklärt:** Relais ist vorhanden, Ausgang steuert nur das Relais |
| Feuchteskala | Konflikt mit dem Datenblatt | **geklärt:** eigene Kalibrierung, 3,13 V im Wasser = 100 % |
| Zeitsteuerung | Script-Timer, Uhrzeit gemieden | **neu:** Zeitplan des Geräts als Taktgeber, Script nur kurz aktiv |
| Zeitrechnung | Takte zählen | Zeitstempel, weil der Zeitplan ohnehin eine gültige Uhrzeit braucht |
| Zielband | Startwerte geschätzt | wird durch zwei Kalibriermessungen bestimmt, nicht geschätzt |

* * *

## 0 Architektur: Der Zeitplan steuert, das Script rechnet kurz

### 0.1 Grundsatz

Erfahrung aus dem Betrieb: Dauerhaft laufende Scripts stürzen nach einiger Zeit ab. Der Zeitplan im Gerät ist dagegen stabil.

*Vorschlag:* Das Script wird zum **Einmal-Läufer**. Es startet, erledigt genau einen Arbeitstakt in wenigen Sekunden und beendet sich selbst. Es gibt keine Dauerschleife und keinen Zustand im Arbeitsspeicher. Alles, was der nächste Takt wissen muss, liegt im Gerätespeicher.

Damit verschwindet die Absturzursache praktisch von selbst: Ein Script, das nur Sekunden lebt, kann keinen Speicher über Stunden zulaufen lassen. Und stürzt ein einzelner Takt trotzdem ab, startet der Zeitplan den nächsten ganz normal. Ein Ausfall kostet einen Takt, nicht den Betrieb.

### 0.2 Die Zeitplan-Einträge

Der Zeitplan kann beliebige Gerätebefehle auslösen, bis zu fünf pro Eintrag, und erlaubt 20 Einträge insgesamt. Gebraucht werden davon drei.

| Eintrag | Takt (Vorschlag) | Aufgabe |
| --- | --- | --- |
| Arbeitstakt | alle 15 Minuten, zur Minute 0, 15, 30, 45 | startet das Script für einen Takt |
| Sicherheits-Aus | alle 15 Minuten, versetzt um 5 Minuten | schaltet den Pumpenausgang bedingungslos aus |
| Tageswechsel | einmal täglich | setzt die Tageszähler zurück |

Der **Sicherheits-Aus** ist der wichtigste Punkt daran: Er braucht kein Script und keine Logik. Selbst wenn das Script mitten im Gießen abstürzt, schaltet das Gerät die Pumpe spätestens fünf Minuten später aus. Voraussetzung ist, dass eine einzelne Gabe kürzer bleibt als dieser Versatz.

### 0.3 Ablauf eines Arbeitstakts

Der Takt folgt genau dem Ablauf 1–5 aus der Projektbeschreibung:

1. Gespeicherten Zustand lesen: Einstellungen, Lernwerte, letzter Gießvorgang, Tageszähler
2. **Feuchtigkeit messen** – mehrere Werte, Mittelwert der mittleren Werte, Plausibilitätsprüfung
3. **Temperatur messen** – aktueller Wert und langfristiger Mittelwert
4. **Wasserstand prüfen** – mehrfach innerhalb des Takts, Zustand muss stabil sein
5. **Entscheiden** – Zustandsmaschine, siehe unten
6. **Pumpe schalten**, falls freigegeben – mit mitgegebener Abschaltzeit
7. Speicher schreiben, aber nur wenn sich der Zustand geändert hat
8. Script beendet sich selbst

### 0.4 Die Zustandsmaschine

Der Zustand liegt im Gerätespeicher und überlebt Absturz und Stromausfall.

| Zustand | Bedeutung | Übergang beim nächsten Takt |
| --- | --- | --- |
| Beobachten | Normalfall, nur messen | Sind alle Freigaben erfüllt und die Feuchte unter der Untergrenze → Dosis berechnen, Pumpe ein, Zustand *Gegossen* |
| Gegossen | Gabe ist abgeschlossen, Pumpe ist längst aus | → *Einsickern*, Startzeit merken |
| Einsickern | Wasser verteilt sich, Messung noch nicht aussagekräftig | Nach der Einsickerzeit nachmessen, Wirkung bewerten, Lernwert anpassen → *Sperre* oder weitere Portion |
| Sperre | Trockenphase läuft | Wenn Mindestpause abgelaufen **und** Trockenphase nachgewiesen → *Beobachten* |
| Störung | Gießen gesperrt | Wenn die Ursache weg ist (Wasser aufgefüllt, Sensor wieder plausibel) → *Sperre* |

Ein Vorteil dieser Form: Es gibt keinen Zeitpunkt, an dem das System „mitten in etwas" ist und ein Neustart es verwirren würde. Jeder Takt liest den Zustand neu und entscheidet von vorn.

### 0.5 Verhalten nach Absturz oder Stromausfall

*Vorschlag:* Erkennt das Script, dass das Gerät seit dem letzten Takt neu gestartet ist, gilt ein laufender Gießvorgang als unsicher. Dann wird **kein Lernwert** daraus abgeleitet und direkt in die Sperre gewechselt. Ein verfälschter Lernwert wäre schädlicher als eine ausgelassene Gabe.

Der Pumpenausgang muss nach dem Einschalten des Geräts sicher aus stehen. Das ist am Gerät einzustellen und zu prüfen.

### 0.6 Grenzen, die die Bauweise vorgeben

| Grenze | Wert | Folge |
| --- | --- | --- |
| Zeitplan-Einträge | 20, je bis zu 5 Befehle | reichlich Luft, drei werden gebraucht |
| Gleichzeitige Scripts | 3 | ein Script genügt |
| Speicher-Einträge | 50, je 253 Zeichen | kompaktes JSON, kurze Feldnamen |
| Script-Speicher | gemeinsamer Pool, Verbrauch ist auslesbar | *Vorschlag:* Speicherverbrauch je Takt mitschreiben – so wird ein Leck sichtbar, statt zu überraschen |

### 0.7 Ein Punkt bleibt zu klären: die Uhrzeit

Der Zeitplan arbeitet mit Uhrzeit und bekommt sie über das Internet. Solange das Gerät im Netz ist, ist das unproblematisch, und die Zeitrechnung im Script kann Zeitstempel verwenden – das ist genauer und spart Schreibzugriffe.

Nach einem Stromausfall **ohne** Internet kennt das Gerät die Uhrzeit jedoch nicht, und dann lösen die Zeitplan-Einträge nicht aus. Deshalb die Frage: Ist am Standort dauerhaft WLAN mit Internet vorhanden? (Frage 14)

*Vorschlag für den Fall, dass es fehlen kann:* Das Script wird zusätzlich auf Autostart beim Hochfahren gesetzt. Es prüft die Uhrzeit. Ist sie gültig, macht es einen Takt und beendet sich – der Zeitplan übernimmt. Ist sie ungültig, hält es sich als Notbetrieb mit eigenem Takt am Leben, bis die Zeit wieder stimmt. Der Notbetrieb ist der weniger stabile Weg, deshalb ist er die Ausnahme und nicht die Regel.

* * *

## 1 Feuchtigkeit der Erde messen

### 1.1 Kalibrierung mit zwei eigenen Messpunkten

Gemessen wurde: **3,13 V mit dem Sensor im Wasser.** Das ist der Nasspunkt und damit die Obergrenze der Skala.

*Vorschlag:* Die Skala wird über zwei eigene Messwerte definiert, nicht über das Datenblatt:

| Punkt | Bedeutung | Wert |
| --- | --- | --- |
| Nasspunkt | Sensor im Wasser = 100 % | 3,13 V (gemessen) |
| Trockenpunkt | Sensor trocken in Luft = 0 % | noch zu messen (Frage 15) |

Feuchte in Prozent = (Messwert − Trockenpunkt) ÷ (Nasspunkt − Trockenpunkt) × 100, begrenzt auf 0 bis 100.

Zum Datenblatt: Dort endet der Sensor bei 3 V, was 50 % volumetrischem Wassergehalt entspricht. Die gemessenen 3,13 V liegen leicht darüber – erklärbar durch die Toleranzen von Sensor und Messeingang. Weil die Skala über eigene Messpunkte festgelegt wird, spielt diese Abweichung für die Regelung keine Rolle.

**Wichtig zur Einordnung:** 100 % bedeutet „Sensor steht im Wasser". Das ist ein Kalibrierpunkt, niemals ein Zielwert. Das Zielband liegt deutlich darunter.

### 1.2 Rauschen dämpfen

Das Nutzsignal belegt nur den unteren Teil des Messbereichs, ein Feuchteprozent entspricht rund 0,03 V.

*Vorschlag:* Kleineren Messbereich einstellen, pro Takt mehrere Werte nehmen und den Mittelwert der mittleren Werte verwenden, dazu eine Hysterese an der Untergrenze.

### 1.3 Plausibilitätsgrenzen

*Vorschlag:* Werte deutlich unter dem Trockenpunkt oder über etwa 3,35 V gelten als Sensor- oder Kabelfehler. Dann wird nicht gegossen, sondern eine Störung gesetzt. Das ist die wichtigste einzelne Schutzregel, denn ein abgerissenes Kabel sieht wie „völlig trocken" aus.

* * *

## 2 Temperatur messen

Unverändert gegenüber v1:

- Der aktuelle Wert wirkt auf Sperren, etwa eine Frostsperre bei Außenstandort.
- Ein Mittelwert über mehrere Tage dient als Jahreszeit-Anzeiger. Damit reagiert das System auf Sommer und Winter, ohne Kalenderlogik.
- Bei Ausfall des Fühlers *Vorschlag:* weitergießen mit den Basiswerten, aber Störung melden. Die Feuchtemessung trägt die Regelung; die Temperatur verfeinert sie nur.

* * *

## 3 Wasserstand prüfen

Unverändert gegenüber v1, mit einer Ergänzung zur neuen Bauweise:

- Die Zuordnung „1 = leer" ist am realen Aufbau zu bestätigen, nicht im Script vorauszusetzen.
- Entprellen passiert **innerhalb** eines Takts: mehrere Abfragen über einige Sekunden, der Zustand muss stabil sein.
- Meldet der Sensor „leer", wird nicht gegossen. Kommt die Meldung während einer Gabe, schaltet die Pumpe sofort ab und der Vorgang liefert **keinen** Lernwert.
- Nachgeholt wird nichts blind: Nach dem Auffüllen entscheidet der normale Takt neu.

* * *

## 4 Bewässerungszeit und Intervall bestimmen

### 4.1 Regelprinzip

Messgeführt statt zeitgeführt: Gegossen wird, wenn die gemessene Feuchte unter die Untergrenze fällt. Die Menge ist der Weg von Ist bis Zielmitte. Der Jahreszeit-Effekt ergibt sich damit von selbst – im Sommer trocknet die Erde schneller aus, also wird häufiger gegossen.

Der Zeitplan gibt nur den **Takt** vor, nicht den Gießzeitpunkt. Das bleibt der Unterschied zu einer klassischen Zeitschaltuhr.

### 4.2 Zielband: messen statt schätzen

*Vorschlag:* Das Zielband wird nicht geschätzt, sondern aus zwei Messungen an der echten Pflanze abgeleitet:

1. **Obere Referenz:** einmal kräftig gießen, 30 Minuten abwarten, dann messen. Dieser Wert ist „gut versorgt".
2. **Untere Referenz:** warten, bis die Pflanze sichtbar Wasser braucht und die Erde auch in der Tiefe trocken ist, dann messen. Dieser Wert ist „jetzt gießen".

Untergrenze und Zielmitte werden aus diesen beiden Werten festgelegt, die Obergrenze etwas über der oberen Referenz. So passen die Zahlen zu Pflanze, Substrat und Topfgröße, ohne dass jemand sie erfinden muss (Frage 8).

### 4.3 Dosis lernen: Wirkung pro Pumpensekunde

*Vorschlag:* Ein einziger Lernwert steuert die Dosierung – **wie viele Feuchteprozent eine Pumpensekunde bringt.**

1. Feuchte vor dem Gießen merken
2. Sekunden berechnen: Weg bis Zielmitte geteilt durch den Lernwert
3. Pumpen, Einsickerzeit abwarten (*Vorschlag:* 30 Minuten, also zwei Takte)
4. Nachmessen, tatsächliche Wirkung pro Sekunde berechnen
5. Lernwert sanft nachziehen: 70 % alter Wert, 30 % neue Messung, begrenzt auf einen plausiblen Bereich

So gleitet der Wert auf den echten Aufbau ein und folgt Veränderungen, ohne bei einem Ausreißer zu kippen.

### 4.4 In Etappen gießen

*Vorschlag:* Große Dosen werden in Portionen mit Pausen gegeben. Das Wasser sickert ein statt am Topfrand vorbeizulaufen, und die Messung zwischen den Portionen zeigt die Wirkung. Dazu eine Höchstzahl Portionen pro Tag.

Das passt zur Taktbauweise von selbst: Eine Portion pro Takt, die nächste entscheidet der nächste Takt.

### 4.5 Zu viel und zu wenig erkennen

| Beobachtung nach der Einsickerzeit | Bewertung | Reaktion (Vorschlag) |
| --- | --- | --- |
| über der Obergrenze | zu viel | Sicherheitsfaktor senken, nächste Gabe kleiner |
| noch unter der Untergrenze | zu wenig | weitere Portion, Lernwert nach unten korrigieren |
| praktisch unverändert | Störungsverdacht: Pumpe, Schlauch, Sensorlage | **nicht** nachgießen, Störung melden |
| im Zielband | passt | Lernwert normal nachziehen |

Die dritte Zeile bleibt die wichtigste Regel des ganzen Konzepts: „keine Wirkung" darf nie zu „dann mehr Wasser" führen.

### Nachtrag 13.09.2026 – Rückkopplung im Gießfenster (Etappe 10)

Ersetzt in 4.3 „Einsickerzeit 30 Minuten, also zwei Takte" und in 4.4 „eine Portion pro Takt, die nächste entscheidet der nächste Takt" (Rückkopplung ein Tag). Dieser Nachtrag ist die Regelquelle; Design, Zahlen und Randfälle in `docs/PLAN.md` (Etappe 10, Entscheidungen 38–63).

- **Portionen im Fenster:** Das Gießscript misst frisch, gibt eine Portion, wartet 30 s einsickern, misst alle 5 s, bis der Wert stabil ist (Spanne ≤ 1 % über vier Werte **und** kein Anstieg mehr, höchstens 90 s), und entscheidet: unter dem Ziel (50 %) eine weitere Portion aus der gerade gemessenen Wirkung, im Band fertig, über 60 % „zu viel" für den nächsten Tag merken. Höchstens sechs Portionen, zusammen höchstens 180 s, und das Fenster endet vor dem nächsten Arbeitstakt.
- **Erste Portion unter dem Ziel:** Die gelernte Dosis wird mit dem Sicherheitsfaktor 0,7 gegeben; der Faktor sinkt bei „zu viel" und steigt wieder, wenn Korrekturportionen nötig waren. Lieber nachlegen als überschwemmen.
- **Lernen aus dem Fenster:** Der Lernwert (Feuchteprozent je wirksamer Pumpensekunde) kommt aus den stabilisierten Messungen im Fenster, sanft nachgezogen wie in 4.3. Der Wert nach 30 Minuten ist nur Kontrolle („zu viel", „eingebrochen") und geht nie in den Lernwert.
- **Keine Wirkung:** Bleibt die erste Portion wirkungslos, folgt genau eine volle Probeportion; bleibt auch sie ohne Wirkung, wird die Störung gesetzt und nur von Hand gelöscht. Die dritte Zeile aus 4.5 bleibt verbindlich: **„keine Wirkung" darf nie zu „dann mehr Wasser" führen** – die gedeckelte Probeportion ist die einzige Ausnahme.
- **Wochen-Trockenphase (ersetzt Bedingung 1 in 4.6 „nach jeder Gabe"):** Normal gießen ohne Trockenphase; ab jedem Freitag keine Gabe, bis die Feuchte unter 28 % gefallen ist. Zeigt eine Messung außerhalb eines Fensters über 60 %, beginnt die Trockenphase sofort. Für die Kalibrierung ist sie abgeschaltet.
- **Vorprüfung:** Liegt die Frischmessung im Fenster schon über 50 % (von Hand gegossen oder gedüngt), gibt es keine Gabe, keinen Lernwert und keine Pause.

### 4.6 Staunässe abbauen

*Vorschlag:* Zwei Bedingungen müssen gemeinsam erfüllt sein, bevor wieder gegossen wird:

1. **Trockenphase nachgewiesen:** Die Feuchte ist seit der letzten Gabe mindestens einmal unter die Trockenphasen-Schwelle gefallen.
2. **Mindestpause abgelaufen:** seit der letzten Gabe (*Vorschlag:* 12–24 Stunden, Frage 9).

Zusätzlich wird die **Austrocknungsrate** in Feuchteprozent pro Stunde beobachtet. Bleibt sie trotz Wärme nahe null, ist das ein Hinweis auf Staunässe oder einen Sensorfehler und löst eine Störung aus, keine Gabe.

### 4.7 Zeitrechnung

*Vorschlag:* Für Einsickerzeit, Mindestpause und Austrocknungsrate werden Zeitstempel verwendet. Das ist genau und spart Schreibzugriffe, weil kein Zähler je Takt fortgeschrieben werden muss. Möglich ist es, weil der Zeitplan ohnehin eine gültige Uhrzeit voraussetzt.

Ist die Uhrzeit ungültig, wird nicht gegossen, sondern nur gemessen – siehe Abschnitt 0.7.

* * *

## 5 Pumpe einschalten

### 5.1 Relais

Geklärt: Der Ausgang schaltet ein vorhandenes Relais, das Relais schaltet die Pumpe. Der Ausgang des Geräts trägt damit keine Pumpenlast.

### 5.2 Dreifache Abschaltsicherung

*Vorschlag:* Drei voneinander unabhängige Wege, die Pumpe auszuschalten:

| Ebene | Wirkt | Greift, wenn |
| --- | --- | --- |
| Abschaltzeit im Einschaltbefehl | Gerät schaltet selbst ab | Script stürzt direkt nach dem Einschalten ab |
| Automatische Abschaltung in der Gerätekonfiguration | Gerät schaltet selbst ab | der Einschaltbefehl kam ohne Abschaltzeit |
| Sicherheits-Aus im Zeitplan | Zeitplan schaltet ab | beide oberen Ebenen falsch konfiguriert sind |

### 5.3 Harte Obergrenzen

*Vorschlag:* Höchstdauer je Gabe, Höchstsumme je Tag, Mindestpause zwischen zwei Schaltvorgängen. Diese Grenzen gelten unabhängig von allen Lernwerten – sie sind die Notbremse, wenn die Lernlogik falsch liegt.

Eine Bedingung kommt aus der Architektur: Die Höchstdauer je Gabe muss **kürzer sein als der Versatz des Sicherheits-Aus**, damit dieser nie in eine laufende, gewollte Gabe hineinschaltet. Für die konkrete Zahl fehlt noch die Pumpenleistung (Frage 16).

* * *

## 6 Störungen und Meldungen

Erkannt und festgehalten werden:

- Wasserbehälter leer
- Feuchtesensor unplausibel
- Temperaturfühler antwortet nicht
- Gießen ohne Wirkung
- Tageslimit erreicht
- Staunässe-Verdacht
- Uhrzeit ungültig
- Script-Speicherverbrauch steigt auffällig

Der Meldeweg ist offen (Frage 12). Denkbar sind der lokale Status, der zweite Ausgang als Störmelder, ein Webhook oder später das Backend.

* * *

## 7 Datenhaltung am Gerät

*Vorschlag:* Fünf Einträge, jeder deutlich unter 253 Zeichen, kurze Feldnamen.

| Eintrag | Inhalt | Wird geschrieben |
| --- | --- | --- |
| Einstellungen | Zielband, Kalibrierpunkte, Grenzen, Mindestpause, Einsickerzeit | nur bei Änderung |
| Lernwerte | Wirkung pro Sekunde, Sicherheitsfaktor, Austrocknungsrate, Temperaturmittel | nach jeder bewerteten Gabe |
| Zustand | Zustandsname, Zeitpunkt der letzten Gabe, Sekunden, Feuchte davor und danach, Trockenphase erfüllt | bei Zustandswechsel |
| Tageszähler | Summe Sekunden, Anzahl Gaben | bei Gabe und beim Tageswechsel |
| Störung | letzter Fehler, Zeitpunkt, Speicherverbrauch | bei Änderung |

Entscheidend für die Lebensdauer des Speichers: **geschrieben wird nur bei Zustandswechseln, nicht in jedem Takt.** Bei 15-Minuten-Takt sind das wenige Schreibvorgänge pro Tag statt rund hundert.

* * *

## 8 Ausbaustufe 2: Historie an das VPS-Backend

Die Steuerung bleibt am Gerät, das Backend zeichnet auf und zeigt an.

*Vorschlag:* Der Arbeitstakt sendet seine Messwerte und Ereignisse als JSON an das Backend. Eine Pufferung am Gerät ist praktisch nicht möglich, der Speicher ist zu klein.

Daraus folgt die Entscheidung (Frage 13): Lücken bei Netzausfall akzeptieren – einfach – oder eine Sammelstelle im lokalen Netz, die das Gerät abfragt und gebündelt weitergibt – lückenfrei, aber aufwendiger.

Jedes Ereignis sollte eine laufende Nummer mitschicken. Dann lässt sich die Reihenfolge auch dann richtig einordnen, wenn die Uhrzeit einmal nicht gestimmt hat.

* * *

## 9 Offene Fragen

| Nr. | Frage | Betrifft |
| --- | --- | --- |
| 2 | Soll später ein zweiter Fühler die Bodentemperatur messen? | 1 |
| 3 | Standort innen oder außen – ist eine Frostsperre nötig? | 2 |
| 4 | Bei Ausfall des Temperaturfühlers weitergießen oder aussetzen? | 2 |
| 5 | Ist am realen Aufbau bestätigt, dass 1 = leer bedeutet? | 3 |
| 7 | Sitzt der Wasserstandssensor über dem Pumpeneinlauf? | 3 |
| 8 | Welche Pflanze und Topfgröße – und sollen die zwei Kalibriermessungen aus 4.2 so durchgeführt werden? | 4.2 |
| 9 | Wie lang soll die Mindestpause zwischen zwei Gaben sein? | 4.6 |
| 10 | Soll es zusätzlich ein Gießzeitfenster geben, etwa nur morgens? | 4 |
| 12 | Wie sollen Störungen gemeldet werden? | 6 |
| 13 | Stufe 2: Lücken akzeptieren oder Sammelstelle im lokalen Netz? | 8 |
| **14** | Ist am Standort dauerhaft WLAN mit Internet vorhanden? | 0.7 |
| **15** | Welcher Spannungswert zeigt der trockene Sensor in Luft? | 1.1 |
| **16** | Welche Fördermenge hat die Pumpe, und wie lang darf eine Gabe höchstens sein? | 5.3 |
| **17** | Ist ein 15-Minuten-Takt passend, oder lieber 10 oder 30 Minuten? | 0.2 |

Geklärt und damit entfallen: Feuchteskala (Frage 1), Relais und Pumpenanschluss (Frage 11), Nachholen nach Wassermangel (Frage 6, beantwortet durch die Taktlogik).

**Nachtrag (Interview 12.09.2026):** Fragen 9, 12, 14, 15, 16 und 17 sind beantwortet, siehe `architektur-v1.md` Abschnitt 5 und `umsetzungsplan-v2.md`.

* * *

## 10 Vorgeschlagene nächste Schritte

1. Fragen 14, 15, 16 und 17 klären – sie bestimmen Takt, Skala und Dosisgrenzen.
2. Die zwei Kalibriermessungen aus 4.2 an der echten Pflanze durchführen und Zielband festlegen.
3. Danach in Abschnitten bauen, jeweils mit Prüfschritt:
   - Takt A: Zeitplan und Einmal-Läufer, nur Messwerte lesen und protokollieren
   - Takt B: Sicherheiten – Plausibilität, Wasserstand, Grenzen, Sicherheits-Aus
   - Takt C: Regelung mit festen Dosiswerten
   - Takt D: Lernen und Staunässe-Schutz
   - Takt E: Stufe 2, Historie an das Backend

### Quellen

- Trübner SMT50, Bedienungsanleitung: https://www.truebner.de/assets/download/Anleitung_SMT50.pdf
- Shelly Plus Uni, Wissensdatenbank: https://kb.shelly.cloud/knowledge-base/shelly-plus-uni
- Shelly Zeitplan, technische Dokumentation: https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule/
- Shelly Script, technische Dokumentation: https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script/
- Shelly Speicher, technische Dokumentation: https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS/
