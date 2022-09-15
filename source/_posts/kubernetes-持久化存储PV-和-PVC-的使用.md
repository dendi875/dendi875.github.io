---
title: Kubernetes 持久化存储PV 和 PVC 的使用
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-21 22:41:09
password:
summary: Kubernetes 持久化存储PV 和 PVC 的使用
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes 持久化存储PV 和 PVC 的使用

我们知道可以通过 `hostPath` 或者 `emptyDir` 的方式来持久化我们的数据，但是显然我们还需要更加可靠的存储来保存应用的持久化数据，这样容器在重建后，依然可以使用之前的数据。但是显然存储资源和 CPU 资源以及内存资源有很大不同，为了屏蔽底层的技术实现细节，让用户更加方便的使用，`Kubernetes` 便引入了 `PV` 和 `PVC` 两个重要的资源对象来实现对存储的管理。

## 概念

`PV` 的全称是：`PersistentVolume`（持久化卷），是对底层的共享存储的一种抽象，PV 由管理员进行创建和配置，它和具体的底层的共享存储技术的实现方式有关，比如 `Ceph`、`GlusterFS`、`NFS` 等，都是通过插件机制完成与共享存储的对接。

`PVC` 的全称是：`PersistentVolumeClaim`（持久化卷声明），PVC 是用户存储的一种声明，PVC 和 Pod 比较类似，Pod 消耗的是节点，PVC 消耗的是 PV 资源，Pod 可以请求 CPU 和内存，而 PVC 可以请求特定的存储空间和访问模式。对于真正使用存储的用户不需要关心底层的存储实现细节，只需要直接使用 PVC 即可。

但是通过 PVC 请求到一定的存储空间也很有可能不足以满足应用对于存储设备的各种需求，而且不同的应用程序对于存储性能的要求可能也不尽相同，比如读写速度、并发性能等，为了解决这一问题，Kubernetes 又为我们引入了一个新的资源对象：`StorageClass`，通过 StorageClass 的定义，管理员可以将存储资源定义为某种类型的资源，比如快速存储、慢速存储等，用户根据 StorageClass 的描述就可以非常直观的知道各种存储资源的具体特性了，这样就可以根据应用的特性去申请合适的存储资源了。

## NFS

我们这里为了演示方便，使用相对简单的 NFS 这种存储资源，接下来我们在节点 **k8s-master** 上来安装 NFS 服务器，数据目录：/nfs/data，k8s-node1，k8s-node2安装NFS 客户端

### k8s-master 节点上操作

* 安装 NFS 服务器软件

  ```shell
  yum install -y  nfs-utils rpcbind
  ```

* 创建挂载目录并设置权限

  ```shell
  # 创建挂载目录
  mkdir -p /nfs/data
  
  # 设置权限
  chmod 755 /nfs/data
  ```

* 配置 nfs，nfs 的默认配置文件在 /etc/exports 文件下，在该文件中添加下面的配置信息：

  ```shell
  $ vi /etc/exports
  /nfs/data/ *(insecure,rw,sync,no_root_squash)
  ```

  配置说明：

  - `/nfs/data/`：是共享的数据目录

  - `*`：表示任何人都有权限连接，当然也可以是一个网段，一个 IP，也可以是域名

  - insecure：允许客户端从大于1024的tcp/ip端口连接服务器

  - rw：读写的权限

  - sync：表示文件同时写入硬盘和内存

  - no_root_squash：当登录 NFS 主机使用共享目录的使用者是 root 时，其权限将被转换成为匿名使用者，通常它的 UID 与 GID，都会变成 nobody 身份

    当然 nfs 的配置还有很多，感兴趣的同学可以在网上去查找一下。

* 先启动 rpcbind

  ```shell
  [root@k8s-master ~]# systemctl start rpcbind.service
  [root@k8s-master ~]# systemctl enable rpcbind
  [root@k8s-master ~]# systemctl status rpcbind
  ● rpcbind.service - RPC bind service
     Loaded: loaded (/usr/lib/systemd/system/rpcbind.service; enabled; vendor preset: enabled)
     Active: active (running) since Sun 2022-08-21 20:40:07 CST; 9s ago
   Main PID: 5229 (rpcbind)
     CGroup: /system.slice/rpcbind.service
             └─5229 /sbin/rpcbind -w
  
  Aug 21 20:40:07 k8s-master systemd[1]: Starting RPC bind service...
  Aug 21 20:40:07 k8s-master systemd[1]: Started RPC bind service.
  ```

* 然后启动 nfs 服务器

  ```shell
  [root@k8s-master ~]# systemctl start nfs.service
  [root@k8s-master ~]# systemctl enable nfs
  Created symlink from /etc/systemd/system/multi-user.target.wants/nfs-server.service to /usr/lib/systemd/system/nfs-server.service.
  [root@k8s-master ~]# systemctl status nfs
  ● nfs-server.service - NFS server and services
     Loaded: loaded (/usr/lib/systemd/system/nfs-server.service; enabled; vendor preset: disabled)
    Drop-In: /run/systemd/generator/nfs-server.service.d
             └─order-with-mounts.conf
     Active: active (exited) since Sun 2022-08-21 20:40:32 CST; 9s ago
   Main PID: 5689 (code=exited, status=0/SUCCESS)
     CGroup: /system.slice/nfs-server.service
  
  Aug 21 20:40:32 k8s-master systemd[1]: Starting NFS server and services...
  Aug 21 20:40:32 k8s-master systemd[1]: Started NFS server and services.
  ```

* 使配置生效

  ```shell
   exportfs -r
  ```

* 确认配置

  ```shell
  [root@k8s-master ~]# exportfs
  /nfs/data       <world>
  ```

### K8s-node1、k8s-node2 节点上操作

到这里我们就把 nfs server 给安装成功了，接下来我们在 node 节点上来安装 nfs 的客户端来验证下 nfs

* 安装 NFS客户端 软件

  ```shell
  yum install -y  nfs-utils rpcbind
  ```

* 挂载数据目录 客户端启动完成后，我们在客户端来挂载下 nfs 测试下

  * 查看下 NFS 服务器有哪些目录供我们挂载

    ```shell
    # 使用内网 ip 查看就行
    [root@k8s-node1 ~]# showmount -e 172.31.0.2
    Export list for 172.31.0.2:
    /nfs/data *
    ```

  * 然后我们在客户端上新建目录

    ```shell
    mkdir -p /root/nfsmount
    ```

  * 将 nfs 共享目录挂载到上面的目录

    ```shell
    mount -t nfs 172.31.0.2:/nfs/data /root/nfsmount
    ```

* 挂载成功后，在客户端上面的目录中新建一个文件，然后我们观察下 nfs 服务端的共享目录下面是否也会出现该文件

  ```shell
  # 在 nfs server 上写一个测试文件
  [root@k8s-master ~]# echo "hello nfs server" > /nfs/data/test.txt 
  
  # 然后在 nfs client端查看
  [root@k8s-node1 ~]# cat /root/nfsmount/test.txt 
  hello nfs server
  
  [root@k8s-node2 ~]# cat /root/nfsmount/test.txt 
  hello nfs server
  ```

## 原生方式数据挂载

* 资源文件 nginx-pv-demo.yaml 

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: nginx-pv-demo
  name: nginx-pv-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-pv-demo
  template:
    metadata:
      labels:
        app: nginx-pv-demo
    spec:
      containers:
      - image: nginx
        name: nginx
        volumeMounts:
        - name: html
          mountPath: /usr/share/nginx/html
      volumes:
        - name: html
          nfs:
            server: 172.31.0.2 #写上自己master节点的内网ip
            path: /nfs/data/nginx-pv
```

上面资源清单文件的意思是我们生成两个Pod，这两个Pod的镜像来自nginx，`volumeMounts.mountPath: /usr/share/nginx/html` 表示需要挂载，挂载到`nvolumeMounts.name: html`，最终效果就是 `/usr/share/nginx/html` 目录与`/nfs/data/nginx-pv`目录操持同步

* 创建目录

  ```shell
  mkdir /nfs/data/nginx-pv
  ```

* 执行资源清单

  ```shell
  [root@k8s-master ~]# kubectl apply -f storage/nginx-pv-demo.yaml 
  deployment.apps/nginx-pv-demo created
  ```

* 查看部署

  ```shell
  [root@k8s-master ~]# kubectl get deploy
  NAME            READY   UP-TO-DATE   AVAILABLE   AGE
  nginx-pv-demo   2/2     2            2           8m43s
  
  [root@k8s-master ~]# kubectl get pods
  NAME                             READY   STATUS    RESTARTS   AGE
  nginx-pv-demo-6ff58db964-c7vqw   1/1     Running   0          8m48s
  nginx-pv-demo-6ff58db964-ggzp7   1/1     Running   0          8m48s
  ```

* 修改挂载目录后，测试Pod中的目录也同步修改

  * 查看挂载目录 

    ```shell
    [root@k8s-master ~]# ll /nfs/data/nginx-pv/
    total 0
    ```

  * 修改 nginx 默认首页

    ```shell
    [root@k8s-master ~]# echo "success" > /nfs/data/nginx-pv/index.html   
    ```

  * 进入 Pod 中查看

    ```shell
    # 第一个 pod
    [root@k8s-master ~]# kubectl exec -it nginx-pv-demo-6ff58db964-c7vqw -- /bin/bash
    root@nginx-pv-demo-6ff58db964-c7vqw:/# curl localhost
    success
    root@nginx-pv-demo-6ff58db964-c7vqw:/# cat /usr/share/nginx/html/index.html 
    success
    
    # 第二个 pod
    [root@k8s-master ~]# kubectl exec -it nginx-pv-demo-6ff58db964-ggzp7 -- /bin/bash
    root@nginx-pv-demo-6ff58db964-ggzp7:/# curl localhost
    success
    root@nginx-pv-demo-6ff58db964-ggzp7:/# cat /usr/share/nginx/html/index.html 
    success
    ```

    

原生方式数据挂载的方式有以下几个问题：

1. 要挂载的目录需要我们手动创建，比如上面的 `nfs/data/nginx-pv`目录 

2. 我们把部署的Pod删除之后，我们挂载的文件还存在，不会跟着Pod一起删除，下面我们来验证这一点

   ```shell
   # 删除上面原生方式数据挂载产生的 Pod
   [root@k8s-master ~]# kubectl delete -f storage/nginx-pv-demo.yaml 
   deployment.apps "nginx-pv-demo" deleted
   
   # 查看挂载目录
   [root@k8s-master ~]# cat  /nfs/data/nginx-pv/index.html   
   success
   ```

3. 对于 Pod 挂载的的目录没有存储容易的限制

所以我们就有了 PV，PVC 挂载方式

## PV 与 PVC

下面我们来使用 PV 和 PVC 了。PV 作为存储资源，主要包括存储能力、访问模式、存储类型、回收策略等关键信息，可以把上面`/nfs/data/nginx-pv` 目录比作持久卷。持久卷就是我们的数据要存在哪？数据存储的位置叫做持久卷，PVC 相当于申请，你的Pod想要申请多大的磁盘空间。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-storage-pv.png)

下面我们来测试下 PV 与PVC的使用



### 创建 pv 池

我的场地先创建出来做准备好，你Pod如果要使用就写好申请书（PVC）来申请

* nfs 服务器上（master节点上）执行

  ```shell
  mkdir -p /nfs/data/01
  mkdir -p /nfs/data/02
  mkdir -p /nfs/data/03
  ```

* 准备资源文件 nfs-pv.yaml

  ```yaml
  apiVersion: v1
  kind: PersistentVolume  # 持久化卷
  metadata:
    name: pv01-10m
  spec:
    capacity:    #限制存储容量
      storage: 10M
    accessModes:
      - ReadWriteMany  #可读可写
    storageClassName: nfs  #取一个storageClassName名称
    nfs:
      path: /nfs/data/01
      server: 172.31.0.2 #nfs服务器的ip
  ---
  apiVersion: v1
  kind: PersistentVolume  # 持久化卷
  metadata: 
    name: pv02-1gi
  spec:
    capacity:
      storage: 1Gi
    accessModes:
      - ReadWriteMany
    storageClassName: nfs
    nfs:
      path: /nfs/data/02
      server: 172.31.0.2 #nfs服务器的ip
  ---
  apiVersion: v1
  kind: PersistentVolume
  metadata:
    name: pv03-3gi  # g要小写
  spec:
    capacity:
      storage: 3Gi
    accessModes:
      - ReadWriteMany
    storageClassName: nfs
    nfs:
      path: /nfs/data/03
      server: 172.31.0.2  #nfs服务器的ip
  ```

* 执行上面的资源文件

  ```shell
  [root@k8s-master ~]# kubectl apply -f storage/nfs-pv.yaml 
  persistentvolume/pv01-10m created
  persistentvolume/pv02-1gi created
  persistentvolume/pv03-3gi created
  ```

* 查看PV

  ```shell
  [root@k8s-master ~]# kubectl get pv
  NAME       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM   STORAGECLASS   REASON   AGE
  pv01-10m   10M        RWX            Retain           Available           nfs                     22s
  pv02-1gi   1Gi        RWX            Retain           Available           nfs                     22s
  pv03-3gi   3Gi        RWX            Retain           Available           nfs                     22s
  ```

  

### 创建 pvc

pvc 相当于我们的申请书，可以类比学校里在操场上搞活动，场地（pv）已经有了，哪个班级需要使用多大的场地就写一份申请书来申请场地

* 准备nfs-pvc.yaml

  ```yaml
  kind: PersistentVolumeClaim
  apiVersion: v1
  metadata:
    name: nginx-pvc #申请书名称随便写
  spec:
    accessModes:
      - ReadWriteMany
    resources:
      requests:
        storage: 200Mi # 我需要一个 200M的空间
    storageClassName: nfs #这个值要和 nfs-pv.yaml中的 storageClassName 值一致
  ```

* 执行创建

  ```shell
  [root@k8s-master ~]# kubectl apply -f storage/nfs-pvc.yaml 
  persistentvolumeclaim/nginx-pvc created
  ```

* 查看pvc，pv情况

  ```shell
  [root@k8s-master ~]# kubectl get pvc
  NAME        STATUS   VOLUME     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
  nginx-pvc   Bound    pv02-1gi   1Gi        RWX            nfs            2m11s
  
  [root@k8s-master ~]# kubectl get pv
  NAME       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM               STORAGECLASS   REASON   AGE
  pv01-10m   10M        RWX            Retain           Available                       nfs                     11m
  pv02-1gi   1Gi        RWX            Retain           Bound       default/nginx-pvc   nfs                     11m
  pv03-3gi   3Gi        RWX            Retain           Available                       nfs                     11m
  ```

### 创建Pod绑定PVC

* 准备 nginx-deploy-pvc.yaml 

  ```yaml
  apiVersion: apps/v1
  kind: Deployment
  metadata:
    labels:
      app: nginx-deploy-pvc
    name: nginx-deploy-pvc
  spec:
    replicas: 2
    selector:
      matchLabels:
        app: nginx-deploy-pvc
    template:
      metadata:
        labels:
          app: nginx-deploy-pvc
      spec:
        containers:
        - image: nginx
          name: nginx
          volumeMounts:
          - name: html
            mountPath: /usr/share/nginx/html
        volumes:
          - name: html
            persistentVolumeClaim:
              claimName: nginx-pvc    # pvc名称（申请书名称）
  ```

比原生方式数据挂载的比较 volumes 使用的是 persistentVolumeClaim

表示 `/usr/share/nginx/html`目录与申请书 `nginx-pvc`内容保持一致的

* 执行

  ```shell
  [root@k8s-master ~]# kubectl apply -f storage/nginx-deploy-pvc.yaml 
  deployment.apps/nginx-deploy-pvc created
  ```

* 查看

  ```shell
  [root@k8s-master ~]# kubectl get pods
  NAME                                READY   STATUS    RESTARTS   AGE
  nginx-deploy-pvc-79fc8558c7-9vswp   1/1     Running   0          18s
  nginx-deploy-pvc-79fc8558c7-pgtlb   1/1     Running   0          18s
  
  [root@k8s-master ~]# kubectl get pv,pvc
  NAME                        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM               STORAGECLASS   REASON   AGE
  persistentvolume/pv01-10m   10M        RWX            Retain           Available                       nfs                     25m
  persistentvolume/pv02-1gi   1Gi        RWX            Retain           Bound       default/nginx-pvc   nfs                     25m
  persistentvolume/pv03-3gi   3Gi        RWX            Retain           Available                       nfs                     25m
  
  NAME                              STATUS   VOLUME     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
  persistentvolumeclaim/nginx-pvc   Bound    pv02-1gi   1Gi        RWX            nfs            15m
  ```

* 修改内容，可以看到分配给 pv02-1gi ，所以修改 /nfs/data/02

  ```shell
  [root@k8s-master ~]# ll /nfs/data/02/
  total 0
  
  [root@k8s-master ~]# echo "hello,pv,pvc" > /nfs/data/02/index.html  
  ```

* 进入 Pod 中验证有效

  ```shell
  [root@k8s-master ~]# kubectl exec -it nginx-deploy-pvc-79fc8558c7-9vswp -- /bin/bash
  root@nginx-deploy-pvc-79fc8558c7-9vswp:/# curl localhost
  hello,pv,pvc
  root@nginx-deploy-pvc-79fc8558c7-9vswp:/# cat /usr/share/nginx/html/index.html 
  hello,pv,pvc
  
  [root@k8s-master ~]# kubectl exec -it nginx-deploy-pvc-79fc8558c7-pgtlb -- /bin/bash
  root@nginx-deploy-pvc-79fc8558c7-pgtlb:/# curl localhost
  hello,pv,pvc
  root@nginx-deploy-pvc-79fc8558c7-pgtlb:/# cat /usr/share/nginx/html/index.html 
  hello,pv,pvc
  ```

* 需要注意的是，我们上面手动创建 PV 的方式，即静态的 PV 管理方式，在删除 PV 时需要按如下流程执行操作：

  - 删除使用这个 PV 的 Pod
  - 从宿主机移除本地磁盘
  - 删除 PVC
  - 删除 PV