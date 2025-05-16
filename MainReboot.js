// Connection Check mit Relay-Offline-Funktion und Limit für Shelly Pug S G3

// Einfaches Logging mit console.log
function log() {
  var nachricht = "";
  for (var i = 0; i < arguments.length; i++) {
    nachricht += arguments[i] + (i < arguments.length - 1 ? " " : "");
  }
  console.log(nachricht);
}

// *** Konfiguration ***
var pruefIntervall            = 60;   // Intervall zwischen Quick_Check (Sekunden)
var offlineDauer              = 20;   // Dauer Relay AUS bei Offline (Sekunden)
var pruefPauseMinuten         = 4;    // Pause nach Offline-Zyklus (Minuten)
var anfrageTimeoutSek         = 15;   // HTTP-GET Timeout (Sekunden)
var debugAktiv                = true; // Debug-Ausgaben aktivieren?
var zeigeAntworten            = true; // HTTP-Antworten anzeigen?
var maxFehlversuche           = 3;    // Anzahl aufeinanderfolgender Fehlversuche vor Offline-Aktion

// Prüfziele: DNS1 (Google) und lokale Fritz!Box
var pruefZiele = {
  "dns1":     "https://8.8.8.8",
  "fritzbox": "http://192.168.178.1"
};

// Boot-Schonzeit direkt nach Skriptstart (keine Prüfungen)
var scriptStartZeit          = Date.now();
var bootSchonzeitSek         = 240;  // Sekunden ohne Prüfungen nach Start

// Laufzeit-Variablen
var timerHandle              = null;
var timerAktiv               = false;  // Flag, ob Main-Loop läuft
var anzahlPruefungen         = 0;
var zaehlerFehlgeschlagen    = 0;
var zaehlerErfolgreich       = 0;
var aufeinanderFehlgeschlagen = 0;     // aufeinanderfolgende Fehlversuche
var offlineEreignisse        = [];    // Zeitstempel letzte Offline-Zyklen
var offlineLimitUeberschritten = false;

// Startet den zyklischen Quick_Check
function MainStart() {
  if (!timerAktiv) {
    timerAktiv = true;
    timerHandle = Timer.set(1000 * pruefIntervall, true, Quick_Check);
    log("MainLoop gestartet: alle", pruefIntervall, "Sekunden Quick_Check.");
  }
}

// Stoppt den zyklischen Quick_Check
function MainStop() {
  if (timerAktiv) {
    Timer.clear(timerHandle);
    timerAktiv = false;
    log("MainLoop gestoppt.");
  }
}

// Funktion bei Offline-Erkennung
function State_Offline() {
  var jetzt = Date.now();
  if (offlineLimitUeberschritten) {
    log("Status: Limit erreicht – keine weiteren Offline-Aktionen.");
    MainStart();
    return;
  }

  // Offline-Zyklus protokollieren (letzte 60 Minuten)
  offlineEreignisse.push(jetzt);
  offlineEreignisse = offlineEreignisse.filter(function(ts) {
    return (jetzt - ts) <= 3600 * 1000;
  });

  // Limit prüfen: 3 Zyklen in 60 Minuten
  if (offlineEreignisse.length >= 3) {
    offlineLimitUeberschritten = true;
    log("Status: 3 Offline-Erkennungen innerhalb 1 Stunde – keine weiteren Aktionen.");
    MainStart();
    return;
  }

  // Relay AUS und Loop stoppen
  log("Status: Offline erkannt – schalte Relay AUS für", offlineDauer, "Sekunden");
  Shelly.call("Switch.Set", { relay: 0, on: false });
  MainStop();

  // Nach offlineDauer Relay AN und nach Pause MainStart
  Timer.set(1000 * offlineDauer, false, function() {
    log("Status: Relay wieder AN");
    Shelly.call("Switch.Set", { relay: 0, on: true });
    log("Pause von", pruefPauseMinuten, "Minuten vor Neustart.");
    Timer.set(1000 * 60 * pruefPauseMinuten, false, function() {
      MainStart();
    });
  });
}

// Callback für HTTP-GET
function Callback(rueckgabe, code, fehlermeldung, schluessel) {
  try {
    if (code !== -104) zaehlerErfolgreich++; else zaehlerFehlgeschlagen++;
    if (debugAktiv) log("Connection-Check:", schluessel, (code!==-104 ? "Bestanden" : "Fehlgeschlagen"), fehlermeldung);

    // Wenn alle Prüfungen abgeschlossen
    if (zaehlerErfolgreich + zaehlerFehlgeschlagen >= anzahlPruefungen) {
      if (zaehlerFehlgeschlagen > 0) {
        aufeinanderFehlgeschlagen++;
        log("Warnung: aufeinanderfolgende Fehlversuche", aufeinanderFehlgeschlagen, "/", maxFehlversuche);
        if (aufeinanderFehlgeschlagen >= maxFehlversuche) {
          aufeinanderFehlgeschlagen = 0;
          State_Offline();
        }
      } else {
        aufeinanderFehlgeschlagen = 0;
      }
      // Zähler für nächsten Zyklus zurücksetzen
      zaehlerFehlgeschlagen = 0;
      zaehlerErfolgreich    = 0;
    }

    if (zeigeAntworten) log("Antwort:", code, fehlermeldung, rueckgabe);
  } catch(err) {
    log("Fehler in Callback():", err);
  }
}

// Deep-Check aller Ziele
function Deep_Check(zielListe) {
  try {
    Object.keys(zielListe).forEach(function(schluessel) {
      Shelly.call("HTTP.get", {
        url:     zielListe[schluessel],
        timeout: anfrageTimeoutSek
      }, Callback, schluessel);
    });
  } catch(err) {
    log("Fehler in Deep_Check():", err);
  }
}

// Quick-Check: WLAN-Status und ggf. Boot-Schonzeit
function Quick_Check() {
  try {
    var wlanStatus = Shelly.getComponentStatus("wifi").status;
    if (debugAktiv || wlanStatus !== "got ip") log("Status: WLAN-Status --> [", wlanStatus, "]");
    if (wlanStatus !== "got ip") {
      State_Offline();
      return;
    }

    // Boot-Schonzeit prüfen (keine Prüfungen)
    var jetzt = Date.now();
    if ((jetzt - scriptStartZeit) < bootSchonzeitSek * 1000) {
      log("Boot-Schonzeit aktiv – keine Prüfungen");
      return;
    }

    // Regulärer Deep-Check starten
    zaehlerFehlgeschlagen = 0;
    zaehlerErfolgreich    = 0;
    anzahlPruefungen       = Object.keys(pruefZiele).length;
    Deep_Check(pruefZiele);

  } catch(err) {
    log("Fehler in Quick_Check():", err);
  }
}

// Skriptstart: MainLoop starten
MainStart();
log("Status: Connection Check läuft mit konfigurierten Einstellungen...");
