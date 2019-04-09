## js里面的特殊正则表达式情况

**\b和\B**

#####特殊情况(将数字转化为三位分隔的样式)
```
function commafy (num) {
    return num
          .toString()
          .replace(/\B(?=(?:\d{3})+\.)/g, ',')
}

function commafy(num){
	return num && num
		.toString()
		.replace(/(\d)(?=(\d{3})+\.)/g, function($1, $2){
			return $2 + ',';
		});
}

\B是不包括边界  \b包括边界
(?=)会作为匹配校验，但不会出现在匹配结果字符串里面
(?:)会作为匹配校验，并出现在匹配结果字符里面，不作为子匹配返回
```

