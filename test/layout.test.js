// Layout: Hoch- und Querformat, Drehung, Safe Area, Begriffe passen, Barrierefreiheit (axe-core)
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const { N, DECKS, makeGame, makeRound, seedGame, fits, checkTiles } = require("./helpers");

const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
// Lange Kategorien, damit die Anpassung wirklich gefordert ist
const LONG = [...DECKS.Normal, ...DECKS.NSFW].sort((a, b) => b.length - a.length).slice(0, N);
const LONGEST = LONG[0];

const inPlay = (o = {}) =>
  makeGame({ names: ["Die Donaudampfer", "Hasen", "Igel", "Füchse", "Elche"], phase: "play", round: makeRound({ categories: LONG, mode: "normal", endsAt: Date.now() + 600000, ...o }) });

async function expectTilesOk(page) {
  const tiles = await checkTiles(page);
  expect(tiles).toHaveLength(N);
  for (const t of tiles) {
    expect(t.inViewport, JSON.stringify(t)).toBe(true);
    expect(t.textFits, JSON.stringify(t)).toBe(true);
    expect(t.height, t.text).toBeGreaterThanOrEqual(44);
  }
}

test.describe("Runde im Hochformat", () => {
  test("Kacheln liegen unter der Punkteleiste im Viewport, Texte passen, Leiste ohne Überlauf", async ({ page }) => {
    await seedGame(page, inPlay());
    await expect(page.locator("#play.active")).toBeVisible();
    await expectTilesOk(page);
    const bar = await page.evaluate(() => {
      const b = document.getElementById("scorebar");
      return { overflow: b.scrollWidth > b.clientWidth + 1, chips: b.querySelectorAll(".chip").length };
    });
    expect(bar).toEqual({ overflow: false, chips: 5 });
    expect((await fits(page, "#playLetter")).ok).toBe(true);
    expect((await fits(page, "#timer")).ok).toBe(true);
  });
});

test.describe("Kacheltexte", () => {
  const MIX = ["Land", "Zeitschrift oder Zeitung", "Etwas, das nichts kostet", "Etwas, das nicht ins Handgepäck darf", "Tier", "Comic- oder Zeichentrickfigur", "Wissenschaftler oder Wissenschaftlerin", "Etwas Kaltes"];

  for (const [name, vp] of [["Hochformat", { width: 412, height: 915 }], ["Querformat", { width: 844, height: 390 }]]) {
    test(`${name}: kurze Texte groß, lange umgebrochen statt winzig, kein Umbruch im Wort, Abhaken ändert nichts`, async ({ page }) => {
      await page.setViewportSize(vp);
      await seedGame(page, inPlay({ categories: MIX }));
      await expect(page.locator("#play.active")).toBeVisible();
      const info = () =>
        page.$$eval("#tiles .tile", (ts) =>
          ts.map((t) => {
            const r = t.firstChild.getBoundingClientRect();
            const size = parseFloat(t.style.fontSize);
            return { text: t.firstChild.textContent, size, lines: Math.round(r.height / (size * 1.15)), width: Math.round(r.width) };
          }),
        );
      const before = await info();
      const byText = Object.fromEntries(before.map((t) => [t.text, t]));
      expect(byText["Land"].size).toBeGreaterThanOrEqual(28); // kurze Texte nutzen die Kachel
      expect(byText["Tier"].size).toBeGreaterThanOrEqual(28);
      expect(byText["Zeitschrift oder Zeitung"].size).toBeGreaterThanOrEqual(18); // lange: umgebrochen, nicht winzig
      expect(byText["Etwas, das nicht ins Handgepäck darf"].size).toBeGreaterThanOrEqual(14);
      // Kein Umbruch mitten im Wort: jedes Wort liegt in genau einem Rechteck
      const broken = await page.$$eval("#tiles .tile-text", (els) =>
        els
          .filter((e) => {
            const text = e.textContent;
            let pos = 0;
            return text.split(" ").some((word) => {
              const idx = text.indexOf(word, pos);
              pos = idx + word.length;
              const range = document.createRange();
              range.setStart(e.firstChild, idx);
              range.setEnd(e.firstChild, idx + word.length);
              return range.getClientRects().length > 1;
            });
          })
          .map((e) => e.textContent),
      );
      expect(broken).toEqual([]);
      await expectTilesOk(page);
      for (const t of await page.$$("#tiles .tile")) await t.click();
      expect(await info()).toEqual(before); // Abhaken: Schriftgröße, Zeilen und Breite bleiben gleich
    });
  }
});

test.describe("Querformat und Drehung", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("Startseite passt, Runde passt, Drehung passt nach", async ({ page }) => {
    await page.goto("/index.html");
    const ok = await page.evaluate(() =>
      [...document.querySelectorAll("#home .btn, #home a")].filter((b) => !b.hidden).every((b) => b.getBoundingClientRect().bottom <= innerHeight),
    );
    expect(ok).toBe(true);
    await seedGame(page, inPlay());
    await expect(page.locator("#play.active")).toBeVisible();
    await expectTilesOk(page);
    await page.setViewportSize({ width: 390, height: 664 });
    await page.waitForTimeout(300);
    await expectTilesOk(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    await expectTilesOk(page);
  });

  test("Kacheln bleiben außerhalb der Safe Area (Dynamic Island im Querformat)", async ({ page }) => {
    await page.goto("/index.html");
    await page.evaluate(([k, g]) => localStorage.setItem(k, JSON.stringify(g)), ["slfx-game", inPlay()]);
    await page.reload();
    await expect(page.locator("#play.active")).toBeVisible();
    // Safe Area wie beim iPhone im Querformat nachstellen: links/rechts je 59 px (per CSSOM)
    await page.evaluate(() => {
      const s = document.getElementById("play").style;
      s.paddingLeft = "59px";
      s.paddingRight = "59px";
      window.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(100);
    const tiles = await checkTiles(page);
    for (const t of tiles) {
      expect(t.textFits, JSON.stringify(t)).toBe(true);
      expect(t.rect[0], t.text).toBeGreaterThanOrEqual(59);
      expect(t.rect[2], t.text).toBeLessThanOrEqual(844 - 59);
    }
  });

  test("Walzen, Rundenstart und Punkteansicht passen ins flache Querformat", async ({ page }) => {
    await seedGame(page, makeGame({ names: ["Die Donaudampfer", "Hasen", "Igel", "Füchse", "Elche"] }));
    await page.click("#resumeBtn");
    const within = (sel) =>
      page.evaluate((s) => {
        const bar = document.getElementById("scorebar").getBoundingClientRect().bottom;
        return [...document.querySelectorAll(s)].filter((e) => !e.hidden).every((e) => {
          const r = e.getBoundingClientRect();
          return r.top >= bar - 0.5 && r.bottom <= innerHeight + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5;
        });
      }, sel);
    expect(await within("#turnTeam, #readyBtn")).toBe(true);
    await page.click("#readyBtn");
    expect(await within(".reel-box, #spinBtn")).toBe(true);
    await seedGame(page, makeGame({ phase: "score", round: makeRound({ mode: "normal", done: [true, false, false, false, false, false, false, false] }) }));
    await page.click("#resumeBtn");
    expect(await within("#scoreTitle, #scoreStepper, #scoreBtn")).toBe(true);
  });
});

test.describe("Alle raten mit: Begriff passt", () => {
  for (const [name, vp] of [["Hochformat", { width: 390, height: 664 }], ["Querformat", { width: 844, height: 390 }]]) {
    test(`${name}: längste Kategorie passt in den Kasten und ist groß genug`, async ({ page }) => {
      await page.setViewportSize(vp);
      await seedGame(page, makeGame({ names: ["Die Donaudampfer", "Hasen", "Igel"], phase: "play", round: makeRound({ categories: LONG, mode: "everyone" }) }));
      await expect(page.locator("#everyone.active")).toBeVisible();
      await expect(page.locator("#evWord")).toContainText(LONGEST.split(" ")[0]);
      const f = await fits(page, "#evWord");
      expect(f.ok, JSON.stringify(f)).toBe(true);
      expect(f.fontSize).toBeGreaterThanOrEqual(14);
      const inBox = await page.evaluate(() => {
        const b = document.getElementById("evWordBox").getBoundingClientRect();
        const w = document.getElementById("evWord").getBoundingClientRect();
        return w.top >= b.top - 0.5 && w.bottom <= b.bottom + 0.5;
      });
      expect(inBox).toBe(true);
      const buttons = await page.evaluate(() =>
        [...document.querySelectorAll("#evTeams .btn, #evSkip")].every((b) => b.getBoundingClientRect().bottom <= innerHeight + 0.5),
      );
      expect(buttons).toBe(true);
    });
  }
});

test.describe("Barrierefreiheit (axe-core)", () => {
  // Die CSP erlaubt keine Inline-Skripte, deshalb axe über eine Route einschleusen
  test.beforeEach(async ({ page }) => {
    await page.route("**/index.html", async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/s, "");
      await route.fulfill({ response: res, body: html, headers: { ...res.headers(), "content-type": "text/html; charset=utf-8" } });
    });
  });

  async function axeViolations(page) {
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(() =>
      axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] } }),
    );
    return result.violations.map((v) => `${v.impact}: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
  }

  const game = (o) => makeGame({ names: ["Füchse", "Hasen"], ...o });
  const screens = [
    ["Startseite", async (p) => p.goto("/index.html")],
    ["Anleitung", async (p) => { await p.goto("/index.html"); await p.click('[data-go="rules"]'); }],
    ["Spiel anlegen", async (p) => { await p.goto("/index.html"); await p.click("#newBtn"); }],
    ["Rundenstart", async (p) => { await seedGame(p, game()); await p.click("#resumeBtn"); }],
    ["Walze", async (p) => { await seedGame(p, game()); await p.click("#resumeBtn"); await p.click("#readyBtn"); }],
    ["Walze mit Ergebnis", async (p) => { await seedGame(p, game({ phase: "ready", round: makeRound() })); await p.click("#resumeBtn"); }],
    ["Runde", async (p) => seedGame(p, game({ phase: "play", round: makeRound({ endsAt: Date.now() + 60000, done: [true, false, false, false, false, false, false, false] }) }))],
    ["Alle raten mit", async (p) => seedGame(p, game({ phase: "play", round: makeRound({ mode: "everyone" }) }))],
    ["Punkte", async (p) => { await seedGame(p, game({ phase: "score", round: makeRound({ terms: 3 }) })); await p.click("#resumeBtn"); }],
    ["Spielende", async (p) => { await seedGame(p, game({ phase: "score", scores: [20, 3], roundNo: 1, round: makeRound({ terms: 3 }) })); await p.click("#resumeBtn"); await p.click("#scoreBtn"); }],
    ["Rückfrage", async (p) => { await seedGame(p, game()); await p.click("#resumeBtn"); await p.click("#quitBtn"); }],
  ];
  for (const [name, open] of screens) {
    test(`${name}: keine Verstöße`, async ({ page }) => {
      await open(page);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});
