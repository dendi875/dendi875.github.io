---
title: 不停服不修改代码条件下重建 Elasticsearch 索引
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-07-10 18:40:02
password:
summary: 不停服不修改代码条件下重建 Elasticsearch 索引
tags:
  - Elasticsearch
  - 中间件
categories:
  - Elasticsearch
---

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/es.png)

## 一、前言

在某些情况下，重建索引不可避免。例如，如果我们需要更改任何现有的字段映射（mapping）或分析器（analyzer）。ES 是不允许直接更改的，因些需要重建一个与现有索引分开的新索引。


我们来分析下如何才能做到 **不停服不修改代码** 情况下重建索引？

### 不停服

不能停服，那就要求新老索引在系统中能平稳过渡，需要在重建新索引时保持旧索引还在使用状态。因此，当旧索引仍然在使用的时候，我们不能将现有老索引名称用于新索引，必须得创建一个新的索引名称。


### 不修改代码

要做到每次重建时不更新代码而使用新的索引名称，那就要求我们代码中不能直接使用索引名称进行搜索和索引文档。我们应该为索引创建一个别名，并在我们的搜索/索引代码中使用别名。然后在重建时更新ES中的别名以指向新索引。这样，我们访问索引的代码就不需要在每次重建索引时都更新发版。


## 二、借助工具

* cerebro

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cerebro.png)

* kibana

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/kibana.png)


cerebro 和 kinaba 都有控制台来输入执行命令，十分方便


## 三、重建索引步骤

### 在搜索和索引的代码中使用别名

1. 最终要使用重建的索引，原始的索引将被删除。如果你的代码中正在直接使用索引名，在重建前创建别名，更新代码。如果已经使用的是别名那可以跳过这一步。

```shell
POST /_aliases
{
  "actions": [
    {
      "add": {
        "index": "current_index", // 原有索引
        "alias": "alias1" // 服务的别名
      }
    }
  ]
}
```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/es-alias.jpeg)


2. 记得查看 Elasticsearch 的 Disk Usage，如果不够，请先申请好足够的空间。
### 创建新索引

和创建普通索引一样创建新索引。这里值得一提的时，当数据量很大的时候，需要设置刷新时间间隔，在此期间写入的数据不能搜到，从而提高重建速度：```refresh_intervals = -1, number_of_replicas = 0```

```shell
PUT /new_index
{
    "settings": {
        "index": {
            "number_of_replicas": "0",
            "number_of_shards": "18"
        }
    },
    "mappings": {
        "properties": {}
    }
}
```


### 关闭自动刷新
```shell
PUT new_index/_settings
{
    "index" : {
        "refresh_interval" : "-1"
    }
}
```

ES 中刷新索引和写入磁盘是两个不同的过程。

**刷新索引**：当一个文档被索引时，它被添加到内存缓冲区并附加到 translog 文件中。当刷新发生时，缓冲区中的文档被写入一个新的 segment，没有发生 fsync，该 segment 被打开以使其对搜索可见并清除缓冲区。 translog 尚未清除，实际上没有任何东西保存到磁盘（因为没有发生 fsync）。没有索引刷新，你不能搜索你的文档，段不是在缓存中创建的

**写入磁盘**：默认情况下，当 translog 大小达到 512mb 或 30 分钟后。这实际上是将数据保存在磁盘上，其他所有内容都在文件系统缓存中（如果节点死亡或机器重新启动，缓存将丢失，translog 是唯一的救赎）

此处的refresh_interval指的是刷新（写入磁盘）的时间。


默认情况下 refresh_interval 设置为 1s。 实际上，这在 ES 中可以称为昂贵的操作，尤其是在索引时。通过将 refresh_interval 设置为 -1 意味着您正在禁用它，并且在索引 ES 时可以为您带来显著的性能提升。 您只需要禁用 refresh_interval （完成索引数据后再次启用它）

### 数据迁移，把老索引数据迁移到新索引中

使用 ```reindex API``` 就可以将数据 copy 到新索引中。这里几条路可以选：

1. 当只是改变 mapping 数据结构时，可以仅仅使用 reindex api 即可。例如：删除字段，更新字段分词方式等。

2. 当需要写入新的字段，新的字段是由老的字段计算得到时，可以使用 script 参数。例如，计算某条数据某字段的总和。script 有很多坑，当 script 出错时，reindex 跑了很久之后失败，即使将数据恢复，也需要重新跑 reindex。
3. 当含有很复杂的逻辑时，还是自己写程序吧。

调用 reindex 接口，接口将会在 reindex 结束后返回，而接口返回超时只有30秒，如果 reindex 时间过长，建议加上wait_for_completion=false的参数条件，这样 reindex 将直接返回taskId


```shell
POST _reindex?wait_for_completion=false
{
  "source": {
    "index": "current_index",
    "size":5000
  },
  "dest": {
    "index": "new_index"
  }
}
```


### 重建索引中

重建索引非常耗时，可以使用 ```task API``` 以看到重建进程，其中包含耗时，剩余doc数量等信息。

```shell
GET _tasks/{taskID}
```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/es-task2.png)

如果发现错误，可以使用```PUT _tasks/{taskID}/cancel```接口放弃任务，从头再来。


### 恢复自动刷新，恢复副本数

```shell
PUT new_index/_settings
{
    "index" : {
        "refresh_interval" : "1s",
        "number_of_replicas" : "1"
    }
}
```


### 给新索引设置别名，它的名称为程序中使用的，解除老索引与别名的绑定

```shell
POST /_aliases
{
    "actions": [
        {
            "add": {
                "index": "new_index",
                "alias": "alias1"
            },
            "remove": {
                "index": "current_index",
                "alias": "alias1"
            }
        }
    ]
}
```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/es-new_index.jpeg)


### 删除旧索引

```shell
DELETE current_index
```

删除旧的 index，释放磁盘空间


## 四、总结

* 修改索引是一件费时费力的工作，特别是如果发生了错误，整个人都不好了。所以还是在创建索引的时候尽量想好能否满足需求

* 我们使用Kafka把Mysql中的数据同步到Elasticsearch中的，如果没有kafka，也要记录同步数据的时间，方便后面重新同步数据。无论使用哪种同步数据的方式，都需要记录同步数据的offset或时间。重建索引可能非常耗时，在这段时间内，同步进程仍然在向旧索引更新数据，此时重建索引是无法更新这些新数据的。


## 五. 参考资料

- https://medium.com/craftsmenltd/rebuild-elasticsearch-index-without-downtime-168363829ea4
- https://stackoverflow.com/questions/36449506/what-exactly-does-1-refresh-interval-in-elasticsearch-mean
- [Elasticsearch 刷新间隔与索引性能]( https://sematext.com/blog/elasticsearch-refresh-interval-vs-indexing-performance/)
- [教你如何在 elasticsearch 中重建索引](https://juejin.cn/post/6844903605967781902)


