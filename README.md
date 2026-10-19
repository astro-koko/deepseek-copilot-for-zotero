# Deepseek Copliot

[![Release](https://img.shields.io/github/v/release/astro-koko/deepseek-copilot-for-zotero?display_name=tag&style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)
[![Zotero](https://img.shields.io/badge/Zotero-7--10-CC2936?style=flat-square)](https://www.zotero.org/)

> **🎉 v1.1.0 重要更新**：原生集成 DeepSeek Search 联网搜索！无需配置 MCP 服务器，勾选即用，让 AI 在阅读论文时自动查证最新信息。

读论文时，真正打断思路的往往不是提问本身，而是反复搬运上下文：从 Zotero 复制片段、切到外部聊天工具、重新说明正在读哪篇论文；看完几篇文献再回来，之前的讨论已经散落在不同对话里，找不到头绪。

**Deepseek Copliot 把 AI 直接嵌入 Zotero 的阅读现场。** 选中文献或打开 PDF，就能在右侧边栏直接提问、总结、解释和追问，让对话始终围绕当前正在读的论文展开。

**它不是通用聊天窗口，而是以论文为单位组织记忆的阅读伙伴。** 每篇论文都有独立的会话线程，在多篇文献之间切换时，回到原论文即可无缝接续之前的讨论，不会把不同论文的上下文混在一起。

## 为什么选择 Deepseek Copliot

- **🎯 不打断阅读流**：论文阅读、AI 提问与回答在同一工作区完成，无需在 Zotero 与外部工具之间反复切换和复制粘贴。
- **🧠 每篇论文都有独立记忆**：会话与文献深度绑定。今天问方法，明天回来继续追问结论、局限或实验细节，AI 会记住之前的讨论脉络。
- **📄 基于完整论文，而非零散片段**：只要论文能放进模型上下文，就优先保留全文；接近窗口上限时，自动整理较早对话，但论文全文和最近讨论始终保留。
- **📱 专为 Zotero 侧栏优化**：流式回答不会频繁跳动阅读位置，窄侧栏中长文本自动重排，代码、表格和超长公式在独立区域滚动，不会撑开整个面板。
- **🔍 原生联网搜索，无需折腾 MCP**：v1.1.0 直接集成 DeepSeek Search API，设置中一键启用。不用配置复杂的 MCP 服务器，不用安装额外工具，开箱即用。

**核心理念：一篇论文，一条对话线，让 AI 真正参与你的阅读过程，而不是成为另一个需要管理的工具。**

## 🚀 1.1.0 重大更新

### 🔍 DeepSeek Search 原生集成

**终于不用再折腾 MCP 联网搜索配置了！** v1.1.0 原生集成 DeepSeek 官方的 Search API，让 AI 在阅读论文时自动查证最新信息：

- ✅ **一键启用**：设置中勾选"启用联网搜索"即可，无需安装 MCP 服务器、无需额外配置
- ✅ **智能查证**：AI 会根据你的问题自动搜索相关的最新研究、背景知识、技术文档
- ✅ **来源透明**：搜索结果会明确标注来源链接，与论文内容清晰区分，便于交叉验证
- ✅ **论文优先**：联网搜索仅作补充，AI 的主要回答仍然基于当前论文全文

**使用场景示例**：
- 问"这篇论文提到的 Transformer 架构有什么最新改进？" → AI 会结合论文内容 + 最新研究进展回答
- 问"作者使用的数据集在最近有更新版本吗？" → AI 会自动查证数据集的官方信息
- 问"这个方法在工业界有哪些实际应用？" → AI 会补充论文之外的应用案例

### 其他改进

- **更精准的推理控制**：支持调整模型推理深度（`reasoning_effort: low/max`），在回答速度与深度思考质量之间灵活平衡
- **UI 细节优化**：修复侧栏在窄宽度下的内容裁剪问题，改善长公式和代码块的显示体验

### 1.0 核心能力回顾

- **流式回复更顺滑**：长回答生成时减少界面卡顿，阅读位置不会因持续刷新频繁跳动。
- **侧栏自适应**：聊天内容和输入框会随 Zotero 侧栏宽度重排；长文本正常换行，代码、表格和超长公式只在自身区域滚动，不再挤出对话。
- **比较信息更易读**：回答优先使用纵向分组列表或三列以内的小表，减少窄侧栏里的横向滚动。
- **长论文对话更连贯**：完整论文能放进模型窗口时会优先保留全文；接近上限时只整理较早交流，并保留论文和最近讨论。

## 快速安装

### 方式一：Zotero 插件市场（推荐）

1. 打开 Zotero，进入 `工具 -> 插件 -> Get add-ons`
2. 搜索 `Deepseek Copliot`
3. 点击安装并重启 Zotero

### 方式二：手动安装

1. 从 [GitHub Releases](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases) 下载最新的 `Deepseek.Copliot-1.1.0.xpi`
2. 打开 Zotero，进入 `工具 -> 插件`
3. 点击右上角齿轮图标，选择 `Install Plugin From File...`
4. 选择下载的 `.xpi` 文件，重启 Zotero

> **兼容性**：支持 Zotero 7, 8, 9, 10 全系列版本，统一安装包，无需按版本分别下载。

## 核心功能

- **💬 智能对话**：围绕当前论文直接提问、总结、解释和深度追问
- **🔗 上下文自动关联**：打开 PDF 后自动识别当前阅读上下文，每篇文献独立保存会话历史
- **⚡ 快捷命令**：通过 `/` 快速调用总结、解释、方法拆解、研究局限等预设指令
- **🎨 自定义命令**：在设置中创建和管理你自己的常用提示词模板
- **📐 富文本渲染**：完整支持 Markdown 和 LaTeX，行内公式、独立公式、列表、代码块与表格在侧栏中精美呈现
- **🔍 联网搜索（v1.1.0 新增）**：无需配置 MCP，一键启用 DeepSeek Search，AI 自动查证论文外的最新信息和背景知识
- **🎯 精准理解**：快速把握论文的研究问题、核心方法、实验结论、理论局限和关键技术细节

## 快速上手

1. 安装插件后，打开 `Settings -> Deepseek Copliot`，填写你的 [DeepSeek API Key](https://platform.deepseek.com/) 并点击"验证连接"
2. **（推荐）勾选"启用联网搜索"**，让 AI 能够查证最新研究进展和背景知识，无需任何额外配置
3. 在 Zotero 文库中选中一篇论文，或直接打开 PDF 阅读器
4. 点击右侧 `Deepseek Copliot` 面板，输入问题或输入 `/` 调出快捷命令
5. 切换到其他论文时，插件会自动切换到对应文献的会话；回到原论文即可继续之前的讨论

**提问示例**：
- "帮我总结这篇论文的核心贡献"
- "/方法 详细解释一下作者的实验设计"
- "这个模型和 Transformer 有什么区别？"（启用联网搜索后可自动查证 Transformer 的最新发展）
- "这篇论文的局限性在哪里？"

## 上下文管理与性能

**会话隔离**：每篇论文都有独立的对话线程，不会把多篇论文的内容混入同一个上下文窗口。

**智能缓存**：最近阅读的 PDF 文本会在本地有限缓存，避免连续提问时重复提取；插件会自动控制缓存规模，不会长期占用过多内存。

**上下文优先级**：论文全文作为稳定上下文优先保留，帮助服务端在连续对话中复用已有内容。当对话接近模型窗口上限（约 90%）时，插件会自动整理较早的交流内容，但论文全文和最近讨论始终保留。

**容量提醒**：如果单篇论文超过模型的硬性上下文限制，插件会明确提示，不会静默截断或拆分正文。

## 版本信息

**当前版本**：`v1.1.0`

**兼容性**：
- ✅ Zotero 7, 8, 9, 10 全系列支持
- ✅ Windows, macOS, Linux 跨平台
- ✅ 统一安装包 `Deepseek.Copliot-1.1.0.xpi`，无需按 Zotero 版本分别下载

完整更新历史请查看 [CHANGELOG.md](CHANGELOG.md)

## 配置说明

### 基础配置

1. 打开 Zotero，进入 `Settings -> Deepseek Copliot`
2. 填写你的 [DeepSeek API Key](https://platform.deepseek.com/)，点击”验证连接”确认可用性
3. （可选）调整推理深度：`low` 模式响应更快，`max` 模式思考更深入

### 联网搜索配置（v1.1.0 新增）

**无需配置 MCP 服务器，直接勾选即可！**

在设置中勾选”启用联网搜索”，AI 将使用 DeepSeek 官方的 Search API 自动查证最新信息：
- ✅ 搜索结果会明确标注来源链接，便于交叉验证
- ✅ 论文内容与外部资料清晰区分，不会混淆
- ✅ 同一个 API Key 同时支持对话和搜索功能，无需额外费用

### 相关资源

- **获取 API Key**：[DeepSeek Platform](https://platform.deepseek.com/)
- **Search API 文档**：[api-docs.deepseek.com](https://api-docs.deepseek.com/)
- **完整更新日志**：[CHANGELOG.md](CHANGELOG.md)

## 手动安装

如果你不想走插件市场，也可以从 GitHub Releases 手动安装：

1. 打开本仓库的 GitHub Releases 页面。
2. 下载最新的 `Deepseek.Copliot-<version>.xpi`。
3. 在 Zotero 中打开 `工具 -> 插件`。
4. 点击右上角齿轮菜单，选择 `Install Plugin From File...`。
5. 选中下载好的 `.xpi` 文件并完成安装。
6. 重启 Zotero。

当前稳定版本是 `v1.1.0`，手动安装文件名为 `Deepseek.Copliot-1.1.0.xpi`。

## 社区交流

欢迎加入微信群交流使用体验、提出建议或报告问题！

<img src="docs/community/assets/deepseek-copilot-wechat-group-2026-08-13.jpg" alt="Deepseek Copliot 微信交流群" width="360">

> 二维码有效期至 2026-08-13，过期后请在 GitHub Issues 中联系获取新二维码。

---

**Star ⭐ 本项目以支持开发 | [GitHub Issues](https://github.com/astro-koko/deepseek-copilot-for-zotero/issues) | [更新日志](CHANGELOG.md)**
