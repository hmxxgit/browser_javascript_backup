# 浏览器实用脚本

为 [ChatGPT](https://chatgpt.com/) 和 [X / Twitter](https://x.com/) 调整阅读布局、字体和界面，并为 [YouTube](https://www.youtube.com/) 新视频自动选择默认清晰度。需要先安装 [Tampermonkey 扩展](https://www.tampermonkey.net/)。

[快速安装](#快速安装) · [常用操作](#常用操作) · [文件直达](#文件直达) · [更新记录](https://github.com/hmxxgit/browser_javascript_backup/commits/main/) · [反馈问题](https://github.com/hmxxgit/browser_javascript_backup/issues)

## 快速安装

| 脚本 | 主要功能 | 安装 / 更新 | 源码 |
| --- | --- | --- | --- |
| ChatGPT Custom UI | 加宽正文、调整字体颜色；自动隐藏输入框；代码换行控制、算法图适应屏幕 | [一键安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/chatgpt-custom-ui.user.js) | [查看脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/chatgpt-custom-ui.user.js) |
| X Custom UI | 加宽时间线、调整字体和照片高度；隐藏右栏、Grok、Premium；配置备份 | [一键安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/x-custom-ui.user.js) | [查看脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/x-custom-ui.user.js) |
| YouTube Default Quality | Tampermonkey 中配置首选画质，不足时向下匹配；每个视频仅设置一次，保留手动选择 | [一键安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/youtube-default-quality.user.js) | [查看脚本](https://github.com/hmxxgit/browser_javascript_backup/blob/main/youtube-default-quality.user.js) |

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
- 打开 YouTube 后，点击 **Tampermonkey → YouTube Default Quality (Configurable) → 设置首选清晰度…**。可选 8K、4K、1440P、1080P、720P、480P、360P、240P、144P，初始默认 1080P。
- 优先选择设定档位；没有时选择**不高于首选的实际最高画质**。例如首选 4K，视频最高 1440P 就选择 1440P；首选 1440P，只有 4K / 1080P / 720P 时选择 1080P。没有可识别的向下选项时有限等待后不设置，不向上匹配。
- **保存**：从下一个视频生效，当前视频保持用户选择；**保存并刷新**：保存后立即刷新，重新应用到当前视频。设置保存在 Tampermonkey，跨标签页和 YouTube 子域名共用，每次新视频读取。
- 覆盖 `youtube.com` 及其所有子域名，不按普通视频、直播、首播、回放、Shorts 或嵌入式播放器区分。
- 即使 Auto 恰好达到目标清晰度，新视频仍明确选择固定档位；当前解码分辨率相同不会跳过设置。2.2.0 保留主视频可播放、媒体源稳定后的首次选择，增加独立手动锁、严格播放器身份检查，以及可恢复且有上限的原生菜单准备流程。
- 每个视频确认固定画质后不再自动选择；原生点击后仍明确返回 Auto 时，最多尝试 3 次（每次至少间隔 1 秒），任何手动选择立即取消后续尝试。之后可用原生菜单改为 4K、480P 或自动；暂停、继续、拖动、全屏均不会重新设置。切换其他视频后重新生效，返回上一个视频也会重新应用默认策略。
- **刷新同一个视频页面也会重新按已保存的首选画质选择**：手动选择仅保留到本次页面访问结束，不跨刷新保存。
- 等待期间仅打开设置、查看画质或移动焦点不会取消默认设置；实际选择画质（包括 Auto）才交还控制权；即使播放器 API 尚未初始化，明确的手动选择也会受保护。
- 播放器未就绪时有限等待，每轮最多 45 秒 / 30 次检查；首次主视频播放可获得一次新的有限等待额度，广告不会消耗该机会，后续播放事件不会继续延长。抛出异常或回退接口未确认时不重复写入；原生选项仍返回 Auto 时按上述上限等待确认。
- 菜单准备每次视频访问最多 2 次，每次异步等待最多 1.5 秒；用户正在查看设置且选项尚未生成时等待其操作，不强行切换面板。同一任务中的事件通知合并处理，页面挂起时取消资源。详见 [2.2.0 审查报告](docs/youtube-default-quality-review-2026-10-18.md)。
- 1.1.0 已移除直播类型过滤，允许 YouTube iframe 中执行。真实 Edge / Chrome 验证涵盖正在直播、直播回放、Shorts 及嵌入式播放器；其他子域名仅验证匹配和模拟状态机，不代表所有站点变体均已实测。依赖 YouTube 非公开接口，网站更新可能失效。[技术说明、测试记录与限制](docs/youtube-default-quality.md)。

从旧版升级后请允许 Tampermonkey 新增的菜单、存储与页面访问权限并刷新。新版脚本名称不再带固定的 1080P；若手动安装产生新旧两个条目，请停用旧版，只保留新版。

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

实际 Tampermonkey 配置流程：`TM_EXTENSION_PATH='/absolute/path/to/unpacked/Tampermonkey' node tests/youtube-default-quality-settings.live.cjs`。在独立临时 Edge 配置中安装脚本，验证真实菜单、GM 存储、4K / 720P 与 8K 向下降级；扩展目录仅作读取，不使用日常浏览器资料。

同视频刷新回归：`node tests/youtube-default-quality-reload.live.cjs`，手动选择 480P / Auto 后刷新同一地址，检查恢复固定 1080P；加 `X_UI_BROWSER=chrome` 使用 Chrome。

X 界面精简思路参考 [Minimal Twitter](https://github.com/typefully/minimal-twitter) 和 [Control Panel for Twitter](https://github.com/insin/control-panel-for-twitter)；脚本独立实现，不引入外部运行时。

</details>
