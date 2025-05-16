# Shelly_Plug_Router_Neustart
Grund für dieses Skript: 
Eine für mich schlecht erreichbare Router geht alle 2-3 Wochen auf Störung und ist über das Webinterface nicht mehr zu erreichen. Nach dreimaligen Austausch des Routers ist der Fehler der Selbe. Also gehe ich nun davon aus, dass im Netz (Strom oder Kabel) Störfrequenzen vorhanden sind. Somit soll der Fehler nun automtisch erkannt werden und der Neustart des Routers alleine erfolgen.



# Connection Check mit Relay-Offline-Limit für Shelly Pug S G3

Dieses Skript überwacht kontinuierlich die Internet-Konnektivität deines Shelly Pug S G3 und steuert ein Relay bei Ausfällen. Es berücksichtigt:

* Mehrere aufeinanderfolgende Fehlversuche (konfigurierbar) bevor eine Offline-Aktion ausgelöst wird.
* Ein Limit von maximal drei Offline-Zyklen pro Stunde, um Dauer-Schaltungen zu verhindern.
* Eine Boot-Schonzeit direkt nach Skriptstart, in der keine Prüfungen stattfinden (z.B. für das Hochfahren der Fritz!Box).

---

## Features

* **Quick-Check**: Zyklische Prüfung des WLAN-Status und anschließend optionaler Deep-Check.
* **Deep-Check**: HTTP-GET-Requests an definierte Prüfziele (Google DNS und lokale Fritz!Box).
* **Fehlschlag-Zähler**: Löst nach `maxFehlversuche` aufeinanderfolgenden Fehlern die Offline-Aktion aus.
* **Offline-State**: Schaltet das Relay für `offlineDauer` Sekunden ab, dann wieder an, gefolgt von einer Pause.
* **Limit 3/h**: Nach drei Offline-Aktionen innerhalb 60 Minuten keine weiteren Schaltungen.
* **Boot-Schonzeit**: Unterdrückt Prüfungen in den ersten `BootSchonzeitSek` Sekunden nach Skriptstart.
* **Logging**: Umfangreiche Konsolenausgaben zu Status, Prüfzyklen, Fehlversuchen und HTTP-Antworten.

---

## Installation

1. Melde dich in der Shelly Web-Oberfläche an.
2. Öffne den Skript-Editor und erstelle ein neues JavaScript-Skript.
3. Kopiere den vollständigen Code (siehe unten) in den Editor.
4. Speichere und aktiviere das Skript.

---

## Konfiguration

Im oberen Teil des Skripts kannst du folgende Parameter anpassen:

| Parameter           | Beschreibung                                                                            | Einheit  | Standard  |
| ------------------- | --------------------------------------------------------------------------------------- | -------- | --------- |
| `pruefIntervall`    | Intervall für `Quick_Check()`                                                           | Sekunden | `60`      |
| `offlineDauer`      | Dauer, wie lange das Relay bei Offline ausgeschaltet bleibt                             | Sekunden | `20`      |
| `pruefPauseMinuten` | Ruhezeit nach einem Offline-Zyklus, bevor erneut geprüft wird                           | Minuten  | `4`       |
| `anfrageTimeoutSek` | Timeout für jede HTTP-GET-Anfrage                                                       | Sekunden | `15`      |
| `maxFehlversuche`   | Anzahl aufeinanderfolgender Fehlzyklen bis zur Auslösung der Offline-Aktion             | Zyklen   | `3`       |
| `debugAktiv`        | Schaltet erweiterte Status- und Fehlermeldungen ein                                     | Boolean  | `true`    |
| `zeigeAntworten`    | Gibt die vollständigen HTTP-Antworten im Log aus                                        | Boolean  | `true`    |
| `pruefZiele`        | Objekt mit Prüf-Endpunkten (`Schlüssel`: Name, `Wert`: URL)                             | —        | DNS+Fritz |
| `BootSchonzeitSek`  | Dauer ab Skriptstart, in der **keine** Prüfungen stattfinden (Boot-Phase der Fritz!Box) | Sekunden | `240`     |

### Beispiel Prüfziele

```js
var pruefZiele = {
  "dns1":     "https://8.8.8.8",      // Google Public DNS
  "fritzbox": "http://192.168.178.1" // Lokale Fritz!Box
};
```

---

## Ablauf

1. **Skriptstart**: Speichert `scriptStartZeit`.
2. **Main-Loop**: Ruft alle `pruefIntervall` Sekunden `Quick_Check()` auf.
3. **Quick\_Check**:

   * Prüft WLAN-Status; bei fehlender IP sofort `State_Offline()`.
   * Innerhalb der Boot-Schonzeit (`BootSchonzeitSek`) wird die Runde übersprungen.
   * Ansonsten Reset der Zähler und Aufruf von `Deep_Check()`.
4. **Deep\_Check**: Sendet parallele HTTP-GET-Requests an alle Einträge in `pruefZiele`.
5. **Callback**:

   * Zählt erfolgreiche und fehlgeschlagene Requests.
   * Bei `zaehlerFehlgeschlagen > 0`: erhöht `aufeinanderFehlgeschlagen`.

     * Ab `maxFehlversuche` aufeinanderfolgenden Fehlern → `State_Offline()`.
     * Sonst: Neustart Main-Loop.
   * Bei allen erfolgreichen Requests: setzt `aufeinanderFehlgeschlagen = 0` und Neustart.
6. **State\_Offline**:

   * Protokolliert Offline-Ereignis (nur letzte 60 Minuten).
   * Nach drei Aktionen binnen 60 Minuten deaktiviert weiteres Schalten.
   * Schaltet Relay für `offlineDauer` Sekunden aus, dann wieder an.
   * Wartet `pruefPauseMinuten` Minuten und startet Main-Loop neu.

