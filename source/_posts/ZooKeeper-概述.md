---
title: ZooKeeper 概述
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2023-04-05 15:40:45
password:
summary: ZooKeeper 概述
tags:
	- Zookeeper
	- 分布式系统
categories: Zookeeper
---

# ZooKeeper 概述

## 什么是 Zookeeper ?


ZooKeeper 是一个分布式的，开放源码的分**布式应用程序协同服务**。

ZooKeeper 的设计目标是将那些复杂且容易出错的分布式一致性服务封装起来，构成一个高效可靠的原语集，并以一系列简单易用的接口提供给用户使用。

## ZooKeeper 发展历史

ZooKeeper 最早起源于雅虎研究院的一个研究小组。在当时，研究人员发现，在雅虎内部很多大型系统基本都需要依赖一个类似的系统来进行分布式协同，但是这些系统往往都存在分布式单点问题。

所以，雅虎的开发人员就开发了一个通用的无单点问题的分布式协调框架，这就是 ZooKeeper。ZooKeeper 之后在开源界被大量使用，下面列出了 3 个著名开源项目是如何使用 ZooKeeper：

* Hadoop：使用 ZooKeeper 做Namenode 的高可用。 

* HBase：保证集群中只有一个 master，保存 hbase:meta 表的位置，保存集群中的 RegionServer 列表。 

* Kafka：集群成员管理，controller 节点选举

## Zookeeper 应用场景

典型应用场景： 

* 配置管理（configurationmanagement） 

* DNS服务

* 组成员管理（groupmembership），如 HBase

* 各种分布式锁

ZooKeeper 适用于存储和协同相关的关键数据，**不适合用于大数据量存储**。