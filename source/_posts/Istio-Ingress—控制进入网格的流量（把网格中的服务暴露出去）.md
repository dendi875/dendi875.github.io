---
title: Istio Ingress—控制进入网格的流量（把网格中的服务暴露出去）
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-11-06 19:00:32
password:
summary: Istio Ingress—控制进入网格的流量（把网格中的服务暴露出去）
tags:
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

# Istio Ingress—控制进入网格的流量（把网格中的服务暴露出去）

## Ingress 基本概念

> Istio Ingress 它作为服务的访问入口，接收外部请求并转发到后端服务。

Istio Gateway 的功能与 Kubernetes Ingress 类似，负责进出集群的南北流量。Istio Gateway 描述了一个负载均衡器，用于承载进出服务网格边缘的连接。该规范描述了一组开放端口和这些端口所使用的协议，以及用于负载均衡的 SNI 配置等。

Istio Gateway 资源本身只能配置L4到L6的功能，例如暴露的端口、TLS 设置等；但 Gateway 可与 VirtualService 绑定，在VirtualService 中可以配置七层路由规则，例如按比例和版本的流量路由，故障注入，HTTP 重定向，HTTP 重写等所有Mesh内部支持的路由规则。

## Istio 的 Ingress gateway 和 kubernetes Ingress 的区别

* Kubernetes: 针对 L7 协议（资源受限），可定义基础路由规则
* Istio: 针对 L4-6 协议，只定义接入点，把所有的路由规则全都交给 VirtualService 去管理，这样就可以复用 VirtualService 里面丰富的路由配置

## 创建 Ingress 网关示例

### 确定入口 IP 和端口

* 设置入口端口：

  ```shell
  export INGRESS_PORT=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http2")].nodePort}')
  export SECURE_INGRESS_PORT=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="https")].nodePort}')
  export TCP_INGRESS_PORT=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="tcp")].nodePort}')
  ```

* 设置入口 IP

  ```shell
  export INGRESS_HOST=$(kubectl get po -l istio=ingressgateway -n istio-system -o jsonpath='{.items[0].status.hostIP}')
  
  ```

### 任务说明

我们会创建一个 Ingress 网关，并且引入一个新的服务 httpbin，同时把 httpbin 这个服务通过 Ingress 暴露给外部的请求可以访问。

### 演示

* 部署 httpbin 服务

  ```shell
  # zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [18:20:24] 
  $ kubectl apply -f samples/httpbin/httpbin.yaml
  serviceaccount/httpbin created
  service/httpbin created
  deployment.apps/httpbin created
  
  # 查看部署的 Pod
  $ kubectl get pod
  NAME                              READY   STATUS            RESTARTS   AGE
  ......
  httpbin-779c54bf49-wlxjk          0/2     PodInitializing   0          85s
  ......
  ```

* 部署针对 httpbin 这个服务的 Ingress

  ```shell
  kubectl apply -f - <<EOF
  apiVersion: networking.istio.io/v1alpha3
  kind: Gateway
  metadata:
    name: httpbin-gateway
  spec:
    selector:
      istio: ingressgateway # use Istio default gateway implementation
    servers:
    - port:    # 暴露 http 的 80 端口作为访问点
        number: 80
        name: http
        protocol: HTTP
      hosts:
      - "httpbin.example.com"
  EOF
  
  ```

* 给 Gateway 创建一个对应的 Virtual Service，让它来对 httpbin 这个服务做一个简单的路由

  ```shell
  kubectl apply -f - <<EOF
  apiVersion: networking.istio.io/v1alpha3
  kind: VirtualService
  metadata:
    name: httpbin
  spec:
    hosts:
    - "httpbin.example.com"  # 要跟 gateway 对应设置一个相同的 hosts
    gateways:
    - httpbin-gateway   # 绑定刚才创建的 gateway 名称
    http:
    - match:
      - uri:
          prefix: /status
      - uri:
          prefix: /delay
      route:
      - destination:
          port:
            number: 8000
          host: httpbin
  EOF
  
  ```

  您现在已经为 httpbin 服务创建了一个虚拟服务配置，其中包含两个允许路径 /status 和 /delay 的流量的路由规则。

  gateways 列表指定只允许通过您的 httpbin-gateway 的请求。 所有其他外部请求都将被 404 响应拒绝。

* 查看系统中虚拟服务信息

  ```shell
  # zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [18:32:45] C:130
  $ kubectl get vs 
  NAME           GATEWAYS             HOSTS                   AGE
  ......
  httpbin        [httpbin-gateway]    [httpbin.example.com]   4m4s
  ......
  ```

  可以看到我们已经创建了一个叫 httpbin 的虚拟服务，它对应的网关就是我们刚创建的叫 httpbin-gateway 网关，它绑定的 host 也是我们在网关中配置的 host

* 使用 curl 访问 httpbin 服务

  首先我们访问第一个接口就是 status 接口，这个接口会根据你后面的参数，也就是 response code 来给你打印出相应的信息

  ```shell
  $ curl -s -I -HHost:httpbin.example.com "http://$INGRESS_HOST:$INGRESS_PORT/status/200"
  HTTP/1.1 200 OK
  server: istio-envoy
  date: Sun, 06 Nov 2022 10:50:40 GMT
  content-type: text/html; charset=utf-8
  access-control-allow-origin: *
  access-control-allow-credentials: true
  content-length: 0
  x-envoy-upstream-service-time: 3
  ```

  请注意，因为我们之前设置的 host 字段 “httpbin.example.com” 并不是真实存在的，所以我们需要通过 curl 里面的 -H 入参把这个域名设置进来以模拟它的请求。

  接口再来测试一下第一个 uri 是 delay，delay 这个接口会根据你后面的入参具体延迟多少秒，比如下面的请求会延迟2秒：

  ```shell
  $ curl -s -I -HHost:httpbin.example.com "http://$INGRESS_HOST:$INGRESS_PORT/delay/2"   
  HTTP/1.1 200 OK
  server: istio-envoy
  date: Sun, 06 Nov 2022 10:52:47 GMT
  content-type: application/json
  content-length: 728
  access-control-allow-origin: *
  access-control-allow-credentials: true
  x-envoy-upstream-service-time: 2015
  ```

  访问尚未明确公开的任何其他 URL。 您应该会看到 HTTP 404 错误：

  ```shell
  $ curl -s -I -HHost:httpbin.example.com "http://$INGRESS_HOST:$INGRESS_PORT/headers"
  HTTP/1.1 404 Not Found
  date: Sun, 06 Nov 2022 10:53:23 GMT
  server: istio-envoy
  transfer-encoding: chunked
  ```

  这说明我们可以使用 Ingress 来访问之前部署在网格内的 httpbin 这个服务了。

* 配置分析

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221106185741.png)

## Cleanup

删除Gateway和VirtualService配置，关闭httpbin服务：

```shell
kubectl delete gateway httpbin-gateway
kubectl delete virtualservice httpbin
kubectl delete --ignore-not-found=true -f samples/httpbin/httpbin.yaml
```

## 参考

* https://istio.io/latest/docs/tasks/traffic-management/ingress/ingress-control/