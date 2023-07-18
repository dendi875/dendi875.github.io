---
title: Java 中 Optional 类详解
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2022-06-19 20:43:50
password:
summary: Java8 中 Optional 类详细介绍
tags: 
	- Java8
	- Optional
categories: Java
---



## 一、介绍

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/optional.png)

在 java.util 包下的 Java 8 版本中添加了 Optional类。它用作实际值的容器或包装器，实际值可能为空，也可能不为空。使用 Optional将有助于我们以更简洁的方式避免和处理空指针异常



## 二、为什么要使用 Optional ？

我们在开发时为了避免出现空指针，需要添加空检查，这可能会导致嵌套 if 语句，结果就是造成很丑陋的代码。

```java
// 处理 null 的传统方式
Double balance = 0.0;
if (person != null ) {
    Account account = person.getAccount();
    if (account != null) {
        balance = account.getBalance();
    }
}
```

```java
// 使用 Optional 来处理 null
Double balance = person.flatMap(Person::getAccount)
        .flatMap(Account::getBalance)
        .orElse(0.0);
```

可以看到在某些场景下使用 Optional 能使我们的代码更加优雅简洁


## 三、Java 8 中 Optional 类中的方法



| 创建实例的方法|检查值的方法 |获取值的方法 |操作的方法|
| -------------|------------|---------|---------|
| `empty()`      | `isPresent()`|`get()`|`ifPresent(Consumer consumer)`|
| `of(T value)` | `filter(Predicate predicate)`|`orElse(T other)`|`map(Function mapper)`|
| `ofNullable(T value)`|      |`orElseGet(Supplier other)`|`flatMap(Function mapper)`|
|           |     |`orElseThrow(Supplier exception)`|   |


### 3.1 创建 Optional 对象的方法


Optional 类具有私有构造函数，因此我们不能使用 new 关键字创建对象。此外，一旦创建我们就无法更改 Optional 中的值，因此我们需要在创建对象时提供值。

有 3 种方法可以创建 Optional 对象。 使用 Optional 类中提供的 3 种不同的静态方法

* ```empty()```

返回一个没有 ```null``` 值的 Optional 对象，该方法创建的对象始终为空

```java
Optional<String> emptyOptional = Optional.empty();
```
空的 Optional 对象用于表示空值。 在这个对象上我们可以执行一些操作而不会出现空指针异常


* ```of(T value) ```

每当我们需要创建某个值的 Optional 时，我们可以使用 ```Optional.of(value)``` 来创建所需值的 Optional。
在此方法中，不允许使用 null 值。
如果我们尝试创建具有 null 值的对象，则会抛出 NullPointerException。

```java
String name = "zhangquan";
Optional<String> nameOptional = Optional.of(name);
// OK
```

```java
String name = null;
Optional<String> nameOptional = Optional.of(name);
// error
```

在某些情况下，我们不确定该值是否存在。 在这种情况下，我们应该使用 ```ofNullable(value)``` 而不是 ```of(value)``` 来避免NullPoiterException


* ```ofNullable(T value) ```

当我们需要创建某个值的 Optional 并且 value 可以为 null 时，我们应该使用 `Optional.ofNullabe(value)`。 这将创建所需值的 Optional，如果为 null，则为空。在此方法中，允许使用 null 值。如果我们尝试创建具有 null 值的对象，它将返回空 Optional。

```java
String name = "zhangquan";
Optional<String> nameOptional = Optional.ofNullabe(name);
// OK        
```

```java
String name = null;
Optional<String> nameOptional = Optional.ofNullabe(name);
// OK        
```

|创建实例的方法 | 参数|描述|
|---|---|---|
|`empty()`| -| 创建一个空的Optional |
|`of(T value)`|要设置的值 - 不能为null |为非null的值创建一个Optional|
|`ofNullable(T value)`|要设置的值 - 可以为 null|为指定的值创建一个Optional，如果指定的值为null，则返回一个空的Optional|

### 3.2 检查 Optional 对象中值的方法

有时我们需要检查 Optional 是否包含期望值，我们可以通过 2 种方式检查 Optional 对象是否包含值

* `isPresent()`

根据值是否存在返回 true 或 false

```java
Optional<String> emptyOptional = Optional.empty();
System.out.println(emptyOptional.isPresent());
// Output : false
```

```java
Optional<String> nameOptional = Optional.of("zhangquan");
System.out.println(nameOptional.isPresent());
// Output : true
```


* `Optional<T> filter(Predicate<? super T> predicate)`

此方法将`predicate`作为输入参数。 这里的`predicate`是针对 optional 对象检查的条件， 如果条件匹配，则返回带有值的 optional 对象，否则返回空的 optional 对象

```java
Optional nameOptional = Optional.of("zhangquan");
Optional output = nameOptional.filter(value -> value.equals("zhangquan"));
System.out.println(output);
// Output：Optional[zhangquan]
```

在上面的示例中，我们尝试检查 optional 是否包含“zhangquan”。 因为它是匹配的，所以输出以“zhangquan”作为值的optional对象

```java
Optional nameOptional = Optional.of("zhangquan");
Optional output = nameOptional.filter(value -> value.equals("java"));
System.out.println(output);
// Output：Optional.empty
```

在上面的示例中，我们尝试检查 optional 是否包含“java”值。 因为它是不匹配的，所以输出空的optional对象

```java
Optional<String> nameOptional = Optional.of("zhangquan");
Optional output = nameOptional.filter(value -> value.length() > 5);
System.out.println(output);
// Output：Optional[zhangquan]
```

|检查值的方法 | 参数|描述|
|---|---|---|
|`isPresent()`| -| 根据值是否存在返回true或false |
|`filter(Predicate predicate)`|Predicate接口|如果条件匹配，则返回带有值的 optional 对象，否则返回空的 optional 对象|


### 3.3 获取 Optional 对象中值的方法

根据需求和场景不同有 4 种方法可以访问 Optional 对象中的值

* `get()`

如果值存在则返回值，如果为空则抛出 NoSuchElementException 异常，只有当我们确定该值存在并且它不是空的 optional 时，我们才应该在此 optional 对象上使用此方法。

```java
System.out.println(Optional.empty().get());
// Exception in thread "main" java.util.NoSuchElementException: No value present
```

```java
System.out.println(Optional.of("zhangquan"));
// Output: Optional[zhangquan]
```

如果 optional 中的值可以为 null，那么我们可以使用其他方法，如 ```orElse(...)``` 来访问该值


* `orElse(T other)` 

```java
System.out.println(Optional.ofNullable("zhangquan").orElse("default"));
//  Output: zhangquan
```

与 get() 方法不同，如果为空 Optional，我们可以指定要返回的值，因此它不会抛出 NoSuchElementException。 这是从 optional 对象中访问值的最常见和最常用的方法。

```java
System.out.println(Optional.empty().orElse("default"));
//  Output: default
```

```java
System.out.println(Optional.ofNullable(null).orElse("default"));
//  Output: default
```

* `orElseGet( Supplier<? extends T> other)`

如果值存在则返回该值，否则返回其它值，这个其它值是个函数式接口。

该方法与 `orElse(...)` 方法差别不大，只不过 optional 为空时执行函数式接口，返回该函数式接口返回的值。

```java
public  String getDefaultValue() {
    return "default";
}

...

Optional<String> optional = Optional.empty();
System.out.println(optional.orElseGet(()->getDefaultValue());
Output : default
```

* `orElseThrow(Supplier exceptionSupplier)`

如果值存在则返回该值，否则则抛出异常。我们可以使用这个方法来抛出自定义异常。

```java
// before java 8
Data date = ... // 我们需要检查的变量
if (date == null) {
    throw new Exception("Date not found");// if null throw exception
} else {
    return date; // else return value from variable
}
```

```java
// using java 8
Optional<Date> date = ... //  optional variable
return date.orElseThrow(() -> new Exception("Date not found"));
```


### 3.4 操作 Optional 对象中值的方法

有 3 种方法可以对 Optional 对象中的值进行一些操作或者将值从一种形式转换为另一个形式

* `ifPresent( Consumer<? super T> consumer)`

仅当值存在时才执行逻辑。

```java
if (name != null) {
    System.out.println("Hello " + name);
}
```

```java
if (id != null) {
    userService.getById(id);
}
```

向上面这种代码使用 Optional 我们可以非常简洁的处理这个问题

```java
Optional optional = Optional.of("zhangquan");
optional.ifPresent(name -> System.out.println("Hello " + name));
```

```java
Optional optional = Optional.ofNullable(id);
optional.ifPresent(id -> userService.getById(id));
```

* `map( Function<? super  T,? extends U> mapper)`

使用 `mapper` 函数中的指定逻辑将值从一个形式转换为另一种形式，如果值存在，则返回新值的 optional，如果值不存在，则返回空的 optional。需要注意的一点是```map()```将返回新的值并且不会修改原始的值。


```java
User person = ...
if (person != null) {
    name = person.getName();
}
```

```java
// using optional
Optional<User>  person = ...
Optional<String> name = person.map(p -> p.getName());

OR

Optional <String> name = person.map(User::getName);
```

* `flatMap( Function<? super T, Optional<U>> mapper)`


与map() 几乎类似，不同之处在于map 将值转换为Optional 对象，而 flatMap 转换嵌套的Optional 对象`Optional<Optional>`。

Optional 值也可能是 Optional，因此这可能导致 `Optional<Optional>`。

```java
public class OptionalDemo {
    public static void main(String[] args) throws Exception {
        Optional<User> optional = Optional.ofNullable(new User(1, "zhangquan"));
        System.out.println(optional);  // Optional[com.zhangquan.java8.optional.User@5caf905d]
        System.out.println(optional.map(User::getIdOptional)); // Optional[Optional[1]]
        System.out.println(optional.flatMap(User::getIdOptional)); // Optional[1]
        System.out.println(optional.flatMap(User::getIdOptional).get()); // 1
        System.out.println(optional.flatMap(User::getName)); // error
    }
}

class User {
    public Optional<Integer> idOptional;
    public String name;

    public User(Integer id, String name) {
        this.idOptional = Optional.ofNullable(id);
        this.name = name;
    }

    public Optional<Integer> getIdOptional() {
        return idOptional;
    }

    public void setIdOptional(Optional<Integer> idOptional) {
        this.idOptional = idOptional;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
```

最需要注意的是 flat方法的 mapper 函数必须返回一个 Optional 对象。

## 四、orElse vs orElseGet

我们将讨论下 Optional 中的 orElse 与 orElseGet 它们的区别以及在什么时候应该使用哪种方法？

`orElse` 方法需要一个值，而 `orElseGet `方法需要函数式接口，我们可以使用 `orElse(functionCall())` 代替 `orElseGet(Class::functionDef())`，它会得到相同的结果，那为什么还要创建两种不同的方法呢？

答案就是在某些情况下它们在性能方面有很大差异。

orElse 与 orElseGet  的区别

* 如果 optional 为 null，我们将使用以下函数获取值

```java
public class OptionalDemo {
    public static void main(String[] args) {
        new Test().orElseVSorElseGet();
    }

    private static class Test {
        public void orElseVSorElseGet() {
            Optional<String> optional = Optional.ofNullable(null);

            String orElseGetResult = optional.orElseGet(this::getFunctionForTest);
            System.out.println("value in orElseGetResult " + orElseGetResult);

            String orElseResult = optional.orElse(this.getFunctionForTest());
            System.out.println("value in orElseResult " + orElseResult);
        }

        public String getFunctionForTest() {
            System.out.println("\n ===== function called ===== ");
            return "default value";
        }
    }
}
```

Output: 

```bash
 ===== function called ===== 
value in orElseGetResult default value

 ===== function called ===== 
value in orElseResult default value
```

* 如果 optional 中有值，我们将使用以下函数获取值

```java
public class OptionalDemo {
    public static void main(String[] args) {
        new Test().orElseVSorElseGet();
    }

    private static class Test {
        public void orElseVSorElseGet() {
            Optional<String> optional = Optional.ofNullable("value found");

            String orElseGetResult = optional.orElseGet(this::getFunctionForTest);
            System.out.println("value in orElseGetResult " + orElseGetResult);

            String orElseResult = optional.orElse(this.getFunctionForTest());
            System.out.println("value in orElseResult " + orElseResult);
        }

        public String getFunctionForTest() {
            System.out.println("\n ===== function called ===== ");
            return "default value";
        }
    }
}
```

Output: 

```bash
value in orElseGetResult value found

 ===== function called ===== 
value in orElseResult value found
```

我们明确的知道 optional 对象中是有值的，所以我们期望 `orElse` 部分不应该被执行，然而它执行了。


因为上面 `getFunctionForTest` 方法很简单，没有多少性能的差异，但是当我们有复杂的逻辑来获取默认值时，它会影响性能，特别是需要查询数据库或者通过网络调用来获取默认值时，即使 optional 已经明确有值程序也会变慢。


> 在 orElse 的情况下，即使 optional 有值，也会执行 else 部分，如果我们有默认的静态值，那么 orElse 是不错的选择。但如果默认值需要通过复杂的计算逻辑来获得，那么我们应该使用 orElseGet



## 五、总结

* 5.1 在 java.util 包下的 Java 8 版本中添加。
* 5.2 Optional 类具有私有构造函数，因此我们不能使用 new 关键字创建对象。
* 5.3 Optional 表示具体某个值的 Optional 对象或空值，而不是 null 引用。