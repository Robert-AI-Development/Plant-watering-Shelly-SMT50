# 4 · Auf eigenem VPS mitentwickeln — Develop on your own VPS

**Sprache / Language:** [Deutsch](#deutsch) · [English](#english) — [Handbuch-Index](README.md)

---

## Deutsch

Du kannst dieses Projekt bequem auf einem eigenen kleinen Server (VPS) weiterentwickeln – mit **Claude Code** als
KI-Programmierer. Der Vorteil: der Server läuft rund um die Uhr, du kannst dich von überall verbinden, und die KI
kann sogar deinen **Shelly zuhause live debuggen** (Kapitel 6). Dieses Kapitel führt dich vom leeren Server bis zum
laufenden Claude Code – **Schritt für Schritt für Einsteiger**, mit einem **Schnellstart-Kasten für Profis**.

### Schnellstart (Profis)

```bash
# Auf dem VPS (Ubuntu/Debian), als dein Benutzer:
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -   # Node 20 LTS
sudo apt install -y nodejs
node -v && npm -v                                                   # Node ≥ 20 prüfen

git clone https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50.git
cd Plant-watering-Shelly-SMT50
npm install && npm test                                             # 89 Tests grün?

npm install -g @anthropic-ai/claude-code                            # Claude Code
claude                                                              # startet den KI-Editor, folge dem Login
```

### 1 · Einen VPS mieten (Hostinger)

Ein kleiner VPS (1–2 vCPU, 4 GB RAM) reicht völlig. Wir nutzen **Hostinger**, weil er günstig, schnell
eingerichtet und anfängerfreundlich ist.

> 💡 **Empfehlung (Freunde-werben-Freunde):** Über diesen Link bekommst du einen Rabatt und unterstützt das
> Projekt: **<https://www.hostinger.com/de?REFERRALCODE=KPQ4INFOETIT>**

1. VPS-Tarif wählen (KVM 1 oder 2 genügt), als Betriebssystem **Ubuntu 22.04 LTS** (oder neuer).
2. Beim Einrichten ein sicheres Root-Passwort oder – besser – einen **SSH-Schlüssel** hinterlegen.
3. Nach der Bereitstellung notierst du dir die **IP-Adresse** und den **Benutzernamen** des Servers.

### 2 · Per SSH einloggen

SSH ist die verschlüsselte Fernverbindung zum Server. Unter Windows empfehlen wir **MobaXterm**
(Download und Anleitung in [Kapitel 6](06-shelly-remote-debug.md)); macOS/Linux bringen SSH schon mit.

```bash
ssh <benutzer>@<server-ip>       # z. B. ssh root@203.0.113.10
```

Beim ersten Mal fragt SSH, ob der Server-Fingerabdruck vertrauenswürdig ist – mit `yes` bestätigen.

### 3 · Werkzeuge installieren (git, Node.js)

„git" verwaltet den Code, „Node.js" führt die Tests und Werkzeuge aus. Auf Ubuntu/Debian:

```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v            # muss v20 oder höher zeigen
```

> **Warum Node ≥ 20?** Die Tests und die Geräte-Werkzeuge (`put-script.js`, `console.js`) nutzen das eingebaute
> `fetch`/`WebSocket` neuerer Node-Versionen. Das Projekt hat **keine weiteren Abhängigkeiten**.

### 4 · Projekt holen (git clone)

„Klonen" lädt eine vollständige Kopie des Projekts vom GitHub-Server auf deinen VPS:

```bash
git clone https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50.git
cd Plant-watering-Shelly-SMT50
```

Prüfe, dass alles funktioniert:

```bash
npm install        # richtet die Test-Umgebung ein (keine externen Pakete)
npm test           # sollte "# pass 58" zeigen
npm run check      # Syntaxprüfung der drei Geräte-Scripts
```

> **Später eigenen Fork nutzen:** Wenn du eigene Änderungen dauerhaft speichern und teilen willst, erstelle auf
> GitHub einen **Fork** und klone diesen stattdessen. Zum Zurückschreiben brauchst du einen SSH-Deploy-Key oder
> ein Personal Access Token (siehe [Kapitel 7](07-mitwirken-tests.md)).

### 5 · Claude Code installieren und starten

**Claude Code** ist der KI-Programmierer, mit dem dieses Projekt gebaut wurde. Er liest den Code, schlägt
Änderungen vor, führt Tests aus – und kann (Kapitel 6) direkt mit deinem Shelly reden.

```bash
npm install -g @anthropic-ai/claude-code
cd Plant-watering-Shelly-SMT50
claude               # startet die interaktive Sitzung; beim ersten Mal: Login/Anmeldung folgen
```

Beim ersten Start meldest du dich mit deinem Anthropic-Konto an. Danach kannst du der KI einfach auf Deutsch
sagen, was sie tun soll – z. B. „führe die Tests aus" oder „erkläre mir, wie `bw_main` die Dosis berechnet".

Wie Claude Code und der Code-Index **graft** aufgebaut sind und wie man sie effektiv nutzt, steht im
[nächsten Kapitel](05-claude-code-graft.md).

---

## English

You can comfortably keep developing this project on your own small server (VPS) – with **Claude Code** as the AI
programmer. The benefit: the server runs 24/7, you can connect from anywhere, and the AI can even **live-debug
your Shelly at home** (chapter 6). This chapter takes you from an empty server to a running Claude Code –
**step by step for beginners**, with a **quick-start box for pros**.

### Quick start (pros)

```bash
# On the VPS (Ubuntu/Debian), as your user:
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -   # Node 20 LTS
sudo apt install -y nodejs
node -v && npm -v                                                   # check Node ≥ 20

git clone https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50.git
cd Plant-watering-Shelly-SMT50
npm install && npm test                                             # 89 tests green?

npm install -g @anthropic-ai/claude-code                            # Claude Code
claude                                                              # starts the AI editor, follow the login
```

### 1 · Rent a VPS (Hostinger)

A small VPS (1–2 vCPU, 4 GB RAM) is plenty. We use **Hostinger** because it is cheap, quick to set up and
beginner-friendly.

> 💡 **Recommendation (refer-a-friend):** this link gives you a discount and supports the project:
> **<https://www.hostinger.com/de?REFERRALCODE=KPQ4INFOETIT>**

1. Choose a VPS plan (KVM 1 or 2 is enough), OS **Ubuntu 22.04 LTS** (or newer).
2. During setup, set a strong root password or – better – add an **SSH key**.
3. After provisioning, note the server's **IP address** and **username**.

### 2 · Log in via SSH

SSH is the encrypted remote connection to the server. On Windows we recommend **MobaXterm** (download and guide in
[chapter 6](06-shelly-remote-debug.md)); macOS/Linux already include SSH.

```bash
ssh <user>@<server-ip>       # e.g. ssh root@203.0.113.10
```

The first time, SSH asks whether the server fingerprint is trusted – confirm with `yes`.

### 3 · Install tools (git, Node.js)

"git" manages the code, "Node.js" runs the tests and tools. On Ubuntu/Debian:

```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v            # must show v20 or higher
```

> **Why Node ≥ 20?** The tests and device tools (`put-script.js`, `console.js`) use the built-in `fetch`/`WebSocket`
> of newer Node versions. The project has **no other dependencies**.

### 4 · Get the project (git clone)

"Cloning" downloads a full copy of the project from GitHub to your VPS:

```bash
git clone https://github.com/Robert-AI-Development/Plant-watering-Shelly-SMT50.git
cd Plant-watering-Shelly-SMT50
```

Check that everything works:

```bash
npm install        # sets up the test environment (no external packages)
npm test           # should show "# pass 58"
npm run check      # syntax check of the three device scripts
```

> **Use your own fork later:** if you want to keep and share your own changes, create a **fork** on GitHub and
> clone that instead. To push back you need an SSH deploy key or a personal access token (see
> [chapter 7](07-mitwirken-tests.md)).

### 5 · Install and run Claude Code

**Claude Code** is the AI programmer this project was built with. It reads the code, proposes changes, runs tests –
and can (chapter 6) talk to your Shelly directly.

```bash
npm install -g @anthropic-ai/claude-code
cd Plant-watering-Shelly-SMT50
claude               # starts the interactive session; first time: follow the login
```

On first start, sign in with your Anthropic account. Then just tell the AI in plain language what to do – e.g.
"run the tests" or "explain how `bw_main` computes the dose".

How Claude Code and the code index **graft** are built and how to use them effectively is in the
[next chapter](05-claude-code-graft.md).
