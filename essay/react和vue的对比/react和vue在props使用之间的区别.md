# React 与 Vue 的 props：单向数据流下的输入、事件与双向绑定约定

适用范围：需要设计可复用 React 函数组件或 Vue 3 组件 API 的场景；关键原则：props 是调用方拥有的只读输入，子组件通过回调或 emits 表达意图，而不是直接改写输入。本文以受控搜索框展示两种现代写法，说明 v-model 的契约、对象引用和属性透传的边界。

## 共同点：数据向下，意图向上

React 与 Vue 都把 props 作为父级传给子级的输入。子组件应当根据 props 渲染，并通过一个明确的出口通知调用方：React 通常传入回调函数，Vue 通常声明 emit。这样状态归属始终可追踪，组件也能独立测试。

“只读”不只意味着不能重新赋值。若 props 是对象或数组，直接修改其中的字段仍会越过调用方的更新路径。应由拥有状态的一方创建下一份值，或由子组件发出描述操作的事件。

## React 示例：受控组件用回调表达变更

~~~tsx
import { useState } from 'react'

type SearchInputProps = {
  value: string
  onValueChange: (nextValue: string) => void
  disabled?: boolean
}

export function SearchInput({
  value,
  onValueChange,
  disabled = false,
}: SearchInputProps) {
  return (
    <label>
      搜索文章
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </label>
  )
}

export function ArticleSearchPage() {
  const [query, setQuery] = useState('')

  return <SearchInput value={query} onValueChange={setQuery} />
}
~~~

回调名应描述领域动作而非技术细节，例如 onPublish、onRemove 或 onValueChange。不要假设 key 会作为普通 props 传入；列表 key 仅供 React 协调同级元素身份使用。

## Vue 3 示例：显式实现 v-model 契约

Vue 的默认 v-model 是 modelValue prop 与 update:modelValue 事件的语法糖。组件内部仍然保持单向流：输入变动时 emit，父组件更新自己的 ref 后再把新值传回。

~~~vue
<!-- SearchInput.vue -->
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  emit('update:modelValue', input.value)
}
</script>

<template>
  <label>
    搜索文章
    <input
      :value="props.modelValue"
      :disabled="props.disabled"
      @input="onInput"
    >
  </label>
</template>
~~~

~~~vue
<!-- 父组件 -->
<script setup lang="ts">
import { ref } from 'vue'
import SearchInput from './SearchInput.vue'

const query = ref('')
</script>

<template>
  <SearchInput v-model="query" />
</template>
~~~

一个组件需要多个可双向绑定的字段时，应让每个字段名和更新事件都表达业务含义，并在文档中说明默认值、空值和异步失败行为。

## 属性设计的边界

React 的 children 是普通 props，适合让调用方提供嵌入内容；Vue 的 slot 是与之相近但模板化的组合入口。两者都不等于共享状态：跨层共享应使用 Context、provide/inject 或明确的状态容器。

Vue 中未被声明的属性可能落到根元素，组件有多个根节点或需要精确控制透传时应明确设计属性归属。React 中 rest props 也不应不加筛选地转发给 DOM，尤其是内部业务字段、无效属性和事件处理函数。

## 常见误区与检查点

- 不要为了“方便”直接修改对象型 props；改用回调或 emit，让上层拥有写入权。
- 不要为每个输入都建立本地副本。只有编辑草稿、延迟提交或可撤销交互确实需要时，才维护本地状态并说明与外部值同步的规则。
- 避免把函数 props 或 emits 设计成含糊的 change；优先传递具体领域动作和必要数据。
- 将 props 解构为普通变量时，要确认响应性语义与项目编译配置一致；跨配置复用的组件可保留 props 访问或使用 toRefs。
- 无障碍标签、禁用状态、错误提示和输入法组合输入也是组件 API 的一部分，应在交互测试中覆盖。

## 官方参考

- [React：通过 props 向组件传递数据](https://react.dev/learn/passing-props-to-a-component)
- [React：在组件之间共享状态](https://react.dev/learn/sharing-state-between-components)
- [Vue：组件 Props](https://vuejs.org/guide/components/props.html)
- [Vue：组件事件](https://vuejs.org/guide/components/events.html)
- [Vue：组件 v-model](https://vuejs.org/guide/components/v-model.html)
