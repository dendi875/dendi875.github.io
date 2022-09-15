---
title: C 语言中对链表的简单操作
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2021-12-09 20:14:13
password:
summary: C 语言中对链表的简单操作
tags:
	- C
	- 链表
categories:
	- C
---

------------------------

### 一、链表

链表（linked list）就是一个或多个节点的集合。链表中的每个节点通过指针连接在一起。程序通过指针访问链表中的节点。

### 二、单链表

在单链表中，每个节点包含一个指向链表下一个节点的指针。链表的最后一个节点的指针字段值为`NULL`，表示链表后面不再有其他节点。

在你找到链表的第1个节点后，指针就可以带你访问剩余所有节点。为了记住链表的起始位置，可以使用一个根指针（root pointer）。根指针指向链表的第一个节点。

### 三、单链表操作

以下所有例子中的节点的类型定义我们放在**node.h**，内容如下：

```c
#ifndef _NODE_H
#define _NODE_H

typedef struct NODE {
        struct NODE *link;
        int             value;
} Node;
#endif /* _NODE_H */
```

#### 向单链表表头插入节点

我们简单的实现一个向链表表头插入节点的程序

例子：node.c
```c
#include <stdio.h>
#include <stdlib.h>
#include "node.h"

int main(int argc, char **argv)
{
	/* 定义两个指向节点的指针变量 */
	Node *root = NULL; 	/* 指向第一个节点的根指针 */
	Node *new;			/* 指向动态分配内存的节点指针 */

	/* 动态分配内存，创建新结点 */
	new = malloc(sizeof(Node));
	if (new == NULL) {
		printf("malloc failed.\n");
		exit(EXIT_FAILURE);
	}

	/* 给新结点成员 value 赋值 */
	new->value = 5;

	/* 我们只是简单地向链表表头插入新节点 */
	new->link = root;
	root = new;

	/* 再插入一个节点 */
	new = malloc(sizeof(Node));
	if (new == NULL) {
		printf("malloc failed.\n");
		exit(EXIT_FAILURE);
	}
	new->value = 10;
	new->link = root;
	root = new;

	/* 遍历链表 */
	Node *current = root;
	while (current != NULL) {
		printf("%d\n", current->value);
		current = current->link;
	}

	exit(0);
}

```

运行结果
```shell
[dendi875@192 list]$ ./node
10
5
```

向链表中插入节点这种操作是经常被使用的，我们把上述步骤封装成一个函数

例子：node2.c

```c
#include <stdio.h>
#include <stdlib.h>
#include "node.h"

static Node *insert(Node *root, int n);
static void pr_list(Node *root);

int main(int argc, char **argv)
{
	Node *root = NULL; 	/* 指向第一个节点的根指针 */

	root = insert(root, 5);
	root = insert(root, 10);
	root = insert(root, 15);

	pr_list(root);

	exit(0);
}

/**
 * 向链表的表头插入节点
 *
 * 第一个参数是指向链表首节点的指针
 * 第二个参数是新节点中 value 成员的值
 * 如果插入成功返回指向新链表首节点的指针
 */
static Node *insert(Node *root, int n)
{
	Node *new;

	new = malloc(sizeof(Node));
	if (new == NULL) {
		printf("malloc failed in insert.\n");
		exit(EXIT_FAILURE);
	}
	new->value = n;
	new->link = root;

	return new;
}

/**
 * 遍历链表
 */
static void pr_list(Node *current)
{
	while (current != NULL) {
		printf("%d\n", current->value);
		current = current->link;
	}
}
```

运行结果
```shell
[dendi875@192 list]$ ./node2
15
10
5
```

#### 从单链表中删除一个节点

我们简单的实现一个指定一个 `value`值，从链表中删除第一个包含该值的节点，返回删除后的新链表

例子：node3.c
```c
#include <stdio.h>
#include <stdlib.h>
#include "node.h"

static Node *insert(Node *root, int n);
static void pr_list(Node *root);
static Node *delete(Node *root, int n);

int main(int argc, char **argv)
{
	Node *root = NULL; 	/* 指向第一个节点的根指针 */

	root = insert(root, 1);
	root = insert(root, 5);
	root = insert(root, 10);
	root = insert(root, 15);
	root = insert(root, 25);

	root = delete(root, 1);
	root = delete(root, 25);
	root = delete(root, 10);
	pr_list(root);

	exit(0);
}

/**
 * 向链表的表头插入节点
 *
 * 第一个参数是指向链表首节点的指针
 * 第二个参数是新节点中 value 成员的值
 * 如果插入成功返回指向新链表首节点的指针
 */
static Node *insert(Node *root, int n)
{
	Node *new;

	new = malloc(sizeof(Node));
	if (new == NULL) {
		printf("malloc failed in insert.\n");
		exit(EXIT_FAILURE);
	}
	new->value = n;
	new->link = root;

	return new;
}

/**
 * 遍历链表
 */
static void pr_list(Node *current)
{
	while (current != NULL) {
		printf("%d\n", current->value);
		current = current->link;
	}
}

/**
 * 指定一个 n 值，从链表中删除第一个包含该值的节点，返回删除后的新链表
 */
static Node *delete(Node *root, int n)
{
	Node *current, *previous;

	current = root;
	previous = NULL;

	while (current != NULL && current->value != n) {
		previous = current;
		current = current->link;
	}

	if (current == NULL) {	/* 链表中没有一个节点的 value 值等于n */
		return root;
	} else if (previous == NULL) {	/* 链表中第一个节点的 value值就等于n */
		root = current->link;
	} else {	/* 其它位置找到了这样的节点 */
		previous->link = current->link;
	}

	free(current);

	return root;
}
```

运行结果
```shell
[dendi875@192 list]$ ./node3             
15
5
```

