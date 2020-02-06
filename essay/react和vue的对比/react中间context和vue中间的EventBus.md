# react的context和vue的EventBus主要都是为了跨组件传递数据使用(在不使用中间状态状态包管理redux和vuex)

> react中使用较为复杂

```
import React, { Component, createContext } from 'react'
const {
  Provider,
  Consumer
} = createContext()

// 在Provider使用上面首先要封装一个组件

class CounterProvider extends Component {
  constructor () {
    super()
    this.state = {
      count: 100
    }
  }
  // 这里的方法也会继续通过Provider共享下去
  incrementCount = () => {
    this.setState({
      count: this.state.count + 1
    })
  }
  render () {
    return (
      // 使用Provider这个组件，它必须要有一个value值，这个value里可以传递任何的数据。
      <Provider value={{
        count: this.state.count,
        onIncrementCount: this.incrementCount
      }}>
        {this.props.children}
      </Provider>
    )
  }
}

// 定义一个Counter组件
class Counter extends Component {
  render () {
    return (
      // 使用CounterConsumer来接收count和incrementCount
      <CounterConsumer>
        {
          // Consumer的children必须是一个方法， 这个方法有一个参数，这个参数就是Provider的value
          ({ count, incrementCount}) => {
            return <>
                <span>{count}</span>
                <button onClick=${ incrementCount }>+</button>
            </>
          }
        }
      </CounterConsumer>
    )
  }
}

class App extends Component {
  render () {
    return (
      <>
        <Counter />
      </>
    )
  }
}

render(
  <CounterProvider>
    <App />
  </CounterProvider>,
  document.querySelector('#root')
)
```

> vue中比较简单

```
bus.js
import Vue from 'vue';  
export default new Vue();

a.vue
import bus from './bus'

say() {
    bus.$on('say', () => {this.name = 'lala'})
}

b.js
import bus from './bus'

say() {
    bus.$emit('say')
}
```

**vue中主要是用在兄弟组件之间**
