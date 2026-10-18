# YouTube 默认画质 2.3.0 复查与修复

日期：2026-10-18（Asia/Shanghai）。审查基线：`58d26d13ef28baa50d6db588edadadfe3cba90c2`，通过 SSH remote `git fetch` 确认为当时远程 `main`；本地 `youtube-default-quality.user.js` 与 `origin/main` 的 sha256 一致。开始时工作区干净。

本次复查针对 2.2.0 审查后仍存在的状态机与兼容性边界，不改变 2.2.0 已验证的画质选择策略、手动锁语义和 45 秒 / 30 次就绪额度。

## 问题与修复

| 优先级 | 问题及证据 | 修复 |
| --- | --- | --- |
| P1 | `yt-navigate-start` 把 `navigating` 置为 true 并取消计时器，只有 `yt-navigate-finish` / `pageshow` 能复位。若取消导航或事件丢失，`schedule()` / `probe()` 会永久返回，整页不再应用画质且没有提示。离线 harness 复现：只发 start、不发 finish，播放器就绪后 60 秒仍无写入；对照组正常写入 `hd1080` | 新增 15 秒导航看门狗；`yt-navigate-finish`、`pageshow`、`pagehide` 清理；看门狗超时后清除暂停、打印警告并重新发现播放器。新增回归覆盖 |
| P1 | 超时 / 未确认时只有 `console.warn`，用户没有恢复入口 | 新增 Tampermonkey 菜单 **重新应用画质（覆盖本视频手动选择）**：清除终态和手动锁、重置额度并立即重新检查当前视频；警告附带操作提示。新增过期与手动锁两类回归 |
| P2 | 异步菜单准备期间任意可信 `pointerdown` / `keydown`（包括点视频、Tab、在搜索框输入）都会中止准备、消耗每次访问仅 2 次的准备额度，并可能把脚本自己隐藏的设置面板亮出来 | 只有点进该播放器的设置按钮 / 面板才中止准备；其他输入只标记焦点已移动，让后续 restore 不抢焦点，但保留准备与隐藏样式，不消耗额度。新增回归覆盖无关输入，保留原有设置交互中止用例 |
| P2 | 手动选择保护只认桌面版 `.ytp-quality-menu`；其他播放器界面/改版容器无法交还控制权 | 桌面容器仍直接识别；其他界面按播放器 `getAvailableQualityData()` 标签、`getAvailableQualityLevels()` 高度标签和 `Auto` 精确匹配 `role="menuitemradio"` 文本，倍速等无关单选项不误锁。新增跨容器与倍速回归 |
| P3 | 旧档位 `highres` 未被映射，可能把 4K 视频降级到 1080P | 映射为 2160 的保守上限，首选 1080 时仍会排除；新增矩阵回归 |
| P3 | 未匹配 `youtube-nocookie.com`，但文档声称支持嵌入式播放器 | 新增两条 `@match` 和 hostname 校验；新增 host 覆盖与无关 host 拒绝回归 |
| P3 | 缺少 `@updateURL` / `@downloadURL` / `@author`，与仓库其他脚本不一致 | 补齐元数据；离线测试校验 |
| P3 | 实例标记在主逻辑前写入，初始化中途抛异常会留下阻止再次注入的“毒标记” | 标记移到初始化与监听器注册完成后写入；重复注入回归继续通过 |

## 已验证

```sh
node --check youtube-default-quality.user.js
node --test tests/youtube-default-quality.test.cjs
```

完整仓库 `npm test`：**143 项通过**。YouTube 离线回归：**124 项通过**（原 114 项 + 新增 10 项）。

联网基础检查（`node tests/youtube-default-quality.live.cjs`，Edge 155.0.4283.62，播放器资源仍为 `0229cd64`）：前 4 项通过——初始视频选择并解码到 1080P、原生手动 4K 保留、原生手动 480P 经暂停 / 继续、seek、全屏后保留。随后点击推荐视频进入 `iT-ozlJGiE0` 时播放器处于广告状态（`adClass: true`），50 秒等待内没有主内容就绪，测试未完成，未计入通过；这不是本次改动的回归结论，但说明广告较长的场景仍可能推迟默认画质。

新增离线覆盖：

- 丢失 `yt-navigate-finish` 后看门狗恢复并应用画质。
- 过期访问通过菜单重新应用；手动锁通过菜单清除后重新应用。
- 去掉 `.ytp-quality-menu` 后仍识别手动 480P；倍速 `menuitemradio` 不锁定。
- 异步菜单准备期间点击视频 / 按键不消耗准备次数，仍只准备一次并成功应用。
- `highres` 在 2160 上限内被选为最高档，首选 1080 时被排除。
- `youtube-nocookie.com` 正常应用，伪装子域被拒绝。
- 元数据包含 nocookie、更新地址和作者；菜单命令为两项。

## 未验证与边界

- 本次新增回归均在离线 Chromium fixture 中执行，**未重新执行联网真实站点检查**；导航看门狗针对的是丢失 finish 的风险，不代表已确认 YouTube 当前会漏发该事件。
- 手动识别的跨容器匹配依赖 `role="menuitemradio"` 和可读的 `ytp-menuitem-label` 文本；移动端 / 实验版界面若使用完全不同的结构，仍只能尽力而为。
- `highres` 的 2160 映射是保守上限，不保证真实分辨率；现代桌面播放器通常返回 `hd2160` / `hd1440`，该映射仅覆盖旧接口变体。
- `reapply` 会清除当前视频的手动锁，这是命令的明确语义；菜单文案已注明“覆盖本视频手动选择”。
- YouTube 内部接口、原生菜单标识和广告 / 直播组合仍可能随网站更新变化；2.3.0 不能承诺永久有效。
