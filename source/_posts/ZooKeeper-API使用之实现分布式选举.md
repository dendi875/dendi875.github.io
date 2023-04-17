---
title: ZooKeeper API使用之实现分布式选举
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-04-17 09:21:25
password:
summary: ZooKeeper API使用之实现分布式选举
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

## 分布式选举的设计

使用Zookeeper API 来实现一个分布式选举时，应该怎样设计呢？

zookeeper 分布式选举源代码：https://github.com/apache/zookeeper/tree/branch-3.5.5/zookeeper-recipes/zookeeper-recipes-election

使用临时顺序 znode 来表示选举请求，创建最小后缀数字 znode 的选举请求成功。在协同设计上和分布式锁是一样的，不同之处在于具体实现。不同于分布式锁，选举的具体实现对选举的各个阶段做了监控。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326180224.png)

如上图所示，有三个选举请求 n_0000000000，n_0000000001，n_0000000002，n_0000000000这个节点后续数字最小，所以它赢得了选举成为了 leader，n_0000000001和n_0000000002的选举排在n_0000000000节点的后面。

## 代码展示

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326180719.png)

## 运行测试用例

运行 zookeeper-recipes-queue 中的单元测试文件 DistributedQueueTest：

```bash
cd zookeeper/zookeeper-recipes/zookeeper-recipes-election

mvn test -Dtest=org.apache.zookeeper.recipes.leader.LeaderElectionSupportTest
```

## 参考

* https://zookeeper.apache.org/doc/r3.5.5/recipes.html#sc_leaderElection