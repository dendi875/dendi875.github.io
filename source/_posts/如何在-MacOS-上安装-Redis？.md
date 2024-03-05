---
title: 如何在 MacOS 上安装 Redis？
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-09-26 22:52:40
password:
summary: 如何在 MacOS 上安装 Redis？
tags:
  - Redi
categories: 数据库
---

## 概述

本文介绍了在 macOS 上安装键值类型数据库“Redis”的步骤。安装时，请使用 Homebrew，这对于在 macOS 上管理软件非常有用。

## 安装

首先，让我们使用brew search命令搜索Redis 。您可以按如下方式进行搜索。

```bash
$ brew search redis
==> Formulae
hiredis                           iredis                            redis ✔                           redis-leveldb                     redis@6.2                         redir                             redo

==> Casks
another-redis-desktop-manager ✔                 jpadilla-redis                                  medis                                           redis-pro                                       redisinsight
```

搜索结果中，**redis**是最新版本。redis@6.2 是 @ 标记右侧的数字表示的 redis 版本。

这里我们将安装最新版本的redis，但是您可以使用brew info命令查看要安装的redis的版本信息。

```bash
$ brew info redis
```

　认要安装的 Redis 版本后，请使用brew install命令安装它。

```bash
$ brew install redis
```

Redis 安装现已完成。已安装软件的两个功能很重要：

| 功能         | 说明                                                         |
| ------------ | ------------------------------------------------------------ |
| redis-server | Redis 服务器。这是服务器软件，主要作用是存储数据。           |
| redis-cli    | Redis 客户端。用于连接到 Redis 服务器并操作数据的客户端软件。 |

为了确保万无一失，请为每个命令运行命令以显示版本并确认它已安装。

```bash
$ redis-cli --version
redis-cli 7.0.4
$ redis-server --version
Redis server v=7.0.4 sha=00000000:0 malloc=libc bits=64 build=ef6295796237ef48
```

## 启动Redis服务器

现在让我们启动和停止 Redis。至于如何启动，前面brew install的结果中输出了两种方法。

### 如果想作为后台服务启动（开机自动启动）

如果您希望 launchd 在登录或重新启动 macOS 时作为后台服务启动，请运行brew services start redis命令。如果显示如下图所示的结果，那么即使重启macOS，redis也会自动启动。

```bash
$ brew services start redis
==> Successfully started `redis` (label: homebrew.mxcl.redis)
```

如果你想取消设置的自动启动，可以使用brew services stop redis来实现。

```bash
$ brew services stop redis
Stopping `redis`... (might take a while)
==> Successfully stopped `redis` (label: homebrew.mxcl.redis)
```

如果您不想使用 Redis 作为后台服务，请使用redis-server /usr/local/etc/redis.conf命令启动它。

```bash
$ redis-server /usr/local/etc/redis.conf
```

## 停止 Redis 服务器

要停止 Redis 服务器，请连接 Redis 客户端并停止它。

```bash
$ redis-cli shutdown
```

或者，如果您已经登录到 Redis 服务器，则可以通过输入shutdown来停止它。（如果你刚刚开始使用Redis，你可能会处于“登录？”的状态，所以使用上面的命令来停止它。）

```bash
127.0.0.1:6379> shutdown
```

## 已安装的文件

| 文件                        | 说明                        |
| --------------------------- | --------------------------- |
| /usr/local/etc/redis.conf   | 配置 Redis 行为的配置文件   |
| /usr/local/bin/redis-cli    | Redis 客户端的快捷方式      |
| /usr/local/bin/redis-server | Redis 服务器的快捷方式      |
| /usr/local/Cellar/redis     | 安装的Redis实体安装在该目录 |