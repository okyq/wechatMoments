/** 后台访问路径工具：路径可在后台「站点设置」中自定义（如 admin → /admin） */

const STORAGE_KEY = 'blog_admin_path';

export function getAdminPath() {
  return localStorage.getItem(STORAGE_KEY) || 'admin';
}

export function setAdminPath(p) {
  localStorage.setItem(STORAGE_KEY, p || 'admin');
}

export function adminBase() {
  return '/' + getAdminPath();
}

/** 生成后台绝对路径，如 adminUrl('/posts') → /manage/posts */
export function adminUrl(p) {
  return adminBase() + (p.startsWith('/') ? p : '/' + p);
}

/** 判断当前路径是否属于后台（不含登录页） */
export function isAdminPath(path) {
  const base = adminBase();
  return path === base || path.startsWith(base + '/');
}

/** 判断当前路径是否为后台登录页 */
export function isAdminLoginPath(path) {
  return path === adminBase() + '/login';
}
