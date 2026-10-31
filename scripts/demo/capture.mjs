import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, mkdtemp, cp, rm, readdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const require = createRequire(join(ROOT, 'frontend/package.json'));
const { chromium, expect } = require('@playwright/test');
const plan = JSON.parse(await readFile(join(ROOT, 'scripts/demo/storyboard.json'), 'utf8'));
const out = join(ROOT, '.build/demo');
await mkdir(join(out, 'raw'), { recursive: true });
const base = process.env.SWITCHBOARD_DEMO_URL || 'http://127.0.0.1:8000';
const temporary = await mkdtemp(join(tmpdir(), 'switchboard-film-'));
const extension = join(temporary, 'extension');
await cp(join(ROOT, 'frontend/extension-dist'), extension, { recursive: true });
const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
if (manifest.host_permissions || JSON.stringify(manifest.permissions) !== JSON.stringify(['activeTab', 'scripting'])) throw new Error('Unexpected shipped permissions');
manifest.host_permissions = [`${new URL(base).origin}/*`]; // Recording copy only; never distributed.
await writeFile(join(extension, 'manifest.json'), JSON.stringify(manifest));
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
if (!executablePath) {
  try {
    for (const name of await readdir('/nix/store')) {
      if (!/-chromium-\d/.test(name)) continue;
      const candidate = join('/nix/store', name, 'bin/chromium');
      try { await access(candidate); executablePath = candidate; break; } catch { /* not an executable output */ }
    }
  } catch { /* Use installed Playwright Chromium on non-Nix systems. */ }
}
const metadata = { viewport: { width: 1800, height: 900 }, source: 'Installed Chromium extension', testOnlyFixturePermission: true,
  extensionSHA256: createHash('sha256').update(await readFile(join(extension, 'switchboard.js'))).digest('hex'),
  scenes: [], presses: [], responses: [], errors: [] };
const context = await chromium.launchPersistentContext(join(temporary, 'profile'), {
  headless: true, channel: 'chromium', ...(executablePath ? { executablePath } : {}),
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  viewport: metadata.viewport, deviceScaleFactor: 1,
  recordVideo: { dir: join(out, 'raw'), size: metadata.viewport },
});
const page = await context.newPage();
const video = page.video();
let zero = 0;
let recordingWorker;
let recordingTabId;
let pace = { tick: 35, before: 100, after: 130 };
const time = () => (performance.now() - zero) / 1000;
const panel = page.getByRole('complementary', { name: 'Switchboard task view' });
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
page.on('pageerror', error => metadata.errors.push(error.message));
page.on('response', response => {
  if (response.url().endsWith('/api/practice/registrations')) metadata.responses.push({ time: time(), status: response.status(), method: response.request().method() });
});

async function press() {
  metadata.presses.push(time());
  await page.keyboard.press('Space');
  await sleep(pace.after);
}
async function select(pattern) {
  const button = panel.getByRole('button', { name: pattern }).first();
  await expect(button).toBeVisible();
  const start = panel.getByRole('button', { name: 'Start scanning', exact: true });
  if (await start.count()) { await start.focus(); await press(); }
  for (let ticks = 0; ticks < 45; ticks++) {
    if (await button.getAttribute('data-sb-current') === 'true') break;
    await recordingWorker.evaluate(async tabId => {
      await globalThis.chrome.scripting.executeScript({ target: { tabId }, func: () => globalThis.__switchboardFilmAdvance?.() });
    }, recordingTabId);
    await sleep(pace.tick);
  }
  await expect(button).toHaveAttribute('data-sb-current', 'true');
  await sleep(pace.before);
  await press();
}
async function pause() {
  if (await panel.getByRole('button', { name: 'Pause scanning', exact: true }).count()) await select(/^Pause scanning$/);
}
async function scrollSource(selector, top = 180) {
  await page.locator(selector).evaluate((element, top) => window.scrollTo({ top: Math.max(0, window.scrollY + element.getBoundingClientRect().top - top), behavior: 'instant' }), top);
  await sleep(250);
}
async function type(text) {
  const rows = ['abcde','fghij','klmno','pqrst','uvwxyz','01234','56789',"@.-_+'",'/:?!,&','=()#%*','[]";\\$'];
  for (const char of text) {
    const upper = char !== char.toLowerCase();
    const currentUpper = (await panel.locator('.sb-keyboard-heading>span').innerText()) === 'Uppercase';
    if (/[a-z]/i.test(char) && upper !== currentUpper) await select(currentUpper ? /^Use lowercase$/ : /^Use uppercase$/);
    const index = rows.findIndex(row => row.includes(char.toLowerCase()));
    if (index < 0) throw new Error(`No row for ${char}`);
    const row = panel.locator(`[data-sb-scan="key-row-${index}"]`);
    await select(new RegExp('^' + escapeRegex(await row.getAttribute('aria-label')) + '$'));
    await select(new RegExp('^Type ' + escapeRegex(char) + '$'));
  }
}
async function scene(id, action) {
  const planned = plan.segments.find(scene => scene.id === id);
  const start = time();
  console.log(`Recording ${id} (${planned.duration}s target)…`);
  await action();
  const actionsEnd = time();
  const remaining = planned.duration - (time() - start);
  if (remaining > 0) await sleep(remaining * 1000);
  const end = time();
  metadata.scenes.push({ id, start, end, duration: end - start, actionsDuration: actionsEnd - start });
  console.log(`Captured ${id}: ${(end - start).toFixed(2)}s; actions ${(actionsEnd - start).toFixed(2)}s`);
}

try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  recordingWorker = worker;
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Join a workshop' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await sleep(800);
  // Full-frame magenta slate gives the editor an objective sync point in the raw recording.
  await page.evaluate(() => {
    const slate = document.createElement('div'); slate.id = 'film-sync-slate';
    slate.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#ff00ff';
    document.body.append(slate);
  });
  await sleep(240);
  await page.locator('#film-sync-slate').evaluate(element => element.remove());
  zero = performance.now();

  await scene('problem', async () => {
    await sleep(1800); await page.mouse.wheel(0, 330); await sleep(2500);
    await page.mouse.wheel(0, 190); await sleep(2100);
    await page.locator('#full_name').focus(); await sleep(1300);
  });
  await scene('activate', async () => {
    await scrollSource('#registration', 150); await sleep(700);
    recordingTabId = await worker.evaluate(async url => {
      const api = globalThis.chrome;
      const tabs = await api.tabs.query({});
      const tab = tabs.find(tab => tab.url?.startsWith(url));
      // A deterministic, recording-only scanner clock in this extension's isolated
      // world. This edits waiting time, never DOM values, choices, or responses.
      await api.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        const originalSet = globalThis.setInterval.bind(globalThis);
        const originalClear = globalThis.clearInterval.bind(globalThis);
        const callbacks = new Map();
        globalThis.setInterval = (callback, delay, ...args) => {
          if (![800, 1200, 1800].includes(delay)) return originalSet(callback, delay, ...args);
          const id = originalSet(() => {}, 3600000);
          callbacks.set(id, () => callback(...args));
          return id;
        };
        globalThis.clearInterval = id => { callbacks.delete(id); originalClear(id); };
        globalThis.__switchboardFilmAdvance = () => { for (const callback of [...callbacks.values()]) callback(); };
      } });
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['switchboard.js'] });
      return tab.id;
    }, base);
    await expect(panel.getByText('Browser extension', { exact: true })).toBeVisible();
    await scrollSource('#registration', 140); await sleep(1500);
  });
  metadata.scanTiming = 'Recording-only scanner clock controls in the isolated world; only wait timing is edited.';
  await scene('navigate', async () => {
    pace = { tick: 135, before: 380, after: 450 };
    await sleep(600); await panel.getByRole('button', { name: 'Start scanning', exact: true }).focus(); await press();
    await sleep(800); await select(/^Your details/); await sleep(700); await select(/^Full name/);
    await sleep(1600); await pause();
  });
  await scene('type', async () => {
    pace = { tick: 18, before: 95, after: 125 };
    await scrollSource('#full_name', 270);
    await type('Alex'); await sleep(500);
    await select(/^Done with this field$/); await select(/^Email address/);
    await type('al@x.io'); await select(/^Done with this field$/);
    await select(/^Back to sections$/); await pause();
    await expect(page.locator('#full_name')).toHaveValue('Alex');
    await expect(page.locator('#email')).toHaveValue('al@x.io');
    metadata.textEntered = { name: 'Alex', email: 'al@x.io', method: 'Space events and row-column keyboard; no fill/paste' };
    await scrollSource('#full_name', 260);
  });
  await scene('review', async () => {
    pace = { tick: 20, before: 120, after: 160 };
    await select(/^Your workshop/); await select(/^Workshop session/); await select(/^Laser-cutting introduction/);
    await select(/^Have you joined/); await select(/^This is my first visit$/);
    await select(/^Back to sections$/); await select(/^A little more/);
    await select(/^I understand/); await select(/^Yes — check this box$/);
    await select(/^Back to sections$/); await select(/^Review before sending$/); await pause();
    if (metadata.responses.length) throw new Error('A registration was sent before confirmation');
    await scrollSource('#session', 350);
  });
  await scene('rejection', async () => {
    pace = { tick: 55, before: 250, after: 200 };
    const response = page.waitForResponse('**/api/practice/registrations');
    await select(/^Confirm: Reserve my place$/);
    if ((await response).status() !== 422) throw new Error('Expected a real server rejection');
    await sleep(200);
    await expect(page.locator('#session-error')).toContainText('now full');
    await pause(); await scrollSource('#session', 340); await sleep(500);
  });
  await scene('recovery', async () => {
    pace = { tick: 70, before: 280, after: 250 };
    await select(/^Your workshop/); await select(/^Workshop session/); await select(/^Sewing basics/);
    await expect(page.locator('#session-error')).not.toBeVisible();
    await select(/^Back to sections$/); await select(/^Review before sending$/); await pause();
    await scrollSource('#session', 350);
  });
  await scene('success', async () => {
    pace = { tick: 65, before: 300, after: 250 };
    const response = page.waitForResponse('**/api/practice/registrations');
    await select(/^Confirm: Reserve my place$/);
    if ((await response).status() !== 200) throw new Error('Expected an actual accepted request');
    await sleep(200);
    await expect(page.locator('.cg-receipt')).toContainText('Practice registration received');
    await pause(); await scrollSource('#registration', 150);
  });
  await scene('trust', async () => {
    pace = { tick: 65, before: 280, after: 250 };
    await select(/^Settings$/); await pause();
    await panel.locator('.sb-how-to').last().scrollIntoViewIfNeeded();
    await sleep(700);
  });
  if (metadata.errors.length) throw new Error(metadata.errors.join('\n'));
  if (metadata.responses.map(response => response.status).join(',') !== '422,200') throw new Error('Unexpected network outcomes');
  metadata.recordedPresses = metadata.presses.length;
  await sleep(300);
} finally {
  metadata.rawPath = await video.path();
  await page.close(); await context.close();
  await writeFile(join(out, 'capture.json'), JSON.stringify(metadata, null, 2));
  await rm(temporary, { recursive: true, force: true });
}
console.log(`Saved ${metadata.rawPath}; ${metadata.recordedPresses} actual Space presses; server responses ${metadata.responses.map(item => item.status).join(' → ')}`);
