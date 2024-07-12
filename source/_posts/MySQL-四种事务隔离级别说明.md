---
title: MySQL 四种事务隔离级别说明
top: false
cover: false
toc: true
mathjax: true
date: 2021-06-29 12:09:39
password:
summary: 彻底搞懂 MySQL 四种事务的隔离级别
tags:
- MySQL	
categories:
- MySQL	
---

# MySQL 四种事务隔离级别说明

## 前言

在 `MySQL` 中，为了保证并发读取数据的正确性，提出了四种事务隔离级别，下面我们就说明如何设置隔离级别，以及用示例来说明每种隔离级别的使用情况

## 操作

### 设置隔离级别

你可以在 `MySQL` 配置文件 `my.cnf` 的 `[mysqld]`节中设置如下选项来为所有连接设置默认的隔离级别

```bash
[mysqld]
transaction-isolation = {READ-UNCOMMITTED | READ-COMMITTED | REPEATABLE-READ | SERIALIZABLE}
```
如果未设置此选项，则 `InnoDB`默认是可重复读（`REPEATABLE-READ`）。

你也可以用 `set session`语句来改变单个会话或所有新进来连接的隔离级别。

语法如下：

```sh
set [session | global] transaction isolation level {read uncommitted | read committed | repeatable read | serializable}
```

- 如果使用 `global` 关键字，则表示在全局（多个 session中）对从那点开始创建的所有连接设置默认事务级别
- 如果使用 `session`关键字，则表示为将来在当前连接上执行的所有事务设置默认事务级别
- 不带`global`和`session`是为下一个（未开始）事务设置隔离级别

```sh
set session transaction isolation level read uncommitted;
```

上面的命令表示：为接下来在当前会话连接上执行的所有事务设置读未提交隔离级别

注意：使用`set` 命令来设置隔离级别的方式在 `MySQL` 重启后会恢复到配置文件中设置的隔离级别


### 查询隔离级别

- 查询全局的隔离级别

```sh
select @@global.tx_isolation;
```

- 查询一个会话的隔离级别

```sh
select @@session.tx_isolation;
```

- 查询一个事务的隔离级别

```sh
select @@tx_isolation;
```

### 四种隔离级别的示例

1. 各隔离级别会再现的问题

|隔离级别| 脏读|不可重复读|幻读|
|--------|------|---------|-----|
|读未提交|可能|可能|可能|
|读已提交|不可能|可能|可能|
|可重复读|不可能|不可能|可能|
|可串行化|不可能|不可能|不可能|

- 读未提交：该隔离级别下可能会出现 **脏读**，也就是可能会读取到其它会话中修改了但还未提交的数据
- 读已提交：该隔离级别解决了脏读问题，但可能会出现**不可重复读**
- 可重复读： 该隔离级别解决了不可重复读问题，但可能会出现**幻读**
- 可串行化：该隔离级别解决了幻读问题，它是完全串行化的读，每次读都需要获得表级共享锁，读写相互都会阻塞

2. 示例来说明每种隔离级别的使用情况

准备一张测试表，插入一些测试数据，然后开启两个`MySQL`终端，在此命令为`session1`和`session2`

```sh
CREATE TABLE `goods` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL DEFAULT '' COMMENT '商品名称',
  `stock` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '库存',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品';

insert into `goods` (`name`, `stock`) values 
('p1', '1000'),
('p2', '1000'),
('p3', '1000'),
('p4', '1000'),
('p5', '1000'),
('p6', '1000'),
('p7', '1000'),
('p8', '1000'),
('p9', '1000');
```

#### 脏读

脏读就是指当一个事务正在访问数据，并且对数据进行了修改，而这种修改还没有提交到数据库中，这时，另外一个事务也访问这个数据，然后使用了这个数据。

session1：

```sh
// 关闭自动提交，设置隔离级别为读未提交
mysql> set autocommit=0;
mysql> set session transaction isolation level read uncommitted;

// 确认
mysql> show variables like '%autocommit%';
+---------------+-------+
| Variable_name | Value |
+---------------+-------+
| autocommit    | OFF   |
+---------------+-------+

mysql> select @@session.tx_isolation;
+------------------------+
| @@session.tx_isolation |
+------------------------+
| READ-UNCOMMITTED       |
+------------------------+

// 开启事务，查询 id = 1 的记录

mysql> start transaction;

mysql> select * from goods where id=1;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |  1000 |
+----+------+-------+
1 row in set (0.01 sec)

mysql> select * from goods where id=1;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |  1000 |
+----+------+-------+
1 row in set (0.00 sec)
```

session2：

```sh
mysql> set autocommit=0;
mysql> set session transaction isolation level read uncommitted;

// 确认

// 开启事务，把 id = 1记录的库存更新至 1
mysql> start transaction;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from goods where id=1;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |  1000 |
+----+------+-------+
1 row in set (0.00 sec)

mysql> update goods set stock=1 where id=1;
Query OK, 1 row affected (0.00 sec)
Rows matched: 1  Changed: 1  Warnings: 0
```

session1：

```sh
mysql> select * from goods where id=1; 
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |     1 |
+----+------+-------+
```

**注意：** 这时 session1 读取到了 session2 未提交的内容，如果 session2 回滚刚才更新的数据，session1 读取到的数据就是错误的


#### 不可重复读

事务一一直读，事务二修改数据并提交，有可能就会出现事务一内两次读取到的数据不一样

session1：

```sh
// 取消自动提交，并设置隔离级别为读已提交
mysql> set autocommit=0;
mysql> set session transaction isolation level read committed;

// 确认
mysql> select @@session.tx_isolation;
+------------------------+
| @@session.tx_isolation |
+------------------------+
| READ-COMMITTED         |
+------------------------+

// 开启事务，查询 id=1 的记录
mysql> start transaction;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from goods where id=1;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |  1000 |
+----+------+-------+

```

session2：

```sh
// 取消自动提交，并设置隔离级别为读已提交
mysql> set autocommit=0;
mysql> set session transaction isolation level read committed;

// 确认
mysql> select @@session.tx_isolation;
+------------------------+
| @@session.tx_isolation |
+------------------------+
| READ-COMMITTED         |
+------------------------+

mysql> start transaction;
mysql> select * from goods where id=1;
mysql> update goods set stock=1 where id=1;
```

这时返回到 session1

session1：

```sh
mysql> select * from goods where id=1;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |  1000 |
+----+------+-------+
```

可以观察到在读已提交的隔离级别下，session1 没出现**脏读**。

继续返回到 session2 执行手动提交

session2：

```sh
mysql> commit;
Query OK, 0 rows affected (0.01 sec)
```

再返回到 session1 查看 id = 1的记录

session1：

```sh
mysql> select * from goods where id=1;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |     1 |
+----+------+-------+
```

**注意：** 在 session2 提交后，session1 连接两次读取到的数据不一致了，这就是**读已提交隔离级别可能会出现不可重复读的情况**

在演示幻读之前，我们先演示下**可重复读**

#### 可重复读

session1：

```sh
mysql> set autocommit=0;
mysql> set session transaction isolation level repeatable read;

mysql> select @@session.tx_isolation;
+------------------------+
| @@session.tx_isolation |
+------------------------+
| REPEATABLE-READ        |
+------------------------+

mysql> select * from goods where id=1;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |  1000 |
+----+------+-------+
```

session2：

```sh
mysql> set autocommit=0;
mysql> set session transaction isolation level repeatable read;

mysql> select @@session.tx_isolation;
+------------------------+
| @@session.tx_isolation |
+------------------------+
| REPEATABLE-READ        |
+------------------------+

mysql> start transaction;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from goods where id=1;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |  1000 |
+----+------+-------+
1 row in set (0.00 sec)

mysql> update goods set stock=1 where id=1;
Query OK, 1 row affected (0.00 sec)
Rows matched: 1  Changed: 1  Warnings: 0

mysql>  commit;
Query OK, 0 rows affected (0.00 sec)
```

再返回到 session1 查询 id=1 的记录

session1：

```sh
mysql> select * from goods where id=1;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |  1000 |
+----+------+-------+
```

可以观察到**在可重复读隔离级别下**，session1 连续多次读取的数据是一致的，也就是它是可重复读的

#### 幻读

两个事务彼此隔离，互相并不知道对方操作了什么，当第一个事务插入了一条数据并提交后，因为隔离级别是可重复读，在第二个事务里并不知道第一个事务已经插入了数据，所以第二个事务查询出来的数据还是没插入之前的，这时第二个事务再次插入数据时就可能会报数据已存在，以为自己出现了幻觉

session1：

```sh
mysql> set autocommit=0;
mysql> set session transaction isolation level repeatable read;

// 开启事务，插入数据并提交
mysql> start transaction;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from goods;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |     1 |
|  2 | p2   |  1000 |
|  3 | p3   |  1000 |
|  4 | p4   |  1000 |
|  5 | p5   |  1000 |
|  6 | p6   |  1000 |
|  7 | p7   |  1000 |
|  8 | p8   |  1000 |
|  9 | p9   |  1000 |
+----+------+-------+
9 rows in set (0.00 sec)

mysql> insert into goods(`name`,`stock`) values('p10', 1000);      
Query OK, 1 row affected (0.00 sec)

mysql> commit;
Query OK, 0 rows affected (0.00 sec)
```

切换到 session2 

session2：

```sh
mysql> set autocommit=0;
mysql> set session transaction isolation level repeatable read;

// 开启事务，查询后再插入
mysql> start transaction;

mysql> select * from goods;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |     1 |
|  2 | p2   |  1000 |
|  3 | p3   |  1000 |
|  4 | p4   |  1000 |
|  5 | p5   |  1000 |
|  6 | p6   |  1000 |
|  7 | p7   |  1000 |
|  8 | p8   |  1000 |
|  9 | p9   |  1000 |
+----+------+-------+
9 rows in set (0.00 sec)

mysql> insert into goods(`name`, `stock`) values('p10', 1000);     
ERROR 1062 (23000): Duplicate entry 'p10' for key 'uk_name'
```

#### SERIALIZABLE（可串行化）

在该隔离级别下事务都是串行顺序执行的，`MySQL` 数据库的 `InnoDB` 引擎会给读操作隐式加一把读共享锁，从而避免了脏读、不可重读复读和幻读问题。

session1：

```sh
mysql> set autocommit=0;
Query OK, 0 rows affected (0.00 sec)

mysql> set session transaction isolation level serializable;
Query OK, 0 rows affected (0.00 sec)

mysql> select @@session.tx_isolation;
+------------------------+
| @@session.tx_isolation |
+------------------------+
| SERIALIZABLE           |
+------------------------+
1 row in set (0.00 sec)

// 开启一个事务，插入一条数据但不提交
mysql> start transaction;
Query OK, 0 rows affected (0.00 sec)

mysql> insert into goods(`name`, `stock`) values('p10', 1000); 
Query OK, 1 row affected (0.00 sec)
```

切换到 session2 ，开启一个事务然后查询数据

session2：

```sh
mysql> set autocommit=0;
Query OK, 0 rows affected (0.00 sec)

mysql> set session transaction isolation level serializable;
Query OK, 0 rows affected (0.00 sec)

mysql> select @@session.tx_isolation;
+------------------------+
| @@session.tx_isolation |
+------------------------+
| SERIALIZABLE           |
+------------------------+
1 row in set (0.00 sec)

mysql> select * from goods; // 些时会一直卡住
```

立马切换到 session1，提交事务

session1：

```sh
mysql> commit;
```

再切换到 session2

```sh
mysql> select * from goods;
+----+------+-------+
| id | name | stock |
+----+------+-------+
|  1 | p1   |  1000 |
|  2 | p2   |  1000 |
|  3 | p3   |  1000 |
|  4 | p4   |  1000 |
|  5 | p5   |  1000 |
|  6 | p6   |  1000 |
|  7 | p7   |  1000 |
|  8 | p8   |  1000 |
|  9 | p9   |  1000 |
| 10 | p10  |  1000 |
+----+------+-------+
10 rows in set (1.12 sec)
```

session2 也有可能获取锁超时

```sh
mysql> select * from goods;
ERROR 1205 (HY000): Lock wait timeout exceeded; try restarting transaction
```

**注意：**　一旦事务提交，session2 会立马返回插入的记录，否则会一直卡住，直到超时，其中超时参数是由 `innodb_lock_wait_timeout` 控制。由于每条 `select`语句都会加锁，所以该隔离级别的数据库并发能力最弱

## 总结

四个级别逐渐增强，每个级别解决一个问题。事务级别越高，性能越差。`InnoDB`默认级别是可重复读。 