import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../docs/screenshots");
const BASE_URL = "http://localhost:5173";
const EMAIL = "screenshots@hourden.local";
const PASSWORD = "DemoPass1";

/** Match the hand-captured README reference screenshots. */
const VIEWPORT = { width: 1024, height: 521 };
/** Slightly zoom out so the same viewport fits as much content as the references. */

async function prepareViewport(p, zoom) {
  await p.evaluate(({ z }) => {
    document.documentElement.style.zoom = String(z);
    window.scrollTo(0, 0);
  }, { z: zoom });
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: VIEWPORT,
  colorScheme: "dark",
  locale: "de-DE",
});
const page = await context.newPage();

await page.addInitScript(() => {
  localStorage.setItem("hourden.locale", "de");
});

async function login() {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/login"),
    undefined,
    { timeout: 15000 },
  );
  await page.waitForLoadState("networkidle");
}

async function capture(name, url, zoom, prepare) {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle" });
  await prepareViewport(page, zoom);
  if (prepare) {
    await prepare(page);
  }
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: false,
  });
  console.log(`Captured ${name}.png`);
}

await login();

await capture("tracker", "/tracker", 0.72, async (p) => {
  await p.getByText("September 2026").waitFor({ state: "visible" });
  await p.getByText("Dieser Monat").waitFor({ state: "visible" });
});

await capture("dashboard", "/dashboard", 0.62, async (p) => {
  await p.getByRole("button", { name: "Dieser Monat" }).click();
  await p.locator(".recharts-wrapper").first().waitFor({ state: "visible", timeout: 15000 });
});

await capture("invoices", "/invoices", 0.56, async (p) => {
  await p.locator("select").first().selectOption({ label: "Nordex" });
  await p.getByRole("button", { name: "Dieser Monat" }).click();
  await p.waitForLoadState("networkidle");
  await p.getByRole("button", { name: /^NOR2026/ }).first().click();
  await p.locator("iframe").first().waitFor({ state: "visible", timeout: 15000 });
  await p.waitForTimeout(2500);
  await prepareViewport(p, 0.56);
});

await browser.close();
