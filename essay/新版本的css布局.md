### 新旧布局的逻辑属性
```
旧的逻辑属性
新的逻辑属性

margin-top
margin-block-start


margin-right
margin-inline-end


margin-bottom
margin-block-end


margin-left
margin-inline-start


border-top
border-block-start


border-right
border-inline-end


border-bottom
border-block-end


border-left
border-inline-start


padding-top
padding-block-start


padding-right
padding-inline-end


padding-bottom
padding-block-end


padding-left
padding-inline-start


width
inline-size


height
block-size
```

### css定位属性
```
旧的属性  新的属性
top	inset-block-start
bottom	inset-block-end
left	inset-inline-start
right	inset-inline-end
```

### css浮动属性
```
旧的属性  新的属性
float: left	float: inline-start
float: right	float: inline-end
```


### 视觉格式化模型
```
每个盒子的布局由以下因素决定：

盒子的尺寸
盒子的类型：行内盒子 (inline)、行内级盒子 (inline-level)、原子行内级盒子 (atomic inline-level)、块盒子 (block)
定位：普通流、浮动、绝对定位
文档树中当前盒子的子元素 或 兄弟元素
视口(viewport) 的尺寸 和位置
盒子内部图片的尺寸
其他某些外部因素
```
> 在使用的中间在定义盒子的尺寸、类型、定位的时最为重要

**盒子的尺寸**
```
width，height
```

**盒子的类型**
> 取决于display属性

##### 块级元素

当元素的display  为 block、list-item 或 table 时，它就是块级元素。
(自动换行，可以设置宽和高)

##### 块级盒子

块级盒子用于描述它与父、兄弟元素之间的关系。
每个块级盒子都会参与 块格式化上下文(block formatting context) 的创建。
每个块级元素都会至少生成一个块级盒子，即 主块级盒子 (principal block-level box)
主块级盒子包含由后代元素生成的盒子以及内容，同时它也会参与定位方案。
一个同时是块容器盒子的块级盒子称为块盒子 (block box)。

##### 匿名盒子

某些情况下需要进行视觉格式化时，需要添加一些增补性的盒子，这些盒子不能被CSS 选择器选中，也就是所有可继承的 CSS 属性值都为 inherit ，而所有不可继承的 CSS 属性值都为 initial。因此称为**匿名盒子(anonymous boxes) **。

##### 行内元素

当元素的display  为 inline、inline-block 或 inline-table 时，它就是行内级元素。
显示时可以与其他行内级内容一起显示为多行。
(一行显示，不能设置宽和高)

##### 行内盒子

行内级元素会生成行内级盒子，该盒子同时会参与行内格式化上下文（inline formatting context）的创建。

##### 匿名行内盒子

类似于块盒子，CSS引擎有时候也会自动创建一些行内盒子。这些行内盒子无法被选择符选中，因此是匿名的，它们从父元素那里继承那些可继承的属性，其他属性保持默认值 initial。

##### 行盒子

行盒子由行内格式化上下文创建，用来显示一行文本。在块盒子内部，行盒子总是从块盒子的一边延伸到另一边（译注：即占据整个块盒子的宽度）。当有浮动元素时，行盒子会从向左浮动的元素的右边缘延伸到向右浮动的元素的左边缘。

**定位**
确定了盒子之后就要来确定定位
##### 普通流

在普通流中，盒子会依次放置。
在块格式化上下文(block formatting context) 中，盒子在垂直方向依次排列。
在行内格式化上下文(inline formatting context) 中，盒子则水平摆列。


##### 浮动：当一个盒子的float不为none，并且position为static或relative时，该盒子为浮动定位。

float: left：盒子会定位到当前行盒子的开始位置（左侧）。
float: right：盒子会定位到当前行盒子的尾部位置（右侧）。


##### 绝对定位：如果元素的position 为 absolute 或 fixed，该元素为绝对定位。

在绝对定位中，盒子会完全从当前流中移除，并且不会再与其有任何联系。

