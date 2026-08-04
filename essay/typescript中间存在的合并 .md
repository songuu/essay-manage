适用于维护 TypeScript 声明、插件类型或库扩充：声明合并只组合允许的类型、命名空间和值，运行时实现仍须存在；优先模块与显式组合，只在受控接口或模块扩充中使用。

## 接口合并：开放对象契约

同一作用域内的同名 `interface` 会合并成员：

```ts
interface RequestContext {
  requestId: string;
}

interface RequestContext {
  userId?: string;
}

const context: RequestContext = {
  requestId: "req-42",
  userId: "u-7",
};
```

非函数成员同名时必须具有相同类型，否则声明错误。函数成员会形成重载集合；后声明的重载组排在前面，字符串字面量等更特化的签名还有额外排序规则。因此，公开接口里的重载应集中书写并配合调用类型测试，避免跨文件合并导致读者难以预测解析顺序。

```ts
interface Parser {
  parse(input: string): unknown;
}

interface Parser {
  parse(input: "true" | "false"): boolean;
}
```

`interface` 合并的是类型信息，不会生成 JavaScript。若实际对象没有 `parse` 方法，仅靠声明合并不会让调用在运行时成功。

## 命名空间与值的附加

TypeScript 的声明可能同时创建类型、命名空间或值。允许的组合可让函数、类或枚举携带命名空间中的静态成员：

```ts
function buildLabel(name: string): string {
  return buildLabel.prefix + name + buildLabel.suffix;
}

namespace buildLabel {
  export let prefix = "Hello, ";
  export let suffix = "!";
}

buildLabel("Ada"); // "Hello, Ada!"
```

类和命名空间也可合并：

```ts
class Album {
  declare label: Album.AlbumLabel;
}

namespace Album {
  export class AlbumLabel {
    constructor(readonly name: string) {}
  }
}
```

这些模式主要存在于历史 API、声明文件和少数库设计中。现代应用代码通常优先使用 ES module 的显式 `export`，因为依赖方向、tree shaking 和测试边界更清楚。命名空间中未导出的成员也不会自动暴露给后续合并块，不能把它当作跨文件私有状态共享机制。

## 模块与全局扩充

为已有库补充缺失类型时，使用 module augmentation，并把补丁限制在集成边界：

```ts
// src/types/some-sdk.d.ts
// 先解析已有模块声明；这使下面的 declare module 成为 augmentation。
import "some-sdk";

declare module "some-sdk" {
  interface ClientOptions {
    traceId?: string;
  }
}
```

这段代码只有在 `some-sdk` 已经导出 `ClientOptions` 接口时才有意义。顶部 `import "some-sdk"` 让 `.d.ts` 成为外部模块，并确认扩充的是已有声明；若缺少 `import` 或 `export {}`，相同语法可能被当作新的环境模块声明，而不是 augmentation。它不能凭空新增任意顶层导出；默认导出也不能按同样方式被 augmentation。升级第三方库后应重新 typecheck，因为上游声明可能已包含、重命名或改变同一成员。

全局扩充更应克制，并把文件保持为模块以避免意外污染：

```ts
// src/types/window.d.ts
export {};

declare global {
  interface Window {
    __APP_VERSION__?: string;
  }
}
```

静态声明之后仍要在运行时真正赋值，例如 `window.__APP_VERSION__ = buildVersion`。不要用全局扩充绕过依赖注入或把敏感状态暴露到 `window`。

## 不允许的合并与替代方案

以下组合不能声明合并：

- 类不能与另一个类合并，也不能与变量合并。
- 同名 `type` 不能像接口一样累积成员。
- JavaScript ES module 本身没有“自动合并”语义；它需要真实的 import/export 和对象实现。

需要组合数据时使用交叉类型、组合对象或工厂函数；需要复用实现时使用组合、继承或经过测试的 mixin；需要扩充第三方声明时仅补丁已有、稳定的公开接口。不要把合并当成解决模块循环依赖或运行时 monkey patch 的捷径。

## 检查清单

1. 这是否真是一个开放契约，而不是可以用普通 `type` / `interface` 声明一次解决的内部模型？
2. 合并后的每个方法和字段是否有运行时实现与测试？
3. 是否存在重载顺序、全局污染或第三方升级冲突？
4. augmentation 是否只扩充了现有命名导出，并被放在可审查的类型边界？
5. 新代码能否改用 ES module、显式参数或组合，以降低隐式耦合？

## 官方参考

- [TypeScript Handbook：声明合并](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
- [TypeScript Handbook：Mixins](https://www.typescriptlang.org/docs/handbook/mixins.html)
- [TypeScript Handbook：Modules](https://www.typescriptlang.org/docs/handbook/modules.html)