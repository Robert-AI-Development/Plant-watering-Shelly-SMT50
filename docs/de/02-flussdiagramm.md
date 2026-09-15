# 02 · Flussdiagramm: Takt, Auftrag, Fenster, Kontrolle, Pause

**Deutsch** · [English](../en/02-flussdiagramm.md) — [Handbuch](README.md) · Teil A „Verstehen“

> **Auf einen Blick**
> - Alle <!-- def:cfg3.tick -->15<!-- /def --> Minuten misst `bw_main` und entscheidet; gegossen wird nur in den zwei Fenstern `winA` <!-- def:cfg3.winA -->08:00<!-- /def --> und `winB` <!-- def:cfg3.winB -->20:00<!-- /def --> durch `bw_pump` – in Portionen mit Nachmessen, zusammen höchstens `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s.
> - Auslöser ist eine Taktmessung unter `pctLo`; das Fenster endet, sobald die Feuchte `pctOk` erreicht; die Dosis zielt auf `pctSoll`, gedämpft mit dem Sicherheitsfaktor `sf` <!-- def:lrn.sf -->0.7<!-- /def -->.
> - Bremsen: Pause <!-- def:cfg3.pause -->24<!-- /def --> h nach jeder Gabe (Hitze <!-- def:cfg3.pauseHot -->12<!-- /def --> h, Staunässe-Verdacht <!-- def:cfg3.pauseSlow -->48<!-- /def --> h), höchstens `maxDay` <!-- def:cfg3.maxDay -->2<!-- /def --> Fenster je Tag, Trockenphase ab Freitag oder bei Nässe über `pctHi`.
> - Größter Stolperstein: `job.why` ist kein Fehler. `pause`, `trocken`, `feucht` und `soak` sind erwartete Gründe gegen eine Gabe; Störungen stehen getrennt in `err`.

## Voraussetzungen

- keine; hilfreich ist [01 · Gesamtarchitektur](01-gesamtarchitektur.md) (welche Scripts es gibt und warum keines dauerhaft läuft)

## Diagramm

[![Ablauf eines Tages: Takt, Auftrag, Gießfenster, Kontrolle, Pause, Bremsen](../diagramme/de/02-flussdiagramm.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/02-flussdiagramm.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/02-flussdiagramm.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Ein Takt“, 2 „Das Gießfenster“, 3 „Bremsen: Kontrolle, Pause, Trockenphase“, 4 „Störungen“.

## Das Zielband

Alle Entscheidungen hängen an fünf Feuchtewerten in `cfg2`, die in dieser Ordnung stehen müssen: `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` und `pctLo + hyst < pctOk`. Der Installer legt sie – wie `dropSlow` (Feuchteabnahme je 24 h für `pauseSlow`) – als `null` an; solange eines dieser sechs Felder `null` ist, gibt es keinen Auftrag (`why=cfg`, `err=cfg`). Die Werte trägt der Betreiber ein ([03 · Konfiguration](03-konfiguration.md)). Feuchte in Prozent ist `(V − vDry) / (vWet − vDry) · 100`, also relativ zur Kalibrierung des Sensors.

| Feld | Beispiel (Gerät 13.09.2026) | Rolle |
| --- | --- | --- |
| `pctDry` | 28 % | Ende der Trockenphase: erst darunter wird wieder gegossen |
| `pctLo` | 40 % | Auslöser: Taktmessung darunter → Auftrag (*wann*) |
| `pctOk` | 50 % | Ziel erreicht: keine weitere Portion, Frischmessung `≥ pctOk` → keine Gabe (*bis wohin*) |
| `pctSoll` | 55 % | Zielpunkt der Dosisrechnung (*wie viel*) |
| `pctHi` | 60 % | darüber „zu viel“ (Dosis sinkt) bzw. nass (Trockenphase beginnt) |
| `hyst` | <!-- def:cfg2.hyst -->2<!-- /def --> % | ein laufender Auftrag hält bis `pctLo + hyst`; die Kontrolle meldet „zu viel“ erst über `pctHi + hyst` |

Die Beispiele in diesem Kapitel rechnen mit diesem Band. `pctLo` und `pctDry` gelten nur für die Taktmessung von `bw_main`, `pctOk` nur für die stabilisierte Ablesung im Fenster. `pctSoll` und `pctHi` sind auf die Fensterskala kalibriert, werden aber auch im Takt genutzt: `pctSoll` in der Dosisformel, `pctHi` für Nässe (Trockenphase) und bei der Kontrolle (`zuviel`).

## Ein Takt: messen, prüfen, beauftragen

`bw_main` startet über den Zeitplan alle `tick` Minuten, liest den KVS, arbeitet acht Schritte ab und beendet sich. Es schaltet die Pumpe nie.

### Messen

- Feuchte: `nSample` <!-- def:cfg1.nSample -->5<!-- /def --> Spannungswerte im Abstand `msSample` <!-- def:cfg1.msSample -->500<!-- /def --> ms; Mittelwert der mittleren Werte (kleinster und größter fallen weg). Liegt die Spannung außerhalb `vErrLo`…`vErrHi`, gilt der Sensor als unplausibel.
- Wasserstand: `nLvl` <!-- def:cfg1.nLvl -->3<!-- /def --> gleiche Lesungen des Schwimmers; Wert gleich `lvlEmpty` heißt LEER. Ungleiche Lesungen → nicht lesbar (`lvl`).
- Temperatur vom DS18B20; das Tagesmaximum landet in `lrn.tMaxD` (auf 2 °C gerundet, das Überschreiten von `tHot` <!-- def:cfg3.tHot -->35<!-- /def --> °C wird exakt erfasst).

### Freigabekette

Nach Messen, Tageswechsel, Kontrolle und Trockenphase läuft die Freigabekette. Der erste zutreffende Grund gewinnt und steht in `job.why`:

| Reihenfolge | Bedingung | `job.why` |
| --- | --- | --- |
| 1 | Zielband oder `dropSlow` offen (`null`) – Pflichtfeld fehlt oder Bandordnung verletzt: siehe unten | `cfg` |
| 2 | Feuchtesensor unplausibel | `sensor` |
| 3 | Wasserstand nicht stabil lesbar | `lvl` |
| 4 | Behälter leer | `wasser` |
| 5 | blockierende Störung steht (`noeff`, `cfg`, `uhr`, `sensor`, `wasser`) | `err:<code>` |
| 6 | schon `maxDay` Fenster heute | `limit` |
| 7 | letztes Fenster noch nicht kontrolliert | `soak` |
| 8 | Pause seit der letzten Gabe läuft | `pause` |
| 9 | Trockenphase läuft | `trocken` |
| 10 | Feuchte `≥ pctLo` (mit laufendem Auftrag `≥ pctLo + hyst`) | `feucht` |
| 11 | sonst | `ok` – Auftrag mit `sec` |

Fehlt ein Pflichtfeld oder ist die Bandordnung verletzt, bricht der Takt schon vor der Freigabekette ab: `err=cfg`, Konsole `why=cfg`; ein laufender Auftrag wird zurückgenommen, sonst bleibt `job` unverändert.

### Der Auftrag

Bei `ok` schreibt `bw_main` die Erstportion in Sekunden: `sec = (pctSoll − pct) / effW · sf + tDead`, gerundet und geklemmt auf `tMin`…`tMax`. Solange `lrn.effW` noch `null` ist (erstes Fenster), gilt pauschal `tStd` <!-- def:cfg3.tStd -->70<!-- /def --> s.

Beispiel mit den Gerätewerten vom 13.09.2026 (`effW` 4,46 %/s, `tDead` 8 s, `tMin` 10 s aus `kal write`): Takt misst 30 % → `(55 − 30) / 4,46 · 0,7 + 8 ≈ 12 s`. Mit den Startwerten `tDead` <!-- def:cfg3.tDead -->20<!-- /def --> s und `tMin` <!-- def:cfg3.tMin -->25<!-- /def --> s ergäbe dieselbe Rechnung 24 s, geklemmt auf 25 s.

`sf` startet bei 0,7: die Erstportion landet bewusst unter dem Ziel, den Rest holen Korrekturportionen im Fenster. Geschrieben wird `job` nur, wenn sich `ok` oder `why` ändert – oder wenn `ok` gilt und das nächste Fenster innerhalb eines Takts liegt (dann frisch, weil `bw_pump` das Alter prüft).

## Das Gießfenster: Portionen mit Nachmessen

`bw_pump` startet 30 s nach der Fensterminute (08:00:30, 20:00:30), damit es nie neben `bw_main` läuft. Es liest genau neun KVS-Einträge und prüft den Auftrag: `job.ok` muss `true` sein, `job.ts` höchstens `jobAge` <!-- def:cfg3.jobAge -->20<!-- /def --> min alt (sonst `alt`), keine blockierende Störung, `day.n < maxDay` (sonst `limit`).

### Frist

Vor der ersten Portion rechnet das Script seine Frist `B = min(tWin, tick·60 − q − tTail)`, `q` = Sekunden seit dem letzten Takt. Normal: `min(420, 900 − 30 − 20) = 420 s` (`tWin` <!-- def:cfg4.tWin -->420<!-- /def -->, `tTail` <!-- def:cfg4.tTail -->20<!-- /def -->). Jede Portion startet nur, wenn Portion + Einsickern + Stabilisieren (`tSoak + nStab·tStep` = 40 s) noch in die Frist passen; sonst endet das Fenster mit `zeit`. So endet ein Fenster immer vor dem nächsten Takt.

### Frischmessung m0

Der Auftrag ist bis zu 20 min alt, deshalb misst `bw_pump` zuerst selbst (`nSample` Werte, Median):

- `m0 > pctHi` → `nass`: keine Gabe, Trockenphase beginnt.
- `m0 ≥ pctOk` → `feucht` (von Hand gegossen oder gedüngt): keine Gabe, kein Lernwert, keine Pause, `day` unverändert.
- sonst Erstportion `P1 = clamp(job.sec, tMin, min(tPmax, tMax, Tagesvorrat))`; Tagesvorrat = `maxDay · tMax − day.sec`. Ist der Vorrat kleiner als `tMin`, endet das Fenster mit `max`.

### Portion, Einsickern, Stabilität

1. Wasserstand prüfen (`nLvl` gleiche Lesungen); LEER → `wasser`, Störung `wasser`.
2. Claim schreiben: `st.why = laeuft` (siehe Zustände). Stirbt das Script mitten im Fenster, hält `bw_main` daraus die Pause.
3. Einschalten mit `Switch.Set {on:true, toggle_after: sec}` – das Gerät schaltet nach `sec` s selbst ab, höchstens `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s je Portion.
4. Während der Portion alle `tChk` <!-- def:cfg3.tChk -->5<!-- /def --> s: Behälter leer → Pumpe sofort aus (`abbruch`); Ausgang von außen aus → `extern`. Der erste Anstieg um `dStab` wird als `tRise` gemerkt.
5. `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s einsickern, dann alle `tStep` <!-- def:cfg4.tStep -->5<!-- /def --> s ein Messwert in einen Ring von `nStab` <!-- def:cfg4.nStab -->4<!-- /def --> Werten.
6. Stabil heißt: Spanne der `nStab` Werte ≤ `dStab` <!-- def:cfg4.dStab -->1<!-- /def --> % **und** jüngster minus ältester Wert ≤ `dStab/2` (eine Rampe zählt nicht). Spätestens nach `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s gilt das Ringmittel.

### Urteil nach jeder Portion

| Befund | Ergebnis (`job.why`, `st.why`) | Was folgt |
| --- | --- | --- |
| beim Timeout noch steigend | `unstab` | Fenster endet, Lernwert ja, keine weitere Portion |
| Feuchte `> pctHi` | `over` | Fenster endet; war es die erste Portion, sinkt `sf` |
| Feuchte `≥ pctOk` | `ok` | Fenster endet im Band |
| Portion 1 ohne Wirkung (Δ < `dStab`) | – | genau eine volle Probeportion `clamp(P1, tPmin, Rest)` |
| Portion 2 ohne Wirkung, Σ < `dEffMin` <!-- def:cfg4.dEffMin -->2<!-- /def --> % | `noeff` | Störung `noeff`, blockiert bis ein Mensch `err` löscht |
| Portion 2 ohne Wirkung mit Σ ≥ `dEffMin` oder spätere Portion ohne Wirkung | `stall` | Fenster endet, Lernwert aus den wirksamen Portionen |
| Behälter in der Wartephase leer | `wasser` | Fenster endet, Störung `wasser` |
| unter `pctOk`, Wirkung messbar | – | Korrekturportion (unten) |
| `nPort` <!-- def:cfg4.nPort -->6<!-- /def --> Portionen, `tMax` oder Tagesvorrat erreicht | `max` | Fenster endet |
| nächste Portion passt nicht in die Frist | `zeit` | Fenster endet |

Grundsatz: „keine Wirkung“ führt nie zu mehr Wasser – die gedeckelte Probeportion ist die einzige Ausnahme; danach endet das Fenster mit `stall` oder die Störung `noeff` sperrt.

Korrekturportion: Gewinn `g = Σ Δ% / Σ wirksame Sekunden` seit `m0` (Sekunden minus Totzeit `tDead` bei Portion 1, `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s danach; nie unter `effMin`). Ziel = halber Weg bis `pctHi`, höchstens `pctSoll`. `sec = (Ziel − ist) / g + tDead2`, geklemmt auf `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def -->…`min(tPmax, Rest von tMax, Rest des Tagesvorrats)`. Ist die Rechnung kleiner als `tPmin` und die Feuchte schon bei `pctOk − dStab`, endet das Fenster mit `ok`.

Beispiel vom Gerät (13.09.2026, Zeitraffer): nach `P1` 34 % bei `g` 2,357 → Ziel `min(55, 34 + 13) = 47` → `13 / 2,357 + 0 ≈ 5,5 s`, geklemmt auf `tPmin` 10 s → `P2 10s` (siehe Beispielausgabe).

### Einzelportion

Ohne `job.pct`, mit `nPort` 1 oder mit unvollständigem Band pumpt `bw_pump` genau eine Portion `clamp(job.sec, 1, min(tPmax, tMax))` – ohne Frischmessung, ohne Lernwert. So arbeiten der Hardware-Test und ein Handauftrag ohne `pct` ([13 · Betrieb und Wartung](13-betrieb-und-wartung.md)).

## Lernen im Fenster

Am Fensterende lernt `bw_pump` – nur mit wirksamen Sekunden und nur bei `ok`, `over`, `max`, `zeit`, `stall`, `unstab` sowie `wasser` nach einer vollständigen Portion (bei `abbruch`/`extern` aus den fertigen Portionen). Kein Lernen bei `noeff`, `sensor`, `switch`, `kvs`, `feucht`, `nass` – und bei jedem Ende ohne fertige Portion (Absturz: `st.why` bleibt `laeuft`).

- `effNew = Σ Δ% / Σ wirksame Sekunden`, geklemmt auf `effMin` <!-- def:cfg2.effMin -->0.05<!-- /def -->…`effMax` <!-- def:cfg2.effMax -->30<!-- /def -->.
- `lrn.effW = (1 − alpha) · alt + alpha · effNew` mit `alpha` <!-- def:cfg2.alpha -->0.3<!-- /def -->; das erste Fenster übernimmt `effNew` direkt.
- `lrn.sf`: `over` mit nur einer Portion → `− sfStep` <!-- def:cfg2.sfStep -->0.1<!-- /def --> (nie unter `sfMin` <!-- def:cfg2.sfMin -->0.5<!-- /def -->); `ok` nach mindestens zwei Portionen → `+ sfUp` <!-- def:cfg2.sfUp -->0.05<!-- /def --> (höchstens 1). Die Ratsche schließt sich also wieder, wenn Korrekturportionen nötig waren.

Der 30-min-Wert der Kontrolle geht nie in `effW` ein – er enthält schon Drainage.

## Kontrolle nach dem Fenster

`soak` <!-- def:cfg3.soak -->30<!-- /def --> min nach dem Ende der letzten Portion misst der nächste Takt von `bw_main` nach (`st.state` ist bis dahin `gegossen`, `job.why = soak`). Die Konsole zeigt `Kontrolle: pctW → pctA % sf=…`:

| Befund | Wirkung | Hinweis in `err` |
| --- | --- | --- |
| `pctA > pctHi + hyst` und das Fenster endete nicht mit `over` | `sf − sfStep` | `zuviel` |
| `pctW − pctA > dropW` (nur wenn `dropW` gesetzt) | keiner | `sink` (Drainage, Sensor verrutscht?) |
| Fenster endete mit `max` oder `zeit` und `pctA < pctLo` | Nachholfenster: nächste Pause nur `pauseHot` | – |

Danach steht `st.state = sperre`; die Hinweise gelten bis zur nächsten Kontrolle und blockieren nichts.

## Pause

Nach jeder Gabe ist Ruhe. `bw_main` wählt in jedem Takt eine von drei Pausen:

| Pause | Dauer | Wann |
| --- | --- | --- |
| `pauseHot` | <!-- def:cfg3.pauseHot -->12<!-- /def --> h | Tagesmaximum heute oder gestern über `tHot` (beide Fenster möglich) – oder Nachholfenster nach `max`/`zeit` |
| `pauseSlow` | <!-- def:cfg3.pauseSlow -->48<!-- /def --> h | Feuchteabnahme je 24 h unter `dropSlow` (Staunässe-Verdacht; erst ab 24 h Messreihe) |
| `pause` | <!-- def:cfg3.pause -->24<!-- /def --> h | sonst |

Die Pause gilt als abgelaufen, wenn `(now + 2·tick·60) − st.ts ≥ Pause`: Der Auftrag entsteht einen Takt vor dem Fenster, die Gabe startet 30 s danach. Ohne diese Toleranz von zwei Takten würde eine 24-h-Pause das gleiche Fenster am nächsten Tag um Sekunden verfehlen. Ist die Pause vorbei und keine Trockenphase aktiv, wechselt `st.state` von `sperre` nach `beob`.

## Trockenphase

Die Trockenphase baut Staunässe planmäßig ab, ohne nach jeder Gabe zu warten. Sie beginnt

- beim ersten Takt des Wochentags `dryDay` <!-- def:cfg3.dryDay -->5<!-- /def --> (0 = Sonntag … 6 = Samstag, `null` = nie), Konsole `Trockenphase (Wochentag 5): warte auf < 28 %`;
- sobald eine Taktmessung über `pctHi` liegt – nicht direkt nach einem noch unkontrollierten Fenster –, Konsole `Trockenphase (nass 63 %): …`;
- im Fenster, wenn die Frischmessung über `pctHi` liegt (`nass`).

Solange sie läuft, meldet der Takt `why=trocken`. Sie endet, sobald eine Taktmessung unter `pctDry` liegt; erst dann (und nach abgelaufener Pause) geht es mit `beob` weiter. Das Nachholfenster `pauseHot` gilt nicht in der Trockenphase.

> **Nur Zeitraffer:** Das Profil setzt `dryDay` auf `null` und `pctDry` auf <!-- zr:cfg2.pctDry -->pctLo − 1<!-- /zr -->, die Trockenphase ist damit praktisch aus. Steckt der Sensor beim Start im Wasserglas, beginnt trotzdem eine Trockenphase (`why=trocken`), die endet, sobald die Erde trocken genug für einen Auftrag ist.

## Zustände in st.state

| `st.state` | Bedeutung | Übergang |
| --- | --- | --- |
| `beob` | beobachten, Auftrag möglich | Fenster mit Gabe → `gegossen`; Trockenphase → `sperre` |
| `gegossen` | Fenster mit regulärem Ende, wartet auf die Kontrolle (`rated:false`) | Kontrolle → `sperre` |
| `sperre` | Pause oder Trockenphase läuft (`rated:true`); auch der Claim `laeuft` und nicht-reguläre Fensterenden (`noeff`, `abbruch`, `extern`, `sensor` …) | Pause vorbei und `dryOk` → `beob` |

`st.why` trägt das Ergebnis des letzten Fensters, `laeuft` solange es in Arbeit ist. Weitere Felder: `ts` (Fensterstart), `dur` (Sekunden bis Pumpe-aus der letzten Portion), `n` (Portionen), `sec` (Pumpensekunden), `pctB`/`pctW`/`pctA` (Feuchte vor, nach dem Fenster, bei der Kontrolle), `effW` (Fenstergewinn), `tr` (`tRise` der zweiten Portion), `dryOk` (Trockenphase beendet).

## Tageswechsel

Es gibt keinen eigenen Zeitplan-Eintrag um Mitternacht. `bw_main` berechnet das lokale Datum ohne `Date`-Objekt aus `Sys.time` (HH:MM) und `unixtime` und vergleicht es mit `day.date`. Bei einem Wechsel: `lrn.tMaxY ← tMaxD` (Tagesmaximum gestern), `lrn.tMean` geglättet (0,9 alt + 0,1 neu), Austrocknungsrate `lrn.rate`, `err.mem` (Speicher protokollieren), Trockentag prüfen, `day` auf `{date, n:0, sec:0}` setzen und den Hinweis `limit` löschen.

## KVS-Schreibvorgänge

Geschrieben wird nur, was sich geändert hat. `bw_main` vergleicht `lrn`, `st`, `day`, `err`, `job` mit dem gelesenen Stand; `bw_pump` schreibt je Fenster den Claim und am Ende nur die geänderten von `st`, `day`, `job`, `err`, `lrn` (im Regelfall Claim + `st`/`day`/`job`/`lrn`, also fünf). Im 7-Tage-Modell des Mocks sind das 15–22 Schreibvorgänge je Gießtag (Grenze im Test 24, Durchschnitt unter 18) – statt 96 Takten. `Sys.GetStatus` zeigt mit `kvs_rev` den Zähler aller Schreibvorgänge.

## Ein Tag im Regelbetrieb

1. Takt alle 15 min: `bw_main` misst 5× (Mittel ohne Ausreißer), Temperatur und Wasserstand. Feuchte unter `pctLo` und keine Bremse → `job` mit `ok=true` und `sec` aus der Dosisformel (ohne `effW`: `tStd`).
2. Fenster 08:00:30 oder 20:00:30: `bw_pump` liest `job` (Alter ≤ `jobAge`), rechnet die Frist, misst frisch: `≥ pctOk` → `feucht`, `> pctHi` → `nass`; prüft den Schwimmer und schreibt den Claim `st.why=laeuft`.
3. Portionen: Portion 1, `tSoak` einsickern, messen bis stabil; unter `pctOk` Korrekturportion aus dem gemessenen Gewinn; `≥ pctOk` → `ok`, `> pctHi` → `over`; Grenzen `nPort`, `tMax`, Tagesvorrat, Frist.
4. Fensterende: `effW` und `sf` lernen, `st`/`day`/`job` schreiben, Konsole `ergebnis=…`.
5. Kontrolle `soak` min später: `Kontrolle: pctW → pctA`; über `pctHi + hyst` → `zuviel` (`sf − sfStep`); Abfall über `dropW` → `sink`.
6. Pause: bis `pause` 24 h `why=pause`; lag das Tagesmaximum über `tHot`, nur `pauseHot` 12 h (also beide Fenster); kaum Abnahme → `pauseSlow` 48 h. Höchstens `maxDay` Fenster je Tag, dann `limit`.
7. Freitag (`dryDay` 5): beim ersten Takt des Tages beginnt die Trockenphase, `why=trocken`, keine Gabe, bis eine Taktmessung unter `pctDry` liegt; dann läuft es normal weiter.
8. Nässe: zeigt eine Taktmessung mehr als `pctHi` (nicht direkt nach einem unkontrollierten Fenster), beginnt die Trockenphase sofort.

## Beispielausgabe

> **Am Gerät gemessen (13.09.2026):** Fenster 1 des Zeitraffer-Fahrplans (Takt <!-- zr:cfg3.tick -->3<!-- /zr --> min, Frist <!-- zr:cfg4.tWin -->120<!-- /zr --> s, `pause` <!-- zr:cfg3.pause -->0.2<!-- /zr --> h, `tDead` <!-- zr:cfg3.tDead -->2<!-- /zr --> s, `tDead2` <!-- zr:cfg4.tDead2 -->0<!-- /zr --> s), Sensor in trockener Erde, Schlauch am Sensor.

```text
[bw_main 0.2.0] V=0.603 pct=10.829 tC=23.6 lvl=0 st=beob dry=0 pause=0.2h why=ok sec=12 effW=- sf=0.7 err=- w=3 dauer=5660ms
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] m0 10.4 % → P1 12 s
[bw_pump 0.2.0] P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)
[bw_pump 0.2.0] P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
[bw_main 0.2.0] Kontrolle: 50.5 → 53.7 % sf=0.7
[bw_main 0.2.0] V=1.82 pct=53.7 tC=23.6 lvl=0 st=sperre dry=1 pause=0.2h why=pause sec=- effW=2.006 sf=0.7 err=- w=2 dauer=5385ms
```

So liest man das: Der Takt meldet 10,8 % unter `pctLo`, kein Lernwert (`effW=-`) → Auftrag `tStd` 12 s (Zeitraffer-Wert). Im Fenster misst `m0` 10,4 %, `P1` hebt auf 34 % (+23,6 %, erste Reaktion nach 8 s, stabil nach 12 s); die Korrekturportion wird auf `tPmin` 10 s geklemmt und hebt auf 50,5 % – Ziel `pctOk` 50 erreicht, aber beim Timeout noch steigend → `unstab`.

`g` ist der Gewinn seit `m0` je wirksame Sekunde: `(23,6 + 16,5) / (10 + 10) ≈ 2,0` wird `lrn.effW` (Konsole 2,006, gerechnet mit ungerundeten Werten). Die Kontrolle beim nächsten Takt (Zeitraffer-`soak` 0,25 min) zeigt 53,7 %, kein `zuviel`; danach `st=sperre why=pause`.

Eine `bw_main`-Zeile trägt: Spannung `V`, Feuchte `pct`, Temperatur `tC`, Wasserstand `lvl`, Zustand `st`, `dry` (`st.dryOk`; 0 in `sperre` heißt Trockenphase offen), gewählte Pause, Grund `why`, Auftrag `sec`, Lernwerte, Störung `err`, Zahl der Schreibvorgänge `w`, Laufzeit. Die vollständige Legende aller Codes steht in [13 · Betrieb und Wartung](13-betrieb-und-wartung.md).

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| „Das Fenster pumpt genau `sec` Sekunden“ – es lief länger | `sec` ist nur die Erstportion; Korrekturportionen folgen bis `pctOk`, zusammen bis `tMax`. Nur die Einzelportion (ohne `pct`) pumpt genau `clamp(sec, 1, min(tPmax, tMax))` | Konsole lesen: eine `P`-Zeile je Portion, `ergebnis=` mit `n` und `sec` |
| „Die Kontrolle 30 min später lernt“ – `effW` ändert sich dort nicht | Die Kontrolle setzt nur die Hinweise `zuviel`/`sink` und ggf. `sf`; `effW` kommt aus dem Fenster | `ergebnis=… effW=…` im Fenster ansehen |
| `why=pause`, obwohl nichts gegossen wurde | Fenster abgebrochen: der Claim `st.why=laeuft` hält die Pause (Absturz, Stop, Strom) – oder das Fenster endete nicht regulär | `st` lesen; die Pause läuft normal ab, ein Handstart binnen `jobAge` gießt nicht |
| Takt meldete `ok`, das Fenster `feucht` | Frischmessung `m0 ≥ pctOk`: zwischen Takt und Fenster wurde von Hand gegossen oder der Sensor liegt anders | nichts; keine Pause, kein Lernwert, nächster Takt entscheidet neu |
| `why=trocken`, obwohl die Erde nicht nass ist | Trockenphase endet erst unter `pctDry` (28 %), nicht unter `pctLo` | warten oder `pctDry` prüfen ([03 · Konfiguration](03-konfiguration.md)) |
| `why=soak` | das letzte Fenster wartet noch auf die Kontrolle | erledigt sich `soak` min nach dem Fenster |
| `why=cfg` nach einem Update | Band unvollständig (z. B. `pctOk` oder `dropSlow` fehlt) oder Ordnung verletzt; `err=cfg` | fehlendes Feld eintragen, Installer starten |
| Handstart endet sofort mit `zeit` | die Frist bis zum nächsten Takt reicht nicht für Portion 1 samt Messzeit | kurz nach einem Takt starten (Sekunde 30) |
| `err=noeff`, nichts gießt mehr | zwei volle Portionen ohne messbare Wirkung (Σ < `dEffMin`) | Pumpe, Schlauch, Sensorlage prüfen, dann `err` löschen ([13 · Betrieb und Wartung](13-betrieb-und-wartung.md)) |

## Weiter zu

- [03 · Konfigurations-Zusammenspiel](03-konfiguration.md) – jedes Feld aus diesem Kapitel: Startwert, Wirkung, wann der Installer neu laufen muss
- [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md) – warum die Pumpe auch ohne Script ausgeht (`toggle_after`, `auto_off`, Sicherheits-Aus)
- [13 · Betrieb und Wartung](13-betrieb-und-wartung.md) – Konsole ablesen, alle `why`- und `err`-Codes, von Hand gießen
- [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md) – die Gründe hinter Regelkreis, Frist und Trockenphase (Entscheidungen 38–63)
