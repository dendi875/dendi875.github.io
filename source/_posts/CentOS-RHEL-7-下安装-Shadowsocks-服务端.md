---
title: CentOS/RHEL 7 下安装 Shadowsocks 服务端
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-10-10 11:15:52
password:
summary: CentOS/RHEL 7 下安装 Shadowsocks 服务端
tags: 科学上网
categories: 科学上网
---

# CentOS/RHEL 7 下安装 Shadowsocks 服务端

在 CentOS 7 或 RHEL「Red Hat Enterprise Linux」 7 下安装 Shadowsocks 的服务端非常容易。由于在 [COPR](https://copr.fedorainfracloud.org/coprs/librehat/shadowsocks/) 「Cool Other Package Repo」 中已经有打包好的 *shadowsocks-libev*，因此我们只需几条命令便能完成安装。

注：本文介绍的是 Shadowsocks 服务端在 CentOS/RHEL 7 上的配置方法，如需了解 Shadowsocks 客户端在 CentOS/RHEL 7 上的配置，请参阅 [CentOS/RHEL 7 下安装 Shadowsocks 客户端](https://zhangquan.me/2022/10/09/centos-rhel-7-xia-an-zhuang-shadowsocks-ke-hu-duan/)。

## 安装 Shadowsocks

执行安装 Shadowsocks 的命令之前，我们需要先切换到 root 用户（直接以 root 身份登入；或是以普通用户登入，通过命令 `sudo su -` 切换为 root 用户)，或者使用普通用户，但在每条命令前加上 `sudo`。

另外，后续的配置也需要以 root 用户的身份进行。

具体安装 *shadowsocks-libev* 的命令如下：

```bash
cd /etc/yum.repos.d/
curl -O https://copr.fedorainfracloud.org/coprs/librehat/shadowsocks/repo/epel-7/librehat-shadowsocks-epel-7.repo
yum install -y shadowsocks-libev
```

安装完成后，会有 `ss-local`, `ss-manager`, `ss-nat`, `ss-redir`, `ss-server`, `ss-tunnel` 命令可用。

其中，作为服务器，我们需要的是 `ss-server`，不过后文中我们将通过服务文件启动 Shadowsocks，而不会直接与 `ss-server`命令打交道。

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

在继续后文的配置之前，我们先在命令行中执行一次 `ss-server` 命令，以确认 shadowsocks 及其依赖已正确安装。

### 常见问题

* 执行 `ss-server` 报错：`ss-server: error while loading shared libraries: libmbedcrypto.so.0: cannot open shared object file: No such file or directory`:

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
	"server": "0.0.0.0",
	"server_port": 55278,
	"password": "zhangquan.me",
	"timeout":60,
	"method": "chacha20-ietf-poly1305",
	"mode": "tcp_and_udp"
}
```

- `"server"`： 选填，默认 `"0.0.0.0"`。配置客户端时填入服务器的实际 IP。

  `"0.0.0.0"` 表明服务端接受来自任何网络接口的连接。配置服务端时填入 `"0.0.0.0"` 总是能生效，而不必填入服务器自身的 IP。

- `"server_port"`： 必填。需要在客户端配置时填入相同的值。

  此处填入服务端要监听的端口。需要选择 1024 或以上的端口号，否则启动 `ss-server` 时将会需要 root 权限，而默认的服务文件则是以 nobody 用户启动 Shadowsocks 的。

  如需选用低于 1024 的端口，也可执行命令 `sudo setcap 'cap_net_bind_service=+ep' /usr/bin/ss-server` 赋予相应权限，后续就可以使用 nobody 用户或普通用户启动 Shadowsocks。

  或执行 `systemctl edit shadowsocks-libev` 命令，并输入以下内容：

  ```bash
  [Service]
  AmbientCapabilities=CAP_NET_BIND_SERVICE
  ```

- `"password"`： 必填。需要在客户端配置时填入相同的值。

  连接服务端所需的密码，建议替换为复杂密码，避免被攻击者暴力破解。

- `"method"`： 选填，默认 `"rc4-md5"`。需要在客户端配置时填入相同的值。

  服务端所用的加密方法，推荐以下几种算法：

  1. `"chacha20-ietf-poly1305"` 具有优秀的安全性，更佳的性能，属于 AEAD 加密算法，少部分客户端（如 iOS Wingy）不支持此算法；
  2. `"aes-256-cfb"` 具有足够安全性，且被各服务端及客户端广泛支持；
  3. `"rc4-md5"` 算法快速，且具有一定的安全性，适合运算能力受限的设备如路由器等。

- `"mode"`： 选填，默认 `"tcp_only"`。

  服务器所要监听的协议，可填 `"tcp_only"`, `"udp_only"` 和 `"tcp_and_udp"`。
  填入 `"tcp_and_udp"` 相当于命令行上提供 `-u` 参数；填入 `"udp_only"` 相当于命令行上提供 `-U` 参数。

对于配置服务端，完成以上几项配置就足够了。

如果想要变更默认的配置文件，或者提供其他命令行参数，我们可以修改 `/etc/sysconfig/shadowsocks-libev`：

```bash
# Configuration file
CONFFILE="/etc/shadowsocks-libev/config.json"

# Extra command line arguments
DAEMON_ARGS="-u"
```

其中 `CONFFILE` 指定了 *shadowsocks-libev* 所读取的配置文件；`DAEMON_ARGS` 则指定了额外的命令行参数，此处的 `"-u"` 表示启用 UDP 协议。

需要注意的是，命令行参数 `DAEMON_ARGS` 比配置文件 `CONFFILE` 中指定的选项优先级要更高一些。

## 配置防火墙

CentOS/RHEL 7 系统自带了防火墙，为了使我们的 Shadowsocks 服务器能够正常工作，我们还需要添加相应的防火墙规则。

假设我们在配置 Shadowsocks 服务器的端口时填入了 `"server_port": 55278`，那我们可以使用以下命令：

```bash
firewall-cmd --permanent --add-port=55278/tcp
firewall-cmd --permanent --add-port=55278/udp
firewall-cmd --reload
```

如果使用的是其他端口，则按实际情况相应地替换命令中的端口即可。

另外，如果服务器是运行在 VPS 或云服务器上，则往往还需要在云服务商的控制面板中配置相应的防火墙规则。

## 启动 Shadowsocks 服务

有了 Shadowsocks 服务端的配置文件后，我们通过 systemd 启动 Shadowsocks 的服务端服务：

```bash
systemctl start shadowsocks-libev
```

## 检查 Shadowsocks 服务状态

要确认 Shadowsocks 的服务运行状态及最新日志，我们可以执行命令：

```bash
systemctl status shadowsocks-libev
```

要查看 Shadowsocks 服务的全部日志，我们可以执行命令：

```bash
journalctl -u shadowsocks-libev
```

## 配置服务开机自启

上文中，我们通过 `systemctl start` 启动了服务，但是如果我们想要服务能在开机时自动启动，还需要执行以下命令：

```bash
systemctl enable shadowsocks-libev
```

至此，服务端所需要的所有配置就都已经完成了。

## 配置客户端

由于本文着重介绍服务端的安装配置，将不再详述客户端相关的内容。

关于客户端的配置文件，可以复制使用服务端的配置文件，并将 `"server"` 中的地址换为服务端的实际 IP 或域名，再加上关于 `local_address` 和 `local_port` 的配置即可。如：

```bash
{
	"server": "zhangquan.me",
	"server_port": 55278,
	"local_address": "0.0.0.0",
	"local_port": 1080,
	"password": "zhangquan.me",
	"method": "chacha20-ietf-poly1305",
	"mode": "tcp_and_udp"
}
```