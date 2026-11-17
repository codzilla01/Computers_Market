const express = require('express');
const { getDb } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/coupons/validate — public validation for cart checkout
router.post('/validate', (req, res) => {
  const db = getDb();
  const code = String(req.body?.code || '').trim().toUpperCase();
  const subtotal = Number(req.body?.subtotal || 0);

  if (!code) {
    return res.status(400).json({ error: 'يرجى إدخال كود الخصم.' });
  }

  const coupon = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ? AND active = 1').get(code);
  if (!coupon) {
    return res.status(404).json({ error: 'كود الخصم غير صحيح أو غير مفعل.' });
  }
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
    return res.status(400).json({ error: 'تم استنفاد عدد استخدامات هذا الكود.' });
  }
  if (subtotal < coupon.min_order) {
    return res.status(400).json({
      error: `الحد الأدنى لتفعيل هذا الكود هو ${coupon.min_order.toLocaleString()} ر.س.`
    });
  }

  const discount =
    coupon.discount_type === 'percent'
      ? Math.round(((subtotal * coupon.discount_value) / 100) * 100) / 100
      : Math.round(Math.min(subtotal, coupon.discount_value) * 100) / 100;

  res.json({
    coupon: {
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order: coupon.min_order
    },
    discount,
    message: `تم تطبيق كود الخصم ${coupon.code} بنجاح!`
  });
});

// GET /api/coupons — admin list coupons
router.get('/', requireAdmin, (_req, res) => {
  const db = getDb();
  const coupons = db.prepare('SELECT * FROM coupons ORDER BY id DESC').all();
  res.json({ coupons });
});

// POST /api/coupons — admin create coupon
router.post('/', requireAdmin, (req, res) => {
  const db = getDb();
  const code = String(req.body?.code || '').trim().toUpperCase();
  const discount_type = req.body?.discount_type === 'fixed' ? 'fixed' : 'percent';
  const discount_value = Number(req.body?.discount_value);
  const min_order = Number(req.body?.min_order || 0);
  const max_uses = parseInt(req.body?.max_uses || 0, 10);

  if (!code || code.length < 3) {
    return res.status(400).json({ error: 'كود الخصم يجب أن يتكون من 3 أحرف على الأقل.' });
  }
  if (!Number.isFinite(discount_value) || discount_value <= 0) {
    return res.status(400).json({ error: 'قيمة الخصم يجب أن تكون موجبة.' });
  }
  if (discount_type === 'percent' && discount_value > 90) {
    return res.status(400).json({ error: 'نسبة الخصم لا يمكن أن تتجاوز 90%.' });
  }

  try {
    const result = db
      .prepare(`
        INSERT INTO coupons (code, discount_type, discount_value, min_order, max_uses, active)
        VALUES (?, ?, ?, ?, ?, 1)
      `)
      .run(code, discount_type, discount_value, Math.max(0, min_order), Math.max(0, max_uses));

    const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ coupon, message: 'تم إنشاء كود الخصم بنجاح.' });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'كود الخصم موجود مسبقاً.' });
    }
    return res.status(500).json({ error: 'تعذر إنشاء كود الخصم.' });
  }
});

// PATCH /api/coupons/:id — toggle active
router.patch('/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'الكود غير موجود.' });
  }
  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : existing.active ? 0 : 1;
  db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(active, id);
  const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
  res.json({ coupon, message: 'تم تحديث حالة الكود.' });
});

// DELETE /api/coupons/:id — delete coupon
router.delete('/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT id FROM coupons WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'الكود غير موجود.' });
  }
  db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
  res.json({ message: 'تم حذف كود الخصم.' });
});

module.exports = router;
