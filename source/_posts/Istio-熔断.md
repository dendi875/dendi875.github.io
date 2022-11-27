---
title: Istio 熔断
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-11-27 18:55:57
password:
tags: Istio 中的熔断功能
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

## 熔断：失败也是一种选择

在微服务架构中，服务用不同的语言编写，部署在多个节点或集群上，并且具有不同的响应时间或故障率。 通常，如果服务成功（并且及时）响应请求，则它的性能令人满意。 然而，情况往往并非如此，需要保护下游客户端免受上游服务过度缓慢的影响。 反过来，上游服务必须受到保护，以免因请求积压而过载。 对于多个客户端，这会变得更加复杂，并且可能导致整个基础架构出现一系列级联故障。 这个问题的解决方案是久经考验的断路器模式。



![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/isitio-circuit-breaking-1.png)

断路器可以有三种状态：关闭、打开和半打开，默认情况下处于关闭状态。在关闭状态下，你请求服务一般情况下会返回成功或失败(低于阈值失败)。而当你的失败次数逐渐增多的时候，当次数达到阈值时（它有一个失败记数器来记录具体的失败次数），断路器打开。当调用处于打开状态的服务时，断路器会触发请求，这意味着它会返回错误（即快速失败）而不会把请求发送到被调用的服务方。这样，通过在客户端触发下游请求，可以防止生产系统中的级联故障。在这个状态时它会设置一个超时的时钟（Timeout），这个超时时钟主要目的就是设置一个时钟周期，超时这个周期的时候就会把状态切换为半打开状态，尝试的会去再调用一下服务，如果这时发现服务可以正常调用了，那么就直接返回成功，同时断路器将关闭允许服务再次处理请求。如果这个时候服务还有故障，那么就重新再返回到打开状态，请求继续快速失败。



总结：什么是熔断（Circuit Breaking）？

* 一种过载保护的手段
* 目的：避免服务的级联失败
* 关键点：三个状态、失败计数器（阈值）、超时时钟

## Istio 中的熔断

Istio 中的 [熔断 ](https://istio.io/latest/docs/tasks/traffic-management/circuit-breaking/)可以在 `Destination Rule` Istio [自定义资源 ](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)中的  [TrafficPolicy](https://istio.io/docs/reference/config/networking/v1alpha3/destination-rule/#TrafficPolicy) 字段中进行配置。 `TrafficPolicy `下有两个与熔路相关的字段：[ConnectionPoolSettings](https://istio.io/docs/reference/config/networking/v1alpha3/destination-rule/#ConnectionPoolSettings)and [OutlierDetection](https://istio.io/docs/reference/config/networking/v1alpha3/destination-rule/#OutlierDetection)。

在 `ConnectionPoolSettings` 中，可以为服务配置连接量。 `OutlierDetection` 用于控制从负载平衡池中驱逐不健康的服务。

例如：`ConnectionPoolSettings` 控制请求、挂起请求、重试或超时的最大数量，而 `OutlierDetection` 控制服务从连接池中弹出之前的错误数，并且可以设置最小弹出持续时间和最大弹出百分比。 有关字段的完整列表，请查看[文档](https://istio.io/latest/docs/reference/config/networking/destination-rule/#TrafficPolicy)。 

### 演示

同样在 Istio 中也是原生就支持熔断功能的，下面我们来演示一下。

#### 开始之前

- 跟随[安装指南](https://istio.io/latest/zh/docs/setup/)安装 Istio。

- 启动 [Httpbin](https://github.com/istio/istio/tree/release-1.16/samples/httpbin) 样例程序。

  如果您启用了 [Sidecar 自动注入](https://istio.io/latest/zh/docs/setup/additional-setup/sidecar-injection/#automatic-sidecar-injection)，通过以下命令部署 `httpbin` 服务：

  ```shell
  $ kubectl apply -f samples/httpbin/httpbin.yaml
  ```

  否则，您必须在部署 `httpbin` 应用程序前进行手动注入，部署命令如下：

  ```shell
  $ kubectl apply -f <(istioctl kube-inject -f samples/httpbin/httpbin.yaml)
  ```

应用程序 `httpbin` 作为此任务的后端服务。

#### 配置熔断器

1. 创建一个[目标规则](https://istio.io/latest/zh/docs/reference/config/networking/destination-rule/)，在调用 `httpbin` 服务时应用熔断设置：

   ```shell
   kubectl apply -f - <<EOF
   apiVersion: networking.istio.io/v1alpha3
   kind: DestinationRule
   metadata:
     name: httpbin
   spec:
     host: httpbin
     trafficPolicy:
       connectionPool: # 连接池
         tcp:
           maxConnections: 1 # 最大连接数
         http:
           http1MaxPendingRequests: 1  # 最大被阻挡的请求数
           maxRequestsPerConnection: 1 # 每个连接的最大请求数，每个连接同时只能有一个请求
       outlierDetection: # 失败探测配置
         consecutive5xxErrors: 1  # 失败次数，即断路器里的失败计数器，该配置表达只要有一次失败就触发熔断
         interval: 1s # 熔断的时间间隔
         baseEjectionTime: 3m # 最小驱逐时间, 驱逐时间会根据它乘上一个被驱逐的次数（熔断被触发次数），通过该方式实现一个指数级的退避策略
         maxEjectionPercent: 100 # 最大可被驱逐的比例， 也就是多少个服务实例可以被熔断驱逐出去
   EOF
   ```

2. 验证目标规则是否已创建：

   ```shell
   # zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [18:36:52] 
   $  kubectl describe dr httpbin
   Name:         httpbin
   Namespace:    default
   Labels:       <none>
   Annotations:  API Version:  networking.istio.io/v1beta1
   Kind:         DestinationRule
   Metadata:
     Creation Timestamp:  2022-11-27T10:36:46Z
     Generation:          1
     Resource Version:    3505
     Self Link:           /apis/networking.istio.io/v1beta1/namespaces/default/destinationrules/httpbin
     UID:                 50d4f157-0085-423a-85f9-68cf85f33f7d
   Spec:
     Host:  httpbin
     Traffic Policy:
       Connection Pool:
         Http:
           http1MaxPendingRequests:      1
           Max Requests Per Connection:  1
         Tcp:
           Max Connections:  1
       Outlier Detection:
         Base Ejection Time:    3m
         consecutive5xxErrors:  1
         Interval:              1s
         Max Ejection Percent:  100
   Events:                      <none>
   ```

#### 增加一个客户端

创建客户端程序以发送流量到 `httpbin` 服务。这是一个名为 [Fortio](https://github.com/istio/fortio) 的负载测试客户端，它可以控制连接数、并发数及发送 HTTP 请求的延迟。通过 Fortio 能够有效的触发前面在 `DestinationRule` 中设置的熔断策略。

1. 向客户端注入 Istio Sidecar 代理，以便 Istio 对其网络交互进行管理：

   如果你启用了[自动注入 Sidecar](https://istio.io/latest/zh/docs/setup/additional-setup/sidecar-injection/#automatic-sidecar-injection)，可以直接部署 `fortio` 应用：

   ```shell
   $ kubectl apply -f samples/httpbin/sample-client/fortio-deploy.yaml
   ```

   否则，你需要在部署 `fortio` 应用前手动注入 Sidecar：

   ```shell
   $ kubectl apply -f <(istioctl kube-inject -f samples/httpbin/sample-client/fortio-deploy.yaml)
   ```

   验证部署成功：

   ```shell
   $ kubectl get pods -l app=fortio 
   NAME                             READY   STATUS    RESTARTS   AGE
   fortio-deploy-7cb865f87f-lk6jx   2/2     Running   0          71s
   ```

2. 登入客户端 Pod 并使用 Fortio 工具调用 `httpbin` 服务。`-curl` 参数表明发送一次调用：

   ```shell
   $ FORTIO_POD=$(kubectl get pod | grep fortio | awk '{ print $1 }')
   
   $ kubectl exec -it $FORTIO_POD  -c fortio -- /usr/bin/fortio load -curl  http://httpbin:8000/get
   HTTP/1.1 200 OK
   server: envoy
   date: Sun, 27 Nov 2022 10:15:51 GMT
   content-type: application/json
   content-length: 587
   access-control-allow-origin: *
   access-control-allow-credentials: true
   x-envoy-upstream-service-time: 7
   
   {
     "args": {}, 
     "headers": {
       "Content-Length": "0", 
       "Host": "httpbin:8000", 
       "User-Agent": "fortio.org/fortio-1.38.4", 
       "X-B3-Parentspanid": "f2d1740a0a9c85bb", 
       "X-B3-Sampled": "1", 
       "X-B3-Spanid": "d7dc042b175b9aeb", 
       "X-B3-Traceid": "58f24d400a95f78af2d1740a0a9c85bb", 
       "X-Forwarded-Client-Cert": "By=spiffe://cluster.local/ns/default/sa/httpbin;Hash=cab6dab828729dfc6921a588ee86cf324d8a991ccfce5c49a7e3a6cf05e73fe4;Subject=\"\";URI=spiffe://cluster.local/ns/default/sa/default"
     }, 
     "origin": "127.0.0.1", 
     "url": "http://httpbin:8000/get"
   }
   ```

   可以看到调用后端服务的请求已经成功！接下来，可以测试熔断。

#### 触发熔断器

在 `DestinationRule` 配置中，您定义了 `maxConnections: 1` 和 `http1MaxPendingRequests: 1`。这些规则意味着，如果并发的连接和请求数超过一个，在 `istio-proxy` 进行进一步的请求和连接时，后续请求或连接将被阻止。

1. 发送并发数为 2 的连接（`-c 2`），请求 20 次（`-n 20`）：

   ```shell
   $ kubectl exec "$FORTIO_POD" -c fortio -- /usr/bin/fortio load -c 2 -qps 0 -n 20 -loglevel Warning http://httpbin:8000/get
   10:42:13 I logger.go:134> Log level is now 3 Warning (was 2 Info)
   Fortio 1.38.4 running at 0 queries per second, 4->4 procs, for 20 calls: http://httpbin:8000/get
   Starting at max qps with 2 thread(s) [gomax 4] for exactly 20 calls (10 per thread + 0)
   10:42:13 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:13 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:13 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:13 W http_client.go:936> [1] Non ok http code 503 (HTTP/1.1 503)
   10:42:13 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:13 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:13 W http_client.go:936> [1] Non ok http code 503 (HTTP/1.1 503)
   10:42:13 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:13 W http_client.go:936> [1] Non ok http code 503 (HTTP/1.1 503)
   Ended after 40.737598ms : 20 calls. qps=490.95
   Aggregated Function Time : count 20 avg 0.0037673228 +/- 0.003672 min 0.000209002 max 0.014810201 sum 0.075346455
   # range, mid point, percentile, count
   >= 0.000209002 <= 0.001 , 0.000604501 , 35.00, 7
   > 0.001 <= 0.002 , 0.0015 , 40.00, 1
   > 0.002 <= 0.003 , 0.0025 , 55.00, 3
   > 0.004 <= 0.005 , 0.0045 , 60.00, 1
   > 0.005 <= 0.006 , 0.0055 , 85.00, 5
   > 0.006 <= 0.007 , 0.0065 , 90.00, 1
   > 0.009 <= 0.01 , 0.0095 , 95.00, 1
   > 0.014 <= 0.0148102 , 0.0144051 , 100.00, 1
   # target 50% 0.00266667
   # target 75% 0.0056
   # target 90% 0.007
   # target 99% 0.0146482
   # target 99.9% 0.014794
   Error cases : count 9 avg 0.001515652 +/- 0.002773 min 0.000209002 max 0.009301589 sum 0.013640868
   # range, mid point, percentile, count
   >= 0.000209002 <= 0.001 , 0.000604501 , 77.78, 7
   > 0.001 <= 0.002 , 0.0015 , 88.89, 1
   > 0.009 <= 0.00930159 , 0.00915079 , 100.00, 1
   # target 50% 0.000670418
   # target 75% 0.000967042
   # target 90% 0.00903016
   # target 99% 0.00927445
   # target 99.9% 0.00929887
   # Socket and IP used for each connection:
   [0]   7 socket used, resolved to [10.108.210.189:8000] connection timing : count 7 avg 0.00014323714 +/- 8.516e-05 min 9.1977e-05 max 0.000348143 sum 0.00100266
   [1]   4 socket used, resolved to [10.108.210.189:8000] connection timing : count 4 avg 0.00018754275 +/- 4.061e-05 min 0.000135404 max 0.00024686 sum 0.000750171
   Connection time (s) : count 11 avg 0.00015934827 +/- 7.529e-05 min 9.1977e-05 max 0.000348143 sum 0.001752831
   Sockets used: 11 (for perfect keepalive, would be 2)
   Uniform: false, Jitter: false
   IP addresses distribution:
   10.108.210.189:8000: 11
   Code 200 : 11 (55.0 %)
   Code 503 : 9 (45.0 %)
   Response Header Sizes : count 20 avg 126.55 +/- 114.5 min 0 max 231 sum 2531
   Response Body/Total Sizes : count 20 avg 557.85 +/- 286.6 min 241 max 818 sum 11157
   All done 20 calls (plus 0 warmup) 3.767 ms avg, 490.9 qps
   ```

   有可以看到大部分请求还是都完成了，但是并不是一半的请求失败，这是因为 `istio-proxy` 并不是100%准确的：

   ```shell
   Code 200 : 11 (55.0 %)
   Code 503 : 9 (45.0 %)
   ```

2. 将并发连接数提高到 3 个（3个并发执行30次）：

   ```shell
   $ kubectl exec "$FORTIO_POD" -c fortio -- /usr/bin/fortio load -c 3 -qps 0 -n 30 -loglevel Warning http://httpbin:8000/get
   10:42:34 I logger.go:134> Log level is now 3 Warning (was 2 Info)
   Fortio 1.38.4 running at 0 queries per second, 4->4 procs, for 30 calls: http://httpbin:8000/get
   Starting at max qps with 3 thread(s) [gomax 4] for exactly 30 calls (10 per thread + 0)
   10:42:34 W http_client.go:936> [1] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [2] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [2] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [2] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [2] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [2] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [2] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [2] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [1] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [2] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [1] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [1] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [0] Non ok http code 503 (HTTP/1.1 503)
   10:42:34 W http_client.go:936> [1] Non ok http code 503 (HTTP/1.1 503)
   Ended after 35.232481ms : 30 calls. qps=851.49
   Aggregated Function Time : count 30 avg 0.0030330515 +/- 0.003172 min 0.000291779 max 0.013781087 sum 0.090991546
   # range, mid point, percentile, count
   >= 0.000291779 <= 0.001 , 0.00064589 , 23.33, 7
   > 0.001 <= 0.002 , 0.0015 , 56.67, 10
   > 0.002 <= 0.003 , 0.0025 , 73.33, 5
   > 0.003 <= 0.004 , 0.0035 , 76.67, 1
   > 0.004 <= 0.005 , 0.0045 , 80.00, 1
   > 0.005 <= 0.006 , 0.0055 , 90.00, 3
   > 0.009 <= 0.01 , 0.0095 , 93.33, 1
   > 0.011 <= 0.012 , 0.0115 , 96.67, 1
   > 0.012 <= 0.0137811 , 0.0128905 , 100.00, 1
   # target 50% 0.0018
   # target 75% 0.0035
   # target 90% 0.006
   # target 99% 0.0132468
   # target 99.9% 0.0137277
   Error cases : count 20 avg 0.0014622678 +/- 0.0009196 min 0.000291779 max 0.004242896 sum 0.029245356
   # range, mid point, percentile, count
   >= 0.000291779 <= 0.001 , 0.00064589 , 35.00, 7
   > 0.001 <= 0.002 , 0.0015 , 85.00, 10
   > 0.002 <= 0.003 , 0.0025 , 95.00, 2
   > 0.004 <= 0.0042429 , 0.00412145 , 100.00, 1
   # target 50% 0.0013
   # target 75% 0.0018
   # target 90% 0.0025
   # target 99% 0.00419432
   # target 99.9% 0.00423804
   # Socket and IP used for each connection:
   [0]   8 socket used, resolved to [10.108.210.189:8000] connection timing : count 8 avg 0.00027488975 +/- 0.0003185 min 6.8636e-05 max 0.001052815 sum 0.002199118
   [1]   6 socket used, resolved to [10.108.210.189:8000] connection timing : count 6 avg 0.0002166175 +/- 0.0001668 min 7.2906e-05 max 0.00056839 sum 0.001299705
   [2]   9 socket used, resolved to [10.108.210.189:8000] connection timing : count 9 avg 0.00028147689 +/- 0.000415 min 5.8022e-05 max 0.001432828 sum 0.002533292
   Connection time (s) : count 23 avg 0.00026226587 +/- 0.0003327 min 5.8022e-05 max 0.001432828 sum 0.006032115
   Sockets used: 23 (for perfect keepalive, would be 3)
   Uniform: false, Jitter: false
   IP addresses distribution:
   10.108.210.189:8000: 23
   Code 200 : 10 (33.3 %)
   Code 503 : 20 (66.7 %)
   Response Header Sizes : count 30 avg 76.666667 +/- 108.4 min 0 max 230 sum 2300
   Response Body/Total Sizes : count 30 avg 433 +/- 271.5 min 241 max 817 sum 12990
   All done 30 calls (plus 0 warmup) 3.033 ms avg, 851.5 qps
   ```

   我们可以看到大部分的请求都被熔断器拦截：

   ```
   Code 200 : 10 (33.3 %)
   Code 503 : 20 (66.7 %)
   ```

3. 查询 `istio-proxy` 状态以了解更多熔断详情:

   ```shell
   $ kubectl exec "$FORTIO_POD" -c istio-proxy -- pilot-agent request GET stats | grep httpbin | grep pending
   cluster.outbound|8000||httpbin.default.svc.cluster.local.circuit_breakers.default.rq_pending_open: 0
   cluster.outbound|8000||httpbin.default.svc.cluster.local.circuit_breakers.high.rq_pending_open: 0
   cluster.outbound|8000||httpbin.default.svc.cluster.local.upstream_rq_pending_active: 0
   cluster.outbound|8000||httpbin.default.svc.cluster.local.upstream_rq_pending_failure_eject: 0
   cluster.outbound|8000||httpbin.default.svc.cluster.local.upstream_rq_pending_overflow: 29
   cluster.outbound|8000||httpbin.default.svc.cluster.local.upstream_rq_pending_total: 28
   ```

   可以看到 `upstream_rq_pending_overflow` 值 `29`，这意味着，目前为止已有 29 个调用被标记为熔断。

## 清理

1. 清理规则:

   ```shell
   kubectl delete destinationrule httpbin
   ```

2. 下线 [httpbin](https://github.com/istio/istio/tree/release-1.16/samples/httpbin) 服务和客户端：

   ```shell
   kubectl delete -f samples/httpbin/sample-client/fortio-deploy.yaml
   kubectl delete -f samples/httpbin/httpbin.yaml
   ```

## 参考

* https://istio.io/latest/zh/docs/tasks/traffic-management/circuit-breaking/
* https://banzaicloud.com/blog/istio-circuit-breaking/
* https://istio.io/latest/docs/reference/config/networking/destination-rule/#TrafficPolicy
* https://istio.io/latest/zh/docs/ops/common-problems/network-issues/#service-unavailable-errors-after-setting-destination-rule