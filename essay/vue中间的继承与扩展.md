# Vue 3 的复用与扩展：组合优于组件继承

适用范围：Vue 3 项目需要复用分页、表单、权限、DOM 行为或可扩展布局时；关键原则：按复用对象选择纯函数、composable、组件加 slots、provide/inject 或自定义指令，让依赖和数据流显式可见。本文给出分页 composable、布局插槽和局部指令示例，并说明何时不应把业务状态隐藏在复用层中。

## 先选择正确的复用层

“复用”不应默认等于让一个组件从另一个组件派生。不同问题有不同的稳定边界：

| 要复用的内容 | 合适方式 | 典型场景 |
| --- | --- | --- |
| 无状态计算 | 普通函数 | 日期格式化、金额计算 |
| 带响应式状态与清理的行为 | composable | 分页、请求、浏览器订阅 |
| 统一结构且允许局部替换 UI | 组件加 slots | 卡片、对话框、表格外壳 |
| 同一子树内的服务或配置 | provide/inject | 表单上下文、主题、权限读取器 |
| 直接的 DOM 行为 | 自定义指令 | 自动聚焦、拖拽集成 |
| 跨路由的共享领域状态 | Pinia 等 Store | 会话、购物车、偏好 |

这种组合方式让每一层都能独立测试，也避免了隐式冲突和难以追踪的数据来源。

## 现代代码示例：用 composable 复用分页行为

~~~ts
// composables/usePagination.ts
import { computed, ref, watch, type Ref } from 'vue'

export function usePagination<T>(items: Ref<T[]>, pageSize = 20) {
  const page = ref(1)

  const pageCount = computed(() =>
    Math.max(1, Math.ceil(items.value.length / pageSize)),
  )

  const currentItems = computed(() => {
    const start = (page.value - 1) * pageSize
    return items.value.slice(start, start + pageSize)
  })

  function goTo(nextPage: number) {
    page.value = Math.min(Math.max(1, nextPage), pageCount.value)
  }

  watch(pageCount, (count) => {
    if (page.value > count) page.value = count
  })

  return { page, pageCount, currentItems, goTo }
}
~~~

~~~vue
<script setup lang="ts">
import { ref } from 'vue'
import { usePagination } from '../composables/usePagination'

type Article = { id: string; title: string }

const articles = ref<Article[]>([])
const { page, pageCount, currentItems, goTo } = usePagination(articles, 10)
</script>

<template>
  <ul>
    <li v-for="article in currentItems" :key="article.id">
      {{ article.title }}
    </li>
  </ul>

  <button type="button" :disabled="page <= 1" @click="goTo(page - 1)">
    上一页
  </button>
  <span>{{ page }} / {{ pageCount }}</span>
  <button type="button" :disabled="page >= pageCount" @click="goTo(page + 1)">
    下一页
  </button>
</template>
~~~

这个 composable 的输入、输出和状态实例都很明确。每个调用点得到自己的 page；如果要求多个页面共享同一页码，应把真值提升到 URL 或领域 Store，而不是将模块变量悄悄变成单例。

## 用 slots 扩展结构，而不是暴露内部 DOM

~~~vue
<!-- SectionPanel.vue -->
<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section class="section-panel">
    <header>
      <h2>{{ title }}</h2>
      <slot name="actions" />
    </header>

    <div class="section-panel__body">
      <slot />
    </div>
  </section>
</template>
~~~

调用方可以填充 actions 和默认内容，同时组件仍控制语义结构、样式与无障碍基线。稳定的 props 与 slot 名称比让调用方依赖内部 class 或 DOM 层级更容易演进。

## 仅在需要直接操作 DOM 时使用指令

~~~vue
<script setup lang="ts">
const vFocus = {
  mounted(element: HTMLInputElement) {
    element.focus()
  },
}
</script>

<template>
  <label>
    搜索
    <input v-focus>
  </label>
</template>
~~~

指令适合焦点、第三方 DOM 控件挂接等命令式行为。它不适合承载业务状态、网络请求或跨组件通信；那些职责仍应由组件、composable 或 Store 负责。

## 常见误区与检查点

- 不要把复用层做成“知道所有业务”的万能组件或万能 composable；输入、输出与错误处理应保持领域清晰。
- 同一个 composable 若同时读写页面局部状态和全局 Store，测试与复用会变困难；优先让依赖通过参数或注入显式传入。
- slots 适合 UI 组合，不应替代明确的 props、emits 和权限规则。
- 指令的 mounted、updated、unmounted 钩子必须与所接入 DOM API 的创建、更新、销毁成对管理。
- 抽取复用前先确认重复是否稳定。两段相似代码若业务变化方向不同，过早合并反而增加耦合。

## 官方参考

- [Vue：Composable](https://vuejs.org/guide/reusability/composables.html)
- [Vue：插槽](https://vuejs.org/guide/components/slots.html)
- [Vue：provide / inject](https://vuejs.org/guide/components/provide-inject.html)
- [Vue：自定义指令](https://vuejs.org/guide/reusability/custom-directives.html)
- [Vue：Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
