# JavaScript this：由调用方式决定，而非定义位置

适用范围：对象方法、类实例、事件处理和回调；关键原则：普通函数的 this 由调用点确定，箭头函数捕获外层 this，bind 可创建固定接收者的函数；当前代码示例：下面用箭头回调保留类实例，并用 event.currentTarget 读取事件元素；常见误区/边界：把方法单独传递会丢失接收者，箭头函数也不适合作为需要动态 this 的事件处理器；官方参考：[MDN this](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/this)。

在模块和类中，依赖“默认 this”通常会得到 undefined 或与预期不同的对象。判断 this 时，先看函数如何被调用，而不是它写在谁的内部。

## 方法被传递后需要显式保留接收者

~~~js
class Controller {
  saved = 0;

  save() {
    this.saved += 1;
  }

  attach(button) {
    button.addEventListener("click", () => this.save());
  }
}
~~~

箭头回调没有自己的 this，因此会使用 attach 调用期间的实例。若必须把普通方法作为独立回调传递，可在构造阶段或注册前使用 this.save.bind(this)，并保留该绑定后的引用以便后续移除监听器。

## 事件处理器优先读 event

~~~js
button.addEventListener("click", function handleClick(event) {
  console.log(event.currentTarget);
});
~~~

普通函数形式的浏览器事件监听器中 this 通常等于 currentTarget，但直接使用 event.currentTarget 更明确，也更容易迁移到其他回调 API。箭头函数适合捕获外层实例，却不会获得由事件系统提供的动态 this。

## 其余绑定规则

object.method() 会以 object 作为普通方法的 this；new 会创建新实例并绑定它；call、apply 和 bind 可以显式指定接收者，其中 bind 返回一个固定 this 的新函数。不要通过保存到临时变量、解构方法或把 this 当作全局状态来“猜”绑定结果。把依赖的对象作为显式参数传入，往往比复杂的 this 规则更易测试。
