### 使用nextstick进行异步的实现

#### 简单的来说  nextstick的实现其实与settimeout的实现的效果相似，但是在vue中间更加推崇的是前者
> 常见的出现的场所是

```
1:通过父组件的更新来实现子组件的更新
在父组件中间获取子组件的数据，然后到子组件中间去使用，但是在传递过程中间会进入任务队列中，此时如果不适用异步操作就会出现，使子组件拿不到数据
2:和promise的同时使用
```

#### 现在出现的问题(从v8引擎后面)

```
async function async1(){
    console.log('async1 start')
    await async2()
    console.log('async1 end')
}
async function async2(){
    console.log('async2')
}
console.log('script start')
setTimeout(function(){
    console.log('setTimeout') 
},0)  
async1();
new Promise(function(resolve){
    console.log('promise1')
    resolve();
}).then(function(){
    console.log('promise2')
})
console.log('script end')
```

>1 输出的顺序为: script start  ->  async1 start ->  async2  -> promise1 -> async1 end  -> promise2  -> setTimeout
>2 输出的顺序为：script start  ->  async1 start ->  async2  -> promise1 -> promise2 -> async1 end  -> setTimeout(v8引擎及之后)

出现这种问题的原因是：
```
async function() {
	await p
	console.log(1)
}
常见的解析方法

1.Promise.resolve(p).then(() =>  {console.log(1)})  此时的p事件，就会直接出现在队列的末尾，当promise对象执行之后，马上就会去执行then里面的函数
2.new Promise((resolve) => {resolve(p)}).then(() => {console.log(1)})  v8之前的就会新建一个Promise对象  此时就会直接进入最新的resolve阶段，不会在then之后直接执行
```

但是现在主要的的引擎还是v8以上，而且await的解析还是以Promise.resolve()

**promise例题**
```
let resolvePromise = new Promise(resolve => {
  let resolvedPromise = Promise.resolve()
  resolve(resolvedPromise)
})
resolvePromise.then(() => {
  console.log('resolvePromise resolved')
})
let resolvedPromiseThen = Promise.resolve().then(res => {
  console.log('promise1')
})
resolvedPromiseThen
  .then(() => {
    console.log('promise2')
  })
  .then(() => {
    console.log('promise3')
  })
```

> 执行的顺序: promise1 -> promise2 -> resolvePromise resolved -> promise3
主要是'resolvePromise resolved'的出现在两个promise(then)中间，导致问题的出现

> Promise.resolve()的执行优先级要高于new Promise()
