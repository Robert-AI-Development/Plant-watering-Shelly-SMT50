# 03 · Konfigurations-Zusammenspiel (Parameter-Referenz)

**Deutsch** · [English](../en/03-konfiguration.md) — [Handbuch](README.md) · Teil A „Verstehen“

> **Auf einen Blick**
> - Alles Wissen liegt im KVS des Shelly: `cfg1`–`cfg4` sind Einstellungen, `lrn` Lernwerte, `st`, `job`, `day`, `err` Zustand. Die Scripts enthalten keine Schwellen, Zeiten oder Grenzen.
> - Jeder KVS-Wert ist ein JSON-String. Der Installer `bw_install` legt fehlende Einträge und Felder mit dem Startwert an und überschreibt nie einen vorhandenen Wert.
> - Nach einer Änderung von `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin`, `tTail` oder `cfg1.idSw` einmal `bw_install` starten – nur daraus entstehen Zeitplan, Sicherheits-Aus und `auto_off`. Alle anderen Felder wirken ab dem nächsten Takt.
> - Wichtigste Zahlen: Takt <!-- def:cfg3.tick -->15<!-- /def --> min, Budget je Fenster <!-- def:cfg4.tWin -->420<!-- /def --> s, Summe je Fenster <!-- def:cfg3.tMax -->180<!-- /def --> s, `auto_off` = `tMax` + 10 = 190 s.
> - Größter Stolperstein: Das Zielband `cfg2` bleibt nach der Installation `null` – bis alle sechs Bandfelder (auch `pctOk`) gesetzt sind, misst das Gerät nur (`why=cfg`).

## Voraussetzungen

- keine – ein Lesekapitel. Wer Werte ändern will, braucht die Web-UI des Shelly (Settings → Key-Value Storage) oder `curl` gegen `http://<ip>/rpc`.
- Nützlich vorher: [01 · Gesamtarchitektur](01-gesamtarchitektur.md) (was `bw_main`, `bw_pump` und der Installer tun) und [02 · Flussdiagramm](02-flussdiagramm.md) (wann welcher Wert greift).

## Diagramm

[![Wer liest und schreibt welche KVS-Einträge: Installer, Werkzeuge und Mensch schreiben cfg1–cfg4, bw_main liest cfg1–cfg3 je Takt und schreibt job, st, day, err und lrn, bw_pump liest alle vier im Fenster und schreibt st, day, err und lrn](../diagramme/de/03-konfiguration.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/03-konfiguration.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/03-konfiguration.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Einstellungen cfg1–cfg4“, 2 „Auftrag und Ergebnis“, 3 „Lernen“, 4 „Werkzeuge schreiben Kalibrierung“. Im Bild stehen `cfg3` und `cfg4` in einem Kasten; `day` und `err` teilen sich den Kasten mit `st`. Von den Einstellungen führt im Bild nur `cfg3 · cfg4` einen Pfeil zu `bw_pump` – dass es auch `cfg1` und `cfg2` liest, sagt sein Untertitel „Fenster: liest cfg1–cfg4“; die Matrix und die Tabellen unten führen jedes Feld einzeln.

## Grundregeln

Die Scripts lesen ihre Einträge bei jedem Start neu und halten nichts im RAM. Eine Änderung im KVS wirkt deshalb spätestens beim nächsten Takt von `bw_main` (alle `cfg3.tick` Minuten) bzw. beim nächsten Gießfenster von `bw_pump`.

| Regel | Was sie bedeutet | Quelle |
| --- | --- | --- |
| JSON-Strings | Jeder Wert wird mit `JSON.stringify` geschrieben und mit `JSON.parse` gelesen. Die Web-UI kann nur Strings anzeigen; ein String, der kein JSON-Objekt ergibt, gilt als fehlend und wird vom Installer ersetzt (Konsole: `KVS cfg2 kein Objekt, neu angelegt`; unlesbarer Text nur in der Schlusszeile `KVS neu angelegt: …`); ein Objektwert bleibt stehen (siehe Typische Fehler) | `fromKvs()` in allen Scripts, Entscheidung 15/16 |
| Installer überschreibt nie | `bw_install` schreibt einen Eintrag nur, wenn er fehlt, und ergänzt in vorhandenen Einträgen nur fehlende Felder (`KVS cfg3 ergänzt: dryDay`). Eigene Werte überleben jede Neuinstallation und jedes Script-Update | `stepDefaults()` in `bw_install.js` |
| Einzige Ausnahme | Nach einem Zeitraffer findet der Installer die Sicherung `zrb1` ohne Marke `zr` und schreibt das gesicherte Original zurück (Kapitel 12) | `stepZr()` |
| Pflichtfelder | Fehlt ein Pflichtfeld oder ist das Band ungeordnet, setzt das Script `err.code = "cfg"` und gießt nicht; die Konsole nennt das Feld (`cfg3.tick fehlt`) | `REQ1`–`REQ4` in `bw_main.js`, `bw_pump.js` |
| Installer erneut starten | nach `cfg3.tick`, `winEvery`, `winA`, `winB`, `tMax`, nach `cfg4.tWin`, `tTail` und nach `cfg1.idSw` – daraus baut er Zeitplan, Sicherheits-Aus und `auto_off`. Er bricht ab, solange `bw_main` oder `bw_pump` läuft; `node tools/hwtest.js <ip> normal 60` wartet einen sicheren Moment ab | `stepSchedCreate()`, `stepSwitchCfg()` |
| Nur Änderungen schreiben | `bw_main` und `bw_pump` schreiben einen Eintrag nur, wenn sich sein JSON geändert hat: höchstens 24 Schreibvorgänge je Tag, im Schnitt unter 18 (Prüfung in `szenario.test.js`) | `stepWrite()` |
| Grenzen des KVS | 50 Schlüssel, Schlüssel ≤ 42 Zeichen, Wert ≤ 253 Zeichen. Das Projekt belegt höchstens 21 Schlüssel (9 Betrieb + 6 Zeitraffer + 6 Hardware-Test); `kvs-size.test.js` prüft die Wertlängen. Deshalb sind Zeiten und Fenster auf `cfg3` und `cfg4` verteilt | Shelly-Doku, Entscheidung 53 |

> **Hinweis:** `KVS.Set` ersetzt immer den ganzen Eintrag. Ein Teilobjekt (nur `vDry`/`vWet`, nur das Band) ist deshalb nur *vor* dem Installer sinnvoll – er ergänzt den Rest. Später ein einzelnes Feld ändern: Web-UI mit „Format as JSON“, oder nach einem Teil-Schreiben den Installer erneut starten.

Herkunft der Felder: der Feldkatalog des Umsetzungsplans (Kapitel 16), ergänzt um Entscheidungen aus dem Entscheidungslog (Kapitel 17) – `cfg1.msSample` und die vier ID-Felder, `cfg2.sfMin`/`sfStep`, `cfg3.tChk`, `lrn.sf` sowie `tMaxD`/`tMaxY` statt eines gespeicherten `tMax24`, `cfg4` als eigener Schlüssel (Etappe 10). Der Installer setzt für `bw_main` und `bw_pump` bewusst keinen Autostart: der Zeitplan startet sie, ein Autostart nach Neustart könnte außerhalb der Fenster gießen.

## Wer liest, wer schreibt

L = liest, S = schreibt, „legt an“ = nur wenn der Eintrag oder das Feld fehlt. `bw_main` liest alle Einträge per `KVS.GetMany`, `bw_pump` genau neun Schlüssel per `KVS.Get` (`cfg1`–`cfg4`, `lrn`, `st`, `job`, `day`, `err`), damit keine Sicherungen im knappen Script-Heap liegen.

| Eintrag | `bw_install` | `bw_main` | `bw_pump` | `bw_hwtest` / `bw_hwpump` | `bw_zeitraffer` | Werkzeuge (`hwtest.js`) | Mensch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cfg1` | legt an; L `idSw` | L | L | S `vDry`, `vWet`, `lvlEmpty` (bei `hwt.cal` 1) / L | L (muss vorhanden sein) | `report` vergleicht | S (Kalibrierpunkte, IDs) |
| `cfg2` | legt an (`pctOk`, Band `null`) | L | L | – | S `pctDry` = `pctLo` − 1, Sicherung `zrb5` | `zeitraffer` prüft das Band | S (Zielband) |
| `cfg3` | legt an; L `tick`, `winEvery`, `winA`, `winB`, `tMax` | L | L | L `tMax`, `maxDay`, `winA`, `winB` (`bw_hwpump`) | S Profil `ZR3`, Sicherung `zrb1` | `kal write` S `tDead`, `tMin` | S (Zeiten, Fenster) |
| `cfg4` | legt an; L `tWin`, `tTail` | – | L | – | S Profil `ZR4`, Sicherung `zrb4` | `kal write` S `tDead2` | S (Fenster-Regelkreis) |
| `lrn` | legt an (`effW` `null`, `sf` 0.7) | L, S `tMaxD`, `tMaxY`, `tMean`, `rate`, `sf` (Kontrolle `zuviel`) | L, S `effW`, `sf` | sichert nach `hwb2`, stellt zurück | setzt frisch, Sicherung `zrb2` | `kal write` S `effW`; `restore` | `effW` löschen nach neuer Kalibrierung |
| `st` | legt an | L, S (Kontrolle, Trockenphase, Pause) | L, S (Claim `laeuft`, Ergebnis) | sichert nach `hwb1`, stellt zurück | setzt frisch, Sicherung `zrb3` | `restore`; `watch` zeigt | nur lesen |
| `job` | legt an (`why` `init`); frisch nach dem Zeitraffer | S (Auftrag), L (Hysterese) | L, S `ok` false, `why` = Ergebnis | S Testauftrag (`bw_hwpump`), Sicherung `hwb2` | setzt frisch | `restore` | selten: Handauftrag |
| `day` | legt an | L, S (Tageswechsel) | L, S `n`, `sec` | sichert nach `hwb1`; setzt bei Tageslimit zurück | setzt frisch, Sicherung `zrb2` | `restore` | nur lesen |
| `err` | S `cfg` bei Abbruch | L, S | L, S | S `code` `null` vor dem Test, Sicherung `hwb2` | setzt frisch, Sicherung `zrb3` | `restore` | löschen bei `noeff` |

`bw_main` liest `cfg4` nicht: der Fenster-Regelkreis gehört allein `bw_pump`. Umgekehrt braucht `bw_pump` aus `cfg3` nur `tDead`, `tMin`, `tMax`, `jobAge`, `maxDay`, `tChk` und `tick`.

## Die zehn wichtigsten Stellschrauben

Alle stehen in `cfg2` und `cfg3`; Feinheiten des Fensters (Portionen, Einsickern, Stabilität) liegen in `cfg4`.

| Feld | Frage | Wirkung | Installer danach? |
| --- | --- | --- | --- |
| `cfg2.pctLo` | *wann?* | darunter entsteht ein Gießauftrag; höher = früher gießen | nein |
| `cfg2.pctOk` | *bis wohin?* | das Fenster endet ohne weitere Portion, sobald die stabile Feuchte diesen Wert erreicht | nein |
| `cfg2.pctSoll` | *wie viel?* | Zielpunkt der Dosisrechnung für Erst- und Korrekturportion | nein |
| `cfg2.pctHi` | Bremse | im Fenster darüber `over` (Sicherheitsfaktor sinkt); in der Taktmessung darüber gilt der Topf als nass → Trockenphase | nein |
| `cfg2.pctDry` | Ende der Trockenphase | gegossen wird wieder, sobald eine Taktmessung darunter liegt | nein |
| `cfg3.winA`, `winB` | *zu welcher Uhrzeit?* | die zwei Gießfenster (Ortszeit); `bw_pump` startet bei Sekunde 30 der Minute | **ja** |
| `cfg3.tMax` | Notbremse | Summe aller Portionen eines Fensters; `auto_off` = `tMax` + 10 s | **ja** |
| `cfg3.maxDay` | Fenster je Tag | mehr Fenster → `why=limit`; Tagesvorrat = `maxDay` × `tMax` Pumpensekunden | nein |
| `cfg3.dryDay` | Trockentag | Wochentag, ab dem nicht gegossen wird, bis die Feuchte unter `pctDry` lag (`null` = nie) | nein |
| `cfg3.tHot`, `pauseHot`, `pause` | Hitzeregel, Ruhezeit | Mindestpause nach jeder Gabe; bei Tagesmaximum über `tHot` nur `pauseHot` (beide Fenster möglich) | nein |

## cfg1 – Sensor und Kalibrierung

Liest `bw_main` und `bw_pump` (Messung, Wasserstand, Komponenten), der Installer braucht `idSw` für Zeitplan und Switch-Konfiguration. `bw_hwtest` schreibt die gemessenen Kalibrierpunkte selbst.

> **Am Gerät gemessen (13.09.2026):** `vDry` 0,296 V, `vWet` 3,134 V (per `bw_hwtest` automatisch geschrieben), `lvlEmpty` 1 bestätigt (Schwimmer LEER = 1, VOLL = 0, 8 Eingangswechsel).

<!-- tabelle:cfg1 -->

| Feld | Startwert | Wirkung | Wann ändern | Installer danach? |
| --- | --- | --- | --- | --- |
| `vDry` | <!-- def:cfg1.vDry -->0.20<!-- /def --> V | Spannung des Sensors trocken in Luft = 0 % | nach dem Hardware-Check (Kapitel 11) oder von Hand am Voltmeter abgelesen | nein |
| `vWet` | <!-- def:cfg1.vWet -->3.13<!-- /def --> V | Spannung im Wasser = 100 %; muss größer als `vDry` sein, sonst `err=cfg` | wie `vDry` | nein |
| `vErrLo` | <!-- def:cfg1.vErrLo -->0.10<!-- /def --> V | darunter Störung `sensor` (abgerissenes Kabel sieht wie „trocken“ aus) | nur bei anderem Sensor | nein |
| `vErrHi` | <!-- def:cfg1.vErrHi -->3.35<!-- /def --> V | darüber Störung `sensor` | nur bei anderem Sensor | nein |
| `nSample` | <!-- def:cfg1.nSample -->5<!-- /def --> | Messungen je Ablesung: `bw_main` nimmt das Mittel der mittleren Werte (Minimum und Maximum fallen weg), `bw_pump` den Median | bei unruhigen Werten erhöhen | nein |
| `msSample` | <!-- def:cfg1.msSample -->500<!-- /def --> ms | Abstand zweier Messungen; zugleich Tick des Fenster-Automaten in `bw_pump` | selten | nein |
| `lvlEmpty` | <!-- def:cfg1.lvlEmpty -->1<!-- /def --> | Wert des Wasserstand-Eingangs, der LEER bedeutet | wenn der Schwimmer andersherum schaltet (`bw_hwtest` misst es) | nein |
| `nLvl` | <!-- def:cfg1.nLvl -->3<!-- /def --> | gleiche Lesungen in Folge, damit ein Wasserstand gilt (entprellt); `bw_pump` versucht bis zu 4 × `nLvl` Ticks, sonst `lvl` bzw. `wasser` | selten | nein |
| `idV` | <!-- def:cfg1.idV -->100<!-- /def --> | ID der Voltmeter-Komponente (`voltmeter:100`) | wenn die Web-UI eine andere ID zeigt | nein |
| `idT` | <!-- def:cfg1.idT -->100<!-- /def --> | ID des DS18B20 (`temperature:100`) | wie `idV` | nein |
| `idLvl` | <!-- def:cfg1.idLvl -->1<!-- /def --> | ID des Eingangs für den Schwimmer (`input:1` = Klemme IN2) | anderer Eingang | nein |
| `idSw` | <!-- def:cfg1.idSw -->0<!-- /def --> | ID des Switch für die Pumpe (`switch:0` = OUT1); Zeitplan-Aus und `auto_off` gehen auf diese ID | anderer Ausgang | **ja** |

<!-- /tabelle -->

> **Achtung (Wasser/Strom):** Neue `vDry`/`vWet` verschieben die Prozentskala. Ein vorher gelernter `lrn.effW` passt dann nicht mehr: `effW` auf `null` setzen (Rückfall auf `tStd`) oder `kal write` wiederholen – sonst dosiert das Gerät mit einer falschen Wirkung je Sekunde.

## cfg2 – Zielband und Lernen

Ordnung des Bands: `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` und `pctLo + hyst < pctOk`. Verstößt ein Wert dagegen, meldet `bw_main` `err.code = "cfg"` und schreibt keinen Auftrag. Solange eines der sechs offenen Felder `null` ist, misst das System nur (`why=cfg`) – das ist nach der Installation der Normalzustand.

Zwei Bezugsgrößen: `pctLo`, `pctDry` und die Trockenphase-Schwelle `pctHi` gelten für die **Taktmessung** (Sensor im Topf, 15-min-Takt). `pctOk`, `pctSoll`, `pctHi` als Fenstergrenze und `lrn.effW` gelten für die **stabilisierte Ablesung im Gießfenster** (Sensor unter dem Tropfer, nach `tSoak`).

> **Hinweis:** Beispielband am Gerät (13.09.2026) in Bandordnung `pctDry` 28 < `pctLo` 40 < `pctOk` 50 ≤ `pctSoll` 55 < `pctHi` 60, `dropSlow` 4. Die richtigen Schwellen für die eigene Pflanze entstehen bei der Erstinbetriebnahme (Kapitel 12) `[TODO am Gerät]`.

<!-- tabelle:cfg2 -->

| Feld | Startwert | Zeitraffer | Wirkung | Wann ändern | Installer danach? |
| --- | --- | --- | --- | --- | --- |
| `pctDry` | <!-- def:cfg2.pctDry -->null<!-- /def --> | <!-- zr:cfg2.pctDry -->pctLo − 1<!-- /zr --> | Ende der Trockenphase: gegossen wird wieder, sobald eine Taktmessung darunter liegt (Beispiel 28) | mit dem Band | nein |
| `pctLo` | <!-- def:cfg2.pctLo -->null<!-- /def --> | – | Untergrenze: darunter entsteht ein Gießauftrag, ab `pctLo` heißt es `feucht`; ein laufender Auftrag hält bis `pctLo + hyst` (Beispiel 40) | mit dem Band | nein |
| `pctOk` | <!-- def:cfg2.pctOk -->null<!-- /def --> | – | „Ziel erreicht“: das Fenster endet ohne weitere Portion ab diesem Wert; Frischmessung `m0` ≥ `pctOk` → `feucht` (Beispiel 50). Nach einem Update von 0.1.x legt der Installer das Feld nur mit `null` an – Wert von Hand eintragen | mit dem Band | nein |
| `pctSoll` | <!-- def:cfg2.pctSoll -->null<!-- /def --> | – | Zielpunkt der Dosisrechnung: Erstportion `(pctSoll − pct) / effW · sf + tDead` (Beispiel 55) | mit dem Band | nein |
| `pctHi` | <!-- def:cfg2.pctHi -->null<!-- /def --> | – | im Fenster darüber `over` (`sf` sinkt nur, wenn schon Portion 1 darüber lag); Taktmessung darüber = nass → Trockenphase (Beispiel 60) | mit dem Band | nein |
| `hyst` | <!-- def:cfg2.hyst -->2<!-- /def --> % | – | Hysterese: Auftrag hält bis `pctLo + hyst`; die Kontrolle meldet `zuviel` erst über `pctHi + hyst` | selten | nein |
| `dropSlow` | <!-- def:cfg2.dropSlow -->null<!-- /def --> %/24 h | – | trocknet die Erde langsamer als das, gilt `pauseSlow` (Staunässe-Verdacht); braucht 24 h Messreihe seit der Kontrolle (Beispiel 4) `[TODO am Gerät]` | an der Pflanze messen | nein |
| `dropW` | <!-- def:cfg2.dropW -->null<!-- /def --> % | – | Abfall von der letzten Fensterablesung bis zur Kontrolle über `dropW` → Hinweis `sink`; `null` = aus | erst wenn der Drain am Aufbau bekannt ist | nein |
| `effMin` | <!-- def:cfg2.effMin -->0.05<!-- /def --> %/s | – | Boden für die Wirkung je wirksamer Pumpensekunde; Korrekturportionen rechnen nie mit weniger | selten | nein |
| `effMax` | <!-- def:cfg2.effMax -->30<!-- /def --> %/s | – | Plausibilitätsgrenze des Lernwerts `effW` (Messlauf 13.09.2026: 5,6 %/s) | selten | nein |
| `alpha` | <!-- def:cfg2.alpha -->0.3<!-- /def --> | – | Gewicht des neuen Fensterwerts beim Lernen: `effW` = 0,7 · alt + 0,3 · neu; das erste Fenster nimmt den Messwert direkt | selten | nein |
| `sfMin` | <!-- def:cfg2.sfMin -->0.5<!-- /def --> | – | Untergrenze des Sicherheitsfaktors `lrn.sf` | selten | nein |
| `sfStep` | <!-- def:cfg2.sfStep -->0.1<!-- /def --> | – | Schritt, um den `sf` sinkt: Portion 1 endet mit `over`, oder die Kontrolle meldet `zuviel` | selten | nein |
| `sfUp` | <!-- def:cfg2.sfUp -->0.05<!-- /def --> | – | Schritt, um den `sf` steigt (höchstens 1), wenn das Fenster erst nach Korrekturportionen mit `ok` endet; fehlt das Feld, steigt `sf` nie | selten | nein |

<!-- /tabelle -->

Der Zeitraffer sichert `cfg2` nach `zrb5` und setzt nur `pctDry` auf `pctLo − 1`: Die Trockenphase endet dann, sobald die Erde trocken genug für einen Auftrag ist. Die übrigen Felder bleiben, wie sie sind.

## cfg3 – Pumpe und Zeiten

Liest `bw_main` (alle Felder außer `winEvery`, `dryDay` sind Pflicht), `bw_pump` (`tDead`, `tMin`, `tMax`, `jobAge`, `maxDay`, `tChk`, `tick`) und der Installer (`tick`, `winEvery`, `winA`, `winB`, `tMax`). Die Spalte „Zeitraffer“ zeigt das Profil `ZR3` aus `bw_zeitraffer.js`; `winA`/`winB` bleiben im Zeitraffer unverändert.

<!-- tabelle:cfg3 -->

| Feld | Startwert | Zeitraffer | Wirkung | Wann ändern | Installer danach? |
| --- | --- | --- | --- | --- | --- |
| `tick` | <!-- def:cfg3.tick -->15<!-- /def --> min | <!-- zr:cfg3.tick -->3<!-- /zr --> | Arbeitstakt von `bw_main` (Zeitplan `0 */tick * * * *`); Teiler von 60; Pausentoleranz und Frist rechnen damit | selten | **ja** |
| `winA` | <!-- def:cfg3.winA -->"08:00"<!-- /def --> | unverändert | erstes Gießfenster (Ortszeit, `HH:MM`); `bw_pump` startet bei Sekunde 30, nie neben `bw_main` | andere Gießzeit | **ja** |
| `winB` | <!-- def:cfg3.winB -->"20:00"<!-- /def --> | unverändert | zweites Gießfenster | andere Gießzeit | **ja** |
| `winEvery` | <!-- def:cfg3.winEvery -->null<!-- /def --> | <!-- zr:cfg3.winEvery -->6<!-- /zr --> min | `null` = Fenster bei `winA`/`winB`; Zahl N = `bw_pump` alle N Minuten und Sicherheits-Aus als Minutenliste (nur Zeitraffer); Teiler von 60 | nie von Hand | **ja** |
| `jobAge` | <!-- def:cfg3.jobAge -->20<!-- /def --> min | <!-- zr:cfg3.jobAge -->5<!-- /zr --> | älter darf der Auftrag im Fenster nicht sein (`err=alt`); so lange sperrt auch ein abgebrochenes Fenster (`st.why=laeuft`); muss über `tick` + 0,5 min bleiben | nur mit `tick` | nein |
| `soak` | <!-- def:cfg3.soak -->30<!-- /def --> min | <!-- zr:cfg3.soak -->0.25<!-- /zr --> | Wartezeit nach dem Fensterende bis zur Kontrolle durch `bw_main` (`zuviel`, `sink`) | Einsickerzeit der Erde | nein |
| `tDead` | <!-- def:cfg3.tDead -->20<!-- /def --> s | <!-- zr:cfg3.tDead -->2<!-- /zr --> | Totzeit der Erstportion (Leitung füllen); geht additiv in die Dosis ein; `kal write` trägt `tRise` der Erstportion ein (13.09.2026: 20 → 8) | Messlauf `mess` am Endaufbau | nein |
| `tMin` | <!-- def:cfg3.tMin -->25<!-- /def --> s | <!-- zr:cfg3.tMin -->10<!-- /zr --> | kleinste Erstportion; eine kleinere Dosis wird angehoben; `kal write` setzt `max(tPmin, tDead + 2)` (13.09.2026: 25 → 10) | mit `tDead` | nein |
| `tStd` | <!-- def:cfg3.tStd -->70<!-- /def --> s | <!-- zr:cfg3.tStd -->12<!-- /zr --> | allererste Gabe, solange `lrn.effW` `null` ist | bei sehr kleinem oder großem Topf | nein |
| `tMax` | <!-- def:cfg3.tMax -->180<!-- /def --> s | <!-- zr:cfg3.tMax -->40<!-- /zr --> | Summe aller Portionen eines Fensters; `auto_off` = `tMax` + 10 s | Topfgröße, Pumpenleistung | **ja** |
| `tChk` | <!-- def:cfg3.tChk -->5<!-- /def --> s | <!-- zr:cfg3.tChk -->1<!-- /zr --> | Abstand der Wasserstandsprüfungen während einer Portion (leer → `abbruch`) und beim Einsickern (leer → `wasser`) | selten | nein |
| `pause` | <!-- def:cfg3.pause -->24<!-- /def --> h | <!-- zr:cfg3.pause -->0.2<!-- /zr --> | Mindestpause nach jeder Gabe (mit zwei Takten Toleranz, siehe unten) | Pflanze, Jahreszeit | nein |
| `pauseHot` | <!-- def:cfg3.pauseHot -->12<!-- /def --> h | <!-- zr:cfg3.pauseHot -->0.1<!-- /zr --> | Mindestpause bei Hitze (Tagesmaximum heute oder gestern über `tHot`, beide Fenster möglich); gilt auch als Nachholfenster, wenn ein Fenster mit `max`/`zeit` endete und die Kontrolle unter `pctLo` lag | selten | nein |
| `pauseSlow` | <!-- def:cfg3.pauseSlow -->48<!-- /def --> h | <!-- zr:cfg3.pauseSlow -->0.35<!-- /zr --> | Mindestpause, wenn die Feuchte je 24 h um weniger als `dropSlow` sinkt (Staunässe-Verdacht) | mit `dropSlow` | nein |
| `tHot` | <!-- def:cfg3.tHot -->35<!-- /def --> °C | <!-- zr:cfg3.tHot -->30<!-- /zr --> | Hitzeschwelle: liegt das Tagesmaximum (in 2-°C-Schritten in `lrn.tMaxD` gemerkt) darüber, gilt `pauseHot` | Standort | nein |
| `maxDay` | <!-- def:cfg3.maxDay -->2<!-- /def --> | <!-- zr:cfg3.maxDay -->4<!-- /zr --> | Gießfenster je Kalendertag; Tagesvorrat `maxDay` × `tMax` Pumpensekunden | selten | nein |
| `dryDay` | <!-- def:cfg3.dryDay -->5<!-- /def --> | <!-- zr:cfg3.dryDay -->null<!-- /zr --> | Wochentag der Trockenphase (0 = Sonntag … 6 = Samstag; `null` = nie): ab dem ersten Takt dieses Tages keine Gabe, bis eine Messung unter `pctDry` liegt | Pflanze | nein |

<!-- /tabelle -->

## cfg4 – Fenster-Regelkreis

Liest nur `bw_pump`; der Installer prüft `tWin`/`tTail` gegen den Takt und baut daraus das Sicherheits-Aus. `tPmin`, `tSoak`, `tStab` und `tDead2` stammen aus dem Messlauf vom 13.09.2026 (Kapitel 19), die übrigen Startwerte aus Entscheidung 53 (Kapitel 17); die Spalte „Zeitraffer“ zeigt das Profil `ZR4`.

<!-- tabelle:cfg4 -->

| Feld | Startwert | Zeitraffer | Wirkung | Wann ändern | Installer danach? |
| --- | --- | --- | --- | --- | --- |
| `tWin` | <!-- def:cfg4.tWin -->420<!-- /def --> s | <!-- zr:cfg4.tWin -->120<!-- /zr --> | Zeitbudget je Fenster ab Scriptstart; das Fenster muss samt `tTail` vor dem nächsten `bw_main`-Takt enden | längere oder kürzere Fenster | **ja** |
| `tTail` | <!-- def:cfg4.tTail -->20<!-- /def --> s | <!-- zr:cfg4.tTail -->20<!-- /zr --> | Reserve zwischen Fensterende und nächstem Takt | selten | **ja** |
| `nPort` | <!-- def:cfg4.nPort -->6<!-- /def --> | <!-- zr:cfg4.nPort -->3<!-- /zr --> | Portionen je Fenster; 1 = Einzelportion ohne Messung und ohne Lernwert (Eimer-Variante, Sensor nicht im Wasserweg) | Aufbau | nein |
| `tPmin` | <!-- def:cfg4.tPmin -->10<!-- /def --> s | <!-- zr:cfg4.tPmin -->10<!-- /zr --> | kleinste Korrekturportion; nie kürzer als die Totzeit, sonst füllt sie nur den Schlauch | Messlauf | nein |
| `tPmax` | <!-- def:cfg4.tPmax -->120<!-- /def --> s | <!-- zr:cfg4.tPmax -->15<!-- /zr --> | längste Portion (`toggle_after` im Einschaltbefehl) | Topfgröße | nein |
| `tSoak` | <!-- def:cfg4.tSoak -->20<!-- /def --> s | <!-- zr:cfg4.tSoak -->10<!-- /zr --> | Einsickern nach jeder Portion, bevor gemessen wird (Messlauf: Wert steht 5 s nach Pumpe-aus) | Messlauf (Ruhewert) | nein |
| `tStep` | <!-- def:cfg4.tStep -->5<!-- /def --> s | <!-- zr:cfg4.tStep -->5<!-- /zr --> | Abstand der Ringwerte beim Stabilisieren | selten | nein |
| `tStab` | <!-- def:cfg4.tStab -->60<!-- /def --> s | <!-- zr:cfg4.tStab -->30<!-- /zr --> | Timeout der Stabilisierung; danach zählt der Mittelwert, noch steigend → `unstab` | Messlauf (Einschwingzeit) | nein |
| `nStab` | <!-- def:cfg4.nStab -->4<!-- /def --> | <!-- zr:cfg4.nStab -->3<!-- /zr --> | Ringwerte, die für „stabil“ innerhalb `dStab` liegen müssen; Messzeit je Portion `tSoak + nStab · tStep` = 40 s | selten | nein |
| `dStab` | <!-- def:cfg4.dStab -->1<!-- /def --> % | <!-- zr:cfg4.dStab -->1<!-- /zr --> | Spanne für „stabil“ (Trend höchstens die Hälfte); zugleich Schwelle „Portion ohne Wirkung“ und Auflösung von `tRise` | selten | nein |
| `tDead2` | <!-- def:cfg4.tDead2 -->8<!-- /def --> s | <!-- zr:cfg4.tDead2 -->0<!-- /zr --> | Totzeit der Folgeportionen (Schlauch voll); `kal write` trägt den Median von `tRise` ein (13.09.2026: 8 → 5) | Kalibrierlauf | nein |
| `dEffMin` | <!-- def:cfg4.dEffMin -->2<!-- /def --> % | <!-- zr:cfg4.dEffMin -->1<!-- /zr --> | Summe der Wirkung zweier voller Portionen; darunter Störung `noeff` (bleibt, bis `err` gelöscht ist) | selten | nein |

<!-- /tabelle -->

So rechnet das Fenster: Erstportion = `clamp(job.sec, tMin, min(tPmax, tMax, Tagesvorrat − day.sec))`; nach jeder Portion `tSoak` s einsickern, dann alle `tStep` s messen, bis `nStab` Werte in `dStab` liegen (spätestens `tStab`). Korrekturportion: Ziel = `min(pctSoll, pct + (pctHi − pct) / 2)`, `sec = (Ziel − pct) / Gewinn + tDead2` mit dem im Fenster gemessenen Gewinn (mindestens `effMin`), geklemmt auf `tPmin` … `min(tPmax, tMax − bisher, Tagesvorrat)`.

Ohne `pct` im Auftrag, bei `nPort` 1 oder unvollständigem Band pumpt `bw_pump` eine Einzelportion `clamp(job.sec, 1, min(tPmax, tMax))` ohne Messung und ohne Lernwert. Die Ergebnisse (`ok`, `over`, `max`, `zeit`, `stall`, `unstab`, `noeff`, `wasser`) erklärt Kapitel 13.

## Zustandseinträge lrn, st, job, day, err

Schreiben nur die Scripts; der Installer legt sie mit Startwerten an. Von Hand sinnvoll sind zwei Eingriffe: `lrn.effW` nach einer neuen Kalibrierung auf `null` setzen und `err` bei `noeff` löschen.

<!-- tabelle:lrn -->

| `lrn` | Startwert | Bedeutung | Schreibt |
| --- | --- | --- | --- |
| `effW` | <!-- def:lrn.effW -->null<!-- /def --> | % Feuchte je wirksame Pumpensekunde (Fensterskala): je Fenster neu = ΔFeuchte / wirksame Sekunden, geklemmt `effMin` … `effMax`, dann mit `alpha` gemischt; `null` → Erstportion `tStd` | `bw_pump` am Fensterende, `kal write` |
| `sf` | <!-- def:lrn.sf -->0.7<!-- /def --> | Sicherheitsfaktor der Erstportion: startet bewusst unter dem Ziel; − `sfStep` bei `over` mit einer Portion oder `zuviel`, + `sfUp` bei `ok` nach ≥ 2 Portionen; Klemme `sfMin` … 1 | `bw_pump`, `bw_main` (Kontrolle) |
| `rate` | <!-- def:lrn.rate -->null<!-- /def --> | Austrocknung in %/h seit der Kontrolle, erst ab 24 h Messreihe | `bw_main` beim Tageswechsel |
| `tMean` | <!-- def:lrn.tMean -->null<!-- /def --> | geglättetes Tagesmaximum (0,9 alt + 0,1 neu), Jahreszeit-Anzeiger | `bw_main` beim Tageswechsel |
| `tMaxD` | <!-- def:lrn.tMaxD -->null<!-- /def --> | Tagesmaximum heute in 2-°C-Schritten (spart Schreibvorgänge; das Überschreiten von `tHot` wird exakt erfasst) | `bw_main` je Takt |
| `tMaxY` | <!-- def:lrn.tMaxY -->null<!-- /def --> | Tagesmaximum gestern – die Hitzeregel um 08:00 braucht den Vortag | `bw_main` beim Tageswechsel |

<!-- /tabelle -->

Ein altes `eff` aus 0.1.x bleibt in `lrn` stehen und wird ignoriert.

<!-- tabelle:st -->

| `st` | Startwert | Bedeutung |
| --- | --- | --- |
| `state` | <!-- def:st.state -->"beob"<!-- /def --> | `beob` (beobachten) · `gegossen` (Fenster gelaufen, Kontrolle steht aus) · `sperre` (Pause oder Trockenphase) |
| `ts` | <!-- def:st.ts -->null<!-- /def --> | Unix-Zeit des Fensterstarts (Claim); die Pause rechnet ab hier |
| `sec` | <!-- def:st.sec -->null<!-- /def --> | Pumpensekunden des Fensters |
| `pctB` | <!-- def:st.pctB -->null<!-- /def --> | Frischmessung `m0` vor der ersten Portion |
| `pctA` | <!-- def:st.pctA -->null<!-- /def --> | Feuchte bei der Kontrolle (`soak` min nach dem Fenster) |
| `rated` | <!-- def:st.rated -->false<!-- /def --> | Kontrolle erledigt |
| `dryOk` | <!-- def:st.dryOk -->false<!-- /def --> | Trockenphase beendet (Messung unter `pctDry`) |
| `dur`, `n`, `pctW`, `effW`, `why`, `tr` | – (setzt `bw_pump`) | Fensterdauer bis Pumpe-aus · Portionen · letzte stabile Ablesung · Wirkung dieses Fensters · Ergebnis (`laeuft` = in Arbeit oder abgebrochen) · s bis zur ersten Sensorreaktion in Portion 2 |

<!-- /tabelle -->

<!-- tabelle:job -->

| `job` | Startwert | Bedeutung |
| --- | --- | --- |
| `ok` | <!-- def:job.ok -->false<!-- /def --> | `true` = Gießauftrag steht; `bw_pump` setzt nach dem Fenster `false` |
| `sec` | <!-- def:job.sec -->null<!-- /def --> | gewünschte Erstportion in s (Dosisformel oder `tStd`) |
| `pct` | <!-- def:job.pct -->null<!-- /def --> | Feuchte bei der Entscheidung; ohne `pct` gießt `bw_pump` eine Einzelportion |
| `why` | <!-- def:job.why -->"init"<!-- /def --> | Begründung von `bw_main` (`ok`, `feucht`, `pause`, `trocken`, `cfg`, `uhr`, `sensor`, `wasser`, `limit`, `soak`, `lvl`, `err:<code>`) bzw. Fensterergebnis von `bw_pump` |
| `ts` | <!-- def:job.ts -->null<!-- /def --> | Zeitpunkt des Auftrags; `bw_pump` prüft ihn gegen `jobAge` |

<!-- /tabelle -->

<!-- tabelle:day -->

| `day` | Startwert | Bedeutung |
| --- | --- | --- |
| `date` | <!-- def:day.date -->null<!-- /def --> | lokales Datum `YYYY-MM-DD`; `bw_main` erkennt daran den Tageswechsel (kein eigener Zeitplan-Eintrag) |
| `n` | <!-- def:day.n -->0<!-- /def --> | Gießfenster heute (`maxDay`) |
| `sec` | <!-- def:day.sec -->0<!-- /def --> | Pumpensekunden heute, auch Teilportionen (Tagesvorrat) |

<!-- /tabelle -->

<!-- tabelle:err -->

| `err` | Startwert | Bedeutung |
| --- | --- | --- |
| `code` | <!-- def:err.code -->null<!-- /def --> | letzte Störung: blockierend `cfg`, `uhr`, `sensor`, `wasser`, `noeff`; Hinweise `temp`, `zuviel`, `sink`, `alt`, `limit`. `noeff` wird nie überschrieben, ein blockierender Code verdrängt einen Hinweis; unter den blockierenden gilt cfg > uhr > sensor > wasser |
| `ts` | <!-- def:err.ts -->null<!-- /def --> | Zeitpunkt |
| `mem` | <!-- def:err.mem -->null<!-- /def --> | freier RAM in Byte bei der Störung und einmal täglich (macht ein Speicherleck sichtbar) |

<!-- /tabelle -->

## Sicherungen und Test-Einträge

Die Sicherungen `zrb1`…`zrb5`, `zr`, `hwc`, `hwb1`, `hwb2` gibt es nur während eines Zeitraffers (Kapitel 12) oder Hardware-Checks (Kapitel 11); `hwt`, `hwr`, `hwp` bleiben nach `hwtest.js cleanup` als Nachweis stehen. Alle sind JSON-Strings wie die übrigen Einträge.

| Eintrag | Inhalt | Wer |
| --- | --- | --- |
| `zrb1` … `zrb5` | Kopien von `cfg3` · `lrn` + `day` · `st` + `err` · `cfg4` · `cfg2` | `bw_zeitraffer` schreibt sie einmal; `bw_install` baut daraus zurück und löscht sie |
| `zr` | Startmarke `{"go":1}`, als Letztes geschrieben | `bw_install` löscht sie beim Aufbau des Zeitraffer-Zeitplans; Sicherung ohne Marke = Rückkehr |
| `hwt` | Schwellen und Zeiten der Hardware-Tests (Tabelle unten) | das Test-Script legt Startwerte an; ändern mit `node tools/hwtest.js <ip> cfg tLo=21` |
| `hwc` | `n` Zähler · `cmd` `go` / `skip` / `abort` | Kommando an das laufende Test-Script; nur ein `n` größer als das zuletzt gesehene wirkt |
| `hwr`, `hwp` | Stand und Bericht des Sensor- bzw. Pumpentests (Codes `ok`, `sk`, `to`, `ab`, `fe`, `nl`, `aw`) | `bw_hwtest`, `bw_hwpump`; `hwtest.js report` bereitet sie auf |
| `hwb1`, `hwb2` | Kopien von `st` + `day` bzw. `job` + `err` + `lrn` | `bw_hwpump` Durchgang A sichert, Durchgang B oder `hwtest.js restore` baut zurück |

<!-- tabelle:hwt -->

| `hwt` | Startwert | Bedeutung |
| --- | --- | --- |
| `tLo` | <!-- hwt:tLo -->20<!-- /hwt --> °C | Phase t1: Fühler kalt, `nStab` Lesungen ≤ `tLo` |
| `tHi` | <!-- hwt:tHi -->30<!-- /hwt --> °C | Phase t2: Fühler warm, `nStab` Lesungen ≥ `tHi` |
| `vDryMax` | <!-- hwt:vDryMax -->0.5<!-- /hwt --> V | Phase m1: Trockenpunkt muss darunter liegen |
| `vWetMin` | <!-- hwt:vWetMin -->2.5<!-- /hwt --> V | Phase m2: Nasspunkt muss darüber liegen |
| `dV` | <!-- hwt:dV -->0.03<!-- /hwt --> V | Spannweite der letzten `nStab` Lesungen für „stabil“ |
| `nStab` | <!-- hwt:nStab -->5<!-- /hwt --> | gleiche bzw. stabile Ticks je Phase |
| `nNull` | <!-- hwt:nNull -->10<!-- /hwt --> | Ticks ohne Messwert → Ergebnis `nl` |
| `msTick` | <!-- hwt:msTick -->1000<!-- /hwt --> ms | Tick des Test-Timers |
| `nCmd` | <!-- hwt:nCmd -->2<!-- /hwt --> | Ticks je Abfrage von `hwc` |
| `nLog` | <!-- hwt:nLog -->5<!-- /hwt --> | Ticks je Konsolenzeile |
| `tPhase` | <!-- hwt:tPhase -->900<!-- /hwt --> s | Timeout je Phase → `to` |
| `tAll` | <!-- hwt:tAll -->3600<!-- /hwt --> s | Timeout des ganzen Tests → `ab` |
| `pumpSec` | <!-- hwt:pumpSec -->30<!-- /hwt --> s | Testauftrag des Pumpentests (höchstens `cfg3.tMax`) |
| `tOn` | <!-- hwt:tOn -->20<!-- /hwt --> | reserviert – wird von keinem Script gelesen |
| `guardS` | <!-- hwt:guardS -->90<!-- /hwt --> s | Zeitwache des Pumpentests: nicht in den ersten `guardS` s eines 15-min-Takts und nicht in den letzten `guardS` + `pumpSec` s |
| `winMin` | <!-- hwt:winMin -->25<!-- /hwt --> min | Abstand zu `winA`, `winB` und Mitternacht, in dem der Pumpentest nicht startet |
| `cal` | <!-- hwt:cal -->1<!-- /hwt --> | 1 = `bw_hwtest` schreibt plausible `vDry`, `vWet`, `lvlEmpty` nach `cfg1`; 0 = nur melden |
| `run` | <!-- hwt:run -->"tml"<!-- /hwt --> | Phasengruppen: t Temperatur, m Feuchte, l Wasserstand (`"m"` = nur Feuchte) |

<!-- /tabelle -->

`bw_hwpump` nutzt aus `hwt` nur `msTick`, `nCmd`, `nLog`, `tPhase`, `tAll`, `pumpSec`, `guardS` und `winMin`.

## Abgeleitete Werte

Diese Zahlen stehen in keinem KVS-Feld; sie folgen aus den Feldern oben. `PUMP_SEC` = 30 ist die einzige feste Uhrzeit im Zeitplan (`bw_install.js`: `bw_pump` startet 30 s nach der vollen Minute, damit es nie neben `bw_main` läuft); daneben gibt es nur die festen Reserven von 10 s (`safeSec`, `auto_off`) und die 24-h-Mindestreihe für `lrn.rate`.

| Größe | Formel | Normal | Zeitraffer |
| --- | --- | --- | --- |
| Zeitplan `bw_main` | `0 */tick * * * *` | `0 */15 * * * *` | `0 */3 * * * *` |
| Zeitplan `bw_pump` | `30 M hA,hB * * *` bei gleicher Fensterminute, sonst zwei Einträge; Zeitraffer `30 */winEvery * * * *` | `30 0 8,20 * * *` | `30 */6 * * * *` |
| Sicherheits-Aus (`Switch.Set` aus, ohne Script) | `safeSec` = 30 + `tWin` + 10 s nach der Fensterminute; normal auf volle Minuten aufgerundet (`SAFE_MIN`), Zeitraffer als Minutenliste mit Sekundenfeld | 460 s → `SAFE_MIN` 8 → `0 8 8,20 * * *` | 160 s → `40 2,8,14,20,26,32,38,44,50,56 * * * *` |
| Zeitplan-Einträge | 3 bei gleicher Minute von `winA` und `winB`, sonst bis zu 5; die IDs vergibt das Gerät (Konsole `Zeitplan #<id>: <timespec>`) | 3 | 3 |
| `auto_off` (Switch-Konfiguration) | `tMax` + 10 s, der Ausgang schaltet sich nach jedem Einschalten selbst ab | 190 s | 50 s |
| Fensterregel (prüft der Installer, sonst `err=cfg`) | `(Fensterminute mod tick) · 60 + 30 + tWin + tTail ≤ tick · 60` | 0 + 30 + 420 + 20 = 470 ≤ 900; ein Fenster um 08:05 passt (770), eines um 08:10 nicht (1 070) | 30 + 120 + 20 = 170 ≤ 180; zusätzlich 30 + `tWin` + 10 < `winEvery` · 60 (160 < 360) |
| Frist `B` in `bw_pump` | `min(tWin, tick · 60 − q − tTail)`, q = Sekunden seit dem letzten Takt; eine Portion startet nur, wenn `vergangen + sec + tSoak + nStab · tStep ≤ B`, sonst `why=zeit` | q = 30 → min(420, 850) = 420 s; Messzeit 20 + 4 · 5 = 40 s | min(120, 130) = 120 s; Messzeit 10 + 3 · 5 = 25 s |
| Pausentoleranz | `(now + 2 · tick · 60) − st.ts ≥ pause · 3600` – der Auftrag entsteht einen Takt vor dem Fenster | 30 min Vorlauf | 6 min |
| `jobAge`-Bedingung | Auftrag aus dem Takt vor dem Fenster, Fenster bis `tick` min + 30 s später: `jobAge` > `tick` + 0,5 min; `bw_main` schreibt den Auftrag im Takt vor dem Fenster immer frisch | 15,5 min < 20 | 3,5 min < 5 |
| Dosis der Erstportion | `clamp(round((pctSoll − pct) / effW · sf + tDead), tMin, tMax)`; ohne `effW` → `tStd` | Gerätewerte 13.09.2026: Takt misst 30 % → (55 − 30) / 4,46 · 0,7 + 8 ≈ 12 s | – |
| Tagesvorrat | `maxDay` × `tMax` Pumpensekunden minus `day.sec` | 360 s | 160 s |

## KVS bearbeiten

1. Lesen: `http://<ip>/rpc/KVS.GetMany?match=*` im Browser (das Gerät liefert 11 Einträge je Seite) oder `tools/kvs_dump.sh <ip>`, das alle Seiten und `kvs_rev` (Zähler der Schreibvorgänge) ausgibt.
2. Web-UI: Settings → Key-Value Storage → Eintrag öffnen → **„Format as JSON“ anhaken** → Feld ändern → speichern. Ohne den Haken zeigt die Web-UI den JSON-Text als reinen String; `[object Object]` bedeutet, dass der Wert kein String ist (siehe Typische Fehler).
3. Per RPC vor dem Installer (Teilobjekt reicht, der Installer ergänzt den Rest):

```bash
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg1","value":"{\"vDry\":0.296,\"vWet\":3.134}"}'   # Kalibrierpunkte vom 13.09.2026
curl -s -H 'Content-Type: application/json' http://<ip>/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctSoll\":55,\"pctLo\":40,\"pctOk\":50,\"pctHi\":60,\"pctDry\":28,\"dropSlow\":4}"}'   # Beispielband
node tools/hwtest.js <ip> normal 60          # Installer in einem sicheren Moment starten, ergänzt die fehlenden Felder
curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"err"}'   # Störung noeff löschen (bw_main legt err im nächsten Takt neu an)
```

4. Im laufenden Betrieb ein einzelnes Feld ändern: Web-UI mit „Format as JSON“, oder den ganzen Eintrag per `KVS.Set` schreiben. Nach `tick`, `winEvery`, `winA`/`winB`, `tMax`, `tWin`, `tTail` oder `cfg1.idSw` den Installer starten (Schritt 3, letzte Zeile).
5. Prüfen: Web-UI → Schedules zeigt die drei Einträge aus der Tabelle oben; die erste Konsolenzeile von `bw_main` zeigt `err=-` und `why=ok` oder `why=feucht`.

## Beispielausgabe

Installer <!-- fact:ver.bw_install -->0.1.3<!-- /fact --> im Mock mit den zwei Teilobjekten aus Schritt 3 (`node tools/run-script.js scripts/bw_install.js --kvs 'cfg1=…' --kvs 'cfg2=…'`): fehlende Felder werden ergänzt, die übrigen Einträge neu angelegt. Am Gerät vergibt die Firmware die Zeitplan-IDs selbst.

```text
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] KVS cfg1 ergänzt: vErrLo,vErrHi,nSample,msSample,lvlEmpty,nLvl,idV,idT,idLvl,idSw
[bw_install 0.1.3] KVS cfg2 ergänzt: hyst,effMin,effMax,alpha,sfMin,sfStep,dropW,sfUp
[bw_install 0.1.3] Zeitplan: 0 Einträge, davon eigene: 0
[bw_install 0.1.3] Switch 0: auto_off 190 s
[bw_install 0.1.3] KVS neu angelegt: cfg3, cfg4, lrn, st, job, day, err
[bw_install 0.1.3] Zeitplan #1: 0 */15 * * * *
[bw_install 0.1.3] Zeitplan #2: 30 0 8,20 * * *
[bw_install 0.1.3] Zeitplan #3: 0 8 8,20 * * *
[bw_install 0.1.3] fertig – bw_main alle 15 min, bw_pump um 08:00 und 20:00 (Sekunde 30), Budget tWin 420 s, Sicherheits-Aus 8 min danach
```

`kal write` aus der Aufzeichnung vom 13.09.2026 (`docs/kal/2026-09-13-13-50-kal.json` mit Konsolen-Log, Rechenkern `tools/lib/kal.js` gegen die Startwerte): vier Felder in drei Einträgen per Lesen-Ändern-Schreiben.

```text
Konsolenzeilen aus docs/kal/2026-09-13-13-50-kal-log.txt: 5
Aufzeichnung: docs/kal/2026-09-13-13-50-kal.json
  lrn.effW null → 4.46 (Messwert)
  cfg4.tDead2 8 → 5 s
  cfg3.tDead 20 → 8 s (tRise der Erstportion; Endaufbau mit anderem Schlauch: mess)
  cfg3.tMin 25 → 10 s (max(tPmin, tDead + 2))
vorher:  lrn={"effW":null,"sf":0.7,"rate":null,"tMean":null,"tMaxD":null,"tMaxY":null} cfg4={"tWin":420,"tTail":20,"nPort":6,"tPmin":10,"tPmax":120,"tSoak":20,"tStep":5,"tStab":60,"nStab":4,"dStab":1,"tDead2":8,"dEffMin":2} cfg3.tDead=20
nachher: lrn={"effW":4.46,"sf":0.7,"rate":null,"tMean":null,"tMaxD":null,"tMaxY":null} cfg4={"tWin":420,"tTail":20,"nPort":6,"tPmin":10,"tPmax":120,"tSoak":20,"tStep":5,"tStab":60,"nStab":4,"dStab":1,"tDead2":5,"dEffMin":2} cfg3.tDead=8
```

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `why=cfg`, `err=cfg` nach einem Script-Update; Konsole `cfg4.tWin fehlt` oder `cfg3.tick fehlt` | neue Felder fehlen im KVS | `bw_install` einmal starten (`hwtest.js <ip> normal 60`); `pctOk` legt er nur mit `null` an – Wert von Hand eintragen |
| `why=cfg`, obwohl alle Bandfelder gesetzt sind; Konsole `cfg2: Band ungültig` | Ordnung verletzt, oft `pctLo + hyst < pctOk` | Band in Bandordnung prüfen: `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` |
| Web-UI zeigt `[object Object]`, Speichern macht es schlimmer | Wert ist kein JSON-String (Eintrag aus 0.1.0 oder per RPC als Objekt geschrieben); der Installer behält Objektwerte, weil `fromKvs()` sie durchreicht – erst der zurückgeschriebene Text `[object Object]` wird durch Startwerte ersetzt (Konsole meldet es nur in der Schlusszeile `KVS neu angelegt: …`) | Eintrag löschen (`curl -s -X POST http://<ip>/rpc/KVS.Delete -d '{"key":"cfg2"}'`) oder per `KVS.Set` als JSON-String neu schreiben, dann `bw_install` starten (`hwtest.js <ip> normal 60`) und eigene Werte eintragen |
| Nach `KVS.Set` mit Teilobjekt fehlen andere Felder (`cfg2.hyst fehlt`) | `KVS.Set` ersetzt den ganzen Eintrag | Installer erneut starten (ergänzt) oder in der Web-UI nur das Feld ändern |
| Installer bricht ab: `cfg3.winA 08:10: 30 + tWin 420 + tTail 20 s passen nicht in den Takt (tick 15 min)` | Fenster endet nicht vor dem nächsten Takt | Fensterminute auf ein Vielfaches von `tick` legen, `tWin` verkleinern oder `tick` vergrößern |
| Installer bricht ab: `Script bw_main läuft – später erneut starten`, `err=cfg` steht | Start während eines Takts oder Fensters | `hwtest.js <ip> normal 60` wartet einen sicheren Moment ab; `err` löscht `bw_main` im nächsten Takt |
| Dosis viel zu groß oder zu klein nach neuer Kalibrierung | `lrn.effW` stammt von der alten Prozentskala | `effW` auf `null` setzen oder `kal write` wiederholen |
| `err=noeff` bleibt trotz Reparatur | `noeff` wird nie automatisch gelöscht | Pumpe, Schlauch, Sensorlage prüfen, dann `KVS.Delete err` |
| Zeitplan zeigt alte Zeiten nach Änderung von `winA` | Installer nicht gestartet | `bw_install` starten; er löscht seine eigenen Einträge (erkennbar an `Script.Start` auf `bw_main`/`bw_pump`, `Switch.Set`) und legt sie neu an |

## Weiter zu

- [02 · Flussdiagramm](02-flussdiagramm.md) – wann welcher Wert im Tagesablauf greift
- [11 · Hardware-Check](11-hardware-check.md) – `cfg1` messen lassen statt schätzen
- [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md) – Zielband finden, Kalibrierlauf, Zeitraffer
- [13 · Betrieb und Wartung](13-betrieb-und-wartung.md) – Konsole lesen, `why`- und `err`-Codes deuten
