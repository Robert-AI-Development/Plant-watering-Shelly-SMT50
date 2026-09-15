# 09 · Installation with a VPS (reverse SSH tunnel)

[Deutsch](../de/09-installation-vps.md) · **English** — [Handbook](README.md) · Part C "Install"

> **At a glance**
> - Outcome: the Shelly at home is reachable on your server at `http://127.0.0.1:8010` – every tool in `tools/` and Claude Code work there as if the device were on the same network.
> - Scope: eight steps – rent a server, log in, git and Node 22, fetch the project, start the tunnel, test the connection, install with `127.0.0.1:8010` as `<ip>`, allow 127.0.0.1 in the sandbox.
> - Key numbers: tunnel port `8010` binds only to `127.0.0.1` of the VPS; `npm test` on the server shows <!-- fact:tests -->146<!-- /fact --> tests green; the tools need Node ≥ 22.
> - Biggest pitfall: the tunnel window on your PC closes – every request is refused (`Failed to connect` from `curl`, `fetch failed` from the tools); inside Claude Code the sandbox blocks as well until `127.0.0.1` is listed in `.claude/settings.local.json`.

## Prerequisites

- Device wired as in [05 · Wiring and hardware build](05-verkabelung-und-aufbau.md) and on Wi-Fi; peripherals and input 1 set up as in [06 · Start guide](06-startanleitung.md); LAN IP of the Shelly known (example `192.168.88.10`).
- A PC on the home network that reaches the Shelly (`ping 192.168.88.10`), with an SSH client: macOS and Linux ship `ssh`, Windows 10/11 too (PowerShell); on Windows MobaXterm is the convenient alternative.
- A VPS running Ubuntu or Debian with SSH access (SSH key rather than password). Node ≥ 22 and git get installed there; the project has no other dependencies.
- Debug websocket enabled on the Shelly (web UI → Scripts → a script → open the console); otherwise `console.js` and `hwtest.js watch` show no console lines. `preflight` reports „Debug-Websocket an/aus" (debug websocket on/off).
- Optionally an Anthropic account if Claude Code is to work on the VPS ([10 · Installation with Claude Code](10-installation-claude-code.md)).

## Diagram

[![Reverse tunnel: PC, VPS and Shelly with sandbox permission and GitHub](../diagramme/en/09-installation-vps.svg)](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/09-installation-vps.html)

[Interactive version](https://robert-ai-development.github.io/Plant-watering-Shelly-SMT50/diagramme/en/09-installation-vps.html) (zoom, search, focus, relationship trace, light/dark): story chapters 1 "The tunnel", 2 "Tools through the tunnel", 3 "Security", 4 "Fetch code and push back".

## Why a reverse tunnel

The VPS sits on the internet and has no way into your home network: router and NAT accept no connection from outside. The reverse tunnel turns the direction around. Your PC, which sees the Shelly on the LAN, opens an SSH connection to the VPS and tells it: "whatever arrives on your port 8010, pass it through this connection to `192.168.88.10:80`."

From then on the Shelly answers on the VPS at `http://127.0.0.1:8010`. Wherever the handbook writes `<ip>`, you put this address – the tools notice no difference. That is also how Claude Code on the VPS can operate the real hardware live: read and write the KVS, upload scripts, follow the device console.

| Role | Location | Task |
| --- | --- | --- |
| Shelly Plus Uni | home network, `192.168.88.10:80` | web UI and RPC, scripts, KVS, debug websocket – runs independently of the tunnel |
| Your PC | home network | keeps the SSH connection to the VPS open (MobaXterm or `ssh -R`); only it must see the Shelly |
| VPS | internet | repository, tools in `tools/`, optionally Claude Code; sees the Shelly exclusively through `127.0.0.1:8010` |

> **Note:** The tunnel leads only to port 80 of the Shelly, to nothing else on the home network. Instead of the PC, a Raspberry Pi on the home network can hold the tunnel permanently – same command.

## Prepare the server

### Rent a VPS

A small server is enough: 1–2 vCPU and 4 GB RAM, operating system Ubuntu 22.04 LTS or newer. The project runs on a Hostinger VPS (plan KVM 1 or 2 is plenty). This refer-a-friend link gives you a discount and supports the project: <https://www.hostinger.com/de?REFERRALCODE=KPQ4INFOETIT>.

1. Choose plan and operating system.
2. Add an SSH key during setup (better than a root password).
3. Note the server's IP address and username.

### Log in via SSH

```bash
ssh <user>@<vps-ip>   # e.g. ssh root@203.0.113.10; confirm the fingerprint with yes the first time
```

On Windows this works in PowerShell or in MobaXterm (left "Sessions" → SSH). This session later runs every command on the VPS; the tunnel runs in a second window.

### Install git and Node 22

```bash
sudo apt update && sudo apt install -y git curl                     # Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -   # package source for Node 22 LTS
sudo apt install -y nodejs
node -v                                                             # must show v22 or higher
```

> **Note:** Tests and build run from Node 20; `tools/console.js` and `tools/hwtest.js` need the built-in `fetch` and `WebSocket` of Node 22 or newer. There are no other dependencies – no package needs to be installed.

### Fetch the project and test

```bash
git clone https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50.git
cd Plant-watering-Shelly-SMT50
npm test          # all tests against the mock, no device needed – count below
npm run check     # node --check of the six scripts
npm run build     # dist/: compact output for the upload (checked in, the build keeps it current)
```

If `npm test` ends with `# pass <!-- fact:tests -->146<!-- /fact -->`, the server is ready. If you want to push your own changes back, you need a fork – see below.

## Set up the tunnel

### With ssh (macOS, Linux, Windows terminal)

On your PC on the home network, not on the VPS:

```bash
ssh -N -R 8010:192.168.88.10:80 <user>@<vps-ip>   # -N: no shell, tunnel only – keep the window open
```

| Part | Meaning |
| --- | --- |
| `-N` | open no shell, only forward |
| `-R 8010:…` | port 8010 on the VPS points back into the home network through this connection |
| `192.168.88.10:80` | LAN IP and HTTP port of the Shelly – insert your IP |
| `<user>@<vps-ip>` | the same login as for `ssh` |

If port 8010 on the VPS is taken, pick another one (e.g. 8011) – then write `127.0.0.1:8011` everywhere. If the connection drops when idle, the SSH option `-o ServerAliveInterval=30` helps.

### With MobaXterm (Windows)

MobaXterm is a free SSH client with a graphical tunnel manager: <https://mobaxterm.mobatek.net/download.html> (Home Edition; the "Portable edition" runs without installation).

1. Open the menu **Tools → MobaSSHTunnel** → **New SSH tunnel**.
2. Choose **Remote port forwarding**.
3. **Forwarded port** (SSH server side): `8010`.
4. **SSH server / SSH login / SSH port:** VPS IP, your user, port `22`.
5. **Forward to** (target on the LAN): `192.168.88.10`, port `80`.
6. Save the tunnel and start it with the **play button**; the first time it asks for the password or uses the SSH key.

As long as the tunnel window runs, the Shelly is reachable on the VPS. You can use the same connection in parallel as a normal SSH session (left "Sessions" → SSH to the VPS) and work in it.

### Test the connection

On the VPS:

```bash
curl -s http://127.0.0.1:8010/rpc/Shelly.GetDeviceInfo   # one JSON line with id, model, ver (firmware) and app
node tools/hwtest.js 127.0.0.1:8010 status               # one-liner: running scripts, sensors, switch
```

If the JSON line arrives, the tunnel is up. `hwtest.js` tries each RPC three times (timeout 10 s, 1 s pause) and then reports `fetch failed – Tunnel 127.0.0.1:8010 offen?` (tunnel open?); `curl` reports `Failed to connect` immediately (see example output).

## Installation through the tunnel

The order is the same as in [06 · Start guide](06-startanleitung.md) and [08 · Installation with a local server](08-installation-lokaler-server.md); the only difference is the address `127.0.0.1:8010`.

1. Pre-check: `node tools/hwtest.js 127.0.0.1:8010 preflight` – clock (NTP), seconds to the next cycle, scripts with IDs, input 1, output, sensors, KVS, debug websocket. Creates `bw_zeitraffer` if missing (with `preflight hw` also the hardware test scripts) and prints the upload commands.
2. Create the operating scripts, names exactly `bw_install`, `bw_main`, `bw_pump`: in the web UI at home or from the VPS via RPC: `curl -s -X POST http://127.0.0.1:8010/rpc/Script.Create -d '{"name":"bw_main"}'` – the reply contains the ID. The device assigns IDs; `node tools/hwtest.js 127.0.0.1:8010 scripts` lists them with size and `fs_free`.
3. Upload per script: `node tools/put-script.js 127.0.0.1:8010 <id> dist/bw_main.js` (likewise `bw_install`, `bw_pump`, `bw_zeitraffer`). The tool checks the flash (reserve 4 096 B), stops the script, sends in 1 024-character chunks, reads the code back and compares byte for byte.
4. Check 2: `node tools/verify-scripts.js 127.0.0.1:8010` – all scripts against `dist/`, doc lines, same version of `bw_main` and `bw_pump`. Expected: „alle byteidentisch" (all byte-identical).
5. Enter the target band `cfg2` (values and derivation in [12 · First commissioning](12-erstinbetriebnahme.md)) – via the web UI at home or through the tunnel: `curl -s -X POST http://127.0.0.1:8010/rpc/KVS.Set -d '{"key":"cfg2","value":"{\"pctSoll\":55,\"pctLo\":40,\"pctOk\":50,\"pctHi\":60,\"pctDry\":28,\"dropSlow\":4}"}'`. Before the installer this partial object is enough; it adds the remaining fields (`hyst`, `effMin` …) with their defaults.
6. Installer: `node tools/hwtest.js 127.0.0.1:8010 normal 60` – waits for the safe moment (second 8–30, not within 9 minutes after `winA`/`winB`, no operating script running; at most 4 minutes), starts `bw_install`, follows the console and then checks schedule, `cfg3`, `cfg4` and `auto_off`.
7. Follow the first window: connect `node tools/console.js 127.0.0.1:8010 900` from 07:59 or 19:59. `hwtest.js watch` ends after a few seconds in normal operation – it is meant for test scripts and the fast-forward test.

> **Note:** `KVS.Set` replaces the whole entry. After the installer, write only the complete object (web UI → Key-Value Storage → "Format as JSON") or run `normal 60` again after a partial write – if a required field such as `cfg2.hyst` is missing, `bw_main` aborts every cycle with `err=cfg` (console `Störung cfg: cfg2.hyst fehlt`, fault: cfg2.hyst missing) until the installer restores it.

| Tool | Task | Example through the tunnel |
| --- | --- | --- |
| `tools/put-script.js <ip> <id> <file>` | upload a script in chunks and verify byte for byte | `node tools/put-script.js 127.0.0.1:8010 <id> dist/bw_main.js` |
| `tools/verify-scripts.js <ip>` | compare all scripts on the device with `dist/` | `node tools/verify-scripts.js 127.0.0.1:8010` |
| `tools/console.js <ip> [sec] [id]` | follow the console over the debug websocket (default 10 s), optionally start a script | `node tools/console.js 127.0.0.1:8010 900` |
| `tools/hwtest.js <ip> <command>` | pre-check, installer (`normal`), fast-forward, hardware test, measurement runs | `node tools/hwtest.js 127.0.0.1:8010 preflight` |
| `tools/kvs_dump.sh <ip>` | print all KVS entries page by page | `tools/kvs_dump.sh 127.0.0.1:8010` |
| `curl` | any RPC directly, e.g. read the KVS | `curl -s "http://127.0.0.1:8010/rpc/KVS.GetMany?match=*"` |

The complete tool reference with all subcommands is in [14 · Debugging and testing](14-debuggen-und-testen.md).

> **Measured on the device (13 Sep 2026):** upload and check through the tunnel: `bw_pump` <!-- fact:dist.bw_pump -->17475<!-- /fact --> B, `bw_main` <!-- fact:dist.bw_main -->15791<!-- /fact --> B, `bw_install` <!-- fact:dist.bw_install -->15978<!-- /fact --> B, `bw_zeitraffer` 7 453 B (today <!-- fact:dist.bw_zeitraffer -->7459<!-- /fact --> B) – all byte-identical, versions `bw_main` = `bw_pump`. Flash: 12 288 B free with seven scripts, 49 152 B after deleting `engine_probe`, `bw_hwtest` and `bw_hwpump`, 40 960 B after the upload.

## Claude Code on the VPS: allow 127.0.0.1 in the sandbox

Claude Code runs commands in a sandbox with a network lock. For the AI to use the tunnel port, `127.0.0.1` must be listed in the personal settings file. The file lives in the project folder and is excluded via `.gitignore` – it is never committed.

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": ["127.0.0.1", "localhost"]
    }
  }
}
```

Path: `.claude/settings.local.json`. Easiest: tell Claude Code directly "allow local access to `http://127.0.0.1:8010`" – the `update-config` skill writes it. Then test with `curl http://127.0.0.1:8010/rpc/Shelly.GetDeviceInfo` from the Claude session. How Claude Code is installed and leads the installation as an interview is in [10 · Installation with Claude Code](10-installation-claude-code.md).

## Security

- The tunnel binds to `127.0.0.1` of the VPS (OpenSSH default without `GatewayPorts`): port 8010 is reachable only for processes on the server, not from the internet.
- Anyone with a shell on the VPS reaches your Shelly. Keep the server to yourself, use SSH keys instead of passwords and close the tunnel when you are done (close the window or stop it in MobaXterm).
- The tunnel opens exactly one address, `192.168.88.10:80`; the VPS sees nothing else of the home network.
- Claude Code on the VPS changes device configuration only when asked (e.g. `input-on`) and commits or pushes only with explicit consent – the rule is in [AGENTS.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/AGENTS.md).

## If the tunnel drops

- The operating scripts keep running on the device by schedule: `bw_main` every <!-- def:cfg3.tick -->15<!-- /def --> minutes, `bw_pump` in the windows. The tunnel serves only the tools; nothing on the Shelly depends on the VPS.
- Hardware test: every phase has a timeout (`hwt.tPhase` <!-- hwt:tPhase -->900<!-- /hwt --> s), and so does the whole run (`hwt.tAll` <!-- hwt:tAll -->3600<!-- /hwt --> s); a phase nobody answers ends with code `to` (timeout). The state is in the KVS (`hwr` sensor test, `hwp` pump test) and can be read after reconnecting with `status` or `report`.
- `hwtest.js watch` checks every 5 s whether the websocket is still up, reconnects it after a drop and survives RPC errors (`[status] RPC-Fehler, weiter: …`, RPC error, continuing). A pump test interrupted between pass A and pass B is continued with `start bw_hwpump`: the backup `hwb1`/`hwb2` switches straight to pass B (`bw_pump` must have finished).
- Fast-forward test: the device stays in the profile (cycle <!-- zr:cfg3.tick -->3<!-- /zr --> min, windows every <!-- zr:cfg3.winEvery -->6<!-- /zr --> min), keeps measuring and waters at most `maxDay` <!-- zr:cfg3.maxDay -->4<!-- /zr --> windows per day (`why=limit`, reason: daily limit); back to normal operation only with `node tools/hwtest.js 127.0.0.1:8010 normal 60` (original from `zrb1..5`, the backup keys). The recorder of `kal` appends its file every minute – a drop costs at most one minute.
- If the tunnel drops during an upload, half the code sits on the device: run `put-script.js` again, otherwise `verify-scripts.js` shows „WEICHT AB ab Zeichen …" (differs from character …).

## Your own fork: deploy key or token

`git clone` of the project is enough for installing. If you want to keep or share your own changes, work in a fork and push back via SSH – HTTPS has no credentials on a fresh VPS.

1. Create a fork on GitHub; on the VPS clone the fork or switch the remote: `git remote set-url origin git@github.com:<github-user>/Plant-watering-Shelly-SMT50.git`.
2. Generate a key on the VPS: `ssh-keygen -t ed25519 -C "vps"`; `cat ~/.ssh/id_ed25519.pub` shows the public part.
3. Register the public key: in the fork under **Settings → Deploy keys** with "Allow write access" (valid for this repository only) or in your account under **Settings → SSH and GPG keys**.
4. Check: `ssh -T git@github.com` greets you with your username; then `git push`.

Alternative without SSH: enter a personal access token (fine-grained, permission "Contents: Read and write" for the fork) as the password on `git push` over HTTPS. Commit and push happen only with the human's explicit consent – Claude Code asks first ([AGENTS.md](https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50/blob/main/AGENTS.md)).

## Example output

Tunnel closed (VPS, 15 Sep 2026) – this is what the most common error looks like:

```text
$ curl -s -m 5 http://127.0.0.1:8010/rpc/Shelly.GetDeviceInfo
curl: (7) Failed to connect to 127.0.0.1 port 8010 after 0 ms: Couldn't connect to server
$ node tools/hwtest.js 127.0.0.1:8010 status
Fehler: KVS.Get: fetch failed – Tunnel 127.0.0.1:8010 offen? (Handbuch 6)
```

`Fehler` means error, „Tunnel … offen?" asks whether the tunnel is open; the tool's hint „Handbuch 6" refers to this chapter. Tunnel open (VPS, 13 Sep 2026): pre-check, safe moment and script start by `hwtest.js` plus the device's first console lines, all through the tunnel, from `docs/kal/2026-09-13-13-50-kal-log.txt`:

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

Line by line: `Uhrzeit … lokal` local time, `Zielband` target band, `Wasserstand VOLL` water level FULL, `Ausgang aus` output off, `warte – Sekunde 52, warte auf 8–30` waiting for second 8–30, `sicherer Moment` safe moment, `Zeitplan: 3 Einträge, davon eigene: 3` schedule: 3 entries, 3 of them ours. The reference device's reply to `Shelly.GetDeviceInfo` is not recorded yet `[TODO am Gerät]` (to do on the device); it contains `id` (`shellyplusuni-…`), `model`, `gen`, `ver` (firmware, 2.0.0 on the reference device) and `app`.

## Typical problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `curl: (7) Failed to connect to 127.0.0.1 port 8010` or `fetch failed – Tunnel 127.0.0.1:8010 offen?` | tunnel not running: window closed, PC in standby, SSH connection dropped | restart the tunnel (play in MobaXterm or `ssh -N -R …`); run the tool again |
| tunnel up, but `curl` reports `(52) Empty reply from server` or the tools hang 10 s per attempt (`hwtest.js` three times, `put-script.js` once; `verify-scripts.js` 15 s), `curl` without `-m` indefinitely | the PC does not reach the Shelly: wrong LAN IP, device unpowered, other Wi-Fi | `ping 192.168.88.10` from the PC; check the IP in the router or the Shelly app; tunnel command with the right IP |
| `Warning: remote port forwarding failed for listen port 8010` | port 8010 on the VPS taken, usually a stale old tunnel | end the old `ssh` session on the VPS or use port 8011 – then `127.0.0.1:8011` everywhere |
| commands against `127.0.0.1:8010` fail only inside Claude Code | network lock of the sandbox | allow `127.0.0.1` and `localhost` in `.claude/settings.local.json` (see above) |
| `ReferenceError: WebSocket is not defined` in `console.js` or `hwtest.js` | Node older than 22 | install Node 22, check `node -v` |
| console stays empty although the tunnel is up | debug websocket on the Shelly off | web UI → Scripts → open the console; `preflight` reports „Debug-Websocket aus" (off) |
| `Flash zu voll: fs_free …` (flash too full) on upload | not enough flash for script plus reserve 4 096 B | delete test scripts: `hwtest.js … scripts`, then `delete <id>` (13 Sep 2026: 12 288 → 49 152 B) |
| upload „FEHLER, Code weicht ab (… Byte Differenz)" (error, code differs) | connection disturbed during the upload | `put-script.js` again, then `verify-scripts.js` |
| `git push` asks for username and password or is rejected | HTTPS remote without credentials | fork with deploy key (SSH remote) or token, see above |

## Next

- [10 · Installation with Claude Code](10-installation-claude-code.md) – start Claude Code on the VPS and let it lead the installation as an interview.
- [11 · Hardware check](11-hardware-check.md) – check sensors, float switch and pump through the tunnel while the human acts at the rig.
- [12 · First commissioning](12-erstinbetriebnahme.md) – calibration, target band and fast-forward test, all via `127.0.0.1:8010`.
- [14 · Debugging and testing](14-debuggen-und-testen.md) – complete tool reference and console.
