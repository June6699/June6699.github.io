---
title: 让 QQ Bot 主动给你发消息：关键不是 QQ 号，而是 openid
subtitle: OpenClaw 接入 QQ Bot 后，怎么找到真正能用的私聊 target
date: 2026-07-11
author: June
tags:
    - 技术
    - 技术/运维
    - 技术/工具
---

这次折腾 QQ Bot，最容易误会的一点是：

```text
配置好 AppID 和 Secret，不等于你已经知道消息要发给谁。
```

Bot 能上线，是一回事；它要主动给某个人发私聊，是另一回事。

我一开始也绕了弯。明明 QQ Bot 已经连上了，OpenClaw 里也显示 running、connected，但测试发送还是失败。后来才发现，我把自己的 QQ 号当成了收件人 target。QQ Bot 这边真正要用的不是裸 QQ 号，而是平台给这一段会话分配的 openid。

也就是说，最后能发消息的目标长这样：

```text
qqbot:c2c:<openid>
```

不是这样：

```text
3439394104
```

这篇就把这件事记下来，免得下次再把自己绕进去。

## 先把 Bot 接到 OpenClaw

QQ 开放平台里创建机器人后，会拿到两样东西：

```text
APPID
APPSecret
```

这两个值不要写进博客、仓库、截图，也不要发到群里。它们相当于这个 Bot 的钥匙。

OpenClaw 这边可以用 `channels add` 接进去：

```bash
openclaw channels add \
  --channel qqbot \
  --account default \
  --token "<APPID>:<APPSecret>" \
  --name "xianyu-qq-bot"
```

如果插件还没装，OpenClaw 会尝试准备 QQ Bot 插件。接完后先看状态：

```bash
openclaw channels status --deep
```

理想状态大概是：

```text
- QQ Bot default: enabled, configured, running, connected
```

如果只看到 installed，或者提示被 allowlist 拦住，就先去看 OpenClaw 配置。常见位置是：

```bash
/root/.openclaw/openclaw.json
```

里面的 `plugins.allow` 至少要包含：

```json
["xianyu", "qqbot"]
```

改完配置后重启网关：

```bash
openclaw gateway restart
```

这一步解决的是“Bot 能不能接上 OpenClaw”。它还没有解决“Bot 要发给谁”。

## 为什么 QQ 号不能直接用

我之前测试时填过自己的 QQ 号，结果报错大概是这样的：

```text
Unknown target "3439394104" for QQ Bot.
Hint: QQ Bot target format: qqbot:c2c:openid (direct) or qqbot:group:groupid (group)
```

这句其实已经把答案说完了。

QQ Bot 插件要的 target 是 OpenClaw 和 QQ 开放平台识别出来的会话目标。私聊是 `c2c`，群聊是 `group`。所以私聊目标应该是：

```text
qqbot:c2c:<openid>
```

群聊目标则是：

```text
qqbot:group:<groupid>
```

QQ 号是人看的，openid 是接口用的。这里不能混着用。

## 让对方先给 Bot 发一句话

最简单的办法，是让接收人先给这个 QQ Bot 发一条私聊。

内容随便，比如：

```text
111
```

这条消息进来后，OpenClaw 会把这段会话记录下来。之后就可以去会话文件里找真实 target。

我这次是在这里找到的：

```bash
/root/.openclaw/agents/main/sessions/sessions.json
```

里面会有类似这样的字段：

```json
{
  "origin": {
    "label": "qqbot:c2c:<openid>",
    "provider": "qqbot",
    "surface": "qqbot",
    "chatType": "direct",
    "from": "qqbot:c2c:<openid>",
    "to": "qqbot:c2c:<openid>",
    "accountId": "default"
  },
  "lastTo": "qqbot:c2c:<openid>"
}
```

这里的 `lastTo` 就是可以拿来发消息的目标。

如果只是临时排查，可以直接搜：

```bash
grep -n "qqbot:c2c:" /root/.openclaw/agents/main/sessions/sessions.json
```

找到以后，不要把完整 openid 写进公开仓库。自己服务器上的 `.env` 可以放，博客和文档里用占位符就好。

## 把 target 写到业务配置

我的闲鱼 Bot 是通过环境变量决定通知发给谁。关键是这几个：

```env
XIANYU_ENABLE_MESSAGE_NOTIFY=true
OPENCLAW_BIN=openclaw
JUNE_QQ_TARGET_ID=qqbot:c2c:<openid>
```

如果有备用变量，也可以一起写：

```env
XIANYU_QQ_TARGET_ID=qqbot:c2c:<openid>
```

注意，`JUNE_QQ_TARGET_ID` 这里不要再填 QQ 号。要填完整的 `qqbot:c2c:<openid>`。

写完后，如果服务是 systemd 跑的，就重启业务服务：

```bash
systemctl restart xianyu-bot.service
```

如果只是 OpenClaw 通道配置变了，就重启 OpenClaw gateway：

```bash
openclaw gateway restart
```

具体重启哪个，看你改的是业务 `.env`，还是 OpenClaw 的 `openclaw.json`。

## 先发一条测试消息

不要一上来就跑周报。周报内容长，出了问题不好判断。

先发一条短消息：

```bash
openclaw message send \
  --channel qqbot \
  --target "qqbot:c2c:<openid>" \
  --message "QQ Bot 通知测试"
```

如果业务里已经封装了通知脚本，也可以用自己的测试脚本。例如我的闲鱼 Bot 里有一个：

```bash
cd /opt/xianyu-openclaw-channel
.venv/bin/python ops_toolbox/5.qq_notify_test.py --send
```

这里有一个小坑：很多测试脚本默认只是预览，必须加 `--send` 才是真的发送。

终端里看到类似下面这样，才算真的通了：

```text
发送结果: True
QQ 私聊通知已发送
```

最好再去 QQ 里看一眼，确认 Bot 那边真的收到了。

## 周报也是同一条链路

周报本质上不是另一套东西。它只是把市场采样、售出记录、自我总结这些内容整理好，再调用同一个 QQ 通知能力发出去。

所以周报能不能发，先看三件事：

1. `qqbot` 通道是否 connected；
2. `.env` 里的 target 是否是 `qqbot:c2c:<openid>`；
3. 测试通知是否已经能发到 QQ。

定时器可以这样看：

```bash
systemctl status xianyu-weekly-report.timer
systemctl list-timers --all xianyu-weekly-report.timer --no-pager
```

手动跑周报前，先确认你真的想发送，不是只想看预览：

```bash
cd /opt/xianyu-openclaw-channel
bash ops_toolbox/4.run_weekly_report_send.sh --send
```

如果只是调试内容，先不要带 `--send`，否则 QQ 上会被刷屏。

## 这次真正踩到的坑

最后把几个坑放在一起：

- `APPID + APPSecret` 只是让 Bot 上线，不代表它知道要发给谁。
- 私聊 target 不是 QQ 号，而是 `qqbot:c2c:<openid>`。
- 新 Bot 和旧 Bot 的 openid 不能想当然复用。
- 用户先给 Bot 发一句话，OpenClaw 才更容易留下会话 target。
- `channels status --deep` 看到 connected，才算通道活着。
- 测试脚本要看清楚是不是预览模式，真实发送通常要加 `--send`。
- 公开文档里不要写真实 Secret、Cookie、openid。

这件事想明白后，其实不复杂。

QQ Bot 给人发消息，关键不是“知道他的 QQ 号”，而是“这段会话在平台里叫什么”。人用 QQ 号认人，接口用 openid 认人。把这两个概念分开，后面就顺了。

