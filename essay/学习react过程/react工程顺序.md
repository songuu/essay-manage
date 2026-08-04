# 从需求到交付：现代 React 工程的推进顺序

适用范围：以函数组件与 Hooks 为主的 React Web 应用；关键原则：先明确数据边界和可观察的交付结果，再让组件、状态、请求与测试逐层落位。本文用一个可筛选列表展示现代代码组织，并说明不要把派生状态塞进 Effect、不要过早引入全局状态等边界。

## 先定义“完成”而不是先建目录

一个页面开始前，先写下用户可见的输入、成功结果、失败结果和加载状态。例如“按关键词筛选商品”至少要明确：关键词是否来自 URL、空结果如何呈现、请求失败是否可重试、离开页面时是否应取消请求。这样能让后面的组件拆分服务于行为，而不是服务于文件数量。

建议按下面顺序推进：

1. 写清页面契约、数据类型和关键交互；对风险最高的规则先写测试。
2. 画出静态组件树，把重复视觉区域先做成纯展示组件。
3. 将状态放到最靠近共同消费者的组件；能由现有数据计算出的值不要单独存状态。
4. 接入路由、服务端数据和错误边界；将请求细节封装在可复用 Hook 中。
5. 只为与 React 外部系统同步的事情使用 Effect，并实现清理。
6. 补齐无障碍、空态、加载态和端到端关键路径，再依据实际测量处理性能问题。

## 现代代码示例：先让数据流可读

下面的列表把输入状态放在页面组件，把筛选结果作为派生值计算；它不需要 Effect。

~~~tsx
import { useMemo, useState } from 'react'

type Product = {
  id: string
  name: string
  price: number
}

export function ProductList({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('')
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return normalized
      ? products.filter((product) => product.name.toLocaleLowerCase().includes(normalized))
      : products
  }, [products, query])

  return (
    <section aria-labelledby="products-heading">
      <h1 id="products-heading">商品</h1>
      <label>
        搜索
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {visibleProducts.length === 0 ? (
        <p role="status">没有匹配的商品</p>
      ) : (
        <ul>
          {visibleProducts.map((product) => (
            <li key={product.id}>{product.name}：{product.price}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
~~~

如果数据来自网络，请把“请求的生命周期”局限在专用 Hook 中，并在输入变化或组件卸载时取消旧请求。真实项目还应将 HTTP 状态码、业务错误码和重试策略统一收敛到数据访问层。

~~~tsx
import { useEffect, useState } from 'react'

type Product = {
  id: string
  name: string
  price: number
}

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

export function useProducts(query: string) {
  const [state, setState] = useState<LoadState<Product[]>>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })

    void fetch('/api/products?q=' + encodeURIComponent(query), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('加载商品失败：' + response.status)
        return response.json() as Promise<Product[]>
      })
      .then((data) => setState({ status: 'success', data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ status: 'error', message: error instanceof Error ? error.message : '未知错误' })
      })

    return () => controller.abort()
  }, [query])

  return state
}
~~~

## 状态、Effect 与抽象的边界

局部输入、展开状态和一次性交互优先留在组件内；多个远距离区域确实需要共享时，再评估 Context、外部状态库或 URL。服务端缓存、失效和并发请求也不是普通全局状态的替代品，应由项目选定的数据获取方案负责。

Effect 的职责是同步浏览器 API、订阅、定时器或网络等外部系统。筛选、排序、格式化、拼接展示文本都可以在渲染期间完成。自定义 Hook 适合复用带状态的行为；纯函数适合复用无状态计算。组件不要因为“以后可能复用”而过早拆成难以追踪的层级。

## 常见误区与检查点

- 将 products 的筛选结果再写入 State，会产生双数据源和过期值风险。
- 用空依赖数组规避 Effect 依赖告警，常会捕获旧的 props 或 state；应先重新审视是否真的需要 Effect。
- 仅以组件渲染成功作为完成标准，忽略加载、失败、取消请求、键盘操作和窄屏布局。
- 还没有跨页面共享需求就建立巨型 Store，会提高改动成本；先让状态归属清晰。
- 性能优化应基于实际测量。memo、useMemo 和 useCallback 都是优化工具，不是默认写法。

## 官方参考

- [React Learn：开始使用 React](https://react.dev/learn)
- [React：你可能不需要 Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [React：Effect 的生命周期](https://react.dev/learn/lifecycle-of-reactive-effects)
- [React：使用自定义 Hook 复用逻辑](https://react.dev/learn/reusing-logic-with-custom-hooks)
