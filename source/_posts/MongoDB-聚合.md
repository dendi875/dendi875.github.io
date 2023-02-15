---
title: MongoDB 聚合
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-02-06 09:42:37
password:
summary: MongoDB 聚合
tags:
	- MongoDB
	- NoSQL
categories: MongoDB
---

# MongoDB 聚合

聚合操作是 MongoDB 中非常实用的一个功能，它类似于 SQL 中的 `where`、`group by`等，是可以用来做一些分析、统计、复杂数据的计算和处理。

## 什么是 MongoDB 聚合框架

MongoDB 聚合框架（Aggregation Framework）是一个计算框架，它可以：

* 作用在一个或几个集合上
* 对集合中的数据进行一系列计算
* 将这些数据转化为期望的形式

从效果上而言，聚合框架相当于 SQL 查询中的：

* group by 
* left outer join
* as 等

## MongoDB 聚合中的几个概念

### 管道（Pipeline）和步骤（Stage）

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221114115245.png)

整个聚合运算的过程称为管道（Pipeline），它是由多个步骤（stage）组成的，每个管道：

* 接受一系列文档（原始数据）
* 每个步骤对这些文档进行一系列运算
* 结果文档输出给下一个步骤

## 聚合运算

### 基本格式

```bash
db.collection.aggregate( [ { <stage> }, ... ] )
```

### 常见步骤

https://www.mongodb.com/docs/v4.2/reference/operator/aggregation-pipeline/

| 步骤                  | 作用                   | SQL 等价运算符  |
| --------------------- | ---------------------- | --------------- |
| `$match`              | 过滤                   | where<br>having |
| `$project`            | 投影                   | select <br>as   |
| `$sort`               | 排序                   | order by        |
| `$group`              | 分组                   | group by        |
| `$skip`/`$limit`      | 结果限制               | skip/limit      |
| `$lookup`             | 左外连接，可以多表关联 | left outer join |
| `$unwind`             | 展开数组               | N/A             |
| `$graphLookup`        | 图搜索                 | N/A             |
| `$facet`<br>`$bucket` | 分面搜索               | N/A             |

### 常见步骤中的运算符

https://www.mongodb.com/docs/v4.2/reference/operator/aggregation/

| $match                                                       | $project                                                     | $group                                                       |
| :----------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `$eq`<br/>`$gt`<br/>`$gte`<br/>`$lt`<br/>`$lte`<br/>`$and`<br/>`$or`<br/>`$not`<br/>`$in`<br/>`$geoWithin`<br/>`$interset`<br/>...... | 选择需要的或排除不需要的字段<br/>`$map`<br/>`$reduce`<br/>`$filter`<br/>`$range`<br/>`$multiply`<br/>`$divide`<br/>`$substract`<br/>`$add`<br/>`$year`<br/>`$month`<br/>`$dayOfMonth`<br/>`$hour`<br/>`$minute`<br/>`$second`<br/>...... | `$sum`<br/>`$avg`<br/>`$push`<br/>`$addToSet`<br/>`$first`<br/>`$last`<br/>`$max`<br/>`$min`<br/>...... |

## 聚合运算的使用场景

* 聚合查询可以用于 OLAP 和 OLTP 场景，例如：

  | OLTP | OLAP                                                         |
  | ---- | ------------------------------------------------------------ |
  | 计算 | 分析一段时间内的销售总额、均值<br/>计算一段时间内的净利润<br/>分析购买人的年龄分布<br/>分析学生成绩分布<br/>统计员工绩效 |

* MQL 常用步骤与 SQL 对比

  举例 1：查找所有性别是男性的用户，跳过 100 个，取 20 个，只取名和姓两个字段。

  * SQL：

    ```sql
    SELECT
    first_name as '名',
    last_name as '姓'
    FROM users
    WHERE gender='男'
    SKIP 100
    LIMIT 20
    ```

  * MQL：

    ```sql
    db.users.aggregate([
        {$match: {gender: "男"}},
        {$skip: 100},
        {$limit: 20},
        {$project: {
        '名': '$first_name',
        '姓': '$last_name'
        }}
     ])
    ```

  举例2：查找所有性别是女性的用户，然后按部门进行分组统计人数，只看人数小于 10 人的部门。

  * SQL：

    ```sql
    SELECT
    department, count(NULL) as emp_qty
    FROM users
    WHERE gender='女'
    GROUP BY department HAVING emp_qty < 10
    ```

  * MQL：

    ```sql
    db.users.aggregate([
      	{$match: {gender: '女'}},
      	{$group: {
      		_id: '$department',
      		emp_qty: {$sum: 1}
      	}},
        {$match: {emp_qty: {$lt: 10}}}
    ])
    ```

* MQL 特有步骤

  * 举例  `$unwind` 的使用

    首先插入一些测试数据：

    ```sql
    db.students.insertOne({
    		name: "张三",
        score: [
          {subject: '语文', score: 84},
          {subject: '数学', score: 90},
          {subject: '英语', score: 69},
        ]                  
    })
    ```

    使用 `$unwind` 把数组展开：

    ```sql
    db.students.aggregate([{$unwind: '$score'}])
    
    // output
    { "_id" : ObjectId("6375aaa44835f42d80eba3c3"), "name" : "张三", "score" : { "subject" : "语文", "score" : 84 } }
    { "_id" : ObjectId("6375aaa44835f42d80eba3c3"), "name" : "张三", "score" : { "subject" : "数学", "score" : 90 } }
    { "_id" : ObjectId("6375aaa44835f42d80eba3c3"), "name" : "张三", "score" : { "subject" : "英语", "score" : 69 } }
    ```

  * 举例 `$bucket` 的使用

    参考官网  [$bucket](https://www.mongodb.com/docs/v4.2/reference/operator/aggregation/bucket/)

  * 举例 `$facet` 的使用

    参考官网  [$facet](https://www.mongodb.com/docs/v4.2/reference/operator/aggregation/facet/)


## 参考

* https://www.mongodb.com/docs/v4.2/aggregation/
* https://www.mongodb.com/docs/v4.2/reference/operator/aggregation-pipeline/
* https://www.mongodb.com/developer/products/mongodb/introduction-aggregation-framework/
* https://www.mongodb.com/docs/v4.2/reference/sql-aggregation-comparison/