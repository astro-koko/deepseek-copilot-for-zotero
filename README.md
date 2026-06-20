# Deepseek Copliot

[![Release](https://img.shields.io/github/v/release/astro-koko/deepseek-copilot-for-zotero?display_name=tag&style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)
[![Zotero](https://img.shields.io/badge/Zotero-9%20stable-CC2936?style=flat-square)](https://www.zotero.org/)

`Deepseek Copliot` 是一个给 Zotero 用的 AI 论文阅读插件。

你在 Zotero 里选中一篇论文，或者在阅读器里打开 PDF 后，插件会自动关联当前论文内容，让你直接提问、总结、解释和追问，不需要再把论文复制到别的聊天工具里。

它也不再把不同文献的对话混在一起。每篇论文或 PDF 都可以保留自己的会话上下文，你在多篇文献之间来回切换时，切回原文献还能继续之前的阅读线程。

## 插件市场安装

插件已经上线 Zotero 插件市场，搜索 `Deepseek Copliot` 就可以直接下载安装。

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

## 当前版本说明

`v0.9.6` 这一版不只是界面打磨，也补上了更适合真实阅读流程的几个关键能力：

- 修复多篇文献或多 PDF 标签来回切换时的会话串线问题，让每篇论文 / PDF 保持自己的对话上下文
- 设置页里的命令改成卡片式编辑，区分默认命令和自定义命令，用户可以直接改标题、简写和提示词
- 支持新增自定义命令，用自己的阅读习惯组织常用提问方式
- 侧栏首页展示 8 个默认建议操作，排版更紧凑，也会同步用户改过的默认标题
- 输入框和空状态文案会明确提示你使用 `/` 快捷命令

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

当前稳定版本是 `v0.9.7`。

## 微信群交流

欢迎大家进入微信群交流：

![Deepseek Copliot 微信交流群二维码](docs/community/assets/deepseek-copilot-wechat-group-2026-06-25.jpg)
