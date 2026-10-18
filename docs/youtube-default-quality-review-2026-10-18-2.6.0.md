# YouTube 默认画质 2.6.0 复查与修复

日期：2026-10-18（Asia/Shanghai）。审查基线：`a4ac3369ee9b554b346638cac35b8573a8f3a14f`（2.5.1）。用户要求：不允许出现 Auto；即使 Auto 当前解码 1080P，也必须在后台切换到固定 1080P；并把前端画质列表里的 Auto 选项删除。

## 实现

- **删除用户可见画质列表中的 Auto**：新增 `stripAutoOptions()`，只移除 `.ytp-quality-menu` 内 `role="menuitemradio"` 且标签为 Auto/自动等的项，保留 2160p / 1440p / 1080p / 720p 等固定档位。
- **打开设置时立即处理**：在 `document` 冒泡阶段监听可信点击；此时 YouTube 自己的齿轮处理已经完成，面板已展开。排队微任务扫描并删除 Auto，避免在类名切换前空跑。
- **菜单异步重建**：对 `.ytp-settings-menu` 安装 scoped `MutationObserver`，画质子菜单异步生成/重建时再次删除 Auto；观察范围仅设置菜单，不是整个页面。
- **不碰脚本自己的隐藏菜单**：准备期间播放器带 `data-yt-default-quality-preparing`，扫描跳过；选择完成且用户面板仍打开时再移除其中的 Auto。
- **保留 Auto 拒绝逻辑**：其他播放器表面、旧菜单或程序化触发仍会重新应用固定档位；现在用户正常界面已无法主动选择 Auto。

## 验证

离线：

```sh
node --check youtube-default-quality.user.js
node --test tests/youtube-default-quality.test.cjs   # 129/129
npm test                                             # 148/148
```

新增回归 `the user-facing quality list has no Auto option`：打开设置后断言 Auto 项不存在，固定档位仍在。

真实页面（Edge 155.0.4283.62，用户报告视频 `nPdqduzfI3c&t=31162s`，播放器 `0229cd64`）：

- 固定选择完成后打开设置并进入 Quality：列表为 **2160p 4K / 1440p HD / 1080p HD（勾选）/ 720p / 480p / 360p / 240p / 144p**，**没有 Auto**。
- `getPreferredQuality()=hd1080`，`state.phase=applied`；本次验证现场截图已核对。
- 正常观看和模拟残留 `aria-expanded` 时，脚本仍不会自动弹出画质列表；用户自己打开设置才会看到列表（已无 Auto）。

## 边界

- 删除 Auto 是用户明确要求的破坏性 UI 改动；脚本启用时无法在画质菜单里回到 Auto。需要 Auto 时请临时停用脚本。
- 移除依赖 YouTube 的 `.ytp-quality-menu` / `role="menuitemradio"` 结构；网站改版后可能需要调整。
- 主菜单的 Quality 摘要仍由 YouTube 原生状态更新；极早的启动阶段可能短暂显示旧值，脚本会在选择后与 1.5 / 3 秒复查中纠正。
- 真实检查集中在单个直播回放；未覆盖所有账号实验、移动端、TV、广告组合。
