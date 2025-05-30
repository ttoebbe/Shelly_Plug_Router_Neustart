// <reference path="../../shelly-script.d.ts" />

var targetIPs = [
    "http://192.168.110.1",   // Deine Fritzbox, falls HTTP aktiviert ist
    "http://neverssl.com"     // Garantiert HTTP erreichbar
];
var interval = 60; // Sekunden zwischen Checks
var offlineDelay = 20; // Sekunden, wie lange Ausgang auf false
var pauseAfterOffline = 180; // Sekunden (3 Minuten) Pause nach Offline-Event
var initialPause = 180; // Sekunden (3 Minuten) nach Skriptstart keine Prüfung
var maxOfflineEvents = 3; // Maximal 3 Offline-Events pro Stunde
var failureThreshold = 3; // Nach 3 Fehlversuchen wird Ausgang geschaltet
var httptimeout = 15000; // Timeout für HTTP-Requests in Millisekunden / besser nicht unter 15 Sekunden (15000)setzen, da "neverssl.com" auch mal länger braucht

var failureCount = 0;
var offlineEvents = [];
var checkTimer = null;

function checkIPs() {
    var responses = 0;
    var success = 0;
    targetIPs.forEach(function(targetIP) {
        Shelly.call("HTTP.GET", { url: targetIP, timeout: httptimeout }, function(res, error_code, error_msg) {
            if (error_code === 0 && res && res.code === 200) {
                success++;
                print("IP " + targetIP + " erreichbar.");
            } else {
                print("IP " + targetIP + " NICHT erreichbar. Fehlercode:", error_code, "Fehlermeldung:", error_msg);
            }
            responses++;
            if (responses === targetIPs.length) {
                if (success === 0) {
                    failureCount++;
                    print("Fehlversuch " + failureCount + " von " + failureThreshold);
                    if (failureCount >= failureThreshold) {
                        handleOfflineEvent();
                    }
                } else {
                    failureCount = 0;
                }
            }
        });
    });
}

function handleOfflineEvent() {
    var now = Date.now();
    // Nur Events der letzten Stunde zählen
    offlineEvents = offlineEvents.filter(function(ts) { return (now - ts) < 3600 * 1000; });
    if (offlineEvents.length >= maxOfflineEvents) {
        print("Maximale Anzahl Offline-Events pro Stunde erreicht. Keine Aktion.");
        failureCount = 0;
        return;
    }
    offlineEvents.push(now);
    print("Offline erkannt! Schalte Ausgang für " + offlineDelay + " Sekunden aus.");
    Timer.clear(checkTimer);
    Shelly.call("Switch.Set", { id: 0, on: false });
    Timer.set(offlineDelay * 1000, false, function() {
        Shelly.call("Switch.Set", { id: 0, on: true });
        print("Ausgang wieder eingeschaltet. Überwachung pausiert für " + pauseAfterOffline + " Sekunden.");
        failureCount = 0;
        Timer.set(pauseAfterOffline * 1000, false, function() {
            print("Überwachung wird fortgesetzt.");
            startMonitoring();
        });
    });
}

function startMonitoring() {
    checkTimer = Timer.set(interval * 1000, true, checkIPs);
}

// Initiale Pause nach Skriptstart
Timer.set(initialPause * 1000, false, function() {
    print("Starte Überwachung nach initialer Pause von " + initialPause + " Sekunden.");
    startMonitoring();
});

print("Skript gestartet. Warte " + initialPause + " Sekunden bis zur ersten Überprüfung.");
