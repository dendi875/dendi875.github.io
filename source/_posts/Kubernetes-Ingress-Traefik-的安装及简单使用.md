---
title: Kubernetes Ingress Traefik 的安装及简单使用
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-28 21:07:06
password: 
summary:  Kubernetes Ingress Traefik 的安装及简单使用
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes Ingress Traefik 的安装及简单使用

## 介绍

`Ingress`其实就是从 kuberenets 集群外部访问集群的一个入口，将外部的请求转发到集群内不同的 Service 上，其实就相当于 nginx、haproxy 等负载均衡代理服务器，有的同学可能觉得我们直接使用 nginx 就实现了，但是只使用 nginx 这种方式有很大缺陷，每次有新服务加入的时候怎么改 Nginx 配置？不可能让我们去手动更改或者滚动更新前端的 Nginx Pod 吧？那我们再加上一个服务发现的工具比如 consul 如何？貌似是可以，对吧？而且在之前单独使用 docker 的时候，这种方式已经使用得很普遍了，Ingress 实际上就是这样实现的，只是服务发现的功能自己实现了，不需要使用第三方的服务了，然后再加上一个域名规则定义，路由信息的刷新需要一个靠 Ingress controller 来提供。

Ingress controller 可以理解为一个监听器，通过不断地与 kube-apiserver 打交道，实时的感知后端 service、pod 的变化，当得到这些变化信息后，Ingress controller 再结合 Ingress 的配置，更新反向代理负载均衡器，达到服务发现的作用。其实这点和服务发现工具 consul consul-template 非常类似。

现在可以供大家使用的 Ingress controller 有很多，比如 [traefik](https://traefik.io/)、[nginx-controller](https://kubernetes.github.io/ingress-nginx/)、[Kubernetes Ingress Controller for Kong](https://konghq.com/blog/kubernetes-ingress-controller-for-kong/)、[HAProxy Ingress controller](https://github.com/jcmoraisjr/haproxy-ingress)，当然你也可以自己实现一个 Ingress Controller，现在普遍用得较多的是 traefik 和 nginx-controller，traefik 的性能较 nginx-controller 差，但是配置使用要简单许多，我们这里会以更简单的 traefik 为例给大家介绍 ingress 的使用。

## Traefik

Traefik 是一款开源的反向代理与负载均衡工具。它最大的优点是能够与常见的微服务系统直接整合，可以实现自动化动态配置。目前支持 Docker、Swarm、Mesos/Marathon、 Mesos、Kubernetes、Consul、Etcd、Zookeeper、BoltDB、Rest API 等等后端模型。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220828194506.png)

要使用 traefik，我们同样需要部署 traefik 的 Pod，我们将 traefik 部署到 master 节点上。

创建存放 traefik 资源清单目录

```shell
mkdir ~/traefik

cd ~/traefik
```

首先，为安全起见我们这里使用 RBAC 安全认证方式：(rbac.yaml)：

```yaml
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: traefik-ingress-controller
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: traefik-ingress-controller
rules:
  - apiGroups:
      - ""
    resources:
      - services
      - endpoints
      - secrets
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - extensions
    resources:
      - ingresses
    verbs:
      - get
      - list
      - watch
---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: traefik-ingress-controller
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: traefik-ingress-controller
subjects:
- kind: ServiceAccount
  name: traefik-ingress-controller
  namespace: kube-system
```

直接在集群中创建即可：

```shell
[root@k8s-master traefik]# kubectl create -f rbac.yaml 
serviceaccount/traefik-ingress-controller created
clusterrole.rbac.authorization.k8s.io/traefik-ingress-controller created
clusterrolebinding.rbac.authorization.k8s.io/traefik-ingress-controller created
```

查看创建的资源：

```shell
[root@k8s-master traefik]# kubectl get sa traefik-ingress-controller -n kube-system
NAME                         SECRETS   AGE
traefik-ingress-controller   1         104s

[root@k8s-master traefik]# kubectl get clusterrole  traefik-ingress-controller -n kube-system   
NAME                         CREATED AT
traefik-ingress-controller   2022-08-28T11:59:53Z

[root@k8s-master traefik]# kubectl get clusterrolebinding traefik-ingress-controller -n kube-sysgem
NAME                         ROLE                                     AGE
traefik-ingress-controller   ClusterRole/traefik-ingress-controller   2m14s
```

然后使用 Deployment 来管理 Pod，直接使用官方的 traefik 镜像部署即可（traefik.yaml）

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: traefik-ingress-controller
  namespace: kube-system
  labels:
    k8s-app: traefik-ingress-lb
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: traefik-ingress-lb
  template:
    metadata:
      labels:
        k8s-app: traefik-ingress-lb
        name: traefik-ingress-lb
    spec:
      serviceAccountName: traefik-ingress-controller
      terminationGracePeriodSeconds: 60
      tolerations:
      - operator: "Exists"
      nodeSelector:
        kubernetes.io/hostname: k8s-master
      containers:
      - image: traefik:v1.7.17 #使用的traefik官方镜像
        name: traefik-ingress-lb
        ports:
        - name: http
          containerPort: 80
        - name: admin
          containerPort: 8080
        args:
        - --api
        - --kubernetes
        - --logLevel=INFO
---
kind: Service
apiVersion: v1
metadata:
  name: traefik-ingress-service
  namespace: kube-system
spec:
  selector:
    k8s-app: traefik-ingress-lb
  ports:
    - protocol: TCP
      port: 80
      name: web
    - protocol: TCP
      port: 8080
      name: admin  #端口名称
  type: NodePort
```

直接创建上面的资源对象即可：

```shell
[root@k8s-master traefik]# kubectl create -f traefik.yaml
deployment.apps/traefik-ingress-controller created
service/traefik-ingress-service created
```

要注意上面 yaml 文件：

```yaml
tolerations:
- operator: "Exists"
nodeSelector:
  kubernetes.io/hostname: k8-master
```

所以我们使用`nodeSelector`标签将`traefik`的固定调度到`master`这个节点上，那么上面的**tolerations**是干什么的呢？这个是因为我们集群使用的 kubeadm 安装的，master 节点默认是不能被普通应用调度的，要被调度的话就需要添加这里的 tolerations 属性，当然如果你的集群和我们的不太一样，直接去掉这里的调度策略就行。

> nodeSelector 和 tolerations 都属于 Pod 的调度策略

可以使用下面的命令查看 master 节点的 labels：

```shell
[root@k8s-master traefik]# kubectl get nodes
NAME         STATUS   ROLES                  AGE   VERSION
k8s-master   Ready    control-plane,master   15d   v1.20.9
k8s-node1    Ready    <none>                 15d   v1.20.9
k8s-node2    Ready    <none>                 15d   v1.20.9

[root@k8s-master traefik]# kubectl get nodes --show-labels
NAME         STATUS   ROLES                  AGE   VERSION   LABELS
k8s-master   Ready    control-plane,master   15d   v1.20.9   beta.kubernetes.io/arch=amd64,beta.kubernetes.io/os=linux,kubernetes.io/arch=amd64,kubernetes.io/hostname=k8s-master,kubernetes.io/os=linux,node-role.kubernetes.io/control-plane=,node-role.kubernetes.io/master=
k8s-node1    Ready    <none>                 15d   v1.20.9   beta.kubernetes.io/arch=amd64,beta.kubernetes.io/os=linux,kubernetes.io/arch=amd64,kubernetes.io/hostname=k8s-node1,kubernetes.io/os=linux
k8s-node2    Ready    <none>                 15d   v1.20.9   beta.kubernetes.io/arch=amd64,beta.kubernetes.io/os=linux,kubernetes.io/arch=amd64,kubernetes.io/hostname=k8s-node2,kubernetes.io/os=linux
```

traefik 还提供了一个 web ui 工具，就是上面的 8080 端口对应的服务，为了能够访问到该服务，我们这里将服务设置成的 NodePort：

```shell
[root@k8s-master traefik]# kubectl get deployment traefik-ingress-controller -n kube-system  
NAME                         READY   UP-TO-DATE   AVAILABLE   AGE
traefik-ingress-controller   1/1     1            1           5s

[root@k8s-master traefik]# kubectl get svc traefik-ingress-service -n kube-system
NAME                      TYPE       CLUSTER-IP    EXTERNAL-IP   PORT(S)                       AGE
traefik-ingress-service   NodePort   10.96.144.7   <none>        80:31000/TCP,8080:32313/TCP   8s


[root@k8s-master traefik]# kubectl get pods -n kube-system -l k8s-app=traefik-ingress-lb -o wide
NAME                                          READY   STATUS    RESTARTS   AGE   IP                NODE         NOMINATED NODE   READINESS GATES
traefik-ingress-controller-574b6698df-7cc59   1/1     Running   0          12s   192.168.235.234   k8s-master   <none>           <none>
```

现在在浏览器中输入 master_node_ip:32313 就可以访问到 traefik 的 dashboard 了：（hosts 文件中增加了 traefik.zq.io 对 master ip的映射）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-ingress-traefik-1.png)

## Ingress 对象

现在我们是通过 NodePort 来访问 traefik 的 Dashboard 的，那怎样通过 ingress 来访问呢？ 首先，需要创建一个 ingress 对象：(ingress.yaml)

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: traefik-web-ui
  namespace: kube-system
  annotations:
    kubernetes.io/ingress.class: traefik  #固定的
spec:
  rules:
  - host: zq.ingress-traefik.io
    http:
      paths:
      - backend:
          serviceName: traefik-ingress-service #代理到哪个服务上去
          servicePort: 8080  #代理到哪个端口，可以使用端口名称 admin
```

然后为 traefik dashboard 创建对应的 ingress 对象：

```shell
[root@k8s-master traefik]# kubectl create -f ingress.yaml 
Warning: extensions/v1beta1 Ingress is deprecated in v1.14+, unavailable in v1.22+; use networking.k8s.io/v1 Ingress
ingress.extensions/traefik-web-ui created
```

要注意上面的 ingress 对象的规则，特别是 rules 区域，我们这里是要为 traefik 的 dashboard 建立一个 ingress 对象，所以这里的 serviceName 对应的是上面我们创建的 traefik-ingress-service，端口也要注意对应 8080 端口，为了避免端口更改，这里的 servicePort 的值也可以替换成上面定义的 port 的名字：**admin**

创建完成后，我们应该怎么来测试呢？

* 第一步，在本地的**/etc/hosts**里面添加上 zq.ingress-traefik.io与 master 节点外网 IP 的映射关系

* 第二步，在浏览器中访问：zq.ingress-traefik.io，我们会发现并没有得到我们期望的 dashboard 界面，这是因为我们上面部署 traefik 的时候使用的是 NodePort 这种 Service 对象，所以我们只能通过上面的 32313 端口访问到我们的目标对象：[zq.ingress-traefik.io:32313](zq.ingress-traefik.io:32313)，第一种 dashboard 的访问方式是通过 NodePort 方式，现在这种 dashboard 是通过自定义域名通过 ingress 来访问：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220828205440.png)

加上端口后我们发现可以访问到 dashboard 了，而且在 dashboard 当中多了一条记录，正是上面我们创建的 ingress 对象的数据，我们还可以切换到 HEALTH 界面中，可以查看当前 traefik 代理的服务的整体的健康状态：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220828205700.png)

* 第三步，上面我们可以通过自定义域名加上端口可以访问我们的服务了，但是我们平时服务别人的服务是不是都是直接用的域名啊，http 或者 https 的，几乎很少有在域名后面加上端口访问的吧？为什么？太麻烦啊，端口也记不住，要解决这个问题，怎么办，我们只需要把我们上面的 traefik 的核心应用的端口隐射到 master 节点上的 80 端口，是不是就可以了，因为 http 默认就是访问 80 端口，但是我们在 Service 里面是添加的一个 NodePort 类型的服务，没办法隐射 80 端口，怎么办？这里就可以直接在 Pod 中指定一个 hostPort 即可，更改上面的 traefik.yaml 文件中的容器端口：

```yaml
containers:
- image: traefik:v1.7.17 #使用的traefik官方镜像
name: traefik-ingress-lb
ports:
- name: http
  containerPort: 80
  hostPort: 80  # 添加这一行，traefik 的80端口映射到主机的 80
- name: admin
  containerPort: 8080
```

添加以后`hostPort: 80`，然后更新应用：

```shell
kubectl apply -f traefik.yaml
```

更新完成后，这个时候我们在浏览器中直接使用域名方法测试下。

- 第四步，正常来说，我们如果有自己的域名，我们可以将我们的域名添加一条 DNS 记录，解析到 master 的外网 IP 上面，这样任何人都可以通过域名来访问我的暴露的服务了。

> 如果你有多个边缘节点的话，可以在每个边缘节点上部署一个 ingress-controller 服务，然后在边缘节点前面挂一个负载均衡器，比如 nginx，将所有的边缘节点均作为这个负载均衡器的后端，这样就可以实现 ingress-controller 的高可用和负载均衡了。



到这里我们就通过 ingress 对象对外成功暴露了一个服务，当然 traefik 还有更多的用法。

## 参考

* https://www.qikqiak.com/post/ingress-traefik1/