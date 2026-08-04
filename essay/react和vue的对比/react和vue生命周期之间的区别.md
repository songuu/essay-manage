# React 与 Vue 的生命周期：以副作用边界取代一一对应表

适用范围：使用 React 函数组件或 Vue 3 Composition API 编写 DOM、订阅、请求与清理逻辑的项目；关键原则：渲染应保持纯粹，副作用在提交后的受控位置执行，并与依赖变化和卸载清理绑定。本文给出 useEffect、onMounted、onUnmounted、watch 与 watchEffect 的现代示例，同时指出二者不是可以机械换算的阶段名。

## 先理解各自的模型

React 的组件函数会在每次渲染时执行；提交 UI 后，Effect 用于同步外部系统。Effect 的返回函数会在依赖变化前和组件移除时执行清理。

Vue 的 setup 与 script setup 用于声明响应式状态和组件逻辑；组件挂载、更新、卸载分别有组合式钩子。watch 与 watchEffect 则用于响应数据变化，并可注册清理。两种模型都要求：不要在渲染阶段写入外部系统，不要把每个业务动作都塞进生命周期钩子。

| 目标 | React 常用位置 | Vue 3 常用位置 |
| --- | --- | --- |
| 声明状态和派生数据 | 组件函数、useState、useMemo | script setup、ref、computed |
| 订阅外部系统 | useEffect 返回清理函数 | onMounted / onUnmounted，或 watch 的清理 |
| 在视觉绘制前读取布局 | useLayoutEffect，谨慎使用 | 根据 DOM 更新时机选择 nextTick 或 post-flush watcher |
| 响应指定数据变化 | useEffect 的依赖数组 | watch |
| 自动跟踪读取到的响应式依赖 | 按 Effect 依赖显式声明 | watchEffect |

## React 示例：Effect 描述与聊天室连接的同步

~~~tsx
import { useEffect, useState } from 'react'

type Connection = {
  connect: () => void
  disconnect: () => void
}

declare function createRoomConnection(roomId: string): Connection

export function RoomStatus({ roomId }: { roomId: string }) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const connection = createRoomConnection(roomId)
    connection.connect()
    setConnected(true)

    return () => {
      connection.disconnect()
    }
  }, [roomId])

  return <p role="status">{connected ? '已连接' : '正在连接'}</p>
}
~~~

如果只是根据 props 计算文本或筛选列表，不应使用 Effect；在渲染中直接计算即可。请求、订阅、计时器等真正的外部同步才需要清理。

## Vue 3 示例：挂载资源与响应式请求

~~~vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{ articleId: string }>()
const title = ref('')
let stopKeyboardShortcuts: (() => void) | undefined

onMounted(() => {
  stopKeyboardShortcuts = registerKeyboardShortcuts()
})

onUnmounted(() => {
  stopKeyboardShortcuts?.()
})

watch(
  () => props.articleId,
  (articleId, _previousId, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())

    void fetch('/api/articles/' + encodeURIComponent(articleId), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('加载文章失败：' + response.status)
        return response.json() as Promise<{ title: string }>
      })
      .then((article) => {
        title.value = article.title
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error(error)
      })
  },
  { immediate: true },
)

function registerKeyboardShortcuts() {
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') console.log('关闭编辑器')
  }
  window.addEventListener('keydown', onKeydown)
  return () => window.removeEventListener('keydown', onKeydown)
}
</script>

<template>
  <h1>{{ title || '正在加载' }}</h1>
</template>
~~~

当回调本身读取多个响应式来源且无需区分新旧值时，watchEffect 更简洁；当请求由明确的 id、筛选条件或表单字段驱动时，watch 的依赖更清楚，也更便于审查。

## 常见误区与边界

- 不要将 React 的每一次渲染理解为一次“挂载”；组件函数会重复执行，副作用必须放在 Effect 中。
- Vue 的组件钩子和 watcher 不是业务流程调度器。由点击触发的保存请求应放在事件处理函数中。
- 不完整的依赖或没有清理的订阅会造成过期闭包、竞态和资源泄漏；应将取消逻辑与发起逻辑写在一起。
- 需要测量或操作更新后的 DOM 时，先确认是首次挂载、一次状态变更还是布局同步需求，避免以任意延迟碰运气。
- 服务端渲染期间没有浏览器 DOM；访问 window、document 或布局信息必须放在客户端可执行的边界中。

## 官方参考

- [React：Effect 的生命周期](https://react.dev/learn/lifecycle-of-reactive-effects)
- [React：useEffect](https://react.dev/reference/react/useEffect)
- [Vue：生命周期钩子](https://vuejs.org/guide/essentials/lifecycle.html)
- [Vue：侦听器](https://vuejs.org/guide/essentials/watchers.html)
- [Vue：Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
