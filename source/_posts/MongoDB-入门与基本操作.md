---
title: MongoDB 入门与基本操作
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-01-02 16:17:15
password:
summary: MongoDB 入门与基本操作
tags:
	- MongoDB
	- NoSQL
categories: MongoDB
---

## 关于 MongoDB

| 什么是 MongoDB       | 一个以 JSON 为数据模型的文档数据库                           |
| -------------------- | ------------------------------------------------------------ |
| 为什么叫文档数据库   | 文档来自于 `JSON Document`，并非我们一般理解的 PDF,WORD 文档 |
| 谁开发 MongoDB？     | 上市公司 MongoDB inc.，总部位于美国纽约                      |
| 主要用途             | 应用数据库，类似于 MySQL<br/>海量数据处理，数据平台          |
| 主要特点             | 建模为可选<br/>JSON 数据模型比较适合开发者<br/>横向扩展可以支撑很大数据量和并发<br/>4.x 版本支持分布式事务 |
| MongoDB 是免费的吗？ | MongoDB 有两个发布版本：社区版和企业版。<br/>社区版是基于SSPL，一种和AGPL基本类似的开源协议<br/>企业版是基于商业协议，需付费使用 |

## MongoDB VS 关系型数据库

|              | MongoDB                                                     | 关系型数据库           |
| ------------ | ----------------------------------------------------------- | ---------------------- |
| 数据模型     | 文档模型                                                    | 关系模型               |
| 数据库类型   | OLTP（on-line transaction processing）                      | OLTP                   |
| CRUD 操作    | MQL/SQL                                                     | SQL                    |
| 高可用       | 复制集                                                      | 集群模式               |
| 横向扩展能力 | 通过原生分片完善支持                                        | 数据分区或者应用侵入式 |
| 索引支持     | B-树、全文索引、地理位置索引、多键（multikey）索引、TTL索引 | B树                    |
| 开发难度     | 容易                                                        | 困难                   |
| 数据容量     | 没有理论上限                                                | 千万、亿               |
| 扩展方式     | 垂直扩展+水平扩展                                           | 垂直扩展               |

## MongoDB 技术优势

* JSON 结构和对象模型接近，开发代码量低
* JSON 的动态模型意味着更容易响应新的业务需求
* 复制集提供 99.999% 高可用
* 分片架构支持海量数据和无缝扩容

## 在 MacOS 上安装并运行 MongoDB

安装：https://www.geeksforgeeks.org/how-to-install-mongodb-on-macos/

运行：

* **运行 Mongo 守护进程**，在你的一个终端窗口中执行 `mongod`。 这应该启动 Mongo 服务器。
* **运行 Mongo shell**，在一个终端中运行 Mongo 守护进程，在另一个终端窗口中执行 `mongo`。 这将运行 Mongo shell，这是一个访问 MongoDB 中数据的应用程序。
* **退出 Mongo shell** 运行`quit()`
* **要停止 Mongo 守护进程**，请按 `ctrl-c`

## MongoDB 基本操作

### 使用 `insert` 完成插入操作

操作格式：

```javascript
db.<集合>.insertOne(<JSON对象>)
```

```javascript
db.<集合>.insertMany([<JSON 1>, <JSON 2>, ...<JSON N> ])
```

示例：

```javascript
  db.fruit.insertOne({name: "apple"})
```

```javascript
  db.fruit.insertMany([
  		{name: "apple"},
  		{name: "pear"},
  		{name: "orange"}
  ])
```

查看插入的数据：

```bash
db.fruit.find()
```

### 使用 `find` 查询文档

关于 find：

* find 是 MongoDB 中查询数据的基本指令，相当于 SQL 中的 SELECT。
* find 返回的是游标。

find 示例：

```bash
db.movies.find({"year": 1975}) // 单条查询
db.movies.find({"year": 1989, "title": "Batman"}) // 多条件 and 查询
db.movies.find({$and:[{"title": "Batman"}, {"category": "action"}]}) // and 的另一种形式，给一个 and，and 里是数组
db.movies.find({$or:[{"year": 1989}, {"title": "Batman"}]}) // 多条件 or 查询
db.movies.find({"title": /^B/}) // 按正则表达式查询
```

### 查询条件对照表

|       SQL       |                   MQL                    |
| :-------------: | :--------------------------------------: |
|      a = 1      |                  {a: 1}                  |
|     a <> 1      |              {a: {$ne : 1}}              |
|      a > 1      |              {a: {$gt: 1}}               |
|     a >= 1      |              {a: {$gte: 1}}              |
|      a < 1      |              {a: {$lt: 1}}               |
|     a <= 1      |              {a: {$lte: 1}}              |
| a = 1 AND b = 1 | {a: 1, b: 1} 或 {$and: [{a: 1}, {b: 1}]} |
| a = 1 OR b = 1  |         {$or: [{a: 1}, {b: 1}]}          |
|    a IS NULL    |          {a: {$exists: false}}           |
| a IN (1, 2, 3)  |          {a: {$in: [1, 2, 3]}}           |

### 查询逻辑运算符

* $lt: 存在并小于
* $lte: 存在并小于等于
* $gt: 存在并大于
* $gte: 存在并大于等于
* $ne: 不存在或存在但不等于
* $in: 存在并在指定的数组中
* $nin: 不存在或不在指定的数组中
* $or: 匹配两个或多个条件中的任何一个
* $and: 匹配全部条件

### 使用 `find` 搜索子文档

#### find 支持使用 `field.sub_field`的形式查询子文档

我们先删除 fruit 这个表：

```bash
db.fruit.drop()
```

假设有一个文档：

```bash
db.fruit.insertOne({
    "name": "apple",
    "from": {
        "country": "China",
        "province": "Guangdon"
    }
})
```

先查看插入的数据：

```bash
db.fruit.find()
{ "_id" : ObjectId("6370d4bc4835f42d80eba3bb"), "name" : "apple", "from" : { "country" : "China", "province" : "Guangdon" } }
```

以下查询的意义分别为：

```bash
db.fruit.find({"from.country": "China"})
```

该查询表示：我要查一个子文档  "from.country" 

```bash
db.fruit.find({"from": {"country": "China"}}) // 找不到文档
```

该查询表示：我要找的文档里有一个字段是` "from"`，它的值是  `{"country": "China"}`

#### find 支持对数组中元素进行搜索

假设有一个文档：

```bash
db.fruit.insert([
  {"name": "Apple", color: ["red", "green"]},
  {"name": "Mango", color: ["yello", "green"]}
])
```

以下查询的意义分别为：

```bash
db.fruit.find({color: "red"}) 
{ "_id" : ObjectId("6370d5984835f42d80eba3bc"), "name" : "Apple", "color" : [ "red", "green" ] }
```

该查询表示：找的文档有 color 这个字段，且值有 red

```bash
db.fruit.find({$or: [{color: "red"}, {color: "yello"}]})
{ "_id" : ObjectId("6370d5984835f42d80eba3bc"), "name" : "Apple", "color" : [ "red", "green" ] }
{ "_id" : ObjectId("6370d5984835f42d80eba3bd"), "name" : "Mango", "color" : [ "yello", "green" ] }
```

该查询表示：找的文档有 color 这个字段，值要么是 red，要么是 yello

我们再看一个查询：

```bash
db.movies.insertOne({
	"title": "Raiders of the Lost Ark",
	"filming_locations": [
			{"city": "Los Angeles", "state": "CA", "country": "USA"},
			{"city": "Rome", "state": "Lazio", "country": "Italy"},
			{"city": "Florence", "state": "SC", "country": "USA"}
	]
})
```

查找城市是 Rome 的记录：

```bash
db.movies.find({"filming_locations.city": "Rome"})  // 使用 字段名.子文档 的方式来查找
```

### 使用 `find` 搜索数组中的对象

在数组中搜索子对象的多个字段时，如果使用 `$elemMatch`，它表示必须是同一个子对象满足多个条件。

例如下面两个查询：

```bash
db.getCollection('movies').find({
	"filming_locations.city": "Rome",
	"filming_locations.country": "USA"
})
```

该查询表示：子文档有 "city" 这个字段且值为 "Rome"，或者有 "country" 这个字段且值为 "USA"

```bash
db.getCollection('movies').find({
	"filming_locations.city": {
		$elemMatch: {"city": "Rome", "country": "USA"}
	}
})
```

该查询表示：子文档不仅要满足有 "city" 这个字段且值为 "Rome"，还要满足有 "country" 这个字段且值为 "USA"

### 控制 `find` 返回的字段

find 可以指定只返回指定的字段，`_id` 字段必须明确指定不返回，否则默认返回，在 MongoDB 中指定我们想要返回的字段，称为投影（projection）。

如下示例：指定不返回  _id，返回 title：
```bash
db.movies.find({}, {"_id": 0, title: 1})  // 把条件置为空
```

我们可以看到如果要返回的字段的话文档是有多个字段：

```bash
db.movies.find().pretty()
{
        "_id" : ObjectId("6370d8c34835f42d80eba3be"),
        "title" : "Raiders of the Lost Ark",
        "filming_locations" : [
                {
                        "city" : "Los Angeles",
                        "state" : "CA",
                        "country" : "USA"
                },
                {
                        "city" : "Rome",
                        "state" : "Lazio",
                        "country" : "Italy"
                },
                {
                        "city" : "Florence",
                        "state" : "SC",
                        "country" : "USA"
                }
        ]
}
```

### 使用 `remove` 删除文档

remove 命令需要配合查询条件使用，匹配查询条件的文档会被删除，**指定一个空文档查询条件会删除所有文档**。

如下示例：

```bash
db.testcol.remove({a: 1}) // 删除 a等于1 的记录
db.testcol.remove({a: {$lt: 5}}) // 删除 a小于5 的记录
db.testcol.remove({}) // 删除所有记录
db.testcol.remove() // 报错
```

### 使用 `update` 更新文档

操作格式：

```bash
db.<集合>.update(<查询条件>, <更新字段>)
```

示例：

```bash
db.fruit.insertMany([
	{name: "apple"},
	{name: "pear"},
	{name: "orange"}
])
```

查询 name 为 apple 的记录，将找到记录的 from 设置为 China（新加一个字段 from）：

```bash
db.fruit.updateOne({name: "apple"}, {$set: {from: "China"}})
```

`$set` 命令表示我要更新一个字段的值，该字段可以不存在。

#### 注意点

* 使用 `updateOne` 表示无论条件匹配多少条记录，始终只更新第一条。

* 使用 `updateMany` 表示条件匹配多少条就更新多少条。

* `updateOne/updateMany` 方法要求**更新条件部分**必须具有以下之一，否则将报错：

  * `$set/$unset`
  * `$push/$pushAll/$pop`
  * `$pull/$pushAll`
  * `$addToSet`

  | 操作符    | 含义                                     |
  | --------- | ---------------------------------------- |
  | $push     | 增加一个对象到数组底部                   |
  | $pushAll  | 增加多个对象到数组底部                   |
  | $pop      | 从数组底部删除一个对象                   |
  | $pull     | 如果匹配指定的值，从数组中删除相应的对象 |
  | $pullAll  | 如果匹配任意的值，从数组中删除相应的对象 |
  | $addToSet | 如果不存在则增加一个值到数组中           |

以下更新将报错：

```bash
db.fruit.updateOne({name: "apple"}, {from: "China"})
```

## 使用 `drop` 删除集合（表）

集合中的全部文档都会被删除，集合相关的索引也会被删除。

操作格式：

```bash
db.<集合>.drop()
```

示例：

```bash
db.fruit.drop()
```

## 使用 `dropDatabase` 删除数据库

数据库相应文件被删除，磁盘空间将被翻译。

操作格式：

```bash
db.droopDatabase()
```

示例：

```bash
> show dbs
admin   0.000GB
config  0.000GB
local   0.000GB
mock    0.047GB
test    0.000GB
> use test
switched to db test
> show collections   // 与 show tables 一个意思
movies
> db								// 显示当前所在的数据库
test
> db.dropDatabase()
{ "dropped" : "test", "ok" : 1 }
```

## 参考
* https://www.mongodb.com/docs/v4.2/crud/
* https://www.mongodb.com/docs/v4.2/reference/operator/
* https://www.mongodb.com/docs/v4.2/reference/sql-comparison/
* https://www.mongodb.com/docs/v4.2/crud/