---
title: Elasticsearch-PHP API 的使用
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2021-12-05 18:37:19
password:
summary: PHP 作为 Elasticsearch 客户端的基本操作
tags:
	- PHP
	- Elasticsearch
    - 中间件
categories:
	- Elasticsearch
---

--------------------------

## 概述

在[elasticsearch研究学习](https://zhangquan.me/2021/06/29/elasticsearch-xue-xi-yan-jiu/)文章中，详细的介绍了`ES`的重要概念、安装和配置、**ik** 中文分词插件的使用、基本的 **Elasticsearch APIs** 的使用。`ES`的官方客户端在`PHP`、`Java`、`Go`、`Python`等其他许多语言中都是可用的。

本篇我们就来学习下`PHP`作为`ES`客户端的基本操作。

## 安装

在 `composer.json` 文件中增加 elasticsearch-php：

```sh
{
    "require": {
        "elasticsearch/elasticsearch": "~5.0"
    }
}
```

使用`composer install`命令来安装客户端：

```sh
composer install --no-dev
```

最后加载 autoload.php，并实例化一个客户端对象：

```php
define('ES_SERVER',	 'es.servers.dev.ofc:9200');

require_once('vendor/autoload.php');

use Elasticsearch\ClientBuilder;

$client = ClientBuilder::create()
                            ->setHosts(array(ES_SERVER))
                            ->setRetries(0)
                            ->build();
```

## API 的使用

### 索引的操作

索引管理操作可以使你管理`ES`集群中的索引，例如：创建、删除、更新索引以及索引的设置和索引的映射。

#### 创建索引

创建索引使用的是`create`函数：

```php
$params = [
    'index' => 'orders'
];

$response = $client->indices()->create($params);
```

你可以在创建索引时把所需要的请求正文放到`body`参数中：

```sh
$params = [
    'index' => 'userdoor',	// 索引名字，类比数据库
    'body' => [
        'settings' => [
            'number_of_replicas' => 1,
            'number_of_shards'	=>  5,
            'max_result_window' => 1000,
        ],
        'mappings' => [
            'person' => [	 // 类型名字，类比数据表
                '_source' => ['enabled' => true],
                'properties' => [ // 下面是包括字段名称，类比数据表中的字段
                    'name' => ['type' => 'string', 'analyzer' => 'ik_max_word'], // 姓名
                    'title' => ['type' => 'string', 'analyzer' => 'ik_max_word'], // 头衔
                    'desc' => ['type' => 'string', 'analyzer' => 'ik_max_word'], // 备注
                ]
            ]
        ]
    ]
];

$response = $client->indices()->create($params);
```

我们可以验证是否索引是否创建成功：

```sh
$ curl -X GET 'http://localhost:9200/userdoor?pretty' -d ''
{
  "userdoor" : {
    "aliases" : { },
    "mappings" : {
      "person" : {
        "properties" : {
          "desc" : {
            "type" : "text",
            "analyzer" : "ik_max_word"
          },
          "name" : {
            "type" : "text",
            "analyzer" : "ik_max_word"
          },
          "title" : {
            "type" : "text",
            "analyzer" : "ik_max_word"
          }
        }
      }
    },
    "settings" : {
      "index" : {
        "number_of_shards" : "5",
        "provided_name" : "userdoor",
        "max_result_window" : "1000",
        "creation_date" : "1576396958776",
        "number_of_replicas" : "1",
        "uuid" : "kvwBns5gThOTB2qX2TIwbA",
        "version" : {
          "created" : "5050399"
        }
      }
    }
  }
}
```


#### 调整索引映射设置

[Put Mappings API](https://www.elastic.co/guide/en/elasticsearch/client/php-api/5.0/_index_management_operations.html#_put_mappings_api) 允许你修改现有索引的映射，或添加新的映射

比如我们可以再加两个字段`age`和`timeCreated`：

```sh
$params = [
    'index' => 'userdoor',
    'type' => 'person',
    'body' => [
        'person' => [
            'properties' => [
                'timeCreated' => [
                    'type' => 'date',
                    'format' => 'yyyy-MM-dd HH:mm:ss'
                ],
                'age' => [
                    'type' => 'integer'
                ]
            ]
        ]
    ]
];

// Update the index mapping
$client->indices()->putMapping($params);
```

我们可以验证是否更新成功：

```sh
$ curl -X GET 'http://localhost:9200/userdoor?pretty' -d ''
{
  "userdoor" : {
    "aliases" : { },
    "mappings" : {
      "person" : {
        "properties" : {
          "age" : {
            "type" : "integer"
          },
          "desc" : {
            "type" : "text",
            "analyzer" : "ik_max_word"
          },
          "name" : {
            "type" : "text",
            "analyzer" : "ik_max_word"
          },
          "timeCreated" : {
            "type" : "date",
            "format" : "yyyy-MM-dd HH:mm:ss"
          },
          "title" : {
            "type" : "text",
            "analyzer" : "ik_max_word"
          }
        }
      }
    },
    "settings" : {
      "index" : {
        "number_of_shards" : "5",
        "provided_name" : "userdoor",
        "max_result_window" : "1000",
        "creation_date" : "1576396958776",
        "number_of_replicas" : "1",
        "uuid" : "kvwBns5gThOTB2qX2TIwbA",
        "version" : {
          "created" : "5050399"
        }
      }
    }
  }
}
```

#### 删除索引

使用`delete`函数来删除索引

```sh
$params = ['index' => 'userdoor'];
$response = $client->indices()->delete($params);
```

### 文档的操作

#### 新增文档

使用`index`函数来新增文档

* 单条文档的新增

提供`ID`值：

```php
$params = [
    'index' => 'userdoor',
    'type' => 'person',
    'id' => '1',
    'body' => [
        'name' => '张三',
        'title' => '架构师',
        'desc' => '系统架构师',
        'age' => 28,
        'timeCreated' => date('Y-m-d H:i:s'),
    ]
];

// Document will be indexed to userdoor/person/1
$response = $client->index($params);
```

让`ES`自已生成`ID`：

```sh
$params = [
    'index' => 'userdoor',
    'type' => 'person',
    'body' => [
        'name' => '李四',
        'title' => '程序员',
        'desc' => '前端开发',
        'age' => 28,
        'timeCreated' => date('Y-m-d H:i:s'),
    ]
];

// Document will be indexed to userdoor/person/<autogenerated ID>
$response = $client->index($params);
```

* 批量文档的新增

使用`bulk`来批量增加文档。

```php
for ($i = 0; $i < 3; $i++) {
    $params['body'][] = [
        'index' => [
            '_index' => 'userdoor',
            '_type' => 'person',
        ]
    ];

    $params['body'][] = [
        'name' => '王五'.$i,
        'title' => '测试',
        'desc' => '自动化测试',
        'age' => 26 + $i,
        'timeCreated' => date('Y-m-d H:i:s'),
    ];
}

$responses = $client->bulk($params);
```

#### 查看文档

使用`get`函数来查看文档

```sh
$params = [
    'index' => 'userdoor',
    'type' => 'person',
    'id' => '1'
];

// Get doc at /userdoor/person/1
$response = $client->get($params);
```
#### 更新文档

使用`update`函数来更新文档：

```sh
$params = [
    'index' => 'userdoor',
    'type' => 'person',
    'id' => '1',
    'body' => [
        'doc' => [
            'desc' => '系统架构师，业务架构师'
        ]
    ]
];

// Update doc at /userdoor/person/1
$response = $client->update($params);
```

#### 删除文档

使用`delete`函数来删除文档：

```sh
$params = [
    'index' => 'userdoor',
    'type' => 'person',
    'id' => 1
];

// Delete doc at /userdoor/person/1
$response = $client->delete($params);
```


### 搜索的操作

* Match 查询

```php
$params = [
    'index' => 'userdoor',
    'type' => 'person',
    'body' => [
        'query' => [
            'match' => [
                'desc' => '架构师'
            ]
        ]
    ]
];

$results = $client->search($params);
```

以上示例输出：

```sh
$ php es.php
Array
(
    [took] => 9
    [timed_out] =>
    [_shards] => Array
        (
            [total] => 5
            [successful] => 5
            [failed] => 0
        )

    [hits] => Array
        (
            [total] => 1
            [max_score] => 1.1000589
            [hits] => Array
                (
                    [0] => Array
                        (
                            [_index] => userdoor
                            [_type] => person
                            [_id] => 1
                            [_score] => 1.1000589
                            [_source] => Array
                                (
                                    [name] => 张三
                                    [title] => 架构师
                                    [desc] => 系统架构师，业务架构师
                                    [age] => 28
                                    [timeCreated] => 2019-12-15 08:44:01
                                )

                        )

                )

        )

)
```

还可以使用原生`json`来代替数组：

```sh
$json = '{
	"query": {
		"match": {
			"desc": "架构师"
		}
	}
}';

$params = [
    'index' => 'userdoor',
    'type' => 'person',
    'body' => $json
];

$results = $client->search($params);
```

* Bool 查询

```php
$params = [
    'index' => 'userdoor',
    'type' => 'person',
    'body' => [
        'query' => [
            'bool' => [
                'must' => [
                    ['match' => ['name' => '王五']],
                    ['match' => ['age' => 28]],
                ]
            ]
        ]
    ]
];

$results = $client->search($params);
```

## 参考资料

- [elasticsearch研究学习](https://zhangquan.me/2021/06/29/elasticsearch-xue-xi-yan-jiu/)
- [官方 Elasticsearch-PHP API 文档](https://www.elastic.co/guide/en/elasticsearch/client/php-api/5.0/index.html)
- [官方 Elasticsearch-PHP API 中文文档](https://www.elastic.co/guide/cn/elasticsearch/php/current/_quickstart.html)