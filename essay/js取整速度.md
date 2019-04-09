### 取整消耗时间
~~按位非 < <<0左移 < |0按位或 < Math.floor() < parseInt < toFixed()

**测试代码**
```
var numbers = []
for(var i = 0; i < 100000; i++) {
  numbers[i] = Math.floor(Math.random() * 100000) / 10000
}
var test
console.time('Math.floor()')
for (var i = 0; i < 100000; i++) {
  test = Math.floor(numbers[i])
}
console.timeEnd('Math.floor()')
var test
console.time('~~')
for (var i = 0; i < 100000; i++) {
  test = ~~ (numbers[i])
}
console.timeEnd('~~')
var test
console.time('<<0')
for (var i = 0; i < 100000; i++) {
  test = (numbers[i]) << 0
}
console.timeEnd('<<0')
var test
console.time('|0')
for (var i = 0; i < 100000; i++) {
  test = numbers[i] | 0
}
console.timeEnd('|0')
var test
console.time('parseInt')
for (var i = 0; i < 100000; i++) {
  test = parseInt(numbers[i])
}
console.timeEnd('parseInt')
var test
console.time('toFixed()')
for (var i = 0; i < 100000; i++) {
  test = numbers[i].toFixed(0)
}
console.timeEnd('toFixed()')
```