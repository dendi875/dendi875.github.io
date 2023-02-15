---
title: Kubernetes 安装Grafana及使用
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-09-07 19:45:30
password:
summary:  Kubernetes 安装Grafana及使用
tags:
  - Kubernetes
  - Grafana
categories: Kubernetes
---

# Kubernetes 安装Grafana及使用

我们可以使用 Prometheus 采集了 Kubernetes 集群中的一些监控数据指标，我们也使用 promQL 语句查询出了一些数据，并且在 Prometheus 的 Dashboard 中进行了展示，但是明显可以感觉到 Prometheus 的图表功能相对较弱，所以一般情况下我们会一个第三方的工具来展示这些数据，今天我们要和大家使用到的就是 [Grafana](http://grafana.com/)。

Grafana 是一个可视化面板，有着非常漂亮的图表和布局展示，功能齐全的度量仪表盘和图形编辑器，支持 Graphite、zabbix、InfluxDB、Prometheus、OpenTSDB、Elasticsearch 等作为数据源，比 Prometheus 自带的图表展示功能强大太多，更加灵活，有丰富的插件，功能更加强大。



## 安装

我们将 grafana 安装到 Kubernetes 集群中，第一步去查看 grafana 的 docker 镜像的介绍，我们可以在 dockerhub 上去搜索，也可以在官网去查看相关资料，镜像地址如下：https://hub.docker.com/r/grafana/grafana/，我们可以看到介绍中运行 grafana 容器的命令非常简单：

```bash
$ docker run -d --name=grafana -p 3000:3000 grafana/grafana
```

但是还有一个需要注意的是 Changelog 中 v5.1.0 版本的更新介绍：

```
Major restructuring of the container
Usage of chown removed
File permissions incompatibility with previous versions
user id changed from 104 to 472
group id changed from 107 to 472
Runs as the grafana user by default (instead of root)
All default volumes removed
```

特别需要注意第3条，userid 和 groupid 都有所变化，所以我们在运行的容器的时候需要注意这个变化。

> **Note**
>
> 为了方便管理，我们将监控相关的所有资源对象都安装在 `kube-mon` 这个 namespace 下面，没有的话可以提前创建。

把用到的资源文件统一放到 `grafana` 目录下

``` shell
mkdir ~/grafana && cd grafana
```

现在我们将这个容器转化成 Kubernetes 中的 Pod：grafana-deploy.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: kube-mon
  labels:
    app: grafana
spec:
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:5.3.4
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
          name: grafana
        env:
        - name: GF_SECURITY_ADMIN_USER
          value: admin
        - name: GF_SECURITY_ADMIN_PASSWORD
          value: admin321
        readinessProbe:
          failureThreshold: 10
          httpGet:
            path: /api/health
            port: 3000
            scheme: HTTP
          initialDelaySeconds: 60
          periodSeconds: 10
          successThreshold: 1
          timeoutSeconds: 30
        livenessProbe:
          failureThreshold: 3
          httpGet:
            path: /api/health
            port: 3000
            scheme: HTTP
          periodSeconds: 10
          successThreshold: 1
          timeoutSeconds: 1
        resources:
          limits:
            cpu: 100m
            memory: 256Mi
          requests:
            cpu: 100m
            memory: 256Mi
        volumeMounts:
        - mountPath: /var/lib/grafana
          subPath: grafana
          name: storage
      securityContext:
        fsGroup: 472
        runAsUser: 472
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: grafana
```

我们`grafana/grafana:5.3.4`镜像，然后添加了监控检查、资源声明，另外两个比较重要的环境变量`GF_SECURITY_ADMIN_USER`和`GF_SECURITY_ADMIN_PASSWORD`，用来配置 grafana 的管理员用户和密码的，由于 grafana 将 dashboard、插件这些数据保存在`/var/lib/grafana`这个目录下面的，所以我们这里如果需要做数据持久化的话，就需要针对这个目录进行 volume 挂载声明，其他的和我们之前的 Deployment 没什么区别，由于上面我们刚刚提到的 Changelog 中 grafana 的 userid 和 groupid 有所变化，所以我们这里需要增加一个`securityContext`的声明来进行声明。

当然如果要使用一个 pvc 对象来持久化数据，我们就需要添加一个可用的 pv 供 pvc 绑定使用：grafana-volume.yaml

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: grafana
spec:
  capacity:
    storage: 1Gi
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Recycle
  nfs:
    server: 172.31.0.2 # NFS 服务器地址
    path: /nfs/data/ # NFS 服务器共享的目录
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: grafana
  namespace: kube-mon
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

最后，我们需要对外暴露 grafana 这个服务，所以我们需要一个对应的 Service 对象，当然用 NodePort 或者再建立一个 ingress 对象都是可行的：grafana-svc.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: kube-mon
  labels:
    app: grafana
spec:
  type: NodePort
  ports:
    - port: 3000
  selector:
    app: grafana
```

现在我们直接创建上面的这些资源对象：

```bash
[root@k8s-master grafana]# kubectl create -f grafana-volume.yaml 
persistentvolume/grafana created
persistentvolumeclaim/grafana created
[root@k8s-master grafana]# kubectl create -f grafana-deploy.yaml 
deployment.apps/grafana created
[root@k8s-master grafana]# kubectl create -f grafana-svc.yaml 
service/grafana created
```

创建完成后，我们可以查看 grafana 对应的 Pod 是否正常：

```bash
[root@k8s-master grafana]# kubectl get pods -n kube-mon -l app=grafana         
NAME                       READY   STATUS             RESTARTS   AGE
grafana-869db94654-m2qpj   0/1     CrashLoopBackOff   1          104s
```

我们可以看到这里的状态是`CrashLoopBackOff`，并没有正常启动，我们查看下这个 Pod 的日志：

```bash
[root@k8s-master grafana]# kubectl logs -f grafana-869db94654-m2qpj -n kube-mon
GF_PATHS_DATA='/var/lib/grafana' is not writable.
You may have issues with file permissions, more information here: http://docs.grafana.org/installation/docker/#migration-from-a-previous-version-of-the-docker-container-to-5-1-or-later
mkdir: cannot create directory '/var/lib/grafana/plugins': Permission denied
```

> 上面的错误是在`5.1`版本之后才会出现的，当然你也可以使用之前的版本来规避这个问题。

可以看到是日志中错误很明显就是`/var/lib/grafana`目录的权限问题，这还是因为5.1版本后 groupid 更改了引起的问题，我们这里增加了`securityContext`，但是我们将目录`/var/lib/grafana`挂载到 pvc 这边后目录的拥有者并不是上面的 grafana(472)这个用户了，所以我们需要更改下这个目录的所属用户，这个时候我们可以利用一个 Job 任务去更改下该目录的所属用户：grafana-chown-job.yaml

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: grafana-chown
  namespace: kube-mon
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: grafana-chown
        command: ["chown", "-R", "472:472", "/var/lib/grafana"]
        image: busybox
        imagePullPolicy: IfNotPresent
        volumeMounts:
        - name: storage
          subPath: grafana
          mountPath: /var/lib/grafana
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: grafana
```

上面我们利用一个 busybox 镜像将`/var/lib/grafana`目录更改成了`472`这个 user 和 group，不过还需要注意的是下面的 volumeMounts 和 volumes 需要和上面的 Deployment 对应上。

现在我们删除之前创建的 Deployment 对象，重新创建：

```bash
[root@k8s-master grafana]# kubectl delete -f grafana-deploy.yaml 
deployment.apps "grafana" deleted

[root@k8s-master grafana]# kubectl create -f grafana-deploy.yaml 
deployment.apps/grafana created

[root@k8s-master grafana]# kubectl create -f grafana-chown-job.yaml 
job.batch/grafana-chown created
```

重新执行完成后，可以查看下上面的创建的资源对象是否正确了：

```bash
[root@k8s-master grafana]# kubectl get pod -n kube-mon
NAME                          READY   STATUS      RESTARTS   AGE
grafana-869db94654-gxgjk      1/1     Running     2          102s
grafana-chown-jwkhb           0/1     Completed   0          86s
```

我们可以看到有一个状态为`Completed`的 Pod，这就是上面我们用来更改 grafana 目录权限的 Pod，是一个 Job 任务，所以执行成功后就退出了，状态变成了`Completed`，而上面的 grafana 的 Pod 也已经是`Running`状态了，可以查看下该 Pod 的日志确认下：

```bash
[root@k8s-master grafana]# kubectl logs -f grafana-869db94654-gxgjk -n kube-mon
t=2022-09-04T09:34:26+0000 lvl=info msg="Starting Grafana" logger=server version=5.3.4 commit=69630b9 compiled=2018-11-13T12:19:12+0000
t=2022-09-04T09:34:26+0000 lvl=info msg="Config loaded from" logger=settings file=/usr/share/grafana/conf/defaults.ini
t=2022-09-04T09:34:26+0000 lvl=info msg="Config loaded from" logger=settings file=/etc/grafana/grafana.ini
......
```

看到上面的日志信息就证明我们的 grafana 的 Pod 已经正常启动起来了。这个时候我们可以查看 Service 对象：

```bash
[root@k8s-master grafana]# kubectl get svc -n kube-mon -l app=grafana
NAME      TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
grafana   NodePort   10.96.179.102   <none>        3000:30907/TCP   8m50s
```

现在我们就可以在浏览器中使用`http://<任意节点IP:30907>`来访问 grafana 这个服务了

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-grafana-1.png)

由于上面我们配置了管理员的，所以第一次打开的时候会跳转到登录界面，然后就可以用上面我们配置的两个环境变量的值来进行登录了，登录完成后就可以进入到下面 Grafana 的首页

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904174238.png)



## 配置

在上面的首页中我们可以看到已经安装了 Grafana，接下来点击`Add data source`进入添加数据源界面。

### 数据源

我们这个地方配置的数据源是 Prometheus，所以选择这个 Type 即可，给改数据源添加一个 name：prometheus-ds，最主要的是下面`HTTP`区域是配置数据源的访问模式。

访问模式是用来控制如何处理对数据源的请求的：

- 服务器(Server)访问模式（默认）：所有请求都将从浏览器发送到 Grafana 后端的服务器，后者又将请求转发到数据源，通过这种方式可以避免一些跨域问题，其实就是在 Grafana 后端做了一次转发，需要从Grafana 后端服务器访问该 URL。
- 浏览器(Browser)访问模式：所有请求都将从浏览器直接发送到数据源，但是有可能会有一些跨域的限制，使用此访问模式，需要从浏览器直接访问该 URL。

由于我们这个地方 Prometheus 通过 NodePort 的方式的对外暴露的服务，所以我们这个地方是不是可以使用浏览器访问模式直接访问 Prometheus 的外网地址，但是这种方式显然不是最好的，相当于走的是外网，而我们这里 Prometheus 和 Grafana 都处于 kube-mon 这同一个 namespace 下面，是不是在集群内部直接通过 DNS 的形式就可以访问了，而且还都是走的内网流量，所以我们这里用服务器访问模式显然更好，数据源地址：`http://prometheus:9090`（因为在同一个 namespace 下面所以直接用 Service 名也可以），然后其他的配置信息就根据实际情况了，比如 Auth 认证，我们这里没有，所以跳过即可，点击最下方的`Save & Test`提示成功证明我们的数据源配置正确：

```bash
[root@k8s-master grafana]# kubectl get svc -n kube-mon
NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)             AGE
grafana      NodePort    10.96.179.102   <none>        3000:30907/TCP      30m
prometheus   NodePort    10.96.146.110   <none>        9090:32640/TCP      44h
redis        ClusterIP   10.96.143.235   <none>        6379/TCP,9121/TCP   43h
```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904180103.png)

数据源添加完成后，就可以来添加 Dashboard 了。

### Dashboard

同样，切换到主页，我们可以根据自己的需求手动新建一个 Dashboard，除此之外，grafana 的官方网站上还有很多公共的 Dashboard 可以供我们使用，我们这里可以使用[Kubernetes cluster monitoring (via Prometheus)(dashboard id 为162)](https://grafana.com/dashboards/162/revisions)这个 Dashboard 来展示 Kubernetes 集群的监控信息，在左侧侧边栏 Create 中点击`import`导入： 

![image-20220904180506120](/Users/zhangquan/Library/Application Support/typora-user-images/image-20220904180506120.png)

我们可以将上面编号`162`的 dashboard 下载到本地，然后这里重新上传即可，也可以在上面的文本框中直接输入`162`编号回车即可，导入这个 dashboard： 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904180639.png)

需要注意的是在执行上面的 import 之前要记得选择我们的`prometheus-ds`这个名字的数据源，执行`import`操作，就可以进入到 dashboard 页面： 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904180822.png)

我们可以看到 dashboard 页面上出现了很多漂亮的图表，但是看上去数据不正常，这是因为这个 dashboard 里面需要的数据指标名称和我们 Prometheus 里面采集到的数据指标不一致造成的，比如，第一个`Cluster memory usage(集群内存使用情况)`，我们可以点击标题 -> Edit，进入编辑这个图表的编辑页面：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904180923.png)

进入编辑页面我们就可以看到这个图表的查询语句：

> (sum(node_memory_MemTotal) - sum(node_memory_MemFree+node_memory_Buffers+node_memory_Cached) ) / sum(node_memory_MemTotal) * 100



![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904181041.png)

这就是我们之前在 Prometheus 里面查询的`promQL`语句，我们可以将上面的查询语句复制到 Prometheus 的 Graph 页面进行查询，其实可以预想到是没有对应的数据的。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904181334.png)

因为我们用`node_exporter`采集到的数据指标不是`node_memory_MemTotal`关键字，而是`node_memory_MemTotal_bytes`

![image-20220904181527134](/Users/zhangquan/Library/Application Support/typora-user-images/image-20220904181527134.png)



将上面的`promQL`语句做相应的更改：

> ```
> (sum(node_memory_MemTotal_bytes) - sum(node_memory_MemFree_bytes + node_memory_Buffers_bytes+node_memory_Cached_bytes)) / sum(node_memory_MemTotal_bytes) * 100
> ```

这个语句的意思就是`(整个集群的内存-(整个集群剩余的内存以及Buffer和Cached))/整个集群的内存`，简单来说就是总的集群内存使用百分比。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904181735.png)

可以看到 Prometheus 可以查到数据了。

将上面 grafana 的`promQL`语句替换掉，就可以看到图表正常了：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904182227.png)

同样的，我们可以更改后面的 CPU 和 FileSystem 的使用

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904182813.png)

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904183812.png)

同样下面的`Pod CPU Usage`用来展示 Pod CPU 的使用情况，对应的`promQL`语句如下，根据 pod_name 来进行统计：

```bash
sum by (pod)( rate(container_cpu_usage_seconds_total{image!=""}[1m] ) )
```

按照上面的方法替换 grafana 中的 dashboard 图表中的查询语句： 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904184335.png)

其他的也按照我们的实际需求重新编辑下就可以，下图是最终整个 dashboard 的效果图： 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904185720.png)

最后要记得保存这个 dashboard，除此之外，我们也可以前往 grafana dashboard 的页面去搜索其他的关于 Kubernetes 的监控页面，地址：https://grafana.com/dashboards，比如id 为747和741的这两个 dashboard。

## 插件

我们也可以安装一些其他插件，比如 grafana 就有一个专门针对 Kubernetes 集群监控的插件：[grafana-kubernetes-app](https://grafana.com/plugins/grafana-kubernetes-app)，但是该插件很久没有更新了，这里我们介绍一个功能更加强大的插件 [DevOpsProdigy KubeGraf](https://github.com/devopsprodigy/kubegraf/)，它是 Grafana 官方的 [Kubernetes 插件](https://grafana.com/plugins/grafana-kubernetes-app) 的升级版本，该插件可以用来可视化和分析 Kubernetes 集群的性能，通过各种图形直观的展示了 Kubernetes 集群的主要服务的指标和特征，还可以用于检查应用程序的生命周期和错误日志。

要安装这个插件，需要到 grafana 的 Pod 里面去执行安装命令：

```bash
[root@k8s-master ~]# kubectl get pods -n kube-mon -l app=grafana
NAME                       READY   STATUS    RESTARTS   AGE
grafana-869db94654-gxgjk   1/1     Running   3          4h4m

[root@k8s-master ~]# kubectl exec -it grafana-869db94654-gxgjk -n kube-mon /bin/bash
kubectl exec [POD] [COMMAND] is DEPRECATED and will be removed in a future version. Use kubectl exec [POD] -- [COMMAND] instead.
grafana@grafana-869db94654-gxgjk:/usr/share/grafana$ grafana-cli plugins install devopsprodigy-kubegraf-app
installing devopsprodigy-kubegraf-app @ 1.4.2
from url: https://grafana.com/api/plugins/devopsprodigy-kubegraf-app/versions/1.4.2/download
into: /var/lib/grafana/plugins

✔ Installed devopsprodigy-kubegraf-app successfully 

Restart grafana after installing plugins . <service grafana-server restart>


# 由于该插件依赖另外一个 Grafana-piechart-panel 插件，所以如果没有安装，同样需要先安装该插件。
grafana@grafana-869db94654-gxgjk:/usr/share/grafana$ grafana-cli plugins install Grafana-piechart-panel
installing Grafana-piechart-panel @ 1.6.2
from url: https://grafana.com/api/plugins/Grafana-piechart-panel/versions/1.6.2/download
into: /var/lib/grafana/plugins

✔ Installed Grafana-piechart-panel successfully 

Restart grafana after installing plugins . <service grafana-server restart>
```

安装完成后需要重启 grafana 才会生效，我们这里直接删除 Pod，重建即可。

```bash
[root@k8s-master grafana]# kubectl delete -f grafana-deploy.yaml 
deployment.apps "grafana" deleted

[root@k8s-master grafana]# kubectl create -f grafana-deploy.yaml            
deployment.apps/grafana created
```



然后通过浏览器打开 Grafana 找到该插件，点击 `enable` 启用插件。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904214630.png)

点击 `Set up your first k8s-cluster` 创建一个新的 Kubernetes 集群:

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-grafana-20.png)

- URL 使用 Kubernetes Service 地址即可：https://kubernetes.default:443
- Access 访问模式使用：`Server(default)`
- 由于插件访问 Kubernetes 集群的各种资源对象信息，所以我们需要配置访问权限，这里我们可以简单使用 kubectl 的 `kubeconfig` 来进行配置即可。
- 勾选 Auth 下面的 `TLS Client Auth` 和 `With CA Cert` 两个选项
- 其中 `TLS Auth Details` 下面的值就对应 `kubeconfig` 里面的证书信息。比如我们这里的 `kubeconfig` 文件格式如下所示：

```bash
[root@k8s-master grafana]# more ~/.kube/config 
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data:  <certificate-authority-data>
    server: https://cluster-endpoint:6443
  name: kubernetes
contexts:
- context:
    cluster: kubernetes
    user: kubernetes-admin
  name: kubernetes-admin@kubernetes
- context:
    cluster: kubernetes
    namespace: kube-system
    user: zq
  name: zq-context
current-context: kubernetes-admin@kubernetes
kind: Config
preferences: {}
users:
- name: kubernetes-admin
  user:
    client-certificate-data: <client-certificate-data>
    client-key-data: <client-certificate-data>
- name: zq
  user:
    client-certificate: /root/certs/zq.crt
    client-key: /root/certs/zq.key
```

那么 `CA Cert` 的值就对应 `kubeconfig` 里面的 `<certificate-authority-data>` 进行 base64 解码过后的值；`Client Cert` 的值对应 `<client-certificate-data>` 进行 base64 解码过后的值；`Client Key` 的值就对应 `<client-key-data>` 进行 base64 解码过后的值。

- 最后在 `additional datasources` 下拉列表中选择 prometheus 的数据源。
- 点击 `Save & Test` 正常就可以保存成功了。

插件配置完成后，在左侧侧边栏就会出现 `DevOpsProdigy KubeGraf` 插件的入口，通过插件页面可以查看整个集群的状态。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220904220329.png)

## 自定义图表

导入现成的第三方 Dashboard 或许能解决我们大部分问题，但是毕竟还会有需要定制图表的时候，这个时候就需要了解如何去自定义图表了。

同样在侧边栏点击 "+"，选择 Dashboard，可以根据需要选择各种类型的图表，比如我们这里选择一个 `Graph` 类型的：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-grafana-21.png)

然后选择左侧图标中的第一个 `Queries` tab，然后选择 `Prometheus` 这个数据源：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-grafana-23.png)

然后在 `Metrics` 区域输入我们要查询的监控 PromQL 语句，比如我们这里想要查询集群节点 CPU 的使用率：

```bash
(1 - sum(increase(node_cpu_seconds_total{mode="idle", instance=~"$node"}[1m])) by (instance) / sum(increase(node_cpu_seconds_total{instance=~"$node"}[1m])) by (instance)) * 100
```

虽然我们现在还没有具体的学习过 PromQL 语句，但其实我们仔细分析上面的语句也不是很困难，集群节点的 CPU 使用率实际上就相当于排除空闲 CPU 的使用率，所以我们可以优先计算空闲 CPU 的使用时长，除以总的 CPU 时长就是使用率了，用 1 减掉过后就是 CPU 的使用率了，如果想用百分比来表示的话则乘以 100 即可。

这里有一个需要注意的地方是在 PromQL 语句中有一个 `install=~"$node"` 的标签，其实意思就是根据 `$node` 这个参数来进行过滤，也就是我们希望在 Grafana 里面通过参数化来控制每一次计算哪一个节点的 CPU 使用率。

所以这里就涉及到 Grafana 里面的参数使用。点击页面顶部的 `Dashboard Settings` 按钮进入配置页面：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-grafana-24.png)

在左侧 tab 栏点击 `Variables` 进入参数配置页面，如果还没有任何参数，可以通过点击 `Add Variable` 添加一个新的变量：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-grafana-25.png)

这里需要注意的是变量的名称 `node` 就是上面我们在 PromQL 语句里面使用的 `$node` 这个参数，这两个地方必须保持一致，然后最重要的就是参数的获取方式了，比如我们可以通过 `Prometheus`这个数据源，通过 `kubelet_node_name` 这个指标来获取，在 Prometheus 里面我们可以查询该指标获取到的值为：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-grafana-26.png)

我们其实只是想要获取节点的名称，所以我们可以用正则表达式去匹配 `node=xxx` 这个标签，将匹配的值作为参数的值即可。在最下面的 `Preview of values` 里面会有获取的参数值的预览结果。

另外由于我们希望能够让用户自由选择一次性可以查询多少个节点的数据，所以我们将 `Multi-value` 以及 `Include All option` 都勾选上了，最后记得保存，保存后跳转到 Dashboard 页面就可以看到我们自定义的图表信息：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-grafana-29.png)