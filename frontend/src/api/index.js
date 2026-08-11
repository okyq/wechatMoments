import axios from 'axios';
import { isAdminPath, isAdminLoginPath } from '../utils/admin';

const http = axios.create({ baseURL: '/api', timeout: 30000 });

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('blog_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

http.interceptors.response.use(
  (r) => r.data,
  (err) => {
    const path = window.location.pathname;
    if (err.response?.status === 401 && isAdminPath(path) && !isAdminLoginPath(path)) {
      localStorage.removeItem('blog_token');
      window.location.href = window.location.pathname.replace(/\/[^/]*$/, '/login');
    }
    return Promise.reject(err);
  }
);

// ---------- 前台 ----------
export const getSite = () => http.get('/site');
export const getPosts = (params) => http.get('/posts', { params });
export const getFilters = () => http.get('/posts/filters');
export const getPost = (id) => http.get(`/posts/${id}`);
export const likePost = (id, action) => http.post(`/posts/${id}/like`, { action });
export const getComments = (postId) => http.get(`/posts/${postId}/comments`);
export const addComment = (postId, data) => http.post(`/posts/${postId}/comments`, data);

// ---------- 管理后台 ----------
export const login = (data) => http.post('/auth/login', data);
export const adminStats = () => http.get('/admin/stats');
export const adminPosts = (params) => http.get('/admin/posts', { params });
export const adminFilters = () => http.get('/admin/filters');
export const adminPost = (id) => http.get(`/admin/posts/${id}`);
export const createPost = (data) => http.post('/admin/posts', data);
export const updatePost = (id, data) => http.put(`/admin/posts/${id}`, data);
export const setPostStatus = (id, status) => http.put(`/admin/posts/${id}/status`, { status });
export const setPostPinned = (id, isPinned) => http.put(`/admin/posts/${id}/pin`, { is_pinned: isPinned });
export const deletePost = (id) => http.delete(`/admin/posts/${id}`);
export const adminComments = (params) => http.get('/admin/comments', { params });
export const deleteComment = (id) => http.delete(`/admin/comments/${id}`);
export const adminAttachments = (params) => http.get('/admin/attachments', { params });
export const deleteAttachment = (name) => http.delete(`/admin/attachments/${encodeURIComponent(name)}`);
export const importFiles = (files) => {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  return http.post('/admin/import', fd, { timeout: 120000 });
};
// 导出 zip（用 fetch 以便下载 blob）
export async function exportPosts(params) {
  const token = localStorage.getItem('blog_token');
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/admin/export?${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `导出失败（${res.status}）`);
  }
  return res.blob();
}
export const adminSettings = () => http.get('/admin/settings');
export const updateSettings = (data) => http.put('/admin/settings', data);
export const changePassword = (data) => http.put('/admin/password', data);
export const uploadImage = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return http.post('/upload', fd);
};
