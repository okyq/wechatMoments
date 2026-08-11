/** 主题系统：4 套主题 + 前台/后台独立偏好 + 服务端默认主题 */

export const THEMES = [
  { id: 'wechat', name: '青竹绿', gradient: 'linear-gradient(135deg, #07c160, #10aeff)' },
  { id: 'sunset', name: '落霞橙', gradient: 'linear-gradient(135deg, #ff9a3d, #ff6b6b)' },
  { id: 'ocean', name: '海盐蓝', gradient: 'linear-gradient(135deg, #1a73e8, #00b4d8)' },
  { id: 'night', name: '子夜', gradient: 'linear-gradient(135deg, #10b981, #3b82f6)' },
];

const KEYS = {
  site: 'blog_theme_site', // 前台：用户手动选择的主题
  admin: 'blog_theme_admin', // 后台：用户手动选择的主题
};

/** 用户是否手动选择过某端的主题 */
export function hasStoredTheme(scope) {
  return !!localStorage.getItem(KEYS[scope]);
}

/** 用户手动选择的主题（无则返回 null） */
export function getStoredTheme(scope) {
  return localStorage.getItem(KEYS[scope]);
}

/** 当前生效主题（从 html 属性读取） */
export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'wechat';
}

/**
 * 应用主题
 * @param scope 'site' | 'admin'
 * @param persist 是否写入用户偏好（false 表示仅应用服务端默认主题）
 */
export function applyTheme(theme, scope = 'site', persist = true) {
  document.documentElement.setAttribute('data-theme', theme);
  if (persist) localStorage.setItem(KEYS[scope], theme);
}

export function themeName(theme) {
  return THEMES.find((t) => t.id === theme)?.name || '青竹绿';
}
