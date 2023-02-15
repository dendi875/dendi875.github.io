---
title: Kubernetes RBAC 权限控制
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-25 17:39:14
password:
summary: Kubernetes RBAC 权限控制
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes RBAC 权限控制

基于角色的访问控制（Role-Based Access Control，即”RBAC”）使用 `rbac.authorization.k8s.io` API Group 实现授权决策，允许管理员通过 Kubernetes API 动态配置策略。

要启用 RBAC，需要在 kube-apiserver 中添加参数`--authorization-mode=RBAC`，如果使用的kubeadm 安装的集群那么是默认开启了 `RBAC` 的，可以通过查看 Master 节点上 apiserver 的静态 Pod 定义文件：

```bash
[root@k8s-master ~]# cat /etc/kubernetes/manifests/kube-apiserver.yaml 
......
    - --authorization-mode=Node,RBAC
......
```

## API 对象

我们知道，在 Kubernetes 集群中，Kubernetes 对象是我们持久化的实体，就是最终存入 etcd 中的数据，集群中通过这些实体来表示整个集群的状态。一般我们都直接编写 YAML 文件，通过 kubectl 来提交的资源清单文件，然后创建的对应的资源对象，那么它究竟是如何将我们的 YAML 文件转换成集群中的一个 API 对象的呢？

这个就需要去了解下**声明式 API**的设计，Kubernetes API 是一个以 JSON 为主要序列化方式的 HTTP 服务，除此之外也支持 Protocol Buffers 序列化方式，主要用于集群内部组件间的通信。为了可扩展性，Kubernetes 在不同的 API 路径（比如`/api/v1` 或者 `/apis/batch`）下面支持了多个 API 版本，不同的 API 版本意味着不同级别的稳定性和支持：

- Alpha 级别，例如 `v1alpha1` 默认情况下是被禁用的，可以随时删除对功能的支持，所以要慎用
- Beta 级别，例如 `v2beta1` 默认情况下是启用的，表示代码已经经过了很好的测试，但是对象的语义可能会在随后的版本中以不兼容的方式更改
- 稳定级别，比如 `v1` 表示已经是稳定版本了，也会出现在后续的很多版本中。

在 Kubernetes 集群中，一个 API 对象在 Etcd 里的完整资源路径，是由：`Group（API 组）`、`Version（API 版本）`和 `Resource（API 资源类型）`三个部分组成的。通过这样的结构，整个 Kubernetes 里的所有 API 对象，实际上就可以用如下的树形结构表示出来：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-api-tree.png)

从上图中我们也可以看出 Kubernetes 的 API 对象的组织方式，在顶层，我们可以看到有一个核心组`/api/v1` 和命名组（路径 `/apis/$NAME/$VERSION`）和系统范围内的实体，比如 `/metrics`。我们也可以用下面的命令来查看集群中的 API 组织形式：

```bash
[root@k8s-master ~]# kubectl get --raw /
{
  "paths": [
    "/.well-known/openid-configuration",
    "/api",
    "/api/v1",
    "/apis",
    "/apis/",
    "/apis/admissionregistration.k8s.io",
    "/apis/admissionregistration.k8s.io/v1",
    "/apis/admissionregistration.k8s.io/v1beta1",
    "/apis/apiextensions.k8s.io",
    "/apis/apiextensions.k8s.io/v1",
    "/apis/apiextensions.k8s.io/v1beta1",
    "/apis/apiregistration.k8s.io",
    "/apis/apiregistration.k8s.io/v1",
    "/apis/apiregistration.k8s.io/v1beta1",
    "/apis/apps",
    "/apis/apps/v1",
    "/apis/authentication.k8s.io",
    "/apis/authentication.k8s.io/v1",
    "/apis/authentication.k8s.io/v1beta1",
    "/apis/authorization.k8s.io",
    "/apis/authorization.k8s.io/v1",
    "/apis/authorization.k8s.io/v1beta1",
    "/apis/autoscaling",
    "/apis/autoscaling/v1",
    "/apis/autoscaling/v2beta1",
    "/apis/autoscaling/v2beta2",
    "/apis/batch",
    "/apis/batch/v1",
    "/apis/batch/v1beta1",
    "/apis/certificates.k8s.io",
    "/apis/certificates.k8s.io/v1",
    "/apis/certificates.k8s.io/v1beta1",
    "/apis/coordination.k8s.io",
    "/apis/coordination.k8s.io/v1",
    "/apis/coordination.k8s.io/v1beta1",
    "/apis/crd.projectcalico.org",
    "/apis/crd.projectcalico.org/v1",
    "/apis/discovery.k8s.io",
    "/apis/discovery.k8s.io/v1beta1",
    "/apis/events.k8s.io",
    "/apis/events.k8s.io/v1",
    "/apis/events.k8s.io/v1beta1",
    "/apis/extensions",
    "/apis/extensions/v1beta1",
    "/apis/flowcontrol.apiserver.k8s.io",
    "/apis/flowcontrol.apiserver.k8s.io/v1beta1",
    "/apis/networking.k8s.io",
    "/apis/networking.k8s.io/v1",
    "/apis/networking.k8s.io/v1beta1",
    "/apis/node.k8s.io",
    "/apis/node.k8s.io/v1",
    "/apis/node.k8s.io/v1beta1",
    "/apis/policy",
    "/apis/policy/v1beta1",
    "/apis/rbac.authorization.k8s.io",
    "/apis/rbac.authorization.k8s.io/v1",
    "/apis/rbac.authorization.k8s.io/v1beta1",
    "/apis/scheduling.k8s.io",
    "/apis/scheduling.k8s.io/v1",
    "/apis/scheduling.k8s.io/v1beta1",
    "/apis/storage.k8s.io",
    "/apis/storage.k8s.io/v1",
    "/apis/storage.k8s.io/v1beta1",
    "/healthz",
    "/healthz/autoregister-completion",
    "/healthz/etcd",
    "/healthz/log",
    "/healthz/ping",
    "/healthz/poststarthook/aggregator-reload-proxy-client-cert",
    "/healthz/poststarthook/apiservice-openapi-controller",
    "/healthz/poststarthook/apiservice-registration-controller",
    "/healthz/poststarthook/apiservice-status-available-controller",
    "/healthz/poststarthook/bootstrap-controller",
    "/healthz/poststarthook/crd-informer-synced",
    "/healthz/poststarthook/generic-apiserver-start-informers",
    "/healthz/poststarthook/kube-apiserver-autoregistration",
    "/healthz/poststarthook/priority-and-fairness-config-consumer",
    "/healthz/poststarthook/priority-and-fairness-config-producer",
    "/healthz/poststarthook/priority-and-fairness-filter",
    "/healthz/poststarthook/rbac/bootstrap-roles",
    "/healthz/poststarthook/scheduling/bootstrap-system-priority-classes",
    "/healthz/poststarthook/start-apiextensions-controllers",
    "/healthz/poststarthook/start-apiextensions-informers",
    "/healthz/poststarthook/start-cluster-authentication-info-controller",
    "/healthz/poststarthook/start-kube-aggregator-informers",
    "/healthz/poststarthook/start-kube-apiserver-admission-initializer",
    "/livez",
    "/livez/autoregister-completion",
    "/livez/etcd",
    "/livez/log",
    "/livez/ping",
    "/livez/poststarthook/aggregator-reload-proxy-client-cert",
    "/livez/poststarthook/apiservice-openapi-controller",
    "/livez/poststarthook/apiservice-registration-controller",
    "/livez/poststarthook/apiservice-status-available-controller",
    "/livez/poststarthook/bootstrap-controller",
    "/livez/poststarthook/crd-informer-synced",
    "/livez/poststarthook/generic-apiserver-start-informers",
    "/livez/poststarthook/kube-apiserver-autoregistration",
    "/livez/poststarthook/priority-and-fairness-config-consumer",
    "/livez/poststarthook/priority-and-fairness-config-producer",
    "/livez/poststarthook/priority-and-fairness-filter",
    "/livez/poststarthook/rbac/bootstrap-roles",
    "/livez/poststarthook/scheduling/bootstrap-system-priority-classes",
    "/livez/poststarthook/start-apiextensions-controllers",
    "/livez/poststarthook/start-apiextensions-informers",
    "/livez/poststarthook/start-cluster-authentication-info-controller",
    "/livez/poststarthook/start-kube-aggregator-informers",
    "/livez/poststarthook/start-kube-apiserver-admission-initializer",
    "/logs",
    "/metrics",
    "/openapi/v2",
    "/openid/v1/jwks",
    "/readyz",
    "/readyz/autoregister-completion",
    "/readyz/etcd",
    "/readyz/informer-sync",
    "/readyz/log",
    "/readyz/ping",
    "/readyz/poststarthook/aggregator-reload-proxy-client-cert",
    "/readyz/poststarthook/apiservice-openapi-controller",
    "/readyz/poststarthook/apiservice-registration-controller",
    "/readyz/poststarthook/apiservice-status-available-controller",
    "/readyz/poststarthook/bootstrap-controller",
    "/readyz/poststarthook/crd-informer-synced",
    "/readyz/poststarthook/generic-apiserver-start-informers",
    "/readyz/poststarthook/kube-apiserver-autoregistration",
    "/readyz/poststarthook/priority-and-fairness-config-consumer",
    "/readyz/poststarthook/priority-and-fairness-config-producer",
    "/readyz/poststarthook/priority-and-fairness-filter",
    "/readyz/poststarthook/rbac/bootstrap-roles",
    "/readyz/poststarthook/scheduling/bootstrap-system-priority-classes",
    "/readyz/poststarthook/start-apiextensions-controllers",
    "/readyz/poststarthook/start-apiextensions-informers",
    "/readyz/poststarthook/start-cluster-authentication-info-controller",
    "/readyz/poststarthook/start-kube-aggregator-informers",
    "/readyz/poststarthook/start-kube-apiserver-admission-initializer",
    "/readyz/shutdown",
    "/version"
  ]
}
```

比如我们来查看批处理这个操作，在我们当前这个版本中存在两个版本的操作：`/apis/batch/v1` 和 `/apis/batch/v1beta1`，分别暴露了可以查询和操作的不同实体集合，同样我们还是可以通过 kubectl 来查询对应对象下面的数据：

```bash
[root@k8s-master ~]# kubectl get --raw /apis/batch/v1 | python -m json.tool
{
    "apiVersion": "v1",
    "groupVersion": "batch/v1",
    "kind": "APIResourceList",
    "resources": [
        {
            "categories": [
                "all"
            ],
            "kind": "Job",
            "name": "jobs",
            "namespaced": true,
            "singularName": "",
            "storageVersionHash": "mudhfqk/qZY=",
            "verbs": [
                "create",
                "delete",
                "deletecollection",
                "get",
                "list",
                "patch",
                "update",
                "watch"
            ]
        },
        {
            "kind": "Job",
            "name": "jobs/status",
            "namespaced": true,
            "singularName": "",
            "verbs": [
                "get",
                "patch",
                "update"
            ]
        }
    ]
}


[root@k8s-master ~]# kubectl get --raw /apis/batch/v1beta1 | python -m json.tool
{
    "apiVersion": "v1",
    "groupVersion": "batch/v1beta1",
    "kind": "APIResourceList",
    "resources": [
        {
            "categories": [
                "all"
            ],
            "kind": "CronJob",
            "name": "cronjobs",
            "namespaced": true,
            "shortNames": [
                "cj"
            ],
            "singularName": "",
            "storageVersionHash": "h/JlFAZkyyY=",
            "verbs": [
                "create",
                "delete",
                "deletecollection",
                "get",
                "list",
                "patch",
                "update",
                "watch"
            ]
        },
        {
            "kind": "CronJob",
            "name": "cronjobs/status",
            "namespaced": true,
            "singularName": "",
            "verbs": [
                "get",
                "patch",
                "update"
            ]
        }
    ]
}
```

但是这个操作和我们平时操作 HTTP 服务的方式不太一样，这里我们可以通过 `kubectl proxy` 命令来开启对 apiserver 的访问：

```bash
[root@k8s-master ~]# kubectl proxy
Starting to serve on 127.0.0.1:8001
```

然后重新开启一个新的终端，我们可以通过如下方式来访问批处理的 API 服务：

```bash
[root@k8s-master ~]# curl http://127.0.0.1:8001/apis/batch/v1
{
  "kind": "APIResourceList",
  "apiVersion": "v1",
  "groupVersion": "batch/v1",
  "resources": [
    {
      "name": "jobs",
      "singularName": "",
      "namespaced": true,
      "kind": "Job",
      "verbs": [
        "create",
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "update",
        "watch"
      ],
      "categories": [
        "all"
      ],
      "storageVersionHash": "mudhfqk/qZY="
    },
    {
      "name": "jobs/status",
      "singularName": "",
      "namespaced": true,
      "kind": "Job",
      "verbs": [
        "get",
        "patch",
        "update"
      ]
    }
  ]
}
```

同样也可以去访问另外一个版本的对象数据：

```bash
[root@k8s-master ~]# curl http://127.0.0.1:8001/apis/batch/v1beta1
......
```

通常，Kubernetes API 支持通过标准 HTTP `POST`、`PUT`、`DELETE` 和 `GET` 在指定 PATH 路径上创建、更新、删除和检索操作，并使用 JSON 作为默认的数据交互格式。

比如现在我们要创建一个 Deployment 对象，那么我们的 YAML 文件的声明就需要这么写：

```yaml
apiVersion: apps/v1
kind: Deployment
```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-api-1.png)

其中 `apps` 就是它的组（Group），`v1`就是它的版本（Version），`Deployment` 就是这个 API 对象的资源类型（Resource）。API Group、Version 和 Resource就唯一定义了一个 HTTP 路径，然后在 kube-apiserver 端对这个 url 进行了监听，然后把对应的请求传递给了对应的控制器进行处理而已，当然在 Kuberentes 中的实现过程是非常复杂的。

## RBAC

Kubernetes 所有资源对象都是模型化的 API 对象，允许执行 `CRUD(Create、Read、Update、Delete)` 操作(也就是我们常说的增、删、改、查操作)，比如下面的这些资源：

- Pods
- ConfigMaps
- Deployments
- Nodes
- Secrets
- Namespaces
- ......

对于上面这些资源对象的可能存在的操作有：

- create
- get
- delete
- list
- update
- edit
- watch
- exec
- patch

在更上层，这些资源和 API Group 进行关联，比如 Pods 属于 Core API Group，而 Deployements 属于 apps API Group。



现在我们要在 Kubernetes 中通过 RBAC 来对资源进行权限管理，除了上面的这些资源和操作以外，我们还需要了解另外几个概念：

- `Rule`：规则，规则是一组属于不同 API Group 资源上的一组操作的集合
- `Role` 和 `ClusterRole`：角色和集群角色，这两个对象都包含上面的 Rules 元素，二者的区别在于，在 Role 中，定义的规则只适用于单个命名空间，也就是和 namespace 关联的，而 ClusterRole 是集群范围内的，因此定义的规则不受命名空间的约束。另外 Role 和 ClusterRole 在Kubernetes 中都被定义为集群内部的 API 资源，和我们前面学习过的 Pod、Deployment 这些对象类似，都是我们集群的资源对象，所以同样的可以使用 YAML 文件来描述，用 kubectl 工具来管理
- `Subject`：主题，对应集群中尝试操作的对象，集群中定义了3种类型的主题资源：
  - `User Account`：用户，这是有外部独立服务进行管理的，管理员进行私钥的分配，用户可以使用 KeyStone 或者 Goolge 帐号，甚至一个用户名和密码的文件列表也可以。对于用户的管理集群内部没有一个关联的资源对象，所以用户不能通过集群内部的 API 来进行管理
  - `Group`：组，这是用来关联多个账户的，集群中有一些默认创建的组，比如 cluster-admin
  - `Service Account`：服务帐号也是k8s集群内部使用的用户，通过 Kubernetes API 来管理的一些用户帐号，和 namespace 进行关联的，适用于集群内部运行的应用程序，需要通过 API 来完成权限认证，所以在集群内部进行权限操作，我们都需要使用到 ServiceAccount
- `RoleBinding` 和 `ClusterRoleBinding`：角色绑定和集群角色绑定，简单来说就是把声明的 Subject 和我们的 Role 进行绑定的过程（给某个用户绑定上操作的权限），二者的区别也是作用范围的区别：RoleBinding 只会影响到当前 namespace 下面的资源操作权限，而 ClusterRoleBinding 会影响到所有的 namespace。

### 只能访问某个 namespace 的普通用户

我们想要创建一个 User Account，只能访问 kube-system 这个命名空间，对应的用户信息如下所示：

```yaml
username: zq
group: zqgroup
```

#### 创建一个普通用户（User Account）

不过要创建一个用户帐号的话也是挺简单的，利用管理员分配给你的一个私钥就可以创建了，这个我们可以参考官方文档中的方法，这里我们来使用 `OpenSSL` 证书来创建一个 User，当然我们也可以使用更简单的 `cfssl`工具来创建：

首先创建一个文件夹存放私钥和证书：

```bash
[root@k8s-master ~]# mkdir ~/certs 
```

给用户 zq 创建一个私钥，命名成 `zq.key`：

```bash
[root@k8s-master certs]# openssl genrsa -out zq.key 2048
Generating RSA private key, 2048 bit long modulus
.....................................+++
.......................................................................+++
e is 65537 (0x10001)
```

使用我们刚刚创建的私钥创建一个证书签名请求文件：`cnych.csr`，要注意需要确保在`-subj`参数中指定用户名和组(CN表示用户名，O表示组)：

```bash
[root@k8s-master certs]#  openssl req -new -key zq.key -out zq.csr -subj "/CN=zq/O=zqgroup"

[root@k8s-master certs]# ls
zq.csr  zq.key
```

然后找到我们的 Kubernetes 集群的 `CA` 证书，我们使用的是 kubeadm 安装的集群，CA 相关证书位于 `/etc/kubernetes/pki/` 目录下面，如果你是二进制方式搭建的，你应该在最开始搭建集群的时候就已经指定好了 CA 的目录，我们会利用该目录下面的 `ca.crt` 和 `ca.key`两个文件来批准上面的证书请求。生成最终的证书文件，我们这里设置证书的有效期为 10 年：

```bash
[root@k8s-master certs]# ls /etc/kubernetes/pki/
apiserver.crt              apiserver-etcd-client.key  apiserver-kubelet-client.crt  ca.crt  etcd                front-proxy-ca.key      front-proxy-client.key  sa.pub
apiserver-etcd-client.crt  apiserver.key              apiserver-kubelet-client.key  ca.key  front-proxy-ca.crt  front-proxy-client.crt  sa.key

[root@k8s-master certs]# openssl x509 -req -in zq.csr -CA /etc/kubernetes/pki/ca.crt -CAkey /etc/kubernetes/pki/ca.key -CAcreateserial -out zq.crt -days 3650
Signature ok
subject=/CN=zq/O=zqgroup
Getting CA Private Key
```

现在查看我们当前文件夹下面是否生成了一个证书文件：

```bash
[root@k8s-master certs]# ls
zq.crt  zq.csr  zq.key
```

现在我们可以使用刚刚创建的证书文件和私钥文件在集群中创建新的**凭证**和**上下文(Context)**:

```bash
[root@k8s-master certs]# kubectl config set-credentials zq --client-certificate=zq.crt --client-key=zq.key
User "zq" set.
```

我们可以看到一个用户 `zq` 创建了，然后为这个用户设置新的 Context，我们这里指定特定的一个 namespace：

```bash
[root@k8s-master certs]# kubectl config set-context zq-context --cluster=kubernetes --namespace=kube-system --user=zq
Context "zq-context" created.
```

到这里，我们的用户 `zq` 就已经创建成功了，现在我们使用当前的这个配置文件来操作 kubectl 命令的时候，应该会出现错误，因为我们还没有为该用户定义任何操作的权限呢：

```bash
# 使用默认认的 context
[root@k8s-master certs]# kubectl get pods
NAME          READY   STATUS             RESTARTS   AGE
nginx-sa      1/1     Running            1          17h
private-php   0/1     CrashLoopBackOff   23         2d20h
redis         1/1     Running            4          2d22h
secret-pod3   1/1     Running            3          2d21h
secret1-pod   0/1     CrashLoopBackOff   42         2d22h
secret2-pod   0/1     CrashLoopBackOff   41         2d22h
testcm1-pod   0/1     CrashLoopBackOff   57         2d23h
testcm2-pod   0/1     CrashLoopBackOff   55         2d23h
# 使用我们自己创建的 context
[root@k8s-master certs]# kubectl get pods --context=zq-context
Error from server (Forbidden): pods is forbidden: User "zq" cannot list resource "pods" in API group "" in the namespace "kube-system"
```

#### 创建角色（Role）

首先创建一个文件夹来存放我们资源文件：

```bash
[root@k8s-master certs]# mkdir ~/rbactest
```

用户创建完成后，接下来就需要给该用户添加操作权限，我们来定义一个 YAML 文件，创建一个允许用户操作 Deployment、Pod、ReplicaSets 的角色，如下定义：*zq-role.yaml*

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: zq-role
  namespace: kube-system
rules:
- apiGroups: ["", "apps"]
  resources: ["deployments", "replicasets", "pods"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"] # 也可以使用['*']
```

其中 Pod 属于 `core` 这个 API Group，在 YAML 中用空字符就可以，而 Deployment 和 ReplicaSet 现在都属于 `apps` 这个 API Group（如果不知道则可以用 `kubectl explain` 命令查看），所以 `rules` 下面的 `apiGroups` 就综合了这几个资源的 API Group：["", "apps"]，其中`verbs`就是我们上面提到的可以对这些资源对象执行的操作，我们这里需要所有的操作方法，所以我们也可以使用['*']来代替。然后直接创建这个 Role：

```bash
[root@k8s-master rbactest]# kubectl create -f zq-role.yaml
role.rbac.authorization.k8s.io/zq-role created
```

查看我们创建的 Role：

```bash
# 查看 kube-system 命名空间下的所有 Role
[root@k8s-master rbactest]# kubectl get role -n kube-system
NAME                                             CREATED AT
extension-apiserver-authentication-reader        2022-08-13T11:17:28Z
kube-proxy                                       2022-08-13T11:17:30Z
kubeadm:kubelet-config-1.20                      2022-08-13T11:17:28Z
kubeadm:nodes-kubeadm-config                     2022-08-13T11:17:28Z
system::leader-locking-kube-controller-manager   2022-08-13T11:17:28Z
system::leader-locking-kube-scheduler            2022-08-13T11:17:28Z
system:controller:bootstrap-signer               2022-08-13T11:17:28Z
system:controller:cloud-provider                 2022-08-13T11:17:28Z
system:controller:token-cleaner                  2022-08-13T11:17:28Z
zq-role                                          2022-08-25T06:31:25Z

# 查看 zq-role 这个 Role 的详细信息
[root@k8s-master rbactest]# kubectl get role zq-role -n kube-system -o yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  creationTimestamp: "2022-08-25T06:31:25Z"
  managedFields:
  - apiVersion: rbac.authorization.k8s.io/v1
    fieldsType: FieldsV1
    fieldsV1:
      f:rules: {}
    manager: kubectl-create
    operation: Update
    time: "2022-08-25T06:31:25Z"
  name: zq-role
  namespace: kube-system
  resourceVersion: "103263"
  uid: 1e8f3b6d-ea9e-4cae-bfc7-b42069789244
rules:
- apiGroups:
  - ""
  - apps
  resources:
  - deployments
  - replicasets
  - pods
  verbs:
  - get
  - list
  - watch
  - create
  - update
  - patch
  - delete
```

注意这里我们没有使用上面的 `zq-context` 这个上下文，因为暂时还没有权限。

#### 创建角色权限绑定（RoleBinding）

Role 创建完成了，但是很明显现在我们这个 `Role` 和我们的用户 `zq` 还没有任何关系，这里就需要创建一个 `RoleBinding` 对象，在 kube-system 这个命名空间下面将上面的 `zq-role`角色和用户 `zq` 进行绑定：zq-rolebinding.yaml

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: zq-rolebinding
  namespace: kube-system
subjects: # 声明用户
- kind: User
  name: zq
  apiGroup: ""
roleRef: # 这用户分配角色
  kind: Role
  name: zq-role
  apiGroup: rbac.authorization.k8s.io  # 留空字符串也可以，则使用当前的apiGroup
```

上面的 YAML 文件中我们看到了 `subjects` 字段，这里就是我们上面提到的用来尝试操作集群的对象，这里对应上面的 `User` 帐号 `zq`，使用kubectl 创建上面的资源对象：

```bash
[root@k8s-master rbactest]#  kubectl create -f zq-rolebinding.yaml
rolebinding.rbac.authorization.k8s.io/zq-rolebinding created
```

查看我们创建的 RoleBinding：

```bash
[root@k8s-master rbactest]# kubectl get rolebinding
No resources found in default namespace.

# 查看 kube-system 命名空间下所的有 RoleBinding
[root@k8s-master rbactest]# kubectl get rolebinding -n kube-system
NAME                                                ROLE                                                  AGE
kube-proxy                                          Role/kube-proxy                                       11d
kubeadm:kubelet-config-1.20                         Role/kubeadm:kubelet-config-1.20                      11d
kubeadm:nodes-kubeadm-config                        Role/kubeadm:nodes-kubeadm-config                     11d
system::extension-apiserver-authentication-reader   Role/extension-apiserver-authentication-reader        11d
system::leader-locking-kube-controller-manager      Role/system::leader-locking-kube-controller-manager   11d
system::leader-locking-kube-scheduler               Role/system::leader-locking-kube-scheduler            11d
system:controller:bootstrap-signer                  Role/system:controller:bootstrap-signer               11d
system:controller:cloud-provider                    Role/system:controller:cloud-provider                 11d
system:controller:token-cleaner                     Role/system:controller:token-cleaner                  11d
zq-rolebinding                                      Role/zq-role                                          77s

# 我们查看一个系统自带的 rolebinding
[root@k8s-master rbactest]# kubectl get rolebinding system::leader-locking-kube-controller-manager -n kube-system -o yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  annotations:
    rbac.authorization.kubernetes.io/autoupdate: "true"
  creationTimestamp: "2022-08-13T11:17:28Z"
  labels:
    kubernetes.io/bootstrapping: rbac-defaults
  managedFields:
  - apiVersion: rbac.authorization.k8s.io/v1
    fieldsType: FieldsV1
    fieldsV1:
      f:metadata:
        f:annotations:
          .: {}
          f:rbac.authorization.kubernetes.io/autoupdate: {}
        f:labels:
          .: {}
          f:kubernetes.io/bootstrapping: {}
      f:roleRef:
        f:apiGroup: {}
        f:kind: {}
        f:name: {}
      f:subjects: {}
    manager: kube-apiserver
    operation: Update
    time: "2022-08-13T11:17:28Z"
  name: system::leader-locking-kube-controller-manager
  namespace: kube-system
  resourceVersion: "196"
  uid: 7fe913a2-ee8d-47f0-9c90-35f661a4977a
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: system::leader-locking-kube-controller-manager
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: system:kube-controller-manager
- kind: ServiceAccount
  name: kube-controller-manager
  namespace: kube-system
```

#### 测试验证

现在我们应该可以上面的 `zq-context` 上下文来操作集群了：

```
[root@k8s-master rbactest]# kubectl get pods --context=zq-context
NAME                                       READY   STATUS    RESTARTS   AGE
calico-kube-controllers-5bb48c55fd-ghkdz   1/1     Running   9          11d
calico-node-6vwgq                          1/1     Running   9          11d
calico-node-rnwvk                          1/1     Running   9          11d
calico-node-wz5r2                          1/1     Running   10         11d
coredns-5897cd56c4-kqfn2                   1/1     Running   9          11d
coredns-5897cd56c4-wcgdh                   1/1     Running   9          11d
etcd-k8s-master                            1/1     Running   9          11d
kube-apiserver-k8s-master                  1/1     Running   10         11d
kube-controller-manager-k8s-master         1/1     Running   9          11d
kube-proxy-jlmvb                           1/1     Running   9          11d
kube-proxy-rnt4v                           1/1     Running   9          11d
kube-proxy-vpbsl                           1/1     Running   10         11d
kube-scheduler-k8s-master                  1/1     Running   9          11d

[root@k8s-master rbactest]# kubectl get pods  -n kube-system
NAME                                       READY   STATUS    RESTARTS   AGE
calico-kube-controllers-5bb48c55fd-ghkdz   1/1     Running   9          11d
calico-node-6vwgq                          1/1     Running   9          11d
calico-node-rnwvk                          1/1     Running   9          11d
calico-node-wz5r2                          1/1     Running   10         11d
coredns-5897cd56c4-kqfn2                   1/1     Running   9          11d
coredns-5897cd56c4-wcgdh                   1/1     Running   9          11d
etcd-k8s-master                            1/1     Running   9          11d
kube-apiserver-k8s-master                  1/1     Running   10         11d
kube-controller-manager-k8s-master         1/1     Running   9          11d
kube-proxy-jlmvb                           1/1     Running   9          11d
kube-proxy-rnt4v                           1/1     Running   9          11d
kube-proxy-vpbsl                           1/1     Running   10         11d
kube-scheduler-k8s-master                  1/1     Running   9          11d
```

我们可以看到我们使用 kubectl 的使用并没有指定 namespace，这是因为我们我们上面创建`zq-context`这个 Context 的时候就绑定在了 kube-system 这个命名空间下面，所以上面输出结果是一样的，如果我们在后面加上一个`-n default`试看看呢？

```bash
[root@k8s-master rbactest]# kubectl --context=zq-context get pods --namespace=default
Error from server (Forbidden): pods is forbidden: User "zq" cannot list resource "pods" in API group "" in the namespace "default"
```

如果去获取其他的资源对象呢：

```bash
[root@k8s-master rbactest]#  kubectl --context=zq-context get svc
Error from server (Forbidden): services is forbidden: User "zq" cannot list resource "services" in API group "" in the namespace "kube-system"
```

我们可以看到没有权限获取，因为我们并没有为当前操作用户指定其他对象资源的访问权限，是符合我们的预期的。这样我们就创建了一个只有单个命名空间访问权限的普通 User 。

### 只能访问某个 namespace 的 ServiceAccount

上面我们创建了一个只能访问某个命名空间下面的**普通用户**，我们前面也提到过 `subjects` 下面还有一种类型的主题资源：`ServiceAccount`，现在我们来创建一个集群内部的用户只能操作 kube-system 这个命名空间下面的 pods 和 deployments

我们把下面所有的资源文件放到  `/root/rbactest` 下

#### 创建一个集群内部使用的用户（ServiceAccount）

* 准备 zq-sa.yaml

  ```yaml
  apiVersion: v1
  kind: ServiceAccount
  metadata:
    name: zq-sa
    namespace: kube-system
  ```

* 创建

  ```bash
  [root@k8s-master rbactest]# kubectl create -f zq-sa.yaml 
  serviceaccount/zq-sa created
  ```

* 查看

  ```bash
  [root@k8s-master rbactest]# kubectl get sa -n kube-system | grep zq-sa
  zq-sa                                1         53s
  
  # 获取 zq-sa 这个 ServiceAccount 详细信息
  [root@k8s-master rbactest]# kubectl get sa zq-sa -n kube-system -o yaml
  apiVersion: v1
  kind: ServiceAccount
  metadata:
    creationTimestamp: "2022-08-25T08:03:30Z"
    name: zq-sa
    namespace: kube-system
    resourceVersion: "112076"
    uid: 2f89ba9a-4509-4350-a543-5d321813c737
  secrets:
  - name: zq-sa-token-rcswr
  
  # 获取 zq-sa 这个 ServiceAccount 关联的 secret
  [root@k8s-master rbactest]# kubectl get secret zq-sa-token-rcswr -n kube-system -o yaml 
  apiVersion: v1
  data:
    ca.crt: -
    namespace: a3ViZS1zeXN0ZW0=
    token: xxxxxxxx
  kind: Secret
  metadata:
    annotations:
      kubernetes.io/service-account.name: zq-sa
      kubernetes.io/service-account.uid: 2f89ba9a-4509-4350-a543-5d321813c737
    creationTimestamp: "2022-08-25T08:03:30Z"
    managedFields:
    - apiVersion: v1
      fieldsType: FieldsV1
      fieldsV1:
        f:data:
          .: {}
          f:ca.crt: {}
          f:namespace: {}
          f:token: {}
        f:metadata:
          f:annotations:
            .: {}
            f:kubernetes.io/service-account.name: {}
            f:kubernetes.io/service-account.uid: {}
        f:type: {}
      manager: kube-controller-manager
      operation: Update
      time: "2022-08-25T08:03:30Z"
    name: zq-sa-token-rcswr
    namespace: kube-system
    resourceVersion: "112075"
    uid: 728d0487-00d9-422e-abad-8693fa8a4aa5
  type: kubernetes.io/service-account-token
  ```

#### 创建角色（Role）

* 准备 zq-sa-role.yaml

  ```yaml
  apiVersion: rbac.authorization.k8s.io/v1
  kind: Role
  metadata:
    name: zq-sa-role
    namespace: kube-system
  rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "watch", "list"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  ```

* 创建Role对象

  ```bash
  [root@k8s-master rbactest]# kubectl create -f zq-sa-role.yaml 
  role.rbac.authorization.k8s.io/zq-sa-role created
  ```

* 查看

  ```bash
  [root@k8s-master rbactest]# kubectl get role -n kube-system | grep zq-sa-role
  zq-sa-role                                       2022-08-25T08:08:24Z
  ```

#### 创建角色权限绑定（RoleBinding）

然后创建一个 `RoleBinding` 对象，将上面的 用户`zq-sa` 和角色 zq-sa-role 进行绑定：

* 准备 zq-sa-rolebinding.yaml

  ```yaml
  apiVersion: rbac.authorization.k8s.io/v1
  kind: RoleBinding
  metadata:
    name: zq-sa-rolebinding
    namespace: kube-system
  subjects:
  - kind: ServiceAccount
    name: zq-sa
    namespace: kube-system
  roleRef: # 引用的角色
    kind: Role
    name: zq-sa-role
    apiGroup: rbac.authorization.k8s.io
  ```

* 创建

  ```she
  [root@k8s-master rbactest]#  kubectl create -f zq-sa-rolebinding.yaml    
  rolebinding.rbac.authorization.k8s.io/zq-sa-rolebinding created

*  查看

  ```bash
  [root@k8s-master rbactest]# kubectl get rolebinding -n kube-system
  NAME                                                ROLE                                                  AGE
  kube-proxy                                          Role/kube-proxy                                       11d
  kubeadm:kubelet-config-1.20                         Role/kubeadm:kubelet-config-1.20                      11d
  kubeadm:nodes-kubeadm-config                        Role/kubeadm:nodes-kubeadm-config                     11d
  system::extension-apiserver-authentication-reader   Role/extension-apiserver-authentication-reader        11d
  system::leader-locking-kube-controller-manager      Role/system::leader-locking-kube-controller-manager   11d
  system::leader-locking-kube-scheduler               Role/system::leader-locking-kube-scheduler            11d
  system:controller:bootstrap-signer                  Role/system:controller:bootstrap-signer               11d
  system:controller:cloud-provider                    Role/system:controller:cloud-provider                 11d
  system:controller:token-cleaner                     Role/system:controller:token-cleaner                  11d
  zq-rolebinding                                      Role/zq-role                                          95m
  zq-sa-rolebinding                                   Role/zq-sa-role                                       39s
  ```

#### 测试验证

ServiceAccount 会生成一个 Secret 对象和它进行映射，这个 Secret 里面包含一个 token，我们可以利用这个 token 去登录 Dashboard，然后我们就可以在 Dashboard 中来验证我们的功能是否符合预期了：

```bash
# 获取 kube-system 这个命令空间下 zq-sa 这个 ServiceAccount 的详细信息
[root@k8s-master rbactest]# kubectl get sa zq-sa -n kube-system -o yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  creationTimestamp: "2022-08-25T08:03:30Z"
  name: zq-sa
  namespace: kube-system
  resourceVersion: "112076"
  uid: 2f89ba9a-4509-4350-a543-5d321813c737
secrets:
- name: zq-sa-token-rcswr

# 获取 zq-sa 这个 ServiceAccount 关联的 secret 的信息
[root@k8s-master rbactest]# kubectl get secret  zq-sa-token-rcswr -n kube-system -o yaml
apiVersion: v1
data:
  ca.crt: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUM1ekNDQWMrZ0F3SUJBZ0lCQURBTkJna3Foa2lHOXcwQkFRc0ZBREFWTVJNd0VRWURWUVFERXdwcmRXSmwKY201bGRHVnpNQjRYRFRJeU1EZ3hNekV4TVRjeE1sb1hEVE15TURneE1ERXhNVGN4TWxvd0ZURVRNQkVHQTFVRQpBeE1LYTNWaVpYSnVaWFJsY3pDQ0FTSXdEUVlKS29aSWh2Y05BUUVCQlFBRGdnRVBBRENDQVFvQ2dnRUJBTWN4ClVrNit1TlA4NDZ2ekRxUW9VTlg4MEgzSXhyV3dzVHJZdXdxc1pqei9vb2tFVUF3dDgxQm1aOXl2eXpxSGcya2UKckNjcU1TaE5HcmJiems0NWlCekcwaGtSZDdsSVlEZmI3WHhGWmtwV2RZZlZBK1ZCTkpGRU1VRVVLc2Y2OFFXTQpDVENxajRvTysyUlFLaFFOQ2ZVVm9LUGFwai9lTEZWR2dMSzgyWDBmVllEV1NZMWcrSk1BZWI4V29qa2tVSXQ3CjJNbmlRRjgxMnNGb1A3MkNydGdoU1RzWG1ueldmVkxTMUhxY21GbVBOZG02RjNnSk5CVzFrWmFOaVY3dy9RVzIKNFQ5U1RtQlc0NnhjRm5pKzdPaTVuVzZaWEF5RENPN09MZGhtUWN3TlQzekZLZ3N2SEJRZDNxY0NCb2ZUeUhWRAp1U1dzVWNKYjFleWtnL2NzMy9zQ0F3RUFBYU5DTUVBd0RnWURWUjBQQVFIL0JBUURBZ0trTUE4R0ExVWRFd0VCCi93UUZNQU1CQWY4d0hRWURWUjBPQkJZRUZISUdnaXBjcEVaTm55Y3Z1bUo5K3VSNFdqeFhNQTBHQ1NxR1NJYjMKRFFFQkN3VUFBNElCQVFBTmVmelo1QjI1aGlNUzZDM0RtNHZDcmtMSEVWZm44NzlEZ3kyc1ZLTVl5VGt2Q0N3LwpWUDhXNmUzcGNnRDBSd29GMytGWDh3YkhGdmlaa2pDd1dwelhOeWszRGFUUWxaeXQwWG93eTd5bVRjdi92L0wvClliMmIrN0pmWmRtb2JxMDZYUEk0L0Y1TllRRkl3MkZOMXlrdnR6TzJoNEp1ZmhMSTUwRSswdnRZZ2t0NDFHOEsKd1VjWGZ2NWx1K3BoZHQ4QXpWdjV3akcrU1h4emV0TjgvU29icnRvRmxZVjZLcHpMSysrRUtFTWd0Z0g0OUNxcQpUYmpsNFIybjNqcU1wVWpEdUpFTFF5ZDg3N2g5V240WCtEdUdEYVRHNEJPVFlHUkZvSTcxS1FzZWlTWFd0NUJmCjd3SG40T3ZkN1U1S0o1dkEzWEZIVWJPanExY3RITTlreWJCMAotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==
  namespace: a3ViZS1zeXN0ZW0=
  token: ZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNklqRkpYMHRtYkZvelFXUTFSMnR5TjNkTVprTkJaRFowUkdwZlkyaFNVbU5vYUZJM1VUTndWbUpMVmtVaWZRLmV5SnBjM01pT2lKcmRXSmxjbTVsZEdWekwzTmxjblpwWTJWaFkyTnZkVzUwSWl3aWEzVmlaWEp1WlhSbGN5NXBieTl6WlhKMmFXTmxZV05qYjNWdWRDOXVZVzFsYzNCaFkyVWlPaUpyZFdKbExYTjVjM1JsYlNJc0ltdDFZbVZ5Ym1WMFpYTXVhVzh2YzJWeWRtbGpaV0ZqWTI5MWJuUXZjMlZqY21WMExtNWhiV1VpT2lKNmNTMXpZUzEwYjJ0bGJpMXlZM04zY2lJc0ltdDFZbVZ5Ym1WMFpYTXVhVzh2YzJWeWRtbGpaV0ZqWTI5MWJuUXZjMlZ5ZG1salpTMWhZMk52ZFc1MExtNWhiV1VpT2lKNmNTMXpZU0lzSW10MVltVnlibVYwWlhNdWFXOHZjMlZ5ZG1salpXRmpZMjkxYm5RdmMyVnlkbWxqWlMxaFkyTnZkVzUwTG5WcFpDSTZJakptT0RsaVlUbGhMVFExTURrdE5ETTFNQzFoTlRRekxUVmtNekl4T0RFell6Y3pOeUlzSW5OMVlpSTZJbk41YzNSbGJUcHpaWEoyYVdObFlXTmpiM1Z1ZERwcmRXSmxMWE41YzNSbGJUcDZjUzF6WVNKOS5kSnZHNjB2TlQ3a3lfX2FWU0hCT2dXZllvYm0yNmJfOFJrNGNHYVVieGJxRmZzc1drZ2dZek5BRmR0RFdoTWdicWlsdENNTjlzd20wWmVIUU4zb29IZU5Zd2c5U0ZiTDJBZDN3WExsQzUyVzZ1Z0JfeEVieGoxMlpPZTMzT2tWNk9Fd1NoeldBOFdqMXZTbGp3aHRPZUs0b1d4S2VSSHFKVW0tZVBjQ0lqcWhxOF92QTlhMXJuQ3VXSTNPT0RmX0NPdUlxdDdZRVktdElSbWhyZ1pRZVRMdXY5eUxhWVFIekpFSTRVVURfbWRIRVZFQzMtN1E2eDhoQnZudnNydmlyajhtYy1kYXFTd2FkU3NGbHhXeUxlTkFPQm1Cc0JzY3VjVEV0SnhORl9jQ1VGbHNwT0dfMFREY01NWWJVTDI3eFRSSkFZOFRoUTdfSUg5VHROMml4UXc=
kind: Secret
metadata:
  annotations:
    kubernetes.io/service-account.name: zq-sa
    kubernetes.io/service-account.uid: 2f89ba9a-4509-4350-a543-5d321813c737
  creationTimestamp: "2022-08-25T08:03:30Z"
  managedFields:
  - apiVersion: v1
    fieldsType: FieldsV1
    fieldsV1:
      f:data:
        .: {}
        f:ca.crt: {}
        f:namespace: {}
        f:token: {}
      f:metadata:
        f:annotations:
          .: {}
          f:kubernetes.io/service-account.name: {}
          f:kubernetes.io/service-account.uid: {}
      f:type: {}
    manager: kube-controller-manager
    operation: Update
    time: "2022-08-25T08:03:30Z"
  name: zq-sa-token-rcswr
  namespace: kube-system
  resourceVersion: "112075"
  uid: 728d0487-00d9-422e-abad-8693fa8a4aa5
type: kubernetes.io/service-account-token

# 对 token 解码
[root@k8s-master rbactest]# kubectl get secret zq-sa-token-rcswr -o jsonpath={.data.token} -n kube-system |base64 -d                 
eyJhbGciOiJSUzI1NiIsImtpZCI6IjFJX0tmbFozQWQ1R2tyN3dMZkNBZDZ0RGpfY2hSUmNoaFI3UTNwVmJLVkUifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJrdWJlLXN5c3RlbSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJ6cS1zYS10b2tlbi1yY3N3ciIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50Lm5hbWUiOiJ6cS1zYSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50LnVpZCI6IjJmODliYTlhLTQ1MDktNDM1MC1hNTQzLTVkMzIxODEzYzczNyIsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDprdWJlLXN5c3RlbTp6cS1zYSJ9.dJvG60vNT7ky__aVSHBOgWfYobm26b_8Rk4cGaUbxbqFfssWkggYzNAFdtDWhMgbqiltCMN9swm0ZeHQN3ooHeNYwg9SFbL2Ad3wXLlC52W6ugB_xEbxj12ZOe33OkV6OEwShzWA8Wj1vSljwhtOeK4oWxKeRHqJUm-ePcCIjqhq8_vA9a1rnCuWI3OODf_COuIqt7YEY-tIRmhrgZQeTLuv9yLaYQHzJEI4UUD_mdHEVEC3-7Q6x8hBvnvsrvirj8mc-daqSwadSsFlxWyLeNAOBmBsBscucTEtJxNF_cCUFlspOG_0TDcMMYbUL27xTRJAY8ThQ7_IH9TtN2ixQw
```

使用这里的 解码后 token 去 Dashboard 页面进行登录然后验证权限是否符合我们的预期：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-rbac-sa-1.png)

我们可以看到上面的提示信息说我们现在使用的这个 ServiceAccount 没有权限获取当前命名空间下面的资源对象，这是因为我们登录进来后默认跳转到 default 命名空间，我们切换到 kube-system 命名空间下面就可以了：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-rbac-sa-2.png)



我们试着删除一个 Pod 看看

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-rbac-sa-3.png)

可以看到禁止我们删除，这是因为 zq-sa 这个用户我们只授权它Pod  "get", "watch", "list"的操作权限。

### 可以全局访问的 ServiceAccount

刚刚我们创建的 zq-sa 这个 `ServiceAccount` 和一个 `Role` 角色进行绑定的，如果我们现在创建一个新的 ServiceAccount，需要它操作的权限作用于所有的 namespace，这个时候我们就需要使用到 `ClusterRole` 和 `ClusterRoleBinding` 这两种资源对象了。

#### 创建一个集群内部使用的用户（ServiceAccount）

* 准备 zq-sa-cluster.yaml

  ```yaml
  apiVersion: v1
  kind: ServiceAccount
  metadata:
    name: zq-sa-cluster
    namespace: kube-system
  ```

* 创建

  ```bash
  [root@k8s-master rbactest]# kubectl create -f zq-sa-cluster.yaml 
  serviceaccount/zq-sa-cluster created
  ```

#### 创建集群角色（ClusterRole）

我们就不创建 clusterRole 了，我们就使用系统内置的 ClusterRole

#### 创建集群角色权限绑定（ClusterRoleBinding）

* 准备 zq-sa-clusterolebinding.yaml

  ```yaml
  apiVersion: rbac.authorization.k8s.io/v1
  kind: ClusterRoleBinding
  metadata:
    name: zq-sa-clusterolebinding
  subjects:
  - kind: ServiceAccount
    name: zq-sa-cluster
    namespace: kube-system
  roleRef:
    kind: ClusterRole
    name: cluster-admin
    apiGroup: rbac.authorization.k8s.io
  ```

  从上面我们可以看到我们没有为这个资源对象声明 namespace，因为这是一个 ClusterRoleBinding 资源对象，是作用于整个集群的，我们也没有单独新建一个 ClusterRole 对象，而是使用的 `cluster-admin` 这个对象，这是 Kubernetes 集群内置的 ClusterRole 对象，我们可以使用 `kubectl get clusterrole` 和 `kubectl get clusterrolebinding` 查看系统内置的一些集群角色和集群角色绑定，这里我们使用的 `cluster-admin` 这个集群角色是拥有最高权限的集群角色，所以一般需要谨慎使用该集群角色。

* 创建

  ```bash
  [root@k8s-master rbactest]# kubectl create -f zq-sa-clusterolebinding.yaml 
  clusterrolebinding.rbac.authorization.k8s.io/zq-sa-clusterolebinding created
  ```

* 查看

  ```bash
  [root@k8s-master rbactest]# kubectl get clusterrole cluster-admin
  NAME            CREATED AT
  cluster-admin   2022-08-13T11:17:28Z
  
  [root@k8s-master rbactest]# kubectl get clusterrolebinding zq-sa-clusterolebinding -n kube-system
  NAME                      ROLE                        AGE
  zq-sa-clusterolebinding   ClusterRole/cluster-admin   102s
  ```

#### 测试验证

```bash
[root@k8s-master rbactest]# kubectl get sa -n kube-system
NAME                                 SECRETS   AGE
......
zq-sa                                1         56m
zq-sa-cluster                        1         6m9s
......

[root@k8s-master rbactest]# kubectl get sa zq-sa-cluster -n kube-system -o yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  creationTimestamp: "2022-08-25T08:53:35Z"
  name: zq-sa-cluster
  namespace: kube-system
  resourceVersion: "116844"
  uid: c4bfbe6d-70df-4194-846d-30c74db8e0c1
secrets:
- name: zq-sa-cluster-token-xzff2

# 查看 zq-sa-cluster 这个 ServiceAccount 关联的 secret
[root@k8s-master rbactest]# kubectl get secret zq-sa-cluster-token-xzff2 -n kube-system -o yaml
apiVersion: v1
data:
  ca.crt: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUM1ekNDQWMrZ0F3SUJBZ0lCQURBTkJna3Foa2lHOXcwQkFRc0ZBREFWTVJNd0VRWURWUVFERXdwcmRXSmwKY201bGRHVnpNQjRYRFRJeU1EZ3hNekV4TVRjeE1sb1hEVE15TURneE1ERXhNVGN4TWxvd0ZURVRNQkVHQTFVRQpBeE1LYTNWaVpYSnVaWFJsY3pDQ0FTSXdEUVlKS29aSWh2Y05BUUVCQlFBRGdnRVBBRENDQVFvQ2dnRUJBTWN4ClVrNit1TlA4NDZ2ekRxUW9VTlg4MEgzSXhyV3dzVHJZdXdxc1pqei9vb2tFVUF3dDgxQm1aOXl2eXpxSGcya2UKckNjcU1TaE5HcmJiems0NWlCekcwaGtSZDdsSVlEZmI3WHhGWmtwV2RZZlZBK1ZCTkpGRU1VRVVLc2Y2OFFXTQpDVENxajRvTysyUlFLaFFOQ2ZVVm9LUGFwai9lTEZWR2dMSzgyWDBmVllEV1NZMWcrSk1BZWI4V29qa2tVSXQ3CjJNbmlRRjgxMnNGb1A3MkNydGdoU1RzWG1ueldmVkxTMUhxY21GbVBOZG02RjNnSk5CVzFrWmFOaVY3dy9RVzIKNFQ5U1RtQlc0NnhjRm5pKzdPaTVuVzZaWEF5RENPN09MZGhtUWN3TlQzekZLZ3N2SEJRZDNxY0NCb2ZUeUhWRAp1U1dzVWNKYjFleWtnL2NzMy9zQ0F3RUFBYU5DTUVBd0RnWURWUjBQQVFIL0JBUURBZ0trTUE4R0ExVWRFd0VCCi93UUZNQU1CQWY4d0hRWURWUjBPQkJZRUZISUdnaXBjcEVaTm55Y3Z1bUo5K3VSNFdqeFhNQTBHQ1NxR1NJYjMKRFFFQkN3VUFBNElCQVFBTmVmelo1QjI1aGlNUzZDM0RtNHZDcmtMSEVWZm44NzlEZ3kyc1ZLTVl5VGt2Q0N3LwpWUDhXNmUzcGNnRDBSd29GMytGWDh3YkhGdmlaa2pDd1dwelhOeWszRGFUUWxaeXQwWG93eTd5bVRjdi92L0wvClliMmIrN0pmWmRtb2JxMDZYUEk0L0Y1TllRRkl3MkZOMXlrdnR6TzJoNEp1ZmhMSTUwRSswdnRZZ2t0NDFHOEsKd1VjWGZ2NWx1K3BoZHQ4QXpWdjV3akcrU1h4emV0TjgvU29icnRvRmxZVjZLcHpMSysrRUtFTWd0Z0g0OUNxcQpUYmpsNFIybjNqcU1wVWpEdUpFTFF5ZDg3N2g5V240WCtEdUdEYVRHNEJPVFlHUkZvSTcxS1FzZWlTWFd0NUJmCjd3SG40T3ZkN1U1S0o1dkEzWEZIVWJPanExY3RITTlreWJCMAotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==
  namespace: a3ViZS1zeXN0ZW0=
  token: ZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNklqRkpYMHRtYkZvelFXUTFSMnR5TjNkTVprTkJaRFowUkdwZlkyaFNVbU5vYUZJM1VUTndWbUpMVmtVaWZRLmV5SnBjM01pT2lKcmRXSmxjbTVsZEdWekwzTmxjblpwWTJWaFkyTnZkVzUwSWl3aWEzVmlaWEp1WlhSbGN5NXBieTl6WlhKMmFXTmxZV05qYjNWdWRDOXVZVzFsYzNCaFkyVWlPaUpyZFdKbExYTjVjM1JsYlNJc0ltdDFZbVZ5Ym1WMFpYTXVhVzh2YzJWeWRtbGpaV0ZqWTI5MWJuUXZjMlZqY21WMExtNWhiV1VpT2lKNmNTMXpZUzFqYkhWemRHVnlMWFJ2YTJWdUxYaDZabVl5SWl3aWEzVmlaWEp1WlhSbGN5NXBieTl6WlhKMmFXTmxZV05qYjNWdWRDOXpaWEoyYVdObExXRmpZMjkxYm5RdWJtRnRaU0k2SW5weExYTmhMV05zZFhOMFpYSWlMQ0pyZFdKbGNtNWxkR1Z6TG1sdkwzTmxjblpwWTJWaFkyTnZkVzUwTDNObGNuWnBZMlV0WVdOamIzVnVkQzUxYVdRaU9pSmpOR0ptWW1VMlpDMDNNR1JtTFRReE9UUXRPRFEyWkMwek1HTTNOR1JpT0dVd1l6RWlMQ0p6ZFdJaU9pSnplWE4wWlcwNmMyVnlkbWxqWldGalkyOTFiblE2YTNWaVpTMXplWE4wWlcwNmVuRXRjMkV0WTJ4MWMzUmxjaUo5LmotcURjMkNETGlJa29FMTQxRmJCU1lqSDE3bVNvZWFhVDNVcFBHeDRDeVhoaGwxcm9ob2w5b2lOaUFQM0dROUJWbGxUR0MybXZ1Skk0Z1RPUUpXOEpfRy1xRHhpeklhMndaQTd5UXZFd3lrNjZYSldhamFmT1RIZ0ttVnpxR2hpVjRXeS1xVGlCTjVJdzlqNTctMXBHUkh5N3JZTFpJVlpNSl9sX1FQMTQ4bTZQY05HbFhRemJlaDI5eE1KRnoyaDE1QUg5dkJYZEMtcmhjQkR6dWp4ck8yeXR1WG4yckhvampaeXZ5bjZBMm5kMXZZcDVvOUVGT01zb0thNUVHOWRkTmFubFFMTGprU2ZGZm5nSTJ3NFFPZkdWRkJxdEtHTHE0c2pHYldDZWFTeEpRZ0o3V3FUOUoxemxOR292aXJnd1NORExYLWN0SW5HLUdZVmQ2V29fUQ==
kind: Secret
metadata:
  annotations:
    kubernetes.io/service-account.name: zq-sa-cluster
    kubernetes.io/service-account.uid: c4bfbe6d-70df-4194-846d-30c74db8e0c1
  creationTimestamp: "2022-08-25T08:53:35Z"
  managedFields:
  - apiVersion: v1
    fieldsType: FieldsV1
    fieldsV1:
      f:data:
        .: {}
        f:ca.crt: {}
        f:namespace: {}
        f:token: {}
      f:metadata:
        f:annotations:
          .: {}
          f:kubernetes.io/service-account.name: {}
          f:kubernetes.io/service-account.uid: {}
      f:type: {}
    manager: kube-controller-manager
    operation: Update
    time: "2022-08-25T08:53:35Z"
  name: zq-sa-cluster-token-xzff2
  namespace: kube-system
  resourceVersion: "116843"
  uid: 209e069d-f475-4d95-a848-abff78c28113
type: kubernetes.io/service-account-token

# 对 secret 中的 token base64解码
[root@k8s-master rbactest]# kubectl get secret zq-sa-cluster-token-xzff2 -o jsonpath={.data.token} -n kube-system |base64 -d                      
eyJhbGciOiJSUzI1NiIsImtpZCI6IjFJX0tmbFozQWQ1R2tyN3dMZkNBZDZ0RGpfY2hSUmNoaFI3UTNwVmJLVkUifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJrdWJlLXN5c3RlbSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJ6cS1zYS1jbHVzdGVyLXRva2VuLXh6ZmYyIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQubmFtZSI6InpxLXNhLWNsdXN0ZXIiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC51aWQiOiJjNGJmYmU2ZC03MGRmLTQxOTQtODQ2ZC0zMGM3NGRiOGUwYzEiLCJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6a3ViZS1zeXN0ZW06enEtc2EtY2x1c3RlciJ9.j-qDc2CDLiIkoE141FbBSYjH17mSoeaaT3UpPGx4CyXhhl1rohol9oiNiAP3GQ9BVllTGC2mvuJI4gTOQJW8J_G-qDxizIa2wZA7yQvEwyk66XJWajafOTHgKmVzqGhiV4Wy-qTiBN5Iw9j57-1pGRHy7rYLZIVZMJ_l_QP148m6PcNGlXQzbeh29xMJFz2h15AH9vBXdC-rhcBDzujxrO2ytuXn2rHojjZyvyn6A2nd1vYp5o9EFOMsoKa5EG9ddNanlQLLjkSfFfngI2w4QOfGVFBqtKGLq4sjGbWCeaSxJQgJ7WqT9J1zlNGovirgwSNDLX-ctInG-GYVd6Wo_Q
```

拿着解码后的 token 去 dashboard 上登录验证：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220825170504.png)



可以看到它有所有命名空间的权限。



我们在最开始接触到 RBAC 认证的时候，可能不太熟悉，特别是不知道应该怎么去编写 rules 规则，可以去分析系统自带的 `clusterrole`、`clusterrolebinding` 这些资源对象的编写方法，怎么分析？还是利用 kubectl 的 `get`、`describe`、 `-o yaml` 这些操作。



## 参考

* https://v1-21.docs.kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/
* https://v1-21.docs.kubernetes.io/docs/reference/using-api/
* https://v1-21.docs.kubernetes.io/docs/reference/using-api/api-concepts/
* https://v1-21.docs.kubernetes.io/docs/reference/access-authn-authz/rbac/
* https://www.qikqiak.com/k8strain/security/rbac/