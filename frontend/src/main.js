import { createApp } from 'vue';
import App from './App.vue';
import { createAppRouter } from './router';
import { applyTheme, getStoredTheme, hasStoredTheme } from './utils/theme';
import { setAdminPath } from './utils/admin';
import { getSite } from './api';
import './styles/main.css';

// 在渲染前应用主题，避免闪烁（后台页面随后会应用服务端配置的 admin_theme）
applyTheme(getStoredTheme('site') || 'wechat', 'site', false);

/**
 * 启动引导：先读取站点配置（含后台路径、默认主题、favicon），
 * 在挂载应用前应用站点主题（消除"先默认后真实"的主题闪烁），再注册路由。
 */
async function bootstrap() {
  let adminPath = 'admin';
  try {
    const site = await getSite();
    if (site.admin_path) adminPath = site.admin_path;
    // 访客未手动选择主题时，应用后台配置的默认主题（挂载前生效）
    if (!hasStoredTheme('site')) applyTheme(site.site_theme || 'wechat', 'site', false);
    // 动态设置浏览器地址栏图标（自定义图标 → 站点头像 → 后端默认）
    const favicon = site.site_favicon || site.site_avatar;
    if (favicon) {
      let link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = favicon;
    }
  } catch (e) {
    /* 后端不可用时使用默认配置 */
  }
  setAdminPath(adminPath);

  const router = createAppRouter(adminPath);
  createApp(App).use(router).mount('#app');
}

bootstrap();
