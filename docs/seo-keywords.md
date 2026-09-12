# SEO- & Keyword-Analyse

Ziel: Das Projekt soll gefunden werden – von Selbstbauern („DIY smart home"), Shelly-Nutzern und von Leuten, die
ihre **Pflanzen im Urlaub** versorgen wollen, sowie von der wachsenden Gruppe, die **mit KI zuhause programmiert**
(„AI coding at home"). Diese Datei hält die Analyse und den Platzierungsplan fest; die Keywords sind bereits
gezielt in README und Handbuch eingearbeitet.

## Marktlage (Kurzanalyse, recherchiert 09/2026)

- **Deutscher Raum:** überwiegend Blogartikel und YouTube-Videos (z. B. draeger-it.blog, simon42.com), das
  Shelly-Forum, die Shelly-eigene Seite „Smart Garden Irrigation" sowie Bastler-Seiten (gardenergranny.de,
  ioBroker-Forum). Anleitungen und Produkte dominieren; **offene, gut dokumentierte GitHub-Projekte speziell für
  Shelly-Skripte sind selten.**
- **GitHub allgemein:** viele ESP8266/ESP32-Bewässerungsprojekte (br-mat/bewae, Insane-Plants, Plantwatery …),
  aber **kaum Shelly-Script-Projekte** und praktisch keine mit **selbstlernender Logik am Gerät ohne Cloud**.
- **Trend:** „KI-Coding zuhause / AI coding at home" (Claude Code, lokale Automatisierung) wächst stark und ist im
  Bewässerungs-Nischenmarkt **noch nicht besetzt**.

**Fazit / Chance:** Die Long-Tail-Nische **„Shelly Plus Uni + SMT50 + selbstlernend + Script am Gerät + ohne Cloud
+ mit KI programmiert"** ist frei. Genau darauf zielen Titel, Beschreibung und Überschriften.

## Keyword-Cluster (mit Suchintention)

| Cluster | Deutsch | English | Intention |
| --- | --- | --- | --- |
| Produkt/Kern | Pflanzenbewässerung mit Shelly, automatische Pflanzenbewässerung, Bodenfeuchte SMT50, Temperatur DS18B20, Shelly Plus Uni | Shelly plant watering, automatic plant watering, soil moisture SMT50, DS18B20 temperature | Lösung suchen |
| Nutzen „Urlaub" | Pflanzen gießen im Urlaub, Urlaubsbewässerung, Zimmerpflanzen bewässern Abwesenheit | watering plants while on vacation, holiday plant watering, self-watering while away | starkes Kaufmotiv |
| Eigenschaft | selbstlernende Bewässerung, Bewässerung ohne Cloud, lokal, DIY Bewässerungscomputer, Smart-Home DIY | self-learning irrigation, no-cloud / local irrigation, DIY smart home, DIY watering controller | Abgrenzung |
| Technik | Shelly Script, mJS, KVS, Schedule, Shelly Gen2 scripting | Shelly script, mJS, KVS, schedule, Shelly Gen2 scripting | Entwickler |
| KI-Trend | KI-Coding zuhause, mit KI programmieren, Claude Code, KI debuggt Hardware live | AI coding at home, vibe coding, Claude Code, AI debugs real hardware | Trend/Neugier |

## Platzierung (wo die Keywords stehen)

- **README-Titel & Untertitel:** Kernbegriffe + „ohne Cloud" + „selbstlernend" + „mit Claude Code".
- **README-Einleitung/Zweck:** Nutzen-Absatz „Pflanzen im Urlaub versorgen", Alleinstellungsmerkmal „KI debuggt
  Hardware live".
- **Handbuch Kapitel 1:** Positionierung DIY/KI-Coding, „ohne Cloud", „Urlaub".
- **`package.json`:** `description` + `keywords`-Array (npm/GitHub-Suche).
- **GitHub-Topics + About-Text:** siehe unten (musst du im Repo-Web-UI eintragen – geht nicht per git).
- Grundsatz: **natürlich** im Fließtext, kein Keyword-Spam.

## GitHub: Topics & About (bitte im Repo eintragen)

GitHub → Repo → ⚙ neben „About":

**About (Beschreibung):**

> Selbstlernende Pflanzenbewässerung mit Shelly Plus Uni (SMT50, DS18B20) – läuft lokal ohne Cloud, programmiert &
> live-debuggt mit KI (Claude Code). DIY Smart Home, ideal für den Urlaub.

**Topics (max. 20, kleingeschrieben):**

```
shelly · shelly-plus-uni · shelly-script · smart-home · home-automation ·
plant-watering · irrigation · soil-moisture · smt50 · ds18b20 · diy · iot ·
automatic-watering · self-watering · no-cloud · mjs · claude-code · ai-coding ·
gardening · self-learning
```

## Marketing-Slogan

**Primär (DE):** „Gieß smart – Programmierung out of the box mit KI (Claude Code), läuft lokal auf deinem Shelly."
**Primär (EN):** „Water smart – programming out of the box with AI (Claude Code), running locally on your Shelly."
**Untertitel:** „DIY Smart-Home zum Mitprogrammieren." / „DIY smart home you can code yourself."

Alternativen:
- „Deine Pflanzen. Dein Shelly. Deine KI. – Bewässerung ohne Cloud." / „Your plants. Your Shelly. Your AI."
- „Selbstlernend gießen – sogar im Urlaub." / „Self-learning watering – even on vacation."
- „KI debuggt echte Hardware – und es läuft." / „AI debugs real hardware – and it works."
