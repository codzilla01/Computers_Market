const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'store.db');

let dbInstance = null;

function ensureDir(filePath) {
  if (filePath === ':memory:') return;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDb() {
  if (dbInstance) return dbInstance;
  ensureDir(DB_PATH);
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  initSchema(db);
  seedDatabase(db);
  dbInstance = db;
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      brand TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'laptops',
      price REAL NOT NULL,
      old_price REAL,
      stock INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 4.8,
      badge TEXT DEFAULT '',
      image TEXT NOT NULL,
      description TEXT NOT NULL,
      specs_json TEXT NOT NULL DEFAULT '{}',
      featured INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
      discount_value REAL NOT NULL,
      min_order REAL NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 0,
      used_count INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT DEFAULT '',
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      notes TEXT DEFAULT '',
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
      coupon_code TEXT DEFAULT '',
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      shipping_fee REAL NOT NULL DEFAULT 0,
      vat_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_title TEXT NOT NULL,
      product_image TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Backward-compatible migrations for databases created before username login
  migrateAdminsUsername(db);
}

function migrateAdminsUsername(db) {
  const columns = db.prepare('PRAGMA table_info(admins)').all();
  if (columns.some((c) => c.name === 'username')) return;

  db.exec('ALTER TABLE admins ADD COLUMN username TEXT');

  // Backfill unique usernames from the email prefix so existing admins keep working
  const admins = db.prepare('SELECT id, email FROM admins ORDER BY id ASC').all();
  const used = new Set();
  const updateStmt = db.prepare('UPDATE admins SET username = ? WHERE id = ?');
  for (const admin of admins) {
    let base = String(admin.email || 'admin')
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '');
    if (base.length < 3) base = 'admin';
    let candidate = base;
    let counter = 1;
    while (used.has(candidate)) {
      counter += 1;
      candidate = `${base}${counter}`;
    }
    used.add(candidate);
    updateStmt.run(candidate, admin.id);
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_username ON admins(username)');
}

function seedDatabase(db) {
  // 1. Seed default Admin
  const adminCount = db.prepare('SELECT COUNT(*) AS count FROM admins').get().count;
  if (adminCount === 0) {
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const defaultEmail = process.env.ADMIN_EMAIL || 'admin@computers-market.sa';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'Admin@2026';
    const hash = bcrypt.hashSync(defaultPassword, 10);
    db.prepare('INSERT INTO admins (username, email, name, password_hash) VALUES (?, ?, ?, ?)').run(
      defaultUsername,
      defaultEmail,
      'مدير المتجر',
      hash
    );
  }

  // 2. Seed Store Settings
  const defaultSettings = {
    store_name: 'تِك ماركت للكمبيوتر',
    store_tagline: 'متجرك الموثوق لأحدث أجهزة الكمبيوتر المحمولة والمكتبية وأجهزة الألعاب',
    phone: '+966 11 456 7890',
    whatsapp: '966501234567',
    email: 'sales@techmarket.sa',
    address: 'طريق الملك فهد، حي العليا، الرياض، المملكة العربية السعودية',
    hours_weekdays: 'الأحد - الخميس: 9:00 صباحاً - 10:00 مساءً',
    hours_weekend: 'الجمعة - السبت: 4:00 مساءً - 10:00 مساءً',
    vat_rate: '15',
    shipping_fee: '35',
    free_shipping_threshold: '1500',
    currency: 'ر.س',
    bank_name: 'مصرف الراجحي',
    bank_iban: 'SA44 8000 0215 6080 1054 3210',
    bank_account_name: 'مؤسسة تِك ماركت للحاسبات وتقنية المعلومات'
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }

  // 3. Seed Products
  const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  if (productCount === 0) {
    const initialProducts = [
      {
        sku: 'APL-MBP16-M4P',
        title: 'MacBook Pro 16" M4 Pro',
        brand: 'apple',
        category: 'laptops',
        price: 9499,
        old_price: 10299,
        stock: 9,
        rating: 4.9,
        badge: 'الأكثر مبيعاً',
        image: '/assets/images/macbook-pro-16.jpg',
        description: 'أقوى لابتوب احترافي من أبل بشريحة M4 Pro وشاشة Liquid Retina XDR فائقة الدقة، مثالي للمبرمجين والمصممين ومحرري الفيديو 4K/8K.',
        specs: {
          'الشاشة': '16.2 بوصة Liquid Retina XDR (120Hz)',
          'المعالج': 'Apple M4 Pro (14 نواة)',
          'الذاكرة': '24 جيجابايت Unified Memory',
          'التخزين': '1 تيرابايت NVMe SSD',
          'البطارية': 'تصل إلى 24 ساعة',
          'الضمان': 'سنتان ضمان الوكيل الرسمي'
        },
        featured: 1
      },
      {
        sku: 'APL-MBA13-M3',
        title: 'MacBook Air 13" M3',
        brand: 'apple',
        category: 'laptops',
        price: 4599,
        old_price: 4999,
        stock: 15,
        rating: 4.9,
        badge: 'عرض خاص',
        image: '/assets/images/macbook-air-m3.jpg',
        description: 'تصميم نحيف وخفيف الوزن بسمك 1.13 سم مع أداء صامت بدون مروحة وشريحة M3 السريعة للعمل والدراسة طوال اليوم.',
        specs: {
          'الشاشة': '13.6 بوصة Liquid Retina',
          'المعالج': 'Apple M3 (8 أنوية)',
          'الذاكرة': '16 جيجابايت Unified Memory',
          'التخزين': '512 جيجابايت SSD',
          'البطارية': 'تصل إلى 18 ساعة',
          'الضمان': 'سنتان ضمان الوكيل الرسمي'
        },
        featured: 1
      },
      {
        sku: 'DEL-XPS14-U7',
        title: 'Dell XPS 14 Core Ultra 7',
        brand: 'dell',
        category: 'business',
        price: 6899,
        old_price: 7399,
        stock: 7,
        rating: 4.8,
        badge: 'جديد',
        image: '/assets/images/dell-xps-14.jpg',
        description: 'جهاز Ultrabook فاخر بهيكل ألمنيوم منحوت وشاشة OLED بلا حواف مع معالج Intel Core Ultra المدعوم بالذكاء الاصطناعي.',
        specs: {
          'الشاشة': '14.5 بوصة OLED 3.2K تعمل باللمس',
          'المعالج': 'Intel Core Ultra 7 155H',
          'الذاكرة': '32 جيجابايت LPDDR5x',
          'التخزين': '1 تيرابايت NVMe Gen4 SSD',
          'كرت الشاشة': 'NVIDIA RTX 4050 6GB',
          'نظام التشغيل': 'Windows 11 Pro'
        },
        featured: 1
      },
      {
        sku: 'HP-SPC14-X360',
        title: 'HP Spectre x360 14 OLED',
        brand: 'hp',
        category: 'business',
        price: 5999,
        old_price: 6499,
        stock: 6,
        rating: 4.8,
        badge: '2 في 1',
        image: '/assets/images/hp-spectre-x360.jpg',
        description: 'جهاز مرن 2 في 1 قابل للدوران 360 درجة مع قلم ذكي مرفق وشاشة OLED مذهلة، يجمع بين الأناقة والأداء الاحترافي.',
        specs: {
          'الشاشة': '14 بوصة 2.8K OLED لمس 120Hz',
          'المعالج': 'Intel Core Ultra 7 155H',
          'الذاكرة': '16 جيجابايت LPDDR5x',
          'التخزين': '1 تيرابايت PCIe Gen4 SSD',
          'البطارية': 'تصل إلى 17 ساعة',
          'نظام التشغيل': 'Windows 11 Home'
        },
        featured: 0
      },
      {
        sku: 'LEN-TPX1-G12',
        title: 'Lenovo ThinkPad X1 Carbon Gen 12',
        brand: 'lenovo',
        category: 'business',
        price: 7299,
        old_price: null,
        stock: 11,
        rating: 4.9,
        badge: 'للأعمال',
        image: '/assets/images/lenovo-thinkpad-x1.jpg',
        description: 'المعيار الذهبي لأجهزة رجال الأعمال؛ هيكل ألياف كربونية بوزن 1.09 كجم فقط مع أمان مؤسسي ولوحة مفاتيح أسطورية.',
        specs: {
          'الشاشة': '14 بوصة 2.8K OLED مضادة للانعكاس',
          'المعالج': 'Intel Core Ultra 7 vPro',
          'الذاكرة': '32 جيجابايت LPDDR5x',
          'التخزين': '1 تيرابايت NVMe SSD',
          'الوزن': '1.09 كجم',
          'نظام التشغيل': 'Windows 11 Pro'
        },
        featured: 1
      },
      {
        sku: 'ASU-ROG-G16',
        title: 'ASUS ROG Zephyrus G16 RTX 4070',
        brand: 'asus',
        category: 'gaming',
        price: 8299,
        old_price: 8999,
        stock: 5,
        rating: 4.9,
        badge: 'الأقوى للألعاب',
        image: '/assets/images/asus-rog-zephyrus.jpg',
        description: 'لابتوب ألعاب فائق النحافة بشاشة OLED بتردد 240Hz وكرت RTX 4070 ونظام تبريد ثلاثي المراوح لأعلى أداء في الألعاب والتصميم ثلاثي الأبعاد.',
        specs: {
          'الشاشة': '16 بوصة ROG Nebula OLED 240Hz',
          'المعالج': 'AMD Ryzen AI 9 HX 370',
          'الذاكرة': '32 جيجابايت LPDDR5x',
          'التخزين': '2 تيرابايت NVMe Gen4 SSD',
          'كرت الشاشة': 'NVIDIA GeForce RTX 4070 8GB',
          'نظام التشغيل': 'Windows 11 Home'
        },
        featured: 1
      },
      {
        sku: 'MSI-PRO-RTX4080',
        title: 'جهاز ألعاب احترافي RTX 4080 Super',
        brand: 'msi',
        category: 'desktops',
        price: 9899,
        old_price: 10799,
        stock: 4,
        rating: 5.0,
        badge: 'تجميعة احترافية',
        image: '/assets/images/gaming-desktop-pc.jpg',
        description: 'كمبيوتر مكتبي احترافي مُجمّع ومختبر للألعاب بدقة 4K وأعمال الذكاء الاصطناعي والمونتاج، مع تبريد مائي 360mm وإضاءة ARGB.',
        specs: {
          'المعالج': 'Intel Core i9-14900K (24 نواة)',
          'كرت الشاشة': 'NVIDIA GeForce RTX 4080 Super 16GB',
          'الذاكرة': '64 جيجابايت DDR5 6000MHz',
          'التخزين': '2 تيرابايت NVMe Gen4 SSD',
          'التبريد': 'تبريد مائي 360mm ARGB',
          'مزود الطاقة': '1000W 80+ Gold Modular'
        },
        featured: 1
      },
      {
        sku: 'DEL-INS15-I5',
        title: 'Dell Inspiron 15 3530',
        brand: 'dell',
        category: 'laptops',
        price: 2699,
        old_price: 2999,
        stock: 22,
        rating: 4.6,
        badge: 'قيمة ممتازة',
        image: '/assets/images/dell-inspiron-15.jpg',
        description: 'خيار عملي واقتصادي للطلاب والمكاتب بشاشة 15.6 بوصة بتردد 120Hz وأداء سريع وموثوق للمهام اليومية.',
        specs: {
          'الشاشة': '15.6 بوصة FHD 120Hz',
          'المعالج': 'Intel Core i5-1335U (الجيل 13)',
          'الذاكرة': '16 جيجابايت DDR4',
          'التخزين': '512 جيجابايت NVMe SSD',
          'البطارية': 'شحن سريع ExpressCharge',
          'نظام التشغيل': 'Windows 11 Home'
        },
        featured: 0
      },
      {
        sku: 'HP-PAV15-R7',
        title: 'HP Pavilion 15 Ryzen 7',
        brand: 'hp',
        category: 'laptops',
        price: 3199,
        old_price: 3499,
        stock: 18,
        rating: 4.7,
        badge: '',
        image: '/assets/images/hp-pavilion-15.jpg',
        description: 'لابتوب يومي أنيق يوازن بين الأداء القوي والسعر المناسب مع صوتيات B&O وتصميم معدني جذاب للعمل والدراسة.',
        specs: {
          'الشاشة': '15.6 بوصة FHD IPS مضادة للتوهج',
          'المعالج': 'AMD Ryzen 7 7730U',
          'الذاكرة': '16 جيجابايت DDR4',
          'التخزين': '512 جيجابايت NVMe SSD',
          'البطارية': 'تصل إلى 10 ساعات',
          'نظام التشغيل': 'Windows 11 Home'
        },
        featured: 0
      }
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (sku, title, brand, category, price, old_price, stock, rating, badge, image, description, specs_json, featured, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const p of initialProducts) {
      insertProduct.run(
        p.sku,
        p.title,
        p.brand,
        p.category,
        p.price,
        p.old_price,
        p.stock,
        p.rating,
        p.badge,
        p.image,
        p.description,
        JSON.stringify(p.specs),
        p.featured
      );
    }
  }

  // 4. Seed Discount Coupons
  const couponCount = db.prepare('SELECT COUNT(*) AS count FROM coupons').get().count;
  if (couponCount === 0) {
    const insertCoupon = db.prepare(`
      INSERT INTO coupons (code, discount_type, discount_value, min_order, max_uses, used_count, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    insertCoupon.run('SAVE10', 'percent', 10, 2000, 100, 12);
    insertCoupon.run('WELCOME5', 'percent', 5, 500, 500, 34);
    insertCoupon.run('PRO300', 'fixed', 300, 4000, 50, 4);
  }

  // 5. Seed Sample Orders for immediate dashboard analytics & order tracking demo
  const orderCount = db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
  if (orderCount === 0) {
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_number, customer_name, customer_phone, customer_email, city, address, notes,
        payment_method, payment_status, status, coupon_code, subtotal, discount, shipping_fee, vat_amount, total, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_title, product_image, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const p1 = db.prepare('SELECT id, title, image, price FROM products WHERE sku = ?').get('APL-MBP16-M4P');
    const p2 = db.prepare('SELECT id, title, image, price FROM products WHERE sku = ?').get('ASU-ROG-G16');
    const p3 = db.prepare('SELECT id, title, image, price FROM products WHERE sku = ?').get('DEL-INS15-I5');

    if (p1 && p2 && p3) {
      // Order 1 - Delivered
      const o1 = insertOrder.run(
        'CM-2026-1001',
        'عبدالله السبيعي',
        '0551234567',
        'abdullah@example.com',
        'الرياض',
        'حي الملقا، شارع أنس بن مالك، فيلا 14',
        'التوصيل بعد الساعة 5 مساءً',
        'card',
        'paid',
        'delivered',
        'PRO300',
        9499,
        300,
        0,
        1379.85,
        10578.85,
        '2026-11-12 14:20:00'
      );
      insertItem.run(o1.lastInsertRowid, p1.id, p1.title, p1.image, p1.price, 1, p1.price);

      // Order 2 - Shipped
      const o2 = insertOrder.run(
        'CM-2026-1002',
        'سارة القحطاني',
        '0509876543',
        'sara@example.com',
        'جدة',
        'حي الشاطئ، طريق الكورنيش، مبنى 8',
        '',
        'card',
        'paid',
        'shipped',
        '',
        8299,
        0,
        0,
        1244.85,
        9543.85,
        '2026-11-14 18:45:00'
      );
      insertItem.run(o2.lastInsertRowid, p2.id, p2.title, p2.image, p2.price, 1, p2.price);

      // Order 3 - Processing
      const o3 = insertOrder.run(
        'CM-2026-1003',
        'خالد العتيبي',
        '0543219876',
        'khalid@example.com',
        'الدمام',
        'حي الفيصلية، شارع الملك فهد',
        'يرجى الاتصال قبل الوصول',
        'cod',
        'pending',
        'processing',
        'WELCOME5',
        5398,
        269.9,
        0,
        769.22,
        5897.32,
        '2026-11-16 09:15:00'
      );
      insertItem.run(o3.lastInsertRowid, p3.id, p3.title, p3.image, p3.price, 2, p3.price * 2);
    }
  }

  // 6. Seed Sample Customer Messages
  const msgCount = db.prepare('SELECT COUNT(*) AS count FROM messages').get().count;
  if (msgCount === 0) {
    const insertMsg = db.prepare(`
      INSERT INTO messages (name, email, phone, subject, body, is_read)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertMsg.run(
      'فهد الدوسري',
      'fahad@company.sa',
      '0556677889',
      'طلب عرض سعر لـ 10 أجهزة للشركة',
      'السلام عليكم، نرغب بالحصول على عرض سعر رسمي لعدد 10 أجهزة Lenovo ThinkPad X1 Carbon لشركتنا في الرياض مع فاتورة ضريبية.',
      0
    );
    insertMsg.run(
      'نورة الحربي',
      'noura@example.com',
      '0531122334',
      'استفسار عن ضمان أجهزة MacBook',
      'مرحباً، هل ضمان أجهزة أبل لديكم يشمل الصيانة لدى الوكيل المعتمد في المملكة؟ وشكراً لكم.',
      1
    );
  }
}

function getSettingsMap(db = getDb()) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const map = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

function formatProduct(row) {
  if (!row) return null;
  let specs = {};
  try {
    specs = JSON.parse(row.specs_json || '{}');
  } catch {
    specs = {};
  }
  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    brand: row.brand,
    category: row.category,
    price: Number(row.price),
    old_price: row.old_price !== null && row.old_price !== undefined ? Number(row.old_price) : null,
    stock: Number(row.stock),
    rating: Number(row.rating),
    badge: row.badge || '',
    image: row.image,
    description: row.description,
    specs,
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  getDb,
  getSettingsMap,
  formatProduct,
  closeDb
};
