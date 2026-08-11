import { createApp } from 'vue';
import App from './App.vue';
import { createAppRouter } from './router';
import { applyTheme, getStoredTheme } from './utils/theme';
import { setAdminPath } from './utils/admin';
import { getSite } from './api';
import './styles/main.css';

// 在渲染前应用主题，避免闪烁（后台页面随后会应用服务端配置的 admin_theme）
applyTheme(getStoredTheme('site') || 'wechat', 'site', false);

/**
 * 启动引导：先读取站点配置（含后台路径、favicon），再注册路由挂载应用。
 * 这样后台访问路径可以在「站点设置」中自定义，前台无后台入口按钮。
 */
async function bootstrap() {
  let adminPath = 'admin';
  try {
    const site = await getSite();
    if (site.admin_path) adminPath = site.admin_path;
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
