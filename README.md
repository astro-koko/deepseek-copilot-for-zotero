# Deepseek Copliot

[![Release](https://img.shields.io/github/v/release/astro-koko/deepseek-copilot-for-zotero?display_name=tag&style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)
[![Zotero](https://img.shields.io/badge/Zotero-9%20stable-CC2936?style=flat-square)](https://www.zotero.org/)
[![Install XPI](https://img.shields.io/badge/Install-XPI-2ea44f?style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)

`Deepseek Copliot` 是一个给 Zotero 用的 AI 阅读插件。

它的作用很简单：当你在 Zotero 里选中一篇论文，或者在阅读器里打开一个 PDF 时，插件会自动读取当前论文的上下文，让你直接提问、总结、解释和追问，不需要再把论文内容手动复制到别的聊天工具里。

如果你只是想知道它能做什么，可以把它理解成：

- 在 Zotero 里直接和当前论文对话
- 打开 PDF 后自动加载当前论文内容
- 需要时还能顺手做联网查证

## 插件市场安装

插件已经上线 Zotero 插件市场。

如果你想用最简单的方式安装：

1. 打开 Zotero 插件市场。
2. 搜索 `Deepseek Copliot`。
3. 找到插件后直接下载安装。

如果你不想走插件市场，也可以去 GitHub Releases 下载最新版 `.xpi` 手动安装。

## 它适合谁

如果你经常在 Zotero 里做这些事情，这个插件会比较有用：

- 读论文时想快速问一句“这篇文章在讲什么”
- 打开 PDF 后想直接总结、解释、追问
- 想围绕整篇 PDF 连续追问，而不是只看某一小段
- 不想在 Zotero 和浏览器聊天工具之间来回切换

## 它是怎么工作的

`Deepseek Copliot` 会跟着你当前正在看的论文走。

- 在 `Library` 里选中一篇论文后，右侧面板会自动绑定当前论文上下文
- 在 `PDF Reader` 里打开论文后，右侧面板会自动加载当前 PDF 的阅读上下文

这意味着你不需要先复制摘要、复制段落、整理问题，再粘贴到外部网页。很多时候，打开论文后就可以直接开始问。

当前版本更适合围绕整篇论文或当前 PDF 进行提问与辅助阅读。选中文本触发入口目前不作为稳定能力对外承诺，README 也不再把它作为主要卖点。

## 你可以怎么用

### 1. 在文库里直接提问

1. 在 Zotero 文库中选中一篇论文。
2. 打开右侧 `Deepseek Copliot` 面板。
3. 直接输入问题。

比如：

- 这篇论文的核心贡献是什么？
- 它和我现在看的另一篇文章有什么区别？
- 这篇文章的数据和方法可靠吗？

### 2. 在阅读器里自动加载当前 PDF 后开始辅助阅读

1. 在 Zotero 里打开一篇 PDF。
2. 右侧 `Deepseek Copliot` 面板会自动关联当前 PDF。
3. 你可以直接让它总结、解释、定位结论，或者继续追问。

这里最重要的一点是：不用手动复制论文内容。 
进入阅读界面后，插件就会埻念当前 PDF 来辅助阅读。
当前版本更适合围绕摸⩏ 整篇论文或当前 PDF 进行提问与辅助阅读：选中文本袛触发入口前時不作为稳定能力对外承诺，README 也不再把它作为主要卖点。

### 3. 开启联网查证

如果你希望宍不只看当前论文，也饺须看看外部公开信息，可以开启联网查证。
适合的情况比如：

- 想确认某个结论是否和别的工作一致
- 想快速补充背景信息
- 想看看当前论文之外的公开资料

## 安装方式二：从 GitHub 手动安装

如果你更习惯手动安装，也可以这样做：

1. 打开本仓库的 GitHub Releases 页面。
2. 下载最新的 `Deepseek.Copliot-<version>.xpi`。
3. 在 Zotero 中打开 `工具 -> 插件`。
4. 点击右上角齿轮菜单，选择 `Install Add-on From File...`。
5. 选中下载好的 `.xpi` 文件并完成安装。
6. 重启 Zotero。

当前稳定版本是 `v0.9.5`。

## 第一次使用前要做什么

安装完成后，先做一次简单配置：

1. 打开 `Settings -> Deepseek Copliot`。
2. 填写你的 `DeepSeek API Key`。
3. 点击“验证连接”确认可以正常使用。
4. 如果你需要联网查证，可以保留默认查证来源，或者切换到 `Tavily`。
5. 如果切换到 `Tavily`，继续填写 `Tavily API Key` 并验证。

相关入口：

- DeepSeek Platform: [platform.deepseek.com](https://platform.deepseek.com/)
- Tavily App: [app.tavily.com](https://app.tavily.com/)

## 这个插件的特点

- 直接工作在 Zotero 里，不用跳去单独网页
- 支持 `Library` 和 `PDF Reader` 两种常用场景
- 会自动感知当前论文或当前 PDF 的上下文
- 打开阅读器后就能围绕当前论文开始提问
- 支持最近会话和本地历史保存
- 支持按需开启联网查证

## 隐私说明

- `DeepSeek API Key` 和 `Tavily API Key` 只保存在本地 Zotero 设置中
- 对话历史只保存在本地 Zotero profile 的插件线程存储中
- 当你发送问题时，相关问题文本和当前论文上下文会发送给 DeepSeek
- 当你开启联网查证时，额外的查证请求会发送给当前选中的查证来源

## 最新版本

当前最新公开版本是 `v0.9.5`。

这一版主要完成了两件事：

- 统一公开名称为 `Deepseek Copliot`
- 统一 GitHub release、安装包名称和插件市场展示名称

## 开发与打包

如果你是开发者，可以使用这些命令：

```bash
npm test
npm run build
npm run verify:xpi
```

仓库地址保持 `astro-koko/deepseek-copilot-for-zotero` 不变，但所有面向用户的插件名称、下载包名称和公开安装指引都统一为 `Deepseek Copliot`。