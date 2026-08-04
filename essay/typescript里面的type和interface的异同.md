适用于在 TypeScript 中选择 `type` 或 `interface`：两者都可描述对象和函数；开放对象契约优先 `interface`，联合、元组、条件/映射类型优先 `type`，同一概念只保留一种命名。

## 共同能力：对象、函数和扩展

对象形状、可选属性、只读属性、泛型和函数签名都能用两者表达。

```ts
interface User {
  readonly id: string;
  name: string;
  nickname?: string;
}

type SaveUser = (user: User) => Promise<void>;

interface Admin extends User {
  role: "admin";
}

type WithAudit<T> = T & {
  createdAt: Date;
  updatedAt: Date;
};

type AuditedUser = WithAudit<User>;
```

`interface extends` 表达对象契约的继承关系，`type` 通常以交叉类型 `&` 组合。交叉不是“后者覆盖前者”：若同名属性不兼容，结果可能变成无法构造的 `never`。

```ts
type Broken = { id: string } & { id: number };
// Broken["id"] 为 never；这不是安全的字段覆盖。
```

接口可以扩展具有静态已知成员的对象类型，但不能扩展联合类型；需要“要么是 A、要么是 B”时应使用 `type`。

## 何时优先用 interface

将对象作为库、模块边界或可由使用方扩展的契约时，`interface` 的意图更清晰：

```ts
export interface PaymentGateway {
  charge(input: ChargeInput): Promise<ChargeResult>;
}

export interface ChargeInput {
  amount: number;
  currency: "CNY" | "USD";
}
```

同名 `interface` 会声明合并，这对 DOM、框架插件和受控的模块扩充有用；也意味着公开接口的改动可能影响其他文件。应用内部不需要被扩充的私有数据结构，不要仅为“以后可能合并”选择 `interface`。

## 何时必须或更适合用 type

`type` 可以为任意类型表达式取别名，因此在以下场景更直接：

```ts
type RequestState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: T }
  | { kind: "failure"; message: string };

type Coordinate = readonly [longitude: number, latitude: number];

type ApiResponse<T> = {
  data: T;
  requestId: string;
};

type ReadonlyDictionary<T> = Readonly<Record<string, T>>;
```

联合类型、元组、原始类型别名、条件类型、映射类型和 template literal 类型不能由 `interface` 直接表示。面对状态机、事件联合、复杂泛型工具或精确的字面量约束时，选择 `type` 会少一层不必要的包装。

## 声明合并不是日常组合工具

下面的接口会合并为一个契约：

```ts
interface FeatureFlags {
  searchV2: boolean;
}

interface FeatureFlags {
  compactCards?: boolean;
}

const flags: FeatureFlags = {
  searchV2: true,
  compactCards: false,
};
```

同名 `type` 会报重复声明错误。模块扩充也只能补丁现有模块已经导出的声明，且应放在可审查的 `.d.ts` 或集成边界，不能把它当作给第三方对象随意增加运行时能力的手段。

```ts
// src/types/some-sdk.d.ts
// 仅当 "some-sdk" 确实导出了 ClientOptions 接口时才有效。
import "some-sdk";

declare module "some-sdk" {
  interface ClientOptions {
    traceId?: string;
  }
}
```

顶部 `import "some-sdk"` 使该声明文件成为模块，因此 `declare module` 是对现有模块的扩充；如果文件既没有 `import` 也没有 `export {}`，它可能改为声明一个环境模块。类型声明不会生成 JavaScript。如果运行时对象没有相应字段或方法，即使扩充后的 TypeScript 编译通过，程序仍会失败。

## 团队约定与边界

- 对开放的对象 API 统一使用 `interface`，对联合/工具类型统一使用 `type`，是容易执行的约定。
- 不要为了“全部用 interface”而把联合状态拆成一组可选字段；可判别联合能提供更好的穷尽检查。
- 不要为了“全部用 type”而错过声明合并的库扩展点；但扩充前先确认上游声明和版本。
- `readonly` 与 `?` 不是 `interface` 专属能力，二者都支持。
- 类型别名和接口都只在编译期存在；API 输入、数据库记录和用户数据仍需运行时验证。

## 官方参考

- [TypeScript Handbook：对象类型](https://www.typescriptlang.org/docs/handbook/2/objects.html)
- [TypeScript Handbook：日常类型](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript Handbook：声明合并](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
- [TypeScript Handbook：条件类型](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)