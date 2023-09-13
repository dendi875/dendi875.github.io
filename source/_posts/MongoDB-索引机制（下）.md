---
title: MongoDB 索引机制（下）
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-04-05 15:26:48
password:
summary: MongoDB 索引机制（下）
tags:
	- MongoDB
	- NoSQL
categories: MongoDB
---

## 索引执行计划

在 mongo 中执行计划更多的是选择哪个索引来执行。

**假设集合有两个索引**

1. {city: 1}

2. {name:1 }

**查询:**

db.members.find({ city: “SH”, name: “zhangsan”}) 

这样一个查询使用哪一个索引好呢？

下图是 mongo 索引执行计划大体流程：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402162939.png)

### explain

在索引调优时经常用到的一个函数就是 explain，可以把 explain 加在查询的最后，它会把详细的计划打印出来，这样就能知道是否用到了索引，用的索引是否有效合理。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402163631.png)

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402163739.png)

在 explain 的输出中主要看以下几点：

* stage：是IXSCAN、COLLSCAN还是其它类型
* totalDocsExamined：扫描了多少个文档
* totalKeysExamined：扫描了多少个索引项
* executionTimeMillis：花费了多少时间

## MongoDB 索引类型

* 单键索引
* 组合索引
* 多值索引
* 地理位置索引
* 全文索引
* TTL索引
* 部分索引
* 哈希索引

下面对难以理解的几个索引做描述。

### 组合索引

```javascript
db.members.find({ gender: “F”， age: {$gte: 18}}).sort(“birth_date:1”)
```

如上面的查询：我们想要在 members 用户集合中找到性别是女生的，年龄大于等于18岁的用户，并且按出生日期排序，这个查询用到了3个字段，两个是查询条件，一个是排序，这三个字段建立索引时排列组合方式不同对性能影响也不同，例如：

```javascript
{ gender: 1, age: 1, birth_date: 1 }
{ gender: 1, birth_date:1, age: 1 }
{ birth_date: 1, gender: 1, age: 1 }
{ birth_date: 1, age: 1, gender: 1 }
{ age: 1, birth_date: 1, gender: 1}
{ age: 1, gender: 1, birth_date: 1}

# 这么多候选的，用哪一个当组合索引？
```

组合索引的最佳方式：**ESR **原则 

* 精确（Equal）：匹配的字段放最前面，比如  gender: “F”
* 排序（Sort）：条件放中间，排序的字段放中间
* 范围（Range）：匹配的字段放最后面

同样适用： **ES, ER**。

### 组合索引工作模式

下面我们来说明为什么在建立组合索引时要把精确匹配字段放在最前，排序字段放在中间，范围字段放在最后。

```javascript
{a: 1, b: 2, c: 1}
{a: 1, b: 2, c: 2}
{a: 2, b: 2, c: 1}
{a: 2, b: 2, c: 3}
{a: 2, b: 3, c: 1}
{a: 2, b: 3, c: 2}
{a: 2, b: 3, c: 4}
```

```javascript
db.test.createIndex({
  a: 1, 
  b: 1, 
  c: 1
})
```

比如我们有 7 条数据，有三个字段 a，b，c，我们对a，b，c 创建了一个组合索引，这时 mongo 会把 a，b，c 三个字段的值拼接在一起(下面的图 a,b,c 的值竖着拼在一起) 作为一个索引项。

它在匹配的时候类似下面图所示：首先匹配 a 的数值，再匹配 b 的数值，然后匹配 c 的数值。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/index-compound.png)



#### 组合索引工作模式： 精确匹配

```javascript
db.test.createIndex({a: 1, b: 1, c: 1})
```

我们看一个精确匹配的例子，对于以上索引，如果我们查询语句如下：

```javascript
db.test.find({
  a: 2, 
  b: 2, 
  c: 1
})
```

我们先匹配 a，在 a 的索引中找到 2，接着 b 的索引中找到 2，然后再 c 的索引中找到 1，因为是精确匹配通过三个索引项就能找到数据页。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402170311.png)



#### 组合索引工作模式： 范围查询

```javascript
db.test.createIndex({a: 1, b: 1, c: 1})
```

我们看一个范围匹配的例子，对于以上索引，如果我们查询语句如下：

```javascript
db.test.find({
  a: 2, 
  b: {$gte: 2, $lte: 3},  // b >=2 and b <=3
  c: 1
})
```

我们先匹配 a，在 a 的索引中找到 2（只查了一个索引项），接着 b 的索引中找到 2（但2下面有个子树）， b 的索引中找到 3（但3下面有个子树），还需要在 2的子树下面的 c 索引中找到1，3的子树下面的 c 索引中找到1，这样的查询路径比精确匹配要长一些。



![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402171010.png)

#### ER原则

下面我们来说明为什么在建立组合索引时要把精确匹配字段要放在范围字段前面。

```javascript
db.test.find({a: 2, b: {$gte: 2, $lte: 3}, c: 1})
```

假设对于以上查询，我们以两种方式建立一个组合索引：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402171925.png)

针对以上两种方式建立的索引 mongo 是如何查找的呢？如下图所示：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402174204.png)

左边：先在 a 索引中找到了2，然后在 b 索引中找到了2，3，接着在 2，3的子树中分别找到1，总共找了 5 个索引项。

右边：因为 a 是等值查询，先在 a 索引中找到了2，c 也是等值查询在 c 索引中找到了1，接着在 1 的子树下找到了 b 索引中的 2，3（查询条件是 b>=2 and b <=3 ），总共找到 4 个索引项。

#### SR原则

下面我们来说明为什么在建立组合索引时要把排序字段要放在范围字段前面。

```javascript
db.test.find({a: 2, b: {$gte: 2, $lte: 3}).sort({c: 1})
```

假设对于以上查询，我们以两种方式建立一个组合索引：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402173349.png)

针对以上两种方式建立的索引 mongo 是如何查找的呢？如下图所示：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402174042.png)

左边：先在 a 索引中找到了2，然后在 b 索引中找到了2，3，然后分另在2，3子树下找到所有的值 1,3,1,2,4，最后我们需要按 c 来排序（对c的数字要排序），但我们拿到的值  1,3,1,2,4 不是按 c 的来排序的，所以我们必须要在内存中排序，内存排序在数据量大的时候是一个非常重的操作，需要把磁盘中的数据加载到内存，然后排序好后再回写到磁盘等操作。

右边：因为 a 是等值查询，先在 a 索引中找到了2，接着是 c，c 是按数字排序就会在 c 的索引中拿到按 c 排序的数字（1,2,3,4），然后需要对 c 索引中的1,2,3,4下面的子树分别去找到我们想要的数据（ b >=2 and b <=3），但这个操作只需要在内存是做匹配，不需要在内存中做排序。

### 地理位置索引

创建索引：

```javascript
db.geo_col.createIndex(
  { location: “2d”}, 
  { min:-20, max: 20 , bits: 10},
  { collation: {locale: "simple"} }
)
```

查询：

```javascript
db.geo_col.find( 
  { location: 
  		{$geoWithin: 
  { $box: [[1,1], [3,3]]}}}
)
```

比如：geoWithin  给你一个长方形 box，从左上角坐标（1,1）到右下角坐标（3，3）这个矩形范围内的所有的坐标点都给我查询出来。

查询结果：

```javascript
{ "_id" : ObjectId("5c7e7a6243513eb45bf06125"), "location" : [ 1, 1 ] }
{ "_id" : ObjectId("5c7e7a6643513eb45bf06126"), "location" : [ 1, 2 ] }
{ "_id" : ObjectId("5c7e7a6943513eb45bf06127"), "location" : [ 2, 2 ] }
{ "_id" : ObjectId("5c7e7a6d43513eb45bf06128"), "location" : [ 2, 1 ] }
{ "_id" : ObjectId("5c7e7a7343513eb45bf06129"), "location" : [ 3, 1 ] }
{ "_id" : ObjectId("5c7e7a7543513eb45bf0612a"), "location" : [ 3, 2 ] }
{ "_id" : ObjectId("5c7e7a7743513eb45bf0612b"), "location" : [ 3, 3 ] }
```

### 全文索引

插入数据：

```javascript
db.<collection_name>.insert(
  { _id: 1, content: “This morning I had a cup of coffee.”, about:“beverage”, keywords:[“coffee”]} ,
  { _id: 2, content: "Who doesn't like cake?", about:"food", keywords:["cake", "food", "dessert"]},
  { _id: 3, content: "Why need coffee?", about:”food", keywords: [”drink","food"]}
)
```
创建索引：

```javascript
db.<collection_name>.createIndex(
  	{‘content’:“text”} 
)
```
查询：

```javascript
db.<collection_name>.find(
  {
     $text:{$search: ”cup coffee like"}
  } 
) 
 
db.<collection_name>.find(
  {
    $text:{$search: “ a cup of coffee”}
  }
)
```
查询排序：

```javascript
db.<collection_name>.find( 
  {$text:{$search:”coffee"} },
  {textScore:{$meta:"textScore" }}).sort({textScore:{$meta:"textScore"}})
```

### 部分索引

索引目标文档：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402181629.png)

例如对以上数据，正常情况下创建索引时 {‘a’:1} 时默认会对所有的文档创建索引，但是我们为了节省资源，假设不想对a < 5的文档建立索引（有可能小于5的文档是历史数据不会再被用到），应该怎么做呢？

我们可以在创建索引时通过 partialFilterExpression参数来过滤掉一些不需要创建索引的文档。

创建索引：a 的值必须要大于等于5的文档才创建索引，

```javascript
db.<collection_name>.createIndex( 
  {‘a’:1}, 
  {partialFilterExpression:{
    a:{$gte:5}
  }
)   
```

别外一个场景是：因为 mongo 是 JSON 文档可以随时增加和删除字段，比如第一个版本文档中没有 wechat 字段，该字段是后面的需求加上的，但我们希望只对有wechat字段的文档建索引：

```javascript
db.<collection_name>.createIndex( 
  {‘wechat’:1}, 
  {partialFilterExpression:
   {wechat:{$exists: true}}
)
```

## 其他索引技巧

* 使用`background: true`在后台创建索引

  ```javascript
  db.member.createIndex({city: 1}, {background: true})
  ```

* 如果有一些节点是专门用来做BI或报表的，那么对这些节点创建索引时可以采用一些特殊的方式来创建索引，比如：
  * 把该节点的优先级（priority）设为0 
  * 关闭该从节点
  * 以单机模式启动，让它离开复制集
  * 添加索引（分析用）
  * 关闭该从节点，以副本集模式启动

## 参考

* https://www.mongodb.com/docs/v4.2/indexes/