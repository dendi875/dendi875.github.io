---
title: ZooKeeper API使用之实现分布式队列
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-04-16 16:33:51
password:
summary: ZooKeeper API使用之实现分布式队列
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

## 使用 maven 构建 zookeeper 源码

1. clone 源代码

   ```bash
   git clone https://github.com/apache/zookeeper.git
   
   cd zookeeper
   ```

2. 切到相应分支

   ```bash
   git checkout branch-3.5.5
   ```

3. 修改 pom.xml

   如下图所示，修改根 pom.xm 中 git-commit-id-plugin 的version 为 3.0.1，自带的2.2.5在maven中央库里没有的。

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/image-20230326164851133.png)

4. 运行`mvn install -Dmaven.skip.test=rue ` 或使用 IDEA 导入zookeeper maven 项目

5. 运行单元测试文件

   运行 zookeeper-recipes-queue 中的单元测试文件 DistributedQueueTest：

   ```bash
   cd zookeeper-recipes/zookeeper-recipes-queue
   
   mvn test -Dtest=org.apache.zookeeper.recipes.queue.DistributedQueueTest
   ```

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326165916.png)

## Queue 的设计

使用Zookeeper来实现一个分布式队列时，Queue 应该怎样设计呢？

我们使用路径为 `/queue` 的 znode 下的节点表示队列中的元素。/queue 下的节点都是顺序持久化 znode。这些 znode 名字的后缀数字表示了对应队列元素在队列中的位置。znode 名字后缀数字越小，对应队列元素在队列中的位置越靠前。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326170352.png)

### offer 方法

offer 方法在 /queue 下面创建一个顺序 znode。因为 znode 的后缀数字是/queue 下面现有 znode 最大后缀数字加 1，所以该 znode 对应的队列元素处于队尾。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326170629.png)

### element 方法

element 方法有以下两种返回的方式，我们下面说明这两种方式都是正确的。 

* `throw new NoSuchElementException()`：因为 element 方法读取到了队列为空的状态，所以抛出 NoSuchElementException 是正确的。
* `return zookeeper.getData(dir+“/”+headNode, false, null)`： **childNames 保存的是队列内容的一个快照。这个 return 语句返回的是快照中还没出队列的值**。如果队列快照的元素都出队了，重试。



如下图所示，我们  `getData` 方法返回的的确是队列的队头，假设`/queue`下面的子节点是1,2,3,4。第一次调用 getData 时还没有发生出队，则返回1，第二次调用 getData 时发生了一次出队，则返回2，

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326172012.png)

### remove 方法

remove 方法和 element 方法类似，都是从队列的的头部移除一下元素。值得注意的是getData的成功执行不意味着出队成功，原因是该队列元素可能会被其他用户出队。 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326172435.png)



## 参考

* https://zookeeper.apache.org/doc/r3.5.3-beta/recipes.html#sc_recipes_Queues