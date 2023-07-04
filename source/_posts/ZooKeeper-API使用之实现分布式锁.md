---
title: ZooKeeper API使用之实现分布式锁
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-04-16 16:41:14
password:
summary: ZooKeeper API使用之实现分布式锁
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

## 分布式锁的设计

使用Zookeeper API 来实现一个分布式锁时，应该怎样设计呢？

 zookeeper 分布式锁源代码：https://github.com/apache/zookeeper/tree/branch-3.5.5/zookeeper-recipes/zookeeper-recipes-lock

**使用临时顺序 znode （比如: /lock）来表示获取锁的请求，创建最小后缀数字 znode 的用户成功拿到锁。**

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326173446.png)

如上图所示，有3个锁请求，分别是后续数字1，后续数字2，后续数字3。因为数字1 是最小的，所以后续数字1的请求能够拿到锁，成为锁的持有者。

## 避免羊群效应（herd effect）

在设计锁时要注意避免羊群效应。

把锁请求者按照后缀数字进行排队，后缀数字小的锁请求者先获取锁。如果所有的锁请求者都 watch 锁持有者，当代表锁请求者的 znode 被删除以后，所有的锁请求者都会通知到，但是只有一个锁请求者能拿到锁。这就是羊群效应。

为了避免羊群效应，**每个锁请求者 watch 它前面的锁请求者**。每次锁被释放，只会有一个锁请求者会被通知到。这样做还让锁的分配具有公平性，锁定的分配遵循先到先得的原则。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326173900.png)

如上图所示，后续数字3的锁请求它 watch 的不是锁持有者（后续数字1的锁请求者），而是 watch 它前面的锁请求者（后续数字2）

## 代码展示

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326174605.png)

## 运行测试用例

运行 zookeeper-recipes-queue 中的单元测试文件 DistributedQueueTest：

```bash
cd zookeeper/zookeeper-recipes/zookeeper-recipes-lock

mvn test -Dtest=org.apache.zookeeper.recipes.lock.WriteLockTest
```

## 参考

* https://zookeeper.apache.org/doc/r3.5.3-beta/recipes.html#sc_recipes_Locks