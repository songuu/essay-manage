###在最开始的版本的时间，只支持跨一个版本的组件之间的传递数据，但是在2.4之后，可以跨组件进行传递

> 跨组件传递可以分为父传子，子传父，兄弟组件

> 常用的方法有vuex，props，emit，bus等方法

但是这里重点是子传父


1-1 父子组件直接传递
```
    Vue.component('B',{
        data(){
            return {
                mymessage: ''
            }
        },
        template:`
            <div>
                <input type="text" v-model="mymessage" @input="passData(mymessage)">
            </div>
        `,
        methods:{
            passData(val){
                //触发父组件中的事件
                this.$emit('getChildData',val)
            }
        }
    })
    Vue.component('A',{
        template:`
            <div>
                <p>this is parent compoent!</p>
                <B v-on:getChildData="getChildData"></B>
            </div>
        `,
        data(){
            return {
                message:''
            }
        },
        methods:{
            getChildData(val){
                console.log('这是来自B组件的数据' + val)
            }
        }
    })
    var app=new Vue({
        el:'#app',
        template:`
            <div>
                <A></A>
            </div>
        `
    })
```

1-2 父子孙子组件传递
```
Vue.component('C',{
        template:`
            <div>
                <input type="text" v-model="$attrs.messagec" @input="passCData($attrs.messagec)"> </div>
        `,

        methods:{
            passCData(val){
                //触发父组件A中的事件
                this.$emit('getCData',val)
            }
        }
    })

    Vue.component('B',{
        data(){
            return {
                mymessage:this.message
            }
        },
        template:`
            <div>
                <input type="text" v-model="mymessage" @input="passData(mymessage)"> 
                <C v-bind="$attrs" v-on="$listeners"></C>
            </div>
        `,
        props:['message'],//得到父组件传递过来的数据
        methods:{
            passData(val){
                //触发父组件中的事件
                this.$emit('getChildData',val)
            }
        }
    })
    Vue.component('A',{
        template:`
            <div>
                <p>this is parent compoent!</p>
                <B :messagec="messagec" :message="message" v-on:getCData="getCData" v-on:getChildData="getChildData(message)"></B>
            </div>
        `,
        data(){
            return {
                message:'hello',
                messagec:'hello c' //传递给c组件的数据
            }
        },
        methods:{
        	//执行B组件触发的事件
            getChildData(val){
                console.log('这是来自B组件的数据' + val)
            },
            //执行C子组件触发的事件
            getCData(val){
                console.log("这是来自C组件的数据："+val)
            }
        }
    })
    var app=new Vue({
        el:'#app',
        template:`
            <div>
                <A></A>
            </div>
        `
    })
```
##### 此时的重点是 v-bind="$attrs"和v-on="$listeners"
> 作为中间组件的桥梁，使用 **$attrs** 来进行将A组件内容传递给C组件 使用 **$listeners**来进行B组件绑定C组件的事件