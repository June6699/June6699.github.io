---
title:      Simple Live 这次几个大坑：全屏、弹幕过滤和 WebDAV 恢复
subtitle:   一次 Flutter 桌面窗口、弹幕去重和同步恢复链路的修补记录
date:       2026-06-01
author:     June
tags:
    - 技术
    - 技术/Flutter
    - 技术/开源
---

## 一、起因

这次发 Simple Live `v1.12.4`，表面上看是补了一堆功能：弹幕过滤、抖音 Cookie、WebDAV、Windows 全屏、Android 横竖屏、小窗、TV 包。

但真正花时间的，不是“加一个开关”这种事，而是几个很难一眼看出根因的问题。

比如 Windows 最大化后进全屏，边缘会错位。  
比如 WebDAV 明明能上传，恢复时却拉不下来。  
比如弹幕过滤如果写得太直，直播间弹幕一多就开始拖后腿。  

这些问题都有一个共同点：它们不是改一行 UI 就能过去的。要拆状态，要看时序，要知道是哪一层出了问题。

最后主要动了三块：

```text
Windows 全屏：最大化窗口 -> 全屏窗口的状态切换
弹幕过滤：关键词 / 用户屏蔽 / 重复弹幕去重
WebDAV 恢复：远端 zip 下载、解压、导入
```

下面按这三块写一下。

## 二、Windows 全屏不是一个布尔值

最开始以为 Windows 全屏就是：

```dart
await windowManager.setFullScreen(true);
```

结果用户测出来一个很具体的问题：普通窗口双击全屏没问题，但如果窗口已经最大化，再双击进入全屏，边缘会错位，有时候还会在一秒左右闪出窗口框。

这个现象很像 `setFullScreen(true)` 成功了，但 Windows 的窗口非客户区状态没有完全清掉。标题栏、边框、阴影这些东西，逻辑上已经不该出现了，但窗口管理器还留着一点旧状态。

这段现在在：

```text
simple_live_app/lib/modules/live_room/player/player_controller.dart:436
```

核心处理是：如果进入全屏前已经最大化，先不要直接全屏。

```dart
_windowMaximizedBeforeFullScreen = await windowManager.isMaximized();
if (_windowMaximizedBeforeFullScreen) {
  await windowManager.restore();
  await _waitForWindowMaximizedState(false);
  await windowManager.setSize(const Size(1280, 720));
  await windowManager.center();
  await Future.delayed(const Duration(milliseconds: 240));
}
await windowManager.setFullScreen(true);
await _waitForWindowsFullScreenState(true);
await _applyWindowsFullScreenChrome();
```

这几步看着有点绕，但每一步都有用：

- `restore()`：先从最大化态退出来。
- `_waitForWindowMaximizedState(false)`：等系统真的完成状态切换，不靠猜。
- `setSize(1280, 720)` 和 `center()`：给窗口一个正常尺寸，避免从最大化矩形直接跳全屏。
- `setFullScreen(true)`：这时再进入全屏。
- `_waitForWindowsFullScreenState(true)`：等 `windowManager` 确认全屏状态。
- `_applyWindowsFullScreenChrome()`：最后再处理边框、阴影、标题栏。

全屏后的窗口外观单独封了一层：

```dart
Future<void> _applyWindowsFullScreenChrome() async {
  if (!Platform.isWindows) {
    return;
  }

  try {
    await windowManager.setAsFrameless();
    await windowManager.setResizable(false);
    await windowManager.setHasShadow(false);
    await windowManager.setTitleBarStyle(TitleBarStyle.hidden);
  } catch (e) {
    Log.logPrint(e);
  }
}
```

这里处理的是 Windows 的窗口“壳”。全屏不只是画面铺满，还要把窗口框、阴影、标题栏这些东西一起压下去。

后来又补了一次延迟重放：

```dart
unawaited(
  Future.delayed(const Duration(milliseconds: 900), () async {
    if (!fullScreenState.value || smallWindowState.value) {
      return;
    }
    await _applyWindowsFullScreenChrome();
  }),
);
```

这个是为了解决“一秒后窗口框又出来”的问题。Windows / Flutter 桌面窗口状态切换不是完全同步的。有些状态在 `setFullScreen(true)` 返回后还会被系统再刷一遍，所以只做一次无边框处理不够。延迟补一次，才算把后面的回弹压住。

退出全屏时也不能只 `setFullScreen(false)`。如果进入前是最大化，退出后还要恢复最大化；如果边界缓存没刷新，还要轻推一下尺寸：

```dart
await windowManager.setFullScreen(false);
await _waitForWindowsFullScreenState(false);
await windowManager.setResizable(true);
await windowManager.setHasShadow(true);
await windowManager.setTitleBarStyle(TitleBarStyle.normal);
await _refreshWindowsWindowBounds();
if (_windowMaximizedBeforeFullScreen) {
  await windowManager.maximize();
  await _waitForWindowMaximizedState(true);
}
```

`_refreshWindowsWindowBounds()` 的做法很朴素：尺寸加 1，再设回去。

```dart
final nudgedSize = Size(size.width + 1, size.height + 1);
await windowManager.setSize(nudgedSize);
await windowManager.setSize(size);
```

这种代码看起来不优雅，但桌面窗口问题有时候就是这样。你不是在和 Flutter 的 widget 树打交道，而是在和系统窗口管理器的状态缓存打交道。

顺手还修了 Android 的一个横竖屏问题。退出全屏时原来是释放所有方向：

```dart
await SystemChrome.setPreferredOrientations(DeviceOrientation.values);
```

这在某些手机上会导致退出全屏后还停在横屏。现在退出全屏时明确回到竖屏：

```dart
await SystemChrome.setPreferredOrientations([
  DeviceOrientation.portraitUp,
]);
```

这段在 `player_controller.dart:735`。不是所有“恢复默认”都适合用 `DeviceOrientation.values`，尤其是从横屏全屏退回普通页面的时候。

## 三、弹幕过滤不能只写 contains

弹幕过滤最早可以很简单：用户设置几个关键词，来了弹幕以后 `contains` 一下。

但直播间里弹幕不是普通列表。它频率高、来源杂、还有表情、富文本、图片字段。过滤逻辑如果写得太随意，会有两个问题：

1. 误杀太多，正常弹幕被吞。
2. 开销太大，高弹幕量房间拖播放器。

这次的入口在：

```text
simple_live_app/lib/modules/live_room/live_room_controller.dart:1036
```

弹幕进入后先按顺序处理：

```dart
msg = _sanitizeLiveMessage(msg);
if (msg.type == LiveMessageType.chat) {
  if (_isUserShielded(msg.userName) || isTempMutedUser(msg.userName)) {
    return;
  }

  if (_isKeywordShielded(msg)) {
    return;
  }

  if (_isDuplicateDanmu(msg)) {
    return;
  }

  messages.add(msg);
}
```

顺序是有意排的。

用户屏蔽最便宜，先处理。关键词其次。重复弹幕去重最后，因为它要构建指纹、维护窗口。

### 关键词和正则

关键词过滤在 `live_room_controller.dart:201`。

普通关键词直接当字符串；如果用户写成 `/.../`，就按正则处理：

```dart
if (Utils.isRegexFormat(keyword)) {
  String removedSlash = Utils.removeRegexFormat(keyword);
  try {
    pattern = RegExp(removedSlash);
  } catch (e) {
    Log.d("正则屏蔽词 $keyword 无法编译，已跳过");
  }
} else {
  pattern = keyword;
}
if (pattern != null && msg.message.contains(pattern)) {
  return true;
}
```

这里有个小细节：正则写错不能让弹幕系统崩。用户输入本来就不可控，屏蔽词写错，最多跳过这一条规则。

### 用户屏蔽要分平台

用户屏蔽也不能只有一个全局名单。直播平台之间用户名可能重复，虎牙屏蔽一个人，不一定想把 B 站同名用户也屏蔽掉。

所以设置层加了站点维度：

```text
simple_live_app/lib/app/controller/app_settings_controller.dart:1169
```

```dart
bool shouldShieldUser(String userName, {String? siteId}) {
  if (!danmuShieldEnable.value || !danmuUserShieldEnable.value) {
    return false;
  }
  return isUserShielded(userName, siteId: siteId);
}
```

实际存储时分成“全平台”和具体平台分组。直播间里点用户名，可以直接屏蔽当前平台，也可以临时禁言。这样比一个大名单更可控。

### 重复弹幕去重

重复弹幕过滤这块，最不想写成“每来一条弹幕，就扫描最近 N 条”。因为直播间弹幕频率高的时候，这种 O(N) 小循环会一直跑。

现在的逻辑在：

```text
simple_live_app/lib/modules/live_room/live_room_controller.dart:227
```

核心是一个队列加一个计数表：

```dart
final duplicate = _recentDanmuCounts.containsKey(fingerprint);
_recentDanmuFingerprints.addLast(fingerprint);
_recentDanmuCounts[fingerprint] =
    (_recentDanmuCounts[fingerprint] ?? 0) + 1;
```

判断重复只看 Map 里有没有这个指纹，平均 O(1)。新指纹进队列，同时计数加一。

窗口大小和步长来自设置：

```dart
final windowSize = settings.danmuDedupeWindow.value.clamp(1, 100);
final step = settings.danmuDedupeStep.value.clamp(1, 20);
```

对应设置在：

```text
simple_live_app/lib/app/controller/app_settings_controller.dart:1703
```

```dart
var danmuDedupeWindow = 10.obs;
void setDanmuDedupeWindow(int e) {
  final value = e.clamp(1, 100).toInt();
  danmuDedupeWindow.value = value;
}

var danmuDedupeStep = 2.obs;
void setDanmuDedupeStep(int e) {
  final value = e.clamp(1, 20).toInt();
  danmuDedupeStep.value = value;
}
```

窗口默认 10，步长默认 2。也就是说，不是每一条都裁剪窗口，而是按步长批量清理。这样能少一点高频操作。

清理时也不是只从队列里删，还要同步扣计数：

```dart
while (shouldPrune && _recentDanmuFingerprints.length > windowSize) {
  final removed = _recentDanmuFingerprints.removeFirst();
  final count = (_recentDanmuCounts[removed] ?? 0) - 1;
  if (count <= 0) {
    _recentDanmuCounts.remove(removed);
  } else {
    _recentDanmuCounts[removed] = count;
  }
}
```

否则 Map 会越看越大，长时间开直播间就会留下很多过期指纹。

### 指纹不能只看正文

弹幕现在不只是 `message` 字符串。B 站、抖音这类平台会有富文本片段、表情图、图片 URL。只看正文，会漏掉不少重复内容。

指纹构建在 `live_room_controller.dart:263`：

```dart
final message = _normalizeDanmuFingerprintPart(msg.message);
if (message.isNotEmpty) {
  parts.add("m:$message");
}
for (final span in msg.spans ?? const <LiveMessageSpan>[]) {
  final text = _normalizeDanmuFingerprintPart(span.text ?? "");
  final imageUrl = _normalizeDanmuFingerprintPart(span.imageUrl ?? "");
  if (text.isNotEmpty) {
    parts.add("t:$text");
  }
  if (imageUrl.isNotEmpty) {
    parts.add("i:$imageUrl");
  }
}
for (final imageUrl in msg.imageUrls ?? const <String>[]) {
  final value = _normalizeDanmuFingerprintPart(imageUrl);
  if (value.isNotEmpty) {
    parts.add("u:$value");
  }
}
```

最后拼上用户名：

```dart
return "$userName\u0001${parts.join("\u0002")}";
```

这里故意把用户名放进指纹。因为“不同观众发同一句话”不一定是刷屏，可能只是直播间气氛到了。现在的去重只处理“同一用户最近重复刷同一内容”。

另外文本会先规范化：

```dart
return value.trim().replaceAll(RegExp(r"\s+"), " ");
```

这能挡住一些靠多个空格绕过重复判断的情况。

## 四、WebDAV 恢复：上传成功不代表恢复成功

WebDAV 的问题更典型：用户反馈“能上传，但恢复不下来”。

这类问题很烦，因为“上传成功”很容易让人误以为 WebDAV 配置没问题。实际上上传和下载不是一条链路。服务端对 `PUT`、`GET`、流式读取、Content-Length 的处理都可能不一样。

恢复代码在：

```text
simple_live_app/lib/modules/sync/remote_sync/webdav/remote_sync_webdav_controller.dart:248
```

旧思路更偏向直接读远端文件到内存。后来改成先下载到临时文件：

```dart
final tempDir = await getTemporaryDirectory();
final downloadPath = join(
  tempDir.path,
  "simple_live_webdav_backup.zip",
);
final downloadFile = File(downloadPath);
if (downloadFile.existsSync()) {
  downloadFile.deleteSync();
}
await davClient.client.read2File(davClient.backupFile, downloadPath);
if (!downloadFile.existsSync() || downloadFile.lengthSync() <= 0) {
  throw const FormatException("WebDAV 备份文件下载失败");
}
final data = await downloadFile.readAsBytes();
final archive = _decodeWebDavBackupArchive(data);
```

这个改动不花哨，但稳。

它把链路拆成了几步：

```text
远端 backup.zip
-> 下载成本地临时文件
-> 检查文件存在和大小
-> 本地 readAsBytes()
-> ZipDecoder 解压
-> 导入配置
```

这样一来，如果失败，至少知道失败在哪一段。是没下载下来，还是 zip 解压失败，还是导入失败。

解压本身很简单：

```dart
Archive _decodeWebDavBackupArchive(List<int> data) {
  final zipDecoder = ZipDecoder();
  return zipDecoder.decodeBytes(data);
}
```

但另一个坑在 isolate。

之前想把解压丢到 `Isolate.run`，避免 UI 卡顿。想法没错，但 Dart isolate 有个限制：跨 isolate 的东西必须可发送。结果闭包里间接捕获了 `RemoteSyncWebDAVController`、`DAVClient` 这类对象，它们不能被发到另一个 isolate，于是恢复时会报类似：

```text
object is unsendable
```

最后这里没有继续硬上 isolate，而是让恢复流程在当前 isolate 里顺序执行。因为这个备份 zip 通常不大，相比“理论上更异步”，先把恢复链路做稳定更重要。

新备份里如果有完整配置包，就走：

```dart
final summary = await ProfileBackupService.instance.importProfileJson(
  utf8.decode(profileFile.content),
  overwrite: true,
  options: ProfileImportOptions(
    settings: true,
    follows: isSyncFollows.value,
    histories: isSyncHistories.value,
    shields: isSyncBlockWord.value,
    shieldPresets: isSyncBlockWord.value,
  ),
);
```

旧备份没有 `profile.json`，就继续按老 JSON 文件逐个恢复：

```dart
for (ArchiveFile file in archive) {
  await _recovery(file);
}
```

最后不管成功失败，都关 loading，并清掉临时 zip：

```dart
finally {
  SmartDialog.dismiss();
  try {
    final tempDir = await getTemporaryDirectory();
    final downloadFile =
        File(join(tempDir.path, "simple_live_webdav_backup.zip"));
    if (downloadFile.existsSync()) {
      downloadFile.deleteSync();
    }
  } catch (_) {}
}
```

这也是后来我越来越在意的一点：同步类功能失败时，不能只在日志里失败。用户至少要看到 loading 结束，看到一个能理解的错误。

## 五、这三个问题其实是一类问题

这三块看起来不相关：

- Windows 全屏是桌面窗口。
- 弹幕过滤是数据结构。
- WebDAV 恢复是网络和文件。

但修的时候，思路很像。

第一，别相信“一个 API 调用就是一个完整状态”。

`setFullScreen(true)` 不是完整全屏。它只是告诉系统我要全屏，后面还有窗口框、阴影、标题栏、最大化状态缓存。

第二，别让高频路径做线性蠢活。

弹幕每秒可能很多条。关键词可以简单，但重复去重不能每条都扫一遍最近列表。队列加计数表不复杂，但能把这个路径从“看弹幕量脸色”变成稳定的 O(1) 判断。

第三，别把远端流当本地文件用。

WebDAV 服务五花八门。直接读流看起来省事，但出了问题很难判断。下载到临时文件，再检查，再解压，步骤多了一点，定位清楚很多。

第四，别为了“更高级”牺牲可恢复性。

`Isolate.run` 听起来比当前 isolate 解压更漂亮，但一旦捕获了不可发送对象，恢复链路直接断。这里先让功能稳下来，比写一个看起来更现代的异步方案重要。

## 六、收尾

这次修完以后，我对这种问题的判断更保守了一点。

如果一个 bug 只在“最大化后再全屏”出现，那就不是全屏按钮坏了，是状态切换路径里有旧状态没清干净。  
如果一个功能“能上传但不能恢复”，那就不能只看登录和上传，要把下载、文件、解压、导入拆开。  
如果一个过滤逻辑要跑在直播间弹幕流里，那它就不是普通列表操作，而是高频路径。  

很多修复最后都不是大招，而是把状态拆细，把路径走完整，把失败点暴露出来。

这听起来不酷，但对一个每天要被人打开的工具来说，够用了。
