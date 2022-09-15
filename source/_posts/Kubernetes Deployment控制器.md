---
title: Kubernetes Deployment 控制器
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-20 23:45:44
password:
summary: 通过实践来理解 Kubernetes Deployment控制器的能力
tags: Kubernetes
categories: Kubernetes
---


# Kubernetes Deployment控制器

Deployment 是 Kubernetes 中最常见的控制器，实际上它是一个**两层控制器**。

- 首先，它通过 **ReplicaSet 的个数**来描述应用的版本；
- 然后，它再通过 **ReplicaSet 的属性**（比如 replicas 的值），来保证 Pod 的副本数量。

> 注：Deployment 控制 ReplicaSet（版本），ReplicaSet 控制 Pod（副本数）。这个两层控制关系一定要牢记。

Deployment 是 Kubernetes 编排能力的一种提现，通过 Deployment 我们可以让 Pod 稳定的维持在指定的数量，除此之外还有滚动更新、版本回滚等功能。

## Deployment

### 自愈能力

我们通过一个例子来演示来Deployment的自愈能力。

通过 kubectl run 来创建一个 mynginx Pod

```shell
[root@k8s-master ~]# kubectl run mynginx --image=nginx
pod/mynginx created
```

通过 kubectl create deployment 来创建一个 mytomcat Pod

```shell
[root@k8s-master ~]# kubectl create deployment mytomcat --image=tomcat:8.5.68
deployment.apps/mytomcat created
```

我们比较下这两种方式分别创建的 Pod 有什么不同？

首先把 kubectl run 修建的 mynginx  Pod 删除了

```shell
[root@k8s-master ~]# kubectl get pod
NAME                        READY   STATUS    RESTARTS   AGE
mynginx                     1/1     Running   0          94s
mytomcat-6f5f895f4f-b5ckr   1/1     Running   0          83s

[root@k8s-master ~]# kubectl delete pod mynginx
pod "mynginx" deleted

[root@k8s-master ~]# kubectl get pod           
NAME                        READY   STATUS    RESTARTS   AGE
mytomcat-6f5f895f4f-b5ckr   1/1     Running   0          100s
```

接着再删除 mytomcat Pod

```shell
[root@k8s-master ~]# kubectl delete pod mytomcat-6f5f895f4f-b5ckr 
pod "mytomcat-6f5f895f4f-b5ckr" deleted
```

再次查看 Pod

```shell
[root@k8s-master ~]# kubectl get pod
NAME                        READY   STATUS    RESTARTS   AGE
mytomcat-6f5f895f4f-j7w22   1/1     Running   0          17s
```

总结：通过 Deployment 创建的 Pod，不怕机器宕机或应用崩溃，Deployment创建的Pod它有**自愈能力**

如果想要删除呢？那就是删除本次部署

```shell
# 查看 deployment
[root@k8s-master ~]# kubectl get deploy
NAME       READY   UP-TO-DATE   AVAILABLE   AGE
mytomcat   1/1     1     
```

```shell
# 删除 deployment
[root@k8s-master ~]# kubectl delete deploy mytomcat
deployment.apps "mytomcat" deleted
```

```shell
[root@k8s-master ~]# kubectl get deploy   
No resources found in default namespace.
[root@k8s-master ~]# kubectl get pod
No resources found in default namespace.
```

### 多副本

* 命令行方式

  ```shell
  [root@k8s-master ~]# kubectl create deployment my-nginx-deployment --image=nginx --replicas=3
  deployment.apps/my-nginx-deployment created
  ```

  使用 `--replicas` 表示本次部署起多少个 Pod

  ```shell
  [root@k8s-master ~]# kubectl get deploy
  NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
  my-nginx-deployment   3/3     3            3           17s
  ```

  ```shell
  [root@k8s-master ~]# kubectl get pod -owide
  NAME                                   READY   STATUS    RESTARTS   AGE     IP                NODE        NOMINATED NODE   READINESS GATES
  my-nginx-deployment-799847ccc9-dx59g   1/1     Running   0          2m50s   192.168.36.70     k8s-node1   <none>           <none>
  my-nginx-deployment-799847ccc9-mfhpz   1/1     Running   0          2m50s   192.168.169.133   k8s-node2   <none>           <none>
  my-nginx-deployment-799847ccc9-xwlx4   1/1     Running   0          2m50s   192.168.36.71     k8s-node1   <none>           <none>
  ```

  因为在我们有台node2机器，可以看到 my-nginx-deployment Pod 分散到两台机器上部署

* 配置文件方式

  0. 先删除命令行方式创建的

     ```shell
     [root@k8s-master ~]# kubectl delete deploy my-nginx-deployment
     deployment.apps "my-nginx-deployment" deleted
     ```

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

     ```shell
     [root@k8s-master ~]# kubectl apply -f deployment/my-nginx-deployment.yaml 
     deployment.apps/my-nginx-deployment created
     ```

  3. 查看

     ```shell
     [root@k8s-master ~]# kubectl get deployment
     NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
     my-nginx-deployment   3/3     3            3           34s
     
     [root@k8s-master ~]# kubectl get pod
     NAME                                   READY   STATUS    RESTARTS   AGE
     my-nginx-deployment-799847ccc9-fj85l   1/1     Running   0          37s
     my-nginx-deployment-799847ccc9-n2xtn   1/1     Running   0          37s
     my-nginx-deployment-799847ccc9-tdtgx   1/1     Running   0          37s
     ```

### 扩缩容能力

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-scale.png)

首先我们部署 3 个实例的 Pod

```shell
[root@k8s-master ~]# kubectl get deployment
NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
my-nginx-deployment   3/3     3            3           20m
[root@k8s-master ~]# kubectl get pod
NAME                                   READY   STATUS    RESTARTS   AGE
my-nginx-deployment-799847ccc9-fj85l   1/1     Running   0          20m
my-nginx-deployment-799847ccc9-n2xtn   1/1     Running   0          20m
my-nginx-deployment-799847ccc9-tdtgx   1/1     Running   0          20m
```

* 命令行方式扩缩容

  进行扩容， --replicas=5 表示扩容到5个Pod

  ```shell
  [root@k8s-master ~]# kubectl scale --replicas=5 deployment/my-nginx-deployment
  deployment.apps/my-nginx-deployment scaled
  ```

  查看扩容后的Pod

  ```shell
  [root@k8s-master ~]# kubectl get pod
  NAME                                   READY   STATUS    RESTARTS   AGE
  my-nginx-deployment-799847ccc9-blrss   1/1     Running   0          56s
  my-nginx-deployment-799847ccc9-fj85l   1/1     Running   0          23m
  my-nginx-deployment-799847ccc9-n2xtn   1/1     Running   0          23m
  my-nginx-deployment-799847ccc9-tdtgx   1/1     Running   0          23m
  my-nginx-deployment-799847ccc9-v96gh   1/1     Running   0          56s
  ```

  进行缩容

  ```shell
  [root@k8s-master ~]# kubectl scale --replicas=3 deployment/my-nginx-deployment
  deployment.apps/my-nginx-deployment scaled
  ```

  查看缩容后的Pod

  ```shell
  [root@k8s-master ~]# kubectl get pod
  NAME                                   READY   STATUS    RESTARTS   AGE
  my-nginx-deployment-799847ccc9-fj85l   1/1     Running   0          24m
  my-nginx-deployment-799847ccc9-n2xtn   1/1     Running   0          24m
  my-nginx-deployment-799847ccc9-tdtgx   1/1     Running   0          24m
  ```

* 配置文件方式扩缩容

  ```shell
  [root@k8s-master ~]# kubectl get deploy
  NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
  my-nginx-deployment   3/3     3            3           27m
  
  # 修改 replicas: 4
  [root@k8s-master ~]# kubectl edit deployment my-nginx-deployment
  
  # 查看效果
  [root@k8s-master ~]# kubectl get pod
  NAME                                   READY   STATUS    RESTARTS   AGE
  my-nginx-deployment-799847ccc9-fj85l   1/1     Running   0          28m
  my-nginx-deployment-799847ccc9-n2xtn   1/1     Running   0          28m
  my-nginx-deployment-799847ccc9-nzm8x   1/1     Running   0          23s
  my-nginx-deployment-799847ccc9-tdtgx   1/1     Running   0          28m
  ```

### 故障转移能力

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-deployment.png)



下面我们来演示下自愈&故障转移能力

查看 pod 

```shell
[root@k8s-master ~]# kubectl get pod -owide
NAME                                   READY   STATUS    RESTARTS   AGE   IP                NODE        NOMINATED NODE   READINESS GATES
my-nginx-deployment-799847ccc9-fj85l   1/1     Running   0          40m   192.168.169.134   k8s-node2   <none>           <none>
my-nginx-deployment-799847ccc9-n2xtn   1/1     Running   0          40m   192.168.36.73     k8s-node1   <none>           <none>
my-nginx-deployment-799847ccc9-nzm8x   1/1     Running   0          11m   192.168.169.137   k8s-node2   <none>           <none>
my-nginx-deployment-799847ccc9-tdtgx   1/1     Running   0          40m   192.168.36.72     k8s-node1   <none>           <none>
```

监控pod

```shell
[root@k8s-master ~]# watch -n 1 kubectl get pod
Every 1.0s: kubectl get pod                                                                                                                                               Sun Aug 14 19:13:41 2022

NAME                                   READY   STATUS    RESTARTS   AGE
my-nginx-deployment-799847ccc9-fj85l   1/1     Running   0          41m
my-nginx-deployment-799847ccc9-n2xtn   1/1     Running   0          41m
my-nginx-deployment-799847ccc9-nzm8x   1/1     Running   0          13m
my-nginx-deployment-799847ccc9-tdtgx   1/1     Running   0          41m
```

在 k8s-node1 节点上停止容器

```shell
[root@k8s-node1 ~]# docker ps | grep my-nginx
4da287650d27   nginx                                                        "/docker-entrypoint.…"   42 minutes ago   Up 42 minutes             k8s_nginx_my-nginx-deployment-799847ccc9-n2xtn_default_8feb6cd8-1c8e-41ba-8f85-d365fd1cb88c_0
16e18c7b9c0d   nginx                                                        "/docker-entrypoint.…"   43 minutes ago   Up 43 minutes             k8s_nginx_my-nginx-deployment-799847ccc9-tdtgx_default_79e17be3-4d3c-4534-a1e0-efb03af8c282_0
1f201df2a201   registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/pause:3.2   "/pause"                 43 minutes ago   Up 43 minutes             k8s_POD_my-nginx-deployment-799847ccc9-n2xtn_default_8feb6cd8-1c8e-41ba-8f85-d365fd1cb88c_0
16b0091c2ea6   registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/pause:3.2   "/pause"                 43 minutes ago   Up 43 minutes             k8s_POD_my-nginx-deployment-799847ccc9-tdtgx_default_79e17be3-4d3c-4534-a1e0-
efb03af8c282_0

[root@k8s-node1 ~]# docker stop 4da287650d27
4da287650d27
```

观察 pod 的变化

```shell
[root@k8s-master ~]# watch -n 1 kubectl get pod
Every 1.0s: kubectl get pod                                                                                                                                               Sun Aug 14 19:16:38 2022

NAME                                   READY   STATUS    RESTARTS   AGE  
my-nginx-deployment-799847ccc9-fj85l   1/1     Running   0          44m  
my-nginx-deployment-799847ccc9-n2xtn   1/1     Running   1          44m  
my-nginx-deployment-799847ccc9-nzm8x   1/1     Running   0          15m  
my-nginx-deployment-799847ccc9-tdtgx   1/1     Running   0          44m  
```

可以看到  my-nginx-deployment-799847ccc9-n2xtn Pod 重启了一次



故障转移，我们可以对 k8s-node1 节点机器关机，关机后观察 pod 变化

### 滚动更新

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-deployment-rollout.png)



**将一个集群中正在运行的多个 Pod 版本，交替地逐一升级的过程，就是“滚动更新”。**

先将新版本的V2从0个扩容到1个Pod，接着将旧版本的V1 从3个缩容到2个，这样慢慢的最后V1缩为0个，V2扩到3个。

> 滚动更新好处就是，即使V2版本出现异常，此时也会有两个V1版本在运行，然后用户可以手动处理这种情况，比如停止更新或者回滚到V1版本

下面我们测试滚动更新

```shell
[root@k8s-master ~]# kubectl get deploy
NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
my-nginx-deployment   3/3     3            3           56m

[root@k8s-master ~]# kubectl get pod
NAME                                   READY   STATUS    RESTARTS   AGE
my-nginx-deployment-799847ccc9-fj85l   1/1     Running   0          56m
my-nginx-deployment-799847ccc9-n2xtn   1/1     Running   2          56m
my-nginx-deployment-799847ccc9-nzm8x   1/1     Running   0          28m
```

* 命令行方式

  ```shell
  [root@k8s-master ~]# kubectl set image deployment/my-nginx-deployment nginx=nginx:1.16.1 --record
  deployment.apps/my-nginx-deployment image updated
  
  # 观察变化
  [root@k8s-master ~]# watch -n 1 kubectl get pod
  Every 1.0s: kubectl get pod                                                                                                                                               Sun Aug 14 19:35:18 2022
  
  NAME                                   READY   STATUS              RESTARTS   AGE
  my-nginx-deployment-69dfcd645b-vptn2   0/1     ContainerCreating   0          17s
  my-nginx-deployment-799847ccc9-fj85l   1/1     Running             0          63m
  my-nginx-deployment-799847ccc9-n2xtn   1/1     Running             2          63m
  my-nginx-deployment-799847ccc9-nzm8x   1/1     Running             0          34m
  
  ```

  set image 表示我们要改变镜像，改变哪个镜像？改变的是 deployment/my-nginx-deployment 这个deployment 中的 nginx 镜像，把它镜像变为 nginx:1.16.1版本，--record 表示记录下本次版本的更新

* 配置文件方式

  ```shell
  # 修改 spec.template.spec.containers.image 值为 nginx:1.9.1
  kubectl edit deployment/my-nginx-deployment
  ```

### 版本回退

首先，我需要使用 `kubectl rollout history` 命令，查看每次 Deployment 变更对应的版本

```shell
# 查看历史记录

[root@k8s-master ~]#  kubectl rollout history deployment/my-nginx-deployment
deployment.apps/my-nginx-deployment 
REVISION  CHANGE-CAUSE
1         <none>
2         kubectl set image deployment/my-nginx-deployment nginx=nginx:1.16.1 --record=true
3         kubectl set image deployment/my-nginx-deployment nginx=nginx:1.16.1 --record=true
4         kubectl set image deployment/my-nginx-deployment nginx=nginx:1.16.1 --record=true


#查看某个历史详情
[root@k8s-master ~]# kubectl rollout history deployment/my-nginx-deployment --revision=2
deployment.apps/my-nginx-deployment with revision #2
Pod Template:
  Labels:       app=my-nginx-deployment
        pod-template-hash=69dfcd645b
  Annotations:  kubernetes.io/change-cause: kubectl set image deployment/my-nginx-deployment nginx=nginx:1.16.1 --record=true
  Containers:
   nginx:
    Image:      nginx:1.16.1
    Port:       <none>
    Host Port:  <none>
    Environment:        <none>
    Mounts:     <none>
  Volumes:      <none>

[root@k8s-master ~]# kubectl rollout history deployment/my-nginx-deployment --revision=3
deployment.apps/my-nginx-deployment with revision #3
Pod Template:
  Labels:       app=my-nginx-deployment
        pod-template-hash=dc798486d
  Annotations:  kubernetes.io/change-cause: kubectl set image deployment/my-nginx-deployment nginx=nginx:1.16.1 --record=true
  Containers:
   nginx:
    Image:      nginx:1.91
    Port:       <none>
    Host Port:  <none>
    Environment:        <none>
    Mounts:     <none>
  Volumes:      <none>

[root@k8s-master ~]# kubectl rollout history deployment/my-nginx-deployment --revision=4
deployment.apps/my-nginx-deployment with revision #4
Pod Template:
  Labels:       app=my-nginx-deployment
        pod-template-hash=64f546978b
  Annotations:  kubernetes.io/change-cause: kubectl set image deployment/my-nginx-deployment nginx=nginx:1.16.1 --record=true
  Containers:
   nginx:
    Image:      nginx:1.9.1
    Port:       <none>
    Host Port:  <none>
    Environment:        <none>
    Mounts:     <none>
  Volumes:      <none>
```

然后，我们就可以在 `kubectl rollout undo` 命令行最后，加上要回滚到的指定版本的版本号，就可以回滚到指定版本了。

```shell
#回滚(回到上次)
kubectl rollout undo deployment/my-nginx-deployment

#回滚(回到指定版本)
[root@k8s-master ~]# kubectl rollout undo deployment/my-nginx-deployment --to-revision=2
deployment.apps/my-nginx-deployment rolled back

#验证回退到了 1.16.1 版本
[root@k8s-master ~]# kubectl get deploy/my-nginx-deployment -oyaml | grep image
      {"apiVersion":"apps/v1","kind":"Deployment","metadata":{"annotations":{},"labels":{"app":"my-nginx-deployment"},"name":"my-nginx-deployment","namespace":"default"},"spec":{"replicas":3,"selector":{"matchLabels":{"app":"my-nginx-deployment"}},"template":{"metadata":{"labels":{"app":"my-nginx-deployment"}},"spec":{"containers":[{"image":"nginx","name":"nginx"}]}}}}
    kubernetes.io/change-cause: kubectl set image deployment/my-nginx-deployment nginx=nginx:1.16.1
                f:imagePullPolicy: {}
                f:image: {}
      - image: nginx:1.16.1
        imagePullPolicy: Always
```

## 参考资料

* https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/deployment/
* https://kubernetes.io/zh/docs/concepts/workloads/controllers/