# lib_notes.md – genutzte Shelly-Gen2-Aufrufe (v0.1.0, geprüft 12.09.2026)

Jeder Aufruf wurde gegen die Doku unter https://shelly-api-docs.shelly.cloud/gen2/ geprüft. Basis-URL für Komponenten: `https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/<Komponente>`. Die Spalte „Genutzt von" nennt das Script.

## RPC-Aufrufe (über `Shelly.call`)

| Aufruf | Parameter | Antwort | Genutzt von | Doku |
| --- | --- | --- | --- | --- |
| `KVS.GetMany` | `match` (Standard `*`), `offset` | `items` (Objekt `key → {etag, value}`), `offset`, `total` – **paginiert**, bis `offset + Anzahl ≥ total` weiterlesen | alle | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Get` | `key` | `etag`, `value` | (Reserve) | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Set` | `key`, `value` (beliebiges JSON), optional `etag` | `etag`, `rev` | alle | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Delete` | `key` | `rev` | Nutzer (err löschen) | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `Schedule.List` | – | `jobs[] {id, enable, timespec, calls[]}`, `rev` | bw_install | [Schedule](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule) |
| `Schedule.Create` | `enable`, `timespec`, `calls[] {method, params}` | `id`, `rev` | bw_install | [Schedule](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule) |
| `Schedule.Delete` | `id` | `rev` | bw_install | [Schedule](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule) |
| `Script.List` | – | `scripts[] {id, name, enable, running}` | bw_install | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.Start` | `id` | `was_running` | Zeitplan | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.Stop` | `id` | `was_running` | alle (auf eigene ID) | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.SetConfig` | `id`, `config {enable}` (`enable` = Autostart beim Boot) | `restart_required` | bw_install | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Switch.Set` | `id`, `on`, optional `toggle_after` (s) | `was_on` | bw_pump, Zeitplan (Sicherheits-Aus) | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |
| `Switch.SetConfig` | `id`, `config {initial_state, auto_off, auto_off_delay}` | `restart_required` | bw_install | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |
| `Sys.GetStatus` | – | `time` (HH:MM lokal, `null` ohne NTP), `unixtime` (UTC, `null` ohne NTP), `ram_free`, `kvs_rev`, `uptime` | alle (synchron über `Shelly.getComponentStatus("sys")`) | [Sys](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Sys) |
| `Voltmeter.GetStatus` | `id` (hier 100) | `voltage` (V, `null` bei Fehler), `errors[]` | bw_main (synchron) | [Voltmeter](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Voltmeter) |
| `Temperature.GetStatus` | `id` (hier 100) | `tC` (`null` bei Fehler), `tF`, `errors[]` | bw_main (synchron) | [Temperature](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Temperature) |
| `Input.GetStatus` | `id` (hier 1) | `state` (bool, Typ `switch`), `errors[]` | bw_main, bw_pump (synchron) | [Input](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Input) |
| `Switch.GetStatus` | `id` | `output`, `timer_started_at`, `timer_duration`, `source` | bw_pump (synchron) | [Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch) |

Limits laut Doku: Zeitplan 20 Einträge, 5 Calls je Eintrag; Timespec 5/6/7 Felder (6 Felder = `Sekunde Minute Stunde Tag Monat Wochentag`); KVS 50 Schlüssel, Schlüssel ≤ 42 Zeichen, Wert ≤ 253 Zeichen; maximal 3 laufende Scripts.

## Script-API (Doku: [Script APIs → Shelly](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Shelly), [Timer](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Timer), [Language Reference](https://shelly-api-docs.shelly.cloud/gen2/Scripts/LanguageReference))

| Funktion | Signatur | Hinweis |
| --- | --- | --- |
| `Shelly.call` | `Shelly.call(method, params, callback, userdata)`; `callback(result, error_code, error_message, userdata)` | asynchron; `error_code` 0 = ok. **Maximal 5 offene Aufrufe je Script** → wir halten immer nur einen offen |
| `Shelly.getComponentStatus` | `Shelly.getComponentStatus(type, id)` → Objekt oder `null` | synchron; von der Doku empfohlen, um Callbacks zu vermeiden. `type` z. B. `"voltmeter"`, `"temperature"`, `"input"`, `"switch"`, `"sys"` (ohne id) |
| `Shelly.getCurrentScriptId` | `→ number` | für `Script.Stop` auf sich selbst |
| `Shelly.getUptimeMs` | `→ number` | Laufzeitmessung |
| `Timer.set` | `Timer.set(period_ms, repeat, callback, userdata)` → handle | maximal 5 Timer je Script; wir nutzen einen |
| `Timer.clear` | `Timer.clear(handle)` | |
| `print` | `print(...)` | Konsole der Web-UI |

## Sprachregeln (aus der Language Reference)

- Unterstützt: `var`, `let`, Funktionen, `String`/`Number`/`Array`/`Math`/`JSON`, `Object.keys`, `try/catch/finally`, `throw`. Nicht unterstützt: Hoisting, ES6-Klassen, Promises/async. Kein `const` in der Liste → wir nutzen nur `var`/`let`.
- **Mehr als 2–3 verschachtelte anonyme Funktionen lassen das Gerät abstürzen.** Alle Callbacks sind deshalb benannte Funktionen auf oberster Ebene; der Ablauf ist eine Schrittkette (`steps[]` + `next()`).
- Lang laufende Schleifen blockieren die Firmware. Die Scripts rechnen nur wenige Millisekunden pro Schritt.
- Eine Exception in einem asynchronen Callback beendet das Script. Jeder Schritt läuft in `try/catch`.
- Bewusst nicht genutzt: `Date`, Arrow-Functions, Template-Strings, `const`, Destructuring, `for…of`. Prüfung: `tools/test/syntax.test.js`.
