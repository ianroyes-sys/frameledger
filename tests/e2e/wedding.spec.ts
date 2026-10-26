import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function navigate(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 1000) < 650)
    await page
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function expense(
  page: Page,
  merchant: string,
  amount: string,
  category: string,
  project: string,
  commitment?: string,
) {
  await navigate(page, "Expenses");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Merchant / payee").fill(merchant);
  await dialog.getByLabel("Amount (USD)", { exact: true }).fill(amount);
  await dialog
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption(category);
  await dialog
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption(project);
  if (commitment)
    await dialog
      .getByRole("combobox", {
        name: "Apply against an existing estimate",
        exact: true,
      })
      .selectOption(commitment);
  await dialog
    .getByRole("button", { name: "Record expense", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
}
test("wedding retainer through expenses, final payment, closeout and lens purchase", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".big-money").first()).toHaveText("$470.00");
  await page.getByRole("button", { name: "View breakdown" }).click();
  await expect(page.getByRole("dialog")).toContainText("$1,600.00");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expense(
    page,
    "Fuel",
    "67",
    "Travel",
    "project-johnson",
    "commit-travel",
  );
  await expense(page, "Adobe", "58", "Software", "");
  await expense(page, "Equipment rental", "140", "Rentals", "project-johnson");
  await navigate(page, "Overview");
  await expect(page.locator(".big-money").first()).toHaveText("$272.00");
  await navigate(page, "Invoices");
  const finalRow = page.getByRole("row").filter({ hasText: "INV-0102" });
  await finalRow.getByRole("button", { name: "Demo payment" }).click();
  await confirm(page);
  await navigate(page, "Projects");
  await page
    .getByRole("button")
    .filter({ hasText: "Johnson Wedding" })
    .first()
    .click();
  const contractor = page
    .locator(".ledgerline")
    .filter({ hasText: "Second shooter" });
  await contractor
    .getByRole("button", { name: "Demo pay", exact: true })
    .click();
  await confirm(page);
  const travel = page
    .locator(".ledgerline")
    .filter({ hasText: "Travel estimate" });
  await travel.getByRole("button", { name: "Release", exact: true }).click();
  await confirm(page);
  await page
    .getByRole("button", { name: "Close project", exact: true })
    .click();
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Project completed" }),
  ).toBeDisabled();
  await expect(
    page.locator(".ledgerline").filter({ hasText: "Realized profit so far" }),
  ).toContainText("$2,543.00");
  await navigate(page, "Overview");
  await expect(page.locator(".big-money").first()).toHaveText("$1,365.00");
  await page
    .getByRole("button", { name: "Can I afford this?", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("-$1,035.00");
  await expect(page.getByRole("dialog")).toContainText(
    "tax reserve of $800.00 is unchanged",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(page.locator(".big-money").first()).toHaveText("$1,365.00");
});
test("creates a client, project and retainer, then client pays a partial synthetic invoice", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "Clients");
  await page.getByRole("button", { name: "Add client", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Client name").fill("Sample Client");
  await dialog.getByLabel("Email", { exact: true }).fill("sample@example.com");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await navigate(page, "Projects");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill("New wedding booking");
  await dialog
    .getByRole("combobox", { name: "Client", exact: true })
    .selectOption({ label: "Sample Client" });
  await dialog.getByLabel("Project value (USD)").fill("3200");
  await dialog
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await navigate(page, "Invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption({ label: "New wedding booking" });
  await dialog.getByLabel("Invoice amount (USD)").fill("1600");
  await dialog.getByRole("button", { name: "Create invoice draft" }).click();
  const row = page.getByRole("row").filter({ hasText: "New wedding booking" });
  await row.getByRole("button", { name: "Mark sent" }).click();
  await confirm(page);
  const href = await row
    .getByRole("link", { name: "Preview" })
    .getAttribute("href");
  await page.goto(href!);
  await expect(
    page.getByRole("heading", { name: "New wedding booking" }),
  ).toBeVisible();
  await page.getByLabel("Payment amount (USD)").fill("800");
  await page
    .getByRole("button", { name: "Simulate payment", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm demo payment" }).click();
  await expect(page.locator(".big-money")).toHaveText("$800.00");
  await expect(page.locator(".chip")).toHaveText("partial");
});
test("responsive layout, keyboard dialog and accessibility", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your business, in balance." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Can I afford this?", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
