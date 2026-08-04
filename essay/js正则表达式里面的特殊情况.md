# JavaScript 正则表达式：边界、断言与状态

适用范围：格式校验、有限文本提取和受控替换；关键原则：正则只描述局部文本模式，先处理输入语义，再使用明确的边界、分组和标志；当前代码示例：下面用非捕获分组和正向断言添加千分位；常见误区/边界：\b 不是中文分词，带 g 或 y 的 RegExp 会保存 lastIndex 状态；官方参考：[MDN 正则表达式](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Regular_expressions)。

正则表达式适合结构简单、规则稳定的文本。日期、金额、地址和用户输入在真实系统里往往还需要语义校验、范围校验或专用解析器，不能只看“是否匹配”。

## 使用断言而不吞掉分隔符

~~~js
function formatThousands(text) {
  const [integer, fraction] = text.split(".");
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return formatted + (fraction === undefined ? "" : "." + fraction);
}

console.log(formatThousands("1234567.89")); // 1,234,567.89
~~~

\B 匹配非单词边界，正向断言只检查后面的数字而不把它们放进匹配结果。若输入本来是数值而不是文本，展示千分位优先使用 Intl.NumberFormat，它能处理区域设置与小数规则。

## 边界与用户输入

JavaScript 的 \b 基于 \w 的定义，默认不是按中文词语边界工作。对自然语言搜索应使用分词、Intl.Segmenter 或明确的字符范围。把用户输入拼进正则前，优先使用现代运行时提供的 RegExp.escape；若目标环境没有它，应使用经过测试的转义函数，而不是直接拼接。

## 避免全局正则的隐式状态

~~~js
const pattern = /ok/g;

console.log(pattern.test("ok")); // true
console.log(pattern.test("ok")); // false，搜索从上次的 lastIndex 继续

pattern.lastIndex = 0;
console.log(pattern.test("ok")); // true
~~~

带 g 或 y 标志的实例会更新 lastIndex。不要在不相关的请求或异步任务之间共享这类实例；每次创建新实例，或在调用前明确重置状态。后行断言在现代环境中可用，但若项目要支持较旧目标，应先确认兼容范围并提供不依赖它的解析方案。
