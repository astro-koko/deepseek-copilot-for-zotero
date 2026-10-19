# Deepseek Copliot

<p align="center">
  <strong>专为 Zotero 打造的 DeepSeek 原生科研阅读副驾驶</strong><br>
  沉浸式边栏阅读 · 一文一独立记忆 · 官方原生联网查证 · 深度思考随心控
</p>

<p align="center">
  <a href="https://github.com/astro-koko/deepseek-copilot-for-zotero/releases"><img src="https://img.shields.io/github/v/release/astro-koko/deepseek-copilot-for-zotero?display_name=tag&style=flat-square" alt="Release"></a>
  <a href="https://www.zotero.org/"><img src="https://img.shields.io/badge/Zotero-7_%7C_8_%7C_9_%7C_10-CC2936?style=flat-square" alt="Zotero Version"></a>
  <a href="https://platform.deepseek.com/"><img src="https://img.shields.io/badge/Powered%20by-DeepSeek-blue?style=flat-square" alt="Powered by DeepSeek"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL%20v3-green?style=flat-square" alt="License"></a>
</p>

---

> **🎉 v1.1.0 重磅发布**：
> - **官方原生联网搜索**：原生集成 DeepSeek Search 官方 API，同一个 API Key 同时支持对话与联网查证，无需配置任何 MCP 服务器或第三方搜索，开箱即用！
> - **深度思考自主调节**：全新引入 Thinking 开关与 `Reasoning Effort`（思考深度：Low / Max）控制，在极速扫读与严密深度推理之间自由切换。
> - **极简统一体验**：统一核心架构与配置面板，全面优化 Zotero 窄侧栏排版与 LaTeX 公式显示。

---

## 💡 为什么选择 Deepseek Copliot？

在日常文献阅读中，真正打断科研思路的往往不是理解难度，而是**频繁的上下文搬运与信息断层**：
- 复制论文段落到外部 Web AI 聊天框，反复说明“这篇论文在讲什么”；
- 换了一篇文献，所有对话混杂在一个窗口，隔天回来复读时无迹可寻；
- 论文里引用的 2024–2026 前沿进展、开源代码或数据集，大模型容易胡说八道；自己配外部搜索不仅要注册多个平台，还要折腾复杂的 MCP 服务器；
- 普通侧栏插件遇到长公式、复杂表格或代码块常常把工作区撑爆，或者流式生成时疯狂晃动屏幕。

**Deepseek Copliot 把 DeepSeek 强大的推理与检索能力，原生缝合在 Zotero 的阅读现场。**

```
┌───────────────────────────────────┬─────────────────────────────────────┐
│  Zotero PDF 阅读器                │  Deepseek Copliot 原生侧栏          │
│  [论文正文 / 图表 / 公式]         │  [一文一记忆 · 专属深度讨论]        │
│                                   │                                     │
│  • 选中文本即刻提问               │  > 帮我推导公式(4)的物理含义        │
│  • 切换文献自动切换会话           │  AI 深度思考中 (Reasoning: Max)... │
│  • 无需离开 Zotero 工作区         │  • 严密推导过程与物理直觉解析       │
│                                   │  • [网页1] 查证官方开源代码最新更新 │
└───────────────────────────────────┴─────────────────────────────────────┘
```

### 🌟 核心价值

| 维度 | 传统 Web 聊天 / 其它插件 | Deepseek Copliot |
| :--- | :--- | :--- |
| **阅读沉浸感** | 在浏览器与 Zotero 之间来回切换、复制粘贴 | **全原生侧栏嵌入**，选中文献或打开 PDF 立即开始对话 |
| **上下文记忆** | 所有论文对话混在一个窗口，切换即丢失 | **一文一独立会话**，文献切换自动对齐专属历史，长期可追溯 |
| **联网查证** | 需配置 MCP 服务器或额外付费申请搜索引擎 Key | **DeepSeek 官方 Search 原生集成**，1 个 API Key 通用全功能 |
| **推理深度控制** | 固定模型模式，不可调节思考深度 | **思考模式随心控**：Low 模式闪电极速，Max 模式深度推演 |
| **上下文质量** | RAG 式片段检索，容易断章取义 | **整篇论文全文优先注入**，辅以长对话智能渐进式压缩 |
| **排版与自适应** | 窄边栏横向溢出撑破、数学公式乱码、生成跳动 | **专为 Zotero 侧栏打造**，KaTeX 公式/代码/表格自适应重排 |

---

## 🚀 v1.1.0 新版本特性亮点

### 1. 🔍 DeepSeek 官方原生联网搜索（一键开启）
告别繁琐的第三方搜索引擎注册与复杂的 MCP 服务配置。v1.1.0 直接深度集成 DeepSeek 官方 Search API (`/v1/tools/search`)：
- **零额外成本**：复用现有的 DeepSeek API Key，无需额外付费或申请第三方凭据。
- **开箱即用**：在插件设置中勾选「启用联网搜索」即可立即生效。
- **学术优先原则**：回答始终以当前论文全文为坚实锚点，联网搜索仅用于查证最新复现进展、相关论文对比、开源代码仓库与数据集更新。
- **透明引用溯源**：外部搜索结果明确标注文献外的引用标记（如 `[网页1]`、`[网页2]`），随时点击回溯，严防学术幻觉。

### 2. ⚡ 深度思考与推理深度控制（Reasoning Effort）
统一采用高性价比、响应极速的 `deepseek-flash` 核心架构，并首次开放深度思考控制面板：
- **Thinking 深度思考开关**：支持全局开启或关闭模型思考过程。
- **推理深度灵活调节**：
  - **`Low` 极速模式（默认）**：兼顾思考能力与极致响应速度，适合论文粗读、主旨提炼、术语速查与快速问答，大幅节省等待时间与 Token 消耗。
  - **`Max` 深度模式**：释放模型的深层逻辑推演能力，适合攻关复杂数学公式推导、实验设计严密性批判、算法边界探讨与长篇代码逻辑分析。

### 3. 🧼 极致清爽的统一配置
- 淘汰过时的多模型切换困扰与冗余的第三方配置项，界面极致简洁。
- 旧版本配置全自动平滑迁移升级，零迁移负担。

### 4. 📐 侧栏排版自适应与阅读体验进化
- **窄侧栏自适应重排**：彻底修复侧栏在较窄宽度下的内容裁剪问题，随窗口拖拽流畅伸缩。
- **数学公式深度渲染**：KaTeX 引擎强力支持行内与独立块级公式，针对模型常见的推导语法进行容错优化。
- **流式防抖输出**：长文本生成时智能锁定当前阅读位置，不跳帧、不晃动，保护阅读专注力。

---

## 🎯 核心科研场景与使用技巧

### 场景一：10 秒速读全篇核心价值
> 💡 *打开 PDF，直接输入快捷指令：*
- `/总结`：一键提炼论文的研究背景、核心痛点、所提方法与主要贡献。
- 提问：“这篇论文相比于去年的 SOTA 方案，核心突破点到底在哪里？”

### 场景二：复杂公式与方法深度拆解
> 💡 *切换至 `Reasoning Effort: Max` 深度模式：*
- 提问：“请详细推导本文第 4 页公式 (3) 到公式 (4) 的数学转化过程，并解释其中的物理直觉。”
- 提问：“作者提出的这个损失函数在处理长尾分布时可能存在什么潜在缺陷？”

### 场景三：前沿查证与复现追踪（开启联网搜索）
> 💡 *无需切换浏览器，AI 自动联网求证：*
- 提问：“作者在文中用到的 XXX 数据集，近期有发布更新版本或修复补丁吗？”
- 提问：“这篇论文提出的算法有开源的 PyTorch 官方实现吗？社区目前的复现效果如何？”
- 提问：“该方法在工业界自动驾驶场景中，目前有哪些落地应用或评测结果？”

### 场景四：批判性审稿与局限性挖掘
> 💡 *辅助 Peer Review 与 Thesis 写作：*
- 提问：“作者在实验部分选取 Baseline 时是否存在避重就轻的问题？有哪些关键对比实验缺失？”
- 提问：“从计算复杂度和内存消耗角度，该方法在边缘设备部署的可行性如何？”

---

## ⚡ 30 秒极速上手

1. **安装插件**：参考下方[安装指南](#-安装指南)完成安装，重启 Zotero。
2. **填入 API Key**：
   - 打开 Zotero，进入顶部菜单 `Zotero / 工具 -> 设置 (Settings) -> Deepseek Copliot`。
   - 填写你的 [DeepSeek API Key](https://platform.deepseek.com/) 并点击 **“验证连接”**。
   - 勾选 **“启用联网搜索”**（推荐），即可畅享完整查证功能。
3. **开始沉浸阅读**：
   - 在文献库中选中论文，或在 PDF 阅读器中直接阅读。
   - 点击右侧栏的 **`Deepseek Copliot`** 图标展开面板，直接提问或键入 `/` 调出预设指令！

---

## 📦 安装指南

> **兼容性全覆盖**：支持 **Zotero 7 / 8 / 9 / 10** 全系列版本，跨 Windows / macOS / Linux 平台。

### 方式一：通过 Zotero 插件商店安装（推荐）

1. 打开 Zotero，点击顶部菜单 `工具 -> 插件`（或 `Add-ons`）。
2. 在插件市场搜索框输入 `Deepseek Copliot`。
3. 点击 **安装**（Install），完成后重启 Zotero 即可。

### 方式二：手动下载 `.xpi` 安装

1. 前往 GitHub [Releases 页面](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases) 下载最新的 `Deepseek.Copliot-1.1.0.xpi`。
2. 在 Zotero 中点击 `工具 -> 插件`。
3. 点击右上角的 ⚙️ 齿轮图标，选择 **`Install Plugin From File...`**。
4. 选中刚下载的 `.xpi` 文件确认安装，重启 Zotero 即可。

---

## ⚙️ 配置说明

在 Zotero 设置窗口中找到 **Deepseek Copliot** 专属面板：

```
┌───────────────────────────────────────────────────────────────┐
│ Deepseek Copliot 设置                                         │
├───────────────────────────────────────────────────────────────┤
│ API 凭据                                                      │
│ DeepSeek API Key: [ sk-******************************** ]     │
│ [ 验证连接 ] (支持对话与官方联网搜索)                          │
├───────────────────────────────────────────────────────────────┤
│ 深度思考 (Thinking Settings)                                  │
│ [x] 启用深度思考 (Thinking Enabled)                           │
│ 思考深度 (Reasoning Effort): [ Low (极速推荐)  ▼ ]            │
│                              Low (极速推荐)                   │
│                              Max (深度推演)                   │
├───────────────────────────────────────────────────────────────┤
│ 联网搜索 (Web Search)                                         │
│ [x] 启用联网搜索 (DeepSeek Official Search API)               │
│     由 DeepSeek 官方搜索强力驱动，论文优先，来源明确标注       │
└───────────────────────────────────────────────────────────────┘
```

1. **DeepSeek API Key**：前往 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册并获取 API Key。1 个 Key 即可覆盖全部对话与联网功能。
2. **深度思考控制**：
   - 建议日常科研保持默认的 `Low`，响应迅捷且足够聪明；
   - 攻坚推导或写审稿意见时切换为 `Max`。
3. **联网搜索开关**：
   - 默认开启。在阅读文献时，如提问涉及外部动态或最新信息，AI 将自动调用 DeepSeek 官方 Search 工具。

---

## 🔬 底层机制与上下文哲学

- **文献级物理隔离**：每篇论文在本地拥有专属会话 ID，彻底隔离多论文讨论，互不干扰污染。
- **全文优先装载**：只要文献长度在模型上下文容纳范围内，插件始终优先向模型注入论文完整全文，杜绝因切片截断引起的上下文失真。
- **长多轮智能渐进压缩**：当长对话逼近模型窗口上限（约 90%）时，系统自动对早期问答进行渐进式摘要总结，同时**绝对保留论文核心正文与最近几轮讨论**。
- **本地低开销缓存**：已解析的文献文本在本地安全缓存，同一论文连续多轮提问无需重复提取 PDF 文本，内存占用严格受限，轻量无负担。

---

## ❓ 常见问题 (FAQ)

<details>
<summary><strong>Q1: 联网搜索需要像以前一样配置 MCP 或第三方搜索引擎吗？</strong></summary>

**完全不需要！** 
v1.1.0 起原生接入 DeepSeek 官方 Search 接口。只要你的 DeepSeek API Key 有效，勾选开关即可直接使用，无需安装 Node.js、配置 MCP 服务或申请 Tavily/OpenAlex 等凭据。
</details>

<details>
<summary><strong>Q2: 深度思考中的 Low 和 Max 有什么具体区别？</strong></summary>

- **Low（推荐）**：分配适度思考预算，模型会先快速理清逻辑再作答。兼顾了高回答质量与秒级响应，日常泛读与文献总结体验最佳。
- **Max**：允许模型进行大跨度深度推演与自我反思校验。适合攻克硬核数理推导、寻找逻辑破绽、长代码编写或分析复杂因果关系，但生成等待时间和 Token 消耗会有所增加。
</details>

<details>
<summary><strong>Q3: 从 1.0.x 升级到 1.1.0 后，我原有的历史对话会丢失吗？</strong></summary>

不会。插件具备完备的向下兼容与自动数据迁移机制，你之前为每篇论文保存的讨论记录、自定义 Prompt 均会完整保留。
</details>

<details>
<summary><strong>Q4: 为什么我的公式没有正常渲染成 LaTeX 样式？</strong></summary>

插件内置了 KaTeX 引擎，支持标准的 `$...$` 行内公式和 `$$...$$` 块级公式。如果发现公式未渲染，可在提问时提示“请使用标准 LaTeX 格式输出数学公式”。
</details>

---

## 💬 社区交流与反馈

欢迎加入 Deepseek Copliot 微信交流群，与众多科研同行交流使用体验、反馈建议或提交 Bug：

<p align="center">
  <img src="docs/community/assets/deepseek-copilot-wechat-group-2026-08-13.jpg" alt="Deepseek Copliot 微信交流群" width="300"><br>
  <em>如遇二维码过期，请前往 <a href="https://github.com/astro-koko/deepseek-copilot-for-zotero/issues">GitHub Issues</a> 获取最新入群方式</em>
</p>

- 🐛 **提交 Bug 或建议**：欢迎前往 [GitHub Issues](https://github.com/astro-koko/deepseek-copilot-for-zotero/issues) 反馈
- 📜 **版本更新历史**：详见 [CHANGELOG.md](CHANGELOG.md)
- ⭐ **支持我们**：如果 Deepseek Copliot 对你的科研阅读有所帮助，欢迎在 GitHub 右上角点亮一颗 **Star**！
