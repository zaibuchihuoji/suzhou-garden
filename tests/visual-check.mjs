import { chromium } from 'playwright-core';
import { VIEWS } from '../src/garden/layout.js';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--disable-gpu-sandbox']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`${message.location().url}: ${message.text()}`); });
page.on('requestfailed', (request) => errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__gardenReady === true, { timeout: 60000 });
  await page.waitForSelector('#loading-screen.done', { timeout: 60000 });
  await page.locator('#walk-button').click();
  if (await page.locator('#walk-button').getAttribute('aria-pressed') !== 'true') throw new Error('walking mode did not start');
  await page.waitForFunction(() => window.__gardenStats.cameraPosition?.[2] === 12, null, { timeout: 60000 });
  const before = await page.evaluate(() => window.__gardenStats.cameraPosition);
  await page.keyboard.down('KeyW');
  await page.waitForFunction((z) => window.__gardenStats.cameraPosition[2] < z - 0.1, before[2], { timeout: 60000 });
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');
  if (await page.locator('#walk-button').getAttribute('aria-pressed') !== 'false') throw new Error('Escape did not exit walking mode');
  for (const view of VIEWS) {
    await page.evaluate((id) => window.__setGardenView(id), view.id);
    await page.waitForFunction((position) => window.__gardenStats.cameraPosition?.every((v, i) => Math.abs(v - position[i]) < 0.01), view.position, { timeout: 60000 });
    const path = `screenshots/${view.id}.png`;
    await page.screenshot({ path, animations: 'disabled' });
    console.log(`${view.index} ${view.label}: ${path}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverlap = await page.evaluate(() => {
    const walk = document.querySelector('#walk-button').getBoundingClientRect();
    const nav = document.querySelector('#view-list').getBoundingClientRect();
    return walk.left < nav.right && walk.right > nav.left && walk.top < nav.bottom && walk.bottom > nav.top;
  });
  if (mobileOverlap) throw new Error('walking button overlaps the mobile view navigation');
  await page.evaluate(() => window.__setGardenView('overview'));
  await page.waitForFunction((position) => window.__gardenStats.cameraPosition?.every((v, i) => Math.abs(v - position[i]) < 0.01), VIEWS[0].position, { timeout: 60000 });
  await page.screenshot({ path: 'screenshots/mobile.png', animations: 'disabled' });
  console.log('Mobile: screenshots/mobile.png');
  console.log('UI:', await page.evaluate(() => ({ active: document.querySelectorAll('.view-item.active').length, canvas: document.querySelectorAll('#garden-canvas canvas').length, nav: document.querySelectorAll('.view-item').length })));
  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
} finally {
  await browser.close();
}
