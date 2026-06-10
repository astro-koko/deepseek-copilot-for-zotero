# DeepSeek Copilot for Zotero

[![Release](https://img.shields.io/github/v/release/astro-koko/deepseek-copilot-for-zotero?display_name=tag&style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)
[![Zotero](https://img.shields.io/badge/Zotero-9%20stable-CC2936?style=flat-square)](https://www.zotero.org/)
[![Install XPI](https://img.shields.io/badge/Install-XPI-2ea44f?style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)

把 DeepSeek 对话能力直接放进 Zotero 的原生阅读工作流里。

`DeepSeek Copilot for Zotero` 面向“边读边问”的论文场景：你可以在文库里选中一篇论文后直接提问，在 PDF Reader 里选中文本后发起解释或追问，并按需开启联网查证，而不用在 Zotero、浏览器聊天页和临时笔记之间来回切换。

当前最新公开发布版本仍是 `v0.9.2`。下一波 GitHub-facing 发布会直接切到 `v0.9.3`，并补齐稳定的 XPI release 资产、社区收录和对外发布素材。

> 仓库对外名称使用 `DeepSeek Copilot for Zotero`。当前插件内部历史 ID 与部分界面文案仍保留 `DS Copilot`，在插件界面里看到这个名字是正常的，不影响安装和使用。

## v0.9.2 重点更新

- 单篇 `pdf` / 单篇 `paper` 的全文模式改为优先发送整篇 PDF 正文，而不是页窗截断
- 当全文不可用时，插件会明确报错，而不再静默降级成摘要回答
- 当前 `collection` 和 `manual-selection` 不支持全文模式，会明确提示用户切回单篇论文或当前 PDF
- 对“最后一页 / 附录结尾”类问题增加了文档末尾重点辅助片段
- `0.9.2` 已完成真实 Zotero 打包安装与冷重启 smoke，验证单篇 PDF 可以答到末页内容

## 你会在哪里用到它

- 在 `Library` 中选中文献后，插件会挂载在 Zotero 原生右侧栏
- 在 `PDF Reader` 中选中文本后，可以直接触发 `Explain` 和 `Ask...`
- 在 `Settings -> DS Copilot` 里完成 API Key、联网查证来源和连接验证

## 核心功能

- 原生集成到 Zotero 右侧栏，而不是单独开一个网页聊天窗口
- 同时支持 `Library` 和 `PDF Reader` 两个常用阅读入口
- 自动感知当前论文或 PDF 的上下文，减少重复复制粘贴
- 在 Reader 中选中文本后，可直接触发 `Explain` 和 `Ask...`
- 使用 DeepSeek API 进行论文问答、解释与追问
- 支持最近会话与本地线程持久化，方便回看上下文
- 可选开启联网查证；默认查证路径无需额外 API Key，也可切换到 Tavily

## 适合的使用场景

- 快速理解一篇新论文在讲什么
- 对一段公式、方法描述或实验结论做局部追问
- 在阅读 PDF 时直接解释选中文本，而不是跳到外部工具
- 对论文里的结论做一次联网查证，补充当前论文之外的公开信息

## 安装

如果你是普通使用者，最简单的安装方式是从 GitHub Releases 下载 `.xpi` 插件包。当前稳定版本为 `v0.9.2`。

1. 打开本仓库的 GitHub Releases 页面。
2. 下载最新的 `DS.Copilot-<version>.xpi`。
3. 在 Zotero 中打开 `工具 -> 插件`。
4. 点击右上角齿轮菜单，选择 `Install Add-on From File...`。
5. 选中下载好的 `.xpi` 文件并完成安装。
6. 重启 Zotero。

当前日常目标环境是 `Zotero 9 stable`。对公开发布而言，真正的验收标准是打包后的 `.xpi` 安装结果，而不是 `npm start` 的代理模式。

## 初次配置

1. 打开 `Settings -> DS Copilot`。
2. 填写你的 `DeepSeek API Key`。
3. 点击“验证连接”确认当前 key 可用。
4. 如果你需要联网查证，保留默认查证来源，或者切换为 `Tavily`。
5. 如果切换到 `Tavily`，继续填写 `Tavily API Key` 并验证。

相关入口：

- DeepSeek Platform: [platform.deepseek.com](https://platform.deepseek.com/)
- Tavily App: [app.tavily.com](https://app.tavily.com/)

## 使用方式

### 1. 在文库里直接对当前论文提问

1. 在 Zotero 文库中选中一篇论文或带 PDF 的条目。
2. 打开右侧 `DS Copilot` 面板。
3. 直接输入问题，例如“帮我总结这篇论文的核心贡献”。
4. 插件会带着当前条目的上下文向 DeepSeek 发起请求。

补充说明：

- `paper` 全文模式当前要求该论文只有一个 PDF 附件
- 如果一个条目下挂了多个 PDF，插件会明确提示你改用当前 Reader 里的 `pdf` 范围

### 2. 在 PDF Reader 中解释选中文本

1. 在 Zotero 中打开 PDF。
2. 在 Reader 里选中一段文字。
3. 使用弹出的 `Explain` 或 `Ask...` 入口。
4. 插件会把选中文本和当前 PDF 上下文一起带入侧栏对话。

### 3. 按需开启联网查证

1. 在设置页中确认你的查证来源。
2. 在提问时开启联网查证。
3. 让插件在当前论文上下文之外，再补充一层公开信息来源。

## 当前边界

- 当前保证的是单篇 `pdf` 和单篇 `paper` 的全文问答
- `collection` 和 `manual-selection` 目前不支持“整批全文拼接发送”
- 当模型上下文上限不够容纳整篇全文时，插件会直接提示你更换模型或缩小范围，而不是偷偷截断正文

## 隐私与数据边界

- `DeepSeek API Key` 和 `Tavily API Key` 只保存在本地 Zotero prefs。
- 对话历史只保存在本地 Zotero profile 的插件线程存储中。
- 当你发送问题时，相关问题文本和当前论文上下文会发送给 DeepSeek。
- 当你开启联网查证时，额外的查证请求会发送给当前选中的查证来源。
- 公开 release 资产不会打包你的 `.env`、开发 profile、数据库文件、浏览器 cookie 或测试聊天记录。

## 本地开发与打包

本仓库的开发与公开发布验收是两条不同路径：

- `npm start` 适合本地开发时快速热更新
- 打包发布前，应该始终以 `.xpi` 产物和真实安装结果为准

常用命令：

```bash
npm test
npm run build
npm run verify:xpi
```

补充说明：

- `.env` 和 `.scaffold/` 只用于本地开发与 smoke 测试，不属于公开 release 路径
- 开发与打包前请先看 [docs/zotero-dev-workbench.md](docs/zotero-dev-workbench.md)
- 公开 release smoke 请使用全新的 clean profile，不要预注入 `DEEPSEEK_API_KEY`、`TAVILY_API_KEY`，也不要复用旧线程数据库。细则见 [docs/zotero-dev-smoke-checklist.md](docs/zotero-dev-smoke-checklist.md)

## 仓库结构

- `addon/`: Zotero 插件静态资源、manifest、偏好设置界面
- `src/`: 主要业务逻辑、服务层、Reader 集成与前端界面
- `docs/`: 开发工作台、smoke checklist、设计与计划文档
- `scripts/`: 构建产物校验与辅助脚本
- `zotero-plugin.config.ts`: Zotero 插件构建与打包配置

## 项目说明

- README 主要介绍当前项目的整体能力与使用方式，不承担版本更新日志的职责。
- 如果你更关心发布与验收流程，请优先看 `docs/` 目录里的开发工作台与 smoke checklist。
