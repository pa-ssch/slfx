(function () {
  "use strict";

  // Die Regeln stehen in rules.js (RULES), die Kategorien in decks.js (DECKS, DEFAULT_ON).
  if (
    typeof RULES !== "object" || RULES === null ||
    typeof DECKS !== "object" || DECKS === null
  ) {
    document.body.textContent = "rules.js oder decks.js konnte nicht geladen werden.";
    return;
  }

  var GAME_KEY = "slfx-game";
  var USED_KEY = "slfx-used";
  var DECKS_KEY = "slfx-decks";
  var INSTALL_KEY = "slfx-install";

  var PHASES = ["turn", "wheel", "ready", "play", "score", "end"];
  var N = RULES.CATEGORIES_PER_ROUND;
  var LETTERS = Object.keys(RULES.LETTER_WEIGHTS); // A bis Z

  // ---------- Hilfsfunktionen ----------
  function $(id) {
    return document.getElementById(id);
  }
  function clear(node) {
    node.textContent = "";
  }
  function make(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function isInt(x, min, max) {
    return typeof x === "number" && isFinite(x) && Math.floor(x) === x && x >= min && x <= max;
  }
  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  // Ansicht wechseln. Spiel-Ansichten (.game) zeigen die Punkteleiste.
  function show(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove("active");
    var screen = $(id);
    screen.classList.add("active");
    var inGame = screen.classList.contains("game");
    document.body.classList.toggle("in-game", inGame);
    if (inGame) renderScores();
    // Eine zuvor gespeicherte Fehlermeldung im Install-Hinweis stört hier nicht
    if (id === "home") hideInstallIfNeeded();
  }

  // ---------- Speicher ----------
  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }
  function removeKey(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  // Bereits gezeigte Kategorien auf diesem Handy, damit sich möglichst
  // nichts wiederholt. Nur ein Array aus Strings ist brauchbar.
  function loadUsed() {
    var saved = readJSON(USED_KEY);
    if (Array.isArray(saved))
      return saved.filter(function (c) {
        return typeof c === "string";
      });
    return [];
  }
  function saveUsed(list) {
    writeJSON(USED_KEY, list);
  }

  // ---------- Decks ----------
  function allDecks() {
    return Object.keys(DECKS).filter(function (d) {
      return Array.isArray(DECKS[d]);
    });
  }
  function validDecks(list) {
    var all = allDecks();
    if (!Array.isArray(list)) return [];
    return all.filter(function (d) {
      return list.indexOf(d) !== -1;
    });
  }
  function defaultDecks() {
    var all = allDecks();
    var on =
      typeof DEFAULT_ON !== "undefined" && Array.isArray(DEFAULT_ON) ? DEFAULT_ON : [];
    var def = all.filter(function (d) {
      return on.indexOf(d) !== -1;
    });
    return def.length > 0 ? def : all.slice();
  }
  function loadSelectedDecks() {
    var valid = validDecks(readJSON(DECKS_KEY));
    return valid.length > 0 ? valid : defaultDecks();
  }
  function saveSelectedDecks(list) {
    writeJSON(DECKS_KEY, list);
  }
  // Alle Kategorien der gewählten Decks, ohne Doppelte
  function activeCategories(decks) {
    var list = [];
    decks.forEach(function (d) {
      (DECKS[d] || []).forEach(function (c) {
        if (typeof c === "string" && list.indexOf(c) === -1) list.push(c);
      });
    });
    return list;
  }

  // ---------- Spielstand ----------
  // Alles, was zum laufenden Spiel gehört, liegt in einem Objekt und wird nach
  // jeder Änderung gespeichert. Beim Laden wird streng geprüft: Müll ergibt
  // "kein Spiel", eine kaputte Runde ergibt den Rundenstart desselben Teams,
  // die Punkte bleiben in jedem Fall erhalten.
  var game = null;

  function cleanName(name, index) {
    var s = typeof name === "string" ? name.trim().slice(0, RULES.MAX_NAME_LENGTH) : "";
    return s || RULES.DEFAULT_TEAM_NAME + (index + 1);
  }

  function validateRound(r, nTeams) {
    if (typeof r !== "object" || r === null) return null;
    if (typeof r.letter !== "string" || LETTERS.indexOf(r.letter) === -1) return null;
    if (typeof r.mode !== "string" || !RULES.MODES[r.mode]) return null;
    if (!Array.isArray(r.categories) || r.categories.length < 1 || r.categories.length > N)
      return null;
    var n = r.categories.length;
    for (var i = 0; i < n; i++) if (typeof r.categories[i] !== "string") return null;
    if (!Array.isArray(r.done) || r.done.length !== n) return null;
    var done = r.done.map(function (d) {
      return d === true;
    });
    var awards = [];
    for (var j = 0; j < n; j++) {
      var a = Array.isArray(r.awards) ? r.awards[j] : null;
      awards.push(isInt(a, 0, nTeams - 1) ? a : null);
    }
    return {
      letter: r.letter,
      mode: r.mode,
      categories: r.categories.slice(),
      done: done,
      endsAt: typeof r.endsAt === "number" && isFinite(r.endsAt) ? r.endsAt : null,
      index: isInt(r.index, 0, n) ? r.index : 0,
      awards: awards,
      terms: isInt(r.terms, 0, n) ? r.terms : null,
    };
  }

  function validateGame(raw) {
    if (typeof raw !== "object" || raw === null || raw.v !== 1) return null;
    if (!Array.isArray(raw.teams)) return null;
    if (raw.teams.length < RULES.MIN_TEAMS || raw.teams.length > RULES.MAX_TEAMS) return null;
    var teams = raw.teams.map(function (t, i) {
      var score = t && isInt(t.score, 0, 1e6) ? t.score : 0;
      return { name: cleanName(t && t.name, i), score: score };
    });
    var target = isInt(raw.target, RULES.MIN_TARGET, RULES.MAX_TARGET)
      ? raw.target
      : RULES.DEFAULT_TARGET;
    var decks = validDecks(raw.decks);
    if (decks.length === 0) decks = defaultDecks();
    var roundNo = isInt(raw.roundNo, 0, 1e6) ? raw.roundNo : 0;
    var lastLetter =
      typeof raw.lastLetter === "string" && LETTERS.indexOf(raw.lastLetter) !== -1
        ? raw.lastLetter
        : null;
    var phase = PHASES.indexOf(raw.phase) !== -1 ? raw.phase : "turn";
    var round = validateRound(raw.round, teams.length);
    if (round && round.mode === "everyone" && teams.length < RULES.MODES.everyone.minTeams)
      round = null;
    // Phasen, die eine Runde brauchen, fallen ohne gültige Runde auf den Rundenstart zurück
    if (!round && (phase === "ready" || phase === "play" || phase === "score")) phase = "turn";
    if (phase === "turn" || phase === "wheel" || phase === "end") round = null;
    return {
      v: 1,
      teams: teams,
      target: target,
      decks: decks,
      roundNo: roundNo,
      current: roundNo % teams.length,
      lastLetter: lastLetter,
      phase: phase,
      round: round,
    };
  }

  function loadGame() {
    game = validateGame(readJSON(GAME_KEY));
    // Bereinigte Fassung zurückschreiben, damit der Speicher immer gültig ist
    if (game) saveGame();
    return game;
  }
  function saveGame() {
    if (game) writeJSON(GAME_KEY, game);
    else removeKey(GAME_KEY);
  }
  function newGame(names, target, decks) {
    game = {
      v: 1,
      teams: names.map(function (n, i) {
        return { name: cleanName(n, i), score: 0 };
      }),
      target: target,
      decks: decks,
      roundNo: 0,
      current: 0,
      lastLetter: null,
      phase: "turn",
      round: null,
    };
    saveGame();
  }
  function gameRunning() {
    return !!game && game.phase !== "end";
  }
  function activeTeam() {
    return game.teams[game.current];
  }
  function mode() {
    return RULES.MODES[game.round.mode];
  }

  // ---------- Punkteleiste ----------
  function renderScores() {
    var box = $("scores");
    clear(box);
    if (!game) return;
    game.teams.forEach(function (t, i) {
      var chip = make("div", "chip" + (i === game.current && game.phase !== "end" ? " active" : ""));
      chip.appendChild(make("span", "name", t.name));
      chip.appendChild(make("b", "pts", String(t.score)));
      box.appendChild(chip);
    });
  }

  // ---------- Zufall ----------
  // Buchstabe: gewichtet, nie derselbe wie in der Vorrunde. Genau ein Aufruf
  // von Math.random, unabhängig von Walzenposition und Zeitpunkt des Tippens.
  function wheelLetters() {
    return LETTERS.filter(function (l) {
      return RULES.LETTER_WEIGHTS[l] > 0;
    });
  }
  function weightedPick(items, weightOf) {
    var total = 0;
    items.forEach(function (it) {
      total += weightOf(it);
    });
    var x = Math.random() * total;
    for (var i = 0; i < items.length; i++) {
      x -= weightOf(items[i]);
      if (x < 0) return items[i];
    }
    return items[items.length - 1];
  }
  function pickLetter(lastLetter) {
    var pool = wheelLetters().filter(function (l) {
      return l !== lastLetter;
    });
    return weightedPick(pool, function (l) {
      return RULES.LETTER_WEIGHTS[l];
    });
  }
  // Modi, die bei dieser Teamanzahl auf der Walze stehen
  function wheelModes(nTeams) {
    return Object.keys(RULES.MODES).filter(function (k) {
      var m = RULES.MODES[k];
      return m.weight > 0 && nTeams >= (m.minTeams || 1);
    });
  }
  function pickMode(nTeams) {
    return weightedPick(wheelModes(nTeams), function (k) {
      return RULES.MODES[k].weight;
    });
  }
  function modeLabel(key) {
    var m = RULES.MODES[key];
    return m.seconds ? m.name + " · " + m.seconds + " s" : m.name;
  }

  // Kategorien für eine Runde: aus den gewählten Decks, ohne Wiederholung, bis
  // alle durch sind. Reichen die ungezeigten nicht mehr, werden die restlichen
  // genommen und der Merker für diese Auswahl zurückgesetzt.
  function drawFrom(list, chosen) {
    while (chosen.length < N && list.length > 0)
      chosen.push(list.splice(Math.floor(Math.random() * list.length), 1)[0]);
  }
  function pickCategories(decks) {
    var pool = activeCategories(decks);
    var used = loadUsed();
    var fresh = pool.filter(function (c) {
      return used.indexOf(c) === -1;
    });
    var chosen = [];
    drawFrom(fresh, chosen);
    if (chosen.length < N) {
      used = used.filter(function (c) {
        return pool.indexOf(c) === -1;
      });
      drawFrom(
        pool.filter(function (c) {
          return chosen.indexOf(c) === -1;
        }),
        chosen,
      );
    }
    saveUsed(used.concat(chosen));
    return chosen;
  }

  // ---------- Walze ----------
  // Eine Walze zeigt drei Zellen, die mittlere ist das Ergebnis. Die Einträge
  // stehen dreimal hintereinander, die Position läuft im mittleren Drittel
  // und springt unsichtbar zurück. Beim Stoppen wird das Ziel vorgegeben; die
  // Walze läuft eine zufällige Zahl ganzer Umdrehungen weiter und bremst ab.
  function Reel(track, labels) {
    this.track = track;
    this.n = labels.length;
    this.raf = null;
    this.state = "idle";
    clear(track);
    for (var c = 0; c < 3; c++)
      for (var i = 0; i < labels.length; i++) track.appendChild(make("div", "cell", labels[i]));
    this.pos = this.n;
    this.apply();
  }
  // Exakte Zellhöhe mit Nachkommastellen: offsetHeight rundet auf ganze Pixel,
  // und der Fehler summiert sich über die Zellen zu einem sichtbaren Versatz
  Reel.prototype.cellHeight = function () {
    return this.track.firstChild ? this.track.firstChild.getBoundingClientRect().height : 0;
  };
  Reel.prototype.apply = function () {
    while (this.pos >= 2 * this.n) this.pos -= this.n;
    while (this.pos < this.n) this.pos += this.n;
    this.track.style.transform =
      "translateY(" + -((this.pos - 1) * this.cellHeight()) + "px)";
  };
  Reel.prototype.cancel = function () {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  };
  Reel.prototype.set = function (index) {
    this.cancel();
    this.state = "idle";
    this.pos = this.n + index;
    this.apply();
  };
  Reel.prototype.spin = function () {
    var self = this;
    var last = null;
    this.cancel();
    this.state = "spinning";
    function frame(t) {
      if (last !== null) self.pos += (RULES.WHEEL.SPEED * (t - last)) / 1000;
      last = t;
      self.apply();
      self.raf = requestAnimationFrame(frame);
    }
    this.raf = requestAnimationFrame(frame);
  };
  // Auslaufen bis zum Ziel: zufällig viele ganze Umdrehungen in der vorgegebenen Dauer
  Reel.prototype.stop = function (index, duration, onDone) {
    var self = this;
    var W = RULES.WHEEL;
    this.cancel();
    if (this.state !== "spinning" || prefersReducedMotion()) {
      this.set(index);
      onDone();
      return;
    }
    var start = this.pos;
    var ahead = (index - (start - this.n) + this.n) % this.n; // Weg bis zum Ziel, 0 bis n
    var turns = W.MIN_TURNS + Math.floor(Math.random() * (W.MAX_TURNS - W.MIN_TURNS + 1));
    var dist = ahead + turns * this.n;
    var t0 = null;
    this.state = "runout";
    function frame(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / duration);
      var eased = 1 - Math.pow(1 - k, 3);
      self.pos = start + dist * eased;
      self.apply();
      if (k < 1) {
        self.raf = requestAnimationFrame(frame);
      } else {
        self.raf = null;
        self.set(index);
        onDone();
      }
    }
    this.raf = requestAnimationFrame(frame);
  };

  var letterReel = null;
  var modeReel = null;
  var spinState = "idle"; // idle | spinning | stopping
  var autoStopTimer = null;

  function stopWheel() {
    if (letterReel) letterReel.cancel();
    if (modeReel) modeReel.cancel();
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
    spinState = "idle";
  }

  function showWheel() {
    stopWheel();
    stopTimer();
    var letters = wheelLetters();
    var modes = wheelModes(game.teams.length);
    letterReel = new Reel($("letterReel"), letters);
    modeReel = new Reel($("modeReel"), modes.map(modeLabel));
    var spinBtn = $("spinBtn");
    var settled = game.phase === "ready" && game.round;
    if (settled) {
      letterReel.set(letters.indexOf(game.round.letter));
      modeReel.set(modes.indexOf(game.round.mode));
      showWheelResult();
    } else {
      game.phase = "wheel";
      game.round = null;
      saveGame();
      spinBtn.textContent = "Stopp";
      spinBtn.disabled = false;
      spinBtn.hidden = false;
      $("goBtn").hidden = true;
      clear($("wheelResult"));
    }
    show("wheel");
    keepAwake();
    // Nach dem Einblenden sind die Zellhöhen bekannt: Position nachziehen
    letterReel.apply();
    modeReel.apply();
    // Die Walzen laufen von selbst an, sobald die Ansicht erscheint
    if (!settled) startSpin();
  }

  // Beide Walzen laufen zusammen an. Bei reduzierter Bewegung steht das Ergebnis sofort.
  function startSpin() {
    if (prefersReducedMotion()) {
      spinState = "stopping";
      $("spinBtn").disabled = true;
      var letter = pickLetter(game.lastLetter);
      var key = pickMode(game.teams.length);
      letterReel.set(wheelLetters().indexOf(letter));
      modeReel.set(wheelModes(game.teams.length).indexOf(key));
      finishWheel(letter, key);
      return;
    }
    spinState = "spinning";
    $("spinBtn").textContent = "Stopp";
    letterReel.spin();
    modeReel.spin();
    autoStopTimer = setTimeout(stopSpin, RULES.WHEEL.AUTO_STOP_MS);
  }

  // Beim Tipp auf "Stopp" stehen Buchstabe und Modus fest; beide Walzen laufen
  // danach gleich lang sichtbar aus und halten gemeinsam auf dem Ergebnis.
  function stopSpin() {
    if (spinState !== "spinning") return;
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
    spinState = "stopping";
    $("spinBtn").disabled = true;
    var letter = pickLetter(game.lastLetter);
    var key = pickMode(game.teams.length);
    var W = RULES.WHEEL;
    var duration = W.MIN_RUNOUT_MS + Math.random() * (W.MAX_RUNOUT_MS - W.MIN_RUNOUT_MS);
    var pending = 2;
    function done() {
      if (--pending === 0) finishWheel(letter, key);
    }
    letterReel.stop(wheelLetters().indexOf(letter), duration, done);
    modeReel.stop(wheelModes(game.teams.length).indexOf(key), duration, done);
  }

  function finishWheel(letter, key) {
    var cats = pickCategories(game.decks);
    game.round = {
      letter: letter,
      mode: key,
      categories: cats,
      done: cats.map(function () {
        return false;
      }),
      endsAt: null,
      index: 0,
      awards: cats.map(function () {
        return null;
      }),
      terms: null,
    };
    game.phase = "ready";
    saveGame();
    spinState = "idle";
    showWheelResult();
  }

  function showWheelResult() {
    var m = mode();
    var box = $("wheelResult");
    clear(box);
    box.appendChild(
      make("b", null, game.round.letter + " – " + m.name + (m.seconds ? " (" + m.seconds + " s)" : "")),
    );
    box.appendChild(document.createElement("br"));
    box.appendChild(document.createTextNode(m.text));
    $("spinBtn").hidden = true;
    $("goBtn").hidden = false;
  }

  // ---------- Countdown ----------
  var countdownTimer = null;
  function startCountdown() {
    var n = RULES.COUNTDOWN_SECONDS;
    var num = $("countNum");
    num.textContent = n;
    show("countdown");
    keepAwake();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(function () {
      n--;
      if (n > 0) {
        num.textContent = n;
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        startRound();
      }
    }, 1000);
  }

  function startRound() {
    var m = mode();
    game.phase = "play";
    game.round.endsAt = m.seconds ? Date.now() + m.seconds * 1000 : null;
    saveGame();
    if (game.round.mode === "everyone") showEveryone();
    else showPlay();
  }

  // ---------- Runde mit Timer und Kacheln ----------
  var timer = null;
  function stopTimer() {
    clearInterval(timer);
    timer = null;
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  function countDone() {
    return game.round.done.filter(Boolean).length;
  }
  function allDone() {
    return countDone() === game.round.done.length;
  }

  function renderTiles() {
    var box = $("tiles");
    clear(box);
    var frozen = game.phase !== "play";
    game.round.categories.forEach(function (c, i) {
      var tile = make("button", "tile");
      tile.type = "button";
      tile.setAttribute("aria-pressed", game.round.done[i] ? "true" : "false");
      tile.disabled = frozen;
      tile.appendChild(make("span", "tile-text", c));
      tile.addEventListener("click", function () {
        onTile(i, tile);
      });
      box.appendChild(tile);
    });
  }

  function onTile(i, tile) {
    if (game.phase !== "play") return;
    game.round.done[i] = !game.round.done[i];
    tile.setAttribute("aria-pressed", game.round.done[i] ? "true" : "false");
    saveGame();
    // Alles oder nichts: alle geschafft, Timer stoppt sofort
    if (game.round.mode === "allornothing" && allDone()) endPlay("Geschafft!");
  }

  // Kacheltexte so verkleinern, dass sie in die Kachel passen
  function fitTiles() {
    var tiles = document.querySelectorAll("#tiles .tile");
    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      var span = tile.firstChild;
      tile.style.fontSize = "";
      var size = parseFloat(getComputedStyle(tile).fontSize);
      var cs = getComputedStyle(tile);
      var maxW = tile.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var maxH = tile.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      while (size > 10 && (span.scrollHeight > maxH || span.scrollWidth > maxW)) {
        size -= 1;
        tile.style.fontSize = size + "px";
      }
    }
  }

  function showPlay() {
    stopWheel();
    stopTimer();
    $("playLetter").textContent = game.round.letter;
    renderTiles();
    var t = $("timer");
    t.className = "timer";
    t.hidden = false;
    $("doneBtn").textContent = "Fertig";
    show("play");
    fitTiles();
    requestAnimationFrame(fitTiles);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTiles);
    keepAwake();
    if (game.phase === "play") {
      tick();
      timer = setInterval(tick, 200);
    } else {
      // Zeit war beim Laden schon um: eingefroren zeigen
      endPlay("Zeit!");
    }
  }

  function tick() {
    var left = Math.max(0, Math.ceil((game.round.endsAt - Date.now()) / 1000));
    var t = $("timer");
    t.textContent = String(left);
    t.classList.toggle("urgent", left > 0 && left <= RULES.URGENT_SECONDS);
    if (Date.now() >= game.round.endsAt) {
      try {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } catch (e) {}
      endPlay("Zeit!");
    }
  }

  // Runde einfrieren: Timer aus, Kacheln gesperrt, "Weiter" zur Punkteansicht
  function endPlay(label) {
    stopTimer();
    game.phase = "score";
    game.round.terms = countDone();
    saveGame();
    var t = $("timer");
    t.textContent = label;
    t.className = "timer over";
    var tiles = document.querySelectorAll("#tiles .tile");
    for (var i = 0; i < tiles.length; i++) tiles[i].disabled = true;
    $("doneBtn").textContent = "Weiter";
  }

  // "Fertig" vor Ablauf der Zeit: Runde beenden und direkt zur Punkteansicht
  function onDone() {
    if (game.phase === "play") endPlay("Fertig!");
    showScore();
  }

  // ---------- Alle raten mit ----------
  function showEveryone() {
    stopWheel();
    stopTimer();
    var r = game.round;
    $("evLetter").textContent = r.letter;
    $("evProgress").textContent = r.index + 1 + " von " + r.categories.length;
    var word = $("evWord");
    word.textContent = r.categories[r.index];
    var teams = $("evTeams");
    clear(teams);
    game.teams.forEach(function (t, i) {
      var b = make("button", "btn", t.name);
      b.type = "button";
      b.addEventListener("click", function () {
        awardTo(i);
      });
      teams.appendChild(b);
    });
    show("everyone");
    fitEvWord();
    requestAnimationFrame(fitEvWord);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitEvWord);
    keepAwake();
  }

  function awardTo(teamIndex) {
    if (game.phase !== "play" || game.round.mode !== "everyone") return;
    var r = game.round;
    r.awards[r.index] = teamIndex;
    if (teamIndex !== null) game.teams[teamIndex].score += mode().points;
    r.index++;
    if (r.index >= r.categories.length) {
      game.phase = "score";
      saveGame();
      showScore();
    } else {
      saveGame();
      renderScores();
      showEveryone();
    }
  }

  // ---------- Begriff in seinen Kasten einpassen (aus One Clue) ----------
  function measureRatio(el, text) {
    el.textContent = text;
    el.style.fontSize = "1000px";
    return el.scrollWidth / 1000;
  }
  function splitLines(text, k) {
    if (k <= 1) return [text];
    var lines = [],
      i;
    if (text.indexOf(" ") !== -1) {
      var words = text.split(" ");
      var target = text.length / k;
      var cur = "";
      for (i = 0; i < words.length; i++) {
        var next = cur ? cur + " " + words[i] : words[i];
        if (cur && next.length > target && lines.length < k - 1) {
          lines.push(cur);
          cur = words[i];
        } else {
          cur = next;
        }
      }
      if (cur) lines.push(cur);
    } else {
      var chunk = Math.ceil(text.length / k);
      for (i = 0; i < text.length; i += chunk) {
        var part = text.slice(i, i + chunk);
        if (i + chunk < text.length) part += "-";
        lines.push(part);
      }
    }
    return lines;
  }
  function renderLines(el, lines) {
    clear(el);
    for (var i = 0; i < lines.length; i++) {
      if (i > 0) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(lines[i]));
    }
  }
  // Schriftgröße so wählen, dass der Text in den Kasten passt: möglichst eine
  // Zeile, sonst wenige gleichmäßig lange Zeilen
  function fitInto(el, box, text) {
    if (!text) return;
    var maxW = box.clientWidth - 8;
    var maxH = box.clientHeight - 8;
    var minSize = Math.max(24, Math.min(window.innerWidth, window.innerHeight) * 0.1);
    var best = null;
    for (var k = 1; k <= 6; k++) {
      var lines = splitLines(text, k);
      if (lines.length < k) break;
      var ratio = 0;
      for (var i = 0; i < lines.length; i++) ratio = Math.max(ratio, measureRatio(el, lines[i]));
      var size = Math.min(Math.floor(maxW / ratio), Math.floor(maxH / (1.3 * lines.length)));
      if (!best || size > best.size) best = { size: size, lines: lines };
      if (size >= minSize) {
        best = { size: size, lines: lines };
        break;
      }
    }
    renderLines(el, best.lines);
    el.style.fontSize = Math.max(best.size, 14) + "px";
  }
  function fitEvWord() {
    if (!game || !game.round || !$("everyone").classList.contains("active")) return;
    fitInto($("evWord"), $("evWordBox"), game.round.categories[game.round.index]);
  }

  // ---------- Rundenende und Punkte ----------
  function pointsText(n) {
    return n + (n === 1 ? " Punkt" : " Punkte");
  }

  function roundPoints() {
    var m = mode();
    var r = game.round;
    if (r.mode === "allornothing") return (r.terms === null ? allDone() : r.terms === r.categories.length) ? m.bonus : 0;
    if (r.mode === "everyone") return 0; // schon je Begriff vergeben
    var terms = r.terms === null ? countDone() : r.terms;
    return terms * m.points;
  }

  function showScore() {
    stopWheel();
    stopTimer();
    var m = mode();
    var r = game.round;
    var n = r.categories.length;
    $("scoreTitle").textContent = activeTeam().name;
    var info = $("scoreInfo");
    var stepper = $("scoreStepper");
    var points = $("scorePoints");
    var summary = $("scoreSummary");
    clear(summary);
    stepper.hidden = true;
    points.hidden = false;
    summary.hidden = true;
    var btn = $("scoreBtn");
    btn.textContent = "Punkte eintragen";
    if (r.mode === "everyone") {
      info.textContent = m.name + ": Die Punkte wurden schon vergeben.";
      points.hidden = true;
      summary.hidden = false;
      game.teams.forEach(function (t, i) {
        var got = r.awards.filter(function (a) {
          return a === i;
        }).length;
        var li = make("li");
        li.appendChild(document.createTextNode(t.name + ": "));
        li.appendChild(make("b", null, "+" + got * m.points));
        summary.appendChild(li);
      });
      btn.textContent = "Weiter";
    } else if (r.mode === "allornothing") {
      // Alles oder nichts: vorbelegt nach den Kacheln, am Ende aber wählbar (0 oder alle)
      if (r.terms === null) r.terms = allDone() ? n : 0;
      else r.terms = r.terms === n ? n : 0;
      var all = allDone();
      info.textContent =
        m.name + ": " + (all ? "Alle " + n + " geschafft!" : "Nur " + countDone() + " von " + n + " geschafft.") + " Stimmt das?";
      stepper.hidden = false;
      $("scoreValue").textContent = r.terms + " von " + n;
      $("scoreMinus").disabled = r.terms === 0;
      $("scorePlus").disabled = r.terms === n;
      points.textContent = "+" + pointsText(roundPoints());
    } else {
      if (r.terms === null) r.terms = countDone();
      info.textContent = m.name + ": " + m.points + " Punkt" + (m.points === 1 ? "" : "e") + " je Begriff. Stimmt die Zahl?";
      stepper.hidden = false;
      $("scoreValue").textContent = r.terms + " von " + n;
      $("scoreMinus").disabled = r.terms <= 0;
      $("scorePlus").disabled = r.terms >= n;
      points.textContent = "+" + pointsText(roundPoints());
    }
    show("score");
  }

  function adjustTerms(delta) {
    var r = game.round;
    var n = r.categories.length;
    if (r.mode === "allornothing") r.terms = delta > 0 ? n : 0; // nur 0 oder alle
    else r.terms = Math.max(0, Math.min(n, (r.terms === null ? countDone() : r.terms) + delta));
    saveGame();
    showScore();
  }

  function confirmScore() {
    activeTeam().score += roundPoints();
    game.roundNo++;
    game.lastLetter = game.round.letter;
    game.round = null;
    game.current = game.roundNo % game.teams.length;
    var best = Math.max.apply(
      null,
      game.teams.map(function (t) {
        return t.score;
      }),
    );
    // Zielpunkte erreicht und alle Teams gleich oft dran gewesen: Schluss
    if (best >= game.target && game.current === 0) {
      game.phase = "end";
      saveGame();
      showEnd();
    } else {
      game.phase = "turn";
      saveGame();
      showTurn();
    }
  }

  // ---------- Rundenstart und Spielende ----------
  function showTurn() {
    stopWheel();
    stopTimer();
    $("turnTeam").textContent = activeTeam().name + " ist dran";
    var pass = Math.floor(game.roundNo / game.teams.length) + 1;
    $("turnInfo").textContent = "Durchgang " + pass + " · Ziel: " + pointsText(game.target);
    show("turn");
    keepAwake();
  }

  function showEnd() {
    stopWheel();
    stopTimer();
    var order = game.teams
      .map(function (t, i) {
        return { name: t.name, score: t.score, i: i };
      })
      .sort(function (a, b) {
        return b.score - a.score || a.i - b.i;
      });
    var best = order[0].score;
    var winners = order.filter(function (t) {
      return t.score === best;
    });
    var title = $("endTitle");
    if (game.teams.length === 1) title.textContent = order[0].name + ": " + pointsText(best) + "!";
    else if (winners.length === 1) title.textContent = winners[0].name + " gewinnt!";
    else
      title.textContent =
        "Geteilter Sieg: " +
        winners
          .map(function (t) {
            return t.name;
          })
          .join(" und ");
    var list = $("ranking");
    clear(list);
    order.forEach(function (t) {
      var li = make("li", t.score === best ? "winner" : "", t.name + " – " + pointsText(t.score));
      list.appendChild(li);
    });
    show("end");
    releaseWakeLock();
  }

  function playAgain() {
    game.teams.forEach(function (t) {
      t.score = 0;
    });
    game.roundNo = 0;
    game.current = 0;
    game.lastLetter = null;
    game.round = null;
    game.phase = "turn";
    saveGame();
    showTurn();
  }

  // Nach dem Laden oder per "Weiterspielen": an der gespeicherten Stelle weiter
  function resume() {
    if (!game) {
      showHome();
      return;
    }
    switch (game.phase) {
      case "wheel":
      case "ready":
        showWheel();
        break;
      case "play":
        if (game.round.mode === "everyone") showEveryone();
        else if (game.round.endsAt !== null && Date.now() < game.round.endsAt) showPlay();
        else {
          game.phase = "score";
          game.round.terms = countDone();
          saveGame();
          showScore();
        }
        break;
      case "score":
        showScore();
        break;
      case "end":
        showEnd();
        break;
      default:
        showTurn();
    }
  }

  // ---------- Startseite ----------
  function showHome() {
    stopWheel();
    stopTimer();
    $("resumeBtn").hidden = !gameRunning();
    show("home");
    releaseWakeLock();
  }

  // ---------- Spiel anlegen ----------
  var setupCount = 2;
  var setupNames = [];

  function openSetup() {
    var from = game ? game.teams : null;
    setupCount = from ? from.length : Math.min(2, RULES.MAX_TEAMS);
    setupNames = from
      ? from.map(function (t) {
          return t.name;
        })
      : [];
    $("target").value = game ? game.target : RULES.DEFAULT_TARGET;
    renderTeamInputs();
    buildDeckList();
    show("setup");
  }

  function renderTeamInputs() {
    // Eingetippte Namen vor dem Neuaufbau sichern
    var inputs = document.querySelectorAll("#teams input");
    for (var i = 0; i < inputs.length; i++) setupNames[i] = inputs[i].value;
    $("teamCount").textContent = setupCount;
    $("teamMinus").disabled = setupCount <= RULES.MIN_TEAMS;
    $("teamPlus").disabled = setupCount >= RULES.MAX_TEAMS;
    var box = $("teams");
    clear(box);
    for (var j = 0; j < setupCount; j++) {
      var input = document.createElement("input");
      input.type = "text";
      input.id = "team-" + j;
      input.maxLength = RULES.MAX_NAME_LENGTH;
      input.placeholder = RULES.DEFAULT_TEAM_NAME + (j + 1);
      input.setAttribute("aria-label", "Name von Team " + (j + 1));
      input.autocapitalize = "words";
      input.setAttribute("autocorrect", "off");
      input.spellcheck = false;
      input.enterKeyHint = "done";
      var name = setupNames[j] || "";
      // Standardnamen nicht vorbelegen, der Platzhalter zeigt sie
      if (name !== RULES.DEFAULT_TEAM_NAME + (j + 1)) input.value = name;
      box.appendChild(input);
    }
  }

  function clampTarget(v) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) return RULES.DEFAULT_TARGET;
    return Math.max(RULES.MIN_TARGET, Math.min(RULES.MAX_TARGET, n));
  }
  function stepTarget(delta) {
    var input = $("target");
    input.value = clampTarget(clampTarget(input.value) + delta);
  }

  function buildDeckList() {
    var box = $("decks");
    var selected = loadSelectedDecks();
    clear(box);
    allDecks().forEach(function (name) {
      var label = make("label", "cat");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = name;
      cb.checked = selected.indexOf(name) !== -1;
      cb.addEventListener("change", onDeckChange);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + name));
      box.appendChild(label);
    });
    updatePoolCount();
  }
  function selectedDecksFromUI() {
    var boxes = document.querySelectorAll("#decks input");
    var list = [];
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) list.push(boxes[i].value);
    return list;
  }
  function onDeckChange(e) {
    var list = selectedDecksFromUI();
    if (list.length === 0) {
      // Mindestens ein Deck muss ausgewählt bleiben
      e.target.checked = true;
      e.target.parentNode.classList.remove("shake");
      void e.target.parentNode.offsetWidth;
      e.target.parentNode.classList.add("shake");
      return;
    }
    saveSelectedDecks(list);
    updatePoolCount();
  }
  // Unter den Decks: Größe der Auswahl und wie viele davon noch nicht gezeigt wurden
  function updatePoolCount() {
    var cats = activeCategories(loadSelectedDecks());
    var used = loadUsed();
    var left = cats.filter(function (c) {
      return used.indexOf(c) === -1;
    }).length;
    var text = cats.length === 1 ? "1 Kategorie" : cats.length + " Kategorien";
    if (left === 0) text += ", alle schon gezeigt";
    else if (left < cats.length) text += ", davon " + left + " noch nicht gezeigt";
    $("poolcount").textContent = text;
  }

  function startGame() {
    var inputs = document.querySelectorAll("#teams input");
    var names = [];
    for (var i = 0; i < inputs.length; i++) names.push(inputs[i].value);
    var decks = selectedDecksFromUI();
    if (decks.length === 0) decks = loadSelectedDecks();
    newGame(names, clampTarget($("target").value), decks);
    showTurn();
  }

  // ---------- Rückfrage ----------
  var confirmAction = null;
  function ask(text, onYes) {
    var dialog = $("confirm");
    $("confirmText").textContent = text;
    confirmAction = onYes;
    if (typeof dialog.showModal === "function") {
      try {
        dialog.showModal();
        return;
      } catch (e) {}
    }
    if (window.confirm(text)) onYes();
  }
  $("confirmYes").addEventListener("click", function () {
    var action = confirmAction;
    confirmAction = null;
    $("confirm").close();
    if (action) action();
  });
  $("confirmNo").addEventListener("click", function () {
    confirmAction = null;
    $("confirm").close();
  });

  // ---------- Bildschirm anlassen ----------
  var wakeLock = null;
  function keepAwake() {
    if (!("wakeLock" in navigator)) return;
    navigator.wakeLock
      .request("screen")
      .then(function (l) {
        wakeLock = l;
      })
      .catch(function () {});
  }
  function releaseWakeLock() {
    if (wakeLock) {
      try {
        wakeLock.release();
      } catch (e) {}
      wakeLock = null;
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && document.body.classList.contains("in-game"))
      keepAwake();
  });

  // ---------- Events ----------
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-go]");
    if (!btn) return;
    var target = btn.getAttribute("data-go");
    if (target === "home") showHome();
    else show(target);
  });
  $("resumeBtn").addEventListener("click", resume);
  $("newBtn").addEventListener("click", function () {
    if (gameRunning()) ask("Es läuft noch ein Spiel. Trotzdem ein neues anlegen?", openSetup);
    else openSetup();
  });
  $("quitBtn").addEventListener("click", function () {
    ask("Zur Startseite? Das Spiel bleibt gespeichert.", showHome);
  });
  $("teamMinus").addEventListener("click", function () {
    if (setupCount > RULES.MIN_TEAMS) {
      setupCount--;
      renderTeamInputs();
    }
  });
  $("teamPlus").addEventListener("click", function () {
    if (setupCount < RULES.MAX_TEAMS) {
      setupCount++;
      renderTeamInputs();
    }
  });
  $("targetMinus").addEventListener("click", function () {
    stepTarget(-RULES.TARGET_STEP);
  });
  $("targetPlus").addEventListener("click", function () {
    stepTarget(RULES.TARGET_STEP);
  });
  $("target").addEventListener("change", function () {
    stepTarget(0);
  });
  $("setupForm").addEventListener("submit", function (e) {
    e.preventDefault();
    startGame();
  });
  $("readyBtn").addEventListener("click", showWheel);
  $("spinBtn").addEventListener("click", stopSpin);
  $("goBtn").addEventListener("click", startCountdown);
  $("doneBtn").addEventListener("click", onDone);
  $("evSkip").addEventListener("click", function () {
    awardTo(null);
  });
  $("scoreMinus").addEventListener("click", function () {
    adjustTerms(-1);
  });
  $("scorePlus").addEventListener("click", function () {
    adjustTerms(1);
  });
  $("scoreBtn").addEventListener("click", confirmScore);
  $("againBtn").addEventListener("click", playAgain);
  $("endNewBtn").addEventListener("click", openSetup);

  function onResize() {
    fitTiles();
    fitEvWord();
    if (letterReel) letterReel.apply();
    if (modeReel) modeReel.apply();
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", function () {
    setTimeout(onResize, 150);
  });

  // Offline-Fähigkeit: Service Worker registrieren (nur über https/localhost möglich)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  // ---------- Hinweis "App zum Home-Bildschirm hinzufügen" (aus One Clue) ----------
  // Android/Chrome melden per beforeinstallprompt, dass die App installierbar
  // ist; dann gibt es einen Button, der den echten Install-Dialog öffnet.
  // iOS kennt das nicht, dort wird nur erklärt, wie es per Teilen-Menü geht.
  // Nie in der installierten App (Standalone) und nie mehr nach "Nein, danke".
  var installEvent = null;

  function isStandalone() {
    return (
      navigator.standalone === true ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches)
    );
  }
  function isIOS() {
    return (
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      // iPadOS gibt sich als Mac aus, hat aber einen Touchscreen
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }
  function installDismissed() {
    try {
      return localStorage.getItem(INSTALL_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  function showInstall(withButton) {
    if (isStandalone() || installDismissed()) return;
    $("installPrompt").hidden = !withButton;
    $("installIos").hidden = withButton;
    $("installBtn").hidden = !withButton;
    $("install").classList.add("open");
  }
  function hideInstall() {
    $("install").classList.remove("open");
  }
  function hideInstallIfNeeded() {
    if (isStandalone() || installDismissed()) hideInstall();
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); // Chromes eigenen Mini-Hinweis unterdrücken, wir zeigen unseren
    installEvent = e;
    showInstall(true);
  });
  window.addEventListener("appinstalled", function () {
    installEvent = null;
    hideInstall();
  });
  $("installBtn").addEventListener("click", function () {
    var ev = installEvent;
    if (!ev) return;
    installEvent = null;
    hideInstall(); // prompt() geht pro Event nur einmal, danach meldet sich Chrome neu
    try {
      ev.prompt().catch(function () {});
    } catch (e) {}
  });
  $("installDismiss").addEventListener("click", function () {
    try {
      localStorage.setItem(INSTALL_KEY, "1");
    } catch (e) {}
    hideInstall();
  });
  // Ohne Install-Event (iOS) sofort die Anleitung zeigen
  if (isIOS() && !("onbeforeinstallprompt" in window)) showInstall(false);

  // ---------- Start ----------
  var total = activeCategories(allDecks()).length;
  $("catcount").textContent = total + " Kategorien in " + allDecks().length + " Decks";
  loadGame();
  // Läuft gerade eine Runde (Timer oder "Alle raten mit"), geht es direkt dort
  // weiter; sonst zeigt die Startseite "Weiterspielen".
  if (game && game.phase === "play") resume();
  else showHome();
})();
