#!/usr/bin/env node
/** 로컬 node-server(.output) 대상 API 지연 벤치. p55≤10ms, p99≤15ms 게이트. */
const BASE = process.env.BENCH_BASE || "http://localhost:3000";
const N = +(process.env.BENCH_N || 300);
const ENDPOINTS = [
  "/api/dining", "/api/wealth", "/api/graph", "/api/insights", "/api/stats",
  "/api/members", "/api/bills", "/api/votes", "/api/committees", "/api/schedule",
  "/api/vote-stats", "/api/vote-insights", "/api/votedata", "/api/districts",
  "/api/shapes", "/api/bills-recent", "/api/vote-analysis-top",
];
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
async function warm(u) { try { await fetch(BASE + u); } catch {} }
async function bench(u) {
  await warm(u);
  const ts = [];
  for (let i = 0; i < N; i++) { const t = performance.now(); const r = await fetch(BASE + u); await r.arrayBuffer(); ts.push(performance.now() - t); }
  return { u, p50: pct(ts, 50), p55: pct(ts, 55), p99: pct(ts, 99) };
}
const rows = [];
for (const u of ENDPOINTS) rows.push(await bench(u));
let fail = 0;
for (const r of rows) {
  const ok = r.p55 <= 10 && r.p99 <= 15;
  if (!ok) fail++;
  console.log(`${ok ? "OK " : "SLOW"} ${r.u.padEnd(26)} p50=${r.p50.toFixed(2)} p55=${r.p55.toFixed(2)} p99=${r.p99.toFixed(2)} ms`);
}
console.log(fail ? `\n${fail} endpoint(s) over budget` : "\nALL within p55≤10ms / p99≤15ms");
process.exit(fail ? 1 : 0);
