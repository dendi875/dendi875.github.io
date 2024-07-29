---
title: Spring Boot 外部化配置 - 下篇
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-07-19 19:46:54
password:
summary: Spring Boot 外部化配置 - 下篇
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

## 1.扩展外部化配置

* 基于 SpringApplicationRunListener#environmentPrepared 扩展
* 基于 ApplicationEnvironmentPreparedEvent 扩展
* 基于 EnvironmentPostProcessor 扩展

* 基于 ApplicationContextInitializer 扩展
* 基于 SpringApplicationRunListener#contextPrepared 扩展
* 基于 SpringApplicationRunListener#contextLoaded扩展
* 基于 ApplicationPreparedEvent 扩展

## 2.如何扩展，在哪里扩展？

### 2.1 理解 Spring Boot  Environment 生命周期

>   了解生命周期，可以知道 Environment 什么时候被创建，什么时候被使用，在创建和使用之间，正是我们扩展区间。

一切从 `SpringApplication#run()` 方法开始

Environment 对象准备阶段 `SpringApplication#prepareEnvironment`

```java
	private ConfigurableEnvironment prepareEnvironment(
			SpringApplicationRunListeners listeners,
			ApplicationArguments applicationArguments) {
		// Create and configure the environment
		ConfigurableEnvironment environment = getOrCreateEnvironment();
		configureEnvironment(environment, applicationArguments.getSourceArgs());
		listeners.environmentPrepared(environment);
		bindToSpringApplication(environment);
		if (this.webApplicationType == WebApplicationType.NONE) {
			environment = new EnvironmentConverter(getClassLoader())
					.convertToStandardEnvironmentIfNecessary(environment);
		}
		ConfigurationPropertySources.attach(environment);
		return environment;
}
```

getOrCreateEnvironment 来创建 Environment 对象。

**题外话 web 场景中创建的 StandardServletEnvironment 对象**

`org.springframework.web.context.support.StandardServletEnvironment` 对应外部化配置覆盖顺序的 6 和 7 。



Environment 对象创建完成之后，后面有个 environmentPrepared 方法如下：

```java
public void environmentPrepared(ConfigurableEnvironment environment) {
    for (SpringApplicationRunListener listener : this.listeners) {
      	listener.environmentPrepared(environment);
    }
}
```

循环遍历获取 SpringApplicationRunListener 的实现，并通过 environmentPrepared 发送一个ApplicationEnvironmentPreparedEvent 事件

```java
	@Override
	public void environmentPrepared(ConfigurableEnvironment environment) {
		this.initialMulticaster.multicastEvent(new ApplicationEnvironmentPreparedEvent(
				this.application, this.args, environment));
	}
```

当 Environment 对象在 Spring Boot 中创建好之后，在 `prepareContext` 中通过 `context.setEnvironment(environment); `设置当前上下文的 Environment，然后继续执行 `refreshContext(context);` ，此方法调用 Spring Freamwork 中 `AbstractApplicationContext.refresh()` 方法启动应用上下文。



最终在 AbstractApplicationContext#prepareBeanFactory 方法中，getEnvironment() 获取到 Environment 对象，并注册到容器中
```java
// Register default environment beans.
if (!beanFactory.containsLocalBean(ENVIRONMENT_BEAN_NAME)) {
		beanFactory.registerSingleton(ENVIRONMENT_BEAN_NAME, getEnvironment());
}
```

在 refresh() 方法的后续方法中，都有可能调用 Environment 对象，所以如果要进行扩展必须是在 AbstractApplicationContext#prepareBeanFactory 方法之前。



**结论：**

Spring Framework 中尽量在 org.springframework.context.support.AbstractApplicationContext#prepareBeanFactory 方法之前初始化。

Spring Boot 中尽量在 org.springframework.boot.SpringApplication#refreshContext 方法之前初始化。

### 2.2 理解 `PropertySource` 顺序

[Spring Boot 官网  Externalized Configuration](https://docs.spring.io/spring-boot/docs/2.2.2.RELEASE/reference/htmlsingle/#boot-features-external-config)

这里提出了 17 种配置源方式，前面优先级会高于后面，即相同属性覆盖后面的值

我们先测试顺序  2.`@TestPropertySource`

在 test 目录下新建一个测试用例

```java
@RunWith(SpringRunner.class)
@TestPropertySource(properties = "user.id = 9")
public class PropertySourceOrderTest {

    @Value("${user.id}")
    private Long userId;

    @Test
    public void testUserId() {
      	Assert.assertEquals(userId, new Long(10));
      	System.err.println("user.id: " + userId);
    }
}
```

执行结果：

```bash
java.lang.AssertionError: 
Expected :9
Actual   :10
```

我们取到的结果是 9 ，因为 @TestPropertySource 的优先级高于默认的 application.properties 。

我们再加入排名第 3 的 @SpringBootTest

```java
@RunWith(SpringRunner.class)
@TestPropertySource(properties = "user.id = 9")
@SpringBootTest(
		properties = "user.id = 10",
		classes = {PropertySourceOrderTest.class},
		webEnvironment = SpringBootTest.WebEnvironment.NONE
)
public class PropertySourceOrderTest {

    @Value("${user.id}")
    private Long userId;

    @Test
    public void testUserId() {
      	Assert.assertEquals(userId, new Long(10));
      	System.err.println("user.id: " + userId);
    }
}
```

执行结果：

```bash
java.lang.AssertionError: 
Expected :9
Actual   :10
```

可以看到结果还是 9，表示 @SpringBootTest 中的属性并没有覆盖掉 @TestPropertySource 中的属性，符合预期。

接着我们注释掉 @TestPropertySource#properties 属性，同时增加一个 locations 属性，@TestPropertySource#locations 支持读取文件，我们将路径配置为 `classpath:META-INF/default.properties`

```java
@RunWith(SpringRunner.class)
@TestPropertySource(
		//properties = "user.id = 9",
		locations = "classpath:META-INF/default.properties"
)
@SpringBootTest(
		properties = "user.id = 10",
		classes = {PropertySourceOrderTest.class},
		webEnvironment = SpringBootTest.WebEnvironment.NONE
)
public class PropertySourceOrderTest {

    @Value("${user.id}")
    private Long userId;

    @Test
    public void testUserId() {
      	Assert.assertEquals(userId, new Long(10));
      	System.err.println("user.id: " + userId);
    }
}
```

default.properties 文件如下

```properties
user.id = 1
user.name = 张三-properties
```

执行结果：

```bash
user.id: 10
```

1 并没有覆盖掉 10，所以由结果可知，@SpringBootTest#properties 的优先级大于 @TestPropertySource#locations

通过上面的例子，我们可以知道三者的顺序如下

1.   @TestPropertySource#properties

2.   @SpringBootTest#properties

3.   @TestPropertySource#locations

官网中漏掉了 @TestPropertySource#locations 这种情况，所以准确来说应该是 18 种；通过上面的例子我们大致知道了，外部化配置的属性源是按照这 18 种顺序来进行覆盖的。

### 2.3 什么是 `Environment` 抽象？

`Environment` 与 `PropertySources` 是一对一的关系， `PropertySources` 与 `PropertySource` 是一对多的关系。

通过 `ConfigurableEnvironment#getPropertySources` 可以获取到 PropertySources 集合对象，然后遍历集合，可以获取到这个 Environment 中所有的 PropertySource 对象。

我们修改之前的测试类，通过 @Autowired 的方式注入 ConfigurableEnvironment 对象，再通过迭代的方式看看里面到底关联了哪些 PropertySources 属性源对象。



我们修改之前的测试类，通过 @Autowired 的方式注入 ConfigurableEnvironment 对象，再通过迭代的方式看看里面到底关联了哪些 PropertySources 属性源对象。

```java
@RunWith(SpringRunner.class)
@TestPropertySource(
		//properties = "user.id = 9",
		locations = "classpath:META-INF/default.properties"
)
@SpringBootTest(
		properties = "user.id = 10",
		classes = {PropertySourceOrderTest.class},
		webEnvironment = SpringBootTest.WebEnvironment.NONE
)
public class PropertySourceOrderTest {

    @Value("${user.id}")
    private Long userId;

    @Autowired
    private ConfigurableEnvironment environment;

    @Test
    public void testUserId() {
      	Assert.assertEquals(userId, new Long(10));
      	System.err.println("user.id: " + userId);
    }

    @Test
    public void testPropertySources() {
        MutablePropertySources propertySources = this.environment.getPropertySources();
        int i = 0;
        for (org.springframework.core.env.PropertySource<?> propertySource : propertySources) {
          	i++;
          	System.out.printf("顺序[%d]-名称[%s]:[%s]\n", i, propertySource.getName(), propertySource.toString());
        }
    }
}
```

执行结果：

```bash
顺序[1]-名称[configurationProperties]:[ConfigurationPropertySourcesPropertySource {name='configurationProperties'}]
顺序[2]-名称[Inlined Test Properties]:[MapPropertySource {name='Inlined Test Properties'}]
顺序[3]-名称[class path resource [META-INF/default.properties]]:[ResourcePropertySource {name='class path resource [META-INF/default.properties]'}]
顺序[4]-名称[systemProperties]:[MapPropertySource {name='systemProperties'}]
顺序[5]-名称[systemEnvironment]:[OriginAwareSystemEnvironmentPropertySource {name='systemEnvironment'}]
顺序[6]-名称[random]:[RandomValuePropertySource {name='random'}]
顺序[7]-名称[applicationConfig: [classpath:/application.properties]]:[OriginTrackedMapPropertySource {name='applicationConfig: [classpath:/application.properties]'}]
```

顺序[3]-名称[class path resource [META-INF/default.properties]] 就是我们配置的

```java
@TestPropertySource(locations = "classpath:META-INF/default.properties")
```

顺序[7]-名称[applicationConfig: [classpath:/application.properties]] 是 Spring Boot 默认读取的配置文件。

我们继续测试 `16.@PropertySource` 顺序

在 test 目录下新建 resouces/META-INF/test.properties

```properties
user.id = 11
user.name = 张三-test
```

修改示例 增加 @PropertySource 相关的配置源

```java
@RunWith(SpringRunner.class)
@TestPropertySource(
		//properties = "user.id = 9",
		locations = "classpath:META-INF/default.properties"
)
@SpringBootTest(
		properties = "user.id = 10",
		classes = {PropertySourceOrderTest.class, PropertySourceOrderTest.MyConfig.class},
		webEnvironment = SpringBootTest.WebEnvironment.NONE
)
public class PropertySourceOrderTest {

    @Value("${user.id}")
    private Long userId;

    @Autowired
    private ConfigurableEnvironment environment;

    @Autowired
    private ConfigurableApplicationContext applicationContext;

    @Configuration
    @PropertySource(name = "test-propertySource", value = "classpath:/META-INF/test.properties")
    public static class MyConfig {

    }

    @Test
    public void testUserId() {
      	Assert.assertEquals(userId, new Long(10));
      	System.err.println("user.id: " + userId);
    }

    @Test
    public void testPropertySources() {
      MutablePropertySources propertySources = this.environment.getPropertySources();
      int i = 0;
      for (org.springframework.core.env.PropertySource<?> propertySource : propertySources) {
        i++;
        System.out.printf("顺序[%d]-名称[%s]:[%s]\n", i, propertySource.getName(), propertySource.toString());
      }
    }

    @Test
    public void testMyConfigBean() {
      MyConfig bean = applicationContext.getBean(MyConfig.class);
      System.out.println(bean);
    }
}
```

执行测试用例 testPropertySources

```bash
顺序[1]-名称[configurationProperties]:[ConfigurationPropertySourcesPropertySource {name='configurationProperties'}]
顺序[2]-名称[Inlined Test Properties]:[MapPropertySource {name='Inlined Test Properties'}]
顺序[3]-名称[class path resource [META-INF/default.properties]]:[ResourcePropertySource {name='class path resource [META-INF/default.properties]'}]
顺序[4]-名称[systemProperties]:[MapPropertySource {name='systemProperties'}]
顺序[5]-名称[systemEnvironment]:[OriginAwareSystemEnvironmentPropertySource {name='systemEnvironment'}]
顺序[6]-名称[random]:[RandomValuePropertySource {name='random'}]
顺序[7]-名称[applicationConfig: [classpath:/application.properties]]:[OriginTrackedMapPropertySource {name='applicationConfig: [classpath:/application.properties]'}]
顺序[8]-名称[test-propertySource]:[ResourcePropertySource {name='test-propertySource'}]
```

**结论：**

并不是每次都会加载所有的 18 种配置源信息，根据对应的场景进行加载。

### 2.4 如何理解 `PropertySource`？

带有名称的属性源，`properties`、`map`、`yaml`文件。

## 3.扩展

### 3.1 基于 SpringApplicationRunListener#environmentPrepared 扩展

需要使用 Spring 的 SPI 机制进行实现

实现 SpringApplicationRunListener，Ordered 接口

这里 Ordered 我们可以去默认实现中的 Order - 1，表示优先级比原来的实现高 1 位

```java
public class ExtendPropertySourceRunListener implements SpringApplicationRunListener, Ordered {

	private final SpringApplication application;

	private final String[] args;

	public ExtendPropertySourceRunListener(SpringApplication application, String[] args) {
		this.application = application;
		this.args = args;
	}

	@Override
	public void starting() {

	}

	@Override
	public void environmentPrepared(ConfigurableEnvironment environment) {
		MutablePropertySources propertySources = environment.getPropertySources();

		Map<String, Object> map = new HashMap<>();
		map.put("user.id", 5);
		MapPropertySource propertySource = new MapPropertySource("from-environmentPrepared", map);

		propertySources.addFirst(propertySource);
	}

	@Override
	public void contextPrepared(ConfigurableApplicationContext context) {

	}

	@Override
	public void contextLoaded(ConfigurableApplicationContext context) {

	}

	@Override
	public void started(ConfigurableApplicationContext context) {

	}

	@Override
	public void running(ConfigurableApplicationContext context) {

	}

	@Override
	public void failed(ConfigurableApplicationContext context, Throwable exception) {

	}

	@Override
	public int getOrder() {
		return new EventPublishingRunListener(application, args).getOrder() - 1;
	}
}
```

resources/META-INF 目录下新建 spring.factories 文件

```properties
# Run Listeners
org.springframework.boot.SpringApplicationRunListener=\
com.zq.externalized.configuration.run.ExtendPropertySourceRunListener
```

新建引导类，这里我们加上其他三种属性源用来进行顺序覆盖的演示

*   16.@PropertySource

-   17.Default properties
-   4.Command line arguments

```java
@EnableAutoConfiguration
@PropertySource(name="from classpath:META-INF/default.properties",value="classpath:META-INF/default.properties")//16.@PropertySource
public class ExtendPropertySourceBootstrap {

	public static void main(String[] args) {

		ConfigurableApplicationContext applicationContext = new SpringApplicationBuilder(ExtendPropertySourceBootstrap.class)
				.web(WebApplicationType.NONE)
				.profiles("user.id=99")	// 17. Default properties
				.run(of("--user.id=100"));	// 4. Command line arguments.

		ConfigurableEnvironment environment = applicationContext.getEnvironment();
		System.out.println("用户id: " + environment.getProperty("user.id", Long.class));

		MutablePropertySources propertySources = environment.getPropertySources();
		int i = 0;
		for (org.springframework.core.env.PropertySource<?> propertySource : propertySources) {
			i++;
			System.out.printf("顺序[%d]-名称[%s]:[%s]\n", i, propertySource.getName(), propertySource.toString());
		}

		// 关闭 Spring 应用上下文
		applicationContext.close();
	}

	private static <T> T[] of(T... args) {
		return args;
	}
}
```

执行结果：

```bash
用户id: 5
顺序[1]-名称[configurationProperties]:[ConfigurationPropertySourcesPropertySource {name='configurationProperties'}]
顺序[2]-名称[from-environmentPrepared]:[MapPropertySource {name='from-environmentPrepared'}]
顺序[3]-名称[commandLineArgs]:[SimpleCommandLinePropertySource {name='commandLineArgs'}]
顺序[4]-名称[systemProperties]:[MapPropertySource {name='systemProperties'}]
顺序[5]-名称[systemEnvironment]:[OriginAwareSystemEnvironmentPropertySource {name='systemEnvironment'}]
顺序[6]-名称[random]:[RandomValuePropertySource {name='random'}]
顺序[7]-名称[applicationConfig: [classpath:/application.properties]]:[OriginTrackedMapPropertySource {name='applicationConfig: [classpath:/application.properties]'}]
顺序[8]-名称[from classpath:META-INF/default.properties]:[ResourcePropertySource {name='from classpath:META-INF/default.properties'}]
```

顺序[2]-名称[from-environmentPrepared] 是我们 `SpringApplicationRunListener#environmentPrepared` 扩展的属性源。

### 3.2 基于 ApplicationEnvironmentPreparedEvent 扩展

因为 SpringApplicationRunListener 通过 environmentPrepared 发送一个 ApplicationEnvironmentPreparedEvent 事件，所以我们新建 ExtendPropertySourceApplicationListener 来监听 ApplicationEnvironmentPreparedEvent 事件。

```java
public class ExtendPropertySourceApplicationListener implements SmartApplicationListener {

	@Override
	public boolean supportsEventType(Class<? extends ApplicationEvent> eventType) {
		return ApplicationEnvironmentPreparedEvent.class.isAssignableFrom(eventType) ||
				ApplicationPreparedEvent.class.isAssignableFrom(eventType);
	}

	@Override
	public boolean supportsSourceType(Class<?> sourceType) {
		return true;
	}

	@Override
	public void onApplicationEvent(ApplicationEvent event) {
		if (event instanceof ApplicationEnvironmentPreparedEvent) {
			ApplicationEnvironmentPreparedEvent preparedEvent = (ApplicationEnvironmentPreparedEvent) event;
			ConfigurableEnvironment environment = preparedEvent.getEnvironment();
			MutablePropertySources propertySources = environment.getPropertySources();

			Map<String, Object> map = new HashMap<>();
			map.put("user.id", 6);
			MapPropertySource propertySource = new MapPropertySource("from-ApplicationEnvironmentPreparedEvent", map);

			propertySources.addFirst(propertySource);
		}
		if (event instanceof ApplicationPreparedEvent) {

		}
	}

	@Override
	public int getOrder() {
		return 0;
	}
}
```

resources/META-INF/spring.factories 文件新增对应的配置

```properties
# Application Listeners
org.springframework.context.ApplicationListener=\
com.zq.externalized.configuration.listener.ExtendPropertySourceApplicationListener
```

执行结果：

```bash
用户id: 6
顺序[1]-名称[configurationProperties]:[ConfigurationPropertySourcesPropertySource {name='configurationProperties'}]
顺序[2]-名称[from-ApplicationEnvironmentPreparedEvent]:[MapPropertySource {name='from-ApplicationEnvironmentPreparedEvent'}]
顺序[3]-名称[from-environmentPrepared]:[MapPropertySource {name='from-environmentPrepared'}]
顺序[4]-名称[commandLineArgs]:[SimpleCommandLinePropertySource {name='commandLineArgs'}]
顺序[5]-名称[systemProperties]:[MapPropertySource {name='systemProperties'}]
顺序[6]-名称[systemEnvironment]:[OriginAwareSystemEnvironmentPropertySource {name='systemEnvironment'}]
顺序[7]-名称[random]:[RandomValuePropertySource {name='random'}]
顺序[8]-名称[applicationConfig: [classpath:/application.properties]]:[OriginTrackedMapPropertySource {name='applicationConfig: [classpath:/application.properties]'}]
顺序[9]-名称[from classpath:META-INF/default.properties]:[ResourcePropertySource {name='from classpath:META-INF/default.properties'}]
```

顺序[2]-名称[from-ApplicationEnvironmentPreparedEvent] 是我们新增的监听，由于顺序高于之前 SpringApplicationRunListener#environmentPrepared 的配置，所以覆盖了 user.id 属性。

### 3.3 基于 EnvironmentPostProcessor 扩展

在 ApplicationListener 的内建实现 ConfigFileApplicationListener 中， 当 ConfigFileApplicationListener 监听到 ApplicationEnvironmentPreparedEvent 事件时触发调用。

ConfigFileApplicationListener#onApplicationEnvironmentPreparedEvent，遍历所有的 EnvironmentPostProcessor 并执行 postProcessEnvironment 方法

*   postProcessors.add(this); 表示 ConfigFileApplicationListener 本身也是一个 EnvironmentPostProcessor 的实现

    ```java
    	private void onApplicationEnvironmentPreparedEvent(
    			ApplicationEnvironmentPreparedEvent event) {
    		List<EnvironmentPostProcessor> postProcessors = loadPostProcessors();
    		postProcessors.add(this);
    		AnnotationAwareOrderComparator.sort(postProcessors);
    		for (EnvironmentPostProcessor postProcessor : postProcessors) {
    			postProcessor.postProcessEnvironment(event.getEnvironment(),
    					event.getSpringApplication());
    		}
    	}
    ```

自定义 ExtendPropertySourcesEnvironmentPostProcessor 实现 EnvironmentPostProcessor，Ordered 接口

 ```java
 public class ExtendPropertySourceEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {
 
 	@Override
 	public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
 		MutablePropertySources propertySources = environment.getPropertySources();
 		Map<String, Object> map = new HashMap<>();
 		map.put("user.id", 16);
 		MapPropertySource propertySource = new MapPropertySource("from-EnvironmentPostProcessor", map);
 		propertySources.addFirst(propertySource);
 	}
 
 	@Override
 	public int getOrder() {
 		return ConfigFileApplicationListener.DEFAULT_ORDER - 1;
 	}
 }
 ```

resources/META-INF/spring.factories 文件新增对应的配置

```properties
# Environment Post Processors
org.springframework.boot.env.EnvironmentPostProcessor=\
com.zq.externalized.configuration.processor.ExtendPropertySourceEnvironmentPostProcessor
```

执行结果:

```bash
用户id: 6
顺序[1]-名称[configurationProperties]:[ConfigurationPropertySourcesPropertySource {name='configurationProperties'}]
顺序[2]-名称[from-ApplicationEnvironmentPreparedEvent]:[MapPropertySource {name='from-ApplicationEnvironmentPreparedEvent'}]
顺序[3]-名称[from-EnvironmentPostProcessor]:[MapPropertySource {name='from-EnvironmentPostProcessor'}]
顺序[4]-名称[from-environmentPrepared]:[MapPropertySource {name='from-environmentPrepared'}]
顺序[5]-名称[commandLineArgs]:[SimpleCommandLinePropertySource {name='commandLineArgs'}]
顺序[6]-名称[systemProperties]:[MapPropertySource {name='systemProperties'}]
顺序[7]-名称[systemEnvironment]:[OriginAwareSystemEnvironmentPropertySource {name='systemEnvironment'}]
顺序[8]-名称[random]:[RandomValuePropertySource {name='random'}]
顺序[9]-名称[applicationConfig: [classpath:/application.properties]]:[OriginTrackedMapPropertySource {name='applicationConfig: [classpath:/application.properties]'}]
```

可以看到顺序[3]-名称[from-EnvironmentPostProcessor] 在 顺序[2]-名称[from-ApplicationEnvironmentPreparedEvent] 后面，结果符合预期；因为 EnvironmentPostProcessor 在 ApplicationEnvironmentPreparedEvent 事件监听到之后才会执行。

### 3.4 基于 ApplicationContextInitializer 扩展

在 SpringApplication#run 启动方法中

org.springframework.boot.SpringApplication#run(java.lang.String…)

*   org.springframework.boot.SpringApplication#prepareContext

    *   org.springframework.boot.SpringApplication#applyInitializers

        ```java
        	protected void applyInitializers(ConfigurableApplicationContext context) {
        		for (ApplicationContextInitializer initializer : getInitializers()) {
        			Class<?> requiredType = GenericTypeResolver.resolveTypeArgument(
        					initializer.getClass(), ApplicationContextInitializer.class);
        			Assert.isInstanceOf(requiredType, context, "Unable to call initializer.");
        			initializer.initialize(context);
        		}
        	}
        ```

此方法在 `refreshContext(context);` 之前进行调用，也就是 Spring Fremawrok 应用上下文启动之前，在此时也可以对 Environment 进行操作。

同样我们实现 ApplicationContextInitializer

````java
public class ExtendPropertySourceApplicationContextInitializer implements ApplicationContextInitializer {

	@Override
	public void initialize(ConfigurableApplicationContext applicationContext) {
		ConfigurableEnvironment environment = applicationContext.getEnvironment();

		MutablePropertySources propertySources = environment.getPropertySources();

		Map<String, Object> map = new HashMap<>();
		map.put("user.id", 25);

		MapPropertySource propertySource = new MapPropertySource("from-ApplicationContextInitializer", map);
		propertySources.addFirst(propertySource);
	}
}
````

resources/META-INF/spring.factories 文件新增对应的配置

```properties
# Application Context Initializers
org.springframework.context.ApplicationContextInitializer=\
com.zq.externalized.configuration.initializer.ExtendPropertySourceApplicationContextInitializer
```

执行结果：

```bash
用户id: 25
顺序[1]-名称[from-ApplicationContextInitializer]:[MapPropertySource {name='from-ApplicationContextInitializer'}]
顺序[2]-名称[configurationProperties]:[ConfigurationPropertySourcesPropertySource {name='configurationProperties'}]
顺序[3]-名称[from-ApplicationEnvironmentPreparedEvent]:[MapPropertySource {name='from-ApplicationEnvironmentPreparedEvent'}]
顺序[4]-名称[from-EnvironmentPostProcessor]:[MapPropertySource {name='from-EnvironmentPostProcessor'}]
顺序[5]-名称[from-environmentPrepared]:[MapPropertySource {name='from-environmentPrepared'}]
顺序[6]-名称[commandLineArgs]:[SimpleCommandLinePropertySource {name='commandLineArgs'}]
顺序[7]-名称[systemProperties]:[MapPropertySource {name='systemProperties'}]
顺序[8]-名称[systemEnvironment]:[OriginAwareSystemEnvironmentPropertySource {name='systemEnvironment'}]
顺序[9]-名称[random]:[RandomValuePropertySource {name='random'}]
顺序[10]-名称[applicationConfig: [classpath:/application.properties]]:[OriginTrackedMapPropertySource {name='applicationConfig: [classpath:/application.properties]'}]
顺序[11]-名称[from classpath:META-INF/default.properties]:[ResourcePropertySource {name='from classpath:META-INF/default.properties'}]
```

顺序[1]-名称[from-ApplicationContextInitializer] 就是我们新加入的 ExtendPropertySourcesInitializer

### 3.5 基于 SpringApplicationRunListener#contextPrepared &contextLoaded 扩展

这两个方法都在 SpringApplicationRunListener 中，所以我们可以写在一起

修改 3.1 中的例子 ExtendPropertySourceRunListener 的这两个方法即可

```java
public class ExtendPropertySourceRunListener implements SpringApplicationRunListener, Ordered {

	private final SpringApplication application;

	private final String[] args;

	public ExtendPropertySourceRunListener(SpringApplication application, String[] args) {
		this.application = application;
		this.args = args;
	}

	@Override
	public void starting() {

	}

	@Override
	public void environmentPrepared(ConfigurableEnvironment environment) {
		MutablePropertySources propertySources = environment.getPropertySources();

		Map<String, Object> map = new HashMap<>();
		map.put("user.id", 5);
		MapPropertySource propertySource = new MapPropertySource("from-SpringApplicationRunListener#environmentPrepared", map);

		propertySources.addFirst(propertySource);
	}

	@Override
	public void contextPrepared(ConfigurableApplicationContext context) {
		ConfigurableEnvironment environment = context.getEnvironment();
		MutablePropertySources propertySources = environment.getPropertySources();
		Map<String, Object> map = new HashMap<>();
		map.put("user.id", 35);
		MapPropertySource propertySource = new MapPropertySource("from-SpringApplicationRunListener#contextPrepared", map);
		propertySources.addFirst(propertySource);
	}

	@Override
	public void contextLoaded(ConfigurableApplicationContext context) {
		ConfigurableEnvironment environment = context.getEnvironment();
		MutablePropertySources propertySources = environment.getPropertySources();

		Map<String, Object> map = new HashMap<>();
		map.put("user.id", 45);
		MapPropertySource propertySource = new MapPropertySource("from-SpringApplicaitonRunListener#contextLoaded", map);
		propertySources.addFirst(propertySource);
	}

	@Override
	public void started(ConfigurableApplicationContext context) {

	}

	@Override
	public void running(ConfigurableApplicationContext context) {

	}

	@Override
	public void failed(ConfigurableApplicationContext context, Throwable exception) {

	}

	@Override
	public int getOrder() {
		return new EventPublishingRunListener(application, args).getOrder() - 1;
	}
}

```

执行结果：

```bash
用户id: 45
顺序[1]-名称[from-SpringApplicaitonRunListener#contextLoaded]:[MapPropertySource {name='from-SpringApplicaitonRunListener#contextLoaded'}]
顺序[2]-名称[from-SpringApplicationRunListener#contextPrepared]:[MapPropertySource {name='from-SpringApplicationRunListener#contextPrepared'}]
顺序[3]-名称[from-ApplicationContextInitializer]:[MapPropertySource {name='from-ApplicationContextInitializer'}]
顺序[4]-名称[configurationProperties]:[ConfigurationPropertySourcesPropertySource {name='configurationProperties'}]
顺序[5]-名称[from-ApplicationEnvironmentPreparedEvent]:[MapPropertySource {name='from-ApplicationEnvironmentPreparedEvent'}]
顺序[6]-名称[from-EnvironmentPostProcessor]:[MapPropertySource {name='from-EnvironmentPostProcessor'}]
顺序[7]-名称[from-SpringApplicationRunListener#environmentPrepared]:[MapPropertySource {name='from-SpringApplicationRunListener#environmentPrepared'}]
顺序[8]-名称[commandLineArgs]:[SimpleCommandLinePropertySource {name='commandLineArgs'}]
顺序[9]-名称[systemProperties]:[MapPropertySource {name='systemProperties'}]
顺序[10]-名称[systemEnvironment]:[OriginAwareSystemEnvironmentPropertySource {name='systemEnvironment'}]
顺序[11]-名称[random]:[RandomValuePropertySource {name='random'}]
顺序[12]-名称[applicationConfig: [classpath:/application.properties]]:[OriginTrackedMapPropertySource {name='applicationConfig: [classpath:/application.properties]'}]
顺序[13]-名称[from classpath:META-INF/default.properties]:[ResourcePropertySource {name='from classpath:META-INF/default.properties'}]
```

顺序[1] 和 顺序[2] 就是我们加入的两个方法实现。

### 3.6 基于 ApplicationPreparedEvent 扩展

org.springframework.boot.SpringApplication#run(java.lang.String…)

*   org.springframework.boot.SpringApplication#prepareContext

    *   org.springframework.boot.context.event.EventPublishingRunListener#contextLoaded

        ```java
        	@Override
        	public void contextLoaded(ConfigurableApplicationContext context) {
              for (ApplicationListener<?> listener : this.application.getListeners()) {
                if (listener instanceof ApplicationContextAware) {
                  ((ApplicationContextAware) listener).setApplicationContext(context);
                }
                context.addApplicationListener(listener);
              }
              this.initialMulticaster.multicastEvent(
                  new ApplicationPreparedEvent(this.application, this.args, context));
        	}
        ```

        在 EventPublishingRunListener 这个内建的实现中，contextLoaded 方法中最后发送了 ApplicationPreparedEvent 事件，如果我们来监听这个事件，通过参数 application 获取到 Environment 也可以进行相应的操作。

我们新建 ExtendPropertySourceApplicationListener2 来监听 ApplicationPreparedEvent 事件。

```java
		ApplicationListener<ApplicationPreparedEvent> {

	@Override
	public void onApplicationEvent(ApplicationPreparedEvent event) {
		ConfigurableApplicationContext context = event.getApplicationContext();
		ConfigurableEnvironment environment = context.getEnvironment();
		MutablePropertySources propertySources = environment.getPropertySources();

		Map<String, Object> map = new HashMap<>();
		map.put("user.id", 100);
		MapPropertySource propertySource = new MapPropertySource("from-ExtendPropertySourceApplicationListener2", map);

		propertySources.addFirst(propertySource);
	}
}
```

resources/META-INF/spring.factories 文件新增对应的配置

```properties
# Application Listeners
org.springframework.context.ApplicationListener=\
com.zq.externalized.configuration.listener.ExtendPropertySourceApplicationListener,\
com.zq.externalized.configuration.listener.ExtendPropertySourceApplicationListener2
```

执行结果:

```bash
用户id: 100
顺序[1]-名称[from-ExtendPropertySourceApplicationListener2]:[MapPropertySource {name='from-ExtendPropertySourceApplicationListener2'}]
顺序[2]-名称[from-SpringApplicaitonRunListener#contextLoaded]:[MapPropertySource {name='from-SpringApplicaitonRunListener#contextLoaded'}]
顺序[3]-名称[from-SpringApplicationRunListener#contextPrepared]:[MapPropertySource {name='from-SpringApplicationRunListener#contextPrepared'}]
顺序[4]-名称[from-ApplicationContextInitializer]:[MapPropertySource {name='from-ApplicationContextInitializer'}]
顺序[5]-名称[configurationProperties]:[ConfigurationPropertySourcesPropertySource {name='configurationProperties'}]
顺序[6]-名称[from-ApplicationEnvironmentPreparedEvent]:[MapPropertySource {name='from-ApplicationEnvironmentPreparedEvent'}]
顺序[7]-名称[from-EnvironmentPostProcessor]:[MapPropertySource {name='from-EnvironmentPostProcessor'}]
顺序[8]-名称[from-SpringApplicationRunListener#environmentPrepared]:[MapPropertySource {name='from-SpringApplicationRunListener#environmentPrepared'}]
顺序[9]-名称[commandLineArgs]:[SimpleCommandLinePropertySource {name='commandLineArgs'}]
顺序[10]-名称[systemProperties]:[MapPropertySource {name='systemProperties'}]
顺序[11]-名称[systemEnvironment]:[OriginAwareSystemEnvironmentPropertySource {name='systemEnvironment'}]
顺序[12]-名称[random]:[RandomValuePropertySource {name='random'}]
顺序[13]-名称[applicationConfig: [classpath:/application.properties]]:[OriginTrackedMapPropertySource {name='applicationConfig: [classpath:/application.properties]'}]
顺序[14]-名称[from classpath:META-INF/default.properties]:[ResourcePropertySource {name='from classpath:META-INF/default.properties'}]
```

顺序顺序[1]-名称[from-ExtendPropertySourceApplicationListener2]  就是我们新加入的 ExtendPropertySourceApplicationListener2

## 4.参考

-   慕课网-小马哥《Spring Boot2.0深度实践之核心技术篇》