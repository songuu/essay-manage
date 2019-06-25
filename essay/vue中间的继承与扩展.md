###  vue中的继承与拓展主要是三种方法
1. slot  插槽式继承
2. extends/mixin 继承
3. extend 继承


**slot**

1. 默认插槽和匿名插槽
> 设置slot插槽，可以用开获取组件中间的原内容，以此用父组件向子组件传递"标签内容"

```
<div id="parant">
	<child>
		hello,i am child
	</child>
</div>

<template id="child">
	<div>
		<slot>
			change
		</slot>
	</div>
</template>


<script>
	var vm = new Vue({
		el: '#parent',
		components: {
			'child': {
				template: '#child'
			}
		}
	})
</script>

```

**结果**
```
hello,i am child
```

2. 具名插槽
> 此时的slot插槽就具有一个name属性

```
<div id="parant">
	<child>
		<ul slot="s1">
			<li>11</li>
			<li>22</li>
		</ul>
		<ul slot="s2">
			<li>33</li>
			<li>44</li>
		</ul>
	</child>
</div>

<template id="child">
	<div>
		<slot name="s2"></slot>
		<slot name="s1"></slot>
	</div>
</template>


<script>
	var vm = new Vue({
		el: '#parent',
		components: {
			'child': {
				template: '#child'
			}
		}
	})
</script>
```

**结果**
```
33
44
11
22
```

**extends/mixin**
> 当原生方法与导入方法冲突的时间，就会直接去原始方法


#### 简答的来讲mixin的出现可以减少新增函数对原型的影响

> 简单的例子

```
<div id="app">
	<p>{{num}}</p>
	<button @click="add">
		add
	</button>
</div>
<script>
	var logadd = {
		update: function() {
			console.log("mixin的结果为:"+this.num)
		}
	}
	
	Vue.mixin = {
		update: function() {
			console.log("全局混入")
		}
	}
	
	var app = new Vue({
		el: '#app',
		data: {
			num: 1
		},
		methods: {
			add: function() {
				this.num++
			}
		},
		mixin: [logadd]
	})
</script>
```

**结果**
> 每次点击按钮都可以实现添加功能

##### 要点：mixin的执行顺序，全局 > 外部导入 > 原始  

#### extends的使用，与mixin相似，但是在传入的时间上面，extends是传入的选项对象和构造函数，每一次只能扩展一个组件

```
<div id="app">
	<p>{{num}}</p>
	<button @click="add">
		add
	</button>
</div>
<script>
	var logadd = {
		update: function() {
			console.log("mixin的结果为:"+this.num)
		},
		methods: {
			add: function() {
				console.log('我是被扩展出来的add方法！');
                this.num++;
			}
		}
	}
	
	var app = new Vue({
		el: '#app',
		data: {
			num: 1
		},
		methods: {
			add: function() {
				this.num++
			}
		},
		extends: logadd
	})
</script>
```

##### extends和minxin的优先级：extends > mixin


**extend**

#### 可以用来创建复用性组件

```
<div id="app">
	<child1></child1>
	<child2></child2>
</div>
<script>
	var MyComponent = Vue.extend({
            template: '<h3>i am child1</h3>'
        });
    Vue.component('child1', MyComponent);
    
    
    Vue.component('child2', {
    	template: '<h3>i am child2</h3>'
    })
    
    var vm = new Vue({ 
        el: '#app',
          	data: {}
        }); 
</script>
```
