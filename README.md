# 浏览器 JavaScript 脚本

使用 Tampermonkey 为网页添加个人定制功能。

## 安装

1. 打开 [Tampermonkey 官网](https://www.tampermonkey.net/)，选择浏览器并安装扩展。
2. 点击下表的 **直接安装**，在 Tampermonkey 页面点击 **安装**。
3. 打开或刷新对应网站，确认脚本已启用。

如果扩展提示缺少运行权限，按其提示开启“允许用户脚本”；详见 [官方说明](https://www.tampermonkey.net/faq.php#Q209)。

## 脚本

| 脚本 | 用途 | 源码 | 安装 |
| --- | --- | --- | --- |
| ChatGPT Custom UI | 调整 ChatGPT 的页面宽度、字体和颜色；点击正文隐藏输入框、鼠标靠近底部显示；提供滚动箭头、右上角按钮悬停显示和鼠标静止隐藏。 | [查看源码](https://github.com/hmxxgit/browser_javascript_backup/blob/main/chatgpt-custom-ui.user.js) | [直接安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/chatgpt-custom-ui.user.js) |

| X Custom UI | 调整 X / Twitter 的内容宽度、字体、颜色与照片高度；可隐藏右栏、Grok、Premium 等入口，并提供用户配置面板。 | [查看源码](https://github.com/hmxxgit/browser_javascript_backup/blob/main/x-custom-ui.user.js) | [直接安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/x-custom-ui.user.js) |

**手动安装：** 查看源码并复制，在 Tampermonkey 中“添加新脚本”，替换默认内容后保存。

## 使用与更新

- **修改配置：** 在 ChatGPT 页面点击 Tampermonkey 图标 → “自定义配置” → 修改设置 → “保存并刷新”。颜色需要勾选“启用”。
- **获取更新：** 在 Tampermonkey 管理面板检查脚本更新，新版从本仓库获取。

## X Custom UI

在 X 页面点击 **Tampermonkey → 自定义配置**，或者右下角 **X UI ⚙**，调整后点击 **保存并应用**，无需刷新。默认正文 19px、行高 1.6、桌面内容宽度 900px，隐藏右栏、Grok 和 Premium，保留 X 原有配色。

- 宽度调整在视口至少 1000px 时生效，小屏幕保留 X 原生布局。桌面导航固定宽度，内容紧接导航排列，避免 X 的弹性左栏制造大块空白；时间线内部的 600px 限制也会解除，推文卡片与正文随主栏宽度展开。
- 正文和链接颜色支持 `#RGB` / `#RRGGBB`，留空跟随 X。
- 照片高度设为 `0` 表示不限制；只作用于主栏推文照片，不改视频和全屏照片查看器。
- 操作栏悬停显示为可选项；键盘聚焦也会显示，触屏保持可见。
- **恢复默认**只填入表单，保存后才生效。**关闭总开关**恢复 X 原始样式；即使隐藏配置按钮，油猴菜单仍可打开面板。
- **配置导入 / 导出**使用 JSON 文本，可手动复制备份。配置保存在油猴脚本存储中，更新脚本不会覆盖已保存配置。
- 建议同一页面只启用一个 X 布局脚本，避免宽度、隐藏规则相互覆盖。

### 参考项目

参考 [Minimal Twitter](https://github.com/typefully/minimal-twitter) 的阅读布局与界面精简思路，以及 [Control Panel for Twitter](https://github.com/insin/control-panel-for-twitter) 使用语义选择器精简导航的方式。此脚本独立实现，未引入第三方运行时或外部请求。

### 开发与验证

```sh
npm ci
npm test
node --check x-custom-ui.user.js
```

自动化测试使用 Playwright 和已安装的 Microsoft Edge（默认 `msedge`），在离线 X DOM 样例上验证配置持久化、SPA 动态节点、非法输入、存储失败、恢复默认、媒体范围、悬停/键盘操作及移动端面板。也可设置 `X_UI_BROWSER=chrome` 使用已安装的 Chrome。测试不会访问真实账号。

已在真实 Edge + Tampermonkey + X 页面检查配置入口与应用效果。X 会修改页面结构和属性，后续若某项失效，需要更新对应选择器；本脚本不包含推文内容过滤或广告识别。
