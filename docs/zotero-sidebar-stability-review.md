# Zotero AI Assistant 稳定性 Review 与 Smoke 清单

配套开发方法请先看 [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)，文档入口索引见 [docs/zotero-doc-index.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-doc-index.md)。

## 当前执行目标

当前执行目标是宿主前端优先稳定化，不是继续扩展通用产品能力。

## 本轮目标

本轮先验收宿主前端闭环，再谈 provider 质量和发布工程。

当前要先站稳五件事：

1. 插件能正常构建并安装
2. `Settings` 可见、可编辑、可保存、重开后仍正确
3. 原生右侧栏能在 `Library` 稳定显示
4. 原生右侧栏能在 `PDF Reader` 稳定显示
5. `Explain / Ask...` handoff 到侧栏的行为稳定

真实模型往返可以暂时降级，但不能用 provider 问题解释 surface 缺失。

## 自动化验收

### 构建信号

- 执行 `npm run check`
- 或最少执行 `npm run smoke:xpi`
- 预期产物：`.scaffold/build/Deepseek Copliot-0.1.0.xpi`
- 若构建失败，本轮直接不通过

### 测试信号

- 执行 `npm test`
- 预期只运行当前项目 `src/**` 下测试
- `reference/**`、`.scaffold/**` 不得进入默认测试面

### 验收总原则

- `npm start` 只用于快速迭代，不作为最终验收。
- 只有把构建出的 `.xpi` 通过 Zotero 插件管理器导入成功，才算真实通过。
- 需要宿主级调试时，使用 `ZOTERO_DEBUGGER=1 npm start` 打开 `-ZoteroDebugText` 与 `-jsdebugger`。
- 当前日常 profile 是正式宿主验收环境；干净 profile 只能做对照。
- 如果 `.xpi` 导入后 Add-ons 列表里没有 `Deepseek Copliot`，立即停止，先只排查启动和安装链路。
- 如果 Add-ons 里有插件但 Settings 缺失，先排查 prefs 注册与 pane 初始化。
- 如果 Add-ons 里有插件但侧栏缺失，先排查注册、native host 接管与挂载，不要提前改 DeepSeek/provider 逻辑。
- 不接受“按钮在”“section 在”作为通过信号；必须是右栏肉眼可见正确，且 DOM 状态与可见性一致。

### 当前固定取证点

每次宿主级调试固定记录以下运行时事实：

- `Zotero_Tabs.selectedType / selectedID`
- `#zotero-item-pane` 与 `#zotero-context-pane` 的直接子节点列表
- `ai-assistant-pane-library-mount / reader-mount` 的数量、parent、display、尺寸
- 原生右栏内容是否真的被隐藏

### 当前必须覆盖的稳定性点

- `Settings` pane load 幂等，且值可持久化
- `library` / `reader` tabType 下启用 section
- 非目标 tabType 下禁用 section
- 同一 surface 的 host 可复用，不重复 remount
- `library` 与 `reader` 各自维护独立 host
- 高层状态缺失时能渲染 fallback host，而不是直接空白
- 打开 Deepseek Copliot 时原生右栏正文真的被隐藏，关闭时完整恢复
- `Explain` 自动发送，`Ask...` 只预填不发送
- 多窗口 scope 事件能广播到每个已注册窗口
- 共享资源注册可重复 acquire/release，且释放对称

## 手工 Smoke 步骤

### 安装

1. 运行 `npm run build`
2. 运行 `npm run verify:xpi`
3. 在 Zotero 中安装 `.scaffold/build/Deepseek Copliot-0.1.0.xpi`
4. 确认 Zotero 没有报出插件加载错误，且 Add-ons 列表中出现 `Deepseek Copliot`

### 首次启动

1. 打开 Zotero 主界面
2. 打开 Zotero 设置并确认 `Deepseek Copliot` pane 可正常打开
3. 观察右侧原生侧栏中是否出现 Deepseek Copliot UI
4. 预期最少能看到稳定壳子：
   - 标题
   - scope 区域或空状态
   - 线程区占位
   - 输入区占位

### Reader 场景

1. 打开任意 PDF
2. 切到 PDF Reader
3. 确认右侧原生侧栏也出现同一插件 UI
4. 预期不会出现空白 panel、重复 panel、随机消失或切换后丢 host

### Handoff 场景

1. 在 Reader 中选中一段文本
2. 触发 `Explain`
3. 再触发一次 `Ask...`
4. 预期：
   - `Explain` 会打开侧栏并进入发送流程
   - `Ask...` 会打开侧栏并只预填草稿
   - handoff 后输入框与线程区仍可交互

### 切换场景

1. 在 `Library`、`Collection`、`Item`、`PDF Reader` 之间来回切换
2. 预期 section 只在 `library` / `reader` 下启用
3. 预期同一窗口中不会越切越多，不会残留旧 host

### 重启场景

1. 完全退出 Zotero
2. 重新打开 Zotero
3. 重复 `Settings`、`Library`、`Reader`、`Handoff` 检查
4. 预期插件无需额外操作即可重新显示并保持交互

### 插件冲突最小隔离顺序

只在右栏 surface 或 Reader UI 冲突怀疑成立时进行最小隔离：

1. `Zotero Pdf2zh`
2. `RosettaPDF`
3. `Ethereal Style`
4. 其他会修改右栏或 Reader UI 的已启用插件

## 阻塞项

出现下列任一情况，本轮视为不通过：

- `npm test` 仍会跑到 `reference/**`
- `npm run build` 不能稳定产出 `.xpi`
- `npm run verify:xpi` 发现打包产物缺失
- `.xpi` 导入后 Add-ons 列表里没有 `Deepseek Copliot`
- `Settings` pane 缺失、空白或不保存
- `Library` 或 `Reader` 任一侧不显示 section
- 切换 tab 后 section 空白、消失或重复挂载
- `Explain` / `Ask...` handoff 与预期不符
- 重启 Zotero 后 section 不再出现
- 某个可选子系统异常导致整个插件不加载
- 多窗口下 scope 更新只在首个窗口生效

## 下一轮才能处理的事项

以下问题记录即可，不作为本轮阻塞：

- provider 质量调优、RAG、embedding、联网检索
- 更复杂的会话管理
- Beaver 风格 richer UI 行为
