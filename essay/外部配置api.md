# 前端 API 配置：区分构建时与运行时

适用范围：同一份前端产物需要部署到多个环境；关键原则：构建时变量决定编译结果，运行时配置以受校验的数据文件注入；当前代码示例：启动前读取 runtime-config.json 并验证 apiBaseUrl；常见误区/边界：运行时配置对所有访问者可见，不能存放密钥，也不能把下载内容当作代码执行；官方参考：[MDN Fetch API](https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API)。

构建时配置适合不会在发布后改变的标识、特性开关默认值和优化选项。它会被打包器替换进产物，修改后必须重新构建。服务地址、发布渠道等可公开且可能随部署变化的值，才适合放到运行时配置。

## 用 JSON 提供运行时配置

部署产物旁放置一个普通数据文件：

~~~json
{
  "apiBaseUrl": "https://api.example.com/v1",
  "releaseChannel": "stable"
}
~~~

应用启动时读取并验证它，而不是使用字符串拼接或动态执行：

~~~js
function validateRuntimeConfig(value) {
  if (typeof value !== "object" || value === null) {
    throw new Error("运行时配置必须是对象");
  }

  const { apiBaseUrl, releaseChannel } = value;
  if (typeof apiBaseUrl !== "string") {
    throw new Error("apiBaseUrl 必须是字符串");
  }

  let url;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new Error("apiBaseUrl 必须是可解析的绝对 URL");
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("apiBaseUrl 必须是不含凭据的 HTTPS 地址");
  }

  return Object.freeze({
    apiBaseUrl: url.href,
    releaseChannel: typeof releaseChannel === "string" ? releaseChannel : "unknown",
  });
}

export async function loadRuntimeConfig() {
  const response = await fetch("/runtime-config.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("读取运行时配置失败: " + response.status);
  }

  return validateRuntimeConfig(await response.json());
}

async function bootstrap() {
  const config = await loadRuntimeConfig();
  await startApplication(config);
}
~~~

`new URL()` 会先验证地址是否真能解析成绝对 URL，再由协议与凭据检查约束部署策略；只用 `startsWith("https://")` 会漏掉格式非法或包含嵌入式凭据的字符串。这里的 startApplication 由应用自身实现，并通过参数接收配置。这样 API 客户端不依赖全局可变变量，也便于单元测试传入不同配置。

## 发布边界

运行时文件应受 HTTPS、内容安全策略和缓存策略保护；若需要变更后立即生效，可为该文件设置短缓存或使用带版本的文件名。认证令牌、数据库口令和第三方私钥必须保留在服务端。配置读取失败时应显示可恢复的启动错误，而不是悄悄退回到未知地址。
