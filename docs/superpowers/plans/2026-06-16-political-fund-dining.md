# 정치자금 식당(맛집) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 국회의원 정치자금 지출내역(OhmyNews KA-money, 2012~2024)에서 "식당 지출"을 추출해, 정치인이 pick한 식당 뷰어와 당·나이·성별·띠·재산·아파트평수·지역구별 펀팩트 분석을 제공한다.

**Architecture:** 기존 `gen-* → server/assets/*.json → /api/* → UI` 패턴을 따른다. xlsx 파싱·정규화·집계 로직은 순수 함수로 `scripts/lib/dining.mjs`에 분리해 vitest로 단위테스트하고, `scripts/gen-dining.mjs`가 이를 조합해 `server/assets/dining.json`을 굽는다. 무거운 xlsx(≈150MB)는 커밋하지 않고, 베이크 산출 `dining.json`만 커밋해 배포 빌드의 진실 원천으로 삼는다.

**Tech Stack:** Node ESM 스크립트, SheetJS(`xlsx`, 빌드 전용 devDependency), Vitest, Nuxt 4 / Vue 3 / Tailwind v4 / shadcn-vue, lucide-vue-next.

---

## File Structure

- Create `scripts/lib/dining.mjs` — 순수 유틸(컬럼 정규화, 식당필터·상쇄, 가게명 정규화, 음식종류 추정, 주소→시군구, 지역구 매칭, 집계). 테스트 대상.
- Create `test/dining/dining.test.ts` — 위 유틸 단위테스트.
- Create `scripts/gen-dining.mjs` — 오케스트레이터(파일 로드 → 유틸 조합 → `dining.json` 출력).
- Create `server/assets/dining.json` — 베이크 산출물(커밋).
- Create `server/api/dining.get.ts` — 베이크 JSON 서빙.
- Modify `shared/types.ts` — `DiningData` 등 타입 추가.
- Create `app/pages/dining/index.vue` — 식당 뷰어 페이지.
- Create `app/components/DiningBreakdown.vue` — 축별 막대 분석 컴포넌트.
- Create `app/components/DiningDistrictLists.vue` — 지역구 only/never 리스트.
- Modify `app/lib/nav.ts` — 내비 항목 추가.
- Modify `app/pages/insights.vue` — `식당` 탭 추가.
- Modify `app/pages/members/[id].vue` — 의원 식당 미니 카드.
- Modify `app/components/CommandPalette.vue` — `/dining` 등록(기존 패턴 따름).
- Modify `server/routes/sitemap.xml.ts` — `/dining` 포함.
- Modify `package.json` — `gen:dining` 스크립트 + `xlsx` devDependency.
- Modify `.gitignore` — `.cache/ka-money/`.

> 식당 분류 화이트리스트(상수): `간담회_식대`, `사무실_식대비`, `언론_기자식대등`, `간담회_다과`.

---

## Phase 1 — 데이터 파이프라인(유틸 + TDD)

### Task 1: 빌드 의존성 + 캐시 디렉터리

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: xlsx devDependency 설치**

Run: `pnpm add -D xlsx@0.18.5`
Expected: `package.json` devDependencies 에 `"xlsx": "0.18.5"` 추가, 설치 성공.

- [ ] **Step 2: gen:dining 스크립트 추가**

`package.json` scripts 에 추가(기존 `gen:data` 는 건드리지 않음 — xlsx 150MB를 CI에서 매번 다루지 않기 위함):

```json
"gen:dining": "node scripts/gen-dining.mjs",
```

- [ ] **Step 3: .gitignore 에 캐시 추가**

`.gitignore` 에 한 줄 추가:

```
.cache/ka-money/
```

- [ ] **Step 4: 클린 설치 검증 (CI 회귀 방지 — ci-pnpm-allowbuilds 메모리)**

Run: `rm -rf node_modules && pnpm install --frozen-lockfile`
Expected: 설치 성공(xlsx 는 순수 JS, postinstall 빌드 불필요). 실패 시 `pnpm-workspace.yaml` 의 allowBuilds 확인.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore
git commit -m "chore: KA-money 파싱용 xlsx 의존성 + gen:dining 스크립트"
```

---

### Task 2: 컬럼 정규화 유틸

KA-money 파일은 연도별 헤더 라벨이 다르다(지출/지출금회/지출액, 성명/사용처/성명-법인단체명). 헤더명을 보고 표준 키로 매핑한다.

**Files:**
- Create: `scripts/lib/dining.mjs`
- Test: `test/dining/dining.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`test/dining/dining.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapColumns } from "../../scripts/lib/dining.mjs";

describe("mapColumns", () => {
  it("기본 파일 헤더를 표준 키 인덱스로 매핑", () => {
    const header = ["연번","의원번호","의원명","당","당ID","지역명","연월일","내역","지출","성명","분류"];
    expect(mapColumns(header)).toEqual({
      member: 2, party: 3, region: 5, date: 6, desc: 7, amount: 8, merchant: 9, category: 10,
      address: -1, biz: -1,
    });
  });

  it("연도별 라벨 변형(지출액/사용처)도 매핑", () => {
    const header = ["총연번","의원번호","의원명","당","당ID","지역명","연월일","내역","지출액","사용처","분류"];
    const m = mapColumns(header);
    expect(m.amount).toBe(8);
    expect(m.merchant).toBe(9);
  });

  it("리치 파일(주소/업종) 헤더 매핑", () => {
    const header = ["연번","의원번호","의원명","당","당ID","지역명","연월일","내역","수입","수입누계","지출","지출누계","잔액","성명","사업자번호","주소","업종","전화","영수증","분류"];
    const m = mapColumns(header);
    expect(m.amount).toBe(10);
    expect(m.merchant).toBe(13);
    expect(m.address).toBe(15);
    expect(m.biz).toBe(16);
    expect(m.category).toBe(19);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run test/dining/dining.test.ts`
Expected: FAIL — `mapColumns` not exported.

- [ ] **Step 3: 최소 구현**

`scripts/lib/dining.mjs`:

```js
// 헤더 라벨 → 표준 키. 라벨 변형을 정규식으로 흡수, 없으면 -1.
const find = (header, re) => header.findIndex((h) => re.test(String(h || "").replace(/\s/g, "")));

export function mapColumns(header) {
  const incomeIdx = find(header, /^수입$/);
  // "지출" 계열: 리치파일엔 수입/지출 둘 다 있어 '지출'을 우선 선택
  const amount = (() => {
    const exact = find(header, /^지출(액|금회)?$/);
    return exact;
  })();
  return {
    member: find(header, /^의원명$/),
    party: find(header, /^당$/),
    region: find(header, /^지역명$/),
    date: find(header, /^연월일$/),
    desc: find(header, /^내역$/),
    amount,
    merchant: find(header, /^(성명(-법인단체명)?|사용처)$/),
    category: find(header, /^분류$/),
    address: find(header, /^주소$/),
    biz: find(header, /^업종$/),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run test/dining/dining.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/dining.mjs test/dining/dining.test.ts
git commit -m "feat: KA-money 컬럼 정규화 유틸 + 테스트"
```

---

### Task 3: 식당행 필터 + 금액 파싱

**Files:**
- Modify: `scripts/lib/dining.mjs`
- Test: `test/dining/dining.test.ts`

- [ ] **Step 1: 실패 테스트 작성** (append)

```ts
import { FOOD_CATEGORIES, isFoodRow, parseAmount } from "../../scripts/lib/dining.mjs";

describe("FOOD_CATEGORIES", () => {
  it("식당 분류 4종을 포함", () => {
    expect([...FOOD_CATEGORIES].sort()).toEqual(
      ["간담회_다과","간담회_식대","사무실_식대비","언론_기자식대등"].sort(),
    );
  });
});

describe("isFoodRow", () => {
  it("식당 분류면 true, 아니면 false", () => {
    expect(isFoodRow("간담회_식대")).toBe(true);
    expect(isFoodRow("교통_택시")).toBe(false);
    expect(isFoodRow(null)).toBe(false);
  });
});

describe("parseAmount", () => {
  it("숫자/문자/콤마/음수 처리", () => {
    expect(parseAmount(70000)).toBe(70000);
    expect(parseAmount("1,200원")).toBe(1200);
    expect(parseAmount("-4000")).toBe(-4000);
    expect(parseAmount(null)).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run test/dining/dining.test.ts`
Expected: FAIL — exports 미정의.

- [ ] **Step 3: 최소 구현** (append `scripts/lib/dining.mjs`)

```js
export const FOOD_CATEGORIES = new Set([
  "간담회_식대", "사무실_식대비", "언론_기자식대등", "간담회_다과",
]);

export const isFoodRow = (category) => FOOD_CATEGORIES.has(String(category || "").trim());

export function parseAmount(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : 0;
  const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run test/dining/dining.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/dining.mjs test/dining/dining.test.ts
git commit -m "feat: 식당행 필터 + 금액 파서"
```

---

### Task 4: 가게명 정규화 + 음식종류 추정

**Files:**
- Modify: `scripts/lib/dining.mjs`
- Test: `test/dining/dining.test.ts`

- [ ] **Step 1: 실패 테스트 작성** (append)

```ts
import { normalizeMerchant, inferCuisine } from "../../scripts/lib/dining.mjs";

describe("normalizeMerchant", () => {
  it("괄호 보조설명·공백 정리, 동일 상호 병합", () => {
    expect(normalizeMerchant("엘에스씨푸드(국회의사당)")).toBe("엘에스씨푸드");
    expect(normalizeMerchant("투썸플레이스서여의도점")).toBe("투썸플레이스");
    expect(normalizeMerchant("  달구지 ")).toBe("달구지");
  });
  it("빈 값/null 은 빈 문자열", () => {
    expect(normalizeMerchant(null)).toBe("");
  });
});

describe("inferCuisine", () => {
  it("업종 우선 분류", () => {
    expect(inferCuisine("아무이름", "기관구내식당업")).toBe("구내식당");
    expect(inferCuisine("아무이름", "카페")).toBe("카페·음료");
    expect(inferCuisine("아무이름", "한식")).toBe("한식");
  });
  it("업종 없으면 가게명 휴리스틱", () => {
    expect(inferCuisine("스타벅스", null)).toBe("카페·음료");
    expect(inferCuisine("○○숯불갈비", null)).toBe("고기·구이");
    expect(inferCuisine("정체불명상호", null)).toBe("기타");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run test/dining/dining.test.ts`
Expected: FAIL.

- [ ] **Step 3: 최소 구현** (append `scripts/lib/dining.mjs`)

```js
export function normalizeMerchant(v) {
  let s = String(v ?? "").trim();
  if (!s) return "";
  s = s.replace(/\([^)]*\)/g, "");                       // (국회의사당) 등 괄호 제거
  s = s.replace(/(서울|여의도|국회)?[가-힣A-Za-z]*점$/u, (m) => (m.length <= 3 ? m : "")); // ...지점 제거(짧은 '~점' 보존)
  return s.replace(/\s+/g, "").trim();
}

const CUISINE_RULES = [
  ["구내식당", /구내식당/],
  ["카페·음료", /카페|커피|음료|스타벅스|투썸|이디야|파리바게|베이커리|제과/],
  ["고기·구이", /갈비|숯불|구이|삼겹|곱창|족발|한우|불고기/],
  ["일식", /일식|스시|초밥|돈카츠|라멘|우동|이자카야/],
  ["중식", /중식|중화|짜장|마라|반점|루\b/],
  ["양식", /양식|파스타|피자|스테이크|레스토랑|이탈리/],
  ["분식·면", /분식|국수|냉면|칼국수|김밥/],
  ["주점", /주점|호프|포차|맥주|와인|바\b/],
  ["한식", /한식|국밥|백반|찌개|한정식|식당|음식점|음식업|요식|외식/],
];

// 업종(biz) 우선, 없으면 가게명. 매칭 없으면 "기타".
export function inferCuisine(merchant, biz) {
  const hay = `${String(biz || "")} ${String(merchant || "")}`;
  for (const [label, re] of CUISINE_RULES) if (re.test(hay)) return label;
  return "기타";
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run test/dining/dining.test.ts`
Expected: PASS. (실패 시 규칙 순서/정규식 조정 — 구내식당·카페가 한식보다 먼저 평가되어야 함.)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/dining.mjs test/dining/dining.test.ts
git commit -m "feat: 가게명 정규화 + 음식종류 추정"
```

---

### Task 5: 주소→시군구 + 지역구 매칭

`gen-wealth.mjs` 의 SIDO/별칭 로직을 재사용(복제)한다. 식당 주소의 시·군·구가 의원 지역구 시·군·구와 같으면 "지역구 내".

**Files:**
- Modify: `scripts/lib/dining.mjs`
- Test: `test/dining/dining.test.ts`

- [ ] **Step 1: 실패 테스트 작성** (append)

```ts
import { guOf, originGu, inOwnDistrict } from "../../scripts/lib/dining.mjs";

describe("guOf", () => {
  it("주소에서 '시도 구' 추출", () => {
    expect(guOf("서울특별시영등포구국회대로72길22")).toBe("서울 영등포구");
    expect(guOf("경기도성남시분당구판교로")).toBe("경기 성남시");
  });
  it("파싱 불가 시 null", () => {
    expect(guOf("주소불명")).toBe(null);
  });
});

describe("originGu", () => {
  it("의원 지역구에서 '시도 구' 추출, 비례는 null", () => {
    expect(originGu("서울 영등포구을")).toBe("서울 영등포구");
    expect(originGu("비례대표")).toBe(null);
  });
});

describe("inOwnDistrict", () => {
  it("식당 시군구가 지역구와 같으면 true", () => {
    expect(inOwnDistrict("서울 영등포구", "서울 영등포구")).toBe(true);
    expect(inOwnDistrict("서울 강남구", "서울 영등포구")).toBe(false);
    expect(inOwnDistrict(null, "서울 영등포구")).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run test/dining/dining.test.ts`
Expected: FAIL.

- [ ] **Step 3: 최소 구현** (append `scripts/lib/dining.mjs`)

```js
const SIDO = ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
const SIDO_ALIAS = {
  서울특별시:"서울", 부산광역시:"부산", 대구광역시:"대구", 인천광역시:"인천", 광주광역시:"광주",
  대전광역시:"대전", 울산광역시:"울산", 세종특별자치시:"세종", 경기도:"경기",
  강원특별자치도:"강원", 강원도:"강원", 충청북도:"충북", 충청남도:"충남",
  전북특별자치도:"전북", 전라북도:"전북", 전라남도:"전남", 경상북도:"경북", 경상남도:"경남", 제주특별자치도:"제주",
};
function sidoOf(addr) {
  const a = String(addr || "").trim();
  for (const [full, s] of Object.entries(SIDO_ALIAS)) if (a.startsWith(full)) return s;
  for (const s of SIDO) if (a.startsWith(s)) return s;
  return null;
}
export function guOf(addr) {
  const s = sidoOf(addr);
  if (!s) return null;
  let rest = String(addr).trim();
  for (const full of Object.keys(SIDO_ALIAS)) if (rest.startsWith(full)) { rest = rest.slice(full.length); break; }
  for (const sd of SIDO) if (rest.startsWith(sd)) { rest = rest.slice(sd.length); break; }
  const m = rest.match(/^\s*([가-힣]+?[시군구])/);
  return m ? `${s} ${m[1]}` : null;
}
export function originGu(origin) {
  const o = String(origin || "").trim();
  if (!o || o.includes("비례")) return null;
  const s = SIDO.find((sd) => o.startsWith(sd));
  if (!s) return null;
  const rest = o.slice(s.length);
  const m = rest.match(/^\s*([가-힣]+?[시군구])/);
  return m ? `${s} ${m[1]}` : null;
}
export const inOwnDistrict = (restaurantGu, memberGu) =>
  !!restaurantGu && !!memberGu && restaurantGu === memberGu;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run test/dining/dining.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/dining.mjs test/dining/dining.test.ts
git commit -m "feat: 주소→시군구 파싱 + 지역구 매칭 유틸"
```

---

### Task 6: 집계 함수 `aggregate`

행 배열 + 현직 의원 인덱스(이름→데모그래픽)를 받아 `dining.json` 형태로 집계하는 순수 함수.

**Files:**
- Modify: `scripts/lib/dining.mjs`
- Test: `test/dining/dining.test.ts`

- [ ] **Step 1: 실패 테스트 작성** (append)

```ts
import { aggregate } from "../../scripts/lib/dining.mjs";

const rows = [
  // {member, party, origin, amount, merchant, cuisine, category, gu}
  { member:"강득구", party:"더불어민주당", origin:"경기 안양시", amount:96000, merchant:"한류관", cuisine:"한식", category:"간담회_식대", gu:"서울 영등포구" },
  { member:"강득구", party:"더불어민주당", origin:"경기 안양시", amount:45000, merchant:"하동관", cuisine:"한식", category:"사무실_식대비", gu:"경기 안양시" },
  { member:"강득구", party:"더불어민주당", origin:"경기 안양시", amount:-45000, merchant:"하동관", cuisine:"한식", category:"사무실_식대비", gu:"경기 안양시" }, // 상쇄
];
const members = new Map([
  ["강득구", { id:"X1", name:"강득구", party:"더불어민주당", origin:"경기 안양시", ageBucket:"50대", gender:"남", zodiac:"토끼", wealthBucket:"10억 미만", pyeongBucket:"30평대" }],
]);

describe("aggregate", () => {
  const out = aggregate(rows, members);
  it("음수행을 상쇄해 합계 계산", () => {
    const m = out.byMember.find((x) => x.name === "강득구");
    expect(m.amount).toBe(96000); // 45000 - 45000 상쇄
    expect(m.visits).toBe(1);     // 상쇄된 쌍 제외, 순방문 1
  });
  it("식당 랭킹 생성", () => {
    expect(out.restaurants.find((r) => r.name === "한류관").amount).toBe(96000);
  });
  it("지역구 비율: 강득구는 모두 지역구 밖(영등포)", () => {
    const d = out.district.onlyInDistrict.concat(out.district.neverInDistrict);
    expect(out.byMember.find((x)=>x.name==="강득구").districtRate).toBe(0);
  });
  it("breakdowns 는 매칭 의원 기준 생성", () => {
    expect(out.breakdowns.byParty.find((b) => b.key === "더불어민주당").n).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run test/dining/dining.test.ts`
Expected: FAIL.

- [ ] **Step 3: 최소 구현** (append `scripts/lib/dining.mjs`)

```js
// 같은 의원·가게·금액의 음/양 쌍을 상쇄(정정·반환). 남은 양수 행만 집계.
function netRows(rows) {
  const neg = new Map();
  for (const r of rows) if (r.amount < 0) {
    const k = `${r.member}|${r.merchant}|${Math.abs(r.amount)}`;
    neg.set(k, (neg.get(k) || 0) + 1);
  }
  const out = [];
  for (const r of rows) {
    if (r.amount <= 0) continue;
    const k = `${r.member}|${r.merchant}|${r.amount}`;
    if (neg.get(k) > 0) { neg.set(k, neg.get(k) - 1); continue; } // 상쇄
    out.push(r);
  }
  return out;
}

const topN = (arr, key, n) => [...arr].sort((a, b) => b[key] - a[key]).slice(0, n);

function bucketRows(rowsByMember, members, field) {
  const acc = new Map(); // key -> {n:Set, amount, visits, cuisine:Map}
  for (const [name, agg] of rowsByMember) {
    const dem = members.get(name);
    if (!dem || dem[field] == null) continue;
    const key = dem[field];
    if (!acc.has(key)) acc.set(key, { members: new Set(), amount: 0, visits: 0, cuisine: new Map() });
    const a = acc.get(key);
    a.members.add(name); a.amount += agg.amount; a.visits += agg.visits;
    for (const [c, v] of agg.cuisine) a.cuisine.set(c, (a.cuisine.get(c) || 0) + v);
  }
  return [...acc.entries()].map(([key, a]) => ({
    key, n: a.members.size,
    avgMeal: a.visits ? Math.round(a.amount / a.visits) : 0,
    topCuisine: topMapKey(a.cuisine),
  })).sort((x, y) => y.n - x.n);
}
const topMapKey = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "기타";

export function aggregate(rows, members, opts = {}) {
  const RTOP = opts.restaurantTop ?? 200;
  const net = netRows(rows);

  // 식당 랭킹
  const rest = new Map();
  for (const r of net) {
    if (!rest.has(r.merchant)) rest.set(r.merchant, { name: r.merchant, cuisine: r.cuisine, visits: 0, amount: 0, members: new Set(), gu: r.gu });
    const x = rest.get(r.merchant); x.visits++; x.amount += r.amount; x.members.add(r.member);
  }
  const restaurants = topN([...rest.values()].map((x) => ({ ...x, members: x.members.size })), "visits", RTOP);

  // 의원별
  const byName = new Map();
  for (const r of net) {
    if (!byName.has(r.member)) byName.set(r.member, { name: r.member, party: r.party, origin: r.origin, visits: 0, amount: 0, inDist: 0, distKnown: 0, cuisine: new Map(), purpose: new Map(), rests: new Map() });
    const a = byName.get(r.member);
    a.visits++; a.amount += r.amount;
    a.cuisine.set(r.cuisine, (a.cuisine.get(r.cuisine) || 0) + 1);
    a.purpose.set(r.category, (a.purpose.get(r.category) || 0) + 1);
    a.rests.set(r.merchant, (a.rests.get(r.merchant) || 0) + 1);
    if (r.gu) { a.distKnown++; if (inOwnDistrict(r.gu, originGu(r.origin))) a.inDist++; }
  }

  const byMember = [...byName.values()].map((a) => {
    const dem = members.get(a.name);
    const rate = a.distKnown ? a.inDist / a.distKnown : null;
    return {
      id: dem?.id ?? "", name: a.name, party: a.party, origin: a.origin, matched: !!dem,
      visits: a.visits, amount: a.amount,
      topRestaurants: [...a.rests.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([name, visits]) => ({ name, visits })),
      cuisineMix: Object.fromEntries(a.cuisine), purposeMix: Object.fromEntries(a.purpose),
      districtRate: rate == null ? null : Math.round(rate * 100) / 100,
    };
  }).sort((x, y) => y.amount - x.amount);

  // 음식종류 전체 분포
  const cui = new Map();
  for (const r of net) { if (!cui.has(r.cuisine)) cui.set(r.cuisine, { type: r.cuisine, visits: 0, amount: 0 }); const x = cui.get(r.cuisine); x.visits++; x.amount += r.amount; }
  const cuisine = topN([...cui.values()], "visits", 20);

  // breakdowns (매칭 의원 기준)
  const memberAgg = byName; // name -> agg
  const breakdowns = {
    byParty: bucketRows(memberAgg, members, "party"),
    byAge: bucketRows(memberAgg, members, "ageBucket"),
    byGender: bucketRows(memberAgg, members, "gender"),
    byZodiac: bucketRows(memberAgg, members, "zodiac"),
    byWealth: bucketRows(memberAgg, members, "wealthBucket"),
    byPyeong: bucketRows(memberAgg, members, "pyeongBucket"),
  };

  // 지역구 only/never (지역구 의원 + distKnown>0)
  const dist = byMember.filter((m) => m.districtRate != null && originGu(m.origin));
  const proportional = byMember.filter((m) => !originGu(m.origin)).map((m) => ({ id: m.id, name: m.name }));
  const addrKnown = net.filter((r) => r.gu).length;
  return {
    restaurants, byMember, cuisine, breakdowns,
    district: {
      addrCoverage: net.length ? Math.round((addrKnown / net.length) * 100) / 100 : 0,
      onlyInDistrict: dist.filter((m) => m.districtRate === 1).map(pickDist),
      neverInDistrict: dist.filter((m) => m.districtRate === 0).map(pickDist),
      proportional,
    },
  };
}
const pickDist = (m) => ({ id: m.id, name: m.name, party: m.party, origin: m.origin, rate: m.districtRate });
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run test/dining/dining.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/dining.mjs test/dining/dining.test.ts
git commit -m "feat: 식당 지출 집계 함수 aggregate + 테스트"
```

---

### Task 7: 오케스트레이터 `gen-dining.mjs`

파일들을 읽어 행을 정규화한 뒤 `aggregate` 로 `dining.json` 을 굽는다. 현직 의원 데모그래픽 인덱스는 `members.json`(나이/성별) + `wealth.json`(재산/평수) + 띠 계산으로 구성.

**Files:**
- Create: `scripts/gen-dining.mjs`
- Create: `server/assets/dining.json` (스크립트 실행 산출)

- [ ] **Step 1: 스크립트 작성**

`scripts/gen-dining.mjs`:

```js
#!/usr/bin/env node
/**
 * 정치자금 식당 지출 베이크 → server/assets/dining.json
 * 원천: OhmyNews/KA-money (오마이뉴스·경향신문·뉴스타파, 2012~2024, 선거자금 제외). 출처표시 필수.
 * 입력: KA_MONEY_DIR(기본 ./.cache/ka-money) 의 *_KAPF*.xlsx
 * 주의: gen:data 비포함 — 수동 `pnpm gen:dining` 후 dining.json 커밋.
 */
import { writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { mapColumns, isFoodRow, parseAmount, normalizeMerchant, inferCuisine, guOf, aggregate } from "./lib/dining.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.env.KA_MONEY_DIR || join(root, ".cache/ka-money");
const OUT = join(root, "server/assets/dining.json");
const SOURCE = { name: "오마이뉴스·경향신문·뉴스타파", url: "https://omn.kr/187rv" };

// gen-graph-data.mjs 와 동일 기준 유지(2020=쥐). 불일치 시 펀팩트 띠 분석이 어긋남.
const ZODIAC = ["쥐","소","호랑이","토끼","용","뱀","말","양","원숭이","닭","개","돼지"];
const zodiacOf = (birth) => { const y = parseInt(String(birth).slice(0, 4), 10); return Number.isFinite(y) ? ZODIAC[(((y - 2020) % 12) + 12) % 12] : null; };
const ageBucket = (birth) => { const y = parseInt(String(birth).slice(0, 4), 10); if (!Number.isFinite(y)) return null; const a = 2026 - y; return `${Math.floor(a / 10) * 10}대`; };
const wealthBucket = (eok) => { if (eok == null) return null; if (eok < 10) return "10억 미만"; if (eok < 30) return "10억대"; if (eok < 50) return "30억대"; if (eok < 100) return "50억~100억"; return "100억 이상"; };
const pyeongBucket = (p) => { if (p == null) return null; if (p < 20) return "20평 미만"; if (p < 30) return "20평대"; if (p < 40) return "30평대"; if (p < 50) return "40평대"; return "50평 이상"; };

function buildMemberIndex() {
  const members = JSON.parse(readFileSync(join(root, "server/assets/members.json"), "utf8"));
  const arr = Array.isArray(members) ? members : members.rows ?? Object.values(members);
  const wealth = existsSync(join(root, "server/assets/wealth.json")) ? JSON.parse(readFileSync(join(root, "server/assets/wealth.json"), "utf8")) : { members: [], apt: { largest: [], smallest: [] } };
  const wByName = new Map((wealth.members || []).map((m) => [m.name, m.total]));
  const pByName = new Map([...(wealth.apt?.largest || []), ...(wealth.apt?.smallest || [])].map((a) => [a.name, a.pyeong]));
  const nameCount = {};
  for (const m of arr) nameCount[m.name] = (nameCount[m.name] || 0) + 1;
  const idx = new Map();
  for (const m of arr) {
    if (nameCount[m.name] !== 1) continue; // 동명이인 제외
    idx.set(m.name, {
      id: m.id, name: m.name, party: (m.party || "").split("/")[0]?.trim() || "무소속", origin: m.origin,
      ageBucket: ageBucket(m.birth), gender: m.sex || null, zodiac: zodiacOf(m.birth),
      wealthBucket: wealthBucket(wByName.get(m.name)), pyeongBucket: pyeongBucket(pByName.get(m.name)),
    });
  }
  return idx;
}

function readRows(file) {
  const wb = XLSX.readFile(join(DIR, file), { cellDates: true });
  const ws = wb.Sheets["Data"] || wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  if (!grid.length) return [];
  const col = mapColumns(grid[0]);
  const out = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const category = r[col.category];
    if (!isFoodRow(category)) continue;
    const merchant = normalizeMerchant(r[col.merchant]);
    if (!merchant) continue;
    const addr = col.address >= 0 ? r[col.address] : null;
    out.push({
      member: String(r[col.member] || "").trim(),
      party: String(r[col.party] || "").trim(),
      origin: String(r[col.region] || "").trim(),
      amount: parseAmount(r[col.amount]),
      merchant,
      cuisine: inferCuisine(merchant, col.biz >= 0 ? r[col.biz] : null),
      category: String(category).trim(),
      gu: col.address >= 0 ? guOf(addr) : null,
    });
  }
  return out;
}

function main() {
  if (!existsSync(DIR)) { console.warn(`[gen-dining] ${DIR} 없음 — KA-money xlsx 를 받아 두세요. 기존 dining.json 유지.`); return; }
  const files = readdirSync(DIR).filter((f) => /_KAPF.*\.xlsx$/i.test(f));
  // 같은 연도에 리치(_수입지출) 파일이 있으면 그것만 사용(주소·업종 포함)
  const richBase = new Set(files.filter((f) => /_수입지출/.test(f)).map((f) => f.replace("_수입지출", "")));
  const use = files.filter((f) => /_수입지출/.test(f) || !richBase.has(f));
  const years = new Set();
  let rows = [];
  for (const f of use) { const y = (f.match(/^(\d{4})/) || [])[1]; if (y) years.add(+y); rows = rows.concat(readRows(f)); }

  const members = buildMemberIndex();
  const agg = aggregate(rows, members, { restaurantTop: 200 });
  const out = {
    basis: "정치자금 지출보고서 2012~2024 (선거자금 제외)",
    source: SOURCE,
    generatedAt: new Date().toISOString().slice(0, 10),
    years: [...years].sort(),
    coverage: { rows: rows.length, matchedMembers: agg.byMember.filter((m) => m.matched).length, addrYears: [2023, 2024] },
    ...agg,
  };
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`[gen-dining] ${rows.length} 식당행 → ${agg.restaurants.length} 식당, ${agg.byMember.length} 의원, 매칭 ${out.coverage.matchedMembers}`);
}
main();
```

- [ ] **Step 2: KA-money 파일 준비 후 실행**

Run:
```bash
mkdir -p .cache/ka-money && \
git clone --depth 1 https://github.com/OhmyNews/KA-money /tmp/KA-money && \
cp /tmp/KA-money/*_KAPF*.xlsx .cache/ka-money/ && \
pnpm gen:dining
```
Expected: `[gen-dining] N 식당행 → M 식당, K 의원, 매칭 ~300` 로그, `server/assets/dining.json` 생성.

- [ ] **Step 3: 산출물 sanity 체크**

Run: `node -e "const d=require('./server/assets/dining.json'); console.log('restaurants',d.restaurants.length,'members',d.byMember.length,'matched',d.coverage.matchedMembers,'addrCoverage',d.district.addrCoverage); console.log('top',d.restaurants[0]); console.log('byParty',d.breakdowns.byParty.slice(0,3));"`
Expected: restaurants>0, matched 매칭 수 ≈ 현직 의원 수, addrCoverage>0.5, top 식당과 정당별 분석이 그럴듯함.

- [ ] **Step 4: Commit (산출물 포함)**

```bash
git add scripts/gen-dining.mjs server/assets/dining.json
git commit -m "feat: gen-dining 오케스트레이터 + dining.json 베이크"
```

---

## Phase 2 — 타입 + API

### Task 8: 타입 정의

**Files:**
- Modify: `shared/types.ts`

- [ ] **Step 1: 타입 추가** (파일 끝에 append)

```ts
export interface DiningRestaurant {
  name: string;
  cuisine: string;
  visits: number;
  amount: number;
  members: number;
  gu: string | null;
}
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
export interface DiningBreakdownRow {
  key: string;
  n: number;
  avgMeal: number;
  topCuisine: string;
}
export interface DiningDistrictMember {
  id: string;
  name: string;
  party: string;
  origin: string;
  rate: number;
}
export interface DiningData {
  basis: string;
  source: { name: string; url: string };
  generatedAt: string;
  years: number[];
  coverage: { rows: number; matchedMembers: number; addrYears: number[] };
  restaurants: DiningRestaurant[];
  byMember: DiningMember[];
  cuisine: { type: string; visits: number; amount: number }[];
  breakdowns: {
    byParty: DiningBreakdownRow[];
    byAge: DiningBreakdownRow[];
    byGender: DiningBreakdownRow[];
    byZodiac: DiningBreakdownRow[];
    byWealth: DiningBreakdownRow[];
    byPyeong: DiningBreakdownRow[];
  };
  district: {
    addrCoverage: number;
    onlyInDistrict: DiningDistrictMember[];
    neverInDistrict: DiningDistrictMember[];
    proportional: { id: string; name: string }[];
  };
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 기존 에러(local-verify-flow 메모리 참조) 외 신규 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add shared/types.ts
git commit -m "feat: DiningData 타입 정의"
```

---

### Task 9: API 라우트

**Files:**
- Create: `server/api/dining.get.ts`

- [ ] **Step 1: 라우트 작성** (wealth.get.ts 패턴 동일)

```ts
import dining from "../assets/dining.json";
import type { DiningData } from "#shared/types";

/** 정치자금 식당 지출 (OhmyNews KA-money 2012~2024 — 빌드 베이크) */
export default defineEventHandler((): DiningData => dining as unknown as DiningData);
```

- [ ] **Step 2: 빌드 검증(엔드포인트 존재)**

Run: `pnpm build:baked 2>&1 | tail -5 && grep -rl "dining" .output/server 2>/dev/null | head -1`
Expected: 빌드 성공, dining 핸들러가 출력에 포함.

- [ ] **Step 3: Commit**

```bash
git add server/api/dining.get.ts
git commit -m "feat: /api/dining 라우트"
```

---

## Phase 3 — 뷰어 페이지 + 내비

### Task 10: 내비/팔레트/사이트맵 등록

**Files:**
- Modify: `app/lib/nav.ts`
- Modify: `app/components/CommandPalette.vue`
- Modify: `server/routes/sitemap.xml.ts`

- [ ] **Step 1: nav.ts 항목 추가**

`import` 에 `Utensils` 추가, `NAV_ITEMS` 의 `펀팩트` 앞에 삽입:

```ts
{ to: "/dining", label: "정치자금 맛집", icon: Utensils, desc: "정치인이 pick한 식당" },
```

- [ ] **Step 2: CommandPalette 등록**

`app/components/CommandPalette.vue` 에서 페이지 목록을 만드는 기존 배열(직접 확인 후)에 `{ to: "/dining", label: "정치자금 맛집" }` 추가. (구조는 파일을 열어 기존 항목과 동일 형식으로.)

- [ ] **Step 3: sitemap 등록**

`server/routes/sitemap.xml.ts` 의 정적 경로 배열에 `"/dining"` 추가(기존 경로 목록과 동일 위치).

- [ ] **Step 4: Commit**

```bash
git add app/lib/nav.ts app/components/CommandPalette.vue server/routes/sitemap.xml.ts
git commit -m "feat: 정치자금 맛집 내비/팔레트/사이트맵 등록"
```

---

### Task 11: 뷰어 페이지 `/dining`

식당 랭킹(검색·음식종류 필터) + 의원 dining 프로필. 출처표시 필수.

**Files:**
- Create: `app/pages/dining/index.vue`

- [ ] **Step 1: 페이지 작성**

```vue
<script setup lang="ts">
import { Utensils } from "lucide-vue-next";
import type { DiningData } from "#shared/types";

const { data } = await useFetch<DiningData>("/api/dining", { key: "dining" });

const q = ref("");
const cuisine = ref<string>("전체");
const cuisineTypes = computed(() => ["전체", ...new Set((data.value?.restaurants ?? []).map((r) => r.cuisine))]);
const restaurants = computed(() => {
  const term = q.value.trim();
  return (data.value?.restaurants ?? []).filter(
    (r) => (cuisine.value === "전체" || r.cuisine === cuisine.value) && (!term || r.name.includes(term)),
  );
});
const won = (n: number) => n.toLocaleString("ko-KR");

useHead({ title: "정치자금 맛집 · 의정감시" });
useSeoMeta({
  description: "국회의원 정치자금 지출내역으로 본, 정치인이 pick한 식당 — 자료: 오마이뉴스·경향신문·뉴스타파",
  ogTitle: "정치인이 pick한 식당 — 정치자금 맛집",
  ogImage: "https://asm.zihado.com/og-insights.png",
  twitterCard: "summary_large_image",
});
</script>

<template>
  <div>
    <PageHeader eyebrow="정치자금 지출내역" title="정치인이 pick한 식당" :subtitle="`${data?.coverage.rows.toLocaleString() ?? 0}건 식당 지출 · ${data?.years.at(0)}~${data?.years.at(-1)}`" />

    <div class="flex flex-wrap gap-2 my-4">
      <Input v-model="q" placeholder="식당 검색" class="max-w-xs" />
      <select v-model="cuisine" class="rounded-lg border border-toss-gray-200 px-3 text-sm">
        <option v-for="c in cuisineTypes" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <div class="rounded-2xl border border-toss-gray-200 bg-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-toss-gray-50 text-toss-gray-500">
          <tr><th class="text-left px-4 py-2">식당</th><th class="px-4 py-2">종류(추정)</th><th class="px-4 py-2">방문</th><th class="px-4 py-2">금액</th><th class="px-4 py-2">의원수</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in restaurants.slice(0, 100)" :key="r.name" class="border-t border-toss-gray-100">
            <td class="px-4 py-2 font-semibold">{{ r.name }}<span v-if="r.gu" class="ml-1 text-[11px] text-toss-gray-400">{{ r.gu }}</span></td>
            <td class="px-4 py-2 text-center text-toss-gray-500">{{ r.cuisine }}</td>
            <td class="px-4 py-2 text-center">{{ r.visits }}</td>
            <td class="px-4 py-2 text-right">{{ won(r.amount) }}원</td>
            <td class="px-4 py-2 text-center">{{ r.members }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-4 text-[11px] text-toss-gray-400">
      자료: <a :href="data?.source.url" target="_blank" rel="noopener" class="font-semibold hover:text-toss-blue">{{ data?.source.name }}</a>
      · {{ data?.basis }} · 음식종류는 가게명·업종 기반 추정입니다.
    </p>
  </div>
</template>
```

- [ ] **Step 2: 빌드/프리렌더 검증**

Run: `pnpm build:baked 2>&1 | tail -3 && node .output/server/index.mjs & sleep 2; curl -s localhost:3000/dining | grep -o "정치인이 pick한 식당" | head -1; kill %1`
Expected: 페이지에 제목 문자열 존재(SSR 정상). (local-verify-flow 메모리: dev SSR 불가 → node-server 검증.)

- [ ] **Step 3: Commit**

```bash
git add app/pages/dining/index.vue
git commit -m "feat: 정치자금 맛집 뷰어 페이지"
```

---

## Phase 4 — 펀팩트 분석 탭

### Task 12: 분석 컴포넌트 `DiningBreakdown.vue`

**Files:**
- Create: `app/components/DiningBreakdown.vue`

- [ ] **Step 1: 컴포넌트 작성**

```vue
<script setup lang="ts">
import type { DiningBreakdownRow } from "#shared/types";
const props = defineProps<{ title: string; rows: DiningBreakdownRow[]; denom?: string }>();
const won = (n: number) => n.toLocaleString("ko-KR");
const max = computed(() => Math.max(1, ...props.rows.map((r) => r.avgMeal)));
</script>

<template>
  <div class="rounded-2xl border border-toss-gray-200 bg-card p-5">
    <div class="flex items-baseline justify-between mb-3">
      <h3 class="font-bold text-toss-gray-900">{{ title }}</h3>
      <span v-if="denom" class="text-[11px] text-toss-gray-400">{{ denom }}</span>
    </div>
    <ul class="space-y-2">
      <li v-for="r in rows" :key="r.key" class="text-sm">
        <div class="flex justify-between"><span class="font-semibold">{{ r.key }} <span class="text-toss-gray-400 font-normal">({{ r.n }}명)</span></span><span class="text-toss-gray-500">평균 {{ won(r.avgMeal) }}원 · {{ r.topCuisine }}</span></div>
        <div class="mt-1 h-2 rounded-full bg-toss-gray-100 overflow-hidden"><div class="h-full bg-toss-blue rounded-full" :style="{ width: `${Math.min(100, (r.avgMeal / max) * 100)}%` }" /></div>
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/DiningBreakdown.vue
git commit -m "feat: 식당 분석(축별) 컴포넌트"
```

---

### Task 13: 지역구 리스트 컴포넌트 `DiningDistrictLists.vue`

**Files:**
- Create: `app/components/DiningDistrictLists.vue`

- [ ] **Step 1: 컴포넌트 작성**

```vue
<script setup lang="ts">
import type { DiningData } from "#shared/types";
const props = defineProps<{ district: DiningData["district"] }>();
</script>

<template>
  <div class="grid sm:grid-cols-2 gap-4">
    <div class="rounded-2xl border border-toss-gray-200 bg-card p-5">
      <h3 class="font-bold text-toss-gray-900 mb-1">자기 지역구에서만 먹는 의원</h3>
      <p class="text-[11px] text-toss-gray-400 mb-3">식당 주소 매칭 커버리지 {{ Math.round(props.district.addrCoverage * 100) }}% · 지역구 의원 기준</p>
      <ol class="space-y-1 text-sm">
        <li v-for="m in props.district.onlyInDistrict.slice(0, 20)" :key="m.id" class="flex justify-between"><span class="font-semibold">{{ m.name }}</span><span class="text-toss-gray-500">{{ m.party }} · {{ m.origin }}</span></li>
        <li v-if="!props.district.onlyInDistrict.length" class="text-toss-gray-400">해당 없음</li>
      </ol>
    </div>
    <div class="rounded-2xl border border-toss-gray-200 bg-card p-5">
      <h3 class="font-bold text-toss-gray-900 mb-1">지역구에서 안 먹는 의원</h3>
      <p class="text-[11px] text-toss-gray-400 mb-3">지역구 밖(주로 여의도)에서만 지출 · 비례대표 {{ props.district.proportional.length }}명 제외</p>
      <ol class="space-y-1 text-sm">
        <li v-for="m in props.district.neverInDistrict.slice(0, 20)" :key="m.id" class="flex justify-between"><span class="font-semibold">{{ m.name }}</span><span class="text-toss-gray-500">{{ m.party }} · {{ m.origin }}</span></li>
        <li v-if="!props.district.neverInDistrict.length" class="text-toss-gray-400">해당 없음</li>
      </ol>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/DiningDistrictLists.vue
git commit -m "feat: 지역구 식당 only/never 리스트 컴포넌트"
```

---

### Task 14: insights.vue 에 `식당` 탭 추가

**Files:**
- Modify: `app/pages/insights.vue`

- [ ] **Step 1: 스크립트 — 타입·페치·탭 확장**

`Tab` 타입에 `"dining"` 추가, `initTab` 의 조건에 `dining` 추가, 지연 페치 추가:

```ts
type Tab = "fun" | "graph" | "wealth" | "discover" | "dining";
const initTab = (q: unknown): Tab => (q === "graph" || q === "wealth" || q === "discover" || q === "dining" ? q : "fun");
// ...
const { data: dn, execute: loadDining } = useFetch<DiningData>("/api/dining", { key: "dining", server: false, immediate: false });
// watch(tab,...) 안에 추가:
if (t === "dining") loadDining();
```

`import type` 줄에 `DiningData` 추가, lucide import 에 `Utensils` 추가.

- [ ] **Step 2: 템플릿 — 탭 버튼 추가**

`discover` 탭 버튼 블록과 동일 형식으로 `dining` 버튼을 탭 바에 추가:

```vue
<button
  :class="tab === 'dining' ? 'bg-card text-toss-gray-900 card-shadow' : 'text-toss-gray-500'"
  @click="tab = 'dining'"
>식당</button>
```

- [ ] **Step 3: 템플릿 — 탭 콘텐츠 추가** (다른 `tab === ...` 블록들과 형제로)

```vue
<template v-else-if="tab === 'dining'">
  <div v-if="dn" class="space-y-6">
    <div class="grid md:grid-cols-2 gap-4">
      <RankingCard
        title="가장 많이 간 식당 (방문수)" :icon="Utensils"
        :items="dn.restaurants.slice(0, 10).map((r) => ({ id: r.name, name: r.name, party: r.cuisine, origin: r.gu ?? '', photo: '', count: r.visits }))"
        unit="회" accent="#FF9500"
      />
      <DiningBreakdown title="음식종류 분포(추정)" :rows="dn.cuisine.map((c) => ({ key: c.type, n: c.visits, avgMeal: Math.round(c.amount / Math.max(1, c.visits)), topCuisine: c.type }))" denom="전체 식당 지출 기준" />
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      <DiningBreakdown title="정당별 평균 식대" :rows="dn.breakdowns.byParty" :denom="`현직 매칭 ${dn.coverage.matchedMembers}명`" />
      <DiningBreakdown title="나이대별 평균 식대" :rows="dn.breakdowns.byAge" />
      <DiningBreakdown title="성별 평균 식대" :rows="dn.breakdowns.byGender" />
      <DiningBreakdown title="띠별 평균 식대" :rows="dn.breakdowns.byZodiac" />
      <DiningBreakdown title="재산구간별 평균 식대" :rows="dn.breakdowns.byWealth" />
      <DiningBreakdown title="아파트 평수별 평균 식대" :rows="dn.breakdowns.byPyeong" />
    </div>
    <DiningDistrictLists :district="dn.district" />
    <p class="text-[11px] text-toss-gray-400">자료: <a :href="dn.source.url" target="_blank" rel="noopener" class="font-semibold hover:text-toss-blue">{{ dn.source.name }}</a> · {{ dn.basis }}</p>
  </div>
  <p v-else class="text-toss-gray-400 py-10 text-center">불러오는 중…</p>
</template>
```

- [ ] **Step 4: 빌드/프리렌더 검증**

Run: `pnpm build:baked 2>&1 | tail -3 && node .output/server/index.mjs & sleep 2; curl -s "localhost:3000/insights?tab=dining" | grep -o "식당" | head -1; kill %1`
Expected: 빌드 성공, 페이지 응답.

- [ ] **Step 5: Commit**

```bash
git add app/pages/insights.vue
git commit -m "feat: 펀팩트 식당 분석 탭(당/나이/성별/띠/재산/평수/지역구)"
```

---

## Phase 5 — 의원 상세 식당 카드

### Task 15: members/[id] 식당 미니 카드

**Files:**
- Modify: `app/pages/members/[id].vue`

- [ ] **Step 1: 현재 구조 확인**

Run: `grep -n "useFetch\|<template>\|PageHeader\|대표발의\|section" app/pages/members/[id].vue | head -20`
Expected: 데이터 페치/섹션 배치 패턴 파악.

- [ ] **Step 2: 식당 데이터 페치 추가** (스크립트, 지연 로드)

```ts
import type { DiningData } from "#shared/types";
const { data: dining } = await useFetch<DiningData>("/api/dining", { key: "dining" });
const myDining = computed(() => dining.value?.byMember.find((m) => m.id === route.params.id));
```
(파일에 `route` 가 이미 있으면 재사용; 없으면 `const route = useRoute()` 추가.)

- [ ] **Step 3: 템플릿 — 미니 카드** (적절한 섹션 위치에, 기존 카드 마크업 스타일로)

```vue
<section v-if="myDining && myDining.visits" class="rounded-2xl border border-toss-gray-200 bg-card p-5">
  <h2 class="font-bold text-toss-gray-900 mb-3">정치자금으로 자주 간 식당</h2>
  <ul class="space-y-1 text-sm">
    <li v-for="r in myDining.topRestaurants" :key="r.name" class="flex justify-between"><span class="font-semibold">{{ r.name }}</span><span class="text-toss-gray-500">{{ r.visits }}회</span></li>
  </ul>
  <NuxtLink to="/dining" class="mt-3 inline-block text-[13px] font-semibold text-toss-blue">정치자금 맛집 전체 보기 →</NuxtLink>
</section>
```

- [ ] **Step 4: 빌드 검증**

Run: `pnpm build:baked 2>&1 | tail -3`
Expected: 빌드 성공.

- [ ] **Step 5: Commit**

```bash
git add "app/pages/members/[id].vue"
git commit -m "feat: 의원 상세에 정치자금 식당 미니 카드"
```

---

## Phase 6 — 최종 검증

### Task 16: 전체 테스트 + 빌드 + 출처/분모 점검

**Files:** (없음 — 검증)

- [ ] **Step 1: 단위테스트 전체**

Run: `pnpm vitest run`
Expected: 신규 dining 테스트 포함 전부 PASS.

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: local-verify-flow 메모리상 기존 에러 외 신규 에러 0.

- [ ] **Step 3: 프로덕션 빌드 + 프리렌더 grep**

Run:
```bash
pnpm build:baked 2>&1 | tail -5
node .output/server/index.mjs & sleep 2
for p in /dining "/insights?tab=dining"; do echo "== $p =="; curl -s "localhost:3000$p" | grep -o "오마이뉴스" | head -1; done
kill %1
```
Expected: 빌드 성공, 두 경로 모두 출처표시("오마이뉴스") 노출.

- [ ] **Step 4: 출처표시·분모·추정 라벨 최종 확인**

체크리스트(코드 grep 으로 확인):
- `/dining` 과 insights 식당 탭에 출처(`source.name`) 노출. ✅
- 데모그래픽 분석 카드에 분모(`matchedMembers`) 표기. ✅
- 음식종류에 "추정" 라벨. ✅
- 지역구 카드에 커버리지 %와 비례대표 제외 안내. ✅

- [ ] **Step 5: 최종 커밋(있으면)**

```bash
git add -A && git commit -m "test: 식당 기능 전체 검증" || echo "no changes"
```

---

## Self-Review 결과 (작성자 점검)

- **스펙 커버리지**: 식당 뷰어(Task 11), 무엇을 먹나/음식종류(Task 4·14), 당/나이/성별/띠/재산/평수(Task 6·12·14), 지역구 only/never(Task 5·6·13), 출처표시·분모·추정 라벨(Task 11·14·16). 전체 매핑됨.
- **플레이스홀더**: 없음(모든 코드 단계에 실제 코드 포함). 단 Task 10·15 는 기존 파일 구조를 grep 으로 먼저 확인하라는 단계를 포함(구체 삽입 형식 제시).
- **타입 일관성**: `DiningData`/`DiningMember`/`DiningBreakdownRow`/`DiningRestaurant`/`DiningDistrictMember` 가 types(Task 8)·API(Task 9)·UI(11~15)에서 동일 이름·필드로 사용됨. `aggregate` 산출 키와 타입 필드 일치.
- **ZODIAC 정합성(수정 완료)**: Task 7 의 띠 계산을 `gen-graph-data.mjs` 와 동일한 `2020=쥐, (year-2020)%12` 기준으로 맞춤(권성동 1960→쥐 검증).
