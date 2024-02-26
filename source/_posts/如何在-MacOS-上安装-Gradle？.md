---
title: 如何在 MacOS 上安装 Gradle？
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-09-26 18:52:40
password:
summary: 如何在 MacOS 上安装 Gradle？
tags:
  - Gradle
  - 构建工具
categories: Gradle
---
# 如何在 MacOS 上安装 Gradle？

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240111183627.png)

1.   请注意，在安装Gradle之前，您需要在系统中安装 Java jdk

2.   访问网站 https://gradle.org/install

3.   点击以下截图所示的binary -only链接从上述网站下载二进制文件:

     ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240111183848.png)

4.   下载上述文件后，解压文件夹并记下解压文件夹的路径。例如，您可能已将文件夹解压到 Mac 的 "my_softwar "文件夹中，因此文件夹的位置将是 `/Users/zhangquan/Downloads/my_software/gradle-5.6.4`

5.   配置 PATH 环境变量，使其包含解压后的发行版的 bin 目录，例如：

     `vi ~/.zshrc`

     ```bash
     export GRADLE_HOME=/Users/zhangquan/Downloads/my_software/gradle-5.6.4
     export PATH=$PATH:$GRADLE_HOME/bin
     ```

     ` source ~/.zshrc`

6.   验证安装

     ```bash
     gradle -v
     
     ------------------------------------------------------------
     Gradle 5.6.4
     ------------------------------------------------------------
     
     Build time:   2019-11-01 20:42:00 UTC
     Revision:     dd870424f9bd8e195d614dc14bb140f43c22da98
     
     Kotlin:       1.3.41
     Groovy:       2.5.4
     Ant:          Apache Ant(TM) version 1.9.14 compiled on March 12 2019
     JVM:          1.8.0_211 (Oracle Corporation 25.211-b12)
     OS:           Mac OS X 10.16 x86_64
     ```

## 参考资料

*   https://gradle.org/install/#helpful-information
*   https://spring.io/guides/gs/gradle/