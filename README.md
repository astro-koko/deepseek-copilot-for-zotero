# Deepseek Copliot

[![Release](https://img.shields.io/github/v/release/astro-koko/deepseek-copilot-for-zotero?display_name=tag&style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)
[![Zotero](https://img.shields.io/badge/Zotero-7--10-CC2936?style=flat-square)](https://www.zotero.org/)

`Deepseek Copliot` 是一个给 Zotero 用的 AI 论文阅读插件。

你在 Zotero 里选中一篇论文，或者在阅读器里打开 PDF 后，插件会自动关联当前论文内容，让你直接提问、总结、解释和追问，不需要再把论文复制到别的聊天工具里。

它也不再把不同文献的对话混在一起。每篇论文或 PDF 都可以保留自己的会话上下文，你在多篇文献之间来回切换时，切回原文献还能继续之前的阅读线程。

## 安装

推荐优先通过 Zotero 插件市场安装。Zotero 7、8、9、10 用户可以搜索 `Deepseek Copliot`，等待插件市场数据源刷新后直接下载安装。

如果某个 Zotero 版本筛选页暂时还搜不到，请先从本仓库的 GitHub Releases 手动安装最新 `.xpi`。插件市场通常需要等待公开 feed 刷新；维护者可以用 `npm run marketplace:check -- --target <7|8|9|10>` 检查数据源是否已经收录对应版本。

## 它能做什么

- 围绕当前论文直接提问、总结、解释和追问
- 打开 PDF 后自动加载当前 PDF 的阅读上下文
- 在多篇论文或多个 PDF 标签之间切换时，按当前文献保持各自会话
- 通过 `/` 快捷命令快速触发总结、解释、方法拆解、研究局限等常用操作
- 在设置页编辑默认命令，或新增自己的自定义命令
- 更适合快速读懂论文主旨、方法、结论和细节
- 需要时可以开启联网查证

## 怎么用

1. 在 Zotero 文库中选中一篇论文，或者直接打开一篇 PDF。
2. 打开右侧 `Deepseek Copliot` 面板。
3. 直接输入问题，或者先输入 `/` 调出快捷命令。
4. 如果你切到另一篇论文或另一个 PDF，插件会优先恢复当前文献对应的会话，而不是把不同文献的聊天记录串在一起。

你可以这样问：

- “帮我总结这篇论文”
- “/总结 这篇论文的核心贡献”
- “/方法 解释一下作者的方法设计”
- “这篇论文的方法核心是什么？”
- “这篇论文的结论和局限有哪些？”

## 当前版本

当前稳定版本是 `v0.9.8`。这一版是 Zotero 7、8、9、10 共用的统一发布包，用同一个 XPI 和同一个版本号发布：

- 将公开发布包的 Zotero 兼容范围设为 Zotero `7.0` 到 `10.*`
- Zotero 7、8、9、10 都使用 `Deepseek.Copliot-0.9.8.xpi`，不拆分不同版本号
- Zotero 10 beta 已完成 packaged smoke：插件管理器、设置页、文库右侧面板、阅读器右侧面板、选中文本弹窗和右键菜单均通过
- 增加插件市场 feed 检查命令，确认 Zotero Chinese / Add-on Market 数据源是否已经收录对应 Zotero 目标

## 第一次使用

1. 打开 `Settings -> Deepseek Copliot`。
2. 填写你的 `DeepSeek API Key`。
3. 点击“验证连接”确认可以正常使用。
4. 如果你需要联网查证，可以保留默认查证来源，或者切换到 `Tavily`。

相关入口：

- DeepSeek Platform: [platform.deepseek.com](https://platform.deepseek.com/)
- Tavily App: [app.tavily.com](https://app.tavily.com/)

## 手动安装

如果你不想走插件市场，也可以从 GitHub Releases 手动安装：

1. 打开本仓库的 GitHub Releases 页面。
2. 下载最新的 `Deepseek.Copliot-<version>.xpi`。
3. 在 Zotero 中打开 `工具 -> 插件`。
4. 点击右上角齿轮菜单，选择 `Install Add-on From File...`。
5. 选中下载好的 `.xpi` 文件并完成安装。
6. 重启 Zotero。

当前稳定版本是 `v0.9.8`，手动安装文件名为 `Deepseek.Copliot-0.9.8.xpi`。

## 微信群交流

欢迎大家进入微信群交流：

<img src="docs/community/assets/deepseek-copilot-wechat-group-2026-07-08.jpg" alt="Deepseek Copliot 微信交流群二维码" width="360">
