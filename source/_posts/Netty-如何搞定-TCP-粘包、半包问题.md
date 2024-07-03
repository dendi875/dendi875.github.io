---
title: Netty 如何搞定 TCP 粘包、半包问题
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-4-21 18:12:36
password:
summary: Netty 如何搞定 TCP 粘包、半包问题
tags: Netty
categories: Netty
---

## 什么是粘包和半包？

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321172012.png)



假如我们发送两条消息 ABC、DEF，最终接收到的消息一定先是收到ABC 后收到 DEF 吗？那是不一定的，有可能一次就全部接收完比如一次就收到了ABCDEF，也有可能分了三次接收完比如三次分别收到了 AB、CD、EF，也有可能三次分别收到了 A、BCD、EF。

前面一次接收到了两条消息的就是粘包。

后面分三次接收到了多条不完整的消息就是半包。

## 为什么 TCP 应用中会出现粘包和半包现象？

### 粘包的主要原因

*   发送方每次写入数据小于套接字缓冲区大小

    当写入数据小于套接字缓冲区大小时网卡不会立即把数据发送出去，类似寄包裹，等待把车厢装满才一次运送出去。

*   接收方读取套接字缓冲区数据不够及时

### 半包的主要原因

*   发送方写入数据大于套接字缓冲区大小，这时接收方收到的必然是半包。

*   发送的数据大于协议的 MTU（Maximum Transmission Unit，最大传输单元），必须拆包。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321173456.png)

### 换个角度看

从收发角度看：一个发送可能被多次接收，多个发送可能被一次接收。

从传输角度看：一个发送可能占用多个传输包，多个发送可能公用一个传输包。

### 根本原因

`TCP 是流式协议，消息无边界。`它像流水一样永远不间断没有边界。

UDP 像邮寄的包裹，虽然一次运输多个，但每个包裹都有“界限”，一个一个签收，所以无粘包、半包问题。

## 解决粘包和半包问题的几种常用方法

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321174021.png)

第一种方式：可以把TCP连接改成短连接，一个请求一个短连接。

第二种方式：封装成帧，它主要有三种方式：

*   固定长度：比如ABCDEF，这条消息我们可以按照三个字符长度来进行切割。
*   分割符：比如我们用\n来进行分割。
*   固定长度字段存个内容的长度信息：

第三种方式：其它方式。

## Netty 对三种常用封帧方式的支持

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321175046.png)

## 解读 Netty 处理粘包、半包的源码

*   解码核心工作流程？

    解码入口：

    ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321180008.png)

*   解码中两种数据积累器（Cumulator）的区别?

    ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240321180351.png)

*   三种解码器的常用额外控制参数有哪些？

    ```java
    FixedLengthFrameDecoder
    DelimiterBasedFrameDecoder
    LengthFieldBasedFrameDecoder
    ```

## 参考资料

*   极客时间  [《Netty 源码剖析与实战》](https://time.geekbang.org/course/intro/100036701)