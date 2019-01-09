###在新版本的vue中间，已经摒弃了vue-resource，开始提倡使用axios
####相比于vue-resource，axios环境更加良好
####在一般的环境中，将api与项目文件分开，更加适合项目的开发与维护
1. 首先新建api文件夹
2. 配置vuex
3. 在vuex的action事件中，重新连接api接口

例如：
在api文件中
```
export const login = ({
	userName,
	password
}) => {
	const data = {
		"name": userName,
		"password": password
	}
	return axios.request({
		url: '/Login.do?method=processLogin', //这里使用的是java后台
		params: data,
		method: 'post'
	})
}
```
在vuex的action中
```
		handleLogin({
			commit
		}, {
			userName,
			password
		}) {
			userName = userName.trim()
			return new Promise((resolve, reject) => {
				login({
					userName,
					password
				}).then(res => {
					if(res.statusCode === '200') {
						resolve('success')
					} else {
						router.go({
							name: "login"
						})
					}
				}).catch(err => {
					reject(err)
				})
			})
		},
```

> 这里使用的是封装好的axios

此时接口看起来更加的完善和易懂
