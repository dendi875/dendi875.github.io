---
title: Istio 入门及核心功能介绍
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-09-25 21:23:08
password:
summary: Istio 入门及核心功能介绍
tags:
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---


# Istio 入门及核心功能介绍

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925170849.png)



现在最火的后端架构无疑是**微服务**了，微服务将之前的单体应用拆分成了许多独立的服务，好处自然很多，但是随着应用的越来越大，微服务暴露出来的问题也就随之而来了，微服务越来越多，管理越来越麻烦，特别是要你部署一套新环境的时候，你就能体会到这种痛苦了，随之而来的**服务发现、负载均衡、Trace跟踪、流量管理、安全认证等等**问题。如果从头到尾完成过一套微服务框架的话，你就会知道这里面涉及到的东西真的非常多。对于 Java 领域来说还有 Spring Cloud 这种完整的微服务框架，但是也仅仅局限于 Java 语言。当然随着微服务的不断发展，微服务的生态也不断完善，最近就发现新一代的微服务开发就悄然兴起了，那就是 Service Mesh（服务网格）。

而 istio 是现在最热门的 Service Mesh 工具，istio 是由 Google、IBM、Lyft 等共同开源的 Service Mesh（服务网格）框架，于2017年初开始进入大众视野。Kubernetes 解决了云原生应用的部署问题，istio 解决的是应用的服务（流量）治理问题。所以我们完全有必要去学习了解 istio，因为这就是微服务领域的下一个标准。



## 什么是 Istio

官方定义：它是一个完全开源的**服务网格**，作为**透明**的一层接入到现有的分布式应用中。它也是一个平台，可以与任何日志、遥测和策略系统进行集成。Istio 多样化的特性让你能够成功且高效地运行**微服务架构**，并**提供保护、连接和监控微服务**的统一方法。

我们从官方定义中可以罗列下 Istio 的几个核心要点：

* 它依然是一个服务网格产品
* 它拥有服务网格的基本特性（对应用层是透明的）
* 它是为微服务架构来服务的
* 它可以连接、控制、保护、观测微服务系统

## Istio 名字来源

Istio 并不是一个英语单词，而是来源于希腊语，它的意思是扬帆起航，从 Istio 的 Logo 中也可以看到它是一个船的「帆」，Kubernetes 也起源于希腊语，它的意思和 Logo 也是一样的「舵」即舵手的意思，Google 为什么用 Istio 来给这个产品命名，其实是非常有深意的，它的意思是你不仅有 Kubernetes 这个舵，还得有 Istio 这个帆，由它们一起驾驶着你的云原生应用扬帆起航，Istio 也被称作是第二代的 Service Mesh，在原来数据平面的基础上增加了控制平面，它为现代的 Service Mesh 的产品定义了一个新的形态。

## Istio 核心功能

### 流量控制

流量控制顾名思义就是对流量请求进行控制和管理，拿交通为例，红绿灯其实就是用来管理交通流量的一种手段，家里用的路由器或者说是设置黑白名单也是一种流量控制的手段，Istio 提供的流量控制能力非常强大除了基本的**服务发现和负载均衡**以外，还有以下四个功能：

* 路由、流量转移：我们经常听到的像灰度发布、蓝绿部署、AB测试都是基于它演变出来的
* 流量进出：我们可以用 API 网关对流量进出进行管理
* 网络弹性能力：对网络增加了一些弹性能力，比如超时、重试、熔断这样的机制
* 测试相关：提供了一些调试网格的特性，比如故障注入、流量镜像这样的功能



熔断：它是一个非常重要的过载保护机制，可以让客户端快速失败，而不去访问出现问题的服务端，这样可以把整个系统的故障控制在一定范围之内。

故障注入：它可以故意地给你的服务植入一些故障，比如，增加你服务的延迟、或者直接让你的服务中断（比如直接返回500错误），通过故障注入的方式可以模拟你服务出现问题时整个应用是如何处理的。

流量镜像：我们很难在本地的开发环境中去模拟线上环境，有的时候本地测试的没有任务问题，但系统部署到了线上就会出现问题，这是因为环境不同以及流量不同，而流量镜像这个功能可以完全地把生产环境的流量镜像一份，然后发送到你的镜像服务中，这样就可以在镜像服务中来调试线上环境可能出现的问题。



Istio 提供的流量控制能力主要由以下这些自定义资源来实现：

* 核心资源（CRD）

  * 虚拟服务（Virtual Service）

  * 目标规则（Destination Rule）

  * 网关（Gateway）

  * 服务入口（Service Entry）

  * Sidecar

其中虚拟服务和目标规则主要是用来管理网格内部的流量，而网关是用来管理网格以外的流量，服务入口则面向的主要是服务，Sidecar 它是对流量进行一个全局的控制。

#### 虚拟服务（Virtual Service）

虚拟服务是实现路由功能的重要组件，它主要的功能是把请求的流量路由到指定的目标地址，它可以做到把请求的地址和真实的工作负载进行解藕，本质上来讲它就是一组路由规则。



![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925173836.png)

如上图展示了一个虚拟服务，它里面定义了两个不同的路由规则，其中规则1会把请求指向目标地址A，规则2会把请求指向目标地址B。

虚拟服务通常和目标规则（Destination Rule）成对出现，它提供了丰富的路由匹配规则，比如可以针对 Endpoint、针对 Uri、针对 Header 这样不同粒度的路由进行匹配。

#### 目标规则（Destination Rule）

目标规则定义了虚拟服务里面配置的具体的目标地址，在它的配置中是以**子集**这个概率存在的，也就是每个子集里会配置一个对应的目标地址。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925175600.png)

如上图所示，上半部分是虚拟服务，而下面虚线框内表示的就是具体的目标规则，在目标地址A中定义了两个子集A1和A2，目标地址B中定义了另外两个子集B1和B2，目标规则除了能定义子集，还可以**对负载均衡的策略进行修改**，默认情况下是以轮巡的方式进行负载均衡的，你可以配置使用随机、权重、最少请求数这样的方式进行负载均衡。

#### 网关（Gateway）

Istio 内部定义的这个 Gateway 和我们平常所说的 API 网关本质是一个东西，它同样存在于整个网格的边界，用来管理进出的流量。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925180353.png)

如上图所示，有两个网关，其中负责管理流量进入的网关叫 Ingress，管理流量出去的网关叫 Egress，Egress 网关并不是必选项，你可以不去使用它，内部服务的流量可以直接指向外部服务。我们可以通过网关来管理内部流量一样来管理网格外的流量，比如说为进出的流量增加负载均衡的能力，增加超时重试这样的能力，Istio 内部预定了两个网关分别是 Ingress Gateway 和 Egress Gateway，你也可以自己去实现自己的Gateway。

#### 服务入口（Service Entry）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/istio-service-entry.png)

服务入口面向的主要是服务，它主要的功能是把外部的服务注册到网格内，这样你就可以像管理网格内部的服务一样去管理外部的服务，服务入口主要的功能有以下三点：

* 它可以为外部的目标转发请求

* 它可以添加超时重试等策略
* 它可以扩展你的网格

一个简单的例子比如你的服务部署在不同的集群中，那么你可以通过定义服务入口的方式把这几个不同的集群集中起来，共同用同一个网格进行管理。

#### Sidecar

Sidecar 它是对流量进行一个全局的控制，而前几个资源它主要是做一些细粒度的控制，Sidecar 主要有以下两个功能：

* 调整 Envoy 代理接管的端口和协议
* 限制 Envoy 代理可访问的服务

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925182110.png)

默认情况下 Envoy 是接管所有发送到服务的请求的，而通过 Sidecar 你可以调整接管流量的范围，比如上图所示的，我们只监听来自于端口 9080 的HTTP协议，另外它还可以限制 Envoy 代理可访问的服务，默认情况下 Envoy 是可以访问整个网格内的所有的服务，假设你可以像上图所示，让它只访问服务A而切断它对服务B的访问权限。

### 可观察性

有一句话是这样描述的：能够在生产环境中监控系统的运行状态比在开发环境中完整地测试所有的功能更重要。如果你仔细体会一下就会发现这句话非常有道理，在生产环境中对于服务的观察是非常重要的，特别是对于微服务这样的架构来说，因为服务很多又比较分散，服务本身又是多样化的，所以能够了解整个应用的状态是非常重要的，

#### 什么是可观察性？



![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925192235.png)

云原生基金会（CNCF）在 18 年的时候把可观察性作为了自己蓝图中的一个模块，有些人一提到可观察性就说这不就是监控嘛，实际上它和监控还是有非常大的区别，监控指的是从运维人员的角度去审视系统的行为，审核系统的状态，它是一个被动的方式，是从系统之外去探究系统的运行状态。而可观察性是指从开发人员的角度主动地去探究系统的运行情况，对于开发人员来说，研发是他的主要工作，他需要在自己的开发过程中主动地去考虑把哪些系统的指标暴露出去，而在以前我们只是通过记录日志的方式去查看系统运行的情况，可观察性的出现无疑不是一种巨大的进步。

一般情况我们把可观察性分为指标、日志收集和分布式追踪。

#### 指标

指标又叫度量，它指的是以聚合数据的方式来理解和查看系统的行为，举个例子，我们可以在系统运行的过程中在一些时间点上做一些记录，然后把这些生成的数据统一起来，最后就能以一个趋势图的方式来展示系统在这段时间中运行的状态。

Istio 中的指标主要分为三类：

* 代理级别的指标（Proxy-level） 
* 服务级别的指标（Service-level） 
* 控制平面指标（Control plane）

##### 代理级别的指标

代理级别的指标顾名思义就是用来收集 Sidecar 代理上的一些数据，Sidecar 代理会接管所有来自于服务的请求，因此有很多丰富的数据供我们收集，我们还可以指定让某一个或者某几个 Sidecar 进行指标的收集，这样方便我们进行一些问题的调试。

代理级别指标的例子：

```shell
envoy_cluster_internal_upstream_rq{response_code_class="2xx",cluster_name="xds-grpc"} 7163

envoy_cluster_upstream_rq_completed{cluster_name="xds-grpc"} 7164

envoy_cluster_ssl_connection_error{cluster_name="xds-grpc"} 0
```

上面列举了三个比较典型的代理级别的指标，第一个指标是当前集群中来自于上游服务的总的请求数量，第二个指标是上游服务的完成的请求数量，第三个SSL连接出错的数量。

##### 服务级别的指标

服务级别的指标主要是用来收集服务本身的一些信息，主要是根据延迟、流量、错误、饱和这四个服务的基本监控需求来进行收集，默认认情况下这些指标数据会导出到 Prometheus，当然你也可以自定义或修改，服务级别的指标不一定输出，你可以根据情况进行开启或关闭。

服务级别指标的例子：

```shell
istio_requests_total{
  connection_security_policy="mutual_tls",  # 连接的安全策略是双向tls
  destination_app="details",
  destination_canonical_service="details",
  destination_canonical_revision="v1",
  destination_principal="cluster.local/ns/default/sa/default",
  destination_service="details.default.svc.cluster.local",
  destination_service_name="details",
  destination_service_namespace="default",
  destination_version="v1",
  destination_workload="details-v1",
  destination_workload_namespace="default",
  reporter="destination",
  request_protocol="http", # 请求的协议
  response_code="200", # response 的响应码
  response_flags="-",
  source_app="productpage",
  source_canonical_service="productpage",
  source_canonical_revision="v1",
  source_principal="cluster.local/ns/default/sa/default",
  source_version="v1",
  source_workload="productpage-v1",
  source_workload_namespace="default"
} 214
```

上面演示了一个服务级别的指标 istio_requests_total，它主要包含以下信息，比如说连接的安全策略是双向tls，以及目标地址的详细信息，还有请求的协议是 http，response 的响应码是 200。

##### 控制平面指标

除了通过代理级别的指标和服务级别的指标来监控应用的状态，你还可以收集控制平面的指标来监控 Istio 本身的运行状况，这样你就可以了解到整个网格的健康情况，

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925195258.png)

上图显示的是 Istio 官方文档提供的一些控制平台的指标，有关这些被维护指标的更多信息，请查看[参考文档](https://istio.io/latest/zh/docs/reference/commands/pilot-discovery/#metrics)。

#### 日志收集

指标是通过聚合的数据来监测你的应用运行情况，而日志指的是通过系统产生的事件来监控你的应用。

Istio 里提供的访问日志包括了非常完整的元数据信息，比如说请求的来源以及目标地址，同时你还可以对日志产生的位置进行设置，可以把它保存在本地，也可以把它直接导入到远程的第三方工具里（如 ELK、EFK）。

一般来说日志内容主要包括两部分，一部分是应用本身的日志，就是开发人员在开发应用时自己输出的一些 Log，另一部分是Envoy产生的信息，它会对请求产生的数据进行一个详细地记录，查看的方式也非常简单，直接通 kubectl 的 logs 命令对 Envoy 的 Container 进行查看就可以了。

Envoy 日志查看示例：

```shell
kubectl logs -l app=demo -c istio-proxy
```

#### 分布式追踪

分布工追踪通过追踪请求来了解服务之间的调用关系，我们主要把分布式追踪用于问题的排查以及性能分析方面。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925200515.png)

如上图所示，左图中是一个没有使用分布式跟踪的应用，当第一个节点出现问题时候，你不知道具体的问题出现在哪个服务中，因为你没有办法追踪它，只能通过不停的尝试来发现问题的所在。而在右图中是使用了分布式追踪的一个系统，一旦你的第一个节点出现了问题，你能通过分布式追踪系统很快地发现在调用链上是哪个节点出现了问题，非常的方便和高效。

我们经常在开发中遇到这样的案例，你负责服务A，调用你的人跑过来说你的服务出现了问题，通过排错你发现实际上出现问题的是你调用的服务B，于是你又跑去找服务B，服务B的开发者经过调试，发现实际上是它的调用的服务C出了问题，这样的案例很常见，整个问题排查的过程是非常低效的，但有了分布式追踪系统就可以极大地提升排查问题的效率，也可以避免被别人甩锅，你可以把本属于你的锅甩给应该背锅的人。



![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925201541.png)



上图是分布式追踪系统 Jeager 里的截图，可以从左边的部分看到整个服务的一个调用关系，以及整个服务执行完所需要的时间，每一个调用耗费了多少时间都列得非常清楚，一旦某个调用链出现了问题，也可以很快发现它的异常情况。

### 安全

安全对于一个互联网应用来说是非常重要的，因此 Service Mesh 技术也必须提供安全相关的功能，Istio 中的安全主要分为**认证和授权**两大部分，绝大部分功能是由 Istiod 这个控制平面来实现的。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925202414.png)

上图为 Istio 官方提供的安全架构图，CA 主要用来负责证书的管理，认证策略和授权策略都会被存储在对应的模块中，由API Server 将这些策略变成配置下发到对应的数据平面中，当一个终端用户调用网格内服务的时候，它可以使用经典的 JWT 方式进行认证，而网格内服务与服务之间可以使用双向TLS进行认证。



#### 认证

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925203158.png)

如上图所示，管理员配置了两种策略，一种是针对 Foo 这个 Namespace，它的目标是全体的服务，另外一种策略是针对 Bar 这个Namespace，它的目标是 Workload X，这些策略会被转变成具体的配置信息，然后由 istiod 下发给具体的 Sidecar 代理，Istio 在认证中提供了一种兼容的模式，你可以以不加密的方式和加密的方式同时进行请求的传输，这为我们进行安全设置方面的调试带来了很大的便利性，比如当我们想要增加 mTLS 这样的认证策略的时候，我们可以先用纯文本的方式测试服务之间的连通性，然后再把这个策略加上去。

Istio 认证主要包括两种：

* 对等认证

对等认证也就是我们平时所说的传输身份认证，它主要的功能是用于服务与服务之间的身份认证，目前 Istio 支持以 mTLS （Mutual TLS）这样的方式进行认证。

* 请求认证

请求认证也就是我们通常所说的终端用户认证，它主要是用于给终端用户访问我们的服务进行认证的，目前 Istio 支持的是 JWT （JSON Web Token）这种非常流行的方式。



对于不同的认证方式我们需要建立对应的 CRD，比如说我们要配置一个对等认证就需要构建一个 PeerAuthentication 这样一个 CRD，同时我们需要指定它的生效范围，认证配置的生效范围主要有三点，第一种就是在全网格内生效，第二种就是在当前的命名空间生效，比如下面的示例中是在 namespace foo 里生效，另外我们还可以进一步指定具体的工作负载，在下面的配置中我们指定了一个选择器，这样的话配置就只针对标签为 reviews 的服务来生效。

```yaml
apiVersion: "security.istio.io/v1beta1"
kind: "PeerAuthentication"
metadata:
  name: "example-peer-policy"
  namespace: "foo"
spec:
  selector:
    matchLabels:
      app: reviews
  mtls:
    mode: STRICT
```

具体的配置策略就是最下面的 mtls ，它的模式是严格模式，也可以修改成兼容模式，一旦策略进行了更新，Istio 几乎会实时地将这些策略推送到具体的数据平面中，但是 Istio 它不能保证同时更新所有的数据平面，这个时候你就需要注意避免策略的中断，一般情况下推荐两种方式：

如果是对等认证，你需要设置 MTLS 那么这个时候你最好使用兼容模式，等调试完成之后再使用严格模式。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925205342.png)

如果是身份认证，你可以把新旧两个 JWT 同时配置进你的策略当中，当请求全部迁移到新的JWT里面之后，再把旧的删除就可以了。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925205532.png)



#### 授权

授权分了三个级别，分别是针对网格，针对命名空间，以及服务进行授权。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925205953.png)

如上图所示，当管理员增加一个授权策略的时候，API Server 会把策略转换成对应的配置，然后下发给对应的数据平面的 Sidecar，每个 Sidecar 会运行一个授权引擎，该引擎在运行的时候进行授权请求，如果请求到达代理时，授权引擎根据当前的策略评估请求上下文并返回授权的结果，授权在默认情况下无需你显式地启动，默认就是启动状态。



下面我们来看看授权策略是如何配置的？

授权策略的配置需要通过创建一个叫 AuthorizationPolicy 的 CRD，这个 CRD 主要有以下组成部分

* 选择器（selector）：指定策略的目标
* 动作（action）：可以配置允许或者拒绝两种行为
* 具体的规则列表（rules）：指定何时触发动作，规则列表包括三部分内容
  * `from` 字段指定请求的来源
  * `to` 字段指定请求的具体操作
  * `when` 字段代表具体的匹配条件

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
 name: httpbin
 namespace: foo
spec:
 selector:
   matchLabels:
     app: httpbin
     version: v1
 action: ALLOW
 rules:
 - from:
   - source:
       principals: ["cluster.local/ns/default/sa/sleep"]
   - source:
       namespaces: ["dev"]
   to:
   - operation:
       methods: ["GET"]
   when:
   - key: request.auth.claims[iss]
     values: ["https://accounts.google.com"]
```



授权策略的设置方式也很多：

* 范围（目标）设置：主要通过 metadata/namespace，selector 来指定具体的服务

  以下示例策略 `allow-read` 允许对 `default` 命名空间中带有标签 `app: products` 的工作负载的 `"GET"` 和 `"HEAD"` 访问。

  ```yaml
  apiVersion: security.istio.io/v1beta1
  kind: AuthorizationPolicy
  metadata:
    name: allow-read
    namespace: default
  spec:
    selector:
      matchLabels:
        app: products
    action: ALLOW
    rules:
    - to:
      - operation:
           methods: ["GET", "HEAD"]
  ```

* 值匹配：精确、模糊、前缀、后缀

  以下示例策略允许访问前缀为 `/test/*` 或后缀为 `*/info` 的路径。

  ```yaml
  apiVersion: security.istio.io/v1beta1
  kind: AuthorizationPolicy
  metadata:
    name: tester
    namespace: default
  spec:
    selector:
      matchLabels:
        app: products
    action: ALLOW
    rules:
    - to:
      - operation:
          paths: ["/test/*", "*/info"]
  
  ```

* 全部容许和拒绝

  以下示例显示了一个简单的 `allow-all` 授权策略，该策略允许完全访问 `default` 命名空间中的所有工作负载。

  ```yaml
  apiVersion: security.istio.io/v1beta1
  kind: AuthorizationPolicy
  metadata:
    name: allow-all
    namespace: default
  spec:
    action: ALLOW
    rules:
    - {}
  
  ```

* 自定义条件

  您还可以使用 `when` 部分指定其他条件。 例如，下面的 `AuthorizationPolicy` 定义包括以下条件：`request.headers [version]` 是 `v1` 或 `v2`。 在这种情况下，key 是 `request.headers [version]`，它是 Istio 属性 `request.headers`（是个字典）中的一项。

  ```yaml
  apiVersion: security.istio.io/v1beta1
  kind: AuthorizationPolicy
  metadata:
   name: httpbin
   namespace: foo
  spec:
   selector:
     matchLabels:
       app: httpbin
       version: v1
   action: ALLOW
   rules:
   - from:
     - source:
         principals: ["cluster.local/ns/default/sa/sleep"]
     to:
     - operation:
         methods: ["GET"]
     when:
     - key: request.headers[version]
       values: ["v1", "v2"]
  ```

### 策略

* 限流

* 黑白名单

  

## 参考

* https://istio.io/latest/zh/docs/concepts/traffic-management/
* https://istio.io/latest/zh/docs/concepts/observability/
* https://istio.io/latest/zh/docs/concepts/security/
