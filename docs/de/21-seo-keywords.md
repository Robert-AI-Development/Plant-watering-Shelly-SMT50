# 21 · SEO und Keywords

**Deutsch** · [English](../en/21-seo-keywords.md) — [Handbuch](README.md) · Teil F „Entwicklung“

> **Auf einen Blick**
> - Das Projekt soll gefunden werden – von Shelly-Nutzern, Selbstbauern („DIY Smart Home“), Menschen, die ihre Pflanzen im Urlaub versorgen wollen, und der wachsenden Gruppe, die zuhause mit KI programmiert. Dieses Kapitel hält die Marktanalyse vom September 2026 und den Platzierungsplan fest.
> - Umfang: fünf Keyword-Cluster in Deutsch und Englisch, vier Orte im Repository (README, Kapitel 01, Pages-Startseite, `package.json`) und drei Felder auf GitHub (About-Text, Website, Topics), die nur von Hand gehen.
> - Wichtigste Zahl: 20 Topics – mehr nimmt GitHub nicht an; ebenso viele `keywords` stehen in `package.json` (Stand <!-- fact:project.version -->0.2.0<!-- /fact -->).
> - Größter Stolperstein: About-Text, Website und Topics liegen nicht im Repository. Am 15.09.2026 waren alle drei leer (`description: null`, `topics: []`) – sie müssen im Web-UI von GitHub oder per API eingetragen werden.

## Voraussetzungen

- keine – ein Lesekapitel. Zum Eintragen der GitHub-Felder braucht es Schreibrechte auf das Repository; für die Beispielausgabe reichen `curl` und Internet.

## Diagramm

[![Datenfluss: fünf Suchintentionen führen zu fünf Keyword-Clustern; daraus entstehen Titel, Slogan, Beschreibung und Keyword-Liste, die im README, in Kapitel 01, auf der Pages-Startseite, in package.json und im GitHub-About stehen](../diagramme/de/21-seo-keywords.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/21-seo-keywords.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/21-seo-keywords.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Zielgruppen und Cluster“, 2 „Texte und Orte“, 3 „GitHub von Hand“. Im Bild speist die Beschreibung den About-Text und die Keyword-Liste die GitHub-Topics; fast dieselben Begriffe (18 von 20) stehen als `keywords` in `package.json`, die gestrichelte Kante heißt deshalb „abgleichen“.

## Marktlage

Kurzanalyse, recherchiert im September 2026 und am 12.09.2026 im Repository festgehalten (Commit `1a4b145`). Sie ist eine Momentaufnahme, keine laufende Messung – wer sie erneuert, trägt das Datum nach.

| Raum | Was es gibt | Was fehlt |
| --- | --- | --- |
| deutschsprachig | Blogartikel und YouTube-Videos (z. B. draeger-it.blog, simon42.com), das Shelly-Forum, die Shelly-eigene Seite „Smart Garden Irrigation“, Bastler-Seiten (gardenergranny.de, ioBroker-Forum); Anleitungen und Produkte dominieren | offene, gut dokumentierte GitHub-Projekte speziell für Shelly-Scripts sind selten |
| GitHub allgemein | viele Bewässerungsprojekte auf ESP8266/ESP32 (br-mat/bewae, Insane-Plants, Plantwatery …) | kaum Shelly-Script-Projekte, praktisch keines mit selbstlernender Logik am Gerät ohne Cloud |
| Trend | „KI-Coding zuhause / AI coding at home“ (Claude Code, lokale Automatisierung) wächst stark | in der Bewässerungsnische noch nicht besetzt |

**Fazit:** Die Long-Tail-Nische „Shelly Plus Uni + SMT50 + selbstlernend + Script am Gerät + ohne Cloud + mit KI programmiert“ ist frei. Genau darauf zielen Titel, Beschreibung und Überschriften – nicht auf den breiten Begriff „Bewässerung“, den Produkte und Blogs besetzen.

## Keyword-Cluster

Fünf Cluster, jeder mit eigener Suchintention. Deutsche und englische Begriffe gehören zusammen: das README trägt einen englischen Kurzabsatz, das Handbuch ist zweisprachig, und die Topics auf GitHub sind englisch.

| Cluster | Deutsch | English | Suchintention |
| --- | --- | --- | --- |
| Produkt/Kern | Pflanzenbewässerung mit Shelly, automatische Pflanzenbewässerung, Bodenfeuchte SMT50, Temperatur DS18B20, Shelly Plus Uni | Shelly plant watering, automatic plant watering, soil moisture SMT50, DS18B20 temperature | Lösung suchen |
| Nutzen „Urlaub“ | Pflanzen gießen im Urlaub, Urlaubsbewässerung, Zimmerpflanzen bewässern bei Abwesenheit | watering plants while on vacation, holiday plant watering, self-watering while away | starkes Kaufmotiv |
| Eigenschaft | selbstlernende Bewässerung, Bewässerung ohne Cloud, lokal, DIY Bewässerungscomputer, Smart-Home DIY | self-learning irrigation, no-cloud / local irrigation, DIY smart home, DIY watering controller | Abgrenzung von Produkten und Cloud-Lösungen |
| Technik | Shelly Script, mJS, KVS, Schedule, Shelly Gen2 scripting | Shelly script, mJS, KVS, schedule, Shelly Gen2 scripting | Entwickler |
| KI-Trend | KI-Coding zuhause, mit KI programmieren, Claude Code, KI debuggt Hardware live | AI coding at home, vibe coding, Claude Code, AI debugs real hardware | Trend, Neugier |

## Platzierung

Grundsatz: Die Begriffe stehen **natürlich im Fließtext** – im Titel, im ersten Absatz, in Überschriften –, nie als Schlagwortliste. Kein Keyword-Spam: ein Begriff an seiner Stelle reicht.

| Ort | Was dort steht | Cluster |
| --- | --- | --- |
| [README.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/README.md) – Titel (H1) | „Selbstlernende Pflanzenbewässerung mit Shelly Plus Uni & SMT50 – DIY Smart Home ohne Cloud“ | Produkt/Kern, Eigenschaft |
| README – Leitsatz und Einleitung | Kernbegriffe plus „ohne Cloud“, „selbstlernend“, „mit Claude Code“; Nutzen-Absatz „Pflanzen im Urlaub versorgen“; Alleinstellungsmerkmal „KI debuggt Hardware live“ | Eigenschaft, Nutzen, KI-Trend |
| README – englischer Kurzabsatz | dieselben Begriffe auf Englisch („self-learning Shelly plant-watering system … locally, no cloud … watering plants while on vacation“); die Landingpage bekommt dafür einen eigenen Zwilling `README.en.md` | alle, englisch |
| [01 · Gesamtarchitektur](01-gesamtarchitektur.md) – „Auf einen Blick“ | Positionierung: lokal, ohne Cloud, lernt die Wirkung einer Pumpensekunde, für Zimmer- und Balkonpflanzen im Urlaub; der [Handbuch-Index](README.md) wiederholt sie in zwei Sätzen | Produkt/Kern, Eigenschaft, Nutzen |
| Pages-Startseite [index.md](../index.md) und [_config.yml](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/docs/_config.yml) | `title` und `description` aus `_config.yml` werden zu `<title>` und Meta-Description jeder Pages-Seite (Theme Primer; am 15.09.2026 im `<head>` geprüft, Beispielausgabe unten) | Produkt/Kern, Eigenschaft |
| [package.json](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/package.json) | `description` (263 Zeichen: Kernbegriffe, ohne Cloud, Urlaub, Claude Code, DIY Smart Home, Node-Mock) und `keywords` (20 Begriffe) für die GitHub-Suche (das Paket ist `private`, auf npm erscheint es nicht) | alle |
| GitHub About und Topics | Beschreibung, Website und 20 Topics – nicht per git, sondern im Web-UI oder per GitHub-API mit Token (nächster Abschnitt) | alle |

> **Hinweis:** Ein neuer README-Titel oder ein Umbau der Startseite muss die Kernbegriffe behalten: Pflanzenbewässerung, Shelly Plus Uni, SMT50, selbstlernend, ohne Cloud, Urlaub, Claude Code. Die Cluster-Tabelle ist die Prüfliste dafür.

## GitHub: About und Topics

About-Text, Website und Topics gehören zum Repository auf GitHub, nicht zu den Dateien darin – `git push` ändert sie nicht. Sie werden einmal im Web-UI eingetragen (Schritte unten) oder per GitHub-API mit Token gesetzt: `PATCH /repos/{owner}/{repo}` für Beschreibung und Website, `PUT /repos/{owner}/{repo}/topics` für die Topics. Stand 15.09.2026 sind alle drei Felder leer (öffentliche GitHub-API, Beispielausgabe unten).

1. Repository auf GitHub öffnen und rechts neben „About“ auf das Zahnrad klicken.
2. **Description** eintragen (Text unten); GitHub zeigt ihn in der Repo-Kopfzeile und in Suchergebnissen.
3. **Website** eintragen: `https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/` – die Pages-Startseite mit Handbuch in beiden Sprachen.
4. **Topics** eintragen: die 20 Begriffe unten, kleingeschrieben, Wörter mit Bindestrich; mehr als 20 nimmt GitHub nicht an.
5. Speichern und mit den `curl`-Aufrufen aus der Beispielausgabe prüfen.

**About (Beschreibung, 185 Zeichen):**

> Selbstlernende Pflanzenbewässerung mit Shelly Plus Uni (SMT50, DS18B20) – läuft lokal ohne Cloud, programmiert & live-debuggt mit KI (Claude Code). DIY Smart Home, ideal für den Urlaub.

**Topics (20):**

```text
shelly shelly-plus-uni shelly-script smart-home home-automation
plant-watering irrigation soil-moisture smt50 ds18b20 diy iot
automatic-watering self-watering no-cloud mjs claude-code ai-coding
gardening self-learning
```

Abgleich mit `package.json`: 18 der 20 Begriffe stehen in beiden Listen. `package.json` führt zusätzlich die deutschen Suchbegriffe `pflanzenbewaesserung` und `urlaubsbewaesserung`, die Topics-Liste stattdessen die auf GitHub verbreiteten Topics `gardening` und `self-learning`. Wer eine Liste ändert, zieht die andere nach.

## Slogans

Der Primärslogan verbindet drei Cluster in einem Satz: Produkt (gießen, Shelly), KI-Trend (Claude Code) und Eigenschaft (lokal). Die Alternativen betonen je ein Kaufmotiv.

| Verwendung | Deutsch | English |
| --- | --- | --- |
| Primär – Leitsatz oder Einleitung im README, Vorträge, Beiträge | „Gieß smart – Programmierung out of the box mit KI (Claude Code), läuft lokal auf deinem Shelly.“ | "Water smart – programming out of the box with AI (Claude Code), running locally on your Shelly." |
| Untertitel | „DIY Smart-Home zum Mitprogrammieren.“ | "DIY smart home you can code yourself." |
| Alternative 1 – Eigenschaft | „Deine Pflanzen. Dein Shelly. Deine KI. – Bewässerung ohne Cloud.“ | "Your plants. Your Shelly. Your AI." |
| Alternative 2 – Nutzen „Urlaub“ | „Selbstlernend gießen – sogar im Urlaub.“ | "Self-learning watering – even on vacation." |
| Alternative 3 – KI-Trend | „KI debuggt echte Hardware – und es läuft.“ | "AI debugs real hardware – and it works." |

## Beispielausgabe

Prüfung vom 15.09.2026 über die öffentliche GitHub-API (ohne Token) und die Pages-Startseite. Die ersten beiden Befehle zeigen die GitHub-Felder, der dritte den `<head>` der Startseite:

```bash
curl -s https://api.github.com/repos/Robert-AI-Development/Plant-watering-Shelly-SMT50/topics                                    # Topics; leere Liste = noch nicht eingetragen
curl -s https://api.github.com/repos/Robert-AI-Development/Plant-watering-Shelly-SMT50 | grep -E '^  "(description|homepage)"'   # About-Text und Website
curl -s https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/ | grep -E '<title>|name="description"'              # Pages-Startseite: Titel und Meta-Description
```

```text
{
  "names": [

  ]
}
  "description": null,
  "homepage": null,
<title>Dokumentation · Documentation | Pflanzenbewässerung mit dem Shelly Plus Uni</title>
<meta name="description" content="Selbstlernende Bewässerung mit SMT50 und DS18B20 – lokal, ohne Cloud. Handbuch Deutsch / English handbook." />
```

Deutung: Topics, About-Text und Website sind auf GitHub noch leer (offen, Schritte oben). Die Pages-Startseite trägt Titel und Meta-Description aus `docs/_config.yml` (Jekyll 3.10.0 laut `generator`-Tag) – fünf der sieben Kernbegriffe stehen schon darin; Urlaub und Claude Code fehlen in `description`.

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| Repository erscheint auf GitHub ohne Beschreibung, Website und Topics | About-Felder nie eingetragen – sie liegen nicht im Repository, `git push` ändert sie nicht | im Web-UI eintragen (Schritte oben) und mit `curl` prüfen |
| Englischsprachige Suchende finden das Projekt nicht | nur deutsche Begriffe in Titel, Beschreibung und Topics | englischer Kurzabsatz bzw. `README.en.md`, englische Topics aus der Liste oben, zweisprachiges Handbuch |
| `keywords` in `package.json` und Topics laufen auseinander | eine Liste geändert, die andere nicht | beide abgleichen: 18 gemeinsame Begriffe, je zwei eigene (oben) |
| Pages-Seiten ohne Meta-Description oder mit generischem Titel | `title` oder `description` in `docs/_config.yml` leer | eintragen; das Theme Primer setzt die Meta-Tags daraus; im `<head>` prüfen wie in der Beispielausgabe |
| Text liest sich wie eine Schlagwortliste | Keyword-Spam | jeder Begriff einmal an seiner natürlichen Stelle: Titel, erster Absatz, Überschrift |
| README-Titel gekürzt, Kernbegriffe verschwunden | Umbau ohne Blick auf die Cluster-Tabelle | H1 trägt Produkt/Kern und Eigenschaft: Pflanzenbewässerung, Shelly Plus Uni, SMT50, selbstlernend, ohne Cloud |
| Marktlage wird als aktuell zitiert | die Analyse ist eine Momentaufnahme vom September 2026 | bei einer Erneuerung Datum und Fundstellen in diesem Kapitel nachtragen |

## Weiter zu

- [README](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/README.md) – die Landingpage, auf der Titel, Leitsatz und Einleitung die Keywords tragen.
- [Handbuch-Index](README.md) – alle 21 Kapitel mit Leserpfaden für Einsteiger, Maker und KI-Agenten.
- [01 · Gesamtarchitektur](01-gesamtarchitektur.md) – der Kasten „Auf einen Blick“, in dem die Positionierung steht.
