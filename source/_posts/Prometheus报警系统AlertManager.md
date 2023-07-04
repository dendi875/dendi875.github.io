---
title: Prometheus报警系统AlertManager
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2022-09-09 13:27:50
password:
summary: Prometheus报警系统AlertManager
tags:
	- Kubernetes
	- Prometheus
	- AlertManager
categories: Kubernetes
---

# Prometheus报警系统AlertManager

## AlertManager 简介

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220905151134.png)

Alertmanager 主要用于接收 Prometheus 发送的告警信息，它支持丰富的告警通知渠道，而且很容易做到告警信息进行去重，降噪，分组等，是一款前卫的告警通知系统。



通过在 Prometheus 中定义告警规则，Prometheus会周期性的对告警规则进行计算，如果满足告警触发条件就会向Alertmanager 发送告警信息。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220905151208.png)

在 Prometheus 中一条告警规则主要由以下几部分组成：

- 告警名称：用户需要为告警规则命名，当然对于命名而言，需要能够直接表达出该告警的主要内容
- 告警规则：告警规则实际上主要由 `PromQL` 进行定义，其实际意义是当表达式（PromQL）查询结果持续多长时间（During）后出发告警

在 Prometheus 中，还可以通过 Group（告警组）对一组相关的告警进行统一定义。Alertmanager 作为一个独立的组件，负责接收并处理来自 Prometheus Server 的告警信息。Alertmanager 可以对这些告警信息进行进一步的处理，比如当接收到大量重复告警时能够消除重复的告警信息，同时对告警信息进行分组并且路由到正确的通知方，Prometheus 内置了对邮件、Slack 多种通知方式的支持，同时还支持与 Webhook 的集成，以支持更多定制化的场景。例如，目前 Alertmanager 还不支持钉钉，用户完全可以通过 Webhook 与钉钉机器人进行集成，从而通过钉钉接收告警信息。同时 AlertManager 还提供了静默和告警抑制机制来对告警通知行为进行优化。



让`AlertManager`提供服务总的来说就下面3步： 

1. 安装和配置`AlertManger`

2. 配置`Prometheus`来和`AlertManager`通信

3. 在`Prometheus`中创建报警规则

## 安装和配置AlertManager

从官方文档 https://prometheus.io/docs/alerting/configuration/ 中我们可以看到下载 AlertManager 二进制文件后，可以通过下面的命令运行：

```bash
$ ./alertmanager --config.file=simple.yml
```

其中 `-config.file` 参数是用来指定对应的配置文件的，由于我们这里同样要运行到 Kubernetes 集群中来，所以我们使用 Docker 镜像的方式来安装，使用的镜像是：`prom/alertmanager:v0.20.0`。

> **Note**
>
> 为了方便管理，我们将监控相关的所有资源对象都安装在 `kube-mon` 这个 namespace 下面，没有的话可以提前创建。

把用到的资源文件统一放到 `alertmanager` 目录下

```bash
[root@k8s-master ~]# mkdir ~/alertmanager && cd alertmanager
```

首先，指定配置文件，同样的，我们这里使用一个 ConfigMap 资源对象：alertmanager-config.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alert-config
  namespace: kube-mon
data:
  config.yml: |-
    global:
      # 当alertmanager持续多长时间未接收到告警后标记告警状态为 resolved
      resolve_timeout: 5m
      # 配置邮件发送信息
      smtp_smarthost: 'smtp.163.com:25'
      smtp_from: 'dendi875@163.com'
      smtp_auth_username: 'dendi875@163.com'
      smtp_auth_password: '<邮箱密码>'
      smtp_hello: '163.com'
      smtp_require_tls: false
    # 所有报警信息进入后的根路由，用来设置报警的分发策略
    route:
      # 这里的标签列表是接收到报警信息后的重新分组标签，例如，接收到的报警信息里面有许多具有 cluster=A 和 alertname=LatncyHigh 这样的标签的报警信息将会批量被聚合到一个分组里面
      group_by: ['alertname', 'cluster']
      # 当一个新的报警分组被创建后，需要等待至少 group_wait 时间来初始化通知，这种方式可以确保您能有足够的时间为同一分组来获取多个警报，然后一起触发这个报警信息。
      group_wait: 30s

      # 相同的group之间发送告警通知的时间间隔
      group_interval: 30s

      # 如果一个报警信息已经发送成功了，等待 repeat_interval 时间来重新发送他们，不同类型告警发送频率需要具体配置
      repeat_interval: 1h

      # 默认的receiver：如果一个报警没有被一个route匹配，则发送给默认的接收器
      receiver: default

      # 上面所有的属性都由所有子路由继承，并且可以在每个子路由上进行覆盖。
      routes:
      - receiver: email
        group_wait: 10s
        match:
          team: node
    receivers:
    - name: 'default'
      email_configs:
      - to: '943299849@qq.com'
        send_resolved: true  # 接受告警恢复的通知
    - name: 'email'
      email_configs:
      - to: '943299849@qq.com'
        send_resolved: true
```

> **Note**
>
> 分组机制可以将详细的告警信息合并成一个通知，在某些情况下，比如由于系统宕机导致大量的告警被同时触发，在这种情况下分组机制可以将这些被触发的告警合并为一个告警通知，避免一次性接受大量的告警通知，而无法对问题进行快速定位。

这是 AlertManager 的配置文件，我们先直接创建这个 ConfigMap 资源对象：

```bash
[root@k8s-master alertmanager]# kubectl apply -f alertmanager-config.yaml 
configmap/alert-config created
```

然后配置 AlertManager 的容器，直接使用一个 Deployment 来进行管理即可，对应的 YAML 资源声明如下：alertmanager-deploy.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertmanager
  namespace: kube-mon
  labels:
    app: alertmanager
spec:
  selector:
    matchLabels:
      app: alertmanager
  template:
    metadata:
      labels:
        app: alertmanager
    spec:
      volumes:
      - name: alertcfg
        configMap:
          name: alert-config
      containers:
      - name: alertmanager
        image: prom/alertmanager:v0.20.0
        imagePullPolicy: IfNotPresent
        args:
        - "--config.file=/etc/alertmanager/config.yml"
        ports:
        - containerPort: 9093
          name: http
        volumeMounts:
        - mountPath: "/etc/alertmanager"
          name: alertcfg
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 100m
            memory: 256Mi
```

这里我们将上面创建的 `alert-config` 这个 ConfigMap 资源对象以 Volume 的形式挂载到 `/etc/alertmanager` 目录下去，然后在启动参数中指定了配置文件 `--config.file=/etc/alertmanager/config.yml`，然后我们可以来创建这个资源对象：

```bash
[root@k8s-master alertmanager]# kubectl apply -f alertmanager-deploy.yaml 
deployment.apps/alertmanager created
```

为了可以访问到 AlertManager，同样需要我们创建一个对应的 Service 对象：alertmanager-svc.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: alertmanager
  namespace: kube-mon
  labels:
    app: alertmanager
spec:
  selector:
    app: alertmanager
  type: NodePort
  ports:
    - name: web
      port: 9093
      targetPort: http
```

使用 NodePort 类型也是为了方便测试，创建上面的 Service 这个资源对象：

```bash
[root@k8s-master alertmanager]# kubectl apply -f alertmanager-svc.yaml 
service/alertmanager created
```

## 配置Prometheus来和AlertManager通信

AlertManager 的容器启动起来后，我们还需要在 Prometheus 中配置下 AlertManager 的地址，让 Prometheus 能够访问到 AlertManager，在 Prometheus 的 ConfigMap 资源清单中添加如下配置：prometheus-cm.yaml 

```yaml
alerting:
  alertmanagers:
    - static_configs:
      - targets: ["alertmanager:9093"]
```

更新这个资源对象后，稍等一小会儿，执行 reload 操作即可。

```bash
[root@k8s-master prometheus]# kubectl apply -f prometheus-cm.yaml 
configmap/prometheus-config configured

# 隔一会儿执行reload操作
[root@k8s-master prometheus]# curl -X POST "http://10.96.146.110:9090/-/reload"
```

更新完成后，我们查看 Pod 已经是 Running 状态了：

```bash
[root@k8s-master prometheus]# kubectl get pods -n kube-mon
NAME                            READY   STATUS      RESTARTS   AGE
alertmanager-7c96c8fc4b-v4wjf   1/1     Running     0          8m54s
grafana-869db94654-wrpdg        1/1     Running     1          17h
node-exporter-bl6nb             1/1     Running     3          2d16h
node-exporter-fwzlt             1/1     Running     3          2d16h
node-exporter-pcr9w             1/1     Running     3          2d16h
prometheus-75d4666dcd-vlth8     1/1     Running     3          2d17h
redis-6468bf6c84-qmm2k          2/2     Running     6          2d17h
```

## 在Prometheus中创建报警规则

现在我们只是把 AlertManager 容器运行起来了，也和 Prometheus 进行了关联，但是现在我们并不知道要做什么报警，因为没有任何地方告诉我们要报警，所以我们还需要配置一些报警规则来告诉我们对哪些数据进行报警。

警报规则允许你基于 Prometheus 表达式语言的表达式来定义报警报条件，并在触发警报时发送通知给外部的接收者。

同样在 Prometheus 的配置文件中添加如下报警规则配置：

```yaml
rule_files:
- /etc/prometheus/rules.yml
```

其中 `rule_files` 就是用来指定报警规则的，这里我们同样将 `rules.yml` 文件用 ConfigMap 的形式挂载到 `/etc/prometheus` 目录下面即可：

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
      evaluation_interval: 30s  # 默认情况下每分钟对告警规则进行计算
    alerting:
      alertmanagers:
      - static_configs:
        - targets: ["alertmanager:9093"]
    rule_files:
    - /etc/prometheus/rules.yml
  ...... # 省略prometheus其他部分
  rules.yml: |
    groups:
    - name: test-node-mem
      rules:
      - alert: NodeMemoryUsage  # (CPU使用率大于20%)的话，那么每5分钟我们就可以收到一条报警邮件
        expr: (node_memory_MemTotal_bytes - (node_memory_MemFree_bytes + node_memory_Buffers_bytes + node_memory_Cached_bytes)) / node_memory_MemTotal_bytes * 100 > 20
        for: 2m
        labels:
          team: node
        annotations:
          summary: "{{$labels.instance}}: High Memory usage detected"
          description: "{{$labels.instance}}: Memory usage is above 20% (current value is: {{ $value }}"
```

上面我们定义了一个名为 `NodeMemoryUsage` 的报警规则，一条报警规则主要由以下几部分组成：

- `alert`：告警规则的名称
- `expr`：是用于进行报警规则 PromQL 查询语句
- `for`：评估等待时间（Pending Duration），用于表示只有当触发条件持续一段时间后才发送告警，在等待期间新产生的告警状态为`pending`
- `labels`：自定义标签，允许用户指定额外的标签列表，把它们附加在告警上
- `annotations`：指定了另一组标签，它们不被当做告警实例的身份标识，它们经常用于存储一些额外的信息，用于报警信息的展示之类的

> **for 属性**
>
> 这个参数主要用于降噪，很多类似响应时间这样的指标都是有抖动的，通过指定 `Pending Duration`，我们可以过滤掉这些瞬时抖动，可以让我们能够把注意力放在真正有持续影响的问题上。

为了让告警信息具有更好的可读性，Prometheus 支持模板化 `label` 和 `annotations` 中的标签的值，通过 `$labels.变量` 可以访问当前告警实例中指定标签的值，`$value` 则可以获取当前 PromQL 表达式计算的样本值。

为了方便演示，我们将的表达式判断报警临界值设置为 20，重新更新 ConfigMap 资源对象，由于我们在 Prometheus 的 Pod 中已经通过 Volume 的形式将 prometheus-config 这个一个 ConfigMap 对象挂载到了 `/etc/prometheus` 目录下面，所以更新后，该目录下面也会出现 `rules.yml` 文件，所以前面配置的 `rule_files` 路径也是正常的，更新完成后，重新执行 reload 操作，这个时候我们去 Prometheus 的 Dashboard 中切换到 alerts 路径下面就可以看到有报警配置规则的数据了：

更新 Prometheus 并 reload：

```bash
[root@k8s-master prometheus]# kubectl apply -f prometheus-cm.yaml 
configmap/prometheus-config configured

# 隔一会儿执行reload操作
[root@k8s-master prometheus]# curl -X POST "http://10.96.146.110:9090/-/reload"
```

确认`/etc/prometheus`目录下面有 rules.yml 文件

```bash
[root@k8s-master prometheus]# kubectl get pod -n kube-mon -l app=prometheus            
NAME                          READY   STATUS    RESTARTS   AGE
prometheus-75d4666dcd-vlth8   1/1     Running   3          2d18h

[root@k8s-master prometheus]# kubectl exec  -it prometheus-75d4666dcd-vlth8 -n kube-mon  -- /bin/sh
/prometheus # ls /etc/prometheus/
prometheus.yml  rules.yml
```

查看报警配置规则的数据：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220905155534.png)

页面中出现了我们刚刚定义的报警规则信息，而且报警信息中还有状态显示，一个报警信息在生命周期内有下面3种状态：

- `pending`: 表示在设置的阈值时间范围内被激活了
- `firing`: 表示超过设置的阈值时间被激活了
- `inactive`: 表示当前报警信息处于非活动状态

同时对于已经 `pending` 或者 `firing` 的告警，Prometheus 也会将它们存储到时间序列`ALERTS{}`中。当然我们也可以通过表达式去查询告警实例：

```
ALERTS{alertname="<alert name>", alertstate="pending|firing", <additional alert labels>}
```

样本值为`1`表示当前告警处于活动状态（pending 或者 firing），当告警从活动状态转换为非活动状态时，样本值则为0。

我们这里的状态现在是 `firing` 就表示这个报警已经被激活了，我们这里的报警信息有一个 `team=node` 这样的标签，而最上面我们配置 alertmanager 的时候就有如下的路由配置信息了：alertmanager-config.yaml

```yaml
routes:
- receiver: email
  group_wait: 10s
  match:
    team: node
```

我们可以通过 NodePort 的形式去访问到 AlertManager 的 Dashboard 页面：

```bash
[root@k8s-master alertmanager]# kubectl get svc -n kube-mon
NAME           TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)             AGE
alertmanager   NodePort    10.96.242.35    <none>        9093:30265/TCP      73m
```

然后通过 `<任一Node节点>:30265` 进行访问，我们就可以查看到 AlertManager 的 Dashboard 页面，在这个页面中我们可以进行一些操作，比如过滤、分组等等，里面还有两个新的概念：`Inhibition(抑制)` 和 `Silences(静默)`。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220905163918.png)

- Inhibition：如果某些其他警报已经触发了，则对于某些警报，Inhibition 是一个抑制通知的概念。例如：一个警报已经触发，它正在通知整个集群是不可达的时，Alertmanager 则可以配置成关心这个集群的其他警报无效。这可以防止与实际问题无关的数百或数千个触发警报的通知，Inhibition 需要通过上面的配置文件进行配置。
- Silences：静默是一个非常简单的方法，可以在给定时间内简单地忽略所有警报。Silences 基于 matchers配置，类似路由树。来到的警告将会被检查，判断它们是否和活跃的 Silences 相等或者正则表达式匹配。如果匹配成功，则不会将这些警报发送给接收者。

由于全局配置中我们配置的 `repeat_interval: 1h`，所以正常来说，上面的测试报警如果一直满足报警条件(内存使用率大于20%)的话，那么每1小时我们就可以收到一条报警邮件。

一条告警产生后，还要经过 Alertmanager 的分组、抑制处理、静默处理、去重处理和降噪处理最后再发送给接收者。这个过程中可能会因为各种原因会导致告警产生了却最终没有进行通知，可以通过下图了解整个告警的生命周期：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220905164016.png)

## FQA

* 为什么没有收到邮件？

alertmanager-config.yaml 文件中邮箱账号和密码要替换成自己的，并且 AlertManager 和 Prometheus 一样也支持 `reload`操作，修改了 AlertManager 配置文件之后也要执行 reload

```bash
[root@k8s-master ~]# kubectl get svc -n kube-mon
NAME           TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)             AGE
alertmanager   NodePort    10.96.242.35    <none>        9093:30265/TCP      4h20m
grafana        NodePort    10.96.179.102   <none>        3000:30907/TCP      26h
prometheus     NodePort    10.96.146.110   <none>        9090:32640/TCP      2d21h
redis          ClusterIP   10.96.143.235   <none>        6379/TCP,9121/TCP   2d21h

# 通过 9093 来执行 AlertManager 的reload操作
[root@k8s-master ~]# curl -X POST "http://10.96.242.35:9093/-/reload" 
```

## 参考

* https://www.qikqiak.com/k8s-book/docs/57.AlertManager%E7%9A%84%E4%BD%BF%E7%94%A8.html