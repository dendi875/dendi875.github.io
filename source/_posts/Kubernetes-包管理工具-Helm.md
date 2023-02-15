---
title: Kubernetes 包管理工具 Helm
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-31 20:33:42
password:
summary: Kubernetes 包管理工具 Helm
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes 包管理工具 Helm



## 为什么需要 Helm

Kubernetes 中一个重要的设计理念就是，声明式的操作。用户通过设置系统的预期状态来改变系统。例如，现在的副本数量是 2 ，需要调整为 3。声明式的处理方式是，修改配置文件中副本数量为 3 ；命令式的处理方式是，发送增加一个副本的命令，+1。

使用申明式配置的系统更关注结果，对系统设计要求更高。在分布式系统中，任何组件都不是 100 % 可靠的，对使用者来说，声明式配置的系统更加友好。

Kubernetes 采用 yaml 作为配置文件。在 Kubernetes 中部署一个简单的 Jenkins 服务，就得写两个 yaml 文件: jenkins-deployment.yaml 和 jenkins-service.yaml。再加上其他服务，考虑到多套环境，需要维护的 yaml 文件数量会很大。

直接维护 yaml，进行部署 ，既不利于项目组织，也不利于维护更新。我们需要一个工具简化应用部署和管理流程。

## 什么是Helm

Helm 是 Deis 发起的一个 Kubernetes 包管理器，类似于 Linux 中的 apt 和 yum 工具。Deis 公司已经被微软收购。

### 重要概念

对于Helm，有几个重要的概念：

- Chart： Helm的软件包， 内部包含了一组相关的kubernetes资源的yaml文件。

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-helm-1.png)

- Repoistory：: Helm的软件仓库，repository本质上是一个web服务器，该服务器保存了chart软件包以供下载，并有提供一个该repository的chart包的清单文件以供查询。在使用时，Helm可以对接多个不同的Repository。 其中Artifact Hub 是helm 的官方chart 仓库——helm 弃用了自己的hub，迁移到了Artifact Hub。

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-helm-2.png)

- Release：使用Helm install命令在Kubernetes集群中安装的Chart称为Release。一个chart可以部署成多个release，例如使用同一个wordpress chart部署多套release。

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-helm-3.png)

- Revision：每个Release会有不同的版本，在Revision中按数字递增保存了每个版本的信息。

上面的所有组件一起按如下方式工作：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/k8s-helm-4.png)



### Helm提供的功能

做为 Kubernetes 的一个包管理工具，`Helm`具有如下功能：

- 创建新的 chart
- chart 打包成 tgz 格式
- 上传 chart 到 chart 仓库或从仓库中下载 chart
- 在`Kubernetes`集群中安装或卸载 chart
- 管理用`Helm`安装的 chart 的发布周期

## 安装

参考：https://helm.sh/docs/intro/install/ ，不同平台(windows, linux, mac)的安装方式不一样

注意：[Helm和Kubernetes版本之间的兼容性](https://helm.sh/docs/topics/version_skew/)

首先当然需要一个可用的 Kubernetes 集群，然后在我们使用 Helm 的节点上已经配置好可以通过 kubectl 访问集群，因为 Helm 其实就是读取的 kubeconfig 文件来访问集群的。

由于 Helm V2 版本必须在 Kubernetes 集群中安装一个 Tiller 服务进行通信，这样大大降低了其安全性和可用性，所以在 V3 版本中移除了服务端，采用了通用的 Kubernetes CRD 资源来进行管理，这样就只需要连接上 Kubernetes 即可，而且 V3 版本已经发布了稳定版，所以我们这里来安装最新的 v3.7.1 版本，软件包下载地址为：https://get.helm.sh/helm-v3.7.1-darwin-amd64.tar.gz，我们可以根据自己的节点选择合适的包，比如我这里是 Mac，就下载 [MacOS amd64](https://get.helm.sh/helm-v3.7.1-darwin-amd64.tar.gz) 的版本。



```bash
# zhangquan @ MacBook-Pro in ~ [17:29:54] 
$ kubectl get nodes
NAME             STATUS   ROLES    AGE   VERSION
docker-desktop   Ready    master   20d   v1.15.5
```

下载到本地解压后，将 helm 二进制包文件移动到任意的 PATH 路径下即可：

```bash
# zhangquan @ MacBook-Pro in ~/Downloads/darwin-amd64 [13:21:28] 
$ ll
total 99104
-rw-r--r--@ 1 zhangquan  180847186    11K 10 14  2021 LICENSE
-rw-r--r--@ 1 zhangquan  180847186   3.3K 10 14  2021 README.md
-rwxr-xr-x@ 1 zhangquan  180847186    48M 10 14  2021 helm

# zhangquan @ MacBook-Pro in ~/Downloads/darwin-amd64 [13:53:19] 
$ mv helm /usr/local/bin/helm 

$ helm version
version.BuildInfo{Version:"v3.7.1", GitCommit:"1d11fcb5d3f3bf00dbe6fe31b8412839a96b3dc4", GitTreeState:"clean", GoVersion:"go1.16.9"}
```

看到上面的版本信息证明已经成功了。

一旦 Helm 客户端准备成功后，我们就可以添加一个 chart 仓库，当然最常用的就是官方的 Helm stable charts 仓库，但是由于官方的 charts 仓库地址需要科学上网，我们可以使用微软的 charts 仓库代替：

```bash
$ helm repo add stable http://mirror.azure.cn/kubernetes/charts/
"stable" has been added to your repositories

$ helm repo list                                                
NAME    URL                                      
stable  http://mirror.azure.cn/kubernetes/charts/
```

安装完成后可以用 search 命令来搜索可以安装的 chart 包：

```bash
$ helm search repo stable
NAME                                    CHART VERSION   APP VERSION             DESCRIPTION                                       
stable/acs-engine-autoscaler            2.2.2           2.1.1                   DEPRECATED Scales worker nodes within agent pools 
stable/aerospike                        0.3.5           v4.5.0.5                DEPRECATED A Helm chart for Aerospike in Kubern...
stable/airflow                          7.13.3          1.10.12                 DEPRECATED - please use: https://github.com/air...
stable/ambassador                       5.3.2           0.86.1                  DEPRECATED A Helm chart for Datawire Ambassador   
stable/anchore-engine                   1.7.0           0.7.3                   Anchore container analysis and policy evaluatio...
stable/apm-server                       2.1.7           7.0.0                   DEPRECATED The server receives data from the El...
stable/ark                              4.2.2           0.10.2                  DEPRECATED A Helm chart for ark 
......
```

## 示例

为了安装一个 chart 包，我们可以使用 `helm install` 命令，Helm 有多种方法来找到和安装 chart 包，但是最简单的方法当然是使用官方的 `stable` 这个仓库直接安装：

首先从仓库中将可用的 charts 信息同步到本地，可以确保我们获取到最新的 charts 列表：

```
$ helm repo update
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "stable" chart repository
Update Complete. ⎈Happy Helming!⎈
```

比如我们现在安装一个 `mysql` 应用：

```bash
$ helm install stable/mysql --generate-name
WARNING: This chart is deprecated
NAME: mysql-1661839473
LAST DEPLOYED: Tue Aug 30 14:04:36 2022
NAMESPACE: default
STATUS: deployed
REVISION: 1
NOTES:
MySQL can be accessed via port 3306 on the following DNS name from within your cluster:
mysql-1661839473.default.svc.cluster.local
......
```

我们可以看到 `stable/mysql` 这个 chart 已经安装成功了，我们将安装成功的这个应用叫做一个 `release`，由于我们在安装的时候指定了`--generate-name` 参数，所以生成的 release 名称是随机生成的，名为 `mysql-1661839473`。我们可以用下面的命令来查看 release 安装以后对应的 Kubernetes 资源的状态：

```bash
$ kubectl get all -l release=mysql-1661839473
NAME                                    READY   STATUS    RESTARTS   AGE
pod/mysql-1661839473-7597b94bc5-2lt9c   1/1     Running   0          118s

NAME                       TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)    AGE
service/mysql-1661839473   ClusterIP   10.98.24.64   <none>        3306/TCP   118s

NAME                               READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/mysql-1661839473   1/1     1            1           118s

NAME                                          DESIRED   CURRENT   READY   AGE
replicaset.apps/mysql-1661839473-7597b94bc5   1         1         1       118s
```

我们也可以 `helm show chart` 命令来了解 MySQL 这个 chart 包的一些特性：

```bash
$ helm show chart stable/mysql
apiVersion: v1
appVersion: 5.7.30
deprecated: true
description: DEPRECATED - Fast, reliable, scalable, and easy to use open-source relational
  database system.
home: https://www.mysql.com/
icon: https://www.mysql.com/common/logos/logo-mysql-170x115.png
keywords:
- mysql
- database
- sql
name: mysql
sources:
- https://github.com/kubernetes/charts
- https://github.com/docker-library/mysql
version: 1.6.9
```

如果想要了解更多信息，可以用 `helm show all` 命令：

```
$ helm show all stable/mysql
......
```

需要注意的是无论什么时候安装 chart，都会创建一个新的 release，所以一个 chart 包是可以多次安装到同一个集群中的，每个都可以独立管理和升级。

同样我们也可以用 Helm 很容易查看到已经安装的 release：

```bash
$ helm ls                        
NAME                    NAMESPACE       REVISION        UPDATED                                 STATUS          CHART           APP VERSION
mysql-1661839473        default         1               2022-08-30 14:04:36.833439 +0800 CST    deployed        mysql-1.6.9     5.7.30 
```

如果需要删除这个 release，也很简单，只需要使用 `helm uninstall` 命令即可：

```bash
$ helm uninstall mysql-1661839473  
release "mysql-1661839473" uninstalled

$ kubectl get all -l release=mysql-1661839473
No resources found in default namespace.

$ helm status mysql-1661839473
Error: release: not found
```

`uninstall` 命令会从 Kubernetes 中删除 release，也会删除与 release 相关的所有 Kubernetes 资源以及 release 历史记录。也可以在删除的时候使用 `--keep-history` 参数，则会保留 release 的历史记录，可以获取该 release 的状态就是 `UNINSTALLED`，而不是找不到 release了：

```bash
$ helm uninstall mysql-1661839949 --keep-history
release "mysql-1661839949" uninstalled

$ helm status mysql-1661839949
NAME: mysql-1661839949
LAST DEPLOYED: Tue Aug 30 14:12:32 2022
NAMESPACE: default
STATUS: uninstalled
......

$ helm ls -a
NAME                    NAMESPACE       REVISION        UPDATED                                 STATUS          CHART           APP VERSION
mysql-1661839949        default         1               2022-08-30 14:12:32.764243 +0800 CST    uninstalled     mysql-1.6.9     5.7.30   
```

因为 Helm 会在删除 release 后跟踪你的 release，所以你可以审查历史甚至取消删除 `release`（使用 `helm rollback` 命令）。



## 定制

上面我们都是直接使用的 `helm install` 命令安装的 chart 包，这种情况下只会使用 chart 的默认配置选项，但是更多的时候，是各种各样的需求，索引我们希望根据自己的需求来定制 chart 包的配置参数。

我们可以使用 `helm show values` 命令来查看一个 chart 包的所有可配置的参数选项：

```bash
$ helm show values stable/mysql
## mysql image version
## ref: https://hub.docker.com/r/library/mysql/tags/
##
image: "mysql"
imageTag: "5.7.30"

strategy:
  type: Recreate

busybox:
  image: "busybox"
  tag: "1.32"

testFramework:
  enabled: true
  image: "bats/bats"
  tag: "1.2.1"
  imagePullPolicy: IfNotPresent
  securityContext: {}

## Specify password for root user
##
## Default: random 10 character string
# mysqlRootPassword: testing

## Create a database user
##
# mysqlUser:
## Default: random 10 character string
# mysqlPassword:

## Allow unauthenticated access, uncomment to enable
##
# mysqlAllowEmptyPassword: true

## Create a database
##
# mysqlDatabase:

## Specify an imagePullPolicy (Required)
## It's recommended to change this to 'Always' if the image tag is 'latest'
## ref: http://kubernetes.io/docs/user-guide/images/#updating-images
##
imagePullPolicy: IfNotPresent
......
```

上面我们看到的所有参数都是可以用自己的数据来覆盖的，可以在安装的时候通过 YAML 格式的文件来传递这些参数：

```yaml
# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm [14:16:07] 
$ cat config.yaml 
mysqlUser:
  user0
mysqlPassword: user0pwd
mysqlDatabase: user0db
persistence:
  enabled: false
```

传递配置数据方式安装：

```bash
$ helm install -f config.yaml stable/mysql  --generate-name
WARNING: This chart is deprecated
NAME: mysql-1661840339
LAST DEPLOYED: Tue Aug 30 14:19:03 2022
NAMESPACE: default
STATUS: deployed
REVISION: 1
NOTES:
MySQL can be accessed via port 3306 on the following DNS name from within your cluster:
mysql-1661840339.default.svc.cluster.local
......
```

release 安装成功后，可以查看对应的 Pod 信息：

```bash
$ kubectl get pod -l release=mysql-1661840339
NAME                               READY   STATUS    RESTARTS   AGE
mysql-1661840339-655bdc759-4d94f   1/1     Running   0          2m25s

# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm [14:21:29] 
$ kubectl describe pod mysql-1661840339-655bdc759-4d94f
......
    Environment:
      MYSQL_ROOT_PASSWORD:  <set to the key 'mysql-root-password' in secret 'mysql-1661840339'>  Optional: false
      MYSQL_PASSWORD:       <set to the key 'mysql-password' in secret 'mysql-1661840339'>       Optional: false
      MYSQL_USER:           user0
      MYSQL_DATABASE:       user0db
......      
```

可以看到环境变量 `MYSQL_USER=user0，MYSQL_DATABASE=user0db` 的值和我们上面配置的值是一致的。在安装过程中，有两种方法可以传递配置数据：

* `--values（或者 -f）`：指定一个 YAML 文件来覆盖 values 值，可以指定多个值，最后边的文件优先
* `--set`：在命令行上指定覆盖的配置

如果同时使用这两个值，`--set` 将被合并到具有更高优先级的 `--values`，使用 `--set` 指定的值将持久化在 ConfigMap 中，对于给定的 release，可以使用 `helm get values <release-name>` 来查看已经设置的值，已设置的值也通过允许 `helm upgrade` 并指定 `--reset` 值来清除。

`--set` 选项接收零个或多个 name/value 对，最简单的用法就是 `--set name=value`，相当于 YAML 文件中的：

```yaml
name: value
```

多个值之间用字符串“,”隔开，用法就是 `--set a=b,c=d`，相当于 YAML 文件中的：

```bash
a: b
c: d
```

也支持更加复杂的表达式，例如 `--set outer.inner=value`，对应 YAML：

```yaml
outer:
  inner: value
```

对于列表数组可以用 `{}` 来包裹，比如 `--set name={a, b, c}`，对应 YAML：

```yaml
name:
 - a
 - b
 - c
```

从 Helm 2.5.0 开始，就可以使用数组索引语法来访问列表中某个项，比如 `--set servers[0].port=80`，对应的 YAML 为：

```yaml
servers:
 - port: 80
```

也可以这样设置多个值，比如 `--set servers[0].port=80,servers[0].host=example`，对应的 YAML 为：

```yaml
servers
  - port: 80
    host: example
```

有时候你可能需要在 `--set` 选项中使用特殊的字符，这个时候可以使用**反斜杠来转义字符**，比如 `--set name=value1\,value2`，对应的 YAML 为：

```yaml
name: "value1,value2"
```

类似的，你还可以转义`.`，当 chart 模板中使用 `toYaml` 函数来解析 annotations、labels 以及 node selectors 之类的时候，这非常有用，比如 `--set nodeSelector."kubernetes\.io/role"=master`，对应的 YAML 文件：

```yaml
nodeSelector:
  kubernetes.io/role: master
```

深度嵌套的数据结构可能很难使用 `--set` 来表示，所以一般推荐还是使用 YAML 文件来进行覆盖，当然在设计 chart 模板的时候也可以结合考虑到 `--set` 这种用法，尽可能的提供更好的支持。

## 更多安装方式

`helm install` 命令可以从多个源进行安装：

- chart 仓库（类似于上面我们提到的）
- 本地 chart 压缩包（helm install foo-0.1.1.tgz）
- 本地解压缩的 chart 目录（helm install foo path/to/foo）
- 在线的 URL（helm install fool https://example.com/charts/foo-1.2.3.tgz）

## 升级和回滚

当新版本的 chart 包发布的时候，或者当你要更改 release 的配置的时候，你可以使用 `helm upgrade` 命令来操作。升级需要一个现有的 release，并根据提供的信息对其进行升级。因为 Kubernetes charts 可能很大而且很复杂，Helm 会尝试以最小的侵入性进行升级，它只会更新自上一版本以来发生的变化：

```bash
$ cat panda.yaml 
mysqlUser:
  user0
mysqlPassword: user0pwd
mysqlDatabase: user0db
persistence:
  enabled: false
mysqlRootPassword: passw0rd
```

升级：

```bash
$ helm ls
NAME                    NAMESPACE       REVISION        UPDATED                                 STATUS          CHART           APP VERSION
mysql-1661840339        default         1               2022-08-30 14:19:03.821832 +0800 CST    deployed        mysql-1.6.9     5.7.30   

# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm [14:30:41] 
$ helm upgrade -f panda.yaml mysql-1661840339 stable/mysql
WARNING: This chart is deprecated
Release "mysql-1661840339" has been upgraded. Happy Helming!
NAME: mysql-1661840339
LAST DEPLOYED: Tue Aug 30 14:31:08 2022
NAMESPACE: default
STATUS: deployed
REVISION: 2
NOTES:
MySQL can be accessed via port 3306 on the following DNS name from within your cluster:
mysql-1661840339.default.svc.cluster.local
......
```

我们这里 `mysql` 这个 release 用相同的 chart 包进行升级，但是新增了一个配置项：

```yaml
mysqlRootPassword: passw0rd
```

我们可以使用 `helm get values` 来查看新设置是否生效：

```bash
# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm [14:32:10] 
$ helm get values mysql-1661840339
USER-SUPPLIED VALUES:
mysqlDatabase: user0db
mysqlPassword: user0pwd
mysqlRootPassword: passw0rd
mysqlUser: user0
persistence:
  enabled: false
```

`helm get` 命令是查看集群中 release 的非常有用的命令，正如我们在上面看到的，它显示了 `panda.yaml` 中的新配置值被部署到了集群中，现在如果某个版本在发布期间没有按计划进行，那么可以使用 `helm rollback [RELEASE] [REVISION]` 命令很容易回滚到之前的版本：

```bash
# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm [14:32:59] 
$ helm ls
NAME                    NAMESPACE       REVISION        UPDATED                                 STATUS          CHART           APP VERSION
mysql-1661840339        default         2               2022-08-30 14:31:08.870825 +0800 CST    deployed        mysql-1.6.9     5.7.30     

# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm [14:33:00] 
$ helm history mysql-1661840339
REVISION        UPDATED                         STATUS          CHART           APP VERSION     DESCRIPTION     
1               Tue Aug 30 14:19:03 2022        superseded      mysql-1.6.9     5.7.30          Install complete
2               Tue Aug 30 14:31:08 2022        deployed        mysql-1.6.9     5.7.30          Upgrade complete

# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm [14:33:14] 
$ helm rollback mysql-1661840339 1
Rollback was a success! Happy Helming!

# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm [14:34:25] C:1
$ kubectl get pods -l release=mysql-1661840339
NAME                               READY   STATUS    RESTARTS   AGE
mysql-1661840339-655bdc759-4d94f   1/1     Running   0          16m

# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm [14:35:24] 
$ helm get values mysql-1661840339
USER-SUPPLIED VALUES:
mysqlDatabase: user0db
mysqlPassword: user0pwd
mysqlUser: user0
persistence:
  enabled: false
```

可以看到 values 配置已经回滚到之前的版本了。上面的命令回滚到了 release 的第一个版本，每次进行安装、升级或回滚时，修订号都会加 1，第一个修订号始终为1，我们可以使用 `helm history [RELEASE]` 来查看某个版本的修订号。

除此之外我们还可以指定一些有用的选项来定制 install/upgrade/rollback 的一些行为，要查看完整的参数标志，我们可以运行 `helm <command> --help` 来查看，这里我们介绍几个有用的参数：

- `--timeout`: 等待 Kubernetes 命令完成的时间，默认是 300（5分钟）
- `--wait`: 等待直到所有 Pods 都处于就绪状态、PVCs 已经绑定、Deployments 具有处于就绪状态的最小 Pods 数量（期望值减去 maxUnavailable）以及 Service 有一个 IP 地址，然后才标记 release 为成功状态。它将等待与 `--timeout` 值一样长的时间，如果达到超时，则 release 将标记为失败。注意：在 Deployment 将副本设置为 1 并且作为滚动更新策略的一部分，maxUnavailable 未设置为0的情况下，`--wait` 将返回就绪状态，因为它已满足就绪状态下的最小 Pod 数量
- `--no-hooks`: 将会跳过命令的运行 hooks
- `--recreate-pods`: 仅适用于 upgrade 和 rollback，这个标志将导致重新创建所有的 Pods。（Helm3 中启用了）

## 参考

* https://helm.sh/zh/docs/
* https://helm.sh/zh/docs/intro/using_helm/
* https://www.qikqiak.com/k8strain/helm/