---
title: 使用 Prometheus  监控 Kubernetes 中常用的资源对象
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-09-04 20:27:48
password:
summary: 使用 Prometheus  监控 Kubernetes 中常用的资源对象
tags:
	- Kubernetes
	- Prometheus
categories: Kubernetes
---

# 使用 Prometheus  监控 Kubernetes 中常用的资源对象



## 监控容器

说到容器监控我们自然会想到 `cAdvisor`，cAdvisor已经内置在了 kubelet 组件之中，所以我们不需要单独去安装，`cAdvisor` 的数据路径为 `/api/v1/nodes/<node>/proxy/metrics`，同样我们这里使用 node 的服务发现模式，因为每一个节点下面都有 kubelet，自然都有 `cAdvisor`采集到的数据指标，配置如下：

```yaml
- job_name: 'kubernetes-cadvisor'
  kubernetes_sd_configs:
  - role: node
  scheme: https
  tls_config:
    ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
  bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
  relabel_configs:
  - action: labelmap
    regex: __meta_kubernetes_node_label_(.+)
  - target_label: __address__
    replacement: kubernetes.default.svc:443
  - source_labels: [__meta_kubernetes_node_name]
    regex: (.+)
    target_label: __metrics_path__
    replacement: /api/v1/nodes/${1}/proxy/metrics/cadvisor
```

上面的配置和我们之前配置 `node-exporter` 的时候几乎是一样的，区别是我们这里使用了 https 的协议，另外需要注意的是配置了 ca.cart 和 token 这两个文件，这两个文件是 Pod 启动后自动注入进来的，通过这两个文件我们可以在 Pod 中访问 apiserver，比如我们这里的 `__address__` 不再是 nodeip 了，而是 kubernetes 在集群中的服务地址，然后加上`__metrics_path__` 的访问路径 `/api/v1/nodes/${1}/proxy/metrics/cadvisor`，因为我们现在是通过 kubernetes 的 apiserver 地址去进行访问的，现在同样更新下配置，然后查看 Targets 路径：

更新配置：

```bash
[root@k8s-master prometheus]# kubectl apply -f prometheus-cm.yaml  
configmap/prometheus-config configured

# 隔一会儿执行reload操作
[root@k8s-master prometheus]# curl -X POST "http://10.96.146.110:9090/-/reload" 
```

查看 Targets 路径：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904162720.png)

我们可以切换到 Graph 路径下面查询容器相关数据，比如我们这里来查询集群中所有 Pod 的 CPU 使用情况，kubelet 中的 cAdvisor 采集的指标和含义，可以查看 [Monitoring cAdvisor with Prometheus](https://github.com/google/cadvisor/blob/master/docs/storage/prometheus.md) 说明，其中有一项：

> ```
> container_cpu_usage_seconds_total   Counter     Cumulative cpu time consumed    seconds
> ```

`container_cpu_usage_seconds_total` 是容器累计使用的 CPU 时间，用它除以 CPU 的总时间，就可以得到容器的 CPU 使用率了：

首先计算容器的 CPU 占用时间，由于节点上的 CPU 有多个，所以需要将容器在每个 CPU 上占用的时间累加起来，Pod 在 1m 内累积使用的 CPU 时间为：(根据 pod 和 namespace 进行分组查询)

> ```
> sum(rate(container_cpu_usage_seconds_total{image!="",pod!=""}[1m])) by (namespace, pod)
> ```

然后计算 CPU 的总时间，这里的 CPU 数量是容器分配到的 CPU 数量，`container_spec_cpu_quota`是容器的 CPU 配额，它的值是容器指定的 `CPU 个数 * 100000`，所以 Pod 在 1s 内 CPU 的总时间为：Pod 的 CPU 核数 * 1s：

> ```
> sum(container_spec_cpu_quota{image!="", pod!=""}) by(namespace, pod) / 100000
> ```

将上面这两个语句的结果相除，就得到了容器的 CPU 使用率：

> (sum(rate(container_cpu_usage_seconds_total{image!="",pod!=""}[1m])) by (namespace, pod)) / (sum(container_spec_cpu_quota{image!="", pod!=""}) by(namespace, pod) / 100000) * 100

在 promethues 里面执行上面的 promQL 语句可以得到下面的结果：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904163745.png)

## 监控 apiserver

apiserver 作为 Kubernetes 最核心的组件，当然他的监控也是非常有必要的，对于 apiserver 的监控我们可以直接通过 kubernetes 的 Service 来获取：

```bash
[root@k8s-master prometheus]# kubectl get svc
NAME         TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
kubernetes   ClusterIP   10.96.0.1    <none>        443/TCP   21d
```

上面这个 Service 就是我们集群的 apiserver 在集群内部的 Service 地址，要自动发现 Service 类型的服务，我们就需要用到 role 为 Endpoints 的 `kubernetes_sd_configs`，我们可以在 ConfigMap 对象中添加上一个 Endpoints 类型的服务的监控任务：

```yaml
- job_name: 'kubernetes-apiservers'
  kubernetes_sd_configs:
  - role: endpoints
```

上面这个任务是定义的一个类型为 endpoints 的 kubernetes_sd_configs ，添加到 Prometheus 的 ConfigMap 的配置文件中，然后更新配置：

```bash
[root@k8s-master prometheus]# kubectl apply -f prometheus-cm.yaml  
configmap/prometheus-config configured

# 隔一会儿执行reload操作
[root@k8s-master prometheus]# curl -X POST "http://10.96.146.110:9090/-/reload" 
```

更新完成后，我们再去查看 Prometheus 的 Dashboard 的 target 页面：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904164515.png)

我们可以看到 kubernetes-apiservers 下面出现了很多实例，这是因为这里我们使用的是 Endpoints 类型的服务发现，所以 Prometheus 把所有的 Endpoints 服务都抓取过来了，同样的，上面我们需要的服务名为 `kubernetes` 这个 apiserver 的服务也在这个列表之中，那么我们应该怎样来过滤出这个服务来呢？还记得前面的 `relabel_configs` 吗？没错，同样我们需要使用这个配置，只是我们这里不是使用 `replace` 这个动作了，而是 `keep`，就是只把符合我们要求的给保留下来，哪些才是符合我们要求的呢？我们可以把鼠标放置在任意一个 target 上，可以查看到`Before relabeling`里面所有的元数据，比如我们要过滤的服务是 `default` 这个 namespace 下面，服务名为 `kubernetes` 的元数据，所以这里我们就可以根据对应的 `__meta_kubernetes_namespace` 和 `__meta_kubernetes_service_name` 这两个元数据来 relabel，另外由于 kubernetes 这个服务对应的端口是 443，需要使用 https 协议，所以这里我们需要使用 https 的协议，对应的就需要将 ca 证书配置上，如下所示：

```yaml
- job_name: 'kubernetes-apiservers'
  kubernetes_sd_configs:
  - role: endpoints
  scheme: https
  tls_config:
    ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
  bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
  relabel_configs:
  - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
    action: keep
    regex: default;kubernetes;https
```

现在重新更新配置文件、重新加载 Prometheus，切换到 Prometheus 的 Targets 路径下查看：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904164841.png)

现在可以看到 `kubernetes-apiserver` 这个任务下面只有 apiserver 这一个实例了，证明我们的 `relabel` 是成功的，现在我们切换到 Graph 路径下面查看下采集到的数据，比如查询 apiserver 的总的请求数：

```bash
sum(rate(apiserver_request_count[1m]))
```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904165507.png)

这样我们就完成了对 Kubernetes APIServer 的监控。

另外如果我们要来监控其他系统组件，比如 kube-controller-manager、kube-scheduler 的话应该怎么做呢？由于 apiserver 服务 namespace 在 default 使用默认的 Service kubernetes，而其余组件服务在 kube-system 这个 namespace 下面，如果我们想要来监控这些组件的话，需要手动创建单独的 Service，其中 kube-sheduler 的指标数据端口为 10251，kube-controller-manager 对应的端口为 10252。

## 监控 Pod

上面的 apiserver 实际上就是一种特殊的 Endpoints，现在我们同样来配置一个任务用来专门发现普通类型的 Endpoint，其实就是 Service 关联的 Pod 列表：

```yaml
- job_name: 'kubernetes-endpoints'
  kubernetes_sd_configs:
  - role: endpoints
  relabel_configs:
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
    action: keep
    regex: true
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scheme]
    action: replace
    target_label: __scheme__
    regex: (https?)
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_path]
    action: replace
    target_label: __metrics_path__
    regex: (.+)
  - source_labels: [__address__, __meta_kubernetes_service_annotation_prometheus_io_port]
    action: replace
    target_label: __address__
    regex: ([^:]+)(?::\d+)?;(\d+)
    replacement: $1:$2
  - action: labelmap
    regex: __meta_kubernetes_service_label_(.+)
  - source_labels: [__meta_kubernetes_namespace]
    action: replace
    target_label: kubernetes_namespace
  - source_labels: [__meta_kubernetes_service_name]
    action: replace
    target_label: kubernetes_name
  - source_labels: [__meta_kubernetes_pod_name]
    action: replace
    target_label: kubernetes_pod_name
```

注意我们这里在 `relabel_configs` 区域做了大量的配置，特别是第一个保留`__meta_kubernetes_service_annotation_prometheus_io_scrape` 为 true 的才保留下来，这就是说要想自动发现集群中的 Endpoint，就需要我们在 Service 的 `annotation` 区域添加 `prometheus.io/scrape=true` 的声明，现在我们先将上面的配置更新，查看下效果：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904170003.png)

我们可以看到 `kubernetes-endpoints` 这一个任务下面只发现了两个服务，这是因为我们在 `relabel_configs` 中过滤了 `annotation` 有 `prometheus.io/scrape=true` 的 Service，而现在我们系统中只有这样一个 `kube-dns` 服务符合要求，该 Service 下面有两个实例，所以出现了两个实例：

```bash
[root@k8s-master prometheus]# kubectl get svc kube-dns -n kube-system -o yaml
apiVersion: v1
kind: Service
metadata:
  annotations:
    prometheus.io/port: "9153"  # metrics 接口的端口
    prometheus.io/scrape: "true"  # 这个注解可以让prometheus自动发现
  creationTimestamp: "2022-08-13T11:17:30Z"
  labels:
    k8s-app: kube-dns
    kubernetes.io/cluster-service: "true"
    kubernetes.io/name: KubeDNS
  name: kube-dns
  namespace: kube-system
......
```

现在我们在之前创建的 redis 这个 Service 中添加上 `prometheus.io/scrape=true` 这个 annotation：prometheus-redis.yaml 

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: kube-mon
spec:
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9121"
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:4
        resources:
          requests:
            cpu: 100m
            memory: 100Mi
        ports:
        - containerPort: 6379
      - name: redis-exporter
        image: oliver006/redis_exporter:latest
        resources:
          requests:
            cpu: 100m
            memory: 100Mi
        ports:
        - containerPort: 9121
---
kind: Service
apiVersion: v1
metadata:
  name: redis
  namespace: kube-mon
  annotations:   # 加入annotation
    prometheus.io/scrape: "true"
    prometheus.io/port: "9121"
spec:
  selector:
    app: redis
  ports:
  - name: redis
    port: 6379
    targetPort: 6379
  - name: prom
    port: 9121
    targetPort: 9121
```

由于 redis 服务的 metrics 接口在 9121 这个 redis-exporter 服务上面，所以我们还需要添加一个 `prometheus.io/port=9121` 这样的 annotations，然后更新这个 Service：

```bash
[root@k8s-master prometheus]# kubectl apply -f prometheus-redis.yaml 
deployment.apps/redis unchanged
service/redis configured
```

更新完成后，去 Prometheus 查看 Targets 路径，可以看到 redis 服务自动出现在了 `kubernetes-endpoints` 这个任务下面：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904170736.png)

这样以后我们有了新的服务，服务本身提供了 `/metrics` 接口，我们就完全不需要用静态的方式去配置了，到这里我们就可以将之前配置的 redis 的静态配置去掉了。

## 参考

* https://www.qikqiak.com/k8s-book/docs/55.%E7%9B%91%E6%8E%A7Kubernetes%E5%B8%B8%E7%94%A8%E8%B5%84%E6%BA%90%E5%AF%B9%E8%B1%A1.html