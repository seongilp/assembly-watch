# Instagram 자동 홍보 봇 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 09:00 KST에 Cloudflare Cron 이 `insights.json` 랭킹 펀팩트 한 개를 골라 1080×1080 PNG + 한국어 캡션으로 렌더해 Instagram Graph API 로 @landman.official 에 자동 게시한다.

**Architecture:** 기존 Nuxt 4 / Nitro(`cloudflare_module`) Worker 에 Cron Trigger 를 추가. 순수 함수(catalog·caption·time)로 콘텐츠를 만들고, `workers-og`(Satori+resvg wasm)로 이미지를 렌더하며, KV(`CACHE`) 포인터로 회전·중복방지 상태를 관리한다. 게시는 성공 후에만 포인터를 advance 하는 idempotent 플로우. 첫 실게시 전 시크릿 가드 드라이런 라우트로 검증한다.

**Tech Stack:** Nuxt 4, Nitro tasks(`scheduledTasks`), Cloudflare Workers Cron + KV, `workers-og`, Instagram Graph API v21.0, vitest.

**Spec:** `docs/superpowers/specs/2026-06-15-instagram-auto-promo-design.md`

---

## File Structure

| File | 책임 |
|---|---|
| `server/utils/instagram/time.ts` | KST 날짜 계산 (CF 의존성 없음, 단위테스트 대상) |
| `server/utils/instagram/catalog.ts` | `insights.json` → 순서 있는 `PostSpec[]` (회전 덱) |
| `server/utils/instagram/caption.ts` | `PostSpec` → 한국어 캡션 + 해시태그 |
| `server/utils/instagram/state.ts` | KV 포인터 + 마지막 게시일 (idempotency) |
| `server/utils/instagram/render.ts` | `PostSpec` → PNG (`workers-og`, 1080² 템플릿) |
| `server/utils/instagram/publish.ts` | Graph API 2단계 발행 (컨테이너 생성 → publish) |
| `server/routes/og/[slug].png.ts` | IG 가 가져갈 공개 PNG 라우트 |
| `server/routes/api/ig/preview.get.ts` | 시크릿 가드 드라이런 (게시 없이 slug·캡션·imageUrl 반환) |
| `server/tasks/instagram/daily.ts` | Nitro scheduled task — 전체 플로우 오케스트레이션 |
| `public/fonts/Pretendard-{Regular,Bold}.ttf` | Satori 한글 폰트 (정적 에셋) |
| `test/instagram/*.test.ts` | time·catalog·caption 단위 테스트 |
| `docs/instagram-setup.md` | Meta/Graph API 1회 셋업 클릭 경로 |

수정 파일: `nuxt.config.ts`(nitro tasks), `wrangler.jsonc`(cron), `package.json`(deps).

**전제:** 작업은 `feat/instagram-auto-promo` 브랜치에서 진행한다 (이미 생성됨).

---

### Task 1: 의존성 · 폰트 · 테스트 인프라

**Files:**
- Modify: `package.json`
- Create: `public/fonts/Pretendard-Regular.otf`, `public/fonts/Pretendard-Bold.otf`
- Create: `vitest.config.ts`

- [ ] **Step 1: 런타임/개발 의존성 추가**

Run:
```bash
pnpm add workers-og
pnpm add -D vitest
```
Expected: `package.json` 에 `workers-og`(dependencies), `vitest`(devDependencies) 추가.

- [ ] **Step 2: 클린 설치로 CI 호환 확인** (메모리: ci-pnpm-allowbuilds)

Run:
```bash
rm -rf node_modules && pnpm install --frozen-lockfile=false
```
Expected: 에러 없이 완료. 만약 설치 중 build-script 경고로 실패하면 `package.json` 에
```json
"pnpm": { "onlyBuiltDependencies": ["workers-og"] }
```
형태로 허용 후 재설치. (워크스페이스라면 `pnpm-workspace.yaml` 의 동일 키.) workers-og 는 wasm 번들이라 보통 네이티브 빌드는 없다.

- [ ] **Step 3: Pretendard TTF 폰트 다운로드 (정적 에셋)**

Run:
```bash
mkdir -p public/fonts
curl -fsSL -o public/fonts/Pretendard-Regular.otf \
  https://cdn.jsdelivr.net/npm/pretendard/dist/public/static/Pretendard-Regular.otf
curl -fsSL -o public/fonts/Pretendard-Bold.otf \
  https://cdn.jsdelivr.net/npm/pretendard/dist/public/static/Pretendard-Bold.otf
ls -la public/fonts/
```
Expected: 두 OTF 파일(각 수 MB, 한글 글리프 포함) 존재. 0바이트/HTML 이면 URL 실패이므로 재시도. 폰트는 Worker 번들이 아니라 정적 에셋으로 배포되어 런타임에 fetch 한다.

- [ ] **Step 4: vitest 설정 (Nuxt 별칭 매핑)**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
      "#shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
```

- [ ] **Step 5: test 스크립트 추가**

`package.json` 의 `scripts` 에 추가:
```json
"test": "vitest run"
```

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts public/fonts
git commit -m "chore: workers-og·vitest·Pretendard 폰트 도입 (인스타 봇 토대)"
```

---

### Task 2: KST 날짜 유틸 (TDD)

**Files:**
- Create: `server/utils/instagram/time.ts`
- Test: `test/instagram/time.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `test/instagram/time.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { todayKST } from "../../server/utils/instagram/time";

describe("todayKST", () => {
  it("UTC 자정 직전(16:30Z)이면 KST 다음날", () => {
    expect(todayKST(new Date("2026-06-14T16:30:00Z"))).toBe("2026-06-15");
  });
  it("UTC 14:00Z 면 KST 같은날 23시", () => {
    expect(todayKST(new Date("2026-06-14T14:00:00Z"))).toBe("2026-06-14");
  });
  it("UTC 00:00Z(=KST 09:00) cron 시각이면 같은 날", () => {
    expect(todayKST(new Date("2026-06-15T00:00:00Z"))).toBe("2026-06-15");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- time`
Expected: FAIL — `todayKST` 모듈 없음.

- [ ] **Step 3: 최소 구현**

Create `server/utils/instagram/time.ts`:
```ts
/** UTC Date → KST(UTC+9) 기준 YYYY-MM-DD. CF 바인딩 의존성 없음(테스트 가능). */
export function todayKST(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test -- time`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/utils/instagram/time.ts test/instagram/time.test.ts
git commit -m "feat: KST 날짜 유틸 + 테스트"
```

---

### Task 3: 콘텐츠 카탈로그 (TDD)

`insights.json` 의 랭킹 배열을 회전 덱 `PostSpec[]` 로 평탄화한다. 덱 항목(`ENTRIES`)은 데이터 주도형이라 사용자가 순서/항목을 쉽게 조정할 수 있다.

**Files:**
- Create: `server/utils/instagram/catalog.ts`
- Test: `test/instagram/catalog.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `test/instagram/catalog.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildCatalog } from "../../server/utils/instagram/catalog";
import type { Insights } from "#shared/types";

const member = (name: string, party: string, count: number) => ({
  id: name, name, party, origin: "x", photo: "", count,
});
const sample = {
  generatedAt: "2026-06-14T00:00:00Z", voteBills: 60,
  terms: [member("송영길", "더불어민주당", 6), member("조경태", "국민의힘", 6)],
  proposed: [member("윤준병", "더불어민주당", 305)],
  leastProposed: [], absent: [member("송언석", "국민의힘", 60)],
  yes: [member("이재강", "더불어민주당", 50)],
  no: [member("손솔", "진보당", 20)],
  blank: [member("손솔", "진보당", 12)],
  attendanceLow: [{ ...member("a", "국민의힘", 0), rate: 71.2 }],
} as unknown as Insights;

describe("buildCatalog", () => {
  it("덱 항목마다 top5 이하 items 를 가진 PostSpec 생성", () => {
    const specs = buildCatalog(sample);
    expect(specs.length).toBeGreaterThan(0);
    for (const s of specs) {
      expect(s.slug).toBeTruthy();
      expect(s.headline).toBeTruthy();
      expect(s.items.length).toBeGreaterThan(0);
      expect(s.items.length).toBeLessThanOrEqual(5);
      for (const it of s.items) expect(typeof it.value).toBe("number");
    }
  });
  it("정당명을 정규화한다", () => {
    const terms = buildCatalog(sample).find((s) => s.slug === "terms")!;
    expect(terms.items[0]!.party).toBe("더불어민주당");
  });
  it("빈 배열 카테고리는 제외", () => {
    const slugs = buildCatalog(sample).map((s) => s.slug);
    expect(slugs).not.toContain("leastProposed");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- catalog`
Expected: FAIL — `buildCatalog` 없음.

- [ ] **Step 3: 구현**

Create `server/utils/instagram/catalog.ts`:
```ts
import insightsData from "../../assets/insights.json";
import type { Insights, InsightMember } from "#shared/types";
import { normalizeParty } from "~/lib/party";

export interface PostItem {
  name: string;
  party: string;
  value: number;
  unit: string;
}

export interface PostSpec {
  slug: string;
  category: string;
  headline: string;
  subtitle: string;
  hashtags: string[];
  items: PostItem[];
}

type RankKey =
  | "terms" | "proposed" | "yes" | "no" | "blank" | "absent" | "attendanceLow";

interface DeckEntry {
  slug: string;
  key: RankKey;
  headline: string;
  subtitle: string;
  unit: string;
  hashtags: string[];
  valueOf: (m: InsightMember) => number;
}

/** 회전 덱. 순서·구성은 여기서만 바꾸면 된다. */
const DECK: DeckEntry[] = [
  { slug: "terms", key: "terms", headline: "최다선 의원 TOP 5", subtitle: "22대 국회 · 당선 횟수 기준", unit: "선", hashtags: ["다선", "중진의원"], valueOf: (m) => m.count ?? 0 },
  { slug: "proposed", key: "proposed", headline: "대표발의 최다 TOP 5", subtitle: "22대 국회 · 대표발의 법안 수", unit: "건", hashtags: ["법안발의", "입법활동"], valueOf: (m) => m.count ?? 0 },
  { slug: "yes", key: "yes", headline: "찬성표 최다 TOP 5", subtitle: "22대 본회의 표결 기준", unit: "표", hashtags: ["본회의", "표결"], valueOf: (m) => m.count ?? 0 },
  { slug: "no", key: "no", headline: "반대표 최다 TOP 5", subtitle: "22대 본회의 표결 기준", unit: "표", hashtags: ["본회의", "소신투표"], valueOf: (m) => m.count ?? 0 },
  { slug: "blank", key: "blank", headline: "기권표 최다 TOP 5", subtitle: "22대 본회의 표결 기준", unit: "표", hashtags: ["본회의", "기권"], valueOf: (m) => m.count ?? 0 },
  { slug: "absent", key: "absent", headline: "표결 불참 최다 TOP 5", subtitle: "22대 본회의 표결 기준", unit: "회", hashtags: ["본회의", "출석률"], valueOf: (m) => m.count ?? 0 },
  { slug: "attendanceLow", key: "attendanceLow", headline: "본회의 출석률 하위 TOP 5", subtitle: "22대 본회의 · 출석률(%)", unit: "%", hashtags: ["출석률", "성실의정"], valueOf: (m) => Math.round((m.rate ?? 0) * 10) / 10 },
];

export function buildCatalog(data: Insights = insightsData as unknown as Insights): PostSpec[] {
  return DECK.map((e): PostSpec => {
    const arr = (data[e.key] ?? []) as InsightMember[];
    const items: PostItem[] = arr.slice(0, 5).map((m) => ({
      name: m.name,
      party: normalizeParty(m.party),
      value: e.valueOf(m),
      unit: e.unit,
    }));
    return { slug: e.slug, category: e.key, headline: e.headline, subtitle: e.subtitle, hashtags: e.hashtags, items };
  }).filter((s) => s.items.length > 0);
}
```

> 참고: `~/lib/party` 는 Nuxt srcDir(`app/`) 별칭. Nitro 서버에서 해석되지 않으면 상대경로 `../../../app/lib/party` 로 교체. (테스트는 vitest alias 로 해석됨.)

- [ ] **Step 4: 통과 확인**

Run: `pnpm test -- catalog`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/utils/instagram/catalog.ts test/instagram/catalog.test.ts
git commit -m "feat: 인사이트 → 회전 덱 카탈로그 + 테스트"
```

---

### Task 4: 캡션 빌더 (TDD)

**Files:**
- Create: `server/utils/instagram/caption.ts`
- Test: `test/instagram/caption.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `test/instagram/caption.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildCaption } from "../../server/utils/instagram/caption";
import type { PostSpec } from "../../server/utils/instagram/catalog";

const spec: PostSpec = {
  slug: "terms", category: "terms", headline: "최다선 의원 TOP 5",
  subtitle: "22대 국회 · 당선 횟수 기준", hashtags: ["다선", "중진의원"],
  items: [
    { name: "송영길", party: "더불어민주당", value: 6, unit: "선" },
    { name: "조경태", party: "국민의힘", value: 6, unit: "선" },
    { name: "주호영", party: "국민의힘", value: 6, unit: "선" },
    { name: "권성동", party: "국민의힘", value: 5, unit: "선" },
  ],
};

describe("buildCaption", () => {
  it("헤드라인·상위3명·사이트·해시태그를 포함", () => {
    const cap = buildCaption(spec);
    expect(cap).toContain("최다선 의원 TOP 5");
    expect(cap).toContain("송영길");
    expect(cap).toContain("주호영");
    expect(cap).not.toContain("권성동"); // top3 만
    expect(cap).toContain("asm.zihado.com");
    expect(cap).toContain("#국회");
    expect(cap).toContain("#다선");
  });
  it("undefined/NaN 누출 없음", () => {
    expect(buildCaption(spec)).not.toMatch(/undefined|NaN/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- caption`
Expected: FAIL — `buildCaption` 없음.

- [ ] **Step 3: 구현**

Create `server/utils/instagram/caption.ts`:
```ts
import type { PostSpec } from "./catalog";

const BASE_TAGS = ["국회", "국회의원", "정치", "의정감시", "22대국회"];
const SITE = "asm.zihado.com";

export function buildCaption(spec: PostSpec): string {
  const top3 = spec.items
    .slice(0, 3)
    .map((it, i) => `${i + 1}. ${it.name} (${it.party}) — ${it.value.toLocaleString("ko-KR")}${it.unit}`)
    .join("\n");
  const tags = [...BASE_TAGS, ...spec.hashtags].map((t) => `#${t}`).join(" ");
  return [
    `📊 ${spec.headline}`,
    spec.subtitle,
    "",
    top3,
    "",
    `전체 순위는 프로필 링크에서 👉 ${SITE}`,
    "",
    tags,
  ].join("\n");
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test -- caption`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/utils/instagram/caption.ts test/instagram/caption.test.ts
git commit -m "feat: 템플릿 캡션 빌더 + 테스트"
```

---

### Task 5: KV 상태 (포인터 + 중복방지)

**Files:**
- Create: `server/utils/instagram/state.ts`

- [ ] **Step 1: 구현**

Create `server/utils/instagram/state.ts`:
```ts
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
```

- [ ] **Step 2: 타입 점검**

Run: `pnpm typecheck 2>&1 | grep -i "instagram/state" || echo "state.ts 신규 에러 없음"`
Expected: state.ts 관련 신규 타입 에러 없음. (메모리 local-verify-flow: 기존 typecheck 에러는 무관.)

- [ ] **Step 3: Commit**

```bash
git add server/utils/instagram/state.ts
git commit -m "feat: KV 회전 포인터·중복방지 상태"
```

---

### Task 6: 이미지 렌더 (workers-og 1080² 템플릿)

**Files:**
- Create: `server/utils/instagram/render.ts`

- [ ] **Step 1: 구현**

Create `server/utils/instagram/render.ts`:
```ts
import { ImageResponse } from "workers-og";
import type { PostSpec, PostItem } from "./catalog";
import { partyColor } from "~/lib/party";

const FONT_BASE = "https://asm.zihado.com/fonts";
let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    fetch(`${FONT_BASE}/Pretendard-Regular.otf`).then((r) => r.arrayBuffer()),
    fetch(`${FONT_BASE}/Pretendard-Bold.otf`).then((r) => r.arrayBuffer()),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function row(it: PostItem, i: number, max: number): string {
  const pct = Math.max(6, Math.round((it.value / max) * 100));
  const color = partyColor(it.party);
  return `
    <div style="display:flex;align-items:center;width:100%;margin-bottom:28px;">
      <div style="display:flex;width:64px;font-size:44px;font-weight:700;color:#8B95A1;">${i + 1}</div>
      <div style="display:flex;flex-direction:column;flex:1;">
        <div style="display:flex;align-items:center;">
          <div style="display:flex;font-size:46px;font-weight:700;color:#191F28;">${esc(it.name)}</div>
          <div style="display:flex;margin-left:16px;font-size:28px;font-weight:700;color:${color};">${esc(it.party)}</div>
        </div>
        <div style="display:flex;align-items:center;margin-top:12px;">
          <div style="display:flex;height:18px;width:${pct}%;background:${color};border-radius:9px;"></div>
          <div style="display:flex;margin-left:18px;font-size:34px;font-weight:700;color:#191F28;">${it.value.toLocaleString("ko-KR")}${esc(it.unit)}</div>
        </div>
      </div>
    </div>`;
}

function buildHtml(spec: PostSpec): string {
  const max = Math.max(...spec.items.map((i) => i.value), 1);
  const rows = spec.items.map((it, i) => row(it, i, max)).join("");
  return `
    <div style="display:flex;flex-direction:column;width:1080px;height:1080px;padding:80px;background:#FFFFFF;font-family:Pretendard;">
      <div style="display:flex;font-size:34px;font-weight:700;color:#3182F6;">의정감시 · 오늘의 국회</div>
      <div style="display:flex;margin-top:18px;font-size:68px;font-weight:700;color:#191F28;">${esc(spec.headline)}</div>
      <div style="display:flex;margin-top:14px;font-size:32px;color:#8B95A1;">${esc(spec.subtitle)}</div>
      <div style="display:flex;flex-direction:column;margin-top:56px;flex:1;">${rows}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid #F2F4F6;padding-top:28px;">
        <div style="display:flex;font-size:30px;font-weight:700;color:#191F28;">asm.zihado.com</div>
        <div style="display:flex;font-size:28px;color:#8B95A1;">@landman.official</div>
      </div>
    </div>`;
}

export async function renderPostResponse(spec: PostSpec): Promise<Response> {
  const fonts = await loadFonts();
  return new ImageResponse(buildHtml(spec), {
    width: 1080,
    height: 1080,
    fonts: [
      { name: "Pretendard", data: fonts.regular, weight: 400 },
      { name: "Pretendard", data: fonts.bold, weight: 700 },
    ],
  });
}
```

> Satori 제약: 모든 `div` 에 `display:flex` 명시(자식 2개 이상이면 필수), 텍스트 노드는 단일 자식. 위 템플릿은 이를 준수.

- [ ] **Step 2: Commit**

```bash
git add server/utils/instagram/render.ts
git commit -m "feat: workers-og 1080² 랭킹 카드 렌더러"
```

---

### Task 7: 공개 PNG 라우트

**Files:**
- Create: `server/routes/og/[slug].png.ts`

- [ ] **Step 1: 구현**

Create `server/routes/og/[slug].png.ts`:
```ts
import { buildCatalog } from "../../utils/instagram/catalog";
import { renderPostResponse } from "../../utils/instagram/render";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  const spec = buildCatalog().find((s) => s.slug === slug);
  if (!spec) throw createError({ statusCode: 404, statusMessage: "unknown slug" });

  const res = await renderPostResponse(spec);
  const buf = await res.arrayBuffer();
  setHeader(event, "content-type", "image/png");
  setHeader(event, "cache-control", "public, max-age=86400");
  return new Uint8Array(buf);
});
```

- [ ] **Step 2: 로컬 빌드 + 라우트 동작 확인**

Run:
```bash
pnpm build:baked && pnpm exec wrangler dev --port 8799 &
sleep 8
curl -s -o /tmp/og.png -w "%{http_code} %{content_type}\n" http://localhost:8799/og/terms.png
file /tmp/og.png
kill %1 2>/dev/null
```
Expected: `200 image/png`, `file` 결과가 `PNG image data, 1080 x 1080`. (메모리 local-verify-flow: `pnpm dev` SSR 은 EINVAL 로 불가하므로 `wrangler dev` 로 검증.) 폰트 fetch 가 프로덕션 URL 을 향하므로 로컬에서도 네트워크로 폰트를 가져온다.

- [ ] **Step 3: Commit**

```bash
git add server/routes/og/[slug].png.ts
git commit -m "feat: 공개 OG PNG 라우트(/og/:slug.png)"
```

---

### Task 8: Instagram Graph API 발행

**Files:**
- Create: `server/utils/instagram/publish.ts`

- [ ] **Step 1: 구현**

Create `server/utils/instagram/publish.ts`:
```ts
const GRAPH = "https://graph.facebook.com/v21.0";

export interface PublishInput {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}

async function post(url: string, params: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json()) as { id?: string; error?: unknown };
  if (!res.ok || !json.id) {
    throw new Error(`Graph API 실패(${res.status}): ${JSON.stringify(json)}`);
  }
  return json.id;
}

/** 사진 1장 게시: 컨테이너 생성 → media_publish. 게시된 media id 반환. */
export async function publishPhoto(input: PublishInput): Promise<string> {
  const creationId = await post(`${GRAPH}/${input.igUserId}/media`, {
    image_url: input.imageUrl,
    caption: input.caption,
    access_token: input.accessToken,
  });
  const mediaId = await post(`${GRAPH}/${input.igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: input.accessToken,
  });
  return mediaId;
}
```

- [ ] **Step 2: 타입 점검**

Run: `pnpm typecheck 2>&1 | grep -i "instagram/publish" || echo "publish.ts 신규 에러 없음"`
Expected: publish.ts 관련 신규 타입 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add server/utils/instagram/publish.ts
git commit -m "feat: Instagram Graph API 사진 발행"
```

---

### Task 9: 드라이런 프리뷰 라우트

게시 없이 "오늘 무엇이 나갈지"(slug·캡션·imageUrl) 확인. 시크릿 토큰 가드.

**Files:**
- Create: `server/routes/api/ig/preview.get.ts`

- [ ] **Step 1: 구현**

Create `server/routes/api/ig/preview.get.ts`:
```ts
import { env } from "cloudflare:workers";
import { buildCatalog } from "../../../utils/instagram/catalog";
import { buildCaption } from "../../../utils/instagram/caption";
import { getPointer, getLastPosted } from "../../../utils/instagram/state";
import { todayKST } from "../../../utils/instagram/time";

export default defineEventHandler(async (event) => {
  const token = getQuery(event).token;
  const expected = (env as unknown as { IG_PREVIEW_TOKEN?: string }).IG_PREVIEW_TOKEN;
  if (!expected || token !== expected) {
    throw createError({ statusCode: 401, statusMessage: "unauthorized" });
  }
  const catalog = buildCatalog();
  const pointer = await getPointer();
  const spec = catalog[pointer % catalog.length]!;
  return {
    day: todayKST(),
    lastPosted: await getLastPosted(),
    pointer,
    slug: spec.slug,
    imageUrl: `https://asm.zihado.com/og/${spec.slug}.png`,
    caption: buildCaption(spec),
  };
});
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/api/ig/preview.get.ts
git commit -m "feat: 시크릿 가드 드라이런 프리뷰 라우트"
```

---

### Task 10: 일일 스케줄 태스크 + Cron 배선

**Files:**
- Create: `server/tasks/instagram/daily.ts`
- Modify: `nuxt.config.ts` (nitro 블록)
- Modify: `wrangler.jsonc`

- [ ] **Step 1: 스케줄 태스크 구현**

Create `server/tasks/instagram/daily.ts`:
```ts
import { env } from "cloudflare:workers";
import { buildCatalog } from "../../utils/instagram/catalog";
import { buildCaption } from "../../utils/instagram/caption";
import { publishPhoto } from "../../utils/instagram/publish";
import { getPointer, getLastPosted, commitPosted } from "../../utils/instagram/state";
import { todayKST } from "../../utils/instagram/time";

export default defineTask({
  meta: { name: "instagram:daily", description: "매일 인스타 펀팩트 자동 게시" },
  async run() {
    const day = todayKST();
    if ((await getLastPosted()) === day) {
      return { result: `skip: ${day} 이미 게시됨` };
    }
    const catalog = buildCatalog();
    if (catalog.length === 0) throw new Error("catalog 비어있음");

    const pointer = await getPointer();
    const spec = catalog[pointer % catalog.length]!;

    const e = env as unknown as { IG_USER_ID?: string; IG_ACCESS_TOKEN?: string };
    if (!e.IG_USER_ID || !e.IG_ACCESS_TOKEN) {
      throw new Error("IG_USER_ID/IG_ACCESS_TOKEN 시크릿 미설정");
    }

    const mediaId = await publishPhoto({
      igUserId: e.IG_USER_ID,
      accessToken: e.IG_ACCESS_TOKEN,
      imageUrl: `https://asm.zihado.com/og/${spec.slug}.png`,
      caption: buildCaption(spec),
    });

    // 게시 성공 후에만 상태 갱신 (idempotent)
    await commitPosted(pointer + 1, day);
    return { result: `posted ${spec.slug} → media=${mediaId}` };
  },
});
```

- [ ] **Step 2: Nitro tasks 활성화**

`nuxt.config.ts` 의 `nitro` 블록(현재 `preset`/`cloudflare`/`prerender` 가 있는 곳)에 다음 키를 추가:
```ts
    experimental: { tasks: true },
    scheduledTasks: { "0 0 * * *": ["instagram:daily"] },
```
(`0 0 * * *` UTC = 09:00 KST.)

- [ ] **Step 3: wrangler cron trigger 추가**

`wrangler.jsonc` 최상위에 추가(`routes` 뒤, 같은 레벨):
```jsonc
  "triggers": {
    "crons": ["0 0 * * *"]
  },
```

- [ ] **Step 4: 빌드로 배선 확인**

Run: `pnpm build:baked 2>&1 | tail -5`
Expected: 빌드 성공. `.output/server/index.mjs` 에 scheduled 핸들러 포함. cloudflare_module preset 이 `scheduledTasks` 를 Worker `scheduled` 로 매핑한다.

- [ ] **Step 5: Commit**

```bash
git add server/tasks/instagram/daily.ts nuxt.config.ts wrangler.jsonc
git commit -m "feat: 일일 인스타 게시 스케줄 태스크 + Cron(09:00 KST) 배선"
```

---

### Task 11: Meta/Graph API 셋업 문서

**Files:**
- Create: `docs/instagram-setup.md`

- [ ] **Step 1: 문서 작성**

Create `docs/instagram-setup.md`:
```markdown
# Instagram 자동 게시 셋업 (@landman.official, 1회)

자동 게시는 공식 Instagram Graph API 만 사용한다. 필요한 시크릿 2개: `IG_USER_ID`, `IG_ACCESS_TOKEN`.

## 1. 계정을 프로페셔널로
Instagram 앱 → 설정 → 계정 유형 및 도구 → 프로페셔널 계정으로 전환 → 비즈니스(또는 크리에이터). 개인 계정은 게시 API 불가.

## 2. Facebook 페이지 연결
빈 페이지라도 생성 후 IG 계정과 연결. Graph API 는 이 페이지를 통해 인스타에 접근한다.

## 3. Meta 앱 생성
developers.facebook.com → My Apps → Create App → 유형 "Business" → 앱에 **Instagram Graph API** 제품 추가.

## 4. ID·토큰 발급 (Graph API Explorer)
developers.facebook.com/tools/explorer 에서 앱 선택 후 권한 요청:
`instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`.
- `GET /me/accounts` → 페이지 `id` 복사
- `GET /{page-id}?fields=instagram_business_account` → **IG_USER_ID**

## 5. 장기 토큰 (만료 없는 페이지 토큰)
짧은 토큰을 60일 장기 사용자 토큰으로 교환:
\`\`\`
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token&client_id={APP_ID}
  &client_secret={APP_SECRET}&fb_exchange_token={SHORT_LIVED_TOKEN}
\`\`\`
이후 `GET /me/accounts` 로 받은 **페이지 액세스 토큰**은 (장기 사용자 토큰에서 파생 시) 만료되지 않는다 → 이 값을 **IG_ACCESS_TOKEN** 으로 사용. 이 방식이면 토큰 갱신 cron 이 불필요하다.

## 6. Worker 시크릿 등록
\`\`\`
pnpm exec wrangler secret put IG_USER_ID
pnpm exec wrangler secret put IG_ACCESS_TOKEN
pnpm exec wrangler secret put IG_PREVIEW_TOKEN   # 드라이런 가드(임의 난수)
\`\`\`

## 7. 게시 확인
- 드라이런: `https://asm.zihado.com/api/ig/preview?token=<IG_PREVIEW_TOKEN>` → slug·캡션·imageUrl 확인
- 이미지: `https://asm.zihado.com/og/terms.png`
- 앱은 개발 모드여도 **본인 계정** 게시는 App Review 없이 동작한다.

## 참고: 토큰 만료 모니터링(선택)
만료 없는 페이지 토큰을 쓰면 갱신이 불필요. 사용자 토큰을 쓴다면 60일마다 5단계 재교환 필요 — 추후 주간 헬스체크 cron 추가 가능(현재 범위 외).
```

- [ ] **Step 2: Commit**

```bash
git add docs/instagram-setup.md
git commit -m "docs: Instagram Graph API 셋업 가이드"
```

---

### Task 12: 전체 검증 + 마무리

**Files:** (검증 전용, 코드 변경 없음)

- [ ] **Step 1: 단위 테스트 전체 통과**

Run: `pnpm test`
Expected: time·catalog·caption 테스트 모두 PASS.

- [ ] **Step 2: 빌드 성공 + 프리렌더 무결성**

Run: `pnpm build:baked 2>&1 | tail -8`
Expected: 성공. (typecheck 의 기존 에러는 무관 — 메모리 local-verify-flow.)

- [ ] **Step 3: 로컬 E2E 드라이런 (게시 없음)**

Run:
```bash
pnpm exec wrangler dev --port 8799 &
sleep 8
echo "--- preview(미인증 401 기대) ---"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8799/api/ig/preview?token=wrong"
echo "--- og 이미지 ---"
curl -s -o /tmp/og.png -w "%{http_code} %{content_type}\n" http://localhost:8799/og/proposed.png
file /tmp/og.png
kill %1 2>/dev/null
```
Expected: preview 미인증 `401`; og `200 image/png`, `PNG image data, 1080 x 1080`.
(드라이런 JSON 인증 성공 경로는 KV·시크릿이 있는 배포본에서 확인. 로컬 `wrangler dev` 는 `--var IG_PREVIEW_TOKEN:test` 로 가드 통과 테스트 가능.)

- [ ] **Step 4: 렌더 결과 육안 확인**

`/tmp/og.png` 를 열어 레이아웃(제목·5행 랭킹·정당색 바·푸터)이 깨지지 않았는지 확인. 한글이 □(두부)로 나오면 폰트 fetch 실패 → Task 1 Step 3 폰트 재다운로드.

- [ ] **Step 5: 최종 정리 커밋 (필요 시)**

```bash
git add -A && git commit -m "chore: 인스타 봇 검증 마무리" || echo "변경 없음"
```

---

## Self-Review 결과 (작성자 점검)

- **Spec 커버리지:** 전자동(Task 10) · Graph API(Task 8) · 일일 회전(Task 3+5) · Satori 이미지(Task 6) · 템플릿 캡션(Task 4) · Cron+KV 09:00 KST(Task 10) · idempotency(Task 5+10) · 드라이런(Task 9) · 셋업 문서(Task 11) 모두 태스크 존재.
- **스펙 대비 의도적 조정 2건:**
  1. **콘텐츠 원천** — 스펙은 "재산/띠/별자리/성씨"를 언급했으나 실제 `insights.json` 은 의원 랭킹(다선·발의·표결·출석) 배열이다. v1 덱은 이 랭킹으로 구성하고, 그룹 펀팩트(`vote-analysis.json`)는 향후 `DECK` 확장으로 명시(YAGNI).
  2. **토큰 갱신 cron** — 만료 없는 페이지 액세스 토큰을 쓰면 불필요하므로 v1 에서 제외, 셋업 문서에 비만료 토큰 방식과 선택적 헬스체크를 기재.
- **타입 일관성:** `PostSpec`/`PostItem`(catalog) → caption·render·routes·task 전부 동일 시그니처 사용. `buildCatalog`·`buildCaption`·`publishPhoto`·`renderPostResponse`·상태 함수명 호출처와 일치.
- **플레이스홀더:** 없음 — 모든 코드/명령/기대출력 구체화.
```
