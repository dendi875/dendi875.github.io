---
title: Elasticsearch 学习研究
top: false
cover: false
toc: true
mathjax: true
date: 2021-06-29 15:22:28
password:
summary: 全文搜索引擎 Elasticsearch 的安装使用
tags:
	- Elasticsearch
  - 中间件
categories:
  - Elasticsearch
---

# Elasticsearch 学习研究
------------

## 1. Elasticsearch 介绍

Elasticsearch（ES）是基于文本搜索库[Lucene](https://lucene.apache.org/)构建的高度可扩展的分布式开源搜索和分析引擎。

如果有足够的计算机，ES集群通常可以跨非常大的数据集执行搜索和聚合查询。
如果你希望对一组文本文档进行传统的全文本搜索（类似于 Google 搜索），则ES很适合，

Elasticsearch 主要用于搜索和日志分析，也是当今最流行的日志分析平台（ELK）（Elasticsearch，Logstash和Kibana）的核心。它在处理大数据（如：系统日志，网络流量）时非常有用。

## 2. Elasticsearch 中的重要概念

![Elasticsearch](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/Elasticsearch.png)

### 2.1 Cluster（集群）

cluster是一个或一组服务器（节点）的集合，这些节点一起协同保存你的数据，并在所有节点之间为你提供索引和搜索功能。cluster具有唯一名称标识（默认是elasticsearch），你只需要指定集群标识名，启动的时候，凡是集群是这个名字的节点都会默认加到同一个集群中，选举master节点和节点管理都是自动完成的。当然一个节点也可以组成一个集群。

### 2.2 Node（节点）

node是参与到cluster的单个服务器节点，具有唯一标识名，可加入到指定的cluster中。 单个es实例称为一个节点（node）。一组节点构成一个集群（cluster）。

### 2.3 Index（索引）

Index是一类文档的集合。例如，你可以为用户数据创建一个索引，为商品数据创建另一个索引，为订单数据创建另一个索引。es 数据管理的顶层单位就叫做 Index（索引），相当于传统数据库中的数据库。每个 Index （即数据库）的名字必须是小写。

es数据的索引、搜索和分析都是基于索引完成的。每个Index包含多个shard，默认是5个，分散在不同的node上。当索引创建完成的时候，主分片的数量就固定了，但是复制分片的数量可以随时调整。

在单个cluster中，你可以创建任意个Index。

下面的命令可以查看当前节点的所有 Index。

```sh
$ curl -X GET 'http://localhost:9200/_cat/indices?v' -d ''
health status index  pri rep docs.count docs.deleted store.size pri.store.size
yellow open   orders   5   1          0            0       650b           650b
```

### 2.4 Type（类型）

Type是 Index 中数据的 ，在索引中，你可以定义一个或多个类型。它是索引中虚拟逻辑的分组，用来过滤    Document ，相当于传统数据库的表。

不同的 Type 应该有相似的结构（schema），举例来说，`id`字段不能在这个 Type 是字符串，在另 Type 是数值。这是与关系型数据库的表的一个[区别](https://www.elastic.co/guide/en/elasticsearch/reference/2.3/mapping.html)。

举例来说，在一个商城系统中，你可以定义一个订单的 type（orders_order），可以定义一个商品的 type（orders_product），还可以定义一个日志的 type（orders_log）。

下面的命令可以列出每个 Index 所包含的 Type。

```sh
$ curl 'http://localhost:9200/_mapping?pretty=true'
```

### 2.5 Document（文档）

Document是es数据可被索引化的基本的存储单元，需要存储在Type中，相当于传统数据库的行记录。

Index 里面单条的记录称为 Document（文档）。许多条 Document 构成了一个 Index。

Document 使用 JSON 格式表示，下面是一个例子。

```sh
{
  "name": "张三",
  "title": "工程师",
  "desc": "数据库管理"
}
```

### 2.6 Shard（分片）

一个索引可能会存储大量的数据，进而会让单个节点超出硬件能承受范围。举例来说，存储了10亿文档的单个节点，会占用1TB磁盘空间，并且会导致查询的时候速度很慢。

为了解决这个问题，Elasticsearch 提供了分片，也就是将index细分为多个碎片的功能。当你创建index的时候，你可以简单地指定你想要的分片数量。每一个分片具有和 index 完全相同的功能。

碎片最主要的两个作用是：

* 它允许你水平地切割你的容量体积
* 它允许你并行地分发作业，提高系统的性能

默认在创建索引时会创建5个分片，这个数量可以修改。分片的数量只能在创建索引的时候指定，不能在后期修改。

### 2.7 Replicas（副本）

因为各种原因，所以数据丢失等问题会时有发生，碎片也可能会丢失，为了防止这个问题，所以你可以将一个或多个索引碎片复制到所谓的复制碎片，简称为副本。

副本最主要的两个作用是：

* 它提供了高可用性，以防碎片/节点失败。基于这点，所以副本的永远不要和原始碎片分布在同一个节点上
* 它可以扩展系统的吞吐量，因为搜索可以在所有副本上执行

默认情况下，Elasticsearch为每个索引分配了5个主碎片和1个副本，这意味着在你的集群中，如果至少有两个节点，那么每个索引将有5个主碎片和5个复制碎片，每个索引总共10个碎片。


将Elasticsearch和传统关系型数据库Mysql做一下类比：


MySQL |Elasticsearch|
------|----------------|
Database（数据库） | Index（索引）|
Table（表）|Type（类型） |
Row（行）|Document（文档） |
Column（列）|Field（字段） |
Schema（方案）|Mapping（映射） |
Index（索引）|Everything Indexed by default（默认情况下所有字段都被索引） |
SQL（结构化查询语言）|Query DSL（查询专用语言） |



## 3. Elasticsearch 安装和配置

### 3.1 安装

Elasticsearch 至少需要 Java 7  环境。如果你的机器还没安装 Java，可以参考[这篇文章](https://www.liquidweb.com/kb/install-java-8-on-centos-7/)。

安装完 Java，就可以跟着[官方文档](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/_installation.html#_installation)安装 Elasticsearch。

```sh
# cd /usr/local/software/
# curl -L -O https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-5.5.3.tar.gz
# # tar -zxvf elasticsearch-5.5.3.tar.gz  -C /usr/local/
# # cd /usr/local/elasticsearch-5.5.3/
# ./bin/elasticsearch
```

如果这时报错"Exception in thread "main" java.lang.RuntimeException: don't run elasticsearch as root."，表示不能以超级用户root启动es，我们新建一个用户：

```sh
# useradd es
# passwd es
# chown -R es:es /usr/local/elasticsearch-5.5.3/
# su - es
$ /usr/local/elasticsearch-5.5.3/bin/elasticsearch
```

如果这时报错“max file descriptors [4096] for elasticsearch process is too low, increase to at least [65536]”，这表示文件描述符太少了，我们需要设置文件描述数量：

查看`es`用户硬限制：

```sh
$ ulimit -Hn
4096
```

打开`/etc/security/limits.conf`增加一行：

```sh
es  - nofile  65536
```

退出`es`用户，再重新看硬限制：

```sh
$ ulimit -Hn
65536
```

如果一切正常，es 就会在默认的9200端口运行。开启另一个终端查看es进程和端口：

```
# ps -ef | grep elastic
es        1753  1726  8 18:14 pts/1    00:00:02 /bin/java -Xms2g -Xmx2g -XX:+UseConcMarkSweepGC -XX:CMSInitiatingOccupancyFraction=75 -XX:+UseCMSInitiatingOccupancyOnly -XX:+AlwaysPreTouch -server -Xss1m -Djava.awt.headless=true -Dfile.encoding=UTF-8 -Djna.nosys=true -Djdk.io.permissionsUseCanonicalPath=true -Dio.netty.noUnsafe=true -Dio.netty.noKeySetOptimization=true -Dio.netty.recycler.maxCapacityPerThread=0 -Dlog4j.shutdownHookEnabled=false -Dlog4j2.disable.jmx=true -Dlog4j.skipJansi=true -XX:+HeapDumpOnOutOfMemoryError -Des.path.home=/usr/local/elasticsearch-5.5.3 -cp /usr/local/elasticsearch-5.5.3/lib/* org.elasticsearch.bootstrap.Elasticsearch
root      1793  1596  0 18:14 pts/0    00:00:00 grep --color=auto elastic

# netstat -tlunp | grep 9200
tcp6       0      0 127.0.0.1:9200          :::*                    LISTEN      1753/java
```

可以看到es已经正常启动，除了查看es进程和端口外，我们还可以执行：

```sh
# curl 'http://localhost:9200'
{
  "name" : "Onl1EgV",
  "cluster_name" : "elasticsearch",
  "cluster_uuid" : "P3CrVh_BTO-1EVzJlyWXKg",
  "version" : {
    "number" : "5.5.3",
    "build_hash" : "9305a5e",
    "build_date" : "2017-09-07T15:56:59.599Z",
    "build_snapshot" : false,
    "lucene_version" : "6.6.0"
  },
  "tagline" : "You Know, for Search"
}
```

上面代码中，请求9200端口，es 返回一个 JSON 对象，包含当前节点、集群、版本等信息。

以上es的运行方式可以通过`CTRL+C`或关闭窗口来停止运行，平时我们可以通过守护进程的方式在后台启动es：

```sh
$ ./bin/elasticsearch -d
```
如果是后台启动后想要停止es，可以通过`ps -ef | grep elastic`找到es进程PID，然后`kill`掉就行

### 3.2 配置

认情况下，es 只允许本机访问，如果需要远程访问，可以修改 es 安装目录的*ES_HOME/config/elasticsearch.yml*文件，去掉**network.host**的注释，将它的值改成`0.0.0.0`，然后重新启动 es。

如果远程还不能访问可能需要检查下**防火墙**和**SELinux**的设置。

其它配置项的解释可以参考[官方页面](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/settings.html)

## 4. Elasticsearch 插件

### 4.1 IK 中文分词插件

es 内置的分词器对中文不友好，会把中文分成单个字来进行全文检索，不能达到想要的结果，ik 可以进行友好的分词及自定义分词。

内置的分词器对中文会一个一个拆分，如下面是内置分词器的效果：

```ssh
$ curl -H 'Content-Type: application/json'  -X GET 'localhost:9200/_analyze?pretty' -d '
> {
> "analyzer": "default",
> "text":"今天天气真好"
> }
> '
{
  "tokens" : [
    {
      "token" : "今",
      "start_offset" : 0,
      "end_offset" : 1,
      "type" : "<IDEOGRAPHIC>",
      "position" : 0
    },
    {
      "token" : "天",
      "start_offset" : 1,
      "end_offset" : 2,
      "type" : "<IDEOGRAPHIC>",
      "position" : 1
    },
    {
      "token" : "天",
      "start_offset" : 2,
      "end_offset" : 3,
      "type" : "<IDEOGRAPHIC>",
      "position" : 2
    },
    {
      "token" : "气",
      "start_offset" : 3,
      "end_offset" : 4,
      "type" : "<IDEOGRAPHIC>",
      "position" : 3
    },
    {
      "token" : "真",
      "start_offset" : 4,
      "end_offset" : 5,
      "type" : "<IDEOGRAPHIC>",
      "position" : 4
    },
    {
      "token" : "好",
      "start_offset" : 5,
      "end_offset" : 6,
      "type" : "<IDEOGRAPHIC>",
      "position" : 5
    }
  ]
}
```

首先，安装中文分词插件。这里使用的是[ik](https://github.com/medcl/elasticsearch-analysis-ik/)

```sh
[es@localhost elasticsearch-5.5.3]$ ./bin/elasticsearch-plugin install https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v5.5.3/elasticsearch-analysis-ik-5.5.3.zip
```

接着，重新启动 Elastic，就会自动加载这个新安装的插件。

IK支持两种分词模式：

* ik_max_word: 会将文本做最细粒度的拆分，会穷尽各种可能的组合
* ik_smart: 会做最粗粒度的拆分

接下来，我们看看 IK 分词效果和自带的有什么不同。

先试一下`ik_smart`的效果：

```sh
 curl -H 'Content-Type: application/json'  -X GET 'localhost:9200/_analyze?pretty' -d '
> {
> "analyzer": "ik_smart",
> "text":"今天天气真好"
> }
> '
{
  "tokens" : [
    {
      "token" : "今天天气",
      "start_offset" : 0,
      "end_offset" : 4,
      "type" : "CN_WORD",
      "position" : 0
    },
    {
      "token" : "真好",
      "start_offset" : 4,
      "end_offset" : 6,
      "type" : "CN_WORD",
      "position" : 1
    }
  ]
}
```
再试一下`ik_max_word`的效果：

```sh
{
  "tokens" : [
    {
      "token" : "今天天气",
      "start_offset" : 0,
      "end_offset" : 4,
      "type" : "CN_WORD",
      "position" : 0
    },
    {
      "token" : "今天",
      "start_offset" : 0,
      "end_offset" : 2,
      "type" : "CN_WORD",
      "position" : 1
    },
    {
      "token" : "天天",
      "start_offset" : 1,
      "end_offset" : 3,
      "type" : "CN_WORD",
      "position" : 2
    },
    {
      "token" : "天气",
      "start_offset" : 2,
      "end_offset" : 4,
      "type" : "CN_WORD",
      "position" : 3
    },
    {
      "token" : "真好",
      "start_offset" : 4,
      "end_offset" : 6,
      "type" : "CN_WORD",
      "position" : 4
    }
  ]
}
```

设置mapping默认分词器：

```sh
curl -X PUT 'localhost:9200/userdoors' -d '
{
  "mappings": {
    "person": {
      "properties": {
        "name": {
          "type": "text",
          "analyzer": "ik_max_word",
          "search_analyzer": "ik_max_word"
        },
        "title": {
          "type": "text",
          "analyzer": "ik_max_word",
          "search_analyzer": "ik_max_word"
        },
        "desc": {
          "type": "text",
          "analyzer": "ik_max_word",
          "search_analyzer": "ik_max_word"
        }
      }
    }
  }
}'
```

面代码中，首先新建一个名称为`userdoor`的Index，里面有一个名称为`person`的 Type。person有三个字段`name`、`title`、`desc`。


**注意：** 这里设置`search_analyzer`与`analyzer` 相同是为了确保搜索时和索引时使用相同的分词器，以确保查询中的术语与反向索引中的术语具有相同的格式。如果不设置`search_analyzer`，则 `search_analyzer` 与 `analyzer` 相同。详细请查阅官网[搜索分析器](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/search-analyzer.html)

### 4.2 head 插件

## 5. Elasticsearch REST APIs 的使用

### 5.1 Indices APIs（索引API）

索引API用于对索引进行各种管理，如：创建索引、删除索引、获取索引等，还包括，索引设置，别名管理，映射管理，状态管理等。

#### 创建索引

新建 Index，可以直接向 es 服务器发出 PUT 请求。下面的例子是新建一个名叫orders的 Index。

```sh
$ curl -X PUT 'http://localhost:9200/orders' -d ''
{"acknowledged":true}
```

服务器返回一个 JSON 对象，里面的`acknowledged`字段表示操作成功。

#### 删除索引

我们发出 DELETE 请求，删除这个 Index。

```sh
$ curl -X DELETE 'http://localhost:9200/orders'
{"acknowledged":true}
```

### 5.2 Document APIs（文档API）

#### 新增文档

向指定的 /Index/Type 发送 PUT 请求，就可以在 Index 里面新增一条记录。比如，向`/userdoor/person`发送请求，就可以新增一条人员记录。

```sh
$ curl -X PUT 'localhost:9200/userdoor/person/1?pretty=true' -d '
> {
>   "name": "张三",
>   "title": "工程师",
>   "desc": "数据库管理"
> }'
{
  "_index" : "userdoor",
  "_type" : "person",
  "_id" : "1",
  "_version" : 4,
  "result" : "created",
  "_shards" : {
    "total" : 2,
    "successful" : 1,
    "failed" : 0
  },
  "created" : true
}
```

最后的1是该条记录的 `Id`。它不一定是数字，任意字符串（比如abc）都可以。**URL** 的参数`pretty=true`表示以易读的格式返回。

新增记录的时候，也可以不指定 `Id`，让`es`自动生成唯一的`Id`这时要改成 **POST** 请求。

```sh
$ curl -X POST 'localhost:9200/userdoor/person?pretty' -d '
> {
>   "name": "李四",
>   "title": "工程师",
>   "desc": "运维管理"
> }'
{
  "_index" : "userdoor",
  "_type" : "person",
  "_id" : "AW8ETT-SDmqcpvuz_i-w",
  "_version" : 1,
  "result" : "created",
  "_shards" : {
    "total" : 2,
    "successful" : 1,
    "failed" : 0
  },
  "created" : true
}
```

注意，如果没有先创建 Index（这个例子是userdoor），直接执行上面的命令，es 也不会报错，而是直接生成指定的 Index。


#### 查看文档

向/Index/Type/Id发出 GET 请求，就可以查看这条记录。

```sh
$ curl -X GET 'localhost:9200/userdoor/person/1?pretty=true'
{
  "_index" : "userdoor",
  "_type" : "person",
  "_id" : "1",
  "_version" : 4,
  "found" : true,
  "_source" : {
    "name" : "张三",
    "title" : "工程师",
    "desc" : "数据库管理"
  }
}
```

#### 更新文档

更新记录就是使用 PUT 请求，重新发送一次数据。

```sh
$ curl -X PUT 'localhost:9200/userdoor/person/1?pretty' -d '
> {
>   "name": "张三",
>   "title": "工程师",
>   "desc": "数据库管理，软件开发"
> }'
{
  "_index" : "userdoor",
  "_type" : "person",
  "_id" : "1",
  "_version" : 5,
  "result" : "updated",
  "_shards" : {
    "total" : 2,
    "successful" : 1,
    "failed" : 0
  },
  "created" : false
}
```

#### 删除文档

```sh
$ curl -X DELETE 'localhost:9200/userdoor/person/1?pretty' -d ''
```

### 5.3 Search APIs（搜索API）

#### 查询所有文档

使用 GET 方法，直接请求/Index/Type/_search，就会返回所有记录。

```sh
$ curl 'localhost:9200/userdoor/person/_search?pretty'
{
  "took" : 185,
  "timed_out" : false,
  "_shards" : {
    "total" : 5,
    "successful" : 5,
    "failed" : 0
  },
  "hits" : {
    "total" : 2,
    "max_score" : 1.0,
    "hits" : [
      {
        "_index" : "userdoor",
        "_type" : "person",
        "_id" : "AW8ETT-SDmqcpvuz_i-w",
        "_score" : 1.0,
        "_source" : {
          "name" : "李四",
          "title" : "工程师",
          "desc" : "运维管理"
        }
      },
      {
        "_index" : "userdoor",
        "_type" : "person",
        "_id" : "1",
        "_score" : 1.0,
        "_source" : {
          "name" : "张三",
          "title" : "工程师",
          "desc" : "数据库管理，软件开发"
        }
      }
    ]
  }
}
```

上面代码中，返回结果的 `took`字段表示该操作的耗时（单位为毫秒），`timed_out`字段表示是否超时，`hits`字段表示命中的记录，里面子字段的含义如下。

* total：返回记录数，本例是2条。
* max_score：最高的匹配程度，本例是1.0。
* hits：返回的记录组成的数组。

返回的记录中，每条记录都有一个`_score`字段，表示匹配的程序，默认是按照这个字段降序排列。

### 5.4 Query DSL

Elastic 的查询非常特别，使用自己的[查询语法](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/query-dsl.html)，要求 GET 请求带有数据体。

```sh
$ curl 'localhost:9200/userdoor/person/_search?pretty'  -d '
> {
>   "query" : { "match" : { "desc" : "软件" }}
> }'
{
  "took" : 27,
  "timed_out" : false,
  "_shards" : {
    "total" : 5,
    "successful" : 5,
    "failed" : 0
  },
  "hits" : {
    "total" : 1,
    "max_score" : 0.28582606,
    "hits" : [
      {
        "_index" : "userdoor",
        "_type" : "person",
        "_id" : "1",
        "_score" : 0.28582606,
        "_source" : {
          "name" : "张三",
          "title" : "工程师",
          "desc" : "数据库管理，软件开发"
        }
      }
    ]
  }
}
```

上面代码使用 [Match 查询](https://www.elastic.co/guide/en/elasticsearch/reference/5.5/query-dsl-match-query.html) ，指定的匹配条件是`desc`字段里面包含"软件"这个词

## 6. 参考资料

- [Elasticsearch 官方手册](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [elasticsearch-head](https://github.com/mobz/elasticsearch-head)




