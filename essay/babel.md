# Babel：按目标环境转换语法与补齐能力

适用范围：需要支持不同浏览器或运行时的 JavaScript 项目；关键原则：先声明实际 targets，再让 preset-env 选择语法转换，API 兼容按使用情况和项目策略引入；当前代码示例：下面的 babel.config.json 只为支持的模块环境生成转换；常见误区/边界：语法转换不会自动实现缺失的 Web API，库代码也不应擅自污染宿主全局环境；官方参考：[Babel preset-env](https://babeljs.io/docs/babel-preset-env)。

Babel 的核心工作是解析、转换并生成 JavaScript。是否需要转换 async、可选链或模块语法，取决于目标环境而不是源文件使用了哪一代语法。

## 从目标浏览器开始配置

~~~json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          "esmodules": true
        }
      }
    ]
  ]
}
~~~

targets 应来自产品明确支持的浏览器或运行时范围，并可由项目的 browserslist 统一维护。不要为并不需要的旧环境生成大量转换，也不要把构建工具本身的版本当成兼容性目标。

上例按 Babel 8 编写：不要再声明 `bugfixes`。该选项是 Babel 7 中可显式开启的兼容性开关；在 Babel 8 中相应行为已成为默认策略，`bugfixes` 配置项已移除，不再需要也不应继续保留。若项目仍锁定 Babel 7，才可根据当时的 preset-env 文档在迁移前保留 `bugfixes: true`，升级到 Babel 8 时应移除它并重新验证产物。

## 语法与 API 是两条链路

Promise、URL、Intl 等是运行时 API；即使代码语法被转换，目标环境仍可能没有这些能力。应用可依据 targets 选择按使用处注入的兼容实现，并让锁文件管理对应依赖的准确版本。对库而言，应清楚声明宿主需要提供哪些 API，或使用不会修改全局对象的运行时帮助方案。

每次调整 targets 或兼容策略后，都应在真实目标环境运行关键流程。Babel 配置不是“越多越安全”：过宽的支持范围会增加产物、测试矩阵和维护成本。
