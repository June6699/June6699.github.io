---
title: 一次 htop 段错误排查：LD_LIBRARY_PATH 和 Conda 动态库污染
date: 2026-05-21
author: June
tags:
    - 技术
    - 技术/Linux
    - 技术/运维
---

## 一、问题现场

晚上在一台 Rocky Linux 8.10 机器上看进程，随手敲了个：

```bash
htop
```

结果直接崩了：

```bash
段错误 (核心已转储)
```

第一反应一般会怀疑 `htop` 包坏了，或者 ncurses 这类终端库出了问题。先把基本信息看一遍：

```bash
which htop
# /usr/bin/htop

cat /etc/centos-release
# Rocky Linux release 8.10 (Green Obsidian)

rpm -qf $(command -v htop)
# htop-3.2.1-1.el8.x86_64

htop --version
# htop 3.2.1
```

路径是系统路径，包也是 EPEL 里的正常包。于是先重装：

```bash
sudo yum reinstall -y htop ncurses ncurses-libs
```

重装完成后再跑：

```bash
htop
# 段错误 (核心已转储)
```

问题还在。到这里基本可以先把“软件包下载坏了”这个方向放一边。

## 二、干净环境下 htop 能跑

下一步是排除配置和环境变量。先用一个尽量干净的环境启动 `htop`：

```bash
mkdir -p /tmp/htop-clean-home

env -i HOME=/tmp/htop-clean-home TERM=xterm-256color LANG=C LC_ALL=C /usr/bin/htop
```

这条命令能正常打开。

这就很关键了：如果 `htop` 本体或者系统的 ncurses 库真的坏了，干净环境下也应该崩。现在干净环境能跑，说明问题更像是当前 shell 里某个环境变量把运行时环境带歪了。

我又清掉 root 下可能存在的 htop 配置：

```bash
mv /root/.config/htop /root/.config/htop.bak.$(date +%s) 2>/dev/null
mv /root/.htoprc /root/.htoprc.bak.$(date +%s) 2>/dev/null
```

再跑普通的：

```bash
htop
# 段错误 (核心已转储)
```

配置文件也不是根因。

## 三、不是 TERM，也不是中文 locale

当时的终端和语言环境是：

```bash
echo "TERM=$TERM"
# TERM=xterm

locale
# LANG=zh_CN.UTF-8
# LC_CTYPE="zh_CN.UTF-8"
# ...
```

分别改 `TERM` 和 locale 测试：

```bash
TERM=xterm-256color htop
# 段错误 (核心已转储)

LANG=C LC_ALL=C htop
# 段错误 (核心已转储)

TERM=xterm-256color LANG=C LC_ALL=C htop
# 段错误 (核心已转储)
```

这些都不行。但下面这条可以：

```bash
env -i HOME=/root TERM=xterm-256color LANG=C LC_ALL=C /usr/bin/htop
```

这说明 `HOME=/root` 本身没问题，`TERM` 和 `LANG` 也不是主犯。真正的问题藏在其它环境变量里。

## 四、抓到元凶：LD_LIBRARY_PATH

把可疑环境变量列出来：

```bash
env | sort | egrep '^(LD_|XDG_|TERMINFO|NCURSES|HTOP|MALLOC_|GLIBC_|TERM=|LANG=|LC_)'
```

输出里有一行很扎眼：

```bash
LD_LIBRARY_PATH=/root/.conda/envs/dy_p39/lib:
```

验证一下：

```bash
env -u LD_LIBRARY_PATH htop
```

这次 `htop` 正常打开。

到这里根因就确定了：不是 `htop` 坏了，而是当前 shell 里全局设置了 `LD_LIBRARY_PATH`，让系统程序优先加载了 Conda 环境里的动态库。

## 五、LD_LIBRARY_PATH 到底做了什么

Linux 程序运行时，经常需要加载 `.so` 动态库。比如 `htop` 这种终端程序，会依赖 ncurses、libtinfo 这类库来处理终端界面。

正常情况下，系统会从默认库路径里找：

```bash
/lib64
/usr/lib64
```

但如果设置了 `LD_LIBRARY_PATH`，动态链接器会优先去这个变量指定的目录里找库。当前机器上的设置是：

```bash
LD_LIBRARY_PATH=/root/.conda/envs/dy_p39/lib:
```

这意味着运行 `/usr/bin/htop` 时，系统并不是老老实实先用 Rocky 自己的库，而是会先去这个 Conda 环境里找同名库。

Conda 环境里的库是给那个 Python 环境服务的，版本、编译选项、ABI 都可能和系统包不完全一致。系统程序一旦误加载了这些库，就可能出现很奇怪的问题：轻则报 symbol not found，重则直接段错误。

这次就是后者。

还有一个细节：这个变量最后有个冒号：

```bash
/root/.conda/envs/dy_p39/lib:
```

末尾空路径在不少场景下会被解释成当前目录。放在 root 环境里不是好习惯，也有额外风险。

## 六、临时解决

如果只是想马上用 `htop`，最简单：

```bash
env -u LD_LIBRARY_PATH htop
```

这条命令的意思是：运行 `htop` 时临时取消 `LD_LIBRARY_PATH`。

如果当前终端里不需要这个变量，也可以直接：

```bash
unset LD_LIBRARY_PATH
htop
```

这只影响当前 shell。重新登录后，如果配置文件里还写着那行 `export`，问题还会回来。

也可以给 `htop` 加一个 alias：

```bash
alias htop='env -u LD_LIBRARY_PATH /usr/bin/htop'
```

想让 alias 长期生效，可以写进 `~/.bashrc`：

```bash
echo "alias htop='env -u LD_LIBRARY_PATH /usr/bin/htop'" >> ~/.bashrc
source ~/.bashrc
```

不过这个只是绕过。真正该修的是全局环境变量。

## 七、永久解决

先找到是谁设置了 `LD_LIBRARY_PATH`：

```bash
grep -R "LD_LIBRARY_PATH" ~/.bashrc ~/.bash_profile ~/.profile /etc/profile /etc/profile.d 2>/dev/null
```

如果看到类似这样的行：

```bash
export LD_LIBRARY_PATH=/root/.conda/envs/dy_p39/lib:$LD_LIBRARY_PATH
```

或者：

```bash
export LD_LIBRARY_PATH=/root/.conda/envs/dy_p39/lib:
```

建议删掉，或者至少不要放在 root 的全局 shell 配置里。

Conda 环境应该通过激活来使用：

```bash
conda activate dy_p39
```

不要把某个 Conda 环境的 `lib` 目录长期挂到所有系统命令前面。这样影响的不是一个 Python 项目，而是整个 shell 里启动的所有程序。

如果某个环境确实需要额外设置 `LD_LIBRARY_PATH`，也应该把它限制在这个 Conda 环境激活之后。比如放到对应环境的 `activate.d` 脚本里，而不是写进 root 的 `.bashrc` 或 `/etc/profile`。

## 八、修完后怎么确认

重新登录一个终端，检查：

```bash
echo "$LD_LIBRARY_PATH"
```

确认里面不再有：

```bash
/root/.conda/envs/dy_p39/lib
```

再跑：

```bash
htop
```

如果普通 `htop` 可以正常打开，问题就解决了。

也可以做一个对照：

```bash
env -u LD_LIBRARY_PATH htop
```

如果取消 `LD_LIBRARY_PATH` 就正常，带上它就崩，那就说明根因确实是动态库搜索路径污染。

## 九、结论

这次 `htop` 段错误不是系统坏了，也不是 `htop` 包坏了，而是一个 Conda 环境的库路径被全局写进了 `LD_LIBRARY_PATH`。

`LD_LIBRARY_PATH` 这个变量很有用，但也很危险。它会改变动态库加载顺序，让系统程序优先吃到你指定目录里的 `.so`。如果这个目录来自 Conda、手动编译软件或者某个项目私有环境，就很容易污染系统命令。

临时处理用：

```bash
env -u LD_LIBRARY_PATH htop
```

永久处理是删掉全局配置里的那行 `LD_LIBRARY_PATH`，让 Conda 环境只在 `conda activate` 后影响自己该影响的程序。

但是你用htop不多也不需要。
