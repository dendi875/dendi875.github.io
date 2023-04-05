---
title: MongoDB 索引机制（上）
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-04-02 18:35:29
password:
summary: MongoDB 索引机制（上）
tags:
	- MongoDB
	- NoSQL
categories: MongoDB
---

## 术语

### Index/Key/DataPage（索引/键/数据页）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402152907.png)

### Covered Query/FETCH（查询覆盖/抓取）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402153256.png)

如果所有需要的字段都在索引中，不需要额外的字段，就可以不再需要从数据页加载数据，这就是**查询覆盖**。

在 Mongo 中我们可以把想要查找的字段组成一个索引，以后如果想要查寻这些字段的数据就不需要查真正的文档了，在索引中就能快速拿到想要的数据。

比如：我们想要找查 firstName、lastName、gender、age 这四个字段，可以把这四个字段组成一个索引。

```javascript
db.human.createIndex(
  {
    "firstName": 1,
    "lastName": 1,
    "gender": 1,
    "age": 1
  }
)
```

### IXSCAN/COLLSCAN（索引扫描/集合扫描）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402154033.png)

IXSCAN: 索引扫描，表示在**索引表**中对集合项一项一项查过去，索引页面不会太多

COLLSCAN：集合扫描或者表扫描，在关系型数据库中叫做**全表扫描**

### Big O Notation（时间复杂度）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402154601.png)

时间复杂度：用来表示一个查询所需要的时间。

如上图所示，x 轴表示数据量，y 轴表示查询所需要的时间，COLLSCAN 的时间复杂度是一个线性增长的

### Query Shape（查询的形状）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402155158.png)

查询的形状：你的查询条件用到了哪些字段，如上图所示，用到了 attributes.name 和 attributes.value 这两个字段的等值查询，

不同的查询形状对不同的索引是有影响的。

### Index Prefix（索引前缀）

Index Prefix： 表示当你创建一个索引时，如果这个索引是一个组合索引，比如有 firstName、lastName、gender、age 这四个字段

那么你当创建是一个索引时，它是有三个前缀的。

```javascript
db.human.createIndex({firstName: 1, lastName: 1, gender: 1, age: 1})
```

以上索引的全部前缀包括：

* {firstName: 1}
* {firstName: 1, lastName: 1}
* {firstName: 1, lastName: 1, gender: 1}

**所有索引前缀都可以被该索引覆盖，没有必要针对这些查询建立额外的索引**

### Selectivity（过滤性）

假设在一个有10000条记录的用户集合中：

* 满足 gender= F（女性） 的记录有4000 条 ，1W条中有 4000条是女性用户
* 满足 city=SH 的记录有 100 条，1W 条中有 100 条城市是在上海的用户
* 满足 name="zhangsan" 的记录有 10 条，1W 条中有 10 条名字叫张三的用户

条件 name 能过滤掉最多的数据，city 其次，gender 最弱。所以 name 的过滤性（selectivity）大于 city 大于 gender。 

如果要查询同时满足：gender == F && city == SH && name == ‘zhangsan’ 的记录，但只允许为 gender/city/name 中的一个建立索引，应该把索引放在哪里？肯定是**把索引建在过滤性最强的那个字段上**。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402161713.png)

## B树结构

索引背后是 B-树。要正确使用索引，必须先了解 B-树的工作原理。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402161809.png)

B- 树： 基于B树，但是子节点数量可以超过2个。

## 数据结构与算法复习

由于 B树/B-树的工作过程过于复杂，但本质上它是一个有序的数据结构。我们用数组来理解它。

假设索引为 {a: 1}（a 升序）：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230402162009.png)

## 参考

* https://www.mongodb.com/docs/v4.2/indexes/