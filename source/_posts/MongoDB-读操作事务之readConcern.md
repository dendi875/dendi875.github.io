---
title: MongoDB 读操作事务之readConcern
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-02-23 11:31:35
password:
summary: MongoDB 读操作事务之readConcern
tags:
	- MongoDB
	- NoSQL
categories: MongoDB
---
# MongoDB 读操作事务之readConcern

## 什么是 readConcern？

在 `readPreference `选择了指定的节点后，`readConcern `决定这个节点上的数据哪些是可读的，类似于关系数据库的隔离级别。可选值包括：

* `available`：读取所有可用的数据

* `local`：读取所有可用且属于当前分片的数据，默认设置

* `majority`：读取在大多数节点上提交完成的数据，**数据读一致性的充分保证，可能你最需要关注的**

* `linearizable`：可线性化读取文档，增强处理 majority 情况下主节点失联时候的例外情况

* `snapshot`：读取最近快照中的数据，隔离性是最强的，类似关系型数据库中的 `可串行化` 级别

### local 和 available

在复制集中 `local` 和 `available` 是没有区别的。两者的区别主要体现在分片集上。考虑以下场景：

* 一个 chunk x 正在从 shard1 向 shard2 迁移，一个数据从一个分片迁移到另一个分片

* 整个迁移过程中 chunk x 中的部分数据会在 shard1 和 shard2 中同时存在，但源分片 shard1仍然是chunk x 的负责方： 

  * 所有对 chunk x 的读写操作仍然进入 shard1

  * config 中记录的信息 chunk x 仍然属于 shard1

* 此时如果读 shard2，则会体现出` local `和 `available` 的区别：

  * local：只取应该由 shard2 负责的数据（不包括 x）

  * available：shard2 上有什么就读什么（包括 x）

### ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221125184236.png)

注意事项：

* 虽然看上去总是应该选择 local，但毕竟对结果集进行过滤会造成额外消耗。在一些无关紧要的场景（例如统计）下，也可以考虑 `available` 

* MongoDB <=3.6 不支持对从节点使用` {readConcern: "local"}`

* 从主节点读取数据时默认 `readConcern` 是 `local`，从从节点读取数据时默认`readConcern` 是 `available`（向前兼容原因）

### majority

只读取大多数据节点上都提交了的数据。考虑如下场景：

* 集合中原有文档 `{x: 0}`

* 将x值更新为 `1`

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/readConcern-1.png)

如上图所示，在 t0 时间点的时候我们发送请求将文档更新到 `x=1`，t1 时间点的时候这条数据复制到 Secondary1 节点，t2 时间点的时候这条数据复制到 Secondary2 节点，t3 时间点的时候 Secondary1 节点响应成功（告诉说是我已经拿到了该条数据），t4 时间点的时候 Secondary2 节点响应成功（告诉说是我已经拿到了该条数据），t5 时间点的时候主节点告诉  Secondary1 节点，这时 Secondary1 节点已经知道该条数据至少在我自己的节点上（Secondary1）和主节点上都存在了，t6 时间点的时候主节点告诉  Secondary2 节点，这时 Secondary2 节点已经知道该条数据在我自己的节点上（Secondary2）和主节点上都存在了，这时三个节点都知道了该条数据在三个节点上都已经写完。

在上面这种情况下，如果在各节点上应用`{readConcern: “majority”}` 来读取数据：

| 时间点 | 主节点 | 第一个从节点 | 第二个从节点 | 说明                                                         |
| ------ | ------ | ------------ | ------------ | ------------------------------------------------------------ |
| t0     | x=0    | x=0          | x=0          | 只有主节点是有该条数据（只有主节点确认已完了该条数据）<br/>从节点还没有该条数据，达不到大多数 |
| t1     | x=0    | x=0          | x=0          | 只有主节点是有该条数据<br/>从节点只知道自己有该条数据，达不到大多数 |
| t2     | x=0    | x=0          | x=0          | 只有主节点是有该条数据<br/>从节点只知道自己有该条数据，达不到大多数 |
| t3     | x=1    | x=0          | x=0          | 主节点收到了 Secondary1节点的响应，这时主节点知道自己和Secondary1节点都有这条数据了 |
| t4     | x=1    | x=0          | x=0          | 主节点收到了 Secondary2节点的响应，这时主节点知道自己和Secondary1、Secondary2节点都有这条数据了 |
| t5     | x=1    | x=1          | x=0          | Secondary1节点从主节点那里获知到主节点有该条数据，自己有该条数据，加起来有两个节点有该条数据 |
| t6     | x=1    | x=1          | x=1          | Secondary2节点从主节点那里获知到主节点有该条数据，Secondary1有该条数据，自己有该条数据，这时加起来有三个节点有该条数据 |

### linearizable

它和 `majority`有些类似：只读取大多数节点确认过的数据。和` majority` 最大差别是保证绝对的操作线性顺序：在写操作自然时间后面的发生的读，一定可以读到之前的写。

使用注意：

* 只对读取单个文档时有效

* 可能导致非常慢的读，因此总是建议配合使用 maxTimeMS

### snapshot

只在多文档事务中生效。将一个事务的 `readConcern`设置为 `snapshot`，将保证在事务中的读满足：

* 不出现脏读
* 不出现不可重复读
* 不出现幻读

因为所有的读都将使用同一个快照，直到事务提交为止该快照才被释放。

## readConcern 实验

`readConcern`用的最多的两个设置是 `local`和`majority`，下面我们就以实验的方式来理解一下这两个值的区别。

### 开始之前

* 安装 3 节点复制集，请参考 [MongoDB 复制集](https://zhangquan.me/2023/02/06/mongodb-fu-zhi-ji/)

* 从 `3.2` 版本开始支持 `majority` 选项（`Read Concern`特性也是从该 [版本]([https://docs.mongodb.com/v3.2/reference/configuration-options/#replication.enableMajorityReadConcern](https://docs.mongodb.com/v3.2/reference/configuration-options/?spm=a2c6h.12873639.article-detail.7.29f02afcKHfm1C#replication.enableMajorityReadConcern) ) 开始支持）

* `3.2` 和 `3.4` 中 `majority` 默认值为 `false`，即默认不支持 `majority` 级别的 `read concern`（或称之为`committed reads`，通过`serverStatus`输出中的 `storageEngine.supportsCommittedReads` 可判断该能力是否开启）。

  ```bash
  rs0:PRIMARY> db.serverStatus().storageEngine
  {
          "name" : "wiredTiger",
          "supportsCommittedReads" : true,
          "oldestRequiredTimestampForCrashRecovery" : Timestamp(1669614064, 1),
          "supportsPendingDrops" : true,
          "dropPendingIdents" : NumberLong(0),
          "supportsSnapshotReadConcern" : true,
          "readOnly" : false,
          "persistent" : true,
          "backupCursorOpen" : false
  }
  ```

* `3.6` 及以后版本默认值为`true`

* 修改该参数需要更改配置文件并**重启**mongod

### 步骤

* 将复制集中的两个从节点使用 `db.fsyncLock()` 锁住写入（模拟同步延迟）

  * 进入主节点，删除测试表：

    ```bash
    rs0:PRIMARY> db.test.drop()
    true
    ```

  * 分别进入两个从节点，锁住写入：

    ```bash
    # 第一个从节点
    rs0:SECONDARY> db.fsyncLock()
    {
            "info" : "now locked against writes, use db.fsyncUnlock() to unlock",
            "lockCount" : NumberLong(1),
            "seeAlso" : "http://dochub.mongodb.org/core/fsynccommand",
            "ok" : 1,
            "$clusterTime" : {
                    "clusterTime" : Timestamp(1669616655, 1),
                    "signature" : {
                            "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                            "keyId" : NumberLong(0)
                    }
            },
            "operationTime" : Timestamp(1669616655, 1)
    }
    
    # 第二个从节点
    rs0:SECONDARY> db.fsyncLock()
    {
            "info" : "now locked against writes, use db.fsyncUnlock() to unlock",
            "lockCount" : NumberLong(1),
            "seeAlso" : "http://dochub.mongodb.org/core/fsynccommand",
            "ok" : 1,
            "$clusterTime" : {
                    "clusterTime" : Timestamp(1669616665, 1),
                    "signature" : {
                            "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                            "keyId" : NumberLong(0)
                    }
            },
            "operationTime" : Timestamp(1669616665, 1)
    }
    ```

* 主节点写入一条数据，查询观察验证

  * 主节点上写入一条测试数据：

    ```bash
    rs0:PRIMARY> db.test.insert({x:1})
    WriteResult({ "nInserted" : 1 })
    ```

  * 主节点上查询：

    ```bash
    rs0:PRIMARY> db.test.find()
    { "_id" : ObjectId("638454d4e4c725a1336fff4a"), "x" : 1 }
    
    # local查询
    rs0:PRIMARY> db.test.find().readConcern("local")
    { "_id" : ObjectId("638454d4e4c725a1336fff4a"), "x" : 1 }
    
    # available 查询
    rs0:PRIMARY> db.test.find().readConcern("available")
    { "_id" : ObjectId("638454d4e4c725a1336fff4a"), "x" : 1 }
    ```

  * 主节点是使用 `majority`查询：

    ```bash
    rs0:PRIMARY> db.test.find().readConcern("majority")
    ```

    可以观察到一直在等待，因为主节点已经写了，但其它两个节点被禁写了，它就一直等待同步到其它两个节点

    * 我们在第一个从节点是解除锁定：

      ```bash
      rs0:SECONDARY> db.fsyncUnlock()
      {
              "info" : "fsyncUnlock completed",
              "lockCount" : NumberLong(0),
              "ok" : 1,
              "$clusterTime" : {
                      "clusterTime" : Timestamp(1669617290, 2),
                      "signature" : {
                              "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                              "keyId" : NumberLong(0)
                      }
              },
              "operationTime" : Timestamp(1669616655, 1)
      }
      ```

    * 观察主节点等待已经返回，并且也能查询到数据：

      ```bash
      rs0:PRIMARY> db.test.find().readConcern("majority")
      { "_id" : ObjectId("638454d4e4c725a1336fff4a"), "x" : 1 }
      ```

### 结论

* 使用 `local` 参数，则可以直接查询到写入数据
* 使用 `majority`，只能查询到已经被多数节点确认过的数据
* `update` 与` remove` 与上同理

## majority 与脏读

* MongoDB 中的回滚：写操作到达大多数节点之前都是不安全的，一旦主节点崩溃，而从节还没复制到该次操作，刚才的写操作就丢失了（参考：[MongoDB 写操作事务]()）。把一次写操作视为一个事务，从事务的角度，可以认为事务被回滚了（写操作被回滚了）。所以从分布式系统的角度来看，事务的提交被提升到了分布式集群的**多个节点级别的“提交”**，而不再是单个节点上的“提交”。

* MongoDB 中的脏读：在可能发生回滚的前提下，如果用户在一次写操作到达大多数节点前读取了这个写操作，然后因为系统故障该写操作回滚了，则发生了脏读问题。
* 使用` {readConcern: “majority”}` 可以有效避免脏读。
* `majority` 对应于关系型数据库事务隔离级别中的 `Read Committed `。

## readConcern使用场景

我们在使用 MongoDB 时会使用读写分离架构，主节点上用来做写入并提交，从节点上用来做读写，或读，或一些数据分析等，但有时候会发现在出现网络问题时**同步延迟**会非常长（有可能30多秒或者更长），在这种同步延迟的情况下，如果向主节点上写入一条数据，立即从从节点读取这条数据，有可能读取不到刚写入的数据。

**那如何做到即能使用读写分离架构又能保证数据的一致性？**这时就需要使用到`writeConcern`和`readConcern`的组合方式。

有可能读取不到刚写入的数据：

```bash
db.orders.insert({id: 1})
db.orders.find({id: 1}).readPref("secondary")
```

使用 `writeConcern + readConcern majority` 来解决

```bash
db.orders.insert({id: 1}, {writeConcern: {w: "majority"}})
db.orders.find({id: 1}).readPref("secondary").readConcern("majority")
```

## 参考
* https://www.mongodb.com/docs/v4.2/reference/read-concern/
* [https://www.mongodb.com/docs/v4.2/reference/read-concern-majority/#readconcern.%22majority%22](https://www.mongodb.com/docs/v4.2/reference/read-concern-majority/#readconcern."majority")