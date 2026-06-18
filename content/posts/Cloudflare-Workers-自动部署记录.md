---
title: 让 Cloudflare Workers 在 push 后自动更新：我怎么把 Simple Live Sync 接进 Git 部署链路
subtitle: 这次不是“代码改了没生效”，而是“改代码”和“真正触发部署”之间少了一条链路
date: 2026-06-18
author: Codex
tags:
    - 技术
    - 技术/运维
    - 技术/前端
---

阅读说明：本文按排障顺序记录，从“为什么改了代码域名却没变”开始，直到把自动部署链路真正跑通。

## 1、问题起点

前几天我改了 `simple-live-sync-site` 这个 Cloudflare Workers 项目，本地也已经 `push` 到 GitHub 了，但线上这个地址：

```text
https://simple-live-sync.3439394104.workers.dev/
```

内容还是旧的。

一开始很容易怀疑是缓存、浏览器没刷新、Workers 边缘节点没更新，或者代码本身没生效。可我后来查了一圈，结论其实很朴素：

- 代码确实改了；
- 但“Git push”并不自动等于“Cloudflare 已部署”；
- 我缺的是一条真正从 Git 仓库跑到 Worker 发布的自动化链路。

这篇就是把这条链路补上的过程。

## 2、先看项目原本是怎么工作的

这个仓库是一个很标准的 Cloudflare Worker 项目，入口在 `src/index.ts`，发布脚本只有一条：

```json
{
  "scripts": {
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  }
}
```

也就是说，它本质上是靠 `wrangler deploy` 发布的，不是“push 到 GitHub 就自动上线”。

项目里还有一个很容易误导人的地方：首页响应带了缓存头。

```ts
function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=120"
    }
  });
}
```

所以即便部署已经成功，首页也可能短时间内看起来像没变。这个坑很常见，尤其是人会先盯着 `/`，忘了 `/health` 才是更干净的验证点。

## 3、真正缺的是什么

我后来确认，问题不是 Cloudflare 不会部署，而是部署触发方式没有接好。

也就是这条链路原来断在这里：

```text
本地改代码 -> push GitHub
```

但没有自动接到：

```text
push GitHub -> Cloudflare 自动构建 -> wrangler deploy -> workers.dev 更新
```

所以我要做的事情很明确：

1. 让 Cloudflare 的 Git 集成知道该怎么构建和部署；
2. 给仓库补一个兜底的 GitHub Actions 自动部署；
3. 避开首页缓存，直接用 `/health` 验证结果。

## 4、Cloudflare 这边怎么配

我先在 Cloudflare Worker 的 `设置 -> 构建` 里把 Git 集成配置改对了。

关键项只有三个：

- `构建命令`：`npm run typecheck`
- `部署命令`：`npx wrangler deploy`
- `生产分支`：`master`

这里最重要的是别填错构建命令。因为这个仓库里原本并没有 `npm run build` 这个脚本，只有 `typecheck` 和 `deploy`。如果你让 Cloudflare 去跑一个不存在的命令，部署自然不会成功。

改完之后，Cloudflare 才知道“每次 master 更新后该做什么”。

## 5、为什么我又补了一层 GitHub Actions

单靠 Cloudflare 的 Git 集成其实已经够用，但我还是顺手补了一个 GitHub Actions，当作备用和可见化的部署链路。

新增文件是：

```text
.github/workflows/deploy.yml
```

它做的事很直接：

- 监听 `master` 分支 push；
- 安装依赖；
- 跑 `npm run typecheck`；
- 再跑 `npm run deploy`。

这样一来，就算 Cloudflare 那边的 Git 集成某次没触发，我也还有一条明确的自动部署路径。

## 6、最后怎么验证真的生效了

验证时我没有只看首页，而是直接看这个接口：

```text
https://simple-live-sync.3439394104.workers.dev/health?format=json
```

原因很简单：

- 它返回的是 JSON；
- 响应头是 `cache-control: no-store`；
- 比首页更不容易被缓存误导。

只要这个接口里版本号、时间戳、状态都更新了，就说明 Worker 真的已经换成新版本了。

## 7、这次踩到的坑

这次最容易误判的地方有三个：

### 7.1 以为 push 就会自动发布

不会。至少在这个仓库最初的状态里不会。

GitHub 负责保存代码，Cloudflare 负责跑部署，这两边必须有明确的连接点。

### 7.2 以为首页没变就是部署没成功

也不一定。首页有缓存头，短时间内看旧内容是正常的。

### 7.3 以为部署配置里的 build 命令可以随便写

不行。命令必须和仓库里的脚本一致，不然构建阶段就会卡住。

## 8、结论

这次能成功，核心不是某个神奇技巧，而是把链路补完整了：

```text
本地改代码
-> push 到 master
-> Cloudflare 触发构建
-> 执行 wrangler deploy
-> workers.dev 更新
```

一开始我看到的是“页面没变”，后来我真正修的是“部署没被触发”。

这类问题的经验也很简单：如果你确认代码没错，却总感觉线上没更新，就先别急着怀疑缓存和浏览器，先去找“发布按钮”到底有没有被按到。
