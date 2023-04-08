---
title: ZooKeeper 服务说明
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-04-08 14:20:35
password:
summary: ZooKeeper 服务说明
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

## ZooKeeper 服务的使用

要使用 ZooKeeper 服务我们的应用就要引入 ZooKeeper 客户端库，然后 ZooKeeper 客户端与 ZooKeeper 集群进行通信交互来使用 ZooKeeper 提供的功能。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230322213143.png)

## ZooKeeper 数据模型

ZooKeeper 的数据模型是层次模型（Google Chubby也是这么做的）。

层次模型常见于文件系统。层次模型和 key-value 模型是两种主流的数据模型。

ZooKeeper 使用文件系统模型主要基于以下两点考虑：

* 文件系统的树形结构便于表达数据之间的层次关系。

* 文件系统的树形结构便于为不同的应用分配独立的命名空间（namespace）。

**ZooKeeper 的层次模型称作 data tree**。**Data tree 的每个节点叫作 znode**。不同于文件系统，每个节点都可以保存数据。每个节点都有一个版本 (version)。版本从 0 开始计数。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230322213308.png)

### data tree示例

在下图所示的 data tree中有两个子树，一个用于应用1（/app1）和另一个用于应用2（/app2）。

应用1的子树实现了一个简单的组成员协议：每个客户端进程 pi 创建一个 znode  p_i 在 / app1 下，只要 /app1/p_i 存在就代表进程 pi 存在，就代表 pi 在正常运行。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230322213519.png)

### data tree接口

ZooKeeper 对外提供一个用来访问 data tree的简化文件系统 API： 

* 使用 UNIX 风格的路径名来定位 znode,例如 /A/X 表示根节点下面的 A节点下面的 X 节点。 

* znode的数据只支持全量写入和读取，没有像通用文件系统那样支持部分写入和读取。 普通文件系统是可以读取文件中的部分内容。

* data tree的所有 API 都是 wait-free的，正在执行中的 API 调用不会影响其他 API 的完成。例如： 系统中有两个调用，一个是调用 A，一个是调用 B，A调用完成与否不会影响B调用的完成与否。

* data tree的 API 都是对文件系统的 wait-free操作，不直接提供锁这样的分布式协同机制。但是 data tree的 API 非常强大，可以用ZooKeeper 提供的API 来实现多种分布式协同机制。

### znode分类

一个 znode 可以使持久性的，也可以是临时性的：

* 持久性的 znode `(PERSISTENT)`: ZooKeeper 宕机，或者 client 宕机，这个 znode一旦创建就不会丢失。重启后依然存在。

* 临时性的 znode `(EPHEMERAL)`: ZooKeeper 宕机了，或者 client 在指定的 timeout 时间内没有连接 server ，都会被认为丢失。

znode 节点也可以是顺序性的。每一个顺序性的 znode 关联一个唯一的单调递增整数。这个单调递增整数是 znode 名字的后缀。如果上面两种 znode 如果具备顺序性，又有以下两种 znode：

* 持久顺序性的 znode`(PERSISTENT_SEQUENTIAL)`: znode 除了具备持久性 znode 的特点之外，znode 的名字具备顺序性。

* 临时顺序性的 znode`(EPHEMERAL_SEQUENTIAL)`: znode 除了具备临时性 znode 的特点之外，znode的名字具备顺序性。

ZooKeeper 主要常用的就是以上 4 种 znode。

## 参考

* https://zookeeper.apache.org/doc/r3.5.5/zookeeperOver.html