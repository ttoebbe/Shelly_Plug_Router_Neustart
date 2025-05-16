# Shelly_Plug_Router_Neustart
Router Neustart wenn Offline oder Router nicht erreichbar mit Shelly 


# Connection Check mit Relay‑Offline‑Limit für Shelly Pug S G3

Dieses Skript überwacht kontinuierlich die Internet-Konnektivität deines Shelly Pug S G3 und steuert ein Relay entsprechend, wenn ein Offline-Zustand erkannt wird. Es verhindert darüber hinaus zu häufiges Schalten (Limit: maximal 3 Offline‑Zyklen pro Stunde) und berücksichtigt die Bootzeit der lokalen Fritz!Box.

## Features

* **Quick-Check**: Intervallgesteuerte Überprüfung des WLAN‑Status und optionaler Internet‑Tests.
* **Deep-Check**: HTTP-GET-Requests an definierte Prüfziele (z. B. Google DNS, lokale Fritz!Box).
* **Offline‑State**: Relay schaltet bei Ausfall für eine konfigurierbare Dauer ab und danach wieder an.
* **Limit**: Maximal 3 Offline‑Zyklen pro Stunde, um Dauer-Schaltvorgänge zu vermeiden.
* **Boot‑Schonzeit**: Nach Skriptstart werden Prüfungen für eine definierte Zeit ausgesetzt (z. B. für Fritz!Box-Boot).
* **Logging**: Umfangreiche Status‑ und Antwortmeldungen in der Konsole.

## Installation

1. Öffne die Shelly Scripte-Verwaltung via Web UI.
2. Lege ein neues JavaScript‑Skript an.
3. Kopiere den Inhalt aus `connection_check_relay_offline_limit.js` in den Editor.
4. Speichere und aktiviere das Skript.

## Konfiguration

Im oberen Teil des Skripts findest du folgende Parameter:

| Parameter               | Beschreibung                                                                                        | Einheit  | Standard   |
| ----------------------- | --------------------------------------------------------------------------------------------------- | -------- | ---------- |
| `pruefIntervall`        | Abstand zwischen zwei Quick‑Checks                                                                  | Sekunden | 60         |
| `offlineDauer`          | Dauer, in der bei erkannten Offline‑Zuständen das Relay ausgeschaltet bleibt                        | Sekunden | 20         |
| `pruefPauseMinuten`     | Ruhezeit nach einem Offline‑Zyklus, bevor die Prüfungen neu starten                                 | Minuten  | 4          |
| `anfrageTimeoutSek`     | Timeout für jede HTTP‑GET‑Anfrage                                                                   | Sekunden | 15         |
| `debugAktiv`            | Aktiviert erweiterte Debug‑Ausgaben (WLAN‑Status, Connection‑Check‑Ergebnisse)                      | Boolean  | `true`     |
| `zeigeAntworten`        | Gibt die kompletten HTTP‑Antworten im Log aus                                                       | Boolean  | `true`     |
| `pruefZiele`            | Objekt mit den zu prüfenden Endpunkten (`Schlüssel: Name`, `Wert: URL`)                             | —        | DNS1+Fritz |
| `BootSchonzeitSek`      | Schonzeit nach Skriptstart, in der **keine** Prüfungen ausgeführt werden (z. B. Boot der Fritz!Box) | Sekunden | 240        |

### Beispiel Prüfziele

```js
var pruefZiele = {
  "dns1":    "https://8.8.8.8",        // Google Public DNS
  "fritzbox":"http://192.168.178.1"  // Lokale Fritz!Box
};
```

## Ablaufdiagramm

1. **Start**: Speichere `scriptStartZeit`.
2. **Main Loop**: Alle `pruefIntervall` Sekunden `Quick_Check()`.
3. **Quick\_Check**:

   * WLAN‑Status prüfen.
   * Falls keine IP → `State_Offline()`.
   * Falls in `BootSchonzeitSek` nach Start → Prüfung aussetzen.
   * Sonst → `Deep_Check()` aller `pruefZiele`.
4. **Deep\_Check**: HTTP-GET an alle Ziele mit `anfrageTimeoutSek`.
5. **Callback**: Zählt Erfolge/Fehler.

   * Wenn **≥1 Fehler** → `State_Offline()`.
   * Sonst → Neustart Main Loop.
6. **State\_Offline**:

   * Offline‑Ereignis loggen (nur letzte 60 Minuten).
   * Bei ≥3 Ereignissen → Limit aktiv → keine weiteren Aktionen.
   * Relay aus für `offlineDauer` Sekunden → wieder an.
   * Pause `pruefPauseMinuten` Minuten → Main Loop.

## Anpassung und Erweiterung

* **Weitere Prüfziele**: Ergänze im Objekt `pruefZiele` einfach neue Schlüssel/URLs.
* **Limit ändern**: Passe die Grenzen in `State_Offline()` an (aktuell 3 pro Stunde).
* **Logs reduzieren**: Setze `debugAktiv` oder `zeigeAntworten` auf `false`.

