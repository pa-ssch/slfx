// Neuladen mitten im Spiel, kaputter Speicher, keine Wiederholung der Kategorien
const { test, expect } = require("@playwright/test");
const { RULES, N, DECKS, KEYS, watchErrors, readGame, readUsed, makeGame, makeRound, seedGame, createGame, selectDecks, spinInstant } = require("./helpers");

const CATS = DECKS.Normal.slice(0, N);

test.describe("Neuladen", () => {
  test("mitten in der Runde: zurück in die Runde mit Restzeit und Markierungen", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/index.html");
    const endsAt = (await page.evaluate(() => Date.now())) + 20000;
    await page.evaluate(([k, g]) => localStorage.setItem(k, JSON.stringify(g)), [
      KEYS.game,
      makeGame({ phase: "play", round: makeRound({ categories: CATS, mode: "normal", endsAt, done: [true, false, true, false, false, false, false, false] }) }),
    ]);
    await page.reload();
    await expect(page.locator("#play.active")).toBeVisible(); // direkt, ohne Startseite
    const left = Number(await page.locator("#timer").textContent());
    expect(left).toBeGreaterThan(15);
    expect(left).toBeLessThanOrEqual(20);
    await expect(page.locator("#tiles .tile").nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#tiles .tile").nth(1)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#tiles .tile").nth(2)).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });

  test("Zeit beim Neuladen schon abgelaufen: Punkteansicht mit den Markierungen", async ({ page }) => {
    await seedGame(page, makeGame({ phase: "play", round: makeRound({ categories: CATS, mode: "short", endsAt: 1000, done: [true, true, false, false, false, false, false, false] }) }));
    await expect(page.locator("#score.active")).toBeVisible();
    await expect(page.locator("#scoreValue")).toHaveText(`2 von ${N}`);
    await expect(page.locator("#scorePoints")).toHaveText("+2 Punkte");
    expect((await readGame(page)).phase).toBe("score");
  });

  test("„Alle raten mit“: beim aktuellen Begriff weiter, vergebene Punkte bleiben", async ({ page }) => {
    await seedGame(page, makeGame({ names: ["A", "B"], scores: [2, 0], phase: "play", round: makeRound({ categories: CATS, mode: "everyone", index: 3, awards: [0, 0, null, null, null, null, null, null] }) }));
    await expect(page.locator("#everyone.active")).toBeVisible();
    await expect(page.locator("#evProgress")).toHaveText(`4 von ${N}`);
    await expect(page.locator("#evWord")).toHaveText(CATS[3]);
    expect(await page.locator("#scores .chip .pts").allTextContents()).toEqual(["2", "0"]);
  });

  test("nach den Walzen (ready): Walzen stehen auf dem Ergebnis, „Los“ sichtbar", async ({ page }) => {
    await seedGame(page, makeGame({ phase: "ready", round: makeRound({ categories: CATS, letter: "H", mode: "long" }) }));
    await page.click("#resumeBtn");
    await expect(page.locator("#wheel.active")).toBeVisible();
    await expect(page.locator("#goBtn")).toBeVisible();
    await expect(page.locator("#spinBtn")).toBeHidden();
    await expect(page.locator("#wheelResult")).toContainText("H – Gemütlich");
    const game = await readGame(page);
    expect(game.round.letter).toBe("H");
    expect(game.round.categories).toEqual(CATS);
  });

  test("während der Walze (wheel): Rundenstart desselben Teams, Walze neu", async ({ page }) => {
    await seedGame(page, makeGame({ names: ["A", "B"], roundNo: 3, phase: "wheel" }));
    await page.click("#resumeBtn");
    await expect(page.locator("#wheel.active")).toBeVisible();
    await expect(page.locator("#spinBtn")).toHaveText("Stopp");
    await expect(page.locator("#spinBtn")).toBeEnabled();
    await expect(page.locator("#goBtn")).toBeHidden();
    expect((await readGame(page)).current).toBe(1);
  });

  test("in der Punkteansicht: Punkte erneut bestätigen, nichts geht verloren", async ({ page }) => {
    await seedGame(page, makeGame({ scores: [5, 6], phase: "score", round: makeRound({ categories: CATS, mode: "normal", terms: 4, done: [true, true, false, false, false, false, false, false] }) }));
    await page.click("#resumeBtn");
    await expect(page.locator("#score.active")).toBeVisible();
    await expect(page.locator("#scoreValue")).toHaveText(`4 von ${N}`); // korrigierter Wert bleibt
    await page.click("#scoreBtn");
    expect((await readGame(page)).teams.map((t) => t.score)).toEqual([9, 6]);
  });

  test("Spielende bleibt erhalten", async ({ page }) => {
    await seedGame(page, makeGame({ scores: [25, 3], phase: "end" }));
    await expect(page.locator("#home.active")).toBeVisible();
    await expect(page.locator("#resumeBtn")).toBeHidden();
  });
});

test.describe("Kaputter Speicher", () => {
  const BAD = ["null", "5", "{}", '"text"', "[1,2]", "[null]", "{kaputt", "", "[]", JSON.stringify(Array(5000).fill("x")), JSON.stringify({ v: 1, teams: "x" }), JSON.stringify({ v: 2, teams: [{ name: "A", score: 1 }] })];

  for (const key of Object.values(KEYS)) {
    test(`${key}: Spiel anlegen und spielen funktioniert trotzdem`, async ({ page }) => {
      for (const bad of BAD) {
        const label = `${key}=${bad.slice(0, 30)}`;
        const errors = watchErrors(page);
        await page.goto("/index.html");
        await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, bad]);
        await page.reload();
        await expect(page.locator("#home.active"), label).toBeVisible();
        await page.click("#newBtn");
        if (await page.locator("#confirm").isVisible()) await page.click("#confirmYes");
        await page.click("#startBtn");
        await expect(page.locator("#turn.active"), label).toBeVisible();
        const game = await spinInstant(page);
        expect(game.round.categories, label).toHaveLength(N);
        const used = await readUsed(page);
        expect(Array.isArray(used) && used.every((c) => typeof c === "string"), label).toBe(true);
        expect(errors, label).toEqual([]);
        await page.evaluate(() => localStorage.clear());
      }
    });
  }

  test("kaputte Runde im Spielstand: Punkte bleiben, Rundenstart desselben Teams", async ({ page }) => {
    const errors = watchErrors(page);
    for (const round of [{ letter: "?", mode: "normal" }, { letter: "A", mode: "gibtEsNicht" }, { letter: "A", mode: "normal", categories: [] }, "müll", 42]) {
      await seedGame(page, { ...makeGame({ names: ["Füchse", "Hasen"], scores: [11, 7], roundNo: 3, phase: "play" }), round });
      await expect(page.locator("#home.active")).toBeVisible();
      await page.click("#resumeBtn");
      await expect(page.locator("#turn.active")).toBeVisible();
      await expect(page.locator("#turnTeam")).toHaveText("Hasen ist dran");
      expect(await page.locator("#scores .chip .pts").allTextContents()).toEqual(["11", "7"]);
    }
    expect(errors).toEqual([]);
  });

  test("unsinnige Werte werden auf gültige Werte gezogen", async ({ page }) => {
    await seedGame(page, { v: 1, teams: [{ name: "   ", score: -3 }, { name: "x".repeat(50), score: 2.5 }], target: 2, decks: ["Nope"], roundNo: -1, phase: "fliegen", round: null });
    await page.click("#resumeBtn");
    const game = await readGame(page);
    expect(game.teams).toEqual([{ name: "Team 1", score: 0 }, { name: "x".repeat(RULES.MAX_NAME_LENGTH), score: 0 }]);
    expect(game.target).toBe(RULES.DEFAULT_TARGET);
    expect(game.decks).toEqual(["Normal"]);
    expect(game.phase).toBe("turn");
  });

  test("fehlende decks.js ergibt eine verständliche Meldung", async ({ page }) => {
    await page.route("**/decks.js", (r) => r.fulfill({ status: 404, body: "" }));
    await page.goto("/index.html");
    await expect(page.locator("body")).toContainText("decks.js konnte nicht geladen werden");
  });
});

test.describe("Keine Wiederholung der Kategorien", () => {
  test("Kategorien eines Decks kommen erst alle einmal dran, dann fängt es von vorn an", async ({ page }) => {
    const deck = "Weihnachten";
    const all = DECKS[deck];
    const fullRounds = Math.floor(all.length / N);
    await createGame(page);
    const drawn = [];
    for (let r = 0; r < fullRounds; r++) {
      await selectDecks(page, [deck]);
      const game = await spinInstant(page);
      expect(new Set(game.round.categories).size, `Runde ${r + 1}`).toBe(N);
      drawn.push(...game.round.categories);
      expect(new Set(drawn).size, `Runde ${r + 1}: Wiederholung`).toBe(drawn.length);
      // Runde abbrechen: zurück zum Rundenstart, Merker bleibt
      await page.evaluate(([k, g]) => localStorage.setItem(k, JSON.stringify({ ...g, phase: "turn", round: null })), [KEYS.game, game]);
      await page.reload();
      await page.click("#resumeBtn");
    }
    expect((await readUsed(page)).length).toBe(fullRounds * N);
    for (const c of drawn) expect(all).toContain(c);
    // Rest reicht nicht mehr für acht: Rest plus Auffüllung aus dem zurückgesetzten Pool
    const rest = all.filter((c) => !drawn.includes(c));
    await selectDecks(page, [deck]);
    const game = await spinInstant(page);
    expect(new Set(game.round.categories).size).toBe(N);
    for (const c of rest) expect(game.round.categories).toContain(c);
    expect((await readUsed(page)).length).toBe(N);
  });
});
