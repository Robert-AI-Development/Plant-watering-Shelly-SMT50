# 04 · Sicherheit und Grenzen

**Deutsch** · [English](../en/04-sicherheit-und-grenzen.md) — [Handbuch](README.md) · Teil A „Verstehen“

> **Auf einen Blick**
> - Die Pumpe läuft nie durch: jede Portion wird dreifach abgeschaltet – `toggle_after` im Einschaltbefehl (höchstens `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s), `auto_off` 190 s in der Switch-Konfiguration und der Sicherheits-Aus im Zeitplan 8 min nach dem Fenster. Alle drei wirken ohne Script.
> - Harte Grenzen gelten unabhängig vom Lernen: je Portion, je Fenster (`tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s), je Tag (`maxDay` <!-- def:cfg3.maxDay -->2<!-- /def --> Fenster), Mindestpause <!-- def:cfg3.pause -->24<!-- /def --> h. Zwei Portionen ohne Wirkung sperren das System (`noeff`), bis ein Mensch nachgesehen hat.
> - Strom: der Shelly-Ausgang trägt höchstens 30 V / 300 mA und schaltet nur die Relaisspule; alles an 230 V macht eine Elektrofachkraft.
> - Grenzen der Technik: ein geteilter Script-Heap von etwa 25 KB, KVS mit 50 Einträgen zu je 253 Zeichen, die schmale Script-Sprache mJS, Uhrzeit nur per NTP – und ein SMT50, der 0–3 V liefert (rund 0,03 V je Prozent) und nur an einer Stelle misst.

## Voraussetzungen

- keine – ein Lesekapitel. Die Bauteile und Scripts erklärt [01 · Gesamtarchitektur](01-gesamtarchitektur.md), jedes Feld [03 · Konfiguration](03-konfiguration.md).

## Diagramm

[![Sequenz: eine Portion und ihre drei Abschaltungen – Claim im KVS, Switch.Set mit toggle_after, auto_off, Sicherheits-Aus im Zeitplan; Script stirbt; Behälter leer](../diagramme/de/04-sicherheit-und-grenzen.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/04-sicherheit-und-grenzen.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/04-sicherheit-und-grenzen.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Normale Portion“, 2 „Script stirbt mitten im Fenster“, 3 „Behälter leer während der Portion“.

## Dreifache Abschaltung der Pumpe

`bw_pump` schaltet die Pumpe je Portion mit `Switch.Set {on:true, toggle_after:<Sekunden>}` ein. Drei voneinander unabhängige Wege schalten sie wieder aus. Alle drei führt das Gerät selbst aus – auch dann, wenn das Script gerade gestorben ist.

| Ebene | Wo | Wert normal / Zeitraffer | Greift, wenn |
| --- | --- | --- | --- |
| 1 `toggle_after` im Einschaltbefehl | jeder `Switch.Set on` von `bw_pump` | höchstens `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s je Portion / <!-- zr:cfg4.tPmax -->15<!-- /zr --> s | immer – die Firmware schaltet nach Ablauf selbst ab, auch wenn das Script direkt nach dem Einschalten stirbt |
| 2 `auto_off` in der Switch-Konfiguration | `Switch.SetConfig`, setzt der Installer | `tMax` + 10 s = 190 s je Einschaltbefehl / 50 s | der Einschaltbefehl kam ohne `toggle_after` – von Hand, aus der Web-UI oder aus einem fremden Script |
| 3 Sicherheits-Aus im Zeitplan | Eintrag `0 8 8,20 * * *` mit `Switch.Set {on:false}` | 30 s + `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s + 10 s nach der Fensterminute, auf volle Minuten aufgerundet = 8 min / Minutenliste `40 2,8,14,…,56 * * * *` | die beiden oberen Ebenen falsch konfiguriert sind |

Dazu kommt `initial_state = off`: nach einem Neustart oder Stromausfall ist der Ausgang aus. Der Installer rechnet Ebene 2 aus `cfg3.tMax` und Ebene 3 aus `cfg4.tWin`; nach einer Änderung von `tMax`, `tWin`, `tTail`, `winA`/`winB`, `tick` oder `winEvery` muss er erneut laufen ([03 · Konfiguration](03-konfiguration.md)).

Die Staffelung stammt aus dem Konzept ([16 · Konzept und Entscheidungen](16-konzept-und-entscheidungen.md)). Eine Bedingung daraus hält der Installer bis heute ein: der Sicherheits-Aus liegt hinter jedem gewollten Fenster, weil er aus `tWin` gerechnet wird. Normal endet das Fenster spätestens 30 + 420 = 450 s nach der Fensterminute, der Sicherheits-Aus kommt bei 480 s; im Zeitraffer prüft der Installer zusätzlich `30 + tWin + 10` kleiner als `winEvery · 60` (160 < 360) und bricht sonst ab.

> **Am Gerät gemessen (13.09.2026):** `hwtest.js normal` fand nach dem Installer die Einträge `0 */15`, `30 0 8,20` und `0 8 8,20` sowie `auto_off 190 s`; Firmware 2.0.0 nahm die Minutenliste `40 2,8,14,20,26,32,38,44,50,56 * * * *` des Zeitraffers an; der Pumpentest lief 30 s (Konsole „Pumpe aus: ok nach 30 s“). Welche der drei Ebenen real abschaltet, wurde noch nicht einzeln ausgelöst (Script-Abbruch mitten im Fenster, `Switch.Set on` ohne `toggle_after`, Neustart) – Prüfprotokoll Zeilen 13 bis 15 `[TODO am Gerät]`; im Mock deckt `pump.test.js` den Abbruch ab.

## Frist bis zum Takt

`bw_main` und `bw_pump` teilen sich den Script-Heap und dürfen nie gleichzeitig laufen. Dafür sorgen ein Versatz und eine Frist, die zweimal geprüft wird – im Script und im Installer:

1. **Versatz:** `bw_pump` startet bei Sekunde 30 der Fensterminute (`PUMP_SEC` in `bw_install`), `bw_main` zur vollen Minute; es ist nach 5 bis 8 s fertig (13.09.2026: `dauer=5660ms`).
2. **Frist in `bw_pump`:** beim Start `B = min(tWin, tick·60 − q − tTail)` mit `q` = Sekunden seit dem letzten Takt. Normal: `min(420, 900 − 30 − 20)` = 420 s. Eine Portion startet nur, wenn `vergangen + sec + tSoak + nStab·tStep ≤ B`; sonst endet das Fenster mit `why=zeit` (vor der Erstportion ohne Claim). Die Zeit kommt aus `Shelly.getUptimeMs()`, nie aus Tick-Zählern.
3. **Installer, statisch:** `(Fensterminute mod tick)·60 + 30 + tWin + tTail ≤ tick·60`. Normal 470 ≤ 900, Zeitraffer 170 ≤ 180. Ein Fenster um 08:05 passt (770), eines um 08:10 nicht (1 070) – dann bricht der Installer mit `err.code = "cfg"` ab und nennt das Feld.

Der Mock meldet jede tatsächliche Überlappung zweier Läufe (Überlappungswächter). Ein Handstart mitten im Takt bekommt nur den Rest bis zum nächsten Takt. Der Pumpentest `bw_hwpump` hält zusätzlich eine eigene Zeitwache ein ([11 · Hardware-Check](11-hardware-check.md)).

## Abbruchsicherheit: der Claim

Vor der ersten Portion eines geregelten Fensters schreibt `bw_pump` einen **Claim** in den KVS: `st = {state:"sperre", ts:<jetzt>, why:"laeuft", …}`. Scheitert dieses Schreiben, wird nicht gepumpt (`why=kvs`). Stirbt das Script danach mitten im Fenster – `out_of_memory`, eine Ausnahme, `Script.Stop`, Stromausfall –, passiert Folgendes:

1. Die Pumpe geht über die drei Abschaltungen aus.
2. `st.why` bleibt `laeuft` (läuft). `bw_main` sieht `state=sperre` mit dem Zeitstempel des Claims und meldet `why=pause`, bis die Mindestpause abgelaufen ist; `job.ok` wird `false`.
3. Es entsteht kein Lernwert, kein `noeff`, und `day` bleibt unverändert.
4. Ein Handstart innerhalb von `jobAge` <!-- def:cfg3.jobAge -->20<!-- /def --> min gießt nicht: `Fenster abgebrochen (laeuft) – kein Auftrag`.

Die Einzelportion (Hardware-Test, Handauftrag ohne `pct`, `nPort` 1) schreibt keinen Claim; sie ist allein durch die drei Abschaltungen gedeckt. Wer den Absturz nachstellen will: Prüfprotokoll Zeile 13 ([19 · Prüfprotokoll](19-pruefprotokoll.md)).

## Harte Grenzen unabhängig vom Lernen

Der Lernwert `lrn.effW` bestimmt nur die Dosis. Alle Grenzen darunter gelten auch dann, wenn das Lernen falsch liegt:

| Grenze | Feld | Startwert | Wirkung |
| --- | --- | --- | --- |
| je Portion | `cfg4.tPmax` | <!-- def:cfg4.tPmax -->120<!-- /def --> s | Obergrenze für `toggle_after` jeder Portion; den Auftrag von `bw_main` klemmt zusätzlich `tMin` <!-- def:cfg3.tMin -->25<!-- /def --> … `tMax` |
| je Fenster | `cfg3.tMax` | <!-- def:cfg3.tMax -->180<!-- /def --> s | Summe aller Portionen; `auto_off` = `tMax` + 10 s |
| Portionen je Fenster | `cfg4.nPort` | <!-- def:cfg4.nPort -->6<!-- /def --> | danach endet das Fenster mit `max` |
| Zeitbudget je Fenster | `cfg4.tWin` | <!-- def:cfg4.tWin -->420<!-- /def --> s | Frist, endet mit `tTail` <!-- def:cfg4.tTail -->20<!-- /def --> s Reserve vor dem nächsten Takt (`zeit`) |
| Fenster je Tag | `cfg3.maxDay` | <!-- def:cfg3.maxDay -->2<!-- /def --> | danach `limit`; Tagesvorrat `maxDay × tMax − day.sec` = 360 Pumpensekunden |
| Mindestpause | `cfg3.pause` / `pauseHot` / `pauseSlow` | <!-- def:cfg3.pause -->24<!-- /def --> / <!-- def:cfg3.pauseHot -->12<!-- /def --> / <!-- def:cfg3.pauseSlow -->48<!-- /def --> h | bis dahin `why=pause` – auch nach einem abgebrochenen Fenster |
| Alter des Auftrags | `cfg3.jobAge` | <!-- def:cfg3.jobAge -->20<!-- /def --> min | älter → `alt`, keine Gabe |
| Lernwert | `cfg2.effMin` / `effMax` | <!-- def:cfg2.effMin -->0.05<!-- /def --> / <!-- def:cfg2.effMax -->30<!-- /def --> %/s | Klemme für `effW`; eine Korrekturportion rechnet nie mit weniger als `effMin` |
| Sicherheitsfaktor | `cfg2.sfMin` | <!-- def:cfg2.sfMin -->0.5<!-- /def --> | `lrn.sf` bleibt zwischen `sfMin` und 1 (Start 0,7): die Erstportion landet bewusst unter dem Ziel |

Gar nicht gegossen wird bei ungültiger Uhrzeit (`uhr`), unplausiblem Sensor (`sensor`: Spannung unter `vErrLo` <!-- def:cfg1.vErrLo -->0.10<!-- /def --> V oder über `vErrHi` <!-- def:cfg1.vErrHi -->3.35<!-- /def --> V), leerem Behälter (`wasser`), unvollständigem Zielband (`cfg`) und bei jeder stehenden blockierenden Störung (`err:<code>`). Vorrang beim Setzen: `noeff` vor `cfg` vor `uhr` vor `sensor` vor `wasser`; alle Codes erklärt [13 · Betrieb und Wartung](13-betrieb-und-wartung.md).

### Keine Wirkung heißt nie mehr Wasser

Bleibt die erste Portion ohne messbare Wirkung (Zuwachs unter `dStab` <!-- def:cfg4.dStab -->1<!-- /def --> %), folgt genau eine volle Probeportion. Bleibt auch die aus (Summe unter `dEffMin` <!-- def:cfg4.dEffMin -->2<!-- /def --> %), setzt `bw_pump` die Störung `noeff`. Sie blockiert jede Gabe, wird nie von selbst gelöscht und erzeugt keinen Lernwert. So wird ein abgerutschter Sensor nicht zum gefluteten Topf.

Erst nachdem Pumpe, Schlauch und Sensorlage geprüft sind, löscht ein Mensch den Eintrag:

```bash
curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"err"}'   # noeff zurücksetzen – vorher Pumpe, Schlauch, Sensorlage prüfen
```

Drei Nachbarn dieser Regel: bleibt eine **spätere** Portion ohne Wirkung, obwohl frühere wirkten, endet das Fenster mit `stall` (keine Störung). Liegt die Frischmessung im Fenster zwischen `pctOk` und `pctHi` – von Hand gegossen oder gedüngt –, gibt es keine Gabe (`feucht`), keinen Lernwert und keine Pause.

Liegt die Frischmessung über `pctHi`, endet das Fenster mit `nass`: `bw_pump` schreibt `st` als Sperre, die Mindestpause läuft ab jetzt (`why=pause`), und eine Trockenphase beginnt – keine Gabe, bis eine Taktmessung unter `pctDry` liegt (nach der Pause `why=trocken`).

## Strom

- Der Shelly-Ausgang OUT1 ist ein potenzialfreier Kontakt für höchstens 30 V / 300 mA. Er schaltet nur die Relaisspule (Spulenstrom unter 300 mA), nie die Pumpe.
- Arbeiten an 230 V – Gardena-Trafo, Relaiskontakt – nur durch eine Elektrofachkraft. Die Gardena-eigene Zeitschaltung bleibt aus, damit nur das Relais entscheidet.
- Shelly, Relais und Netzteil trocken und im Gehäuse (Stückliste: IP54), mit Abstand zum Wasser; Relais mit Freilaufdiode richtig polen.
- Versorgung: Netzteil 12 V DC mit mindestens 1 A. Der Shelly nimmt 9–28 V DC, der SMT50 3,3–30 V DC; die Sensormasse liegt am Netzteil-Minus.

> **Achtung (Wasser/Strom):** Vor jeder Arbeit am Aufbau alles stromlos machen. Keine blanken Adern, keine Elektronik neben dem Behälter. Details zur Verdrahtung in [05 · Verkabelung und Hardware-Aufbau](05-verkabelung-und-aufbau.md).

## Wasser

- Der Schwimmer sitzt oberhalb des Pumpeneinlaufs, damit die Pumpe nie trocken läuft. `cfg1.lvlEmpty` <!-- def:cfg1.lvlEmpty -->1<!-- /def --> ist der Eingangswert für LEER (bestätigt 13.09.2026: LEER = 1, VOLL = 0).
- Geprüft wird der Wasserstand viermal: `bw_main` in jedem Takt (`nLvl` <!-- def:cfg1.nLvl -->3<!-- /def --> gleiche Lesungen, sonst `lvl`), `bw_pump` vor jeder Portion, während der Portion alle `tChk` <!-- def:cfg3.tChk -->5<!-- /def --> s (LEER → Pumpe sofort aus, `abbruch`, `err=wasser`) und beim Einsickern und Stabilisieren (LEER → `wasser`, keine weitere Portion).
- Schläuche so führen, dass ein Defekt keinen Wasserschaden anrichtet; Behälter mit Deckel.
- Vorrat: mindestens `maxDay × tMax` = 2 × 180 s = 360 Pumpensekunden je Tag müssen sicher möglich sein. Die Fördermenge der Pumpe je Sekunde ist noch nicht gemessen `[TODO am Gerät]` (Messbecher, Stoppuhr, ein Puls mit `hwtest.js mess 10 1`).
- Nachlaufwasser: nach dem Ausschalten tropft der Schlauch weiter (Messlauf 13.09.2026: bei 3-s-Pulsen kroch die Feuchte 65 bis 162 s lang nach). Deshalb sind Portionen im Regelkreis nie kürzer als `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> s (Erstportion mindestens `tMin`), und der Sensor liegt unter dem Tropfer; nur die Einzelportion (ab 1 s) und `hwtest.js mess` dürfen kürzer sein.

## Grenzen des Shelly

| Grenze | Wert | Folge im Projekt |
| --- | --- | --- |
| laufende Scripts | höchstens 3 zugleich (Shelly-Doku) | die drei Betriebs-Scripts laufen nie gleichzeitig; Test-Scripts starten nur von Hand |
| offene RPC-Aufrufe, Timer | je 5 je Script | jedes Script hält genau einen offen |
| Script-Heap | etwa 25 KB, von allen Scripts geteilt (`mem_free` 24 920 bis 25 200 B im Leerlauf) | zwei große Scripts zugleich enden mit `out_of_memory`; `bw_pump` braucht im Fenster <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B Code und bis 12 516 B Heap, `bw_main` 5 348 B beim Parsen – deshalb Versatz und Frist |
| Codegröße | `dist/` ≤ <!-- fact:size_limit -->16 000<!-- /fact --> B je Script, `bw_pump` ≤ <!-- fact:size_limit_pump -->18 000<!-- /fact --> B (`size.test.js`) | `bw_main` liegt bei <!-- fact:dist.bw_main -->15 791<!-- /fact --> B – vor Erweiterungen kürzen oder teilen |
| Aufruftiefe | 12 Ebenen laufen, 14 stürzen ab („Too much recursion“); Mock-Grenze <!-- fact:call_depth -->10<!-- /fact --> | flache Schrittkette `next()`, nur benannte Callbacks |
| KVS | 50 Schlüssel, Schlüssel ≤ 42 Zeichen, Wert ≤ 253 Zeichen; `KVS.GetMany` liefert 11 je Seite | 9 Betriebseinträge plus Test- und Zeitraffer-Einträge; `kvs-size.test.js` prüft die Länge; keine Messhistorie am Gerät (dafür braucht es ein Backend) |
| Flash | `fs_free` 12 288 B mit sieben Scripts, 49 152 B ohne die drei Test-Scripts, 40 960 B nach dem Upload von `bw_pump` (4-KB-Blöcke) | Test-Scripts vor einem Upload löschen; `put-script.js` prüft den Platz. Jeder KVS-Schreibvorgang geht auf den Flash: nur bei Änderung schreiben, 15 bis 22 je Gießtag (Budget ≤ 24) |
| Zeitplan | 20 Einträge, 5 Aufrufe je Eintrag; sechs Cron-Felder mit Sekunde | der Installer legt 3 Einträge an (bis zu 5, wenn `winA` und `winB` verschiedene Minuten haben) |
| Uhrzeit | nur per NTP; ohne gültige Zeit läuft kein Zeitplan | solange das Gerät läuft, hält es die Zeit auch ohne Internet; nach einem Stromausfall ohne Internet steht der Zeitplan still, bis NTP wieder erreichbar ist – kein Takt, keine Konsolenzeile; `err=uhr` setzt nur ein Handstart von `bw_main`. Fenster sind Ortszeit: Zeitzone im Gerät prüfen |
| Script-Sprache mJS | kein `const`, keine Klassen, keine Promises, kein Hoisting, kein `Date`; Array-Methoden nur `push`, `slice`, `splice`, `indexOf`, `join`; mehr als zwei bis drei verschachtelte anonyme Funktionen stürzen ab | `syntax.test.js` erzwingt die Regeln; Messwerte und RPC-Details in [20 · RPC-Referenz](20-rpc-referenz.md) |
| Analogeingang | Bereich 0–15 V (oder 0–30 V) für ein Nutzsignal von 0–3 V; Werte in Stufen von rund 0,3 % | `nSample` <!-- def:cfg1.nSample -->5<!-- /def --> Messungen je Takt (Mittel der mittleren Werte, im Fenster der Median), Hysterese `hyst` <!-- def:cfg2.hyst -->2<!-- /def --> % |
| Konsole | mehr als etwa 15 `print`-Zeilen am Stück gehen im Debug-Websocket verloren; der Websocket muss eingeschaltet sein | eine Zeile je Takt bzw. je Portion; Diagnose per `console.js` oder `hwtest.js watch` |
| CPU | ein 1-s-Tick mit `getComponentStatus` kostet 12–17 % (Firmware-Log) | `bw_main` fragt so nur 2,5 s je Takt ab (`msSample` <!-- def:cfg1.msSample -->500<!-- /def --> ms), `bw_pump` nur im Fenster (höchstens `tWin` s, zweimal täglich); die Hardware-Test-Scripts ticken minutenlang so und starten nur von Hand |

## Grenzen des SMT50

**Signal und Skala.** Der SMT50 liefert die Bodenfeuchte als 0–3 V auf der gelben Ader `[TODO laut Datenblatt]`; laut Datenblatt entsprechen 3 V etwa 50 Volumenprozent (Herstellerformel `Vol.-% = V × 50 / 3`), Genauigkeit ±3 % im Referenzboden. Das Projekt rechnet nicht in Volumenprozent, sondern relativ zu `cfg1`: 0 % = `vDry` (Sensor trocken in Luft, 13.09.2026: 0,296 V), 100 % = `vWet` (Sensor im Wasser, 3,134 V). 100 % ist ein Kalibrierpunkt, nie ein Zielwert.

Eine neue Kalibrierung verschiebt die Prozentskala und damit das Zielband. `lrn.effW` ist danach ungültig: löschen (Rückfall auf `tStd` <!-- def:cfg3.tStd -->70<!-- /def --> s) oder den Kalibrierlauf wiederholen ([12 · Erstinbetriebnahme](12-erstinbetriebnahme.md)).

| Grenze | Was der Sensor kann | Was das Projekt daraus macht |
| --- | --- | --- |
| Auflösung | rund 0,03 V je Feuchteprozent am 0–15-V-Eingang; Einzelwerte streuen | `nSample` 5 Werte je Messung, Hysterese 2 %, Stabilität in `dStab` 1 % |
| Plausibilität | ein abgerissenes Kabel liefert 0 V und sähe wie „völlig trocken“ aus | unter `vErrLo` 0,10 V oder über `vErrHi` 3,35 V: `err=sensor`, keine Gabe |
| Ansprechzeit | Messlauf 13.09.2026: erste Reaktion (`tRise`) nach 5 bis 8 s bei vollem Schlauch; ein 10-s-Puls stieg ab 7,9 s, Spitze 5 s nach Pumpe-aus (+11,6 % = 5,6 % je wirksame Sekunde); 3-s-Pulse füllten nur den Schlauch | `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s, `tPmin` 10 s, `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s, `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s; Portionen nie kürzer als die Totzeit. Fenster 1 im Zeitraffer maß `tRise` 8 s und 5 s |
| ein Messpunkt | der Sensor misst nur dort, wo er steckt: unter dem Tropfer ist das der nasseste Punkt des Topfs | Zielband und Lernwert gelten für diese Stelle; ein verrutschter Sensor endet in `noeff` oder im Hinweis `sink` (`dropW`) |
| Temperatur, Dünger | Bodentemperatur und Salzgehalt (Düngen) können den Messwert verschieben – Größe laut Datenblatt prüfen `[TODO laut Datenblatt]` | eine Frischmessung im Fenster zwischen `pctOk` und `pctHi` gilt als `feucht` (keine Gabe), darüber als `nass` (Trockenphase); die Kontrolle über `pctHi + hyst` senkt `sf` |
| zweiter Ausgang | die grüne Ader `[TODO laut Datenblatt]` liefert die Bodentemperatur | bleibt frei – der Shelly Plus Uni hat nur einen Analogeingang; Temperatur kommt vom DS18B20 |

### Ein Sensor, mehrere Tropfer

Der Regelkreis misst nur am Sensor. Weitere Tropfer am selben Verteiler werden blind mitversorgt; sie sollten baugleich sein und in Töpfen mit gleicher Erde und Größe stecken, sonst bekommt eine Pflanze zu viel oder zu wenig.

Jede Portion ist ein Schaltspiel des Relais – bis zu `nPort` 6 je Fenster, bei `maxDay` 2 also bis zu 12 am Tag. Zwischen zwei Portionen liegen mindestens `tSoak` 20 s Einsickern und die Stabilisierungsmessung (`nStab` <!-- def:cfg4.nStab -->4<!-- /def --> Werte im Abstand `tStep` <!-- def:cfg4.tStep -->5<!-- /def --> s). Die Herstellergrenzen von Relais und Pumpe für Schaltspiele und Mindestpausen sind nicht nachgeschlagen `[TODO laut Datenblatt]`. Die Firmware meldet bei Portionen im Abstand unter 60 s `PCS write interval < 60s` – ein Hinweis auf das Zählerschreiben des Switch, kein Fehler.

## Beispielausgabe

Fenster 1 des Zeitraffers am 13.09.2026, 15:54 (`hwtest.js kal 780`, Statuszeilen von `watch` alle 5 s, Auszug). Die Statuszeile zeigt `st=sperre/laeuft` vom Claim bis zum Fensterende – auch zwischen den Portionen bei `sw=aus`; das `sw=aus` in der dritten Statuszeile ist das Ende der 12-s-Portion (Firmware-`toggle_after` und das `Switch.Set off` des Scripts fallen hier zusammen); `Frist 120 s` ist das Zeitraffer-Budget, `dauer=100199` ms blieb darunter:

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

Die drei Abschaltungen am Gerät nachsehen – drei RPC-Aufrufe, die keine Konfiguration ändern:

```bash
curl -s "http://<ip>/rpc/Schedule.List"           # Sicherheits-Aus: timespec "0 8 8,20 * * *" mit Switch.Set on:false
curl -s "http://<ip>/rpc/Switch.GetConfig?id=0"   # auto_off true, auto_off_delay 190, initial_state off
curl -s "http://<ip>/rpc/Switch.GetStatus?id=0"   # während einer Portion: output true, timer_duration = Sekunden der Portion
```

Antworten aus dem Mock (`node tools/run-script.js scripts/bw_install.js`, danach `Switch.Set` mit `toggle_after` 25 s); die Feldnamen entsprechen der Shelly-Doku ([20 · RPC-Referenz](20-rpc-referenz.md)). Am Gerät bestätigt (13.09.2026): die drei Zeitplan-Einträge und `auto_off 190 s`; die IDs vergibt das Gerät.

```json
{"jobs":[{"id":1,"enable":true,"timespec":"0 */15 * * * *","calls":[{"method":"Script.Start","params":{"id":2}}]},{"id":2,"enable":true,"timespec":"30 0 8,20 * * *","calls":[{"method":"Script.Start","params":{"id":3}}]},{"id":3,"enable":true,"timespec":"0 8 8,20 * * *","calls":[{"method":"Switch.Set","params":{"id":0,"on":false}}]}],"rev":3}
{"id":0,"name":null,"initial_state":"off","auto_off":true,"auto_off_delay":190,"auto_on":false,"auto_on_delay":0}
{"id":0,"source":"script","output":true,"temperature":{"tC":40,"tF":104},"timer_started_at":1789192800,"timer_duration":25}
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| Ausgang bleibt nach dem Fenster EIN | Einschaltbefehl ohne `toggle_after` (Hand, Web-UI) und `auto_off` nicht gesetzt – der Installer ist nie gelaufen | Not-Aus: `node tools/hwtest.js <ip> stop` oder OUT1 in der Web-UI; `Switch.GetConfig` prüfen, Installer starten |
| `why=zeit`, Konsole `Frist zu kurz für P1` | Handstart mitten im Takt, oder `tWin`/`tTail` passen nicht zum Takt | `bw_pump` im Fenster starten; Installer prüft die Regel und nennt das Feld |
| `st.why=laeuft` bleibt stehen, nächster Takt `why=pause`, kein Lernwert | Script mitten im Fenster gestorben (`out_of_memory`, Ausnahme, `Script.Stop`, Strom) | `Script.GetStatus` → `errors` lesen; die Pumpe ist über die Abschaltungen aus; nach der Pause läuft es normal weiter. Bei `out_of_memory`: kein zweites großes Script neben `bw_pump` |
| `err=noeff` bleibt stehen | zwei volle Portionen ohne messbare Wirkung | Pumpe, Schlauch, Sensorlage prüfen, dann `err` löschen (Befehl oben) |
| `err=wasser`, Behälter ist voll | `cfg1.lvlEmpty` passt nicht zum Schwimmer, oder der Schwimmer klemmt | Schwimmer bewegen; Hardware-Test Phasen l1/l2 ([11 · Hardware-Check](11-hardware-check.md)) |
| keine Takt-Zeile nach einem Stromausfall; `err=uhr` nach einem Handstart von `bw_main` | kein NTP – Uhrzeit ungültig, Zeitplan steht | WLAN und Internet prüfen; mit gültiger Zeit läuft der Zeitplan von selbst weiter |
| `err=sensor` | Spannung außerhalb 0,10–3,35 V: Kabel, Stecker, Sensor in Luft statt Erde | Verdrahtung und Sensorlage prüfen; löscht sich selbst |
| Installer: `passen nicht in den Takt` | die Fensterminute liegt zu weit hinter dem Takt (`(Minute mod tick)·60 + 30 + tWin + tTail > tick·60`) oder `tWin` ist zu groß | Fenster näher an :00/:15/:30/:45 legen (mit `tWin` 420 passen bis zu 7 min danach) oder `tWin` kürzen, Installer erneut starten |
| `Script.GetStatus` meldet `out_of_memory` | zwei große Scripts liefen gleichzeitig (Test-Script neben `bw_pump`) | Test-Scripts nur einzeln; Pumpentest in zwei Durchgängen; Heap mit `hwtest.js scripts` messen |
| `ergebnis=extern` | der Ausgang war beim Start schon EIN oder wurde während der Portion von außen ausgeschaltet | nachsehen, wer OUT1 schaltet (Web-UI, Hand, andere Automation); das Fenster endet ohne weitere Portion |

## Weiter zu

- [05 · Verkabelung und Hardware-Aufbau](05-verkabelung-und-aufbau.md) – die Strom- und Wasserregeln von hier in den Aufbau übersetzen.
- [13 · Betrieb und Wartung](13-betrieb-und-wartung.md) – Codes deuten, Störungen beheben, Behälter und Schlauch pflegen.
