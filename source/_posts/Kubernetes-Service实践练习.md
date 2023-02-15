---
title: Kubernetes Service实践练习
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-21 22:40:51
password: Kubernetes  Service实践练习
summary: Kubernetes Service实践练习
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes  Service实践练习

本文主要介绍了 Service 的几种访问方式，包括ClusterIP、NodePort、LoadBalancer、ExternalName。

## 问题

首先，我们思考这样一个问题：

在k8s中，Pod是有生命周期的，如果Pod重启它的IP很有可能会发生变化。如果我们的服务都是将Pod的IP地址写死，Pod挂掉或者重启，和刚才重启的Pod相关联的其他服务将会找不到它所关联的Pod，所以客户端需要知道pod地址，若某一node上的pod故障，客户端需要感知，Service 的出现就是解决上述问题的

## 什么是 Service

所谓 Service，其实就是 Kubernetes 为 Pod 分配的、固定的、基于 iptables（或者 IPVS）的**访问入口**。而这些访问入口代理的 Pod 信息，则来自于 Etcd，由 kube-proxy 通过控制循环来维护。

Service是发现后端pod服务；

Service是为一组具有相同功能的容器应用提供一个统一的入口地址；

Service是将请求进行负载分发到后端的各个容器应用上的控制器。

## Service的访问方式

访问service的请求来源有两种：k8s集群内部的程序（Pod）和 k8s集群外部的程序。

采用微服务架构时，除了实现业务逻辑以外，还需要考虑如何把服务发布到k8s集群或者集群外部，使这些服务能够被k8s集群内的应用、其他k8s集群的应用以及外部应用使用。因此k8s提供了灵活的服务发布方式，用户可以通过ServiceType来指定如何来发布服务，类型有以下几种：

- ClusterIP：通过集群的内部 IP 暴露服务，选择该值时服务只能够在集群内部访问。
- NodePort：通过每个节点上的 IP 和静态端口（`NodePort`）暴露服务。 `NodePort` 服务会路由到自动创建的 `ClusterIP` 服务。 通过请求 `<节点 IP>:<节点端口>`，你可以从集群的外部访问一个 `NodePort` 服务。
- LoadBalancer：使用云提供商的负载均衡器向外部暴露服务。 外部负载均衡器可以将流量路由到自动创建的 `NodePort` 服务和 `ClusterIP` 服务上。
- ExternalName：通过返回 `CNAME` 和对应值，可以将服务映射到 `externalName` 字段的内容（例如，`foo.bar.example.com`）。 无需创建任何类型代理。

其中 ClusterIP 为默认方式，只能集群内部访问。NodePort、LoadBalancer 则是向外暴露服务的同时将流量路由到 ClusterIP服务。ExternalName 则是CNAME方式进行服务映射

## 详解Service四种访问方式

在测试这四种Service访问类型之前，我们先做些准备工作：

1. 准备  my-nginx-deployment.yaml

   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     labels:
       app: my-nginx-deployment
     name: my-nginx-deployment
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: my-nginx-deployment
     template:
       metadata:
         labels:
           app: my-nginx-deployment
       spec:
         containers:
         - image: nginx
           name: nginx
   ```

2. 创建实例

   ```bash
   kubectl apply -f deployment/my-nginx-deployment.yaml 
   ```

3. 查看我们部署 3 个 Nginx Pod

   ```bash
   [root@k8s-master ~]# kubectl get pods 
   NAME                                   READY   STATUS    RESTARTS   AGE
   my-nginx-deployment-69dfcd645b-2mjjt   1/1     Running   1          21h
   my-nginx-deployment-69dfcd645b-n4pbs   1/1     Running   1          21h
   my-nginx-deployment-69dfcd645b-x2tgn   1/1     Running   1          21h
   
   [root@k8s-master ~]# kubectl get deployment
   NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
   my-nginx-deployment   3/3     3            3           22h
   
   [root@k8s-master ~]# kubectl get pod -owide
   NAME                                   READY   STATUS    RESTARTS   AGE   IP                NODE        NOMINATED NODE   READINESS GATES
   my-nginx-deployment-69dfcd645b-2mjjt   1/1     Running   1          21h   192.168.36.84     k8s-node1   <none>           <none>
   my-nginx-deployment-69dfcd645b-n4pbs   1/1     Running   1          21h   192.168.36.82     k8s-node1   <none>           <none>
   my-nginx-deployment-69dfcd645b-x2tgn   1/1     Running   1          21h   192.168.169.144   k8s-node2   <none>           <none>
   ```

4. 分别进入这3个Pod的Nginx容器中，并分别修改Nginx默认首页

   ```bash
   [root@k8s-master ~]# kubectl exec -it my-nginx-deployment-69dfcd645b-2mjjt -c nginx -- /bin/bash
   x.htmly-nginx-deployment-69dfcd645b-2mjjt:/# echo 111 > /usr/share/nginx/html/index.html
   
   [root@k8s-master ~]# kubectl exec -it my-nginx-deployment-69dfcd645b-n4pbs -c nginx -- /bin/bash
   root@my-nginx-deployment-69dfcd645b-n4pbs:/# echo 222 > /usr/share/nginx/html/index.html
   
   [root@k8s-master ~]# kubectl exec -it my-nginx-deployment-69dfcd645b-x2tgn  -c nginx -- /bin/bash
   root@my-nginx-deployment-69dfcd645b-x2tgn:/# echo 333 > /usr/share/nginx/html/index.html   
   ```

5.  在 Master 节点上验证都能正常访问

   ```bash
   # 验证能正常访问到
   [root@k8s-master ~]# kubectl get pod -owide
   NAME                                   READY   STATUS    RESTARTS   AGE   IP                NODE        NOMINATED NODE   READINESS GATES
   my-nginx-deployment-69dfcd645b-2mjjt   1/1     Running   1          21h   192.168.36.84     k8s-node1   <none>           <none>
   my-nginx-deployment-69dfcd645b-n4pbs   1/1     Running   1          21h   192.168.36.82     k8s-node1   <none>           <none>
   my-nginx-deployment-69dfcd645b-x2tgn   1/1     Running   1          21h   192.168.169.144   k8s-node2   <none>           <none>
   
   [root@k8s-master ~]# curl 192.168.36.84
   111
   
   [root@k8s-master ~]# curl 192.168.36.82
   222
   
   [root@k8s-master ~]# curl 192.168.169.144
   333
   ```

6. 打印下 Pod 的标签

   ```bash
   [root@k8s-master ~]# kubectl get pod --show-labels
   NAME                                   READY   STATUS    RESTARTS   AGE   LABELS
   my-nginx-deployment-69dfcd645b-2mjjt   1/1     Running   1          21h   app=my-nginx-deployment,pod-template-hash=69dfcd645b
   my-nginx-deployment-69dfcd645b-n4pbs   1/1     Running   1          21h   app=my-nginx-deployment,pod-template-hash=69dfcd645b
   my-nginx-deployment-69dfcd645b-x2tgn   1/1     Running   1          21h   app=my-nginx-deployment,pod-template-hash=69dfcd645b
   ```

### ClusterIP（集群内部使用）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-service-clusterip.png)

`ClusterIP`也是 Service 的默认访问方式。是集群内部访问的方式，外部是无法访问的。其主要用于为集群内 Pod 访 问时,提供的固定访问地址,默认是自动分配地址,可使用 ClusterIP 关键字指定固定 IP

下面我们测试下ClusterIP Service的访问方式

* 准备配置文件 my-nginx-service-clusterip.yaml 文件

  ```yaml
  apiVersion: v1
  kind: Service
  metadata:
    labels:
      app: my-nginx-service #给该service定义标签
    name: my-nginx-service #service名称
    namespace: default
  spec:
    selector:
      app: my-nginx-deployment #哪些Pod，key是app，value是my-nginx-deployment的Pod
    ports:
    - port: 8080
      protocol: TCP
      targetPort: 80
    type: ClusterIP  
  ```

上述配置创建一个名称为 "my-nginx-service" 的 Service 对象，它会将请求代理到使用 TCP 端口 80，并且具有标签 `"app=my-nginx-deployment"` 的 Pod 上

* 创建svc

  ```bash
  [root@k8s-master ~]# kubectl apply -f service/my-nginx-service-clusterip.yaml 
  service/my-nginx-service created
  ```

* 查看svc

  ```bash
  [root@k8s-master ~]# kubectl get svc,pod
  NAME                       TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
  service/kubernetes         ClusterIP   10.96.0.1       <none>        443/TCP    46h
  service/my-nginx-service   ClusterIP   10.96.111.244   <none>        8080/TCP   6s
  
  NAME                                       READY   STATUS    RESTARTS   AGE
  pod/my-nginx-deployment-69dfcd645b-2mjjt   1/1     Running   1          21h
  pod/my-nginx-deployment-69dfcd645b-n4pbs   1/1     Running   1          21h
  pod/my-nginx-deployment-69dfcd645b-x2tgn   1/1     Running   1          21h
  ```

* 访问测试

  ```bash
  # 使用内部ip访问测试
  [root@k8s-master ~]# curl 10.96.111.244:8080
  333
  [root@k8s-master ~]# curl 10.96.111.244:8080
  222
  [root@k8s-master ~]# curl 10.96.111.244:8080
  222
  [root@k8s-master ~]# curl 10.96.111.244:8080
  111
  
  # 外部访问
  # zhangquan @ MacBook-Pro in ~ [17:48:14] 
  $ curl 10.96.111.244:8080
  curl: (7) Failed to connect to 10.96.111.244 port 8080: Network is unreachable
  ```

可以看到访问是一个负载均衡的访问，而且在集群内任意一台机器上都可以访问

* 在Pod内通过service域名（服务名.所在名称空间.svc）访问

  ```bash
  # 首先部署一个 tomcat
  [root@k8s-master ~]# kubectl create deploy my-tomcat --image=tomcat
  deployment.apps/my-tomcat created
  
  [root@k8s-master ~]# kubectl get pods 
  NAME                                   READY   STATUS    RESTARTS   AGE
  my-nginx-deployment-69dfcd645b-2mjjt   1/1     Running   1          22h
  my-nginx-deployment-69dfcd645b-n4pbs   1/1     Running   1          22h
  my-nginx-deployment-69dfcd645b-x2tgn   1/1     Running   1          22h
  my-tomcat-b4c9b6565-wgb4f              1/1     Running   0          5m39s
  
  # 进入到 tomcat 内通过域名访问 nginx，访问的 ClusterIP
  [root@k8s-master ~]# kubectl exec -it my-tomcat-b4c9b6565-wgb4f -c tomcat -- /bin/bash         
  root@my-tomcat-b4c9b6565-wgb4f:/usr/local/tomcat# curl 10.96.111.244:8080
  333
  root@my-tomcat-b4c9b6565-wgb4f:/usr/local/tomcat# curl 10.96.111.244:8080
  333
  root@my-tomcat-b4c9b6565-wgb4f:/usr/local/tomcat# curl 10.96.111.244:8080
  111
  
  # 实验完删除 my-tomcat 的 deploy
  [root@k8s-master ~]# kubectl delete deploy my-tomcat
  deployment.apps "my-tomcat" deleted
  ```

### NodePort（对外暴露应用，集群外也能访问）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-service-nodeport.png)

NodePort 也叫节点端口访问方式。

 k8s将会在每个Node上打开一个端口并且每个Node的端口都是一样的，通过`<NodeIP>:<NodePort>`的方式Kubernetes集群外部的程序可以访问Service。

下面我们测试下NodePort Service的访问方式

* 开始之前先删除 

* 准备配置文件 my-nginx-service-nodeport.yaml

  ```yaml
  apiVersion: v1
  kind: Service
  metadata:
    name: my-nginx-service
    labels:
      app: my-nginx-service
    namespace: default
  spec:
    type: NodePort
    ports:
    - port: 8080
      targetPort: 80
      protocol: TCP
      name: http
      #nodePort: 31703
    selector:
      app: my-nginx-deployment #哪些Pod，key是app，value是my-nginx-deployment的Pod
  ```

  在这个 Service 的定义里，我们声明它的类型是，type=NodePort。然后，在 ports 字段里声明了 Service 的 8080 端口代理 Pod 的 80 端口。

  > 如果不显式地声明 nodePort 字段，Kubernetes 就会为你分配随机的可用端口来设置代理。这个端口的范围默认是 30000-32767，你可以通过 kube-apiserver 的–service-node-port-range 参数来修改它。

* 创建 svc

  ```bash
  [root@k8s-master ~]# kubectl apply -f service/my-nginx-service-nodeport.yaml
  service/my-nginx-service configured
  ```

* 查看svc

  ```bash
  [root@k8s-master ~]# kubectl get svc,pod
  NAME                       TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
  service/kubernetes         ClusterIP   10.96.0.1       <none>        443/TCP          46h
  service/my-nginx-service   NodePort    10.96.111.244   <none>        8080:31039/TCP   13m
  
  NAME                                       READY   STATUS    RESTARTS   AGE
  pod/my-nginx-deployment-69dfcd645b-2mjjt   1/1     Running   1          22h
  pod/my-nginx-deployment-69dfcd645b-n4pbs   1/1     Running   1          22h
  pod/my-nginx-deployment-69dfcd645b-x2tgn   1/1     Running   1          22h
  ```

  可以看到，虽然是 NodePort 类型，但还是默认创建了 ClusterIP。

* 访问测试

  * 可以通过 `<ClusterIP>:<service.Port>` 来访问

    ```bash
    [root@k8s-master ~]# curl 10.96.111.244:8080
    333
    [root@k8s-master ~]# curl 10.96.111.244:8080
    333
    [root@k8s-master ~]# curl 10.96.111.244:8080
    111
    ```

  * 通过`<NodeIP>:<NodePort>`方式来访问，访问任意一台机器都可以，如果使用云服务器，要在安全组里放行 30000-32767端口

    ```bash
    # zhangquan @ MacBook-Pro in ~ [17:48:35] C:7
    $ curl 139.198.183.73:31039
    222
    
    # zhangquan @ MacBook-Pro in ~ [18:06:33] 
    $ curl 139.198.172.5:31039
    333
    
    # zhangquan @ MacBook-Pro in ~ [18:06:51] 
    $ curl 139.198.170.70:31039
    111
    ```

### LoadBalancer（对外暴露应用，适用于公有云）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-service-load-balance.png)

LoadBalancer 类型的 service 是可以实现集群外部访问服务的另外一种解决方案。不过并不是所有的 k8s 集 群都会支持，大多是在公有云托管集群中会支持该类型。负载均衡器是异步创建的，关于被提供的负载均衡器的 信息将会通过 Service 的 status.loadBalancer 字段被发布出去

> 在NodePort的基础上，借助Cloud Provider创建一个外部负载均衡器，并将请求转发到NodePort

在公有云提供的 Kubernetes 服务里，都使用了一个叫作 CloudProvider 的转接层，来跟公有云本身的 API 进行对接。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: loadbalancer-nginx
  namespace: default
  labels:
    app: my-nginx-service
spec:
  type: LoadBalancer
  ports:
  - port: 8080
    protocol: TCP
    targetPort: 80
  selector:
    app: my-nginx-deployment
```

所以，**在上述 LoadBalancer 类型的 Service 被提交后，Kubernetes 就会调用 CloudProvider 在公有云上为你创建一个负载均衡服务，并且把被代理的 Pod 的 IP 地址配置给负载均衡服务做后端**。

### ExternalName

ExternalName Service 是 Service 的一个特例，它没有选择器，也没有定义任何端口或 Endpoints。它的作用是 返回集群外 Service 的外部别名。它将外部地址经过集群内部的再一次封装(实际上就是集群 DNS 服务器将 CNAME 解析到了外部地址上)，实现了集群内部访问即可。例如你们公司的镜像仓库，最开始是用 ip 访问，等到后面域 名下来了再使用域名访问。你不可能去修改每处的引用。但是可以创建一个 ExternalName，首先指向到 ip，等后 面再指向到域名

下面我们测试下ExternalName Service的访问方式

* 准备配置文件my-nginx-service-externalname.yaml

  ```yaml
  apiVersion: v1
  kind: Service
  metadata:
    name: my-service-externalname
  spec:
    type: ExternalName
    externalName: www.baidu.com
  ```

  在上述 Service 的 YAML 文件中，我指定了一个 externalName= www.baidu.com 的字段。而且你应该会注意到，这个 YAML 文件里不需要指定 selector。

  这时候，当你通过 Service 的 DNS 名字访问它的时候，比如访问：my-service-externalname.default.svc.cluster.local。那么，Kubernetes 为你返回的就是www.baidu.com

  所以说，**ExternalName 类型的 Service，其实是在 kube-dns 里为你添加了一条 CNAME 记录**。

  这时，访问 my-service-externalname.default.svc.cluster.local 就和访问 www.baidu.com 这个域名是一个效果了。

* 创建svc

  ```bash
  [root@k8s-master ~]# kubectl apply -f service/my-nginx-service-externalname.yaml
  service/my-service-externalname created
  ```

* 查看svc

  ```bash
  [root@k8s-master ~]# kubectl get svc,pod
  NAME                              TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)          AGE
  service/kubernetes                ClusterIP      10.96.0.1       <none>          443/TCP          46h
  service/my-nginx-service          NodePort       10.96.111.244   <none>          8080:31039/TCP   21m
  service/my-service-externalname   ExternalName   <none>          www.baidu.com   <none>           8s
  
  NAME                                       READY   STATUS    RESTARTS   AGE
  pod/my-nginx-deployment-69dfcd645b-2mjjt   1/1     Running   1          22h
  pod/my-nginx-deployment-69dfcd645b-n4pbs   1/1     Running   1          22h
  pod/my-nginx-deployment-69dfcd645b-x2tgn   1/1     Running   1          22h
  ```

* 访问测试

  ```bash
  [root@k8s-master ~]# kubectl get pods
  NAME                                   READY   STATUS    RESTARTS   AGE
  my-nginx-deployment-69dfcd645b-2mjjt   1/1     Running   1          22h
  my-nginx-deployment-69dfcd645b-n4pbs   1/1     Running   1          22h
  my-nginx-deployment-69dfcd645b-x2tgn   1/1     Running   1          22h
  
  # 进入 Pod 里
  [root@k8s-master ~]# kubectl exec -it my-nginx-deployment-69dfcd645b-2mjjt -- /bin/bash
  
  # 安装 nslookup 相关工具包
  root@my-nginx-deployment-69dfcd645b-2mjjt:/# apt-get update 
  root@my-nginx-deployment-69dfcd645b-2mjjt:/# apt-get install dnsutils
  
  # 解析  www.baidu.com 域名
  root@my-nginx-deployment-69dfcd645b-2mjjt:/# nslookup www.baidu.com
  Server:         10.96.0.10
  Address:        10.96.0.10#53
  
  Non-authoritative answer:
  www.baidu.com   canonical name = www.a.shifen.com.
  Name:   www.a.shifen.com
  Address: 180.101.49.12
  Name:   www.a.shifen.com
  Address: 180.101.49.11
  
  # 解析 my-service-externalname.default.svc.cluster.local 域名
  root@my-nginx-deployment-69dfcd645b-2mjjt:/# nslookup my-service-externalname.default.svc.cluster.local
  Server:         10.96.0.10
  Address:        10.96.0.10#53
  
  my-service-externalname.default.svc.cluster.local       canonical name = www.baidu.com.
  www.baidu.com   canonical name = www.a.shifen.com.
  Name:   www.a.shifen.com
  Address: 180.101.49.12
  Name:   www.a.shifen.com
  Address: 180.101.49.11
  ```

  可以看到解析此my-service-externalname.default.svc.cluster.local域名和解析 www.baidu.com是一样的结果

## 总结

**所谓 Service，其实就是 Kubernetes 为 Pod 分配的、固定的、基于 iptables（或者 IPVS）的访问入口**。而这些访问入口代理的 Pod 信息，则来自于 Etcd，由 kube-proxy 通过控制循环来维护。

- ClusterIP：集群内部IP，也是默认方法方式。
- NodePort：通过节点IP+静态端口访问，NodePort 服务会将流量路由到 ClusterIP 服务。
- LoadBalancer：使用云厂商提供的负载均衡向外暴露服务，可以将流量路由到 NodePort 服务或者ClusterIP 服务。
- ExternalName：通过返回 CNAME 值的方式将服务映射到指定的域名。

## 参考资料

* https://kubernetes.io/docs/concepts/services-networking/service/
* https://draveness.me/kubernetes-service/