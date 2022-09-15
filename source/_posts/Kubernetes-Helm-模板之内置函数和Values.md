---
title: Kubernetes Helm 模板之内置函数和Values
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-09-01 15:55:12
password:
summary: Kubernetes Helm 模板之内置函数和Values
tags: Kubernetes
categories: Kubernetes
---

# Kubernetes Helm 模板之内置函数和Values

Helm 使用一种名为 charts 的包格式，一个 chart 是描述一组相关的 Kubernetes 资源的文件集合，单个 chart 可能用于部署简单的应用，比如 memcached pod，或者复杂的应用，比如一个带有 HTTP 服务、数据库、缓存等等功能的完整 web 应用程序。

Charts 是创建在特定目录下面的文件集合，然后可以将它们打包到一个版本化的存档中来部署。接下来我们就来看看使用 Helm 构建 charts 的一些基本方法。

## Chart 基本概念和使用

参考官方文档：https://helm.sh/zh/docs/topics/charts/

## Chart 模板编写

参考官方文档：https://helm.sh/zh/docs/chart_template_guide/

## Chart Hooks

参考官方文档：https://helm.sh/zh/docs/topics/charts_hooks/

## 内置函数和Values

### 创建第一个Helm chart

创建一个 mychart 包，参考：https://helm.sh/zh/docs/chart_template_guide/getting_started/

```shell
# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/
$ mkdir -p helm/charts && cd helm/charts

# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm/charts [18:47:22] 
$ helm create mychart
Creating mychart

# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm/charts [18:48:48] 
$ tree mychart 
mychart
├── Chart.yaml
├── charts
├── templates
│   ├── NOTES.txt
│   ├── _helpers.tpl
│   ├── deployment.yaml
│   ├── hpa.yaml
│   ├── ingress.yaml
│   ├── service.yaml
│   ├── serviceaccount.yaml
│   └── tests
│       └── test-connection.yaml
└── values.yaml

3 directories, 10 files
```

我们把 templates 目录下面所有文件全部删除掉，这里我们自己来创建模板文件：

```shell
# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm/charts [19:25:33] 
$ rm -rf mychart/templates/*
```

### 创建模板

这里我们来创建一个非常简单的模板 ConfigMap，在 templates 目录下面新建一个`configmap.yaml`文件：

```yaml
# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm/charts [19:25:41] 
$ vi mychart/templates/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mychart-configmap
data:
  myvalue: "Hello World"
```

实际上现在我们就有一个可安装的 chart 包了，通过`helm install`命令来进行安装：

```shell
$ helm install ./mychart --generate-name
NAME: mychart-1662020439
LAST DEPLOYED: Thu Sep  1 16:20:41 2022
NAMESPACE: default
STATUS: deployed
REVISION: 1
TEST SUITE: None
```

在上面的输出中，我们可以看到我们的 ConfigMap 资源对象已经创建了。然后使用如下命令我们可以看到实际的模板被渲染过后的资源文件：

```shell
# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm/charts [16:20:41] 
$ helm get  manifest mychart-1662020439 
---
# Source: mychart/templates/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mychart-configmap
data:
  myvalue: "Hello World"
```

现在我们看到上面的 ConfigMap 文件是不是正是我们前面在模板文件中设计的，现在我们删除当前的`release`:

```shell
$ helm ls
NAME                    NAMESPACE       REVISION        UPDATED                                 STATUS          CHART           APP VERSION
clunky-serval           default         1               2022-08-30 19:47:55.604474 +0800 CST    deployed        mychart-0.1.0   1.16.0     
mychart-1661867411      default         1               2022-08-30 21:50:13.801393 +0800 CST    deployed        mychart-0.1.0   1.16.0     
mychart-1662020439      default         1               2022-09-01 16:20:41.481324 +0800 CST    deployed        mychart-0.1.0   1.16.0     
rude-cardinal           default         1               2022-08-30 21:26:33.926513 +0800 CST    deployed        mychart-0.1.0   1.16.0  

$ helm uninstall mychart-1662020439
release "mychart-1662020439" uninstalled
```

### 添加一个简单的模板

我们可以看到上面我们定义的 ConfigMap 的名字是固定的，但往往这并不是一种很好的做法，我们可以通过插入 release 的名称来生成资源的名称，比如这里 ConfigMap 的名称我们希望是：zq-configmap，这就需要用到 Chart 的模板定义方法了。

Helm Chart 模板使用的是[`Go`语言模板](https://pkg.go.dev/text/template)编写而成，并添加了[`Sprig`库](https://masterminds.github.io/sprig/)中的50多个附件模板函数。

现在我们来重新定义下上面的 configmap.yaml 文件：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ .Release.Name }}-configmap
data:
  myvalue: "Hello World"
```

我们将名称替换成了`{{ .Release.Name }}-configmap`，其中包含在`{{`和`}}`之中的就是模板指令，`{{ .Release.Name }}` 将 release 的名称注入到模板中来，这样最终生成的 ConfigMap 名称就是以 release 的名称开头的了。这里的 Release 模板对象属于 Helm 内置的一种对象，还有其他很多内置的对象，稍后我们将接触到。

现在我们来重新安装我们的 Chart 包，注意观察 ConfigMap 资源对象的名称：

```shell
# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm/charts [16:21:53] 
$ helm install ./mychart --generate-name
NAME: mychart-1662020625
LAST DEPLOYED: Thu Sep  1 16:23:47 2022
NAMESPACE: default
STATUS: deployed
REVISION: 1
TEST SUITE: None
```

可以看到现在生成的名称变成了**mychart-1662020625**，证明已经生效了，当然我们也可以使用命令`helm get manifest mychart-1662020625`查看最终生成的清单文件的样子。

```shell
$ helm get manifest  mychart-1662020625
---
# Source: mychart/templates/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mychart-1662020625-configmap
data:
  myvalue: "Hello World"
```

### 调试

我们用模板来生成资源文件的清单，但是如果我们想要调试就非常不方便了，不可能我们每次都去部署一个`release`实例来校验模板是否正确，所幸的时 Helm 为我们提供了`--dry-run --debug`这个可选参数，在执行`helm install`的时候带上这两个参数就可以把对应的 values 值和生成的最终的资源清单文件打印出来，而不会真正的去部署一个`release`实例，比如我们来调试上面创建的 chart 包：

```shell
# zhangquan @ MacBook-Pro in ~/code/github.com/k8s-app/helm/charts [16:25:52] 
$ helm install --dry-run --debug --generate-name ./mychart                 
install.go:178: [debug] Original chart version: ""
install.go:199: [debug] CHART PATH: /Users/zhangquan/code/github.com/k8s-app/helm/charts/mychart

NAME: mychart-1662020797
LAST DEPLOYED: Thu Sep  1 16:26:39 2022
NAMESPACE: default
STATUS: pending-install
REVISION: 1
TEST SUITE: None
USER-SUPPLIED VALUES:
{}

COMPUTED VALUES:
......
HOOKS:
MANIFEST:
---
# Source: mychart/templates/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mychart-1662020797-configmap
data:
  myvalue: "Hello World"
```

现在我们使用`--dry-run`就可以很容易地测试代码了，不需要每次都去安装一个 release 实例了，但是要注意的是这不能确保 Kubernetes 本身就一定会接受生成的模板，在调试完成后，还是需要去安装一个实际的 release 实例来进行验证的。

### 内置对象

参考官方文档：https://helm.sh/zh/docs/chart_template_guide/builtin_objects/

### values 文件

参考官方文档：https://helm.sh/zh/docs/chart_template_guide/values_files/
