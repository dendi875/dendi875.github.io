---
title: Istio ServiceEntry（服务入口）
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-10-24 16:15:33
password:
summary: Istio ServiceEntry（服务入口）
tags:
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

# Istio ServiceEntry（服务入口）

## 什么是服务入口？

在 istio 中提供了 ServiceEntry 的配置，将网格外的服务加入网格中，像网格内的服务一样进行管理。在实现上就是把外部服务加入 istio 的服务发现，这些外部服务因为各种原因不能直接注册到网格中。

服务入口和网关有一点相反的概念，网关可以认为是把我们内部服务暴露给外部访问，而 ServiceEnry 正好相反，是把外部的服务纳入到我们网格内部进行管理。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221024143913.png)

如上图所示，服务入口相当于抽象了一个外部服务，然后内部服务就像访问网格内部的服务一样去访问外部服务，你如果需要对流量或路由进行控制，也是需要定义一个虚拟服务来协助它。

## 服务入口有什么用？

服务入口主要的一个功能就是我们希望能够管理外部服务的请求，比如说你需要对访问外部服务的请求做一些流量控制，那么就需要用到服务入口，还有一个功能它能帮助扩展我们的网格（Mesh），例如当我们要给多个集群共享同一个 Mesh 的时候，就需要使用服务入口 。

* 添加外部服务到网格内
* 管理到外部服务的请求
* 扩展网格

## ServiceEntry 配置示例

### 任务说明

将 httpbin 注册为网格内部的服务，并配置流控策略

### 任务目标

* 学会通过 ServiceEntry 扩展网格
* 掌握 ServiceEntry 的配置方法

### 演示

因为我们之前部署的 Bookinfo 应用它所有的服务里面没有 `curl`这个命令，因此我们想要模拟内部服务去请求外部服务需要再添加另一个服务，官方也为我们提供了一个叫 `sleep`这样的服务，查看 `samples/sleep/sleep.yaml` 文件内容：

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: sleep
---
apiVersion: v1
kind: Service
metadata:
  name: sleep
  labels:
    app: sleep
spec:
  ports:
  - port: 80
    name: http
  selector:
    app: sleep
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sleep
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sleep
  template:
    metadata:
      labels:
        app: sleep
    spec:
      serviceAccountName: sleep
      containers:
      - name: sleep
        image: governmentpaas/curl-ssl
        command: ["/bin/sleep", "3650d"]
        imagePullPolicy: IfNotPresent
        volumeMounts:
        - mountPath: /etc/sleep/tls
          name: secret-volume
      volumes:
      - name: secret-volume
        secret:
          secretName: sleep-secret
          optional: true
---
```

这其实就是一个简单的应用，通过 Deployment 进行控制，通过 Service 暴露服务，现在我们来部署该应用：

```shell
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [15:13:04] 
$ kubectl apply -f samples/sleep/sleep.yaml 
serviceaccount/sleep created
service/sleep created
deployment.apps/sleep created
```

为了模拟外部服务，我们使用 [httpbin](https://httpbin.org/) 这个网站。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221024152025.png)

如上图，它是一个非常精简的用来测试 HTTP 请求的一个网站，它提供了很多方法，比如说我们要用 headers 这个 get 方法来测试我们的外部服务请求，可以在浏览器中输入 headers ，它就会响应给你请求的 headers 信息：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221024152558.png)

查看下 Pod 的启动情况：

```shell
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [15:15:32] 
$ kubectl get pod
NAME                              READY   STATUS    RESTARTS   AGE
......
sleep-f8cbf5b76-kgfxk             2/2     Running   0          2m9s
......
```

我们先来访问一下 httpbin 这个外部的服务：

```yaml
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [15:30:02] C:1
$ kubectl exec sleep-f8cbf5b76-kgfxk -c sleep curl http://httpbin.org/headers   
kubectl exec [POD] [COMMAND] is DEPRECATED and will be removed in a future version. Use kubectl kubectl exec [POD] -- [COMMAND] instead.
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  1062  100  1062    0     0   1661      0 --:--:-- --:--:-- --:--:--  1661
{
  "headers": {
    "Accept": "*/*", 
    "Content-Length": "0", 
    "Host": "httpbin.org", 
    "User-Agent": "curl/7.83.1", 
    "X-Amzn-Trace-Id": "Root=1-63563f00-7e9a66b6539a4d801ed0fe31", 
    "X-B3-Sampled": "1", 
    "X-B3-Spanid": "20d182b550bf7ede", 
    "X-B3-Traceid": "7919c11829074d3120d182b550bf7ede", 
    "X-Envoy-Peer-Metadata": "Ch0KDElOU1RBTkNFX0lQUxINGgsxNzIuMTcuMC4xNgrDAQoGTEFCRUxTErgBKrUBCg4KA2FwcBIHGgVzbGVlcAogChFwb2QtdGVtcGxhdGUtaGFzaBILGglmOGNiZjViNzYKJAoZc2VjdXJpdHkuaXN0aW8uaW8vdGxzTW9kZRIHGgVpc3RpbwoqCh9zZXJ2aWNlLmlzdGlvLmlvL2Nhbm9uaWNhbC1uYW1lEgcaBXNsZWVwCi8KI3NlcnZpY2UuaXN0aW8uaW8vY2Fub25pY2FsLXJldmlzaW9uEggaBmxhdGVzdAoaCgdNRVNIX0lEEg8aDWNsdXN0ZXIubG9jYWwKHwoETkFNRRIXGhVzbGVlcC1mOGNiZjViNzYta2dmeGsKFgoJTkFNRVNQQUNFEgkaB2RlZmF1bHQKSQoFT1dORVISQBo+a3ViZXJuZXRlczovL2FwaXMvYXBwcy92MS9uYW1lc3BhY2VzL2RlZmF1bHQvZGVwbG95bWVudHMvc2xlZXAKGgoPU0VSVklDRV9BQ0NPVU5UEgcaBXNsZWVwChgKDVdPUktMT0FEX05BTUUSBxoFc2xlZXA=", 
    "X-Envoy-Peer-Metadata-Id": "sidecar~172.17.0.16~sleep-f8cbf5b76-kgfxk.default~default.svc.cluster.local"
  }
}
```

通过上面的访问可以看到，我们可以直接从 sleep 服务内部来访问到外部的 httpbin 服务，原因是因为在 Istio 里面默认所有的网格内的服务是允许直接地访问外部服务的。所以为了测试服务入口这个功能，我们需要先把允许访问外部服务的方式给它关闭掉，关闭成只有注册过的服务才能访问外部服务。

这里为了测试 ServiceEntry 功能，我们将其更改为 `REGISTRY_ONLY` 模式：

```shell
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [15:36:15] 
$ kubectl get configmap istio -n istio-system -o yaml | sed 's/mode: ALLOW_ANY/mode: REGISTRY_ONLY/g' | kubectl replace -n istio-system -f -
configmap/istio replaced
```

当配置生效后，我们再次通过 sleep 服务来 curl 一下 httpbin 这个外部服务：

```shell
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [15:37:11] 
$ kubectl exec sleep-f8cbf5b76-kgfxk -c sleep curl http://httpbin.org/headers                                                                
```

可以看到没有任何输出，说明外部服务已经被我们屏蔽掉了。

现在我们定义一个 ServiceEntry，让 sleep 服务可以通过服务入口来访问外部服务。

```shell
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: httpbin-ext #服务入口名称
spec:
  hosts:
  - httpbin.org
  ports:
  - number: 80
    name: http
    protocol: HTTP
  resolution: DNS
  location: MESH_EXTERNAL
EOF
```

查看我们定义的服务入口：

```shell
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [15:45:16] 
$ kubectl get se
NAME          HOSTS           LOCATION        RESOLUTION   AGE
httpbin-ext   [httpbin.org]   MESH_EXTERNAL   DNS          40s
```

服务入口定义好之后，我们再次尝试从 sleep 服务内部去访问外部服务：

```shell
# zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [15:48:04] 
$ kubectl exec -it  sleep-f8cbf5b76-kgfxk -c sleep -- curl http://httpbin.org/headers     
{
  "headers": {
    "Accept": "*/*", 
    "Content-Length": "0", 
    "Host": "httpbin.org", 
    "User-Agent": "curl/7.83.1", 
    "X-Amzn-Trace-Id": "Root=1-63564341-39a74de31de2c0321aada0d4", 
    "X-B3-Sampled": "1", 
    "X-B3-Spanid": "cb05732aeacfd04b", 
    "X-B3-Traceid": "fae9d1262b8a55becb05732aeacfd04b", 
    "X-Envoy-Decorator-Operation": "httpbin.org:80/*", 
    "X-Envoy-Peer-Metadata": "Ch0KDElOU1RBTkNFX0lQUxINGgsxNzIuMTcuMC4xNgrDAQoGTEFCRUxTErgBKrUBCg4KA2FwcBIHGgVzbGVlcAogChFwb2QtdGVtcGxhdGUtaGFzaBILGglmOGNiZjViNzYKJAoZc2VjdXJpdHkuaXN0aW8uaW8vdGxzTW9kZRIHGgVpc3RpbwoqCh9zZXJ2aWNlLmlzdGlvLmlvL2Nhbm9uaWNhbC1uYW1lEgcaBXNsZWVwCi8KI3NlcnZpY2UuaXN0aW8uaW8vY2Fub25pY2FsLXJldmlzaW9uEggaBmxhdGVzdAoaCgdNRVNIX0lEEg8aDWNsdXN0ZXIubG9jYWwKHwoETkFNRRIXGhVzbGVlcC1mOGNiZjViNzYta2dmeGsKFgoJTkFNRVNQQUNFEgkaB2RlZmF1bHQKSQoFT1dORVISQBo+a3ViZXJuZXRlczovL2FwaXMvYXBwcy92MS9uYW1lc3BhY2VzL2RlZmF1bHQvZGVwbG95bWVudHMvc2xlZXAKGgoPU0VSVklDRV9BQ0NPVU5UEgcaBXNsZWVwChgKDVdPUktMT0FEX05BTUUSBxoFc2xlZXA=", 
    "X-Envoy-Peer-Metadata-Id": "sidecar~172.17.0.16~sleep-f8cbf5b76-kgfxk.default~default.svc.cluster.local"
  }
}
```

可以看到现有有了 headers 的具体输出。

## 服务入口的配置选项

参考官方文档的 [ServiceEntry配置 ](https://istio.io/latest/docs/reference/config/networking/service-entry/)说明

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221024155109.png)

Service 主要包含如下几个字段。

（1）hosts：是一个必选字段，表示与 ServiceEntry 相关的主机名，可以是一个 DNS 域名，还可以使用前缀模糊匹配。在使用上有以下几个说明：

- HTTP 的流量，在这个字段匹配 HTTP Header 的 Host 或 Authority。
- HTTPS 或 TLS 流量，这个字段匹配 SNI。
- 其他协议的流量，这个字段不生效，使用下面的 addresses 和 port 字段。
- 当 resolution 被设置为 DNS 类型并且没有指定 endpoints 时，这个字段将作为后端的域名来进行路由。

（2）addresses：表示与服务关联的虚拟 IP 地址，可以是 CIDR 这种前缀表达式 。对于 HTTP 的流量，该字段被忽略，而是使用 Header 中的 Host 或 Authority。如果 addresses 为空，则只能根据目标端口来识别，在这种情况下这个端口不能被网格里的其他服务使用。即 Sidecar 只是作为一个 TCP 代理，把某个特定端口的流量转发到配置的目标后端。

（3）ports：表示外部服务关联的端口，是一个必选字段。

（4）location：用于设置服务是在网格内部还是在网格内部。可以取一下两种模式：

- **MESH_EXTERNAL**：表示在网格外部，通过 API 访问的外部服务。实例中的 "httpbin.org" 是一个外部服务。
- **MESH_INTERNAL**：表示在网格内部，一些不能直接注册到网格服务注册中心的服务，例如一些虚拟机上的服务不能通过 Kubernetes 机制自动在 istio 中进行服务注册，通过这种方式可以扩展网格管理的服务。

location 字段会影响 mTLS 双向认证、策略执行等特性。当和网络外部服务通信时，mTLS 双向认证将被禁用，并且策略只能在客户端执行，不能再服务端执行。因为对于外部服务，远端不可能注入一个 Sidecar 来进行双向认证等操作。

（5）resolution：是一个内容较多的字段，表示服务发现的模式，用来设置代码解析服务的方式，将一个服务名解析到一个后端 IP 地址上，可以设置 NONE、STATIC、DNS 三种模式。另外，这里配置的解析模式不影响应用的服务名解析，应用仍然使用 DNS 将服务解析到 IP 上，这样 Outbound 流量会被 Envoy 拦截。

- **NONE**：用于当连接的目标地址以及是一个明确 IP 的场景。当访问外部服务且应用要被解析到一个特点的 IP 上时，要将模式设为 NONE。
- **STATIC**：用在以及用 endpoints 设置了服务实例的地址场景中，即不用解析。
- **DNS**：表示用查询环境中的 DNS 进行解析。如果没有设置 endpoints，代理就会使用在 hosts 中指定的 DNS 地址进行解析，前提是在 hosts 中未使用通配符；如果设置了 endpoints，则使用 endpoints 中的 DNS 地址解析出目标 IP。

（6）subjectAltNames：表示这个服务负载的 SAN 列表。在 istio 安全相关配置的多个地方被用到，被设置时，代理将严重服务证书的 SAN 是否配置。

（7）endpoints：表示与网络服务相关的网络地址，可以是一个 IP，也可以是一个主机名。这个字段是一个 Endpoint 的复杂结构。

- **address**：必选字段，表示网络后端的地址。在前面 ServiceEntry 的解析方式中 resolution 被设置为 DNS 时，address 可以使用域名，但是要求是明确的地址，不可以使用模糊匹配。
- **ports**：端口列表。
- **labels**：后端的标签。
- **network**：这个高级配置主要用在 istio 多集群中。所有属于相同 network 的后端都可以直接互访，不在同一个 network 的后端不能直接访问。在使用 istio Gateway 时可以对不同 network 的后端建立连接。
- **locality**：后端的 locality，主要用于亲和性路由。即 Envoy 可以基于这个标识做本地化路由，优先路由到本地的后端上。locality 表示一个故障域，常见的如国家、地区、区域、也可以分隔每个故障域来表示任意层次的结构。
- **weight**：表示负载均衡的权重，权重越高，接收的流量占比越大。

此外，istio 1.1 在 ServiceEntry 上添加了一个重要字段 exportTo，用于控制 ServiceEntry 跨命名空间的可见性，这样就可以控制在一个命名空间下定义的资源对象是否可以被其他命名空间下的 Sidecar、Gateway 和 VirtualService 使用。如果未赋值，则默认全局可见。"." 表示仅应用到当前命名空间，"*" 表示应用到所有命名空间。
## 参考

* https://istio.io/latest/docs/concepts/traffic-management/#service-entries
* https://istio.io/latest/docs/reference/config/networking/service-entry/