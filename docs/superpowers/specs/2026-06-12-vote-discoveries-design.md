# 표결의 발견 (Vote Discoveries) — 설계

2026-06-12 · 승인됨 (표결 상세 + 인사이트 둘 다 / 자동 문장 + 미니 차트)

## 목적

본회의 표결(283건)마다 찬성/반대/기권/불참 의원들의 **집단 특성**을 자동 분석해
"이 법안은 재산 상위 25%가 갈렸다", "토끼띠 의원 전원 찬성" 같은 재밌는 인사이트를
문장 + 미니 비교 차트로 보여준다.

## 분석 차원 (10개)

| 차원 | 그룹핑 | 비고 |
|---|---|---|
| 권역 | 수도권/충청/호남/영남/강원·제주 (+비례 별도) | 지역구 의원만 |
| 수도권 vs 비수도권 | 2그룹 | 지역구 의원만 |
| 재산 | 4분위 + 상위 10% | wealth.json 279명 |
| 세대 | 40대 이하/50대/60대/70대+ | birth 기반 |
| 선수 | 초선/재선/3선+ | reelection |
| 성별 | 남/여 | |
| 지역구 vs 비례 | 2그룹 | electType |
| 띠 | 12간지 | fun 플래그, 작은 표본 허용 |
| 성씨 | n≥10인 성씨만 | fun 플래그 |
| 당내 균열 | 정당별 소수파 ≥20% | 소수파 의원 실명 노출 |

추가 분석:
- **불참 프로필**: 불참 n≥15일 때 불참자 평균 재산/나이 vs 출석자 비교, 정당 집단 불참(≥80%) 감지
- **정당 통제**: 재산/세대/선수 격차 발견 시 거대 양당 내부에서도 같은 방향 격차(≥15%p)가 있는지 확인 — 있으면 "같은 당 안에서도" 문구 추가 + 점수 가산

## 통계 기준

- 찬성률 = Y/(Y+N+B) (출석 기준, 불참 제외)
- 일반 차원: 그룹당 출석 10명+, 격차 20%p+ 일 때만 팩트 생성
- fun 차원(띠/성씨): 그룹 8명+, 격차 30%p+ 또는 "전원 일치" 패턴
- 전원 일치 팩트: 그룹 8명+ 전원 같은 표 & 전체 찬성률 20~80%일 때 고득점
- 팩트 점수 = 격차 × √(작은 그룹 크기), fun 차원 ×0.6 — 의안당 상위 4개 노출, fun 팩트가 있으면 1개 보장
- 보이콧(정당 80%+ 불참) 감지 시 해당 정당은 불참 프로필에서 제외 — 정당별 재산 차이의 그림자 효과 방지

## 아키텍처

```
scripts/gen-vote-analysis.mjs        # 빌드타임, 외부 API 없음 (기존 JSON 재처리)
  입력: votedata.json + members.json + wealth.json
  출력: server/assets/vote-analysis.json
    ├─ byBill: { [billId]: VoteFact[] }   # 의안당 최대 4개
    └─ topPicks: TopPick[]                # 전역 점수 상위 12 (의안당 1개, 차원당 2개 — 불참·보이콧은 1개)

API:
  /api/votes/[billId]      # 기존 응답에 facts 필드 추가 (신규 라우트 없음, 프리렌더 포함)
  /api/vote-analysis-top   # topPicks (insights 발견 탭 지연 로드, swr 3600)

UI:
  app/components/VoteFacts.vue        # 표결 상세 "🔍 이 표결의 발견" 섹션
  app/components/VoteDiscoveries.vue  # insights 발견 탭 톱픽 카드 (표결 상세 링크)
  app/pages/votes/[billId].vue        # 집계 아래 VoteFacts 삽입
  app/pages/insights.vue              # 4번째 탭 "발견" (graph/wealth와 동일 지연 로드 패턴)
```

## 타입 (shared/types.ts)

```ts
interface VoteFactGroup { label: string; yes: number; no: number; blank: number; absent: number; rate: number }
interface VoteFact { dim: string; title: string; text: string; fun?: boolean; score: number; groups?: VoteFactGroup[]; rebels?: GraphMini[] }
interface VoteTopPick { billId: string; billNo: string; billName: string; date: string; y: number; n: number; b: number; fact: VoteFact }
```

## 엣지 케이스

- matrix 코드 `-`(당시 비현직) 제외
- 재산 데이터 없는 의원(21명)은 재산 차원에서만 제외
- 만장일치 의안: 격차 팩트가 자연히 0 → 불참/집단불참 팩트만 생성될 수 있음
- 팩트 0개인 의안: UI 섹션 자체를 숨김
- 면책: "재미로 보는 통계적 관찰이며 인과관계가 아님" 문구 표기
