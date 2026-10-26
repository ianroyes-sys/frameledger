import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.demoReads = 0;
  const original = Storage.prototype.getItem;
  Storage.prototype.getItem = function (key) {
    if (key === "frameledger-demo-v1") window.demoReads++;
    return original.call(this, key);
  };
});
await page.goto("http://127.0.0.1:3211");
await expect(
  page.getByRole("heading", { name: "Welcome back." }),
).toBeVisible();
await expect(
  page.getByText("Live access needs Supabase configuration.", { exact: false }),
).toBeVisible();
await expect(
  page.getByText("DEMO MODE · SYNTHETIC DATA", { exact: true }),
).toHaveCount(0);
await page.goto("http://127.0.0.1:3211/pay/invoice-final");
await expect(
  page.getByRole("heading", { name: "Open your secure payment link" }),
).toBeVisible();
if ((await page.evaluate(() => window.demoReads)) !== 0)
  throw new Error("Live mode read demo records");
await page.screenshot({
  path: "docs/screenshots/production-unconfigured-invoice.png",
});
await browser.close();
console.log(
  "Production mode fails closed without credentials; live invoice page does not load demo storage.",
);
