---
title: ZooKeeper 的监控
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-04-28 10:37:49
password:
summary: ZooKeeper 的监控
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

ZooKeeper 服务可以通过两种主要方式之一进行监控

* 通过使用 The Four Letter Words（ 4 个字母单词）
* JMX 的命令端口

## The Four Letter Words

四个字母单词即一组检查Zookeeper节点状态的命令。 每个命令由四个字母组成。 可以在客户端端口通过`telnet` 或 `nc` 向 ZooKeeper 发出命令。

官方文档指出：四个字母的单词在使用前需要明确列入白名单。 具体请参考 https://zookeeper.apache.org/doc/r3.5.5/zookeeperAdmin.html#sc_clusterOptions。 四字母单词在未来将被弃用，请改用 [AdminServer](https://zookeeper.apache.org/doc/r3.5.5/zookeeperAdmin.html#sc_adminserver)。

下面演示下四个字母的命令。

1. 修改配置文件启用所有四个字母的单词命令：

    vi conf/zoo1.cfg

   ```javascript
   tickTime = 2000
   dataDir=./data/zookeeper1
   clientPort=2181
   initLimit=10
   syncLimit=5
   server.1=localhost:2881:3881
   server.2=localhost:2882:3882
   server.3=localhost:2883:3883
   4lw.commands.whitelist=*  #增加这一行
   ```

2. 重启 ZooKeeper

3. 命令的使用

* 测试连通性

  ```bash
  echo ruok | nc localhost 2181
  ```

* *conf*: 打印有关服务配置的详细信息

  ```bash
  echo conf  | nc localhost 2181
  ```

* *stat*: 列出服务器和连接的客户端的简要详细信息

  ```bash
  echo stat  | nc localhost 2181
  ```

* *dump*: 查看临时节点的信息

  * 连接到 ZooKeeper 服务端

    ```bash
    ./bin/zkCli.sh -server 127.0.0.1:2181
    ```

  * 创建一个临时节点

    ```bash
    create -e /lock
    ```

  * 查看临时节点

    ```bash
    echo dump  | nc localhost 2181
    SessionTracker dump:
    Global Sessions(1):
    0x1001e04b9a40000	30000ms
    ephemeral nodes dump:
    Sessions with Ephemerals (1):
    0x1001e04b9a40000:
    	/lock
    Connections dump:
    Connections Sets (4)/(2):
    0 expire at Wed Apr 05 17:24:39 CST 2023:
    1 expire at Wed Apr 05 17:24:49 CST 2023:
    	ip: /0:0:0:0:0:0:0:1:62200 sessionId: 0x0
    0 expire at Wed Apr 05 17:24:59 CST 2023:
    1 expire at Wed Apr 05 17:25:09 CST 2023:
    	ip: /127.0.0.1:59202 sessionId: 0x1001e04b9a40000
    ```

* *wchs*:  查看 watch 信息

  * 连接到 ZooKeeper 服务端

    ```bash
    ./bin/zkCli.sh -server 127.0.0.1:2181
    ```

  * 注册一个watch

    ```bash
    [zk: 127.0.0.1:2181(CONNECTED) 1] get -w /lock
    null
    ```

  * 查看 watch

    ```bash
    echo wchc  | nc localhost 2181
    0x1001e04b9a40000
    	/lock
    ```

更多的命令请查看官方文档：https://zookeeper.apache.org/doc/r3.5.5/zookeeperAdmin.html#sc_zkCommands

## JXM

https://zookeeper.apache.org/doc/r3.5.5/zookeeperJMX.html

ZooKeeper 很好的支持了 JMX，大量的监控和管理工作都可以通过 JMX 来做。可以把 ZooKeeper 的 JMX 数据集成到 Prometheus，使用 Prometheus 来做 ZooKeeper 的监控。

下面演示下如何使用 JMX。

* 运行 JMX console:

  Java JDK 附带一个名为 jconsole 命令，它可用于连接到 ZooKeeper 进行一行简的单查看和管理。

  ```bash
  jconsole
  ```

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230405174515.png)

​  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230405174900.png)

## 参考

* https://zookeeper.apache.org/doc/r3.5.5/zookeeperAdmin.html#sc_monitoring
* https://zookeeper.apache.org/doc/r3.5.5/zookeeperAdmin.html#sc_clusterOptions
* https://zookeeper.apache.org/doc/r3.5.5/zookeeperAdmin.html#sc_adminserver
* https://zookeeper.apache.org/doc/r3.5.5/zookeeperJMX.html