### axios的出现，进一步减少了ajax所带来的弊端
#### 在axios中间非常有用的就是使用axios钩子函数的拦截
#### 步骤

>首先引入vue-router

```
import Route from 'vuw-router'
```

>然后再导入router表

```
Vue.use(Router)
const router = new Router({
	routes,
	mode: 'hash' //设置为hash模式虽然会在路由层面出现问题，但是会是刷新事件成功
})
```

>然后使用router的钩子函数
```
beforeEach(from, to, next) //此时next为必须参数
afterEach(from, to, next) //此时to为必须参数
```

```
route.beforeEach((before, to, next) => {
	//检测token或者session的存在来判断登录事件
})

route.afterEach(to => {
	//设置通过之后的事件
})
```