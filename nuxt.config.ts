import { existsSync, readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";

// 빌드 전 생성된 member-details.json 으로 의원 상세 프리렌더 라우트 구성
function memberRoutes(): string[] {
  try {
    const p = "./server/assets/member-details.json";
    if (!existsSync(p)) return [];
    return Object.keys(JSON.parse(readFileSync(p, "utf8"))).map(
      (id) => `/members/${id}`,
    );
  } catch {
    return [];
  }
}

// 최근 표결 60건 상세도 프리렌더 (자주 클릭되는 경로)
function voteRoutes(): string[] {
  try {
    const p = "./server/assets/voted-bills.json";
    if (!existsSync(p)) return [];
    return (JSON.parse(readFileSync(p, "utf8")) as string[]).map(
      (id) => `/votes/${id}`,
    );
  } catch {
    return [];
  }
}

// 위원회 상세 전부 프리렌더
function committeeRoutes(): string[] {
  try {
    const p = "./server/assets/committees.json";
    if (!existsSync(p)) return [];
    return (JSON.parse(readFileSync(p, "utf8")) as { deptCd: string }[])
      .filter((c) => c.deptCd)
      .map((c) => `/committees/${c.deptCd}`);
  } catch {
    return [];
  }
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  modules: ["shadcn-nuxt", "@vueuse/nuxt", "@nuxtjs/color-mode"],

  colorMode: {
    classSuffix: "", // .dark / (light = no class) — tailwind dark variant 매칭
    preference: "system",
    fallback: "light",
    storageKey: "uijeong-color-mode",
  },

  css: ["~/assets/css/tailwind.css"],

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      htmlAttrs: { lang: "ko" },
      title: "의정감시 · 국회 의정활동 모니터",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "대한민국 국회 열린국회정보 Open API 기반 의정활동 감시 대시보드 — 의원, 의안, 본회의 표결, 위원회, 국회 일정을 한눈에.",
        },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "의정감시" },
        { property: "og:title", content: "의정감시 · 국회 의정활동 모니터" },
        {
          property: "og:description",
          content:
            "제22대 국회 — 의원·의안·본회의 표결·위원회·펀팩트를 한눈에. 열린국회정보 공식 데이터.",
        },
        { property: "og:image", content: "https://asm.zihado.com/og.png" },
        { property: "og:url", content: "https://asm.zihado.com" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "의정감시 · 국회 의정활동 모니터" },
        {
          name: "twitter:description",
          content: "제22대 국회 의정활동을 한눈에 — 표결·의안·펀팩트",
        },
        { name: "twitter:image", content: "https://asm.zihado.com/og.png" },
      ],
      link: [
        {
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
        },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      ],
    },
  },

  runtimeConfig: {
    // 로컬: .env 의 API_KEY / 운영: Worker secret NUXT_ASSEMBLY_API_KEY 로 주입
    assemblyApiKey:
      process.env.NUXT_ASSEMBLY_API_KEY || process.env.API_KEY || "",
    public: {
      // Kakao 지도 JavaScript 키 (클라이언트 노출 — 도메인 제한으로 보호)
      kakaoMapKey: process.env.KAKAO_MAP_KEY || "",
    },
  },

  // Cloudflare Workers (Static Assets) 배포 프리셋
  nitro: {
    preset: "cloudflare_module",
    cloudflare: {
      nodeCompat: true,
      deployConfig: false, // wrangler.jsonc 를 직접 관리
    },
    // 의원 상세 300개를 빌드타임 프리렌더 → 정적 에셋 엣지 직배(cf=HIT)
    prerender: {
      crawlLinks: false,
      routes: [
        "/sitemap.xml",
        ...memberRoutes(),
        ...voteRoutes(),
        ...committeeRoutes(),
      ],
    },
  },

  // 운영(Workers) 캐싱 — 엣지 SWR 로 대부분 요청을 Worker SSR 없이 즉시 응답.
  //  ⚠ 재배포 시 stale HTML 이 사라진 에셋을 참조하는 문제는 'bun run deploy'
  //     마지막에 KV 캐시를 자동 퍼지(scripts/purge-kv.mjs)해서 방지.
  $production: {
    routeRules: {
      // HTML 만 브라우저가 매번 재검증 → 재배포 시 옛 HTML(죽은 에셋 참조) 캐시 방지.
      // ⚠ 전역 "/**" 캐치올을 쓰면 /m/* 아바타·정적 에셋의 cache-control 과 합쳐져
      //   (max-age=0 + max-age=2592000 중복) 브라우저가 매번 재검증 → 느려짐.
      //   그래서 HTML 라우트에만 개별로 붙인다. (/_nuxt/*·/m/* 는 자기 규칙 유지)
      // 베이크된 의원 아바타: id 기반 안정 파일명 → 브라우저 30일 캐시(엣지는 cf=HIT)
      "/m/**": { headers: { "cache-control": "public, max-age=2592000" } },
      // 빌드타임 프리렌더 → CF 정적 에셋으로 엣지 직배(최속). 기본 뷰 기준.
      "/members": { prerender: true, headers: { "cache-control": "public, max-age=0, must-revalidate" } },
      "/committees": { prerender: true, headers: { "cache-control": "public, max-age=0, must-revalidate" } },
      "/bills": { prerender: true, headers: { "cache-control": "public, max-age=0, must-revalidate" } },
      "/votes": { prerender: true, headers: { "cache-control": "public, max-age=0, must-revalidate" } },
      "/insights": { prerender: true, headers: { "cache-control": "public, max-age=0, must-revalidate" } },
      "/": { prerender: true, headers: { "cache-control": "public, max-age=0, must-revalidate" } },
      "/schedule": { prerender: true, headers: { "cache-control": "public, max-age=0, must-revalidate" } },
      // 나머지(개별 라우트): SSR HTML 을 엣지 SWR 캐시 + 브라우저 재검증
      "/members/**": { swr: 3600, headers: { "cache-control": "public, max-age=0, must-revalidate" } },
      "/votes/**": { swr: 3600, headers: { "cache-control": "public, max-age=0, must-revalidate" } },
      "/committees/**": { swr: 3600, headers: { "cache-control": "public, max-age=0, must-revalidate" } },
      // API: 클라이언트측 호출도 엣지 SWR 캐시
      "/api/stats": { swr: 1800 },
      "/api/members": { swr: 21600 },
      "/api/members/**": { swr: 3600 },
      "/api/committees": { swr: 21600 },
      "/api/bills": { swr: 600 },
      "/api/votes": { swr: 600 },
      "/api/votes/**": { swr: 3600 },
      "/api/schedule": { swr: 1800 },
    },
    nitro: {
      storage: {
        cache: { driver: "cloudflare-kv-binding", binding: "CACHE" },
      },
    },
  },

  shadcn: {
    prefix: "",
    componentDir: "./app/components/ui",
  },
});
