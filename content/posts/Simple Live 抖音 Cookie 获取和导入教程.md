---
title:      Simple Live 抖音 Cookie 获取和导入教程
subtitle:   为什么不能只填 ttwid，以及怎么把完整 Cookie 从电脑带到手机和 TV
date:       2026-06-01
author:     June
tags:
    - 技术
    - 技术/教程
    - 技术/开源
---

## 一、先说结论

Simple Live 里抖音直播“播放”和“搜索”不是一回事。

如果只是打开某个抖音直播间，默认内置的 `ttwid` 很多时候就够了。但如果要在 Simple Live 里搜索主播、搜索房间名，抖音接口经常会要求登录态。这时候只填一个 `ttwid` 不够，需要浏览器登录后的完整 Cookie。

简单说：

```text
只看直播：默认 ttwid 多数情况下可以兜底
搜索主播 / 房间：建议使用完整 www.douyin.com Cookie
```

这篇写给不熟悉浏览器开发者工具的人。只要按步骤做，不需要懂前端。

## 二、Cookie 是什么

Cookie 可以粗略理解成“浏览器帮你保存的一串登录凭据”。

你在电脑浏览器里登录抖音后，浏览器每次请求 `www.douyin.com` 或 `live.douyin.com`，都会在请求头里带上一段类似这样的东西：

```text
cookie: key1=value1; key2=value2; key3=value3
```

这一整行就是我们要复制的东西。

它不是密码，但它很接近登录凭据。拿到你的完整 Cookie 的人，有可能在一段时间内用你的登录态请求抖音接口。所以不要发给别人，不要贴到公开 issue，也不要截图发群里。

Simple Live 需要它，是因为抖音搜索接口并不是完全公开的匿名接口。浏览器能搜，是因为浏览器带着你的登录态。Simple Live 想在 App 里调用同一个搜索能力，也要带上这个登录态。

## 三、不要只复制 ttwid

很多人第一次会去浏览器 Cookie 列表里找 `ttwid`，然后只复制这一项。

这通常不够。

`ttwid` 更像一个设备 / 访客标识，它对播放有帮助，但它不一定代表“你已经登录”。搜索主播、房间名时，接口更关心完整的登录 Cookie，里面可能还会有 `sid_guard`、`sessionid`、`passport_csrf_token`、`msToken` 等一批字段。

所以这篇教程里说的 Cookie，默认都是“完整 Cookie”，不是单个字段。

你要复制的是这种：

```text
ttwid=...; sid_guard=...; sessionid=...; passport_csrf_token=...; msToken=...
```

而不是这种：

```text
ttwid=...
```

## 四、电脑端获取 Cookie

建议用电脑端 Chrome 或 Edge。下面以 Edge / Chrome 这一类 Chromium 浏览器为例。

### 1. 打开抖音网页并登录

先打开：

```text
https://www.douyin.com/
```

或者：

```text
https://live.douyin.com/
```

登录自己的账号。扫码、验证码都可以。确认页面右上角能看到登录后的状态。

### 2. 打开开发者工具

按 `F12`。

如果 `F12` 没反应，可以试：

```text
Ctrl + Shift + I
```

打开后，点上方的 `Network`，中文浏览器里一般叫“网络”。

### 3. 刷新页面

在 Network 面板打开的情况下，按一下：

```text
Ctrl + R
```

或者直接点浏览器刷新。

这样 Network 里会出现很多请求。不要被列表吓到，我们只需要其中任意一个带 Cookie 的抖音请求。

### 4. 找一个 www.douyin.com 或 live.douyin.com 请求

在 Network 请求列表里，随便点一个域名是下面这些的请求：

```text
www.douyin.com
live.douyin.com
```

不一定非要点中搜索接口。

只要这个请求的 Request Headers 里有完整 Cookie，一般就可以用。你可以点页面、进个人页、进直播页、刷新首页，都会产生请求。

### 5. 复制 Request Headers 里的 Cookie

点开某个请求后，右侧或下方会看到 `Headers`。

往下找：

```text
Request Headers
```

再找：

```text
cookie: ...
```

注意，是 `Request Headers` 里的 `cookie`。

不要复制 `Response Headers` 里的 `set-cookie`。那是服务器返回给浏览器的单个设置项，不是浏览器下一次请求会带上的完整 Cookie。

你可以复制整行：

```text
cookie: ttwid=...; sid_guard=...; sessionid=...
```

也可以只复制冒号后面的值：

```text
ttwid=...; sid_guard=...; sessionid=...
```

Simple Live 都能识别。

## 五、如果浏览器显示成两行

有些复制方式会变成这样：

```text
cookie
ttwid=...; sid_guard=...; sessionid=...
```

也没关系。Simple Live 做了兼容，会识别 `cookie` 下一行的内容。

也支持你把整段请求头都复制进去，例如：

```text
accept: application/json
accept-language: zh-CN,zh;q=0.9
cookie: ttwid=...; sid_guard=...; sessionid=...
referer: https://www.douyin.com/
user-agent: Mozilla/5.0 ...
```

应用会从里面提取 `cookie` 那一行。

这部分逻辑在主 App 里是这样处理的：

```text
simple_live_app/lib/modules/mine/account/account_controller.dart
```

核心就是先尝试从整段文本里找 `cookie:`，找不到再把输入当作纯 Cookie：

```dart
String _normalizeDouyinCookieInput(String input) {
  var cookie = _extractDouyinCookieFromHeaderText(input) ?? input.trim();
  if (cookie.toLowerCase().startsWith("cookie:")) {
    cookie = cookie.substring(cookie.indexOf(":") + 1).trim();
  }
  if (!cookie.contains("=")) {
    cookie = 'ttwid=$cookie';
  }
  return cookie;
}
```

所以不用太纠结复制格式。只要里面有完整 Cookie，应用会尽量帮你提取。

## 六、粘贴到 Simple Live

在 Simple Live 里打开：

```text
设置 -> 账号管理 -> 抖音直播 -> Cookie 登录
```

把刚才复制的内容粘贴进去，点确定。

保存后，账号管理页会显示一个摘要。如果 Cookie 里有 `sid_guard`，应用会尝试解析一个预计有效期。这个时间不是绝对的，因为退出登录、改密码、账号风控都可能让 Cookie 提前失效。

如果显示“有效期无法判断”，也不一定代表不能用，只是 Cookie 里没有能被当前逻辑解析的标准过期字段。

## 七、手机端怎么导入

手机上直接粘贴超长 Cookie 很容易失败：输入框长度、剪贴板、聊天软件转发，都可能把内容截断。

所以现在 Android / iOS 里加了“从文件导入 Cookie”。

推荐流程是：

1. 在电脑上新建一个文本文件，例如：

   ```text
   douyin-cookie.txt
   ```

2. 把完整 Cookie 粘进去。

3. 保存文件，最好用 UTF-8。

4. 通过微信文件传输、QQ、网盘、数据线等方式传到手机。

5. 手机打开 Simple Live：

   ```text
   设置 -> 账号管理 -> 抖音直播 -> 从文件导入 Cookie
   ```

6. 选择这个 txt 文件。

导入时会自动 `trim()`，也就是去掉文件开头和结尾的空格、空行。文件里可以是纯 Cookie，也可以是 `Cookie: xxx`，也可以是整段 Request Headers。

这也是为什么推荐用文件。电脑复制方便，手机负责导入，不要在手机上和一大段 Cookie 较劲。

## 八、TV 怎么办

TV 端不内置浏览器登录抖音。

原因很简单：TV 上打开网页登录体验很差，很多情况下也没法正常完成扫码、验证码、复制 Cookie 这些动作。

推荐做法是：

```text
电脑或手机主 App 获取完整 Cookie
-> 在主 App 保存
-> 通过同步功能同步到 TV
```

不要在 TV 上尝试只填 `ttwid`。如果你要用抖音搜索，还是完整 Cookie 更靠谱。

## 九、为什么任意请求都可以

很多人会问：是不是一定要找到 `aweme/v1/web/live/search/` 这个搜索请求？

不一定。

Cookie 不是某一个请求独有的东西。它是浏览器对这个域名发请求时携带的一组凭据。只要你已经登录，浏览器访问 `www.douyin.com` 或 `live.douyin.com` 时，很多请求都会带上同一批 Cookie。

Simple Live 搜索时会把你保存的 Cookie 放到请求头里：

```text
cookie: 你保存的完整 Cookie
```

所以获取 Cookie 的关键不是“点中哪个接口”，而是“复制到的 Cookie 是否完整，是否来自登录后的浏览器请求”。

当然，如果你刚好能在 Network 里点到搜索接口，那也可以。但没必要为了找它折腾半天。

## 十、为什么 Android 会报 HEAD 请求失败

之前 Android 上有一个容易误导的问题：同一个 Cookie，Windows 能用，Android 搜索时报：

```text
发送HEAD请求失败
```

原因是搜索前会先对抖音域名发一个 HEAD 请求，尝试补一些网页 Cookie。Android 网络环境、系统 TLS、服务端策略都有可能让这个 HEAD 请求失败。

后来 Simple Live 改了兜底逻辑：如果你本地已经保存了完整 Cookie，HEAD 失败时不再直接中断，而是继续用已保存 Cookie 请求搜索。

对应代码在：

```text
simple_live_core/lib/src/douyin_site.dart
```

大概逻辑是：

```dart
try {
  headResp = await HttpClient.instance.head(
    'https://live.douyin.com',
    header: requestHeaders,
  );
} catch (e) {
  if (dyCookie.isEmpty) {
    rethrow;
  }
  _logDebug("抖音搜索预取 Cookie 的 HEAD 请求失败，使用已保存 Cookie 继续：$e");
}
```

所以如果你还遇到类似问题，先确认自己导入的是完整 Cookie，而不是只有 `ttwid`。

## 十一、Cookie 会失效吗

会。

Cookie 不是永久通行证。常见失效原因有：

- 你在浏览器里退出了抖音登录。
- 修改密码或账号安全状态变化。
- 抖音服务端主动让登录态过期。
- Cookie 本身过期。
- 账号触发风控，需要重新验证。

Simple Live 会尝试从 `sid_guard` 解析一个预计有效期，但这只是参考。

如果某天搜索突然不能用了，最直接的处理方式是：

```text
重新在电脑浏览器登录抖音
-> 重新复制完整 Cookie
-> 重新粘贴或从文件导入
```

## 十二、几个常见错误

### 只填 ttwid

表现：

```text
播放可能还能用，搜索不稳定或提示需要登录
```

处理：

```text
重新复制完整 Request Headers Cookie
```

### 复制了 set-cookie

表现：

```text
看起来有 Cookie，但字段很少，搜索还是失败
```

处理：

```text
去 Request Headers 里复制 cookie，不要复制 Response Headers 里的 set-cookie
```

### 复制内容被截断

表现：

```text
电脑能用，手机粘贴后不能用
```

处理：

```text
把 Cookie 保存成 txt 文件，传到手机后用“从文件导入 Cookie”
```

### 登录后没有刷新 Network

表现：

```text
Network 里看到的还是登录前请求，Cookie 不完整
```

处理：

```text
登录成功后保持开发者工具打开，再刷新一次页面
```

### 把 Cookie 发给别人测试

这个不要做。

Cookie 接近登录凭据。别人拿到后，至少在一段时间内可能可以用你的登录态请求接口。遇到问题可以描述现象，不要把完整 Cookie 发出来。

## 十三、最后总结

获取抖音 Cookie 这件事，最关键的就三句话：

```text
要登录后的完整 Cookie
要复制 Request Headers 里的 cookie
不要只复制 ttwid
```

电脑端复制最方便，手机端建议用文件导入，TV 端建议从主 App 同步。

如果以后抖音网页改版，开发者工具的位置可能会变，但原理不会变：浏览器能搜索，是因为请求里带着登录态；Simple Live 要搜索，也要带着同一份登录态。
