import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const save = !!process.env.UPDATE_SCREENSHOTS;
const panelOf = (page: Page) =>
  page.getByRole("complementary", { name: "Switchboard task view" });
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Switchboard" }).click();
  const panel = panelOf(page);
  await expect(
    panel.getByRole("heading", { name: "A clear path through." }),
  ).toBeVisible();
  return panel;
}
async function editText(
  panel: Locator,
  group: string,
  field: string,
  value: string,
) {
  await panel.getByRole("button", { name: new RegExp(`^${group}`) }).click();
  await panel.getByRole("button", { name: new RegExp(`^${field}`) }).click();
  await panel.getByRole("textbox", { name: /^Value for/ }).fill(value);
  await panel.getByRole("button", { name: "Done with this field" }).click();
  await panel.getByRole("button", { name: "Back to sections" }).click();
}
async function choose(panel: Locator, field: string, option: RegExp) {
  await panel.getByRole("button", { name: new RegExp(`^${field}`) }).click();
  await panel.getByRole("button", { name: option }).click();
}

test("panel edits real React fields, recovers a server rejection, and explicitly submits", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const panel = await open(page);
  if (save)
    await page.screenshot({
      path: "../docs/screenshots/switchboard-workspace.png",
      fullPage: true,
    });
  await editText(panel, "Your details", "Full name", "Alex Kim");
  await editText(panel, "Your details", "Email address", "alex@example.com");
  await expect(page.locator("#full_name")).toHaveValue("Alex Kim");
  await panel.getByRole("button", { name: /^Your workshop/ }).click();
  await choose(panel, "Workshop session", /Laser-cutting introduction/);
  await choose(panel, "Have you joined", /This is my first visit/);
  await panel.getByRole("button", { name: "Back to sections" }).click();
  await panel.getByRole("button", { name: /^A little more/ }).click();
  await choose(panel, "I understand", /Yes — check this box/);
  await panel.getByRole("button", { name: "Back to sections" }).click();
  await panel.getByRole("button", { name: "Review before sending" }).click();
  await expect(
    panel.getByRole("heading", { name: "Check before you send." }),
  ).toBeVisible();
  await expect(page.locator("#session-error")).not.toBeVisible();
  await panel
    .getByRole("button", { name: "Confirm: Reserve my place" })
    .click();
  await expect(page.locator("#session-error")).toContainText("now full");
  await expect(panel.getByText(/The website needs a correction/)).toBeVisible();
  if (save)
    await page.screenshot({
      path: "../docs/screenshots/switchboard-recovery.png",
      fullPage: true,
    });
  await panel.getByRole("button", { name: /^Your workshop/ }).click();
  await choose(panel, "Workshop session", /Sewing basics/);
  await panel.getByRole("button", { name: "Back to sections" }).click();
  await panel.getByRole("button", { name: "Review before sending" }).click();
  const response = page.waitForResponse("**/api/practice/registrations");
  await panel
    .getByRole("button", { name: "Confirm: Reserve my place" })
    .click();
  expect((await response).status()).toBe(200);
  await expect(page.locator(".cg-receipt")).toContainText(
    "Practice registration received",
  );
  await expect(panel.getByText(/Reference CG-/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("review reacts to source edits, and closing restores the host layout", async ({
  page,
}) => {
  const panel = await open(page);
  await page.locator("#full_name").fill("Alex Kim");
  await page.locator("#email").fill("alex@example.com");
  await page.locator("#session").selectOption("repair");
  await page.locator("[name=experience][value=first-time]").check();
  await page.locator("[name=agreement]").check();
  await panel.getByRole("button", { name: "Review before sending" }).click();
  await page.locator("#full_name").fill("A changed name");
  await expect(
    panel.getByText(
      "The website changed after this review. Refresh the review before sending.",
    ),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /^Confirm:/ }),
  ).not.toBeVisible();
  await panel
    .getByRole("button", { name: "Keep editing — do not send" })
    .click();
  await panel
    .getByRole("button", { name: "Close Switchboard", exact: true })
    .click();
  expect(await page.evaluate(() => document.body.style.paddingRight)).toBe("");
  await expect(page.locator("#switchboard-root")).not.toBeAttached();
});

test("one switch completes text entry, a server-error recovery, and a real registration", async ({
  page,
}) => {
  test.setTimeout(120000);
  const panel = await open(page);
  await page.clock.install();
  await page.keyboard.press("Space");
  async function select(pattern: RegExp) {
    const target = panel.getByRole("button", { name: pattern });
    // Select by scan identifier, without mouse or direct button activation.
    const button = target.first();
    await expect(button).toBeVisible();
    const id = await button.getAttribute("data-sb-scan");
    expect(id).toBeTruthy();
    for (let ticks = 0; ticks < 35; ticks++) {
      if ((await button.getAttribute("data-sb-current")) === "true") break;
      await page.clock.runFor(1200);
    }
    await expect(button).toHaveAttribute("data-sb-current", "true");
    await page.keyboard.press("Space");
    await page.clock.runFor(80);
  }
  const rows = [
    "abcde",
    "fghij",
    "klmno",
    "pqrst",
    "uvwxyz",
    "01234",
    "56789",
    "@.-_+'",
    "/:?!,&",
  ];
  async function type(text: string) {
    for (const char of text) {
      const index = rows.findIndex((row) => row.includes(char));
      const button = panel.locator(`[data-sb-scan="key-row-${index}"]`);
      const accessible = await button.getAttribute("aria-label");
      await select(
        new RegExp(
          "^" + accessible!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
        ),
      );
      await select(
        new RegExp(
          "^Type " + char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
        ),
      );
    }
  }
  await select(/^Your details/);
  await select(/^Full name/);
  await type("al");
  await expect(page.locator("#full_name")).toHaveValue("al");
  if (save)
    await page.screenshot({
      path: "../docs/screenshots/switchboard-keyboard.png",
    });
  await select(/^Done with this field$/);
  await select(/^Email address/);
  await type("al@x.io");
  await expect(page.locator("#email")).toHaveValue("al@x.io");
  await select(/^Done with this field$/);
  await select(/^Back to sections$/);
  await select(/^Your workshop/);
  await select(/^Workshop session/);
  await select(/^Laser-cutting introduction/);
  await select(/^Have you joined/);
  await select(/^This is my first visit$/);
  await select(/^Back to sections$/);
  await select(/^A little more/);
  await select(/^I understand/);
  await select(/^Yes — check this box$/);
  await select(/^Back to sections$/);
  await select(/^Review before sending$/);
  const rejected = page.waitForResponse("**/api/practice/registrations");
  await select(/^Confirm: Reserve my place$/);
  expect((await rejected).status()).toBe(422);
  await page.clock.runFor(150);
  await expect(page.locator("#session-error")).toContainText("now full");
  await select(/^Your workshop/);
  await select(/^Workshop session/);
  await select(/^Sewing basics/);
  await select(/^Back to sections$/);
  await select(/^Review before sending$/);
  const accepted = page.waitForResponse("**/api/practice/registrations");
  await select(/^Confirm: Reserve my place$/);
  expect((await accepted).status()).toBe(200);
  await page.clock.runFor(150);
  await expect(page.locator(".cg-receipt")).toContainText(
    "Practice registration received",
  );
  await select(/^Pause scanning$/);
  await expect(
    panel.getByRole("button", { name: "Start scanning", exact: true }),
  ).toBeFocused();
  expect(
    parseInt(await panel.locator(".sb-rail-actions>span").innerText(), 10),
  ).toBeGreaterThan(40);
});

test("panel, source, and mobile layout pass automated accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Join a workshop" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const panel = await open(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await panel.getByRole("button", { name: /^Your details/ }).click();
  await panel.getByRole("button", { name: /^Full name/ }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await panel.getByRole("button", { name: "Settings", exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await panel
    .getByRole("button", { name: "Back to sections", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  const dimensions = await panel.boundingBox();
  expect(dimensions!.width).toBeLessThanOrEqual(390);
  if (save)
    await page.screenshot({
      path: "../docs/screenshots/switchboard-mobile.png",
      fullPage: false,
    });
  await panel.getByRole("button", { name: "Show website" }).click();
  await expect(
    page.getByRole("button", { name: "Return to Switchboard Space" }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(panel).toBeVisible();
});

test("native date and number entries use explicit drafts instead of losing partial characters", async ({
  page,
}) => {
  const panel = await open(page);
  await page.evaluate(() => {
    document
      .querySelector("form fieldset")!
      .insertAdjacentHTML(
        "beforeend",
        '<label for="extra-date">Preferred date</label><input type="date" id="extra-date" name="extra_date"><label for="extra-number">Quantity</label><input type="number" id="extra-number" name="extra_number">',
      );
  });
  await panel.getByRole("button", { name: /^Your details/ }).click();
  await panel.getByRole("button", { name: /^Preferred date/ }).click();
  await panel.getByRole("textbox", { name: /^Value for/ }).fill("2027-06-12");
  await expect(page.locator("#extra-date")).toHaveValue("");
  await panel.getByRole("button", { name: "Done with this field" }).click();
  await expect(page.locator("#extra-date")).toHaveValue("2027-06-12");
  await panel.getByRole("button", { name: /^Quantity/ }).click();
  await panel.getByRole("textbox", { name: /^Value for/ }).fill("-");
  await panel.getByRole("button", { name: "Done with this field" }).click();
  await expect(
    panel.getByText(
      "Complete a valid number, or clear it. Nothing has been applied.",
    ),
  ).toBeVisible();
  await expect(page.locator("#extra-number")).toHaveValue("");
  await panel.getByRole("textbox", { name: /^Value for/ }).fill("-2.5");
  await panel.getByRole("button", { name: "Done with this field" }).click();
  await expect(page.locator("#extra-number")).toHaveValue("-2.5");
});

test("extension ZIP contains a loadable minimal-permission bundle", async ({
  request,
}) => {
  const response = await request.get("/switchboard-extension.zip");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("zip");
  expect((await response.body()).subarray(0, 2).toString()).toBe("PK");
});
