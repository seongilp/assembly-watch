#!/usr/bin/env node
/**
 * 배포 후 KV(CACHE) 전체 퍼지.
 * 재배포로 에셋 해시가 바뀌면 SWR 로 캐시된 옛 HTML 이 사라진 /_nuxt/*.css 를
 * 참조해 스타일이 깨진다. 배포 직후 캐시를 비워 항상 fresh 하게 유지한다.
 */
import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";

const NS = "765a7ded764444f1a0284c749c5b9f67"; // CACHE namespace id (wrangler.jsonc)
const TMP = "/tmp/_kv-purge-keys.json";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

try {
  const raw = sh(`bunx wrangler kv key list --namespace-id ${NS} --remote`);
  const keys = JSON.parse(raw).map((k) => k.name);
  if (!keys.length) {
    console.log("[purge-kv] 비울 캐시 없음");
    process.exit(0);
  }
  writeFileSync(TMP, JSON.stringify(keys));
  sh(`bunx wrangler kv bulk delete ${TMP} --namespace-id ${NS} --remote --force`);
  rmSync(TMP, { force: true });
  console.log(`[purge-kv] ${keys.length}개 캐시 키 퍼지 완료`);
} catch (e) {
  console.warn("[purge-kv] 퍼지 실패(무시하고 진행):", e.message?.slice(0, 200));
}
