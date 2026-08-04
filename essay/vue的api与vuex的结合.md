# Vue 组合式 API 与 Pinia：把状态访问收敛到 composable

适用范围：Vue 3 应用需要把页面请求、领域状态和组件交互拆分为可测试单元的场景；关键原则：Composition API 用于组织可复用逻辑，不自动等于全局状态；Pinia 用于有明确共享边界的领域 Store。本文用 composable、script setup 与 Pinia 展示协作方式，并说明 Vuex 存量模块的渐进迁移边界。

## 先把三层职责分开

一个可维护的 Vue 页面通常至少有三层：

1. 组件层负责模板、用户事件和局部 UI 状态。
2. composable 负责可复用的状态逻辑，例如加载、取消请求、表单规则和格式化。
3. Store 负责跨组件或跨路由共享且有稳定领域边界的客户端状态。

把每个请求都直接写进 Store，会让页面细节污染全局层；把需要多处协同的登录会话只放在某个页面的 composable，则会造成重复和不一致。先确定状态的消费者与生命周期，再决定落点。

## 现代代码示例：请求逻辑留在 composable

~~~ts
// composables/useArticle.ts
import { ref, watch, type Ref } from 'vue'

type Article = {
  id: string
  title: string
}

export function useArticle(articleId: Ref<string>) {
  const article = ref<Article | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  watch(
    articleId,
    (id, _previousId, onCleanup) => {
      const controller = new AbortController()
      onCleanup(() => controller.abort())

      loading.value = true
      error.value = null

      void fetch('/api/articles/' + encodeURIComponent(id), {
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

  return { article, loading, error }
}
~~~

~~~vue
<!-- ArticleDetail.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useArticle } from '../composables/useArticle'

const props = defineProps<{ articleId: string }>()
const articleId = computed(() => props.articleId)
const { article, loading, error } = useArticle(articleId)
</script>

<template>
  <p v-if="loading">正在加载</p>
  <p v-else-if="error" role="alert">{{ error }}</p>
  <article v-else-if="article">
    <h1>{{ article.title }}</h1>
  </article>
</template>
~~~

## Pinia Store：共享会话要有明确读写 API

~~~ts
// stores/session.ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

type User = {
  id: string
  name: string
}

export const useSessionStore = defineStore('session', () => {
  const user = ref<User | null>(null)
  const signedIn = computed(() => user.value !== null)

  function applySession(nextUser: User) {
    user.value = nextUser
  }

  function clearSession() {
    user.value = null
  }

  return { user, signedIn, applySession, clearSession }
})
~~~

在组件中从 Store 取状态时，使用 storeToRefs 保留响应性；写入时调用领域动作，避免任意组件直接耦合内部结构。

~~~vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const { user, signedIn } = storeToRefs(session)

function signOut() {
  session.clearSession()
}
</script>
~~~

## Vuex 存量的迁移边界

存量 Vuex 模块无需为了语法统一而立即重写。优先为新领域定义 Pinia Store；对需要迁移的旧模块，先固定读取与写入接口，再逐个消费者替换并验证持久化、路由守卫和失败路径。同一业务状态只能有一个写入真源，避免 Pinia 与 Vuex 互相订阅、相互回写。

## 常见误区与检查点

- 不要把 Composition API 当作“所有逻辑都放一个文件”的理由；composable 应按领域和副作用边界拆分。
- 不要因为 Store 可被任意页面访问就把局部弹窗、临时输入和派生值搬进去。
- 请求失败、取消和重新加载是 composable 的行为契约，不能只返回 data。
- 从 Pinia Store 直接解构 state 可能丢失响应式连接；状态读取使用 storeToRefs 更稳妥。
- Store 不能替代服务端授权与数据校验；前端状态只改善体验，不构成安全边界。

## 官方参考

- [Vue：Composable](https://vuejs.org/guide/reusability/composables.html)
- [Vue：Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Vue：侦听器](https://vuejs.org/guide/essentials/watchers.html)
- [Pinia：官方文档](https://pinia.vuejs.org/)
- [Vuex：官方文档](https://vuex.vuejs.org/)
