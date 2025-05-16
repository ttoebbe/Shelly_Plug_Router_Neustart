# Shelly_Plug_Router_Neustart
Router Neustart wenn Offline oder Router nicht erreichbar mit Shelly 


Das Skript übernimmt folgende Aufgaben:

Initialisierung und Logging
– Beim Start wird mit scriptStartZeit festgehalten, wann das Skript gestartet wurde.
– Die Funktion log() sammelt alle übergebenen Argumente zu einer Meldung und gibt sie via console.log() aus.

Konfigurations­parameter
Du kannst ganz oben im Skript folgende Werte anpassen:

Variable	Bedeutung	Einheit	Standard
pruefIntervall	Abstand zwischen zwei Quick-Checks	Sekunden	60
offlineDauer	Dauer, für die bei erkannter Offline-Situation das Relay ausgeschaltet bleibt	Sekunden	20
pruefPauseMinuten	Ruhezeit nach einem Offline-Zyklus, bevor die Prüfungen wieder aufgenommen werden	Minuten	4
anfrageTimeoutSek	Timeout für jede HTTP-GET-Anfrage	Sekunden	15
debugAktiv	Schaltet erweiterte Debug-Meldungen ein (WLAN-Status, Connection-Check-Resultate)	boolean	true
zeigeAntworten	Gibt die kompletten HTTP-Antworten im Log aus	boolean	true
pruefZiele	Objekt mit den zu prüfenden Endpunkten (Schlüssel = Name, Wert = URL)	—	DNS1 + Fritz!Box
fritzBootSchonzeitSek	Zeit nach Skriptstart, während der keine Prüfungen** ausgeführt werden	Sekunden	180

Boot-Schonzeit
Nach einem (Wieder-)Start wird für die Dauer von fritzBootSchonzeitSek keine Prüfung ausgeführt – weder auf den Google-DNS-Server noch auf die Fritz!Box. Erst danach beginnt das zyklische Monitoring.

Quick_Check
– Prüft zunächst den WLAN-Status. Fehlt eine IP („got ip“), wird sofort in den Offline-Zustand gewechselt.
– Liegt die Start-Schonzeit noch nicht hinter sich, wird diese Runde übersprungen.
– Andernfalls werden nacheinander die in pruefZiele definierten URLs per HTTP-GET angefragt.

Deep_Check und Callback
– Für jedes Ziel wird eine Anfrage mit Timeout anfrageTimeoutSek gestartet.
– Die Callback-Funktion zählt erfolgreiche und fehlgeschlagene Anfragen.
– Sobald mindestens eine Anfrage fehlschlägt, wird State_Offline() ausgeführt.

State_Offline
– Protokolliert das aktuelle Offline-Ereignis und behält nur die Ereignisse der letzten 60 Minuten.
– Überschreitet die Anzahl 3 in einer Stunde das Limit, deaktiviert es weitere Offline-Aktionen.
– Schaltet das Relay für offlineDauer Sekunden ab, danach wieder an.
– Startet nach einer Ruhepause von pruefPauseMinuten Minuten den Prüfzyklus neu.

Main-Loop
Die Funktion Main() sorgt dafür, dass Quick_Check() alle pruefIntervall Sekunden automatisch aufgerufen wird.

Einstellmöglichkeiten im Überblick
Prüfintervalle

pruefIntervall (Sekunden)

Timeouts & Pausen

anfrageTimeoutSek (Timeout HTTP)

offlineDauer (Aus-Zeit Relay)

pruefPauseMinuten (Pause nach Offline)

fritzBootSchonzeitSek (Keine Prüfung nach Start)

Logging

debugAktiv (WLAN-Status & Check-Logs)

zeigeAntworten (volle HTTP-Antworten)

Prüfziele

pruefZiele (z. B. "dns1": "https://8.8.8.8", "fritzbox": "http://192.168.178.82")