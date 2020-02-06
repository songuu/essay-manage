# 首先在props使用的作用上面差不多，但是react的功能上面要多点

**在react中间的功能更加的复杂**
**数据的定义和数据的更改最好在同一个组件中间**
**三层传递时，直接使用props就行**

> react中props分为类中间和函数之间

1. 完全受控组件 （数据来源于props）
2. 半完全受控组件 （数据来源于props和state）
3. 非受控组件 （数据来源于state）

> 更新组件

1. props改变
2. state改变
3. 强制刷新

> 函数式组件和类组件中间使用props的方式不同 体现在props的调用上面
> 在使用props属性调用时，props.property和props.children  体现在property所调用为组件申明时，children为组件内部调用
`
export default function TodoHeader(props) {
  return (
    <>
      <h1>
        {props.children}
      </h1>
      <h3>{props.desc}</h3>
    </>
  )
}

export default class TodoInput extend Component {
  constructor () {
    super()
    this.state = {
      inputValue: ''
    }
    // 在constructor里来创建ref
    this.inputDom = createRef()
  }
  handleInputChange = (e) => {
    this.setState({
      inputValue: e.currentTarget.value
    })
  }
  handleKeyUp = (e) => {
    if (e.keyCode === 13) {
      this.handleAddClick()
    }
  }
  handleAddClick = () => {
    // 实际的项目中，这里还需要去对this.state.inputValue做验证，如果验证通过，再执行下面的方法
    if (this.state.inputValue === '') {
      return
    }
    this.props.addTodo(this.state.inputValue)
    this.setState({
      inputValue: ''
    }, () => {
      this.inputDom.current.focus()
    })
  }
  render() {
    return (
      <div>
        <input
          type="text"
          value={this.state.inputValue}
          onChange={this.handleInputChange}
          onKeyUp={this.handleKeyUp}
          ref={this.inputDom}
        />
        <button onClick={this.handleAddClick}>{this.props.btnText}</button>
      </div>
    )
  }
}
`

**在vue中间的props比较简单**
**相比较在react中间定义类型需要引入propsType,但是在vue中间可以直接使用类型定义**
**vue区分组件调用传递和组件内部传递，props和slot**

> 通过父组件传递给子组件

`
parent.vue

<template>
    <div>
        <child id="id"></child>
    </div>
</template>
<script>
    import child from 'child.vue'
    export dealut {
        data() {
            return {
                id: 1
            }
        },
        component: {
            child
        }
    }
</script>


child.vue

<template>
    <div>
        {{id}}
    </div>
</template>
<script>
    export dealut {
        props: {
            id: {
                default: 1,
                type: Number
            }
        }
        data() {},
    }
</script>
`