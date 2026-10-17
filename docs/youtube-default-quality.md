# YouTube 默认画质脚本

## 安装和使用

1. 在 Chrome / Edge 安装 [Tampermonkey](https://www.tampermonkey.net/)。按扩展提示允许用户脚本执行（[官方说明](https://www.tampermonkey.net/faq.php#Q209)）。
2. 打开仓库中的 [youtube-default-quality.user.js](../youtube-default-quality.user.js)，点击 **Raw**，在 Tampermonkey 中安装。如果只显示源码，在 Tampermonkey 新建脚本，完整替换默认内容并保存。
3. 刷新 YouTube，播放桌面版普通视频。无需额外配置；每次切换到不同的视频，重新应用默认策略。
4. 同一 YouTube 页面只启用一个画质控制脚本。停用时，在 Tampermonkey 关闭本脚本并刷新页面。

正式安装与更新使用 [main 分支安装链接](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/youtube-default-quality.user.js)。如曾安装 PR / 测试分支版本，请从该链接覆盖安装，以便后续跟随正式版本更新。

## 画质策略和状态

- 只使用当前 `getAvailableQualityLevels()` 返回的选项，排除 `auto`。有 `hd1080` 则优先选择它，即使同时有 1440P / 4K。
- Auto 正好解码为 1080P 不等于固定 1080P。每次新的视频访问都执行一次明确选择，不因当前解码档位或已有首选档位相同而跳过。
- 没有 1080P 时，在实际选项中比较高度；识别 `hdNNNN` 与 YouTube 的旧档位标识。对未来未知的标识，保留播放器当前“最高在前”的返回顺序，不凭空创建选项。
- 状态按连续的 `/watch?v=视频ID` 访问维护。A → B → A 每次重新设置；同一 ID 的列表参数、时间参数变化、重播、暂停、seek、全屏、窗口切换、播放器重建均不会解除已完成状态。离开 watch 页面清理该次访问状态；整页刷新属于新的一次访问。
- `waiting` 可以重试**读取和就绪检查**；`applied`、`attempted`、`manual`、`expired`、`unsupported` 都是该次访问的终态，不再写入。
- 首次动作前先锁定为 `attempted`。已存在原生画质选项时，用当前 `getAvailableQualityData()` 的可播放、非付费标签精确匹配该选项并调用其原生点击处理；选项尚未初始化或无法安全匹配时，调用 `setPlaybackQualityRange(target, target)`。二者只执行其一，不会先设接口再补点一次菜单。
- 选项可以在隐藏面板中生效，不主动打开设置菜单；HD / 4K 等 `sup` 徽标不参与标签匹配，也不按固定菜单下标选择。即使动作发出同步事件、没有确认或抛异常，也不重复选择，以防第一次已生效后覆盖用户操作。
- 设置后只读取 `getPreferredQuality()` 作为确认；它不代表已解码画面立即达到目标分辨率。网络缓冲、编码切换仍由 YouTube 处理，脚本不持续纠正 ABR 的结果。

## 手动选择保护

成功设置后，脚本保留终态；任何播放事件或画质变化事件都不能再调用 setter。因此不需要猜测画质变化来自用户还是网络，也不会与播放器反复争夺控制权。

初始化期间，仅捕获原生画质面板中 `role="menuitemradio"` 选项的可信主指针按下 / 点击、Enter / 空格激活，进入 `manual` 终态；包括选择 Auto。仅打开设置、查看 Auto（1080P）或用方向键移动焦点不会取消默认策略。脚本自身的合成点击不会被误判为用户选择。

## 就绪检查、导航与资源管理

- 全局文档事件：`yt-navigate-start` 暂停并取消待执行计时器；`yt-navigate-finish` 恢复身份检查；`yt-page-data-updated`、`yt-player-updated`、`DOMContentLoaded` 用于发现新播放器。
- 捕获 `<video>` 的 `loadstart`、`loadedmetadata`、`canplay`、`playing`，兼顾播放器重建与列表 / 自动播放的生命周期。
- 播放器事件：`onReady`、`onStateChange`、`onPlaybackQualityChange`、`videodatachange`。非公开事件可能不被各版本播放器转发，因此不单独依赖它们。
- `popstate` / `pageshow` 处理历史导航和页面恢复；`pagehide` 清理计时器、解绑播放器事件。
- 若支持 [Navigation API](https://developer.chrome.com/docs/web-platform/navigation-api)，还监听 `currententrychange`，覆盖没有 YouTube 导航事件的 `pushState` / `replaceState`。不替换网站的 History 方法；旧浏览器仍使用上述事件。
- URL 视频 ID、`getVideoData().video_id`、`getPlayerResponse().videoDetails.videoId` 三者必须一致，并确认当前 DOM 播放器仍连接。读取画质列表后再次检查身份，防止旧任务作用于新视频。
- 就绪检查延迟为 0、500ms、1s，之后不超过每 2s 一次；最多 45 秒或 30 次检查，以先到者为准。事件不会重置额度。完成后无轮询，始终至多一个计时器。
- 只保留一个当前视频状态和一个播放器引用；更换播放器时解绑旧事件，重复注入由实例标记阻止。没有全页 MutationObserver，也没有常驻高频轮询。

## 接口依据

检查日期：2026-10-17。实际页面加载的播放器资源为 [0229cd64 / base.js](https://www.youtube.com/s/player/0229cd64/player_es6.vflset/en_US/base.js)。这是网站内部实现，版本可能变化。

- 该资源的 `setPlaybackQuality` 公开包装绑定到空方法 `QR(){}`，不能拿旧的 IFrame 示例作为有效性依据。
- 桌面扩展接口 `setPlaybackQualityRange` 绑定到 `SE`，将上下界传给当前内容播放器。实际运行调用两个相同档位后，`getPreferredQuality()` 确认首选档位。
- [官方 IFrame API 修订记录](https://developers.google.com/youtube/iframe_api_revision_history) 已声明旧的画质设置 / 查询 API 不再受支持。本脚本使用的是桌面播放器仍暴露的内部接口，不承诺官方 API 兼容性。
- 元数据使用 `@grant none` 和 `@sandbox raw` 请求页面上下文，以访问播放器方法（[Tampermonkey 官方文档](https://www.tampermonkey.net/documentation.php#meta:sandbox)）。不使用外部运行时、远程代码、GM 权限或持久化存储。

## 测试

自动离线测试：[youtube-default-quality.test.cjs](../tests/youtube-default-quality.test.cjs)。真实网站的可重复检查：[youtube-default-quality.live.cjs](../tests/youtube-default-quality.live.cjs)，联网检查会报告当次浏览器版本、实际选项、首选档位、解码尺寸和 setter 次数。

```sh
npm ci
npm test
X_UI_BROWSER=chrome node --test tests/youtube-default-quality.test.cjs
node --check youtube-default-quality.user.js
# 以下检查联网访问公开视频；不登录账号，不安装扩展。
node tests/youtube-default-quality.live.cjs
# Auto（1080P）专项：检查原生固定档位勾选，而不只检查解码尺寸。
node tests/youtube-default-quality-auto.live.cjs
```

离线测试在真实 Chromium 浏览器中加载模拟播放器，验证脚本状态机；不等于验证 YouTube 的真实菜单、接口或视频画面。1.0.1 的完整仓库 `npm test` 共 44 项通过；YouTube 的 31 项在 Edge 和 Chrome 均通过。真实网站检查结果见下方记录。

### 1.0.1 Auto（1080P）修复与实际验证（2026-10-17）

已在真实播放器复现：`preferred=auto` 且 `playback=hd1080` 时，单独调用 range 接口会让 `preferred` 变成 `hd1080`，但原生选项仍可能勾选 Auto，因为解码档位不变时没有画质变化事件来刷新菜单。旧版“仅打开设置就让出控制权”的保护也可能提前取消默认设置。

1.0.1 以一次原生选项选择同时更新固定档位与勾选状态；没有已初始化的选项时仍只调用一次 range 接口，之后首次打开菜单会按固定首选初始化。原生选项和接口不会先后各执行一次。用户随后主动选择 Auto 时，当前视频仍保持 Auto。

专项脚本：[youtube-default-quality-auto.live.cjs](../tests/youtube-default-quality-auto.live.cjs)。Chrome 155.0.8059.84、Edge 155.0.4283.60 各 4 项通过：

| 真实网站场景 | 结果 |
| --- | --- |
| 已有原生面板，Auto 解码为 1080P | 单次原生选择后，首选 `hd1080`，实际勾选 `1080p60 HD`，不再勾选 Auto |
| 上述选择后，用户手动改回 Auto | 继续播放与导航 / 媒体事件后仍是 Auto，脚本动作总数仍为 1 |
| 原生面板尚未初始化，Auto 解码为 1080P | 单次接口设置后，首次打开菜单勾选 `1080p60 HD` |
| 接口路径设置后，用户手动改回 Auto | 继续尊重 Auto，脚本动作总数仍为 1 |

专项检查使用真实公开视频，通过接口准备 Auto + 1080P 的前置状态后注入脚本，不是模拟播放器。检查包含实际勾选状态，且脚本的设置按钮点击次数为 0。网络可能使 Auto 在准备期间排入较低档位的格式切换，因此断言固定选项前等待目标画面重新解码完成，不将切换中的临时档位误判为最终选择。Tampermonkey 扩展本身的端到端安装仍未验证。

此外，1.0.1 在 Edge 重跑完整联网脚本的 8 个检查点全部通过，包括手动 4K / 480P、推荐视频 SPA 切换和浏览器后退。新增模拟回归还覆盖每次 A → B → A 都明确设置、仅查看菜单不取消、实际选择才让出控制权、隐藏选项及付费增强档位的排除。

### 1.0.0 实际执行记录（2026-10-17）

Edge 155.0.4283.60 和 Chrome 155.0.8059.84，无账号、headless 独立临时环境，真实 YouTube 页面。完整联网检查的 8 个检查点在两种浏览器中均通过。初始脚本通过 DevTools 执行，另有独立 context 的 document-start 注入检查；未安装或实测 Tampermonkey 扩展本身。

复查中曾有一轮 Chrome 推荐视频切换的画质确认在测试默认 30 秒时超时（播放器仍报告自动档位），该轮不计为通过；未能确定根因，随后同一脚本复测通过。联网检查已将该断言等待上限调至 50 秒，以覆盖脚本的完整 45 秒就绪窗口。这是小规模现场验证，不代表已证明所有账号、广告和网络条件下均无偶发失效。

| 验收场景 | 模拟测试（Edge / Chrome） | 真实 YouTube（Edge / Chrome） |
| --- | --- | --- |
| 同时有 1080P、1440P、4K | 通过 | 通过；`aqz-KE-bpKQ` 请求 1080P，确认解码帧 1920×1080 |
| 最高只有 720P | 通过 | 未专门验证该档位组合 |
| 只有 480P、360P | 通过 | 未专门验证该档位组合 |
| 没有 1080P，选实际最高 | 通过 | `jNQXAC9IVRw` 返回 `small,tiny,auto`，选择最高 `small`（240P） |
| 原生菜单 1080P → 4K | 通过 | 通过；首选变成 `hd2160`，解码帧 3840×2160，脚本累计写入仍为 1 次 |
| 原生菜单改为 480P | 通过 | 通过；首选 `large`，后续播放操作不增加脚本写入 |
| 暂停、继续、拖动、全屏 | 通过 | 通过；在手动 480P 后执行，不增加写入 |
| 点击新的推荐视频（SPA） | 通过 | 通过；Edge 实际点击到 `Z5piXWB77fI`，Chrome 到 `6yKXo3wudiU`，均重新选择 1080P |
| 搜索结果跳转、播放列表 / 自动播放下一条 | 通过（导航 / 媒体事件模拟） | 未做真实搜索点击或自然播完列表验证 |
| 浏览器后退到另一视频 | 通过 | 通过；返回 `aqz-KE-bpKQ` 后重新选择 1080P，A → B → A 共 3 次写入 |
| 慢初始化、空列表、广告等待、45 秒超时 | 通过 | document-start 等待真实播放器通过；未人为制造慢网络 / 长广告 |
| 旧任务竞争、播放器替换、异常、重复注入 | 通过 | 真实导航通过；竞态边界及异常注入仅模拟验证 |

首次 1080P 与原生菜单 4K 检查都等待并确认对应解码尺寸。480P 和 document-start 检查断言的是首选档位，缓冲 / seek 期间可能尚未出帧，不能将这种暂态描述为已解码到目标画质。未来推荐内容和播放器更新可能使联网检查需要调整；脚本不依赖测试中的推荐视频 ID 或菜单文字。

## 已知限制

- 仅处理 `https://www.youtube.com/watch?v=...` 的桌面普通视频，包含列表参数和从列表页进入的视频。纯列表页没有正在播放的视频，因此不设置。Shorts、嵌入页、其他域名 / 移动站点不处理。
- 直播、首播、标记为 live content 的直播回放保守跳过；普通视频前贴广告等待结束，但广告或初始化超过等待额度后也会放弃。
- 网站内部接口、事件、广告标记、可用选项排序均可能变化；缺少接口、身份无法确认或空列表时只有限等待，不尝试过时 setter，也不反复操作菜单。未来新标识的最高档判断依赖播放器返回顺序。
- 原生选项匹配依赖当前画质数据和菜单标签结构；无法安全匹配时退回 range 接口，菜单勾选的后续同步由播放器处理，不通过第二次写入或反复打开菜单补救。
- 不保证解码帧始终为目标尺寸，无法保证内部方法永不静默失败。首次写入没有确认或抛异常也不重试；这是优先保护用户手动选择的取舍。
- 其他扩展 / 脚本、网页自身持久化设置和账号实验可能影响行为。独立浏览器中通过 DevTools / document-start 执行脚本，不能替代已安装 Tampermonkey 扩展的完整端到端验证。
