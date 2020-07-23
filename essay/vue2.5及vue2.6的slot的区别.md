# 同时都是作用域的插槽，但是在使用上面出现了很大的变化

> 在 2.5 的版本中，由于生成 slot 的作用域是在父组件中，所以明明是子组件的插槽 slot 的更新是会带着父组件一起更新的
> 同时都可以用this.$slotScoped来进行直接访问
```

在 3.0 中我们希望实现的另一个关于 slot 的改进就是统一 slot 和 scoped slot 的内部实现，从而获得更好的性能优化。普通的 slot 是在父组件的渲染函数中被生成的，因此当一个普通的 slot 所依赖的数据发生变化时，首先触发的是父组件的更新，然后新的 slot 内容被传到子组件，触发子组件更新。相比之下，scoped slot 在编译时生成的是一个函数，这个函数被传入子组件之后会在子组件的渲染函数中被调用。这意味着 scoped slot 的依赖会被子组件收集，那么当依赖变动时就只会直接触发子组件更新了。2.6 中我们又引入了另一个优化：如果子组件只使用了 scoped slot，那么父组件自身依赖变动时，不会再强制子组件更新。这个优化使得父子组件之间的依赖即使在存在 slot 的情况下依然完全解耦，从而保证最优的整体更新效率。

```
**注意 v-slot 只能添加在template**
### 出现具名插槽时，只能使用一个具名的slot 且以后面的那个生效 直接覆盖

```
// template
<div>
  <foo :data="data">
    <template v-slot:aa="props">
      555{{props.item}}
    </template>
    <template v-slot:bb="props">
      555{{props.item}}
    </template>
    <template v-slot:bb="bbb">
      {{bbb}}
    </template>
    <template v-slot="props">
      {{props.item + 1}}
    </template>
  </foo>
</div>
// js
var vm = new Vue({  
   el: '#app',
  data() {
    return {
      data: [1,2,3]
    }
  },
   methods: {  
   },  
   components: {  
     foo: {
       template: `<ul>
        <li v-for='item in data'>
          <slot :item='item' name='aa'></slot>
          <slot :item='item' name='bb'></slot>
          <slot :item='item'></slot>
        </li>
       </ul>`,
       props: {
         data: Array
       }
     }
        }  
    });  
```