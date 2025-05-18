// <reference path="../../shelly-script.d.ts" />
// created from vscode

function currentTime() {
    return "[" + (new Date()).toLocaleTimeString() + "]";
}

// Konfiguration (alle Werte in Sekunden bzw. Minuten, wie angegeben)
var checkInterval      = 20;  // Intervall zwischen den Checks (Sekunden)
var offlineDelay       = 20;  // Dauer, für die das Relay ausgeschaltet wird (Sekunden)
var resumeDelay        = 1;   // Pause nach Offline-Ereignis, bis Überwachung fortgesetzt wird (Minuten)
var initialStartupDelay= 60;  // Verzögerung beim Skriptstart (Sekunden) - gibt dem Router Zeit zum Hochfahren
var callTimeout        = 3000; // HTTP-Request Timeout (Millisekunden)
var failureThreshold   = 3;   // Anzahl der Fehlversuche, bevor ein Offline-Event ausgelöst wird
var maxOfflineEvents   = 3;   // Maximal offline Ereignisse pro Stunde

// Zieladressen
var targetIP           = "http://192.168.110.1";
var targetInternet     = "https://www.google.com";

// Statusvariablen
var failureCount       = 0;
var offlineEvents      = [];
var checkTimer         = null;

var checks = {
  "dns1": "http://8.8.8.8",
  "dns2": "http://1.1.1.1",
  "dns3": "http://1.0.0.1",
  "dns4": "http://8.8.4.4"
};

function checkConnectivity() {
  var responsesReceived = 0;
  var successCount = 0;
  var checkKeys = Object.keys(checks);

  checkKeys.forEach(function(key) {
    Shelly.call("HTTP.GET", { url: checks[key], timeout: callTimeout }, function(result, error_code, error_msg) {
      if (error_code === 0) {
        successCount++;
        print(key + " erreichbar.");
      } else {
        print(key + " nicht erreichbar.");
      }
      responsesReceived++;
      if (responsesReceived >= checkKeys.length) {
        if (successCount === 0) {
          failureCount++;
          print("Connectivity FAILED. Aktuelle Fehlversuche: " + failureCount);
          if (failureCount >= failureThreshold) {
            triggerOfflineEvent();
          }
        } else {
          print("Connectivity OK: Mindestens ein Ziel erreichbar.");
          failureCount = 0;
        }
      }
    });
  });
}

function triggerOfflineEvent() {
    var now = Date.now();
    offlineEvents.push(now);
    // Filter: nur Ereignisse der letzten 3600 Sekunden (1 Stunde) behalten
    offlineEvents = offlineEvents.filter(function(ts) {
        return (now - ts) <= 3600 * 1000;
    });

    if (offlineEvents.length > maxOfflineEvents) {
        print("Offline Ereignis Limit erreicht – keine weitere Offline-Aktion.");
        failureCount = 0;
        return;
    }

    print("Offline Event: Fehlergrenze erreicht. Schalte Relay für " + offlineDelay + " Sekunden aus.");
    Timer.clear(checkTimer);
    Shelly.call("Switch.Set", { id: 0, on: false });

    // Nach offlineDelay Sekunden wieder einschalten und resumeDelay abwarten bis erneuter Start
    Timer.set(offlineDelay * 1000, false, function() {
        Shelly.call("Switch.Set", { id: 0, on: true });
        print("Relay wieder eingeschaltet.");
        failureCount = 0;
        Timer.set(resumeDelay * 60 * 1000, false, function() {
            print("Überwachung wird fortgesetzt.");
            startMonitoring();
        });
    });
}

function startMonitoring() {
    // Überwachung: checkConnectivity wird alle checkInterval Sekunden aufgerufen
    checkTimer = Timer.set(checkInterval * 1000, true, checkConnectivity);
}

// Initialer Delay, damit der Router nach einem Stromausfall hochfahren kann
Timer.set(initialStartupDelay * 1000, false, function() {
    print("Starte Überwachung (initialer Delay beendet).");
    startMonitoring();
});

print("Skript gestartet. Warte " + initialStartupDelay + " Sekunden bis zum ersten Check.");