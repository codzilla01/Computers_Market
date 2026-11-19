const express = require('express');
const { getDb, getSettingsMap } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const VALID_PAYMENT_METHODS = new Set(['cod', 'card', 'bank']);
const VALID_STATUSES = new Set(['pending', 'processing', 'shipped', 'delivered', 'cancelled']);

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function generateOrderNumber(db) {
  const year = new Date().getFullYear();
  const last = db.prepare('SELECT MAX(id) AS maxId FROM orders').get();
  const seq = 1001 + (last && last.maxId ? Number(last.maxId) : 0);
  const rand = Math.floor(10 + Math.random() * 89);
  return `CM-${year}-${seq}${rand}`;
}

function attachOrderItems(db, order) {
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  return { ...order, items };
}

// POST /api/orders — public order creation with authoritative pricing & atomic stock update
router.post('/', (req, res) => {
  const db = getDb();
  const {
    customer_name,
    customer_phone,
    customer_email = '',
    city,
    address,
    notes = '',
    payment_method = 'cod',
    coupon_code = '',
    items
  } = req.body || {};

  if (!customer_name || String(customer_name).trim().length < 2) {
    return res.status(400).json({ error: 'يرجى إدخال الاسم الكامل.' });
  }
  const cleanPhone = String(customer_phone || '').replace(/\s+/g, '');
  if (!cleanPhone || cleanPhone.length < 8) {
    return res.status(400).json({ error: 'يرجى إدخال رقم جوال صحيح.' });
  }
  if (!city || String(city).trim().length < 2) {
    return res.status(400).json({ error: 'يرجى اختيار أو إدخال المدينة.' });
  }
  if (!address || String(address).trim().length < 5) {
    return res.status(400).json({ error: 'يرجى إدخال العنوان التفصيلي للتوصيل.' });
  }
  if (!VALID_PAYMENT_METHODS.has(payment_method)) {
    return res.status(400).json({ error: 'طريقة الدفع المختارة غير صالحة.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'سلة المشتريات فارغة.' });
  }

  // Merge duplicate productIds in items array
  const qtyByProduct = new Map();
  for (const item of items) {
    const pid = parseInt(item.product_id ?? item.id, 10);
    const qty = parseInt(item.quantity, 10);
    if (!Number.isInteger(pid) || !Number.isInteger(qty) || qty <= 0 || qty > 50) {
      return res.status(400).json({ error: 'بيانات المنتجات في السلة غير صالحة.' });
    }
    qtyByProduct.set(pid, (qtyByProduct.get(pid) || 0) + qty);
  }

  const settings = getSettingsMap(db);
  const vatRate = Number(settings.vat_rate || 15) / 100;
  const baseShipping = Number(settings.shipping_fee || 35);
  const freeThreshold = Number(settings.free_shipping_threshold || 1500);

  let createdOrderId = null;

  try {
    db.exec('BEGIN IMMEDIATE');

    const resolvedItems = [];
    let subtotal = 0;

    for (const [pid, qty] of qtyByProduct.entries()) {
      const product = db
        .prepare('SELECT id, title, image, price, stock, active FROM products WHERE id = ?')
        .get(pid);

      if (!product || !product.active) {
        throw { status: 404, message: 'أحد المنتجات في السلة لم يعد متوفراً.' };
      }
      if (product.stock < qty) {
        throw {
          status: 409,
          message: `الكمية المطلوبة من "${product.title}" غير متوفرة حالياً (المتوفر: ${product.stock}).`
        };
      }

      const lineTotal = roundMoney(product.price * qty);
      subtotal = roundMoney(subtotal + lineTotal);
      resolvedItems.push({
        product_id: product.id,
        product_title: product.title,
        product_image: product.image,
        unit_price: Number(product.price),
        quantity: qty,
        line_total: lineTotal
      });
    }

    // Validate coupon if supplied
    let discount = 0;
    let appliedCouponCode = '';
    const rawCode = String(coupon_code || '').trim().toUpperCase();
    if (rawCode) {
      const coupon = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ? AND active = 1').get(rawCode);
      if (!coupon) {
        throw { status: 400, message: 'كود الخصم غير صحيح أو منتهي الصلاحية.' };
      }
      if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
        throw { status: 400, message: 'تم استنفاد الحد الأقصى لاستخدام هذا الكود.' };
      }
      if (subtotal < coupon.min_order) {
        throw {
          status: 400,
          message: `الحد الأدنى لاستخدام الكود هو ${coupon.min_order.toLocaleString()} ر.س.`
        };
      }
      discount =
        coupon.discount_type === 'percent'
          ? roundMoney((subtotal * coupon.discount_value) / 100)
          : roundMoney(Math.min(subtotal, coupon.discount_value));
      appliedCouponCode = coupon.code;
      db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(coupon.id);
    }

    const discountedSubtotal = roundMoney(Math.max(0, subtotal - discount));
    const shippingFee = discountedSubtotal >= freeThreshold ? 0 : roundMoney(baseShipping);
    const vatAmount = roundMoney(discountedSubtotal * vatRate);
    const total = roundMoney(discountedSubtotal + shippingFee + vatAmount);

    const orderNumber = generateOrderNumber(db);
    const paymentStatus = payment_method === 'card' ? 'paid' : 'pending';

    const orderInsert = db
      .prepare(`
        INSERT INTO orders (
          order_number, customer_name, customer_phone, customer_email, city, address, notes,
          payment_method, payment_status, status, coupon_code, subtotal, discount, shipping_fee, vat_amount, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
      `)
      .run(
        orderNumber,
        String(customer_name).trim(),
        cleanPhone,
        String(customer_email || '').trim(),
        String(city).trim(),
        String(address).trim(),
        String(notes || '').trim(),
        payment_method,
        paymentStatus,
        appliedCouponCode,
        subtotal,
        discount,
        shippingFee,
        vatAmount,
        total
      );

    createdOrderId = orderInsert.lastInsertRowid;

    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_title, product_image, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const deductStockStmt = db.prepare(
      "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?"
    );

    for (const item of resolvedItems) {
      insertItemStmt.run(
        createdOrderId,
        item.product_id,
        item.product_title,
        item.product_image,
        item.unit_price,
        item.quantity,
        item.line_total
      );
      deductStockStmt.run(item.quantity, item.product_id);
    }

    db.exec('COMMIT');

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(createdOrderId);
    res.status(201).json({
      order: attachOrderItems(db, order),
      message: 'تم استلام طلبك بنجاح!'
    });
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // already rolled back
    }
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: 'تعذر إتمام الطلب حالياً. يرجى المحاولة لاحقاً.' });
  }
});

// GET /api/orders/track?order_number=...&phone=... — public order tracking
router.get('/track', (req, res) => {
  const db = getDb();
  const orderNumber = String(req.query.order_number || '').trim().toUpperCase();
  const phone = String(req.query.phone || '').replace(/\s+/g, '');

  if (!orderNumber) {
    return res.status(400).json({ error: 'يرجى إدخال رقم الطلب.' });
  }

  const order = db
    .prepare('SELECT * FROM orders WHERE UPPER(order_number) = ?')
    .get(orderNumber);

  if (!order) {
    return res.status(404).json({ error: 'لم يتم العثور على طلب بهذا الرقم.' });
  }

  // Optional phone suffix verification if provided
  if (phone && !order.customer_phone.endsWith(phone.slice(-6))) {
    return res.status(404).json({ error: 'رقم الجوال لا يطابق بيانات هذا الطلب.' });
  }

  const items = db
    .prepare('SELECT product_title, product_image, unit_price, quantity, line_total FROM order_items WHERE order_id = ?')
    .all(order.id);

  res.json({
    order: {
      order_number: order.order_number,
      customer_name: order.customer_name,
      city: order.city,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      subtotal: order.subtotal,
      discount: order.discount,
      shipping_fee: order.shipping_fee,
      vat_amount: order.vat_amount,
      total: order.total,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items
    }
  });
});

// GET /api/orders — admin list orders
router.get('/', requireAdmin, (req, res) => {
  const db = getDb();
  const { status, search } = req.query;
  const conditions = [];
  const params = [];

  if (status && status !== 'all' && VALID_STATUSES.has(status)) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    conditions.push('(order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR city LIKE ?)');
    params.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orders = db
    .prepare(`SELECT * FROM orders ${whereClause} ORDER BY id DESC`)
    .all(...params);

  const enriched = orders.map((order) => attachOrderItems(db, order));
  res.json({ orders: enriched });
});

// GET /api/orders/:id — admin single order
router.get('/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'معرّف الطلب غير صالح.' });
  }
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: 'الطلب غير موجود.' });
  }
  res.json({ order: attachOrderItems(db, order) });
});

// PATCH /api/orders/:id/status — admin update order status with automatic stock reconciliation
router.patch('/:id/status', requireAdmin, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const { status, payment_status } = req.body || {};

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'معرّف الطلب غير صالح.' });
  }
  if (status && !VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: 'حالة الطلب غير صالحة.' });
  }

  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'الطلب غير موجود.' });
  }

  const nextStatus = status || existing.status;
  const nextPaymentStatus =
    payment_status && ['pending', 'paid', 'refunded'].includes(payment_status)
      ? payment_status
      : nextStatus === 'delivered'
        ? 'paid'
        : nextStatus === 'cancelled' && existing.payment_status === 'paid'
          ? 'refunded'
          : existing.payment_status;

  try {
    db.exec('BEGIN IMMEDIATE');
    const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id);

    // Cancelling an active order -> restore stock
    if (existing.status !== 'cancelled' && nextStatus === 'cancelled') {
      const restoreStmt = db.prepare(
        "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?"
      );
      for (const item of items) {
        if (item.product_id) restoreStmt.run(item.quantity, item.product_id);
      }
    }

    // Re-activating a cancelled order -> verify & deduct stock
    if (existing.status === 'cancelled' && nextStatus !== 'cancelled') {
      for (const item of items) {
        if (!item.product_id) continue;
        const p = db.prepare('SELECT title, stock FROM products WHERE id = ?').get(item.product_id);
        if (!p || p.stock < item.quantity) {
          throw { status: 409, message: `لا يوجد مخزون كافٍ لإعادة تفعيل الطلب.` };
        }
      }
      const deductStmt = db.prepare(
        "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?"
      );
      for (const item of items) {
        if (item.product_id) deductStmt.run(item.quantity, item.product_id);
      }
    }

    db.prepare(
      "UPDATE orders SET status = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(nextStatus, nextPaymentStatus, id);

    db.exec('COMMIT');

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json({ order: attachOrderItems(db, updated), message: 'تم تحديث حالة الطلب بنجاح.' });
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: 'تعذر تحديث حالة الطلب.' });
  }
});

module.exports = router;
