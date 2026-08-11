import { Notice, Platform, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, BlogPublisherSettings, BlogPublisherSettingTab } from "./src/settings";
import { publishFile } from "./src/upload";

export default class BlogPublisherPlugin extends Plugin {
  settings: BlogPublisherSettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new BlogPublisherSettingTab(this.app, this));

    this.addCommand({
      id: "publish-current-note",
      name: "发布当前笔记到博客",
      callback: () => this.publishActiveFile(),
    });

    this.addRibbonIcon("paper-plane", "发布到博客", () => this.publishActiveFile());
  }

  onunload() {}

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async publishActiveFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("请先打开要发布的笔记");
      return;
    }
    if (!this.settings.serverUrl || !this.settings.token) {
      new Notice("请先在设置中填写服务器地址和访问令牌");
      return;
    }
    try {
      const r = await publishFile(this.app, file, this.settings);
      const parts = [r.created ? "已发布新文章" : "已更新文章", r.title];
      if (r.warnings.length) parts.push(`（${r.warnings.length} 张图片未上传）`);
      new Notice(parts.join("："), 6000);
      if (Platform.isDesktop) {
        // 桌面端：浏览器打开文章页
        window.open(this.settings.serverUrl + r.url, "_blank");
      } else {
        // 移动端：window.open 不可靠，直接展示链接方便复制
        new Notice(`文章链接：${this.settings.serverUrl}${r.url}`, 10000);
      }
      for (const w of r.warnings) new Notice(w, 4000);
    } catch (e) {
      new Notice(`发布失败：${(e as Error).message}`, 8000);
      console.error(e);
    }
  }
}
