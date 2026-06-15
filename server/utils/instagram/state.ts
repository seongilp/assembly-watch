import { env } from "cloudflare:workers";

const POINTER_KEY = "ig:pointer";
const LASTPOST_KEY = "ig:lastPosted";

/** 최소 KV 인터페이스 (워커 타입 패키지 의존성 회피) */
interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

function kv(): KVLike {
  const ns = (env as unknown as { CACHE?: KVLike }).CACHE;
  if (!ns) throw new Error("CACHE KV 바인딩이 없습니다");
  return ns;
}

export async function getPointer(): Promise<number> {
  const raw = await kv().get(POINTER_KEY);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function getLastPosted(): Promise<string | null> {
  return kv().get(LASTPOST_KEY);
}

/** 게시 성공 후에만 호출 — 포인터 advance + 게시일 기록 */
export async function commitPosted(nextPointer: number, day: string): Promise<void> {
  await kv().put(POINTER_KEY, String(nextPointer));
  await kv().put(LASTPOST_KEY, day);
}
