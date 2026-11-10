---
title:      Simple Live 关闭窗口弹出 Unknown Hard Error：一次搜狗输入法引出的排查
subtitle:   从一条只有 8 秒的日志，到事件查看器里的 SogouPY.ime，再顺手修好中文输入法下的快捷键
date:       2026-10-26
author:     Claude & June
tags:
    - 技术
    - 技术/Flutter
    - 技术/Windows
    - 技术/开源
---

阅读说明：本文按排查顺序记录。前半部分讲关闭窗口时的系统错误弹窗，后半部分讲排查中顺带发现的另一个问题：桌面端快捷键在中文输入法下不能用。两个问题都和输入法有关，但原因并不相同。

## 一、问题展示

[Simple Live](https://github.com/June6699/dart_simple_live) 的 Windows 版收到一条反馈：每次关闭窗口都会弹出一个系统错误框，标题是 "unknown hard error"。卸载重装、更新到最新的 1.13.2 都没有用。

该问题，曾在两个issue中均出现，[Issue 151](https://github.com/June6699/dart_simple_live/issues/151)、[Issue 59](https://github.com/June6699/dart_simple_live/issues/59)，在排查该问题的过程中，还发现了另一个搜狗输入法导致的应用程序错误，尽管没有弹窗。

![关闭窗口时弹出的 Unknown Hard Error 对话框](<./images/Simple Live 关闭窗口弹出 Unknown Hard Error-搜狗输入法与桌面快捷键/01-unknown-hard-error.png>)


用户附带的应用日志很短，去掉系统信息只剩一行：

```text
Current Time: 2026-10-26 03:15:04.465919
...
[DEBUG] 03:15:12：SyncService close
```

几个细节值得注意：

- 从启动到关闭只有 8 秒。
- 日志里没有"播放器关闭"。如果用户进过直播间，关闭流程会打出这一行，所以这次大概率根本没打开过播放器。
- 系统信息里写的是 "Windows 10 Pro for Workstations"，但 build 号是 26200，`displayVersion` 是 25H2，其实是 Windows 11。这是版本 API 的老问题，复现环境要按 Win11 25H2 准备。

## 二、第一个怀疑对象：mpv

就在两天前，项目刚修过一个很像的问题：Windows 关闭应用时偶发"快速异常检测失败"（fast-fail）弹窗。那次的原因是 media_kit 在 `Player.dispose` 之后默认延迟 5 秒才调用 `mpv_terminate_destroy`。进程在这 5 秒内退出，mpv 的内部线程还在跑，DLL 卸载时触发 fast-fail。修复办法是退出前主动给 mpv 发 `quit`，等到 `MPV_EVENT_SHUTDOWN` 再继续。

但这个方向很快就对不上了：

1. 这次的日志说明没有创建过播放器，mpv 的线程根本不存在。
2. 那个修复不在 1.13.2 里。1.13.2 的版本号定在更早的提交上，修复要到 1.13.3 才发布。所以用户说"更新到最新也不行"，是因为拿到的版本里本来就没有这个修复。不过就算拿到了，也解决不了没开播放器时的崩溃。

## 三、日志为什么什么都看不到

先看关闭流程。桌面端拦截了窗口关闭事件，按顺序做收尾：

```text
保存窗口位置 → 关闭播放器 → 关闭同步服务 → 关闭日志写入 → 真正关闭窗口
```

最后一行日志 `SyncService close` 之后，日志写入就关了。后面还有很长一段路：窗口销毁、Flutter 引擎关闭、`wWinMain` 返回、C 运行库清理、所有 DLL 卸载。这一段完全是原生代码，Dart 的日志看不见。

"Unknown Hard Error" 恰好出现在这一段：进程退出时原生代码崩溃，由系统弹出硬错误框。应用日志在这里帮不上忙，得看 Windows 自己的记录。

## 四、事件查看器：真正的出错模块

Windows 的应用程序崩溃会记录到事件查看器的"应用程序"日志里，事件 ID 是 1000（Application Error）。打开方式：

1. `Win + R` 输入 `eventvwr.msc`；
2. 左侧选择"Windows 日志 → 应用程序"；
3. 右侧"筛选当前日志"，事件 ID 填 `1000`。

![image-20261026151702188](<./images/Simple Live 关闭窗口弹出 Unknown Hard Error-搜狗输入法与桌面快捷键/image-20261026151702188.png>)

![image-20261026151831261](<./images/Simple Live 关闭窗口弹出 Unknown Hard Error-搜狗输入法与桌面快捷键/image-20261026151831261.png>)

![image-20261026151859453](<./images/Simple Live 关闭窗口弹出 Unknown Hard Error-搜狗输入法与桌面快捷键/image-20261026151859453.png>)

项目作者 June 在自己的电脑上也复现了这个问题，筛出来的记录是这样的：

```text
出错应用程序名称： simple_live_app.exe，版本： 1.13.1.11301
出错模块名称：     SogouPY.ime，版本： 16.8.0.5351
异常代码：         0xc0000005
错误偏移：         0x0000000000574351
Faulting 模块路径： C:\WINDOWS\system32\SogouPY.ime
```

![image-20261026151927859](<./images/Simple Live 关闭窗口弹出 Unknown Hard Error-搜狗输入法与桌面快捷键/image-20261026151927859.png>)

出错模块不是 `simple_live_app.exe`，不是 `flutter_windows.dll`，也不是 `libmpv-2.dll`，而是搜狗拼音输入法。`0xc0000005` 是访问冲突，偏移落在搜狗自己的代码里，说明是它的代码读写了无效地址。

如果事件 1000 信息不够，还可以按微软文档 [Collecting User-Mode Dumps](https://learn.microsoft.com/en-us/windows/win32/wer/collecting-user-mode-dumps) 在注册表里打开 WER LocalDumps，让系统在崩溃时自动保存 dump。这次的事件记录已经足够定位，没有用到这一步。

## 五、搜狗为什么会出现在我们的进程里

`SogouPY.ime` 扩展名叫 `.ime`，本质上就是一个 DLL。Windows 的输入法框架（IMM32 / TSF）在窗口获得键盘焦点时，会把当前输入法的模块加载进这个进程，让它处理按键、组字和候选框。

所以它不是 Simple Live 主动加载的，而是系统放进来的，任何有窗口的程序都一样。这也解释了几个现象：

- **卸载重装、升级都没用**：问题不在安装包里，而在用户机器上装的输入法。
- **只有部分用户遇到**：只有装了搜狗、并且是会触发这个问题的版本的电脑才会出现。
- **启动 8 秒就关也会崩**：只要窗口拿到过焦点，搜狗就已经被加载，和进不进直播间无关。

## 六、正常退出时，搜狗在哪一步崩了

程序从 `wWinMain` 返回后，C 运行库会调用 `ExitProcess`。按 [ExitProcess 文档](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-exitprocess) 的描述，它大致会做这几件事：

1. 结束进程里除调用线程以外的所有线程，**这些线程不会收到任何通知**，直接停止；
2. 对每个已加载的 DLL 调用入口函数，参数是 `DLL_PROCESS_DETACH`，让它们清理；
3. 最后结束进程。

搜狗就崩在第 2 步。它是闭源的，没有符号，没法确定具体是哪一行。但这类崩溃的常见原因，[DllMain 文档](https://learn.microsoft.com/en-us/windows/win32/dlls/dllmain) 和 [DLL 最佳实践](https://learn.microsoft.com/en-us/windows/win32/dlls/dynamic-link-library-best-practices) 里都提到过：

- 清理代码在等自己的后台线程，或者在用那些线程持有的对象，而这些线程在第 1 步已经被强行结束了；
- 它要用的窗口、COM 或 TSF 对象已经释放。Simple Live 退出前已经销毁了窗口，也调用了 `CoUninitialize`；
- 析构顺序依赖别的模块，而那些模块已经先卸载了。

Raymond Chen 在 [The Old New Thing](https://devblogs.microsoft.com/oldnewthing/20120105-00/?p=8683) 里写过很多次：进程正在退出时，DLL 在 `DLL_PROCESS_DETACH` 里做复杂清理是很危险的，因为周围的世界已经塌了一半。

至于为什么弹的是 "Unknown Hard Error"，而不是常见的"程序已停止工作"：崩溃发生时进程已经在拆除阶段，没法走正常的崩溃对话框流程，只能由系统进程 csrss 弹一个"硬错误"框。错误信息又解析不出来，就显示成了 Unknown。

那为什么别的程序很少遇到？很多程序退出时本来就会直接结束进程，或者退出顺序刚好没踩中搜狗的问题。Simple Live 用的是 Flutter 的标准 Windows 退出流程，碰巧踩中了。

## 七、修复：退出时不再给 DLL 卸载的机会

既然崩溃发生在 `DLL_PROCESS_DETACH` 阶段，最直接的办法就是跳过这个阶段。[TerminateProcess](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess) 和 `ExitProcess` 的关键区别是：它不会通知任何 DLL，由内核直接回收整个进程。内存、句柄、文件这些资源照样会被释放，不会泄漏。

改动在 Windows runner 的 `main.cpp`，消息循环结束之后：

```cpp
  if (com_initialized) {
    ::CoUninitialize();
  }
  if (primary_instance_mutex != nullptr) {
    if (!secondary_instance) {
      ::ReleaseMutex(primary_instance_mutex);
    }
    ::CloseHandle(primary_instance_mutex);
  }
  // The window and the Flutter engine are already destroyed here. Terminate
  // directly instead of returning: a normal exit runs DLL_PROCESS_DETACH for
  // every loaded module, and third-party IME modules injected into the process
  // (e.g. SogouPY.ime) can crash there, showing "Unknown Hard Error" on close.
  ::TerminateProcess(::GetCurrentProcess(), EXIT_SUCCESS);
  return EXIT_SUCCESS;
```

代价是所有 DLL 都没有机会在退出时做收尾，所以调用时机很重要。走到这里时：

- 窗口已经销毁，Flutter 引擎已经关闭，Dart isolate 也跟着结束了；
- 播放器、同步服务、日志写入都在 Dart 层的关闭流程里处理完了；
- 互斥锁已经释放，COM 已经反初始化。

已经没有需要靠 DLL 卸载来完成的工作，直接结束是安全的。

这个办法也有局限：如果搜狗是在窗口销毁（`WM_DESTROY`）的时候就崩了，而不是在 DLL 卸载阶段，这一步就拦不住。这一点只能实测。June 在装了搜狗的电脑上测了首页直接关闭、进直播间后关闭两种情况，都不再弹窗，说明崩溃确实发生在卸载阶段。

## 八、顺带发现：快捷键为什么要先切英文

看到出错模块是输入法，June 的第一反应是：会不会是快捷键那段"禁用输入法"的代码搞出来的？June 平时在直播间用 F（全屏）、R（刷新）这些单键快捷键，一直都得先切回英文才行。这个一直没有找到bug在哪里，为什么必须切换输入法才能用，因为之前逻辑已经临时禁用了输入法的。

结论：崩溃和这段代码无关。上面那位用户启动 8 秒就关、没进过直播间，而快捷键捕获只在直播间里才会开启，禁用输入法的代码根本没执行过，照样崩了。

不过顺着这个怀疑去读代码，确实发现快捷键这一套从来没生效过。

### 8.1 拦截挂错了窗口

Flutter 的 Windows runner 有两层窗口：外面是顶层窗口（标题栏、边框），里面是 Flutter 的视图子窗口。顶层窗口激活时会把焦点交给子窗口：

```cpp
case WM_ACTIVATE:
  if (child_content_ != nullptr) {
    SetFocus(child_content_);
  }
  return 0;
```

键盘消息只发给有焦点的窗口，也就是子窗口。而原来的两段代码都挂在顶层窗口上：

- `ImmAssociateContext(顶层窗口, nullptr)` 只摘掉了顶层窗口的输入法，子窗口上的搜狗照样在工作；
- 在顶层窗口的 `MessageHandler` 里处理 `WM_KEYDOWN`，可这个消息根本不会发到顶层窗口。

原生这条快捷键通道实际上从来没触发过，一直是 Dart 层的 `KeyboardListener` 在兜底。中文模式下，搜狗把 F、R 当成拼音的开头吃掉了，Flutter 拿不到按键，所以只能先切英文。

### 8.2 Windows：在输入法之前拦下按键

修复分两步。

第一步，输入法改为从真正持有焦点的子窗口上摘除。用 [ImmAssociateContextEx](https://learn.microsoft.com/en-us/windows/win32/api/imm/nf-imm-immassociatecontextex) 传 `nullptr` 摘除，恢复时传 `IACE_DEFAULT`，不用自己保存原来的输入法上下文：

```cpp
HWND view = flutter_controller_->view()->GetNativeWindow();
// 开启捕获：摘掉子窗口的输入法
ImmAssociateContextEx(view, nullptr, 0);
// 关闭捕获（焦点进入输入框）：恢复默认输入法
ImmAssociateContextEx(view, nullptr, IACE_DEFAULT);
```

第二步，快捷键改在消息循环里、`TranslateMessage` 之前拦截。输入法组字发生在 `TranslateMessage` 里，在这之前把按键拿走，搜狗就没有机会把它变成拼音：

```cpp
while (::GetMessage(&msg, nullptr, 0, 0)) {
  if (window.PreTranslateShortcutMessage(msg)) {
    continue;  // 已作为快捷键处理，不再交给输入法和 Flutter
  }
  ::TranslateMessage(&msg);
  ::DispatchMessage(&msg);
}
```

`PreTranslateShortcutMessage` 里有几条规则：

- 只处理发给本窗口及其子窗口的 `WM_KEYDOWN` / `WM_KEYUP`；
- 只在快捷键捕获开启时拦截，也就是在直播间里、且焦点不在输入框时。点进弹幕输入框，Dart 层会关闭捕获，输入法恢复，可以正常打中文；
- 按住 Ctrl / Alt / Win 的组合键直接放行，不影响 Ctrl+C、Alt+F4 这类系统操作；
- 按扫描码识别物理键位，不依赖输入法翻译后的虚拟键码；
- 长按只触发一次（`lParam` 第 30 位表示自动重复），和 Flutter 的 `KeyDownEvent` 行为一致；
- 吞掉了按下事件的键，配对的抬起事件也一起吞掉，避免 Flutter 收到一个"没按下就抬起"的事件。窗口失去焦点时清空记录，防止残留。

### 8.3 macOS 和 Linux

macOS 和 Linux 的 runner 本来就是在系统输入法之前拦截的：macOS 用 [NSEvent 本地监听](<https://developer.apple.com/documentation/appkit/nsevent/addlocalmonitorforevents(matching:handler:)>)，Linux 在 GTK 的 `key-press-event` 信号里处理。拦截位置没问题，但规则有缺口，这次按 Windows 的规则统一了：

- **组合键没放行**：macOS 在直播间里按 Cmd+Q，会被当成快捷键 Q 吞掉，应用退不出去。Cmd+C、Cmd+M 同理。现在带 Cmd / Ctrl / Option（Linux 为 Ctrl / Alt / Super）的按键一律放行；
- **捕获关闭时也在发事件**：现在只在捕获开启时才处理，避免 Dart 层同步状态的间隙里一次按键触发两次；
- **缺空格键**：补上了空格（播放/暂停）；
- 长按只触发一次，按下和抬起成对吞掉，和 Windows 一致。

这两个平台本地编译不了，要走 GitHub Actions 构建再上真机验证。

## 九、小结

回头看，这次两个问题都是"代码看起来对，但作用在了错误的地方"：

- 用户发布的 “Unknown hard error” 问题其实并没有完全修复，或者说不确定是否修复完毕。但是通过这个问题，修复了其他的几个老毛病，具体这个issue提到的问题，还要看用户反馈，尽管该问题并非所有问题都出现。
- 应用日志在 Dart 层关闭流程的最后一步就停了，而崩溃发生在日志看不见的原生退出阶段。这种时候要直接去看事件查看器的事件 1000，不要盯着自己的日志猜；
- 出错模块是第三方注入的 DLL 时，没法去改它，能做的是不给它出错的机会。`TerminateProcess` 跳过 DLL 卸载，前提是在它之前，自己的收尾已经全部完成；
- 快捷键的代码挂在顶层窗口上，而焦点在子窗口上。写窗口相关的原生代码时，先确认消息到底发给了谁。

修复已经包含在 Simple Live v1.13.3 里，目前作为 [pre release](https://github.com/June6699/dart_simple_live/releases/tag/v1.13.3-pre-1026) 发布。

## 参考

- [ExitProcess function - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-exitprocess)
- [TerminateProcess function - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess)
- [DllMain entry point - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/dlls/dllmain)
- [Dynamic-Link Library Best Practices - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/dlls/dynamic-link-library-best-practices)
- [Collecting User-Mode Dumps - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/wer/collecting-user-mode-dumps)
- [ImmAssociateContextEx function - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/imm/nf-imm-immassociatecontextex)
- [When DLL_PROCESS_DETACH tells you that the process is exiting, your best bet is just to return without doing anything - The Old New Thing](https://devblogs.microsoft.com/oldnewthing/20120105-00/?p=8683)
- [addLocalMonitorForEvents(matching:handler:) - Apple Developer](<https://developer.apple.com/documentation/appkit/nsevent/addlocalmonitorforevents(matching:handler:)>)
- [June6699/dart_simple_live - GitHub](https://github.com/June6699/dart_simple_live)
