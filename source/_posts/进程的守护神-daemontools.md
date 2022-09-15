---
title: 进程的守护神-daemontools
top: false
cover: false
toc: true
mathjax: true
date: 2021-06-29 14:42:40
password:
summary: 守护进程管理工具的安装和使用
tags:
- 工具	
categories:
- Linux
---


# 进程的守护神 - daemontools
-------------

## 前言

我们在日常的开发中可能需要写一些`常驻内存的程序`，`常驻内存的程序`和`守护进程`程序是不一样的，`守护进程`的实现步骤稍微麻烦点，感兴趣的读者可以参考我用`C`实现的一个守护进程[daemonize.c](https://github.com/dendi875/APUE/blob/master/Chapter-13-Daemon%20Processes/daemonize.c)，我们重点关注下`常驻内存的程序`，
以`PHP`为例来说`常驻内存的程序`实现一般是这样的：

首先使用`while (1) {}`结构使程序无限循环，并且在程序内部对各种可能出现的异常进行捕捉处理，目的是防止程序意外退出。

hello.php

```php
#!/usr/bin/env php
<?php

while (1) {
    try {
        // dostuff();
        printf("hello, %d\n", $i++);
    } catch (Exception $e) {
        // exception handling
    }
    sleep(1);
}
```

接着，通过命令行把它放到后台执行，例如：

```sh
$ nohup php hello.php &
```

但这种实现方式是有一定的缺陷的，那就是当`PHP`执行过程中遇到错误的时候，就会退出程序，不官你程序中使用多少层`while (1) {}`，也不管你使用`try...catch`多少`Exception`，你还是阻止不了程序的意外退出（比如程序产生奇怪的`coredump`或者`kill`时手误杀错了程序）。如果这个常驻内存的程序是一个队列消费者程序，那么这种缺陷是很致命的，因为在流量高峰时如果程序一旦意外退出没有即时恢复，那么将导致队列中的消息一直堆积无法被消费掉，从而影响正常业务流程。再严重点，如果队列没有最大内存限制的策略，那么消息的堆积将会导致内存使用暴涨从而拖垮机器。怎么办？你可以用`crontab`脚本每分钟监视你的程序，看到没有在执行就启动起来。当然，还有更好的办法就是使用成熟的进程管理工具，它会监控你的程序，一旦发现进程退出了，立刻启动起来。`Linux`下对常驻内存的进程的管理通常使用`Daemontools`和`Supervisor` 这两个工具。今天我们就来研究学习下`Daemontools`


## 介绍

`daemontools`是用于管理`UNIX`服务的工具的集合，它分为三类工具：

* 常驻进程管理工具

[The svscanboot program](http://cr.yp.to/daemontools/svscanboot.html)

[The svscan program](http://cr.yp.to/daemontools/svscan.html)

[The supervise program](http://cr.yp.to/daemontools/supervise.html)

[The svc program](http://cr.yp.to/daemontools/svc.html)

[The svok program](http://cr.yp.to/daemontools/svok.html)

[The svstat program](http://cr.yp.to/daemontools/svstat.html)

[The fghack program](http://cr.yp.to/daemontools/fghack.html)

[The pgrphack program](http://cr.yp.to/daemontools/pgrphack.html)

* 日志管理工具

[The readproctitle program](http://cr.yp.to/daemontools/readproctitle.html)

[The multilog program](http://cr.yp.to/daemontools/multilog.html)

[The tai64n program](http://cr.yp.to/daemontools/tai64n.html)

[The tai64nlocal program](http://cr.yp.to/daemontools/tai64nlocal.html)

* 环境管理工具

[The setuidgid program](http://cr.yp.to/daemontools/setuidgid.html)

[The envuidgid program](http://cr.yp.to/daemontools/envuidgid.html)

[The envdir program](http://cr.yp.to/daemontools/envdir.html)

[The softlimit program](http://cr.yp.to/daemontools/softlimit.html)

[The setlock program](http://cr.yp.to/daemontools/setlock.html)


我们重点关注对常驻进程管理工具的使用，日志管理工具和环境管理工具主要是辅助进程管理做一些额外的功能，进程管理工具主要是通过`svscanboot`、`svscan`、`supervise`、`svc`、`svok`、`svstat`命令来管理常驻进程的

## 安装

```sh
$ cd /usr/local/software/
$ wget http://cr.yp.to/daemontools/daemontools-0.76.tar.gz
$ tar -zxvf daemontools-0.76.tar.gz -C /usr/local/
$ cd /usr/local/admin/daemontools-0.76/
$ package/install
```
如果在`Linux`下安装出现如下错误：　

```sh
/usr/bin/ld: errno: TLS definition in /lib/libc.so.6 section .tbss mismatches non-TLS reference in envdir.o
```

修复很简单将*admin/daemontools-0.76/src/error.h*中的`extern int errno;`替换为`include <errno.h>`之后再重新执行`package/install`

安装完成之后，会创建`/service`和`/command`两个目录

```sh
/command/
├── envdir -> /usr/local/admin/daemontools/command/envdir
├── envuidgid -> /usr/local/admin/daemontools/command/envuidgid
├── fghack -> /usr/local/admin/daemontools/command/fghack
├── multilog -> /usr/local/admin/daemontools/command/multilog
├── pgrphack -> /usr/local/admin/daemontools/command/pgrphack
├── readproctitle -> /usr/local/admin/daemontools/command/readproctitle
├── setlock -> /usr/local/admin/daemontools/command/setlock
├── setuidgid -> /usr/local/admin/daemontools/command/setuidgid
├── softlimit -> /usr/local/admin/daemontools/command/softlimit
├── supervise -> /usr/local/admin/daemontools/command/supervise
├── svc -> /usr/local/admin/daemontools/command/svc
├── svok -> /usr/local/admin/daemontools/command/svok
├── svscan -> /usr/local/admin/daemontools/command/svscan
├── svscanboot -> /usr/local/admin/daemontools/command/svscanboot
├── svstat -> /usr/local/admin/daemontools/command/svstat
├── tai64n -> /usr/local/admin/daemontools/command/tai64n
└── tai64nlocal -> /usr/local/admin/daemontools/command/tai64nlocal
```

### 启动daemontools

启动`svscanboot`

```sh
# /command/svscanboot &
```

也可以设置开机启动，具体参考：

[How to start daemontools](http://cr.yp.to/daemontools/start.html)

启动之后，查看进程，可以发现`svscan`做为`svscanboot`的子进程在运行

```sh
# ps -ef | grep sv
root      7547  5172  0 20:44 pts/0    00:00:00 /bin/sh /command/svscanboot
root      7549  7547  0 20:44 pts/0    00:00:00 svscan /service
```

## 使用

### 制作并测试你的脚本

这步的主要目的就是在尝试把程序变为常驻内存进程之前，先确保它可以作为前台程序正常工作。如果脚本有误在前台都不能正常运行，那变为常驻程序后观察结果肯定是达不到预期的。比如我们制作了一个下面这样的`PHP`脚本

```php
cat /data1/www/test/php/process/hello.php
#!/usr/bin/env php
<?php

while (1) {
    printf("hello, %d\n", $i++);
    sleep(1);
}
```

### 构建 daemontools Service

我们把所有的服务统一放到`/scratch/service`（临时服务）目录下，服务的名称是任意的，比如我们称为**hello**

创建 `/scratch/service` 目录

```sh
# mkdir -p /scratch/service
# cd /scratch/service/
# mkdir hello
# cd hello
```

创建一个`run`文件，其中包含：

```sh
#!/bin/sh
exec 2>&1
exec su - root -c "php /data1/www/test/php/process/hello.php" 1>> /data1/www/test/php/process/hello.log
```

赋予执行权限

```sh
# chmod u+x run
```

安装**hello**服务并实际开始运行它

```sh
# ln -s /scratch/service/hello/ /service/hello
```

**注意：** 上面的命令执行后正常情况下服务就已经开始运行了

打开另一个终端，验证程序是否正在运行

```sh
$ tail -f /data1/www/test/php/process/hello.log
hello, 67
hello, 68
hello, 69
hello, 70
```

如果`tail`命令未产生输出，请执行`svc -u hello`，虽然前面的命令如`/command/svscanboot &`已经打开了服务，以防万一由于某种原因关闭了服务，而这本不应该被关闭。

```
# pstree -a -p 7547
svscanboot,7547 /command/svscanboot
  ├─readproctitle,7550 service errors:...
  └─svscan,7549 /service
      └─supervise,7578 hello
          └─su,7579 - root -c php\040/data1/www/test/php/process/hello.php
              └─php,7580 /data1/www/test/php/process/hello.php
```
我们使用`pstree`命令查看进程树，可以看到`supervise`作为`svscan`的子进程在运行，`su`作为`supervise`的子进程在运行，最终执行的`php /data1/www/test/php/process/hello.php`又作为`su`的子进程在运行。

### 操作和监视你的服务

* 操作服务

你可以使用`svc`命令来操作你的服务，可以使用`svstat`命令来监视你的服务。

`svc`命令通过向守护进程发送信号来对其进行操作。该命令以`root`身份在`/service`目录中执行。例如：

```sh
# svc -d hello
```

上面的命令意思是关闭（`down`）或停止守护程序。下表是`svc`参数，它们的含义和信号的表：


Arg   | Action|Signal|
------|-------|------|
-u    | Start (up)|  - |
-d    | Stop (down)| TERM, then CONT |
-t    | 	Restart if running| TERM |

有关该命令的其它参数，请参见： http://cr.yp.to/daemontools/svc.html

* 监控服务

```sh
# svstat hello
hello: up (pid 7917) 5 seconds
```

`svstat`可以告诉我们以下信息

1. 服务目录的名称（hello）
2. 当前状态（up or down）
3. 进程`PID`
4. 处于当前状态的秒数

## Daemontools 架构模型

![daemontools](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/daemontools.png)

上图的“Connector A: Service”实际上是服务的`run`脚本，或者是任何二进制可执行文件，`shell`脚本或`PHP/Python/Perl/Ruby/ Lua`脚本，它们都是通过`exec`命令为其分配了一个`PID`的运行脚本。

通过上图可以知道`daemontools`的工作方式，计算机首先初始化，然后系统引导运行`/command/svscanboot`，接着`/command/svscanboot`依次引导运行`/command/readproctitle`和`/command/svscan`。`/command/readproctitle `只是一个可以运行的调试工具。

`svscan /service `是daemontools的一个最重要的机制，每五秒钟它会扫描`/service`目录（假设`/ service`是传递给`svscan`的命令行参数）以查找符号链接目录，并运行该符号连接目录中的`run`命令（如果尚未运行）


`svscan`程序会永远一直循环，每次循环做两件事：

1）扫描`/service`查找所有符号链接目录

2）对于查找到的每个符号链接目录，如果该目录还未运行`supervise`程序，则在该目录上运行`supervise`程序


`supervise`程序它基于我们监控的服务目录（如/service/hello）中的 supervise 目录树中的内容来运行和停止运行`run`脚本

```sh
tree /service/hello/supervise/
/service/hello/supervise/
├── control
├── lock
├── ok
└── status
```


## 基本故障排查

对daemontools问题进行故障排除的第一步就是找出正在运行的东西和没有运行的东西，可以参照架构模型将范围一步步缩小。

下面几个`ps`命令，用于查看正在运行的和未运行的进程：

* `ps -ef | grep sv`，查看`svscanboot`和`svscan`是否正常在运行

* `# ps -ef | grep supervise`，查看`supervise `是否在正常运行

* `ps ax | grep myprogram`，查看你`run`命令中执行的程序是否在运行，例如，在前面的救命中，它是 `hello.php`

## 正确的卸载服务

卸载服务指的不仅仅是停止它，而是停止使用服务。正确的执行步骤如下：

```sh
# cd /service/hello/
# rm -rf /service/hello
# svc -dx .
```

**注意：** 是首先`cd`到服务目录下，再使用**绝对路径**删除软链接，最后在执行`svc -dx .`

验证是否卸载成功：

```sh
# ps -ef | grep hello
```

还有一种终极大招来卸载服务，那就是关闭服务并杀死正在运行所有的守护进程和其子进程。


## 参考资料

- [Daemontools](http://cr.yp.to/daemontools.html)

- [FAQ of daemontools](http://cr.yp.to/daemontools/faq/create.html)

- [daemontools_intro](http://www.troubleshooters.com/linux/djbdns/daemontools_intro.htm)