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
  },

  // Cloudflare Workers (Static Assets) 배포 프리셋
  nitro: {
    preset: "cloudflare_module",
    cloudflare: {
      nodeCompat: true,
      deployConfig: false, // wrangler.jsonc 를 직접 관리
    },
  },

  // 운영(Workers) 캐싱
  //  - 페이지 HTML 은 SWR 로 캐시하지 않음: 재배포 시 에셋 해시가 바뀌어
  //    KV 에 남은 옛 HTML 이 사라진 /_nuxt/*.css 를 참조 → 스타일 깨짐을 유발.
  //    페이지는 매번 fresh SSR (아래 API KV 캐시 덕에 충분히 빠름).
  //  - API 응답은 defineCachedEventHandler 가 KV(CACHE 바인딩)에 영속 캐시
  //    → 국회 Open API rate limit 보호 + 빠른 SSR.
  $production: {
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
