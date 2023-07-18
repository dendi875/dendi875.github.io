---
title: Java8 Lambda 表达式
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2022-06-26 18:15:09
password:
summary: Java8 Lambda 表达式详细介绍
tags: 
	- Java8
	- Lambda
categories: Java
---



## 一、介绍

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/lambda.png)

Java 8 Lambda 表达式是一个匿名函数。匿名函数是指没有名字且不与任何类绑定的函数。


## 二、为什么要使用 Lambda 表达式？

使用 Lambda 表达式可以实现使用简洁的代码来创建函数式接口的实例，这样就避免了使用匿名内部类繁琐的写法。

下面我们将学习下Java 8 Lambda 表达式实现示例。

## 三、Java Lambda 表达式语法

Lambda 表达式非常简单，包含三个部分。形参列表、箭头运算符（->）和表达式（方法体）。

**语法 ：** `(parameters) -> { statements; }`

与任何 java 函数一样，我们可以有任意数量的参数。我们还可以在方法体中包含任意数量的行或表达式。

例子：

```java
// 普通函数
public static int add(int a, int b) {
    return a + b;
}
```

```java
// 等效的Java Lambda表达式示例
(a, b) -> a + b;
```

为了更好地理解，让我们看一下 Runnable 类的真实示例。

在 java 8 之前，对于函数式接口的实现，我们要么使用实现类，要么使用匿名内部类。 但是在 lambda 之后，我们可以有另外的做法。

```java
// 在 java 8 之前，使用实现类来实现
public class RunnableImpl implements Runnable {
    @Override
    public void run() {
        System.out.println("Runnable implementation");
    }
}

// usage：Runnable runnableObj = new RunnableImpl();
```

```java
// 在 java 8 之前，使用匿名类内部类来实现
Runnable runnableObj = new Runnable() {
    @Override
    public void run() {
        System.out.println("Anonymous implementation");
    }
};
```

换成等效的 lambda 表达式的实现是：

```java
Runnable runnableObj = () -> System.out.println("Lambda implementation");
```

关于 Java lambda 表达式要知道的知识点：

* Java 8 lambda 表达式可以有零个、一个或**多个参数**。eg: `() -> 10; a -> a * a; (a, b) -> a + b;`
* 对于零个或多个参数，小括号是**必须的**。eg：`() -> 10; (a, b) -> a + b;`
* 对于一个参数，小括号是**可选的**。eg：`a -> a * a;`
* 参数类型可以声明或由程序**自动检测**。eg：`(int a, int b) -> a + b; OR (a, b) -> a + b;`
* 如果我们要声明参数类型，小括号是**必须的**。eg：`(int a) -> a * a;`
* 如果方法体只有一条语句，大括号是**可选的**。eg：`a -> a * a; OR a -> {return a * a;};`
* 如果方法体只有一条语句，return关键字是**可选的**，Lambda表达式会自动返回这条语句的值。eg：`a -> a * a; OR a -> {return a * a;};`
* 如果有返回值，我们添加了大括号，那么return关键字是**必须的**。eg：`a -> {return a * a}`
* 可以在 Lambda 表达式中使用**方法级别或类级别的变量**。
* lambda 表达式中使用的局部变量必须是**有效的最终变量**。


## 四、Lambda 表达式与函数式接口

Lambda 表达式的类型，也被称为“目标类型（target type）”，Lambda 表达式的目标类型必须是“函数式接口（funcitonal interface）”。函数式接口代表只包含一个抽象方法的接口。函数式接口可以包含多个默认方法、类方法，但只能声明一个抽象方法。

由于 Lambda 表达式的结果就是被当成对象，因此可以使用 Lambda 表达式进行赋值。

```java
// Runnable 接口中只包含一个无参的方法
// Lambda 表达式的匿名函数实现了Runnable接口中唯一的方法
// 下面的 Lambda 表达式创建了一个 Runnable 对象
Runnable runnableObj = () -> {
    System.out.println("lambda");
};
```

Lambda 表达式有两个使用限制：
* Lambda 表达式的目标类型必须是**明确的函数式接口**。
* Lambda 表达式只能为**函数式接口创建对象**。


```java
Object obj = () -> {
    for (int i = 0; i < 100; i++) {
        System.out.println(i);
    }
};
```

编译上面的代码会报 `Object 不是函数接口`的错误，这表明 Lambda 表达式的类型必须是明确的函数式接口，上面的代码将 Lambda 表达式赋值给 Object 变量，编译器只能确定该该 Lambda 表达式的类型为 Object，而 Object 并不是函数式接口，因此会报错。

通常有 3 种方式来保证Lambda表达式的目标类型是一个函数式接口

* 赋值：将 Lambda 表达式赋值给函数式接口类型的变量。 
* 传参：将 Lambda 表达式作为函数式接口类型的参数传给某个方法。 
* 强制类型转换：使用函数式接口对 Lambda 表达式进行强制类型转换。


## 五、Lambda 表达式的方法引用与构造器引用及数组引用

方法引用和构造器引用可以让 Lambda 表达式的代码块更加简洁。```方法引用和构造器引用都需要使用两个英文冒号```。


Lambda 表达式支持的方法引用和构造器引用如下：


|引用方式| 示例| 说明| 对应的Lambda表达式| 
|----------|---| ---| ---| 
|类方法引用 |类名::静态方法名|调用时全部参数将传给该类方法作为参数|(a, b, c) -> 类名.类方法(a, b, c)| 
|实例方法引用 |类名::实例方法名| 第一个参数将作为调用者，剩下全部参数将传给该实例方法作为参数|(a, b, c) -> a.实例方法(b, c)| 
|引用特定对象的实例方法 |对象::实例方法名|调用时全部参数将传给该实例方法作为参数 | (a, b, c) -> 特定对象.实例方法(a, b, c)|
|引用构造器 |类名::new| 调用时全部参数将传给该构造器作为参数 |(a, b, c) -> new 类名(a, b, c) | 

### 5.1 方法引用

* 使用场景：当 Lambda 体中的具体实现，已经有其他方法帮我们实现过了，那这时候我们就可以使用方法引用。

* 要求：需要保证引用方法的参数列表、返回值类型与我们当前所要实现的函数式接口方法的参数列表、返回值类型保持一致。

* 为什么要使用：方法引用是Lambda表达式的另外一种表现形式，是一个语法糖，使用方法引用可以少写一些代码，提高工作效率。


#### 5.1.1 类名::静态方法名

```java
@FunctionalInterface
interface Converter {
    Integer convert(String s);
}
```

我们使用Lambda表达式来创建一个Converter对象

```java
Converter converter = s -> Integer.valueOf(s);
System.out.println(converter.convert("10"));
// Output: 10
```

下面我们将使用`类方法引用`来代替上面的写法

```java
Converter converter = Integer::valueOf;
System.out.println(converter.convert("10"));
// Output: 10
```

当调用 `converter.convert("10")` 时，调用参数会传给 Integer 类的 valueOf 类方法


#### 5.1.2 类名::实例方法名

```java
@FunctionalInterface
interface MyStr {
    String substr(String a, int b, int c);
}
```

我们使用Lambda表达式来创建一个MyLambda对象
```java
MyStr ms = (a, b, c) -> a.substring(b, c);
System.out.println(ms.substr("lambda", 2, 4));
// Output：mb
```

下面我们将使用`实例方法引用`来代替上面的写法

```java
MyStr ms = String::substring;
System.out.println(ms.substr("lambda", 2, 4));
// Output：mb
```

当调用`ms.substr("lambda", 2, 4))` substr 方法时，第一个调用参数(lambda)将作为实例方法 substring() 方法的调用者，剩下的全部调用参数(2,4)将作为 substring() 实例方法的实参。

**注意**：这种方法引用的方式就不需要满足```保证引用方法的参数列表、返回值类型与我们当前所要实现的函数式接口方法的参数列表、返回值类型保持一致```这一规则

#### 5.1.3 对象::实例方法名

```java
// 使用lambda表达式
Consumer<String> con = (x) -> System.out.println(x);
con.accept("zhang");
// Output: zhang
```

下面我们将使用`引用特定对象的实例方法`来代替上面的写法
```java
// 使用方法引用
Consumer<String> con2 = System.out::println;
con2.accept("quan");
// Output: quan
```

**注意**，```这样写的前提: accept()方法和println()方法的参数列表和返回类型要完全一致```（有参无返回值）。 

当调用 out 对象的 println() 方法时，调用参数会全部传给 **"out"对象的println()实例方法**

再举一个例子：
```java
// 使用lambda表达式
Supplier<Double> sup = () -> Math.random();
System.out.println(sup.get());
// Output: 0.7947699240208332
```


```java
// 使用方法引用
Supplier<Double> sup1 = Math::random;
System.out.println(sup1.get());
// Output: 0.1991189968346606
```

**注意**，```这样写的前提: get()方法和random()方法的参数列表和返回类型要完全一致```（无参有返回值）。


### 5.2 引用构造器

语法格式：```类::new```，调用哪个构造器取决于函数式接口中的方法形参的定义，Lambda 会自动根据接口方法推断出你要调用的构造器，也就是说需要调用的构造器的参数列表要与函数式接口中的抽象方法的参数列表保持一致


```java
public class User {
    private Integer id;
    private String name;
    private String age;

    public User() {
    }

    public User(Integer id) {
        this.id = id;
    }

    public User(Integer id, String name) {
        this.id = id;
        this.name = name;
    }

    public User(Integer id, String name, String age) {
        this.id = id;
        this.name = name;
        this.age = age;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    @Override
    public String toString() {
        return "User{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", age='" + age + '\'' +
                '}';
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAge() {
        return age;
    }

    public void setAge(String age) {
        this.age = age;
    }
}
```

#### 5.2.1 无参构造器获取对象（Supplier）

使用Lambda表达式实现通过 User 的无参构造器获取 User 对象
```java
Supplier<User> supplier1 = () -> new User();
System.out.println("user: " + supplier1.get());
// Output: user: User{id=null, name='null', age='null'}
```

使用Lambda构造器引用实现通过 User 的无参构造器获取 User 对象
```java
Supplier<User> supplier2 = User::new;
System.out.println("user: " + supplier2.get());
// Output: user: User{id=null, name='null', age='null'}
```

#### 5.2.2  一个有参构造器获取对象（Function）

使用Lambda表达式实现通过 User 的 1 个有参构造器获取 User 对象
```java
Function<Integer, User> function1 = (id) -> new User(id);
System.out.println(function1.apply(1));
// Output: User{id=1, name='null', age='null'}
```

使用Lambda构造器引用实现通过 User 的 1 个有参构造器获取 User 对象
```java
Function<Integer, User> function2 = User::new;
System.out.println(function1.apply(1));
// Output: User{id=1, name='null', age='null'}
```

#### 5.2.3 二个有参构造器获取对象（BiFunction）

使用Lambda表达式实现通过 User 的 2 个有参构造器获取 User 对象
```java
BiFunction<Integer, String, User> biFun1 = (id, name) -> new User(id, name);
System.out.println(biFun1.apply(1, "zhangquan"));
// Output: User{id=1, name='zhangquan', age='null'}
```

使用Lambda构造器引用实现通过 User 的 2 个有参构造器获取 User 对象
```java
BiFunction<Integer, String, User> biFun2 = User::new;
System.out.println(biFun2.apply(1, "zhangquan"));
// Output: User{id=1, name='zhangquan', age='null'}
```

#### 5.2.4  三及以上个有参构造器获取对象（自定义函数式接口）

首先自定义函数式接口：

```java
@FunctionalInterface
public interface MyFun<F, S, T, R> {
    R apply(F f, S s, T t);
}
```

使用Lambda表达式实现通过 User 的 3 个有参构造器获取 User 对象
```java
MyFun<Integer, String, Integer, User> myFun1 = (id, name, age) -> new User(id, name, age);
System.out.println(myFun1.apply(1, "zhangquan", 30));
// Output: User{id=1, name='zhangquan', age='30'}
```

使用Lambda构造器引用实现通过 User 的 3 个有参构造器获取 User 对象
```java
MyFun<Integer, String, Integer, User> myFun2 = User::new;
System.out.println(myFun2.apply(1, "zhangquan", 30));
// Output: User{id=1, name='zhangquan', age='30'}
```

### 5.3 数组引用

可以把数组看做是一个特殊的类，则写法与构造器引用一致。

> 语法格式为：Type[]::new

```java
Function<Integer, String[]> fun1 =  (length) -> new String[length];
String[] arr1 = fun1.apply(3);
System.out.println(arr1.length);
// Output: 3
```

```java
Function<Integer, String[]> fun2 = String[]::new;
String[] arr2 = fun1.apply(3);
System.out.println(arr2.length);
// Output: 3
```

## 六、Lambda 表达式 VS 匿名内部类

### 相同点

* 都可以直接访问 "effectively final"的局部变量（不需要加final关键字，但实际上是final，编译器编译时会自动加上），以及外部类的成员变量（包括实例变量和类变量）。

### 不同点

* 匿名内部类可以为任意接口创建实例，不管接口包含多少个抽象方法，只要匿名内部类实现所有的抽象方法即可。但Lambda表达式只能为函数式接口创建实例。
* 匿名内部类可以为抽象类、甚至普通类创建实例。但Lambda表达式只能为函数式接口创建实例。

* 匿名内部类实现的抽象方法的方法体允许调用接口中定义的默认方法。但Lambda表达式的代码块不允许调用接口中定义的默认方法。