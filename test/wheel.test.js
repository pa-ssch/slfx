// Buchstaben- und Moduswalze: Ergebnis unabhängig vom Stopp-Zeitpunkt, Gewichte,
// kein Buchstabe doppelt in Folge, Reduced-Motion-Pfad, Auto-Stopp
const { test, expect } = require("@playwright/test");
const {
  RULES, WHEEL_LETTERS, LETTERS, wheelModes, modeLabel, expectedLetter, expectedMode,
  watchErrors, fixRandom, setRandom, readGame, makeGame, seedGame, spinInstant,
} = require("./helpers");

const W = RULES.WHEEL;
// Längste mögliche Walzenfahrt: Auslauf der Buchstaben, freie Drehung und Auslauf der Modi
const LONGEST_MS = W.MAX_RUNOUT_MS + W.MODE_MAX_SPIN_MS + W.MAX_RUNOUT_MS + 500;

// Spiel in den Rundenstart bringen und die Walzen-Ansicht öffnen
async function openWheel(page, game = makeGame()) {
  await seedGame(page, game);
  await page.click("#resumeBtn");
  await page.click("#readyBtn");
  await expect(page.locator("#wheel.active")).toBeVisible();
}

test.describe("Walze mit Animation", () => {
  test("Buchstabe steht beim Tipp auf „Stopp“ fest, egal wann getippt wird", async ({ page }) => {
    const random = 0.37;
    await fixRandom(page, random);
    const results = [];
    for (const delay of [200, 2500]) {
      await openWheel(page);
      await page.clock.install();
      await page.click("#spinBtn");
      await expect(page.locator("#spinBtn")).toHaveText("Stopp");
      await page.clock.runFor(delay);
      await page.click("#spinBtn");
      await expect(page.locator("#spinBtn")).toBeDisabled();
      // Ergebnis ist schon gespeichert, bevor die Walze ausgelaufen ist? Nein: erst nach
      // beiden Walzen liegt die Runde im Speicher. Also bis zum Ende laufen lassen.
      await page.clock.runFor(LONGEST_MS);
      await expect(page.locator("#goBtn")).toBeVisible();
      const game = await readGame(page);
      expect(game.phase).toBe("ready");
      results.push(game.round.letter);
      expect(game.round.mode).toBe(expectedMode(random, 2));
    }
    expect(results).toEqual([expectedLetter(random), expectedLetter(random)]);
  });

  test("Walze zeigt am Ende den gezogenen Buchstaben und den Modus in der Mitte", async ({ page }) => {
    await fixRandom(page, 0.6);
    await openWheel(page);
    await page.clock.install();
    await page.click("#spinBtn");
    await page.clock.runFor(500);
    await page.click("#spinBtn");
    await page.clock.runFor(LONGEST_MS);
    const game = await readGame(page);
    // Mittlere Zelle: die Walze ist um (pos - 1) Zellen verschoben, pos = n + index
    const middle = await page.evaluate(() => {
      const mid = (id) => {
        const track = document.getElementById(id);
        const h = track.firstChild.offsetHeight;
        const y = -parseFloat(track.style.transform.match(/-?[\d.]+/)[0]);
        return track.children[Math.round(y / h) + 1].textContent;
      };
      return [mid("letterReel"), mid("modeReel")];
    });
    expect(middle).toEqual([game.round.letter, modeLabel(game.round.mode)]);
    await expect(page.locator("#wheelResult")).toContainText(game.round.letter + " – " + RULES.MODES[game.round.mode].name);
    await expect(page.locator("#wheelResult")).toContainText(RULES.MODES[game.round.mode].text);
  });

  test("ohne Tipp stoppt die Walze nach der Höchstdauer von selbst", async ({ page }) => {
    await fixRandom(page, 0.2);
    await openWheel(page);
    await page.clock.install();
    await page.click("#spinBtn");
    await page.clock.runFor(W.AUTO_STOP_MS - 100);
    await expect(page.locator("#spinBtn")).toHaveText("Stopp");
    await expect(page.locator("#spinBtn")).toBeEnabled();
    await page.clock.runFor(200);
    await expect(page.locator("#spinBtn")).toBeDisabled();
    await page.clock.runFor(LONGEST_MS);
    await expect(page.locator("#goBtn")).toBeVisible();
    expect((await readGame(page)).round.letter).toBe(expectedLetter(0.2));
  });

  test("Moduswalze läuft nach der Buchstabenwalze von selbst an, kein weiterer Tipp nötig", async ({ page }) => {
    await fixRandom(page, 0.5);
    await openWheel(page);
    await page.clock.install();
    await page.click("#spinBtn");
    await page.clock.runFor(300);
    await page.click("#spinBtn");
    await page.clock.runFor(W.MAX_RUNOUT_MS + 50);
    await expect(page.locator("#wheelResult")).toHaveText(/^Buchstabe [A-Z]$/);
    await expect(page.locator("#goBtn")).toBeHidden();
    const moving = await page.evaluate(async () => {
      const t = document.getElementById("modeReel");
      const a = t.style.transform;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return a !== t.style.transform;
    });
    expect(moving).toBe(true);
    await page.clock.runFor(LONGEST_MS);
    await expect(page.locator("#goBtn")).toBeVisible();
  });
});

test.describe("Reduzierte Bewegung", () => {
  test("keine Animation, Ergebnis sofort nach „Drehen“", async ({ page }) => {
    await fixRandom(page, 0.8);
    const errors = watchErrors(page);
    await openWheel(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.click("#spinBtn");
    await expect(page.locator("#goBtn")).toBeVisible();
    await expect(page.locator("#spinBtn")).toBeHidden();
    const game = await readGame(page);
    expect(game.phase).toBe("ready");
    expect(game.round.letter).toBe(expectedLetter(0.8));
    expect(game.round.mode).toBe(expectedMode(0.8, 2));
    expect(game.round.categories).toHaveLength(RULES.CATEGORIES_PER_ROUND);
    expect(errors).toEqual([]);
  });
});

test.describe("Gewichte und Ausschlüsse", () => {
  test("Buchstaben mit Gewicht 0 stehen nicht auf der Walze, alle anderen dreimal", async ({ page }) => {
    await openWheel(page);
    const cells = await page.locator("#letterReel .cell").allTextContents();
    expect(cells).toEqual([...WHEEL_LETTERS, ...WHEEL_LETTERS, ...WHEEL_LETTERS]);
    for (const l of LETTERS.filter((l) => RULES.LETTER_WEIGHTS[l] === 0)) expect(cells).not.toContain(l);
    expect(RULES.LETTER_WEIGHTS.Q).toBe(0);
    expect(RULES.LETTER_WEIGHTS.X).toBe(0);
    expect(RULES.LETTER_WEIGHTS.Y).toBe(0);
  });

  test("Buchstabe folgt den Gewichten (gleicher Zufallswert, gleiche Antwort wie die Regeltabelle)", async ({ page }) => {
    await fixRandom(page, 0);
    await openWheel(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Über den Zufallsbereich fahren: jeder Wert landet im Buchstaben, den die Gewichte vorgeben
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const r = (i + 0.5) / 40;
      await setRandom(page, r);
      await page.click("#spinBtn");
      await expect(page.locator("#goBtn")).toBeVisible();
      const game = await readGame(page);
      expect(game.round.letter, `random=${r}`).toBe(expectedLetter(r, null));
      seen.add(game.round.letter);
      await page.click("#quitBtn");
      await page.click("#confirmYes");
      await openWheel(page);
    }
    // Häufige Buchstaben kommen vor, seltene mit kleinem Gewicht nicht zwingend
    for (const l of ["S", "K", "B", "H", "M"]) expect([...seen]).toContain(l);
    expect(seen.has("Q") || seen.has("X") || seen.has("Y")).toBe(false);
  });

  test("nicht derselbe Buchstabe wie in der Vorrunde", async ({ page }) => {
    // Zufallswert, der ohne Ausschluss auf S fiele
    const total = WHEEL_LETTERS.reduce((s, l) => s + RULES.LETTER_WEIGHTS[l], 0);
    const before = WHEEL_LETTERS.slice(0, WHEEL_LETTERS.indexOf("S")).reduce((s, l) => s + RULES.LETTER_WEIGHTS[l], 0);
    const r = (before + 0.5) / total;
    expect(expectedLetter(r, null)).toBe("S");
    await fixRandom(page, r);
    await openWheel(page, makeGame({ lastLetter: "S" }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.click("#spinBtn");
    const game = await readGame(page);
    expect(game.round.letter).not.toBe("S");
    expect(game.round.letter).toBe(expectedLetter(r, "S"));
  });

  test("Modi folgen den Gewichten, Normal am häufigsten", async ({ page }) => {
    expect(RULES.MODES.normal.weight).toBeGreaterThan(Math.max(...Object.keys(RULES.MODES).filter((k) => k !== "normal").map((k) => RULES.MODES[k].weight)));
    await fixRandom(page, 0);
    await openWheel(page, makeGame({ teams: 3 }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const counts = {};
    for (let i = 0; i < 20; i++) {
      const r = (i + 0.5) / 20;
      await setRandom(page, r);
      await page.click("#spinBtn");
      await expect(page.locator("#goBtn")).toBeVisible();
      const m = (await readGame(page)).round.mode;
      expect(m, `random=${r}`).toBe(expectedMode(r, 3));
      counts[m] = (counts[m] || 0) + 1;
      await page.click("#quitBtn");
      await page.click("#confirmYes");
      await openWheel(page, makeGame({ teams: 3 }));
    }
    expect(Object.keys(counts).sort()).toEqual(wheelModes(3).sort());
    expect(counts.normal).toBeGreaterThan(Math.max(counts.double, counts.allornothing, counts.everyone));
  });

  test("bei einem Team steht „Alle raten mit“ nicht auf der Walze und wird nie gezogen", async ({ page }) => {
    expect(RULES.MODES.everyone.minTeams).toBe(2);
    await fixRandom(page, 0);
    await openWheel(page, makeGame({ teams: 1 }));
    const cells = await page.locator("#modeReel .cell").allTextContents();
    expect(cells).not.toContain(modeLabel("everyone"));
    expect(cells.slice(0, cells.length / 3)).toEqual(wheelModes(1).map(modeLabel));
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (let i = 0; i < 10; i++) {
      await setRandom(page, (i + 0.5) / 10);
      await page.click("#spinBtn");
      expect((await readGame(page)).round.mode).not.toBe("everyone");
      await page.click("#quitBtn");
      await page.click("#confirmYes");
      await openWheel(page, makeGame({ teams: 1 }));
    }
    // Mit zwei Teams ist der Modus dabei
    await openWheel(page, makeGame({ teams: 2 }));
    expect(await page.locator("#modeReel .cell").allTextContents()).toContain(modeLabel("everyone"));
  });

  test("Kategorien der Runde kommen aus den gewählten Decks, acht Stück, keine doppelt", async ({ page }) => {
    const { DECKS, categoriesOf } = require("./helpers");
    await openWheel(page, makeGame({ decks: ["Weihnachten"] }));
    const game = await spinInstant(page);
    expect(game.round.categories).toHaveLength(RULES.CATEGORIES_PER_ROUND);
    expect(new Set(game.round.categories).size).toBe(RULES.CATEGORIES_PER_ROUND);
    for (const c of game.round.categories) expect(categoriesOf(["Weihnachten"])).toContain(c);
    expect(DECKS.Weihnachten.length).toBeGreaterThanOrEqual(40);
  });
});
