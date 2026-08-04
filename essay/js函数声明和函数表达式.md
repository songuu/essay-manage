# 函数声明、函数表达式与箭头函数

适用范围：组织业务函数、回调与对象方法；关键原则：根据是否需要动态 this、构造能力或命名调试信息选择形式，并用 const 固定函数绑定；当前代码示例：下面比较声明、命名表达式和箭头函数；常见误区/边界：箭头函数没有自己的 this、arguments 或构造能力，函数提升也不应成为控制流程工具；官方参考：[MDN 函数](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Functions)。

函数声明适合模块级的具名行为；函数表达式适合把函数作为值传递；箭头函数适合简短回调和需要捕获外层 this 的场景。三者都能形成闭包，差异主要在绑定和调用语义。

## 三种常用写法

~~~js
function greet(name) {
  return "你好，" + name;
}

const parseUser = function parseUser(value) {
  return { id: String(value) };
};

const double = (value) => value * 2;

console.log(greet("Ada"));
console.log(parseUser(42));
console.log(double(21));
~~~

命名函数表达式的名称可改善堆栈信息，并且只在函数自身作用域内可用。以 const 保存表达式或箭头函数可避免后续意外重赋值。

## this 由函数形式与调用方式共同决定

~~~js
class Counter {
  value = 0;

  increment() {
    this.value += 1;
  }

  scheduleIncrement() {
    setTimeout(() => this.increment(), 0);
  }
}

const counter = new Counter();
counter.scheduleIncrement();
~~~

普通方法在以 object.method() 调用时会接收该对象作为 this。把方法单独传给回调会丢失这个调用者；上例的箭头回调捕获了 scheduleIncrement 的 this。若需要由调用方决定 this，使用普通 function 并在调用处以 bind、call 或正确的方法调用方式明确绑定。

不要依赖声明提升来提前调用函数，也不要把箭头函数用于需要 new、动态 this 或 generator 的位置。可读的定义顺序和明确的参数、返回值通常比“最短写法”更重要。
