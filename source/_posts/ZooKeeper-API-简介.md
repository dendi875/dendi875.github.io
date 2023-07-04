---
title: ZooKeeper API 简介
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-04-14 11:13:03
password:
summary: ZooKeeper API 简介
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

## ZooKeeper 类

ZooKeeper Java 代码主要使用 org.apache.zookeeper.ZooKeeper 这个类来使用 ZooKeeper 服务。

```java
ZooKeeper(connectString, sessionTimeout, watcher)
```

* connectString：使用逗号分隔的列表，每个 ZooKeeper 节点是一个 host:port 对，host 是机器名或者 IP地址，port 是 ZooKeeper 节点使用的端口号。 会任意选取 connectString 中的一个节点建立连接。

* sessionTimeout：session timeout 时间。

* watcher: 用于接收到来自 ZooKeeper 集群的所有事件。

## ZooKeeper 类的主要方法

| 方法名                       | 描述                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `create(path, data, flags)`    | 创建一个给定路径的 znode，并在 znode 保存 data[]的数据，flags 指定 znode 的类型。 |
| `delete(path, version)`     | 如果给定 path 上的 znode 的版本和给定的 version 匹配，删除 znode |
| `exists(path, watch)`         | 判断给定 path 上的 znode 是否存在，并在 znode 设置一个watch  |
| `getData(path, watch)`         | 返回给定 path 上的 znode 数据，并在 znode 设置一个 watch     |
| `setData(path, data, version)` | 如果给定 path 上的 znode 的版本和给定的 version 匹配，设置 znode 数据 |
| `getChildren(path, watch)`     | 返回给定 path 上的 znode 的孩子 znode 名字，并在 znode 设置一个 watch |
| `sync(path)`                   | 把客户端 session 连接节点和 leader 节点进行同步              |

 方法说明：

* 所有获取 znode 数据的 API 都可以设置一个 watch 用来监控 znode 的变化
* 所有更新 znode 数据的 API 都有两个版本: 无条件更新版本和条件更新版本。
  * 如果 version为 -1，更新为无条件更新。否则只有给定的 version 和 znode 当前的 version 一样，才会进行更新，这样的更新是条件更新
* 所有的方法都有同步和异步两个版本。同步版本的方法发送请求给 ZooKeeper 并等待服务器的响应。异步版本把请求放入客户端的请求队列，然后马上返回。异步版本通过 callback 来接受来自服务端的响应。

## ZooKeeper 代码异常处理

所有同步执行的 API 方法都有可能抛出以下两个异常： 

* KeeperException: 表示 ZooKeeper 服务端的各种错误。 
  * KeeperException 的子类ConnectionLossException 表示客户端和当前连接的 ZooKeeper 节点断开了连接，网络分区和 ZooKeeper 节点失败都会导致这个异常出现。发生此异常的时机可能是在 ZooKeeper 节点处理客户端请求之前，也可能是在 ZooKeeper 节点处理客户端请求之后。出现 ConnectionLossException 异常之后，客户端会进行自动重新连接，但是我们必须要检查我们以前的客户端请求是否被成功执行。 

* InterruptedException：表示方法被中断了，我们可以使用 Thread.interrupt() 来中断API 的执行。

## 数据读取 API

有以下三个获取 znode 数据的方法：

| 方法名                                                       | 描述                                                         | 说明     |
| ------------------------------------------------------------ | ------------------------------------------------------------ | -------- |
| `byte[] getData(String path, boolean watch, Stat stat)`       | 如果 watch 为 true，该 znode 的状态变化会发送给构建 ZooKeeper 是指定的 watcher | 同步方法 |
| `void getData(String path, boolean watch, DataCallback cb, Object ctx)` | cb 是一个 callback，用来接收服务端的响应。ctx 是提供给 cb 的 context。watch 参数的含义和方法 1 相同 | 异步方法 |
| `void getData(String path, Watcher watcher, DataCallback cb, Object ctx)` | watcher 用来接收该 znode 的状态变化                          | 异步方法 |

## 数据写入 API

| 方法名                                                       | 描述                                                         | 说明     |
| ------------------------------------------------------------ | ------------------------------------------------------------ | -------- |
| `Stat setData(String path, byte[] data, int version)`          | 如果 version 是 -1，做无条件更新。<br/>如果 version 是非 0 整数，做条件更新。 | 同步版本 |
| `void setData(String path, byte[] data, int version, StatCallback cb, Object ctx)` | cb 是一个 callback，用来接收服务端的响应。ctx 是提供给 cb 的 context。 | 异步版本 |

## watch

watch 提供了一个让客户端获取最新数据的机制。如果没有 watch 机制，客户端需要不断的轮询 ZooKeeper 来查看是否有数据更新，这在分布式环境中是非常耗时的。客户端可以在读取数据的时候设置一个 watcher，这样在数据更新时，客户端就会收到通知。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326160029.png)

## 条件更新

设想用 znode /c 实现一个 counter，使用 set 命令来实现自增 1 操作。条件更新场景：

* 客户端 1 把 /c 更新到版本 1，实现 /c 的自增 1 。

*  客户端 2 把 /c 更新到版本 2，实现 /c 的自增 1 。

* 客户端 1 不知道 /c 已经被客户端 2 更新过了，还用过时的版本 1 是去更新 /c，更新失败。如果客户端1 使用的是无条件更新，/c 就会更新为 2，没有实现自增 1 。使用条件更新可以避免对数据基于过期的数据进行数据更新操作。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326160241.png)

## Javadoc API

详见官网：https://javadoc.io/doc/org.apache.zookeeper/zookeeper/3.5.5/index.html

其中最重要的包是：`org.apache.zookeeper`，最重要的类是：`ZooKeeper`