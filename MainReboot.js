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
var pruefIntervall            = 60;   // Quick-Check Intervall (Sekunden)
var offlineDauer              = 20;   // Relay off-Dauer bei Offline (Sekunden)
var pruefPauseMinuten         = 4;    // Pause bis zur Wiederaufnahme der Prüfung (Minuten)
var anfrageTimeoutSek         = 15;   // HTTP-Request Timeout (Sekunden)
var debugAktiv                = true; // Debug-Ausgaben aktivieren?
var zeigeAntworten            = true; // HTTP-Antworten anzeigen?

// Prüfziele: DNS1 (Google) und lokale Fritz!Box
var pruefZiele = {
  "dns1":    "https://8.8.8.8",
  "fritzbox":"http://192.168.178.82"
};

// Zeitstempel merken für Fritz!Box-Boot-Schonzeit
var scriptStartZeit       = Date.now();
var fritzBootSchonzeitSek = 180;  // Zeit nach Skriptstart, ohne Prüfungen (Sekunden)

// Laufzeit-Variablen
var timerHandle               = null;
var anzahlPruefungen          = 0;
var zaehlerFehlgeschlagen     = 0;
var zaehlerErfolgreich        = 0;
var offlineEreignisse         = [];    // Zeitstempel zuletzt erkannter Offline-Zustände
var offlineLimitUeberschritten = false; // Limit (3/h) erreicht?

function State_Offline(){
  var jetzt = Date.now();
  if (offlineLimitUeberschritten) {
    log("Status: Limit erreicht – keine weiteren Offline-Aktionen.");
    Main(); return;
  }

  // Offline-Ereignis protokollieren (nur letzte 60 min behalten)
  offlineEreignisse.push(jetzt);
  offlineEreignisse = offlineEreignisse.filter(function(ts){
    return (jetzt - ts) <= 3600 * 1000;
  });

  // Limit prüfen: >=3 in 60 Minuten?
  if (offlineEreignisse.length >= 3) {
    offlineLimitUeberschritten = true;
    log("Status: 3 Offline-Erkennungen innerhalb 1 Stunde – keine weiteren Aktionen.");
    Main(); return;
  }

  // Relay aus
  log("Status: Offline erkannt – schalte Relay AUS für", offlineDauer, "Sekunden");
  Shelly.call("Switch.Set", { relay: 0, on: false });

  // Nach offlineDauer Relay an und dann Pause
  Timer.set(1000 * offlineDauer, false, function(){
    log("Status: Relay wieder AN");
    Shelly.call("Switch.Set", { relay: 0, on: true });
    Timer.set(1000 * 60 * pruefPauseMinuten, false, function(){
      log("Starte Prüfungen neu nach", pruefPauseMinuten, "Minuten Pause");
      Main();
    });
  });
}

function Callback(rueckgabe, code, fehlermeldung, schluessel){
  try {
    if (code !== -104) zaehlerErfolgreich++; else zaehlerFehlgeschlagen++;
    if (debugAktiv) log("Connection-Check:", schluessel, (code!==-104 ? "Bestanden" : "Fehlgeschlagen"), fehlermeldung);

    // Wenn alle Prüfungen durchlaufen
    if (zaehlerErfolgreich + zaehlerFehlgeschlagen >= anzahlPruefungen) {
      // Bei mindestens einer Fehlermeldung -> Offline-Zustand
      if (zaehlerFehlgeschlagen > 0) State_Offline(); else Main();
    }

    if (zeigeAntworten) log("Antwort:", code, fehlermeldung, rueckgabe);
  } catch(err) {
    log("Fehler in Callback():", err);
  }
}

function Deep_Check(zielListe){
  try {
    Object.keys(zielListe).forEach(function(schluessel){
      Shelly.call("HTTP.get", {
        url:     zielListe[schluessel],
        timeout: anfrageTimeoutSek
      }, Callback, schluessel);
    });
  } catch(err) { log("Fehler in Deep_Check():", err); }
}

function Quick_Check(){
  try {
    var wlanStatus = Shelly.getComponentStatus("wifi").status;
    if (debugAktiv || wlanStatus!=="got ip") log("Status: WLan-Status --> [", wlanStatus, "]");
    if (wlanStatus !== "got ip") { Timer.clear(timerHandle); State_Offline(); return; }

    // Schonzeit prüfen: während dieser wird keine Prüfung ausgeführt
    var jetzt = Date.now();
    if ((jetzt - scriptStartZeit) < fritzBootSchonzeitSek * 1000) {
      log("Fritz!Box-Schonzeit aktiv – keine Prüfungen");
      Main();
      return;
    }

    // Reguläre Prüfung starten
    Timer.clear(timerHandle);
    zaehlerFehlgeschlagen = 0;
    zaehlerErfolgreich    = 0;
    anzahlPruefungen       = Object.keys(pruefZiele).length;
    Deep_Check(pruefZiele);

  } catch(err) { log("Fehler in Quick_Check():", err); Main(); }
}

function Main(){
  try {
    Timer.clear(timerHandle);
    timerHandle = Timer.set(1000 * pruefIntervall, true, Quick_Check);
  } catch(err) { log("Fehler in Main():", err); }
}

// Skriptstart
Main();
log("Status: Connection Check mit Relay-Offline-Limit und Schonzeit läuft...");
