---
title: Beanstalkd 学习研究
top: false
cover: false
toc: true
mathjax: true
date: 2021-06-29 15:44:02
password:
summary: 消息队列 Beanstalkd 的安装使用
tags:
	- 中间件
	- 消息队列
categories:
	- 消息队列
---

# Beanstalkd 学习研究
------------

## 1. Beanstalkd 介绍

Beanstalkd是一个简单、高效的工作队列系统，其最初设计目的是通过后台异步执行耗时任务方式降低高容量Web应用的页面延时。而其简单、轻量、易用等特点，和对`任务优先级（priority）`、`任务延时（delay）`、`任务超时重发（time-to-run）`和`任务预留（buired）`等控制，以及众多语言版本的客户端的良好支持，使其能够很好的支持分布式的后台任务和定时任务处理。

beanstalkd还提供了`binlog`机制，当重启beanstalkd，当前任务的状态能够从记录的本地`binlog`中恢复。

## 2. Beanstalkd 中的重要概念

### 2.1 核心概念

![beanstalkd-architecture](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/beanstalkd-architecture.png)

`Beanstalkd` 使用 `Producer-Consumer`设计模式，无论是其协议结构还是使用方式都是类似`Memcached`风格的。以下是`Beanstalkd`设计思想中核心概念：

#### job - 任务

`job`是一个需要异步处理的处理，是 `Beanstalkd`中的基本单元，每个`job`都会有一个id和优先级，`job`需要放在一个`tube`中。 `Beanstalkd`中的任务（`job`）类似于其消息队列中的消息（`message`）的概念。

#### tube - 管道

管道即某一种类型的任务队列，其类似于消息的主题（`topic`），是`Producer`和`Consumer`的操作对象。一个`Beanstalkd`中可以有多个管道，每个管道都有自己的生产者（`Producer`）和消费者（`Consumer`），管道之间互相不影响。

#### producer - 生产者

任务（`job`）的生产者，通过`put`命令来将一个`job`放到一个`tube`中。

#### consumer - 消费者

任务（`job`）的消费者，通过`reserve`来获取`job`，通过`delete`、`release`、`bury`来改变`job`的状态。

### 2.2 任务生命周期

`Beanstalkd`中的任务（`job`）替代了消息（`message`）的概念，任务会有一系列状态。任务的生命周期如下：

![beanstalkd-job-status](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/beanstalkd-job-status.png)

一个 `Beanstalkd`任务可能会包含以下状态：

- **READY** - 需要立即处理的任务。当`producter`直接`put`一个任务时，任务就处理`READY`状态，以等待`consumer`来处理。当延时（`DELAYED`）任务到期后会自动成为当前`READY`状态的任务
- **RESERVED** - 已经被消费者获取，正在执行的任务。当`consumer`获取了当前`READY`的任务后，该任务的状态就会迁移到`RESERVED`状态，这时其它的`consumer`就不能再操作该任务。`Beanstalkd`会检查任务是否在`TTR`（`time-to-run`）内完成
- **DELETED** - 消息被删除，`Beanstalkd`不再维持这些消息。即任务生命周期结束
- **DELAYED** - 延迟执行的任务。当任务被延时`put`时，任务就处理`DELAYED`状态。等待时间过后，任务会被迁移到`READY`状态。当消费者处理任务后，可以将任务再次放回`DELAYED`队列延迟执行
- **BURIED** - 埋葬的任务，这时任务不会被执行，也不会消失。当`consumer`完成该任务后，可以选择`delete`或`release`或`bury`操作
    * `delete`后，任务被删除，生命周期结束
    * `release`操作可以把任务状态迁移回`READY`状态或`DELAYED`状态，使其它`consumer`可以继续获取和执行该任务
    * `bury`操作会埋葬任务，等需要该任务时，再将埋葬的任务`kick`回`READY`，也可以通过`delete`删除`BURIED`状态的任务

### 2.3 Beanstalkd特点

- **任务优先级（priority）**

任务（`job`）可以有`0~2^32`个优先级，`0`表示优先级最高。`Beanstalkd`采用最大最小堆（Minx-max heap）处理任务优先级排序，任何时刻调用`reverse`命令的消费者总是能拿到当前优先级最高的任务，时间复杂度为`O(logn)`

- **任务延时（delay）**

`Beanstalkd`中可以通过两种方式延时执行任务：生产者发布任务时指定延时；或者当任务处理完毕后，消费者再次将任务放入队列延时执行（`release with delay`）。这种机制可以实现分布式定时任务，这种任务机制的优势是：如果某个消费者节点故障，任务超时重发（`time-to-run`）以保证任务转移到其它节点执行

- **任务超时重发（time-to-run）**

`Beanstalkd`把任务返回给消费者后，消费者必须在预设的`TTR`(`time-to-run`)时间内发送`delete`、或`release`、或`bury`命令改变任务的状态；否则`Beanstalkd`会认为任务处理失败，然后把任务交给另外的消费者节点执行。如果消费者预计在`TTR`时间内无法完成任务，可以发送`touch`命令，以使`Beanstalkd`重新计算`TTR`

- **任务预留（buried）**

当`RESERVED`状态的任务因为某些原因无法执行时，消费者可以使用`bury`命令将其设置为`buried`状态，这时`Beanstalkd`会继续保留这些任务。在具备任务执行条件时，再通过`kick`将任务迁移回`READY`状态


## 3. beanstalkd安装使用

Beanstalkd分为服务端和客户端两部分。可以在其官网查找相关安装包及安装方法：

* 服务端：http://kr.github.io/beanstalkd/download.html
* 客户端：https://github.com/kr/beanstalkd/wiki/client-libraries



### 3.1 服务端

#### 源码安装

下载、解压并进入源码目录后，执行`make`或`make install`命令即可：

```sh
$ sudo make
// 或
$ sudo make install
// 或
$ sudo make install PERFIX=/usr/bin/beanstalkd
```

#### 安装包安装

在Unbuntu或Debian系统中，可以使用以下命令安装：

```sh
$ sudo apt-get install beanstalkd
```

在CentOS或RHEL系统中，首先需要更新`EPEL`源，然后再使用`yum`命令安装。

小提示：更多关于`EPEL`的知识可以查阅下面的资料：

* [Information on EPEL](https://fedoraproject.org/wiki/EPEL)

* [How to use EPEL](https://fedoraproject.org/wiki/EPEL/FAQ#howtouse)

在RHEL6/CentOS6中使用以下命令更新源：

```sh
$ su -c 'rpm -Uvh http://download.fedoraproject.org/pub/epel/6/i386/epel-release-6-8.noarch.rpm'
```

在RHEL7中：

```sh
$ su -c 'rpm -Uvh http://download.fedoraproject.org/pub/epel/7/x86_64/e/epel-release-7-9.noarch.rpm'
```

检查`EPEL`源是否更新成功：

```sh
$ yum repolist enabled | grep epel
 * epel: mirrors.yun-idc.com
epel                  Extra Packages for Enterprise Linux 6 - i386        10,254
```

执行安装：

```sh
$ yum install -y beanstalkd
```

加入开启自启动：

```sh
$ chkconfig beanstalkd  on
```

添加用户组：

```sh
$ groupadd beanstalkd
```

添加用户：

```sh
$ useradd -M -g beanstalkd -s /sbin/nologin beanstalkd
```

创建`binlog`存放目录并修改所有者/所属组（有权限写入）：

```
$ mkdir -p /data/beanstalkd/binlog/
$ chown -R beanstalkd:beanstalkd  /data/beanstalkd
```

修改配置文件中存放`binlog`的目录：

```sh
$ vi /etc/sysconfig/beanstalkd
```

*BEANSTALKD_BINLOG_DIR=/data/beanstalkd/binlog*


#### 运行beanstalkd

Beanstalkd安装后，就可以通过beanstalkd命令来启动或配置Beanstalkd。该命令的使用格式如下：

```
beanstalkd [OPTIONS]
```

可选[OPTIONS]参数有：

* -b DIR - wal目录（开启binlog，断电重启后会自动恢复任务）
* -f MS  - 指定MS毫秒内的 fsync (-f0 为"always fsync")
* -F - 从不 fsync (默认)
* -l ADDR - 指定监听地址（默认为：0.0.0.0）
* -p PORT - 指定监听端口（默认为：11300）
* -u USER - 用户与用户组
* -z BYTE - 最大的任务大小（默认为：65535）
* -s BYTE - 每个wal文件的大小（默认为：10485760）
* -c - 压缩binlog（默认）
* -n - 不压缩binlog
* -v - 显示版本信息
* -h - 显示帮助


我们使用`nohup`和`&`来配合启动程序，这样能免疫 **Ctrl-C发送的SIGINT信号和关闭session发送的SIGHUP信号**

```sh
$ nohup beanstalkd -l 0.0.0.0 -p 11300 -b /data/beanstalkd/binlog/ -u beanstalkd &
```

### 3.2 客户端

客户端包含了Beanstalkd设计概念中的任务`生产者（Producer）`和`消费者（Consumer）`。Beanstalkd有很多语言版本客户端的实现，点击[Beanstalkd 客户端](https://github.com/beanstalkd/beanstalkd/wiki/Client-Libraries)查找自已所需要的版本，如果都不能满足需要，还可以根据[Beanstalkd 协议](https://github.com/beanstalkd/beanstalkd/blob/v1.3/doc/protocol.txt)自行实现。


笔者日常工作中，接触PHP语言较多，以下用一个PHP版本的Beanstalkd 客户端：[pda/pheanstalk](https://packagist.org/packages/pda/pheanstalk)为例，简单演示Beanstalkd的任务处理流程。

安装 pda/pheanstalk

```sh
$ composer require pda/pheanstalk
```

#### 生产 job

创建一个 producer 来生产 job

producer.php

```php
<?php

require_once('./vendor/autoload.php');

use Pheanstalk\Pheanstalk;

$pheanstalk  = new Pheanstalk('127.0.0.1', 11300);

$tubeName = 'syslog';

$jobData = [
    'type' => 'Debug',
    'level' => 3, // error log
    'content' => 'queue connect failed',
    'timestamp' => round(microtime(true) * 1000),
    'timeCreated' => date('Y-m-d H:i:s'),
];

$pheanstalk
    ->useTube($tubeName)
    ->put(json_encode($jobData));
```

运行 producer.php

```php
$ php producer.php
```

#### 消费 job

创建一个 consumer 来消费 job

consumer.php
```sh
<?php

if (PHP_SAPI !== 'cli') {
    echo 'Warning: should be invoked via the CLI version of PHP, not the '.PHP_SAPI.' SAPI'.PHP_EOL;
}

require_once('./vendor/autoload.php');

use Pheanstalk\Pheanstalk;

$pheanstalk  = new Pheanstalk('127.0.0.1', 11300);

$tubeName = 'syslog';

while (true) {
    // 从指定队列获取信息，reserve 阻塞获取
    $job = $pheanstalk->useTube($tubeName)->watch($tubeName)->ignore('default')->reserve(60);

    if ($job !== false) {
        // do stuff
        echo $data = $job->getData();
        // 处理完成，删除 job
        $pheanstalk->delete($job);
    }

    usleep(500000); // 0.5 s
}
```

运行 consumer.php

```php
$ php consumer.php
{"type":"Debug","level":3,"content":"queue connect failed","timestamp":1576113851568,"timeCreated":"2019-12-12 01:24:11"}
```

可以使用**deamontools**和**supervisor**等将`php consumer.php`变为常驻内存的进程。


#### 监控 beanstalkd 状态

创建一个 heartbeat 来检查与服务器的连接状态

heartbeat.php

```sh
<?php
/**
 * 心跳检查脚本：定期在定时任务系统（crontab、MySQL Event Scheduler、Elastic-Job）上运行并收集与服务器连接状态信息，
 * 如果连接不是活的状态，则可以发送消息报警（sms、email）
 */

if (PHP_SAPI !== 'cli') {
    echo 'Warning: should be invoked via the CLI version of PHP, not the '.PHP_SAPI.' SAPI'.PHP_EOL;
}

require_once('./vendor/autoload.php');

use Pheanstalk\Pheanstalk;

$pheanstalk  = new Pheanstalk('127.0.0.1', 11300);

$isAlive = $pheanstalk->getConnection()->isServiceListening();

var_dump($isAlive);
```

运行 heartbeat.php

```sh
$ php heartbeat.php
bool(true)
```

## 4. beanstalkd 管理工具

Tools：https://github.com/beanstalkd/beanstalkd/wiki/Tools

笔者经常使用的两款工具：

web 界面：https://github.com/ptrofimov/beanstalk_console

命令行：https://github.com/src-d/beanstool


对 beanstalkd 的操作也可以使用`telnet`，比如 `telnet 127.0.0.1 11300`。然后便可以执行 beanstalkd 的各命令，如 `stats` 查看信息，`use`, `put`, `watch` 等等。

`telnet`对beanstalkd的操作：

```sh
$ telnet 127.0.0.1 11300
stats
OK 929
---
current-jobs-urgent: 0
current-jobs-ready: 0
current-jobs-reserved: 0
current-jobs-delayed: 0
current-jobs-buried: 0
...

list-tubes
OK 23
---
- default
- syslog
```

## 5. Beanstalkd 使用总结

* 如果需要对`job`有**持久化**的需要，在启动beanstalkd时可以使用`-b`参数来开启`binlog`（二进制日志）， 通过`binlog`可以将`job`及其状态记录到文件里，如果断电，则可以使用相同的选项重新启动beanstalkd，它将读取`binlog`来恢复之前的`job`及状态

* `put`前先要`use tube xxxtube`，这样`put`的时候就会把`job`放到指定名称的`tube`中，否则会放到一个`default`的`tube`中

* `reserve`或`reserve-with-timeout`前先要`watch xxxtube`，可以同时监控多个`tube`，这样可以同时取几个队列的任务。但是，千万要小心，如果在一个进程中，不小心`watch`到了多个`tube`，那么有时候会取错任务，一般取`job`的步骤为：`useTube xxxtube -> watch xxxtube -> ignore default -> reserve`

* `job`处理完成，应该`delete`删除掉，或者`release`再放回队列，或者`bury`把它埋葬掉，这个取决于你的设计

## 6. Beanstalkd 不足

* 无最大内存控制，如果有消息堆积或者业务使用方式有误，而导致内存暴涨拖垮机器

* 跟`Memcached`类似，没有`master-slave`故障切换机制，需要自己解决单点问题

## 7. 参考资料

- [beanstalkd 官网](https://beanstalkd.github.io/)
- [Beanstalkd 客户端](https://github.com/beanstalkd/beanstalkd/wiki/Client-Libraries)
- [beanstalkd FAQ](https://github.com/beanstalkd/beanstalkd/wiki/FAQ)
- [Beanstalkd 中文协议](https://github.com/beanstalkd/beanstalkd/blob/master/doc/protocol.zh-CN.md)
- [pheanstalk](https://github.com/pheanstalk/pheanstalk)