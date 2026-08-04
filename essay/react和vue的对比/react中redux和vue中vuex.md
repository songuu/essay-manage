# Redux Toolkit、Zustand、Pinia 与 Vuex：按状态边界选择工具

适用范围：React 或 Vue 项目需要管理跨页面共享的客户端状态，或正在规划存量状态层的演进；关键原则：先区分本地 UI 状态、URL 状态、服务端缓存和真正的共享客户端状态，再选择最小且可审计的工具。本文给出 Redux Toolkit、Zustand 与 Pinia 的现代示例，并说明 Vuex 存量迁移不应制造双写数据源的边界。

## 状态先分类，库后选择

并非所有数据都应该进入全局 Store：

| 数据类型 | 优先位置 | 例子 |
| --- | --- | --- |
| 单个组件的交互状态 | 组件本地状态 | 弹窗开关、临时输入 |
| 可分享、可刷新恢复的界面状态 | URL 或路由状态 | 搜索词、筛选条件、页码 |
| 服务端事实与缓存 | 项目选定的数据请求层 | 列表、详情、权限结果 |
| 多处同时读写的客户端协调状态 | 领域 Store | 购物车草稿、编辑器会话、客户端偏好 |

Redux Toolkit 适合需要显式事件、可预测 reducer、较多中间件或成熟调试约束的 React 团队。Zustand 适合状态模型较小、希望直接用 Hook 读取切片的 React 场景。Vue 的新功能通常优先以 Pinia 组织；已有 Vuex 模块能稳定服务时，是否迁移取决于收益、测试覆盖与交付风险，而不是一次性重写的冲动。

## React：Redux Toolkit 让更新规则集中在 slice

Redux Toolkit 中 reducer 里的“可变”写法由其内部机制处理；不要把这种写法带到普通 React state 或任意对象上。

~~~ts
import {
  configureStore,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'

type CartItem = {
  id: string
  title: string
  quantity: number
}

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [] as CartItem[] },
  reducers: {
    addItem(state, action: PayloadAction<CartItem>) {
      const existing = state.items.find((item) => item.id === action.payload.id)
      if (existing) {
        existing.quantity += action.payload.quantity
      } else {
        state.items.push(action.payload)
      }
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload)
    },
  },
})

export const { addItem, removeItem } = cartSlice.actions

export const store = configureStore({
  reducer: { cart: cartSlice.reducer },
})
~~~

组件通过项目封装的 typed hooks 读取所需切片、派发领域 action，而不是让任意组件直接触碰整个状态树。异步请求、错误与缓存应遵循团队选定的数据层策略，避免每个 slice 都重复实现请求状态机。

## React：Zustand 保持小而清晰的 Store

~~~ts
import { create } from 'zustand'

type Notice = {
  id: string
  message: string
}

type NoticeState = {
  notices: Notice[]
  push: (notice: Notice) => void
  dismiss: (id: string) => void
}

export const useNoticeStore = create<NoticeState>((set) => ({
  notices: [],
  push: (notice) => set((state) => ({ notices: [...state.notices, notice] })),
  dismiss: (id) =>
    set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),
}))
~~~

调用处应选择最小的所需片段，例如只读取 notices 或 dismiss。不要把所有远端响应、表单草稿和页面 UI 都堆进同一个 Store；简单 API 并不意味着没有状态边界。

## Vue：Pinia 用 setup store 组织领域状态

~~~ts
// stores/cart.ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

type CartItem = {
  id: string
  title: string
  quantity: number
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const totalQuantity = computed(() =>
    items.value.reduce((total, item) => total + item.quantity, 0),
  )

  function addItem(nextItem: CartItem) {
    const existing = items.value.find((item) => item.id === nextItem.id)
    if (existing) existing.quantity += nextItem.quantity
    else items.value.push(nextItem)
  }

  function removeItem(id: string) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  return { items, totalQuantity, addItem, removeItem }
})
~~~

Pinia Store 仍应体现领域边界：调用方请求 addItem，而不是任意改写 items。请求缓存、持久化和跨标签页同步需要额外、明确的策略与错误处理。

## Vuex 存量迁移的安全边界

1. 先盘点模块的读写入口、持久化机制、路由守卫和测试覆盖，确定真实耦合面。
2. 为一个领域建立稳定的读取与写入适配层，再逐个迁移消费者；不要同时改接口、UI 和数据结构。
3. 同一份业务事实在迁移窗口只能有一个写入真源。若必须双读，必须规定优先级和删除日期。
4. 每迁移一个领域，就验证刷新恢复、失败回滚、权限变化和关键页面路径；剩余 Vuex 模块可以按收益继续维护。
5. 新旧方案的选择应记录在项目架构决策中，避免团队成员在同一功能内混用多个 Store。

## 常见误区与检查点

- Context 或 provide/inject 不是所有全局状态的自动替代；高频或复杂共享状态需要评估更新粒度和调试能力。
- 不能因“全局可访问”就把 API 响应全部复制进 Store，尤其是会过期的服务端数据。
- 不要把 action 名称写成含糊的 setData；让动作表达 addItem、applyFilter、signOut 等业务意图。
- Store 不是权限边界。服务端仍必须验证用户、资源和操作。
- 迁移期间最危险的是双向同步和无测试的大爆炸替换，应优先建立可回滚的小切片。

## 官方参考

- [Redux：核心概念与入门](https://redux.js.org/tutorials/essentials/part-1-overview-concepts)
- [Redux Toolkit：开始使用](https://redux-toolkit.js.org/introduction/getting-started)
- [Zustand：入门](https://zustand.docs.pmnd.rs/learn/getting-started/introduction)
- [Pinia：官方文档](https://pinia.vuejs.org/)
- [Vuex：官方文档](https://vuex.vuejs.org/)
