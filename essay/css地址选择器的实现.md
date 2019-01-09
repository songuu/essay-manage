### css地址选择器的实现
#### 主要是用在主题的切换，文本的语言的切换

> 代码的实现
```
.con{
    padding: 100px;
    background: #fff;
    border: 1px solid rgba(0,0,0,.5);
    transition: .3s;
}

#red:target ~ .con{
    background: #ff6d6d;
    color: #fff;
}

#green:target ~ .con{
    background: #3dfc6d;
    color: #000;
}

#blue:target ~ .con{
    background: #5270f8;
    color: #fff;
}

</style>
<body>
    <div id="red"></div>
    <div id="green"></div>
    <div id="blue"></div>
    <div class="con">
        <h2>注意观察主题颜色和地址栏变化</h2>
    </div>
    <a href="#red">红色</a>
    <a href="#green">绿色</a>
    <a href="#blue">蓝色</a>
</body>
</html>
```