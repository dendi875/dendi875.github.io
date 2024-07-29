---
title: Spring Boot 外部化配置 - 上篇
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-07-19 19:46:10
password:
summary: Spring Boot 外部化配置 - 上篇
tags:
	- Spring Boot
	- Java
categories: Spring Boot
---

## 文章说明

本系列会完整的介绍 Spring Boot 中外部化配置相关应用以及部分源码分析

* 上篇 - 什么是外部化配置，外部化配置有哪些应用，顺序覆盖性
* 中篇 - 外部化配置 @Value 注入、Environment 抽象、@ConfigurationProperties、@ConditionalOnProperty 应用场景
* 下篇 - 如何扩展外部化配置，代码演示覆盖顺序

> 项目环境

- jdk 1.8
- Spring Boot 2.0.2.RELEASE
- github 地址：https://github.com/dendi875/spring-boot-study
  - 本章模块：externalized-configuration

## 1.Spring Boot 官方说明

官网文档地址：https://docs.spring.io/spring-boot/docs/2.2.2.RELEASE/reference/htmlsingle/#boot-features-external-config

翻译：Spring Boot 让你可以外部化你的配置，以便于你可以让相同的应用在不同的环境中可以正常工作。你可以使用 properties、YAML 、环境变量和命令行参数去外部化配置，这里还举了三个使用方式

* `@Value` 注解
* `Environment` 抽象
* `@ConfigurationProperties`

## 2.举例说明

这里我们可以举一个简单的例子比如：使用 application.properties 去调整 Tomcat 的端口号

通常我们的默认端口是 8080，但是为了防止端口冲突，通常我们会修改 application.properties 文件增加如下配置即可，表示应用以 8081 端口启动，application.properties 文件并非程序代码部分，所以称为外部化配置。

```properties
server.port = 8081
```

小马哥（《Spring Boot 编程思想》作者）解读

>  何为 外部化配置？通常，对于可扩展性应用，尤其是中间件，他们的功能性组件是可配置化的，如：认证信息、端口范围、线程池规模以及连接时间等等。
>
> 假设需要设置 Spring 应用的 Profile 为 dev，可通过调整 Spring ConfigurableEnvironment 的 setActiveProfiles("dev") 方法实现。这种方式是一种显示的代码配置，配置数据来源于应用内部实现，所以称为 内部化配置，虽然能达成目的，但是缺少相应的弹性。
>
> 那么相对应的就是外部化配置，比如：application.properties 加入如下配置

```properties
spring.profiles.active = dev
```

## 3.外部化配置应用场景

> 本章只介绍 XML Bean 这种方式，其他的 4 种在 `Spring Boot 外部化配置 - 中篇` 进行详细讨论

应用场景：

* XML Bean 定义的属性占位符
* @Value 注入 - @since SpringFramework 3.0
* Environment 读取 - @since SpringFramework 3.1
* @ConfigurationProperties 绑定（Spring Boot 中新增注解）
* @ConditionalOnProperty 判断（Spring Boot 中新增注解）

## 4. XML Bean 定义的属性占位符

### 4.1 传统 spring 例子

在 resources/META-INF/spring 下新建 spring-context.xml 文件

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
       http://www.springframework.org/schema/beans/spring-beans.xsd">
    <!-- 属性占位符配置-->
    <bean class="org.springframework.beans.factory.config.PropertyPlaceholderConfigurer"><!-- Properties 文件 classpath 路径 -->
        <property name="location" value="classpath:/META-INF/default.properties"/><!-- 文件字符编码 -->
        <property name="fileEncoding" value="UTF-8"/>
    </bean>
</beans>
```

user-context.xml 文件

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
       http://www.springframework.org/schema/beans/spring-beans.xsd">

    <!-- User Bean -->
    <bean id="user" class="com.huajie.deepinspringboot.externlized.configuration.domain.User">
        <property name="id" value="${user.id}"/>
        <property name="name" value="${user.name}"/>
    </bean>

</beans>
```

在 resources/META-INF 下创建

default.properties

```xml
user.id = 1
user.name = 张三-properties
```

新建 User 类

```java
public class User {

	private Long id;

	private String name;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	@Override
	public String toString() {
		return "User{" +
				"id=" + id +
				", name='" + name + '\'' +
				'}';
	}
}
```

引导类 SpringXmlConfigPlaceHolderBootstrap

```java
public class SpringXmlConfigPlaceHolderBootstrap {

	public static void main(String[] args) {
		String [] locations = new String[] {"META-INF/spring/spring-context.xml", "META-INF/spring/user-context.xml"};
		ClassPathXmlApplicationContext context = new ClassPathXmlApplicationContext(locations);

		// 通过依赖查找方式获取 Bean
		User user = context.getBean("user", User.class);
		System.out.println(user);

		// 关闭 Spring 应用上下文
		context.close();
	}
}
```

执行结果

```bash
User{id=1, name='张三-properties'}
```

### 4.2 Spring Boot 例子

修改 spring-context.xml 文件

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
       http://www.springframework.org/schema/beans/spring-beans.xsd">
    <!-- 属性占位符配置-->
    <bean class="org.springframework.beans.factory.config.PropertyPlaceholderConfigurer"><!-- Properties 文件 classpath 路径 -->
        <!--<property name="location" value="classpath:/META-INF/default.properties"/>-->
        <!-- 替换为 Spring Boot 中的 application.properties -->
        <property name="location" value="classpath:application.properties"/>
        <property name="fileEncoding" value="UTF-8"/> <!-- 文件字符编码 -->
    </bean>
</beans>
```

resources 目录下新增 application.properties 文件

```properties
user.id = 1
user.name = 张三-application
```

引导类

```java
@ImportResource("META-INF/spring/user-context.xml")
@EnableAutoConfiguration
public class XmlPlaceHolderExternalizedConfigurationBootstrap {

	public static void main(String[] args) {
		ConfigurableApplicationContext applicationContext = new SpringApplicationBuilder(XmlPlaceHolderExternalizedConfigurationBootstrap.class)
				.web(WebApplicationType.NONE)
				.run(args);

		User user = applicationContext.getBean("user", User.class);
		System.out.println(user);

		// 关闭 Spring 应用上下文
		applicationContext.close();
	}
}

```

执行结果：

```bash
User{id=1, name='zhangquan'}
```

结果并非我们配置的 ` 张三-application`，而是 `zhangquan`，问题出在哪里呢？

改造上面的引导类，

```java
@ImportResource("META-INF/spring/user-context.xml")
@EnableAutoConfiguration
public class XmlPlaceHolderExternalizedConfigurationBootstrap {

    public static void main(String[] args) {
        ConfigurableApplicationContext applicationContext = new SpringApplicationBuilder(XmlPlaceHolderExternalizedConfigurationBootstrap.class)
                .web(WebApplicationType.NONE)
                .run(args);

        User user = applicationContext.getBean("user",User.class);

        System.out.println(user);

        System.out.println("系统变量："+System.getProperty("user.name"));

        applicationContext.close();
    }
}
```

执行结果：

```bash
User{id=1, name='zhangquan'}
系统变量：zhangquan
```

其实打印的 `user.name` 属性是 Java 系统变量，而并不是我们预期的 application. properties 文件中配置的属性。

### 4.3 外部化配置顺序覆盖问题

这里我们可以看 Spring Boot 官方文档

https://docs.spring.io/spring-boot/docs/2.2.2.RELEASE/reference/htmlsingle/#boot-features-external-config

外部化配置有个顺序的覆盖问题，前面的配置属性可以覆盖后面配置属性。

我们的 application.properties 文件排名 13，而 Java System properties 的顺序是 9，所以 Java 系统变量 user.name 覆盖了我们 application.properties 中配置的属性。

为了验证这个顺序的覆盖性，我们再测试一种配置方式  4.Command line arguments.

在启动程序中配置命令行的参数`--user.name=dendi875`

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20231107112922.png)

启动执行结果：

```bash
User{id=1, name='dendi875'}
系统变量：zhangquan
```

可以看到输出的 User 对象 name 属性变成了 `dendi875`，验证了我们的猜想。

## 5.参考

- 慕课网-小马哥《Spring Boot2.0深度实践之核心技术篇》