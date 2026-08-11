import { createRouter, createWebHistory } from 'vue-router';

/**
 * 创建应用路由。后台路径前缀可配置（admin_path），
 * 因此路由在启动时根据站点配置动态注册。
 */
export function createAppRouter(adminPath) {
  const base = '/' + adminPath;
  const routes = [
    { path: '/', name: 'feed', component: () => import('./views/Feed.vue') },
    { path: '/post/:id', name: 'post', component: () => import('./views/PostDetail.vue') },
    {
      path: base,
      component: () => import('./views/admin/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: base + '/dashboard' },
        { path: 'dashboard', component: () => import('./views/admin/Dashboard.vue') },
        { path: 'posts', component: () => import('./views/admin/PostList.vue') },
        { path: 'posts/new', component: () => import('./views/admin/PostEditor.vue') },
        { path: 'posts/:id/edit', component: () => import('./views/admin/PostEditor.vue') },
        { path: 'comments', component: () => import('./views/admin/CommentList.vue') },
        { path: 'attachments', component: () => import('./views/admin/Attachments.vue') },
        { path: 'settings', component: () => import('./views/admin/Settings.vue') },
      ],
    },
    { path: base + '/login', component: () => import('./views/admin/Login.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ];

  const router = createRouter({ history: createWebHistory(), routes });

  router.beforeEach((to) => {
    const authed = !!localStorage.getItem('blog_token');
    if (to.meta.requiresAuth && !authed) return base + '/login';
    if (to.path === base + '/login' && authed) return base + '/dashboard';
  });

  return router;
}
