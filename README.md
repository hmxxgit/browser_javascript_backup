# 浏览器 JavaScript 脚本

使用 Tampermonkey 为网页添加个人定制功能。

## 安装

1. 打开 [Tampermonkey 官网](https://www.tampermonkey.net/)，选择浏览器并安装扩展。
2. 点击下表的 **直接安装**，在 Tampermonkey 页面点击 **安装**。
3. 打开或刷新对应网站，确认脚本已启用。

如果扩展提示缺少运行权限，按其提示开启“允许用户脚本”；详见 [官方说明](https://www.tampermonkey.net/faq.php#Q209)。

## 脚本

| 脚本 | 用途 | 复制源码 | 安装 |
| --- | --- | --- | --- |
| ChatGPT Custom UI | 调整 ChatGPT 的页面宽度、字体和颜色；点击正文隐藏输入框、鼠标靠近底部显示；提供滚动箭头、右上角按钮悬停显示和鼠标静止隐藏。 | [📋 查看并复制源码](https://github.com/hmxxgit/browser_javascript_backup/blob/main/chatgpt-custom-ui.user.js) | [直接安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/chatgpt-custom-ui.user.js) |

**手动复制安装：** 打开源码链接，点击源码区域右上角的复制按钮；在 Tampermonkey 中选择“添加新脚本”，删除默认内容，粘贴完整源码并保存。README 中的链接用于打开源码页，复制操作使用 GitHub 自带的按钮。

## 使用与更新

- **修改配置：** 在 ChatGPT 页面点击 Tampermonkey 图标 → “自定义配置” → 修改设置 → “保存并刷新”。颜色需要勾选“启用”。
- **获取更新：** 在 Tampermonkey 管理面板检查脚本更新。脚本的 `@updateURL` 和 `@downloadURL` 已指向本仓库，安装后从这里获取新版。
- **从旧 Gist 迁移：** 更新旧脚本到 v1.4.49，或点击上方“直接安装”更新现有脚本；之后刷新 ChatGPT。保留了原脚本名称和命名空间，以便识别为同一个脚本并沿用配置。
