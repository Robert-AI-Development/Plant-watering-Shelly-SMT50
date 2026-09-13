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
| `tools/put-script.js <ip> <id> <datei>` | Script per RPC in Stücken hochladen **und den Code am Gerät byteidentisch prüfen** | `node tools/put-script.js 127.0.0.1:8010 1 dist/bw_install.js` |
| `tools/verify-scripts.js <ip>` | alle Scripts am Gerät gegen `dist/` vergleichen (Prüfung nach jedem Upload; Doku-Zeilen werden mitgezählt) | `node tools/verify-scripts.js 127.0.0.1:8010` |
| `tools/console.js <ip> [sek] [id]` | Geräte-Konsole über den Debug-Websocket mitlesen, optional ein Script starten | `node tools/console.js 127.0.0.1:8010 15 2` |
| `tools/probe/engine_probe.js` | Sondier-Script, um Engine-Eigenheiten am Gerät zu messen | per `put-script.js` hochladen, mit `console.js` beobachten |
| `tools/kvs_dump.sh <ip>` | KVS eines Geräts ausgeben | `tools/kvs_dump.sh 127.0.0.1:8010` |
| `tools/hwtest.js <ip> <kommando>` | Hardware-Test steuern (Node ≥ 22). Unterbefehle: `preflight [hw]` (Uhrzeit, Sekunden bis Takt, Fensterabstand, Scripts, Input 1, Switch 0, KVS, Debug-Websocket prüfen; legt `bw_zeitraffer` an, mit `hw` auch `bw_hwtest`/`bw_hwpump`), `scripts` (Scripts mit Größe, `mem_peak`, `fs_free`), `delete <id\|name>` (Test-Script löschen, nie Betriebs-Scripts), `input-on` (Input 1 als Switch aktivieren), `cfg k=v …` (`hwt`-Felder setzen), `start bw_hwtest\|bw_hwpump [sek]` (Kommandozähler zurücksetzen, Script starten, mitlesen), `watch [sek]` (Konsole gefiltert + Statuszeile alle 5 s, höchstens 300 s, im Zeitraffer 1800 s; endet im Normalbetrieb, sobald kein Test-Script läuft; startet Durchgang B des Pumpentests automatisch; im Zeitraffer zeigt die Statuszeile `st`, `st.n` Portionen, `pctW`, `why`, `err` und den Speicher von `bw_main`/`bw_pump`), `go`/`skip`/`abort` (Kommando an die wartende Phase), `status` (Einzeiler), `report` (`hwr`/`hwp` + `cfg1`), `restore` (Sicherung `hwb1`/`hwb2` zurückschreiben), `cleanup` (`hwc`/`hwb1`/`hwb2` löschen), `stop` (Not-Aus), **`zeitraffer [sek]`** (Praxistest im Zeitraffer, Takt 3 / Fenster 6: Vorprüfung inkl. `pctOk`, sicherer Moment außerhalb der Minuten 0–2 eines 6er-Zyklus, Start von `bw_zeitraffer`, Kontrolle von Zeitplan/cfg3/cfg4/auto_off, Fahrplan), **`normal [sek]`** (zurück zum Normalbetrieb bzw. Installer nach einem Update laufen lassen), **`mess [sek] [n] [beob]`** (Messlauf: `n` Pumpenpulse à `sek` s per `Switch.Set toggle_after`, Sensor alle 2 s per RPC; je Puls `tRise`, Spitze, Ruhewert, Gewinn %/s; Vorschläge für `effMax`/`tPmin`/`tMin`/`tDead`/`tSoak`/`tStab`; Rohdaten `docs/kal/<datum>-mess.json`), **`kal [sek]` / `kal report [datei] [log]` / `kal write [datei] [log]`** (Kalibrierlauf: Zeitraffer mit Rekorder alle 5 s über trocken → mittel feucht → nass, Bericht je Fenster und je Zustand; `write` setzt `lrn.effW`, `cfg4.tDead2`, `cfg3.tDead`, `cfg3.tMin` erst nach `normal`) | `node tools/hwtest.js 127.0.0.1:8010 start bw_hwtest 20` |

**Ausführliches Debuggen:** In jedem Script steht oben `var DEBUG = 0;`. Mit `node tools/build.js --debug` erzeugst
du `dist/`-Dateien mit `DEBUG = 1` – die schreiben dann jeden Schritt, jeden RPC-Aufruf und jeden KVS-Eintrag in die
Konsole, die du mit `console.js` live mitliest. Für den Normalbetrieb wieder `npm run build` (DEBUG=0) hochladen.

### Hardware-Test im Interview

Der Hardware-Test aus [Kapitel 3](03-installation.md#hardware-prüfen-bw_hwtest--bw_hwpump) ist für genau diese
Konstellation gebaut: **Claude fragt über den Tunnel, der Mensch handelt am Aufbau.** `bw_hwtest` läuft am Gerät
durch die Phasen t1/t2 (Fühler ≤ 20 °C / ≥ 30 °C), m1/m2 (SMT50 trocken in Luft / im Wasserglas) und l1/l2
(Schwimmer LEER / VOLL). Vor jeder wartenden Phase nennt Claude die Anweisung („Fühler-Hülse ins Eiswasser",
„SMT50 abwischen, trocken in Luft halten", „Schwimmer auf LEER halten" …), du führst sie aus und meldest dich, dann
geht das Kommando `go` ans Gerät. Die Live-Zeilen (eine je 5 s) und die Statuszeile von `hwtest.js watch` zeigen,
ob der Messwert schon stabil ist; m2 läuft ohne `go` durch, sobald der Wert im Wasser stabil ist.

- **Kommandokanal `hwc`:** `go`, `skip` und `abort` schreibt `hwtest.js` als Zähler in den KVS-Schlüssel `hwc`
  (`{n, cmd}`). Das Script pollt ihn alle `nCmd` Ticks per `KVS.Get` und verarbeitet nur ein `n`, das größer ist
  als das zuletzt gesehene; ein `go` in einer Phase, die nicht wartet, wird gemeldet und verworfen. `skip`
  überspringt die Phase (Code `sk`), `abort` beendet den Lauf (Code `ab`).
- **Pumpentest in zwei Durchgängen** (der Script-Heap des Geräts ist mit ~25 KB zu klein für zwei große Scripts
  nebeneinander): `start bw_hwpump` → **Durchgang A:** nach `go` prüft das Script die Zeitwache (nur in der Lücke
  zum 15-min-Takt von `bw_main`, nicht ±25 min um 08:00/20:00/00:00) und die Vorbedingungen (`bw_pump` vorhanden,
  Ausgang aus, Wasserstand stabil und nicht LEER, keine Störung `noeff`), sichert `st`/`day` nach `hwb1` und
  `job`/`err`/`lrn` nach `hwb2`, schreibt einen Testauftrag (`why:"hwtest"`, Dauer `hwt.pumpSec`, `pct:null` → Einzelportion ohne Messung) und startet
  `bw_pump` – dann beendet es sich, damit `bw_pump` allein pumpt. `watch` wartet auf das Ende von `bw_pump` und
  startet **Durchgang B** automatisch: Ergebnis vergleichen (p1 Gabe eingetragen, p2 Ausgang aus, p3 `st`/`job`
  passen), Ausgang notfalls aus, Rückbau aus `hwb1`/`hwb2`, Sicherung löschen, Bericht. Das Test-Script schaltet
  die Pumpe **nie selbst ein**; kein Testauftrag überlebt den Rückbau.
- **Not-Aus:** `hwtest.js <ip> stop` stoppt `bw_hwtest`, `bw_hwpump` und `bw_pump` und schaltet den Ausgang aus.
  Liegt danach noch eine Sicherung `hwb1`/`hwb2` vor, stellt `restore` den alten Zustand wieder her (nur, wenn
  `bw_hwpump` nicht läuft); erst danach `cleanup`.
- **Tunnelabriss:** Reißt die SSH-Verbindung ab, läuft das Script am Gerät **autonom weiter**: jede Phase hat einen
  Timeout (`hwt.tPhase`, 900 s), der ganze Lauf ebenfalls (`hwt.tAll`, 3600 s); eine Phase, auf die niemand mehr
  antwortet, endet mit Code `to`. Der Stand steht jederzeit im KVS – `hwr` für den Sensortest, `hwp` für den
  Pumpentest – und ist nach dem Wiederverbinden mit `hwtest.js <ip> status` oder `report` lesbar; `watch`
  verbindet sich mit dem Websocket automatisch neu. Ein zwischen Durchgang A und B unterbrochener Pumpentest wird
  mit einem erneuten `start bw_hwpump` fortgesetzt: Die vorhandene Sicherung `hwb1`/`hwb2` schaltet direkt auf
  Durchgang B (`bw_pump` muss beendet sein).

### Quick-Notes & Fehlersuche

- **„connection refused" / Timeout auf `127.0.0.1:8010`** → Tunnel läuft nicht. MobaXterm-Tunnel starten bzw.
  `ssh -N -R …` erneut aufbauen. Dein PC muss den Shelly im LAN erreichen (`ping 192.168.88.10`).
- **Sandbox blockt den Zugriff** → `127.0.0.1` in `.claude/settings.local.json` (siehe oben) freigeben.
- **Upload „FEHLER, N Byte fehlen"** → `put-script.js` hat den Größenabgleich nicht bestanden; einfach erneut
  hochladen. Der Web-Editor verliert beim Einfügen manchmal Text – deshalb per RPC hochladen.
- **`Script.PutCode` scheitert** → Script muss gestoppt sein; `put-script.js` stoppt es vorher automatisch. Meldet es zu
  wenig `fs_free` (Flash), erst `engine_probe`, `bw_hwtest`, `bw_hwpump` per `Script.Delete` löschen (~30 KB frei).
- **Port 8010 belegt** → im Tunnel und in den Befehlen einen anderen Port nehmen (z. B. 8011).
- **Debug-Websocket voller Firmware-Zeilen** (`shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`, `y_notifications.cpp`,
  `shelly_debug.cpp`, `shelly_script.cpp`) → das ist Rauschen der Firmware, kein Script-Output. `hwtest.js watch`
  filtert es weg; `console.js` zeigt es roh.
- **`out_of_memory` in `Script.GetStatus` → `errors`** → Der Script-Heap ist nur ~25 KB groß und wird von **allen**
  Scripts geteilt. Steht das dort, hielt ein zweites großes Script gleichzeitig zu viel Speicher (z. B. ein
  wartendes Test-Script neben `bw_main` oder `bw_pump`). `Script.GetStatus` liefert dazu `mem_used`, `mem_peak`,
  `mem_free`; der Eintrag in `errors` bleibt bis zum nächsten Lauf des Scripts stehen. Deshalb pumpt im Pumpentest
  `bw_pump` allein, Langläufer geben ihre KVS-Objekte in Wartephasen frei, und `bw_pump` hält im Fenster die Frist bis
  zum nächsten `bw_main`-Takt ein (`mem_peak` von `bw_pump` in der `watch`-Statuszeile beobachten).
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
| `tools/put-script.js <ip> <id> <file>` | upload a script via RPC in chunks **and verify the code on the device byte for byte** | `node tools/put-script.js 127.0.0.1:8010 1 dist/bw_install.js` |
| `tools/verify-scripts.js <ip>` | compare all scripts on the device with `dist/` (check after every upload; doc lines are counted) | `node tools/verify-scripts.js 127.0.0.1:8010` |
| `tools/console.js <ip> [sec] [id]` | watch the device console over the debug websocket, optionally start a script | `node tools/console.js 127.0.0.1:8010 15 2` |
| `tools/probe/engine_probe.js` | probe script to measure engine quirks on the device | upload via `put-script.js`, watch with `console.js` |
| `tools/kvs_dump.sh <ip>` | dump a device's KVS | `tools/kvs_dump.sh 127.0.0.1:8010` |
| `tools/hwtest.js <ip> <command>` | drive the hardware test (Node ≥ 22). Subcommands: `preflight [hw]` (check clock, seconds to the next cycle, window distance, scripts, input 1, switch 0, KVS, debug websocket; creates `bw_zeitraffer`, with `hw` also `bw_hwtest`/`bw_hwpump`), `scripts` (scripts with size, `mem_peak`, `fs_free`), `delete <id\|name>` (delete a test script, never the production scripts), `input-on` (enable input 1 as switch), `cfg k=v …` (set `hwt` fields), `start bw_hwtest\|bw_hwpump [sec]` (reset command counter, start script, watch), `watch [sec]` (filtered console + status line every 5 s, at most 300 s, 1800 s in fast-forward; in normal operation it ends as soon as no test script is running; starts pass B of the pump test automatically; in fast-forward the status line shows `st`, `st.n` portions, `pctW`, `why`, `err` and the memory of `bw_main`/`bw_pump`), `go`/`skip`/`abort` (command to the waiting phase), `status` (one-liner), `report` (`hwr`/`hwp` + `cfg1`), `restore` (write back backup `hwb1`/`hwb2`), `cleanup` (delete `hwc`/`hwb1`/`hwb2`), `stop` (emergency stop), **`zeitraffer [sec]`** (fast-forward practice test, cycle 3 / windows every 6 min: pre-check incl. `pctOk`, safe moment outside minutes 0–2 of each 6-minute cycle, start `bw_zeitraffer`, verify schedule/cfg3/cfg4/auto_off, print the schedule of steps), **`normal [sec]`** (back to normal operation, or run the installer after an update), **`mess [sec] [n] [obs]`** (measurement run: `n` pump pulses of `sec` s via `Switch.Set toggle_after`, sensor every 2 s via RPC; per pulse `tRise`, peak, settled value, gain %/s; suggestions for `effMax`/`tPmin`/`tMin`/`tDead`/`tSoak`/`tStab`; raw data `docs/kal/<date>-mess.json`), **`kal [sec]` / `kal report [file] [log]` / `kal write [file] [log]`** (calibration run: fast-forward with a recorder every 5 s through dry → medium-moist → wet, report per window and per state; `write` sets `lrn.effW`, `cfg4.tDead2`, `cfg3.tDead`, `cfg3.tMin` only after `normal`) | `node tools/hwtest.js 127.0.0.1:8010 start bw_hwtest 20` |

**Verbose debugging:** every script starts with `var DEBUG = 0;`. `node tools/build.js --debug` produces `dist/`
files with `DEBUG = 1` – they log every step, every RPC call and every KVS entry to the console you watch with
`console.js`. For normal operation upload `npm run build` (DEBUG=0) again.

### Hardware test as an interview

The hardware test from [chapter 3](03-installation.md#check-the-hardware-bw_hwtest--bw_hwpump) is built for exactly
this setup: **Claude asks through the tunnel, the human acts at the rig.** `bw_hwtest` runs on the device through
the phases t1/t2 (probe ≤ 20 °C / ≥ 30 °C), m1/m2 (SMT50 dry in air / in a glass of water) and l1/l2 (float
EMPTY / FULL). Before each waiting phase Claude gives the instruction ("probe sleeve into ice water", "wipe the
SMT50, hold it dry in air", "hold the float at EMPTY" …), you carry it out and report back, then the command `go`
goes to the device. The live lines (one every 5 s) and the status line of `hwtest.js watch` show whether the
reading is stable yet; m2 completes without `go` as soon as the value in water is stable.

- **Command channel `hwc`:** `hwtest.js` writes `go`, `skip` and `abort` as a counter into the KVS key `hwc`
  (`{n, cmd}`). The script polls it every `nCmd` ticks via `KVS.Get` and only processes an `n` greater than the last
  one seen; a `go` in a phase that is not waiting is reported and discarded. `skip` skips the phase (code `sk`),
  `abort` ends the run (code `ab`).
- **Pump test in two passes** (the device's script heap of ~25 KB is too small for two large scripts side by side):
  `start bw_hwpump` → **pass A:** after `go` the script checks the time guard (only in the gap of `bw_main`'s
  15-minute cycle, not ±25 min around 08:00/20:00/00:00) and the preconditions (`bw_pump` present, output off,
  water level stable and not EMPTY, no `noeff` fault), backs up `st`/`day` to `hwb1` and `job`/`err`/`lrn` to
  `hwb2`, writes a test job (`why:"hwtest"`, duration `hwt.pumpSec`, `pct:null` → single portion without measuring) and starts `bw_pump` – then it exits so that
  `bw_pump` pumps alone. `watch` waits for `bw_pump` to finish and starts **pass B** automatically: compare the
  result (p1 dose recorded, p2 output off, p3 `st`/`job` match), switch the output off if necessary, restore from
  `hwb1`/`hwb2`, delete the backup, report. The test script **never switches the pump on itself**; no test job
  survives the restore.
- **Emergency stop:** `hwtest.js <ip> stop` stops `bw_hwtest`, `bw_hwpump` and `bw_pump` and switches the output
  off. If a backup `hwb1`/`hwb2` is still present afterwards, `restore` puts the old state back (only while
  `bw_hwpump` is not running); only then `cleanup`.
- **Tunnel drop:** if the SSH connection breaks, the script on the device **keeps running autonomously**: every
  phase has a timeout (`hwt.tPhase`, 900 s), and so does the whole run (`hwt.tAll`, 3600 s); a phase nobody answers
  ends with code `to`. The state is always in the KVS – `hwr` for the sensor test, `hwp` for the pump test – and can
  be read after reconnecting with `hwtest.js <ip> status` or `report`; `watch` reconnects to the websocket by
  itself. A pump test interrupted between pass A and pass B is continued with another `start bw_hwpump`: the
  existing backup `hwb1`/`hwb2` switches straight to pass B (`bw_pump` must have finished).

### Quick notes & troubleshooting

- **"connection refused" / timeout on `127.0.0.1:8010`** → the tunnel is not running. Start the MobaXterm tunnel or
  re-establish `ssh -N -R …`. Your PC must reach the Shelly on the LAN (`ping 192.168.88.10`).
- **Sandbox blocks access** → allow `127.0.0.1` in `.claude/settings.local.json` (see above).
- **Upload "FEHLER, N Byte fehlen"** → `put-script.js` failed the size check; just upload again. The web editor
  sometimes loses text on paste – hence uploading via RPC.
- **`Script.PutCode` fails** → the script must be stopped; `put-script.js` stops it first automatically. If it reports
  too little `fs_free` (flash), delete `engine_probe`, `bw_hwtest`, `bw_hwpump` via `Script.Delete` first (~30 KB freed).
- **Port 8010 in use** → use a different port in the tunnel and commands (e.g. 8011).
- **Debug websocket full of firmware lines** (`shos_rpc_inst.c`, `shelly_ejs_rpc.cpp`, `y_notifications.cpp`,
  `shelly_debug.cpp`, `shelly_script.cpp`) → that is firmware noise, not script output. `hwtest.js watch` filters
  it out; `console.js` shows it raw.
- **`out_of_memory` in `Script.GetStatus` → `errors`** → the script heap is only ~25 KB and is shared by **all**
  scripts. If it shows up, a second large script held too much memory at the same time (e.g. a waiting test script
  next to `bw_main` or `bw_pump`). `Script.GetStatus` also returns `mem_used`, `mem_peak`, `mem_free`; the entry in
  `errors` stays until the script's next run. That is why `bw_pump` pumps alone in the pump test, long runners
  release their KVS objects during waiting phases, and `bw_pump` keeps the deadline before the next `bw_main` cycle
  inside the window (watch `mem_peak` of `bw_pump` in the `watch` status line).
- **Security:** the tunnel binds to the VPS's `127.0.0.1` – reachable only locally on the VPS, not publicly. Use an
  SSH key instead of a password and close the tunnel when done.

Background on all on-device quirks found (hoisting, stack depth, KVS strings, schedule retry):
[`../../LEARNING.md`](../../LEARNING.md).
