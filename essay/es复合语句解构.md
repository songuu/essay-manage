# 赋值、复合赋值与解构：让求值顺序可读

适用范围：整理接口数据、设置默认值和维护对象状态；关键原则：赋值表达式从右向左结合，但左侧引用可能先被解析，涉及同一对象时应拆成独立步骤；当前代码示例：下面用解构、空值合并赋值和显式临时变量表达意图；常见误区/边界：解构默认值只处理 undefined，遇到 null 的嵌套属性仍需保护；官方参考：[MDN 解构赋值](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)。

链式赋值看起来简短，却容易把“当前变量”和“原对象属性”混在一起。尤其当左侧属性和右侧都修改同一绑定时，代码的真实执行顺序很难被代码审查捕捉。

## 避免同时重绑定与写属性

~~~js
const original = { name: "old" };
let current = original;

current.next = current = { name: "new" };

console.log(original.next === current); // true
console.log(current.name); // "new"
~~~

current.next 的属性引用在右侧赋值前已经确定，因此写入的是 original。更清晰的写法是先构造新值，再分别写出状态迁移：

~~~js
const next = { name: "new" };
original.next = next;
current = next;
~~~

## 用解构表达数据形状

~~~js
const response = {
  id: "article-1",
  title: "JavaScript",
  profile: null,
};

const { id, title: displayTitle = "未命名" } = response;
const { displayName = "游客" } = response.profile ?? {};

console.log(id, displayTitle, displayName);
~~~

对可能为 null 的对象，先通过 ?? 提供空对象，再解构其字段。不要用 || 替代 ??，否则 0、false 和空字符串也会被当成缺失值。

## 复合赋值的选择

~~~js
const options = { retryCount: 0, timeout: undefined };

options.timeout ??= 5_000;
options.retryCount ||= 3;

console.log(options); // { retryCount: 3, timeout: 5000 }
~~~

??= 仅在值为 null 或 undefined 时赋值；||= 会把所有假值视为需要默认值。选择前应确认 0、false 和空字符串在业务中是否是有效状态。涉及副作用的属性访问、函数调用或 Proxy 时，优先展开为明确的 if 语句。
