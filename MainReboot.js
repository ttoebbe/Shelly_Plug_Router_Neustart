// Connection Check mit Relay-Offline-Funktion (Shelly Plug S G3)

function log() {
  var nachricht = "";
  for (var i = 0; i < arguments.length; i++) {
    nachricht += arguments[i] + (i < arguments.length - 1 ? " " : "");
  }
  console.log(nachricht);
}

// *** Konfiguration ***
var pruefIntervall = 60;     // Quick-Check-Intervall (Sekunden)
var offlineDauer = 20;       // Relay AUS-Dauer (Sekunden)
var pruefPauseMinuten = 4;   // Pause nach Offline (Minuten)
var httpTimeout = 5;         // HTTP-Timeout (Sekunden)
var debugAktiv = true;       // Debug-Logging
var maxFehlversuche = 3;     // Fehlversuche vor Offline

// Ziele: Lightweight-HTTP-Endpoints
var pruefZiele = {
  "google": "http://connectivitycheck.gstatic.com/generate_204",
  "fritzbox": "http://192.168.178.1/login_success.lua"
};

var scriptStartZeit = Date.now();
var bootSchonzeitSek = 120;  // Boot-Schonzeit (Sekunden)
var timerHandle = null;
var timerAktiv = false;
var aufeinanderFehlgeschlagen = 0;
var offlineEreignisse = [];
var offlineLimitUeberschritten = false;

// Main-Loop
function MainStart() {
  if (!timerAktiv) {
    timerAktiv = true;
    timerHandle = Timer.set(pruefIntervall * 1000, true, Quick_Check);
    log("MainLoop gestartet (Intervall:", pruefIntervall, "s)");
  }
}

function MainStop() {
  if (timerAktiv) {
    Timer.clear(timerHandle);
    timerAktiv = false;
    log("MainLoop gestoppt");
  }
}

// Offline-Handling
function State_Offline() {
  var jetzt = Date.now();
  if (offlineLimitUeberschritten) {
    log("Offline-Limit erreicht – keine Aktion");
    return;
  }

  offlineEreignisse.push(jetzt);
  offlineEreignisse = offlineEreignisse.filter(function(ts) {
    return (jetzt - ts) <= 3600 * 1000;
  });

  if (offlineEreignisse.length >= 3) {
    offlineLimitUeberschritten = true;
    log("Offline-Limit (3/h) – deaktiviert");
    return;
  }

  log("Offline – Relay AUS für", offlineDauer, "s");
  Shelly.call("Switch.Set", { relay: 0, on: false });
  MainStop();

  Timer.set(offlineDauer * 1000, false, function() {
    Shelly.call("Switch.Set", { relay: 0, on: true });
    log("Relay AN – Pause:", pruefPauseMinuten, "Minuten");
    Timer.set(pruefPauseMinuten * 60 * 1000, false, MainStart);
  });
}

// HTTP-Check (Callback-basiert)
function HTTP_Check(ziel, callback) {
  Shelly.call("HTTP.get", {
    url: ziel,
    timeout: httpTimeout,
    headers: { "User-Agent": "Shelly-Check" }
  }, function(res, code, err) {
    var ok = (code === 200 || code === 204);
    if (debugAktiv) log("HTTP-Check:", ziel, ok ? "OK" : "FEHLER");
    callback(ok);
  });
}

// Sequenzielle Prüfung (ohne async/await)
function Deep_Check() {
  var ziele = Object.keys(pruefZiele);
  var fehler = 0;
  var index = 0;

  function checkNext() {
    if (index >= ziele.length) {
      if (fehler > 0) {
        aufeinanderFehlgeschlagen++;
        log("Fehlversuche:", aufeinanderFehlgeschlagen, "/", maxFehlversuche);
        if (aufeinanderFehlgeschlagen >= maxFehlversuche) {
          aufeinanderFehlgeschlagen = 0;
          State_Offline();
        }
      } else {
        aufeinanderFehlgeschlagen = 0;
      }
      return;
    }

    var key = ziele[index++];
    var url = pruefZiele[key];
    HTTP_Check(url, function(ok) {
      if (!ok) fehler++;
      checkNext();
    });
  }

  checkNext();
}

// Quick-Check
function Quick_Check() {
  try {
    var wifi = Shelly.getComponentStatus("wifi"); // Typo hier: "wifi" vs "wifi"
    if (wifi.status !== "got ip") {
      if (debugAktiv) log("WLAN-Status:", wifi.status);
      State_Offline();
      return;
    }

    if ((Date.now() - scriptStartZeit) < bootSchonzeitSek * 1000) {
      if (debugAktiv) log("Boot-Schonzeit aktiv");
      return;
    }

    Deep_Check();
  } catch(err) {
    log("Fehler in Quick_Check:", err.message);
  }
}

// Skriptstart
MainStart();
log("Status: Skript läuft");