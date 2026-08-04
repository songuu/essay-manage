# Vue 3 的现代项目基线：Composition API、显式边界与可验证交付

适用范围：新建 Vue 项目，或需要逐步统一组件写法、状态边界和工程质量的存量项目；关键原则：以 Composition API 和 script setup 组织逻辑，保持 props/emits 单向数据流，把可复用行为放进 composable，把跨页面领域状态放进明确的 Store。本文提供一个现代组件骨架，并说明迁移、服务端渲染和性能优化的边界。

## 一套可长期维护的默认写法

Vue 3 的核心价值不只是语法变化，而是让逻辑按领域聚合：同一功能的状态、派生值、事件处理、侦听和清理可以靠近放置。对大多数页面，下面这些默认值足够稳健：

- 使用 script setup 与 Composition API，按功能而不是按选项类别组织代码。
- 输入用 props，用户意图用 emits；不要直接改写上层拥有的数据。
- 纯派生值使用 computed；同步浏览器、网络、订阅等外部系统时才使用 watch 或 watchEffect。
- 跨层配置使用 provide/inject；跨路由共享的领域状态使用 Pinia 等明确方案。
- 将请求状态、错误、取消和重试视为产品状态，而非只处理成功响应。
- 以可访问性、加载态、空态、错误态和关键交互测试作为完成标准。

## 现代代码示例：一个可读的可搜索组件

~~~vue
<script setup lang="ts">
import { computed, ref } from 'vue'

type Article = {
  id: string
  title: string
  published: boolean
}

const props = defineProps<{
  articles: Article[]
}>()

const emit = defineEmits<{
  select: [articleId: string]
}>()

const query = ref('')

const visibleArticles = computed(() => {
  const normalized = query.value.trim().toLocaleLowerCase()
  return normalized
    ? props.articles.filter((article) =>
        article.title.toLocaleLowerCase().includes(normalized),
      )
    : props.articles
})

function selectArticle(articleId: string) {
  emit('select', articleId)
}
</script>

<template>
  <section aria-labelledby="article-heading">
    <h1 id="article-heading">文章</h1>

    <label>
      搜索
      <input v-model="query">
    </label>

    <p v-if="visibleArticles.length === 0" role="status">没有匹配的文章</p>

    <ul v-else>
      <li v-for="article in visibleArticles" :key="article.id">
        <button type="button" @click="selectArticle(article.id)">
          {{ article.title }}
        </button>
        <span>{{ article.published ? '已发布' : '草稿' }}</span>
      </li>
    </ul>
  </section>
</template>
~~~

筛选结果由已有输入计算，不需要 watcher 或额外状态。调用方负责响应 select，因而导航、权限和持久化逻辑不会被藏在展示组件中。

## 组件、composable 与 Store 的分工

组件负责呈现与局部交互；composable 负责可复用的有状态行为，例如分页、表单校验、网络请求和浏览器 API；Store 负责跨多个调用点共享且有稳定业务名称的状态。一个 composable 被调用多次通常会创建多份局部状态，若需要同一份会话或购物车数据，应显式选择 Store，而不是依赖模块变量碰巧共享。

不要把所有逻辑迁进一个超大组件或超大 Store。按领域拆分，并将 API 设计成业务操作，例如 publishArticle、clearSession、applyFilter，而不是模糊的 setData。

## 演进与迁移边界

对存量项目，先从新页面或单个低风险功能采用现代写法，再提取稳定的 composable 和组件 API。迁移时不要同时更换路由、服务端接口、状态模型和视觉结构；每次只移动一个边界，并覆盖加载、失败、权限和刷新恢复。

服务端渲染环境中没有浏览器 DOM，因此 window、document、布局测量和浏览器存储必须位于客户端生命周期边界。性能优化也应基于实际测量：先保持组件数据流清楚，再针对确认的高成本更新切分状态或使用适当的缓存。

## 常见误区与检查点

- script setup 不会自动解决架构问题；没有边界的响应式状态同样难以维护。
- 不要用 watcher 同步本可由 computed 推导的值，也不要为每个字段都建立全局 Store。
- 不要只验证成功页面；网络慢、空数据、服务端失败、用户取消和键盘访问都属于交付范围。
- UI 上的权限隐藏不构成安全控制，服务端必须独立校验权限与输入。
- 大规模重写并不天然更现代；可以验证、可以回滚的渐进演进通常风险更低。

## 官方参考

- [Vue：Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Vue：script setup](https://vuejs.org/api/sfc-script-setup.html)
- [Vue：Composable](https://vuejs.org/guide/reusability/composables.html)
- [Vue：组件 Props](https://vuejs.org/guide/components/props.html)
- [Vue：性能最佳实践](https://vuejs.org/guide/best-practices/performance.html)
