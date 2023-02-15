---
title: Istio 超时重试—提升系统的健壮性和可用性
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-11-20 18:19:38
password:
summary: Istio 超时重试—提升系统的健壮性和可用性
tags:
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

## 为什么需要超时和重试？

对一个分布式系统来说出现网络故障是在所难免的，因此如何提升系统的弹性，也就是提升系统在面对故障时它的处理能力是非常重要的，我们先了解一下提升系统弹性的两个功能：超时和重试。

### 超时

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221120170034.png)

* 概念：是一种最常见的容错模式。常见的有设置网络连接超时时间，一次RPC的响应超时时间等。在分布式服务调用的场景中，它主要解决了当依赖服务出现建立网络连接或响应延迟，不用无限等待的问题，调用方可以根据事先设计的超时时间中断调用，及时释放关键资源，如Web容器的连接数，数据库连接数等，避免整个系统资源耗尽出现拒绝对外提供服务这种情况。

* 目的：控制故障范围，避免故障扩散。

### 重试

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/istio-retry.png)

* 概念：一般和超时模式结合使用，适用于对于下游服务的数据强依赖的场景（不强依赖的场景不建议使用！），通过重试来保证数据的可靠性或一致性，常用于因网络抖动等导致服务调用出现超时的场景。与超时时间设置结合使用后，需要考虑接口的响应时间分布情况，超时时间可以设置为依赖服务接口99.5%响应时间的值，重试次数一般1-2次为宜，否则会导致请求响应时间延长，拖累到整个系统。

* 目的：解决网络抖动时通信失败的问题。

## Istio 中的超时和重试功能

在 Istio 中原生就支持超时和重试功能，我们下面就演示一下如何在网格中添加一个超时和重试策略，学会如何在 VirtualService 中添加超时和重试的配置项。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221120172335.png)

如上图所示，我们还是通过 [Bookinfo](https://istio.io/latest/docs/examples/bookinfo/) 应用来测试超时和重试功能，首先我们会把请求打向 Reviews 服务的 v2 版本，然后在 Rattings 服务中添加一个延迟来模拟一个故障出现的情况，最后再来验证一下我们设置的超时重试策略是否生效。

### 演示

#### 超时演示

1. 将请求路由到 `reviews` 服务的 v2 版本，它会发起对 `ratings` 服务的调用

   我们首先把 BookInfo 应用指向`reviews` 服务的 v2 版本，因为只有 v2和v3 两个版本会发起对 `ratings` 服务的调用：

   ```bash
   kubectl apply -f - <<EOF
   apiVersion: networking.istio.io/v1alpha3
   kind: VirtualService
   metadata:
     name: reviews
   spec:
     hosts:
       - reviews
     http:
     - route:
       - destination:
           host: reviews
           subset: v2
   EOF
   ```

   查看虚拟服务：

   ```bash
   $  kubectl get virtualservices
   NAME       GATEWAYS             HOSTS       AGE
   bookinfo   [bookinfo-gateway]   [*]         69m
   reviews                         [reviews]   5m59s
   ```

   运行以下命令为 Bookinfo 服务创建默认目标规则：

   ```bash
   kubectl apply -f  samples/bookinfo/networking/destination-rule-all.yaml  
   ```

   查看目标规则：

   ```bash
   $ kubectl get destinationrule
   NAME          HOST          AGE
   details       details       8m28s
   productpage   productpage   8m28s
   ratings       ratings       8m28s		
   reviews       reviews       8m28s
   ```

   我们在浏览器多次刷新查看，请求已经被打向了带有黑色星标的 v2 版本：

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221120174834.png)

2. 给对 `ratings` 服务的调用添加 2 秒的延迟：

   ```bash
   kubectl apply -f - <<EOF
   apiVersion: networking.istio.io/v1alpha3
   kind: VirtualService
   metadata:
     name: ratings
   spec:
     hosts:
     - ratings
     http:
     - fault:
         delay:
           percent: 100
           fixedDelay: 2s
       route:
       - destination:
           host: ratings
           subset: v1
   EOF
   ```

   这时我们刷新页面，通过页面的响应时长应该可以感觉到差不多有2秒的延迟 ratings 服务才返回。

3. 现在给对 `reviews` 服务的调用增加一个1秒的请求超时：

   ```bash
   kubectl apply -f - <<EOF
   apiVersion: networking.istio.io/v1alpha3
   kind: VirtualService
   metadata:
     name: reviews
   spec:
     hosts:
     - reviews
     http:
     - route:
       - destination:
           host: reviews
           subset: v2
       timeout: 1s
   EOF
   ```

   这时我们再刷新 Bookinfo 页面，这个时间页面应该会快速失败，因为我们只给 reviews 服务设置了一个 1 秒的超时，实际时它的延时是2秒。

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221120175945.png)

#### 重试演示

在演示重试之前，我们要把刚才的 timeout 设置取消掉，所以我们重新地执行一个 Reviews 的虚拟服务配置项：

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v2
EOF
```

接着就是最重要的一步，我们给 Ratings 服务的 VirtualService 配置一个 5秒的延迟并且配置一个重试选项：

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
  - ratings
  http:
  - fault:
      delay:
        percent: 100
        fixedDelay: 5s
    route:
    - destination:
        host: ratings
        subset: v1
    retries:
      attempts: 2 # 重试次数
      perTryTimeout: 1s # 每次重试超时时间
EOF
```

最后我们来验证一下配置是否成功，我们打开 Ratings 服务的 Sidecar log 来看看是不是有两次的重试。

首先获取 ratings  pod：

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [18:08:10] C:127
$ kubectl get pod 
NAME                              READY   STATUS    RESTARTS   AGE
......
ratings-v1-6c9dbf6b45-6dpbg       2/2     Running   0          95m
......
```

打印 Ratings 服务的log：

```bash
$ kubectl logs -f ratings-v1-6c9dbf6b45-6dpbg -c istio-proxy
......
```

这时我们再刷新 Bookinfo 页面，观察 Ratings 服务的 Envoy 的 log 中已经把两次请求全都打印出来了：

```bash
$ kubectl logs -f ratings-v1-6c9dbf6b45-6dpbg -c istio-proxy
......
[2022-11-20T10:14:19.232Z] "GET /ratings/0 HTTP/1.1" 200 - "-" "-" 0 48 1 0 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.80 Safari/537.36" "e1ee923b-ded2-9586-91d4-4a83af4728c2" "ratings:9080" "127.0.0.1:9080" inbound|9080|http|ratings.default.svc.cluster.local 127.0.0.1:33822 172.17.0.12:9080 172.17.0.14:35782 outbound_.9080_.v1_.ratings.default.svc.cluster.local default
[2022-11-20T10:14:22.240Z] "GET /ratings/0 HTTP/1.1" 200 - "-" "-" 0 48 1 0 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.80 Safari/537.36" "e1ee923b-ded2-9586-91d4-4a83af4728c2" "ratings:9080" "127.0.0.1:9080" inbound|9080|http|ratings.default.svc.cluster.local 127.0.0.1:33822 172.17.0.12:9080 172.17.0.14:36372 outbound_.9080_.v1_.ratings.default.svc.cluster.local default
```

## 参考

* https://istio.io/latest/docs/concepts/traffic-management/#network-resilience-and-testing
* https://istio.io/latest/docs/tasks/traffic-management/request-timeouts/

* https://tech.meituan.com/2016/11/11/service-fault-tolerant-pattern.html