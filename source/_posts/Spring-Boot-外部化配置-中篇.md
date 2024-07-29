---
title: Spring Boot 外部化配置 - 中篇
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-07-19 19:46:44
password:
summary: Spring Boot 外部化配置 - 中篇
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

## 1. @Value 注入

### 1.1 @Value 字段注入（Field Injection）

改造 User 类

- 新增 age 属性，采用字段注入的方式

- 添加 `@Value("${user.age}")`

  ```java
  public class User {
  
  	private Long id;
  
  	private String name;
  
  	@Value("${user.age}")
  	private Integer age;
  
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
  
  	public Integer getAge() {
  		return age;
  	}
  
  	public void setAge(Integer age) {
  		this.age = age;
  	}
  
  	@Override
  	public String toString() {
  		return "User{" +
  				"id=" + id +
  				", name='" + name + '\'' +
  				", age=" + age +
  				'}';
  	}
  }
  ```

  同时在 application.properties 文件中增加对应的属性配置

  ```properties
  user.id = 1
  user.name = 张三-application
  ```

​		`@Value `注解，在属性没有的时候会报错 `java.lang.IllegalArgumentException: Could not resolve placeholder 'user.age' in value "${user.age}"`，所以我们可以增加一个默认值来避免这种情况

```java
	@Value("${user.age:31}")
	private Integer age;
```

运行 XmlPlaceHolderExternalizedConfigurationBootstrap，输出：

```bash
User{id=1, name='zhangquan', age=31}
系统变量：zhangquan
```

### 1.2 @Value 构造器注入（Constructor Injection）

application.properties

```pr
user.id = 1
user.name = 张三-application
user.age = 32
```

```java
public class ValueAnnotationBootstrap {

	private final Long id;

	private final String name;

	private final Integer age;

	public ValueAnnotationBootstrap(@Value("${user.id}") Long id,
									@Value("${user.name}") String name,
									@Value("${user.age}") Integer age) {
		this.id = id;
		this.name = name;
		this.age = age;
	}

	@Bean
	public User user() {
		User user = new User();
		user.setId(id);
		user.setName(name);
		user.setAge(age);
		return user;
	}

	public static void main(String[] args) {
		// 因为 new SpringApplicationBuilder(ValueAnnotationBootstrap.class)，指定了是引导类，
		// 所以框架帮我们配置了 Configuration Class，不然需要加上 @Configuration 注解
		ConfigurableApplicationContext applicationContext = new SpringApplicationBuilder(ValueAnnotationBootstrap.class)
				.web(WebApplicationType.NONE)
				.run(args);

		User user = applicationContext.getBean("user", User.class);
		System.out.println("用户对象：" + user);

		// 关闭 Spring 上下文
		applicationContext.close();
	}
}
```

执行结果：

```bash
用户对象 @Value 构造器注入：User{id=1, name='zhangquan', age=32}
```

id = 1：是因为 resources/application.properties 文件中 user.id=1

name=zhangquan，是因为外部化配置顺序覆盖问题，系统变量 `user.name` 覆盖了 resources/application.properties 文件中 user.name = 张三-application

### 1.3 @Value 方法注入（Method Injection）

从上面的例子可以看到 **构造器注入** 相对比较复杂，我们可以改造成 **方法注入**

- 只需要将注入的参数放到 `user` 方法中即可

  ```java
  public class ValueAnnotationBootstrap {
  
  	@Bean
  	public User user2(@Value("${user.id}") Long id,
  					  @Value("${user.name}") String name,
  					  @Value("${user.age}") Integer age) {
  		User user = new User();
  		user.setId(id);
  		user.setName(name);
  		user.setAge(age);
  		return user;
  	}
  
  	public static void main(String[] args) {
  		// 因为 new SpringApplicationBuilder(ValueAnnotationBootstrap.class)，指定了是引导类，
  		// 所以框架帮我们配置了 Configuration Class，不然需要加上 @Configuration 注解
  		ConfigurableApplicationContext applicationContext = new SpringApplicationBuilder(ValueAnnotationBootstrap.class)
  				.web(WebApplicationType.NONE)
  				.run(args);
  
  		User user2 = applicationContext.getBean("user2", User.class);
  		System.out.println("用户对象 @Value 方法注入 user2： " + user2);
  
  
  		// 关闭 Spring 上下文
  		applicationContext.close();
  	}
  }
  ```

  执行结果：

  ```bash
  用户对象 @Value 方法注入 user2： User{id=1, name='zhangquan', age=32}
  ```

### 1.4 @Value 默认值嵌套

默认值的设置也支持 `${xxx.xxx}` 的方式

application.properties 文件中

```properties
my.user.age = 33
```

User.java 注解

```java
	//@Value("${user.age}")
	private Integer age;
```

```java
	@Bean
	public User user2(@Value("${user.id}") Long id,
					  @Value("${user.name}") String name,
					  @Value("${user.age:${my.user.age:${your.user.age:88}}}") Integer age) {
		User user = new User();
		user.setId(id);
		user.setName(name);
		user.setAge(age);
		return user;
	}
```

## 2. Environment 抽象

Environment 是什么？

源码位置：org.springframework.core.env.Environment

```java
public interface Environment extends PropertyResolver {
...
```

从源码可以看到它继承了 PropertyResolver，我们继续看 PropertyResolver 中的方法

* getProperty(“user.id”) 类似于 @Value("${user.id}")
* getProperty(“user.id”,“30”) 类似于 @Value("${user.id:30}")
* getProperty(“user.id”, Long.class) 会将返回值转换成 Long 类型
  … 其他的就不做介绍了

```java
	/**
	 * Return the property value associated with the given key,
	 * or {@code null} if the key cannot be resolved.
	 * @param key the property name to resolve
	 * @see #getProperty(String, String)
	 * @see #getProperty(String, Class)
	 * @see #getRequiredProperty(String)
	 */
	@Nullable
	String getProperty(String key);

	/**
	 * Return the property value associated with the given key, or
	 * {@code defaultValue} if the key cannot be resolved.
	 * @param key the property name to resolve
	 * @param defaultValue the default value to return if no value is found
	 * @see #getRequiredProperty(String)
	 * @see #getProperty(String, Class)
	 */
	String getProperty(String key, String defaultValue);

	/**
	 * Return the property value associated with the given key,
	 * or {@code null} if the key cannot be resolved.
	 * @param key the property name to resolve
	 * @param targetType the expected type of the property value
	 * @see #getRequiredProperty(String, Class)
	 */
	@Nullable
	<T> T getProperty(String key, Class<T> targetType);
```

通过上面的接口分析，可以知道如何通过 Environment 获取我们外部化配置的相关属性，下面我们来演示如何获取 Environment 对象。

### 2.1 Environment 方法注入

- 这里的 Environment 对象是通过 @Bean 的方法注入进行获取的

```java
public class ValueAnnotationBootstrap {	
  
	@Bean
	public User user3(Environment environment) {
		Long id = environment.getProperty("user.id", Long.class);
		String name = environment.getProperty("user.name");
		Integer age = environment.getProperty("user.age", Integer.class, 20);

		User user = new User();
		user.setId(id);
		user.setName(name);
		user.setAge(age);
		return user;
	}
```

```java
User user3 = applicationContext.getBean("user3", User.class);
System.out.println("用户对象 Environment 方法注入 user3： " + user3);
```

运行结果：

```bash
用户对象 Environment 方法注入 user3： User{id=1, name='zhangquan', age=32}
```

### 2.2 Environment 构造器注入

```java
public class ValueAnnotationBootstrap {

  private  Environment environment;

	@Autowired
	public ValueAnnotationBootstrap(Environment environment) {
		this.environment = environment;
	}
  
  @Bean
	public User user4() {
		Long id = this.environment.getProperty("user.id", Long.class);
		String name = this.environment.getProperty("user.name");
		Integer age = this.environment.getProperty("user.age", Integer.class, 20);

		User user = new User();
		user.setId(id);
		user.setName(name);
		user.setAge(age);
		return user;
	}
```

```java
User user4 = applicationContext.getBean("user4", User.class);
System.out.println("用户对象 Environment 构造器注入 user4： " + user4);
```

运行结果：

```bash
用户对象 Environment 构造器注入 user4： User{id=1, name='zhangquan', age=32}
```

### 2.3 Environment 字段注入

```java
public class ValueAnnotationBootstrap {
  
  @Autowired
	private Environment environment1;
  
  @Bean
	public User user5() {
		Long id = this.environment1.getProperty("user.id", Long.class);
		String name = this.environment1.getProperty("user.name");
		Integer age = this.environment1.getProperty("user.age", Integer.class, 20);

		User user = new User();
		user.setId(id);
		user.setName(name);
		user.setAge(age);
		return user;
	}
```

```java
User user5 = applicationContext.getBean("user5", User.class);
System.out.println("用户对象 Environment 字段注入 user5： " + user5);
```

运行结果：

```bash
用户对象 Environment 字段注入 user5： User{id=1, name='zhangquan', age=32}
```

### 2.4 通过 Aware 回调接口注入

```java
public class ValueAnnotationBootstrap implements EnvironmentAware {
  
  private Environment environment3;
  
  @Override
	public void setEnvironment(Environment environment) {
			this.environment3 = environment;
	}
  
  @Bean
	public User user6() {
		Long id = this.environment3.getProperty("user.id", Long.class);
		String name = this.environment3.getProperty("user.name");
		Integer age = this.environment3.getProperty("user.age", Integer.class, 20);

		User user = new User();
		user.setId(id);
		user.setName(name);
		user.setAge(age);
		return user;
	}
```

```java
User user6 = applicationContext.getBean("user6", User.class);
System.out.println("用户对象 Environment 通过Aware回调接口注入 user6： " + user6);
```

运行结果：

```java
用户对象 Environment 通过Aware回调接口注入 user6： User{id=1, name='zhangquan', age=32}
```

### 2.5 通过 BeanFactory#getBean 依赖查找的方式

- BeanFactory 对象同样也可通过 Aware 接口回调的方式获取

- 然后通过 `beanFactory.getBean` 依赖查找的方式，根据 Environment.class 类型进行查找获取 Environment 对象实例

  ```java
  Environment environment = beanFactory.getBean(Environment.class);
  ```

### 2.6 Environment 对象何时创建？

Spring Boot 场景中 `org.springframework.boot.SpringApplication#run(java.lang.String…)`

在 SpringApplication.run() 启动过程中，调用了 prepareEnvironment 方法，表示预处理 Environment 对象，在此方法中 getOrCreateEnvironment 方法来创建 Environmen对象；在 Web Servlet 场景中创建的是 StandardServletEnvironment 对象，其它场景创建 StandardEnvironment 对象。

```java
	private ConfigurableEnvironment getOrCreateEnvironment() {
		if (this.environment != null) {
			return this.environment;
		}
		if (this.webApplicationType == WebApplicationType.SERVLET) {
			return new StandardServletEnvironment();
		}
		return new StandardEnvironment();
	}
```

而在传统 Spring Framewrok 场景中，相关的创建代码在

`AbstractApplicationContext#refresh() `启动应用上下文中的 `prepareBeanFactory() `，相关代码如下：

```java
// Register default environment beans.
if (!beanFactory.containsLocalBean(ENVIRONMENT_BEAN_NAME)) {
  	beanFactory.registerSingleton(ENVIRONMENT_BEAN_NAME, getEnvironment());
}
```

## 3. @ConfigurationProperties Bean 绑定

### 3.1 类级别标注

只需要在 User 类上加 @ConfigurationProperties 注解即可

其中 “user” 表示的是 properties 文件中的前缀 `user`.id = 1
```java
@ConfigurationProperties("user")
public class User {
  ...
```

application.properties 文件

```properties
#user.age = 32
```

测试引导类，`@EnableAutoConfiguration` 注解不能少

```java
@EnableAutoConfiguration
public class ConfigurationPropertiesBootstrap {

	@Bean
	public User user() {
		return new User();
	}

	public static void main(String[] args) {
		ConfigurableApplicationContext applicationContext = new SpringApplicationBuilder(ConfigurationPropertiesBootstrap.class)
				.web(WebApplicationType.NONE)
				.run(args);

		User user = applicationContext.getBean("user", User.class);
		System.out.println("用户对象 @ConfigurationProperties 绑定方式 user: " + user);

		// 关闭 Spring 应用上下文
		applicationContext.close();
	}
}
```

执行结果：

```bash
用户对象 @ConfigurationProperties 绑定方式 user: User{id=1, name='zhangquan', age=null}
```

可以看到 user 确实也被赋值了，但是 age = null ，表示值可以为空，也不会报错，这点和 @Value 不一样。

官方还有一种方式，可以在引导类上加上 @EnableConfigurationProperties(User.class)，这样我们就不用自己来注册一个 User Bean 对象，但是只能通过类型的方式获取 Bean 对象。

```java
@EnableAutoConfiguration
@EnableConfigurationProperties(User.class)
public class ConfigurationPropertiesBootstrap {
	//
	//@Bean
	//public User user() {
	//	return new User();
	//}

	public static void main(String[] args) {
		ConfigurableApplicationContext applicationContext = new SpringApplicationBuilder(ConfigurationPropertiesBootstrap.class)
				.web(WebApplicationType.NONE)
				.run(args);

		//User user = applicationContext.getBean("user", User.class);
		//System.out.println("用户对象 @ConfigurationProperties 绑定方式 user: " + user);

		User user = applicationContext.getBean(User.class);
		System.out.println("用户对象 @EnableConfigurationProperties 绑定方式 user: " + user);

		// 关闭 Spring 应用上下文
		applicationContext.close();
	}
}
```

### 3.2 @Bean 方法声明

同样的效果， @ConfigurationProperties 可以标准在对应的方法上

```java
@EnableAutoConfiguration
//@EnableConfigurationProperties(User.class)
public class ConfigurationPropertiesBootstrap {
  
  @Bean
	@ConfigurationProperties("user")
	public User user() {
		return new User();
	}
  ...
```

### 3.3 嵌套类型绑定

Spring Boot 官网原文档地址：https://docs.spring.io/spring-boot/docs/2.2.2.RELEASE/reference/htmlsingle/#boot-features-external-config-typesafe-configuration-properties

改造 User 类型，增加 City 的属性，同样增加 setter/getter 方法

```java
@ConfigurationProperties("user")
public class User {

	private Long id;

	private String name;

	//@Value("${user.age}")
	private Integer age;

	private City city;

	private static class City {
		private String postCode;
		private String name;

		public String getPostCode() {
			return postCode;
		}

		public void setPostCode(String postCode) {
			this.postCode = postCode;
		}

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

		@Override
		public String toString() {
			return "City{" +
					"postCode='" + postCode + '\'' +
					", name='" + name + '\'' +
					'}';
		}
	}

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

	public Integer getAge() {
		return age;
	}

	public void setAge(Integer age) {
		this.age = age;
	}

	public City getCity() {
		return city;
	}

	public void setCity(City city) {
		this.city = city;
	}

	@Override
	public String toString() {
		return "User{" +
				"id=" + id +
				", name='" + name + '\'' +
				", age=" + age +
				", city=" + city +
				'}';
	}
}
```

application.properties

```properties
user.id = 1
user.name = 张三-application
#user.age = 32
#my.user.age = 33
# 增加 user.city 外部化配置
user.city.postCode = 4000
user.city.name = shanghai
```

```bash
用户对象 user: User{id=1, name='zhangquan', age=null, city=City{postCode='4000', name='shanghai'}}
```

### 3.4 松散绑定（Relaxed Binding）

Spring Boot 官网原文档地址：https://docs.spring.io/spring-boot/docs/2.2.2.RELEASE/reference/htmlsingle/#boot-features-external-config-relaxed-binding

比如我们将 application.properties 中的 postCode 属性修改为其他几种方式效果都一样

```properties
user.city.postCode = 4000
user.city.post-code = 4000
user.city.post_code = 4000
#USER_CITY_POST_CODE = 4000
```

USER_CITY_POST_CODE = 4004 这种方式必须是 `system environment variables` 系统环境变量，

所以我们需要修改 Idea Run 引导类启动配置，才能看到效果，增加一个`system environment variables`

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20231107185312.png)

执行结果：

```bash
用户对象 user: User{id=1, name='zhangquan', age=null, city=City{postCode='4000', name='shanghai'}}
```

### 3.5 效验

Spring Boot 官网原文档地址：https://docs.spring.io/spring-boot/docs/2.2.2.RELEASE/reference/htmlsingle/#boot-features-external-config-validation

具体的使用方式可以参考 Spring Bean Validation 的使用

这里只做简单的演示

这里需要引入 `javax.validation` 的相关实现依赖

pom.xml 中加入

```xml
<dependency>
   <groupId>org.springframework.boot</groupId>
   <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

修改 User 类

- 类上标注 @Validated
- 对应需要效验的字段上标注 @NotNull（当然这里有很多注解，详情可以看 JSR-303 规范）或者定位到 `javax.validation.constraints` 包下查看相应的源代码文件

```java
@Validated
@ConfigurationProperties("user")
public class User {

	//@Value("${user.age}")
	@NotNull
	private Integer age;
```

注释掉 properties 中相应的属性

```properties
#user.age = 32
```

执行结果:

```bash
***************************
APPLICATION FAILED TO START
***************************

Description:

Binding to target org.springframework.boot.context.properties.bind.BindException: Failed to bind properties under 'user' to com.zq.externalized.configuration.domain.User failed:

    Property: user.age
    Value: null
    Reason: 不能为null
```

## 4.@ConditionalOnProperty

这个条件注解表示如果当前环境中存在此 Property 属性，加载当前 Bean，如果不存在则不会加载。

```java
@EnableAutoConfiguration
public class ConditionalOnPropertyBootstrap {

	@Bean
	@ConfigurationProperties("user")
	@ConditionalOnProperty("user.city.post_code")
	public User user() {
		return new User();
	}

	public static void main(String[] args) {
		ConfigurableApplicationContext applicationContext = new SpringApplicationBuilder(ConditionalOnPropertyBootstrap.class)
				.web(WebApplicationType.NONE)
				.run(args);

		//User user = applicationContext.getBean("user", User.class);
		//System.out.println("用户对象 @ConfigurationProperties 绑定方式 user: " + user);

		User user = applicationContext.getBean(User.class);
		System.out.println("用户对象 user: " + user);

		// 关闭 Spring 应用上下文
		applicationContext.close();
	}
}
```

如果注释掉 application.properties 中的 `user.city.post_code`属性。

执行结果：

```bash
Exception in thread "main" org.springframework.beans.factory.NoSuchBeanDefinitionException: No qualifying bean of type 'com.zq.externalized.configuration.domain.User' available
```

如果配置这个属性那么正常执行：

```bash
用户对象 user: User{id=1, name='zhangquan', age=32, city=City{postCode='4000', name='shanghai'}}
```

这个注解还有两个方法可以配置

```java
	/**
	 * The string representation of the expected value for the properties. If not
	 * specified, the property must <strong>not</strong> be equals to {@code false}.
	 * @return the expected value
	 */
	String havingValue() default "";

	/**
	 * Specify if the condition should match if the property is not set. Defaults to
	 * {@code false}.
	 * @return if should match if the property is missing
	 */
	boolean matchIfMissing() default false;
```

- havingValue 表示如果当前的属性值等于我们配置的这个值，才会生效

- matchIfMissing 如果属性不存在，是否生效

  ```java
  	@Bean
  	@ConfigurationProperties("user")
  	@ConditionalOnProperty(value = "user.city.post_code", matchIfMissing = true, havingValue = "4000")
  	public User user() {
  		return new User();
  	}
  ```

## 5.参考

- 慕课网-小马哥《Spring Boot2.0深度实践之核心技术篇》