// Walzen: laufen beim Betreten von selbst an, Ergebnis unabhängig vom Stopp-Zeitpunkt,
// beide stoppen gemeinsam, Gewichte, kein Buchstabe doppelt in Folge, Reduced Motion, Auto-Stopp
const { test, expect } = require("@playwright/test");
const {
  RULES, WHEEL_LETTERS, LETTERS, DECKS, categoriesOf, wheelModes, modeLabel, expectedLetter, expectedMode,
  watchErrors, fixRandom, setRandom, readGame, makeGame, seedGame, spinInstant, reelOffset,
} = require("./helpers");

const W = RULES.WHEEL;
const RUNOUT_MS = W.MAX_RUNOUT_MS + 500;

// Spiel in den Rundenstart bringen (Walze noch nicht offen, Zufallswert kann noch gesetzt werden)
async function openTurn(page, game = makeGame()) {
  await seedGame(page, game);
  await page.click("#resumeBtn");
  await expect(page.locator("#turn.active")).toBeVisible();
}
async function openWheel(page, game) {
  await openTurn(page, game);
  await page.click("#readyBtn");
  await expect(page.locator("#wheel.active")).toBeVisible();
}
// Mittlere Zelle einer Walze: die Walze ist um (pos - 1) Zellen verschoben
const middleOf = (page, id) =>
  page.evaluate((id) => {
    const track = document.getElementById(id);
    const h = track.firstChild.offsetHeight;
    const y = -parseFloat(track.style.transform.match(/-?[\d.]+/)[0]);
    return track.children[Math.round(y / h) + 1].textContent;
  }, id);
const transformOf = (page, id) => page.evaluate((id) => document.getElementById(id).style.transform, id);

test.describe("Walze mit Animation", () => {
  test("beide Walzen laufen beim Betreten von selbst an, Button heißt „Stopp“", async ({ page }) => {
    await openTurn(page);
    await page.clock.install();
    await page.click("#readyBtn");
    await expect(page.locator("#spinBtn")).toHaveText("Stopp");
    await expect(page.locator("#spinBtn")).toBeEnabled();
    await expect(page.locator("#goBtn")).toBeHidden();
    const a = [await transformOf(page, "letterReel"), await transformOf(page, "modeReel")];
    await page.clock.runFor(200);
    const b = [await transformOf(page, "letterReel"), await transformOf(page, "modeReel")];
    expect(a[0]).not.toBe(b[0]);
    expect(a[1]).not.toBe(b[1]);
    expect((await readGame(page)).phase).toBe("wheel");
  });

  test("Buchstabe und Modus stehen beim Tipp auf „Stopp“ fest, egal wann getippt wird", async ({ page }) => {
    const random = 0.37;
    await fixRandom(page, random);
    const results = [];
    for (const delay of [200, 2500]) {
      await openTurn(page);
      await page.clock.install();
      await page.click("#readyBtn");
      await page.clock.runFor(delay);
      await page.click("#spinBtn");
      await expect(page.locator("#spinBtn")).toBeDisabled();
      await page.clock.runFor(RUNOUT_MS);
      await expect(page.locator("#goBtn")).toBeVisible();
      const game = await readGame(page);
      expect(game.phase).toBe("ready");
      results.push([game.round.letter, game.round.mode]);
    }
    expect(results).toEqual([
      [expectedLetter(random), expectedMode(random, 2)],
      [expectedLetter(random), expectedMode(random, 2)],
    ]);
  });

  test("beide Walzen laufen aus und halten gemeinsam auf dem Ergebnis", async ({ page }) => {
    await fixRandom(page, 0.6);
    await openTurn(page);
    await page.clock.install();
    await page.click("#readyBtn");
    await page.clock.runFor(500);
    await page.click("#spinBtn");
    // Während des Auslaufs bewegen sich beide noch, das Ergebnis ist aber noch nicht gespeichert
    await page.clock.runFor(W.MIN_RUNOUT_MS / 2);
    await expect(page.locator("#goBtn")).toBeHidden();
    const a = [await transformOf(page, "letterReel"), await transformOf(page, "modeReel")];
    await page.clock.runFor(100);
    const b = [await transformOf(page, "letterReel"), await transformOf(page, "modeReel")];
    expect(a[0]).not.toBe(b[0]);
    expect(a[1]).not.toBe(b[1]);
    await page.clock.runFor(RUNOUT_MS);
    await expect(page.locator("#goBtn")).toBeVisible();
    const game = await readGame(page);
    expect([await middleOf(page, "letterReel"), await middleOf(page, "modeReel")]).toEqual([game.round.letter, modeLabel(game.round.mode)]);
    // Ergebnis exakt in der Mitte, auch bei Zellhöhen mit Nachkommastellen
    expect(await reelOffset(page, "letterReel", game.round.letter)).toBeLessThan(1);
    expect(await reelOffset(page, "modeReel", modeLabel(game.round.mode))).toBeLessThan(1);
    await expect(page.locator("#wheelResult")).toContainText(game.round.letter + " – " + RULES.MODES[game.round.mode].name);
    await expect(page.locator("#wheelResult")).toContainText(RULES.MODES[game.round.mode].text);
    await expect(page.locator("#spinBtn")).toBeHidden();
  });

  test("Ergebnis steht in jeder Position exakt in der Mitte (hinten im Alphabet, Querformat, nach Drehung)", async ({ page }) => {
    // Zufallswert, der auf Z fällt: letzte Walzenposition, größter möglicher Rundungsfehler
    const total = WHEEL_LETTERS.reduce((s, l) => s + RULES.LETTER_WEIGHTS[l], 0);
    await fixRandom(page, (total - 0.5) / total);
    expect(expectedLetter((total - 0.5) / total)).toBe("Z");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openWheel(page);
    const game = await readGame(page);
    expect(game.round.letter).toBe("Z");
    expect(await reelOffset(page, "letterReel", "Z")).toBeLessThan(1);
    expect(await reelOffset(page, "modeReel", modeLabel(game.round.mode))).toBeLessThan(1);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    expect(await reelOffset(page, "letterReel", "Z")).toBeLessThan(1);
    expect(await reelOffset(page, "modeReel", modeLabel(game.round.mode))).toBeLessThan(1);
    // Nach Neuladen in Phase "ready" ebenso
    await page.reload();
    await page.click("#resumeBtn");
    await expect(page.locator("#goBtn")).toBeVisible();
    expect(await reelOffset(page, "letterReel", "Z")).toBeLessThan(1);
  });

  test("während der Drehung liegen die Zellen immer auf dem Raster der Markierung", async ({ page }) => {
    await openTurn(page);
    await page.clock.install();
    await page.click("#readyBtn");
    for (let i = 0; i < 5; i++) {
      await page.clock.runFor(137);
      const drift = await page.evaluate(() => {
        const box = document.querySelector(".reel-box").getBoundingClientRect();
        return ["letterReel", "modeReel"].map((id) => {
          const cells = [...document.getElementById(id).querySelectorAll(".cell")];
          // Die Zelle, die die Mitte überdeckt: ihr Versatz zur Mitte muss kleiner als eine halbe Zelle sein,
          // und die Zellhöhe muss zur Markierung (ein Drittel des Kastens) passen
          const mid = box.top + box.height / 2;
          const cell = cells.find((c) => { const r = c.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; }).getBoundingClientRect();
          return Math.abs(cell.height - (box.height - 6) / 3); // Kasten = drei Zellen plus Rahmen
        });
      });
      for (const d of drift) expect(d).toBeLessThan(1);
    }
  });

  test("ohne Tipp stoppt die Walze nach der Höchstdauer von selbst", async ({ page }) => {
    await fixRandom(page, 0.2);
    await openTurn(page);
    await page.clock.install();
    await page.click("#readyBtn");
    await page.clock.runFor(W.AUTO_STOP_MS - 100);
    await expect(page.locator("#spinBtn")).toBeEnabled();
    await page.clock.runFor(200);
    await expect(page.locator("#spinBtn")).toBeDisabled();
    await page.clock.runFor(RUNOUT_MS);
    await expect(page.locator("#goBtn")).toBeVisible();
    const game = await readGame(page);
    expect(game.round.letter).toBe(expectedLetter(0.2));
    expect(game.round.mode).toBe(expectedMode(0.2, 2));
  });

  test("Eck-Button während der Drehung: zur Startseite, Walze läuft nach „Weiterspielen“ neu", async ({ page }) => {
    await openWheel(page);
    await page.click("#quitBtn");
    await page.click("#confirmYes");
    await expect(page.locator("#home.active")).toBeVisible();
    expect((await readGame(page)).phase).toBe("wheel");
    await page.click("#resumeBtn");
    await expect(page.locator("#wheel.active")).toBeVisible();
    await expect(page.locator("#spinBtn")).toHaveText("Stopp");
  });
});

test.describe("Reduzierte Bewegung", () => {
  test("keine Animation, Ergebnis sofort beim Betreten der Walze", async ({ page }) => {
    await fixRandom(page, 0.8);
    const errors = watchErrors(page);
    await openTurn(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.click("#readyBtn");
    await expect(page.locator("#goBtn")).toBeVisible();
    await expect(page.locator("#spinBtn")).toBeHidden();
    const game = await readGame(page);
    expect(game.phase).toBe("ready");
    expect(game.round.letter).toBe(expectedLetter(0.8));
    expect(game.round.mode).toBe(expectedMode(0.8, 2));
    expect(game.round.categories).toHaveLength(RULES.CATEGORIES_PER_ROUND);
    expect([await middleOf(page, "letterReel"), await middleOf(page, "modeReel")]).toEqual([game.round.letter, modeLabel(game.round.mode)]);
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
    await page.emulateMedia({ reducedMotion: "reduce" });
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const r = (i + 0.5) / 40;
      await openTurn(page);
      await setRandom(page, r);
      await page.click("#readyBtn");
      await expect(page.locator("#goBtn")).toBeVisible();
      const game = await readGame(page);
      expect(game.round.letter, `random=${r}`).toBe(expectedLetter(r, null));
      seen.add(game.round.letter);
    }
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
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openWheel(page, makeGame({ lastLetter: "S" }));
    const game = await readGame(page);
    expect(game.round.letter).not.toBe("S");
    expect(game.round.letter).toBe(expectedLetter(r, "S"));
  });

  test("Modi folgen den Gewichten, Normal am häufigsten", async ({ page }) => {
    expect(RULES.MODES.normal.weight).toBeGreaterThan(Math.max(...Object.keys(RULES.MODES).filter((k) => k !== "normal").map((k) => RULES.MODES[k].weight)));
    await fixRandom(page, 0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const counts = {};
    for (let i = 0; i < 20; i++) {
      const r = (i + 0.5) / 20;
      await openTurn(page, makeGame({ teams: 3 }));
      await setRandom(page, r);
      await page.click("#readyBtn");
      await expect(page.locator("#goBtn")).toBeVisible();
      const m = (await readGame(page)).round.mode;
      expect(m, `random=${r}`).toBe(expectedMode(r, 3));
      counts[m] = (counts[m] || 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(wheelModes(3).sort());
    expect(counts.normal).toBeGreaterThan(Math.max(...Object.keys(counts).filter((k) => k !== "normal").map((k) => counts[k])));
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
      await openTurn(page, makeGame({ teams: 1 }));
      await setRandom(page, (i + 0.5) / 10);
      await page.click("#readyBtn");
      await expect(page.locator("#goBtn")).toBeVisible();
      expect((await readGame(page)).round.mode).not.toBe("everyone");
    }
    await openWheel(page, makeGame({ teams: 2 }));
    expect(await page.locator("#modeReel .cell").allTextContents()).toContain(modeLabel("everyone"));
  });

  test("Kategorien der Runde kommen aus den gewählten Decks, acht Stück, keine doppelt", async ({ page }) => {
    // Die Auswahl der Runde kommt von den Checkboxen am Rundenstart (letzte Auswahl im Speicher)
    await seedGame(page, makeGame());
    await page.evaluate(() => localStorage.setItem("slfx-decks", JSON.stringify(["Weihnachten"])));
    await page.click("#resumeBtn");
    await expect(page.locator('#decks input[value="Weihnachten"]')).toBeChecked();
    const game = await spinInstant(page);
    expect(game.decks).toEqual(["Weihnachten"]);
    expect(game.round.categories).toHaveLength(RULES.CATEGORIES_PER_ROUND);
    expect(new Set(game.round.categories).size).toBe(RULES.CATEGORIES_PER_ROUND);
    for (const c of game.round.categories) expect(categoriesOf(["Weihnachten"])).toContain(c);
    expect(DECKS.Weihnachten.length).toBeGreaterThanOrEqual(40);
  });
});
