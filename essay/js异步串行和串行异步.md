### js中间的异步串行和串行异步

#### 串行异步
**简单的说来就是，需要完成前面的请求才能实现后面的请求**

> 结合前面的文章，主要的方式还是通过
1. promise
2. async和await
3. generator
主要是前面的三种方法

```
const arr = [
	'a.com',
	'b.com',
	'c.com'
]


1. promise.resolve的实现
但是现在需要结合map和reduce

arr.reduce((prev,next)=>{
    return prev.then(()=>Axios.get(next));
}, Promise.resolve())

let resolve=Promise.resolve();
arr.map(item=>{
     resolve=resolve.then(()=>{
         return new Promise(item);
     })
})

2. async和await的实现
async function go(){
    for(let i=0;i<arr.length;i++){
        await new Promise(resolve=>{
            arr[i](resolve);
        })
    }
}
go();


更好理解的方式

arr.reduce(async (prev,next)=>{
    await prev;//等待上一个Promise
    return Axios.get(next);//返回一个新的Promise
}, Promise.resolve())

Promise.resolve() > new Promise()


3.generator的实现
function* go(){
    for(let i=0;i<arr.length;i++){
        yield new Promise(resolve=>{
            arr[i](resolve);
        });
    }
}
let g=go();
let run=(p)=>{
    if(!p.done){
        p.value.then(()=>{
            run(g.next())
        })
    }
}
run(g.next());


假设上面的三种请求的过程为 f1,f2,f3

在实际的请求过程中间
Promise.resolve(f1).then(()=>new Promise(f2)).then(()=>new Promise(f3))
f1 -> f2 -> f3
```

> 在实际的测试中间存在这样的一个过程

```
const fucArr = [
    next => {
        setTimeout(() => {
            console.log(1);
            next()
        }, 300)
    },
    next => {
        setTimeout(() => {
            console.log(2);
            next()
        }, 200)
    },
    next => {
        setTimeout(() => {
            console.log(3);
            next()
        }, 100)
    }
]

使上面的执行顺序为1，2，3 ？

如果直接执行上面返回的是3，2，1

这个时间就需要串行异步的介入

async function go(){
    for(let i=0;i<fucArr.length;i++){
        await new Promise(resolve=>{
            fucArr[i](resolve);
        })
    }
}
go();

=》 1，2，3
```

#### 串行异步

**可以用来解决实际请求中间的多个请求同时完成后，才能执行下一个过程或请求**

> 主要是使用Promise.all([])和Promise.race([])

```
function all() {
	new Promise.all([a, b, c]).then((res) => {
		console.log(res[0] + res[1] + res[2])  //6
	})
}

function a() {
	return new Promise((resolve, reject) => {
		resolve(1)
	})
}
function b() {
	return new Promise((resolve, reject) => {
		resolve(2)
	})
}
function c() {
	return new Promise((resolve, reject) => {
		resolve(3)
	})
}
```


