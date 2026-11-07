// ============================================================
// REGELN & ZAHLEN für Stadt Land Fluss Extrem
//
// Alle Zeiten, Punkte, Gewichte und Grenzen stehen hier an einer Stelle.
// Die Tests lesen dieselbe Datei, die README beschreibt die Werte.
// Diese Datei wird von index.html per <script src="rules.js"> geladen.
// ============================================================

var RULES = {
  // Teams
  MIN_TEAMS: 1,
  MAX_TEAMS: 5,
  MAX_NAME_LENGTH: 20,
  DEFAULT_TEAM_NAME: "Team ", // plus laufende Nummer

  // Zielpunkte: Ist die Vorgabe erreicht, wird der Durchgang zu Ende gespielt
  DEFAULT_TARGET: 20,
  MIN_TARGET: 5,
  MAX_TARGET: 200,
  TARGET_STEP: 5,

  // Kategorien je Runde
  CATEGORIES_PER_ROUND: 8,

  // Countdown vor der Runde (Sekunden) und Hervorhebung am Ende (Sekunden)
  COUNTDOWN_SECONDS: 3,
  URGENT_SECONDS: 5,

  // Buchstabenwalze: Gewicht 0 = steht nicht auf der Walze.
  // Häufige deutsche Anfangsbuchstaben öfter, seltene (Q, X, Y) ausgeschlossen.
  LETTER_WEIGHTS: {
    A: 6, B: 8, C: 2, D: 5, E: 5, F: 6, G: 6, H: 7, I: 2, J: 2, K: 8, L: 5, M: 7,
    N: 3, O: 2, P: 5, Q: 0, R: 5, S: 10, T: 5, U: 2, V: 3, W: 6, X: 0, Y: 0, Z: 3,
  },

  // Walzen (Millisekunden bzw. Umdrehungen)
  WHEEL: {
    AUTO_STOP_MS: 4000, // ohne Tipp auf "Stopp" hält die Walze von selbst
    MIN_TURNS: 2, // Auslauf: so viele ganze Umdrehungen mindestens ...
    MAX_TURNS: 4, // ... und höchstens, zufällig
    MIN_RUNOUT_MS: 1800, // Dauer des Auslaufs mindestens ...
    MAX_RUNOUT_MS: 3000, // ... und höchstens, zufällig; beide Walzen laufen gleich lang aus
    SPEED: 14, // Zellen je Sekunde beim freien Drehen
  },

  // Modi: Reihenfolge = Reihenfolge auf der Walze. Gewicht 0 nimmt einen Modus heraus.
  // seconds 0 = kein Timer. minTeams: erst ab so vielen Teams auf der Walze.
  MODES: {
    normal: {
      name: "Normal",
      seconds: 60,
      points: 1,
      weight: 5,
      minTeams: 1,
      text: "Ein Punkt je geschafftem Begriff.",
    },
    double: {
      name: "Doppelt",
      seconds: 45,
      points: 2,
      weight: 2,
      minTeams: 1,
      text: "Zwei Punkte je geschafftem Begriff, aber weniger Zeit.",
    },
    allornothing: {
      name: "Alles oder nichts",
      seconds: 45,
      bonus: 10,
      weight: 2,
      minTeams: 1,
      text: "Alle acht in der Zeit: 10 Punkte. Sonst nichts.",
    },
    everyone: {
      name: "Alle raten mit",
      seconds: 0,
      points: 1,
      weight: 2,
      minTeams: 2,
      text: "Kein Timer. Begriff für Begriff: Das schnellste Team bekommt den Punkt.",
    },
  },
};
