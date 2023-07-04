---
title: ZooKeeper 服务发现（一）
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-05-04 20:09:16
password:
summary: ZooKeeper 服务发现（一）
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

## 什么是服务发现

服务发现主要应用于微服务架构和分布式架构场景下。在这些场景下，一个服务通常需要松耦合多个组件的协同才能完成。服务发现就是让组件发现相关的组件。服务发现要提供的功能有以下3点： 

* 服务注册
* 服务实例的获取
* 服务变化的通知机制。

Curator 有一个扩展叫作 curator-x-discovery 。curator-x-discovery 基于 ZooKeeper 实现了服务发现。

## curator-x-discovery 设计

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230413211315.png)

使用一个 base path 作为整个服务发现的根目录。在这个根目录下是各个服务的的目录。服务目录下面是服务实例。实例是服务实例的 JSON 序列化数据。服务实例对应的 znode 节点可以根据需要设置成持久性、临时性和顺序性。

## 核心接口

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230413211509.png)

服务发现用户代码要使用的 curator-x-discovery 接口。最主要的有以下三个接口：

* ServiceDiscovery：通过这个类可以做服务发现和服务注册，由该类来创建出 ServiceProvider和ServiceCache
* ServiceCache：它的功能是在本地缓存了一些 znode 数据

* ServiceProvider：在服务 cache 之上支持服务发现操作，封装了一些服务发现策略。 

### ServiceInstance

用来表示服务实例的 POJO，除了包含一些服务实例常用的成员之外，还提供一个 payload 成员让用户存自定义的信息。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230413212436.png)

### ServiceDiscovery

从一个 ServiceDiscovery ，可以创建多个 ServiceProvider 和多个 ServiceCache 。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230413212605.png)

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230413212801.png)

### ServiceProvider

ServiceProvider 提供服务发现 high-level API 。ServiceProvider 是封装 ProviderStraegy 和 InstanceProvider 的 facade 。 InstanceProvider 的数据来自一个服务 Cache 。服务 cache 是 ZooKeeper 数据的一个本地 cache ，服务 cache 里面的数据可能会比 ZooKeeper 里面的数据旧一些。ProviderStraegy 提供了三种策略： **轮询、随机和 sticky** 。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230413213010.png)

ServiceProvider 除了提供服务发现的方法( getInstance 和 getAllInstances )以外，还通过 noteError 提供了一个让服务使用者把服务使用情况反馈给 ServiceProvider 的机制。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230413213223.png)

### ServiceCache

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230413213733.png)

## curator-x-discovery 与 ZooKeeper 的交互

ServiceDiscovery 提供的服务注册方法是对 znode 的更新操作，服务发现方法是 znode 的读取操作。同时它也是最核心的类，所有的服务发现操作都要从这个类开始。另外服务 Cache 会接受来自 ZooKeeper 的更新通知，然后更新本地缓存中的数据，读取服务信息（也就是读取 znode 信息）。

## 接口总结

ServiceDiscovery、ServiceCache、ServiceProvider 说明：

* 都有一个对应的 builder。这些 builder 提供一个创建这三个类的 fluent API 。 

* 在使用之前都要调用 start 方法。 

* 在使用之后都要调用 close 方法。close 方法只会释放自己创建的资源，不会释放上游关联的资源，例如 ServiceDiscovery 的 close 方法不会去调用 CuratorFramework 的 close 方法。

## 服务发现调用代码示例

```java
import org.apache.curator.framework.CuratorFramework;
import org.apache.curator.framework.CuratorFrameworkFactory;
import org.apache.curator.retry.RetryOneTime;
import org.apache.curator.utils.CloseableUtils;
import org.apache.curator.x.discovery.ServiceDiscovery;
import org.apache.curator.x.discovery.ServiceDiscoveryBuilder;
import org.apache.curator.x.discovery.ServiceInstance;
import org.apache.curator.x.discovery.ServiceProvider;
import org.junit.Test;

import static com.google.common.truth.Truth.assertThat;

public class ServiceDiscoveryTests {
  private String connectString = "localhost:2181";

  /** Shows the basic usage for curator-x-discovery. */
  @Test
  public void testBasics() throws Exception {
    CuratorFramework client = null;
    ServiceDiscovery<String> discovery = null;
    ServiceProvider<String> provider = null;
    String serviceName = "test";
    String basePath = "/services";

    try {
      // 第一步都是需要通过 CuratorFrameworkFactory 来创建一个 client，并且使用 clinet 之前要 start 一下
      client = CuratorFrameworkFactory.newClient(connectString, new RetryOneTime(1));
      client.start();
		
      // 分别创建两个服务实例1和服务实例2
      ServiceInstance<String> instance1 =
          ServiceInstance.<String>builder().payload("plant").name(serviceName).port(10064).build();
      ServiceInstance<String> instance2 =
          ServiceInstance.<String>builder().payload("animal").name(serviceName).port(10065).build();

      System.out.printf("instance1 id: %s\n", instance1.getId());
      System.out.printf("instance2 id: %s\n", instance2.getId());

      discovery =
          ServiceDiscoveryBuilder.builder(String.class)
              .basePath(basePath) // basePath 在什么地方
              .client(client)
              .thisInstance(instance1) // 刚开始要注册的服务实例
              .build();
      discovery.start();
      discovery.registerService(instance2); // 注册另外一个服务实例

      // 拿到 ServiceProvider
      provider = discovery.serviceProviderBuilder().serviceName(serviceName).build();
      provider.start();
		
      // 以上代码表示我们已经准备好了服务，并把服务注册上了，然后就可以通过 ServiceProvider 去拿注册的服务实例来做服务发现
      assertThat(provider.getInstance().getId()).isNotEmpty();
      assertThat(provider.getAllInstances()).containsExactly(instance1, instance2);

      client.delete().deletingChildrenIfNeeded().forPath(basePath);
    } finally {
      CloseableUtils.closeQuietly(provider);
      CloseableUtils.closeQuietly(discovery);
      CloseableUtils.closeQuietly(client);
    }
  }
}
```

## 参考

* https://curator.apache.org/curator-x-discovery/index.html