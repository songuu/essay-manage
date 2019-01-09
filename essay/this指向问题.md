###vue  this的指向问题的出现
**首先是正常的情况**
1. 如果这个函数是function#bind调用的结果，那么this指向的是传入bind的参数
2. 如果函数是以foo.func()形式调用的，那么this值为foo
3. 如果是在严格模式下，this将为undefined
4. 否则，this将是全局对象（浏览器环境里为window）

> 上面4种来确定正常this的指向问题



**首先出现在mounted的setTimeout函数中间，就会出现this的乱指向的问题**
**其次在全局js中间使用this的时候， this!= VM **

#### 正确的使用this调用
例子：
```
var x = new MyObject();
x.printThing(); // SAFE

var y = x.printThing; // DANGER

window.addEventListener('click', x.printThing, 10); // DANGER

window.addEventListener('click', () => x.printThing(), 10); // SAFE
```

1. 可以确定this的指向
2. y没有正确的this的指向
3. 引入的时间没有被提及
4. 可以确定this的指向