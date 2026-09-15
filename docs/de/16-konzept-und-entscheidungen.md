# 16 · Konzept und Entscheidungen (Stand 0.2.0)

**Deutsch** · [English](../en/16-konzept-und-entscheidungen.md) — [Handbuch](README.md) · Teil F „Entwicklung“

> **Auf einen Blick**
> - Warum das System so gebaut ist: der Zeitplan des Geräts steuert, jedes Script rechnet nur Sekunden, alles Wissen liegt im KVS – und Wasser fließt nur, wenn eine Messung es verlangt.
> - Ein Lesekapitel. Es verschmilzt sechs historische Dateien (Projektanalyse v1, Konzept v2, Architektur v1, Umsetzungsplan v1 und v2, Onboarding-Prompt) mit den Nachträgen der Entscheidungstabelle; die Nummern der Entscheidungen 1–63 sind dieselben wie in [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md).
> - Kernzahlen: Takt <!-- def:cfg3.tick -->15<!-- /def --> min, Fenster <!-- def:cfg3.winA -->08:00<!-- /def --> und <!-- def:cfg3.winB -->20:00<!-- /def -->, Erstportion mit Sicherheitsfaktor `sf` <!-- def:lrn.sf -->0.7<!-- /def -->, höchstens `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s je Fenster – alles im KVS, nichts im Code.
> - Größter Denkfehler: „keine Wirkung“ mit „mehr Wasser“ beantworten. Die Regel `noeff` verbietet genau das – seit der ersten Projektanalyse und bis heute.

## Voraussetzungen

- keine – ein Lesekapitel. Die Bauteile und Scripts erklärt [01 · Gesamtarchitektur](01-gesamtarchitektur.md), den Tagesablauf [02 · Flussdiagramm](02-flussdiagramm.md), jedes Feld [03 · Konfiguration](03-konfiguration.md), die Grenzen [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md).

## Diagramm

[![Prinzipien-Karte 0.2.0: Zeitplan steuert, kein Zustand im RAM, keine Zahl im Code, drei Scripts, messgeführt, Regelkreis im Fenster, Lernwert, keine Wirkung heißt nie mehr Wasser, dreifache Abschaltung, Wochen-Trockenphase, Gerätebefunde, Verworfenes](../diagramme/de/16-konzept-und-entscheidungen.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/16-konzept-und-entscheidungen.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/16-konzept-und-entscheidungen.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Bauweise“, 2 „Regelung“, 3 „Sicherheit“, 4 „Verworfen“. Die Zahlen in Klammern sind Entscheidungsnummern aus [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md).

## Ausgangslage und Aufgabenstellung

Am 12.09.2026 hat der Projektleiter die Aufgabe in einem Onboarding-Prompt festgeschrieben: ein Shelly Plus Uni (Firmware 2.0.0, Gen2-Scripting in mJS) misst alle 15 Minuten Bodenfeuchte, Umgebungstemperatur und Wasserstand, entscheidet selbst, ob und wie lange gegossen wird, und schaltet um 08:00 und 20:00 über ein Relais eine Pumpe. Das System lernt die Wirkung einer Pumpensekunde, passt sich an Sommer und Winter an und baut Staunässe durch Trockenphasen ab. Alles läuft autark am Gerät, ohne Backend.

Drei Dinge waren damit gesetzt und sind es bis heute:

| Vorgabe | Inhalt | Folge im Bau |
| --- | --- | --- |
| Hardware fest | Ausgang 0 schaltet ein vorhandenes Relais, das Relais die Pumpe (Gardena Urlaubsbewässerung 970548801); SMT50 am Analogeingang mit eigener Kalibrierung; DS18B20 am Ein-Draht-Bus; Schwimmer an Eingang 1 (1 = leer, am Aufbau zu bestätigen); Internet meist da, fällt aber aus | keine Pumpenlast am Shelly, relative Feuchteskala, Zeitsteuerung nur über den internen Zeitplan |
| Gerätegrenzen | höchstens 3 Scripts zugleich; KVS 50 Einträge zu je 253 Zeichen; Zeitplan 20 Einträge zu je 5 Aufrufen; Dauerscripts stürzen nach Stunden ab | jedes Script ist ein Einmal-Läufer, kurze Feldnamen, kein Zustand im RAM |
| Arbeitsregeln | Etappen mit Prüfschritt, nichts bauen, was nicht im Plan steht; Versionszeile in jeder Datei; keine erfundenen Anforderungen, eine Frage je Nachricht; Aufrufe gegen die Shelly-Gen2-Doku prüfen; keine Cloud-Aufrufe | Entscheidungstabelle, Prüfprotokoll, `lib_notes` als RPC-Referenz, Mock statt Gerät für jeden Zwischenstand |

### Was seit dem 12.09.2026 anders ist

Der Prompt beschreibt den Stand 0.1.0. Einige seiner Zahlen und Sätze gelten in 0.2.0 nicht mehr; die Gründe stehen in den Abschnitten unten.

| Im Prompt | Stand 0.2.0 | Warum |
| --- | --- | --- |
| „genau drei Scripts“ | sechs Scripts: drei Betriebs-Scripts, zwei Hardware-Test-Scripts, ein Zeitraffer-Script – nie mehr als eines der großen zugleich | Hardware-Test und Zeitraffer als eigene Scripts (Entscheidungen 21, 30) |
| Trockenpunkt 0,20 V | gemessen 0,296 V, Nasspunkt 3,134 V (13.09.2026, `bw_hwtest`) | Kalibrierung am echten Aufbau, automatisch nach `cfg1` (26) |
| `cfg1/cfg2/cfg3` | `cfg1..4` – `cfg4` trägt den Fenster-Regelkreis | 253 Zeichen je Eintrag (53) |
| Lernen 30 min nach der Gabe in `bw_main`, Lernwert `eff` | `bw_pump` lernt `lrn.effW` im Fenster aus stabilisierten Messungen; der 30-min-Wert ist nur Kontrolle | Regelkreis im Fenster (38, 39, 43) |
| Sicherheits-Aus um 08:05 und 20:05 | 08:08 und 20:08 (`0 8 8,20 * * *`), aus `tWin` gerechnet | Fenster-Budget 420 s (54) |
| `tMax` 120 s je Gabe | `tMax` <!-- def:cfg3.tMax -->180<!-- /def --> s je Fenster, `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s je Portion | Portionen statt einer Gabe (41) |
| Auftrag nur bei Trockenphase nach jeder Gabe | Wochen-Trockenphase ab Freitag und bei Nässe | Entscheidung 58 |
| nur die Shelly Web-UI als Werkzeug: „Scripts in Web-UI einfügen“, `tools/` optional (Interview 12.09.2026, Architektur v1 Abschnitte 1 und 5) | Web-UI bleibt für KVS und Konsole; Build, Upload, Prüfung und Tests laufen über `tools/` und den Mock, Upload per RPC | Testhelfer (4), Editor verliert Text (19), Mock (27) |
| Script-IDs über `Script.List` nach Namen | unverändert – die IDs vergibt das Gerät | – |

### Der Onboarding-Prompt im Wortlaut

Der Text vom 12.09.2026 bleibt als Quelle erhalten; Zahlen darin sind Stand 0.1.0.

<details markdown="1">
<summary>Onboarding-Prompt (Teil A des Onboarding-Dokuments v1, unverändert)</summary>

```text
# Projekt: Shelly Plus Uni – lernende Pflanzenbewässerung

Du bist mein Entwicklungspartner für ein DIY-Bewässerungssystem. Ich bin
Projektleiter und Entscheider, du programmierst und dokumentierst. Wir
arbeiten in Etappen mit Prüfschritt; nichts wird gebaut, was nicht im
Plan steht. Sprache: Deutsch. Code-Kommentare: Deutsch. Variablennamen:
Englisch, kurz.

## Was wir bauen
Ein Shelly Plus Uni (Firmware 2.0.0, Gen2-Scripting in mJS) misst alle
15 Minuten Bodenfeuchte, Umgebungstemperatur und Wasserstand, entscheidet
selbst, ob und wie lange gegossen wird, und schaltet um 08:00 und 20:00
über ein Relais eine Wasserpumpe. Das System lernt die Wirkung einer
Pumpensekunde, passt sich an Sommer und Winter an und baut Staunässe
durch Trockenphasen ab. Alles läuft autark am Gerät, ohne Backend.

## Hardware (fest)
- Shelly Plus Uni; Ausgang 0 schaltet ein vorhandenes Relais, das Relais
  schaltet die Pumpe (Gardena Urlaubsbewässerung 970548801)
- SMT50 Bodenfeuchtesensor am Analogeingang (Voltmeter):
  0,20 V = trocken (0 %), 3,13 V = im Wasser (100 %), eigene Kalibrierung
- DS18B20 Temperaturfühler am Ein-Draht-Bus, misst Umgebung
- Wasserstandsensor am Eingang 1: 1 = leer, 0 = Wasser vorhanden
  (am Aufbau noch zu bestätigen)
- Internet meist vorhanden, fällt aber öfter aus. Zeitsteuerung nur über
  den internen Shelly-Zeitplan.

## Gerätegrenzen (harte Fakten)
- max. 3 Scripts gleichzeitig → wir nutzen genau drei
- KVS: 50 Einträge à max. 253 Zeichen → kurze Feldnamen, kompaktes JSON
- Zeitplan: 20 Einträge, je bis zu 5 Aufrufe
- Erfahrung: Dauerscripts stürzen nach Stunden ab → jedes Script ist ein
  Einmal-Läufer: starten, Arbeit erledigen, Script.Stop auf sich selbst.
  Kein Zustand im RAM, alles im KVS.

## Architektur (entschieden, nicht verhandelbar)
Script 0 „bw_install": einmalig von Hand gestartet. Legt Zeitplan-
  Einträge an (alle 15 min → Script 1; 08:00 und 20:00 → Script 2;
  08:05 und 20:05 → Switch.Set Ausgang 0 aus als Sicherheits-Aus),
  schreibt cfg1/cfg2/cfg3 nur wenn nicht vorhanden, ermittelt Script-IDs
  über Script.List nach Namen.
Script 1 „bw_main": alle 15 min. Misst, bewertet, lernt, bestimmt Pause
  und schreibt einen Gießauftrag in den KVS-Eintrag „job". Rührt die
  Pumpe nie an. Übernimmt den Tageswechsel per Datumsvergleich.
Script 2 „bw_pump": 08:00 und 20:00. Liest „job", prüft Freigaben
  (job.ok, Alter des Auftrags, Tageslimit, Wasserstand), schaltet
  Ausgang 0 mit toggle_after = Sekunden, überwacht währenddessen den
  Wasserstand, schreibt Ergebnis in „st" und „day", setzt job.ok=false.

## Keine Konfiguration im Code
Jeder Schwellenwert, jede Zeit, jede Grenze liegt im KVS. Fehlt ein
Pflichtfeld, setzt das Script „err" und tut nichts. Katalog in
docs/umsetzungsplan-v2.md, Kurzfassung:
- cfg1 Sensor: vDry 0.20, vWet 3.13, vErrLo 0.10, vErrHi 3.35,
  nSample 5, lvlEmpty 1, nLvl 3
- cfg2 Regelung: pctSoll (SOLL-Mittelwert, Ziel jeder Gabe), pctLo,
  pctHi, pctDry, hyst 2, dropSlow, effMin 0.05, effMax 2.0, alpha 0.3
  – die pct-Werte und dropSlow sind noch offen und werden aus zwei
  Messungen an der Pflanze eingetragen; bis dahin null
- cfg3 Pumpe/Zeiten: tDead 20, tMin 40, tStd 70, tMax 120, tHot 35,
  pauseHot 12, pause 24, pauseSlow 48, soak 30, jobAge 20, maxDay 2

## Regelungskern (aus docs/konzept-v2.md und docs/umsetzungsplan-v1.md)
- Feuchte % = (V − vDry) / (vWet − vDry) × 100, begrenzt 0…100;
  mehrere Messungen, Mittelwert der mittleren Werte
- Auftrag nur wenn: Feuchte < pctLo UND Pause abgelaufen UND
  Trockenphase nachgewiesen UND Wasser vorhanden UND keine Störung
- Dosis: sec = (pctSoll − ist) / lrn.eff + tDead, begrenzt tMin…tMax;
  unter tMin → kein Auftrag. Erste Gabe überhaupt: tStd.
- Lernen 30 min nach Gabe: eff_neu = Δ% / (sec − tDead);
  lrn.eff = (1−alpha)·alt + alpha·neu, begrenzt effMin…effMax
- „Gegossen, keine Wirkung" → err, kein Lernwert, NIE mehr Wasser
- Pause: Tagesmax > tHot → pauseHot; Abnahme/24 h < dropSlow →
  pauseSlow; sonst pause
- Sensor unplausibel (V < vErrLo oder > vErrHi) → err, kein Auftrag
- Wasser leer während Gabe → sofort aus, kein Lernwert
- KVS schreiben nur bei Änderung, nie „einfach jeden Takt"

## KVS-Vertrag
cfg1, cfg2, cfg3 (Konfiguration) · lrn {eff, rate, tMean, tMax24} ·
st {state, ts, sec, pctB, pctA, rated, dryOk} · job {ok, sec, pct, why,
ts} · day {date, n, sec} · err {code, ts, mem}. Details und wer was
liest/schreibt: docs/umsetzungsplan-v1.md Abschnitt 4.

## Repository
Öffentliches GitHub-Repo, MIT-Lizenz. Struktur:
  README.md, LICENSE, docs/ (die fünf Konzeptdokumente + PLAN.md),
  scripts/bw_install.js, scripts/bw_main.js, scripts/bw_pump.js,
  scripts/lib_notes.md (Shelly-API-Aufrufe, die wir nutzen, mit Link),
  hardware/ (Stückliste, Verdrahtung als ASCII und später Foto),
  tools/ (optional: Test-Helfer, KVS-Dump per curl)
README-Anforderung: Ein Einsteiger UND ein Profi müssen das Projekt
vollständig nachbauen können. Inhalt: Zweck in drei Sätzen · Stückliste
mit Bezugsquelle · Verdrahtung Schritt für Schritt mit Bild/ASCII ·
Kalibrierung (Trocken-/Nasspunkt messen, zwei Pflanzenmessungen) ·
Installation (Scripts in Web-UI einfügen, Installer starten) ·
Konfiguration (alle KVS-Felder erklärt) · Betrieb und Ablesen ·
Störungen und was sie bedeuten · Sicherheit (Pumpe, Wasser, Strom) ·
Funktionsweise für Interessierte · Grenzen des Shelly.

## Arbeitsregeln
1. Wir gehen docs/PLAN.md Etappe für Etappe. Vor jeder Etappe zeigst du
   mir, was du bauen wirst; nach jeder Etappe den Prüfschritt.
2. Jede Datei bekommt eine Versionszeile im Kopf; Änderungen werden
   nicht still überschrieben, sondern im Commit benannt.
3. Erfinde keine Anforderungen. Ist etwas unklar, frag mich – eine Frage
   pro Nachricht.
4. Halte dich an die Shelly-Gen2-API-Dokumentation
   (https://shelly-api-docs.shelly.cloud/gen2/). Prüfe Aufrufnamen und
   Parameter dort, bevor du sie verwendest; rate nicht.
5. Scripts müssen ohne Internet laufen. Keine Cloud-Aufrufe.
6. Lies zuerst docs/ vollständig, fasse mir in zehn Zeilen zusammen, was
   du verstanden hast, und nenne offene Punkte. Dann beginnen wir mit
   Etappe 0.
```

</details>

## Bauprinzipien

### Der Zeitplan steuert, das Script rechnet kurz

Die Erfahrung aus dem Betrieb: dauerhaft laufende Scripts stürzen auf dem Shelly nach Stunden ab, der Zeitplan des Geräts ist dagegen stabil. Deshalb ist jedes Betriebs-Script ein **Einmal-Läufer**: der Zeitplan startet es, es erledigt genau einen Arbeitstakt und beendet sich mit `Script.Stop` auf die eigene ID. Ein Script, das nur Sekunden lebt, kann keinen Speicher über Stunden zulaufen lassen; stürzt ein Takt ab, startet der Zeitplan den nächsten ganz normal. Ein Ausfall kostet einen Takt, nicht den Betrieb.

Der Zeitplan ist der Motor, das Script der Kopf, der KVS das Gedächtnis (Architektur v1). Er gibt nur den **Takt** vor, nicht den Gießzeitpunkt – das bleibt der Unterschied zu einer Zeitschaltuhr. Konzept v2 plante drei Einträge (Arbeitstakt, Sicherheits-Aus, Tageswechsel); der Installer legt heute diese an:

| Eintrag | Timespec | Aufruf | Herkunft |
| --- | --- | --- | --- |
| Arbeitstakt | `0 */15 * * * *` (aus `cfg3.tick`) | `Script.Start` `bw_main` | Konzept v2 0.2; Takt 10 min im Interview 12.09.2026, 15 min mit der Aufteilung in drei Scripts |
| Gießfenster | `30 0 8,20 * * *` (aus `winA`/`winB`, Sekunde 30; zwei Einträge, wenn die Minuten verschieden sind) | `Script.Start` `bw_pump` | Vorgabe 12.09.2026 „ausschließlich um 08:00 und 20:00“ (Umsetzungsplan v1); Sekunde 30 seit Entscheidung 37 |
| Sicherheits-Aus | `0 8 8,20 * * *` (aus `cfg4.tWin`, aufgerundet) | `Switch.Set {on:false}` | Konzept v2 0.2 „kein Script und keine Logik“; Minute 8 seit Entscheidung 54 |
| Tageswechsel | kein Eintrag | `bw_main` vergleicht `day.date` mit dem Datum | Umsetzungsplan v1 Abschnitt 4: spart einen Eintrag und ein Script |

Ein Arbeitstakt folgt bis heute dem Ablauf aus Konzept v2 (0.3): Zustand lesen, Feuchte messen (mehrere Werte, Mittel der mittleren, Plausibilität), Temperatur, Wasserstand (mehrfach, stabil), entscheiden, schreiben (nur bei Änderung), Ende. Nur der Schritt „Pumpe schalten“ ist seit dem Umsetzungsplan v1 in ein eigenes Script gewandert.

Der Zeitplan braucht eine gültige Uhrzeit (NTP). Konzept v2 (0.7) schlug für Standorte ohne Internet einen Notbetrieb mit eigenem Takt vor; das Interview vom 12.09.2026 hat ihn verworfen: nach einem Stromausfall ohne Internet pausiert das System, bis die Uhrzeit wieder da ist. Solange das Gerät durchläuft, hält es die Zeit auch ohne Internet. Dieses Restrisiko ist bewusst akzeptiert (Architektur v1 Abschnitt 7).

### Kein Zustand im RAM

Alles, was der nächste Takt wissen muss, liegt im KVS: `cfg1..4`, `lrn`, `st`, `job`, `day`, `err`. Jeder Takt liest den Zustand neu und entscheidet von vorn. Es gibt keinen Zeitpunkt, an dem das System „mitten in etwas“ ist und ein Neustart es verwirren würde (Konzept v2 0.4). Die Zustandsmaschine hat sich mit dem Regelkreis vereinfacht:

| Konzept v2 | Bedeutung damals | Stand 0.2.0 |
| --- | --- | --- |
| Beobachten | nur messen | `st.state = beob` |
| Gegossen | Gabe abgeschlossen, Pumpe längst aus | `gegossen` – wartet auf die Kontrolle `soak` min nach dem Fensterende |
| Einsickern | Messung noch nicht aussagekräftig | kein eigener Zustand mehr: das Einsickern (`tSoak`) und die Stabilisierung liegen im Fenster, in `bw_pump` |
| Sperre | Trockenphase oder Pause läuft | `sperre`; `st.dryOk` sagt, ob die Trockenphase beendet ist |
| Störung | Gießen gesperrt, bis die Ursache weg ist | getrennt in `err.code`; blockierende Codes löschen sich selbst, `noeff` nur von Hand (Entscheidung 8) |

Geschrieben wird nur bei Zustandswechsel, nie „einfach jeden Takt“ – der KVS liegt im Flash. Bei 15-Minuten-Takt wären das rund hundert Schreibvorgänge am Tag; tatsächlich sind es 15 bis 22 an einem Gießtag (Budget ≤ 24, gemessen in der 7-Tage-Simulation; Prüfprotokoll: `kvs_rev` morgens und abends vergleichen). Zeitrechnung läuft über Zeitstempel statt Taktzähler (Konzept v2 4.7) – möglich, weil der Zeitplan ohnehin eine gültige Uhrzeit voraussetzt; im Fenster kommt die Zeit aus `Shelly.getUptimeMs()`, nie aus Tick-Zählern (44).

Zwei Gerätebefunde haben das Prinzip geschärft: KVS-Werte sind **JSON-Strings** (15), weil die Web-UI Objekte nur als `[object Object]` zeigt und `cfg2` von Hand gepflegt wird; und der Installer **ersetzt unlesbare Einträge** durch Startwerte (16), ergänzt fehlende Felder (32) und überschreibt gültige Werte nie. Nach einem Absturz mitten im Fenster gilt seit Konzept v2 (0.5): kein Lernwert aus einer unsicheren Gabe – heute über den Claim `st.why = laeuft` (42).

### Drei Scripts statt eins

Konzept v2 und Architektur v1 kannten ein Script, das misst und im selben Takt schaltet. Die Vorgabe vom 12.09.2026 – gießen nur um 08:00 und 20:00 – trennt Messen und Gießen: `bw_main` misst alle 15 Minuten und **entscheidet nur**, `bw_pump` gießt in den Fenstern, `bw_install` legt einmalig Zeitplan, Startwerte und Switch-Konfiguration an.

Der KVS-Eintrag `job` ist die Schnittstelle: `bw_main` schreibt hinein, `bw_pump` liest und führt aus. Weil der Auftrag bei jeder Änderung und vor jedem Fenster neu geschrieben wird (11), gilt um 08:00 die Entscheidung von 07:45, nicht eine veraltete von gestern (`jobAge` <!-- def:cfg3.jobAge -->20<!-- /def --> min).

Seit 0.2.0 ist die Aufgabenteilung schärfer (38):

| Script | entscheidet über | schreibt |
| --- | --- | --- |
| `bw_main` (Takt) | Bandordnung, Plausibilität, Tageswechsel, Trockenphase, Pause, Tageslimit, Auftrag mit Erstportion; Kontrolle `soak` min nach dem Fenster (`zuviel` → `sf`, Hinweis `sink`, Nachholpause) | `job`, `st` (Kontrolle), `lrn` (`sf`, Tagesmaximum, `tMean`, `rate`), `day`, `err` |
| `bw_pump` (Fenster) | Frischmessung, Portionen, Stabilität, Urteil des Fensters, Lernwert, Frist | Claim `st`, am Ende `st`, `day`, `job`, `lrn.effW`/`sf`, `err` |
| `bw_install` (einmal) | Zeitplan aus `cfg3`/`cfg4`, fehlende Felder, `auto_off`, kein Autostart der Scripts (`Script.SetConfig` mit `enable: false` – in der Gen2-API heißt `enable` „Autostart beim Boot“) | `cfg1..4`, leere Zustände, Zeitplan, Switch-Config |

Dazu kommen drei Scripts, die nur von Hand starten und nie im Zeitplan stehen: `bw_hwtest` und `bw_hwpump` (21: ein einziges Test-Script wäre 23,7 KB kompakt gewesen, deshalb Sensor- und Pumpenteil getrennt; der Pumpentest schaltet die Pumpe nie selbst, sondern beauftragt `bw_pump`, 23) und `bw_zeitraffer` (30: ein reines Profil mit kurzen Zeiten, die Betriebs-Scripts laufen unverändert).

### Keine Konfiguration im Code

Umsetzungsplan v2 hat den Grundsatz festgeschrieben: jeder Schwellenwert, das Zielband, jede Zeit und jede Grenze liegen im KVS; die Scripts lesen sie bei jedem Start. Fehlt ein Pflichtfeld, setzt das Script `err = cfg` und tut nichts. Der Installer schreibt Startwerte nur, wenn der Eintrag fehlt – Handänderungen in der Web-UI überleben eine Neuinstallation. Wegen der 253 Zeichen je Eintrag ist die Konfiguration aufgeteilt: `cfg1` Sensor, `cfg2` Zielband, `cfg3` Pumpe und Zeiten, `cfg4` Fenster-Regelkreis (53). Alle Felder mit Startwert stehen in [03 · Konfiguration](03-konfiguration.md).

Der Katalog aus Umsetzungsplan v2 ist in 0.2.0 an diesen Stellen gewachsen (Abweichungen laut Entscheidungstabelle):

| Eintrag | dazugekommen | Grund |
| --- | --- | --- |
| `cfg1` | `msSample` <!-- def:cfg1.msSample -->500<!-- /def --> ms, `idV`/`idT`/`idLvl`/`idSw` | Zeitkonstanten und Komponenten-IDs gehören in den KVS (5) |
| `cfg2` | `sfMin` <!-- def:cfg2.sfMin -->0.5<!-- /def -->, `sfStep` <!-- def:cfg2.sfStep -->0.1<!-- /def -->, `pctOk`, `dropW`, `sfUp` <!-- def:cfg2.sfUp -->0.05<!-- /def -->; `effMax` 2 → <!-- def:cfg2.effMax -->30<!-- /def --> | Sicherheitsfaktor (10, 43), Zielpunkt „erreicht“ (47), Gewinnskala am Gerät (40) |
| `cfg3` | `tChk` <!-- def:cfg3.tChk -->5<!-- /def --> s, `winA`/`winB` funktional, `tick`, `winEvery`, `dryDay` <!-- def:cfg3.dryDay -->5<!-- /def -->; `tMin` 40 → <!-- def:cfg3.tMin -->25<!-- /def -->, `tMax` 120 → <!-- def:cfg3.tMax -->180<!-- /def --> | Takt und Fenster waren der letzte Rest Zeitkonstanten im Code (29); Trockentag (58); Summe je Fenster (41) |
| `cfg4` | neu: `tWin`, `tTail`, `nPort`, `tPmin`, `tPmax`, `tSoak`, `tStep`, `tStab`, `nStab`, `dStab`, `tDead2`, `dEffMin` | Regelkreis im Fenster; `cfg3` hätte die 253 Zeichen gesprengt (53) |
| `lrn` | `sf`, `tMaxD`/`tMaxY` statt `tMax24`, `effW` statt `eff` | die Hitzeregel muss um 08:00 das Maximum des Vortags kennen; Fensterlernen (43) |

Die Rollen der Bandfelder stammen aus Umsetzungsplan v2: `pctLo` entscheidet **ob** gegossen wird, `pctSoll` **wie viel** – die einzige Zahl, die die Dosis bestimmt.

### Upload aus dist/, Prüfung Byte für Byte

Der Script-Speicher am Gerät ist begrenzt, und die Kompakt-Ausgabe schont den geteilten Heap: `npm run build` entfernt Kommentare, Einrückung und Leerzeilen (17); nur die Versionszeile und die `//!`-Zeilen bleiben als Geräte-Doku stehen (35). `size.test.js` hält jedes Script unter <!-- fact:size_limit -->16 000<!-- /fact --> B, `bw_pump` unter <!-- fact:size_limit_pump -->18 000<!-- /fact --> B – heute <!-- fact:dist.bw_main -->15 791<!-- /fact --> B und <!-- fact:dist.bw_pump -->17 475<!-- /fact --> B. `scripts/` bleibt die einzige Quelle.

Weil der Editor der Web-UI beim Einfügen das Dateiende verlor (166 bzw. 210 Byte, 12.09.2026), lädt `put-script.js` per `Script.PutCode` in Stücken hoch und vergleicht den Code am Gerät byteidentisch; `verify-scripts.js` wiederholt diese Prüfung für alle Scripts (19, 35). Werkzeuge und Ablauf: [14 · Debuggen und Testen](14-debuggen-und-testen.md).

## Regelungskern

### Messgeführt statt zeitgeführt

Es gibt keinen festen Gießplan. Gegossen wird, wenn die Taktmessung unter `pctLo` fällt; die Menge ist der Weg von Ist bis `pctSoll`. Der Jahreszeit-Effekt ergibt sich von selbst: im Sommer trocknet die Erde schneller aus, die Untergrenze wird häufiger erreicht, im Winter seltener – ohne Kalenderlogik (Projektanalyse v1 4.1).

Die Feuchteskala ist eine eigene Kalibrierung, kein Datenblattwert (Frage 1 der Projektanalyse, in Konzept v2 geklärt): 0 % = `vDry` (Sensor trocken in Luft), 100 % = `vWet` (Sensor im Wasser), dazwischen linear, begrenzt auf 0 bis 100. Das Datenblatt endet bei 3 V für 50 Volumenprozent; gemessen wurden 3,13 V und später 3,134 V im Wasser – für die Regelung ohne Belang, weil die Skala über eigene Messpunkte definiert ist. 100 % heißt „Sensor steht im Wasser“: ein Kalibrierpunkt, nie ein Zielwert. Das Zielband liegt deutlich darunter.

Rauschen und Plausibilität (Projektanalyse 1.2, 1.3): ein Feuchteprozent sind rund 0,03 V am 0–15-V-Eingang, Einzelwerte streuen. Deshalb `nSample` <!-- def:cfg1.nSample -->5<!-- /def --> Werte je Messung (Mittel der mittleren Werte im Takt, Median im Fenster), eine Hysterese `hyst` <!-- def:cfg2.hyst -->2<!-- /def --> % an der Untergrenze und Plausibilitätsgrenzen `vErrLo` <!-- def:cfg1.vErrLo -->0.10<!-- /def --> und `vErrHi` <!-- def:cfg1.vErrHi -->3.35<!-- /def --> V.

Ein abgerissenes Kabel liefert 0 V und sähe wie „völlig trocken“ aus – genau dann würde ungeprüft gegossen. Die Plausibilitätsregel (`err = sensor`, keine Gabe) ist deshalb die wichtigste einzelne Schutzregel.

### Zielband aus Messung

Konzept v2 (4.2) ersetzt geschätzte Startwerte (Projektanalyse: 35/48/60 %) durch zwei Messungen an der echten Pflanze: einmal kräftig gießen, 30 Minuten warten, messen („gut versorgt“); warten, bis die Pflanze sichtbar Wasser braucht, messen („jetzt gießen“). So passen die Zahlen zu Pflanze, Substrat und Topfgröße, ohne dass jemand sie erfinden muss (Frage 8). Am Gerät wurde dafür am 13.09.2026 ein Beispielband von Hand gesetzt; der Kalibrierlauf `hwtest.js kal` liefert die Datenbasis ([12 · Erstinbetriebnahme](12-erstinbetriebnahme.md)).

Seit 0.2.0 hat das Band fünf Felder mit fester Ordnung `pctDry < pctLo < pctOk ≤ pctSoll < pctHi` und `pctLo + hyst < pctOk`; verletzt ein Handeintrag sie, meldet `bw_main` `why=cfg` (47). Beispielband 28 < 40 < 50 ≤ 55 < 60:

| Feld | Frage | bezieht sich auf | Entscheidung |
| --- | --- | --- | --- |
| `pctLo` | ob ein Auftrag entsteht (`≥ pctLo` heißt `feucht`, mit laufendem Auftrag `≥ pctLo + hyst`) | Taktmessung | 47 |
| `pctSoll` | wie viel die Erstportion anstrebt | stabilisierte Fensterablesung | 39, 47 |
| `pctOk` | ab wann keine weitere Portion nötig ist; Frischmessung `≥ pctOk` → `feucht` | Fensterablesung | 47, 49 |
| `pctHi` | ab wann es „zu viel“ ist (`over`, `zuviel`) und Nässe eine Trockenphase auslöst | Fensterablesung bzw. Taktmessung | 39, 58 |
| `pctDry` | wann eine Trockenphase endet | Taktmessung | 58 |

Die Bezugsgröße (39) ist die stabilisierte Ablesung im Fenster: der Sensor sitzt mittig unter den Tropfern und misst den nassesten Punkt, schnell. Der Wert 30 Minuten später ist gedrainter Boden und geht nie in den Lernwert.

### Lernwert je wirksame Sekunde

Ein einziger Lernwert steuert die Dosierung: wie viele Feuchteprozent eine **wirksame** Pumpensekunde bringt (`lrn.effW`). Wirksam heißt: abzüglich der Totzeit. Die ersten Sekunden füllen nur den Schlauch – im Interview vom 12.09.2026 „unter 20 s kommt kein Wasser an“, daraus `tDead` <!-- def:cfg3.tDead -->20<!-- /def --> s; der Messlauf am 13.09.2026 zeigte am Testaufbau 3-s-Pulse ohne Wirkung und eine erste Reaktion (`tRise`) nach 5 bis 8 s, `tDead2` <!-- def:cfg4.tDead2 -->8<!-- /def --> s für Folgeportionen bei vollem Schlauch.

Die Totzeit gehört zum Schlauch, nicht zur Pflanze: am Endaufbau mit `hwtest.js mess` nachmessen, `kal write` schreibt `tDead`/`tDead2` aus `tRise`.

Der Ablauf ist seit Projektanalyse v1 (4.3) derselbe, nur der Ort hat sich verschoben: Feuchte vor der Portion merken, Sekunden = Weg geteilt durch Lernwert, pumpen, einsickern, nachmessen, Wirkung je Sekunde rechnen, Lernwert sanft nachziehen – `alpha` <!-- def:cfg2.alpha -->0.3<!-- /def --> (70 % alt, 30 % neu), geklemmt auf `effMin` <!-- def:cfg2.effMin -->0.05<!-- /def --> bis `effMax` <!-- def:cfg2.effMax -->30<!-- /def --> %/s, damit ein Ausreißer den Wert nicht kippt.

`effMax` war 2 und wurde auf 30 gesetzt, weil 5 s Pumpen am Aufbau die Feuchte von 0 auf 36 bzw. 54 % hoben (40). Der Startwert wird aus der ersten Standardgabe `tStd` <!-- def:cfg3.tStd -->70<!-- /def --> s gemessen, nicht geschätzt.

Der Sicherheitsfaktor `sf` (10, 43) startet bei <!-- def:lrn.sf -->0.7<!-- /def -->: die Erstportion landet bewusst unter dem Ziel, den Rest holen Korrekturportionen im Fenster – lieber nachlegen als überschwemmen. Endet ein Fenster mit einer einzigen Portion über `pctHi` (`over`), sinkt `sf` um `sfStep` (nie unter `sfMin`); endet es erst nach Korrekturportionen im Band, steigt `sf` um `sfUp` (höchstens 1).

Die Erstportion rechnet `bw_main`: `sec = (pctSoll − ist) / effW · sf + tDead`, geklemmt auf `tMin` … `tMax`; ohne Lernwert `tStd`. Aus `tmin` (kein Auftrag unter der Mindestgabe) wurde in 0.2.0 eine Klemme auf `tMin` (38).

### Regelkreis im Fenster

Bis 0.1.x gab `bw_pump` je Fenster genau eine Dosis, `bw_main` bewertete 30 Minuten später, und eine zu kleine oder zu große Gabe wurde frühestens am nächsten Tag korrigiert („eine Portion pro Takt, die nächste entscheidet der nächste Takt“, Konzept v2 4.4). Die Beobachtung am Aufbau vom 13.09.2026 – sehr trockene Erde springt nach einer Gabe oft nur auf 20 %, mehr als 60 % war zu viel – führte zum Nachtrag im Konzept, der 4.3 und 4.4 ersetzt: der Regelkreis schließt sich **im Fenster**.

1. Frischmessung `m0` (`nSample` Werte, Median): `≥ pctOk` → `feucht`, keine Gabe, kein Lernwert, keine Pause (49); `> pctHi` → `nass`, Trockenphase (58).
2. Claim `st.why = laeuft` in den KVS, dann Portion 1 mit `toggle_after` (Erstportion aus dem Auftrag).
3. `tSoak` <!-- def:cfg4.tSoak -->20<!-- /def --> s einsickern, dann alle `tStep` <!-- def:cfg4.tStep -->5<!-- /def --> s messen, bis `nStab` <!-- def:cfg4.nStab -->4<!-- /def --> Werte in `dStab` <!-- def:cfg4.dStab -->1<!-- /def --> % liegen **und** nicht mehr steigen, höchstens `tStab` <!-- def:cfg4.tStab -->60<!-- /def --> s (45).
4. Urteil: über `pctHi` → `over`; ab `pctOk` → `ok`; sonst nächste Portion aus der im Fenster gemessenen Wirkung `g = ΣΔ % / Σ wirksame Sekunden`: Ziel = halber Weg bis `pctHi`, höchstens `pctSoll`; `sec = (Ziel − ist) / max(g, effMin) + tDead2`, geklemmt auf `tPmin` <!-- def:cfg4.tPmin -->10<!-- /def --> … `tPmax` <!-- def:cfg4.tPmax -->120<!-- /def --> s, nie mit `sf` (40).
5. Grenzen: höchstens `nPort` <!-- def:cfg4.nPort -->6<!-- /def --> Portionen (`max`), zusammen `tMax` s, Budget `tWin` <!-- def:cfg4.tWin -->420<!-- /def --> s, und jede weitere Portion nur, wenn Portion, Einsickern und Stabilisieren noch vor die Frist passen (`zeit`, 44).
6. Am Fensterende Lernen (`effW`, `sf`), Ergebnis in `st`, `day`, `job`; je Portion eine Konsolenzeile, nie mehr als etwa 15 Zeilen am Stück (52).

Die Stabilitätsregel (45) hat ihre Form aus der Randfall-Analyse: „drei Werte in 1 %“ ist auf einer Rampe erfüllt. Deshalb zählt zusätzlich der Trend (jüngster minus ältester Ringwert ≤ `dStab`/2); bei Timeout gilt das Ringmittel, noch steigend → `unstab` (Fenster endet, keine weitere Portion, Lernwert ja). Der Ablauf „Portion → nachmessen → nächste Portion“ ist die Regelstruktur der Literatur zur sensorgeführten Puls-Bewässerung (Recherche unten).

### Keine Wirkung heißt nie mehr Wasser

Die wichtigste Regel des Konzepts stammt aus der Tabelle „Zu viel und zu wenig erkennen“ (Projektanalyse 4.5, Konzept v2 4.5): bleibt die Feuchte nach der Einsickerzeit praktisch unverändert, ist das ein Störungsverdacht – Pumpe, Schlauch, Sensorlage – und **kein** Grund nachzugießen. Sonst würde bei einem abgerutschten Sensor der Topf geflutet.

| Beobachtung | Bewertung | Reaktion 0.2.0 |
| --- | --- | --- |
| über `pctHi` | zu viel | `over`: nach einer einzigen Portion sinkt `sf`, nächste Erstportion kleiner |
| noch unter `pctOk` | zu wenig | weitere Portion aus der gemessenen Wirkung `g` |
| praktisch unverändert (Δ < `dStab`) | Störungsverdacht | erste Portion: genau eine volle Probeportion; bleibt auch sie aus (ΣΔ < `dEffMin` <!-- def:cfg4.dEffMin -->2<!-- /def --> %) → `noeff`, blockiert, nur von Hand löschen, kein Lernwert (46); spätere Portion ohne Wirkung → `stall` |
| im Band | passt | `ok`, Lernwert nachziehen |

Die gedeckelte Probeportion ist die einzige Ausnahme von der Regel. Entscheidung 46 löst Entscheidung 7 ab (`eff_neu < effMin` in `bw_main`); `noeff` entsteht seit 0.2.0 nur in `bw_pump`.

### Pausen und Wochen-Trockenphase

Die Mindestpause kommt aus dem Interview vom 12.09.2026 (Frage 9, Architektur v1 6.2): Tagesmaximum über `tHot` <!-- def:cfg3.tHot -->35<!-- /def --> °C → `pauseHot` <!-- def:cfg3.pauseHot -->12<!-- /def --> h, beide Fenster können gießen; sonst `pause` <!-- def:cfg3.pause -->24<!-- /def --> h, nur eines der beiden Fenster; nimmt die Feuchte in 24 h um weniger als `dropSlow` ab → `pauseSlow` <!-- def:cfg3.pauseSlow -->48<!-- /def --> h (Staunässe-Verdacht bleibt).

Die Austrocknungsrate `lrn.rate` in %/h stammt aus Projektanalyse 4.6: bleibt sie trotz Wärme nahe null, ist das ein Hinweis auf Staunässe oder einen Sensorfehler.

| Regel | Wirkung im Zwei-Fenster-Betrieb (Umsetzungsplan v1 Abschnitt 5) |
| --- | --- |
| `pauseHot` 12 h | 08:00 und 20:00 können beide gießen |
| `pause` 24 h | nur eines der beiden Fenster, das erste nach Ablauf |
| `pauseSlow` 48 h | ein Fenster, dann ein voller Tag Pause |

Zwei Nachträge: die Pause gilt als abgelaufen, wenn sie beim nächsten Fenster bis auf einen Takt vorbei ist – sonst verfehlte eine 24-h-Pause das 08:00-Fenster um Sekunden und schöbe die Gabe auf 20:00 (7-Tage-Simulation). Und endete das Fenster mit `max`/`zeit` und liegt die Kontrollmessung danach (`st.pctA`) noch unter `pctLo`, gilt `pauseHot` als Nachholfenster (38). Weil `bw_main` alle 15 Minuten neu entscheidet, kann es um 07:45 noch „nein“ sagen, obwohl die Erde gestern Abend trocken aussah.

Die Trockenphase hat ihre Form geändert. Projektanalyse und Konzept v2 (4.6) verlangten nach **jeder** Gabe zwei Bedingungen: Feuchte einmal unter die Trockenschwelle gefallen und Mindestpause abgelaufen.

Seit 0.2.0 gilt die **Wochen-Trockenphase** (58): normal gießen ohne Trockenphase; ab dem Tageswechsel auf `dryDay` <!-- def:cfg3.dryDay -->5<!-- /def --> (Freitag) und sobald eine Taktmessung oder die Frischmessung im Fenster über `pctHi` liegt, keine Gabe, bis eine Taktmessung unter `pctDry` liegt (`why=trocken`). Für Kalibrierung und Zeitraffer ist sie ausgeschaltet (`dryDay` null, `pctDry` = `pctLo − 1`).

### Temperatur und Wasserstand

Die Temperatur hat zwei Aufgaben auf zwei Zeitachsen (Projektanalyse 2.1): der aktuelle Wert wirkt auf Sperren (Hitzeregel `tHot`), ein Mittel über Tage (`lrn.tMean`) dient als Jahreszeit-Anzeiger ohne Kalender. Fällt der Fühler aus, wird mit den Basiswerten weitergegossen und `err = temp` als Hinweis gesetzt (Frage 4, Entscheidung 6) – die Feuchtemessung trägt die Regelung, die Temperatur verfeinert sie nur.

Eine Frostsperre für Außenstandorte (Vorschlag: unter 4 °C nicht gießen) hängt von Frage 3 ab und ist nicht gebaut. Das Tagesmaximum wird in 2-°C-Schritten gespeichert, damit ein Sommertag nicht zehn Schreibvorgänge kostet.

Der Wasserstand (Projektanalyse 3.1 bis 3.5): die Zuordnung „1 = leer“ war am Aufbau zu bestätigen, nicht im Script vorauszusetzen – bestätigt am 13.09.2026 (`lvlEmpty` <!-- def:cfg1.lvlEmpty -->1<!-- /def -->). Der Schwimmer prellt, also gilt ein Zustand erst nach `nLvl` <!-- def:cfg1.nLvl -->3<!-- /def --> gleichen Lesungen innerhalb eines Takts.

Kommt die Leermeldung während einer Portion, geht die Pumpe binnen `tChk` <!-- def:cfg3.tChk -->5<!-- /def --> s aus (`abbruch`, `err = wasser`); die abgebrochene Portion liefert keinen Lernwert, fertige Portionen davor zählen (43). Nachgeholt wird nichts blind: nach dem Auffüllen entscheidet der normale Takt neu (Frage 6). Der Schwimmer sitzt über dem Pumpeneinlauf, damit die Pumpe nie trocken läuft (Frage 7).

## Sicherheit

### Dreifache Abschaltung

Projektanalyse v1 (5.2) sah zwei Sicherungen vor, Konzept v2 (5.2) drei: die Abschaltzeit im Einschaltbefehl (`toggle_after`), die automatische Abschaltung in der Gerätekonfiguration (`auto_off`) und den Sicherheits-Aus im Zeitplan. Alle drei führt das Gerät ohne Script aus.

Eine Bedingung kam aus der Architektur: die Höchstdauer je Gabe muss kürzer sein als der Versatz des Sicherheits-Aus, damit dieser nie in eine gewollte Gabe hineinschaltet. Der Installer hält sie bis heute ein, indem er den Sicherheits-Aus aus `PUMP_SEC + tWin + 10` s rechnet (54) und `auto_off` auf `tMax + 10` = 190 s setzt (12, 41). Details und Messwerte: [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md).

Harte Obergrenzen gelten unabhängig von allen Lernwerten – die Notbremse, wenn die Lernlogik falsch liegt (Projektanalyse 5.3): je Portion `tPmax`, je Fenster `tMax`, je Tag `maxDay` <!-- def:cfg3.maxDay -->2<!-- /def --> Fenster, Mindestpause. Nach einem Stromausfall steht der Ausgang sicher aus (`initial_state = off`, 5.4), und die Sperrzeit überlebt den Neustart, weil sie im KVS liegt. Der Ausgang selbst trägt nur 30 V / 300 mA und schaltet die Relaisspule, nie die Pumpe (5.1 – der kritischste Befund der Projektanalyse, im Konzept v2 durch das vorhandene Relais geklärt).

### Frist und Claim

Der Regelkreis hat zwei neue Sicherheiten gebracht. Die **Frist** (44): `bw_pump` rechnet beim Start `B = min(tWin, tick·60 − q − tTail)` mit `q` = Sekunden seit dem letzten Takt – normal 420 s – und startet keine Portion, die samt Einsickern und Stabilisieren nicht mehr hineinpasst (`zeit`). Dieselbe Bedingung „Fensterende + `tTail` <!-- def:cfg4.tTail -->20<!-- /def --> s vor dem nächsten Takt“ prüft der Installer statisch und der Mock als Überlappungswächter. So laufen `bw_main` und `bw_pump` nie gleichzeitig; dazu startet `bw_pump` 30 s nach der vollen Minute (37).

Der **Claim** (42): vor der ersten Portion schreibt `bw_pump` `st.why = laeuft`. Stirbt das Script mitten im Fenster (`out_of_memory`, Ausnahme, `Script.Stop`, Strom), geht die Pumpe über die drei Abschaltungen aus, `bw_main` hält die Pause, es entsteht kein Lernwert und kein `noeff`. Ein Claim in `job` statt in `st` wurde verworfen (62), weil `bw_main` `job` im Takt auffrischt.

## Was die Gerätetests verändert haben

Der Mock führt die Scripts in V8 aus. Was V8 großzügiger auslegt als mJS, fiel erst am Gerät auf – und wurde jeweils zu einer Regel im Test, nicht nur zu einer Notiz. Die Kurzform; Symptom, Ursache und Fix je Fund in [18 · Lernlog vom Gerät](18-lernlog-geraet.md):

| Datum | Befund am Gerät | Regel seitdem | Entscheidung |
| --- | --- | --- | --- |
| 12.09.2026 | `ReferenceError: "stepRead" is not defined` – mJS hoistet Funktionsdeklarationen nicht | Schrittliste `steps` ganz unten, `syntax.test.js` prüft Verwendung vor Deklaration | 13 |
| 12.09.2026 | `Too much recursion` in `bw_pump` bei 9–11 verschachtelten Aufrufen; Gerät: 12 Ebenen laufen, 14 stürzen ab | `next()` als flache Schleife; der Mock misst die Tiefe, Grenze <!-- fact:call_depth -->10<!-- /fact --> | 14 |
| 12.09.2026 | Web-UI zeigt KVS-Objekte als `[object Object]` | KVS-Werte als JSON-Strings; Installer ersetzt unlesbare Einträge | 15, 16 |
| 12.09.2026 | Editor verliert beim Einfügen das Dateiende (166/210 Byte) | Upload per RPC in Stücken, byteidentische Prüfung | 19 |
| 12.09.2026 | erster `Schedule.Create` je Lauf scheitert mit falschem „timespec“-Fehler | bis 3 Versuche nach 400 ms | 20 |
| 13.09.2026 | `Function "shift" not found!` – mJS kennt viele Array-Methoden nicht | nur `push`, `slice`, `splice`, `indexOf`, `join`; Ringpuffer per Index | Regel in `syntax.test.js` |
| 13.09.2026 | `out_of_memory`: der Script-Heap (~25 KB) ist von allen Scripts geteilt | Pumpentest in zwei Durchgängen, Langläufer geben KVS-Objekte in Wartephasen frei | 28 |
| 13.09.2026 | `bw_pump` stirbt neben `bw_main`, wenn beide zur vollen Minute starten | `bw_pump` startet bei Sekunde 30 (`PUMP_SEC`) | 37 |
| 13.09.2026 | Flash: `fs_free` 12 288 B mit sieben Scripts, 49 152 B ohne die drei Test-Scripts | Test-Scripts vor einem Upload löschen; `put-script.js` prüft `fs_free` | 59 |
| 13.09.2026 | Messlauf: 3-s-Pulse füllen nur den Schlauch, 10-s-Puls +11,6 % ab 7,9 s | Portionen nie kürzer als die Totzeit; `cfg4`-Startwerte aus dem Messlauf | Etappe 10 |
| 13.09.2026 | Fenster 1 im Zeitraffer: `effW` 2,006 im Profilmaß, 4,46 %/s nach `tRise` | `kal write` schreibt `effW`, `tDead2`, `tDead`, `tMin` = max(`tPmin`, `tDead` + 2) | Etappe 10 |

Die Testzahl wuchs mit jedem Fund: 53 (12.09.2026), 58, 89 und 102 (13.09.2026), 144 nach Etappe 10, heute <!-- fact:tests -->146<!-- /fact --> Tests gegen den Mock.

## Verworfene Alternativen

| Alternative | Warum verworfen | Entscheidung |
| --- | --- | --- |
| Abschalten bei einer Vorhaltschwelle während der Portion | bei 10–20 s Wasserlaufzeit und 7–20 %/s Gewinn läuft der Wert nach dem Abschalten weiter; die Portion ist weder reproduzierbar noch als Lernwert brauchbar. „Portion → nachmessen → nächste Portion“ ist die Regelstruktur der Literatur | 60 |
| Klassenlernen `effD`/`effN` (trocken/normal) ab dem ersten Fenster | mehr `lrn`-Felder und Codegröße ohne Datenbasis; erst wenn der Kalibrierlauf mehr als 50 % Unterschied zwischen den Zuständen zeigt | 61, 57 |
| Claim des laufenden Fensters in `job` | `job` ist die Übergabe, nicht der Zustand, und wird im Takt aufgefrischt; `st.why = laeuft` ist ein einziger Schreibvorgang, den nur `bw_pump` setzt | 62 |
| Smith-Prädiktor (modellgestützte Totzeitkompensation) | braucht ein Prozessmodell und einen Dauerregler; ein Einmal-Läufer ohne Zustand im RAM kann kein Modell nachführen. Totzeit wird additiv behandelt (`tDead`, `tDead2` aus `tRise`) | 63 |
| Notbetrieb-Script bei ungültiger Uhrzeit (Konzept v2 0.7) | weniger stabiler Weg; Interview 12.09.2026: nur der Zeitplan, das System pausiert bis NTP zurück ist | Architektur v1 Abschnitt 5 |
| `Script.Eval` oder Web-UI als Kommandokanal für die Hardware-Tests | KVS-Eintrag `hwc` ist überall sichtbar und im Mock nachgebildet; alte Kommandos wirken nie | 22 |
| ein einziges Hardware-Test-Script | 23,7 KB kompakt, über der Größengrenze | 21 |
| Ausreißerregel „Sprung > 25 % verwerfen“ | würde am Gerät jede erste Portion verwerfen; Plausibilität nur über `vErrLo`/`vErrHi`, Stabilität über Spanne und Trend | 45 (Kalibrier-Agent) |
| `eff`-Lernen und `noeff` in `bw_main`, 30 min nach der Gabe | der gedrainte 30-min-Wert ist die falsche Bezugsgröße; Lernen und `noeff` liegen im Fenster | 38, 46 (löst 7 ab) |
| Tageswechsel als eigener Zeitplan-Eintrag | Datumsvergleich in `bw_main` spart Eintrag und Script | Umsetzungsplan v1 |
| Messhistorie oder Pufferung am Gerät | KVS zu klein (50 × 253 Zeichen); Historie ist Sache der Ausbaustufe 2 | Projektanalyse 7, 8 |
| `auto_off` = `tPmax + 10` statt `tMax + 10` | `auto_off` wirkt je Einschaltbefehl und deckt eine Einzelportion weiter ab als nötig; der Einzeiler bleibt als Alternative dokumentiert | 41 |

## Beantwortete Fragen

Die 13 offenen Fragen der Projektanalyse v1 und die vier neuen aus Konzept v2 – mit Antwort und Stand 0.2.0:

| Nr. | Frage | Antwort | Quelle |
| --- | --- | --- | --- |
| 1 | Feuchteskala: Volumenprozent oder relative Skala 0–100 %? | relative Skala über eigene Kalibrierpunkte `vDry`/`vWet` | Konzept v2 1.1; 39 |
| 2 | Zweiter Fühler für die Bodentemperatur? | nicht gebaut; die grüne Ader des SMT50 bleibt frei, ein zweiter DS18B20 wäre am Ein-Draht-Bus möglich | offen, Idee |
| 3 | Standort innen oder außen – Frostsperre? | offen; keine Frostsperre gebaut | offen |
| 4 | Fühlerausfall: weitergießen oder aussetzen? | weitergießen, `err = temp` blockiert nicht; Hitzeregel dann inaktiv | Entscheidung 6 |
| 5 | Bedeutet 1 = leer? | ja: LEER = 1, VOLL = 0 (8 Wechsel beobachtet) | Gerät 13.09.2026 |
| 6 | Ausgefallene Gabe nachholen? | nein – der nächste Takt entscheidet über die Messung | Konzept v2 3 |
| 7 | Schwimmer über dem Pumpeneinlauf? | Aufbau-Regel: ja, sonst läuft die Pumpe trocken | [05 · Verkabelung und Hardware-Aufbau](05-verkabelung-und-aufbau.md) |
| 8 | Pflanze, Substrat, Topf – Zielband? | Beispielband von Hand (13.09.2026), Kalibrierlauf als Werkzeug | 47, 48, 56 |
| 9 | Mindestpause? | 24 h; 12 h bei Hitze über 35 °C; 48 h bei geringer Abnahme | Interview 12.09.2026 |
| 10 | Gießzeitfenster? | ja: 08:00 und 20:00 in `cfg3.winA`/`winB`; der Installer baut den Zeitplan daraus, `bw_main` frischt den Auftrag davor auf | Vorgabe 12.09.2026; 11 |
| 11 | Pumpe, Stromaufnahme, Relais? | Relais vorhanden, Gardena 970548801; der Ausgang trägt keine Pumpenlast | Konzept v2 5.1 |
| 12 | Störungen melden? | nur am Gerät: `err` im KVS und Konsole; kein Webhook, kein MQTT, Ausgang 1 bleibt frei | Interview 12.09.2026 |
| 13 | Stufe 2: Lücken akzeptieren oder Sammelstelle im LAN? | offen | Ausbaustufe 2 |
| 14 | Dauerhaft WLAN mit Internet? | meist, mit Ausfällen → nur Zeitplan, kein Notbetrieb; nach Stromausfall ohne Internet pausiert das System | Interview 12.09.2026 |
| 15 | Spannung des trockenen Sensors in Luft? | 0,20 V (12.09.2026); gemessen 0,296 V (13.09.2026) | `bw_hwtest` |
| 16 | Fördermenge und Höchstdauer einer Gabe? | unter 20 s kein Wasser, kleinste Gabe 40 s, 60–80 s bewährt, 120 s Maximum (12.09.2026); heute `tMin` 25, `tStd` 70, `tPmax` 120, `tMax` 180 je Fenster. Fördermenge je Sekunde `[TODO am Gerät]` | Interview; 40, 41 |
| 17 | Takt 15, 10 oder 30 Minuten? | 10 min im Interview, 15 min mit der Aufteilung in drei Scripts; heute `cfg3.tick` | 29 |

## Randfälle und Entscheidungen

Vor Etappe 10 wurden 33 Randfälle aus drei Blickwinkeln gesammelt und am Code gegengeprüft: 30 bestätigt, 3 verworfen. Jeder bestätigte Fall hat eine Entscheidung bekommen.

| Randfall | Gewicht | Entscheidung |
| --- | --- | --- |
| Fensterdauer nur über Portionen begrenzt – Kollision mit dem `bw_main`-Takt und dem Sicherheits-Aus | hoch | 44, 54 |
| Absturz, Stop oder Stromausfall mitten im Fenster; Zustand erst am Ende geschrieben | hoch | 42 |
| Stabilität „drei Werte in 1 %“ ist auf einer Rampe erfüllt – kein Trend, kein Timeout-Wert | hoch | 45 |
| `noeff`-Schwelle passt nicht zu Portionen | hoch | 46 |
| zwei verschiedene Lernwerte (Fenster vs. gedrainter 30-min-Wert), Schreibhoheit über `lrn` | hoch | 39, 43 |
| Totzeit der Folgeportion unbekannt; `tMin` 40 ist keine Portionsgröße | hoch | 40, 56 |
| `cfg3` sprengt mit neuen Feldern 253 Zeichen (und `zrb1` mit) | hoch | 53 |
| Zeitraffer-Fahrplan mit Eimer und Regelkreis schließen sich aus | hoch | 55 |
| Zeitraffer-Budget endet im `bw_main`-Takt | hoch | 44, 55 |
| `pctOk` fehlt am Gerät, `pctHi` bleibt 65, keine Ordnungsprüfung des Bands | hoch | 47, 48 |
| Sicherheits-Aus im Sekundenfeld derselben Minute | mittel | 54 |
| `tMax` doppelt belegt (Portion vs. Summe) | mittel | 41 |
| Abbruch-Matrix: LEER in oder zwischen Portionen, extern, Sensor, Ausnahme | mittel | 42, Ergebnismatrix in `pump.test.js` |
| `bw_pump` misst nicht selbst; `job.pct` ist bis 20 min alt | mittel | 49 |
| Hardware-Test und Handauftrag ohne `pct` brauchen eine Einzelportion | mittel | 50 |
| sehr trockene Erde erreicht das Band nicht | mittel | `max`, Nachholpause (38) |
| `day.n` zählt Portionen oder Fenster? | mittel | 51 (Fenster; `day.sec` alle Sekunden) |
| ein Timer, ein offener RPC, Phasenautomat | mittel | Tick-Automat (Etappe 10) |
| Codegröße (`bw_main` 700 B Luft) und Heap (`GetMany "*"`) | mittel | 38, 53 |
| Mock wirkt sofort und kappt bei 5 min | mittel | Topfmodell, `simulate(maxMs)` |
| Zeitarithmetik des Zeitraffers | mittel | 55 |
| Lernwert zu groß → `tmin` → kein Auftrag | mittel | 38 (Klemme) |
| Pause, `soak` und `rate` ab Fensterstart statt Fensterende | mittel | 52 (`dur`) |
| `sf` sinkt nur | mittel | 43 (`sfUp`) |
| Rückwärtskompatibilität und Upload-Reihenfolge | mittel | 48 |
| neue Codes und Konsole | mittel | 52 |
| Tests mit festen Zahlen und Schreibbudget | niedrig | Szenario, gemessen |
| Werkzeuge setzen Fenster ≤ `tMax + 10` voraus | niedrig | 54 (`expectedSpecs()`) |
| ein Sensor regelt mehrere Tropfer blind | niedrig | [04 · Sicherheit und Grenzen](04-sicherheit-und-grenzen.md) |
| Flash-Platz | niedrig | 59 |
| vom Nutzer ergänzt: von Hand gegossen oder gedüngt | – | 49 |

Zwölf weitere Lücken blieben als Hinweise stehen; die ersten drei hat der Messlauf geprüft: kein Spannungseinbruch am Voltmeter bei laufender Pumpe, frische Werte bei 2-s-Abfrage, Nachlaufwasser aus dem Schlauch dominiert kurze Pulse.

Offen bleiben: Schaltspiele und Mindestpausen von Relais und Pumpe laut Hersteller, ein DS18B20-Temperatursprung als zweiter Nachweis einer Portion, die Laufzeit der Mock-Tests bei 500-ms-Ticks, RPC-Latenz im langen Fenster (am Gerät mit `hwtest.js watch` beobachten). Eine neue Kalibrierung verschiebt das Band und macht `effW` ungültig – löschen oder `kal write` wiederholen.

Die Reihenfolge Auftrag → Claim → Ergebnis auf dem Zeitstrahl sichern `zeitraffer.test.js` und `szenario.test.js` ab: normal 07:45 → 08:00:30 → spätestens 08:07:30, der Takt um 08:15 findet das Ergebnis vor; im Zeitraffer T−3 → T:30 → spätestens T+2:30 vor dem Takt T+3.

## Recherche und Quellen

Ein Recherche-Agent hat vor Etappe 10 die Literatur zur sensorgeführten Puls-Bewässerung ausgewertet.

Übernommen wurde: kleine Gabe → nachmessen → bei Bedarf nächste ist Stand der Forschung; erste Portion bewusst unter das Ziel (Faktor ≈ 0,7 auf das Defizit, run-to-run nachgeführt) → `sf` 0,7; Folgeportionen mit der im Fenster gemessenen Wirkung rechnen; Stabilität = Spanne **und** kein Anstieg mehr; Lernen nur bei Δ ≥ 2 % und wirksamen Sekunden, Innovation klemmen, `alpha` 0,2 bis 0,3; der 30-min-Wert (Drainage) darf nie in `effW`; ein Sensor unter dem Tropfer misst den nassesten Punkt; die Totzeit ist morgens größer (Schlauch leer) und aus `tRise` ablesbar.

- Nemali & van Iersel 2006, *An automated system for controlling drought stress and irrigation in potted plants*, Scientia Horticulturae 110: https://doi.org/10.1016/j.scienta.2006.07.009
- HortTechnology 2018 (ASHS), sensorgeführte Bewässerung in Containerkultur: https://journals.ashs.org/horttech/
- PLOS One 2018 (PMC5988304), *A cost-effective and customizable automated irrigation system …*: https://pmc.ncbi.nlm.nih.gov/articles/PMC5988304/
- Frontiers 2022 und 2024, Bodenfeuchte-Rückkopplung und Sensorlage: https://www.frontiersin.org/
- Agronomy 2021, 11(7) 1355: https://www.mdpi.com/2073-4395/11/7/1355 und 11(5) 907: https://www.mdpi.com/2073-4395/11/5/907
- Sensors 2020 (PMC7570759), Streuung kapazitiver Bodenfeuchtesensoren unter Tropfbewässerung: https://pmc.ncbi.nlm.nih.gov/articles/PMC7570759/
- MathWorks, *Control of Processes with Long Dead Time: The Smith Predictor* (Alternative, Entscheidung 63): https://www.mathworks.com/help/control/ug/control-of-processes-with-long-dead-time-the-smith-predictor.html
- IEEE, EWMA run-to-run control (Lernen zwischen Läufen mit geklemmter Innovation → `alpha`, `effMin`/`effMax`): https://ieeexplore.ieee.org/
- US-Patent 8 219 254 B2, *Adaptive control for irrigation system*: https://patents.google.com/patent/US8219254B2/en
- UF/IFAS AE437, Soil-moisture-sensor-based irrigation controllers: https://ask.ifas.ufl.edu/publication/AE437
- EPA WaterSense, soil-moisture-based irrigation controllers: https://www.epa.gov/watersense
- aguafox, Hersteller-Doku Tropfbewässerung (Tropfermenge, Nachlauf, Schaltspiele) – Link nur im Agentenbericht
- Trübner SMT50, Bedienungsanleitung (Ansprechzeit, Messvolumen, Ausgangsspannung): https://www.truebner.de/assets/download/Anleitung_SMT50.pdf
- Shelly Plus Uni, Wissensdatenbank: https://kb.shelly.cloud/knowledge-base/shelly-plus-uni
- Shelly Gen2: Zeitplan https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule/ · Script https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script/ · KVS https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS/

Das Fazit des Kalibrier-Agenten: der Zeitraffer taugt für die Dosis-Kalibrierung (Wirkung je Sekunde, `tRise`, Einschwingzeit), nicht für Austrocknung und Pausen – die bleiben Sache des Echtbetriebs.

## Ausbaustufen und Ideen

| Idee | Stand | Herkunft |
| --- | --- | --- |
| Stufe 2: Historie an ein VPS-Backend – die Steuerung bleibt am Gerät, das Backend zeichnet auf und zeigt an; der Takt sendet Messwerte und Ereignisse als JSON, jedes mit laufender Nummer und Gerätelaufzeit, damit die Reihenfolge auch bei falscher Uhrzeit stimmt. Pufferung am Gerät ist nicht möglich | offen; Frage 13 (Lücken bei Netzausfall akzeptieren oder Sammelstelle im LAN) unbeantwortet | Projektanalyse 8, Konzept v2 8 |
| Lernklassen `effD`/`effN` nach Ausgangsfeuchte | erst, wenn der Kalibrierlauf mehr als 50 % Unterschied zeigt; der `kal`-Bericht liefert die Datenbasis | 57 |
| aktiver Störmeldeweg: zweiter Ausgang als Störmelder, Webhook, Shelly-Cloud oder Backend | offen; heute nur `err` im KVS und Konsole | Frage 12 |
| Bodentemperatur mit zweitem DS18B20 (bis fünf Fühler am Ein-Draht-Bus) | offen | Frage 2 |
| Frostsperre für Außenstandorte | offen | Frage 3 |
| Untergrenze mit dem Temperaturmittel leicht verschieben (im Winter trockener stehen) | nicht gebaut; `lrn.tMean` wird geführt | Projektanalyse 4.2 |
| Speicherverbrauch je Takt protokollieren, damit ein Leck sichtbar wird | `err.mem` beim Tageswechsel; Spitzen mit `hwtest.js watch` | Konzept v2 0.6 |
| Totzeit am Endaufbau messen (`hwtest.js mess`), `tDead`/`tMin` nachziehen | offen `[TODO am Gerät]` | Etappe 10 |

Die Bauetappen A bis E aus Konzept v2 und Architektur v1 (Zeitplan und Messen, Sicherheiten, Regelung mit festen Werten, Lernen und Staunässe-Schutz, Stufe 2) wurden zu den Etappen 0 bis 10 des Plans; Stufe 2 ist die einzige, die noch aussteht ([17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md)).

## Herkunft dieses Kapitels

| Alte Datei | Datum | Was darin stand | Wo es aufging |
| --- | --- | --- | --- |
| `docs/projektanalyse-v1.md` | vor dem 12.09.2026 | Prüfung der Projektbeschreibung: Befunde 1.1 bis 5.4, Regelprinzip, 13 offene Fragen | Regelungskern, Sicherheit, Beantwortete Fragen |
| `docs/konzept-v2.md` | 12.09.2026, Nachtrag 13.09.2026 | Einmal-Läufer, Zeitplan-Einträge, Zustandsmaschine, Kalibrierung, dreifache Abschaltung, Datenhaltung, Stufe 2, Fragen 14–17, Nachtrag zum Regelkreis | Bauprinzipien, Regelungskern, Sicherheit, Ausbaustufen |
| `docs/architektur-v1.md` | 12.09.2026 | Tool-Stack, Übersicht „Motor, Kopf, Gedächtnis“, Interview-Entscheidungen, Totzeit, Pausen, Restrisiko, Etappen A–E | Ausgangslage (Tool-Stack), Bauprinzipien, Lernwert, Pausen, Verworfene Alternativen |
| `docs/umsetzungsplan-v1.md` | 12.09.2026 | drei Scripts, `job` als Schnittstelle, Installer-Schritte, KVS-Vertrag, Pausenregel im Zwei-Fenster-Betrieb, Etappen A–F | Drei Scripts, Pausen; Startwerte in [03 · Konfiguration](03-konfiguration.md), Etappen in [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md) |
| `docs/umsetzungsplan-v2.md` | 12.09.2026 | Konfiguration im KVS, Katalog `cfg1..3`, `pctSoll` als Dosis-Zahl | Keine Konfiguration im Code; Katalog in 03 |
| `docs/onboarding-prompt.md` | 12.09.2026 | Arbeitsgrundlage für die Entwicklung mit Claude Code | Ausgangslage, Anhang im Wortlaut |
| `docs/PLAN.md` (Abweichungen, Recherche, Randfälle) | 12./13.09.2026 | Abweichungen vom Prompt, Quellen, 30 Randfälle, Lücken | Keine Konfiguration im Code, Recherche, Randfälle; Etappen und Entscheidungen 1–63 in 17 |

Der Befund „Regelquellen widersprechen sich“ (Konzept v2 „Rückkopplung ein Tag“ gegen Architektur v1 „Portionen unter 40 s gibt es nicht“) ist damit erledigt: Regelquelle ist nur noch dieses Kapitel, `tPmin` 10 gilt für Korrekturportionen, `tMin` 25 für die Erstportion.

## Beispielausgabe

So sehen die Prinzipien am Gerät aus – Fenster 1 des Kalibrierlaufs am 13.09.2026, 15:54:30 (Zeitraffer, Frist <!-- zr:cfg4.tWin -->120<!-- /zr --> s). Erstportion aus dem Auftrag, Frischmessung `m0`, Korrekturportion aus der gemessenen Wirkung `g`, Ziel `pctOk` 50 erreicht, Lernwert `effW` am Fensterende, Laufzeit unter der Frist; frühestens `soak` (30 min, im Zeitraffer 15 s) nach dem Fensterende beim nächsten Takt – hier 15:57 – die Kontrolle in `bw_main`, die nicht lernt:

```text
[bw_pump 0.2.0] Fenster: Auftrag 12 s, pct 10.829, effW null sf 0.7, Frist 120 s
[bw_pump 0.2.0] m0 10.4 % → P1 12 s
[bw_pump 0.2.0] P1 12s: 10.4→34 (23.6, g 2.357, tRise 8, stabil 12s)
[bw_pump 0.2.0] P2 10s: 34→50.5 (16.5, g 2.006, tRise 5, unstabil 30s)
[bw_pump 0.2.0] ergebnis=unstab n=2 sec=22 dur=49 pct=10.4→50.5 effW=2.006 sf=0.7 day.n=1 err=null w=4 dauer=100199
[bw_main 0.2.0] Kontrolle: 50.5 → 53.7 % sf=0.7
```

`unstab` heißt: die zweite Portion stieg beim Timeout noch – das Fenster endet ohne weitere Portion, der Lernwert entsteht trotzdem (45). `effW` 2,006 ist das Profilmaß des Zeitraffers (`tDead` 2 s); auf der Skala „% je Sekunde nach `tRise`“ ergab der Bericht 4,46, und `kal write` hat diesen Wert zusammen mit `tDead2` 5, `tDead` 8 und `tMin` 10 geschrieben.

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| Eine Erweiterung gießt nach ausbleibender Wirkung „zur Sicherheit“ mehr | Denkfehler gegen die Kernregel: keine Wirkung heißt Störungsverdacht | Probeportion ist die einzige Ausnahme; danach `noeff` und Mensch |
| Neue Zeitkonstante als `var` im Script | verstößt gegen „keine Konfiguration im Code“; Änderung braucht Upload statt Handeintrag | Feld in `DEF` des Installers anlegen, Script liest es, Kapitel 03 nachziehen |
| Script mit Dauerschleife oder Timer, der „immer“ läuft | die Bauweise setzt Einmal-Läufer voraus; Dauerscripts stürzen nach Stunden ab und blockieren den Heap | Arbeit in den Takt legen, `Script.Stop` am Ende; Langläufer nur von Hand und mit Speicherfreigabe |
| Zustand in einer Modulvariable „zwischenspeichern“ | nach dem Script-Ende ist er weg; der nächste Takt kennt ihn nicht | Feld in `st`, `lrn` oder `day`; nur bei Änderung schreiben |
| Lernwert aus dem Wert 30 Minuten nach dem Fenster gerechnet | gedrainter Boden, falsche Bezugsgröße (39) | nur die stabilisierte Fensterablesung; der 30-min-Wert ist Kontrolle |
| 100 % als Zielwert eingetragen | 100 % ist der Kalibrierpunkt „Sensor im Wasser“ | Zielband deutlich darunter; Bandordnung beachten, sonst `why=cfg` |
| Ein Fenster nahe dem Takt, `tWin` vergrößert | Frist verletzt; Installer bricht mit `err cfg` ab | `(Fensterminute mod tick)·60 + 30 + tWin + tTail ≤ tick·60` einhalten |
| Zwei große Scripts zugleich gestartet | geteilter Heap ~25 KB → `out_of_memory` | nie zwei große Scripts zugleich; Test-Scripts einzeln |
| Ein altes Konzeptdokument als Regel gelesen | die sechs Dateien widersprechen sich zum Teil (z. B. Lernen nach 30 min, Sicherheits-Aus Minute 5) | dieses Kapitel und [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md) sind die Regelquellen |

## Weiter zu

- [17 · Etappen- und Entscheidungslog](17-etappen-und-entscheidungslog.md) – jede Entscheidung 1–63 mit Datum und Begründung, Etappen 0 bis 10, offene Punkte.
- [18 · Lernlog vom Gerät](18-lernlog-geraet.md) – jeder Gerätefund mit Symptom, Ursache, Fix und der Regel im Test.
- [03 · Konfiguration](03-konfiguration.md) – alle Felder, die aus den Prinzipien hier geworden sind.
