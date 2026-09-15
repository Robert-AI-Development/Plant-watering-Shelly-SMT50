# 21 · SEO and keywords

[Deutsch](../de/21-seo-keywords.md) · **English** — [Handbook](README.md) · Part F "Development"

> **At a glance**
> - The project is meant to be found – by Shelly users, makers ("DIY smart home"), people who want their plants looked after while on vacation, and the growing group that codes with AI at home. This chapter records the market analysis from September 2026 and the placement plan.
> - Scope: five keyword clusters in German and English, four places in the repository (README, chapter 01, Pages start page, `package.json`) and three fields on GitHub (About text, website, topics) that can only be set by hand.
> - Key number: 20 topics – GitHub accepts no more; the same number of `keywords` is in `package.json` (as of <!-- fact:project.version -->0.2.0<!-- /fact -->).
> - Biggest pitfall: About text, website and topics do not live in the repository. On 15 Sep 2026 all three were empty (`description: null`, `topics: []`) – they have to be entered in GitHub's web UI or via the API.

## Prerequisites

- none – a reading chapter. Entering the GitHub fields needs write access to the repository; the example output only needs `curl` and internet access.

## Diagram

[![Data flow: five search intents lead to five keyword clusters; they become title, slogan, description and keyword list, which live in the README, in chapter 01, on the Pages start page, in package.json and in the GitHub About box](../diagramme/en/21-seo-keywords.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/21-seo-keywords.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/21-seo-keywords.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "Audiences and clusters", 2 "Texts and places", 3 "GitHub by hand". In the picture the description feeds the About text and the keyword list feeds the GitHub topics; almost the same terms (18 of 20) are the `keywords` in `package.json`, which is why the dashed edge says "keep in sync".

## Market situation

Short analysis, researched in September 2026 and recorded in the repository on 12 Sep 2026 (commit `1a4b145`). It is a snapshot, not a running measurement – whoever renews it adds the new date.

| Space | What exists | What is missing |
| --- | --- | --- |
| German-speaking | blog articles and YouTube videos (e.g. draeger-it.blog, simon42.com), the Shelly forum, Shelly's own page "Smart Garden Irrigation", maker sites (gardenergranny.de, ioBroker forum); guides and products dominate | open, well-documented GitHub projects specifically for Shelly scripts are rare |
| GitHub in general | many watering projects on ESP8266/ESP32 (br-mat/bewae, Insane-Plants, Plantwatery …) | hardly any Shelly script projects, practically none with self-learning logic on the device and no cloud |
| Trend | "AI coding at home / KI-Coding zuhause" (Claude Code, local automation) is growing fast | not yet taken in the watering niche |

**Conclusion:** The long-tail niche "Shelly Plus Uni + SMT50 + self-learning + script on the device + no cloud + programmed with AI" is free. Title, description and headings aim exactly there – not at the broad term "irrigation", which products and blogs occupy.

## Keyword clusters

Five clusters, each with its own search intent. German and English terms belong together: the README carries an English short paragraph, the handbook is bilingual, and the topics on GitHub are English.

| Cluster | Deutsch | English | Search intent |
| --- | --- | --- | --- |
| Product/core | Pflanzenbewässerung mit Shelly, automatische Pflanzenbewässerung, Bodenfeuchte SMT50, Temperatur DS18B20, Shelly Plus Uni | Shelly plant watering, automatic plant watering, soil moisture SMT50, DS18B20 temperature | find a solution |
| Benefit "vacation" | Pflanzen gießen im Urlaub, Urlaubsbewässerung, Zimmerpflanzen bewässern bei Abwesenheit | watering plants while on vacation, holiday plant watering, self-watering while away | strong buying motive |
| Property | selbstlernende Bewässerung, Bewässerung ohne Cloud, lokal, DIY Bewässerungscomputer, Smart-Home DIY | self-learning irrigation, no-cloud / local irrigation, DIY smart home, DIY watering controller | differentiation from products and cloud solutions |
| Technology | Shelly Script, mJS, KVS, Schedule, Shelly Gen2 scripting | Shelly script, mJS, KVS, schedule, Shelly Gen2 scripting | developers |
| AI trend | KI-Coding zuhause, mit KI programmieren, Claude Code, KI debuggt Hardware live | AI coding at home, vibe coding, Claude Code, AI debugs real hardware | trend, curiosity |

## Placement

Principle: the terms sit **naturally in running text** – in the title, in the first paragraph, in headings – never as a list of buzzwords. No keyword spam: one term in its place is enough.

| Place | What is there | Cluster |
| --- | --- | --- |
| [README.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/README.md) – title (H1) | "Selbstlernende Pflanzenbewässerung mit Shelly Plus Uni & SMT50 – DIY Smart Home ohne Cloud" (self-learning plant watering with Shelly Plus Uni & SMT50 – DIY smart home without cloud) | product/core, property |
| README – lead sentence and introduction | core terms plus "ohne Cloud" (no cloud), "selbstlernend" (self-learning), "mit Claude Code"; benefit paragraph "Pflanzen im Urlaub versorgen" (look after plants on vacation); unique selling point "KI debuggt Hardware live" (AI debugs hardware live) | property, benefit, AI trend |
| README – English short paragraph | the same terms in English ("self-learning Shelly plant-watering system … locally, no cloud … watering plants while on vacation"); the landing page gets its own twin `README.en.md` for this | all, English |
| [01 · Overall architecture](01-gesamtarchitektur.md) – "At a glance" | positioning: local, no cloud, learns the effect of one pump second, for house and balcony plants while on vacation; the [handbook index](README.md) repeats it in two sentences | product/core, property, benefit |
| Pages start page [index.md](../index.md) and [_config.yml](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/docs/_config.yml) | `title` and `description` from `_config.yml` become the `<title>` and meta description of every Pages page (Primer theme; checked in the `<head>` on 15 Sep 2026, example output below) | product/core, property |
| [package.json](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/package.json) | `description` (263 characters: core terms, no cloud, vacation, Claude Code, DIY smart home, Node mock) and `keywords` (20 terms) for the GitHub search (the package is `private`, it never appears on npm) | all |
| GitHub About and topics | description, website and 20 topics – not via git but in the web UI or via the GitHub API with a token (next section) | all |

> **Note:** A new README title or a rebuilt start page must keep the core terms: Pflanzenbewässerung (plant watering), Shelly Plus Uni, SMT50, selbstlernend (self-learning), ohne Cloud (no cloud), Urlaub (vacation), Claude Code. The cluster table is the checklist for that.

## GitHub: About and topics

About text, website and topics belong to the repository on GitHub, not to the files in it – `git push` does not change them. They are entered once in the web UI (steps below) or set via the GitHub API with a token: `PATCH /repos/{owner}/{repo}` for description and website, `PUT /repos/{owner}/{repo}/topics` for the topics. As of 15 Sep 2026 all three fields are empty (public GitHub API, example output below).

1. Open the repository on GitHub and click the gear next to "About" on the right.
2. Enter the **Description** (text below); GitHub shows it in the repository header and in search results.
3. Enter the **Website**: `https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/` – the Pages start page with the handbook in both languages.
4. Enter the **Topics**: the 20 terms below, lowercase, words joined with hyphens; GitHub accepts no more than 20.
5. Save and verify with the `curl` calls from the example output.

**About (description, 185 characters; the proposal is German, the topics carry the English terms):**

> Selbstlernende Pflanzenbewässerung mit Shelly Plus Uni (SMT50, DS18B20) – läuft lokal ohne Cloud, programmiert & live-debuggt mit KI (Claude Code). DIY Smart Home, ideal für den Urlaub.

**Topics (20):**

```text
shelly shelly-plus-uni shelly-script smart-home home-automation
plant-watering irrigation soil-moisture smt50 ds18b20 diy iot
automatic-watering self-watering no-cloud mjs claude-code ai-coding
gardening self-learning
```

Comparison with `package.json`: 18 of the 20 terms are in both lists. `package.json` additionally carries the German search terms `pflanzenbewaesserung` and `urlaubsbewaesserung`, the topics list instead the topics `gardening` and `self-learning`, which are common on GitHub. Whoever changes one list updates the other.

## Slogans

The primary slogan joins three clusters in one sentence: product (watering, Shelly), AI trend (Claude Code) and property (local). The alternatives each stress one buying motive.

| Use | Deutsch | English |
| --- | --- | --- |
| Primary – lead sentence or introduction in the README, talks, posts | „Gieß smart – Programmierung out of the box mit KI (Claude Code), läuft lokal auf deinem Shelly.“ | "Water smart – programming out of the box with AI (Claude Code), running locally on your Shelly." |
| Subtitle | „DIY Smart-Home zum Mitprogrammieren.“ | "DIY smart home you can code yourself." |
| Alternative 1 – property | „Deine Pflanzen. Dein Shelly. Deine KI. – Bewässerung ohne Cloud.“ | "Your plants. Your Shelly. Your AI." |
| Alternative 2 – benefit "vacation" | „Selbstlernend gießen – sogar im Urlaub.“ | "Self-learning watering – even on vacation." |
| Alternative 3 – AI trend | „KI debuggt echte Hardware – und es läuft.“ | "AI debugs real hardware – and it works." |

## Example output

Check from 15 Sep 2026 via the public GitHub API (no token) and the Pages start page. The first two commands show the GitHub fields, the third the `<head>` of the start page:

```bash
curl -s https://api.github.com/repos/Robert-AI-Development/Plant-watering-Shelly-SMT50/topics                                    # topics; empty list = not entered yet
curl -s https://api.github.com/repos/Robert-AI-Development/Plant-watering-Shelly-SMT50 | grep -E '^  "(description|homepage)"'   # About text and website
curl -s https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/ | grep -E '<title>|name="description"'              # Pages start page: title and meta description
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

Reading: topics, About text and website are still empty on GitHub (open, steps above). The Pages start page carries title and meta description from `docs/_config.yml` (Jekyll 3.10.0 according to the `generator` tag) – five of the seven core terms are already there; Urlaub (vacation) and Claude Code are missing from `description`.

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Repository appears on GitHub without description, website and topics | About fields never entered – they do not live in the repository, `git push` does not change them | enter them in the web UI (steps above) and verify with `curl` |
| English-speaking searchers do not find the project | only German terms in title, description and topics | English short paragraph or `README.en.md`, English topics from the list above, bilingual handbook |
| `keywords` in `package.json` and topics drift apart | one list changed, the other not | align both: 18 shared terms, two of their own each (above) |
| Pages pages without meta description or with a generic title | `title` or `description` in `docs/_config.yml` empty | fill them in; the Primer theme builds the meta tags from them; check the `<head>` as in the example output |
| Text reads like a list of buzzwords | keyword spam | every term once in its natural place: title, first paragraph, heading |
| README title shortened, core terms gone | rebuild without looking at the cluster table | the H1 carries product/core and property: Pflanzenbewässerung, Shelly Plus Uni, SMT50, selbstlernend, ohne Cloud |
| Market situation quoted as current | the analysis is a snapshot from September 2026 | when renewing it, add the date and sources to this chapter |

## Next

- [README](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/README.md) – the landing page where title, lead sentence and introduction carry the keywords.
- [Handbook index](README.md) – all 21 chapters with reading paths for beginners, makers and AI agents.
- [01 · Overall architecture](01-gesamtarchitektur.md) – the "At a glance" box that holds the positioning.
