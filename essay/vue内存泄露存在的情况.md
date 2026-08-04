# Vue 3 内存泄漏排查：清理组件之外仍持有的资源

适用范围：Vue 3 组件会频繁进入、离开或被缓存，且使用定时器、浏览器事件、观察器、订阅、请求或第三方实例的应用；关键原则：组件卸载后，外部系统不应继续持有它的回调、DOM 或业务数据。本文用 onMounted、onUnmounted 与 watcher 清理示例说明资源所有权，并列出 KeepAlive 和异步竞态的边界。

## 什么情况下会真正泄漏

浏览器会回收没有引用的组件数据。问题通常不在 Vue 的响应式对象本身，而在组件以外仍保留引用：

- window、document 或全局对象上的事件监听器没有移除。
- setInterval、setTimeout、requestAnimationFrame 或 Web Worker 持续运行。
- ResizeObserver、IntersectionObserver、WebSocket、可观察流或编辑器订阅未停止。
- 图表、地图、播放器等第三方实例仍持有 DOM 节点和回调。
- 旧请求或异步任务返回后继续写入已不相关的状态，造成竞态、报错或无效工作。
- 被 KeepAlive 缓存的组件没有卸载，却继续执行本应暂停的任务。

先画出“谁创建、谁清理”的对应关系。创建者应在同一模块中保留清理函数，避免由不相关的组件猜测如何释放资源。

## 现代代码示例：浏览器资源与组件卸载成对管理

~~~vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const panel = ref<HTMLElement | null>(null)
const width = ref(0)

let observer: ResizeObserver | undefined
let timerId: number | undefined

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') console.log('关闭面板')
}

onMounted(() => {
  observer = new ResizeObserver((entries) => {
    width.value = entries[0]?.contentRect.width ?? 0
  })

  if (panel.value) observer.observe(panel.value)
  window.addEventListener('keydown', onKeydown)
  timerId = window.setInterval(() => console.log('刷新状态'), 30_000)
})

onUnmounted(() => {
  observer?.disconnect()
  window.removeEventListener('keydown', onKeydown)
  if (timerId !== undefined) window.clearInterval(timerId)
})
</script>

<template>
  <section ref="panel">当前宽度：{{ width }}</section>
</template>
~~~

异步订阅或请求也应在依赖变化时清理，而不只是在组件卸载时清理：

~~~ts
import { ref, watch } from 'vue'

const articleId = ref('a-1')
const articleTitle = ref('')

watch(
  articleId,
  (id, _previousId, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())

    void fetch('/api/articles/' + encodeURIComponent(id), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('加载文章失败：' + response.status)
        return response.json() as Promise<{ title: string }>
      })
      .then((article) => {
        articleTitle.value = article.title
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error(error)
      })
  },
  { immediate: true },
)
~~~

## 第三方实例与缓存组件

第三方库通常有自己的 destroy、dispose、disconnect 或 unsubscribe API。创建实例后立刻把清理函数保存下来；不要仅移除容器 DOM，就假设内部监听器会被释放。

被 KeepAlive 缓存的页面不会每次切换都卸载。对应该暂停的轮询、媒体或订阅，使用 onActivated 与 onDeactivated 表达暂停和恢复；真正释放资源仍放在 onUnmounted。是否缓存由产品体验决定，不能把缓存当作“不会有清理需求”。

## 排查与验证方法

1. 复现进入、离开、切换参数和重复打开的路径，确认资源数量是否随次数增长。
2. 在创建和清理处记录可识别的调试信息，核对一一配对；不要只观察页面视觉是否正常。
3. 使用浏览器性能与内存工具查看保留对象的引用链，定位是哪一个全局监听、闭包或实例仍在持有它。
4. 为关键 composable 写测试，断言停止函数、AbortController 或订阅清理在变更和卸载时执行。
5. 将网络失败、取消和组件缓存路径一起覆盖，避免只在成功流程中验证。

## 常见误区与边界

- 只在页面刷新时资源归零，不代表路由切换时没有泄漏。
- 单纯给回调加布尔标记能阻止写入，却不能停止网络、计时器或订阅；优先调用实际取消 API。
- 不要在清理函数中无条件写响应式状态；组件已经卸载时这通常没有业务意义。
- 如果资源由应用级单例创建，应由应用级生命周期负责释放，组件不应越权销毁其他页面仍在使用的实例。
- 服务端渲染没有 window 和 DOM，浏览器资源必须在客户端挂载后创建。

## 官方参考

- [Vue：生命周期钩子](https://vuejs.org/guide/essentials/lifecycle.html)
- [Vue：侦听器与副作用清理](https://vuejs.org/guide/essentials/watchers.html)
- [Vue：KeepAlive](https://vuejs.org/guide/built-ins/keep-alive.html)
- [Vue：模板引用](https://vuejs.org/guide/essentials/template-refs.html)
