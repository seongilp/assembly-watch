/**
 * `cloudflare:workers` 타입 선언 — Workers 런타임 전용 모듈.
 * 런타임 구현: Workers 배포는 내장 모듈, node-server 빌드는 server/cf-compat.ts 심.
 * 소비 코드는 env(CACHE/ASSETS/시크릿 키)만 사용한다.
 */
declare module "cloudflare:workers" {
  export interface Env {
    CACHE: {
      get(key: string): Promise<string | null>;
      put(key: string, value: string): Promise<void>;
    };
    ASSETS: { fetch(req: Request): Promise<Response> };
    [key: string]: unknown;
  }
  export const env: Env;
}
