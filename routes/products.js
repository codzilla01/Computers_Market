const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getDb, formatProduct } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure multer v2 for product image uploads
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 32) || 'product';
    cb(null, `${safeBase}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB max
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('صيغة الصورة غير مدعومة. الصيغ المسموحة: JPG, PNG, WebP'));
    }
  }
});

function validateProductPayload(body, isUpdate = false) {
  const errors = [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const sku = typeof body.sku === 'string' ? body.sku.trim().toUpperCase() : '';
  const brand = typeof body.brand === 'string' ? body.brand.trim().toLowerCase() : '';
  const category = typeof body.category === 'string' ? body.category.trim().toLowerCase() : 'laptops';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const badge = typeof body.badge === 'string' ? body.badge.trim() : '';
  const image = typeof body.image === 'string' ? body.image.trim() : '';

  const price = Number(body.price);
  const old_price =
    body.old_price !== undefined && body.old_price !== null && body.old_price !== ''
      ? Number(body.old_price)
      : null;
  const stock = Number.isFinite(Number(body.stock)) ? parseInt(body.stock, 10) : 0;
  const rating =
    body.rating !== undefined && body.rating !== ''
      ? Math.min(5, Math.max(1, Number(body.rating)))
      : 4.8;
  const featured = body.featured === true || body.featured === 'true' || body.featured === 1 || body.featured === '1' ? 1 : 0;
  const active =
    body.active === false || body.active === 'false' || body.active === 0 || body.active === '0' ? 0 : 1;

  if (!title || title.length < 2) errors.push('اسم المنتج مطلوب (حرفان على الأقل).');
  if (!brand) errors.push('العلامة التجارية مطلوبة.');
  if (!Number.isFinite(price) || price <= 0) errors.push('السعر يجب أن يكون رقماً موجباً.');
  if (old_price !== null && (!Number.isFinite(old_price) || old_price <= 0)) {
    errors.push('السعر السابق غير صالح.');
  }
  if (!Number.isInteger(stock) || stock < 0) errors.push('الكمية بالمخزون يجب أن تكون 0 أو أكثر.');
  if (!description || description.length < 5) errors.push('وصف المنتج مطلوب.');
  if (!isUpdate && !image) errors.push('صورة المنتج مطلوبة.');

  let specs = {};
  if (body.specs) {
    if (typeof body.specs === 'string') {
      try {
        specs = JSON.parse(body.specs);
      } catch {
        errors.push('تنسيق المواصفات غير صالح.');
      }
    } else if (typeof body.specs === 'object' && !Array.isArray(body.specs)) {
      specs = body.specs;
    }
  }

  // Clean empty specs
  const cleanSpecs = {};
  for (const [k, v] of Object.entries(specs)) {
    const key = String(k).trim();
    const val = String(v).trim();
    if (key && val) cleanSpecs[key] = val;
  }

  return {
    errors,
    data: {
      sku: sku || `PRD-${Date.now().toString(36).toUpperCase()}`,
      title,
      brand,
      category: category || 'laptops',
      price: Math.round(price * 100) / 100,
      old_price: old_price !== null ? Math.round(old_price * 100) / 100 : null,
      stock,
      rating: Math.round(rating * 10) / 10,
      badge,
      image,
      description,
      specs_json: JSON.stringify(cleanSpecs),
      featured,
      active
    }
  };
}

// GET /api/products — public catalog with search, brand, category, stock, price, sort
router.get('/', (req, res) => {
  const db = getDb();
  const {
    brand,
    category,
    search,
    minPrice,
    maxPrice,
    inStock,
    sort = 'featured',
    includeInactive
  } = req.query;

  const conditions = [];
  const params = [];

  if (includeInactive !== '1') {
    conditions.push('active = 1');
  }
  if (brand && brand !== 'all') {
    conditions.push('LOWER(brand) = LOWER(?)');
    params.push(String(brand).trim());
  }
  if (category && category !== 'all') {
    conditions.push('LOWER(category) = LOWER(?)');
    params.push(String(category).trim());
  }
  if (inStock === '1' || inStock === 'true') {
    conditions.push('stock > 0');
  }
  if (minPrice !== undefined && minPrice !== '' && Number.isFinite(Number(minPrice))) {
    conditions.push('price >= ?');
    params.push(Number(minPrice));
  }
  if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(Number(maxPrice))) {
    conditions.push('price <= ?');
    params.push(Number(maxPrice));
  }
  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    conditions.push('(title LIKE ? OR brand LIKE ? OR description LIKE ? OR specs_json LIKE ? OR sku LIKE ?)');
    params.push(term, term, term, term, term);
  }

  let orderBy = 'featured DESC, id ASC';
  switch (sort) {
    case 'price_asc':
      orderBy = 'price ASC';
      break;
    case 'price_desc':
      orderBy = 'price DESC';
      break;
    case 'rating':
      orderBy = 'rating DESC, featured DESC';
      break;
    case 'newest':
      orderBy = 'id DESC';
      break;
    default:
      orderBy = 'featured DESC, id ASC';
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM products ${whereClause} ORDER BY ${orderBy}`).all(...params);
  res.json({ products: rows.map(formatProduct) });
});

// GET /api/products/:id — single product details
router.get('/:id', (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'معرّف المنتج غير صالح.' });
  }
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'المنتج غير موجود.' });
  }
  res.json({ product: formatProduct(row) });
});

// POST /api/products/upload — admin image upload
router.post('/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'فشل رفع الصورة.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم اختيار ملف صورة.' });
    }
    res.status(201).json({
      url: `/uploads/${req.file.filename}`,
      filename: req.file.filename
    });
  });
});

// POST /api/products — admin create product
router.post('/', requireAdmin, (req, res) => {
  const db = getDb();
  const { errors, data } = validateProductPayload(req.body, false);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }

  try {
    const result = db
      .prepare(`
        INSERT INTO products (sku, title, brand, category, price, old_price, stock, rating, badge, image, description, specs_json, featured, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.sku,
        data.title,
        data.brand,
        data.category,
        data.price,
        data.old_price,
        data.stock,
        data.rating,
        data.badge,
        data.image,
        data.description,
        data.specs_json,
        data.featured,
        data.active
      );

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ product: formatProduct(created), message: 'تم إضافة المنتج بنجاح.' });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'رمز المنتج (SKU) مستخدم مسبقاً.' });
    }
    return res.status(500).json({ error: 'حدث خطأ أثناء حفظ المنتج.' });
  }
});

// PUT /api/products/:id — admin update product
router.put('/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'معرّف المنتج غير صالح.' });
  }

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'المنتج غير موجود.' });
  }

  const { errors, data } = validateProductPayload(
    { ...formatProduct(existing), ...req.body },
    true
  );
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }

  const finalImage = data.image || existing.image;
  try {
    db.prepare(`
      UPDATE products
      SET sku = ?, title = ?, brand = ?, category = ?, price = ?, old_price = ?, stock = ?,
          rating = ?, badge = ?, image = ?, description = ?, specs_json = ?, featured = ?, active = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.sku,
      data.title,
      data.brand,
      data.category,
      data.price,
      data.old_price,
      data.stock,
      data.rating,
      data.badge,
      finalImage,
      data.description,
      data.specs_json,
      data.featured,
      data.active,
      id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json({ product: formatProduct(updated), message: 'تم تحديث بيانات المنتج بنجاح.' });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'رمز المنتج (SKU) مستخدم لمنتج آخر.' });
    }
    return res.status(500).json({ error: 'حدث خطأ أثناء تحديث المنتج.' });
  }
});

// PATCH /api/products/:id/stock — quick stock update
router.patch('/:id/stock', requireAdmin, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const stock = parseInt(req.body.stock, 10);
  if (!Number.isInteger(id) || !Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ error: 'قيمة المخزون غير صالحة.' });
  }
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'المنتج غير موجود.' });
  }
  db.prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(stock, id);
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json({ product: formatProduct(updated), message: 'تم تحديث المخزون.' });
});

// DELETE /api/products/:id — admin delete product
router.delete('/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'معرّف المنتج غير صالح.' });
  }
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'المنتج غير موجود.' });
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ message: 'تم حذف المنتج بنجاح.' });
});

module.exports = router;
