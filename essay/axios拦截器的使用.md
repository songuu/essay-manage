适用于 Axios 请求链的认证、追踪和统一错误处理：拦截器应注册在专属实例上，保持请求/响应数据的可预期形状，并在模块销毁、热更新或测试结束时 `eject`；它和 Vue Router 的导航守卫是两套机制，不能用路由钩子代替 HTTP 拦截器。

## 请求与响应各负责什么

请求拦截器在请求发出前运行，适合补齐认证头、请求 ID、语言等 transport 元数据；响应拦截器在响应到达后运行，适合轻量转换、统一记录和把认证失败通知给上层。

不要在拦截器中无条件跳转页面、弹窗或吞掉异常。把这些副作用通过回调交给应用层，才能同时服务浏览器、SSR、测试和后台任务。

```ts
// src/lib/api/interceptors.ts
import axios, { type AxiosInstance } from "axios";

type InterceptorOptions = {
  getAccessToken: () => string | undefined;
  onUnauthorized: () => void;
  getRequestId: () => string;
};

export function installInterceptors(
  client: AxiosInstance,
  { getAccessToken, onUnauthorized, getRequestId }: InterceptorOptions,
): () => void {
  const requestId = client.interceptors.request.use((config) => {
    const token = getAccessToken();

    // 认证端点本身通常不应携带过期的访问令牌。
    if (token && !config.url?.startsWith("/auth/")) {
      config.headers.set("Authorization", "Bearer " + token);
    }

    config.headers.set("X-Request-Id", getRequestId());
    return config;
  });

  const responseId = client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isCancel(error)) {
        return Promise.reject(error);
      }

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        onUnauthorized();
      }

      // 原样向上传递，调用方仍能读取 response、request、code 与 cause。
      return Promise.reject(error);
    },
  );

  return () => {
    client.interceptors.request.eject(requestId);
    client.interceptors.response.eject(responseId);
  };
}
```

在应用启动或客户端构造处安装一次，并保留返回的清理函数：

```ts
const disposeInterceptors = installInterceptors(api, {
  getAccessToken: () => sessionStore.accessToken,
  onUnauthorized: () => sessionStore.markExpired(),
  getRequestId: () => crypto.randomUUID(),
});

// 热更新 dispose、测试 afterEach，或显式销毁该客户端时：
disposeInterceptors();
```

如果同一个组件渲染、同一次热更新或每个请求都重复调用安装函数，认证头、日志和 401 回调会叠加执行。开发环境中这常表现为一次请求被记录多次，或过期后重复跳转。

## 顺序、返回值与重试

Axios 的执行顺序不是直觉上的“从上到下”：

- 多个请求拦截器按后进先出（LIFO）运行，最后注册的最先执行。
- 多个响应拦截器按先进先出（FIFO）运行，最先注册的最先执行。
- 成功处理器应返回下一个处理器需要的值；失败处理器要么恢复成可用值，要么 `return Promise.reject(error)` / `throw error`，不能悄悄返回 `undefined`。

因此，认证、签名和日志的注册顺序应写在一个位置并有测试。响应拦截器若返回 `response.data`，后续调用方就不再得到 `AxiosResponse`；可以这样设计，但必须把它作为该实例的稳定契约，不能有的接口解包、有的接口不解包。

401 自动刷新令牌是高风险逻辑。至少要满足：

1. 刷新请求不经过同一条会再次触发刷新的拦截链，避免递归。
2. 同时到达的多个 401 共用一个“single-flight”刷新 Promise，避免令牌竞争。
3. 原请求最多重放一次，并只重试可安全重放的请求。
4. 刷新失败时清理会话并把原始失败交给页面，而不是无限重试。

## 清理与边界

- `eject(id)` 只移除本次注册的拦截器，是运行时代码的默认选择。
- `clear()` 会清空该实例同一方向的所有拦截器；它适合隔离的测试实例，不适合多个模块共享的生产客户端。
- `AbortSignal` 取消代表调用方不再需要结果，不应被 401、网络错误或全局 toast 覆盖成“失败”。
- 认证头只能发给可信的同源或明确允许的服务实例；不要把同一实例用于第三方 URL。
- 日志里不要记录 `Authorization`、Cookie、完整请求体或敏感响应；保留请求 ID、路径、方法、状态和耗时通常就足够。
- Vue Router 的 `beforeEach` 管的是导航权限，Axios 拦截器管的是 HTTP 请求；两者可共享认证状态，但不互相替代。

## 官方参考

- [Axios：拦截器](https://axios-http.com/docs/interceptors)
- [Axios：创建实例](https://axios-http.com/docs/instance)
- [Axios：错误处理](https://axios-http.com/docs/handling_errors)
- [Axios：取消请求](https://axios-http.com/docs/cancellation)