const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// 防暴力破解：每 IP 每分钟最多 5 次登录尝试
const loginLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 5, message: '尝试次数过多，请 1 分钟后再试' });

// 管理员登录
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const admin = db.prepare('SELECT * FROM admin LIMIT 1').get();
  const ok =
    admin &&
    String(username || '').trim() === admin.username &&
    bcrypt.compareSync(String(password || ''), admin.password_hash);
  if (!ok) return res.status(401).json({ error: '用户名或密码错误' });
  res.json({ token: signToken(admin), username: admin.username });
});

// 当前登录信息
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.admin.username });
});

module.exports = router;
