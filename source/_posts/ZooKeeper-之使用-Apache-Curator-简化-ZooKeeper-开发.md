---
title: ZooKeeper 之使用 Apache Curator 简化 ZooKeeper 开发
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-04-23 21:54:23
password:
summary: ZooKeeper 之使用 Apache Curator 简化 ZooKeeper 开发
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---
## 什么是 Apache Curator

Apache Curator 是 Apache ZooKeeper 的 Java 客户端库。Curator 项目的目标是简化ZooKeeper 客户端的使用。例如，在以前的代码展示中，我们都要自己处理 ConnectionLossException 。另外 Curator 为常见的分布式协同服务提供了高质量的实现。

Apache Curator 最初是 Netflix 研发的，后来捐献给了 Apache 基金会，目前是 Apache 的顶级项目。

## Curator 技术栈

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326185216.png)
* Client：封装了 ZooKeeper 类，管理和ZooKeeper 集群的连接，并提供了重建连接机制。
* Framework：为所有的 ZooKeeper 操作提供了重试机制，对外提供了一个Fluent 风格的 API 。 
* Recipes：使用 framework 实现了大量的 ZooKeeper 协同服务（分布式队列、分布式锁、分布式选举）。
* Extensions：扩展模块。

### Client

初始化一个 client 分成两个步骤：

1. 创建 client 

   以下是两种创建 client 的方法：

   ```java
   RetryPolicy retryPolicy = new ExponentialBackoffRetry(1000, 3);
   
   // 方法1：使用Factory方法
   CuratorFramework zkc = CuratorFrameworkFactory.newClient(connectString, retryPolicy);
   
   // 方法2：Fluent风格
   CuratorFramework zkc = CuratorFrameworkFactory.buidler()
   .connectString(connectString)
   .retryPolicy(retryPolicy)
   .build()
   ```

2. 启动 client 

   ```java
   zkc.start();
   ```

### Fluent 风格 API

* 同步版本

  ```java
  client.create().withMode(CreateMode.PERSISTENT).forPath(path, data);
  ```

* 异步版本

  ```java
  client.create().withMode(CreateMode.PERSISTENT).inBackground().forPath(path, data);
  ```

* 使用watch

  ```java
  client.getData().watched().forPath(path);
  ```

## 配置 Curator 源码

1.  Curator 的主页 http://curator.apache.org/ 下载最新的版本，目前是 4.2.0。

   ```bash
   wget https://archive.apache.org/dist/curator/4.2.0/apache-curator-4.2.0-source-release.zip
   ```

2. 然后把 apache-curator-4.2.0-source-release.zip 解压到一个本地目录。

   ```bash
   tar -zxf apache-curator-4.2.0-source-release.zip
   ```

3. 然后用 Idea 的导入 Maven 项目的功能导入这个项目。

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326191545.png)

## Curator 示例代码

```java
import org.apache.curator.RetryPolicy;
import org.apache.curator.framework.CuratorFramework;
import org.apache.curator.framework.CuratorFrameworkFactory;
import org.apache.curator.framework.api.CuratorEvent;
import org.apache.curator.retry.ExponentialBackoffRetry;
import org.apache.zookeeper.CreateMode;
import org.apache.zookeeper.WatchedEvent;
import org.apache.zookeeper.Watcher;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.util.concurrent.CountDownLatch;

import static com.google.common.truth.Truth.assertThat;

/**
 * Example code to demonstrate the usage of Curator client and framework.
 */
public class CuratorTests {
  private CuratorFramework client;
  private String connectString = "localhost:2181";
  private RetryPolicy retryPolicy;

  @Before
  public void setUp() {
    retryPolicy = new ExponentialBackoffRetry(1000, 3);
    client = CuratorFrameworkFactory.newClient(connectString, retryPolicy);

    /*
    // Fluent style
    client =
        CuratorFrameworkFactory.builder()
            .connectString(connectString)
            .retryPolicy(retryPolicy)
            .build();
    */

    // Start client
    client.start();
  }

  @After
  public void tearDown() {
    client.close();
  }

  // create -> getData -> delete in synchronous mode
  @Test
  public void testSyncOp() throws Exception {
    String path = "/one";
    byte[] data = {'1'};
    client.create().withMode(CreateMode.PERSISTENT).forPath(path, data);

    byte[] actualData = client.getData().forPath(path);
    assertThat(data).isEqualTo(actualData);

    client.delete().forPath(path);

    client.close();
  }


  // create -> getData -> delete in asynchronous mode
  @Test
  public void testAsyncOp() throws Exception {
    String path = "/two";
    final byte[] data = {'2'};
    final CountDownLatch latch = new CountDownLatch(1);

    // Use listener only for callbacks
    client
        .getCuratorListenable()
        .addListener(
            (CuratorFramework c, CuratorEvent event) -> {
              switch (event.getType()) {
                case CREATE:
                  System.out.printf("znode '%s' created\n", event.getPath());
                  // 2. getData
                  c.getData().inBackground().forPath(event.getPath());
                  break;
                case GET_DATA:
                  System.out.printf("got the data of znode '%s'\n", event.getPath());
                  assertThat(event.getData()).isEqualTo(data);
                  // 3. Delete
                  c.delete().inBackground().forPath(path);
                  break;
                case DELETE:
                  System.out.printf("znode '%s' deleted\n", event.getPath());
                  latch.countDown();
                  break;
              }
            });

    // 1. create
    client.create().withMode(CreateMode.PERSISTENT).inBackground().forPath(path, data);

    latch.await();

    client.close();
  }

  @Test
  public void testWatch() throws Exception {
    String path = "/three";
    byte[] data = {'3'};
    byte[] newData = {'4'};
    CountDownLatch latch = new CountDownLatch(1);

    // Use listener only for watches
    client
        .getCuratorListenable()
        .addListener(
            (CuratorFramework c, CuratorEvent event) -> {
              switch (event.getType()) {
                case WATCHED:
                  WatchedEvent we = event.getWatchedEvent();
                  System.out.println("watched event: " + we);
                  if (we.getType() == Watcher.Event.EventType.NodeDataChanged
                      && we.getPath().equals(path)) {
                    // 4. watch triggered
                    System.out.printf("got the event for the triggered watch\n");
                    byte[] actualData = c.getData().forPath(path);
                    assertThat(actualData).isEqualTo(newData);
                  }
                  latch.countDown();
                  break;
              }
            });

    // 1. create
    client.create().withMode(CreateMode.PERSISTENT).forPath(path, data);
    // 2. getData and register a watch
    byte[] actualData = client.getData().watched().forPath(path);
    assertThat(actualData).isEqualTo(data);

    // 3. setData
    client.setData().forPath(path, newData);
    latch.await();

    // 5. delete
    client.delete().forPath(path);
  }

  @Test
  public void testCallbackAndWatch() throws Exception {
    String path = "/four";
    byte[] data = {'4'};
    byte[] newData = {'5'};
    CountDownLatch latch = new CountDownLatch(2);

    // Use listener for both callbacks and watches
    client
        .getCuratorListenable()
        .addListener(
            (CuratorFramework c, CuratorEvent event) -> {
              switch (event.getType()) {
                case CREATE:
                  // 2. callback for create
                  System.out.printf("znode '%s' created\n", event.getPath());
                  // 3. getData and register a watch
                  assertThat(client.getData().watched().forPath(path)).isEqualTo(data);
                  // 4. setData
                  client.setData().forPath(path, newData);
                  latch.countDown();
                  break;
                case WATCHED:
                  WatchedEvent we = event.getWatchedEvent();
                  System.out.println("watched event: " + we);
                  if (we.getType() == Watcher.Event.EventType.NodeDataChanged
                      && we.getPath().equals(path)) {
                    // 5. watch triggered
                    System.out.printf("got the event for the triggered watch\n");
                    assertThat(c.getData().forPath(path)).isEqualTo(newData);
                  }
                  latch.countDown();
                  break;
              }
            });

    // 1. create
    client.create().withMode(CreateMode.PERSISTENT).inBackground().forPath(path, data);

    latch.await();

    // 6. delete
    client.delete().forPath(path);
  }
}
```

## Curator Recipes 示例

### 选举

代码示例：https://github.com/apache/curator/tree/master/curator-examples/src/main/java/leader

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326192158.png)

### 运行测试用例

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326192413.png)

## 参考

* https://curator.apache.org/
