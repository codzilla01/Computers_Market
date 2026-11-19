const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

// Isolate test database in temp directory
const tmpDb = path.join(os.tmpdir(), `computers-market-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;

const { createApp } = require('../server');
const { closeDb } = require('../db/database');

let server;
let baseUrl;
let adminCookie = '';

async function request(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  if (options.auth && adminCookie) {
    headers['Cookie'] = adminCookie;
  }
  const res = await fetch(`${baseUrl}${urlPath}`, { ...options, headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, text, json };
}

test.before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    const f = `${tmpDb}${suffix}`;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

test('Static pages & healthcheck return 200', async () => {
  const health = await request('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.status, 'ok');

  for (const page of ['/', '/admin', '/policies', '/favicon.svg']) {
    const r = await request(page);
    assert.equal(r.status, 200, `Expected 200 for ${page}`);
  }
});

test('Public catalog loads seeded products and supports brand & search filters', async () => {
  const all = await request('/api/products');
  assert.equal(all.status, 200);
  assert.ok(all.json.products.length >= 9);

  const apple = await request('/api/products?brand=apple');
  assert.equal(apple.status, 200);
  assert.ok(apple.json.products.length >= 2);
  assert.ok(apple.json.products.every((p) => p.brand === 'apple'));

  const search = await request('/api/products?search=RTX');
  assert.equal(search.status, 200);
  assert.ok(search.json.products.length >= 2);
});

test('Admin routes reject unauthenticated access and login sets valid session cookie', async () => {
  const unauth = await request('/api/admin/stats');
  assert.equal(unauth.status, 401);

  const badLogin = await request('/api/admin/login', {
    method: 'POST',
    body: { email: 'admin@computers-market.sa', password: 'WrongPassword' }
  });
  assert.equal(badLogin.status, 401);

  const login = await request('/api/admin/login', {
    method: 'POST',
    body: { email: 'admin@computers-market.sa', password: 'Admin@2026' }
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.ok(setCookie && setCookie.includes('cm_admin_session='));
  adminCookie = setCookie.split(';')[0];

  const stats = await request('/api/admin/stats', { auth: true });
  assert.equal(stats.status, 200);
  assert.ok(stats.json.kpis.total_products >= 9);
});

test('Admin Product CRUD (create, update, quick stock, delete)', async () => {
  const created = await request('/api/products', {
    method: 'POST',
    auth: true,
    body: {
      sku: 'TST-MON-4K',
      title: 'شاشة احترافية 27 بوصة 4K',
      brand: 'dell',
      category: 'accessories',
      price: 1899,
      old_price: 2199,
      stock: 12,
      rating: 4.9,
      badge: 'جديد',
      image: '/assets/images/dell-xps-14.jpg',
      description: 'شاشة 4K IPS بدقة ألوان عالية للمصممين والمبرمجين.',
      specs: { 'الحجم': '27 بوصة', 'الدقة': '3840x2160 4K' }
    }
  });
  assert.equal(created.status, 201);
  const pid = created.json.product.id;

  const updated = await request(`/api/products/${pid}`, {
    method: 'PUT',
    auth: true,
    body: { price: 1799, stock: 8 }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.product.price, 1799);
  assert.equal(updated.json.product.stock, 8);

  const stocked = await request(`/api/products/${pid}/stock`, {
    method: 'PATCH',
    auth: true,
    body: { stock: 15 }
  });
  assert.equal(stocked.status, 200);
  assert.equal(stocked.json.product.stock, 15);

  const deleted = await request(`/api/products/${pid}`, {
    method: 'DELETE',
    auth: true
  });
  assert.equal(deleted.status, 200);
});

test('Coupon validation, atomic checkout, stock deduction, order tracking & stock restoration on cancel', async () => {
  const catalog = await request('/api/products');
  const product = catalog.json.products[0];
  const initialStock = product.stock;

  // Validate valid coupon
  const cpOk = await request('/api/coupons/validate', {
    method: 'POST',
    body: { code: 'SAVE10', subtotal: product.price }
  });
  assert.equal(cpOk.status, 200);
  assert.equal(cpOk.json.discount, Math.round(product.price * 0.1 * 100) / 100);

  // Overselling rejected
  const oversell = await request('/api/orders', {
    method: 'POST',
    body: {
      customer_name: 'اختبار عميل',
      customer_phone: '0501112223',
      city: 'الرياض',
      address: 'حي النرجس، شارع التخصصي',
      payment_method: 'cod',
      items: [{ product_id: product.id, quantity: initialStock + 5 }]
    }
  });
  assert.equal(oversell.status, 409);

  // Valid checkout with coupon
  const orderRes = await request('/api/orders', {
    method: 'POST',
    body: {
      customer_name: 'أحمد المالكي',
      customer_phone: '0558899001',
      customer_email: 'ahmed@test.sa',
      city: 'الرياض',
      address: 'حي الياسمين، طريق الملك سلمان، فيلا 20',
      payment_method: 'card',
      coupon_code: 'SAVE10',
      items: [{ product_id: product.id, quantity: 2 }]
    }
  });
  assert.equal(orderRes.status, 201);
  const order = orderRes.json.order;
  assert.equal(order.subtotal, product.price * 2);
  assert.ok(order.discount > 0);
  assert.ok(order.vat_amount > 0);
  assert.equal(order.payment_status, 'paid');

  // Verify stock deducted
  const afterBuy = await request(`/api/products/${product.id}`);
  assert.equal(afterBuy.json.product.stock, initialStock - 2);

  // Track order publicly
  const tracked = await request(`/api/orders/track?order_number=${encodeURIComponent(order.order_number)}&phone=0558899001`);
  assert.equal(tracked.status, 200);
  assert.equal(tracked.json.order.order_number, order.order_number);

  // Cancel order via admin -> stock automatically restored
  const cancelled = await request(`/api/orders/${order.id}/status`, {
    method: 'PATCH',
    auth: true,
    body: { status: 'cancelled' }
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.json.order.status, 'cancelled');

  const afterCancel = await request(`/api/products/${product.id}`);
  assert.equal(afterCancel.json.product.stock, initialStock);
});

test('Contact form submission & Admin inbox + Settings update', async () => {
  const msg = await request('/api/messages', {
    method: 'POST',
    body: {
      name: 'سلمان الشمري',
      email: 'salman@example.sa',
      phone: '0550001112',
      subject: 'استفسار عن الشحن',
      body: 'هل الشحن متاح لمدينة حائل وكم يستغرق؟'
    }
  });
  assert.equal(msg.status, 201);

  const inbox = await request('/api/messages', { auth: true });
  assert.equal(inbox.status, 200);
  assert.ok(inbox.json.messages.some((m) => m.id === msg.json.id));

  const setUpdate = await request('/api/admin/settings', {
    method: 'PUT',
    auth: true,
    body: { store_name: 'متجر تِك ماركت المحدّث' }
  });
  assert.equal(setUpdate.status, 200);
  assert.equal(setUpdate.json.settings.store_name, 'متجر تِك ماركت المحدّث');
});
