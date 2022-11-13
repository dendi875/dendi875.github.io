---
title: Istio Engress—实现访问外部服务
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-11-13 18:16:05
password:
summary: Istio Engress—实现访问外部服务
tags:
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

# Istio Engress—实现访问外部服务

在 Istio 中访问外部服务的方法

* 配置 global.outboundTrafficPolicy.mode = ALLOW_ANY

​		该配置项默认情况下是允许所有的服务都可以访问外部服务，但这方式并不推荐，因为不安全，建议生产上把该配置项修改为`REGISTRY_ONLY`，即只有注册		过的服务才能访问外部服务。

*  [使用服务入口（ServiceEntry）](https://zhangquan.me/2022/10/24/istio-serviceentry-fu-wu-ru-kou/)

* 配置 Sidecar 让流量绕过代理 

  通过配置一个 Sidecar API 资源，让流量饶过代理。也就是通过配置让你跳过 Sidecar Envoy 代理的管控，直接去访问外部服务，这种方式一般我们不去使用它，因为如果你使用它相当于你并没有使用 Istio 数据平面，该方式不推荐。

* 配置 Egress 网关

## 什么是 Egress

* Egress 网关

​		定义了网格的出口点，允许你将监控、路由等功能应用于离开网格的流量

* 应用场景
  * 所有出口流量必须流经一组专用节点（安全因素） 
  * 为无法访问公网的内部服务做代理

## 创建 Engress 网关示例

### 任务说明

创建一个 Egress 网关，让内部服务通过它访问外部服务

### 演示

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221113171047.png)

如上图所示，我们还是使用 [sleep](https://github.com/istio/istio/tree/release-1.15/samples/sleep) 这个服务，由它去把流量打向 Egress 网关，然后由网关去把流量指向外部的 [Httpbin](https://github.com/istio/istio/tree/release-1.15/samples/httpbin) 服务

* 部署 [sleep](https://github.com/istio/istio/tree/release-1.15/samples/sleep) 服务（可选的，如果服务已存在就不用部署了）

  ```shell
  # zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [17:18:05] 
  $ kubectl apply -f samples/sleep/sleep.yaml 
  serviceaccount/sleep created
  service/sleep created
  deployment.apps/sleep created
  ```

  查看 sleep 服务

  ```shell
  $ kubectl get pod
  NAME                              READY   STATUS    RESTARTS   AGE
  ......
  sleep-f8cbf5b76-fm6xk             2/2     Running   0          31s
  ......
  ```

* 查看 egressgateway 组件是否存在

  ```shell
  $ kubectl get pod -n istio-system
  NAME                                    READY   STATUS    RESTARTS   AGE
  grafana-5cc7f86765-2tzdg                1/1     Running   0          36m
  istio-egressgateway-598d7ffc49-nzmv7    1/1     Running   0          36m
  istio-ingressgateway-7bd5586b79-2v7mg   1/1     Running   0          36m
  istio-tracing-8584b4d7f9-xgll5          1/1     Running   0          36m
  istiod-646b6fcc6-jxc9h                  1/1     Running   0          37m
  kiali-696bb665-lxr8d                    1/1     Running   0          36m
  prometheus-6c88c4cb8-47srr              2/2     Running   0          36m
  ```

  所上面所示，`istio-egressgateway-xxxx `是存在的，

* 为外部服务 httpbin 定义 ServiceEntry

  ```shell
  kubectl apply -f - <<EOF
  apiVersion: networking.istio.io/v1alpha3
  kind: ServiceEntry
  metadata:
    name: httpbin
  spec:
    hosts:
    - httpbin.org
    ports:
    - number: 80
      name: http-port
      protocol: HTTP
    resolution: DNS
  EOF
  ```

  查看是否配置成功：

  ```shell
  $ kubectl get se
  NAME      HOSTS           LOCATION   RESOLUTION   AGE
  httpbin   [httpbin.org]              DNS          76s
  ```

* 查看 egressgateway 的 Pod 中的容器日志

  这个时候我们打开 egressgateway 它的 log来看一看是不是请求会通过它来指向外部服务

  ```shell
   kubectl logs -f  $(kubectl get pod -l istio=egressgateway -n istio-system -o jsonpath='{.items[0].metadata.name}') -n istio-system
  ```

  我们再去 sleep 容器中执行下面的请求，去访问外部服务：

  ```shell
  $ kubectl exec -it sleep-f8cbf5b76-fm6xk  -c sleep -- curl http://httpbin.org/ip
  {
    "origin": "103.206.189.20"
  }
  ```

  可以看到它已经有正常返回了，查看 egressgateway 的 Pod 中的容器日志：

  ```shell
  $ kubectl logs $(kubectl get pod -l istio=egressgateway -n istio-system -o jsonpath='{.items[0].metadata.name}') -n istio-system | tail
  ......
  2022-11-13T09:39:38.606420Z     info    pickfirstBalancer: HandleSubConnStateChange: 0xc00060d0a0, {CONNECTING <nil>}
  2022-11-13T09:39:38.615730Z     info    pickfirstBalancer: HandleSubConnStateChange: 0xc00060d0a0, {READY <nil>}
  ```

  可以看到 egressgateway 并没有请求的日志，这是符合我们预期的，因为我们现在还没有配置流量通过 egressgateway 来转发到外部

* 配置 Egress gateway

  ```shell
  kubectl apply -f - <<EOF
  apiVersion: networking.istio.io/v1alpha3
  kind: Gateway
  metadata:
    name: istio-egressgateway
  spec:
    selector:
      istio: egressgateway  # 使用 istio 默认的 egressgateway
    servers:
    - port:
        number: 80  # 对应外部服务的端口
        name: http
        protocol: HTTP
      hosts:    # 对应外部服务的地址
      - httpbin.org
  EOF
  ```

  查看 gateway 是否创建成功：

  ```shell
  $ kubectl get gateway
  NAME                  AGE
  bookinfo-gateway      64m
  istio-egressgateway   42s
  ```

* 定义路由，将流量引导到 egressgateway

  给 egressgateway 设置一下路由规则，我们需要建立一个 VirtualService，将流量从 sidecar 引导至 egress gateway，再从 egress gateway 引导至外部服务：

  ```shell
  kubectl apply -f - <<EOF
  apiVersion: networking.istio.io/v1alpha3
  kind: VirtualService
  metadata:
    name: vs-for-egressgateway
  spec:
    hosts:
    - httpbin.org
    gateways:
    - istio-egressgateway  # 针对 Egress 网关的
    - mesh   # 针对内部的网格的，Mesh 表示网格中的所有 Sidecar，如果没有指定 gateways，则默认为 mesh
    http:
    - match:  # 第一个匹配规则，针对 Mesh 内部服务的路由规则
      - gateways:
        - mesh
        port: 80
      route:  # 把请求路由到 Egress 网关这个DNS名称上,通过这个 match 会把所有内部的请求全部转向网关这个节点
      - destination:
          host: istio-egressgateway.istio-system.svc.cluster.local 
          subset: httpbin
          port:
            number: 80
        weight: 100
    - match:  # 第二个匹配规则，针对网关的路由规则，会把网关的请求指向最终我们外部的服务地址
      - gateways:
        - istio-egressgateway
        port: 80
      route:
      - destination: # 将服务路由到什么地方去
          host: httpbin.org
          port:
            number: 80
        weight: 100
  ---
  apiVersion: networking.istio.io/v1alpha3
  kind: DestinationRule
  metadata:
    name: dr-for-egressgateway
  spec:
    host: istio-egressgateway.istio-system.svc.cluster.local  # 配置的实际上是 Egress 网关的一个DNS名称
    subsets:
    - name: httpbin
  EOF
  ```

* 查看日志验证

  现在我们再去 sleep 容器中执行一个 curl 命令，然后查看一下egressgateway 的 Pod 中的容器日志，看请求是不是通过egress gateway 出去的

  * sleep 容器执行 curl 请求外部服务

    ```shell
    $ kubectl exec -it sleep-f8cbf5b76-fm6xk  -c sleep -- curl http://httpbin.org/ip
    {
      "origin": "172.17.0.16, 103.206.189.20"
    }
    ```

  * 查看 egressgateway 的 Pod 中的容器日志

    ```shell
    $ kubectl logs $(kubectl get pod -l istio=egressgateway -n istio-system -o jsonpath='{.items[0].metadata.name}') -n istio-system | tail
    ......
    [2022-11-13T09:54:53.829Z] "GET /ip HTTP/2" 200 - "-" "-" 0 46 642 641 "172.17.0.16" "curl/7.83.1" "41f8da95-3e03-999d-ad9c-c3f484d9fc09" "httpbin.org" "54.166.148.227:80" outbound|80||httpbin.org 172.17.0.4:37542 172.17.0.4:80 172.17.0.16:56190 - -
    ```

    可以看到有一条上面的 `"GET /ip` 的日志信息，说明访问经过了 egress gateway 出去了。不过需要注意的是我们这里只定义了 egress gateway 的 80 端口流量，如果我们通过访问 HTTPS 则会直接跳转到 `http://httpbin.org`。

* 配置分析

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/istio-egressgateway-4.png)

  ​								如上所示，首先我们是要通过内部的 sleep 服务来访问外部的 httpbin 服务，我们第一步先为 httpbin 定义一个 ServiceEntry 来把外部服								务封装起来，接着我们定义了 Egress 网关，这个网关存在于 Mesh 的边界，用来收敛我们最终对外的请求，然后我们又定义了一个虚拟服								务，该虚拟服务中定义了两个路由规则，其中一个路由规则是针对内部服务的，也就是针对网格内的 Sidecar，另一个路由规则是针对 								Egress 网关的，同时我们还有 Egress 网关定义了一个目标规则，用来指向真实的地址。

## 参考

* https://istio.io/latest/docs/tasks/traffic-management/egress/egress-gateway/
* https://istio.io/latest/zh/docs/tasks/traffic-management/egress/egress-gateway/