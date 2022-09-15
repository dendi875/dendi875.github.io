---
title: Kubernetes Ingress实践练习
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-21 22:41:04
password:
summary:  Kubernetes Ingress实践练习
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes Ingress-nginx 的使用

我们知道可以使用 `NodePort` 和 `LoadBlancer` 类型的 Service 可以把应用暴露给外部用户使用，除此之外，Kubernetes 还为我们提供了一个非常重要的资源对象可以用来暴露服务给外部用户，那就是 `Ingress`。对于小规模的应用我们使用 NodePort 或许能够满足我们的需求，但是当你的应用越来越多的时候，你就会发现对于 NodePort 的管理就非常麻烦了，这个时候使用 Ingress 就非常方便了，可以避免管理大量的端口。

Ingress 其实就是从 Kuberenets 集群外部访问集群的一个入口，将外部的请求转发到集群内不同的 Service 上，其实就相当于 nginx、haproxy 等负载均衡代理服务器，可能你会觉得我们直接使用 nginx 就实现了，但是只使用 nginx 这种方式有很大缺陷，每次有新服务加入的时候怎么改 Nginx 配置？不可能让我们去手动更改或者滚动更新前端的 Nginx Pod 吧？那我们再加上一个服务发现的工具比如 consul 如何？貌似是可以，对吧？Ingress 实际上就是这样实现的，只是服务发现的功能自己实现了，不需要使用第三方的服务了，然后再加上一个域名规则定义，路由信息的刷新依靠 Ingress Controller 来提供。

Ingress Controller 可以理解为一个监听器，通过不断地监听 kube-apiserver，实时的感知后端 Service、Pod 的变化，当得到这些信息变化后，Ingress Controller 再结合 Ingress 的配置，更新反向代理负载均衡器，达到服务发现的作用。其实这点和服务发现工具 consul、 consul-template 非常类似。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/nginx-ingress-controller.png)

现在可以供大家使用的 Ingress Controller 有很多，比如 traefik、nginx-controller、Kubernetes Ingress Controller for Kong、HAProxy Ingress controller，当然你也可以自己实现一个 Ingress Controller，现在普遍用得较多的是 traefik 和 nginx-controller，traefik 的性能较 nginx-controller 差，但是配置使用要简单许多，这里给大家介绍 nginx-controller 的使用。

## 安装 Ingress-nginx

NGINX Ingress Controller 是使用 Kubernetes Ingress 资源对象构建的，用 ConfigMap 来存储 Nginx 配置的一种 Ingress Controller 实现。

要使用 Ingress 对外暴露服务，就需要提前安装一个 Ingress Controller，我们这里就先来安装 NGINX Ingress Controller。

我们主要目的是为了测试，就使用Bare metal clusters（裸机集群）的部署方式，裸机集群方式会使用 30000-32767 范围内的端口。

部署参考资料：

* https://github.com/kubernetes/ingress-nginx/tree/main/deploy/static/provider
* https://github.com/kubernetes/ingress-nginx/blob/main/docs/deploy/index.md
* https://github.com/kubernetes/ingress-nginx/blob/main/docs/deploy/baremetal.md

```shell
# 下载资源清单文件
wget https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v0.47.0/deploy/static/provider/baremetal/deploy.yaml -O ingress.yaml

#修改镜像
vi ingress.yaml
# 将 kind: Deployment 中的 spec.template.spec.containers[0].image 的值改为如下值：
registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/ingress-nginx-controller:v0.46.0

# 执行资料清单
[root@k8s-master ingress]# kubectl apply -f ingress.yaml 
namespace/ingress-nginx created
serviceaccount/ingress-nginx created
configmap/ingress-nginx-controller created
clusterrole.rbac.authorization.k8s.io/ingress-nginx created
clusterrolebinding.rbac.authorization.k8s.io/ingress-nginx created
role.rbac.authorization.k8s.io/ingress-nginx created
rolebinding.rbac.authorization.k8s.io/ingress-nginx created
service/ingress-nginx-controller-admission created
service/ingress-nginx-controller created
deployment.apps/ingress-nginx-controller created
validatingwebhookconfiguration.admissionregistration.k8s.io/ingress-nginx-admission created
serviceaccount/ingress-nginx-admission created
clusterrole.rbac.authorization.k8s.io/ingress-nginx-admission created
clusterrolebinding.rbac.authorization.k8s.io/ingress-nginx-admission created
role.rbac.authorization.k8s.io/ingress-nginx-admission created
rolebinding.rbac.authorization.k8s.io/ingress-nginx-admission created
job.batch/ingress-nginx-admission-create created
job.batch/ingress-nginx-admission-patch created

# 检查安装的结果
[root@k8s-master ingress]#  kubectl get pod,svc -n ingress-nginx
NAME                                            READY   STATUS      RESTARTS   AGE
pod/ingress-nginx-admission-create-kv747        0/1     Completed   0          7m33s
pod/ingress-nginx-admission-patch-76tx4         0/1     Completed   0          7m33s
pod/ingress-nginx-controller-65bf56f7fc-p9jbs   1/1     Running     0          7m33s

NAME                                         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)                      AGE
service/ingress-nginx-controller             NodePort    10.96.197.163   <none>        80:31688/TCP,443:31390/TCP   7m33s
service/ingress-nginx-controller-admission   ClusterIP   10.96.169.165   <none>        443/TCP                      7m33s

# 可以看到 ingress-nginx 通过 NodePort 方式帮我们暴露出来了一个http的端口31688，一个https的端口31390

# 最后别忘记把svc暴露的端口 31688,31390要放行
```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-nginx-ingress-1.png)

出现了上面的信息证明 Ingress Controller 已经安装成功。

## Ingress-nginx使用

### 准备实验环境

安装成功后，现在我们先准备好实验环境，如下所示：ingress-demo.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hello-server
  template:
    metadata:
      labels:
        app: hello-server
    spec:
      containers:
      - name: hello-server
        image: registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/hello-server
        ports:
        - containerPort: 9000
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: nginx-demo
  name: nginx-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-demo
  template:
    metadata:
      labels:
        app: nginx-demo
    spec:
      containers:
      - image: nginx
        name: nginx
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: nginx-demo
  name: nginx-demo
spec:
  selector:
    app: nginx-demo
  ports:
  - port: 8000
    protocol: TCP
    targetPort: 80
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: hello-server
  name: hello-server
spec:
  selector:
    app: hello-server
  ports:
  - port: 8000
    protocol: TCP
    targetPort: 9000
```

直接创建上面的资源对象：

```shell
[root@k8s-master ingress]# kubectl apply -f ingress-demo.yaml 
deployment.apps/hello-server created
deployment.apps/nginx-demo created
service/nginx-demo created
service/hello-server created
```

查看创建的 deploy 和 servcie

```shell
[root@k8s-master ~]# kubectl get deploy
NAME           READY   UP-TO-DATE   AVAILABLE   AGE
hello-server   2/2     2            2           5m11s
nginx-demo     2/2     2            2           5m11s
[root@k8s-master ~]# kubectl get svc
NAME           TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
hello-server   ClusterIP   10.96.252.210   <none>        8000/TCP   5m15s
kubernetes     ClusterIP   10.96.0.1       <none>        443/TCP    7d20h
nginx-demo     ClusterIP   10.96.26.158    <none>        8000/TCP   5m15s
```

### 域名访问

假如我们的需求是：

请求 hello.zhangquan.me:31688把请求转发给 service-hello-server 进行处理

请求 demo.zhangquan.me:31688把请求转发给 service-nginx-demo 进行处理

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-nginx-ingress-domain-access.png)



资源文件如下： ingress-domain-access.yaml 

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress  # 一个 ingress 相当一个转发规则
metadata:
  name: ingress-host-bar # ingress名称
spec:
  ingressClassName: nginx
  rules:
  - host: "hello.zhangquan.me"  #如果是改域名下的请求就应用下面的转发规则
    http:
      paths:
      - pathType: Prefix
        path: "/"
        backend:
          service:
            name: hello-server
            port:
              number: 8000
  - host: "demo.zhangquan.me"
    http:
      paths:
      - pathType: Prefix
        path: "/"  # 把请求会转给下面的服务，下面的服务一定要能处理这个路径，不能处理就是404
        backend:
          service:
            name: nginx-demo  ## java，比如使用路径重写，去掉前缀nginx
            port:
              number: 8000
```

修改 hosts 文件让hello.zhangquan.me,demo.zhangquan.me这两个域名能够解析到我们的master节点

```shell
# hosts 文件中加入这二行
k8s-master-ip hello.zhangquan.me
k8s-master-ip demo.zhangquan.me
```

创建上面的资源对象：

```shell
[root@k8s-master ~]# kubectl apply -f ingress/ingress-domain-access.yaml 
ingress.networking.k8s.io/ingress-host-bar created
```

查看创建结果：

```shell
[root@k8s-master ~]# kubectl get ingress
NAME               CLASS   HOSTS                                  ADDRESS   PORTS   AGE
ingress-host-bar   nginx   hello.zhangquan.me,demo.zhangquan.me             80      5s
```

可以看到这个规则匹配了两个域名hello.zhangquan.me,demo.zhangquan.me，只要是这两个域名的请求就会按照 ingress-domain-access.yaml  文件中的规则进行处理。

访问 hello.zhangquan.me 转发到 hell-server 处理



![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-nginx-ingress-2.png)

访问 demo.zhangquan.me 转发到 nginx-demo 处理

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-nginx-ingress-3.png)

### URL Rewrite

NGINX Ingress Controller 很多高级的用法可以通过 Ingress 对象的 `annotation` 进行配置，比如常用的 URL Rewrite 功能，现在我们需要对访问的 URL 路径做一个 Rewrite，比如在 PATH 中添加一个 nginx 的前缀，关于 Rewrite 的操作在 [ingress-nginx 官方文档](https://kubernetes.github.io/ingress-nginx/examples/rewrite/)中也给出对应的说明，对应的 Ingress 资源对象如下所示：ingress-url-rewrite.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress  # 一个 ingress 相当一个转发规则
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
  name: ingress-url-rewrite # ingress名称
spec:
  ingressClassName: nginx
  rules:
  - host: "hello.zhangquan.io"  #如果是改域名下的请求就应用下面的转发规则
    http:
      paths:
      - pathType: Prefix
        path: "/"
        backend:
          service:
            name: hello-server
            port:
              number: 8000
  - host: "demo.zhangquan.io"
    http:
      paths:
      - pathType: Prefix
        path: "/nginx(/|$)(.*)"  # 把请求会转给下面的服务，下面的服务一定要能处理这个路径，不能处理就是404
        backend:
          service:
            name: nginx-demo  ## java，比如使用路径重写，去掉前缀nginx
            port:
              number: 8000
```

修改 hosts 文件让hello.zhangquan.io,demo.zhangquan.io这两个域名能够解析到我们的master节点

```shell
# hosts 文件中加入这二行
k8s-master-ip hello.zhangquan.me.hello.zhangquan.io
k8s-master-ip demo.zhangquan.me,demo.zhangquan.io
```

创建资源对象：

```shell
[root@k8s-master ~]# kubectl apply -f ingress/ingress-url-rewrite.yaml 
ingress.networking.k8s.io/ingress-url-rewrite created
```

查看 ingress：

```shell
[root@k8s-master ~]# kubectl get ing
NAME                  CLASS   HOSTS                                  ADDRESS      PORTS   AGE
ingress-host-bar      nginx   hello.zhangquan.me,demo.zhangquan.me   172.31.0.4   80      47m
ingress-url-rewrite   nginx   hello.zhangquan.io,demo.zhangquan.io   172.31.0.4   80      28s
```

我们带上 `nginx` 的前缀去访问：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-nginx-ingress-url-rewrite.png)

我们可以看到已经可以访问到页面内容了，这是因为我们在 `path` 中通过正则表达式 `/nginx(/|$)(.*)`将匹配的路径设置成了 `rewrite-target` 的目标路径了，所以我们访问 `http://demo.zhangquan.io:31688/nginx` 的时候实际上相当于访问的就是后端服务的 `/` 路径

### Rate Limiting

我们测试下限流功能，对应的 Ingress 资源对象如下所示：ingress-limit-rate.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-limit-rate
  annotations:
    nginx.ingress.kubernetes.io/limit-rps: "1" #每秒只能放一个请求进来
spec:
  ingressClassName: nginx
  rules:
  - host: "demo.zhangquan.limitrate"
    http:
      paths:
      - pathType: Exact #精确模式，必须要访问 demo.zhangquan.limitrate 才行
        path: "/"
        backend:
          service:
            name: nginx-demo
            port:
              number: 8000
```

修改 hosts 文件让 haha.zhangquan.io 这个域名能够解析到我们的master节点

```shell
k8s-master-ip demo.zhangquan.limitrate
```

创建资源对象：

```shell
[root@k8s-master ~]# kubectl apply -f ingress/ingress-limit-rate.yaml
ingress.networking.k8s.io/ingress-limit-rate created
```

查看ingress：

```shell
[root@k8s-master ~]# kubectl get ing
NAME                  CLASS   HOSTS                                  ADDRESS      PORTS   AGE
ingress-host-bar      nginx   hello.zhangquan.me,demo.zhangquan.me   172.31.0.4   80      100m
ingress-limit-rate    nginx   demo.zhangquan.limitrate               172.31.0.4   80      24s
ingress-url-rewrite   nginx   hello.zhangquan.io,demo.zhangquan.io   172.31.0.4   80      54m
```

访问测试，快速刷新就会响应默认的 503  code

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-nginx-ingress-limit-rate.png)

## 参考资料

* https://github.com/kubernetes/ingress-nginx/tree/main/deploy/static/provider
* https://github.com/kubernetes/ingress-nginx/blob/main/docs/deploy/index.md
* https://github.com/kubernetes/ingress-nginx/blob/main/docs/deploy/baremetal.md

* https://kubernetes.github.io/ingress-nginx/
* https://kubernetes.io/docs/concepts/services-networking/ingress/
* https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/
* https://kubernetes.github.io/ingress-nginx/examples/rewrite/