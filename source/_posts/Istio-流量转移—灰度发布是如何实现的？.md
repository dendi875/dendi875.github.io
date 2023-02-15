---
title: Istio 流量转移—灰度发布是如何实现的？
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-10-30 17:21:34
password:
summary: Istio 流量转移—灰度发布是如何实现的？
tags:
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

# Istio 流量转移—灰度发布是如何实现的？

[toc]

## 蓝绿部署

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/blue-green-deployment.png)

所谓蓝绿部署是指在你的生产环境中同时有两套完全一致的应用，基于一套正在服务于线上环境，所有的请求都打到该环境中，当你的应用版本需要更新的时候，你直接在另外一套系统中部署新的版本，然后把流量切换到新的版本中。

蓝绿部署优缺点：

* 优点

  你可以随意地去安装「备份的那一套环境」，而不需要动线上的环境，这样的话即使出错也没影响。同时因为有两套环境的存在，你也可以及时地进行回滚操作。

* 缺点

  因为有两套环境的存在它的成本稍微有点高

## 灰度发布（金丝雀发布）

灰度发布又叫金丝雀发布，为什么会有这样一个名称呢，主要来源于这样一个典故：在17世纪的时候英国矿井工人他们偶然地发现金丝雀这种鸟类对瓦斯气体非常敏感，而大家都知道在矿井这种地下作业的时候瓦斯这种气体经常会出现，大量吸入会对人体有害，所认这些矿井工人在每次进行作业的时候都会带上一只金丝雀鸟，用金丝雀鸟来做一个检测，一旦检测到瓦斯的存在金丝雀轻则不会再鸣叫，重则容易身亡，所以引申出来的概念就是把金丝雀部署这样的一个小范围测试小范围发布的方式，来逐渐地去更新我们的新版本。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221030162140.png)

如上图所示是一个灰度发布的具体流程：首先所有的请求都指向老的版本（左上角部分），新版本部署之后我们可以把小范围的流量比如说只把 5%的流量打向新的版本，用它来进行一个测试（右上角部分），如果测试没有问题我们再把 50%的流量打到新版本（左下角部分），最后测试成功把所有流量都切换到新版本，老的版本就可以抛弃掉（右下角部分）

灰度发布优缺点：

* 优点

  可以利用线上真实的数据进行一个测试，并且也是比较容易地进行回滚的

* 缺点

  需要我们同时管理多个版本，同时还要考虑版本之间的上下兼容的问题

## A/B 测试

A/B 测试它本质上实现方式跟灰度发布是完全一致的，只不过它们俩的侧重面不同，灰度发布最终要求是把所有的流量打向新的版本，实现一个版本的迭代，而A/B测试它主要的目的是用来比较A和B这两个版本的优劣，A/B测试这种方式在很多行业都很常用，比如说游戏行业用A/B测试来测试一些配置数据的效果，比如说修改某一个道具的属性价格等等，然后来测试不同两个版本的道具它们对用户数据产生的影响。![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221030163943.png)

如上图你看到的A/B测试它是用来测试两个不同版本的页面它们对于用户的留存率的，版本A的页面可能用户体验稍微差一点，它留存率测试完之后是 33%，版本B的页面更好看它的留存率就更高，这就是A/B测试。



## 基于权重的路由配置示例

### 任务说明

将请求按比例路由到对应的服务版本

### 任务目标

* 学会设置路由的权重

* 理解灰度发布、蓝绿部署、A/B测试的概念
* 理解与 Kubernetes 基于部署的版本迁移的区别

### 演示

我们利用 Bookinfo 应用中 reviews 服务的多版本来模拟一个灰度发布的过程。

我们查看文件 `samples/bookinfo/networking/virtual-service-reviews-50-v3.yaml` 的定义：

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
      weight: 50
    - destination:
        host: reviews
        subset: v3
      weight: 50
```

这个规则定义了 50% 的对 Reviews 的流量会落入 v1 这个 subset，就是没有 Ratings 的这个服务，50% 会落入 v3 带红色 Ratings 的这个服务，然后我们创建这个资源对象：

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [16:56:25] 
$ kubectl apply -f samples/bookinfo/networking/virtual-service-reviews-50-v3.yaml
virtualservice.networking.istio.io/reviews created
```

查看当前网格中的 VirtualService 对象，可以看到已经有 reviews 了，证明已经创建成功了：

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [16:58:00] 
$  kubectl get virtualservice
NAME           GATEWAYS             HOSTS       AGE
......
reviews                             [reviews]   12s
......
```

我们查看目前我们网格中的 DestinationRules:

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [17:01:55] 
$ kubectl get destinationrule
No resources found in default namespace.
```

还没有 DestinationRules，我们需要通过 DestinationRule 将 VirtualService 与 Service 不同的版本关联起来。现在我们直接创建 DestinationRule 资源：

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [17:04:52] 
$ kubectl apply -f  samples/bookinfo/networking/destination-rule-all.yaml  
destinationrule.networking.istio.io/productpage created
destinationrule.networking.istio.io/reviews created
destinationrule.networking.istio.io/ratings created
destinationrule.networking.istio.io/details created
```

创建完成后，我们就可以查看目前我们网格中的 DestinationRules:

```bash
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [17:05:50] 
$ kubectl get destinationrule
NAME          HOST          AGE
details       details       21s
productpage   productpage   21s
ratings       ratings       21s
reviews       reviews       21s
```

现在我们多次刷新页面，可以发现没有出现 Ratings 的次数与红色星 Ratings 的比例大概在`1:1`左右，并且没有黑色星的 Ratings 的情况出现，说明我们配置的基于权重的 VirtualService 访问规则配置生效了。

## Kubernetes 中的金丝雀部署

例如，假设我们有一个已部署的服务 **helloworld** 版本 **v1**，我们想为其测试（或简单地推出）一个新版本 **v2**。使用 Kubernetes，您可以推出新版本的 **helloworld** 服务，只需更新服务相应 [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) 中的镜像并 [rollout](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#updating-a-deployment) 。如果我们特别注意确保在启动时有足够的 v1 副本在运行，并在仅启动一两个 v2 副本后 [pause](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#pausing-and-resuming-a-deployment)  rollout，我们可以将金丝雀对系统的影响保持在非常小的范围内。然后，我们可以在决定继续进行之前观察效果，或者在必要时  [roll back](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment)。最重要的是，我们甚至可以将 [horizontal pod autoscaler](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#scaling-a-deployment) 附加到 Deployment，如果在 rollout 过程中还需要向上或向下缩放副本以处理流量负载，它将保持副本比率一致。

虽然它的作用很好，但这种方法只有在我们想要部署一个经过适当测试的版本时才有用，即，更多的是蓝/绿，也就是红/黑，一种升级，而不是“将你的脚浸入水”的金丝雀部署。事实上，对于后者（例如，测试一个甚至可能还没有准备好或打算进行更广泛曝光的金丝雀版本），Kubernetes 中的金丝雀部署将使用两个具有公共 pod 标签「[common pod labels](https://kubernetes.io/docs/concepts/cluster-administration/manage-deployment/#using-labels-effectively)」的部署来完成。在这种情况下，我们不能再使用自动缩放，因为它现在由两个独立的自动缩放器完成，每个部署一个，因此副本比率（百分比）可能与所需的比率不同，这完全取决于负载。

无论我们使用一个部署还是两个部署，使用 Docker、或 Kubernetes 等容器编排平台的部署特性进行金丝雀管理都有一个根本问题：使用实例扩展来管理流量；流量版本分发和副本部署在这些系统中并不独立。所有副本 pod，无论版本如何，都在 kube-proxy 循环池中被同等对待，因此管理特定版本接收的流量的唯一方法是控制副本比率。维持少量的金丝雀流量需要很多副本（例如，1% 需要至少 100 个副本）。即使我们忽略这个问题，部署方法仍然非常有限，因为它只支持简单（随机百分比）金丝雀方法。相反，如果我们想根据某些特定标准将金丝雀的可见性限制为请求，我们仍然需要另一种解决方案。

## 参考

* https://istio.io/latest/docs/concepts/traffic-management/
* https://istio.io/latest/docs/tasks/traffic-management/request-routing/
* https://istio.io/v1.14/blog/2017/0.1-canary/

