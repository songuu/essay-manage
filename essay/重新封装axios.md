适用于浏览器或 Node.js 应用封装 Axios：按后端服务创建独立实例，明确 `baseURL`、`timeout` 与数据类型，使用 `AbortSignal` 取消已失效的请求，并把 HTTP、网络、取消和配置错误分层；封装应保留调用方需要的上下文，而不是把所有失败变成一个模糊的 `false`。

## 先封装实例，而不是全局默认值

全局 `axios.defaults` 容易把认证头、超时和拦截器泄漏到不相关的服务。为每个服务创建实例，让配置和拦截器的影响范围可见。

```ts
// src/lib/api/client.ts
import axios, { type AxiosRequestConfig } from "axios";

export type ApiClientOptions = {
  baseURL: string;
  timeoutMs?: number;
};

export type ApiClient = {
  request<T>(config: AxiosRequestConfig): Promise<T>;
};

export type ApiErrorKind = "cancelled" | "http" | "network" | "configuration";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

export function toApiError(error: unknown): ApiError {
  if (axios.isCancel(error)) {
    return new ApiError("cancelled", "请求已取消", undefined, { cause: error });
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError("configuration", "请求初始化失败", undefined, { cause: error });
  }

  if (error.response) {
    return new ApiError(
      "http",
      "服务返回了失败状态",
      error.response.status,
      { cause: error },
    );
  }

  if (error.request) {
    return new ApiError("network", "未收到服务响应", undefined, { cause: error });
  }

  return new ApiError("configuration", error.message, undefined, { cause: error });
}

export function createApiClient({ baseURL, timeoutMs = 8_000 }: ApiClientOptions): ApiClient {
  const url = new URL(baseURL);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("API baseURL 必须使用 HTTP 或 HTTPS 协议");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("API timeoutMs 必须是正数");
  }

  const api = axios.create({
    baseURL: url.href,
    timeout: timeoutMs,
    headers: {
      Accept: "application/json",
    },
  });

  return {
    async request<T>(config: AxiosRequestConfig): Promise<T> {
      try {
        const response = await api.request<T>(config);
        return response.data;
      } catch (error) {
        throw toApiError(error);
      }
    },
  };
}
```

把已验证的配置作为工厂参数传入，浏览器与 Node.js 都能复用这个模块。浏览器可在启动阶段读取并校验运行时配置后传入 `apiBaseUrl`；Node.js 则在组合根读取并校验 `process.env.API_BASE_URL` 后传入。`import.meta.env.VITE_*` 仅是 Vite 构建时的浏览器侧约定，不能放进这个跨运行时的客户端模块，更不能假定 Node.js 原生提供它。

实例级 `timeout` 是“请求最长等待多久”的默认策略；慢批处理、文件上传等少数端点可在单次调用覆盖，不能反过来把全局超时设成无限大。服务端是否把 4xx/5xx 当作成功也要明确定义：默认情况下 Axios 会将非 2xx 作为 rejection，只有业务确实要读取某类非 2xx 响应时才使用 `validateStatus`。

## 在调用处保留类型和取消语义

请求函数应返回业务数据而不是整个 Axios 响应，让页面代码不依赖 transport 细节；泛型只描述预期返回形状，不能替代运行时校验不可信的服务端数据。

```ts
type Article = {
  id: string;
  title: string;
  updatedAt: string;
};

export function getArticle(client: ApiClient, id: string, signal?: AbortSignal): Promise<Article> {
  return client.request<Article>({
    method: "GET",
    url: "/articles/" + encodeURIComponent(id),
    signal,
  });
}

// React、Vue 或其他有卸载生命周期的 UI 中：
// apiBaseUrl 来自应用启动阶段已经校验过的浏览器配置，或 Node.js 组合根。
const api = createApiClient({ baseURL: apiBaseUrl });
const controller = new AbortController();

try {
  const article = await getArticle(api, "a-42", controller.signal);
  renderArticle(article);
} catch (error) {
  if (error instanceof ApiError && error.kind === "cancelled") {
    // 路由已切换或新搜索词已出现，不需要向用户报错。
  } else {
    showRequestError(error);
  }
}

// 组件卸载、搜索词变化或用户主动停止时调用。
controller.abort();
```

`AbortController` 是新代码的取消方式；旧 `CancelToken` API 已弃用。`timeout` 和 `AbortSignal` 解决的问题不同：前者限制等待时长，后者表达“这个结果已经不再需要”。搜索联想、切页和组件卸载通常需要后者。

## 错误分层与重试边界

调用方最少应区分四类：

- `http`：服务实际响应，但状态不符合约定；可根据状态码显示字段校验、登录过期或服务错误。
- `network`：请求已发出但没有响应；浏览器中还可能是 CORS、离线或混合内容，不能假定一定是“服务器宕机”。
- `cancelled`：预期控制流，不写错误告警、不弹失败提示。
- `configuration`：URL、序列化、拦截器或调用代码本身的问题，应该尽早暴露给开发者。

重试只适合幂等、可安全重放的请求，并要有次数上限、退避和可观测日志。不要自动重试支付、创建订单等非幂等写操作；若服务端提供幂等键，应由业务层明确传入。

## 封装的边界

- 不要在通用 HTTP 客户端里直接跳转路由、弹 UI 提示或清除本地状态；这些副作用属于认证/页面层，便于测试且避免 Node.js 环境报错。
- 不要用 `any` 包住 `response.data`。先让接口函数返回 `Promise<T>`，再在关键边界校验数据。
- 不要把服务 A 和服务 B 共用一个带认证拦截器的实例；它们可能有不同基址、超时、鉴权和重试策略。
- 请求配置是实例默认值与单次配置的合并，单次配置优先；对覆盖超时、headers 和 `signal` 应有明确审查。
- 拦截器适合横切的认证、追踪和轻量转换，注册后必须能清理，具体做法见“axios 拦截器的使用”。

## 官方参考

- [Axios：创建实例](https://axios-http.com/docs/instance)
- [Axios：请求配置](https://axios-http.com/docs/req_config)
- [Axios：错误处理](https://axios-http.com/docs/handling_errors)
- [Axios：取消请求](https://axios-http.com/docs/cancellation)