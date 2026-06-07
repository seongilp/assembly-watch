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
    console.log("[purge-kv] 비울 KV 캐시 없음");
  } else {
    writeFileSync(TMP, JSON.stringify(keys));
    sh(`bunx wrangler kv bulk delete ${TMP} --namespace-id ${NS} --remote --force`);
    rmSync(TMP, { force: true });
    console.log(`[purge-kv] KV ${keys.length}개 키 퍼지 완료`);
  }
} catch (e) {
  console.warn("[purge-kv] KV 퍼지 실패(무시):", e.message?.slice(0, 160));
}

// CF 엣지 캐시 퍼지 (cache rule 로 엣지 캐시 중 → 재배포 stale HTML 방지)
// 토큰/존ID 는 env 로만 주입 (절대 커밋 금지)
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ZONE = process.env.CF_ZONE_ID;
if (CF_TOKEN && CF_ZONE) {
  try {
    const res = sh(
      `curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/purge_cache" -H "Authorization: Bearer ${CF_TOKEN}" -H "Content-Type: application/json" --data '{"purge_everything":true}'`,
    );
    const ok = JSON.parse(res).success;
    console.log(`[purge-kv] CF 엣지 캐시 퍼지: ${ok ? "성공" : "실패"}`);
  } catch (e) {
    console.warn("[purge-kv] CF 퍼지 실패(무시):", e.message?.slice(0, 160));
  }
} else {
  console.log("[purge-kv] CF 엣지 퍼지 건너뜀 (CLOUDFLARE_API_TOKEN/CF_ZONE_ID 미설정)");
}
