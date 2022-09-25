---
title: Istio的安装和部署
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-09-25 21:23:18
password:
summary: Istio的安装和部署
tags:
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

# Istio的安装和部署

## 环境

* macOS Catalina 版本 10.15.6

* minikube version: v1.12.0
* kubernetes-version: v1.16.0
* istioctl version: 1.5.1

## 安装

 安装官方文档说明 https://istio.io/latest/docs/setup/platform-setup/minikube/ 进行安装，但要注意 istio 与 k8s 版本之间的兼容性，兼容性参考：https://istio.io/latest/docs/releases/supported-releases/

* 执行以下命令，启动一个单节点的 k8s 集群

```shell
# zhangquan @ MacBook-Pro in ~/Downloads/devops [23:42:20] 
$ minikube start --memory=16384 --cpus=4 --image-mirror-country='cn' --image-repository='registry.cn-hangzhou.aliyuncs.com/google_containers' --kubernetes-version=v1.16.0
```

* 在 [GitHub Release 页面 ](https://github.com/istio/istio/releases)获取对应系统版本下载地址

```shell
# zhangquan @ MacBook-Pro in ~/Downloads/devops [16:35:30] 
$ wget https://storage.googleapis.com/istio-release/releases/1.5.1/istio-1.5.1-osx.tar.gz 

# zhangquan @ MacBook-Pro in ~/Downloads/devops [16:51:41] 
$ tar -zxvf istio-1.5.1-osx.tar.gz

# 把 istioctl 命令添加到环境变量中
export ISTIO_HOME=/Users/zhangquan/Downloads/devops/istio-1.5.1/bin
export PATH=$PATH:$ISTIO_HOME

# zhangquan @ MacBook-Pro in ~/Downloads/devops [16:52:54] 
$ ll istio-1.5.1
total 48
-rw-r--r--   1 zhangquan  staff    11K  3 24  2020 LICENSE
-rw-r--r--   1 zhangquan  staff   5.7K  3 24  2020 README.md
drwxr-x---   3 zhangquan  staff    96B  3 24  2020 bin
drwxr-xr-x   7 zhangquan  staff   224B  3 24  2020 install
-rw-r-----   1 zhangquan  staff   595B  3 24  2020 manifest.yaml
drwxr-xr-x  20 zhangquan  staff   640B  3 24  2020 samples
drwxr-x---   6 zhangquan  staff   192B  3 24  2020 tools
```

可以看到 istio 中包含以下几部分内容

* bin: 有我们要使用的 `istioctl ` 命令行工具
* install: 包含了几个平台的安装清单
* samples: 官方提供一些示例程序

istio 提供了一些配置档案，也就是`Profile`，它的目的就是让你在不同应用场景去安装不同的版本

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220912170726.png)

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220912170843.png)安装 istio 的工具和文件准备好过后，直接执行如下所示的安装命令即可：

```shell
# zhangquan @ MacBook-Pro in ~/Downloads/devops/istio-1.5.1 [17:10:27] 
$ istioctl manifest apply --set profile=demo
Detected that your cluster does not support third party JWT authentication. Falling back to less secure first party JWT. See https://istio.io/docs/ops/best-practices/security/#configure-third-party-service-account-tokens for details.
- Applying manifest for component Base...
✔ Finished applying manifest for component Base.
- Applying manifest for component Pilot...
✔ Finished applying manifest for component Pilot.
  Waiting for resources to become ready...
	......
  Waiting for resources to become ready...
- Applying manifest for component EgressGateways...
- Applying manifest for component IngressGateways...
- Applying manifest for component AddonComponents...
✔ Finished applying manifest for component EgressGateways.
✔ Finished applying manifest for component IngressGateways.
✔ Finished applying manifest for component AddonComponents.


✔ Installation complete
```

安装完成后我们可以查看 istio-system 命名空间下面的 Pod 运行状态：

```shell
$  kubectl get pods -n istio-system
NAME                                    READY   STATUS    RESTARTS   AGE
grafana-5cc7f86765-89z9l                1/1     Running   0          5m18s
istio-egressgateway-598d7ffc49-x4rtw    1/1     Running   0          5m19s
istio-ingressgateway-7bd5586b79-z78rw   1/1     Running   0          5m19s
istio-tracing-8584b4d7f9-26czf          1/1     Running   0          5m18s
istiod-646b6fcc6-rjlcm                  1/1     Running   0          6m53s
kiali-696bb665-cr8f9                    1/1     Running   0          5m18s
prometheus-6c88c4cb8-2dt5k              2/2     Running   0          5m18s
```

如果都是 Running 状态证明 istio 就已经安装成功了。

安装完成后还可以检测一下`istio`的`CRD`和`API资源`:

```shell
$ kubectl get crd | grep istio
adapters.config.istio.io                   2022-09-09T21:58:30Z
attributemanifests.config.istio.io         2022-09-09T21:58:30Z
authorizationpolicies.security.istio.io    2022-09-09T21:58:30Z
clusterrbacconfigs.rbac.istio.io           2022-09-09T21:58:30Z
destinationrules.networking.istio.io       2022-09-09T21:58:30Z
envoyfilters.networking.istio.io           2022-09-09T21:58:30Z
gateways.networking.istio.io               2022-09-09T21:58:30Z
handlers.config.istio.io                   2022-09-09T21:58:30Z
httpapispecbindings.config.istio.io        2022-09-09T21:58:30Z
httpapispecs.config.istio.io               2022-09-09T21:58:30Z
instances.config.istio.io                  2022-09-09T21:58:30Z
meshpolicies.authentication.istio.io       2022-09-09T21:58:30Z
peerauthentications.security.istio.io      2022-09-09T21:58:30Z
policies.authentication.istio.io           2022-09-09T21:58:30Z
quotaspecbindings.config.istio.io          2022-09-09T21:58:30Z
quotaspecs.config.istio.io                 2022-09-09T21:58:30Z
rbacconfigs.rbac.istio.io                  2022-09-09T21:58:30Z
requestauthentications.security.istio.io   2022-09-09T21:58:30Z
rules.config.istio.io                      2022-09-09T21:58:30Z
serviceentries.networking.istio.io         2022-09-09T21:58:30Z
servicerolebindings.rbac.istio.io          2022-09-09T21:58:30Z
serviceroles.rbac.istio.io                 2022-09-09T21:58:30Z
sidecars.networking.istio.io               2022-09-09T21:58:30Z
templates.config.istio.io                  2022-09-09T21:58:30Z
virtualservices.networking.istio.io        2022-09-09T21:58:30Z
```

查看一下 `API资源`：

```shell
$ kubectl api-resources | grep istio 
meshpolicies                                   authentication.istio.io        false        MeshPolicy
policies                                       authentication.istio.io        true         Policy
adapters                                       config.istio.io                true         adapter
attributemanifests                             config.istio.io                true         attributemanifest
handlers                                       config.istio.io                true         handler
httpapispecbindings                            config.istio.io                true         HTTPAPISpecBinding
httpapispecs                                   config.istio.io                true         HTTPAPISpec
instances                                      config.istio.io                true         instance
quotaspecbindings                              config.istio.io                true         QuotaSpecBinding
quotaspecs                                     config.istio.io                true         QuotaSpec
rules                                          config.istio.io                true         rule
templates                                      config.istio.io                true         template
destinationrules                  dr           networking.istio.io            true         DestinationRule
envoyfilters                                   networking.istio.io            true         EnvoyFilter
gateways                          gw           networking.istio.io            true         Gateway
serviceentries                    se           networking.istio.io            true         ServiceEntry
sidecars                                       networking.istio.io            true         Sidecar
virtualservices                   vs           networking.istio.io            true         VirtualService
clusterrbacconfigs                             rbac.istio.io                  false        ClusterRbacConfig
rbacconfigs                                    rbac.istio.io                  true         RbacConfig
servicerolebindings                            rbac.istio.io                  true         ServiceRoleBinding
serviceroles                                   rbac.istio.io                  true         ServiceRole
authorizationpolicies                          security.istio.io              true         AuthorizationPolicy
peerauthentications                            security.istio.io              true         PeerAuthentication
requestauthentications                         security.istio.io              true         RequestAuthentication
```

## 验证安装

istio 官方提供了一些 Dashboard，可以以可视化的方式直接去查看你的系统运行情况。

我们直接启动 `Kiali`这个 Dashboard：

```shell
# zhangquan @ MacBook-Pro in ~/Downloads/devops/istio-1.5.1 [17:24:02] 
$ istioctl dashboard kiali
```

运行以上命令它会帮我们打开浏览器，使用 admin/admin登录：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220914185033.png)

如下图所示，可以看到 istio 相关组件都已安装成功，并且成功启动：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220914185942.png)



## 示例安装

然后我们可以来安装官方提供的一个非常经典的 [Bookinfo 应用示例](https://github.com/istio/istio/tree/master/samples/bookinfo/)，这个示例部署了一个用于演示多种 Istio 特性的应用，该应用由四个单独的微服务构成。 这个应用模仿在线书店的一个分类，显示一本书的信息。页面上会显示一本书的描述，书籍的细节（ISBN、页数等），以及关于这本书的一些评论。

Bookinfo 应用分为四个单独的微服务：

- productpage：这个微服务会调用 details 和 reviews 两个微服务，用来生成页面。
- details：这个微服务中包含了书籍的信息。
- reviews：这个微服务中包含了书籍相关的评论，它还会调用 ratings 微服务。
- ratings：这个微服务中包含了由书籍评价组成的评级信息。

reviews 微服务有 3 个版本：

- v1 版本不会调用 ratings 服务。
- v2 版本会调用 ratings 服务，并使用 1 到 5 个黑色星形图标来显示评分信息。
- v3 版本会调用 ratings 服务，并使用 1 到 5 个红色星形图标来显示评分信息。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220914193030.png)

上图展示了使用 istio 后，整个应用实际的结构。所有的微服务都和一个 `Envoy sidecar` 封装到一起，sidecar 拦截所有到达和离开服务的请求。

### 注入 Sidecar

在部署 Bookinfo 之前我们需要注入 Sidecar，有两种注入方式

* 自动注入

  ```shell
  # zhangquan @ MacBook-Pro in ~/Downloads/devops/istio-1.5.1 [19:43:36]
  $ kubectl label namespace default istio-injection=enabled
  namespace/default labeled
  ```

  给 default 这个命令空间（booknifo应用所在空间）添加一个 label，名称为：istio-injection，值为：enabled。

* 手动注入

  ```shell
  kubectl apply -f <(istioctl kube-inject -f samples/bookinfo/platform/kube/bookinfo.yaml)
  ```

### 部署应用

```shell
# zhangquan @ MacBook-Pro in ~/Downloads/devops/istio-1.5.1 [19:43:39] 
$ kubectl apply -f samples/bookinfo/platform/kube/bookinfo.yaml 
service/details created
serviceaccount/bookinfo-details created
deployment.apps/details-v1 created
service/ratings created
serviceaccount/bookinfo-ratings created
deployment.apps/ratings-v1 created
service/reviews created
serviceaccount/bookinfo-reviews created
deployment.apps/reviews-v1 created
deployment.apps/reviews-v2 created
deployment.apps/reviews-v3 created
service/productpage created
serviceaccount/bookinfo-productpage created
deployment.apps/productpage-v1 created
```

这里我们部署的 `bookinfo.yaml` 资源清单文件就是普通的 Kubernetes 的 Deployment 和 Service 的 yaml 文件，而 `istioctl kube-inject` 会在这个文件的基础上向其中的 Deployment 追加一个镜像为 `docker.io/istio/proxyv2:1.5.1` 的 sidecar 容器。

过一会儿就可以看到如下 service 和 pod 启动:

```shell
# zhangquan @ MacBook-Pro in ~/Downloads/devops/istio-1.5.1 [19:46:55] 
$ kubectl get po 
NAME                              READY   STATUS    RESTARTS   AGE
details-v1-78d78fbddf-5srj5       2/2     Running   0          3m3s
productpage-v1-85b9bf9cd7-sbwd8   2/2     Running   0          3m1s
ratings-v1-6c9dbf6b45-9fpck       2/2     Running   0          3m2s
reviews-v1-564b97f875-f8zkw       2/2     Running   0          3m1s
reviews-v2-568c7c9d8f-r5c76       2/2     Running   0          3m2s
reviews-v3-67b4988599-qlv5j       2/2     Running   0          3m2s

# zhangquan @ MacBook-Pro in ~/Downloads/devops/istio-1.5.1 [19:46:57] 
$ kubectl get svc
NAME          TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
details       ClusterIP   10.99.216.225    <none>        9080/TCP   3m6s
kubernetes    ClusterIP   10.96.0.1        <none>        443/TCP    4d20h
productpage   ClusterIP   10.100.219.221   <none>        9080/TCP   3m5s
ratings       ClusterIP   10.96.89.71      <none>        9080/TCP   3m6s
reviews       ClusterIP   10.110.207.93    <none>        9080/TCP   3m6s
```

可以看到每个 pod 中有两个 container，一个是应用本身的，另一个是我们自动注入的 Sidecar。

```shell
$ kubectl describe pod details-v1-78d78fbddf-5srj5        
Name:         details-v1-78d78fbddf-5srj5
Namespace:    default
Priority:     0
Node:         minikube/192.168.64.5
Start Time:   Wed, 14 Sep 2022 19:43:55 +0800
Labels:       app=details
              pod-template-hash=78d78fbddf
              security.istio.io/tlsMode=istio
              service.istio.io/canonical-name=details
              service.istio.io/canonical-revision=v1
              version=v1
Annotations:  sidecar.istio.io/status:
                {"version":"64f53c7f7e9dca50ddb9767390392872119f042c4a541dbbb6a973d5638bd264","initContainers":["istio-init"],"containers":["istio-proxy"]...
Status:       Running
......
Containers:
  details:
    Container ID:   docker://ff6f87fcad1aab7888a87bfb515806a48c78f744fa045b078529cc3090b43bea
    Image:          docker.io/istio/examples-bookinfo-details-v1:1.15.0
    Image ID:       docker-pullable://istio/examples-bookinfo-details-v1@sha256:fce0bcbff0bed09116dacffca15695cd345e0c3788c15b0114a05f654ddecc17
    Port:           9080/TCP
    Host Port:      0/TCP
    State:          Running
      Started:      Wed, 14 Sep 2022 19:46:16 +0800
    Ready:          True
    Restart Count:  0
    Environment:    <none>
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from bookinfo-details-token-qr8rw (ro)
  istio-proxy:
    Container ID:  docker://ed3a32d4ba85b35406a2e62287e72cffcda417f9003b69bbc3e1984d35e79a1d
    Image:         docker.io/istio/proxyv2:1.5.1
    Image ID:      docker-pullable://istio/proxyv2@sha256:3ad9ee2b43b299e5e6d97aaea5ed47dbf3da9293733607d9b52f358313e852ae
    Port:          15090/TCP
    Host Port:     0/TCP
......
```

### 创建 Ingress 网关

现在应用的服务都部署成功并启动了，如果我们需要在集群外部访问，就需要添加一个 istio gateway。gateway 相当于 k8s 的 ingress controller 和 ingress。它为 HTTP/TCP 流量配置负载均衡，通常在服务网格边缘作为应用的 ingress 流量管理。

创建一个 gateway:

```shell
# zhangquan @ MacBook-Pro in ~/Downloads/devops/istio-1.5.1 [19:56:37] 
$ kubectl apply -f samples/bookinfo/networking/bookinfo-gateway.yaml
gateway.networking.istio.io/bookinfo-gateway created
virtualservice.networking.istio.io/bookinfo created
```

验证 gateway 是否启动成功:

```shell
$ kubectl get gateway
NAME               AGE
bookinfo-gateway   40s
```

要想取访问这个应用，这里我们需要更改下 istio 提供的 istio-ingressgateway 这个 Service 对象，默认是 LoadBalancer 类型的服务：

```shell
$ kubectl get svc -n istio-system
NAME                        TYPE           CLUSTER-IP       EXTERNAL-IP   PORT(S)                                                                                                                                      AGE
......
istio-ingressgateway        LoadBalancer   10.102.174.244   <pending>     15020:30839/TCP,80:30693/TCP,443:32317/TCP,15029:30570/TCP,15030:31955/TCP,15031:31823/TCP,15032:31296/TCP,31400:32294/TCP,15443:32067/TCP   4d14h
......
```

LoadBalancer 类型的服务，实际上是用来对接云服务厂商的，如果我们没有对接云服务厂商的话，可以将这里类型改成 `NodePort`，但是这样当访问我们的服务的时候就需要加上 nodePort 端口了：

```shell
kubectl edit svc istio-ingressgateway -n istio-system
```

```shell
# zhangquan @ MacBook-Pro in ~/Downloads/devops/istio-1.5.1 [20:07:44] 
$ kubectl get svc -n istio-system
NAME                        TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)                                                                                                                                      AGE
......
istio-ingressgateway        NodePort    10.102.174.244   <none>        15020:30839/TCP,80:30693/TCP,443:32317/TCP,15029:30570/TCP,15030:31955/TCP,15031:31823/TCP,15032:31296/TCP,31400:32294/TCP,15443:32067/TCP   4d14h 
......
```

这样我们就可以通过 `http://<NodeIP>:<nodePort>/productpage` 访问应用了：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220914201313.png)

刷新页面可以看到 Book Reviews 发生了改变，因为每次请求会被路由到到了不同的 Reviews 服务版本去：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20220914201535.png)

至此，整个 istio 就安装并验证成功了。

## 参考

* https://istio.io/latest/docs/setup/platform-setup/minikube/ 
* https://istio.io/latest/docs/releases/supported-releases/
* https://github.com/istio/istio/tree/master/samples/bookinfo/
* https://istio.io/latest/docs/examples/bookinfo/
* https://istio.io/latest/docs/setup/additional-setup/sidecar-injection/#automatic-sidecar-injection