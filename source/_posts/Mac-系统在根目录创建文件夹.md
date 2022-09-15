---
title: Mac 系统在根目录创建文件夹
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2021-11-26 14:06:52
password:
summary:  Mac 系统使用经验
tags:
	- 工作积累
	- MAC
categories:
	- 工作积累
---

### 一、前言

Mac 操作系统挺适合开发者进行写代码，最近碰到了一个问题，问题是如何在 macOS 根目录创建文件夹。不同的 macOS 版本处理方式不同，下面我们展开讲一下

### 二、为什么要在 Mac 根目录创建文件夹

有些场景程序需要访问根目录的特定文件夹，所以需要在 macOS 根目录创建文件夹。

比如 `Spring Boot` 工程在 Mac 操作系统本地运行时，公司会默指定 `/data0/log-data/` 类似的目录，来存储工程运行的日志。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/mac-1.png)

那怎么如何在 macOS 根目录创建文件夹，下面分不同的 macOS 版本来解决：

* macOS@Catalina 版本
* macOS@Big Sur 版本

### 三、macOS@Catalina 版本的创建文件夹方法
第一步：关闭电脑然后重启，重启时长按 command + R 键，启动内建的 macOS 恢复系统

第二步：从菜单栏找到终端工具，运行下面命令，然后重启：
```shell
csrutil disable
```

这个命令目的是关闭 SIP，SIP 全称为「System Integrity Protection」即「系统完整性保护」。可以通过 `csrutil status` 查看其 SIP 状态。


第三步：重启完后，先重新挂载根目录，打开终端工具运行下面命令即可：
```shell
sudo mount -uw /
```

第四步：创建对应的 `/Users/zhangquan/data`、`/Users/zhangquan/data0` 文件夹，然后将对应的文件目录软链接到根目录。运行下面命令即可：

```shell
mkdir  /Users/zhangquan/data
mkdir  /Users/zhangquan/data0
sudo ln -s /Users/zhangquan/data /data
sudo ln -s /Users/zhangquan/data0 /data0
```

注意：需要用软链接来解决，是因为在根目录直接创建文件夹的话，一旦重启电脑，之前创建的目录又是只读权限了。

最后，重新重启 command + R 键，启动内建的 macOS 恢复系统，重新打开 SIP：

```shell
csrutil enable
```

### 四、macOS@Big Sur 版本的创建文件夹方法

第一步：启动内建的 macOS 恢复系统，关闭 SIP
第二步：运行下面命令，修改 synthetic.conf 文件
```shell
sudo vi /etc/synthetic.conf
```
第三步：编辑该文件，输入下面内容，将对应的文件夹映射到根目录

```shell
data    /Users/zhangquan/data
data0   /Users/zhangquan/data0
```


注意：

* 提前创建被映射的文件夹
* 中间是 Tab，不是空格
最后重启系统后，系统根目录就会出现了对应的文件夹，实现方式也是一个软链接的形式

### 五、小结

* 尽量不要再 mac 根目录操作一些命令，比如 chmod 等
* SIP 打开后，及时关闭
* mac 支持文件软链接形式