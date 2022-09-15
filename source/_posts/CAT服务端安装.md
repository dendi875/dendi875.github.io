---
title: CAT服务端安装
author: 张权
top: true
cover: true
toc: true
mathjax: true
date: 2021-11-26 15:51:11
password: 
summary: 调用链监控中间件 CAT 服务端安装部署
tags:
	- CAT
	- 中间件
	- JAVA
categories:
	- 监控
---

## 我的本地开发环境

* 操作系统： macOS Catalina 10.15.6
* IDE： Intelij IDEA
* JDK版本：1.8
* Mysql： 5.7.21
* Maven： 3.6.3
* Server version: Apache Tomcat/8.5.70

## 一、Cat 源代码下载

下载地址：https://github.com/dianping/cat

* cat源码：下载 master 分支代码 
* cat依赖包：下载 mvn-repo 分支代码

## 二、在本地打 cat 的 war 包

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20211126145728.png)

### 在cat工程执行编译命令

```shell
# zhangquan @ MacBook-Pro in ~/docker-php-dev/www/github/cat on git:master x [20:29:15] C:1
$ mvn clean compile
```

* 报错1：Could not find artifact org.unidal.framework:foundation-service:jar:2.5.0

```
[ERROR] Failed to execute goal on project cat-core: Could not resolve dependencies for project com.dianping.cat:cat-core:jar:3.0.0: The following artifacts could not be resolved: org.unidal.framework:foundation-ser
vice:jar:2.5.0, org.unidal.framework:web-framework:jar:2.4.0, org.unidal.framework:dal-jdbc:jar:2.4.0: Could not find artifact org.unidal.framework:foundation-service:jar:2.5.0 in alimaven (http://maven.aliyun.com/
nexus/content/groups/public) -> [Help 1]
```

解决：将下载的mvn-repo分支解压，放入到本地的.m2仓库中；

本地 mvn-repo 分支解压，解压出org目录，并将org目录拷贝到本地的.m2仓库中

```
$ ll ~/.m2/repository/org/unidal 
drwxrwxr-x@  3 zhangquan  180847186    96B 11 14  2017 eunit
drwxrwxr-x@ 11 zhangquan  180847186   352B 11 14  2017 framework
drwxrwxr-x@  4 zhangquan  180847186   128B 11 23 20:31 maven
drwxrwxr-x@  9 zhangquan  180847186   288B 11 14  2017 webres
```

再执行编译命令：

* 报错2：Could not find artifact org.codehaus.plexus:plexus-container-default:jar:3.1.0

```
[ERROR] Failed to execute goal org.unidal.maven.plugins:codegen-maven-plugin:2.5.8:dal-model (generate data model) on project cat-client: Execution generate data model of goal org.unidal.maven.plugins:codegen-maven-plugin:2.5.8:dal-model failed: Plugin org.unidal.maven.plugins:codegen-maven-plugin:2.5.8 or one of its dependencies could not be resolved: Could not find artifact org.codehaus.plexus:plexus-container-default:jar:3.1.0 in unidal (http://unidal.org/nexus/content/repositories/releases/) -> [Help 1]
```

解决：在.m2仓库找到org.unidal.maven.plugins:codegen-maven-plugin:2.5.8版本的pom文件codegen-maven-plugin-2.5.8.pom用idea打开，点击父引用的default，跳转到default-2.5.8.pom文件中，将文件中foundation-service.version从3.1.0版本修改为4.0.0版本；

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-2.png)

再执行编译命令：编译即可成功

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-3.png)


### 在cat根目录执行install命令

```
# zhangquan @ MacBook-Pro in ~/docker-php-dev/www/github/cat on git:master x [20:49:13] C:130
$ mvn clean install -DskipTests
```

报错：Failure to find org.unidal.framework:test-framework:jar:2.4.0

```
[ERROR] Failed to execute goal on project cat-client: Could not resolve dependencies for project com.dianping.cat:cat-client:jar:3.0.0: Failure to find org.unidal.framework:test-framework:jar:2.4.0 in http://unidal.org/nexus/content/repositories/releases/ was cached in the local repository, resolution will not be reattempted until the update interval of unidal has elapsed or updates are forced -> [Help 1]
```

解决：修改cat根目录的pom.xml文件中test-framework的版本，改为2.5.0

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-4.png)


再执行install命令：安装成功

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-5.png)

install成功后，将cat-home-3.0.0.war修改为cat.war

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20211126151958.png)


### 查看每个module具体生效的pom信息

在cat根目录执行命令：打开cat.txt，即可看到cat-home定义的version

``` shell
mvn help:effective-pom > cat.txt
```

## 三、服务端安装和配置

### 安装CAT的数据库

* 创建数据库，数据库名cat，数据库编码使用utf8mb4，否则可能造成中文乱码等问题；

```
CREATE DATABASE `cat` DEFAULT CHARACTER SET utf8mb4 ;
```
* 将 cat工程中，script目录中的 sql 拷贝到cat数据库运行

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20211126152613.png)


sql拷贝到cat数据库运行，初始化数据表；

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20211126152731.png)

由于MySQL的系统参数max_allowed_packet默认配置较小，可能会限制server接受的数据包大小，有时候大的插入和更新会被max_allowed_packet 参数限制掉，导致失败，所以要修改max_allowed_packet的值，修改后需要重启mysql；


![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-9.png)


### Cat配置文件

创建以下两个目录：

* /data/appdatas/cat
* /data/applogs/cat 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-6.png)

在 /data/appdatas/cat 目录中，添加 client.xml，datasources.xml 配置文件

client.xml配置

```
<?xml version="1.0" encoding="utf-8"?>
<config mode="client">
    <servers>
          <!-- 服务端地址, 端口固定-->
		  <!-- 如果有多个Server, 就继续增加相应的节点配置 -->
		  <!-- 这是告诉客户端应该去链接哪个服务端，从哪个服务端里获取配置信息 ，相关源码也在 DefaultClientConfigManager中 -->
		  <!--将172.16.48.114修改为部署CAT的内网IP,请不要写127.0.0.1和外网IP -->
		 <server ip="172.16.48.114" port="2280" http-port="8080" />
    </servers>
</config>
```

datasources.xml配置文件

```
<?xml version="1.0" encoding="utf-8"?>

<data-sources>
    <data-source id="cat">
        <maximum-pool-size>3</maximum-pool-size>
        <connection-timeout>1s</connection-timeout>
        <idle-timeout>10m</idle-timeout>
        <statement-cache-size>1000</statement-cache-size>
        <properties>
            <driver>com.mysql.jdbc.Driver</driver>
            <url><![CDATA[jdbc:mysql://www.myvbox.com:3306/cat]]></url>  <!-- 请替换为真实数据库URL及Port  -->
            <user>root</user>  <!-- 请替换为真实数据库用户名  -->
            <password>123456</password>  <!-- 请替换为真实数据库密码  -->
            <connectionProperties><![CDATA[useUnicode=true&characterEncoding=UTF-8&autoReconnect=true&socketTimeout=120000]]></connectionProperties>
        </properties>
    </data-source>
</data-sources>
```

### tomcat启动cat项目

将cat.war拷贝到tomcat的webapps目录，再启动tomcat；

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-7.png)

运行命令启动 tomcat

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-8.png)


启动成功后，访问：http://localhost:8080/cat/r

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20211126153830.png)


### 按照实际需要，修改服务端配置和客户端路由

使用admin/admin登录

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20211126154013.png)


进入【服务端配置】页面修改IP地址：
```
<?xml version="1.0" encoding="utf-8"?>
<server-config>
   <server id="default">
      <properties>
         <property name="local-mode" value="true"/>
         <property name="job-machine" value="true"/>
         <property name="send-machine" value="false"/>
         <property name="alarm-machine" value="false"/>
         <property name="hdfs-enabled" value="false"/>
         <property name="remote-servers" value="172.16.48.114:8080"/>
      </properties>
      <storage local-base-dir="/data/appdatas/cat/bucket/" max-hdfs-storage-time="15" local-report-storage-time="2" local-logivew-storage-time="1" har-mode="true" upload-thread="5">
         <hdfs id="dump" max-size="128M" server-uri="hdfs://127.0.0.1/" base-dir="/user/cat/dump"/>
         <harfs id="dump" max-size="128M" server-uri="har://127.0.0.1/" base-dir="/user/cat/dump"/>
         <properties>
            <property name="hadoop.security.authentication" value="false"/>
            <property name="dfs.namenode.kerberos.principal" value="hadoop/dev80.hadoop@testserver.com"/>
            <property name="dfs.cat.kerberos.principal" value="cat@testserver.com"/>
            <property name="dfs.cat.keytab.file" value="/data/appdatas/cat/cat.keytab"/>
            <property name="java.security.krb5.realm" value="value1"/>
            <property name="java.security.krb5.kdc" value="value2"/>
         </properties>
      </storage>
      <consumer>
         <long-config default-url-threshold="1000" default-sql-threshold="100" default-service-threshold="50">
            <domain name="cat" url-threshold="500" sql-threshold="500"/>
            <domain name="OpenPlatformWeb" url-threshold="100" sql-threshold="500"/>
         </long-config>
      </consumer>
   </server>
   <server id="172.16.48.114">
      <properties>
         <property name="job-machine" value="true"/>
         <property name="send-machine" value="false"/>
         <property name="alarm-machine" value="true"/>
      </properties>
   </server>
</server-config>

```

进入【客户端路由】页面修改IP地址：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20211126154551.png)

