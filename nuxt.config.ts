import tailwindcss from "@tailwindcss/vite";

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
  },

  // 운영(Workers) 캐싱 — 엣지 SWR 로 대부분 요청을 Worker SSR 없이 즉시 응답.
  //  ⚠ 재배포 시 stale HTML 이 사라진 에셋을 참조하는 문제는 'bun run deploy'
  //     마지막에 KV 캐시를 자동 퍼지(scripts/purge-kv.mjs)해서 방지.
  $production: {
    routeRules: {
      // 페이지: SSR HTML 을 엣지 SWR 캐시 (방문자는 엣지 HIT → ~수십 ms)
      "/": { swr: 600 },
      "/members": { swr: 21600 },
      "/members/**": { swr: 3600 },
      "/committees": { swr: 21600 },
      "/bills": { swr: 600 },
      "/votes": { swr: 600 },
      "/votes/**": { swr: 3600 },
      "/schedule": { swr: 1800 },
      // API: 클라이언트측 호출도 엣지 SWR 캐시
      "/api/stats": { swr: 1800 },
      "/api/members": { swr: 21600 },
      "/api/member-photos": { swr: 43200 },
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
