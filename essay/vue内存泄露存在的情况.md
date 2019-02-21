###造成内存泄露的可能会有以下几种情况：
1.监听在window/body等事件没有解绑
2.绑在EventBus的事件没有解绑(非vuex事件)
3.Vuex的$store watch了之后没有unwatch
4.模块形成的闭包内部变量使用完后没有置成null
5.使用第三方库创建，没有调用正确的销毁函数