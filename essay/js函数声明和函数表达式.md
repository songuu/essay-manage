### js中间的函数三种形式
1.函数声明
2.函数(赋值)表达式
3.函数对象(Function)

但是常用的还是前两种

**函数声明**
```
function foo() {}
```

**函数(赋值)表达式**
```
let f = function() {}
```

以前面试的一个题
```
let f = function g() {}

f() //ƒ g() {}

g() //undefined
```

#### 在js函数的使用过程中间可能出现的问题很多(特别是函数的执行的顺序问题)
> js解析函数分为两个阶段
1.预编译阶段
	1.此时处理函数的只是 声明式函数(函数声明)
	2.变量也只是进行了声明但是没有进行初始化和赋值
2.编译执行阶段
	1.从上至下执行编译

##### 下面是会出现的几种情况
1.同时都是函数声明
```
g() //2

function g() {console.log(1)}
function g() {console.log(2)}
```
> 出现这种情况下，后面的覆盖前面的
2.一个是函数声明，一个函数(赋值)表达式
```
g() //1

function g() {console.log(1)}
var g = function() {console.log(2)}
```
> 函数声明提前于函数赋值表达式

```
function g() {console.log(1)}
var g = function() {console.log(2)}

g() //2
```
> 上面的情况出现在开始调用和尾部调用，尾部调用就是函数赋值表达式覆盖函数函数声明，后面的覆盖前面的

3.函数声明和变量声明
```
console.log(f);  // Function
function f() {
  console.log(1);
}
var f = 3;
```
>函数提升的优先级大于变量提升的优先级

常见面试题:
```
f();
var scope = 'out';
function f() {
  console.log(scope); //undefined
  var scope = 'in';
  console.log(scope); //'in'
}
console.log(scope); //'out'
```
上面的代码等价于:
```
var scope = 'out';
function f() {
  var scope;
  console.log(scope);
  scope = 'in';
  console.log(scope);
}
f();
console.log(scope);
```

