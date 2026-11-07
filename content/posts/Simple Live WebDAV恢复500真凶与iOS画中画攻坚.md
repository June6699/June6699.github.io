---
title:      Simple Live WebDAV 恢复 500 的真凶与 iOS 画中画攻坚
subtitle:   一次 OSS 签名错位、media_kit 纹理管线和后台渲染的连续排查
date:       2026-11-08
author:     June
tags:
    - 技术
    - 技术/Flutter
    - 技术/开源
---

## 一、起因

上次写过一篇《Simple Live 这次几个大坑：全屏、弹幕过滤和 WebDAV 恢复》，收在 v1.12.4。当时 WebDAV 那段只算解决了一半：把恢复链路拆成下载、检查、解压、导入，失败点好定位了，但「能上传、不能恢复」的根因一直没找到，issue 挂着。

这次两件事赶到了一起。

一个是 #164，用户报 WebDAV 恢复还是 500。这次他把 Alist 服务端日志贴了出来，案子当场破了。

另一个是 iOS 画中画。这个功能一直没做，原因是播放器插件 media_kit 的作者自己说过 iOS 画中画有黑屏问题。这次下决心啃一下，结果啃出一个连环坑，到现在还没完全爬出来。

WebDAV 已经闭环，iOS 还在坑里，这篇把过程都记下来，iOS 的解决方案等真机结果出来再补。

## 二、WebDAV 500：三层排除法，真凶在服务端日志里

### 2.1 现象

用户反馈很典型：上传成功，恢复失败，报错是：

```text
恢复失败：DioException [bad response]: null Error: Internal Server Error
```

另一台设备复现同样的问题。错误信息里连状态码都看不出来，只有一个服务端的短语。

### 2.2 先把客户端能排除的都排除掉

恢复链路走的是 webdav_client 的 `read2File`，展开是两步：先对文件路径发 `OPTIONS`，再发 `GET`，任何一步非 200 都会抛上面那个错。

对着这个链路能做几组排除：

- 上传一分钟前对同一路径 `PUT` 成功，而上传内部同样先过了 `OPTIONS`——路径、鉴权、连通性都没问题；
- 恢复代码从五月底引入后零改动，用户八月五号还成功恢复过——不是客户端回归；
- `GET` 失败、`PUT` 成功，指向服务器「读取分发这个文件」这一步。

到这里客户端嫌疑基本洗清，但「服务器的问题」六个字没法写进 issue 回复，用户也没法拿它去查自己的 Alist。

### 2.3 先把诊断补上

抛错的地方只能拿到一个状态短语，看不到是哪个请求、哪个状态码、服务器回了什么。于是在恢复和上传的 catch 里补了一层：

```dart
/// 提取 WebDAV 请求失败的关键诊断信息：请求方法、URL、状态码与服务器响应体。
Future<String> _davErrorDetail(Object e) async {
  if (e is! DioException) {
    return "";
  }
  final resp = e.response;
  if (resp == null) {
    return "";
  }
  final requestOptions = resp.requestOptions;
  var body = "";
  try {
    final data = resp.data;
    if (data is ResponseBody) {
      body = await data.stream.cast<List<int>>().transform(utf8.decoder).join();
    } else if (data is String) {
      body = data;
    } else if (data != null) {
      body = data.toString();
    }
  } catch (_) {}
  body = body.trim();
  if (body.length > 300) {
    body = body.substring(0, 300);
  }
  final method = requestOptions.method;
  final url = requestOptions.uri.toString();
  return "[$method $url] HTTP ${resp.statusCode}${body.isEmpty ? "" : "：$body"}";
}
```

这段后来确实用上了，但真正破案靠的不是它。

### 2.4 破案：Alist 日志里三行

让用户手动去 Alist 网页端下载同一个 `backup.zip`，同样失败；再请他把 Alist 服务端日志贴出来。日志一来，三行就够：

```text
PUT  /dav/WebDav/1/simple_live_app/backup.zip   -> 201（上传成功）
GET  ...  webdav proxy error: status: 403
<Code>SignatureDoesNotMatch</Code>
<HostId>cn-beijing-data.aliyundrive.net</HostId>
```

挂载的是阿里云盘。恢复时 `GET` 经 Alist 代理转发到阿里云盘的 OSS 签名直链，OSS 的 V1 签名校验里，`StringToSign` 长这样：

```text
GET

text/xml
1794048072
...
```

第一行是方法，第二行空位是 `Content-MD5`，第三行就是请求的 `Content-Type`——`text/xml`。

而应用的全局 WebDAV 封装里，一直给所有请求带着这个头：

```dart
client.setHeaders(
  {
    'accept-charset': 'utf-8',
    'Content-Type': 'text/xml',
  },
);
```

这个头跟着 `GET` 一路透传到 OSS，和直链签名时没算的 `Content-Type` 对不上，`SignatureDoesNotMatch`，403，Alist 把它转成 500 丢回客户端。整条链路对上了：上传走的是中转通道，不经过签名直链，所以一直正常。

### 2.5 修复是一行

这个全局头本来就没必要存在。`PROPFIND` 需要的 XML `Content-Type`，webdav_client 内部在发 `PROPFIND` 时会自己设置正确的 `application/xml`，`GET`、`PUT`、`OPTIONS` 都不需要它。删掉：

```dart
// 仅设置必要头。GET 请求不能携带 Content-Type：
// Alist 等网关代理到 OSS 签名直链时会把该头透传，
// 与直链签名不一致导致 SignatureDoesNotMatch（HTTP 403→500）。
client.setHeaders(
  {
    'accept-charset': 'utf-8',
  },
);
```

### 2.6 一个教训

排查时我把客户端链路翻了个底朝天：请求时序、鉴权方式、路径拼接、302 处理，全部干净。干净是因为那个头从第一天就在——它不是改出来的 bug，是与生俱来的 bug，只有当对端的校验规则和它撞上时才炸。

这次炸不炸也不完全由客户端决定：Alist 背后挂的存储、Alist 版本对请求头的透传行为，都在链路里。用户八月五号还能成功恢复，大概率是当时挂载的存储或 Alist 版本和现在不同，这一点没法从日志确认，只能记着。

另一个值得记的做法：让用户去 Alist 网页端手动下载同一个文件。他一失败，服务端问题就坐实了，客户端才能彻底洗清。这个动作比多写十行猜测代码值钱。


## 三、iOS 画中画：一个连环坑（未完）

### 3.1 背景

media_kit 在 iOS 上的渲染是一条纯 Flutter 纹理链：mpv 解码 → OpenGL 渲染进 `CVOpenGLESTextureCache` 管理的 `CVPixelBuffer` → 作为外部纹理交给 Flutter 合成。画中画是另一回事：系统在独立的小窗里接管一个原生视频层，Flutter 的纹理进不去。

上游也不是没做过。PR #206（2023 年）用 `AVSampleBufferDisplayLayer` 做出来了，测试时被维护者拦下：退后台后 iOS 收回 GPU 访问权，OpenGL 渲染出错，HDR 视频偏色，不修不合。之后维护停滞，2024 到 2026 全是催更。2026 年又出现一个 AI 生成的 PR #1410，方案更完整，无人审核，同样没有处理后台渲染问题。

项目本来就 vendor 了 `media_kit_video`，有改原生代码的直通车，于是照 #1410 的骨架自己移植了一套：

- `AVPictureInPictureController.ContentSource(sampleBufferDisplayLayer:playbackDelegate:)`，iOS 15+ 对非 AVPlayer 渲染器的官方画中画路径；
- 给纹理加 `onFrameRendered` 回调，渲染完成的 `CVPixelBuffer` 零拷贝送进小窗图层；
- 播放、暂停、恢复、关闭通过事件桥回 Dart。

骨架本身是通的，后面几轮验证反复证明了这一点：小窗能起来、系统能控制、事件能回传。坑全在「帧从哪来、什么时候来」。

### 3.2 五轮真机验证

| 轮次 | 关键改动 | 真机结果 | 定位 |
|---|---|---|---|
| 1 | 进小窗前把渲染切到软渲染 | 小窗起来但全黑，App 内画面也黑 | mpv 软渲染器吃不下 VideoToolbox 硬解帧 |
| 2 | 保持全程硬件渲染 | 前台有画面；退后台卡死；退出小窗后画面抽动 | 后台 GL 停帧（#206 的死因）；小窗图层持有渲染池缓冲 |
| 3 | `hwdec=no` 软解码 + 软渲染 | 前台有画面，部分会话随机黑屏 | 日志实锤 `Video: no video`，视频链在运行时掉线 |
| 4 | 显式重载视频轨 | 轨道重选成功，链仍未建立 | 运行时交换 vo_libmpv 不可靠，修补路线放弃 |
| 5（当前） | 停播 → 换管线 → 重开同一路流 | 待真机验证 | 确定性路径 |

每一轮的定位都来自真机日志，几段关键记录值得单独放出来。

轮 1 的黑屏，App 内画面和小窗一起黑，说明渲染管线整体没出帧。当时还没有埋点，定位靠排除：模拟器上软渲染一直正常，真机上一开硬解就黑，指向 mpv 软渲染器（zimg）映射不了 VideoToolbox 硬解帧。这个推断在后面软解码的轮次里得到了反向验证。

轮 2 换回硬件渲染，前台画面正常，退后台立刻卡死——iOS 对后台进程收回 GPU 访问权，GL 渲染停帧，这就是当年 PR #206 的死因，绕不开。退出小窗后画面抽动是另一个问题：渲染池只有 3 块缓冲轮转复用，小窗图层残留的引用和 GL 渲染争抢同一块内存。处理是把入队改成拷贝到私有缓冲：

```swift
guard let privateBuffer = Self.copyPixelBuffer(retained) else {
  NSLog("MediaKitPiP: copyPixelBuffer failed, fallback to shared")
  ...
}
guard let sample = self.makeSampleBuffer(from: privateBuffer) else {
  NSLog("MediaKitPiP: makeSampleBuffer failed")
  return
}
self.displayLayer.enqueue(sample)
```

轮 3 软解码加软渲染，前台能出画面了，说明软链路本身走得通。但部分会话随机黑屏，日志把原因钉死了：

```text
iOS 小窗启动：handle=4398956112
iOS 小窗 hwdec 切换：auto-safe -> no（生效 no）
播放器日志：(cplayer) Video: no video
iOS 小窗事件：{event: willStart}
iOS 小窗事件：{event: didStart}
```

`mpv_render_context_free` 会连带销毁 `vo_libmpv`，播放中的视频链当场掉线，mpv 直接放弃视频轨。音频不受影响，于是表现为有声无画。之后连帧计数都不会再涨，小窗永远黑。

轮 4 不服气，试了显式重载视频轨：`vid` 先 `no` 再 `auto`，强制 `reinit_video_chain`。日志显示轨道确实重选成功了：

```text
播放器日志：(cplayer) (+) Video --vid=1 (h264 1920x1080 59.000fps)
播放器日志：(cplayer) Video: no video
```

重选成功，链还是没建起来。到这里放弃修补：播放中运行时交换 `vo_libmpv` 这件事本身不可靠，`hwdec` 重配置偶尔能顺带把链带回来，纯属竞态运气。

### 3.3 现在的方案

轮 5 改成确定性路径：不再在播放中动管线，把切换放到停播状态下做。

```dart
// 进入小窗
try {
  await player.stop();
  await _setIosPipHwdec("no");
} catch (e) {
  Log.w("iOS 小窗切换软解码失败: $e");
}
await IosPictureInPicture.setHardwareAcceleration(
  handle: handle,
  enabled: false,
);
try {
  await player.open(media);
} catch (e) {
  Log.w("iOS 小窗重开播放失败: $e");
}
final started = await IosPictureInPicture.start(
  handle: handle,
  startImmediately: true,
);
```

退出时反向做一遍：停播、按进入前记录的原始配置还原硬解和 `hwdec`、重开同一路流恢复播放。重开用的是会话开始时快照的同一路流，直播平台的播放地址时效都是分钟级，秒级重开没有问题。

代价是进出小窗各一次一秒上下的起播空窗，换的是确定性：视频链在全新上下文上自然建立，和 App 首次起播走的是同一条被验证过的路径。

### 3.4 目前沉淀的确定结论

这几轮试下来，有些结论已经钉死，后面不管方案怎么调整都成立：

- mpv 的软件渲染器无法映射 VideoToolbox 硬解帧，模拟器上没有硬解，所以这条路在模拟器永远是通的，一上真机就露馅；
- 退后台后 iOS 收回 GPU 访问权，OpenGL 渲染停帧，硬解渲染链撑不住画中画的后台阶段；
- 播放中交换渲染上下文等于销毁重建 `vo_libmpv`，视频链大概率掉线，显式重载视频轨也救不回来；
- 渲染池的缓冲不能直接交给小窗图层，必须拷贝私有化，否则池子轮转和小窗持有互相踩。

### 3.5 还没解决的

- 最后一轮真机反馈了关闭小窗闪退，怀疑和退出时的管线重建链有关，还没有归因；
- 如果停播重建这轮真机仍然不稳，备选方案是 AVPlayer 混合：画中画会话期间切系统播放器，退出再切回 media_kit。改动大，是最后一张牌；
- 这篇的解决方案部分等真机结果出来再补。


## 四、结尾

两件事放在一起，对照很鲜明。

WebDAV 三分钟破案，靠的是用户手里有一份能看的服务端日志，`SignatureDoesNotMatch` 和 `text/xml` 摆在那里，答案自己会说话。iOS 五轮还在坑里，是因为每一层都得真机才能看见：模拟器上软渲染永远正常，前台永远有画面，后台的 GPU 收回、渲染池的轮转互踩，全都要装到设备上跑一遍才露头。

修 bug 的一半工作，是把「看不见」变成「看得见」。WebDAV 这次是让用户帮我们把服务端日志拿了出来；iOS 这次是给管线每个环节都埋了计数和事件，让黑屏自己说明它断在哪一层。

iOS 这篇还没完，等真机结果。如果停播重建这条路走通，再回来把解决方案补上；走不通，就换 AVPlayer 那张牌，到时候继续写。
