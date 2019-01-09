### Typescript 中间的mixins模式

> Typescript中的声明会创建以下三种实体之一：命名空间，类型或者值。
> 用于创建命名空间的声明会新建一个命名空间：它包含了可以用（.）符号访问的一些名字。 
> 用于创建类型的声明所做的是：用给定的名字和结构创建一种类型。 
> 最后，创建值的声明就是那些可以在生成的JavaScript里看到的那部分（比如：函数和变量）。

##### 合并接口


**简单的合并**
```
interface Box {
    height: number;
    width: number;
}

interface Box {
    scale: number;
}

let box: Box = {height: 5, width: 6, scale: 10};
```
> 合并过程中接口中非函数的成员必须是唯一的。如果多个接口中具有相同名字的非函数成员就会报错。

**复杂的合并**
```
interface Document {
    createElement(tagName: any): Element;
}
interface Document {
    createElement(tagName: string): HTMLElement;
}
interface Document {
    createElement(tagName: "div"): HTMLDivElement;
    createElement(tagName: "span"): HTMLSpanElement;
    createElement(tagName: "canvas"): HTMLCanvasElement;
}

//最后的合并的结果
interface Document {
    createElement(tagName: "div"): HTMLDivElement;
    createElement(tagName: "span"): HTMLSpanElement;
    createElement(tagName: "canvas"): HTMLCanvasElement;
    createElement(tagName: string): HTMLElement;
    createElement(tagName: any): Element;
}
```

**最后申明的函数，所拥有的等级越高**

##### 合并命名空间

**简单的合并**
```
namespace Animals {
    export class Zebra { }
}

namespace Animals {
    export interface Legged { numberOfLegs: number; }
    export class Dog { }
}

//合并结果

namespace Animals {
    export interface Legged { numberOfLegs: number; }

    export class Zebra { }
    export class Dog { }
}
```

**非共享变量不能共享，也就是不能合并**

##### 命名空间和类和和函数和枚举的合并

```
function buildLabel(name: string): string {
    return buildLabel.prefix + name + buildLabel.suffix;
}

namespace buildLabel {
    export let suffix = "";
    export let prefix = "Hello, ";
}
```

#### 并不是所有的合并都被允许
> 现在，类不能与类合并，变量与类型不能合并，接口与类不能合并。
