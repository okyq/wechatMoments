<template>
  <div class="settings-page">
    <h2 class="page-title">站点设置</h2>

    <div class="settings-grid">
      <!-- 基本信息 -->
      <div class="panel">
        <div class="panel-title">基本信息</div>
        <div class="panel-body">
          <label class="field">
            <span class="field-label">站点名称（前台昵称）</span>
            <input v-model="form.site_title" class="input" />
          </label>
          <label class="field">
            <span class="field-label">站点简介（横幅展示）</span>
            <input v-model="form.site_desc" class="input" />
          </label>
          <label class="field">
            <span class="field-label">头像</span>
            <div class="file-row">
              <input v-model="form.site_avatar" class="input" placeholder="图片 URL 或上传" />
              <button class="btn btn-plain" type="button" @click="pickFile('avatar')">上传</button>
              <img v-if="form.site_avatar" :src="form.site_avatar" class="thumb" alt="" referrerpolicy="no-referrer" />
            </div>
          </label>
          <label class="field">
            <span class="field-label">横幅背景图</span>
            <div class="file-row">
              <input v-model="form.site_background" class="input" placeholder="图片 URL 或上传" />
              <button class="btn btn-plain" type="button" @click="pickFile('background')">上传</button>
              <img v-if="form.site_background" :src="form.site_background" class="thumb" alt="" referrerpolicy="no-referrer" />
            </div>
          </label>
          <button class="btn btn-primary" :disabled="saving" @click="saveSettings">
            {{ saving ? '保存中…' : '保存设置' }}
          </button>
          <span v-if="msg" class="save-msg" :class="{ err: msgErr }">{{ msg }}</span>
        </div>
      </div>

      <!-- 主题设置 -->
      <div class="panel">
        <div class="panel-title">主题设置</div>
        <div class="panel-body">
          <div class="field">
            <span class="field-label">朋友圈默认主题（访客未手动切换时生效）</span>
            <div class="theme-picker">
              <button
                v-for="t in THEMES"
                :key="t.id"
                type="button"
                class="theme-pick"
                :class="{ active: form.site_theme === t.id }"
                @click="form.site_theme = t.id"
              >
                <span class="theme-swatch" :style="{ background: t.gradient }"></span>
                <span>{{ t.name }}</span>
                <span v-if="form.site_theme === t.id" class="theme-check">✓</span>
              </button>
            </div>
          </div>
          <div class="field">
            <span class="field-label">管理后台主题（管理员未手动切换时生效）</span>
            <div class="theme-picker">
              <button
                v-for="t in THEMES"
                :key="t.id"
                type="button"
                class="theme-pick"
                :class="{ active: form.admin_theme === t.id }"
                @click="form.admin_theme = t.id"
              >
                <span class="theme-swatch" :style="{ background: t.gradient }"></span>
                <span>{{ t.name }}</span>
                <span v-if="form.admin_theme === t.id" class="theme-check">✓</span>
              </button>
            </div>
          </div>
          <label class="field">
            <span class="field-label">
              朋友圈内容预览长度（字符数，超过后显示「查看详情」跳转详情页）
            </span>
            <input
              v-model.number="form.post_preview_length"
              type="number"
              min="100"
              max="5000"
              step="50"
              class="input"
            />
          </label>
          <label class="field">
            <span class="field-label">朋友圈每页展示数量</span>
            <input
              v-model.number="form.post_page_size"
              type="number"
              min="5"
              max="50"
              step="5"
              class="input"
            />
          </label>
          <label class="field">
            <span class="field-label">
              后台访问路径（前台不再显示入口按钮，仅通过此地址访问）
            </span>
            <div class="path-row">
              <span class="path-prefix">/</span>
              <input v-model="form.admin_path" class="input" placeholder="admin（字母数字_-，2-30 位）" maxlength="30" />
            </div>
            <span class="field-hint">
              修改后请立即使用新地址访问后台（当前页面需重新登录），旧地址将失效。
            </span>
          </label>
          <button class="btn btn-primary" :disabled="saving" @click="saveSettings">
            {{ saving ? '保存中…' : '保存主题设置' }}
          </button>
          <span v-if="msg" class="save-msg" :class="{ err: msgErr }">{{ msg }}</span>
        </div>
      </div>

      <!-- Obsidian 插件 -->
      <div class="panel">
        <div class="panel-title">Obsidian 发布插件</div>
        <div class="panel-body">
          <p class="panel-desc">
            在 Obsidian 插件设置中填写「服务器地址」与本访问令牌，即可一键把笔记发布到博客。
          </p>
          <div class="token-box">
            <code class="token-code">{{ token || '…' }}</code>
            <button class="btn btn-sm btn-plain" @click="copyToken">复制</button>
            <button class="btn btn-sm btn-plain" @click="regenerate">重新生成</button>
          </div>
          <p class="panel-desc small">
            令牌相当于博客的钥匙，泄露后请立即重新生成。
          </p>
        </div>
      </div>

      <!-- 账号 -->
      <div class="panel">
        <div class="panel-title">账号安全</div>
        <div class="panel-body">
          <label class="field">
            <span class="field-label">用户名：{{ form.username || username }}</span>
          </label>
          <label class="field">
            <span class="field-label">原密码</span>
            <input v-model="pwd.old" type="password" class="input" autocomplete="current-password" />
          </label>
          <label class="field">
            <span class="field-label">新密码（至少 6 位）</span>
            <input v-model="pwd.new" type="password" class="input" autocomplete="new-password" />
          </label>
          <button class="btn btn-plain" :disabled="pwdSaving" @click="changePwd">
            {{ pwdSaving ? '修改中…' : '修改密码' }}
          </button>
          <span v-if="pwdMsg" class="save-msg" :class="{ err: pwdMsgErr }">{{ pwdMsg }}</span>
        </div>
      </div>
    </div>

    <input ref="fileInput" type="file" accept="image/*" hidden @change="onFilePicked" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { adminSettings, updateSettings, changePassword, uploadImage } from '../../api';
import { THEMES, applyTheme } from '../../utils/theme';
import { setAdminPath, adminUrl } from '../../utils/admin';

const form = ref({
  site_title: '',
  site_desc: '',
  site_avatar: '',
  site_background: '',
  site_theme: 'wechat',
  admin_theme: 'wechat',
  post_preview_length: 500,
  post_page_size: 10,
  admin_path: 'admin',
  username: '',
});
const token = ref('');
const saving = ref(false);
const msg = ref('');
const msgErr = ref(false);

const pwd = ref({ old: '', new: '' });
const pwdSaving = ref(false);
const pwdMsg = ref('');
const pwdMsgErr = ref(false);

const username = ref(localStorage.getItem('blog_username') || 'admin');
const fileInput = ref(null);
let fileTarget = 'avatar';

onMounted(async () => {
  const s = await adminSettings();
  form.value = {
    site_title: s.site_title,
    site_desc: s.site_desc,
    site_avatar: s.site_avatar,
    site_background: s.site_background,
    site_theme: s.site_theme || 'wechat',
    admin_theme: s.admin_theme || 'wechat',
    post_preview_length: parseInt(s.post_preview_length, 10) || 500,
    post_page_size: parseInt(s.post_page_size, 10) || 10,
    admin_path: s.admin_path || 'admin',
    username: s.username,
  };
  token.value = s.obsidian_token;
});

function pickFile(target) {
  fileTarget = target;
  fileInput.value.click();
}

async function onFilePicked(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const { url } = await uploadImage(file);
    if (fileTarget === 'avatar') form.value.site_avatar = url;
    else form.value.site_background = url;
    // 上传成功后自动保存，避免用户忘记点保存
    await saveSettings();
  } catch (err) {
    alert(err.response?.data?.error || '图片上传失败');
  }
}

async function saveSettings() {
  saving.value = true;
  msg.value = '';
  try {
    const s = await updateSettings(form.value);
    token.value = s.obsidian_token;
    // 立即应用后台主题（不写入个人偏好，仅作用于当前浏览）
    applyTheme(form.value.admin_theme || 'wechat', 'admin', false);
    // 后台路径变更：更新本地路径并提示跳转（旧地址将失效）
    if (s.admin_path && s.admin_path !== localStorage.getItem('blog_admin_path')) {
      setAdminPath(s.admin_path);
      msgErr.value = false;
      msg.value = '保存成功 ✓ 后台路径已变更为 /' + s.admin_path + '，正在跳转…';
      setTimeout(() => {
        localStorage.removeItem('blog_token');
        window.location.href = adminUrl('/login');
      }, 1200);
      return;
    }
    msgErr.value = false;
    msg.value = '保存成功 ✓（朋友圈将在访客下次访问时使用新主题）';
  } catch (err) {
    msgErr.value = true;
    msg.value = err.response?.data?.error || '保存失败';
  } finally {
    saving.value = false;
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(token.value);
    msg.value = '令牌已复制到剪贴板 ✓';
    msgErr.value = false;
  } catch (e) {
    msg.value = '复制失败，请手动选择复制';
    msgErr.value = true;
  }
}

async function regenerate() {
  if (!confirm('重新生成后，旧令牌将立即失效（Obsidian 插件需重新填写）。确定继续？')) return;
  const s = await updateSettings({ regenerate_token: true });
  token.value = s.obsidian_token;
  msg.value = '令牌已重新生成 ✓';
  msgErr.value = false;
}

async function changePwd() {
  pwdMsg.value = '';
  if (!pwd.value.old || !pwd.value.new) {
    pwdMsgErr.value = true;
    pwdMsg.value = '请填写原密码和新密码';
    return;
  }
  pwdSaving.value = true;
  try {
    await changePassword({ oldPassword: pwd.value.old, newPassword: pwd.value.new });
    pwdMsgErr.value = false;
    pwdMsg.value = '密码修改成功 ✓';
    pwd.value = { old: '', new: '' };
  } catch (err) {
    pwdMsgErr.value = true;
    pwdMsg.value = err.response?.data?.error || '修改失败';
  } finally {
    pwdSaving.value = false;
  }
}
</script>

<style scoped>
.page-title {
  font-size: 18px;
  margin-bottom: 14px;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  align-items: start;
}
.panel {
  background: var(--card);
  border-radius: 10px;
  border: 1px solid var(--border);
  overflow: hidden;
}
.panel-title {
  font-size: 15px;
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.panel-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel-desc {
  font-size: 13px;
  color: var(--text-light);
  line-height: 1.7;
}
.panel-desc.small {
  font-size: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 13px;
  color: var(--text-light);
}
.file-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.thumb {
  width: 46px;
  height: 46px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.token-box {
  display: flex;
  gap: 8px;
  align-items: center;
  background: var(--comment-bg);
  border-radius: 8px;
  padding: 10px 12px;
}
.token-code {
  flex: 1;
  font-size: 12.5px;
  word-break: break-all;
  color: var(--text);
  font-family: 'SF Mono', Consolas, Menlo, monospace;
}
.theme-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.theme-pick {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.theme-pick:hover {
  border-color: var(--green);
}
.theme-pick.active {
  border-color: var(--green);
  background: var(--chip-bg);
  color: var(--green-dark);
  font-weight: 600;
}
.theme-swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}
.theme-check {
  font-size: 12px;
}
.path-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.path-prefix {
  font-size: 15px;
  color: var(--text-light);
  font-family: 'SF Mono', Consolas, Menlo, monospace;
}
.field-hint {
  font-size: 12px;
  color: var(--text-light);
  line-height: 1.6;
}
.save-msg {
  font-size: 13px;
  color: var(--green-dark);
}
.save-msg.err {
  color: var(--danger);
}
</style>
