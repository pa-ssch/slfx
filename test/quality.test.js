// Best Practices, Manifest, SEO, Impressum, Offline-Betrieb, interne Verweise, Datenqualität
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const { RULES, DECKS, DEFAULT_ON, makeGame, seedGame } = require("./helpers");

const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const SITE = "https://slfx.9xb.de";

test.describe("Best Practices im Markup", () => {
  test("Viewport erlaubt Zoom, Description und Landmark vorhanden, CSP gesetzt", async ({ page }) => {
    await page.goto("/index.html");
    const viewport = await page.getAttribute('meta[name="viewport"]', "content");
    expect(viewport).not.toMatch(/user-scalable=no|maximum-scale/);
    expect((await page.getAttribute('meta[name="description"]', "content")).length).toBeGreaterThan(50);
    await expect(page.locator("main")).toHaveCount(1);
    expect(await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', "content")).toContain("default-src 'self'");
  });

  test("SEO: Canonical, Open Graph, robots.txt", async ({ page, request }) => {
    await page.goto("/index.html");
    expect(await page.getAttribute('link[rel="canonical"]', "href")).toBe(SITE + "/");
    expect(await page.getAttribute('meta[property="og:title"]', "content")).toContain("Stadt Land Fluss Extrem");
    expect(await page.getAttribute('meta[property="og:url"]', "content")).toBe(SITE + "/");
    expect(await page.getAttribute('meta[property="og:image"]', "content")).toBe(`${SITE}/icons/og-image.png`);
    expect((await page.getAttribute('meta[property="og:description"]', "content")).length).toBeGreaterThan(50);
    expect((await request.get("/icons/og-image.png")).ok()).toBe(true);
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toMatch(/User-agent: \*\s+Allow: \//);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0); // Startseite darf indexiert werden
  });

  test("Web-App-Manifest und Icons sind erreichbar", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    const m = await manifest.json();
    expect(m.name).toBe("Stadt Land Fluss Extrem");
    expect(m.display).toBe("standalone");
    for (const file of [...m.icons.map((i) => i.src), "icons/apple-touch-icon.png", "sw.js"]) {
      expect((await request.get("/" + file)).ok(), file).toBe(true);
    }
  });

  test("Shake-Animation und Timer-Puls respektieren reduzierte Bewegung", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedGame(page, makeGame());
    await page.click("#resumeBtn");
    const anim = await page.$eval(".cat", (el) => {
      el.classList.add("shake");
      return getComputedStyle(el).animationName;
    });
    expect(anim).toBe("none");
    const pulse = await page.$eval("#timer", (el) => {
      el.classList.add("urgent");
      return getComputedStyle(el).animationName;
    });
    expect(pulse).toBe("none");
  });
});

test.describe("Impressum und Datenschutz", () => {
  test("ist von der Startseite verlinkt und enthält die Pflichtangaben", async ({ page }) => {
    await page.goto("/index.html");
    await page.click('a[href="impressum.html"]');
    await expect(page).toHaveTitle(/Impressum/);
    const text = await page.locator("main").innerText();
    await expect(page.locator('a[href="mailto:slfx@9xb.de"]')).toHaveCount(3);
    await expect(page.locator('a[href="mailto:slfx@9xb.de"]').first()).toBeVisible();
    for (const s of [
      "9xb", "Silas Schnurr", "Theodor-Heuss-Straße 14", "77815 Bühl", "nicht kommerzielles Angebot", "Haftungsausschluss",
      "Community", "nicht einzeln geprüft", "Abgrenzung", "Schmidt Spiele", "Stadt Land Fluss Extreme", "Stadt Land Vollpfosten", "Denkriesen", "Scattergories", "Hasbro", "Stadt Land BOOM!", "Kammergerichts Berlin",
      "Datenschutzerklärung", "GitHub Pages", "Local Storage", "slfx-game", "slfx-used", "slfx-install", "Patrick Hand",
    ]) {
      expect(text, s).toContain(s);
    }
    await page.click("a.btn");
    await expect(page.locator("#home.active")).toBeVisible();
  });

  test("enthält keine offenen Platzhalter mehr", async ({ page }) => {
    await page.goto("/impressum.html");
    await expect(page.locator(".todo")).toHaveCount(0);
  });

  test("Impressum: keine axe-Verstöße", async ({ page }) => {
    await page.route("**/impressum.html", async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/s, "");
      await route.fulfill({ response: res, body: html });
    });
    await page.goto("/impressum.html");
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(() =>
      axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] } }),
    );
    expect(result.violations.map((v) => `${v.impact}: ${v.id}`)).toEqual([]);
  });
});

test.describe("Offline-Betrieb", () => {
  test.use({ serviceWorkers: "allow" });

  test("Seite läuft nach dem ersten Besuch ohne Netz weiter", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Service-Worker-Steuerung in Playwright nur in Chromium zuverlässig");
    await page.goto("/index.html");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(() => page.evaluate(() => caches.keys().then((k) => k.length)), { timeout: 10000 })
      .toBeGreaterThan(0);
    await expect
      .poll(() => page.evaluate(async () => (await caches.open((await caches.keys())[0])).keys().then((k) => k.length)), { timeout: 10000 })
      .toBeGreaterThanOrEqual(10);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#home.active")).toBeVisible();
    await expect(page.locator("#catcount")).toContainText("Kategorien");
    await page.click("#newBtn");
    await page.click("#startBtn");
    await expect(page.locator("#turn.active")).toBeVisible();
    await page.goto("/impressum.html");
    await expect(page).toHaveTitle(/Impressum/);
  });
});

test.describe("Interne Verweise", () => {
  test("jeder Link, jede Ressource, jedes Icon und die Service-Worker-Liste sind erreichbar", async ({ page, request }) => {
    const refs = new Set();
    for (const html of ["index.html", "impressum.html"]) {
      await page.goto("/" + html);
      const found = await page.$$eval("[href], [src]", (els) => els.map((e) => e.getAttribute("href") || e.getAttribute("src")));
      for (const r of found) refs.add(r);
    }
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    for (const i of manifest.icons) refs.add(i.src);
    refs.add(manifest.start_url);
    const sw = await (await request.get("/sw.js")).text();
    const files = sw.match(/var FILES = \[([\s\S]*?)\];/)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
    for (const f of files) refs.add(f);
    // Alles, was die Seite lädt, muss der Service Worker auch vorhalten
    for (const f of ["index.html", "style.css", "app.js", "rules.js", "decks.js", "impressum.html", "manifest.webmanifest"]) expect(files, f).toContain(f);

    const internal = [...refs].filter((r) => !/^(https?:|mailto:|data:|#)/.test(r));
    expect(internal.length).toBeGreaterThan(10);
    const broken = [];
    for (const r of internal) {
      const res = await request.get("/" + r.replace(/^\.?\//, ""));
      if (!res.ok()) broken.push(`${r} → ${res.status()}`);
    }
    expect(broken, "nicht erreichbare Verweise").toEqual([]);
  });
});

test.describe("Datenqualität", () => {
  test("Decks: Mindestgrößen, keine leeren oder doppelten Einträge, kurze Nominalphrasen", () => {
    expect(DEFAULT_ON).toEqual(["Normal"]);
    expect(DECKS.Normal.length).toBeGreaterThanOrEqual(150);
    expect(DECKS.NSFW.length).toBeGreaterThanOrEqual(40);
    expect(DECKS.Weihnachten.length).toBeGreaterThanOrEqual(40);
    const all = [];
    for (const [deck, cats] of Object.entries(DECKS)) {
      expect(Array.isArray(cats), deck).toBe(true);
      for (const c of cats) {
        expect(typeof c, `${deck}: ${c}`).toBe("string");
        expect(c.trim(), `${deck}: "${c}"`).toBe(c);
        expect(c.length, `${deck}: leerer Eintrag`).toBeGreaterThan(0);
        expect(c.length, `${deck}: zu lang: ${c}`).toBeLessThanOrEqual(60);
        expect(c[0], `${deck}: Großschreibung: ${c}`).toBe(c[0].toUpperCase());
      }
      expect(new Set(cats).size, `${deck}: Duplikate`).toBe(cats.length);
      all.push(...cats);
    }
    expect(new Set(all).size, "Duplikate über Decks hinweg").toBe(all.length);
  });

  test("Regeln: Werte sind plausibel und untereinander stimmig", () => {
    expect(RULES.MIN_TEAMS).toBe(1);
    expect(RULES.MAX_TEAMS).toBe(5);
    expect(RULES.MIN_TARGET).toBe(5);
    expect(RULES.DEFAULT_TARGET).toBeGreaterThanOrEqual(RULES.MIN_TARGET);
    expect(RULES.MAX_TARGET).toBeGreaterThanOrEqual(RULES.DEFAULT_TARGET);
    expect(RULES.CATEGORIES_PER_ROUND).toBe(8);
    for (const [k, m] of Object.entries(RULES.MODES)) {
      expect(typeof m.name, k).toBe("string");
      expect(typeof m.text, k).toBe("string");
      expect(m.weight, k).toBeGreaterThanOrEqual(0);
      expect(m.seconds, k).toBeGreaterThanOrEqual(0);
      if (k === "allornothing") expect(m.bonus).toBeGreaterThan(0);
      else expect(m.points, k).toBeGreaterThan(0);
    }
    expect(RULES.MODES.everyone.seconds).toBe(0);
    for (const w of Object.values(RULES.LETTER_WEIGHTS)) expect(w).toBeGreaterThanOrEqual(0);
    expect(Object.keys(RULES.LETTER_WEIGHTS).join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(RULES.WHEEL.SPEED).toBeGreaterThan(0);
    expect(RULES.WHEEL.MIN_RUNOUT_MS).toBeLessThanOrEqual(RULES.WHEEL.MAX_RUNOUT_MS);
  });
});
