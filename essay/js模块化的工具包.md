### AMD CMD require.js common.js sea.js es6中间存在的模块化


**AMD.js、require.js、CMD**
```
AMD是requireJS在推广过程中对模块定义的规范化产出。
AMD是一个规范，只定义语法API，
而requireJS是具体的实现。
类似于ECMAScript和javascript的关系


1.AMD的特点是依赖前置，对于依赖的模块提前执行
2.CMD 是 SeaJS 在推广过程中对模块定义的规范化产出，它的特点是依赖就近，对于依赖的模块延迟执行


a.js和b.js
// AMD
define(['./a', './b'], function(a, b) {  // 依赖必须一开始就写好
    a.doSomething()    
    // 此处略去 n 行    
    b.doSomething()    
    ...
})

// CMD
define(function(require, exports, module) { 
    var a = require('./a')
     a.doSomething()  
    // 此处略去 n 行   
    var b = require('./b') // 依赖可以就近书写  
    b.doSomething()   
    // ... 
})
```

**common.js和sea.js**
```
CommonJS规范主要在NodeJS后端使用，前端浏览器不支持该规范
sea.js来源于阿里
```

**ES6**
```
ES6的Module模块主要通过export和import来进行模块的导入和导出
```