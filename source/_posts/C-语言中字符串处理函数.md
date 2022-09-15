---
title: C 语言中字符串处理函数
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2021-12-09 20:11:41
password:
summary: 介绍了 C 语言中常用的容易出错的字符串处理函数
tags:
	- C
categories:
	- C
---

------------------------

## 一、字符串基础

* 字符串可以当作以**空字符**结尾的字符数组。

空字符：一个所有位都为0的字节，因此用转义序列```\0```来表示。注意不要混淆空字符```'\0'```和零字符```'0'```。空字符的```ASCII```值为```0```，而零字符的码值为```48```。

* 字符串长度就是它所包含的字符个数但不包括**空字符**
* 字符串常量是用一对引号括起来的字符序列，在程序执行过程中保持不变的数据
* 字符串变量可以在程序运行过程中发生改变

## 二、字符串处理函数

### 计算字符串长度

库函数```strlen```的原型如下：

```size_t strlen(const char *s);```

注意strlen返回一个类型为size_t的值，这个类型是一个无符号整数类型。在表达式中使用无符号数可能导致不可预料的结果。例如，下面两个表达式看上去是相等的：

```c
if (strlen(x) >= strlen(y)) ...
if (strlen(x) - strlen(y) >= 0) ...
```
但事实上它们是不相等的。第一条语句将按照预想的那样工作，但第2条语句的结果将永远是真值。strlen的结果是个无符号数，所以操作符```>=```左边的表达式也将是无符号数，而无符号数绝不可能是负的。

### 不受限制的字符串函数

* 复制字符串

``` char *strcpy(char *dest, const char *src);```

这个函数把参数src字符串复制到dest参数。如果参数src和dest在内在中出现重叠，其结果是未定义的。由于dst参数将进行修改，所以它必须是个字符数组或一个指向动态分配内存的数组的指针，**不能使用字符串常量**。

例子：
```c
#include <stdio.h>
#include <string.h>

int main(void)
{
    char message[]= "Original message";
    strcpy(message, "Different");
    
    printf("message = %s\n", message);
    return 0;
}
```

运行结果
```
message = Different
```

数组```message```将包含下面的内容
```
char message[] = {'D', 'i', 'f', 'f', 'e', 'r', 'e', 'n', 't', '\0', 'e', 's', 's', 'a', 'g', 'e', '\0'};
```
第一个**空字符**后面的几个字符再也无法被字符串函数访问，从现实的角度看，它们已经是丢失的了。


* 连接字符串

``` char *strcat(char *dest, const char *src);```

要想把一个字符串添加（连接）到另一个字符串后面，可以使用```strcat```函数。

函数```strcat```要求```dest```参数原先已经包含一个空字符（可以是空字符串）。它找到这个字符串的未尾，并把```src```字符串的一份拷贝添加到这个位置。

例子：

```c
#include <stdio.h>
#include <string.h>

int main(void)
{
    char message[100];
    
    strcpy(message, "hello ");
    strcat(message, "string");

    printf("message = %s\n", message);

    return 0;
}
```

运行结果：
```c
message = hello string
```

* 比较字符串

```int strcmp(const char *s1, const char *s2);```

比较两个字符串时涉及对两个字符串对应的字符逐个比较，直到发现不匹配为止。采用的是**字典比较**，如果```s1```小于```s2```，返回一个小于零的值。如果```s1``` 大于```s2```，返回一个大于零的值，如果两个字符串相等，返回零。

例子：
```c
if (strcmp(a, b)) ...
```
这种写法是错误的，如果想要比较两个字符串相等，应该把返回值与零进行比较。


### 长度受限的字符串函数

```
char *strncpy(char *dest, const char *src, size_t n);
char *strncat(char *dest, const char *src, size_t n);
int strncmp(const char *s1, const char *s2, size_t n);
```

这些函接受一个显式的长度参数，用于限定进行复制或连接或比较的字符数。这些函数提供了一种方便的机制，可以防止难以预料的长字符串从它们的目标数组溢出。

### 字符串查找函数

* 查找一个字符

```c
char *strchr(const char *s, int c);
char *strrchr(const char *s, int c);
```

函数```strchr```在字符串s中查找字符c第1次出现的位置，找到后函数返回一个指向该位置的指针。如果该字符并不存在字符串中，函数就返回一个```NULL```指针。

例子：

```c
#include <stdio.h>
#include <string.h>

int main(void)
{
    char *p, str[] = "Form follows function.";
    p = strchr(str, 'f'); /* finds first 'f' */
    
    printf("p = %s\n", p); 
    return 0;
}
```

执行结果：
```c
p = follows function.
```


函数```strrchr```和```strchr```类似，但它会反向搜索字符。

例子：

```c
#include <stdio.h>
#include <string.h>

int main(void)
{
    char *p, str[] = "Form follows function.";
    p = strrchr(str, 'f'); /* finds last 'f' */
    
    printf("p = %s\n", p); 
    return 0;
}
```

执行结果：

```c
p = function.
```

* 查找任何几个字符 

```c
char *strpbrk(const char *s, const char *accept);
```

函数```strpbrk```它并不查找某个特定的字符，而是查找任何一组字符第1次在字符串中出现的位置，它返回一个指向```s```中第一个匹配```accept```中任何一个字符的字符位置。

例子：

```c
#include <string.h>

int main(void)
{
    char *p, str[] = "Form follows function.";
    p = strpbrk(str, "mn"); 
    
    printf("p = %s\n", p); 
    return 0;
}
```

执行结果：

```c
p = m follows function.
```

* 查找一个子串

```
char *strstr(const char *haystack, const char *needle);
```

函数```strstr```在第一个参数中查找第二个参数第1次出现的起始位置，并返回一个指向该位置的指针。如果```needle```并没有完整地出现在```haystack```的任何地方，函数将返回```NULL```，如果第二个参数是一个空字符串，函数就返回```haystack```。

例子：

```c
#include <stdio.h>
#include <string.h>

int main(void)
{
    char *p, str[] = "Form follows function.";
    p = strstr(str, "fun");
    
    printf("p = %s\n", p); 
    return 0;
}
```

执行结果：

```c
p = function.
```

* 查找一个字符串前缀

```c
size_t strspn(const char *s, const char *accept);
size_t strcspn(const char *s, const char *reject);
```

函数```strspn```返回字符串中第一个**不属于**该组字符的**字符的下标**。```strcspn```函数返回第一个**属于**该组字符的**字符的下标**。

例子：

```c
size_t n;
char *p, str[] = "Form follows function.";

n = strspn(str, "Form");    /* n = 4 */ 
n = strspn(str, " \t\n");   /* n = 0 */
n = strcspn(str, "Form");   /* n = 0 */
n = strcspn(str, " \t\t");  /* n = 4 */
```

* 查找标记

```c
char *strtok(char *str, const char *delim);
```

函数```strtok```目的是在字符串中搜索一个**记号**（就是一系列不包含特定分隔字符的字符）。调用```strtok(s1, s2)```它会在```s1```中搜索不包含在```s2```中的非空字符序列。```strtok```函数会在记号末尾的字符后面存储一个空字符作为**标记**，然后返回一个指针指向记号的首字符。

strtok函数最有用的特点是以后可以调用strtok函数在同一字符串中搜索更多的记号。调用```strtok(NULL, s2)```就可以继续上一次的strtok函数调用。和上一次调用一样，strtok函数会用一个空字符来标记新的记号的末尾，然后返回一个指向新记号的首字符的指针。这个过程可以持续进行，直到strtock函数返回空指针，这表明找不到符合要求的记号。

一个提取年月日的例子：

```c
#include <stdio.h>
#include <string.h>

int main(void)
{
    
    char *month, *day, *year;
    char str[] = " April  28,1998"; /* 月与日之间以空格或制表符分隔，逗号之前可能有空格或制表符 */
    
    month = strtok(str, " \t");
    day = strtok(NULL, " \t,");
    year = strtok(NULL, " \t");

    printf("month = %s, day = %s, year = %s\n", month, day, year);
    printf("str = %s\n");
    
    return 0;
}
```

执行结果：

```c
month = April, day = 28, year = 1998
str = April
```

## 三、内存操作函数

*  ```void *memcpy(void *dest, const void *src, size_t n);```

函数```memcpy```从src的起始位置复制n个字节到dest的内存起始位置。可以用该函数复制任何类型的值，如果src和dest内存出现了重叠则结果是未定义的。

例子：

```c
#include <stdio.h>
#include <string.h>

#define SIZE 5

int main(void)
{
    int a[SIZE], b[] = {1, 2, 3, 4, 5}, *p; 
    
    memcpy(a, b, sizeof(b));    

    for (p = a; p < a + SIZE; p++) {
        printf(" %d", *p);
    }   
    fputc('\n', stdout);

    return 0;
}
```

执行结果：
```c
 1 2 3 4 5
```


* ```void *memmove(void *dest, const void *src, size_t n);```

函数memmove功能与memcpy相同，但它能够正确处理源参数和目标参数内存出现重叠的情况。

例子：

```c
#include <stdio.h>
#include <string.h>

#define SIZE 5

int main(void)
{
    int a[SIZE] = {1, 2, 3, 4, 5}, *p; 
    
    memmove(a, a + 1, (SIZE - 1) * sizeof(a[0]));   

    for (p = a; p < a + SIZE; p++) {
        printf(" %d", *p);
    }   
    fputc('\n', stdout);

    return 0;
}
```

执行结果：
```c
 2 3 4 5 5
```

* ```int memcmp(const void *s1, const void *s2, size_t n);```

函数memcmp对两段内存的内容进行比较，这两段内存分别起始于s1和s2，共比较n个字节。这些值按照无符号字符逐个字节进行比较，函数返回类型与strcmp一样。由于这些值是根据一串无符号字节进行比较的，所以如果memcmp函数用于比较不是单字节的数据（如整数或浮点数）就可能会现出不可预料的结果。

* ```void *memchr(const void *s, int c, size_t n);```

函数memchr从s的起始位置开始查找字符c第1次出现的位置，并返回一个指向该位置的指针，它共查找n个字节。

* ```void *memset(void *s, int c, size_t n);```

函数memset函数把s开始的n个字节都设置为字符c。

例子：

```c
#include <stdio.h>
#include <string.h>

#define SIZE 5

int main(void)
{
    int a[SIZE], *p; 
    
    memset(a, 0, sizeof(a));
    for (p = a; p < a + SIZE; p++) {
        printf(" %d", *p);
    }   
    fputc('\n', stdout);

    return 0;
}
```

运行结果：

```c
 0 0 0 0 0
```