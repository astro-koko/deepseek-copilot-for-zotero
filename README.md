# Deepseek Copliot

[![Release](https://img.shields.io/github/v/release/astro-koko/deepseek-copilot-for-zotero?display_name=tag&style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases)
[![Zotero](https://img.shields.io/badge/Zotero-9%20stable-CC2936?style=flat-square)](https://www.zotero.org/)

`Deepseek Copliot` 是一个给 Zotero 用的 AI 论文阅读插件。

你在 Zotero 里选中一篇论文，或者在阅读器里打开 PDF 后，插件会自动关联当前论文内容，让你直接提问、总结、解释和追问，不需要再把论文复制到别的聊天工具里。

## 插件市场安装

插件已经上线 Zotero 插件市场，搜索 `Deepseek Copliot` 就可以直接下载安装。

## 它能做什么

- 围绕当前论文直接提问、总结、解释和追问
- 打开 PDF 后自动加载当前 PDF 的阅读上下文
- 更适合快速读懂论文主旨、方法、结论和细节
- 需要时可以开启联网查证

## 怎么用

1. 在 Zotero 文库中选中一篇论文，或者直接打开一篇 PDF。
2. 打开右侧 `Deepseek Copliot` 面板。
3. 直接输入问题。

你可以这样问：

- “帮我总结这篇论文”
- “这篇论文的方法核心是什么？”
- “这篇论文的结论和局限有哪些？”

## 当前版本说明

当前版本更适合围绕整篇论文或当前 PDF 进行提问与辅助阅读。
选中文本触发入口目前不作为稳定能力对外承诺。

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

当前稳定版本是 `v0.9.5`。
