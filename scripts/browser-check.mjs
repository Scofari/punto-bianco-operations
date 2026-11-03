import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto((process.env.TEST_BASE_URL || 'http://localhost:3000') + '/login');
await page.getByLabel('Adresa de email').fill('admin@demo.puntobianco.test');
await page.locator('input[name=password]').fill(process.env.DEMO_PASSWORD);
await page.getByRole('button', { name: 'Conectare', exact: true }).click();
await page.waitForURL('**/overview', { timeout: 30000 });
await page.getByRole('table').waitFor({ timeout: 30000 });
await mkdir('docs/screenshots', { recursive: true });
await page.screenshot({ path: 'docs/screenshots/overview-desktop.png', fullPage: true });
console.log(
  'Desktop authenticated overview:',
  await page.getByRole('heading', { level: 1 }).innerText(),
);
console.log('Visible patient rows:', await page.locator('tbody tr').count());
await page.setViewportSize({ width: 375, height: 812 });
await page.screenshot({ path: 'docs/screenshots/overview-mobile.png', fullPage: true });
console.log(
  'Mobile document overflow:',
  await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
);
console.log(
  'Overflow elements:',
  await page.evaluate(() =>
    Array.from(document.querySelectorAll('body *'))
      .map((e) => ({
        tag: e.tagName,
        class: e.className,
        right: e.getBoundingClientRect().right,
        width: e.getBoundingClientRect().width,
      }))
      .filter((e) => e.right > window.innerWidth + 2 && !String(e.class).includes('sidebar'))
      .slice(0, 15),
  ),
);
await page.getByRole('button', { name: 'Înregistrează pacient', exact: true }).click();
await page.getByRole('dialog').waitFor();
await page.screenshot({ path: 'docs/screenshots/registration-mobile.png', fullPage: true });
await writeFile('docs/screenshots/browser-errors.json', JSON.stringify(errors, null, 2));
console.log('Browser errors:', errors.length);
await browser.close();
