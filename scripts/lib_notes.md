# lib_notes.md – genutzte Shelly-Gen2-Aufrufe (v0.1.0, geprüft 12.09.2026)

Jeder Aufruf wurde gegen die Doku unter https://shelly-api-docs.shelly.cloud/gen2/ geprüft. Basis-URL für Komponenten: `https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/<Komponente>`. Die Spalte „Genutzt von" nennt das Script.

## RPC-Aufrufe (über `Shelly.call`)

| Aufruf | Parameter | Antwort | Genutzt von | Doku |
| --- | --- | --- | --- | --- |
| `KVS.GetMany` | `match` (Standard `*`), `offset` | `items`, `offset`, `total` – **paginiert**, bis `offset + Anzahl ≥ total` weiterlesen. `items` ist am Gerät ein **Array** von `{key, etag, value}` (gemessen 12.09.2026, Probe E); die Doku beschreibt ein Objekt `key → {etag, value}` – die Scripts verarbeiten beide Formen | alle | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Get` | `key` | `etag`, `value` | (Reserve) | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Set` | `key`, `value` – bei uns immer ein **JSON-String** (`JSON.stringify`), optional `etag` | `etag`, `rev` | alle | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `KVS.Delete` | `key` | `rev` | Nutzer (err löschen) | [KVS](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS) |
| `Schedule.Create` | `enable`, `timespec` (5/6/7 Cron-Felder), `calls` | `id`, `rev` | Installer. **Am Gerät scheitert der erste Create je Script-Lauf sporadisch mit „Invalid argument 'timespec': Failed validation!" – Retry nötig** (LEARNING.md) | [Schedule](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule) |
| `Script.PutCode` | `id`, `code` (String), `append` (true = anhängen) | `len` (Gesamtlänge in Byte) | `tools/put-script.js` (Upload in 1024-Zeichen-Stücken, Script muss gestoppt sein) | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
| `Script.GetCode` | `id`, `offset`, `len` | `data`, `left` (Rest in Byte) | Größenkontrolle nach dem Upload: `len=1` → `left + 1` = Dateigröße | [Script](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script) |
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
- **Kein Hoisting heißt konkret:** ein Funktionsname existiert erst, wenn die Ausführung an seiner Deklaration vorbei ist. Modulebene-Code, der einen später deklarierten Namen benutzt (etwa `var steps = [stepRead, …]` oben in der Datei), stirbt am Gerät mit `ReferenceError: "stepRead" is not defined`. Aufrufe *innerhalb* von Funktionen sind unkritisch, weil sie erst zur Laufzeit aufgelöst werden. Deshalb steht `steps[]` in allen Scripts ganz unten, direkt vor `next()`. Der Node-Mock hoistet und merkt davon nichts – `tools/test/syntax.test.js` prüft es statisch (Gerätetest 12.09.2026, siehe `LEARNING.md`).
- **Mehr als 2–3 verschachtelte anonyme Funktionen lassen das Gerät abstürzen.** Alle Callbacks sind deshalb benannte Funktionen auf oberster Ebene; der Ablauf ist eine Schrittkette (`steps[]` + `next()`).
- **Stacktiefe (gemessen 12.09.2026, FW 2.0.0: 12 Ebenen laufen, 14 stürzen ab):** Etwa zehn verschachtelte Aufrufe reichen für `Too much recursion - the stack is about to overflow` (Gerätetest 12.09.2026, `bw_pump`: Callback → next → Schritt → finish → jumpTo → next → Schritt → JSON.stringify). Deshalb ist `next()` eine flache Schleife, Schritte geben `true` zurück statt `next()` zu rufen, und nur Callbacks starten die Kette neu. Der Mock misst die Tiefe an jeder Engine-Grenze (`print`, `Shelly.call`, `Timer.set`, `JSON`) und meldet mehr als 8 Ebenen als Fehler.
- **KVS-Werte als JSON-Strings** (Entscheidung 15): Das Gerät speichert zwar jeden JSON-Wert (Probe A/E: Objekte kommen unverändert zurück), aber die Web-UI (Settings → Key-Value Storage) zeigt Objektwerte nur als `[object Object]` und würde sie beim Speichern durch diesen Text ersetzen. Da `cfg2` von Hand gepflegt wird: schreiben mit `JSON.stringify`, lesen mit `fromKvs()` (JSON.parse, unlesbar → null). Der Mock meldet Nicht-String-Werte als Fehler.
- **Script-Speicher:** seit Firmware 1.0.3 etwa 15.000 Byte je Script (Forum, Limit „wird wieder angehoben“). `bw_main.js` mit Kommentaren liegt darüber; hochgeladen wird die Kompakt-Ausgabe aus `npm run build` (`dist/`), `tools/test/size.test.js` wacht über die Grenze. Kontrolle nach dem Upload: `Script.GetCode?id=<id>&len=1` → `left + 1` = Dateigröße.
- Lang laufende Schleifen blockieren die Firmware. Die Scripts rechnen nur wenige Millisekunden pro Schritt.
- Eine Exception in einem asynchronen Callback beendet das Script. Jeder Schritt läuft in `try/catch`.
- Bewusst nicht genutzt: `Date`, Arrow-Functions, Template-Strings, `const`, Destructuring, `for…of`. Prüfung: `tools/test/syntax.test.js`.
