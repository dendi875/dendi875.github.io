---
title: Kubernetes ConfigMap 可变配置管理
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-24 18:42:41
password:
summary: Kubernetes ConfigMap 可变配置管理
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes ConfigMap 可变配置管理

我们经常都需要为我们的应用程序配置一些特殊的数据，比如密钥、Token 、数据库连接地址或者其他私密的信息。

对于应用的可变配置在 Kubernetes 中是通过一个 `ConfigMap` 资源对象来实现的，我们知道许多应用经常会有从配置文件、命令行参数或者环境变量中读取一些配置信息的需求，这些配置信息我们肯定不会直接写死到应用程序中去的，比如你一个应用连接一个 redis 服务，下一次想更换一个了的，还得重新去修改代码，重新制作一个镜像，这肯定是不可取的，而`ConfigMap` 就给我们提供了向容器中注入配置信息的能力，不仅可以用来保存单个属性，还可以用来保存整个配置文件，比如我们可以用来配置一个 redis 服务的访问地址，也可以用来保存整个 redis 的配置文件。接下来我们就来了解下 `ConfigMap` 这种资源对象的使用方法。

## 概述

ConfigMap 顾名思义，叫配置集。它是用于保存配置数据的键值对，可以用来保存单个属性，也可以保存配置文件。

> 就是把数据存放到 Etcd 中。然后，你就可以通过在 Pod 的容器里挂载 Volume 的方式，访问到这些 ConfigMap 里保存的信息。

configmap 简写为 cm，常用命令如下： 

```shell
# 创建
$ kubectl create configmap
# 删除
$ kubectl delete configmap ConfigMap名称
# 编辑
$ kubectl edit configmap ConfigMap名称
# 查看-列表
$ kubectl get configmap
# 查看-详情
$ kubectl describe configmap ConfigMap名称
```

## 创建

我们可以使用`kubectl create configmap -h`来查看关于创建 `ConfigMap` 的帮助信息：

```shell
Examples:
  # Create a new configmap named my-config based on folder bar
  kubectl create configmap my-config --from-file=path/to/bar
  
  # Create a new configmap named my-config with specified keys instead of file basenames on disk
  kubectl create configmap my-config --from-file=key1=/path/to/bar/file1.txt --from-file=key2=/path/to/bar/file2.txt
  
  # Create a new configmap named my-config with key1=config1 and key2=config2
  kubectl create configmap my-config --from-literal=key1=config1 --from-literal=key2=config2
  
  # Create a new configmap named my-config from the key=value pairs in the file
  kubectl create configmap my-config --from-file=path/to/bar
  
  # Create a new configmap named my-config from an env file
  kubectl create configmap my-config --from-env-file=path/to/bar.env

```

我们可以看到可以使用多种方式来创建ConfigMap

- 1）**yaml 描述文件**：事先写好标准的configmap的yaml文件，然后kubectl create -f 创建
- 2）**–from-file**：通过指定目录或文件创建，将一个或多个配置文件创建为一个ConfigMap
- 3）**–from-literal**：通过直接在命令行中通过 key-value 字符串方式指定configmap参数创建
- 4）**–from-env-file**：从 env 文件读取配置信息并创建为一个ConfigMap

### 从yaml描述文件创建 ConfigMap

cm-demo.yaml 如下：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cm-demo
  namespace: default
data:
  data.1: hello
  data.2: world
  config: |
    property.1=value-1
    property.2=value-2
    property.3=value-3
```

`ConfigMap` 资源对象使用 `key-value` 形式的键值对来配置数据，这些数据可以在 Pod 里面使用。其中配置数据在 `data` 属性下面进行配置，前两个被用来保存单个属性，后面一个被用来保存一个配置文件。

创建 configMap 

```shell
[root@k8s-master ~]# kubectl create -f cm/cm-demo.yaml 
configmap/cm-demo created
```

### 从一个给定的目录来创建ConfigMap

我们可以从一个给定的目录来创建一个 `ConfigMap` 对象，比如我们有一个 testcm 的目录，该目录下面包含一些配置文件，redis 和 mysql 的连接信息，如下：

```shell
$ ls testcm
redis.conf
mysql.conf

$ cat testcm/redis.conf
host=127.0.0.1
port=6379

$ cat testcm/mysql.conf
host=127.0.0.1
port=3306
```

然后我们就可以使用 `from-file` 关键字来创建包含这个目录下面所有配置文件的 `ConfigMap`：

```
[root@k8s-master ~]# kubectl create cm cm-demo1 --from-file=testcm
configmap/cm-demo1 created
```

其中 `from-file` 参数指定在该目录下面的所有文件都会被用在 `ConfigMap` 里面创建一个键值对，**键的名字就是文件名，值就是文件的内容**。创建完成后，同样我们可以使用如下命令来查看 `ConfigMap` 列表：

```shell
[root@k8s-master ~]# kubectl get cm
NAME               DATA   AGE
cm-demo            3      101s
cm-demo1           2      8s
kube-root-ca.crt   1      8d
```

可以看到已经创建了一个 cm-demo1 的 `ConfigMap` 对象，然后可以使用 `describe` 命令查看详细信息：

```shell
[root@k8s-master ~]# kubectl describe cm cm-demo1
Name:         cm-demo1
Namespace:    default
Labels:       <none>
Annotations:  <none>

Data
====
mysql.conf:
----
host=127.0.0.1
port=3306

redis.conf:
----
host=127.0.0.1
port=6379

Events:  <none>
```

我们可以看到两个 `key` 是 testcm 目录下面的文件名称，对应的 `value` 值就是文件内容，这里值得注意的是如果文件里面的配置信息很大的话，`describe` 的时候可能不会显示对应的值，要查看完整的键值，可以使用如下命令：

```shell
[root@k8s-master ~]# kubectl get cm cm-demo1 -o yaml
apiVersion: v1
data:
  mysql.conf: |
    host=127.0.0.1
    port=3306
  redis.conf: |
    host=127.0.0.1
    port=6379
kind: ConfigMap
metadata:
  creationTimestamp: "2022-08-22T06:39:38Z"
  managedFields:
  - apiVersion: v1
    fieldsType: FieldsV1
    fieldsV1:
      f:data:
        .: {}
        f:mysql.conf: {}
        f:redis.conf: {}
    manager: kubectl-create
    operation: Update
    time: "2022-08-22T06:39:38Z"
  name: cm-demo1
  namespace: default
  resourceVersion: "80137"
  uid: 2c23a5a2-b4ac-47e9-b0fa-a50d7395797c
```

### 使用指定的文件进行创建ConfigMap

以上面的配置文件为例，我们为 redis 的配置单独创建一个 `ConfigMap` 对象：

```shell
[root@k8s-master ~]# kubectl create cm cm-demo2 --from-file=testcm/redis.conf 
configmap/cm-demo2 created

[root@k8s-master ~]# kubectl get cm
NAME               DATA   AGE
cm-demo            3      4m56s
cm-demo1           2      3m23s
cm-demo2           1      36s
kube-root-ca.crt   1      8d

[root@k8s-master ~]# kubectl get cm cm-demo2 -o yaml
apiVersion: v1
data:
  redis.conf: |
    host=127.0.0.1
    port=6379
kind: ConfigMap
metadata:
  creationTimestamp: "2022-08-22T06:42:25Z"
  managedFields:
  - apiVersion: v1
    fieldsType: FieldsV1
    fieldsV1:
      f:data:
        .: {}
        f:redis.conf: {}
    manager: kubectl-create
    operation: Update
    time: "2022-08-22T06:42:25Z"
  name: cm-demo2
  namespace: default
  resourceVersion: "80395"
  uid: 75652115-e5f6-4968-ac1e-504675b98530
```

### 在命令行中通过字符串方式创建ConfigMap

通过帮助文档我们可以看到我们还可以直接使用字符串进行创建，通过 `--from-literal` 参数传递配置信息，同样的，这个参数可以使用多次，格式如下：

```shell
[root@k8s-master ~]# kubectl create configmap cm-demo3 --from-literal=db.host=localhost --from-literal=db.port=3306
configmap/cm-demo3 created

[root@k8s-master ~]# kubectl get cm cm-demo3 -o yaml
apiVersion: v1
data:
  db.host: localhost
  db.port: "3306"
kind: ConfigMap
metadata:
  creationTimestamp: "2022-08-22T06:44:36Z"
  managedFields:
  - apiVersion: v1
    fieldsType: FieldsV1
    fieldsV1:
      f:data:
        .: {}
        f:db.host: {}
        f:db.port: {}
    manager: kubectl-create
    operation: Update
    time: "2022-08-22T06:44:36Z"
  name: cm-demo3
  namespace: default
  resourceVersion: "80599"
  uid: 88bc0a75-de42-48c3-aaf9-29cf30af8dfa
```

### 从 env 文件读取配置信息并创建ConfigMap

`conf.env`文件如下

> 语法为 key=value

```shell
id=1
name=zhangquan
```

使用`–from-env-file`创建

```shell
[root@k8s-master ~]#  kubectl create cm cm-demo4 --from-env-file=cm/conf.env
configmap/cm-demo4 created

[root@k8s-master ~]# kubectl get cm cm-demo4 -o yaml
apiVersion: v1
data:
  id: "1"
  name: zhangquan
kind: ConfigMap
metadata:
  creationTimestamp: "2022-08-22T06:51:52Z"
  managedFields:
  - apiVersion: v1
    fieldsType: FieldsV1
    fieldsV1:
      f:data:
        .: {}
        f:id: {}
        f:name: {}
    manager: kubectl-create
    operation: Update
    time: "2022-08-22T06:51:52Z"
  name: cm-demo4
  namespace: default
  resourceVersion: "81265"
  uid: a96487d0-b2ac-4db6-8f51-e693dbe35883
```

## 使用

`ConfigMap` 创建成功了，那么我们应该怎么在 Pod 中来使用呢？ `ConfigMap` 这些配置数据可以通过很多种方式在 Pod 里使用，主要有以下几种方式：

- 用作环境变量
- 在容器里设置命令行参数
- 使用 Volume 将 ConfigMap 作为文件或目录挂载

**注意**

1. ConfigMap 必须在 Pod 使用它之前创建

2. 使用 envFrom 时，将会自动忽略无效的键

3. 一个Pod 只能使用同一个命名空间的 ConfigMap

### 用作环境变量

首先，我们使用 `ConfigMap` 来填充我们的环境变量，如下所示的 Pod 资源对象：testcm1.yaml

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: testcm1-pod
spec:
  containers:
    - name: testcm1
      image: busybox
      command: [ "/bin/sh", "-c", "env" ]
      env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: cm-demo3
              key: db.host
        - name: DB_PORT
          valueFrom:
            configMapKeyRef:
              name: cm-demo3
              key: db.port
      envFrom:
        - configMapRef:
            name: cm-demo1
```

通过 `env`单个指定或者通过`envFrom`直接加载整个 configmap

根据以上 yaml 文件创建 pod 并查看日志

```shell
[root@k8s-master ~]# kubectl apply -f cm/testcm1.yaml 
pod/testcm1-pod created

# 查看日志 会打印出一堆环境变量 其中就有我们指定的 configmap
[root@k8s-master ~]# kubectl logs testcm1-pod
......
DB_HOST=localhost
DB_PORT=3306

mysql.conf=host=127.0.0.1
port=3306

redis.conf=host=127.0.0.1
port=6379
......
```

### 在容器里设置命令行参数

`ConfigMap` 也可以被用来设置容器中的命令或者参数值，如下 Pod:  testcm2.yaml

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: testcm2-pod
spec:
  containers:
    - name: testcm2
      image: busybox
      command: [ "/bin/sh", "-c", "echo $(DB_HOST) $(DB_PORT)" ]
      env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: cm-demo3
              key: db.host
        - name: DB_PORT
          valueFrom:
            configMapKeyRef:
              name: cm-demo3
              key: db.port
```

根据以上 yaml 文件创建 pod 并查看日志：

```shell
[root@k8s-master ~]# kubectl apply -f cm/testcm2.yaml 
pod/testcm2-pod created

[root@k8s-master ~]# kubectl logs testcm2-pod 
localhost 3306
```

### 使用 Volume 将 ConfigMap 作为文件或目录挂载

另外一种是非常常见的使用 `ConfigMap` 的方式：通过**数据卷**使用，在数据卷里面使用 ConfigMap，就是将文件填入数据卷，在这个文件中，键就是文件名，键值就是文件内容，

* 先创建 ConfigMap

  * redis.conf 文件内容如下

    ```shell
    appendonly yes
    ```

  * 创建 ConfigMap

    ```shell
    [root@k8s-master ~]# kubectl create cm redis-conf --from-file=cm/redis.conf
    configmap/redis-conf created
    
    [root@k8s-master ~]# kubectl get cm redis-conf -o yaml
    apiVersion: v1
    data:
      redis.conf: |
        appendonly yes
    kind: ConfigMap
    metadata:
      creationTimestamp: "2022-08-22T07:26:54Z"
      managedFields:
      - apiVersion: v1
        fieldsType: FieldsV1
        fieldsV1:
          f:data:
            .: {}
            f:redis.conf: {}
        manager: kubectl-create
        operation: Update
        time: "2022-08-22T07:26:54Z"
      name: redis-conf
      namespace: default
      resourceVersion: "84601"
      uid: 309e08bc-1ea3-4370-9998-332eb3d22016
    ```

* 创建测试 Pod，如下资源对象所示：testcmredis.yaml

  ```yaml
  apiVersion: v1
  kind: Pod
  metadata:
    name: redis
  spec:
    containers:
    - name: redis
      image: redis
      command:
        - redis-server
        - "/redis-master/redis.conf"  #指的是redis容器内部的位置
      ports:
      - containerPort: 6379
      volumeMounts:
      - mountPath: /data
        name: data
      - mountPath: /redis-master
        name: config
    volumes:
      - name: data
        emptyDir: {}
      - name: config
        configMap:
          name: redis-conf
          items:
          - key: redis.conf
            path: redis.conf
  ```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-configMap-1.png)

* 根据以上 yaml 文件创建 pod

  ```shell
  [root@k8s-master ~]# kubectl apply -f cm/testcmredis.yaml 
  pod/redis created
  ```

* 进入 Pod 查看配置

  ```shell
  [root@k8s-master ~]# kubectl exec -it redis -- redis-cli
  127.0.0.1:6379> CONFIG GET appendonly
  1) "appendonly"
  2) "yes"
  ```

* 在外面把修改了，容器里的配置也会跟着修改

  ```shell
  # 修改配置
  [root@k8s-master ~]# kubectl edit cm redis-conf
  # Please edit the object below. Lines beginning with a '#' will be ignored,
  # and an empty file will abort the edit. If an error occurs while saving this file will be
  # reopened with the relevant failures.
  #
  apiVersion: v1
  data:
    redis.conf: |
      appendonly yes
      requirepass 123456  #新增这一行
  kind: ConfigMap
  metadata:
    creationTimestamp: "2022-08-22T07:26:54Z"
    name: redis-conf
    namespace: default
    resourceVersion: "84601"
    uid: 309e08bc-1ea3-4370-9998-332eb3d22016
    
  # 进入 Pod 内查看配置文件内容
  [root@k8s-master ~]# kubectl exec -it redis -- /bin/bash
  root@redis:/data# cat /redis-master/redis.conf 
  appendonly yes
  requirepass 123456
  
  # 连接上redis服务器查看配置，可以看到 requirepass 配置没有生效，这是因为文件是热更新了，但应用没有热更新
  # 所以，当 `ConfigMap` 以数据卷的形式挂载进 `Pod` 的时，这时更新 `ConfigMap（或删掉重建ConfigMap）`，Pod 内挂载的配# # 置信息会热更新。这时可以增加一些监测配置文件变更的脚本，然后重加载对应服务就可以实现应用的热更新。
  [root@k8s-master ~]# kubectl exec -it redis -- /bin/bash
  root@redis:/data# redis-cli
  127.0.0.1:6379> CONFIG GET appendonly
  1) "appendonly"
  2) "yes"
  127.0.0.1:6379> CONFIG GET requirepass
  1) "requirepass"
  2) ""
  ```

## 参考资料

* https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/

* https://www.qikqiak.com/k8strain/config/configmap/