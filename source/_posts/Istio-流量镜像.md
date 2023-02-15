---
title: Istio 流量镜像
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-12-25 16:58:47
password:
summary: Istio 流量镜像
tags: 
	- Istio
	- Kubernetes
	- Service Mesh
categories: Istio
---

## 背景

流量镜像，也叫影子流量（Traffic shadowing），是一种通过复制生产环境的流量到非生产环境（一般是预发布环境）进行测试开发的工作模式。

影子流量常用场景：

* 线上流量模拟和测试，比如要用新系统替换掉老旧系统或者系统经历了大规模改造的时候，可以将线上流量导入新系统试运行；一些实验性的架构调整，也可以通过线上流量进行模拟测试。

- 由于是全样本的模拟，影子流量可以应用于新服务的预上线演练，由于传统的手工测试本身是一种样本化的行为，通过导入真实流量形态，可以完整的模拟线上的所有情况，比如异常的特殊字符，带恶意攻击的token，可以探测预发布服务最真实的处理能力和对异常的处理能力。
- 用于线上问题排查和临时的数据采集，比如对于一些线上突发性问题，在线下流量总是无法复现，这时候可以临时开启一个分支服务，导入影子流量进行调试和排查，而不影响线上服务。
- 用于日志行为采集，对于推荐系统和算法来说，样本和数据是非常核心的，传统的自动化测试在算法类的应用所面对的最大的挑战就是无法构建真实环境的用户行为数据，通过影子流量可以将用户行为以日志的形式保存起来，既可以为推荐系统和算法模型构建模拟测试样本数据，也可以作为后续大数据分析用户画像的数据来源再应用到推荐服务中。

## Istio 中的流量镜像

这里我们先把流量全部路由到 v1 版本的测试服务中，然后添加路由规则将一部分流量镜像到 v2 版本中去，来测试流量镜像功能。

### 开始之前

- 按照[安装指南](https://istio.io/latest/zh/docs/setup/)中的说明设置 Istio。

- 首先部署两个版本的 [Httpbin](https://github.com/istio/istio/tree/release-1.16/samples/httpbin) 服务，并开启访问日志功能：

  **首先部署 `v1` 版本的 httpbin 服务：**

  ```bash
  kubectl create -f - <<EOF
  apiVersion: apps/v1
  kind: Deployment
  metadata:
    name: httpbin-v1
  spec:
    replicas: 1
    selector:
      matchLabels:
        app: httpbin
        version: v1
    template:
      metadata:
        labels:
          app: httpbin
          version: v1
      spec:
        containers:
        - image: docker.io/kennethreitz/httpbin
          imagePullPolicy: IfNotPresent
          name: httpbin
          command: ["gunicorn", "--access-logfile", "-", "-b", "0.0.0.0:80", "httpbin:app"]
          ports:
          - containerPort: 80
  EOF
  ```

  **然后部署 `v2` 版本的 httpbin 服务：**

  ```bash
  kubectl create -f - <<EOF
  apiVersion: apps/v1
  kind: Deployment
  metadata:
    name: httpbin-v2
  spec:
    replicas: 1
    selector:
      matchLabels:
        app: httpbin
        version: v2
    template:
      metadata:
        labels:
          app: httpbin
          version: v2
      spec:
        containers:
        - image: docker.io/kennethreitz/httpbin
          imagePullPolicy: IfNotPresent
          name: httpbin
          command: ["gunicorn", "--access-logfile", "-", "-b", "0.0.0.0:80", "httpbin:app"]
          ports:
          - containerPort: 80
  EOF
  ```

  可以看到 v1 和 v2 两个版本的 httpbin 服务已经部署好了： 

  ```bash
  # zhangquan @ MacBook-Pro-2 in ~/Downloads/devops/istio-1.5.1 [16:42:18] 
  $ kubectl get pod
  NAME                              READY   STATUS            RESTARTS   AGE
  ......
  httpbin-v1-6b4c749d6-fhvb2        2/2     Running   0          2m22s
  httpbin-v2-5748c488bc-k2m9h       2/2     Running   0          100s
  ```

  **然后创建一个 httpbin 的 Service 对象，关联上面的两个版本服务：**

  ```bash
  kubectl create -f - <<EOF
  apiVersion: v1
  kind: Service
  metadata:
    name: httpbin
    labels:
      app: httpbin
  spec:
    ports:
    - name: http
      port: 8000
      targetPort: 80
    selector:
      app: httpbin
  EOF
  ```

  验证服务部署成功：

  ```bash
  $ kubectl get svc
  NAME          TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
  ......
  httpbin       ClusterIP   10.106.141.152   <none>        8000/TCP   31s
  ```

* 启动 `sleep` 服务，这样就可以使用 `curl` 来提供负载：

  **sleep service：**

  ```bash
  kubectl create -f - <<EOF
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
        containers:
        - name: sleep
          image: curlimages/curl
          command: ["/bin/sleep","3650d"]
          imagePullPolicy: IfNotPresent
  EOF
  ```

### 创建一个默认路由策略

默认情况下，Kubernetes 在 httpbin 服务的两个版本之间进行负载均衡。这里我们首先创建一个默认路由规则，将所有流量路由到服务的 `v1` 版本中去：

1. 创建一个默认路由规则，将所有流量路由到服务的 `v1` 版本：

   ```bash
   kubectl apply -f - <<EOF
   apiVersion: networking.istio.io/v1alpha3
   kind: VirtualService
   metadata:
     name: httpbin
   spec:
     hosts:
       - httpbin
     http:
     - route:
       - destination:
           host: httpbin
           subset: v1
         weight: 100
   ---
   apiVersion: networking.istio.io/v1alpha3
   kind: DestinationRule
   metadata:
     name: httpbin
   spec:
     host: httpbin
     subsets:
     - name: v1
       labels:
         version: v1
     - name: v2
       labels:
         version: v2
   EOF
   ```

   上面对象创建完成后，所有流量都会转到 `httpbin:v1` 服务下面去

2. 向服务发送一部分流量：

   ```bash
   $ export SLEEP_POD=$(kubectl get pod -l app=sleep -o jsonpath={.items..metadata.name})
   $ kubectl exec "${SLEEP_POD}" -c sleep -- curl -sS http://httpbin:8000/headers
   {
     "headers": {
       "Accept": "*/*", 
       "Content-Length": "0", 
       "Host": "httpbin:8000", 
       "User-Agent": "curl/7.87.0-DEV", 
       "X-B3-Parentspanid": "4f6666ce18b44948", 
       "X-B3-Sampled": "1", 
       "X-B3-Spanid": "ff89fcc6b18d80e6", 
       "X-B3-Traceid": "01ef2cccea3c5fee4f6666ce18b44948", 
       "X-Forwarded-Client-Cert": "By=spiffe://cluster.local/ns/default/sa/default;Hash=0f2d91b13b84a0e07bf814f242b1868ec55957cf39d479378446214c6c30a1f6;Subject=\"\";URI=spiffe://cluster.local/ns/default/sa/default"
     }
   }
   ```

3. 分别查看 `httpbin` Pod的 `v1` 和 `v2` 两个版本的日志。您可以看到 `v1` 版本的访问日志条目，而 `v2` 版本没有日志：

   ```bash
   $ export V1_POD=$(kubectl get pod -l app=httpbin,version=v1 -o jsonpath={.items..metadata.name})
   $ kubectl logs -f $V1_POD -c httpbin
   127.0.0.1 - - [22/Dec/2022:08:49:17 +0000] "GET /headers HTTP/1.1" 200 522 "-" "curl/7.87.0-DEV"
   ```

   ```bash
   $ export V2_POD=$(kubectl get pod -l app=httpbin,version=v2 -o jsonpath={.items..metadata.name})
   $  kubectl logs -f $V2_POD -c httpbin
   ```

   这是因为上面我们创建的路由规则是将所有的请求都路由到了 `v1` 这个版本的服务中去。接下来我们更改下流量规则，将流量镜像到 `v2` 版本的服务中去。

### 镜像流量到 v2

1. 改变流量规则将流量镜像到 v2：

   ```bash
   kubectl apply -f - <<EOF
   apiVersion: networking.istio.io/v1alpha3
   kind: VirtualService
   metadata:
     name: httpbin
   spec:
     hosts:
       - httpbin
     http:
     - route:
       - destination:
           host: httpbin
           subset: v1
         weight: 100
       mirror:
         host: httpbin
         subset: v2
       mirrorPercentage:
         value: 100.0
   EOF
   ```

   这个路由规则会发送 100% 流量到 `v1` 这个子集服务，然后通过 `mirror` 属性配置了将流量也 100% 镜像到了 `httpbin:v2` 服务。当流量被镜像时，请求将发送到镜像服务中，并在 headers 中的 `Host/Authority` 属性值上追加 `-shadow`。

   您可以使用 `mirrorPercentage` 属性下的 `value` 字段来设置镜像流量的百分比，而不是镜像所有请求。如果没有这个属性，将镜像所有流量。

2. 发送流量：

   ```bash
   $ kubectl exec -it $SLEEP_POD -c sleep -- sh -c 'curl  http://httpbin:8000/headers' | python -m json.tool  
   {
       "headers": {
           "Accept": "*/*",
           "Content-Length": "0",
           "Host": "httpbin:8000",
           "User-Agent": "curl/7.87.0-DEV",
           "X-B3-Parentspanid": "b106b127a11a6e0f",
           "X-B3-Sampled": "1",
           "X-B3-Spanid": "568ba017bfdd0c66",
           "X-B3-Traceid": "e39250f90655f59db106b127a11a6e0f",
           "X-Forwarded-Client-Cert": "By=spiffe://cluster.local/ns/default/sa/default;Hash=0f2d91b13b84a0e07bf814f242b1868ec55957cf39d479378446214c6c30a1f6;Subject=\"\";URI=spiffe://cluster.local/ns/default/sa/default"
       }
   }
   ```

   现在就可以看到 `v1` 和 `v2` 版本中都有了访问日志。v2 版本中的访问日志就是由镜像流量产生的，这些请求的实际目标是 `v1` 版本。

   ```bash
   $ kubectl logs -f $V1_POD -c httpbin
   127.0.0.1 - - [22/Dec/2022:08:49:17 +0000] "GET /headers HTTP/1.1" 200 522 "-" "curl/7.87.0-DEV"
   127.0.0.1 - - [22/Dec/2022:08:58:07 +0000] "GET /headers HTTP/1.1" 200 522 "-" "curl/7.87.0-DEV"
   ```

   ```bash
   $  kubectl logs -f $V2_POD -c httpbin
   127.0.0.1 - - [22/Dec/2022:08:58:07 +0000] "GET /headers HTTP/1.1" 200 562 "-" "curl/7.87.0-DEV"
   ```

## 清理

1. 删除规则：

   ```bash
   $ kubectl delete virtualservice httpbin
   $ kubectl delete destinationrule httpbin
   ```

2. 关闭 [Httpbin](https://github.com/istio/istio/tree/release-1.16/samples/httpbin) 服务和客户端：

   ```bash
   $ kubectl delete deploy httpbin-v1 httpbin-v2 sleep
   $ kubectl delete svc httpbin
   ```

## 参考

* https://istio.io/latest/zh/docs/tasks/traffic-management/mirroring/