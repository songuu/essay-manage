# JavaScript 取整：先选正确语义，再做基准测试

适用范围：坐标、分页、输入解析和数值显示；关键原则：Math.trunc、floor、ceil 与 round 表达不同数学含义，性能结论必须在目标引擎和真实输入上测量；当前代码示例：下面比较负数取整语义并提供可复用的测量函数；常见误区/边界：parseInt 用于解析文本，位运算会转换为有符号 32 位整数；官方参考：[MDN Math.trunc](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc)。

取整前先回答“向零、向下、向上还是四舍五入”。一段运行得很快但在负数、超大数或无效输入上给出错误答案的代码，不是优化。

## 选择数学语义

~~~js
const value = -3.8;

console.log(Math.trunc(value)); // -3，向零截断
console.log(Math.floor(value)); // -4，向负无穷方向取整
console.log(Math.ceil(value)); // -3，向正无穷方向取整
console.log(Math.round(value)); // -4，取最接近的整数

console.log(Number.parseInt("42px", 10)); // 42，解析文本前缀
console.log(Number("42px")); // NaN，要求整个字符串是数值
~~~

不要用 parseInt 代替数值取整：它的职责是解析字符串，并会接受后缀内容。位运算技巧会先把值转换成 32 位有符号整数，可能溢出、丢失小数范围信息或把非有限值变成意外结果。

## 用可复现基准验证热点

~~~js
function measure(label, operation, values) {
  for (const value of values) {
    operation(value);
  }

  const startedAt = performance.now();
  let checksum = 0;

  for (const value of values) {
    checksum += operation(value);
  }

  console.log(label, performance.now() - startedAt, checksum);
}

const samples = Array.from({ length: 10_000 }, (_, index) => index / 3 - 2_000);

measure("trunc", Math.trunc, samples);
measure("floor", Math.floor, samples);
~~~

基准应包含预热、足够样本、结果消费以及目标浏览器或 Node.js 版本；还要覆盖正数、负数、边界值和真实数据分布。先用性能分析工具定位热点，再比较等价实现，不能从一次本机计时推广为通用速度排序。
