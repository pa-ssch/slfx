// Sicherheit und Datenschutz: Was die Datenschutzerklärung verspricht, wird hier gegen das
// tatsächliche Verhalten geprüft. Dazu Regeln im Quelltext.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { PUBLIC, KEYS, listFiles, spinInstant, startRound, RULES } = require("./helpers");

// Kompletter Spieldurchlauf über alle Ansichten, inklusive Neuladen und Impressum
async function playThrough(page) {
  await page.goto("/index.html");
  await page.click('[data-go="rules"]');
  await page.click('#rules [data-go="home"]');
  await page.click("#newBtn");
  const second = page.locator("#decks input").nth(1);
  await second.check();
  await second.uncheck();
  await page.click("#startBtn");
  await spinInstant(page);
  await page.clock.install();
  await startRound(page);
  if (await page.locator("#everyone.active").isVisible()) {
    for (let i = 0; i < RULES.CATEGORIES_PER_ROUND; i++) await page.click("#evSkip");
  } else {
    await page.locator("#tiles .tile").first().click();
    await page.clock.runFor(90000);
    await page.click("#doneBtn");
  }
  await page.click("#scoreBtn");
  await expect(page.locator("#turn.active")).toBeVisible();
  await page.reload();
  await page.click("#resumeBtn");
  await page.click("#quitBtn");
  await page.click("#confirmYes");
  await page.goto("/impressum.html");
  await page.click("a.btn");
  await expect(page.locator("#home.active")).toBeVisible();
}

test.describe("Was die Datenschutzerklärung verspricht", () => {
  test("kein Request verlässt die eigene Origin", async ({ page, baseURL }) => {
    const origin = new URL(baseURL).origin;
    const foreign = [];
    page.on("request", (r) => {
      if (new URL(r.url()).origin !== origin) foreign.push(r.url());
    });
    await playThrough(page);
    expect(foreign).toEqual([]);
  });

  test("keine Cookies", async ({ page, context }) => {
    await playThrough(page);
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).toBe("");
  });

  test("im Browser liegen genau die drei genannten Local-Storage-Einträge", async ({ page }) => {
    await playThrough(page);
    const storage = await page.evaluate(() => ({ local: Object.keys(localStorage).sort(), session: sessionStorage.length }));
    expect(storage.local).toEqual([KEYS.decks, KEYS.game, KEYS.used]);
    expect(storage.session).toBe(0);
  });

  test("nach „Nein, danke“ beim Install-Hinweis kommt genau der vierte genannte Eintrag dazu", async ({ page }) => {
    await playThrough(page);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true })));
    await page.click("#installDismiss");
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(keys).toEqual([KEYS.decks, KEYS.game, KEYS.install, KEYS.used]);
  });
});

test.describe("Regeln im Quelltext", () => {
  const textFiles = listFiles(PUBLIC).filter((f) => /\.(js|html|css|webmanifest|svg|txt)$/.test(f) && !f.startsWith("fonts/"));
  const read = (f) => fs.readFileSync(path.join(PUBLIC, f), "utf8");

  test("keine gefährlichen DOM-Sinks und keine dynamische Code-Ausführung", () => {
    const forbidden = /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|javascript:|srcdoc/;
    for (const f of textFiles.filter((f) => /\.(js|html)$/.test(f))) {
      const line = read(f).split("\n").findIndex((l) => forbidden.test(l));
      expect(line, `${f}:${line + 1}`).toBe(-1);
    }
  });

  test("CSP auf jeder Seite, keine Inline-Skripte, -Event-Handler oder -Styles", () => {
    for (const f of textFiles.filter((f) => f.endsWith(".html"))) {
      const html = read(f);
      expect(html, `${f}: CSP`).toMatch(/http-equiv="Content-Security-Policy"[\s\S]*?default-src 'self'/);
      expect(html.match(/<script\b(?![^>]*\bsrc=)/g), `${f}: Inline-Skript`).toBeNull();
      expect(html.match(/\son[a-z]+\s*=/gi), `${f}: Inline-Event-Handler`).toBeNull();
      expect(html.match(/\sstyle\s*=/gi), `${f}: Inline-Style`).toBeNull();
    }
  });

  test("externe Adressen nur in der Datenschutzerklärung und als eigene Adresse für SEO", () => {
    const allowed = [
      ["impressum.html", "https://docs.github.com/"],
      ["index.html", "https://slfx.9xb.de/"], // Canonical und Open Graph
      ["robots.txt", "https://slfx.9xb.de"],
      ["icons/icon.svg", "http://www.w3.org/2000/svg"], // XML-Namensraum, löst keinen Request aus
      ["icons/og-image.svg", "http://www.w3.org/2000/svg"],
    ];
    for (const f of textFiles) {
      for (const url of read(f).match(/https?:\/\/[^\s"'<>)]+/g) || []) {
        const ok = allowed.some(([file, prefix]) => f === file && url.startsWith(prefix));
        expect(ok, `${f}: ${url}`).toBe(true);
      }
    }
  });

  test("Local-Storage-Einträge mit Präfix, genau die vier aus der Datenschutzerklärung", () => {
    const app = read("app.js");
    const keys = [...app.matchAll(/"(slfx-[a-z-]+)"/g)].map((m) => m[1]);
    expect([...new Set(keys)].sort()).toEqual(Object.values(KEYS).sort());
    const impressum = read("impressum.html");
    for (const k of Object.values(KEYS)) expect(impressum, k).toContain(`<code>${k}</code>`);
    expect(app.match(/localStorage\.(getItem|setItem|removeItem)\(\s*"(?!slfx-)/g)).toBeNull();
  });
});
