<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <span class="login-logo-icon">📱</span>
      </div>
      <h1 class="login-title">博客管理后台</h1>
      <p class="login-sub">朋友圈风格个人博客</p>

      <form class="login-form" @submit.prevent="doLogin">
        <input
          v-model="username"
          class="input login-input"
          placeholder="用户名"
          autocomplete="username"
          autofocus
        />
        <input
          v-model="password"
          class="input login-input"
          type="password"
          placeholder="密码"
          autocomplete="current-password"
        />
        <p v-if="error" class="login-error">{{ error }}</p>
        <button class="btn btn-primary login-btn" type="submit" :disabled="loading">
          {{ loading ? '登录中…' : '登 录' }}
        </button>
      </form>

      <a class="login-back" href="/">‹ 返回前台</a>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../../api';
import { adminUrl } from '../../utils/admin';

const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function doLogin() {
  error.value = '';
  loading.value = true;
  try {
    const { token, username: name } = await login({ username: username.value, password: password.value });
    localStorage.setItem('blog_token', token);
    localStorage.setItem('blog_username', name);
    router.push(adminUrl('/dashboard'));
  } catch (e) {
    error.value = e.response?.data?.error || '登录失败，请检查网络';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--login-grad);
  padding: 20px;
}
.login-card {
  width: 360px;
  max-width: 100%;
  background: var(--card);
  border-radius: 16px;
  padding: 36px 32px 28px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  text-align: center;
}
.login-logo-icon {
  font-size: 44px;
}
.login-title {
  font-size: 20px;
  margin-top: 8px;
}
.login-sub {
  color: var(--text-light);
  font-size: 13px;
  margin: 6px 0 22px;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.login-input {
  padding: 11px 14px;
}
.login-btn {
  padding: 11px;
  font-size: 15px;
  letter-spacing: 4px;
  margin-top: 4px;
}
.login-error {
  color: var(--danger);
  font-size: 13px;
  text-align: left;
}
.login-back {
  display: inline-block;
  margin-top: 18px;
  font-size: 13px;
  color: var(--text-light);
}
.login-back:hover {
  color: var(--green);
}
</style>
