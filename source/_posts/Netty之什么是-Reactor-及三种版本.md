---
title: Netty 之什么是 Reactor 及三种版本
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-03-21 15:59:55
password:
summary:  Netty 之什么是 Reactor 及三种版本
tags: Netty
categories: Netty
---
# Netty之什么是 Reactor 及三种版本

以生活中的饭店规模变化为例子：

1.   饭店刚起步：一个人包揽所有工作：迎宾、点菜、做饭、上菜、送客等；
2.   饭店有稳定了：多招几个人大家一起做上面的事情，哪里缺人谁有空谁就去做；
3.   饭店到一定规模了：老板觉得饭店迎宾很重要，因为只要把客人招呼到店里，生意就成了，就决定搞一个或者多个人专门做迎宾；

以上生活场景的类比：

*   饭店伙计：线程

*   迎宾工作：接入连接

*   点菜：请求
    *    一个人包揽所有：迎宾、点菜、做饭、上菜、送客等 -> **Reactor 单线程**
    *   多招几个伙计：大家一起做上面的事情 -> **Reactor 多线程模式**
    *   进一步分工：搞一个或者多个人专门做迎宾 -> 现在最流行的**主从 Reactor 多线程模式**

*   做菜：业务处理

*   上菜：响应

*   送客：断连

我们知道有三种 I/O 模式它就对应三种开发模式：

| BIO                   | NIO                                                   | AIO      |
| --------------------- | ----------------------------------------------------- | -------- |
| Thread-Per-Connection | Reactor（单线程、单Reactor多线程、主从Reactor多线程） | Proactor |

Reactor 是一种开发模式，模式的核心流程是：**注册感兴趣的事件 -> 扫描是否有感兴趣的事件发生 -> 事件发生后做出相应的处理。**

对应每一种 SocketChannel 它监听的事件不同：

比如对应客户端来说：它监听连接、读、写三种事件，服务器端而言的 ServerSocketChannel 它监听接收新连接事件（类似饭店迎宾），服务器端的 SocketChannel 它主要负责和客户端交互，它监听读写事件。

| client/server | SocketChannel/ServerSocketChannel | OP_ACCEPT（接收新连接） | OP_CONNECT（连接） | OP_WRITE（读） | OP_READ（写） |
| ------------- | --------------------------------- | ----------------------- | ------------------ | -------------- | ------------- |
| client        | SocketChannel                     |                         | Y                  | Y              | Y             |
| server        | ServerSocketChannel               | Y                       |                    |                |               |
| server        | SocketChannel                     |                         |                    | Y              | Y             |

## Reactor 三种模式的解释

### Thread-Per-Connection 模式

我们先看一下 BIO 这种I/O所对应的开发模式，它的名称叫 Thread-Per-Connection 模式：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321152722.png)

因为 BIO 它是阻塞的，所以每个请求对应一个线程，每个线程都进行 read（读）、decode（解码）、compute（计算）、encode（编码）、send（响应） 的处理。

Thread-Per-Connection 模式的代码示例：

https://github.com/dendi875/netty-study/blob/master/src/main/java/com/zq/bio/BIOServer.java

### Reactor 单线程模式

Reactor 单线程模式所有的事情：接受连接、操作读写、注册事件、扫描事件等等都是这一个线程在处理。因为所有的事都是这一个线程在处理，如果这一个线程挂了那么整个系统也就挂了。所以这种设计就得想办法改进，把单线程变成多线程，就有了 Reactor 多线程模式。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240327101627.png)

*   方案说明
    1.   `Select` 是前面 `I/O` 复用模型介绍的标准网络编程 `API`，可以实现应用程序通过一个阻塞对象监听多路连接请求
    2.   `Reactor` 对象通过 `Select` 监控客户端请求事件，收到事件后通过 `Dispatch` 进行分发
    3.   如果是建立连接请求事件，则由 `Acceptor` 通过 `Accept` 处理连接请求，然后创建一个 `Handler` 对象处理连接完成后的后续业务处理
    4.   如果不是建立连接事件，则 `Reactor` 会分发调用连接对应的 `Handler` 来响应
    5.   `Handler` 会完成 `Read` → 业务处理 → `Send` 的完整业务流程

*   优缺点
    *   优点：
        *   模型简单，没有多线程、进程通信、竞争的问题，全部都在一个线程中完成
    *   缺点：
        *   性能问题，只有一个线程，无法完全发挥多核 `CPU` 的性能。`Handler`在处理某个连接上的业务时，整个进程无法处理其他连接事件，很容易导致性能瓶颈
        *   可靠性问题，线程意外终止，或者进入死循环，会导致整个系统通信模块不可用，不能接收和处理外部消息，造成节点故障

*   使用场景：客户端的数量有限，业务处理非常快速，比如 `Redis` 在业务处理的时间复杂度 `O(1)` 的情况

*   总结：服务器端用一个线程通过多路复用搞定所有的 `IO` 操作（包括连接，读、写等），编码简单，清晰明了，但是如果客户端连接数量较多，将无法支撑。

*   Reactor 单线程模式的代码示例：

https://github.com/dendi875/netty-study/blob/master/src/main/java/com/zq/nio/server_client/GroupChatServer.java

https://github.com/dendi875/netty-study/blob/master/src/main/java/com/zq/nio/server_client/GroupChatClient.java

### 单 Reactor 多线程

单 Reactor 多线程模式它认为 decode、compute、encode 这三个操作比较耗时，它就把这三个操作放到一个线程池里来做，这样效率明显就比单线程好很多。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240327104531.png)

*   方案说明
    1.   `Reactor` 对象通过 `Select` 监控客户端请求事件，收到事件后，通过 `Dispatch` 进行分发
    2.   如果建立连接请求，则由 `Acceptor` 通过 `accept` 处理连接请求，然后创建一个 `Handler` 对象处理完成连接后的各种事件
    3.   如果不是连接请求，则由 `Reactor` 分发调用连接对应的 `handler` 来处理
    4.   `handler` 只负责响应事件，不做具体的业务处理，通过 `read` 读取数据后，会分发给后面的 `worker` 线程池的某个线程处理业务
    5.   `worker` 线程池会分配独立线程完成真正的业务，并将结果返回给 `handler`
    6.   `handler` 收到响应后，通过 `send` 将结果返回给 `client`
*   优缺点
    *   可以充分的利用多核 `cpu` 的处理能力
    *   多线程数据共享和访问比较复杂，`Reactor` 处理所有的事件的监听和响应，在单线程运行，在高并发场景容易出现性能瓶颈。

### 主从 Reactor 多线程模式

 主从 Reactor多线程模式是现在最流行的模式，对于服务器来说它把接受连接这种最重要的事专门交给一个线程来做。它会把 accept 事件单独注册到一个叫 mainReactor 里，类似饭店专门搞几个服务员在门外做迎宾一样。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240327105817.png)

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321155545.png)

*   方案说明
    1.   `Reactor` 主线程 `MainReactor` 对象通过 `select` 监听连接事件，收到事件后，通过 `Acceptor` 处理连接事件
    2.   当 `Acceptor` 处理连接事件后，`MainReactor` 将连接分配给 `SubReactor`
    3.   `Subreactor` 将连接加入到连接队列进行监听，并创建 `handler` 进行各种事件处理
    4.   当有新事件发生时，`Subreactor` 就会调用对应的 `handler` 处理
    5.   `handler` 通过 `read` 读取数据，分发给后面的 `worker` 线程处理
    6.   `worker` 线程池分配独立的 `worker` 线程进行业务处理，并返回结果
    7.   `handler` 收到响应的结果后，再通过 `send` 将结果返回给 `client`
    8.   `Reactor` 主线程可以对应多个 `Reactor` 子线程，即 `MainRecator` 可以关联多个 `SubReactor`

*   优缺点

    *   优点：父线程与子线程的数据交互简单职责明确，父线程只需要接收新连接，子线程完成后续的业务处理

    *   缺点：编程复杂度较高

## Reactor 模式小结

三种模式用生活案例来理解：

*   单 `Reactor` 单线程，饭店迎宾员和服务员是同一个人，全程为顾客服务
*   单 `Reactor` 多线程，`1` 个饭店迎宾员，多个服务员，迎宾员只负责接待
*   主从 `Reactor` 多线程，多个饭店迎宾员，多个服务员

Reactor 模式具有如下的优点：

*   响应快，不必为单个同步事件所阻塞，虽然 `Reactor` 本身依然是同步的
*   可以最大程度的避免复杂的多线程及同步问题，并且避免了多线程/进程的切换开销
*   扩展性好，可以方便的通过增加 `Reactor` 实例个数来充分利用 `CPU` 资源
*   复用性好，`Reactor` 模型本身与具体事件处理逻辑无关，具有很高的复用性

## 参考资料

*   极客时间  [《Netty 源码剖析与实战》](https://time.geekbang.org/course/intro/100036701)
*   https://dongzl.github.io/netty-handbook