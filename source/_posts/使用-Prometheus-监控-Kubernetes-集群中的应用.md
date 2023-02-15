---
title: 使用 Prometheus  监控 Kubernetes 集群中的应用
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-09-04 20:27:42
password:
summary: 使用 Prometheus  监控 Kubernetes 集群中的应用
tags:
	- Kubernetes
	- Prometheus
categories: Kubernetes
---

# 使用 Prometheus  监控 Kubernetes 集群中的应用

前面`Prometheus`的数据指标是通过一个公开的 HTTP(S) 数据接口获取到的，我们不需要单独安装监控的 agent，只需要暴露一个 metrics 接口，Prometheus 就会定期去拉取数据；对于一些普通的 HTTP 服务，我们完全可以直接重用这个服务，添加一个`/metrics`接口暴露给 Prometheus；而且获取到的指标数据格式是非常易懂的，不需要太高的学习成本。

现在很多服务从一开始就内置了一个`/metrics`接口，比如 Kubernetes 的各个组件、istio 服务网格都直接提供了数据指标接口。有一些服务即使没有原生集成该接口，也完全可以使用一些 exporter 来获取到指标数据，比如 mysqld_exporter、node_exporter，这些 exporter 就有点类似于传统监控服务中的 agent，作为一直服务存在，用来收集目标服务的指标数据然后直接暴露给 Prometheus。



## 普通应用监控

对于普通应用只需要能够提供一个满足 prometheus 格式要求的 `/metrics` 接口就可以让 Prometheus 来接管监控，比如 Kubernetes 集群中非常重要的 CoreDNS 插件，一般默认情况下就开启了 `/metrics` 接口：

```bash
[root@k8s-master prometheus]# kubectl get cm coredns -n kube-system -o yaml
apiVersion: v1
data:
  Corefile: |
    .:53 {
        errors
        health {
           lameduck 5s
        }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        prometheus :9153
        forward . /etc/resolv.conf {
           max_concurrent 1000
        }
        cache 30
        loop
        reload
        loadbalance
    }
kind: ConfigMap
metadata:
  creationTimestamp: "2022-08-13T11:17:30Z"
  managedFields:
  - apiVersion: v1
    fieldsType: FieldsV1
    fieldsV1:
      f:data:
        .: {}
        f:Corefile: {}
    manager: kubeadm
    operation: Update
    time: "2022-08-13T11:17:30Z"
  name: coredns
  namespace: kube-system
  resourceVersion: "225"
  uid: c643c27a-210e-4f0e-8897-7fa33cf78626
```

上面 ConfigMap 中 `prometheus :9153` 就是开启 prometheus 的插件：

```bash
[root@k8s-master prometheus]# kubectl get pods -n kube-system -l k8s-app=kube-dns -o wide
NAME                       READY   STATUS    RESTARTS   AGE   IP                NODE         NOMINATED NODE   READINESS GATES
coredns-5897cd56c4-kqfn2   1/1     Running   14         20d   192.168.235.243   k8s-master   <none>           <none>
coredns-5897cd56c4-wcgdh   1/1     Running   14         20d   192.168.235.240   k8s-master   <none>           <none>
```

我们可以先尝试手动访问下 `/metrics` 接口，如果能够手动访问到那证明接口是没有任何问题的：

```bash
[root@k8s-master prometheus]# curl http://192.168.235.243:9153/metrics
# HELP coredns_build_info A metric with a constant '1' value labeled by version, revision, and goversion from which CoreDNS was built.
# TYPE coredns_build_info gauge
coredns_build_info{goversion="go1.14.4",revision="f59c03d",version="1.7.0"} 1
# HELP coredns_cache_entries The number of elements in the cache.
# TYPE coredns_cache_entries gauge
coredns_cache_entries{server="dns://:53",type="denial"} 10
coredns_cache_entries{server="dns://:53",type="success"} 1
# HELP coredns_cache_misses_total The count of cache misses.
# TYPE coredns_cache_misses_total counter
coredns_cache_misses_total{server="dns://:53"} 11
# HELP coredns_dns_request_duration_seconds Histogram of the time (in seconds) each request took.
# TYPE coredns_dns_request_duration_seconds histogram
coredns_dns_request_duration_seconds_bucket{server="dns://:53",type="A",zone=".",le="0.00025"} 3
coredns_dns_request_duration_seconds_bucket{server="dns://:53",type="A",zone=".",le="0.0005"} 3
coredns_dns_request_duration_seconds_bucket{server="dns://:53",type="A",zone=".",le="0.001"} 3
coredns_dns_request_duration_seconds_bucket{server="dns://:53",type="A",zone=".",le="0.002"} 4
coredns_dns_request_duration_seconds_bucket{server="dns://:53",type="A",zone=".",le="0.004"} 4
......
```

我们可以看到可以正常访问到，从这里可以看到 CoreDNS 的监控数据接口是正常的了，然后我们就可以将这个 `/metrics` 接口配置到 `prometheus.yml` 中去了，直接加到默认的 prometheus 这个 `job` 下面：prometheus-cm.yaml

```yaml
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
```

当然，我们这里只是一个很简单的配置，`scrape_configs` 下面可以支持很多参数，例如：

- `basic_auth` 和 `bearer_token`：比如我们提供的 `/metrics` 接口需要 basic 认证的时候，通过传统的用户名/密码或者在请求的 header 中添加对应的 token 都可以支持
- `kubernetes_sd_configs` 或 `consul_sd_configs`：可以用来自动发现一些应用的监控数据

现在我们重新更新这个 ConfigMap 资源对象：

```bash
[root@k8s-master prometheus]# kubectl apply -f prometheus-cm.yaml 
configmap/prometheus-config configured
```

现在 Prometheus 的配置文件内容已经更改了，隔一会儿被挂载到 Pod 中的 prometheus.yml 文件也会更新，由于我们之前的 Prometheus 启动参数中添加了 `--web.enable-lifecycle` 参数，所以现在我们只需要执行一个 `reload` 命令即可让配置生效：

```bash
[root@k8s-master prometheus]# kubectl get pods -n kube-mon -o wide
NAME                          READY   STATUS    RESTARTS   AGE   IP                NODE        NOMINATED NODE   READINESS GATES
prometheus-75d4666dcd-vlth8   1/1     Running   0          28m   192.168.169.155   k8s-node2   <none>           <none>

[root@k8s-master prometheus]# curl -X POST "http://192.168.169.155:9090/-/reload"
```

> **热更新**
>
> 由于 ConfigMap 通过 Volume 的形式挂载到 Pod 中去的热更新需要一定的间隔时间才会生效，所以需要稍微等一小会儿。



reload 这个 url 是一个 POST 请求，所以这里我们通过 service 的 CLUSTER-IP:PORT 就可以访问到这个重载的接口，这个时候我们再去看 Prometheus 的 Dashboard 中查看采集的目标数据： 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902221421.png)

可以看到我们刚刚添加的 coredns 这个任务已经出现了，然后同样的我们可以切换到 Graph 下面去，我们可以找到一些 CoreDNS 的指标数据，至于这些指标数据代表什么意义，一般情况下，我们可以去查看对应的 `/metrics` 接口，里面一般情况下都会有对应的注释。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902221611.png)



到这里我们就在 Prometheus 上配置了第一个 Kubernetes 应用。

## 使用 exporter 监控应用

有一些应用可能没有自带 `/metrics` 接口供 Prometheus 使用，在这种情况下，我们就需要利用 `exporter` 服务来为 Prometheus 提供指标数据了。Prometheus 官方为许多应用就提供了对应的 `exporter` 应用，也有许多第三方的实现，我们可以前往官方网站进行查看：[exporters](https://prometheus.io/docs/instrumenting/exporters/)，当然如果你的应用本身也没有 exporter 实现，那么就要我们自己想办法去实现一个 `/metrics` 接口了，只要你能提供一个合法的 `/metrics` 接口，Prometheus 就可以监控你的应用。

比如我们这里通过一个 [redis-exporter](https://github.com/oliver006/redis_exporter) 的服务来监控 redis 服务，对于这类应用，我们一般会以 `sidecar` 的形式和主应用部署在同一个 Pod 中，比如我们这里来部署一个 redis 应用，并用 redis-exporter 的方式来采集监控数据供 Prometheus 使用，如下资源清单文件：prometheus-redis.yaml

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

可以看到上面我们在 redis 这个 Pod 中包含了两个容器，一个就是 redis 本身的主应用，另外一个容器就是 redis_exporter。现在直接创建上面的应用：

```bash
[root@k8s-master prometheus]# kubectl apply -f prometheus-redis.yaml 
deployment.apps/redis created
service/redis created
```

创建完成后，我们可以看到 redis 的 Pod 里面包含有两个容器：

```bash
[root@k8s-master prometheus]# kubectl get pods -n kube-mon
NAME                          READY   STATUS    RESTARTS   AGE
prometheus-75d4666dcd-vlth8   1/1     Running   0          39m
redis-6468bf6c84-qmm2k        2/2     Running   0          45s

[root@k8s-master prometheus]# kubectl get svc -n kube-mon
NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)             AGE
prometheus   NodePort    10.96.146.110   <none>        9090:32640/TCP      35m
redis        ClusterIP   10.96.143.235   <none>        6379/TCP,9121/TCP   66s
```

我们可以通过 9121 端口来校验是否能够采集到数据：

```bash
[root@k8s-master prometheus]# curl 10.96.143.235:9121/metrics
# HELP go_gc_duration_seconds A summary of the pause duration of garbage collection cycles.
# TYPE go_gc_duration_seconds summary
go_gc_duration_seconds{quantile="0"} 0
go_gc_duration_seconds{quantile="0.25"} 0
go_gc_duration_seconds{quantile="0.5"} 0
go_gc_duration_seconds{quantile="0.75"} 0
go_gc_duration_seconds{quantile="1"} 0
go_gc_duration_seconds_sum 0
go_gc_duration_seconds_count 0
......
# HELP redis_up Information about the Redis instance
# TYPE redis_up gauge
redis_up 1
# HELP redis_uptime_in_seconds uptime_in_seconds metric
# TYPE redis_uptime_in_seconds gauge
redis_uptime_in_seconds 70
```

同样的，现在我们只需要更新 Prometheus 的配置文件：prometheus-cm.yaml 

```yaml
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
```

由于我们这里是通过 Service 去配置的 redis 服务，当然直接配置 Pod IP 也是可以的，因为和 Prometheus 处于同一个 namespace，所以我们直接使用 servicename 即可。配置文件更新后，重新加载：

```bash
[root@k8s-master prometheus]# kubectl apply -f prometheus-cm.yaml 
configmap/prometheus-config configured

# 隔一会儿执行reload操作
[root@k8s-master prometheus]# kubectl get svc -n kube-mon
NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)             AGE
prometheus   NodePort    10.96.146.110   <none>        9090:32640/TCP      40m
redis        ClusterIP   10.96.143.235   <none>        6379/TCP,9121/TCP   5m34s

[root@k8s-master prometheus]# curl -X POST "http://10.96.146.110:9090/-/reload"
```

这个时候我们再去看 Prometheus 的 Dashboard 中查看采集的目标数据： 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902222816.png)

可以看到配置的 redis 这个 job 已经生效了。切换到 Graph 下面可以看到很多关于 redis 的指标数据：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902222955.png)



我们选择任意一个指标，比如`redis_exporter_scrapes_total`，然后点击执行就可以看到对应的数据图表了： 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220902223203.png)

> **Note**
>
> 如果时间有问题，我们需要手动在 Graph 下面调整下时间



 prometheus-cm.yaml  内容如下：

```yaml
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
```



## 参考

* https://www.qikqiak.com/k8s-book/docs/53.%E7%9B%91%E6%8E%A7Kubernetes%E9%9B%86%E7%BE%A4%E5%BA%94%E7%94%A8.html