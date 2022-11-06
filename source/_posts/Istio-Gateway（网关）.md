---
title: Istio Gateway（网关）
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-10-24 16:15:25
password:
summary: Istio Gateway（网关）
tags:
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

# Istio Gateway（网关）

## 什么是网关？

Istio 网关描述了在网格边缘运行的负载均衡器，用于接收传入或传出的 HTTP/TCP 连接。 该规范描述了一组应该公开的端口、要使用的协议类型、要监听的虚拟主机名等。

Ingress 允许将服务暴露给外部世界，因此它是网格内运行的所有服务的入口点。

Istio Gateway 基于 envoy 代理，它为服务网格网络中运行的服务处理反向代理和负载均衡。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221021183837.png)

在 Istio 中有两种网关，一种是用来控制进入的流量网关叫 Ingress 网关，另一种叫 Egress 网关，它主要控制出口流量。

## Istio Gateway vs Kubernetes Gateway

与 [Kubernetes Ingress Resources](https://kubernetes.io/docs/concepts/services-networking/ingress/) 不同，Istio Ingress 不包含任何流量路由配置。 入口流量的流量路由是使用 Istio 路由规则配置的，与内部服务请求完全相同。

## How it works

Ingress 资源由两个 Istio 资源处理：

| Resource       | API                 | Version  |
| -------------- | ------------------- | -------- |
| Gateway        | networking.istio.io | v1alpha3 |
| VirtualService | networking.istio.io | v1alpha3 |

**Gateway**: [网关](https://istio.io/latest/docs/reference/config/networking/gateway/)资源用于配置网关暴露的主机。

有效的协议有：**HTTP|HTTPS|GRPC|HTTP2|MONGO|TCP|TLS**。有关网关的更多信息可以在 [Istio 官方网关文档](https://istio.io/latest/docs/reference/config/networking/gateway/)中找到。

**Virtual Service**: [VirtualService](https://istio.io/docs/reference/config/networking/v1alpha3/virtual-service/) 与网关配合使用。它定义了目标服务。 虚拟服务定义了控制服务请求如何在 Istio 服务网格中路由的规则。 例如，虚拟服务可以将请求路由到不同版本的服务或与请求完全不同的服务。 可以根据请求源和目标、HTTP path 和 header 字段以及与各个服务版本关联的权重来路由请求。

## Gateway 配置示例

### 任务说明

创建一个入口网关，将进入网格的流量分发到不同地址

### 任务目标

* 学会用 Gateway 控制入口流量
* 掌握 Gateway 的配置方法

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221024111244.png)

从上图可以看到，网关实际上也是需要一个 Envoy Sidecar 去配合使用的，另外如果你要在网关上进行一些流量控制，你还需要定义一个虚拟服务。

### 演示

首先查询下我们集群中有哪些网关：

```shell
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [11:22:19] 
$ kubectl get gateway
NAME               AGE
bookinfo-gateway   7d18h
```

目前我们的集群中只有 bookinfo 这个网关，这个网关是我们在安装 Bookinfo 应用的时候创建的，它主要是作为应用的整体入口。

我们现在创建另一个网关，把其中一个叫 detail 的服务暴露出去。

执行以下命令：

```shell
kubectl create -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: test-gateway # 网关名称
spec:
  selector: # 一般指向网关的 Pod
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "*"
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: test-gateway
spec:
  hosts:
  - "*"
  gateways: # 这个字段值是设置成上面网关的名称
  - test-gateway
  http:
  - match: # 这个 details 服务有两个可以被暴露出来的 url，一个是 details 本身，另一个是健康检查
    - uri:
        prefix: /details
    - uri:
        exact: /health
    route:
    - destination:
        host: details
        port:
          number: 9080
EOF
```

查询我们创建的资源：

```shell
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [11:41:37] 
$ kubectl get virtualservice,gateway
NAME                                              GATEWAYS             HOSTS           AGE
......
virtualservice.networking.istio.io/test-gateway   [test-gateway]       [*]             114s
......

NAME                                           AGE
......
gateway.networking.istio.io/test-gateway       114s
......
```

可以看到我们的网关和网关对应的一个虚拟服务都创建成功了。

我们在浏览器中验证下我们暴露出来的两个uri 是不是已经生效了：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221024134419.png)

从页面的输出我们可以看到已经成功获取到 id 等于0 的details信息。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221024134618.png)

另一个健康检查的 uri 也能正常显示，说明我们设置的网关已经生效。

## 网关资源的配置选项

参考官方文档的 [Gateway配置 ](https://istio.io/latest/docs/reference/config/networking/gateway/#Gateway)说明

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221024135722.png)

## GateWay 的应用场景

* 暴露网格内服务给外界访问

  网关最主要的功能就是把网格内的服务暴露到外边，供外界来访问

* 访问安全（HTTPS、mTLS等）

  网关还可以配置一些访问安全相关的功能，比如：我们希望外部是通过 HTTPS 来访问内部服务的，而内部服务本自身是 HTTP 的协议

* 统一应用入口，API 聚合

  网关一般都作为一个应用的统一入口，或者做一些 API 聚合这样的功能

## 参考

* https://istio.io/latest/docs/reference/config/networking/gateway/
* https://istio.io/latest/docs/concepts/traffic-management/#gateways