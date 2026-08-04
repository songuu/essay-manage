# 异步串行与并发：明确依赖和失败策略

适用范围：批量请求、顺序工作流和受限并发任务；关键原则：有数据依赖时用 for...of 加 await 串行执行，独立任务才并发，并为错误、取消和限流定义策略；当前代码示例：下面分别实现串行、Promise.all 并发和固定并发上限；常见误区/边界：Promise.all 提前拒绝不会自动取消其他任务，串行也不等于阻塞线程；官方参考：[MDN Promise 并发方法](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise#concurrency)。

异步函数在等待期间会把控制权交还给事件循环。“串行”描述的是下一项何时开始，不代表 JavaScript 引擎在等待网络时停止工作。

## 有依赖时串行

~~~js
const delay = (value, milliseconds) =>
  new Promise((resolve) => setTimeout(() => resolve(value), milliseconds));

const tasks = [
  () => delay("first", 30),
  () => delay("second", 20),
  () => delay("third", 10),
];

async function runSequentially(work) {
  const results = [];

  for (const task of work) {
    results.push(await task());
  }

  return results;
}

runSequentially(tasks).then(console.log);
~~~

不要把 async 回调交给 forEach 并期待外层等待完成；forEach 不会等待回调返回的 Promise。reduce 可以实现串行链，但在需要处理错误和中断时通常不如 for...of 清楚。

## 独立任务并发

~~~js
async function runInParallel(work) {
  return Promise.all(work.map((task) => task()));
}

runInParallel(tasks).then(console.log);
~~~

Promise.all 保留输入顺序的结果，但其中任何一个任务拒绝时会立即拒绝返回的 Promise，已启动的其他任务仍可能继续执行。若需要收集每项结论，使用 Promise.allSettled；若需要停止网络请求，应把同一个 AbortSignal 传给支持取消的任务。

## 控制并发数量

~~~js
async function runWithLimit(work, limit) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit 必须是正整数");
  }

  const results = Array(work.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < work.length) {
      const index = nextIndex++;
      results[index] = await work[index]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, work.length) }, () => worker()),
  );

  return results;
}
~~~

并发上限应来自服务端配额、浏览器连接限制和用户体验，而不是任意常量。为每一类任务记录超时、重试条件和幂等性，避免失败后盲目重放产生重复写入。
