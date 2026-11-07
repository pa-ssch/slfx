// Gemeinsame Hilfsfunktionen für die Tests
const fs = require("fs");
const path = require("path");
const { expect } = require("@playwright/test");

const PUBLIC = path.join(__dirname, "..", "public");

// Regeln und Decks direkt aus den Dateien der Seite laden (gleiche Quelle)
const rulesSrc = fs.readFileSync(path.join(PUBLIC, "rules.js"), "utf8");
const decksSrc = fs.readFileSync(path.join(PUBLIC, "decks.js"), "utf8");
const { RULES } = new Function(rulesSrc + ";return { RULES: RULES };")();
const { DECKS, DEFAULT_ON } = new Function(decksSrc + ";return { DECKS: DECKS, DEFAULT_ON: DEFAULT_ON };")();

// Local-Storage-Einträge, wie sie die Datenschutzerklärung nennt
const KEYS = { game: "slfx-game", used: "slfx-used", decks: "slfx-decks", install: "slfx-install" };

const N = RULES.CATEGORIES_PER_ROUND;
const LETTERS = Object.keys(RULES.LETTER_WEIGHTS);
const WHEEL_LETTERS = LETTERS.filter((l) => RULES.LETTER_WEIGHTS[l] > 0);
const wheelModes = (nTeams) =>
  Object.keys(RULES.MODES).filter((k) => RULES.MODES[k].weight > 0 && nTeams >= (RULES.MODES[k].minTeams || 1));
const modeLabel = (k) => (RULES.MODES[k].seconds ? `${RULES.MODES[k].name} · ${RULES.MODES[k].seconds} s` : RULES.MODES[k].name);
const categoriesOf = (decks) => [...new Set(decks.flatMap((d) => DECKS[d]))];

// Dieselbe gewichtete Auswahl wie in app.js: ein Zufallswert, Gewichte der Reihe nach abziehen
function weightedPick(items, weightOf, random) {
  const total = items.reduce((s, it) => s + weightOf(it), 0);
  let x = random * total;
  for (const it of items) {
    x -= weightOf(it);
    if (x < 0) return it;
  }
  return items[items.length - 1];
}
const expectedLetter = (random, lastLetter = null) =>
  weightedPick(WHEEL_LETTERS.filter((l) => l !== lastLetter), (l) => RULES.LETTER_WEIGHTS[l], random);
const expectedMode = (random, nTeams) => weightedPick(wheelModes(nTeams), (k) => RULES.MODES[k].weight, random);

// Sammelt Konsolenfehler und fehlgeschlagene Requests einer Seite
function watchErrors(page) {
  const errors = [];
  page.on("console", (m) => {
    // Playwright blockiert den Service Worker in den Tests absichtlich (siehe Config)
    if (/Service Worker registration blocked by Playwright/.test(m.text())) return;
    if (m.type() === "error" || m.type() === "warning")
      errors.push(`${m.type()}: ${m.text()} @ ${m.location().url}`);
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

// Math.random auf einen festen Wert setzen; später per window.__random änderbar
async function fixRandom(page, value) {
  await page.addInitScript((v) => {
    window.__random = v;
    Math.random = () => window.__random;
  }, value);
}
const setRandom = (page, value) => page.evaluate((v) => (window.__random = v), value);

// ---------- Spielstand ----------
const readGame = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEYS.game);
const readUsed = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), KEYS.used);

function makeRound(o = {}) {
  const categories = o.categories || DECKS.Normal.slice(0, N);
  return {
    letter: "M",
    mode: "normal",
    endsAt: null,
    index: 0,
    terms: null,
    ...o,
    categories,
    done: o.done || categories.map(() => false),
    awards: o.awards || categories.map(() => null),
  };
}

// Vollständiger Spielstand mit sinnvollen Vorgaben
function makeGame(o = {}) {
  const n = o.teams || (o.names ? o.names.length : 2);
  const scores = o.scores || Array(n).fill(0);
  const names = o.names || Array.from({ length: n }, (_, i) => `Team ${i + 1}`);
  const roundNo = o.roundNo || 0;
  return {
    v: 1,
    teams: names.map((name, i) => ({ name, score: scores[i] })),
    target: o.target || RULES.DEFAULT_TARGET,
    decks: o.decks || ["Normal"],
    roundNo,
    current: roundNo % n,
    lastLetter: o.lastLetter || null,
    phase: o.phase || "turn",
    round: o.round || null,
  };
}

// Spielstand in den Speicher legen und die Seite neu laden
async function seedGame(page, game) {
  await page.goto("/index.html");
  await page.evaluate(([k, g]) => localStorage.setItem(k, JSON.stringify(g)), [KEYS.game, game]);
  await page.reload();
  return game;
}

// Spiel über die Oberfläche anlegen (Standard: 2 Teams, Vorgabe-Zielpunkte, Deck "Normal")
async function createGame(page, o = {}) {
  await page.goto("/index.html");
  if (o.decks) await page.evaluate(([k, d]) => localStorage.setItem(k, JSON.stringify(d)), [KEYS.decks, o.decks]);
  await page.reload();
  await page.click("#newBtn");
  const n = o.teams || (o.names ? o.names.length : 2);
  while ((await page.locator("#teams input").count()) < n) await page.click("#teamPlus");
  while ((await page.locator("#teams input").count()) > n) await page.click("#teamMinus");
  if (o.names) for (let i = 0; i < o.names.length; i++) await page.fill(`#team-${i}`, o.names[i]);
  if (o.target) await page.fill("#target", String(o.target));
  await page.click("#startBtn");
  await expect(page.locator("#turn.active")).toBeVisible();
}

// Von "Bereit" bis zur Walze und sofort zum Ergebnis (reduzierte Bewegung: keine Animation)
async function spinInstant(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (await page.locator("#turn.active").isVisible()) await page.click("#readyBtn");
  await page.click("#spinBtn");
  await expect(page.locator("#goBtn")).toBeVisible();
  return readGame(page);
}

// "Los" tippen und den Countdown mit beschleunigter Uhr durchlaufen (page.clock muss installiert sein)
async function startRound(page) {
  await page.click("#goBtn");
  await expect(page.locator("#countdown.active")).toBeVisible();
  await page.clock.runFor(RULES.COUNTDOWN_SECONDS * 1000);
}

// Liegt das Element vollständig im sichtbaren Bereich?
async function fits(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect().toJSON();
    if (el.textContent) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      r.left = t.left;
      r.right = t.right;
    }
    return {
      ok: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
      rect: [r.left, r.top, r.right, r.bottom].map(Math.round),
      viewport: [innerWidth, innerHeight],
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      lines: el.innerText.split("\n").length,
    };
  }, selector);
}

// Alle Kacheln: im Viewport, unterhalb der Punkteleiste, Text passt in die Kachel, Touch-Ziel
async function checkTiles(page) {
  return page.evaluate(() => {
    const bar = document.getElementById("scorebar").getBoundingClientRect();
    return [...document.querySelectorAll("#tiles .tile")].map((t) => {
      const r = t.getBoundingClientRect();
      const s = t.firstChild;
      return {
        text: s.textContent,
        inViewport: r.left >= 0 && r.top >= bar.bottom - 0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
        textFits: s.scrollHeight <= t.clientHeight + 0.5 && s.scrollWidth <= t.clientWidth + 0.5,
        height: r.height,
        width: r.width,
        rect: [r.left, r.top, r.right, r.bottom].map(Math.round),
      };
    });
  });
}

// Alle Dateien unter dir, rekursiv, relativ mit "/" als Trenner; Punkt-Dateien (.DS_Store) ausgenommen
function listFiles(dir, prefix = "") {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("."))
    .flatMap((e) =>
      e.isDirectory() ? listFiles(path.join(dir, e.name), prefix + e.name + "/") : [prefix + e.name],
    );
}

module.exports = {
  PUBLIC, RULES, DECKS, DEFAULT_ON, KEYS, N, LETTERS, WHEEL_LETTERS,
  wheelModes, modeLabel, categoriesOf, expectedLetter, expectedMode,
  watchErrors, fixRandom, setRandom, readGame, readUsed, makeRound, makeGame, seedGame, createGame,
  spinInstant, startRound, fits, checkTiles, listFiles,
};
