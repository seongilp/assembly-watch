# Instagram 자동 게시 셋업 (@landman.official, 1회)

자동 게시는 공식 Instagram Graph API 만 사용한다. 필요한 시크릿 2개: `IG_USER_ID`, `IG_ACCESS_TOKEN` (+ 드라이런 가드용 `IG_PREVIEW_TOKEN`).

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
```
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token&client_id={APP_ID}
  &client_secret={APP_SECRET}&fb_exchange_token={SHORT_LIVED_TOKEN}
```
이후 `GET /me/accounts` 로 받은 **페이지 액세스 토큰**은 (장기 사용자 토큰에서 파생 시) 만료되지 않는다 → 이 값을 **IG_ACCESS_TOKEN** 으로 사용. 이 방식이면 토큰 갱신 cron 이 불필요하다.

## 6. 시크릿 등록 (홈서버)

서빙이 Cloudflare Workers → ebs 홈서버로 옮겨졌으므로 wrangler secret 이 아니라
서버의 런타임 env 파일에 넣는다. 이 파일은 배포 rsync 에서 제외되므로 덮어써지지 않는다.

```
ssh ebs
sudo -u ubuntu tee -a ~/apps/uijeong/.env.runtime >/dev/null <<'EOF'
IG_USER_ID=<발급받은 값>
IG_ACCESS_TOKEN=<발급받은 값>
IG_PREVIEW_TOKEN=<임의 난수>
EOF
sudo systemctl restart app-uijeong
```

## 7. 게시 확인
- 드라이런: `curl -H "Authorization: Bearer <IG_PREVIEW_TOKEN>" https://asm.zihado.com/api/ig/preview` → slug·캡션·imageUrl 확인 (토큰은 헤더로만 전달 — URL 에 넣으면 observability 로그에 기록됨)
- 이미지: `https://asm.zihado.com/og/terms.png`
- 앱은 개발 모드여도 **본인 계정** 게시는 App Review 없이 동작한다.
- OG 카드는 satori(레이아웃) + @resvg/resvg-js(PNG) 로 렌더한다. workers-og 는
  Workers 전용 yoga wasm 때문에 node 에서 로드되지 않아 걷어냈다.

## 동작 방식 요약
- 매일 09:00 KST(`0 0 * * *` UTC) Nitro 스케줄러가 `server/tasks/instagram/daily.ts` 실행.
  (node-server 프리셋이 scheduledTasks 를 자체 처리한다 — Workers Cron 이 아니다.
  실행 여부는 `journalctl -u app-uijeong | grep instagram:daily` 로 확인)
- `insights.json` 랭킹 덱에서 KV 포인터(`ig:pointer`) 순번의 펀팩트 1개 선택 → `/og/<slug>.png` 1080² PNG + 템플릿 캡션 → Graph API 2단계 게시.
- 게시 성공 후에만 포인터 advance + `ig:lastPosted` 기록(같은 날 중복 게시 방지).
- 콘텐츠 덱 순서·구성은 `server/utils/instagram/catalog.ts` 의 `DECK` 에서만 조정.

## 참고: 토큰 만료 모니터링(선택)
만료 없는 페이지 토큰을 쓰면 갱신이 불필요. 사용자 토큰을 쓴다면 60일마다 5단계 재교환 필요 — 추후 주간 헬스체크 cron 추가 가능(현재 범위 외).
