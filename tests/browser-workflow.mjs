import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const contexts = [];
const errors = [];
async function open(role, path, width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: 'reduce',
    timezoneId: 'Pacific/Honolulu',
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/login');
  await page.getByLabel('Adresa de email').fill(`${role}@demo.puntobianco.test`);
  await page.locator('[name=password]').fill(process.env.DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Conectare', exact: true }).click();
  await page.waitForURL('**/overview');
  await page.goto(base + path);
  return page;
}
try {
  const coordinator = await open('coordinator', '/patients', 375);
  await coordinator.getByRole('button', { name: 'Înregistrează pacient', exact: true }).click();
  const firstName = 'InterfataQA' + randomUUID().slice(0, 5);
  await coordinator.locator('[name="patient.firstName"]').fill(firstName);
  await coordinator.locator('[name="patient.lastName"]').fill('PacientFictiv');
  const arrival = new Date(Date.now() + 86400000),
    departure = new Date(Date.now() + 6 * 86400000);
  const date = (d) =>
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Chisinau',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  await coordinator.locator('[name="patient.arrival"]').fill(date(arrival) + 'T14:30');
  await coordinator.locator('[name="patient.departure"]').fill(date(departure) + 'T11:00');
  await coordinator
    .locator('[name="patient.treatment"]')
    .fill('Date fictive · verificare completă prin interfață.');
  await coordinator.getByRole('button', { name: 'Salvează vizita', exact: true }).click();
  await expect(coordinator.getByRole('dialog'))
    .toBeHidden({ timeout: 30000 })
    .catch(async (error) => {
      console.log('Form errors:', await coordinator.locator('.form-error').allTextContents());
      console.log(
        'Invalid fields:',
        await coordinator
          .locator('input:invalid,select:invalid,textarea:invalid')
          .evaluateAll((elements) =>
            elements.map((e) => ({ name: e.name, message: e.validationMessage })),
          ),
      );
      await coordinator.screenshot({ path: 'docs/screenshots/form-failure.png', fullPage: true });
      throw error;
    });
  await coordinator.getByRole('textbox', { name: 'Caută pacient', exact: true }).fill(firstName);
  await expect(coordinator.getByText(firstName + ' PacientFictiv', { exact: true })).toBeVisible({
    timeout: 20000,
  });
  console.log('PASS coordinator registers a patient through the 375px form');
  const backoffice = await open('backoffice', '/backoffice');
  await backoffice.getByRole('textbox', { name: 'Caută pacient', exact: true }).fill(firstName);
  const row = backoffice.getByRole('row').filter({ hasText: firstName });
  await row.getByRole('button', { name: 'Început', exact: true }).click();
  await row.getByRole('button', { name: 'Finalizat', exact: true }).click();
  await expect(row.getByText('Finalizat', { exact: true })).toBeVisible();
  console.log('PASS back office starts and completes the newly registered case through the UI');
  const manager = await open('accommodation', '/accommodation');
  await manager.getByRole('textbox', { name: 'Caută cazare' }).fill(firstName);
  const card = manager.locator('.lodging-card').filter({ hasText: firstName });
  await card.getByRole('button', { name: 'Rezervă cazarea', exact: true }).click();
  await manager.getByLabel('Referința rezervării').fill('UI-QA-FICTIV');
  await manager.getByLabel('Adresa cazării').fill('Strada Demonstrativă 12, Chișinău');
  await manager.getByRole('button', { name: 'Confirmă rezervarea', exact: true }).click();
  await expect(manager.getByRole('dialog')).toBeHidden();
  await expect(card.getByText('Rezervat', { exact: true })).toBeVisible();
  console.log('PASS accommodation manager reserves the new case through the UI');
  const driver = await open('driver', '/transfers', 375);
  if (
    new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Europe/Chisinau' }).format(
      new Date(),
    ) === 'Sunday'
  )
    await driver.getByRole('button', { name: 'Săptămâna următoare' }).click();
  await expect(
    driver.getByRole('heading', { name: `Sosire 14:30 – ${firstName} PacientFictiv`, exact: true }),
  ).toBeVisible();
  await driver.reload();
  if (
    new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Europe/Chisinau' }).format(
      new Date(),
    ) === 'Sunday'
  )
    await driver.getByRole('button', { name: 'Săptămâna următoare' }).click();
  await expect(
    driver.getByRole('heading', { name: `Sosire 14:30 – ${firstName} PacientFictiv`, exact: true }),
  ).toBeVisible();
  await driver.getByRole('button', { name: 'Notificări', exact: true }).click();
  await expect(driver.getByRole('heading', { name: 'Transferuri', exact: true })).toBeVisible();
  await expect(driver.locator('.notification-item').first()).toBeVisible();
  if (await driver.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw Error('Mobile transfer calendar overflows the document');
  console.log('PASS driver sees the transfer and persisted notifications after reload');
  await driver.getByRole('button', { name: 'Închide notificările', exact: true }).click();
  await driver.screenshot({ path: 'docs/screenshots/transfers-mobile.png', fullPage: true });
  const accountant = await open('accountant', '/accommodation');
  await expect(accountant.getByRole('heading', { name: 'Cazări', exact: true })).toBeVisible();
  await expect(
    accountant.getByRole('button', { name: 'Rezervă cazarea', exact: true }),
  ).toHaveCount(0);
  await accountant.goto(base + '/patients');
  await expect(
    accountant.getByRole('heading', { name: 'Acces restricționat', exact: true }),
  ).toBeVisible();
  const quality = await open('quality', '/patients');
  await expect(quality.getByRole('heading', { name: 'Pacienți', exact: true })).toBeVisible();
  await expect(
    quality.getByRole('button', { name: 'Înregistrează pacient', exact: true }),
  ).toHaveCount(0);
  const admin = await open('admin', '/team');
  await expect(admin.getByRole('heading', { name: 'Echipă', exact: true })).toBeVisible();
  await expect(admin.locator('tbody tr')).toHaveCount(7);
  console.log(
    'PASS accountant and quality have read-only screens; admin manages seven staff roles',
  );
  if (errors.length) throw Error(`Browser JavaScript errors: ${errors.length}`);
  console.log('Browser workflow complete; no JavaScript errors.');
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
}
