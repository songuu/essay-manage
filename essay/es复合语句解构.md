### 为了实现es6复合语句，可以使用更加规范的解析来看待赋值语句
> 形如a.x = a = a.y = {n: 2}；的情况的出现
#### 简单的来说就是边界问题的出现进一步混淆了对于赋值语句的理解工作
> AssignmentExpression : LeftHandSideExpression = AssignmentExpression
> 如果只是简单的使用以前的从右向左赋值的话，现在的问题就会很大

```
上面表达式的出现，会进一步加大这种理解的扁平化话的出现

有了表达式的出现，会进一步解决这个问题，但是会出现区分谁是LeftHandSideExpression的问题

简单的理解上面的公式：
1: a.x会作为LeftHandSideExpression,a = a.y = {n: 2}会作为AssignmentExpression
2: a会作为LeftHandSideExpression,a.y = {n: 2}会作为AssignmentExpression
3: a.y会作为LeftHandSideExpression,{n: 2}会作为AssignmentExpression
4: 最后只剩下{n: 2},此时就会允许对象字面量的出现
```



