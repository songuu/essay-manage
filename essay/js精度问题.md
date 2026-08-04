# JavaScript 数值精度：区分浮点、整数与显示格式

适用范围：金额、比例、计量值和大整数标识的计算；关键原则：Number 是二进制浮点数，比较应使用业务容差，精确金额应以最小货币单位保存；当前代码示例：下面用相对误差比较小数并以分为单位相加；常见误区/边界：toFixed 只负责显示，BigInt 不能与 Number 直接混算；官方参考：[MDN Number.EPSILON](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON)。

大多数小数无法被二进制浮点精确表示，所以 0.1 + 0.2 不一定严格等于 0.3。这是表示方式的结果，不是某个浏览器的单独缺陷。

## 比较近似值

~~~js
function nearlyEqual(left, right) {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= Number.EPSILON * scale;
}

const total = 0.1 + 0.2;

console.log(total === 0.3); // false
console.log(nearlyEqual(total, 0.3)); // true
~~~

Number.EPSILON 只适合相近量级的计算。科学计算、传感器数据和业务阈值应使用领域定义的误差，而不是把任意差异都与 EPSILON 比较。

## 金额使用最小单位

~~~js
const pricesInCents = [199, 299, 450];
const totalInCents = pricesInCents.reduce((sum, cents) => sum + cents, 0);

const formatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
});

console.log(formatter.format(totalInCents / 100));
~~~

把金额以分等最小单位保存，只有在展示时才换算为小数。跨币种、税务或需要任意精度小数的领域，应采用后端约定的十进制方案或专门的十进制库，并明确舍入规则。

## 安全整数与 BigInt

Number 只能精确表示有限范围内的整数，写入数据库 ID、时间单位或计数器前可用 Number.isSafeInteger 检查。超过该范围的纯整数可用 BigInt，但 1n + 1 会抛错；两种数值类型之间必须先做有意识的转换。不要通过覆盖原型或给数值加“魔法补偿”来修正显示结果，应该在业务边界选择正确的表示与舍入时机。
