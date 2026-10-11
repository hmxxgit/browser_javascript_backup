# 浏览器 JavaScript 脚本

使用 Tampermonkey 为网页添加个人定制功能。

## 安装

1. 打开 [Tampermonkey 官网](https://www.tampermonkey.net/)，选择浏览器并安装扩展。
2. 点击下表的 **直接安装**，在 Tampermonkey 页面点击 **安装**。
3. 打开或刷新对应网站，确认脚本已启用。

如果扩展提示缺少运行权限，按其提示开启“允许用户脚本”；详见 [官方说明](https://www.tampermonkey.net/faq.php#Q209)。

## 脚本

| 脚本 | 用途 | 源码 | 安装 |
| --- | --- | --- | --- |
| ChatGPT Custom UI | 调整 ChatGPT 的页面宽度、字体和颜色；点击正文隐藏输入框、鼠标靠近底部显示；提供滚动箭头、右上角按钮悬停显示和鼠标静止隐藏。 | [查看源码](https://github.com/hmxxgit/browser_javascript_backup/blob/main/chatgpt-custom-ui.user.js) | [直接安装](https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/chatgpt-custom-ui.user.js) |

**手动安装：** 查看源码并复制，在 Tampermonkey 中“添加新脚本”，替换默认内容后保存。

## 使用与更新

- **修改配置：** 在 ChatGPT 页面点击 Tampermonkey 图标 → “自定义配置” → 修改设置 → “保存并刷新”。颜色需要勾选“启用”。
- **获取更新：** 在 Tampermonkey 管理面板检查脚本更新，新版从本仓库获取。
