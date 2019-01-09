###js中间有很多中循环的方式

1.for
2.while
3.do...while
4.forEach
5.for...in
6.for...of


>for最简单的循环方法
>while
>do...while
>forEach
```
list.forEach(item => console.log(item))
```

**但是在forEach中没有办法停止，必须循环完**

>for...in
```
for (let property in object) {
  console.log(property) //property name
  console.log(object[property]) //property value
}
```

>for...of
```
// 迭代值
for (const value of ['a', 'b', 'c']) {
  console.log(value) //value
}
//使用 `entries()`,获取索引
for (const [index, value] of ['a', 'b', 'c'].entries()) {
  console.log(index) //index
  console.log(value) //value
}
```

**for...in和for...of的区别**
>for...of 迭代属性值
>for...in 迭代属性名


**for..in可以操作任何对象；它提供了查看对象属性的一种方法**
**for..of关注于迭代对象的值**

```
let pets = new Set(["Cat", "Dog", "Hamster"]);
pets["species"] = "mammals";

for (let pet in pets) {
   console.log(pet); // "species"
}

for (let pet of pets) {
    console.log(pet); // "Cat", "Dog", "Hamster"
}
```