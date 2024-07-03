---
title: npm yarn如何查看源和切换源
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-03-14 17:59:49
password:
summary: npm yarn如何查看源和切换源
tags:
  - 前端
categories: 前端
---

## npm查看源和切换源

```bash
npm config get registry # 查看npm当前镜像源
npm config set registry https://registry.npm.taobao.org/  # 设置npm镜像源为淘宝镜像
```

## yarn查看源和切换源

```bash
yarn config get registry  # 查看yarn当前镜像源
yarn config set registry https://registry.npm.taobao.org/  # 设置yarn镜像源为淘宝镜像
```

## 常用镜像源地址

-   npm — https://registry.npmjs.org/
-   cnpm — https://r.cnpmjs.org/
-   taobao — https://registry.npm.taobao.org/
-   nj — https://registry.nodejitsu.com/
-   rednpm — https://registry.mirror.cqupt.edu.cn/
-   npmMirror — https://skimdb.npmjs.com/registry/
-   deunpm — http://registry.enpmjs.org/
