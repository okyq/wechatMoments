import { App, PluginSettingTab, Setting } from "obsidian";
import type BlogPublisherPlugin from "../main";

export interface BlogPublisherSettings {
  /** 博客服务器地址，如 https://blog.example.com */
  serverUrl: string;
  /** 管理后台「设置」页获取的访问令牌 */
  token: string;
  /** 发布后的默认状态：1 直接发布，0 存为草稿 */
  defaultStatus: number;
}

export const DEFAULT_SETTINGS: BlogPublisherSettings = {
  serverUrl: "",
  token: "",
  defaultStatus: 1,
};

export class BlogPublisherSettingTab extends PluginSettingTab {
  plugin: BlogPublisherPlugin;

  constructor(app: App, plugin: BlogPublisherPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "博客发布设置" });
    containerEl.createEl("p", {
      text: "在博客管理后台「站点设置」页可以找到访问令牌。",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("服务器地址")
      .setDesc("博客服务器地址，例如 https://blog.example.com 或 http://localhost:3000")
      .addText((text) =>
        text
          .setPlaceholder("https://blog.example.com")
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trim().replace(/\/+$/, "");
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("访问令牌")
      .setDesc("在博客管理后台「站点设置」页复制")
      .addText((text) =>
        text
          .setPlaceholder("粘贴访问令牌")
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
            this.plugin.settings.token = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("默认发布状态")
      .setDesc("发布成功后文章在博客上的状态")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("1", "直接发布")
          .addOption("0", "存为草稿")
          .setValue(String(this.plugin.settings.defaultStatus))
          .onChange(async (value) => {
            this.plugin.settings.defaultStatus = Number(value);
            await this.plugin.saveSettings();
          })
      );
  }
}
