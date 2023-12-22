---
title: 如何将一个已存在的目录转换为一个 Git 项目并托管到 GitHub 仓库
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-09-25 10:59:48
password:
summary: 如何将一个已存在的目录转换为一个 Git 项目并托管到 GitHub 仓库
tags:
	- Git
	- 工具
categories:
	- Git
---

## 一、 打开命令行终端，进入项目所在的本地目录，将目录初始化为一个 Git 项目

```bash
$ git init
```

此时会在目录中创建一个 `.git` 隐藏文件夹

## 二、 将所有文件放进新的本地 Git 仓库

```bash
$ git add .
```

如果你本地已经有 `.gitignore` 文件，会按照已有规则过滤不需要添加的文件。如果不想要添加所有文件，可以把 `.` 符号换成具体的文件名

## 三、 将添加的文件提交到仓库

```bash
$ git commit -m "Initial commit"
```

## 四、 访问 GitHub

有些时候可能要翻墙

## 五、 创建一个新仓库

为了避免冲突，先不要勾选 README 和 LICENSE 选项

## 六、 在生成的项目主页上，复制仓库地址

类似于 `git@github.com:dendi875/spring-family-study.git`

## 七、 回到命令行终端界面，将本地仓库关联到远程仓库

`$ git remote add origin git@github.com:dendi875/spring-family-study.git` 可运行以下命令查看结果：

`$ git remote -v` 

## 八、 提交代码到 GitHub 仓库

```
$ git push origin master
```