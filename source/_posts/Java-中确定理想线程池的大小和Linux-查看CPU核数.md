---
title: Java 中确定理想线程池的大小和Linux 查看CPU核数
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-06-15 16:03:59
password:
summary: Java 中线程池要设置多大
tags: Java，并发，线程池
categories: 线程池
---

## 一、前言

在进行 java 编程时经常会遇到这样的问题：我的线程池应该设置为多少？

如果线程池设置的过大，那么大量的线程将在相对很少的CPU和内存资源上发生竞争，这不仅会导致更高的内存使用量，而且还可能会耗尽资源。如果线程池设置的过小，那么将导致许多空闲的处理器无法执行工作，从而降低吞吐率。

下面我们就来聊一聊如果正确的设置线程池大小。

## 二、Linux 查看CPU核数

我们知道 Linux/UNIX 中一切皆文档，硬件信息也记录在文件中。可以通过`cat /proc/cpuinfo` 查看CPU详细信息。

下面是cpuinfo的信息

```bash
processor       : 0
vendor_id       : GenuineIntel
cpu family      : 6
model           : 85
model name      : Intel(R) Xeon(R) Platinum 8163 CPU @ 2.50GHz
stepping        : 4
microcode       : 0x1
cpu MHz         : 2499.992
cache size      : 33792 KB
physical id     : 0
siblings        : 2
core id         : 0
cpu cores       : 1
apicid          : 0
initial apicid  : 0
fpu             : yes
fpu_exception   : yes
cpuid level     : 13
wp              : yes
flags           : fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush mmx fxsr sse sse2 ss ht syscall nx pdpe1gb rdtscp lm constant_tsc rep_good nopl eagerfpu pni pclmulqdq ssse3 fma cx16 pcid sse4_1 sse4_2 x2apic movbe popcnt tsc_deadline_timer aes xsave avx f16c rdrand hypervisor lahf_lm abm 3dnowprefetch ibrs ibpb stibp fsgsbase tsc_adjust bmi1 hle avx2 smep bmi2 erms invpcid rtm mpx avx512f avx512dq rdseed adx smap avx512cd avx512bw avx512vl xsaveopt xsavec xgetbv1 spec_ctrl intel_stibp
bogomips        : 4999.98
clflush size    : 64
cache_alignment : 64
address sizes   : 46 bits physical, 48 bits virtual
power management:

processor       : 1
vendor_id       : GenuineIntel
cpu family      : 6
model           : 85
model name      : Intel(R) Xeon(R) Platinum 8163 CPU @ 2.50GHz
stepping        : 4
microcode       : 0x1
cpu MHz         : 2499.992
cache size      : 33792 KB
physical id     : 0
siblings        : 2
core id         : 0
cpu cores       : 1
apicid          : 1
initial apicid  : 1
fpu             : yes
fpu_exception   : yes
cpuid level     : 13
wp              : yes
flags           : fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush mmx fxsr sse sse2 ss ht syscall nx pdpe1gb rdtscp lm constant_tsc rep_good nopl eagerfpu pni pclmulqdq ssse3 fma cx16 pcid sse4_1 sse4_2 x2apic movbe popcnt tsc_deadline_timer aes xsave avx f16c rdrand hypervisor lahf_lm abm 3dnowprefetch ibrs ibpb stibp fsgsbase tsc_adjust bmi1 hle avx2 smep bmi2 erms invpcid rtm mpx avx512f avx512dq rdseed adx smap avx512cd avx512bw avx512vl xsaveopt xsavec xgetbv1 spec_ctrl intel_stibp
bogomips        : 4999.98
clflush size    : 64
cache_alignment : 64
address sizes   : 46 bits physical, 48 bits virtual
power management:
```

主要字段含义如下：

* vendor_id：供应商ID，如果处理器是Intel处理器，会包含Intel字符串
* processor：逻辑CPU的唯一标识符
* core id：每个内核的唯一标识符
* physical id：物理CPU的唯一标识符
* cpu cores：同一个物理CPU的核心的个数
* siblings：表示此物理CPU上可能支持或不支持超线程（HT）技术的逻辑CPU的数量（一个物理CPU有几个逻辑CPU）

需要注意：
1. 如果多个逻辑处理器具有相同的核心ID （core id）和物理ID（physical id），则系统支持超线程（HT）技术
2. 如果两个或多个逻辑CPU具有相同的物理id（physical id），但核心id（core id）不同，则这是一个多核处理器


### 2.1 查看物理CPU个数
物理计算机插槽上的CPU数量，也就是物理CPU的数量，可以统计非重复物理ID的数量，

查看方法
```bash
grep "physical id" /proc/cpuinfo | sort | uniq | wc -l
```

### 2.2 查看每个物理CPU中核心数

单个CPU可处理数据的芯片组数是CPU核心数，如双核、四核等。

查看方法
```bash
cat /proc/cpuinfo | grep "cpu cores" | uniq
```

### 2.3 查看逻辑CPU的个数

这个是我们的机器总的CPU的个数，也是```设置线程池大小的时候需要使用到的CPU的个数```。

注意　/proc/cpuinfo　文件中　```processor 0 – n``` 并不一定是逻辑CPU的实际数量。

通常，一个CPU会有多个核心。英特尔公司的超线程技术（Hyper-Threading）在逻辑上可以将CPU核心的数量增加一倍，所以逻辑CPU个数应该这样算：

CPU不支持超线程：

```bash
逻辑CPU个数 = 物理CPU个数 * 每个物理CPU中核心数
```

CPU支持超线程：

```bash
逻辑CPU个数 = 物理CPU个数 * 每个物理CPU中核心数 * 2
```

如果多个逻辑CPU具有相同的核心ID（core id）和物理（physical id），则系统支持超线程（HT）技术。

查看方法：
```bash
cat /proc/cpuinfo | grep "processor" | wc -l
```



## 三、设置线程池大小

线程池称为工作线程池。工作线程是一个接受任务、完成任务并再次返回线程池以接受另一个任务的线程。


线程池的大小主要取决于以下两个因素：

### 3.1 CPU核数（逻辑CPU的个数）

单核CPU将一次运行一个线程。如果是四核的，这意味着CPU中有四个核，而云或服务器的CPU中可能有多达个内核。

如果我们考虑超线程，那么单核CPU可以有多个处理器。

可以使用下面的 java 代码找到处理器的数量

```java
int poolSize = Runtime.getRuntime().availableProcessors();
```

### 3.2 任务类型

有两种类型的任务：

* CPU密集型：涉及数学计算的任务
* I/O密集型：通过网络调用（如数据库、web服务）与其他应用程序通信的阻塞任务


#### 3.2.1 CPU密集型

如果有一个CPU核心和一个线程正在运行，其中提交了两个任务。然后将一个任务提交给线程一，一旦完成，则提交另一个任务。提交两个任务之间不应有任何时间间隔，以实现CPU的最大利用率

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/cpu-bound.png)


#### 3.2.2 I/O密集型

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/io-bound.png)

通过网络调用与其他应用程序进行通信的任务，如web服务、数据库、外部缓存、微服务等。

在上图中，有1个线程，向其提交了1个任务。当此任务等待IO操作完成时，CPU将变为空闲状态。当IO调用返回响应时，它会再次开始工作，直到任务未完成。

在空闲时间内，我们可以再启动一个线程并使其运行，以实现CPU的最大利用率，并且线程1可以处于等待状态，直到从IO调用接收到输出。

因此，对于具有一个核心CPU的IO绑定任务，可以增加线程数，并获得CPU的最大利用率。


## 四、计算线程数以实现CPU利用率最优的公式

在设置线程池大小时，需要设置为：

* CPU密集型：逻辑CPU的个数 + 1 

$$
N_{cpu} + 1
$$

* I/O密集型：2 * 逻辑CPU的个数 + 1

$$
2 * N_{cpu} + 1
$$


这里 ```+1``` 的意义何在？

《Java并发编程实践》这么说：


> 计算密集型的线程恰好在某时因为发生一个页错误或者因其他原因而暂停，刚好有一个“额外”的线程，可以确保在这种情况下CPU周期不会中断工作。

所以 ```+1``` 其实是一个经验值。


## 五、参考资料

- [超线程（HT, Hyper-Threading)](https://zh.wikipedia.org/zh-cn/%E8%B6%85%E5%9F%B7%E8%A1%8C%E7%B7%92)
- [《Java并发编程实践》](https://book.douban.com/subject/10484692/)