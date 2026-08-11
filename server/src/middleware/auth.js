const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');

/**
 * JWT 签名密钥：
 * 优先使用 .env 的 JWT_SECRET；未配置时自动生成随机密钥并持久化到 data/jwt-secret，
 * 避免使用硬编码默认值（否则攻击者可用默认密钥伪造管理员令牌）。
 */
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  const secretFile = path.join(DATA_DIR, 'jwt-secret');
  if (fs.existsSync(secretFile)) {
    JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
  } else {
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, JWT_SECRET, { mode: 0o600 });
    console.log('[auth] 未配置 JWT_SECRET，已自动生成随机密钥并保存到 data/jwt-secret（生产环境建议在 .env 中显式配置）');
  }
}

/** 签发长期有效的 JWT（管理后台 + Obsidian 插件共用） */
function signToken(admin) {
  return jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '365d' });
}

function getToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** 管理后台接口鉴权：仅接受合法 JWT */
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

/** 上传/插件接口鉴权：接受 JWT 或 Obsidian 访问令牌 */
function requireObsidian(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: '缺少访问令牌' });
  const admin = db.prepare('SELECT id, username, obsidian_token FROM admin LIMIT 1').get();
  if (admin && admin.obsidian_token === token) {
    req.admin = { id: admin.id, username: admin.username };
    return next();
  }
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '令牌无效' });
  }
}

module.exports = { signToken, requireAuth, requireObsidian };
