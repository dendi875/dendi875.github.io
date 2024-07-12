---
title: HBase 入门与 Shell 基本操作
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-07-09 09:47:58
password:
summary: HBase 入门与 Shell 基本操作
tags:
	- HBase
	- NoSQL
categories: HBase
---

## 简介

**HBase** 是一个开源的非关系型分布式数据库（NoSQL），它参考了谷歌的 BigTable 建模，实现的编程语言为Java。它是Apache软件基金会的Hadoop项目的一部分，运行于HDFS文件系统之上，为 Hadoop提供类似于BigTable 规模的服务。因此，它可以对稀疏文件提供极高的容错率。

HBase在列上实现了BigTable论文提到的压缩算法、内存操作和[布隆过滤器](https://zh.wikipedia.org/wiki/布隆过滤器)。HBase的表能够作为[MapReduce](https://zh.wikipedia.org/wiki/MapReduce)任务的输入和输出，可以通过Java API来访问数据，也可以通过REST、Avro 或者 Thrift 的API来访问。

在 Eric Brewer的[CAP理论](https://zh.wikipedia.org/wiki/CAP)中，HBase属于CP类型的系统。

## HBase 逻辑结构

HBase 可以用于存储多种结构的数据，以 JSON 为例，存储的数据为：

```json
{
    "row_key1": {
        "personal_info": {
            "name": "张三",
            "city": "北京",
            "phone": "131********"
        },
        "office_info": {
            "tel": "010-111111",
            "address": "上海"
        }
    },
    "row_key11": {
        "personal_info": {
            "city": "上海",
            "phone": "132********"
        },
        "office_info": {
            "tel": "010-222222"
        }
    },
    "row_key2": {
        "personal_info": {
            "name": "王五",
            "city": "广州"
        },
        "office_info": {
            "tel": "010-333333",
            "address": "上海"
        }
    }
}
```

存储数据稀疏，数据存储多维，不同的行具有不同的列。数据存储整体有序，按照RowKey的字典序排列，RowKey为Byte数组：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/struct.png)

## HBase 数据模型

在HBase中，数据存储在具有行和列的表中，这是与关系数据库类似的模型，但与之不同的是其具备结构松散、多维有序映射的特点，它的索引排序键由`行+列+时间戳`组成，HBase表可以被看做一个“**稀疏的、分布式的、持久的、多维度有序Map**”。

### [Namespace](https://hbase.apache.org/book.html#_namespace)（命名空间）

命名空间，类似于关系型数据库的 database 概念，每个命名空间下有多个表。HBase 两个自带的命名空间，分别是 `hbase` 和 `default`，hbase 中存放的是 HBase 内置的表，default 表是用户默认使用的命名空间。Namespace可以帮助用户在多租户场景下做到更好的资源和数据隔离。

### [Table](https://hbase.apache.org/book.html#_table)（表）

类似于关系型数据库的表概念。不同的是，HBase 定义表时只需要声明`列族`即可，不需要声明具体的列。因为数据存储是稀疏的，所有往 HBase 写入数据时，字段可以动态、按需指定。因此，和关系型数据库相比，HBase 能够轻松应对字段变更的场景。

### [Row](https://hbase.apache.org/book.html#_row)（行）

HBase 中的一行包含一个**行键（RowKey）**和一个或多个与其相关的值的**列（Column）**。在存储行时，行按字母顺序排序。出于这个原因，行键的设计非常重要。目标是以相关行相互靠近的方式存储数据。常用的行键模式是网站域。如果你的行键是域名，则你可能应该将它们存储在相反的位置（org.apache.www，org.apache.mail，org.apache.jira）。这样表中的所有Apache域都彼此靠近，而不是根据子域的第一个字母分布。

### [Column Family](https://hbase.apache.org/book.html#columnfamily)（列族）

HBase 中的列被分组为列族。 列族的所有列成员都具有相同的前缀。 例如，列 `personal_info:name` 和 `personal_info:city` 都是 `personal_info` 列族的成员。 冒号字符` (:) `将**列族**与**列族限定符（列名 ）**分隔开来。 列族前缀必须由可打印字符组成。 列族限定符，可以由任意字节组成。 **列族必须在模式定义时预先声明，而列不需要在模式时定义**，但可以在表启动和运行时即时创建。

由于性能原因，列族在物理上共同存在一组列和它们的值。在HBase中每个列族都有一组存储属性，例如其值是否应缓存在内存中，数据如何压缩或其行编码是如何编码的等等。表中的每一行都有相同的列族，但给定的行可能不会在给定的列族中存储任何内容。列族一旦确定后，就不能轻易修改，因为它会影响到HBase真实的物理存储结构，但是列族中的列标识（Column Qualifier）以及其对应的值可以动态增删。

### Column Qualifier（列族限定符）

列限定符被添加到列族中，以提供给定数据段的索引。例如：鉴于列族的content，列限定符可能是 content:html，而另一个可能是content:pdf。虽然列族在创建表时是固定的，但列限定符是可变的，并且在行之间可能差别很大。

### **Column**（列）

HBase 中的每个列都由一个 **Column Family（列族）**和一个 **Column Qualifier（列族限定符或叫列名）**组成，它们由冒号（:）字符分隔。例如 `personal_info:name`和`personal_info:city`。建表时，只需指明列族，而列限定符无需预先定义。

### **TimeStamp** （时间戳）

用于标识数据的不同版本（version），每条数据写入时，系统会自动为其加上该字段，其值为写入 HBase 的时间。

### [Cell](https://hbase.apache.org/book.html#_cells)（单元格）

单元格是**行、列族和列限定符的组合，并且包含值和时间戳，它表示值的版本**。由 `{rowkey, column Family:column Qualifier, timestamp}` 唯一确定HBase 中的一个单元格。单元格中的数据全部是字节码形式存储。

## **HBase Shell** **操作**

Shell的使用命令更多请参见[Apache HBase Shell介绍](https://hbase.apache.org/book.html#shell)。

### 进入和退出Shell环境

*   进入容器

    ```shell
    docker exec -it hbase-master /bin/bash
    ```

* 执行以下命令进入Shell环境：

  ```shell
  /opt/hbase-1.2.6/bin/hbase shell
  ```

* 执行以下命令退出Shell环境：

  ```shell
  quit
  ```

* 使用`help`命令查看基本命令和对应的使用方法：

  ```shell
  help
  ```

### **namespace**

* 创建命名空间

  使用特定的 help 语法能够查看命令如何使用：

  ```shell
  hbase(main):002:0> help 'create_namespace'
  Create namespace; pass namespace name,
  and optionally a dictionary of namespace configuration.
  Examples:
  
    hbase> create_namespace 'ns1'
    hbase> create_namespace 'ns1', {'PROPERTY_NAME'=>'PROPERTY_VALUE'}
  ```

  创建命名空间 bigdata：

  ```shell
  hbase(main):001:0> create_namespace 'bigdata'
  0 row(s) in 0.2100 seconds
  ```

* 查看所有的命名空间

  ```shell
  hbase(main):002:0> list_namespace
  NAMESPACE                                                                                                                      
  bigdata                                                                                                                        
  default                                                                                                                        
  hbase                                                                                                                          
  3 row(s) in 0.0220 seconds
  ```

### DDL

数据定义语句：

```shell
create: 用于创建一个表。
list: 用于列出HBase的所有表。
disable: 用于禁用表。
is_disabled: 用于验证表是否被禁用。
enable: 用于启用一个表。
is_enabled: 用于验证表是否已启用。
describe: 用于提供了一个表的描述。
alter: 用于改变一个表。
exists: 用于验证表是否存在。
drop: 用于从HBase中删除表。
```

* 创建表

  ```shell
  hbase(main):008:0> help 'create'
  ```

  在 bigdata 命名空间中创建表格 student，两个列族 info 和 msg。info 列族数据维护的版本数为 5 个，如果不写默认版本数为 1。

  ```shell
  hbase(main):003:0> create 'bigdata:student', {NAME => 'info', VERSIONS => 5}, {NAME => 'msg'}
  0 row(s) in 1.2750 seconds
  
  => Hbase::Table - bigdata:student
  ```

  如果创建表格只有一个列族，没有列族属性，可以简写。如果不写命名空间，使用默认的命名空间 default。

  ```shell
  hbase(main):004:0> create 'student1','info'
  0 row(s) in 1.2220 seconds
  
  => Hbase::Table - student1
  ```

* 查看表

  查看表有两个命令：list 和 describe

  查看所有的表名：

  ```shell
  hbase(main):005:0> list
  TABLE                                                                                                                          
  bigdata:student                                                                                                                
  student1                                                                                                                       
  test                                                                                                                           
  3 row(s) in 0.0180 seconds
  
  => ["bigdata:student", "student1", "test"]
  ```

  查看一个表的详情：

  ```shell
  hbase(main):009:0> describe 'bigdata:student'
  Table bigdata:student is ENABLED                                                                                               
  bigdata:student                                                                                                                
  COLUMN FAMILIES DESCRIPTION                                                                                                    
  {NAME => 'info', BLOOMFILTER => 'ROW', VERSIONS => '5', IN_MEMORY => 'false', KEEP_DELETED_CELLS => 'FALSE', DATA_BLOCK_ENCODIN
  G => 'NONE', TTL => 'FOREVER', COMPRESSION => 'NONE', MIN_VERSIONS => '0', BLOCKCACHE => 'true', BLOCKSIZE => '65536', REPLICAT
  ION_SCOPE => '0'}                                                                                                              
  {NAME => 'msg', BLOOMFILTER => 'ROW', VERSIONS => '1', IN_MEMORY => 'false', KEEP_DELETED_CELLS => 'FALSE', DATA_BLOCK_ENCODING
   => 'NONE', TTL => 'FOREVER', COMPRESSION => 'NONE', MIN_VERSIONS => '0', BLOCKCACHE => 'true', BLOCKSIZE => '65536', REPLICATI
  ON_SCOPE => '0'}                                                                                                               
  2 row(s) in 0.0280 seconds
  ```

* 修改表

  表名创建时写的所有和列族相关的信息，都可以后续通过 alter 修改，包括增加和删除列族。

  增加列族和修改信息都使用覆盖的方法：

  ```shell
  hbase(main):002:0>  alter 'student1', { NAME => 'f1', VERSIONS => 3 }
  Updating all regions with the new schema...
  0/1 regions updated.
  1/1 regions updated.
  Done.
  0 row(s) in 3.3610 seconds
  ```

  查看修改后的表：

  ```shell
  hbase(main):003:0> describe 'student1'
  Table student1 is ENABLED                                                                                                      
  student1                                                                                                                       
  COLUMN FAMILIES DESCRIPTION                                                                                                    
  {NAME => 'f1', BLOOMFILTER => 'ROW', VERSIONS => '3', IN_MEMORY => 'false', KEEP_DELETED_CELLS => 'FALSE', DATA_BLOCK_ENCODING 
  => 'NONE', TTL => 'FOREVER', COMPRESSION => 'NONE', MIN_VERSIONS => '0', BLOCKCACHE => 'true', BLOCKSIZE => '65536', REPLICATIO
  N_SCOPE => '0'}                                                                                                                
  {NAME => 'info', BLOOMFILTER => 'ROW', VERSIONS => '1', IN_MEMORY => 'false', KEEP_DELETED_CELLS => 'FALSE', DATA_BLOCK_ENCODIN
  G => 'NONE', TTL => 'FOREVER', COMPRESSION => 'NONE', MIN_VERSIONS => '0', BLOCKCACHE => 'true', BLOCKSIZE => '65536', REPLICAT
  ION_SCOPE => '0'}                                                                                                              
  2 row(s) in 0.0190 seconds
  ```

  删除 student1 表中`f1`列族： 

  ```shell
  hbase(main):005:0> alter 'student1', NAME => 'f1', METHOD => 'delete'
  Updating all regions with the new schema...
  1/1 regions updated.
  Done.
  0 row(s) in 2.4070 seconds
  ```

  或者：

  ```shell
  alter 'student1', 'delete' => 'f1'
  ```

* 删除表

  shell 中删除表格,需要先将表格状态设置为不可用。

  ```shell
  hbase(main):007:0> disable 'student1'
  0 row(s) in 2.2580 seconds
  ```

  ```shell
  hbase(main):008:0> drop 'student1'
  0 row(s) in 1.2510 seconds
  ```

### DML

数据操作语句：

```shell
put: 在指定的表/行/列中放置一个单元格值。
get: 用于取行或单元格的内容。
delete:用于删除表中的单元格值。
deleteall: 用于删除给定行的所有单元格。
scan: 用于扫描并返回表数据。
count: 用于计数并返回表中的行的数目。
truncate: 清空表中的数据，其内部实现是将指定的表下线、删除、重建，该操作会丢失Region分区
truncate_preserve：清空表中的数据，其内部实现是将指定的表下线、删除、重建，并且Region分区与旧表保留一致
```

* 写入数据

  格式：

  ```shell
  put '命令空间:表名', '行号', '列族:列名', '值'
  ```

  在 HBase 中如果想要写入数据，只能添加结构中最底层的 cell。可以手动写入时间戳指定 cell 的版本，推荐不写默认使用当前的系统时间。如果重复写入相同 rowKey，相同列的数据，会写入多个版本进行覆盖。

  ```shell
  hbase(main):010:0> put 'bigdata:student', '1001', 'info:name', 'zhangsan'
  ```

  ```shell
  hbase(main):011:0> put 'bigdata:student', '1001', 'info:name', 'lisi'
  ```

  ```shell
  hbase(main):012:0> put 'bigdata:student', '1001', 'info:age', '30'
  ```

* 读取数据

  读取数据的方法有两个：get 和 scan。

  get 最大范围是一行数据，也可以进行列的过滤，读取数据的结果为多行 cell。

  ```shell
  hbase(main):017:0> get 'bigdata:student', '1001'
  COLUMN                           CELL                                                                                          
   info:age                        timestamp=1672133429754, value=30                                                             
   info:name                       timestamp=1672133408519, value=lisi  
  ```

  进行列的过滤：

  ```shell
  hbase(main):018:0> get 'bigdata:student', '1001', {COLUMN => 'info:name'}
  COLUMN                           CELL                                                                                          
   info:name                       timestamp=1672133408519, value=lisi                                                           
  1 row(s) in 0.0070 seconds
  ```

  也可以修改读取 cell 的版本数，默认读取一个。最多能够读取当前列族设置的维护版本数。

  ```shell
  hbase(main):003:0* get 'bigdata:student', '1001', {COLUMN => 'info:name', VERSIONS => 5}
  COLUMN                           CELL                                                                                          
   info:name                       timestamp=1672133408519, value=lisi                                                           
   info:name                       timestamp=1672133380991, value=zhangsan   
  ```

  scan 是扫描数据，能够读取多行数据，不建议扫描过多的数据，推荐使用 startRow 和 stopRow 来控制读取的数据，默认范围左闭右开。

  ```shell
  hbase(main):006:0> scan 'bigdata:student',  {STARTROW => '1001', STOPROW =>'1002'} 
  ROW                              COLUMN+CELL                                                                                   
   1001                            column=info:age, timestamp=1672133429754, value=30                                            
   1001                            column=info:name, timestamp=1672133408519, value=lisi                                         
  1 row(s) in 0.0190 seconds
  ```

* 删除数据

  删除数据的方法有两个：delete 和 deleteall。

  delete 表示删除一个版本的数据，即为 1 个 cell，不填写版本默认删除最新的一个版本。

  ```shell
  hbase(main):007:0> delete 'bigdata:student', '1001', 'info:name'
  0 row(s) in 0.1800 seconds
  ```

  deleteall 表示删除所有版本的数据，即为当前行当前列的多个 cell。

  **执行命令会标记数据为要删除，不会直接将数据彻底删除，删除数据只在特定时期清理磁盘时进行**。

  ```shell
  hbase(main):010:0> deleteall 'bigdata:student', '1001', 'info:name' 
  0 row(s) in 0.0060 seconds
  ```

## 参考

* https://hbase.apache.org/
* https://learnhbase.wordpress.com/2013/03/02/hbase-shell-commands/