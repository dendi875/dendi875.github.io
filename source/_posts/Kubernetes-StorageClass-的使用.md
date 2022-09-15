---
title: Kubernetes StorageClass 的使用
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-29 22:51:34
password:
summary:  Kubernetes StorageClass 动态 PV 的使用
tags: Kubernetes
categories: Kubernetes
---


# Kubernetes StorageClass 的使用

K8s中 `PV` 的创建一般分为两种，静态创建和动态创建。静态创建就是提前创建好很多PV，形成一个PV池，按照PVC的规格要求选择合适的进行供应。动态创建则不事先创建，而是根据PVC的规格要求，要求什么规格的就创建什么规格的。静态 PV 在很大程度上并不能满足我们的需求，比如我们有一个应用需要对存储的并发度要求比较高，而另外一个应用对读写速度又要求比较高，特别是对于 `StatefulSet` 类型的应用简单的来使用静态的 PV 就很不合适了，这种情况下我们就需要用到动态 PV，也就是 `StorageClass`。另外从资源的利用角度来讲，动态创建要更好一些。



## 创建 Provisioner

要使用 StorageClass，我们就得安装对应的自动配置程序，比如我们这里存储后端使用的是 nfs，那么我们就需要使用到一个 nfs-client 的自动配置程序，我们也叫它 Provisioner，这个程序使用我们已经配置好的 nfs 服务器，来自动创建持久卷，也就是自动帮我们创建 PV。

- 自动创建的 PV 以`${namespace}-${pvcName}-${pvName}`这样的命名格式创建在 NFS 服务器上的共享数据目录中
- 而当这个 PV 被回收后会以`archieved-${namespace}-${pvcName}-${pvName}`这样的命名格式存在 NFS 服务器上。

当然在部署`nfs-client`之前，我们需要先成功安装上 nfs 服务器，我们的 NFS 服务地址部署在 master 节点上，IP 是**172.31.0.2**，共享数据目录是**/nfs/data**，参考此前的安装 [Kubernetes 持久化存储PV 和 PVC 的使用](https://zhangquan.me/2022/08/21/kubernetes-chi-jiu-hua-cun-chu-pv-he-pvc-de-shi-yong/)

查看  NFS server 状态：

```shell
[root@k8s-master ~]# systemctl status nfs.service
● nfs-server.service - NFS server and services
   Loaded: loaded (/usr/lib/systemd/system/nfs-server.service; enabled; vendor preset: disabled)
  Drop-In: /run/systemd/generator/nfs-server.service.d
           └─order-with-mounts.conf
   Active: active (exited) since Mon 2022-08-29 22:13:42 CST; 1min 44s ago
  Process: 916 ExecStartPost=/bin/sh -c if systemctl -q is-active gssproxy; then systemctl reload gssproxy ; fi (code=exited, status=0/SUCCESS)
  Process: 893 ExecStart=/usr/sbin/rpc.nfsd $RPCNFSDARGS (code=exited, status=0/SUCCESS)
  Process: 887 ExecStartPre=/usr/sbin/exportfs -r (code=exited, status=0/SUCCESS)
 Main PID: 893 (code=exited, status=0/SUCCESS)
    Tasks: 0
   Memory: 0B
   CGroup: /system.slice/nfs-server.service

Aug 29 22:13:42 k8s-master systemd[1]: Starting NFS server and services...
Aug 29 22:13:42 k8s-master systemd[1]: Started NFS server and services.
```

然后接下来我们部署 nfs-client 即可，我们也可以直接参考[nfs-client 的文档](https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner/tree/master/deploy)，进行安装即可。

开始之前先创建一个文件夹来保存我们的资源文件：

```shell
[root@k8s-master ~]# mkdir ~/nfs-storage-class
[root@k8s-master ~]# cd ~/nfs-storage-class
```

**第一步**：配置 Deployment，将里面的对应的参数替换成我们自己的 nfs 配置 deployment.yaml

参考：https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner/blob/master/deploy/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nfs-client-provisioner
  labels:
    app: nfs-client-provisioner
  namespace: default  
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: nfs-client-provisioner  
  template:
    metadata:
      labels:
        app: nfs-client-provisioner
    spec:
      serviceAccountName: nfs-client-provisioner
      containers:
        - name: nfs-client-provisioner
          image: k8s.gcr.io/sig-storage/nfs-subdir-external-provisioner:v4.0.2
          volumeMounts:
            - name: nfs-client-root
              mountPath: /persistentvolumes
          env:
            - name: PROVISIONER_NAME
              value: k8s-sigs.io/nfs-subdir-external-provisioner
            - name: NFS_SERVER
              value: 172.31.0.2
            - name: NFS_PATH
              value: /nfs/data
      volumes:
        - name: nfs-client-root
          nfs:
            server: 172.31.0.2
            path: /nfs/data
```

**第二步**：将环境变量 NFS_SERVER 和 NFS_PATH 替换，当然也包括下面的 nfs 配置，我们可以看到我们这里使用了一个名为 nfs-client-provisioner 的`serviceAccount`，所以我们也需要创建一个 sa，然后绑定上对应的权限：rbac.yaml

参考：https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner/blob/master/deploy/rbac.yaml

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nfs-client-provisioner
  # replace with namespace where provisioner is deployed
  namespace: default
---
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: nfs-client-provisioner-runner
rules:
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["persistentvolumes"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "update"]
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create", "update", "patch"]
---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: run-nfs-client-provisioner
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    # replace with namespace where provisioner is deployed
    namespace: default
roleRef:
  kind: ClusterRole
  name: nfs-client-provisioner-runner
  apiGroup: rbac.authorization.k8s.io
---
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: leader-locking-nfs-client-provisioner
  # replace with namespace where provisioner is deployed
  namespace: default
rules:
  - apiGroups: [""]
    resources: ["endpoints"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
---
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: leader-locking-nfs-client-provisioner
  # replace with namespace where provisioner is deployed
  namespace: default
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    # replace with namespace where provisioner is deployed
    namespace: default
roleRef:
  kind: Role
  name: leader-locking-nfs-client-provisioner
  apiGroup: rbac.authorization.k8s.io
```

我们这里新建的一个名为 nfs-client-provisioner 的`ServiceAccount`，然后绑定了一个名为 nfs-client-provisioner-runner 的`ClusterRole`，而该`ClusterRole`声明了一些权限，其中就包括对`persistentvolumes`的增、删、改、查等权限，所以我们可以利用该`ServiceAccount`来自动创建 PV。

**第三步**：nfs-client 的 Deployment 声明完成后，我们就可以来创建一个`StorageClass`对象了：class.yaml

参考：https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner/blob/master/deploy/class.yaml

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-client
provisioner: k8s-sigs.io/nfs-subdir-external-provisioner # or choose another name, must match deployment's env PROVISIONER_NAME'
parameters:
  archiveOnDelete: "false"
```

我们声明了一个名为 nfs-client  的`StorageClass`对象，注意下面的`provisioner`对应的值一定要和上面的`Deployment`下面的 PROVISIONER_NAME 这个环境变量的值一样。

现在我们来创建这些资源对象：

```shell
[root@k8s-master nfs-storage-class]# kubectl create -f deployment.yaml
deployment.apps/nfs-client-provisioner created

[root@k8s-master nfs-storage-class]# kubectl create -f rbac.yaml
serviceaccount/nfs-client-provisioner created
clusterrole.rbac.authorization.k8s.io/nfs-client-provisioner-runner created
clusterrolebinding.rbac.authorization.k8s.io/run-nfs-client-provisioner created
role.rbac.authorization.k8s.io/leader-locking-nfs-client-provisioner created
rolebinding.rbac.authorization.k8s.io/leader-locking-nfs-client-provisioner created

[root@k8s-master nfs-storage-class]# kubectl create -f class.yaml
storageclass.storage.k8s.io/nfs-client created
```

创建完成后查看下资源状态：

```shell
[root@k8s-master nfs-storage-class]# kubectl get deployment
NAME                     READY   UP-TO-DATE   AVAILABLE   AGE
......
nfs-client-provisioner   1/1     1            1           6m50s
......

[root@k8s-master nfs-storage-class]# kubectl get pods
NAME                                      READY   STATUS    RESTARTS   AGE
......
nfs-client-provisioner-6457456d4b-w54q6   1/1     Running   0          36s
......

[root@k8s-master nfs-storage-class]# kubectl get storageclass
NAME         PROVISIONER                                   RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
nfs-client   k8s-sigs.io/nfs-subdir-external-provisioner   Delete          Immediate           false                  60s
```

## 新建 PVC

上面把`StorageClass`资源对象创建成功了，接下来我们来通过一个示例测试下动态 PV，首先创建一个 PVC 对象：test-claim.yaml

参考：https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner/blob/master/deploy/test-claim.yaml

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: test-claim
spec:
  storageClassName: nfs-client
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 1Mi
```

我们这里声明了一个`PVC`对象，采用 `ReadWriteMany` 的访问模式，请求 1Mi 的空间，我们可以看到上面的 PVC 和  nfs-client 这个 StorageClass 相关联，这个 PVC 对象能够自动绑定到 nfs-client 这个动态 PV 对象上。

直接创建即可：

```shell
[root@k8s-master nfs-storage-class]#  kubectl create -f test-claim.yaml
persistentvolumeclaim/test-claim created
 
[root@k8s-master nfs-storage-class]# kubectl get pvc
NAME         STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
test-claim   Bound    pvc-c3d960df-2561-43cb-add2-357cc2d3ad55   1Mi        RWX            nfs-client     9s
```

我们可以看到一个名为 test-claim 的 PVC 对象创建成功了，状态已经是`Bound`了，是不是也产生了一个对应的`VOLUME` 对象，最重要的一栏是`STORAGECLASS`，现在是不是也有值了，就是我们刚刚创建的`StorageClass`对象 nfs-client。

然后查看下 PV 对象：

```shell
[root@k8s-master nfs-storage-class]# kubectl get pv
NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                STORAGECLASS   REASON   AGE
pvc-c3d960df-2561-43cb-add2-357cc2d3ad55   1Mi        RWX            Delete           Bound    default/test-claim   nfs-client              54s
```

可以看到是不是自动生成了一个关联的 PV 对象，访问模式是`RWX`，回收策略是 `Delete`，这个 PV 对象并不是我们手动创建的吧，这是通过我们上面的 `StorageClass` 对象自动创建的。这就是 StorageClass 的创建方法。

## 测试

接下来我们还是用一个简单的示例来测试下我们上面用 StorageClass 方式声明的 PVC 对象：test-pod.yaml

参考：https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner/blob/master/deploy/test-pod.yaml

```yaml
kind: Pod
apiVersion: v1
metadata:
  name: test-pod
spec:
  containers:
  - name: test-pod
    image: busybox
    imagePullPolicy: IfNotPresent
    command:
    - "/bin/sh"
    args:
    - "-c"
    - "touch /mnt/SUCCESS && exit 0 || exit 1"
    volumeMounts:
    - name: nfs-pvc
      mountPath: "/mnt"
  restartPolicy: "Never"
  volumes:
  - name: nfs-pvc
    persistentVolumeClaim:
      claimName: test-claim
```

上面这个 Pod 非常简单，就是用一个 **busybox** 容器，在 /mnt 目录下面新建一个 SUCCESS 的文件，然后把 /mnt 目录挂载到上面我们新建的 test-claim 这个资源对象上面了，要验证很简单，只需要去查看下我们 nfs 服务器上面的共享数据目录下面是否有 SUCCESS 这个文件即可：

```shell
[root@k8s-master nfs-storage-class]#  kubectl create -f test-pod.yaml
pod/test-pod created
```

然后我们可以在 nfs 服务器的共享数据目录下面查看下数据：

```shell
[root@k8s-master nfs-storage-class]# ls -l /nfs/data/
total 4
drwxr-xr-x 2 root root  6 Aug 21 22:19 01
drwxr-xr-x 2 root root 24 Aug 21 22:24 02
drwxr-xr-x 2 root root  6 Aug 21 22:19 03
drwxrwxrwx 2 root root 21 Aug 29 22:23 default-test-claim-pvc-c3d960df-2561-43cb-add2-357cc2d3ad55
drwxr-xr-x 2 root root 24 Aug 21 21:26 nginx-pv
-rw-r--r-- 1 root root 17 Aug 21 20:56 test.txt
```

我们可以看到下面有名字很长的文件夹，这个文件夹的命名方式是不是和我们上面的规则：**${namespace}-${pvcName}-${pvName}**是一样的，再看下这个文件夹下面是否有其他文件：

```shell
[root@k8s-master nfs-storage-class]# ls /nfs/data/default-test-claim-pvc-c3d960df-2561-43cb-add2-357cc2d3ad55/
SUCCESS
```

我们看到下面有一个 SUCCESS 的文件，证明我们上面的验证是成功的。

另外我们可以看到我们这里是手动创建的一个 PVC 对象，在实际工作中，使用 StorageClass 更多的是 StatefulSet 类型的服务，`StatefulSet`类型的服务我们也可以通过一个`volumeClaimTemplates`属性来直接使用 StorageClass，如下：test-statefulset-nfs.yaml

参考：https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/statefulset/

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  selector:
    matchLabels:
      app: nginx # 必须匹配 .spec.template.metadata.labels
  serviceName: "nginx"
  replicas: 3
  template:
    metadata:
      labels:
        app: nginx  # 必须匹配 .spec.selector.matchLabels
    spec:
      terminationGracePeriodSeconds: 10
      containers:
      - name: nginx
        image: nginx:1.7.9
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 80
          name: web
        volumeMounts:
        - name: www
          mountPath: /usr/share/nginx/html
  volumeClaimTemplates:  #让它自动创建一个 PVC，这和上面 test-claim.yaml 一样
  - metadata:
      name: www # pvc 名字
    spec:
      storageClassName: nfs-client
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 1Gi
```

实际上 volumeClaimTemplates 下面就是一个 PVC 对象的模板，就类似于我们这里 StatefulSet 下面的 template，实际上就是一个 Pod 的模板，我们不单独创建成 PVC 对象，而用这种模板就可以动态的去创建了对象，这种方式在 StatefulSet 类型的服务下面使用得非常多。

直接创建上面的对象：

```shell
[root@k8s-master nfs-storage-class]#  kubectl create -f test-statefulset-nfs.yaml
statefulset.apps/web created
 
[root@k8s-master nfs-storage-class]# kubectl get pods
NAME                                      READY   STATUS      RESTARTS   AGE
......
web-0                                     1/1     Running     0          76s
web-1                                     1/1     Running     0          20s
web-2                                     1/1     Running     0          15s
......
```

创建完成后可以看到上面的3个 Pod 已经运行成功，然后查看下 PVC 对象：

```shell
[root@k8s-master nfs-storage-class]# kubectl get pvc
NAME         STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
test-claim   Bound    pvc-c3d960df-2561-43cb-add2-357cc2d3ad55   1Mi        RWX            nfs-client     25m
www-web-0    Bound    pvc-6e6916f2-275b-4bc8-9097-dd96b0e06d8b   1Gi        RWO            nfs-client     106s
www-web-1    Bound    pvc-fc8f5e03-be8c-422c-81c8-3c3374392791   1Gi        RWO            nfs-client     50s
www-web-2    Bound    pvc-e0d2d4ab-a29f-4bc4-8283-17448a1ebff1   1Gi        RWO            nfs-client     45s
```

我们可以看到是不是也生成了3个 PVC 对象，名称由模板名称 name 加上 Pod 的名称组合而成，这3个 PVC 对象也都是 绑定状态了，很显然我们查看 PV 也可以看到对应的3个 PV 对象：

```shell
[root@k8s-master nfs-storage-class]# kubectl get pv
NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                STORAGECLASS   REASON   AGE
pvc-6e6916f2-275b-4bc8-9097-dd96b0e06d8b   1Gi        RWO            Delete           Bound    default/www-web-0    nfs-client              2m19s
pvc-c3d960df-2561-43cb-add2-357cc2d3ad55   1Mi        RWX            Delete           Bound    default/test-claim   nfs-client              25m
pvc-e0d2d4ab-a29f-4bc4-8283-17448a1ebff1   1Gi        RWO            Delete           Bound    default/www-web-2    nfs-client              78s
pvc-fc8f5e03-be8c-422c-81c8-3c3374392791   1Gi        RWO            Delete           Bound    default/www-web-1    nfs-client              83s
```

查看 nfs 服务器上面的共享数据目录：

```shell
[root@k8s-master nfs-storage-class]# ls -l /nfs/data/
total 4
drwxr-xr-x 2 root root  6 Aug 21 22:19 01
drwxr-xr-x 2 root root 24 Aug 21 22:24 02
drwxr-xr-x 2 root root  6 Aug 21 22:19 03
drwxrwxrwx 2 root root 21 Aug 29 22:23 default-test-claim-pvc-c3d960df-2561-43cb-add2-357cc2d3ad55
drwxrwxrwx 2 root root  6 Aug 29 22:43 default-www-web-0-pvc-6e6916f2-275b-4bc8-9097-dd96b0e06d8b
drwxrwxrwx 2 root root  6 Aug 29 22:44 default-www-web-1-pvc-fc8f5e03-be8c-422c-81c8-3c3374392791
drwxrwxrwx 2 root root  6 Aug 29 22:44 default-www-web-2-pvc-e0d2d4ab-a29f-4bc4-8283-17448a1ebff1
drwxr-xr-x 2 root root 24 Aug 21 21:26 nginx-pv
-rw-r--r-- 1 root root 17 Aug 21 20:56 test.txt
```

也有对应的3个数据目录，这就是我们的 StorageClass 简单使用方法。

## 参考

* https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner
* https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/statefulset/
* https://www.qikqiak.com/post/kubernetes-persistent-volume2/