import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const results = [];
await mkdir("docs/screenshots", { recursive: true });
for (const [name, width, height] of [
  ["desktop", 1440, 1100],
  ["tablet", 834, 1112],
  ["mobile", 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:3210");
  await page
    .getByRole("heading", { name: "Your business, in balance." })
    .waitFor();
  await page.screenshot({
    path: `docs/screenshots/${name}-overview.png`,
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  await page
    .getByRole("button", { name: "Can I afford this?", exact: true })
    .click();
  await page.screenshot({
    path: `docs/screenshots/${name}-simulator.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button")
    .filter({ hasText: "Johnson Wedding" })
    .first()
    .click();
  await page.screenshot({
    path: `docs/screenshots/${name}-project.png`,
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:3210/pay/invoice-final");
  await page.getByRole("heading", { name: "Johnson Wedding" }).waitFor();
  await page.screenshot({
    path: `docs/screenshots/${name}-invoice.png`,
    fullPage: true,
  });
  results.push({
    viewport: name,
    width,
    height,
    horizontalOverflow: overflow,
    pageErrors: errors,
  });
  await page.close();
}
await browser.close();
await writeFile(
  "docs/screenshots/inspection.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results));
if (results.some((r) => r.horizontalOverflow || r.pageErrors.length))
  process.exitCode = 1;
