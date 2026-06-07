import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  modules: ["shadcn-nuxt", "@vueuse/nuxt"],

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
  },

  // Cloudflare Workers (Static Assets) 배포 프리셋
  nitro: {
    preset: "cloudflare_module",
    cloudflare: {
      nodeCompat: true,
      deployConfig: false, // wrangler.jsonc 를 직접 관리
    },
  },

  // 엣지 캐싱은 운영(Workers)에서만 — dev 는 항상 fresh SSR (정확한 개발)
  //  - 페이지: SSR HTML 을 SWR 로 캐시 → 방문자는 엣지에서 즉시 수신, API 호출 0
  //  - API: 클라이언트측(페이지네이션·검색·필터) 호출을 엣지에서 캐시
  //  - 캐시 스토리지: KV 바인딩으로 영속화
  $production: {
    routeRules: {
      // pages
      "/": { swr: 1800 },
      "/members": { swr: 21600 },
      "/members/**": { swr: 21600 },
      "/committees": { swr: 21600 },
      "/bills": { swr: 600 },
      "/votes": { swr: 600 },
      "/votes/**": { swr: 3600 },
      "/schedule": { swr: 1800 },
      // api
      "/api/stats": { swr: 1800 },
      "/api/members": { swr: 21600 },
      "/api/committees": { swr: 21600 },
      "/api/bills": { swr: 600 },
      "/api/votes": { swr: 600 },
      "/api/votes/**": { swr: 3600 },
      "/api/schedule": { swr: 1800 },
      "/api/members/**": { swr: 1800 },
      // 정적 자산 장기 캐시 (해시 파일명 → immutable)
      "/_nuxt/**": {
        headers: { "cache-control": "public, max-age=31536000, immutable" },
      },
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
