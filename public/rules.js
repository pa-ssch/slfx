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
  DEFAULT_TARGET: 100,
  MIN_TARGET: 5,
  MAX_TARGET: 500,
  TARGET_STEP: 10, // je Runde gibt es bis zu 8 Punkte

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
    MIN_RUNOUT_MS: 2500, // Dauer des Auslaufs mindestens ...
    MAX_RUNOUT_MS: 3500, // ... und höchstens, zufällig; beide Walzen laufen gleich lang aus
    SPEED: 14, // Zellen je Sekunde beim freien Drehen; der Auslauf beginnt mit diesem Tempo
  },

  // Modi: Reihenfolge = Reihenfolge auf der Walze. Gewicht 0 nimmt einen Modus heraus.
  // seconds 0 = kein Timer. minTeams: erst ab so vielen Teams auf der Walze.
  MODES: {
    normal: {
      name: "Normal",
      seconds: 40,
      points: 1,
      weight: 5,
      minTeams: 1,
      text: "Ein Punkt je geschafftem Begriff.",
    },
    long: {
      name: "Gemütlich",
      seconds: 60,
      points: 1,
      weight: 2,
      minTeams: 1,
      text: "Mehr Zeit, ein Punkt je geschafftem Begriff.",
    },
    short: {
      name: "Schnell",
      seconds: 20,
      points: 1,
      weight: 2,
      minTeams: 1,
      text: "Wenig Zeit, ein Punkt je geschafftem Begriff.",
    },
    flash: {
      name: "Blitz",
      seconds: 15,
      points: 1,
      weight: 1,
      minTeams: 1,
      text: "Ganz wenig Zeit, ein Punkt je geschafftem Begriff.",
    },
    allornothing: {
      name: "Alles oder nichts",
      seconds: 80,
      bonus: 8, // alle acht geschafft: so viele Punkte, sonst 0 (am Ende wählbar)
      weight: 2,
      minTeams: 1,
      text: "Alle acht in der Zeit: 8 Punkte. Sonst nichts.",
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
