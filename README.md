# 浏览器实用脚本

为 [ChatGPT](https://chatgpt.com/) 和 [X / Twitter](https://x.com/) 调整阅读布局、字体和界面。需要先安装 [Tampermonkey 扩展](https://www.tampermonkey.net/)。

[快速安装](#快速安装) · [常用操作](#常用操作) · [文件直达](#文件直达) · [更新记录](https://github.com/hmxxgit/browser_javascript_backup/commits/main/) · [反馈问题](https://github.com/hmxxgit/browser_javascript_backup/issues)

## 快速安装

| 脚本 | 主要功能 | 安装 / 更新 | 源码 |
| --- | --- | --- | --- |
| ChatGPT Custom UI | 加宽正文、调整字体颜色；自动隐藏输入框；代码换行控制、算法图适应屏幕 | [一键安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/chatgpt-custom-ui.user.js) | [查看脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/chatgpt-custom-ui.user.js) |
| X Custom UI | 加宽时间线、调整字体和照片高度；隐藏右栏、Grok、Premium；配置备份 | [一键安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/x-custom-ui.user.js) | [查看脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/x-custom-ui.user.js) |

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)，点击上表的 **一键安装**。
2. 在扩展页面点击 **安装**；已有脚本则点击 **更新**。
3. 打开或刷新 [ChatGPT](https://chatgpt.com/) / [X](https://x.com/)，开始使用。

**点击后只看到代码？** 复制对应脚本的完整源码，在 Tampermonkey 中选择“添加新脚本”，替换默认内容并保存。缺少运行权限时，按扩展提示开启“允许用户脚本”，参见 [官方说明](https://www.tampermonkey.net/faq.php#Q209)。

## 常用操作

| 想做什么 | ChatGPT | X / Twitter |
| --- | --- | --- |
| 打开设置 | Tampermonkey → **自定义配置** | 右下角 **X UI ⚙**，或 Tampermonkey → **自定义配置** |
| 应用设置 | **保存并刷新** | **保存并应用**，立即生效 |
| 备份配置 | 设置面板 → **复制配置** / **下载配置** | 设置面板 → **配置导入 / 导出（JSON）** → 导出并复制保存 |
| 恢复默认 | 设置面板 → **恢复默认** | 设置面板 → **恢复默认** → **保存并应用** |
| 更新脚本 | 点击上表安装链接更新，或在 Tampermonkey 检查更新；完成后刷新网站 | 同左 |
| 恢复网站原界面 | 在 Tampermonkey 停用脚本，再刷新页面 | 关闭设置面板的 **启用界面调整** 并保存 |

**ChatGPT 使用要点**

- 点击正文隐藏输入框，鼠标靠近页面底部显示。
- 代码块右上角按钮切换自动换行；关闭后，长行可横向滚动。源码本身的换行和缩进始终保留。
- SVG 算法图随屏幕高度缩放，完整保留比例，为图例和演示按钮留出空间。
- 自定义颜色需要在设置中勾选“启用”。

**X 使用要点**

- 正文加宽仅在视口至少 1000px 时生效，小屏幕保留原布局。
- 照片高度设为 `0` 表示不限制；不影响视频和全屏照片查看器。
- 文字颜色支持 `#RGB` / `#RRGGBB`，留空使用网站原色。
- 导入配置后还需 **保存并应用**；更新脚本保留已保存配置。

**未生效或布局异常？** 先刷新页面，确认脚本已启用；同一网站只保留一个同类布局脚本。仍有问题，可 [提交反馈](https://github.com/hmxxgit/browser_javascript_backup/issues/new)，附上浏览器、脚本版本和截图。

## 文件直达

| 文件 | 用途 |
| --- | --- |
| [ChatGPT 脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/chatgpt-custom-ui.user.js) | 查看完整源码、默认配置与版本 |
| [ChatGPT 维护说明](docs/chatgpt-custom-ui.md) | 模块边界、性能约束、回归与发布流程 |
| [X 脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/x-custom-ui.user.js) | 查看完整源码、默认配置与版本 |
| [依赖与测试命令](https://github.com/hmxxgit/browser_javascript_backup/blob/main/package.json) | 安装开发依赖、运行全部测试 |
| [ChatGPT 代码块测试](https://github.com/hmxxgit/browser_javascript_backup/blob/main/tests/chatgpt-code-layout.test.cjs) | 换行按钮、横向滚动、源码保留 |
| [ChatGPT 图表测试](https://github.com/hmxxgit/browser_javascript_backup/blob/main/tests/chatgpt-diagram-layout.test.cjs) | 屏幕适配、动态更新、媒体范围 |
| [X 界面测试](https://github.com/hmxxgit/browser_javascript_backup/blob/main/tests/x-custom-ui.test.cjs) | 配置保存、布局、交互与移动端 |
| [MIT 许可证](https://github.com/hmxxgit/browser_javascript_backup/blob/main/LICENSE) | 使用、修改与分发条款 |

<details>
<summary>开发与验证</summary>

```sh
npm ci
npm test
node --check chatgpt-custom-ui.user.js
node --check x-custom-ui.user.js
```

本地测试默认使用 Microsoft Edge，CI 使用 Playwright 自带 Chromium；测试只加载离线页面样例，不访问真实账号。也可用 `X_UI_BROWSER=chrome npm test` 指定本机 Chrome。

X 界面精简思路参考 [Minimal Twitter](https://github.com/typefully/minimal-twitter) 和 [Control Panel for Twitter](https://github.com/insin/control-panel-for-twitter)；脚本独立实现，不引入外部运行时。

</details>
