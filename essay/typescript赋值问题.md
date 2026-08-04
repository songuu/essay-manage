适用于 TypeScript 赋值与类型兼容：它主要比较源值是否满足目标形状；外部输入先用 `unknown` 和控制流收窄证明类型，泛型保持输入/输出关系，`as` 不能替代运行时验证。

## 赋值方向：源值要满足目标要求

目标类型只要求 `name` 时，带有额外字段的变量可以赋值；这不是“类型被忽略”，而是结构上已经满足目标的最小契约。

```ts
type Named = {
  name: string;
};

const source = {
  name: "Ada",
  location: "London",
};

const named: Named = source; // 可以：source 至少有 name
```

对象字面量会额外触发“多余属性检查”，用来发现常见拼写错误：

```ts
const named: Named = {
  name: "Ada",
  location: "London", // 错误：Named 没有 location
};
```

两者并不矛盾：变量可以携带更多信息，直接写字面量时 TypeScript 会更严格。多余属性检查不是运行时过滤，实际对象仍然保留全部字段。

## 用控制流收窄处理外部数据

`JSON.parse`、表单、环境变量和网络响应不是类型安全的，即使强行写成 `as Article`，运行时也不会检查字段。先把输入视为 `unknown`，再通过守卫函数缩小到可用类型。

```ts
type Article = {
  id: string;
  title: string;
  published: boolean;
};

function isArticle(value: unknown): value is Article {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "title" in value &&
    typeof value.title === "string" &&
    "published" in value &&
    typeof value.published === "boolean"
  );
}

function publish(article: Article): void {
  console.info("publishing", article.id);
}

const raw: unknown = JSON.parse(inputText);

if (isArticle(raw)) {
  publish(raw); // 此分支中 raw 被收窄为 Article
} else {
  throw new Error("接口返回的文章数据不符合契约");
}
```

联合类型应尽量使用可判别字段，让分支和穷尽检查都清晰：

```ts
type LoadResult =
  | { kind: "loading" }
  | { kind: "ready"; article: Article }
  | { kind: "failed"; message: string };

function getTitle(result: LoadResult): string {
  switch (result.kind) {
    case "ready":
      return result.article.title;
    case "failed":
      return "加载失败：" + result.message;
    case "loading":
      return "加载中";
  }
}
```

`typeof`、`in`、`instanceof`、相等比较、用户定义的 type predicate 和提前 `return` 都会参与控制流分析。不要因为“编译能通过”就省略 API 的 schema 校验；类型守卫应覆盖业务真正依赖的字段和边界值。

## 泛型保持“输入与输出相关”

泛型不是自动变成 `any`。它的价值是让同一次调用里的类型关系被保留下来，例如“取对象的某个键，返回该键的值类型”。

```ts
function getProperty<T, K extends keyof T>(value: T, key: K): T[K] {
  return value[key];
}

const article = {
  id: "a-1",
  title: "TypeScript",
  published: true,
};

const title = getProperty(article, "title"); // string
const published = getProperty(article, "published"); // boolean
```

两个泛型函数是否能赋值，取决于它们能否对任意类型参数维持相同的输入/输出关系，而不是取决于类型参数叫 `T` 还是 `U`。参数名称本身也不影响函数兼容性；关键是源函数能否安全处理目标调用方可能传来的参数。

```ts
type StringConsumer = (value: string) => void;

const logUnknown = (value: unknown) => console.log(value);
const consumer: StringConsumer = logUnknown; // 安全：它能处理所有 string
```

开启 `strict`（尤其是 `strictFunctionTypes`）能更早发现不安全的回调赋值。方法签名、可选参数、rest 参数和框架回调还有专门的兼容规则，遇到复杂 API 应用最小调用示例和测试验证，而不是依赖直觉。

## 常见误区

- `any` 会跳过大多数检查，应优先用 `unknown` 再收窄。
- `as SomeType` 只改变静态视图，不转换数据；它适合已经由更可靠机制验证过的边界。
- 可选属性表示“可能不存在”，读取后仍需检查；`exactOptionalPropertyTypes` 会让“省略”和“显式 undefined”更严格地区分。
- 可变对象存在别名风险。需要防止意外写入时使用 `readonly`、不可变更新或复制，而不是只依赖赋值检查。
- TypeScript 不会在运行时移除字段、校验 JSON 或实现权限控制；这些必须由运行时代码完成。

## 官方参考

- [TypeScript Handbook：类型兼容性](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)
- [TypeScript Handbook：控制流收窄](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript Handbook：泛型](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript TSConfig：strict](https://www.typescriptlang.org/tsconfig/strict.html)