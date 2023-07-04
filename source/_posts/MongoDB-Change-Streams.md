---
title: MongoDB Change Streams
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-03-13 18:13:05
password:
summary: MongoDB Change Streams
tags:
	- MongoDB
	- NoSQL
categories: MongoDB
---

## 什么是 Change Stream？

Change Stream 是 MongoDB 用于实现变更追踪的解决方案，类似于关系数据库的触发器，但原理不完全相同：

|          | Change Stream        | 触发器           |
| -------- | -------------------- | ---------------- |
| 触发方式 | 异步                 | 同步（事务保证） |
| 触发位置 | 应用回调事件         | 数据库触发器     |
| 触发次数 | 每个订阅事件的客户端 | 1次（触发器）    |
| 故障恢复 | 从上次断点重新触发   | 事务回滚         |

## Change Stream 的实现原理

Change Stream 是基于 `oplog` 实现的。它在 `oplog` 上开启一个 `tailable cursor` 来追踪所有复制集上的变更操作，最终调用应用中定义的回调函数。被追踪的变更事件主要包括：

* insert/update/delete：插入、更新、删除

* drop：集合被删除

* rename：集合被重命名

* dropDatabase：数据库被删除

* invalidate：drop/rename/dropDatabase 将导致 invalidate 被触发，并关闭 change stream

## Change Stream 与可重复读

Change Stream 只推送已经在大多数节点上提交的变更操作。即“可重复读”的变更。

这个验证是通过 `{readConcern: “majority”} `实现的。因此：

* 未开启 majority readConcern 的集群无法使用 Change Stream

* 当集群无法满足 {w: “majority”} 时，不会触发 Change Stream

## Change Stream 变更过滤

如果只对某些类型的变更事件感兴趣，可以使用使用聚合管道的过滤步骤过滤事件。

例如：

```javascript
var cs = db.collection.watch([{
    "$match": {
        "operationType": {
            "$in": [
                "insert",
                "delete"
            ]
        }
    }
}])
```

Change Stream 示例：

1. 开启一个 mongo shell 窗口，进入主节点执行以下命令：

   进入主节点：

   ```bash
   mongo --port 28017
   ```

   执行以下命令：

   ```bash
   rs0:PRIMARY> db.test.watch([], {maxAwaitTimeMS: 300000}).pretty()
   ```

2. 开启另一个 mongo shell 窗口，进入主节点执行以下命令：

   开启另一个 mongo shell 窗口，进入主节点:

   进入主节点：

   ```bash
   mongo --port 28017
   ```

   执行以下命令：

   ```bash
   rs0:PRIMARY> db.test.insert({x: 123})
   WriteResult({ "nInserted" : 1 })
   ```

3. 回到第一个窗口，观察输出：

   ```bash
   rs0:PRIMARY> db.test.watch([], {maxAwaitTimeMS: 300000}).pretty()
   {
           "_id" : {
                   "_data" : "8263A81537000000012B022C0100296E5A1004199BDC9429644781918CE46FDC2C0DFF46645F6964006463A81537C7C3F623FD5BC92E0004"
           },
           "operationType" : "insert",
           "clusterTime" : Timestamp(1671959863, 1),
           "fullDocument" : {
                   "_id" : ObjectId("63a81537c7c3f623fd5bc92e"),
                   "x" : 123
           },
           "ns" : {
                   "db" : "test",
                   "coll" : "test"
           },
           "documentKey" : {
                   "_id" : ObjectId("63a81537c7c3f623fd5bc92e")
           }
   }
   
   ```

## Change Stream 故障恢复

假设在一系列写入操作的过程中，订阅 Change Stream 的应用在接收到 “写3”之后于 t0 时刻崩溃，重启后后续的变更怎么办？

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/change-stream-1.png)

想要从上次中断的地方继续获取变更流，只需要保留上次变更通知中的` _id` 即可。

```javascript
{
        "_id" : {
                "_data" : "8263A81537000000012B022C0100296E5A1004199BDC9429644781918CE46FDC2C0DFF46645F6964006463A81537C7C3F623FD5BC92E0004"
        },
        "operationType" : "insert",
        "clusterTime" : Timestamp(1671959863, 1),
        "fullDocument" : {
                "_id" : ObjectId("63a81537c7c3f623fd5bc92e"),
                "x" : 123
        },
        "ns" : {
                "db" : "test",
                "coll" : "test"
        },
        "documentKey" : {
                "_id" : ObjectId("63a81537c7c3f623fd5bc92e")
        }
}
```

如上图所示是一次 Change Stream 回调所返回的数据。每条这样的数据都带有一个` _id`，这个` _id `可以用于断点恢复。

例如：

```javascript
var cs = db.collection.watch([], {resumeAfter: <_id>})
```

即可从上一条通知中断处继续获取后续的变更通知。

## Change Stream 使用场景

* 跨集群的变更复制：在源集群中订阅 Change Stream，一旦得到任何变更立即写入目标集群。 

* 微服务联动：当一个微服务变更数据库时，其他微服务得到通知并做出相应的变更。 

* 其他任何需要系统联动的场景。

## 注意事项

* Change Stream 依赖于 [oplog](https://www.mongodb.com/docs/manual/core/replica-set-oplog/)，因此中断时间不可超过 oplog 回收的最大时间窗

* 在执行 update 操作时，如果只更新了部分数据，那么 Change Stream 通知的也是增量部分；同理，删除数据时通知的仅是删除数据的` _id`

## 参考

* https://www.mongodb.com/docs/v4.2/changeStreams/