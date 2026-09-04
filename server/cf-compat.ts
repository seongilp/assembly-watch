// `cloudflare:workers` 호환 심 — node-server 프리셋 빌드 전용 (ebs 이전, 2026-07-19).
//
// nuxt.config 가 node-server 빌드에서 "cloudflare:workers" 모듈을 이 파일로
// 앨리어싱한다. Workers 배포(cloudflare_module 프리셋)에서는 실제 모듈이
// 그대로 쓰이므로 이 파일은 번들에 포함되지 않는다.
//
//   env.CACHE   → 파일 KV (KV_SHIM_DIR, 기본 .kv/CACHE — landman 과 공유)
//   env.ASSETS  → .output/public 정적 파일 로컬 서빙 (폰트 등)
//   그 외 키     → process.env 위임 (IG_USER_ID 등 시크릿)

import { promises as fs } from "node:fs";
import { join, resolve, normalize, sep } from "node:path";

const kvDir = resolve(process.env.KV_SHIM_DIR ?? ".kv/CACHE");

const CACHE = {
  async get(key: string): Promise<string | null> {
    try {
      return await fs.readFile(join(kvDir, encodeURIComponent(key)), "utf8");
    } catch {
      return null;
    }
  },
  async put(key: string, value: string): Promise<void> {
    await fs.mkdir(kvDir, { recursive: true });
    const path = join(kvDir, encodeURIComponent(key));
    await fs.writeFile(path + ".tmp", value, "utf8");
    await fs.rename(path + ".tmp", path);
  },
};

// 배포 정적 에셋 루트: standalone 실행 시 .output/server 에서 ../public
const publicDir = resolve(
  process.env.ASSETS_DIR ?? join(process.cwd(), "public"),
);

const MIME: Record<string, string> = {
  ".otf": "font/otf",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".json": "application/json",
};

const ASSETS = {
  async fetch(req: Request): Promise<Response> {
    const pathname = decodeURIComponent(new URL(req.url).pathname);
    const file = normalize(join(publicDir, pathname));
    // startsWith 만 쓰면 /app/public-backup 같은 형제 경로가 통과한다 — 구분자까지 고정
    if (file !== publicDir && !file.startsWith(publicDir + sep))
      return new Response("forbidden", { status: 403 });
    try {
      const buf = await fs.readFile(file);
      const ext = file.slice(file.lastIndexOf("."));
      return new Response(buf, {
        headers: { "content-type": MIME[ext] ?? "application/octet-stream" },
      });
    } catch {
      return new Response("not found", { status: 404 });
    }
  },
};

export const env: Record<string, unknown> = new Proxy(
  {},
  {
    get(_t, prop: string) {
      if (prop === "CACHE") return CACHE;
      if (prop === "ASSETS") return ASSETS;
      return process.env[prop];
    },
  },
);
