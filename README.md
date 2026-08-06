# Deepseek Copliot

[![Release](https://img.shields.io/github/v/release/astro-koko/deepseek-copilot-for-zotero?display_name=tag&style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)
[![Zotero](https://img.shields.io/badge/Zotero-7--10-CC2936?style=flat-square)](https://www.zotero.org/)

`Deepseek Copliot` 是一款运行在 Zotero 内的 AI 论文阅读插件。

在 Zotero 文库中选中文献，或在阅读器中打开 PDF 后，你可以直接围绕当前论文提问、总结、解释和追问，不必再把内容复制到其他聊天工具。

每篇论文或 PDF 都拥有独立会话。你在多篇文献之间切换后，回到原文献即可继续原来的阅读线程，不会把不同论文的讨论混在一起。

**核心原则：一个对话围绕一篇论文。** 论文会尽可能完整地保留在上下文中；只有当对话接近模型窗口上限时，才整理较早交流，为后续追问腾出空间。

## 1.0 体验更新

- **流式回复更顺滑**：长回答生成时减少界面卡顿，阅读位置不会因持续刷新频繁跳动。
- **侧栏自适应**：聊天内容和输入框会随 Zotero 侧栏宽度重排；长文本正常换行，代码、表格和超长公式只在自身区域滚动，不再挤出对话。
- **比较信息更易读**：回答优先使用纵向分组列表或三列以内的小表，减少窄侧栏里的横向滚动。
- **长论文对话更连贯**：完整论文能放进模型窗口时会优先保留全文；接近上限时只整理较早交流，并保留论文和最近讨论。

## 安装

推荐优先通过 Zotero 插件市场安装。Zotero 7、8、9、10 用户可以搜索 `Deepseek Copliot`，等待插件市场数据源刷新后直接下载安装。

如果某个 Zotero 版本筛选页暂时还搜不到，请先从本仓库的 GitHub Releases 手动安装最新 `.xpi`。插件市场通常需要等待公开 feed 刷新；维护者可以用 `npm run marketplace:check -- --target <7|8|9|10>` 检查数据源是否已经收录对应版本。

## 核心能力

- 围绕当前论文直接提问、总结、解释和追问
- 打开 PDF 后自动关联当前阅读上下文，并按文献保存各自会话
- 通过 `/` 快捷命令快速执行总结、解释、方法拆解和研究局限等操作
- 在设置中调整默认命令，或创建自己的常用命令
- 支持 Markdown 和 LaTeX：行内公式、独立公式、列表、代码与表格均会在侧栏中妥善呈现
- 可选联网查证，用于补充当前论文之外的公开信息
- 适合快速把握论文的研究问题、方法、结论、局限和关键细节

## 开始使用

1. 安装插件后，打开 `Settings -> Deepseek Copliot`，填写你的 `DeepSeek API Key` 并验证连接。
2. 在 Zotero 文库中选中一篇论文，或直接打开 PDF。
3. 打开右侧 `Deepseek Copliot` 面板，输入问题或先输入 `/` 调出快捷命令。
4. 切到另一篇论文或 PDF 后，插件会切换到该文献自己的会话；回到原文献即可继续之前的讨论。

## 上下文与资源占用

- 一个对话绑定一篇论文或当前 PDF，不会把多篇全文混入同一个上下文窗口。
- 最近使用的 PDF 文本会在本地有限缓存，避免连续提问时反复提取；插件会控制缓存规模，避免长期占用过多内存。
- 论文内容会保持为稳定上下文，帮助服务端在连续追问时复用已有内容。
- 约 90% 的模型窗口是自动整理较早交流的软阈值，不是论文长度上限。整理不会新建或切换会话，论文全文和最近讨论会优先保留。
- 如果单篇论文已经超过所选模型的硬性上下文上限，插件会明确提示，而不会静默截断或拆分正文。

你可以这样问：

- “帮我总结这篇论文”
- “/总结 这篇论文的核心贡献”
- “/方法 解释一下作者的方法设计”
- “这篇论文的方法核心是什么？”
- “这篇论文的结论和局限有哪些？”

## 版本与兼容性

当前稳定版本是 `v1.0.0`，使用适配 Zotero 7、8、9 和 10 的统一安装包：

- Zotero 7、8、9、10 都使用 `Deepseek.Copliot-1.0.0.xpi`，无需按 Zotero 版本分别下载。
- 开发测试包与正式发布包使用相同的运行时代码；正式包只使用正式版本元数据和更新地址。
- 完整更新内容请查看 [CHANGELOG](CHANGELOG.md)。

## 配置模型服务

1. 打开 `Settings -> Deepseek Copliot`。
2. 填写你的 `DeepSeek API Key`，然后点击“验证连接”。
3. 如需联网查证，可保留默认查证来源，或切换到 `Tavily`。

相关入口：

- DeepSeek Platform: [platform.deepseek.com](https://platform.deepseek.com/)
- Tavily App: [app.tavily.com](https://app.tavily.com/)

## 手动安装

如果你不想走插件市场，也可以从 GitHub Releases 手动安装：

1. 打开本仓库的 GitHub Releases 页面。
2. 下载最新的 `Deepseek.Copliot-<version>.xpi`。
3. 在 Zotero 中打开 `工具 -> 插件`。
4. 点击右上角齿轮菜单，选择 `Install Plugin From File...`。
5. 选中下载好的 `.xpi` 文件并完成安装。
6. 重启 Zotero。

当前稳定版本是 `v1.0.0`，手动安装文件名为 `Deepseek.Copliot-1.0.0.xpi`。

## 微信群交流

欢迎大家进入微信群交流。下面的二维码有效期至 `2026-08-13`：

<img src="docs/community/assets/deepseek-copilot-wechat-group-2026-08-13.jpg" alt="Deepseek Copliot 微信交流群二维码" width="360">
