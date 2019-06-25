### axios 作为node基于http的一个库，其底层的原理是基于http和promise的
**特点**

```
从浏览器中创建 XMLHttpRequests
从 node.js 创建 http 请求
支持 Promise API
拦截请求和响应
转换请求数据和响应数据
取消请求
自动转换 JSON 数据
客户端支持防御 XSRF
```

### 但是作为用户端就要定制用户的请求需要，一般拥有post与get的请求方式
##### 封装的意思就是，进行请求拦截和相应拦截

1. 请求拦截就是看用户做出请求的时间是否拥有参数(cookie)  更多的时间是用在权限的设置上面

```
instance.interceptors.request.use(config => {
		if(!config.url.includes('/users')) {
			config.headers['x-access-token'] = Cookies.get(TOKEN_KEY) //请求头必须带token
		}
		return config			
}, error => {
		return Promise.reject(error)
	})
```

2. 响应拦截就是对用户的请求做出响应的过程中间，进行二次计算，判断状态(200,201,400,404,500)

```
instance.interceptors.response.use((res) => {
	let {data} = res
	const is = this.destroy(url)
	if(!is) {
		if(res.status !== 200) {
			// 后端服务在个别情况下回报201，待确认
			if(res.status === 401) {
				Cookies.remove(TOKEN_KEY)
				window.location.href = window.location.pathname + '#/login'
				Message.error('未登录，或登录失效，请登录')
			} else {
				if(res.msg) Message.error(res.msg)
			}
			return false
		}
		return data
	}, (error) => {
		window.location.href = window.location.pathname + '#/login' //跳转到登陆页面
		Message.error('服务器离线')			
		return Promise.reject(error)
	})
```

但是现在的调用和以前就有很多的不同，因为重新封装了axios，必须在使用的地方就行调用上面函数东的返回

```
实现封装以后的登陆操作
import axios from '@/libs/api.request'

export const login = ({
	userName,
	password
}) => {
	const data = {
		"user.name": userName,
		"user.password": password
	}
	return axios.request({
		url: '',
		params: data,
		method: 'post'
	})
}
```

其实还可以进行封装更多的方法
例如可以进行利用post和get请求来封装fetch函数,虽然fetch只对网络错误进行响应，现在就可以使用fetch函数对400，500进行响应
参见网上的文章[使用axios重新封装fetch](https://www.jb51.net/article/134419.htm)
