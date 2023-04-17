---
title: ZooKeeper 实现 Master-Worker 协同
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-04-13 20:57:29
password:
summary: ZooKeeper 实现 Master-Worker 协同
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

## 协同服务说明

一个 master-worker 的组成员管理系统，在这个系统中只有一个 master，可以有多个 worker，master 能实时获取系统中 worker 的情况。

## master-worker架构

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/m-w.png)

master-work 是一个广泛使用的分布式架构。master-work 架构中有一个 master 负责监控 worker 的状态，并为 worker 分配任务。

* 在任何时刻，系统中最多只能有一个 master，不可以出现两个 master 的情况，多个 master 共存会导致脑裂。

* 系统中除了处于 active 状态的 master 还有一个 backup master，如果 active master 失败了，backup master 可以很快的进入active 状态。

* master 实时监 控 worker 的状态，能够及时收到 worker 成员变化的通知。master 在收到 worke r成员变化的时候，通常重新进行任务的重新分配。

## master-worker架构示例

### HBase

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/m-w-hbase.png)

HBase 采用的是 master-worker 的架构。HMBase 是系统中的 master，HRegionServer 是系统中的 worker 。

HMBase 监控 HBaseCluster 中 worker 的成员变化，把 region 分配给各个 HRegionServer 。系统中有一个HMaster处于active状态，其他HMaster处于备用状态。

### Kafka

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/m-w-kafka.png)

一个 Kafka 集群由多个 broker 组成，这些 borker 是系统中的 worker。Kafka 会从这些 worker 选举出一个 controller，这个 controller 是系统中的 master，负责把topic partition 分配给各个 broker。

### HDFS

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/m-w-hdfs.png)

HDFS 采用的也是一个 master-worker 的架构，NameNode 是系统中的 master，DataNode 是系统中的 worker。NameNode 用来保存整个分布式文件系统的 metadata，并把数据块分配给 cluster中的 DataNode 进行保存。

## 如何使用 ZooKeeper 实现 master-worker

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/m-w-zookeeper.png)

* 使用一个临时节点 /master 表示 master。master 在行使 master 的职能之前，首先要创建这个 znode。如果能创建成功，进入 active 状态，开始行使master 职能。否则的话，进入backup 状态，使用 watch 机制监控  /master。假设系统中有一个 active master 和一个 backup master。如果 active master失败，它创建的 /master 就会被 ZooKeeper 自动删除。这时 backup master 就会收到通知，通过再次创建 /master 节点成为新的 active master。

* worker通过在 /workers 下面创建临时节点来加入集群。

* 处于 active 状态的 master 会通过 watch 机制监控 /workers 下面 znode 列表来实时获取 worker 成员的变化。

## 使用zkCli.sh演示如何实现 master-worker

* 演示系统中只有一个active master，且有一个 bakcup master，如果 active master 失败了，backup master 可以很快的进入active 状态。

  如下图所示，第一个终端代表组里的一个成员 master1，它会尝试创建一个 znode 来将自己变为组里的 master ，znode 的值为该节点的主机名和端口号，假设 master1 成员的主机名为m1，端口号为2223，创建成功表示 master1 这个成员成为了组里面的 master。

  第二个终端 代表组里的另一个成员 master2，它也尝试创建一个 znode 来将自己变为组里的 master，因为 master1 已经成为了组里的 master，master2 的请求就会失败 （Node already exists: /master），但它会监控 master 这个 znode 的状态，一旦发现 master 这个 znode 节点不存在，它就会再次发起成为master 的请求（再次创建 /master 节点），然后我们模拟 master1 这个节点失败了（quit），这时 master2 会收到一个通知（NodeDeleted），接着再次发起成为master 的请求，这时 master2 成功创建了 /master 节点，master2 就从 backup master 变成 active master。

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230324202038.png)

  相关命令：

  ```bash
  create -e /master "m1:2223"
  
  create -e /master "m2:2223"
  
  stat -w /master
  
  quit
  
  create -e /master "m2:2223"
  ```

* 演示 master 如何监控系统中 worker 成员的状态

  我们用  workers 这个 znode 下面的 znode 来表示 worker，master 就监控  workers 这个 znode 下面的 znode 节点状态。

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230324205852.png)

  相关命令：

  ```bash
  create /workers
  
  create -e /master "m1:2223"
  
  ls -w /workers
  
  create -e  /workers/w1  "w1:2224"  
  
  create -e  /workers/w2  "w2:2224"   
  
  create -e  /workers/w3  "w3:2224"  
  
  quit
  ```