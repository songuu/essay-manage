# Vue 3 nextTick：只在需要更新后 DOM 时等待

适用范围：Vue 3 Composition API 中需要在响应式状态变更后聚焦元素、读取布局或滚动容器的场景；关键原则：nextTick 等待的是 Vue 已排队的 DOM 更新，不是网络、动画或任意异步任务。本文用 script setup 展示安全用法，并说明何时应改用模板、watch 的 flush 选项或生命周期钩子。

## 为什么状态已改，DOM 还没变

Vue 会合并同一轮同步代码中的响应式变更，再统一更新 DOM。这能避免一次用户操作触发多次无意义渲染，也意味着下面的赋值后立刻读取由 v-if 创建的元素，可能读到旧 DOM 或空引用。

nextTick 返回一个 Promise；在状态变更后等待它，可以在本轮组件 DOM 更新完成后继续操作。它不保证图片加载、CSS 过渡结束、子系统请求完成，也不应该被用作掩盖数据流问题的延迟工具。

## 现代代码示例：打开编辑器后聚焦输入框

~~~vue
<script setup lang="ts">
import { nextTick, ref } from 'vue'

const editing = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)

async function openEditor() {
  editing.value = true
  await nextTick()
  titleInput.value?.focus()
}

function closeEditor() {
  editing.value = false
}
</script>

<template>
  <button v-if="!editing" type="button" @click="openEditor">
    编辑标题
  </button>

  <section v-else>
    <label>
      标题
      <input ref="titleInput" type="text">
    </label>
    <button type="button" @click="closeEditor">完成</button>
  </section>
</template>
~~~

这里等待的原因很具体：输入框由 v-if 创建，只有更新后的 DOM 才能聚焦。若元素始终存在且只改变样式，通常不需要 nextTick。

## 响应数据后滚动：考虑 post-flush watcher

当操作由某个响应式值变化驱动，并且必须读取更新后的列表尺寸时，用 post-flush watcher 可以让时机与意图写在一起。

~~~vue
<script setup lang="ts">
import { ref, watch } from 'vue'

type Message = { id: string; body: string }

const messages = ref<Message[]>([])
const messageList = ref<HTMLElement | null>(null)

watch(
  messages,
  () => {
    const element = messageList.value
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  },
  { flush: 'post', deep: true },
)

function appendMessage(body: string) {
  messages.value.push({ id: crypto.randomUUID(), body })
}
</script>

<template>
  <div ref="messageList" class="message-list">
    <p v-for="message in messages" :key="message.id">{{ message.body }}</p>
  </div>
  <button type="button" @click="appendMessage('你好')">添加消息</button>
</template>
~~~

这个例子要注意：deep watch 适合确实需要观察数组内部变动的场景；如果能以不可变方式替换数组，或只监听长度、最后一项等更小的依赖，更新范围会更清晰。

## 与其他时机工具的边界

- 初次挂载后的 DOM 初始化，使用 onMounted；无需为了“确保页面准备好”而在每处套 nextTick。
- 仅计算展示数据时，使用 computed 或模板表达式；它们不需要等待 DOM。
- 监听明确的输入变化时，使用 watch；自动收集多个响应式读取时，可使用 watchEffect，并注册必要的清理。
- 需要等待图片、字体、过渡或远程数据时，监听对应的 load、transitionend、请求 Promise 或组件状态，而非把 nextTick 当通用等待器。
- 服务端渲染没有浏览器 DOM，访问元素引用必须位于客户端可执行的边界。

## 常见误区与检查点

- 连续多次调用 nextTick 通常说明状态更新和 DOM 操作没有被组织在同一处，应先收敛交互逻辑。
- 在模板尚未渲染的条件分支上使用非空断言，容易在权限、加载或异常分支中出错；应保留空值处理。
- 不要在更新后的 DOM 回调中再次无条件修改同一响应式来源，否则可能造成循环更新。
- nextTick 只保证 Vue 的当前更新队列已刷新。第三方组件的内部异步渲染需要按其公开 API 协调。
- 读取布局可能触发浏览器工作；批量读写、避免无谓的滚动和测量比单纯等待更重要。

## 官方参考

- [Vue：nextTick API](https://vuejs.org/api/general.html#nexttick)
- [Vue：生命周期钩子](https://vuejs.org/guide/essentials/lifecycle.html)
- [Vue：侦听器](https://vuejs.org/guide/essentials/watchers.html)
- [Vue：模板引用](https://vuejs.org/guide/essentials/template-refs.html)
