# Vue 3 响应式数据：用 ref、reactive、computed 与 watch 建立可预测状态

适用范围：Vue 3 Composition API 中管理表单、列表、派生展示和异步副作用的组件；关键原则：状态用 ref 或 reactive 声明，派生值用 computed，外部同步用 watch 或 watchEffect。本文以 script setup 示例解释 Proxy 响应式、解构边界和浅层包装的用法，并避免把侦听器当作数据计算器。

## 响应式不是“任何普通变量都会刷新页面”

Vue 会跟踪模板、computed 和侦听回调在执行时读取到的响应式来源。ref 用于单个值，并通过 value 读写；reactive 用于对象或数组并返回 Proxy。模板中会自动解包常见 ref，但在 TypeScript 与普通函数中仍应明确 value。

一个状态改变后，依赖它的视图会在更新队列中刷新。不要依赖手工操作 DOM 来“同步显示”；先让数据、派生值和模板之间的关系可读。

## 现代代码示例：表单状态与派生摘要

~~~vue
<script setup lang="ts">
import { computed, reactive, ref, toRefs, watch } from 'vue'

type Tag = {
  id: string
  name: string
}

const title = ref('')
const article = reactive({
  tags: [] as Tag[],
  published: false,
})

const summary = computed(() => {
  const status = article.published ? '已发布' : '草稿'
  return title.value.trim() + ' · ' + status + ' · ' + article.tags.length + ' 个标签'
})

function addTag(tag: Tag) {
  if (article.tags.some((item) => item.id === tag.id)) return
  article.tags.push(tag)
}

function removeTag(id: string) {
  article.tags = article.tags.filter((tag) => tag.id !== id)
}

const { tags, published } = toRefs(article)

watch(title, (nextTitle) => {
  document.title = nextTitle ? nextTitle + ' - 编辑器' : '编辑器'
})
</script>

<template>
  <label>
    标题
    <input v-model="title">
  </label>

  <label>
    <input v-model="published" type="checkbox">
    发布
  </label>

  <p>{{ summary }}</p>

  <ul>
    <li v-for="tag in tags" :key="tag.id">
      {{ tag.name }}
      <button type="button" @click="removeTag(tag.id)">移除</button>
    </li>
  </ul>

  <button type="button" @click="addTag({ id: crypto.randomUUID(), name: 'Vue' })">
    添加标签
  </button>
</template>
~~~

summary 是从 title、published、tags 计算出来的，因此使用 computed；不需要额外的 summary ref 或 watch 来同步它。watch 在这里负责同步浏览器标题这个外部系统，职责更清晰。

## ref、reactive 与解构的选择

- 单个原始值、可能整体替换的对象或需要在函数间明确传递的值，优先用 ref。
- 一组语义紧密、通常按字段修改的状态可以用 reactive。
- 从 reactive 对象直接解构成普通变量会脱离 Proxy；需要分别暴露字段时使用 toRefs 或保留对象访问。
- 对大型外部实例、不可变数据快照或只关心整体替换的值，可评估 shallowRef；它不会追踪深层字段变化，因此更新契约必须明确。
- 不要混用多个包装方式只是为了“看起来统一”；选择应服务于读写行为和 API 可读性。

## computed、watch 与 watchEffect 的边界

computed 用于纯派生数据，应该无副作用、可缓存。watch 适合明确监听一个或多个来源，并在回调中进行请求、持久化、浏览器 API 同步等副作用。watchEffect 适合回调读取哪些响应式来源并不固定、且无需新旧值的场景；使用它时仍要注册取消订阅、取消请求等清理。

深度侦听会扩大依赖范围，可能增加不必要的工作。先尝试监听精确字段、长度或版本号，只有确实要响应深层变动时才选择深度侦听。

## 常见误区与检查点

- 将派生文本、过滤数组或总数同时存进 ref，会形成双数据源；优先使用 computed。
- 忘记在普通 JavaScript/TypeScript 逻辑中访问 ref.value，会得到 ref 容器而不是其值。
- 直接解构 reactive 后以为仍然自动更新，会造成模板或 composable 状态失联；使用 toRefs 或保持对象引用。
- 侦听回调中又无条件修改同一来源，可能形成循环；先区分输入、派生数据和副作用。
- 响应式只解决界面同步，不解决服务端并发、权限、缓存失效或错误恢复；这些需要明确的数据层策略。

## 官方参考

- [Vue：响应式基础](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
- [Vue：计算属性](https://vuejs.org/guide/essentials/computed.html)
- [Vue：侦听器](https://vuejs.org/guide/essentials/watchers.html)
- [Vue：响应式 API 核心](https://vuejs.org/api/reactivity-core.html)
