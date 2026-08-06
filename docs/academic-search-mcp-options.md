# 学术检索与 MCP 选型（1.0.0 准备）

日期：2026-08-01  
范围：只作产品与技术选型；本文件不改变 1.0.0 的代码、依赖、XPI 或用户设置。

## 结论

正式版**不应内置运行社区维护的 MCP server**，也不应把“通用 MCP 客户端”作为 1.0.0 的发布条件。推荐的两项免费学术检索能力是：

1. **OpenAlex 官方 REST API（主检索）**：插件已经直接调用它；应将当前无 Key 调用升级为用户自填的免费 Key、额度感知和最小化查询。
2. **arXiv 官方 API（预印本补充）**：适合物理、数学、计算机等领域；以严格队列与缓存方式补充 OpenAlex，而非替代它。

这样仍能给用户“学术检索”能力，却避免在 Zotero 内启动 Python/Node 子进程、引入不受产品控制的包供应链，或让一次搜索同时把数据交给多个中间服务。MCP 适合作为后续明确标注的「实验性、自带服务端（BYO MCP）」能力，而不是 1.0.0 默认路径。

## 当前实现与发布前事实

`src/services/evidenceSearch.ts` 现在直接请求 `https://api.openalex.org/works`；设置中的 `mcp-web-search` 只是历史名称，并没有实际连接 MCP。这一实现应继续保持“官方 API 直连”的边界。

OpenAlex 最新开发者文档说明，API Key 可免费申请；带 Key 的每日免费额度为 1,000 次全文检索或 10,000 次 list/filter（混合使用按额度计），超过后才收费。无 Key 只有一成的免费额度；响应会提供额度头部，超限或超过 100 RPS 会得到 `429`。因此 1.0.0 应至少补上「可选但推荐的免费 Key、只取 5–10 条、`select=` 精简字段、429 指数退避与可见错误」，不能假设无 Key 永远可用。[OpenAlex 认证与定价](https://developers.openalex.org/api-reference/authentication) [OpenAlex 搜索指南](https://developers.openalex.org/guides/searching)

## 推荐的两个 Provider

| Provider | 用户价值与接入形式 | 免费/认证与限额 | 隐私与产品约束 |
| --- | --- | --- | --- |
| **OpenAlex（主）** | 广覆盖论文、作者、机构、期刊、引用元数据；保留现有 REST adapter，不加 MCP 包装。 | 免费 Key；每日约 1,000 次全文检索或 10,000 次 filter，单例 DOI 查询免费；`429` 后退避。 | Key 会关联时间、端点、错误、性能、IP/UA 等技术元数据；官方称不出售 Key 使用数据。默认只发 DOI、题名或用户明确输入的检索词。[隐私政策](https://openalex.org/OpenAlex_privacy_policy.pdf) |
| **arXiv（补充）** | 预印本发现与直达 arXiv 摘要页/PDF，特别适合物理、数学、CS；另写小型 REST/Atom adapter。 | 官方 legacy API 无 Key；所有受控机器合计**每 3 秒最多 1 次、单连接**。每个查询缓存至少一天，结果最多 10 条，绝不并发连发。 | GET 查询会进入 URL；arXiv 记录浏览者 IP、访问路径和浏览器信息。只发送规范化关键词/题名，不传 PDF、笔记、选中文本或对话历史。[API 条款](https://info.arxiv.org/help/api/tou.html) [API 手册](https://info.arxiv.org/help/api/user-manual.html) [隐私政策](https://info.arxiv.org/help/policies/privacy_policy.html) |

## MCP 候选审计：不作为 1.0.0 内置依赖

- **Ai2 Asta Scientific Corpus Tool MCP** 是本次查到的较成熟的第一方学术 MCP：Streamable HTTP、Tool Key、论文/引文/片段检索工具齐全。[官方 MCP 文档](https://allenai.org/asta/resources/mcp) 但其许可证只允许“学术、非商业研究和基准测试”，并明确禁止用于开发或改进商业产品；Ai2 还能为维护和改进使用输入与输出。因此它不适合当前公开插件的内置默认能力，除非先取得 Ai2 的书面扩展授权。[许可证](https://allenai.org/asta-corpus-license/2025-08-26)
- **openags/paper-search-mcp** 是较活跃的社区多源 MCP（arXiv、OpenAlex、Semantic Scholar 等），有测试与 MIT 许可证，但其文档同时包含 Google Scholar 代理、可选 Sci-Hub、多个 API Key 与本地 Python/容器启动路径。这些宽权限/多来源行为不适合直接打进 Zotero 正式版；如未来实验，应固定版本、禁用下载/代理/Sci-Hub 工具、单独安全审计并由用户显式安装。[项目 README](https://github.com/openags/paper-search-mcp)

Semantic Scholar 官方 Academic Graph API 可作为未来对比源而非当前推荐：多数端点可匿名使用，部分端点需要 Key；匿名池的官方标称上限为共享 1,000 RPS，但可能额外节流，Key 的初始上限反而是 1 RPS。更重要的是，其 API 条款允许 Ai2 为提供和改进服务使用调用时传输的数据，并要求公开展示作归属处理；不宜把来自 Zotero 的长选中文本默认发给它。[API 概览](https://www.semanticscholar.org/product/api) [API 许可](https://www.semanticscholar.org/product/api/license)

## 建议的后续节奏

1. **1.0.0**：只发布已验证的核心阅读体验；不再扩大 MCP 范围。
2. **1.0.1，小范围测试**：将 OpenAlex 的免费 Key/用量状态与隐私提示补齐；每次查证仅发送 DOI、题名或用户输入的关键词。
3. **1.1 测试版**：加入 arXiv adapter、3 秒全局节流、24 小时查询缓存、来源徽章和“在浏览器打开/导入 Zotero”动作。每个 Provider 单独开关，默认关闭外部学术检索。
4. **实验性 MCP（以后）**：仅支持只读、固定版本、最少工具集的 BYO MCP；首次连接前展示完整命令、目标域名和将发送的数据。MCP 官方规范要求在把用户数据暴露给服务器、以及调用工具前取得明确同意；本项目应把该要求做成产品交互，而不是隐藏配置。[MCP 规范的隐私与工具安全要求](https://modelcontextprotocol.io/specification/2025-03-26/index) [本地 MCP 风险与同意要求](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)

所有后续 provider 都必须：不发送整篇 PDF、Zotero 笔记、聊天历史或其他 API Key；按请求显示来源；带来源链接和时间；将“检索结果”与模型推断明确分开；错误时可回退且不阻塞 Zotero 主界面。
