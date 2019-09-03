## Babel是在es6以及更高的es转换为es5语法   方便浏览器识别

```
@babel/core  AST转换的核心
@babel/cli  打包工具
@babel/plugin* Babel 插件机制，Babel基础功能不满足的时候,手动添加些
@babel/preset-env*  把许多 @babel/plugin* 综合了下，减少配置
@babel/polyfill 把浏览器某些不支持API，兼容性代码全部导入到项目,不管你是不是用到,缺点是代码体积特别大
@babel/runtime 把你使用到的浏览器某些不支持API，按需导入,代码少
```

```
Babel 只是转换 syntax 层语法,所有需要 @babel/polyfill 来处理API兼容,又因为 polyfill 体积太大，所以通过 preset的 useBuiltIns 来实现按需加载,再接着为了满足 npm 组件开发的需要 出现了 @babel/runtime 来做隔离
```
