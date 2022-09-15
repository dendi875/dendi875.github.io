---
title: Prometheus Operator 的安装
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-09-09 17:23:11
password:
summary: Prometheus Operator 的安装
tags: 
	- Kubernetes
	- Prometheus
	- Operator
categories: Kubernetes
---

# Prometheus Operator 的安装

传统的Prometheus监控Kubernetes集群，有所缺陷，比如Prometheus、Alertmanager等组件的高可用，虽然可以通过自定义的方式实现，但是不够灵活。那么Prometheus Operator是一种更高级，更云原生的Kubernetes集群监控方式。其项目地址为：https://github.com/prometheus-operator/kube-prometheus



## Operator

### 什么是 Operator？

Operator = Controller + CRD。假如你不了解什么是 Controller 和 CRD，可以看一个 Kubernetes 本身的例子：我们提交一个 Deployment 对象来声明期望状态，比如 3 个副本；而 Kubernetes 的 Controller 会不断地干活（跑控制循环）来达成期望状态，比如看到只有 2 个副本就创建一个，看到有 4 个副本了就删除一个。在这里，Deployment 是 Kubernetes 本身的 API 对象。那假如我们想自己设计一些 API 对象来完成需求呢？Kubernetes 本身提供了 CRD(Custom Resource Definition)，允许我们定义新的 API 对象。但在定义完之后，Kubernetes 本身当然不可能知道这些 API 对象的期望状态该如何到达。这时，我们就要写对应的 Controller 去实现这个逻辑。而这种自定义 API 对象 + 自己写 Controller 去解决问题的模式，就是 Operator Pattern。

## 介绍

首先我们先来了解下`Prometheus-Operator`的架构图：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220909134822.png)

上图是 Prometheus-Operator 官方提供的架构图，各组件以不同的方式运行在 Kubernetes 集群中，其中 Operator 是最核心的部分，作为一个控制器，他会去创建Prometheus、ServiceMonitor、AlertManager 以及 PrometheusRule 4个 CRD 资源对象，然后会一直监控并维持这4个资源对象的状态。

- `Operator`：根据自定义资源来部署和管理 Prometheus Server，同时监控这些自定义资源事件的变化来做相应的处理，是整个系统的控制中心。
- `Prometheus`：声明 Prometheus 资源对象期望的状态，Operator 确保这个资源对象运行时一直与定义保持一致。
- `Prometheus Server`：Operator 根据自定义资源 Prometheus 类型中定义的内容而部署的 Prometheus Server 集群，这些自定义资源可以看作是用来管理 Prometheus Server 集群的 StatefulSets 资源。
- `ServiceMonitor`：声明指定监控的服务，描述了一组被 Prometheus 监控的目标列表，就是 exporter 的抽象，用来提供 metrics 数据接口的工具。该资源通过 Labels 来选取对应的 Service Endpoint，让 Prometheus Server 通过选取的 Service 来获取 Metrics 信息。
- `Service`：简单的说就是 Prometheus 监控的对象。
- `Alertmanager`：定义 AlertManager 资源对象期望的状态，Operator 确保这个资源对象运行时一直与定义保持一致。

这样我们要在集群中监控什么数据，就变成了直接去操作 Kubernetes 集群的资源对象了，是不是方便很多了。上图中的 Service 和 ServiceMonitor 都是 Kubernetes 的资源，一个 ServiceMonitor 可以通过 labelSelector 的方式去匹配一类 Service，Prometheus 也可以通过 labelSelector 去匹配多个ServiceMonitor。

## 安装

> 注意集群版本，自己先到Github上下载对应的版本。

我们可以使用 Helm 来快速安装 Prometheus Operator，也可以通过 [https://github.com/coreos/kube-prometheus](https://github.com/coreos/kube-prometheus/blob/master/manifests/prometheus-service.yaml) 项目来手动安装，我们这里采用手动安装的方式可以去了解更多的实现细节。

首先 clone 项目代码：

```shell
$ git clone https://github.com/coreos/kube-prometheus.git
$ cd manifests
```

进入到 `manifests` 目录下面，首先我们需要安装 `setup` 目录下面的 CRD 和 Operator 资源对象：

```shell
[root@k8s-master manifests]# kubectl apply -f setup/
namespace/monitoring unchanged
customresourcedefinition.apiextensions.k8s.io/alertmanagerconfigs.monitoring.coreos.com configured
customresourcedefinition.apiextensions.k8s.io/alertmanagers.monitoring.coreos.com configured
customresourcedefinition.apiextensions.k8s.io/podmonitors.monitoring.coreos.com configured
customresourcedefinition.apiextensions.k8s.io/probes.monitoring.coreos.com configured
customresourcedefinition.apiextensions.k8s.io/prometheuses.monitoring.coreos.com created
customresourcedefinition.apiextensions.k8s.io/prometheusrules.monitoring.coreos.com configured
customresourcedefinition.apiextensions.k8s.io/servicemonitors.monitoring.coreos.com configured
customresourcedefinition.apiextensions.k8s.io/thanosrulers.monitoring.coreos.com configured
clusterrole.rbac.authorization.k8s.io/prometheus-operator created
clusterrolebinding.rbac.authorization.k8s.io/prometheus-operator created
deployment.apps/prometheus-operator created
service/prometheus-operator created
serviceaccount/prometheus-operator created

[root@k8s-master manifests]# kubectl get pods -n monitoring
NAME                                   READY   STATUS    RESTARTS   AGE
prometheus-operator-7775c66ccf-wqkgw   2/2     Running   0          80s

[root@k8s-master manifests]# kubectl get crd  | grep coreos
alertmanagerconfigs.monitoring.coreos.com             2022-09-09T05:57:30Z
alertmanagers.monitoring.coreos.com                   2022-09-09T05:57:30Z
podmonitors.monitoring.coreos.com                     2022-09-09T05:57:31Z
probes.monitoring.coreos.com                          2022-09-09T05:57:31Z
prometheuses.monitoring.coreos.com                    2022-09-09T06:07:45Z
prometheusrules.monitoring.coreos.com                 2022-09-09T05:57:31Z
servicemonitors.monitoring.coreos.com                 2022-09-09T05:57:31Z
thanosrulers.monitoring.coreos.com                    2022-09-09T05:57:31Z
```

这会创建一个名为 `monitoring` 的命名空间，以及相关的 CRD 资源对象声明和 Prometheus Operator 控制器。当我们声明完 CRD 过后，就可以来自定义资源清单了，但是要让我们声明的自定义资源对象生效就需要安装对应的 Operator 控制器，这里我们都已经安装了，所以接下来就可以来用 CRD 创建真正的自定义资源对象了。其实在 `manifests` 目录下面的就是我们要去创建的 Prometheus、Alertmanager 以及各种监控对象的资源清单。

没有特殊的定制需求我们可以直接一键安装：

```shell
[root@k8s-master manifests]# kubectl apply -f .
```

这会自动安装 node-exporter、kube-state-metrics、grafana、prometheus-adapter 以及 prometheus 和 alertmanager 组件，而且 prometheus 和 alertmanager 还是多副本的。

```shell
[root@k8s-master manifests]#  kubectl get pods -n monitoring
NAME                                   READY   STATUS    RESTARTS   AGE
alertmanager-main-0                    2/2     Running   0          5m55s
alertmanager-main-1                    2/2     Running   0          5m55s
alertmanager-main-2                    2/2     Running   0          5m55s
blackbox-exporter-55c457d5fb-l29mr     3/3     Running   0          5m55s
grafana-9df57cdc4-gx8bg                1/1     Running   0          5m55s
kube-state-metrics-76f6cb7996-vrtgm    3/3     Running   0          5m55s
node-exporter-bd9cg                    0/2     Pending   0          5m56s
node-exporter-dxzth                    0/2     Pending   0          5m56s
node-exporter-sftnm                    0/2     Pending   0          5m56s
prometheus-adapter-59df95d9f5-222st    1/1     Running   0          5m55s
prometheus-adapter-59df95d9f5-mhmr8    1/1     Running   0          5m55s
prometheus-k8s-0                       2/2     Running   1          5m55s
prometheus-k8s-1                       2/2     Running   1          5m55s
prometheus-operator-7775c66ccf-wqkgw   2/2     Running   0          10m


[root@k8s-master manifests]# kubectl get svc -n monitoring
NAME                    TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)                      AGE
alertmanager-main       ClusterIP   10.96.246.4     <none>        9093/TCP                     6m20s
alertmanager-operated   ClusterIP   None            <none>        9093/TCP,9094/TCP,9094/UDP   6m20s
blackbox-exporter       ClusterIP   10.96.158.138   <none>        9115/TCP,19115/TCP           6m19s
grafana                 ClusterIP   10.96.241.17    <none>        3000/TCP                     6m19s
kube-state-metrics      ClusterIP   None            <none>        8443/TCP,9443/TCP            6m19s
node-exporter           ClusterIP   None            <none>        9100/TCP                     6m19s
prometheus-adapter      ClusterIP   10.96.198.116   <none>        443/TCP                      6m18s
prometheus-k8s          ClusterIP   10.96.166.175   <none>        9090/TCP                     6m18s
prometheus-operated     ClusterIP   None            <none>        9090/TCP                     6m18s
prometheus-operator     ClusterIP   None            <none>        8443/TCP                     11m
```

可以看到上面针对 grafana、alertmanager 和 prometheus 都创建了一个类型为 ClusterIP 的 Service，当然如果我们想要在外网访问这两个服务的话可以通过创建对应的 Ingress 对象或者使用 NodePort 类型的 Service，我们这里为了简单，直接使用 NodePort 类型的服务即可，编辑 grafana、alertmanager-main 和 prometheus-k8s 这3个 Service，将服务类型更改为 NodePort:

```shell
[root@k8s-master manifests]# kubectl get svc -n monitoring
NAME                    TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)                      AGE
alertmanager-main       NodePort    10.96.246.4     <none>        9093:32704/TCP               9m54s
grafana                 NodePort    10.96.241.17    <none>        3000:31319/TCP               9m53s
prometheus-k8s          NodePort    10.96.166.175   <none>        9090:30343/TCP               9m52s
......
```

更改完成后，我们就可以通过上面的 NodePort 去访问对应的服务了，比如查看 prometheus 的服务发现页面：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220909142557.png)

查看 prometheus 的 targets 页面：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220909143353.png)



我们就可以去查看下 Grafana 下面的监控图表，同样使用上面的 NodePort 访问即可，第一次登录使用 `admin:admin` 登录即可，进入首页后，我们可以发现其实 Grafana 已经有很多配置好的监控图表了。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220909144353.png)

我们可以随便选择一个 Dashboard 查看监控图表信息。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220909144624.png)

## 参考

* https://www.qikqiak.com/k8s-book/docs/58.Prometheus%20Operator.html