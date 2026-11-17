const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { getDb } = require('./db/database');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const couponsRouter = require('./routes/coupons');
const messagesRouter = require('./routes/messages');
const adminRouter = require('./routes/admin');

function createApp() {
  // Initialize SQLite schema & seed data on boot
  getDb();

  const app = express();
  app.set('trust proxy', 1);

  // Security headers configured to allow live preview iframe embedding
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginEmbedderPolicy: false
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rate limit auth & public submission endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'عدد محاولات تسجيل الدخول كثير جداً، يرجى المحاولة بعد قليل.' }
  });

  // API routes
  app.use('/api/admin/login', authLimiter);
  app.use('/api/products', productsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/coupons', couponsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/admin', adminRouter);

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Static files
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));

  // Friendly page routes
  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin.html'));
  });
  app.get('/policies', (_req, res) => {
    res.sendFile(path.join(publicDir, 'policies.html'));
  });

  // 404 for unknown API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'المسار المطلوب غير موجود.' });
  });

  // Global error handler
  app.use((err, _req, res, _next) => {
    console.error('Server Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'حدث خطأ غير متوقع في الخادم.'
    });
  });

  return app;
}

if (require.main === module) {
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || '0.0.0.0';
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`TechMarket Store running at http://${HOST}:${PORT}`);
  });
}

module.exports = { createApp };
