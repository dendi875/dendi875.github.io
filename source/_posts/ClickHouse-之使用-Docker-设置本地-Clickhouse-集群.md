---
title: ClickHouse 之使用 Docker 设置本地 Clickhouse 集群
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-07-11 10:17:31
password:
summary: ClickHouse 之使用 Docker 设置本地 Clickhouse 集群
tags:
	- ClickHouse
	- OLAP
categories: ClickHouse
---

在本教程中，我们将使用 Docker compose 设置我们自己的 Clickhouse 集群，并对设置 Clickhouse 集群所涉及的配置有一个基本的了解。

## 先决条件

在设置本地 Clickhouse 集群时，我们只需要 docker-compose。 

*  安装 Docker（略）

* 克隆仓库

  这个[存储库](https://github.com/jneo8/clickhouse-setup)的 README 已经包含了详细的解释。 但是，我们在这篇文章中的目标是更多地扩展这些步骤和配置。 

  ```shell
  git clone https://github.com/jneo8/clickhouse-setup
  ```

## 集群架构

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/clickhouse-arch.png)

在我们的架构中，我们将使用 Docker-compose 部署一个 Clickhouse 集群。 Docker-compose 将创建六个 clickhouse-servers（容器）和一个用于管理副本的 Zookeeper 实例。

该架构是分片+复制的。 我们将部署三个分片，其中每个分片包含两个副本。 请注意，同一分片的副本只会拥有完全相同的数据，因为一旦副本接收到数据，它就会被广播到另一个分片。

最后，我们将使用 tabiX，这是 clickhouse-server 附带的 SQL 编辑器，可以直接连接到它的 http 接口，使我们能够发送查询和接收结果集。

## 设置我们的 Clickhouse 集群

### 创建您的 Docker 容器网络

我们希望我们的 clickhouse-server 容器连接在一起，以便它们可以相互通信。

```shell
docker network create clickhouse-net
```

### 设置 tabiX（图形客户端）

tabiX 是 Clickhouse 自带的 SQL 编辑器和 UI 界面。 启用 tabiX 有两个步骤：

1. 将任何 Clickhouse 服务器的 TCP 端口 8123 映射到 Docker 主机上的端口 8123

   为此，只需在 docker-compose.yml 中的 clickhouse-server 中添加另一个端口映射。 您的每台服务器的 clickhouse-servers 配置应如下所示：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/tabix-ui-port.png)

2. 打开 http://localhost:8123 时加载 Tabix UI

   为此，请在 config/clickhouse_config.xml 中取消注释此 xml 属性 http_server_default_response

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/clickhouse_config.png)

3. （可选）设置数据持久化

   为此，只需删除数据卷部分中的 “#”。 在 docker-compose.yml 中，每个服务器的 clickhouse-servers 配置应如下所示：

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/clickhouse_data_persistence.png)

### 启动我们的 Clickhouse 集群

现在，我们需要“启动”我们的 Clickhouse 集群。 输入以下命令：

```shell
docker-compose up -d

# Check the running containers using
docker ps
```

我们将看到六个 clickhouse-server Docker 容器实例以及一个 zookeeper 实例。

### 连接服务器，看集群设置是否正常

```shell
docker run -it --rm --network="clickhouse-net" yandex/clickhouse-client --host clickhouse-01                                                                          
```

这将允许您直接与您的 clickhouse-01 服务器交互。
```shell
SELECT * FROM system.clusters
```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221228104348.png)

### 使用 tabiX 连接到你的 clickhouse 服务器

* 转到 http://localhost:8123。 这会将您定向到 Tabix。 如果没有，请确保您已在 clickhouse_config 文件中启用 Tabix 加载程序。
* 输入您的 Clickhouse 凭据
  * `Name`: 
  * [http://127.0.0.1:8123](http://127.0.0.1:8123)
  * `Login`：user14
  * `Password`： 123456

注意：此用户在 `config/users.xml` 中定义。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221228104914.png)

### 创建表

使用 tabiX 执行以下查询：

* 创建本地表

  本地表是指数据只会存储在当前写入的节点上，不会被分散到多台服务器上。 此查询将为 cluster_1 的所有 clickhouse-servers 创建表 default.ttt。 复制引擎意味着您在此表中插入的数据将被复制。 参数是我们的 zookeeper 中的路径和副本名称。

  ```shell
  CREATE TABLE default.ttt ON CLUSTER cluster_1 (
      id Int32
  ) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{layer}-{shard}/ttt', '{replica}') 
  PARTITION BY id 
  ORDER BY id;
  ```

* 分布式表

  本地表的集合，它将多个本地表抽象为一张统一的表，对外提供写入、查询功能。当写入分布式表时，数据会被自动分发到集合中的各个本地表中；当查询分布式表时，集合中的各个本地表都会被分别查询，并且把最终结果汇总后返回。允许在多个服务器上进行分布式查询处理。

  ```shell
  CREATE TABLE default.ttt_all AS default.ttt 
  ENGINE = Distributed(cluster_1, default, ttt, rand());
  ```

### 在 ReplicatedMergeTree 引擎表中测试插入和复制功能

```shell
INSERT INTO default.ttt_all
SELECT arrayJoin(range(1,101)) AS id
```

前面说了，Replicated Engine 的一张表，就是你要复制的数据。 如果我们查询 default.ttt 表，我们只会看到一部分数据（分片数据）。 同时，查询 default.ttt_all 表会让我们看到我们插入的所有 100 个数字。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/ReplicatedMergeTree.png)

在我们的设置中，clickhouse-01 和 clickhouse-06 是同一个分片的副本。 因此，我们期望 clickhouse-06 的数据与 clickhouse-01 的数据完全相同。

看看你把 clickhouse-06 的 8123 端口映射到了你的哪个端口 Docker 主机。 只需将端口更改为您拥有的端口号，然后重新登录到 tabiX 时映射。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/clickhouse-06.png)

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20221228152624.png)

### 关闭我们的 Clickhouse 集群

```shell
docker-compose down
```

## 配置文件

* docker-compose.yml

  在这里，我们定义了运行 Clickhouse 集群所需的服务。

  * **Zookeeper**：  这是 Clickhouse 用于存储副本元信息的服务。 这是 Clickhouse 集群提供的复制机制所必需的。
  * **Clickhouse-server**：Clickhouse 集群由多个 Clickhouse 服务器组成。 在这里，我们定义了所有 clickhouse-server 的属性。 一些属性包括端口映射（例如，用于 Clickhouse 的本机 TCP/IP 协议的端口 9000 和用于 Clickhouse 的 HTTP 接口的端口 8123）和卷（用于数据的持久性）。

* config/clickhouse_config.xml

  这是主服务器配置文件。 您可以在这里找到的一些东西包括 graphite 配置（用于监控）、TaBiX 启用、https 配置、查询日志记录、字典等。

* config/clickhouse_metrika.xml

  这是我们定义 Clickhouse 远程服务器、集群、分片、分片副本、网络和 Clickhouse 压缩配置的地方。

* config/users.xml

  您可以在此处找到用户设置、配置文件和配额。

* config/macros

  前面我们建表查询中用花括号括起来的变量你见过吗？ 这些变量称为宏，它们就像一个占位符，用于在查询提交到服务器后稍后进行替换。 在此文件夹中，我们为每个服务器定义了宏（{replica}、{shard}、{layer}）。

## 参考

*   https://clickhouse.com/docs
*   https://github.com/jneo8/clickhouse-setup