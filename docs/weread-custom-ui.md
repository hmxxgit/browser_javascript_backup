# 微信读书阅读样式：DOM 与验证记录

以下结构来自 2026-11-03 在 Microsoft Edge 打开的微信读书网页版一本可重排书籍的实际阅读页。它是观察结果，不保证其他书籍格式或未来版本完全相同；下方没有记录书籍正文、账号信息或阅读数据。

## 页面结构

纵向滚动阅读时，观察到的主要层级为：

```text
#routerView
└─ .readerContent
   ├─ .app_content
   │  └─ .wr_various_font_provider_wrapper
   │     └─ .readerChapterContent
   │        ├─ .preRenderContainer
   │        │  └─ #preRenderContents.preRenderContent
   │        │     └─ div > h2.secondTitle、p.content、div.qrbodyPic
   │        │        └─ 文字由许多 span 包裹
   │        └─ .renderTargetContainer
   │           ├─ .wr_canvasContainer > canvas
   │           └─ #renderTargetContent > … > .passage-content
   │              └─ span[data-wr-role="text"]（绝对定位）
   └─ .readerControls（固定定位）
```

双栏阅读时，观察到的结构为：

```text
.wr_horizontalReader
└─ .wr_horizontalReader_app_content
   └─ .wr_various_font_provider_wrapper
      └─ .readerChapterContent_container
         └─ .readerChapterContent
            ├─ #preRenderContainer.preRenderContainer
            │  └─ #preRenderContent.preRenderContent
            ├─ .renderTargetContainer > … > .wr_canvasContainer > canvas
            └─ .readerControls（相对章节容器绝对定位）
```

预排版节点在纵向模式中只在布局期间短暂存在；最终文字可能位于 `#renderTargetContent` 的绝对定位 `span`，也可能显示在画布上。双栏模式实测左右各有一个画布。不能仅修改最终文字层的 `line-height`，因为字的坐标已经由网站排版计算出来。

## 脚本如何使用这些节点

- 脚本在 `document-start` 注入样式，将字号和行距作用于 `.readerChapterContent .preRenderContent` 及正文块，供网站自己的排版过程读取。段内元素保留书籍自身的字号格式；标题保留原书的相对字号。
- 纵向正文宽度作用于 `.readerContent > .app_content` 和章节边距；双栏宽度作用于 `.wr_horizontalReader .readerChapterContent`。两种模式的工具栏位于不同父节点，因此分别限定选择器。
- 自定义文字色在预排版阶段应用，让网站绘制的画布也使用该颜色；背景色应用于实测的阅读器容器。保存设置后刷新，由网站重新排版。

## 实机检查

在上述真实阅读页中，分别切换纵向和双栏，并设置正文宽度 `1100px`、字号 `26px`、行高 `2.4`：

- 两种模式下捕获的 `p.content` 计算样式均为 `26px / 62.4px`；纵向最终文字层相邻正文行的纵坐标差为 62 或 63 像素。
- 纵向章节容器实测宽 `1100px`；双栏容器含边框约 `1102px`，工具栏位于章节容器右侧。
- 自定义背景 `#f6ecd7`、文字 `#564322` 后，预排版文字颜色和两种模式的可见正文均按所选配色显示。
- 临时用于采样结构的浏览器代码不会随正式脚本发布。

自动化测试采用按上述层级简化、替换正文后的离线 DOM 样例，检查 CSS 作用范围、段内相对字号、两种工具栏位置和设置保存。样例不模拟微信读书的排版或画布引擎，实际渲染效果依赖上述浏览器实测。

PDF、图片型书籍或具有不同内部结构的书籍未在此次实机检查中覆盖。
