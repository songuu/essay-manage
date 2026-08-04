# JavaScript 分号与自动插入：让换行不改变含义

适用范围：使用无分号风格的 JavaScript 与代码生成结果；关键原则：自动分号插入只在特定语法位置发生，格式化规则必须阻止下一行意外续接上一行；当前代码示例：下面在以数组开头的语句前主动放置分号；常见误区/边界：return 后换行会返回 undefined，throw 后换行甚至是语法错误；官方参考：[MDN 自动分号插入](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Lexical_grammar#automatic_semicolon_insertion)。

团队可以选择始终写分号，或由格式化工具统一省略分号。关键不是个人偏好，而是让源代码在插入、合并和压缩后仍有稳定的语法边界。

## 行首可能续接上一行时

~~~js
const ids = [1, 2, 3]

;[4, 5].forEach((id) => {
  console.log(id)
})
~~~

如果省略第一个分号，方括号可能被解析为对上一行数组结果的访问。以圆括号、方括号、正则字面量、加号或减号开头的语句，都应检查是否会与前一行连接；在无分号代码库中，防御性行首分号是常见做法。

## return 必须携带返回值

~~~js
function brokenResult() {
  return
  {
    ok: true,
  }
}

function validResult() {
  return {
    ok: true,
  }
}

console.log(brokenResult()); // undefined
console.log(validResult()); // { ok: true }
~~~

换行后的对象不会成为 return 的值。break 与 continue 的标签、以及 throw 的表达式也不应拆到下一行。最可靠的防线是启用项目已有的格式化器和 lint 规则，并在提交前自动执行；不要靠人工背诵所有自动插入规则。
