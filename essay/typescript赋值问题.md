###由于在js中是弱类型，所以就不会出现这种问题的出现
例1：
```
interface Named {
    name: string;
}

let x: Named;
let y = { name: 'Alice', location: 'Seattle' };
x = y;

```

> 此时就会赋值成功
但是下面这种情况
```
interface Named {
    name: string;
    location: number;
}

let x: Named;
let y = { name: 'Alice', location: 'Seattle' };
x = y;
```
>现在就会出现类型不匹配的情况

例2：

```
let x = (a: number) => 0;
let y = (b: number, s: string) => 0;

y = x; // OK
x = y; // Error
```

**实现1**
> 要查看x是否能赋值给y，首先看它们的参数列表。 x的每个参数必须能在y里找到对应类型的参数。 
> 注意的是参数的名字相同与否无所谓，只看它们的类型。 
> 这里，x的每个参数在y中都能找到对应的参数，所以允许赋值。
**实现2**
> 第二个赋值错误，因为y有个必需的第二个参数，但是x并没有，所以不允许赋值。


#### 泛型匹配
```
interface Empty<T> {
}
let x: Empty<number>;
let y: Empty<string>;

x = y;  // okay
```

> 上面的例子是成功的，但是是看不来怎么工作的
> 添加一个参数就可以了

```
interface NotEmpty<T> {
    data: T;
}
let x: NotEmpty<number>;
let y: NotEmpty<string>;

x = y;  // error
```

> 因为第一个例子在匹配的时间是兼容的
> 但是在第二个例子中间就不是兼容的


**下面的特殊情况**

```
let identity = function<T>(x: T): T {
    // ...
}

let reverse = function<U>(y: U): U {
    // ...
}

identity = reverse;  // Okay
```
> 在没有指定具体的泛型参数的时间，对应的就是any类型，所以就能匹配成功