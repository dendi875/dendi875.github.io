---
title: 重构：Java 代码中消除 If-Else 语句以获得更清晰、可扩展的逻辑
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-07-26 18:24:38
password:
summary: 重构：Java 代码中消除 If-Else 语句以获得更清晰、可扩展的逻辑
tags:
	- Java
	- 重构
categories: 重构
---

尽管 if-else 语句无处不在，但如果过度使用，可能会导致代码复杂且难以维护。在本文中，我们将探索各种策略来减少在项目中 if-else 结构的使用，重点是使代码更加模块化、可维护和可读。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240726095112.png)

## 减少 If-Else 语句的策略

*   策略模式

*   使用枚举

*   多态性

*   Lambda表达式和函数式接口

*   命令模式

*   保护子句

让我们通过示例深入了解每种策略。

## 策略模式

策略模式定义了一系列算法，封装了每个算法，并使它们可以互换。当您有多种方法来执行某项任务时，此模式非常有用。

**示例：支付处理系统**

首先，定义PaymentStrategy接口：

```java
public interface PaymentStrategy {
		public void pay(double amount);
}
```

接下来，实现不同的支付策略：

```java
public class AliPayment implements PaymentStrategy {
    @Override
    public void pay(double amount) {
        // ali支付处理逻辑
        System.out.println("Paid " + amount + " using Ali.");
    }
}

public class WeChatPayment implements PaymentStrategy {
    @Override
    public void pay(double amount) {
        // wechat支付处理逻辑
        System.out.println("Paid " + amount + " using WeChat.");
    }
}

```

创建一个使用以下策略的PaymentService：

```java
public class PaymentService {
    private final Map<String, PaymentStrategy> paymentStrategies = new HashMap<>();

    public PaymentService(List<PaymentStrategy> strategies) {
        for (PaymentStrategy strategy : strategies) {
          	paymentStrategies.put(strategy.getClass().getSimpleName(), strategy);
        }
    }

    public void processPayment(String strategyName, double amount) {
        PaymentStrategy strategy = paymentStrategies.get(strategyName);
        if (strategy != null) {
          	strategy.pay(amount);
        } else {
          	throw new IllegalArgumentException("No such payment strategy: " + strategyName);
        }
    }
}
```

最后，测试使用：

```java
public class PaymentTest {
    public static void main(String[] args) {
        // 没有PaymentService 的使用
        String payMethod = "WeChatPayment";
        if ("WeChatPayment".equals(payMethod)) {
          	new WeChatPayment().pay(100);
        } else if ("AliPayment".equals(payMethod)) {
          	new AliPayment().pay(100);
        }
        // other else if ...

        // 加入PaymentService来消除if..else
        List<PaymentStrategy> paymentStrategies = Arrays.asList(new AliPayment(), new WeChatPayment());
        PaymentService paymentService = new PaymentService(paymentStrategies);
        paymentService.processPayment("WeChatPayment", 100);
    }
}

// output: Paid 100.0 using WeChat.
```

## 使用枚举

枚举可以用来表示一组预定义的常量及其相关行为。

**示例：订单状态管理**

定义一个具有不同行为的OrderStatus枚举:

```java
public enum OrderStatus {
    NEW {
        @Override
        public void handle() {
          	System.out.println("Processing new order.");
        }
    },
    SHIPPED {
        @Override
        public void handle() {
          	System.out.println("Order shipped.");
        }
    },
    DELIVERED {
        @Override
        public void handle() {
          	System.out.println("Order delivered.");
        }
    };

    public abstract void handle();
}
```

在服务中使用此枚举：

```java
public class OrderService {
    public void processOrder(OrderStatus status) {
      	status.handle();
    }
}
```

最后，测试使用：

```java
public class OrderTest {
    public static void main(String[] args) {
        OrderStatus orderStatus = OrderStatus.NEW;
        // 之前的使用
        if (orderStatus == OrderStatus.NEW) {
          	System.out.println("Processing new order.");
        } else if (orderStatus == OrderStatus.SHIPPED) {
          	System.out.println("Order shipped.");
        } else if (orderStatus == OrderStatus.DELIVERED) {
          	System.out.println("Order delivered.");
        }

        // 之后的使用
        OrderService orderService = new OrderService();
        orderService.processOrder(orderStatus);
    }
}


// output: Processing new order.
```

## 多态性

多态性允许将对象视为其父类的实例，而不是其实际类的实例。这使您能够通过父类的引用调用派生类的重写方法。

**示例：通知系统**

定义一个Notification接口及其实现：

```java
public interface Notification {
		void send(String message);
}

public class EmailNotification implements Notification {
    @Override
    public void send(String message) {
        // Email sending logic
        System.out.println("Sending email: " + message);
    }
}

public class SmsNotification implements Notification {
    @Override
    public void send(String message) {
        // SMS sending logic
        System.out.println("Sending SMS: " + message);
    }
}
```

创建一个使用多态性的服务：

```java
public class NotificationService {

    private final List<Notification> notifications;

    public NotificationService(List<Notification> notifications) {
      	this.notifications = notifications;
    }

    public void notifyAll(String message) {
        for (Notification notification : notifications) {
          notification.send(message);
        }
    }
}
```

最后，测试使用：

```java
public class MyTest {
    public static void main(String[] args) {
        List<Notification> notifications = Arrays.asList(new EmailNotification(), new SmsNotification());
        NotificationService notificationService = new NotificationService(notifications);
        notificationService.notifyAll("hello word");
    }
}

// output: 
// Sending email: hello word
// Sending SMS: hello word
```

## Lambda 表达式和函数式接口

Lambda 表达式可以简化您的代码，尤其是在处理小型、单一方法接口时。

**示例：折扣服务**

```java
public class DiscountService {
    private Map<String, Function<Double, Double>> discountStrategies = new HashMap<>();

    public DiscountService() {
        discountStrategies.put("SUMMER_SALE", (price) -> price * 0.9);
        discountStrategies.put("SUMMER_SALE", (price) -> price * 0.8);
    }

    public double applyDiscount(String discountCode, double price) {
      	return discountStrategies.getOrDefault(discountCode, Function.identity()).apply(price);
    }
}
```

最后，测试使用：

```java
public class MyTest {
    public static void main(String[] args) {
        DiscountService discountService = new DiscountService();

        double sale = discountService.applyDiscount("SUMMER_SALE", 100);

        System.out.println("sale: " + sale);
    }
}

// output: sale: 80.0
```

## 命令模式

命令模式将请求封装为对象，从而允许您使用队列、请求和操作对客户端进行参数化。

**示例：文件操作**

定义Command接口和具体命令：

```java
public interface Command {
		void execute();
}

public class OpenFileCommand implements Command {
    private FileSystemReceiver fileSystemReceiver;

    public OpenFileCommand(FileSystemReceiver fs) {
      	this.fileSystemReceiver = fs;
    }

    @Override
    public void execute() {
      	this.fileSystemReceiver.openFile();
    }
}

public class CloseFileCommand implements Command {
    private FileSystemReceiver fileSystemReceiver;

    public CloseFileCommand(FileSystemReceiver fs) {
      	this.fileSystemReceiver = fs;
    }

    @Override
    public void execute() {
      	this.fileSystemReceiver.closeFile();
    }
}


```

定义文件系统接收器：

```java
public interface FileSystemReceiver {
    void openFile();
    void closeFile();
}

public class UnixFileSystemReceiver implements FileSystemReceiver {
    @Override
    public void openFile() {
      	System.out.println("Opening file in Unix OS");
    }

    @Override
    public void closeFile() {
      	System.out.println("Closing file in Unix OS");
    }
}

public class WindowsFileSystemReceiver implements FileSystemReceiver {
    @Override
    public void openFile() {
      	System.out.println("Opening file in Windows OS");
    }

    @Override
    public void closeFile() {
      	System.out.println("Closing file in Windows OS");
    }
}
```

定义文件调用器:

```java
public class FileInvoker {

    private Command command;

    public FileInvoker(Command command) {
      	this.command = command;
    }

    public void execute() {
      	this.command.execute();
    }
}
```

最后，测试使用：

```java
public class MyTest {
    public static void main(String[] args) {
        FileInvoker fileInvoker = new FileInvoker(new OpenFileCommand(new UnixFileSystemReceiver()));
        fileInvoker.execute();
    }
}

// output: Opening file in Unix OS
```



## 保护子句

思路其实就是，**让出错的代码先返回，前面把所有的错误判断全判断掉，然后就剩下的就是正常的代码了**。

**示例：用户验证**

不要嵌套 if-else 语句来验证用户输入，而是使用 guard 子句来预先处理无效情况：

```java
public class UserService {
    public void registerUser(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User cannot be null");
        }
        if (user.getName() == null || user.getName().isEmpty()) {
            throw new IllegalArgumentException("User name cannot be empty");
        }
        if (user.getEmail() == null || user.getEmail().isEmpty()) {
            throw new IllegalArgumentException("User email cannot be empty");
        }
        // Proceed with registration
        System.out.println("Registering user: " + user.getName());
    }
}
```

这种方法可以确保及早处理无效条件，使主要逻辑保持清晰。

## 抽取成函数

有人说：“如果代码不共享，就不要抽取成函数！”，持有这个观点的人太死读书了。函数是代码的封装或是抽象，并不一定用来作代码共享使用，函数用于屏蔽细节，让其它代码耦合于接口而不是细节实现，这会让我们的代码更为简单，简单的东西都能让人易读也易维护。这才是函数的作用。

## 参考

*   https://refactoring.com/catalog/replaceNestedConditionalWithGuardClauses.html