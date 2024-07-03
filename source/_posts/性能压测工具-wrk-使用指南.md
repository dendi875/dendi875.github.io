---
title: 性能压测工具 wrk 使用指南
author: 张权
top: false
cover: false
toc: true
mathjax: true
date: 2022-03-24 16:48:46
password:
summary: 性能压测工具 wrk 使用指南
tags:
  - 工具
categories: 
  - 工具
  
  

---


![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/wrk-0.png)


## 一、什么是 wrk

wrk 是一个开源的、热门的、现代的单机 HTTP 基准测试工具，目前 GitHub 开源平台累计了 31.8k 的 star 数目，足以可见 wrk 在 HTTP 基准测试领域的热门程度。它结合了多线程设计和可扩展的事件通知系统，如 [epoll](https://man7.org/linux/man-pages/man7/epoll.7.html) 和 [kqueue](https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2) ，可以在有限的资源下对目标机器产生大量的负载。并且内置了一个可选的 [LuaJIT](https://en.wikipedia.org/wiki/LuaJIT) 脚本执行引擎，可以处理复杂的 HTTP 请求生成、响应处理以及自定义压测报告。

wrk项目地址：https://github.com/wg/wrk

## 二、wrk 的优缺点

### 2.1 优点

* 轻量级性能测试工具
* 安装简单（相对 Apache ab 来说）
* 学习曲线基本为零，几分钟就能学会如何使用了
* 基于系统自带的高性能 I/O 机制，如 epoll, kqueue, 利用异步的事件驱动框架，通过很少的线程就可以压出很大的并发量

### 2.2 缺点

wrk 目前仅支持单机压测，后续也不太可能支持多机器对目标机压测，因为它本身的定位，并不是用来取代 JMeter, LoadRunner 等专业的测试工具，wrk 提供的功能，对我们后端开发人员来说，应付日常接口性能验证还是比较友好的。

## 三、安装 wrk

### 3.1 Linux 安装

#### 3.1.1 Ubuntu/Debian

```bash
$ sudo apt-get install build-essential libssl-dev git -y
$ git clone https://github.com/wg/wrk.git wrk
$ cd wrk
$ make
# 将可执行文件移动到 /usr/local/bin 位置
$ sudo cp wrk /usr/local/bin
```

#### 3.1.2 CentOS/RedHat/Fedora

```bash
$ sudo yum groupinstall 'Development Tools'
$ sudo yum install -y openssl-devel git 
$ git clone https://github.com/wg/wrk.git wrk
$ cd wrk
$ make
# 将可执行文件移动到 /usr/local/bin 位置
$ sudo cp wrk /usr/local/bin
```

### 3.2 MacOS 安装

```bash
brew install wrk
```

## 四、如何使用

### 4.1 基础使用

```bash
$ wrk -t12 -c400 -d30s http://www.zhangquan.me
```

这条命令表示，利用 wrk 对 www.zhangquan.me 发起压力测试，线程数为 12，模拟 400 个并发请求，持续 30 秒。

### 4.2 wrk 参数说明

除了上面简单示例中使用到的子命令参数，wrk 还有其他更丰富的功能，命令行中输入 wrk --help, 可以看到支持以下子命令：

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/wrk-2.png)


```cmd
使用方法: wrk <选项> <被测HTTP服务的URL>                            
  Options:                                            
    -c, --connections <N>  跟服务器建立并保持的TCP连接数量  
    -d, --duration    <T>  压测时间           
    -t, --threads     <N>  使用多少个线程进行压测   
                                                      
    -s, --script      <S>  指定Lua脚本路径       
    -H, --header      <H>  为每一个HTTP请求添加HTTP头      
        --latency          在压测结束后，打印延迟直方图信息   
        --timeout     <T>  如果在此时间内没有收到响应，则记录超时    
    -v, --version          打印正在使用的wrk的详细版本信息
                                                      
  <N>代表数字参数，支持国际单位 (1k, 1M, 1G)
  <T>代表时间参数，支持时间单位 (2s, 2m, 2h)
```

`-`开头的指令为简写的，后面两个打印延迟直方图和超时设置没有简写的，只能`--`开头指定

> PS: 关于线程数，并不是设置的越大，压测效果越好，线程设置过大，反而会导致线程切换过于频繁，效果降低，一般来说，推荐设置成压测机器 CPU 核心数的 2 倍到 4 倍就行了。

MAC 查看 CPU 物理处理器数量和逻辑处理器数量
```cmd
$ sysctl hw.physicalcpu hw.logicalcpu
hw.physicalcpu: 8
hw.logicalcpu: 16
```

### 4.3 压测报告

执行压测命令:

```cmd
$ wrk -t12 -c400 -d30s --latency http://www.zhangquan.me  
```

生成如下压测报告：

```cmd
Running 30s test @ http://www.zhangquan.me （运行30s测试）
  12 threads and 400 connections （共12个测试线程，400个连接）
                
  Thread Stats   Avg（平均值）      Stdev（标准差）     Max (最大值)    +/- Stdev（正负一个标准差所占比例）
    Latency (延迟）    79.18ms   24.43ms 737.24ms   97.75%
    Req/Sec (每秒请求数)     423.57     38.26   530.00     87.14%
  Latency Distribution (延迟直方图)
     50%   76.95ms (50%请求延迟在76.95ms内)
     75%   89.43ms (75%请求延迟在89.43ms内)
     90%   95.05ms (90%请求延迟在95.05ms内)
     99%  143.00ms (99%请求延迟在143.00ms内)
  152148 requests in 30.09s, 94.74MB read (30.09s内处理了152148个请求，耗费流量94.74MB)
Requests/sec:   5056.18 (QPS 5056.18,即平均每秒处理请求数为5056.18)
Transfer/sec:      3.15MB (平均每秒流量3.15MB)
```

> 标准差啥意思？标准差如果太大说明样本本身离散程度比较高，有可能系统性能波动较大。

### 4.4 使用 Lua 脚本进行复杂测试

您可能有疑问了，你这种进行 GET 请求还凑合，我想进行 POST 请求咋办？而且我想每次的请求参数都不一样，用来模拟用户使用的实际场景，又要怎么弄呢？

对于这种需求，我们可以通过编写 Lua 脚本的方式，在运行压测命令时，通过参数 --script 来指定 Lua 脚本，来满足个性化需求。


#### 4.4.1 wrk 对 Lua 脚本的支持

wrk 支持在三个阶段对压测进行个性化，分别是启动阶段、运行阶段和结束阶段。每个测试线程，都拥有独立的Lua 运行环境。


##### 启动阶段：

```lua
function setup(thread)
    thread.addr = "http://www.zhangquan.me"        
    thread:get("name")      
    thread:set("name", "zq") 
    thread:stop()          
end
```

在脚本文件中实现 setup 方法，wrk 就会在测试线程已经初始化，但还没有启动的时候调用该方法。wrk会为每一个测试线程调用一次 setup 方法，并传入代表测试线程的对象 thread 作为参数。setup 方法中可操作该 thread 对象，获取信息、存储信息、甚至关闭该线程。

```lua
thread.addr             - get or set the thread's server address # 获取或设置请求的地址
thread:get(name)        - get the value of a global in the thread's env # 获取全局变量的值
thread:set(name, value) - set the value of a global in the thread's  env # 在线程的环境中设置全局变量的值
thread:stop()           - stop the thread # 停止线程
```

##### 运行阶段：

```lua
function init(args) 
    print(args)
end

function delay()
   return 10
end

function request()
    requests = requests + 1
    return wrk.request()
end

function response(status, headers, body)
    responses = responses + 1
end
```

* `init(args)`: **初始化。** 由测试线程调用，只会在进入运行阶段时，调用一次。支持从启动 wrk 的命令中，获取命令行参数；args为从命令行传过来的额外参数。
* `delay()`： **每次请求前设置延迟。** 在每次发送请求之前调用，如果需要定制延迟时间，可以在这个方法中设置。
* `request()`:  **发起请求。**         每次请求执行一次，返回包含HTTP请求的字符串。每次构建新请求的开销都很大，在测试高性能服务器时，一种解决方案是在init()中预先生成所有请求，并在request()中进行快速查找。
* `response(status, headers, body)`: **响应处理。** 在每次收到一个响应时被调用，为提升性能，如果没有定义该方法，那么wrk不会解析 headers 和 body。

##### 结束阶段：

```lua
function done(summary, latency, requests)
    for index, thread in ipairs(threads) do
        local id = thread:get("id")
        local requests = thread:get("requests")
        local responses = thread:get("responses")
        local msg = "thread %d made %d requests and got %d responses"
        print(msg:format(id, requests, responses))
    end
end
```
**请求完成。** done() 方法在整个测试过程中只会被调用一次，我们可以从给定的参数中，获取压测结果，生成定制化的测试报告。done()函数接收一个包含结果数据的表和两个统计数据对象，分别表示每个请求延迟和每个线程请求速率。
持续时间和延迟是微秒值，速率是以每秒请求数来度量的。

##### 自定义 Lua 脚本中可访问的变量以及方法：

变量：wrk

```lua
wrk = {
    scheme  = "http",
    host    = "localhost",
    port    = 8080,
    method  = "GET",
    path    = "/",
    headers = {},
    body    = nil,
    thread  = <userdata>,
  }
```

以上定义了一个 table 类型的全局变量，修改该 wrk 变量，会影响所有请求。

方法：
* wrk.fomat
* wrk.lookup
* wrk.connect

上面三个方法解释如下：

```lua
function wrk.format(method, path, headers, body)

    wrk.format returns a HTTP request string containing the passed parameters
    merged with values from the wrk table.
    # 根据参数和全局变量 wrk，生成一个 HTTP rquest 字符串。获取域名的IP和端口，返回table，例如：返回 `{127.0.0.1:80}`

function wrk.lookup(host, service)

    wrk.lookup returns a table containing all known addresses for the host
    and service pair. This corresponds to the POSIX getaddrinfo() function.
    # 给定 host 和 service（port/well known service name），返回所有可用的服务器地址信息。

function wrk.connect(addr)

    wrk.connect returns true if the address can be connected to, otherwise
    it returns false. The address must be one returned from wrk.lookup().
    # 测试给定的服务器地址信息是否可以成功创建连接，例如：`127.0.0.1:80`，返回 true 或 false
```

#### 4.4.2 通过 Lua 脚本压测示例

##### 调用 POST 接口：

```cmd
wrk.method = "POST"
wrk.body   = "id=1&name=zq"
wrk.headers["Content-Type"] = "application/x-www-form-urlencoded"
```

注意: wrk 是个全局变量，这里对其做了修改，使得所有请求都使用 POST 的方式，并指定了 body 和 Content-Type头。

##### 自定义每次请求的参数：

```lua
request = function()
   uid = math.random(1, 10000000)
   path = "/test?uid=" .. uid
   return wrk.format(nil, path)
end
```

在 request 方法中，随机生成 1~10000000 之间的 uid，并动态生成请求 URL.

##### 每次请求前，延迟 10ms:

```lua
function delay()
   return 10
end
```

##### 请求的接口需要先进行认证，获取 token 后，才能发起请求，咋办？

```lua
token = nil
path  = "/auth"

request = function()
   return wrk.format("GET", path)
end

response = function(status, headers, body)
   if not token and status == 200 then
      token = headers["X-Token"]
      path  = "/test"
      wrk.headers["X-Token"] = token
   end
end
```

上面的脚本表示，在 token 为空的情况下，先请求 /auth 接口来认证，获取 token, 拿到 token 以后，将 token 放置到请求头中，再请求真正需要压测的 /test 接口。

##### 压测支持 HTTP pipeline 的服务：

```lua
init = function(args)
   local r = {}
   r[1] = wrk.format(nil, "/?foo")
   r[2] = wrk.format(nil, "/?bar")
   r[3] = wrk.format(nil, "/?baz")

   req = table.concat(r)
end

request = function()
   return req
end
```

通过在 init 方法中将三个 HTTP请求拼接在一起，实现每次发送三个请求，以使用 HTTP pipeline。


#### 4.4.3 通过 Lua 测试脚本案例分析

案例：我们线上有一个带缓存场景的接口服务，根据 uid 的值的查询结果缓存，所以，如果单纯对指定的 uid 压测，就变成了测试缓存系统的负载了，测试不出实际的服务性能，这个场景就需要测试工具发起每次请求的测试参数都是动态的。根据这个场景我们定制了如下的 lua 测试脚本：

测试指令：

```
wrk -t16 -c100 -d5s -sreview_digress_list.lua --latency htt://127.0.0.1:8081
```

Lua 脚本：

```lua
wrk.method ="GET"
wrk.path = "/app/{uid}/review_digress_list"

function request()
    -- 动态生成每个请求的url
    local requestPath = string.gsub(wrk.path,"{uid}",math.random(1,10000000))
    -- 返回请求的完整字符串：http://127.0.0.1/app/666/review_digress_list
    return wrk.format(nil, requestPath)
end
```