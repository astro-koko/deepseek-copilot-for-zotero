# Changelog

## v1.2.0

🎉 **重大更新：联网检索质量全面重构**

### 新特性

- **智能检索规划**：按问题意图（相关工作 / 最新进展 / 事实核查 / 一般）自动生成最多两条主题化查询，剥离长提示词样板；传递原始问题（`ori_question`）改善引擎理解，相关工作查询附带精确标题排除，最新进展查询附带年份限定（`after:`）。
- **两段式反思检索**：首轮未检索到独立文献时，由模型基于问题与首段缺口提炼一条补充检索式自动再搜一次，显著降低"想搜但搜不到"的落空率；审计消息中标注"含模型补充检索"。
- **内容实体锚点检索**：从论文全文提取高频缩写与专名（如巡天名、方法名）作为第二条检索角度——施引文献通常不写原文标题，但必然讨论这些实体，突破主题词检索盲区。

### 改进

- **作品级去重与主论文折叠**：按 DOI / arXiv 编号 / 标题相似度把同一论文在出版社、目录、索引站的多条记录合并折叠，独立文献区不再被当前论文刷屏（实测相关工作场景从 4/5 主论文页降至 0-1 条折叠）。
- **模型上下文注入优化**：优先使用官方"供模型消费"的检索摘要（`summary`）并按条封顶，控制注入长度；结果分组标注"独立相关文献"与"当前论文自身条目"。
- **上下文先行装配**：检索前先解析论文 DOI/arXiv 身份用于主论文折叠；阻断性上下文错误不再触发无效搜索。
- **追问意图继承**：极短的元请求型追问（如"需要你联网搜索"）继承上一轮检索意图；"2026 年有相关工作吗"式年份追问自动升级为最新进展检索。
- **传输层缺陷修复**：修复长提问截断联网查询时丢失论文主题、搜索结果偏离当前论文的问题；向模型明确传递本轮检索成功/无结果/失败状态；补全搜索摘要回退、响应格式校验、HTTP 错误提示和响应体超时处理。

## v1.1.0

🎉 **重大更新：原生集成 DeepSeek Search 联网搜索**

无需配置 MCP 服务器，设置中一键启用即可让 AI 自动查证最新信息。

### 新特性

- **DeepSeek Search 原生集成**：直接使用 DeepSeek 官方的 `/v1/tools/search` API，无需安装额外工具或配置 MCP 服务器
- **智能联网查证**：AI 会根据问题自动搜索相关的最新研究、背景知识和技术文档，搜索结果明确标注来源链接
- **论文优先策略**：联网搜索仅作补充，AI 的主要回答仍然基于当前论文全文
- **推理深度控制**：支持调整 `reasoning_effort` 参数（low/max），在回答速度与深度思考质量之间灵活平衡

### 改进

- 修复侧栏在窄宽度下的内容裁剪问题
- 改善长公式和代码块的显示体验
- 优化 UI 细节和性能

### 使用方法

打开 `Settings -> Deepseek Copliot`，勾选"启用联网搜索"即可。同一个 DeepSeek API Key 同时支持对话和搜索功能。

## v1.0.1

修复 Zotero Library 与 PDF Reader 原生窄侧栏在完成回答后的重复收窄场景。

- 修复 section body、插件 mount 和 React root 之间把自动高度与横向 intrinsic width 混用的问题。
- 保持 section 宿主可收缩且有边界，避免完成回答、普通段落、复制按钮和 Composer 在窄侧栏右侧被裁切。
- 增加 Library 与 Reader 宿主样式契约回归测试。

## v1.0.0

Deepseek Copliot 1.0 focuses on making long-form reading conversations feel
continuous inside Zotero, especially when you are following an AI response in a
narrow Library or Reader sidebar.

### Smoother Reading Conversations

- Made streaming replies substantially smoother, reducing visible stutter while
  keeping status changes and new content responsive.
- Added a copy action to completed replies, so useful explanations, formulas,
  and summaries can be reused without selecting a whole message manually.
- Kept every paper and PDF conversation independent: switching documents brings
  back that document's own thread, while a new document starts cleanly.

### A Sidebar That Adapts To You

- Made the Reader and Library chat interface, message cards, and composer adapt
  to the width Zotero currently provides, including compact and very narrow
  sidebars.
- Fixed clipping during live resize and streaming. Long Chinese and English
  text now reflows in place; code, wide tables, and long formulas stay usable
  within their own bounded scrolling area instead of widening the whole pane.
- Fixed a restart and section-height issue that could leave only the
  `Deepseek Copliot` heading visible and make the conversation or input box
  unreachable.
- Improved formula recognition so ordinary parenthesized English explanations
  remain readable text rather than being mistakenly rendered as mathematical
  expressions.

### Clearer Answers And Longer Threads

- Refined the answer prompt for Zotero's vertical sidebar: comparisons now
  prefer grouped vertical lists or small tables of up to three columns, reducing
  crowded wide tables and unnecessary horizontal scrolling.
- Removed the manual context-budget setting. When a full paper fits, it stays
  available for the conversation; only when a thread approaches the model
  window is older dialogue condensed inside the same thread, while the paper
  and recent discussion remain in place.
- Reused recently read PDF text with bounded memory, so repeated questions can
  avoid needless extraction work and keep their paper context stable.

## v0.9.9

- Added bundled KaTeX rendering for inline and display formulas in chat messages.
- Added a fallback renderer for common model drift where short LaTeX formulas are emitted as bare parenthesized fragments such as `(A_X)`, `(\varepsilon_{\rm FG})`, and `(k_{\rm FG})`.
- Tightened the DeepSeek system prompt so generated answers prefer `$...$` for every inline formula, including formulas inside lists, tables, and parentheses.
- Exported verified dev and release XPI builds to the visible `build/xpi/` folder for Finder-based Zotero imports.

## v0.9.8

- Published one shared `Deepseek.Copliot-0.9.8.xpi` package for Zotero 7, 8, 9, and 10 instead of splitting compatibility by Zotero version.
- Widened the packaged Zotero manifest range to `7.0` through `10.*`.
- Recorded Zotero 10 beta packaged-smoke evidence for the Add-ons entry, Settings pane, Library pane, Reader pane, selection popup actions, and Reader context-menu actions.
- Added marketplace feed verification notes for confirming Zotero 7, 8, 9, and 10 visibility after the GitHub Release is public.

## v0.9.7

- Fixed the Reader text-selection popup so Deepseek Copliot action buttons inherit Zotero host theming instead of forcing a light button style in dark mode.
- Updated the popup label styling to inherit host text color, keeping the Reader selection UI readable across Zotero themes.

## v0.9.6

- Reworked `Commands and Prompts` into a card-based settings flow with clearer built-in vs. custom command editing.
- Expanded the sidebar home suggestions to 8 built-in actions in a compact two-column layout and kept built-in title overrides in sync.
- Updated the empty-state guidance so paper and PDF conversations surface shorter action labels and a clearer `/` shortcut hint.

## v0.9.5

- Unified the public plugin name to `Deepseek Copliot` across Zotero surfaces, release assets, and generated update feeds.
- Switched the packaged XPI artifact name to `Deepseek.Copliot-<version>.xpi`.
- Removed remaining public-facing `DS Copilot` branding from settings, reader actions, validation dialogs, and release documentation.

## v0.9.4

- Fixed the sidebar chat layout so the composer stays usable while recent chats now render below it instead of above it.
- Hid the empty-state welcome copy and suggested actions once a thread already has visible messages.
- Fixed Zotero host send reliability by preloading `paper` attachments more safely and adding a host-compatible provider request path.

## v0.9.3

- Added GitHub Actions release automation so future Zotero XPI releases publish consistently from version tags.
- Polished the GitHub landing page with install-first release badges and community launch copy.
- Prepared the scraper submission and forum launch materials for wider Zotero community discovery.

## v0.9.2

- Refined sidebar typography to inherit Zotero host sizing more naturally and kept Deepseek Copliot branding visible on plugin-owned icon surfaces.
- Fixed single-paper full-text delivery so `pdf` scope and eligible single-`paper` scope send the full PDF text instead of an internal page-window truncation.
- Added explicit user-facing errors when PDF full text is unavailable or the selected scope does not support full-text mode.
- Tightened `paper` scope rules to require exactly one PDF attachment; multi-PDF papers now block instead of guessing.
- Added provider diagnostics for system-prompt length, full-text length, and full-text source to support real Zotero smoke verification.
- Verified the packaged `0.9.2` XPI in a real Zotero profile, including a restart re-check against a live “last page” question.

## v0.9.0

- First public GitHub release of Deepseek Copliot.
