---
title: MongoDB 读操作事务之readPreference
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-02-20 09:46:47
password:
summary: MongoDB 读操作事务之readPreference
tags:
	- MongoDB
	- NoSQL
categories: MongoDB
---
MongoDB 是一个分布式架构，在最小部署的情况下，它必须是一个主从从（一主两从）3个节点的架构，如果涉及到分片的话还有 [mongos](https://www.mongodb.com/docs/v4.2/reference/program/mongos/#bin.mongos) 加在一起可能会有10多个节点，我们的数据就会分布在这些节点上，我们在读取数据的过程中我们需要关注以下两个问题：

* 从哪里读？
* 什么样的数据可以读？

第一个问题是是由 `readPreference` 来解决

第二个问题则是由 `readConcern` 来解决

## 什么是 readPreference

`readPreference` 决定使用哪一个节点来满足正在发起的读请求。可选值包括：

* primary: 只选择主节点
* primaryPreferred：优先选择主节点，如果不可用则选择从节点
* secondary：只选择从节点
* secondaryPreferred：优先选择从节点，如果从节点不可用则选择主节点
* nearest：选择最近的节点

`readPreference` 场景举例：

* 用户下订单后马上将用户转到订单详情页 ` primary/primaryPreferred`。因为此时从节点可能还没复制到新订单
* 用户查询自己下过的订单`secondary/secondaryPreferred`。查询历史订单对时效性通常没有太高要求
* 生成报表`secondary`。报表对时效性要求不高，但资源需求大，可以在从节点单独处理，避免对线上用户造成影响
* 将用户上传的图片分发到全世界，让各地用户能够就近读取`nearest`。每个地区的应用选择最近的节点读取数据

## readPreference 与 Tag

`readPreference` 只能控制使用一类节点，`Tag` 则可以将节点选择控制到一个或几个节点。考虑以下场景：

一个 5 个节点的复制集，3 个节点硬件较好，专用于服务线上客户，2 个节点硬件较差，专用于生成报表。

可以使用 Tag 来达到这样的控制目的：

* 为 3 个较好的节点打上 `{purpose: "online"}`

* 为 2 个较差的节点打上 `{purpose: "analyse"} `

* 在线应用读取时指定 online，报表读取时指定 reporting。

更多信息请参考文档：[readPreference](https://www.mongodb.com/docs/v4.2/core/read-preference-tags/)

## readPreference 配置

* 通过 MongoDB 的连接串参数：

  ```bash
  mongodb://host1:27107,host2:27107,host3:27017/?replicaSet=rs&readPreference=secondary
  ```

* 通过 MongoDB 驱动程序 API：

  ```bash
  MongoCollection.withReadPreference(ReadPreference readPref)
  ```

* Mongo Shell：

  ```bash
  db.collection.find({}).readPref(“secondary”)
  ```

## readPreference 实验

下面我们通过一个实验来观察一下 `readPreference`对我们读操作的影响。

这里要注意下 Mongo shell 连接到复制集，需要按以下方式连接，否则连接到主节点时`setReadPref(“secondary”) `不生效。详见：https://jira.mongodb.org/browse/SERVER-22289

* 准备条件，首先搭建出一个 [MongoDB 复制集](https://zhangquan.me/2023/02/06/mongodb-fu-zhi-ji/)，接着通过下面的方式进入主节点：

```bash
mongo --host rs0/127.0.0.1:28017
```

### 步骤

* 在主节点上写入一条数据，接着在各个节点查询该条数据，正常情况下应该都能马上查询到该条数据

  * 进入主节点，删除测试表：

    ```bash
    rs0:PRIMARY> db.test.drop()
    true
    ```

  * 写入一条数据：

    ```bash
    rs0:PRIMARY> db.test.insert({x:1})
    WriteResult({ "nInserted" : 1 })
    ```

  * 分别到另外两个节点查看一下该条数据：

    ```bash
    # 第一个从节点
    rs0:SECONDARY> db.test.find()
    Error: error: {
            "operationTime" : Timestamp(1669366371, 1),
            "ok" : 0,
            "errmsg" : "not master and slaveOk=false",
            "code" : 13435,
            "codeName" : "NotPrimaryNoSecondaryOk",
            "$clusterTime" : {
                    "clusterTime" : Timestamp(1669368842, 1),
                    "signature" : {
                            "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                            "keyId" : NumberLong(0)
                    }
            }
    }
    
    rs0:SECONDARY> rs.slaveOk()
    rs0:SECONDARY> db.test.find()
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    
    # 第二个从节点
    rs0:SECONDARY> db.test.find()
    Error: error: {
            "operationTime" : Timestamp(1669366001, 1),
            "ok" : 0,
            "errmsg" : "not master and slaveOk=false",
            "code" : 13435,
            "codeName" : "NotPrimaryNoSecondaryOk",
            "$clusterTime" : {
                    "clusterTime" : Timestamp(1669366001, 1),
                    "signature" : {
                            "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                            "keyId" : NumberLong(0)
                    }
            }
    }
    rs0:SECONDARY> rs.slaveOk()
    
    rs0:SECONDARY> db.test.find()
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    ```

  * 在主节点上使用 `readPreference` 指定从从节点上读取该条数据：

    ```bash
    rs0:PRIMARY> db.test.find()
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    
    rs0:PRIMARY> db.test.find().readPref("secondary")
    2022-11-25T18:18:37.351+0800 I  NETWORK  [js] Successfully connected to localhost:28018 (1 connections now open to localhost:28018 with a 0 second timeout)
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    ```

* 在两个从节点上分别执行 `db.fsyncLock()`，该操作是锁住该节点，不让数据写入（同步）到该节点，用该方式来模拟同步阻碍或网络延迟

  * 锁住两个从节点

    ```bash
    # 第一个从节点
    rs0:SECONDARY> db.fsyncLock()
    {
            "info" : "now locked against writes, use db.fsyncUnlock() to unlock",
            "lockCount" : NumberLong(1),
            "seeAlso" : "http://dochub.mongodb.org/core/fsynccommand",
            "ok" : 1,
            "$clusterTime" : {
                    "clusterTime" : Timestamp(1669371544, 1),
                    "signature" : {
                            "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                            "keyId" : NumberLong(0)
                    }
            },
            "operationTime" : Timestamp(1669371544, 1)
    }
    
    # 第二个从节点
    rs0:SECONDARY> db.fsyncLock()
    {
            "info" : "now locked against writes, use db.fsyncUnlock() to unlock",
            "lockCount" : NumberLong(1),
            "seeAlso" : "http://dochub.mongodb.org/core/fsynccommand",
            "ok" : 1,
            "$clusterTime" : {
                    "clusterTime" : Timestamp(1669371574, 1),
                    "signature" : {
                            "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                            "keyId" : NumberLong(0)
                    }
            },
            "operationTime" : Timestamp(1669371574, 1)
    }
    ```

* 在主节点上写入新的数据，然后观察使用 `readPreference` 读的情况

  * 写入第二条数据：

    ```bash
    rs0:PRIMARY> db.test.insert({x:2})
    WriteResult({ "nInserted" : 1 })
    ```

  * 在两个从节点上读取，可以看到读取不到刚写入的数据：

    ```bash
    # 第一个从节点读
    rs0:SECONDARY> db.test.find()
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    
    # 第二个从节点读
    rs0:SECONDARY> db.test.find()
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    ```

  * 在主节点上使用 `readPreference` 指定从从节点上读取该条数据，可以看到也是读取不到：

    ```bash
    rs0:PRIMARY> db.test.find().readPref("secondary")
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    ```

  * 在主节点上使用 `readPreference` 指定从主节点上读取，或使用默认方式（默认就是从主节点上读取）该条数据，是可以读到：

    ```bash
    rs0:PRIMARY> db.test.find({}).readPref("primary")
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    { "_id" : ObjectId("638096cb2908bdb87035a361"), "x" : 2 }
    
    rs0:PRIMARY> db.test.find({})
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    { "_id" : ObjectId("638096cb2908bdb87035a361"), "x" : 2 }
    ```

* 解除从节点上写锁定 `db.fsyncUnlock() `

  * 解除从节点上的锁定，在两个从节点是分别都能读到后新增的数据：

    ```bash
    # 第一个从节点解除锁定
    rs0:SECONDARY> db.fsyncUnlock()
    {
            "info" : "fsyncUnlock completed",
            "lockCount" : NumberLong(0),
            "ok" : 1,
            "$clusterTime" : {
                    "clusterTime" : Timestamp(1669371684, 1),
                    "signature" : {
                            "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                            "keyId" : NumberLong(0)
                    }
            },
            "operationTime" : Timestamp(1669371544, 1)
    }
    
    # 第一个从节点读
    rs0:SECONDARY> db.test.find()
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    { "_id" : ObjectId("638096cb2908bdb87035a361"), "x" : 2 }
    
    
    # 第二个从节点解除锁定
    rs0:SECONDARY> db.fsyncUnlock()
    {
            "info" : "fsyncUnlock completed",
            "lockCount" : NumberLong(0),
            "ok" : 1,
            "$clusterTime" : {
                    "clusterTime" : Timestamp(1669371714, 1),
                    "signature" : {
                            "hash" : BinData(0,"AAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                            "keyId" : NumberLong(0)
                    }
            },
            "operationTime" : Timestamp(1669371574, 1)
    }
    
    # 第二个从节点读
    rs0:SECONDARY> db.test.find()
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    { "_id" : ObjectId("638096cb2908bdb87035a361"), "x" : 2 }
    ```

  * 在主节点上使用 `readPreference` 指定从从节点上读取该条数据，可以读取到新增的数据：

    ```bash
    rs0:PRIMARY> db.test.find().readPref("secondary")
    2022-11-25T18:22:23.039+0800 I  NETWORK  [js] Successfully connected to localhost:28019 (1 connections now open to localhost:28019 with a 0 second timeout)
    { "_id" : ObjectId("638096462908bdb87035a360"), "x" : 1 }
    { "_id" : ObjectId("638096cb2908bdb87035a361"), "x" : 2 }
    ```

## 注意事项

* 指定 `readPreference` 时也应注意高可用问题。例如将 `readPreference` 指定 `primary`，则发生故障转移不存在 `primary` 期间将没有节点可读。如果业务允许，则应选择 `primaryPreferred`。
* 使用 `Tag` 时也会遇到同样的问题，如果只有一个节点拥有一个特定 `Tag`，则在这个节点失效时将无节点可读。这在有时候是期望的结果，有时候不是。例如：
  * 如果报表使用的节点失效，即使不生成报表，通常也不希望将报表负载转移到其他节点上，此时只有一个节点有报表` Tag` 是合理的选择。
  * 如果线上节点失效，通常希望有替代节点，所以应该保持多个节点有同样的 `Tag`。
* `Tag` 有时需要与优先级、选举权综合考虑。例如做报表的节点通常不会希望它成为主节点，则优先级应为 0。

## 参考
* https://www.mongodb.com/docs/v4.2/core/transactions/
* https://www.mongodb.com/docs/v4.2/core/read-preference-use-cases/
* https://www.mongodb.com/docs/v4.2/core/read-preference/
* https://www.mongodb.com/docs/v4.2/reference/method/cursor.readPref/#cursor.readPref