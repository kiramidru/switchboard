import { chromium, expect, test } from "@playwright/test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

test("actual unpacked extension synchronizes React from the isolated world", async ({
  baseURL,
}) => {
  const temporary = await mkdtemp(join(tmpdir(), "switchboard-extension-"));
  const extension = join(temporary, "extension");
  await cp(resolve("extension-dist"), extension, { recursive: true });
  const manifest = JSON.parse(
    await readFile(join(extension, "manifest.json"), "utf8"),
  );
  expect(manifest.permissions).toEqual(["activeTab", "scripting"]);
  expect(manifest.host_permissions).toBeUndefined();
  // Only this temporary test copy gets fixture-origin access: headless automation
  // cannot physically click Chrome's toolbar to supply the activeTab grant.
  manifest.host_permissions = [`${new URL(baseURL!).origin}/*`];
  await writeFile(join(extension, "manifest.json"), JSON.stringify(manifest));
  const context = await chromium.launchPersistentContext(
    join(temporary, "profile"),
    {
      headless: true,
      channel: "chromium",
      ignoreDefaultArgs: ["--disable-extensions"],
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    },
  );
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker"));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseURL!);
    await expect(page.locator("#full_name")).toBeVisible();
    await worker.evaluate(async (url) => {
      const api = (globalThis as any).chrome;
      const tabs = await api.tabs.query({});
      const tab = tabs.find((tab: any) => tab.url?.startsWith(url));
      await api.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["switchboard.js"],
      });
    }, baseURL!);
    const panel = page.getByRole("complementary", {
      name: "Switchboard task view",
    });
    await expect(
      panel.getByText("Browser extension", { exact: true }),
    ).toBeVisible();
    await panel.getByRole("button", { name: /^Your details/ }).click();
    await panel.getByRole("button", { name: /^Full name/ }).click();
    await panel
      .getByRole("textbox", { name: /^Value for/ })
      .fill("Isolated World");
    await panel.getByRole("button", { name: "Done with this field" }).click();
    await panel.getByRole("button", { name: /^Email address/ }).click();
    await panel
      .getByRole("textbox", { name: /^Value for/ })
      .fill("isolated@example.com");
    // An unrelated controlled React render must retain the value set by extension code.
    await page.locator("[name=newsletter]").check();
    await expect(page.locator("#full_name")).toHaveValue("Isolated World");
    await expect(page.locator("#email")).toHaveValue("isolated@example.com");
    expect(errors).toEqual([]);
    await panel
      .getByRole("button", { name: "Close Switchboard", exact: true })
      .click();
    await expect(page.locator("#switchboard-root")).not.toBeAttached();
  } finally {
    await context.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
