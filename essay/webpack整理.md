# webpack 构建整理：产物、缓存与配置分层

适用范围：需要代码拆分、静态资源处理和长期缓存的 Web 应用；关键原则：源文件是 module，入口与动态 import 形成 chunk，输出文件是 asset，并把构建时常量与运行时公开配置分开；当前代码示例：下面用 contenthash、splitChunks 和动态 import 生成可缓存产物；常见误区/边界：构建时定义会写入文件，不能保存密钥，哈希文件只有配合正确缓存头才有价值；官方参考：[webpack Getting Started](https://webpack.js.org/guides/getting-started/)。

webpack 读取模块图后生成一个或多个 chunk，再将它们和图片、字体等资源写为文件。一个概念在不同阶段的名称不同，理解这个边界比记住某个配置片段更重要。

## 稳定的生产构建骨架

~~~js
const path = require("node:path");
const { DefinePlugin } = require("webpack");

module.exports = {
  mode: "production",
  entry: "./src/main.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    clean: true,
    filename: "assets/[name].[contenthash].js",
    chunkFilename: "assets/[name].[contenthash].chunk.js",
    assetModuleFilename: "assets/[name].[contenthash][ext][query]",
  },
  optimization: {
    runtimeChunk: "single",
    splitChunks: { chunks: "all" },
  },
  devtool: "source-map",
  plugins: [
    new DefinePlugin({
      __BUILD_CHANNEL__: JSON.stringify(process.env.BUILD_CHANNEL ?? "stable"),
    }),
  ],
};
~~~

filename 对应入口输出，chunkFilename 对应异步 chunk。contenthash 随文件内容改变，适合不可变缓存；部署时仍要确认 HTML 引用更新，并为哈希资源与入口文档设置不同的缓存策略。

## 动态 import 是拆分边界

~~~js
export async function openEditor() {
  const { mountEditor } = await import("./editor.js");
  return mountEditor();
}
~~~

动态 import 返回 Promise，webpack 会据此形成按需加载的 chunk。是否预取或预加载应根据真实网络瀑布和用户路径验证，不能仅凭注释或经验默认开启。

## 构建时与运行时配置

DefinePlugin 的值会在构建时写进 JavaScript，只适合发布渠道、构建标识等公开常量。服务地址等可随部署变化的公开参数，应由应用启动时读取受校验的运行时 JSON；令牌和密钥始终留在服务端。source map 也可能暴露源码信息，生产环境应根据发布策略限制其可见范围。
