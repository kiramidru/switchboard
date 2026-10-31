import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const saveScreenshots = !!process.env.UPDATE_SCREENSHOTS;

test('workspace, examples, evidence, editing, completion, and downloads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/notice');
  await expect(page.getByText('Demo ready — try a fictional example')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make my action plan' })).toBeDisabled();
  if (saveScreenshots) await page.screenshot({ path: '../docs/screenshots/workspace.png', fullPage: true });
  await page.getByRole('button', { name: 'Try an example' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /The school trip letter/ }).click();
  await expect(page.getByText('Demo example', { exact: true })).toBeVisible();
  await expect(page.getByText('Get ready for the museum visit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show source', exact: true }).first().click();
  await expect(page.locator('mark')).toHaveText(/Please return the signed consent form/);
  await expect(page.locator('.evidence-quote')).toBeVisible();
  if (saveScreenshots) await page.screenshot({ path: '../docs/screenshots/action-plan.png', fullPage: true });
  await page.getByRole('checkbox').first().check();
  await expect(page.getByText('1 of 3 done')).toBeVisible();
  await page.getByRole('button', { name: 'Edit Pay the $12 transport contribution' }).click();
  await page.getByLabel('Action title').fill('Pay transport after checking the portal');
  await page.getByLabel('Date (optional)').fill('2027-06-12');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Title edited', { exact: true })).toBeVisible();
  await expect(page.getByText('Your date', { exact: true })).toBeVisible();
  const checklistPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download checklist' }).click();
  const checklist = await checklistPromise;
  expect(checklist.suggestedFilename()).toBe('demo-action-plan.txt');
  const calendarPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Calendar/ }).click();
  expect((await calendarPromise).suggestedFilename()).toBe('demo-action-plan.ics');
  expect(errors).toEqual([]);
});

test('custom notices are not given fake demo analysis', async ({ page }) => {
  await page.goto('/notice');
  await page.getByLabel('The original words').fill('Please return the registration form tomorrow.');
  await page.getByRole('button', { name: 'Make my action plan' }).click();
  await expect(page.getByRole('alert')).toContainText('Live AI is not configured');
  await expect(page.getByText('Demo example', { exact: true })).not.toBeVisible();
  await expect(page.getByLabel('The original words')).toHaveValue('Please return the registration form tomorrow.');
});

test('sample editing becomes a custom notice and clearing resets everything', async ({ page }) => {
  await page.goto('/notice');
  await expect(page.getByRole('button', { name: 'School', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'School', exact: true }).click();
  await expect(page.getByText('Fictional example', { exact: true })).toBeVisible();
  await page.getByLabel('The original words').fill('An edited custom notice.');
  await expect(page.getByText('Fictional example', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Make my action plan' }).click();
  await expect(page.getByRole('alert')).toContainText('Live AI is not configured');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByLabel('The original words')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Make my action plan' })).toBeDisabled();
});

test('housing and appointment demos preserve conditional actions and warnings', async ({ page }) => {
  for (const [label, title] of [
    ['The maintenance notice', 'Prepare for the water-meter inspection'],
    ['The appointment confirmation', 'Prepare for your library appointment'],
  ]) {
    await page.goto('/notice');
    await page.getByRole('button', { name: 'Try an example' }).click();
    await page.getByRole('button', { name: new RegExp(label) }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /If needed/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A few things to double-check' })).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(3);
  }
});

test('photo upload shows a preview and supports safe removal', async ({ page }) => {
  await page.goto('/notice');
  await page.getByRole('button', { name: 'Upload photo', exact: true }).click();
  await page.getByLabel('Upload a notice photo').setInputFiles({
    name: 'notice.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.getByAltText('Your uploaded notice')).toBeVisible();
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByAltText('Your uploaded notice')).not.toBeVisible();
  await expect(page.getByLabel('Upload a notice photo')).toBeVisible();
});

test('mobile layout fits, demo works, and dialogs support Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notice');
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('button', { name: /The school trip letter/ }).click();
  await expect(page.getByRole('heading', { name: 'Get ready for the museum visit' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (saveScreenshots) await page.screenshot({ path: '../docs/screenshots/mobile.png', fullPage: true });
});

test('workspace and action plan pass automated accessibility checks', async ({ page }) => {
  await page.goto('/notice');
  await expect(page.getByText('Demo ready — try a fictional example')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('button', { name: /The school trip letter/ }).click();
  await expect(page.getByText('Demo example', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('keyboard navigation can reach the main workspace', async ({ page }) => {
  await page.goto('/notice');
  await expect(page.getByRole('link', { name: 'Skip to notice workspace' })).toBeAttached();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to notice workspace' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#workspace$/);
});
