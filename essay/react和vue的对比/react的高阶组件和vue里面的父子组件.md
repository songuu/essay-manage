# React 高阶组件与 Vue 父子组件：先分清“复用方式”和“树关系”

适用范围：需要在 React 与 Vue 3 之间迁移或评审组件架构的前端团队；关键原则：高阶组件是 React 中包装组件的复用模式，父子组件是两种框架共有的组件树关系，二者不应被当作同义词。本文以函数组件、Hooks、Vue 3 的 props、emits、slots 与 composable 展示可维护的做法，并说明包装层、插槽和事件边界的常见误区。

## 两个概念解决的问题不同

父子组件描述的是 UI 树：上层向下层传入数据，下层通过显式回调或事件表达意图。React 与 Vue 都有这一关系。

高阶组件（HOC）则是一个接收组件、返回新组件的模式。它曾常用于横切能力，例如权限、埋点或第三方适配。它不是“React 的父子组件”，也不是 Vue 插槽的对应物。现代 React 默认更偏向于组合、render props 或自定义 Hook；现代 Vue 默认使用 props、emits、slots 与 composable。选择应由数据所有权和复用边界决定，而不是由框架标签决定。

## React：先用组合和 Hook 表达需求

下面的权限门是普通组件组合：调用方清楚地看到受保护的内容在哪里，权限逻辑也能集中测试。

~~~tsx
import { createContext, useContext, type ReactNode } from 'react'

type PermissionContextValue = {
  can: (action: string) => boolean
}

const PermissionContext = createContext<PermissionContextValue | null>(null)

export function PermissionProvider({
  can,
  children,
}: {
  can: PermissionContextValue['can']
  children: ReactNode
}) {
  return <PermissionContext.Provider value={{ can }}>{children}</PermissionContext.Provider>
}

function usePermission() {
  const value = useContext(PermissionContext)
  if (!value) throw new Error('PermissionGate 必须位于 PermissionProvider 内')
  return value
}

export function PermissionGate({
  action,
  fallback = null,
  children,
}: {
  action: string
  fallback?: ReactNode
  children: ReactNode
}) {
  const { can } = usePermission()
  return can(action) ? <>{children}</> : <>{fallback}</>
}

function ArticleToolbar() {
  return (
    <PermissionGate action="article:edit" fallback={<span>只读</span>}>
      <button type="button">编辑文章</button>
    </PermissionGate>
  )
}

export function ArticleToolbarExample() {
  const can = (action: string) => action === 'article:edit'

  return (
    <PermissionProvider can={can}>
      <ArticleToolbar />
    </PermissionProvider>
  )
}
~~~

确实需要适配一个不能修改调用点的旧接口或第三方组件时，HOC 仍然可用，但应在模块顶层创建，并透传 props。

~~~tsx
import type { ComponentType } from 'react'

export function withAudit<P extends object>(Component: ComponentType<P>) {
  return function AuditedComponent(props: P) {
    return <Component {...props} />
  }
}
~~~

不要在另一个组件的渲染过程中临时调用 withAudit；那会改变组件身份，使内部状态反复重置。若复用的是状态逻辑而不是组件外形，优先抽成自定义 Hook。

## Vue 3：props、emits、slots 与 composable 各司其职

子组件接收只读输入，以 emit 表达用户动作；父组件决定如何更新业务状态。具名插槽让父组件扩展展示区域，而无需让子组件知道具体按钮。

~~~vue
<!-- AuthorPanel.vue -->
<script setup lang="ts">
type Author = { id: string; name: string; following: boolean }

const props = defineProps<{ author: Author }>()
const emit = defineEmits<{ follow: [authorId: string] }>()
</script>

<template>
  <section>
    <h2>{{ props.author.name }}</h2>
    <slot name="actions">
      <button
        type="button"
        :disabled="props.author.following"
        @click="emit('follow', props.author.id)"
      >
        {{ props.author.following ? '已关注' : '关注' }}
      </button>
    </slot>
  </section>
</template>
~~~

~~~vue
<!-- 父组件 -->
<script setup lang="ts">
import { ref } from 'vue'
import AuthorPanel from './AuthorPanel.vue'

const author = ref({ id: 'a-1', name: '林然', following: false })

function follow(authorId: string) {
  if (author.value.id === authorId) author.value.following = true
}
</script>

<template>
  <AuthorPanel :author="author" @follow="follow">
    <template #actions>
      <button type="button" @click="follow(author.id)">立即关注</button>
    </template>
  </AuthorPanel>
</template>
~~~

当多处组件需要同一份可复用状态逻辑时，将其提取为 composable；当只是父子间一次性的展示扩展时，slot 往往更直接。

## 常见误区与边界

- 不要把 HOC、组件嵌套、Context 和全局状态当成同一类工具。它们分别处理组件包装、UI 树、跨层依赖和共享状态。
- 子组件不应直接修改传入对象来“省一次事件”；这会破坏数据来源的可追踪性。
- slot 适合由父组件控制展示，不适合替代清晰的业务事件。用户动作仍应以 props 回调或 emit 表达。
- 包装组件会增加调试栈和 props 透传成本；能用显式组合解决时，可读性通常更好。
- 无论 React 还是 Vue，都应把网络请求、权限判定失败和加载态作为可见状态处理，而不是只渲染成功分支。

## 官方参考

- [React：通过 props 向组件传递数据](https://react.dev/learn/passing-props-to-a-component)
- [React：使用自定义 Hook 复用逻辑](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Vue：组件 Props](https://vuejs.org/guide/components/props.html)
- [Vue：组件事件](https://vuejs.org/guide/components/events.html)
- [Vue：插槽](https://vuejs.org/guide/components/slots.html)
- [Vue：Composable](https://vuejs.org/guide/reusability/composables.html)
