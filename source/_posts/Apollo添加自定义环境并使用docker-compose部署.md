---
title: Apollo 添加自定义环境并使用 docker-compose 部署
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-07 18:24:48
password:
summary: 如何在 Apollo 中添加自定义环境并使用 docker-compose 部署使用
tags: Apollo、Java
categories: Apollo
---

## 一、前言

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/apollo.png)

Apollo（阿波罗）是一款可靠的分布式配置管理中心，诞生于携程框架研发部，能够集中化管理应用不同环境、不同集群的配置，配置修改后能够实时推送到应用端，并且具备规范的权限、流程治理等特性，适用于微服务配置管理场景。

关于 Apollo 的详细介绍请阅读官网 [Apollo](https://www.apolloconfig.com/#/zh/)

本篇文章主要介绍如何添加自定义环境并使用 docker-compose 部署，把搭建使用过程中遇到的各种问题在此记录一下。

## 二、为什么要添加自定义环境

官方的 Apollo 内置已经支持了以下几个环境：

* DEV（Development environment）开发环境
* FAT（Feature Acceptance Test environment）功能验收测试环境，也就做测试环境，相当于alpha环境 (功能测试)
* UAT（User Acceptance Test environment）用户验收测试环境，也叫做集成环境，相当于beta环境（回归测试）
* PRO（Production environment）生产环境

但某些时候我们应用中使用的环境在 Apollo 中是没有的或者使用的环境名称与 Aploo 内置环境名称不一样 ，比如一种情况是：我们应用部署时用 SIT（System Integration Test）来当做系统集成测试但在Apollo中是叫 UAT，这时如果去批量修改应用及调整 CI/CD 流程来兼容内置UAT环境，那成本是很高的，另一种情况是：我们需要额外添加一种环境，比如PRE（Pre-production environment）灰度环境。这两种情况下我们都需要添加自定义环境来适配我们已有的应用

 ## 三、如何添加自定义环境

### 下载源码

GitHub下载： https://github.com/ctripcorp/apollo 源码，这里以 V1.1.0 版本为例

```bash
# 下载源码
git clone git@github.com:apolloconfig/apollo.git 
# 找到自己想要的版本
git tag
# 取得 tag 对应的代码
git checkout v1.1.0
# 从 tag 创建一个分支就可以修改代码了
git checkout -b apollo-1.1.0 v1.1.0
```

### 修改源码

1. 假设需要添加的环境名称叫 docker

2. 修改 `com.ctrip.framework.apollo.core.enums.Env` 类，在其中加入`DOCKER`枚举：

   ```java
   public enum Env{
     LOCAL, DEV, FWS, FAT, UAT, LPT, PRO, TOOLS, UNKNOWN, DOCKER;
   	...
   }
   ```

3. 修改`com.ctrip.framework.apollo.core.enums.EnvUtils`类，在其中加入`DOCKER`枚举的转换逻辑：

   ```java
   public final class EnvUtils {
     
     public static Env transformEnv(String envName) {
       if (StringUtils.isBlank(envName)) {
         return Env.UNKNOWN;
       }
       switch (envName.trim().toUpperCase()) {
         case "LPT":
           return Env.LPT;
         case "FAT":
         case "FWS":
           return Env.FAT;
         case "UAT":
           return Env.UAT;
         case "PRO":
         case "PROD": //just in case
           return Env.PRO;
         case "DEV":
           return Env.DEV;
         case "LOCAL":
           return Env.LOCAL;
         case "TOOLS":
           return Env.TOOLS;
         case "DOCKER":
           return Env.DOCKER;
         default:
           return Env.UNKNOWN;
       }
     }
   }
   ```

4. 修改`apollo-portal/src/main/resources/apollo-env.properties`，增加`docker.meta`占位符：

   ```properties
   local.meta=http://localhost:8080
   dev.meta=${dev_meta}
   fat.meta=${fat_meta}
   uat.meta=${uat_meta}
   lpt.meta=${lpt_meta}
   pro.meta=${pro_meta}
   docker.meta=${docker_meta}
   ```

5. 修改`com.ctrip.framework.apollo.core.internals.LegacyMetaServerProvider`类，增加读取`DOCKER`环境的meta server地址逻辑：

   ```java
   public class LegacyMetaServerProvider {
    ...
    domains.put(Env.DOCKER,
               env.getProperty("docker_meta", prop.getProperty("docker.meta")));
    ...
   }
   
   ```

6. 检查安装 Java  JDK 和 Maven，进入源码文件夹 scripts 下 执行 build 脚本，编译打包 apollo

   ```bash
   # 源码文件夹 scripts 下
   cd /path/to/apollo/scripts
   # 编译打包 apollo
   ./build.sh
   ```

### 创建自定义环境的数据库

1. 创建自定义环境需要的 ApolloConfigDB 库

一套Portal可以管理多个环境，但是每个环境都需要独立部署一套Config Service、Admin Service和ApolloConfigDB

在源码的 scripts 文件夹下面找到 sql 的部署脚本，复制一份 apolloconfigdb.sql 并命名为 `apolloconfigdb_docker.sql`

* 修改建库语句

  ```sql
  # Create Database
  # ------------------------------------------------------------
  CREATE DATABASE IF NOT EXISTS ApolloConfigDBDocker DEFAULT CHARACTER SET = utf8mb4;
  
  Use ApolloConfigDBDocker;
  ```

* 调整自定义环境的 Eureka 地址

因为我们给自定义 docker 环境分配的 config service 端口为：8084，所以修改`apolloconfigdb_docker.sql` 文件中 `ServiceConfig`表`eureka.service.url` 字段值指向自己的 Eureka 地址，如下所示：

```sql
# Config
# ------------------------------------------------------------
INSERT INTO `ServerConfig` (`Key`, `Cluster`, `Value`, `Comment`)
VALUES
    ('eureka.service.url', 'default', 'http://localhost:8084/eureka/', 'Eureka服务Url，多个service以英文逗号分隔'),
    ('namespace.lock.switch', 'default', 'false', '一次发布只能有一个人修改开关'),
    ('item.value.length.limit', 'default', '20000', 'item value最大长度限制'),
    ('config-service.cache.enabled', 'default', 'false', 'ConfigService是否开启缓存，开启后能提高性能，但是会增大内存消耗！'),
    ('item.key.length.limit', 'default', '128', 'item key 最大长度限制');
```

* 添加自定义环境

在 `apolloportaldb.sql` 文件中 `ServerConfig`表`apollo.portal.envs`字段中添加我们自定义的 docker 环境，如下所示：

```sql
# Config
# ------------------------------------------------------------
INSERT INTO `ServerConfig` (`Key`, `Value`, `Comment`)
VALUES
    ('apollo.portal.envs', 'dev,uat,fat,pro,docker', '可支持的环境列表'),
    ('organizations', '[{\"orgId\":\"TEST1\",\"orgName\":\"样例部门1\"},{\"orgId\":\"TEST2\",\"orgName\":\"样例部门2\"}]', '部门列表'),
    ('superAdmin', 'apollo', 'Portal超级管理员'),
    ('api.readTimeout', '10000', 'http接口read timeout'),
    ('consumer.token.salt', 'someSalt', 'consumer token salt'),
    ('admin.createPrivateNamespace.switch', 'true', '是否允许项目管理员创建私有namespace');
```

2 . 进入MySql 中导入数据库脚本

```bash
source /sql/apolloportaldb.sql
source /sql/apolloconfigdb.sql
source /sql/apolloconfigdb_docker.sql
```



## 三、使用 docker-compose 部署添加自定义环境后的 Apollo

本 docker 是针对 https://github.com/foxiswho/docker-apollo 的改动

1. 修改源码编译打包后复制 apollo-configservice/target/apollo-configservice-1.1.0-github.zip ，apollo-adminservice/target/apollo-adminservice-1.1.0-github.zip ，apollo-portal/target/apollo-portal-1.1.0-github.zip  这三个 zip 文件到指定的文件夹下，如下图：

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/docker-apollo_1.png)

2. 建立 Dockerfile 文件，添加 docker 环境，完整内容如下：

   ```dockerfile
   FROM maven:alpine
   
   # 改动自  https://github.com/foxiswho/docker-apollo
   
   MAINTAINER quanzhang875 <quanzhang875@gmail.com>
   
   # 添加自定义 docker 环境的 admin端口：8094，config端口：8084
   ENV VERSION=1.1.0 \
       PORTAL_PORT=8070 \
       ADMIN_DEV_PORT=8090 \
       ADMIN_FAT_PORT=8091 \
       ADMIN_UAT_PORT=8092 \
       ADMIN_PRO_PORT=8093 \
       ADMIN_DOCKER_PORT=8094 \
       CONFIG_DEV_PORT=8080 \
       CONFIG_FAT_PORT=8081 \
       CONFIG_UAT_PORT=8082 \
       CONFIG_PRO_PORT=8083 \
       CONFIG_DOCKER_PORT=8084
   
   ARG APOLLO_URL=https://github.com/ctripcorp/apollo/archive/v${VERSION}.tar.gz
   
   
   COPY docker-entrypoint /usr/local/bin/docker-entrypoint
   
   # 下面的包是修改过的源码，加入了自定义环境docker
   ADD apollo-portal-${VERSION}-github.zip /
   ADD apollo-adminservice-${VERSION}-github.zip /
   ADD apollo-configservice-${VERSION}-github.zip /
   
   
   # 建立 docker 环境需要的admin和config目录
   RUN cd / && \
       mkdir /apollo-admin/dev /apollo-admin/fat /apollo-admin/uat /apollo-admin/pro /apollo-admin/docker -p && \
       mkdir /apollo-config/dev /apollo-config/fat /apollo-config/uat /apollo-config/pro /apollo-config/docker -p && \
       mkdir /apollo-portal -p && \
       unzip -o /apollo-adminservice-${VERSION}-github.zip -d /apollo-admin/dev && \
       unzip -o /apollo-configservice-${VERSION}-github.zip -d /apollo-config/dev && \
       unzip -o /apollo-portal-${VERSION}-github.zip -d /apollo-portal && \
       sed -e "s/db_password=/db_password=root/g"  \
               -e "s/^local\.meta.*/local.meta=http:\/\/localhost:${PORTAL_PORT}/" \
               -e "s/^dev\.meta.*/dev.meta=http:\/\/localhost:${CONFIG_DEV_PORT}/" \
               -e "s/^fat\.meta.*/fat.meta=http:\/\/localhost:${CONFIG_FAT_PORT}/" \
               -e "s/^uat\.meta.*/uat.meta=http:\/\/localhost:${CONFIG_UAT_PORT}/" \
               -e "s/^pro\.meta.*/pro.meta=http:\/\/localhost:${CONFIG_PRO_PORT}/" \
               -e "s/^docker\.meta.*/docker.meta=http:\/\/localhost:${CONFIG_DOCKER_PORT}/" -i /apollo-portal/config/apollo-env.properties && \
       cp -rf /apollo-admin/dev/scripts /apollo-admin/dev/scripts-default  && \
       cp -rf /apollo-config/dev/scripts /apollo-config/dev/scripts-default  && \
       cp -rf /apollo-admin/dev/*  /apollo-admin/docker/  && \
       cp -rf /apollo-config/dev/* /apollo-config/docker/  && \
       cp -rf /apollo-admin/dev/* /apollo-admin/uat/  && \
       cp -rf /apollo-admin/dev/* /apollo-admin/pro/  && \
       cp -rf /apollo-config/dev/* /apollo-config/uat/  && \
       cp -rf /apollo-config/dev/* /apollo-config/pro/ && \ 
       rm -rf *zip && \
       chmod +x  /usr/local/bin/docker-entrypoint
   
   EXPOSE 8070 8080 8081 8082 8083 8084 8090 8091 8092 8093 8094
   # EXPOSE 80-60000
   
   ENTRYPOINT ["docker-entrypoint"]
   ```

3. 建立 docker-entrypoint 脚本，添加 docker 环境

4. 构建镜像并把镜像推送到远程仓库

   ```bash	
   # 构建镜像
   ./build.sh 
   # 给镜像打个标记
   docker tag apollo-test:<TAG> dendi875/docker-apollo:1.1.0
   # 登录docker hub
   docker login
   # 把镜像推送到远程仓库
   docker push  dendi875/docker-apollo:1.1.0 
   ```

5. 使用 Docker Compose 启动，看到如下界面就代表启动成功

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/apollo_2.png)

6. 使用账号密码：apollo/admin 访问 Apollo 前台，效果如下：

   

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/apollo_3.png)

   

**完整的Dockerfile、docker-entrypoint、构建 docker-apollo 的源代码仓库地址：https://github.com/dendi875/docker-apollo**

## 四、如何在应用中使用添加自定义环境后的 Apollo

### 把修改过的 Apollo Clien jar 包上传到 nexus 私有仓库

因为我们应用中要使用添加自定义环境后的 Apollo Client jar 包，所以首先得把修改后的 jar 包上传到私有仓库

1. 修改 Maven【settings.xml】文件在【servers】标签下加入分配给自己的用户名密码，注意id要唯一，下面会用到

   ```xml
   <server>
     <id>releases</id>
     <!--鉴权用户名。鉴权用户名和鉴权密码表示服务器认证所需要的登录名和密码。--> 
     <username>admin</username>
      <!--鉴权密码 。鉴权用户名和鉴权密码表示服务器认证所需要的登录名和密码。-->  
     <password>123456</password>
   </server>
   
   <server>
     <id>snapshots</id>
     <username>admin</username>
     <password>123456</password>
   </server>
   ```

2. 修改 apollo 父 POM 的distributionManagement来指定Maven分发构件的位置，id是之前设置的【server】的id，url是对应的仓库地址

   ```xml
   <distributionManagement>
     <repository>
       <!--这是server的id（注意不是用户登陆的id），该id与配置文件中server元素的id相匹配-->  
       <id>releases</id>
       <url>http://localhost:8018/repository/testRelease/</url>
     </repository>
     <snapshotRepository>
       <id>snapshots</id>
       <!--这是server的id（注意不是用户登陆的id），该id与配置文件中server元素的id相匹配-->  
       <url>http://localhost:8018/repository/testSnapshot/</url>
     </snapshotRepository>
   </distributionManagement>
   ```

3. 使用 mvn deploy 将项目生成的 jar 包上传到远程 nexus 仓库

   ```bash
   # 进入 apollo-core module 目录下
   cd /path/to/apollo/apollo-core 
   
   # 执行命令 mvn deploy
   mvn deploy
   
   # 进入 apollo-client module 目录下
   cd /path/to/apollo/apollo-client
   
   # 执行命令 mvn deploy
   mvn deploy
   ```

4. 远程nexus仓库查看，可以发现已上传成功

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/apollo_nexus.png)

### 从 nexus 私有仓库下载修改过的 Apollo Clien jar 包

1. 新建一个测试的Spring Boot 应用，在应用的 POM 中配置仓库，例如：

   ```xml
   <repositories>
     <repository>
       <!-- zhangquan 的 nexus 私有仓库，主要为了引用修改过的Apollo包，增加 docker 自定义环境 -->
       <id>releases</id>
       <name>zhangquan的nexus Repository</name>
       <url>http://localhost:8018/repository/testRelease/</url>
       <snapshots>
         <enabled>false</enabled>
       </snapshots>
       <releases>
         <enabled>true</enabled>
       </releases>
       <layout>default</layout>
     </repository>
   </repositories>
   ```

2. 引入修改过的 Apollo Clien jar 包

   ```xml
   <dependency>
     <groupId>com.ctrip.framework.apollo</groupId>
     <artifactId>apollo-client</artifactId>
     <version>1.1.0</version>
   </dependency>
   ```

3. 添加注解来告诉程序开启apollo配置

   ```java
   @EnableApolloConfig(value = "application")
   ```

4. src/main/resources/application-docker.yml 配置

   ```yaml
   spring:
     application:
       name: apollo-extended-env
     profiles:
       active: docker
   ```

5. apollo 监听并动态刷新

   ```java
   @Service
   public class ApolloChangeListener {
   
       private static final Logger logger = LoggerFactory
               .getLogger(ApolloChangeListener.class);
   
       @ApolloConfigChangeListener
       public void  onChange(ConfigChangeEvent changeEvent) {
           logger.info("ApolloChangeListener onChange");
   
           for (String key : changeEvent.changedKeys()) {
               ConfigChange cc = changeEvent.getChange(key);
               logger.info("\t {}.{} from '{}' to '{}'", cc.getNamespace(),
                       cc.getPropertyName(), cc.getOldValue(), cc.getNewValue());
           }
       }
   
   }
   ```

6. 在 apollo 上创建项目，并在项目里的 DOCKER 环境中添加相应配置

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/apollo-extended-env.png)

   

7. 启动时加上vm options参数：

   ```bash
   -Denv=docker 
   -Dapp.id=apollo-extended-env 
   -Ddocker_meta=http://apollo:8084 
   -Dspring.profiles.active=docker
   ```

   

**完整代码示例：https://github.com/dendi875/apollo-extended-env**



### 把 apollo 与Spring Boot应用整合，并使用 docker-compose 部署测试配置项的变化

1. docker-compose.yaml 文件中添加Spring Boot 测试应用

   ```bash
   version: '3'
   services:
     #测试应用中使用添加自定义环境后的 Apollo 功能
     apollo-extended-env:
       image: dendi875/apollo-extended-env:1.0.0
       container_name: apollo-extended-env
       restart: always
       ports:
         - 8051:8051
       environment:
         - 'TZ="Asia/Shanghai"'
       networks: #要加入的网络（同一网络上的服务可以使用它们的名称相互通信）
         zq:
           aliases:
             - apollo-extended-env
       depends_on:
         - apollo 
   # 创建网络以使容器之间通信
   networks:
     zq:
   ```

2. 启动服务

   ```bash
   cd /path/to/docker-apollo
   docker-compose up
   ```

3. 在 Apollo 上添加配置项

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/apollo-extended-env-1.png)

4. 修改配置项，观察应用中的配置项变化情况

   ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/apollo-extended-env-2.png)



**完整的Dockerfile、docker-entrypoint、构建 docker-apollo 的源代码仓库地址：https://github.com/dendi875/docker-apollo**

## 五、参考资料

* https://www.apolloconfig.com/#/zh/README
* https://github.com/foxiswho/docker-apollo
* https://github.com/foxiswho/docker-consul-fabio-apollo-rocketmq-rabbitmq