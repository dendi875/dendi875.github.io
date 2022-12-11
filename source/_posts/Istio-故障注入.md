---
title: Istio 故障注入
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-12-11 17:53:46
password:
summary: Istio 故障注入
tags: 
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

## 引言

采用微服务通常意味着更多的依赖关系，以及更多您可能无法控制的服务。 它还意味着网络上有更多请求，增加了出错的可能性。 由于这些原因，在上游依赖项失败时测试服务的行为非常重要。

[混沌测试](https://en.wikipedia.org/wiki/Chaos_engineering)是故意破坏您的服务以暴露弱点和提高容错能力。 混沌测试可以揭示客户端错误，或识别用户面对的失败情况，在这种情况下，您可能希望显示缓存结果，而不是返回错误。

在 Kubernetes 环境中，您可以在不同层进行混沌测试——例如，[随机删除 pod](https://github.com/asobti/kube-monkey#kube-monkey--)，或关闭整个节点。

但是故障也会发生在应用层。 无限循环、损坏的客户端库 - 应用程序代码可能以无数种方式失败！ 这就是 Istio 故障注入的用武之地。您可以使用 Istio VirtualServices 在应用程序层进行混沌测试，方法是通过在服务中注入超时或 HTTP 错误，而不必实际更新应用程序代码。

## Istio 中的故障注入

使用 Istio，可以在应用层注入故障来测试服务的弹性。 您可以将故障配置为注入到与特定条件匹配的请求中，以模拟服务失败和服务之间更高的延迟。 故障注入是 Istio 路由配置的一部分，可以在 `VirtualService` Istio 自定义资源的 HTTP 路由下的 `fault` 字段中设置。 故障包括中止来自下游服务的 HTTP 请求，或延迟请求代理。 故障规则必须具有延迟或中止（或两者）。

**延迟**：可以在转发之前延迟请求，模拟各种故障，例如网络问题、上游服务过载等。

**中止**：可以中止 HTTP 请求尝试并将错误代码返回给下游服务，给人一种上游服务出现故障的印象。

### 演示

现在，了解了基础知识后，让我们演示下在 Istio 中如何制造故障。

#### 开始之前

- 按照[安装指南](https://istio.io/latest/zh/docs/setup/)中的说明设置 Istio 。

- 部署示例应用程序 [Bookinfo](https://istio.io/latest/zh/docs/examples/bookinfo/)，并应用 [默认目标规则](https://istio.io/latest/zh/docs/examples/bookinfo/#apply-default-destination-rules)。

- 通过执行[配置请求路由](https://istio.io/latest/zh/docs/tasks/traffic-management/request-routing/)任务或运行以下命令来初始化应用程序版本路由：

  ```shell
  # 把所有的路由都路由到各个服务的 v1 版本
  $ kubectl apply -f samples/bookinfo/networking/virtual-service-all-v1.yaml
  # 把 Reviews 服务给它指向 v2 版本，因为只有 v2和v3 这两个版本才会调用 Ratings 服务
  $ kubectl apply -f samples/bookinfo/networking/virtual-service-reviews-test-v2.yaml
  ```

  * 查看虚拟服务：

    ```shell
    $ kubectl get virtualservices
    NAME          GATEWAYS             HOSTS           AGE
    bookinfo      [bookinfo-gateway]   [*]             4d23h
    details                            [details]       4m49s
    productpage                        [productpage]   4m49s
    ratings                            [ratings]       4m49s
    reviews                            [reviews]       4m49s
    ```

  * 运行以下命令为 Bookinfo 服务创建默认目标规则：

    ```shell
    $ kubectl apply -f  samples/bookinfo/networking/destination-rule-all.yaml  
    ```

  * 查看目标规则：

    ```shell
    $  kubectl get destinationrule
    NAME          HOST          AGE
    details       details       11s
    productpage   productpage   11s
    ratings       ratings       11s
    reviews       reviews       11s
    ```

- 经过上面的配置，下面是请求的流程：

  - `productpage` → `reviews:v2` → `ratings` (针对登录的`jason` 用户)

  - `productpage` → `reviews:v1` (其他没有登录的用户)

    


打开浏览器验证，在没有登录情况下再怎么刷新浏览器都是显示 reviews v1 版本：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221211172900.png)

在使用（jason/123456）登录情况下再怎么刷新浏览器都是显示 reviews v2 版本：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221211173217.png)

#### 注入 HTTP 延迟故障

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221211172032.png)

为了测试微服务应用程序 Bookinfo 的弹性，我们将为用户 `jason` 在 `reviews:v2` 和 `ratings` 服务之间注入一个 7 秒的延迟。 这个测试将会发现一个故意引入 Bookinfo 应用程序中的 bug。

注意 `reviews:v2` 服务对 `ratings` 服务的调用具有 10 秒的硬编码连接超时。 因此，尽管引入了 7 秒的延迟，我们仍然期望端到端的流程是没有任何错误的。

1. 创建故障注入规则以延迟来自测试用户 `jason` 的流量：

   ```shell
   $ kubectl apply -f samples/bookinfo/networking/virtual-service-ratings-test-delay.yaml
   virtualservice.networking.istio.io/ratings configured
   ```

2. 确认规则已经创建：

   ```shell
   $ kubectl get virtualservice ratings -o yaml
   apiVersion: networking.istio.io/v1beta1
   kind: VirtualService
   ......
   spec:
     hosts:
     - ratings
     http:
     - fault:
         delay:
           fixedDelay: 7s
           percentage:
             value: 100
       match:
       - headers:
           end-user:
             exact: jason
       route:
       - destination:
           host: ratings
           subset: v1
     - route:
       - destination:
           host: ratings
           subset: v1
   ```

​		新的规则可能需要几秒钟才能传播到所有的 pod 。

#### 测试延迟配置

1. 通过浏览器打开 [Bookinfo](https://istio.io/latest/zh/docs/examples/bookinfo) 应用。

2. 以用户 `jason` 登录到 `/productpage` 页面。

   您期望 Bookinfo 主页在大约 7 秒钟加载完成并且没有错误。 但是，出现了一个问题：Reviews 部分显示了错误消息：

   ```plain
   Sorry, product reviews are currently unavailable for this book.
   ```

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221211173910.png)

3. 查看页面的响应时间：

   1. 打开浏览器的 *开发工具* 菜单

   2. 打开 *网络* 标签

   3. 重新加载 `productpage` 页面。您会看到页面加载实际上用了大约 6 秒。

      ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221211174122.png)

#### 理解原理

您发现了一个 bug。微服务中有硬编码超时，导致 `reviews` 服务失败。

按照预期，我们引入的 7 秒延迟不会影响到 `reviews` 服务，因为 `reviews` 和 `ratings` 服务间的超时被硬编码为 10 秒。 但是，在 `productpage` 和 `reviews` 服务之间也有一个 3 秒的硬编码的超时，再加 1 次重试，一共 6 秒。 结果，`productpage` 对 `reviews` 的调用在 6 秒后提前超时并抛出错误了。

这种类型的错误可能发生在典型的由不同的团队独立开发不同的微服务的企业应用程序中。 Istio 的故障注入规则可以帮助您识别此类异常，而不会影响最终用户。

请注意，此次故障注入限制为仅影响用户 `jason`。如果您以任何其他用户身份登录，则不会遇到任何延迟。

#### 错误修复

这种问题通常会这么解决：

1. 增加 `productpage` 与 `reviews` 服务之间的超时或降低 `reviews` 与 `ratings` 的超时
2. 终止并重启修复后的微服务
3. 确认 `/productpage` 页面正常响应且没有任何错误

但是，`reviews` 服务的 v3 版本已经修复了这个问题。 `reviews:v3` 服务已将 `reviews` 与 `ratings` 的超时时间从 10 秒降低为 2.5 秒，因此它可以兼容（小于）下游 `productpage` 请求的超时时间。

如果您按照[流量转移](https://istio.io/latest/zh/docs/tasks/traffic-management/traffic-shifting/)任务所述将所有流量转移到 `reviews:v3`， 您可以尝试修改延迟规则为任何低于 2.5 秒的数值，例如 2 秒，然后确认端到端的流程没有任何错误。

#### 注入 HTTP abort 故障

测试微服务弹性的另一种方法是引入 HTTP abort 故障。 在这个任务中，针对测试用户 `jason` ，将给 `ratings` 微服务引入一个 HTTP abort。

在这种情况下，我们希望页面能够立即加载，同时显示 `Ratings service is currently unavailable` 这样的消息。

1. 为用户 `jason` 创建一个发送 HTTP abort 的故障注入规则：

   ```shell
   $ kubectl apply -f samples/bookinfo/networking/virtual-service-ratings-test-abort.yaml
   virtualservice.networking.istio.io/ratings configured
   ```

2. 确认规则已经创建：

   ```shell
   $ kubectl get virtualservice ratings -o yaml
   apiVersion: networking.istio.io/v1beta1
   kind: VirtualService
   ......
   spec:
     hosts:
     - ratings
     http:
     - fault:
         abort:
           httpStatus: 500
           percentage:
             value: 100
       match:
       - headers:
           end-user:
             exact: jason
       route:
       - destination:
           host: ratings
           subset: v1
     - route:
       - destination:
           host: ratings
           subset: v1
   ```

#### 测试中止配置

1. 用浏览器打开 [Bookinfo](https://istio.io/latest/zh/docs/examples/bookinfo) 应用。

2. 以用户 `jason` 登录到 `/productpage` 页面。

   如果规则成功传播到所有的 pod，您应该能立即看到页面加载并看到 `Ratings service is currently unavailable` 消息。

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221211175035.png)

3. 如果您注销用户 `jason` 或在匿名窗口（或其他浏览器）中打开 Bookinfo 应用程序， 您将看到 `/productpage` 为除 `jason` 以外的其他用户调用了 `reviews:v1`（完全不调用 `ratings`）。 因此，您不会看到任何错误消息。

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221211175128.png)

## 清理

1. 删除应用程序路由规则：

   ```
   $ kubectl delete -f samples/bookinfo/networking/virtual-service-all-v1.yaml
   ```

2. 如果您不打算探索任何后续任务，请参阅 [Bookinfo 清理](https://istio.io/latest/zh/docs/examples/bookinfo/#cleanup)说明以关闭应用程序。

## 参考
* https://istio.io/latest/zh/docs/concepts/traffic-management/#fault-injection
* https://istio.io/latest/zh/docs/tasks/traffic-management/fault-injection/
* https://medium.com/google-cloud/gremlin-chaos-engineering-on-google-cloud-2568f9fc70c9