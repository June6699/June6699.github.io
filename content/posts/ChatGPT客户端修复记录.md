---
title: ChatGPT客户端修复记录
subtitle: 
date: 2026-11-10
author: June
tags:
    - 技术
    - 技术/工具
---

### 零、介绍

ChatGPT Windows 客户端通过 Microsoft Store 更新时，可能遇到 `0x80070005`，提示访问被拒绝。比较麻烦的是，更新失败不一定意味着安装包没有下载成功。有时新版文件已经部署到 WindowsApps，但应用注册没有完成，最终 `Get-AppxPackage` 显示 `Servicing`，甚至客户端无法正常启动。

这次遇到的故障与火绒安全软件的启动项管理有关。Windows 在注册 ChatGPT 的 Sandbox Service 时遇到访问拒绝，旧版本服务注册没有正确更新，导致服务路径仍然指向已经不存在的旧版程序文件。

最后没有卸载 ChatGPT，没有删除用户数据，也没有修改 WindowsApps 权限。将火绒中的服务设置为允许启动，然后通过 `Add-AppxPackage -Register` 重新注册现有应用清单，客户端就恢复了正常。

下面记录整个排查和修复过程。

### 一、问题现象

#### 1.1 Microsoft Store 更新失败

最初通过 Microsoft Store 更新 ChatGPT，更新过程中出现：

```txt
0x80070005
Access Denied
拒绝访问
```

尝试过开启代理、执行 `wsreset.exe`，但问题仍然存在。

随后使用 winget 检查更新：

```powershell
winget list --name ChatGPT
```

显示当前安装版本：

```txt
ChatGPT  9PLM9XGG6VKS  26.1103.4239.0  msstore
```

尝试更新：

```powershell
winget upgrade --id 9PLM9XGG6VKS -e --source msstore --accept-source-agreements --accept-package-agreements
```

返回：

```txt
找不到可用的升级。
配置的源中没有可用的较新的包版本。
```

这只能说明 winget 当前查询的 Store 源没有提供可用升级，不能据此断定客户端已经是最新版本，也不能说明本机的 MSIX 部署状态正常。

#### 1.2 重启后版本发生变化，但状态仍然异常

之后重启 Windows，重新查询：

```powershell
Get-AppxPackage -Name OpenAI.Codex |
Select-Object Name,Version,Status,InstallLocation
```

得到：

```txt
Name         : OpenAI.Codex
Version      : 26.1103.7773.0
Status       : Servicing
InstallLocation : C:\Program Files\WindowsApps\OpenAI.Codex_26.1103.7773.0_x64__2p2nqsd0c76g0
```

这里有两个重要信息：

1. Microsoft Store 的更新实际上已经将新版程序部署到了 WindowsApps。
2. 应用包状态仍然是 `Servicing`，说明部署或注册过程尚未正常完成。

需要注意，这次更新始终来自 Microsoft Store。此前虽然下载过独立的 MSIX 安装包并验证了数字签名，但并没有执行该安装包。

因此，问题不再是单纯的下载失败，而是要继续检查 Windows 的应用包注册过程。

### 二、MSIX 更新为什么会出现 Servicing

#### 2.1 ChatGPT 的 Windows 安装方式

通过 Microsoft Store 安装的 ChatGPT 属于 MSIX 应用包，由 Windows 的 AppX 部署系统管理。

可以使用以下命令查询安装信息：

```powershell
Get-AppxPackage -Name OpenAI.Codex |
Format-List Name,Version,PackageFullName,PackageFamilyName,InstallLocation,Status
```

这里有几个需要关注的字段：

| 字段              | 含义           |
| ----------------- | -------------- |
| Name              | 应用包名称     |
| Version           | 当前应用包版本 |
| PackageFullName   | 包完整名称     |
| PackageFamilyName | 包族名称       |
| InstallLocation   | 应用包安装位置 |
| Status            | 当前包状态     |

本例中的应用包名称是：

```txt
OpenAI.Codex
```

安装目录位于：

```
C:\Program Files\WindowsApps\
```

这是 Windows 管理的 MSIX 应用包目录，不是普通 EXE 软件可以任意指定的安装目录。

#### 2.2 ChatGPT 不只有主程序，还有打包服务

这次故障最关键的组件是：

```txt
CodexSandboxService.OpenAI.Codex
```

它是 ChatGPT Windows 客户端声明的打包服务（Packaged Service），对应的程序文件为：

```txt
codex-windows-sandbox-service.exe
```

该服务由 Windows 的 MSIX 部署机制进行注册和管理，使用 LocalSystem 账户运行，主要服务于客户端的 Windows 沙箱相关功能。

查看服务配置：

```powershell
sc.exe qc CodexSandboxService.OpenAI.Codex
```

正常情况下，可以看到类似：

```txt
SERVICE_NAME: CodexSandboxService.OpenAI.Codex

TYPE               : 210  WIN32_PACKAGED_PROCESS
START_TYPE         : 2   AUTO_START
DISPLAY_NAME       : ChatGPT
SERVICE_START_NAME : LocalSystem
```

其中最重要的是：

```txt
BINARY_PATH_NAME
```

它指定了 Sandbox Service 实际执行文件的位置。

MSIX 更新时，除了更新应用本身，还需要正确处理应用声明的服务注册。如果这个环节失败，即使新版应用文件已经存在，也可能导致整个应用包无法完成注册。

### 三、通过 AppX 部署日志定位故障

#### 3.1 查询 AppX 部署日志

Windows 会记录应用包安装、更新、注册和卸载过程。

在事件查看器中，可以进入：

```txt
事件查看器
  → 应用程序和服务日志
    → Microsoft
      → Windows
        → AppXDeployment-Server
          → Operational
```

也可以直接使用 PowerShell 查询：

```powershell
$since = (Get-Date).AddHours(-6)

Get-WinEvent -FilterHashtable @{
    LogName = 'Microsoft-Windows-AppXDeploymentServer/Operational'
    StartTime = $since
} -ErrorAction SilentlyContinue |
Where-Object {
    $_.Message -match 'OpenAI.Codex|0x80070005|0x80073CF6'
} |
Select-Object -First 20 TimeCreated,Id,LevelDisplayName,Message |
Format-List
```

这里将最近 6 小时的相关部署日志筛选出来。

#### 3.2 重点关注哪些错误

这次实际遇到了以下事件：

| 事件 ID | 错误码     | 日志含义                              |
| ------- | ---------- | ------------------------------------- |
| 306     | 0x80070005 | 注册 windows.service 扩展时访问被拒绝 |
| 316     | 0x80070005 | 服务扩展注册失败                      |
| 404     | 0x80073CF6 | 整个应用包注册失败                    |
| 821     | 0x80073CF6 | 当前用户的应用包注册失败              |
| 822     | 0x0        | 注册表更新这个子步骤成功              |
| 649     | -          | Windows 尝试修复应用安装目录的 ACL    |

最关键的日志是：

```txt
错误 0x80070005:

在处理请求时，由于以下错误，
系统无法注册 windows.service 扩展：
拒绝访问。
```

这里需要区分两个错误码：

- `0x80070005`：Access Denied，访问被拒绝。
- `0x80073CF6`：ERROR_INSTALL_REGISTRATION_FAILURE，应用包注册失败。

前者是具体的访问拒绝错误，后者是整个 MSIX 注册操作失败的结果。

另外，事件 649 显示：

```txt
ACLs repaired successfully

Register next time should succeed.
```

这说明 Windows 尝试修复新版应用目录的访问控制列表（ACL），但并不意味着整个应用注册已经成功。

事件 822 返回 `0x0` 也只是一个子操作成功，不能代表整个注册流程完成。

#### 3.3 查看 Sandbox Service 是否仍然指向旧版本

接下来检查 Windows 服务配置：

```powershell
sc.exe qc CodexSandboxService.OpenAI.Codex
```

当时得到的结果是：

```txt
SERVICE_NAME: CodexSandboxService.OpenAI.Codex

BINARY_PATH_NAME:
C:\Program Files\WindowsApps\OpenAI.Codex_26.1103.3517.0_x64__2p2nqsd0c76g0\app\resources\codex-windows-sandbox-service.exe
```

但是当前应用包版本已经是：

```txt
26.1103.7773.0
```

也就是说，ChatGPT 主程序已经更新到新版，但 Sandbox Service 仍然指向：

```txt
26.1103.3517.0
```

这就出现了版本不一致。

#### 3.4 检查旧版和新版服务文件

进一步检查两个版本的服务程序是否存在：

```powershell
$old = "C:\Program Files\WindowsApps\OpenAI.Codex_26.1103.3517.0_x64__2p2nqsd0c76g0\app\resources\codex-windows-sandbox-service.exe"

$new = "C:\Program Files\WindowsApps\OpenAI.Codex_26.1103.7773.0_x64__2p2nqsd0c76g0\app\resources\codex-windows-sandbox-service.exe"

[PSCustomObject]@{
    OldServiceExists = Test-Path -LiteralPath $old
    NewServiceExists = Test-Path -LiteralPath $new
}
```

输出：

```txt
OldServiceExists NewServiceExists
---------------- ----------------
False            True
```

这意味着：

- 旧版服务文件已经不存在。
- 新版服务文件已经部署成功。
- Windows 服务注册项却仍然保留旧版路径。

这也是本次排查中最关键的证据之一。

### 四、定位到火绒安全软件

#### 4.1 检查火绒启动项管理

到这里，已经基本确定问题集中在 Sandbox Service 的注册过程。

进一步检查火绒安全软件：

```txt
火绒安全软件
  → 安全工具
    → 启动项管理
      → 服务
```

找到：

```txt
CodexSandboxService.OpenAI.Codex
```

可以看到对应启动项被标记为无效，并且原先处于禁止启动的状态。

结合之前的 AppX 部署日志，可以将两个现象联系起来：

1. Windows 注册 `windows.service` 扩展时出现 `0x80070005`。
2. 火绒启动项管理中，ChatGPT 的 Sandbox Service 被禁止启动。

将该服务设置为：

```txt
允许启用
```

之后，再进行 MSIX 应用包重新注册。

#### 4.2 为什么认为火绒是这次故障的主要原因

这里的判断并不是仅凭火绒界面上的一个红色提示。

本机有三组相互支持的证据：

1. AppX 日志明确记录了 `windows.service` 扩展注册时访问被拒绝。
2. Windows 服务注册仍然指向已不存在的旧版 EXE。
3. 火绒中发现对应服务被禁止启动，改为允许后重新注册成功，服务最终恢复正常。

这与 OpenAI Codex GitHub 上的相关问题高度吻合：

[GitHub Issue #53132：ChatGPT/Codex MSIX installation repeatedly fails with 0x80073CF6 / 0x80070005](https://github.com/openai/codex/issues/53132)

该问题中也有用户报告了火绒启动项管理与 ChatGPT 打包服务注册冲突的情况。

需要说明的是，本次没有使用 Process Monitor（ProcMon）捕获具体被拒绝的底层注册表操作，因此无法确认火绒内部究竟是哪条规则拦截了哪个系统调用。更严谨的结论是：火绒对该服务的启动限制与 MSIX 服务注册失败高度相关，解除限制后重新注册成功。

### 五、修复 ChatGPT 的 MSIX 注册

#### 5.1 先备份服务注册表项

在修改系统状态之前，可以先备份对应服务的注册表项。

以管理员身份打开 PowerShell，执行：

```powershell
$backup = "$env:USERPROFILE\CodexSandboxService-backup.reg"
```

然后导出：

```powershell
reg.exe export "HKLM\SYSTEM\CurrentControlSet\Services\CodexSandboxService.OpenAI.Codex" "$backup" /y
```

检查文件：

```powershell
Test-Path -LiteralPath $backup
```

返回：

```txt
True
```

说明备份成功。

本次实际修复并没有删除或修改这个注册表项。这一步主要是为了在需要进一步排查时保留原始配置。

#### 5.2 在火绒中允许 Sandbox Service 启动

在火绒中找到：

```txt
CodexSandboxService.OpenAI.Codex
```

将其设置为：

```txt
允许启用
```

不要为了更新 ChatGPT 而直接关闭整个安全软件，也不需要修改 WindowsApps 目录权限。

#### 5.3 重新注册已经部署的应用包

这一步是整个修复过程的核心。

使用**管理员权限**打开 PowerShell，执行：

```powershell
$app = Get-AppxPackage -Name OpenAI.Codex; Add-AppxPackage -Register (Join-Path $app.InstallLocation 'AppxManifest.xml') -DisableDevelopmentMode -ForceApplicationShutdown -ErrorAction Stop; Get-AppxPackage -Name OpenAI.Codex | Format-List Name,Version,Status
```

这条命令包含三个步骤：

1. 使用 `Get-AppxPackage` 获取当前已经安装的 ChatGPT 应用包。
2. 根据当前安装目录中的 `AppxManifest.xml` 重新注册应用。
3. 查询注册完成后的版本和状态。

这里最关键的参数是：

| 参数                        | 作用                                             |
| --------------------------- | ------------------------------------------------ |
| `-Register`                 | 根据应用清单执行注册                             |
| `-DisableDevelopmentMode`   | 按现有已部署应用包进行注册，而不是按开发模式处理 |
| `-ForceApplicationShutdown` | 必要时关闭与应用包相关的运行进程                 |
| `-ErrorAction Stop`         | 遇到错误时停止执行后续命令                       |

这次使用的是已经存在于 WindowsApps 中的新版应用清单，不是重新安装一个下载的 MSIX 文件。

Microsoft 官方文档也明确说明，可以通过 `Add-AppxPackage -Register -DisableDevelopmentMode` 重新注册已经部署、未能正常注册或状态异常的应用包：

[Microsoft Learn：Add-AppxPackage](https://learn.microsoft.com/en-us/powershell/module/appx/add-appxpackage)

执行成功后，返回：

```txt
Name    : OpenAI.Codex
Version : 26.1103.7773.0
Status  : Ok
```

到这里，ChatGPT 的应用包状态已经恢复正常。

### 六、检查修复结果

修复之后不能只看 `Status : Ok`，还需要确认 Sandbox Service 是否也已经指向新版。

#### 6.1 检查应用包状态

```powershell
Get-AppxPackage -Name OpenAI.Codex |
Format-List Name,Version,Status,InstallLocation
```

正常结果：

```txt
Name    : OpenAI.Codex
Version : 26.1103.7773.0
Status  : Ok
```

#### 6.2 检查服务配置

```powershell
sc.exe qc CodexSandboxService.OpenAI.Codex
```

重点检查：

```txt
START_TYPE         : 2   AUTO_START

BINARY_PATH_NAME   : C:\Program Files\WindowsApps\OpenAI.Codex_26.1103.7773.0_x64__2p2nqsd0c76g0\app\resources\codex-windows-sandbox-service.exe
```

原来指向 `26.1103.3517.0` 的服务路径已经更新到了 `26.1103.7773.0`。

#### 6.3 检查服务运行状态

```powershell
sc.exe query CodexSandboxService.OpenAI.Codex
```

正常结果：

```txt
SERVICE_NAME: CodexSandboxService.OpenAI.Codex

STATE              : 4  RUNNING
WIN32_EXIT_CODE    : 0  (0x0)
SERVICE_EXIT_CODE  : 0  (0x0)
```

其中：

- `RUNNING` 表示服务正在运行。
- `WIN32_EXIT_CODE = 0` 表示服务没有报告 Win32 错误。

#### 6.4 检查注册表中的服务路径

```powershell
Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\CodexSandboxService.OpenAI.Codex' |
Format-List ImagePath,PackageFullName,DisplayName,Start,Type
```

正常情况下，应当看到：

```txt
ImagePath       : "...OpenAI.Codex_26.1103.7773.0_x64__2p2nqsd0c76g0\app\resources\codex-windows-sandbox-service.exe"

PackageFullName : OpenAI.Codex_26.1103.7773.0_x64__2p2nqsd0c76g0

DisplayName     : ChatGPT

Start           : 2

Type            : 528
```

也可以直接检查 EXE 文件：

```powershell
$k = 'HKLM:\SYSTEM\CurrentControlSet\Services\CodexSandboxService.OpenAI.Codex'

$p = (Get-ItemProperty -LiteralPath $k).ImagePath.Trim('"')

[PSCustomObject]@{
    ServiceExecutable = $p
    FileExists = Test-Path -LiteralPath $p
}
```

预期：

```txt
FileExists : True
```

#### 6.5 从 Windows 服务管理器再次确认

还可以使用 CIM 查询：

```powershell
Get-CimInstance Win32_Service -Filter "Name='CodexSandboxService.OpenAI.Codex'" |
Format-List Name,DisplayName,State,StartMode,PathName,StartName
```

本次最终结果：

```txt
Name        : CodexSandboxService.OpenAI.Codex
DisplayName : ChatGPT
State       : Running
StartMode   : Auto
PathName    : ...26.1103.7773.0...\codex-windows-sandbox-service.exe
StartName   : LocalSystem
```

最后重启 Windows，再次检查应用包状态和服务运行状态。

本次重启之后，两项仍然正常：

```txt
OpenAI.Codex
Version : 26.1103.7773.0
Status  : Ok
CodexSandboxService.OpenAI.Codex
STATE : 4 RUNNING
WIN32_EXIT_CODE : 0
```

火绒启动项管理中也重新识别出了 ChatGPT 服务，不再显示之前的无效启动项。

### 七、总结

这次故障不是简单的 Microsoft Store 下载问题，而是新版 MSIX 应用包部署之后，打包服务注册环节出现了访问拒绝。

整个过程可以概括为：

```txt
Microsoft Store 更新 ChatGPT
          |
          v
新版 MSIX 文件部署完成
          |
          v
Windows 注册 windows.service 扩展
          |
          v
      0x80070005
       Access Denied
          |
          v
应用包注册失败
          |
          v
旧版 Sandbox Service 注册残留
          |
          v
服务路径指向已经不存在的 EXE
          |
          v
检查火绒启动项管理
          |
          v
将 Sandbox Service 设置为允许启用
          |
          v
Add-AppxPackage -Register
          |
          v
新版应用包重新注册成功
          |
          v
Status : Ok
Service : RUNNING
```

遇到类似问题时，建议按照以下顺序排查：

1. 使用 `Get-AppxPackage` 确认应用版本和状态。
2. 使用 AppXDeploymentServer 日志确定注册失败的具体阶段。
3. 使用 `sc.exe qc` 检查 Sandbox Service 是否指向旧版本。
4. 检查旧版 EXE 是否已经不存在。
5. 检查火绒等安全软件是否禁止了对应服务启动。
6. 允许服务启动后，使用 `Add-AppxPackage -Register` 重新注册现有应用包。
7. 最后检查 `Status`、服务路径、运行状态，并在重启后再次确认。

本次没有通过卸载重装解决问题，也没有删除注册表项、修改 WindowsApps 权限或清空应用数据。

**对于 MSIX 应用，安装包文件存在不代表注册过程已经完成。遇到更新失败时，应当先通过 AppX 部署日志定位具体失败环节，再决定如何修复，而不是直接卸载整个应用。**

### 参考资料

- [Microsoft Learn：MSIX Troubleshooting Guide](https://learn.microsoft.com/en-us/windows/msix/msix-troubleshooting-guide)
- [Microsoft Learn：Add-AppxPackage](https://learn.microsoft.com/en-us/powershell/module/appx/add-appxpackage)
- [OpenAI Codex GitHub Issue #53132：ChatGPT/Codex MSIX installation repeatedly fails with 0x80073CF6 / 0x80070005](https://github.com/openai/codex/issues/53132)