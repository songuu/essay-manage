### 在使用vue打包文件以后会出现api写死在dist文件的情况，
### 每次要修改的时间就要去修改config文件，然后还要重新打包，这样就会增加项目的困难

#### 所以现在就直接在外部将文件写好，使用axios去异步请求这个api接口

> 首先声明现在存在的环境是cli3

1. 由于出现在cli3中，其实就是以前版本的简化，没有了以前的build文件夹，所以配置难度其实是比以前的大
2. 可以直接在public文件夹下面建立config.js  配置api接口


**直接上手**
```
(function(env) {
	const dev  =   {
		host: "http://192.168.1.90:8080/weakscanf",
		base: '/'   
	}; 

	const pro  =   {
		host: "http://192.168.1.90:8080/weakscanf",
		base: 'html5'  
	}; 
	if(env  === 'dev')  {
		return dev;
	}
	else if(env  === 'test')  {
		return pro;		    
	} 
}('test'))

建立自执行函数
```

#### 在main.js中间直接调用axios请求

**直接上代码**

##### 第一种方法 (使用全局变量)
```
import axios from 'axios'

let configPath = './config.js';
if(process.env.NODE_ENV === 'development') {
	configPath = '../config.js';
}//判断环境

window.aaa = ''
window.bbb = ''

axios.get(configPath).then(res  =>  { 
	bbb = eval(res.data).host
	aaa = eval(res.data).base

	new Vue({
		el: '#app',
		router,
		store,
		render: h => h(App)
	})
});
```

##### 第二种方法(使用webpack的全局变量)

```
import axios from 'axios'

let configPath = './config.js';
if(process.env.NODE_ENV === 'development') {
	configPath = '../config.js';
}//判断环境

axios.get(configPath).then(res  =>  { 
	Vue.prototype.host = eval(res.data).host
	Vue.prototype.base = eval(res.data).base

	new Vue({
		el: '#app',
		router,
		store,
		render: h => h(App)
	})
});
```

##### 第三种方法(使用cookie进行保存)

```
import Cookies from 'js-cookies'
import axios from 'axios'

let configPath = './config.js';
if(process.env.NODE_ENV === 'development') {
	configPath = '../config.js';
}//判断环境

axios.get(configPath).then(res  =>  { 
	Cookies.set('host',eval(res.data).host)
	Cookies.set('base',eval(res.data).base)

	new Vue({
		el: '#app',
		router,
		store,
		render: h => h(App)
	})
});

```

其实保存的方法有很多种 ，其实读者都可以试一下