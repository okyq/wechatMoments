/** 通用工具函数 */

function now() {
  return new Date().toISOString();
}

/** 把任意标题生成 slug（保留中文，仅用于 upsert 匹配） */
function sanitizeSlug(input) {
  const s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || 'post-' + Date.now();
}

/** 去除 markdown 语法，得到纯文本 */
function stripMarkdown(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 生成摘要 */
function excerpt(md, len = 160) {
  const t = stripMarkdown(md);
  return t.length > len ? t.slice(0, len) + '…' : t;
}

/** 标签归一化：数组或逗号分隔字符串 → 去重字符串数组 */
function normalizeTags(tags) {
  if (!tags) return [];
  const arr = Array.isArray(tags) ? tags : String(tags).split(/[,，]/);
  return [...new Set(arr.map((t) => String(t).trim()).filter(Boolean))].slice(0, 20);
}

/** 从 markdown 正文中提取图片地址 */
function extractImages(content) {
  const urls = [];
  const reMd = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const reHtml = /<img[^>]+src="([^"]+)"/g;
  for (const re of [reMd, reHtml]) {
    let m;
    while ((m = re.exec(content))) urls.push(m[1]);
  }
  return [...new Set(urls)].filter((u) => u && !u.startsWith('data:'));
}

/**
 * 图片魔数校验：防止伪装扩展名的非图片内容上传（存储型 XSS 防护）。
 * 仅允许真实图片二进制内容。
 */
function checkImageMagic(buf, ext) {
  if (!buf || buf.length < 12) return false;
  const ascii = (start, len) => buf.slice(start, start + len).toString('ascii');
  if (ext === '.png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (ext === '.jpg' || ext === '.jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (ext === '.gif') return ascii(0, 4) === 'GIF8';
  if (ext === '.webp') return ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP';
  if (ext === '.bmp') return buf[0] === 0x42 && buf[1] === 0x4d;
  if (ext === '.avif') return ascii(4, 8).includes('ftyp');
  return false;
}

module.exports = { now, sanitizeSlug, stripMarkdown, excerpt, normalizeTags, extractImages, checkImageMagic };
