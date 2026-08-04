# JavaScript 生成器：可暂停的迭代流程

适用范围：分页、批处理、按需序列和教学性的状态机；关键原则：调用生成器函数只创建迭代器，代码在 next() 或 for...of 消费时才运行到下一个 yield；当前代码示例：下面把数组按固定大小分批返回；常见误区/边界：生成器是单次消费的迭代器，不会自动并发或替代普通数组操作；官方参考：[MDN Generator](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Generator)。

生成器函数使用 function* 定义，yield 暂停函数并交出一个值。每次调用 next() 都会从上次暂停处恢复，直到 return 或函数结尾将 done 设为 true。

## 按需生成批次

~~~js
function* batches(values, size) {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new RangeError("size 必须是正整数");
  }

  for (let start = 0; start < values.length; start += size) {
    yield values.slice(start, start + size);
  }
}

const iterator = batches(["a", "b", "c", "d", "e"], 2);

console.log(iterator.next()); // { value: ["a", "b"], done: false }

for (const batch of iterator) {
  console.log(batch);
}
~~~

for...of 会持续调用 next() 并读取 value。上例在手动读取第一批后，循环从第二批继续；每次重新调用 batches 才会获得新的迭代器。先拒绝非正整数很重要：`size === 0` 会使 `start` 永不前进，造成无限迭代；小数、`NaN` 和无穷大也不应被悄悄截断或接受。

## 双向传值与资源边界

~~~js
function* requestId() {
  const id = yield "请输入 id";
  return { id };
}

const flow = requestId();
console.log(flow.next().value);
console.log(flow.next("user-1").value);
~~~

next(value) 会把 value 作为上一个 yield 表达式的结果。实际业务中，不要用生成器伪装异步控制流；网络分页等异步来源更适合 async generator 与 for await...of。若迭代器持有文件、连接或订阅，应在 finally 中释放资源，并让消费者能够提前结束迭代。
