适用于获授权站点的 Scrapy 采集：用异步 `start()`、`Spider`、`Item Pipeline` 建立可验证的数据流，默认遵守 robots、限速、自动节流与站点条款；能运行不等于可无限抓取或任意使用数据。

## 一个可运行的项目骨架

安装并创建项目：

```bash
python -m pip install scrapy
scrapy startproject catalog
cd catalog
```

常用命令的对象不要混淆：

```bash
# 运行名为 products 的 Spider；名称来自 Spider.name，不是项目名。
scrapy crawl products -O output/products.jsonl

# 检查项目中的 Spider 定义。
scrapy check

# 只运行一个独立文件，适合实验；它不会自动拥有完整项目配置。
scrapy runspider path/to/products_spider.py
```

在 Scrapy 2.13 及之后，`Spider.start()` 是异步迭代器。它负责产生最初的请求，`parse()` 再产出 item 和后续请求：

```py
# catalog/items.py
import scrapy


class ProductItem(scrapy.Item):
    title = scrapy.Field()
    price = scrapy.Field()
    url = scrapy.Field()
```

```py
# catalog/spiders/products.py
import scrapy

from catalog.items import ProductItem


class ProductsSpider(scrapy.Spider):
    name = "products"
    allowed_domains = ["example.com"]

    custom_settings = {
        "ROBOTSTXT_OBEY": True,
        "DOWNLOAD_DELAY": 1.0,
        "RANDOMIZE_DOWNLOAD_DELAY": True,
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 1.0,
        "AUTOTHROTTLE_MAX_DELAY": 15.0,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 2,
    }

    async def start(self):
        yield scrapy.Request(
            "https://example.com/catalog",
            callback=self.parse,
        )

    def parse(self, response):
        for card in response.css("article.product"):
            title = card.css("h2::text").get()
            href = card.css("a::attr(href)").get()

            if title and href:
                yield ProductItem(
                    title=title.strip(),
                    price=card.css(".price::text").get(),
                    url=response.urljoin(href),
                )

        next_page = response.css("a[rel='next']::attr(href)").get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)
```

`allowed_domains` 能帮助避免跟随站外链接，但它不是访问授权控制。每个 Spider 的 `name` 必须唯一；脚本参数通过 `scrapy crawl products -a category=books` 传入时都是字符串，要自行校验和转换。

## 用 Pipeline 做校验，用 Feed Export 做文件输出

Spider 专注于请求与解析，Pipeline 负责清洗、校验、去重或持久化。Pipeline 的 `process_item()` 必须返回 item，或抛出 `DropItem`；忘记返回会让后续处理收到 `None`。

```py
# catalog/pipelines.py
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem


class ValidateProductPipeline:
    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        title = adapter.get("title")

        if not isinstance(title, str) or not title.strip():
            raise DropItem("缺少可用的 title")

        adapter["title"] = title.strip()
        return item
```

在 `settings.py` 中显式启用它，并把 JSON Lines 交给 Scrapy 的 Feed Export，而不是自己在 Pipeline 中打开文件：

```py
ITEM_PIPELINES = {
    "catalog.pipelines.ValidateProductPipeline": 300,
}

FEEDS = {
    "output/%(name)s-%(time)s.jsonl": {
        "format": "jsonlines",
        "encoding": "utf8",
        "overwrite": False,
    },
}
```

多个 Pipeline 按数字从小到大执行。需要写入数据库时，Pipeline 应创建受控连接、处理幂等键与批量提交，并在 `close_spider()` 中释放资源；网络 I/O 可以使用 Scrapy 当前支持的异步 Pipeline 方法，但不能在每个 item 中创建一次数据库连接。

## 合规、稳定性与止损

- 先取得访问和使用授权，核对 `robots.txt`、站点条款、API 许可、版权与个人信息处理要求。`ROBOTSTXT_OBEY` 是技术尊重，不会授予许可证。
- 保持低并发和非零 `DOWNLOAD_DELAY`，启用 AutoThrottle；遇到 429、503、登录墙或验证码时降低速率或停止，不要尝试绕过。
- 为请求设置清晰的 `User-Agent` 和可联系信息（在获得允许的运营场景中），记录抓取批次、版本、来源 URL 和数据许可。
- 使用 `CLOSESPIDER_ITEMCOUNT`、小范围 URL 或单页 fixture 先验证选择器；DOM 改版时应让字段校验失败并告警，而不是静默写入空数据。
- 不要抓取超出业务需要的个人数据；导出文件、日志和错误样本同样要遵守数据保留与访问控制。

## 官方参考

- [Scrapy：Spiders 与异步 start()](https://docs.scrapy.org/en/latest/topics/spiders.html)
- [Scrapy：Item Pipeline](https://docs.scrapy.org/en/latest/topics/item-pipeline.html)
- [Scrapy：内置设置（限速、AutoThrottle、robots）](https://docs.scrapy.org/en/latest/topics/settings.html)
- [Scrapy：命令行工具](https://docs.scrapy.org/en/latest/topics/commands.html)