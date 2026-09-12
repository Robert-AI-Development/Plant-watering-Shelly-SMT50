# 6 · Shelly per Remote live debuggen — live-debug the Shelly remotely

**Sprache / Language:** [Deutsch](#deutsch) · [English](#english) — [Handbuch-Index](README.md)

---

## Deutsch

Das ist die **Besonderheit dieses Projekts:** Claude Code läuft auf einem VPS, der Shelly hängt in deinem
**Heimnetz** – und trotzdem kann die **KI die echte Hardware direkt live debuggen**: KVS lesen/schreiben, Scripts
hochladen, die Geräte-Konsole live mitlesen. Möglich macht das ein **SSH-Rückwärtstunnel** von deinem lokalen
Rechner (der den Shelly im LAN sieht) zum VPS.

### Das Problem und die Lösung

```
   Heimnetz (LAN)                        Internet                    VPS (Cloud)
 ┌────────────────┐                                          ┌───────────────────────┐
 │  Shelly         │   192.168.88.10:80                       │  Claude Code           │
 │  192.168.88.10  │◄───────────┐                             │  greift zu auf         │
 └────────────────┘             │                             │  127.0.0.1:8010  ──────┼──┐
 ┌────────────────┐             │      SSH -R (Rückwärts-     │                        │  │
 │ dein PC         │────────────┴────► tunnel) 8010 ──────────┼─► 127.0.0.1:8010       │  │
 │ (MobaXterm)     │  sieht Shelly     │                      └───────────────────────┘  │
 └────────────────┘  im LAN                                        └── = Shelly ─────────┘
```

Der VPS hat **keinen** Zugang zu deinem Heimnetz. Der Tunnel dreht die Richtung um: Dein PC baut die SSH-Verbindung
zum VPS auf und sagt „Port **8010** auf dem VPS soll auf meinen Shelly **192.168.88.10:80** zeigen". Danach
erreicht Claude Code den Shelly unter `http://127.0.0.1:8010`.

### Schnellstart

```bash
# 1) Auf deinem lokalen Rechner (der den Shelly im LAN sieht):
ssh -N -R 8010:192.168.88.10:80 <benutzer>@<vps-ip>
#   -N = keine Shell, nur der Tunnel. Fenster offen lassen.

# 2) Auf dem VPS (in der Claude-Code-Sitzung / Shell): Verbindung testen
curl -s http://127.0.0.1:8010/rpc/Shelly.GetDeviceInfo

# 3) Debuggen – die Werkzeuge des Projekts gegen 127.0.0.1:8010:
node tools/put-script.js 127.0.0.1:8010 2 dist/bw_main.js   # Script hochladen + Größe prüfen
node tools/console.js    127.0.0.1:8010 12 2                 # Konsole 12 s mitlesen, Script 2 starten
curl -s "http://127.0.0.1:8010/rpc/KVS.GetMany?match=*"      # KVS lesen
```

### MobaXterm einrichten (Windows, empfohlen)

**MobaXterm** ist ein kostenloses, komfortables SSH-Programm für Windows mit grafischem Tunnel-Manager.

1. **Herunterladen & installieren:** <https://mobaxterm.mobatek.net/download.html> → **Home Edition** (kostenlos).
   Die „Installer edition" installiert normal; die „Portable edition" läuft ohne Installation.
2. **Tunnel anlegen:** oben im Menü **Tools → MobaSSHTunnel** (Tunneling) öffnen → **New SSH tunnel**.
3. Im Dialog **„Remote port forwarding"** wählen und die drei Felder füllen:
   - **Forwarded port (SSH-Server-Seite):** `8010`
   - **SSH server / SSH login / SSH port:** deine **VPS-IP**, dein **Benutzer**, Port `22`
   - **Forward to (Ziel im LAN):** `192.168.88.10`, Port `80`
4. Tunnel **speichern** und mit dem **Play-Knopf** starten. Beim ersten Mal fragt er nach dem VPS-Passwort bzw.
   nutzt deinen SSH-Schlüssel. Solange das Tunnel-Fenster läuft, ist der Shelly auf dem VPS erreichbar.

> **Tipp:** Du kannst dieselbe Verbindung auch als normale SSH-Session nutzen (links „Sessions" → SSH zum VPS) und
> darin `claude` starten. Tunnel-Manager und Session laufen parallel.

### Auf dem VPS: Zugriff freigeben (Claude-Code-Sandbox)

Claude Code führt Befehle in einer Sandbox mit Netzwerksperre aus. Damit die KI den Tunnel-Port nutzen darf, muss
`127.0.0.1` in der **persönlichen** Einstellungsdatei stehen (nicht eingecheckt):

```jsonc
// .claude/settings.local.json  (im Projektordner, gitignoriert)
{
  "sandbox": {
    "network": {
      "allowedDomains": ["127.0.0.1", "localhost"]
    }
  }
}
```

Am einfachsten sagst du das Claude Code direkt: „erlaube lokalen Zugriff auf `http://127.0.0.1:8010`" – der
`update-config`-Skill trägt es ein. Danach `curl http://127.0.0.1:8010/rpc/Shelly.GetDeviceInfo` zum Test.

### Die Debug-Werkzeuge (im Repo, `tools/`)

| Werkzeug | Zweck | Beispiel |
| --- | --- | --- |
| `tools/put-script.js <ip> <id> <datei>` | Script per RPC in Stücken hochladen **und Byte-Zahl am Gerät prüfen** | `node tools/put-script.js 127.0.0.1:8010 1 dist/bw_install.js` |
| `tools/console.js <ip> [sek] [id]` | Geräte-Konsole über den Debug-Websocket mitlesen, optional ein Script starten | `node tools/console.js 127.0.0.1:8010 15 4` |
| `tools/probe/engine_probe.js` | Sondier-Script, um Engine-Eigenheiten am Gerät zu messen | per `put-script.js` hochladen, mit `console.js` beobachten |
| `tools/kvs_dump.sh <ip>` | KVS eines Geräts ausgeben | `tools/kvs_dump.sh 127.0.0.1:8010` |

**Ausführliches Debuggen:** In jedem Script steht oben `var DEBUG = 0;`. Mit `node tools/build.js --debug` erzeugst
du `dist/`-Dateien mit `DEBUG = 1` – die schreiben dann jeden Schritt, jeden RPC-Aufruf und jeden KVS-Eintrag in die
Konsole, die du mit `console.js` live mitliest. Für den Normalbetrieb wieder `npm run build` (DEBUG=0) hochladen.

### Quick-Notes & Fehlersuche

- **„connection refused" / Timeout auf `127.0.0.1:8010`** → Tunnel läuft nicht. MobaXterm-Tunnel starten bzw.
  `ssh -N -R …` erneut aufbauen. Dein PC muss den Shelly im LAN erreichen (`ping 192.168.88.10`).
- **Sandbox blockt den Zugriff** → `127.0.0.1` in `.claude/settings.local.json` (siehe oben) freigeben.
- **Upload „FEHLER, N Byte fehlen"** → `put-script.js` hat den Größenabgleich nicht bestanden; einfach erneut
  hochladen. Der Web-Editor verliert beim Einfügen manchmal Text – deshalb per RPC hochladen.
- **`Script.PutCode` scheitert** → Script muss gestoppt sein; `put-script.js` stoppt es vorher automatisch.
- **Port 8010 belegt** → im Tunnel und in den Befehlen einen anderen Port nehmen (z. B. 8011).
- **Sicherheit:** Der Tunnel bindet auf `127.0.0.1` des VPS – nur lokal auf dem VPS erreichbar, nicht öffentlich.
  Nutze SSH-Schlüssel statt Passwort und schließe den Tunnel, wenn du fertig bist.

Hintergrund zu allen am Gerät gefundenen Eigenheiten (Hoisting, Stacktiefe, KVS-Strings, Schedule-Retry):
[`../../LEARNING.md`](../../LEARNING.md).

---

## English

This is the **special part of this project:** Claude Code runs on a VPS, the Shelly sits in your **home network** –
and yet the **AI can live-debug the real hardware**: read/write KVS, upload scripts, watch the device console live.
This works via an **SSH reverse tunnel** from your local machine (which sees the Shelly on the LAN) to the VPS.

### The problem and the solution

The VPS has **no** access to your home network. The tunnel reverses the direction: your PC opens the SSH connection
to the VPS and says "port **8010** on the VPS should point to my Shelly **192.168.88.10:80**". After that Claude
Code reaches the Shelly at `http://127.0.0.1:8010`. (See the diagram in the German section.)

### Quick start

```bash
# 1) On your local machine (which sees the Shelly on the LAN):
ssh -N -R 8010:192.168.88.10:80 <user>@<vps-ip>
#   -N = no shell, tunnel only. Keep the window open.

# 2) On the VPS (in the Claude Code session / shell): test the connection
curl -s http://127.0.0.1:8010/rpc/Shelly.GetDeviceInfo

# 3) Debug – the project's tools against 127.0.0.1:8010:
node tools/put-script.js 127.0.0.1:8010 2 dist/bw_main.js   # upload script + verify size
node tools/console.js    127.0.0.1:8010 12 2                 # watch console 12 s, start script 2
curl -s "http://127.0.0.1:8010/rpc/KVS.GetMany?match=*"      # read KVS
```

### Set up MobaXterm (Windows, recommended)

**MobaXterm** is a free, convenient SSH client for Windows with a graphical tunnel manager.

1. **Download & install:** <https://mobaxterm.mobatek.net/download.html> → **Home Edition** (free). The "Installer
   edition" installs normally; the "Portable edition" runs without installation.
2. **Create a tunnel:** top menu **Tools → MobaSSHTunnel** (Tunneling) → **New SSH tunnel**.
3. Choose **"Remote port forwarding"** and fill the three fields:
   - **Forwarded port (SSH server side):** `8010`
   - **SSH server / SSH login / SSH port:** your **VPS IP**, your **user**, port `22`
   - **Forward to (target on LAN):** `192.168.88.10`, port `80`
4. **Save** the tunnel and start it with the **play button**. The first time it asks for the VPS password or uses
   your SSH key. As long as the tunnel window runs, the Shelly is reachable on the VPS.

> **Tip:** you can use the same connection as a normal SSH session (left "Sessions" → SSH to the VPS) and run
> `claude` in it. Tunnel manager and session run in parallel.

### On the VPS: allow access (Claude Code sandbox)

Claude Code runs commands in a sandbox with network restrictions. To let the AI use the tunnel port, `127.0.0.1`
must be in the **personal** settings file (not checked in):

```jsonc
// .claude/settings.local.json  (in the project folder, gitignored)
{
  "sandbox": {
    "network": {
      "allowedDomains": ["127.0.0.1", "localhost"]
    }
  }
}
```

Easiest: tell Claude Code directly "allow local access to `http://127.0.0.1:8010`" – the `update-config` skill
writes it. Then `curl http://127.0.0.1:8010/rpc/Shelly.GetDeviceInfo` to test.

### The debug tools (in the repo, `tools/`)

| Tool | Purpose | Example |
| --- | --- | --- |
| `tools/put-script.js <ip> <id> <file>` | upload a script via RPC in chunks **and verify the byte count on the device** | `node tools/put-script.js 127.0.0.1:8010 1 dist/bw_install.js` |
| `tools/console.js <ip> [sec] [id]` | watch the device console over the debug websocket, optionally start a script | `node tools/console.js 127.0.0.1:8010 15 4` |
| `tools/probe/engine_probe.js` | probe script to measure engine quirks on the device | upload via `put-script.js`, watch with `console.js` |
| `tools/kvs_dump.sh <ip>` | dump a device's KVS | `tools/kvs_dump.sh 127.0.0.1:8010` |

**Verbose debugging:** every script starts with `var DEBUG = 0;`. `node tools/build.js --debug` produces `dist/`
files with `DEBUG = 1` – they log every step, every RPC call and every KVS entry to the console you watch with
`console.js`. For normal operation upload `npm run build` (DEBUG=0) again.

### Quick notes & troubleshooting

- **"connection refused" / timeout on `127.0.0.1:8010`** → the tunnel is not running. Start the MobaXterm tunnel or
  re-establish `ssh -N -R …`. Your PC must reach the Shelly on the LAN (`ping 192.168.88.10`).
- **Sandbox blocks access** → allow `127.0.0.1` in `.claude/settings.local.json` (see above).
- **Upload "FEHLER, N Byte fehlen"** → `put-script.js` failed the size check; just upload again. The web editor
  sometimes loses text on paste – hence uploading via RPC.
- **`Script.PutCode` fails** → the script must be stopped; `put-script.js` stops it first automatically.
- **Port 8010 in use** → use a different port in the tunnel and commands (e.g. 8011).
- **Security:** the tunnel binds to the VPS's `127.0.0.1` – reachable only locally on the VPS, not publicly. Use an
  SSH key instead of a password and close the tunnel when done.

Background on all on-device quirks found (hoisting, stack depth, KVS strings, schedule retry):
[`../../LEARNING.md`](../../LEARNING.md).
