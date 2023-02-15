---
title: 使用 kubeadm 创建 Kubernetes 集群
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-08-14 15:17:59
password:
summary: 本文记录了使用 kubeadm 从头搭建一个使用 docker 作为容器运行时的 Kubernetes 集群的过程。
tags: Kubernetes
categories: Kubernetes
---


# 使用 kubeadm 创建 Kubernetes 集群

本文记录了使用 kubeadm 从头搭建一个使用 docker 作为容器运行时的 Kubernetes 集群的过程。

kubeadm 的源代码，直接就在 kubernetes/cmd/kubeadm 目录下，是kubernetes项目的一部分。

kubeadm几乎完全是一位高中生的作品。他叫Lucas Käldström，芬兰人，kubeadm 是他17岁时用业余时间完成的一个社区项目。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/lucas.png)

## Kubeadm是什么

Kubeadm 是一个命令行工具，它主要提供了 `kubeadm init` 以及 `kubeadm join`这两个命令来快速创建和初始化kubernetes 集群。

Kubeadm 通过执行必要的操作来启动和运行一个最小可用的集群。它被故意设计为只关心启动集群，而不是之前的节点准备工作。同样的，诸如安装各种各样的插件，例如 Kubernetes Dashboard、监控解决方案以及特定云提供商的插件，这些都不在它负责的范围。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/kubeadm-1.png)

## 实践环境

本次实验用到的机器如下：

| 主机名     | **系统版本**     | 配置 | **IP**     | 角色   |
| ---------- | ---------------- | ---- | ---------- | ------ |
| k8s-master | CentOS 7.9 64bit | 2C4G | 172.31.0.2 | master |
| k8s-node1  | CentOS 7.9 64bit | 2C4G | 172.31.0.3 | worker |
| k8s-node2  | CentOS 7.9 64bit | 2C4G | 172.31.0.4 | worker |

软件版本：

* Docker：Docker-ce-20.10.7，Docker-ce-cli-20.10.7，Containerd.io-1.4.6

* Kubernetes version：v1.20.9
* Calico：3.21

## 开始之前

* 每台机器 2 GB 或更多的 RAM（如果少于这个数字将会影响你应用的运行内存）
* 每台机器 CPU 2 核心及以上

* 集群中的所有机器的网络彼此均能相互连接（公网和内网都可以）

* 禁用交换分区。为了保证 kubelet 正常工作，你 **必须** 禁用交换分区

相关环境的搭建和初始化笔者这里先行略过，可以选择阿里云、青云等

以下内容均使用root账户安装和配置。

## 安装指导

### 安装Docker（所有节点）

* 配置 yum 源

  ```bash
  # 安装 yum的工具包
  yum install -y yum-utils
  
  # 配置 docker 的 yum 源，告诉 Linux docker 去哪里下载
  yum-config-manager \
  --add-repo \
  http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
  ```

* 安装 docker

  ```bash
  yum install -y docker-ce-20.10.7 docker-ce-cli-20.10.7  containerd.io-1.4.6
  ```

* 启动 docker 并设置开机自启动

  ```bash
  systemctl enable docker --now
  ```

* 验证安装成功

  ```bash
  docker info
  ```

* 配置镜像加速器地址

  我们可以注册一个阿里云账号，然后使用阿里云容器镜像服务中的免费镜像

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/aliyun-mirror.png)

  

  这里我们额外添加了docker的生产环境核心配置cgroup

  ```bash
  mkdir -p /etc/docker
  
  tee /etc/docker/daemon.json <<-'EOF'
  {
    "registry-mirrors": ["https://txuroz75.mirror.aliyuncs.com"],
    "exec-opts": ["native.cgroupdriver=systemd"],
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "100m"
    },
    "storage-driver": "overlay2"
  }
  EOF
  
  systemctl daemon-reload
  systemctl restart docker
  ```

* 验证配置生效

  ```bash
  docker info
  ```

### k8s 环境准备（所有节点）

* 设置主机名

  ```bash
  #各个机器设置自己的域名
  hostnamectl set-hostname <myhostname>
  
  # 我自己的三台机器这样设置
  hostnamectl set-hostname k8s-master
  hostnamectl set-hostname k8s-node1
  hostnamectl set-hostname k8s-node2
  ```

* 关闭交换分区

  ```bash
  # 临时关闭
  swapoff -a  
  # 永久关闭
  sed -ri 's/.*swap.*/#&/' /etc/fstab
  ```

* 禁用 SELinux

  将 SELinux 设置为 permissive 模式（相当于将其禁用）， 这是允许容器访问主机文件系统所必需的

  ```bash
  # 临时禁用
  setenforce 0
  # 永久禁用
  sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config
  ```

* 允许 iptables 检查桥接流量

  ```bash
  cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
  br_netfilter
  EOF
  
  cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
  net.bridge.bridge-nf-call-ip6tables = 1
  net.bridge.bridge-nf-call-iptables = 1
  EOF
  
  # 让配置生效
  sudo sysctl --system
  ```

### 安装 kubelet、kubectl、kubeadm（所有节点）

* 配置 yum 源

  官网提供的 google 源一般用不了，这里直接换成阿里的源

  ```bash
  cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
  [kubernetes]
  name=Kubernetes
  baseurl=http://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-x86_64
  enabled=1
  gpgcheck=0
  repo_gpgcheck=0
  gpgkey=http://mirrors.aliyun.com/kubernetes/yum/doc/yum-key.gpg
     http://mirrors.aliyun.com/kubernetes/yum/doc/rpm-package-key.gpg
  exclude=kubelet kubeadm kubectl
  EOF
  ```

* 执行安装

  ```bash
  # --disableexcludes 禁掉除了kubernetes之外的别的仓库
  # 由于官网未开放同步方式, 替换成阿里源后可能会有索引 gpg 检查失败的情况, 这时请带上`--nogpgcheck`选项安装
  # 指定安装 1.20.9 版本
  
  sudo yum install -y kubelet-1.20.9 kubeadm-1.20.9 kubectl-1.20.9 --disableexcludes=kubernetes --nogpgcheck
  ```

* kubelet 设置开机启动

  ```bash
  sudo systemctl enable kubelet --now 
  ```

### 初始化 master 节点（k8s-master）

* 生成 kubeadm.yaml 文件

  首先导出 kubeadm 配置文件

  ```bash
  kubeadm config print init-defaults --kubeconfig ClusterConfiguration > kubeadm.yml
  ```

  查看所需镜像列表

  ```she
  [root@k8s-master ~]# kubeadm config images list --config kubeadm.yml
  k8s.gcr.io/kube-apiserver:v1.20.0
  k8s.gcr.io/kube-controller-manager:v1.20.0
  k8s.gcr.io/kube-scheduler:v1.20.0
  k8s.gcr.io/kube-proxy:v1.20.0
  k8s.gcr.io/pause:3.2
  k8s.gcr.io/etcd:3.4.13-0
  k8s.gcr.io/coredns:1.7.0
  ```

* 使用国内源拉取所需要的镜像

  其它两个节点需要 kube-proxy ，我们为了方便就全部都安装，所以其它两个节点也执行下面的命令

  ```bash
  sudo tee ./images.sh <<-'EOF'
  #!/bin/bash
  images=(
  kube-apiserver:v1.20.9
  kube-proxy:v1.20.9
  kube-controller-manager:v1.20.9
  kube-scheduler:v1.20.9
  coredns:1.7.0
  etcd:3.4.13-0
  pause:3.2
  )
  for imageName in ${images[@]} ; do
  docker pull registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images/$imageName
  done
  EOF
     
     
  chmod +x ./images.sh && ./images.sh
  ```

* 执行初始化

  镜像拉取下来后就可以开始安装了，执行以下命令初始化主节点，只在主节点上执行

  ```bash
  #所有机器添加 master 域名映射，以下需要修改为自己的ip，master节点我们也叫做集群入口节点，让所有节点知道 master节点在哪
  echo "172.31.0.2  cluster-endpoint" >> /etc/hosts
  
  #主节点初始化
  # 注意：
  # --apiserver-advertise-address 修改成自己 master 节点机器的ip
  # --control-plane-endpoint 是上面 hosts 映射的值
  # --kubernetes-version 的版本号要对应
  # --service-cidr，--pod-network-cidr 值最好不要修改
  # 所有网络范围不能重叠： --service-cidr，--pod-network-cidr，三台机器ip都不能有重叠
  
  kubeadm init \
  --apiserver-advertise-address=172.31.0.2 \
  --control-plane-endpoint=cluster-endpoint \
  --image-repository registry.cn-hangzhou.aliyuncs.com/lfy_k8s_images \
  --kubernetes-version v1.20.9 \
  --service-cidr=10.96.0.0/16 \
  --pod-network-cidr=192.168.0.0/16
  ```

​		输出如下恭喜你安装成功了

       ```bash
       # 出现这个就说明安装成功了
       Your Kubernetes control-plane has initialized successfully!
       # 执行下面的命令配置 kubeconfig
       To start using your cluster, you need to run the following as a regular user:
       
         mkdir -p $HOME/.kube
         sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
         sudo chown $(id -u):$(id -g) $HOME/.kube/config
       
       Alternatively, if you are the root user, you can run:
       
         export KUBECONFIG=/etc/kubernetes/admin.conf
       # 配置 pod 网络的命令
       You should now deploy a pod network to the cluster.
       Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
         https://kubernetes.io/docs/concepts/cluster-administration/addons/
       
       You can now join any number of control-plane nodes by copying certificate authorities
       and service account keys on each node and then running the following as root:
       # 哪个机器需要变成主节点执行该命令，这是为了多 master 集群
         kubeadm join cluster-endpoint:6443 --token z9wjde.ewp0hefm2swxupn6 \
           --discovery-token-ca-cert-hash sha256:336a976225818ce72ed9cf1b87bebda2b094f11732a0b622becc5a1b71b733be \
           --control-plane 
       
       Then you can join any number of worker nodes by running the following on each as root:
       # 哪个 node 节点想要加入集群需要执行如下指令
       kubeadm join cluster-endpoint:6443 --token z9wjde.ewp0hefm2swxupn6 \
           --discovery-token-ca-cert-hash sha256:336a976225818ce72ed9cf1b87bebda2b094f11732a0b622becc5a1b71b733be
       ```

​	按照提示配置 kubeconfig

```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

配置好后查看一下 node 状态

```bash
[root@k8s-master ~]# kubectl get node
NAME         STATUS     ROLES                  AGE   VERSION
k8s-master   NotReady   control-plane,master   10m   v1.20.9
```

状态为 NotReady，因为此时还没有安装网络插件。

### 部署Calico（k8s-master）

注意 Calio 版本需要与 K8s 版本对应，具体要求看  [requirements](https://projectcalico.docs.tigera.io/archive/v3.21/getting-started/kubernetes/requirements)

安装参考官网：[install calico](https://projectcalico.docs.tigera.io/archive/v3.21/getting-started/kubernetes/self-managed-onprem/onpremises)

* 下载配置文件并拉取镜像，只在 master 节点上执行

  ```bash
  curl https://docs.projectcalico.org/archive/v3.21/manifests/calico.yaml -O
  ```

* 部署，只在 master 节点上执行

  ```bash
  kubectl apply -f calico.yaml
  ```

  如果不错意外的话等一会 calico 就安装好了，可以通过以下命令查看：

  ```bash
  [root@k8s-master ~]# kubectl get pods -A
  NAMESPACE     NAME                                       READY   STATUS    RESTARTS   AGE
  kube-system   calico-kube-controllers-5bb48c55fd-ghkdz   1/1     Running   0          8m10s
  kube-system   calico-node-6vwgq                          1/1     Running   0          8m10s
  kube-system   coredns-5897cd56c4-kqfn2                   1/1     Running   0          31m
  kube-system   coredns-5897cd56c4-wcgdh                   1/1     Running   0          31m
  kube-system   etcd-k8s-master                            1/1     Running   0          31m
  kube-system   kube-apiserver-k8s-master                  1/1     Running   0          31m
  kube-system   kube-controller-manager-k8s-master         1/1     Running   0          31m
  kube-system   kube-proxy-rnt4v                           1/1     Running   0          31m
  kube-system   kube-scheduler-k8s-master                  1/1     Running   0          31m
  ```

  ```bash
  [root@k8s-master ~]# kubectl get node
  NAME         STATUS   ROLES                  AGE   VERSION
  k8s-master   Ready    control-plane,master   32m   v1.20.9
  ```

### Node节点加入集群（k8s-node1,k8s-node2）

* 在k8s-node1,k8s-node2上执行该步骤，将节点加入到集群中

先在  k8s-node1 、 k8s-node2节点执行

```bash
kubeadm join cluster-endpoint:6443 --token z9wjde.ewp0hefm2swxupn6 \
    --discovery-token-ca-cert-hash sha256:336a976225818ce72ed9cf1b87bebda2b094f11732a0b622becc5a1b71b733be
```

输出如下：

```bash
[root@k8s-node1 ~]# kubeadm join cluster-endpoint:6443 --token z9wjde.ewp0hefm2swxupn6 \
>     --discovery-token-ca-cert-hash sha256:336a976225818ce72ed9cf1b87bebda2b094f11732a0b622becc5a1b71b733be
[preflight] Running pre-flight checks
        [WARNING SystemVerification]: this Docker version is not on the list of validated versions: 20.10.7. Latest validated version: 19.03
        [WARNING Hostname]: hostname "k8s-node1" could not be reached
        [WARNING Hostname]: hostname "k8s-node1": lookup k8s-node1 on 100.64.7.3:53: no such host
[preflight] Reading configuration from the cluster...
[preflight] FYI: You can look at this config file with 'kubectl -n kube-system get cm kubeadm-config -o yaml'
[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"
[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"
[kubelet-start] Starting the kubelet
[kubelet-start] Waiting for the kubelet to perform the TLS Bootstrap...

This node has joined the cluster:
* Certificate signing request was sent to apiserver and a response was received.
* The Kubelet was informed of the new secure connection details.

Run 'kubectl get nodes' on the control-plane to see this node join the cluster.
```

* 检查集群状态，在 k8s-master 上执行

  * 检查各组件运行状态

    ```bash
    [root@k8s-master ~]#  kubectl get cs
    Warning: v1 ComponentStatus is deprecated in v1.19+
    NAME                 STATUS      MESSAGE                                                                                       ERROR
    scheduler            Unhealthy   Get "http://127.0.0.1:10251/healthz": dial tcp 127.0.0.1:10251: connect: connection refused   
    controller-manager   Unhealthy   Get "http://127.0.0.1:10252/healthz": dial tcp 127.0.0.1:10252: connect: connection refused   
    etcd-0               Healthy     {"health":"true"}   
    ```

    参考解决办法 ：https://stackoverflow.com/questions/54608441/kubectl-connectivity-issue

    出现这个问题的原因是 /etc/kubernetes/manifests/下的kube-controller-manager.yaml和kube-scheduler.yaml中启动参数设置的默认端口是0。  
    解决方法：将相应的`--port 0`参数注释掉，然后重启kubelet服务即可

    ```bash
    [root@k8s-master manifests]#  kubectl get cs
    Warning: v1 ComponentStatus is deprecated in v1.19+
    NAME                 STATUS    MESSAGE             ERROR
    scheduler            Healthy   ok                  
    controller-manager   Healthy   ok                  
    etcd-0               Healthy   {"health":"true"}  
    ```

  * 查看集群信息

    ```bash
    [root@k8s-master ~]# kubectl cluster-info
    Kubernetes control plane is running at https://cluster-endpoint:6443
    KubeDNS is running at https://cluster-endpoint:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
    
    To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.
    ```

  * 查看节点状态

    ```bash
    [root@k8s-master ~]# kubectl get nodes
    NAME         STATUS   ROLES                  AGE     VERSION
    k8s-master   Ready    control-plane,master   42m     v1.20.9
    k8s-node1    Ready    <none>                 5m15s   v1.20.9
    k8s-node2    Ready    <none>                 5m10s   v1.20.9
    ```

## 补充

### kubeadm token

`kubeadm init` 创建了一个有效期为 24 小时的令牌，过期之后要需要生成新的令牌。

``` shell
#  --print-join-command  不仅仅打印令牌，而是打印使用令牌加入集群所需的完整 'kubeadm join' 参数。
kubeadm token create --print-join-command
```

### kubernetes dashboard

> 该步骤只在 master 节点上执行

Dashboard 是基于网页的 Kubernetes 用户界面。您可以使用 Dashboard 将容器应用部署到 Kubernetes 集群中，也可以对容器应用排错，还能管理集群本身及其附属资源。您可以使用 Dashboard 获取运行在集群中的应用的概览信息，也可以创建或者修改 Kubernetes 资源（如 Deployment，Job，DaemonSet 等等）。例如，您可以对 Deployment 实现弹性伸缩、发起滚动升级、重启 Pod 或者使用向导创建新的应用。

* 下载配置文件

  ```bash
  wget https://raw.githubusercontent.com/kubernetes/dashboard/v2.3.1/aio/deploy/recommended.yaml -O  dashboard.yaml
  ```

* 部署

  ```bash
  kubectl apply -f dashboard.yaml
  ```

* 设置访问端口

  ```bash
  kubectl edit svc kubernetes-dashboard -n kubernetes-dashboard
  ```

  **type: ClusterIP 改为 type: NodePort**

* 找到端口，在云服务器上的安全组放行

  ```bash
  kubectl get svc -A |grep kubernetes-dashboard
  ```

*  创建访问账号

  * 创建访问账号，准备一个yaml文件； vi  dash-user.yaml

    ```yaml
    apiVersion: v1
    kind: ServiceAccount
    metadata:
      name: admin-user
      namespace: kubernetes-dashboard
    ---
    apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRoleBinding
    metadata:
      name: admin-user
    roleRef:
      apiGroup: rbac.authorization.k8s.io
      kind: ClusterRole
      name: cluster-admin
    subjects:
    - kind: ServiceAccount
      name: admin-user
      namespace: kubernetes-dashboard
    ```

  * 部署

    ```bash
    kubectl apply -f dash-user.yaml
    ```

* 获取访问令牌

  ```bash
  kubectl -n kubernetes-dashboard get secret $(kubectl -n kubernetes-dashboard get sa/admin-user -o jsonpath="{.secrets[0].name}") -o go-template="{{.data.token | base64decode}}"
  ```

* 三个节点中任何一个节点都可以使用令牌登录

  ![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/dashboard.png)

## 参考资料

[install-docker](https://docs.docker.com/engine/install/centos/)

[install-kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm)

[create-cluster-kubeadm](https://kubernetes.io/zh/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)

[Install Calico](https://projectcalico.docs.tigera.io/archive/v3.22/getting-started/kubernetes/self-managed-onprem/onpremises)

[kubeadm-token](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-token/)

[kubernetes dashboard](https://github.com/kubernetes/dashboard)