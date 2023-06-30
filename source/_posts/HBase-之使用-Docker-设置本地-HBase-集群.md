---
title: HBase 之使用 Docker 设置本地 HBase 集群
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-05-22 10:32:16
password:
summary: HBase 之使用 Docker 设置本地 HBase 集群
tags:
	- HBase
	- NoSQL
categories: HBase
---
在本教程中，将使用 Docker Compose 设置我们自己的 HBase 集群。

## 先决条件

在安装本地 HBase 集群时，我们只需要 docker-compose。 

*  安装 Docker（略）

* 克隆仓库：https://github.com/big-data-europe/docker-hbase


## 设置 HBase 集群

这个[存储库 ](https://github.com/big-data-europe/docker-hbase)的 README 有说明如何启用。 但是，在搭建过程中发现了它的问题，有两个重要的端口没有开放，并且说明中没有提示要修改 `hosts`，下面我们就对原仓库调整并演示整个搭建流程：

### 将代码 clone 到本地

```bash
git clone git@github.com:big-data-europe/docker-hbase.git
```

### 调整原仓库

1. 在 `docker-compose-distributed-local.yml` 中的 `hbase-master`和`hbase-region` 中添加两个端口映射。 如下所示：

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230306184403.png)

2. `/etc/hosts` 中添加以下两项

   ```text
   127.0.0.1 hbase-master
   127.0.0.1 hbase-regionserver
   ```

### 启动我们的 Hbase 集群

```bash
docker-compose -f docker-compose-distributed-local.yml up -d
```

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230308105638.png)

`docker ps` 我们将看到七个 hbase 相关 Docker 容器实例以及一个 zookeeper 实例。

### **HBase Shell**  操作

1. 进入容器

   ```bash
   docker exec -it hbase-master /bin/bash
   ```

2. 运行 hbase shell

   ```bash
    /opt/hbase-1.2.6/bin/hbase shell
   ```

3. 进行简单的操作

   ```ba
   hbase(main):001:0> list
   TABLE
   bigdata:student
   test
   zq:user
   3 row(s) in 0.1460 seconds
   
   => ["bigdata:student", "test", "zq:user"]
   hbase(main):002:0>  scan 'bigdata:student'
   ROW                                                      COLUMN+CELL
    1001                                                    column=info:age, timestamp=1672133429754, value=30
   1 row(s) in 0.0870 seconds
   ```

### 访问HBase Web UI

Web UI展示了HBase集群的状态，其中包括整个集群概况信息、RegionServer和Master的信息、快照、运行进程等信息。通过Web UI提供的信息可以对整个HBase集群的状况有一定的了解。

1. 在浏览器中输入如下地址：

   ```javascript
   http://hbase-master:16010/
   ```

   其中 hbase-master 为主 Master 节点的地址，需要在 hosts 文件中做映射。16010 为HBaseMaster Web UI 的端口。 

   HBase 服务使用的默认端口参考：https://docs.cloudera.com/HDPDocuments/HDP3/HDP-3.1.0/administration/content/hbase-ports.html

2. 各页面简单说明

   * 在HBase的主Master的Web UI页面中，Home页面展示的是HBase的一些概况信息，具体包括以下信息：

     * Region Servers页面展示了RegionServer的一些基本信息：

       ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/RegionServer.png)

     * Backup Master页面展示了Backup Master的信息：

       ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/Backup-Master.png)

     * Tables页面显示了HBase中表的信息，包括User Tables、System Tables、Snapshots：

       ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/Tables.png)

     * Tasks页面显示了运行在HBase上的任务信息，包括开始时间，状态等信息：

       ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/Tasks.png)

   * 在HBase的Web UI页面中，Table Details页面展示的是HBase存储表的概要信息：

     ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/Table-Details.png)

   * 在HBase的Web UI页面中，Debug dump页面展示的是HBase的Debug信息

   * 在HBase的Web UI页面中，HBaseConfiguration页面展示的是HBase的配置信息

### 关闭我们的 Hbase 集群

```bash
docker-compose -f docker-compose-distributed-local.yml down
```

## 使用 HbaseGUI（图形客户端）

HbaseGUI可视化工具，通过Hbase-client直接操作Hbase。提供可视化查询、元数据管理和支持预分区建表三大功能。

使用介绍和下载在详细见：https://github.com/Observe-secretly/HbaseGUI

启动：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230308144347.png)

如果报以上错，则需要设置 JAVA_HOME：

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk1.8.0_211.jdk/Contents/Home
```

启动成功后配置连接信息：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230308144621.png)

连接成功后就可以很愉快的通过界面图形化的方式去操作 Hbase 了：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230308144951.png)