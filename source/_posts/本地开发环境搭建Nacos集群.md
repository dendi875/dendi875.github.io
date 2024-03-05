---
title: 本地开发环境搭建Nacos集群
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-02-27 14:25:49
password:
summary: 本地开发环境搭建Nacos集群
tags:
  - Nacos
  - 服务治理
  - 配置中心
categories:
  - 后端和架构
---

## 下载 Nacos Server

Nacos Server 的安装包可以从 Alibaba 官方 GitHub 中的 [Release页面下载]()。我们就选择稳定版本 2.0.3。

在选择 Nacos 版本的时候你要注意，一定要选择**稳定版**使用，不要选择版本号中带有 BETA 字样的版本（比如 2.0.0-BETA）。后者通常是重大版本更新前预发布的试用版，往往会有很多潜在的 Bug 或者兼容性问题。

Nacos 2.0.3 Release note 下方的 Assets 面板中包含了该版本的下载链接，你可以在 nacos-server-2.0.3.tar.gz 和 nacos-server-2.0.3.zip 这两个压缩包中任选一个下载。如果你对 Nacos 的源码比较感兴趣，也可以下载 Source code 源码包来学习。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240227134545.png)

下载完成后，你可以在本地将 Nacos Server 压缩包解压，并将解压后的目录名改为“nacos-cluster1”，再复制一份同样的文件到 nacos-cluster2，我们以此来模拟一个由两台 Nacos Server 组成的集群。

``` bash
$ ls -ld  nacos*
drwxr-xr-x@ 11 zhangquan  staff        352  2 27 11:29 nacos-cluster1
drwxr-xr-x@ 10 zhangquan  staff        320  2 27 11:29 nacos-cluster2
-rw-r--r--@  1 zhangquan  staff  117598819  2 26 21:31 nacos-server-2.0.3.zip
```

到这里，我们就完成了 Nacos 服务器的下载安装，接下来，我带你去修改 Nacos Server 的启动项参数。

## 修改启动项参数

Nacos Server 的启动项位于 config 目录下的 application.properties 文件里，别看这个文件里的配置项密密麻麻一大串，但大部分都不用你操心，直接使用默认值就好。你只需要修改这里面的服务启动端口和数据库连接串就好了。

因为你需要在一台机器上同时启动两台 Nacos Server 来模拟一个集群环境，所以这两台 Nacos Server 需要使用不同的端口，否则在启动阶段会报出端口冲突的异常信息。

Nacos Server 的启动端口由 server.port 属性指定，默认端口是 8848。我们在 nacos-cluster1 中仍然使用 8848 作为默认端口，你只需要把 nacos-cluster2 中的端口号改掉就可以了，这里我把它改为 8948。

文件：` /Users/zhangquan/Downloads/my_software/nacos-cluster2/conf/application.properties`

```properties
server.port=8948
```

接下来，你需要对 Nacos Server 的 DB 连接串做一些修改。在默认情况下，Nacos Server 会使用 Derby 作为数据源，用于保存配置管理数据。Derby 是 Apache 基金会旗下的一款非常小巧的嵌入式数据库，可以随 Nacos Server 在本地启动。但从系统的可用性角度考虑，我们需要将 Nacos Server 的数据源迁移到更加稳定的 MySQL数据库中。

你需要修改三处 Nacos Server 的数据库配置，nacos-cluster1 和 nacos-cluster2 都要修改。

1.   **指定数据源**：spring.datasource.platform=mysql 这行配置默认情况下被注释掉了，它用来指定数据源为 mysql，你需要将这行注释放开；
2.   **指定 DB 实例数**：放开 db.num=1 这一行的注释；
3.   **修改 JDBC 连接串**：db.url.0 指定了数据库连接字符串，我指向了 localhost 3306 端口的 nacos 数据库，稍后我将带你对这个数据库做初始化工作；db.user.0 和 db.password.0 分别指定了连接数据库的用户名和密码，我使用了有密码 root 账户。

下面是完整的数据库配置项：

```properties
#*************** Config Module Related Configurations ***************#
### If use MySQL as datasource:
spring.datasource.platform=mysql

### Count of DB:
db.num=1

### Connect URL of DB:
db.url.0=jdbc:mysql://127.0.0.1:3306/nacos?characterEncoding=utf8&connectTimeout=1000&socketTimeout=3000&autoReconnect=true&useUnicode=true&useSSL=false&serverTimezone=UTC
db.user.0=root
db.password.0=1qaz@WSX

### Connection pool configuration: hikariCP
db.pool.config.connectionTimeout=30000
db.pool.config.validationTimeout=10000
db.pool.config.maximumPoolSize=20
db.pool.config.minimumIdle=2
```

修改完数据库配置项之后，接下来我带你去 MySQL 中创建 Nacos Server 所需要用到的数据库 Schema 和数据库表。

## 创建 DB Schema 和 Table

Nacos Server 的数据库用来保存配置信息、Nacos Portal 登录用户、用户权限等数据，下面我们分两步来创建数据库。

### 第一步，创建 Schema

你可以通过数据库控制台或者 Navicat 之类的可视化操作工具，执行下面这行 SQL 命令，创建一个名为 nacos 的 schema。

```bash
create schema nacos;
```

### 第二步，创建数据库表

Nacos 已经把建表语句准备好了，就放在你解压后的 Nacos Server 安装目录中。打开 Nacos Server 安装路径下的 conf 文件夹，找到里面的 nacos-mysql.sql 文件，你所需要的数据库建表语句都在这了。

将文件中的 SQL 命令复制下来，在第一步中创建的 schema 下执行这些 SQL 命令。执行完之后，你就可以在在数据库中看到这些 tables 了，总共有 12 张数据库表。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240227140516.png)

数据库准备妥当之后，我们还剩最后一项任务：添加集群机器列表。添加成功后就可以完成集群搭建了。

## 添加集群机器列表

Nacos Server 可以从一个本地配置文件中获取所有的 Server 地址信息，从而实现服务器之间的数据同步。

所以现在我们要在 Nacos Server（nacos-cluster1 和 nacos-cluster2 都需要新建 cluster.conf 文件） 的 conf 目录下创建 cluster.conf 文件，并将 nacos-cluster1 和 nacos-cluster2 这两台服务器的 IP 地址 + 端口号添加到文件中。下面是我本地的 cluster.conf 文件的内容：

```properties
#2024-02-27T11:29:51.765
172.16.48.130:8848
172.16.48.130:8948
```

这里需要注意的是，你不能在 cluster.conf 文件中使用 localhost 或者 127.0.0.1 作为服务器 IP，否则各个服务器无法在集群环境下同步服务注册信息。这里的 IP 应该使用你本机分配到的内网 IP 地址。

如果你使用的是 mac 或者 linux 系统，可以在命令行使用 ifconfig | grep “inet” 命令来获取本机 IP 地址，如下面inet 地址这行 172.16.48.130 就是本机的 IP 地址。

```bash
ifconfig | grep 'inet'
	inet 127.0.0.1 netmask 0xff000000
	inet6 ::1 prefixlen 128
	inet6 fe80::1%lo0 prefixlen 64 scopeid 0x1
	inet6 fe80::aede:48ff:fe00:1122%en5 prefixlen 64 scopeid 0x4
	inet6 fe80::180c:3fb0:88b4:90d3%en0 prefixlen 64 secured scopeid 0x6
	inet 172.16.48.130 netmask 0xfffffc00 broadcast 172.16.51.255
	inet6 fe80::4877:4fff:fe27:8e5b%awdl0 prefixlen 64 scopeid 0x7
	inet6 fe80::4877:4fff:fe27:8e5b%llw0 prefixlen 64 scopeid 0x8
	inet6 fe80::8615:66cb:f588:4c70%utun0 prefixlen 64 scopeid 0xe
	inet6 fe80::aa7:d53c:b00c:db20%utun1 prefixlen 64 scopeid 0xf
	inet 192.168.99.1 netmask 0xffffff00 broadcast 192.168.99.255
```

到这里，我们已经完成了所有集群环境的准备工作，接下来我带你去启动 Nacos Server 验证一下效果。

## 启动 Nacos Server

Nacos 的启动脚本位于安装目录下的 bin 文件夹，下图是 bin 目录下的启动脚本。其中 Windows 操作系统对应的启动脚本和关闭脚本分别是 startup.cmd 和 shutdown.cmd，Mac 和 Linux 系统对应的启动和关闭脚本是 startup.sh 和 shutdown.sh。

以 Mac 操作系统为例，如果你希望以单机模式（非集群模式）启动一台 Nacos 服务器，可以在 bin 目录下通过命令行执行下面这行命令：

```bash
/Users/zhangquan/Downloads/my_software/nacos-cluster1/bin/startup.sh -m standalone
```

通过 -m standalone 参数，我指定了服务器以单机模式启动。Nacos Server 在单机模式下不会主动向其它服务器同步数据，因此这个模式只能用于开发和测试阶段，对于生产环境来说，我们必须以 Cluster 模式启动。

如果希望将 Nacos Server 以集群模式启动，只需要在命令行直接执行  startup.sh 命令就可以了。这时控制台会打印以下两行启动日志。

```bash
/Users/zhangquan/Downloads/my_software/nacos-cluster1/bin/startup.sh

nacos is starting with cluster
nacos is starting，you can check the /Users/zhangquan/Downloads/my_software/nacos-cluster1/logs/start.out
```

对于 nacos-cluster2 也执行该命令：

```bash
/Users/zhangquan/Downloads/my_software/nacos-cluster2/bin/startup.sh

nacos is starting with cluster
nacos is starting，you can check the /Users/zhangquan/Downloads/my_software/nacos-cluster2/logs/start.out
```

这两行启动日志没有告诉你 Nacos Server 最终是启动成功还是失败，不过你可以在第二行日志中找到一些蛛丝马迹。这行日志告诉了我们启动日志所在的位置是 nacos-cluster1/logs/start.out，在启动日志中你可以查看到一行成功消息“Nacos started successfully in cluster mode”。当然了，如果启动失败，你也可以在这里看到具体的 Error Log。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240227141657.png)

我们用同样的方式先后启动 nacos-cluster1 和 nacos-cluster2，如上图所示，在启动日志中显示了成功消息“started successfully in cluster mode”，这代表服务器已经成功启动了，接下来你就可以登录 Nacos 控制台了。

## 登录 Nacos 控制台

在 Nacos 的控制台中，我们可以看到服务注册列表、配置项管理、集群服务列表等信息。在浏览器中打开[nacos-cluster1](http://172.16.48.130:8848/)和[nacos-cluster2](http://172.16.48.130:8948/)的地址，注意这两台服务器的端口分别是 8848 和 8948。你可以看到下面的 Nacos 的登录页面。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/install-4.png)

你可以使用 Nacos 默认创建好的用户 nacos 登录系统，用户名和密码都是 nacos。当然了，你也可以在登录后的权限控制 -> 用户列表页面新增系统用户。成功登录后，你就可以看到 Nacos 控制台首页了。

为了验证集群环境处于正常状态，你可以在左侧导航栏中打开“集群管理”下的“节点列表”页面，在这个页面上显示了集群环境中所有的 Nacos Server 节点以及对应的状态，在下面的图中我们可以看到 172.16.48.130:8848 和 172.16.48.130:8948 两台服务器，并且它们的节点状态都是绿色的“UP”，这表示你搭建的集群环境一切正常。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240227142150.png)

好，到这里，我们的 Nacos 集群环境搭建就完成了。如果你在搭建环境的过程中发现 Nacos 无法启动，只需要到启动日志 /logs/start.out 中就能找到具体的报错信息。如果你碰到了启动失败的问题，不妨先去检查以下两个地方：

1.   **端口占用**：即 server.port 所指定的端口已经被使用，你需要更换一个端口重新启动服务；

2.   **MySQL 连不上**：你需要检查 application.properties 里配置的 MySQL 连接信息是否正确，并确认 MySQL 服务处于运行状态；

## 参考资料

极客时间  [《Spring Cloud 微服务项目实战》](https://time.geekbang.org/column/intro/100101301)