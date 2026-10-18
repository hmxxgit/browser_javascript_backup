# YouTube 默认画质 2.5.1 复查与修复

日期：2026-10-18（Asia/Shanghai）。审查基线：`4f4b0f66eca4d3712b59a85d0c360bd25b36f762`（2.5.0）。用户反馈：自动设置画质时，清晰度列表仍会弹在页面上，希望完全在后台改。

## 根因

在真实 Edge 页面（用户报告视频 `nPdqduzfI3c`、播放器 `0229cd64`）复现并抓到两个叠加问题：

1. **关闭后的设置菜单可能残留 `aria-expanded=true` / `.ytp-settings-shown`。** 2.5.0 用 `isExpanded()` 判断“用户已打开面板”，该判断是 class **或** aria。菜单实际 `display:none`、但 aria 仍为 true 时，脚本误以为用户正在看设置，于是跳过临时隐藏样式，直接 `openSettingsMenuItem`，画质列表就可见地弹出来。
2. **恢复逻辑会把已经关闭的菜单再次点开。** 关闭循环的条件也是 `isExpanded()`（class OR aria）。真实页面日志：
   - 第 1 次点击齿轮后：`display:none`、class 已移除、`aria-expanded` 仍为 true；
   - 因为 aria 仍为 true，循环执行第 2 次点击，菜单重新 `display:block`；
   - 随后移除隐藏样式，用户看到画质列表。
   2.1.0 的“可能两次齿轮点击”本来是为程序化弹窗锁准备的，但残留 aria 让第二次点击变成了重新打开。

## 修复

- **按实际可见性判断用户面板**：`userPanel = 菜单实际 display !== 'none' && isExpanded()`。关闭的菜单即使残留 aria / class，也会被当作脚本自己的面板处理，应用临时隐藏。
- **关闭循环只看真实打开状态**：`stillOpen = isExpanded() && menuDisplayed()`；菜单 `display:none` 后立即停止，不再因为残留 aria 触发第二次点击重开。
- **增强隐藏样式**：同时隐藏 `.ytp-settings-menu` 和 `.ytp-quality-menu`，使用 `visibility:hidden!important`、`opacity:0!important`、`pointer-events:none!important`。
- 只有脚本自己打开的面板会被隐藏、关闭、清理；用户真实打开的面板仍复用，不关闭、不抢焦点（`userPanel`）。

## 验证

离线：

```sh
node --check youtube-default-quality.user.js
node --test tests/youtube-default-quality.test.cjs   # 128/128
npm test                                             # 147/147
```

新增回归：

- 关闭菜单 + 残留 `aria-expanded=true` 时，脚本必须加隐藏属性、完成选择并关闭菜单，`settingsClicks >= 1`；不再把它当作用户面板。
- 原有已打开面板、异步准备、摘要校验和 Auto 拒绝回归继续通过。
- 测试 fixture 增加可选的 `realMenuDisplay`，只在需要时模拟 `display:none/block`，不改变其他用例。

真实页面（Edge 155.0.4283.62，播放器 `0229cd64`）：

- 正常观看、未打开设置：轮询 120 次（50ms）`expanded=false`、`display:none`，脚本没有把设置/画质菜单显示出来；选择在隐藏菜单中完成。
- 模拟关闭菜单 + 残留 `aria-expanded=true`：修复前 `ANY_VISIBLE=true`，修复后 `ANY_VISIBLE=false`，固定 1080P 仍成功。
- 用户主动保持设置面板打开：仍会复用面板并勾选 1080p HD，这是用户自己的面板，不是脚本自动弹出。
- 无脚本异常。

## 边界

- 如果用户自己打开设置，脚本会切换到画质列表完成选择；这是复用用户面板，不是后台隐藏。若希望连这种情况也不动用户面板，需要改用 Range API，但会牺牲原生菜单摘要的 fixed 状态。
- 隐藏依赖 YouTube 的 `.ytp-settings-menu` / `.ytp-quality-menu` 结构及 `display` 状态；网站改版可能失效。
- 菜单仍在 DOM 中被程序化打开/点击，只是不可见；不是真正的无 DOM 后台 API。内部接口和菜单结构仍可能随 YouTube 更新变化。
- 真实检查集中在单个直播回放视频，未逐一覆盖所有直播、广告、移动端、TV 与账号实验。
