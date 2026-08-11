const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { requireObsidian } = require('../middleware/auth');
const { checkImageMagic } = require('../utils');

// 上传目录：项目根目录 uploads/（与 index.js 静态服务、db.js 保持一致）
const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 白名单（不含 svg：SVG 可内嵌脚本，上传后存在存储型 XSS 风险）
const ALLOWED_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex');
    cb(null, name + (ALLOWED_EXT[ext] ? ext : '.png'));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  // 扩展名白名单：非白名单文件直接拒绝，不允许降级保存为 .png
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_EXT[ext]) return cb(null, true);
    const err = new Error('不支持的文件类型');
    err.status = 400;
    cb(err);
  },
});

const router = express.Router();

// 图片上传（管理后台 + Obsidian 插件共用）
router.post('/', requireObsidian, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '缺少文件（字段名 file）' });
  try {
    // 魔数校验：拒绝伪装扩展名的非图片内容（防存储型 XSS）
    const fd = fs.openSync(req.file.path, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    const ext = path.extname(req.file.filename).toLowerCase();
    if (!checkImageMagic(buf, ext)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '文件内容与图片格式不符，已拒绝' });
    }
    res.json({ url: '/uploads/' + req.file.filename });
  } catch (e) {
    try {
      fs.unlinkSync(req.file.path);
    } catch (e2) {
      /* ignore */
    }
    throw e;
  }
});

module.exports = router;
