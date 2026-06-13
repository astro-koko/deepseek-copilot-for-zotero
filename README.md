# Deepseek Copliot

[![Release](https://img.shields.io/github/v/release/astro-koko/deepseek-copilot-for-zotero?display_name=tag&style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)
[![Zotero](https://img.shields.io/badge/Zotero-9%20stable-CC2936?style=flat-square)](https://www.zotero.org/)
[![Install XPI](https://img.shields.io/badge/Install-XPI-2ea44f?style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)

把 DeepSeek 对话能力直接放进 Zotero 的原生阅读工作流里。

`Deepseek Copliot` 面向“边读边问”的论文场景：你可以在文库里选中一篇论文后直接提问，在 PDF Reader 里选中文本后发起解释或追问，并按需开启联网查证，而不用在 Zotero、浏览器聊天页和临时笔记之间来回切换。

当前最新公开发布版本是 `v0.9.5`。这一版聚焦完成公开品牌统一：GitHub release 资产名、插件安装后显示名称、以及 Zotero 插件市场抓取所依赖的公开元数据，统一使用 `Deepseek Copliot`。

> 仓库地址保持 `astro-koko/deepseek-copilot-for-zotero` 不变，但所有面向用户的插件名称、下载包名称和公开安装指引都统一为 `Deepseek Copliot`。

## v0.9.5 重点更新

- 统一 Zotero 插件内显示名为 `Deepseek Copliot`
- 统一 GitHub release XPI 产物名为 `Deepseek.Copliot-<version>.xpi`
- 统一 release/update feed 生成链路所依赖的 addon name
- 清理 README、设置页、Reader 操作入口、验证弹窗等公开文案中的旧名称

## 你会在哪里用到它

- 在 `Library` 中选中文献后，插件会挂载在 Zotero 原生右侧栏
- 在 `PDF Reader` 中选中文本后，可以直接触发 `Explain` 和 `Ask...`
- 在 `Settings -> Deepseek Copliot` 里完成 API Key、联网查证来源和连接验证

## 核心功能

- 原生集成到 Zotero 右侧栏，而不是单独开一个网页聊天窗口
- 同时支持 `Library` 和 `PDF Reader` 两个常用阅读入口
- 自动感知当前论文或 PDF 的上下文，减少重复复制粘贴
- 在 Reader 中选中文本后，可直接触发 `Explain` 和 `Ask...`
- 使用 DeepSeek API 进行论文问答、解释与追问
- 支持最近会话与本地线程持久化，方便回看上下文
- 可选开启联网查证；默认查证路径无需额外 API Key，也可切换到 Tavily

## 安装

如果你是普通使用者，最简单的安装方式是从 GitHub Releases 下载 `.xpi` 插件包。当前稳定版本为 `v0.9.5`。

1. 打开本仓库的 GitHub Releases 页面。
2. 下载最新的 `Deepseek.Copliot-<version>.xpi`。
3. 在 Zotero 中打开 `工具 -> 插件`。
4. 点击右上角齿轮菜单，选择 `Install Add-on From File...`。
5. 选中下载好的 `.xpi` 文件并完成安装。
6. 重启 Zotero。

## 初次配置

1. 打开 `Settings -> Deepseek Copliot`。
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
2. 打开右侧 `Deepseek Copliot` 面板。
3. 直接输入问题，例如“帮我总结这篇论文的核心贡献”。
4. 插件会带着当前条目的上下文向 DeepSeek 发起请求。

### 2. 在 PDF Reader 中解释选中文本

1. 在 Zotero 中打开 PDF。
2. 在 Reader 里选中一段文字。
3. 使用弹出的 `Explain` 或 `Ask...` 入口。
4. 插件会把选中文本和当前 PDF 上下文一起带入侧栏对话。

### 3. 按需开启联网查证

1. 在设置页中确认你的查证来源。
2. 在提问时开启联网查证。
3. 让插件在当前论文上下文之外，再补充一层公开信息来源。

## 隐私与数据边界

- `DeepSeek API Key` 和 `Tavily API Key` 只保存在本地 Zotero prefs。
- 对话历史只保存在本地 Zotero profile 的插件线程存储中。
- 当你发送问题时，相关问题文本和当前论文上下文会发送给 DeepSeek。
- 当你开启联网查证时，额外的查证请求会发送给当前选中的查证来源。
- 公开 release 资产不会打包你的 `.env`、开发 profile、数据库文件、浏览器 cookie 或测试聊天记录。

## 本地开发与打包

常用命令：

```bash
npm test
npm run build
npm run verify:xpi
```

公开发布前，应该始终以 `.xpi` 产物和真实安装结果为准。
