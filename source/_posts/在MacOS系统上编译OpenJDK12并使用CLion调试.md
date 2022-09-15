---
title: 在MacOS系统上编译OpenJDK12并使用CLion调试
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-03-01 09:55:13
password:
summary: 在MacOS系统上编译OpenJDK12并使用CLion调试
tags:
	- JAVA
categories:
	- JVM
---

## 1. MAC 环境

macOS Catalina 版本 10.15.6

## 2. 准备

### 2.1 获取源码

直接通过页面下载 [OpenJdk12源码压缩包](https://hg.openjdk.java.net/jdk/jdk12/) ，然后点击左边菜单中的 "Browse"，将显示如图的源码根目录页面。

![openjdk12-source-code.png](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/openjdk-12-source-code.png)


此时点击左边的 "zip" 链接即可下载打包好的源码。

### 2.2 Bootstrap JDK

因为OpenJDK的各个组成部分有的是使用C++编写的,有的是使用Java编写的，因此编译这些Java代码需要使用到一个可用的JDK，官方称这个JDK为“Bootstrap JDK"，一般来说只需要比编译的JDK低一个版本，这里采用OpenJDK11，可以通过这个网址 jdk.java.net/archive/ 下载
记住一定要下载一个适合Mac平台的OpenJDK11。

1）[下载 JDK 11](https://download.java.net/java/GA/jdk11/9/GPL/openjdk-11.0.2_osx-x64_bin.tar.gz)

2）解压安装包
```shell
$ sudo tar -zxf /Users/zhangquan/Downloads/openjdk-11.0.2_osx-x64_bin.tar.gz -C /Library/Java/JavaVirtualMachines/ 
```

3）使用 jenv add 命令将 JDK 11 加入  jenv 中

```shell
$ jenv add /Library/Java/JavaVirtualMachines/jdk-11.0.2.jdk/Contents/Home/
```


我使用的Bootstrap JDK版本如下

```
$ java -version
openjdk version "11.0.2" 2019-01-15
OpenJDK Runtime Environment 18.9 (build 11.0.2+9)
OpenJDK 64-Bit Server VM 18.9 (build 11.0.2+9, mixed mode)
```

## 3. 安装依赖

用于生成shell脚本的工具,可以使软件包在不同的系统下都可以编译
```shell
$ brew install autoconf
```

字体引擎
```shell
$ brew install freetype
```

### 3.1 XCode 和 Command Line Tools for Xcode

这两个SDK提供了OpenJDK所需的编译器以及Makefile中用到的外部命令。一般电脑上都自带安装了。

验证 Xcode Command Line Tools 安装成功
```
$ xcode-select -p 
/Library/Developer/CommandLineTools
```

Xcode 各版本下载地址
https://xcodereleases.com/

 Catalina 上运行的最新版本的 Xcode 是 Xcode 12.4 和命令行工具 12.4。


## 4. 编译jdk

源码下载好之后，我解压放到了 ``` /Users/zhangquan/jvm/jdk12-06222165c35f``` 这个目录下，下面的命令均是在这个目录下执行的。

使用以下命令来查看编译参数帮助说明
```
$ bash configure --help
```

执行以下命令进行编译检查
```
bash configure \
--with-boot-jdk='/Library/Java/JavaVirtualMachines/jdk-11.0.2.jdk/Contents/Home' \
--with-debug-level=slowdebug \
--with-target-bits=64 \
--disable-warnings-as-errors \
--enable-dtrace \
--with-jvm-variants=server
```

* --with-boot-jdk：指定Bootstrap JDK路径
* --with-debug-level：编译级别,可选值为release、fastdebug、slowdebug和optimized,默认值为release,如果我们要调试的话,需要设定为fastdebug或者slowdebug,建议设置为slowdebug
* --with-target-bits：指定编译32位还是64位的虚拟机
* --disable-warnings-as-errors：避免因为警告而导致编译过程中断
* --enable-dtrace：开启一个性能工具
* --with-jvm-variants：编译特定模式下的虚拟机,一般这里编译server模式
* --with-conf-name：指定编译配置的名称,如果没有指定,则会生成默认的配置名称macosx-x86_64-server-slowdebug,我这里采用默认生成配置

报错
```
configure: error: No xcodebuild tool and no system framework headers found, use --with-sysroot or --with-sdk-name to provide a path to a valid SDK
```

执行
```
$ sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

继续执行 bash configure 得到如下配置成功的提示，并且输出调试级别，Java 虚拟机的模式、特性，使用的编译器版本等配置信息。

![buid-success.pn](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/buid-success.png)

### 4.1  开始编译

```
$ make images
```

这里 "images" 是 "product-images" 编译目标（Target）的简写，这个目标的作用是编译出整个 JDK镜像，除了 "product-images"外，其他编译目标还有

* hotspot：只编译HotSpot虚拟机 
* hotspot-<variant>：只编译特定模式的 HotSpot 虚拟机
* docs-image：产生 JDK 的文档镜像
* test-image：产生 JDK 的测试镜像
* all-images：相当于连续调用 product、docs、test 三个编译目标
* bootcycle-images：编译两次 JDK，其中第二次使用第一次编译结果作为 Bootstrap JDK
* clean：清理 make 命令产生的临时文件
* dist-clean：清理make 和 configure 命令产生的临时文件


在 configure 命令以及 make images 命令的执行过程 中，会在 "build/macosx-x86_64-server-slowdebug"目录 下产生如下目录结构

```shell
├── Makefile
├── bootcycle-spec.gmk
├── build.log
├── buildjdk-spec.gmk
├── buildtools  用于生成、存放编译过程中用到的工具
├── compare.sh
├── configure-support
├── configure.log
├── hotspot  HotSpot虚拟机编译的中间文件
├── images 使用 make *-image 产生的镜像存放在这里
├── jdk  编译后产生的 JDK 就放在这里
├── make-support 
├── spec.gmk
└── support 存放编译时产生的中间文件
```

编译完成之后，进入 OpenJDK 源码的 "build/配置名称/jdk" 目录下就可以看到 OpenJDK 的完整编译结果了

验证编译成功
```shell
$ /Users/zhangquan/jvm/jdk12-06222165c35f/jdk12-06222165c35f/build/macosx-x86_64-server-slowdebug/jdk/bin/java -version
openjdk version "12-internal" 2019-03-19
OpenJDK Runtime Environment (slowdebug build 12-internal+0-adhoc.zhangquan.jdk12-06222165c35f)
OpenJDK 64-Bit Server VM (slowdebug build 12-internal+0-adhoc.zhangquan.jdk12-06222165c35f, mixed mode)
```


### 4.2 生成Compilation Database
在配置CLion的时候,直接import编译好之后的jdk源码,你会发现头文件都是红色的,无法找到提示,是因为CLion生产的CMakeLists.txt有问题,如果想要解决这个问题就需要修改这个文件,很明显我不会修。
最后通过JetBrains说的利用Compilation Database (blog.jetbrains.com/clion/2020/…) 在CLion中构建OpenJDK解决了这个问题。

```shell
$ make CONF=macosx-x86_64-server-slowdebug compile-commands
Building target 'compile-commands' in configuration 'macosx-x86_64-server-slowdebug'
Updating compile_commands.json
Finished building target 'compile-commands' in configuration 'macosx-x86_64-server-slowdebug'
```

执行完该命令,就会在${source_root}/build/macosx-x86_64-server-slowdebug下生成compile_commands.json文件。



## 5. Clion 导入源码

### 5.1 导入 project

在导入project 之前先配置好 Toolchains

![Toolchains](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/Toolchanis.png)


配置好 Toolchains 后，通过 File -> Open 功能，选中 ${source_root}/build/macosx-x86_64-server-slowdebug/compile_commands.json,As a project 打开，这样就导入了 Compilation Database 文件，接下来 CLion 开始进行索引。

这时候，你会发现你是看不到源码的，所以下面需要修改项目的根目录，通过 Tools -> Compilation Database -> Change Project Root 功能，选中你的源码目录，也就是 ${source_root}, 这样设置就可以在 CLion 中看到源代码啦。


```
${source_root} 指的是 ~/jvm/jdk12-06222165c35f/jdk12-06222165c35f
```

### 5.2 debug 之前配置

需要在 ```Preferences --> Build, Exceution, Deployment --> Custom Build Targets``` 配置构建目标

![make](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/make.png)

![clean](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/clean.png)


通过这两个配置每次构建之前都会重新编译我们的 jdk, 修改 jvm 代码之后可以直接进行重新调试。

### 5.3 debug 配置

![debug_config](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/debug_config.png)


Executable：选择 ${source_root}/build/macosx-x86_64-server-slowdebug/jdk/bin/java, 或者其它你想调试的文件，比如 javac；
Before luanch：这个下面新增的时候有一个 bug, 去掉就不会每次执行都去 Build, 节省时间，但其实 OpenJDK 增量编译的方式，每次 Build 都很快，所以就看个人选择了。


### 5.4 debug

在 `${source_root}/src/java.base/share/native/libjli/java.c`的 401 行打断点，点击 Debug, 然后 F9 放掉，

![debug1](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/debug1.png)

不出意外你会遇到下面这个问题

![debug2](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/debug2.png)

由于我们使用的 LLDB 进行 debug 的，所以在进入第一个断点的时候在 LLDB 下执行以下命令可以避免此类问题

```shell
pro hand -p true -s false SIGSEGV SIGBUS
```

![debug3](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/debug3.png)

最终就可以看到 java -version 的输出效果如下
![debug4](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/debug4.png)


不过每次 debug 的时候都要输入这么一句就很麻烦，所以我们可以在 **~/.lldbinit** 文件中，使用如下命令，实现每次 Debug 时自动打个断点，然后输入 pro hand -p true -s false SIGSEGV SIGBUS, 最后继续执行后续流程，文件内容如下 (其中 main.c 文件的路径自行替换)

```shell
breakpoint set --file /Users/zhangquan/jvm/jdk12-06222165c35f/jdk12-06222165c35f/src/java.base/share/native/launcher/main.c --line 98 -C "pro hand -p true -s false SIGSEGV SIGBUS" --auto-continue true
```

### 5.5 与 Java 程序联合 debug

上面演示的实际是 java -version 如何 debug, 那么如何做到通过自己编写的 java 代码作为程序入口来调试呢？


首先 java 代码如下 (我用 idea 编写的):

![main](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/main.png)

CLion 中配置如下

![main2](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/main2.png)

运行结果如下:

![main3](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/main3.png)


## 参考资料

- <<深入理解 Java 虚拟机：JVM 高级特性与最佳实践>>