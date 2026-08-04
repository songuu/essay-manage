# Vue 3 调试“数据变了，界面却没变”：从响应性到异步竞态

适用范围：Vue 3 页面出现列表未刷新、详情显示旧数据、条件分支不符合预期或组件状态错位时；关键原则：沿着“事件 → 响应式状态 → 派生值 → 模板 → DOM”逐段验证，并让异步请求可取消、列表身份稳定。本文给出基于 script setup 与 watch 清理的可复现修复模式，说明解构、key、条件渲染和 props 所有权等常见边界。

## 不先猜原因，先缩小断点

“界面没变”不是一个具体错误。先确认以下事实：

1. 触发事件是否执行，输入值是否符合预期。
2. 被模板读取的 ref 或 reactive 字段是否真的发生了变化。
3. computed、过滤逻辑或权限条件是否仍在使用旧输入。
4. 模板是否渲染了正确组件和正确的列表项身份。
5. 是否有较慢的旧请求在较新的请求之后返回并覆盖数据。

每次只记录必要的 id、状态和时间顺序。用最小数据与最短交互路径复现后，再检查组件、composable、Store 和服务端响应的边界；不要靠加入任意延迟让问题“消失”。

## 现代代码示例：避免详情请求的旧响应覆盖新页面

下面的组件把请求与 props.articleId 的变化绑定，并在下一次变更或组件卸载时取消旧请求。

~~~vue
<script setup lang="ts">
import { ref, watch } from 'vue'

type Article = {
  id: string
  title: string
  body: string
}

const props = defineProps<{ articleId: string }>()

const article = ref<Article | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

watch(
  () => props.articleId,
  (articleId, _previousId, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())

    loading.value = true
    error.value = null

    void fetch('/api/articles/' + encodeURIComponent(articleId), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('加载文章失败：' + response.status)
        return response.json() as Promise<Article>
      })
      .then((data) => {
        article.value = data
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        error.value = reason instanceof Error ? reason.message : '未知错误'
      })
      .finally(() => {
        if (!controller.signal.aborted) loading.value = false
      })
  },
  { immediate: true },
)
</script>

<template>
  <p v-if="loading">正在加载</p>
  <p v-else-if="error" role="alert">{{ error }}</p>
  <article v-else-if="article">
    <h1>{{ article.title }}</h1>
    <p>{{ article.body }}</p>
  </article>
</template>
~~~

没有取消逻辑时，快速切换文章可能让先发出的旧请求最后返回，视觉上就像 Vue “没有更新”。实际上是数据竞争覆盖了正确状态。

## 常见根因与对应检查

| 症状 | 优先检查 | 处理方向 |
| --- | --- | --- |
| 值打印正确，模板不更新 | 是否把 reactive 对象直接解构成普通变量 | 保留对象访问，或使用 toRefs |
| 修改后立即被改回 | 是否有 watcher、请求或 Store 写入同一状态 | 收敛写入者，记录写入来源 |
| 列表内容或输入框错位 | key 是否使用稳定领域 id | 使用实体 id，不用数组下标 |
| 元素不存在或引用为空 | 条件分支是 v-if，DOM 尚未创建 | 将 DOM 操作放到正确的更新后时机 |
| 组件未收到新输入 | props 名、emit 名或父级绑定是否一致 | 用类型声明约束组件接口 |
| 子组件改了值，上层又覆盖 | props 真值仍由父级拥有 | emit 领域动作，让父级更新真值 |

v-if 会创建与销毁分支，v-show 只改变显示样式；排查元素引用、焦点和内部状态时必须先确认选用的是哪一个。列表中稳定 key 也同样重要，它决定 Vue 如何复用已有 DOM 与组件实例。

## 把修复变成可验证行为

为问题建立一条回归用例：例如快速切换两个 articleId，控制第一个请求晚于第二个完成，断言最后页面仍显示第二篇文章。若问题涉及表单，再覆盖输入、取消、校验失败和重新打开组件的路径。测试的重点不是实现细节，而是用户可观察的正确状态。

如果错误来自第三方组件、浏览器 API 或服务端契约，保留错误上下文并划清边界：Vue 的响应式是否正确、请求是否被取消、接口是否按契约返回，应该分别验证。

## 常见误区与边界

- 不要用 setTimeout 作为通用修复；它掩盖时序问题，且在慢设备或快切换下仍会失败。
- 不要让多个 watcher、事件处理函数和 Store 动作无约束地写同一字段；每个真值应有清晰拥有者。
- 不要直接修改 props 或把请求响应写入派生 computed；这会破坏单向数据流。
- 不要只看控制台对象展开后的最终值；记录请求 id 与写入顺序，才能发现竞态。
- 组件渲染正确不代表接口正确。权限、空数据、错误码和缓存失效要单独验证。

## 官方参考

- [Vue：响应式基础](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
- [Vue：计算属性](https://vuejs.org/guide/essentials/computed.html)
- [Vue：侦听器与副作用清理](https://vuejs.org/guide/essentials/watchers.html)
- [Vue：列表渲染与 key](https://vuejs.org/guide/essentials/list.html)
- [Vue：条件渲染](https://vuejs.org/guide/essentials/conditional.html)
