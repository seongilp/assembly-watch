# dining byMember Per-Member Endpoint Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `byMember` dining stats out of the 265KB `/api/dining` payload into a separate `dining-members.json` file served per-member at `/api/dining-members/:id`, so member pages stop baking 98KB of unused data.

**Architecture:** The pipeline script (`scripts/gen-dining.mjs`) already computes `byMember` inside `aggregate()`. We split the *write* step: continue writing a lightweight main `dining.json` (without `byMember`), and write a NEW `server/assets/dining-members.json` keyed by member id. A new Nitro API route `/api/dining-members/[id].get.ts` serves per-member records. The member page replaces `useFetch("/api/dining")` + `byMember.find(...)` with `useFetch("/api/dining-members/:id")`. All 300 member dining API routes are prerendered at build time.

**Tech Stack:** Node.js ESM (scripts), TypeScript + Nitro H3 (API), Vue 3 + Nuxt 4 (member page), Vitest (tests)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/gen-dining.mjs` | Modify | Write `dining-members.json`; drop `byMember` from `dining.json` |
| `server/assets/dining-members.json` | Create (generated) | Keyed map `{ [memberId]: DiningMemberStats }` — 259 entries |
| `server/assets/dining.json` | Re-generated | Loses `byMember` (~98KB smaller) |
| `shared/types.ts` | Modify | Remove `byMember` from `DiningData`; remove `DiningMember`; add `DiningMemberStats` |
| `server/api/dining-members/[id].get.ts` | Create | Serve `dining-members.json[id] ?? null` |
| `nuxt.config.ts` | Modify | Add `diningMemberRoutes()` helper + prerender + routeRule |
| `app/pages/members/[id].vue` | Modify | Fetch `/api/dining-members/:id` instead of full `/api/dining` |
| `test/dining/dining.test.ts` | No change needed | `aggregate()` still returns `byMember` internally; tests pass as-is |

---

## Task 1: Update `scripts/gen-dining.mjs` to write `dining-members.json`

**Files:**
- Modify: `scripts/gen-dining.mjs`

### What changes
1. Build a keyed map `{ [id]: { visits, amount, topRestaurants, cuisineMix, purposeMix, districtRate } }` from `agg.byMember` (matched members only, dropping `id/name/party/origin/matched`).
2. Write it to `server/assets/dining-members.json`.
3. Remove `byMember: byMemberMatched` from the `out` object that becomes `dining.json`.
4. Keep `coverage.matchedMembers` by using the map's size.
5. Update the console.log line to report both outputs.

- [ ] **Step 1: Open and read the current `main()` function**

Read `/Users/zihado/work/playground/asm.zihado.com/scripts/gen-dining.mjs` lines 140–193. Confirm the output object structure and `byMemberMatched` variable.

- [ ] **Step 2: Add `OUT_MEMBERS` constant near the other output path constants**

In `scripts/gen-dining.mjs`, after line 18 (`const OUT_DETAILS = ...`), add:

```js
const OUT_MEMBERS = join(root, "server/assets/dining-members.json");
```

- [ ] **Step 3: Replace the `byMemberMatched` block and build the keyed map**

Find this block (lines 171–184):
```js
  // byMember 경량화: 매칭된 의원(현직, id 존재)만 유지. 미매칭(id 없음) 전직 의원은 뷰어에서 사용되지 않으므로 제거.
  const byMemberMatched = agg.byMember.filter((m) => m.matched === true && m.id);
```

Replace with:
```js
  // byMember → per-member 파일로 분리. id 있는 매칭 의원만 포함, 불필요 필드 제거.
  const diningMemberMap = Object.fromEntries(
    agg.byMember
      .filter((m) => m.matched === true && m.id)
      .map(({ id, name, party, origin, matched, ...stats }) => [id, stats]),
  );
```

- [ ] **Step 4: Update the `out` object — remove `byMember`, keep `coverage.matchedMembers`**

Find the `out` object construction (lines 177–187):
```js
  const out = {
    basis: "정치자금 지출보고서 2012~2024 (선거자금 제외)",
    source: SOURCE,
    generatedAt: new Date().toISOString().slice(0, 10),
    years: [...years].sort(),
    coverage: { rows: rows.length, matchedMembers: byMemberMatched.length, addrYears: [2023, 2024], mapPoints: mapPoints.length },
    ...aggLean,
    byMember: byMemberMatched,
    restaurants,
    mapPoints,
  };
```

Replace with:
```js
  const out = {
    basis: "정치자금 지출보고서 2012~2024 (선거자금 제외)",
    source: SOURCE,
    generatedAt: new Date().toISOString().slice(0, 10),
    years: [...years].sort(),
    coverage: { rows: rows.length, matchedMembers: Object.keys(diningMemberMap).length, addrYears: [2023, 2024], mapPoints: mapPoints.length },
    ...aggLean,
    restaurants,
    mapPoints,
  };
```

- [ ] **Step 5: Write `dining-members.json` alongside the two existing writes**

Find line 188–189:
```js
  writeFileSync(OUT, JSON.stringify(out));
  writeFileSync(OUT_DETAILS, JSON.stringify(details));
```

Replace with:
```js
  writeFileSync(OUT, JSON.stringify(out));
  writeFileSync(OUT_DETAILS, JSON.stringify(details));
  writeFileSync(OUT_MEMBERS, JSON.stringify(diningMemberMap));
```

- [ ] **Step 6: Update the console.log to report all three outputs**

Find line 190:
```js
  console.log(`[gen-dining] ${rows.length} 식당행 → ${restaurants.length} 식당, ${agg.byMember.length} 의원(매칭 ${byMemberMatched.length}), 지도점 ${mapPoints.length}, 상세 ${Object.keys(details).length}`);
```

Replace with:
```js
  console.log(`[gen-dining] ${rows.length} 식당행 → ${restaurants.length} 식당, ${agg.byMember.length} 의원(매칭 ${Object.keys(diningMemberMap).length}), 지도점 ${mapPoints.length}, 상세 ${Object.keys(details).length}, per-member ${Object.keys(diningMemberMap).length}`);
```

- [ ] **Step 7: Verify the final `main()` function reads correctly**

Confirm the variable flow is:
- `agg.byMember` → `diningMemberMap` (keyed map, written to `dining-members.json`)
- `out` has no `byMember` field
- `coverage.matchedMembers` uses `Object.keys(diningMemberMap).length`

- [ ] **Step 8: Commit**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
git add scripts/gen-dining.mjs
git -c commit.gpgsign=false commit -m "perf(gen-dining): byMember를 dining-members.json으로 분리 — dining.json에서 제거"
```

---

## Task 2: Update `shared/types.ts` — remove `DiningMember`, add `DiningMemberStats`

**Files:**
- Modify: `shared/types.ts` lines 452–555

### What changes
- `DiningMember` interface (lines 463–475) is only used in `DiningData.byMember`. After removing `byMember` from `DiningData`, `DiningMember` becomes unused. Remove it.
- Add new `DiningMemberStats` interface (the shape per-member API returns).
- Remove `byMember: DiningMember[]` from `DiningData`.

- [ ] **Step 1: Confirm `DiningMember` has no other usages**

Run:
```bash
grep -rn "DiningMember" /Users/zihado/work/playground/asm.zihado.com --include="*.ts" --include="*.vue" --include="*.mjs"
```

Expected: only `shared/types.ts` and `app/pages/members/[id].vue` (the `DiningData` import — not `DiningMember` directly). The member page imports `DiningData`, not `DiningMember`. Confirm zero direct usages of `DiningMember` in `.vue` files.

- [ ] **Step 2: Replace `DiningMember` with `DiningMemberStats` and update `DiningData`**

In `shared/types.ts`, find the dining section starting at line 452:

```typescript
export interface DiningMember {
  id: string;
  name: string;
  party: string;
  origin: string;
  matched: boolean;
  visits: number;
  amount: number;
  topRestaurants: { name: string; visits: number }[];
  cuisineMix: Record<string, number>;
  purposeMix: Record<string, number>;
  districtRate: number | null;
}
```

Replace with:
```typescript
/** /api/dining-members/:id レスポンス — byMember より id/name/party/origin/matched 除去 */
export interface DiningMemberStats {
  visits: number;
  amount: number;
  topRestaurants: { name: string; visits: number }[];
  cuisineMix: Record<string, number>;
  purposeMix: Record<string, number>;
  districtRate: number | null;
}
```

- [ ] **Step 3: Remove `byMember` from `DiningData`**

Find in `shared/types.ts`:
```typescript
export interface DiningData {
  basis: string;
  source: { name: string; url: string };
  generatedAt: string;
  years: number[];
  coverage: { rows: number; matchedMembers: number; addrYears: number[]; mapPoints: number };
  restaurants: DiningRestaurant[];
  mapPoints: DiningMapPoint[];
  byMember: DiningMember[];
  cuisine: { type: string; visits: number; amount: number }[];
```

Remove the `byMember: DiningMember[];` line so it becomes:
```typescript
export interface DiningData {
  basis: string;
  source: { name: string; url: string };
  generatedAt: string;
  years: number[];
  coverage: { rows: number; matchedMembers: number; addrYears: number[]; mapPoints: number };
  restaurants: DiningRestaurant[];
  mapPoints: DiningMapPoint[];
  cuisine: { type: string; visits: number; amount: number }[];
```

- [ ] **Step 4: Update `DiningMapPoint` — verify `groups` still uses `DiningGroupBreakdown`**

Check that `DiningMapPoint` still references `DiningGroupBreakdown` (it does — no change needed, just confirm).

- [ ] **Step 5: Run typecheck to verify no regressions**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
pnpm typecheck 2>&1 | head -60
```

Expected: same pre-existing errors as before; no NEW errors about `DiningMember` or `byMember`. (The viewer pages `/dining` and `/insights` do NOT access `byMember` — confirmed by grep.)

- [ ] **Step 6: Commit**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
git add shared/types.ts
git -c commit.gpgsign=false commit -m "types: DiningMember → DiningMemberStats, DiningData.byMember 제거"
```

---

## Task 3: Create `server/api/dining-members/[id].get.ts`

**Files:**
- Create: `server/api/dining-members/[id].get.ts`

This mirrors the pattern in `server/api/dining/[id].get.ts` but returns `DiningMemberStats | null` (no 404 — the member page hides the card if null).

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /Users/zihado/work/playground/asm.zihado.com/server/api/dining-members
```

- [ ] **Step 2: Create the API handler**

Create `/Users/zihado/work/playground/asm.zihado.com/server/api/dining-members/[id].get.ts` with:

```typescript
import type { DiningMemberStats } from "#shared/types";

/**
 * 의원별 식당 지출 통계 (OhmyNews KA-money 2012~2024 — 빌드 베이크)
 * 식당 기록이 없는 의원은 null 반환 (404 아님 — 의원 페이지에서 카드 숨김).
 * GET /api/dining-members/:id   (id = MONA_CD)
 */
export default defineEventHandler(async (event): Promise<DiningMemberStats | null> => {
  const id = getRouterParam(event, "id");
  if (!id) return null;

  // Lazy import so the 259-entry map is only loaded once (module cache).
  // dining-members.json is ~81KB; much smaller than the 265KB dining.json was.
  const map = (await import("../../assets/dining-members.json", { assert: { type: "json" } })).default as Record<string, DiningMemberStats>;
  return map[id] ?? null;
});
```

> Note: We use `defineEventHandler` (not `defineCachedEventHandler`) because the prerendered static file IS the cache. The route is prerendered for all 300 member ids at build time — runtime calls are near-zero.

- [ ] **Step 3: Verify TypeScript resolves the import**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
pnpm typecheck 2>&1 | grep -i "dining-members" | head -20
```

Expected: no new errors on this file.

- [ ] **Step 4: Commit**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
git add server/api/dining-members/[id].get.ts
git -c commit.gpgsign=false commit -m "feat: /api/dining-members/:id 엔드포인트 추가 — per-member 식당 통계"
```

---

## Task 4: Update `nuxt.config.ts` — prerender + routeRules for dining-members

**Files:**
- Modify: `nuxt.config.ts`

### What changes
1. Add a `diningMemberRoutes()` helper that reads `members.json` keys → `/api/dining-members/{id}` for all 300 members (not just matched ones — missing ones return null which is fine).
2. Spread those routes into `nitro.prerender.routes`.
3. Add `"/api/dining-members/**"` routeRule mirroring `"/api/dining/**"`.
4. Remove `/api/dining` from the `nitro.prerender.routes` list (it gets re-added via the `Object.fromEntries` routeRules block which also covers static prerender — actually `/api/dining` is in both the manual routes list AND the routeRules map; keep it in routes, just no change needed there).

- [ ] **Step 1: Add `diningMemberRoutes()` function after `diningRoutes()`**

In `nuxt.config.ts`, after the `diningRoutes()` function (ends around line 32), add:

```typescript
// 의원별 식당 API 프리렌더 (300명 전체 — 식당 기록 없으면 null 반환)
function diningMemberRoutes(): string[] {
  try {
    const p = "./server/assets/members.json";
    if (!existsSync(p)) return [];
    const members = JSON.parse(readFileSync(p, "utf8")) as { id: string }[];
    return members.map((m) => `/api/dining-members/${m.id}`);
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Spread `diningMemberRoutes()` into `nitro.prerender.routes`**

Find the prerender routes array in `nuxt.config.ts` (around line 127–149). Currently ends with `"/api/dining"`. Add `...diningMemberRoutes()` after `...voteRoutes()`:

```typescript
      prerender: {
        crawlLinks: false,
        routes: [
          "/sitemap.xml",
          ...memberRoutes(),
          ...diningRoutes(),
          ...voteRoutes(),
          ...diningMemberRoutes(),     // ← ADD THIS LINE
          "/api/graph",
          "/api/insights",
          // ... rest unchanged
          "/api/dining",
        ],
      },
```

- [ ] **Step 3: Add `"/api/dining-members/**"` routeRule**

In the `$production.routeRules` section, find the existing `"/api/dining/**"` rule (line 182):
```typescript
      "/api/dining/**": { swr: 86400, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=86400" } },
```

Add the new rule directly after it:
```typescript
      "/api/dining-members/**": { swr: 86400, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=86400" } },
```

- [ ] **Step 4: Commit**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
git add nuxt.config.ts
git -c commit.gpgsign=false commit -m "config: dining-members 프리렌더 라우트 + routeRule 추가"
```

---

## Task 5: Update `app/pages/members/[id].vue` — switch to per-member fetch

**Files:**
- Modify: `app/pages/members/[id].vue`

### What changes
1. Replace `useFetch<DiningData>("/api/dining", ...)` with `useFetch<DiningMemberStats | null>("/api/dining-members/${id.value}", ...)`.
2. Remove `DiningData` from the import (check if it's still needed — it's not after this change).
3. Remove the `myDining = computed(...)` derived from `dining.value?.byMember.find(...)`.
4. Rename the fetch result to `myDining` directly.
5. The template section (`v-if="myDining && myDining.visits"` and `myDining.topRestaurants`) is already correct — only the script section changes.

- [ ] **Step 1: Update the import line**

Find line 15:
```typescript
import type { MemberDetail, Insights, DiningData } from "#shared/types";
```

Replace with:
```typescript
import type { MemberDetail, Insights, DiningMemberStats } from "#shared/types";
```

- [ ] **Step 2: Replace the dining fetch block (lines 36–37)**

Find:
```typescript
const { data: dining } = await useFetch<DiningData>("/api/dining", { key: "dining" });
const myDining = computed(() => dining.value?.byMember.find((m) => m.id === route.params.id));
```

Replace with:
```typescript
const { data: myDining } = await useFetch<DiningMemberStats | null>(
  `/api/dining-members/${id.value}`,
  { key: `dining-m-${id.value}` },
);
```

- [ ] **Step 3: Verify the template section needs no changes**

The template already uses:
```html
<section v-if="myDining && myDining.visits" class="mt-4 ...">
  ...
  <li v-for="r in myDining.topRestaurants" ...>
```

This is directly compatible with `DiningMemberStats` (which has `visits` and `topRestaurants`). No template changes needed.

- [ ] **Step 4: Confirm `VoteInsights` is imported (it was not in the type import line)**

Check line 24 — `useFetch<VoteInsights>` is used. `VoteInsights` must be imported. Currently line 15 was `MemberDetail, Insights, DiningData`. Check if `VoteInsights` is imported elsewhere or auto-imported.

Run:
```bash
grep -n "VoteInsights" /Users/zihado/work/playground/asm.zihado.com/app/pages/members/\[id\].vue | head -5
```

If `VoteInsights` is used in `useFetch<VoteInsights>` but not in the import line (it's not — it's currently not in the import), that means it was auto-imported or there's an existing type issue. Do NOT add it — just leave the existing auto-import behavior as-is (this pre-existed).

- [ ] **Step 5: Run typecheck to confirm no new errors**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
pnpm typecheck 2>&1 | head -60
```

Expected: same pre-existing errors; no new errors referencing `DiningData`, `byMember`, or `dining-members`.

- [ ] **Step 6: Commit**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
git add app/pages/members/\[id\].vue
git -c commit.gpgsign=false commit -m "perf(member-page): /api/dining 전체 대신 per-member 엔드포인트로 교체"
```

---

## Task 6: Regenerate data assets and verify

**Files:**
- Regenerate: `server/assets/dining.json`, `server/assets/dining-members.json`

This task bakes the updated assets and verifies the size reduction and correctness.

> **Pre-condition:** KA-money xlsx files must be present in `.cache/ka-money/`. If they are NOT available (CI environment), skip Step 1 and proceed from Step 2 using the currently-committed `dining.json` (which still has `byMember` until this step).

- [ ] **Step 1: Run the generator**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
pnpm gen:dining
```

Expected output (approximate):
```
[gen-dining] 254891 식당행 → 200 식당, 260 의원(매칭 259), 지도점 100, 상세 200, per-member 259
```

- [ ] **Step 2: Verify file sizes**

```bash
node -e "
const fs = require('fs');
const d = require('./server/assets/dining.json');
console.log('dining.json size KB:', Math.round(fs.statSync('./server/assets/dining.json').size/1024));
console.log('byMember in dining.json?', 'byMember' in d);
console.log('dining-members.json size KB:', Math.round(fs.statSync('./server/assets/dining-members.json').size/1024));
const m = require('./server/assets/dining-members.json');
console.log('dining-members entry count:', Object.keys(m).length);
console.log('sample entry keys:', Object.keys(Object.values(m)[0]));
"
```

Expected:
- `dining.json` ≈ 102–120 KB (was 265 KB)
- `byMember in dining.json? false`
- `dining-members.json` ≈ 81–100 KB
- entry count ≈ 259
- sample keys: `[ 'visits', 'amount', 'topRestaurants', 'cuisineMix', 'purposeMix', 'districtRate' ]`

- [ ] **Step 3: Run tests**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
pnpm vitest run
```

Expected: all tests pass. The `aggregate()` tests still work because `aggregate()` internally still returns `byMember` — only `gen-dining.mjs` changed how it *writes* the data.

- [ ] **Step 4: Commit the regenerated assets**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
git add server/assets/dining.json server/assets/dining-members.json
git -c commit.gpgsign=false commit -m "data: dining.json byMember 제거 + dining-members.json 생성 (베이크 업데이트)"
```

---

## Task 7: Verify build and prerender

**Files:**
- Read-only verification — no code changes

- [ ] **Step 1: Run full build**

```bash
cd /Users/zihado/work/playground/asm.zihado.com
pnpm build:baked 2>&1 | tail -40
```

Expected: build succeeds with no errors. Watch for Nitro prerender output confirming dining-members routes are baked.

- [ ] **Step 2: Confirm prerendered dining-member files exist**

```bash
ls /Users/zihado/work/playground/asm.zihado.com/.output/public/api/dining-members/ | head -10
ls /Users/zihado/work/playground/asm.zihado.com/.output/public/api/dining-members/ | wc -l
```

Expected: ~300 files (one per member id).

- [ ] **Step 3: Spot-check a prerendered file**

Pick a known member id (e.g., `T2T8225E`) and check:
```bash
node -e "
const fs = require('fs');
const p = '.output/public/api/dining-members/T2T8225E';
if (fs.existsSync(p)) {
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log('keys:', Object.keys(d));
  console.log('visits:', d.visits);
} else {
  console.log('file not found — member may have no dining record (null response is correct)');
  // Null responses are prerendered as 'null' or an empty JSON body — acceptable.
}
"
```

- [ ] **Step 4: Confirm `/api/dining` no longer contains `byMember`**

```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('.output/public/api/dining', 'utf8'));
console.log('byMember in /api/dining output?', 'byMember' in d);
console.log('size KB:', Math.round(JSON.stringify(d).length / 1024));
"
```

Expected: `byMember in /api/dining output? false`, size ≈ 102–120 KB.

- [ ] **Step 5: Final commit (if build artifacts tracked) or report done**

The build output is typically in `.gitignore`. No commit needed for `.output/`. The data assets were committed in Task 6.

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Write `dining-members.json` as keyed map `{ [memberId]: stats }` | Task 1 |
| Drop `id/name/party/origin/matched` from per-member entries | Task 1 Step 3 |
| Remove `byMember` from `dining.json` | Task 1 Step 4 |
| `coverage.matchedMembers` still computed correctly | Task 1 Step 4 |
| Remove `byMember` from `DiningData` type | Task 2 Step 3 |
| Remove `DiningMember` type (unused after change) | Task 2 Step 2 |
| Add `DiningMemberStats` type | Task 2 Step 2 |
| Create `/api/dining-members/[id].get.ts` | Task 3 |
| Returns `null` (not 404) for missing members | Task 3 Step 2 |
| Add `diningMemberRoutes()` helper | Task 4 Step 1 |
| Prerender 300 `/api/dining-members/:id` routes | Task 4 Step 2 |
| Add routeRule `"/api/dining-members/**"` | Task 4 Step 3 |
| Member page: replace full-dining fetch with per-member fetch | Task 5 Steps 1–2 |
| Guard `v-if="myDining && myDining.visits"` (already present) | Task 5 Step 3 |
| `pnpm vitest run` — all green | Task 6 Step 3 |
| `pnpm typecheck` — no new errors | Tasks 2+5 |
| `pnpm build:baked` — succeeds | Task 7 |
| Verify sizes and `byMember` removed | Tasks 6+7 |

### Placeholder scan
- All code blocks are complete and non-generic. ✓
- No "TBD" or "similar to" references. ✓

### Type consistency
- `DiningMemberStats` defined in Task 2; used in Task 3 (`import type`) and Task 5 (`useFetch<DiningMemberStats | null>`). ✓
- `aggregate()` still returns `byMember` internally — test assertions on `out.byMember` remain valid. ✓
- `diningMemberMap` key names (`id`, `name`, `party`, `origin`, `matched`) match the actual `DiningMember` fields that are being destructured. ✓

### Known risk
- If `dining-members.json` does not exist when the server starts (e.g., developer hasn't run `pnpm gen:dining` yet), the dynamic import in `[id].get.ts` will throw at runtime. This is acceptable — it's the same failure mode as all other baked assets (`dining-details.json`, etc.), and the prerender step will catch it at build time.
- The dynamic `import()` with `assert: { type: "json" }` syntax is supported in Node 18+ and Cloudflare Workers (which is the target). If there are issues, an alternative is to use `readFileSync` + `JSON.parse` as in other API handlers, importing at module top-level. Fallback shown below if needed:

```typescript
// Alternative (if dynamic import causes issues):
import map from "../../assets/dining-members.json";
const MAP = map as Record<string, DiningMemberStats>;
export default defineEventHandler(async (event): Promise<DiningMemberStats | null> => {
  const id = getRouterParam(event, "id");
  return id ? MAP[id] ?? null : null;
});
```

This top-level import is exactly what `dining.get.ts` does and is guaranteed to work.
