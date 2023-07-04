---
title: MongoDB 复制集
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-02-06 16:54:07
password:
summary: MongoDB 复制集
tags:
	- MongoDB
	- NoSQL
categories: MongoDB
---

## 复制集机制及原理

### 复制集的作用

* MongoDB 复制集的主要意义在于实现服务高可用，它的现实依赖于两个方面的功能：
  * 数据写入时将数据迅速复制到另一个独立的节点上
  * 在接受写入的节点发生故障时自动选举出一个新的替代节点
* 在实现高可用的同时，复制集实现了其他几个附加作用：
  * 数据分发：将数据从一个区域复制到另一个区域，减少另一个区域的读延迟
  * 读写分离：不同类型的压力分别在不同的节点上执行
  * 异地容灾：在数据中心故障的时候快速切换到异地

### 典型复制集结构

一个典型的复制集由 3 个以上具有投票权的节点组成，包括：

* 一个主节点（PRIMARY）：接受写入操作和选举时投票
* 两个（或多个）从节点（SECONDARY）：复制主节点上的新数据和选举时投票
* 不推荐使用 Arbiter（投票节点）
  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221117172953.png)

### 数据是如何复制的？

* 当一个修改操作，无论是插入、更新或删除，到达主节点时，它对数据的操作将被记录下来（经过一些必要的转换），这些记录称为 `oplog`。

* 从节点通过在主节点上打开一个 `tailable` 游标不断获取新进入主节点的 `oplog`，并在自己的数据上回放，以此保持跟主节点的数据一致。

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221117173246.png)

### 通过选举完成故障恢复

* 具有投票权的节点之前两两互相发送心跳
* 当 5 次心跳未收到时判断为节点失联
* 如果失联的是主节点，从节点会发起选举，选出新的主节点
* 如果失联的是从节点则不会产生新的选举
* 选举基于[RAFT一致性算法](https://raft.github.io/)实现，选举成功的必要条件是大多数投票节点存活
* 复制集中最多可以有 50 个节点，但具有投票权的节点最多 7 个

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221117181631.png)

### 影响选举的因素

* 整个集群中必须有大多数节点存活
* 被选举为主节点的节点必须满足：
  * 能够与多数节点建立连接
  * 具有较新的 `oplog`
  * 具有较高的优先级（如果有配置）

### 常见选项

复制集在部署的时候有以下常见的选项可以进行配置：

* 是否具有投票权（v 参数）：有则参与投票
* 优先级（priority 参数）：优先级越高的节点越优先成为主节点。优先级为0的节点无法成为主节点
* 隐藏（hidden 参数）：复制数据，但对应用不可见。隐藏节点可以具有投票权，但优先级必须为0
* 延迟（slaveDelay 参数）：复制 n 秒之前的数据，保持与主节点的时间差

### 复制集注意事项

* 关于硬件
  * 因为正常的复制集节点都有可能成为主节点，它们的地位是一样的，因此硬件配置上必须一致
  * 为了保证节点不会同时宕机，各节点使用的硬件必须具有独立性
* 关于软件
  * 复制集各节点软件版本必须一致，以避免出现不可预知的问题
* 增加节点不会增加系统写性能

## 搭建 MongoDB 复制集

我们通过在一台机器上运行 3 个实例来搭建一个最简单的复制集，并对复制集运行参数做一些常规调整。

### 准备工作

* 安装最新的 MongoDB 版本
* Windows 系统请事先配置好 MongoDB 可执行文件的环境变量
* Linux 和 Mac 系统请配置 PATH 变量 
* 确保有 10GB 以上的硬盘空间

### 创建数据目录

MongoDB 启动时将使用一个数据目录存放所有的数据文件。我们将为3个复制集节点创建各自的数据目录。

Linux/MacOS：

```bash
mkdir -p /data/db{1,2,3}
```

Windows：

```bash
md c:\data\db1
md c:\data\db2
md c:\data\db3
```

### 准备配置文件

复制集的每个` mongod` 进程应该位于不同的服务器。我们现在在一台机器上运行 3 个进程，因此要为它们各自配置：

*  不同的端口。示例中将使用 28017、28018、28019。

* 不同的数据目录。示例中将使用：

  ```bash
  /data/db1 或 md c:\data\db1
  /data/db2 或 md c:\data\db2
  /data/db3 或 md c:\data\db3
  ```

* 不同日志文件路径。示例中将使用：

  ```bash
  /data/db1/mongod.log 或 c:\data\db1\mongod.log
  /data/db2/mongod.log 或 c:\data\db1\mongod.2og
  /data/db3/mongod.log 或 c:\data\db1\mongod.3og
  ```

  这些配置文件标准格式如下，请修改必要的参数完成3个实例各自的配置文件：

  Linux/MacOS：

  ```yaml
  # /data/db1/mongod.conf
  systemLog:
    destination: file
    path: /data/db1/mongod.log   # 日志文件路径
    logAppend: true
  storage:
    dbPath: /data/db1    # 数据目录
  net:
    bindIp: 0.0.0.0
    port: 28017   # 端口
  replication:
    replSetName: rs0
  processManagement:
    fork: true
  ```

  Windows：

  ```yaml
  # c:\data1\mongod.conf
  systemLog:
    destination: file
    path: c:\data\db1\mongod.log   # 日志文件路径
    logAppend: true
  storage:
    dbPath: c:\data\db1    # 数据目录
  net:
    bindIp: 0.0.0.0
    port: 28017   # 端口
  replication:
    replSetName: rs0
  ```

### 执行进程

Linux/Mac:

```bash
mongod -f /data/db1/mongod.conf
mongod -f /data/db2/mongod.conf
mongod -f /data/db3/mongod.conf
```

注意：如果启用了SELinux，可能阻止上述进程启动。简单起见请关闭SELinux。

Windows:

```cmd
mongod -f c:\data\db1\mongod.conf
mongod -f c:\data\db2\mongod.conf
mongod -f c:\data\db3\mongod.conf
```

因为Windows不支持fork，以上命令需要在3个不同的窗口执行，执行后不可关闭窗口否则进程将直接结束。

确认  mongod 进程已经在运行：

```bash
$ ps -elf | grep mongod
  501 36106     1        4   0  31  0  6625980  37540 -      S                   0 ??         0:00.78 mongod -f /data/  5:30下午
  501 36140     1        4   0  31  0  6896316  36560 -      S                   0 ??         0:00.77 mongod -f /data/  5:30下午
  501 36153     1        4   0  31  0  6608572  33468 -      S                   0 ??         0:00.79 mongod -f /data/  5:30下午
```

### 配置复制集

进入mongo shell，习惯把第一个节点做为主节点:

```bash
mongo --port 28017
```

创建复制集，默认是`rs0:SECONDARY`按回车变成 `rs0:PRIMARY`

```bash
rs0:PRIMARY> rs.initiate({
    _id: "rs0",
    members: [{
        _id: 0,
        host: "localhost:28017"
    },{
        _id: 1,
        host: "localhost:28018"
    },{
        _id: 2,
        host: "localhost:28019"
    }]
})
```

查看复制集状态：

```bash
rs0:PRIMARY> rs.status()
{
        "set" : "rs0",
        "date" : ISODate("2022-11-18T09:40:36.308Z"),
        "myState" : 1,
        "term" : NumberLong(1),
        "syncingTo" : "",
        "syncSourceHost" : "",
        "syncSourceId" : -1,
        "heartbeatIntervalMillis" : NumberLong(2000),
        "majorityVoteCount" : 2,
        "writeMajorityCount" : 2,
        "optimes" : {
                "lastCommittedOpTime" : {
                        "ts" : Timestamp(1668764430, 1),
                        "t" : NumberLong(1)
                },
                "lastCommittedWallTime" : ISODate("2022-11-18T09:40:30.507Z"),
                "readConcernMajorityOpTime" : {
                        "ts" : Timestamp(1668764430, 1),
                        "t" : NumberLong(1)
                },
                "readConcernMajorityWallTime" : ISODate("2022-11-18T09:40:30.507Z"),
                "appliedOpTime" : {
                        "ts" : Timestamp(1668764430, 1),
                        "t" : NumberLong(1)
                },
                "durableOpTime" : {
                        "ts" : Timestamp(1668764430, 1),
                        "t" : NumberLong(1)
                },
                "lastAppliedWallTime" : ISODate("2022-11-18T09:40:30.507Z"),
                "lastDurableWallTime" : ISODate("2022-11-18T09:40:30.507Z")
        },
        "lastStableRecoveryTimestamp" : Timestamp(1668764390, 1),
        "lastStableCheckpointTimestamp" : Timestamp(1668764390, 1),
        "electionCandidateMetrics" : {
                "lastElectionReason" : "electionTimeout",
                "lastElectionDate" : ISODate("2022-11-18T09:36:50.122Z"),
                "electionTerm" : NumberLong(1),
                "lastCommittedOpTimeAtElection" : {
                        "ts" : Timestamp(0, 0),
                        "t" : NumberLong(-1)
                },
                "lastSeenOpTimeAtElection" : {
                        "ts" : Timestamp(1668764199, 1),
                        "t" : NumberLong(-1)
                },
                "numVotesNeeded" : 2,
                "priorityAtElection" : 1,
                "electionTimeoutMillis" : NumberLong(10000),
                "numCatchUpOps" : NumberLong(0),
                "newTermStartDate" : ISODate("2022-11-18T09:36:50.414Z"),
                "wMajorityWriteAvailabilityDate" : ISODate("2022-11-18T09:36:51.806Z")
        },
        "members" : [
                {
                        "_id" : 0,
                        "name" : "localhost:28017",
                        "health" : 1,
                        "state" : 1,
                        "stateStr" : "PRIMARY",
                        "uptime" : 635,
                        "optime" : {
                                "ts" : Timestamp(1668764430, 1),
                                "t" : NumberLong(1)
                        },
                        "optimeDate" : ISODate("2022-11-18T09:40:30Z"),
                        "syncingTo" : "",
                        "syncSourceHost" : "",
                        "syncSourceId" : -1,
                        "infoMessage" : "",
                        "electionTime" : Timestamp(1668764210, 1),
                        "electionDate" : ISODate("2022-11-18T09:36:50Z"),
                        "configVersion" : 1,
                        "self" : true,
                        "lastHeartbeatMessage" : ""
                },
                {
                        "_id" : 1,
                        "name" : "localhost:28018",
                        "health" : 1,
                        "state" : 2,
                        "stateStr" : "SECONDARY",
                        "uptime" : 236,
                        "optime" : {
                                "ts" : Timestamp(1668764430, 1),
                                "t" : NumberLong(1)
                        },
                        "optimeDurable" : {
                                "ts" : Timestamp(1668764430, 1),
                                "t" : NumberLong(1)
                        },
                        "optimeDate" : ISODate("2022-11-18T09:40:30Z"),
                        "optimeDurableDate" : ISODate("2022-11-18T09:40:30Z"),
                        "lastHeartbeat" : ISODate("2022-11-18T09:40:34.599Z"),
                        "lastHeartbeatRecv" : ISODate("2022-11-18T09:40:35.637Z"),
                        "pingMs" : NumberLong(0),
                        "lastHeartbeatMessage" : "",
                        "syncingTo" : "localhost:28017",
                        "syncSourceHost" : "localhost:28017",
                        "syncSourceId" : 0,
                        "infoMessage" : "",
                        "configVersion" : 1
                },
                {
                        "_id" : 2,
                        "name" : "localhost:28019",
                        "health" : 1,
                        "state" : 2,
                        "stateStr" : "SECONDARY",
                        "uptime" : 236,
                        "optime" : {
                                "ts" : Timestamp(1668764430, 1),
                                "t" : NumberLong(1)
                        },
                        "optimeDurable" : {
                                "ts" : Timestamp(1668764430, 1),
                                "t" : NumberLong(1)
                        },
                        "optimeDate" : ISODate("2022-11-18T09:40:30Z"),
                        "optimeDurableDate" : ISODate("2022-11-18T09:40:30Z"),
                        "lastHeartbeat" : ISODate("2022-11-18T09:40:34.599Z"),
                        "lastHeartbeatRecv" : ISODate("2022-11-18T09:40:35.674Z"),
                        "pingMs" : NumberLong(0),
                        "lastHeartbeatMessage" : "",
                        "syncingTo" : "localhost:28017",
                        "syncSourceHost" : "localhost:28017",
                        "syncSourceId" : 0,
                        "infoMessage" : "",
                        "configVersion" : 1
                }
        ],
        "ok" : 1,
        "$clusterTime" : {
                "clusterTime" : Timestamp(1668764430, 1),
                "signature" : {
                        "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                        "keyId" : NumberLong(0)
                }
        },
        "operationTime" : Timestamp(1668764430, 1)
}
```

验证：

* 重新开一个 shell 窗口，我们在 MongoDB 从节点进行读取：

  ```bash
  $ mongo localhost:28018
  MongoDB shell version v4.2.23
  connecting to: mongodb://localhost:28018/test?compressors=disabled&gssapiServiceName=mongodb
  ......
  ---
  
  rs0:SECONDARY> db.test.find()
  Error: error: {
          "operationTime" : Timestamp(1668765000, 1),
          "ok" : 0,
          "errmsg" : "not master and slaveOk=false", //告诉我们这不是主节点，并且不要在从节点是读取，执行 rs.slaveOk()
          "code" : 13435,
          "codeName" : "NotPrimaryNoSecondaryOk",
          "$clusterTime" : {
                  "clusterTime" : Timestamp(1668765000, 1),
                  "signature" : {
                          "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                          "keyId" : NumberLong(0)
                  }
          }
  }
  rs0:SECONDARY> rs.slaveOk()
  rs0:SECONDARY> db.test.find() // 这时就不会报错了
  ```

* MongoDB 主节点进入写入：

  ```bash
  rs0:PRIMARY> db.test.insert({a:1})
  WriteResult({ "nInserted" : 1 })
  ```

* 回到从节点读取：

  ```bash
  rs0:SECONDARY> db.test.find()
  { "_id" : ObjectId("637756750e386c972af7e689"), "a" : 1 }  // 可以看到已经能免在从节点上读取主节点上写入的数据
  ```

简单使用：

```bash
rs0:PRIMARY> 
rs0:PRIMARY> show dbs
admin   0.000GB
config  0.000GB
local   0.000GB
test    0.000GB
rs0:PRIMARY> use local
switched to db local
rs0:PRIMARY> show tables
oplog.rs
replset.election
replset.minvalid
replset.oplogTruncateAfterPoint
startup_log
system.replset
system.rollback.id
```

### 调整复制集配置

```bash
var conf = rs.conf()
// 将0号节点的优先级调整为10
conf.members[0].priority = 10;
// 将1号节点调整为hidden节点
conf.members[1].hidden = true;
// hidden节点必须配置{priority: 0}
conf.members[1].priority = 0;
// 应用以上调整
rs.reconfig(conf);
```

## 参考

* https://www.mongodb.com/docs/v4.2/replication/