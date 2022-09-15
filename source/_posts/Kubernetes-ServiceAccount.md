---
title: Kubernetes ServiceAccount
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-25 17:39:10
password:
summary: Kubernetes ServiceAccount
tags: Kubernetes
categories: Kubernetes
---


# Kubernetes ServiceAccount

`ServiceAccount` 主要是用于解决 Pod 在集群中的身份认证问题。认证使用的授权信息其实就是利用一个类型为 `kubernetes.io/service-account-token` 进行管理的。


## 介绍

`ServiceAccount` 是命名空间级别的，每一个命名空间创建的时候就会自动创建一个名为 `default` 的 `ServiceAccount` 对象:

```shell
[root@k8s-master ~]# kubectl create ns kube-test
namespace/kube-test created

[root@k8s-master ~]# kubectl get ServiceAccount -n kube-test 
NAME      SECRETS   AGE
default   1         29s

[root@k8s-master ~]# kubectl get secret -n kube-test
NAME                  TYPE                                  DATA   AGE
default-token-5ppzb   kubernetes.io/service-account-token   3      47s
```

可以看到 `ServiceAccount` 会自动关联到一个 `Secret` 对象上：

```sh
[root@k8s-master ~]# kubectl get sa default -n kube-test -o yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  creationTimestamp: "2022-08-24T12:26:22Z"
  name: default
  namespace: kube-test
  resourceVersion: "98033"
  uid: 0424a9f9-9df3-4a09-afed-9f1fa1329ee3
secrets:
- name: default-token-5ppzb
```

这个 Secret 对象是 ServiceAccount 控制器自动创建的，我们可以查看这个关联的 `Secret` 对象信息：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-service-account.png)

在 `data` 区域我们可以看到有3个信息：

- `ca.crt`：用于校验服务端的证书信息
- `namespace`：表示当前管理的命名空间
- `token`：用于 Pod 身份认证的 Token

默认情况下当前 namespace 下面的 Pod 会默认使用 `default` 这个 ServiceAccount，对应的 `Secret` 会自动挂载到 Pod 的 `/var/run/secrets/kubernetes.io/serviceaccount/` 目录中，这样我们就可以在 Pod 里面获取到用于身份认证的信息了。

## 验证

如下所示我们随意创建一个 Pod：

```sh
[root@k8s-master ~]# kubectl run nginx-sa --image nginx:1.7.9
pod/nginx-sa created

[root@k8s-master ~]# kubectl get pods
NAME          READY   STATUS             RESTARTS   AGE
nginx-sa      1/1     Running            0          12s
```

进入这个 Pod 中查看：

```sh
[root@k8s-master ~]# kubectl exec -it nginx-sa /bin/bash -- /bin/bash
root@nginx-sa:/# ls
bin  boot  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  selinux  srv  sys  tmp  usr  var
root@nginx-sa:/#  ls /run/secrets/kubernetes.io/serviceaccount/
ca.crt  namespace  token
root@nginx-sa:/# ls /var/run/secrets/kubernetes.io/serviceaccount/
ca.crt  namespace  token

#可以看到在 /var/run/secrets/kubernetes.io/serviceaccount/中的确有三个文件
```

查看这个 Pod 的详细信息：

```sh
[root@k8s-master ~]# kubectl get pod nginx-sa -o yaml | grep serviceAccount
  serviceAccount: default
  serviceAccountName: default
  
# 可以看到 Pod 的确有名字为 default的 ServiceAccount，serviceAccountName是新版本推荐使用的  
```

查看这个 Pod 使用的 `default` 这个 ServiceAccount：

```shell
[root@k8s-master ~]# kubectl get sa 
NAME      SECRETS   AGE
default   1         11d
```

查看 default 的ServiceAccount详细信息，可以看到它 Mount 了一个 secret ：

```shell
[root@k8s-master ~]# kubectl describe sa default
Name:                default
Namespace:           default
Labels:              <none>
Annotations:         <none>
Image pull secrets:  <none>
Mountable secrets:   default-token-pvpv2
Tokens:              default-token-pvpv2
Events:              <none>
```

查看 secret

```shell
[root@k8s-master ~]# kubectl get secret
NAME                  TYPE                                  DATA   AGE
default-token-pvpv2   kubernetes.io/service-account-token   3      11d
myregistry            kubernetes.io/dockerconfigjson        1      2d3h
mysecret              Opaque                                2      2d4h
```

## 原理

实际上这个自动挂载过程是在 Pod 创建的时候通过 `Admisson Controller（准入控制器）` 来实现的。

`Admission Controller（准入控制）`是 Kubernetes API Server 用于拦截请求的一种手段。`Admission` 可以做到对请求的资源对象进行校验，修改，Pod 创建时 `Admission Controller` 会根据指定的的 `ServiceAccount`（默认的 default）把对应的 `Secret` 挂载到容器中的固定目录下 `/var/run/secrets/kubernetes.io/serviceaccount/`。



> Admission Controller（准入控制）`是 Kubernetes API Server 用于拦截请求的一种手段。`Admission` 可以做到对请求的资源对象进行校验，修改，Pod 创建时 `Admission Controller` 会根据指定的的 `ServiceAccount`（默认的 default）把对应的 `Secret` 挂载到容器中的固定目录下 `/var/run/secrets/kubernetes.io/serviceaccount/`。



然后当我们在 Pod 里面访问集群的时候，就可以默认利用挂载到 Pod 内部的 `token` 文件来认证 Pod 的身份，`ca.crt` 则用来校验服务端。