---
title: 使用openssl自建CA和颁发多域名通配符证书
top: false
cover: false
toc: true
mathjax: true
date: 2021-06-29 15:15:47
password:
summary: 使用openssl自建CA和颁发多域名通配符证书
tags:
	- 运维
categories:
	- Linux
---

# 使用openssl自建CA和颁发多域名通配符证书

---
## 常见的证书分类

1. 单域名ssl证书

    只保护一个域名，例如如果想要保护www.test.com，a.demo.com，b.example.com；每个域名分别需要一个证书。

2. 多域名ssl证书

    可以同时保护多个域名，例如同时保护www.test.com，a.demo.com，b.example.com等，但每一个品牌的多域名证书保护的域名数量不一样。

3. 通配符ssl证书

    **可以保护主域名本身及下一级的所有子域名，但不支持无限级子域名。**例如*.test.com证书可以保护a.test.com，b.test.com，c.test.com但无法保护x.y.test.com。

4. 多域名通配符ssl证书

    可以保护多个域名以及每个域名的所有二级域名，相当于将多个通配符证书合并为一个证书，例如一个多域名通配符证书可以保护test.com和demo.com，同时也能保护test.com及demo.com的所有二级域名。

## 制作多域名通配符ssl证书

### 1. CA服务器配置

1.1. 在CA目录下创建两个初始文件：
```ssh
[root@localhost ~]# cd /etc/pki/CA/
[root@localhost CA]# touch index.txt serial
[root@localhost CA]# echo 01 > serial
```
1.2.  生成CA证书的RSA私钥
```ssh
[root@localhost CA]# openssl genrsa -out private/ca.key 2048
```
* ``` -out private/ca.key ```是私钥存放的目录和文件名，2048指密钥长度
* 这里注意，公钥是按某种格式从私钥中提取出来的、公钥和私钥是成对的、生成私钥也就有了公钥

1.3. 通过私钥提取公钥(这不是必要的步骤)
```ssh
[root@localhost CA]# openssl rsa -in private/ca.key -pubout -out private/pub.key
```
1.4. 利用CA的RSA密钥生成CA证书请求并对CA证书请求进行自签名，得到CA证书(X.509结构)
``` ssh
openssl req -new -sha256 -x509 -days 3650 -key private/ca.key -out cacert.crt
```

* 签发机构名示例如下

```ssh
Country Name (2 letter code) [XX]:CN
State or Province Name (full name) []:ShangHai
Locality Name (eg, city) [Default City]:ShangHai
Organization Name (eg, company) [Default Company Ltd]:Guanaitong
Organizational Unit Name (eg, section) []:PHP
Common Name (eg, your name or your server's hostname) []:Test Root CA
Email Address []:quan.zhang@guanaitong.com
```

* 可以使用``` -subj ```在非交互式下来代替请求字段信息
``` ssh
openssl req -new \
            -sha256 \
            -x509 \
            -days 3650 \
            -key private/ca.key \
            -subj "/C=CN/ST=ShangHai/L=ShangHai/O=Guanaitong/OU=PHP/CN=Test Root CA/emailAddress=quan.zhang@guanaitong.com" \
            -out cacert.crt
```

* ``` cacert.crt ```就是得到的CA证书

---

### 2. Web服务器配置(以nginx为例)

2.1 建立存放服务器私钥和证书的目录
```ssh
[root@localhost CA]# cd /usr/local/nginx/conf/
[root@localhost conf]# mkdir ssl && cd ssl
```
2.2 生成服务器证书用的RSA私钥
```ssh
[root@localhost ssl]# openssl genrsa -out nginx.key 2048
```

2.3 利用生成好的私钥生成服务器证书签名请求文件
```ssh
[root@localhost ssl]# openssl req -new -sha256 -key nginx.key -out nginx.csr
```

* 签名请求内容示例如下：

```ssh
Country Name (2 letter code) [XX]:CN
State or Province Name (full name) []:ShangHai
Locality Name (eg, city) [Default City]:ShangHai
Organization Name (eg, company) [Default Company Ltd]:Guanaitong
Organizational Unit Name (eg, section) []:PHP
Common Name (eg, your name or your server's hostname) []:Test Internal
Email Address []:
Please enter the following 'extra' attributes
to be sent with your certificate request
A challenge password []:
An optional company name []:
```

* 可以使用``` -subj ```在非交互式下来代替请求字段信息
```ssh
openssl req -new \
            -sha256 \
            -key nginx.key \
            -subj "/C=CN/ST=ShangHai/L=ShangHai/O=Guanaitong/OU=PHP/CN=Test Internal" \
            -out nginx.csr
```

2.4 使用CA根证书对“服务器证书签名请求文件”进行签名，生成带SAN扩展证书
```ssh
openssl x509 -req -sha256 \
             -in nginx.csr \
             -CA /etc/pki/CA/cacert.crt \
             -CAkey /etc/pki/CA/private/ca.key \
             -CAcreateserial \
             -days 3650 \
             -extfile v3.ext \
             -out nginx.crt
```
> -extfile：指定当前创建的证书的扩展文件
> -extensions section：指定当前创建的证书使用配置文件中的哪个section作为扩展属性。

* v3.ext内容示例如下

```
subjectAltName = @alt_names

[alt_names]
DNS.1 = www.testvm.dev
DNS.2 = *.demo.dev
```

* 这里使用``` openssl ```的``` SubjectAlternativeName(SAN) ```实现一个CA证书对多个通配符域名进行签名保护。

* ssl目录内容

```ssh
ssl
├── nginx.crt   #服务器证书
├── nginx.csr   #证书签名请求文件
├── nginx.key   #服务器私钥
└── v3.ext
```
* 查看CSR和CRT文件细节
```ssh
[root@localhost ssl]# openssl req -noout -text -in nginx.csr
[root@localhost ssl]# openssl x509 -noout -text -in nginx.crt
```

### 3. nginx配置ssl加密

3.1 默认nginx是没有安装ssl模块的，需要编译安装nginx时加入``` --with-http_ssl_module ```选项

3.2 nginx配置文件的server指令添加如下配置

```ssh
server {
	 listen       80;
	 listen       443 ssl;
	 server_name www.testvm.dev;
	 ssl_certificate   /usr/local/nginx/conf/ssl/nginx.crt;
	 ssl_certificate_key /usr/local/nginx/conf/ssl/nginx.key;
	 root   /data1/www/test;
	 index  index.php index.html index.htm;
	 location ~ \.php$ {
	     fastcgi_pass   127.0.0.1:9000;
	     fastcgi_index  index.php;
	     fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
	     include        fastcgi_params;
}
```

3.3 重新加载nginx配置
```ssh
[root@localhost ssl]# /usr/local/nginx/sbin/nginx -t
[root@localhost ssl]# /usr/local/nginx/sbin/nginx -s reload
```

### 4. 浏览器导入自己制做的CA证书

### 5. 为linux系统添加根证书

+ 我们来看下这种情况假设``` /data1/www/test/index.php ```文件内容如下：

``` php
<?php

echo 'success';
```

```ssh
[root@localhost test]# curl https://www.testvm.dev/index.php
curl: (60) Peer certificate cannot be authenticated with known CA certificates
More details here: http://curl.haxx.se/docs/sslcerts.html

curl performs SSL certificate verification by default, using a "bundle"
 of Certificate Authority (CA) public keys (CA certs). If the default
 bundle file isn't adequate, you can specify an alternate file
 using the --cacert option.
If this HTTPS server uses a certificate signed by a CA represented in
 the bundle, the certificate verification probably failed due to a
 problem with the certificate (it might be expired, or the name might
 not match the domain name in the URL).
If you'd like to turn off curl's verification of the certificate, use
 the -k (or --insecure) option.
```

```ssh
[root@localhost test]# curl https://www.baidu.com
<!DOCTYPE html>
<!--STATUS OK--><html> <head><meta http-equiv=content-type content=text/html;charset=utf-8><meta http-equiv=X-UA-Compatible content=IE=Edge><meta content=always name=referrer><link rel=stylesheet type=text/css href=https://ss1.bdstatic.com/5eN1bjq8AAUYm2zgoY3K/r/www/cache/bdorz/baidu.min.css><title>百度一下，你就知道</title> (剩余内容省略)
```

+ 当我们访问我们自己站点时（``` curl https://www.testvm.dev ```）提示我们curl在linux的证书信任集里没有找到根证书，你可以使用``` curl --insecure ```来不验证证书的可靠性，这只能保证数据是加密传输的但无法保证对方是我们要访问的服务。使用``` curl --cacert cacert.pem ```可以手动指定根证书路径。为什么访问百度的``` https ```站点时就能正确返回内容？

    + 因为为百度站点签署的CA证书已经内置在操作系统中了，curl 访问https站点时会自动去获取操作系统内置的证书，而我们自已签名的CA证书没有导入到操作系统中，所以会获取不到内容。


+ 把自己制作的CA证书导入到操作系统中

> Ubuntu, Debian系列

0.内置的证书集在这个文件里``` /etc/ssl/certs/ca-certificates.crt ```

1.将自己制作的CA证书复制到``` /usr/local/share/ca-certificates/ ```目录下
```ssh
[root@localhost test]# cp /etc/pki/CA/cacert.crt  /usr/local/share/ca-certificates/
```
2.更新操作系统CA证书库
```ssh
[root@localhost test]# update-ca-certificates
```
3.更多的命令行参数及说明， 请查看: ``` man update-ca-certificates ```

> Centos系列

0.内置的证书集在这个文件里``` /etc/pki/tls/cert.pem ```

1.安装根证书管理包软件
```ssh
[root@localhost test]# yum install ca-certificates
```
2.打开根证书动态配置开关
```ssh
[root@localhost test]# update-ca-trust force-enable
```
3.将自己制作的CA证书复制到``` /etc/pki/ca-trust/source/anchors/ ```目录下
```ssh
[root@localhost test]# cp /etc/pki/CA/cacert.crt /etc/pki/ca-trust/source/anchors/
```
4.更新操作系统CA证书库
```ssh
[root@localhost test]# update-ca-trust extract
```
5.更多的命令行参数及说明， 请查看: ``` man update-ca-trust ```

* 最后验证下是否成功
```ssh
[root@localhost logs]# curl https://www.testvm.dev/index.php
success
```

### 一点扩展知识

* 我们在使用PHP开发程序时会使用到``` file_get_contents ```函数、``` curl ```库来获取https站点数据时，如果需要对证书做信任，那么就可以把自己制作的CA证书导入到操作系统中，然后就不需要手动指定证书参数或者修改 php.ini ``` openssl.cafile或openssl.capath```选项，就能很爽的直接``` file_get_contents('https://www.testvm.dev/index.php') ```来使用了。

* 注意导入证书后那些在导入证书前就已经运行的服务需要将相应服务重启后才能使用系统新的证书，例如重启``` php-fpm ```

---

## 总结
* 如果是自己做的CA，浏览器要导入CA证书(导入CA证书，意味着将信任这个CA签署的所有证书)。而商业的ssl证书颁发机构如VeriSign、Wosign、StartSSL签发的证书，浏览器已经内置并信任了这些根证书。
* 如果对于一般的应用，管理员只需生成“证书请求”（后缀大多为.csr），它包含你的服务器名称(域名)和公钥，然后把这份请求交给诸如verisign等有CA服务公司，你的证书请求经验证后，CA用它的私钥签名，形成正式的证书发还给你。管理员再在web server上导入这个证书就行了。

## 一些坑
+ Chrome 58及以上版本要使用OpenSSL创建带有SAN(subjectAlternativeName，主题备用名称)的证书，不然chrome会报 **NET::ERR_CERT_COMMON_NAME_INVALID**
+ 生成证书时要使用**sha256**加密不然chrome会报弱的签名
+ 注意浏览器缓存，**cookie**

## 参考链接
* http://www.ruanyifeng.com/blog/2011/08/what_is_a_digital_signature.html
* http://apetec.com/support/generatesan-csr.htm
* http://liaoph.com/openssl-san/