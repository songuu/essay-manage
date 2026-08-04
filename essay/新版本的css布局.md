# 现代 CSS 布局：Grid、Flex 与逻辑属性

适用范围：响应式卡片、双向文字界面和固定操作按钮；关键原则：先用正常文档流安排结构，再按职责选择 Grid 或 Flex，并用逻辑属性适配书写方向；当前代码示例：下面的卡片网格使用 grid、gap 和 padding-inline；常见误区/边界：视觉重排不应破坏 DOM 阅读顺序，逻辑尺寸会随 writing-mode 改变含义；官方参考：[MDN CSS 布局](https://developer.mozilla.org/zh-CN/docs/Learn_web_development/Core/CSS_layout)。

Grid 适合二维轨道布局，Flex 适合一维对齐与分配空间。两者都应建立在正常流之上；绝对定位更适合与内容流无关的装饰或悬浮控件。

## 从物理方向改为逻辑方向

~~~css
.page {
  max-inline-size: 72rem;
  margin-inline: auto;
  padding-inline: clamp(1rem, 4vw, 3rem);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: clamp(0.75rem, 2vw, 1.5rem);
}

.card {
  display: grid;
  gap: 0.75rem;
  min-block-size: 12rem;
  padding: 1rem;
  border: 1px solid CanvasText;
  border-radius: 0.75rem;
}

.floating-action {
  position: fixed;
  inset-block-end: 1rem;
  inset-inline-end: 1rem;
}
~~~

inline 表示文本行方向，block 表示文本块方向。padding-inline、margin-block 和 inset-inline-end 在从右到左或纵向书写模式下仍表达布局意图；width 和 height 则是固定的物理方向。

## 选择布局工具

一行工具栏通常使用 Flex，并通过 gap 处理间距；需要同时控制行与列的内容区域使用 Grid。不要为了清除浮动或模拟列布局制造额外包装元素。旧的浮动仍适合让文字环绕图片，但不是页面主布局的首选。

在窄视口、放大文字、长单词和从右到左语言下检查布局。order、grid-area 等视觉重排会影响键盘阅读与屏幕阅读器的理解时，应调整 HTML 结构而不是只改显示位置。更多逻辑属性见 [MDN CSS 逻辑属性](https://developer.mozilla.org/zh-CN/docs/Web/CSS/Guides/Logical_properties_and_values)。
