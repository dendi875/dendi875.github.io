---
title: ZooKeeper 服务发现（二）
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-05-06 13:28:18
password:
summary: ZooKeeper 服务发现（二）
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

本篇我们介绍一下 ZooKeeper 服务发现这个模块的内部实现和相关代码。

首先我们来了解下服务发现模块里的几个概念：

### Node Cache

Node Cache 是 curator 的一个 recipe ，用来本地 cache 来缓存 ZooKeeper znode上的数据。Node Cache 通过监控一个 znode 的 update / create / delete 事件来更新本地的 znode 数据。用户可以在 Node Cache 上面注册一个 listener 来获取 cache 更新的通知。

### Path Cache

Path Cache 和 Node Cache 一样，不同之处是在于 Path Cache 缓存一个 znode 目录下所有子节点。Node Cache 它只监控一个 znode 上的数据，Path Cache 它监控一个 znode 目录下所有子 znode 的数据。

### container 节点

container 节点是一种新引入的 znode ，目的在于**下挂子节点**。当一个 container 节点的所有子节点被删除之后，ZooKeeper 会删除掉这个 container 节点。服务发现的 base path 节点和服务节点就是 containe 节点。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230413220054.png)

## 服务发现模块内部实现核心代码

### ServiceDiscoveryImpl

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230413221348.png)

### ServiceCacheImpl

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/ServiceCacheImpl-2.png)

ServiceCacheImpl 使用一个 PathChildrenCache 来维护一个 instances 。这个 instances也是对 znode 数据的一个 cache 。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/ServiceCacheImpl.png)

### ServiceProviderImpl

ServiceProviderImpl 是多个对象的 facade。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/ServiceProviderImpl-1.png)

### ProviderStrategy

### DownInstancePolicy

## 参考

* https://curator.apache.org/curator-recipes/node-cache.html
* https://curator.apache.org/curator-recipes/path-cache.html
