---
title: Java 8 Streams API 详解
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-07-17 19:05:27
password:  
summary: Java 8 Streams API 详解
tags: 
	- Java8
	- Streams
categories: Java
---


> 原文出处：[邓承超的个人日志](http://dengchengchao.com/)


## 一、介绍

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/java8-stream.png)

流式编程作为Java 8的亮点之一，是继```Java 5```之后对集合的再一次升级，可以说```Java 8```几大特性中，```Streams API``` 是作为Java 函数式的主角来设计的,夸张的说，有了```Streams API```之后，万物皆可一行代码。


## 二、什么是 Stream

Stream被翻译为流，它的工作过程像将一瓶水导入有很多过滤阀的管道一样，水每经过一个过滤阀，便被操作一次，比如过滤，转换等，最后管道的另外一头有一个容器负责接收剩下的水。


![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/java8-stream2.png)


首先通过```source```产生流，然后依次通过一些中间操作，比如过滤，转换，限制等，最后结束对流的操作。

Stream`


## 三、为什么需要Stream

Stream作为Java 8的一大亮点，它专门针对集合的各种操作提供各种非常便利，简单，高效的API，```Stream API```主要是通过```Lambda```表达式完成，极大的提高了程序的效率和可读性，同时```Stram API```中自带的并行流使得并发处理集合的门槛再次降低，使用```Stream API```编程无需多写一行多线程的大门就可以非常方便的写出高性能的并发程序。使用```Stream API```能够使你的代码更加优雅。

流的另一特点是可无限性，使用```Stream```，你的数据源可以是无限大的。

在没有```Stream```之前，我们想提取出所有年龄大于18的学生，我们需要这样做：

```java
List<Student> result = new ArrayList<>();
for (Student student : students) {
    if (student.getAge() > 18) {
        result.add(student);
    }
}
```

使用Stream,我们可以参照上面的流程示意图来做，首先产生Stream,然后filter过滤，最后归并到容器中。

转换为代码如下：

```java
List<Student> result = students.stream().filter((student) -> student.getAge() > 18).collect(Collectors.toList());
```


* 首先```stream()```获得流 
* 然后`filter((student) -> student.getAge() > 18)`过滤
* 最后`collect(Collectors.toList())`归并到容器中

是不是很像在写sql?


## 四、如何使用Stream


![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/java8-stream3.png)

我们可以发现，当我们使用一个流的时候，主要包括三个步骤：

* 获取流
* 对流进行操作
* 结束对流的操作


### 获取流

获取流的方式有多种，对于常见的容器(```Collection```)可以直接`.stream()`获取

例如：

* `Collection.stream()`
* `Collection.parallelStream()`
* `Arrays.stream(T array) or Stream.of()`

对于 `I/O`，我们也可以通过 `lines()` 方法获取流：

* `java.nio.file.Files.walk()`
* `java.io.BufferedReader.lines()`

最后，我们还可以从无限大的数据源中产生流：

* `Random.ints()`

值得注意的是，JDK中针对基本数据类型的昂贵的装箱和拆箱操作，提供了基本数据类型的流：

* `IntStream`
* `LongStream`
* `DoubleStream`

这三种基本数据类型和普通流差不多，不过他们流里面的数据都是指定的基本数据类型。

```java
Intstream.of(new int[]{1,2,3});
Intstream.rang(1,3);
```

### 对流进行操作

这是本章的重点，产生流比较容易，但是不同的业务系统的需求会涉及到很多不同的要求，明白我们能对流做什么，怎么做，才能更好的利用Stream API的特点。

**流的操作类型分为两种:**

* **Intermediate**：中间操作，一个流可以后面跟随零个或多个`intermediate`操作。其目的主要是打开流，做出某种程度的数据映射/过滤，然后会返回一个新的流，交给下一个操作使用。这类操作都是**惰性化的（lazy）**，就是说，仅仅调用到这类方法，并没有真正开始流的遍历。

`map (mapToInt, flatMap 等)、 filter、 distinct、 sorted、 peek、 limit、 skip、 parallel、 sequential、 unordered`

* **Terminal**：终结操作，一个流只能有一个`terminal`操作，当这个操作执行后，流就被使用“光”了，无法再被操作。所以这必定是流的最后一个操作。`Terminal`操作的执行，才会真正开始流的遍历，并且会生成一个结果，或者一个 side effect。

`forEach、 forEachOrdered、 toArray、 reduce、 collect、 min、 max、 count、 anyMatch、 allMatch、 noneMatch、 findFirst、 findAny、 iterator`


`Intermediate`和`Terminal`完全可以按照上图的流程图理解，`Intermediate`表示在管道中间的过滤器，水会流入过滤器，然后再流出去，而`Terminal`操作便是最后一个过滤器，它在管道的最后面，流入`Terminal`的水，最后便会流出管道。


下面依次详细的解读下每一个操作所能产生的效果：

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Student {

    private String name;

    private int age;
}


List<Student> students = Arrays.asList(
        new Student("zq1", 10),
        new Student("zq2", 20),
        new Student("zq3", 30),
        new Student("zq4", 40),
        new Student("zq5", 50)
);
```

#### 中间操作

对于中间操作，所有的`API`的返回值基本都是`Stream<T>`,因此以后看见一个陌生的`API`也能通过返回值判断它的所属类型。


##### map

map顾名思义，就是映射，map操作能够将流中的每一个元素映射为另外的元素。

```java
<R> Stream<R> map(Function<? super T, ? extends R> mapper);
```

可以看到map接受的是一个Function,也就是接收参数，并返回一个值。

比如：

```java
// 提取 List<Student>  所有student 的名字 
List<String> result = students.stream().map(Student::getName).collect(Collectors.toList());
```

上面的代码等同于以前的：

```java
List<String> result = new ArrayList<>();
for (Student student : students) {
    result.add(student.getName());
}
```

再比如：将List中所有字母转换为大写：

```java
List<String> wards = Arrays.asList("a", "b", "c");
List<String> upperWords = wards.stream().map(String::toUpperCase).collect(Collectors.toList());
```

##### flatMap
`flatMap`顾名思义就是扁平化映射，它具体的操作是将多个`stream`连接成一个`stream`，这个操作是针对类似多维数组的，比如容器里面包含容器等。

```java
List<List<Integer>> ints = new ArrayList<>(Arrays.asList(
        Arrays.asList(1, 2),
        Arrays.asList(3, 4, 5)
));

List<Integer> flatInts = ints.stream().flatMap(Collection::stream).collect(Collectors.toList());
```
可以看到，相当于降维。


##### filter
filter顾名思义，就是过滤，通过测试的元素会被留下来并生成一个新的Stream

```java
Stream<T> filter(Predicate<? super T> predicate);
```

同理，我们可以`filter`接收的参数是`Predicate`，也就是推断型函数式接口，接收参数，并返回`boolean`值。

比如：

```java
// 获取所有年龄大于18岁的学生
List<Student> result = students.stream().filter((student) -> student.getAge() > 18).collect(Collectors.toList());
```

##### distinct

`distinct`是去重操作,它没有参数


##### sorted

`sorted`排序操作，默认是从小到大排列，`sorted`方法包含一个重载，使用`sorted`方法，如果没有传递参数，那么流中的元素就需要实现`Comparable<T>`方法，也可以在使用`sorted`方法的时候传入一个`Comparator<T>`

```java
Stream<T> sorted();
Stream<T> sorted(Comparator<? super T> comparator);
```

得一说的是这个`Comparator`在`Java 8`之后被打上了`@FunctionalInterface`,其他方法都提供了`default`实现，因此我们可以在`sort`中使用`Lambda`表达式

```java
// 以年龄倒序
students.stream().sorted((s1, s2) -> Integer.compare(s2.getAge(), s1.getAge())).forEach(System.out::println);
```

然而还有更方便的，`Comparator`默认也提供了实现好的方法引用，使得我们更加方便的使用：

例如上面的代码可以改成如下：
```java
// 以年龄倒序
students.stream().sorted(Comparator.comparingInt(Student::getAge).reversed()).forEach(System.out::println);
```

或者：

```java
// 以姓名倒序
students.stream().sorted(Comparator.comparing(Student::getName).reversed()).forEach(System.out::println);

// Output: 
Student(name=zq4, age=38)
Student(name=zq3, age=28)
Student(name=zq2, age=20)
Student(name=zq1, age=10)
```

##### peek

`peek`有遍历的意思，和`forEach`一样，但是它是一个中间操作。

`peek`接受一个消费型的函数式接口。
```java
Stream<T> peek(Consumer<? super T> action);
```

例如：
```java
// 去重以后打印出来，然后再归并为List
List<Student> result = students.stream().distinct().peek(System.out::println).collect(Collectors.toList());
```


##### limit

```java
Stream<T> limit(long maxSize);
```

`limit`裁剪操作，和`String::subString(0,x)`有点类似，`limit`接受一个`long`类型参数，通过`limit`之后的元素只会剩下`min(n,size)`个元素，`n`表示参数，`size`表示流中元素个数

例如：

```java
//只留下前3个元素并打印
students.stream().limit(3).forEach(System.out::println);
```


##### skip

`skip`表示跳过多少个元素，和`limit`比较像，不过`limit`是保留前面的元素，`skip`是保留后面的元素

```java
Stream<T> skip(long n);
```

例如：
```java
//跳过前3个元素并打印 
students.stream().skip(3).forEach(System.out::println);
```

#### 终结操作

一个流处理中，有且只能有一个终结操作，通过终结操作之后，流才真正被处理，终结操作一般都返回其他的类型而不再是一个流,一般来说，终结操作都是将其转换为一个容器。

##### forEach

`forEach`是终结操作的遍历，操作和`peek`一样，但是`forEach`之后就不会再返回流

```java
void forEach(Consumer<? super T> action);
```

例如：

```java
//遍历打印
students.stream().forEach(System.out::println);
```

上面的代码和一下代码效果相同：
```java
for (Student student : students) {
    System.out.println(student);
}
```

##### toArray

`toArray`和`List##toArray()`用法差不多，包含一个重载。

默认的`toArray()`返回一个`Object[]`，

也可以传入一个`IntFunction<A[]> generator`指定数据类型

一般建议第二种方式。

```java
Object[] toArray();

<A> A[] toArray(IntFunction<A[]> generator);
```


例如：
```java
Student[] result = students.stream().skip(3).toArray(Student[]::new);
```

##### max/min

`max/min`即使找出最大或者最小的元素。`max/min`必须传入一个`Comparator`。

例如：
```java
// 找到年龄最小的学生
 Student student = students.stream().min(Comparator.comparingInt(Student::getAge)).get();
```

##### count

`count`返回流中的元素数量

```java
long count();
```

例如：

```java
long count = students.stream().skip(3).count();
```

##### reduce

`reduce`为归纳操作，主要是将流中各个元素结合起来，它需要提供一个起始值，然后按一定规则进行运算，比如相加等，它接收一个二元操作 `BinaryOperator`函数式接口。从某种意义上来说，`sum,min,max,average`都是特殊的`reduce`

`reduce`包含三个重载：

```java
T reduce(T identity, BinaryOperator<T> accumulator);

Optional<T> reduce(BinaryOperator<T> accumulator);


<U> U reduce(U identity,
             BiFunction<U, ? super T, U> accumulator,
             BinaryOperator<U> combiner);
```

例如：

```java
List<Integer> integers = new ArrayList<>(Arrays.asList(1, 2, 3));
Integer sum = integers.stream().reduce(0, (x, y) -> x + y);
```

`reduce`两个参数和一个参数的区别在于有没有提供一个起始值，

如果提供了起始值，则可以返回一个确定的值，如果没有提供起始值，则返回`Opeational`防止流中没有足够的元素。


##### anyMatch\ allMatch\ noneMatch

测试是否有任意元素\所有元素\没有元素匹配表达式

他们都接收一个推断类型的函数式接口：`Predicate`

例如：

```java
List<Integer> integers = new ArrayList<>(Arrays.asList(1, 2, 3));
boolean test = integers.stream().anyMatch((x) -> x > 1);
```

##### findFirst、 findAny

获取元素，这两个API都不接受任何参数，`findFirt`返回流中第一个元素，`findAny`返回流中任意一个元素。

也有有人会问`findAny()`这么奇怪的操作谁会用？这个API主要是为了在并行条件下想要获取任意元素，以最大性能获取任意元素

例如：

```java
List<Integer> integers = new ArrayList<>(Arrays.asList(1, 2, 3));
Integer integer = integers.stream().findAny().get();
```

##### collect

`collect`收集操作，这个`API`放在后面将是因为它太重要了，基本上所有的流操作最后都会使用它。

我们先看`collect`的定义


```java
<R> R collect(Supplier<R> supplier,
              BiConsumer<R, ? super T> accumulator,
              BiConsumer<R, R> combiner);
                  
                  
<R, A> R collect(Collector<? super T, A, R> collector);
```

可以看到，`collect`包含两个重载：

一个参数和三个参数，

三个参数我们很少使用，因为`JDK`提供了足够我们使用的`Collector`供我们直接使用,我们可以简单了解下这三个参数什么意思：

* `Supplier`:用于产生最后存放元素的容器的生产者
* `accumulator`:将元素添加到容器中的方法
* `combiner`：将分段元素全部添加到容器中的方法

前两个元素我们都很好理解，第三个元素是干嘛的呢？因为流提供了并行操作，因此有可能一个流被多个线程分别添加，然后再将各个子列表依次添加到最终的容器中。

↓ – – – – – – – – –

↓ — — —

↓ ———


如上图，分而治之。

例如：

```java
List<String> result = stream.collect(ArrayList::new, List::add, List::addAll);
```


接下来看只有一个参数的`collect`

一般来说，只有一个参数的`collect`，我们都直接传入`Collectors`中的方法引用即可

```java
List<Integer> integers = Arrays.asList(1, 3, 3, 4, 5);
List<Integer> result = integers.stream().skip(2).collect(Collectors.toList());
```


`Collectors`中包含很多常用的转换器。`toList()`,`toSet()`等。

`Collectors`中还包括一个`groupBy()`，他和`Sql`中的`groupBy`一样都是分组，返回一个`Map`


例如：

```java
// 按年龄分组
Map<Integer, List<Student>> map = students.stream().collect(Collectors.groupingBy(Student::getAge));
```

`groupingBy`可以接受3个参数，分别是

* 第一个参数：分组按照什么分
* 第二个参数：分组最后用什么容器保存返回（当只有两个参数是，此参数默认为`HashMap`）
* 第三个参数：按照第一个参数分后，对应的分类的结果如何收集

有时候单参数的`groupingBy`不满足我们需求的时候，我们可以使用多个参数的`groupingBy`

例如：

```java
//将学生以年龄分组，每组中只存学生的名字而不是对象
Map<Integer, List<String>> map = students.stream().collect(
        Collectors.groupingBy(
            Student::getAge,
            Collectors.mapping(Student::getName, Collectors.toList())
        )
);
```

`toList`默认生成的是`ArrayList`,`toSet`默认生成的是`HashSet`，如果想要指定其他容器，可以如下操作

```java
TreeSet<Student> set = students.stream().collect(
        Collectors.toCollection(TreeSet::new)
);
```

`Collectors`还包含一个`toMap`，利用这个API我们可以将`List`转换`为Map`

例如：
```java
Map<Integer, Student> map = students.stream().collect(
        Collectors.toMap(Student::getAge, s -> s, (s1, s2) -> s1)
);
```

Collectors.toMap，最后一个参数表示元素有重复时保留哪一个元素


值得注意的一点是，`IntStream`，`LongStream`,`DoubleStream`是没有`collect()`方法的，因为对于基本数据类型，要进行装箱，拆箱操作，SDK并没有将它放入流中，对于基本数据类型流，我们只能将其`toArray()`


## 五、优雅的使用Stream

了解了`Stream API`，下面详细介绍一下如果优雅的使用`Steam`


* 了解流的惰性操作

前面说到，流的中间操作是惰性的，如果一个流操作流程中只有中间操作，没有终结操作，那么这个流什么都不会做，整个流程中会一直等到遇到终结操作操作才会真正的开始执行。

例如：
```java
students.stream().peek(System.out::println);
```

这样的流操作只有中间操作，没有终结操作，那么不管流里面包含多少元素，他都不会执行任何操作。


* 明白流操作的顺序的重要性

在`Stream API`中，还包括一类`Short-circuiting`,它能够改变流中元素的数量，一般这类`API`如果是中间操作，最好写在靠前位置：

考虑下面两行代码：

```java
List<Student> result1 = students.stream()
        .sorted(Comparator.comparingInt(Student::getAge))
        .peek(System.out::println)
        .limit(3)
        .collect(Collectors.toList());
```


```java
List<Student> result2 = students.stream()
        .limit(3)
        .sorted(Comparator.comparingInt(Student::getAge))
        .peek(System.out::println)
        .collect(Collectors.toList());
```

两段代码所使用的`API`都是相同的，但是由于顺序不同，带来的结果都非常不一样的，

第一段代码会先排序所有的元素，再依次打印一遍，最后获取前三个最小的放入`list`中,

第二段代码会先截取前3个元素，在对这三个元素排序，然后遍历打印，最后放`list`中。


* 明白`Lambda`的局限性

由于`Java`目前只能`Pass-by-value`，因此对于`Lambda`也和有匿名类一样的`final`的局限性。

因此我们无法再`lambda`表达式中修改外部元素的值。

同时，在`Stream`中，我们无法使用`break`提前返回。


* 合理编排`Stream`的代码格式

由于可能在使用流式编程的时候会处理很多的业务逻辑，导致API非常长，此时最后使用换行将各个操作分离开来，使得代码更加易读。

例如：

```java
List<Student> result1 = students.stream()
        .sorted(Comparator.comparingInt(Student::getAge))
        .peek(System.out::println)
        .limit(3)
        .collect(Collectors.toList());
```

同时由于`Lambda`表达式省略了参数类型，因此对于变量，尽量使用完成的名词，比如`student`而不是`s`，增加代码的可读性。


## 六、总结
总之`，Stream`是Java 8 提供的简化代码的神器，合理使用它，能让你的代码更加优雅。

