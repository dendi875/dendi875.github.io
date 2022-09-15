---
title: 使用 Prometheus  监控 Kubernetes 集群节点
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-09-04 20:27:45
password:
summary: 使用 Prometheus  监控 Kubernetes 集群节点
tags:
	- Kubernetes
	- Prometheus
categories: Kubernetes
---

# 使用 Prometheus  监控 Kubernetes 集群节点

对于 Kubernetes 集群本身的监控也是非常重要的，我们需要时时刻刻了解集群的运行状态。

对于集群的监控一般我们需要考虑以下几个方面：

- Kubernetes 节点的监控：比如节点的 cpu、load、disk、memory 等指标
- 内部系统组件的状态：比如 kube-scheduler、kube-controller-manager、kubedns/coredns 等组件的详细运行状态
- 编排级的 metrics：比如 Deployment 的状态、资源请求、调度和 API 延迟等数据指标

Kubernetes 集群的监控方案目前主要有以下几种方案：

- Heapster：Heapster 是一个集群范围的监控和数据聚合工具，以 Pod 的形式运行在集群中。 heapster 除了 Kubelet/cAdvisor 之外，我们还可以向 Heapster 添加其他指标源数据，比如 kube-state-metrics，需要注意的是 Heapster 已经被废弃了，后续版本中会使用 metrics-server 代替。
- cAdvisor：[cAdvisor](https://github.com/google/cadvisor) 是 Google 开源的容器资源监控和性能分析工具，它是专门为容器而生，本身也支持 Docker 容器。
- kube-state-metrics：[kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) 通过监听 API Server 生成有关资源对象的状态指标，比如 Deployment、Node、Pod，需要注意的是 kube-state-metrics 只是简单提供一个 metrics 数据，并不会存储这些指标数据，所以我们可以使用 Prometheus 来抓取这些数据然后存储。
- metrics-server：metrics-server 也是一个集群范围内的资源数据聚合工具，是 Heapster 的替代品，同样的，metrics-server 也只是显示数据，并不提供数据存储服务。

不过 kube-state-metrics 和 metrics-server 之间还是有很大不同的，二者的主要区别如下：

- kube-state-metrics 主要关注的是业务相关的一些元数据，比如 Deployment、Pod、副本状态等

- metrics-server 主要关注的是[资源度量 API](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/instrumentation/resource-metrics-api.md) 的实现，比如 CPU、文件描述符、内存、请求延时等指标。

  

## 监控集群节点

要监控节点其实我们已经有很多非常成熟的方案了，比如 Nagios、zabbix，甚至我们自己来收集数据也可以，我们这里通过 Prometheus 来采集节点的监控指标数据，可以通过 [node_exporter](https://github.com/prometheus/node_exporter)来获取，顾名思义，`node_exporter` 就是抓取用于采集服务器节点的各种运行指标，目前 `node_exporter` 支持几乎所有常见的监控点，比如 conntrack，cpu，diskstats，filesystem，loadavg，meminfo，netstat 等，详细的监控点列表可以参考其 [Github 仓库](https://github.com/prometheus/node_exporter)。

我们可以通过 DaemonSet 控制器来部署该服务，这样每一个节点都会自动运行一个这样的 Pod，如果我们从集群中删除或者添加节点后，也会进行自动扩展。

在部署 `node-exporter` 的时候有一些细节需要注意，如下资源清单文件：prometheus-node-exporter.yaml

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: kube-mon
  labels:
    name: node-exporter
spec:
  selector:
    matchLabels:
      name: node-exporter
  template:
    metadata:
      labels:
        name: node-exporter
    spec:
      hostPID: true
      hostIPC: true
      hostNetwork: true
      containers:
      - name: node-exporter
        image: prom/node-exporter:v0.16.0
        ports:
        - containerPort: 9100
        resources:
          requests:
            cpu: 0.15
        securityContext:
          privileged: true
        args:
        - --path.procfs
        - /host/proc
        - --path.sysfs
        - /host/sys
        - --collector.filesystem.ignored-mount-points
        - '"^/(sys|proc|dev|host|etc)($|/)"'
        volumeMounts:
        - name: dev
          mountPath: /host/dev
        - name: proc
          mountPath: /host/proc
        - name: sys
          mountPath: /host/sys
        - name: rootfs
          mountPath: /rootfs
      tolerations:  # 添加容忍的声明
      - key: "node-role.kubernetes.io/master"
        operator: "Exists"
        effect: "NoSchedule"
      volumes:
        - name: proc
          hostPath:
            path: /proc
        - name: dev
          hostPath:
            path: /dev
        - name: sys
          hostPath:
            path: /sys
        - name: rootfs
          hostPath:
            path: /
```

由于我们要获取到的数据是主机的监控指标数据，而我们的 `node-exporter` 是运行在容器中的，所以我们在 Pod 中需要配置一些 Pod 的安全策略，这里我们就添加了 `hostPID: true`、`hostIPC: true`、`hostNetwork: true` 3个策略，用来使用主机的 `PID namespace`、`IPC namespace` 以及主机网络，这些 namespace 就是用于容器隔离的关键技术，要注意这里的 namespace 和集群中的 namespace 是两个完全不相同的概念。

另外我们还将主机的 `/dev`、`/proc`、`/sys`这些目录挂载到容器中，这些因为我们采集的很多节点数据都是通过这些文件夹下面的文件来获取到的，比如我们在使用 `top` 命令可以查看当前 cpu 使用情况，数据就来源于文件 `/proc/stat`，使用 `free` 命令可以查看当前内存使用情况，其数据来源是来自 `/proc/meminfo` 文件。

另外由于我们集群使用的是 `kubeadm` 搭建的，所以如果希望 master 节点也一起被监控，则需要添加相应的容忍，然后直接创建上面的资源对象：

```shell
[root@k8s-master prometheus]# kubectl apply -f prometheus-node-exporter.yaml 
daemonset.apps/node-exporter created

[root@k8s-master prometheus]# kubectl get pods -n kube-mon  -o wide  
NAME                          READY   STATUS    RESTARTS   AGE     IP                NODE         NOMINATED NODE   READINESS GATES
node-exporter-bl6nb           1/1     Running   0          2m34s   172.31.0.2        k8s-master   <none>           <none>
node-exporter-fwzlt           1/1     Running   0          2m34s   172.31.0.4        k8s-node2    <none>           <none>
node-exporter-pcr9w           1/1     Running   0          2m34s   172.31.0.3        k8s-node1    <none>           <none>
prometheus-75d4666dcd-vlth8   1/1     Running   0          66m     192.168.169.155   k8s-node2    <none>           <none>
redis-6468bf6c84-qmm2k        2/2     Running   0          27m     192.168.36.93     k8s-node1    <none>           <none>
```

部署完成后，我们可以看到在3个节点上都运行了一个 Pod，我们这里不需要创建一个 Service 吗？我们应该怎样去获取`/metrics`数据呢？我们上面是不是指定了`hostNetwork=true`，所以在每个节点上就会绑定一个端口 9100，我们可以通过这个端口去获取到监控指标数据：

```shell
[root@k8s-master prometheus]# curl localhost:9100/metrics | more 
# HELP go_gc_duration_seconds A summary of the GC invocation durations.
# TYPE go_gc_duration_seconds summary
go_gc_duration_seconds{quantile="0"} 7.0468e-05
go_gc_duration_seconds{quantile="0.25"} 7.0468e-05
go_gc_duration_seconds{quantile="0.5"} 8.252e-05
go_gc_duration_seconds{quantile="0.75"} 8.252e-05
go_gc_duration_seconds{quantile="1"} 8.252e-05
go_gc_duration_seconds_sum 0.000152988
go_gc_duration_seconds_count 2
......
promhttp_metric_handler_requests_total{code="200"} 0
promhttp_metric_handler_requests_total{code="500"} 0
promhttp_metric_handler_requests_total{code="503"} 0
```

当然如果你觉得上面的手动安装方式比较麻烦，我们也可以使用 Helm 的方式来安装：

```shell
$ helm upgrade --install --name node-exporter --namespace kube-mon stable/prometheus-node-exporter
```

## 服务发现

由于我们这里每个节点上面都运行了 `node-exporter` 程序，如果我们通过一个 Service 来将数据收集到一起用静态配置的方式配置到 Prometheus 去中，就只会显示一条数据，我们得自己在指标数据中去过滤每个节点的数据，当然我们也可以手动的把所有节点用静态的方式配置到 Prometheus 中去，但是以后要新增或者去掉节点的时候就还得手动去配置，那么有没有一种方式可以让 Prometheus 去自动发现我们节点的 `node-exporter` 程序，并且按节点进行分组呢？这就是 Prometheus 里面非常重要的**服务发现**功能了。

在 Kubernetes 下，Promethues 通过与 Kubernetes API 集成，主要支持5中服务发现模式，分别是：`Node`、`Service`、`Pod`、`Endpoints`、`Ingress`。

我们通过 kubectl 命令可以很方便的获取到当前集群中的所有节点信息：

```shell
[root@k8s-master prometheus]# kubectl get nodes
NAME         STATUS   ROLES                  AGE   VERSION
k8s-master   Ready    control-plane,master   20d   v1.20.9
k8s-node1    Ready    <none>                 20d   v1.20.9
k8s-node2    Ready    <none>                 20d   v1.20.9
```

但是要让 Prometheus 也能够获取到当前集群中的所有节点信息的话，我们就需要利用 Node 的服务发现模式，同样的，在 ` prometheus-cm.yaml` 文件中配置如下的 job 任务即可：

```yaml
- job_name: 'kubernetes-nodes'
  kubernetes_sd_configs:
  - role: node
```

通过指定 `kubernetes_sd_configs` 的模式为`node`，Prometheus 就会自动从 Kubernetes 中发现所有的 node 节点并作为当前 job 监控的目标实例，发现的节点 `/metrics` 接口是默认的 kubelet 的 HTTP 接口。

prometheus 的 ConfigMap 更新完成后，同样的我们执行 reload 操作，让配置生效：

```shell
[root@k8s-master prometheus]# kubectl apply -f prometheus-cm.yaml 
configmap/prometheus-config configured

# 隔一会儿执行reload操作
[root@k8s-master prometheus]# kubectl get svc -n kube-mon
NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)             AGE
prometheus   NodePort    10.96.146.110   <none>        9090:32640/TCP      71m
redis        ClusterIP   10.96.143.235   <none>        6379/TCP,9121/TCP   36m

[root@k8s-master prometheus]# curl -X POST "http://10.96.146.110:9090/-/reload"
```

配置生效后，我们再去 prometheus 的 dashboard 中查看 Targets 是否能够正常抓取数据，访问`http://任意节点IP:32640`：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902225935.png)

我们可以看到上面的`kubernetes-nodes`这个 job 任务已经自动发现了我们3个 node 节点，但是在获取数据的时候失败了，出现了类似于下面的错误信息：

```shell
server returned HTTP status 400 Bad Request
```

这个是因为 prometheus 去发现 Node 模式的服务的时候，访问的端口默认是10250，而默认是需要认证的 https 协议才有权访问的，但实际上我们并不是希望让去访问10250端口的 `/metrics`接口，而是 `node-exporter` 绑定到节点的 9100 端口，所以我们应该将这里的 `10250` 替换成 `9100`，但是应该怎样替换呢？

这里我们就需要使用到 Prometheus 提供的 `relabel_configs` 中的 `replace` 能力了，`relabel` 可以在 Prometheus 采集数据之前，通过 Target 实例的 `Metadata` 信息，动态重新写入 Label 的值。除此之外，我们还能根据 Target 实例的 `Metadata` 信息选择是否采集或者忽略该 Target 实例。比如我们这里就可以去匹配 `__address__` 这个 Label 标签，然后替换掉其中的端口，如果你不知道有哪些 Label 标签可以操作的话，可以将鼠标移动到 Targets 的标签区域，其中显示的 `Before relabeling` 区域都是我们可以操作的标签：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902230807.png)

现在我们来替换掉端口，修改 ConfigMap：prometheus-cm.yaml

```yaml
- job_name: 'kubernetes-nodes'
  kubernetes_sd_configs:
  - role: node
  relabel_configs:
  - source_labels: [__address__]
    regex: '(.*):10250'
    replacement: '${1}:9100'
    target_label: __address__
    action: replace
```

这里就是一个正则表达式，去匹配 `__address__` 这个标签，然后将 host 部分保留下来，port 替换成了 9100，现在我们重新更新配置文件，执行 reload 操作，然后再去看 Prometheus 的 Dashboard 的 Targets 路径下面 kubernetes-nodes 这个 job 任务是否正常了：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902231454.png)

我们可以看到现在已经正常了，但是还有一个问题就是我们采集的指标数据 Label 标签就只有一个节点的 hostname，这对于我们在进行监控分组分类查询的时候带来了很多不方便的地方，要是我们能够将集群中 Node 节点的 Label 标签也能获取到就很好了。这里我们可以通过 `labelmap` 这个属性来将 Kubernetes 的 Label 标签添加为 Prometheus 的指标数据的标签：

```yaml
- job_name: 'kubernetes-nodes'
  kubernetes_sd_configs:
  - role: node
  relabel_configs:
  - source_labels: [__address__]
    regex: '(.*):10250'
    replacement: '${1}:9100'
    target_label: __address__
    action: replace
  - action: labelmap
    regex: __meta_kubernetes_node_label_(.+)
```

添加了一个 action 为 `labelmap`，正则表达式是 `__meta_kubernetes_node_label_(.+)` 的配置，这里的意思就是表达式中匹配都的数据也添加到指标数据的 Label 标签中去。

对于 `kubernetes_sd_configs` 下面可用的元信息标签如下：

- `__meta_kubernetes_node_name`：节点对象的名称
- `_meta_kubernetes_node_label`：节点对象中的每个标签
- `_meta_kubernetes_node_annotation`：来自节点对象的每个注释
- `_meta_kubernetes_node_address`：每个节点地址类型的第一个地址（如果存在）

关于 kubernets_sd_configs 更多信息可以查看官方文档：[kubernetes_sd_config](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#)

另外由于 kubelet 也自带了一些监控指标数据，就上面我们提到的 10250 端口，所以我们这里也把 kubelet 的监控任务也一并配置上：

```yaml
- job_name: 'kubernetes-kubelet'
  kubernetes_sd_configs:
  - role: node
  scheme: https
  tls_config:
    ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    insecure_skip_verify: true
  bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
  relabel_configs:
  - action: labelmap
    regex: __meta_kubernetes_node_label_(.+)
```

但是这里需要特别注意的是这里必须使用 `https` 协议访问，这样就必然需要提供证书，我们这里是通过配置 `insecure_skip_verify: true` 来跳过了证书校验，但是除此之外，要访问集群的资源，还必须要有对应的权限才可以，也就是对应的 ServiceAccount 的权限允许才可以，我们这里部署的 prometheus 关联的 ServiceAccount 对象前面我们已经提到过了，这里我们只需要将 Pod 中自动注入的 `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt` 和 `/var/run/secrets/kubernetes.io/serviceaccount/token` 文件配置上，就可以获取到对应的权限了。

现在我们再去更新下配置文件，执行 reload 操作，让配置生效

```shell
[root@k8s-master prometheus]# kubectl apply -f prometheus-cm.yaml 
configmap/prometheus-config configured

# 隔一会儿执行reload操作
[root@k8s-master prometheus]# curl -X POST "http://10.96.146.110:9090/-/reload"
```

然后访问 Prometheus 的 Dashboard 查看 Targets 路径：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902232253.png)

现在可以看到我们上面添加的 `kubernetes-kubelet` 和 `kubernetes-nodes` 这两个 job 任务都已经配置成功了，而且二者的 Labels 标签都和集群的 node 节点标签保持一致了。



现在我们就可以切换到 Graph 路径下面查看采集的一些指标数据了，比如查询 node_load1 指标：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902232620.png)



我们可以看到将3个 node 节点对应的 node_load1 指标数据都查询出来了，同样的，我们还可以使用 PromQL 语句来进行更复杂的一些聚合查询操作，还可以根据我们的 Labels 标签对指标数据进行聚合，比如我们这里只查询  k8s-node1 节点的数据，可以使用表达式`node_load1{instance="k8s-node1"}`来进行查询：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902232750.png)



到这里我们就把 Kubernetes 集群节点使用 Prometheus 监控起来了。

 prometheus-cm.yaml  内容如下：

```shell
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: kube-mon
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      scrape_timeout: 15s

    scrape_configs:
    - job_name: 'prometheus'
      static_configs:
        - targets: ['localhost:9090']

    - job_name: 'coredns'
      static_configs:
        - targets: ['192.168.235.243:9153', '192.168.235.240:9153']

    - job_name: 'redis'
      static_configs:
      - targets: ['redis:9121']

    - job_name: 'kubernetes-nodes'
      kubernetes_sd_configs:
      - role: node
      relabel_configs:
      - source_labels: [__address__]
        regex: '(.*):10250'
        replacement: '${1}:9100'
        target_label: __address__
        action: replace
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)

    - job_name: 'kubernetes-kubelet'
      kubernetes_sd_configs:
      - role: node
      scheme: https
      tls_config:
        ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        insecure_skip_verify: true
      bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
      relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)  
```



## 参考

* https://www.qikqiak.com/k8s-book/docs/54.%E7%9B%91%E6%8E%A7Kubernetes%E9%9B%86%E7%BE%A4%E8%8A%82%E7%82%B9.html