**一:第一步**
1.根据 vm.$options.data 选项获取真正想要的数据（注意：此时 vm.$options.data 是函数）
2.校验得到的数据是否是一个纯对象
3.检查数据对象 data 上的键是否与 props 对象上的键冲突
4.检查 methods 对象上的键是否与 data 对象上的键冲突
5.在 Vue 实例对象上添加代理访问数据对象的同名属性
6.最后调用 observe 函数开启响应式之路
**二:第二步**
1.使用get收集依赖
2.使用set触发依赖
**关键函数(defineReactive)**


##### 监听控制数组变异:
```
	const mutationMethods = [
	  'push',
	  'pop',
	  'shift',
	  'unshift',
	  'splice',
	  'sort',
	  'reverse'
	]
	
	const arrayMethods = Object.create(Array.prototype) // 实现 arrayMethods.__proto__ === Array.prototype
	const arrayProto = Array.prototype  // 缓存 Array.prototype
	
	mutationMethods.forEach(method => {
	  arrayMethods[method] = function (...args) {
	    const result = arrayProto[method].apply(this, args)
	
	    console.log(`执行了代理原型的 ${method} 函数`)
	
	    return result
	  }
	})
```

> 但是上面的方法只是使用于ie11+ __prop__



##### 兼容方法:
```
	const arr = []
	const arrayKeys = Object.getOwnPropertyNames(arrayMethods)
	
	arrayKeys.forEach(method => {
	  arr[method] = arrayMethods[method]
	})
	
	
	arrayKeys.forEach(method => {
	  Object.defineProperty(arr, method, {
	    enumerable: false,
	    writable: true,
	    configurable: true,
	    value: arrayMethods[method]
	  })
	})
```