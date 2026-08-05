先给结论：CLB 和 ELB 在原理上并不是两种对立的负载均衡技术。真正决定系统行为的是：

* 工作在四层还是七层
* 采用连接转发、NAT 还是全代理
* 后端注册的是 Node、Pod IP 还是主机
* 按连接还是按 HTTP 请求调度
* 跨可用区、健康检查、连接排空如何实现
* 谁负责灰度决策

## 一、先把术语拆开

| 名称      | 准确含义                   | 定位                                         |
| ------- | ---------------------- | ------------------------------------------ |
| 腾讯云 CLB | Cloud Load Balancer    | 当前通用负载均衡产品，同时提供四层和七层监听器                    |
| AWS ELB | Elastic Load Balancing | 产品族，不是具体型号；包含 ALB、NLB、GWLB 和上一代 Classic LB |
| AWS CLB | Classic Load Balancer  | AWS 上一代负载均衡器，属于 ELB 产品族                    |
| 华为云 ELB | Elastic Load Balance   | 华为云托管负载均衡产品                                |

因此，如果说“腾讯 CLB 和 AWS ELB 对比”，实际上是在拿一个具体产品和一个产品家族比较；如果说“AWS CLB 和 ELB 对比”，则 CLB 本身就是 ELB 家族中的旧型号。AWS 官方已经把 Classic Load Balancer 定义为上一代产品，并建议迁移到当前型号。[AWS Classic Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/introduction.html)

下面主要按“腾讯云 CLB 与 AWS ELB 体系”分析。

---

## 二、负载均衡最核心的原理

一个托管负载均衡，本质上由两个系统组成：

```text
控制面：
API / Console / Kubernetes Controller
        ↓
监听器、转发规则、后端集合、权重、健康检查
        ↓
生成配置快照并下发到负载均衡节点

数据面：
Client
  ↓
VIP 或 DNS 返回的 LB 节点
  ↓
Listener
  ↓
协议解析 / 规则匹配 / 流量哈希
  ↓
Healthy Target Set
  ↓
Node / Pod / VM / Target Group
```

控制面决定“应该怎么转”，数据面负责“每个包、连接或者请求具体转给谁”。

这意味着：

1. 修改权重、后端、健康状态不会瞬间在所有节点同时生效。
2. 数据面应当在控制面暂时不可用时继续使用最后一次有效配置。
3. 扩容负载均衡本身，不等于扩容后端应用。
4. 后端健康也不等于后端有足够容量。

“Elastic”主要表示托管 LB 集群能够随负载扩展，不代表后端 Pod、数据库和线程池会自动拥有足够容量。

---

## 三、真正的技术分界：四层与七层

| 维度   | 四层负载均衡               | 七层负载均衡                          |
| ---- | -------------------- | ------------------------------- |
| 观察内容 | IP、端口、协议、TCP/UDP 流   | Host、Path、Header、Cookie、HTTP 方法 |
| 调度单位 | 通常是连接或流              | HTTP 请求；升级后变成长连接                |
| 状态   | 五元组映射、连接状态           | 前端连接、后端连接池、请求队列、Cookie          |
| TLS  | 通常透传或简单 TLS Listener | 可终止 TLS、SNI、多证书、WAF             |
| 性能   | 少解析、PPS/CPS 高        | 多一次协议解析和代理处理                    |
| 路由能力 | 无法理解用户、URL、Cookie    | 可以按域名、路径、Header、Cookie 路由       |
| 典型产品 | AWS NLB、腾讯 CLB 四层监听器 | AWS ALB、腾讯 CLB 七层监听器            |

### 四层调度

四层一般根据以下字段计算目标：

```text
hash(protocol, src_ip, src_port, dst_ip, dst_port, ...)
```

AWS NLB 的流哈希还会包含 TCP sequence number；一个 TCP 连接建立后，在连接生命周期内固定到同一个目标。不同连接即使来自同一客户端，也可能被转发到不同目标。[AWS ELB 工作原理](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html)

四层的“粘滞”是连接粘滞，不是用户版本粘滞。

### 七层调度

七层 LB 会终止客户端连接，解析 HTTP，再创建或复用到后端的连接：

```text
Client Connection
      ↓
TLS / HTTP 解析
      ↓
Host / Path / Header / Cookie 规则
      ↓
Target Group
      ↓
Backend Connection Pool
```

因此可能出现：

* 多个客户端连接复用一个后端连接
* 一个 HTTP/2 连接承载大量并发请求
* WebSocket Upgrade 后长期固定到一个目标
* 请求级权重和连接级权重产生不同结果

AWS 文档明确说明 ALB 和 Classic LB 都会使用后端连接复用，而 Classic LB 还使用预建连接。[AWS ELB 工作原理](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html)

---

## 四、CLB 和 ELB 在产品实现上的区别

### 腾讯云 CLB

腾讯 CLB 在一个产品中提供四层和七层监听器：

* 四层基于 TGW，采用 DPDK 等高性能包处理技术。
* 七层基于 STGW，是腾讯基于 Nginx 构建的大规模七层代理。
* CLB 自身是集群化部署，并进行会话状态同步。
* 支持加权轮询、源地址 Hash、加权最小连接数等算法。
* 七层可以进行域名、URL、Cookie 等路由。

这说明腾讯 CLB 并不是单纯的“四层 LB”，而是一个同时包含四层数据面和七层代理数据面的通用产品。[腾讯云 CLB 技术原理](https://cloud.tencent.com/document/product/214/530)

### AWS ELB

AWS 把不同层次拆成不同产品：

* ALB：HTTP、HTTPS、HTTP/2、gRPC 等七层流量。
* NLB：TCP、UDP、TLS 等四层流量。
* GWLB：防火墙、IDS/IPS 等透明网络设备。
* Classic LB：上一代四层/七层混合产品。

AWS Classic LB：

* TCP Listener 使用 Round Robin。
* HTTP/HTTPS Listener 使用 Least Outstanding Requests。
* 缺少现代 ALB/NLB Target Group 的大量能力。
* 不应套用现代 `target-type: ip/instance` 的 Kubernetes 设计。

所以腾讯 CLB 和 AWS ALB/NLB 没有严格一对一映射，只能按监听协议、路由能力和目标模式逐项比较。

---

## 五、为什么云负载均衡权重不能直接代表灰度比例

假设配置两个目标权重都是 50%，实际业务负载并不一定是 50:50。

实际负载近似为：

```text
目标负载 =
Σ（被分配连接的请求速率 × 单请求成本 × 连接持续时间）
```

权重只影响“被选中的概率”，但不控制：

* 一个连接包含多少请求
* 每个请求消耗多少 CPU
* WebSocket 持续多久
* HTTP/2 一个连接中有多少 Stream
* NAT 后多少用户共享一个源 IP
* Cookie/源地址粘滞造成的倾斜
* 重试是否再次选择目标

例如，100 个连接按 50:50 分配，但其中一个 WebSocket 承载了 40% 总流量，最终可能出现 70:30 的字节量或 CPU 使用率。

更重要的是：

> LB 的 10% 权重表示约 10% 的连接或请求，不表示稳定的 10% 用户。

用户级灰度应当使用：

```text
bucket = HMAC(bucket_key, release_salt | subject_id) % 10000

bucket < ratio × 100
    → canary
否则
    → stable
```

这才保证同一用户跨请求、跨 OpenResty Pod 和跨集群保持稳定桶位。

---

## 六、进入 Kubernetes 后的两种真实链路

Kubernetes 的 `Service.type: LoadBalancer` 本身不实现云负载均衡，而是由云控制器创建外部 LB。Kubernetes 通常先建立 NodePort，再由云 LB 指向它；支持直连 Pod 的实现可以省略 NodePort。[Kubernetes Service](https://kubernetes.io/docs/concepts/services-networking/service/)

### 1. Node / Instance 模式

```text
CLB / NLB / ALB
      ↓
Kubernetes Node : NodePort
      ↓
kube-proxy / IPVS / iptables
      ↓
OpenResty Pod
```

特点：

* 后端注册的是 Node，而不是 Pod。
* 云 LB 健康检查通常检查 NodePort。
* 实际还会发生第二次负载均衡。
* Pod 扩缩容不会直接改变云 LB 后端数量。

`externalTrafficPolicy` 会进一步改变行为：

* `Cluster`：节点可以转发到其他节点的 Pod，可能产生跨节点跳转和 SNAT。
* `Local`：只转发给本节点 Pod，可以保留源 IP，但云 LB 按节点分流；Pod 分布不均会产生热点。

### 2. IP / Pod 直连模式

```text
CLB / NLB / ALB
      ↓
OpenResty PodIP : containerPort
```

Controller 根据 Service 的 EndpointSlice，把 Ready Pod IP 注册到云 LB。

优点：

* 少一次 NodePort/kube-proxy 转发。
* 健康检查和故障摘除更接近 Pod 粒度。
* 更接近按 OpenResty Pod 均衡。

代价：

* Pod IP 必须从云 LB 网络可达。
* CNI、安全组、NACL 和 NetworkPolicy 必须支持。
* HPA 扩缩容会产生大量目标注册和注销。
* 必须处理 EndpointSlice、LB 控制面和数据面的传播延迟。
* 终止 Pod 时必须正确执行 readiness 关闭、目标注销和连接排空。

AWS Controller 将这两种模式称为 `instance` 和 `ip`；腾讯 TKE 通常描述为 NodePort 模式和 CLB 直连 Pod 模式，不能把厂商术语机械混用。[AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/latest/how-it-works/)

---

## 七、结合当前灰度架构，正确落点

当前架构应固定为：

```text
CDN / WAF
    ↓
CLB / ELB
    ↓
gray-gateway Service
    ↓
OpenResty Pods
    ↓
┌──────────────────────┐
│ stable Service       │
│ canary Service       │
└──────────────────────┘
```

关键原则：

1. 云 LB 的目标只能是 OpenResty 灰度网关层。

   * Node 模式：注册 Node + `gray-gateway` NodePort。
   * Pod 直连模式：注册 OpenResty Pod IP + Port。

2. stable/canary 业务 Pod 不能分别注册到云 LB 的加权 Target Group。

   否则会形成：

```text
云 LB 灰度一次
    +
OpenResty 再灰度一次
```

最终用户桶位、比例、回滚和粘滞都会失控。

3. 如果 OpenResty 负责全部七层逻辑，优先考虑四层 CLB/NLB。

   这样 TLS、Cookie、用户身份、WebSocket 和灰度逻辑统一在 OpenResty。

4. 如果必须使用 WAF、TLS 卸载、域名/Path 路由，可以使用七层 CLB/ALB，但所有规则最终只能进入同一个 `gray-gateway` Target Group。

5. 云 LB 会话保持不能替代 OpenResty 灰度粘滞。

   云 LB 粘滞只是把客户端固定到某个 OpenResty Pod；版本选择仍必须由所有 OpenResty Pod 使用相同算法和策略完成。

6. `remote_addr` 不能作为灰度主体。

   CDN、七层 LB、NodePort SNAT 都可能改变它。灰度主体必须来自认证后的 `subject_id` 或签名设备 Cookie；客户端 IP 只能从可信 XFF/Proxy Protocol 链中取得。

---

## 八、最容易被忽略的故障模型

### 1. 所有后端健康检查失败

腾讯 CLB 官方说明：如果所有后端都被判断为异常，CLB 可能重新把请求转发给全部后端，即 Fail Open。[腾讯云 CLB 健康检查](https://cloud.tencent.com/document/product/214/6097)

所以不能假设“健康检查失败后流量一定为零”。

### 2. 跨可用区不等于均匀

流量通常先落到某个可用区的 LB 节点，再由该节点选择目标。关闭跨区转发时，各区目标数量不同会造成严重热点；开启后则会增加跨区流量、时延和费用。

### 3. 健康不等于容量足够

`/readyz = 200` 只能证明 Pod 可以接请求，不证明它能承载下一档 50% 或100% 流量。灰度晋级必须额外检查：

* Ready Pod 数量
* 跨可用区分布
* CPU、线程池、连接池余量
* 预计下一档流量容量
* LB 目标注册是否已经收敛

### 4. 摘除不等于立即无流量

目标注销后，既有连接仍可能处于 draining。AWS ALB/NLB 的目标注销会等待进行中的连接完成，并存在配置传播时间。[AWS Target Connection Draining](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-register-targets.html)

WebSocket、HTTP/2 和长轮询需要单独设计排空时间。

## 最终选型建议

对于当前 OpenResty 用户级灰度架构，我的默认建议是：

```text
优先方案：
四层 CLB / NLB
    → OpenResty Pod IP 直连
    → stable / canary ClusterIP Service

兼容方案：
四层 CLB / NLB
    → NodePort
    → OpenResty Pods

需要 WAF / TLS 卸载时：
七层 CLB / ALB
    → 唯一 gray-gateway Target Group
    → OpenResty 决策版本
```

所以不要先问“CLB 还是 ELB”，而应按这个顺序选：

1. 四层还是七层。
2. NodePort 还是 Pod IP 直连。
3. TLS 在哪里终止。
4. 是否需要保留客户端源 IP。
5. 跨区是否开启。
6. 健康检查、目标注销和连接排空如何协同。
7. 确保灰度决策权只存在于 OpenResty。
