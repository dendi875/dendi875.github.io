---
title: Netty-如何支持三种-Reactor
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-03-21 18:59:55
password:
summary:  Netty-如何支持三种-Reactor
tags: Netty
categories: Netty
---

# Netty-如何支持三种-Reactor

## Netty Reactor 工作架构

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/netty-29.png)

架构说明：

1.   Netty 抽象出两组线程池 BossGroup 专门负责接收客户端的连接，WorkerGroup 专门负责网络的读写
2.   BossGroup 和 WorkerGroup 类型都是 NioEventLoopGroup
3.   NioEventLoopGroup 相当于一个事件循环组，这个组中含有多个事件循环，每一个事件循环是 NioEventLoop
4.   NioEventLoop 表示一个不断循环执行处理任务的线程，每个 NioEventLoop 都有一个 Selector，用于监听绑定在其上的 socket 的网络通讯，NioEventLoop 内部采用串行化设计，从消息的 **读取->解码->处理->编码->发送**，始终由 IO 线程 NioEventLoop 负责
5.   NioEventLoopGroup 可以有多个线程，即可以含有多个 NioEventLoop
     *   每个 NioEventLoop 中包含有一个 Selector，一个 taskQueue
     *   每个 NioEventLoop 的 Selector 上可以注册监听多个 NioChannel
     *   每个 NioChannel 只会绑定在唯一的 NioEventLoop 上
     *   每个 NioChannel 都绑定有一个自己的 ChannelPipeline
6.   每个 BossNioEventLoop 循环执行的步骤有 3 步
     *   轮询 accept 事件
     *   处理 accept 事件，与 client 建立连接，生成 NioScocketChannel，并将其注册到某个 worker NIO-EventLoop 上的 Selector
     *   处理任务队列的任务，即 runAllTasks
7.   每个 Worker NIOEventLoop 循环执行的步骤
     *   轮询 read，write 事件
     *   处理 I/O 事件，即 read，write 事件，在对应 NioScocketChannel 处理
     *   处理任务队列的任务，即 runAllTasks
8.   每个 Worker NIOEventLoop 处理业务时，会使用 pipeline（管道），pipeline 中包含了 channel，即通过 pipeline 可以获取到对应通道，管道中维护了很多的处理器

## 如何在 Netty 中使用 Reactor 模式

| Reactor 三种模式          | 代码                                                         | 说明                                                         |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Reactor 单线程模式        | EventLoopGroup eventGroup = new NioEventLoopGroup(**1**);<br/>ServerBootstrap serverBootstrap = new ServerBootstrap();<br/>serverBootstrap.group(eventGroup); | new NioEventLoopGroup(**1**)，<br/>设置成1，那它就有一个线程 |
| 非主从 Reactor 多线程模式 | EventLoopGroup eventGroup = new NioEventLoopGroup();<br/>ServerBootstrap serverBootstrap = new ServerBootstrap();<br/>serverBootstrap.group(eventGroup); | new NioEventLoopGroup(); <br/>不设置值的话，netty 框架内部会根据CPU核心数帮我们计算出一个最优的线程数 |
| 主从 Reactor 多线程模式   | EventLoopGroup bossGroup = new NioEventLoopGroup();<br/>EventLoopGroup workerGroup = new NioEventLoopGroup(); <br/>ServerBootstrap serverBootstrap = new ServerBootstrap();<br/>serverBootstrap.group(bossGroup, workerGroup); | bossGroup 相当于接受连接， <br/>bossGroup 把接受到的活分配给workerGroup 来干，serverBootstrap.group(bossGroup, workerGroup); |

## Netty 快速入门实例 TCP 服务

实例要求：

1.  `Netty` 服务器在 `6668` 端口监听，客户端能发送消息给服务器"hello, server"
2.  服务器可以回复消息给客户端"hello, client"
3.  目的：对 `Netty` 线程模型有一个初步认识，便于理解 `Netty` 模型理论

代码如下：https://github.com/dendi875/netty-study/tree/master/src/main/java/com/zq/netty/simple

## Netty 快速入门实例  HTTP 服务

实例要求：

1.  `Netty` 服务器在 `36668` 端口监听，浏览器发出请求 `http://localhost:36668/`
2.  服务器可以回复消息给客户端"I am a server", 并对特定请求资源进行过滤。
3.  目的：`Netty` 可以做 `Http` 服务开发，并且理解 `Handler` 实例和客户端及其请求的关系。

代码如下：https://github.com/dendi875/netty-study/tree/master/src/main/java/com/zq/netty/http

## 源码解析 Netty 对 Reactor 模式支持的常见疑问

*   Netty 如何支持主从 Reactor 模式的？

    以 EchoServer 为例：

    ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321210429.png)

    ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/netty-9.png)

    ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321163602.png)

*   为什么说 Netty 的 main reactor 大多并不能用到一个线程组，只能用到线程组里面的一个？

*   Netty 给 Channel 分配 NIO event loop 的规则是什么

*   通用模式的 NIO 实现多路复用器是怎么跨平台的

    ```java
    NioEventLoopGroup#NioEventLoopGroup(int nThreads, Executor executor)
      
    SelectorProvider#provider()
    ```

    *   https://github.com/frohoff/jdk8u-jdk/blob/master/src/solaris/classes/sun/nio/ch/DefaultSelectorProvider.java
    *   https://github.com/frohoff/jdk8u-jdk/blob/master/src/windows/classes/sun/nio/ch/DefaultSelectorProvider.java
    *   https://github.com/frohoff/jdk8u-jdk/blob/master/src/macosx/classes/sun/nio/ch/DefaultSelectorProvider.java

## 参考资料

*   极客时间  [《Netty 源码剖析与实战》](https://time.geekbang.org/course/intro/100036701)