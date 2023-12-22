---
title: Python 中的装饰器
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-09-25 09:44:12
password:
summary: Python 中的装饰器
tags: Python
categories: Python
---

## 函数

引入装饰器之前，我们首先来看一下函数的几个核心概念。

### 函数赋予变量

在 Python 中，函数也是对象。我们可以把函数赋予变量，比如下面这段代码：

```python
def fun(message):
    print("Got a message: {}".format(message))

send_message = fun
send_message('hello world')

# output
Got a message: hello world
```

这个例子中，我们把函数 func() 赋予了变量 send_message，这样之后你调用 send_message，就相当于是调用函数 func()。

### 函数当作参数

我们可以把函数当作参数，传入另一个函数中，比如下面这段代码：

```python
def get_message(message):
    return 'Got a message:' + message

def root_call(func, message):
    print(func(message))

root_call(get_message, 'hello world')

# output
Got a message:hello world
```

这个例子中，我们就把函数 get_message() 以参数的形式，传入了函数 root_call() 中然后调用它。

### 在函数里定义函数

我们可以在函数里定义函数，也就是函数的嵌套。这里我同样举了一个例子：

```python
def fun(message):
    def get_message(message):
        print('Got a message: {}'.format(message))
    return get_message(message)

fun('hello world')

# output
Got a message: hello world
```

这段代码中，我们在函数 func() 里又定义了新的函数 get_message()，调用后作为 func() 的返回值返回。

### 函数的返回值是函数

函数的返回值也可以是函数对象（闭包），比如下面这个例子：

```python
def func_closure():
    def get_message(message):
        print('Got a message: {}'.format(message))
    return get_message

send_message = func_closure()
send_message('hello world')

# output
Got a message: hello world
```

这里，函数 func_closure() 的返回值是函数对象 get_message() 本身，之后，我们将其赋予变量 send_message，再调用 send_message(‘hello world’)

## 装饰器

### 简单的装饰器

我们可以先来看一个装饰器的简单例子：

```python
def my_decorator(func):
    def wrapper():
        print('wrapper of decorator')
        func()
    return wrapper

def greet():
    print('hello world')

greet = my_decorator(greet)
greet()

// output
wrapper of decorator
hello world
```

这段代码中，变量 greet 指向了内部函数 wrapper()，而内部函数 wrapper() 中又会调用原函数 greet()，因此，最后调用 greet() 时，就会先打印`'wrapper of decorator'`，然后输出`'hello world'`。

这里的函数 my_decorator() 就是一个装饰器，它把真正需要执行的函数 greet() 包裹在其中，并且改变了它的行为，但是原函数 greet() 不变。

事实上，上述代码在 Python 中有更简单、更优雅的表示：

```python
def my_decorator(func):
    def wrapper():
        print('wrapper of decorator')
        func()
    return wrapper

@my_decorator
def greet():
    print('hello world')

greet()
```

这里的`@`，我们称之为语法糖，`@my_decorator`就相当于前面的`greet=my_decorator(greet)`语句，只不过更加简洁。因此，如果你的程序中有其它函数需要做类似的装饰，你只需在它们的上方加上`@decorator`就可以了，这样就大大提高了函数的重复利用和程序的可读性。

### 带有参数的装饰器

你或许会想到，如果原函数 greet() 中，有参数需要传递给装饰器怎么办？

一个简单的办法，是可以在对应的装饰器函数 wrapper() 上，加上相应的参数，比如：

```python
def my_decorator(func):
    def wrapper(message):
        print('wrapper of decorator')
        func(message)

    return wrapper

# greet = my_decorator(greet)
@my_decorator
def greet(message):
    print(message)

greet('hello world')

// output
wrapper of decorator
hello world
```

不过，新的问题来了。如果我另外还有一个函数，也需要使用 my_decorator() 装饰器，但是这个新的函数有两个参数，又该怎么办呢？比如：

```python
@my_decorator
def celebrate(name, message):
    ...
```

事实上，通常情况下，我们会把`*args`和`**kwargs`，作为装饰器内部函数 wrapper() 的参数。`*args`和`**kwargs`，表示接受任意数量和类型的参数，因此装饰器就可以写成下面的形式：

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print('wrapper of decorator')
        func(*args, **kwargs)
    return wrapper
```

### 带有自定义参数的装饰器

其实，装饰器还有更大程度的灵活性。刚刚说了，装饰器可以接受原函数任意类型和数量的参数，除此之外，它还可以接受自己定义的参数。

举个例子，比如我想要定义一个参数，来表示装饰器内部函数被执行的次数，那么就可以写成下面这种形式：

```python
def repeat(num):
    def my_decorator(func):
        def wrapper(*args, **kwargs):
            for i in range(num):
                print('wrapper of decorator')
                func(*args, **kwargs)
        return wrapper
    return my_decorator

@repeat(4)
def greet(message):
    print(message)

greet('hello world')

// output
wrapper of decorator
hello world
wrapper of decorator
hello world
wrapper of decorator
hello world
wrapper of decorator
hello world
```

上面的代码也等价下面的：

```python
def repeat(num):
    def my_decorator(func):
        def wrapper(*args, **kwargs):
            for i in range(num):
                print('wrapper of decorator')
                func(*args, **kwargs)
        return wrapper
    return my_decorator

def greet(message):
    print(message)

closure = repeat(4)
greet = closure(greet)
# 上面二行代码可以用下面的一行代替
# greet = repeat(4)(greet)

greet('hello world')
```

### 原函数还是原函数吗？

现在，我们再来看个有趣的现象。还是之前的例子，我们试着打印出 greet() 函数的一些元信息：

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        func(*args, **kwargs)
    return wrapper

@my_decorator
def greet(message):
    print(message)

print(greet.__name__)
# output
wrapper

help(greet)
# output
Help on function wrapper in module __main__:
wrapper(*args, **kwargs)
```

你会发现，greet() 函数被装饰以后，它的元信息变了。元信息告诉我们“它不再是以前的那个 greet() 函数，而是被 wrapper() 函数取代了”。

为了解决这个问题，我们通常使用内置的装饰器`@functools.wrap`，它会帮助保留原函数的元信息（也就是将原函数的元信息，拷贝到对应的装饰器函数里）。

```python
import functools

def my_decorator(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print('wrapper of decorator')
        func(*args, **kwargs)
    return wrapper

# greet = my_decorator(greet)
@my_decorator
def greet(message):
    print(message)

print(greet.__name__)
// output
greet

help(greet)
// output
Help on function greet in module __main__:
greet(message)
```

### 类装饰器

前面我们主要讲了函数作为装饰器的用法，实际上，类也可以作为装饰器。类装饰器主要依赖于函数`__call_()`，每当你调用一个类的示例时，函数`__call__()`就会被执行一次。

我们来看下面这段代码：

```python
class Count:
    def __init__(self, func):
        self.func = func
        self.num_calls = 0

    def __call__(self, *args, **kwargs):
        self.num_calls += 1
        print('num of calls is: {}'.format(self.num_calls))
        return self.func(*args, **kwargs)

# 等价于 example = Count(example)
@Count
def example():
    print('hello world')

example()
# output
num of calls is: 1
hello world

example()
# output
num of calls is: 2
hello world
```

这里，我们定义了类 Count，初始化时传入原函数 func()，而`__call__()`函数表示让变量 num_calls 自增 1，然后打印，并且调用原函数。因此，在我们第一次调用函数 example() 时，num_calls 的值是 1，而在第二次调用时，它的值变成了 2。

### 装饰器的嵌套

回顾刚刚讲的例子，基本都是一个装饰器的情况，但实际上，Python 也支持多个装饰器，比如写成下面这样的形式：

```python
@decorator1
@decorator2
@decorator3
def func():
    ...
```

它的执行顺序从里到外，所以上面的语句也等效于下面这行代码：

```python
decorator1(decorator2(decorator3(func)))
```

这样，`'hello world'`这个例子，就可以改写成下面这样：

```python
def my_decorator1(func):
    def wrapper(*args, **kwargs):
        print('execute decorator1')
        func(*args, **kwargs)
    return wrapper

def my_decorator2(func):
    def wrapper(*args, **kwargs):
        print('execute decorator2')
        func(*args, **kwargs)
    return wrapper

# 等价于 greet = my_decorator1(my_decorator2(greet))
@my_decorator1
@my_decorator2
def greet(message):
    print(message)

greet('hello world')

#output，这些输出都是在 my_decorator1 输入的
execute decorator1
execute decorator2
hello world
```

## 装饰器用法实例

到此，装饰器的基本概念及用法就讲完了，接下来，将结合实际工作中的几个例子，带你加深对它的理解。

### 身份认证

首先是最常见的身份认证的应用。这个很容易理解，举个最常见的例子，你登录微信，需要输入用户名密码，然后点击确认，这样，服务器端便会查询你的用户名是否存在、是否和密码匹配等等。如果认证通过，你就可以顺利登录；如果不通过，就抛出异常并提示你登录失败。

再比如一些网站，你不登录也可以浏览内容，但如果你想要发布文章或留言，在点击发布时，服务器端便会查询你是否登录。如果没有登录，就不允许这项操作等等。

我们来看一个大概的代码示例：

```python
import functools
 
def authenticate(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        request = args[0]
        if check_user_logged_in(request): # 如果用户处于登录状态
            return func(*args, **kwargs) # 执行函数 post_comment() 
        else:
            raise Exception('Authentication failed')
    return wrapper
    
@authenticate
def post_comment(request, ...)
    ...
```

这段代码中，我们定义了装饰器 authenticate；而函数 post_comment()，则表示发表用户对某篇文章的评论。每次调用这个函数前，都会先检查用户是否处于登录状态，如果是登录状态，则允许这项操作；如果没有登录，则不允许。

### 日志记录

日志记录同样是很常见的一个案例。在实际工作中，如果你怀疑某些函数的耗时过长，导致整个系统的 latency（延迟）增加，所以想在线上测试某些函数的执行时间，那么，装饰器就是一种很常用的手段。

我们通常用下面的方法来表示：

```python
import time
import functools
 
def log_execution_time(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        res = func(*args, **kwargs)
        end = time.perf_counter()
        print('{} took {} ms'.format(func.__name__, (end - start) * 1000))
        return res
    return wrapper
    
@log_execution_time
def calculate_similarity(items):
    ...
```

这里，装饰器 log_execution_time 记录某个函数的运行时间，并返回其执行结果。如果你想计算任何函数的执行时间，在这个函数上方加上`@log_execution_time`即可。

### 输入合理性检查

再来看今天要讲的第三个应用，输入合理性检查。

在大型公司的机器学习框架中，我们调用机器集群进行模型训练前，往往会用装饰器对其输入（往往是很长的 json 文件）进行合理性检查。这样就可以大大避免，输入不正确对机器造成的巨大开销。

它的写法往往是下面的格式：

```python
import functools
 
def validation_check(input):
    @functools.wraps(func)
    def wrapper(*args, **kwargs): 
        ... # 检查输入是否合法
    
@validation_check
def neural_network_training(param1, param2, ...):
    ...
```

其实在工作中，很多情况下都会出现输入不合理的现象。因为我们调用的训练模型往往很复杂，输入的文件有成千上万行，很多时候确实也很难发现。

试想一下，如果没有输入的合理性检查，很容易出现“模型训练了好几个小时后，系统却报错说输入的一个参数不对，成果付之一炬”的现象。这样的“惨案”，大大减缓了开发效率，也对机器资源造成了巨大浪费。

### 缓存

最后，我们来看缓存方面的应用。关于缓存装饰器的用法，其实十分常见，这里我以 Python 内置的 LRU cache 为例来说明（如果你不了解 [LRU cache](https://en.wikipedia.org/wiki/Cache_replacement_policies#Examples)，可以点击链接自行查阅）。

LRU cache，在 Python 中的表示形式是`@lru_cache`。`@lru_cache`会缓存进程中的函数参数和结果，当缓存满了以后，会删除 least recenly used 的数据。

正确使用缓存装饰器，往往能极大地提高程序运行效率。为什么呢？我举一个常见的例子来说明。

大型公司服务器端的代码中往往存在很多关于设备的检查，比如你使用的设备是安卓还是 iPhone，版本号是多少。这其中的一个原因，就是一些新的 feature，往往只在某些特定的手机系统或版本上才有（比如 Android v200+）。

这样一来，我们通常使用缓存装饰器，来包裹这些检查函数，避免其被反复调用，进而提高程序运行效率，比如写成下面这样：

```python
@lru_cache
def check(param1, param2, ...) # 检查用户设备类型，版本号等等
    ...
```

## 总结

* 所谓的装饰器，其实就是通过装饰器函数，来修改原函数的一些功能，使得原函数不需要修改。

* python的装饰器的应用场景有点像AOP的应用场景，把一些常用的业务逻辑分离，提高程序可重用性，降低耦合度，提高开发效率。

## 参考资料

* 极客时间 [《Python核心技术与实战》](https://time.geekbang.org/column/intro/176)