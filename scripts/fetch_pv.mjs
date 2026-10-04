#!/usr/bin/env node
// 抓取每篇文章的 VerCount 阅读数，写入 data/pv_stats.json（统计页数据源）。
// 只读接口 GET /api/v2/log，不会给文章刷计数。
//
// 用法：先 hugo 构建（需要 public/posts 目录列出文章 URL），再运行：
//   node scripts/fetch_pv.mjs
// 环境变量：
//   PV_BASE_URL  覆盖站点地址（默认读 hugo.toml 的 baseURL）
//   PV_API       覆盖只读接口（默认 https://events.vercount.one/api/v2/log）
//   PV_OUT       覆盖输出文件（默认 data/pv_stats.json）
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = join(root, "public", "posts");
const outFile = process.env.PV_OUT || join(root, "data", "pv_stats.json");
const api = process.env.PV_API || "https://events.vercount.one/api/v2/log";

function readBaseURLFromConfig() {
  const toml = readFileSync(join(root, "hugo.toml"), "utf8");
  const m = toml.match(/^baseURL\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error("hugo.toml 中未找到 baseURL，请用 PV_BASE_URL 指定站点地址");
  return m[1];
}

const baseURL = (process.env.PV_BASE_URL || readBaseURLFromConfig()).replace(/\/+$/, "");

function listPostPaths() {
  if (!existsSync(postsDir)) {
    throw new Error(`未找到 ${postsDir}：请先完成一次 hugo 构建（public/ 由 Hugo 生成，目录名即文章 URL）`);
  }
  return readdirSync(postsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(postsDir, d.name, "index.html")))
    // 目录名是原始中文等字符；RelPermalink / 浏览器 URL 均为百分号编码形式，这里统一编码保证 key 一致
    .map((d) => `/posts/${encodeURI(d.name)}/`);
}

async function fetchCount(path, attempt = 1) {
  const url = `${api}?url=${encodeURIComponent(baseURL + path)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json?.status !== "success") throw new Error(`status=${json?.status}`);
    return Number(json?.data?.page_pv ?? 0);
  } catch (err) {
    if (attempt >= 3) {
      console.warn(`\n  ✗ ${path}: ${err.message}`);
      return null;
    }
    await sleep(800 * attempt);
    return fetchCount(path, attempt + 1);
  }
}

async function main() {
  const paths = listPostPaths();
  if (!paths.length) {
    console.log("public/posts 下没有文章，跳过抓取");
    return;
  }
  console.log(`抓取 ${paths.length} 篇文章的 VerCount 阅读数 → ${outFile}`);

  const counts = {};
  const queue = [...paths];
  let done = 0;
  let failed = 0;
  async function worker() {
    while (queue.length) {
      const p = queue.shift();
      const n = await fetchCount(p);
      counts[p] = n ?? 0;
      if (n === null) failed++;
      done++;
      process.stdout.write(`\r  ${done}/${paths.length}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  process.stdout.write("\n");

  // 全部失败且已有旧数据时保留旧文件，避免把统计页冲成 0
  if (failed === paths.length && existsSync(outFile)) {
    console.warn("全部请求失败，保留原有 pv_stats.json（下次部署/定时任务会重试）");
    return;
  }

  writeFileSync(
    outFile,
    JSON.stringify({ source: "vercount", fetched_at: new Date().toISOString(), counts }, null, 2) + "\n"
  );
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`完成：成功 ${paths.length - failed}，失败 ${failed}（失败按 0 计），合计实时 PV ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
