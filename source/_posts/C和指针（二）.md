---
title: C和指针（二）
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2021-12-09 19:37:40
password:
summary: 在 C 语言里关于数组指针、指针数组、函数指针、指针函数、typedef定义函数指针类型的介绍
tags:
	- C
	- 指针
	- 数组
categories:
	- C
---

------------------------

## 一、数组指针

数组指针就是指向数组的指针。首先它是一个指针，这个指针指向的是一个数组。

- 例子1

```c 
int calendar[12][31];
```
可以把calendar看成是一个有12个元素的数组，每个元素又是一个有着31个整型元素的数组。可以把calendar当作一个二维数组，也可以把它当作一维数组组成的一维数组。

- 例子2

```c
int calendar[12][31];
int (*monthp)[31] = calendar; // 等价于 int (*monthp)[31] = &calendar[0]; 
```
monthp是**数组指针**。它是一个指向拥有31个整型元素的数组的指针。monthp指向了数组calendar的第一个元素（保存了数组第一个元素的地址）。```*monthp```是一个佣有31个整型元素的数组（可以想象为```int a[31];```中的```a```）

比如新的一年开始时，需要对calendar数组进行清空。下面展示几种不同的实现方式。

- calendar.c

```c
int main(void)
{
	int calendar[12][31];

	int month;
	for (month = 0; month < 12; month++) {
		int day;
		for (day = 0; day < 31; day++) {
			calendar[month][day] = 0;
			// *(calendar[month] + day) = 0;
			// *(*(calendar + month) + day) = 0;
		}
	}

	return 0;
}
```

这是用数组取下标的方式。```calendar[month][day] = 0;```等价于```*(calendar[month] + day) = 0;```，也等价于```*(*(calendar + month) + day) = 0;```

- calendar2.c

```c
int main(void)
{
	int calendar[12][31];
	int (*monthp)[31];

	for (monthp = calendar; monthp < calendar + 12; monthp++) {
		int day;
		for (day = 0; day < 31; day++) {
			*(*monthp + day) = 0;
		}
	}

	return 0;
}
```

这是用**数组指针**的方式来遍历数组calendar。
其中```for```语句中的```monthp = calendar; monthp < calendar + 12; monthp++```可以换成```monthp = &calendar[0]; monthp < &calendar[0] + 12; monthp++```。

- calendar3.c

```c
int main(void)
{
	int calendar[12][31];
	int (*monthp)[31];

	for (monthp = calendar; monthp < calendar + 12; monthp++) {
		int *dayp;
		for (dayp = *monthp; dayp < *monthp + 31; dayp++) {
			*dayp = 0;
		}
	}

	return 0;
}

```

像用指针的方式遍历一维数组那样，用指针来遍历```*monthp```。
内层的```for```语句中的```dayp = *monthp; dayp < *monthp + 31; dayp++```可以换成```dayp = &(*monthp)[0]; dayp < &(*monthp)[0] + 31; dayp++```，也可以换成```dayp = *monthp; dayp < &(*monthp)[31]; dayp++```


## 二、指针数组

指针数组它的类型是一个数组，数组中每个元素是一个指针。

我们用一个**二维字符数组**来说明下，C中的字符串可以当作以```NULL```字符结尾的**一维字符数组**，如下面的例子

- 一维字符数组

```c
char message[] = "hello";
char message[] = {'h', 'e', 'l', 'l', 'o', '\0'};
```
这两种写法是等价的。但与```char *message = "hello";```还是有区别的，
```char message[]```声明message是一个**数组**，```char *message```声明message是一个**指针**。

- 二维字符数组

```c
const char keyword[][9] = {
	{'a', 'u', 't', 'o', '\0',  '\0',  '\0',  '\0', '\0'},
	{'s', 't', 'a', 't',  'i',   'c',  '\0',  '\0', '\0'},
	{'e', 'x', 't', 'e',  'r', 	 'n',  '\0',  '\0', '\0'},
	{'r', 'e', 'g', 'i',  's',   't',   'e',   'r', '\0'},
	{'c', 'o', 'n', 's',  't',  '\0',  '\0',  '\0', '\0'},
	{'r', 'e', 's', 't',  'r',   'i',   'c',   't', '\0'},
	{'v', 'o', 'l', 'a',  't',   'i',   'l',   'e', '\0'},
};
```

```c
const char keyword[][9] = {
	"auto",
	"static",
	"extern",
	"register",
	"const",
	"restrict",
	"volatile"
};
```

上面这两种写法也是等价的，它们都可以当作**二维字符数组**，数组中每个元素是一个一维字符数组，或者每个元素以字符串的方式存储在数组中。

- 指针数组

```c
#include <stdio.h>

int main(void)
{
	const char *keyword[] = {
		"auto",
		"static",
		"extern",
		"register",
		"const",
		"restrict",
		"volatile",
		NULL
	};

	const char **kwp;

	for (kwp = keyword; *kwp != NULL; kwp++) {
		printf("%s\n", *kwp);
	}

	return 0;
}
```

这种声明方式表示keyword是个数组，数组中每个元素是一个指向字符的指针。所以keyword是**指针数组**。它比**二维字符数组**声明方式更节约内存，特意数组最后加一个```NULL```指针，是为了可以在遍历是不需要知道数组的长度。


## 三、函数指针

函数指针就是指向函数的指针。它是一个指针，这个指针指向的是一个函数。

- pf.c

```c
#include <stdio.h>

int f(int, int);

int main(void)
{
	/* 声明函数指针并初始化 */
	int (*pf)(int, int) = f;	// 或者 int (*pf)(int, int) = &f;

	int result;
    
    /* 三种方式调用函数 */
	result = (*pf)(1, 2);
	result = pf(1, 2);
	result = f(1, 2);

	printf("result = %d\n", result);

	return 0;
}

int f(int x, int y)
{
	return x + y;
}
```

上面的例子是```pf```就是一个函数指针，这个指针指向的是一个函数，这个函数需要满足有两个整型参数，返回值是整型。关于函数指针需要注意：

1）声明一个函数指针并不意味着它马上可以使用。和其它指针一样，对函数指针执行间接访问之前必须它把初始化为指向某个函数。

2）在函数指针初始化之前具有```f```的原型是很重要的，否则编译器就无法检查```f```的类型是否与```pf```所指向的类型一致（参数的个数、参数的类型、返回值的类型）

3）上面三种函数调用方式是等价的，```pf```是指向函数的指针，```(*pf)```就是```pf```所指向的那个函数。```(*pf)()```调用方式相比于```pf()```调用方式能提醒程序员```pf```是个函数指针而不是函数名。

提示：

函数它也像变量一样占用内存单元，所以每个函数都有一个地址，就像每个变量都有地址一样。C语言把指向函数的指针当作指向其它数据类型的指针一样对待，可以把它存储到变量中，或者可以当作数组的元素，或者作为结构或联合的成员，或者可以当前函数的参数或返回值。

- 函数指针的用途**回调函数**

```c
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>

struct node {
	int value;
	struct node *next;
};

struct node *add_to_list(struct node *, int);
struct node *search_list(struct node *, const void *, int (*compare)(const void *, const void *));
int compare_ints(const void *p, const void *q);

int main(void)
{
	struct node *first = NULL;
	struct node *p;
	int expected_value = 20;

	first = add_to_list(first, 10);
	first = add_to_list(first, 20);
	first = add_to_list(first, 30);

	p = search_list(first, &expected_value, compare_ints);
	if (p != NULL) {
		printf("Node value：%d\n", p->value);
	} else {
		printf("Node not found.\n");
	}

	return 0;
}

/**
 * 在链表开始处插入一个结点
 *
 * @param  first 	指向旧链表首结点的指针
 * @param  value    需要存储到新结点的值
 * @return new_node 返回指向新结点的指针
 */
struct node *add_to_list(struct node *first, int value)
{
	struct node *new_node;

	new_node = malloc(sizeof(struct node));
	if (new_node == NULL) {
		perror("malloc error");
		exit(EXIT_FAILURE);
	}
	new_node->value = value;
	new_node->next = first;

	return new_node;
}

/**
 * 在一个单向链表中查找一个指定的值，第一个参数是指向链表首结点的指针，
 * 第二个参数是需要查找的值，第三个参数是函数指针。
 * 这个函数查找存在结点中的值与类型无关，可以查找整型，字符串等
 */
struct node *search_list(struct node *first, const void *value,
						int (*compare)(const void *, const void *))
{
	struct node *p;

	for (p = first; p != NULL; p = p->next) {
		if (compare(&p->value, value) == 0) {
			return p;
		}
	}

	return NULL;
}

int compare_ints(const void *p, const void *q)
{
	if (*(int *) p < *(int *)q) {
		return -1;
	} else if (*(int *) p == *(int *) q) {
		return 0;
	} else {
		return 1;
	}
}
```

## 四、指针函数

指针函数就是返回值为指针的函数。

- max.c 
```c
#include <stdio.h>

int *max(int *, int *);

int main(void)
{
	int *p, x = 10, y = 20;

	p = max(&x, &y);
	printf("max = %d\n", *p);

	return 0;
}

int *max(int *x, int *y)
{
	if (*x > *y) {
		return x;
	} else {
		return y;
	}
}
```
max函数就是一个指针函数，它返回值的类型是一个指向整型的指针。

max函数还可以返回指向外部变量的指针

```c
#include <stdio.h>

int z = 30;

int *max(int *, int *);

int main(void)
{
	int x = 10, y = 20;

	printf("%d\n", *max(&x, &y));

	return 0;
}

int *max(int *x, int *y)
{
	return &z;
}
```

max函数还可以返回指向函数内部声明为```static```变量的指针。

```c
#include <stdio.h>

int *max(int *, int *);

int main(void)
{
	int x = 10, y = 20;

	printf("%d\n", *max(&x, &y));

	return 0;
}

int *max(int *x, int *y)
{
	static int s = 50;

	return &s;
}
```

## 五、typedef定义函数指针类型

可以用```typedef```来**定义函数指针**，然后简化一些复杂的定义。比如C中的的信号处理函数

```c
void (*signal(int signum, void (*func)(int)))(int);
```

用```typedef```定义函数指针，简化上面的定义

```C
typedef void (*sighandler_t)(int);

sighandler_t signal(int signum, sighandler_t handler);
```

typedef定义函数指针类型的一个例子

```C
#include <stdio.h>

typedef double (*ptrfun)(double, double);

double add(double x, double y);

int main(void)
{
	ptrfun pf = add;

	printf("%f\n", (*pf)(3.1415, 1.1111));

	return 0;
}

double add(double x, double y)
{
	return x + y;
}
```

```ptrfun```是自定义的数据类型，可以像其它数据类型一样用来定义变量，或定义函数的返回值，或定义函数参数等，只不过```ptrfun```定义的变量是**指向函数的指针类型**。可以理解为像```int *```定义的变量是指向整型的指针类型一样。

```c
int *p;
```

```ptrfun```和```int *```类似都是指向某种类型的指针。一个是指向函数的指针，一个是指针整型的指针。



## 六、typedef定义函数类型

可以用typedef来**定义函数**，然后简化一些复杂的定义。比如C中的信号处理函数```signal```

```c
void (*signal(int signum, void (*func)(int)))(int);
```

用```typedef```定义函数，来简化上面的定义

```c
typedef void Sigfunc(int);
Sigfunc *signal(int signum, Sigfunc *func);
```


typedef定义函数类型的一个例子

```c
#include <stdio.h>

typedef double Fun(double, double);

double add(double, double);

int main(void)
{
	Fun *pf = add;

	printf("%f\n", pf(3.1415, 1.1111));

	return 0;
}

double add(double x, double y)
{
	return x + y;
}
```

注意：```Fun pf = add;```这是错误的，因为```add```是**函数指针**，而Fun的类型是**函数**;

使用```typedef```定义的Fun是函数。可以把它理解成像定义了整型一样：

```c
typedef int int_t;
```

用```Fun```来定义指针变量和用```int_t```来定义指针变量一样都要加```*```号。

```c
int_t *pi;
Func *pf;
```