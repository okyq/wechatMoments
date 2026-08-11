<template>
  <div class="admin-page">
    <!-- 遮罩（移动端抽屉打开时） -->
    <div v-if="sidebarOpen" class="admin-mask" @click="sidebarOpen = false"></div>

    <aside class="admin-sidebar" :class="{ open: sidebarOpen }">
      <div class="admin-brand">
        <span class="brand-dot">●</span>
        {{ siteTitle }}
      </div>
      <nav class="admin-nav">
        <RouterLink :to="adminUrl('/dashboard')" class="nav-item" active-class="active" @click="sidebarOpen = false">
          📊 仪表盘
        </RouterLink>
        <RouterLink :to="adminUrl('/posts')" class="nav-item" active-class="active" @click="sidebarOpen = false">
          📝 文章管理
        </RouterLink>
        <RouterLink :to="adminUrl('/comments')" class="nav-item" active-class="active" @click="sidebarOpen = false">
          💬 评论管理
        </RouterLink>
        <RouterLink :to="adminUrl('/attachments')" class="nav-item" active-class="active" @click="sidebarOpen = false">
          📎 附件管理
        </RouterLink>
        <RouterLink :to="adminUrl('/settings')" class="nav-item" active-class="active" @click="sidebarOpen = false">
          ⚙️ 站点设置
        </RouterLink>
      </nav>
      <div class="admin-nav admin-nav-bottom">
        <a class="nav-item" href="/" target="_blank">🌍 查看前台</a>
        <button class="nav-item nav-logout" @click="logout">🚪 退出登录</button>
      </div>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar">
        <div class="admin-topbar-left">
          <button class="sidebar-toggle" title="展开菜单" @click="sidebarOpen = true">☰</button>
          <span>管理后台</span>
        </div>
        <div class="admin-topbar-right">
          <ThemeSwitcher scope="admin" />
          <span class="admin-user">👤 {{ username }}</span>
        </div>
      </header>
      <div class="admin-content">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import ThemeSwitcher from '../../components/ThemeSwitcher.vue';
import { getSite, adminSettings } from '../../api';
import { applyTheme, hasStoredTheme } from '../../utils/theme';
import { adminUrl } from '../../utils/admin';

const router = useRouter();
const sidebarOpen = ref(false);
const username = ref(localStorage.getItem('blog_username') || '管理员');
const siteTitle = ref('博客管理');

onMounted(() => {
  // 后台页面脱离朋友圈的窄栏限制（桌面端全宽）
  document.body.classList.add('admin-body');
});

onBeforeUnmount(() => {
  document.body.classList.remove('admin-body');
});

onMounted(async () => {
  try {
    const s = await getSite();
    siteTitle.value = s.site_title;
  } catch (e) {
    /* ignore */
  }
  try {
    // 管理员未手动选择主题时，应用后台配置的默认主题
    if (!hasStoredTheme('admin')) {
      const settings = await adminSettings();
      if (settings.admin_theme) applyTheme(settings.admin_theme, 'admin', false);
    }
  } catch (e) {
    /* ignore */
  }
});

function logout() {
  localStorage.removeItem('blog_token');
  localStorage.removeItem('blog_username');
  router.push(adminUrl('/login'));
}
</script>

<style scoped>
.admin-page {
  display: flex;
  min-height: 100vh;
  width: 100%;
}

/* 侧边栏（桌面固定，移动端抽屉） */
.admin-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--sidebar-grad);
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 200;
}
.admin-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 700;
  padding: 0 20px 18px;
  white-space: nowrap;
  overflow: hidden;
}
.brand-dot {
  color: #ffd34d;
  flex-shrink: 0;
}
.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 10px;
}
.admin-nav-bottom {
  margin-top: auto;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  width: 100%;
  text-align: left;
  transition: background 0.15s;
  white-space: nowrap;
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.15);
}
.nav-item.active {
  background: rgba(255, 255, 255, 0.22);
  font-weight: 600;
}
.nav-logout {
  color: #ffe3e0;
}

/* 主区域 */
.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  min-width: 0;
}
.admin-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  font-size: 14px;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 100;
}
.admin-topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sidebar-toggle {
  display: none;
  font-size: 20px;
  color: var(--text);
  padding: 2px 8px;
  border-radius: 6px;
}
.sidebar-toggle:hover {
  background: var(--hover-bg);
}
.admin-user {
  font-weight: normal;
  color: var(--text-light);
  font-size: 13px;
}
.admin-topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.admin-content {
  flex: 1;
  padding: 20px;
  overflow: auto;
}

/* 移动端：抽屉侧边栏 */
.admin-mask {
  display: none;
}
@media (max-width: 900px) {
  .admin-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    height: 100vh;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: none;
  }
  .admin-sidebar.open {
    transform: translateX(0);
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.25);
  }
  .admin-mask {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 190;
  }
  .sidebar-toggle {
    display: block;
  }
  .admin-content {
    padding: 14px;
  }
}
@media (max-width: 480px) {
  .admin-content {
    padding: 10px;
  }
  .admin-topbar {
    padding: 8px 12px;
  }
  .admin-user {
    display: none;
  }
}
</style>
