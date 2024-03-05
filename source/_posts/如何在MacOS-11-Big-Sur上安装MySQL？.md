---
title: 如何在MacOS 11 Big Sur上安装MySQL？
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-02-27 10:25:49
password:
summary: 如何在MacOS 11 Big Sur上安装MySQL？
tags:
  - MySQL
categories: 数据库
---

本教程将引导您在macOS 11 Big Sur上安装MySQL 8.0.24的步骤。

MySQL 未随 macOS Big Sur 预装，需要从 [MySQL 站点下载](https://dev.mysql.com/downloads/mysql/)。

最新版本的 MySQL 8.0.24 可与 macOS 11 Big Sur 配合使用。

使用 DMG 存档 mysql-8.0.24-macos11-x86_64.dmg。

软件包位于一个磁盘镜像（.dmg）文件中，首先需要在 Finder 中双击其图标进行加载。然后它会加载映像并显示其内容。

如果要重新安装或更新：在开始安装之前，请确保通过使用 MySQL 管理器应用程序（在 macOS 服务器上）、首选项窗格或终端命令行上的 mysqladmin shutdown 停止所有正在运行的 MySQL 服务器实例。

## 使用软件包安装程序安装 MySQL

*   下载包含MySQL包安装程序的磁盘映像(.dmg)文件([社区版本可在此处获得](https://dev.mysql.com/downloads/mysql/))。双击该文件以挂载磁盘映像并查看其内容。

*   双击磁盘中的 MySQL 安装程序包。它根据你下载的 MySQL 版本命名。例如，对于 MySQL 服务器 8.0.24，它可能被命名为 mysql-8.0.24-macos11-x86_64.pkg。首先会显示一个警告，要求允许运行一个程序，以确定是否可以安装该软件。点击 "允许"。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240227114207.png)

*   初始向导介绍屏幕引用要安装的MySQL服务器版本。单击Continue开始安装。MySQL社区版显示了相关GNU通用公共许可证的副本。单击继续，然后单击同意继续。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240227114335.png)

*   在“安装类型”页面中，您可以单击“安装”以使用所有默认值执行安装向导，也可以单击“自定义”以更改要安装的组件（MySQL 服务器、MySQL 测试、首选项窗格、启动支持 — 默认情况下启用除 MySQL 测试之外的所有组件）。

    注意：虽然“更改安装位置”选项可见，但安装位置无法更改。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240227114450.png)

*   单击安装以安装 MySQL 服务器。如果升级当前的 MySQL 服务器安装，安装过程将在此结束，否则请按照向导的附加配置步骤安装新的 MySQL 服务器。
*   成功安装新的 MySQL 服务器后，通过选择默认密码加密类型、定义 root 密码以及在启动时启用（或禁用）MySQL 服务器来完成配置步骤。
*   默认的MySQL 8.0密码机制是caching_sha2_password（Strong），这一步允许您将其更改为mysql_native_password（Legacy）。

选择传统密码机制会更改生成的 launchd 文件，在 ProgramArguments 下设置 `--default_authentication_plugin=mysql_native_password`。选择强密码加密不会设置`--default_authentication_plugin`，因为使用的是 MySQL 服务器的默认值，即 caching_sha2_password。如果你打算使用像 phpMyAdmin 这样的 GUI 封装程序，则应选择 "使用传统密码加密"。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240227114806.png)

*   为 root 用户定义密码（1qaz@WSX），并切换 MySQL 服务器是否应在配置步骤完成后启动。

## MySQL 软件包安装向导摘要

检查 2002 MySQL Socket 错误是否已修复：检查 /var/mysql/mysql.sock 是否链接到 /tmp/mysql.sock。否则，请键入终端命令：

```bash
sudo mkdir /var/mysql
sudo ln -s /tmp/mysql.sock /var/mysql/mysql.sock
```

MySQL 服务器现在安装在 /usr/local/mysql/bin 中。

## 使用MySQL

### 在系统偏好设置中通过 GUI 使用 MySQL

您可以在“系统偏好设置”>“MySQL”中访问其配置面板

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240227115106.png)

在菜单 Instances 中，在左侧窗格中选择 MySQL 8.0,24。单击“启动 MySQL 服务器”以启动服务器。它将亮起绿灯以表明其处于活动状态。您可以选择“计算机启动时启动MySQL”，以便每次计算机重新启动时启动mysql。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240227115204.png)

### 通过终端使用MySQL

MySQL 安装在 /usr/local/mysql/bin 文件夹中。

您可以将以下行添加到 bash 配置文件（文件 ~/.zshrc）中：

```bash
export MYSQL_HOME=/usr/local/mysql
export PATH=$PATH:$MYSQL_HOME/bin
```

要重新加载 shell 以考虑新的配置文件，请键入终端命令：

```bash
source ~/.zshrc
```

现在您可以通过以下命令使用 mysql

```bash
mysql -u root -p
```

然后输入您在安装时选择的密码。