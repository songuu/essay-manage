# JavaScript 模块化：以 ESM 为默认边界

适用范围：浏览器应用、Node.js 服务和可发布的 JavaScript 包；关键原则：一个模块公开明确的 export，消费者用静态 import 建立依赖图，动态 import 只用于真正按需加载的边界；当前代码示例：下面展示具名导出、相对导入和异步加载；常见误区/边界：不同运行时对旧包的默认导入形状可能不同，迁移时必须集中适配并测试实际出口；官方参考：[MDN JavaScript 模块](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules)。

ESM 是现代 JavaScript 的标准模块格式。静态 import 能让运行时和打包器分析依赖、检查未使用导出，并更可靠地拆分代码。

## 从明确的导出开始

~~~js
// formatters.js
export function formatTitle(value) {
  return value.trim().replaceAll(/\s+/g, " ");
}

export const defaultLocale = "zh-CN";

// main.js
import { defaultLocale, formatTitle } from "./formatters.js";

console.log(defaultLocale, formatTitle("  模块   边界  "));
~~~

浏览器和 Node.js 的 ESM 相对导入通常要求写出文件扩展名。将导出保持小而稳定，比暴露一个不断增长的全局工具对象更容易维护。

## 只在需要时动态加载

~~~js
export async function loadChartRenderer() {
  const module = await import("./chart-renderer.js");
  return module.renderChart;
}
~~~

动态 import 返回 Promise，适合路由、编辑器或体积较大的可选功能。它不应被用来掩盖循环依赖或延迟处理本应启动时失败的基础模块。

## 迁移旧包时建立适配层

若某个依赖仍以旧式导出方式发布，其命名空间和默认导出的形状取决于包的 exports 字段、运行时和打包器。把互操作逻辑集中在一个适配模块中，只向应用其余部分导出稳定的 ESM API；逐个迁移入口并在目标环境执行导入测试。不要把两套加载语义散落在业务代码里。
