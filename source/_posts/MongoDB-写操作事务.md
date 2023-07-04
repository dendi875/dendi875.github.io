---
title: MongoDB 写操作事务
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-02-16 10:23:20
password:
summary: MongoDB 写操作事务
tags:
	- MongoDB
	- NoSQL
categories: MongoDB
---

## 什么是 writeConcern

writeConcern 决定一个写操作落到多少个节点上才算成功。writeConcern 的取值包括：

* 0：发起写操作，不关心是否成功
* 1~集群最大数据节点数：写操作需要被复制到指定节点数才算成功，默认值是1
* majority：写操作需要被复制到大多数节点上才算成功

发起写操作的程序将阻塞到写操作到达指定的节点数为止。

### 默认行为

3 节点复制集不作任何特别设定（默认值）：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221118204610.png)

如上图所示，假设我们有三个节点的复制集，Primary、Secondary1、Secondary2，应用程序客户端试图写入一条数据 x=1，首先请求进入 MongoDB 的 Primary 节点，进入以后如果你没有做任何设置，它就取默认设置（只写一个节点），只要写到 Primary 节点上就马上响应成功（甚至都没有写到硬盘里只写到了内存中）。另外两条虚线表示异步的把刚才写入的 x=1 这条数据同步复制到其它两个节点，这个同步的过程是另一个线程后台执行的，这时就有可能会发生丢数据的情况，因为你请求写入 x=1，虽然响应给你成功，但这时主节点立即 Crash ，造成 Secondary1和Secondary2都没有时间把 x=1 这条数据给复制过来，这会导致在Secondary1和Secondary2之间选一个新的节点做为主节点来服务我们的客户端，在Secondary1和Secondary2是没有 x=1 这条数据的，这种情况下就会有**丢数据**的情况出现。

### w: “majority” 行为

大多数节点确认模式：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221118210719.png)

如上图所示，应用程序客户端试图写入一条数据 x=1，首先请求进入 MongoDB 的 Primary 节点，这时并没有返回成功给客户端，写的进程在等待，它要等到数据复制到 Secondary1或Secondary2时（上图是Secondary1），某个 Secondary收到x=1这条数据时会响应一个 `acknowledgement`回复告诉说我已经拿到x=1这条数据了，只有拿到某个Secondary节点的响应成功后，这时主节点才会向客户端响应成功（告诉客户端我写入成功）。这时如果 Primary Crash，Secondary1就会成为主节点，但Secondary1已经有了x=1这条数据了，就能防止数据丢失。

我们有三个节点 `majority` 是大多数的意思，所以只要我有2个节点响应一个是 Primary，另一个是Secondary1和Secondary2其中一个节点，有两个响应后就可以响应给客户端成功。

所以如果我们要防止数据丢时，就使用`w: “majority”`，这也是推荐使用的方式。

### w: “all”

全部节点确认模式：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221118212234.png)

如上图所示，请求写入一条数据 x=1，它要等待 Primary、Secondary1和Secondary2节点都响应成功之后，才响应给客户端成功。

`all`的意思是代表我请求的数据要全部写入到所有的节点之后才响应给客户端成功。

这是一种最安全的做法，缺点就是当某一个 Secondary 节点出现故障时它就会一直等待。

### j:true

writeConcern 另一个属性是 `journal`（即日志），它的作用是当一个 MongoDB 节点发生故障时能够快速恢复刚才的写操作。一般情况下数据都会先写到 journal 再写到数据文件中，MongoDB 中默认情况下当我们的一个写操作进入到 Primary 节点内存的时候它不会等待数据写到 journal 再返回，但你可以强制告诉 MongoDB 说我这个写操作非常重要必须要落盘之后再返回，这种情况下也可以通过 writeConcern 机制来完成，做法就是增加一个 `j:true`参数。

`journal`参数能够进一步在事务中增加我们数据的安全和持久性。

writeConcern 可以决定写操作到达多少个节点才算成功，journal 则定义如何才算成功。取值包括：

* true: 写操作落到 journal 文件中才算成功。

* false: 写操作到达内存即算作成功。

## writeConcern 实验

* 准备条件，首先搭建出一个 [MongoDB 复制集](https://zhangquan.me/2023/02/06/mongodb-fu-zhi-ji/)，接着进入主节点：

```bash
mongo --port 28017
```

* 在复制集测试 writeConcern 参数

  如果不加参数则默认写到主节点（Primary）后立即返回：

  ```bash
  rs0:PRIMARY> db.test.drop()
  true
  rs0:PRIMARY> db.test.insert({count:1})
  WriteResult({ "nInserted" : 1 })
  ```

  配置数据需要写入到3个节点之后再返回：

  ```bash
  rs0:PRIMARY> db.test.insert( {count: 1}, {writeConcern: {w: 3 }})
  WriteResult({ "nInserted" : 1 })
  ```

  配置`journal`参数 ：

  ```bash
  rs0:PRIMARY> db.test.insert( {count: 1}, {writeConcern: {w: "majority"}})
  WriteResult({ "nInserted" : 1 })
  ```

  如果配置写入的节点超时3个则会报错：

  ```bash
  rs0:PRIMARY> db.test.insert( {count: 1}, {writeConcern: {w: 4 }})
  WriteResult({
          "nInserted" : 1,
          "writeConcernError" : {
                  "code" : 100,
                  "codeName" : "UnsatisfiableWriteConcern",
                  "errmsg" : "Not enough data-bearing nodes"
          }
  })
  ```

  查看写入的数据：

  ```bash
  rs0:PRIMARY> db.test.find()
  { "_id" : ObjectId("637a17d9a8bf32417f2d618f"), "count" : 1 }
  { "_id" : ObjectId("637a185aa8bf32417f2d6190"), "count" : 1 }
  { "_id" : ObjectId("637a18d7a8bf32417f2d6191"), "count" : 1 }
  { "_id" : ObjectId("637a18e4a8bf32417f2d6192"), "count" : 1 }
  ```

* 配置延迟节点，模拟网络延迟（复制延迟）

  首先我们故意把某一个节点设置成为延迟节点，这样我们就能模拟数据同步延迟等待的情况。

  1. 我们把配置拿出来放到 一个 `conf`属性里：

     ```bash
     rs0:PRIMARY> conf=rs.conf()
     {
             "_id" : "rs0",
             "version" : 1,
             "protocolVersion" : NumberLong(1),
             "writeConcernMajorityJournalDefault" : true,
             "members" : [
                     {
                             "_id" : 0,
                             "host" : "localhost:28017",
                             "arbiterOnly" : false,
                             "buildIndexes" : true,
                             "hidden" : false,
                             "priority" : 1,
                             "tags" : {
     
                             },
                             "slaveDelay" : NumberLong(0),
                             "votes" : 1
                     },
                     {
                             "_id" : 1,
                             "host" : "localhost:28018",
                             "arbiterOnly" : false,
                             "buildIndexes" : true,
                             "hidden" : false,
                             "priority" : 1,
                             "tags" : {
     
                             },
                             "slaveDelay" : NumberLong(0),
                             "votes" : 1
                     },
                     {
                             "_id" : 2,
                             "host" : "localhost:28019",
                             "arbiterOnly" : false,
                             "buildIndexes" : true,
                             "hidden" : false,
                             "priority" : 1,
                             "tags" : {
     
                             },
                             "slaveDelay" : NumberLong(0),
                             "votes" : 1
                     }
             ],
             "settings" : {
                     "chainingAllowed" : true,
                     "heartbeatIntervalMillis" : 2000,
                     "heartbeatTimeoutSecs" : 10,
                     "electionTimeoutMillis" : 10000,
                     "catchUpTimeoutMillis" : -1,
                     "catchUpTakeoverDelayMillis" : 30000,
                     "getLastErrorModes" : {
     
                     },
                     "getLastErrorDefaults" : {
                             "w" : 1,
                             "wtimeout" : 0
                     },
                     "replicaSetId" : ObjectId("63775227ae9e70a6b16fe814")
             }
     }
     ```

  2. 对 conf 中 members 字段进行调整，比如把第三个节点设置成延迟节点：

     ```bash
     rs0:PRIMARY> conf.members[2].slaveDelay = 10
     10
     rs0:PRIMARY> conf.members[2].priority = 0
     0
     ```

     现在第三个节点的数据永远会比主节点的数据延迟 10 秒，并且该节点是不能参与选举的。

  3. 确认设置完后的配置：

     ```bash
     rs0:PRIMARY> rs.conf()
     {
             "_id" : "rs0",
             "version" : 2,
             "protocolVersion" : NumberLong(1),
             "writeConcernMajorityJournalDefault" : true,
             "members" : [
                     {
                             "_id" : 0,
                             "host" : "localhost:28017",
                             "arbiterOnly" : false,
                             "buildIndexes" : true,
                             "hidden" : false,
                             "priority" : 1,
                             "tags" : {
     
                             },
                             "slaveDelay" : NumberLong(0),
                             "votes" : 1
                     },
                     {
                             "_id" : 1,
                             "host" : "localhost:28018",
                             "arbiterOnly" : false,
                             "buildIndexes" : true,
                             "hidden" : false,
                             "priority" : 1,
                             "tags" : {
     
                             },
                             "slaveDelay" : NumberLong(0),
                             "votes" : 1
                     },
                     {
                             "_id" : 2,
                             "host" : "localhost:28019",
                             "arbiterOnly" : false,
                             "buildIndexes" : true,
                             "hidden" : false,
                             "priority" : 0,
                             "tags" : {
     
                             },
                             "slaveDelay" : NumberLong(10),
                             "votes" : 1
                     }
             ],
             "settings" : {
                     "chainingAllowed" : true,
                     "heartbeatIntervalMillis" : 2000,
                     "heartbeatTimeoutSecs" : 10,
                     "electionTimeoutMillis" : 10000,
                     "catchUpTimeoutMillis" : -1,
                     "catchUpTakeoverDelayMillis" : 30000,
                     "getLastErrorModes" : {
     
                     },
                     "getLastErrorDefaults" : {
                             "w" : 1,
                             "wtimeout" : 0
                     },
                     "replicaSetId" : ObjectId("63775227ae9e70a6b16fe814")
             }
     }
     ```

  4. 观察复制延迟下的写入：

     ```bash
     rs0:PRIMARY> db.test.insert( {count: 2}, {writeConcern: {w: 3}})
     WriteResult({ "nInserted" : 1 })
     ```

     可以观察到等到10秒才返回。

  5. 测试 `timeout`参数，虽然写到3个节点，但如果时间超时3秒则不等待了：

     ```bash
     rs0:PRIMARY> db.test.insert( {count: 2}, {writeConcern: {w: 3, wtimeout:3000 }})
     WriteResult({
             "nInserted" : 1,
             "writeConcernError" : {
                     "code" : 64,
                     "codeName" : "WriteConcernFailed",
                     "errmsg" : "waiting for replication timed out",
                     "errInfo" : {
                             "wtimeout" : true
                     }
             }
     })
     ```

     可以看到等到第3秒的时候就返回超时错误了。

## 注意事项

* 虽然多于半数的 `writeConcern` 都是安全的，但通常只会设置为 `majority`，因为这是等待写入延迟时间最短的选择。

* 不要设置 `writeConcern` 等于总节点数，因为一旦有一个节点故障，所有写操作都将失败。

* `writeConcern` 虽然会增加写操作延迟时间，但并不会显著增加集群压力，因此无论是否等待，写操作最终都会复制到所有节点上。设置 `writeConcern` 只是让写操作等待复制后再返回而已。

* 应对重要数据应用` {w: “majority”}`，普通数据可以应用 `{w: 1}` 以确保最佳性能。

## 参考
* https://www.mongodb.com/docs/v4.2/core/replica-set-write-concern/
* https://www.mongodb.com/docs/v4.2/reference/write-concern/
* https://www.mongodb.com/docs/v4.2/core/transactions/
* https://www.mongodb.com/docs/v4.2/core/journaling/