import { expect, test, type Page } from "@playwright/test";

async function attach(page: Page) {
  await expect(page.locator("form").first()).toBeVisible();
  await page.evaluate(async () => {
    const path = "/src/switchboard/adapter.ts";
    const { FormAdapter } = await import(path);
    (window as any).adapter = new FormAdapter();
  });
}
async function fields(page: Page) {
  return page.evaluate(
    () => (window as any).adapter.snapshot().forms[0].fields,
  );
}
async function write(page: Page, name: string, value: string | boolean) {
  return page.evaluate(
    ({ name, value }) => {
      const adapter = (window as any).adapter;
      const field = adapter
        .snapshot()
        .forms[0].fields.find((field: any) => field.name === name);
      return adapter.write(field.id, value);
    },
    { name, value },
  );
}
async function complete(page: Page, session = "repair") {
  for (const [name, value] of Object.entries({
    full_name: "Alex Kim",
    email: "alex@example.com",
    session,
    experience: "first-time",
    agreement: true,
  })) {
    expect((await write(page, name, value)).ok).toBe(true);
  }
}
async function review(page: Page) {
  return page.evaluate(() => {
    const adapter = (window as any).adapter;
    (window as any).review = adapter.review(adapter.snapshot().forms[0].id);
    return (window as any).review;
  });
}
async function submit(page: Page) {
  return page.evaluate(() =>
    (window as any).adapter.submit((window as any).review),
  );
}

test("native controls synchronize and the real API receives an explicit submission", async ({
  page,
}) => {
  await page.goto("/fixtures/native.html");
  await attach(page);
  await complete(page);
  await expect(page.locator("#name")).toHaveValue("Alex Kim");
  await expect(page.locator("[name=agreement]")).toBeChecked();
  await expect(
    page.locator("[name=experience][value=first-time]"),
  ).toBeChecked();
  expect((await review(page)).fingerprint).toBeTruthy();
  await expect(page.locator("#feedback")).toBeEmpty();
  const response = page.waitForResponse("**/api/practice/registrations");
  expect((await submit(page)).ok).toBe(true);
  expect((await response).status()).toBe(200);
  await expect(page.locator("#feedback")).toContainText(
    "Practice registration received",
  );
});

test("controlled React fields keep their values after unrelated renders", async ({
  page,
}) => {
  await page.goto("/");
  await attach(page);
  await complete(page);
  await write(page, "access_notes", "A plain text note.");
  await write(page, "newsletter", true);
  await expect(page.locator("#full_name")).toHaveValue("Alex Kim");
  await expect(page.locator("#email")).toHaveValue("alex@example.com");
  await expect(page.locator("#access_notes")).toHaveValue("A plain text note.");
  expect((await review(page)).fingerprint).toBeTruthy();
  const response = page.waitForResponse("**/api/practice/registrations");
  await submit(page);
  expect((await response).request().postDataJSON()).toMatchObject({
    full_name: "Alex Kim",
    newsletter: true,
    access_notes: "A plain text note.",
  });
  await expect(page.getByRole("status")).toContainText(
    "Practice registration received",
  );
});

test("native validation does not submit and identifies a field to correct", async ({
  page,
}) => {
  await page.goto("/");
  await attach(page);
  const result = await review(page);
  expect(result.ok).toBe(false);
  expect(result.fieldId).toBeTruthy();
  expect((await fields(page)).some((field: any) => field.error)).toBe(true);
});

test("server errors are read from the website and can be recovered", async ({
  page,
}) => {
  await page.goto("/");
  await attach(page);
  await complete(page, "laser");
  await review(page);
  await submit(page);
  await expect(page.locator("#session-error")).toContainText("now full");
  expect(
    (await fields(page)).find((field: any) => field.name === "session").error,
  ).toContain("now full");
  await write(page, "session", "sewing");
  await expect(page.locator("#session-error")).not.toBeVisible();
  expect((await review(page)).fingerprint).toBeTruthy();
  await submit(page);
  await expect(page.getByRole("status")).toContainText(
    "Practice registration received",
  );
});

test("a stale review cannot submit changed values", async ({ page }) => {
  await page.goto("/");
  await attach(page);
  await complete(page);
  await review(page);
  await page.locator("#email").fill("changed@example.com");
  const result = await submit(page);
  expect(result.ok).toBe(false);
  expect(result.message).toContain("changed after your review");
  await expect(page.locator("form")).toBeVisible();
});

test("replaced controls, disabled options, and sensitive forms are not silently used", async ({
  page,
}) => {
  await page.goto("/fixtures/native.html");
  await attach(page);
  const oldId = (await fields(page)).find(
    (field: any) => field.name === "full_name",
  ).id;
  await page.locator("#replace-name").click();
  const result = await page.evaluate(
    (id) => (window as any).adapter.write(id, "Stale name"),
    oldId,
  );
  expect(result.ok).toBe(false);
  await expect(page.locator("#name")).toHaveValue("");
  expect((await write(page, "session", "unavailable")).ok).toBe(false);
  await page.locator("#password").fill("NEVER_READ_THIS");
  const snapshot = await page.evaluate(() =>
    (window as any).adapter.snapshot(),
  );
  expect(JSON.stringify(snapshot)).not.toContain("NEVER_READ_THIS");
  expect(snapshot.forms[1].canSubmit).toBe(false);
  expect(snapshot.forms[1].unsupported).toHaveLength(1);
});

test("undo changes the actual page rather than just the task view", async ({
  page,
}) => {
  await page.goto("/");
  await attach(page);
  await write(page, "full_name", "First name");
  await write(page, "full_name", "Second name");
  await page.evaluate(() => (window as any).adapter.undo());
  await expect(page.locator("#full_name")).toHaveValue("First name");
});
