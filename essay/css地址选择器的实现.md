# 使用 :target 创建基于地址片段的演示状态

适用范围：无脚本的页面内跳转、演示性主题切换和可分享的局部状态；关键原则：URL 片段决定唯一目标元素，CSS 只根据该目标表现状态；当前代码示例：下面用 :target 和 :has() 改变预览区颜色；常见误区/边界：它不适合需要持久化、复杂交互或完整无障碍语义的应用状态；官方参考：[MDN :target](https://developer.mozilla.org/zh-CN/docs/Web/CSS/Reference/Selectors/:target)。

URL 中井号后的片段会定位到同 id 的元素，:target 选择器能匹配该元素。浏览器的前进、后退和刷新都会保留这种状态，因此它很适合文档页面的轻量演示。

## 一个可直接打开的示例

~~~html
<nav class="theme-switcher" aria-label="主题演示">
  <a id="theme-light" href="#theme-light">浅色</a>
  <a id="theme-dark" href="#theme-dark">深色</a>
</nav>

<main class="preview">
  <h1>预览内容</h1>
  <p>地址片段改变时，这个区域会随之改变。</p>
</main>
~~~

~~~css
.preview {
  padding: 2rem;
  color: #172033;
  background: #f5f7fb;
  transition: color 160ms ease, background 160ms ease;
}

.theme-switcher:has(#theme-dark:target) ~ .preview {
  color: #f5f7fb;
  background: #172033;
}

.theme-switcher:has(#theme-light:target) ~ .preview {
  color: #172033;
  background: #f5f7fb;
}
~~~

这里的 :has() 用来根据导航中被定位的链接修改后面的兄弟预览区。只需要页面内跳转时，也可以直接对目标章节使用 :target，而不必引入脚本。

## 使用边界

片段不会请求服务器，也不应该保存认证、隐私或业务数据。链接目标、焦点位置和视觉状态应保持可理解；若用户需要真正的选中状态、键盘交互、持久化偏好或屏幕阅读器通知，应使用语义化控件和应用状态，而不是仅靠 CSS。

在采用 :has() 前检查目标浏览器支持范围；不支持时可将预览内容设计成默认可读，或退回到只高亮目标元素的 :target 方案。
