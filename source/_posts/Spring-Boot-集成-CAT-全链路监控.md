---
title: Spring Boot 集成 CAT 全链路监控
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2021-11-26 20:56:58
password:
summary: Spring Boot 集成 CAT的使用
tags:
	- CAT
	- 中间件
	- JAVA
	- Spring Boot
categories:
	- 监控
---



## 一、编写一个 springboot 与 cat 整合的案例

### 将 cat-client 通过源码安装到本地仓库

* cat-client的源码路径：cat/lib/java
* 进入源码路径后，执行命令：
```
mvn clean install -DskipTests
```

安装成功后，在本地仓库就存在 cat-client-3.0.0.jar 包了

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-10.png)

### CAT客户端 Demo

#### maven 引入 cat 客户端包，在 pom.xml 加入

```
<dependency>
    <groupId>com.dianping.cat</groupId>
    <artifactId>cat-client</artifactId>
    <version>3.0.0</version>
</dependency>
```

#### 配置domain

* 在资源文件中新建app.properties文件

在resources资源文件META-INF下，注意是src/main/resources/META-INF/文件夹，加上domain配置，如：app.name=spring-boot-cat-simple


* 接着我们以一个简单的接口测试演练下，项目结构如下：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-dashboard-5.png)


HelloController 类

```
package com.zq.controller;

import com.zq.service.CatService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;

// @RestController 的意思是 Controller 里面的方法都以 json 格式输出
@RestController
public class HelloController {

    @Autowired
    private CatService catServiceImpl;

    @RequestMapping("/hello")
    public String index(HttpServletRequest request) {
        String url = request.getRequestURL().toString();

        return catServiceImpl.hello(url);
    }

    @RequestMapping("/error")
    public String error(HttpServletRequest request) {
        String url = request.getRequestURL().toString();

        return catServiceImpl.error(url);
    }
}

```

Service 类
```
package com.zq.service.impl;

import com.dianping.cat.Cat;
import com.dianping.cat.message.Transaction;
import com.zq.service.CatService;
import org.springframework.stereotype.Service;

@Service
public class CatServiceImpl implements CatService {

    @Override
    public String hello(String url) {

        // 创建一个 Transaction
        Transaction transaction = Cat.newTransaction("URL", url);
        try {
            // 处理业务
            myBusiness();
            // 设置成功状态
            transaction.setStatus(Transaction.SUCCESS);
        } catch (Exception e) {
            // 设置错误状态
            transaction.setStatus(e);
            // 记录错误信息
            Cat.logError(e);
        } finally {
            // 结束 Transaction
            transaction.complete();
        }

        return "hello";
    }

    @Override
    public String error(String url) {
        // 创建一个 Transaction
        Transaction transaction = Cat.newTransaction("URL", url);
        try {
            // 处理业务
            int i = 1 / 0;
            // 设置成功状态
            transaction.setStatus(Transaction.SUCCESS);
        } catch (Exception e) {
            // 设置错误状态
            transaction.setStatus(e);
            // 记录错误信息
            Cat.logError(e);
        } finally {
            // 结束 Transaction
            transaction.complete();
        }

        return "error";
    }

    private void myBusiness() {
        // 模拟业务处理时间
        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}

```

* 请求：http://localhost:8900/hello

* 请求：http://localhost:8900/hello/error


## 二、查看监控信息

进入 cat 控制台，点击 Transaction 按钮 ，之后点击全部，会看到有哪些客户端，如图：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-dashboard-1.png)


点击客户端 spring-boot-cat-simple ，出现如图：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-dashboard-2.png)


接着再点击 URL 的 Type 

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-dashboard-3.png)


如上图，可以清晰的看到 请求的 总个数（tatal）、均值（avg）、最大/最小（max/min)、标准差（std）等，其他都比较直观


点击 “log View” 可以查看 错误信息，如图：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cat-dashboard-4.png)


## 三、源码

- [spring-boot-cat-simple](https://github.com/dendi875/spring-boot-study/tree/main/spring-boot-cat-simple)