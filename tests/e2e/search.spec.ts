import { test, expect } from "@playwright/test";

test("workspace search finds real projects by client and invoices by number", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search workspace" }).click();
  let dialog = page.getByRole("dialog", { name: "Find anything" });
  const input = dialog.getByRole("textbox", {
    name: "Search projects, invoices, and pages",
  });
  await expect(input).toBeFocused();
  await input.fill("Emma & James");
  await dialog.getByRole("button", { name: /Johnson Wedding/ }).click();
  await expect(
    page.getByRole("heading", { name: "Johnson Wedding", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Search workspace" }).click();
  dialog = page.getByRole("dialog", { name: "Find anything" });
  await dialog.getByRole("textbox").fill("INV-0102");
  await dialog.getByRole("button", { name: /INV-0102/ }).click();
  await expect(
    page.getByRole("heading", { name: "Invoices", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search invoices" }),
  ).toHaveValue("INV-0102");
  await expect(
    page.getByRole("row").filter({ hasText: "INV-0102" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "INV-0101" }),
  ).toHaveCount(0);
});

test("search shortcut supports empty results, page navigation, and keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Search workspace" });
  await trigger.focus();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Find anything" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".command-result")).toHaveCount(10);
  await dialog.getByRole("textbox").fill("no-such-record-938475");
  await expect(dialog.getByRole("status")).toContainText("No matches");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByRole("textbox").fill("Tax center");
  await page.keyboard.press("ArrowDown");
  await expect(
    dialog.getByRole("button", { name: /Tax center/ }),
  ).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(dialog.getByRole("textbox")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Tax center", exact: true }),
  ).toBeVisible();
  await expect(dialog).toHaveCount(0);

  await trigger.click();
  await page.keyboard.press("Escape");
  await trigger.focus();
  await page.keyboard.press("Meta+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
