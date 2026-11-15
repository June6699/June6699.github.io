#!/usr/bin/env node
// 每日阅读量快照：把 fetch_pv.mjs 抓到的当日累计总阅读量记入 data/pv_history.json，
// 统计页「阅读量日期分布」用相邻两天的快照差值还原真实逐日新增（VerCount 不提供逐日明细）。
// 同一天重复运行只覆盖当日记录（幂等）；无 pv_stats.json 时跳过，绝不破坏已有历史。
//
// 用法：CI 中紧随 fetch_pv.mjs 之后运行 node scripts/snapshot_pv.mjs
// 环境变量：
//   PV_TZ_OFFSET_HOURS  取「今天」用的时区偏移（默认 8，北京时间）
//   PV_HISTORY          覆盖历史文件路径（默认 data/pv_history.json）
//   PV_OUT              复用 fetch_pv.mjs 的输出路径（默认 data/pv_stats.json）
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const statsFile = process.env.PV_OUT || join(root, "data", "pv_stats.json");
const historyFile = process.env.PV_HISTORY || join(root, "data", "pv_history.json");
const tzOffset = Number(process.env.PV_TZ_OFFSET_HOURS ?? 8);

// 站点受众按北京时间看「今天」，用 UTC+8 折算日期串，避免 UTC 分界造成的日期错位
const today = new Date(Date.now() + tzOffset * 3600 * 1000).toISOString().slice(0, 10);

if (!existsSync(statsFile)) {
  console.warn(`未找到 ${statsFile}：请先运行 fetch_pv.mjs，本次跳过快照`);
  process.exit(0);
}

const stats = JSON.parse(readFileSync(statsFile, "utf8"));
const counts = stats?.counts ?? {};
const total = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);

let days = [];
if (existsSync(historyFile)) {
  try {
    days = JSON.parse(readFileSync(historyFile, "utf8"))?.days ?? [];
  } catch {
    console.warn(`历史文件 ${historyFile} 解析失败，按空历史重建`);
    days = [];
  }
}
days = days.filter((d) => d?.date !== today);
days.push({ date: today, total: Math.round(total) });
days.sort((a, b) => (a.date < b.date ? -1 : 1));

writeFileSync(historyFile, JSON.stringify({ source: "vercount", days }, null, 2) + "\n");
console.log(
  `快照完成：${today} 站点累计 PV ${Math.round(total)}，历史 ${days.length} 天 → ${historyFile}`
);
