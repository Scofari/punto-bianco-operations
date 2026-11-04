import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.pickerCalls = [];
    HTMLInputElement.prototype.showPicker = function () {
      window.pickerCalls.push(this.name);
    };
  });
  await page.goto(`${base}/login`);
  await page.getByLabel('Adresa de email').fill('admin@demo.puntobianco.test');
  await page.locator('[name=password]').fill(process.env.DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Conectare', exact: true }).click();
  await page.waitForURL('**/overview');
  await page.getByRole('button', { name: 'Înregistrează pacient', exact: true }).click();
  const arrival = page.locator('[name="patient.arrival"]');
  const departure = page.locator('[name="patient.departure"]');
  await arrival.fill('2026-11-10T12:00');
  await departure.fill('2026-11-15T14:00');
  await arrival.click({ position: { x: 40, y: 15 } });
  await departure.click({ position: { x: 40, y: 15 } });
  assert.deepEqual(await page.evaluate(() => window.pickerCalls), [
    'patient.arrival',
    'patient.departure',
  ]);
  await page.locator('[name="patient.accommodationFree"]').check();
  const nights = page.locator('[name="patient.freeNights"]');
  await nights.fill('3');
  await nights.press('Home');
  await nights.press('-');
  await expect(nights).toHaveValue('3');
  await nights.fill('-123');
  await expect(nights).toHaveValue('3');
  await nights.evaluate((input) => {
    const data = new DataTransfer();
    data.setData('text/plain', '-123');
    const event = new ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    if (input.dispatchEvent(event)) throw new Error('Negative paste was not prevented');
  });
  for (const value of ['0', '6', '366', '']) {
    await nights.fill(value);
    assert.equal(
      await nights.evaluate((input) => input.checkValidity()),
      false,
      `Invalid: ${value}`,
    );
  }
  await nights.fill('5');
  assert.equal(await nights.evaluate((input) => input.checkValidity()), true);
  await departure.fill('2026-11-12T14:00');
  await expect(nights).toHaveAttribute('aria-invalid', 'true');
  await nights.fill('2');
  await expect(nights).toHaveAttribute('aria-invalid', 'false');
  await departure.fill('2026-11-10T12:00');
  assert.equal(await departure.evaluate((input) => input.checkValidity()), false);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(nights).toHaveAttribute('inputmode', 'numeric');
  await page.getByLabel('Adaugă însoțitor').check();
  await page.getByLabel('Însoțitorul beneficiază și el de tratament').check();
  await page.locator('[name="companion.accommodationFree"]').check();
  const companionNights = page.locator('[name="companion.freeNights"]');
  await companionNights.fill('-9');
  await expect(companionNights).toHaveValue('1');
  const me = await (await page.request.get(`${base}/api/v1/me`)).json();
  const patient = {
    firstName: 'Validation',
    lastName: 'Example',
    coordinatorId: me.staff.id,
    arrival: '2026-11-10T10:00:00.000Z',
    departure: '2026-11-15T12:00:00.000Z',
    availability: '',
    treatment: 'Fictional validation',
    apartmentType: 'studio',
    accommodationFree: true,
    transfer: 'none',
    transferFree: true,
  };
  for (const freeNights of [-123, 0, 1.5, 6, 366]) {
    const response = await page.request.post(`${base}/api/v1/visits`, {
      headers: { origin: base, 'idempotency-key': randomUUID() },
      data: { patient: { ...patient, freeNights }, companion: null },
    });
    assert.equal(response.status(), 422, `API rejects ${freeNights}`);
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS: integer typing/paste, required/range checks, changed dates, companion, field-wide picker, mobile and five API rejection cases. No records created.',
  );
} finally {
  await browser.close();
}
