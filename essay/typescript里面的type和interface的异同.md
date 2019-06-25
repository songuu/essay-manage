### 现在typescript 使用越来越频繁

**相同**
1.都可以用来描述一个对象或函数

```
interface User {
  name: string
  age: number
}

type User = {
  name: string
  age: number
};

interface SetUser {
  (name: string, age: number): void;
}
type SetUser = (name: string, age: number): void;
```
2.都允许拓展（extends）
###### interface extends interface

```
interface Name { 
  name: string; 
}
interface User extends Name { 
  age: number; 
}
```
###### type extends type

```
type Name { 
  name: string; 
}
type User = Name & { age: number  };
```
###### interface extends type

```
type Name = { 
  name: string; 
}
interface User extends Name { 
  age: number; 
}
```

###### type extends interface

```
interface Name { 
  name: string; 
}
type User = Name & { 
  age: number; 
}

```

##### 由此上可看出，interface 可以直接使用extentd关键字，但是在type中间必须使用&

**不同**
1.type 可以声明基本类型别名，联合类型，元组等类型

```
// 基本类型别名
type Name = string

// 联合类型
interface Dog {
    wong();
}
interface Cat {
    miao();
}

type Pet = Dog | Cat
```
2.type 语句中还可以使用 typeof获取实例的 类型进行赋值

```
let div = document.createElement('div');
type B = typeof div


type Tree<T> = T | { left: Tree<T>, right: Tree<T> };
```
3.interface 能够声明合并

```
interface User {
  name: string
  age: number
}

interface User {
  sex: string
}

/*
User 接口为 {
  name: string
  age: number
  sex: string 
}
*/
```
4.interface 有可选属性和只读属性

```
interface Person {
  name: string;
  age?: number;
  gender?: number;
}
```

