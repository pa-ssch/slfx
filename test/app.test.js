// Startseite, Anleitung, Spiel anlegen
const { test, expect } = require("@playwright/test");
const { RULES, DECKS, DEFAULT_ON, KEYS, categoriesOf, watchErrors, readGame, makeGame, seedGame, createGame } = require("./helpers");

const ALL = Object.keys(DECKS);
const TOTAL = categoriesOf(ALL).length;

test.describe("Laden und Startseite", () => {
  test("lädt ohne Fehler und 404s", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/index.html");
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
    await expect(page).toHaveTitle("Stadt Land Fluss Extrem");
    await expect(page.locator("#home.active")).toBeVisible();
    await expect(page.locator("#scorebar")).toBeHidden();
  });

  test("Zähler zeigt eindeutige Kategorien und Decks", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("#catcount")).toHaveText(`${TOTAL} Kategorien in ${ALL.length} Decks`);
  });

  test("ohne Spiel kein „Weiterspielen“, alle Buttons im sichtbaren Bereich", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("#resumeBtn")).toBeHidden();
    const ok = await page.evaluate(() =>
      [...document.querySelectorAll("#home .btn, #home a")].filter((b) => !b.hidden).every((b) => {
        const r = b.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
      }),
    );
    expect(ok).toBe(true);
  });

  test("mit laufendem Spiel: „Weiterspielen“ prominent, „Neues Spiel“ fragt nach", async ({ page }) => {
    await seedGame(page, makeGame({ names: ["Füchse", "Hasen"], scores: [3, 5] }));
    await expect(page.locator("#home.active")).toBeVisible();
    await expect(page.locator("#resumeBtn")).toBeVisible();
    await page.click("#newBtn");
    await expect(page.locator("#confirm")).toBeVisible();
    await expect(page.locator("#confirmText")).toContainText("läuft noch ein Spiel");
    await page.click("#confirmNo");
    await expect(page.locator("#confirm")).toBeHidden();
    await expect(page.locator("#home.active")).toBeVisible();
    await page.click("#newBtn");
    await page.click("#confirmYes");
    await expect(page.locator("#setup.active")).toBeVisible();
    // Das alte Spiel bleibt bis „Los geht's“ erhalten
    expect((await readGame(page)).teams[1].score).toBe(5);
    await page.click('#setup [data-go="home"]');
    await expect(page.locator("#resumeBtn")).toBeVisible();
    await page.click("#resumeBtn");
    await expect(page.locator("#turn.active")).toBeVisible();
    await expect(page.locator("#turnTeam")).toHaveText("Füchse ist dran");
  });

  test("beendetes Spiel: kein „Weiterspielen“, „Neues Spiel“ ohne Rückfrage", async ({ page }) => {
    await seedGame(page, makeGame({ phase: "end", scores: [20, 3] }));
    await expect(page.locator("#resumeBtn")).toBeHidden();
    await page.click("#newBtn");
    await expect(page.locator("#setup.active")).toBeVisible();
  });

  test("Tastatur: fokussierter Button reagiert auf Enter", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("#catcount")).toContainText("Kategorien");
    await page.focus("#newBtn");
    await page.keyboard.press("Enter");
    await expect(page.locator("#setup.active")).toBeVisible();
  });
});

test.describe("Anleitung", () => {
  test("ist scrollbar, nennt alle Modi und führt per Button zurück", async ({ page }) => {
    await page.goto("/index.html");
    await page.click('[data-go="rules"]');
    await expect(page.locator("#rules.active")).toBeVisible();
    expect(await page.$eval("#rules", (s) => getComputedStyle(s).overflowY)).toBe("auto");
    const text = await page.locator("#rules").innerText();
    for (const k of Object.keys(RULES.MODES)) expect(text).toContain(RULES.MODES[k].name);
    await page.click('#rules .btn[data-go="home"]');
    await expect(page.locator("#home.active")).toBeVisible();
  });
});

test.describe("Spiel anlegen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html");
    await page.click("#newBtn");
  });

  test("Vorgaben: 2 Teams, Zielpunkte aus den Regeln, keine Deck-Auswahl", async ({ page }) => {
    await expect(page.locator("#teamCount")).toHaveText("2");
    await expect(page.locator("#teams input")).toHaveCount(2);
    await expect(page.locator("#team-0")).toHaveAttribute("placeholder", "Team 1");
    await expect(page.locator("#target")).toHaveValue(String(RULES.DEFAULT_TARGET));
    await expect(page.locator("#setup #decks")).toHaveCount(0); // Decks werden je Runde gewählt
  });

  test("Teamanzahl zwischen MIN und MAX, Namen bleiben beim Umschalten erhalten", async ({ page }) => {
    for (let i = 2; i < RULES.MAX_TEAMS; i++) await page.click("#teamPlus");
    await expect(page.locator("#teams input")).toHaveCount(RULES.MAX_TEAMS);
    await expect(page.locator("#teamPlus")).toBeDisabled();
    await page.fill("#team-0", "Füchse");
    for (let i = RULES.MAX_TEAMS; i > RULES.MIN_TEAMS; i--) await page.click("#teamMinus");
    await expect(page.locator("#teams input")).toHaveCount(RULES.MIN_TEAMS);
    await expect(page.locator("#teamMinus")).toBeDisabled();
    await expect(page.locator("#team-0")).toHaveValue("Füchse");
  });

  test("Namen: getrimmt, Maximallänge, leer wird Standardname", async ({ page }) => {
    await expect(page.locator("#team-0")).toHaveAttribute("maxlength", String(RULES.MAX_NAME_LENGTH));
    await page.fill("#team-0", "   Die Füchse  ");
    await page.fill("#team-1", "   ");
    await page.click("#startBtn");
    const game = await readGame(page);
    expect(game.teams.map((t) => t.name)).toEqual(["Die Füchse", "Team 2"]);
    await expect(page.locator("#scores .chip .name")).toHaveText(["Die Füchse", "Team 2"]);
  });

  test("Zielpunkte: Schritte, Mindestwert, Höchstwert, Eingabe wird gerundet", async ({ page }) => {
    await page.click("#targetPlus");
    await expect(page.locator("#target")).toHaveValue(String(RULES.DEFAULT_TARGET + RULES.TARGET_STEP));
    for (let i = 0; i < 12; i++) await page.click("#targetMinus");
    await expect(page.locator("#target")).toHaveValue(String(RULES.MIN_TARGET));
    await page.fill("#target", "3");
    await page.click("#startBtn");
    expect((await readGame(page)).target).toBe(RULES.MIN_TARGET);
    await page.click("#quitBtn");
    await page.click("#confirmYes");
    await page.click("#newBtn");
    await page.click("#confirmYes");
    await page.fill("#target", "999");
    await page.click("#startBtn");
    expect((await readGame(page)).target).toBe(RULES.MAX_TARGET);
  });

  test("ein Team allein ist erlaubt", async ({ page }) => {
    await page.click("#teamMinus");
    await page.click("#startBtn");
    await expect(page.locator("#turn.active")).toBeVisible();
    expect((await readGame(page)).teams).toHaveLength(1);
    await expect(page.locator("#scores .chip")).toHaveCount(1);
  });

  test("„Los geht's“ speichert das Spiel mit Teams und Ziel", async ({ page }) => {
    await page.click("#teamPlus");
    await page.fill("#team-2", "Die Dritten");
    await page.fill("#target", "150");
    await page.click("#startBtn");
    const game = await readGame(page);
    expect(game).toMatchObject({
      v: 1,
      teams: [{ name: "Team 1", score: 0 }, { name: "Team 2", score: 0 }, { name: "Die Dritten", score: 0 }],
      target: 150,
      decks: DEFAULT_ON,
      roundNo: 0,
      current: 0,
      phase: "turn",
      round: null,
    });
    await expect(page.locator("#turnInfo")).toContainText("Ziel: 150 Punkte");
  });

  test("Touch-Ziele: Stepper, Namensfelder und Start-Button mindestens 44 px", async ({ page }) => {
    const sizes = await page.$$eval("#setup .step, #startBtn, #teams input", (els) =>
      els.map((e) => e.getBoundingClientRect().height),
    );
    for (const h of sizes) expect(h).toBeGreaterThanOrEqual(44);
  });

  test("nach einem beendeten Spiel sind Teams und Ziel vorbelegt", async ({ page }) => {
    await seedGame(page, makeGame({ names: ["Füchse", "Hasen", "Igel"], target: 30, phase: "end" }));
    await page.click("#newBtn");
    await expect(page.locator("#teams input")).toHaveCount(3);
    await expect(page.locator("#team-0")).toHaveValue("Füchse");
    await expect(page.locator("#target")).toHaveValue("30");
  });

  test("Eck-Button führt zurück zur Startseite", async ({ page }) => {
    await page.click('#setup [data-go="home"]');
    await expect(page.locator("#home.active")).toBeVisible();
  });
});

test.describe("Rundenstart: Decks je Runde", () => {
  test.beforeEach(async ({ page }) => {
    await createGame(page);
  });

  test("Decks aus decks.js, Reihenfolge erhalten, nur DEFAULT_ON vorausgewählt", async ({ page }) => {
    const labels = page.locator("#turn #decks label");
    await expect(labels).toHaveCount(ALL.length);
    expect(await labels.allTextContents()).toEqual(ALL.map((n) => " " + n));
    expect(DEFAULT_ON).toEqual(["Normal"]);
    for (const n of ALL) {
      const box = page.locator(`#decks input[value="${n}"]`);
      if (DEFAULT_ON.includes(n)) await expect(box).toBeChecked();
      else await expect(box).not.toBeChecked();
    }
    const sizes = await page.$$eval("#decks .cat, #readyBtn", (els) => els.map((e) => e.getBoundingClientRect().height));
    for (const h of sizes) expect(h).toBeGreaterThanOrEqual(44);
  });

  test("Deck-Auswahl wird gespeichert, letztes Deck bleibt aktiv", async ({ page }) => {
    const [keep, other] = ALL;
    await page.check(`#decks input[value="${other}"]`);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEYS.decks)).toBe(JSON.stringify([keep, other]));
    await page.uncheck(`#decks input[value="${other}"]`);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEYS.decks)).toBe(JSON.stringify([keep]));
    await page.click(`#decks input[value="${keep}"]`);
    await expect(page.locator(`#decks input[value="${keep}"]`)).toBeChecked();
    await expect(page.locator(`#decks input[value="${keep}"]`).locator("..")).toHaveClass(/shake/);
  });

  test("Deck-Auswahl überlebt Neuladen, unbekannte Namen werden ignoriert", async ({ page }) => {
    await page.evaluate(([k, c]) => localStorage.setItem(k, JSON.stringify([c, "GibtEsNicht"])), [KEYS.decks, ALL[1]]);
    await page.reload();
    await page.click("#resumeBtn");
    const checked = await page.$$eval("#decks input", (bs) => bs.filter((b) => b.checked).map((b) => b.value));
    expect(checked).toEqual([ALL[1]]);
  });

  test("Kategorienzähler folgt der Auswahl und den gezeigten Kategorien", async ({ page }) => {
    const count = page.locator("#poolcount");
    await expect(count).toHaveText(`${categoriesOf(DEFAULT_ON).length} Kategorien`);
    const extra = ALL.find((c) => !DEFAULT_ON.includes(c));
    await page.check(`#decks input[value="${extra}"]`);
    await expect(count).toHaveText(`${categoriesOf([...DEFAULT_ON, extra]).length} Kategorien`);
    const small = ALL[ALL.length - 1];
    const shown = DECKS[small].slice(0, 3);
    const foreign = DECKS[ALL[0]].find((w) => !DECKS[small].includes(w));
    await page.evaluate(
      ([k1, k2, c, used]) => {
        localStorage.setItem(k1, JSON.stringify([c]));
        localStorage.setItem(k2, JSON.stringify(used));
      },
      [KEYS.decks, KEYS.used, small, [...shown, foreign]],
    );
    await page.reload();
    await page.click("#resumeBtn");
    const n = DECKS[small].length;
    await expect(count).toHaveText(`${n} Kategorien, davon ${n - 3} noch nicht gezeigt`);
    await page.evaluate(([k, used]) => localStorage.setItem(k, JSON.stringify(used)), [KEYS.used, DECKS[small]]);
    await page.reload();
    await page.click("#resumeBtn");
    await expect(count).toHaveText(`${n} Kategorien, alle schon gezeigt`);
  });

  test("„Bereit“ übernimmt die Auswahl für diese Runde, nächste Runde kann anders wählen", async ({ page }) => {
    await page.check('#decks input[value="Weihnachten"]');
    await page.uncheck('#decks input[value="Normal"]');
    await page.click("#readyBtn");
    let game = await readGame(page);
    expect(game.decks).toEqual(["Weihnachten"]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.click("#quitBtn");
    await page.click("#confirmYes");
    await page.click("#resumeBtn");
    await expect(page.locator("#wheel.active")).toBeVisible();
    await expect(page.locator("#goBtn")).toBeVisible();
    game = await readGame(page);
    for (const c of game.round.categories) expect(DECKS.Weihnachten).toContain(c);
    // Zurück zum Rundenstart (Runde verwerfen) und anders wählen
    await page.evaluate(([k, g]) => localStorage.setItem(k, JSON.stringify({ ...g, phase: "turn", round: null })), [KEYS.game, game]);
    await page.reload();
    await page.click("#resumeBtn");
    await expect(page.locator('#decks input[value="Weihnachten"]')).toBeChecked(); // letzte Auswahl bleibt
    await page.check('#decks input[value="NSFW"]');
    await page.uncheck('#decks input[value="Weihnachten"]');
    await page.click("#readyBtn");
    await expect(page.locator("#goBtn")).toBeVisible();
    game = await readGame(page);
    expect(game.decks).toEqual(["NSFW"]);
    for (const c of game.round.categories) expect(DECKS.NSFW).toContain(c);
  });
});

test.describe("Rundenstart und Punkteleiste", () => {
  test("zeigt das aktive Team, Durchgang und Ziel; Leiste hebt das aktive Team hervor", async ({ page }) => {
    await createGame(page, { names: ["Füchse", "Hasen"], target: 25 });
    await expect(page.locator("#turnTeam")).toHaveText("Füchse ist dran");
    await expect(page.locator("#turnInfo")).toHaveText("Durchgang 1 · Ziel: 25 Punkte");
    await expect(page.locator("#scorebar")).toBeVisible();
    const chips = page.locator("#scores .chip");
    await expect(chips).toHaveCount(2);
    await expect(chips.nth(0)).toHaveClass(/active/);
    await expect(chips.nth(1)).not.toHaveClass(/active/);
    await expect(chips.nth(0).locator(".pts")).toHaveText("0");
  });

  test("Eck-Button in der Leiste fragt nach, Spiel bleibt gespeichert", async ({ page }) => {
    await createGame(page);
    await page.click("#quitBtn");
    await expect(page.locator("#confirm")).toBeVisible();
    await page.click("#confirmNo");
    await expect(page.locator("#turn.active")).toBeVisible();
    await page.click("#quitBtn");
    await page.click("#confirmYes");
    await expect(page.locator("#home.active")).toBeVisible();
    await expect(page.locator("#scorebar")).toBeHidden();
    expect(await readGame(page)).not.toBeNull();
    await expect(page.locator("#resumeBtn")).toBeVisible();
  });
});
