###简单的整理webpack打包的时间出现的技巧和问题 

1.文件形式的存在 
```
module，chunk 和 bundle 其实就是同一份逻辑代码在不同转换场景下的取了三个名字：
我们直接写出来的是 module，webpack 处理时是 chunk，最后生成浏览器可以直接运行的 bundle。
```
2.filename和chunkFilename
```
filename 指列在 entry 中，打包后输出的文件的名称。
chunkFilename 指未列在 entry 中，却又需要被打包出来的文件的名称。
```
3.webpackPrefetch、webpackPreload 和 webpackChunkName
```
webpackChunkName 是为预加载的文件取别名，
webpackPreload 会在浏览器闲置下载文件，
webpackPreload 会在父 chunk 加载时并行下载文件。
```
4.
```
hash 计算与整个项目的构建相关；
chunkhash 计算与同一 chunk 内容相关；(index.js和index.css同时变化的时间，同时更新chunk)
contenthash 计算与文件内容本身相关。(index.js变化但是index.css不变化的时间，防止index.css资源的浪费)
```
5.sourceMap的整理
```
eval	打包后的模块都使用 eval() 执行，行映射可能不准；不产生独立的 map 文件
cheap	map 映射只显示行不显示列，忽略源自 loader 的 source map
inline	映射文件以 base64 格式编码，加在 bundle 文件最后，不产生独立的 map 文件
module	增加对 loader source map 和第三方模块的映射
```