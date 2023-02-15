---
title: Kubernetes HPA
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-28 17:40:27
password:
summary: Kubernetes Horizontal Pod Autoscaling（Pod 水平自动伸缩）
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes HPA

在  k8s 中我们可以使用 `kubectl scale` 命令可以来实现 Pod 的扩缩容功能，但是这个毕竟是完全手动操作的，要应对线上的各种复杂情况，我们需要能够做到自动化去感知业务，来自动进行扩缩容。为此，Kubernetes 也为我们提供了这样的一个资源对象：`Horizontal Pod Autoscaling（Pod 水平自动伸缩）`，简称`HPA`，HPA 通过监控分析一些控制器控制的所有 Pod 的负载变化情况来确定是否需要调整 Pod 的副本数量，这是 HPA 最基本的原理：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-hpa-1.jpeg)

我们可以简单的通过 `kubectl autoscale` 命令来创建一个 HPA 资源对象，`HPA Controller`默认`30s`轮询一次（可通过 `kube-controller-manager` 的`--horizontal-pod-autoscaler-sync-period` 参数进行设置），查询指定的资源中的 Pod 资源使用率，并且与创建时设定的值和指标做对比，从而实现自动伸缩的功能。

## Metrics Server

`Metrics Server` 可以通过标准的 Kubernetes API 把监控数据暴露出来，有了 `Metrics Server` 之后，我们就完全可以通过标准的 Kubernetes API 来访问我们想要获取的监控数据了

参考说明：https://kubernetes.io/zh-cn/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/

```bash
kubectl get --raw "/apis/metrics.k8s.io/v1beta1/namespaces/<namespace-name>/pods/<pod-name>" | jq '.'
```

这是使用 `curl` 来完成的相同 API 调用：

```bash
curl https://localhost:8080/apis/metrics.k8s.io/v1beta1/namespaces/<namespace-name>/pods/<pod-name>
```

比如当我们访问上面的 API 的时候，我们就可以获取到该 Pod 的资源数据，这些数据其实是来自于 kubelet 的 `Summary API` 采集而来的。不过需要说明的是我们这里可以通过标准的 API 来获取资源监控数据，并不是因为 `Metrics Server` 就是 APIServer 的一部分，而是通过 Kubernetes 提供的 `Aggregator` 汇聚插件来实现的，是独立于 APIServer 之外运行的。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220828161732.png)

### 聚合 API

`Aggregator` 允许开发人员编写一个自己的服务，把这个服务注册到 Kubernetes 的 APIServer 里面去，这样我们就可以像原生的 APIServer 提供的 API 使用自己的 API 了，我们把自己的服务运行在 Kubernetes 集群里面，然后 Kubernetes 的 `Aggregator` 通过 Service 名称就可以转发到我们自己写的 Service 里面去了。这样这个聚合层就带来了很多好处：

- 增加了 API 的扩展性，开发人员可以编写自己的 API 服务来暴露他们想要的 API。
- 丰富了 API，核心 kubernetes 团队阻止了很多新的 API 提案，通过允许开发人员将他们的 API 作为单独的服务公开，这样就无须社区繁杂的审查了。
- 开发分阶段实验性 API，新的 API 可以在单独的聚合服务中开发，当它稳定之后，在合并会 APIServer 就很容易了。
- 确保新 API 遵循 Kubernetes 约定，如果没有这里提出的机制，社区成员可能会被迫推出自己的东西，这样很可能造成社区成员和社区约定不一致。

### 安装

我们要使用 HPA，就需要在集群中安装 `Metrics Server` 服务，要安装 `Metrics Server` 就需要开启 `Aggregator`，因为 `Metrics Server` 就是通过该代理进行扩展的，不过我们集群是通过 Kubeadm 搭建的，默认已经开启了。

`Aggregator` 聚合层启动完成后，就可以来安装 `Metrics Server` 了，我们可以获取该仓库的官方安装资源清单：

```bash
# 官方仓库地址：https://github.com/kubernetes-sigs/metrics-server

$ wget https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.3.6/components.yaml -O ~/download/metrics-server.yaml
```

在部署之前，修改 `components.yaml` 的镜像地址为：

```bash
containers:
- name: metrics-server
  image: registry.aliyuncs.com/google_containers/metrics-server-amd64:v0.3.6
```

等部署完成后，可以查看 Pod 日志是否正常：

```bash
[root@k8s-master ~]# kubectl apply -f download/metrics-server.yaml 
 
[root@k8s-master ~]# kubectl get pods -n kube-system -l k8s-app=metrics-server
NAME                             READY   STATUS    RESTARTS   AGE
metrics-server-75665d756-jdpw5   1/1     Running   0          2m22s

[root@k8s-master ~]# kubectl logs -f metrics-server-75665d756-jdpw5 -n kube-system
......
E0828 08:29:03.977217       1 manager.go:111] unable to fully collect metrics: [unable to fully scrape metrics from source kubelet_summary:k8s-node2: unable to fetch metrics from Kubelet k8s-node2 (k8s-node2): Get https://k8s-node2:10250/stats/summary?only_cpu_and_memory=true: dial tcp: lookup k8s-node2 on 10.96.0.10:53: no such host, unable to fully scrape metrics from source kubelet_summary:k8s-node1: unable to fetch metrics from Kubelet k8s-node1 (k8s-node1): Get https://k8s-node1:10250/stats/summary?only_cpu_and_memory=true: dial tcp: lookup k8s-node1 on 10.96.0.10:53: no such host, unable to fully scrape metrics from source kubelet_summary:k8s-master: unable to fetch metrics from Kubelet k8s-master (k8s-master): Get https://k8s-master:10250/stats/summary?only_cpu_and_memory=true: dial tcp: lookup k8s-master on 10.96.0.10:53: no such host]
```

我们可以发现 Pod 中出现了一些错误信息：`xxx: no such host`，我们看到这个错误信息一般就可以确定是 DNS 解析不了造成的，我们可以看到 Metrics Server 会通过 kubelet 的 10250 端口获取信息，使用的是 hostname，我们部署集群的时候在节点的 `/etc/hosts` 里面添加了节点的 hostname 和 ip 的映射，但是是我们的 Metrics Server 的 Pod 内部并没有这个 hosts 信息，当然也就不识别 hostname 了，要解决这个问题，有两种方法：

第一种方法就是在集群内部的 DNS 服务里面添加上 hostname 的解析，比如我们这里集群中使用的是 `CoreDNS`，我们就可以去修改下 CoreDNS 的 Configmap 信息，添加上 hosts 信息：

```bash
$ kubectl edit configmap coredns -n kube-system
apiVersion: v1
data:
  Corefile: |
    .:53 {
        errors
        health
        hosts {  # 添加集群节点hosts隐射信息
          172.31.0.2 k8s-master
          172.31.0.3 k8s-node1
          172.31.0.4 k8s-node2
          fallthrough
        }
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           upstream
           fallthrough in-addr.arpa ip6.arpa
        }
        prometheus :9153
        proxy . /etc/resolv.conf
        cache 30
        reload
    }
kind: ConfigMap
metadata:
  creationTimestamp: 2019-05-18T11:07:46Z
  name: coredns
  namespace: kube-system
```

这样当在集群内部的 Pod 访问集群节点的 hostname 的时候就可以解析到对应的 ip 了，另外一种方法（https://github.com/kubernetes-sigs/metrics-server）就是在 metrics-server 的启动参数中修改 `kubelet-preferred-address-types` 参数，如下：

```bash
args:
- --cert-dir=/tmp
- --secure-port=4443
- --kubelet-preferred-address-types=InternalIP
```

我们这里使用第二种方式，然后重新安装：

```bash
[root@k8s-master ~]# kubectl delete -f download/metrics-server.yaml
[root@k8s-master ~]# kubectl apply -f download/metrics-server.yaml 

[root@k8s-master ~]# kubectl get pods -n kube-system -l k8s-app=metrics-server
NAME                              READY   STATUS    RESTARTS   AGE
metrics-server-78f654ccdd-wcf8t   1/1     Running   0          91s

[root@k8s-master ~]# kubectl logs -f metrics-server-78f654ccdd-wcf8t -n kube-system
......
E0828 08:47:12.412582       1 manager.go:111] unable to fully collect metrics: [unable to fully scrape metrics from source kubelet_summary:k8s-node1: unable to fetch metrics from Kubelet k8s-node1 (172.31.0.3): Get https://172.31.0.3:10250/stats/summary?only_cpu_and_memory=true: x509: cannot validate certificate for 172.31.0.3 because it doesn't contain any IP SANs, unable to fully scrape metrics from source kubelet_summary:k8s-master: unable to fetch metrics from Kubelet k8s-master (172.31.0.2): Get https://172.31.0.2:10250/stats/summary?only_cpu_and_memory=true: x509: cannot validate certificate for 172.31.0.2 because it doesn't contain any IP SANs, unable to fully scrape metrics from source kubelet_summary:k8s-node2: unable to fetch metrics from Kubelet k8s-node2 (172.31.0.4): Get https://172.31.0.4:10250/stats/summary?only_cpu_and_memory=true: x509: cannot validate certificate for 172.31.0.4 because it doesn't contain any IP SANs]
```

因为部署集群的时候，CA 证书并没有把各个节点的 IP 签上去，所以这里 `Metrics Server` 通过 IP 去请求时，提示签的证书没有对应的 IP（错误：`x509: cannot validate certificate for 172.31.0.3 because it doesn’t contain any IP SANs`），我们可以添加一个`--kubelet-insecure-tls`参数跳过证书校验：

```bash
args:
- --cert-dir=/tmp
- --secure-port=4443
- --kubelet-insecure-tls
- --kubelet-preferred-address-types=InternalIP
```

然后再重新安装即可成功！可以通过如下命令来验证：

```bash
[root@k8s-master ~]# kubectl delete -f download/metrics-server.yaml
[root@k8s-master ~]# kubectl apply -f download/metrics-server.yaml 

[root@k8s-master ~]# kubectl get pods -n kube-system -l k8s-app=metrics-server
NAME                             READY   STATUS    RESTARTS   AGE
metrics-server-9b4dc89d7-jnmr7   1/1     Running   0          14s

[root@k8s-master ~]# kubectl logs -f metrics-server-9b4dc89d7-jnmr7 -n kube-system
I0828 08:51:12.584555       1 serving.go:312] Generated self-signed cert (/tmp/apiserver.crt, /tmp/apiserver.key)
I0828 08:51:13.012958       1 secure_serving.go:116] Serving securely on [::]:4443
......

[root@k8s-master ~]#  kubectl get apiservice | grep metrics
v1beta1.metrics.k8s.io                 kube-system/metrics-server   True        67s


[root@k8s-master ~]# kubectl get --raw "/apis/metrics.k8s.io/v1beta1/nodes"
{"kind":"NodeMetricsList","apiVersion":"metrics.k8s.io/v1beta1","metadata":{"selfLink":"/apis/metrics.k8s.io/v1beta1/nodes"},"items":[{"metadata":{"name":"k8s-master","selfLink":"/apis/metrics.k8s.io/v1beta1/nodes/k8s-master","creationTimestamp":"2022-08-28T08:53:06Z"},"timestamp":"2022-08-28T08:52:05Z","window":"30s","usage":{"cpu":"135321453n","memory":"1509068Ki"}},{"metadata":{"name":"k8s-node1","selfLink":"/apis/metrics.k8s.io/v1beta1/nodes/k8s-node1","creationTimestamp":"2022-08-28T08:53:06Z"},"timestamp":"2022-08-28T08:52:11Z","window":"30s","usage":{"cpu":"64140701n","memory":"708528Ki"}},{"metadata":{"name":"k8s-node2","selfLink":"/apis/metrics.k8s.io/v1beta1/nodes/k8s-node2","creationTimestamp":"2022-08-28T08:53:06Z"},"timestamp":"2022-08-28T08:52:04Z","window":"30s","usage":{"cpu":"63743191n","memory":"830800Ki"}}]}


[root@k8s-master ~]# kubectl top nodes
NAME         CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%   
k8s-master   151m         7%     1456Mi          37%       
k8s-node1    72m          3%     689Mi           17%       
k8s-node2    65m          3%     811Mi           21% 
```

现在我们可以通过 `kubectl top` 命令来获取到资源数据了，证明 `Metrics Server` 已经安装成功了。

## HAP

现在我们用 Deployment 来创建一个 Nginx Pod，然后利用 `HPA` 来进行自动扩缩容。资源清单如下所示：（hpa-demo.yaml）

把 hap 相关资源文件统一放在 hap 目录下

```bash
[root@k8s-master ~]# mkdir ~/hap
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hpa-demo
spec:
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx
        ports:
        - containerPort: 80
```

然后直接创建 Deployment：

```bash
[root@k8s-master ~]# kubectl apply -f hpa/hpa-demo.yaml 
deployment.apps/hpa-demo created

[root@k8s-master ~]# kubectl get pods -l app=nginx
NAME                        READY   STATUS    RESTARTS   AGE
hpa-demo-7848d4b86f-9sw8b   1/1     Running   0          18s
```

现在我们来创建一个 `HPA` 资源对象，可以使用`kubectl autoscale`命令来创建：

```bash
[root@k8s-master ~]# kubectl autoscale deployment hpa-demo --cpu-percent=10 --min=1 --max=10  
horizontalpodautoscaler.autoscaling/hpa-demo autoscaled

[root@k8s-master ~]# kubectl get hpa
NAME       REFERENCE             TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
hpa-demo   Deployment/hpa-demo   <unknown>/10%   1         10        0          11s
```

此命令创建了一个关联资源 hpa-demo 的 HPA，最小的 Pod 副本数为1，最大为10。HPA 会根据设定的 cpu 使用率（10%）动态的增加或者减少 Pod 数量。

当然我们依然还是可以通过创建 YAML 文件的形式来创建 HPA 资源对象。如果我们不知道怎么编写的话，可以查看上面命令行创建的HPA的YAML文件：

```bash
[root@k8s-master ~]# kubectl get hpa hpa-demo -o yaml
apiVersion: autoscaling/v1
kind: HorizontalPodAutoscaler
metadata:
  annotations:
    autoscaling.alpha.kubernetes.io/conditions: '[{"type":"AbleToScale","status":"True","lastTransitionTime":"2022-08-28T09:04:49Z","reason":"SucceededGetScale","message":"the
      HPA controller was able to get the target''s current scale"},{"type":"ScalingActive","status":"False","lastTransitionTime":"2022-08-28T09:04:49Z","reason":"FailedGetResourceMetric","message":"the
      HPA was unable to compute the replica count: failed to get cpu utilization:
      missing request for cpu"}]'
  creationTimestamp: "2022-08-28T09:04:34Z"
  managedFields:
  - apiVersion: autoscaling/v1
    fieldsType: FieldsV1
    fieldsV1:
      f:spec:
        f:maxReplicas: {}
        f:minReplicas: {}
        f:scaleTargetRef:
          f:apiVersion: {}
          f:kind: {}
          f:name: {}
        f:targetCPUUtilizationPercentage: {}
    manager: kubectl-autoscale
    operation: Update
    time: "2022-08-28T09:04:34Z"
  - apiVersion: autoscaling/v1
    fieldsType: FieldsV1
    fieldsV1:
      f:metadata:
        f:annotations:
          .: {}
          f:autoscaling.alpha.kubernetes.io/conditions: {}
      f:status:
        f:currentReplicas: {}
    manager: kube-controller-manager
    operation: Update
    time: "2022-08-28T09:04:49Z"
  name: hpa-demo
  namespace: default
  resourceVersion: "126191"
  uid: c9a2ee21-cced-4518-863f-61fcf4f76c8e
spec:
  maxReplicas: 10
  minReplicas: 1
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hpa-demo
  targetCPUUtilizationPercentage: 10
status:
  currentReplicas: 1
  desiredReplicas: 0
```

然后我们可以根据上面的 YAML 文件就可以自己来创建一个基于 YAML 的 HPA 描述文件了。但是我们发现上面信息里面出现了一些 Fail 信息，我们来查看下这个 HPA 对象的信息：

```bash
[root@k8s-master ~]# kubectl describe hpa hpa-demo
Name:                                                  hpa-demo
Namespace:                                             default
Labels:                                                <none>
Annotations:                                           <none>
CreationTimestamp:                                     Sun, 28 Aug 2022 17:04:34 +0800
Reference:                                             Deployment/hpa-demo
Metrics:                                               ( current / target )
  resource cpu on pods  (as a percentage of request):  <unknown> / 10%
Min replicas:                                          1
Max replicas:                                          10
Deployment pods:                                       1 current / 0 desired
Conditions:
  Type           Status  Reason                   Message
  ----           ------  ------                   -------
  AbleToScale    True    SucceededGetScale        the HPA controller was able to get the target's current scale
  ScalingActive  False   FailedGetResourceMetric  the HPA was unable to compute the replica count: failed to get cpu utilization: missing request for cpu
Events:
  Type     Reason                        Age               From                       Message
  ----     ------                        ----              ----                       -------
  Warning  FailedGetResourceMetric       4s (x5 over 66s)  horizontal-pod-autoscaler  failed to get cpu utilization: missing request for cpu
  Warning  FailedComputeMetricsReplicas  4s (x5 over 66s)  horizontal-pod-autoscaler  invalid metrics (1 invalid out of 1), first error is: failed to get cpu utilization: missing request for cpu
```

我们可以看到上面的事件信息里面出现了 `failed to get cpu utilization: missing request for cpu` 这样的错误信息。这是因为我们上面创建的 Pod 对象没有添加 request 资源声明，这样导致 HPA 读取不到 CPU 指标信息，所以如果要想让 HPA 生效，对应的 Pod 资源必须添加 requests 资源声明，更新我们的资源清单文件（hpa-demo.yaml）：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hpa-demo
spec:
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: 50Mi
            cpu: 50m
```

然后重新更新 Deployment，重新创建 HPA 对象：

```bash
[root@k8s-master ~]# kubectl delete -f hpa/hpa-demo.yaml 
deployment.apps "hpa-demo" deleted

[root@k8s-master ~]# kubectl apply -f hpa/hpa-demo.yaml 
deployment.apps/hpa-demo created

[root@k8s-master ~]# kubectl get pods -o wide -l app=nginx
NAME                        READY   STATUS    RESTARTS   AGE   IP              NODE        NOMINATED NODE   READINESS GATES
hpa-demo-6b4467b546-lndbp   1/1     Running   0          59s   192.168.36.72   k8s-node1   <none>           <none>

[root@k8s-master ~]# kubectl get hpa 
NAME       REFERENCE             TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
hpa-demo   Deployment/hpa-demo   <unknown>/10%   1         10        1          5m46s

[root@k8s-master ~]# kubectl delete hpa hpa-demo
horizontalpodautoscaler.autoscaling "hpa-demo" deleted

[root@k8s-master ~]# kubectl autoscale deployment hpa-demo --cpu-percent=10 --min=1 --max=10  
horizontalpodautoscaler.autoscaling/hpa-demo autoscaled


[root@k8s-master ~]# kubectl describe hpa hpa-demo
Name:                                                  hpa-demo
Namespace:                                             default
Labels:                                                <none>
Annotations:                                           <none>
CreationTimestamp:                                     Sun, 28 Aug 2022 17:11:37 +0800
Reference:                                             Deployment/hpa-demo
Metrics:                                               ( current / target )
  resource cpu on pods  (as a percentage of request):  0% (0) / 10%
Min replicas:                                          1
Max replicas:                                          10
Deployment pods:                                       1 current / 1 desired
Conditions:
  Type            Status  Reason               Message
  ----            ------  ------               -------
  AbleToScale     True    ScaleDownStabilized  recent recommendations were higher than current one, applying the highest recent recommendation
  ScalingActive   True    ValidMetricFound     the HPA was able to successfully calculate a replica count from cpu resource utilization (percentage of request)
  ScalingLimited  False   DesiredWithinRange   the desired count is within the acceptable range
Events:           <none>


[root@k8s-master ~]# kubectl get hpa
NAME       REFERENCE             TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
hpa-demo   Deployment/hpa-demo   0%/10%    1         10        1          68s
```

现在可以看到 HPA 资源对象已经正常了，现在我们来增大负载进行测试：

```bash
# 开启另一个终端查看 hap-demo Pod 的 ip
[root@k8s-master ~]# kubectl get pods 
NAME                        READY   STATUS    RESTARTS   AGE
hpa-demo-6b4467b546-lndbp   1/1     Running   0          10m

[root@k8s-master ~]# kubectl get pod hpa-demo-6b4467b546-lndbp -o wide
NAME                        READY   STATUS    RESTARTS   AGE   IP              NODE        NOMINATED NODE   READINESS GATES
hpa-demo-6b4467b546-lndbp   1/1     Running   0          11m   192.168.36.72   k8s-node1   <none>           <none>
```

我们来创建一个 busybox 的 Pod，并且循环访问上面创建的 Pod：

```bash
[root@k8s-master ~]#  kubectl run -it --image busybox test-hpa --restart=Never --rm /bin/sh
If you don't see a command prompt, try pressing enter.
/ # while true; do wget -q -O- http://192.168.36.72; done
```

下图可以看到，HPA 已经开始工作：

```bash
[root@k8s-master ~]# kubectl get hpa
NAME       REFERENCE             TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
hpa-demo   Deployment/hpa-demo   0%/10%    1         10        10         17m


[root@k8s-master ~]#  kubectl get pods -l app=nginx --watch
NAME                        READY   STATUS    RESTARTS   AGE
hpa-demo-6b4467b546-dlgk5   0/1     ContainerCreating   0          1s
hpa-demo-6b4467b546-5plpg   0/1     ContainerCreating   0          1s
hpa-demo-6b4467b546-wprxt   1/1     Running             0          17s
hpa-demo-6b4467b546-dlgk5   1/1     Running             0          2s
hpa-demo-6b4467b546-nd5rh   1/1     Running             0          18s
hpa-demo-6b4467b546-rbv2x   0/1     Pending             0          0s
hpa-demo-6b4467b546-rbv2x   0/1     Pending             0          0s
hpa-demo-6b4467b546-6bcg2   0/1     Pending             0          0s
hpa-demo-6b4467b546-6bcg2   0/1     Pending             0          0s
hpa-demo-6b4467b546-6bcg2   0/1     ContainerCreating   0          0s
hpa-demo-6b4467b546-rbv2x   0/1     ContainerCreating   0          0s
hpa-demo-6b4467b546-6bcg2   0/1     ContainerCreating   0          0s
hpa-demo-6b4467b546-rbv2x   0/1     ContainerCreating   0          0s
hpa-demo-6b4467b546-nphlm   1/1     Running             0          33s
hpa-demo-6b4467b546-5plpg   1/1     Running             0          17s
hpa-demo-6b4467b546-rbv2x   1/1     Running             0          2s
hpa-demo-6b4467b546-rpwpf   1/1     Running             0          32s
hpa-demo-6b4467b546-6bcg2   1/1     Running             0          32s
hpa-demo-6b4467b546-rxp2d   1/1     Running             0          47s
```

我们可以看到已经自动拉起了很多新的 Pod，最后定格在了我们上面设置的 10 个 Pod，同时查看资源 hpa-demo 的副本数量，副本数量已经从原来的1变成了10个：

```bash
[root@k8s-master ~]# kubectl get deployment hpa-demo
NAME       READY   UP-TO-DATE   AVAILABLE   AGE
hpa-demo   10/10   10           10          15m
```

查看 HPA 资源的对象了解工作过程：

```bash
[root@k8s-master ~]# kubectl describe hpa hpa-demo
Name:                                                  hpa-demo
Namespace:                                             default
Labels:                                                <none>
Annotations:                                           <none>
CreationTimestamp:                                     Sun, 28 Aug 2022 17:11:37 +0800
Reference:                                             Deployment/hpa-demo
Metrics:                                               ( current / target )
  resource cpu on pods  (as a percentage of request):  0% (0) / 10%
Min replicas:                                          1
Max replicas:                                          10
Deployment pods:                                       10 current / 10 desired
Conditions:
  Type            Status  Reason               Message
  ----            ------  ------               -------
  AbleToScale     True    ScaleDownStabilized  recent recommendations were higher than current one, applying the highest recent recommendation
  ScalingActive   True    ValidMetricFound     the HPA was able to successfully calculate a replica count from cpu resource utilization (percentage of request)
  ScalingLimited  True    TooManyReplicas      the desired replica count is more than the maximum replica count
Events:
  Type    Reason             Age    From                       Message
  ----    ------             ----   ----                       -------
  Normal  SuccessfulRescale  7m     horizontal-pod-autoscaler  New size: 4; reason: cpu resource utilization (percentage of request) above target
  Normal  SuccessfulRescale  6m44s  horizontal-pod-autoscaler  New size: 8; reason: cpu resource utilization (percentage of request) above target
  Normal  SuccessfulRescale  6m29s  horizontal-pod-autoscaler  New size: 10; reason: cpu resource utilization (percentage of request) above target
```

同样的这个时候我们来关掉 busybox 来减少负载，然后等待一段时间观察下 HPA 和 Deployment 对象：

```bash
[root@k8s-master ~]# kubectl get hpa
NAME       REFERENCE             TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
hpa-demo   Deployment/hpa-demo   0%/10%    1         10        1          19m

[root@k8s-master ~]# kubectl get deployment hpa-demo
NAME       READY   UP-TO-DATE   AVAILABLE   AGE
hpa-demo   1/1     1            1           21m
```

可以看到副本数量已经由 10 变为 1，当前我们只是演示了 CPU 使用率这一个指标，我们还可以根据自定义的监控指标来自动对 Pod 进行扩缩容。

## 参考

* https://v1-21.docs.kubernetes.io/zh/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/
* https://v1-21.docs.kubernetes.io/zh/docs/tasks/run-application/horizontal-pod-autoscale/
* https://github.com/kubernetes-sigs/metrics-server
* https://www.qikqiak.com/k8strain/controller/hpa/