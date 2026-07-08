---
title: 给新服务器配 SSH 免密：它其实只是在认一把钥匙
subtitle: 不是把密码藏起来，而是让服务器提前认识你的公钥
date: 2026-07-08
author: June
tags:
    - 技术
    - 技术/运维
    - 技术/工具
---

新服务器到手后，第一件事通常不是装环境，而是把 SSH 登录整理干净。

密码登录能用，但它不适合每天敲。容易输错，也容易让人心里没底：这台机器到底配过没有？免密登录听起来像是“把密码省掉”，其实不是。它更像是提前给服务器留一张名单：这把公钥我认识，拿着对应私钥的人可以进。

## 先把原理想明白

SSH key 是一对东西：私钥留在本机，公钥放到服务器。

登录时，服务器不会让你把私钥发过去。它只是出一道题，让本机用私钥签名。签名能被服务器上的公钥验证通过，就放行。

所以整个过程真正要做的是三件事：

1. 本机生成一对 key；
2. 把公钥追加到服务器的 `~/.ssh/authorized_keys`；
3. 在本机的 `~/.ssh/config` 里写一个好记的别名。

私钥不能发给别人，也不要贴进聊天记录。公钥可以公开一些，但也没必要到处扔。

## 为什么加了公钥，还是要密码

这个坑很常见。

`authorized_keys` 里有你的公钥，不代表服务端一定会用它。OpenSSH 还有自己的配置开关。如果服务器上 `PubkeyAuthentication` 是 `no`，客户端再努力也没用，服务端会直接说：这里只接受密码。

排查时我一般不猜，直接看两边。

本地用 `-vvv` 看客户端有没有拿出正确的 key；服务器上用 `sshd -T` 看真实生效的配置。注意是 `sshd -T`，不是只看配置文件里写了什么。因为 `/etc/ssh/sshd_config.d/` 下面的小配置也可能覆盖主配置。

这一步有点像修灯。灯泡没坏，不代表墙上的开关是开的。

## 境外服务器先处理网络

如果服务器在境外，另一件事也要先想清楚：代理。

SSH 登录本身通常不需要在服务器上开代理，它只要端口能连通就行。但登录进去之后，你很可能要装软件、拉 GitHub 仓库、下载 Docker 镜像、访问包管理源。网络不顺的时候，报错会很像“命令坏了”，其实只是连不上。

我的习惯是先把基础代理或镜像源准备好，再继续装环境。不要一上来就怀疑 `apt`、`git`、`curl`。服务器网络是第一层地板，地板不平，后面每一步都跟着晃。

## 别名比记 IP 舒服

直接敲 `ssh <User>@<Your_IP>` 可以用，但用久了很烦。IP 不好记，端口、用户、私钥路径也容易敲错。

`~/.ssh/config` 的意义就在这里。你给这台机器起一个别名，以后只敲：

```powershell
ssh <Host_Alias>
```

背后的用户、IP、端口、私钥，全部写进配置。这样也方便给不同服务器用不同 key，不会把所有机器都混在一把钥匙里。

## 最后一组命令

下面这组是通用模板，按自己的情况替换占位符就行。

先在本机生成专用 key：

```powershell
ssh-keygen.exe -t ed25519 -a 100 -f "$env:USERPROFILE\.ssh\<Key_Name>" -C "<Host_Alias>"
```

如果不想每次登录都输入私钥口令，`Enter passphrase` 的时候直接回车两次。更稳一点的做法是设置 passphrase，然后用 `ssh-agent` 缓存。不过个人小服务器图省心的话，无口令 key 也常见，前提是私钥文件别乱放。

把公钥写到服务器：

```powershell
Get-Content -Raw -Encoding UTF8 "$env:USERPROFILE\.ssh\<Key_Name>.pub" |
  ssh.exe -o PreferredAuthentications=password -o PubkeyAuthentication=no <User>@<Your_IP> "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
```

如果服务端关了公钥登录，进服务器改：

```bash
sudo cp -a /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%Y%m%d-%H%M%S)
sudo nano /etc/ssh/sshd_config
```

确认有这一行：

```sshconfig
PubkeyAuthentication yes
```

检查配置并重载：

```bash
sudo sshd -t
sudo systemctl reload ssh || sudo systemctl restart ssh
```

本机写别名：

```sshconfig
Host <Host_Alias>
    HostName <Your_IP>
    User <User>
    Port 22
    IdentityFile ~/.ssh/<Key_Name>
    IdentitiesOnly yes
```

最后测试：

```powershell
ssh <Host_Alias>
```

如果还有问题，就别急着重来。先看 debug：

```powershell
ssh.exe -vvv -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\<Key_Name>" <User>@<Your_IP>
```

能看懂两行就够了：本地有没有 `Offering public key`，服务端有没有继续允许 `publickey`。这比凭感觉改配置靠谱多了。

免密不是魔法，也不是把密码藏到了什么地方。它只是把“我是谁”从一串要背的字符，换成了一把本机保存的钥匙。机器认钥匙，人少受罪。