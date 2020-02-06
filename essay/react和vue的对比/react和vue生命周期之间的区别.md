# react和vue的生命周期之间还是存在很多相同的部分

## 主要是区分在于vue是数据驱动，react多种触发

1. 通过调用 this.setState 改变 state 驱动视图。
2. 通过调用 this.forceUpdate 强制更新视图。
3. 通过操作原生 dom 更新视图。
4. 通过改变 props 驱动视图（redux 或者 修改父子组件传递 props ）。

> react中主要分为挂载、更新、卸载

```
挂载
constructor()
static getDerivedStateFromProps()
render()
componentDidMount()

更新
static getDerivedStateFromProps() // get Derived state from props
shouldComponentUpdate()
render()
getSnapshotBeforeUpdate()
componentDidUpdate()

卸载
componentWillUnmount()

```

> vue中主要分为创建、挂载、更新、卸载
```
created、mounted、updated、beforeDestroy、destroyed

```

**综上所看，react多了很多的中间过程的处理**
