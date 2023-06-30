---
title: Java并发编程—理论基础总结
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2023-06-16 17:18:22
password:
summary: Java并发编程—理论基础总结
tags:
	- Java
	- 并发编程
categories: Java并发编程
---

到这里，专栏的第一模块——并发编程的理论基础，我们已经讲解完了，总共 12 篇，不算少，但“跳出来，看全景”你会发现这 12 篇的内容基本上是一个“串行的故事”。所以，在学习过程中，建议你从一个个单一的知识和技术中“跳出来”，看全局，搭建自己的并发编程知识体系。

为了便于你更好地学习和理解，下面我会先将这些知识点再简单地为你“串”一下，咱们一起复习下。

**那这个“串行的故事”是怎样的呢？**

起源是一个硬件的核心矛盾：CPU 与内存、I/O 的速度差异，系统软件（操作系统、编译器）在解决这个核心矛盾的同时，引入了可见性、原子性和有序性问题，这三个问题就是很多并发程序的 Bug 之源。这，就是 [Java并发编程—可见性、原子性和有序性问题：并发编程Bug的源头 ](https://zhangquan.me/2023/05/22/java-bing-fa-bian-cheng-ke-jian-xing-yuan-zi-xing-he-you-xu-xing-wen-ti-bing-fa-bian-cheng-bug-de-yuan-tou/)的内容。

那如何解决这三个问题呢？Java 语言自然有招儿，它提供了 Java 内存模型和互斥锁方案。所以，在 [Java并发编程—Java内存模型：看Java如何解决可见性和有序性问题](https://zhangquan.me/2023/05/23/java-bing-fa-bian-cheng-java-nei-cun-mo-xing-kan-java-ru-he-jie-jue-ke-jian-xing-he-you-xu-xing-wen-ti/) 我们介绍了 Java 内存模型，以应对可见性和有序性问题；那另一个原子性问题该如何解决？多方考量用好互斥锁才是关键，这就是 [Java并发编程—互斥锁（上）：解决原子性问题](https://zhangquan.me/2023/06/13/java-bing-fa-bian-cheng-hu-chi-suo-shang-jie-jue-yuan-zi-xing-wen-ti/)和[Java并发编程—互斥锁（下）：如何用一把锁保护多个资源？ ](https://zhangquan.me/2023/06/13/java-bing-fa-bian-cheng-hu-chi-suo-xia-ru-he-yong-yi-ba-suo-bao-hu-duo-ge-zi-yuan/)的内容。

虽说互斥锁是解决并发问题的核心工具，但它也可能会带来死锁问题，所以  [Java并发编程— 一不小心就死锁了，怎么办？](https://zhangquan.me/2023/06/14/java-bing-fa-bian-cheng-yi-bu-xiao-xin-jiu-si-suo-liao-zen-me-ban/) 就介绍了死锁的产生原因以及解决方案；同时还引出一个线程间协作的问题，这也就引出了 [Java并发编程—用“等待-通知”机制优化循环等待](https://zhangquan.me/2023/06/14/java-bing-fa-bian-cheng-yong-deng-dai-tong-zhi-ji-zhi-you-hua-xun-huan-deng-dai/) 这篇文章的内容，介绍线程间的协作机制：等待 - 通知。

你应该也看出来了，前六篇文章，我们更多地是站在微观的角度看待并发问题。而 [Java并发编程—安全性、活跃性以及性能问题 ](https://zhangquan.me/2023/06/15/java-bing-fa-bian-cheng-an-quan-xing-huo-yue-xing-yi-ji-xing-neng-wen-ti/)则是换一个角度，站在宏观的角度重新审视并发编程相关的概念和理论，同时也是对前六篇文章的查漏补缺。

[Java并发编程—管程：并发编程的万能钥匙 ](https://zhangquan.me/2023/06/15/java-bing-fa-bian-cheng-guan-cheng-bing-fa-bian-cheng-de-wan-neng-yao-chi/)介绍的管程，是 Java 并发编程技术的基础，是解决并发问题的万能钥匙。并发编程里两大核心问题——互斥和同步，都是可以由管程来解决的。所以，学好管程，就相当于掌握了一把并发编程的万能钥匙。

至此，并发编程相关的问题，理论上你都应该能找到问题所在，并能给出理论上的解决方案了。

而后在 [Java并发编程—Java线程（上）：Java线程的生命周期](https://zhangquan.me/2023/06/16/java-bing-fa-bian-cheng-java-xian-cheng-shang-java-xian-cheng-de-sheng-ming-zhou-qi/)、[Java并发编程—Java线程（中）：创建多少线程才是合适的？](https://zhangquan.me/2023/06/16/java-bing-fa-bian-cheng-java-xian-cheng-zhong-chuang-jian-duo-shao-xian-cheng-cai-shi-he-gua-de/)和 [Java并发编程—Java线程（下）：为什么局部变量是线程安全的？ ](https://zhangquan.me/2023/06/16/java-bing-fa-bian-cheng-java-xian-cheng-xia-wei-shi-me-ju-bu-bian-liang-shi-xian-cheng-an-quan-de/)我们又介绍了线程相关的知识，毕竟 Java 并发编程是要靠多线程来实现的，所以有针对性地学习这部分知识也是很有必要的，包括线程的生命周期、如何计算合适的线程数以及线程内部是如何执行的。

最后，在 [Java并发编程—如何用面向对象思想写好并发程序？](https://zhangquan.me/2023/06/16/java-bing-fa-bian-cheng-ru-he-yong-mian-xiang-dui-xiang-si-xiang-xie-hao-bing-fa-cheng-xu/) 我们还介绍了如何用面向对象思想写好并发程序，因为在 Java 语言里，面向对象思想能够让并发编程变得更简单。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20230616152347.png)

经过这样一个简要的总结，相信你此时对于并发编程相关的概念、理论、产生的背景以及它们背后的关系已经都有了一个相对全面的认识。至于更深刻的认识和应用体验，还是需要你“钻进去，看本质”，加深对技术本身的认识，拓展知识深度和广度。

## 参考资料

* 极客时间 王宝令[《Java并发编程实战》](https://time.geekbang.org/column/intro/100023901)