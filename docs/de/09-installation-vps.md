# 09 · Installation mit VPS-Server (SSH-Rückwärtstunnel)

**Deutsch** · [English](../en/09-installation-vps.md) — [Handbuch](README.md) · Teil C „Installieren“

> **Auf einen Blick**
> - Ergebnis: Der Shelly zuhause ist auf deinem Server unter `http://127.0.0.1:8010` erreichbar – alle Werkzeuge aus `tools/` und Claude Code arbeiten dort so, als stünde das Gerät im selben Netz.
> - Umfang: acht Schritte – Server mieten, einloggen, git und Node 22, Projekt holen, Tunnel starten, Verbindung testen, Installation mit `127.0.0.1:8010` als `<ip>`, Sandbox freigeben.
> - Kernzahlen: Tunnelport `8010` bindet nur an `127.0.0.1` des VPS; `npm test` auf dem Server zeigt <!-- fact:tests -->146<!-- /fact --> Tests grün; die Werkzeuge brauchen Node ≥ 22.
> - Größter Stolperstein: das Tunnelfenster auf dem PC schließt sich – jede Anfrage wird abgewiesen (`Failed to connect` bei `curl`, `fetch failed` bei den Werkzeugen); in Claude Code blockt zusätzlich die Sandbox, bis `127.0.0.1` in `.claude/settings.local.json` steht.

## Voraussetzungen

- Gerät nach [05 · Verkabelung und Hardware-Aufbau](05-verkabelung-und-aufbau.md) verdrahtet und im WLAN; Peripherie und Eingang 1 nach [06 · Startanleitung](06-startanleitung.md) angelegt; LAN-IP des Shelly bekannt (Beispiel `192.168.88.10`).
- Ein PC im Heimnetz, der den Shelly erreicht (`ping 192.168.88.10`), mit SSH-Client: macOS und Linux bringen `ssh` mit, Windows 10/11 ebenfalls (PowerShell); unter Windows ist MobaXterm die bequeme Alternative.
- Ein VPS mit Ubuntu oder Debian und SSH-Zugang (SSH-Schlüssel statt Passwort). Node ≥ 22 und git werden dort installiert; das Projekt hat keine weiteren Abhängigkeiten.
- Debug-Websocket am Shelly eingeschaltet (Web-UI → Scripts → ein Script → Konsole öffnen); sonst zeigen `console.js` und `hwtest.js watch` keine Konsolenzeilen. `preflight` meldet „Debug-Websocket an/aus“.
- Optional ein Anthropic-Konto, wenn Claude Code auf dem VPS mitarbeiten soll ([10 · Installation mittels Claude Code](10-installation-claude-code.md)).

## Diagramm

[![Rückwärtstunnel: PC, VPS und Shelly mit Sandbox-Freigabe und GitHub](../diagramme/de/09-installation-vps.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/09-installation-vps.html)

[Interaktive Fassung](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/de/09-installation-vps.html) (Zoom, Suche, Fokus, Beziehungs-Trace, Hell/Dunkel): Story-Kapitel 1 „Der Tunnel“, 2 „Werkzeuge über den Tunnel“, 3 „Sicherheit“, 4 „Code holen und zurückschreiben“.

## Warum ein Rückwärtstunnel

Der VPS steht im Internet und hat keinen Weg in dein Heimnetz: Router und NAT lassen keine Verbindung von außen zu. Der Rückwärtstunnel dreht die Richtung um. Dein PC, der den Shelly im LAN sieht, baut eine SSH-Verbindung zum VPS auf und sagt ihm: „Was bei dir auf Port 8010 ankommt, reiche über diese Verbindung an `192.168.88.10:80` weiter.“

Ab dann antwortet der Shelly auf dem VPS unter `http://127.0.0.1:8010`. Überall, wo das Handbuch `<ip>` schreibt, setzt du diese Adresse ein – die Werkzeuge merken keinen Unterschied. So kann auch Claude Code auf dem VPS die echte Hardware live bedienen: KVS lesen und schreiben, Scripts hochladen, die Geräte-Konsole mitlesen.

| Rolle | Ort | Aufgabe |
| --- | --- | --- |
| Shelly Plus Uni | Heimnetz, `192.168.88.10:80` | Web-UI und RPC, Scripts, KVS, Debug-Websocket – läuft unabhängig vom Tunnel |
| Dein PC | Heimnetz | hält die SSH-Verbindung zum VPS offen (MobaXterm oder `ssh -R`); nur er muss den Shelly sehen |
| VPS | Internet | Repository, Werkzeuge in `tools/`, optional Claude Code; sieht den Shelly ausschließlich über `127.0.0.1:8010` |

> **Hinweis:** Der Tunnel führt nur zu Port 80 des Shelly, zu nichts anderem im Heimnetz. Statt des PCs kann auch ein Raspberry Pi im Heimnetz den Tunnel dauerhaft halten – derselbe Befehl.

## Server vorbereiten

### VPS mieten

Ein kleiner Server reicht: 1–2 vCPU und 4 GB RAM, Betriebssystem Ubuntu 22.04 LTS oder neuer. Das Projekt läuft auf einem Hostinger-VPS (Tarif KVM 1 oder 2 genügt). Über den Freunde-werben-Freunde-Link bekommst du einen Rabatt und unterstützt das Projekt: <https://www.hostinger.com/de?REFERRALCODE=KPQ4INFOETIT>.

1. Tarif und Betriebssystem wählen.
2. Beim Einrichten einen SSH-Schlüssel hinterlegen (besser als ein Root-Passwort).
3. IP-Adresse und Benutzername des Servers notieren.

### Per SSH einloggen

```bash
ssh <benutzer>@<vps-ip>   # z. B. ssh root@203.0.113.10; den Fingerabdruck beim ersten Mal mit yes bestätigen
```

Unter Windows geht das in der PowerShell oder in MobaXterm (links „Sessions“ → SSH). Diese Sitzung führt später alle Befehle auf dem VPS aus; der Tunnel läuft in einem zweiten Fenster.

### git und Node 22 installieren

```bash
sudo apt update && sudo apt install -y git curl                     # Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -   # Paketquelle für Node 22 LTS
sudo apt install -y nodejs
node -v                                                             # muss v22 oder höher zeigen
```

> **Hinweis:** Tests und Build laufen ab Node 20; `tools/console.js` und `tools/hwtest.js` brauchen das eingebaute `fetch` und `WebSocket` ab Node 22. Es gibt keine weiteren Abhängigkeiten – kein Paket muss nachinstalliert werden.

### Projekt holen und testen

```bash
git clone https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50.git
cd Plant-watering-Shelly-SMT50
npm test          # alle Tests gegen den Mock, ganz ohne Gerät – Anzahl siehe unten
npm run check     # node --check der sechs Scripts
npm run build     # dist/: Kompakt-Ausgabe für den Upload (ist eingecheckt, der Build hält sie aktuell)
```

Zeigt `npm test` am Ende `# pass <!-- fact:tests -->146<!-- /fact -->`, ist der Server fertig. Wer eigene Änderungen zurückschreiben will, braucht einen Fork – siehe unten.

## Tunnel aufbauen

### Mit ssh (macOS, Linux, Windows-Terminal)

Auf deinem PC im Heimnetz, nicht auf dem VPS:

```bash
ssh -N -R 8010:192.168.88.10:80 <benutzer>@<vps-ip>   # -N: keine Shell, nur der Tunnel – Fenster offen lassen
```

| Teil | Bedeutung |
| --- | --- |
| `-N` | keine Shell öffnen, nur weiterleiten |
| `-R 8010:…` | Port 8010 auf dem VPS zeigt über diese Verbindung zurück ins Heimnetz |
| `192.168.88.10:80` | LAN-IP und HTTP-Port des Shelly – deine IP einsetzen |
| `<benutzer>@<vps-ip>` | derselbe Login wie beim `ssh`-Einloggen |

Ist Port 8010 auf dem VPS belegt, nimm einen anderen (z. B. 8011) – dann überall `127.0.0.1:8011` schreiben. Bricht die Verbindung bei Inaktivität ab, hilft die SSH-Option `-o ServerAliveInterval=30`.

### Mit MobaXterm (Windows)

MobaXterm ist ein kostenloses SSH-Programm mit grafischem Tunnel-Manager: <https://mobaxterm.mobatek.net/download.html> (Home Edition; die „Portable edition“ läuft ohne Installation).

1. Menü **Tools → MobaSSHTunnel** öffnen → **New SSH tunnel**.
2. **Remote port forwarding** wählen.
3. **Forwarded port** (SSH-Server-Seite): `8010`.
4. **SSH server / SSH login / SSH port:** VPS-IP, dein Benutzer, Port `22`.
5. **Forward to** (Ziel im LAN): `192.168.88.10`, Port `80`.
6. Tunnel speichern und mit dem **Play-Knopf** starten; beim ersten Mal fragt er nach Passwort oder nutzt den SSH-Schlüssel.

Solange das Tunnelfenster läuft, ist der Shelly auf dem VPS erreichbar. Dieselbe Verbindung kannst du parallel als normale SSH-Sitzung nutzen (links „Sessions“ → SSH zum VPS) und darin arbeiten.

### Verbindung testen

Auf dem VPS:

```bash
curl -s http://127.0.0.1:8010/rpc/Shelly.GetDeviceInfo   # eine JSON-Zeile mit id, model, ver (Firmware) und app
node tools/hwtest.js 127.0.0.1:8010 status               # Einzeiler: laufende Scripts, Sensoren, Switch
```

Kommt die JSON-Zeile, steht der Tunnel. `hwtest.js` versucht jede RPC dreimal (Timeout 10 s, 1 s Pause) und meldet danach `fetch failed – Tunnel 127.0.0.1:8010 offen?`; `curl` meldet sofort `Failed to connect` (siehe Beispielausgabe).

## Installation über den Tunnel

Die Reihenfolge ist dieselbe wie in [06 · Startanleitung](06-startanleitung.md) und [08 · Installation mit lokalem Server](08-installation-lokaler-server.md); einziger Unterschied ist die Adresse `127.0.0.1:8010`.

1. Vorprüfung: `node tools/hwtest.js 127.0.0.1:8010 preflight` – Uhrzeit (NTP), Sekunden bis zum nächsten Takt, Scripts mit IDs, Eingang 1, Ausgang, Sensoren, KVS, Debug-Websocket. Legt `bw_zeitraffer` an, falls es fehlt (mit `preflight hw` auch die Hardware-Test-Scripts), und nennt die Upload-Befehle.
2. Betriebs-Scripts anlegen, Namen exakt `bw_install`, `bw_main`, `bw_pump`: in der Web-UI zuhause oder vom VPS per RPC: `curl -s -X POST http://127.0.0.1:8010/rpc/Script.Create -d '{"name":"bw_main"}'` – die Antwort nennt die ID. IDs vergibt das Gerät; `node tools/hwtest.js 127.0.0.1:8010 scripts` zeigt sie mit Größe und `fs_free`.
3. Upload je Script: `node tools/put-script.js 127.0.0.1:8010 <id> dist/bw_main.js` (ebenso `bw_install`, `bw_pump`, `bw_zeitraffer`). Das Werkzeug prüft den Flash (Reserve 4 096 B), stoppt das Script, sendet in 1 024-Zeichen-Stücken, lädt den Code zurück und vergleicht byteidentisch.
4. Prüfung 2: `node tools/verify-scripts.js 127.0.0.1:8010` – alle Scripts gegen `dist/`, Doku-Zeilen, gleiche Version von `bw_main` und `bw_pump`. Erwartet: „alle byteidentisch“.
5. Zielband `cfg2` eintragen (Werte und Herleitung in [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md)) – per Web-UI zuhause oder durch den Tunnel: `curl -s -X POST http://127.0.0.1:8010/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctSoll\":55,\"pctLo\":40,\"pctOk\":50,\"pctHi\":60,\"pctDry\":28,\"dropSlow\":4}"}'`. Vor dem Installer reicht dieses Teilobjekt, er ergänzt die übrigen Felder (`hyst`, `effMin` …) mit Startwerten.
6. Installer: `node tools/hwtest.js 127.0.0.1:8010 normal 60` – wartet den sicheren Moment ab (Sekunde 8–30, nicht bis 9 Minuten nach `winA`/`winB`, kein Betriebs-Script läuft; höchstens 4 Minuten), startet `bw_install`, liest die Konsole mit und prüft danach Zeitplan, `cfg3`, `cfg4` und `auto_off`.
7. Erstes Fenster mitlesen: `node tools/console.js 127.0.0.1:8010 900` ab 07:59 bzw. 19:59 verbinden. `hwtest.js watch` endet im Normalbetrieb nach wenigen Sekunden – es ist für Test-Scripts und den Zeitraffer gedacht.

> **Hinweis:** `KVS.Set` ersetzt den ganzen Eintrag. Nach dem Installer nur noch das vollständige Objekt schreiben (Web-UI → Key-Value Storage → „Format as JSON“) oder nach einem Teil-Schreiben `normal 60` erneut laufen lassen – fehlt ein Pflichtfeld wie `cfg2.hyst`, bricht `bw_main` jeden Takt mit `err=cfg` ab (Konsole `Störung cfg: cfg2.hyst fehlt`), bis der Installer es wieder ergänzt.

| Werkzeug | Aufgabe | Beispiel durch den Tunnel |
| --- | --- | --- |
| `tools/put-script.js <ip> <id> <datei>` | Script in Stücken hochladen und byteidentisch prüfen | `node tools/put-script.js 127.0.0.1:8010 <id> dist/bw_main.js` |
| `tools/verify-scripts.js <ip>` | alle Scripts am Gerät gegen `dist/` vergleichen | `node tools/verify-scripts.js 127.0.0.1:8010` |
| `tools/console.js <ip> [sek] [id]` | Konsole über den Debug-Websocket mitlesen (Standard 10 s), optional ein Script starten | `node tools/console.js 127.0.0.1:8010 900` |
| `tools/hwtest.js <ip> <kommando>` | Vorprüfung, Installer (`normal`), Zeitraffer, Hardware-Test, Messläufe | `node tools/hwtest.js 127.0.0.1:8010 preflight` |
| `tools/kvs_dump.sh <ip>` | alle KVS-Einträge seitenweise ausgeben | `tools/kvs_dump.sh 127.0.0.1:8010` |
| `curl` | jede RPC direkt, z. B. KVS lesen | `curl -s "http://127.0.0.1:8010/rpc/KVS.GetMany?match=*"` |

Die vollständige Werkzeug-Referenz mit allen Unterbefehlen steht in [14 · Debuggen und Testen](14-debuggen-und-testen.md).

> **Am Gerät gemessen (13.09.2026):** Upload und Prüfung durch den Tunnel: `bw_pump` <!-- fact:dist.bw_pump -->17475<!-- /fact --> B, `bw_main` <!-- fact:dist.bw_main -->15791<!-- /fact --> B, `bw_install` <!-- fact:dist.bw_install -->15978<!-- /fact --> B, `bw_zeitraffer` 7 453 B (heute <!-- fact:dist.bw_zeitraffer -->7459<!-- /fact --> B) – alle byteidentisch, Versionen `bw_main` = `bw_pump`. Flash: 12 288 B frei mit sieben Scripts, 49 152 B nach dem Löschen von `engine_probe`, `bw_hwtest` und `bw_hwpump`, 40 960 B nach dem Upload.

## Claude Code auf dem VPS: Sandbox freigeben

Claude Code führt Befehle in einer Sandbox mit Netzwerksperre aus. Damit die KI den Tunnelport nutzen darf, muss `127.0.0.1` in der persönlichen Einstellungsdatei stehen. Die Datei liegt im Projektordner und ist per `.gitignore` ausgenommen – sie wird nie eingecheckt.

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": ["127.0.0.1", "localhost"]
    }
  }
}
```

Pfad: `.claude/settings.local.json`. Am einfachsten sagst du es Claude Code direkt: „erlaube lokalen Zugriff auf `http://127.0.0.1:8010`“ – der `update-config`-Skill trägt es ein. Danach mit `curl http://127.0.0.1:8010/rpc/Shelly.GetDeviceInfo` aus der Claude-Sitzung testen. Wie Claude Code installiert wird und die Installation im Interview führt, steht in [10 · Installation mittels Claude Code](10-installation-claude-code.md).

## Sicherheit

- Der Tunnel bindet an `127.0.0.1` des VPS (OpenSSH-Standard ohne `GatewayPorts`): Port 8010 ist nur für Prozesse auf dem Server erreichbar, nicht aus dem Internet.
- Wer eine Shell auf dem VPS hat, erreicht deinen Shelly. Halte den Server für dich, nutze SSH-Schlüssel statt Passwörter und schließe den Tunnel, wenn du fertig bist (Fenster schließen oder Stopp in MobaXterm).
- Der Tunnel öffnet genau eine Adresse, `192.168.88.10:80`; der VPS sieht sonst nichts vom Heimnetz.
- Claude Code auf dem VPS ändert Konfiguration am Gerät nur auf Zuruf (z. B. `input-on`) und committet oder pusht nur mit ausdrücklicher Zustimmung – die Regel steht in [AGENTS.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/AGENTS.md).

## Wenn der Tunnel abreißt

- Die Betriebs-Scripts laufen per Zeitplan am Gerät weiter: `bw_main` alle <!-- def:cfg3.tick -->15<!-- /def --> Minuten, `bw_pump` in den Fenstern. Der Tunnel dient nur den Werkzeugen; nichts am Shelly hängt vom VPS ab.
- Hardware-Test: jede Phase hat einen Timeout (`hwt.tPhase` <!-- hwt:tPhase -->900<!-- /hwt --> s), der ganze Lauf ebenfalls (`hwt.tAll` <!-- hwt:tAll -->3600<!-- /hwt --> s); eine Phase, auf die niemand antwortet, endet mit Code `to`. Der Stand steht im KVS (`hwr` Sensortest, `hwp` Pumpentest) und ist nach dem Wiederverbinden mit `status` oder `report` lesbar.
- `hwtest.js watch` prüft alle 5 s, ob der Websocket noch steht, verbindet ihn nach einem Abriss neu und übersteht RPC-Fehler (`[status] RPC-Fehler, weiter: …`). Ein zwischen Durchgang A und B unterbrochener Pumpentest wird mit `start bw_hwpump` fortgesetzt: die Sicherung `hwb1`/`hwb2` schaltet direkt auf Durchgang B (`bw_pump` muss beendet sein).
- Zeitraffer: das Gerät bleibt im Profil (Takt <!-- zr:cfg3.tick -->3<!-- /zr --> min, Fenster alle <!-- zr:cfg3.winEvery -->6<!-- /zr --> min), misst weiter und gießt höchstens `maxDay` <!-- zr:cfg3.maxDay -->4<!-- /zr --> Fenster je Tag (`why=limit`); zurück in den Normalbetrieb geht es erst mit `node tools/hwtest.js 127.0.0.1:8010 normal 60` (Original aus `zrb1..5`). Der Rekorder von `kal` schreibt seine Datei jede Minute fort – ein Abbruch kostet höchstens eine Minute.
- Reißt der Tunnel während eines Uploads, liegt halber Code am Gerät: `put-script.js` erneut ausführen, `verify-scripts.js` zeigt sonst „WEICHT AB ab Zeichen …“.

## Eigener Fork: Deploy-Key oder Token

`git clone` vom Projekt reicht zum Installieren. Wer eigene Änderungen dauerhaft speichern oder teilen will, arbeitet in einem Fork und schreibt per SSH zurück – HTTPS hat auf einem frischen VPS keine Zugangsdaten.

1. Auf GitHub einen Fork anlegen; auf dem VPS den Fork klonen oder den Remote umstellen: `git remote set-url origin git@github.com:<github-benutzer>/Plant-watering-Shelly-SMT50.git`.
2. Schlüssel auf dem VPS erzeugen: `ssh-keygen -t ed25519 -C "vps"`; den öffentlichen Teil zeigt `cat ~/.ssh/id_ed25519.pub`.
3. Öffentlichen Schlüssel eintragen: im Fork unter **Settings → Deploy keys** mit „Allow write access“ (gilt nur für dieses Repository) oder im Konto unter **Settings → SSH and GPG keys**.
4. Prüfen: `ssh -T git@github.com` begrüßt dich mit deinem Benutzernamen; danach `git push`.

Alternative ohne SSH: ein Personal Access Token (fine-grained, Berechtigung „Contents: Read and write“ für den Fork) beim `git push` über HTTPS als Passwort eingeben. Commit und Push gibt es nur mit ausdrücklicher Zustimmung des Menschen – Claude Code fragt vorher ([AGENTS.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/AGENTS.md)).

## Beispielausgabe

Tunnel geschlossen (VPS, 15.09.2026) – so sieht der häufigste Fehler aus:

```text
$ curl -s -m 5 http://127.0.0.1:8010/rpc/Shelly.GetDeviceInfo
curl: (7) Failed to connect to 127.0.0.1 port 8010 after 0 ms: Couldn't connect to server
$ node tools/hwtest.js 127.0.0.1:8010 status
Fehler: KVS.Get: fetch failed – Tunnel 127.0.0.1:8010 offen? (Handbuch 6)
```

Der Hinweis „Handbuch 6“ im Werkzeug meint dieses Kapitel. Tunnel offen (VPS, 13.09.2026): Vorprüfung, sicherer Moment und Script-Start von `hwtest.js` sowie die ersten Konsolenzeilen des Geräts, alles durch den Tunnel, aus `docs/kal/2026-09-13-13-50-kal-log.txt`:

```text
ok       Uhrzeit 15:49 lokal, ram_free 133672, fs_free 40960
ok       cfg2 Zielband: pctLo 40 → Gabe, pctOk 50 Ziel erreicht, pctSoll 55, pctHi 60 zu viel, pctDry 28
ok       Wasserstand VOLL (lvl=false)
ok       Ausgang aus
ok       Sensoren: V=0.590 (10 %) tC=23.6
warte – Sekunde 52, warte auf 8–30
…
sicherer Moment: 15:50:09
Script.Start bw_zeitraffer (id 7) → {"was_running":false}
…
[bw_install 0.1.3] Script-IDs: install=1 main=2 pump=3
[bw_install 0.1.3] Zeitplan: 3 Einträge, davon eigene: 3
```

Die Antwort des Referenzgeräts auf `Shelly.GetDeviceInfo` ist noch nicht protokolliert `[TODO am Gerät]`; sie enthält `id` (`shellyplusuni-…`), `model`, `gen`, `ver` (Firmware, am Referenzgerät 2.0.0) und `app`.

## Typische Fehler

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| `curl: (7) Failed to connect to 127.0.0.1 port 8010` oder `fetch failed – Tunnel 127.0.0.1:8010 offen?` | Tunnel läuft nicht: Fenster geschlossen, PC im Standby, SSH-Verbindung abgebrochen | Tunnel neu starten (Play in MobaXterm bzw. `ssh -N -R …`); das Werkzeug danach erneut aufrufen |
| Tunnel steht, aber `curl` meldet `(52) Empty reply from server` oder die Werkzeuge hängen je Versuch 10 s (`hwtest.js` dreimal, `put-script.js` einmal; `verify-scripts.js` 15 s), `curl` ohne `-m` unbegrenzt | der PC erreicht den Shelly nicht: falsche LAN-IP, Gerät stromlos, anderes WLAN | vom PC `ping 192.168.88.10`; IP im Router oder in der Shelly-App prüfen; Tunnelbefehl mit der richtigen IP |
| `Warning: remote port forwarding failed for listen port 8010` | Port 8010 auf dem VPS belegt, meist ein hängender alter Tunnel | alte `ssh`-Sitzung auf dem VPS beenden oder Port 8011 nehmen – dann überall `127.0.0.1:8011` |
| Befehle gegen `127.0.0.1:8010` scheitern nur innerhalb von Claude Code | Netzwerksperre der Sandbox | `127.0.0.1` und `localhost` in `.claude/settings.local.json` freigeben (siehe oben) |
| `ReferenceError: WebSocket is not defined` bei `console.js` oder `hwtest.js` | Node älter als 22 | Node 22 installieren, `node -v` prüfen |
| Konsole bleibt leer, obwohl der Tunnel steht | Debug-Websocket am Shelly aus | Web-UI → Scripts → Konsole öffnen; `preflight` meldet „Debug-Websocket aus“ |
| `Flash zu voll: fs_free …` beim Upload | zu wenig Flash für Script plus Reserve 4 096 B | Test-Scripts löschen: `hwtest.js … scripts`, dann `delete <id>` (13.09.2026: 12 288 → 49 152 B) |
| Upload „FEHLER, Code weicht ab (… Byte Differenz)“ | Verbindung während des Uploads gestört | `put-script.js` erneut, danach `verify-scripts.js` |
| `git push` fragt nach Benutzername und Passwort oder wird abgewiesen | HTTPS-Remote ohne Zugangsdaten | Fork mit Deploy-Key (SSH-Remote) oder Token, siehe oben |

## Weiter zu

- [10 · Installation mittels Claude Code](10-installation-claude-code.md) – Claude Code auf dem VPS starten und die Installation im Interview führen lassen.
- [11 · Hardware-Check](11-hardware-check.md) – Sensoren, Schwimmer und Pumpe durch den Tunnel prüfen, der Mensch handelt am Aufbau.
- [12 · Erstinbetriebnahme](12-erstinbetriebnahme.md) – Kalibrierung, Zielband und Zeitraffer, alles über `127.0.0.1:8010`.
- [14 · Debuggen und Testen](14-debuggen-und-testen.md) – vollständige Werkzeug-Referenz und Konsole.
