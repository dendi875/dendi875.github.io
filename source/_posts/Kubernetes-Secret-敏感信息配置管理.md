---
title: Kubernetes Secret 敏感信息配置管理
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-24 18:42:45
password:
summary: Kubernetes Secret 敏感信息配置管理
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes Secret 敏感信息配置管理

Secret 和 Configmap 类似，不过 Secret 是加密后的，一般用于存储敏感数据，如 比如密码，token，密钥等。

Secret 主要使用的有以下几种类型：

- `Opaque`：base64 编码格式的 Secret，用来存储密码、密钥等；但数据也可以通过`base64 –decode`解码得到原始数据，所有加密性很弱。
- `kubernetes.io/dockerconfigjson`：用来存储私有`docker registry`的认证信息。
- `kubernetes.io/service-account-token`：用来访问Kubernetes API，由Kubernetes自动创建，并且会自动挂载到Pod的 /run/secrets/kubernetes.io/serviceaccount 目录中

## Opaque

`Opaque` 类型的数据是一个 map 类型，要求 value 必须是 `base64` 编码格式，比如我们来创建一个用户名为 admin，密码为 admin321 的 `Secret` 对象，首先我们需要先把用户名和密码做 `base64`编码：

```shell
$ echo -n "admin" | base64
YWRtaW4=
$ echo -n "admin321" | base64
YWRtaW4zMjE=
```

然后我们就可以利用上面编码过后的数据来编写一个 YAML 文件：*secret-demo.yaml*

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mysecret
type: Opaque
data:
  username: YWRtaW4=
  password: YWRtaW4zMjE=
```

然后我们就可以使用 kubectl 命令来创建了：

```
[root@k8s-master ~]# kubectl create -f secret/secret-demo.yaml 
secret/mysecret created
```

利用`get secret`命令查看：

```shell
[root@k8s-master ~]# kubectl get secret
NAME                  TYPE                                  DATA   AGE
default-token-pvpv2   kubernetes.io/service-account-token   3      8d
mysecret              Opaque                                2      11s
```

其中 default-token-pvpv2为创建集群时默认创建的 Secret，被 `serviceacount/default` 引用。我们可以使用 `describe` 命令查看详情：

```shell
[root@k8s-master ~]# kubectl describe secret mysecret
Name:         mysecret
Namespace:    default
Labels:       <none>
Annotations:  <none>

Type:  Opaque

Data
====
password:  8 bytes
username:  5 bytes
```

我们可以看到利用 describe 命令查看到的 Data 没有直接显示出来，如果想看到 Data 里面的详细信息，同样我们可以输出成YAML 文件进行查看：

```yaml
[root@k8s-master ~]# kubectl describe secret mysecret
Name:         mysecret
Namespace:    default
Labels:       <none>
Annotations:  <none>

Type:  Opaque

Data
====
password:  8 bytes
username:  5 bytes
[root@k8s-master ~]# kubectl get secret mysecret -o yaml
apiVersion: v1
data:
  password: YWRtaW4zMjE=
  username: YWRtaW4=
kind: Secret
metadata:
  creationTimestamp: "2022-08-22T08:18:53Z"
  managedFields:
  - apiVersion: v1
    fieldsType: FieldsV1
    fieldsV1:
      f:data:
        .: {}
        f:password: {}
        f:username: {}
      f:type: {}
    manager: kubectl-create
    operation: Update
    time: "2022-08-22T08:18:53Z"
  name: mysecret
  namespace: default
  resourceVersion: "87952"
  uid: eff0b3d4-8b5e-43e2-b198-46d9fcbecc5c
type: Opaque
```

创建好 `Secret`对象后，有两种方式来使用它：

- 以环境变量的形式
- 以Volume的形式挂载

### 环境变量

首先我们来测试下环境变量的方式，同样的，我们来使用一个简单的 busybox 镜像来测试下：*secret1-pod.yaml*

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret1-pod
spec:
  containers:
  - name: secret1
    image: busybox
    command: [ "/bin/sh", "-c", "env" ]
    env:
    - name: USERNAME
      valueFrom:
        secretKeyRef:
          name: mysecret
          key: username
    - name: PASSWORD
      valueFrom:
        secretKeyRef:
          name: mysecret
          key: password
```

主要需要注意的是上面环境变量中定义的 `secretKeyRef` 字段，和ConfigMap中的 `configMapKeyRef` 类似，一个是从 `Secret` 对象中获取，一个是从 `ConfigMap` 对象中获取，创建上面的 Pod并查看日志：

```shell
[root@k8s-master ~]# kubectl create -f secret/secret1-pod.yaml 
pod/secret1-pod created
 
[root@k8s-master ~]# kubectl logs secret1-pod
......
USERNAME=admin
PASSWORD=admin321
......
```

### Volume 挂载

同样的我们用一个 Pod 来验证下 `Volume` 挂载，创建一个 Pod 文件：*secret2-pod.yaml*

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret2-pod
spec:
  containers:
  - name: secret2
    image: busybox
    command: ["/bin/sh", "-c", "ls /etc/secrets"]
    volumeMounts:
    - name: secrets
      mountPath: /etc/secrets
  volumes:
  - name: secrets
    secret:
     secretName: mysecret
```

创建 Pod，然后查看输出日志：

```shell
[root@k8s-master ~]# kubectl create -f secret/secret2-pod.yaml 
pod/secret2-pod created

[root@k8s-master ~]# kubectl logs secret2-pod
password
username
```

可以看到 Secret 把两个 key 挂载成了两个对应的文件。

## kubernetes.io/dockerconfigjson

除了上面的 `Opaque` 这种类型外，我们还可以来创建用户 `docker registry` 认证的 `Secret`，比如我们把自己在 docker hub 上某个仓库镜像设置为私有的

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-secret-dockerhub.png)



然后观察下创建 Pod 时 docker hub 上的私有仓库来拉取镜像会发生什么 

准备好创建Pod的资源文件 *secret-private-php.yaml*

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-php
spec:
  containers:
  - name: private-php
    image: dendi875/php-php:7.3
```

接着创建 Pod

```shell
[root@k8s-master ~]# kubectl apply -f secret/secret-private-php.yaml 
pod/private-php created
```

观察事件

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-secret-dockerhub-2.png)



可以看到这个  Pod 是创建失败，因为我们的仓库镜像是私有的

我们先删除这个 Pod

```shell
[root@k8s-master ~]# kubectl delete -f secret/secret-private-php.yaml 
pod "private-php" deleted
```

如果这时我们需要从私有仓库拉取镜像怎么办呢？

我们可以使用 `kubectl create secret docker-registry ` 来创建一个 secret，如下：

```shell
[root@k8s-master ~]# kubectl create secret docker-registry myregistry \
--docker-server=<你的镜像仓库服务器> \
--docker-username=<你的用户名> \
--docker-password=<你的密码> \
--docker-email=<你的邮箱地址>

secret/myregistry created
```

然后查看 Secret 列表：

```shell
[root@k8s-master ~]# kubectl get secret
NAME                  TYPE                                  DATA   AGE
default-token-pvpv2   kubernetes.io/service-account-token   3      8d
myregistry            kubernetes.io/dockerconfigjson        1      14s
mysecret              Opaque                                2      73m
```

注意看上面的 TYPE 类型，myregistry 对应的type是 `kubernetes.io/dockerconfigjson`，同样的可以使用 describe 或 get -o yaml 命令来查看详细信息：

```shell
[root@k8s-master ~]#  kubectl describe secret myregistry
Name:         myregistry
Namespace:    default
Labels:       <none>
Annotations:  <none>

Type:  kubernetes.io/dockerconfigjson

Data
====
.dockerconfigjson:  152 bytes
```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-secret-dockerhub-4.png)

把上面的 `data.dockerconfigjson` 下面的数据做一个 `base64` 解码，内容就如下：

```json
{
    "auths": {
        "DOCKER_SERVER": {
            "username": "DOCKER_USER",
            "password": "DOCKER_PASSWORD",
            "email": "DOCKER_EMAIL",
            "auth": "RE9DS0VSX1VTRVI6RE9DS0VSX1BBU1NXT1JE"
        }
    }
}
```

我们需要拉取私有仓库镜像，我们就需要在 Pod 中指定 `imagePullSecrets`，在 *secret-private-php.yaml* 中加入 `imagePullSecrets`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-php
spec:
  containers:
  - name: private-php
    image: dendi875/php-php:7.3
  imagePullSecrets:
  - name: myregistry  # 创建的 secret 名字  
```

重新创建

```shell
[root@k8s-master ~]# kubectl apply -f secret/secret-private-php.yaml 
pod/private-php created
```

在次观察

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-secret-dockerhub-3.png)

可以发现镜像已经成功拉取

去 node2机器上也能看到镜像被成功拉取

```shell
[root@k8s-node2 ~]# docker images | grep dendi875
dendi875/php-php                                                            7.3        d5a49dc91b8c   2 years ago     183MB
```



> `ImagePullSecrets` 与 `Secrets` 不同，因为 `Secrets` 可以挂载到 Pod 中，但是 `ImagePullSecrets` 只能由 Kubelet 访问。



除了设置 `Pod.spec.imagePullSecrets` 这种方式来获取私有镜像之外，我们还可以通过在 `ServiceAccount` 中设置 `imagePullSecrets`，然后就会自动为使用该 ServiceAccount 的 Pod 注入 `imagePullSecrets`信息：

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  creationTimestamp: "2019-11-08T12:00:04Z"
  name: default
  namespace: default
  resourceVersion: "332"
  selfLink: /api/v1/namespaces/default/serviceaccounts/default
  uid: cc37a719-c4fe-4ebf-92da-e92c3e24d5d0
secrets:
- name: default-token-5tsh4
imagePullSecrets:
- name: myregistry
```

## kubernetes.io/service-account-token

另外一种 `Secret` 类型就是 `kubernetes.io/service-account-token`，用于被 `ServiceAccount` 引用。`ServiceAccout` 创建时 Kubernetes 会默认创建对应的 `Secret`。Pod 如果使用了 `ServiceAccount`，对应的 `Secret` 会自动挂载到 Pod 的 `/var/run/secrets/kubernetes.io/serviceaccount/` 目录中。如下所示我们随意创建一个 Pod：

```shell
[root@k8s-master ~]# kubectl run secret-pod3 --image nginx:1.7.9
pod/secret-pod3 created

[root@k8s-master ~]# kubectl get pods
NAME          READY   STATUS             RESTARTS   AGE
......
secret-pod3   1/1     Running            0          57s
......
```

我们可以直接查看这个 Pod 的详细信息：

```shell
......
    volumeMounts:
    - mountPath: /var/run/secrets/kubernetes.io/serviceaccount
      name: default-token-pvpv2
      readOnly: true
  ......
  serviceAccount: default
  serviceAccountName: default
  ......
  volumes:
  - name: default-token-pvpv2
    secret:
      defaultMode: 420
      secretName: default-token-pvpv2
```

可以看到默认把名为 `default`（自动创建的）的 `ServiceAccount` 对应的 Secret 对象通过 Volume 挂载到了容器的 `/var/run/secrets/kubernetes.io/serviceaccount` 的目录中

## Secret vs ConfigMap

最后我们来对比下 `Secret` 和 `ConfigMap`这两种资源对象的异同点：

### 相同点

- key/value的形式

- 属于某个特定的命名空间

- 可以导出到环境变量

- 可以通过目录/文件形式挂载

- 通过 volume 挂载的配置信息均可热更新

  

### 不同点

- Secret 可以被 ServerAccount 关联

- Secret 可以存储 `docker register` 的鉴权信息，用在 `ImagePullSecret` 参数中，用于拉取私有仓库的镜像

- Secret 支持 `Base64` 加密

- Secret 分为 `kubernetes.io/service-account-token`、`kubernetes.io/dockerconfigjson`、`Opaque` 三种类型，而 `Configmap` 不区分类型

  

  > **Warning**
  >
  > 同样 Secret 文件大小限制为 `1MB`（ETCD 的要求）；Secret 虽然采用 `Base64` 编码，但是我们还是可以很方便解码获取到原始信息，所以对于非常重要的数据还是需要慎重考虑，可以考虑使用 [Vault](https://www.vaultproject.io/) 来进行加密管理。

## 参考

* https://kubernetes.io/docs/concepts/configuration/secret/

*  https://www.qikqiak.com/k8strain/config/secret/#opaque-secret