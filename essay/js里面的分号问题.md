###  js里面存在的分号问题，会影响程序的执行

#### 第一点：自动加入分

```
1.当下一行代码开始会破坏当前一行的代码时( JavaScript 代码可以写在多行中 )。如果一条语句以(、[、/、+或-开始，那么它极有可能和前面一条语句合在一起解析。
2.当下一行以 } 开头时，或者以 } 结束闭合当前代码块时
3.当解析到达源代码文件的末尾时
4.当前行 return 语句后面紧跟着换行时
5.当前行 break 语句后面紧跟着换行时
6.当前行 throw 语句后面紧跟着换行时
7.当前行 continue 语句后面紧跟着换行时
```


**常见的代码错误**
1. 例子1：
```
const hey = 'hey'
const you = 'you'
const heyYou = hey + ' ' + you
 
['h', 'e', 'y'].forEach((letter) => console.log(letter))

以为的结果是 'hey you' 'h','e','y'

但是结果是错的

现在的错误就是出现undefined

因为在js解析的时间，const heyYou = hey + ' ' + you['h', 'e', 'y'].forEach((letter) => console.log(letter))

出现在一排，一起执行
```

**类似于下面的代码**

```
const a = 1
const b = 2
const c = a + b
(a + b).toString()

js编译的时间还是const c = a + b(a + b).toString()
```

2.例子2:
```
var         // 这一行不会插入分号 ，因为 下一行的代码不会破坏当前行的代码  
    a = 1   // 这一行会插入分号   
let b = 2 
```

3.例子3:
```
(() => {
  return
  {
    color: 'white'
  }
})()

出现打印的是undefined


(() => {
  return {
    color: 'white'
  }
})()

出现的是 {color: 'white'}
```


#####注意事项

> 请注意 return 语句。 如果你想返回一些东西，把它添加到与 return 同一行上（同样用于 break ，throw ，continue）。
> 永远不要用 (、[、/、+或- 开始一行，这些可能与前一行连接以形成函数调用或数组元素引用。

