---
title: ZooKeeper Observer
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-04-30 13:56:47
password:
summary: ZooKeeper Observer
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

## ZooKeeper 如何处理写请求

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/leader-fllower2.png)

如上图所示，客户端选择了节点1建立了一个 session，客户端向节点1发起了一个写请求，但因为**leader 节点可以处理读写请求，follower 只处理读请求**，所以节点1收到了写请求后会把这个请求转发给节点2，节点2处理完请求后会向集群中其它所有节点发送一个 Propose 消息，集群中其它节点收到这个 Propose 后会返回一个 Accept 给 leader 节点，leader 节点收到了大多数节点返回的 Accept 消息后会向其它节点发送一个 Commit 消息，其中节点1收到 Commit 消息之后会返回给客户端，告诉客户端写请求已处理成功。

## 什么是 Observer？

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/observer2.png)

Observer 和 ZooKeeper 机器其他节点唯一的交互是接收来自 leader 的 inform 消息，更新自己的本地存储，不参与提交和选举的投票过程。

## Observer 应用场景

### 读性能提升

Observer 和 ZooKeeper 机器其他节点唯一的交互是接收来自 leader 的 inform 消息，更新自己的本地存储，不参与提交和选举的投票过程。因此可以通过往集群里面添加 Observer 节点来提高整个集群的读性能。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/observer5.png)

如上图所示，节点1是一个 observer 节点，客户端与节点1建立了一个session，然后向节点1发起了一个写请求，节点1把请求转发给了 节点2，因为 observer 节点不参与事务的处理过程，它只等待。节点2处理完请求后向节点3发送了一个 propose 消息，节点3收到 propose 消息后向节点2返回一个 accept 消息，节点2向 节点1和节点3发送了一个 commit 消息，最后节点1收到了 commit 消息后返回给客户端，告诉客户端写请求已处理成功。

因为节点1没有参与事务提交的过程，就不会有本地磁盘的写入等操作，就不会影响它本身的性能。

### 跨数据中心部署

我们需要部署一个北京和香港两地都可以使用的 ZooKeeper 服务。我们要求北京和香港的客户端的读请求的延迟都低。因此，我们需要在北京和香港都部署 ZooKeeper 节点。我们假设 leader 节点在北京。那么每个写请求要涉及 leader 和每个香港 follower 节点之间的propose 、ack 和 commit 三个跨区域消息。解决的方案是把香港的节点都设置成 observer 。上面提的 propose 、ack 和 commit 消息三个消息就变成了 inform 一个跨区域消息消息。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230405224411.png)

## 如何使用 Observer

要使某个节点变成 observer 非常简单，只需要对配置文件进行更改。 在要成为观察者节点的配置文件中，将 :observer 添加到每个观察者的服务器定义行。

例如，我们使节点1变为 obbserver。

 `vi conf/zoo1.cfg` 内容如下：

   ```bash
   tickTime = 2000
   dataDir=./data/zookeeper1
   clientPort=2181
   initLimit=10
   syncLimit=5
   server.1=localhost:2881:3881:observer
   server.2=localhost:2882:3882
   server.3=localhost:2883:3883
   ```

```javascript
server.1=localhost:2881:3881:observer
```

这告诉所有其他服务器 server.1 是一个观察者，他们不应该期望它投票。 这是将 Observer 添加到 ZooKeeper 集群所需的所有配置。

然后分别启动节点1，节点2，节点3。

查看节点3的运行状态，可以看到它的角色就是 observer：

```bash
$ ./bin/zkServer.sh status ./conf/zoo1.cfg
/Users/zhangquan/.jenv/shims/java
ZooKeeper JMX enabled by default
Using config: ./conf/zoo1.cfg
Client port found: 2181. Client address: localhost.
Mode: observer
```

现在您可以像连接普通的 Follower 一样连接它。 尝试一下，运行：

```bash
$ bin/zkCli.sh -server localhost:2181
```

## 参考

* https://zookeeper.apache.org/doc/r3.5.5/zookeeperObservers.html