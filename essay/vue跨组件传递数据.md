# Vue 3 跨组件传递数据：按距离和所有权选择通道

适用范围：Vue 3 应用中父子、跨层、跨路由组件需要协作数据或操作的场景；关键原则：先让数据所有权清晰，再根据组件距离选择 props/emits、slots、provide/inject、composable 或 Store。本文给出可追踪的数据流示例，并说明不要用隐式全局事件或深层 props 链掩盖架构问题。

## 选择通道的快速判断

| 场景 | 首选方式 | 为什么 |
| --- | --- | --- |
| 直接父子、数据和操作明确 | props + emits | 输入和意图都有显式接口 |
| 父级决定局部 UI 内容 | slots | 组合展示而不泄露内部结构 |
| 同一子树深层共享服务或配置 | provide/inject | 避免无意义的中转 props |
| 多组件复用带状态的逻辑 | composable | 行为和测试可独立 |
| 跨路由、长期共享的领域状态 | Pinia 等 Store | 读写边界和生命周期集中 |
| 可分享、可刷新恢复的筛选状态 | URL / 路由 | 地址本身成为状态来源 |

不要根据组件层数机械选择工具。关键是“谁拥有真值”“谁能写入”“离开页面后状态是否还应存在”。

## 父子协作：props 向下，emit 向上

~~~vue
<!-- QuantityPicker.vue -->
<script setup lang="ts">
const props = defineProps<{
  quantity: number
  max: number
}>()

const emit = defineEmits<{
  change: [quantity: number]
}>()

function increase() {
  if (props.quantity < props.max) emit('change', props.quantity + 1)
}
</script>

<template>
  <div>
    <span>数量：{{ props.quantity }}</span>
    <button type="button" :disabled="props.quantity >= props.max" @click="increase">
      增加
    </button>
  </div>
</template>
~~~

~~~vue
<!-- 父组件 -->
<script setup lang="ts">
import { ref } from 'vue'
import QuantityPicker from './QuantityPicker.vue'

const quantity = ref(1)
</script>

<template>
  <QuantityPicker :quantity="quantity" :max="10" @change="quantity = $event" />
</template>
~~~

父组件持有 quantity；子组件只提出下一数量。这样校验、库存规则和保存动作能在一个可见位置扩展。

## 深层子树：provide/inject 传递受控依赖

例如一个表单容器需要让深层字段注册校验，可以提供只读状态与明确操作，而不是让每层组件重复转发属性。

~~~ts
// form-context.ts
import {
  inject,
  provide,
  readonly,
  ref,
  type InjectionKey,
  type Ref,
} from 'vue'

type FormContext = {
  submitting: Readonly<Ref<boolean>>
  submit: () => Promise<void>
}

const formKey: InjectionKey<FormContext> = Symbol('form')

export function provideForm(submit: () => Promise<void>) {
  const submitting = ref(false)

  async function runSubmit() {
    submitting.value = true
    try {
      await submit()
    } finally {
      submitting.value = false
    }
  }

  provide(formKey, { submitting: readonly(submitting), submit: runSubmit })
}

export function useForm() {
  const value = inject(formKey)
  if (!value) throw new Error('useForm 必须位于表单容器后代中')
  return value
}
~~~

提供者应位于合理的子树根部。若整个应用到处依赖同一上下文，先检查它是否其实是领域 Store、路由状态或服务端缓存。

## 共享业务逻辑与 Store 的边界

composable 适合把请求、分页、校验或浏览器 API 的生命周期封装起来；它被每个调用点调用时，默认得到各自的状态实例。Pinia Store 则适合购物车、会话、用户偏好等需要同一份状态的领域。二者可以配合，但不要为了“全局可用”把所有 composable 都做成单例。

跨组件传递的信息如果应出现在地址栏、支持复制链接或浏览器前进后退，就优先通过路由查询参数表达；不要只藏在内存中。

## 常见误区与检查点

- 直接修改 props 或 inject 得到的共享对象会绕过所有权，导致调用链难以审查。
- 连续多层只为转发同一个 props，说明应该评估 provide/inject 或重组组件边界；但不要把每个值都提升为注入。
- “全局可访问”不代表可以无规则写入。Store 与注入对象都应暴露领域动作、加载态和错误处理。
- 共享状态的持久化、过期、权限变化和登出清理必须明确；否则刷新或切换账号会产生陈旧数据。
- 组件事件应该表达用户意图，而不是传递整个业务对象让上层猜测发生了什么。

## 官方参考

- [Vue：组件 Props](https://vuejs.org/guide/components/props.html)
- [Vue：组件事件](https://vuejs.org/guide/components/events.html)
- [Vue：provide / inject](https://vuejs.org/guide/components/provide-inject.html)
- [Vue：Composable](https://vuejs.org/guide/reusability/composables.html)
- [Pinia：官方文档](https://pinia.vuejs.org/)
