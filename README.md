Achtung, nocht nicht lauffähig!!!!!

# Shelly_Plug_Router_Neustart
Grund für dieses Skript: 
Eine für mich schlecht erreichbare Router geht alle 2-3 Wochen auf Störung und ist über das Webinterface nicht mehr zu erreichen. Nach dreimaligen Austausch des Routers ist der Fehler der Selbe. Also gehe ich nun davon aus, dass im Netz (Strom oder Kabel) Störfrequenzen vorhanden sind. Somit soll der Fehler nun automtisch erkannt werden und der Neustart des Routers alleine erfolgen.


# Shelly Plug Router Neustart – Automatisches Überwachungs- und Neustartskript

Dieses Skript überwacht mit einem Shelly(z. B. 2PM oder Plug S (Achtung, Plug noch ungetestet, da ich nur den Gen3 dahabe und der noch einen BUG in der Firmware hat)) die Erreichbarkeit deiner Fritzbox und einer externen Internetadresse. Bei wiederholtem Ausfall wird der angeschlossene Router automatisch für eine definierte Zeit vom Strom getrennt (Neustart). Das Skript ist für die Shelly Script Engine geschrieben.

## Funktionsweise

- **Regelmäßige Überprüfung:**  
  Alle 60 Sekunden (einstellbar) wird geprüft, ob die Fritzbox (`192.168.110.1`) und eine externe HTTP-Seite (`neverssl.com`) erreichbar sind.
- **Fehlerversuche zählen:**  
  Sind beide Ziele 3× hintereinander nicht erreichbar, wird der Ausgang (Relay) für 20 Sekunden ausgeschaltet.
- **Limitierung:**  
  Maximal 3 Neustarts pro Stunde, um unnötige Neustarts zu vermeiden.
- **Pause nach Neustart:**  
  Nach jedem Neustart pausiert die Überwachung für 3 Minuten (einstellbar).
- **Initiale Pause:**  
  Nach Skriptstart (z. B. nach Stromausfall) wartet das Skript 3 Minuten, bevor die Überwachung beginnt.

## Konfigurierbare Parameter

Im Skript können folgende Werte angepasst werden:

| Variable            | Bedeutung                                              | Standardwert |
|---------------------|-------------------------------------------------------|--------------|
| `interval`          | Prüfintervall in Sekunden                             | 60           |
| `offlineDelay`      | Dauer, wie lange das Relay ausgeschaltet wird (Sek.)  | 20           |
| `pauseAfterOffline` | Pause nach einem Neustart (Sekunden)                  | 180          |
| `initialPause`      | Wartezeit nach Skriptstart (Sekunden)                 | 180          |
| `maxOfflineEvents`  | Max. Neustarts pro Stunde                             | 3            |
| `failureThreshold`  | Fehlversuche, bevor Neustart ausgelöst wird           | 3            |
| `httptimeout´       | Wartezeit auf Antwort                                 | 15000        |

## Hinweise

- **Fritzbox HTTP:**  
  Die Fritzbox muss HTTP auf Port 80 erlauben, damit die lokale Prüfung funktioniert. Andernfalls wird sie immer als "nicht erreichbar" gewertet.
- **Externe Adresse:**  
  Es wird empfohlen, eine HTTP-Adresse wie `http://neverssl.com` zu verwenden, da viele Shelly-Geräte kein HTTPS unterstützen.
- **Timeout:**  
  Der HTTP-Timeout ist auf 15 Sekunden gesetzt. Bei langsamen Verbindungen ggf. erhöhen.

## Installation

1. Skript in die Shelly Weboberfläche unter „Skripte“ einfügen.
2. Parameter nach Bedarf anpassen.
3. Skript starten.

## Beispiel-Logausgaben

```
IP http://192.168.110.1 erreichbar.
IP http://neverssl.com NICHT erreichbar. Fehlercode: -1 Fehlermeldung: Connection error: -15
Fehlversuch 1 von 3
Offline erkannt! Schalte Ausgang für 20 Sekunden aus.
Ausgang wieder eingeschaltet. Überwachung pausiert für 180 Sekunden.
```

## Lizenz

Dieses Skript steht unter der MIT-Lizenz. Nutzung auf eigene Gefahr.

---

**Hinweis:**  
Dieses Skript ist ein Beispiel und kann nach Bedarf erweitert oder angepasst werden.