import { App, TFile } from "obsidian";
import type { BlogPublisherSettings } from "./settings";

export interface PublishResult {
  id: number;
  created: boolean;
  url: string;
  title: string;
  warnings: string[];
}

async function requestJson<T>(url: string, init: RequestInit, settings: BlogPublisherSettings): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.token}`,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/** 读取笔记 frontmatter */
function getFrontMatter(app: App, file: TFile): Record<string, any> {
  return app.metadataCache.getFileCache(file)?.frontmatter || {};
}

/** 按路径解析图片文件（支持相对路径 / 绝对路径 / 按文件名兜底） */
function resolveFile(app: App, file: TFile, target: string): TFile | null {
  const p = target.startsWith("/") ? target.slice(1) : file.parent ? `${file.parent.path}/${target}` : target;
  const f = app.vault.getAbstractFileByPath(p);
  if (f instanceof TFile) return f;
  const base = target.split("/").pop()?.replace(/\.[^.]+$/, "");
  if (!base) return null;
  return app.vault.getFiles().find((x) => x.basename === base) || null;
}

/** 上传单个图片文件，返回服务器 URL */
async function uploadImageFile(app: App, file: TFile, settings: BlogPublisherSettings, target: string, warnings: string[]): Promise<string | null> {
  const img = resolveFile(app, file, target);
  if (!img) {
    warnings.push(`找不到图片文件：${target}`);
    return null;
  }
  const buf = await app.vault.readBinary(img);
  const fd = new FormData();
  fd.append("file", new Blob([buf]), img.name);
  const res = await fetch(`${settings.serverUrl}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.token}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    warnings.push(`图片上传失败（${img.name}）：${(data as any)?.error || res.status}`);
    return null;
  }
  return (data as any)?.url || null;
}

function isExternal(target: string): boolean {
  return /^(https?:|data:|obsidian:|#|\/)/.test(target);
}

/**
 * 处理正文中的内嵌图片：
 * - ![[xxx.png]] 维基链接
 * - ![](path) 相对路径 markdown 图片
 * 上传后替换为服务器 URL，避免重复上传同一张图
 */
async function processImages(
  app: App,
  file: TFile,
  settings: BlogPublisherSettings,
  body: string
): Promise<{ body: string; urls: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const urlByTarget = new Map<string, string>();
  const markdownRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  const wikiRe = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

  const targets = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = markdownRe.exec(body))) {
    const t = m[2];
    if (!isExternal(t)) targets.add(decodeSafe(t));
  }
  while ((m = wikiRe.exec(body))) targets.add(decodeSafe(m[1].trim()));

  for (const t of targets) {
    const url = await uploadImageFile(app, file, settings, t, warnings);
    if (url) urlByTarget.set(t, url);
  }

  let out = body.replace(markdownRe, (full, alt: string, target: string) => {
    if (isExternal(target)) return full;
    const url = urlByTarget.get(decodeSafe(target));
    if (!url) return full;
    const name = alt || target.split("/").pop() || "image";
    return `![${name}](${url})`;
  });
  out = out.replace(wikiRe, (full, target: string) => {
    const url = urlByTarget.get(decodeSafe(target.trim()));
    if (!url) return full;
    const name = target.split("/").pop()?.replace(/\.[^.]+$/, "") || "image";
    return `![${name}](${url})`;
  });

  return { body: out, urls: [...urlByTarget.values()], warnings };
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** 处理 frontmatter 中的封面（支持 URL / 文件名 / ![[wikilink]]） */
async function processCover(app: App, file: TFile, settings: BlogPublisherSettings, coverRaw: any): Promise<string> {
  if (!coverRaw) return "";
  if (typeof coverRaw !== "string") return "";
  if (/^(https?:|data:)/.test(coverRaw)) return coverRaw;
  let target = coverRaw;
  const m1 = coverRaw.match(/^!\[\[([^\]|]+)/);
  if (m1) target = m1[1];
  const m2 = coverRaw.match(/!\[[^\]]*\]\(([^)\s]+)\)/);
  if (m2) target = m2[1];
  const warnings: string[] = [];
  return (await uploadImageFile(app, file, settings, target, warnings)) || "";
}

/** 发布/更新笔记，返回结果 */
export async function publishFile(app: App, file: TFile, settings: BlogPublisherSettings): Promise<PublishResult> {
  const content = await app.vault.read(file);
  const fm = getFrontMatter(app, file);

  // 去掉 frontmatter，只取正文
  const pos = app.metadataCache.getFileCache(file)?.frontmatterPosition;
  let body = content;
  if (pos) {
    body = content
      .split("\n")
      .slice(pos.end.line + 1)
      .join("\n")
      .replace(/^\n+/, "");
  }

  const processed = await processImages(app, file, settings, body);
  const cover = (await processCover(app, file, settings, fm.cover)) || processed.urls[0] || "";

  const tagsRaw: any = fm.tags ?? fm.tag ?? [];
  const tags: string[] = Array.isArray(tagsRaw)
    ? tagsRaw.map(String)
    : String(tagsRaw)
        .split(/[,，\s]+/)
        .filter(Boolean);

  const payload = {
    title: String(fm.title || file.basename).trim(),
    slug: String(fm.slug || file.basename).trim(),
    tags,
    location: String(fm.location || "").trim(),
    cover,
    content: processed.body,
    status: settings.defaultStatus,
  };

  const result = await requestJson<{ id: number; created: boolean; url: string }>(
    `${settings.serverUrl}/api/obsidian/posts`,
    { method: "POST", body: JSON.stringify(payload) },
    settings
  );

  return { ...result, title: payload.title, warnings: processed.warnings };
}
