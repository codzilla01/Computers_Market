const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, getSettingsMap, formatProduct } = require('../db/database');
const {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireAdmin
} = require('../middleware/auth');

const router = express.Router();

// Public storefront settings endpoint
router.get('/public-settings', (_req, res) => {
  const settings = getSettingsMap();
  res.json({ settings });
});

// POST /api/admin/login
router.post('/login', (req, res) => {
  const db = getDb();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE LOWER(email) = ?').get(email);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
  }

  const token = createSessionToken(admin);
  setSessionCookie(res, token);

  res.json({
    admin: { id: admin.id, email: admin.email, name: admin.name },
    message: 'تم تسجيل الدخول بنجاح.'
  });
});

// POST /api/admin/logout
router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ message: 'تم تسجيل الخروج بنجاح.' });
});

// GET /api/admin/me
router.get('/me', requireAdmin, (req, res) => {
  res.json({
    admin: {
      id: req.admin.id,
      email: req.admin.email,
      name: req.admin.name
    }
  });
});

// POST /api/admin/password
router.post('/password', requireAdmin, (req, res) => {
  const db = getDb();
  const currentPassword = String(req.body?.current_password || '');
  const newPassword = String(req.body?.new_password || '');

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن لا تقل عن 8 أحرف.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة.' });
  }

  const nextHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(nextHash, admin.id);
  res.json({ message: 'تم تغيير كلمة المرور بنجاح.' });
});

// GET /api/admin/stats — dashboard KPIs & analytics
router.get('/stats', requireAdmin, (_req, res) => {
  const db = getDb();

  const salesSummary = db
    .prepare(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS total_revenue,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_orders,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing_orders,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) AS shipped_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders
      FROM orders
    `)
    .get();

  const productSummary = db
    .prepare(`
      SELECT
        COUNT(*) AS total_products,
        SUM(CASE WHEN stock <= 5 THEN 1 ELSE 0 END) AS low_stock_count,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) AS out_of_stock_count,
        COALESCE(SUM(stock), 0) AS total_inventory_units
      FROM products
    `)
    .get();

  const unreadMessages = db
    .prepare('SELECT COUNT(*) AS count FROM messages WHERE is_read = 0')
    .get().count;

  const recentOrders = db
    .prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 6')
    .all();

  const lowStockProducts = db
    .prepare('SELECT * FROM products WHERE stock <= 6 ORDER BY stock ASC LIMIT 6')
    .all()
    .map(formatProduct);

  const brandBreakdown = db
    .prepare(`
      SELECT
        brand,
        COUNT(*) AS product_count,
        COALESCE(SUM(stock), 0) AS stock_units
      FROM products
      GROUP BY brand
      ORDER BY product_count DESC
    `)
    .all();

  res.json({
    kpis: {
      total_revenue: Math.round(Number(salesSummary.total_revenue || 0) * 100) / 100,
      total_orders: Number(salesSummary.total_orders || 0),
      pending_orders: Number(salesSummary.pending_orders || 0),
      processing_orders: Number(salesSummary.processing_orders || 0),
      shipped_orders: Number(salesSummary.shipped_orders || 0),
      delivered_orders: Number(salesSummary.delivered_orders || 0),
      total_products: Number(productSummary.total_products || 0),
      low_stock_count: Number(productSummary.low_stock_count || 0),
      out_of_stock_count: Number(productSummary.out_of_stock_count || 0),
      total_inventory_units: Number(productSummary.total_inventory_units || 0),
      unread_messages: Number(unreadMessages || 0)
    },
    recent_orders: recentOrders,
    low_stock_products: lowStockProducts,
    brand_breakdown: brandBreakdown
  });
});

// PUT /api/admin/settings — update store settings
router.put('/settings', requireAdmin, (req, res) => {
  const db = getDb();
  const allowedKeys = new Set([
    'store_name',
    'store_tagline',
    'phone',
    'whatsapp',
    'email',
    'address',
    'hours_weekdays',
    'hours_weekend',
    'vat_rate',
    'shipping_fee',
    'free_shipping_threshold',
    'currency',
    'bank_name',
    'bank_iban',
    'bank_account_name'
  ]);

  const updates = req.body || {};
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedKeys.has(key)) continue;
    upsert.run(key, String(value ?? '').trim());
  }

  res.json({
    settings: getSettingsMap(db),
    message: 'تم حفظ إعدادات المتجر بنجاح.'
  });
});

module.exports = router;
