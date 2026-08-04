# JavaScript 循环：按集合和控制需求选择

适用范围：遍历数组、对象属性、可迭代数据和异步任务；关键原则：数组值优先用 for...of，对象自有键用 Object.entries，需要提前退出时避免 forEach；当前代码示例：下面用 entries() 同时读取索引和值；常见误区/边界：for...in 会枚举可枚举属性而非数组元素，串行 await 会降低吞吐；官方参考：[MDN 循环与迭代](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Loops_and_iteration)。

循环方式不是性能排行榜，而是控制流与数据类型的选择。可读性、能否 break、是否需要等待异步结果，通常比语法更决定正确性。

## 数组和其他可迭代对象

~~~js
const labels = ["草稿", "审核中", "已发布"];

for (const [index, label] of labels.entries()) {
  if (label === "审核中") {
    console.log("找到第 " + index + " 项");
    break;
  }
}
~~~

for...of 读取迭代值，适用于 Array、Set、Map、字符串和自定义 iterable。forEach 适合不需要 break、continue 或 await 控制的简单副作用；从 forEach 回调 return 只会返回回调，不能停止外层遍历。

## 遍历普通对象

~~~js
const article = { title: "循环", published: true };

for (const [key, value] of Object.entries(article)) {
  console.log(key, value);
}
~~~

for...in 会遍历对象及其原型链上的可枚举键，除非确实需要这种行为，否则优先使用 Object.keys、Object.values 或 Object.entries。不要对数组使用 for...in，因为键是字符串并且可能包含额外属性。

## 异步循环的取舍

~~~js
for (const task of tasks) {
  await task();
}
~~~

这段代码会按顺序执行任务，适合后一个任务依赖前一个结果、或必须限制请求速率的场景。相互独立的任务应使用 Promise.all 或显式的并发上限；并发方案的失败处理、取消与结果顺序需要另行定义，不能只把 for 循环改成 map。
