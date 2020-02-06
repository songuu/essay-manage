# react中的高阶组件很常见，但是在vue中更多的是组件的组装

## 主要的应用还是函数式编程

```
function a() {
    return function b() {
        return 'ab'
    }
}
```

> react

```
import React, { Component } from 'react'

const withCopyright = (YourComponent) => {
  return class WithCopyright extends Component {
    render() {
      return (
        <>
          <YourComponent {...this.props} />
          <div>lala</div>
        </>
      )
    }
  }  
}

export default withCopyright

import React, { Component } from 'react'
import withCopyright from './withCopyright';

class Another extends Component {
  render() {
    return (
      <div>
        Another {this.props.name}
      </div>
    )
  }
}

export default withCopyright(Another)
```

> vue

```
parent.vue
<template></template>
<script>
    import child from './child'
    export default {
        component: {
            child
        }
    }
</script>

child.vue
<template></template>
<script></script>
```

**在vue中间高阶组件很不好用，因为vue很多的钩子函数不好处理**