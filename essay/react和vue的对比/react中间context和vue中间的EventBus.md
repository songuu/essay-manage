# React Context 与 Vue provide/inject：让跨层依赖保持可追踪

适用范围：主题、当前用户、权限、表单容器等需要跨越多层组件树但不适合层层传参的依赖；关键原则：提供稳定的值与明确的写入 API，而不是让任意组件通过全局消息相互改状态。本文用 React Context 和 Vue 3 provide/inject 展示现代代码，并说明频繁更新、业务事件和状态容器的边界。

## 先区分“依赖注入”和“状态广播”

跨层传递不等于全局状态。一个主题配置、当前语言或表单注册器通常由一个清晰的上层拥有，下层只读取或调用它公开的操作；这适合 Context 或 provide/inject。

如果两个互不相关的页面需要共同读写复杂业务数据，应考虑更明确的状态容器、URL 或服务端缓存。如果是一次性的领域事件，应由发起方调用明确的业务函数或经过可审计的服务层，而不是建立隐式、难追踪的全局订阅关系。

## React：Context 配合受保护的读取 Hook

将默认值设为 null 并在自定义 Hook 中报错，可以避免组件脱离 Provider 后静默使用假数据。

~~~tsx
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const value = useMemo(() => ({ theme, setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme 必须位于 ThemeProvider 内')
  return value
}

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  return (
    <button
      type="button"
      aria-pressed={theme === 'dark'}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      切换主题
    </button>
  )
}
~~~

Provider 的 value 变化会通知消费者。因此，高频变化的数据不应不加设计地塞进一个巨大的 Context；可拆分关注点、把状态下沉，或使用专门的外部 Store。useMemo 只是在 value 身份稳定确有意义时使用，不替代状态建模。

## Vue 3：provide/inject 使用 Symbol 键和显式 API

把 key 与读取函数放在同一模块，能够避免字符串冲突并在缺少提供者时尽早失败。对下层只读的数据可提供 readonly 包装，更新只能通过公开函数完成。

~~~ts
// theme-context.ts
import {
  inject,
  provide,
  readonly,
  ref,
  type InjectionKey,
  type Ref,
} from 'vue'

type Theme = 'light' | 'dark'

type ThemeApi = {
  theme: Readonly<Ref<Theme>>
  setTheme: (theme: Theme) => void
}

const themeKey: InjectionKey<ThemeApi> = Symbol('theme')

export function provideTheme() {
  const theme = ref<Theme>('light')

  function setTheme(nextTheme: Theme) {
    theme.value = nextTheme
  }

  provide(themeKey, { theme: readonly(theme), setTheme })
}

export function useTheme() {
  const value = inject(themeKey)
  if (!value) throw new Error('useTheme 必须在 provideTheme 的后代中调用')
  return value
}
~~~

~~~vue
<!-- ThemeProvider.vue -->
<script setup lang="ts">
import { provideTheme } from './theme-context'

provideTheme()
</script>

<template>
  <slot />
</template>
~~~

~~~vue
<!-- ThemeSwitch.vue -->
<script setup lang="ts">
import { useTheme } from './theme-context'

const { theme, setTheme } = useTheme()
</script>

<template>
  <button type="button" @click="setTheme(theme === 'dark' ? 'light' : 'dark')">
    当前主题：{{ theme }}
  </button>
</template>
~~~

提供响应式 ref 或 reactive 对象时，下层会保持响应性；提供一个当时读取出的普通值，只会得到快照。是否提供 readonly，应由调用方是否被允许写入这一业务规则决定。

## 常见误区与边界

- 不要把 Context 或 inject 当作任意组件之间的消息通道；隐式订阅会隐藏数据来源与错误处理。
- 不要让一个无边界的大对象承载所有全局状态。按更新频率和业务归属拆分，性能与可测试性都更可控。
- React Context 的默认值不应掩盖缺少 Provider 的配置错误；Vue inject 也应对必需依赖显式失败或提供有意义的默认策略。
- provide/inject 适合组件树内的依赖；跨路由持久化、请求缓存、撤销重做和复杂调试需求通常需要更专门的方案。
- Provider 中的异步写入必须定义加载、失败与取消语义，不能只在成功回调里悄悄改值。

## 官方参考

- [React：使用 Context 深层传递数据](https://react.dev/learn/passing-data-deeply-with-context)
- [React：useContext](https://react.dev/reference/react/useContext)
- [Vue：provide / inject](https://vuejs.org/guide/components/provide-inject.html)
- [Vue：Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
