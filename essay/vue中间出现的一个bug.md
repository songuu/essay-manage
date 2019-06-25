#### 在vue中间最近项目中间出现的一个bug

> 项目代码如下
```
return new Promise((resolve, reject) => {
	api.allTypeQuery('OrgType').then(res => {
		if(res.data.code === 0) {
			resolve(res.data.data)
		}
	})
})
//上面的代码是正确的代码

//但是在最开始使用的代码中却出现了错误
var list = []
return new Promise((resolve, reject) => {
	api.allTypeQuery('OrgType').then(res => {
		if(res.data.code === 0) {
			res.data.data.forEach((item) => {
				list.push(item)
			})
		}
	})
	resolve(list)
})
```

**下面的代码在返回的时间有时就会出现错误**

1.
```
[{...},__ob__: Observer]
```
2.
```
[__ob__: Observer]
```
在实际的使用中，这是vue的一种监听方法，这种是不能遍历的


