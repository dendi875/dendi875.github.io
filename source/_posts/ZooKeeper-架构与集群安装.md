---
title: ZooKeeper 架构与集群安装
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-04-09 15:16:28
password:
summary: ZooKeeper 架构与集群安装
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

## ZooKeeper 总体架构

应用使用 ZooKeeper 客户端库来与 ZooKeeper 服务进行通信交互。 ZooKeeper 客户端负责和 ZooKeeper集群的交互。 ZooKeeper 集群可以有两种模式：standalone 模式和 quorum 模式。处于standalone 模式的 ZooKeeper 集群只有一个独立运行的 ZooKeeper 节点。处于 quorum模式的 ZooKeeper 集群包含多个 ZooKeeper 节点。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326152129.png)

### Session

session 是ZooKeeper 客户端中一个非常重点的概念。

* ZooKeeper 客户端库会选择 ZooKeeper 集群中某一个节点来创建一个 session。

* 客户端可以主动关闭 session。

* 如果在一段时间内客户端没有给 ZooKeeper 节点发送消息的话， ZooKeeper 节点也会关闭session。

* ZooKeeper 客户端库如果发现连接的 ZooKeeper 节点失败了，会自动的和其他 ZooKeeper 节点建立连接。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326152224.png)

### Quorum模式

处于 Quorum模式的 ZooKeeper 集群包含多个 ZooKeeper 节点。 下图的 ZooKeeper 集群有 3 个节点，其中节点 1 是 leader 节点，节点 2 和节点 3 是 follower 节点。 **leader 节点可以处理读写请求，follower 只可以处理读请求**。 follower 在接到写请求时会把写请求转发给 leader来处理。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230326152747.png)

### 数据一致性

* Zookeeper 保证全局可线性化（Linearizable）写入：先到达 leader 的写请求会被先处理，leader 决定写请求的执行顺序

* Zookeeper 保证客户端 FIFO顺序：来自给定客户端的请求按照发送顺序执行

## 安装 ZooKeeper 集群

集群模式有两种形式： 

1. 使用多台机器，在每台机器上运行一个ZooKeeper Server进程； 

2. 使用一台机器，在该台机器上运行多个ZooKeeper Server进程。

 在生产环境中，一般使用第一种形式，在练习环境中，一般使用第二种形式。

### 参数配置

1. data目录 用于存放进程运行数据。
2. data目录下的myid文件 用于存储一个数值，用来作为该ZooKeeper Server进程的标识
3. 监听Client端请求的端口号
4. 监听同ZooKeeper集群内其他Server进程通信请求的端口号
5. 监听ZooKeeper集群内“leader”选举请求的端口号，该端口号用来监听ZooKeeper集群内“leader”选举的请求。注意这个是ZooKeeper集群内“leader”的选举，跟分布式应用程序无关

参数配置注意事项： 

1. 同一个ZooKeeper集群内，不同ZooKeeper Server进程的标识需要不一样，即myid文件内的值需要不一样 
2. 采用上述第2种形式构建ZooKeeper集群，需要注意“目录，端口号”等资源的不可共享性，如果共享会导致ZooKeeper Server进程不能正常运行，比如“data目录，几个监听端口号”都不能被共享

配置列表：

| myid | Data目录                                                     | Client | 用于与其它节点进行通信的端口 | 用于Leader选举的端口 | 配置文件                                                     |
| ---- | ------------------------------------------------------------ | ------ | ---------------------------- | -------------------- | ------------------------------------------------------------ |
| 1    | ~/Downloads/my_software/apache-zookeeper-3.5.5-bin/data/zookeeper1 | 2181   | 2881                         | 3881                 | ~/Downloads/my_software/apache-zookeeper-3.5.5-bin/conf/zoo1.cfg |
| 2    | ~/Downloads/my_software/apache-zookeeper-3.5.5-bin/data/zookeeper2 | 2182   | 2882                         | 3882                 | ~/Downloads/my_software/apache-zookeeper-3.5.5-bin/conf/zoo2.cfg |
| 3    | ~/Downloads/my_software/apache-zookeeper-3.5.5-bin/data/zookeeper3 | 2183   | 2883                         | 3883                 | ~/Downloads/my_software/apache-zookeeper-3.5.5-bin/conf/zoo3.cfg |

### 验证 Java 安装

```bash
$ java -version
java version "1.8.0_211"
Java(TM) SE Runtime Environment (build 1.8.0_211-b12)
Java HotSpot(TM) 64-Bit Server VM (build 25.211-b12, mixed mode)
```

### 下载 ZooKeeper

要在您的计算机上安装 ZooKeeper ，请访问以下链接并下载最新版本的 ZooKeeper。 http://zookeeper.apache.org/releases.html ，下载我们想要的版本，这里我使用的是 apache-zookeeper-3.5.5-bin.tar.gz。

1. 提取 tar 文件，使用以下命令提取 tar 文件：

   ```bash
   $ cd ~/Downloads/my_software
   
   $ tar -zxf apache-zookeeper-3.5.5-bin.tar.gz
   
   $ cd apache-zookeeper-3.5.5-bin
   ```

2. 创建数据存储文件夹

   ```bash
   $ mkdir -p data/{zookeeper1,zookeeper2,zookeeper3}
   ```

3. 在 config 目录下创建配置文件

   `vi conf/zoo1.cfg` 内容如下：

   ```bash
   tickTime = 2000
   dataDir=./data/zookeeper1
   clientPort=2181
   initLimit=10
   syncLimit=5
   server.1=localhost:2881:3881
   server.2=localhost:2882:3882
   server.3=localhost:2883:3883
   ```

   `vi conf/zoo2.cfg` 内容如下：

   ```bash
   tickTime = 2000
   dataDir=./data/zookeeper2
   clientPort=2182
   initLimit=10
   syncLimit=5
   server.1=localhost:2881:3881
   server.2=localhost:2882:3882
   server.3=localhost:2883:3883
   ```

   `vi conf/zoo3.cfg` 内容如下：

   ```bash
   tickTime = 2000
   dataDir=./data/zookeeper3
   clientPort=2183
   initLimit=10
   syncLimit=5
   server.1=localhost:2881:3881
   server.2=localhost:2882:3882
   server.3=localhost:2883:3883
   ```

4. 创建myid

   这个文件里的内容就是zookeeper的编号

   ```bash
   $ echo 1 > data/zookeeper1/myid
   $ echo 2 > data/zookeeper2/myid
   $ echo 3 > data/zookeeper3/myid
   ```

### 启动 ZooKeeper

```bash
# 进入安装目录
$ cd ~/Downloads/my_software/apache-zookeeper-3.5.5-bin

# 启动集群--后台运行模式
$ ./bin/zkServer.sh start ./conf/zoo1.cfg
$ ./bin/zkServer.sh start ./conf/zoo2.cfg
$ ./bin/zkServer.sh start ./conf/zoo3.cfg

# 启动集群--前台运行模式
$ ./bin/zkServer.sh start-foreground ./conf/zoo1.cfg
$ ./bin/zkServer.sh start-foreground ./conf/zoo2.cfg
$ ./bin/zkServer.sh start-foreground ./conf/zoo3.cfg

#  start-foreground 选项的意思是在前台运行，把日志直接打到 console。如果把日志打到文件的话，这三个 zkServer.sh会把日志打到同一个文件。
```

检查端口是否在监听：

```bash
$ lsof -i:2181
$ lsof -i:2182
$ lsof -i:2183
```

### 停止 ZooKeeper

```bash
# 进入安装目录
$ cd ~/Downloads/my_software/apache-zookeeper-3.5.5-bin

$ ./bin/zkServer.sh stop ./conf/zoo1.cfg 
$ ./bin/zkServer.sh stop ./conf/zoo2.cfg 
$ ./bin/zkServer.sh stop ./conf/zoo3.cfg 
```

### 查看群集状态

```bash
# 进入安装目录
$ cd ~/Downloads/my_software/apache-zookeeper-3.5.5-bin

$ ./bin/zkServer.sh status ./conf/zoo1.cfg  
$ ./bin/zkServer.sh status ./conf/zoo2.cfg  
$ ./bin/zkServer.sh status ./conf/zoo3.cfg  
```

### zkCli 演示

```bash
# 进入安装目录
$ cd ~/Downloads/my_software/apache-zookeeper-3.5.5-bin

# 使用 zkCli 连接单个
$ ./bin/zkCli.sh -server 127.0.0.1:2181

# 使用 zkCli 连接单个
./bin/zkCli.sh -server 127.0.0.1:2181,127.0.0.1:2182,127.0.0.1:2183
```

输入以下命令：

* help

* ls  -R /

  ```bash
  [zk: 127.0.0.1:2181(CONNECTED) 1] ls -R /
  /
  /zookeeper
  /zookeeper/config
  /zookeeper/quota
  ```

* create /app1

  ```bash
  [zk: 127.0.0.1:2181(CONNECTED) 2] create /app1
  Created /app1
  ```

* create /app2

  ```bash
  [zk: 127.0.0.1:2181(CONNECTED) 3] create /app2
  Created /app2
  ```

* create /app1/p_1 1 

  ```bash
  [zk: 127.0.0.1:2181(CONNECTED) 5] create /app1/p_1 1
  Created /app1/p_1
  ```

* create /app1/p_2 2 

  ```bash
  [zk: 127.0.0.1:2181(CONNECTED) 6] create /app1/p_2 2
  Created /app1/p_2
  ```

* ls -R /

  ```bash
  [zk: 127.0.0.1:2181(CONNECTED) 7] ls -R /
  /
  /app1
  /app2
  /zookeeper
  /app1/p_1
  /app1/p_2
  /zookeeper/config
  /zookeeper/quota
  ```

## 实现一个锁

分布式锁要求如果锁的持有者宕机了，锁可以被释放。ZooKeeper 的 ephemeral（临时） 节点恰好具备这样的特性。

如下图所示启用两个终端，第一个终端使用`create -e`创建一个临时的 znode，第二个终端来对同一个节点加锁，加锁实际上就是创建 znode，会发现第二个终端加锁失败，然后使用 `stat` 来监控 znode，其实就是等待锁被释放，接着退出第一个终端，然后第二个终端会收到一个 Watch 事件，在收到事件之后再尝试加锁，这时加锁就成功了。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230323210835.png)

## 参考

* https://zookeeper.apache.org/doc/r3.5.5/zookeeperStarted.html