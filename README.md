# 의정감시 (Uijeong Watch)

대한민국 **제22대 국회 의정활동 감시 대시보드**. 국회사무처 [열린국회정보 Open API](https://open.assembly.go.kr) 데이터로 의원·의안·본회의 표결·위원회·국회 일정을 한눈에 추적합니다.

> 🔗 https://asm.zihado.com

## 주요 기능

- **대시보드** — 현직 의원/계류·처리 의안/표결 핵심 지표, 정당별 의석, 최근 본회의 표결, 다가오는 일정
- **국회의원** — 현직 300명 검색(이름·지역구·위원회) + 정당 필터, 의원 상세(프로필·연락처·대표발의 법안)
- **의안** — 계류/처리 법률안, 검색, 페이지네이션
- **본회의 표결** — 안건별 찬반 집계 + **의원별 표결 명단**(결과·정당·이름 필터)
- **위원회 / 국회 일정**

## 기술 스택

- **Nuxt 4** (SSR) · **Tailwind CSS v4** · **shadcn-vue** · Pretendard
- **Cloudflare Workers** (Static Assets) 배포 · **KV** 캐시
- 토스풍 블루/화이트 디자인

## 아키텍처 — 3단 엣지 캐싱

```
방문자 ──▶ ① 페이지 SWR 엣지 캐시 (렌더된 HTML, API 호출 0)
              └─(miss)─▶ SSR ──▶ ② API SWR 엣지 캐시
                                    └─(miss)─▶ ③ KV 영속 캐시 (defineCachedEventHandler)
                                                  └─(miss)─▶ 열린국회정보 Open API
```

국회 API 응답은 서버(Nitro)에서만 호출하며 인증키는 노출되지 않습니다. `User-Agent` 헤더를 주입해야 정상 응답을 받습니다.

## 로컬 개발

```bash
bun install
echo "API_KEY=발급키" > .env
bun run dev          # http://localhost:4191
```

> Node 22 LTS 권장 (`.nvmrc`). Node 26 + macOS 조합에서 vite-node 유닉스 소켓 경로 길이 충돌이 있어 `TMPDIR=/tmp` 로 우회합니다.

## 배포 (Cloudflare Workers)

```bash
# 1) API 키를 Worker secret 으로 등록 (최초 1회)
bunx wrangler secret put NUXT_ASSEMBLY_API_KEY

# 2) 빌드 + 배포
bun run deploy
```

KV 네임스페이스(`CACHE`)와 커스텀 도메인(`asm.zihado.com`)은 `wrangler.jsonc` 에 정의되어 있습니다.

## 데이터 출처

국회사무처 열린국회정보 Open API. 본 서비스는 비영리 의정 모니터링 프로젝트입니다.
