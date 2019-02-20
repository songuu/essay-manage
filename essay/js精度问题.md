####### 在现实的操作中间存在的js精度问题

**例子**
```
(1.55).toFixed(1)  //1.6
(2.55).toFixed(1)  //2.5
(3.55).toFixed(1)  //3.5
```
> 首先按照常理来说  2.55 => 2.6 3.55 => 3.6 但是现在出现了错误

> 数字在V8里面的存储有两种类型，一种是小整数用Smi，另一种是除了小整数外的所有数

> 这种情况的存在: 根本原因在于2.55的存储要比实际存储小一点，导致0.05的第1位尾数不是1，所以就被舍掉了。

实际在js的存储体系中，很多存在这种实际的值比显示的值要小的情况(小数)

**可以使用修订版本的toFixed**

```
if (!Number.prototype._toFixed) {
    Number.prototype._toFixed = Number.prototype.toFixed;
}
Number.prototype.toFixed = function(n) {
    return (this + 3e-16)._toFixed(n);
}

(1.55).toFixed(1)  //1.6
(2.55).toFixed(1)  //2.6
(3.55).toFixed(1)  //3.6

```