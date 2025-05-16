// Connection Check mit Relay-Offline-Funktion und Limit für Shelly Pug S G3

// Einfaches Logging mit console.log
function log() {
  var msg = "";
  for (var i = 0; i < arguments.length; i++) {
    msg += arguments[i] + (i < arguments.length - 1 ? " " : "");
  }
  console.log(msg);
}

var interval            = 60;   // Quick-Check Intervall (Sekunden)
var offline_duration    = 20;   // Relay off-Dauer bei Offline (Sekunden)
var resume_delay        = 4;    // Pause bis zur Wiederaufnahme der Prüfung (Minuten)
var call_timeout        = 15;   // HTTP-Request Timeout (Sekunden)
var debug               = true; // Debug-Ausgaben aktivieren?
var show_Response       = true; // HTTP-Antworten anzeigen?

var checks = {
  "dns1": "https://8.8.8.8",
  "dns2": "https://1.1.1.1",
  "dns3": "https://1.0.0.1",
  "dns4": "https://8.8.4.4"
};

var tH1                  = null;
var checks_length        = 0;
var failedC              = 0;
var passedC              = 0;

// Neu: Tracking der Offline-Ereignisse
var offlineEvents        = [];    // Zeitstempel (ms) der letzten Offline-Erkennungen
var offlineLimitReached  = false; // Flag, ob das Limit (3/h) erreicht wurde

function State_Offline(){
  var now = Date.now();

  // Wenn Limit bereits erreicht, keine Aktionen mehr, aber Schleife fortsetzen
  if (offlineLimitReached) {
    log("Status: Limit erreicht – keine weiteren Offline-Aktionen.");
    Main();
    return;
  }

  // Offline-Ereignis protokollieren und nur die letzten 60 Minuten behalten
  offlineEvents.push(now);
  offlineEvents = offlineEvents.filter(function(ts){
    return (now - ts) <= 3600 * 1000;
  });

  // Limit prüfen: 3x in der letzten Stunde?
  if (offlineEvents.length >= 3) {
    offlineLimitReached = true;
    log("Status: 3 Offline-Erkennungen innerhalb 1 Stunde – keine weiteren Offline-Aktionen.");
    Main();
    return;
  }

  // Noch unter dem Limit: Relay aus für offline_duration Sekunden
  log("Status: Offline erkannt – schalte Relay AUS für", offline_duration, "Sekunden");
  Shelly.call("Switch.Set", { relay: 0, on: false });

  // Nach offline_duration Sekunden Relay wieder einschalten
  Timer.set(1000 * offline_duration, false, function(){
    log("Status: Relay wieder AN");
    Shelly.call("Switch.Set", { relay: 0, on: true });

    // Nach resume_delay Minuten Prüfungen wieder aufnehmen
    Timer.set(1000 * 60 * resume_delay, false, function(){
      log("Status: Starte Prüfungen neu nach", resume_delay, "Minuten Pause");
      Main();
    });
  });
}

function Callback(r, c, e, k){
  try {
    if (c !== -104) passedC++;
    else            failedC++;

    if (debug) {
      log("Connection check:", k, (c !== -104 ? "Passed" : "Failed"), e);
    }

    if (failedC + passedC >= checks_length) {
      if (passedC === 0) {
        State_Offline();
      } else {
        Main();
      }
    }

    if (show_Response) {
      log("Response:", c, e, r);
    }
  } catch(err) {
    log("Error in Callback():", err);
  }
}

function Deep_Check(check_points){
  try {
    Object.keys(check_points).forEach(function(key){
      Shelly.call("HTTP.get", {
        url:     check_points[key],
        timeout: call_timeout
      }, Callback, key);
    });
  } catch(err) {
    log("Error in Deep_Check():", err);
  }
}

function Quick_Check(){
  try {
    var ip_Status = Shelly.getComponentStatus("wifi").status;

    if (debug || ip_Status !== "got ip") {
      log("Status: Shelly IP-Status --> [", ip_Status, "]");
    }

    if (ip_Status !== "got ip") {
      // Keine IP = sofort Offline-Aktion (State_Offline kümmert sich um Limit)
      Timer.clear(tH1);
      State_Offline();
      return;
    }

    // IP vorhanden → tiefergehende Internet-Checks
    Timer.clear(tH1);
    failedC       = 0;
    passedC       = 0;
    checks_length = Object.keys(checks).length;
    Deep_Check(checks);

  } catch(err) {
    log("Error in Quick_Check():", err);
    Main();
  }
}

function Main(){
  try {
    Timer.clear(tH1);
    tH1 = Timer.set(1000 * interval, true, Quick_Check);
  } catch(err) {
    log("Error in Main():", err);
  }
}

// Script starten
Main();
log("Status: Connection Check mit Relay-Offline-Limit läuft...");