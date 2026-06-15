# Instagram 자동 홍보 봇 — Design Spec

- **Date:** 2026-06-15
- **Site:** 의정감시 (Uijeong Watch) — https://asm.zihado.com
- **Goal:** 매일 09:00 KST에 사이트의 펀팩트(insight)를 자동으로 인스타그램에 게시한다. 사람 개입 0 (fully hands-off).

## 1. Summary

기존 Cloudflare Worker(Nuxt 4 / Nitro, `cloudflare_module` preset)에 **Cron Trigger**를 추가한다.
매일 1회 실행되어:

1. `insights.json`(빌드타임 집계 펀팩트)에서 **다음 순번**의 인사이트를 고른다 (KV 포인터 회전).
2. 브랜드 1080×1080 PNG를 **Satori(`workers-og`)** 로 렌더한다.
3. 템플릿 기반 **한국어 캡션 + 고정 해시태그**를 생성한다.
4. **Instagram Graph API** 2단계(컨테이너 생성 → 게시)로 발행한다.
5. 성공 시에만 포인터를 advance + 게시일자 기록 (idempotency).

선택된 옵션 (브레인스토밍 합의):

- 자동화 범위: **전자동** (스케줄 → 렌더 → 캡션 → 게시, 무인)
- 게시 방식: **공식 Instagram Graph API** (Business/Creator 계정, 비공식 봇 금지)
- 콘텐츠 선택: **일 1회 순번 회전(rotation, daily)** — 모든 펀팩트가 한 번씩 노출, 소진 전 반복 없음
- 이미지: **Satori / `ImageResponse` (`workers-og`)** — Workers 네이티브, 브라우저 불필요
- 캡션: **템플릿(deterministic)** — API 키·토큰비용·돌발 출력 위험 없음
- 스케줄/상태: **Cloudflare Cron Triggers + KV(`CACHE`)**, 매일 **09:00 KST (00:00 UTC)**

## 2. Data flow

```
Cron (0 0 * * * UTC) 발화
  → catalog 로드 (insights.json → PostSpec[])
  → KV 포인터 읽기 (다음 index) + lastPostedDate 가드
  → render(PostSpec) → PNG
  → PNG 를 공개 라우트 /og/<slug>.png 로 제공 (IG 가 fetch)
  → caption(PostSpec) → 한국어 캡션 + 해시태그
  → publish: POST /{IG_USER_ID}/media (image_url + caption) → creation_id
            POST /{IG_USER_ID}/media_publish (creation_id)
  → 성공: 포인터 advance + lastPostedDate 기록 (KV)
  → 실패: 로그만 남기고 종료 (포인터 불변, 다음 날 재시도)
```

## 3. Components (작은 파일 다수, 단일 책임)

| File | Responsibility | Depends on |
|---|---|---|
| `server/utils/instagram/catalog.ts` | `insights.json` 을 순서가 정해진 `PostSpec[]`(제목·통계·부제·source slug)로 평탄화. 회전 "덱". | `insights.json`, `#shared/types` |
| `server/utils/instagram/render.ts` | `PostSpec → PNG` (`workers-og`). 1080×1080 브랜드 템플릿: 헤드라인, 큰 통계 숫자, 정당색 미니 바, `asm.zihado.com` 푸터. | `workers-og`, 폰트(Pretendard subset) |
| `server/utils/instagram/caption.ts` | `PostSpec → 한국어 캡션` + 고정 해시태그. 순수 함수. | — |
| `server/utils/instagram/publish.ts` | Graph API 2단계 발행. fetch 래퍼, 에러 표면화. | `IG_USER_ID`, `IG_ACCESS_TOKEN` |
| `server/utils/instagram/state.ts` | KV 회전 index + `lastPostedDate` 읽기/쓰기 (idempotency). | KV `CACHE` |
| `server/routes/og/[slug].png.ts` | IG 가 가져갈 공개 PNG 라우트 (KV/엣지 캐시). | `render.ts`, `catalog.ts` |
| `server/tasks/instagram-daily.ts` | Nitro scheduled task — 위 플로우 오케스트레이션. | 위 전부 |

### PostSpec (개념 타입)

```ts
type PostSpec = {
  slug: string;        // 안정적 파일명/캐시키 (e.g. "terms-top", "wealth-top")
  category: string;    // 인사이트 분류 (다선/재산/띠/별자리/성씨/...)
  headline: string;    // 카드 제목
  stat: string;        // 강조 숫자/문구
  subtitle?: string;   // 보조 설명
  items?: { label: string; value: number; party?: string }[]; // 미니 바용
};
```

## 4. Wiring

- **`wrangler.jsonc`**: `"triggers": { "crons": ["0 0 * * *"] }` 추가.
- **`nuxt.config.ts`**: Nitro `experimental.tasks: true` + `scheduledTasks` 로 cron → `instagram-daily` 매핑. `cloudflare_module` preset 이 이를 Worker `scheduled` 핸들러로 라우팅.
- **Secrets** (`wrangler secret put`): `IG_USER_ID`, `IG_ACCESS_TOKEN`, `IG_PREVIEW_TOKEN`(드라이런 가드). 레포에 평문 저장 금지.

## 5. Safety / error handling

- **Idempotent:** 포인터는 **게시 확정 후에만** advance. `lastPostedDate === 오늘` 이면 재발화는 no-op → 중복 게시 불가.
- **Fail-soft:** 임의 단계 throw → observability 로그(이미 활성) 후 그날 스킵, 다음 실행에서 재시도. 절반 게시·포인터 손상 없음.
- **입력 검증:** `insights.json` 비었거나 PostSpec 필수 필드 누락 시 명확히 실패(fail fast), 깨진 이미지 게시 방지.
- **드라이런 라우트** `GET /api/ig/preview?token=…` (시크릿 가드) → 게시 없이 오늘의 이미지+캡션 반환. 첫 실제 게시 전 육안 확인 + E2E 검증 수단.

## 6. Testing

- **Unit (순수 함수):** `catalog` 평탄화/순서, `caption` 출력 포맷.
- **Integration:** 드라이런 라우트로 catalog→render→caption 경로 검증. `publish` 는 dry 모드(컨테이너 생성까지만, publish 스킵) 우선 검증 후 실게시.

## 7. Operational (사용자 1회 셋업)

타깃 계정: **@landman.official**.

Graph API 전제: 계정이 **Business/Creator** + **Facebook 페이지 연결** + **Meta 앱**(`instagram_content_publish` 권한).

- `docs/instagram-setup.md` 에 `IG_USER_ID` + 장기 토큰 발급 클릭 경로 문서화.
- 장기 토큰 ~60일 만료 → **월 1회 토큰 자동 갱신 cron** 추가하여 무중단 유지.

## 8. Out of scope (YAGNI)

- AI 캡션 생성, 멀티 이미지/캐러셀, 스토리/릴스, 다계정, 댓글 자동응답.
- 게시 전 사람 승인 큐 (전자동 선택으로 불필요).
