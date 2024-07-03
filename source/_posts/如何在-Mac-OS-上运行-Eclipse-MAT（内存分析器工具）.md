---
title: 如何在 Mac OS 上运行 Eclipse MAT（内存分析器工具）
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-07-03 16:47:04
password:
summary: 如何在 Mac OS 上运行 Eclipse MAT（内存分析器工具）
tags:
  - MAT
  - Java
categories:
  - 工具
---

在本文中，我想描述我在 Mac OS 上运行 Eclipse 的 MAT（内存分析器工具）时遇到的问题。我使用的是 macOS Big Sur（版本 11.7.4）。

## 下载 MAT

下载地址：https://www.eclipse.org/mat/downloads.php 

1.12 版本下载地址：https://www.eclipse.org/downloads/download.php?file=/mat/1.12.0/rcp/MemoryAnalyzer-1.12.0.20210602-macosx.cocoa.x86_64.dmg



![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240322140639.png)

如果看到同样的警告，请不要点击两次 mat.app，而是点击一次，然后选择 "打开"。

## 问题-发生错误

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240322140811.png)

让我们看看错误是什么。在终端中，转到显示路径下的目录并列出文件：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240322141219.png)

在您最喜欢的编辑器或语法突出显示更友好的编辑器（例如 VS Code）中打开 .log 文件，然后检查错误是什么：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240322141343.png)

重要的部分是：

```bash
ENTRY org.eclipse.osgi 4 0 2024-03-22 14:07:49.030
!MESSAGE Application error
!STACK 1
java.lang.IllegalStateException: The platform metadata area could not be written: /private/var/folders/d0/8hknzwvn0d57ysjmffsmg1940000gn/T/AppTranslocation/939781AA-B254-47EF-9930-F983779306B3/d/mat.app/Contents/MacOS/workspace/.metadata.  By default the platform writes its content
under the current working directory when the platform is launched.  Use the -data parameter to
specify a different content area for the platform.
```

## 解决方案

经过一些 stackoverflowing 之后，我在这个问题 [How to run Eclipse memory detector on Mac os? ](https://stackoverflow.com/questions/47909239/how-to-run-eclipse-memory-analyzer-on-mac-os)的一个回复中找到了解决方案。

1.   为MAT工作区创建一个目录:

     ```bash
     mkdir /Users/zhangquan/mat_workspace
     ```

2.   移动MAT到applications目录:

     ```bash
     mv ~/Downloads/my_software/mat.app /Applications/
     ```

3.   通过提供的工作空间路径来更新 MAT 初始设置，进入MAT应用程序目录并找到 MemoryAnalyzer.ini 文件

     ```bash
     cd /Applications/mat.app/Contents/Eclipse
     ```
     
     在MemoryAnalyzer.ini中添加以下行:

     ```ini
     -data
     
     /Users/zhangquan/mat_workspace
     ```
     
     在我的情况下，`MemoryAnalyzer.ini `整个文件有以下内容:
     
     ```INI
     -startup
     ../Eclipse/plugins/org.eclipse.equinox.launcher_1.6.200.v20210416-2027.jar
     --launcher.library
     ../Eclipse/plugins/org.eclipse.equinox.launcher.cocoa.macosx.x86_64_1.2.200.v20210527-0259
     -data
     /Users/zhangquan/mat_workspace
     -vmargs
     -Xmx1024m
     -Dorg.eclipse.swt.internal.carbon.smallFonts
     -XstartOnFirstThread
     ```

现在您可以在 Spotlight 搜索中输入“mat.app”，应用程序应该打开，没有任何错误:

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240703164426.png)