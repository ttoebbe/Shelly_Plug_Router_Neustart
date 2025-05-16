// Verbindungsprüfung mit Relais-Offline-Funktion und Limit für Shelly Plug S G3

// Einfaches Logging mit console.log
function log() {
  var nachricht = "";
  for (var i = 0; i < arguments.length; i++) {
    nachricht += arguments[i] + (i < arguments.length - 1 ? " " : "");
  }
  console.log(nachricht);
}

var intervallSekunden         = 60;   // Intervall für Schnellprüfung (Sekunden)
var offlineDauerSekunden      = 20;   // Relais-Aus-Dauer bei Offline (Sekunden)
var wiederaufnahmePauseMin    = 4;    // Pause bis zur Wiederaufnahme der Prüfung (Minuten)
var anfrageTimeoutSekunden    = 15;   // HTTP-Request Timeout (Sekunden)
var debugModus                = true; // Debug-Ausgaben aktivieren?
var zeigeAntwort              = true; // HTTP-Antworten anzeigen?

var pruefziele = {
  "dns1": "https://8.8.8.8",
  "dns2": "https://1.1.1.1",
  "dns3": "https://1.0.0.1",
  "dns4": "https://8.8.4.4"
};

var timerHandle               = null;
var pruefzieleAnzahl          = 0;
var fehlgeschlagenZaehler     = 0;
var bestandenZaehler          = 0;

// Neu: Tracking der Offline-Ereignisse
var offlineEreignisse         = [];    // Zeitstempel (ms) der letzten Offline-Erkennungen
var offlineLimitErreicht      = false; // Flag, ob das Limit (3/h) erreicht wurde

function Zustand_Offline(){
  var jetzt = Date.now();

  // Wenn Limit bereits erreicht, keine Aktionen mehr, aber Schleife fortsetzen
  if (offlineLimitErreicht) {
    log("Status: Limit erreicht – keine weiteren Offline-Aktionen.");
    Hauptfunktion();
    return;
  }

  // Offline-Ereignis protokollieren und nur die letzten 60 Minuten behalten
  offlineEreignisse.push(jetzt);
  offlineEreignisse = offlineEreignisse.filter(function(zeitstempel){
    return (jetzt - zeitstempel) <= 3600 * 1000;
  });

  // Limit prüfen: 3x in der letzten Stunde?
  if (offlineEreignisse.length >= 3) {
    offlineLimitErreicht = true;
    log("Status: 3 Offline-Erkennungen innerhalb 1 Stunde – keine weiteren Offline-Aktionen.");
    Hauptfunktion();
    return;
  }

  // Noch unter dem Limit: Relais aus für offlineDauerSekunden Sekunden
  log("Status: Offline erkannt – schalte Relais AUS für", offlineDauerSekunden, "Sekunden");
  Shelly.call("Switch.Set", { relay: 0, on: false });

  // Nach offlineDauerSekunden Sekunden Relais wieder einschalten
  Timer.set(1000 * offlineDauerSekunden, false, function(){
    log("Status: Relais wieder AN");
    Shelly.call("Switch.Set", { relay: 0, on: true });

    // Nach wiederaufnahmePauseMin Minuten Prüfungen wieder aufnehmen
    Timer.set(1000 * 60 * wiederaufnahmePauseMin, false, function(){
      log("Status: Starte Prüfungen neu nach", wiederaufnahmePauseMin, "Minuten Pause");
      Hauptfunktion();
    });
  });
}

function Rueckruf(antwort, code, fehler, pruefziel){
  try {
    if (code !== -104) bestandenZaehler++;
    else               fehlgeschlagenZaehler++;

    if (debugModus) {
      log("Verbindungsprüfung:", pruefziel, (code !== -104 ? "Bestanden" : "Fehlgeschlagen"), fehler);
    }

    if (fehlgeschlagenZaehler + bestandenZaehler >= pruefzieleAnzahl) {
      if (bestandenZaehler === 0) {
        Zustand_Offline();
      } else {
        Hauptfunktion();
      }
    }

    if (zeigeAntwort) {
      log("Antwort:", code, fehler, antwort);
    }
  } catch(err) {
    log("Fehler in Rueckruf():", err);
  }
}

function TiefePruefung(pruefzieleObjekt){
  try {
    Object.keys(pruefzieleObjekt).forEach(function(schluessel){
      Shelly.call("HTTP.get", {
        url:     pruefzieleObjekt[schluessel],
        timeout: anfrageTimeoutSekunden
      }, Rueckruf, schluessel);
    });
  } catch(err) {
    log("Fehler in TiefePruefung():", err);
  }
}

function Schnellpruefung(){
  try {
    var ipStatus = Shelly.getComponentStatus("wifi").status;

    if (debugModus || ipStatus !== "got ip") {
      log("Status: Shelly IP-Status --> [", ipStatus, "]");
    }

    if (ipStatus !== "got ip") {
      // Keine IP = sofort Offline-Aktion (Zustand_Offline kümmert sich um Limit)
      Timer.clear(timerHandle);
      Zustand_Offline();
      return;
    }

    // IP vorhanden → tiefergehende Internet-Checks
    Timer.clear(timerHandle);
    fehlgeschlagenZaehler = 0;
    bestandenZaehler      = 0;
    pruefzieleAnzahl      = Object.keys(pruefziele).length;
    TiefePruefung(pruefziele);

  } catch(err) {
    log("Fehler in Schnellpruefung():", err);
    Hauptfunktion();
  }
}

function Hauptfunktion(){
  try {
    Timer.clear(timerHandle);
    timerHandle = Timer.set(1000 * intervallSekunden, true, Schnellpruefung);
  } catch(err) {
    log("Fehler in Hauptfunktion():", err);
  }
}

// Script starten
Hauptfunktion();
log("Status: Verbindungsprüfung mit Relais-Offline-Limit läuft...");