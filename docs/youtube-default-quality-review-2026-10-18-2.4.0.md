# YouTube 默认画质 2.4.0 复查与修复

日期：2026-10-18（Asia/Shanghai）。审查基线：`a90ff80cd73ac08ba857939c5d8b98cba9ab7816`（2.3.0）。用户报告视频：[`nPdqduzfI3c`](https://www.youtube.com/watch?v=nPdqduzfI3c&t=31162s)（8K 瑞士风光直播回放）。

## 用户可见问题

进入视频后打开播放器设置，Quality 一行仍显示 **Auto (1080p HD)**，即使 Auto 当前恰好解码 1080P。用户要求进入任何视频都明确选择固定 1080P，不允许保留 Auto，包括直播、回放和普通上传视频。

## 根因

在真实 Edge（155.0.4283.62，播放器资源 `0229cd64`）中用离线 fixture 与目标视频复现：

1. **用户打开设置面板后，脚本无限等待。** 旧 `prepareNativeSelection()` 在 `.ytp-settings-shown` / `aria-expanded=true` 时直接 `return { waiting: true }`，注释为“用户已打开设置，不替换其面板”。用户为了检查画质而打开设置，恰好触发了这个等待；面板不关闭，脚本就不会选择。真实页面观测到 `phase=waiting` 超过 16 秒、Quality 仍为 Auto；关闭面板后才应用 1080P。
2. **首选值确认存在假阳性。** `getPreferredQuality()` 可能返回 `hd1080`，而原生 Settings 摘要仍显示 Auto。旧逻辑据此进入 `applied` 并停止，用户界面仍保留 Auto。2.2.0 文档已记录该接口不能证明菜单退出 Auto，但没有把 UI 状态纳入判定。
3. **手动 Auto 是终态。** `yieldToUser()` 对任意画质选项（包括 Auto）设置 `manualOverride` 并 `finish('manual')`，之后不再写入。这与用户“不允许出现 Auto”的新要求冲突。

## 修复

- **打开面板不再阻塞**：记录 `userPanel`，复用用户已打开的面板，通过 `openSettingsMenuItem('menu_item_video_quality_advanced')` 切换到画质列表并选择；只对脚本自己打开的面板使用临时隐藏、关闭和焦点恢复。用户面板不关闭、不隐藏、不抢焦点。
- **原生 UI 校验**：原生点击后延迟 1 秒，同时读取 `getPreferredQuality()`、主菜单 Quality 摘要（如 `Auto (1080p HD)` / `1080p HD`）和画质子菜单 `aria-checked` 项。任一仍为 Auto / 错误档位就重新准备并点击，最多 3 次；全部无法读取时才回退到首选值。
- **摘要识别防误判**：只接受精确 `Auto` / `自动`（可带分辨率括号）或 `NNNp` 分辨率文本，避免把字幕 `Auto-translate` 当成 Quality 行。新增 fixture 干扰项回归。
- **Auto 拒绝**：手动 Auto 不建立 `manual` 终态；清除当前终态、重置原生尝试次数并重新应用固定档位，约 1 秒后再次选择。手动固定档位仍保留原有保护。
- **重新应用命令**：顺手修正 `reapplyCurrent()` 未重置 `nativeAttempts` 的问题，避免此前用完 3 次尝试后重新应用仍无法再试。

## 验证

离线：

```sh
node --check youtube-default-quality.user.js
node --test tests/youtube-default-quality.test.cjs   # 127/127
npm test                                             # 146/146
```

新增回归：

- 用户设置面板保持打开时仍完成固定选择。
- 原生摘要仍显示 Auto 时不进入 `applied`，并进行有限重试。
- 摘要延迟 500ms 更新时，1 秒确认窗口仍成功且不重复点击。
- 手动 Auto 被拒绝并重新应用固定档位（含无 URL 视频 ID 的页面）。
- 重新应用命令重置原生尝试额度。
- `Auto-translate` 字幕内容不被当成 Quality 摘要。

真实页面（同一视频、Edge 155.0.4283.62、播放器 `0229cd64`）：

- 从 0.8 秒起保持设置面板打开：约 6 秒内原生画质子菜单勾选 **1080p HD**，`getPreferredQuality()=hd1080`，状态 `applied`；关闭面板后摘要显示 `1080p HD`。
- 随后手动点击 Auto：0.5 秒内摘要变为 `Auto (1080p HD)`；约 6 秒内恢复 `1080p HD`，`manualOverride=false`，状态 `applied`。
- 页面无脚本异常；设置面板打开期间脚本不关闭、不抢焦点。

## 未验证与边界

- 真实页面验证集中在用户报告的单个直播回放视频；未逐一实测所有直播、广告组合、移动端、TV、Music 与账号实验。离线回归只证明状态机，不证明 YouTube 内部接口永久有效。
- 若 YouTube 的原生摘要和勾选状态长期不更新、而 `getPreferredQuality()` 已固定，脚本会在 3 次尝试后警告并停止；这种情况下无法仅靠前端 DOM 强制界面退出 Auto。可用 **重新应用画质** 再次尝试，并向反馈附上控制台状态。
- 手动 Auto 被强制覆盖是 2.4.0 的明确行为；如果希望保留手动 Auto，需要停用脚本或后续增加配置开关。
- 选择固定档位后，YouTube 仍可能因网络 / 编码切换暂时显示较低分辨率；脚本不持续纠正 ABR 解码结果，只保证原生选择状态为固定档位。
