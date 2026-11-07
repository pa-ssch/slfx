// Runde spielen: Countdown, Kacheln, Timer, jede Modus-Logik, Punkte, Spielende
const { test, expect } = require("@playwright/test");
const { RULES, N, DECKS, KEYS, watchErrors, readGame, makeGame, makeRound, seedGame, startRound, checkTiles } = require("./helpers");

const M = RULES.MODES;
const CATS = DECKS.Normal.slice(0, N);

// Spiel mit fertiger Walze ("ready") laden und per "Los" in die Runde gehen
async function playRound(page, game) {
  await seedGame(page, game);
  await page.click("#resumeBtn");
  await expect(page.locator("#wheel.active")).toBeVisible();
  await expect(page.locator("#goBtn")).toBeVisible();
  await page.clock.install();
  await startRound(page);
}
const ready = ({ round, ...o } = {}) => makeGame({ phase: "ready", ...o, round: makeRound({ categories: CATS, ...round }) });
const tile = (page, i) => page.locator("#tiles .tile").nth(i);
const points = (page) => page.locator("#scores .chip .pts").allTextContents();

test.describe("Countdown und Runde", () => {
  test("Countdown zählt 3-2-1, dann Buchstabe, Timer und acht Kacheln", async ({ page }) => {
    const errors = watchErrors(page);
    await seedGame(page, ready({ round: { letter: "K", mode: "normal" } }));
    await page.click("#resumeBtn");
    await page.clock.install();
    await page.click("#goBtn");
    await expect(page.locator("#countdown.active")).toBeVisible();
    await expect(page.locator("#countNum")).toHaveText("3");
    await page.clock.runFor(1000);
    await expect(page.locator("#countNum")).toHaveText("2");
    await page.clock.runFor(1000);
    await expect(page.locator("#countNum")).toHaveText("1");
    await page.clock.runFor(1000);
    await expect(page.locator("#play.active")).toBeVisible();
    await expect(page.locator("#playLetter")).toHaveText("K");
    await expect(page.locator("#timer")).toHaveText(String(M.normal.seconds));
    await expect(page.locator("#tiles .tile")).toHaveCount(N);
    expect(await page.locator("#tiles .tile-text").allTextContents()).toEqual(CATS);
    const game = await readGame(page);
    expect(game.phase).toBe("play");
    expect(game.round.endsAt).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("Kacheln: antippen markiert, nochmal hebt auf, wird gespeichert, Touch-Ziel ≥ 44 px", async ({ page }) => {
    await playRound(page, ready());
    await expect(tile(page, 2)).toHaveAttribute("aria-pressed", "false");
    await tile(page, 2).click();
    await expect(tile(page, 2)).toHaveAttribute("aria-pressed", "true");
    await tile(page, 5).click();
    expect((await readGame(page)).round.done).toEqual([false, false, true, false, false, true, false, false]);
    await tile(page, 2).click();
    await expect(tile(page, 2)).toHaveAttribute("aria-pressed", "false");
    expect((await readGame(page)).round.done[2]).toBe(false);
    for (const t of await checkTiles(page)) {
      expect(t.height, t.text).toBeGreaterThanOrEqual(44);
      expect(t.width, t.text).toBeGreaterThanOrEqual(44);
    }
  });

  test("Timer: letzte Sekunden hervorgehoben, am Ende Vibration, Kacheln eingefroren, „Weiter“", async ({ page }) => {
    await page.addInitScript(() => {
      window.__vibrations = [];
      navigator.vibrate = (p) => {
        window.__vibrations.push(p);
        return true;
      };
    });
    await playRound(page, ready({ round: { mode: "normal" } }));
    await tile(page, 0).click();
    const s = M.normal.seconds;
    await page.clock.runFor((s - RULES.URGENT_SECONDS - 1) * 1000);
    await expect(page.locator("#timer")).toHaveText(String(RULES.URGENT_SECONDS + 1));
    await expect(page.locator("#timer")).not.toHaveClass(/urgent/);
    await page.clock.runFor(1000);
    await expect(page.locator("#timer")).toHaveText(String(RULES.URGENT_SECONDS));
    await expect(page.locator("#timer")).toHaveClass(/urgent/);
    await page.clock.runFor(RULES.URGENT_SECONDS * 1000 + 250);
    await expect(page.locator("#timer")).toHaveText("Zeit!");
    await expect(page.locator("#doneBtn")).toBeVisible();
    expect(await page.evaluate(() => window.__vibrations.length)).toBe(1);
    // Kacheln eingefroren: Tipp ändert nichts mehr
    await expect(tile(page, 1)).toBeDisabled();
    await page.evaluate(() => document.querySelectorAll("#tiles .tile")[1].click());
    expect((await readGame(page)).round.done).toEqual([true, false, false, false, false, false, false, false]);
    expect((await readGame(page)).phase).toBe("score");
    await page.click("#doneBtn");
    await expect(page.locator("#score.active")).toBeVisible();
  });
});

test.describe("Vor Ablauf der Zeit fertig", () => {
  test("„Fertig“ beendet die Runde sofort mit den markierten Kacheln", async ({ page }) => {
    await playRound(page, ready({ round: { mode: "normal" } }));
    await expect(page.locator("#doneBtn")).toHaveText("Fertig");
    for (const i of [1, 2, 6]) await tile(page, i).click();
    await page.clock.runFor(10000);
    await page.click("#doneBtn");
    await expect(page.locator("#score.active")).toBeVisible();
    await expect(page.locator("#scoreValue")).toHaveText(`3 von ${N}`);
    const game = await readGame(page);
    expect(game.phase).toBe("score");
    expect(game.round.terms).toBe(3);
    await page.clock.runFor(120000); // der alte Timer darf nichts mehr tun
    await expect(page.locator("#score.active")).toBeVisible();
    await page.click("#scoreBtn");
    expect(await points(page)).toEqual(["3", "0"]);
  });

  test("„Fertig“ bei Alles oder nichts ohne alle acht: null Punkte", async ({ page }) => {
    await playRound(page, ready({ round: { mode: "allornothing" } }));
    await tile(page, 0).click();
    await page.click("#doneBtn");
    await expect(page.locator("#scorePoints")).toHaveText("0 Punkte");
  });

  test("Neuladen in der Runde: „Fertig“ bleibt verfügbar", async ({ page }) => {
    await playRound(page, ready({ round: { mode: "double" } }));
    await tile(page, 0).click();
    await page.reload();
    await expect(page.locator("#play.active")).toBeVisible();
    await expect(page.locator("#doneBtn")).toHaveText("Fertig");
    await page.click("#doneBtn");
    await expect(page.locator("#scorePoints")).toHaveText("+2 Punkte");
  });
});

test.describe("Modus Normal und Doppelt", () => {
  for (const key of ["normal", "double"]) {
    test(`${M[key].name}: ${M[key].points} Punkt(e) je Begriff, vorbelegt aus den Kacheln, korrigierbar`, async ({ page }) => {
      await playRound(page, ready({ names: ["Füchse", "Hasen"], round: { mode: key } }));
      await expect(page.locator("#timer")).toHaveText(String(M[key].seconds));
      for (const i of [0, 3, 4]) await tile(page, i).click();
      await page.clock.runFor(M[key].seconds * 1000 + 250);
      await page.click("#doneBtn");
      await expect(page.locator("#scoreTitle")).toHaveText("Füchse");
      await expect(page.locator("#scoreValue")).toHaveText(`3 von ${N}`);
      await expect(page.locator("#scorePoints")).toHaveText(`+${3 * M[key].points} Punkte`);
      await page.click("#scorePlus");
      await expect(page.locator("#scoreValue")).toHaveText(`4 von ${N}`);
      await expect(page.locator("#scorePoints")).toHaveText(`+${4 * M[key].points} Punkte`);
      await page.click("#scoreMinus");
      await page.click("#scoreMinus");
      await expect(page.locator("#scoreValue")).toHaveText(`2 von ${N}`);
      expect((await readGame(page)).round.terms).toBe(2);
      await page.click("#scoreBtn");
      await expect(page.locator("#turn.active")).toBeVisible();
      await expect(page.locator("#turnTeam")).toHaveText("Hasen ist dran");
      expect(await points(page)).toEqual([String(2 * M[key].points), "0"]);
      const game = await readGame(page);
      expect(game).toMatchObject({ roundNo: 1, current: 1, lastLetter: "M", phase: "turn", round: null });
      expect(game.teams[0].score).toBe(2 * M[key].points);
    });
  }

  test("Stepper läuft nicht unter 0 und nicht über acht", async ({ page }) => {
    await playRound(page, ready({ round: { mode: "normal" } }));
    await page.clock.runFor(M.normal.seconds * 1000 + 250);
    await page.click("#doneBtn");
    await expect(page.locator("#scoreMinus")).toBeDisabled();
    for (let i = 0; i < N + 2; i++) if (await page.locator("#scorePlus").isEnabled()) await page.click("#scorePlus");
    await expect(page.locator("#scoreValue")).toHaveText(`${N} von ${N}`);
    await expect(page.locator("#scorePlus")).toBeDisabled();
  });
});

test.describe("Modus Alles oder nichts", () => {
  test("alle acht vor Ablauf: Timer stoppt sofort, Bonus", async ({ page }) => {
    await playRound(page, ready({ round: { mode: "allornothing" } }));
    for (let i = 0; i < N - 1; i++) await tile(page, i).click();
    await page.clock.runFor(10000);
    await expect(page.locator("#timer")).toHaveText(String(M.allornothing.seconds - 10));
    await tile(page, N - 1).click();
    await expect(page.locator("#timer")).toHaveText("Geschafft!");
    await expect(page.locator("#doneBtn")).toBeVisible();
    const before = (await readGame(page)).phase;
    expect(before).toBe("score");
    await page.clock.runFor(60000); // Timer darf nichts mehr tun
    await expect(page.locator("#timer")).toHaveText("Geschafft!");
    await page.click("#doneBtn");
    await expect(page.locator("#scoreStepper")).toBeHidden();
    await expect(page.locator("#scorePoints")).toHaveText(`+${M.allornothing.bonus} Punkte`);
    await expect(page.locator("#scoreBtn")).toHaveText("Bestätigen");
    await page.click("#scoreBtn");
    expect(await points(page)).toEqual([String(M.allornothing.bonus), "0"]);
  });

  test("nicht alle acht: null Punkte", async ({ page }) => {
    await playRound(page, ready({ round: { mode: "allornothing" } }));
    for (let i = 0; i < N - 1; i++) await tile(page, i).click();
    await page.clock.runFor(M.allornothing.seconds * 1000 + 250);
    await expect(page.locator("#timer")).toHaveText("Zeit!");
    await page.click("#doneBtn");
    await expect(page.locator("#scorePoints")).toHaveText("0 Punkte");
    await expect(page.locator("#scoreInfo")).toContainText(`${N - 1} von ${N}`);
    await page.click("#scoreBtn");
    expect(await points(page)).toEqual(["0", "0"]);
  });
});

test.describe("Modus Alle raten mit", () => {
  test("kein Timer, Begriffe einzeln groß, Tipp auf ein Team gibt den Punkt sofort, Überspringen", async ({ page }) => {
    const errors = watchErrors(page);
    await playRound(page, ready({ names: ["Füchse", "Hasen", "Igel"], round: { mode: "everyone", letter: "B" } }));
    await expect(page.locator("#everyone.active")).toBeVisible();
    await expect(page.locator("#evLetter")).toHaveText("B");
    await expect(page.locator("#evProgress")).toHaveText(`1 von ${N}`);
    await expect(page.locator("#evWord")).toHaveText(CATS[0]);
    await expect(page.locator("#evTeams .btn")).toHaveText(["Füchse", "Hasen", "Igel"]);
    await page.click("#evTeams .btn >> nth=1");
    expect(await points(page)).toEqual(["0", "1", "0"]);
    await expect(page.locator("#evProgress")).toHaveText(`2 von ${N}`);
    await expect(page.locator("#evWord")).toHaveText(CATS[1]);
    await page.click("#evSkip");
    await expect(page.locator("#evProgress")).toHaveText(`3 von ${N}`);
    let game = await readGame(page);
    expect(game.round.awards.slice(0, 2)).toEqual([1, null]);
    expect(game.round.endsAt).toBeNull();
    await page.clock.runFor(120000); // keine Uhr: nichts passiert
    await expect(page.locator("#everyone.active")).toBeVisible();
    for (let i = 2; i < N; i++) await page.click("#evTeams .btn >> nth=" + (i % 3));
    await expect(page.locator("#score.active")).toBeVisible();
    await expect(page.locator("#scoreSummary li")).toHaveText(["Füchse: +2", "Hasen: +3", "Igel: +2"]);
    await expect(page.locator("#scoreStepper")).toBeHidden();
    await expect(page.locator("#scoreBtn")).toHaveText("Weiter");
    await page.click("#scoreBtn");
    game = await readGame(page);
    expect(game.teams.map((t) => t.score)).toEqual([2, 3, 2]);
    expect(game.current).toBe(1);
    await expect(page.locator("#turnTeam")).toHaveText("Hasen ist dran");
    expect(errors).toEqual([]);
  });

  test("bei einem Team wird eine gespeicherte Runde dieses Modus verworfen", async ({ page }) => {
    await seedGame(page, ready({ teams: 1, scores: [7], round: { mode: "everyone" } }));
    await page.click("#resumeBtn");
    await expect(page.locator("#turn.active")).toBeVisible();
    const game = await readGame(page);
    expect(game.teams[0].score).toBe(7);
    expect(game.round).toBeNull();
  });
});

test.describe("Spielende", () => {
  test("Zielpunkte erreicht: Durchgang wird zu Ende gespielt, dann Rangliste", async ({ page }) => {
    // Team 1 hat 18, Ziel 20, Team 2 noch nicht dran in diesem Durchgang
    await playRound(page, ready({ names: ["Füchse", "Hasen"], scores: [18, 10], target: 20, roundNo: 2, round: { mode: "normal", done: [true, true, true, false, false, false, false, false] } }));
    await page.clock.runFor(M.normal.seconds * 1000 + 250);
    await page.click("#doneBtn");
    await page.click("#scoreBtn");
    await expect(page.locator("#turn.active")).toBeVisible(); // noch kein Ende
    expect(await points(page)).toEqual(["21", "10"]);
    await page.click("#readyBtn");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.click("#spinBtn");
    await startRound(page);
    if (await page.locator("#everyone.active").isVisible()) {
      for (let i = 0; i < N; i++) await page.click("#evSkip");
    } else {
      await page.clock.runFor(70000);
      await page.click("#doneBtn");
    }
    await page.click("#scoreBtn");
    await expect(page.locator("#end.active")).toBeVisible();
    await expect(page.locator("#endTitle")).toHaveText("Füchse gewinnt!");
    const items = await page.locator("#ranking li").allTextContents();
    expect(items[0]).toMatch(/^Füchse – 21 Punkte$/);
    expect(items[1]).toMatch(/^Hasen – \d+ Punkte$/);
    await expect(page.locator("#ranking li").first()).toHaveClass(/winner/);
    expect((await readGame(page)).phase).toBe("end");
  });

  test("Gleichstand ist ein geteilter Sieg", async ({ page }) => {
    await playRound(page, ready({ names: ["Füchse", "Hasen", "Igel"], scores: [20, 15, 20], target: 20, roundNo: 5, round: { mode: "normal" } }));
    await page.clock.runFor(M.normal.seconds * 1000 + 250);
    await page.click("#doneBtn");
    await page.click("#scoreBtn");
    await expect(page.locator("#end.active")).toBeVisible();
    await expect(page.locator("#endTitle")).toHaveText("Geteilter Sieg: Füchse und Igel");
    await expect(page.locator("#ranking li.winner")).toHaveCount(2);
  });

  test("ein Team allein: Ende mit Punktestand", async ({ page }) => {
    await playRound(page, ready({ teams: 1, scores: [19], target: 20, round: { mode: "normal", done: [true, false, false, false, false, false, false, false] } }));
    await page.clock.runFor(M.normal.seconds * 1000 + 250);
    await page.click("#doneBtn");
    await page.click("#scoreBtn");
    await expect(page.locator("#endTitle")).toHaveText("Team 1: 20 Punkte!");
  });

  test("„Nochmal mit denselben Teams“ setzt Punkte zurück, „Neues Spiel“ öffnet das Anlegen vorbelegt", async ({ page }) => {
    await seedGame(page, makeGame({ names: ["Füchse", "Hasen"], scores: [22, 9], phase: "score", roundNo: 5, lastLetter: "K", round: makeRound({ mode: "allornothing" }) }));
    await page.click("#resumeBtn");
    await expect(page.locator("#score.active")).toBeVisible();
    await page.click("#scoreBtn");
    await expect(page.locator("#end.active")).toBeVisible();
    await page.click("#endNewBtn");
    await expect(page.locator("#setup.active")).toBeVisible();
    await expect(page.locator("#team-1")).toHaveValue("Hasen");
    await page.click('#setup [data-go="home"]');
    await expect(page.locator("#resumeBtn")).toBeHidden(); // beendet
    await page.evaluate(([k, g]) => localStorage.setItem(k, JSON.stringify(g)), [KEYS.game, makeGame({ names: ["Füchse", "Hasen"], scores: [22, 9], phase: "end", roundNo: 6, lastLetter: "K" })]);
    await page.reload();
    await page.click("#newBtn");
    await page.click('#setup [data-go="home"]');
    // Endbildschirm erneut über die Punkteansicht erreichen und "Nochmal" tippen
    await seedGame(page, makeGame({ names: ["Füchse", "Hasen"], scores: [22, 9], phase: "score", roundNo: 5, lastLetter: "K", round: makeRound({ mode: "allornothing" }) }));
    await page.click("#resumeBtn");
    await page.click("#scoreBtn");
    await page.click("#againBtn");
    await expect(page.locator("#turn.active")).toBeVisible();
    await expect(page.locator("#turnTeam")).toHaveText("Füchse ist dran");
    expect(await points(page)).toEqual(["0", "0"]);
    const game = await readGame(page);
    expect(game).toMatchObject({ roundNo: 0, current: 0, lastLetter: null, phase: "turn", round: null });
    expect(game.teams.map((t) => t.name)).toEqual(["Füchse", "Hasen"]);
  });
});
