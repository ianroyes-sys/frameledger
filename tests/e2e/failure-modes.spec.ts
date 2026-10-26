import { test, expect, type Page } from "@playwright/test";
import { initialState } from "../../src/domain";
import { commandSchema } from "../../src/server/validation";
const key = "frameledger-demo-v1";
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

test("empty optional company produces a valid server command", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "Clients");
  await page.getByRole("button", { name: "Add client", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Client name").fill("Independent Client");
  await dialog.getByLabel("Email", { exact: true }).fill("client@example.com");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  const client = await page.evaluate(
    (storageKey) =>
      JSON.parse(localStorage.getItem(storageKey)!).clients.find(
        (c: { name: string }) => c.name === "Independent Client",
      ),
    key,
  );
  expect(
    commandSchema.safeParse({ type: "CREATE_CLIENT", client }).success,
  ).toBe(true);
  expect(client.company).toBeUndefined();
});

for (const collection of ["payments", "clients"] as const) {
  test(`corrupt saved ${collection} rows recover without crashing`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ storageKey, state }) =>
        localStorage.setItem(storageKey, JSON.stringify(state)),
      { storageKey: key, state: { ...initialState, [collection]: [null] } },
    );
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Your business, in balance." }),
    ).toBeVisible();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.locator(".big-money").first()).toHaveText("$470.00");
  });
}

test("denied browser storage retains session changes and personalization", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage denied", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage denied", "SecurityError");
    };
  });
  await page.goto("/");
  await navigate(page, "Settings & support");
  await page.getByRole("button", { name: /Personalize/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your business name").fill("Session Studio");
  await dialog.getByRole("button", { name: "Save workspace" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".workspace")).toContainText("Session Studio");
  await expect(page.getByRole("alert").first()).toContainText(
    /storage|memory/i,
  );
});

test("allocation errors retain entered values and recover", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "Money");
  await page.getByRole("button", { name: /Edit rules/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tax reserve (%)").fill("70");
  await dialog.getByLabel("Gear fund (%)").fill("40");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Tax reserve (%)")).toHaveValue("70");
  await dialog.getByLabel("Gear fund (%)").fill("20");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
});

test("zero purchase displays validation instead of a misleading calculation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Can I afford this?", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Purchase amount (USD)").fill("0");
  await expect(dialog.getByRole("alert")).toContainText("positive amount");
  await expect(dialog.getByText("Safe to spend afterward")).toHaveCount(0);
  await dialog.getByLabel("Purchase amount (USD)").fill("1.001");
  await expect(dialog.getByRole("alert")).toContainText("two decimal");
  await expect(dialog.getByText("Safe to spend afterward")).toHaveCount(0);
  await dialog.getByLabel("Purchase amount (USD)").fill("100");
  await expect(dialog.getByText("Safe to spend afterward")).toBeVisible();
});

test("payment in another tab updates the open workspace", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.locator(".big-money").first()).toHaveText("$470.00");
  const payment = await context.newPage();
  await payment.goto("/pay/invoice-final");
  await payment
    .getByRole("button", { name: "Simulate payment", exact: true })
    .click();
  await payment
    .getByRole("button", { name: "Confirm demo payment", exact: true })
    .click();
  await expect(payment.locator(".chip")).toHaveText("paid");
  await expect(page.locator(".big-money").first()).toHaveText("$1,510.00");
});

test("invalid payment amounts never reach confirmation", async ({ page }) => {
  await page.goto("/pay/invoice-final");
  for (const amount of ["0", "1601", "1.001"]) {
    await page.getByLabel("Payment amount (USD)").fill(amount);
    await page
      .getByRole("button", { name: "Simulate payment", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm demo payment" }),
    ).toHaveCount(0);
  }
});

test("completed project cost changes require confirmation", async ({
  page,
}) => {
  const state = structuredClone(initialState);
  state.projects[0].status = "completed";
  state.expenses.push({
    id: "late-cost",
    merchant: "Late rental",
    amount: 10000,
    category: "Rentals",
    date: "2026-09-28",
  });
  await page.addInitScript(
    ({ storageKey, saved }) =>
      localStorage.setItem(storageKey, JSON.stringify(saved)),
    { storageKey: key, saved: state },
  );
  await page.goto("/");
  await navigate(page, "Expenses");
  await page
    .getByLabel("Project for Late rental")
    .selectOption("project-johnson");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("actual profit");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Project for Late rental")).toHaveValue("");
  await page
    .getByLabel("Project for Late rental")
    .selectOption("project-johnson");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByLabel("Project for Late rental")).toHaveValue(
    "project-johnson",
  );
  const projectStatus = await page.evaluate(
    (storageKey) =>
      JSON.parse(localStorage.getItem(storageKey)!).projects.find(
        (project: { id: string }) => project.id === "project-johnson",
      ).status,
    key,
  );
  expect(projectStatus).toBe("active");
});
