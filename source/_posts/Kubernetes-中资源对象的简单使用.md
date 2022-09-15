---
title: Kubernetes 中资源对象的简单使用
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-18 21:29:44
password:
summary: 在本文中，记录了 Namespaces、Pod 资源对象的简单使用
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes 中资源对象的简单使用

在本文中，记录了 Namespaces、Pod 资源对象的简单使用

## 资源对象

Kubernetes 中的所有内容都被抽象为“资源”，如 Pod、Service、Node 等都是资源。“对象”就是“资源”的实例，是持久化的实体。如某个具体的 Pod、某个具体的 Node。Kubernetes 使用这些实体去表示整个集群的状态。  

对象的创建、删除、修改都是通过 “Kubernetes API”，也就是 “Api Server” 组件提供的 API 接口，这些是 RESTful 风格的 Api，与 k8s 的“万物皆对象”理念相符。命令行工具 “kubectl”，实际上也是调用 kubernetes api。  

K8s 中的资源类别有很多种，kubectl 可以通过配置文件来创建这些 “对象”，配置文件更像是描述对象“属性”的文件，配置文件格式可以是 “JSON” 或 “YAML”，常用 “YAML”。

## 资源创建方式

在 K8s 中，创建资源有两种方式：

* 直接使用命令行方式创建
* 使用 `kubectl create/apply`  命令从 YAML 文件创建

## Namespaces

NameSpaces：名称空间，用来对集群中的资源进行隔离划分。默认只隔离资源，不隔离网络。同一名称空间内的资源名称要唯一，但跨名称空间时没有这个要求。 

### 查看 namespaces

* 列出集群中现有的名称空间

  ```shell
  [root@k8s-master ~]# kubectl get ns
  NAME                   STATUS   AGE
  default                Active   20h
  kube-node-lease        Active   20h
  kube-public            Active   20h
  kube-system            Active   20h
  kubernetes-dashboard   Active   46m
  ```

* 获取某个名称空间的详细信息

  ```shell
  kubectl describe namespaces default
  ```

### 创建 namespace

* 命令行方式

```shell
[root@k8s-master ~]# kubectl create namespace mynamespace
namespace/mynamespace created
```

* yaml 文件方式

  1. 新建一个名为 `my-namespace.yaml` 的 YAML 文件，并写入下列内容：

     ```yaml
     apiVersion: v1
     kind: Namespace
     metadata:
       name: mynamespace
     ```

  2. 然后运行

     ``` shell
     [root@k8s-master ~]# kubectl create -f ./ns/my-namespace.yaml 
     namespace/mynamespace created
     ```

### 删除 namespace

* 命令行方式

  ```shell
  [root@k8s-master ~]# kubectl delete namespace mynamespace
  namespace "mynamespace" deleted
  ```

* yaml 文件方式

  ```shell
  [root@k8s-master ~]# kubectl delete -f ./ns/my-namespace.yaml       
  namespace "mynamespace" deleted
  ```

## Pod

Pod：运行中的一组（一个或多个）容器；**Pod** 是可以在 Kubernetes 中创建和管理的、最小的可部署的计算单元。

### 创建 Pod

* 命令行方式

  mynginx 表示给我们创建的Pod起一个名字，--image=nginx 是表示基于哪个镜像来创建一个Pod，Pod本身是对容器的封装，不写 namespace 就默认创建在 default 空间下

  ```shell
  kubectl run mynginx --image=nginx
  ```

* yaml 文件方式

  1. 新建一个名为 `my-nginx.yaml` 的 YAML 文件，并写入下列内容：

     ```yaml
     apiVersion: v1
     kind: Pod
     metadata:
       labels:
         run: mynginx
       name: mynginx #Pod名称
       namespace: default
     spec:
       containers:
       - image: nginx #容器镜像名称
         name: mynginx  #容器名称
     ```

  2. 然后运行

     ```shell
     [root@k8s-master ~]# kubectl apply -f pod/my-nginx.yaml 
     pod/mynginx created
     ```

### 查看 Pod

* 查看某个名称空间的 Pod

  ```shell
  [root@k8s-master ~]# kubectl get pod -n default
  NAME      READY   STATUS    RESTARTS   AGE
  mynginx   1/1     Running   0          105s
  ```

* 获取某个 Pod 的详细信息

  ```shell
  kubectl describe pod mynginx
  ```

* 查看 Pod 运行日志

  ```shell
  kubectl logs mynginx
  ```

* 查看 Pod详细信息，k8s会为每个Pod分配一个ip 

  ```shell
  [root@k8s-master ~]# kubectl get pod -owide
  NAME      READY   STATUS    RESTARTS   AGE     IP                NODE        NOMINATED NODE   READINESS GATES
  mynginx   1/1     Running   0          2m33s   192.168.169.132   k8s-node2   <none>           <none>
  ```

  集群中的任意一个机器以及任意的应用都能通过Pod的ip来访问这个Pod

  ```shell
  [root@k8s-master ~]# curl 192.168.169.132
  <!DOCTYPE html>
  <html>
  <head>
  <title>Welcome to nginx!</title>
  <style>
  html { color-scheme: light dark; }
  body { width: 35em; margin: 0 auto;
  font-family: Tahoma, Verdana, Arial, sans-serif; }
  </style>
  </head>
  <body>
  <h1>Welcome to nginx!</h1>
  <p>If you see this page, the nginx web server is successfully installed and
  working. Further configuration is required.</p>
  
  <p>For online documentation and support please refer to
  <a href="http://nginx.org/">nginx.org</a>.<br/>
  Commercial support is available at
  <a href="http://nginx.com/">nginx.com</a>.</p>
  
  <p><em>Thank you for using nginx.</em></p>
  </body>
  </html>
  ```

### 删除 Pod

* 命令行方式

  ```shell
  [root@k8s-master ~]# kubectl delete pod mynginx -n default
  pod "mynginx" deleted
  ```

* yaml 文件方式

  ```shell
  [root@k8s-master ~]# kubectl delete -f pod/my-nginx.yaml  
  pod "mynginx" deleted
  ```

### 进入 Pod

```she
[root@k8s-master ~]# kubectl exec -it mynginx -- /bin/bash
root@mynginx:/# 
```

### 一个Pod里面有两个容器

1. 新建一个名为 `my-nginx-tomact.yaml` 的 YAML 文件，并写入下列内容：

   ```yaml
   apiVersion: v1
   kind: Pod
   metadata:
     labels:
       run: myapp
     name: myapp #Pod的名称
     namespace: default #在哪个名称空间下创建
   spec:
     containers:
     - image: nginx  #第一个容器的镜像
       name: nginx #第一个容器的名称
     - image: tomcat:8.5.68 #第二个容器的镜像
       name: tomcat #第二个容器的名称
   ```

2. 然后运行

   ```shell
   [root@k8s-master ~]# kubectl apply -f pod/my-nginx-tomact.yaml 
   pod/myapp created
   ```

3. 验证创建成功

   ```shell
   [root@k8s-master ~]# kubectl get pod
   NAME      READY   STATUS    RESTARTS   AGE
   myapp     2/2     Running   0          5m21s
   mynginx   1/1     Running   0          20m
   ```

4. 访问 myapp Pod 中的 nginx 容器

   首先获取 Pod ip

   ```shell
   [root@k8s-master ~]# kubectl get pod myapp -owide
   NAME    READY   STATUS    RESTARTS   AGE     IP              NODE        NOMINATED NODE   READINESS GATES
   myapp   2/2     Running   0          8m11s   192.168.36.66   k8s-node1   <none>           <none>
   ```

   访问默认的80端口

   ```shell
   [root@k8s-master ~]# curl 192.168.36.66
   ```

5. 访问 myapp Pod 中的 tomcat 容器

   首先获取 Pod ip，然后访问默认的8080端口

   ```shell
   [root@k8s-master ~]# curl 192.168.36.66:8080
   ```

6. 同一个 Pod 中的容器相互访问

   因为同一个 Pod 中的容器他们**共享存储、共享网络**，所以直接使用 127.0.0.1 就可以访问

   比如 myapp Pod 中 nginx 容器访问 tomcat 容器

   进入某个Pod中的某个容器内

   ```shell
   kubectl exec -it myapp -c tomcat -- /bin/bash
   ```

   ```shell
   root@myapp:/usr/local/tomcat# curl 127.0.0.1
   <!DOCTYPE html>
   <html>
   <head>
   <title>Welcome to nginx!</title>
   <style>
   html { color-scheme: light dark; }
   body { width: 35em; margin: 0 auto;
   font-family: Tahoma, Verdana, Arial, sans-serif; }
   </style>
   </head>
   <body>
   <h1>Welcome to nginx!</h1>
   <p>If you see this page, the nginx web server is successfully installed and
   working. Further configuration is required.</p>
   
   <p>For online documentation and support please refer to
   <a href="http://nginx.org/">nginx.org</a>.<br/>
   Commercial support is available at
   <a href="http://nginx.com/">nginx.com</a>.</p>
   
   <p><em>Thank you for using nginx.</em></p>
   </body>
   </html>
   ```

## 参考资料

* https://kubernetes.io/zh-cn/docs/concepts/overview/working-with-objects/_print/

* https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/namespaces/
* https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/#using-pods
* https://kubernetes.io/zh-cn/docs/tasks/access-application-cluster/communicate-containers-same-pod-shared-volume/