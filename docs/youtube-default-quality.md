# YouTube 默认画质脚本

## 安装和使用

1. 在 Chrome / Edge 安装 [Tampermonkey](https://www.tampermonkey.net/)。按扩展提示允许用户脚本执行（[官方说明](https://www.tampermonkey.net/faq.php#Q209)）。
2. 打开仓库中的 [youtube-default-quality.user.js](../youtube-default-quality.user.js)，点击 **Raw**，在 Tampermonkey 中安装。如果只显示源码，在 Tampermonkey 新建脚本，完整替换默认内容并保存。
3. 刷新 YouTube，打开任意可播放的视频（含直播、Shorts 和嵌入式播放器）。无需额外配置；每次切换到不同的视频，重新应用默认策略。
4. 同一 YouTube 页面只启用一个画质控制脚本。停用时，在 Tampermonkey 关闭本脚本并刷新页面。

正式安装与更新使用 [main 分支安装链接](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/youtube-default-quality.user.js)。如曾安装 PR / 测试分支版本，请从该链接覆盖安装，以便后续跟随正式版本更新。

## 画质策略和状态

- 只使用当前 `getAvailableQualityLevels()` 返回的选项，排除 `auto`。有 `hd1080` 则优先选择它，即使同时有 1440P / 4K。
- Auto 正好解码为 1080P 不等于固定 1080P。每次新的视频访问都执行一次明确选择，不因当前解码档位或已有首选档位相同而跳过。
- `youtube.com` 及其子域名统一执行该策略；不依据直播、首播、回放等元数据跳过。Shorts、`/live/ID`、`/embed/ID`、`/v/ID` 和 iframe 均可执行；频道直播页、首页或列表页存在实际播放器时，从播放器取得视频 ID。没有播放内容的页面不设置。
- 没有 1080P 时，在实际选项中比较高度；识别 `hdNNNN` 与 YouTube 的旧档位标识。对未来未知的标识，保留播放器当前“最高在前”的返回顺序，不凭空创建选项。
- 状态按连续的活动视频 ID 维护。A → B → A 每次重新设置；同一 ID 的列表参数、时间参数变化、重播、暂停、seek、全屏、窗口切换、播放器重建均不会解除已完成状态。URL 不含视频 ID 时，同页播放器短暂消失也保留锁定；小窗仍播放同一视频不会重复设置。整页刷新属于新的一次访问。
- `waiting` 可以重试**读取和就绪检查**；`applied`、`attempted`、`manual` 均不再写入。`expired` 停止检查，只有尚未经历首次实际播放的页面可在开播时获得一次新额度，绝不解锁已设置或手动选择的状态。
- 首次动作前先锁定为 `attempted`。已存在原生画质选项时，用当前 `getAvailableQualityData()` 的可播放、非付费标签精确匹配该选项并调用其原生点击处理；选项尚未初始化或无法安全匹配时，调用 `setPlaybackQualityRange(target, target)`。二者只执行其一，不会先设接口再补点一次菜单。
- 选项可以在隐藏面板中生效，不主动打开设置菜单；HD / 4K 等 `sup` 徽标不参与标签匹配，也不按固定菜单下标选择。即使动作发出同步事件、没有确认或抛异常，也不重复选择，以防第一次已生效后覆盖用户操作。
- 设置后只读取 `getPreferredQuality()` 作为确认；它不代表已解码画面立即达到目标分辨率。网络缓冲、编码切换仍由 YouTube 处理，脚本不持续纠正 ABR 的结果。

## 手动选择保护

成功设置后，脚本保留终态；任何播放事件或画质变化事件都不能再调用 setter。因此不需要猜测画质变化来自用户还是网络，也不会与播放器反复争夺控制权。

**整页刷新会重新选择固定 1080P，即使 URL 和视频 ID 完全相同。** 手动选择保护只存放在当前文档内存中，不写入跨页面存储；刷新创建新文档后，`document-start` 重新执行脚本并建立新的状态。刷新前手动选择 480P 或 Auto 不影响刷新后的默认策略。

初始化期间，仅捕获原生画质面板中 `role="menuitemradio"` 选项的可信主指针按下 / 点击、Enter / 空格激活，进入 `manual` 终态；包括选择 Auto。仅打开设置、查看 Auto（1080P）或用方向键移动焦点不会取消默认策略。脚本自身的合成点击不会被误判为用户选择。

## 就绪检查、导航与资源管理

- 全局文档事件：`yt-navigate-start` 暂停并取消待执行计时器；`yt-navigate-finish` 恢复身份检查；`yt-page-data-updated`、`yt-player-updated`、`DOMContentLoaded` 用于发现新播放器。
- 捕获 `<video>` 的 `loadstart`、`loadedmetadata`、`canplay`、`playing`，兼顾播放器重建与列表 / 自动播放的生命周期。
- 播放器事件：`onReady`、`onStateChange`、`onPlaybackQualityChange`、`videodatachange`。非公开事件可能不被各版本播放器转发，因此不单独依赖它们。
- `popstate` / `pageshow` 处理历史导航和页面恢复；`pagehide` 清理计时器、解绑播放器事件。
- 若支持 [Navigation API](https://developer.chrome.com/docs/web-platform/navigation-api)，还监听 `currententrychange`，覆盖没有 YouTube 导航事件的 `pushState` / `replaceState`。不替换网站的 History 方法；旧浏览器仍使用上述事件。
- 从 URL 或 `getVideoData().video_id` 确认身份；URL 和播放器同时提供 ID 时必须一致，内部 response 提供 ID 时也必须一致。嵌入式播放器不必提供 response 接口。确认 DOM 播放器仍连接，读取画质列表后再次检查身份，防止旧任务作用于新视频。Shorts 存在多个播放器时优先匹配 ID 且可见的活动播放器。
- 就绪检查延迟为 0、500ms、1s，之后不超过每 2s 一次；最多 45 秒或 30 次检查，以先到者为准。普通事件不会重置额度；待播超时后首次实际 `playing` 且播放器状态为播放中时，至多补一次同样的有限额度。完成后无轮询，始终至多一个计时器。
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
# 用户反馈的实际直播回放：Auto（720P）与全新页面启动检查。
YOUTUBE_TEST_VIDEO=Gt4_60l-mDc YOUTUBE_TEST_START_QUALITY=hd720 node tests/youtube-default-quality-auto.live.cjs
# 直播、回放、Shorts 和第三方页面内 iframe。
node tests/youtube-default-quality-surfaces.live.cjs
# 同一视频手动改为 480P / Auto 后，真正 reload 并确认固定 1080P。
node tests/youtube-default-quality-reload.live.cjs
```

离线测试在真实 Chromium 浏览器中加载模拟播放器，验证脚本状态机；不等于验证 YouTube 的真实菜单、接口或视频画面。1.1.0 的完整仓库 `npm test` 共 71 项通过；YouTube 的 58 项在 Edge 和 Chrome 均通过。真实网站检查结果见下方记录。

### 同一视频整页刷新专项（2026-10-17）

1.1.0 原有的内存状态设计已支持整页刷新重置，无需修改选择策略。新增 [刷新专项脚本](../tests/youtube-default-quality-reload.live.cjs)，在真实 `aqz-KE-bpKQ` 页面 document-start 注入：Chrome 155.0.8059.84 与 Edge 155.0.4283.60 均通过“手动 480P → 同地址 reload”及“手动 Auto → 同地址 reload”两项。刷新前尊重手动档位；刷新后固定首选为 `hd1080`，解码 1920×1080，原生菜单勾选 1080P，并确认文档内存标记已清除。

测试用可信 Enter 激活原生画质选项，以避开菜单动画的点击位置竞争。此前鼠标点击检查曾因元素不稳定 / 重建而超时，不计为通过。在反馈回放 `Gt4_60l-mDc` 上，曾单次完成 480P 刷新检查，但重复检查进入广告阶段并超时（`ad-showing` / `ad-interrupting`），未计为完整通过；不据此声称已验证所有广告条件。刷新后的播放器可能暂未启动，测试会请求播放后等待真实格式就绪。未安装 Tampermonkey 扩展。

### 1.1.0 全站统一策略（2026-10-17）

移除全部直播 / 待播类型过滤，扩展到 `youtube.com` 及其所有子域名（HTTP / HTTPS），去掉 `@noframes`。不同播放器只按实际视频身份与可用画质判断；不存在“先等直播结束才设置”的限制。广告与尚未初始化的播放器仅等待就绪，不消耗内容的一次设置机会。

新增模拟覆盖域名匹配、全部路由、缺少 response API 的嵌入播放器、Shorts 屏外重复播放器、无 URL 视频 ID 的延迟初始化与播放器重建，以及待播超时后首次开播。移动站点、Music 等子域名验证的是匹配与模拟行为，未在其完整真实应用中逐一验证。

实际联网脚本：[youtube-default-quality-surfaces.live.cjs](../tests/youtube-default-quality-surfaces.live.cjs)。Edge 和 Chrome 各完成以下 4 项，均在全新临时环境 document-start 注入，读取固定首选 `hd1080` 并等待实际解码尺寸：

| 实际页面 | 结果 |
| --- | --- |
| 用户反馈的 `Gt4_60l-mDc` 直播回放 | 固定 1080P；1920×1080 |
| `@LofiGirl/live` 当次正在直播的 `1-LpQekNa9g`，实际 `isLive` / `isLiveNow` 为 true | 固定 1080P；1920×1080 |
| Shorts `sUZe3nd-3AY` | 固定 1080P；1080×1920 竖屏 |
| 第三方测试父页面中的 YouTube iframe，`aqz-KE-bpKQ` | 固定 1080P；1920×1080；父页面不执行脚本 |

嵌入式播放器在请求播放前可能没有画质列表；联网测试先请求静音播放，再等待脚本选择，未通过预设画质来准备该场景。另在 Edge 对反馈视频重跑 Auto（720P）专项 5 项全部通过：两种菜单初始化状态均变为固定 1080P，随后手动 Auto 均保持，以及全新页面 document-start 启动。

这些检查访问真实播放器与媒体，不安装 Tampermonkey；不等于扩展安装流程端到端验证。首播等待室开播、移动站点和 Music 完整界面尚未真实验证。以下保留旧版本的历史记录，其范围限制不代表 1.1.0 的当前行为。

### 1.0.2 已结束直播回放修复（2026-10-17）

用户反馈的实际视频：[Canada Autumn 8K](https://www.youtube.com/watch?v=Gt4_60l-mDc)。真实播放器返回 `isLiveContent=true`、`isLiveNow=false`，结束时间为 `2026-10-17T01:00:05+00:00`，实际可用档位包含 1080P、1440P、2160P。1.0.1 将所有直播来源的视频保守跳过，导致该回放没有执行任何自动选择。

1.0.2 支持明确结束的直播回放；正在直播、待播与离线状态仍不自动选择。只有直播来源标记、结束信息尚未到达时，会按原有额度继续等待，避免播放器初始化稍慢就永久跳过。新增 9 项模拟回归覆盖结束回放、保留直播能力字段的回放、缺少结束信息、互相矛盾的直播标记，以及结束元数据延后加载。

对**同一条反馈视频**，Chrome 155.0.8059.84 与 Edge 155.0.4283.60 各完成 5 项真实网站检查：

| 场景 | 结果 |
| --- | --- |
| 已有原生面板，准备 Auto（720P）后注入脚本 | 单次原生选择固定 1080P，实际解码达到 1080P，原生菜单勾选 1080P |
| 上述设置后用户手动选择 Auto | 维持 Auto，脚本没有再次选择 |
| 原生面板尚未初始化，准备 Auto（720P）后注入脚本 | 单次接口选择固定 1080P，实际解码达到 1080P，首次打开原生菜单勾选 1080P |
| 接口路径设置后用户手动选择 Auto | 维持 Auto，脚本没有再次选择 |
| 全新临时 context，document-start 注入并直接进入该视频 | 无预设画质操作，自动固定 1080P，确认实际解码及原生菜单勾选 |

前四项通过真实播放器接口准备 Auto（720P）的前置状态，第五项直接验证新页面加载；均未登录账号，未安装 Tampermonkey 扩展。验收脚本命令见上方；加 `X_UI_BROWSER=chrome` 可改用 Chrome。

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

- 覆盖真正的 `youtube.com` 及其子域名；`youtu.be` 短链接跳转到 YouTube 后生效。移动站点、Music 等可能使用不同的播放器结构或缺少内部接口，域名覆盖不等于每种应用变体均已实测。
- 无论视频类型，源视频必须实际提供 1080P 才能选择；缺少该档位时选择实际最高。待播页尚无媒体、纯音频或受限内容不能凭空生成 1080P。广告或初始化超出有限额度可能放弃；尚未开始播放的页面只有首次实际开播可补一次有限等待。
- 网站内部接口、事件、广告标记、可用选项排序均可能变化；缺少接口、身份无法确认或空列表时只有限等待，不尝试过时 setter，也不反复操作菜单。未来新标识的最高档判断依赖播放器返回顺序。
- 原生选项匹配依赖当前画质数据和菜单标签结构；无法安全匹配时退回 range 接口，菜单勾选的后续同步由播放器处理，不通过第二次写入或反复打开菜单补救。
- 不保证解码帧始终为目标尺寸，无法保证内部方法永不静默失败。首次写入没有确认或抛异常也不重试；这是优先保护用户手动选择的取舍。
- 其他扩展 / 脚本、网页自身持久化设置和账号实验可能影响行为。独立浏览器中通过 DevTools / document-start 执行脚本，不能替代已安装 Tampermonkey 扩展的完整端到端验证。
