const express = require('express');
const { getDb } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/messages — public contact form submission
router.post('/', (req, res) => {
  const db = getDb();
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();

  if (name.length < 2) {
    return res.status(400).json({ error: 'يرجى إدخال اسمك الكامل.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
  }
  if (subject.length < 2) {
    return res.status(400).json({ error: 'يرجى إدخال موضوع الرسالة.' });
  }
  if (body.length < 5) {
    return res.status(400).json({ error: 'يرجى كتابة تفاصيل استفسارك.' });
  }

  const result = db
    .prepare('INSERT INTO messages (name, email, phone, subject, body) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, phone, subject, body);

  res.status(201).json({
    id: result.lastInsertRowid,
    message: 'تم إرسال رسالتك بنجاح! سيتواصل معك فريقنا في أقرب وقت.'
  });
});

// GET /api/messages — admin list messages
router.get('/', requireAdmin, (_req, res) => {
  const db = getDb();
  const messages = db.prepare('SELECT * FROM messages ORDER BY id DESC').all();
  res.json({ messages });
});

// PATCH /api/messages/:id/read — toggle read status
router.patch('/:id/read', requireAdmin, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'الرسالة غير موجودة.' });
  }
  const isRead = req.body.is_read !== undefined ? (req.body.is_read ? 1 : 0) : 1;
  db.prepare('UPDATE messages SET is_read = ? WHERE id = ?').run(isRead, id);
  res.json({ message: 'تم تحديث حالة الرسالة.' });
});

// DELETE /api/messages/:id — admin delete message
router.delete('/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT id FROM messages WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'الرسالة غير موجودة.' });
  }
  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  res.json({ message: 'تم حذف الرسالة.' });
});

module.exports = router;
