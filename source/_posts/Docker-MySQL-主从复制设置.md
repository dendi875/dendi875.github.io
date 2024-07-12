---
title: Docker MySQL 主从复制设置
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-07-12 10:40:35
password:
summary: Docker MySQL 主从复制设置
tags:
- MySQL	
categories:
- MySQL
---

这篇文章我们将使用 Docker 学习 MySQL 主从复制功能。

[docker-mysql-master-slave](https://github.com/vbabak/docker-mysql-master-slave) 仓库中包含了基于 Docker 的 MySQL 复制示例的配置和说明。

## 先决条件

*   您已经安装了Docker v.18或更高版本。
*   安装了 docker-compose v1.23 或更高版本。
*   非常基础的MySQL知识。

## 一些理论

MySQL 复制是一种特殊设置，涉及两个或多个 MySQL 服务器，其中一个数据库服务器（称为主服务器或源服务器）复制到另一个数据库服务器（称为从服务器或副本服务器）。副本同步过程是通过从源二进制日志中复制和执行 SQL 语句来完成的。 MySQL 配置允许选择整个源数据库或仅将特定表复制到副本。



默认情况下，MySQL复制的同步类型是异步的(单向的)，这意味着“副本”不会通知它的“源”关于复制和处理事件的结果。其他类型的同步(半同步、同步)可以通过插件或特殊设置(如NDB Cluster)获得



使用 MySQL 复制，您可以进行一些特定的配置类型：链式复制、循环复制（也称为主-主或环式复制）以及这些类型的组合。限制条件是复制只能有一个源服务器。

*   链式复制是指数据库服务器之间有一个链。例如：源 1 - > 副本 1 - > 副本 2。副本 1 是副本 2 的源，是源 1 的副本。当副本 1 包含一个 "合并 "数据库（由 "源 "表和它自己的 "添加 "表组成）时，这种复制就很有用。

*   循环复制假设在循环中有主数据库，同时也充当副本。示例：Master← → Master。这里的问题是列同步自动递增。解决方法是配置 "auto_increment_increment "和 "auto_increment_offset "服务器变量，根据每个主服务器的设置，以不同的步长或范围进行递增。如果使用 InnoDB，请考虑到在环形复制时，行不会总是被添加到副本索引的末尾，在这种情况下，由于聚类索引排序的原因，可能会导致在副本上出现额外的插入延迟。

## 实践

创建一个空目录并克隆存储库。

```shell
mkdir mysql-master-slave
cd mysql-master-slave
git clone https://github.com/vbabak/docker-mysql-master-slave ./
```

```shell
./build.sh
```

构建过程要求您的系统上未使用端口 4406 和 5506。否则，您可以将其更新为 docker-compose.yml 文件中任何未使用的端口并重新运行构建脚本。



如果一切顺利，你会收到这样的信息:等待mysql_master数据库连接…，最后是副本(slave)状态报告。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240712095706.png)

最后一行表示它正在等待来自 master 的新更新。

要测试复制是否正常工作，请在 Master 上运行以下查询：

```shell
docker exec -it mysql_master bash
mysql -u root -p'111' mydb
mysql> create table if not exists code(code int);
# Query OK, 0 rows affected, 1 warning (0.01 sec)
mysql> insert into code values (100), (200);
# Query OK, 2 rows affected (0.01 sec)
```

并检查副本:

```shell
docker exec -it mysql_slave bash
mysql -u root -p'111' mydb
mysql> select * from code;
+------+
| code |
+------+
|  100 |
|  200 |
+------+
```

## Master configuration

主服务器配置放在 "master/conf/mysql.conf.cnf "中。下面是一些解释。前两个选项用于提高服务器性能，与复制设置本身无关。

*   skip-host-cache

    禁用内部主机缓存，以加快名称到 IP 的解析速度。

*   skip-name-resolve

    禁用 DNS 主机名查询

*   server-id = 1

    对于复制中使用的服务器，必须指定一个唯一的服务器 ID。它必须不同于任何其他源或副本使用的其他 ID。

*   log_bin = /var/log/mysql/mysql-bin.log

    启用 bin 日志并设置二进制日志文件的基本名称和路径（如 log_bin_basename）。

*   binlog_format = ROW
    可能的值是 ROW（副本仅重播行上的实际更改）、STATMENT（副本重播更改数据的所有查询）、MIXED（使用基于语句的复制，除非服务器决定仅基于行的复制可以给出正确的结果，例如复制 GUIID() 的结果）。

*   binlog_do_db = mydb

    指定一个数据库，哪些语句将写入二进制日志文件。

    与在 docker 容器中启动 MySQL 相关的环境参数放置在“master/mysql_master.env”文件中。它们在  [mysql:5.7](https://hub.docker.com/_/mysql)镜像的 docker hub 网站上有描述。

如果您是 Windows 用户，build.sh 脚本可能无法工作，因此您需要通过创建 `mydb_slave_user` 用户来设置主数据库 — 在 Master 上运行 2 个 sql 命令，然后设置从数据库 — 在上运行 2 个 sql 命令复制品，请参阅下面的详细信息。

最后，在主服务器上添加复制用户。创建一个具有 REPLICATION SLAVE 权限的新用户进行复制：

```shell
# SETUP MASTER SQL COMMANDS
GRANT REPLICATION SLAVE ON *.* TO "mydb_slave_user"@"%" IDENTIFIED BY "mydb_slave_pwd";
FLUSH PRIVILEGES;
```

## Replica configuration

部分配置参数会重复主数据库。

*   relay-log = /var/log/mysql/mysql-relay-bin.log

    包含从源二进制日志读取的数据库事件。

**启动副本。**

首先，你需要找到一个master主机的ip地址。您可以检查主控主机上的“hosts”文件

```shell
docker exec -it mysql_master cat '/etc/hosts'
```

output:

```shell
127.0.0.1	localhost
::1	localhost ip6-localhost ip6-loopback
fe00::0	ip6-localnet
ff00::0	ip6-mcastprefix
ff02::1	ip6-allnodes
ff02::2	ip6-allrouters
192.168.16.2	617f30b23d6b
```

一行将包含 IP 地址，例如：172.19.0.2。这是一个MASTER_HOST。

其次，从此命令中查找日志文件和位置：

```shell
docker exec mysql_master sh -c 'export MYSQL_PWD=111; mysql -u root -e "SHOW MASTER STATUS \G"'
```

output:

```shell
*************************** 1. row ***************************
             File: mysql-bin.000003
         Position: 1040
     Binlog_Do_DB: mydb
 Binlog_Ignore_DB:
Executed_Gtid_Set:
```

“File:”为MASTER_LOG_FILE，“Position:”为MASTER_LOG_POS。

现在，当我们拥有所有变量后，我们可以修改并运行以下命令来启动复制：

```shell
# SETUP REPLICA SQL COMMANDS
CHANGE MASTER TO MASTER_HOST='${IP}', MASTER_USER='mydb_slave_user', MASTER_PASSWORD='mydb_slave_pwd', MASTER_LOG_FILE='${LOG}', MASTER_LOG_POS=$POS;
START SLAVE;
```

## 复制不安全语句和非确定性查询

在 MySQL 复制中，语句的 "安全性 "是指该语句及其效果能否使用基于语句的格式正确复制。如果语句是确定性的，那么它就是安全的。确定性是指语句总是产生相同的结果。使用基于语句的日志记录时，标记为不安全的语句会产生警告。[在此查看](https://dev.mysql.com/doc/refman/8.0/en/replication-rbr-safe-unsafe.html#replication-rbr-safe-unsafe-not)不安全语句列表。示例found_rows()、rand()、uuid()。

对于行级复制，不区分确定性和非确定性语句。基于行的复制的缺点是，当 WHERE 子句匹配大量行时，范围更新的成本会很高。

## 关闭 Docker 容器

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240712103807.png)

## 总结

复制是任何数据库的强大组成部分，幸运的是 MySQL 支持它。

使用范围广泛。它可用于高可用性和数据分发、数据备份、负载平衡。甚至可以根据地理位置优化延迟。

## 参考

*   https://github.com/vbabak/docker-mysql-master-slave