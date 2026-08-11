<template>
  <div>
    <div class="list-head">
      <h2 class="page-title">{{ isEdit ? '编辑文章' : '新建文章' }}</h2>
      <RouterLink :to="adminUrl('/posts')" class="btn btn-plain">‹ 返回列表</RouterLink>
    </div>

    <div class="editor-grid">
      <div class="editor-form">
        <label class="field">
          <span class="field-label">标题 *</span>
          <input v-model="form.title" class="input" placeholder="文章标题" @blur="autoSlug" />
        </label>

        <div class="field-row">
          <label class="field">
            <span class="field-label">Slug（唯一标识，留空自动生成）</span>
            <input v-model="form.slug" class="input" placeholder="my-first-post" />
          </label>
          <label class="field">
            <span class="field-label">状态</span>
            <select v-model="form.status" class="input">
              <option :value="1">发布</option>
              <option :value="0">存为草稿</option>
            </select>
          </label>
        </div>

        <div class="field-row">
          <label class="field">
            <span class="field-label">标签（逗号分隔）</span>
            <input v-model="tagsText" class="input" placeholder="技术, 生活, 随笔" />
          </label>
          <label class="field">
            <span class="field-label">位置（可选，朋友圈展示）</span>
            <input v-model="form.location" class="input" placeholder="例如：书桌前" />
          </label>
        </div>

        <label class="field">
          <span class="field-label">封面图</span>
          <div class="cover-row">
            <input v-model="form.cover" class="input" placeholder="图片 URL，留空自动取正文第一张图" />
            <button class="btn btn-plain" type="button" @click="pickCover">上传</button>
            <img v-if="form.cover" :src="form.cover" class="cover-preview" alt="" referrerpolicy="no-referrer" />
          </div>
        </label>

        <div class="field">
          <div class="field-label field-label-row">
            <span>正文（Markdown）</span>
            <div class="editor-tabs">
              <button class="tab-btn" :class="{ active: mode === 'edit' }" @click="mode = 'edit'">编辑</button>
              <button class="tab-btn" :class="{ active: mode === 'preview' }" @click="mode = 'preview'">预览</button>
              <button class="btn btn-sm btn-plain" type="button" @click="pickImage">🖼 插入图片</button>
            </div>
          </div>
          <textarea
            v-if="mode === 'edit'"
            ref="contentRef"
            v-model="form.content"
            class="textarea editor-textarea"
            placeholder="支持 Markdown 语法，代码块自动高亮…"
          ></textarea>
          <div v-else class="preview-box">
            <MarkdownView :content="form.content" />
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保 存' }}
          </button>
          <span v-if="msg" class="save-msg" :class="{ err: msgErr }">{{ msg }}</span>
        </div>
      </div>
    </div>
    <input ref="fileInput" type="file" accept="image/*" hidden @change="onFilePicked" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MarkdownView from '../../components/MarkdownView.vue';
import { adminPost, createPost, updatePost, uploadImage } from '../../api';
import { adminUrl } from '../../utils/admin';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);

const form = ref({ title: '', slug: '', cover: '', location: '', status: 1, content: '' });
const tagsText = ref('');
const mode = ref('edit');
const saving = ref(false);
const msg = ref('');
const msgErr = ref(false);
const contentRef = ref(null);
const fileInput = ref(null);
let fileMode = 'cover'; // 'cover' | 'content'

onMounted(async () => {
  if (isEdit.value) {
    const p = await adminPost(route.params.id);
    form.value = {
      title: p.title,
      slug: p.slug,
      cover: p.cover,
      location: p.location,
      status: p.status,
      content: p.content,
    };
    tagsText.value = (p.tags || []).join(', ');
  }
});

function autoSlug() {
  if (!form.value.slug.trim()) {
    form.value.slug = form.value.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

function pickCover() {
  fileMode = 'cover';
  fileInput.value.click();
}
function pickImage() {
  fileMode = 'content';
  fileInput.value.click();
}

async function onFilePicked(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const { url } = await uploadImage(file);
    if (fileMode === 'cover') {
      form.value.cover = url;
    } else {
      const ta = contentRef.value;
      const name = file.name.replace(/\.[^.]+$/, '');
      const markdown = `![${name}](${url})`;
      if (ta) {
        const start = ta.selectionStart ?? form.value.content.length;
        const end = ta.selectionEnd ?? start;
        form.value.content = form.value.content.slice(0, start) + markdown + form.value.content.slice(end);
        mode.value = 'edit';
        requestAnimationFrame(() => {
          ta.focus();
          ta.selectionStart = ta.selectionEnd = start + markdown.length;
        });
      } else {
        form.value.content += '\n\n' + markdown;
      }
    }
  } catch (err) {
    alert(err.response?.data?.error || '图片上传失败');
  }
}

async function save() {
  if (!form.value.title.trim()) {
    msgErr.value = true;
    msg.value = '标题不能为空';
    return;
  }
  autoSlug();
  saving.value = true;
  msg.value = '';
  try {
    const payload = {
      ...form.value,
      tags: tagsText.value
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    };
    if (isEdit.value) {
      await updatePost(route.params.id, payload);
    } else {
      await createPost(payload);
    }
    msgErr.value = false;
    msg.value = '保存成功 ✓';
    setTimeout(() => {
      router.push('/admin/posts');
    }, 800);
  } catch (err) {
    msgErr.value = true;
    msg.value = err.response?.data?.error || '保存失败';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.page-title {
  font-size: 18px;
}
.editor-grid {
  background: var(--card);
  border-radius: 10px;
  border: 1px solid var(--border);
  padding: 20px;
}
.editor-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.field-label {
  font-size: 13px;
  color: var(--text-light);
  font-weight: 500;
}
.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.field-row {
  display: flex;
  gap: 14px;
}
.editor-tabs {
  display: flex;
  gap: 6px;
  align-items: center;
}
.tab-btn {
  padding: 3px 14px;
  border-radius: 4px;
  font-size: 13px;
  background: var(--hover-bg);
  color: var(--text-light);
}
.tab-btn.active {
  background: var(--green);
  color: #fff;
}
.editor-textarea {
  min-height: 420px;
  font-family: 'SF Mono', Consolas, Menlo, monospace;
  font-size: 13.5px;
}
.preview-box {
  min-height: 420px;
  border: 1px dashed var(--input-border);
  border-radius: 8px;
  padding: 14px;
  overflow: auto;
}
.cover-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.cover-preview {
  width: 46px;
  height: 46px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
}
.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.save-msg {
  font-size: 13px;
  color: var(--green-dark);
}
.save-msg.err {
  color: var(--danger);
}
@media (max-width: 720px) {
  .field-row {
    flex-direction: column;
  }
}
</style>
