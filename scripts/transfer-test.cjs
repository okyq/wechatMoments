// 导入/导出往返测试
const AdmZip = require('D:/ai/myblog/server/node_modules/adm-zip');

const B = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};

(async () => {
  const login = await (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })).json();
  const token = login.token;
  const H = { Authorization: 'Bearer ' + token };

  // ========== 1. 构造 Obsidian 风格 zip（文件夹 + 附件 + wikilink/markdown 引用） ==========
  const zip = new AdmZip();
  const md1 = `---
title: 导入测试·旅行日记
tags: [旅行, 测试]
location: 大理
slug: import-travel-test
date: 2026-07-01T10:00:00.000Z
---

# 大理之旅

第一天去了洱海，风景很好。

![洱海照片](附件/photo1.jpg)

第二天爬山，拍了一张山顶照：

![[附件/photo2.png]]

最后还有一张：![](./附件/photo3.webp)
`;
  zip.addFile('旅行笔记/旅行日记.md', Buffer.from(md1, 'utf8'));
  zip.addFile('旅行笔记/附件/photo1.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  zip.addFile('旅行笔记/附件/photo2.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 4, 5, 6]));
  zip.addFile('旅行笔记/附件/photo3.webp', Buffer.from([0x52, 0x49, 0x46, 0x46, 7, 8, 9]));
  const zipBuf = zip.toBuffer();

  // ========== 2. 上传 zip 导入 ==========
  const fd = new FormData();
  fd.append('files', new Blob([zipBuf]), 'travel.zip');
  const imp = await (await fetch(B + '/api/admin/import', { method: 'POST', headers: H, body: fd })).json();
  ok('zip 导入创建文章', imp.imported.length === 1 && imp.imported[0].ok && imp.imported[0].created, JSON.stringify(imp));
  const postId = imp.imported[0].id;

  // ========== 3. 验证导入后的文章：附件已上传、路径已重写 ==========
  const post = await (await fetch(B + `/api/posts/${postId}`)).json();
  ok('导入标题/frontmatter 正确', post.title === '导入测试·旅行日记' && post.location === '大理', JSON.stringify({ t: post.title, l: post.location }));
  ok('导入日期生效', post.created_at.startsWith('2026-07-01'));
  const uploaded = post.images.filter((u) => u.startsWith('/uploads/'));
  ok('三张附件全部上传', uploaded.length === 3, JSON.stringify(post.images));
  ok('正文 wikilink 已重写', post.content.includes('![photo2](/uploads/'), post.content.slice(0, 400));
  ok('正文 markdown 相对路径已重写', post.content.includes('![洱海照片](/uploads/'));
  ok('正文 ./ 前缀路径已重写', post.content.includes('![photo3.webp](/uploads/'), post.content.slice(0, 400));
  ok('frontmatter 已在正文中移除', !post.content.includes('---'));

  // ========== 4. 单 md 文件导入 ==========
  const md2 = `---
title: 导入测试·单文件
tags: 单文件
slug: import-single-test
---

单文件导入测试正文 **加粗**。
`;
  const fd2 = new FormData();
  fd2.append('files', new Blob([md2]), '单文件.md');
  const imp2 = await (await fetch(B + '/api/admin/import', { method: 'POST', headers: H, body: fd2 })).json();
  ok('单 md 导入成功', imp2.imported.length === 1, JSON.stringify(imp2));

  // ========== 5. 重复导入（同 slug 更新而非新建） ==========
  const imp3 = await (await fetch(B + '/api/admin/import', { method: 'POST', headers: H, body: fd })).json();
  ok('同 slug 重复导入为更新', imp3.imported[0].id === postId && imp3.imported[0].created === false, JSON.stringify(imp3));

  // ========== 6. 导出（按标签筛选） ==========
  const exp = await fetch(B + '/api/admin/export?tag=' + encodeURIComponent('旅行'), { headers: H });
  ok('导出返回 zip', exp.status === 200 && exp.headers.get('content-type').includes('zip'));
  const expBuf = Buffer.from(await exp.arrayBuffer());
  const outZip = new AdmZip(expBuf);
  const entries = outZip.getEntries().map((e) => e.entryName);
  ok('导出含文章文件夹', entries.some((n) => n.startsWith('导入测试·旅行日记/')), entries.join(', '));
  ok('导出含 md 主文件', entries.includes('导入测试·旅行日记/导入测试·旅行日记.md'));
  const attachEntries = entries.filter((n) => n.startsWith('导入测试·旅行日记/附件/'));
  ok('导出含 3 个附件', attachEntries.length === 3, attachEntries.join(', '));
  const mdEntry = outZip.getEntry('导入测试·旅行日记/导入测试·旅行日记.md');
  const mdText = mdEntry.getData().toString('utf8');
  ok('导出 frontmatter 完整', mdText.includes('title: 导入测试·旅行日记') && mdText.includes('slug: import-travel-test') && mdText.includes('location: 大理'));
  ok('导出正文图片为相对路径', mdText.includes('](附件/') && !mdText.includes('/uploads/'), mdText.slice(0, 300));

  // ========== 7. 往返验证：导出结果再导入，附件路径仍正确 ==========
  const fd4 = new FormData();
  fd4.append('files', new Blob([expBuf]), 'roundtrip.zip');
  const imp4 = await (await fetch(B + '/api/admin/import', { method: 'POST', headers: H, body: fd4 })).json();
  ok('往返导入成功（同 slug 更新）', imp4.imported.length === 1 && imp4.imported[0].id === postId && imp4.imported[0].created === false, JSON.stringify(imp4));
  const postAfter = await (await fetch(B + `/api/posts/${postId}`)).json();
  ok('往返后图片仍正确（3 张 /uploads）', postAfter.images.filter((u) => u.startsWith('/uploads/')).length === 3);

  // ========== 8. 导出选中 ids ==========
  const expSel = await fetch(B + '/api/admin/export?ids=' + postId, { headers: H });
  const selZip = new AdmZip(Buffer.from(await expSel.arrayBuffer()));
  ok('按 ids 导出只含选中文章', selZip.getEntries().length > 0 && selZip.getEntries().every((e) => e.entryName.startsWith('导入测试·旅行日记/')));

  // ========== 9. 附件文件名唯一性（服务器名） ==========
  ok('附件使用服务器唯一文件名', attachEntries.every((n) => /\/[a-z0-9]+-[a-f0-9]+\./.test(n)));

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('脚本异常:', e); process.exit(1); });
