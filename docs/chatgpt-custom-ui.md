# ChatGPT Custom UI 维护说明

## 发布源

- 主仓库：`hmxxgit/browser_javascript_backup`
- 分发文件：`chatgpt-custom-ui.user.js`
- `@updateURL` 与 `@downloadURL` 必须始终指向主仓库的 raw 文件。
- 为兼容从旧 gist 安装的脚本，`@name` 与 `@namespace` 作为用户脚本身份保持稳定；
  发布源统一不等于更换这两个身份字段。
- gist 只作为兼容镜像，不应成为独立开发分支；发布后需同步同一脚本版本。

## 模块边界

脚本保持单文件分发，内部按职责分为：

1. 用户配置与排版样式。
2. 共享的鼠标、DOM 变化和路由观察器。
3. composer 自动隐藏、页脚清理与免责声明处理。
4. 会话滚动容器和双向滚动箭头。
5. 顶栏 Share/More 控件的悬停显示。
6. 鼠标静止自动隐藏。

共享观察器必须保持轻量。流式回答会高频改变 DOM，因此不要在普通 mutation
路径中执行全页 `querySelectorAll`、`getComputedStyle` 或
`getBoundingClientRect`。缓存仍有效时应走快速路径；重新探测只发生在路由变化、
节点断开或 mutation 明确加入候选节点时。

## Composer 约束

- 首页 composer 常显；具体会话页允许自动隐藏。
- 隐藏态同时使用视觉样式和 `inert`，避免键盘焦点进入不可见控件。
- 点击 composer、其 dock 空白区以及挂到 `body` 的 dialog/menu/listbox portal
  不应隐藏 composer。
- 点击正文隐藏后，鼠标必须先离开底部触发区，再进入触发区才能重新显示。
- 不直接删除 React 管理的页脚节点，只通过样式隐藏。

## 滚动箭头约束

- 只响应会话滚动容器内的 wheel/scroll/keyboard 事件。
- 侧边栏或其它独立滚动区域不得改变箭头方向或可见性。
- 替换缓存按钮前必须清理旧节点的属性、CSS 变量和状态类。
- 使用独立的 `translate` 属性移动按钮，保留原生 `transform`。

## 免责声明约束

- 只匹配完整的已知提示文案。
- 跳过 `[data-message-author-role]`、`article` 与 `[data-turn-key]` 消息正文。
- 保护 button、input、textarea、contenteditable、SVG 等控件。
- 隐藏而不删除节点，避免破坏 React 的节点所有权。

## 验证与发布

每次修改至少运行：

```bash
node --check chatgpt-custom-ui.user.js
npm test
```

GitHub Actions 会在 push 和 pull request 上重复执行语法检查及自动化测试。发布时：

1. 提升 userscript 的 `@version`。
2. 提交主仓库并推送 `main`。
3. 确认 CI 通过。
4. 将主仓库中的同一版本脚本同步到 gist 兼容镜像。
