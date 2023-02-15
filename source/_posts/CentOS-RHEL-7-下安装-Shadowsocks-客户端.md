---
title: CentOS/RHEL 7 下安装 Shadowsocks 客户端
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-10-10 11:16:03
password:
summary:  CentOS/RHEL 7 下安装 Shadowsocks 客户端
tags: 科学上网
categories: 科学上网
---
# CentOS/RHEL 7 下安装 Shadowsocks 客户端

在 CentOS 7 或 RHEL「Red Hat Enterprise Linux」 7 下安装 Shadowsocks 的客户端非常容易。由于在 [COPR](https://copr.fedorainfracloud.org/coprs/librehat/shadowsocks/) 「Cool Other Package Repo」 中已经有打包好的 *shadowsocks-libev*，因此我们只需几条命令便能完成安装。

注：本文介绍的是 Shadowsocks 客户端在 CentOS/RHEL 7 上的配置方法，如需了解 Shadowsocks 服务端在 CentOS/RHEL 7 上的配置，请参阅 [CentOS/RHEL 7 下安装 Shadowsocks 服务端](https://zhangquan.me/2022/10/09/centos-rhel-7-xia-an-zhuang-shadowsocks-fu-wu-duan/)。

## 安装 Shadowsocks

执行安装 Shadowsocks 的命令之前，我们需要先切换到 root 用户（直接以 root 身份登入；或是以普通用户登入，通过命令 `sudo su -` 切换为 root 用户)，或者使用普通用户，但在每条命令前加上 `sudo`。

另外，后续的配置也需要以 root 用户的身份进行。

具体安装 *shadowsocks-libev* 的命令如下：

``` shell
cd /etc/yum.repos.d/
curl -O https://copr.fedorainfracloud.org/coprs/librehat/shadowsocks/repo/epel-7/librehat-shadowsocks-epel-7.repo
yum install -y shadowsocks-libev
```

安装完成后，会有 `ss-local`, `ss-manager`, `ss-nat`, `ss-redir`, `ss-server`, `ss-tunnel` 命令可用。

其中，作为客户端，我们需要的是 `ss-local`，不过后文中我们将通过服务文件启动 Shadowsocks，而不会直接与 `ss-local` 命令打交道。

注，如果安装报类似如下错误：

```bash
Error: Package: shadowsocks-libev-3.1.3-1.el7.centos.x86_64 (librehat-shadowsocks)
           Requires: libsodium >= 1.0.4
Error: Package: shadowsocks-libev-3.1.3-1.el7.centos.x86_64 (librehat-shadowsocks)
           Requires: mbedtls
```

说明系统没有启用 EPEL (Extra Packages for Entreprise Linux)。那么我们需要首先启用 EPEL，再安装 shadowsocks-libev：

```bash
yum install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
yum install -y shadowsocks-libev
```

## 验证安装

在继续后文的配置之前，我们先在命令行中执行一次 ss-local 命令，以确认 shadowsocks 及其依赖已正确安装。


### 常见问题

- 执行 `ss-local` 报错：`ss-local: error while loading shared libraries: libmbedcrypto.so.0: cannot open shared object file: No such file or directory`:

  使用 root 身份执行以下命令即可：

  ```bash
  cd /usr/lib64
  ln -s libmbedcrypto.so.1 libmbedcrypto.so.0
  ```

  参考：[error while loading shared libraries: libmbedcrypto.so.0 · Issue #1966 · shadowsocks/shadowsocks-libev](https://github.com/shadowsocks/shadowsocks-libev/issues/1966)

## 添加配置文件

COPR 里的 *shadowsocks-libev* 默认读取位于 `/etc/shadowsocks-libev/config.json` 的配置文件，我们可以根据需要参考以下配置文件进行修改：

```bash
{
	"server": "zhangquan.me",
	"server_port": 55278,
	"local_port": 1080,
	"password": "55278",
	"method": "chacha20-ietf-poly1305",
	"mode": "tcp_and_udp",
	"timeout": 600
}
```

- `"server"`： 必填，填入要连接的 shadowsocks 服务器域名或 IP。

- `"server_port"`： 必填，填入服务器上 shadowsocks 所监听的端口。

- `"local_port"`： 必填，填入本地 shadowsocks 客户端 SOCKS5 代理要监听的端口。

- `"password"`： 必填，密码，需与 shadowsocks 服务器端配置一致。

- `"method"`： 必填，加密方法，需与 shadowsocks 服务器端配置一致。

- `"mode"`： 选填，默认 `"tcp_only"`。

  shadowsocks 所要监听的协议，可填 `"tcp_only"`, `"udp_only"` 和 `"tcp_and_udp"`。
  填入 `"tcp_and_udp"` 相当于命令行上提供 `-u` 参数；填入 `"udp_only"` 相当于命令行上提供 `-U` 参数。

- `"timeout"`： 选填，不活动连接的保持时间。

  默认 60 秒，设置较长时间有助于保持 HTTP 长连接等。设置时间过长则会导致不必要地占用过多 shadowsocks 服务器资源。

对于配置客户端，完成以上几项配置就足够了。

如果想要变更默认的配置文件，或者提供其他命令行参数，我们可以修改 `/etc/sysconfig/shadowsocks-libev`：

```
# Configuration file
CONFFILE="/etc/shadowsocks-libev/config.json"

# Extra command line arguments
DAEMON_ARGS="-u"
```

其中 `CONFFILE` 指定了 *shadowsocks-libev* 所读取的配置文件；`DAEMON_ARGS` 则指定了额外的命令行参数，此处的 `"-u"` 表示启用 UDP 协议。

需要注意的是，命令行参数 `DAEMON_ARGS` 比配置文件 `CONFFILE` 中指定的选项优先级要更高一些。

## 启动 Shadowsocks 服务

有了 Shadowsocks 客户端的配置文件后，我们通过 systemd 启动 Shadowsocks 的客户端服务：

```bash
systemctl enable --now shadowsocks-libev-local
```

以上命令同时也会配置 Shadowsocks 客户端服务的开机自动启动。

至此，客户端所需要的所有配置就都已经完成了。

## 检查 Shadowsocks 服务状态

要确认 Shadowsocks 的服务运行状态及最新日志，我们可以执行命令：

```bash
systemctl status shadowsocks-libev-local
```

要查看 Shadowsocks 服务的全部日志，我们可以执行命令：

```bash
journalctl -u shadowsocks-libev-local
```