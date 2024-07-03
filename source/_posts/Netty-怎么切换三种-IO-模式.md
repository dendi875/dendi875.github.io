---
title: Netty 怎么切换三种 I/O 模式
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-03-21 14:49:00
password:
summary:  Netty 怎么切换三种 I/O 模式
tags: Netty
categories: Netty
---

## 什么是经典的三种 I/O 模式

生活场景，当我们去饭店吃饭时：

*   食堂排队打饭模式：排队在窗口，打好才走
*   点单、等待被叫模式：等待被叫，好了自己去端
*   包厢模式：点单后菜直接被端上桌

类比：

*   饭店 -> 服务器

*   饭菜-> 数据

*   好了-> 数据就绪

*   端菜 /送菜 -> 数据读取

| 类似模式           |       I/O模型        | JDK支持                                |
| ------------------ | :------------------: | -------------------------------------- |
| 排除打饭模式       |  BIO（阻塞同步I/O）  | JDK 1.4 之前引入                       |
| 点单、等待被叫模式 | NIO（非阻塞同步I/O） | JDK1.4（2002 年，java.nio 包）之后引入 |
| 包厢模式           | AIO（非阻塞异步I/O） | JDK1.7 （2011 年） 之后引入            |

### 阻塞与非阻塞

*   菜没好，要不要死等 -> 数据就绪前要不要等待？

*   阻塞：没有数据传过来时，读会阻塞直到有数据；缓冲区满时，写操作也会阻塞。非阻塞遇到这些情况，都是直接返回。

### 同步与异步

*   菜好了，谁端 -> 数据就绪后，数据操作谁完成？

*   数据就绪后需要自己去读是同步，数据就绪直接读好再回调给程序是异步。

## Netty 对 Java 三种  I/O 模式的支持

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321114607.png)

Netty 对 BIO、NIO、AIO 曾经都支持，BIO 在 Netty 就是对应 OIO，而对 NIO 有多种实现。

## 为什么Netty仅支持 NIO 了？

*   为什么不建议（deprecate）阻塞 I/O（BIO/OIO）?
    *   连接数高的情况下：阻塞 -> 耗资源、效率低。阻塞就意味着等待，等待就会占用一个线程，而在连接数高的情况下，所有请求都在等待的话就会占用大量资源，会把系统资源耗尽。

*    为什么删掉已经做好的 AIO 支持？
    *   Windows 实现成熟，但是很少用来做服务器。
    *   Linux 常用来做服务器，但是 AIO 实现不够成熟。
    *   Linux 下 AIO 相比较 NIO 的性能提升不明显 。

## 为什么 Netty 有多种 NIO 实现？

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321115238.png)

COMMON 对应通应用的实现，后面两种对应不同平台的实现。通用的 NIO 实现（Common）在 Linux 下也是使用 epoll，为什么自己单独实现？

因为Netty它认为它能实现得更好！比如：

*   Netty 暴露了更多的可控参数，例如：
    *   JDK 的 NIO 默认实现是水平触发 
    *   Netty 是边缘触发（默认）和水平触发可切换

*   Netty 实现的垃圾回收更少、性能更好

## NIO 一定优于 BIO 么？

*   BIO 代码简单。

*   特定场景：连接数少，并发度低，BIO 性能不输 NIO。

## 源码解读 Netty 怎么切换 I/O 模式？

1.   怎么切换？

从 NIO 切换到 OIO，因为它的命名风格是统一的，也方便记忆。

对于服务器开发：它的切换要变更两个地方：

第一个地方：变更 EventLoopGroup 它对应开发模式

第二个地方：变更 channel 它对应不同的I/O模式

不需要换 SocketChannel，因为 ServerSocketChannel 负责帮我们创建所对应的 子SocketChannel

| NIO                        | OIO                        |
| -------------------------- | -------------------------- |
| Nio**EventLoopGroup**      | Oio**EventLoopGroup**      |
| Nio**ServerSocketChannel** | Oio**ServerSocketChannel** |

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321141823.png)

2.   原理是什么？

例如对于 ServerSocketChannel：工厂模式+泛型+反射实现

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321142329.png)

3.   为什么服务器开发并不需要切换客户端对应 Socket ？

以 NioServerSocketChannel 为例，在 doReadMessages 方法中它的 SocketChannel 的创建由 ServerSocketChannel 负责创建对应的 SocketChannel 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321144003.png)

所以在开发服务器时是不需要切换 SocketChannel 

## 参考资料

*   极客时间  [《Netty 源码剖析与实战》](https://time.geekbang.org/course/intro/100036701)