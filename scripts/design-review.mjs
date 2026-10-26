import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.DESIGN_REVIEW_ORIGIN ?? "http://127.0.0.1:3217";
if (!origin.startsWith("http://127.0.0.1:"))
  throw new Error("Local visual review only");
const dir = "docs/screenshots/redesign";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const [device, width, height] of [
  ["desktop", 1440, 1100],
  ["tablet", 834, 1112],
  ["mobile", 390, 844],
]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page
    .getByRole("heading", { name: "Your business, in balance." })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  async function shot(name) {
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `${dir}/${device}-${name}.png`,
      fullPage: true,
    });
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({
      device,
      page: name,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      errors: [...errors],
      accessibility: accessibility.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    });
  }
  async function nav(name) {
    if (width < 650)
      await page
        .getByRole("button", { name: "Toggle navigation", exact: true })
        .click();
    await page
      .locator(".sidebar")
      .getByRole("button", { name, exact: true })
      .click();
  }
  await shot("overview");
  await page.getByRole("button", { name: "Search workspace" }).click();
  await page
    .getByRole("textbox", { name: "Search projects, invoices, and pages" })
    .fill("Johnson");
  await shot("search");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Can I afford this?", exact: true })
    .click();
  await shot("simulator");
  await page.getByRole("button", { name: "Close dialog" }).click();
  for (const name of [
    "Projects",
    "Invoices",
    "Money",
    "Expenses",
    "Clients",
    "Collaborators",
    "Cards",
    "Insights",
    "Settings & support",
  ]) {
    await nav(name);
    await shot(name.toLowerCase());
  }
  await nav("Projects");
  await page
    .getByRole("button")
    .filter({ hasText: "Johnson Wedding" })
    .first()
    .click();
  await shot("project-detail");
  await page.goto(origin + "/pay/invoice-final");
  await page.getByRole("heading", { name: "Johnson Wedding" }).waitFor();
  await shot("payment");
  await context.close();
}
await browser.close();
await writeFile(
  `${dir}/inspection.json`,
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results));
if (
  results.some((r) => r.overflow || r.errors.length || r.accessibility.length)
)
  process.exitCode = 1;
