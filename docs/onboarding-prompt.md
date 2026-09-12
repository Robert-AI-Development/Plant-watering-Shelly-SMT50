# Onboarding-Prompt (Teil A des Onboarding-Dokuments v1)

Dieser Text ist die Arbeitsgrundlage für die Entwicklung mit Claude Code. Er wurde am 12.09.2026 unverändert aus dem Onboarding-Dokument übernommen. Die daraus abgeleiteten Entscheidungen stehen in `PLAN.md`, Abschnitt „Entscheidungen".

```
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
