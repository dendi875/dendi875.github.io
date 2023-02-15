---
title: PHP 多进程编程
top: false
cover: false
toc: true
mathjax: true
date: 2021-06-29 15:40:21
password:
summary: PHP 如何多进程编程
tags:
	- PHP
categories:
	- 编程语言
---

# PHP 多进程编程

---

## 0. 前言

想完成某个耗时的任务，又觉得一个进程太慢，那么，试试用多进程来搞吧。这篇文章将会介绍一下``` PHP ```多进程的基本知识，如何创建多进程以及基本的信号控制。

## 1. 基本概念与环境准备

### 基本概念

- 程序和进程
    > 程序（program）是一个存储在磁盘上某个目录中的可执行文件。
    >
    > 程序的执行实例被称为进程（process）。

- 进程相关概念

1）进程ID

进程标识符（``` PID ```）是大多数操作系统的内核用于唯一标识进程的一个数值。这一数值可以作为许多函数调用的参数，以使调整进程优先级、杀死进程之类的进程控制行为成为可能。

在``` UNIX ```里，除了``` 进程0 ```（即PID=0的交换进程，Swapper Process）以外的所有进程都是由其他进程使用系统调用``` fork ```创建的，这里调用``` fork ```创建新进程的进程即为父进程，而相对应的为其创建出的进程则为子进程，因而除了``` 进程0 ```以外的进程都只有一个父进程，但一个进程可以有多个子进程。

 0号进程是系统引导时创建的一个特殊进程，在其调用``` fork```创建出一个子进程（即PID=1的进程1，又称 init）后，``` 进程0```就转为交换进程（有时也被称为空闲进程），而``` 进程1```（init进程）就是系统里其他所有进程的祖先。

2）调用进程的父进程ID

3）调用进程的实际用户ID

4）调用进程的有效用户ID

5）调用进程的实际组ID

6）调用进程的有效组ID

7）进程的优先级

例如修改bash进程的优先级

* 获取bash进程的进程ID
```bash
[dendi875@localhost ~]$ echo $$
3224
```
* top查看进程的优先级

```bash
top -d -2 -p <pid>
```

* top状态下按**r**输入进程ID后按回车，然后再输入```nice```值

8）进程状态

![process-status](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/process-status.png)

9）进程组

* 进程组是一个或多个进程的集合。每个进程组有一个唯一的进程组ID。进程组ID类似进程ID，它是一个正整数。
* 每个进程组有一个组长进程。组长进程的进程ID等于其进程ID。

10）会话

* 会话（session）是一个或多个进程组的集合。
* 如果调用进程不是一个组长进程则可以使用```setsid```来创建一个新会话。具体会发生3件事
    - 该进程变成新会话的**会话首进程**（会话首进程是创建该会话的进程）。此时，该进程是新会话中的唯一进程。
    - 该进程成为一个新进程组的组长进程。新进程组ID是该调用进程的进程ID。
    - 该进程脱离控制终端。

11）控制终端
- 一个会话可以有一个**控制终端**。本地终端（例如：tty1）或远程终端（例如：/pts/0）。
- 一个会话中的几个进程组可被分成一个前台进程组（foreground process group）以及一个或多个后台进程组（background process group）。
- 如果一个会话有一个控制终端，则它有一个前台进程组，其他进程组为后台进程组。

12）和信号相关的信息

- `Ctrl+C` 发送``` SIGINT ```信号，终止进程
- `Ctrl+\` 发送```SIGQUIT```信号，终止进程并产生**coredump**
- 关闭``` session ```，发送``` SIGHUP ```信号
- 浮点异常时产生```SIGFPE```信号，比如除以0
- 段错误时产生`SIGSEGV`信号

相关的```linux```命令

- 进程相关

```
ps -elf
ps aux
ps ajxf
pstree -Aup
top
```

- 线程相关
```
ps -eLf
ps -Lw <pid>
```
- 信号相关
```
kill -l
man 7 signal
ulimit -a
man 5 core
man 5 limits.conf
```

- 和终端终端相关
```
stty --help
bg
fg
kill -<signo> <%jobid>
```


### 环境准备

- ``` php ```多进程主要是在``` CLI ```（命令行模式）下应用。

-  ``` php ```多进程需要安装``` pcntl ```（process control）和``` posix ```扩展（windows不支持）。

确认扩展是否都有安装：
``` ssh
[root@localhost ~]# php -m | grep -E 'pcntl|posix'
pcntl
posix
```

编译时``` pcntl ```扩展默认是不安装的，记得编译配置时加上``` --enable-pcntl ```参数；``` posix ```扩展默认安装，只要你编译时没有加上``` --disable-posix ```。


## 2. 主要函数详解

### pcntl_fork() 创建子进程

例子1：创建一个子进程 fork1.php

```php
#!/usr/bin/env php
<?php

printf("11111111111111111111\n");

$pid = pcntl_fork();
if ($pid == -1) {   //  返回值为-1,创建失败
    die('could not fork');
} elseif ($pid == 0) {   // 子进程中
    printf("I'm child pid：%d ppid：%d\n", posix_getpid(), posix_getppid());
} else {    // 父进程中
    printf("I'm parent pid：%d ppid：%d\n", posix_getpid(), posix_getppid());
}

printf("2222222222222222222\n");
```

``` cli ```下运行结果为：

```ssh
[dendi875@localhost process]$ php fork1.php
11111111111111111111
I'm parent pid：7526 ppid：2789
2222222222222222222
I'm child pid：7527 ppid：7526
2222222222222222222
```
以上代码说明``` pcntl_fork() ```函数调用成功后，在父进程中会返回子进程的``` PID ```，而在子进程中返回的是``` 0 ```。

例子2：创建多个子进程 fork2.php

```php
#!/usr/bin/env php
<?php
/**
 *循环创建多个进程
 */

for ($i = 0; $i < 3; $i++) {
    $pid = pcntl_fork();
    if ($pid == -1) {   //  返回值为-1，创建失败
        die('could not fork');
    } elseif ($pid == 0) {   // 子进程中
        printf("I'm %d child pid：%d ppid：%d\n", $i, posix_getpid(), posix_getppid());
    } else {    // 父进程中
        printf("I'm %d parent pid：%d ppid：%d\n", $i, posix_getpid(), posix_getppid());
    }
}
```

``` cli ```下运行结果为：

```ssh
[dendi875@localhost process]$ php fork2.php
I'm 0 parent pid：7785 ppid：2789
I'm 1 parent pid：7785 ppid：2789
I'm 2 parent pid：7785 ppid：2789
I'm 2 child pid：7788 ppid：7785
I'm 1 child pid：7787 ppid：7785
I'm 2 parent pid：7787 ppid：7785
I'm 0 child pid：7786 ppid：7785
I'm 1 parent pid：7786 ppid：7785
I'm 2 parent pid：7786 ppid：7785
I'm 2 child pid：7789 ppid：7787
[dendi875@localhost process]$ I'm 1 child pid：7790 ppid：7786
I'm 2 parent pid：7790 ppid：7786
I'm 2 child pid：7791 ppid：7786
I'm 2 child pid：7792 ppid：7790
```

**分析为什么会出现8个进程，printf了14次？**

![fork](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/fork.png)


例子3：循环创建多个子进程改进版 fork3.php

```php
#!/usr/bin/env php
<?php
/**
 *循环创建多个进程
 */
for ($i = 0; $i < 3; $i++) {
    $pid = pcntl_fork();
    if ($pid == -1) {   //  返回值为-1，创建失败
        die('could not fork');
    } elseif ($pid == 0) {   // 子进程中
        printf("I'm %d child pid：%d ppid：%d\n", $i, posix_getpid(), posix_getppid());
        break;
    } else {    // 父进程中
        printf("I'm %d parent pid：%d ppid：%d\n", $i, posix_getpid(), posix_getppid());
    }
}
```

``` cli ```下运行结果为

```bash
[dendi875@localhost process]$ php fork3.php
I'm 0 parent pid：7776 ppid：2789
I'm 1 parent pid：7776 ppid：2789
I'm 2 parent pid：7776 ppid：2789
I'm 2 child pid：7779 ppid：7776
I'm 1 child pid：7778 ppid：7776
I'm 0 child pid：7777 ppid：7776
```

在循环中创建子进程需要注意以下两点：

1）子进程代码中要``` exit ```防止子进程再``` fork ```子进程，进入子进程的循环把系统的资源耗尽。

2）父进程代码中不要``` exit ```否则会终止多进程。



### pcntl_signal 注册信号处理函数和pcntl_signal_dispatch 检测是否有有信号未处理
例子：signal.php

```php
#!/usr/bin/env php
<?php

function signalHandler($signo) {
    switch ($signo) {
        case SIGINT:
            // 处理按`Ctrl-C`时发送的SIGINT（2）信号
            printf("handle signal SIGINT （%d）\n", $signo);
            exit(0);
        case SIGHUP:
            // 处理关闭`session`时发送的SIGHUP（1）信号
            $str = sprintf("handle signal SIGHUP （%d）\n", $signo);
            file_put_contents('t.log', $str);
            exit(0);
        case SIGTERM:
            // 处理`kill`命令默认发送的SIGTERM（15）信号
            printf("handle signal SIGTERM （%d）\n", $signo);
            exit(0);
        default:
            // 处理其它信号
            break;
    }
}

// 注册一个信号处理器，当接收到SIGINT、SIGHUP、SIGTERM信号时调用signalHandler函数
pcntl_signal(SIGINT, 'signalHandler');
pcntl_signal(SIGHUP, 'signalHandler');
pcntl_signal(SIGTERM, 'signalHandler');

$i = 0;
while (1) {
    pcntl_signal_dispatch(); // 检测是否有末决信号待处理，调用相应的信号处理函数
    printf("hello, %d\n", $i++);
    sleep(1);
}


```

注意：

- ``` pcntl_signal() ```函数仅仅是注册信号和它的处理方法，检测信号并调用其处理方法的函数是``` pcntl_signal_dispatch() ```。
- 9号信号（**SIGKILL**）和19号信号（**SIGSTOP**）不能被捕捉、不能被忽略、不能被阻塞。

### 孤儿进程与僵尸进程

#### 孤儿进程

* 所谓孤儿进程，顾名思义，和现实生活中的孤儿有点类似，当一个进程的**父进程结束**时，但是它自己还没有结束，那么这个进程将会成为孤儿进程。最后孤儿进程将会被``` init进程 ```（进程号为1）的进程收养，当然在子进程结束时也会由init进程完成对它的状态收集工作，因此一般来说，孤儿进程并不会有什么危害。

* 孤儿进程实例：orphan.php

```php
#!/usr/bin/env php
<?php

function pr_ids($name)
{
    $pid = posix_getpid();
    printf("%s：pid = %d, ppid = %d, pgid = %d, sid = %d\n",
        $name, $pid, posix_getppid(), posix_getpgid($pid), posix_getsid($pid));
}

function run()
{
    $pid = null;

    if (($pid = pcntl_fork()) < 0) {
        die("fork error");
    } else if ($pid == 0) {     /* 子进程中 */
        pr_ids("child");
        sleep(3);   /* 睡眠3s，保证父进程先退出，子进程成为孤儿进程 */
        pr_ids("now child");
        exit(0);
    }

    /**
     * 父进程睡眠1s，保证子进程先运行
     * 在子进程还没有成为孤儿进程前打印父进程ID和子进程成为孤儿进程后打印的父进程ID做对比
     */
    sleep(1);
    pr_ids("parent");
    printf("parent process is exited.\n");
    exit(0);
}

run();
```

以上代码输出：
```bash
[root@localhost process]# php orphan.php
child：pid = 29615, ppid = 29614, pgid = 29614, sid = 7937
parent：pid = 29614, ppid = 21998, pgid = 29614, sid = 7937
parent process is exited.
[root@localhost process]# now child：pid = 29615, ppid = 1, pgid = 29614, sid = 7937
```

以上例子中，在``` run ```函数中，创建子进程，然后让父进程睡眠1s，让子进程先打印出其进程``` id（pid）```以及父进程``` id（ppid）```；随后子进程睡眠3s（此时会调度到父进程运行直结束），目的是让**父进程先于子进程结束**，让子进程有个孤儿的状态；最后子进程再打印出其进程``` id(pid) ```以及父进程``` id(ppid) ```；观察两次打印 其父进程``` id(ppid) ```的区别。

从运行结果来看：当其父进程结束后，子进程成为了孤儿进程，其父进程``` id(ppid) ```为1，也就是说，``` init进程 ```成为该子进程的父进程了。

#### 僵尸进程

> 当一个进程正常或异步终止时，内核就向其父进程发送 ``` SIGCHLD ```信号。因为子进程终止是个异步事件（这可以在父进程运行的任何时候发生），所以这种信号也是内核向父进程发的异步通知。父进程可以选择忽略该信号，或者提供一个该信号发生时即被调用执行的函数（信号处理程序）。对于这种信号的系统默认动作是忽略它。--APUE

* 僵尸进程实例：zombie.c

```php
#!/usr/bin/env php
<?php
/**
 * 僵尸进程实例
 */

function run()
{
    $pid = null;

    if (($pid = pcntl_fork()) < 0) {
        die("fork error");
    } else if ($pid == 0) {     /* 子进程中 */
        printf("I am child process pid：%d\tppid：%d\n", posix_getpid(), posix_getppid());
        printf("child process is exited.\n");
        exit(0);                /* 子进程正常退出 */
    }

    while (1) {
        printf("I am parent process pid：%d\tppid：%d\n", posix_getpid(), posix_getppid());
        sleep(1);
    }
}

run();
```

运行查看
```bash
root@vultr:/data1/www/test/php/process# php zombie.php
I am parent process pid：25210  ppid：24032
I am child process pid：25211   ppid：25210
child process is exited.
I am parent process pid：25210  ppid：24032
I am parent process pid：25210  ppid：24032
...（省略）
```

再打开一个终端查看进程状态
``` ssh
root@vultr:~# ps -elf
...（省略）
0 S root     25312 24032  0  80   0 - 19076 hrtime 03:07 pts/0    00:00:00 php zombie.php
1 Z root     25313 25312  0  80   0 -     0 -      03:07 pts/0    00:00:00 [php] <defunct>
...（省略）
```


僵尸进程是指：一个进程使用``` fork ```创建子进程，如果**子进程退出**，而父进程并没有调用``` wait ```或``` waitpid ```获取子进程的状态信息，那么子进程的某些信息如进程描述符仍然保存在系统中。这种进程称之为僵尸进程。

我们详细理解下，在``` UNIX/Linux ```中，正常情况下，子进程是通过父进程``` fork ``` 创建的。子进程和父进程的运行是一个异步过程，理论上父进程无法知道子进程的运行状态。但知道子进程运行状态是一个很合理的需求，所以``` UNIX ``` 提供了一种机制可以保证只要父进程想知道子进程结束时的状态信息，就可以得到。这种机制就是: 在每个进程退出的时候，内核释放该进程的一部分资源，包括**打开的文件**、**占用的内存**等，同时仍然为其保留一定的信息（包括**进程号**，**退出状态**，**运行时间**等）。父进程可以通过``` wait()/waitpid() ```来获取这些信息，然后操作系统才释放。

如果父进程不调用``` wait()/waitpid() ``` 的话，那么保留的信息就不会释放，其进程号就会一直被占用，就像僵尸一样，所以把这些进程称为僵尸进程。


### pcntl_waitpid 回收僵尸进程

例子1：`waitpid` 阻塞/非阻塞回收指定的子进程 waitpid.php

```php
#!/usr/bin/env php
<?php
/**
 * 使用waitpid阻塞/非阻塞回收指定的子进程
 */

/**
 * 打印进程退出状态
 */
function pr_exit($status)
{
    if (pcntl_wifexited($status)) {
        printf("normal termination, exit status = %d\n", pcntl_wexitstatus($status));
    } else if (pcntl_wifsignaled($status)) {
        printf("abnormal termination, signal number = %d\n", pcntl_wtermsig($status));
    } else if (pcntl_wifstopped($status)) {
        printf("child stoped, signal number = %d\n", pcntl_wstopsig($status));
    }
}

function run()
{
    if (($pid = pcntl_fork()) < 0) {
        die("fork error");
    } else if ($pid == 0) {     /* 子进程中 */
        printf("I am child process pid：%d\tppid：%d\n", posix_getpid(), posix_getppid());
        sleep(10);
        printf("child process is exited.\n");
        exit(0);
    }

    $status = null;
    while (1) {
        printf("I am parent process pid：%d\tppid：%d\n", posix_getpid(), posix_getppid());
        //$wid = pcntl_waitpid($pid, $status, 0);
        $wid = pcntl_waitpid($pid, $status, WNOHANG);
        if ($wid == -1) {
            printf("waitpid error：%s\n", pcntl_strerror(pcntl_errno()));
            exit(0);
        } else if ($wid == $pid) {
            pr_exit($status);
        } else {
            printf("wait for child wid = %d\n", $wid);
        }
        sleep(1);
    }

    exit(0);
}

run();
```


例子2：waitpid阻塞/非阻塞回收多个子进程实例 waitpid2.php
```php
#!/usr/bin/env php
<?php
/**
 * waitpid阻塞/非阻塞回收多个子进程实例
 */

/**
 * 打印进程退出状态
 */
function pr_exit($status)
{
    if (pcntl_wifexited($status)) {
        printf("normal termination, exit status = %d\n", pcntl_wexitstatus($status));
    } else if (pcntl_wifsignaled($status)) {
        printf("abnormal termination, signal number = %d\n", pcntl_wtermsig($status));
    } else if (pcntl_wifstopped($status)) {
        printf("child stoped, signal number = %d\n", pcntl_wstopsig($status));
    }
}

function run()
{
    $status = null;
    $childs = array();

    for ($i = 0; $i < 10; $i++) {
        if (($pid = pcntl_fork()) < 0) {
            die("fork error");
        } else if ($pid == 0) {     /* 子进程中 */
            printf("I am child process pid：%d\tppid：%d\n", posix_getpid(), posix_getppid());
            sleep(10);
            // sleep($i+1);  /* 非阻塞时打开注释 */
            exit($i+1);
        } else {        /* 父进程中 */
            printf("I am parent process pid：%d\tppid：%d\n", posix_getpid(), posix_getppid());
            $childs[] = $pid;
        }
    }

    while (count($childs) > 0) {
        foreach ($childs as $key => $pid) {
            $wid = pcntl_waitpid($pid, $status, 0);           /* 阻塞*/
            // $wid = pcntl_waitpid($pid, $status, WNOHANG);  /* 非阻塞 */
            if ($wid == -1) {
                printf("waitpid error：%s\n", pcntl_strerror(pcntl_errno()));
                exit(0);
            } else if ($wid == $pid) {
                unset($childs[$key]);
                pr_exit($status);
            } else {
                printf("wait for child wid = %d\n", $wid);
            }
            sleep(1);
        }
    }

    exit(0);
}

run();
```
以上代码输出：
```
[root@localhost process]# ./wait-nohang.php
parent  8288    7870    1542632609.5141
wait return is 0
parent  8288    7870    1542632609.5142
wait return is 0
parent  8288    7870    1542632609.5144
wait return is 0
child   8291    8288    1542632609.5172
child   8290    8288    1542632609.5174
child   8289    8288    1542632609.5178
```

例子3：使用信号处理函数来回收僵尸进程 sigchld.php

```php
#!/usr/bin/env php
<?php
/**
 * 使用信号处理函数来回收僵尸进程
 */


/**
 * 打印进程退出状态
 */
function pr_exit($status)
{
    if (pcntl_wifexited($status)) {
        printf("normal termination, exit status = %d\n", pcntl_wexitstatus($status));
    } else if (pcntl_wifsignaled($status)) {
        printf("abnormal termination, signal number = %d\n", pcntl_wtermsig($status));
    } else if (pcntl_wifstopped($status)) {
        printf("child stoped, signal number = %d\n", pcntl_wstopsig($status));
    }
}

/**
 * SIGCHLD 信号处理函数
 */
function sig_chld($signo)
{
    $status = null;

    while (($pid = pcntl_waitpid(-1, $status, WNOHANG)) > 0) {
        pr_exit($status);
    }
}

function run()
{
    $pid = null;

    for ($i = 0; $i < 10; $i++) {
        if (($pid = pcntl_fork()) < 0) {
            die("fork error");
        } else if ($pid == 0) {     /* 子进程中 */
            break;
        }
    }

    if ($pid == 0) {    /* 10个子进程 */
        printf("child ID %d\n", posix_getpid());
        sleep(10);
        exit($i+1);
        //posix_kill(posix_getpid(), SIGABRT);
    } else if ($pid > 0) {  /* 一个父进程 */
        // 安装 SIGCHLD 信号处理函数
        pcntl_signal(SIGCHLD, 'sig_chld');

        while (1) {
            pcntl_signal_dispatch(); /* 检测是否有未处理的信号 */
            printf("parent ID %d\n", posix_getpid());
            sleep(1);
        }
    }

    exit(0);
}


run();
```

备注：

1）`pcntl_waitpid(-1, $status, 0)`行为等价于函数`pcntl_wait($status)`

2）多理解`pcntl_waitpid`函数的`pid`的4种情况（< -1, -1, 0, > 0）及3种返回值（0, > 0, -1）。


这里要理解多进程程序中父进程阻塞与非阻塞的区别

- 阻塞： 父进程一直等待，直到收到一个子进程结束的信号再执行。
- 非阻塞：父进程和子进程同时执行，不用等子进程执行完。在子进程退出后，再回收。


### 守护进程

> 守护进程（daemon）是一种生存期很长的一种进程。它们通常是在系统开机时启动，在系统关闭时才终止。它们脱离控制终端在后台长期运行为我们提供某种服务。守护进程程序的名称通常以字母“d”结尾，例如**syslogd**就是指管理系统日志的守护进程。


创建一个守护进程实例

```php
#!/usr/bin/env php
<?php
/**
 * 创建一个守护进程
 */

function daemonize()
{
    /**
     *重新设置文件权限掩码
     */
    umask(0);

    /**
     * 调用fork创建子进程，父进程退出，保证了子进程不是一个组长进程，这是执行setsid调用的先决条件
     */

    if (($pid = pcntl_fork()) < 0) {
        die("fork error");
    } else if ($pid > 0) {      /* 父进程中 */
        exit(0);
    }

    /**
     * 创建一个会话，使进程成为会话首进程并脱离控制终端
     */
    if (posix_setsid() < 0) {
        die("setsid error");
    }

    /**
     * 再次fork避免在System V的系统中，重新获取对终端的控制
     */
    if (($pid = pcntl_fork()) < 0) {
        die("fork error");
    } else if ($pid > 0) {
        exit(0);
    }

    /**
     * 改变当前工作目录
     */
    chdir("/");
}

function run()
{
    daemonize();

    while (1) {
        sleep(1);
    }
}

run();
```

创建守护进程步骤：

1）重新设置文件权限掩码。**umask** 函数，防止使用继承过来的掩码来创建文件可能会被设置为拒绝某些权限

2）调用**fork**创建子进程，父进程退出。保证了子进程不是一个组长进程，这是执行**setsid**调用的先决条件

3）调用setsid创建一个新的会话。目的是使调用进程：

- 成为新会话的首进程

- 成为一个新进程组的组长进程

- 脱离控制终端

4）调用**chdir**更改当前工作目录，一般为根目录。防止占用可卸载的文件系统

5）关闭所有的文件描述符。从父进程继承过来的文件描述符不会再被用到，如果不关闭就浪费了系统资源

6）使0、1、2文件描述符指向`/dev/null`。目的是使任何一个试图从标准输入读、写到标准输出、写到标准错误的程序都不会产生效果，因为守护进程并不与终端设备相关联，所以其输出无处显示，也无处从交互式用户那里接收输入。


## 3. 如何让挂掉的服务自动启动

*  ``` nohup ```与``` & ```的区别

测试代码如下 hello.php

``` php
#!/usr/bin/env php
<?php

while (1) {
    printf("hello, %d\n", $i++);
    sleep(1);
}
```

* 使用 ``` php hello.php ```前台运行，效果如下
``` ssh
[root@localhost process]# php hello.php
hello, 0
hello, 1
hello, 2
hello, 3
^C
[root@localhost process]#
```
此时键入``` Ctrl-C ```，程序会收到一个``` SIGINT ```信号，如果不做特殊处理，程序的默认行为是终止。

* 使用``` php hello.php & ```后台运行程序，效果如下
``` ssh
[root@localhost process]# php hello.php &
[2] 31540
[root@localhost process]# hello, 0
hello, 1
^C
[root@localhost process]# hello, 2
hello, 3
^C
[root@localhost process]# hello, 4
hello, 5
hello, 6
hello, 7
hello, 8
^C
[root@localhost process]# hello, 9
```

``` ssh
[root@localhost ~]# ps aux | grep hello
root     31540  0.1  0.7  35964  7776 pts/0    S    17:33   0:00 php hello.php
root     31544  0.0  0.0   5976   748 pts/1    S+   17:33   0:00 grep --color=auto hello
```
可以看到首先会在终端显示进程号31540，键入``` Ctrl-C ```，发送``` SIGINT ```信号，**程序会继续运行**。``` ps ```查看进程的确在运行。

此时关掉``` session ```，程序会收到一个``` SIGHUP ```信号，此时会怎么样？

``` ssh
[root@localhost ~]# ps aux | grep hello
root     31792  0.0  0.0   5976   748 pts/1    S+   18:07   0:00 grep --color=auto hello
```

``` ps ```再次确认，可以看到关闭``` session ```之后，进程号是31540的``` hello.php ```的进程也关闭了。

* 使用``` nohup php hello.php ```效果是怎么样？

``` ssh
[root@localhost process]# nohup php hello.php
nohup: 忽略输入并把输出追加到"nohup.out"

[root@localhost ~]# ps aux | grep hello.php
root     31835  0.1  0.7  35964  7776 pts/0    S+   18:10   0:00 php hello.php
root     31863  0.0  0.0   5976   752 pts/1    S+   18:11   0:00 grep --color=auto hello.php
```

使用``` nohup ```运行程序后，用``` ps ```查看进程号是31835。此时关掉``` session ```，程序会收到一个``` SIGHUP ```信号，程序会不会关闭呢？

``` ssh
[root@localhost ~]# ps aux | grep hello.php
root     31835  0.0  0.7  35964  7776 ?        S    18:10   0:00 php hello.php
root     31881  0.0  0.0   5976   756 pts/1    S+   18:13   0:00 grep --color=auto hello.php
[root@localhost ~]# ps aux | grep hello.php
root     31835  0.0  0.7  35964  7776 ?        S    18:10   0:00 php hello.php
root     31883  0.0  0.0   5976   752 pts/1    S+   18:13   0:00 grep --color=auto hello.php
```
关掉``` session ```后，再次``` ps ```查看，``` PID ```为31835的进程还在。只能通过``` kill ```杀掉。

* 测试下``` nohup php hello.php ```后按``` Ctrl-C ```会发生什么？

``` ssh
[root@localhost process]# nohup php hello.php
nohup: 忽略输入并把输出追加到"nohup.out"


^C
```
可以看到键入``` Ctrl-C ```，程序收到``` SIGINT ```信号后，程序关闭了。

* 最后测试下``` nohup ```和``` & ```，同时使用，即``` nohup php hello.php & ```会怎么样？

``` ssh
[root@localhost process]# nohup php hello.php &
[1] 32004
[root@localhost process]# nohup: 忽略输入并把输出追加到"nohup.out"
^C
[root@localhost process]# ^C
[root@localhost process]# ^C
[root@localhost process]# ps aux | grep hello.php
root     32004  0.0  0.7  35964  7776 pts/0    S    18:27   0:00 php hello.php
root     32015  0.0  0.0   5976   780 pts/0    S+   18:28   0:00 grep --color=auto hello.php
```
此时键入``` Ctrl-C ```，发送``` SIGINT ```信号，该进程还在。
此时关闭``` session ```，发送``` SIGHUP ```信号，再来看看进程还在不在？

``` ssh
[root@localhost ~]# ps aux | grep hello.php
root     32004  0.1  0.7  35964  7776 ?        S    18:27   0:00 php hello.php
root     32053  0.0  0.0   5976   756 pts/1    S+   18:29   0:00 grep --color=auto hello.php
```
可以看到关闭``` session ```，后进程还在，现在也只能使用`kill`来杀掉。

结论
使用``` & ```后台运行程序：
> 使用``` Ctrl-C ```发送``` SIGINT ```信号，进程免疫。
>
>关闭``` session ```发送``` SIGHUP ```信号，进程终止。

使用``` nohup ```运行程序：
> 使用``` Ctrl-C ```发送``` SIGINT ```信号，进程终止。
>
> 关闭``` session ```发送``` SIGHUP ```信号，进程免疫。

使用``` &nohup ```和``` & ```来配合启动程序：
> 同时免疫``` SIGINT ```和``` SIGHUP ```信号

思考：如果使用了``` nohup ```和``` & ```启动程序后，程序因异常情况被``` kill ```掉，如何让程序自动启动？

## 4. 进程的守护神daemontools和supervisor

daemontools：https://github.com/dendi875/Linux/blob/master/daemontools.md

## 5. 参考资料

- [APUE](https://book.douban.com/subject/1788421/)
- [PHP：POSIX](https://www.php.net/manual/zh/book.posix.php)
- [PHP：PCNTL](https://www.php.net/manual/zh/book.pcntl.php)