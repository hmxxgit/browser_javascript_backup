# 浏览器实用脚本

为 [ChatGPT](https://chatgpt.com/) 和 [X / Twitter](https://x.com/) 调整阅读布局、字体和界面，并为 [YouTube](https://www.youtube.com/) 新视频自动选择默认清晰度。需要先安装 [Tampermonkey 扩展](https://www.tampermonkey.net/)。

[快速安装](#快速安装) · [常用操作](#常用操作) · [文件直达](#文件直达) · [更新记录](https://github.com/hmxxgit/browser_javascript_backup/commits/main/) · [反馈问题](https://github.com/hmxxgit/browser_javascript_backup/issues)

## 快速安装

| 脚本 | 主要功能 | 安装 / 更新 | 源码 |
| --- | --- | --- | --- |
| ChatGPT Custom UI | 加宽正文、调整字体颜色；自动隐藏输入框；代码换行控制、算法图适应屏幕 | [一键安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/chatgpt-custom-ui.user.js) | [查看脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/chatgpt-custom-ui.user.js) |
| X Custom UI | 加宽时间线、调整字体和照片高度；隐藏右栏、Grok、Premium；配置备份 | [一键安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/x-custom-ui.user.js) | [查看脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/x-custom-ui.user.js) |
| YouTube Default Quality | 新视频优先 1080P，否则选可用最高画质；每个视频仅设置一次，保留手动选择 | [一键安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/youtube-default-quality.user.js) | [查看脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/youtube-default-quality.user.js) |

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)，点击上表的 **一键安装**。
2. 在扩展页面点击 **安装**；已有脚本则点击 **更新**。
3. 打开或刷新 [ChatGPT](https://chatgpt.com/) / [X](https://x.com/) / [YouTube](https://www.youtube.com/)，开始使用。

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

**YouTube 使用要点**

- 安装与更新使用上表的 `main` 分支链接；如曾安装测试分支版本，请从该链接覆盖安装，以便后续跟随正式版本更新。
- 覆盖 `youtube.com` 及其所有子域名，不按普通视频、直播、首播、回放、Shorts 或嵌入式播放器区分：有 1080P 就明确选择固定 1080P，无需设置面板。视频本身没有 1080P 时，只能选择实际可用的最高画质。
- 即使当前是 **Auto（1080P）**，进入新视频时也会明确选择固定 1080P；当前解码分辨率相同不会跳过设置。
- 每个视频至多执行一次画质选择，之后可用原生菜单改为 4K、480P 或自动；暂停、继续、拖动、全屏均不会重新设置。切换其他视频后重新生效，返回上一个视频也会重新应用默认策略。
- 等待期间仅打开设置、查看画质或移动焦点不会取消默认设置；实际选择画质（包括 Auto）才交还控制权。
- 播放器未就绪时有限等待，最多 45 秒 / 30 次检查；待播页面超时后，首次实际播放可获得一次新的有限等待额度。接口异常或没有确认成功时，不重复写入画质。
- 1.1.0 已移除直播类型过滤，允许 YouTube iframe 中执行。真实 Edge / Chrome 验证涵盖正在直播、直播回放、Shorts 及嵌入式播放器；其他子域名仅验证匹配和模拟状态机，不代表所有站点变体均已实测。依赖 YouTube 非公开接口，网站更新可能失效。[技术说明、测试记录与限制](docs/youtube-default-quality.md)。

**未生效或布局异常？** 先刷新页面，确认脚本已启用；同一网站只保留一个同类布局脚本。仍有问题，可 [提交反馈](https://github.com/hmxxgit/browser_javascript_backup/issues/new)，附上浏览器、脚本版本和截图。

## 文件直达

| 文件 | 用途 |
| --- | --- |
| [ChatGPT 脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/chatgpt-custom-ui.user.js) | 查看完整源码、默认配置与版本 |
| [X 脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/x-custom-ui.user.js) | 查看完整源码、默认配置与版本 |
| [YouTube 脚本](youtube-default-quality.user.js) | 自动默认画质、视频状态与手动操作保护 |
| [YouTube 测试与技术说明](docs/youtube-default-quality.md) | 真实浏览器检查、模拟测试、兼容性边界 |
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
node --check youtube-default-quality.user.js
```

测试使用 Playwright 和本机 Microsoft Edge，在离线页面样例上运行，不访问真实账号。使用 Chrome：`X_UI_BROWSER=chrome npm test`。

YouTube 的可选联网检查单独运行：`node tests/youtube-default-quality.live.cjs`，或 `X_UI_BROWSER=chrome node tests/youtube-default-quality.live.cjs`。它使用独立临时浏览器环境访问公开视频，不登录账号；不计入 `npm test`。

Auto（1080P）专项回归：`node tests/youtube-default-quality-auto.live.cjs`，使用 `X_UI_BROWSER=chrome` 可改用 Chrome，检查固定档位的原生勾选状态及之后手动选择 Auto 的保护。

直播回放回归：`YOUTUBE_TEST_VIDEO=Gt4_60l-mDc YOUTUBE_TEST_START_QUALITY=hd720 node tests/youtube-default-quality-auto.live.cjs`，检查反馈视频从 Auto（720P）改为固定 1080P，并验证全新页面的 document-start 加载。

跨播放器场景回归：`node tests/youtube-default-quality-surfaces.live.cjs`，验证直播回放、正在直播、Shorts 与第三方页面中的 YouTube iframe；加 `X_UI_BROWSER=chrome` 使用 Chrome。

X 界面精简思路参考 [Minimal Twitter](https://github.com/typefully/minimal-twitter) 和 [Control Panel for Twitter](https://github.com/insin/control-panel-for-twitter)；脚本独立实现，不引入外部运行时。

</details>
