---
title: 'Autotools简介（autoconf, automake）'
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2021-12-09 15:07:24
password:
summary: 如何利用 GNU Autoconf 及 Automake 这两套工具来协助我们自动产生 Makefile文件
tags:
	- Makefile
	- Autoconf
categories:
	- C
---


# Autotools简介（autoconf, automake）
------------------------

## 一、引言

无论是在Linux还是在Unix环境中，make都是一个非常重要的编译命令。不管是自己进行项目开发还是安装应用软件，我们都经常要用到make或 make install。利用make工具，我们可以将大型的开发项目分解成为多个更易于管理的模块，对于一个包括几百个源文件的应用程序，使用make和 makefile工具就可以轻而易举的理顺各个源文件之间纷繁复杂的相互关系。

但是如果通过查阅make的帮助文档来手工编写Makefile,对任何程序员都是一场挑战。幸而有GNU 提供的Autoconf及Automake这两套工具使得编写makefile不再是一个难题。

本文将介绍如何利用 GNU Autoconf 及 Automake 这两套工具来协助我们自动产生 Makefile文件，并且让开发出来的软件可以像大多数源码包那样，只需"./configure", "make","make install" 就可以把程序安装到系统中。

## 二、从epoch程序开始

我们从一个获取系统时间的程序为例开始讲解。

1）新建目录

在你的工作目录下新建一个epoch目录，我们用它来存放epoch程序及相关文件。

```shell
$ mkdir epoch
$ cd epoch
```

2）epoch.c

编写一个epoch.c程序，内容如下

```c
#include <stdio.h>
#include <sys/time.h>

#include "config.h"

double get_epoch()
{
    double sec;

#ifdef HAVE_GETTIMEOFDAY
    struct timeval tv;

    gettimeofday(&tv, NULL);
    sec = tv.tv_sec;
    sec += tv.tv_usec / 1000000.0;
#else
    sec = time(NULL);
#endif

    return sec;
}

int main(int argc, char *argv[])
{
    printf("%f\n", get_epoch());

    return 0;
}
```

3）生成configure

我们使用autoscan命令来帮助我们根据目录下的源代码生成一个configure.ac的模板文件

```shell
$ autoscan
$ ls
autoscan.log  configure.scan  epoch.c
```

执行后在epoch目录下会生成一个文件configure.scan，我们可以拿它作为configure.ac的模板。现在将configure.scan改名为configure.ac，并且编辑它，修改成下面的内容：

```shell
$ mv configure.scan configure.ac
```

```shell
#                                               -*- Autoconf -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.63])
AC_INIT(epoch, 1.0, quanzhang875@gmail.com)
AM_INIT_AUTOMAKE(epoch, 1.0)
AC_CONFIG_SRCDIR([epoch.c])
AC_CONFIG_HEADERS([config.h])

# Checks for programs.
AC_PROG_CC

# Checks for libraries.

# Checks for header files.
AC_CHECK_HEADERS([sys/time.h])

# Checks for typedefs, structures, and compiler characteristics.

# Checks for library functions.
AC_CHECK_FUNCS([gettimeofday])

AC_OUTPUT(Makefile)
```

然后执行命令**aclocal**和**autoconf**及**autoheader**，就会分别生成**aclocal.m4**和**configure**及**config.h.in**文件：

```shell
$ aclocal
$ ls
aclocal.m4  autom4te.cache  autoscan.log  configure.ac  epoch.c

$ autoconf
$ ls
aclocal.m4  autom4te.cache  autoscan.log  configure  configure.ac  epoch.c

$ autoheader
$ ls
aclocal.m4  autom4te.cache  autoscan.log  config.h.in  configure  configure.ac  epoch.c
```

4）新建 Makefile.am

Makefile.am文件内容：

```shell
$ vi Makefile.am
```

```shell
AUTOMAKE_OPTIONS=foreign
bin_PROGRAMS=epoch
epoch_SOURCES=epoch.c
```


automake会根据你写的Makefile.am来自动生成Makefile.in。

Makefile.am中定义的宏和目标，会指导automake生成指定的代码。例如，宏bin_PROGRAMS将导致编译和连接的目标被生成。


5）运行automake

```shell
$ automake --add-missing
configure.ac:6: installing `./install-sh'
configure.ac:6: installing `./missing'
Makefile.am: installing `./depcomp'
```


6）运行configure生成Makefile和config.h

```shell
$ ./configure
checking for a BSD-compatible install... /usr/bin/install -c
checking whether build environment is sane... yes
checking for a thread-safe mkdir -p... /bin/mkdir -p
checking for gawk... gawk
checking whether make sets $(MAKE)... yes
checking for gcc... gcc
checking for C compiler default output file name... a.out
checking whether the C compiler works... yes
checking whether we are cross compiling... no
checking for suffix of executables...
checking for suffix of object files... o
checking whether we are using the GNU C compiler... yes
checking whether gcc accepts -g... yes
checking for gcc option to accept ISO C89... none needed
checking for style of include used by make... GNU
checking dependency style of gcc... gcc3
checking how to run the C preprocessor... gcc -E
checking for grep that handles long lines and -e... /bin/grep
checking for egrep... /bin/grep -E
checking for ANSI C header files... yes
checking for sys/types.h... yes
checking for sys/stat.h... yes
checking for stdlib.h... yes
checking for string.h... yes
checking for memory.h... yes
checking for strings.h... yes
checking for inttypes.h... yes
checking for stdint.h... yes
checking for unistd.h... yes
checking sys/time.h usability... yes
checking sys/time.h presence... yes
checking for sys/time.h... yes
checking for gettimeofday... yes
configure: creating ./config.status
config.status: creating Makefile
config.status: creating config.h
config.status: executing depfiles commands
```

```shell
ls
aclocal.m4      autoscan.log  config.h.in  config.status  configure.ac  epoch.c     Makefile     Makefile.in  stamp-h1
autom4te.cache  config.h      config.log   configure      depcomp       install-sh  Makefile.am  missing
```

可以看到此时**Makefile**和**config.h**已经产生出来了。

7）使用Makefile编译代码

```shell
$ make
make  all-am
make[1]: Entering directory `/home/dendi875/auto/epoch'
gcc -DHAVE_CONFIG_H -I.     -g -O2 -MT epoch.o -MD -MP -MF .deps/epoch.Tpo -c -o epoch.o epoch.c
mv -f .deps/epoch.Tpo .deps/epoch.Po
gcc  -g -O2   -o epoch epoch.o
make[1]: Leaving directory `/home/dendi875/auto/epoch'
```

8）运行epoch

```shell
$ ./epoch
1561952071.857380
```

这样epoch就编译出来了，你还可以试着使用一些其它的make命令，如**make clean**，**make install**，**make dist**。

## 三、流程图

我们用一张图来表示产生**Makefile**和**config.h**的流程

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/afp2.png)

## 四、参考资料

- [automake，autoconf使用详解](http://www.laruence.com/2009/11/18/1154.html)