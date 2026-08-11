/**
 * 轻量内存滑动窗口限流器（单进程部署足够）
 *
 * 默认按请求方真实 IP 限流：
 * - 直接暴露部署时使用 socket.remoteAddress（不可伪造）
 * - 部署在 Nginx 等反代后时，设置环境变量 TRUST_PROXY=true 改为信任 X-Forwarded-For
 */
function createRateLimiter({ windowMs = 60000, max = 10, message = '操作过于频繁，请稍后再试' } = {}) {
  const hits = new Map();
  // 定期清理过期记录，防止内存无限增长
  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, times] of hits) {
      const filtered = times.filter((t) => t > cutoff);
      if (filtered.length) hits.set(key, filtered);
      else hits.delete(key);
    }
  }, windowMs);
  timer.unref();

  return function rateLimit(req, res, next) {
    let ip;
    if (process.env.TRUST_PROXY === 'true') {
      ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    } else {
      ip = req.socket.remoteAddress;
    }
    const now = Date.now();
    const times = (hits.get(ip) || []).filter((t) => t > now - windowMs);
    if (times.length >= max) {
      return res.status(429).json({ error: message });
    }
    times.push(now);
    hits.set(ip, times);
    next();
  };
}

module.exports = { createRateLimiter };
