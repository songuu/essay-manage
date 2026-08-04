# Vue 3 插槽：用具名插槽与作用域插槽设计可扩展组件

适用范围：为 Vue 3 组件库、业务卡片、表格或布局容器设计可定制展示区域的场景；关键原则：子组件拥有结构与数据，父组件拥有插入的 UI；插槽用于组合展示，props 与 emits 用于数据和动作。本文以具名插槽、默认内容和作用域数据给出 script setup 时代的写法，并说明插槽不应成为隐式状态通道。

## 插槽解决的是“由谁渲染这块 UI”

组件 API 有两类常见扩展点：

- 固定输入与业务动作：用 props 和 emits，便于类型、测试和行为追踪。
- 调用方决定的局部展示：用 slot，让父组件在子组件结构中插入内容。

具名插槽适合 header、actions、empty 等稳定位置；默认插槽适合主要内容；作用域插槽让子组件把每行、每项的上下文交给父组件决定如何显示。插槽内容在父组件的作用域中执行，不能把它当作直接修改子组件内部状态的入口。

## 现代代码示例：一个可定制的数据面板

~~~vue
<!-- DataPanel.vue -->
<script setup lang="ts">
type Row = {
  id: string
  title: string
  status: 'draft' | 'published'
}

defineProps<{ rows: Row[] }>()
</script>

<template>
  <section class="data-panel">
    <header>
      <slot name="header">
        <h2>文章列表</h2>
      </slot>
    </header>

    <ul v-if="rows.length">
      <li v-for="(row, index) in rows" :key="row.id">
        <slot :row="row" :index="index">
          {{ row.title }}（{{ row.status }}）
        </slot>
      </li>
    </ul>

    <slot v-else name="empty">
      <p>暂无数据</p>
    </slot>

    <footer>
      <slot name="actions" />
    </footer>
  </section>
</template>
~~~

调用方用 #名称 声明具名插槽，用解构参数接收作用域数据：

~~~vue
<script setup lang="ts">
import { ref } from 'vue'
import DataPanel from './DataPanel.vue'

const rows = ref([
  { id: '1', title: '组合式 API', status: 'published' as const },
  { id: '2', title: '状态建模', status: 'draft' as const },
])
</script>

<template>
  <DataPanel :rows="rows">
    <template #header>
      <h2>我的文章</h2>
    </template>

    <template #default="{ row, index }">
      <strong>{{ index + 1 }}. {{ row.title }}</strong>
      <span>{{ row.status }}</span>
    </template>

    <template #actions>
      <button type="button">新建文章</button>
    </template>
  </DataPanel>
</template>
~~~

默认内容是组件 API 的一部分：它保证调用方不传 slot 时仍有合理的可访问、可理解的界面。

## 设计插槽 API 的边界

插槽名称应稳定且有业务语义，例如 actions、summary、empty；不要为每个细碎 DOM 元素开一个插槽，否则组件结构难以演进。作用域数据也应最小化，只暴露调用方渲染所需的 row、index 或格式化结果，不泄露内部可变实现。

需要让父组件控制子组件行为时，优先 emit 明确事件。需要跨层复用业务逻辑时，抽取 composable。需要全局协调数据时，再考虑 Pinia 或其他状态方案。插槽是 UI 组合工具，不是状态管理机制。

## 常见误区与检查点

- 不要用 slot 替代 props：固定文本、禁用状态、尺寸等简单输入应使用明确的 props。
- 不要让 slot 内容修改共享对象来驱动子组件；这样很难判断写入者与更新顺序。
- 列表中的 slot 仍需稳定 key，key 应来自领域标识而不是数组下标。
- 没有内容时应提供默认 empty UI 或明确要求调用方提供，避免白屏与无障碍信息缺失。
- 复杂 slot API 要补渲染测试：默认内容、具名内容、作用域数据、空列表和异常数据都应覆盖。

## 官方参考

- [Vue：插槽](https://vuejs.org/guide/components/slots.html)
- [Vue：组件 Props](https://vuejs.org/guide/components/props.html)
- [Vue：组件事件](https://vuejs.org/guide/components/events.html)
- [Vue：Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
