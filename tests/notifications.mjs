import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const contexts = [];
const pages = {};
const feeds = {};
const frames = {};
try {
  for (const role of ['admin', 'backoffice', 'accommodation', 'driver', 'accountant']) {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    pages[role] = page;
    feeds[role] = [];
    frames[role] = [];
    page.on('websocket', (socket) =>
      socket.on('framereceived', (event) => {
        try {
          const data = JSON.parse(String(event.payload));
          frames[role].push(Array.isArray(data) ? { event: data[3], payload: data[4] } : data);
        } catch {
          /* Non-JSON frame. */
        }
      }),
    );
    page.on('response', async (response) => {
      if (response.url().endsWith('/api/v1/notifications') && response.status() === 200)
        feeds[role].push(await response.json());
    });
    await page.goto(`${base}/login`);
    await page.getByLabel('Adresa de email').fill(`${role}@demo.puntobianco.test`);
    await page.locator('[name=password]').fill(process.env.DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Conectare', exact: true }).click();
    await page.waitForURL('**/overview');
    await expect.poll(() => feeds[role].length, { timeout: 15000 }).toBeGreaterThan(0);
  }
  const admin = pages.admin;
  const staff = (await (await admin.request.get(`${base}/api/v1/staff`)).json()).items;
  const coordinator = staff.find((s) => s.role === 'coordinator');
  const patient = {
    firstName: 'NotificationQA',
    lastName: randomUUID().slice(0, 8),
    arrival: new Date(Date.now() + 86400000).toISOString(),
    departure: new Date(Date.now() + 4 * 86400000).toISOString(),
    coordinatorId: coordinator.id,
    availability: '',
    treatment: 'Fictional private clinical text',
    apartmentType: 'studio',
    accommodationFree: false,
    freeNights: 0,
    transfer: 'round_trip',
    transferFree: true,
  };
  const key = randomUUID();
  const payload = { patient, companion: null };
  const created = await admin.request.post(`${base}/api/v1/visits`, {
    headers: { origin: base, 'idempotency-key': key },
    data: payload,
  });
  assert.equal(created.status(), 201);
  const { id } = await created.json();
  for (const role of ['backoffice', 'accommodation', 'driver']) {
    await expect
      .poll(
        () =>
          frames[role].some(
            (f) => f.event === 'postgres_changes' && JSON.stringify(f).includes(id),
          ),
        { timeout: 12000 },
      )
      .toBe(true);
    await expect
      .poll(() => feeds[role].some((f) => f.items.some((n) => n.resource_id === id)), {
        timeout: 12000,
      })
      .toBe(true);
    const items = (await (await pages[role].request.get(`${base}/api/v1/notifications`)).json())
      .items;
    assert.equal(items.filter((n) => n.resource_id === id).length, 1);
    assert.equal(JSON.stringify(items).includes(patient.treatment), false);
    console.log(
      `PASS ${role}: realtime delivery, automatic feed refresh, one persisted notification, no clinical content`,
    );
  }
  const replay = await admin.request.post(`${base}/api/v1/visits`, {
    headers: { origin: base, 'idempotency-key': key },
    data: payload,
  });
  assert.equal(replay.status(), 200);
  for (const role of ['backoffice', 'accommodation', 'driver']) {
    const items = (await (await pages[role].request.get(`${base}/api/v1/notifications`)).json())
      .items;
    assert.equal(
      items.filter((n) => n.resource_id === id).length,
      1,
      'Retry must not duplicate notifications',
    );
  }
  const accountantItems = (
    await (await pages.accountant.request.get(`${base}/api/v1/notifications`)).json()
  ).items;
  assert.equal(
    accountantItems.some((n) => n.resource_id === id),
    false,
  );
  console.log('PASS retry does not duplicate notifications; unrelated accountant receives none');
  const manager = pages.accommodation;
  await manager.getByRole('button', { name: 'Notificări', exact: true }).click();
  await expect(manager.locator('.notification-item').first()).toBeVisible();
  await manager.getByRole('button', { name: 'Închide notificările' }).click();
  await expect(manager.locator('.notification-dot')).toHaveCount(0);
  const previousFeeds = feeds.accommodation.length;
  await manager.reload();
  await expect
    .poll(() => feeds.accommodation.length, { timeout: 15000 })
    .toBeGreaterThan(previousFeeds);
  const persisted = (await (await manager.request.get(`${base}/api/v1/notifications`)).json())
    .items;
  assert.ok(persisted.some((n) => n.resource_id === id));
  const remembered = (await manager.locator('.notification-dot').count()) === 0;
  console.log(`Viewed indicator remembered after reload: ${remembered}`);
  const withoutTransfer = await admin.request.post(`${base}/api/v1/visits`, {
    headers: { origin: base, 'idempotency-key': randomUUID() },
    data: { patient: { ...patient, transfer: 'none' }, companion: null },
  });
  assert.equal(withoutTransfer.status(), 201);
  const noTransferId = (await withoutTransfer.json()).id;
  const driverItems = (
    await (await pages.driver.request.get(`${base}/api/v1/notifications`)).json()
  ).items;
  const noFalseAlert = !driverItems.some((n) => n.resource_id === noTransferId);
  console.log(`No driver alert for a visit without transfers: ${noFalseAlert}`);
  assert.ok(remembered, 'Viewed indicator should remain cleared after reload');
  assert.ok(noFalseAlert, 'Driver should not receive a transfer alert when none exists');
  await expect
    .poll(
      () => feeds.accommodation.some((f) => f.items.some((n) => n.resource_id === noTransferId)),
      { timeout: 12000 },
    )
    .toBe(true);
  await expect(manager.locator('.notification-dot')).toBeVisible();
  console.log('PASS a genuinely new notification restores the indicator after reload');
  await manager.context().setOffline(true);
  const offlineCreated = await admin.request.post(`${base}/api/v1/visits`, {
    headers: { origin: base, 'idempotency-key': randomUUID() },
    data: { patient: { ...patient, transfer: 'none' }, companion: null },
  });
  assert.equal(offlineCreated.status(), 201);
  const offlineId = (await offlineCreated.json()).id;
  await manager.context().setOffline(false);
  await manager.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect
    .poll(() => feeds.accommodation.some((f) => f.items.some((n) => n.resource_id === offlineId)), {
      timeout: 12000,
    })
    .toBe(true);
  console.log('PASS notifications created during disconnection are recovered on reconnect/focus');
  const edit = async (version, person) => {
    const response = await admin.request.patch(`${base}/api/v1/visits/${id}`, {
      headers: { origin: base },
      data: { version, patient: person },
    });
    assert.equal(response.status(), 200);
  };
  const driverCount = async () =>
    (await (await pages.driver.request.get(`${base}/api/v1/notifications`)).json()).items.filter(
      (n) => n.resource_id === id,
    ).length;
  const clinicalEdit = { ...patient, treatment: 'Changed fictional treatment only' };
  await edit(1, clinicalEdit);
  assert.equal(await driverCount(), 1, 'Clinical edits must not notify drivers');
  await edit(2, { ...clinicalEdit, transfer: 'none' });
  assert.equal(await driverCount(), 2, 'Removing a transfer must notify drivers');
  await edit(3, {
    ...clinicalEdit,
    transfer: 'none',
    treatment: 'Another fictional clinical edit',
  });
  assert.equal(await driverCount(), 2, 'Editing a visit with no transfer must not notify drivers');
  console.log(
    'PASS driver alerts track logistics changes and transfer removal, not clinical edits',
  );
  console.log('Notification checks passed.');
} catch (error) {
  console.log(
    'Realtime system messages:',
    Object.fromEntries(
      Object.entries(frames).map(([role, values]) => [
        role,
        values
          .filter((f) => f.event === 'system')
          .map((f) => ({ status: f.payload?.status, message: f.payload?.message })),
      ]),
    ),
  );
  console.log(
    'Realtime frame diagnostics:',
    Object.fromEntries(
      Object.entries(frames).map(([role, values]) => [
        role,
        values.slice(-6).map((f) => ({
          event: f.event,
          keys: Object.keys(f.payload || {}),
          status: f.payload?.status,
          responseKeys: Object.keys(f.payload?.response || {}),
        })),
      ]),
    ),
  );
  throw error;
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
}
