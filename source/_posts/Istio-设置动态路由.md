---
title: 如何使用 Istio 设置动态路由
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-10-16 19:23:05
password:
summary: 如何使用 Istio 设置动态路由，虚拟服务（Virtual Service） 和 目标规则（Destination Rule）的配置使用
tags:
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

# 如何使用 Istio 设置动态路由

路由这个功能是 Istio 流量控制里面非常重要也是最常用的一个功能，在 Istio 一般通过 `VirtualService-虚拟服务`以及 `DestinationRules-目标规则` 这两个API资源进行动态路由的设置。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220925175600.png)

虚拟服务可以简单理解为它是一个路由规则的集合，它主要是用来定义路由规则，以及描述这些满足我们设置条件的请求去向哪里。

目标规则是配合虚拟服务来使用的，主要用来定义`子集`，`子集`实际上就是具体的目标地址，除此之外还可以定义一些策略，它主要描述的是到达目标的请求如何去处理，所谓的目标就是`子集`，而如何处理就是具体的`策略`。



* 虚拟服务（Virtual Service） 

  * 定义路由规则
  * 描述满足条件的请求去哪里

* 目标规则（Destination Rule） 

  * 定义子集、策略

  * 描述到达目标的请求怎么处理

    

在前面我们成功搭建并部署了 Istio 及其其 Bookinfo 示例应用，参考 [Istio的安装和部署](https://zhangquan.me/2022/09/25/istio-de-an-zhuang-he-bu-shu/)

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221016180413.png)目前搭建 Bookinfo 应用我们只用到了下面两个资源文件：

```bash
samples/bookinfo/platform/kube/bookinfo.yaml
samples/bookinfo/networking/bookinfo-gateway.yaml
```

现在访问应用界面并刷新，会看到 Reviews 有时不会显示评分，有时候会显示不同样式的评分，这是因为后面有3个不同的 Reviews 服务版本，而没有配置该服务的路由规则 `route rule` 的情况下，该服务的几个实例会被随机访问到，有的版本服务会进一步调用 Ratings 服务，有的不会。



下面我们将通过搭建的 Bookinfo 应用来进行实践操作，从而学会动态路由的配置，掌握虚拟服务和目标规则的配置方法。

## 不同服务版本访问规则

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221016175808.png)

如上图所示就是我们要实践到达的目标，把请求指向 Reviews 的 v1 版本。

对 Reviews 服务添加一条路由规则，启用 `samples/bookinfo/networking/virtual-service-all-v1.yaml` 定义的 VirtualService 规则，内容如下：

```yaml
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
        subset: v1
```

这样，所有访问 reviews 服务的流量就会被引导到 reviews 服务对应的 subset 为 v1 的 Pod 中。启用这条规则：

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [18:07:42] 
$ kubectl apply -f  samples/bookinfo/networking/virtual-service-all-v1.yaml  
virtualservice.networking.istio.io/productpage created
virtualservice.networking.istio.io/reviews created
virtualservice.networking.istio.io/ratings created
virtualservice.networking.istio.io/details created
```

然后查看所有的路由规则：

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [18:09:30] 
$ kubectl get virtualservices
NAME          GATEWAYS             HOSTS           AGE
bookinfo      [bookinfo-gateway]   [*]             54m
details                            [details]       41s
productpage                        [productpage]   41s
ratings                            [ratings]       41s
reviews                            [reviews]       41s
```

我们可以看到 reviews 的 `VirtualService` 已经创建成功了，此时我们去刷新应用的页面，发现访问 Reviews 失败了：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221016181114.png)

这是因为我们还没有创建 DestinationRule 对象，通常情况下DestinationRule是和VirtualService配合使用的， DestinationRule 对象是 VirtualService 路由生效后，配置应用与请求的策略集，用来将 VirtualService 中指定的 subset 与对应的 Pod 关联起来。

我们继续定义一下目标规则，在 `samples/bookinfo/networking/destination-rule-all.yaml` 文件中有定义所有该应用中要用到的所有 DestinationRule 资源对象，其中有一段就是对 Reviews 相关的 DestinationRule 的定义:

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  - name: v3
    labels:
      version: v3
```

我们可以看到 DestinationRule 中定义了 `subsets` 集合，其中 labels 就和我们之前 Service 的 `labelselector` 一样是去匹配 Pod 的 labels 标签的，比如我们这里 subsets 中就包含一个名为 v1 的 subset，而这个 subset 匹配的就是具有 `version=v1` 这个 label 标签的 Pod 集合，再回到之前的 `samples/bookinfo/platform/kube/bookinfo.yaml` 文件中，我们可以发现 reviews 的 Deployment 确实有声明不同的 `labels->version`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reviews-v1
  labels:
    app: reviews
    version: v1
spec:
  replicas: 1
  selector:
    matchLabels:
      app: reviews
      version: v1
  template:
    metadata:
      labels:
        app: reviews
        version: v1
    spec:
      serviceAccountName: bookinfo-reviews
      containers:
      - name: reviews
        image: docker.io/istio/examples-bookinfo-reviews-v1:1.15.0
        imagePullPolicy: IfNotPresent
        env:
        - name: LOG_DIR
          value: "/tmp/logs"
        ports:
        - containerPort: 9080
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: wlp-output
          mountPath: /opt/ibm/wlp/output
      volumes:
      - name: wlp-output
        emptyDir: {}
      - name: tmp
        emptyDir: {}
```

这样我们就通过 DestinationRule 将 VirtualService 与 Service 不同的版本关联起来了。现在我们直接创建 DestinationRule 资源：

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [18:18:37] 
$ kubectl apply -f  samples/bookinfo/networking/destination-rule-all.yaml  
destinationrule.networking.istio.io/productpage created
destinationrule.networking.istio.io/reviews created
destinationrule.networking.istio.io/ratings created
destinationrule.networking.istio.io/details created
```

创建完成后，我们就可以查看目前我们网格中的 DestinationRules:

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [18:19:15] 
$ kubectl get destinationrule
NAME          HOST          AGE
details       details       27s
productpage   productpage   27s
ratings       ratings       27s
reviews       reviews       27s
```

此时再访问应用就成功了，多次刷新页面发现 Reviews 都展示的是 v1 版本无星的 Ratings，说明我们VirtualService 的配置成功了。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221016182034.png)

### 配置是如何生效的？

我们来分析下上面的配置是如何生效的，我们先来看看上面使用到的两个API资源  samples/bookinfo/networking/destination-rule-all.yaml 和 samples/bookinfo/networking/destination-rule-all.yaml  它们的一些具体配置项：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221016182504.png)

如上图所示，我们可以看到 VirtualService 提供了 6 个字段，主要的是 http 字段，它会对应到后面的一个 HTTPRoute 对象（即我们具体的匹配规则），HTTPRoute 对象中有两个重要字段 match 和 route，math 字段描述了满足了什么样条件的请求是可以被接受的，它对应的对象是 HTTPMatchRequest对象，通过 HTTPMatchRequest 对象我们可以看到在 Istio 里提供丰富的匹配规则供我们使用，可以根据 uri，scheme，method，headers，port 等一些规则进行匹配，而匹配到的请求一般是通过 HTTPRoute 对象中的 route 字段搭配在一起使用，也就是满足了什么样的请求会被 route，而 HTTPRouteDestination 对象中最重要的字段是 destination ，在 DestinationRule 中 host 就是具体的最终路由到的目标地址，subsets 一般主要是给服务限定版本的，比如你定义v1，v2两个子集版本。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221016184059.png)

## 基于权重的服务访问规则

刚刚我们演示的基于不同服务版本的服务网格的控制，接下来我们来演示下基于权重的服务访问规则的使用。

首先移除刚刚创建的 VirtualService 对象，排除对环境的影响：

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [19:08:17] 
$ kubectl delete virtualservice reviews
virtualservice.networking.istio.io "reviews" deleted

# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [19:08:23] 
$ kubectl get virtualservice           
NAME          GATEWAYS             HOSTS           AGE
bookinfo      [bookinfo-gateway]   [*]             113m
details                            [details]       59m
productpage                        [productpage]   59m
ratings                            [ratings]       59m
```

现在我们再去访问 Bookinfo 应用又回到最初随机访问 Reviews 的情况了。现在我们查看文件 `samples/bookinfo/networking/virtual-service-reviews-80-20.yaml` 的定义：

```yaml
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
        subset: v1
      weight: 80
    - destination:
        host: reviews
        subset: v2
      weight: 20
```

这个规则定义了 80% 的对 Reviews 的流量会落入 v1 这个 subset，就是没有 Ratings 的这个服务，20% 会落入 v2 带黑色 Ratings 的这个服务，然后我们创建这个资源对象：

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [19:09:53] 
$ kubectl apply -f samples/bookinfo/networking/virtual-service-reviews-80-20.yaml
virtualservice.networking.istio.io/reviews created

# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [19:09:58] 
$ kubectl get virtualservice
NAME          GATEWAYS             HOSTS           AGE
bookinfo      [bookinfo-gateway]   [*]             115m
details                            [details]       61m
productpage                        [productpage]   61m
ratings                            [ratings]       61m
reviews                            [reviews]       5s
```

我们查看当前网格中的 VirtualService 对象，可以看到已经有 reviews 了，证明已经创建成功了，由于上面我们已经将应用中所有的 DestinationRules 都已经创建过了，所以现在我们直接访问应用就可以了，我们多次刷新，可以发现没有出现 Ratings 的次数与出现黑色星 Ratings 的比例大概在`4:1`左右，并且没有红色星的 Ratings 的情况出现，说明我们配置的基于权重的 VirtualService 访问规则配置生效了。



## 基于请求内容的服务访问规则

除了上面基于服务版本和服务权重的方式控制服务访问之外，我们还可以基于请求内容来进行访问控制。

同样，将上面创建的 VirtualService 对象删除：

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [19:10:58] C:1
$  kubectl delete virtualservice reviews
virtualservice.networking.istio.io "reviews" deleted

# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [19:11:02] 
$ kubectl get virtualservice
NAME          GATEWAYS             HOSTS           AGE
bookinfo      [bookinfo-gateway]   [*]             116m
details                            [details]       62m
productpage                        [productpage]   62m
ratings                            [ratings]       62m
```

查看文件 `samples/bookinfo/networking/virtual-service-reviews-jason-v2-v3.yaml` 的定义：

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
  - reviews
  http:
  - match:
    - headers:
        end-user:
          exact: jason
    route:
    - destination:
        host: reviews
        subset: v2
  - route:
    - destination:
        host: reviews
        subset: v3
```

这个 VirtualService 对象定义了对 reviews 服务访问的 `match` 规则。意思是如果当前请求的 header 中包含 jason 这个用户信息，则只会访问到 v2 的 reviews 这个服务版本，即都带黑星的样式，如果不包含该用户信息，则都直接将流量转发给 v3 这个 reviews 的服务。

我们先不启用这个 VirtualService，先去访问下 Bookinfo 这个应用：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221016191239.png)

右上角有登录按钮，在没有登录的情况下刷新页面，reviews 服务是被随机访问的，可以看到有带星不带星的样式，点击登录，在弹窗中 User Name 输入 jason，Password 为空，登录：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221016191412.png)

再刷新页面，可以看到跟未登录前的访问规则一样，也是随机的。

现在我们来创建上面的 VirtualService 这个对象:

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [19:11:25] 
$ kubectl apply -f samples/bookinfo/networking/virtual-service-reviews-jason-v2-v3.yaml
virtualservice.networking.istio.io/reviews created

# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [19:14:42] 
$  kubectl get virtualservice
NAME          GATEWAYS             HOSTS           AGE
bookinfo      [bookinfo-gateway]   [*]             120m
details                            [details]       65m
productpage                        [productpage]   65m
ratings                            [ratings]       65m
reviews                            [reviews]       10s
```

此时再回去刷新页面，发现一直都是黑星的 Reviews 版本(v2)被访问到了。注销退出后再访问，此时又一直是红星的版本(v3)被访问了。

说明我们基于 `headers->end-user->exact:jason` 的控制规则生效了。在 productpage 服务调用 reviews 服务时，登录的情况下会在 header 中带上用户信息，通过 `exact` 规则匹配到相关信息后，流量被引向了上面配置的 v2 版本中。

这里要说明一下 match 的匹配规则：

```bash
All conditions inside a single match block have AND semantics, while the list of match blocks have OR semantics. The rule is matched if any one of the match blocks succeed.
```

意思是一个 `match` 块里的条件是需要同时满足才算匹配成功的，如下面是 url 前缀和端口都必须都满足才算成功：

```yaml
- match:
    - uri:
        prefix: "/wpcatalog"
      port: 443
```

多个 match 块之间是只要有一个 match 匹配成功了，就会被路由到它指定的服务版本去，而忽略其他的。我们的示例中在登录的条件下，满足第一个 match，所以服务一直会访问到 v2 版本。退出登录后，没有 match 规则满足匹配，所以就走最后一个 route 规则，即 v3 版本。

到这里，我们就和大家一起学习了基于不同服务版本、权重以及请求内容来控制服务流量的配置。

## Virtual Service 和 Destination Rule 的应用场景

* 按服务版本路由
* 按比例切分流量，比如灰度发布
* 根据匹配规则进行路由
* 定义各种策略（负载均衡、连接池等）



## 参考

* https://istio.io/latest/docs/concepts/traffic-management/
* https://istio.io/latest/docs/tasks/traffic-management/request-routing/
